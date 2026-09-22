// KLIEN MANDIRI: setiap fungsi di api/ harus berdiri sendiri. Impor relatif (../server/rest
// maupun ./status) ter-bundle tapi gagal di runtime Vercel — terukur 2026-09-23: hanya
// /api/status yang hidup, sembilan rute lain 500 FUNCTION_INVOCATION_FAILED. Jadi blok di
// bawah ini SAMA di semua file api/*.ts; kalau mengubahnya, ubah di semua file (grep
// "KLIEN MANDIRI") lalu jalankan ulang tsc + build.

// Satu lapis penghubung Supabase untuk semua fungsi `api/*`.
//
// Pindah dari `pg` (TCP + kata sandi basis data) ke PostgREST: setiap fungsi
// serverless bicara HTTPS ke <project>/rest/v1 memakai *publishable key*.
// Kunci itu publik oleh desainnya (dipakai di browser juga), jadi tidak ada
// rahasia server yang perlu dipasang di Vercel, dan tidak ada kata sandi DB
// yang perlu dibuat atau dirotasi.
//
// Batasannya: publishable key tidak boleh menjalankan DDL. Karena itu semua
// CREATE TABLE/INDEX/FUNCTION pindah ke server/supabase-bootstrap.sql, yang
// ditempel sekali di Supabase SQL Editor. Fungsi-fungsi di berkas itu adalah
// satu-satunya tempat SQL berada; berkas ini hanya memanggilnya berdasarkan nama.

/** Kesalahan Supabase: status HTTP + kode PostgREST/SQL kalau ada. */
export interface RestSalah extends Error {
  status?: number;
  code?: string;
  hint?: string;
}

/** Kunci publik proyek — bukan rahasia, lihat Supabase Dashboard → API Keys. */
export const SUPABASE_URL_BAKU = 'https://zhewnppsbfidzgihgnvn.supabase.co';
export const SUPABASE_KUNCI_BAKU = 'sb_publishable_TEOGw2mK0ddFJpdpavAoKQ_DSo3Huwm';

export const NAMA_ENV_REST = {
  url: ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL'],
  key: ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
} as const;

const TIMEOUT_MS = 25_000;
/** Baris per halaman baca tabel — Supabase boleh memotong balasan di angka ini. */
const HALAMAN_BACA = 1000;
/** Berapa halaman yang diambil sekaligus; anggaran waktu fungsi serverless pendek. */
const HALAMAN_PARALEL = 4;

export interface KonfigRest {
  url: string;
  kunci: string;
}

/** Konfigurasi selalu ada karena kunci publik boleh bawaan kode; env boleh menimpa. */
export function ambilKonfig(env: NodeJS.ProcessEnv = process.env): KonfigRest {
  const ambil = (nama: readonly string[]) => {
    for (const n of nama) {
      const v = env[n];
      if (v && v.trim()) return v.trim();
    }
    return '';
  };
  return {
    url: (ambil(NAMA_ENV_REST.url) || SUPABASE_URL_BAKU).replace(/\/+$/, ''),
    kunci: ambil(NAMA_ENV_REST.key) || SUPABASE_KUNCI_BAKU,
  };
}

export class Rest {
  private url: string;
  private kunci: string;

  constructor(konfig: KonfigRest) {
    this.url = konfig.url;
    this.kunci = konfig.kunci;
  }

  /**
   * Satu permintaan ke PostgREST. Nilai `filter` sudah memakai sintaks operator
   * PostgREST (`eq.`, `ilike.*x*`, `in.(a,b)`), jadi tidak ada penggabungan string
   * yang bisa disuntik dari pemanggil.
   */
  async minta<T = any>(
    path: string,
    opts: {
      method?: string;
      query?: Record<string, string | number | undefined>;
      body?: unknown;
      prefer?: string;
      head?: boolean;
    } = {}
  ): Promise<{ data: T; count: number | null }> {
    const u = new URL(this.url + path);
    for (const [k, v] of Object.entries(opts.query || {})) {
      if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      apikey: this.kunci,
      Authorization: `Bearer ${this.kunci}`,
      Accept: 'application/json',
    };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.prefer) headers.PREFER = opts.prefer;

    let res: Response;
    try {
      res = await fetch(u.toString(), {
        method: opts.head ? 'HEAD' : opts.method || 'GET',
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err: any) {
      throw errorJaringan(err);
    }

    const teks = opts.head ? '' : await res.text();
    if (!res.ok) {
      throw await errorRest(res, teks);
    }
    const count = hitungDariContentRange(res.headers.get('content-range'));
    let data: T = undefined as unknown as T;
    if (teks) {
      try {
        data = JSON.parse(teks) as T;
      } catch {
        const err = new Error(`Balasan Supabase bukan JSON: ${teks.slice(0, 160)}`) as RestSalah;
        err.status = 502;
        throw err;
      }
    }
    return { data, count };
  }

  /**
   * Panggil fungsi PL/pgSQL hasil bootstrap. Yang rumit (agregat, anti-join,
   * DISTINCT ON) tinggal di SQL sebagai fungsi bernama — di sini hanya nama + argumen.
   */
  async rpc<T = any>(nama: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data } = await this.minta<T>(`/rest/v1/rpc/${nama}`, { method: 'POST', body: args });
    return data;
  }

