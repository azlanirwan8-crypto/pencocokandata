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
import { WilayahManager } from './components/WilayahData/WilayahManager';
import { PTENManager } from './components/PTENData/PTENManager';
import { RoleMappingManager } from './components/RoleMapping/RoleMappingManager';
import { KodePosManager } from './components/KodePosData/KodePosManager';
import { AnalystCanvas } from './components/WorkingEngine/AnalystCanvas';
import { AnalystResultsGrid } from './components/WorkingEngine/AnalystResultsGrid';
import { executeAnalystPipeline, type AnalystRow, type AnalystCoverage } from './utils/analystPipeline';
import type { ActiveTab } from './components/Sidebar';

import type { MasterRow, TargetRow, MatchingStats, WilayahStat, WilayahSetting } from './types';
import { buildMasterIndex, analyzeMasterHealth } from './utils/matcher';
import { formatWilayahName } from './utils/normalizer';
import type { RoleMappingRecord } from './components/RoleMapping/RoleMappingManager';
import { DEFAULT_ROLE_MAPPING_DATA } from './components/RoleMapping/RoleMappingManager';
import type { PTENRecord } from './components/PTENData/PTENManager';
import { DEFAULT_PTEN_DATA } from './components/PTENData/defaultPtenData';
import { DEFAULT_KODEPOS_DATA } from './components/KodePosData/defaultKodePosData';
import { buildPtenIndex, validatePtenForTarget } from './utils/ptenMatcher';

