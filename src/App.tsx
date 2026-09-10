import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MetricCards } from './components/Dashboard/MetricCards';
import { WilayahChart } from './components/Dashboard/WilayahChart';
import { RadarAnomalyTable } from './components/Dashboard/RadarAnomalyTable';
import { AuditLogTable } from './components/Dashboard/AuditLogTable';
import { MasterUpload } from './components/MasterData/MasterUpload';
import { MasterHealthCard } from './components/MasterData/MasterHealthCard';
import { MasterDataGrid } from './components/MasterData/MasterDataGrid';
import { TargetUpload } from './components/WorkingEngine/TargetUpload';
import { ProgressBar } from './components/WorkingEngine/ProgressBar';
import { TargetDataGrid } from './components/WorkingEngine/TargetDataGrid';
import { ExportAction } from './components/WorkingEngine/ExportAction';

import type { MasterRow, TargetRow, BatchLog, MatchingStats, WilayahStat, UnmatchedArea } from './types';
import { SAMPLE_MASTER_ROWS, SAMPLE_TARGET_ROWS } from './utils/sampleData';
import { buildMasterIndex, analyzeMasterHealth, executeChunkMatching } from './utils/matcher';
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
import { PtenDiscrepancyPanel } from './components/Dashboard/PtenDiscrepancyPanel';
import { Database, ShieldAlert, Filter } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'master' | 'working'>('dashboard');
  const [masterSubTab, setMasterSubTab] = useState<'health' | 'grid'>('health');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'matched' | 'unmatched' | 'pten_diff'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Batch Logs History State
  const [batchLogs, setBatchLogs] = useState<BatchLog[]>([]);

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

        const savedLogs = await getItem<BatchLog[]>('batch_logs');
        if (savedLogs && savedLogs.length > 0) {
          setBatchLogs(savedLogs);
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

  // Filtered Target Rows
  const filteredTargetRows = useMemo(() => {
    return targetRows.filter((r) => {
      // Wilayah filter
      if (selectedWilayah !== 'ALL' && r.Wilayah !== selectedWilayah) {
        return false;
      }

      // Secondary Status filter
      const isMatched = r._isMatched ?? (r.Sandi !== '');
      const isPtenDiff = r['CEK KODE POS + PTEN'] === 'DIFFERENT';

      if (statusFilter === 'matched' && !isMatched) return false;
      if (statusFilter === 'unmatched' && isMatched) return false;
      if (statusFilter === 'pten_diff' && !isPtenDiff) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          String(r.No).includes(q) ||
          r.Wilayah?.toLowerCase().includes(q) ||
          r.Sandi?.toLowerCase().includes(q) ||
          r.Cabang?.toLowerCase().includes(q) ||
          r['Nama Outlet']?.toLowerCase().includes(q) ||
          r.ALAMAT?.toLowerCase().includes(q) ||
          r['KODE POS']?.toLowerCase().includes(q) ||
          r.Kecamatan?.toLowerCase().includes(q) ||
          r.Kelurahan?.toLowerCase().includes(q) ||
          r['SUMBER DATA']?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [targetRows, selectedWilayah, statusFilter, searchTerm]);

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

      // Record in Audit Log
      const matchedCount = matchedData.filter(r => r._isMatched).length;
      const ptenDiffCount = matchedData.filter(r => r['CEK KODE POS + PTEN'] === 'DIFFERENT').length;
      const newLog: BatchLog = {
        id: `BATCH-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        fileName: targetFileName,
        uploader: 'OpsAdmin.Lanpro',
        totalRows: matchedData.length,
        matchedCount,
        unmatchedCount: matchedData.length - matchedCount,
        ptenDiscrepancyCount: ptenDiffCount,
        durationMs: totalElapsed,
        dataSnapshot: matchedData,
      };

      setBatchLogs(prev => {
        const updated = [newLog, ...prev];
        setItem('batch_logs', updated);
        return updated;
      });

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

  // Master Actions
  const handleLoadSampleMaster = () => {
    setMasterRows(SAMPLE_MASTER_ROWS);
    setMasterFileName('Master_Cabang_Nasional_2026.xlsx');
    setItem('master_data', { rows: SAMPLE_MASTER_ROWS, fileName: 'Master_Cabang_Nasional_2026.xlsx' });
  };

  const handleMasterLoaded = async (rows: MasterRow[], fileName: string) => {
    setMasterRows(rows);
    setMasterFileName(fileName);
    setItem('master_data', { rows, fileName });

    // Sync to Vercel Neon DB (Serverless)
    try {
      saveMasterToNeon(rows, fileName);
    } catch (e) {
      console.warn('Neon auto-save skipped:', e);
    }

    // Sync to Supabase Cloud if configured
    if (isSupabaseConfigured()) {
      saveMasterToCloud(rows, fileName);
    }
  };

  // Target Actions
  const handleLoadSampleTarget = () => {
    setTargetRows(SAMPLE_TARGET_ROWS);
    setInitialTargetCount(SAMPLE_TARGET_ROWS.length);
    setTargetFileName('Target_Operasional_Batch_01.xlsx');
    setMatchedDone(false);
    setProgress(0);
    setItem('target_data', {
      rows: SAMPLE_TARGET_ROWS,
      fileName: 'Target_Operasional_Batch_01.xlsx',
      initialCount: SAMPLE_TARGET_ROWS.length,
      matchedDone: false,
    });
  };

  const handleTargetLoaded = (rows: TargetRow[], fileName: string) => {
    setTargetRows(rows);
    setInitialTargetCount(rows.length);
    setTargetFileName(fileName);
    setMatchedDone(false);
    setProgress(0);
    setItem('target_data', {
      rows,
      fileName,
      initialCount: rows.length,
      matchedDone: false,
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
      setBatchLogs([]);

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
      />

      {/* 2. Main Content Area */}
      <div className="main-content">
        <Topbar
          activeTab={activeTab}
          onResetAll={handleResetAll}
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

            {/* Row 1: Distribusi Wilayah & Matriks Kepatuhan PTEN */}
            <div className="dashboard-columns">
              <WilayahChart stats={regionalStats} />
              <PtenDiscrepancyPanel targetRows={dashboardFilteredRows} />
            </div>

            {/* Row 2: Radar Titik Anomali */}
            <RadarAnomalyTable unmatchedAreas={topUnmatchedAreas} />

            {/* Row 3: Audit Log & Riwayat Batch */}
            <AuditLogTable logs={batchLogs} />
          </>
        )}

        {/* MENU 2: DATA MASTER (MANAJEMEN REFERENSI CABANG) */}
        {activeTab === 'master' && (
          <>
            <MasterUpload
              onMasterLoaded={handleMasterLoaded}
              onLoadSample={handleLoadSampleMaster}
              masterCount={masterRows.length}
              masterFileName={masterFileName}
            />

            {/* 2 Sub-Tabs for Menu Data Master (Velzon nav-tabs-custom style) */}
            {masterRows.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginTop: '1.25rem',
                  borderBottom: '1px solid #e9ebec',
                  paddingBottom: '0',
                }}
              >
                {/* Tab 1: Indikator Kesehatan Master */}
                <button
                  type="button"
                  onClick={() => setMasterSubTab('health')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.84rem',
                    fontWeight: masterSubTab === 'health' ? 600 : 500,
                    color: masterSubTab === 'health' ? '#405189' : '#878a99',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: masterSubTab === 'health' ? '2px solid #405189' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    marginBottom: '-1px',
                  }}
                  id="tab-btn-master-health"
                >
                  <ShieldAlert size={15} color={masterSubTab === 'health' ? '#405189' : '#878a99'} />
                  <span>Tab 1: Indikator Kesehatan Master</span>
                  {masterHealth.multiOutletCount > 0 ? (
                    <span
                      style={{
                        padding: '0.15rem 0.55rem',
                        borderRadius: '9999px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: 'rgba(247, 184, 75, 0.15)',
                        color: '#d97706',
                        border: '1px solid rgba(247, 184, 75, 0.3)',
                      }}
                    >
                      {masterHealth.multiOutletCount} Kode Pos Multi-Cabang
                    </span>
                  ) : (
                    <span
                      style={{
                        padding: '0.15rem 0.55rem',
                        borderRadius: '9999px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: 'rgba(10, 179, 156, 0.12)',
                        color: '#0ab39c',
                      }}
                    >
                      100% Optimal
                    </span>
                  )}
                </button>

                {/* Tab 2: Data Grid Master Cabang */}
                <button
                  type="button"
                  onClick={() => setMasterSubTab('grid')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.84rem',
                    fontWeight: masterSubTab === 'grid' ? 600 : 500,
                    color: masterSubTab === 'grid' ? '#405189' : '#878a99',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: masterSubTab === 'grid' ? '2px solid #405189' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    marginBottom: '-1px',
                  }}
                  id="tab-btn-master-grid"
                >
                  <Database size={15} color={masterSubTab === 'grid' ? '#405189' : '#878a99'} />
                  <span>Tab 2: Data Grid Master Cabang</span>
                  <span
                    style={{
                      padding: '0.15rem 0.55rem',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: 'rgba(64, 81, 137, 0.1)',
                      color: '#405189',
                    }}
                  >
                    {masterRows.length.toLocaleString('id-ID')} Baris
                  </span>
                </button>
              </div>
            )}

            {/* Sub-Tab Content */}
            {masterSubTab === 'health' ? (
              <MasterHealthCard health={masterHealth} />
            ) : (
              <MasterDataGrid masterRows={masterRows} />
            )}
          </>
        )}

        {/* MENU 3: DATA YANG AKAN DICOCOKAN (WORKING & EXECUTION ENGINE) */}
        {activeTab === 'working' && (
          <>
            <TargetUpload
              onTargetLoaded={handleTargetLoaded}
              onLoadSample={handleLoadSampleTarget}
              targetCount={targetRows.length}
            />

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
              wilayahList={wilayahList}
              selectedWilayah={selectedWilayah}
              onWilayahChange={setSelectedWilayah}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onExecuteMatching={handleExecuteMatching}
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
        </main>
      </div>

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConnectedChange={setIsCloudConnected}
      />
    </div>
  );
};

export default App;
