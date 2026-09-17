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
  Filter,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getItem, setItem } from '../../utils/storage';
import { DEFAULT_KODEPOS_DATA, type KodePosRecord } from './defaultKodePosData';
import { saveKodePosToNeon, loadKodePosFromNeon } from '../../utils/neonSync';

interface KodePosManagerProps {
  onKodePosCountChange?: (count: number) => void;
}

export const KodePosManager: React.FC<KodePosManagerProps> = ({
  onKodePosCountChange,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'lookup'>('list');
  const [kodePosList, setKodePosList] = useState<KodePosRecord[]>(DEFAULT_KODEPOS_DATA);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProvinsi, setSelectedProvinsi] = useState<string>('ALL');
  const [selectedKota, setSelectedKota] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [showBanner, setShowBanner] = useState<boolean>(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick lookup state
  const [lookupQuery, setLookupQuery] = useState<string>('');

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

  // Load Kode Pos: IndexedDB untuk tampil instan, lalu Neon (DB) sebagai sumber
  // utama yang menimpa di background agar data yang di-push ke DB selalu tampil.
  useEffect(() => {
    let isMounted = true;

    const applyList = (records: KodePosRecord[]) => {
      setKodePosList(records);
      onKodePosCountChange?.(records.length);
      setItem('kodepos_master_data', records);
    };

    const refreshFromNeon = async () => {
      const remote = await loadKodePosFromNeon();
      if (remote && Array.isArray(remote) && remote.length > 0 && isMounted) {
        applyList(remote as KodePosRecord[]);
      }
    };

    const loadSaved = async () => {
      try {
        const saved = await getItem<KodePosRecord[]>('kodepos_master_data');
        if (saved && Array.isArray(saved) && saved.length > 0) {
          if (!isMounted) return;
          setKodePosList(saved);
          onKodePosCountChange?.(saved.length);
        } else if (isMounted) {
          setKodePosList(DEFAULT_KODEPOS_DATA);
          onKodePosCountChange?.(DEFAULT_KODEPOS_DATA.length);
        }
        // Neon authoritative: timpa IndexedDB bila DB punya data
        await refreshFromNeon();
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

  // Filtered index list — track original indices so the table can edit/delete
  // without calling kodePosList.indexOf per row (O(n^2) freeze on large data).
  const filteredIdx = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const provFilter = selectedProvinsi.toUpperCase();
    const kotaFilter = selectedKota.toUpperCase();
    const statusFilter = selectedStatus.toUpperCase();

    const result: number[] = [];
    for (let i = 0; i < kodePosList.length; i++) {
      const item = kodePosList[i];
      if (selectedProvinsi !== 'ALL' && item.provinsi?.trim().toUpperCase() !== provFilter) {
        continue;
      }
      if (selectedKota !== 'ALL' && item.kabupatenKota?.trim().toUpperCase() !== kotaFilter) {
        continue;
      }
      if (selectedStatus !== 'ALL' && (item.status || 'AKTIF').toUpperCase() !== statusFilter) {
        continue;
      }
      if (
        !q ||
        item.kodePos?.toLowerCase().includes(q) ||
        item.kelurahan?.toLowerCase().includes(q) ||
        item.kecamatan?.toLowerCase().includes(q) ||
        item.kabupatenKota?.toLowerCase().includes(q) ||
        item.provinsi?.toLowerCase().includes(q)
      ) {
        result.push(i);
      }
    }
    return result;
  }, [kodePosList, searchTerm, selectedProvinsi, selectedKota, selectedStatus]);

  const filteredList = useMemo(() => filteredIdx.map((i) => kodePosList[i]), [filteredIdx, kodePosList]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedProvinsi, selectedKota, selectedStatus]);

  // Pagination calculation
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredList.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paginatedList = useMemo(() => {
    const idxSlice =
      pageSize === 'ALL'
        ? filteredIdx
        : filteredIdx.slice((page - 1) * (pageSize as number), (page - 1) * (pageSize as number) + (pageSize as number));
    return idxSlice.map((i) => ({ rec: kodePosList[i], idx: i }));
  }, [filteredIdx, kodePosList, page, pageSize]);

  // Compact sliding pagination helper matching RoleMapping & PTEN
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

  // Quick lookup search results
  const lookupResults = useMemo(() => {
    if (!lookupQuery.trim()) return [];
    const q = lookupQuery.trim().toLowerCase();
    return kodePosList.filter(
      (item) =>
        item.kodePos?.toLowerCase().includes(q) ||
        item.kelurahan?.toLowerCase().includes(q) ||
        item.kecamatan?.toLowerCase().includes(q) ||
        item.kabupatenKota?.toLowerCase().includes(q) ||
        item.provinsi?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [kodePosList, lookupQuery]);

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
    setSelectedProvinsi('ALL');
    setSelectedKota('ALL');
    setSelectedStatus('ALL');
    setSearchTerm('');
    setSuccessMsg('Data Kode Pos berhasil dikembalikan ke data standar bawaan!');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Import from Excel
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
          setErrorMsg('File Excel kosong atau format tidak sesuai.');
          return;
        }

        const imported: KodePosRecord[] = [];
        const seenKeys = new Set<string>();

        rawJson.forEach((row) => {
          const kpRaw = String(
            row['KODE POS'] ||
            row['KODEPOS'] ||
            row['Kode Pos'] ||
            row['kodepos'] ||
            row['kode_pos'] ||
            row['POSTAL CODE'] ||
            row['Postal Code'] ||
            ''
          ).trim();

          const cleanKp = kpRaw.replace(/\D/g, '').padStart(5, '0').slice(-5);

          const kelurahan = String(
            row['KELURAHAN'] ||
            row['Kelurahan'] ||
            row['DESA'] ||
            row['Desa'] ||
            row['KELURAHAN / DESA'] ||
            row['Kelurahan/Desa'] ||
            row['kelurahan'] ||
            ''
          ).trim();

          const kecamatan = String(
            row['KECAMATAN'] ||
            row['Kecamatan'] ||
            row['kecamatan'] ||
            ''
          ).trim();

          const kabKota = String(
            row['KABUPATEN/KOTA'] ||
            row['KABUPATEN / KOTA'] ||
            row['KABUPATEN'] ||
            row['Kabupaten'] ||
            row['KOTA'] ||
            row['Kota'] ||
            row['Kota/Kabupaten'] ||
            row['DATI II'] ||
            row['Dati II'] ||
            ''
          ).trim();

          const provinsi = String(
            row['PROVINSI'] ||
            row['Provinsi'] ||
            row['provinsi'] ||
            ''
          ).trim();

          const statusRaw = String(row['STATUS'] || row['Status'] || 'AKTIF').trim().toUpperCase();
          const status: 'AKTIF' | 'NON-AKTIF' = statusRaw === 'NON-AKTIF' || statusRaw === 'NON AKTIF' ? 'NON-AKTIF' : 'AKTIF';

          if (cleanKp && (kelurahan || kecamatan || kabKota)) {
            const key = `${cleanKp}-${kelurahan}-${kecamatan}-${kabKota}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              imported.push({
                kodePos: cleanKp,
                kelurahan,
                kecamatan,
                kabupatenKota: kabKota,
                provinsi,
                status,
              });
            }
          }
        });

        if (imported.length === 0) {
          setErrorMsg('Tidak ditemukan kolom Kode Pos yang valid dalam berkas Excel!');
          return;
        }

        setKodePosList(imported);
        handleSaveData(imported);
        setSuccessMsg(`Berhasil mengimpor ${imported.length.toLocaleString('id-ID')} data Kode Pos dari Excel!`);
        setTimeout(() => setSuccessMsg(null), 5000);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        setErrorMsg(`Gagal memproses file Excel: ${err.message}`);
        setTimeout(() => setErrorMsg(null), 5000);
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
        'KODE POS': '40115',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* 1. Top Header Card matching Wilayah, PTEN & Role Mapping */}
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
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(64, 81, 137, 0.15) 0%, rgba(53, 119, 241, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#405189',
              border: '1px solid rgba(64, 81, 137, 0.3)',
              flexShrink: 0,
            }}
          >
            <Mail size={22} />
          </div>
          <div>
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Master Data Kode Pos Indonesia</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: 'rgba(64, 81, 137, 0.1)',
                  color: '#405189',
                }}
              >
                {kodePosList.length.toLocaleString('id-ID')} Data
              </span>
            </div>
            <div className="section-subtitle">
              Referensi resmi kode pos wilayah kelurahan, kecamatan, kota/kabupaten & provinsi seluruh Indonesia.
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Upload size={14} />
            <span>Impor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExport}
            disabled={kodePosList.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={14} />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleDownloadTemplate}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={13} />
            <span>Template Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowResetConfirm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f06548', borderColor: 'rgba(240, 101, 72, 0.3)' }}
            title="Kembalikan ke data Kode Pos bawaan"
          >
            <RefreshCw size={13} />
            <span>Reset Standar</span>
          </button>

          <button
            type="button"
            className="btn btn-success btn-sm"
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
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={14} />
            <span>Tambah Data</span>
          </button>
        </div>
      </div>

      {/* 2. Informative Executive Banner */}
      {showBanner && (
        <div
          className="glass-card"
          style={{
            background: 'linear-gradient(135deg, #f0f4ff 0%, #e6f7ff 100%)',
            border: '1px solid #d0e2ff',
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
                Database Master Kode Pos & Wilayah Administrasi Seluruh Indonesia
              </h4>
              <p style={{ fontSize: '0.82rem', color: '#4a5568', margin: 0, lineHeight: 1.55 }}>
                Tersimpan <strong>{stats.totalRecords.toLocaleString('id-ID')} Kode Pos</strong> yang mencakup{' '}
                <strong>{stats.totalProvinsi} Provinsi</strong>, <strong>{stats.totalKota} Kota/Kabupaten</strong>,{' '}
                <strong>{stats.totalKecamatan} Kecamatan</strong>, dan <strong>{stats.totalKelurahan} Kelurahan/Desa</strong>.{' '}
                Data ini digunakan sebagai referensi lookup dan verifikasi alamat pada sistem pencocokan data.
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
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Notifications */}
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
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ab39c' }}
          >
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
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f06548' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 3. 5 KPI Metric Cards matching other menus */}
      <div className="metrics-grid">
        {/* Card 1: Total Kode Pos */}
        <div
          className="metric-card blue"
          onClick={() => {
            setSelectedProvinsi('ALL');
            setSelectedKota('ALL');
            setSelectedStatus('ALL');
            setSearchTerm('');
          }}
          style={{
            cursor: 'pointer',
            border: selectedProvinsi === 'ALL' && !searchTerm ? '2px solid #405189' : undefined,
          }}
          title="Klik untuk melihat Semua Kode Pos"
        >
          <div className="metric-header">
            <span className="metric-title">TOTAL KODE POS</span>
            <div className="metric-icon-bubble">
              <Mail size={14} />
            </div>
          </div>
          <div className="metric-value">{stats.totalRecords.toLocaleString('id-ID')}</div>
          <div className="metric-footer">{stats.totalAktif.toLocaleString('id-ID')} Aktif</div>
        </div>

        {/* Card 2: Total Provinsi */}
        <div className="metric-card emerald">
          <div className="metric-header">
            <span className="metric-title">TOTAL PROVINSI</span>
            <div className="metric-icon-bubble">
              <MapPin size={14} />
            </div>
          </div>
          <div className="metric-value">{stats.totalProvinsi.toLocaleString('id-ID')}</div>
          <div className="metric-footer">Cakupan Nasional</div>
        </div>

        {/* Card 3: Total Kota / Kab */}
        <div className="metric-card amber">
          <div className="metric-header">
            <span className="metric-title">TOTAL KOTA / KAB</span>
            <div className="metric-icon-bubble">
              <Building2 size={14} />
            </div>
          </div>
          <div className="metric-value">{stats.totalKota.toLocaleString('id-ID')}</div>
          <div className="metric-footer">Dati II Terdaftar</div>
        </div>

        {/* Card 4: Total Kecamatan */}
        <div className="metric-card purple">
          <div className="metric-header">
            <span className="metric-title">TOTAL KECAMATAN</span>
            <div className="metric-icon-bubble">
              <Sparkles size={14} />
            </div>
          </div>
          <div className="metric-value">{stats.totalKecamatan.toLocaleString('id-ID')}</div>
          <div className="metric-footer">Wilayah Kecamatan</div>
        </div>

        {/* Card 5: Total Kelurahan */}
        <div className="metric-card cyan">
          <div className="metric-header">
            <span className="metric-title">TOTAL KELURAHAN</span>
            <div className="metric-icon-bubble">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="metric-value">{stats.totalKelurahan.toLocaleString('id-ID')}</div>
          <div className="metric-footer">Kelurahan / Desa</div>
        </div>
      </div>

      {/* 4. Main Card Container with Sub-tabs */}
      <div className="glass-card" style={{ padding: '1.15rem 1.35rem' }}>
        {/* Sub-Tabs Navigation */}
        <div className="nav-tabs" style={{ display: 'inline-flex', marginBottom: '1rem' }}>
          <button
            type="button"
            className={`nav-tab-btn${activeSubTab === 'list' ? ' active' : ''}`}
            onClick={() => setActiveSubTab('list')}
          >
            <Mail size={14} />
            <span>Daftar Kode Pos Indonesia</span>
            <span className="nav-tab-badge">{filteredList.length.toLocaleString('id-ID')}</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn${activeSubTab === 'lookup' ? ' active' : ''}`}
            onClick={() => setActiveSubTab('lookup')}
          >
            <Search size={14} />
            <span>Pencarian Cepat & Verifikasi Kode Pos</span>
          </button>
        </div>

        {/* Tab 1: List View */}
        {activeSubTab === 'list' && (
          <>
            {/* Filter Toolbar */}
            <div className="filter-toolbar" style={{ marginBottom: '1rem' }}>
              <div className="filter-group" style={{ flex: 1, minWidth: '260px' }}>
                {/* Search Bar */}
                <div className="search-input-wrapper">
                  <Search size={14} className="search-icon-pos" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Cari Kode Pos, Kelurahan, Kota, Provinsi..."
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
                        background: 'none',
                        border: 'none',
                        color: '#878a99',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Filter Provinsi Dropdown */}
                <select
                  className="filter-select"
                  value={selectedProvinsi}
                  onChange={(e) => {
                    setSelectedProvinsi(e.target.value);
                    setSelectedKota('ALL');
                  }}
                >
                  <option value="ALL">Semua Provinsi ({provinsiOptions.length})</option>
                  {provinsiOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                {/* Filter Kota Dropdown */}
                <select
                  className="filter-select"
                  value={selectedKota}
                  onChange={(e) => setSelectedKota(e.target.value)}
                >
                  <option value="ALL">Semua Kota/Kab ({kotaOptions.length})</option>
                  {kotaOptions.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>

                {/* Filter Status */}
                <select
                  className="filter-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="ALL">Semua Status</option>
                  <option value="AKTIF">Status AKTIF</option>
                  <option value="NON-AKTIF">Status NON-AKTIF</option>
                </select>
              </div>

              {/* Page Size Selector */}
              <div className="filter-group">
                <label style={{ fontSize: '0.75rem', color: '#878a99' }}>Tampilkan:</label>
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
                  <option value={250}>250 Baris</option>
                  <option value="ALL">Lihat Semua ({filteredList.length})</option>
                </select>
              </div>
            </div>

            {/* Active Filter Indicator Badge */}
            {(searchTerm || selectedProvinsi !== 'ALL' || selectedKota !== 'ALL' || selectedStatus !== 'ALL') && (
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
                  {searchTerm && <strong>Pencarian: "{searchTerm}" </strong>}
                  {selectedProvinsi !== 'ALL' && <strong>Provinsi: {selectedProvinsi} </strong>}
                  {selectedKota !== 'ALL' && <strong>Kota: {selectedKota} </strong>}
                  {selectedStatus !== 'ALL' && <strong>Status: {selectedStatus} </strong>}
                  ({filteredList.length} data ditemukan)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedProvinsi('ALL');
                    setSelectedKota('ALL');
                    setSelectedStatus('ALL');
                  }}
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

            {/* Modern Table Container */}
            <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto', maxHeight: '580px' }}>
              <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                    <th style={{ width: '130px' }}>KODE POS</th>
                    <th>KELURAHAN / DESA</th>
                    <th>KECAMATAN</th>
                    <th>KOTA / KABUPATEN</th>
                    <th>PROVINSI</th>
                    <th style={{ width: '95px', textAlign: 'center' }}>STATUS</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                          <Mail size={32} color="#adb5bd" />
                          <span style={{ fontWeight: 600 }}>Tidak ada data Kode Pos yang cocok dengan kriteria pencarian.</span>
                          <span style={{ fontSize: '0.74rem' }}>Coba ubah kata kunci atau reset filter di atas.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedList.map(({ rec: item, idx: originalIdx }, pos) => {
                      const displayRowNo =
                        pageSize === 'ALL'
                          ? pos + 1
                          : (page - 1) * (pageSize as number) + pos + 1;

                      return (
                        <tr key={`kp-${originalIdx}`} style={{ background: pos % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{displayRowNo}</td>

                          {/* Kode Pos Cell with Copy */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span
                                className="code-cell"
                                style={{
                                  fontWeight: 800,
                                  fontSize: '0.84rem',
                                  color: '#405189',
                                  background: 'rgba(64, 81, 137, 0.08)',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                  letterSpacing: '0.5px',
                                }}
                              >
                                {item.kodePos}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(item.kodePos, `kp-${originalIdx}`)}
                                title="Salin Kode Pos"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: copiedId === `kp-${originalIdx}` ? '#0ab39c' : '#adb5bd',
                                  cursor: 'pointer',
                                  padding: '2px',
                                }}
                              >
                                {copiedId === `kp-${originalIdx}` ? <Check size={12} /> : <Copy size={12} />}
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
                                padding: '0.12rem 0.45rem',
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
                                background: item.status === 'NON-AKTIF' ? 'rgba(240, 101, 72, 0.12)' : 'rgba(10, 179, 156, 0.12)',
                                color: item.status === 'NON-AKTIF' ? '#f06548' : '#0ab39c',
                              }}
                            >
                              {item.status || 'AKTIF'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setDetailItem(item);
                                  setModalMode('detail');
                                }}
                                title="Lihat Detail Kode Pos"
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
                                onClick={() => {
                                  setFormData({ ...item });
                                  setEditingIndex(originalIdx);
                                  setModalMode('edit');
                                }}
                                title="Edit Data Kode Pos"
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
                                onClick={() => {
                                  setDeleteTargetIndex(originalIdx);
                                }}
                                title="Hapus Data Kode Pos"
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

            {/* Pagination Footer */}
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
                <span>
                  Menampilkan <strong>{((page - 1) * (pageSize as number)) + 1}</strong> -{' '}
                  <strong>{Math.min(page * (pageSize as number), filteredList.length)}</strong> dari{' '}
                  <strong>{filteredList.length.toLocaleString('id-ID')}</strong> entri
                </span>

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
        )}

        {/* Tab 2: Quick Lookup & Validation */}
        {activeSubTab === 'lookup' && (
          <div>
            <div style={{ background: '#f8f9fa', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e9ebec', marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#212529', margin: '0 0 0.5rem' }}>
                Pencarian Cepat Kode Pos & Wilayah
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#878a99', margin: '0 0 1rem' }}>
                Ketik 5-digit kode pos atau nama kelurahan/kecamatan/kota untuk mencari data wilayah secara instan.
              </p>

              <div style={{ position: 'relative', maxWidth: '500px' }}>
                <Search
                  size={16}
                  style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#878a99' }}
                />
                <input
                  type="text"
                  placeholder="Contoh: 10110 atau Gambir atau Surabaya..."
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem 0.6rem 2.3rem',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #ced4da',
                    background: '#ffffff',
                    fontWeight: 500,
                  }}
                  autoFocus
                />
                {lookupQuery && (
                  <button
                    type="button"
                    onClick={() => setLookupQuery('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#878a99',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {lookupQuery.trim() ? (
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#495057', marginBottom: '0.75rem' }}>
                  Hasil Pencarian ({lookupResults.length} data ditemukan):
                </div>

                {lookupResults.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#878a99', background: '#ffffff', borderRadius: '6px', border: '1px dashed #ced4da' }}>
                    Tidak ditemukan kode pos atau wilayah yang sesuai dengan "{lookupQuery}".
                  </div>
                ) : (
                  <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto', maxHeight: '420px' }}>
                    <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
                        <tr>
                          <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                          <th style={{ width: '120px' }}>KODE POS</th>
                          <th>KELURAHAN / DESA</th>
                          <th>KECAMATAN</th>
                          <th>KOTA / KABUPATEN</th>
                          <th>PROVINSI</th>
                          <th style={{ width: '90px', textAlign: 'center' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lookupResults.map((item, idx) => (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                            <td style={{ textAlign: 'center', color: '#878a99' }}>{idx + 1}</td>
                            <td>
                              <span
                                className="code-cell"
                                style={{
                                  fontWeight: 800,
                                  color: '#405189',
                                  background: 'rgba(64, 81, 137, 0.08)',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {item.kodePos}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, color: '#212529' }}>{item.kelurahan || '-'}</td>
                            <td style={{ color: '#495057' }}>{item.kecamatan || '-'}</td>
                            <td style={{ color: '#495057' }}>{item.kabupatenKota || '-'}</td>
                            <td>
                              <span style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: '#f1f3f5', color: '#495057' }}>
                                {item.provinsi || '-'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.12rem 0.45rem',
                                  borderRadius: '4px',
                                  background: item.status === 'NON-AKTIF' ? 'rgba(240, 101, 72, 0.12)' : 'rgba(10, 179, 156, 0.12)',
                                  color: item.status === 'NON-AKTIF' ? '#f06548' : '#0ab39c',
                                }}
                              >
                                {item.status || 'AKTIF'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#878a99', background: '#ffffff', borderRadius: '6px', border: '1px dashed #ced4da' }}>
                <Search size={28} color="#adb5bd" style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontWeight: 600 }}>Silakan masukkan kata kunci pada kotak pencarian di atas.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Modal: Create / Edit Form */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <Mail size={16} color="#405189" />
                {modalMode === 'create' ? 'Tambah Data Kode Pos' : 'Edit Data Kode Pos'}
              </h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalMode(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="modal-body">
                <div className="form-field">
                  <label className="form-label">
                    Kode Pos (5 Digit) <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    placeholder="Contoh: 10110"
                    className="form-control"
                    style={{ fontFamily: 'monospace', fontWeight: 700 }}
                    value={formData.kodePos}
                    onChange={(e) => setFormData({ ...formData, kodePos: e.target.value.replace(/\D/g, '') })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">
                      Kelurahan / Desa <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Gambir"
                      className="form-control"
                      value={formData.kelurahan}
                      onChange={(e) => setFormData({ ...formData, kelurahan: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">
                      Kecamatan <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Gambir"
                      className="form-control"
                      value={formData.kecamatan}
                      onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">Kota / Kabupaten</label>
                    <input
                      type="text"
                      placeholder="Contoh: Kota Jakarta Pusat"
                      className="form-control"
                      value={formData.kabupatenKota}
                      onChange={(e) => setFormData({ ...formData, kabupatenKota: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Provinsi</label>
                    <input
                      type="text"
                      placeholder="Contoh: DKI Jakarta"
                      className="form-control"
                      value={formData.provinsi}
                      onChange={(e) => setFormData({ ...formData, provinsi: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-label">Status Data</label>
                  <select
                    className="form-control"
                    value={formData.status || 'AKTIF'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'AKTIF' | 'NON-AKTIF' })}
                  >
                    <option value="AKTIF">AKTIF (Digunakan)</option>
                    <option value="NON-AKTIF">NON-AKTIF (Diabaikan)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setModalMode(null)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {modalMode === 'create' ? 'Simpan Data' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Detail View */}
      {modalMode === 'detail' && detailItem && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <Eye size={16} color="#405189" />
                Detail Referensi Kode Pos
              </h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalMode(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  textAlign: 'center',
                  padding: '0.85rem',
                  background: 'rgba(64, 81, 137, 0.06)',
                  borderRadius: '6px',
                  border: '1px solid rgba(64, 81, 137, 0.15)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600 }}>KODE POS RESMI</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#405189', letterSpacing: '1px', fontFamily: 'monospace' }}>
                  {detailItem.kodePos}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.8rem' }}>
                <div style={{ background: '#f8f9fa', padding: '0.6rem 0.75rem', borderRadius: '5px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#878a99', fontWeight: 600 }}>KELURAHAN / DESA</div>
                  <div style={{ fontWeight: 600, color: '#212529', marginTop: '0.15rem' }}>{detailItem.kelurahan || '-'}</div>
                </div>
                <div style={{ background: '#f8f9fa', padding: '0.6rem 0.75rem', borderRadius: '5px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#878a99', fontWeight: 600 }}>KECAMATAN</div>
                  <div style={{ fontWeight: 600, color: '#212529', marginTop: '0.15rem' }}>{detailItem.kecamatan || '-'}</div>
                </div>
                <div style={{ background: '#f8f9fa', padding: '0.6rem 0.75rem', borderRadius: '5px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#878a99', fontWeight: 600 }}>KOTA / KABUPATEN</div>
                  <div style={{ fontWeight: 600, color: '#212529', marginTop: '0.15rem' }}>{detailItem.kabupatenKota || '-'}</div>
                </div>
                <div style={{ background: '#f8f9fa', padding: '0.6rem 0.75rem', borderRadius: '5px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#878a99', fontWeight: 600 }}>PROVINSI</div>
                  <div style={{ fontWeight: 600, color: '#212529', marginTop: '0.15rem' }}>{detailItem.provinsi || '-'}</div>
                </div>
              </div>

              <div style={{ background: '#f8f9fa', padding: '0.6rem 0.75rem', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600 }}>STATUS OPERASIONAL</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    background: detailItem.status === 'NON-AKTIF' ? 'rgba(240, 101, 72, 0.12)' : 'rgba(10, 179, 156, 0.12)',
                    color: detailItem.status === 'NON-AKTIF' ? '#f06548' : '#0ab39c',
                  }}
                >
                  {detailItem.status || 'AKTIF'}
                </span>
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
          </div>
        </div>
      )}

      {/* 7. Modal: Delete Confirmation */}
      {deleteTargetIndex !== null && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <Trash2 size={16} color="#f06548" />
                Hapus Data Kode Pos?
              </h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteTargetIndex(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(240, 101, 72, 0.1)',
                  color: '#f06548',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={24} />
              </div>
              <p style={{ fontSize: '0.82rem', color: '#878a99', margin: 0, lineHeight: 1.5 }}>
                Data Kode Pos <strong>{kodePosList[deleteTargetIndex]?.kodePos}</strong> (
                {kodePosList[deleteTargetIndex]?.kelurahan}) akan dihapus dari daftar referensi.
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
                Ya, Hapus Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Reset Confirmation */}
      {showResetConfirm && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <RefreshCw size={16} color="#f06548" />
                Kembalikan ke Data Bawaan?
              </h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowResetConfirm(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(240, 101, 72, 0.1)',
                  color: '#f06548',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <RefreshCw size={24} />
              </div>
              <p style={{ fontSize: '0.82rem', color: '#878a99', margin: 0, lineHeight: 1.5 }}>
                Semua data tambahan / modifikasi kode pos saat ini akan digantikan kembali dengan daftar standar{' '}
                <strong>{DEFAULT_KODEPOS_DATA.length} Kode Pos</strong> bawaan sistem.
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
                onClick={handleConfirmReset}
              >
                Ya, Reset Standar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
