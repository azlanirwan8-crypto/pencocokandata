import type { TargetRow, MasterRow } from '../types';
import { normalizeKodePos, cleanText, textSimilarityScore } from './normalizer';
import { calculateRealDistance } from './geoDistance';

export interface CandidateOption {
  master: MasterRow;
  score: number; // 0 - 100
  reason: string;
  rank: number; // 1 (Utama), 2 (Alternatif 1), 3 (Alternatif 2)
  distanceKm?: number;
  formattedDistance?: string;
  distanceBasis?: string;
  googleMapsUrl?: string;
}

export interface RecommendationResult {
  targetRow: TargetRow;
  recommendedMaster: MasterRow;
  score: number; // 0 - 100
  reason: string;
  candidates: CandidateOption[];
  distanceKm?: number;
  formattedDistance?: string;
  googleMapsUrl?: string;
}

export interface MasterProximityIndex {
  byKelurahan: Map<string, MasterRow[]>;
  byKecamatan: Map<string, MasterRow[]>;
  byPostal3: Map<string, MasterRow[]>;
  byPostal2: Map<string, MasterRow[]>;
  byDati: Map<string, MasterRow[]>;
  byProv: Map<string, MasterRow[]>;
  kimBranch: MasterRow | null;
  all: MasterRow[];
}

/**
 * Cek apakah baris target berada di Provinsi Aceh
 */
export function isAcehRegion(target: TargetRow): boolean {
  const prov = cleanText(target.Provinsi);
  const dati = cleanText(target['Dati II']);
  const wil = cleanText(target.Wilayah);

  if (prov.includes('aceh')) return true;
  if (wil.includes('aceh')) return true;

  const acehKeywords = [
    'banda aceh', 'aceh besar', 'aceh utara', 'aceh timur', 'aceh barat',
    'aceh selatan', 'aceh tengah', 'aceh tenggara', 'lhokseumawe', 'langsa',
    'sabang', 'subulussalam', 'pidie', 'pidie jaya', 'bireuen', 'bener meriah',
    'gayo lues', 'aceh singkil', 'simeulue', 'aceh tamiang', 'nagan raya',
    'aceh jaya', 'aceh barat daya'
  ];

  return acehKeywords.some(k => dati.includes(k));
}

/**
 * Cari cabang berlabel 'KIM' di master
 */
export function findKimBranch(masterRows: MasterRow[]): MasterRow | null {
  for (let i = 0; i < masterRows.length; i++) {
    const m = masterRows[i];
    const combined = [m.Cabang, m['Sandi Cabang'], m.Sandi, m['Nama Outlet']]
      .filter(Boolean)
      .join(' ')
      .toUpperCase();

    // Cocokkan kata utuh 'KIM' atau awalan 'KIM'
    if (/\bKIM\b/.test(combined) || combined.startsWith('KIM') || combined.includes(' KIM ') || combined.endsWith(' KIM')) {
      return m;
    }
  }

  // Fallback pencarian lebih longgar jika belum ketemu
  for (let i = 0; i < masterRows.length; i++) {
    const m = masterRows[i];
    const combined = [m.Cabang, m['Sandi Cabang'], m.Sandi, m['Nama Outlet']]
      .filter(Boolean)
      .join(' ')
      .toUpperCase();
    if (combined.includes('KIM')) {
      return m;
    }
  }

  return null;
}

/**
 * Membangun indeks pencarian master O(1) berdasarkan Kelurahan, Kecamatan, Kode Pos, Dati II, dan Provinsi
 */
