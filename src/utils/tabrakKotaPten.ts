import { cityMatchKey } from './analystPipeline';
import { textSimilarityScore, normalizeKodePos } from './normalizer';

/**
 * Tabrakan nama kota: berkas PTEN vs Master Kode Pos.
 *
 * Fase 1 mencari kelurahan sebuah kota PTEN di Master Kode Pos lewat kunci kota
 * (`cityMatchKey`). Kalau namanya beda spasi/ejaan, kuncinya tidak ketemu.
 *
 * Terukur di cloud 2026-09-24: 33 kota Master Kode Pos (3.016 dari 83.747 kelurahan)
 * tidak punya pasangan kunci di PTEN, dan 25 nama PTEN tidak dikenal Master Kode Pos.
 *
 * Yang TIDAK terjadi: kelurahannya hilang. Dicek ke 83.748 baris Data Final, ke-33 kota
 * semuanya tetap masuk — jaring pengaman Tier A/B (`analystPipeline.ts:1913`) menautkan
 * kelurahan bermodal bukti kode pos, bukan nama. Yang salah adalah **kota mana yang
 * memakainya**: 21 dari 33 kota ikut teranalisa di bawah nama kota PTEN yang mirip atau
 * induknya, sehingga "KODE POS PTEN" + Dati II mereka milik induknya — BANGGAI LAUT ←
 * "BANGGAI KEP", BUTON SELATAN dan BUTON TENGAH ← "BUTON", KOLAKA TIMUR ← "KOLAKA",
 * MAHAKAM ULU ← "KUTAI BARAT". Itulah akar keluhan "kode pos di Data Final bukan kode
 * pos kotanya sendiri".
 *
 * Penggerak Fase 1 (`analystPipeline.ts:1215`, `ptenCityMap`) memakai `kotaPten` penuh
 * sebagai kunci, BUKAN `kotaPtenMax15` — laporan ini ikut aturan itu supaya yang tampil
 * adalah apa yang benar-benar dilihat pipeline.
 *
 * Kedua kolom salahnya berlawanan arah, jadi membaca yang salah = melapor yang salah:
 *  · max15 memotong nama → 4 kota / 705 kelurahan seolah tak berpasaangan padahal nama
 *    lengkapnya cocok ("MANDAILING NATAL" → "MANDAILING NATA", "PENAJAM PASER UTARA" →
 *    "PENAJAM PASER U");
 *  · max15 menyimpan singkatan yang justru dijabarkan `cityMatchKey` → 12 kota / 1.154
 *    kelurahan tampak berpasangan lewat max15 walau `kotaPten`-nya dicoret catatan
 *    ("BOLAANG MONGONDOW (BOLMONG)" + max15 "BOLMONG", "SELAYAR (KEPULAUAN SELAYAR)" +
 *    max15 "KEP SELAYAR", "LIMA PULUH KOTO / KOTA").
 */

export interface PtenKotaLike {
  kodePosPten: string;
  kotaPten: string;
  kotaPtenMax15?: string;
}

export interface KodePosKotaLike {
  kodePos: string;
  kabupatenKota: string;
}

/** Satu kota yang kuncinya hanya dikenal satu tabel. */
export interface KotaTanpaPadanan {
  kunci: string;
  /** Nama mentah persis seperti tertulis di tabelnya. */
  nama: string[];
  /** Jumlah kelurahan (sisi Master Kode Pos) atau baris (sisi PTEN) yang memakai kunci ini. */
  terdampak: number;
  /** Kunci paling mirip di tabel seberang. Hanya dugaan — tidak ada yang digabung di sini. */
  padanan?: { kunci: string; kemiripan: number } | null;
  /**
   * Kunci ini sebenarnya sudah tercatat di kolom MAX 15 berkas PTEN. Untuk kota-kota ini
   * ejaan bakunya tinggal diambil dari kolom yang sudah ada; kosong berarti namanya memang
   * tidak pernah disebut PTEN.
   */
  dariKolomLain?: string[];
}

/** Kunci kota yang ada di dua tabel tapi nama/bloknya tidak sama. */
export interface KotaBedaBlok {
  kunci: string;
  namaPten: string[];
  namaKodePos: string[];
  hanyaDiPten: string[];
  hanyaDiKodePos: string[];
}

export interface HasilTabrakKota {
  /** Nama Master Kode Pos yang kuncinya tidak ada di PTEN. */
  tanpaPten: KotaTanpaPadanan[];
  /** Nama PTEN yang kuncinya tidak ada di Master Kode Pos. */
  tanpaKodePos: KotaTanpaPadanan[];
  /** Kunci sama, isi beda: ejaan ganda (SURAKARTA/SOLO) atau blok tidak sejajar. */
  bedaBlok: KotaBedaBlok[];
  /** Kelurahan dari kota yang namanya tidak ketemu — TETAP teranalisa, lihat catatan di atas. */
  kelurahanBedaNama: number;
  /** Bagian dari itu yang ejaan bakunya sudah ada di kolom MAX 15 PTEN. */
  kelurahanAdaDiMax15: number;
  totalKunciPten: number;
  totalKunciKodePos: number;
}

interface KeranjangKota {
  nama: Set<string>;
  blok: Set<string>;
  kelurahan: number;
}

