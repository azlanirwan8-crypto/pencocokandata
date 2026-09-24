import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { useNotification } from './components/Notification/NotificationContext';
import { MetricCards } from './components/Dashboard/MetricCards';
import { RegionalAnalyticsCharts } from './components/Dashboard/RegionalAnalyticsCharts';
import { MasterDuplicateChart } from './components/Dashboard/MasterDuplicateChart';
import { AnomalyDetailCard } from './components/Dashboard/AnomalyDetailCard';
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
import { FinalDataManager } from './components/WorkingEngine/FinalDataManager';
import { cityMatchKey, makeFinalKey, barisFinalLengkap, pilFinalDariCloud, hitungBit, bitTemuanBaris, AnalisaDibatalkan, type AnalystRow, type AnalystCoverage } from './utils/analystPipeline';
import { jalankanAnalisaDiWorker, batalAnalisaDiWorker } from './utils/analystRunner';
import { SinyalTemuanModal } from './components/WorkingEngine/SinyalTemuanModal';
import { detectFinalAnomalies } from './utils/finalAnomaly';
import type { ActiveTab } from './components/Sidebar';

import type { MasterRow, TargetRow, WilayahStat, WilayahSetting } from './types';
import { buildMasterIndex, analyzeMasterHealth } from './utils/matcher';
import { formatWilayahName } from './utils/normalizer';
import { formatWilayahCode } from './utils/excel';
import type { RoleMappingRecord } from './components/RoleMapping/RoleMappingManager';
import { DEFAULT_ROLE_MAPPING_DATA } from './components/RoleMapping/RoleMappingManager';
import type { PTENRecord } from './components/PTENData/PTENManager';
import { DEFAULT_PTEN_DATA } from './components/PTENData/defaultPtenData';
import { DEFAULT_KODEPOS_DATA } from './components/KodePosData/defaultKodePosData';
import { buildPtenIndex, validatePtenForTarget } from './utils/ptenMatcher';

import { getItem, setItem, setItemDebounced, cancelPendingWrite, deleteKey, PERISTIWA_GAGAL_LOKAL } from './utils/storage';
import {
  checkNeonStatus,
  loadMasterFromNeon,
  jaminBarisMaster,
  saveMasterToNeon,
  clearMasterFromNeon,
  loadTargetFromNeon,
  saveTargetToNeon,
  loadWilayahFromNeon,
  saveWilayahToNeon,
  loadFinalFromNeon,
  saveFinalToNeon,
  deleteFinalKeysInNeon,
  clearFinalInNeon,
  clearTargetFromNeon,
  fetchKodePosExport,
  fetchKodePosStats,
  type KodePosRow,
} from './utils/neonSync';
import { NeonDatabaseModal } from './components/NeonDatabaseModal';
import { SnapshotModal, type WorkspaceSnapshot } from './components/SnapshotModal';
import { DEFAULT_WILAYAH_DATA, normalizeWilayahItem } from './utils/defaultWilayah';
import { Filter } from 'lucide-react';

