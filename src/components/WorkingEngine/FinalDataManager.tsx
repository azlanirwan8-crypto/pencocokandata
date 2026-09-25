import React, { useMemo, useState, useDeferredValue, useRef } from 'react';
import {
  ClipboardCheck,
  Search,
  FileSpreadsheet,
  Undo2,
  RotateCcw,
  Eye,
  Trash2,
  X,
  Building2,
  ShieldCheck,
  AlertTriangle,
  Info,
  Upload,
  Download,
  CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import type { AnalystRow } from '../../utils/analystPipeline';
import { formatWilayahCode, applyStandardSheetStyle, tulisLembarExcel } from '../../utils/excel';
import { WARNA_TH, KOLOM_FINAL, CONTOH_KOLOM_FINAL, JUDUL_KOLOM_FINAL, KOLOM_FILTER_FINAL, barisKeExcelFinal } from '../../utils/finalColumns';
import { tanggalBerkas, indeksSisiSelisih, cariPadananSelisih, kapital } from '../../utils/normalizer';
import type { SisiSelisih, PadananSelisih, SumbuSelisih } from '../../utils/normalizer';
import { ConfirmDialog } from './ConfirmDialog';
import { AnalystRowDetailModal } from './AnalystRowDetailModal';
import { DialogPanel } from '../BaseModal';
import { useTampilanTersimpan } from '../../utils/useTampilanTersimpan';
import { useFilterSort } from '../../utils/useFilterSort';
import { ThFilter } from '../ThFilter';
import { useVirtualWindow } from '../../utils/useVirtualWindow';
import { useNotification } from '../Notification/NotificationContext';
import type { MasterRow } from '../../types';
import type { KodePosRow } from '../../utils/neonSync';

interface FinalDataManagerProps {
  rows: AnalystRow[];
  onReturnAll: () => void;
  /** Revisi massal/per baris: ids keluar dari Final dan masuk lagi ke antrean Fase 1. */
  onReturnRows: (rowIds: string[]) => void;
  /** Hapus massal/per baris: ids hilang permanen dari Final Data. */
  onDeleteRows: (rowIds: string[]) => void;
  /** "Reset Data": kosongkan SELURUH Final Data (lokal + cloud), tanpa menyentuh Data Analyst. */
  onResetAll: () => void;
  onImportRows?: (rows: AnalystRow[]) => { imported: number; skippedFinal: number; skippedAnalyst: number };
  /** Modal Detail: titik kelurahan di peta diambil dari Data Kode Pos. */
  kodePosRows?: KodePosRow[];
  /** Modal Detail: titik cabang diambil dari Data Cabang yang tersimpan. */
  masterRows?: MasterRow[];
}

/* Kolom, warna kepala tabel, dan pemetaan baris→Excel tinggal di satu modul:
   utils/finalColumns (dipakai juga ekspor Excel/PDF dashboard). */

function parseFinalExcelRow(raw: Record<string, any>, idx: number): AnalystRow {
  const get = (keys: string[]): string => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && String(raw[k]).trim() !== '') {
        return String(raw[k]).trim();
      }
    }
    return '';
  };

  const wilayah = formatWilayahCode(get(['Wilayah', 'WILAYAH', 'wilayah']));
  const sandiCabang = get(['Sandi Cabang', 'SANDI CABANG', 'sandiCabang', 'Sandi']);
  const branchCode = get(['Branch Code', 'BRANCH CODE', 'branchCode']);
  const kodeCabang = get(['Kode Cabang', 'KODE CABANG', 'kodeCabang']);
  const namaOutlet = get(['Nama Outlet', 'NAMA OUTLET', 'namaOutlet', 'Outlet', 'Nama Cabang']);
  const statusOutlet = get(['Status Outlet', 'STATUS OUTLET', 'statusOutlet', 'Status']);
  const alamat = get(['ALAMAT', 'Alamat', 'alamat']);
  // 'KODE POS' di berkas ekspor = kode pos PTEN (aturan Data Final); berkas lama memakai
  // kolom itu untuk kode kelurahan, jadi keduanya tetap diisi kalau hanya satu yang ada.
  const kodePosPten = get(['KODE POS', 'Kode Pos', 'KODE POS PTEN', 'Kode Pos PTEN', 'kodePosPten', 'kodePos']) || '';
  const kodePosKelurahan = get(['KODE POS KELURAHAN', 'Kode Pos Kelurahan', 'kodePosKelurahan']) || kodePosPten;
  const kelurahan = get(['Kelurahan', 'KELURAHAN', 'kelurahan', 'Desa']);
  const kecamatan = get(['Kecamatan', 'KECAMATAN', 'kecamatan']);
  const dati2 = get(['Dati II', 'DATI II', 'dati2', 'Kota', 'Kabupaten', 'Kota/Dati II']);
  const provinsi = get(['Provinsi', 'PROVINSI', 'provinsi']);
  const organisasiTujuan = get(['ORGANISASI TUJUAN', 'Organisasi Tujuan', 'organisasiTujuan']);
  const tipeUnitRaw = get(['Tipe Unit', 'TIPE UNIT', 'tipeUnit']).toUpperCase();
  const tipeUnit: 'KC' | 'KCP' | 'OUTLET' = tipeUnitRaw === 'KC' ? 'KC' : tipeUnitRaw === 'KCP' ? 'KCP' : 'OUTLET';
  const roleLengkapRaw = get(['3 Role Lengkap', 'Role Lengkap', 'is3RoleLengkap']).toUpperCase();
  const is3RoleLengkap = roleLengkapRaw.includes('LENGKAP') || roleLengkapRaw === 'TRUE' || roleLengkapRaw === '1';

  return {
    id: `import-final-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
    no: idx + 1,
    kotaPten: dati2,
    kotaPtenMax15: dati2,
    kodePosPten,
    statusPten: 'SAME',
    placementStatus: 'VERIFIED',
    placementMethod: 'Import Excel',
    groupKota: dati2,
    kategori: 'DIANALISA',
    sourceRowIndex: idx,
    allKelurahanCount: 1,
    kelurahanSeq: 1,
    kelurahan,
    kecamatan,
    provinsi,
    kodePosKelurahan: kodePosKelurahan || kodePosPten,
    fase1Approved: true,
    wilayah,
    sandiCabang,
    sandi: sandiCabang,
    cabang: namaOutlet,
    branchCode,
    kodeCabang,
    namaOutlet,
    statusOutlet,
    alamat,
    fase2Approved: true,
    fase2JarakKm: 0,
    fase2Tier: 1,
    fase2Temuan: [],
    fase2Status: 'OTOMATIS_VALID',
    fase2Sumber: 'IMPORT_EXCEL',
    organisasiTujuan,
    tipeUnit,
    is3RoleLengkap,
    roleCabsal: 1,
    roleCabapv1: 1,
    roleCabapv2: 1,
    roleGrandTotal: 3,
    alurWondr: 'SELESAI',
    flowDescription: 'Data diimpor dari Excel',
    fase3Approved: true,
    confidenceScore: 100,
    matchingAlgorithm: 'Import Excel',
    statusAnalisa: 'EXACT_MATCH',
    isFinalApproved: false, // dimasukkan ke Data Analyst agar operator bisa meninjau
  };
}

type AksiKonfirmasi = { kind: 'returnAll' | 'return' | 'delete' | 'reset'; ids: string[] };

// Final Data: hasil analisa 3 fase yang sudah disetujui operator.
// Baris dipindah dari Data Analyst ke sini (IndexedDB `analyst_final_data`).
export const FinalDataManager: React.FC<FinalDataManagerProps> = ({ rows, onReturnAll, onReturnRows, onDeleteRows, onResetAll, onImportRows, kodePosRows, masterRows }) => {
  const { add: notify } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // A6: filter & halaman bertahan saat operator pindah menu lalu kembali.
  const [searchTerm, setSearchTerm] = useTampilanTersimpan('tampilan.final.cari', '');
  const deferredSearch = useDeferredValue(searchTerm);
  const [wilayahFilter, setWilayahFilter] = useTampilanTersimpan('tampilan.final.wilayah', 'ALL');
  const [page, setPage] = useTampilanTersimpan('tampilan.final.page', 1);
  const [pageSize, setPageSize] = useTampilanTersimpan<number | 'ALL'>('tampilan.final.pageSize', 25);
  // Aksi yang butuh konfirmasi (menggantikan window.confirm native).
  const [konfirmasi, setKonfirmasi] = useState<AksiKonfirmasi | null>(null);
  const [terpilih, setTerpilih] = useState<Set<string>>(() => new Set());
  // Modal Detail (View) per baris.
  const [detailRow, setDetailRow] = useState<AnalystRow | null>(null);
  // Laporan hasil impor Excel
  const [importSummary, setImportSummary] = useState<{ imported: number; skippedFinal: number; skippedAnalyst: number; fileName: string } | null>(null);

  const wilayahOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.wilayah && s.add(r.wilayah));
    return Array.from(s).sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0));
  }, [rows]);

  // Preferensi wilayah tersimpan bisa menunjuk nilai yang sudah tidak ada di data
  // (mis. "W01" sementara hasil analisa tidak lagi membawa wilayah). Tanpa penjagaan ini
  // tabel tampak KOSONG padahal isinya puluhan ribu baris.
  const filterWilayah =
    wilayahFilter !== 'ALL' && wilayahOptions.includes(wilayahFilter) ? wilayahFilter : 'ALL';

  /** Nomor urut asli: posisi baris saat masuk (upload/setujui), bukan posisi hasil sortir. */
  const nomorAsli = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.id, i + 1));
    return m;
  }, [rows]);

  // Urutan tampil = urutan masuk. Ekspor memakai daftar ini (TANPA sort layar) supaya
  // nomor 1..n di berkas sama dengan urutan saat data diunggah/dimasukkan.
  // Ini tahap pencarian + wilayah saja; saringan kepala tabel ditambahkan di bawah.
  const tersaringCari = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterWilayah !== 'ALL' && r.wilayah !== filterWilayah) return false;
      if (!q) return true;
      return (
        r.namaOutlet?.toLowerCase().includes(q) ||
        r.kotaPtenMax15?.toLowerCase().includes(q) ||
        r.kotaPten?.toLowerCase().includes(q) ||
        r.kelurahan?.toLowerCase().includes(q) ||
        r.kecamatan?.toLowerCase().includes(q) ||
        r.provinsi?.toLowerCase().includes(q) ||
        r.sandiCabang?.toLowerCase().includes(q) ||
        r.branchCode?.toLowerCase().includes(q) ||
        r.organisasiTujuan?.toLowerCase().includes(q) ||
        r.kodePosPten?.includes(q) ||
        r.kodePosKelurahan?.includes(q)
      );
    });
  }, [rows, deferredSearch, filterWilayah]);

  // Saringan kepala tabel (sort + daftar nilai ala Excel). `tersaring` = hasil saringan
  // dalam urutan masuk → dipakai kartu, ekspor, dan penghitung halaman; `baris` = hasil
  // saringan + sortir → dipakai tabel.
  const fs = useFilterSort('final', KOLOM_FILTER_FINAL, tersaringCari);
  const { baris: terurut, urut, saring, gantiUrut, setNilaiKolom, jumlahAktif } = fs;
  const tersaring = fs.tersaring;

  const metrics = useMemo(() => ({
    total: tersaring.length,
    kc: tersaring.filter((r) => r.tipeUnit === 'KC').length,
    kcp: tersaring.filter((r) => r.tipeUnit === 'KCP').length,
    roleLengkap: tersaring.filter((r) => is3Role(r)).length,
    wilayah: new Set(tersaring.map((r) => r.wilayah).filter(Boolean)).size,
  }), [tersaring]);

  const [modalSelisih, setModalSelisih] = useState<boolean>(false);

  // Rekonsiliasi Perbedaan Baris antara Data Final vs Data Kode Pos
  const selisihInfo = useMemo(() => {
    if (!kodePosRows || kodePosRows.length === 0 || rows.length === 0) return null;

    // Normalisasi kunci kelurahan + kecamatan + kodepos
    const buatKunci = (kel?: string, kec?: string, kp?: string) =>
      `${String(kel || '').trim().toUpperCase()}|${String(kec || '').trim().toUpperCase()}|${String(kp || '').replace(/\D/g, '')}`;

    const setFinal = new Set<string>();
    const mapFinal = new Map<string, AnalystRow>();
    rows.forEach((r) => {
      const k = buatKunci(r.kelurahan, r.kecamatan, r.kodePosKelurahan || r.kodePosPten);
      setFinal.add(k);
      mapFinal.set(k, r);
    });

    const setMaster = new Set<string>();
    const mapMaster = new Map<string, KodePosRow>();
    kodePosRows.forEach((kp) => {
      const k = buatKunci(kp.kelurahan, kp.kecamatan, kp.kodePos);
      setMaster.add(k);
      mapMaster.set(k, kp);
    });

    // 1. Baris di Final Data yang tidak ada / berlebih dibanding Data Kode Pos (misal duplikat/impor ekstra)
    const extraInFinal: AnalystRow[] = [];
    rows.forEach((r) => {
      const k = buatKunci(r.kelurahan, r.kecamatan, r.kodePosKelurahan || r.kodePosPten);
      if (!setMaster.has(k)) extraInFinal.push(r);
    });

    // 2. Baris di Master Kode Pos yang belum ada di Final Data
    const missingInFinal: KodePosRow[] = [];
    kodePosRows.forEach((kp) => {
      const k = buatKunci(kp.kelurahan, kp.kecamatan, kp.kodePos);
      if (!setFinal.has(k)) missingInFinal.push(kp);
    });

    const selisihTotal = rows.length - kodePosRows.length;

    return {
      totalFinal: rows.length,
      totalKodePos: kodePosRows.length,
      selisihTotal,
      extraInFinal,
      missingInFinal,
      adaPerbedaan: rows.length !== kodePosRows.length || extraInFinal.length > 0 || missingInFinal.length > 0,
    };
  }, [rows, kodePosRows]);

  // Padanan lapangan-per-lapangan untuk rincian. Indeksnya dibangun atas seluruh
  // Master Kode Pos + Data Final (terukur 80-350 ms per tabel), jadi jangan di jalur
  // render: modal dibuka dulu, dihitung pada giliran berikutnya, baris isinya menyusul.
  const BATAS_RINCIAN = 60;
  const [rincianMulai, setRincianMulai] = useState(false);
  const bukaRincian = () => {
    setModalSelisih(true);
    setTimeout(() => setRincianMulai(true), 0);
  };
  const tutupRincian = () => {
    setModalSelisih(false);
    setRincianMulai(false);
  };

  const bandingSelisih = useMemo(() => {
    if (!modalSelisih || !rincianMulai || !selisihInfo || !kodePosRows) return null;
    const indeksKodePos = indeksSisiSelisih(kodePosRows.map(sisiDariKodePos));
    const indeksFinal = indeksSisiSelisih(rows.map(sisiDariFinal));
    const ekstra = selisihInfo.extraInFinal.slice(0, BATAS_RINCIAN).map((r) => {
      const asal = sisiDariFinal(r);
      return { asal, padanan: cariPadananSelisih(indeksKodePos, asal) };
    });
    const kurang = selisihInfo.missingInFinal.slice(0, BATAS_RINCIAN).map((kp) => {
      const asal = sisiDariKodePos(kp);
      return { asal, padanan: cariPadananSelisih(indeksFinal, asal) };
    });
    return {
      ekstra,
      kurang,
      sisaEkstra: Math.max(0, selisihInfo.extraInFinal.length - ekstra.length),
      sisaKurang: Math.max(0, selisihInfo.missingInFinal.length - kurang.length),
    };
  }, [modalSelisih, rincianMulai, selisihInfo, rows, kodePosRows]);

  const totalHal = Math.max(1, pageSize === 'ALL' ? 1 : Math.ceil(terurut.length / pageSize));
  const hal = Math.min(page, totalHal);
  const paginated = pageSize === 'ALL' ? terurut : terurut.slice((hal - 1) * pageSize, hal * pageSize);

  // "Lihat Semua" sampai puluhan ribu baris tetap ringan: hanya baris yang terlihat
  // yang masuk DOM (sama seperti grid Data Analyst).
  const win = useVirtualWindow({ containerRef: scrollRef, itemCount: paginated.length });
  const rendered = win.active ? paginated.slice(win.start, win.end) : paginated;
  const offset = win.active ? win.start : 0;

  const semuaHalamanTerpilih = paginated.length > 0 && paginated.every((r) => terpilih.has(r.id));
  const idTerpilihAktif = useMemo(() => paginated.filter((r) => terpilih.has(r.id)).map((r) => r.id), [paginated, terpilih]);

  const gantiPilihanSemua = () => {
    setTerpilih((prev) => {
      const next = new Set(prev);
      if (semuaHalamanTerpilih) paginated.forEach((r) => next.delete(r.id));
      else paginated.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const toggleTerpilih = (id: string) => {
    setTerpilih((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const urutkanKolom = (judul: string) => {
    gantiUrut(judul);
    setPage(1);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet);

      if (rawJson.length === 0) {
        notify('Berkas Excel kosong atau tidak memiliki baris data.', 'error');
        return;
      }

      const parsedRows: AnalystRow[] = rawJson.map((r, idx) => parseFinalExcelRow(r, idx));
      if (onImportRows) {
        const res = onImportRows(parsedRows);
        setImportSummary({
          imported: res.imported,
          skippedFinal: res.skippedFinal,
          skippedAnalyst: res.skippedAnalyst,
          fileName: file.name,
        });
      }
    } catch (err: any) {
      console.error('Gagal membaca berkas Excel:', err);
      notify(`Gagal memproses berkas Excel: ${err?.message || 'Format tidak dikenali'}`, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /** Berkas Excel berkepala warna + lebar kolom + satu baris contoh, siap diisi & diunggah balik. */
  const handleUnduhTemplate = () => {
    const contoh: Record<string, string | number> = {};
    KOLOM_FINAL.forEach((k) => {
      contoh[k.judul] = CONTOH_KOLOM_FINAL[k.judul] ?? '';
    });
    const wb = XLSX.utils.book_new();
    const kolomJudul = KOLOM_FINAL.map((k) => k.judul);
    const ws = XLSX.utils.json_to_sheet([contoh], { header: kolomJudul });
    applyStandardSheetStyle(ws, kolomJudul, 1);
    XLSX.utils.book_append_sheet(wb, ws, 'TEMPLATE_FINAL');
    XLSX.writeFile(wb, 'Template_Final_Data.xlsx');
    notify('Template terunduh — isi kolomnya (baris contoh boleh dihapus) lalu unggah kembali lewat "Unggah Excel".', 'info');
  };

  // Ekspor mengikuti FILTER wilayah yang aktif, tapi TIDAK mengikuti sort layar:
  // urutan baris tetap seperti saat data masuk (permintaan pemilik produk).
  const handleExport = () => {
    const data = tersaring.map((r, i) => barisKeExcelFinal(r, i + 1));
    if (data.length === 0) {
      notify('Tidak ada baris Data Final pada saringan ini — tidak ada yang bisa diunduh.', 'warning');
      return;
    }
    const lingkup = filterWilayah === 'ALL' ? 'Semua_Wilayah' : formatWilayahCode(filterWilayah).replace(/\s+/g, '_');
    tulisLembarExcel({
      namaLembar: 'FINAL_DATA',
      namaBerkas: `Final_Data_${lingkup}_${tanggalBerkas()}.xlsx`,
      kolom: JUDUL_KOLOM_FINAL,
      baris: data,
    });
    notify(`${data.length.toLocaleString('id-ID')} baris Data Final diunduh (${lingkup.replace('_', ' ')}), sesuai urutan data masuk.`, 'success');
  };

  const adaPilihan = idTerpilihAktif.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls" style={{ display: 'none' }} />

      {/* 1. Header halaman — sama seperti menu Wilayah / PTEN / Cabang */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, rgba(10, 179, 156, 0.15) 0%, rgba(64, 81, 137, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0ab39c',
              border: '1px solid rgba(10, 179, 156, 0.3)',
              flexShrink: 0,
            }}
          >
            <ClipboardCheck size={22} />
          </div>
          <div>
            <h3 className="section-title" style={{ margin: 0 }}>Final Data (Hasil Analisa 3 Fase)</h3>
            <div style={{ fontSize: '0.74rem', color: '#878a99', marginTop: '0.15rem' }}>
              {rows.length.toLocaleString('id-ID')} baris tervalidasi · {wilayahOptions.length} wilayah ·
              {' '}kode pos yang sudah ada di sini tidak dianalisa ulang sampai dikembalikan (Revisi)
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              if (rows.length === 0) return;
              setKonfirmasi({ kind: 'returnAll', ids: rows.map((r) => r.id) });
            }}
            disabled={rows.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem' }}
            title="Kembalikan SELURUH baris ke menu Data Analyst (mulai Fase 1)"
          >
            <Undo2 size={13} /> Kembalikan Semua
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              if (rows.length === 0) return;
              setKonfirmasi({ kind: 'reset', ids: [] });
            }}
            disabled={rows.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', color: '#f06548', borderColor: 'rgba(240,101,72,0.45)' }}
            title="Kosongkan seluruh Final Data (lokal + cloud). Baris TIDAK dikembalikan ke Data Analyst."
          >
            <Trash2 size={13} /> Reset Data
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', color: '#405189', borderColor: '#405189' }}
            title="Unggah berkas Excel (.xlsx) — baris baru masuk ke Data Analyst untuk divalidasi"
          >
            <Upload size={13} /> Unggah Excel
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleUnduhTemplate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem' }}
            title="Unduh berkas Excel berkepala warna sesuai format kolom Final Data"
          >
            <Download size={13} /> Template Excel
          </button>
          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={handleExport}
            disabled={tersaring.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', fontWeight: 700 }}
            title={
              filterWilayah === 'ALL'
                ? `Unduh semua ${rows.length.toLocaleString('id-ID')} baris, urutan sesuai data masuk`
                : `Unduh ${tersaring.length.toLocaleString('id-ID')} baris wilayah ${formatWilayahCode(filterWilayah)}, urutan sesuai data masuk`
            }
          >
            <FileSpreadsheet size={13} /> Export Excel {filterWilayah === 'ALL' ? '(Semua)' : `(${formatWilayahCode(filterWilayah)})`}
          </button>
        </div>
      </div>

      {/* 2. Kartu metrik */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="metric-card emerald">
          <div className="metric-header">
            <span className="metric-title">Total Baris Final</span>
            <div className="metric-icon-bubble"><ClipboardCheck size={14} /></div>
          </div>
          <div className="metric-value">{metrics.total.toLocaleString('id-ID')}</div>
          <div className="metric-footer">
            {filterWilayah === 'ALL'
              ? 'seluruh wilayah'
              : `filter aktif: ${formatWilayahCode(filterWilayah)} · ${rows.length.toLocaleString('id-ID')} baris final keseluruhan`}
          </div>
        </div>
        <div className="metric-card cyan">
          <div className="metric-header">
            <span className="metric-title">Wilayah</span>
            <div className="metric-icon-bubble"><Building2 size={14} /></div>
          </div>
          <div className="metric-value">{metrics.wilayah.toLocaleString('id-ID')}</div>
          <div className="metric-footer">kanwil/cabang utama terdaftar</div>
        </div>
        <div className="metric-card blue">
          <div className="metric-header">
            <span className="metric-title">KC / KCP</span>
            <div className="metric-icon-bubble"><ShieldCheck size={14} /></div>
          </div>
          <div className="metric-value">{metrics.kc.toLocaleString('id-ID')} / {metrics.kcp.toLocaleString('id-ID')}</div>
          <div className="metric-footer">cabang utama vs outlet pembantu</div>
        </div>
        <div className="metric-card purple">
          <div className="metric-header">
            <span className="metric-title">3 Role Lengkap</span>
            <div className="metric-icon-bubble"><CheckCircle2 size={14} /></div>
          </div>
          <div className="metric-value">{metrics.roleLengkap.toLocaleString('id-ID')}</div>
          <div className="metric-footer">sales + 2 verifikator terisi</div>
        </div>
      </div>

      {/* 2.b. Banner Notifikasi Selisih Rekonsiliasi Final Data vs Data KodePos */}
      {selisihInfo && selisihInfo.adaPerbedaan && (
        <div
          style={{
            margin: '0.85rem 0 1rem',
            padding: '0.75rem 1rem',
            background: selisihInfo.selisihTotal !== 0 ? '#fff8ec' : '#f0fdf4',
            border: `1px solid ${selisihInfo.selisihTotal !== 0 ? '#fde047' : '#bbf7d0'}`,
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.8rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: selisihInfo.selisihTotal !== 0 ? '#fef08a' : '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {selisihInfo.selisihTotal !== 0 ? (
                <AlertTriangle size={17} color="#b45309" />
              ) : (
                <Info size={17} color="#15803d" />
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: selisihInfo.selisihTotal !== 0 ? '#92400e' : '#166534' }}>
                {selisihInfo.selisihTotal !== 0
                  ? `Ditemukan Selisih ${Math.abs(selisihInfo.selisihTotal).toLocaleString('id-ID')} Baris Data: Final Data (${selisihInfo.totalFinal.toLocaleString('id-ID')}) vs Master Kode Pos (${selisihInfo.totalKodePos.toLocaleString('id-ID')})`
                  : `Jumlah Total Sama (${selisihInfo.totalFinal.toLocaleString('id-ID')}), namun terdapat perbedaan rincian kelurahan / kode pos`}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#6b7280', marginTop: '0.1rem' }}>
                {selisihInfo.extraInFinal.length > 0 ? `• ${selisihInfo.extraInFinal.length.toLocaleString('id-ID')} baris tambahan/ekstra di Final Data. ` : ''}
                {selisihInfo.missingInFinal.length > 0 ? `• ${selisihInfo.missingInFinal.length.toLocaleString('id-ID')} baris kelurahan Master Kode Pos belum masuk Final Data.` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={bukaRincian}
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              color: selisihInfo.selisihTotal !== 0 ? '#b45309' : '#15803d',
              borderColor: selisihInfo.selisihTotal !== 0 ? '#fde047' : '#86efac',
              background: '#ffffff',
              padding: '0.35rem 0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Eye size={13} /> Lihat Rincian Data Beda ({selisihInfo.extraInFinal.length + selisihInfo.missingInFinal.length})
          </button>
        </div>
      )}

      {/* 3. Kartu tabel */}
      {rows.length === 0 ? (
        <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', border: '1px dashed #ced4da', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(10,179,156,0.1)', color: '#0ab39c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardCheck size={28} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#212529', margin: '0 0 0.4rem' }}>Belum Ada Final Data</h4>
            <p style={{ fontSize: '0.82rem', color: '#878a99', maxWidth: '480px', margin: 0, lineHeight: 1.5 }}>
              Setujui seluruh fase di menu Data Analyst lalu klik &quot;Saya Setuju (Masuk ke Final Analisa)&quot;, atau unggah berkas Excel lewat tombol di atas.
            </p>
          </div>
          <button type="button" className="btn btn-outline" onClick={() => fileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.25rem' }}>
            <Upload size={16} /> Pilih Berkas Excel
          </button>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '1.15rem 1.35rem' }}>
          <div className="filter-toolbar" style={{ marginBottom: '0.9rem' }}>
            <div className="filter-group" style={{ flex: 1, minWidth: '260px' }}>
              <div className="search-input-wrapper" style={{ flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: '0.65rem', color: '#878a99', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%' }}
                  placeholder="Cari outlet, kelurahan, kecamatan, kota, kode pos, sandi..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <select
                className="filter-select"
                value={filterWilayah}
                onChange={(e) => {
                  setWilayahFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Semua Wilayah ({wilayahOptions.length})</option>
                {wilayahOptions.map((w) => (
                  <option key={w} value={w}>
                    {formatWilayahCode(w)}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label style={{ fontSize: '0.78rem', color: '#878a99' }}>Tampilkan:</label>
              <select
                className="filter-select"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={25}>25 Baris</option>
                <option value={50}>50 Baris</option>
                <option value={100}>100 Baris</option>
                <option value="ALL">Lihat Semua ({tersaring.length.toLocaleString('id-ID')})</option>
              </select>
            </div>
          </div>

          {adaPilihan && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
                marginBottom: '0.7rem',
                padding: '0.5rem 0.7rem',
                background: '#f6f9fc',
                border: '1px solid #dfe7ef',
                borderRadius: '6px',
              }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#405189' }}>
                {idTerpilihAktif.length.toLocaleString('id-ID')} baris terpilih
              </span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setKonfirmasi({ kind: 'return', ids: idTerpilihAktif })} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#d68b0c', borderColor: 'rgba(214,139,12,0.4)' }}>
                <RotateCcw size={12} /> Kembalikan ke Data Analyst
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setKonfirmasi({ kind: 'delete', ids: idTerpilihAktif })} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#f06548', borderColor: 'rgba(240,101,72,0.4)' }}>
                <Trash2 size={12} /> Hapus Terpilih
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTerpilih(new Set())} style={{ fontSize: '0.75rem' }}>
                Batalkan pilihan
              </button>
              <span style={{ fontSize: '0.72rem', color: '#878a99' }}>
                (berlaku untuk {paginated.length.toLocaleString('id-ID')} baris yang sedang tampil)
              </span>
            </div>
          )}

          <div ref={scrollRef} className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', maxHeight: '580px', overflow: 'auto' }}>
            <table className="modern-table" style={{ width: 'max-content', minWidth: '1500px', fontSize: '0.76rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
                <tr>
                  <th style={{ width: '34px', minWidth: '34px', textAlign: 'center', position: 'sticky', left: 0, background: '#f3f6f9', zIndex: 13, borderRight: '1px solid #e9ebec' }} title="Pilih semua baris pada halaman ini">
                    <input type="checkbox" checked={semuaHalamanTerpilih} onChange={gantiPilihanSemua} aria-label="Pilih semua baris pada halaman ini" style={{ cursor: 'pointer' }} />
                  </th>
                  {KOLOM_FINAL.map((k, i) => (
                    <ThFilter
                      key={k.judul}
                      label={k.judul === 'No' ? '#' : k.judul}
                      definisi={KOLOM_FILTER_FINAL[i]}
                      sumber={tersaringCari}
                      semuaDefinisi={KOLOM_FILTER_FINAL}
                      saringSemua={saring}
                      urutKolom={urut.kolom}
                      urutNaik={urut.naik}
                      onUrut={() => urutkanKolom(k.judul)}
                      terpilih={saring[k.judul] || []}
                      onTerapkan={(n) => { setNilaiKolom(k.judul, n); setPage(1); }}
                      latar={WARNA_TH[k.grup]}
                      tengah={k.tengah}
                      bolehFilter={k.judul !== 'No'}
                      gayaSel={k.style}
                    />
                  ))}
                  <th style={{ width: '210px', textAlign: 'center', background: '#f3f6f9', color: '#495057', position: 'sticky', right: 0, zIndex: 12, borderLeft: '1px solid #e9ebec' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={KOLOM_FINAL.length + 2} style={{ textAlign: 'center', padding: '2rem', color: '#878a99' }}>
                      Tidak ada baris yang cocok dengan pencarian/filter.
                    </td>
                  </tr>
                ) : (
                  <>
                    {win.active && win.padTop > 0 && <tr aria-hidden="true" style={{ height: `${win.padTop}px` }} />}
                    {rendered.map((r, i) => {
                      const idx = offset + i;
                      return (
                        <tr key={r.id || `${hal}-${idx}`} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                          <td style={{ width: '34px', minWidth: '34px', textAlign: 'center', position: 'sticky', left: 0, zIndex: 6, background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd', borderRight: '1px solid #e9ebec' }}>
                            <input type="checkbox" checked={terpilih.has(r.id)} onChange={() => toggleTerpilih(r.id)} aria-label={`Pilih baris ${nomorAsli.get(r.id) ?? r.no}`} style={{ cursor: 'pointer' }} />
                          </td>
                          {KOLOM_FINAL.map((k) => {
                            const nilai = k.judul === 'No' ? (nomorAsli.get(r.id) ?? r.no) : k.nilai(r);
                            const sel: React.CSSProperties = {
                              ...(k.style || {}),
                              textAlign: k.tengah ? 'center' : 'left',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              ...(k.mono ? { fontFamily: 'var(--font-mono)' } : {}),
                              ...(k.judul === 'Nama Outlet' ? { fontWeight: 600, color: '#405189' } : {}),
                              ...(k.judul === 'Wilayah' ? { fontWeight: 700, color: '#405189' } : {}),
                            };
                            const teks = String(nilai);
                            return (
                              <td key={k.judul} style={sel} title={teks.length > 18 ? teks : undefined}>
                                {teks}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', position: 'sticky', right: 0, background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd', borderLeft: '1px solid #e9ebec', zIndex: 6 }}>
                            <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => setDetailRow(r)}
                                title="Lihat detail lengkap baris ini"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', padding: '0.25rem 0.5rem', color: '#405189', borderColor: 'rgba(64,81,137,0.4)' }}
                              >
                                <Eye size={12} /> Detail
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => setKonfirmasi({ kind: 'return', ids: [r.id] })}
                                title="Kembalikan ke Data Analyst mulai Fase 1"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', padding: '0.25rem 0.5rem', color: '#d68b0c', borderColor: 'rgba(214,139,12,0.4)' }}
                              >
                                <RotateCcw size={12} /> Revisi
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => setKonfirmasi({ kind: 'delete', ids: [r.id] })}
                                title="Hapus permanen dari Final Data"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', padding: '0.25rem 0.5rem', color: '#f06548', borderColor: 'rgba(240,101,72,0.4)' }}
                              >
                                <Trash2 size={12} /> Hapus
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

          {tersaring.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.7rem', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
                {pageSize === 'ALL'
                  ? `Menampilkan seluruh ${tersaring.length.toLocaleString('id-ID')} baris (urutan asli data masuk${urut.kolom ? ` · sedang diurutkan: ${urut.kolom}` : ''})`
                  : `Menampilkan ${(hal - 1) * pageSize + 1}–${Math.min(hal * pageSize, tersaring.length)} dari ${tersaring.length.toLocaleString('id-ID')} baris`}
                {jumlahAktif > 0 && ` · ${jumlahAktif} kolom difilter`}
              </span>
              {pageSize !== 'ALL' && totalHal > 1 && (
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <button type="button" className="btn btn-outline btn-sm" disabled={hal <= 1} onClick={() => setPage(hal - 1)}>← Prev</button>
                  <span style={{ fontSize: '0.74rem', color: '#878a99' }}>Hal {hal} / {totalHal}</span>
                  <button type="button" className="btn btn-outline btn-sm" disabled={hal >= totalHal} onClick={() => setPage(hal + 1)}>Next →</button>
                </div>
              )}
              {urut.kolom && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { fs.resetUrut(); setPage(1); }} style={{ fontSize: '0.74rem' }} title="Kembalikan urutan asli (urutan data masuk)">
                  <Undo2 size={12} /> Urutan asli
                </button>
              )}
              {jumlahAktif > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { fs.bersihkanSemua(); setPage(1); }} style={{ fontSize: '0.74rem' }} title="Hapus semua saringan kolom">
                  <Undo2 size={12} /> Bersihkan saringan ({jumlahAktif})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={konfirmasi !== null}
        icon={<AlertTriangle size={20} />}
        accent={konfirmasi?.kind === 'delete' || konfirmasi?.kind === 'reset' ? '#f06548' : '#f7b84b'}
        title={
          konfirmasi?.kind === 'reset' ? 'Reset seluruh Data Final?'
            : konfirmasi?.kind === 'delete' ? 'Hapus Data Final?'
              : konfirmasi?.kind === 'return' ? 'Kembalikan ke Data Analyst?'
                : 'Kembalikan SELURUH Data Final?'
        }
        message={
          konfirmasi?.kind === 'reset'
            ? `${rows.length.toLocaleString('id-ID')} baris Final Data akan DIHAPUS PERMANEN dari penyimpanan lokal dan cloud. Baris TIDAK dikembalikan ke Data Analyst — pakai "Kembalikan Semua" kalau Anda ingin memindahkannya. Setelah ini Final Data kosong.`
            : konfirmasi?.kind === 'delete'
            ? `${(konfirmasi.ids.length).toLocaleString('id-ID')} baris akan DIHAPUS PERMANEN dari Final Data. Baris yang dihapus tidak lagi dikecualikan, jadi Analisa berikutnya memproses kelurahan itu dari awal.`
            : konfirmasi?.kind === 'return'
              ? `${konfirmasi.ids.length.toLocaleString('id-ID')} baris akan keluar dari Final Data dan kembali ke Data Analyst mulai Fase 1 (persetujuan tiap fase dilepas).`
              : `${rows.length.toLocaleString('id-ID')} baris akan dikembalikan ke Data Analyst mulai Fase 1. Final Data akan kosong.`
        }
        confirmLabel={konfirmasi?.kind === 'delete' || konfirmasi?.kind === 'reset' ? 'Ya, Hapus Permanen' : 'Ya, Lanjutkan'}
        onConfirm={() => {
          if (!konfirmasi) return;
          if (konfirmasi.kind === 'returnAll') onReturnAll();
          else if (konfirmasi.kind === 'reset') onResetAll();
          else if (konfirmasi.kind === 'return') onReturnRows(konfirmasi.ids);
          else onDeleteRows(konfirmasi.ids);
          setTerpilih(new Set());
          setKonfirmasi(null);
        }}
        onClose={() => setKonfirmasi(null)}
      />

      <AnalystRowDetailModal
        row={detailRow}
        nomor={detailRow ? nomorAsli.get(detailRow.id) ?? detailRow.no : undefined}
        kodePosRows={kodePosRows}
        masterRows={masterRows}
        onClose={() => setDetailRow(null)}
      />

      {importSummary && (
        <DialogPanel
          onClose={() => setImportSummary(null)}
          label="Hasil Impor Excel"
          backdropClassName=""
          backdropStyle={{ position: 'fixed', inset: 0, zIndex: 1070, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,37,41, 0.65)', backdropFilter: 'blur(4px)', padding: '1rem' }}
          className=""
          style={{ width: '100%', maxWidth: '520px', background: '#ffffff', borderRadius: '6px', boxShadow: '0 8px 16px rgba(0,0,0,0.15)', border: '1px solid #e9ebec' }}
        >
          <div style={{ padding: '1.2rem 1.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #eef1f4' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#e8f7f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle2 size={22} color="#0ab39c" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#212529', margin: 0 }}>
                Impor Berkas Selesai
              </h3>
              <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
                {importSummary.fileName}
              </span>
            </div>
            <button type="button" onClick={() => setImportSummary(null)} aria-label="Tutup laporan" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#adb5bd', padding: '0.2rem', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.9rem', background: '#e8f7f5', border: '1px solid #b7ebe4', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534' }}>Baris Baru Dimasukkan ke Data Analyst</span>
              <strong style={{ fontSize: '0.92rem', color: '#15803d' }}>{importSummary.imported.toLocaleString('id-ID')} baris</strong>
            </div>
            {importSummary.skippedFinal > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.9rem', background: '#fff8ec', border: '1px solid #f2d9a8', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: '#8a5a00' }}>Dilewati (Sudah ada di Final Data)</span>
                <strong style={{ fontSize: '0.88rem', color: '#d68b0c' }}>{importSummary.skippedFinal.toLocaleString('id-ID')} baris</strong>
              </div>
            )}
            {importSummary.skippedAnalyst > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.9rem', background: '#f9fbfd', border: '1px solid #e9ebec', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: '#495057' }}>Dilewati (Sudah ada di Data Analyst)</span>
                <strong style={{ fontSize: '0.88rem', color: '#495057' }}>{importSummary.skippedAnalyst.toLocaleString('id-ID')} baris</strong>
              </div>
            )}
            <p style={{ fontSize: '0.74rem', color: '#878a99', margin: '0.3rem 0 0', lineHeight: 1.5 }}>
              Baris baru telah ditambahkan ke antrean <strong>Data Analyst</strong> sehingga operator dapat meninjau dan memvalidasi sebelum dijadikan Final.
            </p>
          </div>
          <div style={{ padding: '0.8rem 1.4rem', borderTop: '1px solid #eef1f4', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setImportSummary(null)} style={{ padding: '0.45rem 1.2rem', fontSize: '0.8rem', fontWeight: 600 }}>
              Mengerti
            </button>
          </div>
        </DialogPanel>
      )}

      {/* 5. Modal Rincian Selisih Data Rekonsiliasi */}
      {modalSelisih && selisihInfo && (
        <DialogPanel
          onClose={tutupRincian}
          label="Rincian Selisih Data Final vs Master Kode Pos"
          style={{ maxWidth: '920px' }}
        >
          <div className="modal-header" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #eef1f4' }}>
            <h4 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '1rem', fontWeight: 700, color: '#1f2937' }}>
              <AlertTriangle size={18} color="#d97706" />
              Rincian Perbedaan Baris Data ({selisihInfo.totalFinal.toLocaleString('id-ID')} Final vs {selisihInfo.totalKodePos.toLocaleString('id-ID')} Kode Pos)
            </h4>
            <button type="button" className="modal-close" onClick={tutupRincian} aria-label="Tutup">
              <X size={18} />
            </button>
          </div>

          <div className="modal-body" style={{ padding: '1rem 1.25rem', maxHeight: '72vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '0.74rem', color: '#6b7280', marginBottom: '0.8rem' }}>
              Setiap baris dipasang berdampingan dengan padanan terdekatnya di tabel seberang. Sel merah = lapangan yang membuat keduanya tidak ketemu. Kunci yang dibandingkan: kelurahan + kecamatan + kode pos.
            </div>

            {!bandingSelisih && (
              <div style={{ padding: '1.1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>
                Menghitung perbandingan {selisihInfo.totalFinal.toLocaleString('id-ID')} baris Final vs {selisihInfo.totalKodePos.toLocaleString('id-ID')} baris Kode Pos…
              </div>
            )}

            {/* Bagian 1: baris Final yang tidak ketemu padanannya di Master Kode Pos */}
            {bandingSelisih && bandingSelisih.ekstra.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    {selisihInfo.extraInFinal.length} BARIS
                  </span>
                  <strong style={{ fontSize: '0.86rem', color: '#1f2937' }}>Baris Ekstra di Final Data (Tidak Ada di Master Kode Pos / Duplikat)</strong>
                </div>
                <TabelBanding
                  items={bandingSelisih.ekstra}
                  labelAsal="DATA FINAL"
                  labelLawan="MASTER KODE POS"
                  warnaAsal="#b45309"
                  warnaLawan="#0f766e"
                  kolomLawan="CABANG / PROVINSI"
                  sisaBaris={bandingSelisih.sisaEkstra}
                />
              </div>
            )}

            {/* Bagian 2: baris Master Kode Pos yang belum ada di Final */}
            {bandingSelisih && bandingSelisih.kurang.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, background: '#fee2e2', color: '#991b1b', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    {selisihInfo.missingInFinal.length} BARIS
                  </span>
                  <strong style={{ fontSize: '0.86rem', color: '#1f2937' }}>Baris Master Kode Pos yang Belum Ada di Final Data</strong>
                </div>
                <TabelBanding
                  items={bandingSelisih.kurang}
                  labelAsal="MASTER KODE POS"
                  labelLawan="DATA FINAL"
                  warnaAsal="#0f766e"
                  warnaLawan="#b45309"
                  kolomLawan="PROVINSI / CABANG"
                  sisaBaris={bandingSelisih.sisaKurang}
                />
              </div>
            )}

            {bandingSelisih && bandingSelisih.ekstra.length === 0 && bandingSelisih.kurang.length === 0 && (
              <div style={{ padding: '0.7rem 0.85rem', background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 6, fontSize: '0.78rem', color: '#4b5563' }}>
                Semua baris sudah ketemu pasangannya. Selisih jumlahnya ({Math.abs(selisihInfo.selisihTotal).toLocaleString('id-ID')} baris) datang dari
                satu kelurahan + kecamatan + kode pos yang dipakai lebih dari satu baris, bukan dari baris yang hilang.
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #eef1f4' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={tutupRincian}>
              Tutup
            </button>
          </div>
        </DialogPanel>
      )}
    </div>
  );
};

/** `is3RoleLengkap` bisa tidak terisi pada baris impor lama — hitung dari QRS-nya saja. */
function is3Role(r: AnalystRow): boolean {
  return !!r.is3RoleLengkap || (r.roleCabsal === 1 && r.roleCabapv1 === 1 && r.roleCabapv2 === 1);
}

/* ───────── Rincian perbedaan baris: Final vs Master Kode Pos, lapangan per lapangan ─────────
 * `catatan` ikut dibawa supaya baris pembanding masih menunjukkan outlet / provinsinya.
 */
type SisiBanding = SisiSelisih & { catatan: string };

const sisiDariFinal = (r: AnalystRow): SisiBanding => ({
  kodePos: r.kodePosKelurahan || r.kodePosPten || '',
  kelurahan: r.kelurahan || '',
  kecamatan: r.kecamatan || '',
  kota: r.kotaPtenMax15 || r.kotaPten || '',
  catatan: r.namaOutlet || '-',
});

const sisiDariKodePos = (k: KodePosRow): SisiBanding => ({
  kodePos: k.kodePos || '',
  kelurahan: k.kelurahan || '',
  kecamatan: k.kecamatan || '',
  kota: k.kabupatenKota || '',
  catatan: k.provinsi || '-',
});

const nilaiSisi = (s: SisiSelisih, sumbu: SumbuSelisih): string =>
  sumbu === 'kodePos' ? s.kodePos : sumbu === 'kelurahan' ? s.kelurahan : sumbu === 'kecamatan' ? s.kecamatan : s.kota;

const NAMA_SUMBU: Record<SumbuSelisih, string> = {
  kodePos: 'kode pos',
  kelurahan: 'kelurahan',
  kecamatan: 'kecamatan',
  kota: 'kabupaten/kota',
};

/** Kalimat yang menjawab "beda nya di mana" — bukan cuma daftar baris. */
function teksBeda(labelAsal: string, labelLawan: string, asal: SisiBanding, p: PadananSelisih<SisiBanding>): string {
  if (!p.lawan) return `Tidak ada padanannya di ${labelLawan} — ${labelAsal} ini tidak dikenal di sana.`;
  if (p.beda.length === 0) return `Keempat lapangan sama — ini duplikat kunci di ${labelAsal}, bukan beda data.`;
  const lawan = p.lawan;
  const bagian = p.beda.map((s) => `${NAMA_SUMBU[s]} ${nilaiSisi(asal, s) || '-'} → ${nilaiSisi(lawan, s) || '-'}`);
  const cara = p.lewat === 'kode pos sekabupaten' ? 'perkiraan: empat digit kode pos pertama sama' : p.lewat;
  return `Bedanya ${bagian.join('; ')} — ketemu lewat ${cara}.`;
}

const TH_BANDING: React.CSSProperties = { padding: '0.45rem 0.65rem', textAlign: 'left', whiteSpace: 'nowrap' };
const TD_BANDING: React.CSSProperties = { padding: '0.42rem 0.65rem', whiteSpace: 'nowrap' };
const CELL_BEDA: React.CSSProperties = { background: '#fff1f2', color: '#b91c1c', fontWeight: 800 };

function chipSumber(teks: string, warna: string): React.ReactNode {
  return (
    <span style={{ fontSize: '0.64rem', fontWeight: 800, color: warna, background: '#f9fafb', border: `1px solid ${warna}33`, padding: '0.08rem 0.35rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>
      {teks}
    </span>
  );
}

/** Dua baris berdesakan (sumber asal + lawannya) plus satu baris kalimat beda. */
const TabelBanding: React.FC<{
  items: { asal: SisiBanding; padanan: PadananSelisih<SisiBanding> }[];
  labelAsal: string;
  labelLawan: string;
  warnaAsal: string;
  warnaLawan: string;
  kolomLawan: string;
  sisaBaris?: number;
}> = ({ items, labelAsal, labelLawan, warnaAsal, warnaLawan, kolomLawan, sisaBaris = 0 }) => (
  <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflowX: 'auto' }}>
    <table className="custom-table" style={{ width: '100%', fontSize: '0.76rem', borderCollapse: 'collapse' }}>
      <thead style={{ background: '#f9fafb', color: '#4b5563' }}>
        <tr>
          <th style={TH_BANDING}>#</th>
          <th style={TH_BANDING}>SUMBER</th>
          <th style={TH_BANDING}>KODE POS</th>
          <th style={TH_BANDING}>KELURAHAN</th>
          <th style={TH_BANDING}>KECAMATAN</th>
          <th style={TH_BANDING}>KABUPATEN / KOTA</th>
          <th style={TH_BANDING}>{kolomLawan}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((b, i) => {
          const lawan = b.padanan.lawan;
          return (
            <React.Fragment key={`${b.asal.kodePos}-${b.asal.kelurahan}-${i}`}>
              <tr style={{ borderTop: '1px solid #e5e7eb', background: `${warnaAsal}0d` }}>
                <td style={TD_BANDING}>{i + 1}</td>
                <td style={TD_BANDING}>{chipSumber(labelAsal, warnaAsal)}</td>
                <td style={{ ...TD_BANDING, fontFamily: 'var(--font-mono)', fontWeight: 700, color: warnaAsal }}>{b.asal.kodePos || '-'}</td>
                <td style={{ ...TD_BANDING, fontWeight: 600 }}>{kapital(b.asal.kelurahan) || '-'}</td>
                <td style={TD_BANDING}>{kapital(b.asal.kecamatan) || '-'}</td>
                <td style={TD_BANDING}>{kapital(b.asal.kota) || '-'}</td>
                <td style={TD_BANDING}>{b.asal.catatan}</td>
              </tr>
              <tr>
                <td style={TD_BANDING} />
                <td style={TD_BANDING}>{chipSumber(lawan ? labelLawan : 'TIDAK ADA', warnaLawan)}</td>
                {lawan ? (
                  <>
                    <td style={{ ...TD_BANDING, fontFamily: 'var(--font-mono)', fontWeight: 700, ...(b.padanan.beda.includes('kodePos') ? CELL_BEDA : null) }}>{lawan.kodePos || '-'}</td>
                    <td style={{ ...TD_BANDING, ...(b.padanan.beda.includes('kelurahan') ? CELL_BEDA : null) }}>{kapital(lawan.kelurahan) || '-'}</td>
                    <td style={{ ...TD_BANDING, ...(b.padanan.beda.includes('kecamatan') ? CELL_BEDA : null) }}>{kapital(lawan.kecamatan) || '-'}</td>
                    <td style={{ ...TD_BANDING, ...(b.padanan.beda.includes('kota') ? CELL_BEDA : null) }}>{kapital(lawan.kota) || '-'}</td>
                    <td style={TD_BANDING}>{lawan.catatan}</td>
                  </>
                ) : (
                  <td colSpan={5} style={{ ...TD_BANDING, color: '#9a3412', fontStyle: 'italic' }}>
                    tidak ada baris yang mirip sama sekali
                  </td>
                )}
              </tr>
              <tr style={{ background: '#fcfcfd' }}>
                <td colSpan={7} style={{ padding: '0.3rem 0.65rem 0.5rem', fontSize: '0.72rem', color: '#4b5563' }}>
                  {teksBeda(labelAsal, labelLawan, b.asal, b.padanan)}
                </td>
              </tr>
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
    {sisaBaris > 0 && (
      <div style={{ padding: '0.5rem', textAlign: 'center', background: '#f9fafb', fontSize: '0.74rem', color: '#6b7280' }}>
        Menampilkan {items.length.toLocaleString('id-ID')} dari {sisaBaris.toLocaleString('id-ID')} baris.
      </div>
    )}
  </div>
);
