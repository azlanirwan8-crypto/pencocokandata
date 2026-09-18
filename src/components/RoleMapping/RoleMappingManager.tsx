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
  GitBranch,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Check,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getItem, setItem } from '../../utils/storage';
import { loadRoleMappingFromNeon, saveRoleMappingToNeon } from '../../utils/neonSync';

export interface RoleMappingRecord {
  id?: string;
  organisasiTujuan: string;
  qrsCabsal: number;    // QRS_CABSAL -> Sales Cabang (1: Aktif, 0: Tidak Aktif)
  qrsCabapv1: number;   // QRS_CABAPV1 -> Verifikator Cabang (1: Aktif, 0: Tidak Aktif)
  qrsCabapv2: number;   // QRS_CABAPV2 -> Penyetuju Cabang (1: Aktif, 0: Tidak Aktif)
  grandTotal: number;   // Grand Total -> Jumlah User / Pegawai Fisik Unik (Distinct User Count)
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
    organisasiTujuan: 'HARMONI BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'GAMBIR BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'JAKARTA KOTA BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'SENAYAN BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'KEBON SIRIH BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'MATARAM BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'MATARAM BRANCH OFFICE - PAGUTAN SUB BRANCH',
    qrsCabsal: 1,
    qrsCabapv1: 0,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'MEDAN BALAI KOTA BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'MAKASSAR BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'PALEMBANG BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'PADANG BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'SEMARANG BRIGJEN SUDIARTO BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'SURABAYA BASUKI RAHMAT BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'YOGYAKARTA BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'KUPANG BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'MANADO BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'JAYAPURA BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'RANTAUPRAPAT BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 1,
  },
  {
    organisasiTujuan: 'RANTAUPRAPAT BRANCH OFFICE - AEK KANOPAN SUB BRANCH',
    qrsCabsal: 1,
    qrsCabapv1: 0,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'RANTAUPRAPAT BRANCH OFFICE - KOTA PINANG SUB BRANCH',
    qrsCabsal: 1,
    qrsCabapv1: 0,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'KISARAN BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 2,
  },
  {
    organisasiTujuan: 'PEMATANG SIANTAR BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 3,
  },
  {
    organisasiTujuan: 'TEBING TINGGI BRANCH OFFICE',
    qrsCabsal: 1,
    qrsCabapv1: 1,
    qrsCabapv2: 1,
    grandTotal: 2,
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

// Helper: Rekomendasi Alur Wondr Merchant dengan bahasa umum
export function getWondrRecommendation(record: RoleMappingRecord) {
  const isKc = getUnitCategory(record.organisasiTujuan) === 'KC';
  const hasFullRoles = record.qrsCabsal === 1 && record.qrsCabapv1 === 1 && record.qrsCabapv2 === 1;

  if (isKc && hasFullRoles) {
    return {
      tier: 'Alur Standar 3 Tahap',
      flow: 'Sales ➔ Verifikator ➔ Penyetuju',
      badgeColor: '#0ab39c',
      badgeBg: 'rgba(10, 179, 156, 0.1)',
      desc: '3 Peran Lengkap: Siap digunakan langsung untuk pendaftaran Wondr Merchant.',
    };
  }
  if (isKc) {
    return {
      tier: 'Cabang Induk (Khusus)',
      flow: 'Sales ➔ Penyetuju Langsung',
      badgeColor: '#405189',
      badgeBg: 'rgba(64, 81, 137, 0.1)',
      desc: 'Cabang Induk dengan pengaturan peran verifikator khusus.',
    };
  }
  return {
    tier: 'Alur Outlet (2 Tahap)',
    flow: 'Sales Outlet ➔ Penyetuju Cabang (Langsung / Review Cabang Induk)',
    badgeColor: '#299cdb',
    badgeBg: 'rgba(41, 156, 219, 0.1)',
    desc: 'Outlet tanpa verifikator: Persetujuan langsung ke Penyetuju atau dialihkan ke Cabang Pembina.',
  };
}

interface RoleMappingManagerProps {
  onRoleMappingCountChange?: (count: number) => void;
}

export const RoleMappingManager: React.FC<RoleMappingManagerProps> = ({
  onRoleMappingCountChange,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'wondr'>('list');
  const [roleList, setRoleList] = useState<RoleMappingRecord[]>(DEFAULT_ROLE_MAPPING_DATA);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterUnit, setFilterUnit] = useState<'ALL' | 'FULL' | 'KCP' | 'KC'>('ALL');
  const [showBanner, setShowBanner] = useState<boolean>(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-dismiss the info banner after 20 seconds
  useEffect(() => {
    if (!showBanner) return;
    const t = setTimeout(() => setShowBanner(false), 20000);
    return () => clearTimeout(t);
  }, [showBanner]);
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
          onRoleMappingCountChange?.(saved.length);
        } else if (isMounted) {
          onRoleMappingCountChange?.(DEFAULT_ROLE_MAPPING_DATA.length);
        }
        const neonRows = await loadRoleMappingFromNeon();
        if (neonRows && Array.isArray(neonRows) && neonRows.length > 0 && isMounted) {
          setRoleList(neonRows);
          onRoleMappingCountChange?.(neonRows.length);
          setItem('role_mapping_data', neonRows);
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
      onRoleMappingCountChange?.(listToSave.length);
      setSuccessMsg(`Berhasil menyimpan ${listToSave.length.toLocaleString('id-ID')} data mapping role!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      saveRoleMappingToNeon(listToSave).catch(() => undefined);
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
    let totalFullRoles = 0;

    roleList.forEach((r) => {
      if (r.qrsCabsal === 1) totalCabsal++;
      if (r.qrsCabapv1 === 1) totalCabapv1++;
      if (r.qrsCabapv2 === 1) totalCabapv2++;

      if (r.qrsCabsal === 1 && r.qrsCabapv1 === 1 && r.qrsCabapv2 === 1) {
        totalFullRoles++;
      }

      if (getUnitCategory(r.organisasiTujuan) === 'KC') {
        totalKc++;
      } else {
        totalKcp++;
      }
    });

    return {
      totalOrganisasi: roleList.length,
      totalCabsal,
      totalCabapv1,
      totalCabapv2,
      totalFullRoles,
      totalKc,
      totalKcp,
    };
  }, [roleList]);

  // Filtered Role List
  const filteredList = useMemo(() => {
    return roleList.filter((r) => {
      const unitType = getUnitCategory(r.organisasiTujuan);
      if (filterUnit === 'KC' && unitType !== 'KC') return false;
      if (filterUnit === 'KCP' && unitType !== 'KCP') return false;
      if (filterUnit === 'FULL' && !(r.qrsCabsal === 1 && r.qrsCabapv1 === 1 && r.qrsCabapv2 === 1)) return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.organisasiTujuan?.toLowerCase().includes(q) ||
        String(r.grandTotal).includes(q)
      );
    });
  }, [roleList, filterUnit, searchTerm]);

  // Reset page when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [filterUnit, searchTerm]);

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

  // Compact sliding pagination
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

  // Card click handler for filtering
  const handleCardClick = (filterType: 'ALL' | 'FULL' | 'KCP' | 'KC') => {
    setFilterUnit(filterType);
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
          
          const cabsal = rawCabsal === '1' || rawCabsal.toLowerCase() === 'true' || rawCabsal.toLowerCase() === 'ya' || Number(rawCabsal) > 0 ? 1 : 0;
          const cabapv1 = rawCabapv1 === '1' || rawCabapv1.toLowerCase() === 'true' || rawCabapv1.toLowerCase() === 'ya' || Number(rawCabapv1) > 0 ? 1 : 0;
          const cabapv2 = rawCabapv2 === '1' || rawCabapv2.toLowerCase() === 'true' || rawCabapv2.toLowerCase() === 'ya' || Number(rawCabapv2) > 0 ? 1 : 0;
          
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

  // Reset ke data default bawaan
  const handleResetToDefault = async () => {
    setRoleList(DEFAULT_ROLE_MAPPING_DATA);
    setShowResetConfirm(false);
    await setItem('role_mapping_data', DEFAULT_ROLE_MAPPING_DATA);
    onRoleMappingCountChange?.(DEFAULT_ROLE_MAPPING_DATA.length);
    setSuccessMsg('Data mapping role berhasil dikembalikan ke data standar bawaan!');
    setTimeout(() => setSuccessMsg(null), 4000);
    saveRoleMappingToNeon(DEFAULT_ROLE_MAPPING_DATA).catch(() => undefined);
  };

  // Reset / Clear all Records
  const handleResetAll = async () => {
    setRoleList([]);
    setShowResetConfirm(false);
    await setItem('role_mapping_data', []);
    onRoleMappingCountChange?.(0);
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
              Master Mapping Role & Unit BNI
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#878a99', margin: '0.2rem 0 0' }}>
              Daftar Cabang & Outlet BNI se-Indonesia beserta pemetaan peran untuk alur aplikasi Wondr Merchant.
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

      {/* Main Informative Executive Banner */}
      {showBanner && (
        <div
          style={{
            background: 'linear-gradient(135deg, #f0f4ff 0%, #e6f7ff 100%)',
            borderRadius: '8px',
            border: '1px solid #d0e2ff',
            padding: '1.1rem 1.35rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.85rem',
            boxShadow: '0 1px 2px rgba(64, 81, 137, 0.04)',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: 1 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#405189',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '0.1rem',
              }}
            >
              <Info size={18} />
            </div>
            <div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#2d3748', margin: '0 0 0.35rem' }}>
                List Cabang & Outlet BNI se-Indonesia untuk Mapping Wondr Merchant
              </h4>
              <p style={{ fontSize: '0.82rem', color: '#4a5568', margin: 0, lineHeight: 1.55 }}>
                Berikut list <strong>Cabang dan Outlet BNI se-Indonesia</strong> dan pemetaan perannya.{' '}
                Dari total <strong>{stats.totalOrganisasi.toLocaleString('id-ID')} Unit Kerja</strong>, yang{' '}
                <strong>lengkap 3 role-nya</strong> ada <strong>{stats.totalFullRoles.toLocaleString('id-ID')} Cabang Utama (KC)</strong>.{' '}
                Data ini dapat langsung dijadikan acuan alur persetujuan untuk aplikasi <strong>Wondr Merchant</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBanner(false)}
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

      {/* 4 Focused Clickable Cards: Klik untuk filter data di tabel */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {/* Card 1: Total Unit Kerja (Klik -> Filter ALL) */}
        <div
          className="metric-card blue"
          onClick={() => handleCardClick('ALL')}
          style={{
            cursor: 'pointer',
            border: filterUnit === 'ALL' ? '2px solid #405189' : undefined,
          }}
          title="Klik untuk melihat Semua Cabang & Outlet"
        >
          <div className="metric-header">
            <span className="metric-title">Total Cabang & Outlet</span>
            <div className="metric-icon-bubble">
              <Building2 size={14} />
            </div>
          </div>
          <div className="metric-value">{stats.totalOrganisasi.toLocaleString('id-ID')}</div>
          <div className="metric-footer">
            {stats.totalKc} Cabang Utama · {stats.totalKcp} Outlet
          </div>
        </div>

        {/* Card 2: Role Lengkap (Klik -> Filter FULL) */}
        <div
          className="metric-card emerald"
          onClick={() => handleCardClick('FULL')}
          style={{
            cursor: 'pointer',
            border: filterUnit === 'FULL' ? '2px solid #0ab39c' : undefined,
          }}
          title="Klik untuk hanya melihat Cabang dengan 3 Role Lengkap"
        >
          <div className="metric-header">
            <span className="metric-title">Cabang 3 Role Lengkap</span>
            <div className="metric-icon-bubble">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="metric-value">{stats.totalFullRoles.toLocaleString('id-ID')}</div>
          <div className="metric-footer">Siap Alur Standar Wondr</div>
        </div>

        {/* Card 3: Outlet / Sub Branch (Klik -> Filter KCP) */}
        <div
          className="metric-card cyan"
          onClick={() => handleCardClick('KCP')}
          style={{
            cursor: 'pointer',
            border: filterUnit === 'KCP' ? '2px solid #299cdb' : undefined,
          }}
          title="Klik untuk hanya melihat Outlet / Sub Branch (KCP)"
        >
          <div className="metric-header">
            <span className="metric-title">Outlet / Sub Branch (2 Role)</span>
            <div className="metric-icon-bubble">
              <GitBranch size={14} />
            </div>
          </div>
          <div className="metric-value">{stats.totalKcp.toLocaleString('id-ID')}</div>
          <div className="metric-footer">Sales & Penyetuju</div>
        </div>

        {/* Card 4: Cabang Utama / KC (Klik -> Filter KC) */}
        <div
          className="metric-card amber"
          onClick={() => handleCardClick('KC')}
          style={{
            cursor: 'pointer',
            border: filterUnit === 'KC' ? '2px solid #f7b84b' : undefined,
          }}
          title="Klik untuk hanya melihat Cabang Utama (KC Induk)"
        >
          <div className="metric-header">
            <span className="metric-title">Cabang Utama (KC Induk)</span>
            <div className="metric-icon-bubble">
              <Users size={14} />
            </div>
          </div>
          <div className="metric-value">{stats.totalKc.toLocaleString('id-ID')}</div>
          <div className="metric-footer">Unit KC Induk terdaftar</div>
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
              <span>Daftar Mapping Role Cabang & Outlet</span>
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
                {filteredList.length.toLocaleString('id-ID')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('wondr')}
              style={{
                padding: '0.4rem 0.95rem',
                fontSize: '0.8rem',
                fontWeight: activeSubTab === 'wondr' ? 700 : 500,
                color: activeSubTab === 'wondr' ? '#405189' : '#878a99',
                background: activeSubTab === 'wondr' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeSubTab === 'wondr' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Building2 size={14} style={{ color: activeSubTab === 'wondr' ? '#405189' : '#878a99' }} />
              <span>Panduan Struktur Unit & Alur Wondr Merchant</span>
            </button>
          </div>

          {/* Active Filter Indicator Badge */}
          {filterUnit !== 'ALL' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#f8f9fa',
                padding: '0.4rem 0.75rem',
                borderRadius: '5px',
                border: '1px solid #e9ebec',
                fontSize: '0.78rem',
                marginBottom: '0.85rem',
                color: '#495057',
              }}
            >
              <Filter size={14} color="#405189" />
              <span>
                Menampilkan filter:{' '}
                <strong>
                  {filterUnit === 'FULL' && 'Cabang 3 Role Lengkap'}
                  {filterUnit === 'KCP' && 'Outlet / Sub Branch (KCP)'}
                  {filterUnit === 'KC' && 'Cabang Utama (KC Induk)'}
                </strong>{' '}
                ({filteredList.length} data ditemukan)
              </span>
              <button
                type="button"
                onClick={() => setFilterUnit('ALL')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f06548',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0 0.3rem',
                  textDecoration: 'underline',
                  marginLeft: 'auto',
                }}
              >
                Reset Filter (Lihat Semua)
              </button>
            </div>
          )}

          {activeSubTab === 'list' ? (
            <>
              {/* Filter Toolbar */}
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

                  {/* Unit Filter Dropdown */}
                  <select
                    value={filterUnit}
                    onChange={(e) => setFilterUnit(e.target.value as any)}
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
                    <option value="ALL">Semua Unit Kerja ({stats.totalOrganisasi.toLocaleString('id-ID')})</option>
                    <option value="FULL">Cabang 3 Role Lengkap ({stats.totalFullRoles.toLocaleString('id-ID')})</option>
                    <option value="KC">Cabang Utama (KC) ({stats.totalKc.toLocaleString('id-ID')})</option>
                    <option value="KCP">Outlet / Sub Branch (KCP) ({stats.totalKcp.toLocaleString('id-ID')})</option>
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

              {/* Table Role Mapping with ONLY Checkmarks (✓) */}
              <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto', maxHeight: '580px' }}>
                <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
                    <tr>
                      <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                      <th>ORGANISASI TUJUAN</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Tipe Unit</th>
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
                        
                        const isKc = getUnitCategory(item.organisasiTujuan) === 'KC';

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
                                {isKc ? 'Cabang Utama' : 'Outlet'}
                              </span>
                            </td>

                            {/* QRS_CABSAL: ONLY Checkmark (✓) */}
                            <td style={{ textAlign: 'center' }}>
                              {item.qrsCabsal === 1 ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'rgba(10, 179, 156, 0.15)',
                                    color: '#0ab39c',
                                  }}
                                  title="Role Aktif"
                                >
                                  <Check size={15} strokeWidth={3} />
                                </span>
                              ) : (
                                <span style={{ color: '#adb5bd', fontWeight: 500 }}>-</span>
                              )}
                            </td>

                            {/* QRS_CABAPV1: ONLY Checkmark (✓) */}
                            <td style={{ textAlign: 'center' }}>
                              {item.qrsCabapv1 === 1 ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'rgba(41, 156, 219, 0.15)',
                                    color: '#299cdb',
                                  }}
                                  title="Role Aktif"
                                >
                                  <Check size={15} strokeWidth={3} />
                                </span>
                              ) : (
                                <span style={{ color: '#adb5bd', fontWeight: 500 }}>-</span>
                              )}
                            </td>

                            {/* QRS_CABAPV2: ONLY Checkmark (✓) */}
                            <td style={{ textAlign: 'center' }}>
                              {item.qrsCabapv2 === 1 ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'rgba(247, 184, 75, 0.2)',
                                    color: '#d68b0c',
                                  }}
                                  title="Role Aktif"
                                >
                                  <Check size={15} strokeWidth={3} />
                                </span>
                              ) : (
                                <span style={{ color: '#adb5bd', fontWeight: 500 }}>-</span>
                              )}
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
                  <span style={{ fontSize: '0.78rem', color: '#878a99' }}>
                    Menampilkan <strong>{((page - 1) * (pageSize as number)) + 1}</strong> -{' '}
                    <strong>{Math.min(page * (pageSize as number), filteredList.length)}</strong> dari{' '}
                    <strong>{filteredList.length.toLocaleString('id-ID')}</strong> entri
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
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
                      if (p === 'ell-start' || p === 'ell-end') {
                        return (
                          <span key={`ell-${idx}`} style={{ padding: '0 0.35rem', color: '#878a99', fontSize: '0.75rem' }}>
                            ...
                          </span>
                        );
                      }
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p as number)}
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
            /* Wondr Workflow Guide View with Clickable Cards & Clear Explanations */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Insight Explanation Cards (Clickable) */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(64, 81, 137, 0.05) 0%, rgba(41, 156, 219, 0.05) 100%)',
                  borderRadius: '8px',
                  border: '1px solid rgba(64, 81, 137, 0.15)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 size={18} color="#405189" />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#405189' }}>
                      Panduan Struktur Unit Kerja & Alur Pendaftaran Wondr Merchant
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#878a99' }}>Klik kartu di bawah untuk memfilter daftar:</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem', fontSize: '0.78rem' }}>
                  {/* Card 1: Cabang Utama (FULL) */}
                  <div
                    onClick={() => handleCardClick('FULL')}
                    style={{
                      background: '#ffffff',
                      padding: '0.95rem',
                      borderRadius: '6px',
                      border: filterUnit === 'FULL' ? '2px solid #0ab39c' : '1px solid #e9ebec',
                      boxShadow: filterUnit === 'FULL' ? '0 2px 6px rgba(10, 179, 156, 0.15)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    title="Klik untuk melihat hanya Cabang dengan 3 Role Lengkap"
                  >
                    <div style={{ fontWeight: 700, color: '#0ab39c', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle2 size={16} color="#0ab39c" />
                        <span>1. Cabang Utama / KC ({stats.totalFullRoles} Cabang Lengkap)</span>
                      </div>
                      {filterUnit === 'FULL' && (
                        <span style={{ fontSize: '0.62rem', background: '#0ab39c', color: '#fff', padding: '0.05rem 0.35rem', borderRadius: '3px' }}>
                          Terpilih
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, color: '#495057', lineHeight: 1.55 }}>
                      Format nama <code>[NAMA KOTA] BRANCH OFFICE</code>. Memiliki 3 peran lengkap (Sales, Verifikator, dan Penyetuju). Sangat siap digunakan untuk alur pendaftaran standar 3 tahap di aplikasi Wondr Merchant.
                    </p>
                  </div>

                  {/* Card 2: Outlet / Sub Branch (KCP) */}
                  <div
                    onClick={() => handleCardClick('KCP')}
                    style={{
                      background: '#ffffff',
                      padding: '0.95rem',
                      borderRadius: '6px',
                      border: filterUnit === 'KCP' ? '2px solid #299cdb' : '1px solid #e9ebec',
                      boxShadow: filterUnit === 'KCP' ? '0 2px 6px rgba(41, 156, 219, 0.15)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    title="Klik untuk melihat hanya Outlet / Sub Branch (KCP)"
                  >
                    <div style={{ fontWeight: 700, color: '#299cdb', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <GitBranch size={16} color="#299cdb" />
                        <span>2. Outlet / Sub Branch KCP ({stats.totalKcp} Unit)</span>
                      </div>
                      {filterUnit === 'KCP' && (
                        <span style={{ fontSize: '0.62rem', background: '#299cdb', color: '#fff', padding: '0.05rem 0.35rem', borderRadius: '3px' }}>
                          Terpilih
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, color: '#495057', lineHeight: 1.55 }}>
                      Format nama <code>[KC INDUK] - [OUTLET] SUB BRANCH</code>. Hanya memiliki 2 peran (Sales dan Penyetuju, tanpa Verifikator). Alur persetujuan dapat langsung ke Penyetuju atau dialihkan ke Cabang Pembina.
                    </p>
                  </div>

                </div>
              </div>

              {/* Breakdown Table in Panduan Tab */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#212529', margin: 0 }}>
                    Daftar Alur Pendaftaran Wondr Merchant per Unit Kerja ({filteredList.length.toLocaleString('id-ID')} unit)
                  </h4>
                  {filterUnit !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setFilterUnit('ALL')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#405189',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Tampilkan Semua Unit
                    </button>
                  )}
                </div>

                <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto', maxHeight: '480px' }}>
                  <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
                      <tr>
                        <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                        <th>Organisasi Tujuan</th>
                        <th style={{ width: '130px', textAlign: 'center' }}>Struktur Unit</th>
                        <th>Alur Persetujuan Wondr Merchant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#878a99' }}>
                            Tidak ada data yang cocok dengan filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((item, idx) => {
                          const isKc = getUnitCategory(item.organisasiTujuan) === 'KC';
                          const wondr = getWondrRecommendation(item);
                          const displayNo = pageSize === 'ALL' ? idx + 1 : (page - 1) * (pageSize as number) + idx + 1;

                          return (
                            <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                              <td style={{ textAlign: 'center', color: '#878a99' }}>{displayNo}</td>
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
                                  {isKc ? 'Cabang Utama' : 'Outlet (KCP)'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '4px',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      background: wondr.badgeBg,
                                      color: wondr.badgeColor,
                                    }}
                                  >
                                    {wondr.tier}
                                  </span>
                                  <span style={{ fontSize: '0.76rem', color: '#495057', fontWeight: 600 }}>
                                    {wondr.flow}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer in Panduan Tab */}
                {pageSize !== 'ALL' && totalPages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      marginTop: '0.85rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid #e9ebec',
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', color: '#878a99' }}>
                      Menampilkan <strong>{((page - 1) * (pageSize as number)) + 1}</strong> -{' '}
                      <strong>{Math.min(page * (pageSize as number), filteredList.length)}</strong> dari{' '}
                      <strong>{filteredList.length.toLocaleString('id-ID')}</strong> entri
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
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
                        if (p === 'ell-start' || p === 'ell-end') {
                          return (
                            <span key={`ell-${idx}`} style={{ padding: '0 0.35rem', color: '#878a99', fontSize: '0.75rem' }}>
                              ...
                            </span>
                          );
                        }
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPage(p as number)}
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
            </div>
          )}
        </div>
      )}

      {/* Create / Edit / Detail Modal with Clean Checkboxes and Distinct User Input */}
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
                  {modalMode === 'create' && 'Tambah Mapping Role Cabang'}
                  {modalMode === 'edit' && 'Edit Mapping Role Cabang'}
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
                  Format: <code>[KOTA] BRANCH OFFICE</code> atau <code>[KC] - [OUTLET] SUB BRANCH</code>
                </span>
              </div>

              {/* 3 Clean Role Checkboxes (Checked = 1, Unchecked = 0, No extra text) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#212529', marginBottom: '0.5rem' }}>
                  Kelengkapan Role (Ceklist jika aktif):
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
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem',
                      borderRadius: '6px',
                      border: formData.qrsCabsal === 1 ? '1px solid #0ab39c' : '1px solid #ced4da',
                      background: formData.qrsCabsal === 1 ? 'rgba(10, 179, 156, 0.08)' : '#fafbfe',
                      cursor: modalMode === 'detail' ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={modalMode === 'detail'}
                      checked={formData.qrsCabsal === 1}
                      onChange={(e) => setFormData({ ...formData, qrsCabsal: e.target.checked ? 1 : 0 })}
                      style={{ cursor: 'pointer', accentColor: '#0ab39c', width: '16px', height: '16px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.76rem', color: '#0ab39c', display: 'block' }}>QRS_CABSAL</strong>
                      <span style={{ fontSize: '0.68rem', color: '#878a99' }}>Sales Cabang</span>
                    </div>
                  </label>

                  {/* Checkbox 2: QRS_CABAPV1 */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem',
                      borderRadius: '6px',
                      border: formData.qrsCabapv1 === 1 ? '1px solid #299cdb' : '1px solid #ced4da',
                      background: formData.qrsCabapv1 === 1 ? 'rgba(41, 156, 219, 0.08)' : '#fafbfe',
                      cursor: modalMode === 'detail' ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={modalMode === 'detail'}
                      checked={formData.qrsCabapv1 === 1}
                      onChange={(e) => setFormData({ ...formData, qrsCabapv1: e.target.checked ? 1 : 0 })}
                      style={{ cursor: 'pointer', accentColor: '#299cdb', width: '16px', height: '16px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.76rem', color: '#299cdb', display: 'block' }}>QRS_CABAPV1</strong>
                      <span style={{ fontSize: '0.68rem', color: '#878a99' }}>Verifikator</span>
                    </div>
                  </label>

                  {/* Checkbox 3: QRS_CABAPV2 */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem',
                      borderRadius: '6px',
                      border: formData.qrsCabapv2 === 1 ? '1px solid #d68b0c' : '1px solid #ced4da',
                      background: formData.qrsCabapv2 === 1 ? 'rgba(247, 184, 75, 0.12)' : '#fafbfe',
                      cursor: modalMode === 'detail' ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={modalMode === 'detail'}
                      checked={formData.qrsCabapv2 === 1}
                      onChange={(e) => setFormData({ ...formData, qrsCabapv2: e.target.checked ? 1 : 0 })}
                      style={{ cursor: 'pointer', accentColor: '#d68b0c', width: '16px', height: '16px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.76rem', color: '#d68b0c', display: 'block' }}>QRS_CABAPV2</strong>
                      <span style={{ fontSize: '0.68rem', color: '#878a99' }}>Penyetuju</span>
                    </div>
                  </label>
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
              maxWidth: '460px',
              padding: '1.5rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <RefreshCw size={36} color="#405189" style={{ margin: '0 auto 0.5rem' }} />
            <h4 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 700, color: '#212529' }}>
              Reset Data Mapping Role
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#878a99', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              Pilih apakah Anda ingin mengembalikan data ke standar bawaan ({DEFAULT_ROLE_MAPPING_DATA.length.toLocaleString('id-ID')} entri) atau mengosongkan seluruh data untuk impor baru dari awal.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowResetConfirm(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ color: '#f06548', borderColor: 'rgba(240, 101, 72, 0.4)' }}
                onClick={handleResetAll}
                title="Kosongkan seluruh data menjadi 0"
              >
                Kosongkan Semua
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleResetToDefault}
              >
                Reset ke Standar Bawaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
