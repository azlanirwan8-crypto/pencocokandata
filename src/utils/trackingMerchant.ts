/**
 * Tracking Merchant — pembacaan muatan yang sudah tersimpan di cloud.
 *
 * Menu ini tidak lagi mengambil data dari mana pun: `api/rolemapping.ts?tm=1`
 * hanya mengembalikan muatan terakhir di app_store. Identitas nasabah (KTP, nomor
 * rekening, e-mail, nomor HP, nama penginput) tidak ada di muatan itu.
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
  /** Urutan riwayat ini PERSIS seperti di sumber (1 = tampil paling atas / "Tahap Terkini"). */
  idxRiwayat: number;
  /**
   * Identitas tingkat merchant di sumber. Kartu MID di halaman sumber dibaca dari objek
   * induk, bukan dari event — nilainya bisa berbeda (nama, kriteria, status terakhir).
   * Tidak ada pada muatan lama yang tersimpan sebelum kolom ini ikut tersalin.
   */
  namaMerchantInduk?: string;
  kriteriaInduk?: string;
  kotaInduk?: string;
  provinsiInduk?: string;
  /** `jenis_qr` induk — dasar saringan daftar merchant terverifikasi di sumber. */
  jenisQrInduk?: string;
  /** `status_terakhir` induk; kosong pada muatan lama. */
  statusTerakhir?: string;
}

/**
 * Muatan yang disimpan di IndexedDB + app_store kunci `tracking_merchant_data`.
 * Jumlah merchant TIDAK disimpan di sini: selalu diturunkan dari `baris` (lihat
 * `ringkasTracking`), supaya angka di badge, kartu, dan tabel tidak mungkin berbeda.
 */
/**
 * Kartu ringkasan pada muatan tersimpan. Angkanya nilai literal, bukan hasil hitung
 * tabel, jadi dibaca apa adanya.
 */
export interface KartuRingkasan {
  label: string;
  nilai: string;
  warna: 'biru' | 'hijau' | 'merah' | 'ungu';
}

/**
 * Enam kartu "Kinerja Onboarding Merchant (2021 – 2026)" pada muatan tersimpan. Sama seperti
 * kartu ringkasan, angkanya nilai literal — bukan hasil hitung tabel — jadi dibaca apa
 * adanya: label tahun, emblem, total, keterangan, segmen bar, dan baris kaki.
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
  baris: BarisMerchant[];
  /** Kosong/tidak ada pada muatan lama yang tersimpan sebelum kartu ini ikut disalin. */
  ringkasan?: KartuRingkasan[];
  distribusi?: KartuTahun[];
}

export const KUNCI_STORAGE_TRACKING = 'tracking_merchant_data';

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

/** Pencarian bebas: satu kotak cari, semua kolom yang tampil di tabel. */
export function cocokCari(baris: BarisMerchant, teks: string): boolean {
  const q = teks.trim().toLowerCase();
  if (!q) return true;
  return KOLOM_TM.some((k) => k.nilai(baris).toLowerCase().includes(q));
}

/**
 * Seluruh riwayat satu MID dengan urutan PERSIS seperti sumber (`idxRiwayat` naik), karena
 * halaman sumber menandai baris pertama sebagai "Tahap Terkini" dan merender tabel apa
 * adanya. Muatan lama tanpa `idxRiwayat` jatuh ke urutan tanggal terbaru dulu.
 */
export function riwayatMerchant(baris: readonly BarisMerchant[], mid: string): BarisMerchant[] {
  return baris
    .filter((r) => r.mid === mid)
    .sort((a, b) => {
      const x = Number(a.idxRiwayat) || 0;
      const y = Number(b.idxRiwayat) || 0;
      if (x !== y) return x - y;
      return a.tglPengajuan < b.tglPengajuan ? 1 : a.tglPengajuan > b.tglPengajuan ? -1 : 0;
    });
}

/** Nama yang dipakai sumber saat mencari: nama merchant INDUK, bukan nama di event. */
const namaIndukMerchant = (r: BarisMerchant) => r.namaMerchantInduk || r.namaMerchant || '';

/**
 * MID dari kata kunci pencarian panel Aktivitas — semantiknya sama dengan
 * `searchTrackingMID` halaman sumber: MID persis, atau nama merchant induk yang memuat
 * kata kunci (tanpa peduli huruf besar/kecil), dan yang pertama di urutan data menang.
 * Sumber tidak mengenal awalan MID, jadi awalan pun tidak dipilihkan di sini.
 */
export function temukanMerchant(baris: readonly BarisMerchant[], kueri: string): string | null {
  const q = String(kueri || '').trim();
  if (!q) return null;
  const ql = q.toLowerCase();
  const kena = baris.find((r) => r.mid === q || namaIndukMerchant(r).toLowerCase().includes(ql));
  return kena ? kena.mid : null;
}

/**
 * Sub-keterangan di bawah Ref No. Sumber memakai `status.includes('Reject')` — peka
 * huruf besar/kecil, jadi "rejected by ..." huruf kecil pun jatuh ke label lifecycle.
 */
