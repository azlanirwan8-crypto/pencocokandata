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
    .replace(/\b(KC|KCP|KK|KANTOR CABANG|KANTOR CABANG PEMBANTU|KANTOR KAS|BRANCH OFFICE|SUB BRANCH|MAIN BRANCH|INDUK|SENTRA)\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  // Use smaller set as denominator (precision-oriented)
  return intersection / Math.min(setA.size, setB.size);
}

/**
 * Smart Multi-Tier Role Mapping Resolver
 *
 * Score tiers (only results with score >= MIN_THRESHOLD are returned):
 *  100  — Exact normalized branch name match
 *   98  — Sub branch name in org matches cleaned branch name
 *   95  — Sub branch name matches kelurahan
 *   92  — Sub branch name matches kecamatan
 *   90  — Address contains sub branch name
 *   85  — Cleaned branch substring match in org name
 *   80  — Address contains main org name tokens
 *   75  — City/Dati II matches KC record name (KC gets +5 bonus)
 *   60  — City/Dati II matches KCP record name
 *  <50  — Token intersection score (fallback only, requires ratio >= 0.5)
 */
const MIN_THRESHOLD = 50;

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
  outletName?: string
): ResolvedRoleMapping | null {
  if (!roleList || roleList.length === 0) return null;

  if (lastRoleListRef !== roleList) {
    roleResolveCache.clear();
    lastRoleListRef = roleList;
  }

  const cleanBranch = normalizeBranchName(branchName);
  const cleanOutlet = normalizeBranchName(outletName || '');
  const cleanCity = cleanDati(dati2 || '')
    .replace(/^(KOTA|KABUPATEN|KAB)\s+/i, '')
    .trim()
    .toUpperCase();
  const cleanKel = cleanText(kelurahan || '').toUpperCase();
  const cleanKec = cleanText(kecamatan || '').toUpperCase();
  const cleanAlm = cleanText(alamat || '').toUpperCase();

  const cacheKey = `${cleanBranch}|${cleanOutlet}|${cleanCity}|${cleanKel}|${cleanKec}|${cleanAlm.slice(0, 30)}`;
  if (roleResolveCache.has(cacheKey)) {
    return roleResolveCache.get(cacheKey) || null;
  }

  let bestRecord: RoleMappingRecord | null = null;
  let bestScore = -1;

  for (const record of roleList) {
    const orgUpper = record.organisasiTujuan.toUpperCase();
    const orgClean = normalizeBranchName(record.organisasiTujuan);
    let score = 0;

    // ── TIER 1: Exact normalized branch or outlet match ──────────────────
    if ((cleanBranch && orgClean === cleanBranch) || (cleanOutlet && orgClean === cleanOutlet)) {
      score = 100;
    }

    // ── TIER 2: Sub-branch part matching (e.g. BANJARMASIN BRANCH OFFICE - PASAR BARU SUB BRANCH) ──
    if (orgUpper.includes(' - ')) {
      const dashIdx = orgUpper.indexOf(' - ');
      const parentPart = orgUpper.substring(0, dashIdx);
      const subPart = orgUpper.substring(dashIdx + 3);
      const subPartClean = normalizeBranchName(subPart);
      const parentClean = normalizeBranchName(parentPart);

      // Both Parent and Outlet match perfectly (e.g. Cabang BANJARMASIN + Outlet PASAR BARU)
      if (
        (cleanBranch && parentClean.includes(cleanBranch) && cleanOutlet && subPartClean.includes(cleanOutlet)) ||
        (cleanOutlet && parentClean.includes(cleanOutlet) && cleanBranch && subPartClean.includes(cleanBranch))
      ) {
        score = 100;
      }

      // Sub-branch name vs outlet name
      if (score < 99 && cleanOutlet && subPartClean.length >= 3) {
        if (subPartClean === cleanOutlet || subPartClean.includes(cleanOutlet) || cleanOutlet.includes(subPartClean)) {
          score = Math.max(score, 99);
        }
      }

      // Sub-branch name vs branch name
      if (score < 98 && cleanBranch && subPartClean.length >= 3) {
        if (subPartClean === cleanBranch || subPartClean.includes(cleanBranch) || cleanBranch.includes(subPartClean)) {
          score = Math.max(score, 98);
        }
      }
      // Sub-branch name vs kelurahan
      if (cleanKel && subPartClean.length >= 3) {
        if (subPartClean.includes(cleanKel) || cleanKel.includes(subPartClean)) {
          score = Math.max(score, 95);
        }
      }
      // Sub-branch name vs kecamatan
      if (cleanKec && subPartClean.length >= 3) {
        if (subPartClean.includes(cleanKec) || cleanKec.includes(subPartClean)) {
          score = Math.max(score, 92);
        }
      }
      // Address contains sub-branch part
      if (cleanAlm && subPartClean.length >= 4 && cleanAlm.includes(subPartClean)) {
        score = Math.max(score, 90);
      }
      // Parent part vs branch name (e.g., MATARAM vs KC MATARAM)
      if (cleanBranch && parentClean.length >= 3) {
        if (parentClean === cleanBranch || parentClean.includes(cleanBranch) || cleanBranch.includes(parentClean)) {
          score = Math.max(score, 82);
        }
      }
    }

    // ── TIER 3: Substring containment ─────────────────────────────────────
    if (score === 0) {
      if (cleanOutlet) {
        const outletInOrg = orgClean.includes(cleanOutlet);
        const orgInOutlet = cleanOutlet.includes(orgClean) && orgClean.length >= 4;
        if (outletInOrg || orgInOutlet) score = 88;
      }
      if (score === 0 && cleanBranch) {
        const branchInOrg = orgClean.includes(cleanBranch);
        const orgInBranch = cleanBranch.includes(orgClean) && orgClean.length >= 4;
        if (branchInOrg || orgInBranch) score = 85;
      }
    }

    // ── TIER 4: Address scanning ─────────────────────────────────────────
    if (score < 80 && cleanAlm && orgClean.length >= 4) {
      if (cleanAlm.includes(orgClean)) {
        score = Math.max(score, 80);
      }
    }

    // ── TIER 5: City / Dati II matching to nearest branch office ─────────
    if (score === 0 && cleanCity.length >= 3) {
      if (orgClean.includes(cleanCity) || cleanCity.includes(orgClean)) {
        const isKc = getUnitCategory(record.organisasiTujuan) === 'KC';
        score = isKc ? 75 : 60;
      }
    }

    // ── TIER 6: Kelurahan/Kecamatan vs main (non-sub) org tokens ─────────
    if (score === 0) {
      if (cleanKel.length >= 3 && orgClean.includes(cleanKel)) score = Math.max(score, 70);
      if (cleanKec.length >= 3 && orgClean.includes(cleanKec)) score = Math.max(score, 65);
    }

    // ── TIER 7: Token-intersection fallback ──────────────────────────────
    if (score === 0 && (cleanBranch.length >= 3 || cleanOutlet.length >= 3)) {
      const targetToken = cleanOutlet || cleanBranch;
      const ratio = tokenIntersectionRatio(targetToken, orgClean, 3);
      if (ratio >= 0.5) {
        score = Math.round(ratio * 70);
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

export interface RoleMasterAuditResult {
  hasRole: boolean;
  hasMaster: boolean;
  isNameMatched: boolean;
  isTypeMatched: boolean;
  isFullyConsistent: boolean;
  nameStatus: 'exact' | 'similar' | 'different' | 'none';
  typeStatus: 'match' | 'mismatch' | 'none';
  masterType: 'KC' | 'KCP' | 'UNKNOWN';
  roleType: 'KC' | 'KCP' | 'UNKNOWN';
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
 * Memberikan evaluasi ketat, warna status, dan tooltip peringatan jika terdapat ketidakcocokan.
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
      badgeLabel: hasRole ? 'Belum Ada Master' : 'Belum Terpetakan',
      badgeColor: '#6b7280',
      badgeBg: '#f3f4f6',
      badgeBorder: '#e5e7eb',
      cardBg: '#fcfdfe',
      cardBorder: '#e9ecef',
      tooltip: hasRole ? 'Mapping role terisi namun data master kosong' : 'Data master ada namun belum terpetakan ke mapping role',
    };
  }

  // 1. Ekstraksi Tipe Unit Master
  let masterType: 'KC' | 'KCP' | 'UNKNOWN' = 'UNKNOWN';
  if (
    masterStatusRaw === 'KC' ||
    masterStatusRaw.includes('CABANG UTAMA') ||
    masterStatusRaw.includes('BRANCH OFFICE') ||
    masterStatusRaw.includes('KANWIL')
  ) {
    masterType = 'KC';
  } else if (
    masterStatusRaw === 'KCP' ||
    masterStatusRaw === 'KK' ||
    masterStatusRaw.includes('KANTOR KAS') ||
    masterStatusRaw.includes('PEMBANTU') ||
    masterStatusRaw.includes('SUB BRANCH') ||
    masterStatusRaw.includes('OUTLET') ||
    masterStatusRaw.includes('KLN')
  ) {
    masterType = 'KCP';
  } else {
    // Coba tebak dari teks nama outlet & cabang
    const combinedMasterText = `${masterOutletRaw} ${masterCabangRaw}`.toUpperCase();
    if (/\b(KCP|KK|KAS|KLN|PEMBANTU)\b/.test(combinedMasterText)) {
      masterType = 'KCP';
    } else if (/\b(KC|UTAMA|BRANCH OFFICE)\b/.test(combinedMasterText)) {
      masterType = 'KC';
    }
  }

  // 2. Ekstraksi Tipe Unit Role
  let roleType: 'KC' | 'KCP' | 'UNKNOWN' = 'UNKNOWN';
  if (roleTipeRaw.includes('KC') || roleTipeRaw.includes('Utama') || getUnitCategory(roleOrgRaw) === 'KC') {
    roleType = 'KC';
  } else if (roleTipeRaw.includes('KCP') || roleTipeRaw.includes('Outlet') || getUnitCategory(roleOrgRaw) === 'KCP') {
    roleType = 'KCP';
  }

  // 3. Evaluasi Keselarasan Nama Unit
  const cleanOutlet = normalizeBranchName(masterOutletRaw);
  const cleanCabang = normalizeBranchName(masterCabangRaw);
  const cleanRoleOrg = normalizeBranchName(roleOrgRaw);

  let nameStatus: 'exact' | 'similar' | 'different' | 'none' = 'different';

  let roleParentClean = '';
  let roleSubClean = '';
  if (roleOrgRaw.toUpperCase().includes(' - ')) {
    const parts = roleOrgRaw.toUpperCase().split(' - ');
    roleParentClean = normalizeBranchName(parts[0] || '');
    roleSubClean = normalizeBranchName(parts[1] || '');
  }

  // Cek apakah ada kecocokan nama
  const isExactOrgMatch =
    (cleanOutlet && cleanRoleOrg === cleanOutlet) ||
    (cleanCabang && cleanRoleOrg === cleanCabang);

  const isSubMatch =
    (cleanOutlet && roleSubClean && (roleSubClean.includes(cleanOutlet) || cleanOutlet.includes(roleSubClean))) ||
    (cleanCabang && roleParentClean && (roleParentClean.includes(cleanCabang) || cleanCabang.includes(roleParentClean)));

  const isSubstringMatch =
    (cleanOutlet && cleanOutlet.length >= 3 && cleanRoleOrg.includes(cleanOutlet)) ||
    (cleanCabang && cleanCabang.length >= 3 && cleanRoleOrg.includes(cleanCabang));

  if (isExactOrgMatch || (cleanOutlet && cleanCabang && roleParentClean.includes(cleanCabang) && roleSubClean.includes(cleanOutlet))) {
    nameStatus = 'exact';
  } else if (isSubMatch || isSubstringMatch) {
    nameStatus = 'similar';
  } else {
    nameStatus = 'different';
  }

  const isNameMatched = nameStatus === 'exact' || nameStatus === 'similar';

  // 4. Evaluasi Keselarasan Tipe Unit
  let typeStatus: 'match' | 'mismatch' | 'none' = 'none';
  if (masterType !== 'UNKNOWN' && roleType !== 'UNKNOWN') {
    typeStatus = masterType === roleType ? 'match' : 'mismatch';
  } else {
    typeStatus = 'match'; // Netral jika master status tidak spesifik KC/KCP
  }

  const isTypeMatched = typeStatus !== 'mismatch';
  const isFullyConsistent = isNameMatched && isTypeMatched;

  // 5. Tentukan Gaya Warna, Pesan, dan Tooltip
  if (isFullyConsistent) {
    return {
      hasRole: true,
      hasMaster: true,
      isNameMatched: true,
      isTypeMatched: true,
      isFullyConsistent: true,
      nameStatus,
      typeStatus,
      masterType,
      roleType,
      badgeLabel: '✓ Sesuai Master',
      badgeColor: '#059669',
      badgeBg: 'rgba(16, 185, 129, 0.1)',
      badgeBorder: 'rgba(16, 185, 129, 0.3)',
      cardBg: '#fcfdfe',
      cardBorder: '#e2e8f0',
      tooltip: `✓ Unit & Status sesuai Master (Cabang: ${masterCabangRaw || '-'}, Outlet: ${masterOutletRaw || '-'}, Status: ${masterStatusRaw || '-'})`,
    };
  }

  if (nameStatus === 'different') {
    return {
      hasRole: true,
      hasMaster: true,
      isNameMatched: false,
      isTypeMatched,
      isFullyConsistent: false,
      nameStatus,
      typeStatus,
      masterType,
      roleType,
      badgeLabel: '⚠️ Unit Beda dgn Master',
      badgeColor: '#dc2626',
      badgeBg: 'rgba(239, 68, 68, 0.1)',
      badgeBorder: 'rgba(239, 68, 68, 0.3)',
      cardBg: 'rgba(239, 68, 68, 0.03)',
      cardBorder: '#fca5a5',
      tooltip: `⚠️ Nama Unit Mapping Role (${roleOrgRaw}) berbeda dengan Master Outlet (${[masterCabangRaw, masterOutletRaw].filter(Boolean).join(' / ')})`,
    };
  }

  // Kasus Beda Tipe (Nama serupa tapi Master KC vs Role KCP atau sebaliknya)
  return {
    hasRole: true,
    hasMaster: true,
    isNameMatched: true,
    isTypeMatched: false,
    isFullyConsistent: false,
    nameStatus,
    typeStatus,
    masterType,
    roleType,
    badgeLabel: `⚠️ Beda Tipe (${masterType} vs ${roleType})`,
    badgeColor: '#d97706',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeBorder: 'rgba(245, 158, 11, 0.35)',
    cardBg: 'rgba(245, 158, 11, 0.03)',
    cardBorder: '#fcd34d',
    tooltip: `⚠️ Tipe unit berbeda: Master berstatus ${masterType} (${masterStatusRaw || '-'}), sedangkan Role berstatus ${roleType} (${roleTipeRaw || '-'})`,
  };
}
