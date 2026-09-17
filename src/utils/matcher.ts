import type { MasterRow, TargetRow, MasterHealth, WilayahSetting } from '../types';
import type { RoleMappingRecord } from '../components/RoleMapping/RoleMappingManager';
import type { PTENRecord } from '../components/PTENData/PTENManager';
import {
  normalizeKodePos,
  textSimilarityScore,
  extractWilayahFromBranchCode,
  cleanText,
  findSharedStreetOrLandmark,
} from './normalizer.ts';
import { resolveRoleMappingForBranch } from './roleMatcher';
import { validatePtenForTarget } from './ptenMatcher';

/**
 * Build fast O(1) In-Memory Hash Map index keyed by 5-digit KODE POS
 */
export function buildMasterIndex(masterRows: MasterRow[]): Map<string, MasterRow[]> {
  const index = new Map<string, MasterRow[]>();

  for (const row of masterRows) {
    const rawKp = row['KODE POS'];
    const kp = normalizeKodePos(rawKp);
    if (!kp) continue;

    const existing = index.get(kp);
    if (existing) {
      existing.push(row);
    } else {
      index.set(kp, [row]);
    }
  }

  return index;
}

/**
 * Analyze health of Master Data (uniqueness, multi-outlet detection)
 */
export function analyzeMasterHealth(masterRows: MasterRow[], index: Map<string, MasterRow[]>): MasterHealth {
  let multiOutletCount = 0;
  const multiOutletItems: MasterHealth['multiOutletItems'] = [];

  index.forEach((rows, kodePos) => {
    if (rows.length > 1) {
      multiOutletCount++;
      multiOutletItems.push({
        kodePos,
        count: rows.length,
        kecamatan: rows[0].Kecamatan || '-',
        outlets: rows.map(r => r['Nama Outlet'] || r['Sandi Cabang'] || r.Cabang || 'Outlet'),
        matchingMasterRows: rows,
      });
    }
  });

  return {
    totalRows: masterRows.length,
    uniqueKodePos: index.size,
    multiOutletCount,
    multiOutletItems, // Include all multi-outlet items without truncation
  };
}

/**
 * Level 2 Tie-Breaker Algorithm for multi-candidate postal codes:
 */
export function resolveLevel2TieBreaker(target: TargetRow, candidates: MasterRow[]): MasterRow {
  let bestCandidate = candidates[0];
  let bestScore = -1;

  for (const cand of candidates) {
    const scoreKec = textSimilarityScore(target.Kecamatan || '', cand.Kecamatan || '');
    const scoreKel = textSimilarityScore(target.Kelurahan || '', cand.Kelurahan || '');
    const scoreDati = textSimilarityScore(target['Dati II'] || '', cand['Dati II'] || '');
    const scoreAddr = textSimilarityScore(cleanText(target.ALAMAT), cleanText(cand.ALAMAT));
    const streetMatch = findSharedStreetOrLandmark(target.ALAMAT || '', cand.ALAMAT || '');
    const streetBonus = streetMatch.isMatch ? 0.35 : 0;

    const compositeScore = scoreKec * 0.4 + scoreKel * 0.25 + scoreDati * 0.15 + scoreAddr * 0.2 + streetBonus;

    if (compositeScore > bestScore) {
      bestScore = compositeScore;
      bestCandidate = cand;
    }
  }

  return bestCandidate;
}

/**
 * Match a single target row against Master index, PTEN index, and Role Mapping
 */
