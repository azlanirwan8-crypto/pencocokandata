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
  // Integritas penempatan kelurahan/kecamatan → kota/kab (divalidasi via blok kode pos)
  placementStatus: 'VERIFIED' | 'REVIEW' | 'FALLBACK';
  placementMethod: string;
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
  'KEP': 'KEPULAUAN',
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

// Kunci pencocokan KOTA/KABUPATEN: buang kata administratif (KOTA, KABUPATEN,
// ADMINISTRASI, DAERAH KHUSUS, dst) supaya "JAKARTA PUSAT" == "KOTA ADMINISTRASI
// JAKARTA PUSAT" dan "SLEMAN" == "KABUPATEN SLEMAN".
const ADMIN_NOISE_TOKENS = new Set([
  'KOTA', 'KABUPATEN', 'KAB', 'KODYA', 'KOTAMADYA', 'ADMINISTRASI', 'ADM', 'DAERAH', 'KHUSUS', 'I',
  'KECAMATAN', 'KEC', 'KELURAHAN', 'KEL', 'DESA', 'DUSUN', 'DUKUH',
]);
// Normalisasi pakar: canonical + buang token administratif. Dipakai SEMUA mesin
// similarity (kota, kabupaten, kecamatan, kelurahan, provinsi, alamat, organisasi).
export function expertNormalize(raw: string): string {
  return cleanAndStandardizeText(raw)
    .split(' ')
    .filter((w) => w && !ADMIN_NOISE_TOKENS.has(w))
    .join(' ');
}
export function cityMatchKey(raw: string): string {
  return expertNormalize(raw);
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

// 6. ✏️ DAMERAU-LEVENSHTEIN (Optimal String Alignment) — typo & huruf tertukar
function damerauOSA(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (!la) return lb;
  if (!lb) return la;
  const d: number[][] = Array.from({ length: la + 1 }, (_, i) => {
    const row = new Array<number>(lb + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= lb; j++) d[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[la][lb];
}
export function damerauLevenshteinSimilarity(strA: string, strB: string): number {
  const a = expertNormalize(strA);
  const b = expertNormalize(strB);
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  if (!max) return 0;
  return 1 - damerauOSA(a, b) / max;
}

// 7. 🧬 LONGEST COMMON SUBSEQUENCE ratio — ketahanan pada sisipan kata alamat
function lcsLength(a: string, b: string): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}
export function lcsRatio(strA: string, strB: string): number {
  const a = expertNormalize(strA);
  const b = expertNormalize(strB);
  if (!a.length || !b.length) return 0;
  return (2 * lcsLength(a, b)) / (a.length + b.length);
}

// 8. 🎨 RATCLIFF-OBERSHELP (Gestalt Pattern Matching) — kemiripan "sebagaimana dinilai manusia"
function gestaltMatchCount(a: string, b: string): number {
  if (!a || !b) return 0;
  let best = 0;
  let aiEnd = 0;
  let biEnd = 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) {
          best = cur[j];
          aiEnd = i;
          biEnd = j;
        }
      }
    }
    prev = cur;
  }
  if (!best) return 0;
  return (
    2 * best +
    gestaltMatchCount(a.slice(0, aiEnd - best), b.slice(0, biEnd - best)) +
    gestaltMatchCount(a.slice(aiEnd), b.slice(biEnd))
  );
}
export function ratcliffObershelpSimilarity(strA: string, strB: string): number {
  const a = expertNormalize(strA);
  const b = expertNormalize(strB);
  const denom = a.length + b.length;
  if (!denom) return 0;
  return gestaltMatchCount(a, b) / denom;
}

// 9. 🔊 PHONETIC INDONESIAN KEY — ejaan lama/baru & variasi transkripsi
// (DJ→J, TJ→C, SJ→S, KH/CH→K, SH→S, OE→U, AE→A, huruf ganda dilipatgandakan jadi satu)
export function indoPhoneticKey(raw: string): string {
  let s = expertNormalize(raw).replace(/[^A-Z ]/g, '');
  s = s
    .replace(/DJ/g, 'J')
    .replace(/TJ/g, 'C')
    .replace(/SJ/g, 'S')
    .replace(/CH/g, 'K')
    .replace(/SH/g, 'S')
    .replace(/KH/g, 'K')
    .replace(/TH/g, 'T')
    .replace(/OE/g, 'U')
    .replace(/AE/g, 'A')
    .replace(/IE/g, 'I')
    .replace(/Q/g, 'K')
    .replace(/X/g, 'S')
    .replace(/Z/g, 'S');
  // lipat huruf kembar: "SMM" -> "SM"
  s = s.replace(/(.)\1+/g, '$1');
  return s.replace(/\s+/g, ' ').trim();
}

