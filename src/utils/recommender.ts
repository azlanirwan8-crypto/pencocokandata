import type { TargetRow, MasterRow } from '../types';
import {
  normalizeKodePos,
  cleanText,
  cleanDati,
  cleanKecamatan,
  cleanKelurahan,
  cleanProvinsi,
  textSimilarityScore,
  hasDirectionalConflict,
  stripAdminNoise,
  normalizeNumerals,
  findSharedStreetOrLandmark,
} from './normalizer.ts';
import { calculateRealDistance } from './geoDistance.ts';

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

export interface UserPrefilledAudit {
  hasPrefilled: boolean;
  prefilledText: string;
  matchedRank: number | null; // 1 (Top 1), 2 (Top 2), 3 (Top 3), > 3, or null (not found)
  matchedCandidate?: CandidateOption;
  status: 'match_top1' | 'match_top2' | 'match_top3' | 'match_other' | 'not_found';
  message: string;
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
  userPrefilledAudit?: UserPrefilledAudit;
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

    // Indeks Kelurahan (Simpan varian nama bersih, nama murni tanpa stopword, nama asli, varian tanpa spasi, dan angka)
    const rawKel = cleanText(m.Kelurahan);
    const normKel = cleanKelurahan(m.Kelurahan);
    const coreKel = stripAdminNoise(m.Kelurahan);
    const noSpaceKel = normKel ? normKel.replace(/\s+/g, '') : '';
    const numKel = normKel ? normalizeNumerals(normKel) : '';
    const numNoSpaceKel = numKel ? numKel.replace(/\s+/g, '') : '';
    [normKel, coreKel, rawKel, noSpaceKel, numKel, numNoSpaceKel].filter(Boolean).forEach((k) => {
      let arr = byKelurahan.get(k);
      if (!arr) {
        arr = [];
        byKelurahan.set(k, arr);
      }
      if (arr.length < 30 && !arr.includes(m)) arr.push(m);
    });

    // Indeks Kecamatan (Simpan varian nama bersih, nama murni tanpa stopword, nama asli, varian tanpa spasi, dan angka)
    const rawKec = cleanText(m.Kecamatan);
    const normKec = cleanKecamatan(m.Kecamatan);
    const coreKec = stripAdminNoise(m.Kecamatan);
    const noSpaceKec = normKec ? normKec.replace(/\s+/g, '') : '';
    const numKec = normKec ? normalizeNumerals(normKec) : '';
    const numNoSpaceKec = numKec ? numKec.replace(/\s+/g, '') : '';
    [normKec, coreKec, rawKec, noSpaceKec, numKec, numNoSpaceKec].filter(Boolean).forEach((k) => {
      let arr = byKecamatan.get(k);
      if (!arr) {
        arr = [];
        byKecamatan.set(k, arr);
      }
      if (arr.length < 30 && !arr.includes(m)) arr.push(m);
    });

    // Indeks Kode Pos
    const kp = normalizeKodePos(m['KODE POS']);
    if (kp.length >= 3) {
      const p3 = kp.slice(0, 3);
      let arr3 = byPostal3.get(p3);
      if (!arr3) {
        arr3 = [];
        byPostal3.set(p3, arr3);
      }
      if (arr3.length < 30 && !arr3.includes(m)) arr3.push(m);

      const p2 = kp.slice(0, 2);
      let arr2 = byPostal2.get(p2);
      if (!arr2) {
        arr2 = [];
        byPostal2.set(p2, arr2);
      }
      if (arr2.length < 30 && !arr2.includes(m)) arr2.push(m);
    }

