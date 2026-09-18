import { neon } from '@neondatabase/serverless';

/**
 * /api/kodepos-geo — satu titik koordinat per kode pos.
 *
 * GET  ?view=stats   cakupan titik + ketersediaan kunci Google di server
 * POST ?view=run     { jumlah?, provinsi?, mode?: 'isi' | 'verifikasi', apiKey? }
 * POST ?view=retry   hapus catatan kode pos yang gagal dicari supaya dicoba ulang
 * GET  ?view=points  daftar titik (dipakai peta dashboard)
 *
 * Tabel: kodepos_geo — kunci unik kode_pos. Daftar kode pos diambil dari gabungan
 * kodepos_data + kodepos_baseline, jadi baris patokan yang belum diimpor pun sudah
 * punya titik dan tabel Sinkronisasi tampil sama dengan tabel induk.
 */
export const maxDuration = 60;

const BATCH_DEFAULT = 40;
const BATCH_MAX = 80;
const CONCURRENCY = 4;
const REQUEST_TIMEOUT = 9000;

// Kotak pembatas Indonesia. Titik di luar ini pasti salah baca dari penyedia mana
// pun dan tidak boleh pernah masuk database.
const BOUND = { latMin: -11.5, latMax: 7.5, lngMin: 94.0, lngMax: 142.0 };

let schemaReady: Promise<void> | null = null;