export function buildMasterProximityIndex(masterRows: MasterRow[]): MasterProximityIndex {
  const byKelurahan = new Map<string, MasterRow[]>();
  const byKecamatan = new Map<string, MasterRow[]>();
  const byPostal3 = new Map<string, MasterRow[]>();
  const byPostal2 = new Map<string, MasterRow[]>();
  const byDati = new Map<string, MasterRow[]>();
  const byProv = new Map<string, MasterRow[]>();

  let kimBranch: MasterRow | null = null;

  for (let i = 0; i < masterRows.length; i++) {
    const m = masterRows[i];

    // Deteksi cabang KIM
    if (!kimBranch) {
      const combined = [m.Cabang, m['Sandi Cabang'], m.Sandi, m['Nama Outlet']]
        .filter(Boolean)
        .join(' ')
        .toUpperCase();
      if (/\bKIM\b/.test(combined) || combined.includes('KIM')) {
        kimBranch = m;
      }
    }

    // Indeks Kelurahan
    const kel = cleanText(m.Kelurahan);
    if (kel) {
      let arr = byKelurahan.get(kel);
      if (!arr) {
        arr = [];
        byKelurahan.set(kel, arr);
      }
      if (arr.length < 30) arr.push(m);
    }

    // Indeks Kecamatan
    const kec = cleanText(m.Kecamatan);
    if (kec) {
      let arr = byKecamatan.get(kec);
      if (!arr) {
        arr = [];
        byKecamatan.set(kec, arr);
      }
      if (arr.length < 30) arr.push(m);
    }

    // Indeks Kode Pos
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

    // Indeks Dati II
    const dati = cleanText(m['Dati II']);
    if (dati) {
      let arrD = byDati.get(dati);
      if (!arrD) {
        arrD = [];
        byDati.set(dati, arrD);
      }
      if (arrD.length < 30) arrD.push(m);
    }

    // Indeks Provinsi
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

  return {
    byKelurahan,
    byKecamatan,
    byPostal3,
    byPostal2,
    byDati,
    byProv,
    kimBranch,
    all: masterRows,
  };
}

/**
 * Evaluasi dan berikan skor kedekatan antara target dan cabang master
 * Dengan proteksi ketat batas Kota/Kabupaten (Dati II) & Provinsi
 */
function evaluateMasterCandidate(
  target: TargetRow,
  m: MasterRow
): { score: number; distance: number; reason: string } {
  const targetKpNum = parseInt(normalizeKodePos(target['KODE POS']), 10);
  const masterKpNum = parseInt(normalizeKodePos(m['KODE POS']), 10);
  const postalDiff = !isNaN(targetKpNum) && !isNaN(masterKpNum) ? Math.abs(targetKpNum - masterKpNum) : 9999;

  const targetKpStr = normalizeKodePos(target['KODE POS']);
  const masterKpStr = normalizeKodePos(m['KODE POS']);
  const postal3Match = targetKpStr.length >= 3 && masterKpStr.length >= 3 && targetKpStr.substring(0, 3) === masterKpStr.substring(0, 3);
  const postal2Match = targetKpStr.length >= 2 && masterKpStr.length >= 2 && targetKpStr.substring(0, 2) === masterKpStr.substring(0, 2);

  const targetKel = cleanText(target.Kelurahan);
  const masterKel = cleanText(m.Kelurahan);
  const kelSim = textSimilarityScore(targetKel, masterKel);
  const kelMatch = kelSim > 0.75;

  const targetKec = cleanText(target.Kecamatan);
  const masterKec = cleanText(m.Kecamatan);
  const kecSim = textSimilarityScore(targetKec, masterKec);
  const kecMatch = kecSim > 0.75;

  const targetDati = cleanText(target['Dati II']);
  const masterDati = cleanText(m['Dati II']);
  const datiSim = textSimilarityScore(targetDati, masterDati);
  const datiMatch = datiSim > 0.75;

  const targetProv = cleanText(target.Provinsi);
  const masterProv = cleanText(m.Provinsi);
  const provSim = textSimilarityScore(targetProv, masterProv);
  const provMatch = provSim > 0.75;

  const addrSim = textSimilarityScore(cleanText(target.ALAMAT), cleanText(m.ALAMAT));

  let score = 50;
  let reason = '';
  let distance = postalDiff;

  if (datiMatch) {
    score = 72;
    distance = postalDiff * 2 - (addrSim * 10);
    if (postal3Match) {
      score += 4;
      distance -= 100;
    } else if (postal2Match) {
      score += 2;
      distance -= 50;
    }

    if (postalDiff <= 3) score += 3;
    else if (postalDiff <= 10) score += 2;

    if (kecMatch) {
      score += 12;
      distance -= 400;
      if (kelMatch) {
        score += 8;
        distance -= 600;
        reason = `Satu Kelurahan (${m.Kelurahan}) • ${m['Dati II']}`;
      } else {
        reason = `Satu Kecamatan (${m.Kecamatan}) • ${m['Dati II']}`;
      }
    } else {
      if (postal3Match) {
        reason = `Satu Zona Pos (${m['KODE POS']}) • ${m['Dati II']}`;
      } else {
        reason = `Kota/Kabupaten Sama (${m['Dati II']}) • Radius Terdekat`;
      }
    }
  } else if (provMatch) {
    score = 58;
    distance = postalDiff * 2 + 5000;
    if (postal2Match) {
      score += 4;
      distance -= 100;
    }
    if (kecMatch) {
      score += 10;
      reason = `Satu Kecamatan (${m.Kecamatan}) • Beda Kota (${m['Dati II']})`;
    } else {
      reason = `Satu Provinsi (${m.Provinsi || target.Provinsi}) • Alternatif Terdekat`;
    }
  } else {
    // Berbeda Provinsi - dikenakan penalti berat untuk proteksi batas wilayah
    score = 40;
    distance = postalDiff * 2 + 50000;
    reason = `Wilayah Sekitar (${m['Dati II'] || m.Provinsi || 'Regional'})`;
  }

  score = Math.min(Math.max(score, 30), 98);
  return { score, distance, reason };
}

/**
 * Temukan 2 hingga 3 cabang terdekat murni dari Data Master real dengan proteksi wilayah ketat
 */
export function findClosestMasterRecommendation(
  target: TargetRow,
  index: MasterProximityIndex
): RecommendationResult | null {
  if (!index.all || index.all.length === 0) return null;

  // =========================================================================
  // ATURAN KHUSUS: PROVINSI ACEH OTOMATIS AMBIL CABANG KIM
  // =========================================================================
  if (isAcehRegion(target)) {
    const kimBranch = index.kimBranch || findKimBranch(index.all);
    if (kimBranch) {
      const kimDist = calculateRealDistance(target, kimBranch);
      const candidates: CandidateOption[] = [
        {
          master: kimBranch,
          score: 99,
          reason: 'Khusus Provinsi Aceh otomatis dilayani Cabang KIM',
          rank: 1,
          distanceKm: kimDist.distanceKm,
          formattedDistance: kimDist.formattedDistance,
          distanceBasis: kimDist.basis,
          googleMapsUrl: kimDist.googleMapsUrl,
        },
      ];

      // Cari cabang alternatif di Sumatera Utara / Aceh jika ada
      const sumutBranches = index.byProv.get('sumatera utara') || index.byProv.get('sumut') || [];
      let rankCounter = 2;
      for (const alt of sumutBranches) {
        if (rankCounter > 3) break;
        if (alt['Branch Code'] !== kimBranch['Branch Code']) {
          const altDist = calculateRealDistance(target, alt);
          candidates.push({
            master: alt,
            score: 75,
            reason: `Alternatif Regional (${alt['Dati II'] || alt.Cabang})`,
            rank: rankCounter++,
            distanceKm: altDist.distanceKm,
            formattedDistance: altDist.formattedDistance,
            distanceBasis: altDist.basis,
            googleMapsUrl: altDist.googleMapsUrl,
          });
        }
      }

      return {
        targetRow: target,
        recommendedMaster: kimBranch,
        score: 99,
        reason: candidates[0].reason,
        candidates,
        distanceKm: candidates[0].distanceKm,
        formattedDistance: candidates[0].formattedDistance,
        googleMapsUrl: candidates[0].googleMapsUrl,
      };
    }
  }

  const targetDati = cleanText(target['Dati II']);
  const targetProv = cleanText(target.Provinsi);

  // Kumpulkan kandidat real dari master
  const rawPool: MasterRow[] = [];

  // Prioritas 1: Cabang di Dati II / Kota yang sama
  if (targetDati && index.byDati.has(targetDati)) {
    const list = index.byDati.get(targetDati) || [];
    rawPool.push(...list);
  }

  // Prioritas 2: Jika cabang di Dati II kurang dari 3, tambahkan dari Provinsi yang sama
  if (rawPool.length < 5 && targetProv && index.byProv.has(targetProv)) {
    const provList = index.byProv.get(targetProv) || [];
    rawPool.push(...provList);
  }

  // Prioritas 3: Fallback hanya jika di provinsi pun tidak ada
  if (rawPool.length === 0) {
    rawPool.push(...index.all);
  }

  // Deduplikasi cabang unik berdasarkan Branch Code / Sandi / Nama Outlet + Alamat
  const uniqueMap = new Map<string, MasterRow>();
  for (const m of rawPool) {
    const key = `${m['Branch Code'] || m['Kode Cabang'] || ''}_${m['Nama Outlet'] || m.Cabang || ''}_${m['KODE POS'] || ''}_${cleanText(m.ALAMAT).slice(0, 20)}`.toUpperCase().trim();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, m);
    }
  }

  // Nilai seluruh kandidat real
  const scored = Array.from(uniqueMap.values()).map((m) => {
    const ev = evaluateMasterCandidate(target, m);
    return {
      master: m,
      score: ev.score,
      distance: ev.distance,
      reason: ev.reason,
    };
  });

  // Urutkan berdasarkan skor tertinggi (lalu jarak terpendek)
  scored.sort((a, b) => b.score - a.score || a.distance - b.distance);

  // Ambil hingga 3 kandidat terbaik
  const topList = scored.slice(0, 3);
  if (topList.length === 0) return null;

  const candidates: CandidateOption[] = topList.map((item, idx) => {
    const distInfo = calculateRealDistance(target, item.master);
    return {
      master: item.master,
      score: item.score,
      reason: item.reason,
      rank: idx + 1,
      distanceKm: distInfo.distanceKm,
      formattedDistance: distInfo.formattedDistance,
      distanceBasis: distInfo.basis,
      googleMapsUrl: distInfo.googleMapsUrl,
    };
  });

  return {
    targetRow: target,
    recommendedMaster: candidates[0].master,
    score: candidates[0].score,
    reason: candidates[0].reason,
    candidates,
    distanceKm: candidates[0].distanceKm,
    formattedDistance: candidates[0].formattedDistance,
    googleMapsUrl: candidates[0].googleMapsUrl,
  };
}