const isiKeranjang = (m: Map<string, KeranjangKota>, kunci: string): KeranjangKota => {
  let k = m.get(kunci);
  if (!k) { k = { nama: new Set(), blok: new Set(), kelurahan: 0 }; m.set(kunci, k); }
  return k;
};

/** Cari kunci paling mirip di tabel seberang; null kalau tidak meyakinkan. */
function padananTerdekat(kunci: string, lawan: Iterable<string>): KotaTanpaPadanan['padanan'] {
  let terbaik: { kunci: string; kemiripan: number } | null = null;
  for (const k of lawan) {
    const skor = textSimilarityScore(kunci, k);
    if (skor >= 0.6 && (!terbaik || skor > terbaik.kemiripan)) terbaik = { kunci: k, kemiripan: skor };
  }
  return terbaik;
}

export function tabrakKotaPtenKodePos(
  pten: readonly PtenKotaLike[],
  kodePos: readonly KodePosKotaLike[]
): HasilTabrakKota {
  const keranjangPten = new Map<string, KeranjangKota>();
  const keranjangKp = new Map<string, KeranjangKota>();

  for (const r of pten) {
    const kunci = cityMatchKey(r.kotaPten || r.kotaPtenMax15 || '');
    if (!kunci) continue;
    const keranjangIni = isiKeranjang(keranjangPten, kunci);
    keranjangIni.nama.add(String(r.kotaPten || '').trim().toUpperCase());
    const blok = normalizeKodePos(r.kodePosPten);
    if (blok) keranjangIni.blok.add(blok);
    keranjangIni.kelurahan++;
  }

  for (const r of kodePos) {
    const kunci = cityMatchKey(r.kabupatenKota);
    if (!kunci) continue;
    const keranjangIni = isiKeranjang(keranjangKp, kunci);
    keranjangIni.nama.add(String(r.kabupatenKota || '').trim().toUpperCase());
    const blok = normalizeKodePos(r.kodePos);
    if (blok) keranjangIni.blok.add(blok);
    keranjangIni.kelurahan++;
  }

  // Kunci yang hanya lahir dari kolom MAX 15 — bukti ejaan bakunya ada di berkas PTEN
  // sendiri, cuma tidak dibaca oleh kunci nama lengkap.
  const namaLainDariPten = new Map<string, Set<string>>();
  for (const r of pten) {
    const kunciPenuh = cityMatchKey(r.kotaPten || '');
    const kunciLain = cityMatchKey(r.kotaPtenMax15 || '');
    if (!kunciLain || kunciLain === kunciPenuh) continue;
    if (!namaLainDariPten.has(kunciLain)) namaLainDariPten.set(kunciLain, new Set());
    namaLainDariPten.get(kunciLain)!.add(String(r.kotaPtenMax15 || '').trim().toUpperCase());
  }

  const tanpaPten: KotaTanpaPadanan[] = [];
  const tanpaKodePos: KotaTanpaPadanan[] = [];
  const bedaBlok: KotaBedaBlok[] = [];

  for (const [kunci, kp] of keranjangKp) {
    const pt = keranjangPten.get(kunci);
    if (!pt) {
      tanpaPten.push({
        kunci,
        nama: [...kp.nama].sort(),
        terdampak: kp.kelurahan,
        padanan: padananTerdekat(kunci, keranjangPten.keys()),
        dariKolomLain: [...(namaLainDariPten.get(kunci) ?? [])].sort(),
      });
      continue;
    }
    const hanyaDiPten = [...pt.blok].filter((b) => !kp.blok.has(b)).sort();
    const hanyaDiKodePos = [...kp.blok].filter((b) => !pt.blok.has(b)).sort();
    if (hanyaDiPten.length === 0 && hanyaDiKodePos.length === 0 && pt.nama.size < 2) continue;
    bedaBlok.push({
      kunci,
      namaPten: [...pt.nama].sort(),
      namaKodePos: [...kp.nama].sort(),
      hanyaDiPten,
      hanyaDiKodePos,
    });
  }

  for (const [kunci, pt] of keranjangPten) {
    if (keranjangKp.has(kunci)) continue;
    tanpaKodePos.push({
      kunci,
      nama: [...pt.nama].sort(),
      terdampak: pt.kelurahan,
      padanan: padananTerdekat(kunci, keranjangKp.keys()),
    });
  }

  tanpaPten.sort((a, b) => b.terdampak - a.terdampak || (a.kunci < b.kunci ? -1 : 1));
  tanpaKodePos.sort((a, b) => b.terdampak - a.terdampak || (a.kunci < b.kunci ? -1 : 1));
  bedaBlok.sort((a, b) =>
    (b.hanyaDiPten.length + b.hanyaDiKodePos.length) - (a.hanyaDiPten.length + a.hanyaDiKodePos.length) ||
    (a.kunci < b.kunci ? -1 : 1));

  return {
    tanpaPten,
    tanpaKodePos,
    bedaBlok,
    kelurahanBedaNama: tanpaPten.reduce((n, k) => n + k.terdampak, 0),
    kelurahanAdaDiMax15: tanpaPten.reduce(
      (n, k) => n + (k.dariKolomLain && k.dariKolomLain.length ? k.terdampak : 0), 0),
    totalKunciPten: keranjangPten.size,
    totalKunciKodePos: keranjangKp.size,
  };
}
