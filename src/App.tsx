import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { MetricCards } from './components/Dashboard/MetricCards';
import { WilayahChart } from './components/Dashboard/WilayahChart';
import { RadarAnomalyTable } from './components/Dashboard/RadarAnomalyTable';
import { AuditLogTable } from './components/Dashboard/AuditLogTable';
import { MasterUpload } from './components/MasterData/MasterUpload';
import { MasterHealthCard } from './components/MasterData/MasterHealthCard';
import { MasterDataGrid } from './components/MasterData/MasterDataGrid';
import { TargetUpload } from './components/WorkingEngine/TargetUpload';
import { FilterToolbar } from './components/WorkingEngine/FilterToolbar';
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
import { SupabaseModal } from './components/SupabaseModal';
import { Database, ShieldAlert } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'master' | 'working'>('dashboard');
  const [masterSubTab, setMasterSubTab] = useState<'health' | 'grid'>('health');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(isSupabaseConfigured());

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

  // Restore persisted data (Check Cloud Supabase first, fallback to IndexedDB)
  useEffect(() => {
    const restoreSavedData = async () => {
      try {
        let loadedMaster = false;

        // 1. Check Cloud Supabase if configured
        if (isSupabaseConfigured()) {
          const cloudMaster = await loadMasterFromCloud();
          if (cloudMaster && cloudMaster.rows && cloudMaster.rows.length > 0) {
            setMasterRows(cloudMaster.rows);
            setMasterFileName(cloudMaster.fileName || 'Master_Cloud_Supabase.xlsx');
            setIsCloudConnected(true);
            loadedMaster = true;
          }
        }

        // 2. Fallback to local IndexedDB
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
      if (r.Wilayah) set.add(r.Wilayah.trim());
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

  // Dashboard Aggregates & Metrics
  const dashboardStats: MatchingStats = useMemo(() => {
    const totalProcessed = targetRows.length;
    const matchedCount = targetRows.filter(r => r._isMatched ?? (r.Sandi !== '')).length;
    const unmatchedCount = totalProcessed - matchedCount;
    const ptenDiscrepancyCount = targetRows.filter(r => r['CEK KODE POS + PTEN'] === 'DIFFERENT').length;
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
  }, [targetRows]);

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

      // Clear Cloud Supabase if configured
      if (isSupabaseConfigured()) {
        await clearMasterFromCloud();
      }
    }
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        masterCount={masterRows.length}
        targetCount={targetRows.length}
        onResetAll={handleResetAll}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        isCloudConnected={isCloudConnected}
      />

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConnectedChange={setIsCloudConnected}
      />

      <main className="main-wrapper">
        {/* MENU 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <>
            <div className="section-header">
              <div>
                <h2 className="section-title">Dashboard Pusat Monitoring & Analisis Kinerja</h2>
                <p className="section-subtitle">
                  Pantau metrik kesehatan data operasional cabang, tingkat kecocokan master, dan selisih kode pos PTEN secara real-time.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setActiveTab('working')}
              >
                <span>Buka Working Engine</span>
              </button>
            </div>

            {/* Onboarding Guide when no data loaded */}
            {masterRows.length === 0 && targetRows.length === 0 && (
              <div
                className="glass-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(16, 185, 129, 0.08) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                    🚀 Siap Memproses Data Excel Riil Anda
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Sistem dalam kondisi bersih tanpa data dummy. Ikuti 3 alur mudah berikut untuk mengunggah dan mencocokkan data operasional cabang:
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {/* Step 1 */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ background: '#2563eb', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>1</span>
                        <strong style={{ color: '#fff', fontSize: '0.95rem' }}>Unggah File Data Master</strong>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Unggah berkas Excel referensi cabang <strong>(15 kolom)</strong> di Menu 2. Sistem otomatis mengindeks KODE POS ke memori (O(1)).
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setActiveTab('master')}
                    >
                      Buka Menu Data Master &rarr;
                    </button>
                  </div>

                  {/* Step 2 */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ background: '#10b981', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>2</span>
                        <strong style={{ color: '#fff', fontSize: '0.95rem' }}>Unggah File Target Dicek</strong>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Unggah berkas Excel transaksi operasional <strong>(19 kolom)</strong> di Menu 3. Jumlah baris N_in otomatis dikunci permanen.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setActiveTab('working')}
                    >
                      Buka Menu Working Engine &rarr;
                    </button>
                  </div>

                  {/* Step 3 */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ background: '#f59e0b', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>3</span>
                        <strong style={{ color: '#fff', fontSize: '0.95rem' }}>Cocokkan & Unduh Excel</strong>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Jalankan cascade matching non-blocking, validasi PTEN, filter wilayah, dan unduh hasil dengan kepastian integritas baris 100%.
                      </p>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600 }}>
                      ⚡ Strict Row Integrity (N_in = N_out)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4 Metric Cards */}
            <MetricCards stats={dashboardStats} />

            {/* 2-Column Analytics: Distribusi Wilayah & Radar Anomali */}
            <div className="dashboard-columns" style={{ marginTop: '0.5rem' }}>
              <WilayahChart stats={regionalStats} />
              <RadarAnomalyTable unmatchedAreas={topUnmatchedAreas} />
            </div>

            {/* Audit Log & Riwayat Batch */}
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

            {/* 2 Sub-Tabs for Menu Data Master */}
            {masterRows.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: '0.6rem',
                  marginTop: '1.25rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.85rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* Tab 1: Indikator Kesehatan Master */}
                <button
                  type="button"
                  onClick={() => setMasterSubTab('health')}
                  className={`btn ${masterSubTab === 'health' ? 'btn-primary' : 'btn-outline'}`}
                  style={{
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.84rem',
                    padding: '0.55rem 1.15rem',
                    background:
                      masterSubTab === 'health'
                        ? masterHealth.multiOutletCount > 0
                          ? 'linear-gradient(135deg, #d97706, #b45309)'
                          : 'linear-gradient(135deg, #059669, #047857)'
                        : undefined,
                    borderColor:
                      masterHealth.multiOutletCount > 0
                        ? 'rgba(245, 158, 11, 0.4)'
                        : undefined,
                    color:
                      masterSubTab === 'health'
                        ? '#ffffff'
                        : masterHealth.multiOutletCount > 0
                        ? '#fbbf24'
                        : '#cbd5e1',
                  }}
                  id="tab-btn-master-health"
                >
                  <ShieldAlert size={15} />
                  <span>
                    Tab 1: Indikator Kesehatan Master
                    {masterHealth.multiOutletCount > 0
                      ? `: Terdeteksi ${masterHealth.multiOutletCount} Kode Pos Multi-Cabang`
                      : ' (100% Optimal)'}
                  </span>
                </button>

                {/* Tab 2: Data Grid Master Cabang */}
                <button
                  type="button"
                  onClick={() => setMasterSubTab('grid')}
                  className={`btn ${masterSubTab === 'grid' ? 'btn-primary' : 'btn-outline'}`}
                  style={{
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.84rem',
                    padding: '0.55rem 1.15rem',
                  }}
                  id="tab-btn-master-grid"
                >
                  <Database size={15} />
                  <span>Tab 2: Data Grid Master Cabang ({masterRows.length.toLocaleString('id-ID')} Baris)</span>
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

            <FilterToolbar
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

            <ProgressBar
              isProcessing={isProcessing}
              progress={progress}
              processedCount={processedCount}
              totalCount={targetRows.length}
              durationMs={durationMs}
            />

            <TargetDataGrid
              rows={filteredTargetRows}
              totalInputRows={initialTargetCount}
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
  );
};

export default App;
