import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Mail,
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
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getItem, setItem } from '../../utils/storage';
import { DEFAULT_KODEPOS_DATA, type KodePosRecord } from './defaultKodePosData';
import { saveKodePosToNeon } from '../../utils/neonSync';

interface KodePosManagerProps {
  onKodePosCountChange?: (count: number) => void;
}

export const KodePosManager: React.FC<KodePosManagerProps> = ({
  onKodePosCountChange,
}) => {
  const [kodePosList, setKodePosList] = useState<KodePosRecord[]>(DEFAULT_KODEPOS_DATA);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProvinsi, setSelectedProvinsi] = useState<string>('ALL');
  const [selectedKota, setSelectedKota] = useState<string>('ALL');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination states (Default 10)
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(10);

  // Modals state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [detailItem, setDetailItem] = useState<KodePosRecord | null>(null);

  const [formData, setFormData] = useState<KodePosRecord>({
    kodePos: '',
    kelurahan: '',
    kecamatan: '',
    kabupatenKota: '',
    provinsi: '',
    status: 'AKTIF',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted Kode Pos data on mount from IndexedDB
  useEffect(() => {
    let isMounted = true;
    const loadSaved = async () => {
      try {
        const saved = await getItem<KodePosRecord[]>('kodepos_master_data');
        if (saved && Array.isArray(saved) && saved.length > 0 && isMounted) {
          setKodePosList(saved);
          onKodePosCountChange?.(saved.length);
        } else if (isMounted) {
          setKodePosList(DEFAULT_KODEPOS_DATA);
          onKodePosCountChange?.(DEFAULT_KODEPOS_DATA.length);
          setItem('kodepos_master_data', DEFAULT_KODEPOS_DATA);
        }
      } catch (err) {
        console.warn('Error loading Kode Pos data:', err);
      }
    };
    loadSaved();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save to IndexedDB + background sync ke Neon Postgres
  const handleSaveData = async (listToSave = kodePosList) => {
    setErrorMsg(null);
    try {
      await setItem('kodepos_master_data', listToSave);
      onKodePosCountChange?.(listToSave.length);
      setSuccessMsg(`Berhasil menyimpan ${listToSave.length.toLocaleString('id-ID')} data Kode Pos!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      // Fire-and-forget sync ke Neon (tidak block UI)
      saveKodePosToNeon(listToSave, 'replace').catch((e) =>
        console.warn('Neon kodepos sync skipped (offline/no DB):', e)
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan data Kode Pos');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // KPI Statistics Calculation
  const stats = useMemo(() => {
    const uniqueProvinsi = new Set<string>();
    const uniqueKota = new Set<string>();
    const uniqueKecamatan = new Set<string>();
    const uniqueKelurahan = new Set<string>();
    let aktifCount = 0;

    kodePosList.forEach((item) => {
      if (item.provinsi) uniqueProvinsi.add(item.provinsi.trim().toUpperCase());
      if (item.kabupatenKota) uniqueKota.add(item.kabupatenKota.trim().toUpperCase());
      if (item.kecamatan) uniqueKecamatan.add(item.kecamatan.trim().toUpperCase());
      if (item.kelurahan) uniqueKelurahan.add(item.kelurahan.trim().toUpperCase());
      if (item.status !== 'NON-AKTIF') aktifCount++;
    });

    return {
      totalRecords: kodePosList.length,
      totalProvinsi: uniqueProvinsi.size,
      totalKota: uniqueKota.size,
      totalKecamatan: uniqueKecamatan.size,
      totalKelurahan: uniqueKelurahan.size,
      totalAktif: aktifCount,
    };
  }, [kodePosList]);

  // Unique Dropdown Options
  const provinsiOptions = useMemo(() => {
    const setP = new Set<string>();
    kodePosList.forEach((item) => {
      if (item.provinsi) setP.add(item.provinsi.trim());
    });
    return Array.from(setP).sort((a, b) => a.localeCompare(b));
  }, [kodePosList]);

  const kotaOptions = useMemo(() => {
    const setK = new Set<string>();
    kodePosList.forEach((item) => {
      if (selectedProvinsi === 'ALL' || item.provinsi?.trim().toUpperCase() === selectedProvinsi.toUpperCase()) {
        if (item.kabupatenKota) setK.add(item.kabupatenKota.trim());
      }
    });
    return Array.from(setK).sort((a, b) => a.localeCompare(b));
  }, [kodePosList, selectedProvinsi]);

  // Filtered List with Memoization for instant search
  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const provFilter = selectedProvinsi.toUpperCase();
    const kotaFilter = selectedKota.toUpperCase();

    return kodePosList.filter((item) => {
      if (selectedProvinsi !== 'ALL' && item.provinsi?.trim().toUpperCase() !== provFilter) {
        return false;
      }
      if (selectedKota !== 'ALL' && item.kabupatenKota?.trim().toUpperCase() !== kotaFilter) {
        return false;
      }
      if (!q) return true;

      return (
        item.kodePos?.toLowerCase().includes(q) ||
        item.kelurahan?.toLowerCase().includes(q) ||
        item.kecamatan?.toLowerCase().includes(q) ||
        item.kabupatenKota?.toLowerCase().includes(q) ||
        item.provinsi?.toLowerCase().includes(q)
      );
    });
  }, [kodePosList, searchTerm, selectedProvinsi, selectedKota]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedProvinsi, selectedKota]);

  // Pagination calculation
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredList.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paginatedList = useMemo(() => {
    if (pageSize === 'ALL') return filteredList;
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  // Handle Create / Update Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.kodePos.trim()) {
      alert('Kode Pos wajib diisi!');
      return;
    }
    if (!formData.kelurahan.trim() && !formData.kecamatan.trim()) {
      alert('Kelurahan atau Kecamatan wajib diisi!');
      return;
    }

    const cleanRecord: KodePosRecord = {
      kodePos: formData.kodePos.trim(),
      kelurahan: formData.kelurahan.trim(),
      kecamatan: formData.kecamatan.trim(),
      kabupatenKota: formData.kabupatenKota.trim(),
      provinsi: formData.provinsi.trim(),
      status: formData.status || 'AKTIF',
    };

    let updatedList: KodePosRecord[];
    if (modalMode === 'create') {
      updatedList = [cleanRecord, ...kodePosList];
      setSuccessMsg(`Berhasil menambahkan Kode Pos ${cleanRecord.kodePos} (${cleanRecord.kelurahan})!`);
    } else if (modalMode === 'edit' && editingIndex !== null) {
      updatedList = [...kodePosList];
      updatedList[editingIndex] = cleanRecord;
      setSuccessMsg(`Berhasil memperbarui data Kode Pos ${cleanRecord.kodePos}!`);
    } else {
      return;
    }

    setKodePosList(updatedList);
    handleSaveData(updatedList);
    setModalMode(null);
    setEditingIndex(null);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Handle Delete Record
  const handleConfirmDelete = () => {
    if (deleteTargetIndex === null) return;
    const target = kodePosList[deleteTargetIndex];
    const updated = kodePosList.filter((_, idx) => idx !== deleteTargetIndex);
    setKodePosList(updated);
    handleSaveData(updated);
    setDeleteTargetIndex(null);
    setSuccessMsg(`Berhasil menghapus data Kode Pos ${target?.kodePos || ''}!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Handle Reset to Default
  const handleConfirmReset = () => {
    setKodePosList(DEFAULT_KODEPOS_DATA);
    handleSaveData(DEFAULT_KODEPOS_DATA);
    setShowResetConfirm(false);
    setSuccessMsg(`Berhasil mereset data Kode Pos ke data standar bawaan (${DEFAULT_KODEPOS_DATA.length} data)!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Excel Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const imported: KodePosRecord[] = rawJson.map((row: any) => {
          const kp = String(
            row['KODE POS'] ||
            row['KODEPOS'] ||
            row['Kode Pos'] ||
            row['Kode_Pos'] ||
            row['Postal Code'] ||
            row['POSTAL CODE'] ||
            row['Zip'] ||
            row['ZIP'] ||
            ''
          ).trim();

          const kel = String(
            row['KELURAHAN'] ||
            row['Kelurahan'] ||
            row['DESA'] ||
            row['Desa'] ||
            row['Kelurahan / Desa'] ||
            row['Kelurahan/Desa'] ||
            ''
          ).trim();

          const kec = String(
            row['KECAMATAN'] ||
            row['Kecamatan'] ||
            row['Distrik'] ||
            row['DISTRIK'] ||
            ''
          ).trim();

          const kabKota = String(
            row['KOTA'] ||
            row['Kota'] ||
            row['KABUPATEN'] ||
            row['Kabupaten'] ||
            row['KABUPATEN/KOTA'] ||
            row['Kabupaten/Kota'] ||
            row['DATI II'] ||
            row['Dati II'] ||
            row['Kota/Kab'] ||
            row['KOTA / KABUPATEN'] ||
            ''
          ).trim();

          const prov = String(
            row['PROVINSI'] ||
            row['Provinsi'] ||
            row['PROPINSI'] ||
            row['Propinsi'] ||
            row['DATI I'] ||
            row['Dati I'] ||
            ''
          ).trim();

          const rawStatus = String(row['STATUS'] || row['Status'] || 'AKTIF').toUpperCase();
          const status: 'AKTIF' | 'NON-AKTIF' = rawStatus.includes('NON') ? 'NON-AKTIF' : 'AKTIF';

          return {
            kodePos: kp,
            kelurahan: kel,
            kecamatan: kec,
            kabupatenKota: kabKota,
            provinsi: prov,
            status,
          };
        }).filter((item) => Boolean(item.kodePos));

        if (imported.length === 0) {
          alert('Tidak ada baris data dengan kolom KODE POS yang valid.');
          return;
        }

        setKodePosList(imported);
        handleSaveData(imported);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSuccessMsg(`Berhasil mengimpor ${imported.length.toLocaleString('id-ID')} baris data Kode Pos!`);
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
        'KODE POS': '10110',
        'KELURAHAN': 'Gambir',
        'KECAMATAN': 'Gambir',
        'KABUPATEN/KOTA': 'Kota Jakarta Pusat',
        'PROVINSI': 'DKI Jakarta',
        'STATUS': 'AKTIF',
      },
      {
        'KODE POS': '40111',
        'KELURAHAN': 'Braga',
        'KECAMATAN': 'Sumur Bandung',
        'KABUPATEN/KOTA': 'Kota Bandung',
        'PROVINSI': 'Jawa Barat',
        'STATUS': 'AKTIF',
      },
      {
        'KODE POS': '60261',
        'KELURAHAN': 'Embong Kaliasin',
        'KECAMATAN': 'Genteng',
        'KABUPATEN/KOTA': 'Kota Surabaya',
        'PROVINSI': 'Jawa Timur',
        'STATUS': 'AKTIF',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master_Kode_Pos');
    XLSX.writeFile(wb, 'Template_Upload_Master_Kode_Pos.xlsx');
  };

  // Export to Excel
  const handleExport = () => {
    const exportData = filteredList.length > 0 ? filteredList : kodePosList;
    const ws = XLSX.utils.json_to_sheet(
      exportData.map((r, idx) => ({
        'NO': idx + 1,
        'KODE POS': r.kodePos,
        'KELURAHAN / DESA': r.kelurahan,
        'KECAMATAN': r.kecamatan,
        'KABUPATEN / KOTA': r.kabupatenKota,
        'PROVINSI': r.provinsi,
        'STATUS': r.status || 'AKTIF',
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master_Kode_Pos');
    XLSX.writeFile(wb, `Master_Kode_Pos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Copy to clipboard helper
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. Header Card with Actions */}
      <div
        className="glass-card"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e9ebec',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(53, 119, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3577f1',
              flexShrink: 0,
            }}
          >
            <Mail size={19} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#212529', margin: 0 }}>
                Master Data Kode Pos Indonesia
              </h2>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  background: 'rgba(53, 119, 241, 0.12)',
                  color: '#3577f1',
                }}
              >
                {kodePosList.length.toLocaleString('id-ID')} Data
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#878a99', margin: '0.1rem 0 0' }}>
              Pusat referensi wilayah kode pos, kelurahan, kecamatan, kota/kabupaten & provinsi nasional
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={handleDownloadTemplate}
            title="Download Template Format Excel"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
          >
            <Download size={13} />
            <span>Template</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={handleExport}
            title="Export Data ke Excel"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
          >
            <Download size={13} />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => fileInputRef.current?.click()}
            title="Import Data dari Berkas Excel"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
          >
            <Upload size={13} />
            <span>Import Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-success"
            onClick={() => {
              setFormData({
                kodePos: '',
                kelurahan: '',
                kecamatan: '',
                kabupatenKota: '',
                provinsi: '',
                status: 'AKTIF',
              });
              setEditingIndex(null);
              setModalMode('create');
            }}
            title="Tambah Data Kode Pos Baru"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
          >
            <Plus size={13} />
            <span>Tambah Data</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={() => setShowResetConfirm(true)}
            title="Reset ke Data Bawaan"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
          >
            <RefreshCw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div
          style={{
            padding: '0.65rem 1rem',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            color: '#15803d',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={16} color="#16a34a" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '0.65rem 1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} color="#dc2626" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. KPI Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div
          className="metric-card"
          style={{
            padding: '0.85rem 1rem',
            background: '#ffffff',
            border: '1px solid #e9ebec',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'rgba(53, 119, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3577f1',
            }}
          >
            <Mail size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600 }}>TOTAL KODE POS</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#212529' }}>
              {stats.totalRecords.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div
          className="metric-card"
          style={{
            padding: '0.85rem 1rem',
            background: '#ffffff',
            border: '1px solid #e9ebec',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'rgba(10, 179, 156, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0ab39c',
            }}
          >
            <MapPin size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600 }}>TOTAL PROVINSI</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0ab39c' }}>
              {stats.totalProvinsi.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div
          className="metric-card"
          style={{
            padding: '0.85rem 1rem',
            background: '#ffffff',
            border: '1px solid #e9ebec',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'rgba(247, 184, 75, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706',
            }}
          >
            <Building2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600 }}>TOTAL KOTA / KAB</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#d97706' }}>
              {stats.totalKota.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div
          className="metric-card"
          style={{
            padding: '0.85rem 1rem',
            background: '#ffffff',
            border: '1px solid #e9ebec',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1',
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600 }}>TOTAL KECAMATAN</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#6366f1' }}>
              {stats.totalKecamatan.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div
          className="metric-card"
          style={{
            padding: '0.85rem 1rem',
            background: '#ffffff',
            border: '1px solid #e9ebec',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'rgba(41, 156, 219, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#299cdb',
            }}
          >
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600 }}>TOTAL KELURAHAN</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#299cdb' }}>
              {stats.totalKelurahan.toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter & Table Toolbar */}
      <div
        className="glass-card"
        style={{
          padding: '0.75rem 1rem',
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e9ebec',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Search & Select Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', flex: 1 }}>
          {/* Quick Search */}
          <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '340px' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#878a99' }}
            />
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Cari Kode Pos, Kelurahan, Kecamatan, Kota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '30px', fontSize: '0.78rem', height: '32px' }}
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
                  color: '#878a99',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Provinsi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#495057', whiteSpace: 'nowrap' }}>
              Provinsi:
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedProvinsi}
              onChange={(e) => {
                setSelectedProvinsi(e.target.value);
                setSelectedKota('ALL');
              }}
              style={{ fontSize: '0.75rem', height: '32px', minWidth: '150px' }}
            >
              <option value="ALL">Semua Provinsi ({provinsiOptions.length})</option>
              {provinsiOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Kota */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#495057', whiteSpace: 'nowrap' }}>
              Kota/Kab:
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedKota}
              onChange={(e) => setSelectedKota(e.target.value)}
              style={{ fontSize: '0.75rem', height: '32px', minWidth: '150px' }}
            >
              <option value="ALL">Semua Kota/Kab ({kotaOptions.length})</option>
              {kotaOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Page Size & Counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#878a99' }}>
            Menampilkan <strong>{filteredList.length.toLocaleString('id-ID')}</strong> dari{' '}
            <strong>{kodePosList.length.toLocaleString('id-ID')}</strong> data
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#495057' }}>Baris:</span>
            <select
              className="form-select form-select-sm"
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              style={{ fontSize: '0.75rem', height: '32px', width: '75px' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value="ALL">Semua</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Data Table */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e9ebec',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
        }}
      >
        <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.78rem' }}>
            <thead
              style={{
                background: '#f8f9fa',
                color: '#495057',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              }}
            >
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                <th style={{ minWidth: '110px' }}>Kode Pos</th>
                <th style={{ minWidth: '160px' }}>Kelurahan / Desa</th>
                <th style={{ minWidth: '150px' }}>Kecamatan</th>
                <th style={{ minWidth: '170px' }}>Kota / Kabupaten</th>
                <th style={{ minWidth: '150px' }}>Provinsi</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#878a99' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Mail size={36} color="#adb5bd" />
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Tidak ada data Kode Pos yang sesuai</span>
                      <span style={{ fontSize: '0.74rem' }}>
                        Coba sesuaikan kata kunci pencarian atau ubah filter provinsi/kota.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, idx) => {
                  const globalIdx = pageSize === 'ALL' ? idx : (page - 1) * (typeof pageSize === 'number' ? pageSize : 10) + idx;
                  const originalIndex = kodePosList.findIndex(
                    (r) =>
                      r.kodePos === item.kodePos &&
                      r.kelurahan === item.kelurahan &&
                      r.kecamatan === item.kecamatan &&
                      r.kabupatenKota === item.kabupatenKota
                  );

                  return (
                    <tr key={`kp-${item.kodePos}-${idx}`}>
                      <td style={{ textAlign: 'center', color: '#878a99', fontWeight: 600 }}>
                        {globalIdx + 1}
                      </td>

                      {/* Kode Pos Badge */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              fontSize: '0.82rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background: 'rgba(53, 119, 241, 0.09)',
                              color: '#3577f1',
                              border: '1px solid rgba(53, 119, 241, 0.25)',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {item.kodePos}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(item.kodePos, `kp-${idx}`)}
                            title="Salin Kode Pos"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiedId === `kp-${idx}` ? '#10b981' : '#adb5bd',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                          >
                            {copiedId === `kp-${idx}` ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      {/* Kelurahan */}
                      <td style={{ fontWeight: 600, color: '#212529' }}>
                        {item.kelurahan || '-'}
                      </td>

                      {/* Kecamatan */}
                      <td style={{ color: '#495057' }}>
                        {item.kecamatan || '-'}
                      </td>

                      {/* Kota / Kabupaten */}
                      <td style={{ color: '#495057' }}>
                        {item.kabupatenKota || '-'}
                      </td>

                      {/* Provinsi */}
                      <td>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '3px',
                            background: '#f1f3f5',
                            color: '#495057',
                            fontWeight: 500,
                          }}
                        >
                          {item.provinsi || '-'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: item.status === 'NON-AKTIF' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: item.status === 'NON-AKTIF' ? '#dc2626' : '#059669',
                          }}
                        >
                          {item.status || 'AKTIF'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost-primary"
                            onClick={() => {
                              setDetailItem(item);
                              setModalMode('detail');
                            }}
                            title="Lihat Detail"
                            style={{ padding: '0.2rem 0.35rem', color: '#3577f1' }}
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost-warning"
                            onClick={() => {
                              setFormData({ ...item });
                              setEditingIndex(originalIndex >= 0 ? originalIndex : idx);
                              setModalMode('edit');
                            }}
                            title="Edit Data"
                            style={{ padding: '0.2rem 0.35rem', color: '#d97706' }}
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost-danger"
                            onClick={() => {
                              setDeleteTargetIndex(originalIndex >= 0 ? originalIndex : idx);
                            }}
                            title="Hapus Data"
                            style={{ padding: '0.2rem 0.35rem', color: '#dc2626' }}
                          >
                            <Trash2 size={13} />
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

        {/* Pagination Footer */}
        {pageSize !== 'ALL' && totalPages > 1 && (
          <div
            style={{
              padding: '0.65rem 1rem',
              background: '#f8f9fa',
              borderTop: '1px solid #e9ebec',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
              Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong> ({filteredList.length.toLocaleString('id-ID')} Total)
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                title="Halaman Pertama"
                style={{ padding: '0.2rem 0.45rem' }}
              >
                <ChevronsLeft size={13} />
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title="Halaman Sebelumnya"
                style={{ padding: '0.2rem 0.45rem' }}
              >
                <ChevronLeft size={13} />
              </button>

              {/* Page Number Badges */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pNum = page - 2 + i;
                if (page < 3) pNum = i + 1;
                if (page > totalPages - 2) pNum = totalPages - 4 + i;
                if (pNum < 1 || pNum > totalPages) return null;

                return (
                  <button
                    key={pNum}
                    type="button"
                    className={`btn btn-sm ${page === pNum ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setPage(pNum)}
                    style={{
                      padding: '0.2rem 0.55rem',
                      fontSize: '0.74rem',
                      fontWeight: page === pNum ? 700 : 400,
                    }}
                  >
                    {pNum}
                  </button>
                );
              })}

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                title="Halaman Selanjutnya"
                style={{ padding: '0.2rem 0.45rem' }}
              >
                <ChevronRight size={13} />
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                title="Halaman Terakhir"
                style={{ padding: '0.2rem 0.45rem' }}
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Modal: Create / Edit Form */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="modal-container"
            style={{
              maxWidth: '520px',
              width: '92%',
              background: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              border: '1px solid #e9ebec',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid #e9ebec',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8f9fa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={16} color="#3577f1" />
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#212529' }}>
                  {modalMode === 'create' ? 'Tambah Data Kode Pos' : 'Edit Data Kode Pos'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#878a99' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: '0.25rem' }}>
                    Kode Pos (5 Digit) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    className="form-control form-control-sm"
                    placeholder="Contoh: 10110"
                    value={formData.kodePos}
                    onChange={(e) => setFormData({ ...formData, kodePos: e.target.value.replace(/\D/g, '') })}
                    style={{ fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: '0.25rem' }}>
                      Kelurahan / Desa <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="form-control form-control-sm"
                      placeholder="Contoh: Gambir"
                      value={formData.kelurahan}
                      onChange={(e) => setFormData({ ...formData, kelurahan: e.target.value })}
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: '0.25rem' }}>
                      Kecamatan <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="form-control form-control-sm"
                      placeholder="Contoh: Gambir"
                      value={formData.kecamatan}
                      onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: '0.25rem' }}>
                      Kota / Kabupaten
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Contoh: Kota Jakarta Pusat"
                      value={formData.kabupatenKota}
                      onChange={(e) => setFormData({ ...formData, kabupatenKota: e.target.value })}
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: '0.25rem' }}>
                      Provinsi
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Contoh: DKI Jakarta"
                      value={formData.provinsi}
                      onChange={(e) => setFormData({ ...formData, provinsi: e.target.value })}
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: '0.25rem' }}>
                    Status Data
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={formData.status || 'AKTIF'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'AKTIF' | 'NON-AKTIF' })}
                    style={{ fontSize: '0.8rem' }}
                  >
                    <option value="AKTIF">AKTIF (Digunakan)</option>
                    <option value="NON-AKTIF">NON-AKTIF (Diabaikan)</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem 1.25rem',
                  borderTop: '1px solid #e9ebec',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                  background: '#f8f9fa',
                }}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setModalMode(null)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-sm btn-primary">
                  {modalMode === 'create' ? 'Simpan Data' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Detail View */}
      {modalMode === 'detail' && detailItem && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="modal-container"
            style={{
              maxWidth: '480px',
              width: '92%',
              background: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              border: '1px solid #e9ebec',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid #e9ebec',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8f9fa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={16} color="#3577f1" />
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#212529' }}>
                  Detail Referensi Kode Pos
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#878a99' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '0.85rem',
                  background: 'rgba(53, 119, 241, 0.06)',
                  borderRadius: '6px',
                  border: '1px solid rgba(53, 119, 241, 0.15)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600 }}>KODE POS RESMI</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#3577f1', letterSpacing: '1px', fontFamily: 'monospace' }}>
                  {detailItem.kodePos}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                <span style={{ color: '#878a99' }}>Kelurahan / Desa:</span>
                <span style={{ fontWeight: 600, color: '#212529' }}>{detailItem.kelurahan || '-'}</span>

                <span style={{ color: '#878a99' }}>Kecamatan:</span>
                <span style={{ fontWeight: 600, color: '#212529' }}>{detailItem.kecamatan || '-'}</span>

                <span style={{ color: '#878a99' }}>Kota / Kabupaten:</span>
                <span style={{ fontWeight: 600, color: '#212529' }}>{detailItem.kabupatenKota || '-'}</span>

                <span style={{ color: '#878a99' }}>Provinsi:</span>
                <span style={{ fontWeight: 600, color: '#212529' }}>{detailItem.provinsi || '-'}</span>

                <span style={{ color: '#878a99' }}>Status:</span>
                <span style={{ fontWeight: 700, color: detailItem.status === 'NON-AKTIF' ? '#dc2626' : '#059669' }}>
                  {detailItem.status || 'AKTIF'}
                </span>
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid #e9ebec',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                background: '#f8f9fa',
              }}
            >
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setModalMode(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Delete Confirmation */}
      {deleteTargetIndex !== null && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="modal-container"
            style={{
              maxWidth: '420px',
              width: '92%',
              background: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              border: '1px solid #e9ebec',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.12)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  marginBottom: '0.75rem',
                }}
              >
                <Trash2 size={22} />
              </div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#212529', margin: '0 0 0.35rem' }}>
                Hapus Data Kode Pos?
              </h4>
              <p style={{ fontSize: '0.78rem', color: '#878a99', margin: 0 }}>
                Apakah Anda yakin ingin menghapus data Kode Pos{' '}
                <strong>{kodePosList[deleteTargetIndex]?.kodePos}</strong> ({kodePosList[deleteTargetIndex]?.kelurahan})?
              </p>
            </div>

            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid #e9ebec',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                background: '#f8f9fa',
              }}
            >
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setDeleteTargetIndex(null)}
              >
                Batal
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={handleConfirmDelete}>
                Ya, Hapus Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Reset Confirmation */}
      {showResetConfirm && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="modal-container"
            style={{
              maxWidth: '440px',
              width: '92%',
              background: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              border: '1px solid #e9ebec',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'rgba(247, 184, 75, 0.12)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                  marginBottom: '0.75rem',
                }}
              >
                <RefreshCw size={22} />
              </div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#212529', margin: '0 0 0.35rem' }}>
                Reset ke Data Awal Bawaan?
              </h4>
              <p style={{ fontSize: '0.78rem', color: '#878a99', margin: 0 }}>
                Data Kode Pos saat ini akan dikembalikan ke data percontohan standar awal ({DEFAULT_KODEPOS_DATA.length} data).
              </p>
            </div>

            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid #e9ebec',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                background: '#f8f9fa',
              }}
            >
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowResetConfirm(false)}
              >
                Batal
              </button>
              <button type="button" className="btn btn-sm btn-warning" onClick={handleConfirmReset}>
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
