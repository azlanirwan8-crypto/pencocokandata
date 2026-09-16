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
  roleList: RoleMappingRecord[] = []
): ResolvedRoleMapping | null {
  if (!roleList || roleList.length === 0) return null;

  if (lastRoleListRef !== roleList) {
    roleResolveCache.clear();
    lastRoleListRef = roleList;
  }

  const cleanBranch = normalizeBranchName(branchName);
  const cleanCity = cleanDati(dati2 || '')
    .replace(/^(KOTA|KABUPATEN|KAB)\s+/i, '')
    .trim()
    .toUpperCase();
  const cleanKel = cleanText(kelurahan || '').toUpperCase();
  const cleanKec = cleanText(kecamatan || '').toUpperCase();
  const cleanAlm = cleanText(alamat || '').toUpperCase();

  const cacheKey = `${cleanBranch}|${cleanCity}|${cleanKel}|${cleanKec}|${cleanAlm.slice(0, 30)}`;
  if (roleResolveCache.has(cacheKey)) {
    return roleResolveCache.get(cacheKey) || null;
  }

  let bestRecord: RoleMappingRecord | null = null;
  let bestScore = -1;

  for (const record of roleList) {
    const orgUpper = record.organisasiTujuan.toUpperCase();
    const orgClean = normalizeBranchName(record.organisasiTujuan);
    let score = 0;

    // ── TIER 1: Exact normalized branch name ─────────────────────────────
    if (cleanBranch && orgClean === cleanBranch) {
      score = 100;
    }

    // ── TIER 2: Substring containment ─────────────────────────────────────
    if (score === 0 && cleanBranch) {
      const branchInOrg = orgClean.includes(cleanBranch);
      const orgInBranch = cleanBranch.includes(orgClean) && orgClean.length >= 4;
      if (branchInOrg || orgInBranch) {
        score = 85;
      }
    }

    // ── TIER 3: Sub-branch part matching ─────────────────────────────────
    if (orgUpper.includes(' - ')) {
      const dashIdx = orgUpper.indexOf(' - ');
      const parentPart = orgUpper.substring(0, dashIdx);
      const subPart = orgUpper.substring(dashIdx + 3);
      const subPartClean = normalizeBranchName(subPart);
      const parentClean = normalizeBranchName(parentPart);

      // Sub-branch name vs branch name
      if (cleanBranch && subPartClean.length >= 3) {
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
        // KC (main branch) scores higher: more reliable parent
        score = isKc ? 75 : 60;
      }
    }

    // ── TIER 6: Kelurahan/Kecamatan vs main (non-sub) org tokens ─────────
    if (score === 0) {
      if (cleanKel.length >= 3 && orgClean.includes(cleanKel)) score = Math.max(score, 70);
      if (cleanKec.length >= 3 && orgClean.includes(cleanKec)) score = Math.max(score, 65);
    }

    // ── TIER 7: Token-intersection fallback ──────────────────────────────
    if (score === 0 && cleanBranch.length >= 3) {
      const ratio = tokenIntersectionRatio(cleanBranch, orgClean, 3);
      if (ratio >= 0.5) {
        // Max score from this tier is 49 (below threshold if only here)
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
