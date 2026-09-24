import type { RoleMappingRecord } from '../components/RoleMapping/RoleMappingManager';
import { getUnitCategory, getWondrRecommendation } from './roleHelpers';
import { cleanDati, cleanText, textSimilarityScore, UNIT_NOISE_TOKENS } from './normalizer';

/**
 * Daftar penanda tipe unit dipakai BERSAMA dengan sinyal Fase 1/2 (E3): sumber
 * kebenarannya satu, `normalizer.UNIT_NOISE_TOKENS`. Frasa dua kata ("KANTOR CABANG")
 * ikut hilang karena setiap kata diuji sendiri, persis seperti sebelumnya.
 */
const UNIT_NOISE_RE = new RegExp(`\\b(${[...UNIT_NOISE_TOKENS].sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');

/**
 * Standar Wilayah Administratif Pulau di Indonesia berdasarkan Provinsi/Teks
 *
 * Provinsi dinilai SENDIRIAN lebih dulu, baru nama kota/alamat. Urutannya penting:
 * nama kelurahan boleh mengandung nama pulau tanpa artinya baris itu ada di pulau itu.
 * Terukur 2026-09-24: "Jawa Maraja / Jawa Maraja Bah Jambi" (Kab. Simalungun, Sumatera
 * Utara, kode pos 21153) dulu disebut "asal Jawa" oleh aturan lama yang menguji
 * `provinsi + dati + teks` sekaligus dengan pola Jawa di depan — ±1.915 baris "Beda
 * Pulau" di kartu anomali sebagian adalah artefak penamaan itu.
 */
const PULAU_POLA: [string, RegExp][] = [
  ['Jawa', /JAKARTA|DKI|JAWA|BANTEN|YOGYAKARTA|DIY|BOGOR|BEKASI|DEPOK|TANGERANG|BANDUNG|SEMARANG|SURABAYA/],
  ['Sumatera', /SUMATERA|ACEH|RIAU|JAMBI|BENGKULU|LAMPUNG|BANGKA|MEDAN|PALEMBANG|PADANG/],
  ['Kalimantan', /KALIMANTAN|BANJARMASIN|PONTIANAK|BALIKPAPAN|SAMARINDA|BANJARBARU/],
  ['Sulawesi', /SULAWESI|GORONTALO|MAKASSAR|MANADO/],
  ['Bali', /BALI|DENPASAR|BADUNG/],
  ['Nusa Tenggara', /NUSA TENGGARA|NTB|NTT|MATARAM|KUPANG/],
  ['Maluku', /MALUKU|AMBON/],
  ['Papua', /PAPUA|JAYAPURA/],
];

export function getIslandFromProvinsi(prov?: string, dati?: string, textFallback?: string): string {
  const p = String(prov || '').toUpperCase().replace(/PROVINSI\s*/i, '').trim();
  const d = String(dati || '').toUpperCase();
  const t = String(textFallback || '').toUpperCase();

  for (const [pulau, pola] of PULAU_POLA) if (p && pola.test(p)) return pulau;
  const cadangan = `${d} ${t}`;
  for (const [pulau, pola] of PULAU_POLA) if (pola.test(cadangan)) return pulau;
  return 'Lainnya';
}

export interface ResolvedRoleMapping {
  organisasiRole: string;
  tipeUnitRole: 'Cabang Utama (KC)' | 'Outlet (KCP)';
  alurWondr: string;
  flowDescription: string;
  qrsCabsal: number;
  qrsCabapv1: number;
  qrsCabapv2: number;
  grandTotal: number;
  matchScore: number;
  matched: boolean;
}

/**
 * Ekstraksi seluruh nama alias / riwayat nama cabang (seperti d/h = dahulu, ex = bekas, fka = formerly known as)
 * Menghasilkan array string nama yang dinormalisasi: [namaUtama, ...namaDahulu]
 * Contoh: "PROKLAMASI PADANG D/H JALAN AHMAD YANI PADANG" -> ["PROKLAMASI PADANG", "JALAN AHMAD YANI PADANG"]
 */
export function extractBranchAliases(rawName: string): string[] {
  if (!rawName) return [];
  const s = String(rawName).trim();
  const dhRegex = /\b(?:D\/H|DH\/|D\s*\.\s*H|EX|FKA)\b/i;
  if (!dhRegex.test(s)) {
    return [s];
  }
  const parts = s.split(dhRegex).map((p) => p.trim()).filter(Boolean);
  return parts;
}

/**
 * Normalizes branch name by stripping administrative prefixes and common noise.
 * Result is uppercase with only alphanumeric + spaces.
 */
export function normalizeBranchName(name: string): string {
  if (!name) return '';
  return name
    .toUpperCase()
    // 0. Bersihkan nomor urut / bullet di awal (contoh: "9 • ", "1. ", "09 - ")
    .replace(/^[\d\s•\-\.\)]+/, '')
    // 1. Bersihkan keterangan riwayat perubahan nama cabang (d/h = dahulu, ex = bekas, fka = formerly known as)
    .replace(/\b(D\/H|DH\/|D\s*\.\s*H|EX|FKA)\b[\s\S]*$/i, '')
    // 2. Bersihkan tipe unit administratif (satu daftar dengan mesin lain, E3)
    .replace(UNIT_NOISE_RE, '')
    // 3. Bersihkan karakter non-alphanumeric (tanda hubung '-', titik '.', slash '/', dll menjadi spasi)
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes all spaces for no-space variant comparison.
 * Handles: "TOLI TOLI" === "TOLITOLI", "PEMATANG SIANTAR" === "PEMATANGSIANTAR", etc.
 */
function noSpace(s: string): string {
  return s.replace(/\s+/g, '');
}

/**
 * Smart multi-variant containment. Checks both spaced and no-space forms.
 * Fixes bug: "TOLI TOLI" (from TOLI-TOLI) not matching "TOLITOLI" in org name.
 */
function flexContains(haystack: string, needle: string): boolean {
  if (!haystack || !needle || needle.length < 3) return false;
  if (haystack.includes(needle)) return true;
  const nsHaystack = noSpace(haystack);
  const nsNeedle = noSpace(needle);
  if (nsNeedle.length >= 3 && nsHaystack.includes(nsNeedle)) return true;
  return false;
}

/** Bidirectional flex containment. */
function flexMatch(a: string, b: string): boolean {
  return flexContains(a, b) || flexContains(b, a);
}

/**
 * Compute Jaccard-like token-intersection ratio between two strings.
 * Returns 0.0–1.0. Only counts tokens with length >= minLen.
 */
function tokenIntersectionRatio(a: string, b: string, minLen = 3): number {
  if (!a || !b) return 0;
  const setA = new Set(a.split(/\s+/).filter((t) => t.length >= minLen));
  const setB = new Set(b.split(/\s+/).filter((t) => t.length >= minLen));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return intersection / Math.min(setA.size, setB.size);
}

/**
 * Smart Multi-Tier Role Mapping Resolver
 *
 * Score tiers (only results with score >= MIN_THRESHOLD are returned):
 *  100  — Exact normalized branch name match (incl. no-space variant)
 *   98  — Sub branch name in org matches cleaned branch name
 *   95  — Sub branch name matches kelurahan
 *   92  — Sub branch name matches kecamatan
 *   90  — Address contains sub branch name
 *   85  — Cleaned branch substring match in org name
 *   82  — Parent org part matches branch name or city
 *   80  — Address contains main org name tokens
 *   75  — City/Dati II matches KC record name (KC gets +5 bonus)
 *   60  — City/Dati II matches KCP record name
 *  <50  — Token intersection score (fallback only)
 */
const MIN_THRESHOLD = 30;

// High-performance in-memory cache for O(1) instant role resolution
const roleResolveCache = new Map<string, ResolvedRoleMapping | null>();
let lastRoleListRef: RoleMappingRecord[] | null = null;

export function resolveRoleMappingForBranch(
  branchName: string,
  dati2?: string,
  kelurahan?: string,
  kecamatan?: string,
  alamat?: string,
  roleList: RoleMappingRecord[] = [],
  outletName?: string,
  provinsi?: string,
  wilayah?: string
): ResolvedRoleMapping | null {
  if (!roleList || roleList.length === 0) return null;

  if (lastRoleListRef !== roleList) {
    roleResolveCache.clear();
    lastRoleListRef = roleList;
  }

  const branchAliases = extractBranchAliases(branchName).map(b => normalizeIndonesianBranchAliases(normalizeBranchName(b))).filter(Boolean);
  const outletAliases = extractBranchAliases(outletName || '').map(o => normalizeIndonesianBranchAliases(normalizeBranchName(o))).filter(Boolean);

  const cleanBranch = branchAliases[0] || normalizeBranchName(branchName);
  const cleanOutlet = outletAliases[0] || normalizeBranchName(outletName || '');

  // City: strip prefix → normalize → build no-space variant
  // FIX: "TOLI-TOLI" → cleanDati → "TOLI-TOLI" → strip [^A-Z0-9] → "TOLI TOLI"
  //       noSpace("TOLI TOLI") → "TOLITOLI" which matches "TOLITOLI BRANCH OFFICE"
  const cleanCity = cleanDati(dati2 || '')
    .replace(/^(KOTA|KABUPATEN|KAB|KODYA|ADM\.|ADM)\s+/i, '')
    .trim()
    .toUpperCase();
  const cleanCityNorm = normalizeBranchName(cleanCity);     // removes hyphens→space
  const cleanCityNoSpace = noSpace(cleanCityNorm);           // "TOLI TOLI" → "TOLITOLI"
  const cleanBranchNoSpace = noSpace(cleanBranch);
  const cleanOutletNoSpace = noSpace(cleanOutlet);

  const cleanKel = cleanText(kelurahan || '').toUpperCase();
  const cleanKec = cleanText(kecamatan || '').toUpperCase();
  const cleanAlm = cleanText(alamat || '').toUpperCase();
  const cleanProv = cleanText(provinsi || '').toUpperCase().replace(/^PROVINSI\s+/i, '');
  const cleanWil = cleanText(wilayah || '').toUpperCase();

  const cacheKey = `${cleanBranch}|${cleanOutlet}|${branchAliases.join('~')}|${outletAliases.join('~')}|${cleanCity}|${cleanKel}|${cleanKec}|${cleanProv.slice(0, 10)}|${cleanWil.slice(0, 10)}|${cleanAlm.slice(0, 30)}`;
  if (roleResolveCache.has(cacheKey)) {
    return roleResolveCache.get(cacheKey) || null;
  }

  let bestRecord: RoleMappingRecord | null = null;
  let bestScore = -1;

  for (const record of roleList) {
    const orgUpper = record.organisasiTujuan.toUpperCase();
    const orgClean = normalizeIndonesianBranchAliases(normalizeBranchName(record.organisasiTujuan));
    const orgNoSpace = noSpace(orgClean);
    const isKc = getUnitCategory(record.organisasiTujuan) === 'KC';
    let score = 0;

    // ── TIER 1: Exact direct match pada nama unit spesifik (Outlet) ─────
    const isDirectOutletMatch = outletAliases.some(o => o === orgClean || (o.length >= 3 && noSpace(o) === orgNoSpace));
    if (isDirectOutletMatch) {
      score = 105;
    }

    // ── TIER 2: Sub-branch part matching ─────────────────────────────────
    if (orgUpper.includes(' - ')) {
      const dashIdx = orgUpper.indexOf(' - ');
      const parentPart = orgUpper.substring(0, dashIdx);
      const subPart = orgUpper.substring(dashIdx + 3);
      const subPartClean = normalizeIndonesianBranchAliases(normalizeBranchName(subPart));
      const subPartNoSpace = noSpace(subPartClean);
      const parentClean = normalizeIndonesianBranchAliases(normalizeBranchName(parentPart));
      const parentNoSpace = noSpace(parentClean);

      // Both Parent and Outlet match perfectly (termasuk alias d/h seperti PADANG + AHMAD YANI)
      // Sub-branch match harus spesifik: alias outlet/cabang harus benar-benar menyebut nama sub-branch (misal: outlet mengandung "PASAR KABANJAHE" atau "AHMAD YANI")
      // BUKAN kebalikannya di mana subPart yang mengandung nama kota induk (misal subPart "PASAR KABANJAHE" mengandung "KABANJAHE")
      const parentMatched = branchAliases.some(b => flexContains(parentClean, b)) || outletAliases.some(o => flexContains(parentClean, o));
      const subMatchedExact = outletAliases.some(o => o === subPartClean || (subPartNoSpace.length >= 3 && subPartNoSpace === noSpace(o))) ||
                              branchAliases.some(b => b === subPartClean || (subPartNoSpace.length >= 3 && subPartNoSpace === noSpace(b)));
      const subMatchedSpecific = outletAliases.some(o => o.includes(subPartClean) || (subPartNoSpace.length >= 3 && noSpace(o).includes(subPartNoSpace))) ||
                                 branchAliases.some(b => b.includes(subPartClean) || (subPartNoSpace.length >= 3 && noSpace(b).includes(subPartNoSpace)));

      if (parentMatched && (subMatchedExact || subMatchedSpecific)) {
        score = 110; // Prioritas tertinggi mutlak: Cabang Induk DAN Sub-Branch/Alias sama persis!
      }

      // Sub-branch vs outlet spesifik (termasuk alias d/h dan fuzzy similarity >= 85%)
      if (score < 105 && subPartClean.length >= 3) {
        const anyOutletSub = outletAliases.some(o => o === subPartClean || o.includes(subPartClean) || (subPartNoSpace.length >= 3 && (noSpace(o) === subPartNoSpace || noSpace(o).includes(subPartNoSpace))) || textSimilarityScore(o, subPartClean) >= 0.85);
        if (anyOutletSub) {
          score = Math.max(score, 102);
        }
      }

      // Sub-branch vs branch
      if (score < 98 && subPartClean.length >= 3) {
        const anyBranchSub = branchAliases.some(b => b === subPartClean || b.includes(subPartClean) || (subPartNoSpace.length >= 3 && (noSpace(b) === subPartNoSpace || noSpace(b).includes(subPartNoSpace))) || textSimilarityScore(b, subPartClean) >= 0.85);
        if (anyBranchSub) {
          score = Math.max(score, 98);
        }
      }
      // Sub-branch vs kelurahan
      if (cleanKel && subPartClean.length >= 3) {
        if (flexMatch(subPartClean, cleanKel)) score = Math.max(score, 95);
      }
      // Sub-branch vs kecamatan
      if (cleanKec && subPartClean.length >= 3) {
        if (flexMatch(subPartClean, cleanKec)) score = Math.max(score, 92);
      }
      // Address contains sub-branch (Hanya jika bukan kata pulau/provinsi umum dan tidak bentrok kota/provinsi)
      const isGenericGeoWord = /^(SUMATERA|JAWA|KALIMANTAN|SULAWESI|PAPUA|BALI|MALUKU|INDONESIA)$/i.test(subPartClean);
      if (
        !isGenericGeoWord &&
        cleanAlm &&
        subPartClean.length >= 4 &&
        (cleanAlm.includes(subPartClean) || cleanAlm.includes(subPartNoSpace))
      ) {
        // Validasi: jika kota terisi, pastikan parent/org tidak bentrok kota lain
        const cityConflict = cleanCityNorm && parentClean && cleanCityNorm !== parentClean && !parentClean.includes(cleanCityNorm) && !cleanCityNorm.includes(parentClean);
        if (!cityConflict) {
          score = Math.max(score, 90);
        }
      }
      // Parent part vs branch name (with no-space fix)
      if (cleanBranch && parentClean.length >= 3) {
        if (flexMatch(parentClean, cleanBranch) || (parentNoSpace.length >= 3 && parentNoSpace === cleanBranchNoSpace)) {
          score = Math.max(score, 82);
        }
      }
      // ★ FIX: Parent part vs city — "TOLITOLI" parent must match "TOLI TOLI" city ★
      if (score < 82 && cleanCityNorm && parentClean.length >= 3) {
        if (flexMatch(parentClean, cleanCityNorm) || (parentNoSpace.length >= 3 && parentNoSpace === cleanCityNoSpace)) {
          score = Math.max(score, isKc ? 82 : 75);
        }
      }
    }

    // ── TIER 3: Match pada Cabang Induk (Branch / Kota), skor 90 (di bawah sub-branch spesifik) ──
    const isDirectBranchMatch = branchAliases.some(b => b === orgClean || (b.length >= 3 && noSpace(b) === orgNoSpace));
    if (score < 90 && isDirectBranchMatch) {
      score = 90;
    }

    // ── TIER 4: Substring containment (with no-space variants) ───────────
    if (score === 0) {
      if (cleanOutlet) {
        if (flexMatch(orgClean, cleanOutlet) || (cleanOutletNoSpace.length >= 3 && orgNoSpace === cleanOutletNoSpace)) score = 88;
      }
      if (score === 0 && cleanBranch) {
        if (flexMatch(orgClean, cleanBranch) || (cleanBranchNoSpace.length >= 3 && orgNoSpace === cleanBranchNoSpace)) score = 85;
      }
    }

    // ── TIER 4: Address scanning (bukan kata pulau umum dan tidak bentrok kota) ──
    if (score < 80 && cleanAlm && orgClean.length >= 4) {
      const isGenericOrg = /^(SUMATERA|JAWA|KALIMANTAN|SULAWESI|PAPUA|BALI|MALUKU)$/i.test(orgClean);
      const cityConflict = cleanCityNorm && orgClean && cleanCityNorm !== orgClean && !orgClean.includes(cleanCityNorm) && !cleanCityNorm.includes(orgClean);
      if (!isGenericOrg && !cityConflict && (cleanAlm.includes(orgClean) || cleanAlm.includes(orgNoSpace))) {
        score = Math.max(score, 80);
      }
    }

    // ── TIER 5: City / Dati II matching ★ MAIN FIX for TOLI-TOLI bug ★ ──
    // Checks both spaced ("TOLI TOLI") and no-space ("TOLITOLI") variants
    if (score === 0 && cleanCityNorm.length >= 3) {
      const cityHitsOrg =
        orgClean.includes(cleanCityNorm) ||
        cleanCityNorm.includes(orgClean) ||
        (cleanCityNoSpace.length >= 3 && (orgNoSpace.includes(cleanCityNoSpace) || cleanCityNoSpace.includes(orgNoSpace)));

      if (cityHitsOrg) {
        score = isKc ? 75 : 60;
      }
    }

    // ── TIER 6: Kelurahan/Kecamatan vs main org tokens ───────────────────
    if (score === 0) {
      if (cleanKel.length >= 3 && flexMatch(orgClean, cleanKel)) score = Math.max(score, 70);
      if (cleanKec.length >= 3 && flexMatch(orgClean, cleanKec)) score = Math.max(score, 65);
    }

    // ── TIER 7: Wilayah Kanwil token matching ────────────────────────────
    if (score === 0 && cleanWil.length >= 3) {
      const wilName = cleanWil.replace(/^WILAYAH\s*\d+\s*[-:]*\s*/i, '').trim();
      if (wilName && flexMatch(orgClean, wilName)) {
        score = isKc ? 55 : 45;
      }
    }

    // ── TIER 8: Province capital KC matching ─────────────────────────────
    if (score === 0 && cleanProv.length >= 3) {
      if (flexMatch(orgClean, cleanProv)) {
        score = isKc ? 50 : 40;
      }
    }

    // ── TIER 9: Token-intersection fallback ──────────────────────────────
    if (score === 0 && (cleanBranch.length >= 3 || cleanOutlet.length >= 3 || cleanCityNorm.length >= 3)) {
      const targetToken = cleanOutlet || cleanBranch || cleanCityNorm;
      const ratio = tokenIntersectionRatio(targetToken, orgClean, 3);
      if (ratio >= 0.4) {
        score = Math.round(ratio * 65);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRecord = record;
    }
  }

  if (bestRecord && bestScore >= MIN_THRESHOLD) {
    const isKc = getUnitCategory(bestRecord.organisasiTujuan) === 'KC';
    const wondr = getWondrRecommendation(bestRecord);

    const res: ResolvedRoleMapping = {
      organisasiRole: bestRecord.organisasiTujuan,
      tipeUnitRole: isKc ? 'Cabang Utama (KC)' : 'Outlet (KCP)',
      alurWondr: wondr.tier,
      flowDescription: wondr.desc,
      qrsCabsal: bestRecord.qrsCabsal,
      qrsCabapv1: bestRecord.qrsCabapv1,
      qrsCabapv2: bestRecord.qrsCabapv2,
      grandTotal: bestRecord.grandTotal,
      matchScore: bestScore,
      matched: true,
    };
    roleResolveCache.set(cacheKey, res);
    return res;
  }

  roleResolveCache.set(cacheKey, null);
  return null;
}

/**
 * Standarisasi singkatan nama pahlawan, jalan, dan istilah umum perbankan di Indonesia
 */
export function normalizeIndonesianBranchAliases(str: string): string {
  if (!str) return '';
  let s = str.toUpperCase().trim();
  // 1. Singkatan Jalan & Gelar
  s = s.replace(/\b(JL\.|JLN\.|JALAN|JL|JLN)\b/g, '');
  s = s.replace(/\b(JEND\.|JENDERAL|JEND)\b/g, '');
  s = s.replace(/\b(LETJEN\.|LETJEN|MAYJEN\.|MAYJEN|KOLONEL|KOL\.|KAPTEN|KAPT\.|MAYOR|MAY\.)\b/g, '');
  s = s.replace(/\b(PROF\.|PROFESOR|PROF|DR\.|DOKTER|DRS\.|DRS|IR\.|IR)\b/g, '');
  s = s.replace(/\b(KH\.|K\.H\.|KYAI\s+HAJI|HAJI|HJ\.|H\.)\b/g, '');

  // 2. Singkatan Nama Tokoh / Pahlawan
  s = s.replace(/\b(ACHMAD|ACH\.|ACH|AHM\.|AHM)\b/g, 'AHMAD');
  s = s.replace(/\bA\s+YANI\b|\bA\.?\s*YANI\b/g, 'AHMAD YANI');
  s = s.replace(/\b(M\.?\s*T\.?\s*HARYONO|MT\s+HARYONO)\b/g, 'MT HARYONO');
  s = s.replace(/\b(T\.?\s*B\.?\s*SIMATUPANG|TB\s+SIMATUPANG)\b/g, 'TB SIMATUPANG');
  s = s.replace(/\b(H\.?\s*R\.?\s*RASUNA\s+SAID|HR\s+RASUNA\s+SAID)\b/g, 'RASUNA SAID');
  s = s.replace(/\b(M\.?\s*H\.?\s*THAMRIN|MH\s+THAMRIN)\b/g, 'THAMRIN');
  s = s.replace(/\b(S\.?\s*PARMAN)\b/g, 'S PARMAN');
  s = s.replace(/\b(GATSU|GATOT\s+SUBROTO)\b/g, 'GATOT SUBROTO');
  s = s.replace(/\b(P\.?\s*DIPONEGORO)\b/g, 'DIPONEGORO');
  s = s.replace(/\b(I\.?\s*BONJOL)\b/g, 'IMAM BONJOL');
  s = s.replace(/\b(SULTAN\s+HASANUDDIN)\b/g, 'HASANUDDIN');
  s = s.replace(/\b(R\.?\s*E\.?\s*MARTADINATA|RE\s+MARTADINATA)\b/g, 'RE MARTADINATA');
  s = s.replace(/\b(W\.?\s*R\.?\s*SUPRATMAN|WR\s+SUPRATMAN)\b/g, 'WR SUPRATMAN');
  s = s.replace(/\b(D\.?\s*I\.?\s*PANJAITAN|DI\s+PANJAITAN)\b/g, 'DI PANJAITAN');
  s = s.replace(/\b(K\.?\s*H\.?\s*WASYID)\b/g, 'KH WASYID');
  s = s.replace(/\b(SUDIRMAN|P\.?\s*SUDIRMAN|PANGLIMA\s+SUDIRMAN)\b/g, 'SUDIRMAN');

  // 3. Singkatan Tempat / Wilayah Umum
  s = s.replace(/\bTANGSEL\b/g, 'TANGERANG SELATAN');
  s = s.replace(/\bJAKSEL\b/g, 'JAKARTA SELATAN');
  s = s.replace(/\bJAKBAR\b/g, 'JAKARTA BARAT');
  s = s.replace(/\bJAKPUS\b/g, 'JAKARTA PUSAT');
  s = s.replace(/\bJAKUT\b/g, 'JAKARTA UTARA');
  s = s.replace(/\bJAKTIM\b/g, 'JAKARTA TIMUR');
  s = s.replace(/\bBJB\b/g, 'BANJARBARU');
  s = s.replace(/\bBJM\b/g, 'BANJARMASIN');

  return s.replace(/\s+/g, ' ').trim();
}

export interface RoleMasterAuditResult {
  hasRole: boolean;
  hasMaster: boolean;
  isNameMatched: boolean;
  isTypeMatched: boolean;
  isFullyConsistent: boolean;
  nameStatus: 'exact' | 'similar' | 'parent_match' | 'different' | 'none';
  typeStatus: 'match' | 'mismatch' | 'none';
  masterType: 'KC' | 'KCP' | 'UNKNOWN';
  roleType: 'KC' | 'KCP' | 'UNKNOWN';
  masterDisplay: string;
  roleDisplay: string;
  badgeLabel: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  cardBg: string;
  cardBorder: string;
  tooltip: string;
}

/**
 * Membandingkan keselarasan Nama Outlet (Master), Status Outlet (Master), dan Cabang (Master)
 * dengan Data Mapping Role BNI (organisasiRole & tipeUnitRole).
 * Memberikan evaluasi ketat, warna status, informasi yang jelas (apa master seharusnya), dan tooltip.
 */
export function auditRoleMasterConsistency(row: {
  'Nama Outlet'?: string;
  'Status Outlet'?: string;
  Cabang?: string;
  'Sandi Cabang'?: string;
  organisasiRole?: string;
  tipeUnitRole?: string;
}): RoleMasterAuditResult {
  const masterOutletRaw = String(row['Nama Outlet'] || '').trim();
  const masterCabangRaw = String(row.Cabang || row['Sandi Cabang'] || '').trim();
  const masterStatusRaw = String(row['Status Outlet'] || '').trim().toUpperCase();
  const roleOrgRaw = String(row.organisasiRole || '').trim();
  const roleTipeRaw = String(row.tipeUnitRole || '').trim();

  const masterDisplay = [masterCabangRaw, masterOutletRaw].filter(Boolean).join(' - ') || '-';
  const roleDisplay = roleOrgRaw || '-';

  const hasMaster = Boolean(masterOutletRaw || masterCabangRaw);
  const hasRole = Boolean(roleOrgRaw);

  if (!hasMaster && !hasRole) {
    return {
      hasRole: false,
      hasMaster: false,
      isNameMatched: true,
      isTypeMatched: true,
      isFullyConsistent: true,
      nameStatus: 'none',
      typeStatus: 'none',
      masterType: 'UNKNOWN',
      roleType: 'UNKNOWN',
      masterDisplay,
      roleDisplay,
      badgeLabel: '-',
      badgeColor: '#878a99',
      badgeBg: '#f8f9fa',
      badgeBorder: '#e9ebec',
      cardBg: '#ffffff',
      cardBorder: '#e9ebec',
      tooltip: 'Tidak ada data master dan role',
    };
  }

  if (!hasMaster || !hasRole) {
    return {
      hasRole,
      hasMaster,
      isNameMatched: false,
      isTypeMatched: false,
      isFullyConsistent: false,
      nameStatus: 'none',
      typeStatus: 'none',
      masterType: 'UNKNOWN',
      roleType: 'UNKNOWN',
      masterDisplay,
      roleDisplay,
      badgeLabel: hasRole ? 'Belum Ada Master' : 'Belum Terpetakan',
      badgeColor: '#6c757d',
      badgeBg: '#f8f9fa',
      badgeBorder: '#e9ebec',
      cardBg: '#f9fbfd',
      cardBorder: '#e9ecef',
      tooltip: hasRole ? 'Mapping role terisi namun data master kosong' : 'Data master ada namun belum terpetakan ke mapping role',
    };
  }

  // 1. Ekstraksi Tipe Unit Master (KCP/KK dicek lebih dulu untuk mencegah salah klasifikasi)
  let masterType: 'KC' | 'KCP' | 'UNKNOWN' = 'UNKNOWN';
  if (
    masterStatusRaw === 'KCP' ||
    masterStatusRaw === 'KK' ||
    masterStatusRaw.includes('KCP') ||
    masterStatusRaw.includes('KK') ||
    masterStatusRaw.includes('KANTOR KAS') ||
    masterStatusRaw.includes('PEMBANTU') ||
    masterStatusRaw.includes('SUB BRANCH') ||
    masterStatusRaw.includes('OUTLET') ||
    masterStatusRaw.includes('KLN')
  ) {
    masterType = 'KCP';
  } else if (
    masterStatusRaw === 'KC' ||
    masterStatusRaw.includes('CABANG UTAMA') ||
    masterStatusRaw.includes('BRANCH OFFICE') ||
    masterStatusRaw.includes('KANWIL')
  ) {
    masterType = 'KC';
  } else {
    const combinedMasterText = `${masterOutletRaw} ${masterCabangRaw}`.toUpperCase();
    if (/\b(KCP|KK|KAS|KLN|PEMBANTU)\b/.test(combinedMasterText)) {
      masterType = 'KCP';
    } else if (/\b(KC|UTAMA|BRANCH OFFICE)\b/.test(combinedMasterText)) {
      masterType = 'KC';
    }
  }

  // 2. Ekstraksi Tipe Unit Role
  let roleType: 'KC' | 'KCP' | 'UNKNOWN' = 'UNKNOWN';
  const roleTipeUpper = roleTipeRaw.toUpperCase();
  const orgCategory = getUnitCategory(roleOrgRaw);

  if (
    roleTipeUpper.includes('KCP') ||
    roleTipeUpper.includes('OUTLET') ||
    roleTipeUpper.includes('SUB BRANCH') ||
    roleTipeUpper.includes('KANTOR KAS') ||
    orgCategory === 'KCP'
  ) {
    roleType = 'KCP';
  } else if (
    roleTipeUpper.includes('KC') ||
    roleTipeUpper.includes('UTAMA') ||
    roleTipeUpper.includes('BRANCH OFFICE') ||
    orgCategory === 'KC'
  ) {
    roleType = 'KC';
  }

  // 3. Evaluasi Keselarasan Nama Unit (dengan normalisasi singkatan Indonesia & varian tanpa spasi & alias d/h)
  const outletAliases = extractBranchAliases(masterOutletRaw).map(o => normalizeIndonesianBranchAliases(normalizeBranchName(o))).filter(Boolean);
  const cabangAliases = extractBranchAliases(masterCabangRaw).map(c => normalizeIndonesianBranchAliases(normalizeBranchName(c))).filter(Boolean);

  const cleanOutlet = outletAliases[0] || normalizeIndonesianBranchAliases(normalizeBranchName(masterOutletRaw));
  const cleanCabang = cabangAliases[0] || normalizeIndonesianBranchAliases(normalizeBranchName(masterCabangRaw));
  const cleanRoleOrg = normalizeIndonesianBranchAliases(normalizeBranchName(roleOrgRaw));

  // Versi strip angka (sandi cabang seperti '197 TOLI TOLI' -> 'TOLI TOLI')
  const cleanCabangNoCode = cleanCabang.replace(/^\d+\s*/, '').trim();

  // Versi tanpa spasi (mengatasi 'TOLI TOLI' vs 'TOLITOLI')
  const cleanOutletNoSpace = noSpace(cleanOutlet);
  const cleanCabangNoSpace = noSpace(cleanCabangNoCode || cleanCabang);
  const cleanRoleOrgNoSpace = noSpace(cleanRoleOrg);

  let roleParentClean = '';
  let roleSubClean = '';
  let roleParentNoSpace = '';
  let roleSubNoSpace = '';
  if (roleOrgRaw.toUpperCase().includes(' - ')) {
    const parts = roleOrgRaw.toUpperCase().split(' - ');
    roleParentClean = normalizeIndonesianBranchAliases(normalizeBranchName(parts[0] || ''));
    roleSubClean = normalizeIndonesianBranchAliases(normalizeBranchName(parts[1] || ''));
    roleParentNoSpace = noSpace(roleParentClean);
    roleSubNoSpace = noSpace(roleSubClean);
  }

  // A. Exact Name Match (termasuk varian tanpa spasi, strip sandi angka, dan semua alias d/h)
  const isExactOrgMatch =
    outletAliases.some(o => cleanRoleOrg === o || (cleanRoleOrgNoSpace.length >= 3 && cleanRoleOrgNoSpace === noSpace(o))) ||
    cabangAliases.some(c => {
      const cNoCode = c.replace(/^\d+\s*/, '').trim();
      return cleanRoleOrg === c || cleanRoleOrg === cNoCode || (cleanRoleOrgNoSpace.length >= 3 && (cleanRoleOrgNoSpace === noSpace(c) || cleanRoleOrgNoSpace === noSpace(cNoCode)));
    });

  // B. Sub-Branch Match (e.g. A Yani matches Ahmad Yani, Ahmad Yani Padang matches Jl A Yani Padang)
  const isSubMatch =
    (roleSubClean && outletAliases.some(o => roleSubClean.includes(o) || o.includes(roleSubClean))) ||
    (roleSubClean && cabangAliases.some(c => {
      const cNoCode = c.replace(/^\d+\s*/, '').trim();
      return roleSubClean.includes(c) || c.includes(roleSubClean) || roleSubClean.includes(cNoCode) || cNoCode.includes(roleSubClean);
    })) ||
    (cleanRoleOrgNoSpace && roleSubNoSpace && (
      outletAliases.some(o => roleSubNoSpace.includes(noSpace(o)) || noSpace(o).includes(roleSubNoSpace)) ||
      cabangAliases.some(c => {
        const cNoSpace = noSpace(c.replace(/^\d+\s*/, '').trim());
        return roleSubNoSpace.includes(cNoSpace) || cNoSpace.includes(roleSubNoSpace);
      })
    ));

  // C. Parent Branch Match (e.g. Samarinda matches Samarinda)
  const isParentMatch =
    (cleanCabangNoCode && roleParentClean && (roleParentClean.includes(cleanCabangNoCode) || cleanCabangNoCode.includes(roleParentClean))) ||
    (cleanOutlet && roleParentClean && (roleParentClean.includes(cleanOutlet) || cleanOutlet.includes(roleParentClean))) ||
    (roleParentNoSpace && (
      (cleanOutletNoSpace && (roleParentNoSpace.includes(cleanOutletNoSpace) || cleanOutletNoSpace.includes(roleParentNoSpace))) ||
      (cleanCabangNoSpace && (roleParentNoSpace.includes(cleanCabangNoSpace) || cleanCabangNoSpace.includes(roleParentNoSpace)))
    ));

  // D. Substring Containment (dengan varian tanpa spasi dan alias)
  const isSubstringMatch =
    outletAliases.some(o => o.length >= 3 && cleanRoleOrg.includes(o)) ||
    (cleanCabangNoCode && cleanCabangNoCode.length >= 3 && cleanRoleOrg.includes(cleanCabangNoCode)) ||
    (cleanRoleOrgNoSpace.length >= 3 && (
      outletAliases.some(o => noSpace(o).length >= 3 && (cleanRoleOrgNoSpace.includes(noSpace(o)) || noSpace(o).includes(cleanRoleOrgNoSpace))) ||
      (cleanCabangNoSpace.length >= 3 && (cleanRoleOrgNoSpace.includes(cleanCabangNoSpace) || cleanCabangNoSpace.includes(cleanRoleOrgNoSpace)))
    ));

  // E. Fuzzy / Similarity Match (toleransi typo/perbedaan ejaan >= 85%, misal: SANGATA vs SANGATTA)
  const isFuzzySimilarityMatch =
    (roleSubClean && outletAliases.some(o => textSimilarityScore(o, roleSubClean) >= 0.85)) ||
    outletAliases.some(o => textSimilarityScore(o, cleanRoleOrg) >= 0.85) ||
    (cleanCabangNoCode && textSimilarityScore(cleanCabangNoCode, cleanRoleOrg) >= 0.85) ||
    (cleanCabangNoCode && roleParentClean && textSimilarityScore(cleanCabangNoCode, roleParentClean) >= 0.85);

  let nameStatus: 'exact' | 'similar' | 'parent_match' | 'different' | 'none' = 'different';

  if (isExactOrgMatch || (cleanOutlet && cleanCabang && roleParentClean.includes(cleanCabang) && roleSubClean.includes(cleanOutlet))) {
    nameStatus = 'exact';
  } else if (isSubMatch) {
    nameStatus = 'similar';
  } else if (isFuzzySimilarityMatch) {
    nameStatus = 'similar';
  } else if (isParentMatch) {
    nameStatus = 'parent_match';
  } else if (isSubstringMatch) {
    nameStatus = 'similar';
  } else {
    nameStatus = 'different';
  }

  const isNameMatched = nameStatus !== 'different';

  // 4. Evaluasi Keselarasan Tipe Unit
  let typeStatus: 'match' | 'mismatch' | 'none' = 'none';
  if (masterType !== 'UNKNOWN' && roleType !== 'UNKNOWN') {
    typeStatus = masterType === roleType ? 'match' : 'mismatch';
  } else {
    typeStatus = 'match';
  }

  const isTypeMatched = typeStatus !== 'mismatch';
  const isFullyConsistent = (nameStatus === 'exact' || nameStatus === 'similar') && isTypeMatched;

  // 5. Tentukan Gaya Warna, Pesan, dan Tooltip
  if (isFullyConsistent) {
    return {
      hasRole: true,
      hasMaster: true,
      isNameMatched,
      isTypeMatched: true,
      isFullyConsistent: true,
      nameStatus,
      typeStatus,
      masterType,
      roleType,
      masterDisplay,
      roleDisplay,
      badgeLabel: '✓ Sesuai Master',
      badgeColor: '#0ab39c',
      badgeBg: 'rgba(10,179,156, 0.1)',
      badgeBorder: 'rgba(10,179,156, 0.3)',
      cardBg: '#f9fbfd',
      cardBorder: '#e9ebec',
      tooltip: `✓ Unit & Status sesuai Master (Master: ${masterDisplay})`,
    };
  }

  // Jika Cabang Induk Sama (e.g. Master Samarinda ↔ Role Samarinda - A Yani)
  if (nameStatus === 'parent_match') {
    return {
      hasRole: true,
      hasMaster: true,
      isNameMatched,
      isTypeMatched,
      isFullyConsistent: isTypeMatched,
      nameStatus: 'parent_match',
      typeStatus,
      masterType,
      roleType,
      masterDisplay,
      roleDisplay,
      badgeLabel: `✓ Induk ${masterCabangRaw || cleanCabang}`,
      badgeColor: '#299cdb',
      badgeBg: 'rgba(41,156,219, 0.1)',
      badgeBorder: 'rgba(41,156,219, 0.3)',
      cardBg: '#f0f9ff',
      cardBorder: '#d5eef8',
      tooltip: `✓ Cabang Induk Sesuai: ${masterCabangRaw || cleanCabang} (Master: ${masterDisplay} | Role: ${roleDisplay})`,
    };
  }

  // Jika Nama Benar-benar Berbeda
  if (nameStatus === 'different') {
    return {
      hasRole: true,
      hasMaster: true,
      isNameMatched,
      isTypeMatched,
      isFullyConsistent: false,
      nameStatus,
      typeStatus,
      masterType,
      roleType,
      masterDisplay,
      roleDisplay,
      badgeLabel: '⚠️ Unit Beda dgn Master',
      badgeColor: '#f06548',
      badgeBg: 'rgba(240,101,72, 0.1)',
      badgeBorder: 'rgba(240,101,72, 0.3)',
      cardBg: 'rgba(240,101,72, 0.03)',
      cardBorder: '#fca5a5',
      tooltip: `⚠️ Nama Unit Mapping Role (${roleOrgRaw}) berbeda dengan Master (${masterDisplay}). Seharusnya Master: ${masterDisplay}`,
    };
  }

  // Kasus Beda Tipe
  return {
    hasRole: true,
    hasMaster: true,
    isNameMatched,
    isTypeMatched: false,
    isFullyConsistent: false,
    nameStatus,
    typeStatus,
    masterType,
    roleType,
    masterDisplay,
    roleDisplay,
    badgeLabel: `⚠️ Beda Tipe (${masterType} vs ${roleType})`,
    badgeColor: '#d68b0c',
    badgeBg: 'rgba(247,184,75, 0.12)',
    badgeBorder: 'rgba(247,184,75, 0.35)',
    cardBg: 'rgba(247,184,75, 0.03)',
    cardBorder: '#f7b84b',
    tooltip: `⚠️ Tipe unit berbeda: Master berstatus ${masterType} (${masterStatusRaw || '-'}), sedangkan Role berstatus ${roleType} (${roleTipeRaw || '-'}). Master: ${masterDisplay}`,
  };
}

