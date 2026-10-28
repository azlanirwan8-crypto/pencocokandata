/**
 * Tracking Merchant — cermin menu "Tracking History Merchant" di 154.19.37.201/migrasi.
 *
 * Sumber aslinya bukan API: datanya literal JS `trackingMIDDatabase = [...]` di dalam
 * HTML halaman itu. `api/rolemapping.ts?tm=1` yang mengunduh HTML-nya tanpa kredensial
 * dan MEMOTONG kolomnya di sana, jadi identitas nasabah (KTP, nomor rekening, e-mail,
 * nomor HP, nama penginput) tidak pernah masuk ke aplikasi ini maupun ke cloud.
 *
 * Satu baris = satu riwayat pengajuan merchant (satu MID bisa punya lebih dari satu).
 */

import type { DefinisiKolomFilter } from './filterSort';
import { kapital } from './normalizer';

export interface BarisMerchant {
  mid: string;
  namaMerchant: string;
  kriteria: string;
  jenisPengajuan: string;
  jenisQr: string;
  tglPengajuan: string;
  lastUpdate: string;
  status: string;
  refNo: string;
  sumberOnboarding: string;
  merchantSegment: string;
  branchCode: string;
  alamat: string;
  provinsi: string;
  kabupatenKota: string;
  kecamatan: string;
  kelurahan: string;
  kodePos: string;
  /** Klasifikasi usaha (MCC) — kolom 18 dari 27 kolom data sumber. */
  jenisUsaha: string;
  /** Program promosi referral — kolom 28 sumber, isinya '-' untuk mayoritas merchant. */
  referralCode: string;
  /** Jumlah riwayat yang tersimpan untuk MID ini — dipakai penanda "2/3". */
  totalRiwayat: number;
  /** Urutan riwayat ini dalam MID-nya, 1 = paling baru. */
  idxRiwayat: number;
}

/**
 * Muatan yang disimpan di IndexedDB + app_store kunci `tracking_merchant_data`.
 * Jumlah merchant TIDAK disimpan di sini: selalu diturunkan dari `baris` (lihat
 * `ringkasTracking`), supaya angka di badge, kartu, dan tabel tidak mungkin berbeda.
 */
/**
 * Kartu ringkasan di halaman sumber. Angkanya teks statis di HTML sumber, bukan hasil
 * hitung tabel, jadi nilainya dibaca apa adanya saat sync.
 */
export interface KartuRingkasan {
  label: string;
  nilai: string;
  keterangan: string;
  kakiKiri: string;
  kakiKanan: string;
  warna: 'biru' | 'hijau' | 'merah' | 'ungu';
}

/**
 * Enam kartu "Kinerja Onboarding Merchant (2021 – 2026)" di halaman sumber. Sama seperti
 * kartu ringkasan, angkanya teks statis di HTML — bukan hasil hitung tabel — jadi dibaca
 * apa adanya saat sync: label tahun, emblem, total, keterangan, segmen bar, dan baris kaki.
 */
export interface KartuTahunSegmen {
  jenis: 'aktif' | 'tolak' | 'lain';
  persen: number;
}

export interface KartuTahunKaki {
  label: string;
  nilai: string;
  jenis: 'aktif' | 'tolak' | 'saluran';
}

export interface KartuTahun {
  label: string;
  emblem: string;
  nilai: string;
  keterangan: string;
  /** Kartu 2026 YTD diberi bingkai oranye di sumber. */
  unggulan: boolean;
  segmen: KartuTahunSegmen[];
  kaki: KartuTahunKaki[];
}

export interface MuatanTracking {
  diambilPada: string;
  sumber: string;
  baris: BarisMerchant[];
  /** Kosong/tidak ada pada muatan lama yang tersimpan sebelum kartu ini ikut disinkron. */
  ringkasan?: KartuRingkasan[];
  distribusi?: KartuTahun[];
}

export const KUNCI_STORAGE_TRACKING = 'tracking_merchant_data';
export const SUMUR_TRACKING = '154.19.37.201/migrasi';

export type KeranjangStatus = 'aktif' | 'proses' | 'tolak' | 'lain';

/**
 * Keranjang status mengikuti pengelompokan halaman sumber (Active / On Progress / Reject),
 * bukan teks mentahnya — "Rejected By Approver 2" dan "Reject by PTEN" satu keranjang.
 */
export function keranjangStatus(status: unknown): KeranjangStatus {
  const s = String(status ?? '').toLowerCase();
  if (s.includes('active')) return 'aktif';
  if (s.includes('reject')) return 'tolak';
  if (s.includes('progress') || s.includes('pending')) return 'proses';
  return 'lain';
}

export const LABEL_KERANJANG: Record<KeranjangStatus, string> = {
  aktif: 'Active',
  proses: 'On Progress',
  tolak: 'Reject',
  lain: 'Lainnya',
};