/**
 * Fast location memo key to avoid redundant evaluations
 */
function getTargetLocationKey(target: TargetRow): string {
  return `${target.Wilayah || ''}|${normalizeKodePos(target['KODE POS'])}|${cleanText(target.Kecamatan)}|${cleanText(target.Kelurahan)}|${cleanText(target['Dati II'])}|${cleanText(target.ALAMAT).slice(0, 35)}`;
}

/**
 * Generate recommendations for unmatched Target rows using the step-by-step proximity rule.
 */
export function generateRecommendationsForUnmatched(
  unmatchedRows: TargetRow[],
  masterRows: MasterRow[],
  prebuiltIndex?: MasterProximityIndex
): RecommendationResult[] {
  if (unmatchedRows.length === 0 || masterRows.length === 0) return [];

  const index = prebuiltIndex || buildMasterProximityIndex(masterRows);
  const results: RecommendationResult[] = [];
  const locationMemo = new Map<string, RecommendationResult | null>();

  for (let i = 0; i < unmatchedRows.length; i++) {
    const row = unmatchedRows[i];
    const locKey = getTargetLocationKey(row);

    if (locationMemo.has(locKey)) {
      const cached = locationMemo.get(locKey);
      if (cached) {
        results.push({
          ...cached,
          targetRow: row,
        });
      }
      continue;
    }

    const rec = findClosestMasterRecommendation(row, index);
    if (rec) {
      locationMemo.set(locKey, rec);
      results.push(rec);
    } else {
      locationMemo.set(locKey, null);
    }
  }

  return results;
}