function ensureSchema(sql: any): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS kodepos_geo (
            kode_pos              VARCHAR(10) PRIMARY KEY,
            latitude              DOUBLE PRECISION,
            longitude             DOUBLE PRECISION,
            sumber                TEXT,
            presisi               TEXT,
            terverifikasi_google  BOOLEAN DEFAULT FALSE,
            alamat                TEXT,
            dicari                TEXT,
            provinsi              TEXT,
            kabupaten_kota        TEXT,
            diambil_pada          TIMESTAMPTZ,
            dibuat_pada           TIMESTAMPTZ DEFAULT NOW()
          );
        `;
        await sql`ALTER TABLE kodepos_geo ADD COLUMN IF NOT EXISTS provinsi TEXT;`;
        await sql`ALTER TABLE kodepos_geo ADD COLUMN IF NOT EXISTS kabupaten_kota TEXT;`;
      } catch (err) {
        console.warn('Migrasi kodepos_geo dilewati:', err);
        schemaReady = null;
      }
    })();
  }
  return schemaReady;
}

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
 * Kode pos yang titiknya belum ada (mode 'isi') atau sudah ada tetapi belum
 * dikonfirmasi Google (mode 'verifikasi').
 */
function pendingSql(opts: {
  mode: 'isi' | 'verifikasi';
  provinsi: string | null;
  limit: number | null;
  count?: boolean;
}): { sql: string; params: any[] } {
  const params: any[] = [];
  let prov = '';
  if (opts.provinsi) {
    params.push(opts.provinsi);
    prov = `AND upper(btrim(provinsi)) = upper($${params.length})`;
  }
  const filterGeo =
    opts.mode === 'verifikasi'
      ? `WHERE g.kode_pos IS NOT NULL AND g.terverifikasi_google IS NOT TRUE AND g.latitude IS NOT NULL`
      : `WHERE g.kode_pos IS NULL`;
  let tail = '';
  if (!opts.count) {
    if (opts.limit !== null) {
      params.push(opts.limit);
      tail = `LIMIT $${params.length}`;
    }
  }
  const select = opts.count ? 'SELECT COUNT(*)::int AS n' : 'SELECT kode_pos, kecamatan, kabupaten_kota, provinsi';
  return {
    sql: `
      WITH u AS (
        SELECT upper(btrim(kode_pos)) AS kode_pos, kecamatan, kabupaten_kota, provinsi, id
        FROM kodepos_data
        UNION ALL
        SELECT upper(btrim(kode_pos)), kecamatan, kabupaten_kota, provinsi, id + 900000000
        FROM kodepos_baseline
      ),
      k AS (
        SELECT DISTINCT ON (kode_pos) kode_pos, kecamatan, kabupaten_kota, provinsi
        FROM u
        WHERE kode_pos ~ '^[0-9]{5}$' ${prov}
        ORDER BY kode_pos, id
      ),
      p AS (
        SELECT k.* FROM k LEFT JOIN kodepos_geo g ON g.kode_pos = k.kode_pos ${filterGeo}
      )
      ${select} FROM p ${tail};`,
    params,
  };
}

async function hitung(sql: any, mode: 'isi' | 'verifikasi', provinsi: string | null): Promise<number> {
  const { sql: text, params } = pendingSql({ mode, provinsi, limit: null, count: true });
  const rows = await sql.query(text, params);
  return Number((rows?.[0] as any)?.n || 0);
}

async function ringkasanGeo(sql: any) {
  const rows = await sql`
    SELECT COUNT(*)::int AS tercatat,
           COUNT(*) FILTER (WHERE latitude IS NOT NULL)::int AS punya,
           COUNT(*) FILTER (WHERE latitude IS NULL)::int AS gagal,
           COUNT(*) FILTER (WHERE terverifikasi_google)::int AS google,
           COUNT(*) FILTER (WHERE latitude IS NOT NULL AND sumber = 'esri')::int AS esri,
           COUNT(*) FILTER (WHERE latitude IS NOT NULL AND sumber = 'osm')::int AS osm,
           COUNT(*) FILTER (WHERE presisi = 'PERKIRAAN WILAYAH')::int AS perkiraan
    FROM kodepos_geo;`;
  const t = (rows?.[0] as any) || {};
  return {
    tercatat: t.tercatat || 0,
    punya: t.punya || 0,
    gagal: t.gagal || 0,
    google: t.google || 0,
    esri: t.esri || 0,
    osm: t.osm || 0,
    perkiraan: t.perkiraan || 0,
  };
}

async function simpanTitik(sql: any, row: KodePosRow, titik: Titik | null) {
  if (titik) {
    await sql.query(
      `INSERT INTO kodepos_geo
         (kode_pos, latitude, longitude, sumber, presisi, terverifikasi_google, alamat, dicari,
          provinsi, kabupaten_kota, diambil_pada)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (kode_pos) DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         sumber = EXCLUDED.sumber,
         presisi = EXCLUDED.presisi,
         terverifikasi_google = kodepos_geo.terverifikasi_google OR EXCLUDED.terverifikasi_google,
         alamat = EXCLUDED.alamat,
         dicari = EXCLUDED.dicari,
         provinsi = EXCLUDED.provinsi,
         kabupaten_kota = EXCLUDED.kabupaten_kota,
         diambil_pada = NOW();`,
      [
        row.kode_pos,
        titik.lat,
        titik.lng,
        titik.sumber,
        titik.presisi,
        titik.terverifikasi,
        titik.alamat,
        buildQuery(row),
        row.provinsi,
        row.kabupaten_kota,
      ]
    );
    return;
  }
  await sql.query(
    `INSERT INTO kodepos_geo (kode_pos, sumber, dicari, provinsi, kabupaten_kota, diambil_pada)
     VALUES ($1, 'TIDAK DITEMUKAN', $2, $3, $4, NOW())
     ON CONFLICT (kode_pos) DO UPDATE SET
       latitude = NULL, longitude = NULL, sumber = 'TIDAK DITEMUKAN', presisi = NULL,
       terverifikasi_google = FALSE, dicari = EXCLUDED.dicari, diambil_pada = NOW();`,
    [row.kode_pos, buildQuery(row), row.provinsi, row.kabupaten_kota]
  );
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

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL;

  if (!connectionString) {
    return res.status(200).json({ ok: false, configured: false, message: 'DATABASE_URL Neon belum terpasang.' });
  }

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const body =
    req.method === 'POST'
      ? typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {}
      : {};

  try {
    const sql = neon(connectionString);
    await ensureSchema(sql);
    const view = url.searchParams.get('view') || 'stats';
    const googleKey = String(
      body.apiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || ''
    ).trim();

    // ─────────────── GET stats ───────────────
    if (req.method === 'GET' && view === 'stats') {
      const [geo, menunggu, perluVerifikasi] = await Promise.all([
        ringkasanGeo(sql),
        hitung(sql, 'isi', null),
        hitung(sql, 'verifikasi', null),
      ]);
      return res.status(200).json({
        ok: true,
        configured: true,
        googleSiap: Boolean(googleKey),
        geo,
        menunggu,
        perluVerifikasi,
      });
    }

    // ─────────────── GET points ───────────────
    if (req.method === 'GET' && view === 'points') {
      const provinsi = url.searchParams.get('provinsi');
      const params: any[] = [];
      let where = 'WHERE latitude IS NOT NULL';
      if (provinsi) {
        params.push(provinsi);
        where += ` AND upper(btrim(provinsi)) = upper($${params.length})`;
      }
      const rows = await sql.query(
        `SELECT kode_pos, latitude, longitude, sumber, presisi, terverifikasi_google
         FROM kodepos_geo ${where} ORDER BY kode_pos;`,
        params
      );
      return res.status(200).json({
        ok: true,
        configured: true,
        data: (rows || []).map((r: any) => ({
          kodePos: r.kode_pos,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
          sumber: r.sumber,
          presisi: r.presisi,
          terverifikasi: Boolean(r.terverifikasi_google),
        })),
      });
    }

    // ─────────────── POST retry ───────────────
    if (req.method === 'POST' && view === 'retry') {
      const gagal = await sql`SELECT COUNT(*)::int AS n FROM kodepos_geo WHERE latitude IS NULL;`;
      await sql`DELETE FROM kodepos_geo WHERE latitude IS NULL;`;
      return res.status(200).json({ ok: true, configured: true, dihapus: Number((gagal?.[0] as any)?.n || 0) });
    }

    // ─────────────── POST run ───────────────
    if (req.method === 'POST' && view === 'run') {
      const mode: 'isi' | 'verifikasi' = body.mode === 'verifikasi' ? 'verifikasi' : 'isi';
      const limit = Math.min(BATCH_MAX, Math.max(1, Number(body.jumlah) || BATCH_DEFAULT));
      const provinsi = body.provinsi ? String(body.provinsi) : null;

      const { sql: text, params } = pendingSql({ mode, provinsi, limit });
      const kandidat = (await sql.query(text, params)) as KodePosRow[];
      if (kandidat.length === 0) {
        return res.status(200).json({
          ok: true,
          configured: true,
          diproses: 0,
          berhasil: 0,
          gagal: 0,
          googleTerhenti: false,
          menunggu: await hitung(sql, mode, provinsi),
        });
      }

      let googleTerhenti = false;
      let berhasil = 0;
      let gagal = 0;

      await mapLimit(kandidat, CONCURRENCY, async (row) => {
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
        await simpanTitik(sql, row, titik);
      });

      const [menunggu, geo] = await Promise.all([
        hitung(sql, mode, provinsi),
        ringkasanGeo(sql),
      ]);
      return res.status(200).json({
        ok: true,
        configured: true,
        diproses: kandidat.length,
        berhasil,
        gagal,
        googleTerhenti,
        menunggu,
        geo,
      });
    }

    return res.status(405).json({ ok: false, error: `View ${view} tidak dikenali.` });
  } catch (err: any) {
    console.error('/api/kodepos-geo gagal:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Kesalahan tak terduga.' });
  }
}
