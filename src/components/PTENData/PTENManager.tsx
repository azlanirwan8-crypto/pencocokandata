import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShieldCheck,
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
  Save,
  Loader2,
  Building2,
  MapPin,
  Sparkles,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { TargetRow, MasterRow } from '../../types';
import { getItem, setItem } from '../../utils/storage';

interface PTENManagerProps {
  targetRows?: TargetRow[];
  masterRows?: MasterRow[];
}

export interface PTENRecord {
  id?: string;
  kodePosPten: string;
  kotaPten: string;
  kotaPtenMax15?: string;
  provinsiPten: string;
  keterangan: string;
  status: 'AKTIF' | 'NON-AKTIF';
}

export const DEFAULT_PTEN_DATA: PTENRecord[] = [
  { kodePosPten: '10110', kotaPten: 'JAKARTA PUSAT', kotaPtenMax15: 'JAKARTA PUSAT', provinsiPten: 'DKI Jakarta', keterangan: 'Gambir', status: 'AKTIF' },
  { kodePosPten: '10115', kotaPten: 'JAKARTA PUSAT', kotaPtenMax15: 'JAKARTA PUSAT', provinsiPten: 'DKI Jakarta', keterangan: 'Gambir Barat', status: 'AKTIF' },
  { kodePosPten: '10120', kotaPten: 'JAKARTA PUSAT', kotaPtenMax15: 'JAKARTA PUSAT', provinsiPten: 'DKI Jakarta', keterangan: 'Petojo Utara', status: 'AKTIF' },
  { kodePosPten: '10130', kotaPten: 'JAKARTA PUSAT', kotaPtenMax15: 'JAKARTA PUSAT', provinsiPten: 'DKI Jakarta', keterangan: 'Petojo Selatan', status: 'AKTIF' },
  { kodePosPten: '10140', kotaPten: 'JAKARTA PUSAT', kotaPtenMax15: 'JAKARTA PUSAT', provinsiPten: 'DKI Jakarta', keterangan: 'Kebon Kelapa', status: 'AKTIF' },
  { kodePosPten: '10150', kotaPten: 'JAKARTA PUSAT', kotaPtenMax15: 'JAKARTA PUSAT', provinsiPten: 'DKI Jakarta', keterangan: 'Cideng', status: 'AKTIF' },
  { kodePosPten: '10160', kotaPten: 'JAKARTA PUSAT', kotaPtenMax15: 'JAKARTA PUSAT', provinsiPten: 'DKI Jakarta', keterangan: 'Duri Pulo', status: 'AKTIF' },
  { kodePosPten: '10210', kotaPten: 'JAKARTA PUSAT', kotaPtenMax15: 'JAKARTA PUSAT', provinsiPten: 'DKI Jakarta', keterangan: 'Bendungan Hilir / Senayan', status: 'AKTIF' },
  { kodePosPten: '10350', kotaPten: 'JAKARTA PUSAT', kotaPtenMax15: 'JAKARTA PUSAT', provinsiPten: 'DKI Jakarta', keterangan: 'Menteng / Gondangdia', status: 'AKTIF' },
  { kodePosPten: '12190', kotaPten: 'JAKARTA SELATAN', kotaPtenMax15: 'JAKARTA SELATAN', provinsiPten: 'DKI Jakarta', keterangan: 'Senayan / SCBD Sudirman', status: 'AKTIF' },
  { kodePosPten: '13310', kotaPten: 'JAKARTA TIMUR', kotaPtenMax15: 'JAKARTA TIMUR', provinsiPten: 'DKI Jakarta', keterangan: 'Bali Mester / Jatinegara', status: 'AKTIF' },
  { kodePosPten: '14240', kotaPten: 'JAKARTA UTARA', kotaPtenMax15: 'JAKARTA UTARA', provinsiPten: 'DKI Jakarta', keterangan: 'Kelapa Gading Timur', status: 'AKTIF' },
  { kodePosPten: '14250', kotaPten: 'JAKARTA UTARA', kotaPtenMax15: 'JAKARTA UTARA', provinsiPten: 'DKI Jakarta', keterangan: 'Kelapa Gading Barat (PTEN Node)', status: 'AKTIF' },
  { kodePosPten: '15321', kotaPten: 'TANGERANG SELATAN', kotaPtenMax15: 'TANGERANG SEL', provinsiPten: 'Banten', keterangan: 'Serpong / Lengkong Gudang', status: 'AKTIF' },
  { kodePosPten: '20112', kotaPten: 'MEDAN', kotaPtenMax15: 'KOTA MEDAN', provinsiPten: 'Sumatera Utara', keterangan: 'Medan Petisah', status: 'AKTIF' },
  { kodePosPten: '20151', kotaPten: 'MEDAN', kotaPtenMax15: 'KOTA MEDAN', provinsiPten: 'Sumatera Utara', keterangan: 'Medan Maimun / Aur', status: 'AKTIF' },
  { kodePosPten: '25119', kotaPten: 'PADANG', kotaPtenMax15: 'KOTA PADANG', provinsiPten: 'Sumatera Barat', keterangan: 'Padang Barat / Kampung Pondok', status: 'AKTIF' },
  { kodePosPten: '30126', kotaPten: 'PALEMBANG', kotaPtenMax15: 'KOTA PALEMBANG', provinsiPten: 'Sumatera Selatan', keterangan: 'Ilir Timur I', status: 'AKTIF' },
  { kodePosPten: '40111', kotaPten: 'BANDUNG', kotaPtenMax15: 'KOTA BANDUNG', provinsiPten: 'Jawa Barat', keterangan: 'Braga / Asia Afrika', status: 'AKTIF' },
  { kodePosPten: '40117', kotaPten: 'BANDUNG', kotaPtenMax15: 'KOTA BANDUNG', provinsiPten: 'Jawa Barat', keterangan: 'Babakan Ciamis / Perintis', status: 'AKTIF' },
  { kodePosPten: '50132', kotaPten: 'SEMARANG', kotaPtenMax15: 'KOTA SEMARANG', provinsiPten: 'Jawa Tengah', keterangan: 'Semarang Tengah / Sekayu', status: 'AKTIF' },
  { kodePosPten: '50137', kotaPten: 'SEMARANG', kotaPtenMax15: 'KOTA SEMARANG', provinsiPten: 'Jawa Tengah', keterangan: 'Purwodinatan', status: 'AKTIF' },
  { kodePosPten: '55122', kotaPten: 'YOGYAKARTA', kotaPtenMax15: 'KOTA YOGYAKARTA', provinsiPten: 'D.I. Yogyakarta', keterangan: 'Gondomanan / Ngupasan', status: 'AKTIF' },
  { kodePosPten: '60234', kotaPten: 'SURABAYA', kotaPtenMax15: 'KOTA SURABAYA', provinsiPten: 'Jawa Timur', keterangan: 'Menanggal / Gayungan', status: 'AKTIF' },
  { kodePosPten: '60265', kotaPten: 'SURABAYA', kotaPtenMax15: 'KOTA SURABAYA', provinsiPten: 'Jawa Timur', keterangan: 'Keputran / Darmo', status: 'AKTIF' },
  { kodePosPten: '60271', kotaPten: 'SURABAYA', kotaPtenMax15: 'KOTA SURABAYA', provinsiPten: 'Jawa Timur', keterangan: 'Genteng / Basuki Rahmat', status: 'AKTIF' },
  { kodePosPten: '65119', kotaPten: 'MALANG', kotaPtenMax15: 'KOTA MALANG', provinsiPten: 'Jawa Timur', keterangan: 'Klojen / Kauman', status: 'AKTIF' },
  { kodePosPten: '70111', kotaPten: 'BANJARMASIN', kotaPtenMax15: 'BANJARMASIN', provinsiPten: 'Kalimantan Selatan', keterangan: 'Banjarmasin Tengah', status: 'AKTIF' },
  { kodePosPten: '80234', kotaPten: 'DENPASAR', kotaPtenMax15: 'KOTA DENPASAR', provinsiPten: 'Bali', keterangan: 'Denpasar Timur / Renon', status: 'AKTIF' },
  { kodePosPten: '90115', kotaPten: 'MAKASSAR', kotaPtenMax15: 'KOTA MAKASSAR', provinsiPten: 'Sulawesi Selatan', keterangan: 'Ujung Pandang / Pisang Utara', status: 'AKTIF' },
  { kodePosPten: '95122', kotaPten: 'MANADO', kotaPtenMax15: 'KOTA MANADO', provinsiPten: 'Sulawesi Utara', keterangan: 'Wenang / Pinaesaan', status: 'AKTIF' },
  { kodePosPten: '99224', kotaPten: 'JAYAPURA', kotaPtenMax15: 'KOTA JAYAPURA', provinsiPten: 'Papua', keterangan: 'Jayapura Selatan / Entrop', status: 'AKTIF' },
];

