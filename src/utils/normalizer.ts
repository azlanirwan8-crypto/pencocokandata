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
 * Removes brackets, quotes, punctuation, and extra whitespace
 */
export function cleanText(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[\(\)\[\]\{\}'"`:;*#~]+/g, ' ')
    .replace(/[\s\-_/\\,.]+/g, ' ')
    .trim();
}

/**
 * Daftar kata arah mata angin/wilayah geografis di Indonesia
 * Digunakan untuk mencegah kesalahan pencocokan (misal: "Jakarta Selatan" tertukar dengan "Jakarta Barat",
 * atau "Bandung" tertukar dengan "Bandung Barat")
 */
export const DIRECTIONAL_WORDS = [
  'utara',
  'selatan',
  'barat',
  'timur',
  'pusat',
  'tengah',
  'tenggara',
  'daya',
  'hulu',
  'hilir',
  'kepulauan',
  'daratan',
];

/**
 * Cek apakah dua nama wilayah memiliki benturan arah/wilayah (satu memiliki arah, yang lain tidak, atau arah berbeda)
 */
export function hasDirectionalConflict(a: string, b: string): boolean {
  const normA = cleanText(a);
  const normB = cleanText(b);
  if (!normA || !normB) return false;

  const wordsA = new Set(normA.split(' '));
  const wordsB = new Set(normB.split(' '));

  for (const dir of DIRECTIONAL_WORDS) {
    const hasA = wordsA.has(dir);
    const hasB = wordsB.has(dir);
    if (hasA !== hasB) return true;
  }
  return false;
}

/**
 * Kamus Alias Resmi & Singkatan Umum Dati II (Kota/Kabupaten) di Indonesia
 */
const KNOWN_DATI_ALIASES: Record<string, string> = {
  // DKI Jakarta
  'jaksel': 'jakarta selatan',
  'jakbar': 'jakarta barat',
  'jakpus': 'jakarta pusat',
  'jaktim': 'jakarta timur',
  'jakut': 'jakarta utara',
  'kep seribu': 'kepulauan seribu',
  'kepulauan seribu': 'kepulauan seribu',

  // Banten
  'tangsel': 'tangerang selatan',

  // DIY & Yogyakarta
  'jogja': 'yogyakarta',
  'jogjakarta': 'yogyakarta',
  'yogya': 'yogyakarta',
  'diy': 'yogyakarta',

  // Variasi spasi / penggabungan nama kota/kabupaten resmi
  'gunung kidul': 'gunungkidul',
  'pematang siantar': 'pematangsiantar',
  'siantar': 'pematangsiantar',
  'lubuk linggau': 'lubuklinggau',
  'padang sidempuan': 'padangsidimpuan',
  'padang sidimpuan': 'padangsidimpuan',
  'tulang bawang': 'tulangbawang',
  'tulang bawang barat': 'tulangbawang barat',
  'sawahlunto': 'sawahlunto',
  'sawah lunto': 'sawahlunto',
  'tanjung pinang': 'tanjungpinang',
  'pangkal pinang': 'pangkalpinang',
  'banda aceh': 'banda aceh',
  'pekan baru': 'pekanbaru',
  'kota baru': 'kotabaru',
  'kota mobagu': 'kotamobagu',
  'kuala tungkal': 'kualatungkal',
  'muara enim': 'muaraenim',
  'batam': 'batam',
  'pulau batam': 'batam',
  'bolaang mongondow': 'bolaang mongondow',
  'bolmong': 'bolaang mongondow',
};

/**
 * Kamus Alias Resmi & Singkatan Umum Provinsi di Indonesia
 */
const KNOWN_PROV_ALIASES: Record<string, string> = {
  'dki jakarta': 'dki jakarta',
  'jakarta': 'dki jakarta',
  'di yogyakarta': 'di yogyakarta',
  'd.i. yogyakarta': 'di yogyakarta',
  'yogyakarta': 'di yogyakarta',
  'jogja': 'di yogyakarta',
  'jogjakarta': 'di yogyakarta',
  'diy': 'di yogyakarta',
  'jabar': 'jawa barat',
  'jateng': 'jawa tengah',
  'jatim': 'jawa timur',
  'sumut': 'sumatera utara',
  'sumbar': 'sumatera barat',
  'sumsel': 'sumatera selatan',
  'kalbar': 'kalimantan barat',
  'kalteng': 'kalimantan tengah',
  'kalsel': 'kalimantan selatan',
  'kaltim': 'kalimantan timur',
  'kaltara': 'kalimantan utara',
  'sulsel': 'sulawesi selatan',
  'sulut': 'sulawesi utara',
  'sulteng': 'sulawesi tengah',
  'sultra': 'sulawesi tenggara',
  'sulbar': 'sulawesi barat',
  'ntb': 'nusa tenggara barat',
  'ntt': 'nusa tenggara timur',
  'kepri': 'kepulauan riau',
  'babel': 'kepulauan bangka belitung',
  'bangka belitung': 'kepulauan bangka belitung',
  'aceh': 'aceh',
  'nad': 'aceh',
  'nanggroe aceh darussalam': 'aceh',
};

/**
 * Normalisasi nama Dati II / Kabupaten / Kota secara menyeluruh:
 * - Menghapus prefix: 'kabupaten', 'kab.', 'kab', 'kb', 'kota madya', 'kotamadya', 'kota', 'kodya',
 *   'dati ii', 'dati 2', 'dt ii', 'daerah tingkat ii', 'adm.', 'administrasi', 'dki'
 * - Menjaga nama majemuk yang sah seperti 'kotabaru' atau 'kotamobagu' agar tidak terpangkas
 * - Memetakan singkatan umum (misal: 'jaksel' -> 'jakarta selatan', 'tangsel' -> 'tangerang selatan', 'jogja' -> 'yogyakarta')
 * Contoh:
 *   "KABUPATEN BONDOWOSO" -> "bondowoso"
 *   "BONDOWOSO"           -> "bondowoso"
 *   "KAB.BONDOWOSO"       -> "bondowoso"
 *   "BONDOWOSO (KAB)"     -> "bondowoso"
 *   "KOTA ADM. JAKARTA SELATAN" -> "jakarta selatan"
 *   "JAKSEL"              -> "jakarta selatan"
 */
export function cleanDati(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = cleanText(val);
  if (!s) return '';

  // 1. Lindungi nama-nama kota sah yang mengandung kata 'kota' agar tidak terpotong menjadi kata yang salah
  s = s
    .replace(/\bkota\s+baru\b/gi, 'kotabaru')
    .replace(/\bkota\s+mobagu\b/gi, 'kotamobagu')
    .replace(/\bkota\s+gede\b/gi, 'kotagede')
    .replace(/\bkota\s+bumi\b/gi, 'kotabumi')
    .replace(/\bkep\b/gi, 'kepulauan');

  // 2. Hapus seluruh variasi prefiks administratif Dati II di Indonesia
  s = s
    .replace(/\b(daerah\s+khusus\s+ibukota|dki)\b/gi, '')
    .replace(/\b(daerah\s+istimewa|d\.?i\.?|diy)\b/gi, '')
    .replace(/\b(daerah\s+tingkat\s*(?:ii|2)|tingkat\s*(?:ii|2)|dati\s*(?:ii|2)|dati|dt\s*(?:ii|2))\b/gi, '')
    .replace(/\b(kota\s*madya|kotamadya|kodya)\b/gi, '')
    .replace(/\b(kabupaten\s+adm(?:inistrasi)?|kab\.?\s*adm(?:inistrasi)?)\b/gi, '')
    .replace(/\b(kota\s+adm(?:inistrasi)?|kota\.?\s*adm(?:inistrasi)?)\b/gi, '')
    .replace(/\b(kabupaten|kab|kb)\b/gi, '')
    .replace(/\b(kota|kot|kt)\b/gi, '')
    .replace(/\b(adm|administrasi|wilayah|wil)\b/gi, '')
    .replace(/[\s\-_/\\,.]+/g, ' ')
    .trim();

  // 3. Cek kamus alias resmi
  if (KNOWN_DATI_ALIASES[s]) {
    return KNOWN_DATI_ALIASES[s];
  }

  // Handle variasi spasi tanpa spasi (misal: "gunung kidul" vs "gunungkidul")
  const noSpace = s.replace(/\s+/g, '');
  for (const [alias, canonical] of Object.entries(KNOWN_DATI_ALIASES)) {
    if (alias.replace(/\s+/g, '') === noSpace) {
      return canonical;
    }
  }

  return s || cleanText(val);
}

/**
 * Normalisasi nama Kecamatan secara menyeluruh:
 * Menghapus prefix 'kecamatan', 'kec.', 'kec', 'kcmt', 'kc', 'distrik' (Papua), 'kapanewon' (DIY), 'kemantren' (Kota Yogya)
 */
export function cleanKecamatan(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = cleanText(val);
  if (!s) return '';

  s = s
    .replace(/\b(kecamatan|kec|kcmt|kc|distrik|kapanewon|kemantren|wilayah|wil)\b/gi, '')
    .replace(/[\s\-_/\\,.]+/g, ' ')
    .trim();

  return s || cleanText(val);
}

/**
 * Normalisasi nama Kelurahan / Desa secara menyeluruh:
 * Menghapus prefix 'kelurahan', 'kel.', 'kel', 'kl', 'desa', 'ds.', 'ds', 'dusun', 'kampung', 'kp.', 'kp',
 * 'nagari' (Sumbar), 'gampong' (Aceh), 'pekon' (Lampung), 'lembang' (Toraja)
 */
export function cleanKelurahan(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = cleanText(val);
  if (!s) return '';

  s = s
    .replace(/\b(kelurahan\s*\/?\s*desa|desa\s*\/?\s*kelurahan)\b/gi, '')
    .replace(/\b(kelurahan|kel|kl|desa|ds|dusun|dus|kampung|kpg|kp|nagari|gampong|pekon|lembang)\b/gi, '')
    .replace(/[\s\-_/\\,.]+/g, ' ')
    .trim();

  return s || cleanText(val);
}

/**
 * Normalisasi nama Provinsi secara menyeluruh:
 * Menghapus prefix 'provinsi', 'prov.', 'prov', 'propinsi', 'prop', 'daerah istimewa', 'd.i.', 'di', 'dki'
 * dan menyelesaikan singkatan provinsi umum (jabar, jateng, jatim, sumut, dll.)
 */
export function cleanProvinsi(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = cleanText(val);
  if (!s) return '';

  if (KNOWN_PROV_ALIASES[s]) {
    return KNOWN_PROV_ALIASES[s];
  }

  s = s
    .replace(/\b(provinsi|prov|prv|propinsi|prop)\b/gi, '')
    .replace(/\b(daerah\s+khusus\s+ibukota|dki)\b/gi, '')
    .replace(/\b(daerah\s+istimewa|d\.?i\.?|diy)\b/gi, '')
    .replace(/[\s\-_/\\,.]+/g, ' ')
    .trim();

  if (KNOWN_PROV_ALIASES[s]) {
    return KNOWN_PROV_ALIASES[s];
  }

  return s || cleanText(val);
}

/**
 * Hitung jarak Levenshtein antara dua teks (jumlah edit minimum untuk transformasi)
 * Sangat efisien (< 0.001ms) untuk menangani saltik/typo 1-2 karakter pada nama wilayah
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const row = Array.from({ length: s2.length + 1 }, (_, i) => i);

  for (let i = 0; i < s1.length; i++) {
    let prev = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      const val = Math.min(
        row[j + 1] + 1, // deletion
        prev + 1,       // insertion
        row[j] + cost   // substitution
      );
      row[j] = prev;
      prev = val;
    }
    row[s2.length] = prev;
  }

  return row[s2.length];
}

/**
 * Normalisasi angka Romawi dan sebutan angka ke digit numerik standar
 * Contoh: "I" / "SATU" -> "1", "II" / "DUA" -> "2"
 */
export function normalizeNumerals(text: string): string {
  return text
    .replace(/\b(x|sepuluh)\b/gi, '10')
    .replace(/\b(ix|sembilan)\b/gi, '9')
    .replace(/\b(viii|delapan)\b/gi, '8')
    .replace(/\b(vii|tujuh)\b/gi, '7')
    .replace(/\b(vi|enam)\b/gi, '6')
    .replace(/\b(v|lima)\b/gi, '5')
    .replace(/\b(iv|empat)\b/gi, '4')
    .replace(/\b(iii|tiga)\b/gi, '3')
    .replace(/\b(ii|dua)\b/gi, '2')
    .replace(/\b(i|satu)\b/gi, '1');
}

/**
 * Bersihkan seluruh stopword/prefiks administratif (Kabupaten, Kota, Kecamatan, Kelurahan, Desa, Dati II, Provinsi)
 * dari sebuah kalimat/frasa agar menyisakan substansi murni nama daerahnya saja.
 * Contoh:
 *   "KABUPATEN BONDOWOSO" -> "bondowoso"
 *   "KECAMATAN SUKAJADI"  -> "sukajadi"
 *   "DESA CIBOGO"         -> "cibogo"
 *   "KOTA ADM. JAKARTA PUSAT" -> "jakarta pusat"
 */
export function stripAdminNoise(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = cleanText(val);
  if (!s) return '';

  // 1. Lindungi nama-nama majemuk sah di Indonesia
  s = s
    .replace(/\bkota\s+baru\b/gi, 'kotabaru')
    .replace(/\bkota\s+mobagu\b/gi, 'kotamobagu')
    .replace(/\bkota\s+gede\b/gi, 'kotagede')
    .replace(/\bkota\s+bumi\b/gi, 'kotabumi')
    .replace(/\bkep\b/gi, 'kepulauan');

  // 2. Hapus seluruh variasi label administratif
  s = s
    .replace(/\b(daerah\s+khusus\s+ibukota|dki)\b/gi, '')
    .replace(/\b(daerah\s+istimewa|d\.?i\.?|diy)\b/gi, '')
    .replace(/\b(daerah\s+tingkat\s*(?:ii|2)|tingkat\s*(?:ii|2)|dati\s*(?:ii|2)|dati|dt\s*(?:ii|2))\b/gi, '')
    .replace(/\b(kota\s*madya|kotamadya|kodya)\b/gi, '')
    .replace(/\b(kabupaten\s+adm(?:inistrasi)?|kab\.?\s*adm(?:inistrasi)?)\b/gi, '')
    .replace(/\b(kota\s+adm(?:inistrasi)?|kota\.?\s*adm(?:inistrasi)?)\b/gi, '')
    .replace(/\b(kabupaten|kab|kb)\b/gi, '')
    .replace(/\b(kota|kot|kt)\b/gi, '')
    .replace(/\b(kecamatan|kec|kcmt|kc|distrik|kapanewon|kemantren)\b/gi, '')
    .replace(/\b(kelurahan\s*\/?\s*desa|desa\s*\/?\s*kelurahan)\b/gi, '')
    .replace(/\b(kelurahan|kel|kl|desa|ds|dusun|dus|kampung|kpg|kp|nagari|gampong|pekon|lembang)\b/gi, '')
    .replace(/\b(provinsi|prov|prv|propinsi|prop)\b/gi, '')
    .replace(/\b(adm|administrasi|wilayah|wil)\b/gi, '')
    .replace(/[\s\-_/\\,.]+/g, ' ')
    .trim();

  // 3. Normalisasi angka
  s = normalizeNumerals(s);

  return s;
}

/**
 * Analisis Kemiripan Kalimat & Frasa Wilayah (0.0 sampai 1.0)
 * Menjawab instruksi: "jangan karena di data nya ada kab terus beda, analisa dulu kalimat nya mirip ngak nya"
 * Tahapan evaluasi:
 * 1. Pembersihan total kata penanda administratif (kabupaten/kota/kec/kel/desa/prov)
 * 2. Pencocokan substansi murni nama (Core Name Exact Match -> 1.0)
 * 3. Pencocokan spasi rapat (contoh: "pondok gede" vs "pondokgede" -> 1.0)
 * 4. Normalisasi angka (contoh: "sukasari i" vs "sukasari 1" -> 1.0)
 * 5. Toleransi saltik/typo 1 huruf (Levenshtein Distance -> 0.95)
 * 6. Analisis penyerapan frasa / token containment (contoh: "cibadak sukabumi" vs "cibadak" -> 0.92)
 * 7. Proteksi benturan arah mata angin (misal: "Bandung" vs "Bandung Barat" dibatasi maks 0.40)
 */
export function textSimilarityScore(a: string, b: string): number {
  const s1 = cleanText(a);
  const s2 = cleanText(b);

  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  // Analisa substansi kalimat inti (Core Name) setelah membuang kata penanda administratif
  const core1 = stripAdminNoise(s1);
  const core2 = stripAdminNoise(s2);

  // Jika nama intinya sama persis (misal: "KABUPATEN BONDOWOSO" vs "BONDOWOSO", "KEC. SUKAJADI" vs "SUKAJADI")
  if (core1 && core2 && core1 === core2) {
    if (!hasDirectionalConflict(core1, core2)) {
      return 1.0;
    }
  }

  // Jika nama intinya sama persis setelah mengabaikan spasi (misal: "PONDOK GEDE" vs "PONDOKGEDE", "KARANG ANYAR" vs "KARANGANYAR")
  const coreNoSpace1 = core1.replace(/\s+/g, '');
  const coreNoSpace2 = core2.replace(/\s+/g, '');
  if (coreNoSpace1 && coreNoSpace2 && coreNoSpace1 === coreNoSpace2) {
    if (!hasDirectionalConflict(core1, core2)) {
      return 1.0;
    }
  }

  // Cek kamus alias khusus Dati II (misal: "JAKSEL" vs "JAKARTA SELATAN", "TANGSEL" vs "TANGERANG SELATAN")
  const d1 = cleanDati(s1);
  const d2 = cleanDati(s2);
  if (d1 && d2 && d1 === d2) return 1.0;

  // Cek normalisasi Kecamatan khusus
  const kec1 = cleanKecamatan(s1);
  const kec2 = cleanKecamatan(s2);
  if (kec1 && kec2 && (kec1 === kec2 || kec1.replace(/\s+/g, '') === kec2.replace(/\s+/g, ''))) return 1.0;

  // Cek normalisasi Kelurahan khusus
  const kel1 = cleanKelurahan(s1);
  const kel2 = cleanKelurahan(s2);
  if (kel1 && kel2 && (kel1 === kel2 || kel1.replace(/\s+/g, '') === kel2.replace(/\s+/g, ''))) return 1.0;

  // Cek normalisasi Provinsi khusus
  const p1 = cleanProvinsi(s1);
  const p2 = cleanProvinsi(s2);
  if (p1 && p2 && p1 === p2) return 1.0;

  // Proteksi benturan arah mata angin (misal "bandung" vs "bandung barat", atau "jakarta selatan" vs "jakarta timur")
  if (hasDirectionalConflict(core1 || d1 || s1, core2 || d2 || s2)) {
    return 0.40;
  }

  // Analisis toleransi typo/saltik 1 karakter pada nama inti panjang (Levenshtein Distance)
  const maxCoreLen = Math.max(core1.length, core2.length);
  if (core1 && core2 && maxCoreLen >= 5) {
    const editDist = levenshteinDistance(core1, core2);
    if (editDist === 1) {
      return 0.95; // 95% Cocok Sempurna untuk typo 1 huruf (misal "BONDOWOSOO" vs "BONDOWOSO")
    }
    if (editDist === 2 && maxCoreLen >= 8) {
      return 0.90; // 90% Cocok untuk typo 2 huruf pada kata panjang
    }
  }

  // Analisis penyerapan frasa kalimat (contoh: "KEC. CIBADAK, SUKABUMI" vs "CIBADAK")
  if (core1 && core2 && (core1.includes(core2) || core2.includes(core1))) {
    const minLen = Math.min(core1.length, core2.length);
    const maxLen = Math.max(core1.length, core2.length);
    return Math.min(0.88 + 0.12 * (minLen / Math.max(1, maxLen)), 0.98);
  }

  if (s1.includes(s2) || s2.includes(s1) || (d1 && d2 && (d1.includes(d2) || d2.includes(d1)))) {
    const minLen = Math.min(d1.length || s1.length, d2.length || s2.length);
    const maxLen = Math.max(d1.length || s1.length, d2.length || s2.length);
    return 0.85 + 0.15 * (minLen / Math.max(1, maxLen));
  }

  // Analisis tumpang tindih token kata bermakna (Token Overlap / Jaccard)
  const stopWords = new Set([
    'kabupaten', 'kab', 'kb', 'kota', 'kot', 'kodya', 'kotamadya',
    'kecamatan', 'kec', 'kc', 'kcmt', 'distrik',
    'kelurahan', 'kel', 'kl', 'desa', 'ds', 'kampung', 'kp', 'dusun',
    'provinsi', 'prov', 'propinsi', 'prop', 'dki', 'daerah', 'istimewa', 'tingkat', 'dati', 'adm', 'wilayah'
  ]);
  const tokens1 = new Set(s1.split(' ').filter(t => t.length > 1 && !stopWords.has(t)));
  const tokens2 = new Set(s2.split(' ').filter(t => t.length > 1 && !stopWords.has(t)));

  if (tokens1.size === 0 || tokens2.size === 0) {
    const rawTokens1 = new Set(s1.split(' ').filter(t => t.length > 1));
    const rawTokens2 = new Set(s2.split(' ').filter(t => t.length > 1));
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

/**
 * Normalisasi alamat jalan Indonesia untuk perbandingan layaknya auditor manusia:
 * Menyeragamkan variasi singkatan umum (Jl, Jln, Gg, Komp, Kav, No, Lt, Gedung, dsb)
 */
export function normalizeStreetAddress(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = cleanText(val);
  if (!s) return '';

  return s
    .replace(/\b(jalan|jln|jl|raya)\b/gi, 'jl')
    .replace(/\b(gang|gg)\b/gi, 'gang')
    .replace(/\b(komplek|kompleks|komp)\b/gi, 'komplek')
    .replace(/\b(kavling|kav)\b/gi, 'kav')
    .replace(/\b(gedung|gdg|gd)\b/gi, 'gedung')
    .replace(/\b(nomor|no)\b/gi, 'no')
    .replace(/\b(lantai|lt)\b/gi, 'lt')
    .replace(/\b(blok|blk)\b/gi, 'blok')
    .replace(/\b(pertokoan|ruko)\b/gi, 'ruko')
    .replace(/[\s\-_/\\,.]+/g, ' ')
    .trim();
}

/**
 * Ekstraksi token kata jalan/gedung/mall/landmark bermakna (panjang >= 4 karakter, non-stopword)
 */
export function extractAddressKeywords(addr: string): string[] {
  const norm = normalizeStreetAddress(addr);
  if (!norm) return [];

  const stopWords = new Set([
    'jl', 'gang', 'komplek', 'kav', 'gedung', 'no', 'lt', 'blok', 'ruko',
    'rt', 'rw', 'dati', 'kota', 'kabupaten', 'kecamatan', 'kelurahan', 'desa',
    'provinsi', 'indonesia', 'raya', 'dalam', 'barat', 'timur', 'selatan', 'utara',
    'pusat', 'dan', 'di', 'ke', 'dari', 'seberang', 'depan', 'dekat', 'nomor',
    'lantai', 'unit', 'kavling', 'jalan', 'jln'
  ]);

  return norm
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stopWords.has(w) && !/^\d+$/.test(w));
}

/**
 * Cek apakah dua alamat berbagi nama jalan utama, gedung, atau landmark yang sama
 */
export function findSharedStreetOrLandmark(
  addr1: string,
  addr2: string
): { isMatch: boolean; sharedKeyword?: string } {
  const kw1 = extractAddressKeywords(addr1);
  const kw2 = extractAddressKeywords(addr2);

  for (const w1 of kw1) {
    for (const w2 of kw2) {
      if (w1 === w2) {
        return { isMatch: true, sharedKeyword: w1 };
      }
      if (w1.length >= 5 && w2.length >= 5 && (w1.includes(w2) || w2.includes(w1))) {
        return { isMatch: true, sharedKeyword: w1 };
      }
    }
  }

  return { isMatch: false };
}