export const App: React.FC = () => {
  const { add: notify } = useNotification();
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
  const [kodePosCount, setKodePosCount] = useState<number>(0);

  // New Data Analyst 3-Phase Engine State (100% Data Master Driven)
  const [analystRows, setAnalystRows] = useState<AnalystRow[]>([]);
  const [analystCoverage, setAnalystCoverage] = useState<AnalystCoverage | null>(null);
  // Final Data: baris hasil analisa yang sudah disetujui ("Saya Setuju") pindah ke sini.
  const [finalRows, setFinalRows] = useState<AnalystRow[]>([]);
  // Pemetaan manual hasil "Setujui" di laporan cakupan: kunci kota master (cityMatchKey)
  // → nama kota PTEN. Baris master kota itu dipakai atas nama kota PTEN terpilih.
  const [cityOverrides, setCityOverrides] = useState<Record<string, string>>({});
  // Kartu sinyal yang sedang dibuka detail temuannya (nomor 1..13, null = tertutup).
  const [sinyalDibuka, setSinyalDibuka] = useState<number | null>(null);
  // A7: penanda "N baris belum disetujui" yang bisa diklik — fase yang sedang disaring.
  // Full Master Kode Pos list (loaded once from cloud, cached in memory for pipeline runs)
  const kodePosListRef = useRef<KodePosRow[] | null>(null);
  // Cerminan reaktif dari kodePosListRef agar Dashboard bisa menghitung cakupan kode pos.
  const [kodePosMasterRows, setKodePosMasterRows] = useState<KodePosRow[]>([]);
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

  // Tulis IndexedDB gagal itu nyata (kuota penuh / mode privat) dan mayoritas panggilan
  // membuang rejection-nya, jadi storage.ts mengirim event dan hanya di sini notifikasinya muncul.
  const efekGagalLokal = useRef(0);
  useEffect(() => {
    const handler = () => {
      const sekarang = Date.now();
      if (sekarang - efekGagalLokal.current < 15000) return;
      efekGagalLokal.current = sekarang;
      notify(
        'Gagal menyimpan ke penyimpanan browser — perubahan terakhir bisa hilang bila tab ditutup. Buka menu Database untuk memastikan data sudah masuk cloud.',
        'error'
      );
    };
    window.addEventListener(PERISTIWA_GAGAL_LOKAL, handler);
    return () => window.removeEventListener(PERISTIWA_GAGAL_LOKAL, handler);
  }, [notify]);

  // Restore persisted data (Instant Cache-First + Parallel Cloud Revalidation)
  useEffect(() => {
    const restoreSavedData = async () => {
      // -----------------------------------------------------------------------
      // STEP 1: INSTANT LOCAL LOAD (< 15ms)
      // Read local IndexedDB immediately in parallel so the UI is ready instantly
      // -----------------------------------------------------------------------
      try {
        const [savedMaster, savedTarget, savedWilayah, savedPten, savedRoleMapping, savedCityOverrides] = await Promise.all([
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
          getItem<Record<string, string>>('analyst_city_overrides').catch(() => null),
        ]);

        if (savedMaster && savedMaster.rows && savedMaster.rows.length > 0) {
          setMasterRows(jaminBarisMaster(savedMaster.rows));
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

        if (savedCityOverrides && typeof savedCityOverrides === 'object' && !Array.isArray(savedCityOverrides)) {
          setCityOverrides(savedCityOverrides);
        }

        const savedKodePos = await getItem<any[]>('kodepos_master_data');
        if (savedKodePos && Array.isArray(savedKodePos) && savedKodePos.length > 0) {
          // Simpan di cache pipeline hanya bila ini master penuh (bukan seed bawaan ~140 baris),
          // supaya Analisa tidak mengunduh ulang 83 ribu baris dari cloud.
          if (savedKodePos.length > DEFAULT_KODEPOS_DATA.length) {
            kodePosListRef.current = savedKodePos as KodePosRow[];
            setKodePosMasterRows(savedKodePos as KodePosRow[]);
          }
        } else {
          setItem('kodepos_master_data', DEFAULT_KODEPOS_DATA);
        }

        // HARD PURGE sekali: hapus permanen hasil Analisa lama (struktur lama tidak
        // kompatibel dengan pipeline berbasis kota PTEN + kodepos penuh)
        if (localStorage.getItem('analyst_purge_v2') !== 'done') {
          await deleteKey('analyst_results_data');
          await deleteKey('analyst_final_data');
          localStorage.setItem('analyst_purge_v2', 'done');
        } else {
          const [savedAnalyst, savedFinal] = await Promise.all([
            getItem<AnalystRow[]>('analyst_results_data'),
            getItem<AnalystRow[]>('analyst_final_data'),
          ]);
          if (savedAnalyst && Array.isArray(savedAnalyst) && savedAnalyst.length > 0) {
            setAnalystRows(savedAnalyst);
          }
          if (savedFinal && Array.isArray(savedFinal) && savedFinal.length > 0) {
            setFinalRows(savedFinal);
          }
        }
      } catch (err) {
        console.warn('Local cache restore skipped:', err);
      }

      // -----------------------------------------------------------------------
      // STEP 2: PARALLEL BACKGROUND CLOUD SYNC (Non-blocking)
      // Fetch latest updates from cloud (Supabase Postgres) concurrently
      // -----------------------------------------------------------------------
      (async () => {
        try {
          // Check cloud status & load data in parallel
          const [neonCheck, neonMaster, neonTarget, neonWilayah, neonKodePosStats] = await Promise.allSettled([
            checkNeonStatus(),
            loadMasterFromNeon(),
            loadTargetFromNeon(),
            loadWilayahFromNeon(),
            fetchKodePosStats(),
          ]);

          if (neonCheck.status === 'fulfilled' && neonCheck.value.connected) {
            setIsNeonConnected(true);
            setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
          }

          // Badge menu Kode Pos = jumlah baris asli di database, bukan seed bawaan.
          if (neonKodePosStats.status === 'fulfilled' && neonKodePosStats.value) {
            setKodePosCount(neonKodePosStats.value.total);
          }

          if (neonMaster.status === 'fulfilled' && neonMaster.value && neonMaster.value.rows.length > 0) {
            setMasterRows(neonMaster.value.rows);
          } else if (
            neonCheck.status === 'fulfilled' &&
            neonCheck.value.connected &&
            neonMaster.status === 'fulfilled' &&
            neonMaster.value
          ) {
            // Cloud terhubung dan bacaannya SUKSES tapi 0 baris (mis. proyek Supabase baru)
            // padahal browser punya data: dorong sebagai salinan kedua, sama seperti
            // Target/Wilayah/Final. `neonMaster.value` wajib ada — tanpa itu, satu bacaan
            // yang timeout (null) akan membuat browser menimpa cloud yang sebenarnya
            // sudah berisi data orang lain, karena jalur replace kini benar-benar menghapus.
            const lokal = await getItem<{ rows: MasterRow[]; fileName: string }>('master_data').catch(() => null);
            if (lokal && lokal.rows.length > 0) {
              const ok = await saveMasterToNeon(lokal.rows, lokal.fileName || 'Master Cabang').catch(() => false);
              notify(
                ok
                  ? `${lokal.rows.length.toLocaleString('id-ID')} baris Data Cabang dari browser ini sudah dikirim ke cloud.`
                  : `${lokal.rows.length.toLocaleString('id-ID')} baris Data Cabang ada di browser ini tapi gagal dikirim ke cloud.`,
                ok ? 'info' : 'warning'
              );
            }
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

            // PENTING: Hanya timpa state lokal jika data cloud memiliki jumlah data match LEBIH BANYAK!
            // Jika data lokal IndexedDB memiliki data match lebih banyak (baru disetujui),
            // pertahankan data lokal dan langsung dorong (push) pembaruan tersebut ke database DB!
            if (neonMatchedCount > localMatchedCount) {
              setTargetRows(neonRows);
              setTargetFileName(neonTarget.value.fileName || '');
              setInitialTargetCount(neonTarget.value.initialCount || neonRows.length);
              setMatchedDone(neonTarget.value.matchedDone || false);
              setItem('target_data', { ...neonTarget.value, rows: neonRows }).catch(() => {});
            } else if (localTarget && localTarget.rows && localTarget.rows.length > 0) {
              // Data lokal lebih mutakhir -> sinkronkan data lokal ke database Postgres
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
          console.warn('Background cloud sync skipped:', cloudErr);
        }
      })();

      // ---------------------------------------------------------------------
      // STEP 2b: Data Final ↔ cloud (G9). Non-destruktif: salinan cloud hanya
      // MENAMBAH baris yang belum ada di browser, tidak pernah menimpa yang lokal.
      // Dedup lewat kunci alami (kode pos + kelurahan + kecamatan + kota), bukan `id`
      // yang berubah tiap run (G12).
      // ---------------------------------------------------------------------
      (async () => {
        const cloud = await loadFinalFromNeon();
        if (!cloud) return; // endpoint tidak tersedia (dev tanpa serverless / offline)

        const lokal = ((await getItem<AnalystRow[]>('analyst_final_data')) || []).filter(
          (r) => r && typeof r.id === 'string'
        );
        const tambahan = pilFinalDariCloud(lokal, cloud.rows);

        if (tambahan.length > 0) {
          const merged = [...lokal, ...tambahan];
          setFinalRows(merged);
          setItem('analyst_final_data', merged).catch(() => {});
          notify(
            `${tambahan.length} baris Data Final dipulihkan dari cloud — browser ini belum memilikinya.`,
            'info'
          );
        } else if (lokal.length > 0 && cloud.rows.length === 0) {
          // Cloud kosong padahal browser punya hasil. Dulu selalu ditanamkan lagi —
          // akibatnya "Reset Data" di satu browser bangkit kembali dari salinan lama di
          // browser/tab lain. Reset sekarang dicatat, dan catatan itu menang.
          const diresetPada = await getItem<number>('final_data_direset');
          if (diresetPada) {
            setFinalRows([]);
            void setItem('analyst_final_data', []);
            notify(
              `${lokal.length.toLocaleString('id-ID')} baris Data Final lama dibuang — final data sudah direset dari menu Final Data.`,
              'info'
            );
          } else {
          // Dulu cabang ini menanam ulang salinan browser ke cloud diam-diam. Itulah
          // sebabnya "Reset Data Final" terasa gagal: tabel dikosongkan, lalu tab lain
          // yang masih punya salinan mengisinya kembali. Cloud yang jadi kebenaran;
          // penanaman sekarang harus keputusan user, bukan efek samping memuat halaman.
          notify(
            `${lokal.length.toLocaleString('id-ID')} baris Data Final hanya ada di browser ini, cloud kosong. ` +
              'Tekan Reset Data Final untuk membuang salinan lokal ini, atau Simpan ke Cloud kalau memang mau menanamnya kembali.',
            'warning'
          );
          }
        }
      })().catch((err) => console.warn('Sinkron Final latar belakang dilewati:', err));
    };

    restoreSavedData();
    // `notify` stabil (useCallback tanpa dep) — effect ini memang hanya sekali saat boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to persist target & match data across IndexedDB and Supabase Postgres asynchronously (0ms UI blocking)
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

      // 2. Supabase Postgres (basis data cloud di Vercel)
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

  // ── Dashboard = DATA FINAL + DATA CABANG ──
  // Keputusan pemilik produk 2026-09-22 (menyelesaikan H3): seluruh angka dashboard
  // dihitung dari `finalRows`, bukan `targetRows` (alur unggah Target lama). Selama
  // masih memakai targetRows, kartu 1 / grafik / tabel bawah melaporkan berkas unggah
  // lama sementara kartu lain dan peta melaporkan hasil analisa — tidak ada yang salah
  // hitung, tapi keduanya tidak bisa dibandingkan.
  /** Kunci wilayah kanonik ("W07"); kosong bila barisnya memang tanpa wilayah. */
  const kunciWilayah = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s && s !== '-' && s !== '0' ? formatWilayahCode(s) : '';
  };

  // Daftar wilayah untuk filter: dari Setting Wilayah, Data Cabang, dan Data Final.
  const wilayahList = useMemo(() => {
    const set = new Set<string>();
    wilayahSettings.forEach((s) => {
      const k = kunciWilayah(s.wilayah || s.kodeWilayah || s.keterangan || s.namaOutlet);
      if (k) set.add(k);
    });
    masterRows.forEach((m) => {
      const k = kunciWilayah(m.Wilayah);
      if (k) set.add(k);
    });
    finalRows.forEach((r) => {
      const k = kunciWilayah(r.wilayah);
      if (k) set.add(k);
    });
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0));
  }, [wilayahSettings, masterRows, finalRows]);

  // Jumlah baris Data Final per wilayah (satu putaran, dipakai dropdown filter).
  const finalWilayahCounts = useMemo(() => {
    const map = new Map<string, number>();
    finalRows.forEach((r) => {
      const k = kunciWilayah(r.wilayah) || 'Tanpa Wilayah';
      map.set(k, (map.get(k) || 0) + 1);
    });
    return map;
  }, [finalRows]);

  // Baris yang sedang dilihat di dashboard (filter wilayah pada toolbar).
  const dashboardFilteredRows = useMemo(() => {
    if (dashboardWilayahFilter === 'ALL') return finalRows;
    const target = kunciWilayah(dashboardWilayahFilter);
    return finalRows.filter((r) => (kunciWilayah(r.wilayah) || 'Tanpa Wilayah') === (target || 'Tanpa Wilayah'));
  }, [finalRows, dashboardWilayahFilter]);

  // SATU perhitungan anomali untuk seluruh dashboard (kartu, donut, grafik, tabel).
  const finalAnomali = useMemo(() => detectFinalAnomalies(finalRows, masterRows), [finalRows, masterRows]);
  const anomaliIds = useMemo(() => new Set(finalAnomali.map((a) => a.row.id)), [finalAnomali]);

  // Anomali ikut lingkup yang SAME dengan baris yang sedang dilihat. Sengaja disaring
  // lewat id `dashboardFilteredRows`, bukan lewat kunci wilayah lagi: filter 'ALL' punya
  // jalur sendiri di atas dan menyalin perbandingan kuncinya ke sini membuat kartu ini
  // melaporkan 0 anomali padahal TOTAL ANOMALI 53.384.
  const anomaliTersaring = useMemo(() => {
    const terlihat = new Set(dashboardFilteredRows.map((r) => r.id));
    return finalAnomali.filter((a) => terlihat.has(a.row.id));
  }, [finalAnomali, dashboardFilteredRows]);

  // Komposisi donut: irisan harus berjumlah total baris, jadi kategori dihitung
  // dari `primary` (kategori teratas tiap baris). Jumlah per kategori penuh ada di tooltip.
  const dashboardKomposisi = useMemo(() => {
    const perKategori: Record<string, number> = { PULAU: 0, PROVINSI: 0, STATUS: 0, PENEMPATAN: 0, ROLE: 0 };
    finalAnomali.forEach((a) => {
      perKategori[a.primary] = (perKategori[a.primary] || 0) + 1;
    });
    return {
      total: dashboardFilteredRows.length,
      bersih: dashboardFilteredRows.length - dashboardFilteredRows.filter((r) => anomaliIds.has(r.id)).length,
      perKategori,
    };
  }, [finalAnomali, dashboardFilteredRows, anomaliIds]);

  // Regional Stats untuk widget distribusi wilayah: `matched` = baris bersih,
  // `unmatched` = baris beranomali (definisi yang sama dengan kartu TOTAL ANOMALI).
  const regionalStats: WilayahStat[] = useMemo(() => {
    const map = new Map<string, { total: number; matched: number; unmatched: number }>();
    dashboardFilteredRows.forEach((r) => {
      const k = kunciWilayah(r.wilayah) || 'Tanpa Wilayah';
      const current = map.get(k) || { total: 0, matched: 0, unmatched: 0 };
      current.total++;
      if (anomaliIds.has(r.id)) current.unmatched++;
      else current.matched++;
      map.set(k, current);
    });
    return Array.from(map.entries())
      .map(([wilayah, data]) => ({
        wilayah,
        total: data.total,
        matched: data.matched,
        unmatched: data.unmatched,
        rate: data.total > 0 ? (data.matched / data.total) * 100 : 0,
      }))
      .sort((a, b) => (parseInt(a.wilayah.replace(/\D/g, ''), 10) || 0) - (parseInt(b.wilayah.replace(/\D/g, ''), 10) || 0));
  }, [dashboardFilteredRows, anomaliIds]);

  // ── Metrik Dashboard berbasis DATA FINAL (real, bukan dummy) ──
  // SATUAN = KODE POS (5 digit, distinct), sesuai keputusan Anda.
  const finalMetrics = useMemo(() => {
    const finalCount = finalRows.length; // jumlah baris Data Final (dipakai sbg keterangan)
    const normKp = (v: string) => String(v || '').replace(/\D/g, '').slice(0, 5);
    const finalKodePosSet = new Set(finalRows.map((r) => normKp(r.kodePosPten)).filter(Boolean));
    const distinctKodePos = finalKodePosSet.size; // kartu "sudah disesuaikan" (kode pos unik)

    // Kartu "belum dikerjakan": jika data final kosong/direset, set ke 0.
    const fullMaster = kodePosMasterRows.length > DEFAULT_KODEPOS_DATA.length ? kodePosMasterRows : null;
    let totalKodePos = 0;
    let belumDikerjakan = 0;
    if (finalCount > 0) {
      if (fullMaster) {
        const masterKodePosSet = new Set(fullMaster.map((kp) => normKp(kp.kodePos)).filter(Boolean));
        let doneInMaster = 0;
        finalKodePosSet.forEach((k) => { if (masterKodePosSet.has(k)) doneInMaster++; });
        totalKodePos = masterKodePosSet.size;
        belumDikerjakan = Math.max(0, masterKodePosSet.size - doneInMaster);
      } else {
        totalKodePos = kodePosCount;
        belumDikerjakan = Math.max(0, kodePosCount - distinctKodePos);
      }
    }

    // Kartu anomali: SATU definisi (detectFinalAnomalies), bernilai 0 bila data kosong.
    const anomali = finalCount > 0 ? finalAnomali.length : 0;

    // Kartu "kode pos dengan cabang terbanyak" di Data Final.
    const byKode = new Map<string, { count: number; kota: string }>();
    if (finalCount > 0) {
      for (const r of finalRows) {
        const kp = normKp(r.kodePosPten);
        if (!kp) continue;
        const e = byKode.get(kp);
        if (e) e.count++;
        else byKode.set(kp, { count: 1, kota: r.kotaPtenMax15 || r.kotaPten || r.groupKota || '-' });
      }
    }
    let top = { kodePos: '-', count: 0, kota: '-' };
    for (const [kp, v] of byKode) if (v.count > top.count) top = { kodePos: kp, count: v.count, kota: v.kota };

    return { finalCount, distinctKodePos, totalKodePos, belumDikerjakan, anomali, top };
  }, [finalRows, kodePosMasterRows, kodePosCount, finalAnomali]);

  // ✋ Pembatalan analisa (A4): flag bersama yang dibaca pipeline tiap `tick()`.
  // Hasil run baru ditulis setelah pipeline kembali, jadi membatalkan tidak pernah
  // meninggalkan hasil setengah jadi.
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const handleBatalkanAnalisa = () => {
    if (!isAnalyzing) return;
    batalAnalisaDiWorker();
    setIsCancelling(true);
  };

  // Execution Trigger for New Data Analyst Engine (3-Phase Pipeline)
  // `overrides` dipakai saat re-run langsung setelah Setujui/Batalkan — state
  // cityOverrides belum ter-update di render ini, jadi kirim nilainya eksplisit.
  // `sampaiFase` default: fase pertama yang belum disetujui penuh (alur bertahap).
  const handleStartAnalystPipeline = async (
    reRunAnomaliesOnly = false,
    overrides?: Record<string, string>,
    sampaiFase?: 1 | 2 | 3,
    // Baris dasar untuk run ini. Wajib eksplisit saat dipanggil tepat setelah
    // "Setujui Fase": state `analystRows` di closure ini masih berisi array
    // SEBELUM persetujuan, jadi tanpa parameter ini persetujuan yang baru saja
    // diberikan akan tertimpa hasil run.
    barisDasar?: AnalystRow[]
  ) => {
    const targetFase = sampaiFase ?? faseBerikutnya;
    const lama = barisDasar ?? analystRows;
    setIsCancelling(false);
    setIsAnalyzing(true);
    setAnalystProgress(10);
    setAnalystMessage(`Menyiapkan 5 Data Master & indeks memori O(1)... (Fase ${targetFase})`);
    // Hanya fase yang akan dijalankan yang di-reset. Dulu seluruh kartu dinolkan di sini,
    // jadi menekan "Lanjut Fase 2" membuat kartu Fase 1 terlihat menghitung ulang dari 0
    // padahal fase itu sudah selesai dan disetujui.
    setPhaseProgress((prev) => ({ ...prev, [targetFase]: 0 }));
    setCurrentActivePhase(targetFase);
    setCompletedPhases((prev) => new Set([...prev, targetFase]));

    try {
      // ── Pastikan pipeline memakai SELURUH Master Kode Pos (puluhan ribu baris),
      //    bukan DEFAULT_KODEPOS_DATA yang cuma ~140 baris ──
      let kodePosForPipeline = kodePosListRef.current;
      if (!kodePosForPipeline) {
        setAnalystMessage('Mengunduh seluruh Master Data Kode Pos dari cloud (83 ribu+ baris)...');
        const cloudKodePos = await fetchKodePosExport({});
        // "lengkap" = lebih dari data contoh bawaan. Tanpa gerbang ini Analisa jalan di
        // atas ±140 baris DEFAULT_KODEPOS_DATA dan layar menampilkan angka kecil seolah
        // itulah isi database — yang terjadi saat /api/kodepos?view=export balas 500.
        const masterLengkap = (rows: KodePosRow[] | null | undefined) =>
          !!rows && rows.length > DEFAULT_KODEPOS_DATA.length;
        if (masterLengkap(cloudKodePos)) {
          kodePosForPipeline = cloudKodePos as KodePosRow[];
          setKodePosCount((cloudKodePos as KodePosRow[]).length);
          // Simpan master penuh hasil unduhan: tanpa ini tiap Analisa mengunduh ulang
          // 83 ribu baris (terukur 51,5 detik untuk 17 window), dan boot berikutnya
          // masih menemukan seed 139 baris di 'kodepos_master_data'.
          void setItem('kodepos_master_data', cloudKodePos);
        } else {
          const savedKodePos = await getItem<KodePosRow[]>('kodepos_master_data');
          if (masterLengkap(savedKodePos)) {
            kodePosForPipeline = savedKodePos as KodePosRow[];
          } else {
            throw new Error(
              'Master Kode Pos tidak lengkap — cloud gagal dibaca dan simpanan lokal hanya data contoh. '
                + 'Buka Data Kode Pos → Sync Data, tunggu sampai jumlah baris muncul, lalu jalankan analisa lagi.'
            );
          }
        }
        kodePosListRef.current = kodePosForPipeline;
        setKodePosMasterRows(kodePosForPipeline);
      }

      const activeOverrides = overrides || cityOverrides;
      // ── Pemetaan manual (Setujui di laporan cakupan): baris master kota yang
      //    dipetakan operator dipakai ATAS NAMA kota PTEN pilihan, sehingga ikut
      //    join nama-kota deterministik seperti kota asli PTEN (bukan fuzzy). ──
      const overrideKeys = Object.keys(activeOverrides);
      const kodePosInput =
        overrideKeys.length > 0
          ? kodePosForPipeline.map((kp) => {
              const ptenKota = activeOverrides[cityMatchKey(kp.kabupatenKota)];
              return ptenKota ? { ...kp, kabupatenKota: ptenKota } : kp;
            })
          : kodePosForPipeline;
      const { rows: results, coverage } = await jalankanAnalisaDiWorker(
        {
          masterRows,
          ptenList,
          kodePosList: kodePosInput,
          wilayahSettings,
          roleMappingList,
          reRunAnomaliesOnly,
          previousRows: lama,
          // Analisis inkremental: kelurahan yang sudah ada di Final Data tidak diulang.
          // Hanya baris Final yang benar-benar punya cabang yang boleh dilewati — baris
          // Final berdashes justru harus bisa dikerjakan ulang, kalau tidak Final yang
          // kosong terkunci selamanya (jalur perbaikan lewat "Ulangi Analisa" mati).
          excludeFinalKeys: finalRows.filter(barisFinalLengkap).map((fr) => makeFinalKey(fr.kodePosPten, fr.kelurahan, fr.kecamatan, fr.kotaPten)),
          sampaiFase: targetFase,
        },
        (phase, pct, _processed, _total, msg) => {
          setAnalystProgress(pct);
          setAnalystMessage(`[Fase ${phase}] ${msg}`);
          // Pipeline memakai nomor fase internal untuk tahap pencarian kota. Kartu fase di
          // bawah `targetFase` sudah selesai dan tidak boleh bergerak lagi — itu yang dulu
          // membuat "Lanjut Fase 2" terlihat mengulang perhitungan dari Fase 1.
          const kartu = Math.max(phase, targetFase) as 1 | 2 | 3;
          setCurrentActivePhase(kartu);
          // Phase 1: global 0-33%, Phase 2: 33-66%, Phase 3: 66-100%
          const phaseRanges: Record<1 | 2 | 3, [number, number]> = {
            1: [0, 33],
            2: [33, 66],
            3: [66, 100],
          };
          const [min, max] = phaseRanges[kartu];
          const localPct = max > min ? Math.min(100, Math.round(((pct - min) / (max - min)) * 100)) : 0;
          setPhaseProgress((prev) => ({ ...prev, [kartu]: localPct }));
        }
      );

      // Persetujuan fase sebelumnya ikut dipindah ke baris hasil baru — kunci baris
      // = kode pos PTEN + kelurahan + kecamatan + kota (sama seperti kunci Final Data).
      const persetujuanLama = new Map<string, AnalystRow>();
      lama.forEach((r) => persetujuanLama.set(makeFinalKey(r.kodePosPten, r.kelurahan, r.kecamatan, r.kotaPten), r));
      const hasil = results.map((r) => {
        const l = persetujuanLama.get(makeFinalKey(r.kodePosPten, r.kelurahan, r.kecamatan, r.kotaPten));
        if (!l) return r;
        return {
          ...r,
          fase1Approved: r.fase1Approved || l.fase1Approved,
          fase2Approved: r.fase2Approved || l.fase2Approved,
          fase3Approved: r.fase3Approved || l.fase3Approved,
          isFinalApproved: r.isFinalApproved || (l.isFinalApproved && r.statusAnalisa === 'EXACT_MATCH'),
        };
      });

      setAnalystRows(hasil);
      setAnalystCoverage(coverage);
      setIsAnalyzing(false);
      setAnalystProgress(100);
      setAnalystMessage(`Fase ${targetFase} selesai — tunggu persetujuan sebelum lanjut.`);
      // Hanya fase yang benar-benar dikerjakan yang boleh tampil penuh di kartu.
      setPhaseProgress((prev) => {
        const next = { ...prev };
        for (let p = 1; p <= targetFase; p++) next[p as 1 | 2 | 3] = 100;
        for (let p = targetFase + 1; p <= 3; p++) next[p as 1 | 2 | 3] = 0;
        return next;
      });
      setCompletedPhases(new Set([1, 2, 3].filter((p) => p <= targetFase)));
      setCurrentActivePhase(0);
      setItem('analyst_results_data', hasil).catch(() => {});
    } catch (err: any) {
      setIsAnalyzing(false);
      setCurrentActivePhase(0);
      setIsCancelling(false);
      if (err instanceof AnalisaDibatalkan) {
        // Tidak ada yang ditulis: `analystRows` lama masih utuh karena hasil baru
        // baru disimpan setelah pipeline selesai.
        setAnalystProgress(0);
        setAnalystMessage('Analisa dibatalkan — hasil tidak disimpan.');
        notify('Analisa dibatalkan. Data sebelumnya masih utuh, tidak ada hasil setengah jadi yang disimpan.', 'info');
        return;
      }
      // Bukan error fatal: analisanya berhenti rapi & state sudah dikembalikan,
      // jadi cukup notifikasi yang tidak hilang sendiri.
      notify('Terjadi kesalahan saat menjalankan analisa: ' + err?.message, 'error');
    }
  };

  // Kartu fase mengikuti status review: persen = bagian baris yang sudah di-approve fase itu.
  // Baris TIDAK_ANALISA dikecualikan dari penyebut — mereka menunggu pemetaan manual
  // (bukan bagian persetujuan), sama seperti phaseState di grid.
  // `selesai` pakai kesamaan ketat (bukan pembulatan): dengan puluhan ribu baris,
  // 1 baris belum di-approve masih terbulat jadi 100% dan kartu menampilkan "Selesai".
  // Single-pass aggregasi kartu fase dan temuan sinyal (O(N) efisien tanpa multiple iterations)
  const { phaseApproval, temuanSinyal } = useMemo(() => {
    let total = 0;
    let a = 0, b = 0, c = 0;
    let t2 = 0, t3 = 0, final = 0;
    const sinyalOut: Record<number, number> = {};

    for (let i = 0; i < analystRows.length; i++) {
      const r = analystRows[i];
      if (r.kategori !== 'TIDAK_ANALISA') {
        total++;
        if (r.fase1Approved) a++;
        if (r.fase2Approved) b++;
        if (r.fase3Approved) c++;
        if (barisFinalLengkap(r)) t2++;
        if (r.statusAnalisa && r.statusAnalisa !== 'MENUNGGU') t3++;
        if (r.isFinalApproved) final++;
      }
      const bit = bitTemuanBaris(r);
      if (bit) {
        for (const no of hitungBit(bit)) sinyalOut[no] = (sinyalOut[no] || 0) + 1;
      }
    }

    const pct = (n: number) => (total ? Math.floor((n / total) * 100) : 0);
    return {
      phaseApproval: {
        pct: { 1: pct(a), 2: pct(b), 3: pct(c) } as { 1: number; 2: number; 3: number },
        sisa: { 1: total - a, 2: total - b, 3: total - c } as { 1: number; 2: number; 3: number },
        selesai: { 1: total > 0 && a === total, 2: total > 0 && b === total, 3: total > 0 && c === total } as {
          1: boolean;
          2: boolean;
          3: boolean;
        },
        total,
        // Fase yang kolomnya belum pernah ditulis mesin belum layak disetujui: layar Data
        // Analyst menampilkan kolom Fase 2 dari kandidat, jadi barisnya bisa tetap kosong
        // tanpa terlihat. Gerbang ini dipakai tombol di kartu ATAS dan baris tombol di grid.
        tertulis: {
          1: analystRows.length > 0,
          2: total > 0 && t2 > 0,
          3: total > 0 && t3 > 0,
        } as { 1: boolean; 2: boolean; 3: boolean },
        semuaSudahFinal: total > 0 && final === total,
      },
      temuanSinyal: sinyalOut,
    };
  }, [analystRows]);

  // Alur bertahap: fase pertama yang belum disetujui penuh adalah fase yang berikutnya
  // dikerjakan — tombol, kartu, dan engine memakai angka yang sama.
  const faseBerikutnya: 1 | 2 | 3 = !phaseApproval.selesai[1] ? 1 : !phaseApproval.selesai[2] ? 2 : 3;

  const handleResetAnalyst = async () => {
    const tadi = analystRows.length;
    cancelPendingWrite('analyst_results_data');
    setAnalystRows([]);
    setAnalystCoverage(null);
    setAnalystProgress(0);
    setAnalystMessage('');
    const tersimpan = await setItem('analyst_results_data', []);
    notify(
      `${tadi.toLocaleString('id-ID')} baris antrean analisa dikosongkan${
        tersimpan ? '' : ' — gagal dicatat di browser, muat ulang halaman akan memunculkannya lagi'
      }.`,
      tersimpan ? 'info' : 'warning'
    );
  };

  // Operator memetakan 1 kota master (dari tab "belum terpetakan") ke kota PTEN pilihan.
  // Override disimpan permanen lalu pipeline dijalankan ulang supaya seluruh angka ikut berubah.
  const handleApproveCityOverride = async (masterCity: string, ptenKota: string) => {
    const next = { ...cityOverrides, [cityMatchKey(masterCity)]: ptenKota };
    setCityOverrides(next);
    await setItem('analyst_city_overrides', next);
    notify(`Peta kota "${masterCity}" → PTEN ${ptenKota} disimpan — analisa dijalankan ulang dengan aturan baru.`, 'info');
    await handleStartAnalystPipeline(false, next);
  };

  const handleRemoveCityOverride = async (masterKey: string) => {
    const next = { ...cityOverrides };
    const tadi = next[masterKey];
    delete next[masterKey];
    setCityOverrides(next);
    await setItem('analyst_city_overrides', next);
    notify(
      `Peta kota "${masterKey}" → ${tadi ?? '-'} dihapus${
        analystRows.length > 0 ? ' — analisa dijalankan ulang tanpa peta itu.' : '.'
      }`,
      'info'
    );
    if (analystRows.length > 0) await handleStartAnalystPipeline(false, next);
  };

  const handleUpdateAnalystRow = (updated: AnalystRow) => {
    setAnalystRows((prev) => {
      const next = prev.map((r) => (r.id === updated.id ? updated : r));
      setItemDebounced('analyst_results_data', next);
      return next;
    });
  };

  const handleApproveSingleAnalystRow = (rowId: string) => {
    setAnalystRows((prev) => {
      const next = prev.map((r) => (r.id === rowId ? { ...r, isFinalApproved: true } : r));
      setItemDebounced('analyst_results_data', next);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Sinkron Data Final ke database (G9). Cloud = salinan kedua; IndexedDB tetap sumber
  // tampilan. Kegagalan push dilaporkan, tidak pernah diam-diam.
  // ---------------------------------------------------------------------------
  const laporkanSinkronFinal = (ok: boolean, label: string) => {
    // Offline / dev tanpa endpoint serverless: jangan menagih koneksi yang tidak ada.
    if (ok || !isNeonConnected) return;
    notify(
      `Sinkron Data Final (${label}) gagal ke cloud. Hasil tetap aman di browser ini — cloud belum menerima perubahan ini.`,
      'warning'
    );
  };

  const pushFinalSemuaKeNeon = async (rows: AnalystRow[], mode: 'upsert' | 'replace' = 'upsert') => {
    if (!isNeonConnected || rows.length === 0) return;
    const ok = await saveFinalToNeon(rows, mode);
    laporkanSinkronFinal(ok, mode === 'replace' ? 'tanam awal' : 'perbarui semua');
  };

  // "Saya Setuju (Masuk ke Final Analisa)": pindahkan baris hasil analisa ke menu Final Data.
  // Baris TIDAK_ANALISA (kota belum terpetakan) TETAP di Data Analyst sebagai antrean kerja —
  // bukan hasil final, jadi tidak ikut dipindahkan agar Final Data berisi data yang benar/real.
  // Baris yang kolom cabangnya masih kosong juga ditahan: layar Data Analyst menampilkan kolom
  // Fase 2 dari kandidat master (f2Aktif), bukan dari isi baris, jadi menyetujui fase tanpa
  // menjalankannya menghasilkan Final Data berisi puluhan ribu tanda "-".
  const handleApproveAllAnalystFinal = () => {
    const lulus = (r: AnalystRow) => r.kategori !== 'TIDAK_ANALISA' && barisFinalLengkap(r);
    const moving = analystRows.filter(lulus).map((r) => ({ ...r, isFinalApproved: true }));
    const ditahan = analystRows.filter((r) => r.kategori !== 'TIDAK_ANALISA' && !barisFinalLengkap(r)).length;
    if (moving.length === 0) {
      notify(
        ditahan > 0
          ? `${ditahan.toLocaleString('id-ID')} baris ditahan — kolom cabangnya masih kosong. Tekan "Ulangi Analisa Total" untuk menjalankan Fase 2, tunggu sampai Nama Outlet terisi, lalu setujui lagi.`
          : 'Tidak ada baris yang siap disetujui.',
        'warning'
      );
      return;
    }
    const idPindah = new Set(moving.map((r) => r.id));
    const remaining = analystRows.filter((r) => !idPindah.has(r.id));

    // Kunci alami, bukan `id`: `id` dibuat ulang tiap run (G12), jadi menimpa lewat `id`
    // membiarkan baris kosong lama menumpuk di samping baris barunya yang sudah terisi.
    const kunci = (r: AnalystRow) => makeFinalKey(r.kodePosPten, r.kelurahan, r.kecamatan, r.kotaPten);
    const byKey = new Map<string, AnalystRow>();
    for (const r of finalRows) byKey.set(kunci(r), r);
    for (const r of moving) byKey.set(kunci(r), r); // baris terbaru menimpa yang lama
    const merged = Array.from(byKey.values());

    setFinalRows(merged);
    setItem('analyst_final_data', merged).catch(() => {});
    // Ada hasil baru yang disetujui: penanda reset tidak berlaku lagi.
    void deleteKey('final_data_direset');
    void pushFinalSemuaKeNeon(merged);
    setAnalystRows(remaining);
    setItem('analyst_results_data', remaining).catch(() => {});
    setAnalystCoverage(null);
    setActiveTab('final');
    const menungguKota = remaining.length - ditahan;
    notify(
      `${moving.length.toLocaleString('id-ID')} baris disetujui masuk Data Final` +
        (ditahan > 0 ? ` — ${ditahan.toLocaleString('id-ID')} baris tanpa cabang tetap di antrean.` : '') +
        (menungguKota > 0 ? ` ${menungguKota.toLocaleString('id-ID')} baris TIDAK_ANALISA menunggu pemetaan kota.` : '.'),
      'success'
    );
  };

  // "Kembalikan ke Data Analyst": pindahkan seluruh Final Data kembali ke antrean analisa.
  const handleReturnFinalToAnalyst = () => {
    if (finalRows.length === 0) return;
    const byId = new Map<string, AnalystRow>();
    for (const r of analystRows) byId.set(r.id, { ...r, isFinalApproved: false });
    // G7: sama seperti "Revisi" per baris — kembali ke Fase 1 dengan semua persetujuan
    // fase dilepas. Kalau hanya `isFinalApproved` yang di-reset, baris muncul lagi di
    // fase terakhir sambil membawa persetujuan fase yang sudah tidak berlaku.
    for (const r of finalRows)
      byId.set(r.id, {
        ...r,
        fase1Approved: false,
        fase2Approved: false,
        fase3Approved: false,
        isFinalApproved: false,
      });
    const merged = Array.from(byId.values());

    setAnalystRows(merged);
    setItem('analyst_results_data', merged).catch(() => {});
    setFinalRows([]);
    setItem('analyst_final_data', []).catch(() => {});
    if (isNeonConnected) void clearFinalInNeon().then((ok) => laporkanSinkronFinal(ok, 'dikosongkan'));
    setActiveTab('working');
    notify(`${finalRows.length.toLocaleString('id-ID')} baris dikembalikan ke Data Analyst sebagai Fase 1.`, 'info');
  };

  // "Revisi" baris Final Data: keluarkan dari Final → kembali ke antrean Fase 1.
  // Satu fungsi untuk tombol per baris DAN aksi massal: seluruh perubahan ditulis sekali,
  // bukan N kali (83 ribu baris × N tulis = tab membeku).
  const handleReviseFinalRows = (rowIds: string[]) => {
    if (rowIds.length === 0) return;
    const ids = new Set(rowIds);
    const dipulihkan = finalRows.filter((r) => ids.has(r.id));
    if (dipulihkan.length === 0) return;
    const remainingFinal = finalRows.filter((r) => !ids.has(r.id));
    setFinalRows(remainingFinal);
    setItem('analyst_final_data', remainingFinal).catch(() => {});
    if (isNeonConnected)
      void deleteFinalKeysInNeon([...ids]).then((ok) => laporkanSinkronFinal(ok, `revisi ${ids.size} baris`));
    // Kembalikan sebagai kandidat Fase 1 (belum disetujui) ke antrean Data Analyst.
    const byId = new Map<string, AnalystRow>();
    for (const r of analystRows) byId.set(r.id, r);
    for (const r of dipulihkan)
      byId.set(r.id, {
        ...r,
        fase1Approved: false,
        fase2Approved: false,
        fase3Approved: false,
        isFinalApproved: false,
      });
    const merged = Array.from(byId.values());
    setAnalystRows(merged);
    setItem('analyst_results_data', merged).catch(() => {});
    notify(`${ids.size.toLocaleString('id-ID')} baris direvisi — keluar dari Final, masuk antrean Fase 1.`, 'info');
  };

  // "Hapus" baris Final Data: hilang permanen. Karena `excludeFinalKeys`
  // dihitung dari `finalRows` saat analisa dijalankan, baris yang dihapus otomatis
  // bisa diproses ulang dari awal pada analisa berikutnya.
  const handleDeleteFinalRows = (rowIds: string[]) => {
    if (rowIds.length === 0) return;
    const ids = new Set(rowIds);
    const remaining = finalRows.filter((r) => !ids.has(r.id));
    setFinalRows(remaining);
    setItem('analyst_final_data', remaining).catch(() => {});
    if (isNeonConnected)
      void deleteFinalKeysInNeon([...ids]).then((ok) => laporkanSinkronFinal(ok, `hapus ${ids.size} baris`));
    notify(`${ids.size.toLocaleString('id-ID')} baris Data Final dihapus permanen.`, 'info');
  };

  // "Reset Data": kosongkan seluruh Final, Target, dan Analyst (lokal + cloud) secara total.
  const handleResetFinalData = () => {
    const totalRemoved = finalRows.length + targetRows.length + analystRows.length;
    setFinalRows([]);
    setTargetRows([]);
    setAnalystRows([]);
    setTargetFileName('');
    setInitialTargetCount(0);
    setMatchedDone(false);

    void deleteKey('analyst_final_data');
    void deleteKey('target_data');
    void deleteKey('analyst_results_data');
    void setItem('final_data_direset', Date.now());

    if (isNeonConnected) {
      void clearFinalInNeon().then((ok) => laporkanSinkronFinal(ok, 'dikosongkan (reset final)'));
      void clearTargetFromNeon().then((ok) => laporkanSinkronFinal(ok, 'dikosongkan (reset target)'));
    }
    notify(`Reset Berhasil — Seluruh data (${totalRemoved.toLocaleString('id-ID')} baris total) telah dihapus dari sistem (lokal & cloud).`, 'info');
  };

  // G1: Impor baris dari Excel di menu Final Data
  // Baris baru ditambahkan ke Data Analyst (agar melewati alur validasi)
  // dan di-deduplikasi terhadap finalRows & analystRows.
  const handleImportFinalToAnalyst = (newRows: AnalystRow[]): { imported: number; skippedFinal: number; skippedAnalyst: number } => {
    const finalKeySet = new Set<string>();
    finalRows.forEach((r) => {
      finalKeySet.add(makeFinalKey(r.kodePosPten, r.kelurahan, r.kecamatan, r.kotaPten));
    });

    const analystKeySet = new Set<string>();
    analystRows.forEach((r) => {
      analystKeySet.add(makeFinalKey(r.kodePosPten, r.kelurahan, r.kecamatan, r.kotaPten));
    });

    let imported = 0;
    let skippedFinal = 0;
    let skippedAnalyst = 0;
    const toAdd: AnalystRow[] = [];

    newRows.forEach((r, idx) => {
      const key = makeFinalKey(r.kodePosPten, r.kelurahan, r.kecamatan, r.kotaPten);
      if (finalKeySet.has(key)) {
        skippedFinal++;
        return;
      }
      if (analystKeySet.has(key)) {
        skippedAnalyst++;
        return;
      }
      analystKeySet.add(key);
      imported++;
      toAdd.push({
        ...r,
        id: r.id || `imported-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        no: analystRows.length + toAdd.length + 1,
      });
    });

    if (toAdd.length > 0) {
      const merged = [...analystRows, ...toAdd];
      setAnalystRows(merged);
      setItem('analyst_results_data', merged).catch(() => {});
    }

    return { imported, skippedFinal, skippedAnalyst };
  };


  // "Setujui" pada tab Perlu Analisa Manual: barisnya dinyatakan beres, tetapi fase
  // ini belum diterima — ia pindah ke tab Berhasil Dianalisa pada fase yang sama.
  const handleBersihkanManualAnalyst = (rowIds: string[]) => {
    if (rowIds.length === 0) return;
    const ids = new Set(rowIds);
    setAnalystRows((prev) => {
      const next = prev.map((r) =>
        ids.has(r.id) ? { ...r, perluManual: false, kategori: 'DIANALISA' as const } : r
      );
      setItemDebounced('analyst_results_data', next);
      return next;
    });
  };

  // N3: aksi massal atas baris terpilih (setujui/revisi banyak baris sekaligus).
  // handleUpdateAnalystRow memindai ulang seluruh hasil untuk SATU baris, jadi
  // pilihan besar harus lewat satu pembaruan array supaya tidak membekukan tab.
  const handlePatchMassalAnalyst = (rowIds: string[], patch: Partial<AnalystRow>) => {
    if (rowIds.length === 0) return;
    const ids = new Set(rowIds);
    setAnalystRows((prev) => {
      const next = prev.map((r) => (ids.has(r.id) ? { ...r, ...patch } : r));
      setItemDebounced('analyst_results_data', next);
      return next;
    });
  };

  const handleApproveAnalystFase = (fase: 1 | 2 | 3) => {
    const baru = analystRows.map((r) => {
      if (r.kategori === 'TIDAK_ANALISA') return r; // perlu koreksi manual, jangan ikut disetujui otomatis
      if (fase === 1) return { ...r, fase1Approved: true };
      if (fase === 2) return { ...r, fase2Approved: true };
      return { ...r, fase3Approved: true };
    });
    setAnalystRows(baru);
    setItemDebounced('analyst_results_data', baru);
    // Persetujuan TIDAK lagi memicu mesin fase berikutnya. Run Fase 2 atas 83 ribu baris
    // itu ±10 ms/baris dan dulu jalan tepat saat operator pindah tab — tab-nya membeku
    // persis di momen "masuk Fase 2". Kolom Fase 2 kini ditampilkan dari kandidat rank-1
    // (lihat `paketFase2DariMaster` + `f2Aktif` di grid), jadi datanya tetap muncul tanpa
    // run; jalankan fasenya sendiri lewat tombol saat field-nya perlu ditulis ke baris.
  };

  // Master Actions (Appends new rows to existing master data with strict deduplication)
  const handleMasterLoaded = async (rowsMasuk: MasterRow[], fileName: string, mode?: 'replace' | 'append' | 'update') => {
    // Sel angka dari Excel (`Wilayah: 1`, `KODE POS: 22312`) dibulatkan ke string di sini,
    // SEBELUM barisnya dipakai state, cache browser, maupun kiriman cloud — jadi tidak ada
    // lagi satu jalur pun yang bisa menyimpan baris berjenis angka.
    const newRows = jaminBarisMaster(rowsMasuk);
    const kunciBaris = (r: MasterRow) => {
      const bc = String(r['Branch Code'] || r['Kode Cabang'] || '').trim().toUpperCase();
      const name = String(r['Nama Outlet'] || r['Sandi Cabang'] || r.Cabang || '').trim().toUpperCase();
      const kp = String(r['KODE POS'] || '').trim();
      const addr = String(r.ALAMAT || '').trim().toUpperCase();
      const kunci: string[] = [];
      if (bc && bc !== '-' && bc !== '0') kunci.push(`bc:${bc}`);
      if (name && kp) kunci.push(`ot:${name}|${kp}`);
      if (name && addr) kunci.push(`oa:${name}|${addr}`);
      return kunci;
    };

    // mode 'update' (edit/hapus manual) dan 'replace' (unggah berkas baru menimpa yang
    // lama): `newRows` adalah daftar LENGKAP hasil perubahan — terapkan apa adanya.
    // Jangan merge/dedup, karena seluruh barisnya memang sudah ada di data lama sehingga
    // akan dianggap duplikat dan perubahan (edit/hapus/ganti berkas) hilang diam-diam.
    // Sebelum 2026-09-23 'replace' masuk ke jalur append, jadi unggah berkas master baru
    // di atas data lama justru mempertahankan data lama.
    if (mode === 'update' || mode === 'replace') {
      setMasterRows(newRows);
      setItem('master_data', { rows: newRows, fileName });
      // Dulunya dipanggil tanpa await, jadi kegagalan cloud tidak pernah bisa tertangkap.
      const ok = await saveMasterToNeon(newRows, fileName).catch(() => false);
      notify(
        ok
          ? `${newRows.length.toLocaleString('id-ID')} baris master cabang${mode === 'replace' ? ' diganti' : ' diperbarui'} — tersimpan di browser dan cloud.`
          : `${newRows.length.toLocaleString('id-ID')} baris cabang tersimpan di browser, tetapi GAGAL terkirim ke cloud.`,
        ok ? 'success' : 'warning'
      );
      return;
    }

    // Dihitung di luar setState updater supaya jumlahnya bisa dilaporkan ke operator —
    // sebelumnya baris duplikat dibuang tanpa satu pun keterangan.
    const existingKeys = new Set<string>();
    for (const r of masterRows) for (const k of kunciBaris(r)) existingKeys.add(k);

    const uniqueAppended: MasterRow[] = [];
    let terlewat = 0;
    for (const r of newRows) {
      const kunci = kunciBaris(r);
      if (kunci.some((k) => existingKeys.has(k))) {
        terlewat++;
        continue;
      }
      for (const k of kunci) existingKeys.add(k);
      uniqueAppended.push(r);
    }

    const combined = [...masterRows, ...uniqueAppended];
    const combinedFileName = masterRows.length > 0 ? `${combined.length} Cabang (${fileName})` : fileName;
    setMasterRows(combined);
    setItem('master_data', { rows: combined, fileName: combinedFileName });

    if (uniqueAppended.length === 0 && terlewat > 0) {
      notify(`${terlewat.toLocaleString('id-ID')} baris "${fileName}" sudah ada di master (Branch Code / outlet+kode pos sama) — tidak ada yang ditambahkan.`, 'warning');
    } else {
      notify(
        `${uniqueAppended.length.toLocaleString('id-ID')} baris cabang baru masuk${
          terlewat > 0 ? `, ${terlewat.toLocaleString('id-ID')} duplikat dilewati` : ''
        } — total ${combined.length.toLocaleString('id-ID')}.`,
        'success'
      );
    }

    const ok = await saveMasterToNeon(combined, combinedFileName).catch(() => false);
    if (!ok) notify('Master cabang gagal terkirim ke cloud — data masih aman di browser ini.', 'warning');
  };

  const handleResetMaster = async () => {
    const tadi = masterRows.length;
    try {
      setMasterRows([]);
      const tersimpan = await setItem('master_data', { rows: [], fileName: '' });
      try {
        await clearMasterFromNeon();
        notify(
          `${tadi.toLocaleString('id-ID')} baris Data Cabang dikosongkan${tersimpan ? '' : ' (catatan browser gagal ditulis — muat ulang bisa memunculkannya lagi)'}, browser dan cloud sudah bersih.`,
          tersimpan ? 'info' : 'warning'
        );
      } catch (e) {
        // F3-C3: cloud gagal saat reset — beri tahu operator, jangan diam-diam
        console.warn('Cloud clear warning:', e);
        notify(
          'Data Cabang dikosongkan di browser, tetapi GAGAL dihapus dari cloud. ' +
            'Sinkronkan ulang atau periksa koneksi database.',
          'warning'
        );
      }
    } catch (e) {
      // F3-C3: error total (IndexedDB / setState) — operator harus tahu
      console.warn('Reset master error:', e);
      notify(
        'Gagal mengosongkan Data Cabang. Coba lagi atau muat ulang halaman.',
        'error'
      );
    }
  };

  // Target Actions (Uploads new rows with strict Excel order preservation & immediate PTEN/Role validation)
  const handleTargetLoaded = (
    newRows: TargetRow[],
    fileName: string,
    mode: 'replace' | 'append' = 'replace'
  ) => {
    // Dulu seluruh isi fungsi ini berjalan di dalam updater setTargetRows(), jadi effect
    // samping (persist, setState lain) bisa dijalankan dua kali oleh React dan jumlahnya
    // tidak bisa dilaporkan ke operator. Sekarang dihitung lurus di luar updater.
    const sebelum = targetRows;
    const append = mode === 'append' && sebelum.length > 0;
    const mulaiNo = append ? sebelum.length : 0;
    const cocokSebelum = sebelum.filter((r) => Boolean(r._isMatched) || Boolean(r.Sandi) || Boolean(r.Cabang)).length;

    const indeks = (r: TargetRow, idx: number): TargetRow => {
      const ptenRes = validatePtenForTarget(r['KODE POS'], r['Dati II'] || r.Kota || '', ptenIndex);
      return {
        ...r,
        No: r.No !== undefined && String(r.No).trim() !== '' ? r.No : mulaiNo + idx + 1,
        _excelRowIndex: mulaiNo + idx + 1,
        'KOTA PTEN': r['KOTA PTEN'] || ptenRes.kotaPten,
        'KODE POS PTEN': r['KODE POS PTEN'] || ptenRes.kodePosPten,
        'CEK KODE POS + PTEN': r['CEK KODE POS + PTEN'] || ptenRes.statusPten,
      };
    };

    const bernomor = newRows.map(indeks);
    // Mode Replace (default): urutan 100% murni persis sesuai file Excel yang diunggah.
    const finalRows = append ? [...sebelum, ...bernomor] : bernomor;
    const finalFileName = append ? `${finalRows.length} Data Target (${fileName})` : fileName;

    setTargetRows(finalRows);
    setTargetFileName(finalFileName);
    setInitialTargetCount(finalRows.length);
    setMatchedDone(false);

    persistTargetData({
      rows: finalRows,
      fileName: finalFileName,
      initialCount: finalRows.length,
      matchedDone: false,
    });

    const ganti = !append && cocokSebelum > 0;
    notify(
      `${bernomor.length.toLocaleString('id-ID')} baris target dimuat dari "${fileName}"` +
        (append ? `, total kini ${finalRows.length.toLocaleString('id-ID')} baris` : '') +
        (ganti ? ` — hasil pencocokan ${cocokSebelum.toLocaleString('id-ID')} baris sebelumnya ikut diganti` : '') +
        '.',
      ganti ? 'warning' : 'success'
    );
  };

  // Restore Session Snapshot (.json) - Memulihkan data Master, Target, dan Hasil Pencocokan
  const handleRestoreSnapshot = async (snapshot: WorkspaceSnapshot) => {
    if (snapshot.masterData && Array.isArray(snapshot.masterData.rows)) {
      const nama = snapshot.masterData.fileName || 'Snapshot Master';
      const baris = jaminBarisMaster(snapshot.masterData.rows);
      setMasterRows(baris);
      setItem('master_data', { rows: baris, fileName: nama });
      const ok = await saveMasterToNeon(baris, nama).catch(() => false);
      if (!ok) notify(`${baris.length.toLocaleString('id-ID')} baris master dipulihkan di browser, tetapi GAGAL dikirim ke cloud.`, 'warning');
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
    notify(
      `Cadangan dipulihkan: ${(snapshot.masterData?.rows.length ?? 0).toLocaleString('id-ID')} baris master` +
        ` dan ${(snapshot.targetData?.rows.length ?? 0).toLocaleString('id-ID')} baris target.` +
        (snapshot.note ? ` Catatan: ${snapshot.note}.` : ''),
      'success'
    );
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
        finalCount={finalRows.length}
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
                          ? `Menampilkan seluruh ${finalRows.length.toLocaleString('id-ID')} baris Data Final (${wilayahList.length} Wilayah)`
                          : `Menampilkan khusus ${formatWilayahName(dashboardWilayahFilter)} (${dashboardFilteredRows.length.toLocaleString('id-ID')} baris)`}
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
                        <option value="ALL">Semua Wilayah ({finalRows.length.toLocaleString('id-ID')} Data)</option>
                        {wilayahList.map((w) => {
                          const countW = finalWilayahCounts.get(w) || 0;
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

              <MetricCards finalMetrics={finalMetrics} wilayahCount={regionalStats.length} />

              {/* URUTAN KE-2: Peta Tracking Penyebaran Cabang BNI di Indonesia (GIS & Google Maps Direct Link) */}
              <IndonesiaBranchMap
                masterRows={masterRows}
                targetRows={targetRows}
                finalRows={finalRows}
                kodePosRows={kodePosMasterRows}
                selectedWilayah={dashboardWilayahFilter}
                onNavigateToMaster={() => setActiveTab('master')}
                onNavigateToEngine={() => {
                  setActiveTab('working');
                }}
              />

              {/* Visual Analisis: Dekomposisi Donut Chart & Kinerja Wilayah */}
              <RegionalAnalyticsCharts
                stats={regionalStats}
                komposisi={dashboardKomposisi}
                selectedWilayah={dashboardWilayahFilter}
              />

              {/* Semua baris anomali Data Final beserta alasannya, per kelas anomali */}
              <AnomalyDetailCard anomali={anomaliTersaring} totalBarisFinal={dashboardFilteredRows.length} />

              {/* Visualisasi Data Master Duplikat / Multi-Cabang per Kode Pos */}
              <MasterDuplicateChart
                masterHealth={masterHealth}
                masterRows={masterRows}
                selectedWilayah={dashboardWilayahFilter}
                onNavigateToMaster={() => setActiveTab('master')}
              />

              {/* Rekapitulasi Data Final per Wilayah & Download Laporan Excel/PDF */}
              <DashboardMatchTable
                finalRows={finalRows}
                anomaliIds={anomaliIds}
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
                onBatalkanAnalysis={handleBatalkanAnalisa}
                isCancelling={isCancelling}
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
                phaseApproval={phaseApproval}
                faseBerikutnya={faseBerikutnya}
                temuanSinyal={temuanSinyal}
                onLihatTemuan={setSinyalDibuka}
                onApproveFase={handleApproveAnalystFase}
                onApproveAllFinal={handleApproveAllAnalystFinal}
                faseTertulis={phaseApproval.tertulis}
                semuaSudahFinal={phaseApproval.semuaSudahFinal}
                bitmaskBelumAda={analystRows.length > 0 && Object.keys(temuanSinyal).length === 0}
              />

              {sinyalDibuka !== null && (
                <SinyalTemuanModal key={sinyalDibuka} no={sinyalDibuka} rows={analystRows} onClose={() => setSinyalDibuka(null)} />
              )}

              {analystRows.length > 0 && (
                <AnalystResultsGrid
                  rows={analystRows}
                  onUpdateRow={handleUpdateAnalystRow}
                  onApproveSingleRow={handleApproveSingleAnalystRow}
                  onBersihkanManual={handleBersihkanManualAnalyst}
                  onPatchMassal={handlePatchMassalAnalyst}
                  onBukaMasterCabang={() => setActiveTab('master')}
                  onReRunAll={() => handleStartAnalystPipeline(false)}
                  onReRunAnomaliesOnly={() => handleStartAnalystPipeline(true)}
                  isProcessing={isAnalyzing}
                  wilayahSettings={wilayahSettings}
                  coverage={analystCoverage}
                  ptenList={ptenList}
                  kodePosRows={kodePosListRef.current || []}
                  cityOverrides={cityOverrides}
                  onApproveCityOverride={handleApproveCityOverride}
                  onRemoveCityOverride={handleRemoveCityOverride}
                  masterRows={masterRows}
                  roleMappingList={roleMappingList}
                />
              )}
            </div>
          )}

          {/* MENU FINAL DATA (hasil analisa yang telah disetujui) */}
          {activeTab === 'final' && (
          <FinalDataManager
            rows={finalRows}
            onReturnAll={handleReturnFinalToAnalyst}
            onReturnRows={handleReviseFinalRows}
            onDeleteRows={handleDeleteFinalRows}
            onResetAll={handleResetFinalData}
            onImportRows={handleImportFinalToAnalyst}
            kodePosRows={kodePosMasterRows}
            masterRows={masterRows}
          />
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
              kodePosRows={kodePosMasterRows}
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