/**
 * Non-blocking progressive recommendation calculation with initial fast batch (< 15ms)
 * and chunked background evaluation for smooth 60 FPS responsiveness.
 */
export function generateRecommendationsProgressive(
  unmatchedRows: TargetRow[],
  masterRows: MasterRow[],
  index: MasterProximityIndex,
  onBatch: (batch: RecommendationResult[], isDone: boolean, totalProcessed: number) => void,
  initialBatchSize = 25,
  chunkSize = 100
): () => void {
  let isCancelled = false;

  if (unmatchedRows.length === 0 || masterRows.length === 0) {
    onBatch([], true, 0);
    return () => {};
  }

  const locationMemo = new Map<string, RecommendationResult | null>();
  const allResults: RecommendationResult[] = [];

  const processRow = (row: TargetRow): RecommendationResult | null => {
    const locKey = getTargetLocationKey(row);
    if (locationMemo.has(locKey)) {
      const cached = locationMemo.get(locKey);
      if (cached) {
        return {
          ...cached,
          targetRow: row,
        };
      }
      return null;
    }

    const rec = findClosestMasterRecommendation(row, index);
    if (rec) {
      locationMemo.set(locKey, rec);
      return rec;
    } else {
      locationMemo.set(locKey, null);
      return null;
    }
  };

  // STEP 1: Process initial fast batch synchronously (< 15ms)
  const firstBatchCount = Math.min(initialBatchSize, unmatchedRows.length);
  for (let i = 0; i < firstBatchCount; i++) {
    const res = processRow(unmatchedRows[i]);
    if (res) allResults.push(res);
  }

  const isCompleteImmediately = firstBatchCount >= unmatchedRows.length;
  onBatch([...allResults], isCompleteImmediately, firstBatchCount);

  if (isCompleteImmediately) {
    return () => {};
  }

  // STEP 2: Process remaining items in chunks asynchronously
  let currentIndex = firstBatchCount;

  const processNextChunk = () => {
    if (isCancelled) return;

    const chunkEnd = Math.min(currentIndex + chunkSize, unmatchedRows.length);
    for (let i = currentIndex; i < chunkEnd; i++) {
      const res = processRow(unmatchedRows[i]);
      if (res) allResults.push(res);
    }

    currentIndex = chunkEnd;
    const isDone = currentIndex >= unmatchedRows.length;
    onBatch([...allResults], isDone, currentIndex);

    if (!isDone && !isCancelled) {
      setTimeout(processNextChunk, 0);
    }
  };

  const timerId = setTimeout(processNextChunk, 0);

  return () => {
    isCancelled = true;
    clearTimeout(timerId);
  };
}
