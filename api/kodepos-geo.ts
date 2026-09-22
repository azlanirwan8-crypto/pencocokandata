import { rest, pesanRest } from './status';

/**
 * /api/kodepos-geo — satu titik koordinat per kode pos.
 *
 * GET  ?view=stats   cakupan titik + ketersediaan kunci Google di server
 * POST ?view=run     { jumlah?, provinsi?, mode?: 'isi' | 'verifikasi', apiKey? }
 * POST ?view=retry   hapus catatan kode pos yang gagal dicari supaya dicoba ulang
 * GET  ?view=points  daftar titik (dipakai peta dashboard)
 *
 * Tabel: kodepos_geo — kunci unik kode_pos. Daftar kode pos diambil dari gabungan
 * kodepos_data + kodepos_baseline (lewat fungsi geo_kandidat), jadi baris patokan
 * yang belum diimpor pun sudah punya titik dan tabel Sinkronisasi tampil sama
 * dengan tabel induk.
 *
 * Titik dicari berjenjang: Google Geocoding API bila kunci tersedia, lalu ESRI
 * World Geocoder, lalu OpenStreetMap. Hasil selain Google disimpan dengan
 * terverifikasi_google = FALSE sehingga antarmuka bisa menandainya belum
 * dikonfirmasi Google — bukan berarti titiknya salah.
 */
export const maxDuration = 60;

const BATCH_DEFAULT = 40;
const BATCH_MAX = 80;
const CONCURRENCY = 6;
const REQUEST_TIMEOUT = 9000;
/** Hasil ditulis bertahap tiap sekian baris: kalau fungsi kehabisan waktu, yang
 *  sudah selesai dicari tidak hilang. */
const SIMPAN_EVERY = 10;

// Kotak pembatas Indonesia. Titik di luar ini pasti salah baca dari penyedia mana
// pun dan tidak boleh pernah masuk database.
const BOUND = { latMin: -11.5, latMax: 7.5, lngMin: 94.0, lngMax: 142.0 };

interface Titik {
  lat: number;
  lng: number;
  sumber: 'google' | 'esri' | 'osm';
  presisi: string;
  alamat: string;
  terverifikasi: boolean;
}

interface KodePosRow {
  kode_pos: string;
  kecamatan: string | null;
  kabupaten_kota: string | null;
  provinsi: string | null;
}

/**
 * Kode pos harus benar-benar tertulis di balasan penyedia. Kalau tidak, hasilnya
 * cuma sentroid kabupaten/provinsi yang kelihatan meyakinkan tetapi salah.
 */
function cocokKodePos(teks: string, kodePos: string): boolean {
  return new RegExp(`(^|[^0-9])${kodePos}([^0-9]|$)`).test(teks || '');
}

function diIndonesia(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= BOUND.latMin &&
    lat <= BOUND.latMax &&
    lng >= BOUND.lngMin &&
    lng <= BOUND.lngMax
  );
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function buildQuery(row: KodePosRow): string {
  return [row.kode_pos, row.kabupaten_kota, row.provinsi, 'Indonesia']
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');
}

/** Titik Google dianggap sah bila hasilnya benar-benar entitas kode pos yang sama. */
async function dariGoogle(row: KodePosRow, apiKey: string): Promise<Titik | 'limit' | null> {
  const dicari = buildQuery(row);
  let data: any;
  try {
    data = await fetchJson(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        dicari
      )}&region=id&language=id&key=${encodeURIComponent(apiKey)}`
    );
  } catch {
    return null;
  }

  const status = String(data?.status || '');
  if (status === 'OVER_QUERY_LIMIT' || status === 'REQUEST_DENIED' || status === 'DAILY_LIMIT_EXCEEDED') {
    return 'limit';
  }
  if (status !== 'OK' || !Array.isArray(data.results)) return null;

  for (const result of data.results.slice(0, 3)) {
    const components: any[] = result?.address_components || [];
    const postal = components.find((c) => (c.types || []).includes('postal_code'));
    const types: string[] = result?.types || [];
    const sah =
      (postal && String(postal.long_name) === row.kode_pos) ||
      types.includes('postal_code') ||
      cocokKodePos(String(result?.formatted_address || ''), row.kode_pos);
    if (!sah) continue;
    const lat = Number(result?.geometry?.location?.lat);
    const lng = Number(result?.geometry?.location?.lng);
    if (!diIndonesia(lat, lng)) continue;
    return {
      lat,
      lng,
      sumber: 'google',
      presisi: String(result?.geometry?.location_type || 'APPROXIMATE'),
      alamat: String(result?.formatted_address || ''),
      terverifikasi: true,
    };
  }
  return null;
}

async function dariEsri(row: KodePosRow): Promise<Titik | null> {
  const dicari = buildQuery(row);
  let data: any;
  try {
    data = await fetchJson(
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates` +
        `?f=json&singleLine=${encodeURIComponent(dicari)}&maxLocations=3&countryCode=IDN`
    );
  } catch {
    return null;
  }

  const candidates: any[] = data?.candidates || [];
  if (candidates.length === 0) return null;
  const tepat = candidates.filter((c) => cocokKodePos(String(c?.address || ''), row.kode_pos));
  const pool = tepat.length > 0 ? tepat : candidates;
  const best = pool.sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0))[0];
  const lat = Number(best?.location?.y);
  const lng = Number(best?.location?.x);
  if (!diIndonesia(lat, lng)) return null;
  // Tanpa kode pos di alamatnya, hasil ESRI hanya berguna bila skor sangat tinggi.
  if (tepat.length === 0 && Number(best?.score || 0) < 96) return null;
  return {
    lat,
    lng,
    sumber: 'esri',
    presisi: tepat.length > 0 ? 'PUSAT KODE POS' : 'PERKIRAAN WILAYAH',
    alamat: String(best?.address || ''),
    terverifikasi: false,
  };
}