/**
 * Penjelasan satu keranjang status, dipakai panel detail. Sumbernya sendiri menulis
 * penjelasan begini (bukan data kolom), jadi boleh dicerminkan — kecuali untuk Reject:
 * sumber tidak punya kolom alasan, dan itu dikatakan apa adanya.
 */
export const KETERANGAN_STATUS: Record<KeranjangStatus, string> = {
  aktif: 'NMID terbit dan merchant aktif pada jaringan switching — QRIS siap transaksi interbank.',
  proses: 'Berkas masih dalam tahapan verifikasi approver operasional QRIS.',
  tolak: 'Berkas ditolak approver/PTEN. Sumber tidak menyertakan kolom alasan penolakan, jadi alasan detailnya tidak ada di aplikasi ini.',
  lain: 'Status tidak dikenali dari sumber — periksa baris aslinya di halaman sumber.',
};

export interface RingkasanTm {
  merchant: number;
  riwayat: number;
  aktif: number;
  proses: number;
  tolak: number;
  lain: number;
  cabang: number;
  provinsi: number;
  updateTerakhir: string;
}

/** Semua angka turunan (kartu KPI, badge, footer tabel) dibaca dari sini. */
export function ringkasTracking(baris: readonly BarisMerchant[]): RingkasanTm {
  const mid = new Set<string>();
  const cabang = new Set<string>();
  const provinsi = new Set<string>();
  const hitung: Record<KeranjangStatus, number> = { aktif: 0, proses: 0, tolak: 0, lain: 0 };
  let updateTerakhir = '';
  for (const r of baris) {
    mid.add(r.mid);
    if (r.branchCode && r.branchCode !== '-') cabang.add(r.branchCode);
    if (r.provinsi) provinsi.add(kapital(r.provinsi));
    hitung[keranjangStatus(r.status)]++;
    if (r.lastUpdate > updateTerakhir) updateTerakhir = r.lastUpdate;
  }
  return {
    merchant: mid.size,
    riwayat: baris.length,
    aktif: hitung.aktif,
    proses: hitung.proses,
    tolak: hitung.tolak,
    lain: hitung.lain,
    cabang: cabang.size,
    provinsi: provinsi.size,
    updateTerakhir,
  };
}

/**
 * Kolom yang tampil di tabel SEKALIGUS jadi definisi saringan kepala tabel dan daftar
 * ekspor Excel — satu sumber, jadi tidak mungkin angka di layar berbeda dari di berkas.
 */
export interface KolomTm {
  label: string;
  nilai: (r: BarisMerchant) => string;
  jenis?: 'teks' | 'angka';
  tengah?: boolean;
  /** Lebar minimum kolom (px) supaya nilai panjang tidak menggeser tabel. */
  lebar?: number;
  judul?: string;
}

/**
 * Urutan mengikuti tabel hasil + daftar 27 kolom di halaman sumber, ditambah satu kolom
 * turunan (`Status Verifikasi`) supaya operator bisa menyaring per keranjang, bukan per
 * teks status mentah yang ada lima varian.
 */
export const KOLOM_TM: readonly KolomTm[] = [
  { label: 'MID', nilai: (r) => r.mid, jenis: 'angka', tengah: true, lebar: 96, judul: 'Merchant ID' },
  { label: 'Nama Merchant', nilai: (r) => r.namaMerchant, lebar: 220 },
  {
    label: 'Flagging Riwayat',
    nilai: (r) => (r.totalRiwayat > 1 ? 'Multi-Event' : 'Tunggal'),
    tengah: true,
    lebar: 120,
    judul: 'MID dengan lebih dari satu pengajuan = Multi-Event (label sumber: Multi-Event / Tunggal)',
  },
  { label: 'Jenis Pengajuan', nilai: (r) => r.jenisPengajuan, lebar: 160 },
  { label: 'Jenis QR', nilai: (r) => r.jenisQr, tengah: true },
  { label: 'Tanggal Pengajuan', nilai: (r) => r.tglPengajuan, lebar: 140 },
  { label: 'Last Update', nilai: (r) => r.lastUpdate, lebar: 140 },
  {
    label: 'Status',
    nilai: (r) => r.status,
    tengah: true,
    lebar: 150,
    judul: 'Teks status persis seperti di sumber',
  },
  {
    label: 'Status Verifikasi',
    nilai: (r) => LABEL_KERANJANG[keranjangStatus(r.status)],
    tengah: true,
    lebar: 120,
    judul: 'Keranjang status yang dipakai kartu KPI (Active / On Progress / Reject / Lainnya) — kolom turunan',
  },
  { label: 'Ref No', nilai: (r) => r.refNo, lebar: 150 },
  { label: 'Sumber', nilai: (r) => r.sumberOnboarding, tengah: true, lebar: 100, judul: 'Salur onboarding (BNI MOM / N/A)' },
  { label: 'Kriteria', nilai: (r) => r.kriteria, lebar: 150 },
  { label: 'Jenis Usaha', nilai: (r) => r.jenisUsaha, lebar: 240, judul: 'Klasifikasi usaha (MCC) seperti ditampilkan sumber' },
  { label: 'Segmen Merchant', nilai: (r) => r.merchantSegment, lebar: 200 },
  { label: 'Cabang', nilai: (r) => r.branchCode, lebar: 180, judul: 'branch_code pada pengajuan' },
  { label: 'KODE POS', nilai: (r) => r.kodePos, tengah: true, lebar: 88 },
  { label: 'Kelurahan', nilai: (r) => kapital(r.kelurahan), lebar: 140 },
  { label: 'Kecamatan', nilai: (r) => kapital(r.kecamatan), lebar: 140 },
  { label: 'Kota / Kabupaten', nilai: (r) => kapital(r.kabupatenKota), lebar: 150 },
  { label: 'Provinsi', nilai: (r) => kapital(r.provinsi), lebar: 140 },
  { label: 'Alamat', nilai: (r) => r.alamat, lebar: 260 },
  { label: 'Referral Code', nilai: (r) => r.referralCode, tengah: true, lebar: 110, judul: 'Program promosi referral (kolom terakhir sumber)' },
];

