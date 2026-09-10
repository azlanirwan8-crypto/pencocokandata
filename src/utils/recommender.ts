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
 * Berdasarkan selisih numerik kode pos dan kesamaan teks alamat
 */
function calculateLocalProximityDistance(target: TargetRow, master: MasterRow): number {
  const targetKpNum = parseInt(normalizeKodePos(target['KODE POS']), 10);
  const masterKpNum = parseInt(normalizeKodePos(master['KODE POS']), 10);

  let postalDiff = 99999;
  if (!isNaN(targetKpNum) && !isNaN(masterKpNum)) {
    postalDiff = Math.abs(targetKpNum - masterKpNum);
  }

  const targetAlamat = cleanText(target.ALAMAT);
  const masterAlamat = cleanText(master.ALAMAT);
  const targetKel = cleanText(target.Kelurahan);
  const masterKel = cleanText(master.Kelurahan);

  const addressSim = textSimilarityScore(targetAlamat, masterAlamat);
  const kelSim = textSimilarityScore(targetKel, masterKel);

  // Semakin kecil jarak, semakin dekat
  return postalDiff * 2 - (addressSim * 10) - (kelSim * 15);
}

/**
 * Temukan cabang terdekat berdasarkan hierarki aturan:
 * 1. Khusus Provinsi Aceh: Otomatis Cabang KIM (Skor 99%)
 * 2. Pengecekan 1: Apakah di kelurahan yang sama ada? Jika > 1 ambil terdekat. (Skor 95% - 98%)
 * 3. Pengecekan 2: Jika tidak ada, cari kelurahan terdekat. (Skor 85% - 94%)
 * 4. Pengecekan 3: Cek kecamatan. Jika di kecamatan ada 2 atau lebih, ambil yang terdekat dengan lokasi. (Skor 75% - 84%)
 * 5. Pengecekan 4: Cek kota/kabupaten terdekat. (Skor 60% - 74%)
 * 6. Fallback: Provinsi sekitar. (Skor 50% - 59%)
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

  const targetKel = cleanText(target.Kelurahan);
  const targetKec = cleanText(target.Kecamatan);
  const targetDati = cleanText(target['Dati II']);
  const targetProv = cleanText(target.Provinsi);
  const targetKp = normalizeKodePos(target['KODE POS']);

  // =========================================================================
  // TAHAP 1: PENGECEKAN KELURAHAN YANG SAMA
  // =========================================================================
  if (targetKel) {
    const sameKelList = index.byKelurahan.get(targetKel) || [];
    if (sameKelList.length > 0) {
      // Jika ada lebih dari 1 cabang di kelurahan yang sama, ambil yang terdekat dengan lokasi
      let best = sameKelList[0];
      let minDistance = calculateLocalProximityDistance(target, best);

      for (let i = 1; i < sameKelList.length; i++) {
        const dist = calculateLocalProximityDistance(target, sameKelList[i]);
        if (dist < minDistance) {
          minDistance = dist;
          best = sameKelList[i];
        }
      }

      const masterKp = normalizeKodePos(best['KODE POS']);
      const isExactPostal = targetKp && masterKp && targetKp === masterKp;

      return {
        targetRow: target,
        recommendedMaster: best,
        score: isExactPostal ? 98 : 96,
        reason: `Kelurahan Sama (${best.Kelurahan || target.Kelurahan}) • ${isExactPostal ? 'Kode Pos Identik' : 'Cabang Terdekat di Kelurahan'}`,
      };
    }
  }

  // =========================================================================
  // TAHAP 2: KELURAHAN TERDEKAT (RADIUS KODE POS SAMA / KECAMATAN SEKITAR)
  // =========================================================================
  if (targetKp.length >= 3) {
    const p3 = targetKp.slice(0, 3);
    const nearbyPostalList = index.byPostal3.get(p3) || [];
    if (nearbyPostalList.length > 0) {
      // Urutkan dan pilih kelurahan terdekat berdasarkan selisih kode pos & alamat
      let best = nearbyPostalList[0];
      let minDistance = calculateLocalProximityDistance(target, best);

      for (let i = 1; i < nearbyPostalList.length; i++) {
        const dist = calculateLocalProximityDistance(target, nearbyPostalList[i]);
        if (dist < minDistance) {
          minDistance = dist;
          best = nearbyPostalList[i];
        }
      }

      const masterKp = normalizeKodePos(best['KODE POS']);
      const kpDiff = Math.abs(parseInt(targetKp, 10) - parseInt(masterKp, 10));
      const score = Math.max(86, Math.min(94, 94 - Math.min(kpDiff, 8)));

      return {
        targetRow: target,
        recommendedMaster: best,
        score,
        reason: `Kelurahan Terdekat (${best.Kelurahan || best.Kecamatan}) • Area Pos ${masterKp.slice(0, 3)}xx`,
      };
    }
  }

  // =========================================================================
  // TAHAP 3: CEK KECAMATAN-NYA (JIKA ADA 2+ AMBIL YANG TERDEKAT DENGAN LOKASI)
  // =========================================================================
  if (targetKec) {
    const sameKecList = index.byKecamatan.get(targetKec) || [];
    if (sameKecList.length > 0) {
      // "jika di kecamatan itu ada 2 maka ambil yang terdekat dengan lokasi nya"
      let best = sameKecList[0];
      let minDistance = calculateLocalProximityDistance(target, best);

      for (let i = 1; i < sameKecList.length; i++) {
        const dist = calculateLocalProximityDistance(target, sameKecList[i]);
        if (dist < minDistance) {
          minDistance = dist;
          best = sameKecList[i];
        }
      }

      const branchCountInfo = sameKecList.length > 1 ? `Dipilih Terdekat dari ${sameKecList.length} Cabang` : 'Cabang Utama Kecamatan';

      return {
        targetRow: target,
        recommendedMaster: best,
        score: 82,
        reason: `Kecamatan Sama (${best.Kecamatan || target.Kecamatan}) • ${branchCountInfo}`,
      };
    }
  }

  // =========================================================================
  // TAHAP 4: CEK KOTA / KABUPATEN (DATI II) TERDEKAT
  // =========================================================================
  if (targetDati) {
    const sameDatiList = index.byDati.get(targetDati) || [];
    if (sameDatiList.length > 0) {
      let best = sameDatiList[0];
      let minDistance = calculateLocalProximityDistance(target, best);

      for (let i = 1; i < sameDatiList.length; i++) {
        const dist = calculateLocalProximityDistance(target, sameDatiList[i]);
        if (dist < minDistance) {
          minDistance = dist;
          best = sameDatiList[i];
        }
      }

      return {
        targetRow: target,
        recommendedMaster: best,
        score: 72,
        reason: `Kota/Kabupaten Sama (${best['Dati II'] || target['Dati II']}) • Cabang Terdekat di Kota`,
      };
    }
  }

  // =========================================================================
  // TAHAP 5: FALLBACK PROVINSI / REGIONAL
  // =========================================================================
  if (targetProv) {
    const sameProvList = index.byProv.get(targetProv) || [];
    if (sameProvList.length > 0) {
      let best = sameProvList[0];
      let minDistance = calculateLocalProximityDistance(target, best);

      for (let i = 1; i < sameProvList.length; i++) {
        const dist = calculateLocalProximityDistance(target, sameProvList[i]);
        if (dist < minDistance) {
          minDistance = dist;
          best = sameProvList[i];
        }
      }

      return {
        targetRow: target,
        recommendedMaster: best,
        score: 58,
        reason: `Satu Provinsi (${best.Provinsi || target.Provinsi}) • Alternatif Terdekat`,
      };
    }
  }

  // Fallback terakhir jika semua tidak cocok
  const fallback = index.all[0];
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
