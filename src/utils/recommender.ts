import type { TargetRow, MasterRow } from '../types';
import { normalizeKodePos, cleanText, textSimilarityScore } from './normalizer';

export interface RecommendationResult {
  targetRow: TargetRow;
  recommendedMaster: MasterRow;
  score: number; // 0 - 100
  reason: string;
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
 * Hitung jarak kedekatan lokal antara target dan cabang master
 * Berdasarkan selisih numerik kode pos dan kesamaan teks (Kecamatan, Kelurahan, Alamat)
 */
function calculateLocalProximityDistance(target: TargetRow, master: MasterRow): number {
  const targetKpNum = parseInt(normalizeKodePos(target['KODE POS']), 10);
  const masterKpNum = parseInt(normalizeKodePos(master['KODE POS']), 10);

  let postalDiff = 99999;
  if (!isNaN(targetKpNum) && !isNaN(masterKpNum)) {
    postalDiff = Math.abs(targetKpNum - masterKpNum);
  }

  const addressSim = textSimilarityScore(cleanText(target.ALAMAT), cleanText(master.ALAMAT));
  const kelSim = textSimilarityScore(cleanText(target.Kelurahan), cleanText(master.Kelurahan));
  const kecSim = textSimilarityScore(cleanText(target.Kecamatan), cleanText(master.Kecamatan));
  const datiSim = textSimilarityScore(cleanText(target['Dati II']), cleanText(master['Dati II']));
  const provSim = textSimilarityScore(cleanText(target.Provinsi), cleanText(master.Provinsi));

  // Semakin kecil jarak, semakin dekat
  // Penalti besar jika Dati II / Provinsi berbeda untuk mencegah salah wilayah
  const provPenalty = provSim < 0.8 ? 100000 : 0;
  const datiPenalty = datiSim < 0.8 ? 10000 : 0;

  return postalDiff * 2 - (addressSim * 10) - (kelSim * 500) - (kecSim * 300) + provPenalty + datiPenalty;
}

/**
 * Temukan cabang terdekat berdasarkan hierarki aturan:
 * 1. Khusus Provinsi Aceh: Otomatis Cabang KIM
 * 2. Pengecekan 1: Dati II Sama (Di dalam Dati II yang sama, cari Kelurahan/Kecamatan/Kode Pos terdekat)
 * 3. Pengecekan 2: Provinsi Sama (Jika Dati II tidak ada di master)
 * 4. Fallback: Cabang terdekat secara global
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
      return {
        targetRow: target,
        recommendedMaster: kimBranch,
        score: 99,
        reason: 'Khusus Provinsi Aceh otomatis dilayani Cabang KIM',
      };
    }
  }

  const targetDati = cleanText(target['Dati II']);
  const targetProv = cleanText(target.Provinsi);
  const targetKel = cleanText(target.Kelurahan);
  
  // Fungsi pembantu untuk mencari yang terbaik dari daftar kandidat
  const findBestInList = (list: MasterRow[]) => {
    let best = list[0];
    let minDistance = calculateLocalProximityDistance(target, best);
    for (let i = 1; i < list.length; i++) {
      const dist = calculateLocalProximityDistance(target, list[i]);
      if (dist < minDistance) {
        minDistance = dist;
        best = list[i];
      }
    }
    return best;
  };

  // =========================================================================
  // TAHAP 1: CARI DI DATI II YANG SAMA SEBAGAI PRIORITAS UTAMA
  // =========================================================================
  if (targetDati) {
    const sameDatiList = index.byDati.get(targetDati) || [];
    if (sameDatiList.length > 0) {
      const best = findBestInList(sameDatiList);
      
      const kelMatch = textSimilarityScore(targetKel, cleanText(best.Kelurahan)) > 0.8;
      const kecMatch = textSimilarityScore(cleanText(target.Kecamatan), cleanText(best.Kecamatan)) > 0.8;
      
      let reason = `Kota/Kabupaten Sama (${best['Dati II']})`;
      let score = 72;
      
      if (kelMatch) {
        reason = `Kelurahan Sama (${best.Kelurahan}) • ${reason}`;
        score = 96;
      } else if (kecMatch) {
        reason = `Kecamatan Sama (${best.Kecamatan}) • ${reason}`;
        score = 82;
      } else {
        reason = `Cabang Terdekat di ${reason}`;
      }

      return { targetRow: target, recommendedMaster: best, score, reason };
    }
  }

  // =========================================================================
  // TAHAP 2: CARI DI PROVINSI YANG SAMA
  // =========================================================================
  if (targetProv) {
    const sameProvList = index.byProv.get(targetProv) || [];
    if (sameProvList.length > 0) {
      const best = findBestInList(sameProvList);
      return {
        targetRow: target,
        recommendedMaster: best,
        score: 58,
        reason: `Satu Provinsi (${best.Provinsi || target.Provinsi}) • Alternatif Terdekat`,
      };
    }
  }

  // =========================================================================
  // TAHAP 3: FALLBACK GLOBAL (Sangat jarang terjadi kecuali data master kosong)
  // =========================================================================
  const fallback = findBestInList(index.all);
  return {
    targetRow: target,
    recommendedMaster: fallback,
    score: 50,
    reason: 'Cabang Regional Terdekat',
  };
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

  for (let i = 0; i < unmatchedRows.length; i++) {
    const row = unmatchedRows[i];
    const rec = findClosestMasterRecommendation(row, index);
    if (rec) {
      results.push(rec);
    }
  }

  return results;
}