export function matchSingleRow(
  target: TargetRow,
  masterIndex: Map<string, MasterRow[]>,
  wilayahSettings?: WilayahSetting[],
  roleMappingList?: RoleMappingRecord[],
  ptenIndex?: Map<string, PTENRecord>
): TargetRow {
  const result: TargetRow = { ...target };

  // 1. Standarisasi String Kode Pos
  const targetKp = normalizeKodePos(result['KODE POS']);

  // 2. Jika baris belum cocok, cari kandidat di Master Index
  if (!result._isMatched || !result.Sandi) {
    const rawCandidates = targetKp ? masterIndex.get(targetKp) : undefined;
    let candidates = rawCandidates;

    if (rawCandidates && rawCandidates.length > 0) {
      const targetProv = String(result.Provinsi || '').trim().toUpperCase();
      const targetDati = String(result['Dati II'] || '').trim().toUpperCase();

      if (targetProv || targetDati) {
        const geoMatched = rawCandidates.filter((cand) => {
          const candProv = String(cand.Provinsi || '').trim().toUpperCase();
          const candDati = String(cand['Dati II'] || '').trim().toUpperCase();
          if (targetProv && candProv) {
            const pTarget = targetProv.replace(/PROVINSI\s*/i, '').trim();
            const pCand = candProv.replace(/PROVINSI\s*/i, '').trim();
            if (pTarget && pCand && !pTarget.includes(pCand) && !pCand.includes(pTarget)) {
              return false;
            }
          }
          if (targetDati && candDati) {
            const dTarget = targetDati.replace(/^KOTA\s+ADM\.?\s*|^KABUPATEN\s*|^KAB\.\s*/i, '').trim();
            const dCand = candDati.replace(/^KOTA\s+ADM\.?\s*|^KABUPATEN\s*|^KAB\.\s*/i, '').trim();
            if (dTarget && dCand && !dTarget.includes(dCand) && !dCand.includes(dTarget) && targetProv && candProv) {
              return false;
            }
          }
          return true;
        });

        if (geoMatched.length > 0) {
          candidates = geoMatched;
        } else {
          candidates = undefined;
        }
      }
    }

    if (candidates && candidates.length > 0) {
      let matchedMaster: MasterRow;

      if (candidates.length === 1) {
        matchedMaster = candidates[0];
        result._matchLevel = 'level1';
      } else {
        matchedMaster = resolveLevel2TieBreaker(result, candidates);
        result._matchLevel = 'level2';
      }

      // Auto-populate 7 atribut master
      if (matchedMaster['Sandi Cabang']) {
        result['Sandi Cabang'] = matchedMaster['Sandi Cabang'];
      }
      result.Sandi = matchedMaster.Sandi || matchedMaster['Sandi Cabang'] || '';
      result.Cabang = matchedMaster.Cabang || matchedMaster['Sandi Cabang'] || '';
      result['Branch Code'] = matchedMaster['Branch Code'] || '';
      result['Kode Cabang'] = matchedMaster['Kode Cabang'] || '';
      result['Nama Outlet'] = matchedMaster['Nama Outlet'] || '';
      result['Status Outlet'] = matchedMaster['Status Outlet'] || '';
      result.ALAMAT = matchedMaster.ALAMAT || '';

      // Pengayaan Otomatis Wilayah
      const resolvedWilayah = extractWilayahFromBranchCode(
        matchedMaster['Branch Code'] || matchedMaster['Kode Cabang'] || result['Branch Code'] || result['Kode Cabang'] || '',
        wilayahSettings,
        matchedMaster.Wilayah || result.Wilayah || '-'
      );
      if (resolvedWilayah.wilayahName && resolvedWilayah.wilayahName !== '-') {
        result.Wilayah = resolvedWilayah.wilayahName;
      }

      result._isMatched = true;
      result._matchedAt = target._matchedAt || new Date().toISOString();
      result._matchedBy = target._matchedBy || 'System (Auto)';
    } else {
      result['Sandi Cabang'] = '';
      result.Sandi = '';
      result.Cabang = '';
      result['Branch Code'] = '';
      result['Kode Cabang'] = '';
      result['Nama Outlet'] = '';
      result['Status Outlet'] = '';
      result.ALAMAT = '';

      result._isMatched = false;
      result._matchLevel = 'none';
    }
  }

  // 3. Validasi & Pengayaan PTEN Otomatis
  if (ptenIndex && ptenIndex.size > 0) {
    const ptenValidation = validatePtenForTarget(
      result['KODE POS'],
      result['Dati II'] || result.Kota || '',
      ptenIndex
    );
    result['KOTA PTEN'] = ptenValidation.kotaPten;
    result['KODE POS PTEN'] = ptenValidation.kodePosPten;
    result['CEK KODE POS + PTEN'] = ptenValidation.statusPten;
  } else {
    // Fallback PTEN check jika kolom KODE POS PTEN sudah ada di row
    const targetKpClean = normalizeKodePos(result['KODE POS']);
    const ptenKpClean = normalizeKodePos(result['KODE POS PTEN']);
    if (targetKpClean && ptenKpClean) {
      result['CEK KODE POS + PTEN'] = targetKpClean === ptenKpClean ? 'SAME' : 'DIFFERENT';
    } else if (!result['CEK KODE POS + PTEN']) {
      result['CEK KODE POS + PTEN'] = 'NOT_FOUND';
    }
  }

  // 4. Validasi & Pengayaan Database Mapping Role (Smart Multi-Tier Lookup)
  // Menghubungkan Kelurahan/Kecamatan/Cabang (contoh: Pagutan -> KC MATARAM -> MATARAM BRANCH OFFICE)
  if (roleMappingList && roleMappingList.length > 0) {
    const branchCandidateName =
      result.Cabang ||
      result['Sandi Cabang'] ||
      result['Nama Outlet'] ||
      result.Sandi ||
      '';
    const outletCandidateName = result['Nama Outlet'] || '';

    const roleResolution = resolveRoleMappingForBranch(
      branchCandidateName,
      result['Dati II'] || result.Kota,
      result.Kelurahan,
      result.Kecamatan,
      result.ALAMAT,
      roleMappingList,
      outletCandidateName,
      result.Provinsi,
      result.Wilayah
    );

    if (roleResolution) {
      result.organisasiRole = roleResolution.organisasiRole;
      result.tipeUnitRole = roleResolution.tipeUnitRole;
      result.alurWondr = roleResolution.alurWondr;
      result.flowDescription = roleResolution.flowDescription;
      result.roleCabsal = roleResolution.qrsCabsal;
      result.roleCabapv1 = roleResolution.qrsCabapv1;
      result.roleCabapv2 = roleResolution.qrsCabapv2;
      result.roleGrandTotal = roleResolution.grandTotal;
    }
  }

  // 5. Evaluasi Status Keberadaan di BNI (SUDAH ADA DI BNI vs BELUM ADA DI BNI)
  if (!result['CEK DUPLIKAT KODE POS']) {
    result['CEK DUPLIKAT KODE POS'] = result._isMatched ? 'SUDAH ADA DI BNI' : 'BELUM ADA DI BNI';
  }

  // 6. Evaluasi Sumber Data
  if (!result['SUMBER DATA']) {
    result['SUMBER DATA'] = result._isMatched ? 'BNI' : 'PTEN-TAMBAHAN';
  }

  return result;
}

