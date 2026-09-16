import React, { useState, useMemo, useRef } from 'react';
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
import * as XLSX from 'xlsx';
import type { MasterRow, MasterHealth, WilayahSetting } from '../../types';
import { parseExcelFile, validateMasterHeaders, downloadMasterTemplate } from '../../utils/excel';
import { MasterHealthCard } from './MasterHealthCard';

interface CabangManagerProps {
  masterRows: MasterRow[];
  onMasterLoaded: (rows: MasterRow[], fileName: string, mode?: 'replace' | 'append') => void;
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
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'health'>('list');
  const [searchTerm, setSearchTerm] = useState<string>('');
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
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();

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
  }, [masterRows, searchTerm, searchBy, selectedWilayah]);

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

  // Export Excel handler
  const handleExportExcel = () => {
    const exportData = masterRows.map((r) => ({
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

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Master_Cabang');
    XLSX.writeFile(wb, `Data_Master_Cabang_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
      alert('Nama Outlet dan KODE POS wajib diisi!');
      return;
    }

    let updatedList: MasterRow[];
    if (modalMode === 'edit' && editingIndex !== null) {
      updatedList = masterRows.map((item, i) => (i === editingIndex ? formData : item));
    } else {
      updatedList = [formData, ...masterRows];
    }

    onMasterLoaded(updatedList, 'Master_Data_Manual.xlsx', 'replace');
    setModalMode(null);
    setSuccessMsg('Data master cabang berhasil diperbarui.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Delete Cabang record
  const handleConfirmDelete = () => {
    if (deleteTargetIndex === null) return;
    const updated = masterRows.filter((_, idx) => idx !== deleteTargetIndex);
    onMasterLoaded(updated, 'Master_Data_Updated.xlsx', 'replace');
    setDeleteTargetIndex(null);
    setSuccessMsg('Data cabang berhasil dihapus.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Top Header Card matching Wilayah & PTEN */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          background: '#ffffff',
          padding: '1.15rem 1.4rem',
          borderRadius: '8px',
          border: '1px solid #e9ebec',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(64, 81, 137, 0.15) 0%, rgba(10, 179, 156, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#405189',
              border: '1px solid rgba(64, 81, 137, 0.2)',
            }}
          >
            <Store size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#212529', margin: 0 }}>
              Master Data Cabang & Outlet
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#878a99', margin: '0.2rem 0 0' }}>
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
            <div
              style={{
                display: 'inline-flex',
                background: '#f3f6f9',
                padding: '3px',
                borderRadius: '6px',
                border: '1px solid #e9ebec',
                marginRight: '0.35rem',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveSubTab('list')}
                style={{
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: activeSubTab === 'list' ? 700 : 500,
                  color: activeSubTab === 'list' ? '#405189' : '#878a99',
                  background: activeSubTab === 'list' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: activeSubTab === 'list' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Daftar Cabang
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('health')}
                style={{
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: activeSubTab === 'health' ? 700 : 500,
                  color: activeSubTab === 'health' ? '#405189' : '#878a99',
                  background: activeSubTab === 'health' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: activeSubTab === 'health' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <ShieldAlert size={13} />
                <span>Audit & Multi-Outlet</span>
                {masterHealth.multiOutletCount > 0 && (
                  <span
                    style={{
                      background: '#f06548',
                      color: '#ffffff',
                      padding: '0.05rem 0.35rem',
                      borderRadius: '10px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                    }}
                  >
                    {masterHealth.multiOutletCount}
                  </span>
                )}
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Import berkas Excel data master cabang"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
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
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
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
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
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
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f06548', borderColor: 'rgba(240, 101, 72, 0.3)' }}
            >
              <RefreshCw size={13} />
              <span>Reset Cabang</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenCreate}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={14} />
            <span>Tambah Cabang</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards matching Wilayah & PTEN */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <div className="glass-card" style={{ padding: '0.9rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(64, 81, 137, 0.1)',
              color: '#405189',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Cabang & Outlet
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#212529' }}>
              {masterRows.length.toLocaleString('id-ID')} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#878a99' }}>Cabang</span>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '0.9rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(10, 179, 156, 0.1)',
              color: '#0ab39c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600, textTransform: 'uppercase' }}>
              Cakupan Wilayah
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#212529' }}>
              {wilayahList.length} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#878a99' }}>Kanwil</span>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '0.9rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(41, 156, 219, 0.1)',
              color: '#299cdb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MapPin size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600, textTransform: 'uppercase' }}>
              Cakupan Kota / Dati II
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#212529' }}>
              {dati2List.length} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#878a99' }}>Kota/Kab</span>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '0.9rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: completenessStats.isAllComplete ? 'rgba(10, 179, 156, 0.12)' : 'rgba(240, 101, 72, 0.12)',
              color: completenessStats.isAllComplete ? '#0ab39c' : '#f06548',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {completenessStats.isAllComplete ? <Sparkles size={20} /> : <AlertCircle size={20} />}
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600, textTransform: 'uppercase' }}>
              Status Kelengkapan Data
            </div>
            {completenessStats.isAllComplete ? (
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0ab39c', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={14} />
                <span>Lengkap (100%)</span>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f06548', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AlertCircle size={14} />
                  <span>{completenessStats.incomplete.toLocaleString('id-ID')} Data Belum Lengkap ({completenessStats.percentage}%)</span>
                </div>
              </div>
            )}
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
              background: 'rgba(64, 81, 137, 0.08)',
              color: '#405189',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Store size={28} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#212529', margin: '0 0 0.4rem' }}>
              Belum Ada Data Master Cabang
            </h4>
            <p style={{ fontSize: '0.82rem', color: '#878a99', maxWidth: '440px', margin: 0, lineHeight: 1.5 }}>
              Silakan impor berkas Excel data cabang atau tambah data baru untuk memulai pencocokan data otomatis.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.25rem' }}
          >
            <Upload size={16} />
            <span>Pilih Berkas Master Excel</span>
          </button>
        </div>
      ) : (
        /* Table View */
        <div className="glass-card" style={{ padding: '1.15rem 1.35rem' }}>
          {/* Filter & Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '320px', maxWidth: '750px', flexWrap: 'wrap' }}>
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
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#878a99',
                  }}
                />
                <input
                  type="text"
                  placeholder="Cari data cabang, alamat, kode pos..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem 0.45rem 2.1rem',
                    fontSize: '0.8rem',
                    borderRadius: '5px',
                    border: '1px solid #ced4da',
                    outline: 'none',
                    background: '#ffffff',
                  }}
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
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Filter Wilayah */}
              <select
                value={selectedWilayah}
                onChange={(e) => {
                  setSelectedWilayah(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.8rem',
                  borderRadius: '5px',
                  border: '1px solid #ced4da',
                  outline: 'none',
                  background: '#ffffff',
                  color: '#495057',
                  cursor: 'pointer',
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#878a99' }}>
                <span>Tampilkan:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                    setPageSize(val);
                    setPage(1);
                  }}
                  style={{
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.78rem',
                    borderRadius: '4px',
                    border: '1px solid #ced4da',
                    outline: 'none',
                    background: '#ffffff',
                    color: '#495057',
                    cursor: 'pointer',
                  }}
                >
                  <option value={10}>10 Baris</option>
                  <option value={25}>25 Baris</option>
                  <option value={50}>50 Baris</option>
                  <option value={100}>100 Baris</option>
                  <option value="ALL">Lihat Semua ({filteredRows.length})</option>
                </select>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#878a99' }}>
                Menampilkan{' '}
                <strong style={{ color: '#212529' }}>
                  {filteredRows.length === 0
                    ? 0
                    : pageSize === 'ALL'
                    ? 1
                    : (page - 1) * (pageSize as number) + 1}
                </strong>{' '}
                -{' '}
                <strong style={{ color: '#212529' }}>
                  {pageSize === 'ALL'
                    ? filteredRows.length
                    : Math.min(page * (pageSize as number), filteredRows.length)}
                </strong>{' '}
                dari <strong style={{ color: '#212529' }}>{filteredRows.length.toLocaleString('id-ID')}</strong> data master
              </div>
            </div>
          </div>

          {/* Table Master Cabang */}
          <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto', maxHeight: '580px' }}>
            <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '65px', textAlign: 'center' }}>Wilayah</th>
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
                  paginatedRows.map((r, idx) => {
                    const originalIdx = masterRows.indexOf(r);
                    const globalIdx = pageSize === 'ALL' ? idx + 1 : (page - 1) * (pageSize as number) + idx + 1;

                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
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
                        <td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.ALAMAT}>
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
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Master Pagination Footer */}
          {pageSize !== 'ALL' && totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid #e9ebec',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
                Halaman <strong style={{ color: '#212529' }}>{page}</strong> dari{' '}
                <strong style={{ color: '#212529' }}>{totalPages}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                >
                  <ChevronLeft size={13} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    style={{
                      minWidth: '28px',
                      height: '28px',
                      padding: '0 0.4rem',
                      fontSize: '0.74rem',
                      fontWeight: page === pageNum ? 700 : 500,
                      borderRadius: '4px',
                      border: page === pageNum ? '1px solid #405189' : '1px solid #ced4da',
                      background: page === pageNum ? '#405189' : '#ffffff',
                      color: page === pageNum ? '#ffffff' : '#495057',
                      cursor: 'pointer',
                    }}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  title="Halaman Berikutnya"
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
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
      )}

      {/* Create / Edit / Detail Modal */}
      {modalMode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              border: '1px solid #e9ebec',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '1.1rem 1.4rem',
                borderBottom: '1px solid #e9ebec',
                background: '#fafbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Store size={18} color="#405189" />
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#212529' }}>
                  {modalMode === 'create' && 'Tambah Data Master Cabang'}
                  {modalMode === 'edit' && 'Edit Data Master Cabang'}
                  {modalMode === 'detail' && 'Detail Data Master Cabang'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#878a99' }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSubmitForm}
              style={{
                padding: '1.35rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    Wilayah <span style={{ color: '#f06548' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'detail'}
                    placeholder="Contoh: W1"
                    value={formData.Wilayah || ''}
                    onChange={(e) => setFormData({ ...formData, Wilayah: e.target.value })}
                    style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ced4da' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    Sandi Cabang
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'detail'}
                    placeholder="Contoh: 601"
                    value={formData['Sandi Cabang'] || formData.Sandi || ''}
                    onChange={(e) => setFormData({ ...formData, 'Sandi Cabang': e.target.value, Sandi: e.target.value })}
                    style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ced4da' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    Branch Code
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'detail'}
                    placeholder="Contoh: 601601"
                    value={formData['Branch Code'] || ''}
                    onChange={(e) => setFormData({ ...formData, 'Branch Code': e.target.value })}
                    style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ced4da' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    Nama Outlet / Lokasi <span style={{ color: '#f06548' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'detail'}
                    placeholder="Nama Cabang / KCP / KK"
                    value={formData['Nama Outlet'] || ''}
                    onChange={(e) => setFormData({ ...formData, 'Nama Outlet': e.target.value })}
                    style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ced4da' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    Kode Cabang
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'detail'}
                    placeholder="Contoh: WMD"
                    value={formData['Kode Cabang'] || ''}
                    onChange={(e) => setFormData({ ...formData, 'Kode Cabang': e.target.value })}
                    style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ced4da' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                  ALAMAT Lengkap
                </label>
                <textarea
                  rows={2}
                  disabled={modalMode === 'detail'}
                  placeholder="Alamat jalan, gedung, nomor..."
                  value={formData.ALAMAT || ''}
                  onChange={(e) => setFormData({ ...formData, ALAMAT: e.target.value })}
                  style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ced4da', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    KODE POS <span style={{ color: '#f06548' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'detail'}
                    placeholder="Contoh: 20151"
                    value={formData['KODE POS'] || ''}
                    onChange={(e) => setFormData({ ...formData, 'KODE POS': e.target.value })}
                    style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ced4da' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    Kelurahan
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'detail'}
                    placeholder="Kelurahan"
                    value={formData.Kelurahan || ''}
                    onChange={(e) => setFormData({ ...formData, Kelurahan: e.target.value })}
                    style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ced4da' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    Kecamatan
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'detail'}
                    placeholder="Kecamatan"
                    value={formData.Kecamatan || ''}
                    onChange={(e) => setFormData({ ...formData, Kecamatan: e.target.value })}
                    style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ced4da' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    Dati II (Kota / Kabupaten)
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'detail'}
                    placeholder="Contoh: Kota Medan"
                    value={formData['Dati II'] || ''}
                    onChange={(e) => setFormData({ ...formData, 'Dati II': e.target.value })}
                    style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ced4da' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    Provinsi
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'detail'}
                    placeholder="Contoh: Sumatera Utara"
                    value={formData.Provinsi || ''}
                    onChange={(e) => setFormData({ ...formData, Provinsi: e.target.value })}
                    style={{ width: '100%', padding: '0.42rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ced4da' }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #e9ebec',
                }}
              >
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
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetIndex !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '420px',
              padding: '1.5rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={40} color="#f06548" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: '#212529' }}>
              Hapus Data Master Cabang?
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#878a99', margin: '0 0 1.25rem' }}>
              Apakah Anda yakin ingin menghapus data cabang{' '}
              <strong>{masterRows[deleteTargetIndex]?.['Nama Outlet'] || masterRows[deleteTargetIndex]?.Cabang}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setDeleteTargetIndex(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleConfirmDelete}
                style={{ background: '#f06548', color: '#ffffff', border: 'none' }}
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '440px',
              padding: '1.5rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <RefreshCw size={36} color="#f06548" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: '#212529' }}>
              Kosongkan Seluruh Data Cabang?
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#878a99', margin: '0 0 1.25rem' }}>
              Seluruh {masterRows.length.toLocaleString('id-ID')} data master cabang akan dihapus dari sesi ini.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowResetConfirm(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetMaster();
                }}
                style={{ background: '#f06548', color: '#ffffff', border: 'none' }}
              >
                Ya, Kosongkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