// 10. 🧱 TOKEN CONTAINMENT — hierarki nama wilayah (yang pendek ⊆ yang panjang)
export function tokenContainmentScore(strA: string, strB: string): number {
  const ta = expertNormalize(strA).split(' ').filter(Boolean);
  const tb = expertNormalize(strB).split(' ').filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  const small = ta.length <= tb.length ? ta : tb;
  const big = new Set(ta.length <= tb.length ? tb : ta);
  const longestSmall = Math.max(...small.map((t) => t.length));
  if (longestSmall < 4) return 0; // terlalu pendek — bukan bukti containment
  if (small.every((t) => big.has(t))) {
    return 0.85 + 0.1 * (small.length / (ta.length + tb.length - small.length));
  }
  return 0;
}

// 11. 🔠 INITIALISM MATCH — "JP" vs "JAKARTA PUSAT", "KCP" vs "KANTOR CABANG PEMBANTU"
export function initialismMatchScore(strA: string, strB: string): number {
  const tokensA = expertNormalize(strA).split(' ').filter(Boolean);
  const tokensB = expertNormalize(strB).split(' ').filter(Boolean);
  const check = (short: string[], long: string[]): number => {
    if (short.length !== 1 || long.length < 2) return 0;
    const abbr = short[0];
    if (abbr.length < 2 || abbr.length !== long.length) return 0;
    const initials = long.map((t) => t[0]).join('');
    return initials === abbr ? 0.85 : 0;
  };
  return Math.max(check(tokensA, tokensB), check(tokensB, tokensA));
}

// 🧠 MULTI-ENGINE EXPERT ENSEMBLE (11 sinyal: cascade pakar + consensus voting)
// Panggilan bisa jutaan pasangan (outlet × role), jadi sinyal mahal (DP O(n·m))
// hanya dijalankan bila sinyal murah menunjukkan pasangan ini "berpeluang".
export function calculateUnifiedPrecisionScore(textA: string, textB: string): { score: number; algorithm: string } {
  const normA = expertNormalize(textA);
  const normB = expertNormalize(textB);

  if (normA === normB && normA.length > 0) {
    return { score: 1.0, algorithm: 'Exact Canonical Match' };
  }

  // ── Sinyal murah: dihitung selalu ──
  const tokenJaccard = calculateTokenSetJaccard(normA, normB);
  const jaro = jaroWinklerDistance(normA, normB);
  const containment = tokenContainmentScore(normA, normB);
  const initials = initialismMatchScore(normA, normB);
  const keyA = indoPhoneticKey(normA);
  const keyB = indoPhoneticKey(normB);
  const phoneticHit = keyA.length >= 4 && keyA === keyB;

  // ── Cascade pakar (sinyal paling meyakinkan menang) ──
  if (phoneticHit) {
    return { score: Math.max(0.95, jaro), algorithm: 'Phonetic Indonesian Transcription Match' };
  }
  if (containment >= 0.85) {
    return { score: containment, algorithm: 'Token Containment (Hierarchical Region)' };
  }
  if (initials >= 0.85) {
    return { score: initials, algorithm: 'Initialism / Acronym Expansion Match' };
  }

  // ── Fast-reject gate: pasangan jelas berbeda tidak layak dibayar DP mahal ──
  const cheapBest = Math.max(tokenJaccard, jaro);
  if (cheapBest < 0.55) {
    return { score: 0.55 * tokenJaccard + 0.45 * jaro, algorithm: 'Fast Reject Gate (cheap signals only)' };
  }

  // ── Sinyal mahal: baru dihitung saat ada peluang ──
  const triGram = triGramCosineSimilarity(normA, normB);
  const damerau = damerauLevenshteinSimilarity(normA, normB);
  const lcs = lcsRatio(normA, normB);
  const gestalt = ratcliffObershelpSimilarity(normA, normB);

  const signals = [tokenJaccard, jaro, triGram, damerau, lcs, gestalt];
  const strongVotes = signals.filter((s) => s >= 0.85).length;
  const best = Math.max(...signals);

  // Consensus: ≥3 dari 6 mesin pakar sepakat mirip → nilai terbaik + bonus kesepakatan
  if (strongVotes >= 3) {
    return { score: Math.min(1, best + 0.04), algorithm: `Expert Ensemble Consensus (${strongVotes}/6 signals agree)` };
  }
  if (strongVotes === 2 && best >= 0.9) {
    return { score: best, algorithm: 'Expert Ensemble Dual Agreement' };
  }

  // Hybrid berbobot 6 sinyal (fallback terukur)
  const hybrid =
    0.2 * tokenJaccard + 0.2 * jaro + 0.15 * triGram + 0.2 * damerau + 0.1 * lcs + 0.15 * gestalt;
  return { score: hybrid, algorithm: 'Multi-Engine Weighted Hybrid (6-Signal)' };
}

