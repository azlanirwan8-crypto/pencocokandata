import type { TargetRow, MasterRow } from '../types';
import { normalizeKodePos, cleanText, textSimilarityScore } from './normalizer';

export interface RecommendationResult {
  targetRow: TargetRow;
  recommendedMaster: MasterRow;
  score: number; // 0 - 100
  reason: string;
}

export interface MasterProximityIndex {
  byPostal3: Map<string, MasterRow[]>;
  byPostal2: Map<string, MasterRow[]>;
  byDati: Map<string, MasterRow[]>;
  byProv: Map<string, MasterRow[]>;
  all: MasterRow[];
}

/**
 * Builds an O(1) inverted lookup index for Master rows to avoid O(N * M) full-table scans.
 * Dramatically accelerates proximity search for large datasets.
 */
export function buildMasterProximityIndex(masterRows: MasterRow[]): MasterProximityIndex {
  const byPostal3 = new Map<string, MasterRow[]>();
  const byPostal2 = new Map<string, MasterRow[]>();
  const byDati = new Map<string, MasterRow[]>();
  const byProv = new Map<string, MasterRow[]>();

  for (let i = 0; i < masterRows.length; i++) {
    const m = masterRows[i];
    const kp = normalizeKodePos(m['KODE POS']);
    if (kp.length >= 3) {
      const p3 = kp.slice(0, 3);
      let arr3 = byPostal3.get(p3);
      if (!arr3) {
        arr3 = [];
        byPostal3.set(p3, arr3);
      }
      if (arr3.length < 30) arr3.push(m);

      const p2 = kp.slice(0, 2);
      let arr2 = byPostal2.get(p2);
      if (!arr2) {
        arr2 = [];
        byPostal2.set(p2, arr2);
      }
      if (arr2.length < 30) arr2.push(m);
    }

    const dati = cleanText(m['Dati II']);
    if (dati) {
      let arrD = byDati.get(dati);
      if (!arrD) {
        arrD = [];
        byDati.set(dati, arrD);
      }
      if (arrD.length < 30) arrD.push(m);
    }

    const prov = cleanText(m.Provinsi);
    if (prov) {
      let arrP = byProv.get(prov);
      if (!arrP) {
        arrP = [];
        byProv.set(prov, arrP);
      }
      if (arrP.length < 30) arrP.push(m);
    }
  }

  return { byPostal3, byPostal2, byDati, byProv, all: masterRows };
}

/**
 * Retrieve candidate Master rows using fast bucket lookup.
 * Limits candidate pool to high-probability nearby branches.
 */
function getMasterCandidates(target: TargetRow, index: MasterProximityIndex): MasterRow[] {
  const targetKp = normalizeKodePos(target['KODE POS']);
  const targetDati = cleanText(target['Dati II']);
  const targetProv = cleanText(target.Provinsi);

  const seen = new Set<MasterRow>();
  const candidates: MasterRow[] = [];

  const addCandidates = (list?: MasterRow[]) => {
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!seen.has(item)) {
        seen.add(item);
        candidates.push(item);
        if (candidates.length >= 35) return;
      }
    }
  };

  // 1. Try 3-digit postal code match (high precision)
  if (targetKp.length >= 3) {
    addCandidates(index.byPostal3.get(targetKp.slice(0, 3)));
  }

  // 2. Try Dati II match
  if (candidates.length < 20 && targetDati) {
    addCandidates(index.byDati.get(targetDati));
  }

  // 3. Try 2-digit postal code match
  if (candidates.length < 15 && targetKp.length >= 2) {
    addCandidates(index.byPostal2.get(targetKp.slice(0, 2)));
  }

  // 4. Try Provinsi match
  if (candidates.length < 10 && targetProv) {
    addCandidates(index.byProv.get(targetProv));
  }

  // 5. Fallback if still empty: take small slice of all master rows
  if (candidates.length === 0 && index.all.length > 0) {
    const limit = Math.min(15, index.all.length);
    for (let i = 0; i < limit; i++) {
      candidates.push(index.all[i]);
    }
  }

  return candidates;
}

/**
 * Find the closest Master branch recommendation for an unmatched Target row
 */
