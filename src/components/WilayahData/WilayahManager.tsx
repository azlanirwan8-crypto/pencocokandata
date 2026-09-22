import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Map,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  Search,
  Download,
  Upload,
  Edit,
  Eye,
  RefreshCw,
  Building2,
  MapPin,
  Phone,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { WilayahSetting } from '../../types';
import { DEFAULT_WILAYAH_DATA, normalizeWilayahItem } from '../../utils/defaultWilayah';
import { loadWilayahFromNeon, saveWilayahToNeon, checkNeonStatus } from '../../utils/neonSync';
import { useNotification } from '../Notification/NotificationContext';
import { DialogPanel } from '../BaseModal';

interface WilayahManagerProps {
  initialSettings?: WilayahSetting[];
  onSettingsSaved?: (newSettings: WilayahSetting[]) => void;
}

export const WilayahManager: React.FC<WilayahManagerProps> = ({
  initialSettings,
  onSettingsSaved,
}) => {
  const { add: notify } = useNotification();
  const [settings, setSettings] = useState<WilayahSetting[]>(() => {
    if (initialSettings && initialSettings.length > 0) {
      return initialSettings.map((s, idx) => normalizeWilayahItem(s, idx));
    }
    return DEFAULT_WILAYAH_DATA;
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Pagination State (Default 10 data per halaman)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(10);

  // Modals state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<WilayahSetting>({
    wilayah: '',
    sandiCabang: '',
    branchCode: '',
    kodeCabang: '',
    namaOutlet: '',
    statusOutlet: 'KANWIL',
    alamat: '',
    kodePos: '',
    kelurahan: '',
    kecamatan: '',
    dati2: '',
    provinsi: '',
    telp: '',
    kodeWilayah: '',
    keterangan: '',
  });

  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showInfoBanner, setShowInfoBanner] = useState<boolean>(true);

  // Auto-dismiss the info banner after 20 seconds
  useEffect(() => {
    if (!showInfoBanner) return;
    const t = setTimeout(() => setShowInfoBanner(false), 20000);
    return () => clearTimeout(t);
  }, [showInfoBanner]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initialSettings if updated externally
  useEffect(() => {
    if (initialSettings && initialSettings.length > 0) {
      setSettings(initialSettings.map((s, idx) => normalizeWilayahItem(s, idx)));
    }
  }, [initialSettings]);

  // Initial cloud check & auto-load/push on mount silently in background
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const status = await checkNeonStatus();

        const cloudData = await loadWilayahFromNeon();
        if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
          const normalized = cloudData.map((s, idx) => normalizeWilayahItem(s, idx));
          if (isMounted) {
            setSettings(normalized);
            onSettingsSaved?.(normalized);
          }
        } else if (status.connected) {
          // Cloud belum berisi apa pun. Dulu: langsung mengirim 17 data bawaan ke cloud
          // tanpa bertanya — sekarang hanya dipakai di layar, operator yang memutuskan
          // kapan cloud menerima isinya (tombol "Simpan ke Database").
          if (isMounted) {
            setSettings(DEFAULT_WILAYAH_DATA);
            onSettingsSaved?.(DEFAULT_WILAYAH_DATA);
            notify(
              'Cloud belum punya Data Wilayah — 17 wilayah bawaan hanya dipakai di browser ini. ' +
                'Klik "Simpan ke Database" bila memang ingin mengirimnya ke cloud.',
              'info'
            );
          }
        }
      } catch (err) {
        console.warn('Initial cloud wilayah sync:', err);
      }
    };

    initData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered settings
  const filteredSettings = useMemo(() => {
    return settings.filter((item) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();

      return (
        (item.wilayah || '').toLowerCase().includes(term) ||
        (item.sandiCabang || '').toLowerCase().includes(term) ||
        (item.branchCode || '').toLowerCase().includes(term) ||
        (item.kodeCabang || '').toLowerCase().includes(term) ||
        (item.namaOutlet || '').toLowerCase().includes(term) ||
        (item.alamat || '').toLowerCase().includes(term) ||
        (item.kodePos || '').toLowerCase().includes(term) ||
        (item.kelurahan || '').toLowerCase().includes(term) ||
        (item.kecamatan || '').toLowerCase().includes(term) ||
        (item.dati2 || '').toLowerCase().includes(term) ||
        (item.provinsi || '').toLowerCase().includes(term) ||
        (item.telp || '').toLowerCase().includes(term)
      );
    });
  }, [settings, searchTerm]);

  // Unique provinsi list for filter and real metric calculation
  const provinsiList = useMemo(() => {
    const list = Array.from(
      new Set(
        settings
          .map((s) => (s.provinsi?.trim() || normalizeWilayahItem(s).provinsi?.trim()))
          .filter((p): p is string => Boolean(p && p !== '-' && p !== '0'))
      )
    ).sort();
    return list;
  }, [settings]);

  // Real-time completeness validation
  const completenessStats = useMemo(() => {
    let completeCount = 0;
    const missingRows: string[] = [];

    settings.forEach((s, idx) => {
      const missing: string[] = [];
      if (!s.sandiCabang?.trim() || s.sandiCabang === '-') missing.push('Sandi');
      if (!s.branchCode?.trim() || s.branchCode === '-') missing.push('Branch Code');
      if (!s.namaOutlet?.trim() || s.namaOutlet === '-') missing.push('Nama Outlet');
      if (!s.alamat?.trim() || s.alamat === '-') missing.push('Alamat');
      if (!s.kodePos?.trim() || s.kodePos === '-') missing.push('Kode Pos');
      if (!s.dati2?.trim() || s.dati2 === '-') missing.push('Dati II');
      if (!s.provinsi?.trim() || s.provinsi === '-') missing.push('Provinsi');

      if (missing.length === 0) {
        completeCount++;
      } else {
        missingRows.push(`Wilayah ${s.wilayah || idx + 1}: ${missing.join(', ')}`);
      }
    });

    const isAllComplete = settings.length > 0 && completeCount === settings.length;
    const percentage = settings.length > 0 ? Math.round((completeCount / settings.length) * 100) : 0;

    return {
      isAllComplete,
      completeCount,
      totalCount: settings.length,
      incompleteCount: settings.length - completeCount,
      percentage,
      missingRows,
    };
  }, [settings]);

  // Pagination calculation
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredSettings.length / pageSize));
  
  // Auto-clamp currentPage if filtered rows change
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedSettings = useMemo(() => {
    if (pageSize === 'ALL') return filteredSettings;
    const start = (currentPage - 1) * pageSize;
    return filteredSettings.slice(start, start + pageSize);
  }, [filteredSettings, currentPage, pageSize]);

  // Handle saving all current data to database
  const handleSaveToDatabase = async (currentSettings = settings) => {
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const normalized = currentSettings.map((s, idx) => normalizeWilayahItem(s, idx));
      const success = await saveWilayahToNeon(normalized);

      // Save locally regardless
      onSettingsSaved?.(normalized);

      if (success) {
        setSuccessMsg(`Berhasil menyimpan ${normalized.length} data wilayah ke Database Cloud!`);
      } else {
        setSuccessMsg(`Data wilayah tersimpan secara lokal di browser (${normalized.length} data).`);
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data wilayah.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    const nextWilayahNum = settings.length > 0
      ? Math.max(...settings.map((s) => parseInt(s.wilayah) || 0)) + 1
      : 1;
    const digit2 = String(nextWilayahNum).padStart(2, '0');

    setFormData({
      wilayah: String(nextWilayahNum),
      sandiCabang: `6${digit2}`,
      branchCode: `6${digit2}6${digit2}`,
      kodeCabang: '',
      namaOutlet: `WILAYAH ${digit2} - `,
      statusOutlet: 'KANWIL',
      alamat: '',
      kodePos: '',
      kelurahan: '',
      kecamatan: '',
      dati2: '',
      provinsi: '',
      telp: '',
      kodeWilayah: digit2,
      keterangan: `WILAYAH ${digit2}`,
    });
    setEditingIndex(null);
    setModalMode('create');
  };

  // Open Edit Modal
  const handleOpenEdit = (index: number) => {
    const item = settings[index];
    setFormData({ ...item });
    setEditingIndex(index);
    setModalMode('edit');
  };

  // Open Detail Modal
  const handleOpenDetail = (index: number) => {
    const item = settings[index];
    setFormData({ ...item });
    setEditingIndex(index);
    setModalMode('detail');
  };

  // Submit Modal Form (Create / Edit)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.wilayah.trim() || !formData.namaOutlet.trim()) {
      notify('Kolom Wilayah dan Nama Outlet wajib diisi!', 'warning');
      return;
    }

    const normalized = normalizeWilayahItem(formData);
    let updatedList: WilayahSetting[];

    if (modalMode === 'edit' && editingIndex !== null) {
      updatedList = settings.map((item, i) => (i === editingIndex ? normalized : item));
    } else {
      updatedList = [...settings, normalized];
    }

    setSettings(updatedList);
    setModalMode(null);
    handleSaveToDatabase(updatedList);
  };

  // Delete Record
  const handleConfirmDelete = () => {
    if (deleteTargetIndex === null) return;
    const updated = settings.filter((_, idx) => idx !== deleteTargetIndex);
    setSettings(updated);
    setDeleteTargetIndex(null);
    handleSaveToDatabase(updated);
  };

  // Reset to Default Standard 17 Records
  const handleResetToDefault = () => {
    setSettings(DEFAULT_WILAYAH_DATA);
    setShowResetConfirm(false);
    handleSaveToDatabase(DEFAULT_WILAYAH_DATA);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = settings.map((item) => ({
      Wilayah: item.wilayah,
      'Sandi Cabang': item.sandiCabang,
      'Branch Code': item.branchCode,
      'Kode Cabang': item.kodeCabang,
      'Nama Outlet': item.namaOutlet,
      'Status Outlet': item.statusOutlet,
      ALAMAT: item.alamat,
      'KODE POS': item.kodePos,
      Kelurahan: item.kelurahan,
      Kecamatan: item.kecamatan,
      'Dati II': item.dati2,
      Provinsi: item.provinsi,
      Telp: item.telp,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Setting_Wilayah');
    XLSX.writeFile(wb, `Data_Setting_Wilayah_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Import from Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rawJson || rawJson.length === 0) {
          notify('Berkas Excel kosong atau tidak terbaca.', 'error');
          return;
        }

        const imported: WilayahSetting[] = rawJson.map((row, idx) => {
          return normalizeWilayahItem({
            wilayah: String(row['Wilayah'] || row['wilayah'] || idx + 1),
            sandiCabang: String(row['Sandi Cabang'] || row['sandiCabang'] || row['Sandi'] || ''),
            branchCode: String(row['Branch Code'] || row['branchCode'] || ''),
            kodeCabang: String(row['Kode Cabang'] || row['kodeCabang'] || ''),
            namaOutlet: String(row['Nama Outlet'] || row['namaOutlet'] || ''),
            statusOutlet: String(row['Status Outlet'] || row['statusOutlet'] || 'KANWIL'),
            alamat: String(row['ALAMAT'] || row['alamat'] || row['Alamat'] || ''),
            kodePos: String(row['KODE POS'] || row['kodePos'] || row['Kode Pos'] || ''),
            kelurahan: String(row['Kelurahan'] || row['kelurahan'] || ''),
            kecamatan: String(row['Kecamatan'] || row['kecamatan'] || ''),
            dati2: String(row['Dati II'] || row['dati2'] || row['Kota'] || ''),
            provinsi: String(row['Provinsi'] || row['provinsi'] || ''),
            telp: String(row['Telp'] || row['telp'] || row['Telepon'] || ''),
          }, idx);
        });

        setSettings(imported);
        handleSaveToDatabase(imported);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        notify('Gagal membaca format file Excel: ' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Download Template Excel Wilayah
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Wilayah': 'W1',
        'Sandi Cabang': '001',
        'Branch Code': '001',
        'Kode Cabang': '001',
        'Nama Outlet': 'KANWIL 01 - MEDAN',
        'Status Outlet': 'KANWIL',
        'ALAMAT': 'Jl. Balai Kota No. 2, Kesawan, Kec. Medan Barat',
        'KODE POS': '20111',
        'Kelurahan': 'Kesawan',
        'Kecamatan': 'Medan Barat',
        'Dati II': 'KOTA MEDAN',
        'Kode Dati II': '1271',
        'Provinsi': 'Sumatera Utara',
        'Telp': '061-4512345',
      },
      {
        'Wilayah': 'W2',
        'Sandi Cabang': '002',
        'Branch Code': '002',
        'Kode Cabang': '002',
        'Nama Outlet': 'KANWIL 02 - PADANG',
        'Status Outlet': 'KANWIL',
        'ALAMAT': 'Jl. Bagindo Aziz Chan No. 1, Sawahan, Kec. Padang Timur',
        'KODE POS': '25121',
        'Kelurahan': 'Sawahan',
        'Kecamatan': 'Padang Timur',
        'Dati II': 'KOTA PADANG',
        'Kode Dati II': '1371',
        'Provinsi': 'Sumatera Barat',
        'Telp': '0751-31234',
      },
      {
        'Wilayah': 'W12',
        'Sandi Cabang': '012',
        'Branch Code': '012',
        'Kode Cabang': '012',
        'Nama Outlet': 'KANWIL 12 - JAKARTA KOTA',
        'Status Outlet': 'KANWIL',
        'ALAMAT': 'Jl. Lada No. 1, Pinangsia, Kec. Taman Sari',
        'KODE POS': '11110',
        'Kelurahan': 'Pinangsia',
        'Kecamatan': 'Taman Sari',
        'Dati II': 'JAKARTA BARAT',
        'Kode Dati II': '3173',
        'Provinsi': 'DKI Jakarta',
        'Telp': '021-6901234',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Wilayah');
    XLSX.writeFile(wb, 'Template_Upload_Wilayah.xlsx');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Top Header Card */}
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
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, rgba(64, 81, 137, 0.15) 0%, rgba(10, 179, 156, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#405189',
              border: '1px solid rgba(64, 81, 137, 0.2)',
            }}
          >
            <Map size={22} />
          </div>
          <div>
            <h3 className="section-title">
              Master Setting Wilayah & Kanwil
            </h3>
            <p className="section-subtitle">
              Kelola daftar lengkap 17 Kantor Wilayah, alamat, kode pos, dati II, dan pemetaan kode branch untuk sistem pencocokan data.
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportExcel}
            accept=".xlsx, .xls, .csv"
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Import berkas Excel data wilayah"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Upload size={13} />
            <span>Impor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportExcel}
            title="Export daftar wilayah ke file Excel"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={13} />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleDownloadTemplate}
            title="Download Template format Excel untuk Wilayah"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={13} />
            <span>Template Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowResetConfirm(true)}
            title="Kembalikan ke data 17 wilayah standar"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#d68b0c' }}
          >
            <RefreshCw size={13} />
            <span>Reset Standar</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenCreate}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={14} />
            <span>Tambah Wilayah</span>
          </button>

          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={() => handleSaveToDatabase()}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: '#0ab39c',
              borderColor: '#0ab39c',
              color: '#ffffff',
            }}
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Data'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="metrics-grid">
        <div className="metric-card blue">
          <div className="metric-header">
            <span className="metric-title">Total Kantor Wilayah</span>
            <span className="metric-icon-bubble">
              <Building2 size={18} />
            </span>
          </div>
          <div className="metric-value">{settings.length}</div>
          <div className="metric-footer">Kanwil terdaftar</div>
        </div>

        <div className="metric-card emerald">
          <div className="metric-header">
            <span className="metric-title">Cakupan Provinsi</span>
            <span className="metric-icon-bubble">
              <MapPin size={18} />
            </span>
          </div>
          <div className="metric-value">{provinsiList.length}</div>
          <div className="metric-footer">Provinsi terpetakan</div>
        </div>

        <div className="metric-card cyan">
          <div className="metric-header">
            <span className="metric-title">Rentang Sandi Cabang</span>
            <span className="metric-icon-bubble">
              <Layers size={18} />
            </span>
          </div>
          <div className="metric-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem' }}>
            {settings.length > 0
              ? `${settings[0].sandiCabang || '601'} - ${settings[settings.length - 1].sandiCabang || '618'}`
              : '-'}
          </div>
        </div>

        <div className={`metric-card ${completenessStats.isAllComplete ? 'emerald' : 'rose'}`}>
          <div className="metric-header">
            <span className="metric-title">Status Data</span>
            <span className="metric-icon-bubble">
              {completenessStats.isAllComplete ? <Sparkles size={18} /> : <AlertCircle size={18} />}
            </span>
          </div>
          {completenessStats.isAllComplete ? (
            <div className="metric-value" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={15} />
              <span>Lengkap (100%)</span>
            </div>
          ) : (
            <div className="metric-value" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <AlertCircle size={15} />
              <span>{completenessStats.incompleteCount} Data Belum Lengkap ({completenessStats.percentage}%)</span>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
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
          <span>{error}</span>
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

      {/* Main Table Card */}
      <div className="glass-card" style={{ padding: '1.15rem 1.35rem' }}>
        {/* Table Search & Filter Bar */}
        <div className="filter-toolbar" style={{ marginBottom: '1rem' }}>
          <div className="filter-group">
            {/* Search Input */}
            <div className="search-input-wrapper">
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#878a99',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Cari wilayah, nama outlet, alamat, kota, provinsi, kode pos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
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
          </div>

          <div className="filter-group">
            <span style={{ fontSize: '0.78rem', color: '#878a99' }}>Tampilkan:</span>
            <select
              className="filter-select"
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
            >
              <option value={10}>10 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
              <option value="ALL">Lihat Semua ({filteredSettings.length})</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div
          className="table-container"
          style={{
            border: '1px solid #e9ebec',
            borderRadius: '6px',
            overflowX: 'auto',
            maxHeight: '620px',
          }}
        >
          <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Wilayah</th>
                <th style={{ width: '85px', textAlign: 'center' }}>Sandi Cabang</th>
                <th style={{ width: '95px', textAlign: 'center' }}>Branch Code</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Kode Cabang</th>
                <th style={{ minWidth: '180px' }}>Nama Outlet</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                <th style={{ minWidth: '240px' }}>Alamat</th>
                <th style={{ width: '75px', textAlign: 'center' }}>Kode Pos</th>
                <th style={{ minWidth: '140px' }}>Kelurahan / Kec.</th>
                <th style={{ minWidth: '130px' }}>Dati II (Kota)</th>
                <th style={{ minWidth: '120px' }}>Provinsi</th>
                <th style={{ minWidth: '110px' }}>Telepon</th>
                <th style={{ width: '85px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSettings.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#878a99' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <MapPin size={28} style={{ color: '#ced4da' }} />
                      <span>Tidak ada data wilayah yang cocok dengan filter pencarian.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSettings.map((item, idx) => {
                  const originalIndex = settings.indexOf(item);
                  const displayRowNumber =
                    pageSize === 'ALL'
                      ? idx + 1
                      : (currentPage - 1) * (pageSize as number) + idx + 1;

                  return (
                    <tr
                      key={idx}
                      style={{
                        background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd',
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* No */}
                      <td style={{ textAlign: 'center', color: '#878a99', fontWeight: 500 }}>
                        {displayRowNumber}
                      </td>

                      {/* Wilayah */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="badge badge-level1"
                          style={{
                            fontWeight: 700,
                            padding: '0.2rem 0.45rem',
                            fontSize: '0.72rem',
                          }}
                        >
                          {item.wilayah}
                        </span>
                      </td>

                      {/* Sandi Cabang */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="code-cell" style={{ fontWeight: 600, color: '#405189' }}>
                          {item.sandiCabang || '-'}
                        </span>
                      </td>

                      {/* Branch Code */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="code-cell"
                          style={{
                            background: 'rgba(64, 81, 137, 0.08)',
                            color: '#405189',
                            fontWeight: 700,
                          }}
                        >
                          {item.branchCode || '-'}
                        </span>
                      </td>

                      {/* Kode Cabang */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-match" style={{ fontWeight: 600 }}>
                          {item.kodeCabang || '-'}
                        </span>
                      </td>

                      {/* Nama Outlet */}
                      <td>
                        <strong style={{ color: '#212529', display: 'block' }}>{item.namaOutlet}</strong>
                      </td>

                      {/* Status Outlet */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '0.15rem 0.4rem',
                            borderRadius: '3px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: '#e2e5e8',
                            color: '#495057',
                            whiteSpace: 'nowrap',
                            wordBreak: 'keep-all',
                          }}
                        >
                          {item.statusOutlet || 'KANWIL'}
                        </span>
                      </td>

                      {/* Alamat */}
                      <td title={item.alamat}>
                        {item.alamat || '-'}
                      </td>

                      {/* Kode Pos */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="code-cell"
                          style={{
                            background: '#e8f7f5',
                            color: '#0ab39c',
                            fontWeight: 700,
                          }}
                        >
                          {item.kodePos || '-'}
                        </span>
                      </td>

                      {/* Kelurahan / Kecamatan */}
                      <td>
                        <div style={{ color: '#212529', fontWeight: 500 }}>{item.kelurahan || '-'}</div>
                        <div style={{ fontSize: '0.7rem', color: '#878a99' }}>{item.kecamatan}</div>
                      </td>

                      {/* Dati II */}
                      <td style={{ color: '#495057' }}>{item.dati2 || '-'}</td>

                      {/* Provinsi */}
                      <td>
                        <span
                          style={{
                            background: '#eef1f4',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '3px',
                            fontSize: '0.72rem',
                            color: '#495057',
                          }}
                        >
                          {item.provinsi || '-'}
                        </span>
                      </td>

                      {/* Telp */}
                      <td style={{ fontSize: '0.72rem', color: '#6c757d' }}>{item.telp || '-'}</td>

                      {/* Aksi */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(originalIndex)}
                            title="Lihat Detail Wilayah"
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
                            onClick={() => handleOpenEdit(originalIndex)}
                            title="Edit Wilayah"
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
                            onClick={() => setDeleteTargetIndex(originalIndex)}
                            title="Hapus Wilayah"
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
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Navigation Footer */}
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
            <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
              Halaman <strong style={{ color: '#212529' }}>{currentPage}</strong> dari{' '}
              <strong style={{ color: '#212529' }}>{totalPages}</strong>
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="Halaman Pertama"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronsLeft size={13} />
              </button>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Halaman Sebelumnya"
                style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
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

                return getPaginationRange(currentPage, totalPages).map((p, idx) => {
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
                      onClick={() => setCurrentPage(p)}
                      style={{
                        minWidth: '28px',
                        height: '28px',
                        padding: '0 0.4rem',
                        fontSize: '0.74rem',
                        fontWeight: currentPage === p ? 700 : 500,
                        borderRadius: '4px',
                        border: currentPage === p ? '1px solid #405189' : '1px solid #ced4da',
                        background: currentPage === p ? '#405189' : '#ffffff',
                        color: currentPage === p ? '#ffffff' : '#495057',
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="Halaman Berikutnya"
                style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
              >
                <ChevronRight size={13} />
              </button>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                title="Halaman Terakhir"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary / Educational Card on Automation Logic */}
      {showInfoBanner && (
        <div
          style={{
            background: 'rgba(64, 81, 137, 0.04)',
            border: '1px solid rgba(64, 81, 137, 0.15)',
            borderRadius: '6px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: 1 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(64, 81, 137, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#405189',
                flexShrink: 0,
                marginTop: '0.1rem',
              }}
            >
              <Info size={18} />
            </div>
            <div style={{ flex: 1, fontSize: '0.8rem', color: '#495057', lineHeight: '1.5' }}>
              <strong style={{ color: '#212529', display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                Logika & Otomasi Pengayaan Wilayah Berdasarkan Branch Code:
              </strong>
              <p style={{ margin: '0 0 0.5rem' }}>
                Saat data Excel diunggah (Data Target / Data Master), sistem secara otomatis mengekstrak 2 digit (digit ke-2 dan ke-3) dari kolom{' '}
                <strong style={{ color: '#212529' }}>Branch Code</strong> atau <strong style={{ color: '#212529' }}>Sandi Cabang</strong>.{' '}
                Contoh: <code style={{ color: '#405189', fontWeight: 700 }}>60115601</code> atau <code style={{ color: '#405189', fontWeight: 700 }}>601601</code> menghasilkan kode <code style={{ color: '#0ab39c', fontWeight: 700 }}>01</code>, yang otomatis memetakan baris ke <strong style={{ color: '#212529' }}>WILAYAH 01 - MEDAN</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowInfoBanner(false)}
            title="Tutup informasi ini"
            aria-label="Tutup"
            style={{
              background: 'rgba(64, 81, 137, 0.08)',
              border: 'none',
              borderRadius: '6px',
              padding: '0.35rem',
              cursor: 'pointer',
              color: '#405189',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(240, 101, 72, 0.15)';
              e.currentTarget.style.color = '#f06548';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(64, 81, 137, 0.08)';
              e.currentTarget.style.color = '#405189';
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* MODAL: Tambah / Edit Wilayah */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <DialogPanel onClose={() => setModalMode(null)} closableOnOutside={false} style={{ maxWidth: '680px' }}>
            {/* Modal Header */}
            <div className="modal-header">
              <h4 className="modal-title">
                <Map size={18} color="#405189" />
                {modalMode === 'create' ? 'Tambah Data Wilayah Baru' : `Edit Data Wilayah (${formData.namaOutlet})`}
              </h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalMode(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body">
                <div className="form-grid-2">
                  {/* Wilayah */}
                  <div className="form-field">
                    <label className="form-label">
                      Nomor Wilayah <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.wilayah}
                      onChange={(e) => {
                        const val = e.target.value;
                        const d2 = val.padStart(2, '0');
                        setFormData((prev) => ({
                          ...prev,
                          wilayah: val,
                          kodeWilayah: d2,
                          sandiCabang: prev.sandiCabang || `6${d2}`,
                          branchCode: prev.branchCode || `6${d2}6${d2}`,
                        }));
                      }}
                      placeholder="Misal: 1, 2, 14"
                    />
                  </div>

                  {/* Sandi Cabang */}
                  <div className="form-field">
                    <label className="form-label">Sandi Cabang</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.sandiCabang}
                      onChange={(e) => setFormData({ ...formData, sandiCabang: e.target.value })}
                      placeholder="Misal: 601"
                    />
                  </div>

                  {/* Branch Code */}
                  <div className="form-field">
                    <label className="form-label">Branch Code (6 Digit)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.branchCode}
                      onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                      placeholder="Misal: 601601"
                    />
                  </div>

                  {/* Kode Cabang */}
                  <div className="form-field">
                    <label className="form-label">Kode Cabang</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.kodeCabang}
                      onChange={(e) => setFormData({ ...formData, kodeCabang: e.target.value.toUpperCase() })}
                      placeholder="Misal: WMD, WPD"
                    />
                  </div>

                  {/* Nama Outlet */}
                  <div className="form-field" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">
                      Nama Outlet / Kanwil <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.namaOutlet}
                      onChange={(e) => setFormData({ ...formData, namaOutlet: e.target.value, keterangan: e.target.value })}
                      placeholder="Misal: WILAYAH 01 - MEDAN"
                    />
                  </div>

                  {/* Status Outlet */}
                  <div className="form-field">
                    <label className="form-label">Status Outlet</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.statusOutlet}
                      onChange={(e) => setFormData({ ...formData, statusOutlet: e.target.value.toUpperCase() })}
                      placeholder="KANWIL"
                    />
                  </div>

                  {/* Kode Pos */}
                  <div className="form-field">
                    <label className="form-label">Kode Pos</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.kodePos}
                      onChange={(e) => setFormData({ ...formData, kodePos: e.target.value })}
                      placeholder="Misal: 20151"
                    />
                  </div>

                  {/* Alamat */}
                  <div className="form-field" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Alamat Lengkap</label>
                    <textarea
                      rows={2}
                      className="form-control"
                      style={{ resize: 'vertical' }}
                      value={formData.alamat}
                      onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                      placeholder="Misal: JL. PEMUDA NO. 12, LANTAI IV MEDAN"
                    />
                  </div>

                  {/* Kelurahan */}
                  <div className="form-field">
                    <label className="form-label">Kelurahan</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.kelurahan}
                      onChange={(e) => setFormData({ ...formData, kelurahan: e.target.value })}
                      placeholder="Misal: Aur"
                    />
                  </div>

                  {/* Kecamatan */}
                  <div className="form-field">
                    <label className="form-label">Kecamatan</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.kecamatan}
                      onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
                      placeholder="Misal: Medan Maimun"
                    />
                  </div>

                  {/* Dati II */}
                  <div className="form-field">
                    <label className="form-label">Dati II (Kota / Kabupaten)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.dati2}
                      onChange={(e) => setFormData({ ...formData, dati2: e.target.value })}
                      placeholder="Misal: Kota Medan"
                    />
                  </div>

                  {/* Provinsi */}
                  <div className="form-field">
                    <label className="form-label">Provinsi</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.provinsi}
                      onChange={(e) => setFormData({ ...formData, provinsi: e.target.value })}
                      placeholder="Misal: Sumatera Utara"
                    />
                  </div>

                  {/* Telp */}
                  <div className="form-field" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Nomor Telepon</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.telp}
                      onChange={(e) => setFormData({ ...formData, telp: e.target.value })}
                      placeholder="Misal: 061-4538166"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setModalMode(null)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {modalMode === 'create' ? 'Tambah Data' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
    </DialogPanel>
      )}

      {/* MODAL: Detail View */}
      {modalMode === 'detail' && (
        <DialogPanel onClose={() => setModalMode(null)} closableOnOutside={false} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <Building2 size={18} color="#405189" />
                {formData.namaOutlet}
              </h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalMode(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ fontSize: '0.8rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Wilayah</span>
                  <span className="badge badge-level1" style={{ fontSize: '0.75rem' }}>{formData.wilayah}</span>
                </div>
                <div>
                  <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Kode Cabang</span>
                  <span className="badge badge-match" style={{ fontSize: '0.75rem' }}>{formData.kodeCabang || '-'}</span>
                </div>
                <div>
                  <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Sandi Cabang</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{formData.sandiCabang || '-'}</strong>
                </div>
                <div>
                  <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Branch Code</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{formData.branchCode || '-'}</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e9ebec', paddingTop: '0.65rem' }}>
                <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Alamat Lengkap</span>
                <div style={{ color: '#212529', fontWeight: 500, marginTop: '0.2rem' }}>{formData.alamat || '-'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Kelurahan / Kecamatan</span>
                  <div>{formData.kelurahan || '-'} / {formData.kecamatan || '-'}</div>
                </div>
                <div>
                  <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Kode Pos</span>
                  <span className="code-cell" style={{ background: '#e8f7f5', color: '#0ab39c', fontWeight: 700 }}>
                    {formData.kodePos || '-'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Kota / Dati II</span>
                  <div>{formData.dati2 || '-'}</div>
                </div>
                <div>
                  <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Provinsi</span>
                  <div>{formData.provinsi || '-'}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e9ebec', paddingTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Phone size={14} style={{ color: '#878a99' }} />
                <span>Telepon: <strong>{formData.telp || '-'}</strong></span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setModalMode(null)}
              >
                Tutup
              </button>
            </div>
    </DialogPanel>
      )}

      {/* MODAL: Konfirmasi Hapus */}
      {deleteTargetIndex !== null && (
        <DialogPanel onClose={() => setDeleteTargetIndex(null)} closableOnOutside={false} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <Trash2 size={18} color="#f06548" />
                Hapus Data Wilayah Ini?
              </h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteTargetIndex(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '45px',
                  height: '45px',
                  borderRadius: '50%',
                  background: 'rgba(240, 101, 72, 0.1)',
                  color: '#f06548',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                }}
              >
                <Trash2 size={22} />
              </div>
              <p style={{ fontSize: '0.8rem', color: '#878a99', margin: 0 }}>
                Data <strong style={{ color: '#212529' }}>{settings[deleteTargetIndex]?.namaOutlet}</strong> akan dihapus dari konfigurasi wilayah dan database.
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

      {/* MODAL: Konfirmasi Reset Standar */}
      {showResetConfirm && (
        <DialogPanel onClose={() => setShowResetConfirm(false)} closableOnOutside={false} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <RefreshCw size={18} color="#d68b0c" />
                Reset ke 17 Wilayah Standar?
              </h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowResetConfirm(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '45px',
                  height: '45px',
                  borderRadius: '50%',
                  background: 'rgba(247, 184, 75, 0.15)',
                  color: '#d68b0c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                }}
              >
                <RefreshCw size={22} />
              </div>
              <p style={{ fontSize: '0.8rem', color: '#878a99', margin: 0 }}>
                Tindakan ini akan memulihkan konfigurasi lengkap 17 Kantor Wilayah (Wilayah 01 s/d Wilayah 18) sesuai master data resmi dan memperbarui database.
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
                onClick={handleResetToDefault}
              >
                Ya, Reset Standar
              </button>
            </div>
    </DialogPanel>
      )}
    </div>
  );
};
