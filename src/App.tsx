import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MetricCards } from './components/Dashboard/MetricCards';
import { RegionalAnalyticsCharts } from './components/Dashboard/RegionalAnalyticsCharts';
import { DashboardMatchTable } from './components/Dashboard/DashboardMatchTable';
import { MasterHealthCard } from './components/MasterData/MasterHealthCard';
import { MasterDataGrid } from './components/MasterData/MasterDataGrid';
import { MasterUploadModal } from './components/MasterData/MasterUploadModal';
import { TargetUploadModal } from './components/WorkingEngine/TargetUploadModal';
import { ProgressBar } from './components/WorkingEngine/ProgressBar';
import { TargetDataGrid } from './components/WorkingEngine/TargetDataGrid';
import { ExportAction } from './components/WorkingEngine/ExportAction';

import type { MasterRow, TargetRow, MatchingStats, WilayahStat } from './types';
import type { RecommendationResult } from './utils/recommender';
import { buildMasterIndex, analyzeMasterHealth, executeChunkMatching } from './utils/matcher';
import { formatWilayahName } from './utils/normalizer';

import { getItem, setItem } from './utils/storage';
import {
  isSupabaseConfigured,
  saveMasterToCloud,
  loadMasterFromCloud,
  clearMasterFromCloud,
  saveTargetToCloud,
  loadTargetFromCloud,
  clearTargetFromCloud,
} from './utils/supabase';
import {
  checkNeonStatus,
  loadMasterFromNeon,
  saveMasterToNeon,
  clearMasterFromNeon,
  loadTargetFromNeon,
  saveTargetToNeon,
  clearTargetFromNeon,
} from './utils/neonSync';
import { SupabaseModal } from './components/SupabaseModal';
import { SnapshotModal, type WorkspaceSnapshot } from './components/SnapshotModal';
import { Database, ShieldAlert, Filter, UploadCloud, RotateCcw, Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'master' | 'working'>('dashboard');
  const [masterSubTab, setMasterSubTab] = useState<'health' | 'grid'>('health');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState<boolean>(false);
  const [isMasterUploadModalOpen, setIsMasterUploadModalOpen] = useState<boolean>(false);
  const [isTargetUploadModalOpen, setIsTargetUploadModalOpen] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>('Baru saja');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(isSupabaseConfigured());
  const [isNeonConnected, setIsNeonConnected] = useState<boolean>(false);

  // Master Data State (Clean state for real data upload)
  const [masterRows, setMasterRows] = useState<MasterRow[]>([]);

  // Target Data State (Clean state for real data upload)
  const [targetRows, setTargetRows] = useState<TargetRow[]>([]);
  const [initialTargetCount, setInitialTargetCount] = useState<number>(0);
  const [targetFileName, setTargetFileName] = useState<string>('');

  // Matching Execution State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [matchedDone, setMatchedDone] = useState<boolean>(false);

  // Filters State
  const [selectedWilayah, setSelectedWilayah] = useState<string>('ALL');
  const [dashboardWilayahFilter, setDashboardWilayahFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');


  // Build In-Memory Hash Map O(1)
  const masterIndex = useMemo(() => {
    return buildMasterIndex(masterRows);
  }, [masterRows]);

  // Master Health Analysis
  const masterHealth = useMemo(() => {
    return analyzeMasterHealth(masterRows, masterIndex);
  }, [masterRows, masterIndex]);

  // Restore persisted data (Instant Cache-First + Parallel Cloud Revalidation)
  useEffect(() => {
    const restoreSavedData = async () => {
      // -----------------------------------------------------------------------
      // STEP 1: INSTANT LOCAL LOAD (< 15ms)
      // Read local IndexedDB immediately in parallel so the UI is ready instantly
      // -----------------------------------------------------------------------
      try {
        const [savedMaster, savedTarget] = await Promise.all([
          getItem<{ rows: MasterRow[]; fileName: string }>('master_data').catch(() => null),
          getItem<{
            rows: TargetRow[];
            fileName: string;
            initialCount: number;
            matchedDone: boolean;
          }>('target_data').catch(() => null),
        ]);

        if (savedMaster && savedMaster.rows && savedMaster.rows.length > 0) {
          setMasterRows(savedMaster.rows);
        }

        if (savedTarget && savedTarget.rows && savedTarget.rows.length > 0) {
          setTargetRows(savedTarget.rows);
          setTargetFileName(savedTarget.fileName || '');
          setInitialTargetCount(savedTarget.initialCount || savedTarget.rows.length);
          setMatchedDone(savedTarget.matchedDone || false);
        }
      } catch (err) {
        console.warn('Local cache restore skipped:', err);
      }

      // -----------------------------------------------------------------------
      // STEP 2: PARALLEL BACKGROUND CLOUD SYNC (Non-blocking)
      // Fetch latest updates from Neon Postgres and Supabase Cloud concurrently
      // -----------------------------------------------------------------------
      (async () => {
        try {
          // Check Neon status & load data in parallel
          const [neonCheck, neonMaster, neonTarget] = await Promise.allSettled([
            checkNeonStatus(),
            loadMasterFromNeon(),
            loadTargetFromNeon(),
          ]);

          let hasNeonMaster = false;
          let hasNeonTarget = false;

          if (neonCheck.status === 'fulfilled' && neonCheck.value.connected) {
            setIsNeonConnected(true);
            setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
          }

          if (neonMaster.status === 'fulfilled' && neonMaster.value && neonMaster.value.rows.length > 0) {
            setMasterRows(neonMaster.value.rows);
            hasNeonMaster = true;
          }

          if (neonTarget.status === 'fulfilled' && neonTarget.value && neonTarget.value.rows.length > 0) {
            setTargetRows(neonTarget.value.rows);
            setTargetFileName(neonTarget.value.fileName || '');
            setInitialTargetCount(neonTarget.value.initialCount || neonTarget.value.rows.length);
            setMatchedDone(neonTarget.value.matchedDone || false);
            hasNeonTarget = true;
          }

          // Fallback to Supabase Cloud if configured & not loaded from Neon
          if ((!hasNeonMaster || !hasNeonTarget) && isSupabaseConfigured()) {
            setIsCloudConnected(true);
            setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
            const [cloudMaster, cloudTarget] = await Promise.allSettled([
              !hasNeonMaster ? loadMasterFromCloud() : Promise.resolve(null),
              !hasNeonTarget ? loadTargetFromCloud() : Promise.resolve(null),
            ]);

            if (cloudMaster.status === 'fulfilled' && cloudMaster.value && cloudMaster.value.rows.length > 0) {
              setMasterRows(cloudMaster.value.rows);
            }

            if (cloudTarget.status === 'fulfilled' && cloudTarget.value && cloudTarget.value.rows.length > 0) {
              setTargetRows(cloudTarget.value.rows);
              setTargetFileName(cloudTarget.value.fileName || '');
              setInitialTargetCount(cloudTarget.value.initialCount || cloudTarget.value.rows.length);
              setMatchedDone(cloudTarget.value.matchedDone || false);
            }
          }
        } catch (cloudErr) {
          console.warn('Background cloud sync skipped:', cloudErr);
        }
      })();
    };

    restoreSavedData();
  }, []);

  // Helper to persist target & match data across IndexedDB, Neon Postgres, and Supabase Cloud
  const persistTargetData = (payload: {
    rows: TargetRow[];
    fileName: string;
    initialCount: number;
    matchedDone: boolean;
  }) => {
    // 1. Local IndexedDB (Instant local cache)
    setItem('target_data', payload);

    // 2. Neon Postgres (Serverless DB on Vercel)
    saveTargetToNeon(payload).catch((e) => console.warn('Neon target auto-save skipped:', e));

    // 3. Supabase Cloud if configured
    if (isSupabaseConfigured()) {
      saveTargetToCloud(payload.rows, payload.fileName, payload.initialCount, payload.matchedDone).catch((e) =>
        console.warn('Cloud target auto-save skipped:', e)
      );
    }

    setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
  };

  // Compute Wilayah List from Target Data
  const wilayahList = useMemo(() => {
    const set = new Set<string>();
    targetRows.forEach((r) => {
      if (r.Wilayah) set.add(String(r.Wilayah).trim());
    });
    return Array.from(set).sort();
  }, [targetRows]);

  // Filtered Target Rows (Optimized with early return for millions of records)
  const filteredTargetRows = useMemo(() => {
    if (selectedWilayah === 'ALL' && !searchTerm.trim()) {
      return targetRows;
    }
    const q = searchTerm.trim().toLowerCase();
    return targetRows.filter((r) => {
      // Wilayah filter
      if (selectedWilayah !== 'ALL' && r.Wilayah !== selectedWilayah) {
        return false;
      }

      // Search term
      if (q) {
        const matchesSearch =
          String(r.No).includes(q) ||
          (r.Wilayah && r.Wilayah.toLowerCase().includes(q)) ||
          (r.Sandi && r.Sandi.toLowerCase().includes(q)) ||
          (r.Cabang && r.Cabang.toLowerCase().includes(q)) ||
          (r['Nama Outlet'] && r['Nama Outlet'].toLowerCase().includes(q)) ||
          (r.ALAMAT && r.ALAMAT.toLowerCase().includes(q)) ||
          (r['KODE POS'] && r['KODE POS'].toLowerCase().includes(q)) ||
          (r.Kecamatan && r.Kecamatan.toLowerCase().includes(q)) ||
          (r.Kelurahan && r.Kelurahan.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [targetRows, selectedWilayah, searchTerm]);

  // Dashboard Filtered Rows by Wilayah
  const dashboardFilteredRows = useMemo(() => {
    if (dashboardWilayahFilter === 'ALL') return targetRows;
    return targetRows.filter((r) => String(r.Wilayah || '').trim() === String(dashboardWilayahFilter).trim());
  }, [targetRows, dashboardWilayahFilter]);

  // Dashboard Aggregates & Metrics
  const dashboardStats: MatchingStats = useMemo(() => {
    const totalProcessed = dashboardFilteredRows.length;
    let matchedCount = 0;
    let level1Count = 0;
    let level2Count = 0;
    let recommendationCount = 0;
    let ptenSameCount = 0;
    let ptenDifferentCount = 0;
    let ptenUncheckedCount = 0;

    dashboardFilteredRows.forEach((r) => {
      const isMatched = Boolean(r._isMatched);
      if (isMatched) {
        matchedCount++;
        if (r._matchLevel === 'recommendation') {
          recommendationCount++;
        } else if (r._matchLevel === 'level2') {
          level2Count++;
        } else {
          level1Count++;
        }
      }

      const ptenStatus = String(r['CEK KODE POS + PTEN'] || '').trim().toUpperCase();
      if (ptenStatus === 'SAME') {
        ptenSameCount++;
      } else if (ptenStatus === 'DIFFERENT') {
        ptenDifferentCount++;
      } else {
        ptenUncheckedCount++;
      }
    });

    const unmatchedCount = totalProcessed - matchedCount;
    const matchingRate = totalProcessed > 0 ? (matchedCount / totalProcessed) * 100 : 0;

    return {
      totalProcessed,
      matchedCount,
      unmatchedCount,
      matchingRate,
      level1Count,
      level2Count,
      recommendationCount,
      ptenSameCount,
      ptenDifferentCount,
      ptenUncheckedCount,
    };
  }, [dashboardFilteredRows]);

  // Regional Stats for Widget Distribusi Wilayah (Mengikuti Filter Dashboard)
  const regionalStats: WilayahStat[] = useMemo(() => {
    const map = new Map<string, { total: number; matched: number; unmatched: number }>();

    dashboardFilteredRows.forEach((r) => {
      const rawW = String(r.Wilayah || 'Wilayah Tidak Terdaftar').trim();
      if (dashboardWilayahFilter !== 'ALL' && rawW !== String(dashboardWilayahFilter).trim()) {
        return;
      }
      const isMatched = r._isMatched ?? (r.Sandi !== '');
      const current = map.get(rawW) || { total: 0, matched: 0, unmatched: 0 };

      current.total++;
      if (isMatched) current.matched++;
      else current.unmatched++;

      map.set(rawW, current);
    });

    return Array.from(map.entries()).map(([wilayah, data]) => ({
      wilayah,
      total: data.total,
      matched: data.matched,
      unmatched: data.unmatched,
      rate: data.total > 0 ? (data.matched / data.total) * 100 : 0,
    }));
  }, [dashboardFilteredRows, dashboardWilayahFilter]);

  // Execution Trigger
  const handleExecuteMatching = async () => {
    if (targetRows.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setProcessedCount(0);
    const startTime = performance.now();

    try {
      const matchedData = await executeChunkMatching(
        targetRows,
        masterIndex,
        (pct, processed, _total) => {
          setProgress(pct);
          setProcessedCount(processed);
          setDurationMs(Math.round(performance.now() - startTime));
        },
        1200 // Chunk size
      );

      const endTime = performance.now();
      const totalElapsed = Math.round(endTime - startTime);

      setTargetRows(matchedData);
      setMatchedDone(true);
      setDurationMs(totalElapsed);
      setIsProcessing(false);

      persistTargetData({
        rows: matchedData,
        fileName: targetFileName,
        initialCount: initialTargetCount,
        matchedDone: true,
      });
    } catch (err) {
      setIsProcessing(false);
      alert('Terjadi kesalahan saat memproses data: ' + err);
    }
  };

  // Master Actions (Appends new rows to existing master data with strict deduplication)
  const handleMasterLoaded = async (newRows: MasterRow[], fileName: string) => {
    setMasterRows((prev) => {
      // Indeks kunci unik dari data master yang sudah tersimpan
      const existingKeys = new Set<string>();
      for (const r of prev) {
        const bc = String(r['Branch Code'] || r['Kode Cabang'] || '').trim().toUpperCase();
        const name = String(r['Nama Outlet'] || r['Sandi Cabang'] || r.Cabang || '').trim().toUpperCase();
        const kp = String(r['KODE POS'] || '').trim();
        const addr = String(r.ALAMAT || '').trim().toUpperCase();

        if (bc && bc !== '-' && bc !== '0') existingKeys.add(`bc:${bc}`);
        if (name && kp) existingKeys.add(`ot:${name}|${kp}`);
        if (name && addr) existingKeys.add(`oa:${name}|${addr}`);
      }

      // Saring hanya baris yang benar-benar baru
      const uniqueAppended: MasterRow[] = [];
      for (const r of newRows) {
        const bc = String(r['Branch Code'] || r['Kode Cabang'] || '').trim().toUpperCase();
        const name = String(r['Nama Outlet'] || r['Sandi Cabang'] || r.Cabang || '').trim().toUpperCase();
        const kp = String(r['KODE POS'] || '').trim();
        const addr = String(r.ALAMAT || '').trim().toUpperCase();

        const branchKey = bc && bc !== '-' && bc !== '0' ? `bc:${bc}` : '';
        const outletKey = name && kp ? `ot:${name}|${kp}` : '';
        const outletAddrKey = name && addr ? `oa:${name}|${addr}` : '';

        const isDuplicate =
          (branchKey && existingKeys.has(branchKey)) ||
          (outletKey && existingKeys.has(outletKey)) ||
          (outletAddrKey && existingKeys.has(outletAddrKey));

        if (isDuplicate) continue;

        if (branchKey) existingKeys.add(branchKey);
        if (outletKey) existingKeys.add(outletKey);
        if (outletAddrKey) existingKeys.add(outletAddrKey);
        uniqueAppended.push(r);
      }

      const combined = [...prev, ...uniqueAppended];
      const combinedFileName = prev.length > 0 ? `${combined.length} Cabang (${fileName})` : fileName;
      // setMasterFileName(combinedFileName);
      setItem('master_data', { rows: combined, fileName: combinedFileName });

      // Sync to Vercel Neon DB (Serverless)
      try {
        saveMasterToNeon(combined, combinedFileName);
      } catch (e) {
        console.warn('Neon auto-save skipped:', e);
      }

      // Sync to Supabase Cloud if configured
      if (isSupabaseConfigured()) {
        saveMasterToCloud(combined, combinedFileName);
      }

      return combined;
    });
  };

  const handleResetMaster = async () => {
    if (window.confirm('Kosongkan seluruh data master cabang?')) {
      try {
        setMasterRows([]);
        // setMasterFileName('');
        await setItem('master_data', { rows: [], fileName: '' });
        try {
          await clearMasterFromNeon();
        } catch (e) {
          console.warn('Neon clear warning:', e);
        }
        if (isSupabaseConfigured()) {
          try {
            await clearMasterFromCloud();
          } catch (e) {
            console.warn('Cloud clear warning:', e);
          }
        }
      } catch (e) {
        console.warn('Reset master error:', e);
      }
    }
  };

  // Target Actions (Uploads new rows with strict Excel order preservation)
  const handleTargetLoaded = (
    newRows: TargetRow[],
    fileName: string,
    mode: 'replace' | 'append' = 'replace'
  ) => {
    setTargetRows((prev) => {
      let finalRows: TargetRow[];
      if (mode === 'append' && prev.length > 0) {
        const startNo = prev.length;
        const indexedNewRows = newRows.map((r, idx) => ({
          ...r,
          No: r.No !== undefined && String(r.No).trim() !== '' ? r.No : startNo + idx + 1,
          _excelRowIndex: startNo + idx + 1,
        }));
        finalRows = [...prev, ...indexedNewRows];
      } else {
        // Mode Replace (default): Urutan 100% murni persis sesuai file Excel yang diunggah
        finalRows = newRows.map((r, idx) => ({
          ...r,
          No: r.No !== undefined && String(r.No).trim() !== '' ? r.No : idx + 1,
          _excelRowIndex: idx + 1,
        }));
      }

      const finalFileName =
        mode === 'append' && prev.length > 0 ? `${finalRows.length} Data Target (${fileName})` : fileName;
      setTargetFileName(finalFileName);
      setInitialTargetCount(finalRows.length);
      setMatchedDone(false);
      setProgress(0);

      persistTargetData({
        rows: finalRows,
        fileName: finalFileName,
        initialCount: finalRows.length,
        matchedDone: false,
      });

      return finalRows;
    });
  };

  const handleResetTarget = async () => {
    if (window.confirm('Kosongkan seluruh data target operasional (Data Cek)?')) {
      try {
        setTargetRows([]);
        setInitialTargetCount(0);
        setTargetFileName('');
        setMatchedDone(false);
        setProgress(0);
        await setItem('target_data', { rows: [], fileName: '', initialCount: 0, matchedDone: false });
        clearTargetFromNeon().catch((e) => console.warn('Neon target clear warning:', e));
        if (isSupabaseConfigured()) {
          clearTargetFromCloud().catch((e) => console.warn('Cloud target clear warning:', e));
        }
      } catch (e) {
        console.warn('Reset target error:', e);
      }
    }
  };

  // Reset Hasil Pencocokan: Mengembalikan status data target ke kondisi awal upload tanpa menghapus berkas
  const handleResetMatchingResults = () => {
    if (
      window.confirm(
        'Kembalikan data target ke status awal upload (sebelum dicocokkan)?\nHasil pencocokan akan di-reset sehingga Anda dapat meninjau rekomendasi kembali atau mencocokkan ulang. Berkas dan data yang Anda isi di Excel tetap aman.'
      )
    ) {
      setTargetRows((prev) => {
        const restored = prev.map((r) => ({
          ...r,
          _isMatched: false,
          _matchLevel: 'none' as const,
          _matchedAt: undefined,
          _matchedBy: undefined,
          // Pulihkan data awal yang diisi user di file Excel jika ada
          Sandi: r._originalFilledSandi || '',
          Cabang: r._originalFilledCabang || '',
          'Sandi Cabang': r._originalFilledSandiCabang || '',
          'Nama Outlet': r._originalFilledNamaOutlet || '',
        }));

        setMatchedDone(false);
        setProgress(0);
        setProcessedCount(0);

        persistTargetData({
          rows: restored,
          fileName: targetFileName,
          initialCount: initialTargetCount,
          matchedDone: false,
        });

        return restored;
      });
    }
  };

  // Setujui Semua Rekomendasi: Mengisi atribut master ke baris target yang cocok, pindah ke matched, tab 1 & 2 kosong
  const handleApproveAllRecommendations = (recs: RecommendationResult[]) => {
    if (recs.length === 0) return;
    const recMap = new Map<string | number, MasterRow>();
    recs.forEach((r) => {
      recMap.set(r.targetRow.No, r.recommendedMaster);
    });

    setTargetRows((prev) => {
      const updated = prev.map((row) => {
        const matchedMaster = recMap.get(row.No);
        if (!matchedMaster) return row;

        return {
          ...row,
          _isMatched: true,
          _matchLevel: 'recommendation' as const,
          'Sandi Cabang':
            matchedMaster['Sandi Cabang'] ||
            [matchedMaster.Sandi, matchedMaster.Cabang].filter(Boolean).join(' - ') ||
            matchedMaster.Cabang ||
            '',
          Sandi: matchedMaster.Sandi || matchedMaster['Sandi Cabang'] || '',
          Cabang: matchedMaster.Cabang || matchedMaster['Sandi Cabang'] || '',
          'Branch Code': matchedMaster['Branch Code'] || '',
          'Kode Cabang': matchedMaster['Kode Cabang'] || '',
          'Nama Outlet': matchedMaster['Nama Outlet'] || '',
          'Status Outlet': matchedMaster['Status Outlet'] || 'Aktif',
          ALAMAT: matchedMaster.ALAMAT || '',
          _matchedAt: new Date().toISOString(),
          _matchedBy: 'Operator (Approval)',
        };
      });

      persistTargetData({
        rows: updated,
        fileName: targetFileName,
        initialCount: initialTargetCount,
        matchedDone: true,
      });

      return updated;
    });
  };

  // Setujui Satu Rekomendasi Per Baris
  const handleApproveSingleRecommendation = (rowNo: number | string, matchedMaster: MasterRow) => {
    setTargetRows((prev) => {
      const updated = prev.map((row) => {
        if (row.No !== rowNo) return row;

        return {
          ...row,
          _isMatched: true,
          _matchLevel: 'recommendation' as const,
          'Sandi Cabang':
            matchedMaster['Sandi Cabang'] ||
            [matchedMaster.Sandi, matchedMaster.Cabang].filter(Boolean).join(' - ') ||
            matchedMaster.Cabang ||
            '',
          Sandi: matchedMaster.Sandi || matchedMaster['Sandi Cabang'] || '',
          Cabang: matchedMaster.Cabang || matchedMaster['Sandi Cabang'] || '',
          'Branch Code': matchedMaster['Branch Code'] || '',
          'Kode Cabang': matchedMaster['Kode Cabang'] || '',
          'Nama Outlet': matchedMaster['Nama Outlet'] || '',
          'Status Outlet': matchedMaster['Status Outlet'] || 'Aktif',
          ALAMAT: matchedMaster.ALAMAT || '',
          _matchedAt: new Date().toISOString(),
          _matchedBy: 'Operator (Approval)',
        };
      });

      persistTargetData({
        rows: updated,
        fileName: targetFileName,
        initialCount: initialTargetCount,
        matchedDone: true,
      });

      return updated;
    });
  };

  // Batalkan Persetujuan Rekomendasi (Revert) - Mengembalikan baris ke status belum cocok (unmatched)
  const handleRevertRecommendation = (rowNo: number | string) => {
    setTargetRows((prev) => {
      const updated = prev.map((row) => {
        if (row.No !== rowNo) return row;

        return {
          ...row,
          _isMatched: false,
          _matchLevel: 'none' as const,
          'Sandi Cabang': '',
          Sandi: '',
          Cabang: '',
          'Branch Code': '',
          'Kode Cabang': '',
          'Nama Outlet': '',
          'Status Outlet': '',
          _matchedAt: undefined,
          _matchedBy: undefined,
        };
      });

      persistTargetData({
        rows: updated,
        fileName: targetFileName,
        initialCount: initialTargetCount,
        matchedDone: true,
      });

      return updated;
    });
  };

  // Restore Session Snapshot (.json) - Memulihkan data Master, Target, dan Hasil Pencocokan
  const handleRestoreSnapshot = (snapshot: WorkspaceSnapshot) => {
    if (snapshot.masterData && Array.isArray(snapshot.masterData.rows)) {
      setMasterRows(snapshot.masterData.rows);
      setItem('master_data', {
        rows: snapshot.masterData.rows,
        fileName: snapshot.masterData.fileName || 'Snapshot Master',
      });
      saveMasterToNeon(snapshot.masterData.rows, snapshot.masterData.fileName || 'Snapshot Master').catch((e) =>
        console.warn('Neon snapshot master save skipped:', e)
      );
      if (isSupabaseConfigured()) {
        saveMasterToCloud(snapshot.masterData.rows, snapshot.masterData.fileName || 'Snapshot Master');
      }
    }

    if (snapshot.targetData && Array.isArray(snapshot.targetData.rows)) {
      setTargetRows(snapshot.targetData.rows);
      setTargetFileName(snapshot.targetData.fileName || 'Snapshot Target');
      setInitialTargetCount(snapshot.targetData.initialCount || snapshot.targetData.rows.length);
      setMatchedDone(snapshot.targetData.matchedDone || false);

      persistTargetData({
        rows: snapshot.targetData.rows,
        fileName: snapshot.targetData.fileName || 'Snapshot Target',
        initialCount: snapshot.targetData.initialCount || snapshot.targetData.rows.length,
        matchedDone: snapshot.targetData.matchedDone || false,
      });
    }

    setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    setIsSnapshotModalOpen(false);
  };

  return (
    <div className="layout-wrapper">
      {/* 1. Velzon Left Sidebar (Dashboard, Data Master, Data Cek) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
      />

      {/* 2. Main Content Area */}
      <div className="main-content">
        <Topbar
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          isNeonConnected={isNeonConnected}
          isCloudConnected={isCloudConnected}
          lastSyncedAt={lastSyncedAt}
          onOpenSnapshotModal={() => setIsSnapshotModalOpen(true)}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        />

        <main className="page-content">
          {/* MENU 1: DASHBOARD (EXECUTIVE OPERATIONAL ANALYST DASHBOARD) */}
          {activeTab === 'dashboard' && (
          <>
            {/* Toolbar Filter Wilayah Dashboard - Mengontrol seluruh metrik, grafik, dan anomali */}
            {wilayahList.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                  background: '#ffffff',
                  border: '1px solid #e9ebec',
                  borderRadius: '6px',
                  padding: '0.65rem 1rem',
                  boxShadow: '0 1px 2px rgba(56, 65, 74, 0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      background: 'rgba(64, 81, 137, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#405189',
                    }}
                  >
                    <Filter size={15} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#212529' }}>
                      Filter Lingkup Wilayah
                    </span>
                    <span style={{ fontSize: '0.74rem', color: '#878a99', marginLeft: '0.5rem' }}>
                      {dashboardWilayahFilter === 'ALL'
                        ? `Menampilkan seluruh ${targetRows.length.toLocaleString('id-ID')} data (${wilayahList.length} Wilayah)`
                        : `Menampilkan khusus ${formatWilayahName(dashboardWilayahFilter)} (${dashboardFilteredRows.length.toLocaleString('id-ID')} data)`}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label htmlFor="dashboard-wilayah-filter" style={{ fontSize: '0.76rem', fontWeight: 600, color: '#495057' }}>
                    Pilih Wilayah:
                  </label>
                  <select
                    id="dashboard-wilayah-filter"
                    value={dashboardWilayahFilter}
                    onChange={(e) => setDashboardWilayahFilter(e.target.value)}
                    className="filter-select"
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#405189',
                      border: '1px solid rgba(64, 81, 137, 0.3)',
                      borderRadius: '4px',
                      background: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="ALL">Semua Wilayah ({targetRows.length.toLocaleString('id-ID')} Data)</option>
                    {wilayahList.map((w) => {
                      const countW = targetRows.filter(r => String(r.Wilayah || '').trim() === String(w).trim()).length;
                      return (
                        <option key={w} value={w}>
                          {formatWilayahName(w)} ({countW.toLocaleString('id-ID')} Data)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

            <MetricCards
              stats={dashboardStats}
              masterCount={masterRows.length}
              multiCabangCount={masterHealth.multiOutletCount}
            />

            {/* 2 Visual Analisis: Dekomposisi Donut Chart & Kinerja Wilayah (Mengikuti Filter) */}
            <RegionalAnalyticsCharts
              stats={regionalStats}
              matchingStats={dashboardStats}
              totalDataCount={dashboardFilteredRows.length}
              selectedWilayah={dashboardWilayahFilter}
            />

            {/* Rekapitulasi Data Match per Wilayah & Download Laporan Excel/PDF */}
            <DashboardMatchTable
              allTargetRows={targetRows}
              regionalStats={regionalStats}
              selectedWilayah={dashboardWilayahFilter}
            />
          </>
        )}

        {/* MENU 2: DATA MASTER (MANAJEMEN REFERENSI CABANG) */}
        {activeTab === 'master' && (
          <>
            {/* Top Action Card: Upload Button & Template & Reset */}
            <div
              className="glass-card"
              style={{
                padding: '0.65rem 1.15rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '6px',
                    background: 'rgba(64, 81, 137, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#405189',
                  }}
                >
                  <Database size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                    Data Master
                  </h3>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsMasterUploadModalOpen(true)}
                  id="btn-open-upload-master"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.42rem 0.95rem' }}
                >
                  <UploadCloud size={14} />
                  <span>Upload Data Master</span>
                </button>



                {masterRows.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleResetMaster}
                    title="Kosongkan data master cabang"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: '#f06548',
                      borderColor: 'rgba(240, 101, 72, 0.3)',
                      padding: '0.42rem 0.85rem',
                    }}
                  >
                    <RotateCcw size={13} />
                    <span>Reset Master</span>
                  </button>
                )}
              </div>
            </div>

            {masterRows.length === 0 ? (
              <div
                className="glass-card"
                style={{
                  padding: '3.5rem 1.5rem',
                  textAlign: 'center',
                  background: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #e9ebec',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'rgba(64, 81, 137, 0.08)',
                    color: '#405189',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.85rem',
                  }}
                >
                  <Database size={24} />
                </div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#212529', margin: '0 0 0.35rem' }}>
                  Belum Ada Data Master Cabang
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#878a99', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
                  Silakan unggah berkas Excel master cabang & outlet sebagai basis referensi pencocokan. Berkas baru akan menambahkan cabang secara otomatis.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setIsMasterUploadModalOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 1.1rem' }}
                  >
                    <UploadCloud size={14} />
                    <span>Upload Data Master</span>
                  </button>

                </div>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '0.85rem 1.15rem' }}>
                {/* Header Title inside Card Removed */}


                {/* 2 SUB-TABS (VELZON UNDERLINE STYLE DI DALAM CARD) */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    borderBottom: '1px solid #e9ebec',
                    marginBottom: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Tab 1: Indikator Kesehatan Master */}
                  <button
                    type="button"
                    onClick={() => setMasterSubTab('health')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.65rem 1.1rem',
                      fontSize: '0.82rem',
                      fontWeight: masterSubTab === 'health' ? 600 : 500,
                      color: masterSubTab === 'health' ? (masterHealth.multiOutletCount > 0 ? '#d97706' : '#0ab39c') : '#878a99',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: masterSubTab === 'health' ? `2px solid ${masterHealth.multiOutletCount > 0 ? '#f7b84b' : '#0ab39c'}` : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      marginBottom: '-1px',
                    }}
                    id="tab-btn-master-health"
                  >
                    <ShieldAlert size={14} color={masterSubTab === 'health' ? (masterHealth.multiOutletCount > 0 ? '#d97706' : '#0ab39c') : '#878a99'} />
                    <span>Indikator Kesehatan Master</span>
                    <span
                      style={{
                        padding: '0.12rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: masterHealth.multiOutletCount > 0 ? 'rgba(247, 184, 75, 0.15)' : 'rgba(10, 179, 156, 0.12)',
                        color: masterHealth.multiOutletCount > 0 ? '#d97706' : '#0ab39c',
                        border: masterHealth.multiOutletCount > 0 ? '1px solid rgba(247, 184, 75, 0.3)' : '1px solid rgba(10, 179, 156, 0.25)',
                      }}
                    >
                      {masterHealth.multiOutletCount > 0 ? `${masterHealth.multiOutletCount} Multi-Cabang` : '100% Optimal'}
                    </span>
                  </button>

                  {/* Tab 2: Data Grid Master Cabang */}
                  <button
                    type="button"
                    onClick={() => setMasterSubTab('grid')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.65rem 1.1rem',
                      fontSize: '0.82rem',
                      fontWeight: masterSubTab === 'grid' ? 600 : 500,
                      color: masterSubTab === 'grid' ? '#3577f1' : '#878a99',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: masterSubTab === 'grid' ? '2px solid #3577f1' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      marginBottom: '-1px',
                    }}
                    id="tab-btn-master-grid"
                  >
                    <Database size={14} color={masterSubTab === 'grid' ? '#3577f1' : '#878a99'} />
                    <span>Data Grid Master Cabang</span>
                    <span
                      style={{
                        padding: '0.12rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: 'rgba(53, 119, 241, 0.1)',
                        color: '#3577f1',
                        border: '1px solid rgba(53, 119, 241, 0.25)',
                      }}
                    >
                      {masterRows.length.toLocaleString('id-ID')} Baris
                    </span>
                  </button>
                </div>

                {/* Sub-Tab Content inside Single Card */}
                {masterSubTab === 'health' ? (
                  <MasterHealthCard health={masterHealth} />
                ) : (
                  <MasterDataGrid masterRows={masterRows} />
                )}
              </div>
            )}
          </>
        )}

        {/* MENU 3: DATA YANG AKAN DICOCOKAN (WORKING & EXECUTION ENGINE) */}
        {activeTab === 'working' && (
          <>
            {/* Top Action Card: Upload Button & Template & Reset */}
            <div
              className="glass-card"
              style={{
                padding: '0.55rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.65rem',
                marginBottom: '0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '5px',
                    background: 'rgba(53, 119, 241, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3577f1',
                  }}
                >
                  <Layers size={15} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                    Data Target
                  </h3>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsTargetUploadModalOpen(true)}
                  id="btn-open-upload-target"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.75rem' }}
                >
                  <UploadCloud size={13} />
                  <span>Upload Data Cek</span>
                </button>

                {/* Reset Hasil Match: Hanya muncul jika proses pencocokan sudah selesai */}
                {matchedDone && targetRows.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleResetMatchingResults}
                    title="Kembalikan status data target ke kondisi awal upload untuk mencocokkan ulang tanpa menghapus berkas"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      color: '#405189',
                      borderColor: 'rgba(64, 81, 137, 0.3)',
                      padding: '0.3rem 0.7rem',
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>Reset Hasil Match</span>
                  </button>
                )}

                {targetRows.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleResetTarget}
                    title="Kosongkan seluruh data target operasional"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      color: '#f06548',
                      borderColor: 'rgba(240, 101, 72, 0.3)',
                      padding: '0.3rem 0.7rem',
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>Kosongkan Data Cek</span>
                  </button>
                )}
              </div>
            </div>

            {targetRows.length === 0 ? (
              <div
                className="glass-card"
                style={{
                  padding: '3.5rem 1.5rem',
                  textAlign: 'center',
                  background: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #e9ebec',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'rgba(53, 119, 241, 0.08)',
                    color: '#3577f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.85rem',
                  }}
                >
                  <Layers size={24} />
                </div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#212529', margin: '0 0 0.35rem' }}>
                  Belum Ada Data Target Operasional
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#878a99', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
                  Silakan unggah berkas Excel target untuk memulai pencocokan kode pos dan nama cabang. File baru akan otomatis menambahkan baris data (append).
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setIsTargetUploadModalOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 1.1rem' }}
                  >
                    <UploadCloud size={14} />
                    <span>Upload Data Cek</span>
                  </button>

                </div>
              </div>
            ) : (
              <>
                {isProcessing && (
                  <ProgressBar
                    isProcessing={isProcessing}
                    progress={progress}
                    processedCount={processedCount}
                    totalCount={targetRows.length}
                    durationMs={durationMs}
                  />
                )}

                <TargetDataGrid
                  rows={filteredTargetRows}
                  totalInputRows={initialTargetCount}
                  masterRows={masterRows}
                  wilayahList={wilayahList}
                  selectedWilayah={selectedWilayah}
                  onWilayahChange={setSelectedWilayah}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  onExecuteMatching={handleExecuteMatching}
                  onApproveAllRecommendations={handleApproveAllRecommendations}
                  onApproveRecommendation={handleApproveSingleRecommendation}
                  isProcessing={isProcessing}
                  canExecute={targetRows.length > 0 && masterRows.length > 0}
                  matchedDone={matchedDone}
                  onRevertRecommendation={handleRevertRecommendation}
                />

                <ExportAction
                  allTargetRows={targetRows}
                  filteredRows={filteredTargetRows}
                  selectedWilayah={selectedWilayah}
                  totalInputRows={initialTargetCount}
                />
              </>
            )}
          </>
        )}
        </main>
      </div>

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConnectedChange={setIsCloudConnected}
      />

      {/* Master Upload Modal */}
      <MasterUploadModal
        isOpen={isMasterUploadModalOpen}
        onClose={() => setIsMasterUploadModalOpen(false)}
        onMasterLoaded={handleMasterLoaded}
        currentMasterCount={masterRows.length}
        existingMasterRows={masterRows}
      />

      {/* Target Upload Modal */}
      <TargetUploadModal
        isOpen={isTargetUploadModalOpen}
        onClose={() => setIsTargetUploadModalOpen(false)}
        onTargetLoaded={handleTargetLoaded}
        currentTargetCount={targetRows.length}
      />

      {/* Snapshot Backup / Restore Modal */}
      <SnapshotModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        masterRows={masterRows}
        targetRows={targetRows}
        targetFileName={targetFileName}
        initialTargetCount={initialTargetCount}
        matchedDone={matchedDone}
        onRestoreSnapshot={handleRestoreSnapshot}
      />
    </div>
  );
};

export default App;
