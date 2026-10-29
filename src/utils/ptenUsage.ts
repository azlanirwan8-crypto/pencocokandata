/**
 * Status Pakai sebuah baris Master PTEN — BUKAN kolom yang disimpan, melainkan
 * diturunkan dari Data Final: kode pos PTEN yang muncul di sana sudah dipakai oleh
 * hasil analisa yang selesai, yang tidak muncul belum.
 *
 * Kuncinya kode pos PTEN, bukan nomor urut atau indeks baris: satu baris PTEN
 * (blok kode pos di satu kota) bisa melahirkan banyak baris Data Final, dan Fase 1
 * menyalin kode pos baris PTEN itu apa adanya ke `kodePosPten` hasil analisa.
 */

import { STATUS_BELUM_PAKAI, STATUS_PAKAI } from './cabangUsage';

export { STATUS_PAKAI, STATUS_BELUM_PAKAI };

/** Dibedakan dari kolom "Status" PTEN (AKTIF/NON-AKTIF) yang dibaca dari Excel. */
export const KOLOM_STATUS_PAKAI_PTEN = 'Status Pakai';

type Sumber = { kodePosPten?: unknown };

/** Kode pos 5 digit: buang selain angka dan ambil lima digit pertama. */
export function normKodePosPten(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '').slice(0, 5);
}

/** Kumpulan kode pos PTEN yang tersentuh Data Final. */
export function indeksKodePosPtenTerpakai(finalRows: readonly Sumber[]): Set<string> {
  const indeks = new Set<string>();
  for (const r of finalRows) {
    const k = normKodePosPten(r?.kodePosPten);
    if (k) indeks.add(k);
  }
  return indeks;
}

export function adalahPtenTerpakai(r: Sumber | null | undefined, indeks: ReadonlySet<string>): boolean {
  const k = normKodePosPten(r?.kodePosPten);
  return Boolean(k) && indeks.has(k);
}

export function statusPakaiPten(r: Sumber, indeks: ReadonlySet<string>): string {
  return adalahPtenTerpakai(r, indeks) ? STATUS_PAKAI : STATUS_BELUM_PAKAI;
}

/**
 * Satu sumber angka untuk sel, penghitung, dan ekspor: baris master mana yang
 * terpakai, dinilai sekali per objek.
 */
export function himpunPtenTerpakai<T extends Sumber>(rows: readonly T[], indeks: ReadonlySet<string>): Set<T> {
  const terpakai = new Set<T>();
  if (indeks.size === 0 || rows.length === 0) return terpakai;
  for (const r of rows) {
    if (adalahPtenTerpakai(r, indeks)) terpakai.add(r);
  }
  return terpakai;
}