  /** Baca satu halaman tabel/view. `count: true` sekalian mengembalikan total baris. */
  async baris<T = any>(
    tabel: string,
    opts: {
      kolom?: string;
      filter?: Record<string, string | number | undefined>;
      urut?: string;
      batas?: number;
      mulai?: number;
      distinct?: boolean;
      count?: boolean;
    } = {}
  ): Promise<{ rows: T[]; total: number | null }> {
    const query: Record<string, string | number | undefined> = {
      select: opts.kolom || '*',
      order: opts.urut,
      limit: opts.batas,
      offset: opts.mulai,
      distinct: opts.distinct ? 'true' : undefined,
      ...opts.filter,
    };
    const { data, count } = await this.minta<T[]>(`/rest/v1/${tabel}`, {
      query,
      prefer: opts.count ? 'count=exact' : undefined,
    });
    return { rows: (data as unknown as T[]) || [], total: count };
  }

  /**
   * Baca SELURUH tabel/view. Wajib lewat loop: konsol Supabase bisa membatasi
   * jumlah baris per balasan (Settings → API → Max rows), dan tanpa loop bagian
   * yang terpotong hilang diam-diam.
   *
   * Total hanya diminta pada halaman pertama (`Prefer: count=exact` sekali, bukan
   * tiap halaman), lalu halaman sisanya diambil paralel — fungsi serverless cuma
   * punya anggaran beberapa detik dan klien menunggu 5 detik.
   */
  async semuaBaris<T = any>(
    tabel: string,
    opts: { kolom?: string; filter?: Record<string, string | number | undefined>; urut?: string } = {}
  ): Promise<T[]> {
    const pertama = await this.baris<T>(tabel, { ...opts, batas: HALAMAN_BACA, mulai: 0, count: true });
    const out: T[] = [...pertama.rows];
    const total = pertama.total ?? out.length;
    if (out.length === 0 || out.length >= total) return out;

    const mulaiSisa: number[] = [];
    for (let mulai = HALAMAN_BACA; mulai < total; mulai += HALAMAN_BACA) mulaiSisa.push(mulai);
    for (let i = 0; i < mulaiSisa.length; i += HALAMAN_PARALEL) {
      const rombongan = mulaiSisa.slice(i, i + HALAMAN_PARALEL);
      const halaman = await Promise.all(
        rombongan.map((mulai) => this.baris<T>(tabel, { ...opts, batas: HALAMAN_BACA, mulai }))
      );
      for (const h of halaman) out.push(...h.rows);
    }
    return out;
  }

  /** Jumlah baris tanpa mengirim isinya. */
  async hitung(tabel: string, filter?: Record<string, string | number | undefined>): Promise<number> {
    const { count } = await this.minta(`/rest/v1/${tabel}`, {
      method: 'GET',
      head: true,
      query: { select: 'id', ...filter },
      prefer: 'count=exact',
    });
    return count ?? 0;
  }

  /** Sisip (atau upsert bila `onKonflik` diisi). `kembalikan` hanya bila barisnya benar-benar dipakai. */
  async simpan<T = any>(
    tabel: string,
    rows: unknown[],
    opts: { onKonflik?: string; replace?: boolean; kembalikan?: boolean } = {}
  ): Promise<T[]> {
    const prefer: string[] = [];
    if (opts.kembalikan) prefer.push('return=representation');
    if (opts.onKonflik) prefer.push(opts.replace ? 'resolution=replace' : 'resolution=merge-duplicates');
    const query = opts.onKonflik ? { on_conflict: opts.onKonflik } : {};
    const { data } = await this.minta<T[]>(`/rest/v1/${tabel}`, {
      method: 'POST',
      query,
      body: rows,
      prefer: prefer.length ? prefer.join(',') : undefined,
    });
    return (data as unknown as T[]) || [];
  }

  async ubah<T = any>(
    tabel: string,
    patch: Record<string, unknown>,
    filter: Record<string, string | number | undefined>
  ): Promise<T[]> {
    const { data } = await this.minta<T[]>(`/rest/v1/${tabel}`, {
      method: 'PATCH',
      query: filter,
      body: patch,
      prefer: 'return=representation',
    });
    return (data as unknown as T[]) || [];
  }

