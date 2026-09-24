import type { CSSProperties } from 'react';
import type { AnalystRow } from './analystPipeline';

/**
 * SATU sumber kebenaran untuk 13 kolom Data Final: dipakai tabel menu Final Data,
 * ekspor Excel dashboard, PDF, dan template unggah. Nama kolom di sini HARUS sama
 * dengan yang dikenali `parseFinalExcelRow()` supaya pembacaan ulang berkas unggah
 * tidak bisa lari.
 *
 * Urutan & penamaan = permintaan pemilik produk 2026-09-22.
 *
 * CATATAN WARNA: `WARNA_TH` di bawah hanya mengatur kepala tabel DI LAYAR. Kepala
 * berkas Excel sengaja memakai palet berkas sumber operator (`getHeaderStyle` di
 * utils/excel) — bukan token layar — jadi keduanya memang tidak sama.
 */
export type GrupWarna = 'wilayah' | 'outlet' | 'pos' | 'geo';
export const WARNA_TH: Record<GrupWarna, string> = {
  wilayah: '#0ab39c',
  outlet: '#405189',
  pos: '#E97132',
  geo: '#6C5CE7',
};

export type KolomFinal = {
  judul: string;
  grup: GrupWarna;
  style?: CSSProperties;
  tengah?: boolean;
  mono?: boolean;
  nilai: (r: AnalystRow) => string | number;
};

export const KOLOM_FINAL: KolomFinal[] = [
  { judul: 'No', grup: 'wilayah', tengah: true, style: { width: '54px' }, nilai: (r) => r.no },
  { judul: 'Wilayah', grup: 'wilayah', tengah: true, style: { width: '92px' }, nilai: (r) => r.wilayah || '-' },
  { judul: 'Sandi Cabang', grup: 'outlet', tengah: true, mono: true, style: { width: '110px' }, nilai: (r) => r.sandiCabang || '-' },
  { judul: 'Branch Code', grup: 'outlet', tengah: true, mono: true, style: { width: '95px' }, nilai: (r) => r.branchCode || '-' },
  { judul: 'Kode Cabang', grup: 'outlet', tengah: true, mono: true, style: { width: '95px' }, nilai: (r) => r.kodeCabang || '-' },
  { judul: 'Nama Outlet', grup: 'outlet', style: { minWidth: '170px' }, nilai: (r) => r.namaOutlet || '-' },
  { judul: 'Status Outlet', grup: 'outlet', tengah: true, style: { width: '95px' }, nilai: (r) => r.statusOutlet || '-' },
  { judul: 'ALAMAT', grup: 'outlet', style: { minWidth: '220px' }, nilai: (r) => r.alamat || '-' },
  // 🧾 ATURAN (pemilik produk 2026-09-24): "KODE POS" di Data Final = kode pos BARIS PTEN
  // yang dianalisa di Fase 1, supaya angkanya bisa dicocokkan balik ke berkas PTEN.
  // Kode pos kelurahan dari Master Kode Pos memang lebih halus (satu kota PTEN dipecah ke
  // seluruh kelurahannya) tapi itu BUKAN angka PTEN — jadi ia dapat kolomnya sendiri di
  // sebelah sini, tidak menggantikan yang lama.
  { judul: 'KODE POS', grup: 'pos', tengah: true, mono: true, style: { width: '90px' }, nilai: (r) => r.kodePosPten || '-' },
  { judul: 'KODE POS KELURAHAN', grup: 'pos', tengah: true, mono: true, style: { width: '110px' }, nilai: (r) => r.kodePosKelurahan || '-' },
  { judul: 'Kelurahan', grup: 'geo', style: { minWidth: '140px' }, nilai: (r) => r.kelurahan || '-' },
  { judul: 'Kecamatan', grup: 'geo', style: { minWidth: '140px' }, nilai: (r) => r.kecamatan || '-' },
  { judul: 'Dati II', grup: 'pos', style: { minWidth: '140px' }, nilai: (r) => r.kotaPtenMax15 || r.kotaPten || '-' },
  { judul: 'Provinsi', grup: 'geo', style: { minWidth: '130px' }, nilai: (r) => r.provinsi || '-' },
];

export const JUDUL_KOLOM_FINAL = KOLOM_FINAL.map((k) => k.judul);

/** Baris contoh pada "Template Excel" menu Final Data — contoh isi, bukan data. */
export const CONTOH_KOLOM_FINAL: Record<string, string> = {
  Wilayah: '011',
  'Sandi Cabang': '01100001',
  'Branch Code': '01100001',
  'Kode Cabang': '01100001',
  'Nama Outlet': 'CONTOH NAMA OUTLET',
  'Status Outlet': 'KC',
  ALAMAT: 'JL CONTOH NO 1',
  'KODE POS': '20111',
  'KODE POS KELURAHAN': '20112',
  Kelurahan: 'CONTOH KELURAHAN',
  Kecamatan: 'CONTOH KECAMATAN',
  'Dati II': 'CONTOHKOTA',
  Provinsi: 'JAWA BARAT',
};

/** Penanda sel kosong di layar. Di berkas Excel penanda ini dibuang (lihat kosongSel). */
const KOSONG_TAMPIL = '-';

/** Sel kosong → string kosong, bukan '-': Excel bisa menyaring "(Blanks)" dan angka tetap angka. */
function kosongSel(v: string | number): string | number {
  return typeof v === 'string' && v.trim() === KOSONG_TAMPIL ? '' : v;
}