/** Kunci saringan = teks header, sama seperti tabel lain di aplikasi ini. */
export const DEFINISI_KOLOM_TM: readonly DefinisiKolomFilter<BarisMerchant>[] = KOLOM_TM.map((k) => ({
  kunci: k.label,
  nilai: k.nilai,
  jenis: k.jenis,
}));

export const KOLOM_EKSPOR_TM: readonly string[] = ['No', ...KOLOM_TM.map((k) => k.label)];

/** Baris untuk berkas Excel: urutan & label sama persis dengan tabel. */
export function barisKeExcelTm(baris: readonly BarisMerchant[]): Record<string, string | number>[] {
  return baris.map((r, i) => {
    const out: Record<string, string | number> = { No: i + 1 };
    for (const k of KOLOM_TM) out[k.label] = k.nilai(r);
    return out;
  });
}

/** Pencarian bebas: satu kotak cari, semua kolom yang tampil di tabel. */
export function cocokCari(baris: BarisMerchant, teks: string): boolean {
  const q = teks.trim().toLowerCase();
  if (!q) return true;
  return KOLOM_TM.some((k) => k.nilai(baris).toLowerCase().includes(q));
}

/** Seluruh riwayat satu MID, terbaru dulu — dipakai panel detail. */
export function riwayatMerchant(baris: readonly BarisMerchant[], mid: string): BarisMerchant[] {
  return baris
    .filter((r) => r.mid === mid)
    .sort((a, b) => (a.tglPengajuan < b.tglPengajuan ? 1 : a.tglPengajuan > b.tglPengajuan ? -1 : 0));
}

/**
 * MID dari kata kunci pencarian panel Aktivitas — MID persis menang, lalu awalan MID
 * yang unik, baru nama merchant. Kata kunci yang cocok ke banyak MID sengaja TIDAK
 * dipilihkan salah satu: lebih baik bilang tidak ketemu daripada membuka jejak MID
 * yang bukan dimaksud operator.
 */
export function temukanMerchant(baris: readonly BarisMerchant[], kueri: string): string | null {
  const q = String(kueri || '').trim().toLowerCase();
  if (!q) return null;
  const persis = baris.find((r) => r.mid.toLowerCase() === q);
  if (persis) return persis.mid;
  const awalan = Array.from(new Set(baris.filter((r) => r.mid.toLowerCase().startsWith(q)).map((r) => r.mid)));
  if (awalan.length === 1) return awalan[0];
  const nama = baris.find((r) => r.namaMerchant && r.namaMerchant.toLowerCase().includes(q));
  return nama ? nama.mid : null;
}

export interface ContohMerchant {
  mid: string;
  nama: string;
  total: number;
}

/** Tombol "pilihan cepat": MID dengan riwayat terbanyak lebih dulu. */
export function contohMerchant(baris: readonly BarisMerchant[], maks = 3): ContohMerchant[] {
  const peta = new Map<string, ContohMerchant>();
  for (const r of baris) {
    if (!r.mid) continue;
    const ada = peta.get(r.mid);
    if (ada) {
      ada.total = Math.max(ada.total, r.totalRiwayat || 1);
      if (!ada.nama) ada.nama = r.namaMerchant || '';
      continue;
    }
    peta.set(r.mid, { mid: r.mid, nama: r.namaMerchant || '', total: r.totalRiwayat || 1 });
  }
  return Array.from(peta.values())
    .sort((a, b) => b.total - a.total || a.mid.localeCompare(b.mid))
    .slice(0, maks);
}

/** Sub-keterangan di bawah Ref No, persis istilah halaman sumber. */
export function keteranganRef(status: string): string {
  return /reject/i.test(String(status || ''))
    ? 'FDS NMR v5.2 Compliance Check'
    : 'Lifecycle Onboarding Stage';
}
