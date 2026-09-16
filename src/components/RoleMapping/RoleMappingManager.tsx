import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Users,
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
  UserCheck,
  UserPlus,
  ShieldCheck,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getItem, setItem } from '../../utils/storage';

export interface RoleMappingRecord {
  id?: string;
  organisasiTujuan: string;
  qrsCabsal: number;    // QRS_CABSAL -> Sales Cabang
  qrsCabapv1: number;   // QRS_CABAPV1 -> Verifikator Cabang
  qrsCabapv2: number;   // QRS_CABAPV2 -> Penyetuju Cabang
  grandTotal: number;
  keterangan?: string;
}

export const DEFAULT_ROLE_MAPPING_DATA: RoleMappingRecord[] = [
  {
    organisasiTujuan: 'AMBON BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'AMBON BRANCH OFFICE - BURU SELATAN SUB BRANCH',
    qrsCabsal: 1,
    qrsCabapv1: 0,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'AMBON BRANCH OFFICE - KEPULAUAN ARU SUB BRANCH',
    qrsCabsal: 1,
    qrsCabapv1: 0,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'AMBON BRANCH OFFICE - MALUKU TENGGARA SUB BRANCH',
    qrsCabsal: 1,
    qrsCabapv1: 0,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'BALIKPAPAN BRANCH OFFICE',
    qrsCabsal: 2,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 4,
  },
  {
    organisasiTujuan: 'BANDUNG ASIA AFRIKA BRANCH OFFICE',
    qrsCabsal: 2,
    qrsCabapv1: 2,
    qrsCabapv2: 2,
    grandTotal: 6,
  },
  {
    organisasiTujuan: 'DENPASAR RENON BRANCH OFFICE',
    qrsCabsal: 2,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 4,
  },
  {
    organisasiTujuan: 'JAKARTA THAMRIN BRANCH OFFICE',
    qrsCabsal: 3,
    qrsCabapv1: 2,
    qrsCabapv2: 2,
    grandTotal: 7,
  },
  {
    organisasiTujuan: 'MEDAN BALAI KOTA BRANCH OFFICE',
    qrsCabsal: 2,
    qrsCabapv1: 2,
    qrsCabapv2: 1,
    grandTotal: 5,
  },
  {
    organisasiTujuan: 'SURABAYA BASUKI RAHMAT BRANCH OFFICE',
    qrsCabsal: 3,
    qrsCabapv1: 2,
    qrsCabapv2: 2,
    grandTotal: 7,
  },
];

