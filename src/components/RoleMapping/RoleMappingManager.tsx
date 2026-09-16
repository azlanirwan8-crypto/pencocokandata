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
  ShieldCheck,
  ShieldAlert,
  GitBranch,
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
  qrsCabsal: number;    // QRS_CABSAL -> Sales Cabang (1: Aktif, 0: Tidak Aktif)
  qrsCabapv1: number;   // QRS_CABAPV1 -> Verifikator Cabang (1: Aktif, 0: Tidak Aktif)
  qrsCabapv2: number;   // QRS_CABAPV2 -> Penyetuju Cabang (1: Aktif, 0: Tidak Aktif)
  grandTotal: number;   // Grand Total -> Jumlah User/Pegawai Fisik Unik (Distinct User Count)
  keterangan?: string;
}

export const DEFAULT_ROLE_MAPPING_DATA: RoleMappingRecord[] = [
  {
    organisasiTujuan: 'AMBON BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 1,
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
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'BANDUNG ASIA AFRIKA BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'BANJAR BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'DENPASAR RENON BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'DENPASAR RENON BRANCH OFFICE - GIANYAR SUB BRANCH',
    qrsCabsal: 1,
    qrsCabapv1: 0,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'JAKARTA THAMRIN BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'MEDAN BALAI KOTA BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'SURABAYA BASUKI RAHMAT BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
];

// Helper: Deteksi tipe unit kerja (Cabang Induk vs Sub Branch / KCP)
export function getUnitCategory(orgName: string): 'KC' | 'KCP' {
  const upper = String(orgName || '').toUpperCase();
  if (upper.includes(' - ') || upper.includes('SUB BRANCH') || upper.includes('KCP')) {
    return 'KCP';
  }
  return 'KC';
}

// Helper: Evaluasi Status Segregation of Duties (SoD)
export function getSodAnalysis(record: RoleMappingRecord) {
  const gt = Number(record.grandTotal) || 0;
  const isKc = getUnitCategory(record.organisasiTujuan) === 'KC';

  if (gt >= 3) {
    return {
      level: 'IDEAL',
      badgeClass: 'badge-match',
      label: 'SoD Ideal (≥ 3 User)',
      color: '#0ab39c',
      bgColor: 'rgba(10, 179, 156, 0.1)',
      summary: 'Four-Eyes Principle Terpenuhi',
      desc: '3 Role dipegang oleh 3 pegawai fisik berbeda secara independen (Maker, Checker, Approver).',
    };
  }
  if (gt === 2) {
    return {
      level: 'DUAL',
      badgeClass: 'badge-level2',
      label: 'Dual Role (2 User)',
      color: '#299cdb',
      bgColor: 'rgba(41, 156, 219, 0.1)',
      summary: isKc ? 'Ada 1 User Merangkap 2 Role' : 'Maker & Approver Terpisah',
      desc: isKc
        ? 'Terdapat 2 orang pegawai di Cabang Induk (1 staf independen, 1 pejabat merangkap Checker + Approver).'
        : 'Di Sub Branch / KCP, peran Sales (Maker) dan Approver dipegang 2 pegawai berbeda.',
    };
  }
  return {
    level: 'SINGLE',
    badgeClass: 'badge-mismatch',
    label: 'Perangkapan Hak Akses (1 User)',
    color: '#f06548',
    bgColor: 'rgba(240, 101, 72, 0.1)',
    summary: 'Perangkapan Hak Akses (Dual/Triple Role)',
    desc: 'Seluruh role aktif dipegang oleh 1 orang pegawai yang sama (Single User ID / PIC Inisiasi Cabang).',
  };
}

// Helper: Rekomendasi Alur Wondr Merchant
export function getWondrRecommendation(record: RoleMappingRecord) {
  const isKc = getUnitCategory(record.organisasiTujuan) === 'KC';
  if (isKc) {
    return {
      tier: 'Cabang Induk: 3-Tier Standard Workflow',
      flow: 'Sales Cabang (CABSAL) ➔ Verifikator (CABAPV1) ➔ Penyetuju (CABAPV2)',
      desc: 'Langsung dipetakan ke alur onboarding standar 3-tingkat.',
    };
  }
  return {
    tier: 'Outlet/KCP: 2-Tier Sub Branch Workflow (Tanpa CABAPV1)',
    flow: 'Opsi A (Bypass): Sales ➔ Approver (CABAPV2) | Opsi B: Review ke Cabang Induk',
    desc: 'Karena tidak ada role CABAPV1, approval tahap 1 di-bypass atau diarahkan ke KC Pembina.',
  };
}

export const RoleMappingManager: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'audit'>('list');
  const [roleList, setRoleList] = useState<RoleMappingRecord[]>(DEFAULT_ROLE_MAPPING_DATA);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterUnit, setFilterUnit] = useState<string>('ALL');
  const [filterSod, setFilterSod] = useState<string>('ALL');
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
    grandTotal: 1,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted data on mount from IndexedDB
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
    let totalKc = 0;
    let totalKcp = 0;
    let totalSodIdeal = 0;
    let totalSingleUser = 0;

    roleList.forEach((r) => {
      if (r.qrsCabsal === 1) totalCabsal++;
      if (r.qrsCabapv1 === 1) totalCabapv1++;
      if (r.qrsCabapv2 === 1) totalCabapv2++;

      if (getUnitCategory(r.organisasiTujuan) === 'KC') {
        totalKc++;
      } else {
        totalKcp++;
      }

      const gt = Number(r.grandTotal) || 0;
      if (gt >= 3) totalSodIdeal++;
      if (gt === 1) totalSingleUser++;
    });

    return {
      totalOrganisasi: roleList.length,
      totalCabsal,
      totalCabapv1,
      totalCabapv2,
      totalKc,
      totalKcp,
      totalSodIdeal,
      totalSingleUser,
    };
  }, [roleList]);

  // Filtered Role List
  const filteredList = useMemo(() => {
    return roleList.filter((r) => {
      const unitType = getUnitCategory(r.organisasiTujuan);
      if (filterUnit === 'KC' && unitType !== 'KC') return false;
      if (filterUnit === 'KCP' && unitType !== 'KCP') return false;

      const gt = Number(r.grandTotal) || 0;
      if (filterSod === 'IDEAL' && gt < 3) return false;
      if (filterSod === 'DUAL' && gt !== 2) return false;
      if (filterSod === 'SINGLE' && gt !== 1) return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.organisasiTujuan?.toLowerCase().includes(q) ||
        String(r.grandTotal).includes(q)
      );
    });
  }, [roleList, filterUnit, filterSod, searchTerm]);

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

          const rawCabsal = String(row['QRS_CABSAL'] || row['Sales Cabang'] || row['CABSAL'] || '').trim();
          const rawCabapv1 = String(row['QRS_CABAPV1'] || row['Verifikator Cabang'] || row['CABAPV1'] || '').trim();
          const rawCabapv2 = String(row['QRS_CABAPV2'] || row['Penyetuju Cabang'] || row['CABAPV2'] || '').trim();
          
          // Parsing Checkbox status: 1 if non-empty / >0, 0 otherwise
          const cabsal = rawCabsal === '1' || rawCabsal.toLowerCase() === 'true' || rawCabsal.toLowerCase() === 'ya' || Number(rawCabsal) > 0 ? 1 : 0;
          const cabapv1 = rawCabapv1 === '1' || rawCabapv1.toLowerCase() === 'true' || rawCabapv1.toLowerCase() === 'ya' || Number(rawCabapv1) > 0 ? 1 : 0;
          const cabapv2 = rawCabapv2 === '1' || rawCabapv2.toLowerCase() === 'true' || rawCabapv2.toLowerCase() === 'ya' || Number(rawCabapv2) > 0 ? 1 : 0;
          
          // Distinct User Grand Total (Preserve the exact value from Excel)
          const parsedGrandTotal = parseInt(String(row['Grand Total'] || row['GRAND TOTAL'] || row['Total'] || row['Total User'] || '1'), 10);
          const grandTotal = isNaN(parsedGrandTotal) || parsedGrandTotal <= 0 ? 1 : parsedGrandTotal;

          return {
            organisasiTujuan: org,
            qrsCabsal: cabsal,
            qrsCabapv1: cabapv1,
            qrsCabapv2: cabapv2,
            grandTotal: grandTotal,
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
        'Grand Total': 1,
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
        'ORGANISASI TUJUAN': 'BALIKPAPAN BRANCH OFFICE',
        'QRS_CABSAL': 1,
        'QRS_CABAPV1': 1,
        'QRS_CABAPV2': 1,
        'Grand Total': 2,
      },
      {
        'ORGANISASI TUJUAN': 'BANJAR BRANCH OFFICE',
        'QRS_CABSAL': 1,
        'QRS_CABAPV1': 1,
        'QRS_CABAPV2': 1,
        'Grand Total': 3,
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
        'QRS_CABSAL': r.qrsCabsal === 1 ? 1 : '',
        'QRS_CABAPV1': r.qrsCabapv1 === 1 ? 1 : '',
        'QRS_CABAPV2': r.qrsCabapv2 === 1 ? 1 : '',
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
      grandTotal: 1,
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

    const normalizedItem: RoleMappingRecord = {
      ...formData,
      organisasiTujuan: formData.organisasiTujuan.trim().toUpperCase(),
      qrsCabsal: formData.qrsCabsal ? 1 : 0,
      qrsCabapv1: formData.qrsCabapv1 ? 1 : 0,
      qrsCabapv2: formData.qrsCabapv2 ? 1 : 0,
      grandTotal: Math.max(1, Number(formData.grandTotal) || 1),
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
              Master Mapping Role & Distinct User Cabang
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#878a99', margin: '0.2rem 0 0' }}>
              Kelola alokasi role per Organisasi Tujuan (Sales Cabang, Verifikator, Penyetuju) & Audit Segregation of Duties.
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
        {/* Card 1: Total Unit Kerja */}
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
              Total Unit Kerja
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#212529', marginTop: '0.25rem' }}>
              {stats.totalOrganisasi.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', marginTop: '0.2rem' }}>
              {stats.totalKc} Cabang Induk · {stats.totalKcp} Sub Branch
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

        {/* Card 2: Segregation of Duties (SoD) Ideal */}
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
              SoD Penuh (≥ 3 User)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0ab39c', marginTop: '0.25rem' }}>
              {stats.totalSodIdeal.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#0ab39c', fontWeight: 600, marginTop: '0.2rem' }}>
              Four-Eyes Terpenuhi
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
            <ShieldCheck size={22} />
          </div>
        </div>

        {/* Card 3: Perangkapan Hak Akses (1 User) */}
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
              Perangkapan Akses (1 User)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: stats.totalSingleUser > 0 ? '#f06548' : '#299cdb', marginTop: '0.25rem' }}>
              {stats.totalSingleUser.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '0.72rem', color: stats.totalSingleUser > 0 ? '#f06548' : '#878a99', marginTop: '0.2rem' }}>
              Perlu Review PIC
            </div>
          </div>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              background: stats.totalSingleUser > 0 ? 'rgba(240, 101, 72, 0.1)' : 'rgba(41, 156, 219, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: stats.totalSingleUser > 0 ? '#f06548' : '#299cdb',
            }}
          >
            <ShieldAlert size={22} />
          </div>
        </div>

        {/* Card 4: Alokasi Role Aktif */}
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
              Role Checker (APV1)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#d68b0c', marginTop: '0.25rem' }}>
              {stats.totalCabapv1.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', marginTop: '0.2rem' }}>
              Khusus Cabang Induk (KC)
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
            <UserCheck size={22} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
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
          {/* Sub-Tabs Navigation */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f3f6f9',
              padding: '3px',
              borderRadius: '6px',
              border: '1px solid #e9ebec',
              marginBottom: '1rem',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveSubTab('list')}
              style={{
                padding: '0.4rem 0.95rem',
                fontSize: '0.8rem',
                fontWeight: activeSubTab === 'list' ? 700 : 500,
                color: activeSubTab === 'list' ? '#405189' : '#878a99',
                background: activeSubTab === 'list' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeSubTab === 'list' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Users size={14} style={{ color: activeSubTab === 'list' ? '#405189' : '#878a99' }} />
              <span>Daftar Mapping Role</span>
              <span
                style={{
                  background: activeSubTab === 'list' ? '#eef0f7' : '#e9ebec',
                  color: activeSubTab === 'list' ? '#405189' : '#878a99',
                  padding: '0.05rem 0.35rem',
                  borderRadius: '10px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                }}
              >
                {roleList.length.toLocaleString('id-ID')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('audit')}
              style={{
                padding: '0.4rem 0.95rem',
                fontSize: '0.8rem',
                fontWeight: activeSubTab === 'audit' ? 700 : 500,
                color: activeSubTab === 'audit' ? '#405189' : '#878a99',
                background: activeSubTab === 'audit' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeSubTab === 'audit' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <ShieldAlert size={14} style={{ color: activeSubTab === 'audit' ? '#405189' : '#878a99' }} />
              <span>Analisa Segregation of Duties & Wondr Workflow</span>
            </button>
          </div>

          {activeSubTab === 'list' ? (
            <>
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

                  {/* Unit Filter */}
                  <select
                    value={filterUnit}
                    onChange={(e) => setFilterUnit(e.target.value)}
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
                    <option value="ALL">Semua Tipe Unit</option>
                    <option value="KC">Cabang Induk (KC)</option>
                    <option value="KCP">Sub Branch / KCP</option>
                  </select>

                  {/* SoD Filter */}
                  <select
                    value={filterSod}
                    onChange={(e) => setFilterSod(e.target.value)}
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
                    <option value="ALL">Semua Status SoD</option>
                    <option value="IDEAL">SoD Ideal (≥ 3 User)</option>
                    <option value="DUAL">Dual Role (2 User)</option>
                    <option value="SINGLE">Perangkapan Akses (1 User)</option>
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
                      <th style={{ width: '110px', textAlign: 'center' }}>Tipe Unit</th>
                      <th style={{ width: '140px', textAlign: 'center' }}>
                        <div>QRS_CABSAL</div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#878a99' }}>Sales Cabang</div>
                      </th>
                      <th style={{ width: '140px', textAlign: 'center' }}>
                        <div>QRS_CABAPV1</div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#878a99' }}>Verifikator</div>
                      </th>
                      <th style={{ width: '140px', textAlign: 'center' }}>
                        <div>QRS_CABAPV2</div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#878a99' }}>Penyetuju</div>
                      </th>
                      <th style={{ width: '130px', textAlign: 'center' }}>
                        <div>Grand Total</div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#878a99' }}>Distinct User</div>
                      </th>
                      <th style={{ width: '140px', textAlign: 'center' }}>Status SoD</th>
                      <th style={{ width: '95px', textAlign: 'center' }}>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
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
                        
                        const isKc = getUnitCategory(item.organisasiTujuan) === 'KC';
                        const sod = getSodAnalysis(item);

                        return (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                            <td style={{ textAlign: 'center', color: '#878a99' }}>{displayRowNo}</td>
                            <td style={{ fontWeight: 600, color: '#212529' }}>{item.organisasiTujuan}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  background: isKc ? 'rgba(64, 81, 137, 0.1)' : 'rgba(41, 156, 219, 0.1)',
                                  color: isKc ? '#405189' : '#299cdb',
                                }}
                              >
                                {isKc ? 'Cabang Induk' : 'Sub Branch'}
                              </span>
                            </td>

                            {/* QRS_CABSAL */}
                            <td style={{ textAlign: 'center' }}>
                              {item.qrsCabsal === 1 ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.15rem 0.55rem',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    fontSize: '0.74rem',
                                    background: 'rgba(10, 179, 156, 0.12)',
                                    color: '#0ab39c',
                                  }}
                                >
                                  ✓ 1
                                </span>
                              ) : (
                                <span style={{ color: '#adb5bd', fontWeight: 500 }}>-</span>
                              )}
                            </td>

                            {/* QRS_CABAPV1 */}
                            <td style={{ textAlign: 'center' }}>
                              {item.qrsCabapv1 === 1 ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.15rem 0.55rem',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    fontSize: '0.74rem',
                                    background: 'rgba(41, 156, 219, 0.12)',
                                    color: '#299cdb',
                                  }}
                                >
                                  ✓ 1
                                </span>
                              ) : (
                                <span style={{ color: '#adb5bd', fontWeight: 500 }}>-</span>
                              )}
                            </td>

                            {/* QRS_CABAPV2 */}
                            <td style={{ textAlign: 'center' }}>
                              {item.qrsCabapv2 === 1 ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.15rem 0.55rem',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    fontSize: '0.74rem',
                                    background: 'rgba(247, 184, 75, 0.18)',
                                    color: '#d68b0c',
                                  }}
                                >
                                  ✓ 1
                                </span>
                              ) : (
                                <span style={{ color: '#adb5bd', fontWeight: 500 }}>-</span>
                              )}
                            </td>

                            {/* Grand Total Distinct User */}
                            <td style={{ textAlign: 'center' }}>
                              <span
                                className="code-cell"
                                style={{
                                  fontWeight: 800,
                                  fontSize: '0.84rem',
                                  color: sod.color,
                                  background: sod.bgColor,
                                  padding: '0.2rem 0.65rem',
                                  borderRadius: '4px',
                                }}
                                title={`${item.grandTotal} Distinct User Fisik`}
                              >
                                {item.grandTotal} User
                              </span>
                            </td>

                            {/* Status SoD */}
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  background: sod.bgColor,
                                  color: sod.color,
                                }}
                              >
                                {sod.label}
                              </span>
                            </td>

                            {/* Actions */}
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetailModal(originalIdx)}
                                  title="Lihat Detail Mapping & Alur Workflow"
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
            </>
          ) : (
            /* Audit & Workflow View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Insight Explanation Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(64, 81, 137, 0.05) 0%, rgba(41, 156, 219, 0.05) 100%)',
                  borderRadius: '8px',
                  border: '1px solid rgba(64, 81, 137, 0.15)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <ShieldCheck size={18} color="#405189" />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#405189' }}>
                    Panduan Bisnis: Logika Grand Total (Distinct User Count) & Wondr Workflow
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem', fontSize: '0.78rem' }}>
                  <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e9ebec' }}>
                    <div style={{ fontWeight: 700, color: '#212529', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Building2 size={15} color="#405189" />
                      <span>1. Cabang Induk (KC)</span>
                    </div>
                    <p style={{ margin: 0, color: '#6c757d', lineHeight: 1.5 }}>
                      Pola nama <code>[NAMA KOTA] BRANCH OFFICE</code> (tanpa strip). Memiliki 3 role lengkap (Sales/Maker, Verifikator/APV1, Penyetuju/APV2) untuk alur persetujuan bertingkat standard 3-tier.
                    </p>
                  </div>

                  <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e9ebec' }}>
                    <div style={{ fontWeight: 700, color: '#212529', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <GitBranch size={15} color="#299cdb" />
                      <span>2. Outlet / Sub Branch (KCP)</span>
                    </div>
                    <p style={{ margin: 0, color: '#6c757d', lineHeight: 1.5 }}>
                      Pola nama <code>[KC INDUK] - [OUTLET] SUB BRANCH</code>. Tidak memiliki role Verifikator (<code>QRS_CABAPV1</code>). Jalur persetujuan langsung loncat (Bypass) ke Approver atau diarahkan ke KC Pembina.
                    </p>
                  </div>

                  <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e9ebec' }}>
                    <div style={{ fontWeight: 700, color: '#212529', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Users size={15} color="#0ab39c" />
                      <span>3. Makna Kolom Grand Total</span>
                    </div>
                    <p style={{ margin: 0, color: '#6c757d', lineHeight: 1.5 }}>
                      Bukan penjumlahan matematika horizontal, melainkan <strong>Jumlah Pegawai / User ID Fisik Unik</strong>. Grand Total = 1 berarti perangkapan hak akses (1 orang memegang semua role), sedangkan Grand Total ≥ 3 berarti Segregation of Duties ideal.
                    </p>
                  </div>
                </div>
              </div>

              {/* SoD Breakdown Table */}
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#212529', margin: '0 0 0.65rem' }}>
                  Matriks Rekomendasi Alur Wondr Merchant per Unit Kerja
                </h4>
                <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto', maxHeight: '480px' }}>
                  <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
                      <tr>
                        <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                        <th>Organisasi Tujuan</th>
                        <th style={{ width: '110px', textAlign: 'center' }}>Struktur Unit</th>
                        <th style={{ width: '120px', textAlign: 'center' }}>Distinct User</th>
                        <th>Status Segregation of Duties (SoD)</th>
                        <th>Rekomendasi Alur Wondr Workflow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleList.map((item, idx) => {
                        const isKc = getUnitCategory(item.organisasiTujuan) === 'KC';
                        const sod = getSodAnalysis(item);
                        const wondr = getWondrRecommendation(item);

                        return (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                            <td style={{ textAlign: 'center', color: '#878a99' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 600, color: '#212529' }}>{item.organisasiTujuan}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  background: isKc ? 'rgba(64, 81, 137, 0.1)' : 'rgba(41, 156, 219, 0.1)',
                                  color: isKc ? '#405189' : '#299cdb',
                                }}
                              >
                                {isKc ? 'Cabang Induk (KC)' : 'Sub Branch (KCP)'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <strong style={{ color: sod.color }}>{item.grandTotal} Orang</strong>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '4px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    background: sod.bgColor,
                                    color: sod.color,
                                  }}
                                >
                                  {sod.label}
                                </span>
                                <span style={{ fontSize: '0.74rem', color: '#6c757d' }}>{sod.summary}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.76rem', color: '#495057', fontWeight: 600 }}>
                                {wondr.flow}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit / Detail Modal with Checkboxes and Distinct User Input */}
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
              maxWidth: '560px',
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
                  {modalMode === 'create' && 'Tambah Mapping Role Organisasi'}
                  {modalMode === 'edit' && 'Edit Mapping Role Organisasi'}
                  {modalMode === 'detail' && 'Detail Mapping Role & Distinct User'}
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

            <form onSubmit={handleSubmitForm} style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
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
                    padding: '0.48rem 0.65rem',
                    fontSize: '0.82rem',
                    borderRadius: '5px',
                    border: '1px solid #ced4da',
                    background: modalMode === 'detail' ? '#f8f9fa' : '#ffffff',
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: '#878a99', marginTop: '0.2rem', display: 'block' }}>
                  Pola: Cabang Induk <code>[KOTA] BRANCH OFFICE</code> atau Sub Branch <code>[KC] - [OUTLET] SUB BRANCH</code>
                </span>
              </div>

              {/* 3 Role Checkboxes (Checked = 1, Unchecked = 0) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#212529', marginBottom: '0.5rem' }}>
                  Kelengkapan Role Aktif (Ceklist jika aktif):
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.65rem',
                  }}
                >
                  {/* Checkbox 1: QRS_CABSAL */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      padding: '0.65rem',
                      borderRadius: '6px',
                      border: formData.qrsCabsal === 1 ? '1px solid #0ab39c' : '1px solid #ced4da',
                      background: formData.qrsCabsal === 1 ? 'rgba(10, 179, 156, 0.06)' : '#fafbfe',
                      cursor: modalMode === 'detail' ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={modalMode === 'detail'}
                      checked={formData.qrsCabsal === 1}
                      onChange={(e) => setFormData({ ...formData, qrsCabsal: e.target.checked ? 1 : 0 })}
                      style={{ marginTop: '0.15rem', cursor: 'pointer', accentColor: '#0ab39c' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.76rem', color: '#0ab39c', display: 'block' }}>QRS_CABSAL</strong>
                      <span style={{ fontSize: '0.68rem', color: '#878a99' }}>Sales Cabang</span>
                      <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700, color: '#495057', marginTop: '0.15rem' }}>
                        Nilai: ({formData.qrsCabsal === 1 ? '1' : '0'})
                      </span>
                    </div>
                  </label>

                  {/* Checkbox 2: QRS_CABAPV1 */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      padding: '0.65rem',
                      borderRadius: '6px',
                      border: formData.qrsCabapv1 === 1 ? '1px solid #299cdb' : '1px solid #ced4da',
                      background: formData.qrsCabapv1 === 1 ? 'rgba(41, 156, 219, 0.06)' : '#fafbfe',
                      cursor: modalMode === 'detail' ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={modalMode === 'detail'}
                      checked={formData.qrsCabapv1 === 1}
                      onChange={(e) => setFormData({ ...formData, qrsCabapv1: e.target.checked ? 1 : 0 })}
                      style={{ marginTop: '0.15rem', cursor: 'pointer', accentColor: '#299cdb' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.76rem', color: '#299cdb', display: 'block' }}>QRS_CABAPV1</strong>
                      <span style={{ fontSize: '0.68rem', color: '#878a99' }}>Verifikator</span>
                      <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700, color: '#495057', marginTop: '0.15rem' }}>
                        Nilai: ({formData.qrsCabapv1 === 1 ? '1' : '0'})
                      </span>
                    </div>
                  </label>

                  {/* Checkbox 3: QRS_CABAPV2 */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      padding: '0.65rem',
                      borderRadius: '6px',
                      border: formData.qrsCabapv2 === 1 ? '1px solid #d68b0c' : '1px solid #ced4da',
                      background: formData.qrsCabapv2 === 1 ? 'rgba(247, 184, 75, 0.1)' : '#fafbfe',
                      cursor: modalMode === 'detail' ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={modalMode === 'detail'}
                      checked={formData.qrsCabapv2 === 1}
                      onChange={(e) => setFormData({ ...formData, qrsCabapv2: e.target.checked ? 1 : 0 })}
                      style={{ marginTop: '0.15rem', cursor: 'pointer', accentColor: '#d68b0c' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.76rem', color: '#d68b0c', display: 'block' }}>QRS_CABAPV2</strong>
                      <span style={{ fontSize: '0.68rem', color: '#878a99' }}>Penyetuju</span>
                      <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700, color: '#495057', marginTop: '0.15rem' }}>
                        Nilai: ({formData.qrsCabapv2 === 1 ? '1' : '0'})
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Grand Total Distinct User Input */}
              <div
                style={{
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ebec',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#212529' }}>
                    Grand Total: Jumlah Pegawai / User Fisik Unik (Distinct User Count) <span style={{ color: '#f06548' }}>*</span>
                  </label>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.12rem 0.45rem',
                      borderRadius: '4px',
                      background: getSodAnalysis(formData).bgColor,
                      color: getSodAnalysis(formData).color,
                    }}
                  >
                    {getSodAnalysis(formData).label}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="number"
                    min="1"
                    required
                    disabled={modalMode === 'detail'}
                    value={formData.grandTotal}
                    onChange={(e) => setFormData({ ...formData, grandTotal: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    style={{
                      width: '120px',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      borderRadius: '5px',
                      border: '1px solid #ced4da',
                      background: modalMode === 'detail' ? '#f8f9fa' : '#ffffff',
                      color: '#405189',
                    }}
                  />
                  <span style={{ fontSize: '0.74rem', color: '#6c757d', lineHeight: 1.4 }}>
                    {formData.grandTotal === 1 && '1 User: Perangkapan hak akses (Triple/Dual Role dipegang 1 pegawai).'}
                    {formData.grandTotal === 2 && '2 User: Ada 2 pegawai aktif (1 staf independen, 1 pejabat).'}
                    {formData.grandTotal >= 3 && '≥ 3 User: Pemisahan tugas ideal (Four-Eyes Principle berjalan penuh).'}
                  </span>
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