async function dariOsm(row: KodePosRow): Promise<Titik | null> {
  const dicari = buildQuery(row);
  let data: any;
  try {
    data = await fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(dicari)}&limit=3`);
  } catch {
    return null;
  }
  for (const feat of data?.features || []) {
    const lng = Number(feat?.geometry?.coordinates?.[0]);
    const lat = Number(feat?.geometry?.coordinates?.[1]);
    if (!diIndonesia(lat, lng)) continue;
    const props = feat?.properties || {};
    const alamat = [props.postcode, props.name, props.district, props.city, props.state]
      .filter(Boolean)
      .join(', ');
    if (!cocokKodePos(alamat, row.kode_pos)) continue;
    return { lat, lng, sumber: 'osm', presisi: 'PUSAT KODE POS', alamat, terverifikasi: false };
  }
  return null;
}

/**
 * Bentuk satu baris simpanan kodepos_geo. Titik null = pernah dicari, tidak
 * ditemukan: barisnya tetap ditulis (sumber 'TIDAK DITEMUKAN') supaya tidak
 * ditawarkan lagi pada putaran berikutnya.
 */
function barisGeo(row: KodePosRow, titik: Titik | null) {
  return {
    kode_pos: row.kode_pos,
    latitude: titik ? titik.lat : null,
    longitude: titik ? titik.lng : null,
    sumber: titik ? titik.sumber : 'TIDAK DITEMUKAN',
    presisi: titik ? titik.presisi : null,
    terverifikasi: titik ? titik.terverifikasi : false,
    alamat: titik ? titik.alamat : null,
    dicari: buildQuery(row),
    provinsi: row.provinsi,
    kabupaten_kota: row.kabupaten_kota,
  };
}

/** Kandidat + sisa antrean, satu panggilan ke fungsi geo_kandidat. */
async function kandidat(r: ReturnType<typeof rest>, opts: {
  mode: 'isi' | 'verifikasi';
  provinsi: string | null;
  limit: number | null;
  ulang: boolean;
}): Promise<{ rows: KodePosRow[]; sisa: number }> {
  const hasil = await r.rpc<{ rows: KodePosRow[]; sisa: number }>('geo_kandidat', {
    p_mode: opts.mode,
    p_provinsi: opts.provinsi || null,
    p_limit: opts.limit,
    p_ulang: opts.ulang,
  });
  return { rows: hasil?.rows || [], sisa: Number(hasil?.sisa || 0) };
}

/** Angka ringkas antrean + isi kodepos_geo (satu panggilan). */
async function ringkas(r: ReturnType<typeof rest>, provinsi: string | null) {
  return r.rpc<{
    geo: Record<string, number>;
    menunggu: number;
    menungguUlang: number;
    perluVerifikasi: number;
  }>('geo_stats', { p_provinsi: provinsi || null });
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        await fn(items[idx]);
      }
    })
  );
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const body =
    req.method === 'POST'
      ? typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {}
      : {};

  try {
    const r = rest();
    const view = url.searchParams.get('view') || 'stats';
    const googleKey = String(
      body.apiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || ''
    ).trim();

    // ─────────────── GET stats ───────────────
    if (req.method === 'GET' && view === 'stats') {
      const angka = await ringkas(r, null);
      return res.status(200).json({
        ok: true,
        configured: true,
        googleSiap: Boolean(googleKey),
        geo: angka?.geo || {},
        menunggu: angka?.menunggu ?? 0,
        menungguUlang: angka?.menungguUlang ?? 0,
        perluVerifikasi: angka?.perluVerifikasi ?? 0,
      });
    }

    // ─────────────── GET points ───────────────
    if (req.method === 'GET' && view === 'points') {
      // Prioritas 1: rata-rata titik desa per kode pos (kodepos_data punya koordinat
      // sendiri). Prioritas 2: cache geocoding per kode pos di kodepos_geo.
      const rows =
        (await r.rpc<any[]>('geo_points', { p_provinsi: url.searchParams.get('provinsi') || null })) || [];
      return res.status(200).json({
        ok: true,
        configured: true,
        data: rows.map((x: any) => ({
          kodePos: x.kode_pos,
          lat: Number(x.latitude),
          lng: Number(x.longitude),
          sumber: x.sumber,
          presisi: x.presisi,
          terverifikasi: Boolean(x.terverifikasi_google),
        })),
      });
    }

    // ─────────────── POST retry ───────────────
    if (req.method === 'POST' && view === 'retry') {
      const gagal = await r.hitung('kodepos_geo', { latitude: 'is.null' });
      await r.hapus('kodepos_geo', { latitude: 'is.null' });
      return res.status(200).json({ ok: true, configured: true, dihapus: gagal });
    }

    // ─────────────── POST run ───────────────
    if (req.method === 'POST' && view === 'run') {
      const mode: 'isi' | 'verifikasi' = body.mode === 'verifikasi' ? 'verifikasi' : 'isi';
      const ulang = body.ulang === true && mode === 'isi';
      const limit = Math.min(BATCH_MAX, Math.max(1, Number(body.jumlah) || BATCH_DEFAULT));
      const provinsi = body.provinsi ? String(body.provinsi) : null;

      const antrean = await kandidat(r, { mode, provinsi, limit, ulang });
      /** Angka antrean sesuai mode/ulang; `geo` selalu cakupan nasional (sama seperti sebelumnya). */
      const menungguDari = (n: Awaited<ReturnType<typeof ringkas>> | null) =>
        Number(
          (mode === 'verifikasi' ? n?.perluVerifikasi : ulang ? n?.menungguUlang : n?.menunggu) ?? 0
        );

      if (antrean.rows.length === 0) {
        return res.status(200).json({
          ok: true,
          configured: true,
          diproses: 0,
          berhasil: 0,
          gagal: 0,
          googleTerhenti: false,
          menunggu: antrean.sisa,
        });
      }

      let googleTerhenti = false;
      let berhasil = 0;
      let gagal = 0;
      // Hasil ditulis per beberapa baris, bukan satu per satu: tiap panggilan ke
      // Supabase ada harga round-trip-nya, tetapi menunda semua tulisan sampai akhir
      // berarti fungsi yang kehabisan waktu menghapus hasil yang sudah dicari.
      let siap: ReturnType<typeof barisGeo>[] = [];
      const simpan = async (akhir = false) => {
        if (siap.length === 0 || (!akhir && siap.length < SIMPAN_EVERY)) return;
        await r.rpc('geo_simpan', { p_rows: siap });
        siap = [];
      };

      await mapLimit(antrean.rows, CONCURRENCY, async (row) => {
        let titik: Titik | null = null;
        if (googleKey && !googleTerhenti) {
          const hasil = await dariGoogle(row, googleKey);
          if (hasil === 'limit') googleTerhenti = true;
          else if (hasil) titik = hasil;
        }
        if (!titik) titik = await dariEsri(row);
        if (!titik) titik = await dariOsm(row);
        if (titik) berhasil++;
        else gagal++;
        siap.push(barisGeo(row, titik));
        await simpan();
      });
      await simpan(true);

      const ringkasannya = await ringkas(r, provinsi);
      return res.status(200).json({
        ok: true,
        configured: true,
        diproses: antrean.rows.length,
        berhasil,
        gagal,
        googleTerhenti,
        menunggu: menungguDari(ringkasannya),
        geo: ringkasannya?.geo || {},
      });
    }

    return res.status(405).json({ ok: false, error: `View ${view} tidak dikenali.` });
  } catch (err: any) {
    console.error('/api/kodepos-geo gagal:', err);
    return res.status(500).json({ ok: false, error: pesanRest(err) });
  }
}