  /**
   * `filter` kosong = kosongkan seluruh tabel (PostgREST mengizinkan DELETE tanpa
   * penyaring). Baris hasil hanya diminta bila pemanggilnya benar-benar memakai:
   * meminta representasi untuk DELETE 83 ribu baris membuat fungsi kehabisan waktu.
   */
  async hapus<T = any>(
    tabel: string,
    filter: Record<string, string | number | undefined> = {},
    opts: { kembalikan?: boolean } = {}
  ): Promise<T[]> {
    const { data } = await this.minta<T[]>(`/rest/v1/${tabel}`, {
      method: 'DELETE',
      query: filter,
      prefer: opts.kembalikan ? 'return=representation' : undefined,
    });
    return (data as unknown as T[]) || [];
  }
}

function buatInstance(): Rest {
  return new Rest(ambilKonfig());
}

/** Instance bersama: satu proses = satu koneksi HTTP keep-alive ke host yang sama. */
let instance: Rest | null = null;
export function rest(): Rest {
  if (!instance) instance = buatInstance();
  return instance;
}

/** Sama seperti `rest()` tetapi eksplisit dipakai di dev middleware. */
export function restDariEnv(env: NodeJS.ProcessEnv = process.env): Rest {
  return new Rest(ambilKonfig(env));
}

function hitungDariContentRange(header: string | null): number | null {
  if (!header) return null;
  const total = header.split('/')[1];
  const n = Number(total);
  return Number.isFinite(n) ? n : null;
}

async function errorRest(res: Response, teks: string): Promise<RestSalah> {
  const err = new Error('') as RestSalah;
  err.status = res.status;
  let pesan = teks.slice(0, 300);
  try {
    const j = JSON.parse(teks);
    err.code = j.code;
    err.hint = j.hint;
    pesan = j.message || pesan;
  } catch {
    /* balasan bukan JSON — pakai potongan teksnya */
  }
  err.message = pesan;
  return err;
}

function errorJaringan(err: any): RestSalah {
  const e = new Error('') as RestSalah;
  const sebab = String(err?.name || '') === 'TimeoutError' ? 'waktu habis' : err?.message || 'gagal';
  e.status = 502;
  e.message = `Supabase tidak bisa dihubungi (${sebab}).`;
  return e;
}

const KODE_SKEMA_BOLONG = new Set(['PGRST205', 'PGRST202', '42P01', '42703', 'PGRST203']);

/**
 * Supabase membalas "Could not find the table/function" untuk dua keadaan yang
 * berbeda bagi pemakai: proyek baru yang belum di-bootstrap, atau skema yang
 * berubah setelah deploy. Tanpa penjelasan ini gejalanya cuma angka HTTP.
 */
export function errorBiasa(err: RestSalah | unknown): string {
  const e = err as RestSalah;
  if (e?.code === '42501' || e?.code === 'PGRST301') {
    return ' — hak akses tabel ditolak RLS; jalankan ulang server/supabase-bootstrap.sql.';
  }
  if (e?.status === 401 || e?.status === 403) {
    return ' — kunci Supabase ditolak; periksa SUPABASE_PUBLISHABLE_KEY di Vercel.';
  }
  if (e?.code && KODE_SKEMA_BOLONG.has(e.code)) {
    return ' — skema belum terpasang: buka Supabase SQL Editor, jalankan isi server/supabase-bootstrap.sql.';
  }
  return '';
}

/** Pesan siap-tampil untuk blok catch endpoint. */
export function pesanRest(err: unknown, fallback = 'Supabase menolak permintaan'): string {
  const e = err as RestSalah;
  return `${e?.message || fallback}${errorBiasa(e)}`;
}

// ─── app_store: simpan-baca satu objek JSON per kunci ───────────────────────
// Dipakai menu Wilayah, PTEN, RoleMapping dan cadangan Master/Target.

export async function bacaAppStore(r: Rest, key: string): Promise<{ data: unknown; updated_at: unknown } | null> {
  const { rows } = await r.baris<{ data: unknown; updated_at: unknown }>('app_store', {
    kolom: 'data,updated_at',
    filter: { key: `eq.${key}` },
    batas: 1,
  });
  return rows[0] || null;
}

export async function tulisAppStore(r: Rest, key: string, data: unknown): Promise<void> {
  await r.simpan('app_store', [{ key, data, updated_at: new Date().toISOString() }], {
    onKonflik: 'key',
  });
}

export async function hapusAppStore(r: Rest, key: string): Promise<void> {
  await r.hapus('app_store', { key: `eq.${key}` });
}


/**
 * /api/status — pil "Terhubung" di kepala aplikasi.
 *
 * `app_now()` dipanggil lebih dulu: kalau fungsi itu saja tidak ada, seluruh
 * tabel pasti belum dibuat, dan menjawab connected:true dengan angka nol akan
 * terbaca sebagai "database kosong" (padahal belum di-bootstrap).
 */

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