// 🏙️ CITY-STRICT MATCHER — khusus pencocokan KOTA/KABUPATEN.
// Sengaja TIDAK memakai token containment/initialism (subset nama = kota berbeda,
// mis. TANGERANG vs TANGERANG SELATAN). Hanya terima: exact canonical, fonetik,
// atau kemiripan sangat tinggi multi-sinyal. Lebih baik kota masuk review
// (fallback) daripada kelurahan salah tempel kota.
export function calculateCityMatchScore(textA: string, textB: string): { score: number; algorithm: string } {
  const normA = expertNormalize(textA);
  const normB = expertNormalize(textB);
  if (normA === normB && normA.length > 0) {
    return { score: 1.0, algorithm: 'City Exact Canonical Match' };
  }
  const keyA = indoPhoneticKey(normA).replace(/ /g, '');
  const keyB = indoPhoneticKey(normB).replace(/ /g, '');
  if (keyA.length >= 4 && keyA === keyB) {
    return { score: 0.96, algorithm: 'City Phonetic Match' };
  }
  const jaccard = calculateTokenSetJaccard(normA, normB);
  const jaro = jaroWinklerDistance(normA, normB);
  const tri = triGramCosineSimilarity(normA, normB);
  const dam = damerauLevenshteinSimilarity(normA, normB);
  const gest = ratcliffObershelpSimilarity(normA, normB);
  const best = Math.max(jaccard, jaro, tri, dam, gest);
  if (best >= 0.9 && (jaccard >= 0.6 || jaro >= 0.93 || tri >= 0.9)) {
    return { score: best, algorithm: 'City Strict Ensemble Match' };
  }
  return { score: 0.55 * jaccard + 0.45 * jaro, algorithm: 'City Strict Reject' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 PIPELINE ANALISIS 3 FASE BERBASIS 100% DATA MASTER
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineProgressCallback {
  (phase: 1 | 2 | 3, percent: number, processed: number, total: number, message: string): void;
}

export interface CoverageCity {
  city: string;
  rows: number;
  status: 'VERIFIED' | 'REVIEW' | 'FALLBACK';
  sampleKodePos: string;
  provinsi: string;
}
export interface AnalystCoverage {
  kodePosTotal: number;
  kodePosMapped: number;
  verifiedRows: number;
  reviewRows: number;
  resultRows: number;
  unmappedCities: CoverageCity[];
  includedCities: CoverageCity[];
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
): Promise<{ rows: AnalystRow[]; coverage: AnalystCoverage }> {
  const startTime = performance.now();

  // 1. Persiapkan Index Master untuk O(1) Quick Lookup
  // Kota di-key dengan cityMatchKey → "JAKARTA PUSAT" dan "KOTA ADMINISTRASI JAKARTA
  // PUSAT" dianggap kota yang sama (grouping berdasarkan kota/kabupaten PTEN)
  const ptenCityMap = new Map<string, PTENRecord[]>();
  ptenList.forEach((p) => {
    const k = cityMatchKey(p.kotaPten);
    if (!k) return;
    if (!ptenCityMap.has(k)) ptenCityMap.set(k, []);
    ptenCityMap.get(k)!.push(p);
  });

  const kodePosByCity = new Map<string, KodePosRow[]>();
  kodePosList.forEach((kp) => {
    const c = cityMatchKey(kp.kabupatenKota);
    if (!c) return;
    if (!kodePosByCity.has(c)) kodePosByCity.set(c, []);
    kodePosByCity.get(c)!.push(kp);
  });

  // ── DRIVER FASE 1 = KOTA/KABUPATEN UNIK DARI DATA PTEN (grouping berdasar PTEN) ──
  // Setiap kota unik di PTEN → SEMUA kelurahan/kecamatan dari Master KodePos kota itu
  // di-mapping ke kota tersebut, memakai kode pos PTEN dari kota yang sama.
  // Master Cabang se-kota (jika ada) jadi representasi data Fase 2 & 3.
  let itemsToProcess: MasterRow[];
  if (ptenCityMap.size > 0) {
    const masterByCity = new Map<string, MasterRow[]>();
    masterCabangRows.forEach((m) => {
      const k = cityMatchKey(String(m['Dati II'] || m.Kota || m.Kelurahan || ''));
      if (!k) return;
      if (!masterByCity.has(k)) masterByCity.set(k, []);
      masterByCity.get(k)!.push(m);
    });

    const masterCityFuzzyCache = new Map<string, MasterRow[]>();
    const findMasterByCity = (cityKey: string): MasterRow[] => {
      const exact = masterByCity.get(cityKey);
      if (exact) return exact;
      const cached = masterCityFuzzyCache.get(cityKey);
      if (cached) return cached;
      let best: MasterRow[] = [];
      let bestScore = 0;
      for (const [mKey, mVals] of masterByCity.entries()) {
        const { score } = calculateCityMatchScore(cityKey, mKey);
        if (score > bestScore && score >= 0.88) {
          bestScore = score;
          best = mVals;
        }
      }
      masterCityFuzzyCache.set(cityKey, best);
      return best;
    };

    // Urutkan grup kota berdasarkan nama Kota/Kabupaten PTEN (A→Z)
    itemsToProcess = Array.from(ptenCityMap.entries())
      .sort((a, b) =>
        (a[1][0]?.kotaPten || a[0]).localeCompare(b[1][0]?.kotaPten || b[0], 'id', { sensitivity: 'base' })
      )
      .map(([cityKey, ptenRecs], idx) => {
      const masters = findMasterByCity(cityKey);
      if (masters.length > 0) return masters[0];

      // Kota PTEN tanpa cabang → baris sintetis dari data PTEN itu sendiri
      const p = ptenRecs[0];
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
  } else {
    // Tanpa data PTEN → kembali ke baris Master Cabang apa adanya
    itemsToProcess = masterCabangRows;
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
    usedFallback?: boolean;
    placementStatus: 'VERIFIED' | 'REVIEW' | 'FALLBACK';
    placementMethod: string;
    cityKey: string;
    cityRawName: string;
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

  // ── GEOCODE BLOCK INDEX (verifikasi deterministik, bukan kemiripan nama) ──
  // Kode pos RI: digit 1 = zona provinsi, digit 4-5 = kecamatan/kelurahan,
  // sehingga blok kode pos adalah bukti geografis yang memisahkan kota.
  // Hasil uji atas 83.762 baris master: prefiks 2 angka hanya 9,6% unik-pemilik,
  // 3 angka 70,7%, 4 angka 95,0% → verifikasi pakai cascading 4→3→2 angka.
  // Ini yang memisahkan kota sesama provinsi bernama mirip, mis.
  // "OGAN KOMERING ULU" vs "... ULU TIMUR" (skor nama 0,913 tapi bloknya beda).
  interface CityGeoProfile { p4: Set<string>; p3: Set<string>; p2: Set<string>; prefixes: Set<string>; kecamatanSet: Set<string> }
  const cityGeoProfile = new Map<string, CityGeoProfile>();
  kodePosList.forEach((kp) => {
    const ck = cityMatchKey(kp.kabupatenKota);
    if (!ck) return;
    let prof = cityGeoProfile.get(ck);
    if (!prof) { prof = { p4: new Set(), p3: new Set(), p2: new Set(), prefixes: new Set(), kecamatanSet: new Set() }; cityGeoProfile.set(ck, prof); }
    const code = String(kp.kodePos || '').trim();
    if (code.length >= 4) prof.p4.add(code.slice(0, 4));
    if (code.length >= 3) prof.p3.add(code.slice(0, 3));
    if (code.length >= 2) prof.p2.add(code.slice(0, 2));
    if (code) prof.prefixes.add(code);
    const kec = cityMatchKey(kp.kecamatan);
    if (kec) prof.kecamatanSet.add(kec);
  });
  const cityKeyByPrefix: Map<string, string[]>[] = [new Map(), new Map(), new Map()];
  cityGeoProfile.forEach((prof, ck) => {
    ([prof.p4, prof.p3, prof.p2] as Set<string>[]).forEach((set, i) => {
      set.forEach((p) => {
        const arr = cityKeyByPrefix[i].get(p) || [];
        if (!arr.includes(ck)) arr.push(ck);
        cityKeyByPrefix[i].set(p, arr);
      });
    });
  });
  const geoVerifiedCityKeys = new Set<string>();
  // Bukti blok: apakah kode pos ini benar-benar masuk wilayah kota tersebut?
  const codeConsistentWithCity = (ck: string, kp?: string): boolean => {
    const prof = cityGeoProfile.get(ck);
    if (!prof) return false;
    const code = String(kp || '').trim();
    if (code.length >= 4 && prof.p4.has(code.slice(0, 4))) return true;
    if (code.length >= 3 && prof.p3.has(code.slice(0, 3))) return true;
    if (code.length >= 2 && prof.p2.has(code.slice(0, 2))) return true;
    return code.length >= 5 && prof.prefixes.has(code);
  };
  type Placement = { rows: KodePosRow[]; status: 'VERIFIED' | 'REVIEW'; method: string };
  // Resolve (nama kota PTEN + kode pos PTEN) → baris kodepos kota yang tepat,
  // wajib lolos uji blok kode pos. Tidak bisa dibuktikan → REVIEW, bukan tebak.
  const resolveCityByGeocode = (ptenKey: string, ptenKodePos: string): Placement => {
    const exact = kodePosByCity.get(ptenKey);
    if (exact && exact.length > 0) {
      if (!ptenKodePos) return { rows: exact, status: 'REVIEW', method: 'Nama kota cocok, kode pos PTEN kosong' };
      // Nama kota bisa dimiliki 2 provinsi (master punya "BANJAR" Jabar 46xxx
      // DAN Banjar Kalsel 70xxx) → saring baris pada blok provinsi yang sama.
      const sameBlock = exact.filter((r) => String(r.kodePos || '').slice(0, 2) === ptenKodePos.slice(0, 2));
      const rowsForCity = sameBlock.length > 0 ? sameBlock : exact;
      if (!codeConsistentWithCity(ptenKey, ptenKodePos)) {
        return { rows: rowsForCity, status: 'REVIEW', method: `Blok ${ptenKodePos} bukan wilayah kota ini` };
      }
      geoVerifiedCityKeys.add(ptenKey);
      return { rows: rowsForCity, status: 'VERIFIED', method: sameBlock.length > 0 && sameBlock.length < exact.length ? 'Join nama kota + saring blok provinsi' : 'Join nama kota + blok kode pos' };
    }
    const kp = String(ptenKodePos || '').trim();
    if (kp.length >= 2) {
      const levels: { map: Map<string, string[]>; pre: string; name: string }[] = [
        { map: cityKeyByPrefix[0], pre: kp.slice(0, 4), name: '4-angka' },
        { map: cityKeyByPrefix[1], pre: kp.slice(0, 3), name: '3-angka' },
        { map: cityKeyByPrefix[2], pre: kp.slice(0, 2), name: '2-angka' },
      ];
      for (const lvl of levels) {
        const ckList = lvl.map.get(lvl.pre) || [];
        if (ckList.length === 0) continue;
        // a) nama kota cocok DI DALAM blok kode pos ini → bukti terkuat
        for (const ck of ckList) {
          if (calculateCityMatchScore(ptenKey, ck).score >= 0.9) {
            geoVerifiedCityKeys.add(ck);
            return { rows: kodePosByCity.get(ck)!, status: 'VERIFIED', method: `Blok ${lvl.name} + nama kota (${lvl.pre})` };
          }
        }
        // b) nama kecamatan PTEN dimiliki tepat satu kota di blok ini
        if (ptenKey.length >= 4) {
          const owners = ckList.filter((ck) => cityGeoProfile.get(ck)?.kecamatanSet.has(ptenKey));
          if (owners.length === 1) {
            geoVerifiedCityKeys.add(owners[0]);
            return { rows: kodePosByCity.get(owners[0])!, status: 'VERIFIED', method: `Blok ${lvl.name} + kecamatan (${lvl.pre})` };
          }
        }
        // c) blok menunjuk tepat satu kota KOMPAK (≤4 sub-blok)
        if (ckList.length === 1) {
          const onlyProf = cityGeoProfile.get(ckList[0]);
          if (onlyProf && onlyProf.p3.size <= 4) {
            geoVerifiedCityKeys.add(ckList[0]);
            return { rows: kodePosByCity.get(ckList[0])!, status: 'VERIFIED', method: `Blok ${lvl.name} tunggal (${lvl.pre})` };
          }
        }
        // d) blok milik banyak kota & nama tidak cocok → JANGAN menebak
        return { rows: [], status: 'REVIEW', method: `Blok ${lvl.name} (${lvl.pre}) punya ${ckList.length} kota, nama tak cocok` };
      }
      // e) blok tidak dikenal master (data beda vintage) → fuzzy ketat, WAJIB review
      const candidates: { ck: string; score: number }[] = [];
      cityGeoProfile.forEach((_, ck) => {
        const { score } = calculateCityMatchScore(ptenKey, ck);
        if (score >= 0.88) candidates.push({ ck, score });
      });
      candidates.sort((a, b) => b.score - a.score);
      if (candidates.length === 1) {
        return { rows: kodePosByCity.get(candidates[0].ck) || [], status: 'REVIEW', method: `Blok ${kp.slice(0, 2)}xx tak dikenal, mirip "${candidates[0].ck}"` };
      }
      return { rows: [], status: 'REVIEW', method: `Blok ${kp.slice(0, 2)}xx tidak ada di master kodepos` };
    }
    // Tanpa kode pos PTEN: fallback fuzzy ketat, wajib review
    let bestKey = '';
    let bestScore = 0;
    kodePosByCity.forEach((_, ck) => {
      const { score } = calculateCityMatchScore(ptenKey, ck);
      if (score > bestScore && score >= 0.88) { bestScore = score; bestKey = ck; }
    });
    return {
      rows: bestKey ? kodePosByCity.get(bestKey)! : [],
      status: 'REVIEW',
      method: bestKey ? `Tanpa kode pos PTEN, mirip nama "${bestKey}"` : 'Tanpa kode pos & nama kota tak dikenal',
    };
  };

  // Non-blocking helpers: yield to browser event loop so progress bar can render
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  // Memo caches — fuzzy matching is O(n*m) and expensive; identical inputs repeat heavily
  const ptenFuzzyCache = new Map<string, PTENRecord | null>();
  const kodePosCityCache = new Map<string, { rows: KodePosRow[]; status: 'VERIFIED' | 'REVIEW'; method: string }>();
  const roleMatchCache = new Map<string, { role: RoleMappingRecord | null; score: number; algorithm: string }>();
  const preCleanedRoles = roleMappingList.map((r) => ({ record: r, orgClean: cleanAndStandardizeText(r.organisasiTujuan) }));

  for (let i = 0; i < itemsToProcess.length; i++) {
    const raw = itemsToProcess[i];

    // Progress for Fase 1 (global 5% → 33%)
    if (i % 50 === 0 && onProgress) {
      const pct = Math.round(5 + (i / total) * 28);
      onProgress(1, pct, i + 1, total, `Fase 1: Mencocokkan PTEN & Kode Pos (${i + 1}/${total})...`);
    }
    // Yield every 20 rows so the browser can repaint the progress bar
    if (i % 20 === 0) await tick();

    const cityRaw = String(raw['Dati II'] || raw.Kota || raw.Kelurahan || '').trim();
    const cityClean = cityMatchKey(cityRaw);
    const kpRaw = String(raw['KODE POS'] || '').trim();

    // ── Cari PTEN Match ──
    let matchedPtenRecord: PTENRecord | null = null;
    if (ptenCityMap.has(cityClean)) {
      const candidates = ptenCityMap.get(cityClean)!;
      matchedPtenRecord = candidates.find((c) => c.kodePosPten === kpRaw) || candidates[0];
    } else if (ptenFuzzyCache.has(cityClean)) {
      matchedPtenRecord = ptenFuzzyCache.get(cityClean)!;
    } else {
      let bestScore = 0;
      for (const [ptenCityKey, candidates] of ptenCityMap.entries()) {
        const { score } = calculateCityMatchScore(cityClean, ptenCityKey);
        if (score > bestScore && score >= 0.88) {
          bestScore = score;
          matchedPtenRecord = candidates[0];
        }
      }
      ptenFuzzyCache.set(cityClean, matchedPtenRecord);
    }

    const finalKotaPten = matchedPtenRecord?.kotaPten || (cityRaw ? cityRaw.toUpperCase() : 'KOTA JAKARTA PUSAT');
    const finalKodePosPten = matchedPtenRecord?.kodePosPten || kpRaw || '10110';

    // ── Cari SEMUA Kelurahan & Kecamatan dari Data Kode Pos untuk Kota PTEN ini ──
    // Resolusi deterministik: nama kota join dulu, lalu DIBUKTIKAN dengan blok
    // kode pos (digit depan) + keanggotaan kecamatan. Kota yang tidak bisa
    // dibuktikan tidak akan ditebak → status "Perlu Review".
    const ptenCleanCity = cityMatchKey(finalKotaPten);
    const cachedPlacement = kodePosCityCache.get(ptenCleanCity);
    let matchedKodePosEntries: KodePosRow[];
    let placementStatus: 'VERIFIED' | 'REVIEW' | 'FALLBACK';
    let placementMethod: string;
    if (cachedPlacement) {
      matchedKodePosEntries = cachedPlacement.rows;
      placementStatus = cachedPlacement.status;
      placementMethod = cachedPlacement.method;
    } else {
      const placed = resolveCityByGeocode(ptenCleanCity, finalKodePosPten);
      matchedKodePosEntries = placed.rows;
      placementStatus = placed.status;
      placementMethod = placed.method;
      kodePosCityCache.set(ptenCleanCity, placed);
    }

    // Jika tidak ada di Kode Pos, buat 1 entry fallback dari data Master
    let usedFallback = false;
    if (matchedKodePosEntries.length === 0) {
      usedFallback = true;
      placementStatus = 'FALLBACK';
      placementMethod = `${placementMethod} → baris Master (tanpa data kodepos)`;
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
    const cachedRoleMatch = roleMatchCache.get(outletNameToMatch);
    if (cachedRoleMatch) {
      matchedRole = cachedRoleMatch.role;
      highestRoleScore = cachedRoleMatch.score;
      chosenAlgorithm = cachedRoleMatch.algorithm;
    } else {
      for (const { record: roleItem, orgClean } of preCleanedRoles) {
        const { score, algorithm } = calculateUnifiedPrecisionScore(outletNameToMatch, orgClean);
        if (score > highestRoleScore && score >= 0.75) {
          highestRoleScore = score;
          matchedRole = roleItem;
          chosenAlgorithm = algorithm;
        }
      }
      if (!matchedRole && roleMappingList.length > 0) {
        const cityKeywords = ptenCleanCity.split(/\s+/).filter(w => w.length > 2);
        for (const keyword of cityKeywords) {
          const found = preCleanedRoles.find(({ orgClean }) => orgClean.includes(keyword.toUpperCase()) || orgClean.includes(keyword));
          if (found) { matchedRole = found.record; highestRoleScore = 0.85; chosenAlgorithm = 'Geographic City Keyword Match'; break; }
        }
        if (!matchedRole) { matchedRole = roleMappingList[0]; highestRoleScore = 0.70; chosenAlgorithm = 'Default Fallback (First Available)'; }
      }
      roleMatchCache.set(outletNameToMatch, { role: matchedRole, score: highestRoleScore, algorithm: chosenAlgorithm });
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
      matchedKodePosEntries, matchedProvinsi, usedFallback,
      placementStatus, placementMethod,
      cityKey: ptenCleanCity, cityRawName: finalKotaPten,
      resolvedWilayah, sandiCabang, namaOutlet, statusOutlet, alamat,
      matchedRole, highestRoleScore, chosenAlgorithm,
      organisasiTujuan, tipeUnit, roleCabsal, roleCabapv1, roleCabapv2,
      is3RoleLengkap, alurWondr, flowDescription: flowDesc, confidenceScore, statusAnalisa,
    });
  }

  // ── EXPAND: Hasilkan 1 baris per kelurahan/kecamatan per Kota PTEN ──
  if (onProgress) onProgress(2, 35, 0, total, 'Fase 2: Menyusun data Wilayah & Cabang...');

  // Tracking cakupan: baris kodepos mana yang benar-benar masuk Fase 1
  const usedKodePosRows = new Set<KodePosRow>();
  let fallbackCityCount = 0;
  let reviewCityCount = 0;
  // Baris kodepos yang kotanya terbukti lewat join nama + verifikasi geocode
  let verifiedKodePosRows = 0;
  let reviewRow = 0;
  // Peta cakupan per kota (dipakai untuk laporan "kenapa jumlah ≠ 83.762")
  const includedCityMap = new Map<string, CoverageCity>();
  kodePosByCity.forEach((entries, ck) => {
    if (geoVerifiedCityKeys.has(ck)) verifiedKodePosRows += entries.length;
  });

  for (let i = 0; i < itemsToProcess.length; i++) {
    const raw = itemsToProcess[i];
    const meta = rowMetaCache[i];
    const prevRow = previousRows?.[i];

    // Tandai semua baris kodepos kota ini sebagai terpetakan (termasuk saat mode re-run)
    if (meta.usedFallback) fallbackCityCount++;
    else {
      for (const kp of meta.matchedKodePosEntries) usedKodePosRows.add(kp);
      if (meta.placementStatus === 'REVIEW') { reviewCityCount++; reviewRow += meta.matchedKodePosEntries.length; }
    }
    if (!includedCityMap.has(meta.cityKey)) {
      const first = meta.matchedKodePosEntries[0];
      includedCityMap.set(meta.cityKey, {
        city: meta.cityRawName,
        rows: meta.usedFallback ? 0 : meta.matchedKodePosEntries.length,
        status: meta.placementStatus,
        sampleKodePos: first?.kodePos || '',
        provinsi: first?.provinsi || meta.matchedProvinsi || '',
      });
    }

    // Progress for Fase 2 (global 35% → 66%)
    if (i % 50 === 0 && onProgress) {
      const pct = Math.round(35 + (i / total) * 31);
      onProgress(2, pct, i + 1, total, `Fase 2: Validasi Wilayah & Cabang (${i + 1}/${total})...`);
    }
    if (i % 50 === 0) await tick();

    // Jika mode "Ulangi yang Salah Saja", lewati baris yang sudah valid & disetujui
    if (reRunOnlyAnomalies && prevRow && prevRow.isFinalApproved && prevRow.statusAnalisa === 'EXACT_MATCH') {
      results.push(prevRow);
      continue;
    }

    const allKelurahanCount = meta.matchedKodePosEntries.length;

    // Hasilkan 1 baris per kelurahan/kecamatan
    meta.matchedKodePosEntries.forEach((kpEntry, seq) => {
      if (!meta.usedFallback) usedKodePosRows.add(kpEntry);
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
        placementStatus: meta.placementStatus,
        placementMethod: meta.placementMethod,
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
  const mappedKodePos = usedKodePosRows.size;
  const unmappedKodePos = Math.max(0, kodePosList.length - mappedKodePos);
  const verifiedRows = Math.max(0, verifiedKodePosRows - reviewRow);
  // Kota di master kodepos yang tidak ikut ke Fase 1 = penyebab jumlah < 83.762
  const unmappedCities: CoverageCity[] = [];
  kodePosByCity.forEach((entries, ck) => {
    if (entries.length === 0 || includedCityMap.has(ck)) return;
    unmappedCities.push({
      city: entries[0]?.kabupatenKota || ck,
      rows: entries.length,
      status: 'REVIEW',
      sampleKodePos: entries[0]?.kodePos || '',
      provinsi: entries[0]?.provinsi || '',
    });
  });
  unmappedCities.sort((a, b) => b.rows - a.rows);
  const coverage: AnalystCoverage = {
    kodePosTotal: kodePosList.length,
    kodePosMapped: mappedKodePos,
    verifiedRows,
    reviewRows: reviewRow,
    resultRows: results.length,
    unmappedCities,
    includedCities: Array.from(includedCityMap.values()).sort((a, b) => b.rows - a.rows),
  };
  const fmt = (n: number) => n.toLocaleString('id-ID');
  if (onProgress) {
    onProgress(3, 100, total, total, `Analisa 3 Fase selesai dalam ${elapsed}ms. ${fmt(results.length)} baris dihasilkan. ` +
      `KodePos terpetakan ${fmt(mappedKodePos)}/${fmt(kodePosList.length)} — terbukti geocode ${fmt(verifiedRows)}` +
      `${reviewRow > 0 ? `, perlu review ${fmt(reviewRow)}` : ''}` +
      `${unmappedKodePos > 0 ? `, belum masuk ${fmt(unmappedKodePos)} di ${unmappedCities.length} kota (kotanya tidak ada di PTEN)` : ''}` +
      `${reviewCityCount > 0 ? `. Kota perlu review manual: ${reviewCityCount}` : ''}` +
      `${fallbackCityCount > 0 ? `. Kota tanpa data kodepos (baris fallback): ${fallbackCityCount}` : ''}.`);
  }

  return { rows: results, coverage };
}
