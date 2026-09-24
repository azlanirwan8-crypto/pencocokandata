import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
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
  Building2,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { tulisLembarExcel } from '../../utils/excel';
import { tanggalBerkas } from '../../utils/normalizer';
import type { TargetRow, MasterRow } from '../../types';
import { getItem, setItem } from '../../utils/storage';
import { loadPtenFromNeon, savePtenToNeon } from '../../utils/neonSync';
import type { KodePosRow } from '../../utils/neonSync';
import { tabrakKotaPtenKodePos } from '../../utils/tabrakKotaPten';
import { useVirtualWindow } from '../../utils/useVirtualWindow';

import { DEFAULT_PTEN_DATA } from './defaultPtenData';
import { useNotification } from '../Notification/NotificationContext';
import { DialogPanel } from '../BaseModal';

interface PTENManagerProps {
  targetRows?: TargetRow[];
  masterRows?: MasterRow[];
  /** Master Kode Pos — dipakai memeriksa tabrakan nama kota dengan berkas PTEN. */
  kodePosRows?: KodePosRow[];
  onPtenCountChange?: (count: number) => void;
}

export interface PTENRecord {
  id?: string;
  kodePosPten: string;
  kotaPten: string;
  kotaPtenMax15?: string;
  status: 'AKTIF' | 'NON-AKTIF';
}