    // Indeks Dati II (Simpan varian nama bersih tanpa prefix 'kabupaten'/'kota', nama murni, nama asli, dan varian tanpa spasi)
    const rawDati = cleanText(m['Dati II']);
    const normDati = cleanDati(m['Dati II']);
    const coreDati = stripAdminNoise(m['Dati II']);
    const noSpaceDati = normDati ? normDati.replace(/\s+/g, '') : '';
    [normDati, coreDati, rawDati, noSpaceDati].filter(Boolean).forEach((d) => {
      let arrD = byDati.get(d);
      if (!arrD) {
        arrD = [];
        byDati.set(d, arrD);
      }
      if (arrD.length < 50 && !arrD.includes(m)) arrD.push(m);
    });

    // Indeks Provinsi
    const rawProv = cleanText(m.Provinsi);
    const normProv = cleanProvinsi(m.Provinsi);
    [normProv, rawProv].filter(Boolean).forEach((p) => {
      let arrP = byProv.get(p);
      if (!arrP) {
        arrP = [];
        byProv.set(p, arrP);
      }
      if (arrP.length < 50 && !arrP.includes(m)) arrP.push(m);
    });
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

  const targetKel = cleanKelurahan(target.Kelurahan);
  const masterKel = cleanKelurahan(m.Kelurahan);
  const kelSim = textSimilarityScore(target.Kelurahan || '', m.Kelurahan || '');
  const rawKelMatch = !hasDirectionalConflict(target.Kelurahan || '', m.Kelurahan || '') &&
    (kelSim > 0.75 || (targetKel && masterKel && (targetKel === masterKel || targetKel.replace(/\s+/g, '') === masterKel.replace(/\s+/g, ''))));

  const targetKec = cleanKecamatan(target.Kecamatan);
  const masterKec = cleanKecamatan(m.Kecamatan);
  const kecSim = textSimilarityScore(target.Kecamatan || '', m.Kecamatan || '');
  const rawKecMatch = !hasDirectionalConflict(target.Kecamatan || '', m.Kecamatan || '') &&
    (kecSim > 0.75 || (targetKec && masterKec && (targetKec === masterKec || targetKec.replace(/\s+/g, '') === masterKec.replace(/\s+/g, ''))));

  // Normalisasi Dati II: "KABUPATEN BONDOWOSO" vs "BONDOWOSO" diakui sama persis (100% Match)
  // Diproteksi agar arah (utara/selatan/barat/timur) tidak saling tertukar
  const targetDati = cleanDati(target['Dati II']);
  const masterDati = cleanDati(m['Dati II']);
  const datiSim = textSimilarityScore(target['Dati II'] || '', m['Dati II'] || '');
  const datiMatch = !hasDirectionalConflict(target['Dati II'] || '', m['Dati II'] || '') &&
    (datiSim > 0.75 || (targetDati && masterDati && (targetDati === masterDati || targetDati.replace(/\s+/g, '') === masterDati.replace(/\s+/g, ''))));

  const targetProv = cleanProvinsi(target.Provinsi);
  const masterProv = cleanProvinsi(m.Provinsi);
  const provSim = textSimilarityScore(target.Provinsi || '', m.Provinsi || '');
  const provMatch = provSim > 0.75 || (targetProv && masterProv && (targetProv === masterProv || targetProv.replace(/\s+/g, '') === masterProv.replace(/\s+/g, '')));

  // Proteksi mutlak hierarki administratif Indonesia:
  // 1. Jika terbukti berbeda Provinsi, kelurahan/kecamatan sama adalah homonim/kebetulan nama sama!
  const isDiffProv = Boolean(
    targetProv && masterProv && 
    targetProv !== masterProv && 
    !provMatch && 
    textSimilarityScore(target.Provinsi || '', m.Provinsi || '') < 0.6
  );

  // 2. Jika terbukti berbeda Dati II:
  const isDiffDati = Boolean(
    targetDati && masterDati && 
    targetDati !== masterDati && 
    !datiMatch && 
    textSimilarityScore(target['Dati II'] || '', m['Dati II'] || '') < 0.6
  );

  // Kelurahan & Kecamatan HANYA valid jika tidak berkonflik provinsi atau Dati II
  const kelMatch = isDiffProv || (isDiffDati && !provMatch) ? false : rawKelMatch;
  const kecMatch = isDiffProv || (isDiffDati && !provMatch) ? false : rawKecMatch;