export function keteranganRef(status: string): string {
  return String(status || '').includes('Reject')
    ? 'FDS NMR v5.2 Compliance Check'
    : 'Lifecycle Onboarding Stage';
}

/** Teks badge status, persis `getStatusBadge()` halaman sumber. */
export function labelStatusSumber(status: unknown): string {
  const teks = String(status ?? '');
  if (teks.toLowerCase().includes('active')) return 'Active (NMID Terbit)';
  return teks || 'In Process';
}

export interface KartuMerchant {
  mid: string;
  nama: string;
  kriteria: string;
  lokasi: string;
  status: string;
}

/**
 * Isi kartu identitas MID, dibaca seperti `renderMIDDetail()` di sumber: nama, kriteria,
 * kota, dan provinsi dari objek INDUK; status = `status_terakhir` induk, atau status
 * event TERAKHIR di urutan sumber, atau "Active". Muatan lama tanpa kolom induk jatuh
 * ke nilai event baris pertama supaya kartu tetap terisi.
 */
export function kartuMerchant(jejak: readonly BarisMerchant[]): KartuMerchant | null {
  if (jejak.length === 0) return null;
  const r = jejak[0];
  const isi = (nilai: string | undefined, cadangan: string) =>
    nilai && nilai.trim() ? nilai : cadangan;
  const statusTerakhir =
    isi(r.statusTerakhir, jejak[jejak.length - 1].status) || 'Active';
  const kota = r.kotaInduk !== undefined ? r.kotaInduk : r.kabupatenKota;
  const provinsi = isi(r.provinsiInduk, r.provinsi) || 'Indonesia';
  return {
    mid: r.mid,
    nama: isi(r.namaMerchantInduk, r.namaMerchant) || 'Merchant QRIS',
    kriteria: isi(r.kriteriaInduk, r.kriteria) || 'Kriteria Reguler',
    lokasi: [kota, provinsi].filter(Boolean).join(' • ') || 'Indonesia',
    status: labelStatusSumber(statusTerakhir),
  };
}

// ─── Titik merchant untuk peta Dashboard ───────────────────────────────────
// Sumber tidak menyimpan koordinat dan `branch_code` semua merchant kosong, jadi
// titiknya harus dicari dari TEKS ALAMAT dan cabangnya hanya bisa didekati lewat kota.
// Dua hal itu tidak boleh disembunyikan: alamat yang isinya "tes" tidak boleh dicari
// ke geocoder (hasilnya kota acak), dan alamat yang hanya berisi nama kota hanya
// pantas jadi titik perkiraan.

export type KelasAlamatMerchant = 'presisi' | 'kasar' | 'tidak-valid';

export interface MerchantPeta {
  mid: string;
  nama: string;
  alamat: string;
  kota: string;
  provinsi: string;
  kelas: KelasAlamatMerchant;
  /** Kueri geocoding; kosong bila alamat tidak layak dicari. */
  kueri: string;
}

/** Penanda tingkat jalan/bangunan — satu-satunya dasar "presisi" di sini. */
const PENANDA_ALAMAT_JALAN =
  /\b(jl|jln|jalan|gg|gang|blok|blk|ruko|perum|komplek|komp|kav|no|nomor|rt|rw|lt|lantai|unit|mall|tower|gedung|booth|superblock|pertokoan)\b/i;
/** Alamat uji/placeholder yang tidak menunjuk tempat mana pun. */
const KATA_ALAMAT_UJI = /^(tes|test|testing|coba|cobaan|asdf|asd|qwerty|xxx+|n\/?a|null|undefined|-+)$/i;

/**
 * `presisi` = ada penanda jalan/bangunan; `kasar` = hanya nama kota/desa/daerah;
 * `tidak-valid` = kosong, tanpa huruf, URL, atau berisi kata uji ("tes").
 */
