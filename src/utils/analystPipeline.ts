import type { MasterRow, TargetRow, WilayahSetting } from '../types';
import { isAcehRegion, findKimBranch, buildMasterProximityIndex, findClosestMasterRecommendation, adalahKcFase2 } from './recommender';
import type { MasterProximityIndex } from './recommender';
import { findTopRoleMatchesByLocation } from './roleRecommender';
import { getIslandFromProvinsi } from './roleMatcher';
import { calculateRealDistance } from './geoDistance';
import type { PTENRecord } from '../components/PTENData/PTENManager';
import type { RoleMappingRecord } from '../components/RoleMapping/RoleMappingManager';
import { getUnitCategory, getWondrRecommendation } from '../components/RoleMapping/RoleMappingManager';
import { extractWilayahFromBranchCode } from './normalizer';
import type { KodePosRow } from './neonSync';

export interface AnalystRow {
  id: string;
  no: number;
  // Fase 1: PTEN & Kode Pos
  kotaPten: string;
  kodePosPten: string;
  // Kode pos milik kelurahan/kecamatan ini dari Master Kode Pos — beda dengan
  // `kodePosPten` (kode pos tingkat kota dari PTEN) pada kota dengan banyak blok.
  kodePosKelurahan: string;
  kelurahan: string;
  kecamatan: string;
  provinsi: string;
  statusPten: 'SAME' | 'DIFFERENT' | 'PTEN FOUND' | 'UNCHECKED';
  // Integritas penempatan kelurahan/kecamatan → kota/kab (divalidasi via blok kode pos)
  placementStatus: 'VERIFIED' | 'REVIEW' | 'FALLBACK';
  placementMethod: string;
  groupKota: string;
  // 'DIANALISA' = terpetakan ke kota PTEN; 'TIDAK_ANALISA' = kotanya tak ada di PTEN
  kategori: 'DIANALISA' | 'TIDAK_ANALISA';
  fase1Approved: boolean;
  // Tracking: index baris Master Cabang asal (untuk grouping Fase 1)
  sourceRowIndex: number;
  // Total kelurahan yang ada di kota PTEN ini (dari data Kode Pos)
  allKelurahanCount: number;
  // Nomor urut kelurahan dalam kelompok kota PTEN (1-based)
  kelurahanSeq: number;

  // Fase 2: Wilayah & Master Cabang
  wilayah: string;
  // 🧾 CATATAN KERAS: mulai Fase 2 dst (final & semua export) nama kota WAJIB dari
  // kolom PTEN "KOTA/KABUPATEN MAX 15 DIGIT" — nama penuh hanya dipakai di Fase 1.
  kotaPtenMax15: string;
  sandiCabang: string;
  sandi: string;
  cabang: string;
  branchCode: string;
  kodeCabang: string;
  namaOutlet: string;
  statusOutlet: string;
  alamat: string;
  fase2Approved: boolean;
  /** Peringkat jarak (km) baris INI ke cabang terpilih (model jarak administratif). */
  fase2JarakKm: number;
  /** 1 = cabang sekota, 2 = sepulau/seprovinsi, 3 = di luar provinsi target. */
  fase2Tier: 1 | 2 | 3;
  /** Alasan baris ini perlu diputuskan manual di Fase 2 (kosong = hasil mesin mantap). */
  fase2Temuan: string[];
  /**
   * M1: tiga keranjang Fase 2. `SIAP_DIPROSES` = kolom Fase 2 masih kosong karena
   * fasenya belum dijalankan — itu BUKAN temuan manual.
   */
  fase2Status?: 'OTOMATIS_VALID' | 'SIAP_DIPROSES' | 'PERLU_MANUAL';
  /** M1/M2: dari mana cabang terpasang ini datang (Rank-1 terdekat / aturan Aceh / manual). */
  fase2Sumber?: string;
  /** M5: bukti ensemble sinyal atas nama kota cabang vs nama kota PTEN (lihat SINYAL_BIT). */
  sinyalF2Bit?: number;

  // Fase 3: Mapping Role & Wondr
  organisasiTujuan: string;
  tipeUnit: 'KC' | 'KCP' | 'OUTLET';
  is3RoleLengkap: boolean;
  roleCabsal: number;
  roleCabapv1: number;
  roleCabapv2: number;
  roleGrandTotal: number;
  alurWondr: string;
  flowDescription: string;
  fase3Approved: boolean;

  // Overall Status
  confidenceScore: number; // 0 - 100%
  matchingAlgorithm: string;
  /** Bit sinyal Fase 1 (penamaan kota + hirarki/pemekaran wilayah), lihat SINYAL_BIT. */
  sinyalBit?: number;
  /** Bit sinyal Fase 3 (pasangan nama outlet ⟷ organisasi tujuan). */
  sinyalRoleBit?: number;
  /**
   * Alasan baris ini masuk daftar temuan tiap sinyal, kunci = nomor sinyal 1..13.
   * Hanya ada pada baris hasil analisa yang dijalankan setelah fitur catatan ini;
   * baris lama memang undefined sampai analisa dijalankan ulang.
   */
  temuanCatatan?: Record<number, string[]>;
  statusAnalisa: 'EXACT_MATCH' | 'HIGH_CONFIDENCE' | 'PERLU_REVIEW' | 'ANOMALI' | 'MENUNGGU';
  isFinalApproved: boolean;
  editedManually?: boolean;
  /**
   * Operator menarik baris ini ke tab "Perlu Analisa Manual" pada fase yang sedang
   * berjalan. Beda dengan `kategori: 'TIDAK_ANALISA'` (mesin memang tidak menemukan
   * kotanya): di sini datanya ada, hanya operator belum mau menyetujuinya.
   */
  perluManual?: boolean;
}

/**
 * Terjemahan awam untuk kartu Status PTEN: label pendek + alasan satu baris.
 * `placementMethod` diisi istilah teknis engine — operator tidak perlu tahu itu.
 */
export function penjelasanFase1(r: {
  statusPten?: string;
  placementMethod?: string;
  kotaPten?: string;
}): { label: string; alasan: string; nada: 'ok' | 'waspada' | 'buruk' } {
  const metode = String(r.placementMethod || '');
  const belumAda = !r.kotaPten && (r.statusPten === 'UNCHECKED' || !r.statusPten);
  if (belumAda) {
    return { label: 'KOTA BELUM ADA DI PTEN', alasan: 'nama kota ini tidak ada di daftar PTEN — isi kotanya manual', nada: 'buruk' };
  }
  const padan: Array<[RegExp, string]> = [
    [/pemekaran/i, 'kota hasil pemekaran — pakainya kota induknya'],
    [/saring blok/i, 'nama kota sama, kode pos disaring ke blok PTEN'],
    [/Join nama kota/i, 'nama kota + rentang kode pos sama dengan PTEN'],
    [/kode pos PTEN kosong/i, 'nama kota cocok, PTEN tidak menyimpan kode pos'],
    [/bukan wilayah kota ini/i, 'kode pos ini di luar rentang kota tersebut'],
    [/Konflik kode pos/i, 'kode pos ini sebenarnya milik kota lain'],
    [/KodePos persis ada di PTEN/i, 'kode pos persis ada di PTEN'],
    [/sudah diklaim kota lain/i, 'blok kode pos ini sudah dipakai kota lain'],
    [/kecamatan/i, 'blok kode pos + nama kecamatan cocok'],
    [/tunggal/i, 'hanya satu kota yang memakai blok kode pos ini'],
    [/nama tak cocok/i, 'blok kode pos dipakai beberapa kota, namanya tidak cocok'],
    [/mirip/i, 'blok kode pos dikenali, nama kota hanya mirip'],
    [/tidak ada di master kodepos/i, 'blok kode pos ini tidak ada di master kodepos'],
    [/tanpa data kodepos/i, 'tidak ada data kode pos untuk kota ini'],
  ];
  const ketemu = padan.find(([re]) => re.test(metode));
  const alasan = ketemu ? ketemu[1] : metode || 'nama kota dipakai apa adanya';
  if (r.statusPten === 'SAME') return { label: 'KODE POS SAMA', alasan, nada: 'ok' };
  if (r.statusPten === 'PTEN FOUND') return { label: 'KOTA DITEMUKAN', alasan, nada: 'ok' };
  if (r.statusPten === 'DIFFERENT') {
    return { label: 'KODE POS BEDA', alasan: `${alasan} — yang disimpan kode pos PTEN`, nada: 'waspada' };
  }
  return { label: 'PERLU DICEK', alasan, nada: 'waspada' };
}

/**
 * Kunci identitas baris Final Data — kode pos PTEN + kelurahan + kecamatan + kota.
 * Dipakai analisis inkremental (lewati yang sudah final) dan pemindahan persetujuan
 * antar-run. Kecamatan & kota ikut karena dua kota berbeda bisa punya kode pos dan
 * nama kelurahan yang sama; kalau keduanya tidak dihitung, baris kota B dianggap
 * "sudah final" dan hilang diam-diam dari hasil analisa.
 */
export function makeFinalKey(kodePosPten: string, kelurahan: string, kecamatan = '', kota = ''): string {
  const norm = (s: unknown) => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const kp = norm(kodePosPten).replace(/\D/g, '');
  return `${kp}|${norm(kelurahan)}|${norm(kecamatan)}|${norm(kota)}`;
}

/**
 * Baris salinan cloud `final_rows` yang BELUM ada di daftar lokal (G9).
 * Non-destruktif: baris lokal tidak pernah ditimpa, hanya ditambah; penyaringan pakai
 * kunci alami (makeFinalKey), bukan `id` yang berubah tiap run (G12) — kalau tidak,
 * hasil run lama dengan id berbeda akan muncul lagi sebagai baris duplikat.
 */