export const PTENManager: React.FC<PTENManagerProps> = ({
  targetRows = [],
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'master' | 'audit'>('master');
  const [ptenList, setPtenList] = useState<PTENRecord[]>(DEFAULT_PTEN_DATA);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedKota, setSelectedKota] = useState<string>('ALL');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination states (Default 10)
  const [masterPage, setMasterPage] = useState<number>(1);
  const [masterPageSize, setMasterPageSize] = useState<number | 'ALL'>(10);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditPageSize, setAuditPageSize] = useState<number | 'ALL'>(10);

  // Modals state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [detailRow, setDetailRow] = useState<any | null>(null);

  const [formData, setFormData] = useState<PTENRecord>({
    kodePosPten: '',
    kotaPten: '',
    kotaPtenMax15: '',
    provinsiPten: '',
    keterangan: '',
    status: 'AKTIF',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted PTEN data on mount
  useEffect(() => {
    let isMounted = true;
    const loadSaved = async () => {
      try {
        const saved = await getItem<PTENRecord[]>('pten_master_data');
        if (saved && Array.isArray(saved) && saved.length > 0 && isMounted) {
          setPtenList(saved);
        }
      } catch (err) {
        console.warn('Error loading PTEN data:', err);
      }
    };
    loadSaved();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save to IndexedDB
  const handleSaveData = async (listToSave = ptenList) => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await setItem('pten_master_data', listToSave);
      setSuccessMsg(`Berhasil menyimpan ${listToSave.length.toLocaleString('id-ID')} data PTEN!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan data PTEN');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Analisa Audit PTEN dari Target Data
  const auditAnalysis = useMemo(() => {
    let same = 0;
    let diff = 0;
    let empty = 0;
    const diffRows: TargetRow[] = [];

    targetRows.forEach((r) => {
      const kp = String(r['KODE POS'] || '').trim();
      const pten = String(r['KODE POS PTEN'] || '').trim();
      const cek = String(r['CEK KODE POS + PTEN'] || '').toUpperCase();

      if (cek === 'SAME' || cek === 'COCOK' || (kp && pten && kp === pten)) {
        same++;
      } else if (cek === 'DIFFERENT' || cek === 'TIDAK COCOK' || (kp && pten && kp !== pten)) {
        diff++;
        diffRows.push(r);
      } else {
        empty++;
      }
    });

    return {
      total: targetRows.length,
      same,
      diff,
      empty,
      diffRows,
      matchPercentage: targetRows.length > 0 ? ((same / targetRows.length) * 100).toFixed(1) : '100',
    };
  }, [targetRows]);

  // Unique Kota list for filter
  const kotaList = useMemo(() => {
    return Array.from(new Set(ptenList.map((p) => p.kotaPten?.trim()).filter(Boolean))).sort();
  }, [ptenList]);

  // Filtered Master Data PTEN
  const filteredPten = useMemo(() => {
    return ptenList.filter((item) => {
      if (selectedKota !== 'ALL' && item.kotaPten?.toLowerCase() !== selectedKota.toLowerCase()) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const t = searchTerm.toLowerCase();
      return (
        item.kodePosPten.toLowerCase().includes(t) ||
        item.kotaPten.toLowerCase().includes(t) ||
        (item.kotaPtenMax15 && item.kotaPtenMax15.toLowerCase().includes(t)) ||
        item.provinsiPten.toLowerCase().includes(t) ||
        item.keterangan.toLowerCase().includes(t)
      );
    });
  }, [ptenList, searchTerm, selectedKota]);

  // Completeness stats for PTEN
  const completenessStats = useMemo(() => {
    let complete = 0;
    ptenList.forEach((p) => {
      if (p.kodePosPten?.trim() && p.kotaPten?.trim()) {
        complete++;
      }
    });
    const isAllComplete = ptenList.length > 0 && complete === ptenList.length;
    const percentage = ptenList.length > 0 ? Math.round((complete / ptenList.length) * 100) : 0;
    return {
      isAllComplete,
      complete,
      total: ptenList.length,
      incomplete: ptenList.length - complete,
      percentage,
    };
  }, [ptenList]);

  // Master pagination
  const totalMasterPages = masterPageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredPten.length / masterPageSize));
  useEffect(() => {
    if (masterPage > totalMasterPages) setMasterPage(1);
  }, [totalMasterPages, masterPage]);

  const paginatedPten = useMemo(() => {
    if (masterPageSize === 'ALL') return filteredPten;
    const start = (masterPage - 1) * masterPageSize;
    return filteredPten.slice(start, start + masterPageSize);
  }, [filteredPten, masterPage, masterPageSize]);

  // Audit pagination
  const totalAuditPages = auditPageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(auditAnalysis.diffRows.length / auditPageSize));
  useEffect(() => {
    if (auditPage > totalAuditPages) setAuditPage(1);
  }, [totalAuditPages, auditPage]);

  const paginatedAuditRows = useMemo(() => {
    if (auditPageSize === 'ALL') return auditAnalysis.diffRows;
    const start = (auditPage - 1) * auditPageSize;
    return auditAnalysis.diffRows.slice(start, start + auditPageSize);
  }, [auditAnalysis.diffRows, auditPage, auditPageSize]);

  // Import Excel PTEN (Matches KOTA/KABUPATEN, KOTA/KABUPATEN MAX 15 DIGIT, KODEPOS)
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

        const imported: PTENRecord[] = rawJson.map((row: any) => {
          // Extract Kode Pos with flexible header matching
          const rawKodePos = String(
            row['KODEPOS (yang digunakan untuk pendaftaran merchant)'] ||
            row['KODEPOS'] ||
            row['KODE POS'] ||
            row['Kode Pos'] ||
            row['Kode Pos PTEN'] ||
            row['kodepos'] ||
            ''
          ).trim();

          const cleanKodePos = rawKodePos.replace(/\D/g, '').padStart(5, '0');

          // Extract Kota / Kabupaten
          const rawKota = String(
            row['KOTA/KABUPATEN'] ||
            row['KOTA/KABUPATEN MAX 15 DIGIT (yang digunakan untuk pendaftaran merchant)'] ||
            row['KOTA/KABUPATEN MAX 15 DIGIT'] ||
            row['Kota'] ||
            row['KOTA'] ||
            row['Dati II'] ||
            row['Kabupaten'] ||
            ''
          ).trim();

          const rawKotaMax15 = String(
            row['KOTA/KABUPATEN MAX 15 DIGIT (yang digunakan untuk pendaftaran merchant)'] ||
            row['KOTA/KABUPATEN MAX 15 DIGIT'] ||
            rawKota
          ).trim();

          const rawProvinsi = String(row['PROVINSI'] || row['Provinsi'] || '').trim();
          const rawKet = String(row['Keterangan'] || row['KETERANGAN'] || row['Kelurahan'] || '').trim();
          const rawStatus = String(row['Status'] || row['STATUS'] || 'AKTIF').trim().toUpperCase();

          return {
            kodePosPten: cleanKodePos || rawKodePos,
            kotaPten: rawKota.toUpperCase(),
            kotaPtenMax15: rawKotaMax15.toUpperCase(),
            provinsiPten: rawProvinsi,
            keterangan: rawKet,
            status: (rawStatus === 'NON-AKTIF' ? 'NON-AKTIF' : 'AKTIF') as 'AKTIF' | 'NON-AKTIF',
          };
        }).filter((item) => Boolean(item.kodePosPten && item.kodePosPten !== '00000'));

        if (imported.length === 0) {
          alert('Tidak ada baris data valid yang berhasil dibaca dari berkas Excel.');
          return;
        }

        setPtenList(imported);
        handleSaveData(imported);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSuccessMsg(`Berhasil mengimpor ${imported.length.toLocaleString('id-ID')} baris data master PTEN!`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err: any) {
        alert('Gagal membaca format file Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Export PTEN Master to Excel matching exact column format
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(
      ptenList.map((p) => ({
        'KOTA/KABUPATEN': p.kotaPten,
        'KOTA/KABUPATEN MAX 15 DIGIT (yang digunakan untuk pendaftaran merchant)': p.kotaPtenMax15 || p.kotaPten,
        'KODEPOS (yang digunakan untuk pendaftaran merchant)': p.kodePosPten,
        'PROVINSI': p.provinsiPten,
        'KETERANGAN': p.keterangan,
        'STATUS': p.status,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master_PTEN');
    XLSX.writeFile(wb, `Data_Master_PTEN_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      kodePosPten: '',
      kotaPten: '',
      kotaPtenMax15: '',
      provinsiPten: '',
      keterangan: '',
      status: 'AKTIF',
    });
    setEditingIndex(null);
    setModalMode('create');
  };

  // Open Edit Modal
  const handleOpenEdit = (index: number) => {
    const item = ptenList[index];
    setFormData({ ...item });
    setEditingIndex(index);
    setModalMode('edit');
  };

  // Open Detail Modal
  const handleOpenDetailModal = (index: number) => {
    const item = ptenList[index];
    setFormData({ ...item });
    setEditingIndex(index);
    setModalMode('detail');
  };

  // Submit Modal Form (Create / Edit)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.kodePosPten.trim() || !formData.kotaPten.trim()) {
      alert('Kolom Kode Pos PTEN dan Kota/Kabupaten wajib diisi!');
      return;
    }

    const cleanKodePos = formData.kodePosPten.replace(/\D/g, '').padStart(5, '0');
    const normalizedItem: PTENRecord = {
      ...formData,
      kodePosPten: cleanKodePos || formData.kodePosPten.trim(),
      kotaPten: formData.kotaPten.trim().toUpperCase(),
      kotaPtenMax15: (formData.kotaPtenMax15 || formData.kotaPten).trim().toUpperCase(),
      provinsiPten: formData.provinsiPten.trim(),
      keterangan: formData.keterangan.trim(),
      status: formData.status,
    };

    let updatedList: PTENRecord[];
    if (modalMode === 'edit' && editingIndex !== null) {
      updatedList = ptenList.map((item, i) => (i === editingIndex ? normalizedItem : item));
    } else {
      updatedList = [normalizedItem, ...ptenList];
    }

    setPtenList(updatedList);
    setModalMode(null);
    handleSaveData(updatedList);
  };

  // Delete PTEN record
  const handleConfirmDelete = () => {
    if (deleteTargetIndex === null) return;
    const updated = ptenList.filter((_, idx) => idx !== deleteTargetIndex);
    setPtenList(updated);
    setDeleteTargetIndex(null);
    handleSaveData(updated);
  };

  // Reset to default
  const handleResetToDefault = () => {
    setPtenList(DEFAULT_PTEN_DATA);
    setShowResetConfirm(false);
    handleSaveData(DEFAULT_PTEN_DATA);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Top Header Card matching Wilayah & Cabang */}
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
              background: 'linear-gradient(135deg, rgba(247, 184, 75, 0.15) 0%, rgba(64, 81, 137, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d68b0c',
              border: '1px solid rgba(247, 184, 75, 0.3)',
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#212529', margin: 0 }}>
              Master Data PTEN & Verifikasi Integritas
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#878a99', margin: '0.2rem 0 0' }}>
              Referensi resmi kode pos dan kota/kabupaten merchant PTEN untuk verifikasi dan rekonsiliasi data cabang nasional.
            </p>
          </div>
        </div>

        {/* Tab switcher & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportExcel}
            accept=".xlsx, .xls, .csv"
            style={{ display: 'none' }}
          />

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
              onClick={() => setActiveSubTab('master')}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: activeSubTab === 'master' ? 700 : 500,
                color: activeSubTab === 'master' ? '#405189' : '#878a99',
                background: activeSubTab === 'master' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeSubTab === 'master' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Master Referensi PTEN
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('audit')}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: activeSubTab === 'audit' ? 700 : 500,
                color: activeSubTab === 'audit' ? '#405189' : '#878a99',
                background: activeSubTab === 'audit' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeSubTab === 'audit' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <span>Hasil Verifikasi PTEN</span>
              {auditAnalysis.diff > 0 && (
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
                  {auditAnalysis.diff}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Import berkas Excel data PTEN (KODEPOS, KOTA/KABUPATEN)"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Upload size={13} />
            <span>Impor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExport}
            title="Export master PTEN ke berkas Excel"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={13} />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowResetConfirm(true)}
            title="Kembalikan ke data standar referensi PTEN"
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
            <span>Tambah Data PTEN</span>
          </button>

          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={() => handleSaveData()}
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

      {/* KPI Stats Cards matching Wilayah & Cabang */}
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
              Total Data Master PTEN
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#212529' }}>
              {ptenList.length.toLocaleString('id-ID')} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#878a99' }}>Entri</span>
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
            <MapPin size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600, textTransform: 'uppercase' }}>
              Cakupan Kota / Kab PTEN
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#212529' }}>
              {kotaList.length} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#878a99' }}>Kota/Kab</span>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '0.9rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: auditAnalysis.diff > 0 ? 'rgba(240, 101, 72, 0.12)' : 'rgba(41, 156, 219, 0.1)',
              color: auditAnalysis.diff > 0 ? '#f06548' : '#299cdb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600, textTransform: 'uppercase' }}>
              Perbedaan vs Data Target
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: auditAnalysis.diff > 0 ? '#f06548' : '#212529' }}>
              {auditAnalysis.diff} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#878a99' }}>Perbedaan</span>
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
                  <span>{completenessStats.incomplete} Data Belum Lengkap ({completenessStats.percentage}%)</span>
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
      {activeSubTab === 'master' ? (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '280px', maxWidth: '600px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
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
                  placeholder="Cari kode pos PTEN, kota, provinsi, keterangan..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setMasterPage(1);
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

              {/* Filter Kota */}
              <select
                value={selectedKota}
                onChange={(e) => {
                  setSelectedKota(e.target.value);
                  setMasterPage(1);
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
                <option value="ALL">Semua Kota ({kotaList.length})</option>
                {kotaList.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#878a99' }}>
                <span>Tampilkan:</span>
                <select
                  value={masterPageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                    setMasterPageSize(val);
                    setMasterPage(1);
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
                  <option value="ALL">Lihat Semua ({filteredPten.length})</option>
                </select>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#878a99' }}>
                Menampilkan{' '}
                <strong style={{ color: '#212529' }}>
                  {filteredPten.length === 0
                    ? 0
                    : masterPageSize === 'ALL'
                    ? 1
                    : (masterPage - 1) * (masterPageSize as number) + 1}
                </strong>{' '}
                -{' '}
                <strong style={{ color: '#212529' }}>
                  {masterPageSize === 'ALL'
                    ? filteredPten.length
                    : Math.min(masterPage * (masterPageSize as number), filteredPten.length)}
                </strong>{' '}
                dari <strong style={{ color: '#212529' }}>{filteredPten.length}</strong> master referensi PTEN
              </div>
            </div>
          </div>

          {/* Table Master PTEN */}
          <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto', maxHeight: '580px' }}>
            <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>KODEPOS</th>
                  <th>KOTA / KABUPATEN</th>
                  <th>KOTA/KABUPATEN MAX 15 DIGIT</th>
                  <th>PROVINSI</th>
                  <th>KETERANGAN</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>STATUS</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {filteredPten.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                      Tidak ada data master PTEN yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedPten.map((item, idx) => {
                    const originalIdx = ptenList.indexOf(item);
                    const displayRowNo =
                      masterPageSize === 'ALL'
                        ? idx + 1
                        : (masterPage - 1) * (masterPageSize as number) + idx + 1;

                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                        <td style={{ textAlign: 'center', color: '#878a99' }}>{displayRowNo}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="code-cell" style={{ background: '#fff9e6', color: '#d68b0c', fontWeight: 700 }}>
                            {item.kodePosPten}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: '#212529' }}>{item.kotaPten}</td>
                        <td style={{ color: '#495057', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                          {item.kotaPtenMax15 || item.kotaPten}
                        </td>
                        <td style={{ color: '#495057' }}>{item.provinsiPten || '-'}</td>
                        <td style={{ color: '#6c757d' }}>{item.keterangan || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${item.status === 'AKTIF' ? 'badge-match' : 'badge-level2'}`} style={{ fontSize: '0.68rem' }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(originalIdx)}
                              title="Lihat Detail PTEN"
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
                              title="Edit Data PTEN"
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
                              title="Hapus Data PTEN"
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
          {masterPageSize !== 'ALL' && totalMasterPages > 1 && (
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
                Halaman <strong style={{ color: '#212529' }}>{masterPage}</strong> dari{' '}
                <strong style={{ color: '#212529' }}>{totalMasterPages}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setMasterPage(1)}
                  disabled={masterPage === 1}
                  title="Halaman Pertama"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
                >
                  <ChevronsLeft size={13} />
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setMasterPage((p) => Math.max(1, p - 1))}
                  disabled={masterPage === 1}
                  title="Halaman Sebelumnya"
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                >
                  <ChevronLeft size={13} />
                </button>

                {Array.from({ length: totalMasterPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setMasterPage(pageNum)}
                    style={{
                      minWidth: '28px',
                      height: '28px',
                      padding: '0 0.4rem',
                      fontSize: '0.74rem',
                      fontWeight: masterPage === pageNum ? 700 : 500,
                      borderRadius: '4px',
                      border: masterPage === pageNum ? '1px solid #405189' : '1px solid #ced4da',
                      background: masterPage === pageNum ? '#405189' : '#ffffff',
                      color: masterPage === pageNum ? '#ffffff' : '#495057',
                      cursor: 'pointer',
                    }}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setMasterPage((p) => Math.min(totalMasterPages, p + 1))}
                  disabled={masterPage === totalMasterPages}
                  title="Halaman Berikutnya"
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                >
                  <ChevronRight size={13} />
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setMasterPage(totalMasterPages)}
                  disabled={masterPage === totalMasterPages}
                  title="Halaman Terakhir"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
                >
                  <ChevronsRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Audit View: Perbedaan Kode Pos PTEN */
        <div className="glass-card" style={{ padding: '1.15rem 1.35rem' }}>
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
            <div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#212529', margin: '0 0 0.25rem' }}>
                Daftar Baris dengan Perbedaan Kode Pos PTEN ({auditAnalysis.diffRows.length} Data)
              </h4>
              <p style={{ fontSize: '0.76rem', color: '#878a99', margin: 0 }}>
                Baris di bawah memiliki perbedaan antara kolom <strong>KODE POS</strong> dan <strong>KODE POS PTEN</strong> pada data target.
              </p>
            </div>

            {auditAnalysis.diffRows.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#878a99' }}>
                <span>Tampilkan:</span>
                <select
                  value={auditPageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                    setAuditPageSize(val);
                    setAuditPage(1);
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
                  <option value="ALL">Lihat Semua ({auditAnalysis.diffRows.length})</option>
                </select>
              </div>
            )}
          </div>

          {auditAnalysis.diffRows.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#0ab39c' }}>
              <CheckCircle2 size={36} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Seluruh Kode Pos Target Sesuai dengan PTEN!</div>
              <div style={{ fontSize: '0.76rem', color: '#878a99', marginTop: '0.25rem' }}>
                Tidak ditemukan anomali atau perbedaan antara Kode Pos Master dan Kode Pos PTEN.
              </div>
            </div>
          ) : (
            <>
              <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto', maxHeight: '580px' }}>
                <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                      <th>Wilayah</th>
                      <th>Nama Outlet / Cabang</th>
                      <th>Alamat</th>
                      <th style={{ width: '110px', textAlign: 'center' }}>Kode Pos Target</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Kode Pos PTEN</th>
                      <th style={{ width: '130px', textAlign: 'center' }}>Status PTEN</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAuditRows.map((r, idx) => {
                      const displayRowNo =
                        auditPageSize === 'ALL'
                          ? idx + 1
                          : (auditPage - 1) * (auditPageSize as number) + idx + 1;

                      return (
                        <tr key={idx} style={{ background: '#fffcf5' }}>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{displayRowNo}</td>
                          <td>
                            <span className="badge badge-level1">{r.Wilayah || '-'}</span>
                          </td>
                          <td style={{ fontWeight: 600, color: '#212529' }}>
                            {r['Nama Outlet'] || r.Cabang || r['Sandi Cabang'] || '-'}
                          </td>
                          <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.ALAMAT || '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="code-cell" style={{ background: '#e8f7f5', color: '#0ab39c', fontWeight: 700 }}>
                              {r['KODE POS'] || '-'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="code-cell" style={{ background: '#fff0ee', color: '#f06548', fontWeight: 700 }}>
                              {r['KODE POS PTEN'] || '-'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: 'rgba(240, 101, 72, 0.1)',
                                color: '#f06548',
                                border: '1px solid rgba(240, 101, 72, 0.3)',
                              }}
                            >
                              TIDAK COCOK
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setDetailRow(r)}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                            >
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Audit Pagination Footer */}
              {auditPageSize !== 'ALL' && totalAuditPages > 1 && (
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
                    Halaman <strong style={{ color: '#212529' }}>{auditPage}</strong> dari{' '}
                    <strong style={{ color: '#212529' }}>{totalAuditPages}</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setAuditPage(1)}
                      disabled={auditPage === 1}
                      title="Halaman Pertama"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
                    >
                      <ChevronsLeft size={13} />
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      disabled={auditPage === 1}
                      title="Halaman Sebelumnya"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                    >
                      <ChevronLeft size={13} />
                    </button>

                    {Array.from({ length: totalAuditPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setAuditPage(pageNum)}
                        style={{
                          minWidth: '28px',
                          height: '28px',
                          padding: '0 0.4rem',
                          fontSize: '0.74rem',
                          fontWeight: auditPage === pageNum ? 700 : 500,
                          borderRadius: '4px',
                          border: auditPage === pageNum ? '1px solid #405189' : '1px solid #ced4da',
                          background: auditPage === pageNum ? '#405189' : '#ffffff',
                          color: auditPage === pageNum ? '#ffffff' : '#495057',
                          cursor: 'pointer',
                        }}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                      disabled={auditPage === totalAuditPages}
                      title="Halaman Berikutnya"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                    >
                      <ChevronRight size={13} />
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setAuditPage(totalAuditPages)}
                      disabled={auditPage === totalAuditPages}
                      title="Halaman Terakhir"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
                    >
                      <ChevronsRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create / Edit / Detail PTEN Modal */}
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
                <ShieldCheck size={18} color="#d68b0c" />
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#212529' }}>
                  {modalMode === 'create' && 'Tambah Data Master PTEN'}
                  {modalMode === 'edit' && 'Edit Data Master PTEN'}
                  {modalMode === 'detail' && 'Detail Data Master PTEN'}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    KODEPOS (PTEN) <span style={{ color: '#f06548' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'detail'}
                    placeholder="Contoh: 10110"
                    value={formData.kodePosPten}
                    onChange={(e) => setFormData({ ...formData, kodePosPten: e.target.value })}
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
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    STATUS
                  </label>
                  <select
                    disabled={modalMode === 'detail'}
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.82rem',
                      borderRadius: '5px',
                      border: '1px solid #ced4da',
                      background: modalMode === 'detail' ? '#f8f9fa' : '#ffffff',
                    }}
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="NON-AKTIF">NON-AKTIF</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                  KOTA / KABUPATEN <span style={{ color: '#f06548' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={modalMode === 'detail'}
                  placeholder="Contoh: JAKARTA PUSAT"
                  value={formData.kotaPten}
                  onChange={(e) => setFormData({ ...formData, kotaPten: e.target.value, kotaPtenMax15: e.target.value.slice(0, 15) })}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    KOTA/KABUPATEN (MAX 15 DIGIT)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    disabled={modalMode === 'detail'}
                    placeholder="Maksimal 15 karakter"
                    value={formData.kotaPtenMax15 || ''}
                    onChange={(e) => setFormData({ ...formData, kotaPtenMax15: e.target.value })}
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
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                    PROVINSI
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === 'detail'}
                    placeholder="Contoh: DKI Jakarta"
                    value={formData.provinsiPten}
                    onChange={(e) => setFormData({ ...formData, provinsiPten: e.target.value })}
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

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                  KETERANGAN / KELURAHAN NODE
                </label>
                <input
                  type="text"
                  disabled={modalMode === 'detail'}
                  placeholder="Contoh: Gambir / Senayan"
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
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
                    {modalMode === 'create' ? 'Tambah PTEN' : 'Simpan Perubahan'}
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
              Hapus Data Master PTEN?
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#878a99', margin: '0 0 1.25rem' }}>
              Apakah Anda yakin ingin menghapus referensi PTEN kode pos{' '}
              <strong>{ptenList[deleteTargetIndex]?.kodePosPten}</strong> (
              {ptenList[deleteTargetIndex]?.kotaPten})?
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
            <RefreshCw size={36} color="#d68b0c" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: '#212529' }}>
              Reset Master PTEN ke Standar?
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#878a99', margin: '0 0 1.25rem' }}>
              Seluruh data PTEN akan dikembalikan ke daftar standar bawaan sistem.
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
                onClick={handleResetToDefault}
                style={{ background: '#d68b0c', color: '#ffffff', border: 'none' }}
              >
                Ya, Reset Standar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      {detailRow && (
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
              maxWidth: '520px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              border: '1px solid #e9ebec',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #e9ebec',
                background: '#fafbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#212529' }}>
                Detail Rekonsiliasi Kode Pos PTEN
              </h4>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#878a99' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Nama Outlet / Lokasi</span>
                <strong style={{ color: '#212529' }}>{detailRow['Nama Outlet'] || detailRow.Cabang || '-'}</strong>
              </div>
              <div>
                <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Alamat Lengkap</span>
                <div>{detailRow.ALAMAT || '-'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                <div style={{ background: '#e8f7f5', padding: '0.65rem', borderRadius: '4px', border: '1px solid #b7ebe4' }}>
                  <span style={{ color: '#0ab39c', fontWeight: 600, display: 'block', fontSize: '0.72rem' }}>Kode Pos Target</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0ab39c', fontFamily: 'var(--font-mono)' }}>
                    {detailRow['KODE POS'] || '-'}
                  </div>
                </div>
                <div style={{ background: '#fff0ee', padding: '0.65rem', borderRadius: '4px', border: '1px solid #fedcd6' }}>
                  <span style={{ color: '#f06548', fontWeight: 600, display: 'block', fontSize: '0.72rem' }}>Kode Pos PTEN</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f06548', fontFamily: 'var(--font-mono)' }}>
                    {detailRow['KODE POS PTEN'] || '-'}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid #e9ebec',
                background: '#fafbfe',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setDetailRow(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
