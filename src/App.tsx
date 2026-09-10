import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MetricCards } from './components/Dashboard/MetricCards';
import { RegionalAnalyticsCharts } from './components/Dashboard/RegionalAnalyticsCharts';
import { RadarAnomalyTable } from './components/Dashboard/RadarAnomalyTable';
import { MasterHealthCard } from './components/MasterData/MasterHealthCard';
import { MasterDataGrid } from './components/MasterData/MasterDataGrid';
import { MasterUploadModal } from './components/MasterData/MasterUploadModal';
import { TargetUploadModal } from './components/WorkingEngine/TargetUploadModal';
import { ProgressBar } from './components/WorkingEngine/ProgressBar';
import { TargetDataGrid } from './components/WorkingEngine/TargetDataGrid';
import { ExportAction } from './components/WorkingEngine/ExportAction';

import type { MasterRow, TargetRow, MatchingStats, WilayahStat, UnmatchedArea } from './types';
import type { RecommendationResult } from './utils/recommender';
import { buildMasterIndex, analyzeMasterHealth, executeChunkMatching } from './utils/matcher';
import { downloadMasterTemplate, downloadTargetTemplate } from './utils/excel';
import { getItem, setItem, clearAllStorage } from './utils/storage';
import {
  isSupabaseConfigured,
  saveMasterToCloud,
  loadMasterFromCloud,
  clearMasterFromCloud,
} from './utils/supabase';
import {
  checkNeonStatus,
  loadMasterFromNeon,
  saveMasterToNeon,
  clearMasterFromNeon,
} from './utils/neonSync';
import { SupabaseModal } from './components/SupabaseModal';
import { Database, ShieldAlert, Filter, UploadCloud, Download, RotateCcw, Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'master' | 'working'>('dashboard');
  const [masterSubTab, setMasterSubTab] = useState<'health' | 'grid'>('health');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [isMasterUploadModalOpen, setIsMasterUploadModalOpen] = useState<boolean>(false);
  const [isTargetUploadModalOpen, setIsTargetUploadModalOpen] = useState<boolean>(false);
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

  const [_isCloudConnected, setIsCloudConnected] = useState<boolean>(isSupabaseConfigured());
  const [_isNeonConnected, setIsNeonConnected] = useState<boolean>(false);

  // Master Data State (Clean state for real data upload)
  const [masterRows, setMasterRows] = useState<MasterRow[]>([]);
  const [masterFileName, setMasterFileName] = useState<string>('');

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

  // Restore persisted data (Check Neon Postgres first, then Supabase, fallback to IndexedDB)
  useEffect(() => {
    const restoreSavedData = async () => {
      try {
        let loadedMaster = false;

        // 1. Check Vercel Neon Postgres
        try {
          const neonCheck = await checkNeonStatus();
          if (neonCheck.connected) {
            setIsNeonConnected(true);
            const neonMaster = await loadMasterFromNeon();
            if (neonMaster && neonMaster.rows && neonMaster.rows.length > 0) {
              setMasterRows(neonMaster.rows);
              setMasterFileName(neonMaster.fileName || 'Master_Neon_Vercel.xlsx');
              loadedMaster = true;
            }
          }
        } catch (e) {
          console.warn('Neon connection check skipped:', e);
        }

        // 2. Check Cloud Supabase if configured & not loaded
        if (!loadedMaster && isSupabaseConfigured()) {
          const cloudMaster = await loadMasterFromCloud();
          if (cloudMaster && cloudMaster.rows && cloudMaster.rows.length > 0) {
            setMasterRows(cloudMaster.rows);
            setMasterFileName(cloudMaster.fileName || 'Master_Cloud_Supabase.xlsx');
            setIsCloudConnected(true);
            loadedMaster = true;
          }
        }

        // 3. Fallback to local IndexedDB
        if (!loadedMaster) {
          const savedMaster = await getItem<{ rows: MasterRow[]; fileName: string }>('master_data');
          if (savedMaster && savedMaster.rows && savedMaster.rows.length > 0) {
            setMasterRows(savedMaster.rows);
            setMasterFileName(savedMaster.fileName || '');
          }
        }

        const savedTarget = await getItem<{
          rows: TargetRow[];
          fileName: string;
          initialCount: number;
          matchedDone: boolean;
        }>('target_data');

        if (savedTarget && savedTarget.rows && savedTarget.rows.length > 0) {
          setTargetRows(savedTarget.rows);
          setTargetFileName(savedTarget.fileName || '');
          setInitialTargetCount(savedTarget.initialCount || savedTarget.rows.length);
          setMatchedDone(savedTarget.matchedDone || false);
        }


      } catch (err) {
        console.warn('Gagal memulihkan data:', err);
      }
    };

    restoreSavedData();
  }, []);

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
    return targetRows.filter((r) => r.Wilayah === dashboardWilayahFilter);
  }, [targetRows, dashboardWilayahFilter]);

  // Dashboard Aggregates & Metrics
  const dashboardStats: MatchingStats = useMemo(() => {
    const totalProcessed = dashboardFilteredRows.length;
    const matchedCount = dashboardFilteredRows.filter(r => r._isMatched ?? (r.Sandi !== '')).length;
    const unmatchedCount = totalProcessed - matchedCount;
    const ptenDiscrepancyCount = dashboardFilteredRows.filter(r => r['CEK KODE POS + PTEN'] === 'DIFFERENT').length;
    const matchingRate = totalProcessed > 0 ? (matchedCount / totalProcessed) * 100 : 0;
    const ptenDiscrepancyRate = totalProcessed > 0 ? (ptenDiscrepancyCount / totalProcessed) * 100 : 0;

    return {
      totalProcessed,
      matchedCount,
      unmatchedCount,
      ptenDiscrepancyCount,
      matchingRate,
      ptenDiscrepancyRate,
    };
  }, [dashboardFilteredRows]);

  // Regional Stats for Widget Distribusi Wilayah
  const regionalStats: WilayahStat[] = useMemo(() => {
    const map = new Map<string, { total: number; matched: number; unmatched: number }>();

    targetRows.forEach((r) => {
      const w = r.Wilayah || 'Wilayah Tidak Terdaftar';
      const isMatched = r._isMatched ?? (r.Sandi !== '');
      const current = map.get(w) || { total: 0, matched: 0, unmatched: 0 };

      current.total++;
      if (isMatched) current.matched++;
      else current.unmatched++;

      map.set(w, current);
    });

    return Array.from(map.entries()).map(([wilayah, data]) => ({
      wilayah,
      total: data.total,
      matched: data.matched,
      unmatched: data.unmatched,
      rate: data.total > 0 ? (data.matched / data.total) * 100 : 0,
    }));
  }, [targetRows]);

  // Top 10 Unmatched Areas for Radar Anomaly
  const topUnmatchedAreas: UnmatchedArea[] = useMemo(() => {
    const map = new Map<string, { kecamatan: string; kodePos: string; count: number; wilayah: string }>();

    targetRows.forEach((r) => {
      const isMatched = r._isMatched ?? (r.Sandi !== '');
      if (!isMatched) {
        const key = `${r.Kecamatan}_${r['KODE POS']}`;
        const existing = map.get(key);
        if (existing) {
          existing.count++;
        } else {
          map.set(key, {
            kecamatan: r.Kecamatan || 'Kecamatan Tidak Diketahui',
            kodePos: r['KODE POS'] || '-',
            count: 1,
            wilayah: r.Wilayah || '-',
          });
        }
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [targetRows]);

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


      setItem('target_data', {
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

  // Master Actions (Appends new rows to existing master data)
  const handleMasterLoaded = async (newRows: MasterRow[], fileName: string) => {
    setMasterRows((prev) => {
      const combined = [...prev, ...newRows];
      const combinedFileName = prev.length > 0 ? `${combined.length} Cabang (${fileName})` : fileName;
      setMasterFileName(combinedFileName);
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
        setMasterFileName('');
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

  // Target Actions (Appends new rows to existing target data)
  const handleTargetLoaded = (newRows: TargetRow[], fileName: string) => {
    setTargetRows((prev) => {
      const startNo = prev.length;
      const indexedNewRows = newRows.map((r, idx) => ({
        ...r,
        No: startNo + idx + 1,
      }));
      const combined = [...prev, ...indexedNewRows];
      const combinedFileName = prev.length > 0 ? `${combined.length} Data Target (${fileName})` : fileName;
      setTargetFileName(combinedFileName);
      setInitialTargetCount(combined.length);
      setMatchedDone(false);
      setProgress(0);

      setItem('target_data', {
        rows: combined,
        fileName: combinedFileName,
        initialCount: combined.length,
        matchedDone: false,
      });

      return combined;
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
      } catch (e) {
        console.warn('Reset target error:', e);
      }
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
        };
      });

      setItem('target_data', {
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
        };
      });

      setItem('target_data', {
        rows: updated,
        fileName: targetFileName,
        initialCount: initialTargetCount,
        matchedDone: true,
      });

      return updated;
    });
  };

  const handleResetAll = async () => {
    if (window.confirm('Kosongkan semua data (Master & Target) untuk memulai proses baru?')) {
      setMasterRows([]);
      setMasterFileName('');
      setTargetRows([]);
      setInitialTargetCount(0);
      setTargetFileName('');
      setMatchedDone(false);
      setProgress(0);

      // Clear local IndexedDB
      await clearAllStorage();

      // Clear Vercel Neon DB
      try {
        await clearMasterFromNeon();
      } catch (e) {
        console.warn('Neon clear failed:', e);
      }

      // Clear Cloud Supabase if configured
      if (isSupabaseConfigured()) {
        await clearMasterFromCloud();
      }
    }
  };

  return (
    <div className="layout-wrapper">
      {/* 1. Velzon Left Sidebar (Dashboard, Data Master, Data Cek) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        masterCount={masterRows.length}
        targetCount={targetRows.length}
        isCollapsed={isSidebarCollapsed}
      />

      {/* 2. Main Content Area */}
      <div className="main-content">
        <Topbar
          activeTab={activeTab}
          onResetAll={handleResetAll}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />

        <main className="page-content">
          {/* MENU 1: DASHBOARD (EXECUTIVE OPERATIONAL ANALYST DASHBOARD) */}
          {activeTab === 'dashboard' && (
          <>
            {/* Minimalist Regional Filter Toolbar if data exists */}
            {wilayahList.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#ffffff', border: '1px solid var(--border-subtle)', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }}>
                  <Filter size={13} color="#878a99" />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Filter Wilayah:</span>
                  <select
                    value={dashboardWilayahFilter}
                    onChange={(e) => setDashboardWilayahFilter(e.target.value)}
                    className="filter-select"
                    style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem', height: 'auto', border: 'none', background: 'transparent' }}
                    id="dashboard-wilayah-filter"
                  >
                    <option value="ALL">Semua Wilayah ({targetRows.length} Data)</option>
                    {wilayahList.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <MetricCards
              stats={dashboardStats}
              masterCount={masterRows.length}
              multiCabangCount={masterHealth.multiOutletCount}
            />

            {/* 2 Grafik Analisis Wilayah: Volume Data Cek & Match vs Tidak Match */}
            <RegionalAnalyticsCharts
              stats={regionalStats}
              totalDataCount={dashboardFilteredRows.length}
            />

            {/* Radar Titik Anomali (Dipertahankan) */}
            <RadarAnomalyTable unmatchedAreas={topUnmatchedAreas} />
          </>
        )}

        {/* MENU 2: DATA MASTER (MANAJEMEN REFERENSI CABANG) */}
        {activeTab === 'master' && (
          <>
            {/* Top Action Card: Upload Button & Template & Reset */}
            <div
              className="glass-card"
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1.25rem',
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
                    Database Referensi Master Cabang & Outlet
                  </h3>
                  <p style={{ fontSize: '0.76rem', color: '#878a99', margin: '0.15rem 0 0 0' }}>
                    Total {masterRows.length.toLocaleString('id-ID')} cabang terdaftar{masterFileName ? ` • Berkas: ${masterFileName}` : ''} • Multi-Cabang Alert: {masterHealth.multiOutletCount} area
                  </p>
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

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => downloadMasterTemplate(false)}
                  title="Unduh format template Excel master kosong"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.42rem 0.85rem' }}
                >
                  <Download size={13} />
                  <span>Template Excel</span>
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
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => downloadMasterTemplate(false)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 0.95rem' }}
                  >
                    <Download size={13} />
                    <span>Unduh Template</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-card" style={{ marginTop: '1rem', padding: '1.25rem 1.5rem' }}>
                {/* Header Title inside Card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    marginBottom: '0.85rem',
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#212529', letterSpacing: '-0.01em', margin: 0 }}>
                      Pratinjau & Manajemen Data Master
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: '#878a99', marginTop: '0.15rem', margin: 0 }}>
                      Total {masterRows.length.toLocaleString('id-ID')} cabang master terdaftar{masterFileName ? ` • Berkas: ${masterFileName}` : ''} • Multi-Cabang: {masterHealth.multiOutletCount} area
                    </p>
                  </div>
                </div>

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
                    <span>Tab 1: Indikator Kesehatan Master</span>
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
                    <span>Tab 2: Data Grid Master Cabang</span>
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
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '6px',
                    background: 'rgba(53, 119, 241, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3577f1',
                  }}
                >
                  <Layers size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                    Pencocokan & Validasi Data Target (Data Cek)
                  </h3>
                  <p style={{ fontSize: '0.76rem', color: '#878a99', margin: '0.15rem 0 0 0' }}>
                    Total {targetRows.length.toLocaleString('id-ID')} baris data target aktif • {targetRows.filter(r => r._isMatched).length.toLocaleString('id-ID')} Cocok
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsTargetUploadModalOpen(true)}
                  id="btn-open-upload-target"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.42rem 0.95rem' }}
                >
                  <UploadCloud size={14} />
                  <span>Upload Data Cek</span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => downloadTargetTemplate(false)}
                  title="Unduh format template Excel target kosong (hanya sampai Provinsi)"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.42rem 0.85rem' }}
                >
                  <Download size={13} />
                  <span>Template Target</span>
                </button>

                {targetRows.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleResetTarget}
                    title="Kosongkan data target operasional"
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
                    <span>Reset Data Cek</span>
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
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => downloadTargetTemplate(false)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 0.95rem' }}
                  >
                    <Download size={13} />
                    <span>Unduh Template</span>
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
      />

      {/* Target Upload Modal */}
      <TargetUploadModal
        isOpen={isTargetUploadModalOpen}
        onClose={() => setIsTargetUploadModalOpen(false)}
        onTargetLoaded={handleTargetLoaded}
        currentTargetCount={targetRows.length}
      />
    </div>
  );
};

export default App;