export function kelasAlamatMerchant(alamat: unknown): KelasAlamatMerchant {
  const teks = String(alamat ?? '').trim();
  if (teks.length < 4) return 'tidak-valid';
  if (!/[a-z]/i.test(teks)) return 'tidak-valid';
  if (/:\/\//.test(teks) || /^www\./i.test(teks)) return 'tidak-valid';
  const kata = teks.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ');
  if (kata.some((k) => KATA_ALAMAT_UJI.test(k))) return 'tidak-valid';
  return PENANDA_ALAMAT_JALAN.test(teks) ? 'presisi' : 'kasar';
}

/**
 * Kueri geocoder: alamat + wilayah administratif + Indonesia. Bagian yang sudah
 * termuat di alamat tidak diulang supaya hasil pencarian tidak bias ke nama kota.
 */
export function kueriPetaMerchant(m: {
  alamat?: unknown;
  kelurahan?: unknown;
  kecamatan?: unknown;
  kota?: unknown;
  provinsi?: unknown;
}): string {
  const teks = (v: unknown) => String(v ?? '').trim();
  // Bandingkan tanpa prefiks wilayah: "Kota Bandung" dan "Bandung" itu kota yang sama.
  const inti = (v: string) =>
    v
      .toLowerCase()
      .replace(/^(kota|kabupaten|kab\.?|provinsi|prov\.?)\s+/, '')
      .trim();
  const alamat = teks(m.alamat);
  const bagian: string[] = [];
  const tambah = (nilai: string) => {
    const v = nilai.trim();
    if (!v) return;
    const kecil = v.toLowerCase();
    const dasar = inti(v);
    if (bagian.some((b) => b.toLowerCase() === kecil || inti(b) === dasar)) return;
    // Hanya bagian wilayah yang boleh dilewati karena sudah ada di alamat; alamat
    // sendiri selalu dipakai apa adanya.
    if (bagian.length > 0 && dasar && inti(alamat).includes(dasar)) return;
    bagian.push(v);
  };
  tambah(alamat);
  tambah(teks(m.kelurahan));
  tambah(teks(m.kecamatan));
  tambah(teks(m.kota));
  tambah(teks(m.provinsi));
  if (bagian.length === 0) return '';
  const dasar = bagian.join(', ');
  return /indonesia\s*$/i.test(dasar) ? dasar : `${dasar}, Indonesia`;
}

/**
 * Satu titik per MID, memakai identitas INDUK seperti tabel sumber. Muatan lama tanpa
 * kolom induk jatuh ke nilai event pertama.
 */
export function daftarMerchantPeta(baris: readonly BarisMerchant[]): MerchantPeta[] {
  const urut: string[] = [];
  const peta = new Map<string, MerchantPeta>();
  for (const r of baris) {
    if (!r.mid || peta.has(r.mid)) continue;
    const alamat = String(r.alamat || '').trim();
    const kota = String(r.kotaInduk || r.kabupatenKota || '').trim();
    const provinsi = String(r.provinsiInduk || r.provinsi || '').trim();
    const kelas = kelasAlamatMerchant(alamat);
    const kueri = kelas === 'tidak-valid' ? '' : kueriPetaMerchant({ alamat, kelurahan: r.kelurahan, kecamatan: r.kecamatan, kota, provinsi });
    urut.push(r.mid);
    peta.set(r.mid, {
      mid: r.mid,
      nama: r.namaMerchantInduk || r.namaMerchant || r.mid,
      alamat,
      kota,
      provinsi,
      kelas,
      kueri,
    });
  }
  return urut.map((mid) => peta.get(mid) as MerchantPeta);
}

export interface KelompokMerchantPeta {
  kueri: string;
  alamat: string;
  kota: string;
  kelas: 'presisi' | 'kasar';
  merchants: MerchantPeta[];
}

/**
 * Satu kelompok = satu alamat = satu busur. Merchant yang berbagi alamat tidak
 * digambar bertumpuk; mereka muncul bersama di tooltip titik itu.
 */
export function kelompokkanMerchantPeta(
  daftar: readonly MerchantPeta[],
  ikutKasar = false
): KelompokMerchantPeta[] {
  const peta = new Map<string, KelompokMerchantPeta>();
  for (const m of daftar) {
    if (!m.kueri || m.kelas === 'tidak-valid') continue;
    if (m.kelas === 'kasar' && !ikutKasar) continue;
    const ada = peta.get(m.kueri);
    if (ada) {
      ada.merchants.push(m);
      continue;
    }
    peta.set(m.kueri, {
      kueri: m.kueri,
      alamat: m.alamat,
      kota: m.kota,
      kelas: m.kelas,
      merchants: [m],
    });
  }
  return Array.from(peta.values()).sort((a, b) => {
    if (a.kelas !== b.kelas) return a.kelas === 'presisi' ? -1 : 1;
    if (a.merchants.length !== b.merchants.length) return b.merchants.length - a.merchants.length;
    return a.alamat.localeCompare(b.alamat);
  });
}

export interface RingkasanMerchantPeta {
  total: number;
  presisi: number;
  kasar: number;
  tidakValid: number;
  /** Jumlah alamat unik (satu busur per alamat), bukan jumlah merchant. */
  titikPresisi: number;
  titikKasar: number;
}

/** Angka panel peta: merchant di satu kota + berapa titik yang benar-benar bisa digambar. */
export function ringkasMerchantPeta(daftar: readonly MerchantPeta[]): RingkasanMerchantPeta {
  let presisi = 0;
  let kasar = 0;
  let tidakValid = 0;
  const titikPresisi = new Set<string>();
  const titikKasar = new Set<string>();
  for (const m of daftar) {
    if (m.kelas === 'tidak-valid') {
      tidakValid++;
      continue;
    }
    if (m.kelas === 'presisi') {
      presisi++;
      titikPresisi.add(m.kueri);
    } else {
      kasar++;
      titikKasar.add(m.kueri);
    }
  }
  return { total: daftar.length, presisi, kasar, tidakValid, titikPresisi: titikPresisi.size, titikKasar: titikKasar.size };
}