import { getItem, setItem, deleteKey } from './utils/storage';
import {
  checkNeonStatus,
  loadMasterFromNeon,
  saveMasterToNeon,
  clearMasterFromNeon,
  loadTargetFromNeon,
  saveTargetToNeon,
  loadWilayahFromNeon,
  saveWilayahToNeon,
  fetchKodePosExport,
  type KodePosRow,
} from './utils/neonSync';
import { NeonDatabaseModal } from './components/NeonDatabaseModal';
import { SnapshotModal, type WorkspaceSnapshot } from './components/SnapshotModal';
import { DEFAULT_WILAYAH_DATA, normalizeWilayahItem } from './utils/defaultWilayah';
import { Filter } from 'lucide-react';

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
  const [kodePosCount, setKodePosCount] = useState<number>(DEFAULT_KODEPOS_DATA.length);

  // New Data Analyst 3-Phase Engine State (100% Data Master Driven)
  const [analystRows, setAnalystRows] = useState<AnalystRow[]>([]);
  const [analystCoverage, setAnalystCoverage] = useState<AnalystCoverage | null>(null);
  // Full Master Kode Pos list (loaded once from Neon, cached in memory for pipeline runs)
  const kodePosListRef = useRef<KodePosRow[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analystProgress, setAnalystProgress] = useState<number>(0);
  const [analystMessage, setAnalystMessage] = useState<string>('');
  // Per-phase progress tracking
  const [phaseProgress, setPhaseProgress] = useState<{ 1: number; 2: number; 3: number }>({ 1: 0, 2: 0, 3: 0 });
  const [currentActivePhase, setCurrentActivePhase] = useState<0 | 1 | 2 | 3>(0);
  const [completedPhases, setCompletedPhases] = useState<Set<number>>(new Set());

  const [matchedDone, setMatchedDone] = useState<boolean>(false);

  // Filters State
  const [dashboardWilayahFilter, setDashboardWilayahFilter] = useState<string>('ALL');

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

        const savedKodePos = await getItem<any[]>('kodepos_master_data');
        if (savedKodePos && Array.isArray(savedKodePos) && savedKodePos.length > 0) {
          setKodePosCount(savedKodePos.length);
        } else {
          setKodePosCount(DEFAULT_KODEPOS_DATA.length);
          setItem('kodepos_master_data', DEFAULT_KODEPOS_DATA);
        }

        // HARD PURGE sekali: hapus permanen hasil Analisa lama (struktur lama tidak
        // kompatibel dengan pipeline berbasis kota PTEN + kodepos penuh)
        if (localStorage.getItem('analyst_purge_v2') !== 'done') {
          await deleteKey('analyst_results_data');
          localStorage.setItem('analyst_purge_v2', 'done');
        } else {
          const savedAnalyst = await getItem<AnalystRow[]>('analyst_results_data');
          if (savedAnalyst && Array.isArray(savedAnalyst) && savedAnalyst.length > 0) {
            setAnalystRows(savedAnalyst);
          }
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
            const neonRows = neonTarget.value.rows;
            const localTarget = await getItem<{
              rows: TargetRow[];
              fileName: string;
              initialCount: number;
              matchedDone: boolean;
            }>('target_data').catch(() => null);
            const localMatchedCount = (localTarget?.rows || []).filter((r) => r._isMatched).length;
            const neonMatchedCount = neonRows.filter((r) => r._isMatched).length;

            // PENTING: Hanya timpa state lokal jika data di Neon memiliki jumlah data match LEBIH BANYAK!
            // Jika data lokal IndexedDB memiliki data match lebih banyak (baru disetujui),
            // pertahankan data lokal dan langsung dorong (push) pembaruan tersebut ke Neon DB!
            if (neonMatchedCount > localMatchedCount) {
              setTargetRows(neonRows);
              setTargetFileName(neonTarget.value.fileName || '');
              setInitialTargetCount(neonTarget.value.initialCount || neonRows.length);
              setMatchedDone(neonTarget.value.matchedDone || false);
              setItem('target_data', { ...neonTarget.value, rows: neonRows }).catch(() => {});
            } else if (localTarget && localTarget.rows && localTarget.rows.length > 0) {
              // Data lokal lebih mutakhir -> sinkronkan data lokal ke Neon Postgres
              saveTargetToNeon(localTarget).catch(() => {});
            }
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

  // Helper to persist target & match data across IndexedDB and Neon Postgres asynchronously (0ms UI blocking)
  const persistTargetData = (
    payload: {
      rows: TargetRow[];
      fileName: string;
      initialCount: number;
      matchedDone: boolean;
    },
    immediate = false
  ) => {
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    const doPersist = () => {
      // 1. Local IndexedDB (Instant asynchronous cache write)
      setItem('target_data', payload).catch((e) => console.warn('IndexedDB auto-save skipped:', e));

      // 2. Neon Postgres (Serverless DB on Vercel)
      saveTargetToNeon(payload).catch((e) => console.warn('Neon target auto-save skipped:', e));

      setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    };

    if (immediate) {
      setTimeout(doPersist, 0);
    } else {
      // 400ms trailing debounce: eliminates network & storage I/O lag during rapid batch actions
      persistTimeoutRef.current = setTimeout(doPersist, 400);
    }
  };

  // Compute Wilayah List from Target Data, Master Data, and Wilayah Settings (Exact 17 Kanwil)
  const wilayahList = useMemo(() => {
    const set = new Set<string>();
    // 1. Dari Wilayah Settings (Setting Wilayah)
    wilayahSettings.forEach((s) => {
      const w = s.wilayah || s.kodeWilayah || s.keterangan || s.namaOutlet;
      if (w && String(w).trim()) {
        const norm = formatWilayahName(String(w).trim());
        if (norm && norm !== 'Tanpa Wilayah') set.add(norm);
      }
    });
    // 2. Dari Data Target
    targetRows.forEach((r) => {
      if (r.Wilayah && String(r.Wilayah).trim()) {
        const norm = formatWilayahName(String(r.Wilayah).trim());
        if (norm && norm !== 'Tanpa Wilayah') set.add(norm);
      }
    });
    // 3. Dari Data Master
    masterRows.forEach((m) => {
      if (m.Wilayah && String(m.Wilayah).trim()) {
        const norm = formatWilayahName(String(m.Wilayah).trim());
        if (norm && norm !== 'Tanpa Wilayah') set.add(norm);
      }
    });
    return Array.from(set)
      .filter((w) => w && w !== 'Tanpa Wilayah')
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
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

  // Execution Trigger for New Data Analyst Engine (3-Phase Pipeline)
  const handleStartAnalystPipeline = async (reRunAnomaliesOnly = false) => {
    setIsAnalyzing(true);
    setAnalystProgress(10);
    setAnalystMessage('Menyiapkan 5 Data Master & indeks memori O(1)...');
    // Reset per-phase progress
    setPhaseProgress({ 1: 0, 2: 0, 3: 0 });
    setCurrentActivePhase(1);
    setCompletedPhases(new Set());

    try {
      // ── Pastikan pipeline memakai SELURUH Master Kode Pos (puluhan ribu baris),
      //    bukan DEFAULT_KODEPOS_DATA yang cuma ~140 baris ──
      let kodePosForPipeline = kodePosListRef.current;
      if (!kodePosForPipeline) {
        setAnalystMessage('Mengunduh seluruh Master Data Kode Pos dari cloud (83 ribu+ baris)...');
        const cloudKodePos = await fetchKodePosExport({});
        if (cloudKodePos && cloudKodePos.length > 0) {
          kodePosForPipeline = cloudKodePos;
          setKodePosCount(cloudKodePos.length);
        } else {
          const savedKodePos = await getItem<KodePosRow[]>('kodepos_master_data');
          kodePosForPipeline =
            savedKodePos && savedKodePos.length > DEFAULT_KODEPOS_DATA.length
              ? savedKodePos
              : (DEFAULT_KODEPOS_DATA as unknown as KodePosRow[]);
        }
        kodePosListRef.current = kodePosForPipeline;
      }

      let lastPhase: 1 | 2 | 3 = 1;
      const { rows: results, coverage } = await executeAnalystPipeline(
        masterRows,
        ptenList,
        kodePosForPipeline,
        wilayahSettings,
        roleMappingList,
        (phase, pct, _processed, _total, msg) => {
          setAnalystProgress(pct);
          setAnalystMessage(`[Fase ${phase}] ${msg}`);
          setCurrentActivePhase(phase);
          // Calculate per-phase local percent (0-100)
          // Phase 1: global 0-33%, Phase 2: 33-66%, Phase 3: 66-100%
          const phaseRanges: Record<1 | 2 | 3, [number, number]> = {
            1: [0, 33],
            2: [33, 66],
            3: [66, 100],
          };
          const [min, max] = phaseRanges[phase];
          const localPct = max > min ? Math.min(100, Math.round(((pct - min) / (max - min)) * 100)) : 0;
          setPhaseProgress((prev) => ({ ...prev, [phase]: localPct }));
          // Mark previous phases completed when phase changes
          if (phase > lastPhase) {
            setCompletedPhases((prev) => {
              const next = new Set(prev);
              for (let p = 1; p < phase; p++) next.add(p);
              return next;
            });
            setPhaseProgress((prev) => {
              const next = { ...prev };
              for (let p = 1 as 1 | 2 | 3; p < phase; p = (p + 1) as 1 | 2 | 3) next[p] = 100;
              return next;
            });
          }
          lastPhase = phase;
        },
        reRunAnomaliesOnly,
        analystRows
      );

      setAnalystRows(results);
      setAnalystCoverage(coverage);
      setIsAnalyzing(false);
      setAnalystProgress(100);
      setAnalystMessage('Analisa 3 Fase Berhasil Selesai!');
      // Mark all phases complete
      setPhaseProgress({ 1: 100, 2: 100, 3: 100 });
      setCompletedPhases(new Set([1, 2, 3]));
      setCurrentActivePhase(0);
      setItem('analyst_results_data', results).catch(() => {});
    } catch (err: any) {
      setIsAnalyzing(false);
      setCurrentActivePhase(0);
      alert('Terjadi kesalahan saat menjalankan analisa: ' + err?.message);
    }
  };

  const handleResetAnalyst = async () => {
    setAnalystRows([]);
    setAnalystCoverage(null);
    setAnalystProgress(0);
    setAnalystMessage('');
    await setItem('analyst_results_data', []);
  };

  const handleUpdateAnalystRow = (updated: AnalystRow) => {
    setAnalystRows((prev) => {
      const next = prev.map((r) => (r.id === updated.id ? updated : r));
      setItem('analyst_results_data', next).catch(() => {});
      return next;
    });
  };

  const handleApproveSingleAnalystRow = (rowId: string) => {
    setAnalystRows((prev) => {
      const next = prev.map((r) => (r.id === rowId ? { ...r, isFinalApproved: true } : r));
      setItem('analyst_results_data', next).catch(() => {});
      return next;
    });
  };

  const handleApproveAllAnalystFinal = () => {
    setAnalystRows((prev) => {
      const next = prev.map((r) => ({ ...r, isFinalApproved: true }));
      setItem('analyst_results_data', next).catch(() => {});
      return next;
    });
  };

  const handleApproveAnalystFase = (fase: 1 | 2 | 3) => {
    setAnalystRows((prev) => {
      const next = prev.map((r) => {
        if (fase === 1) return { ...r, fase1Approved: true };
        if (fase === 2) return { ...r, fase2Approved: true };
        return { ...r, fase3Approved: true };
      });
      setItem('analyst_results_data', next).catch(() => {});
      return next;
    });
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
    try {
      setMasterRows([]);
      await setItem('master_data', { rows: [], fileName: '' });
      try {
        await clearMasterFromNeon();
      } catch (e) {
        console.warn('Neon clear warning:', e);
      }
    } catch (e) {
      console.warn('Reset master error:', e);
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
          const ptenRes = validatePtenForTarget(r['KODE POS'], r['Dati II'] || r.Kota || '', ptenIndex);
          return {
            ...r,
            No: r.No !== undefined && String(r.No).trim() !== '' ? r.No : startNo + idx + 1,
            _excelRowIndex: startNo + idx + 1,
            'KOTA PTEN': r['KOTA PTEN'] || ptenRes.kotaPten,
            'KODE POS PTEN': r['KODE POS PTEN'] || ptenRes.kodePosPten,
            'CEK KODE POS + PTEN': r['CEK KODE POS + PTEN'] || ptenRes.statusPten,
          };
        });
        finalRows = [...prev, ...indexedNewRows];
      } else {
        // Mode Replace (default): Urutan 100% murni persis sesuai file Excel yang diunggah (0ms instan tanpa lag)
        finalRows = newRows.map((r, idx) => {
          const ptenRes = validatePtenForTarget(r['KODE POS'], r['Dati II'] || r.Kota || '', ptenIndex);
          return {
            ...r,
            No: r.No !== undefined && String(r.No).trim() !== '' ? r.No : idx + 1,
            _excelRowIndex: idx + 1,
            'KOTA PTEN': r['KOTA PTEN'] || ptenRes.kotaPten,
            'KODE POS PTEN': r['KODE POS PTEN'] || ptenRes.kodePosPten,
            'CEK KODE POS + PTEN': r['CEK KODE POS + PTEN'] || ptenRes.statusPten,
          };
        });
      }

      const finalFileName =
        mode === 'append' && prev.length > 0 ? `${finalRows.length} Data Target (${fileName})` : fileName;
      setTargetFileName(finalFileName);
      setInitialTargetCount(finalRows.length);
      setMatchedDone(false);

      persistTargetData({
        rows: finalRows,
        fileName: finalFileName,
        initialCount: finalRows.length,
        matchedDone: false,
      });

      return finalRows;
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
        targetCount={analystRows.length}
        wilayahCount={wilayahSettings.length}
        ptenCount={ptenCount}
        roleMappingCount={roleMappingCount}
        kodeposCount={kodePosCount}
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
                onNavigateToEngine={() => {
                  setActiveTab('working');
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

          {/* MENU 3: DATA ANALYST (DATA ANALYST ENGINE - 100% DATA MASTER DRIVEN) */}
          {activeTab === 'working' && (
            <div>
              <AnalystCanvas
                isAnalyzing={isAnalyzing}
                progressPercent={analystProgress}
                progressMessage={analystMessage}
                onStartAnalysis={() => handleStartAnalystPipeline(false)}
                onResetAnalysis={handleResetAnalyst}
                hasExistingResults={analystRows.length > 0}
                masterCounts={{
                  pten: ptenList.length,
                  kodepos: kodePosCount,
                  wilayah: wilayahSettings.length,
                  cabang: masterRows.length,
                  role: roleMappingList.length,
                }}
                phaseProgress={phaseProgress}
                currentActivePhase={currentActivePhase}
                completedPhases={completedPhases}
              />

              {analystRows.length > 0 && (
                <AnalystResultsGrid
                  rows={analystRows}
                  onUpdateRow={handleUpdateAnalystRow}
                  onApproveSingleRow={handleApproveSingleAnalystRow}
                  onApproveAllFinal={handleApproveAllAnalystFinal}
                  onApproveFase={handleApproveAnalystFase}
                  onReRunAll={() => handleStartAnalystPipeline(false)}
                  onReRunAnomaliesOnly={() => handleStartAnalystPipeline(true)}
                  isProcessing={isAnalyzing}
                  wilayahSettings={wilayahSettings}
                  coverage={analystCoverage}
                />
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

          {/* MENU MASTER: KODE POS */}
          {activeTab === 'kodepos' && (
            <KodePosManager
              onKodePosCountChange={(count) => {
                setKodePosCount(count);
                kodePosListRef.current = null; // invalidasi cache pipeline bila master kodepos berubah
              }}
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
