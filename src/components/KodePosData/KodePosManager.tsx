import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ExternalLink,
  Navigation,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  saveKodePosToNeon,
  clearKodePosFromNeon,
  fetchKodePosPage,
  fetchKodePosStats,
  fetchKodePosOptions,
  fetchKodePosExport,
  createKodePosRow,
  updateKodePosRow,
  deleteKodePosRow,
  fetchKodePosGeoStats,
  runKodePosGeoBatch,
  mapsUrlFor,
  geoLabel,
  type KodePosRow,
  type KodePosStats,
  type KodePosGeoStats,
} from '../../utils/neonSync';
import { getStoredGoogleApiKey } from '../../utils/onlineGeoCoder';
import { KodePosSyncModal } from './KodePosSyncModal';
import { useGeoTooltip } from '../GeoTooltip';

interface KodePosManagerProps {
  onKodePosCountChange?: (count: number) => void;
}

export const KodePosManager: React.FC<KodePosManagerProps> = ({
  onKodePosCountChange,
}) => {
  // Server-driven data (Neon Postgres adalah satu-satunya sumber data)
  const [rows, setRows] = useState<KodePosRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const [stats, setStats] = useState<KodePosStats>({
    total: 0,
    totalProvinsi: 0,
    totalKota: 0,
    totalKecamatan: 0,
    totalKelurahan: 0,
    totalAktif: 0,
  });
  const [provinsiOptions, setProvinsiOptions] = useState<string[]>([]);
  const [kotaOptions, setKotaOptions] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedProvinsi, setSelectedProvinsi] = useState<string>('ALL');
  const [selectedKota, setSelectedKota] = useState<string>('ALL');

  const [showBanner, setShowBanner] = useState<boolean>(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KodePosRow | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [detailItem, setDetailItem] = useState<KodePosRow | null>(null);

  // Titik koordinat (kodepos_geo di Neon)
  const [geoStats, setGeoStats] = useState<KodePosGeoStats | null>(null);
  const [geoRun, setGeoRun] = useState<{ aktif: boolean; mode: 'isi' | 'verifikasi'; pesan: string; persen: number; diproses: number; sisa: number }>({
    aktif: false,
    mode: 'isi',
    pesan: '',
    persen: 0,
    diproses: 0,
    sisa: 0,
  });
  const geoStopRef = useRef<boolean>(false);

  const [formData, setFormData] = useState<KodePosRow>({
    kodePos: '',
    kelurahan: '',
    kecamatan: '',
    kabupatenKota: '',
    provinsi: '',
    status: 'AKTIF',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss the info banner after 20 seconds
  useEffect(() => {
    if (!showBanner) return;
    const t = setTimeout(() => setShowBanner(false), 20000);
    return () => clearTimeout(t);
  }, [showBanner]);

  // Debounce pencarian agar tidak menembak DB tiap ketikan
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset ke halaman 1 saat filter / pencarian berubah
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedProvinsi, selectedKota]);

  const refreshStats = useCallback(async () => {
    const s = await fetchKodePosStats();
    if (s) {
      setStats(s);
      onKodePosCountChange?.(s.total);
    }
  }, [onKodePosCountChange]);

  // Muat statistik KPI saat mount & setelah mutasi
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Muat opsi dropdown provinsi + kota (kota mengikuti provinsi terpilih)
  useEffect(() => {
    let alive = true;
    fetchKodePosOptions(selectedProvinsi).then((r) => {
      if (!alive || !r) return;
      setProvinsiOptions(r.provinsi);
      setKotaOptions(r.kota);
    });
    return () => {
      alive = false;
    };
  }, [selectedProvinsi]);

  // Muat SATU halaman data dari Neon (server-side pagination + filter)
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchKodePosPage({
      page,
      pageSize,
      search: debouncedSearch,
      provinsi: selectedProvinsi,
      kota: selectedKota,
    }).then((r) => {
      if (!alive) return;
      if (r) {
        setRows(r.data);
        setTotal(r.total);
        setTotalPages(r.totalPages);
        setErrorMsg(null);
      } else {
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setErrorMsg('Gagal memuat data Kode Pos dari database.');
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [page, pageSize, debouncedSearch, selectedProvinsi, selectedKota, reloadKey]);

  // Jaga page tetap valid bila totalPages menyusut
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  // Compact sliding pagination helper matching RoleMapping & PTEN
  const getPaginationRange = (curr: number, tp: number): (number | string)[] => {
    if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1);
    const pages: (number | string)[] = [1];
    let start = Math.max(2, curr - 1);
    let end = Math.min(tp - 1, curr + 1);
    if (curr <= 3) {
      start = 2;
      end = 4;
    } else if (curr >= tp - 2) {
      start = tp - 3;
      end = tp - 1;
    }
    if (start > 2) pages.push('ell-start');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < tp - 1) pages.push('ell-end');
    pages.push(tp);
    return pages;
  };

  const refreshAfterMutation = () => {
    refreshStats();
    setReloadKey((k) => k + 1);
  };

  // ─────────────── Titik koordinat kode pos ───────────────
  const refreshGeo = useCallback(async () => {
    const g = await fetchKodePosGeoStats();
    if (g) setGeoStats(g);
  }, []);

  useEffect(() => {
    void refreshGeo();
  }, [refreshGeo, reloadKey]);

  /** Kunci Google hanya bisa datang dari localStorage (dialog di peta) atau Vercel env. */
  const kunciGoogle = Boolean(getStoredGoogleApiKey()) || Boolean(geoStats?.googleSiap);
  const { tipProps, tooltipNode } = useGeoTooltip();

  // Dialog detail ikut Tutup dengan Esc, seperti dialog Sync Data.
  useEffect(() => {
    if (modalMode !== 'detail') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalMode(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalMode]);

  const jalankanGeo = async (mode: 'isi' | 'verifikasi') => {
    if (geoRun.aktif) {
      geoStopRef.current = true;
      return;
    }
    geoStopRef.current = false;
    setGeoRun({ aktif: true, mode, pesan: 'Menghubungi penyedia peta...', persen: 0, diproses: 0, sisa: 0 });
    let diproses = 0;
    let pesanAkhir = '';
    try {
      // Serverless Vercel mati setelah 60 detik, jadi tahap kecil diulang terus.
      while (!geoStopRef.current) {
        const hasil = await runKodePosGeoBatch({
          mode,
          jumlah: 40,
          provinsi: selectedProvinsi !== 'ALL' ? selectedProvinsi : null,
          apiKey: getStoredGoogleApiKey(),
        });
        if (!hasil) {
          pesanAkhir = 'Server geocoding gagal menjawab. Coba lagi.';
          break;
        }
        if (hasil.error) {
          pesanAkhir = hasil.error;
          break;
        }
        diproses += hasil.diproses;
        const sisa = hasil.menunggu || 0;
        const keterangan =
          (mode === 'isi'
            ? `${diproses.toLocaleString('id-ID')} kode pos dikerjakan · ${sisa.toLocaleString('id-ID')} belum punya titik`
            : `${diproses.toLocaleString('id-ID')} titik dicek ke Google · ${sisa.toLocaleString('id-ID')} masih belum terverifikasi`) +
          (hasil.googleTerhenti ? ' · kuota Google habis, titik diisi ESRI' : '');
        setGeoRun({
          aktif: true,
          mode,
          pesan: keterangan,
          persen: Math.min(99, Math.round((diproses / Math.max(diproses + sisa, 1)) * 100)),
          diproses,
          sisa,
        });
        if (hasil.diproses === 0 || sisa === 0) break;
      }
    } finally {
      geoStopRef.current = false;
      setGeoRun({ aktif: false, mode, pesan: pesanAkhir, persen: 0, diproses: 0, sisa: 0 });
      await refreshGeo();
      setReloadKey((k) => k + 1);
    }
  };

  // Handle Create / Update Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.kodePos.trim()) {
      alert('Kode Pos wajib diisi!');
      return;
    }
    if (!formData.kelurahan.trim() && !formData.kecamatan.trim()) {
      alert('Kelurahan atau Kecamatan wajib diisi!');
      return;
    }

    const cleanRecord: KodePosRow = {
      kodePos: formData.kodePos.trim(),
      kelurahan: formData.kelurahan.trim(),
      kecamatan: formData.kecamatan.trim(),
      kabupatenKota: formData.kabupatenKota.trim(),
      provinsi: formData.provinsi.trim(),
      status: formData.status || 'AKTIF',
    };

    let ok = false;
    if (modalMode === 'create') {
      ok = await createKodePosRow(cleanRecord);
      if (ok) setSuccessMsg(`Berhasil menambahkan Kode Pos ${cleanRecord.kodePos} (${cleanRecord.kelurahan})!`);
    } else if (modalMode === 'edit' && editingId !== null) {
      ok = await updateKodePosRow(editingId, cleanRecord);
      if (ok) setSuccessMsg(`Berhasil memperbarui data Kode Pos ${cleanRecord.kodePos}!`);
    } else {
      return;
    }

    if (ok) {
      setModalMode(null);
      setEditingId(null);
      refreshAfterMutation();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg('Gagal menyimpan data Kode Pos ke database.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Handle Delete Record
  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteTarget.id == null) return;
    const ok = await deleteKodePosRow(deleteTarget.id);
    if (ok) {
      setDeleteTarget(null);
      setSuccessMsg(`Berhasil menghapus data Kode Pos ${deleteTarget.kodePos || ''}!`);
      refreshAfterMutation();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setDeleteTarget(null);
      setErrorMsg('Gagal menghapus data Kode Pos dari database.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Handle Kosongkan Data Kode Pos
  const handleConfirmReset = async () => {
    const ok = await clearKodePosFromNeon();
    setShowResetConfirm(false);
    if (ok) {
      setSelectedProvinsi('ALL');
      setSelectedKota('ALL');
      setSearchTerm('');
      setSuccessMsg('Seluruh data Kode Pos dikosongkan. Titik koordinat & daftar baseline tetap.');
      refreshAfterMutation();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg('Gagal mengosongkan data Kode Pos di database.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Import from Excel
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
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

        const imported: KodePosRow[] = [];
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

        const ok = await saveKodePosToNeon(imported, 'replace');
        if (ok) {
          setSuccessMsg(`Berhasil mengimpor ${imported.length.toLocaleString('id-ID')} data Kode Pos dari Excel!`);
          refreshAfterMutation();
          setTimeout(() => setSuccessMsg(null), 5000);
        } else {
          setErrorMsg('Gagal menyimpan hasil impor ke database.');
          setTimeout(() => setErrorMsg(null), 5000);
        }
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

  // Export to Excel (ambil semua baris yang cocok filter dari server)
  const handleExport = async () => {
    const exportRows = await fetchKodePosExport({
      search: debouncedSearch,
      provinsi: selectedProvinsi,
      kota: selectedKota,
    });
    if (!exportRows || exportRows.length === 0) {
      setErrorMsg('Tidak ada data untuk diekspor.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    const ws = XLSX.utils.json_to_sheet(
      exportRows.map((r, idx) => ({
        'NO': idx + 1,
        'KODE POS': r.kodePos,
        'KELURAHAN / DESA': r.kelurahan,
        'KECAMATAN': r.kecamatan,
        'KABUPATEN / KOTA': r.kabupatenKota,
        'PROVINSI': r.provinsi,
        'STATUS': r.status || 'AKTIF',
        'LATITUDE': r.latitude ?? '',
        'LONGITUDE': r.longitude ?? '',
        'SUMBER KOORDINAT': r.latitude == null ? '' : geoLabel(r).replace('Sumber: ', ''),
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

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

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
                {stats.total.toLocaleString('id-ID')} Data
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
            disabled={total === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={14} />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowSyncModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            title="Periksa kelengkapan & kevalidan kode pos terhadap database Neon"
          >
            <RefreshCw size={13} />
            <span>Sync Data</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => void jalankanGeo('isi')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: '#0ab39c',
              borderColor: 'rgba(10, 179, 156, 0.35)',
            }}
            {...tipProps(
              (geoStats?.menunggu
                ? `Cari titik koordinat untuk ${geoStats.menunggu.toLocaleString('id-ID')} kode pos yang belum punya lokasi. `
                : 'Cari titik koordinat kode pos yang belum punya lokasi. ') +
              (kunciGoogle
                ? 'Google Geocoding dipakai lebih dulu.'
                : 'Kunci Google belum dipasang, jadi titik diisi ESRI/OpenStreetMap (kolom sumber menandai itu).')
            )}
          >
            <Navigation size={13} />
            <span>{geoRun.aktif && geoRun.mode === 'isi' ? 'Hentikan' : 'Isi Koordinat'}</span>
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
            title="Kosongkan seluruh baris Kode Pos. Titik koordinat dan daftar baseline tetap."
          >
            <Trash2 size={13} />
            <span>Kosongkan Data</span>
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
              setEditingId(null);
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
                Tersimpan <strong>{stats.total.toLocaleString('id-ID')} Kode Pos</strong> yang mencakup{' '}
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

      {/* 3. 6 KPI Metric Cards matching other menus */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div
          className="metric-card blue"
          onClick={() => {
            setSelectedProvinsi('ALL');
            setSelectedKota('ALL');
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
          <div className="metric-value">{stats.total.toLocaleString('id-ID')}</div>
          <div className="metric-footer">{stats.totalAktif.toLocaleString('id-ID')} Aktif</div>
        </div>

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

        <div
          className="metric-card emerald"
          {...tipProps(
            geoRun.aktif
              ? geoRun.pesan
              : geoStats
                ? `${geoStats.geo.punya.toLocaleString('id-ID')} kode pos punya titik · ${geoStats.geo.google.toLocaleString('id-ID')} terverifikasi Google · ${geoStats.menunggu.toLocaleString('id-ID')} belum dicari` +
                  (geoStats.geo.perkiraan ? ` · ${geoStats.geo.perkiraan.toLocaleString('id-ID')} hanya perkiraan wilayah` : '') +
                  (geoStats.geo.gagal ? ` · ${geoStats.geo.gagal.toLocaleString('id-ID')} tidak ditemukan` : '')
                : 'Titik koordinat kode pos diambil dari tabel kodepos_geo di Neon'
          )}
        >
          <div className="metric-header">
            <span className="metric-title">TITIK KOORDINAT</span>
            <div className="metric-icon-bubble">
              <Navigation size={14} />
            </div>
          </div>
          <div className="metric-value">
            {(geoRun.aktif ? geoRun.diproses : geoStats?.geo.punya || 0).toLocaleString('id-ID')}
          </div>
          <div className="metric-footer">
            {geoRun.aktif
              ? `${geoRun.sisa.toLocaleString('id-ID')} belum ada · ${geoRun.persen}%`
              : geoRun.pesan
                ? geoRun.pesan
                : geoStats?.geo.google
                  ? `${geoStats.geo.google.toLocaleString('id-ID')} dari Google`
                  : `${(geoStats?.menunggu || 0).toLocaleString('id-ID')} belum ada`}
          </div>
          {geoRun.aktif && (
            <div style={{ marginTop: '0.5rem', height: '5px', background: 'rgba(10, 179, 156, 0.15)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${geoRun.persen}%`, height: '100%', background: 'linear-gradient(90deg, #405189, #0ab39c)', transition: 'width .2s' }} />
            </div>
          )}
        </div>
      </div>

      {/* 4. Main Card Container with List */}
      <div className="glass-card" style={{ padding: '1.15rem 1.35rem' }}>
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
                  aria-label="Hapus kata kunci pencarian"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: '#5b5f6e',
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
          </div>

          {/* Page Size Selector */}
          <div className="filter-group">
            <label style={{ fontSize: '0.75rem', color: '#878a99' }}>Tampilkan:</label>
            <select
              className="filter-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
              <option value={250}>250 Baris</option>
            </select>
          </div>
        </div>

        {/* Active Filter Indicator Badge */}
        {(searchTerm || selectedProvinsi !== 'ALL' || selectedKota !== 'ALL') && (
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
              ({total.toLocaleString('id-ID')} data ditemukan)
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedProvinsi('ALL');
                setSelectedKota('ALL');
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
                <th style={{ width: '110px', textAlign: 'right' }} title="Titik koordinat kode pos di Neon">LATITUDE</th>
                <th style={{ width: '110px', textAlign: 'right' }} title="Titik koordinat kode pos di Neon">LONGITUDE</th>
                <th style={{ width: '140px', textAlign: 'center' }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                    Memuat data dari database...
                  </td>
                </tr>
              ) : total === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Mail size={32} color="#adb5bd" />
                      <span style={{ fontWeight: 600 }}>Tidak ada data Kode Pos yang cocok dengan kriteria pencarian.</span>
                      <span style={{ fontSize: '0.74rem' }}>Coba ubah kata kunci atau reset filter di atas.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((item, pos) => {
                  const displayRowNo = (page - 1) * pageSize + pos + 1;
                  const rowKey = `kp-${item.id ?? pos}`;

                  return (
                    <tr key={rowKey} style={{ background: pos % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
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
                            onClick={() => handleCopyText(item.kodePos, rowKey)}
                            title="Salin Kode Pos"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiedId === rowKey ? '#0ab39c' : '#adb5bd',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                          >
                            {copiedId === rowKey ? <Check size={12} /> : <Copy size={12} />}
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

                      {/* Latitude / Longitude */}
                      <td
                        {...tipProps(geoLabel(item))}
                        style={{
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontSize: '0.74rem',
                          color: item.latitude == null ? '#adb5bd' : '#495057',
                        }}
                      >
                        {item.latitude == null ? '—' : item.latitude.toFixed(6)}
                      </td>
                      <td
                        {...tipProps(geoLabel(item))}
                        style={{
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontSize: '0.74rem',
                          color: item.longitude == null ? '#adb5bd' : '#495057',
                        }}
                      >
                        {item.longitude == null ? '—' : item.longitude.toFixed(6)}
                        {item.latitude != null &&
                          item.longitude != null &&
                          (item.geoTerverifikasi || item.geoPresisi === 'PERKIRAAN WILAYAH') && (
                            <span
                              style={{
                                display: 'block',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                letterSpacing: '0.03em',
                                color: item.geoTerverifikasi ? '#0ab39c' : '#b45309',
                              }}
                            >
                              {item.geoTerverifikasi ? 'GOOGLE' : 'PERKIRAAN'}
                            </span>
                          )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            disabled={item.latitude == null || item.longitude == null}
                            onClick={() =>
                              window.open(mapsUrlFor(item.latitude as number, item.longitude as number), '_blank', 'noopener,noreferrer')
                            }
                            aria-label={`Buka Maps untuk kode pos ${item.kodePos}`}
                            {...tipProps(
                              item.latitude == null
                                ? 'Titik koordinat belum ada — klik "Isi Koordinat"'
                                : `Buka Maps/Google · ${geoLabel(item)}`
                            )}
                            style={{
                              background: 'rgba(10, 179, 156, 0.1)',
                              border: '1px solid rgba(10, 179, 156, 0.28)',
                              color: item.latitude == null ? '#adb5bd' : '#0ab39c',
                              borderRadius: '4px',
                              padding: '0.3rem 0.45rem',
                              whiteSpace: 'nowrap',
                              cursor: item.latitude == null ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.2rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}
                          >
                            <ExternalLink size={11} />
                            MAPS
                          </button>
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
                              padding: '0.35rem',
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
                              setEditingId(item.id ?? null);
                              setModalMode('edit');
                            }}
                            title="Edit Data Kode Pos"
                            style={{
                              background: 'rgba(64, 81, 137, 0.1)',
                              border: '1px solid rgba(64, 81, 137, 0.25)',
                              color: '#405189',
                              borderRadius: '4px',
                              padding: '0.35rem',
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
                            onClick={() => setDeleteTarget(item)}
                            title="Hapus Data Kode Pos"
                            style={{
                              background: 'rgba(240, 101, 72, 0.1)',
                              border: '1px solid rgba(240, 101, 72, 0.25)',
                              color: '#f06548',
                              borderRadius: '4px',
                              padding: '0.35rem',
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
        {totalPages > 1 && (
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
              Menampilkan <strong>{rangeStart.toLocaleString('id-ID')}</strong> -{' '}
              <strong>{rangeEnd.toLocaleString('id-ID')}</strong> dari{' '}
              <strong>{total.toLocaleString('id-ID')}</strong> entri
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
                aria-label="Tutup dialog"
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

      {/* 6. Modal: Detail View — info wilayah di kiri, peta di kanan */}
      {modalMode === 'detail' && detailItem && (
        <div className="modal-backdrop">
          <div
            className="modal-container"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kodepos-detail-title"
            style={{ maxWidth: '880px' }}
          >
            <div className="modal-header">
              <h4 className="modal-title" id="kodepos-detail-title">
                <MapPin size={16} color="#405189" />
                Detail Referensi Kode Pos
              </h4>
              <button
                type="button"
                className="modal-close"
                aria-label="Tutup dialog"
                onClick={() => setModalMode(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '0.9rem',
                  alignItems: 'stretch',
                }}
              >
                {/* Kolom kiri */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', minWidth: 0 }}>
                  <div
                    style={{
                      background: '#f8f9fa',
                      border: '1px solid #eef0f3',
                      borderRadius: '10px',
                      padding: '0.9rem 1rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Mail size={12} color="#878a99" />
                          <span style={{ fontSize: '0.68rem', color: '#878a99', fontWeight: 700, letterSpacing: '0.04em' }}>
                            KODE POS
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.1rem' }}>
                          <span
                            style={{
                              fontSize: '1.85rem',
                              fontWeight: 800,
                              color: '#f06548',
                              fontFamily: 'monospace',
                              lineHeight: 1.1,
                              wordBreak: 'break-all',
                            }}
                          >
                            {detailItem.kodePos}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(detailItem.kodePos, 'detail')}
                            aria-label={`Salin kode pos ${detailItem.kodePos}`}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedId === 'detail' ? '#0ab39c' : '#878a99',
                              cursor: 'pointer',
                              padding: '0.2rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            {copiedId === 'detail' ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          padding: '0.18rem 0.5rem',
                          borderRadius: '999px',
                          whiteSpace: 'nowrap',
                          background: detailItem.status === 'NON-AKTIF' ? 'rgba(240, 101, 72, 0.12)' : 'rgba(10, 179, 156, 0.12)',
                          color: detailItem.status === 'NON-AKTIF' ? '#f06548' : '#0ab39c',
                        }}
                      >
                        {detailItem.status || 'AKTIF'}
                      </span>
                    </div>

                    <div style={{ height: '1px', background: '#e9ecef', margin: '0.8rem 0' }} />

                    <span style={{ fontSize: '0.68rem', color: '#878a99', fontWeight: 700, letterSpacing: '0.04em' }}>
                      LOKASI
                    </span>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#212529', marginTop: '0.15rem' }}>
                      {detailItem.kelurahan || '-'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#5b5f6e', marginTop: '0.1rem' }}>
                      {[detailItem.kabupatenKota, detailItem.provinsi].filter(Boolean).join(', ') || '-'}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    {[
                      { label: 'PROVINSI', icon: MapPin, value: detailItem.provinsi },
                      { label: 'KOTA / KABUPATEN', icon: Building2, value: detailItem.kabupatenKota },
                      { label: 'KECAMATAN', icon: Sparkles, value: detailItem.kecamatan },
                      { label: 'KELURAHAN / DESA', icon: CheckCircle2, value: detailItem.kelurahan },
                    ].map((kartu) => (
                      <div
                        key={kartu.label}
                        style={{
                          background: '#f8f9fa',
                          border: '1px solid #eef0f3',
                          borderRadius: '10px',
                          padding: '0.65rem 0.8rem',
                          minWidth: 0,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <kartu.icon size={12} color="#f06548" />
                          <span style={{ fontSize: '0.66rem', color: '#878a99', fontWeight: 700, letterSpacing: '0.04em' }}>
                            {kartu.label}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.86rem',
                            fontWeight: 600,
                            color: '#212529',
                            marginTop: '0.2rem',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {kartu.value || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kolom kanan: peta + keterangan titik */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 0 }}>
                  {detailItem.latitude != null && detailItem.longitude != null ? (
                    <iframe
                      title={`Peta lokasi ${detailItem.kelurahan || detailItem.kodePos}`}
                      src={`https://maps.google.com/maps?q=${detailItem.latitude},${detailItem.longitude}&z=15&hl=id&output=embed`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      style={{
                        flex: 1,
                        minHeight: '300px',
                        width: '100%',
                        border: '1px solid #eef0f3',
                        borderRadius: '10px',
                        background: '#f1f3f5',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        minHeight: '300px',
                        border: '1px dashed #d0d7de',
                        borderRadius: '10px',
                        background: '#f8f9fa',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '1rem',
                        textAlign: 'center',
                      }}
                    >
                      <MapPin size={26} color="#adb5bd" />
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5b5f6e' }}>Titik belum tersedia</div>
                      <div style={{ fontSize: '0.76rem', color: '#878a99' }}>
                        Jalankan &quot;Isi Koordinat&quot; untuk menaruh lokasi baris ini di peta.
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      background: '#f8f9fa',
                      border: '1px solid #eef0f3',
                      borderRadius: '10px',
                      padding: '0.65rem 0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.6rem',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.66rem', color: '#878a99', fontWeight: 700, letterSpacing: '0.04em' }}>
                        TITIK KOORDINAT
                      </div>
                      <div style={{ fontWeight: 700, color: '#212529', fontFamily: 'monospace', fontSize: '0.84rem' }}>
                        {detailItem.latitude == null || detailItem.longitude == null
                          ? 'belum ada'
                          : `${detailItem.latitude.toFixed(7)}, ${detailItem.longitude.toFixed(7)}`}
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: detailItem.geoTerverifikasi ? '#0a7b6c' : '#b45309',
                          marginTop: '0.1rem',
                        }}
                      >
                        {geoLabel(detailItem)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={detailItem.latitude == null || detailItem.longitude == null}
                      onClick={() =>
                        window.open(
                          mapsUrlFor(detailItem.latitude as number, detailItem.longitude as number),
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        background: 'rgba(10, 179, 156, 0.12)',
                        border: '1px solid rgba(10, 179, 156, 0.3)',
                        color: detailItem.latitude == null ? '#adb5bd' : '#0ab39c',
                        cursor: detailItem.latitude == null ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <ExternalLink size={12} />
                      Buka Maps
                    </button>
                  </div>
                </div>
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
      {deleteTarget && (
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
                aria-label="Tutup dialog hapus"
                onClick={() => setDeleteTarget(null)}
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
                Data Kode Pos <strong>{deleteTarget.kodePos}</strong> (
                {deleteTarget.kelurahan}) akan dihapus dari daftar referensi.
              </p>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setDeleteTarget(null)}
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

      {/* Modal: Sync Data (bandingkan master lokal vs Neon, import terpilih ke cloud) */}
      <KodePosSyncModal
        open={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onImported={() => {
          setReloadKey((k) => k + 1);
          refreshStats();
        }}
      />

      {/* 8. Modal: Reset Confirmation */}
      {showResetConfirm && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <Trash2 size={16} color="#f06548" />
                Kosongkan Semua Data Kode Pos?
              </h4>
              <button
                type="button"
                className="modal-close"
                aria-label="Tutup dialog reset"
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
                <Trash2 size={24} />
              </div>
              <p style={{ fontSize: '0.82rem', color: '#5b5f6e', margin: 0, lineHeight: 1.5 }}>
                Seluruh baris wilayah di tabel Kode Pos akan <strong>dikosongkan (0 baris)</strong>, bukan diganti dengan
                daftar bawaan. Titik koordinat dan daftar baseline dari kodepos.id tetap tersimpan, jadi isi lagi datanya
                cukup lewat <strong>Sync Data</strong> atau impor Excel.
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
                Ya, Kosongkan Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {tooltipNode}
    </div>
  );
};
