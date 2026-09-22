// Kunci pencocokan wilayah untuk penentuan titik peta. Murni (tanpa leaflet/React)
// supaya bisa dipakai komponen peta DAN diuji di Node.
export const normWilayah = (s: string) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();

/** Lepas "KABUPATEN " / "KOTA " — tabel kode pos memakai prefiks, data PTEN tidak. */
export const lepasPrefiks = (s: string) => normWilayah(s).replace(/^(KABUPATEN|KOTA)\s+/, '');

/**
 * Kunci cadangan bila kode pos baris tidak ada / belum bertitik di tabel kode pos.
 * Cukup KELURAHAN + KECAMATAN; KOTA dipakai sebagai pemecah lewat `kotaCocok`, karena
 * nama kota dari PTEN bisa terpotong (kolom MAX 15) dan bisa berprefiks beda.
 * Terukur di data produksi 2026-09-22: 25 dari 25 kelurahan yang gagal lewat kode pos
 * ternyata punya titik di tabel kode pos dengan nama wilayah yang sama.
 */
export const kunciKelKec = (kel: string, kec: string) => `${normWilayah(kel)}|${normWilayah(kec)}`;

/** Dua nama kota dianggap sama bila identik, atau yang satu awalan yang lain (min. 6 huruf). */
export function kotaCocok(a: string, b: string): boolean {
  const x = lepasPrefiks(a);
  const y = lepasPrefiks(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return Math.min(x.length, y.length) >= 6 && (x.startsWith(y) || y.startsWith(x));
}
