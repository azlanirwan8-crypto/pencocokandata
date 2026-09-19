import React, { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  Zap,
  Check,
  Edit,
  Search,
  X,
  FileSpreadsheet,
  FileText,
  MapPin,
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import type { AnalystRow, AnalystCoverage } from '../../utils/analystPipeline';
import { cityMatchKey, matchRoleForOutlet } from '../../utils/analystPipeline';
import type { KodePosRow } from '../../utils/neonSync';
import type { PTENRecord } from '../PTENData/PTENManager';
import type { MasterRow, TargetRow, WilayahSetting } from '../../types';
import type { RoleMappingRecord } from '../RoleMapping/RoleMappingManager';
import { buildMasterProximityIndex, findClosestMasterRecommendation, type CandidateOption, type RecommendationResult } from '../../utils/recommender';
import { extractWilayahFromBranchCode } from '../../utils/normalizer';
import { AnalystRowEditModal } from './AnalystRowEditModal';
import { CandidateDetailModal } from './CandidateDetailModal';
import { PtenCityPicker } from './PtenCityPicker';
import { CityOverrideModal } from './CityOverrideModal';
import { formatWilayahName } from '../../utils/normalizer';
import { formatWilayahCode } from '../../utils/excel';
import { exportAnalystExecutivePdf } from '../../utils/pdfExport';
import { useVirtualWindow } from '../../utils/useVirtualWindow';

interface AnalystResultsGridProps {
  rows: AnalystRow[];
  onUpdateRow: (updatedRow: AnalystRow) => void;
  onApproveSingleRow: (rowId: string) => void;
  onApproveAllFinal: () => void;
  onApproveFase: (fase: 1 | 2 | 3) => void;
  onReRunAll: () => void;
  onReRunAnomaliesOnly: () => void;
  isProcessing: boolean;
  wilayahSettings: WilayahSetting[];
  coverage?: AnalystCoverage | null;
  ptenList?: PTENRecord[];
  kodePosRows?: KodePosRow[];
  cityOverrides?: Record<string, string>;
  onApproveCityOverride?: (masterCity: string, ptenKota: string) => void;
  onRemoveCityOverride?: (masterKey: string) => void;
  masterRows?: MasterRow[];
  roleMappingList?: RoleMappingRecord[];
}

export const AnalystResultsGrid: React.FC<AnalystResultsGridProps> = ({
  rows,
  onUpdateRow,
  onApproveSingleRow,
  onApproveAllFinal,
  onApproveFase,
  onReRunAll,
  onReRunAnomaliesOnly,
  isProcessing,
  wilayahSettings,
  coverage,
  ptenList = [],
  kodePosRows = [],
  cityOverrides = {},
  onApproveCityOverride,
  onRemoveCityOverride,
  masterRows = [],
  roleMappingList = [],
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'fase1' | 'fase2' | 'fase3'>('fase1');
  const [selectedWilayah, setSelectedWilayah] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  // Pencarian 83 ribu baris: biarkan input langsung, saring di nilai tertunda
  const deferredSearch = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ANOMALI' | 'EXACT_MATCH' | 'HIGH_CONFIDENCE' | 'PENEMPATAN_REVIEW'>('ALL');
  // Inner tab pada Fase 1: data yang teranalisa vs yang perlu analisa manual
  const [fase1Inner, setFase1Inner] = useState<'DIANALISA' | 'TIDAK_ANALISA'>('DIANALISA');
  // Inner tab pada Fase 2: outlet tervalidasi otomatis (cabang fill-in masuk Top-3
  // rekomendasi jarak terdekat) vs yang butuh validasi manual operator
  const [fase2Inner, setFase2Inner] = useState<'VALID' | 'MANUAL'>('VALID');
  // Pilihan kandidat aktif per baris (rank 1-3) + modal detail kandidat
  const [fase2Choice, setFase2Choice] = useState<Record<string, number>>({});
  const [fase2Detail, setFase2Detail] = useState<{
    row: AnalystRow;
    target: TargetRow;
    rec: RecommendationResult;
    chosen: CandidateOption;
  } | null>(null);

  // Pagination states
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(15);

  // Edit Modal
  const [editingRow, setEditingRow] = useState<AnalystRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Pemetaan kota manual (laporan cakupan): pilihan sementara per kota + modal konfirmasi
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});
  const [overrideModal, setOverrideModal] = useState<{
    masterCity: string;
    masterRows: KodePosRow[];
    ptenKota: string;
    ptenKodePos: string[];
  } | null>(null);

  // Daftar nama kota unik di PTEN untuk dropdown pemetaan manual
  const ptenKotaOptions = useMemo(() => {
    const set = new Set<string>();
    ptenList.forEach((p) => {
      const k = String(p.kotaPten || '').trim();
      if (k) set.add(k);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));
  }, [ptenList]);

  // Ringkasan 1-pass baris master per kota — baris TERSIPAH tidak boleh memfilter
  // 83 ribu baris kodePosRows setiap render (penyebab lag search/pagination)
  const cityRowSummary = useMemo(() => {
    const m = new Map<string, { name: string; kodePos: string; provinsi: string; count: number }>();
    kodePosRows.forEach((r) => {
      const k = cityMatchKey(r.kabupatenKota);
      if (!k) return;
      const s = m.get(k);
      if (s) s.count++;
      else m.set(k, { name: r.kabupatenKota, kodePos: r.kodePos, provinsi: r.provinsi, count: 1 });
    });
    return m;
  }, [kodePosRows]);

  // Baris master milik 1 kota (dipakai modal pratinjau — persis yang akan berpindah)
  const masterRowsForCity = (cityRaw: string): KodePosRow[] => {
    const key = cityMatchKey(cityRaw);
    return kodePosRows.filter((r) => cityMatchKey(r.kabupatenKota) === key);
  };

  // ── FASE 2: 3 rekomendasi outlet terdekat (engine lama recommender.ts, dipakai ulang) ──
  const masterIndex = useMemo(
    () => (masterRows.length > 0 ? buildMasterProximityIndex(masterRows) : null),
    [masterRows]
  );
  // Cache per kota: rekomendasi hanya dihitung ulang bila field Fase 2 kota itu berubah
  const fase2RecCacheRef = useRef(new Map<string, { sig: string; rec: RecommendationResult | null }>());
  const fase2Recs = useMemo(() => {
    const m = new Map<string, { rec: RecommendationResult | null; target: TargetRow }>();
    if (!masterIndex) return m;
    const cache = fase2RecCacheRef.current;
    rows.forEach((r) => {
      if (r.kategori === 'TIDAK_ANALISA') return;
      const ck = cityMatchKey(r.groupKota);
      if (!ck || m.has(ck)) return;
      const target = {
        No: r.no,
        Wilayah: r.wilayah,
        'Sandi Cabang': r.sandiCabang,
        'Branch Code': r.branchCode,
        'Kode Cabang': r.kodeCabang,
        'Nama Outlet': r.namaOutlet,
        'Status Outlet': r.statusOutlet,
        ALAMAT: r.alamat,
        'KODE POS': r.kodePosPten,
        Kelurahan: r.kelurahan,
        Kecamatan: r.kecamatan,
        'Dati II': r.groupKota,
        'Kode Dati II': '',
        Provinsi: r.provinsi,
        _originalFilledSandiCabang: r.sandiCabang,
        _originalFilledNamaOutlet: r.namaOutlet,
      } as unknown as TargetRow;
      const sig = `${r.sandiCabang}|${r.namaOutlet}|${r.branchCode}`;
      const cached = cache.get(ck);
      let rec: RecommendationResult | null;
      if (cached && cached.sig === sig) {
        rec = cached.rec;
      } else {
        try {
          rec = findClosestMasterRecommendation(target, masterIndex);
        } catch {
          rec = null;
        }
        cache.set(ck, { sig, rec });
      }
      m.set(ck, { rec, target });
    });
    return m;
  }, [rows, masterIndex]);
  // "Sudah tervalidasi" = cabang yang terlanjur terisi di data ikut masuk Top-3
  // rekomendasi jarak (audit flow lama); selain itu → validasi manual operator.
  const fase2ValidCities = useMemo(() => {
    const s = new Set<string>();
    fase2Recs.forEach((v, k) => {
      const st = v.rec?.userPrefilledAudit?.status;
      if (st === 'match_top1' || st === 'match_top2' || st === 'match_top3') s.add(k);
    });
    return s;
  }, [fase2Recs]);
  const [fase2Counts, fase2ValidCount] = useMemo(() => {
    let valid = 0;
    let total = 0;
    rows.forEach((r) => {
      if (r.kategori === 'TIDAK_ANALISA') return;
      total++;
      if (fase2ValidCities.has(cityMatchKey(r.groupKota))) valid++;
    });
    return [{ total, valid } as const, valid];
  }, [rows, fase2ValidCities]);
  const fase2ManualCount = fase2Counts.total - fase2ValidCount;

  const applyFase2Candidate = (r: AnalystRow, master: MasterRow) => {
    const branchCode = String(master['Branch Code'] || master['Kode Cabang'] || '').trim();
    const resolved = extractWilayahFromBranchCode(branchCode, wilayahSettings, r.wilayah);
    const sandiCabang = String(
      master['Sandi Cabang'] ||
        (master.Sandi && master.Cabang ? `${master.Sandi} - ${master.Cabang}` : master.Cabang || master.Sandi || r.sandiCabang)
    );
    const namaOutlet = String(master['Nama Outlet'] || master.Cabang || r.namaOutlet);
    const role = matchRoleForOutlet(namaOutlet, cityMatchKey(r.groupKota), roleMappingList);
    onUpdateRow({
      ...r,
      wilayah: resolved.wilayahName !== '-' ? resolved.wilayahName : r.wilayah,
      sandiCabang,
      branchCode,
      kodeCabang: String(master['Kode Cabang'] || branchCode),
      namaOutlet,
      statusOutlet: String(master['Status Outlet'] || r.statusOutlet || 'Aktif'),
      alamat: String(master.ALAMAT || r.alamat),
      ...role,
      isFinalApproved: role.statusAnalisa === 'EXACT_MATCH' ? r.isFinalApproved : false,
      editedManually: true,
    });
    showToast(`Baris #${r.no}: outlet diganti ke ${namaOutlet} — wilayah & role dihitung ulang`);
  };

  const openOverrideModal = (masterCity: string) => {
    const k = cityMatchKey(masterCity);
    const ptenKota = overrideDrafts[k] || cityOverrides[k];
    if (!ptenKota || !onApproveCityOverride) return;
    const ptenKodePos = Array.from(
      new Set(ptenList.filter((p) => p.kotaPten === ptenKota).map((p) => String(p.kodePosPten || '').trim()).filter(Boolean))
    );
    setOverrideModal({ masterCity, masterRows: masterRowsForCity(masterCity), ptenKota, ptenKodePos });
  };


  // Success Notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Unique Wilayah list for filter
  const wilayahList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.wilayah) set.add(r.wilayah);
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }, [rows]);

  // Executive KPI Aggregates (baris "TIDAK_ANALISA" dihitung terpisah)
  const stats = useMemo(() => {
    const analysed = rows.filter((r) => r.kategori !== 'TIDAK_ANALISA');
    const total = analysed.length;
    const unanalysed = rows.length - total;
    let exact = 0;
    let highConf = 0;
    let anomalies = 0;
    let placementReview = 0;
    let placementVerified = 0;
    let approved = 0;
    let role3Complete = 0;

    analysed.forEach((r) => {
      if (r.statusAnalisa === 'EXACT_MATCH') exact++;
      else if (r.statusAnalisa === 'HIGH_CONFIDENCE') highConf++;
      else anomalies++;

      if (r.placementStatus === 'VERIFIED') placementVerified++;
      else placementReview++;

      if (r.isFinalApproved) approved++;
      if (r.is3RoleLengkap) role3Complete++;
    });

    const accuracyRate = total > 0 ? (((exact + highConf) / total) * 100).toFixed(1) : '100';
    const isAllApproved = total > 0 && approved === total;

    return {
      total,
      unanalysed,
      exact,
      highConf,
      anomalies,
      placementReview,
      placementVerified,
      approved,
      role3Complete,
      accuracyRate,
      isAllApproved,
    };
  }, [rows]);

  // ── Sequential Phase Flow: Fase 1 → unlock Fase 2 → unlock Fase 3 → Data Final ──
  const phaseState = useMemo(() => {
    const analysed = rows.filter((r) => r.kategori !== 'TIDAK_ANALISA');
    const total = analysed.length;
    const f1 = total > 0 && analysed.every((r) => r.fase1Approved);
    const f2 = total > 0 && analysed.every((r) => r.fase2Approved);
    const f3 = total > 0 && analysed.every((r) => r.fase3Approved);
    const step: 1 | 2 | 3 | 4 = !f1 ? 1 : !f2 ? 2 : !f3 ? 3 : 4;
    return {
      fase1Done: f1,
      fase2Done: f2,
      fase3Done: f3,
      step,
      locked: {
        all: step < 4,
        fase1: false,
        fase2: step < 2,
        fase3: step < 3,
      } as Record<'all' | 'fase1' | 'fase2' | 'fase3', boolean>,
    };
  }, [rows]);

  // Keep the visible tab in sync with the current step when previous tabs get locked
  const viewTab = phaseState.locked[activeSubTab]
    ? (['fase1', 'fase2', 'fase3', 'all'][phaseState.step - 1] as 'all' | 'fase1' | 'fase2' | 'fase3')
    : activeSubTab;

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return rows.filter((r) => {
      // Baris yang belum teranalisa hanya tampil di inner tab "Analisa Manual" (Fase 1)
      if (viewTab !== 'fase1') {
        if (r.kategori === 'TIDAK_ANALISA') return false;
      } else if (r.kategori === 'TIDAK_ANALISA' && fase1Inner !== 'TIDAK_ANALISA') return false;
      else if (r.kategori !== 'TIDAK_ANALISA' && fase1Inner === 'TIDAK_ANALISA') return false;

      // Fase 2: pisahkan outlet tervalidasi otomatis vs yang butuh validasi manual
      if (viewTab === 'fase2') {
        const valid = fase2ValidCities.has(cityMatchKey(r.groupKota));
        if (fase2Inner === 'VALID' ? !valid : valid) return false;
      }

      if (r.kategori !== 'TIDAK_ANALISA' && selectedWilayah !== 'ALL' && r.wilayah !== selectedWilayah) return false;
      if (statusFilter === 'ANOMALI' && r.statusAnalisa !== 'ANOMALI' && r.statusAnalisa !== 'PERLU_REVIEW') return false;
      if (statusFilter === 'EXACT_MATCH' && r.statusAnalisa !== 'EXACT_MATCH') return false;
      if (statusFilter === 'HIGH_CONFIDENCE' && r.statusAnalisa !== 'HIGH_CONFIDENCE') return false;
      if (statusFilter === 'PENEMPATAN_REVIEW' && r.placementStatus === 'VERIFIED') return false;

      if (q) {
        const match =
          String(r.no).includes(q) ||
          r.kotaPten?.toLowerCase().includes(q) ||
          r.groupKota?.toLowerCase().includes(q) ||
          r.provinsi?.toLowerCase().includes(q) ||
          r.kodePosPten?.includes(q) ||
          r.kelurahan?.toLowerCase().includes(q) ||
          r.kecamatan?.toLowerCase().includes(q) ||
          r.wilayah?.toLowerCase().includes(q) ||
          r.sandiCabang?.toLowerCase().includes(q) ||
          r.branchCode?.toLowerCase().includes(q) ||
          r.namaOutlet?.toLowerCase().includes(q) ||
          r.organisasiTujuan?.toLowerCase().includes(q) ||
          r.alamat?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [rows, selectedWilayah, statusFilter, deferredSearch, viewTab, fase1Inner, fase2Inner, fase2ValidCities]);

  // Pagination calculation
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    if (pageSize === 'ALL') return filteredRows;
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Windowing: "Semua" pada puluhan ribu baris hanya boleh memasukkan baris
  // yang terlihat ke DOM, sisanya diwakili dua <tr> spacer.
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const win = useVirtualWindow({ containerRef: tableScrollRef, itemCount: paginatedRows.length });
  const renderedRows = win.active ? paginatedRows.slice(win.start, win.end) : paginatedRows;
  const rowOffset = win.active ? win.start : 0;

  useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0 });
  }, [page, pageSize, selectedWilayah, statusFilter, viewTab, fase1Inner, fase2Inner, deferredSearch]);

  // Export Multi-Sheet per Wilayah (W01 - W17)
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Group rows by Wilayah (hanya hasil analisa; baris "TIDAK_ANALISA" bukan keluaran engine)
      const wilayahMap = new Map<string, AnalystRow[]>();
      rows.filter((r) => r.kategori !== 'TIDAK_ANALISA').forEach((r) => {
        const wKey = formatWilayahCode(r.wilayah || 'W01');
        if (!wilayahMap.has(wKey)) wilayahMap.set(wKey, []);
        wilayahMap.get(wKey)!.push(r);
      });

      // Sort sheet keys W01, W02, ...
      const sortedKeys = Array.from(wilayahMap.keys()).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      sortedKeys.forEach((wKey) => {
        const groupRows = wilayahMap.get(wKey)!;
        const exportData = groupRows.map((r, idx) => ({
          'No': idx + 1,
          'Wilayah': r.wilayah,
          'Sandi Cabang': r.sandiCabang,
          'Branch Code': r.branchCode,
          'Kode Cabang': r.kodeCabang,
          'Nama Outlet': r.namaOutlet,
          'Status Outlet': r.statusOutlet,
          'ALAMAT': r.alamat,
          'KODE POS': r.kodePosPten,
          'Kelurahan': r.kelurahan,
          'Kecamatan': r.kecamatan,
          'Dati II': r.kotaPten,
          'Provinsi': r.provinsi,
          'KOTA PTEN': r.kotaPten,
          'KODE POS PTEN': r.kodePosPten,
          'CEK KODE POS + PTEN': r.statusPten,
          'VERIFIKASI PENEMPATAN': r.placementStatus === 'VERIFIED' ? 'TERVERIFIKASI' : r.placementStatus === 'REVIEW' ? 'PERLU REVIEW' : 'FALLBACK',
          'METODE PENEMPATAN': r.placementMethod,
          'ORGANISASI TUJUAN': r.organisasiTujuan,
          'Tipe Unit': r.tipeUnit,
          'Alur Wondr': r.alurWondr,
          'QRS_CABSAL': r.roleCabsal,
          'QRS_CABAPV1': r.roleCabapv1,
          'QRS_CABAPV2': r.roleCabapv2,
          'Grand Total': r.roleGrandTotal,
          'Status Analisa': r.isFinalApproved ? 'VERIFIED' : r.statusAnalisa,
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, wKey);
      });

      // Sheet Summary All
      const allExport = rows.filter((r) => r.kategori !== 'TIDAK_ANALISA').map((r, idx) => ({
        'No': idx + 1,
        'Wilayah': r.wilayah,
        'Sandi Cabang': r.sandiCabang,
        'Branch Code': r.branchCode,
        'Kode Cabang': r.kodeCabang,
        'Nama Outlet': r.namaOutlet,
        'Status Outlet': r.statusOutlet,
        'ALAMAT': r.alamat,
        'KODE POS': r.kodePosPten,
        'Kelurahan': r.kelurahan,
        'Kecamatan': r.kecamatan,
        'Dati II': r.kotaPten,
        'Provinsi': r.provinsi,
        'ORGANISASI TUJUAN': r.organisasiTujuan,
        'Tipe Unit': r.tipeUnit,
        'Alur Wondr': r.alurWondr,
      }));
      const wsAll = XLSX.utils.json_to_sheet(allExport);
      XLSX.utils.book_append_sheet(wb, wsAll, 'SEMUA_DATA');

      XLSX.writeFile(wb, `Laporan_Final_Data_Analyst_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`Berhasil mengunduh ${rows.length.toLocaleString('id-ID')} baris data ke Excel Multi-Sheet!`);
    } catch (e: any) {
      alert('Gagal mengekspor berkas Excel: ' + e.message);
    }
  };

  const handleExportPdf = () => {
    const result = exportAnalystExecutivePdf({ rows, stats: { total: stats.total, exact: stats.exact, highConf: stats.highConf, anomalies: stats.anomalies, approved: stats.approved, role3Complete: stats.role3Complete, accuracyRate: stats.accuracyRate }, wilayahCount: wilayahList.length });
    if (result.success) {
      showToast(`Berhasil mengunduh laporan PDF: ${result.filename}`);
    } else {
      alert('Gagal membuat dokumen PDF: ' + result.error);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. EXECUTIVE METRIC CARDS                                                 */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {/* Total Data */}
        <div className="metric-card blue">
          <div className="metric-header">
            <span className="metric-title">Total Data Dianalisa</span>
            <div className="metric-icon-bubble">
              <Building2 size={15} />
            </div>
          </div>
          <div className="metric-value">{stats.total.toLocaleString('id-ID')}</div>
          <div className="metric-footer">
            {coverage
              ? `KodePos masuk ${coverage.kodePosMapped.toLocaleString('id-ID')}/${coverage.kodePosTotal.toLocaleString('id-ID')} · ${wilayahList.length} Wilayah`
              : `${wilayahList.length} Wilayah / Kanwil Terpetakan`}
          </div>
        </div>

        {/* Data Tidak Dianalisa */}
        <div
          className="metric-card emerald"
          onClick={() => {
            setActiveSubTab('fase1');
            setFase1Inner('TIDAK_ANALISA');
            setPage(1);
          }}
          title="Lihat baris KodePos yang kotanya tidak ada di data PTEN (perlu analisa manual)"
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-header">
            <span className="metric-title">Data Tidak Dianalisa</span>
            <div className="metric-icon-bubble">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="metric-value">{stats.unanalysed.toLocaleString('id-ID')}</div>
          <div className="metric-footer">
            {coverage
              ? `${coverage.unmappedCities.length.toLocaleString('id-ID')} kota belum terpetakan — klik untuk analisa manual`
              : 'Klik untuk analisa manual'}
          </div>
        </div>

        {/* Fase 1: PTEN & Kode Pos */}
        <div className="metric-card cyan">
          <div className="metric-header">
            <span className="metric-title">Fase 1: PTEN & Pos</span>
            <div className="metric-icon-bubble">
              <MapPin size={15} />
            </div>
          </div>
          <div className="metric-value">100%</div>
          <div className="metric-footer">Kelurahan & Kecamatan Lengkap</div>
        </div>

        {/* Fase 3: 3 Role Lengkap */}
        <div className={`metric-card ${stats.anomalies > 0 ? 'amber' : 'emerald'}`}>
          <div className="metric-header">
            <span className="metric-title">Fase 3: 3 Role Wondr</span>
            <div className="metric-icon-bubble">
              <Users size={15} />
            </div>
          </div>
          <div className="metric-value">{stats.role3Complete.toLocaleString('id-ID')}</div>
          <div className="metric-footer">
            {stats.anomalies > 0 ? `${stats.anomalies} entri perlu review` : 'Seluruh unit terpetakan rapi'}
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1b. LAPORAN CAKUPAN KODEPOS → FASE 1 (kenapa jumlah bisa ≠ master)        */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {coverage && (coverage.unmappedCities.length > 0 || Object.keys(cityOverrides).length > 0) && (
        <details
          style={{ background: '#fff8ec', border: '1px solid #f2d9a8', borderRadius: '6px', padding: '0.75rem 1rem' }}
          open
        >
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#8a5a00', fontSize: '0.86rem' }}>
            Cakupan KodePos → Fase 1: {coverage.resultRows.toLocaleString('id-ID')} dari{' '}
            {coverage.kodePosTotal.toLocaleString('id-ID')} baris masuk ({coverage.unmappedCities.length} kota,{' '}
            {(coverage.kodePosTotal - coverage.kodePosMapped).toLocaleString('id-ID')} baris tidak masuk)
          </summary>
          <p style={{ fontSize: '0.78rem', color: '#6b5836', margin: '0.5rem 0' }}>
            Baris kodepos hanya masuk bila kotanya ada di data PTEN. Pilih kota PTEN yang cocok lalu klik Setujui —
            seluruh baris kota itu ikut dianalisa ulang.
          </p>
          <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #f0e2c2', borderRadius: '4px' }}>
            <table className="modern-table" style={{ width: '100%', fontSize: '0.75rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#fdf3e0' }}>
                <tr>
                  <th style={{ textAlign: 'left' }}>Kota / Kabupaten (di master KodePos)</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Kode Pos</th>
                  <th style={{ textAlign: 'left', width: '160px' }}>Provinsi</th>
                  <th style={{ textAlign: 'right', width: '70px' }}>Baris</th>
                  <th style={{ textAlign: 'left', minWidth: '320px' }}>Kota / Kabupaten (di PTEN)</th>
                </tr>
              </thead>
              <tbody>
                {coverage.unmappedCities.map((c) => {
                  const ck = cityMatchKey(c.city);
                  const draft = overrideDrafts[ck] || '';
                  return (
                    <tr key={c.city}>
                      <td style={{ fontWeight: 600 }}>{c.city}</td>
                      <td style={{ textAlign: 'center' }}>{c.sampleKodePos}</td>
                      <td>{c.provinsi}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.rows.toLocaleString('id-ID')}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <PtenCityPicker
                            options={ptenKotaOptions}
                            value={draft}
                            disabled={isProcessing || !onApproveCityOverride}
                            onChange={(kota) => setOverrideDrafts((prev) => ({ ...prev, [ck]: kota }))}
                          />
                          <button
                            type="button"
                            onClick={() => openOverrideModal(c.city)}
                            disabled={isProcessing || !draft || !onApproveCityOverride}
                            style={{
                              flexShrink: 0,
                              padding: '0.32rem 0.7rem',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              border: 'none',
                              borderRadius: '4px',
                              background: draft ? '#0ab39c' : '#d5dce8',
                              color: '#fff',
                              cursor: draft && !isProcessing ? 'pointer' : 'not-allowed',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Setujui
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {Object.entries(cityOverrides).map(([key, ptenKota]) => {
                  const ringkas = cityRowSummary.get(key);
                  const masterName = ringkas?.name || key;
                  const draft = overrideDrafts[key] || ptenKota;
                  return (
                    <tr key={`ov-${key}`} style={{ background: '#f0faf7' }}>
                      <td style={{ fontWeight: 600 }}>
                        {masterName}
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.66rem', fontWeight: 700, color: '#0ab39c' }}>TERSIPAH</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{ringkas?.kodePos || ''}</td>
                      <td>{ringkas?.provinsi || ''}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{(ringkas?.count || 0).toLocaleString('id-ID')}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <PtenCityPicker
                            options={ptenKotaOptions}
                            value={draft}
                            disabled={isProcessing || !onApproveCityOverride}
                            onChange={(kota) => setOverrideDrafts((prev) => ({ ...prev, [key]: kota }))}
                          />
                          <button
                            type="button"
                            onClick={() => openOverrideModal(masterName)}
                            disabled={isProcessing || !draft || !onApproveCityOverride}
                            style={{
                              flexShrink: 0,
                              padding: '0.32rem 0.7rem',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              border: 'none',
                              borderRadius: '4px',
                              background: draft && draft !== ptenKota ? '#0ab39c' : '#405189',
                              color: '#fff',
                              cursor: draft && !isProcessing ? 'pointer' : 'not-allowed',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Revisi
                          </button>
                          {onRemoveCityOverride && (
                            <button
                              type="button"
                              onClick={() => !isProcessing && onRemoveCityOverride(key)}
                              disabled={isProcessing}
                              title="Batalkan pemetaan — kota kembali ke belum terpetakan"
                              style={{
                                flexShrink: 0,
                                padding: '0.32rem 0.55rem',
                                fontSize: '0.73rem',
                                border: '1px solid #d5dce8',
                                borderRadius: '4px',
                                background: '#fff',
                                color: '#878a99',
                                cursor: isProcessing ? 'wait' : 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Batalkan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {notification && (
        <div
          style={{
            background: notification.type === 'success' ? '#e8f7f5' : '#eff2f7',
            color: notification.type === 'success' ? '#0ab39c' : '#405189',
            border: `1px solid ${notification.type === 'success' ? '#b7ebe4' : '#dce4f5'}`,
            padding: '0.75rem 1.25rem',
            borderRadius: '6px',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} />
            <span>{notification.message}</span>
          </div>
          <button type="button" onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. SMART ACTION CONTROLS & DECISION TOOLBAR                              */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          background: '#ffffff',
          border: '1px solid #e9ebec',
          borderRadius: '8px',
          padding: '0.9rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Left: Re-run & Approval Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onReRunAll}
            disabled={isProcessing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
            title="Jalankan ulang seluruh analisa 3 fase dari data master"
          >
            <RotateCcw size={13} />
            <span>Ulangi Analisa Total</span>
          </button>

          {stats.anomalies > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onReRunAnomaliesOnly}
              disabled={isProcessing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                fontSize: '0.78rem',
                color: '#f7b84b',
                borderColor: 'rgba(247, 184, 75, 0.4)',
                background: 'rgba(247, 184, 75, 0.06)',
              }}
              title="Hanya analisa ulang baris data yang belum cocok / anomali"
            >
              <Zap size={13} />
              <span>Ulangi yang Salah Saja ({stats.anomalies})</span>
            </button>
          )}

          <div style={{ display: 'inline-flex', gap: '0.25rem', borderLeft: '1px solid #e9ebec', paddingLeft: '0.55rem' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { onApproveFase(1); setActiveSubTab('fase2'); showToast('Fase 1 disetujui — Fase 2 (Wilayah & Cabang) kini terbuka untuk direview!'); }}
              disabled={isProcessing || phaseState.fase1Done}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.65rem', fontSize: '0.74rem', color: phaseState.fase1Done ? '#0ab39c' : '#299cdb', borderColor: phaseState.fase1Done ? 'rgba(10, 179, 156, 0.35)' : 'rgba(41, 156, 219, 0.3)' }}
              title={phaseState.fase1Done ? 'Fase 1 sudah disetujui' : 'Setujui seluruh hasil analisa Fase 1 dan buka Fase 2'}
            >
              {phaseState.fase1Done ? <Check size={12} /> : <MapPin size={12} />}
              <span>{phaseState.fase1Done ? 'Fase 1 Disetujui' : 'Setujui Fase 1'}</span>
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { onApproveFase(2); setActiveSubTab('fase3'); showToast('Fase 2 disetujui — Fase 3 (Mapping Role & Wondr) kini terbuka untuk direview!'); }}
              disabled={isProcessing || !phaseState.fase1Done || phaseState.fase2Done}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.65rem', fontSize: '0.74rem', color: phaseState.fase2Done ? '#0ab39c' : !phaseState.fase1Done ? '#a2a7b0' : '#405189', borderColor: phaseState.fase2Done ? 'rgba(10, 179, 156, 0.35)' : 'rgba(64, 81, 137, 0.3)' }}
              title={phaseState.fase2Done ? 'Fase 2 sudah disetujui' : !phaseState.fase1Done ? 'Terkunci — setujui Fase 1 terlebih dahulu' : 'Setujui seluruh hasil analisa Fase 2 dan buka Fase 3'}
            >
              {phaseState.fase2Done ? <Check size={12} /> : !phaseState.fase1Done ? <Lock size={12} /> : <Building2 size={12} />}
              <span>{phaseState.fase2Done ? 'Fase 2 Disetujui' : 'Setujui Fase 2'}</span>
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { onApproveFase(3); setActiveSubTab('all'); showToast('Fase 3 disetujui — Data Final kini terbuka!'); }}
              disabled={isProcessing || !phaseState.fase2Done || phaseState.fase3Done}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.65rem', fontSize: '0.74rem', color: phaseState.fase3Done ? '#0ab39c' : !phaseState.fase2Done ? '#a2a7b0' : '#0ab39c', borderColor: 'rgba(10, 179, 156, 0.3)' }}
              title={phaseState.fase3Done ? 'Fase 3 sudah disetujui' : !phaseState.fase2Done ? 'Terkunci — setujui Fase 2 terlebih dahulu' : 'Setujui seluruh hasil analisa Fase 3 dan buka Data Final'}
            >
              {phaseState.fase3Done ? <Check size={12} /> : !phaseState.fase2Done ? <Lock size={12} /> : <Users size={12} />}
              <span>{phaseState.fase3Done ? 'Fase 3 Disetujui' : 'Setujui Fase 3'}</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={onApproveAllFinal}
            disabled={isProcessing || !phaseState.fase3Done || stats.isAllApproved}
            title={!phaseState.fase3Done ? 'Terkunci — setujui Fase 3 terlebih dahulu' : 'Setujui seluruh baris sebagai Final Analisa'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1.1rem',
              fontWeight: 700,
              fontSize: '0.8rem',
              background: stats.isAllApproved ? '#34c38f' : !phaseState.fase3Done ? '#e9ebec' : '#0ab39c',
              borderColor: '#0ab39c',
            }}
          >
            {stats.isAllApproved ? (
              <>
                <Lock size={14} />
                <span>Analisa Final Telah Disetujui</span>
              </>
            ) : (
              <>
                {!phaseState.fase3Done ? <Lock size={14} /> : <Check size={14} />}
                <span>Saya Setuju (Masuk ke Final Analisa)</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Export Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportPdf}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.95rem', fontSize: '0.8rem', color: '#405189', borderColor: '#405189' }}
          >
            <FileText size={15} />
            <span>Ekspor PDF Executive</span>
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportExcel}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.95rem', fontSize: '0.8rem', color: '#0ab39c', borderColor: '#0ab39c' }}
          >
            <FileSpreadsheet size={15} />
            <span>Ekspor Excel Multi-Sheet</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. SUB-TAB BAR & FILTERS                                                  */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
        {/* Sequential Review Step Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 0.9rem',
            marginBottom: '0.75rem',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            background: phaseState.step === 4 ? '#e8f7f5' : '#eff2f7',
            color: phaseState.step === 4 ? '#0ab39c' : '#405189',
            border: `1px solid ${phaseState.step === 4 ? '#b7ebe4' : '#dce4f5'}`,
          }}
        >
          {phaseState.step === 4 ? <CheckCircle2 size={15} /> : <Lock size={14} />}
          <span>
            {phaseState.step === 1 && 'Langkah 1 dari 4 — Sedang mereview Fase 1 (PTEN & Kode Pos). Klik "Setujui Fase 1" untuk membuka Fase 2.'}
            {phaseState.step === 2 && 'Langkah 2 dari 4 — Sedang mereview Fase 2 (Wilayah & Cabang). Klik "Setujui Fase 2" untuk membuka Fase 3.'}
            {phaseState.step === 3 && 'Langkah 3 dari 4 — Sedang mereview Fase 3 (Mapping Role & Wondr). Klik "Setujui Fase 3" untuk membuka Data Final.'}
            {phaseState.step === 4 && 'Seluruh fase telah disetujui — Data Final terbuka untuk review akhir, persetujuan final, dan ekspor.'}
          </span>
        </div>

        {/* Navigation Sub-Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #e9ebec', paddingBottom: '0.65rem' }}>
          <div className="nav-tabs">
            {([
              { key: 'fase1', label: '📍 1. Review Fase 1 (PTEN & Kode Pos)', done: phaseState.fase1Done },
              { key: 'fase2', label: '🏢 2. Review Fase 2 (Kanwil & Master Cabang)', done: phaseState.fase2Done },
              { key: 'fase3', label: '👥 3. Review Fase 3 (Mapping Role & Wondr)', done: phaseState.fase3Done },
              { key: 'all', label: '📑 4. Data Final (Semua Atribut)', done: stats.isAllApproved },
            ] as const).map((tab) => {
              const locked = phaseState.locked[tab.key];
              const active = viewTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`nav-tab-btn ${active ? 'active' : ''}`}
                  onClick={() => !locked && setActiveSubTab(tab.key)}
                  disabled={locked}
                  title={locked ? 'Terkunci — setujui fase sebelumnya terlebih dahulu' : tab.label}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: locked ? 0.55 : 1, cursor: locked ? 'not-allowed' : 'pointer' }}
                >
                  {tab.done && <Check size={13} color="#0ab39c" />}
                  {locked && <Lock size={12} />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
            Menampilkan <strong style={{ color: '#212529' }}>{filteredRows.length.toLocaleString('id-ID')}</strong> dari{' '}
            {rows.length.toLocaleString('id-ID')} baris
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="filter-toolbar" style={{ marginBottom: '1rem' }}>
          <div className="filter-group" style={{ flex: 1, minWidth: '280px' }}>
            {/* Search Input */}
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '0.65rem', color: '#878a99' }} />
              <input
                type="text"
                className="search-input"
                style={{ width: '100%', paddingLeft: '2rem' }}
                placeholder="Cari cabang, kota PTEN, kelurahan, kecamatan, sandi, role..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#878a99' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Wilayah */}
            <select
              className="filter-select"
              value={selectedWilayah}
              onChange={(e) => {
                setSelectedWilayah(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Semua Wilayah ({wilayahList.length})</option>
              {wilayahList.map((w) => (
                <option key={w} value={w}>
                  {formatWilayahName(w)}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
            >
              <option value="ALL">Semua Status</option>
              <option value="EXACT_MATCH">Exact Cocok Sempurna ({stats.exact})</option>
              <option value="HIGH_CONFIDENCE">High Confidence ({stats.highConf})</option>
              {stats.anomalies > 0 && <option value="ANOMALI">Perlu Review / Anomali ({stats.anomalies})</option>}
              {stats.placementReview > 0 && <option value="PENEMPATAN_REVIEW">Penempatan Belum Terverifikasi ({stats.placementReview})</option>}
            </select>
          </div>

          <div className="filter-group">
            <span style={{ fontSize: '0.78rem', color: '#878a99' }}>Tampilkan:</span>
            <select
              className="filter-select"
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setPageSize(val);
                setPage(1);
              }}
            >
              <option value={15}>15 Baris</option>
              <option value={30}>30 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
              <option value="ALL">Semua ({filteredRows.length})</option>
            </select>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* 4. DATA TABLES PER SUB-TAB                                                */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* Inner tab khusus Fase 1: hasil analisa vs data yang tidak bisa dianalisa */}
        {viewTab === 'fase1' && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {([
              { key: 'DIANALISA', label: `✅ Berhasil Dianalisa (${stats.total.toLocaleString('id-ID')})`, color: '#0ab39c' },
              { key: 'TIDAK_ANALISA', label: `⚠️ Perlu Analisa Manual (${stats.unanalysed.toLocaleString('id-ID')})`, color: '#f0ad4e' },
            ] as const).map((t) => {
              const active = fase1Inner === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setFase1Inner(t.key);
                    setPage(1);
                  }}
                  style={{
                    background: active ? t.color : '#ffffff',
                    color: active ? '#ffffff' : '#495057',
                    border: `1px solid ${active ? t.color : '#d5dde3'}`,
                    borderRadius: '6px',
                    padding: '0.4rem 0.9rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
            {fase1Inner === 'TIDAK_ANALISA' && (
              <span style={{ alignSelf: 'center', fontSize: '0.76rem', color: '#878a99' }}>
                Baris KodePos ini kotanya tidak ada di data PTEN — isi Kota PTEN &amp; Kode Pos manual lewat tombol Revisi.
              </span>
            )}
          </div>
        )}

        {/* Inner tab khusus Fase 2: outlet tervalidasi jarak vs validasi manual */}
        {viewTab === 'fase2' && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {([
              { key: 'VALID', label: `✅ Sudah Tervalidasi (${fase2ValidCount.toLocaleString('id-ID')})`, color: '#0ab39c' },
              { key: 'MANUAL', label: `✋ Validasi Manual (${fase2ManualCount.toLocaleString('id-ID')})`, color: '#f0ad4e' },
            ] as const).map((t) => {
              const active = fase2Inner === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setFase2Inner(t.key);
                    setPage(1);
                  }}
                  style={{
                    background: active ? t.color : '#ffffff',
                    color: active ? '#ffffff' : '#495057',
                    border: `1px solid ${active ? t.color : '#d5dde3'}`,
                    borderRadius: '6px',
                    padding: '0.4rem 0.9rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
            {fase2Inner === 'MANUAL' && (
              <span style={{ alignSelf: 'center', fontSize: '0.76rem', color: '#878a99' }}>
                Cabang terisi tidak masuk 3 outlet terdekat — pilih kandidat di kolom Rekomendasi lalu "Gunakan Cabang Ini", atau Revisi manual.
              </span>
            )}
          </div>
        )}

        <div ref={tableScrollRef} className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', maxHeight: '600px', overflow: 'auto' }}>
          <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
              {/* TAB 1: ALL COLUMNS */}
              {viewTab === 'all' && (
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Wilayah</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Sandi</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Branch Code</th>
                  <th style={{ minWidth: '160px' }}>Nama Outlet</th>
                  <th style={{ width: '110px' }}>Kota PTEN</th>
                  <th style={{ width: '75px', textAlign: 'center' }}>Kode Pos</th>
                  <th>Kelurahan / Kec.</th>
                  <th style={{ minWidth: '180px' }}>ORGANISASI TUJUAN</th>
                  <th style={{ width: '75px', textAlign: 'center' }}>Tipe Unit</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>3 Role</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Aksi Review</th>
                </tr>
              )}

              {/* TAB 2: FASE 1 PTEN & KODE POS (grup header: Data Pos vs Data PTEN) */}
              {viewTab === 'fase1' && (
                <>
                  <tr>
                    <th rowSpan={2} style={{ width: '40px', textAlign: 'center', verticalAlign: 'middle' }}>No</th>
                    <th colSpan={3} style={{ textAlign: 'center', background: '#eff6fb', color: '#299cdb', borderLeft: '2px solid #d5e7f2' }}>
                      📮 DATA POS (Kelurahan &amp; Wilayah Administrasi)
                    </th>
                    <th colSpan={3} style={{ textAlign: 'center', background: '#eefaf6', color: '#0ab39c', borderLeft: '2px solid #b7ebe4' }}>
                      {fase1Inner === 'TIDAK_ANALISA'
                        ? '🛡️ DATA PTEN (belum terpetakan — isi manual lewat Revisi)'
                        : '🛡️ DATA PTEN (Kota / Provinsi / Kode Pos)'}
                    </th>
                    <th rowSpan={2} style={{ width: '165px', textAlign: 'center', verticalAlign: 'middle' }}>Aksi Review</th>
                  </tr>
                  <tr>
                    <th style={{ minWidth: '140px', borderLeft: '2px solid #d5e7f2' }}>Kelurahan</th>
                    <th style={{ minWidth: '140px' }}>Kecamatan</th>
                    <th style={{ minWidth: '130px' }}>Provinsi</th>
                    <th style={{ minWidth: '150px', borderLeft: '2px solid #b7ebe4' }}>Kota / Kabupaten</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Kode Pos</th>
                    <th style={{ minWidth: '170px', textAlign: 'center' }}>Status PTEN</th>
                  </tr>
                </>
              )}

              {/* TAB 3: FASE 2 WILAYAH & CABANG */}
              {viewTab === 'fase2' && (
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Kanwil</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Sandi Cabang</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Branch Code</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Kode Cabang</th>
                  <th style={{ minWidth: '180px' }}>Nama Outlet Master</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                  <th style={{ minWidth: '220px' }}>ALAMAT Cabang</th>
                  <th style={{ minWidth: '240px', textAlign: 'center' }}>📍 Rekomendasi 3 Outlet Terdekat</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Aksi Review</th>
                </tr>
              )}

              {/* TAB 4: FASE 3 MAPPING ROLE & WONDR */}
              {viewTab === 'fase3' && (
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ minWidth: '180px' }}>Nama Outlet</th>
                  <th style={{ minWidth: '220px' }}>ORGANISASI TUJUAN</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Tipe Unit</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Sales</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Verifikator</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Penyetuju</th>
                  <th style={{ minWidth: '160px' }}>Rekomendasi Alur Wondr</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Pegawai</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Aksi Review</th>
                </tr>
              )}
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                    Tidak ada baris analisa yang cocok dengan filter pencarian "{searchTerm}".
                  </td>
                </tr>
              ) : (
                <>
                  {win.active && win.padTop > 0 && <tr aria-hidden="true" style={{ height: `${win.padTop}px` }} />}
                  {renderedRows.map((r, i) => {
                    const idx = rowOffset + i;
                    const displayIdx = pageSize === 'ALL' ? idx + 1 : (page - 1) * (pageSize as number) + idx + 1;

                    return (
                    <tr
                      key={r.id || idx}
                      data-vrow={i === 0 ? 'true' : undefined}
                      style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}
                    >
                      {/* TAB 1: ALL COLUMNS */}
                      {viewTab === 'all' && (
                        <>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{displayIdx}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-level1">{r.wilayah}</span>
                          </td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.sandiCabang}</td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.branchCode || '-'}</td>
                          <td style={{ fontWeight: 600, color: '#405189' }}>{r.namaOutlet}</td>
                          <td>{r.kotaPten}</td>
                          <td className="code-cell" style={{ textAlign: 'center', color: '#0ab39c', fontWeight: 700 }}>
                            {r.kodePosPten}
                          </td>
                          <td>
                            <div>{r.kelurahan}</div>
                            <div style={{ fontSize: '0.7rem', color: '#878a99' }}>{r.kecamatan}</div>
                          </td>
                          <td style={{ fontWeight: 600, color: '#212529' }}>{r.organisasiTujuan}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${r.tipeUnit === 'KC' ? 'badge-match' : 'badge-level2'}`}>
                              {r.tipeUnit}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${r.is3RoleLengkap ? 'badge-match' : 'badge-level2'}`}>
                              {r.is3RoleLengkap ? '3 Role OK' : 'Parsial'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${r.isFinalApproved ? 'badge-match' : 'badge-level1'}`}>
                              {r.isFinalApproved ? '✓ Disetujui' : r.statusAnalisa}
                            </span>
                          </td>
                        </>
                      )}

                      {/* TAB 2: FASE 1 PTEN & KODE POS — Data Pos | Data PTEN */}
                      {viewTab === 'fase1' && (
                        <>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{r.kelurahanSeq ?? displayIdx}</td>
                          <td style={{ fontWeight: 700, color: '#212529', borderLeft: '2px solid #d5e7f2' }}>{r.kelurahan}</td>
                          <td>{r.kecamatan}</td>
                          <td>{r.provinsi}</td>
                          <td style={{ fontWeight: 700, color: r.kotaPten ? '#212529' : '#f0ad4e', borderLeft: '2px solid #b7ebe4' }}>
                            {r.kotaPten || `${r.groupKota} (belum terpetakan ke PTEN)`}
                          </td>
                          <td className="code-cell" style={{ textAlign: 'center', color: '#0ab39c', fontWeight: 700 }}>
                            {r.kodePosPten}
                          </td>
                          {/* Satu kartu label: warna = status, teks kecil di bawahnya = alasannya */}
                          <td style={{ textAlign: 'center' }} title={r.placementMethod || ''}>
                            {(() => {
                              const belumAda = !r.kotaPten && r.statusPten === 'UNCHECKED';
                              const hijau = !belumAda && (r.statusPten === 'SAME' || r.statusPten === 'PTEN FOUND');
                              const cls = belumAda ? 'badge-diff' : hijau ? 'badge-match' : 'badge-level2';
                              return (
                                <>
                                  <span className={`badge ${cls}`}>{belumAda ? 'TIDAK ADA DI PTEN' : r.statusPten}</span>
                                  {r.placementMethod && (
                                    <div style={{ fontSize: '0.62rem', color: '#878a99', marginTop: '2px', whiteSpace: 'normal' }}>
                                      {r.placementMethod}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                        </>
                      )}

                      {/* TAB 3: FASE 2 WILAYAH & CABANG */}
                      {viewTab === 'fase2' && (
                        <>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{displayIdx}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-level1">{r.wilayah}</span>
                          </td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.sandiCabang}</td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.branchCode || '-'}</td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.kodeCabang || '-'}</td>
                          <td style={{ fontWeight: 700, color: '#405189' }}>{r.namaOutlet}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-match">{r.statusOutlet}</span>
                          </td>
                          <td title={r.alamat}>{r.alamat}</td>
                          {(() => {
                            const entry = fase2Recs.get(cityMatchKey(r.groupKota));
                            const cands = entry?.rec?.candidates || [];
                            if (!cands.length || !entry) return <td style={{ textAlign: 'center', color: '#adb5bd' }}>—</td>;
                            const chosenRank = fase2Choice[r.id] || entry.rec!.userPrefilledAudit?.matchedRank || 1;
                            return (
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem' }}>
                                  {cands.map((c) => {
                                    const active = chosenRank === c.rank;
                                    const color = c.rank === 1 ? '#0ab39c' : c.rank === 2 ? '#d97706' : '#3577f1';
                                    return (
                                      <button
                                        key={c.rank}
                                        type="button"
                                        title={`${c.reason || ''}${c.distanceBasis ? ` · dasar jarak: ${c.distanceBasis}` : ''}`}
                                        onClick={() => setFase2Choice((p) => ({ ...p, [r.id]: c.rank }))}
                                        style={{
                                          display: 'flex',
                                          gap: '0.35rem',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '0.15rem 0.4rem',
                                          fontSize: '0.68rem',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          border: active ? `1px solid ${color}` : '1px dashed #d5dce8',
                                          background: active ? `${color}18` : '#fff',
                                          color: active ? color : '#495057',
                                          fontWeight: active ? 700 : 500,
                                          textAlign: 'left',
                                        }}
                                      >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                                          #{c.rank} {c.master['Nama Outlet'] || c.master.Cabang || c.master['Sandi Cabang']}
                                        </span>
                                        <span style={{ whiteSpace: 'nowrap' }}>
                                          {c.score}% · {c.formattedDistance || '-'}
                                        </span>
                                      </button>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFase2Detail({
                                        row: r,
                                        target: entry.target,
                                        rec: entry.rec!,
                                        chosen: cands.find((c) => c.rank === chosenRank) || cands[0],
                                      })
                                    }
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '0.25rem',
                                      padding: '0.15rem 0.4rem',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      border: '1px solid rgba(64, 81, 137, 0.3)',
                                      borderRadius: '4px',
                                      background: 'rgba(64, 81, 137, 0.08)',
                                      color: '#405189',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Info size={11} /> Detail &amp; Rute Maps
                                  </button>
                                </div>
                              </td>
                            );
                          })()}
                        </>
                      )}

                      {/* TAB 4: FASE 3 MAPPING ROLE & WONDR */}
                      {viewTab === 'fase3' && (
                        <>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{displayIdx}</td>
                          <td style={{ fontWeight: 600, color: '#405189' }}>{r.namaOutlet}</td>
                          <td style={{ fontWeight: 700, color: '#212529' }}>{r.organisasiTujuan}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${r.tipeUnit === 'KC' ? 'badge-match' : 'badge-level2'}`}>
                              {r.tipeUnit}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: r.roleCabsal === 1 ? '#0ab39c' : '#f06548' }}>
                            {r.roleCabsal === 1 ? '✓' : '-'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: r.roleCabapv1 === 1 ? '#0ab39c' : '#f06548' }}>
                            {r.roleCabapv1 === 1 ? '✓' : '-'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: r.roleCabapv2 === 1 ? '#0ab39c' : '#f06548' }}>
                            {r.roleCabapv2 === 1 ? '✓' : '-'}
                          </td>
                          <td>
                            <span className="badge badge-match" style={{ fontSize: '0.72rem' }}>{r.alurWondr}</span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.roleGrandTotal} Org</td>
                        </>
                      )}

                      {/* ACTION REVIEW BUTTONS (Appears on ALL tabs) */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'nowrap', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                          {(() => {
                            const rowPhaseApproved =
                              viewTab === 'fase1' ? r.fase1Approved :
                              viewTab === 'fase2' ? r.fase2Approved :
                              viewTab === 'fase3' ? r.fase3Approved :
                              r.isFinalApproved;
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  if (viewTab === 'fase1') { onUpdateRow({ ...r, fase1Approved: true }); showToast(`Fase 1 baris #${r.no} disetujui!`); }
                                  else if (viewTab === 'fase2') { onUpdateRow({ ...r, fase2Approved: true }); showToast(`Fase 2 baris #${r.no} disetujui!`); }
                                  else if (viewTab === 'fase3') { onUpdateRow({ ...r, fase3Approved: true }); showToast(`Fase 3 baris #${r.no} disetujui!`); }
                                  else { onApproveSingleRow(r.id); showToast(`Baris #${r.no} (${r.namaOutlet}) disetujui!`); }
                                }}
                                title={rowPhaseApproved ? 'Sudah disetujui' : 'Setujui Hasil Baris Ini (OK)'}
                                style={{
                                  background: rowPhaseApproved ? '#0ab39c' : 'rgba(10, 179, 156, 0.1)',
                                  border: '1px solid rgba(10, 179, 156, 0.3)',
                                  color: rowPhaseApproved ? '#ffffff' : '#0ab39c',
                                  borderRadius: '4px',
                                  padding: viewTab === 'fase1' ? '0.22rem 0.55rem' : '0.22rem 0.4rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Check size={12} />
                                {viewTab === 'fase1' && <span>Setujui</span>}
                              </button>
                            );
                          })()}
                          {(viewTab === 'fase1' || viewTab === 'fase2') && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRow(r);
                                setIsEditModalOpen(true);
                              }}
                              title="Edit / Revisi Manual Baris Ini"
                              style={{
                                background: 'rgba(64, 81, 137, 0.1)',
                                border: '1px solid rgba(64, 81, 137, 0.3)',
                                color: '#405189',
                                borderRadius: '4px',
                                padding: '0.22rem 0.55rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Edit size={12} />
                              <span>Revisi</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {win.active && win.padBottom > 0 && <tr aria-hidden="true" style={{ height: `${win.padBottom}px` }} />}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Master Pagination Footer */}
        {pageSize !== 'ALL' && totalPages > 1 && (
          <div
            className="pagination-row"
            style={{
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginTop: '1rem',
              borderTop: '1px solid #e9ebec',
              paddingTop: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
              Halaman <strong style={{ color: '#212529' }}>{page}</strong> dari{' '}
              <strong style={{ color: '#212529' }}>{totalPages}</strong>
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
                title="Halaman Pertama"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronsLeft size={13} />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                title="Halaman Sebelumnya"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronLeft size={13} />
              </button>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0 0.5rem', color: '#405189' }}>
                {page}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                title="Halaman Selanjutnya"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                title="Halaman Terakhir"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <AnalystRowEditModal
        isOpen={isEditModalOpen}
        row={editingRow}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRow(null);
        }}
        onSave={(updated) => {
          onUpdateRow(updated);
          showToast(`Berhasil menyimpan koreksi pada baris #${updated.no} (${updated.namaOutlet})!`);
        }}
        wilayahSettings={wilayahSettings}
        phase={viewTab === 'all' ? 'final' : viewTab}
      />

      {/* Modal detail kandidat outlet Fase 2 (engine rekomendasi lama) */}
      <CandidateDetailModal
        isOpen={fase2Detail !== null}
        onClose={() => setFase2Detail(null)}
        wilayahSettings={wilayahSettings}
        data={
          fase2Detail
            ? {
                targetRow: fase2Detail.target,
                candidate: fase2Detail.chosen,
                allCandidates: fase2Detail.rec.candidates,
                recommendationReason: fase2Detail.rec.reason,
              }
            : null
        }
        onApprove={(_no, master) => {
          if (fase2Detail) applyFase2Candidate(fase2Detail.row, master);
          setFase2Detail(null);
        }}
      />

      {/* Modal Setujui Pemetaan Kota Manual */}
      <CityOverrideModal
        isOpen={overrideModal !== null}
        masterCity={overrideModal?.masterCity || ''}
        masterRows={overrideModal?.masterRows || []}
        ptenKota={overrideModal?.ptenKota || ''}
        ptenKodePos={overrideModal?.ptenKodePos || []}
        isProcessing={isProcessing}
        onClose={() => setOverrideModal(null)}
        onConfirm={() => {
          if (!overrideModal || !onApproveCityOverride) return;
          const { masterCity, ptenKota, masterRows } = overrideModal;
          setOverrideModal(null);
          setOverrideDrafts((prev) => {
            const next = { ...prev };
            delete next[cityMatchKey(masterCity)];
            return next;
          });
          showToast(`${masterRows.length.toLocaleString('id-ID')} baris ${masterCity} dipetakan ke ${ptenKota} — menganalisa ulang…`);
          onApproveCityOverride(masterCity, ptenKota);
        }}
      />
    </div>
  );
};
