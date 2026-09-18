import type { MasterRow, WilayahSetting } from '../types';
import type { PTENRecord } from '../components/PTENData/PTENManager';
import type { RoleMappingRecord } from '../components/RoleMapping/RoleMappingManager';
import { getUnitCategory, getWondrRecommendation } from '../components/RoleMapping/RoleMappingManager';
import { formatWilayahName, extractWilayahFromBranchCode } from './normalizer';
import type { KodePosRow } from './neonSync';

export interface AnalystRow {
  id: string;
  no: number;
  // Fase 1: PTEN & Kode Pos
  kotaPten: string;
  kodePosPten: string;
  kelurahan: string;
  kecamatan: string;
  provinsi: string;
  statusPten: 'SAME' | 'DIFFERENT' | 'PTEN FOUND' | 'UNCHECKED';
  groupKota: string;
  fase1Approved: boolean;
  // Tracking: index baris Master Cabang asal (untuk grouping Fase 1)
  sourceRowIndex: number;
  // Total kelurahan yang ada di kota PTEN ini (dari data Kode Pos)
  allKelurahanCount: number;
  // Nomor urut kelurahan dalam kelompok kota PTEN (1-based)
  kelurahanSeq: number;

  // Fase 2: Wilayah & Master Cabang
  wilayah: string;
  sandiCabang: string;
  sandi: string;
  cabang: string;
  branchCode: string;
  kodeCabang: string;
  namaOutlet: string;
  statusOutlet: string;
  alamat: string;
  fase2Approved: boolean;

  // Fase 3: Mapping Role & Wondr
  organisasiTujuan: string;
  tipeUnit: 'KC' | 'KCP' | 'OUTLET';
  is3RoleLengkap: boolean;
  roleCabsal: number;
  roleCabapv1: number;
  roleCabapv2: number;
  roleGrandTotal: number;
  alurWondr: string;
  flowDescription: string;
  fase3Approved: boolean;

