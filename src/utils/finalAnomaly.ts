import type { AnalystRow } from './analystPipeline';
import type { MasterRow } from '../types';
import { getIslandFromProvinsi } from './roleMatcher';
import { cleanProvinsi } from './normalizer';

// ─── SATU definisi anomali Final Data, dipakai kartu Dashboard & panel Peta ───
// Sebuah baris dianggap anomali bila melanggar salah satu aturan penempatan:
//  • PULAU      → cabang penempatan beda pulau dengan asal data (Aceh→KIM dikecualikan)
//  • PROVINSI   → cabang penempatan beda provinsi (masih satu pulau pun tetap dilaporkan)
//  • STATUS     → status analisa ANOMALI / PERLU_REVIEW
//  • PENEMPATAN → kelurahan/kecamatan→kota belum terbukti / pakai fallback
//  • ROLE       → cabang 3 role belum lengkap
export type AnomalyCategory = 'PULAU' | 'PROVINSI' | 'STATUS' | 'PENEMPATAN' | 'ROLE';

export interface FinalAnomaly {
  row: AnalystRow;
  categories: AnomalyCategory[];
  /** kategori utama untuk badge tunggal (urutan prioritas) */
  primary: AnomalyCategory;
  reasons: string[];
}

const PRIORITY: AnomalyCategory[] = ['PULAU', 'PROVINSI', 'STATUS', 'PENEMPATAN', 'ROLE'];

