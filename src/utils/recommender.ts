import type { TargetRow, MasterRow } from '../types';
import { normalizeKodePos, cleanText, textSimilarityScore } from './normalizer';

export interface RecommendationResult {
  targetRow: TargetRow;
  recommendedMaster: MasterRow;
  score: number; // 0 - 100
  reason: string;
}

/**
 * Find the closest Master branch recommendation for an unmatched Target row
 * Benchmark criteria:
 * 1. Dati II / Kabupaten / Kota similarity (Weight: 35%)
 * 2. Kecamatan & Kelurahan text similarity (Weight: 35%)
 * 3. Postal Code proximity: 4-digit or 3-digit prefix match (Weight: 20%)
 * 4. Wilayah / Provinsi match (Weight: 10%)
 */
export function findClosestMasterRecommendation(
  target: TargetRow,
  masterRows: MasterRow[]
): RecommendationResult | null {
  if (masterRows.length === 0) return null;

  const targetKp = normalizeKodePos(target['KODE POS']);
  const targetKec = cleanText(target.Kecamatan);
  const targetKel = cleanText(target.Kelurahan);
  const targetDati = cleanText(target['Dati II']);
  const targetProv = cleanText(target.Provinsi);
  const targetWil = cleanText(target.Wilayah);

  let bestMaster: MasterRow | null = null;
  let highestScore = -1;
  let bestReason = '';

  for (const m of masterRows) {
    const masterKp = normalizeKodePos(m['KODE POS']);
    const masterKec = cleanText(m.Kecamatan);
    const masterKel = cleanText(m.Kelurahan);
    const masterDati = cleanText(m['Dati II']);
    const masterProv = cleanText(m.Provinsi);
    const masterWil = cleanText(m.Wilayah);

    // Filter awal: Utamakan provinsi/wilayah yang sama jika tersedia
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
        scorePostal = 1.0; // 4-digit prefix match (sangat dekat)
      } else if (targetKp.slice(0, 3) === masterKp.slice(0, 3)) {
        scorePostal = 0.75; // 3-digit prefix match (satu kabupaten/kota)
      } else if (targetKp.slice(0, 2) === masterKp.slice(0, 2)) {
        scorePostal = 0.4; // 2-digit prefix match (satu provinsi)
      }
    }

    // 4. Wilayah / Provinsi bonus
    const scoreWilayah = provMatch ? 1.0 : (targetProv && masterProv && textSimilarityScore(targetProv, masterProv) > 0.6 ? 0.7 : 0);

    // Weighted composite score (0 to 1.0)
    const composite = (scoreDati * 0.35) + (scoreSubDistrict * 0.35) + (scorePostal * 0.20) + (scoreWilayah * 0.10);

    if (composite > highestScore) {
      highestScore = composite;
      bestMaster = m;

      // Bentuk deskripsi alasan rekomendasi
      const reasons: string[] = [];
      if (scoreDati >= 0.8) reasons.push(`Dati II Cocok (${m['Dati II']})`);
      if (scoreKec >= 0.7) reasons.push(`Kecamatan Cocok (${m.Kecamatan})`);
      else if (scorePostal >= 0.75) reasons.push(`Area Kode Pos Sama (${masterKp.slice(0, 3)}xx)`);
      if (reasons.length === 0 && provMatch) reasons.push(`Satu Provinsi (${m.Provinsi})`);

      bestReason = reasons.join(' • ') || 'Kedekatan Wilayah Operasional';
    }
  }

  if (!bestMaster) return null;

  const finalPct = Math.round(highestScore * 100);

  return {
    targetRow: target,
    recommendedMaster: bestMaster,
    score: Math.min(Math.max(finalPct, 35), 98), // Normalize between 35% - 98%
    reason: bestReason,
  };
}

/**
 * Generate recommendations for all unmatched Target rows
 */
export function generateRecommendationsForUnmatched(
  targetRows: TargetRow[],
  masterRows: MasterRow[]
): RecommendationResult[] {
  const unmatched = targetRows.filter(r => !r._isMatched && !r.Sandi && !r['Sandi Cabang']);
  const results: RecommendationResult[] = [];

  for (const row of unmatched) {
    const rec = findClosestMasterRecommendation(row, masterRows);
    if (rec) {
      results.push(rec);
    }
  }

  return results;
}
