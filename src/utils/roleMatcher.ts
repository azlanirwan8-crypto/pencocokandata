import type { RoleMappingRecord } from '../components/RoleMapping/RoleMappingManager';
import { getUnitCategory, getWondrRecommendation } from '../components/RoleMapping/RoleMappingManager';
import { cleanDati, cleanText } from './normalizer';

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
 * Normalizes branch name by stripping administrative prefixes and common noise.
 * Result is uppercase with only alphanumeric + spaces.
 */
export function normalizeBranchName(name: string): string {
  if (!name) return '';
  return name
    .toUpperCase()
    // 1. Bersihkan keterangan riwayat perubahan nama cabang (d/h = dahulu, ex = bekas, fka = formerly known as)
    .replace(/\b(D\/H|DH\/|D\s*\.\s*H|EX|FKA)\b[\s\S]*$/i, '')
    // 2. Bersihkan tipe unit administratif
    .replace(/\b(KC|KCP|KK|KANTOR CABANG|KANTOR CABANG PEMBANTU|KANTOR KAS|BRANCH OFFICE|SUB BRANCH|MAIN BRANCH|INDUK|SENTRA|OUTLET|KANTOR|CABANG)\b/g, '')
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

  const cleanBranch = normalizeBranchName(branchName);
  const cleanOutlet = normalizeBranchName(outletName || '');

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

  const cacheKey = `${cleanBranch}|${cleanOutlet}|${cleanCity}|${cleanKel}|${cleanKec}|${cleanProv.slice(0, 10)}|${cleanWil.slice(0, 10)}|${cleanAlm.slice(0, 30)}`;
  if (roleResolveCache.has(cacheKey)) {
    return roleResolveCache.get(cacheKey) || null;
  }

  let bestRecord: RoleMappingRecord | null = null;
  let bestScore = -1;

  for (const record of roleList) {
    const orgUpper = record.organisasiTujuan.toUpperCase();
    const orgClean = normalizeBranchName(record.organisasiTujuan);
    const orgNoSpace = noSpace(orgClean);
    const isKc = getUnitCategory(record.organisasiTujuan) === 'KC';
    let score = 0;

    // ── TIER 1: Exact normalized branch or outlet match (+ no-space variant) ─
    if (
      (cleanBranch && (orgClean === cleanBranch || (cleanBranchNoSpace.length >= 3 && orgNoSpace === cleanBranchNoSpace))) ||
      (cleanOutlet && (orgClean === cleanOutlet || (cleanOutletNoSpace.length >= 3 && orgNoSpace === cleanOutletNoSpace)))
    ) {
      score = 100;
    }

    // ── TIER 2: Sub-branch part matching ─────────────────────────────────
    if (orgUpper.includes(' - ')) {
      const dashIdx = orgUpper.indexOf(' - ');
      const parentPart = orgUpper.substring(0, dashIdx);
      const subPart = orgUpper.substring(dashIdx + 3);
      const subPartClean = normalizeBranchName(subPart);
      const subPartNoSpace = noSpace(subPartClean);
      const parentClean = normalizeBranchName(parentPart);
      const parentNoSpace = noSpace(parentClean);

      // Both Parent and Outlet match perfectly
      if (
        (cleanBranch && flexContains(parentClean, cleanBranch) && cleanOutlet && flexContains(subPartClean, cleanOutlet)) ||
        (cleanOutlet && flexContains(parentClean, cleanOutlet) && cleanBranch && flexContains(subPartClean, cleanBranch))
      ) {
        score = 100;
      }

      // Sub-branch vs outlet
      if (score < 99 && cleanOutlet && subPartClean.length >= 3) {
        if (flexMatch(subPartClean, cleanOutlet) || (subPartNoSpace.length >= 3 && subPartNoSpace === cleanOutletNoSpace)) {
          score = Math.max(score, 99);
        }
      }
      // Sub-branch vs branch
      if (score < 98 && cleanBranch && subPartClean.length >= 3) {
        if (flexMatch(subPartClean, cleanBranch) || (subPartNoSpace.length >= 3 && subPartNoSpace === cleanBranchNoSpace)) {
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

    // ── TIER 3: Substring containment (with no-space variants) ───────────
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

  // Fallback: only if NO score was produced at all (bestScore stays -1)
  if (!bestRecord && roleList.length > 0) {
    bestRecord = roleList.find((r) => getUnitCategory(r.organisasiTujuan) === 'KC') || roleList[0];
    bestScore = 35;
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
  s = s.replace(/\b(LETJEN\.|LETJEN|MAYJEN\.|MAYJEN|KOLONEL|KOL\.)\b/g, '');
  s = s.replace(/\b(PROF\.|PROFESOR|PROF|DR\.|DOKTER)\b/g, '');

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

  // 3. Singkatan Tempat / Kota Khusus (TANGSEL -> TANGERANG SELATAN, dll)
  s = s.replace(/\bTANGSEL\b/g, 'TANGERANG SELATAN');

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
      badgeBg: '#f3f4f6',
      badgeBorder: '#e5e7eb',
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
      badgeColor: '#6b7280',
      badgeBg: '#f3f4f6',
      badgeBorder: '#e5e7eb',
      cardBg: '#fcfdfe',
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

  // 3. Evaluasi Keselarasan Nama Unit (dengan normalisasi singkatan Indonesia & varian tanpa spasi)
  const cleanOutlet = normalizeIndonesianBranchAliases(normalizeBranchName(masterOutletRaw));
  const cleanCabang = normalizeIndonesianBranchAliases(normalizeBranchName(masterCabangRaw));
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

  // A. Exact Name Match (termasuk varian tanpa spasi & strip sandi angka)
  const isExactOrgMatch =
    (cleanOutlet && cleanRoleOrg === cleanOutlet) ||
    (cleanCabang && cleanRoleOrg === cleanCabang) ||
    (cleanCabangNoCode && cleanRoleOrg === cleanCabangNoCode) ||
    (cleanRoleOrgNoSpace && (
      (cleanOutletNoSpace && cleanRoleOrgNoSpace === cleanOutletNoSpace) ||
      (cleanCabangNoSpace && cleanRoleOrgNoSpace === cleanCabangNoSpace)
    ));

  // B. Sub-Branch Match (e.g. A Yani matches Ahmad Yani)
  const isSubMatch =
    (cleanOutlet && roleSubClean && (roleSubClean.includes(cleanOutlet) || cleanOutlet.includes(roleSubClean))) ||
    (cleanCabangNoCode && roleSubClean && (roleSubClean.includes(cleanCabangNoCode) || cleanCabangNoCode.includes(roleSubClean))) ||
    (cleanRoleOrgNoSpace && roleSubNoSpace && (
      (cleanOutletNoSpace && (roleSubNoSpace.includes(cleanOutletNoSpace) || cleanOutletNoSpace.includes(roleSubNoSpace))) ||
      (cleanCabangNoSpace && (roleSubNoSpace.includes(cleanCabangNoSpace) || cleanCabangNoSpace.includes(roleSubNoSpace)))
    ));

  // C. Parent Branch Match (e.g. Samarinda matches Samarinda)
  const isParentMatch =
    (cleanCabangNoCode && roleParentClean && (roleParentClean.includes(cleanCabangNoCode) || cleanCabangNoCode.includes(roleParentClean))) ||
    (cleanOutlet && roleParentClean && (roleParentClean.includes(cleanOutlet) || cleanOutlet.includes(roleParentClean))) ||
    (roleParentNoSpace && (
      (cleanOutletNoSpace && (roleParentNoSpace.includes(cleanOutletNoSpace) || cleanOutletNoSpace.includes(roleParentNoSpace))) ||
      (cleanCabangNoSpace && (roleParentNoSpace.includes(cleanCabangNoSpace) || cleanCabangNoSpace.includes(roleParentNoSpace)))
    ));

  // D. Substring Containment (dengan varian tanpa spasi)
  const isSubstringMatch =
    (cleanOutlet && cleanOutlet.length >= 3 && cleanRoleOrg.includes(cleanOutlet)) ||
    (cleanCabangNoCode && cleanCabangNoCode.length >= 3 && cleanRoleOrg.includes(cleanCabangNoCode)) ||
    (cleanRoleOrgNoSpace.length >= 3 && (
      (cleanOutletNoSpace.length >= 3 && (cleanRoleOrgNoSpace.includes(cleanOutletNoSpace) || cleanOutletNoSpace.includes(cleanRoleOrgNoSpace))) ||
      (cleanCabangNoSpace.length >= 3 && (cleanRoleOrgNoSpace.includes(cleanCabangNoSpace) || cleanCabangNoSpace.includes(cleanRoleOrgNoSpace)))
    ));

  let nameStatus: 'exact' | 'similar' | 'parent_match' | 'different' | 'none' = 'different';

  if (isExactOrgMatch || (cleanOutlet && cleanCabang && roleParentClean.includes(cleanCabang) && roleSubClean.includes(cleanOutlet))) {
    nameStatus = 'exact';
  } else if (isSubMatch) {
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
      badgeColor: '#059669',
      badgeBg: 'rgba(16, 185, 129, 0.1)',
      badgeBorder: 'rgba(16, 185, 129, 0.3)',
      cardBg: '#fcfdfe',
      cardBorder: '#e2e8f0',
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
      badgeColor: '#0284c7',
      badgeBg: 'rgba(14, 165, 233, 0.1)',
      badgeBorder: 'rgba(14, 165, 233, 0.3)',
      cardBg: '#f0f9ff',
      cardBorder: '#bae6fd',
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
      badgeColor: '#dc2626',
      badgeBg: 'rgba(239, 68, 68, 0.1)',
      badgeBorder: 'rgba(239, 68, 68, 0.3)',
      cardBg: 'rgba(239, 68, 68, 0.03)',
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
    badgeColor: '#d97706',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeBorder: 'rgba(245, 158, 11, 0.35)',
    cardBg: 'rgba(245, 158, 11, 0.03)',
    cardBorder: '#fcd34d',
    tooltip: `⚠️ Tipe unit berbeda: Master berstatus ${masterType} (${masterStatusRaw || '-'}), sedangkan Role berstatus ${roleType} (${roleTipeRaw || '-'}). Master: ${masterDisplay}`,
  };
}