  // Analisis Alamat Layaknya Auditor Manusia:
  const targetAddrClean = cleanText(target.ALAMAT);
  const targetHasKel = Boolean(targetKel && targetKel !== '-' && targetKel.length >= 2);
  const targetHasKec = Boolean(targetKec && targetKec !== '-' && targetKec.length >= 2);

  // Jika kolom target Kelurahan kosong, deteksi apakah ada tertulis di Alamat:
  const masterKelCore = stripAdminNoise(m.Kelurahan);
  const kelInAddr = !targetHasKel && Boolean(
    targetAddrClean && masterKelCore && masterKelCore.length >= 4 &&
    targetAddrClean.includes(masterKelCore)
  );

  // Jika kolom target Kecamatan kosong, deteksi apakah ada tertulis di Alamat:
  const masterKecCore = stripAdminNoise(m.Kecamatan);
  const kecInAddr = !targetHasKec && Boolean(
    targetAddrClean && masterKecCore && masterKecCore.length >= 4 &&
    targetAddrClean.includes(masterKecCore)
  );

  // Deteksi kecocokan koridor nama jalan / gedung / landmark utama
  const streetMatch = findSharedStreetOrLandmark(target.ALAMAT || '', m.ALAMAT || '');
  const addrSim = textSimilarityScore(cleanText(target.ALAMAT), cleanText(m.ALAMAT));

  let score = 50;
  let reason = '';
  let distance = postalDiff;

