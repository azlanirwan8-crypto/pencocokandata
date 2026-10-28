/**
 * Status Pakai sebuah cabang Data Cabang — BUKAN kolom yang disimpan, melainkan
 * diturunkan dari Data Final: cabang yang namanya muncul di sana sudah dipakai
 * oleh hasil analisa, yang tidak muncul belum.
 *
 * Kuncinya identitas cabang, bukan nomor urut maupun indeks baris. `sourceRowIndex`
 * pada hasil analisa tidak bisa dipakai di sini — ia indeks ke `itemsToProcess`
 * (daftar proxy per kota PTEN), bukan ke `masterRows`.
 */

/** Judul kolomnya dibedakan dari nilai selnya: kolom "Status" yang sudah ada
 *  menampilkan Status Outlet (Aktif/Nonaktif), jadi kolom baru ini tidak boleh
 *  memakai judul yang sama. */
export const KOLOM_STATUS_PAKAI = 'Status Pakai';
export const STATUS_PAKAI = 'Digunakan';
export const STATUS_BELUM_PAKAI = 'Belum digunakan';

type Sumber = object;
type SelMentah = Record<string, unknown>;

const teks = (r: SelMentah, keys: string[]): string => {
  for (const k of keys) {
    const v = String(r[k] ?? '').trim();
    if (v) return v;
  }
  return '';
};

const rapat = (v: string): string => v.toUpperCase().replace(/\s+/g, ' ');

const kodeValid = (v: string): boolean => !!v && v !== '-' && v !== '0';

/**
 * Kunci identitas yang sama dihasilkan baris Master Cabang dan baris hasil analisa,
 * karena Fase 2 menyalin keempat kolom itu apa adanya ke `branchCode` / `kodeCabang`
 * / `namaOutlet` / `alamat` (lihat `paketFase2DariMaster`). Rantai fallback-nya
 * sengaja dibuat identik dengan rantai penyalinan itu.
 */
export function kunciIdentitasCabang(r: Sumber | null | undefined): string[] {
  if (!r) return [];
  const s = r as SelMentah;
  const branchCode = rapat(teks(s, ['Branch Code', 'branchCode', 'Kode Cabang', 'kodeCabang']));
  const kodeCabang = rapat(teks(s, ['Kode Cabang', 'kodeCabang']));
  const outlet = rapat(teks(s, ['Nama Outlet', 'namaOutlet', 'Cabang', 'cabang', 'Sandi Cabang', 'sandiCabang']));
  const alamat = rapat(teks(s, ['ALAMAT', 'alamat']));

  const kunci: string[] = [];
  if (kodeValid(branchCode)) kunci.push(`bc:${branchCode}`);
  if (kodeValid(kodeCabang)) {
    const k = `bc:${kodeCabang}`;
    if (!kunci.includes(k)) kunci.push(k);
  }
  if (outlet && alamat) kunci.push(`oa:${outlet}|${alamat}`);
  return kunci;
}

/** Kumpulan kunci identitas semua cabang yang tersentuh Data Final. */
export function indeksCabangTerpakai<T extends Sumber>(finalRows: readonly T[]): Set<string> {
  const indeks = new Set<string>();
  for (const r of finalRows) {
    for (const k of kunciIdentitasCabang(r)) indeks.add(k);
  }
  return indeks;
}

export function adalahCabangTerpakai(r: Sumber, indeks: ReadonlySet<string>): boolean {
  if (indeks.size === 0) return false;
  for (const k of kunciIdentitasCabang(r)) {
    if (indeks.has(k)) return true;
  }
  return false;
}

export function statusPakaiCabang(r: Sumber, indeks: ReadonlySet<string>): string {
  return adalahCabangTerpakai(r, indeks) ? STATUS_PAKAI : STATUS_BELUM_PAKAI;
}

/**
 * Satu sumber angka untuk badge tabel, penghitung, dan saringan: baris master mana
 * yang terpakai, dinilai sekali per objek.
 */
export function himpunCabangTerpakai<T extends Sumber>(rows: readonly T[], indeks: ReadonlySet<string>): Set<T> {
  const terpakai = new Set<T>();
  if (indeks.size === 0 || rows.length === 0) return terpakai;
  for (const r of rows) {
    if (adalahCabangTerpakai(r, indeks)) terpakai.add(r);
  }
  return terpakai;
}