export const RoleMappingManager: React.FC = () => {
  const [roleList, setRoleList] = useState<RoleMappingRecord[]>(DEFAULT_ROLE_MAPPING_DATA);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination states (Default 10)
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(10);

  // Modals state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const [formData, setFormData] = useState<RoleMappingRecord>({
    organisasiTujuan: '',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted Role Mapping data on mount from IndexedDB
  useEffect(() => {
    let isMounted = true;
    const loadSaved = async () => {
      try {
        const saved = await getItem<RoleMappingRecord[]>('role_mapping_data');
        if (saved && Array.isArray(saved) && isMounted) {
          setRoleList(saved);
        }
      } catch (err) {
        console.warn('Error loading Role Mapping data:', err);
      }
    };
    loadSaved();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save to IndexedDB
  const handleSaveData = async (listToSave = roleList) => {
    setErrorMsg(null);
    try {
      await setItem('role_mapping_data', listToSave);
      setSuccessMsg(`Berhasil menyimpan ${listToSave.length.toLocaleString('id-ID')} data mapping role!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan data mapping role');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    let totalCabsal = 0;
    let totalCabapv1 = 0;
    let totalCabapv2 = 0;
    let totalGrand = 0;

    roleList.forEach((r) => {
      totalCabsal += Number(r.qrsCabsal) || 0;
      totalCabapv1 += Number(r.qrsCabapv1) || 0;
      totalCabapv2 += Number(r.qrsCabapv2) || 0;
      totalGrand += Number(r.grandTotal) || 0;
    });

    return {
      totalOrganisasi: roleList.length,
      totalCabsal,
      totalCabapv1,
      totalCabapv2,
      totalGrand,
    };
  }, [roleList]);

  // Filtered Role List
  const filteredList = useMemo(() => {
    return roleList.filter((r) => {
      if (filterRole === 'HAS_APV1' && (!r.qrsCabapv1 || r.qrsCabapv1 === 0)) return false;
      if (filterRole === 'HAS_APV2' && (!r.qrsCabapv2 || r.qrsCabapv2 === 0)) return false;
      if (filterRole === 'HAS_SALES' && (!r.qrsCabsal || r.qrsCabsal === 0)) return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.organisasiTujuan?.toLowerCase().includes(q) ||
        String(r.qrsCabsal).includes(q) ||
        String(r.qrsCabapv1).includes(q) ||
        String(r.qrsCabapv2).includes(q)
      );
    });
  }, [roleList, filterRole, searchTerm]);

  // Pagination Calculations
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredList.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'ALL') return filteredList;
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  // Helper for compact sliding pagination
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

  // Import Excel Handler
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
          alert('Berkas Excel kosong atau tidak terbaca.');
          return;
        }

        const imported: RoleMappingRecord[] = rawJson.map((row: any) => {
          const org = String(
            row['ORGANISASI TUJUAN'] ||
            row['ORGANISASI'] ||
            row['Organisasi Tujuan'] ||
            row['Nama Cabang / Unit'] ||
            row['Unit Kerja'] ||
            ''
          ).trim();

          const cabsal = parseInt(String(row['QRS_CABSAL'] || row['Sales Cabang'] || row['CABSAL'] || 0), 10) || 0;
          const cabapv1 = parseInt(String(row['QRS_CABAPV1'] || row['Verifikator Cabang'] || row['CABAPV1'] || 0), 10) || 0;
          const cabapv2 = parseInt(String(row['QRS_CABAPV2'] || row['Penyetuju Cabang'] || row['CABAPV2'] || 0), 10) || 0;
          const rawTotal = parseInt(String(row['Grand Total'] || row['GRAND TOTAL'] || row['Total'] || 0), 10);
          const calculatedTotal = cabsal + cabapv1 + cabapv2;

          return {
            organisasiTujuan: org,
            qrsCabsal: cabsal,
            qrsCabapv1: cabapv1,
            qrsCabapv2: cabapv2,
            grandTotal: rawTotal > 0 ? rawTotal : calculatedTotal,
          };
        }).filter((item) => Boolean(item.organisasiTujuan));

        if (imported.length === 0) {
          alert('Tidak ada baris data organisasi valid yang berhasil dibaca dari berkas Excel.');
          return;
        }

        setRoleList(imported);
        handleSaveData(imported);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSuccessMsg(`Berhasil mengimpor ${imported.length.toLocaleString('id-ID')} baris data mapping role!`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err: any) {
        alert('Gagal membaca format file Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Download Template Excel
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'ORGANISASI TUJUAN': 'AMBON BRANCH OFFICE',
        'QRS_CABSAL': 1,
        'QRS_CABAPV1': 1,
        'QRS_CABAPV2': 1,
        'Grand Total': 3,
      },
      {
        'ORGANISASI TUJUAN': 'AMBON BRANCH OFFICE - BURU SELATAN SUB BRANCH',
        'QRS_CABSAL': 1,
        'QRS_CABAPV1': '',
        'QRS_CABAPV2': 1,
        'Grand Total': 2,
      },
      {
        'ORGANISASI TUJUAN': 'AMBON BRANCH OFFICE - KEPULAUAN ARU SUB BRANCH',
        'QRS_CABSAL': 1,
        'QRS_CABAPV1': '',
        'QRS_CABAPV2': 1,
        'Grand Total': 2,
      },
      {
        'ORGANISASI TUJUAN': 'AMBON BRANCH OFFICE - MALUKU TENGGARA SUB BRANCH',
        'QRS_CABSAL': 1,
        'QRS_CABAPV1': '',
        'QRS_CABAPV2': 1,
        'Grand Total': 2,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapping_Role');
    XLSX.writeFile(wb, 'Template_Upload_Mapping_Role.xlsx');
  };

  // Export to Excel
  const handleExport = () => {
    const exportData = filteredList.length > 0 ? filteredList : roleList;
    const ws = XLSX.utils.json_to_sheet(
      exportData.map((r) => ({
        'ORGANISASI TUJUAN': r.organisasiTujuan,
        'QRS_CABSAL': r.qrsCabsal || '',
        'QRS_CABAPV1': r.qrsCabapv1 || '',
        'QRS_CABAPV2': r.qrsCabapv2 || '',
        'Grand Total': r.grandTotal,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapping_Role');
    XLSX.writeFile(wb, `Data_Mapping_Role_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      organisasiTujuan: '',
      qrsCabsal: 1,
      qrsCabapv1: 1,
      qrsCabapv2: 1,
      grandTotal: 3,
    });
    setEditingIndex(null);
    setModalMode('create');
  };

  // Open Edit Modal
  const handleOpenEdit = (index: number) => {
    const item = roleList[index];
    setFormData({ ...item });
    setEditingIndex(index);
    setModalMode('edit');
  };

  // Open Detail Modal
  const handleOpenDetailModal = (index: number) => {
    const item = roleList[index];
    setFormData({ ...item });
    setEditingIndex(index);
    setModalMode('detail');
  };

  // Submit Modal Form (Create / Edit)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.organisasiTujuan.trim()) {
      alert('Nama Organisasi Tujuan wajib diisi!');
      return;
    }

    const cabsal = Number(formData.qrsCabsal) || 0;
    const cabapv1 = Number(formData.qrsCabapv1) || 0;
    const cabapv2 = Number(formData.qrsCabapv2) || 0;
    const grandTotal = cabsal + cabapv1 + cabapv2;

    const normalizedItem: RoleMappingRecord = {
      ...formData,
      organisasiTujuan: formData.organisasiTujuan.trim().toUpperCase(),
      qrsCabsal: cabsal,
      qrsCabapv1: cabapv1,
      qrsCabapv2: cabapv2,
      grandTotal: grandTotal,
    };

    let updatedList: RoleMappingRecord[];
    if (modalMode === 'edit' && editingIndex !== null) {
      updatedList = roleList.map((item, i) => (i === editingIndex ? normalizedItem : item));
    } else {
      updatedList = [normalizedItem, ...roleList];
    }

    setRoleList(updatedList);
    setModalMode(null);
    handleSaveData(updatedList);
  };

  // Delete Record
  const handleConfirmDelete = () => {
    if (deleteTargetIndex === null) return;
    const updated = roleList.filter((_, idx) => idx !== deleteTargetIndex);
    setRoleList(updated);
    setDeleteTargetIndex(null);
    handleSaveData(updated);
  };

  // Reset / Clear all Records
  const handleResetAll = async () => {
    setRoleList([]);
    setShowResetConfirm(false);
    await setItem('role_mapping_data', []);
    setSuccessMsg('Seluruh data mapping role berhasil dikosongkan!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Top Header Card matching Wilayah, PTEN & Cabang */}
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
              background: 'linear-gradient(135deg, rgba(64, 81, 137, 0.15) 0%, rgba(41, 156, 219, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#405189',
              border: '1px solid rgba(64, 81, 137, 0.3)',
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#212529', margin: 0 }}>
              Master Mapping Role Organisasi
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#878a99', margin: '0.2rem 0 0' }}>
              Kelola alokasi role per Organisasi Tujuan (Sales Cabang, Verifikator Cabang, Penyetuju Cabang).
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls"
            onChange={handleImportExcel}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.95rem',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            <Upload size={14} />
            <span>Impor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExport}
            disabled={roleList.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              fontSize: '0.8rem',
            }}
          >
            <Download size={14} />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleDownloadTemplate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
            }}
          >
            <Download size={13} />
            <span>Template Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowResetConfirm(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              color: '#f06548',
              borderColor: 'rgba(240, 101, 72, 0.3)',
            }}
            title="Kosongkan seluruh data Mapping Role"
          >
            <RefreshCw size={13} />
            <span>Reset Data</span>
          </button>

          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={handleOpenCreate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.95rem',
              fontSize: '0.8rem',
              background: '#0ab39c',
              borderColor: '#0ab39c',
              color: '#ffffff',
            }}
          >
            <Plus size={14} />
            <span>Tambah Data</span>
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {successMsg && (
        <div
          style={{
            background: '#e8f7f5',
            color: '#0ab39c',
            border: '1px solid #b7ebe4',
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
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ab39c' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: '#fff0ee',
            color: '#f06548',
            border: '1px solid #fedcd6',
            padding: '0.75rem 1.25rem',
            borderRadius: '6px',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f06548' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 4 Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Card 1: Total Organisasi */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            border: '1px solid #e9ebec',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#878a99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Organisasi Tujuan
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#212529', marginTop: '0.25rem' }}>
              {stats.totalOrganisasi.toLocaleString('id-ID')}
            </div>
          </div>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              background: 'rgba(64, 81, 137, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#405189',
            }}
          >
            <Building2 size={22} />
          </div>
        </div>

        {/* Card 2: Total Sales Cabang (QRS_CABSAL) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            border: '1px solid #e9ebec',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#878a99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Sales Cabang (CABSAL)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0ab39c', marginTop: '0.25rem' }}>
              {stats.totalCabsal.toLocaleString('id-ID')}
            </div>
          </div>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              background: 'rgba(10, 179, 156, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0ab39c',
            }}
          >
            <UserPlus size={22} />
          </div>
        </div>

        {/* Card 3: Total Verifikator Cabang (QRS_CABAPV1) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            border: '1px solid #e9ebec',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#878a99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Verifikator (CABAPV1)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#299cdb', marginTop: '0.25rem' }}>
              {stats.totalCabapv1.toLocaleString('id-ID')}
            </div>
          </div>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              background: 'rgba(41, 156, 219, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#299cdb',
            }}
          >
            <UserCheck size={22} />
          </div>
        </div>

        {/* Card 4: Total Penyetuju Cabang (QRS_CABAPV2) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            border: '1px solid #e9ebec',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#878a99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Penyetuju (CABAPV2)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#d68b0c', marginTop: '0.25rem' }}>
              {stats.totalCabapv2.toLocaleString('id-ID')}
            </div>
          </div>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              background: 'rgba(247, 184, 75, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d68b0c',
            }}
          >
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      {roleList.length === 0 ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '8px',
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
            <Users size={28} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#212529', margin: '0 0 0.4rem' }}>
              Belum Ada Data Mapping Role Terunggah
            </h4>
            <p style={{ fontSize: '0.82rem', color: '#878a99', maxWidth: '460px', margin: 0, lineHeight: 1.5 }}>
              Silakan unggah berkas Excel data mapping role (ORGANISASI TUJUAN, QRS_CABSAL, QRS_CABAPV1, QRS_CABAPV2, Grand Total).
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.25rem' }}
            >
              <Upload size={16} />
              <span>Pilih Berkas Excel Mapping Role</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDownloadTemplate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.25rem' }}
            >
              <Download size={16} />
              <span>Download Template Excel</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e9ebec',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            padding: '1.15rem 1.35rem',
          }}
        >
          {/* Filter Toolbar without top counter */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  size={15}
                  style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#878a99' }}
                />
                <input
                  type="text"
                  placeholder="Cari Organisasi Tujuan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem 0.45rem 2.1rem',
                    fontSize: '0.8rem',
                    borderRadius: '5px',
                    border: '1px solid #ced4da',
                    background: '#ffffff',
                  }}
                />
              </div>

              {/* Role Type Filter */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: '5px',
                  border: '1px solid #ced4da',
                  background: '#ffffff',
                  color: '#495057',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">Semua Role</option>
                <option value="HAS_SALES">Memiliki Sales Cabang (CABSAL)</option>
                <option value="HAS_APV1">Memiliki Verifikator (CABAPV1)</option>
                <option value="HAS_APV2">Memiliki Penyetuju (CABAPV2)</option>
              </select>
            </div>

            {/* Page Size Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.78rem', color: '#878a99' }}>Tampilkan:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                  setPageSize(val);
                  setPage(1);
                }}
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.78rem',
                  borderRadius: '4px',
                  border: '1px solid #ced4da',
                  background: '#ffffff',
                  color: '#495057',
                  cursor: 'pointer',
                }}
              >
                <option value={10}>10 Baris</option>
                <option value={25}>25 Baris</option>
                <option value={50}>50 Baris</option>
                <option value={100}>100 Baris</option>
                <option value="ALL">Lihat Semua ({filteredList.length})</option>
              </select>
            </div>
          </div>

          {/* Table Role Mapping */}
          <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto', maxHeight: '580px' }}>
            <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                  <th>ORGANISASI TUJUAN</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>
                    <div>QRS_CABSAL</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#878a99' }}>Sales Cabang</div>
                  </th>
                  <th style={{ width: '150px', textAlign: 'center' }}>
                    <div>QRS_CABAPV1</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#878a99' }}>Verifikator Cabang</div>
                  </th>
                  <th style={{ width: '150px', textAlign: 'center' }}>
                    <div>QRS_CABAPV2</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#878a99' }}>Penyetuju Cabang</div>
                  </th>
                  <th style={{ width: '120px', textAlign: 'center' }}>
                    <div>Grand Total</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#878a99' }}>Total Role</div>
                  </th>
                  <th style={{ width: '95px', textAlign: 'center' }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                      Tidak ada data mapping role yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((item, idx) => {
                    const originalIdx = roleList.indexOf(item);
                    const displayRowNo =
                      pageSize === 'ALL'
                        ? idx + 1
                        : (page - 1) * (pageSize as number) + idx + 1;

                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                        <td style={{ textAlign: 'center', color: '#878a99' }}>{displayRowNo}</td>
                        <td style={{ fontWeight: 600, color: '#212529' }}>{item.organisasiTujuan}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.6rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              background: item.qrsCabsal > 0 ? 'rgba(10, 179, 156, 0.1)' : '#f3f6f9',
                              color: item.qrsCabsal > 0 ? '#0ab39c' : '#adb5bd',
                            }}
                          >
                            {item.qrsCabsal > 0 ? item.qrsCabsal : '-'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.6rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              background: item.qrsCabapv1 > 0 ? 'rgba(41, 156, 219, 0.1)' : '#f3f6f9',
                              color: item.qrsCabapv1 > 0 ? '#299cdb' : '#adb5bd',
                            }}
                          >
                            {item.qrsCabapv1 > 0 ? item.qrsCabapv1 : '-'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.6rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              background: item.qrsCabapv2 > 0 ? 'rgba(247, 184, 75, 0.15)' : '#f3f6f9',
                              color: item.qrsCabapv2 > 0 ? '#d68b0c' : '#adb5bd',
                            }}
                          >
                            {item.qrsCabapv2 > 0 ? item.qrsCabapv2 : '-'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="code-cell" style={{ fontWeight: 800, color: '#405189', background: '#eef0f7', padding: '0.2rem 0.65rem' }}>
                            {item.grandTotal}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(originalIdx)}
                              title="Lihat Detail Mapping"
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
                              title="Edit Mapping Role"
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
                              title="Hapus Mapping Role"
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

          {/* Pagination Footer with Compact Sliding Range */}
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

                {getPaginationRange(page, totalPages).map((p, idx) => {
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
                })}

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
              maxWidth: '540px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              border: '1px solid #e9ebec',
              overflow: 'hidden',
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
                <Users size={18} color="#405189" />
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#212529' }}>
                  {modalMode === 'create' && 'Tambah Mapping Role Baru'}
                  {modalMode === 'edit' && 'Edit Mapping Role'}
                  {modalMode === 'detail' && 'Detail Mapping Role'}
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

            <form onSubmit={handleSubmitForm} style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                  ORGANISASI TUJUAN <span style={{ color: '#f06548' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={modalMode === 'detail'}
                  placeholder="Contoh: AMBON BRANCH OFFICE"
                  value={formData.organisasiTujuan}
                  onChange={(e) => setFormData({ ...formData, organisasiTujuan: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.82rem',
                    borderRadius: '5px',
                    border: '1px solid #ced4da',
                    background: modalMode === 'detail' ? '#f8f9fa' : '#ffffff',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#0ab39c', marginBottom: '0.35rem' }}>
                    QRS_CABSAL
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 400, color: '#878a99' }}>Sales Cabang</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={modalMode === 'detail'}
                    value={formData.qrsCabsal}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      const next = { ...formData, qrsCabsal: val };
                      next.grandTotal = next.qrsCabsal + next.qrsCabapv1 + next.qrsCabapv2;
                      setFormData(next);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.82rem',
                      borderRadius: '5px',
                      border: '1px solid #ced4da',
                      background: modalMode === 'detail' ? '#f8f9fa' : '#ffffff',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#299cdb', marginBottom: '0.35rem' }}>
                    QRS_CABAPV1
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 400, color: '#878a99' }}>Verifikator</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={modalMode === 'detail'}
                    value={formData.qrsCabapv1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      const next = { ...formData, qrsCabapv1: val };
                      next.grandTotal = next.qrsCabsal + next.qrsCabapv1 + next.qrsCabapv2;
                      setFormData(next);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.82rem',
                      borderRadius: '5px',
                      border: '1px solid #ced4da',
                      background: modalMode === 'detail' ? '#f8f9fa' : '#ffffff',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#d68b0c', marginBottom: '0.35rem' }}>
                    QRS_CABAPV2
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 400, color: '#878a99' }}>Penyetuju</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={modalMode === 'detail'}
                    value={formData.qrsCabapv2}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      const next = { ...formData, qrsCabapv2: val };
                      next.grandTotal = next.qrsCabsal + next.qrsCabapv1 + next.qrsCabapv2;
                      setFormData(next);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.82rem',
                      borderRadius: '5px',
                      border: '1px solid #ced4da',
                      background: modalMode === 'detail' ? '#f8f9fa' : '#ffffff',
                    }}
                  />
                </div>
              </div>

              {/* Grand Total Summary Box */}
              <div
                style={{
                  background: '#f3f6f9',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid #e9ebec',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#495057' }}>Grand Total Alokasi:</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#405189' }}>
                  {(Number(formData.qrsCabsal) || 0) + (Number(formData.qrsCabapv1) || 0) + (Number(formData.qrsCabapv2) || 0)} Role
                </span>
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
                    {modalMode === 'create' ? 'Tambah Mapping' : 'Simpan Perubahan'}
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
              Hapus Data Mapping Role?
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#878a99', margin: '0 0 1.25rem' }}>
              Apakah Anda yakin ingin menghapus mapping role untuk organisasi{' '}
              <strong>{roleList[deleteTargetIndex]?.organisasiTujuan}</strong>?
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
              Kosongkan Seluruh Mapping Role?
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#878a99', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              Seluruh data mapping role organisasi akan dihapus permanen agar Anda dapat mengimpor berkas Excel baru dari awal.
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
                onClick={handleResetAll}
                style={{ background: '#f06548', color: '#ffffff', border: 'none', padding: '0.45rem 1rem' }}
              >
                Ya, Hapus Semua Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
