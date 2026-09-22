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
export const WARNA_TH: Record<GrupWarna, string> = { navy: '#366092', hijau: '#47D359', oranye: '#E97132' };

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

/** Baris → objek Excel/Template. `noEkspor` selalu posisi 1..n pada daftar yang diekspor. */
export function barisKeExcelFinal(r: AnalystRow, noEkspor: number): Record<string, string | number> {
  const item: Record<string, string | number> = {};
  KOLOM_FINAL.forEach((k) => {
    item[k.judul] = k.judul === 'No' ? noEkspor : k.nilai(r);
  });
  return item;
}
