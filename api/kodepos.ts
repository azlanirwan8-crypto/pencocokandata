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
    // PostgREST menolak DELETE tanpa WHERE (HTTP 400) dan fungsi API hanya akan
    // membalas 500 tanpa jejak. Lebih baik gagal di sini, dengan nama tabel.
    if (Object.keys(filter).length === 0) {
      throw new Error(`hapus(${tabel}) butuh filter — DELETE tanpa WHERE selalu ditolak.`);
    }
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
 * /api/kodepos — Supabase Postgres CRUD Master Data Kode Pos Indonesia, lewat PostgREST.
 *
 * GET    ?view=page|stats|options|export|sync-meta   (paging + filter di server)
 *          filter: search, provinsi, kota, status   paging: page (1-based), pageSize (cap 500)
 * POST   body { rows, mode:'replace'|'append' }  → bulk import / reset / create
 * POST   ?view=sync-diff  body { keys:[...] }    → adu kunci baris lokal dengan cloud
 * PUT    ?id=X body { row }                      → update satu baris
 * DELETE ?id=X | ?all=1
 *
 * Baca/tulis berat tidak lagi berupa teks SQL di berkas ini: semuanya hidup di
 * fungsi bernama hasil server/supabase-bootstrap.sql (kp_halaman, kp_stats,
 * kp_options, kp_sync_meta, kp_sync_diff, kp_kosongkan). Alasannya, publishable
 * key hanya boleh memanggil fungsi — tidak boleh mengirim SQL bebas, dan juga
 * tidak boleh membuat tabel.
 */

// Bulk import (83k baris) & export bisa lama — naikkan batas serverless Vercel.
export const maxDuration = 60;

const PAGE_SIZE_CAP = 500;
const SYNC_DIFF_CAP = 500;
const SYNC_KEYS_CAP = 20000;
/** Baris per kiriman INSERT; 1.000 baris ≈ 120 kB, aman di bawah batas body. */
const INSERT_BATCH = 1000;

function mapRow(r: any) {
  return {
    id: r.id ?? null,
    kodePos: r.kode_pos ?? '',
    kelurahan: r.kelurahan ?? '',
    kecamatan: r.kecamatan ?? '',
    kabupatenKota: r.kabupaten_kota ?? '',
    provinsi: r.provinsi ?? '',
    status: r.status ?? 'AKTIF',
    latitude: r.latitude == null ? null : Number(r.latitude),
    longitude: r.longitude == null ? null : Number(r.longitude),
    geoSumber: r.geo_sumber ?? null,
    geoPresisi: r.geo_presisi ?? null,
    geoTerverifikasi: r.terverifikasi_google === true,
  };
}

