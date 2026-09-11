// String and data normalizer functions

/**
 * Standardize postal code to 5-digit string with leading zeros preserved
 */
export function normalizeKodePos(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';
  // Extract digits
  const cleanDigits = str.replace(/\D/g, '');
  if (!cleanDigits) return str;
  // Pad with leading zeros up to 5 digits if needed
  if (cleanDigits.length <= 5) {
    return cleanDigits.padStart(5, '0');
  }
  return cleanDigits.slice(0, 5);
}

/**
 * Clean and standardize general text for comparison
 */
export function cleanText(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/\\,.]+/g, ' ');
}

/**
 * Normalisasi nama Dati II / Kabupaten / Kota:
 * Menghapus prefix seperti 'kabupaten', 'kab.', 'kab', 'kota madya', 'kotamadya', 'kota', 'kodya', 'dati ii', 'dati 2', 'adm.', 'administrasi'
 * Contoh: "KABUPATEN BONDOWOSO" -> "bondowoso"
 *         "KAB. BONDOWOSO" -> "bondowoso"
 *         "BONDOWOSO" -> "bondowoso"
 *         "KOTA ADM. JAKARTA SELATAN" -> "jakarta selatan"
 */
export function cleanDati(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = cleanText(val);
  if (!s) return '';

  s = s
    .replace(/\b(dati\s*2|dati\s*ii|dati)\b/gi, '')
    .replace(/\b(kota\s*madya|kotamadya|kodya)\b/gi, '')
    .replace(/\b(kabupaten|kab)\b/gi, '')
    .replace(/\b(kota)\b/gi, '')
    .replace(/\b(adm|administrasi)\b/gi, '')
    .replace(/[\s\-_/\\,.]+/g, ' ')
    .trim();

  return s;
}

/**
 * Normalisasi nama Kecamatan:
 * Menghapus prefix 'kecamatan', 'kec.', 'kec', 'distrik'
 */
export function cleanKecamatan(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = cleanText(val);
  if (!s) return '';

  s = s
    .replace(/\b(kecamatan|kec|distrik)\b/gi, '')
    .replace(/[\s\-_/\\,.]+/g, ' ')
    .trim();

  return s;
}

/**
 * Normalisasi nama Kelurahan / Desa:
 * Menghapus prefix 'kelurahan', 'kel.', 'kel', 'desa', 'ds.', 'ds', 'kampung', 'nagari'
 */
export function cleanKelurahan(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = cleanText(val);
  if (!s) return '';

  s = s
    .replace(/\b(kelurahan|kel|desa|ds|kampung|nagari)\b/gi, '')
    .replace(/[\s\-_/\\,.]+/g, ' ')
    .trim();

  return s;
}

/**
 * Normalisasi nama Provinsi:
 * Menghapus prefix 'provinsi', 'prov.', 'prov', 'daerah istimewa', 'd.i.', 'di', 'dki'
 */
export function cleanProvinsi(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = cleanText(val);
  if (!s) return '';

  s = s
    .replace(/\b(provinsi|prov|daerah\s*istimewa|d\.?i\.?|dki)\b/gi, '')
    .replace(/[\s\-_/\\,.]+/g, ' ')
    .trim();

  return s;
}

/**
 * Compute similarity score between two Indonesian administrative texts (0.0 to 1.0)
 * Uses exact match, administrative normalization (Dati II, Kec, Kel, Prov), token overlap, and substring inclusion
 */
