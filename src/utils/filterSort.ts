/**
 * Logika murni sort + filter header ala Excel — sengaja tanpa React supaya bisa diuji
 * lewat tests/entry-uji.ts dan dipakai ulang oleh semua tabel di aplikasi.
 */

export type JenisKolom = 'teks' | 'angka';

export interface DefinisiKolomFilter<T> {
  /** id kolom = teks header; dipakai sebagai kunci state tersimpan. */
  kunci: string;
  /** Pengambil nilai mentah per baris. */
  nilai: (row: T) => unknown;
  jenis?: JenisKolom;
}

/**
 * Daftar nilai di popover dipotong sampai di sini — Excel sendiri melakukan itu
 * ("Not all items showing"). Nilainya TIDAK dibuang, hanya daftarnya dipotong, dan
 * kotak cari di dalam popover mencari ke SELURUH nilai unik, bukan cuma yang tampil.
 */
export const BATAS_DAFTAR_NILAI = 500;

/** Nilai kosong ikut bisa disaring, seperti "(Blanks)" di Excel. */
export const KOSONG = '(kosong)';

export interface DaftarNilai {
  /** SEMUA nilai unik, terurut — pencarian di popover bekerja di daftar ini. */
  semua: string[];
  totalUnik: number;
}

const teksSel = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  return String(v).trim();
};

/** Kunci banding untuk teks: huruf besar + spasi rapat, supaya "solo" == "SOLO". */
const kunciTeks = (v: unknown): string => teksSel(v).toUpperCase().replace(/\s+/g, ' ');

const angkaSel = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : Number.NaN;
  const bersih = String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = Number.parseFloat(bersih);
  return Number.isFinite(n) ? n : Number.NaN;
};

/**
 * Nilai unik sebuah kolom, terurut. Teks dibandingkan sebagai huruf besar supaya
 * "Biak" dan "BIAK" tidak jadi dua entri.
 */
export function daftarNilaiUnik<T>(rows: readonly T[], kolom: DefinisiKolomFilter<T>): DaftarNilai {
  // Kunci kanonik (huruf besar) dipakai untuk menyatukan "BIAK"/"biak" dan untuk
  // MENGURUTKAN, sementara yang ditampilkan tetap tulisan pertama seperti di data —
  // sama seperti Excel. Tanpa ini, nilai berhuruf kecil jatuh ke belakang daftar.
  const unik = new Map<string, string>();
  for (const r of rows) {
    const mentah = kolom.nilai(r);
    const teks = teksSel(mentah) || KOSONG;
    const kanonik = kolom.jenis === 'angka' ? teks : kunciTeks(mentah) || KOSONG;
    if (!unik.has(kanonik)) unik.set(kanonik, teks);
  }
  const semua = [...unik.entries()]
    .sort((a, b) => {
      if (a[0] === KOSONG) return 1;
      if (b[0] === KOSONG) return -1;
      if (kolom.jenis === 'angka') {
        const x = angkaSel(a[0]);
        const y = angkaSel(b[0]);
        if (!Number.isNaN(x) && !Number.isNaN(y) && x !== y) return x - y;
      }
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    })
    .map(([, teks]) => teks);
  return { semua, totalUnik: semua.length };
}

/** Cari di dalam daftar nilai — dipakai kotak cari popover, memotong ke `batas`. */
export function cariDalamNilai(nilai: readonly string[], teks: string, batas = BATAS_DAFTAR_NILAI): string[] {
  const q = teks.trim().toUpperCase();
  if (!q) return nilai.slice(0, batas);
  const out: string[] = [];
  for (const n of nilai) {
    if (n.toUpperCase().includes(q)) {
      out.push(n);
      if (out.length >= batas) break;
    }
  }
  return out;
}

/**
 * Predikat filter. `terpilih` berisi persis nilai yang ditampilkan `daftarNilaiUnik`.
 * Set kosong / tidak ada = kolom tidak menyaring apa pun.
 */
export function barisLolosFilter<T>(row: T, kolom: DefinisiKolomFilter<T>, terpilih: ReadonlySet<string>): boolean {
  const mentah = kolom.nilai(row);
  const teks = teksSel(mentah) || KOSONG;
  const kanonik = kolom.jenis === 'angka' ? teks : kunciTeks(mentah) || KOSONG;
  if (terpilih.has(teks)) return true;
  // Nilai yang dipilih lewat daftar huruf-besar harus tetap cocok dengan baris
  // yang menyimpannya dalam huruf kecil.
  return terpilih.has(kanonik);
}

/**
 * Sortir banyak kolom sekaligus. Kunci banding dihitung SEKALI per baris (bukan per
 * perbandingan): `localeCompare` atas 83 ribu baris itu ~1,3 juta pemanggilan dan
 * terasa di layar, sedangkan kunci yang sudah dinaikkan hurufnya cukup `<` biasa.
 */
export function sortirBaris<T>(rows: readonly T[], kolom: DefinisiKolomFilter<T> | undefined, naik: boolean): T[] {
  if (!kolom) return [...rows];
  const angka = kolom.jenis === 'angka';
  const berpas = rows.map((r, i) => {
    const mentah = kolom.nilai(r);
    const kunci = angka ? angkaSel(mentah) : kunciTeks(mentah);
    return { r, i, kunci, kosong: angka ? Number.isNaN(kunci as number) : kunci === '' };
  });
  berpas.sort((a, b) => {
    // Nilai kosong paling akhir, dua-dua arah (sama seperti Excel).
    if (a.kosong !== b.kosong) return a.kosong ? 1 : -1;
    let cmp = 0;
    if (angka) cmp = (a.kunci as number) - (b.kunci as number);
    else cmp = a.kunci < b.kunci ? -1 : a.kunci > b.kunci ? 1 : 0;
    if (cmp === 0) cmp = a.i - b.i; // stabil: urutan masuk tidak berubah
    return naik ? cmp : -cmp;
  });
  return berpas.map((b) => b.r);
}

export interface KeadaanUrut { kolom: string; naik: boolean }
export type KeadaanSaring = Record<string, string[]>;

/** Saring saja, TANPA mengubah urutan masuk — inilah yang dipakai ekspor. */
export function saringBaris<T>(rows: readonly T[], definisi: readonly DefinisiKolomFilter<T>[], saring: KeadaanSaring): T[] {
  const aktif = definisi.filter((k) => saring[k.kunci] && saring[k.kunci].length > 0);
  if (aktif.length === 0) return [...rows];
  const pasangan = aktif.map((k) => ({ k, s: new Set(saring[k.kunci]) }));
  return rows.filter((r) => pasangan.every(({ k, s }) => barisLolosFilter(r, k, s)));
}

/** Terapkan keadaan sort + filter ke sekumpulan baris. */
export function terapkanKeadaan<T>(
  rows: readonly T[],
  definisi: readonly DefinisiKolomFilter<T>[],
  urut: KeadaanUrut,
  saring: KeadaanSaring
): T[] {
  const kolomUrut = definisi.find((k) => k.kunci === urut.kolom);
  const hasil = saringBaris(rows, definisi, saring);
  return kolomUrut ? sortirBaris(hasil, kolomUrut, urut.naik) : hasil;
}

export const jumlahFilterAktif = (saring: KeadaanSaring): number =>
  Object.values(saring).filter((v) => v && v.length > 0).length;
