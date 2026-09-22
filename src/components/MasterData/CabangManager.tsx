import React, { useState, useMemo, useRef, useDeferredValue, useEffect } from 'react';
import {
  Store,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  Plus,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Building2,
  MapPin,
  Sparkles,
  Layers,
  X,
  FileSpreadsheet,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { MasterRow, MasterHealth, WilayahSetting } from '../../types';
import { parseExcelFile, validateMasterHeaders, downloadMasterTemplate, tulisLembarExcel } from '../../utils/excel';
import { tanggalBerkas } from '../../utils/normalizer';
import { MasterHealthCard } from './MasterHealthCard';
import { useVirtualWindow } from '../../utils/useVirtualWindow';
import { DialogPanel } from '../BaseModal';
import { useNotification } from '../Notification/NotificationContext';

interface CabangManagerProps {
  masterRows: MasterRow[];
  onMasterLoaded: (rows: MasterRow[], fileName: string, mode?: 'replace' | 'append' | 'update') => void;
  onResetMaster: () => void;
  masterHealth: MasterHealth;
  wilayahSettings?: WilayahSetting[];
}

export const CabangManager: React.FC<CabangManagerProps> = ({
  masterRows,
  onMasterLoaded,
  onResetMaster,
  masterHealth,
}) => {
  const { add: notify } = useNotification();
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'health'>('list');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [searchBy, setSearchBy] = useState<string>('all');
  const [selectedWilayah, setSelectedWilayah] = useState<string>('ALL');

  // Pagination state (Default 10)
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(10);

  // Modals state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const [formData, setFormData] = useState<MasterRow>({
    Wilayah: '',
    'Sandi Cabang': '',
    Sandi: '',
    Cabang: '',
    'Branch Code': '',
    'Kode Cabang': '',
    'Nama Outlet': '',
    'Status Outlet': 'Aktif',
    ALAMAT: '',
    'KODE POS': '',
    Kelurahan: '',
    Kecamatan: '',
    'Dati II': '',
    'Kode Dati II': '',
    Provinsi: '',
    Telp: '',
  });

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if dataset uses single Sandi Cabang or separate Sandi + Cabang
  const hasCombinedSandiCabang = useMemo(() => {
    return masterRows.some((r) => r['Sandi Cabang'] && (!r.Sandi || r.Sandi === r['Sandi Cabang']));
  }, [masterRows]);

  // Unique Wilayah list for filter
  const wilayahList = useMemo(() => {
    return Array.from(new Set(masterRows.map((r) => r.Wilayah?.trim()).filter(Boolean))).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }, [masterRows]);

  // Unique Kota / Dati II list
  const dati2List = useMemo(() => {
    return Array.from(new Set(masterRows.map((r) => r['Dati II']?.trim()).filter(Boolean))).sort();
  }, [masterRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return masterRows.filter((r) => {
      if (selectedWilayah !== 'ALL' && String(r.Wilayah || '').trim() !== selectedWilayah) {
        return false;
      }
      if (!deferredSearch.trim()) return true;
      const q = deferredSearch.toLowerCase();

      switch (searchBy) {
        case 'nama':
          return String(r['Nama Outlet'] || '').toLowerCase().includes(q);
        case 'kodepos':
          return String(r['KODE POS'] || '').toLowerCase().includes(q);
        case 'sandi':
          return (
            String(r['Sandi Cabang'] || '').toLowerCase().includes(q) ||
            String(r.Sandi || '').toLowerCase().includes(q) ||
            String(r.Cabang || '').toLowerCase().includes(q)
          );
        case 'kodecabang':
          return (
            String(r['Branch Code'] || '').toLowerCase().includes(q) ||
            String(r['Kode Cabang'] || '').toLowerCase().includes(q)
          );
        case 'wilayah':
          return String(r.Wilayah || '').toLowerCase().includes(q);
        case 'alamat':
          return (
            String(r.ALAMAT || '').toLowerCase().includes(q) ||
            String(r.Kecamatan || '').toLowerCase().includes(q) ||
            String(r.Kelurahan || '').toLowerCase().includes(q) ||
            String(r['Dati II'] || '').toLowerCase().includes(q) ||
            String(r.Provinsi || '').toLowerCase().includes(q)
          );
        case 'all':
        default:
          return (
            String(r.Wilayah || '').toLowerCase().includes(q) ||
            String(r['Sandi Cabang'] || '').toLowerCase().includes(q) ||
            String(r.Sandi || '').toLowerCase().includes(q) ||
            String(r.Cabang || '').toLowerCase().includes(q) ||
            String(r['Branch Code'] || '').toLowerCase().includes(q) ||
            String(r['Kode Cabang'] || '').toLowerCase().includes(q) ||
            String(r['Nama Outlet'] || '').toLowerCase().includes(q) ||
            String(r['KODE POS'] || '').toLowerCase().includes(q) ||
            String(r.Kecamatan || '').toLowerCase().includes(q) ||
            String(r.Kelurahan || '').toLowerCase().includes(q) ||
            String(r['Dati II'] || '').toLowerCase().includes(q) ||
            String(r.ALAMAT || '').toLowerCase().includes(q)
          );
      }
    });
  }, [masterRows, deferredSearch, searchBy, selectedWilayah]);

  // Completeness stats for Master Data
  const completenessStats = useMemo(() => {
    let complete = 0;
    masterRows.forEach((r) => {
      const hasSandi = Boolean(r['Sandi Cabang'] || r.Sandi || r.Cabang);
      const hasOutlet = Boolean(r['Nama Outlet']);
      const hasKp = Boolean(r['KODE POS']);
      const hasAlamat = Boolean(r.ALAMAT);
      if (hasSandi && hasOutlet && hasKp && hasAlamat) {
        complete++;
      }
    });
    const isAllComplete = masterRows.length > 0 && complete === masterRows.length;
    const percentage = masterRows.length > 0 ? Math.round((complete / masterRows.length) * 100) : 0;
    return {
      isAllComplete,
      complete,
      total: masterRows.length,
      incomplete: masterRows.length - complete,
      percentage,
    };
  }, [masterRows]);

  // Pagination calculation
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    if (pageSize === 'ALL') return filteredRows;
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Windowing "Lihat Semua" + indeks O(1) pengganti masterRows.indexOf() per baris
  const cabangScrollRef = useRef<HTMLDivElement | null>(null);
  const win = useVirtualWindow({ containerRef: cabangScrollRef, itemCount: paginatedRows.length });
  const renderedRows = win.active ? paginatedRows.slice(win.start, win.end) : paginatedRows;
  const rowOffset = win.active ? win.start : 0;
  const masterIndexByRow = useMemo(() => {
    const map = new Map<MasterRow, number>();
    masterRows.forEach((row, i) => {
      if (!map.has(row)) map.set(row, i);
    });
    return map;
  }, [masterRows]);

  useEffect(() => {
    cabangScrollRef.current?.scrollTo({ top: 0 });
  }, [page, pageSize, selectedWilayah, searchBy, deferredSearch]);

  // Import Excel handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, headers } = await parseExcelFile<MasterRow>(file);
      const validation = validateMasterHeaders(headers);
      if (!validation.isValid) {
        setErrorMsg(`Header berkas belum lengkap. Kolom tidak ditemukan: [${validation.missing.join(', ')}]`);
        return;
      }

      if (data.length === 0) {
        setErrorMsg('Berkas Excel master tidak berisi baris data.');
        return;
      }

      onMasterLoaded(data, file.name, 'replace');
      setSuccessMsg(`Berhasil memuat ${data.length.toLocaleString('id-ID')} baris data master dari "${file.name}".`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(`Gagal membaca berkas: ${err?.message || 'Format Excel tidak valid'}`);
    }
  };

  // Export Excel handler — yang diunduh adalah daftar yang sedang tampil (ikut pencarian),
  // bukan seluruh master, supaya angka di berkas sama dengan angka di layar.
  const handleExportExcel = () => {
    const kolom = [
      'Wilayah', 'Sandi Cabang', 'Sandi', 'Cabang', 'Nama Outlet', 'Branch Code', 'Kode Cabang',
      'Status Outlet', 'KODE POS', 'Kelurahan', 'Kecamatan', 'Dati II', 'Kode Dati II', 'Provinsi',
      'ALAMAT', 'Telp',
    ];
    const exportData = filteredRows.map((r) => ({
      Wilayah: r.Wilayah || '',
      'Sandi Cabang': r['Sandi Cabang'] || (r.Sandi && r.Cabang ? `${r.Sandi} - ${r.Cabang}` : r.Cabang || r.Sandi || ''),
      Sandi: r.Sandi || '',
      Cabang: r.Cabang || '',
      'Nama Outlet': r['Nama Outlet'] || '',
      'Branch Code': r['Branch Code'] || '',
      'Kode Cabang': r['Kode Cabang'] || '',
      'Status Outlet': r['Status Outlet'] || 'Aktif',
      'KODE POS': r['KODE POS'] || '',
      Kelurahan: r.Kelurahan || '',
      Kecamatan: r.Kecamatan || '',
      'Dati II': r['Dati II'] || '',
      'Kode Dati II': r['Kode Dati II'] || '',
      Provinsi: r.Provinsi || '',
      ALAMAT: r.ALAMAT || '',
      Telp: r.Telp || '',
    }));

    if (exportData.length === 0) {
      notify('Tidak ada baris yang cocok dengan pencarian — tidak ada yang bisa diunduh.', 'warning');
      return;
    }

    tulisLembarExcel({
      namaLembar: 'Data_Master_Cabang',
      namaBerkas: `Data_Master_Cabang_${tanggalBerkas()}.xlsx`,
      kolom,
      baris: exportData,
    });
    notify(`${exportData.length.toLocaleString('id-ID')} baris master cabang diunduh${searchTerm ? ` (hasil cari "${searchTerm}")` : ''}.`, 'success');
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      Wilayah: 'W1',
      'Sandi Cabang': '',
      Sandi: '',
      Cabang: '',
      'Branch Code': '',
      'Kode Cabang': '',
      'Nama Outlet': '',
      'Status Outlet': 'Aktif',
      ALAMAT: '',
      'KODE POS': '',
      Kelurahan: '',
      Kecamatan: '',
      'Dati II': '',
      'Kode Dati II': '',
      Provinsi: '',
      Telp: '',
    });
    setEditingIndex(null);
    setModalMode('create');
  };

  // Open Edit Modal
  const handleOpenEdit = (index: number) => {
    const item = masterRows[index];
    setFormData({ ...item });
    setEditingIndex(index);
    setModalMode('edit');
  };

  // Open Detail Modal
  const handleOpenDetailModal = (index: number) => {
    const item = masterRows[index];
    setFormData({ ...item });
    setEditingIndex(index);
    setModalMode('detail');
  };

  // Submit Modal Form (Create / Edit)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData['Nama Outlet']?.trim() || !formData['KODE POS']?.trim()) {
      notify('Nama Outlet dan KODE POS wajib diisi!', 'warning');
      return;
    }

    let updatedList: MasterRow[];
    if (modalMode === 'edit' && editingIndex !== null) {
      updatedList = masterRows.map((item, i) => (i === editingIndex ? formData : item));
    } else {
      updatedList = [formData, ...masterRows];
    }

    // 'update' = kirim daftar LENGKAP hasil create/edit; App.tsx menerapkan apa adanya
    // (mode 'replace' artinya impor Excel yang di-merge+dedup terhadap data lama).
    onMasterLoaded(updatedList, 'Master_Data_Manual.xlsx', 'update');
    setModalMode(null);
    setSuccessMsg('Data master cabang berhasil diperbarui.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Delete Cabang record
  const handleConfirmDelete = () => {
    if (deleteTargetIndex === null) return;
    const updated = masterRows.filter((_, idx) => idx !== deleteTargetIndex);
    onMasterLoaded(updated, 'Master_Data_Updated.xlsx', 'update');
    setDeleteTargetIndex(null);
    setSuccessMsg('Data cabang berhasil dihapus.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Top Header Card matching Wilayah & PTEN */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            className="metric-icon-bubble"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, rgba(64, 81, 137, 0.15) 0%, rgba(10, 179, 156, 0.15) 100%)',
              color: '#405189',
              border: '1px solid rgba(64, 81, 137, 0.2)',
            }}
          >
            <Store size={22} />
          </div>
          <div>
            <h3 className="section-title">Master Data Cabang & Outlet</h3>
            <p className="section-subtitle">
              Kelola daftar referensi resmi cabang, sandi cabang, kode cabang, status, alamat, dan kode pos untuk proses pencocokan data.
            </p>
          </div>
        </div>

        {/* Tab switcher & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            style={{ display: 'none' }}
          />

          {masterRows.length > 0 && (
            <div className="nav-tabs" style={{ marginRight: '0.35rem' }}>
              <button
                type="button"
                className={activeSubTab === 'list' ? 'nav-tab-btn active' : 'nav-tab-btn'}
                onClick={() => setActiveSubTab('list')}
              >
                Daftar Cabang
              </button>
              <button
                type="button"
                className={activeSubTab === 'health' ? 'nav-tab-btn active' : 'nav-tab-btn'}
                onClick={() => setActiveSubTab('health')}
              >
                <ShieldAlert size={13} />
                <span>Audit & Multi-Outlet</span>
                {masterHealth.multiOutletCount > 0 && (
                  <span className="nav-tab-badge">{masterHealth.multiOutletCount}</span>
                )}
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Import berkas Excel data master cabang"
          >
            <Upload size={13} />
            <span>Impor Excel</span>
          </button>

          {masterRows.length > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleExportExcel}
              title="Export data master cabang ke Excel"
            >
              <Download size={13} />
              <span>Ekspor Excel</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => downloadMasterTemplate(false)}
            title="Unduh template Excel master cabang"
          >
            <FileSpreadsheet size={13} />
            <span>Template Excel</span>
          </button>

          {masterRows.length > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowResetConfirm(true)}
              title="Kosongkan seluruh data master cabang"
              style={{ color: '#f06548', borderColor: 'rgba(240, 101, 72, 0.3)' }}
            >
              <RefreshCw size={13} />
              <span>Reset Cabang</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenCreate}
          >
            <Plus size={14} />
            <span>Tambah Cabang</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards matching Wilayah & PTEN */}
      <div className="metrics-grid">
        <div className="metric-card blue">
          <div className="metric-header">
            <span className="metric-title">Total Cabang & Outlet</span>
            <div className="metric-icon-bubble">
              <Building2 size={14} />
            </div>
          </div>
          <div className="metric-value">{masterRows.length.toLocaleString('id-ID')}</div>
          <div className="metric-footer">Cabang terdaftar dalam sesi</div>
        </div>

        <div className="metric-card emerald">
          <div className="metric-header">
            <span className="metric-title">Cakupan Wilayah</span>
            <div className="metric-icon-bubble">
              <Layers size={14} />
            </div>
          </div>
          <div className="metric-value">{wilayahList.length}</div>
          <div className="metric-footer">Kanwil</div>
        </div>

        <div className="metric-card cyan">
          <div className="metric-header">
            <span className="metric-title">Cakupan Kota / Dati II</span>
            <div className="metric-icon-bubble">
              <MapPin size={14} />
            </div>
          </div>
          <div className="metric-value">{dati2List.length}</div>
          <div className="metric-footer">Kota/Kab</div>
        </div>

        <div className={completenessStats.isAllComplete ? 'metric-card emerald' : 'metric-card rose'}>
          <div className="metric-header">
            <span className="metric-title">Status Kelengkapan Data</span>
            <div className="metric-icon-bubble">
              {completenessStats.isAllComplete ? <Sparkles size={14} /> : <AlertCircle size={14} />}
            </div>
          </div>
          {completenessStats.isAllComplete ? (
            <div className="metric-value" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={14} />
              <span>Lengkap (100%)</span>
            </div>
          ) : (
            <div className="metric-value" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <AlertCircle size={14} />
              <span>{completenessStats.incomplete.toLocaleString('id-ID')} Data Belum Lengkap ({completenessStats.percentage}%)</span>
            </div>
          )}
          <div className="metric-footer">
            {completenessStats.complete.toLocaleString('id-ID')} dari {completenessStats.total.toLocaleString('id-ID')} data lengkap
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            background: 'rgba(240, 101, 72, 0.08)',
            border: '1px solid rgba(240, 101, 72, 0.25)',
            color: '#f06548',
            fontSize: '0.82rem',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            background: 'rgba(10, 179, 156, 0.08)',
            border: '1px solid rgba(10, 179, 156, 0.25)',
            color: '#0ab39c',
            fontSize: '0.82rem',
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Content Area */}
      {activeSubTab === 'health' ? (
        <MasterHealthCard health={masterHealth} />
      ) : masterRows.length === 0 ? (
        /* Empty State */
        <div
          className="glass-card"
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            border: '1px dashed #ced4da',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            className="metric-icon-bubble"
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(64, 81, 137, 0.08)',
              color: '#405189',
            }}
          >
            <Store size={28} />
          </div>
          <div>
            <h4 className="section-title" style={{ fontSize: '1.05rem', margin: '0 0 0.4rem' }}>
              Belum Ada Data Master Cabang
            </h4>
            <p className="section-subtitle" style={{ maxWidth: '440px', margin: 0, lineHeight: 1.5 }}>
              Silakan impor berkas Excel data cabang atau tambah data baru untuk memulai pencocokan data otomatis.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              <span>Pilih Berkas Master Excel</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => downloadMasterTemplate(false)}
            >
              <FileSpreadsheet size={16} />
              <span>Download Template Excel</span>
            </button>
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="glass-card">
          {/* Filter & Search Bar */}
          <div className="filter-toolbar" style={{ marginBottom: '1rem' }}>
            <div className="filter-group" style={{ flex: 1, minWidth: '320px', maxWidth: '750px' }}>
              {/* Search by column */}
              <div className="unified-select-box" style={{ width: '150px' }}>
                <select
                  value={searchBy}
                  onChange={(e) => {
                    setSearchBy(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Semua Kolom</option>
                  <option value="nama">Nama Outlet</option>
                  <option value="kodepos">KODE POS</option>
                  <option value="sandi">Sandi Cabang</option>
                  <option value="kodecabang">Branch / Kode</option>
                  <option value="wilayah">Wilayah</option>
                  <option value="alamat">Alamat / Kota</option>
                </select>
              </div>

              {/* Search text */}
              <div className="search-input-wrapper" style={{ flex: 1, minWidth: '200px' }}>
                <Search size={15} className="search-icon-pos" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Cari data cabang, alamat, kode pos..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: '100%' }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#878a99',
                      padding: '2px',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
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
                    {w}
                  </option>
                ))}
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
                <option value={10}>10 Baris</option>
                <option value={25}>25 Baris</option>
                <option value={50}>50 Baris</option>
                <option value={100}>100 Baris</option>
                <option value="ALL">Lihat Semua ({filteredRows.length})</option>
              </select>
            </div>
          </div>

          {/* Table Master Cabang */}
          <div ref={cabangScrollRef} className="table-container" style={{ maxHeight: '580px', overflow: 'auto' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '78px', textAlign: 'center' }}>Wilayah</th>
                  {hasCombinedSandiCabang ? (
                    <th>Sandi & Cabang</th>
                  ) : (
                    <>
                      <th style={{ width: '85px', textAlign: 'center' }}>Sandi</th>
                      <th>Cabang</th>
                    </>
                  )}
                  <th>Nama Outlet</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Branch Code</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Kode Cabang</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '75px', textAlign: 'center' }}>KODE POS</th>
                  <th>Kelurahan / Kec.</th>
                  <th>Dati II (Kota)</th>
                  <th style={{ minWidth: '220px' }}>ALAMAT</th>
                  <th style={{ width: '100px' }}>Telepon</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={hasCombinedSandiCabang ? 12 : 13} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                      Tidak ada data cabang yang cocok dengan pencarian "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  <>
                    {win.active && win.padTop > 0 && <tr aria-hidden="true" style={{ height: `${win.padTop}px` }} />}
                    {renderedRows.map((r, i) => {
                      const idx = rowOffset + i;
                      const originalIdx = masterIndexByRow.get(r) ?? -1;
                      const globalIdx = pageSize === 'ALL' ? idx + 1 : (page - 1) * (pageSize as number) + idx + 1;

                      return (
                      <tr key={idx} data-vrow={i === 0 ? 'true' : undefined} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                        <td style={{ textAlign: 'center', color: '#878a99' }}>{globalIdx}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-level1">{r.Wilayah || '-'}</span>
                        </td>
                        {hasCombinedSandiCabang ? (
                          <td>
                            <strong style={{ color: '#212529', fontWeight: 600 }}>
                              {r['Sandi Cabang'] || r.Sandi || '-'}
                            </strong>
                          </td>
                        ) : (
                          <>
                            <td className="code-cell" style={{ textAlign: 'center' }}>{r.Sandi || '-'}</td>
                            <td><strong style={{ color: '#212529', fontWeight: 600 }}>{r.Cabang || '-'}</strong></td>
                          </>
                        )}
                        <td style={{ color: '#405189', fontWeight: 600 }}>{r['Nama Outlet'] || '-'}</td>
                        <td className="code-cell" style={{ textAlign: 'center' }}>{r['Branch Code'] || '-'}</td>
                        <td className="code-cell" style={{ textAlign: 'center' }}>{r['Kode Cabang'] || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-match">{r['Status Outlet'] || 'Aktif'}</span>
                        </td>
                        <td className="code-cell" style={{ color: '#0ab39c', fontWeight: 700, textAlign: 'center', background: '#e8f7f5' }}>
                          {r['KODE POS']}
                        </td>
                        <td>
                          <div style={{ color: '#212529' }}>{r.Kelurahan || '-'}</div>
                          <div style={{ fontSize: '0.7rem', color: '#878a99' }}>{r.Kecamatan || ''}</div>
                        </td>
                        <td style={{ color: '#495057' }}>{r['Dati II'] || '-'}</td>
                        <td title={r.ALAMAT}>
                          {r.ALAMAT || '-'}
                        </td>
                        <td style={{ color: '#878a99', fontSize: '0.74rem' }}>{r.Telp || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(originalIdx)}
                              title="Lihat Detail Cabang"
                              style={{
                                background: 'rgba(41, 156, 219, 0.1)',
                                border: '1px solid rgba(41, 156, 219, 0.25)',
                                color: '#299cdb',
                                borderRadius: '4px',
                                padding: '0.22rem 0.35rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Eye size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(originalIdx)}
                              title="Edit Data Cabang"
                              style={{
                                background: 'rgba(64, 81, 137, 0.1)',
                                border: '1px solid rgba(64, 81, 137, 0.25)',
                                color: '#405189',
                                borderRadius: '4px',
                                padding: '0.22rem 0.35rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTargetIndex(originalIdx)}
                              title="Hapus Data Cabang"
                              style={{
                                background: 'rgba(240, 101, 72, 0.1)',
                                border: '1px solid rgba(240, 101, 72, 0.25)',
                                color: '#f06548',
                                borderRadius: '4px',
                                padding: '0.22rem 0.35rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
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
              }}
            >
              <div>
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
                >
                  <ChevronsLeft size={13} />
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft size={13} />
                </button>

                {(() => {
                  const getPaginationRange = (curr: number, total: number): (number | string)[] => {
                    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
                    const pages: (number | string)[] = [1];
                    let start = Math.max(2, curr - 1);
                    let end = Math.min(total - 1, curr + 1);
                    if (curr <= 3) {
                      start = 2;
                      end = 4;
                    } else if (curr >= total - 2) {
                      start = total - 3;
                      end = total - 1;
                    }
                    if (start > 2) pages.push('ell-start');
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (end < total - 1) pages.push('ell-end');
                    pages.push(total);
                    return pages;
                  };

                  return getPaginationRange(page, totalPages).map((p, idx) => {
                    if (typeof p === 'string') {
                      return (
                        <span
                          key={p + idx}
                          style={{
                            minWidth: '22px',
                            height: '28px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.74rem',
                            color: '#878a99',
                            userSelect: 'none',
                          }}
                        >
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        style={{
                          minWidth: '28px',
                          height: '28px',
                          padding: '0 0.4rem',
                          fontSize: '0.74rem',
                          fontWeight: page === p ? 700 : 500,
                          borderRadius: '4px',
                          border: page === p ? '1px solid #405189' : '1px solid #ced4da',
                          background: page === p ? '#405189' : '#ffffff',
                          color: page === p ? '#ffffff' : '#495057',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {p}
                      </button>
                    );
                  });
                })()}

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  title="Halaman Berikutnya"
                >
                  <ChevronRight size={13} />
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  title="Halaman Terakhir"
                >
                  <ChevronsRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit / Detail Modal */}
      {modalMode && (
        <DialogPanel onClose={() => setModalMode(null)} closableOnOutside={false} style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <Store size={18} color="#405189" />
                {modalMode === 'create' && 'Tambah Data Master Cabang'}
                {modalMode === 'edit' && 'Edit Data Master Cabang'}
                {modalMode === 'detail' && 'Detail Data Master Cabang'}
              </h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalMode(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSubmitForm}
              style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-field">
                    <label className="form-label">
                      Wilayah <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      disabled={modalMode === 'detail'}
                      placeholder="Contoh: W1"
                      value={formData.Wilayah || ''}
                      onChange={(e) => setFormData({ ...formData, Wilayah: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Sandi Cabang</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={modalMode === 'detail'}
                      placeholder="Contoh: 601"
                      value={formData['Sandi Cabang'] || formData.Sandi || ''}
                      onChange={(e) => setFormData({ ...formData, 'Sandi Cabang': e.target.value, Sandi: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Branch Code</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={modalMode === 'detail'}
                      placeholder="Contoh: 601601"
                      value={formData['Branch Code'] || ''}
                      onChange={(e) => setFormData({ ...formData, 'Branch Code': e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                  <div className="form-field">
                    <label className="form-label">
                      Nama Outlet / Lokasi <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      disabled={modalMode === 'detail'}
                      placeholder="Nama Cabang / KCP / KK"
                      value={formData['Nama Outlet'] || ''}
                      onChange={(e) => setFormData({ ...formData, 'Nama Outlet': e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Kode Cabang</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={modalMode === 'detail'}
                      placeholder="Contoh: WMD"
                      value={formData['Kode Cabang'] || ''}
                      onChange={(e) => setFormData({ ...formData, 'Kode Cabang': e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-label">ALAMAT Lengkap</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    style={{ resize: 'vertical' }}
                    disabled={modalMode === 'detail'}
                    placeholder="Alamat jalan, gedung, nomor..."
                    value={formData.ALAMAT || ''}
                    onChange={(e) => setFormData({ ...formData, ALAMAT: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-field">
                    <label className="form-label">
                      KODE POS <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      disabled={modalMode === 'detail'}
                      placeholder="Contoh: 20151"
                      value={formData['KODE POS'] || ''}
                      onChange={(e) => setFormData({ ...formData, 'KODE POS': e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Kelurahan</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={modalMode === 'detail'}
                      placeholder="Kelurahan"
                      value={formData.Kelurahan || ''}
                      onChange={(e) => setFormData({ ...formData, Kelurahan: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Kecamatan</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={modalMode === 'detail'}
                      placeholder="Kecamatan"
                      value={formData.Kecamatan || ''}
                      onChange={(e) => setFormData({ ...formData, Kecamatan: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">Dati II (Kota / Kabupaten)</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={modalMode === 'detail'}
                      placeholder="Contoh: Kota Medan"
                      value={formData['Dati II'] || ''}
                      onChange={(e) => setFormData({ ...formData, 'Dati II': e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Provinsi</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={modalMode === 'detail'}
                      placeholder="Contoh: Sumatera Utara"
                      value={formData.Provinsi || ''}
                      onChange={(e) => setFormData({ ...formData, Provinsi: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setModalMode(null)}
                >
                  {modalMode === 'detail' ? 'Tutup' : 'Batal'}
                </button>
                {modalMode !== 'detail' && (
                  <button type="submit" className="btn btn-primary btn-sm">
                    {modalMode === 'create' ? 'Tambah Cabang' : 'Simpan Perubahan'}
                  </button>
                )}
              </div>
            </form>
    </DialogPanel>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetIndex !== null && (
        <DialogPanel onClose={() => setDeleteTargetIndex(null)} closableOnOutside={false} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <AlertCircle size={18} color="#f06548" />
                Hapus Data Master Cabang?
              </h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteTargetIndex(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: '#878a99', margin: 0 }}>
                Apakah Anda yakin ingin menghapus data cabang{' '}
                <strong>{masterRows[deleteTargetIndex]?.['Nama Outlet'] || masterRows[deleteTargetIndex]?.Cabang}</strong>?
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setDeleteTargetIndex(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmDelete}
              >
                Ya, Hapus
              </button>
            </div>
    </DialogPanel>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <DialogPanel onClose={() => setShowResetConfirm(false)} closableOnOutside={false} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <RefreshCw size={18} color="#f06548" />
                Kosongkan Seluruh Data Cabang?
              </h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowResetConfirm(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: '#878a99', margin: 0 }}>
                Seluruh {masterRows.length.toLocaleString('id-ID')} data master cabang akan dihapus dari sesi ini.
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowResetConfirm(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetMaster();
                }}
              >
                Ya, Kosongkan
              </button>
            </div>
    </DialogPanel>
      )}
    </div>
  );
};
