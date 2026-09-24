import { cityMatchKey } from './analystPipeline';
import { textSimilarityScore, normalizeKodePos } from './normalizer';

/**
 * Tabrakan nama kota: berkas PTEN vs Master Kode Pos.
 *
 * Fase 1 mencari kelurahan sebuah kota PTEN di Master Kode Pos lewat kunci kota
 * (`cityMatchKey`). Kalau namanya beda spasi/ejaan, kuncinya tidak ketemu dan SELURUH
 * kelurahan kota itu tidak pernah ikut analisa — tanpa pesan error apa pun.
 *
 * Terukur di cloud 2026-09-24: 25 kota Master Kode Pos (2.567 dari 83.747 kelurahan,
 * ~3%) tidak punya pasangan di PTEN, dan 16 nama PTEN tidak dikenal Master Kode Pos.
 * Sebagian besar cuma beda spasi: "PEM SIANTAR" vs "PEMATANGSIANTAR", "BATANG HARI" vs
 * "BATANGHARI", "GUNUNG KIDUL" vs "GUNUNGKIDUL".
 *
 * Yang TIDAK dilaporkan di sini: beda jumlah blok kode pos per kota. Satu kota PTEN
 * dipecah ke semua kelurahan kota itu (kunci = nama kota, bukan blok), jadi blok yang
 * tidak disebut PTEN tetap teranalisa — itu catatan kualitas data, bukan kehilangan.
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

/** Satu kota yang hanya dikenal satu tabel. */
export interface KotaTanpaPadanan {
  kunci: string;
  /** Nama mentah persis seperti tertulis di tabelnya. */
  nama: string[];
  /** Jumlah kelurahan (sisi Master Kode Pos) atau baris (sisi PTEN) yang terdampak. */
  terdampak: number;
  /** Kunci paling mirip di tabel seberang, kalau ada. */
  padanan?: { kunci: string; kemiripan: number } | null;
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
  /** Kota Master Kode Pos yang tidak pernah disebut PTEN — kelurahannya tidak teranalisa. */
  tanpaPten: KotaTanpaPadanan[];
  /** Nama di PTEN yang kuncinya tidak ada di Master Kode Pos — kotanya cari kelurahan kosong. */
  tanpaKodePos: KotaTanpaPadanan[];
  /** Kunci sama, isi beda: ejaan ganda (SURAKARTA/SOLO) atau blok tidak sejajar. */
  bedaBlok: KotaBedaBlok[];
  kelurahanTerhenti: number;
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
    const kunci = cityMatchKey(r.kotaPtenMax15 || r.kotaPten);
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
    kelurahanTerhenti: tanpaPten.reduce((n, k) => n + k.terdampak, 0),
    totalKunciPten: keranjangPten.size,
    totalKunciKodePos: keranjangKp.size,
  };
}