/** Label, arti dan warna satu kategori anomali — dipakai kartu Dashboard dan panel Peta. */
export const KATEGORI_ANOMALI: Record<AnomalyCategory, { label: string; arti: string; bg: string; color: string; border: string }> = {
  PULAU: { label: 'Beda Pulau', arti: 'Cabang yang dipasang berada di pulau berbeda dengan pulau asal data.', bg: '#fdeae5', color: '#991b1b', border: '#f87171' },
  PROVINSI: { label: 'Beda Provinsi', arti: 'Provinsi cabang terpasang berbeda dari provinsi asal data (masih satu pulau pun tetap dilaporkan).', bg: '#ffedd5', color: '#9a3412', border: '#fb923c' },
  STATUS: { label: 'Status Analisa', arti: 'Mesin analisa menandai baris ini ANOMALI atau PERLU REVIEW karena keyakinannya rendah.', bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  PENEMPATAN: { label: 'Penempatan', arti: 'Pemetaan kelurahan/kecamatan ke kota belum terbukti dari blok kode pos (REVIEW) atau memakai fallback.', bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  ROLE: { label: 'Role', arti: 'Cabang terpasang belum punya 3 role lengkap: Sales, Verifikator, dan Penyetuju.', bg: '#fef3c7', color: '#92400e', border: '#f7b84b' },
};

/** Urutan pentingnya kategori — dipakai untuk menyortir daftar anomali. */
export const URUTAN_KATEGORI = PRIORITY;

const isAcehText = (s: string) => /ACEH|NANGGROE|\bNAD\b/.test(String(s || '').toUpperCase());

/**
 * Peta provinsi & pulau KANTOR cabang, di-resolusi dari Data Cabang.
 *
 * Baris Data Final tidak menyimpan provinsi cabang — yang tersimpan hanya nama outlet
 * dan kode cabangnya. SATU-SATUNYA tempat kelas "beda provinsi / beda pulau" dihitung,
 * supaya kartu anomali, saringan grid dan gerbang setujui massal membaca angka yang sama.
 */
export interface IndeksWilayahCabang {
  islandByOutlet: Map<string, string>;
  islandByKode: Map<string, string>;
  provinsiByOutlet: Map<string, string>;
  provinsiByKode: Map<string, string>;
  islandByPasangan: Map<string, string>;
  provinsiByPasangan: Map<string, string>;
  /** Kunci yang dipakai bersama >1 provinsi: tidak boleh membuktikan apa pun. */
  outletRagu: Set<string>;
  kodeRagu: Set<string>;
}

/**
 * Kunci → provinsi, HANYA bila kuncinya tidak ambigu. Nama outlet dan kode cabang sama-sama
 * berulang di Data Cabang: `VETERAN` ada dua (Kota Surakarta/Jawa Tengah kode SRS, dan
 * Makassar/Sulawesi Selatan kode MAT). Dulu yang menang penulis pertama, sehingga 7 baris
 * Solo → VETERAN (SRS) yang benar ikut dituduh nyebrang ke Sulawesi. Kunci yang menampung
 * lebih dari satu provinsi dibuat tidak dikenal — tanpa bukti wilayah gerbangnya diam,
 * bukan menebak dan menahan baris yang benar.
 */
function catatWilayah(
  kunci: string,
  provinsi: string,
  island: string,
  olehKunci: Map<string, string>,
  olehPulau: Map<string, string>,
  provinsiPerKunci: Map<string, Set<string>>
) {
  if (!kunci || !provinsi) return;
  const himpunan = provinsiPerKunci.get(kunci) || new Set<string>();
  provinsiPerKunci.set(kunci, himpunan);
  himpunan.add(provinsi);
  if (himpunan.size > 1) { olehKunci.delete(kunci); olehPulau.delete(kunci); return; }
  if (!olehKunci.has(kunci)) { olehKunci.set(kunci, provinsi); olehPulau.set(kunci, island); }
}

export function indeksWilayahCabang(masterRows: readonly MasterRow[]): IndeksWilayahCabang {
  const idx: IndeksWilayahCabang = {
    islandByOutlet: new Map(), islandByKode: new Map(),
    provinsiByOutlet: new Map(), provinsiByKode: new Map(),
    islandByPasangan: new Map(), provinsiByPasangan: new Map(),
    outletRagu: new Set(), kodeRagu: new Set(),
  };
  const provinsiPerOutlet = new Map<string, Set<string>>();
  const provinsiPerKode = new Map<string, Set<string>>();
  const provinsiPerPasangan = new Map<string, Set<string>>();
  for (const m of masterRows) {
    const island = getIslandFromProvinsi(m.Provinsi, m['Dati II'], `${m.Kelurahan} ${m.Kecamatan}`);
    const provinsi = cleanProvinsi(m.Provinsi);
    const no = String(m['Nama Outlet'] || '').trim().toUpperCase();
    const kc = String(m['Kode Cabang'] || m['Branch Code'] || '').trim();
    catatWilayah(no, provinsi, island, idx.provinsiByOutlet, idx.islandByOutlet, provinsiPerOutlet);
    catatWilayah(kc, provinsi, island, idx.provinsiByKode, idx.islandByKode, provinsiPerKode);
    catatWilayah(no && kc ? `${no}|${kc}` : '', provinsi, island, idx.provinsiByPasangan, idx.islandByPasangan, provinsiPerPasangan);
  }
  provinsiPerOutlet.forEach((p, k) => { if (p.size > 1) idx.outletRagu.add(k); });
  provinsiPerKode.forEach((p, k) => { if (p.size > 1) idx.kodeRagu.add(k); });
  return idx;
}

/** Baris yang cukup untuk menilai wilayah; field lain tidak dibaca. */
export type BarisWilayahCabang = Pick<AnalystRow, 'namaOutlet' | 'kodeCabang' | 'branchCode' | 'provinsi' | 'kotaPten' | 'kotaPtenMax15' | 'kelurahan' | 'kecamatan'>
  & Partial<Pick<AnalystRow, 'fase2Sumber'>>;

/**
 * Apakah kantor yang terpasang duduk di luar wilayah asal baris?
 * Aceh dikecualikan: penempatan ke Cabang KIM memang lintas kota di sana, dan itu
 * aturan resmi (`aturanAceh` di pipeline, `fase2Sumber = ATURAN_ACEH_KIM`).
 * Kantor yang tidak dikenal di Data Cabang mengembalikan false — tanpa bukti provinsi
 * tidak ada yang boleh dilarang.
 */
export function lintasWilayahCabang(
  r: BarisWilayahCabang,
  idx: IndeksWilayahCabang
): { provinsi: boolean; pulau: boolean; provinsiBaris: string; provinsiCabang: string; pulauBaris: string; pulauCabang: string } {
  const teks = `${r.provinsi} ${r.kotaPten} ${r.kotaPtenMax15} ${r.kelurahan} ${r.kecamatan}`;
  const kosong = { provinsi: false, pulau: false, provinsiBaris: '', provinsiCabang: '', pulauBaris: '', pulauCabang: '' };
  if (isAcehText(teks) || r.fase2Sumber === 'ATURAN_ACEH_KIM') return kosong;
  const outletKey = String(r.namaOutlet || '').trim().toUpperCase();
  const kodeKey = String(r.kodeCabang || r.branchCode || '').trim();
  const pulauBaris = getIslandFromProvinsi(r.provinsi, r.kotaPtenMax15 || r.kotaPten, `${r.kelurahan} ${r.kecamatan}`);
  const provinsiBaris = cleanProvinsi(r.provinsi);
  // Urutan bukti: pasangan nama+kode (paling spesifik) → nama → kode. Kunci yang dipakai
  // bersama lebih dari satu provinsi dilewati; ia tidak membuktikan apa-apa.
  const pasangan = outletKey && kodeKey ? `${outletKey}|${kodeKey}` : '';
  const ambil = (peta: Map<string, string>, kunci: string, ragu: boolean) => (kunci && !ragu ? peta.get(kunci) : undefined);
  const provinsiCabang =
    idx.provinsiByPasangan.get(pasangan) ??
    ambil(idx.provinsiByOutlet, outletKey, idx.outletRagu.has(outletKey)) ??
    ambil(idx.provinsiByKode, kodeKey, idx.kodeRagu.has(kodeKey)) ??
    '';
  const pulauCabang =
    idx.islandByPasangan.get(pasangan) ??
    ambil(idx.islandByOutlet, outletKey, idx.outletRagu.has(outletKey)) ??
    ambil(idx.islandByKode, kodeKey, idx.kodeRagu.has(kodeKey)) ??
    '';
  return {
    provinsi: !!(provinsiCabang && provinsiBaris && provinsiCabang !== provinsiBaris),
    pulau: !!(pulauCabang && pulauBaris !== 'Lainnya' && pulauCabang !== 'Lainnya' && pulauBaris !== pulauCabang),
    provinsiBaris, provinsiCabang, pulauBaris, pulauCabang,
  };
}

/**
 * Bentuk singkat untuk gerbang (setujui massal, saringan grid) yang hanya perlu ya/tidak.
 * Alasannya harus tetap dibaca dari `lintasWilayahCabang()` bila akan ditampilkan.
 */
export function nyebrangWilayahCabang(r: BarisWilayahCabang, idx: IndeksWilayahCabang): boolean {
  const w = lintasWilayahCabang(r, idx);
  return w.provinsi || w.pulau;
}

export function detectFinalAnomalies(finalRows: AnalystRow[], masterRows: MasterRow[]): FinalAnomaly[] {
  // Peta pulau & provinsi cabang di-resolusi dari Master (baris final tidak menyimpan
  // provinsi cabang — yang tersimpan hanya nama outlet / kode cabangnya).
  const idx = indeksWilayahCabang(masterRows);

  const out: FinalAnomaly[] = [];
  for (const r of finalRows) {
    const cats: AnomalyCategory[] = [];
    const reasons: string[] = [];

    // Baris yang BELUM pernah dianalisa tidak bisa disebut "penempatannya belum terbukti"
    // atau "role-nya belum lengkap" — kolom itu memang belum diisi sama sekali.
    // Dulu keduanya ikut dihitung, sehingga kartu TOTAL ANOMALI menunjukkan seluruh
    // isi Data Final (83.764 dari 83.764) dan angkanya tidak ada gunanya lagi.
    // Yang sudah diproses tetap dinilai penuh seperti sebelumnya.
    const sudahDianalisa = r.statusAnalisa !== 'MENUNGGU';

    // Aceh dikecualikan di dalam lintasWilayahCabang(): penempatan ke Cabang KIM memang
    // lintas kota di sana. Predikat yang SAMA dipakai gerbang setujui massal dan saringan
    // grid, jadi angka kartu tidak bisa menyimpang dari baris yang benar-benar tertahan.
    const wilayah = lintasWilayahCabang(r, idx);
    if (wilayah.pulau) {
      cats.push('PULAU');
      reasons.push(`Penempatan beda pulau: asal ${wilayah.pulauBaris} → cabang ${wilayah.pulauCabang}`);
    }
    // Lebih spesifik dari PULAU: beda provinsi tapi masih satu pulau (mis. Jawa Barat
    // → Jawa Tengah) selama ini lolos, padahal itu justru yang mau dilihat operator.
    if (wilayah.provinsi) {
      cats.push('PROVINSI');
      reasons.push(`Penempatan beda provinsi: asal ${wilayah.provinsiBaris.toUpperCase()} → cabang ${wilayah.provinsiCabang.toUpperCase()}`);
    }

    if (r.statusAnalisa === 'ANOMALI') {
      cats.push('STATUS');
      reasons.push('Status analisa ANOMALI');
    } else if (r.statusAnalisa === 'PERLU_REVIEW') {
      cats.push('STATUS');
      reasons.push('Status analisa PERLU REVIEW (keyakinan rendah)');
    }

    if (r.placementStatus === 'REVIEW') {
      cats.push('PENEMPATAN');
      reasons.push(`Penempatan kelurahan/kecamatan → kota belum terbukti (${r.placementMethod || 'metode review'})`);
    } else if (r.placementStatus === 'FALLBACK') {
      cats.push('PENEMPATAN');
      reasons.push('Penempatan memakai fallback (tanpa bukti blok kode pos)');
    }

    if (sudahDianalisa && !r.is3RoleLengkap) {
      cats.push('ROLE');
      reasons.push(`Role belum lengkap ${r.roleGrandTotal}/3 (Sales ${r.roleCabsal}, Verifikator ${r.roleCabapv1}, Penyetuju ${r.roleCabapv2})`);
    }

    if (cats.length > 0) {
      out.push({ row: r, categories: cats, primary: PRIORITY.find((p) => cats.includes(p))!, reasons });
    }
  }
  return out;
}
