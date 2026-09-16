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
 * Normalizes branch name by stripping administrative prefixes and common noise
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
 * Smart Multi-Tier Role Mapping Resolver
 * Maps a target row / matched branch (e.g., Kelurahan Pagutan -> KC MATARAM)
 * to its exact record in the Role Mapping Database (e.g., MATARAM BRANCH OFFICE).
 */
export function resolveRoleMappingForBranch(
  branchName: string,
  dati2?: string,
  kelurahan?: string,
  kecamatan?: string,
  alamat?: string,
  roleList: RoleMappingRecord[] = []
): ResolvedRoleMapping | null {
  if (!roleList || roleList.length === 0) return null;

  const cleanBranch = normalizeBranchName(branchName);
  const cleanCity = cleanDati(dati2 || '');
  const cleanKel = cleanText(kelurahan || '');
  const cleanKec = cleanText(kecamatan || '');
  const cleanAlm = cleanText(alamat || '');

  let bestRecord: RoleMappingRecord | null = null;
  let bestScore = -1;

  for (const record of roleList) {
    const orgUpper = record.organisasiTujuan.toUpperCase();
    const orgClean = normalizeBranchName(record.organisasiTujuan);
    let score = 0;

    // 1. Exact Match on cleaned branch names
    if (cleanBranch && orgClean === cleanBranch) {
      score = 100;
    } else if (cleanBranch && (orgClean.includes(cleanBranch) || cleanBranch.includes(orgClean))) {
      // Significant substring match (e.g. "MATARAM" in "MATARAM BRANCH OFFICE")
      score = 85;
    }

    // 2. Sub Branch Match (e.g., "PAGUTAN" in "MATARAM BRANCH OFFICE - PAGUTAN SUB BRANCH" or "AEK KANOPAN")
    if (orgUpper.includes(' - ')) {
      const parts = orgUpper.split(' - ');
      const subPartClean = normalizeBranchName(parts[1] || '');
      if (cleanBranch && subPartClean && (subPartClean.includes(cleanBranch) || cleanBranch.includes(subPartClean))) {
        score = Math.max(score, 98);
      }
      if (cleanKel && subPartClean && (subPartClean.includes(cleanKel.toUpperCase()) || cleanKel.toUpperCase().includes(subPartClean))) {
        score = Math.max(score, 95);
      }
      if (cleanKec && subPartClean && (subPartClean.includes(cleanKec.toUpperCase()) || cleanKec.toUpperCase().includes(subPartClean))) {
        score = Math.max(score, 92);
      }
      if (cleanAlm && subPartClean && cleanAlm.toUpperCase().includes(subPartClean)) {
        score = Math.max(score, 90);
      }
    }

    // 3. Address Scanning for Branch / Sub Branch Keywords
    if (score < 80 && cleanAlm) {
      const almUpper = cleanAlm.toUpperCase();
      if (orgClean && almUpper.includes(orgClean)) {
        score = Math.max(score, 80);
      }
    }

    // 4. Fallback: City / Dati II matching to Parent Branch Office
    if (score === 0 && cleanCity) {
      const cityClean = cleanCity.replace(/^(KOTA|KABUPATEN|KAB)\s+/i, '').trim().toUpperCase();
      if (cityClean && orgClean.includes(cityClean)) {
        // If it's a main branch office for that city, score is 75
        const isKc = getUnitCategory(record.organisasiTujuan) === 'KC';
        score = isKc ? 75 : 60;
      }
    }

    // 5. Word-token intersection
    if (score === 0 && cleanBranch) {
      const branchTokens = cleanBranch.split(/\s+/).filter((t) => t.length >= 3);
      const orgTokens = orgClean.split(/\s+/).filter((t) => t.length >= 3);
      const matchedTokens = branchTokens.filter((t) => orgTokens.includes(t));
      if (matchedTokens.length > 0) {
        score = (matchedTokens.length / Math.max(branchTokens.length, orgTokens.length)) * 70;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRecord = record;
    }
  }

  if (bestRecord && bestScore >= 50) {
    const isKc = getUnitCategory(bestRecord.organisasiTujuan) === 'KC';
    const wondr = getWondrRecommendation(bestRecord);

    return {
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
  }

  return null;
}
