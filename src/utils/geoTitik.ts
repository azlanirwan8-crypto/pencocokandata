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

/**
 * Angka 5 digit paling ujung — kode pos di Excel sering bawa spasi atau teks lain.
 * Pernah dicoba jalur cepat tanpa `+s`; terukur justru lebih lambat (10,5 ms vs 7,8 ms
 * untuk 167.496 panggilan pada 83.748 baris asli), jadi versi regex yang dipertahankan.
 */
export function kodePosLima(nilai: unknown): string {
  const angka = String(nilai ?? '').replace(/\D/g, '');
  return angka.length >= 5 ? angka.slice(-5) : '';
}

/** Isi satu sel layar: pin yang jatuh di dalamnya + jumlah lat/lng untuk titik tengah. */
export interface SelLayar<T> {
  kunci: string;
  pins: T[];
  sumLat: number;
  sumLng: number;
}

/**
 * Bagi pin ke sel layar `cellPx`, HANYA yang terlihat di kanvas.
 *
 * Inilah yang menjaga peta tetap ringan. Tanpa pembuangan pin di luar layar, clustering
 * tetap membuat marker untuk seluruh negeri: di zoom kota 10.596 titik kode pos jadi
 * ribuan node DOM dan geser/zoom patah-patah. Setelah disaring, jumlah node dibatasi
 * luas kanvas / `cellPx` — bukan oleh banyaknya data.
 *
 * `proyek` dipisah supaya fungsi ini tetap murni dan bisa diuji tanpa leaflet.
 */
export function bagiPinKeSelLayar<T extends { lat: number; lng: number }>(
  pins: readonly T[],
  proyek: (pin: T) => { x: number; y: number },
  layar: { x: number; y: number },
  cellPx = 56
): { sel: Map<string, SelLayar<T>>; dibuang: number } {
  const sel = new Map<string, SelLayar<T>>();
  let dibuang = 0;
  for (const pin of pins) {
    const pt = proyek(pin);
    if (pt.x < -cellPx || pt.y < -cellPx || pt.x > layar.x + cellPx || pt.y > layar.y + cellPx) {
      dibuang++;
      continue;
    }
    const kunci = `${Math.floor(pt.x / cellPx)}:${Math.floor(pt.y / cellPx)}`;
    let b = sel.get(kunci);
    if (!b) {
      b = { kunci, pins: [], sumLat: 0, sumLng: 0 };
      sel.set(kunci, b);
    }
    b.pins.push(pin);
    b.sumLat += pin.lat;
    b.sumLng += pin.lng;
  }
  return { sel, dibuang };
}

export type StatusTitik = 'OK' | 'REVIEW' | 'ANOMALI';

/** Satu garis: kode pos di ujung seberang, koordinatnya, dan label kedua ujungnya. */
export interface KoneksiTitik {
  kode: string;
  lat: number;
  lng: number;
  baris: number;
  /** Nama outlet/cabang — dipakai saat yang diklik titik kelurahan. */
  outlet: string;
  /** Nama kelurahan — dipakai saat yang diklik pin kantor cabang. */
  kel: string;
}

/** Bentuk minimal baris Data Final yang dibutuhkan jembatan garis. */
export interface BarisJembatan {
  kodePosPten?: string | null;
  kodePosKelurahan?: string | null;
  kelurahan?: string | null;
  namaOutlet?: string | null;
  sandiCabang?: string | null;
  branchCode?: string | null;
  kodeCabang?: string | null;
  statusAnalisa?: string;
  placementStatus?: string;
  is3RoleLengkap?: boolean;
}

/** Bentuk minimal baris Data Cabang untuk mencari titik kantor cabang. */
export interface BarisCabang {
  'Sandi Cabang'?: string | null;
  'Branch Code'?: string | null;
  'Kode Cabang'?: string | null;
  'Nama Outlet'?: string | null;
  'KODE POS'?: string | null;
}

export interface KantorCabang {
  kode: string;
  lat: number;
  lng: number;
  outlet: string;
}

const kunciNorm = (s: unknown) => String(s ?? '').trim().toUpperCase();

/**
 * Kunci cabang -> titik KANTOR cabang itu sendiri.
 *
 * Kantor diambil dari `KODE POS` baris Data Cabang lalu koordinatnya dicari di Data
 * Kode Pos — sumber yang sama dengan titik cabang di peta, jadi kedua ujung garis nyata.
 * Prioritas kunci: Branch Code (paling spesifik) > Kode Cabang > Sandi > Nama Outlet.
 */
