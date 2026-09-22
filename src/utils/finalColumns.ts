import type { CSSProperties } from 'react';
import type { AnalystRow } from './analystPipeline';

/**
 * SATU sumber kebenaran untuk 13 kolom Data Final: dipakai tabel menu Final Data,
 * ekspor Excel dashboard, PDF, dan template unggah. Nama kolom di sini HARUS sama
 * dengan yang dikenali `getHeaderStyle()` (utils/excel) dan `parseFinalExcelRow()`,
 * supaya warna kepala berkas, kepala tabel, dan pembacaan ulang file unggah tidak
 * bisa lari satu sama lain.
 *
 * Urutan & penamaan = permintaan pemilik produk 2026-09-22; warna grup diukur
 * per-piksel dari tangkapan layar header yang dilampirkannya.
 */
export type GrupWarna = 'navy' | 'hijau' | 'oranye';
export const WARNA_TH: Record<GrupWarna, string> = { navy: '#405189', hijau: '#0ab39c', oranye: '#E97132' };

export type KolomFinal = {
  judul: string;
  grup: GrupWarna;
  style?: CSSProperties;
  tengah?: boolean;
  mono?: boolean;
  nilai: (r: AnalystRow) => string | number;
};

export const KOLOM_FINAL: KolomFinal[] = [
  { judul: 'No', grup: 'navy', tengah: true, style: { width: '54px' }, nilai: (r) => r.no },
  { judul: 'Wilayah', grup: 'navy', tengah: true, style: { width: '92px' }, nilai: (r) => r.wilayah || '-' },
  { judul: 'Sandi Cabang', grup: 'navy', tengah: true, mono: true, style: { width: '110px' }, nilai: (r) => r.sandiCabang || '-' },
  { judul: 'Branch Code', grup: 'navy', tengah: true, mono: true, style: { width: '95px' }, nilai: (r) => r.branchCode || '-' },
  { judul: 'Kode Cabang', grup: 'navy', tengah: true, mono: true, style: { width: '95px' }, nilai: (r) => r.kodeCabang || '-' },
  { judul: 'Nama Outlet', grup: 'navy', style: { minWidth: '170px' }, nilai: (r) => r.namaOutlet || '-' },
  { judul: 'Status Outlet', grup: 'navy', tengah: true, style: { width: '95px' }, nilai: (r) => r.statusOutlet || '-' },
  { judul: 'ALAMAT', grup: 'hijau', style: { minWidth: '220px' }, nilai: (r) => r.alamat || '-' },
  { judul: 'KODE POS', grup: 'hijau', tengah: true, mono: true, style: { width: '90px' }, nilai: (r) => r.kodePosKelurahan || r.kodePosPten || '-' },
  { judul: 'Kelurahan', grup: 'hijau', style: { minWidth: '140px' }, nilai: (r) => r.kelurahan || '-' },
  { judul: 'Kecamatan', grup: 'hijau', style: { minWidth: '140px' }, nilai: (r) => r.kecamatan || '-' },
  { judul: 'Dati II', grup: 'oranye', style: { minWidth: '140px' }, nilai: (r) => r.kotaPtenMax15 || r.kotaPten || '-' },
  { judul: 'Provinsi', grup: 'hijau', style: { minWidth: '130px' }, nilai: (r) => r.provinsi || '-' },
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
  'KODE POS': '40111',
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
  { judul: 'No', grup: 'navy', tengah: true, nilai: (r) => r.no },
  { judul: 'Wilayah', grup: 'navy', tengah: true, nilai: (r) => r.wilayah || KOSONG_TAMPIL },
  { judul: 'Sandi Cabang', grup: 'navy', tengah: true, mono: true, nilai: (r) => r.sandiCabang || KOSONG_TAMPIL },
  { judul: 'Branch Code', grup: 'navy', tengah: true, mono: true, nilai: (r) => r.branchCode || KOSONG_TAMPIL },
  { judul: 'Kode Cabang', grup: 'navy', tengah: true, mono: true, nilai: (r) => r.kodeCabang || KOSONG_TAMPIL },
  { judul: 'Nama Outlet', grup: 'navy', nilai: (r) => r.namaOutlet || KOSONG_TAMPIL },
  { judul: 'Status Outlet', grup: 'navy', tengah: true, nilai: (r) => r.statusOutlet || KOSONG_TAMPIL },
  { judul: 'ALAMAT', grup: 'hijau', nilai: (r) => r.alamat || KOSONG_TAMPIL },
  { judul: 'KODE POS', grup: 'hijau', tengah: true, mono: true, nilai: (r) => r.kodePosKelurahan || r.kodePosPten || KOSONG_TAMPIL },
  { judul: 'Kelurahan', grup: 'hijau', nilai: (r) => r.kelurahan || KOSONG_TAMPIL },
  { judul: 'Kecamatan', grup: 'hijau', nilai: (r) => r.kecamatan || KOSONG_TAMPIL },
  { judul: 'Dati II', grup: 'oranye', nilai: (r) => r.kotaPtenMax15 || r.kotaPten || KOSONG_TAMPIL },
  { judul: 'Provinsi', grup: 'hijau', nilai: (r) => r.provinsi || KOSONG_TAMPIL },
  { judul: 'KOTA PTEN', grup: 'oranye', nilai: (r) => r.kotaPtenMax15 || r.kotaPten || KOSONG_TAMPIL },
  { judul: 'KODE POS PTEN', grup: 'hijau', tengah: true, mono: true, nilai: (r) => r.kodePosPten || KOSONG_TAMPIL },
  // `CEK KODE POS + PTEN` membandingkan tingkat KOTA, bukan kode pos kelurahan di atas
  { judul: 'CEK KODE POS + PTEN', grup: 'hijau', tengah: true, nilai: (r) => r.statusPten || KOSONG_TAMPIL },
  {
    judul: 'VERIFIKASI PENEMPATAN',
    grup: 'hijau',
    tengah: true,
    nilai: (r) =>
      r.placementStatus === 'VERIFIED' ? 'TERVERIFIKASI' : r.placementStatus === 'REVIEW' ? 'PERLU REVIEW' : r.placementStatus === 'FALLBACK' ? 'FALLBACK' : KOSONG_TAMPIL,
  },
  { judul: 'METODE PENEMPATAN', grup: 'hijau', nilai: (r) => r.placementMethod || KOSONG_TAMPIL },
  { judul: 'ORGANISASI TUJUAN', grup: 'navy', nilai: (r) => r.organisasiTujuan || KOSONG_TAMPIL },
  { judul: 'Tipe Unit', grup: 'navy', tengah: true, nilai: (r) => r.tipeUnit || KOSONG_TAMPIL },
  { judul: 'Alur Wondr', grup: 'navy', nilai: (r) => r.alurWondr || KOSONG_TAMPIL },
  { judul: 'QRS_CABSAL', grup: 'hijau', tengah: true, nilai: (r) => r.roleCabsal },
  { judul: 'QRS_CABAPV1', grup: 'hijau', tengah: true, nilai: (r) => r.roleCabapv1 },
  { judul: 'QRS_CABAPV2', grup: 'hijau', tengah: true, nilai: (r) => r.roleCabapv2 },
  { judul: 'Grand Total', grup: 'hijau', tengah: true, nilai: (r) => r.roleGrandTotal },
  { judul: 'Status Analisa', grup: 'navy', tengah: true, nilai: (r) => (r.isFinalApproved ? 'VERIFIED' : r.statusAnalisa) || KOSONG_TAMPIL },
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