export function pilFinalDariCloud(lokal: AnalystRow[], cloudRows: any[]): AnalystRow[] {
  const kunci = new Set(
    (lokal || []).map((r) => makeFinalKey(r.kodePosPten, r.kelurahan, r.kecamatan, r.kotaPten))
  );
  const hasil: AnalystRow[] = [];
  for (const r of cloudRows || []) {
    if (!r || typeof r.id !== 'string' || r.kodePosPten === undefined) continue;
    const k = makeFinalKey(r.kodePosPten, r.kelurahan, r.kecamatan, r.kotaPten);
    if (kunci.has(k)) continue;
    kunci.add(k);
    hasil.push(r as AnalystRow);
  }
  return hasil;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔬 MESIN PENCOCOKAN — 12 sinyal + 2 penjaga identitas (lihat SINYAL_BIT untuk
// daftar resmi). Semua algoritmanya publik; yang khas di sini adalah susunannya:
// sinyal murah dihitung dulu, cascade memutuskan, dan dua penjaga memotong skor
// saat identifier/penanda wilayah berbeda.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bit penanda sinyal yang ikut menangkap sebuah pasangan nama. Disimpan per baris
 * sebagai dua angka kecil (`sinyalBit` bukti Fase 1, `sinyalRoleBit` bukti Fase 3)
 * supaya hemat — 46 ribu baris × 2 number, dan keduanya bisa dihitung ulang per fase.
 * Nomor bit = nomor kartu sinyal di UI Data Analyst (1..13).
 */
export const SINYAL_BIT = {
  thesaurus: 1 << 0,
  tokenAdmin: 1 << 1,
  jaccard: 1 << 2,
  jaro: 1 << 3,
  damerau: 1 << 4,
  trigram: 1 << 5,
  lcs: 1 << 6,
  gestalt: 1 << 7,
  fonetik: 1 << 8,
  containment: 1 << 9,
  geo: 1 << 10,
  initialism: 1 << 11,
  penjaga: 1 << 12,
} as const;

/**
 * Daftar resmi 13 kartu sinyal di UI Data Analyst — satu sumber kebenaran untuk
 * nama, warna, dan penjelasannya. Nomor harus urut 1..13 sesuai BIT_URUT di bawah.
 */
export const SINYAL_PENCOCOKAN: {
  no: number; emoji: string; judul: string; warna: string; deskripsi: string;
  /** Penjelasan bahasa awam untuk modal temuan: apa sinyal ini & kenapa baris masuk daftarnya. */
  penjelasan: string;
}[] = [
  { no: 1, emoji: '🔤', judul: 'Canonical Thesaurus', warna: '#405189', deskripsi: 'Standarisasi singkatan otomatis: KAB → KABUPATEN, KCP → KANTOR CABANG PEMBANTU, KCB → KANTOR CABANG, BO → BRANCH OFFICE, JABAR → JAWA BARAT.', penjelasan: 'Singkatan dibaca sebagai bentuk panjangnya: KAB dibaca KABUPATEN, KCP dibaca KANTOR CABANG PEMBANTU, BO dibaca BRANCH OFFICE. Baris masuk daftar ini karena namanya mengandung singkatan seperti itu.' },
  { no: 2, emoji: '🧹', judul: 'Pembuang Token Administratif', warna: '#405189', deskripsi: 'KOTA / KABUPATEN / KEC / KEL / DESA dibuang dari kunci, jadi "TEGALSARI" == "KEC. TEGALSARI".', penjelasan: 'Kata KOTA / KABUPATEN / KEC / KEL / DESA dibuang dulu sebelum membandingkan, karena itu gelar administrasi, bukan nama asli daerahnya. Baris masuk daftar ini karena namanya mengandung kata semacam itu.' },
  { no: 3, emoji: '🔄', judul: 'Token Set & Jaccard', warna: '#0ab39c', deskripsi: 'Anti-kata terbalik: "KOTA MEDAN BALAI KOTA" dihitung sama dengan "BALAI KOTA MEDAN".', penjelasan: 'Mengecek susunan kata: "KOTA MEDAN BALAI KOTA" dihitung sama dengan "BALAI KOTA MEDAN" walau urutannya terbalik. Baris masuk daftar ini karena kecocokannya terbukti lewat pengecek susunan kata.' },
  { no: 4, emoji: '🎯', judul: 'Jaro-Winkler', warna: '#f7b84b', deskripsi: 'Kemiripan huruf dengan bobot awalan: PEKALONAGN → PEKALONGAN, MAKASAR → MAKASSAR.', penjelasan: 'Mengecek ejaan dan menangkap salah ketik: PEKALONAGN dianggap PEKALONGAN, MAKASAR dianggap MAKASSAR. Baris masuk daftar ini karena kecocokannya terbukti lewat kemiripan ejaan.' },
  { no: 5, emoji: '✏️', judul: 'Damerau-Levenshtein (OSA)', warna: '#f7b84b', deskripsi: 'Sisipan, hapus, ganti, dan tukar huruf berdampingan dihitung sebagai satu kesalahan.', penjelasan: 'Mengecek huruf yang disisip, dihapus, diganti, atau tertukar posisinya. Baris masuk daftar ini karena kecocokannya terbukti lewat pengecek salah ketik ini.' },
  { no: 6, emoji: '📊', judul: 'Tri-gram Cosine', warna: '#6366f1', deskripsi: 'Vektor potongan tiga huruf: tahan pada nama outlet panjang dan beda spasi/tanda strip.', penjelasan: 'Mengecek potongan tiga huruf — kuat untuk nama panjang dan perbedaan spasi/tanda baca. Baris masuk daftar ini karena kecocokannya terbukti lewat pengecek ini.' },
  { no: 7, emoji: '🧬', judul: 'Longest Common Subsequence', warna: '#6366f1', deskripsi: 'Ketahanan terhadap sisipan kata alamat di tengah nama.', penjelasan: 'Mengecek urutan huruf dan tahan bila ada kata sisipan di tengah nama. Baris masuk daftar ini karena kecocokannya terbukti lewat pengecek ini.' },
  { no: 8, emoji: '🎨', judul: 'Ratcliff-Obershelp (Gestalt)', warna: '#6366f1', deskripsi: 'Kemiripan sebagaimana dinilai manusia, bukan sekadar hitung beda huruf.', penjelasan: 'Menilai kemiripan dengan cara seperti manusia menilai, bukan sekadar menghitung beda huruf. Baris masuk daftar ini karena kecocokannya terbukti lewat penilaian ini.' },
  { no: 9, emoji: '🔊', judul: 'Fonetik Indonesia', warna: '#299cdb', deskripsi: 'Ejaan lama/baru disatukan: DJ→J, TJ→C, SJ→S, CH/KH→K, OE→U, huruf kembar dilipat.', penjelasan: 'Mengenali ejaan lama & baru yang bunyinya sama: DJ dibaca J, TJ dibaca C, OE dibaca U, huruf kembar dilipat jadi satu. Baris masuk daftar ini karena namanya cocok lewat kemiripan bunyi.' },
  { no: 10, emoji: '🧱', judul: 'Token Containment', warna: '#299cdb', deskripsi: 'Nama pendek ⊆ nama panjang untuk hierarki wilayah, dengan lantai 4 huruf agar tidak asal klaim.', penjelasan: 'Nama pendek yang ada di dalam nama panjang dianggap cocok: "PALEMBANG" cocok dengan "PALEMBANG BRANCH OFFICE". Baris masuk daftar ini karena nama pendeknya termuat di dalam nama panjang.' },
  { no: 11, emoji: '🗺️', judul: 'Geo-Hierarchy & Pemekaran', warna: '#299cdb', deskripsi: 'Batas Provinsi/Dati II dikunci; induk-anak pemekaran (BANGGAI → BANGGAI KEPULAUAN) dikenali.', penjelasan: 'Pemetaan lewat peta wilayah: kota hasil pemekaran yang belum ada di data PTEN dipetakan ke kotanya yang lebih tua (induk). Baris masuk daftar ini karena pemetaannya lewat jalur wilayah.' },
  { no: 12, emoji: '🔠', judul: 'Initialism Match', warna: '#0ab39c', deskripsi: '"JP" ↔ "JAKARTA PUSAT", "KCP" ↔ "KANTOR CABANG PEMBANTU".', penjelasan: 'Singkatan resmi dibaca kepanjangannya: JP dibaca JAKARTA PUSAT. Baris masuk daftar ini karena kecocokannya lewat bentuk singkatan.' },
  { no: 13, emoji: '🛡️', judul: 'Penjaga Identitas (2 aturan)', warna: '#f06548', deskripsi: 'Angka beda → nilai dipotong 0,60 (KCP 001 ≠ KCP 002). Penanda wilayah beda → 0,70 (TANGERANG ≠ TANGERANG SELATAN).', penjelasan: 'Pengaman identitas: bila angkanya beda (KCP 001 vs KCP 002) atau penanda wilayahnya beda (TANGERANG vs TANGERANG SELATAN), pasangan yang hurufnya mirip pun nilainya dipangkas. Daftar ini justru bukti engine menolak asal tempel.' },
];

/** Nama sinyal ke-n (1-based) sesuai kartu UI. */
export const NAMA_SINYAL: Record<number, string> = Object.fromEntries(
  SINYAL_PENCOCOKAN.map((s) => [s.no, s.judul])
);

const BIT_URUT = [
  SINYAL_BIT.thesaurus, SINYAL_BIT.tokenAdmin, SINYAL_BIT.jaccard, SINYAL_BIT.jaro,
  SINYAL_BIT.damerau, SINYAL_BIT.trigram, SINYAL_BIT.lcs, SINYAL_BIT.gestalt,
  SINYAL_BIT.fonetik, SINYAL_BIT.containment, SINYAL_BIT.geo, SINYAL_BIT.initialism,
  SINYAL_BIT.penjaga,
];
export const bitUntuk = (no: number): number => BIT_URUT[no - 1] || 0;
export const hitungBit = (bitmask: number): number[] =>
  BIT_URUT.map((b, i) => ((bitmask & b) !== 0 ? i + 1 : 0)).filter(Boolean);

/**
 * E4: "bunyinya sama" bukan bukti identitas. Dua nama yang HANYA bertemu lewat
 * transkripsi fonetik — tanpa satu pun sinyal kemiripan huruf/token — tidak boleh
 * meloloskan baris ke penyetujuan otomatis.
 */
const BIT_NAMA =
  SINYAL_BIT.jaccard | SINYAL_BIT.jaro | SINYAL_BIT.damerau | SINYAL_BIT.trigram |
  SINYAL_BIT.lcs | SINYAL_BIT.gestalt | SINYAL_BIT.containment | SINYAL_BIT.initialism;
export const hanyaBuktiFonetik = (bitmask: number): boolean =>
  (bitmask & SINYAL_BIT.fonetik) !== 0 && (bitmask & BIT_NAMA) === 0;
/**
 * Semua bit yang menangkap baris ini: bukti Fase 1 (kota/wilayah) + Fase 2 (nama kota
 * cabang terpilih, M5) + Fase 3 (role). Ketiganya disimpan TERPISAH supaya bisa dihitung
 * ulang per fase; digabung hanya saat UI butuh "sinyal mana yang kena baris ini".
 */
export interface BitBuktiBaris {
  sinyalBit?: number;
  sinyalF2Bit?: number;
  sinyalRoleBit?: number;
}
export const bitTemuanBaris = (r: BitBuktiBaris): number =>
  (r.sinyalBit || 0) | (r.sinyalF2Bit || 0) | (r.sinyalRoleBit || 0);

/** Maksimal catatan per sinyal yang disimpan ke satu baris hasil. */
const CATATAN_MAX_PER_SINYAL = 3;

/** Gabung catatan temuan dari beberapa sumber (Fase 1 + Fase 3) per sinyal. */
export function gabungCatatanTemuan(
  ...daftar: Array<Record<number, string[]> | undefined>
): Record<number, string[]> | undefined {
  const hasil: Record<number, string[]> = {};
  let ada = false;
  for (const d of daftar) {
    if (!d) continue;
    for (const [k, arr] of Object.entries(d)) {
      const no = Number(k);
      if (!Number.isFinite(no) || !Array.isArray(arr)) continue;
      const tujuan = (hasil[no] = hasil[no] || []);
      for (const teks of arr) {
        if (tujuan.length >= CATATAN_MAX_PER_SINYAL) break;
        if (teks && !tujuan.includes(teks)) tujuan.push(teks);
      }
      if (tujuan.length > 0) ada = true;
    }
  }
  return ada ? hasil : undefined;
}

// 1. 🔤 CANONICAL THESAURUS (Standarisasi Singkatan & Akronim Perbankan/Wilayah)
const THESAURUS_MAP: Record<string, string> = {
  'KAB': 'KABUPATEN',
  'KAB.': 'KABUPATEN',
  'KODYA': 'KOTA',
  'KOTA ADM': 'KOTA',
  'KOTA ADM.': 'KOTA',
  'KOTA ADMINISTRASI': 'KOTA',
  'KEC': 'KECAMATAN',
  'KEC.': 'KECAMATAN',
  'KEL': 'KELURAHAN',
  'KEL.': 'KELURAHAN',
  'JL': 'JALAN',
  'JL.': 'JALAN',
  'JLN': 'JALAN',
  'JLN.': 'JALAN',
  'KC': 'KANTOR CABANG',
  'KCB': 'KANTOR CABANG',
  'KCP': 'KANTOR CABANG PEMBANTU',
  'KK': 'KANTOR KAS',
  'BO': 'BRANCH OFFICE',
  'SBO': 'SUB BRANCH OFFICE',
  'KEP': 'KEPULAUAN',
  'DKI': 'DKI JAKARTA',
  'DIY': 'DAERAH ISTIMEWA YOGYAKARTA',
  'JABAR': 'JAWA BARAT',
  'JATENG': 'JAWA TENGAH',
  'JATIM': 'JAWA TIMUR',
  'SUMUT': 'SUMATERA UTARA',
  'SUMBAR': 'SUMATERA BARAT',
  'SUMSEL': 'SUMATERA SELATAN',
  'SULSEL': 'SULAWESI SELATAN',
  'SULUT': 'SULAWESI UTARA',
};

export function cleanAndStandardizeText(str: string): string {
  if (!str) return '';
  let cleaned = str
    .toUpperCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ');
  const replaced = words.map((w) => THESAURUS_MAP[w] || w);
  return replaced.join(' ');
}

// Kunci pencocokan KOTA/KABUPATEN: buang kata administratif (KOTA, KABUPATEN,
// ADMINISTRASI, DAERAH KHUSUS, dst) supaya "JAKARTA PUSAT" == "KOTA ADMINISTRASI
// JAKARTA PUSAT" dan "SLEMAN" == "KABUPATEN SLEMAN".
const ADMIN_NOISE_TOKENS = new Set([
  'KOTA', 'KABUPATEN', 'KAB', 'KODYA', 'KOTAMADYA', 'ADMINISTRASI', 'ADM', 'DAERAH', 'KHUSUS', 'I',
  'KECAMATAN', 'KEC', 'KELURAHAN', 'KEL', 'DESA', 'DUSUN', 'DUKUH',
  // 'PROVINSI'/'PROV' cuma gelar administrasi; tanpanya "PROV KALIMANTAN TIMUR"
  // gagal dikenali sebagai "KALIMANTAN TIMUR" (terukur di tests/uji-akurasi-nama.mjs).
  'PROV', 'PROVINSI',
]);
// Normalisasi pakar: canonical + buang token administratif. Dipakai SEMUA mesin
// similarity (kota, kabupaten, kecamatan, kelurahan, provinsi, alamat, organisasi).
export function expertNormalize(raw: string): string {
  return cleanAndStandardizeText(raw)
    .split(' ')
    .filter((w) => w && !ADMIN_NOISE_TOKENS.has(w))
    .join(' ');
}
/** Pasangan [singkatan, bentuk baku] yang benar-benar muncul di teks ini (bukti temuan). */
function pasanganThesaurus(raw: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  String(raw || '')
    .toUpperCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .split(' ')
    .forEach((w) => {
      if (w && THESAURUS_MAP[w]) out.push([w, THESAURUS_MAP[w]]);
    });
  return out;
}
/** Token administratif (KOTA/KAB/KEC/...) yang dibuang dari teks ini (bukti temuan). */
function tokenAdminDibuang(raw: string): string[] {
  return cleanAndStandardizeText(raw)
    .split(' ')
    .filter((w) => w && ADMIN_NOISE_TOKENS.has(w));
}
// Singkatan arah/bagian yang hanya dipakai pada KUNCI KOTA (kolom MAX 15 DIGIT PTEN
// memotong nama: BENGKULU SELATAN -> BENGKULU SEL, SERAM BAGIAN TIMUR -> SERAM BAG TIMUR).
// Sengaja tidak masuk THESAURUS_MAP global supaya normalisasi alamat/role tidak berubah.
const CITY_ABBREV_MAP: Record<string, string> = {
  SEL: 'SELATAN', UTA: 'UTARA', UT: 'UTARA', TEN: 'TENGAH', TENG: 'TENGAH',
  TIM: 'TIMUR', BAR: 'BARAT', BA: 'BARAT', TI: 'TIMUR', BD: 'BARAT DAYA',
  BAG: 'BAGIAN', PEG: 'PEGUNUNGAN', KEP: 'KEPULAUAN',
};
// Alias resmi satu nama daerah (singkatan administratif yang dipakai PTEN/data lapangan).
// Dipakai SETELAH normalisasi token supaya "KEP SERIBU" == "KEPULAUAN SERIBU" dan
// "OKI" == "OGAN KOMERING ILIR". Hanya singkatan yang pasti, bukan tebakan pemotongan.
const CITY_ALIAS_MAP: Record<string, string> = {
  OKI: 'OGAN KOMERING ILIR',
  OKU: 'OGAN KOMERING ULU',
  'OKU TIMUR': 'OGAN KOMERING ULU TIMUR',
  'OKU SELATAN': 'OGAN KOMERING ULU SELATAN',
  'OKU UTARA': 'OGAN KOMERING ULU UTARA',
  KUKAR: 'KUTAI KARTANEGARA',
  KUANSING: 'KUANTAN SINGINGI',
  BOLMONG: 'BOLAANG MONGONDOW',
  'BOLMONG UTARA': 'BOLAANG MONGONDOW UTARA',
  'BOLMONG SELATAN': 'BOLAANG MONGONDOW SELATAN',
  'BOLMONG TIMUR': 'BOLAANG MONGONDOW TIMUR',
  'TANJAB BARAT': 'TANJUNG JABUNG BARAT',
  'TANJAB TIMUR': 'TANJUNG JABUNG TIMUR',
  SIDRAP: 'SIDENRENG RAPPANG',
  HUMBAHAS: 'HUMBANG HASUNDUTAN',
  TANGSEL: 'TANGERANG SELATAN',
  PALI: 'PENUKAL ABAB LEMATANG ILIR',
  'MUKO MUKO': 'MUKOMUKO',
  'FAK FAK': 'FAKFAK',
  SOLO: 'SURAKARTA',
};
export function cityMatchKey(raw: string): string {
  const norm = expertNormalize(raw)
    .split(' ')
    .map((w) => CITY_ABBREV_MAP[w] || w)
    .join(' ');
  return CITY_ALIAS_MAP[norm] || norm;
}

/**
 * Jenis daerah administratif dari nama mentah: `KOTA` / `KAB` / `''` (tak menyebut jenis).
 * Dipakai hanya untuk MELAPORKAN kota kembar yang tergabung oleh `cityMatchKey`
 * ("KOTA BOGOR" dan "KABUPATEN BOGOR" jadi satu grup) — bukan untuk pencocokan.
 */
export function jenisDaerahDariNama(raw: string): 'KOTA' | 'KAB' | '' {
  const token = cleanAndStandardizeText(raw).split(' ')[0] || '';
  if (token === 'KABUPATEN' || token === 'KAB') return 'KAB';
  if (token === 'KOTA' || token === 'KODYA' || token === 'KOTAMADYA') return 'KOTA';
  return '';
}

// 🗺️ PEMEKARAN: nama daerah anak = nama induk + kata penanda wilayah. Ini pengetahuan
// tata usaha negara (Permendagri), BUKAN kemiripan huruf — "LAUT" dan "KEPULAUAN" tidak
// mirip sama sekali, tetapi BANGGAI LAUT (DOB 2013) memang hasil pemekaran BANGGAI
// KEPULAUAN. Data PTEN ber-vintage lama hanya punya nama induknya, jadi anak tidak boleh
// dibuang sebagai "belum terpetakan".
const PEMEKARAN_TOKENS = new Set([
  'LAUT', 'SELATAN', 'UTARA', 'BARAT', 'TIMUR', 'TENGAH', 'KEPULAUAN', 'PEGUNUNGAN',
  'BAGIAN', 'DAYA', 'PULAU', 'P', 'BARATDAYA',
]);
export function cityRootParts(key: string): { root: string; mods: string[] } {
  const mods: string[] = [];
  const root: string[] = [];
  key.split(' ').filter(Boolean).forEach((t) => (PEMEKARAN_TOKENS.has(t) ? mods : root).push(t));
  return { root: root.join(' '), mods };
}
/**
 * True bila dua kunci kota berbeda HANYA pada kata penanda wilayah dan berbagi akar
 * yang sama: induk ⟷ anak (SAMBAS / SAMBAS BARAT) atau sesama anak (BANGKA BARAT /
 * BANGKA SELATAN). Akar harus ≥ 4 huruf supaya "P. SERIBU" tidak bertemu "P. ANAMBAS".
 */
export function isPemekaranPair(keyA: string, keyB: string): boolean {
  if (!keyA || !keyB || keyA === keyB) return false;
  const a = cityRootParts(keyA);
  const b = cityRootParts(keyB);
  if (!a.root || a.root !== b.root || a.root.length < 4) return false;
  // Minimal satu sisi memakai penanda wilayah; kalau tidak, ini dua kota berbeda nama.
  return a.mods.length > 0 || b.mods.length > 0;
}

// 2. 🔄 TOKEN SET & JACCARD INTERSECTION (Anti-Kata Terbalik)
export function calculateTokenSetJaccard(strA: string, strB: string): number {
  const normA = cleanAndStandardizeText(strA);
  const normB = cleanAndStandardizeText(strB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const setA = new Set(normA.split(' ').filter(Boolean));
  const setB = new Set(normB.split(' ').filter(Boolean));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersection++;
  });

  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

// 3. 🎯 JARO-WINKLER & DAMERAU-LEVENSHTEIN (Anti-Typo Huruf Berdampingan)
export function jaroWinklerDistance(s1: string, s2: string): number {
  const a = s1.trim().toUpperCase();
  const b = s2.trim().toUpperCase();
  if (a === b) return 1.0;
  if (!a.length || !b.length) return 0;

  const matchWindow = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler Prefix Scaling (up to 4 characters prefix bonus)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// 4. 🗺️ PULAU — E6: definisi tunggal ada di `roleMatcher.getIslandFromProvinsi`.
//    Salinan lama di file ini (`getIslandFromProvince`, nilai "JAWA"/"INDONESIA")
//    tidak pernah dipakai dan jadi sumber dua fase menyimpulkan pulau yang berbeda.

// 5. 📊 TRI-GRAM VECTOR COSINE SIMILARITY (Pencocokan Kalimat Kompleks)
export function triGramCosineSimilarity(strA: string, strB: string): number {
  const getGrams = (s: string) => {
    const cleaned = `_${cleanAndStandardizeText(s)}_`;
    const map = new Map<string, number>();
    for (let i = 0; i < cleaned.length - 2; i++) {
      const g = cleaned.substring(i, i + 3);
      map.set(g, (map.get(g) || 0) + 1);
    }
    return map;
  };

  const gramsA = getGrams(strA);
  const gramsB = getGrams(strB);

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  gramsA.forEach((val, key) => {
    magA += val * val;
    if (gramsB.has(key)) {
      dotProduct += val * (gramsB.get(key) || 0);
    }
  });

  gramsB.forEach((val) => {
    magB += val * val;
  });

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

// 6. ✏️ DAMERAU-LEVENSHTEIN (Optimal String Alignment) — typo & huruf tertukar
function damerauOSA(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (!la) return lb;
  if (!lb) return la;
  const d: number[][] = Array.from({ length: la + 1 }, (_, i) => {
    const row = new Array<number>(lb + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= lb; j++) d[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[la][lb];
}
export function damerauLevenshteinSimilarity(strA: string, strB: string): number {
  const a = expertNormalize(strA);
  const b = expertNormalize(strB);
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  if (!max) return 0;
  return 1 - damerauOSA(a, b) / max;
}

// 7. 🧬 LONGEST COMMON SUBSEQUENCE ratio — ketahanan pada sisipan kata alamat
function lcsLength(a: string, b: string): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}
export function lcsRatio(strA: string, strB: string): number {
  const a = expertNormalize(strA);
  const b = expertNormalize(strB);
  if (!a.length || !b.length) return 0;
  return (2 * lcsLength(a, b)) / (a.length + b.length);
}

// 8. 🎨 RATCLIFF-OBERSHELP (Gestalt Pattern Matching) — kemiripan "sebagaimana dinilai manusia"
function gestaltMatchCount(a: string, b: string): number {
  if (!a || !b) return 0;
  let best = 0;
  let aiEnd = 0;
  let biEnd = 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) {
          best = cur[j];
          aiEnd = i;
          biEnd = j;
        }
      }
    }
    prev = cur;
  }
  if (!best) return 0;
  return (
    2 * best +
    gestaltMatchCount(a.slice(0, aiEnd - best), b.slice(0, biEnd - best)) +
    gestaltMatchCount(a.slice(aiEnd), b.slice(biEnd))
  );
}
export function ratcliffObershelpSimilarity(strA: string, strB: string): number {
  const a = expertNormalize(strA);
  const b = expertNormalize(strB);
  const denom = a.length + b.length;
  if (!denom) return 0;
  return gestaltMatchCount(a, b) / denom;
}

// 9. 🔊 PHONETIC INDONESIAN KEY — ejaan lama/baru & variasi transkripsi
// (DJ→J, TJ→C, SJ→S, KH/CH→K, SH→S, OE→U, AE→A, huruf ganda dilipatgandakan jadi satu)
export function indoPhoneticKey(raw: string): string {
  // Angka HARUS ikut kunci: "KCP 001" vs "KCP 002" dan "JL RAYA 10" vs "JL RAYA 11"
  // beda identitas unit, jadi tidak boleh collapse jadi kunci yang sama.
  let s = expertNormalize(raw).replace(/[^A-Z0-9 ]/g, '');
  s = s
    .replace(/DJ/g, 'J')
    .replace(/TJ/g, 'C')
    .replace(/SJ/g, 'S')
    .replace(/CH/g, 'K')
    .replace(/SH/g, 'S')
    .replace(/KH/g, 'K')
    .replace(/TH/g, 'T')
    .replace(/OE/g, 'U')
    .replace(/AE/g, 'A')
    .replace(/IE/g, 'I')
    .replace(/Q/g, 'K')
    .replace(/X/g, 'S')
    .replace(/Z/g, 'S');
  // lipat huruf kembar: "SMM" -> "SM" (hanya huruf, angka utuh)
  s = s.replace(/([A-Z])\1+/g, '$1');
  return s.replace(/\s+/g, ' ').trim();
}

// 10. 🧱 TOKEN CONTAINMENT — hierarki nama wilayah (yang pendek ⊆ yang panjang)
// Kata tambahan yang mengubah identitas (arah mata angin, pemekaran, singkatannya)
// membatalkan containment: "TANGERANG" ⊄ "TANGERANG SELATAN", "ALAM SUTRA" ⊄ "ALAM SUTRA UTARA".
const PENANDA_IDENTITAS = new Set<string>([...PEMEKARAN_TOKENS, ...Object.keys(CITY_ABBREV_MAP)]);
export function tokenContainmentScore(strA: string, strB: string): number {
  const ta = expertNormalize(strA).split(' ').filter(Boolean);
  const tb = expertNormalize(strB).split(' ').filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  const small = ta.length <= tb.length ? ta : tb;
  const bigList = ta.length <= tb.length ? tb : ta;
  const big = new Set(bigList);
  const longestSmall = Math.max(...small.map((t) => t.length));
  if (longestSmall < 4) return 0; // terlalu pendek — bukan bukti containment
  if (bigList.some((t) => !small.includes(t) && PENANDA_IDENTITAS.has(t))) return 0;
  if (small.every((t) => big.has(t))) {
    return 0.85 + 0.1 * (small.length / (ta.length + tb.length - small.length));
  }
  return 0;
}

// 11. 🔠 INITIALISM MATCH — "JP" vs "JAKARTA PUSAT", "KCP" vs "KANTOR CABANG PEMBANTU"
export function initialismMatchScore(strA: string, strB: string): number {
  const tokensA = expertNormalize(strA).split(' ').filter(Boolean);
  const tokensB = expertNormalize(strB).split(' ').filter(Boolean);
  const check = (short: string[], long: string[]): number => {
    if (short.length !== 1 || long.length < 2) return 0;
    const abbr = short[0];
    if (abbr.length < 2 || abbr.length !== long.length) return 0;
    const initials = long.map((t) => t[0]).join('');
    return initials === abbr ? 0.85 : 0;
  };
  return Math.max(check(tokensA, tokensB), check(tokensB, tokensA));
}

/** Potong nama panjang supaya catatan temuan tetap ringkas & sel satu baris. */
const singkatNama = (s: string, maks = 40): string => (s.length > maks ? `${s.slice(0, maks - 1)}…` : s);

/** Tambah catatan alasan (maks beberapa per sinyal) — penyebab baris masuk daftar temuan. */
function tambahCatatan(cat: Record<number, string[]>, no: number, teks: string) {
  const arr = (cat[no] = cat[no] || []);
  if (arr.length < CATATAN_MAX_PER_SINYAL && teks && !arr.includes(teks)) arr.push(teks);
}

// 🧠 MULTI-ENGINE EXPERT ENSEMBLE (12 sinyal + 2 penjaga: cascade pakar + consensus voting)
// Panggilan bisa jutaan pasangan (outlet × role), jadi sinyal mahal (DP O(n·m))
// hanya dijalankan bila sinyal murah menunjukkan pasangan ini "berpeluang".
export function calculateUnifiedPrecisionScore(
  textA: string,
  textB: string
): { score: number; algorithm: string; sinyal: number; catatan: Record<number, string[]> } {
  const normA = expertNormalize(textA);
  const normB = expertNormalize(textB);
  // Bit sinyal yang ikut membuktikan pasangan ini. Ambang "ikut menangkap" = 0,75
  // untuk sinyal kontinu; containment/initialism/fonetik memakai ambang cascadernya.
  let sinyal = 0;
  // Alasan per sinyal (kunci = nomor kartu 1..13), dibawa bersama bit-nya supaya
  // baris hasil bisa menjelaskan "kenapa saya masuk daftar ini" dalam bahasa awam.
  const catatan: Record<number, string[]> = {};
  const thA = pasanganThesaurus(textA);
  const thB = pasanganThesaurus(textB);
  if (thA.length > 0 || thB.length > 0) {
    sinyal |= SINYAL_BIT.thesaurus;
    for (const [dari, ke] of [...thA, ...thB]) tambahCatatan(catatan, 1, `"${dari}" dibaca "${ke}"`);
  }
  const tkA = tokenAdminDibuang(textA);
  const tkB = tokenAdminDibuang(textB);
  if (tkA.length > 0 || tkB.length > 0) {
    sinyal |= SINYAL_BIT.tokenAdmin;
    for (const t of [...tkA, ...tkB]) tambahCatatan(catatan, 2, `"${t}" dibuang — gelar administrasi, bukan nama asli`);
  }
  const cek = (v: number, bit: number, no: number, label: string) => {
    if (v >= 0.75) {
      sinyal |= bit;
      tambahCatatan(catatan, no, `${label} ${Math.round(v * 100)}% pada "${singkatNama(normA, 30)}" vs "${singkatNama(normB, 30)}"`);
    }
    return v;
  };

  if (normA === normB && normA.length > 0) {
    return { score: 1.0, algorithm: 'Exact Canonical Match', sinyal, catatan };
  }

  // ── Penjaga semantik: kemiripan huruf tidak boleh menimpa identitas ──
  // (1) Angka adalah identifier unit/kantor — "KCP 001" ≠ "KCP 002" walau 98% mirip.
  const angkaA = (normA.match(/\d+/g) || []).sort().join(',');
  const angkaB = (normB.match(/\d+/g) || []).sort().join(',');
  if (angkaA !== angkaB) {
    tambahCatatan(catatan, 13, `mirip namun beda angka identitas (${angkaA || 'tanpa angka'} ≠ ${angkaB || 'tanpa angka'}) → nilai dipangkas`);
    return { score: 0.6, algorithm: 'Identifier Guard (angka identitas berbeda)', sinyal: sinyal | SINYAL_BIT.penjaga, catatan };
  }
  // (2) Kata penanda wilayah di salah satu sisi = daerah berbeda (TANGERANG ≠
  //     TANGERANG SELATAN, ALAM SUTRA ≠ ALAM SUTRA UTARA), betapapun miripnya huruf.
  const setA = new Set(normA.split(' ').filter(Boolean));
  const setB = new Set(normB.split(' ').filter(Boolean));
  const penandaDari = (dari: Set<string>, ke: Set<string>): string[] =>
    [...ke].filter((t) => !dari.has(t) && PENANDA_IDENTITAS.has(t));
  const penandaBed = [...penandaDari(setA, setB), ...penandaDari(setB, setA)];
  if (penandaBed.length > 0) {
    tambahCatatan(catatan, 13, `mirip namun penanda wilayah beda ("${penandaBed.slice(0, 2).join('", "')}") → nilai dipangkas`);
    return { score: 0.7, algorithm: 'Region Marker Guard (penanda wilayah berbeda)', sinyal: sinyal | SINYAL_BIT.penjaga, catatan };
  }

  // ── Sinyal murah: dihitung selalu ──
  const tokenJaccard = cek(calculateTokenSetJaccard(normA, normB), SINYAL_BIT.jaccard, 3, 'susunan kata sama');
  const jaro = cek(jaroWinklerDistance(normA, normB), SINYAL_BIT.jaro, 4, 'ejaan mirip');
  const containment = tokenContainmentScore(normA, normB);
  if (containment >= 0.85) {
    sinyal |= SINYAL_BIT.containment;
    const pendek = normA.length <= normB.length ? normA : normB;
    const panjang = normA.length <= normB.length ? normB : normA;
    tambahCatatan(catatan, 10, `"${singkatNama(pendek, 30)}" ada di dalam "${singkatNama(panjang, 30)}"`);
  }
  const initials = initialismMatchScore(normA, normB);
  if (initials >= 0.85) {
    sinyal |= SINYAL_BIT.initialism;
    const tokA = normA.split(' ').filter(Boolean);
    const tokB = normB.split(' ').filter(Boolean);
    const [abbr, panjang] = tokA.length === 1 && tokB.length > 1 ? [normA, normB]
      : tokB.length === 1 && tokA.length > 1 ? [normB, normA] : [normA, normB];
    tambahCatatan(catatan, 12, `"${abbr}" = singkatan dari "${singkatNama(panjang, 30)}"`);
  }
  const keyA = indoPhoneticKey(normA);
  const keyB = indoPhoneticKey(normB);
  const phoneticHit = keyA.length >= 4 && keyA === keyB;
  if (phoneticHit) {
    sinyal |= SINYAL_BIT.fonetik;
    tambahCatatan(catatan, 9, `"${singkatNama(normA, 30)}" bunyinya sama dengan "${singkatNama(normB, 30)}"`);
  }

  // ── Cascade pakar (sinyal paling meyakinkan menang) ──
  if (phoneticHit) {
    return { score: Math.max(0.95, jaro), algorithm: 'Phonetic Indonesian Transcription Match', sinyal, catatan };
  }
  if (containment >= 0.85) {
    return { score: containment, algorithm: 'Token Containment (Hierarchical Region)', sinyal, catatan };
  }
  if (initials >= 0.85) {
    return { score: initials, algorithm: 'Initialism / Acronym Expansion Match', sinyal, catatan };
  }

  // ── Fast-reject gate: pasangan jelas berbeda tidak layak dibayar DP mahal ──
  const cheapBest = Math.max(tokenJaccard, jaro);
  if (cheapBest < 0.55) {
    return { score: 0.55 * tokenJaccard + 0.45 * jaro, algorithm: 'Fast Reject Gate (cheap signals only)', sinyal, catatan };
  }

  // ── Sinyal mahal: baru dihitung saat ada peluang ──
  const triGram = cek(triGramCosineSimilarity(normA, normB), SINYAL_BIT.trigram, 6, 'potongan huruf');
  const damerau = cek(damerauLevenshteinSimilarity(normA, normB), SINYAL_BIT.damerau, 5, 'huruf sisip/hapus/ganti');
  const lcs = cek(lcsRatio(normA, normB), SINYAL_BIT.lcs, 7, 'urutan huruf');
  const gestalt = cek(ratcliffObershelpSimilarity(normA, normB), SINYAL_BIT.gestalt, 8, 'kemiripan menyeluruh');

  const signals = [tokenJaccard, jaro, triGram, damerau, lcs, gestalt];
  const strongVotes = signals.filter((s) => s >= 0.85).length;
  const best = Math.max(...signals);

  // Consensus: ≥3 dari 6 mesin pakar sepakat mirip → nilai terbaik + bonus kesepakatan
  if (strongVotes >= 3) {
    return { score: Math.min(1, best + 0.04), algorithm: `Expert Ensemble Consensus (${strongVotes}/6 signals agree)`, sinyal, catatan };
  }
  if (strongVotes === 2 && best >= 0.9) {
    return { score: best, algorithm: 'Expert Ensemble Dual Agreement', sinyal, catatan };
  }

  // Hybrid berbobot 6 sinyal (fallback terukur)
  const hybrid =
    0.2 * tokenJaccard + 0.2 * jaro + 0.15 * triGram + 0.2 * damerau + 0.1 * lcs + 0.15 * gestalt;
  return { score: hybrid, algorithm: 'Multi-Engine Weighted Hybrid (6-Signal)', sinyal, catatan };
}

// 🏙️ CITY-STRICT MATCHER — khusus pencocokan KOTA/KABUPATEN.
// Sengaja TIDAK memakai token containment/initialism (subset nama = kota berbeda,
// mis. TANGERANG vs TANGERANG SELATAN). Hanya terima: exact canonical, fonetik,
// atau kemiripan sangat tinggi multi-sinyal. Lebih baik kota masuk review
// (fallback) daripada kelurahan salah tempel kota.
export function calculateCityMatchScore(textA: string, textB: string): { score: number; algorithm: string; sinyal: number; catatan: Record<number, string[]> } {
  const normA = expertNormalize(textA);
  const normB = expertNormalize(textB);
  let sinyal = 0;
  const catatan: Record<number, string[]> = {};
  const thA = pasanganThesaurus(textA);
  const thB = pasanganThesaurus(textB);
  if (thA.length > 0 || thB.length > 0) {
    sinyal |= SINYAL_BIT.thesaurus;
    for (const [dari, ke] of [...thA, ...thB]) tambahCatatan(catatan, 1, `"${dari}" dibaca "${ke}"`);
  }
  const tkA = tokenAdminDibuang(textA);
  const tkB = tokenAdminDibuang(textB);
  if (tkA.length > 0 || tkB.length > 0) {
    sinyal |= SINYAL_BIT.tokenAdmin;
    for (const t of [...tkA, ...tkB]) tambahCatatan(catatan, 2, `"${t}" dibuang — gelar administrasi, bukan nama asli`);
  }
  const catat = (v: number, bit: number, no: number, label: string) => {
    if (v >= 0.75) {
      sinyal |= bit;
      tambahCatatan(catatan, no, `${label} ${Math.round(v * 100)}% pada "${singkatNama(normA, 30)}" vs "${singkatNama(normB, 30)}"`);
    }
    return v;
  };
  if (normA === normB && normA.length > 0) {
    return { score: 1.0, algorithm: 'City Exact Canonical Match', sinyal, catatan };
  }
  const keyA = indoPhoneticKey(normA).replace(/ /g, '');
  const keyB = indoPhoneticKey(normB).replace(/ /g, '');
  if (keyA.length >= 4 && keyA === keyB) {
    sinyal |= SINYAL_BIT.fonetik;
    tambahCatatan(catatan, 9, `"${singkatNama(normA, 30)}" bunyinya sama dengan "${singkatNama(normB, 30)}"`);
    return { score: 0.96, algorithm: 'City Phonetic Match', sinyal, catatan };
  }
  // 📏 MASTER PTEN memakai kolom "KOTA/KABUPATEN MAX 15 DIGIT" → nama panjang
  // dipotong mentah di 15 karakter (MANDAILING NATAL -> MANDAILING NATA).
  // Kecocokan deterministik: prefix harus persis. Singkatan per kata
  // (BENGKULU SEL, SERAM BAG TIMUR) sudah diurai di cityMatchKey, bukan di sini.
  const [normS, normL] = normA.length <= normB.length ? [normA, normB] : [normB, normA];
  if (normS.length >= 15 && normL.length > normS.length && normL.startsWith(normS)) {
    return { score: 0.97, algorithm: 'City PTEN 15-Char Truncation', sinyal, catatan };
  }
  const jaccard = catat(calculateTokenSetJaccard(normA, normB), SINYAL_BIT.jaccard, 3, 'susunan kata sama');
  const jaro = catat(jaroWinklerDistance(normA, normB), SINYAL_BIT.jaro, 4, 'ejaan mirip');
  const tri = catat(triGramCosineSimilarity(normA, normB), SINYAL_BIT.trigram, 6, 'potongan huruf');
  const dam = catat(damerauLevenshteinSimilarity(normA, normB), SINYAL_BIT.damerau, 5, 'huruf sisip/hapus/ganti');
  const gest = catat(ratcliffObershelpSimilarity(normA, normB), SINYAL_BIT.gestalt, 8, 'kemiripan menyeluruh');
  const best = Math.max(jaccard, jaro, tri, dam, gest);
  if (best >= 0.9 && (jaccard >= 0.6 || jaro >= 0.93 || tri >= 0.9)) {
    return { score: best, algorithm: 'City Strict Ensemble Match', sinyal, catatan };
  }
  return { score: 0.55 * jaccard + 0.45 * jaro, algorithm: 'City Strict Reject', sinyal, catatan };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 PIPELINE ANALISIS 3 FASE BERBASIS 100% DATA MASTER
// ─────────────────────────────────────────────────────────────────────────────

// 🎭 D1 (keputusan Bagian 12-a): mesin resmi Fase 3 = engine layar review
// (findTopRoleMatchesByLocation: KC prioritas, nama/alias, jarak real, strict 1 pulau).
// Hasil otomatis pipeline TIDAK PERNAH lagi berbeda dari rekomendasi #1 yang dilihat
// operator, sebab keduanya kini satu engine. Keyakinan disusun dari bukti engine:
// KC/nama persis → 90+, kemiripan nama → 75–93, pilihan jarak semata → 60 (PERLU_REVIEW).
export function matchRoleForOutlet(
  activeCandidateMaster: MasterRow | undefined,
  targetRowFallback: TargetRow | undefined,
  roleMappingList: RoleMappingRecord[],
  masterRows: MasterRow[]
) {
  const kosong = {
    organisasiTujuan: '', tipeUnit: 'OUTLET' as const,
    roleCabsal: 0, roleCabapv1: 0, roleCabapv2: 0, roleGrandTotal: 0,
    is3RoleLengkap: false, alurWondr: '', flowDescription: '',
    confidenceScore: 0, matchingAlgorithm: '', sinyalRoleBit: 0,
    statusAnalisa: 'ANOMALI' as const, temuanCatatan: undefined as Record<number, string[]> | undefined,
  };
  // Engine layar boleh menawarkan "KC itu sendiri" / "cabang induknya" sebagai usulan
  // struktur — tapi itu bukan record Data Mapping Role, jadi otomatis tidak boleh
  // menuliskannya sebagai peran 3/3/3 (D2). Diambil kandidat teratas yang ber-record nyata.
  const kandidat = findTopRoleMatchesByLocation(activeCandidateMaster, targetRowFallback, roleMappingList, masterRows, 4);
  const pilihan = kandidat.find((k) => !k.synthetic) || null;
  if (!pilihan) {
    const usulan = kandidat[0];
    if (!usulan) return kosong;
    return {
      ...kosong,
      matchingAlgorithm: 'Usulan engine belum terdaftar di Data Mapping Role',
      temuanCatatan: {
        11: [`mesin menyarankan "${usulan.rec.organisasiTujuan}" sebagai cabang induk, tapi cabang itu belum ada di Data Mapping Role — isi perannya dulu atau pilih manual`],
      },
    };
  }

  const { rec, nameMatchScore } = pilihan;
  const organisasiTujuan = rec.organisasiTujuan;
  const isKc = getUnitCategory(organisasiTujuan) === 'KC';
  const tipeUnit: 'KC' | 'KCP' | 'OUTLET' = isKc ? 'KC' : 'KCP';
  const roleCabsal = rec.qrsCabsal ?? 0;
  const roleCabapv1 = rec.qrsCabapv1 ?? 0;
  const roleCabapv2 = rec.qrsCabapv2 ?? 0;
  const is3RoleLengkap = roleCabsal === 1 && roleCabapv1 === 1 && roleCabapv2 === 1;
  const wondr = getWondrRecommendation(rec);
  let confidenceScore: number;
  let matchingAlgorithm: string;
  let sinyalRoleBit = 0;
  let temuanCatatan: Record<number, string[]> | undefined;
  if (nameMatchScore >= 200) {
    confidenceScore = 100;
    matchingAlgorithm = 'KC Kandidat Itu Sendiri (Engine Layar)';
  } else if (nameMatchScore >= 180) {
    confidenceScore = 95;
    matchingAlgorithm = 'Cabang Induk KC dari KCP (Engine Layar)';
  } else if (nameMatchScore >= 100) {
    confidenceScore = 95;
    matchingAlgorithm = 'Nama/Alias Outlet Cocok Persis (Engine Layar)';
  } else if (nameMatchScore >= 95) {
    confidenceScore = 90;
    matchingAlgorithm = 'Kemiripan Nama Tinggi (Engine Layar)';
  } else if (nameMatchScore >= 85) {
    confidenceScore = 82;
    matchingAlgorithm = 'Nama Cabang Induk Cocok (Engine Layar)';
  } else if (nameMatchScore >= 70) {
    confidenceScore = 75;
    matchingAlgorithm = 'Token Outlet Terkandung di Organisasi (Engine Layar)';
  } else {
    confidenceScore = 60;
    matchingAlgorithm = 'Kedekatan Jarak Saja, Tanpa Bukti Nama (Engine Layar)';
    sinyalRoleBit = SINYAL_BIT.geo;
    temuanCatatan = { 11: ['role dipilih hanya karena jarak terdekat satu pulau — tidak ada bukti nama, mohon diperiksa'] };
  }
  // D5: pulau tak teridentifikasi bukan berarti "satu pulau" — jangan pernah auto-final.
  if (pilihan.islandUnknown && confidenceScore > 60) {
    confidenceScore = 60;
    matchingAlgorithm += ' — pulau tidak teridentifikasi';
    sinyalRoleBit |= SINYAL_BIT.geo;
    temuanCatatan = {
      ...(temuanCatatan || {}),
      11: [
        ...(temuanCatatan?.[11] || []),
        'pulau kandidat atau cabang tidak dikenali — tidak dianggap satu pulau, mohon diperiksa',
      ],
    };
  }
  let statusAnalisa: 'EXACT_MATCH' | 'HIGH_CONFIDENCE' | 'PERLU_REVIEW' | 'ANOMALI' | 'MENUNGGU' = 'ANOMALI';
  if (confidenceScore >= 90) statusAnalisa = 'EXACT_MATCH';
  else if (confidenceScore >= 75) statusAnalisa = 'HIGH_CONFIDENCE';
  else if (confidenceScore >= 60) statusAnalisa = 'PERLU_REVIEW';
  return {
    organisasiTujuan, tipeUnit, roleCabsal, roleCabapv1, roleCabapv2,
    roleGrandTotal: rec.grandTotal ?? (is3RoleLengkap ? 3 : roleCabsal + roleCabapv1 + roleCabapv2),
    is3RoleLengkap, alurWondr: wondr?.tier || '', flowDescription: wondr?.desc || '',
    confidenceScore, matchingAlgorithm, sinyalRoleBit, statusAnalisa, temuanCatatan,
  };
}

export interface PipelineProgressCallback {
  (phase: 1 | 2 | 3, percent: number, processed: number, total: number, message: string): void;
}

export interface CoverageCity {
  city: string;
  rows: number;
  status: 'VERIFIED' | 'REVIEW' | 'FALLBACK';
  sampleKodePos: string;
  provinsi: string;
}
export interface AnalystCoverage {
  kodePosTotal: number;
  kodePosMapped: number;
  verifiedRows: number;
  reviewRows: number;
  resultRows: number;
  unanalysedRows: number;
  unmappedCities: CoverageCity[];
  includedCities: CoverageCity[];
  // Grup yang menampung "KOTA X" sekaligus "KABUPATEN X" (26 grup pada data kode pos
  // nasional 2026-09-21). Kelurahan keduanya disatukan di satu kota PTEN.
  mergedCities: Array<{ kota: string; kabupaten: string; rows: number }>;
  // G3: baris yang dilewati karena kuncinya sudah ada di Final Data.
  // Dipakai laporan cakupan: "X baris dilewati karena sudah ada di Final Data".
  skippedFinalRows: number;
  skippedFinalSamples: Array<{ kelurahan: string; kodePos: string; kota: string }>;
}

/**
 * Dilempar pipeline ketika operator menekan "Batalkan". `App.tsx` menangkapnya dan
 * TIDAK menyimpan apa pun — hasil run memang baru ditulis setelah pipeline selesai,
 * jadi membatalkan selalu meninggalkan data sebelumnya utuh.
 */
export class AnalisaDibatalkan extends Error {
  constructor() {
    super('Analisa dibatalkan');
    this.name = 'AnalisaDibatalkan';
  }
}

/**
 * Menjalankan Pipeline Analisis 3 Fase langsung dari 5 Data Master
 */
export async function executeAnalystPipeline(
  masterCabangRows: MasterRow[],
  ptenList: PTENRecord[],
  kodePosList: KodePosRow[],
  wilayahSettings: WilayahSetting[],
  roleMappingList: RoleMappingRecord[],
  onProgress?: PipelineProgressCallback,
  reRunOnlyAnomalies = false,
  previousRows?: AnalystRow[],
  // 🎯 Analisis inkremental: kelurahan yang sudah ada di Final Data dilewati.
  // Kunci = `${kodePosPten}|${cityMatchKey(kelurahan)}`. Final Data itu FINAL,
  // jadi hanya kode pos / kelurahan BARU yang diprosse Fase 1→2→3.
  excludeFinalKeys?: Set<string>,
  // 🚦 Alur bertahap: 1 = hanya Fase 1 yang dihitung & ditampilkan, lalu berhenti
  // untuk direview; 2 menambah Fase 2; 3 (default) menyelesaikan semuanya.
  sampaiFase: 1 | 2 | 3 = 3,
  // ✋ Ditulis `true` oleh tombol "Batalkan"; dicek tiap `tick()` di dalam loop.
  pembatal?: { batal: boolean }
): Promise<{ rows: AnalystRow[]; coverage: AnalystCoverage }> {
  const startTime = performance.now();
  // 🚦 Alur bertahap: fase di atas `sampaiFase` tidak dihitung (Fase 3 = bagian termahal)
  // dan field-nya dibiarkan kosong supaya kartu/gridfase berikutnya tetap "belum jalan".
  const fase3Jalan = sampaiFase >= 3;
  const fase2Jalan = sampaiFase >= 2;

  // 1. Persiapkan Index Master untuk O(1) Quick Lookup
  // Kota di-key dengan cityMatchKey → "JAKARTA PUSAT" dan "KOTA ADMINISTRASI JAKARTA
  // PUSAT" dianggap kota yang sama (grouping berdasarkan kota/kabupaten PTEN)
  const ptenCityMap = new Map<string, PTENRecord[]>();
  ptenList.forEach((p) => {
    const k = cityMatchKey(p.kotaPten);
    if (!k) return;
    if (!ptenCityMap.has(k)) ptenCityMap.set(k, []);
    ptenCityMap.get(k)!.push(p);
  });

  const kodePosByCity = new Map<string, KodePosRow[]>();
  kodePosList.forEach((kp) => {
    const c = cityMatchKey(kp.kabupatenKota);
    if (!c) return;
    if (!kodePosByCity.has(c)) kodePosByCity.set(c, []);
    kodePosByCity.get(c)!.push(kp);
  });

  // 🪞 "KOTA BOGOR" dan "KABUPATEN BOGOR" sengaja jadi satu grup oleh `cityMatchKey`
  // (kode pos & PTEN memang satu kota). Penggabungan itu benar untuk pencocokan tapi
  // tidak boleh diam-diam: grup yang menampung kedua jenis daerah dicatat lalu
  // dilaporkan di cakupan supaya pembacanya tahu kelurahan dari 2 daerah menyatu.
  const mergedCityMap = new Map<string, { kota: string; kabupaten: string; rows: number }>();
  kodePosByCity.forEach((rows, key) => {
    let namaKota = '';
    let namaKab = '';
    rows.forEach((r) => {
      const j = jenisDaerahDariNama(r.kabupatenKota);
      if (j === 'KOTA' && !namaKota) namaKota = String(r.kabupatenKota || '').trim();
      else if (j === 'KAB' && !namaKab) namaKab = String(r.kabupatenKota || '').trim();
    });
    if (namaKota && namaKab) mergedCityMap.set(key, { kota: namaKota, kabupaten: namaKab, rows: rows.length });
  });

  // Cabang per kota/kabupaten — dipakai loop kota (representasi Fase 2) DAN perhitungan
  // Rank-1 per kelurahan di bagian expand, jadi dipromosikan ke cakupan pipeline.
  const masterByCity = new Map<string, MasterRow[]>();
  masterCabangRows.forEach((m) => {
    const k = cityMatchKey(String(m['Dati II'] || m.Kota || m.Kelurahan || ''));
    if (!k) return;
    if (!masterByCity.has(k)) masterByCity.set(k, []);
    masterByCity.get(k)!.push(m);
  });
  const masterCityFuzzyCache = new Map<string, MasterRow[]>();
  const findMasterByCity = (cityKey: string): MasterRow[] => {
    const exact = masterByCity.get(cityKey);
    if (exact) return exact;
    const cached = masterCityFuzzyCache.get(cityKey);
    if (cached) return cached;
    let best: MasterRow[] = [];
    let bestScore = 0;
    for (const [mKey, mVals] of masterByCity.entries()) {
      const { score } = calculateCityMatchScore(cityKey, mKey);
      if (score > bestScore && score >= 0.88) {
        bestScore = score;
        best = mVals;
      }
    }
    masterCityFuzzyCache.set(cityKey, best);
    return best;
  };

  // ── DRIVER FASE 1 = KOTA/KABUPATEN UNIK DARI DATA PTEN (grouping berdasar PTEN) ──
  // Setiap kota unik di PTEN → SEMUA kelurahan/kecamatan dari Master KodePos kota itu
  // di-mapping ke kota tersebut, memakai kode pos PTEN dari kota yang sama.
  // Master Cabang se-kota (jika ada) jadi representasi data Fase 2 & 3.
  let itemsToProcess: MasterRow[];
  if (ptenCityMap.size > 0) {
    // Urutkan grup kota berdasarkan nama Kota/Kabupaten PTEN (A→Z)
    // Urutkan grup kota berdasarkan nama Kota/Kabupaten PTEN (A→Z)
    itemsToProcess = Array.from(ptenCityMap.entries())
      .sort((a, b) =>
        (a[1][0]?.kotaPten || a[0]).localeCompare(b[1][0]?.kotaPten || b[0], 'id', { sensitivity: 'base' })
      )
      .map(([cityKey, ptenRecs]) => {
      const masters = findMasterByCity(cityKey);
      if (masters.length > 0) return masters[0];

      // Kota PTEN yang tidak punya cabang di master → baris penanda saja, supaya kota itu
      // tetap ikut dalam daftar kelurahan. Identitas cabang TIDAK dikarang (B4): kolom
      // nama/kode/status dibiarkan kosong sehingga barisnya jatuh ke antrean review
      // alih-alih menyamar sebagai data asli.
      const p = ptenRecs[0];
      return {
        Wilayah: '',
        'Sandi Cabang': '',
        Sandi: '',
        Cabang: '',
        'Branch Code': '',
        'Kode Cabang': '',
        'Nama Outlet': '',
        'Status Outlet': '',
        ALAMAT: '',
        'KODE POS': p.kodePosPten,
        Kelurahan: '',
        Kecamatan: '',
        'Dati II': p.kotaPten,
        'Kode Dati II': '',
        Provinsi: '',
        Telp: '',
      };
    });
  } else {
    // Tanpa data PTEN → kembali ke baris Master Cabang apa adanya
    itemsToProcess = masterCabangRows;
  }

  const total = itemsToProcess.length;
  const results: AnalystRow[] = [];
  let globalRowNo = 1;

  // ─────────────────────────────────────────────────────────────────────────────
  // ══ FASE 1: PTEN & KODE POS — Expand per Kelurahan/Kecamatan ══
  // Setiap baris Master Cabang → N baris (1 per kelurahan yang ada di Kota PTEN)
  // Semua baris dari 1 kota pakai kodePosPten yang SAMA dari PTEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (onProgress) onProgress(1, 5, 0, total, 'Fase 1: Menyiapkan index PTEN & Kode Pos...');

  // Cache Fase 2 & 3 computed data per raw row (dipakai di expand loop)
  interface RowMetaCache {
    finalKotaPten: string;
    finalKodePosPten: string;
    statusPten: 'SAME' | 'DIFFERENT' | 'PTEN FOUND' | 'UNCHECKED';
    matchedKodePosEntries: KodePosRow[];
    /** Cabang master di kota ini (dipakai Rank-1 per kelurahan; boleh kosong). */
    masterKota: MasterRow[];
    /** Cabang KIM untuk aturan khusus Aceh — bila terisi, dia menang mutlak. */
    kimCabang?: MasterRow | null;
    matchedProvinsi: string;
    usedFallback?: boolean;
    placementStatus: 'VERIFIED' | 'REVIEW' | 'FALLBACK';
    placementMethod: string;
    cityKey: string;
    cityRawName: string;
    kotaPtenMax15: string;
    /** Bit sinyal Fase 1 (nama kota + hirarki wilayah) — lihat SINYAL_BIT. */
    citySinyalBit: number;
    /** Alasan awam per sinyal 1..13 untuk Fase 1 — isi kolom "kenapa masuk daftar ini". */
    cityCatatan?: Record<number, string[]>;
    // Jaring pengaman baris sisa: catatan per kota master yang dilampirkan ke item ini
    safetyNetByCity?: Map<string, string>;
    // true bila baris sintetis fallback diganti baris asli hasil penampung
    safetyNetReplaced?: boolean;
  }
  const rowMetaCache: RowMetaCache[] = [];

  // ── GEOCODE BLOCK INDEX (verifikasi deterministik, bukan kemiripan nama) ──
  // Kode pos RI: digit 1 = zona provinsi, digit 4-5 = kecamatan/kelurahan,
  // sehingga blok kode pos adalah bukti geografis yang memisahkan kota.
  // Hasil uji atas 83.762 baris master: prefiks 2 angka hanya 9,6% unik-pemilik,
  // 3 angka 70,7%, 4 angka 95,0% → verifikasi pakai cascading 4→3→2 angka.
  // Ini yang memisahkan kota sesama provinsi bernama mirip, mis.
  // "OGAN KOMERING ULU" vs "... ULU TIMUR" (skor nama 0,913 tapi bloknya beda).
  interface CityGeoProfile { p4: Set<string>; p3: Set<string>; p2: Set<string>; prefixes: Set<string>; kecamatanSet: Set<string> }
  const cityGeoProfile = new Map<string, CityGeoProfile>();
  kodePosList.forEach((kp) => {
    const ck = cityMatchKey(kp.kabupatenKota);
    if (!ck) return;
    let prof = cityGeoProfile.get(ck);
    if (!prof) { prof = { p4: new Set(), p3: new Set(), p2: new Set(), prefixes: new Set(), kecamatanSet: new Set() }; cityGeoProfile.set(ck, prof); }
    const code = String(kp.kodePos || '').trim();
    if (code.length >= 4) prof.p4.add(code.slice(0, 4));
    if (code.length >= 3) prof.p3.add(code.slice(0, 3));
    if (code.length >= 2) prof.p2.add(code.slice(0, 2));
    if (code) prof.prefixes.add(code);
    const kec = cityMatchKey(kp.kecamatan);
    if (kec) prof.kecamatanSet.add(kec);
  });
  const cityKeyByPrefix: Map<string, string[]>[] = [new Map(), new Map(), new Map()];
  cityGeoProfile.forEach((prof, ck) => {
    ([prof.p4, prof.p3, prof.p2] as Set<string>[]).forEach((set, i) => {
      set.forEach((p) => {
        const arr = cityKeyByPrefix[i].get(p) || [];
        if (!arr.includes(ck)) arr.push(ck);
        cityKeyByPrefix[i].set(p, arr);
      });
    });
  });
  const geoVerifiedCityKeys = new Set<string>();
  // ── INDEKS KODE POS PERSIS (validasi silang Master KodePos ⟷ PTEN) ──
  // Kode pos 5 digit milik satu kota di master = bukti deterministik.
  // · nama kota PTEN tidak dikenal master → kode pos PTEN yang persis ada di master
  //   menunjuk kota pemiliknya (mis. 14540 → KEPULAUAN SERIBU).
  // · nama kota PTEN cocok tapi mayoritas kode posnya justru dimiliki kota master lain
  //   → pertentangan bukti, penempatan diturunkan ke REVIEW ("agar tidak melenceng").
  const masterCityByKodePos = new Map<string, string[]>(); // kode → kota master pemiliknya
  kodePosList.forEach((kp) => {
    const code = String(kp.kodePos || '').trim();
    const ck = cityMatchKey(kp.kabupatenKota);
    if (code.length < 5 || !ck) return;
    const arr = masterCityByKodePos.get(code) || [];
    if (!arr.includes(ck)) arr.push(ck);
    masterCityByKodePos.set(code, arr);
  });
  const ptenCodesByCity = new Map<string, string[]>(); // nama kota PTEN → daftar kode posnya
  ptenList.forEach((p) => {
    const k = cityMatchKey(p.kotaPten);
    const code = String(p.kodePosPten || '').trim();
    if (!k || code.length < 5) return;
    const arr = ptenCodesByCity.get(k) || [];
    if (!arr.includes(code)) arr.push(code);
    ptenCodesByCity.set(k, arr);
  });
  // Kota master yang sudah diklaim oleh nama kota PTEN / kode pos tidak boleh direbut
  // oleh kota PTEN lain → mencegah baris ganda.
  const cityNameClaimed = new Set<string>();
  ptenCityMap.forEach((_, k) => { if (kodePosByCity.has(k)) cityNameClaimed.add(k); });
  const claimedMasterCityKeys = new Set<string>();
  const ptenKotaByCode = new Map<string, string>(); // kode pos → nama kota PTEN (diagnostik)
  ptenList.forEach((p) => {
    const code = String(p.kodePosPten || '').trim();
    if (code.length >= 5 && !ptenKotaByCode.has(code)) ptenKotaByCode.set(code, p.kotaPten);
  });
  let kodePosClaimCities = 0;
  let kodePosConflictCities = 0;
  const voteMasterCity = (ptenKey: string, excludeClaimed: boolean) => {
    const tally = new Map<string, number>();
    (ptenCodesByCity.get(ptenKey) || []).forEach((code) => {
      (masterCityByKodePos.get(code) || []).forEach((ck) => {
        if (ck === ptenKey) return;
        if (excludeClaimed && (cityNameClaimed.has(ck) || claimedMasterCityKeys.has(ck))) return;
        tally.set(ck, (tally.get(ck) || 0) + 1);
      });
    });
    return Array.from(tally.entries())
      .map(([ck, votes]) => ({ ck, votes }))
      .sort((a, b) => b.votes - a.votes);
  };
  // Bukti blok: apakah kode pos ini benar-benar masuk wilayah kota tersebut?
  const codeConsistentWithCity = (ck: string, kp?: string): boolean => {
    const prof = cityGeoProfile.get(ck);
    if (!prof) return false;
    const code = String(kp || '').trim();
    if (code.length >= 4 && prof.p4.has(code.slice(0, 4))) return true;
    if (code.length >= 3 && prof.p3.has(code.slice(0, 3))) return true;
    if (code.length >= 2 && prof.p2.has(code.slice(0, 2))) return true;
    return code.length >= 5 && prof.prefixes.has(code);
  };
  type Placement = { rows: KodePosRow[]; status: 'VERIFIED' | 'REVIEW'; method: string };
  /**
   * Kota anak hasil pemekaran / wilayah turunan yang tetap dilayani outlet PTEN kota
   * induk. Dua bukti independen (keduanya dari data, bukan kemiripan huruf):
   *  A. nama serumah hanya beda kata penanda wilayah (isPemekaranPair) DAN seluruh blok
   *     kode pos anak ada di dalam blok induk — BANGGAI LAUT {948} ⊂ BANGGAI KEPULAUAN
   *     {947,948}, sedangkan BANGGAI {947} bukan walinya;
   *  B. PTEN sendiri mencantumkan kode pos milik kota lain di daftar kota ini —
   *     75779 (Mahakam Ulu) tercatat di KUTAI BARAT, 97611/97615 (Kota Tual) di
   *     MALUKU TENGGARA. Kota pemilik kode ikut masuk wilayah layanan induknya.
   * Kota yang sudah punya entri PTEN sendiri tidak pernah disentuh, dan anak diberikan
   * ke calon induk dengan bukti terbanyak supaya hasilnya tidak bergantung urutan baris.
   */
  const buktiAnakKode = new Map<string, Map<string, number>>();
  ptenCodesByCity.forEach((codes, ptenKey) => {
    codes.forEach((code) => {
      (masterCityByKodePos.get(code) || []).forEach((ck) => {
        if (ck === ptenKey || cityNameClaimed.has(ck)) return;
        const m = buktiAnakKode.get(ck) || new Map<string, number>();
        m.set(ptenKey, (m.get(ptenKey) || 0) + 1);
        buktiAnakKode.set(ck, m);
      });
    });
  });
  const serapAnakPemekaran = (indukKey: string, barisInduk: KodePosRow[]): { rows: KodePosRow[]; anak: string[] } => {
    const profInduk = cityGeoProfile.get(indukKey);
    if (!profInduk || profInduk.p3.size === 0) return { rows: barisInduk, anak: [] };
    const modsInduk = cityRootParts(indukKey).mods.length;
    const anak: string[] = [];
    const tambahan: KodePosRow[] = [];
    kodePosByCity.forEach((entries, ck) => {
      if (ck === indukKey || cityNameClaimed.has(ck) || claimedMasterCityKeys.has(ck)) return;
      const prof = cityGeoProfile.get(ck);
      if (!prof || prof.p3.size === 0) return;
      const diDalamInduk = [...prof.p3].every((b) => profInduk.p3.has(b));
      const namaSerumah = isPemekaranPair(ck, indukKey);
      const suara = buktiAnakKode.get(ck) || new Map<string, number>();
      const buktiKode = suara.get(indukKey) || 0;
      if (!(namaSerumah ? diDalamInduk : buktiKode >= 1)) return;
      // Wali paling sah: nama serumah + blok penuh adalah bukti terkuat; kalau kita
      // hanya bermodal kode pos, calon induk dengan bukti kode lebih banyak menang.
      const saingLain =
        !namaSerumah &&
        Array.from(suara.entries()).some(([k, v]) => k !== indukKey && v > buktiKode);
      const waliLain =
        saingLain ||
        Array.from(kodePosByCity.keys()).some(
          (k) =>
            k !== indukKey &&
            ptenCityMap.has(k) &&
            cityRootParts(k).mods.length < modsInduk &&
            isPemekaranPair(k, ck) &&
            [...prof.p3].every((b) => (cityGeoProfile.get(k)?.p3 || new Set<string>()).has(b))
        );
      if (waliLain) return;
      anak.push(ck);
      entries.forEach((r) => tambahan.push(r));
      claimedMasterCityKeys.add(ck);
      if (geoVerifiedCityKeys.has(indukKey)) geoVerifiedCityKeys.add(ck);
    });
    return tambahan.length > 0 ? { rows: [...barisInduk, ...tambahan], anak } : { rows: barisInduk, anak };
  };
  const catatanAnak = (anak: string[]): string =>
    anak.length > 0 ? ` + ${anak.length} kota turunan (pemekaran/wilayah PTEN): ${anak.join(', ')}` : '';
  // Resolve (nama kota PTEN + kode pos PTEN) → baris kodepos kota yang tepat,
  // wajib lolos uji blok kode pos. Tidak bisa dibuktikan → REVIEW, bukan tebak.
  const resolveCityByGeocode = (ptenKey: string, ptenKodePos: string): Placement => {
    const exact = kodePosByCity.get(ptenKey);
    if (exact && exact.length > 0) {
      if (!ptenKodePos) return { rows: exact, status: 'REVIEW', method: 'Nama kota cocok, kode pos PTEN kosong' };
      // Nama kota bisa dimiliki 2 provinsi (master punya "BANJAR" Jabar 46xxx
      // DAN Banjar Kalsel 70xxx) → saring baris pada blok kode pos yang memang
      // dipunyai kota PTEN ini (SEMUA kode pos PTEN kota itu, bukan satu saja:
      // GOWA punya blok 90xxx & 92xxx, KAPUAS 73xxx & 74xxx, dst).
      const ptenBlocks = new Set((ptenCodesByCity.get(ptenKey) || []).map((c) => c.slice(0, 2)));
      const inPtenBlock = ptenBlocks.size > 0
        ? exact.filter((r) => ptenBlocks.has(String(r.kodePos || '').slice(0, 2)))
        : exact;
      const sameBlock = inPtenBlock.length > 0
        ? inPtenBlock
        : exact.filter((r) => String(r.kodePos || '').slice(0, 2) === ptenKodePos.slice(0, 2));
      const rowsForCity = sameBlock.length > 0 ? sameBlock : exact;
      if (!codeConsistentWithCity(ptenKey, ptenKodePos)) {
        return { rows: rowsForCity, status: 'REVIEW', method: `Blok ${ptenKodePos} bukan wilayah kota ini` };
      }
      // Validasi silang kode pos: mayoritas kode pos kota PTEN ini justru dimiliki
      // kota master lain → nama mirip tapi wilayah melenceng, wajib review.
      const ptenCodes = ptenCodesByCity.get(ptenKey) || [];
      if (ptenCodes.length >= 3) {
        const votes = voteMasterCity(ptenKey, false);
        if (votes.length > 0 && votes[0].votes >= 3 && votes[0].votes >= ptenCodes.length * 0.6) {
          kodePosConflictCities++;
          return {
            rows: rowsForCity,
            status: 'REVIEW',
            method: `Konflik kode pos: ${votes[0].votes}/${ptenCodes.length} kode pos PTEN milik "${votes[0].ck}"`,
          };
        }
      }
      geoVerifiedCityKeys.add(ptenKey);
      claimedMasterCityKeys.add(ptenKey);
      const serap = serapAnakPemekaran(ptenKey, rowsForCity);
      return {
        rows: serap.rows,
        status: 'VERIFIED',
        method:
          (sameBlock.length < exact.length ? 'Join nama kota + saring blok kode pos PTEN' : 'Join nama kota + blok kode pos') +
          catatanAnak(serap.anak),
      };
    }
    // Nama kota PTEN tidak dikenal master → tanya pemilik persis kode posnya di master.
    const codeVotes = voteMasterCity(ptenKey, true);
    if (codeVotes.length > 0) {
      const top = codeVotes[0];
      const runnerUp = codeVotes[1];
      if (!runnerUp || top.votes > runnerUp.votes) {
        const nameScore = calculateCityMatchScore(ptenKey, top.ck).score;
        if (top.votes >= 2 || nameScore >= 0.6) {
          kodePosClaimCities++;
          geoVerifiedCityKeys.add(top.ck);
          claimedMasterCityKeys.add(top.ck);
          return {
            rows: kodePosByCity.get(top.ck)!,
            status: 'VERIFIED',
            method: `KodePos persis ada di PTEN (${top.votes} kode) → kota "${top.ck}"`,
          };
        }
      }
    }
    const kp = String(ptenKodePos || '').trim();
    if (kp.length >= 2) {
      const levels: { map: Map<string, string[]>; pre: string; name: string }[] = [
        { map: cityKeyByPrefix[0], pre: kp.slice(0, 4), name: '4-angka' },
        { map: cityKeyByPrefix[1], pre: kp.slice(0, 3), name: '3-angka' },
        { map: cityKeyByPrefix[2], pre: kp.slice(0, 2), name: '2-angka' },
      ];
      for (const lvl of levels) {
        const blockOwners = lvl.map.get(lvl.pre) || [];
        if (blockOwners.length === 0) continue;
        const ckList = blockOwners.filter((ck) => !claimedMasterCityKeys.has(ck));
        // semua pemilik blok sudah diambil kota PTEN lain → jangan berebut, review
        if (ckList.length === 0) {
          return { rows: [], status: 'REVIEW', method: `Blok ${lvl.name} (${lvl.pre}) sudah diklaim kota lain` };
        }
        // a) nama kota cocok DI DALAM blok kode pos ini → bukti terkuat
        for (const ck of ckList) {
          if (calculateCityMatchScore(ptenKey, ck).score >= 0.9) {
            geoVerifiedCityKeys.add(ck);
            claimedMasterCityKeys.add(ck);
            return { rows: kodePosByCity.get(ck)!, status: 'VERIFIED', method: `Blok ${lvl.name} + nama kota (${lvl.pre})` };
          }
        }
        // b) nama kecamatan PTEN dimiliki tepat satu kota di blok ini
        if (ptenKey.length >= 4) {
          const owners = ckList.filter((ck) => cityGeoProfile.get(ck)?.kecamatanSet.has(ptenKey));
          if (owners.length === 1) {
            geoVerifiedCityKeys.add(owners[0]);
            claimedMasterCityKeys.add(owners[0]);
            return { rows: kodePosByCity.get(owners[0])!, status: 'VERIFIED', method: `Blok ${lvl.name} + kecamatan (${lvl.pre})` };
          }
        }
        // c) blok menunjuk tepat satu kota KOMPAK (≤4 sub-blok)
        if (ckList.length === 1) {
          const onlyProf = cityGeoProfile.get(ckList[0]);
          if (onlyProf && onlyProf.p3.size <= 4) {
            geoVerifiedCityKeys.add(ckList[0]);
            claimedMasterCityKeys.add(ckList[0]);
            return { rows: kodePosByCity.get(ckList[0])!, status: 'VERIFIED', method: `Blok ${lvl.name} tunggal (${lvl.pre})` };
          }
        }
        // d) blok milik banyak kota & nama tidak cocok → JANGAN menebak
        return { rows: [], status: 'REVIEW', method: `Blok ${lvl.name} (${lvl.pre}) punya ${ckList.length} kota, nama tak cocok` };
      }
      // e) blok tidak dikenal master (data beda vintage) → fuzzy ketat, WAJIB review
      const candidates: { ck: string; score: number }[] = [];
      cityGeoProfile.forEach((_, ck) => {
        const { score } = calculateCityMatchScore(ptenKey, ck);
        if (score >= 0.88) candidates.push({ ck, score });
      });
      candidates.sort((a, b) => b.score - a.score);
      if (candidates.length === 1) {
        return { rows: kodePosByCity.get(candidates[0].ck) || [], status: 'REVIEW', method: `Blok ${kp.slice(0, 2)}xx tak dikenal, mirip "${candidates[0].ck}"` };
      }
      return { rows: [], status: 'REVIEW', method: `Blok ${kp.slice(0, 2)}xx tidak ada di master kodepos` };
    }
    // Tanpa kode pos PTEN: fallback fuzzy ketat, wajib review
    let bestKey = '';
    let bestScore = 0;
    kodePosByCity.forEach((_, ck) => {
      const { score } = calculateCityMatchScore(ptenKey, ck);
      if (score > bestScore && score >= 0.88) { bestScore = score; bestKey = ck; }
    });
    return {
      rows: bestKey ? kodePosByCity.get(bestKey)! : [],
      status: 'REVIEW',
      method: bestKey ? `Tanpa kode pos PTEN, mirip nama "${bestKey}"` : 'Tanpa kode pos & nama kota tak dikenal',
    };
  };

  // Non-blocking helpers: yield to browser event loop so progress bar can render
  const tick = async () => {
    if (pembatal?.batal) throw new AnalisaDibatalkan();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };
  // Memo caches — fuzzy matching is O(n*m) and expensive; identical inputs repeat heavily
  const ptenFuzzyCache = new Map<string, { rec: PTENRecord | null; sinyal: number; catatan: Record<number, string[]> }>();
  const kodePosCityCache = new Map<string, { rows: KodePosRow[]; status: 'VERIFIED' | 'REVIEW'; method: string }>();

  for (let i = 0; i < itemsToProcess.length; i++) {
    const raw = itemsToProcess[i];

    // Progress for Fase 1 (global 5% → 33%)
    if (i % 50 === 0 && onProgress) {
      const pct = Math.round(5 + (i / total) * 28);
      onProgress(1, pct, i + 1, total, `Fase 1: Mencocokkan PTEN & Kode Pos (${i + 1}/${total})...`);
    }
    // Yield every 20 rows so the browser can repaint the progress bar
    if (i % 20 === 0) await tick();

    const cityRaw = String(raw['Dati II'] || raw.Kota || raw.Kelurahan || '').trim();
    const cityClean = cityMatchKey(cityRaw);
    const kpRaw = String(raw['KODE POS'] || '').trim();
    // Sinyal yang ikut membuktikan penempatan wilayah baris ini (bitmask, lihat SINYAL_BIT),
    // plus catatan awam kenapa sinyal itu terpicu (untuk kolom "kenapa masuk daftar ini").
    const cityCatat: Record<number, string[]> = {};
    let citySinyal = 0;
    const cityPairs = pasanganThesaurus(cityRaw);
    if (cityPairs.length > 0) {
      citySinyal |= SINYAL_BIT.thesaurus;
      for (const [dari, ke] of cityPairs) tambahCatatan(cityCatat, 1, `"${dari}" dibaca "${ke}"`);
    }
    const cityTokens = tokenAdminDibuang(cityRaw);
    if (cityTokens.length > 0) {
      citySinyal |= SINYAL_BIT.tokenAdmin;
      for (const t of cityTokens) tambahCatatan(cityCatat, 2, `"${t}" dibuang — gelar administrasi, bukan nama asli`);
    }

    // ── Cari PTEN Match ──
    let matchedPtenRecord: PTENRecord | null = null;
    if (ptenCityMap.has(cityClean)) {
      const candidates = ptenCityMap.get(cityClean)!;
      matchedPtenRecord = candidates.find((c) => c.kodePosPten === kpRaw) || candidates[0];
    } else if (ptenFuzzyCache.has(cityClean)) {
      const cachedCity = ptenFuzzyCache.get(cityClean)!;
      matchedPtenRecord = cachedCity.rec;
      citySinyal = cachedCity.sinyal;
      const cc = gabungCatatanTemuan(cityCatat, cachedCity.catatan);
      if (cc) Object.assign(cityCatat, cc);
    } else {
      let bestScore = 0;
      let bestCitySinyal = 0;
      let bestCityCatat: Record<number, string[]> = {};
      for (const [ptenCityKey, candidates] of ptenCityMap.entries()) {
        const { score, sinyal, catatan } = calculateCityMatchScore(cityClean, ptenCityKey);
        if (score > bestScore && score >= 0.88) {
          bestScore = score;
          matchedPtenRecord = candidates[0];
          bestCitySinyal = sinyal;
          bestCityCatat = catatan;
        }
      }
      citySinyal |= bestCitySinyal;
      const mc = gabungCatatanTemuan(cityCatat, bestCityCatat);
      if (mc) Object.assign(cityCatat, mc);
      // Anak pemekaran: nama kotanya tidak ada di PTEN sama sekali, tapi PTEN punya
      // induknya (BANGGAI LAUT ⟶ BANGGAI KEPULAUAN). Induk dipilih yang blok kode posnya
      // menaungi SELURUH blok anak dan paling umum di antara kandidat.
      if (!matchedPtenRecord) {
        const prof = cityGeoProfile.get(cityClean);
        if (prof && prof.p3.size > 0) {
          const kandidat: { key: string; mods: number }[] = [];
          ptenCityMap.forEach((_c, ptenCityKey) => {
            if (!isPemekaranPair(cityClean, ptenCityKey)) return;
            const profInduk = cityGeoProfile.get(ptenCityKey);
            if (!profInduk) return;
            if (![...prof.p3].every((b) => profInduk.p3.has(b))) return;
            kandidat.push({ key: ptenCityKey, mods: cityRootParts(ptenCityKey).mods.length });
          });
          if (kandidat.length > 0) {
            const palingUmum = Math.min(...kandidat.map((k) => k.mods));
            const terpilih = kandidat.filter((k) => k.mods === palingUmum);
            if (terpilih.length === 1) {
              matchedPtenRecord = ptenCityMap.get(terpilih[0].key)![0];
              citySinyal |= SINYAL_BIT.geo;
              tambahCatatan(cityCatat, 11, `kota "${singkatNama(cityClean, 30)}" belum ada di PTEN → dipetakan ke induk "${singkatNama(terpilih[0].key, 30)}"`);
            }
          }
        }
      }
      ptenFuzzyCache.set(cityClean, { rec: matchedPtenRecord, sinyal: citySinyal, catatan: cityCatat });
    }

    // Tanpa kepastian kota/kode pos PTEN, jangan mengarang ("KOTA JAKARTA PUSAT"/"10110"):
    // nilai kosong akan terdeteksi sebagai kota yang belum terpetakan dan masuk antrean
    // manual, bukan salah tempel ke ibu kota.
    const finalKotaPten = matchedPtenRecord?.kotaPten || (cityRaw ? cityRaw.toUpperCase() : '');
    const finalKodePosPten = matchedPtenRecord?.kodePosPten || kpRaw || '';
    // 🧾 CATATAN KERAS: nama kota utk Fase 2 dst = kolom PTEN "KOTA/KABUPATEN MAX 15
    // DIGIT" (kotaPtenMax15). Bila file PTEN tidak punya kolom itu → potong keras 15
    // karakter, karena itulah definisi kolom tersebut.
    const finalKotaPtenMax15 =
      (matchedPtenRecord?.kotaPtenMax15 || '').trim() ||
      (finalKotaPten.length > 15 ? finalKotaPten.slice(0, 15) : finalKotaPten);

    // ── Cari SEMUA Kelurahan & Kecamatan dari Data Kode Pos untuk Kota PTEN ini ──
    // Resolusi deterministik: nama kota join dulu, lalu DIBUKTIKAN dengan blok
    // kode pos (digit depan) + keanggotaan kecamatan. Kota yang tidak bisa
    // dibuktikan tidak akan ditebak → status "Perlu Review".
    const ptenCleanCity = cityMatchKey(finalKotaPten);
    const cachedPlacement = kodePosCityCache.get(ptenCleanCity);
    let matchedKodePosEntries: KodePosRow[];
    let placementStatus: 'VERIFIED' | 'REVIEW' | 'FALLBACK';
    let placementMethod: string;
    if (cachedPlacement) {
      matchedKodePosEntries = cachedPlacement.rows;
      placementStatus = cachedPlacement.status;
      placementMethod = cachedPlacement.method;
    } else {
      const placed = resolveCityByGeocode(ptenCleanCity, finalKodePosPten);
      matchedKodePosEntries = placed.rows;
      placementStatus = placed.status;
      placementMethod = placed.method;
      kodePosCityCache.set(ptenCleanCity, placed);
    }

    // Jika tidak ada di Kode Pos, buat 1 entry fallback dari data Master
    let usedFallback = false;
    if (matchedKodePosEntries.length === 0) {
      usedFallback = true;
      placementStatus = 'FALLBACK';
      placementMethod = `${placementMethod} → baris Master (tanpa data kodepos)`;
      matchedKodePosEntries = [{
        kodePos: finalKodePosPten,
        kelurahan: String(raw.Kelurahan || finalKotaPten).trim() || finalKotaPten,
        kecamatan: String(raw.Kecamatan || finalKotaPten).trim() || finalKotaPten,
        kabupatenKota: finalKotaPten,
        provinsi: String(raw.Provinsi || 'INDONESIA').trim(),
      } as KodePosRow];
    }

    const matchedProvinsi = matchedKodePosEntries[0]?.provinsi || String(raw.Provinsi || 'INDONESIA').trim();

    let statusPten: 'SAME' | 'DIFFERENT' | 'PTEN FOUND' | 'UNCHECKED' = 'UNCHECKED';
    if (kpRaw && finalKodePosPten) {
      statusPten = kpRaw === finalKodePosPten ? 'SAME' : 'DIFFERENT';
    } else if (finalKodePosPten) {
      statusPten = 'PTEN FOUND';
    }

    // ── Fase 2: Wilayah & Master Cabang ──
    // 🕌 ATURAN ACEH (flow lama, recommender.ts): SELURUH penempatan di Provinsi
    // Aceh dilayani Cabang KIM — sumber field Fase 2 diganti ke baris KIM master.
    const kimAceh = isAcehRegion({
      Provinsi: matchedProvinsi || '',
      'Dati II': finalKotaPten,
      Wilayah: raw.Wilayah || '',
    } as unknown as TargetRow)
      ? findKimBranch(masterCabangRows)
      : null;

    rowMetaCache.push({
      finalKotaPten, finalKodePosPten, statusPten,
      matchedKodePosEntries, matchedProvinsi, usedFallback,
      masterKota: kimAceh ? [kimAceh] : findMasterByCity(ptenCleanCity),
      kimCabang: kimAceh,
      placementStatus, placementMethod,
      cityKey: ptenCleanCity, cityRawName: finalKotaPten,
      kotaPtenMax15: finalKotaPtenMax15,
      // Sinyal 11 (geo-hierarchy) ikut menangkap bila penempatan menyerap kota
      // turunan/pemekaran — bukti hirarki wilayah, bukan kemiripan nama.
      citySinyalBit: citySinyal | (placementMethod.includes('pemekaran') ? SINYAL_BIT.geo : 0),
      cityCatatan: (() => {
        if (placementMethod.includes('pemekaran') && !cityCatat[11]) {
          tambahCatatan(cityCatat, 11, `nama kota turunan/pemekaran → ditempatkan di wilayah induk lewat blok kode pos`);
        }
        return gabungCatatanTemuan(cityCatat);
      })(),
    });
  }

  // ── JARING PENGAMAN BARIS SISA — bukti deterministik, bukan tebakan ──
  // · Tier A: mayoritas kode pos kota master tercatat di PTEN satu kota (≥60% baris,
  //   atau nama termuat penuh + tanpa pesaing) → dilampirkan, ikut status item.
  // · Tier B: nama berhubungan (token containment / fonetik Indonesia) DAN blok kode
  //   pos 3 digit subset salah satu arah → dilampirkan tapi dipaksa REVIEW.
  // Bukti kurang → tetap "belum terpetakan" (manual), tidak pernah dilabeli salah.
  // Akuntansi baris pakai signature (kodePos|kota|kelurahan), tahan duplikat.
  const rowSig = (e: KodePosRow): string =>
    `${String(e.kodePos || '').trim()}|${cityMatchKey(e.kabupatenKota)}|${expertNormalize(e.kelurahan || '')}`;
  const sigRemaining = new Map<string, number>();
  kodePosList.forEach((e) => {
    const s = rowSig(e);
    sigRemaining.set(s, (sigRemaining.get(s) || 0) + 1);
  });
  const markKodePosUsed = (e: KodePosRow) => {
    const s = rowSig(e);
    const r = sigRemaining.get(s) || 0;
    if (r > 0) sigRemaining.set(s, r - 1);
  };
  rowMetaCache.forEach((m) => {
    if (!m.usedFallback) m.matchedKodePosEntries.forEach(markKodePosUsed);
  });
  const leftoverByCity = new Map<string, KodePosRow[]>();
  let leftoverNoCity = 0;
  kodePosList.forEach((e) => {
    const s = rowSig(e);
    const r = sigRemaining.get(s) || 0;
    if (r <= 0) return;
    sigRemaining.set(s, r - 1);
    const ck = cityMatchKey(e.kabupatenKota) || String(e.kabupatenKota || '').toUpperCase();
    if (!ck) { leftoverNoCity++; return; }
    if (!leftoverByCity.has(ck)) leftoverByCity.set(ck, []);
    leftoverByCity.get(ck)!.push(e);
  });
  const itemIndexByCityKey = new Map<string, number>();
  rowMetaCache.forEach((m, idx) => {
    if (!itemIndexByCityKey.has(m.cityKey)) itemIndexByCityKey.set(m.cityKey, idx);
  });
  let safetyNetRows = 0;
  let safetyNetCities = 0;
  const attachLeftover = (ck: string, entries: KodePosRow[], targetIdx: number, note: string, forceReview: boolean) => {
    const meta = rowMetaCache[targetIdx];
    if (!meta) return;
    if (!meta.safetyNetByCity) meta.safetyNetByCity = new Map();
    meta.safetyNetByCity.set(ck, note);
    if (meta.usedFallback) {
      meta.matchedKodePosEntries = [...entries];
      meta.usedFallback = false;
      meta.placementStatus = forceReview ? 'REVIEW' : 'VERIFIED';
      meta.safetyNetReplaced = true;
    } else {
      // salin dulu — array bisa dipakai bersama item lain via kodePosCityCache
      meta.matchedKodePosEntries = [...meta.matchedKodePosEntries, ...entries];
      if (forceReview && meta.placementStatus === 'VERIFIED') meta.placementStatus = 'REVIEW';
    }
    safetyNetRows += entries.length;
    safetyNetCities++;
    leftoverByCity.delete(ck);
  };
  // Tier A — bukti kepemilikan kode pos di PTEN
  leftoverByCity.forEach((entries, ck) => {
    const tally = new Map<string, number>();
    entries.forEach((e) => {
      const kota = ptenKotaByCode.get(String(e.kodePos || '').trim());
      if (kota) {
        const kk = cityMatchKey(kota);
        tally.set(kk, (tally.get(kk) || 0) + 1);
      }
    });
    if (!tally.size) return;
    const ranked = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
    const topKey = ranked[0][0];
    const topVotes = ranked[0][1];
    const runnerVotes = ranked.length > 1 ? ranked[1][1] : 0;
    const contained = tokenContainmentScore(ck, topKey) >= 0.85 || tokenContainmentScore(topKey, ck) >= 0.85;
    if (!(topVotes > runnerVotes && (topVotes / entries.length >= 0.6 || (contained && runnerVotes === 0)))) return;
    const targetIdx = itemIndexByCityKey.get(topKey);
    if (targetIdx === undefined) return;
    const namaPten = ptenCityMap.get(topKey)?.[0]?.kotaPten || topKey;
    attachLeftover(ck, entries, targetIdx,
      `Jaring pengaman: ${topVotes} dari ${entries.length} kode pos kota ini terdaftar di PTEN "${namaPten}"${contained ? ' & namanya konsisten' : ''}`,
      false);
  });
  // Tier B — bukti nama (containment/fonetik) + subset blok kode pos; dipaksa REVIEW
  const phonKeyOf = (s: string) => indoPhoneticKey(s).replace(/ /g, '');
  leftoverByCity.forEach((entries, ck) => {
    const prof = cityGeoProfile.get(ck);
    if (!prof || !prof.p3.size) return;
    const keyFonetik = phonKeyOf(ck);
    let bestKey = '';
    let bestScore = 0;
    let ambiguous = false;
    ptenCityMap.forEach((_recs, pk) => {
      if (pk === ck) return;
      const pprof = cityGeoProfile.get(pk);
      if (!pprof || !pprof.p3.size) return;
      const [kecil, besar] = prof.p3.size <= pprof.p3.size ? [prof, pprof] : [pprof, prof];
      let subset = true;
      kecil.p3.forEach((b) => { if (!besar.p3.has(b)) subset = false; });
      if (!subset) return;
      const namaMirip = tokenContainmentScore(ck, pk) >= 0.85
        || tokenContainmentScore(pk, ck) >= 0.85
        || (keyFonetik.length >= 4 && keyFonetik === phonKeyOf(pk));
      if (!namaMirip) return;
      const score = calculateCityMatchScore(ck, pk).score;
      if (score > bestScore) { bestScore = score; bestKey = pk; ambiguous = false; }
      else if (score === bestScore) ambiguous = true;
    });
    if (!bestKey || ambiguous) return;
    const targetIdx = itemIndexByCityKey.get(bestKey);
    if (targetIdx === undefined) return;
    const namaPten = ptenCityMap.get(bestKey)?.[0]?.kotaPten || bestKey;
    attachLeftover(ck, entries, targetIdx,
      `Jaring pengaman fonetik: nama kota mirip PTEN "${namaPten}" + blok kode pos subset — perlu review manual`,
      true);
  });

  // ── C2a/C2d: Rank-1 Fase 2 dihitung PER KELURAHAN memakai mesin kandidat yang SAMA
  // dengan layar review. Sebelumnya satu kota hanya memandang baris master pertamanya,
  // sehingga Braga dan Lebak Siliwangi (kota sama) pasti dapat outlet yang sama. ──
  const indeksProximity: MasterProximityIndex | null =
    fase2Jalan && masterCabangRows.length > 0 ? buildMasterProximityIndex(masterCabangRows) : null;

  /** Bentuk TargetRow minimal untuk mesin kandidat — kolom master sengaja kosong. */
  const targetKandidatFase2 = (meta: RowMetaCache, kelurahan: string, kecamatan: string, kodePos: string, provinsi: string): TargetRow =>
    ({
      No: 0,
      Wilayah: '',
      'Sandi Cabang': '',
      'Branch Code': '',
      'Kode Cabang': '',
      'Nama Outlet': '',
      'Status Outlet': '',
      // ALAMAT kosong SENGAJA: kalau alamat cabang yang sedang terpasang ikut dikirim,
      // cabang itu "satu jalur" dengan dirinya sendiri dan menang terus — bukan karena
      // lebih dekat.
      ALAMAT: '',
      'KODE POS': kodePos || meta.finalKodePosPten,
      Kelurahan: kelurahan,
      Kecamatan: kecamatan,
      'Dati II': meta.cityRawName,
      'Kode Dati II': '',
      Provinsi: provinsi,
    } as unknown as TargetRow);

  const tierCabang = (meta: RowMetaCache, m: MasterRow): 1 | 2 | 3 => {
    if (cityMatchKey(String(m['Dati II'] || '')) === meta.cityKey) return 1;
    return expertNormalize(String(m.Provinsi || '')) === expertNormalize(meta.matchedProvinsi) ? 2 : 3;
  };

  type Rank1 = { master: MasterRow | null; km: number; presisi: boolean; tier: 1 | 2 | 3; alasan: string };
  const cacheRank1 = new Map<string, Rank1>();
  const rank1Fase2 = (meta: RowMetaCache, kelurahan: string, kecamatan: string, kodePos: string, provinsi: string): Rank1 => {
    const kunci = `${meta.cityKey}|${kodePos}|${kelurahan}|${kecamatan}`;
    const lalu = cacheRank1.get(kunci);
    if (lalu) return lalu;
    const target = targetKandidatFase2(meta, kelurahan, kecamatan, kodePos, provinsi);
    let hasil: Rank1;
    if (meta.kimCabang) {
      // Aturan Aceh: seluruh penempatan provinsi Aceh dilayani Cabang KIM.
      const d = calculateRealDistance(target, meta.kimCabang);
      hasil = { master: meta.kimCabang, km: d.distanceKm, presisi: d.isPrecise, tier: 1, alasan: 'Aturan Aceh → Cabang KIM' };
    } else if (!indeksProximity || meta.masterKota.length === 0) {
      hasil = { master: null, km: 999, presisi: false, tier: 3, alasan: 'kota tidak punya cabang di Data Master' };
    } else if (meta.masterKota.length === 1) {
      const m = meta.masterKota[0];
      const d = calculateRealDistance(target, m);
      hasil = { master: m, km: d.distanceKm, presisi: d.isPrecise, tier: 1, alasan: 'Satu-satunya cabang di kota ini' };
    } else {
      const rec = findClosestMasterRecommendation(target, indeksProximity);
      const c = rec?.candidates[0];
      if (c) {
        hasil = { master: c.master, km: c.distanceKm ?? 0, presisi: c.distanceKm != null, tier: tierCabang(meta, c.master), alasan: c.reason };
      } else {
        const m = meta.masterKota[0];
        const d = calculateRealDistance(target, m);
        hasil = { master: m, km: d.distanceKm, presisi: d.isPrecise, tier: 1, alasan: '' };
      }
    }
    cacheRank1.set(kunci, hasil);
    return hasil;
  };

  /** Field Fase 2 sebuah baris, diambil apa adanya dari baris master terpilih (tidak dikarang). */
  const paketFase2 = (m: MasterRow | null) => {
    if (!m) {
      return { wilayah: '', sandiCabang: '', branchCode: '', kodeCabang: '', sandi: '', cabang: '', namaOutlet: '', statusOutlet: '', alamat: '' };
    }
    const branchCode = String(m['Branch Code'] || m['Kode Cabang'] || '').trim();
    const resolved = extractWilayahFromBranchCode(branchCode, wilayahSettings, m.Wilayah || '');
    return {
      wilayah: resolved.wilayahName !== '-' ? resolved.wilayahName : '',
      sandiCabang: String(m['Sandi Cabang'] || (m.Sandi && m.Cabang ? `${m.Sandi} - ${m.Cabang}` : m.Cabang || m.Sandi || '')),
      branchCode,
      kodeCabang: String(m['Kode Cabang'] || branchCode),
      sandi: String(m.Sandi || m['Sandi Cabang'] || ''),
      cabang: String(m.Cabang || m['Sandi Cabang'] || ''),
      namaOutlet: String(m['Nama Outlet'] || m.Cabang || ''),
      statusOutlet: String(m['Status Outlet'] || ''),
      alamat: String(m.ALAMAT || ''),
    };
  };

  // Fase 3 ikut per baris karena kandidat master-nya bisa beda antar kelurahan (C2a).
  const cacheRoleBaris = new Map<string, ReturnType<typeof matchRoleForOutlet>>();
  const roleUntukBaris = (meta: RowMetaCache, master: MasterRow, kelurahan: string, kecamatan: string, kodePos: string, provinsi: string) => {
    const kunci = `${meta.cityKey}|${master['Sandi Cabang'] || ''}|${master['Branch Code'] || master['Kode Cabang'] || ''}|${master['Nama Outlet'] || master.Cabang || ''}`;
    const lalu = cacheRoleBaris.get(kunci);
    if (lalu) return lalu;
    const hasil = matchRoleForOutlet(master, targetKandidatFase2(meta, kelurahan, kecamatan, kodePos, provinsi), roleMappingList, masterCabangRows);
    cacheRoleBaris.set(kunci, hasil);
    return hasil;
  };

  // M5: Fase 2 ikut dinilai ensemble sinyal. Buktinya = nama kota PTEN vs Dati II
  // cabang yang terpasang, memakai fungsi yang SAMA dengan Fase 1 — jadi kartu sinyal
  // 1..13 tidak lagi memuat fase yang sebenarnya tidak dinilai.
  const cacheBuktiF2 = new Map<string, { bit: number; skor: number; catatan: Record<number, string[]> }>();
  const buktiFase2 = (kotaPten: string, kotaCabang: string) => {
    const kunci = `${kotaPten}|${kotaCabang}`;
    const lalu = cacheBuktiF2.get(kunci);
    if (lalu) return lalu;
    const { score, sinyal, catatan } = calculateCityMatchScore(kotaPten, kotaCabang);
    const hasil = { bit: sinyal, skor: score, catatan: gabungCatatanTemuan(catatan) || {} };
    cacheBuktiF2.set(kunci, hasil);
    return hasil;
  };

  // Jarak jauh itu wajar di kabupaten luas — ambang mutlak 16 km yang lama membuat
  // hampir semua baris masuk antrean manual. Yang masih layak dipaksa periksa hanya
  // jarak mustahil untuk cabang yang katanya satu kota: itu gejala koordinat salah.
  const JARAK_MUSTAHIL_KM = 150;

  // ── EXPAND: Hasilkan 1 baris per kelurahan/kecamatan per Kota PTEN ──
  if (onProgress) onProgress(2, 35, 0, total, 'Fase 2: Menyusun data Wilayah & Cabang...');

  // Tracking cakupan: baris kodepos mana yang benar-benar masuk Fase 1
  let fallbackCityCount = 0;
  let reviewCityCount = 0;
  // Baris kodepos yang kotanya terbukti lewat join nama + verifikasi geocode
  let verifiedKodePosRows = 0;
  let reviewRow = 0;
  // Peta cakupan per kota (dipakai untuk laporan "kenapa jumlah ≠ 83.762")
  const includedCityMap = new Map<string, CoverageCity>();
  kodePosByCity.forEach((entries, ck) => {
    if (geoVerifiedCityKeys.has(ck)) verifiedKodePosRows += entries.length;
  });

  for (let i = 0; i < itemsToProcess.length; i++) {
    const meta = rowMetaCache[i];
    const prevRow = previousRows?.[i];

    // Tandai semua baris kodepos kota ini sebagai terpetakan (termasuk saat mode re-run)
    if (meta.usedFallback) fallbackCityCount++;
    else if (meta.placementStatus === 'REVIEW') { reviewCityCount++; reviewRow += meta.matchedKodePosEntries.length; }
    if (!includedCityMap.has(meta.cityKey)) {
      const first = meta.matchedKodePosEntries[0];
      includedCityMap.set(meta.cityKey, {
        city: meta.cityRawName,
        rows: meta.usedFallback ? 0 : meta.matchedKodePosEntries.length,
        status: meta.placementStatus,
        sampleKodePos: first?.kodePos || '',
        provinsi: first?.provinsi || meta.matchedProvinsi || '',
      });
    }

    // Progress — hanya fase yang sedang dikerjakan yang melapor, supaya kartu fase
    // berikutnya tetap kosong sampai gilirannya tiba.
    if (i % 50 === 0 && onProgress) {
      const pct = Math.round(35 + (i / total) * 31);
      const faseLapor = (fase2Jalan ? 2 : 1) as 1 | 2;
      onProgress(faseLapor, pct, i + 1, total, `Fase ${faseLapor}: Validasi Wilayah & Cabang (${i + 1}/${total})...`);
    }
    if (i % 50 === 0) await tick();

    // Jika mode "Ulangi yang Salah Saja", lewati baris yang sudah valid & disetujui
    if (reRunOnlyAnomalies && prevRow && prevRow.isFinalApproved && prevRow.statusAnalisa === 'EXACT_MATCH') {
      results.push(prevRow);
      continue;
    }

    const allKelurahanCount = meta.matchedKodePosEntries.length;

    // Hasilkan 1 baris per kelurahan/kecamatan
    meta.matchedKodePosEntries.forEach((kpEntry, seq) => {
      // Baris hasil jaring pengaman membawa metode aslinya sendiri (status tetap konsisten per kota)
      const snNote = meta.safetyNetByCity?.get(cityMatchKey(kpEntry.kabupatenKota || ''));
      const kelurahan = kpEntry.kelurahan || meta.finalKotaPten;
      const kecamatan = kpEntry.kecamatan || meta.finalKotaPten;
      const provinsi = kpEntry.provinsi || meta.matchedProvinsi;
      const kodePosBaris = String(kpEntry.kodePos || '').trim();

      // Mesin kandidat per kelurahan (C2a) → paket field Fase 2 apa adanya dari
      // baris master terpilih, lalu Fase 3 dihitung ulang untuk outlet itu.
      const r1 = fase2Jalan ? rank1Fase2(meta, kelurahan, kecamatan, kodePosBaris, provinsi) : null;
      const f2 = paketFase2(r1?.master || null);
      const roleBaris = fase3Jalan && r1?.master ? roleUntukBaris(meta, r1.master, kelurahan, kecamatan, kodePosBaris, provinsi) : null;

      // M1 + M6: penanda "perlu diputuskan operator". Wajib TIDAK manual: baris aturan
      // Aceh (deterministik) dan baris yang cabangnya memang Rank-1 mesin.
      const temuanFase2: string[] = [];
      const kotaCabang = r1?.master ? String(r1.master['Dati II'] || r1.master['Kota/Dati II'] || '') : '';
      const buktiF2 = r1?.master ? buktiFase2(meta.cityRawName || meta.finalKotaPten, kotaCabang) : null;
      const aturanAceh = !!meta.kimCabang;
      if (r1) {
        if (!r1.master) {
          temuanFase2.push('kota ini tidak punya cabang di Data Master');
        } else {
          if (r1.tier === 2) temuanFase2.push('cabang terpilih di luar kota (masih satu provinsi)');
          else if (r1.tier === 3) temuanFase2.push('cabang terpilih di luar provinsi');
          // M6(3): beda pulau — aturan Aceh dikecualikan karena memang penempatannya khusus.
          const pulauBaris = getIslandFromProvinsi(provinsi, meta.cityRawName, `${kelurahan} ${kecamatan}`);
          const pulauCabang = getIslandFromProvinsi(String(r1.master.Provinsi || ''), kotaCabang, String(r1.master.ALAMAT || ''));
          if (!aturanAceh && pulauBaris !== 'Lainnya' && pulauCabang !== 'Lainnya' && pulauBaris !== pulauCabang) {
            temuanFase2.push(`cabang terpilih beda pulau (${pulauCabang} vs ${pulauBaris})`);
          }
          if (r1.tier === 1 && r1.km > JARAK_MUSTAHIL_KM) {
            temuanFase2.push(`jarak ${r1.km.toLocaleString('id-ID')} km padahal satu kota — koordinat perlu diperiksa`);
          }
          // M6(5): jarak tidak terukur DAN nama kota tidak saling mendukung → mesin buta.
          if (!aturanAceh && !r1.presisi && (buktiF2?.skor ?? 0) < 0.75) {
            temuanFase2.push('jarak tidak terukur dan nama kota cabang tidak mendukung');
          }
          if (!aturanAceh && r1.tier === 1 && !adalahKcFase2(r1.master) && !meta.masterKota.some(adalahKcFase2)) {
            temuanFase2.push('tidak ada KC di kota ini — KCP yang terpilih');
          }
          // W1: kode cabang alfanumerik (mis. "JKT-THM-01") tidak membaca Kanwil dari
          // potongan angka — jangan biarkan barisnya diam-diam tanpa wilayah.
          if (f2.branchCode && !f2.wilayah) {
            temuanFase2.push(`wilayah tidak terbaca dari Branch Code ${f2.branchCode}`);
          }
        }
      }
      const fase2Sumber = !fase2Jalan ? '' : !r1?.master ? 'TIDAK_ADA_CABANG' : aturanAceh ? 'ATURAN_ACEH_KIM' : 'OTOMATIS_TERDEKAT';
      const fase2Status: 'OTOMATIS_VALID' | 'SIAP_DIPROSES' | 'PERLU_MANUAL' = !fase2Jalan
        ? 'SIAP_DIPROSES'
        : !r1?.master || temuanFase2.length > 0
          ? 'PERLU_MANUAL'
          : 'OTOMATIS_VALID';
      const statusBaris = roleBaris
        ? roleBaris.statusAnalisa
        : fase3Jalan ? 'ANOMALI' : 'MENUNGGU';

      // Analisis inkremental: lewati kelurahan yang SUDAH final (jangan diulang dari awal)
      if (excludeFinalKeys && excludeFinalKeys.has(makeFinalKey(meta.finalKodePosPten, kelurahan, kecamatan, meta.finalKotaPten))) {
        // G3: catat baris yang dilewati agar laporan cakupan bisa melaporkan jumlahnya.
        skippedFinalCount++;
        if (skippedFinalSampleList.length < 20) {
          skippedFinalSampleList.push({ kelurahan, kodePos: meta.finalKodePosPten, kota: meta.finalKotaPten });
        }
        return;
      }

      results.push({
        id: `analyst-${i + 1}-${seq + 1}-${Date.now()}`,
        no: globalRowNo++,
        // Fase 1
        kotaPten: meta.finalKotaPten,
        kodePosPten: meta.finalKodePosPten, // SAMA untuk semua kelurahan dalam 1 kota PTEN
        kodePosKelurahan: kodePosBaris, // kode pos kelurahan ini sendiri
        kelurahan,
        kecamatan,
        provinsi,
        statusPten: meta.statusPten,
        placementStatus: meta.placementStatus,
        placementMethod: snNote || meta.placementMethod,
        groupKota: meta.finalKotaPten,
        kategori: 'DIANALISA',
        fase1Approved: false,
        sourceRowIndex: i,
        allKelurahanCount,
        kelurahanSeq: seq + 1,

        // Fase 2 — kosong selama Fase 1 belum disetujui (alur bertahap)
        wilayah: f2.wilayah,
        kotaPtenMax15: fase2Jalan ? meta.kotaPtenMax15 : '',
        sandiCabang: f2.sandiCabang,
        sandi: f2.sandi,
        cabang: f2.cabang,
        branchCode: f2.branchCode,
        kodeCabang: f2.kodeCabang,
        namaOutlet: f2.namaOutlet,
        statusOutlet: f2.statusOutlet,
        alamat: f2.alamat,
        fase2Approved: false,
        fase2JarakKm: r1?.km ?? 0,
        fase2Tier: r1?.tier ?? 3,
        fase2Temuan: temuanFase2,
        fase2Status,
        fase2Sumber,

        // Fase 3 — kosong sampai Fase 2 disetujui; dihitung dari outlet baris ini
        organisasiTujuan: roleBaris?.organisasiTujuan || '',
        tipeUnit: roleBaris?.tipeUnit || 'OUTLET',
        is3RoleLengkap: roleBaris?.is3RoleLengkap || false,
        roleCabsal: roleBaris?.roleCabsal || 0,
        roleCabapv1: roleBaris?.roleCabapv1 || 0,
        roleCabapv2: roleBaris?.roleCabapv2 || 0,
        roleGrandTotal: roleBaris?.roleGrandTotal || 0,
        alurWondr: roleBaris?.alurWondr || '',
        flowDescription: roleBaris?.flowDescription || '',
        fase3Approved: false,

        // Overall
        confidenceScore: roleBaris?.confidenceScore || 0,
        matchingAlgorithm: roleBaris?.matchingAlgorithm || '',
        sinyalBit: meta.citySinyalBit,
        sinyalF2Bit: buktiF2?.bit || 0,
        sinyalRoleBit: roleBaris?.sinyalRoleBit || 0,
        temuanCatatan: gabungCatatanTemuan(meta.cityCatatan, buktiF2?.catatan, roleBaris?.temuanCatatan),
        statusAnalisa: statusBaris,
        // D3 + C3 + M1: otomatis-final hanya untuk baris Fase 2 yang benar-benar
        // OTOMATIS_VALID, penempatannya TERBUKTI (kode pos + kecamatan), bukan hasil
        // fallback, dan Fase 3-nya EXACT_MATCH.
        isFinalApproved:
          fase3Jalan &&
          statusBaris === 'EXACT_MATCH' &&
          fase2Status === 'OTOMATIS_VALID' &&
          meta.placementStatus === 'VERIFIED' &&
          !hanyaBuktiFonetik(meta.citySinyalBit) &&
          !meta.usedFallback,
      });
    });
  }

  // Progres tahap akhir — dilaporkan untuk fase yang memang sedang dijalankan.
  const faseAkhir = sampaiFase as 1 | 2 | 3;
  const labelFaseAkhir = `Fase ${sampaiFase}`;
  if (onProgress) onProgress(faseAkhir, 70, total, total, `${labelFaseAkhir}: Finalisasi & menyusun hasil...`);

  // Small async yield to allow UI to breathe
  await new Promise((resolve) => setTimeout(resolve, 0));

  if (onProgress) onProgress(faseAkhir, 95, total, total, `${labelFaseAkhir}: Menyusun hasil akhir...`);

  // Small async yield again
  await new Promise((resolve) => setTimeout(resolve, 0));

  const elapsed = Math.round(performance.now() - startTime);
  // Sisa = baris yang tidak terlampir ke item mana pun bahkan setelah jaring pengaman
  const leftoverRowCount = leftoverNoCity + Array.from(leftoverByCity.values()).reduce((n, es) => n + es.length, 0);
  const mappedKodePos = kodePosList.length - leftoverRowCount;
  const unmappedKodePos = Math.max(0, leftoverRowCount);
  const verifiedRows = Math.max(0, verifiedKodePosRows - reviewRow);
  // AKUNTANSI PERSIS: SEMUA baris Master KodePos yang tidak ikut masuk hasil
  // wajib muncul di tab "Perlu Analisa Manual" — tidak ada baris hilang diam-diam
  // (termasuk baris yang tersaring blok provinsi dari kota yang sudah terpetakan).
  const unmappedCities: CoverageCity[] = [];
  const unanalysedRows: AnalystRow[] = [];
  leftoverByCity.forEach((entries, ck) => {
    unmappedCities.push({
      city: entries[0]?.kabupatenKota || ck,
      rows: entries.length,
      status: 'REVIEW',
      sampleKodePos: entries[0]?.kodePos || '',
      provinsi: entries[0]?.provinsi || '',
    });
    // Sertakan baris mentahnya supaya bisa dianalisa manual (bukan dibuang diam-diam)
    entries.forEach((e, seq) => {
      const ptenKota = ptenKotaByCode.get(String(e.kodePos || '').trim());
      unanalysedRows.push({
        id: `analyst-na-${ck}-${seq + 1}-${Date.now()}`,
        no: 0,
        kotaPten: '',
        kodePosPten: e.kodePos,
        kodePosKelurahan: e.kodePos,
        kelurahan: e.kelurahan || '',
        kecamatan: e.kecamatan || '',
        provinsi: e.provinsi || '',
        statusPten: ptenKota ? 'PTEN FOUND' : 'UNCHECKED',
        placementStatus: 'REVIEW',
        placementMethod: ptenKota
          ? `Kode pos ${e.kodePos} ada di PTEN (kota "${ptenKota}") tapi nama kota master berbeda`
          : 'Kota/Kabupaten tidak ada di data PTEN',
        groupKota: e.kabupatenKota || ck,
        kategori: 'TIDAK_ANALISA',
        fase1Approved: false,
        sourceRowIndex: -1,
        allKelurahanCount: entries.length,
        kelurahanSeq: seq + 1,
        wilayah: '',
        kotaPtenMax15: '',
        sandiCabang: '',
        sandi: '',
        cabang: '',
        branchCode: '',
        kodeCabang: '',
        namaOutlet: '',
        statusOutlet: '',
        alamat: '',
        fase2Approved: false,
        fase2JarakKm: 0,
        fase2Tier: 3,
        fase2Temuan: [],
        organisasiTujuan: '',
        tipeUnit: 'OUTLET',
        is3RoleLengkap: false,
        roleCabsal: 0,
        roleCabapv1: 0,
        roleCabapv2: 0,
        roleGrandTotal: 0,
        alurWondr: '',
        flowDescription: '',
        fase3Approved: false,
        confidenceScore: 0,
        matchingAlgorithm: ptenKota
          ? 'Belum dianalisa (kode pos ada di PTEN, nama kota beda)'
          : 'Belum dianalisa (kota tidak ada di PTEN)',
        statusAnalisa: 'PERLU_REVIEW',
        isFinalApproved: false,
      });
    });
  });
  unmappedCities.sort((a, b) => b.rows - a.rows);
  unanalysedRows.sort((a, b) => a.groupKota.localeCompare(b.groupKota) || a.kelurahan.localeCompare(b.kelurahan));
  const coverage: AnalystCoverage = {
    kodePosTotal: kodePosList.length,
    kodePosMapped: mappedKodePos,
    verifiedRows,
    reviewRows: reviewRow,
    resultRows: results.length,
    unanalysedRows: unanalysedRows.length,
    unmappedCities,
    includedCities: Array.from(includedCityMap.values()).sort((a, b) => b.rows - a.rows),
    mergedCities: Array.from(mergedCityMap.values()).sort((a, b) => b.rows - a.rows),
    // G3: baris yang dilewati karena sudah ada di Final Data.
    skippedFinalRows: skippedFinalCount,
    skippedFinalSamples: skippedFinalSampleList,
  };
  unanalysedRows.forEach((r) => { r.no = globalRowNo++; });
  results.push(...unanalysedRows);
  const fmt = (n: number) => n.toLocaleString('id-ID');
  if (onProgress) {
    onProgress(faseAkhir, 100, total, total, `Fase ${sampaiFase} selesai dalam ${elapsed}ms. ${fmt(results.length)} baris dihasilkan. ` +
      `KodePos terpetakan ${fmt(mappedKodePos)}/${fmt(kodePosList.length)} — terbukti geocode ${fmt(verifiedRows)}` +
      `${reviewRow > 0 ? `, perlu review ${fmt(reviewRow)}` : ''}` +
      `${kodePosClaimCities > 0 ? `, ${kodePosClaimCities} kota ditarik lewat kode pos persis` : ''}` +
      `${kodePosConflictCities > 0 ? `, ${kodePosConflictCities} kota ditandai konflik kode pos` : ''}` +
      `${safetyNetCities > 0 ? `, jaring pengaman: ${fmt(safetyNetRows)} baris dari ${safetyNetCities} kota sisa dilampirkan` : ''}` +
      `${unmappedKodePos > 0 ? `, belum masuk ${fmt(unmappedKodePos)} di ${unmappedCities.length} kota (kotanya tidak ada di PTEN)` : ''}` +
      `${reviewCityCount > 0 ? `. Kota perlu review manual: ${reviewCityCount}` : ''}` +
      `${fallbackCityCount > 0 ? `. Kota tanpa data kodepos (baris fallback): ${fallbackCityCount}` : ''}` +
      `${mergedCityMap.size > 0 ? `. Perhatian: ${mergedCityMap.size} nama kota menampung KOTA sekaligus KABUPATEN, kelurahannya digabung jadi satu grup (lihat daftar "kota kembar" di laporan cakupan)` : ''}.`);
  }

  // Bagian akhir (jaring pengaman & laporan cakupan) tidak selalu melewati `tick()`,
  // jadi batal masih dihormati sampai di sini.
  if (pembatal?.batal) throw new AnalisaDibatalkan();

  return { rows: results, coverage };
}