export function indeksKantorCabang(
  masterRows: readonly BarisCabang[],
  titik: Record<string, { lat: number; lng: number }>
): Map<string, KantorCabang> {
  const indeks = new Map<string, KantorCabang>();
  for (const m of masterRows) {
    const kode = kodePosLima(m['KODE POS']);
    const t = kode ? titik[kode] : undefined;
    if (!t || !Number.isFinite(t.lat) || !Number.isFinite(t.lng)) continue;
    const kantor: KantorCabang = { kode, lat: t.lat, lng: t.lng, outlet: kunciNorm(m['Nama Outlet']) || kode };
    for (const k of [m['Branch Code'], m['Kode Cabang'], m['Sandi Cabang'], m['Nama Outlet']]) {
      const kunci = kunciNorm(k);
      if (kunci && !indeks.has(kunci)) indeks.set(kunci, kantor);
    }
  }
  return indeks;
}

const cariKantor = (indeks: Map<string, KantorCabang>, r: BarisJembatan): KantorCabang | undefined => {
  for (const k of [r.branchCode, r.kodeCabang, r.sandiCabang, r.namaOutlet]) {
    const kunci = kunciNorm(k);
    if (kunci && indeks.has(kunci)) return indeks.get(kunci);
  }
  return undefined;
};

/**
 * Jembatan dua arah: titik KELURAHAN sebuah baris Data Final <-> titik KANTOR outlet
 * yang memegang baris itu.
 *
 * Kenapa bukan `kodePosPten` <-> `kodePosKelurahan` (versi awal): kedua kode itu tinggal
 * di kabupaten yang sama, jadi garisnya pendek dan tidak menjawab pertanyaan operator.
 * Yang ingin dilihat: "kelurahan ini ternyata dipegang cabang yang kantornya di mana".
 * Contoh nyata dari cloud 2026-09-24 — Suak Indrapuri / Johan Pahlawan / Aceh Barat
 * (23611) dipegang KC KAWASAN INDUSTRI MEDAN yang kantornya di 20242, Kota Medan: 289 km.
 *
 * Terukur atas 58.500 baris final di cloud 2026-09-24: 100% outletnya dikenali lewat Data
 * Cabang dan kantornya punya titik (0 baris nyasar), hanya 0,5% kantornya duduk < 0,5 km dari
 * kelurahannya. Sisanya jadi 12.860 garis unik di 7.039 titik kode pos: median 13,4 km,
 * P90 94,4 km, terjauh 3.073 km — jadi garisnya memang punya panjang.
 * Biayanya 51 ms sekali per ganti data (bukan per ganti lapisan).
 */
export function bangunJembatanOutlet(
  rows: readonly BarisJembatan[],
  titik: Record<string, { lat: number; lng: number }>,
  kantor: Map<string, KantorCabang>
): { koneksi: Map<string, KoneksiTitik[]>; status: Map<string, StatusTitik>; tanpaKantor: number } {
  const agregat = new Map<string, Map<string, KoneksiTitik>>();
  const status = new Map<string, StatusTitik>();
  let tanpaKantor = 0;

  const catatStatus = (kode: string, r: BarisJembatan) => {
    const baru: StatusTitik =
      r.statusAnalisa === 'ANOMALI' ? 'ANOMALI'
      : r.placementStatus !== 'VERIFIED' || r.statusAnalisa === 'PERLU_REVIEW' || r.is3RoleLengkap === false ? 'REVIEW'
      : 'OK';
    const lama = status.get(kode);
    if (!lama || (lama === 'OK' && baru !== 'OK') || (lama === 'REVIEW' && baru === 'ANOMALI')) status.set(kode, baru);
  };

  const tambah = (dari: string, ke: string, lat: number, lng: number, r: BarisJembatan, kantor: KantorCabang) => {
    let dalam = agregat.get(dari);
    if (!dalam) { dalam = new Map(); agregat.set(dari, dalam); }
    const ada = dalam.get(ke);
    if (ada) { ada.baris++; return; }
    dalam.set(ke, { kode: ke, lat, lng, baris: 1, outlet: kantor.outlet, kel: kunciNorm(r.kelurahan) || '-' });
  };

  for (const r of rows) {
    const lokasi = kodePosLima(r.kodePosKelurahan) || kodePosLima(r.kodePosPten);
    if (lokasi) catatStatus(lokasi, r);
    const tem = cariKantor(kantor, r);
    if (!tem) { tanpaKantor++; continue; }
    if (!lokasi || tem.kode === lokasi) continue;
    const t = titik[lokasi];
    if (!t || !Number.isFinite(t.lat) || !Number.isFinite(t.lng)) continue;
    tambah(lokasi, tem.kode, tem.lat, tem.lng, r, tem);
    tambah(tem.kode, lokasi, t.lat, t.lng, r, tem);
  }

  const koneksi = new Map<string, KoneksiTitik[]>();
  agregat.forEach((dalam, dari) => {
    koneksi.set(dari, [...dalam.values()].sort((x, y) => y.baris - x.baris));
  });
  return { koneksi, status, tanpaKantor };
}