/**
 * Non-blocking Chunk Streaming Matching Engine (Anti-Stopper)
 */
export function executeChunkMatching(
  targetRows: TargetRow[],
  masterIndex: Map<string, MasterRow[]>,
  onProgress: (progress: number, processed: number, total: number) => void,
  chunkSize = 1000,
  wilayahSettings?: WilayahSetting[],
  roleMappingList?: RoleMappingRecord[],
  ptenIndex?: Map<string, PTENRecord>
): Promise<TargetRow[]> {
  return new Promise((resolve) => {
    const total = targetRows.length;
    if (total === 0) {
      onProgress(100, 0, 0);
      resolve([]);
      return;
    }

    const matchedResults: TargetRow[] = new Array(total);
    let currentIndex = 0;

    function processNextChunk() {
      const end = Math.min(currentIndex + chunkSize, total);

      for (let i = currentIndex; i < end; i++) {
        matchedResults[i] = matchSingleRow(
          targetRows[i],
          masterIndex,
          wilayahSettings,
          roleMappingList,
          ptenIndex
        );
      }

      currentIndex = end;
      const progressPercent = Math.round((currentIndex / total) * 100);
      onProgress(progressPercent, currentIndex, total);

      if (currentIndex < total) {
        setTimeout(processNextChunk, 0);
      } else {
        if (matchedResults.length !== total) {
          throw new Error(`CRITICAL ROW INTEGRITY FAILURE: Output ${matchedResults.length} != Input ${total}`);
        }
        resolve(matchedResults);
      }
    }

    setTimeout(processNextChunk, 0);
  });
}