  if (datiMatch) {
    // Cabang berada di Dati II (Kabupaten/Kota) yang sama
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

    // Bonus keselarasan entitas (Kota vs Kab) untuk tie-breaker (misal target "Kota Bogor" vs "Kabupaten Bogor")
    const targetIsKota = /\bkota\b/i.test(target['Dati II'] || '');
    const masterIsKota = /\bkota\b/i.test(m['Dati II'] || '');
    const targetIsKab = /\b(kabupaten|kab)\b/i.test(target['Dati II'] || '');
    const masterIsKab = /\b(kabupaten|kab)\b/i.test(m['Dati II'] || '');
    if ((targetIsKota && masterIsKota) || (targetIsKab && masterIsKab)) {
      score += 1;
      distance -= 10;
    }

    // Pengecekan Koridor Jalan Utama
    if (streetMatch.isMatch) {
      score += 12;
      distance -= 1500;
    }

    // Pengecekan Kelurahan & Kecamatan di Dati II yang sama:
    const effectiveKel = kelMatch || kelInAddr;
    const effectiveKec = kecMatch || kecInAddr;

    const streetPrefix = streetMatch.isMatch ? `Satu Jalur/Jalan (${streetMatch.sharedKeyword}) • ` : '';

    if (effectiveKel && effectiveKec) {
      score += 23; // 95 - 98: Sangat presisi (Satu Dati II, Kecamatan, & Kelurahan)
      distance -= 600;
      const kelLabel = kelInAddr ? `${m.Kelurahan} (dari Alamat)` : (m.Kelurahan || target.Kelurahan);
      const kecLabel = kecInAddr ? `${m.Kecamatan} (dari Alamat)` : (m.Kecamatan || target.Kecamatan);
      reason = `${streetPrefix}Satu Kelurahan (${kelLabel}) & Kecamatan (${kecLabel}) • ${m['Dati II']}`;
    } else if (effectiveKel) {
      score += 18; // 90
      distance -= 550;
      const kelLabel = kelInAddr ? `${m.Kelurahan} (dari Alamat)` : (m.Kelurahan || target.Kelurahan);
      reason = `${streetPrefix}Satu Kelurahan (${kelLabel}) • ${m['Dati II']}`;
    } else if (effectiveKec) {
      score += 13; // 85
      distance -= 400;
      const kecLabel = kecInAddr ? `${m.Kecamatan} (dari Alamat)` : (m.Kecamatan || target.Kecamatan);
      reason = `${streetPrefix}Satu Kecamatan (${kecLabel}) • ${m['Dati II']}`;
    } else if (streetMatch.isMatch) {
      score += 8; // ~84
      reason = `Satu Jalur/Jalan (${streetMatch.sharedKeyword}) • ${m['Dati II']}`;
    } else {
      if (postal3Match) {
        reason = `Satu Zona Pos (${m['KODE POS']}) • ${m['Dati II']}`;
      } else {
        reason = `Kota/Kabupaten Sama (${m['Dati II']}) • Radius Terdekat`;
      }
    }
  } else if (!isDiffProv && (provMatch || !targetProv)) {
    // Satu Provinsi atau Dati II belum match (misal lintas kabupaten/kota terdekat di provinsi yang sama)
    score = 55;
    distance = postalDiff * 2 + 4000;
    if (streetMatch.isMatch) {
      score += 10;
      distance -= 800;
    }
    const streetPrefix = streetMatch.isMatch ? `Satu Jalur/Jalan (${streetMatch.sharedKeyword}) • ` : '';

    if (kelMatch && !isDiffDati) {
      score += 10; // maks 65 (di bawah 72 agar cabang dalam Dati II selalu menang)
      distance -= 500;
      reason = `${streetPrefix}Kelurahan Serupa (${m.Kelurahan || target.Kelurahan}) • ${m['Dati II'] || m.Provinsi}`;
    } else if (kecMatch && !isDiffDati) {
      score += 6; // maks 61
      distance -= 300;
      reason = `${streetPrefix}Kecamatan Serupa (${m.Kecamatan || target.Kecamatan}) • ${m['Dati II'] || m.Provinsi}`;
    } else if (streetMatch.isMatch) {
      reason = `Satu Jalur/Jalan (${streetMatch.sharedKeyword}) • ${m['Dati II'] || m.Provinsi}`;
    } else if (postal2Match) {
      score += 4;
      distance -= 100;
      reason = `Satu Provinsi (${m.Provinsi || target.Provinsi}) • Zona Pos Dekat (${m['KODE POS']})`;
    } else {
      reason = `Satu Provinsi (${m.Provinsi || target.Provinsi}) • Alternatif Terdekat`;
    }
  } else {
    // Berbeda Provinsi - dikenakan penalti berat untuk proteksi batas wilayah
    score = 30;
    distance = postalDiff * 2 + 50000;
    reason = `Wilayah Luar Provinsi (${m['Dati II'] || m.Provinsi || 'Regional'})`;
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

      const userPrefilledAudit = evaluateUserPrefilledAudit(target, candidates);

      return {
        targetRow: target,
        recommendedMaster: kimBranch,
        score: 99,
        reason: candidates[0].reason,
        candidates,
        distanceKm: candidates[0].distanceKm,
        formattedDistance: candidates[0].formattedDistance,
        googleMapsUrl: candidates[0].googleMapsUrl,
        userPrefilledAudit,
      };
    }
  }

  // Normalisasi Kelurahan, Kecamatan, Dati II & Provinsi untuk query indeks
  const targetKel = cleanKelurahan(target.Kelurahan);
  const targetKelCore = stripAdminNoise(target.Kelurahan);
  const targetKelRaw = cleanText(target.Kelurahan);

  const targetKec = cleanKecamatan(target.Kecamatan);
  const targetKecCore = stripAdminNoise(target.Kecamatan);
  const targetKecRaw = cleanText(target.Kecamatan);

  const targetDati = cleanDati(target['Dati II']);
  const targetDatiCore = stripAdminNoise(target['Dati II']);
  const targetDatiRaw = cleanText(target['Dati II']);
  const targetProv = cleanProvinsi(target.Provinsi);
  const targetProvRaw = cleanText(target.Provinsi);

  // Helper proteksi batas wilayah administratif:
  const matchesProvince = (m: MasterRow) => {
    if (!targetProv) return true;
    const mProv = cleanProvinsi(m.Provinsi);
    if (!mProv) return true;
    return mProv === targetProv || (!hasDirectionalConflict(m.Provinsi || '', target.Provinsi || '') && textSimilarityScore(m.Provinsi || '', target.Provinsi || '') >= 0.75);
  };

  const matchesDati = (m: MasterRow) => {
    if (!targetDati) return matchesProvince(m);
    const mDati = cleanDati(m['Dati II']);
    const mDatiCore = stripAdminNoise(m['Dati II']);
    return (
      mDati === targetDati ||
      mDatiCore === targetDatiCore ||
      (!hasDirectionalConflict(m['Dati II'] || '', target['Dati II'] || '') && (
        textSimilarityScore(m['Dati II'] || '', target['Dati II'] || '') >= 0.75 ||
        (mDati.length >= 4 && targetDati.length >= 4 && (mDati.includes(targetDati) || targetDati.includes(mDati)))
      ))
    );
  };

  const targetKelNoSpace = targetKel ? targetKel.replace(/\s+/g, '') : '';
  const targetKelNum = targetKel ? normalizeNumerals(targetKel) : '';
  const targetKelNumNoSpace = targetKelNum ? targetKelNum.replace(/\s+/g, '') : '';

  const targetKecNoSpace = targetKec ? targetKec.replace(/\s+/g, '') : '';
  const targetKecNum = targetKec ? normalizeNumerals(targetKec) : '';
  const targetKecNumNoSpace = targetKecNum ? targetKecNum.replace(/\s+/g, '') : '';

  const targetDatiNoSpace = targetDati ? targetDati.replace(/\s+/g, '') : '';

  // Kumpulkan kandidat real dari master dengan proteksi batas wilayah
  const rawPool: MasterRow[] = [];

  // TIER 1: Cabang di Dati II / Kota yang sama
  const datiPool: MasterRow[] = [];

  // Prioritas 0 (Dalam Dati II): Cabang di KELURAHAN yang SAMA PERSIS / varian spaceless & angka di Dati II target
  [targetKelCore, targetKel, targetKelRaw, targetKelNoSpace, targetKelNum, targetKelNumNoSpace].filter(Boolean).forEach((kel) => {
    if (index.byKelurahan.has(kel)) {
      const list = (index.byKelurahan.get(kel) || []).filter(matchesDati);
      datiPool.push(...list);
    }
  });

  // Prioritas 0.5 (Dalam Dati II): Cabang di KECAMATAN yang SAMA PERSIS / varian spaceless & angka di Dati II target
  [targetKecCore, targetKec, targetKecRaw, targetKecNoSpace, targetKecNum, targetKecNumNoSpace].filter(Boolean).forEach((kec) => {
    if (index.byKecamatan.has(kec)) {
      const list = (index.byKecamatan.get(kec) || []).filter(matchesDati);
      datiPool.push(...list);
    }
  });

  // Prioritas 1: Seluruh cabang lain di Dati II yang sama
  [targetDati, targetDatiCore, targetDatiRaw, targetDatiNoSpace].filter(Boolean).forEach((d) => {
    if (index.byDati.has(d)) {
      datiPool.push(...(index.byDati.get(d) || []));
    }
  });

  // Fallback pencarian Dati II dengan pemindaian menyeluruh jika lookup langsung belum menemukan kandidat
  if (datiPool.length === 0 && targetDati) {
    for (const [key, list] of index.byDati.entries()) {
      const cleanKey = cleanDati(key);
      if (
        cleanKey === targetDati ||
        (!hasDirectionalConflict(key, targetDati) && (
          (cleanKey.length >= 4 && targetDati.length >= 4 && (cleanKey.includes(targetDati) || targetDati.includes(cleanKey))) ||
          textSimilarityScore(key, targetDati) >= 0.8
        ))
      ) {
        datiPool.push(...list);
      }
    }
  }

  if (datiPool.length > 0) {
    // Jika di Dati II target ditemukan cabang, SEMUA kandidat WAJIB dari Dati II ini!
    // Tidak boleh bercampur dengan cabang dari kota/provinsi lain!
    rawPool.push(...datiPool);
  } else {
    // TIER 2: Jika di Dati II target TIDAK ADA cabang sama sekali di Master, cari di Provinsi yang sama
    const provPool: MasterRow[] = [];

    // Cek kelurahan/kecamatan yang berada di provinsi yang sama (termasuk varian spaceless & angka)
    [targetKelCore, targetKel, targetKelRaw, targetKelNoSpace, targetKelNum, targetKelNumNoSpace].filter(Boolean).forEach((kel) => {
      if (index.byKelurahan.has(kel)) {
        const list = (index.byKelurahan.get(kel) || []).filter(matchesProvince);
        provPool.push(...list);
      }
    });

    [targetKecCore, targetKec, targetKecRaw, targetKecNoSpace, targetKecNum, targetKecNumNoSpace].filter(Boolean).forEach((kec) => {
      if (index.byKecamatan.has(kec)) {
        const list = (index.byKecamatan.get(kec) || []).filter(matchesProvince);
        provPool.push(...list);
      }
    });

    if (targetProv && index.byProv.has(targetProv)) {
      provPool.push(...(index.byProv.get(targetProv) || []));
    }
    if (targetProvRaw && targetProvRaw !== targetProv && index.byProv.has(targetProvRaw)) {
      provPool.push(...(index.byProv.get(targetProvRaw) || []));
    }

    if (provPool.length === 0 && targetProv) {
      for (const [pKey, pList] of index.byProv.entries()) {
        const cleanPKey = cleanProvinsi(pKey);
        if (cleanPKey === targetProv || textSimilarityScore(pKey, targetProv) >= 0.8) {
          provPool.push(...pList);
        }
      }
    }

    if (provPool.length > 0) {
      rawPool.push(...provPool);
    } else {
      // TIER 3: Fallback hanya jika di Dati II dan Provinsi target sama sekali tidak ada cabang di Master
      rawPool.push(...index.all);
    }
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

  const userPrefilledAudit = evaluateUserPrefilledAudit(target, candidates, scored);

  return {
    targetRow: target,
    recommendedMaster: candidates[0].master,
    score: candidates[0].score,
    reason: candidates[0].reason,
    candidates,
    distanceKm: candidates[0].distanceKm,
    formattedDistance: candidates[0].formattedDistance,
    googleMapsUrl: candidates[0].googleMapsUrl,
    userPrefilledAudit,
  };
}

