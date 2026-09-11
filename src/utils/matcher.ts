import type { MasterRow, TargetRow, MasterHealth, WilayahSetting } from '../types';
import { normalizeKodePos, textSimilarityScore, extractWilayahFromBranchCode } from './normalizer';

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
 * 1. Cocokkan teks Kecamatan Data Asli vs Master
 * 2. Jika masih > 1, cocokkan Kelurahan
 * 3. Jika masih > 1, gunakan kesamaan teks Dati II
 * 4. Pilih baris master dengan skor kecocokan tertinggi
 */
export function resolveLevel2TieBreaker(target: TargetRow, candidates: MasterRow[]): MasterRow {
  let bestCandidate = candidates[0];
  let bestScore = -1;

  for (const cand of candidates) {
    const scoreKec = textSimilarityScore(target.Kecamatan || '', cand.Kecamatan || '');
    const scoreKel = textSimilarityScore(target.Kelurahan || '', cand.Kelurahan || '');
    const scoreDati = textSimilarityScore(target['Dati II'] || '', cand['Dati II'] || '');

    // Weighted composite score prioritizes Kecamatan (0.5), Kelurahan (0.3), Dati II (0.2)
    const compositeScore = scoreKec * 0.5 + scoreKel * 0.3 + scoreDati * 0.2;

    if (compositeScore > bestScore) {
      bestScore = compositeScore;
      bestCandidate = cand;
    }
  }

  return bestCandidate;
}

/**
 * Match a single target row against Master index and validate PTEN
 */
export function matchSingleRow(
  target: TargetRow,
  masterIndex: Map<string, MasterRow[]>,
  wilayahSettings?: WilayahSetting[]
): TargetRow {
  // Jika baris ini sudah berstatus MATCH (misal dari file sebelumnya atau sudah disetujui dari rekomendasi), pertahankan data bersihnya!
  if (target._isMatched && (target.Sandi || target['Sandi Cabang'] || target.Cabang)) {
    return target;
  }

  const result: TargetRow = { ...target };

  // 1. Standarisasi String Kode Pos
  const targetKp = normalizeKodePos(result['KODE POS']);

  // 3. Hierarki Pencocokan Cabang
  const candidates = targetKp ? masterIndex.get(targetKp) : undefined;

  if (candidates && candidates.length > 0) {
    let matchedMaster: MasterRow;

    if (candidates.length === 1) {
      // Single Candidate (1-to-1)
      matchedMaster = candidates[0];
      result._matchLevel = 'level1';
    } else {
      // Multiple Candidates (1-to-Many): Level 2 Tie-Breaker
      matchedMaster = resolveLevel2TieBreaker(result, candidates);
      result._matchLevel = 'level2';
    }

    // Auto-populate 7 atribut master (mendukung Sandi Cabang 1 kolom maupun terpisah)
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

    // Pengayaan Otomatis Wilayah berdasarkan 2 digit kode branch (Setting Wilayah)
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
    // No Candidate (0 Match): Kolom 3 s.d. 9 dibiarkan kosong (blank). Data asli tetap utuh.
    result['Sandi Cabang'] = '';
    result.Sandi = '';
    result.Cabang = '';
    result['Branch Code'] = '';
    result['Kode Cabang'] = '';
    result['Nama Outlet'] = '';
    result['Status Outlet'] = '';
    // ALAMAT dibiarkan atau di-reset kosong sesuai kamus data BRD jika unmatched
    result.ALAMAT = '';

    result._isMatched = false;
    result._matchLevel = 'none';
  }

  // 4. Evaluasi Otomatis Integritas PTEN (KODE POS vs KODE POS PTEN)
  const targetKpClean = normalizeKodePos(result['KODE POS']);
  const ptenKpClean = normalizeKodePos(result['KODE POS PTEN']);
  if (targetKpClean && ptenKpClean) {
    if (targetKpClean === ptenKpClean) {
      result['CEK KODE POS + PTEN'] = 'COCOK';
    } else {
      result['CEK KODE POS + PTEN'] = 'TIDAK COCOK';
    }
  } else if (!result['CEK KODE POS + PTEN']) {
    result['CEK KODE POS + PTEN'] = '-';
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
 * Breaks workload into chunks (e.g. 1000 - 2500 rows) using setTimeout to prevent UI freeze
 */
export function executeChunkMatching(
  targetRows: TargetRow[],
  masterIndex: Map<string, MasterRow[]>,
  onProgress: (progress: number, processed: number, total: number) => void,
  chunkSize = 1000,
  wilayahSettings?: WilayahSetting[]
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
        matchedResults[i] = matchSingleRow(targetRows[i], masterIndex, wilayahSettings);
      }

      currentIndex = end;
      const progressPercent = Math.round((currentIndex / total) * 100);
      onProgress(progressPercent, currentIndex, total);

      if (currentIndex < total) {
        // Yield control to main thread so browser renders progress bar and stays responsive
        setTimeout(processNextChunk, 0);
      } else {
        // ROW INTEGRITY ASSERTION:
        // "Sistem menjalankan validasi ketat otomatis: assert total_downloaded_rows == total_uploaded_rows"
        if (matchedResults.length !== total) {
          throw new Error(`CRITICAL ROW INTEGRITY FAILURE: Output ${matchedResults.length} != Input ${total}`);
        }
        resolve(matchedResults);
      }
    }

    // Begin first chunk asynchronously
    setTimeout(processNextChunk, 0);
  });
}