export function findClosestMasterRecommendation(
  target: TargetRow,
  candidates: MasterRow[]
): RecommendationResult | null {
  if (candidates.length === 0) return null;

  const targetKp = normalizeKodePos(target['KODE POS']);
  const targetKec = cleanText(target.Kecamatan);
  const targetKel = cleanText(target.Kelurahan);
  const targetDati = cleanText(target['Dati II']);
  const targetProv = cleanText(target.Provinsi);
  const targetWil = cleanText(target.Wilayah);

  let bestMaster: MasterRow | null = null;
  let highestScore = -1;
  let bestReason = '';

  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i];
    const masterKp = normalizeKodePos(m['KODE POS']);
    const masterKec = cleanText(m.Kecamatan);
    const masterKel = cleanText(m.Kelurahan);
    const masterDati = cleanText(m['Dati II']);
    const masterProv = cleanText(m.Provinsi);
    const masterWil = cleanText(m.Wilayah);

    const provMatch = targetProv && masterProv && (targetProv === masterProv || targetWil === masterWil);

    // 1. Dati II similarity
    const scoreDati = textSimilarityScore(targetDati, masterDati);

    // 2. Kecamatan & Kelurahan similarity
    const scoreKec = textSimilarityScore(targetKec, masterKec);
    const scoreKel = textSimilarityScore(targetKel, masterKel);
    const scoreSubDistrict = Math.max(scoreKec, scoreKel * 0.9, (scoreKec + scoreKel) / 2);

    // 3. Postal Code proximity
    let scorePostal = 0;
    if (targetKp && masterKp) {
      if (targetKp.slice(0, 4) === masterKp.slice(0, 4)) {
        scorePostal = 1.0;
      } else if (targetKp.slice(0, 3) === masterKp.slice(0, 3)) {
        scorePostal = 0.75;
      } else if (targetKp.slice(0, 2) === masterKp.slice(0, 2)) {
        scorePostal = 0.4;
      }
    }

    // 4. Wilayah / Provinsi bonus
    const scoreWilayah = provMatch ? 1.0 : (targetProv && masterProv && textSimilarityScore(targetProv, masterProv) > 0.6 ? 0.7 : 0);

    const composite = (scoreDati * 0.35) + (scoreSubDistrict * 0.35) + (scorePostal * 0.20) + (scoreWilayah * 0.10);

    if (composite > highestScore) {
      highestScore = composite;
      bestMaster = m;

      const reasons: string[] = [];
      const pctDati = Math.round(scoreDati * 35);
      const pctKec = Math.round(scoreSubDistrict * 35);
      const pctPostal = Math.round(scorePostal * 20);
      const pctWil = Math.round(scoreWilayah * 10);

      if (pctDati >= 25) reasons.push(`Dati II Cocok (+${pctDati}%)`);
      if (pctKec >= 20) reasons.push(`Kecamatan Cocok (+${pctKec}%)`);
      else if (pctPostal >= 10) reasons.push(`Radius Pos ${masterKp.slice(0, 3)}xx (+${pctPostal}%)`);
      if (pctWil >= 7) reasons.push(`Provinsi (+${pctWil}%)`);

      bestReason = reasons.join(' • ') || 'Kedekatan Wilayah Operasional';
    }
  }

  if (!bestMaster) return null;

  const finalPct = Math.round(highestScore * 100);

  return {
    targetRow: target,
    recommendedMaster: bestMaster,
    score: Math.min(Math.max(finalPct, 35), 98),
    reason: bestReason,
  };
}

/**
 * Generate recommendations for unmatched Target rows using indexed candidate search.
 * Extremely fast, processing thousands of rows in milliseconds without freezing UI.
 */
export function generateRecommendationsForUnmatched(
  unmatchedRows: TargetRow[],
  masterRows: MasterRow[],
  prebuiltIndex?: MasterProximityIndex
): RecommendationResult[] {
  if (unmatchedRows.length === 0 || masterRows.length === 0) return [];

  const index = prebuiltIndex || buildMasterProximityIndex(masterRows);
  const results: RecommendationResult[] = [];

  for (let i = 0; i < unmatchedRows.length; i++) {
    const row = unmatchedRows[i];
    const candidates = getMasterCandidates(row, index);
    const rec = findClosestMasterRecommendation(row, candidates);
    if (rec) {
      results.push(rec);
    }
  }

  return results;
}