export const PTENManager: React.FC<PTENManagerProps> = ({
  targetRows = [],
  kodePosRows = [],
  onPtenCountChange,
}) => {
  const { add: notify } = useNotification();
  const [ptenList, setPtenList] = useState<PTENRecord[]>(DEFAULT_PTEN_DATA);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [selectedKota, setSelectedKota] = useState<string>('ALL');
  const [tabrakRun, setTabrakRun] = useState(0);
  const [tabrakBatas, setTabrakBatas] = useState(50);
  const tabrakKota = useMemo(
    () => (tabrakRun > 0 && kodePosRows.length > 0 ? tabrakKotaPtenKodePos(ptenList, kodePosRows) : null),
    [tabrakRun, ptenList, kodePosRows]
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination states (Default 10)
  const [masterPage, setMasterPage] = useState<number>(1);
  const [masterPageSize, setMasterPageSize] = useState<number | 'ALL'>(10);

  // Modals state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const [formData, setFormData] = useState<PTENRecord>({
    kodePosPten: '',
    kotaPten: '',
    kotaPtenMax15: '',
    status: 'AKTIF',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted PTEN data on mount from IndexedDB
  useEffect(() => {
    let isMounted = true;
    const loadSaved = async () => {
      try {
        const saved = await getItem<PTENRecord[]>('pten_master_data');
        if (saved && Array.isArray(saved) && saved.length > 500 && isMounted) {
          setPtenList(saved);
          onPtenCountChange?.(saved.length);
        } else if (isMounted) {
          setPtenList(DEFAULT_PTEN_DATA);
          onPtenCountChange?.(DEFAULT_PTEN_DATA.length);
          setItem('pten_master_data', DEFAULT_PTEN_DATA);
        }
        // Refresh from cloud (authoritative DB) and mirror into IndexedDB
        const neonRows = await loadPtenFromNeon();
        if (neonRows && Array.isArray(neonRows) && neonRows.length > 0 && isMounted) {
          setPtenList(neonRows);
          onPtenCountChange?.(neonRows.length);
          setItem('pten_master_data', neonRows);
        } else if (saved && Array.isArray(saved) && saved.length > 500) {
          // Cloud kosong padahal browser punya pustaka: dorong sekali supaya membuka menu
          // ini sudah memindahkannya. Kegagalan tidak dilaporkan — sebelum bootstrap
          // ditempel, membaca dan menulis cloud memang sama-sama gagal dan itu diharapkan.
          const ok = await savePtenToNeon(saved).catch(() => false);
          if (ok && isMounted) {
            notify(`${saved.length.toLocaleString('id-ID')} baris PTEN dari browser ini sudah dikirim ke cloud.`, 'info');
          }
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

  // Save to IndexedDB + mirror to cloud (Supabase)
  const handleSaveData = async (listToSave = ptenList) => {
    setErrorMsg(null);
    try {
      await setItem('pten_master_data', listToSave);
      onPtenCountChange?.(listToSave.length);
      setSuccessMsg(`Berhasil menyimpan ${listToSave.length.toLocaleString('id-ID')} data PTEN!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      savePtenToNeon(listToSave)
        .then((ok) => { if (!ok) notify(`${listToSave.length.toLocaleString('id-ID')} baris PTEN tersimpan di browser, tapi GAGAL dikirim ke cloud.`, 'warning'); })
        .catch(() => notify(`${listToSave.length.toLocaleString('id-ID')} baris PTEN tersimpan di browser, tapi GAGAL dikirim ke cloud.`, 'warning'));
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan data PTEN');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Analisa kecocokan kode pos target vs PTEN (hanya untuk card informasi)
  const auditAnalysis = useMemo(() => {
    let same = 0;
    let diff = 0;

    targetRows.forEach((r) => {
      const kp = String(r['KODE POS'] || '').trim();
      const pten = String(r['KODE POS PTEN'] || '').trim();
      const cek = String(r['CEK KODE POS + PTEN'] || '').toUpperCase();

      if (cek === 'SAME' || cek === 'COCOK' || (kp && pten && kp === pten)) {
        same++;
      } else if (cek === 'DIFFERENT' || cek === 'TIDAK COCOK' || (kp && pten && kp !== pten)) {
        diff++;
      }
    });

    return {
      diff,
      matchPercentage: targetRows.length > 0 ? ((same / targetRows.length) * 100).toFixed(1) : '100',
    };
  }, [targetRows]);

  // Unique Kota list + per-kota record counts (for dropdown totals)
  const { kotaList, kotaCountMap } = useMemo(() => {
    const counts = new Map<string, number>();
    for (let i = 0; i < ptenList.length; i++) {
      const k = ptenList[i]?.kotaPten?.trim();
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    }
    return { kotaList: Array.from(counts.keys()).sort(), kotaCountMap: counts };
  }, [ptenList]);

  // Filtered PTEN Master (Optimized O(N) single-pass with pre-lowercased query)
  const filteredPten = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const hasSearch = q.length > 0;
    const hasKotaFilter = selectedKota !== 'ALL';

    if (!hasSearch && !hasKotaFilter) return ptenList;

    return ptenList.filter((p) => {
      if (hasKotaFilter && p.kotaPten !== selectedKota) return false;
      if (!hasSearch) return true;
      return (
        p.kodePosPten?.toLowerCase().includes(q) ||
        p.kotaPten?.toLowerCase().includes(q) ||
        p.kotaPtenMax15?.toLowerCase().includes(q)
      );
    });
  }, [ptenList, selectedKota, deferredSearch]);

  // PTEN Master Pagination
  const totalMasterPages = masterPageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredPten.length / masterPageSize));
  useEffect(() => {
    if (masterPage > totalMasterPages) setMasterPage(1);
  }, [totalMasterPages, masterPage]);

  const paginatedPten = useMemo(() => {
    if (masterPageSize === 'ALL') return filteredPten;
    const start = (masterPage - 1) * masterPageSize;
    return filteredPten.slice(start, start + masterPageSize);
  }, [filteredPten, masterPage, masterPageSize]);

  // Windowing "Lihat Semua" + indeks O(1) pengganti ptenList.indexOf() per baris
  const ptenScrollRef = useRef<HTMLDivElement | null>(null);
  const win = useVirtualWindow({ containerRef: ptenScrollRef, itemCount: paginatedPten.length });
  const renderedPten = win.active ? paginatedPten.slice(win.start, win.end) : paginatedPten;
  const rowOffset = win.active ? win.start : 0;
  const ptenIndexById = useMemo(() => {
    const map = new Map<PTENRecord, number>();
    ptenList.forEach((item, i) => {
      if (!map.has(item)) map.set(item, i);
    });
    return map;
  }, [ptenList]);

  useEffect(() => {
    ptenScrollRef.current?.scrollTo({ top: 0 });
  }, [masterPage, masterPageSize, selectedKota, deferredSearch]);

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

  // Import Excel PTEN (Matches KOTA/KABUPATEN, KOTA/KABUPATEN MAX 15 DIGIT, KODEPOS)
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bytes = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(bytes, { type: 'array' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rawJson || rawJson.length === 0) {
          notify('Berkas Excel kosong atau tidak terbaca.', 'error');
          return;
        }

        // Header Excel bisa beda spasi ("KOTA / KABUPATEN" vs "KOTA/KABUPATEN"),
        // jadi kolom dicari lewat pencocokan longgar supaya nama kota penuh tidak
        // jatuh ke kolom MAX 15 DIGIT (hasilnya terpotong: MANDAILING NATAL -> MANDAILING NATA).
        const headers = Object.keys(rawJson[0] || {});
        const normH = (h: string) => String(h).toUpperCase().replace(/\s+/g, ' ').trim();
        const pickCol = (pred: (h: string) => boolean) => headers.find((h) => pred(normH(h)));
        const cityCol = pickCol((h) => /KOTA/.test(h) && /KABUPATEN/.test(h) && !/15/.test(h));
        const city15Col = pickCol((h) => /15/.test(h));
        const kodePosCol = pickCol((h) => /KODE\s*POS/.test(h));

        const imported: PTENRecord[] = rawJson.map((row: any) => {
          const rawKodePos = String(
            (kodePosCol && row[kodePosCol]) ||
            row['KODEPOS (yang digunakan untuk pendaftaran merchant)'] ||
            row['KODEPOS'] ||
            row['KODE POS'] ||
            row['Kode Pos'] ||
            row['Kode Pos PTEN'] ||
            row['kodepos'] ||
            ''
          ).trim();

          const cleanKodePos = rawKodePos.replace(/\D/g, '').padStart(5, '0');

          const rawKota = String(
            (cityCol && row[cityCol]) ||
            row['KOTA/KABUPATEN'] ||
            row['Kota'] ||
            row['KOTA'] ||
            row['Dati II'] ||
            row['Kabupaten'] ||
            ''
          ).trim();

          const rawKotaMax15 = String(
            (city15Col && row[city15Col]) ||
            row['KOTA/KABUPATEN MAX 15 DIGIT (yang digunakan untuk pendaftaran merchant)'] ||
            row['KOTA/KABUPATEN MAX 15 DIGIT'] ||
            rawKota
          ).trim();

          const rawStatus = String(row['Status'] || row['STATUS'] || 'AKTIF').trim().toUpperCase();

          return {
            kodePosPten: cleanKodePos || rawKodePos,
            kotaPten: (rawKota || rawKotaMax15).toUpperCase(),
            kotaPtenMax15: rawKotaMax15.toUpperCase(),
            status: (rawStatus === 'NON-AKTIF' ? 'NON-AKTIF' : 'AKTIF') as 'AKTIF' | 'NON-AKTIF',
          };
        }).filter((item) => Boolean(item.kodePosPten && item.kodePosPten !== '00000'));

        if (imported.length === 0) {
          notify('Tidak ada baris data valid yang berhasil dibaca dari berkas Excel.', 'error');
          return;
        }

        // Impor = TAMBAH, bukan ganti: lama yang sudah ada tidak hilang diam-diam
        // ( Tombol "Reset" khusus untuk mengosongkan). Kunci = kode pos + nama kota.
        const kunciPten = (x: { kodePosPten: string; kotaPten: string }) =>
          `${String(x.kodePosPten || '').replace(/\D/g, '')}|${String(x.kotaPten || '').toUpperCase().trim()}`;
        const sudahAda = new Set(ptenList.map(kunciPten));
        const terlihat = new Set<string>();
        const barisBaru: typeof imported = [];
        let duplikatBerkas = 0;
        let duplikatPustaka = 0;
        imported.forEach((item) => {
          const k = kunciPten(item);
          if (terlihat.has(k)) { duplikatBerkas++; return; }
          terlihat.add(k);
          if (sudahAda.has(k)) { duplikatPustaka++; return; }
          barisBaru.push(item);
        });

        const gabungan = [...ptenList, ...barisBaru];
        setPtenList(gabungan);
        handleSaveData(gabungan);
        if (fileInputRef.current) fileInputRef.current.value = '';
        notify(
          `Impor PTEN: ${barisBaru.length.toLocaleString('id-ID')} baris baru ditambahkan` +
            `${duplikatPustaka ? `, ${duplikatPustaka.toLocaleString('id-ID')} sudah ada di pustaka (dilewati)` : ''}` +
            `${duplikatBerkas ? `, ${duplikatBerkas.toLocaleString('id-ID')} duplikat di dalam berkas (dilewati)` : ''}.` +
            ` Total pustaka kini ${gabungan.length.toLocaleString('id-ID')} baris.`,
          barisBaru.length ? 'success' : 'info'
        );
      } catch (err: any) {
        notify('Gagal membaca format file Excel: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Download Template Excel PTEN matching user's exact columns
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'No': 1,
        'KOTA/KABUPATEN': 'JAKARTA PUSAT',
        'KOTA/KABUPATEN MAX 15 DIGIT (yang digunakan untuk pendaftaran merchant)': 'JAKARTA PUSAT',
        'KODEPOS (yang digunakan untuk pendaftaran merchant)': '10110',
      },
      {
        'No': 2,
        'KOTA/KABUPATEN': 'JAKARTA PUSAT',
        'KOTA/KABUPATEN MAX 15 DIGIT (yang digunakan untuk pendaftaran merchant)': 'JAKARTA PUSAT',
        'KODEPOS (yang digunakan untuk pendaftaran merchant)': '10115',
      },
      {
        'No': 3,
        'KOTA/KABUPATEN': 'JAKARTA PUSAT',
        'KOTA/KABUPATEN MAX 15 DIGIT (yang digunakan untuk pendaftaran merchant)': 'JAKARTA PUSAT',
        'KODEPOS (yang digunakan untuk pendaftaran merchant)': '10120',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_PTEN');
    XLSX.writeFile(wb, 'Template_Upload_PTEN.xlsx');
  };

  // Export PTEN Master to Excel matching exact column format
  const handleExport = () => {
    // Dulu: kalau hasil saring kosong, diam-diam mengunduh SELURUH pustaka.
    const exportData = filteredPten;
    const kolom = [
      'No',
      'KODEPOS (yang digunakan untuk pendaftaran merchant)',
      'KOTA/KABUPATEN',
      'KOTA/KABUPATEN MAX 15 DIGIT (yang digunakan untuk pendaftaran merchant)',
    ];
    const baris = exportData.map((p, i) => ({
      'No': i + 1,
      'KODEPOS (yang digunakan untuk pendaftaran merchant)': p.kodePosPten,
      'KOTA/KABUPATEN': p.kotaPten,
      'KOTA/KABUPATEN MAX 15 DIGIT (yang digunakan untuk pendaftaran merchant)': p.kotaPtenMax15 || p.kotaPten,
    }));

    if (baris.length === 0) {
      notify('Tidak ada baris PTEN yang cocok dengan filter — tidak ada yang bisa diunduh.', 'warning');
      return;
    }
    tulisLembarExcel({
      namaLembar: 'Master_PTEN',
      namaBerkas: `Data_Master_PTEN_${tanggalBerkas()}.xlsx`,
      kolom,
      baris,
    });
    notify(`${baris.length.toLocaleString('id-ID')} baris PTEN diunduh${exportData.length !== ptenList.length ? ' (sesuai saringan di layar)' : ''}.`, 'success');
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      kodePosPten: '',
      kotaPten: '',
      kotaPtenMax15: '',
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
      notify('Kolom Kode Pos PTEN dan Kota/Kabupaten wajib diisi!', 'warning');
      return;
    }

    const cleanKodePos = formData.kodePosPten.replace(/\D/g, '').padStart(5, '0');
    const normalizedItem: PTENRecord = {
      ...formData,
      kodePosPten: cleanKodePos || formData.kodePosPten.trim(),
      kotaPten: formData.kotaPten.trim().toUpperCase(),
      kotaPtenMax15: (formData.kotaPtenMax15 || formData.kotaPten).trim().toUpperCase(),
      status: formData.status || 'AKTIF',
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

  // Reset ke data default bawaan
  const handleResetToDefault = async () => {
    setPtenList(DEFAULT_PTEN_DATA);
    setShowResetConfirm(false);
    await setItem('pten_master_data', DEFAULT_PTEN_DATA);
    onPtenCountChange?.(DEFAULT_PTEN_DATA.length);
    // Dulu kegagalan cloud ditelan `.catch(() => undefined)` sementara banner tetap bilang "berhasil".
    const sinkron = await savePtenToNeon(DEFAULT_PTEN_DATA).catch(() => false);
    setSuccessMsg(
      sinkron
        ? `Data master PTEN dikembalikan ke ${DEFAULT_PTEN_DATA.length} baris standar (browser + cloud).`
        : `Data master PTEN kembali ke standar di browser, tetapi GAGAL dikirim ke cloud.`
    );
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // Reset / Clear all PTEN records
  const handleResetAll = async () => {
    setPtenList([]);
    setShowResetConfirm(false);
    await setItem('pten_master_data', []);
    onPtenCountChange?.(0);
    // Kosongkan browser saja tidak cukup: salinan cloud masih berisi data lama dan
    // akan muncul kembali saat tab lain memuat. Jadi cloud ikut dikosongkan, dan
    // pesannya mengikuti hasil yang sebenarnya.
    const sinkron = await savePtenToNeon([]).catch(() => false);
    setSuccessMsg(
      sinkron
        ? 'Seluruh data master PTEN dikosongkan — browser dan cloud.'
        : 'Data master PTEN dikosongkan di browser, tapi cloud GAGAL dikosongkan — muat ulang untuk memeriksa.'
    );
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Top Header Card matching Wilayah & Cabang */}
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
              background: 'linear-gradient(135deg, rgba(247, 184, 75, 0.15) 0%, rgba(64, 81, 137, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d68b0c',
              border: '1px solid rgba(247, 184, 75, 0.3)',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 className="section-title" style={{ margin: 0 }}>
              Master Data PTEN (Kodepos & Kota)
            </h3>
            <p className="section-subtitle" style={{ margin: '0.2rem 0 0' }}>
              Referensi resmi format PTEN untuk pendaftaran merchant (Kodepos, Kota/Kabupaten, Max 15 Digit).
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Upload size={14} />
            <span>Impor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExport}
            disabled={ptenList.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Download size={14} />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleDownloadTemplate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
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
              color: '#f06548',
              borderColor: 'rgba(240, 101, 72, 0.3)',
            }}
            title="Kosongkan seluruh data PTEN"
          >
            <RefreshCw size={13} />
            <span>Reset Data PTEN</span>
          </button>

          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={handleOpenCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={14} />
            <span>Tambah Data</span>
          </button>
        </div>
      </div>

      {/* Alert Notification Toast */}
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

      {/* Stats Cards */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {/* Card: Cakupan Kota/Kab */}
        <div className="metric-card cyan">
          <div className="metric-header">
            <span className="metric-title">Cakupan Kota / Kab</span>
            <div className="metric-icon-bubble">
              <Building2 size={14} />
            </div>
          </div>
          <div className="metric-value">{kotaList.length.toLocaleString('id-ID')}</div>
          <div className="metric-footer">Kota/Kabupaten unik terdaftar</div>
        </div>

        {/* Card: Kode Pos Aktif */}
        <div className="metric-card emerald">
          <div className="metric-header">
            <span className="metric-title">Kode Pos Aktif</span>
            <div className="metric-icon-bubble">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="metric-value">
            {ptenList.filter((p) => p.status === 'AKTIF').length.toLocaleString('id-ID')}
          </div>
          <div className="metric-footer">Referensi berstatus AKTIF</div>
        </div>

        {/* Card: Kecocokan Data Target */}
        <div className={`metric-card ${auditAnalysis.diff > 0 ? 'rose' : 'emerald'}`}>
          <div className="metric-header">
            <span className="metric-title">Kecocokan Data Target</span>
            <div className="metric-icon-bubble">
              <Sparkles size={14} />
            </div>
          </div>
          <div className="metric-value">{auditAnalysis.matchPercentage}%</div>
          <div className="metric-footer">
            {auditAnalysis.diff > 0
              ? `${auditAnalysis.diff.toLocaleString('id-ID')} baris target tidak cocok`
              : 'Seluruh kode pos target cocok'}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      {ptenList.length === 0 ? (
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
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(214, 139, 12, 0.1)',
              color: '#d68b0c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#212529', margin: '0 0 0.4rem' }}>
              Belum Ada Data Master PTEN Terunggah
            </h4>
            <p style={{ fontSize: '0.82rem', color: '#878a99', maxWidth: '460px', margin: 0, lineHeight: 1.5 }}>
              Silakan unggah berkas Excel master PTEN resmi Anda (KODEPOS, KOTA/KABUPATEN, KOTA/KABUPATEN MAX 15 DIGIT) untuk mengaktifkan referensi validasi merchant.
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
              <span>Pilih Berkas Excel PTEN</span>
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
        <div className="glass-card" style={{ padding: '1.15rem 1.35rem' }}>
              {/* Tabrakan nama kota PTEN vs Master Kode Pos — dihitung hanya saat diminta
                  (terukur 710 ms atas 8.936 baris PTEN + 83.747 kelurahan, jangan di mount) */}
              {kodePosRows.length > 0 && (
                <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: '6px', padding: '0.7rem 0.85rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.84rem', color: '#92400e' }}>Tabrakan Kota: PTEN vs Master Kode Pos</strong>
                      {tabrakKota && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '0.12rem 0.5rem', borderRadius: '5px' }}>
                          {tabrakKota.tanpaPten.length} kota tanpa data PTEN · {tabrakKota.kelurahanTerhenti.toLocaleString('id-ID')} kelurahan · {tabrakKota.tanpaKodePos.length} nama PTEN asing · {tabrakKota.bedaBlok.length} kota beda isi
                        </span>
                      )}
                    </div>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setTabrakRun((n) => n + 1)} style={{ fontSize: '0.72rem' }}>
                      {tabrakRun === 0 ? 'Periksa tabrakan kota' : 'Periksa ulang'}
                    </button>
                  </div>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: '#a16207' }}>
                    Fase 1 mencari kelurahan sebuah kota di Master Kode Pos lewat kunci kota. Beda spasi/ejaan saja sudah cukup membuat seluruh kota tidak pernah tersentuh analisa tanpa pesan error apa pun.
                  </p>

                  {tabrakKota && tabrakKota.tanpaPten.length + tabrakKota.tanpaKodePos.length > 0 && (
                    <div style={{ marginTop: '0.6rem', border: '1px solid #f3e8c0', borderRadius: '6px', overflow: 'auto', maxHeight: '260px', background: '#ffffff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                        <thead>
                          <tr>
                            {['SISI', 'KUNCI KOTA', 'NAMA PERSIS DI TABELNYA', 'TERDAMPAK', 'PASANGAN TERDEKAT DI TABEL SEBERANG'].map((t) => (
                              <th key={t} style={{ position: 'sticky', top: 0, background: '#f9fafb', color: '#4b5563', textAlign: 'left', padding: '0.4rem 0.6rem', whiteSpace: 'nowrap', zIndex: 1 }}>{t}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ...tabrakKota.tanpaPten.map((k) => ({ ...k, sisi: 'Master Kode Pos', satuan: 'kelurahan', warna: '#0ab39c' })),
                            ...tabrakKota.tanpaKodePos.map((k) => ({ ...k, sisi: 'PTEN', satuan: 'baris', warna: '#f06548' })),
                          ].slice(0, tabrakBatas).map((k, i) => (
                            <tr key={`${k.sisi}-${k.kunci}-${i}`} style={{ borderTop: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                              <td style={{ padding: '0.38rem 0.6rem' }}>
                                <span style={{ fontSize: '0.64rem', fontWeight: 800, color: k.warna, border: `1px solid ${k.warna}55`, borderRadius: 4, padding: '0.05rem 0.3rem' }}>{k.sisi}</span>
                              </td>
                              <td style={{ padding: '0.38rem 0.6rem', fontWeight: 700, color: '#92400e' }}>{k.kunci}</td>
                              <td style={{ padding: '0.38rem 0.6rem' }}>{k.nama.join(' · ')}</td>
                              <td style={{ padding: '0.38rem 0.6rem', fontVariantNumeric: 'tabular-nums' }}>{k.terdampak.toLocaleString('id-ID')} {k.satuan}</td>
                              <td style={{ padding: '0.38rem 0.6rem' }}>
                                {k.padanan ? `${k.padanan.kunci} (${Math.round(k.padanan.kemiripan * 100)}%)` : '— tidak ada yang mirip —'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {tabrakKota && tabrakKota.bedaBlok.length > 0 && (
                    <div style={{ marginTop: '0.6rem', border: '1px solid #f3e8c0', borderRadius: '6px', overflow: 'auto', maxHeight: '260px', background: '#ffffff' }}>
                      <div style={{ padding: '0.4rem 0.6rem', background: '#f9fafb', fontSize: '0.7rem', color: '#4b5563', position: 'sticky', top: 0 }}>
                        Kota yang sama, isinya beda — termasuk ejaan ganda seperti SURAKARTA / SOLO. Klik baris untuk mencari kotanya di daftar PTEN.
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                        <thead>
                          <tr>
                            {['KOTA / KAB', 'NAMA DI PTEN', 'NAMA DI KODE POS', 'BLOK CUMA DI PTEN', 'BLOK CUMA DI KODE POS'].map((t) => (
                              <th key={t} style={{ background: '#f9fafb', color: '#4b5563', textAlign: 'left', padding: '0.35rem 0.6rem', whiteSpace: 'nowrap' }}>{t}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tabrakKota.bedaBlok.slice(0, tabrakBatas).map((k) => (
                            <tr
                              key={k.kunci}
                              onClick={() => setSearchTerm(k.namaPten[0] || k.kunci)}
                              title="Cari kota ini di daftar PTEN"
                              style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              <td style={{ padding: '0.38rem 0.6rem', fontWeight: 700, color: '#92400e' }}>{k.kunci}</td>
                              <td style={{ padding: '0.38rem 0.6rem' }}>{k.namaPten.join(' · ') || '-'}</td>
                              <td style={{ padding: '0.38rem 0.6rem' }}>{k.namaKodePos.join(' · ') || '-'}</td>
                              <td style={{ padding: '0.38rem 0.6rem', fontFamily: 'var(--font-mono)', color: '#f06548' }}>{k.hanyaDiPten.join(' ') || '-'}</td>
                              <td style={{ padding: '0.38rem 0.6rem', fontFamily: 'var(--font-mono)', color: '#0ab39c' }}>{k.hanyaDiKodePos.join(' ') || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {tabrakKota && (tabrakKota.tanpaPten.length + tabrakKota.tanpaKodePos.length > tabrakBatas || tabrakKota.bedaBlok.length > tabrakBatas) && (
                    <div style={{ marginTop: '0.45rem', textAlign: 'center' }}>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => setTabrakBatas((n) => n + 50)} style={{ fontSize: '0.72rem' }}>
                        Tampilkan 50 baris berikutnya
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Filter Toolbar without top counter */}
              <div className="filter-toolbar" style={{ marginBottom: '1rem' }}>
                <div className="filter-group" style={{ flex: 1, minWidth: '260px' }}>
                  <div className="search-input-wrapper" style={{ flex: 1 }}>
                    <Search
                      size={15}
                      style={{ position: 'absolute', left: '0.65rem', color: '#878a99', pointerEvents: 'none' }}
                    />
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: '100%' }}
                      placeholder="Cari kodepos, kota/kabupaten..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* Kota Filter */}
                  <select
                    className="filter-select"
                    value={selectedKota}
                    onChange={(e) => setSelectedKota(e.target.value)}
                  >
                    <option value="ALL">Semua Kota/Kab (Total: {ptenList.length.toLocaleString('id-ID')})</option>
                    {kotaList.map((k) => (
                      <option key={k} value={k}>
                        {k} ({(kotaCountMap.get(k) || 0).toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Page Size Selector */}
                <div className="filter-group">
                  <label style={{ fontSize: '0.78rem', color: '#878a99' }}>Tampilkan:</label>
                  <select
                    className="filter-select"
                    value={masterPageSize}
                    onChange={(e) => {
                      const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                      setMasterPageSize(val);
                      setMasterPage(1);
                    }}
                  >
                    <option value={10}>10 Baris</option>
                    <option value={25}>25 Baris</option>
                    <option value={50}>50 Baris</option>
                    <option value={100}>100 Baris</option>
                    <option value="ALL">Lihat Semua ({filteredPten.length})</option>
                  </select>
                </div>
              </div>

              {/* Table Master PTEN (Exact Columns: No, Kodepos, Kota, Kota Max 15, Status, Aksi) */}
              <div ref={ptenScrollRef} className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflow: 'auto', maxHeight: '580px' }}>
                <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
                    <tr>
                      <th style={{ width: '50px', textAlign: 'center' }}>No</th>
                      <th style={{ width: '130px', textAlign: 'center' }}>KODEPOS</th>
                      <th>KOTA / KABUPATEN</th>
                      <th>KOTA/KABUPATEN MAX 15 DIGIT</th>
                      <th style={{ width: '95px', textAlign: 'center' }}>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPten.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                          Tidak ada data master PTEN yang cocok dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {win.active && win.padTop > 0 && <tr aria-hidden="true" style={{ height: `${win.padTop}px` }} />}
                        {renderedPten.map((item, i) => {
                        const idx = rowOffset + i;
                        const originalIdx = ptenIndexById.get(item) ?? -1;
                        const displayRowNo =
                          masterPageSize === 'ALL'
                            ? idx + 1
                            : (masterPage - 1) * (masterPageSize as number) + idx + 1;

                        return (
                          <tr key={`${item.id || idx}`} data-vrow={i === 0 ? 'true' : undefined} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
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
                      })}
                        {win.active && win.padBottom > 0 && <tr aria-hidden="true" style={{ height: `${win.padBottom}px` }} />}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Master PTEN Pagination Footer with Compact Sliding Range */}
              {masterPageSize !== 'ALL' && totalMasterPages > 1 && (
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
                    Halaman <strong style={{ color: '#212529' }}>{masterPage}</strong> dari{' '}
                    <strong style={{ color: '#212529' }}>{totalMasterPages}</strong>
                  </div>

                  <div className="pagination-controls">
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

                    {getPaginationRange(masterPage, totalMasterPages).map((p, idx) => {
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
                          onClick={() => setMasterPage(p)}
                          style={{
                            minWidth: '28px',
                            height: '28px',
                            padding: '0 0.4rem',
                            fontSize: '0.74rem',
                            fontWeight: masterPage === p ? 700 : 500,
                            borderRadius: '4px',
                            border: masterPage === p ? '1px solid #405189' : '1px solid #ced4da',
                            background: masterPage === p ? '#405189' : '#ffffff',
                            color: masterPage === p ? '#ffffff' : '#495057',
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
      )}

      {/* Create / Edit / Detail PTEN Modal */}
      {modalMode && (
        <DialogPanel onClose={() => setModalMode(null)} closableOnOutside={false} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                <ShieldCheck size={18} color="#d68b0c" />
                {modalMode === 'create' && 'Tambah Data Master PTEN'}
                {modalMode === 'edit' && 'Edit Data Master PTEN'}
                {modalMode === 'detail' && 'Detail Data Master PTEN'}
              </h4>
              <button type="button" className="modal-close" onClick={() => setModalMode(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm}>
              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">
                      KODEPOS (PTEN) <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      disabled={modalMode === 'detail'}
                      placeholder="Contoh: 10110"
                      value={formData.kodePosPten}
                      onChange={(e) => setFormData({ ...formData, kodePosPten: e.target.value })}
                      style={{ background: modalMode === 'detail' ? '#f8f9fa' : '#ffffff' }}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-label">
                    KOTA / KABUPATEN <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    disabled={modalMode === 'detail'}
                    placeholder="Contoh: JAKARTA PUSAT"
                    value={formData.kotaPten}
                    onChange={(e) => setFormData({ ...formData, kotaPten: e.target.value, kotaPtenMax15: e.target.value.slice(0, 15) })}
                    style={{ background: modalMode === 'detail' ? '#f8f9fa' : '#ffffff' }}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">KOTA/KABUPATEN (MAX 15 DIGIT)</label>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={15}
                    disabled={modalMode === 'detail'}
                    placeholder="Maksimal 15 karakter"
                    value={formData.kotaPtenMax15 || ''}
                    onChange={(e) => setFormData({ ...formData, kotaPtenMax15: e.target.value })}
                    style={{ background: modalMode === 'detail' ? '#f8f9fa' : '#ffffff' }}
                  />
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
                    {modalMode === 'create' ? 'Tambah PTEN' : 'Simpan Perubahan'}
                  </button>
                )}
              </div>
            </form>
    </DialogPanel>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetIndex !== null && (
        <DialogPanel onClose={() => setDeleteTargetIndex(null)} closableOnOutside={false} style={{ maxWidth: '420px' }}>
            <div className="modal-body" style={{ textAlign: 'center', alignItems: 'center', padding: '1.5rem' }}>
              <AlertCircle size={40} color="#f06548" />
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#212529' }}>
                Hapus Data Master PTEN?
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#878a99', margin: 0 }}>
                Apakah Anda yakin ingin menghapus referensi PTEN kode pos{' '}
                <strong>{ptenList[deleteTargetIndex]?.kodePosPten}</strong> (
                {ptenList[deleteTargetIndex]?.kotaPten})?
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
        <DialogPanel onClose={() => setShowResetConfirm(false)} closableOnOutside={false} style={{ maxWidth: '460px' }}>
            <div className="modal-body" style={{ textAlign: 'center', alignItems: 'center', padding: '1.5rem' }}>
              <RefreshCw size={36} color="#405189" />
              <h4 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1rem', fontWeight: 700, color: '#212529' }}>
                Reset Data Master PTEN
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#878a99', margin: 0, lineHeight: 1.5 }}>
                Data PTEN saat ini: <strong>{ptenList.length.toLocaleString('id-ID')} referensi</strong>.
                Pilih apakah Anda ingin mengembalikan ke standar bawaan ({DEFAULT_PTEN_DATA.length.toLocaleString('id-ID')} referensi)
                atau <strong>menghapus seluruh {ptenList.length.toLocaleString('id-ID')} baris</strong> untuk impor baru dari awal.
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
    </DialogPanel>
      )}

    </div>
  );
};
