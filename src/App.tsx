import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MetricCards } from './components/Dashboard/MetricCards';
import { RegionalAnalyticsCharts } from './components/Dashboard/RegionalAnalyticsCharts';
import { MasterDuplicateChart } from './components/Dashboard/MasterDuplicateChart';
import { IndonesiaBranchMap } from './components/Dashboard/IndonesiaBranchMap';
import { DashboardMatchTable } from './components/Dashboard/DashboardMatchTable';
import { CabangManager } from './components/MasterData/CabangManager';
import { TargetUploadModal } from './components/WorkingEngine/TargetUploadModal';
import { ProgressBar } from './components/WorkingEngine/ProgressBar';
import { TargetDataGrid } from './components/WorkingEngine/TargetDataGrid';
import { ExportAction } from './components/WorkingEngine/ExportAction';
import { WilayahManager } from './components/WilayahData/WilayahManager';
import { PTENManager } from './components/PTENData/PTENManager';
import { RoleMappingManager } from './components/RoleMapping/RoleMappingManager';
import type { ActiveTab } from './components/Sidebar';

import type { MasterRow, TargetRow, MatchingStats, WilayahStat, WilayahSetting } from './types';
import type { RecommendationResult } from './utils/recommender';
import { buildMasterIndex, analyzeMasterHealth, executeChunkMatching } from './utils/matcher';
import { formatWilayahName, extractWilayahFromBranchCode } from './utils/normalizer';
import type { RoleMappingRecord } from './components/RoleMapping/RoleMappingManager';
import { DEFAULT_ROLE_MAPPING_DATA } from './components/RoleMapping/RoleMappingManager';
import type { PTENRecord } from './components/PTENData/PTENManager';
import { DEFAULT_PTEN_DATA } from './components/PTENData/defaultPtenData';
import { buildPtenIndex, validatePtenForTarget } from './utils/ptenMatcher';
import { resolveRoleMappingForBranch } from './utils/roleMatcher';