/** Baris → objek Excel/Template. `noEkspor` selalu posisi 1..n pada daftar yang diekspor. */
export function barisKeExcelFinal(r: AnalystRow, noEkspor: number): Record<string, string | number> {
  const item: Record<string, string | number> = {};
  KOLOM_FINAL.forEach((k) => {
    item[k.judul] = k.judul === 'No' ? noEkspor : kosongSel(k.nilai(r));
  });
  return item;
}

/**
 * Kolom ekspor DATA ANALYST (menu Data Analyst → Unduh Excel). Sheet per wilayah dan sheet
 * SEMUA_DATA memakai daftar ini supaya kolomnya tidak bisa beda sendiri-sendiri.
 */
export const KOLOM_ANALYST: KolomFinal[] = [
  { judul: 'No', grup: 'wilayah', tengah: true, nilai: (r) => r.no },
  { judul: 'Wilayah', grup: 'wilayah', tengah: true, nilai: (r) => r.wilayah || KOSONG_TAMPIL },
  { judul: 'Sandi Cabang', grup: 'outlet', tengah: true, mono: true, nilai: (r) => r.sandiCabang || KOSONG_TAMPIL },
  { judul: 'Branch Code', grup: 'outlet', tengah: true, mono: true, nilai: (r) => r.branchCode || KOSONG_TAMPIL },
  { judul: 'Kode Cabang', grup: 'outlet', tengah: true, mono: true, nilai: (r) => r.kodeCabang || KOSONG_TAMPIL },
  { judul: 'Nama Outlet', grup: 'outlet', nilai: (r) => r.namaOutlet || KOSONG_TAMPIL },
  { judul: 'Status Outlet', grup: 'outlet', tengah: true, nilai: (r) => r.statusOutlet || KOSONG_TAMPIL },
  { judul: 'ALAMAT', grup: 'outlet', nilai: (r) => r.alamat || KOSONG_TAMPIL },
  { judul: 'KODE POS', grup: 'pos', tengah: true, mono: true, nilai: (r) => r.kodePosKelurahan || r.kodePosPten || KOSONG_TAMPIL },
  { judul: 'Kelurahan', grup: 'geo', nilai: (r) => r.kelurahan || KOSONG_TAMPIL },
  { judul: 'Kecamatan', grup: 'geo', nilai: (r) => r.kecamatan || KOSONG_TAMPIL },
  { judul: 'Dati II', grup: 'pos', nilai: (r) => r.kotaPtenMax15 || r.kotaPten || KOSONG_TAMPIL },
  { judul: 'Provinsi', grup: 'geo', nilai: (r) => r.provinsi || KOSONG_TAMPIL },
  { judul: 'KOTA PTEN', grup: 'pos', nilai: (r) => r.kotaPtenMax15 || r.kotaPten || KOSONG_TAMPIL },
  { judul: 'KODE POS PTEN', grup: 'pos', tengah: true, mono: true, nilai: (r) => r.kodePosPten || KOSONG_TAMPIL },
  // `CEK KODE POS + PTEN` membandingkan tingkat KOTA, bukan kode pos kelurahan di atas
  { judul: 'CEK KODE POS + PTEN', grup: 'pos', tengah: true, nilai: (r) => r.statusPten || KOSONG_TAMPIL },
  {
    judul: 'VERIFIKASI PENEMPATAN',
    grup: 'outlet',
    tengah: true,
    nilai: (r) =>
      r.placementStatus === 'VERIFIED' ? 'TERVERIFIKASI' : r.placementStatus === 'REVIEW' ? 'PERLU REVIEW' : r.placementStatus === 'FALLBACK' ? 'FALLBACK' : KOSONG_TAMPIL,
  },
  { judul: 'METODE PENEMPATAN', grup: 'outlet', nilai: (r) => r.placementMethod || KOSONG_TAMPIL },
  { judul: 'ORGANISASI TUJUAN', grup: 'outlet', nilai: (r) => r.organisasiTujuan || KOSONG_TAMPIL },
  { judul: 'Tipe Unit', grup: 'outlet', tengah: true, nilai: (r) => r.tipeUnit || KOSONG_TAMPIL },
  { judul: 'Alur Wondr', grup: 'outlet', nilai: (r) => r.alurWondr || KOSONG_TAMPIL },
  { judul: 'QRS_CABSAL', grup: 'outlet', tengah: true, nilai: (r) => r.roleCabsal },
  { judul: 'QRS_CABAPV1', grup: 'outlet', tengah: true, nilai: (r) => r.roleCabapv1 },
  { judul: 'QRS_CABAPV2', grup: 'outlet', tengah: true, nilai: (r) => r.roleCabapv2 },
  { judul: 'Grand Total', grup: 'outlet', tengah: true, nilai: (r) => r.roleGrandTotal },
  { judul: 'Status Analisa', grup: 'wilayah', tengah: true, nilai: (r) => (r.isFinalApproved ? 'VERIFIED' : r.statusAnalisa) || KOSONG_TAMPIL },
];

export const JUDUL_KOLOM_ANALYST = KOLOM_ANALYST.map((k) => k.judul);

/** Baris analisa → objek Excel. `noEkspor` posisi 1..n pada lembar tersebut. */
export function barisKeExcelAnalyst(r: AnalystRow, noEkspor: number): Record<string, string | number> {
  const item: Record<string, string | number> = {};
  KOLOM_ANALYST.forEach((k) => {
    item[k.judul] = k.judul === 'No' ? noEkspor : kosongSel(k.nilai(r));
  });
  return item;
}