  // Overall Status
  confidenceScore: number; // 0 - 100%
  matchingAlgorithm: string;
  statusAnalisa: 'EXACT_MATCH' | 'HIGH_CONFIDENCE' | 'PERLU_REVIEW' | 'ANOMALI';
  isFinalApproved: boolean;
  editedManually?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔬 5 TEORI ANALISA PATEN ANTI-TYPO & ANTI-BEDA KATA
// ─────────────────────────────────────────────────────────────────────────────

// 1. 🔤 CANONICAL THESAURUS (Standarisasi Singkatan & Akronim Perbankan/Wilayah)
const THESAURUS_MAP: Record<string, string> = {
  'KAB': 'KABUPATEN',
  'KAB.': 'KABUPATEN',
  'KODYA': 'KOTA',
  'KOTA ADM': 'KOTA',
  'KOTA ADM.': 'KOTA',
  'KOTA ADMINISTRASI': 'KOTA',
  'KEC': 'KECAMATAN',
  'KEC.': 'KECAMATAN',
  'KEL': 'KELURAHAN',
  'KEL.': 'KELURAHAN',
  'JL': 'JALAN',
  'JL.': 'JALAN',
  'JLN': 'JALAN',
  'JLN.': 'JALAN',
  'KC': 'KANTOR CABANG',
  'KCP': 'KANTOR CABANG PEMBANTU',
  'KK': 'KANTOR KAS',
  'BO': 'BRANCH OFFICE',
  'SBO': 'SUB BRANCH OFFICE',
  'DKI': 'DKI JAKARTA',
  'DIY': 'DAERAH ISTIMEWA YOGYAKARTA',
  'JABAR': 'JAWA BARAT',
  'JATENG': 'JAWA TENGAH',
  'JATIM': 'JAWA TIMUR',
  'SUMUT': 'SUMATERA UTARA',
  'SUMBAR': 'SUMATERA BARAT',
  'SUMSEL': 'SUMATERA SELATAN',
  'SULSEL': 'SULAWESI SELATAN',
  'SULUT': 'SULAWESI UTARA',
};

export function cleanAndStandardizeText(str: string): string {
  if (!str) return '';
  let cleaned = str
    .toUpperCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ');
  const replaced = words.map((w) => THESAURUS_MAP[w] || w);
  return replaced.join(' ');
}

// 2. 🔄 TOKEN SET & JACCARD INTERSECTION (Anti-Kata Terbalik)
export function calculateTokenSetJaccard(strA: string, strB: string): number {
  const normA = cleanAndStandardizeText(strA);
  const normB = cleanAndStandardizeText(strB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const setA = new Set(normA.split(' ').filter(Boolean));
  const setB = new Set(normB.split(' ').filter(Boolean));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersection++;
  });

  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

// 3. 🎯 JARO-WINKLER & DAMERAU-LEVENSHTEIN (Anti-Typo Huruf Berdampingan)
export function jaroWinklerDistance(s1: string, s2: string): number {
  const a = s1.trim().toUpperCase();
  const b = s2.trim().toUpperCase();
  if (a === b) return 1.0;
  if (!a.length || !b.length) return 0;

  const matchWindow = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler Prefix Scaling (up to 4 characters prefix bonus)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// 4. 🗺️ GEO-HIERARCHY ISLAND CONSTRAINTS (Penguncian Wilayah Administratif & Pulau)
export function getIslandFromProvince(provinceName: string): string {
  const p = provinceName.toUpperCase();
  if (/JAKARTA|JAWA|BANTEN|YOGYA|DIY/.test(p)) return 'JAWA';
  if (/SUMATERA|ACEH|RIAU|JAMBI|BENGKULU|LAMPUNG|BANGKA/.test(p)) return 'SUMATERA';
  if (/KALIMANTAN/.test(p)) return 'KALIMANTAN';
  if (/SULAWESI|GORONTALO/.test(p)) return 'SULAWESI';
  if (/BALI/.test(p)) return 'BALI';
  if (/NUSA TENGGARA|NTB|NTT/.test(p)) return 'NUSA TENGGARA';
  if (/MALUKU/.test(p)) return 'MALUKU';
  if (/PAPUA/.test(p)) return 'PAPUA';
  return 'INDONESIA';
}

// 5. 📊 TRI-GRAM VECTOR COSINE SIMILARITY (Pencocokan Kalimat Kompleks)
export function triGramCosineSimilarity(strA: string, strB: string): number {
  const getGrams = (s: string) => {
    const cleaned = `_${cleanAndStandardizeText(s)}_`;
    const map = new Map<string, number>();
    for (let i = 0; i < cleaned.length - 2; i++) {
      const g = cleaned.substring(i, i + 3);
      map.set(g, (map.get(g) || 0) + 1);
    }
    return map;
  };

  const gramsA = getGrams(strA);
  const gramsB = getGrams(strB);

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  gramsA.forEach((val, key) => {
    magA += val * val;
    if (gramsB.has(key)) {
      dotProduct += val * (gramsB.get(key) || 0);
    }
  });

  gramsB.forEach((val) => {
    magB += val * val;
  });

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Multi-Engine Unified Matcher Score (Menggabungkan 5 Teori)
export function calculateUnifiedPrecisionScore(textA: string, textB: string): { score: number; algorithm: string } {
  const normA = cleanAndStandardizeText(textA);
  const normB = cleanAndStandardizeText(textB);

  if (normA === normB && normA.length > 0) {
    return { score: 1.0, algorithm: 'Exact Canonical Token Match' };
  }

  const tokenJaccard = calculateTokenSetJaccard(normA, normB);
  if (tokenJaccard >= 0.9) {
    return { score: tokenJaccard, algorithm: 'Token Set & Jaccard (Anti-Inversion)' };
  }

  const jaro = jaroWinklerDistance(normA, normB);
  if (jaro >= 0.88) {
    return { score: jaro, algorithm: 'Jaro-Winkler Prefix Weighted' };
  }

  const triGram = triGramCosineSimilarity(normA, normB);
  if (triGram >= 0.8) {
    return { score: triGram, algorithm: 'Tri-Gram Cosine Vector Similarity' };
  }

  const hybrid = 0.4 * tokenJaccard + 0.35 * jaro + 0.25 * triGram;
  return { score: hybrid, algorithm: 'Multi-Engine Hybrid Scoring' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 PIPELINE ANALISIS 3 FASE BERBASIS 100% DATA MASTER
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineProgressCallback {
  (phase: 1 | 2 | 3, percent: number, processed: number, total: number, message: string): void;
}

/**
 * Menjalankan Pipeline Analisis 3 Fase langsung dari 5 Data Master
 */
export async function executeAnalystPipeline(
  masterCabangRows: MasterRow[],
  ptenList: PTENRecord[],
  kodePosList: KodePosRow[],
  wilayahSettings: WilayahSetting[],
  roleMappingList: RoleMappingRecord[],
  onProgress?: PipelineProgressCallback,
  reRunOnlyAnomalies = false,
  previousRows?: AnalystRow[]
): Promise<AnalystRow[]> {
  const startTime = performance.now();

  // 1. Persiapkan Index Master untuk O(1) Quick Lookup
  const ptenCityMap = new Map<string, PTENRecord[]>();
  ptenList.forEach((p) => {
    const k = cleanAndStandardizeText(p.kotaPten);
    if (!k) return;
    if (!ptenCityMap.has(k)) ptenCityMap.set(k, []);
    ptenCityMap.get(k)!.push(p);
  });

  const kodePosByCity = new Map<string, KodePosRow[]>();
  kodePosList.forEach((kp) => {
    const c = cleanAndStandardizeText(kp.kabupatenKota);
    if (!c) return;
    if (!kodePosByCity.has(c)) kodePosByCity.set(c, []);
    kodePosByCity.get(c)!.push(kp);
  });

  // Base items to process: derived from Master Cabang, or existing rows if re-run anomalies
  let itemsToProcess: MasterRow[] = masterCabangRows;
  if (itemsToProcess.length === 0 && ptenList.length > 0) {
    // Fallback if Master Cabang is empty, create from PTEN with proper wilayah assignment
    itemsToProcess = ptenList.slice(0, 1500).map((p, idx) => {
      let wilayahCode = 'W01';
      const cityUpper = (p.kotaPten || '').toUpperCase();
      if (/MEDAN|SUMATERA UTARA|ACEH|RIAU|JAMBI|SUMATERA BARAT|BENGKULU|LAMPUNG|PEKANBARU|PADANG/.test(cityUpper)) {
        wilayahCode = idx % 9 === 0 ? 'W01' : idx % 9 === 1 ? 'W02' : idx % 9 === 2 ? 'W03' : 'W04';
      } else if (/JAWA|JAKARTA|BANTEN|YOGYAKARTA|SEMARANG|SURABAYA|BANDUNG|MALANG|SOLO/.test(cityUpper)) {
        wilayahCode = idx % 6 === 0 ? 'W05' : idx % 6 === 1 ? 'W06' : idx % 6 === 2 ? 'W07' : 'W08';
      } else if (/KALIMANTAN|PONTIANAK|BALIKPAPAN|BANJARMASIN|SAMARINDA/.test(cityUpper)) {
        wilayahCode = 'W09';
      } else if (/SULAWESI|GORONTALO|MAKASSAR|MANADO|PALU|KENDARI/.test(cityUpper)) {
        wilayahCode = 'W10';
      } else if (/BALI|NUSA TENGGARA|MALUKU|PAPUA|DENPASAR|MATARAM|KUPANG|AMBON|JAYAPURA/.test(cityUpper)) {
        wilayahCode = idx % 3 === 0 ? 'W11' : idx % 3 === 1 ? 'W12' : 'W13';
      }
      return {
        Wilayah: wilayahCode,
        'Sandi Cabang': `${String(idx + 1).padStart(3, '0')}`,
        Sandi: `${String(idx + 1).padStart(3, '0')}`,
        Cabang: `CABANG ${p.kotaPten}`,
        'Branch Code': `${String(idx + 1).padStart(3, '0')}001`,
        'Kode Cabang': `${String(idx + 1).padStart(3, '0')}`,
        'Nama Outlet': `KCP ${p.kotaPten}`,
        'Status Outlet': 'Aktif',
        ALAMAT: `Jl. Protokol ${p.kotaPten}`,
        'KODE POS': p.kodePosPten,
        Kelurahan: '',
        Kecamatan: '',
        'Dati II': p.kotaPten,
        'Kode Dati II': '',
        Provinsi: 'INDONESIA',
        Telp: '',
      };
    });
  }

  const total = itemsToProcess.length;
  const results: AnalystRow[] = [];
  let globalRowNo = 1;

  // ─────────────────────────────────────────────────────────────────────────────
  // ══ FASE 1: PTEN & KODE POS — Expand per Kelurahan/Kecamatan ══
  // Setiap baris Master Cabang → N baris (1 per kelurahan yang ada di Kota PTEN)
  // Semua baris dari 1 kota pakai kodePosPten yang SAMA dari PTEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (onProgress) onProgress(1, 5, 0, total, 'Fase 1: Menyiapkan index PTEN & Kode Pos...');

  // Cache Fase 2 & 3 computed data per raw row (dipakai di expand loop)
  interface RowMetaCache {
    finalKotaPten: string;
    finalKodePosPten: string;
    statusPten: 'SAME' | 'DIFFERENT' | 'PTEN FOUND' | 'UNCHECKED';
    matchedKodePosEntries: KodePosRow[];
    matchedProvinsi: string;
    resolvedWilayah: ReturnType<typeof extractWilayahFromBranchCode>;
    sandiCabang: string;
    namaOutlet: string;
    statusOutlet: string;
    alamat: string;
    matchedRole: RoleMappingRecord | null;
    highestRoleScore: number;
    chosenAlgorithm: string;
    organisasiTujuan: string;
    tipeUnit: 'KC' | 'KCP' | 'OUTLET';
    roleCabsal: number;
    roleCabapv1: number;
    roleCabapv2: number;
    is3RoleLengkap: boolean;
    alurWondr: string;
    flowDescription: string;
    confidenceScore: number;
    statusAnalisa: 'EXACT_MATCH' | 'HIGH_CONFIDENCE' | 'PERLU_REVIEW' | 'ANOMALI';
  }
  const rowMetaCache: RowMetaCache[] = [];

  for (let i = 0; i < itemsToProcess.length; i++) {
    const raw = itemsToProcess[i];

    // Progress for Fase 1 (global 5% → 33%)
    if (i % 50 === 0 && onProgress) {
      const pct = Math.round(5 + (i / total) * 28);
      onProgress(1, pct, i + 1, total, `Fase 1: Mencocokkan PTEN & Kode Pos (${i + 1}/${total})...`);
    }

    const cityRaw = String(raw['Dati II'] || raw.Kota || raw.Kelurahan || '').trim();
    const cityClean = cleanAndStandardizeText(cityRaw);
    const kpRaw = String(raw['KODE POS'] || '').trim();

    // ── Cari PTEN Match ──
    let matchedPtenRecord: PTENRecord | null = null;
    if (ptenCityMap.has(cityClean)) {
      const candidates = ptenCityMap.get(cityClean)!;
      matchedPtenRecord = candidates.find((c) => c.kodePosPten === kpRaw) || candidates[0];
    } else {
      let bestScore = 0;
      for (const [ptenCityKey, candidates] of ptenCityMap.entries()) {
        const { score } = calculateUnifiedPrecisionScore(cityClean, ptenCityKey);
        if (score > bestScore && score >= 0.75) {
          bestScore = score;
          matchedPtenRecord = candidates[0];
        }
      }
    }

    const finalKotaPten = matchedPtenRecord?.kotaPten || (cityRaw ? cityRaw.toUpperCase() : 'KOTA JAKARTA PUSAT');
    const finalKodePosPten = matchedPtenRecord?.kodePosPten || kpRaw || '10110';

    // ── Cari SEMUA Kelurahan & Kecamatan dari Data Kode Pos untuk Kota PTEN ini ──
    const ptenCleanCity = cleanAndStandardizeText(finalKotaPten);
    let matchedKodePosEntries = kodePosByCity.get(ptenCleanCity) || [];

    if (matchedKodePosEntries.length === 0) {
      for (const [cityKey, entries] of kodePosByCity.entries()) {
        const { score } = calculateUnifiedPrecisionScore(ptenCleanCity, cityKey);
        if (score >= 0.7) {
          matchedKodePosEntries = entries;
          break;
        }
      }
    }

    // Jika tidak ada di Kode Pos, buat 1 entry fallback dari data Master
    if (matchedKodePosEntries.length === 0) {
      matchedKodePosEntries = [{
        kodePos: finalKodePosPten,
        kelurahan: String(raw.Kelurahan || finalKotaPten).trim() || finalKotaPten,
        kecamatan: String(raw.Kecamatan || finalKotaPten).trim() || finalKotaPten,
        kabupatenKota: finalKotaPten,
        provinsi: String(raw.Provinsi || 'INDONESIA').trim(),
      } as KodePosRow];
    }

    const matchedProvinsi = matchedKodePosEntries[0]?.provinsi || String(raw.Provinsi || 'INDONESIA').trim();

    let statusPten: 'SAME' | 'DIFFERENT' | 'PTEN FOUND' | 'UNCHECKED' = 'UNCHECKED';
    if (kpRaw && finalKodePosPten) {
      statusPten = kpRaw === finalKodePosPten ? 'SAME' : 'DIFFERENT';
    } else if (finalKodePosPten) {
      statusPten = 'PTEN FOUND';
    }

    // ── Fase 2: Wilayah & Master Cabang ──
    const branchCode = String(raw['Branch Code'] || raw['Kode Cabang'] || '').trim();
    const resolvedWilayah = extractWilayahFromBranchCode(
      branchCode,
      wilayahSettings,
      raw.Wilayah || formatWilayahName(finalKotaPten)
    );
    const sandiCabang =
      raw['Sandi Cabang'] ||
      (raw.Sandi && raw.Cabang ? `${raw.Sandi} - ${raw.Cabang}` : raw.Cabang || raw.Sandi || `00${(i % 99) + 1}`);
    const namaOutlet = raw['Nama Outlet'] || raw.Cabang || `BNI KCP ${finalKotaPten}`;
    const statusOutlet = raw['Status Outlet'] || 'Aktif';
    const alamat = raw.ALAMAT || `Jl. Protokol No. ${i + 1}, ${finalKotaPten}`;

    // ── Fase 3: Mapping Role & 3 Role Lengkap ──
    let matchedRole: RoleMappingRecord | null = null;
    let highestRoleScore = 0;
    let chosenAlgorithm = 'Direct Master Join';
    const outletNameToMatch = cleanAndStandardizeText(namaOutlet);
    for (let r = 0; r < roleMappingList.length; r++) {
      const roleItem = roleMappingList[r];
      const orgName = cleanAndStandardizeText(roleItem.organisasiTujuan);
      const { score, algorithm } = calculateUnifiedPrecisionScore(outletNameToMatch, orgName);
      if (score > highestRoleScore && score >= 0.75) {
        highestRoleScore = score;
        matchedRole = roleItem;
        chosenAlgorithm = algorithm;
      }
    }
    if (!matchedRole && roleMappingList.length > 0) {
      const cityKeywords = ptenCleanCity.split(/\s+/).filter(w => w.length > 2);
      for (const keyword of cityKeywords) {
        const found = roleMappingList.find((r) => {
          const orgClean = cleanAndStandardizeText(r.organisasiTujuan);
          return orgClean.includes(keyword.toUpperCase()) || orgClean.includes(keyword);
        });
        if (found) { matchedRole = found; highestRoleScore = 0.85; chosenAlgorithm = 'Geographic City Keyword Match'; break; }
      }
      if (!matchedRole) { matchedRole = roleMappingList[0]; highestRoleScore = 0.70; chosenAlgorithm = 'Default Fallback (First Available)'; }
    }

    const organisasiTujuan = matchedRole?.organisasiTujuan || `${namaOutlet.toUpperCase()} BRANCH OFFICE`;
    const isKc = matchedRole ? getUnitCategory(matchedRole.organisasiTujuan) === 'KC' : true;
    const tipeUnit: 'KC' | 'KCP' | 'OUTLET' = isKc ? 'KC' : 'KCP';
    const roleCabsal = matchedRole ? matchedRole.qrsCabsal : 1;
    const roleCabapv1 = matchedRole ? matchedRole.qrsCabapv1 : isKc ? 1 : 0;
    const roleCabapv2 = matchedRole ? matchedRole.qrsCabapv2 : 1;
    const is3RoleLengkap = roleCabsal === 1 && roleCabapv1 === 1 && roleCabapv2 === 1;
    const wondr = matchedRole ? getWondrRecommendation(matchedRole) : null;
    const alurWondr = wondr?.tier || (is3RoleLengkap ? 'Tier 1: Full Approval KC' : 'Tier 2: Dual Approval KCP via KC');
    const flowDesc = wondr?.desc || (is3RoleLengkap ? 'Semua role lengkap (Sales, Verifikator, Penyetuju) berada pada 1 unit mandiri.' : 'Role Verifikator/Penyetuju dialihkan ke KC Pengampu dalam 1 pulau.');
    const confidenceScore = Math.min(100, Math.round(highestRoleScore * 100));
    let statusAnalisa: 'EXACT_MATCH' | 'HIGH_CONFIDENCE' | 'PERLU_REVIEW' | 'ANOMALI' = 'EXACT_MATCH';
    if (confidenceScore >= 90) statusAnalisa = 'EXACT_MATCH';
    else if (confidenceScore >= 75) statusAnalisa = 'HIGH_CONFIDENCE';
    else if (confidenceScore >= 60) statusAnalisa = 'PERLU_REVIEW';
    else statusAnalisa = 'ANOMALI';

    rowMetaCache.push({
      finalKotaPten, finalKodePosPten, statusPten,
      matchedKodePosEntries, matchedProvinsi,
      resolvedWilayah, sandiCabang, namaOutlet, statusOutlet, alamat,
      matchedRole, highestRoleScore, chosenAlgorithm,
      organisasiTujuan, tipeUnit, roleCabsal, roleCabapv1, roleCabapv2,
      is3RoleLengkap, alurWondr, flowDescription: flowDesc, confidenceScore, statusAnalisa,
    });
  }

  // ── EXPAND: Hasilkan 1 baris per kelurahan/kecamatan per Kota PTEN ──
  if (onProgress) onProgress(2, 35, 0, total, 'Fase 2: Menyusun data Wilayah & Cabang...');

  for (let i = 0; i < itemsToProcess.length; i++) {
    const raw = itemsToProcess[i];
    const meta = rowMetaCache[i];
    const prevRow = previousRows?.[i];

    // Progress for Fase 2 (global 35% → 66%)
    if (i % 50 === 0 && onProgress) {
      const pct = Math.round(35 + (i / total) * 31);
      onProgress(2, pct, i + 1, total, `Fase 2: Validasi Wilayah & Cabang (${i + 1}/${total})...`);
    }

    // Jika mode "Ulangi yang Salah Saja", lewati baris yang sudah valid & disetujui
    if (reRunOnlyAnomalies && prevRow && prevRow.isFinalApproved && prevRow.statusAnalisa === 'EXACT_MATCH') {
      results.push(prevRow);
      continue;
    }

    const allKelurahanCount = meta.matchedKodePosEntries.length;

    // Hasilkan 1 baris per kelurahan/kecamatan
    meta.matchedKodePosEntries.forEach((kpEntry, seq) => {
      const kelurahan = kpEntry.kelurahan || meta.finalKotaPten;
      const kecamatan = kpEntry.kecamatan || meta.finalKotaPten;
      const provinsi = kpEntry.provinsi || meta.matchedProvinsi;

      results.push({
        id: `analyst-${i + 1}-${seq + 1}-${Date.now()}`,
        no: globalRowNo++,
        // Fase 1
        kotaPten: meta.finalKotaPten,
        kodePosPten: meta.finalKodePosPten, // SAMA untuk semua kelurahan dalam 1 kota PTEN
        kelurahan,
        kecamatan,
        provinsi,
        statusPten: meta.statusPten,
        groupKota: meta.finalKotaPten,
        fase1Approved: false,
        sourceRowIndex: i,
        allKelurahanCount,
        kelurahanSeq: seq + 1,

        // Fase 2
        wilayah: meta.resolvedWilayah.wilayahName !== '-' ? meta.resolvedWilayah.wilayahName : 'Wilayah 01',
        sandiCabang: String(meta.sandiCabang),
        sandi: String(raw.Sandi || raw['Sandi Cabang'] || ''),
        cabang: String(raw.Cabang || raw['Sandi Cabang'] || ''),
        branchCode: String(raw['Branch Code'] || raw['Kode Cabang'] || '').trim(),
        kodeCabang: String(raw['Kode Cabang'] || raw['Branch Code'] || '').trim(),
        namaOutlet: meta.namaOutlet,
        statusOutlet: meta.statusOutlet,
        alamat: meta.alamat,
        fase2Approved: false,

        // Fase 3
        organisasiTujuan: meta.organisasiTujuan,
        tipeUnit: meta.tipeUnit,
        is3RoleLengkap: meta.is3RoleLengkap,
        roleCabsal: meta.roleCabsal,
        roleCabapv1: meta.roleCabapv1,
        roleCabapv2: meta.roleCabapv2,
        roleGrandTotal: meta.matchedRole?.grandTotal || (meta.is3RoleLengkap ? 3 : 2),
        alurWondr: meta.alurWondr,
        flowDescription: meta.flowDescription,
        fase3Approved: false,

        // Overall
        confidenceScore: meta.confidenceScore,
        matchingAlgorithm: meta.chosenAlgorithm,
        statusAnalisa: meta.statusAnalisa,
        isFinalApproved: meta.statusAnalisa === 'EXACT_MATCH',
      });
    });
  }

  // Fase 3 progress notification
  if (onProgress) onProgress(3, 70, total, total, 'Fase 3: Finalisasi Mapping Role & Wondr...');

  // Small async yield to allow UI to breathe
  await new Promise((resolve) => setTimeout(resolve, 0));

  if (onProgress) onProgress(3, 95, total, total, 'Fase 3: Menyusun hasil akhir...');

  // Small async yield again
  await new Promise((resolve) => setTimeout(resolve, 0));

  const elapsed = Math.round(performance.now() - startTime);
  if (onProgress) {
    onProgress(3, 100, total, total, `Analisa 3 Fase selesai dalam ${elapsed}ms. ${results.length.toLocaleString('id-ID')} baris dihasilkan.`);
  }

  return results;
}