import { getItem, setItem } from './utils/storage';
import {
  checkNeonStatus,
  loadMasterFromNeon,
  saveMasterToNeon,
  clearMasterFromNeon,
  loadTargetFromNeon,
  saveTargetToNeon,
  clearTargetFromNeon,
  loadWilayahFromNeon,
  saveWilayahToNeon,
} from './utils/neonSync';
import { NeonDatabaseModal } from './components/NeonDatabaseModal';
import { SnapshotModal, type WorkspaceSnapshot } from './components/SnapshotModal';
import { DEFAULT_WILAYAH_DATA, normalizeWilayahItem } from './utils/defaultWilayah';
import { Filter, UploadCloud, RotateCcw, Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isNeonModalOpen, setIsNeonModalOpen] = useState<boolean>(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState<boolean>(false);
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

  const [isNeonConnected, setIsNeonConnected] = useState<boolean>(false);

  // Master Data State (Clean state for real data upload)
  const [masterRows, setMasterRows] = useState<MasterRow[]>([]);

  // Target Data State (Clean state for real data upload)
  const [targetRows, setTargetRows] = useState<TargetRow[]>([]);
  const [initialTargetCount, setInitialTargetCount] = useState<number>(0);
  const [targetFileName, setTargetFileName] = useState<string>('');
  const [wilayahSettings, setWilayahSettings] = useState<WilayahSetting[]>(DEFAULT_WILAYAH_DATA);
  const [ptenList, setPtenList] = useState<PTENRecord[]>(DEFAULT_PTEN_DATA);
  const [roleMappingList, setRoleMappingList] = useState<RoleMappingRecord[]>(DEFAULT_ROLE_MAPPING_DATA);
  const [ptenCount, setPtenCount] = useState<number>(DEFAULT_PTEN_DATA.length);
  const [roleMappingCount, setRoleMappingCount] = useState<number>(DEFAULT_ROLE_MAPPING_DATA.length);

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

  // Build In-Memory PTEN Fast Lookup Map O(1) with Multi-Source Fallback
  const ptenIndex = useMemo(() => {
    return buildPtenIndex(ptenList, masterRows);
  }, [ptenList, masterRows]);

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
        const [savedMaster, savedTarget, savedWilayah, savedPten, savedRoleMapping] = await Promise.all([
          getItem<{ rows: MasterRow[]; fileName: string }>('master_data').catch(() => null),
          getItem<{
            rows: TargetRow[];
            fileName: string;
            initialCount: number;
            matchedDone: boolean;
          }>('target_data').catch(() => null),
          getItem<WilayahSetting[]>('wilayah_settings').catch(() => null),
          getItem<PTENRecord[]>('pten_master_data').catch(() => null),
          getItem<RoleMappingRecord[]>('role_mapping_data').catch(() => null),
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

        if (savedWilayah && Array.isArray(savedWilayah) && savedWilayah.length > 0) {
          const normalized = savedWilayah.map((s, idx) => normalizeWilayahItem(s, idx));
          setWilayahSettings(normalized);
          setItem('wilayah_settings', normalized);
        } else {
          setWilayahSettings(DEFAULT_WILAYAH_DATA);
          setItem('wilayah_settings', DEFAULT_WILAYAH_DATA);
        }

        if (savedPten && Array.isArray(savedPten) && savedPten.length > 500) {
          setPtenList(savedPten);
          setPtenCount(savedPten.length);
        } else {
          setPtenList(DEFAULT_PTEN_DATA);
          setPtenCount(DEFAULT_PTEN_DATA.length);
          setItem('pten_master_data', DEFAULT_PTEN_DATA);
        }

        if (savedRoleMapping && Array.isArray(savedRoleMapping) && savedRoleMapping.length > 0) {
          setRoleMappingList(savedRoleMapping);
          setRoleMappingCount(savedRoleMapping.length);
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
          const [neonCheck, neonMaster, neonTarget, neonWilayah] = await Promise.allSettled([
            checkNeonStatus(),
            loadMasterFromNeon(),
            loadTargetFromNeon(),
            loadWilayahFromNeon(),
          ]);

          if (neonCheck.status === 'fulfilled' && neonCheck.value.connected) {
            setIsNeonConnected(true);
            setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
          }

          if (neonMaster.status === 'fulfilled' && neonMaster.value && neonMaster.value.rows.length > 0) {
            setMasterRows(neonMaster.value.rows);
          }

          if (neonTarget.status === 'fulfilled' && neonTarget.value && neonTarget.value.rows.length > 0) {
            setTargetRows(neonTarget.value.rows);
            setTargetFileName(neonTarget.value.fileName || '');
            setInitialTargetCount(neonTarget.value.initialCount || neonTarget.value.rows.length);
            setMatchedDone(neonTarget.value.matchedDone || false);
          }

          if (neonWilayah.status === 'fulfilled' && neonWilayah.value && neonWilayah.value.length > 0) {
            const normalized = neonWilayah.value.map((s, idx) => normalizeWilayahItem(s, idx));
            setWilayahSettings(normalized);
            setItem('wilayah_settings', normalized);
          } else if (neonCheck.status === 'fulfilled' && neonCheck.value.connected) {
            await saveWilayahToNeon(DEFAULT_WILAYAH_DATA);
          }
        } catch (cloudErr) {
          console.warn('Background Neon sync skipped:', cloudErr);
        }
      })();
    };

    restoreSavedData();
  }, []);

  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to persist target & match data across IndexedDB, Neon Postgres, and Supabase Cloud
  const persistTargetData = (
    payload: {
      rows: TargetRow[];
      fileName: string;
      initialCount: number;
      matchedDone: boolean;
    },
    immediate = false
  ) => {
    // 1. Local IndexedDB (Instant non-blocking local cache)
    setItem('target_data', payload);

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    const syncRemote = () => {
      // 2. Neon Postgres (Serverless DB on Vercel)
      saveTargetToNeon(payload).catch((e) => console.warn('Neon target auto-save skipped:', e));

      setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    };

    if (immediate) {
      syncRemote();
    } else {
      // 350ms trailing debounce: eliminates network I/O lag during rapid batch actions
      persistTimeoutRef.current = setTimeout(syncRemote, 350);
    }
  };

  // Compute Wilayah List from Target Data, Master Data, and Wilayah Settings
  const wilayahList = useMemo(() => {
    const set = new Set<string>();
    // 1. Dari Wilayah Settings (Setting Wilayah)
    wilayahSettings.forEach((s) => {
      const label = s.keterangan || s.namaOutlet || (s.wilayah ? `Wilayah ${s.wilayah}` : '');
      if (label && label.trim()) {
        set.add(formatWilayahName(label.trim()));
      }
    });
    // 2. Dari Data Target
    targetRows.forEach((r) => {
      if (r.Wilayah && String(r.Wilayah).trim()) {
        set.add(formatWilayahName(String(r.Wilayah).trim()));
      }
    });
    // 3. Dari Data Master
    masterRows.forEach((m) => {
      if (m.Wilayah && String(m.Wilayah).trim()) {
        set.add(formatWilayahName(String(m.Wilayah).trim()));
      }
    });
    return Array.from(set)
      .filter((w) => w && w !== 'Tanpa Wilayah')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [targetRows, masterRows, wilayahSettings]);

  // Pre-aggregated count of target rows per wilayah (O(N) single pass instead of O(N*M))
  const targetWilayahCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < targetRows.length; i++) {
      const w = String(targetRows[i].Wilayah || '').trim();
      if (w) {
        map.set(w, (map.get(w) || 0) + 1);
      }
    }
    return map;
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

    return Array.from(map.entries())
      .map(([wilayah, data]) => ({
        wilayah,
        total: data.total,
        matched: data.matched,
        unmatched: data.unmatched,
        rate: data.total > 0 ? (data.matched / data.total) * 100 : 0,
      }))
      .sort((a, b) => {
        const nameA = formatWilayahName(a.wilayah);
        const nameB = formatWilayahName(b.wilayah);
        return nameA.localeCompare(nameB, 'id', { numeric: true, sensitivity: 'base' });
      });
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
        1200, // Chunk size
        wilayahSettings,
        roleMappingList,
        ptenIndex
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
      } catch (e) {
        console.warn('Reset master error:', e);
      }
    }
  };

  // Target Actions (Uploads new rows with strict Excel order preservation & immediate PTEN/Role validation)
  const handleTargetLoaded = (
    newRows: TargetRow[],
    fileName: string,
    mode: 'replace' | 'append' = 'replace'
  ) => {
    setTargetRows((prev) => {
      let finalRows: TargetRow[];
      if (mode === 'append' && prev.length > 0) {
        const startNo = prev.length;
        const indexedNewRows = newRows.map((r, idx) => {
          // 1. Validasi PTEN Instan
          const ptenRes = validatePtenForTarget(r['KODE POS'], r['Dati II'] || r.Kota || '', ptenIndex);
          // 2. Validasi Role Mapping jika ada nama cabang
          const branchCandidate = r['Nama Outlet'] || r.Cabang || r['Sandi Cabang'] || r.Sandi || '';
          const roleRes = resolveRoleMappingForBranch(
            branchCandidate,
            r['Dati II'] || r.Kota,
            r.Kelurahan,
            r.Kecamatan,
            r.ALAMAT,
            roleMappingList
          );

          return {
            ...r,
            No: r.No !== undefined && String(r.No).trim() !== '' ? r.No : startNo + idx + 1,
            _excelRowIndex: startNo + idx + 1,
            'KOTA PTEN': r['KOTA PTEN'] || ptenRes.kotaPten,
            'KODE POS PTEN': r['KODE POS PTEN'] || ptenRes.kodePosPten,
            'CEK KODE POS + PTEN': r['CEK KODE POS + PTEN'] || ptenRes.statusPten,
            organisasiRole: roleRes?.organisasiRole || r.organisasiRole,
            tipeUnitRole: roleRes?.tipeUnitRole || r.tipeUnitRole,
            alurWondr: roleRes?.alurWondr || r.alurWondr,
            flowDescription: roleRes?.flowDescription || r.flowDescription,
            roleCabsal: roleRes?.qrsCabsal ?? r.roleCabsal,
            roleCabapv1: roleRes?.qrsCabapv1 ?? r.roleCabapv1,
            roleCabapv2: roleRes?.qrsCabapv2 ?? r.roleCabapv2,
            roleGrandTotal: roleRes?.grandTotal ?? r.roleGrandTotal,
          };
        });
        finalRows = [...prev, ...indexedNewRows];
      } else {
        // Mode Replace (default): Urutan 100% murni persis sesuai file Excel yang diunggah
        finalRows = newRows.map((r, idx) => {
          const ptenRes = validatePtenForTarget(r['KODE POS'], r['Dati II'] || r.Kota || '', ptenIndex);
          const branchCandidate = r['Nama Outlet'] || r.Cabang || r['Sandi Cabang'] || r.Sandi || '';
          const roleRes = resolveRoleMappingForBranch(
            branchCandidate,
            r['Dati II'] || r.Kota,
            r.Kelurahan,
            r.Kecamatan,
            r.ALAMAT,
            roleMappingList
          );

          return {
            ...r,
            No: r.No !== undefined && String(r.No).trim() !== '' ? r.No : idx + 1,
            _excelRowIndex: idx + 1,
            'KOTA PTEN': r['KOTA PTEN'] || ptenRes.kotaPten,
            'KODE POS PTEN': r['KODE POS PTEN'] || ptenRes.kodePosPten,
            'CEK KODE POS + PTEN': r['CEK KODE POS + PTEN'] || ptenRes.statusPten,
            organisasiRole: roleRes?.organisasiRole || r.organisasiRole,
            tipeUnitRole: roleRes?.tipeUnitRole || r.tipeUnitRole,
            alurWondr: roleRes?.alurWondr || r.alurWondr,
            flowDescription: roleRes?.flowDescription || r.flowDescription,
            roleCabsal: roleRes?.qrsCabsal ?? r.roleCabsal,
            roleCabapv1: roleRes?.qrsCabapv1 ?? r.roleCabapv1,
            roleCabapv2: roleRes?.qrsCabapv2 ?? r.roleCabapv2,
            roleGrandTotal: roleRes?.grandTotal ?? r.roleGrandTotal,
          };
        });
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

  // Setujui Semua Rekomendasi: Mengisi atribut master ke baris target yang cocok, diperkaya PTEN & Mapping Role
  const handleApproveAllRecommendations = (recs: RecommendationResult[]) => {
    if (recs.length === 0) return;
    const recMap = new Map<string, MasterRow>();
    recs.forEach((r) => {
      if (r?.targetRow?.No !== undefined && r.recommendedMaster) {
        recMap.set(String(r.targetRow.No).trim(), r.recommendedMaster);
      }
    });

    setTargetRows((prev) => {
      const updated = prev.map((row) => {
        const rowNoKey = String(row.No).trim();
        const matchedMaster = recMap.get(rowNoKey);
        if (!matchedMaster) return row;

        const branchCode = matchedMaster['Branch Code'] || matchedMaster['Kode Cabang'] || '';
        const resolved = extractWilayahFromBranchCode(
          branchCode,
          wilayahSettings,
          matchedMaster.Wilayah || row.Wilayah || '-'
        );

        // Validasi PTEN & Role Mapping untuk rekomendasi
        const ptenRes = validatePtenForTarget(row['KODE POS'], row['Dati II'] || row.Kota || '', ptenIndex);
        const branchNameToLook = matchedMaster['Nama Outlet'] || matchedMaster.Cabang || matchedMaster['Sandi Cabang'] || '';
        const roleRes = resolveRoleMappingForBranch(
          branchNameToLook,
          row['Dati II'] || row.Kota,
          row.Kelurahan,
          row.Kecamatan,
          row.ALAMAT || matchedMaster.ALAMAT,
          roleMappingList
        );

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
          'Branch Code': branchCode,
          'Kode Cabang': matchedMaster['Kode Cabang'] || '',
          'Nama Outlet': matchedMaster['Nama Outlet'] || '',
          'Status Outlet': matchedMaster['Status Outlet'] || 'Aktif',
          ALAMAT: matchedMaster.ALAMAT || '',
          Wilayah: resolved.wilayahName !== '-' ? resolved.wilayahName : (row.Wilayah || '-'),
          'KOTA PTEN': ptenRes.kotaPten,
          'KODE POS PTEN': ptenRes.kodePosPten,
          'CEK KODE POS + PTEN': ptenRes.statusPten,
          organisasiRole: roleRes?.organisasiRole || row.organisasiRole,
          tipeUnitRole: roleRes?.tipeUnitRole || row.tipeUnitRole,
          alurWondr: roleRes?.alurWondr || row.alurWondr,
          flowDescription: roleRes?.flowDescription || row.flowDescription,
          roleCabsal: roleRes?.qrsCabsal ?? row.roleCabsal,
          roleCabapv1: roleRes?.qrsCabapv1 ?? row.roleCabapv1,
          roleCabapv2: roleRes?.qrsCabapv2 ?? row.roleCabapv2,
          roleGrandTotal: roleRes?.grandTotal ?? row.roleGrandTotal,
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
    const targetNoStr = String(rowNo).trim();
    setTargetRows((prev) => {
      const updated = prev.map((row) => {
        if (String(row.No).trim() !== targetNoStr) return row;

        const branchCode = matchedMaster['Branch Code'] || matchedMaster['Kode Cabang'] || '';
        const resolved = extractWilayahFromBranchCode(
          branchCode,
          wilayahSettings,
          matchedMaster.Wilayah || row.Wilayah || '-'
        );

        // Validasi PTEN & Role Mapping
        const ptenRes = validatePtenForTarget(row['KODE POS'], row['Dati II'] || row.Kota || '', ptenIndex);
        const branchNameToLook = matchedMaster['Nama Outlet'] || matchedMaster.Cabang || matchedMaster['Sandi Cabang'] || '';
        const roleRes = resolveRoleMappingForBranch(
          branchNameToLook,
          row['Dati II'] || row.Kota,
          row.Kelurahan,
          row.Kecamatan,
          row.ALAMAT || matchedMaster.ALAMAT,
          roleMappingList
        );

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
          'Branch Code': branchCode,
          'Kode Cabang': matchedMaster['Kode Cabang'] || '',
          'Nama Outlet': matchedMaster['Nama Outlet'] || '',
          'Status Outlet': matchedMaster['Status Outlet'] || 'Aktif',
          ALAMAT: matchedMaster.ALAMAT || '',
          Wilayah: resolved.wilayahName !== '-' ? resolved.wilayahName : (row.Wilayah || '-'),
          'KOTA PTEN': ptenRes.kotaPten,
          'KODE POS PTEN': ptenRes.kodePosPten,
          'CEK KODE POS + PTEN': ptenRes.statusPten,
          organisasiRole: roleRes?.organisasiRole || row.organisasiRole,
          tipeUnitRole: roleRes?.tipeUnitRole || row.tipeUnitRole,
          alurWondr: roleRes?.alurWondr || row.alurWondr,
          flowDescription: roleRes?.flowDescription || row.flowDescription,
          roleCabsal: roleRes?.qrsCabsal ?? row.roleCabsal,
          roleCabapv1: roleRes?.qrsCabapv1 ?? row.roleCabapv1,
          roleCabapv2: roleRes?.qrsCabapv2 ?? row.roleCabapv2,
          roleGrandTotal: roleRes?.grandTotal ?? row.roleGrandTotal,
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
    const targetNoStr = String(rowNo).trim();
    setTargetRows((prev) => {
      const updated = prev.map((row) => {
        if (String(row.No).trim() !== targetNoStr) return row;

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
      {/* 1. Velzon Left Sidebar (Dashboard, Data Analisa, Data Master) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        masterCount={masterRows.length}
        targetCount={targetRows.length}
        wilayahCount={wilayahSettings.length}
        ptenCount={ptenCount}
        roleMappingCount={roleMappingCount}
      />

      {/* 2. Main Content Area */}
      <div className="main-content">
        <Topbar
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          isNeonConnected={isNeonConnected}
          lastSyncedAt={lastSyncedAt}
          onOpenSnapshotModal={() => setIsSnapshotModalOpen(true)}
          onOpenNeonModal={() => setIsNeonModalOpen(true)}
        />

        <main className="page-content">
          {/* MENU 1: DASHBOARD (EXECUTIVE OPERATIONAL ANALYST DASHBOARD) */}
          {activeTab === 'dashboard' && (
            <div>
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
                    <div className="unified-select-box" style={{ width: '220px' }}>
                      <Filter size={13} style={{ color: '#405189', flexShrink: 0 }} />
                      <select
                        id="dashboard-wilayah-filter"
                        value={dashboardWilayahFilter}
                        onChange={(e) => setDashboardWilayahFilter(e.target.value)}
                      >
                        <option value="ALL">Semua Wilayah ({targetRows.length.toLocaleString('id-ID')} Data)</option>
                        {wilayahList.map((w) => {
                          const countW = targetWilayahCounts.get(String(w).trim()) || 0;
                          return (
                            <option key={w} value={w}>
                              {formatWilayahName(w)} ({countW.toLocaleString('id-ID')} Data)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <MetricCards
                stats={dashboardStats}
                masterCount={masterRows.length}
                multiCabangCount={masterHealth.multiOutletCount}
              />

              {/* URUTAN KE-2: Peta Tracking Penyebaran Cabang BNI di Indonesia (GIS & Google Maps Direct Link) */}
              <IndonesiaBranchMap
                masterRows={masterRows}
                targetRows={targetRows}
                selectedWilayah={dashboardWilayahFilter}
                onNavigateToMaster={() => setActiveTab('master')}
                onNavigateToEngine={(searchFilter) => {
                  setActiveTab('working');
                  if (searchFilter) setSearchTerm(searchFilter);
                }}
              />

              {/* Visual Analisis: Dekomposisi Donut Chart & Kinerja Wilayah */}
              <RegionalAnalyticsCharts
                stats={regionalStats}
                matchingStats={dashboardStats}
                totalDataCount={dashboardFilteredRows.length}
                selectedWilayah={dashboardWilayahFilter}
              />

              {/* Visualisasi Data Master Duplikat / Multi-Cabang per Kode Pos */}
              <MasterDuplicateChart
                masterHealth={masterHealth}
                masterRows={masterRows}
                selectedWilayah={dashboardWilayahFilter}
                onNavigateToMaster={() => setActiveTab('master')}
              />

              {/* Rekapitulasi Data Match per Wilayah & Download Laporan Excel/PDF */}
              <DashboardMatchTable
                allTargetRows={targetRows}
                regionalStats={regionalStats}
                selectedWilayah={dashboardWilayahFilter}
              />
            </div>
          )}

          {/* MENU 2: DATA MASTER (MANAJEMEN REFERENSI CABANG) */}
          {activeTab === 'master' && (
            <CabangManager
              masterRows={masterRows}
              onMasterLoaded={handleMasterLoaded}
              onResetMaster={handleResetMaster}
              masterHealth={masterHealth}
              wilayahSettings={wilayahSettings}
            />
          )}

          {/* MENU 3: DATA YANG AKAN DICOCOKAN (WORKING & EXECUTION ENGINE) */}
          {activeTab === 'working' && (
            <div>
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
                      Data Analisa Pencocokan
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
                    <span>Upload Data Excel</span>
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

                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      if (window.confirm('Kosongkan seluruh data Target Cek dari sesi ini?')) {
                        handleResetTarget();
                      }
                    }}
                    style={{ color: '#f06548', borderColor: 'rgba(240, 101, 72, 0.3)', padding: '0.3rem 0.75rem' }}
                    title="Kosongkan seluruh data target"
                  >
                    <RotateCcw size={13} />
                    <span>Reset Data</span>
                  </button>
                </div>
              </div>

              {targetRows.length === 0 ? (
                <div
                  className="glass-card"
                  style={{
                    padding: '3.5rem 2rem',
                    textAlign: 'center',
                    borderRadius: '8px',
                    border: '1px dashed #ced4da',
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'rgba(53, 119, 241, 0.08)',
                      color: '#3577f1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Layers size={28} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#212529', margin: '0 0 0.4rem' }}>
                      Belum Ada Data yang Diunggah untuk Dicocokan
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: '#878a99', maxWidth: '420px', margin: 0, lineHeight: 1.5 }}>
                      Silakan unggah berkas Excel data target (transaksi/merchant/EDC) untuk memulai proses pencocokan otomatis.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsTargetUploadModalOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.25rem' }}
                  >
                    <UploadCloud size={16} />
                    <span>Pilih Berkas Target Excel</span>
                  </button>
                </div>
              ) : (
                <>
                  <ProgressBar
                    isProcessing={isProcessing}
                    progress={progress}
                    processedCount={processedCount}
                    totalCount={initialTargetCount}
                    durationMs={durationMs}
                  />

                  <TargetDataGrid
                    rows={targetRows}
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
                    wilayahSettings={wilayahSettings}
                    roleMappingList={roleMappingList}
                  />

                  <ExportAction
                    allTargetRows={targetRows}
                    filteredRows={filteredTargetRows}
                    selectedWilayah={selectedWilayah}
                    totalInputRows={initialTargetCount}
                  />
                </>
              )}
            </div>
          )}

          {/* MENU MASTER: SETTING WILAYAH */}
          {activeTab === 'wilayah' && (
            <WilayahManager
              initialSettings={wilayahSettings}
              onSettingsSaved={(newSettings) => {
                setWilayahSettings(newSettings);
                setItem('wilayah_settings', newSettings);
              }}
            />
          )}

          {/* MENU MASTER: DATA PTEN */}
          {activeTab === 'pten' && (
            <PTENManager
              targetRows={targetRows}
              masterRows={masterRows}
              onPtenCountChange={(count) => setPtenCount(count)}
            />
          )}

          {/* MENU MASTER: MAPPING ROLE */}
          {activeTab === 'mapping_role' && (
            <RoleMappingManager
              onRoleMappingCountChange={(count) => setRoleMappingCount(count)}
            />
          )}
        </main>
      </div>

      <NeonDatabaseModal
        isOpen={isNeonModalOpen}
        onClose={() => setIsNeonModalOpen(false)}
        onConnectedChange={setIsNeonConnected}
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