/** Argumen fungsi kp_halaman — satu sumber untuk page, export, dan hitung. */
function argumenBaca(p: {
  search: string | null;
  provinsi: string | null;
  kota: string | null;
  status: string | null;
  sort: string | null;
  dir: string | null;
  limit: number;
  offset: number;
}) {
  return {
    p_search: p.search?.trim() || null,
    p_provinsi: p.provinsi || null,
    p_kota: p.kota || null,
    p_status: p.status || null,
    p_sort: p.sort || null,
    p_dir: p.dir || null,
    p_limit: p.limit,
    p_offset: p.offset,
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  const r = rest();
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  try {
    const view = url.searchParams.get('view') || 'page';
    const search = url.searchParams.get('search');
    const provinsi = url.searchParams.get('provinsi');
    const kota = url.searchParams.get('kota');
    const status = url.searchParams.get('status');

    // ─────────────────────────── GET ───────────────────────────
    if (req.method === 'GET') {
      if (view === 'stats') {
        const s = await r.rpc<Record<string, number>>('kp_stats');
        return res.status(200).json({
          ok: true,
          configured: true,
          stats: {
            total: s?.total ?? 0,
            totalProvinsi: s?.provinsi ?? 0,
            totalKota: s?.kota ?? 0,
            totalKecamatan: s?.kecamatan ?? 0,
            totalKelurahan: s?.kelurahan ?? 0,
            totalAktif: s?.aktif ?? 0,
            totalBerTitik: s?.ber_titik ?? 0,
          },
        });
      }

      if (view === 'options') {
        const o = await r.rpc<{ provinsi: string[]; kota: string[] }>('kp_options', {
          p_provinsi: provinsi || null,
        });
        return res.status(200).json({
          ok: true,
          configured: true,
          provinsi: o?.provinsi || [],
          kota: o?.kota || [],
        });
      }

      if (view === 'export') {
        // Satu panggilan ke database, bukan puluhan putaran halaman: dengan loop
        // halaman fungsi serverless kehabisan waktu lalu klien jatuh ke data contoh.
        const semua =
          (await r.rpc<any[]>('kp_semua', {
            p_search: search?.trim() || null,
            p_provinsi: provinsi || null,
            p_kota: kota || null,
            p_status: status || null,
          })) || [];
        return res.status(200).json({ ok: true, configured: true, count: semua.length, data: semua.map(mapRow) });
      }

      if (view === 'sync-meta') {
        const m = await r.rpc<{ provinces: any[]; lastUpdated: string | null }>('kp_sync_meta');
        const provinces = m?.provinces || [];
        return res.status(200).json({
          ok: true,
          configured: true,
          cloudTotal: provinces.reduce((sum: number, p: any) => sum + Number(p.total || 0), 0),
          lastUpdated: m?.lastUpdated || null,
          provinces,
        });
      }

      // default: page — satu halaman data + total untuk pagination
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const rawSize = parseInt(url.searchParams.get('pageSize') || '25', 10) || 25;
      const pageSize = Math.min(PAGE_SIZE_CAP, Math.max(1, rawSize));

      const dibaca = await r.rpc<{ rows: any[]; total: number }>('kp_halaman',
        argumenBaca({
          search,
          provinsi,
          kota,
          status,
          sort: url.searchParams.get('sort'),
          dir: url.searchParams.get('dir'),
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }));
      const total = Number(dibaca?.total || 0);

      return res.status(200).json({
        ok: true,
        configured: true,
        data: (dibaca?.rows || []).map(mapRow),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    // ─────────────── PUT (update satu baris) ───────────────
    if (req.method === 'PUT') {
      const id = parseInt(url.searchParams.get('id') || '', 10);
      if (!id) return res.status(400).json({ ok: false, error: 'id wajib diisi untuk update.' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const row = body.row || body;
      const patch: Record<string, unknown> = {
        kode_pos: String(row.kodePos ?? ''),
        kelurahan: String(row.kelurahan ?? ''),
        kecamatan: String(row.kecamatan ?? ''),
        kabupaten_kota: String(row.kabupatenKota ?? ''),
        provinsi: String(row.provinsi ?? ''),
        status: String(row.status ?? 'AKTIF'),
        updated_at: new Date().toISOString(),
      };
      // Titik koordinat hanya ditulis bila pengirimnya memang menyertakan kolom itu —
      // formulir teks lama tidak boleh menghapus titik yang sudah ada.
      if (row.latitude !== undefined || row.longitude !== undefined) {
        const angka = (v: any) => {
          if (v === null || v === '') return null;
          const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
          return Number.isFinite(n) ? n : null;
        };
        const lat = angka(row.latitude ?? null);
        const lng = angka(row.longitude ?? null);
        patch.latitude = lat;
        patch.longitude = lng;
        patch.sumber_koordinat = lat === null ? null : 'manual';
      }
      await r.ubah('kodepos_data', patch, { id: `eq.${id}` });
      return res.status(200).json({ ok: true, configured: true, updated: 1 });
    }

    // ─────────────── POST ───────────────
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // sync-diff: adu himpunan kunci baris milik klien dengan milik cloud.
      // Kunci dikirim sebagai satu string ber-pemisah chr(31), masuk sebagai satu
      // parameter bertanda → tidak ada teks permintaan yang jadi bagian pernyataan SQL.
      if (view === 'sync-diff') {
        const keys: string[] = Array.isArray(body?.keys) ? body.keys.slice(0, SYNC_KEYS_CAP) : [];
        if (keys.length === 0) {
          return res.status(400).json({ ok: false, error: 'body.keys harus array tidak kosong.' });
        }
        const cap = Math.min(SYNC_DIFF_CAP, Math.max(1, Number(body?.cap) || SYNC_DIFF_CAP));
        const diadu = await r.rpc<{ missingInCloud: string[]; missingInLocal: any[]; cloudCodes: string[] }>(
          'kp_sync_diff',
          { p_keys: keys.join(String.fromCharCode(31)), p_cap: cap }
        );
        return res.status(200).json({
          ok: true,
          configured: true,
          keysReceived: keys.length,
          missingInCloud: diadu?.missingInCloud || [],
          missingInLocal: (diadu?.missingInLocal || []).map(mapRow),
          cloudCodes: (diadu?.cloudCodes || []).map((k: any) => String(k)),
          cap,
        });
      }

      const { rows, mode = 'replace' } = body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ ok: false, error: 'rows harus array tidak kosong.' });
      }

      if (mode === 'replace') {
        await r.rpc('kp_kosongkan');
      }

      let inserted = 0;
      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        const batch = rows.slice(i, i + INSERT_BATCH).map((raw: any) => ({
          kode_pos: String(raw.kodePos ?? ''),
          kelurahan: String(raw.kelurahan ?? ''),
          kecamatan: String(raw.kecamatan ?? ''),
          kabupaten_kota: String(raw.kabupatenKota ?? ''),
          provinsi: String(raw.provinsi ?? ''),
          status: String(raw.status ?? 'AKTIF'),
        }));
        if (batch.length === 0) continue;
        await r.simpan('kodepos_data', batch);
        inserted += batch.length;
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        inserted,
        total: rows.length,
        message: `${inserted} data kode pos berhasil disimpan ke Supabase Postgres.`,
      });
    }

    // ─────────────── DELETE ───────────────
    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (id) {
        await r.hapus('kodepos_data', { id: `eq.${parseInt(id, 10)}` });
        return res.status(200).json({ ok: true, configured: true, deleted: 1 });
      }
      if (url.searchParams.get('all') === '1') {
        await r.rpc('kp_kosongkan');
        return res.status(200).json({
          ok: true,
          configured: true,
          message: 'Semua data kode pos berhasil dihapus dari Supabase Postgres.',
        });
      }
      return res.status(400).json({ ok: false, error: 'DELETE butuh ?id=X (satu baris) atau ?all=1 (truncate).' });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Supabase API Error (Kode Pos):', error);
    return res.status(500).json({ ok: false, configured: true, error: pesanRest(error) });
  }
}
