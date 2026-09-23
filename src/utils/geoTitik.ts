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

/** Angka 5 digit paling ujung — kode pos di Excel sering bawa spasi atau teks lain. */
export function kodePosLima(nilai: unknown): string {
  const angka = String(nilai ?? '').replace(/\D/g, '');
  return angka.length >= 5 ? angka.slice(-5) : '';
}

export type StatusTitik = 'OK' | 'REVIEW' | 'ANOMALI';

/** Satu pasangan titik: kode pos tujuan, koordinatnya, dan berapa baris Data Final lewat. */
export interface KoneksiTitik {
  kode: string;
  lat: number;
  lng: number;
  baris: number;
  outlet: string;
}

/** Bentuk minimal baris Data Final yang dibutuhkan jembatan titik. */
export interface BarisJembatan {
  kodePosPten?: string | null;
  kodePosKelurahan?: string | null;
  namaOutlet?: string | null;
  statusAnalisa?: string;
  placementStatus?: string;
  is3RoleLengkap?: boolean;
}

/**
 * Jembatan dua arah antar TITIK kode pos, dibuat dari Data Final.
 *
 * Satu baris Data Final menyimpan dua kode pos: `kodePosPten` (kode kota dari PTEN) dan
 * `kodePosKelurahan` (kode pos tempat outlet itu benar-benar berada). Keduanya punya
 * koordinat di Data Kode Pos, jadi garis lengkung dari titik mana pun ke pasangannya
 * selalu berakhir di koordinat nyata — bukan hasil geocoding internet.
 *
 * Terukur di cloud 2026-09-24 (51.500 dari 83.748 baris final): 96,6% kedua ujungnya
 * ada titiknya dan 92,3% kedua ujungnya BERBEDA, jadi garisnya punya panjang.
 *
 * Sekaligus dihitung status terburuk per titik supaya peta bisa mewarnai titik kode pos
 * sesuai hasil analisa.
 */
export function bangunJembatanKodePos(
  rows: readonly BarisJembatan[],
  titik: Record<string, { lat: number; lng: number }>
): { koneksi: Map<string, KoneksiTitik[]>; status: Map<string, StatusTitik> } {
  const agregat = new Map<string, Map<string, KoneksiTitik>>();
  const status = new Map<string, StatusTitik>();

  const catatStatus = (kode: string, r: BarisJembatan) => {
    const baru: StatusTitik =
      r.statusAnalisa === 'ANOMALI' ? 'ANOMALI'
      : r.placementStatus !== 'VERIFIED' || r.statusAnalisa === 'PERLU_REVIEW' || r.is3RoleLengkap === false ? 'REVIEW'
      : 'OK';
    const lama = status.get(kode);
    if (!lama || (lama === 'OK' && baru !== 'OK') || (lama === 'REVIEW' && baru === 'ANOMALI')) status.set(kode, baru);
  };

  const tambah = (dari: string, ke: string, lat: number, lng: number, r: BarisJembatan) => {
    let dalam = agregat.get(dari);
    if (!dalam) { dalam = new Map(); agregat.set(dari, dalam); }
    const ada = dalam.get(ke);
    if (ada) { ada.baris++; return; }
    dalam.set(ke, { kode: ke, lat, lng, baris: 1, outlet: String(r.namaOutlet || '').trim() || '-' });
  };

  for (const r of rows) {
    const a = kodePosLima(r.kodePosPten);
    const b = kodePosLima(r.kodePosKelurahan);
    if (a) catatStatus(a, r);
    if (b && b !== a) catatStatus(b, r);
    if (!a || !b || a === b) continue;
    const ta = titik[a];
    const tb = titik[b];
    if (!ta || !tb) continue;
    tambah(a, b, tb.lat, tb.lng, r);
    tambah(b, a, ta.lat, ta.lng, r);
  }

  const koneksi = new Map<string, KoneksiTitik[]>();
  agregat.forEach((dalam, dari) => {
    koneksi.set(dari, [...dalam.values()].sort((x, y) => y.baris - x.baris));
  });
  return { koneksi, status };
}