export function textSimilarityScore(a: string, b: string): number {
  const s1 = cleanText(a);
  const s2 = cleanText(b);

  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  // Cek normalisasi Dati II (contoh: "KABUPATEN BONDOWOSO" vs "BONDOWOSO" -> 1.0)
  const d1 = cleanDati(s1);
  const d2 = cleanDati(s2);
  if (d1 && d2 && d1 === d2) return 1.0;

  // Cek normalisasi Kecamatan
  const kec1 = cleanKecamatan(s1);
  const kec2 = cleanKecamatan(s2);
  if (kec1 && kec2 && kec1 === kec2) return 1.0;

  // Cek normalisasi Kelurahan
  const kel1 = cleanKelurahan(s1);
  const kel2 = cleanKelurahan(s2);
  if (kel1 && kel2 && kel1 === kel2) return 1.0;

  // Cek normalisasi Provinsi
  const p1 = cleanProvinsi(s1);
  const p2 = cleanProvinsi(s2);
  if (p1 && p2 && p1 === p2) return 1.0;

  // Substring inclusion bonus
  if (s1.includes(s2) || s2.includes(s1) || (d1 && d2 && (d1.includes(d2) || d2.includes(d1)))) {
    const minLen = Math.min(d1.length || s1.length, d2.length || s2.length);
    const maxLen = Math.max(d1.length || s1.length, d2.length || s2.length);
    return 0.85 + 0.15 * (minLen / Math.max(1, maxLen));
  }

  // Token overlap (e.g. "Kec. Kebayoran Baru" vs "Kebayoran Baru")
  const stopWords = new Set(['kabupaten', 'kab', 'kota', 'kecamatan', 'kec', 'kelurahan', 'kel', 'desa', 'ds', 'provinsi', 'prov']);
  const tokens1 = new Set(s1.split(' ').filter(t => t.length > 2 && !stopWords.has(t)));
  const tokens2 = new Set(s2.split(' ').filter(t => t.length > 2 && !stopWords.has(t)));

  if (tokens1.size === 0 || tokens2.size === 0) {
    const rawTokens1 = new Set(s1.split(' ').filter(t => t.length > 2));
    const rawTokens2 = new Set(s2.split(' ').filter(t => t.length > 2));
    if (rawTokens1.size === 0 || rawTokens2.size === 0) return 0;
    let m = 0;
    for (const t of rawTokens1) if (rawTokens2.has(t)) m++;
    return m / new Set([...rawTokens1, ...rawTokens2]).size;
  }

  let matches = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) matches++;
  }

  const unionSize = new Set([...tokens1, ...tokens2]).size;
  return matches / unionSize;
}

/**
 * Standardize Wilayah display label so numeric values like "1" or "8" display as "Wilayah 1", "Wilayah 8"
 */
export function formatWilayahName(val: unknown): string {
  if (val === null || val === undefined) return 'Tanpa Wilayah';
  const str = String(val).trim();
  if (!str || str === '-' || str === '0') return 'Tanpa Wilayah';

  // Jika sudah memiliki awalan "Wilayah" (case-insensitive)
  if (/^wilayah\b/i.test(str)) {
    return str.replace(/^wilayah/i, 'Wilayah');
  }

  // Jika awalan "Region"
  if (/^region\b/i.test(str)) {
    return str;
  }

  // Tambahkan prefix "Wilayah" (misal: "1" -> "Wilayah 1", "8" -> "Wilayah 8")
  return `Wilayah ${str}`;
}

import type { WilayahSetting } from '../types';

/**
 * Extract 2nd and 3rd digit from Branch Code and resolve to Wilayah from settings
 * Example: "60115601" -> digit 2 & 3 is "01" -> matches setting { kodeWilayah: "01", keterangan: "Wilayah 1" }
 */
export function extractWilayahFromBranchCode(
  branchCode: unknown,
  settings: WilayahSetting[] = [],
  fallback = '-'
): { branchCode: string; kodeWilayah: string; wilayahName: string; isMatched: boolean } {
  const bc = String(branchCode || '').trim();
  if (!bc) {
    return { branchCode: '', kodeWilayah: '', wilayahName: fallback, isMatched: false };
  }

  if (bc.length >= 3) {
    const code = bc.substring(1, 3);
    const rule = settings.find(
      (s) => s.kodeWilayah.trim().toUpperCase() === code.toUpperCase()
    );
    if (rule && rule.keterangan) {
      return {
        branchCode: bc,
        kodeWilayah: rule.kodeWilayah,
        wilayahName: rule.keterangan,
        isMatched: true,
      };
    }
    return {
      branchCode: bc,
      kodeWilayah: code,
      wilayahName: fallback !== '-' ? fallback : `Wilayah ${code}`,
      isMatched: false,
    };
  }

  return { branchCode: bc, kodeWilayah: '', wilayahName: fallback, isMatched: false };
}