/**
 * Evaluasi data cabang yang sudah diisi di Excel oleh user terhadap rekomendasi sistem
 */
export function evaluateUserPrefilledAudit(
  target: TargetRow,
  candidates: CandidateOption[],
  allMasterScored?: { master: MasterRow; score: number; distance: number; reason: string }[]
): UserPrefilledAudit | undefined {
  const prefilledSandi = String(target._originalFilledSandi || target.Sandi || '').trim();
  const prefilledCabang = String(target._originalFilledCabang || target.Cabang || '').trim();
  const prefilledSandiCabang = String(target._originalFilledSandiCabang || target['Sandi Cabang'] || '').trim();
  const prefilledOutlet = String(target._originalFilledNamaOutlet || target['Nama Outlet'] || '').trim();

  // Jika user tidak mengisi atribut master sama sekali
  if (!prefilledSandi && !prefilledCabang && !prefilledSandiCabang && !prefilledOutlet) {
    return undefined;
  }
  if (
    (prefilledSandi === '-' || !prefilledSandi) &&
    (prefilledCabang === '-' || !prefilledCabang) &&
    (prefilledSandiCabang === '-' || !prefilledSandiCabang)
  ) {
    return undefined;
  }

  const prefilledDisplay =
    prefilledSandiCabang ||
    [prefilledSandi, prefilledCabang].filter(Boolean).join(' - ') ||
    prefilledCabang ||
    prefilledSandi ||
    prefilledOutlet;

  const isMatchMaster = (m: MasterRow): boolean => {
    const mSandi = cleanText(String(m.Sandi || ''));
    const mCabang = cleanText(String(m.Cabang || ''));
    const mSandiCabang = cleanText(String(m['Sandi Cabang'] || ''));
    const mOutlet = cleanText(String(m['Nama Outlet'] || ''));
    const mBranchCode = cleanText(String(m['Branch Code'] || m['Kode Cabang'] || ''));

    const uSandi = cleanText(prefilledSandi);
    const uCabang = cleanText(prefilledCabang);
    const uSandiCabang = cleanText(prefilledSandiCabang);
    const uOutlet = cleanText(prefilledOutlet);

    if (uSandi && mSandi && uSandi === mSandi) return true;
    if (uSandi && mBranchCode && uSandi === mBranchCode) return true;
    if (uCabang && mCabang && (uCabang === mCabang || mCabang.includes(uCabang) || uCabang.includes(mCabang))) return true;
    if (uSandiCabang && (uSandiCabang === mSandiCabang || (mSandi && uSandiCabang.includes(mSandi)) || (mCabang && uSandiCabang.includes(mCabang)))) return true;
    if (uOutlet && mOutlet && (uOutlet === mOutlet || mOutlet.includes(uOutlet))) return true;

    return false;
  };

  // 1. Cek pada kandidat rekomendasi Top 3
  for (const cand of candidates) {
    if (isMatchMaster(cand.master)) {
      if (cand.rank === 1) {
        return {
          hasPrefilled: true,
          prefilledText: prefilledDisplay,
          matchedRank: 1,
          matchedCandidate: cand,
          status: 'match_top1',
          message: `Sesuai Rekomendasi 1 (Utama) • Skor ${cand.score}%`,
        };
      } else if (cand.rank === 2) {
        return {
          hasPrefilled: true,
          prefilledText: prefilledDisplay,
          matchedRank: 2,
          matchedCandidate: cand,
          status: 'match_top2',
          message: `Masuk di Rekomendasi 2 (Alternatif) • Skor ${cand.score}%`,
        };
      } else if (cand.rank === 3) {
        return {
          hasPrefilled: true,
          prefilledText: prefilledDisplay,
          matchedRank: 3,
          matchedCandidate: cand,
          status: 'match_top3',
          message: `Masuk di Rekomendasi 3 (Alternatif) • Skor ${cand.score}%`,
        };
      }
    }
  }

  // 2. Cek apakah ada di master list terurut di luar Top 3
  if (allMasterScored && allMasterScored.length > 0) {
    const idx = allMasterScored.findIndex((s) => isMatchMaster(s.master));
    if (idx >= 0) {
      const foundRank = idx + 1;
      return {
        hasPrefilled: true,
        prefilledText: prefilledDisplay,
        matchedRank: foundRank,
        status: 'match_other',
        message: `Pilihan di Excel Anda berada di Peringkat #${foundRank} sistem (Di luar Top 3 terdekat)`,
      };
    }
  }

  return {
    hasPrefilled: true,
    prefilledText: prefilledDisplay,
    matchedRank: null,
    status: 'not_found',
    message: `Pilihan di Excel "${prefilledDisplay}" tidak terdaftar di Data Master`,
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
        const rowAudit = evaluateUserPrefilledAudit(row, cached.candidates);
        results.push({
          ...cached,
          targetRow: row,
          userPrefilledAudit: rowAudit,
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
        const rowAudit = evaluateUserPrefilledAudit(row, cached.candidates);
        return {
          ...cached,
          targetRow: row,
          userPrefilledAudit: rowAudit,
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
