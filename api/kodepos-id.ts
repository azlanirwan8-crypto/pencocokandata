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
import { createHash } from 'node:crypto';

/**
 * /api/kodepos-id — patokan kode pos yang bersumber dari kodepos.id.
 *
 * Situs itu tidak punya API maupun berkas unduhan, tapi halaman provinsinya
 * berpaginasi rapi: https://kodepos.id/{slug-provinsi}?page=N berisi tabel
 * [Provinsi, Kota/Kabupaten, Kecamatan, Kelurahan, Kode Pos] 20 baris per
 * halaman, berhenti sendiri saat halamannya kosong. Total nasional ±4.700
 * halaman, jadi crawl penuh ±8-10 menit dan tidak mungkin tiap kali Sync.
 *
 * Karena itu ada dua lapis:
 *  - ?view=fresh   (GET)  cek terbaru/tidak cukup cepat: 1 probe halaman
 *                  setelah halaman terakhir + hash 3 halaman sampel per provinsi.
 *                  Hanya provinsi yang berubah yang perlu di-crawl ulang.
 *  - ?view=crawl   (POST) ambil `pages` halaman sebuah provinsi, upsert ke
 *                  kodepos_baseline.
 *  - ?view=commit  (POST) simpan hasil crawl sebuah provinsi (jumlah halaman + hash
 *                  sampel) ke kodepos_crawl_state supaya ?view=fresh bisa membanding.
 *  - ?view=state   (GET)  ringkasan state per provinsi.
 *
 * Pemeriksaan "Sync Data" memakai tabel kodepos_baseline, jadi tetap bisa diulang
 * tanpa internet; internet hanya disentuh saat cek terbaru / crawl.
 */

export const maxDuration = 60;

const SITE = 'https://kodepos.id';
const SOURCE_LABEL = 'kodepos.id (crawl penuh)';
const MAX_PAGES_PER_CALL = 60;
const CONCURRENCY = 6;
const BLANK_LIMIT = 2;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9',
};

/** Bukan provinsi, tapi ikut muncul sebagai tautan satu segmen di halaman utama. */
const NOT_PROVINCE = new Set([
  'cari', 'jalan', 'gang', 'pencarian', 'index', 'kodepos1', 'about', 'kontak',
  'tentang-kami', 'privacy-policy', 'syarat-kebijakan-privasi', 'sitemap',
]);

interface CollectedRow {
  kode_wilayah: string;
  kode_pos: string;
  kelurahan: string;
  kecamatan: string;
  kabupaten_kota: string;
  provinsi: string;
}

const clean = (v: string) =>
  v
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#0?39;|&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** Sel <tr> dengan 5 kolom dan kolom terakhir kode pos 5 digit. */
export function parseKodePosIdRows(html: string): CollectedRow[] {
  const out: CollectedRow[] = [];
  for (const tr of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => clean(c[1]));
    if (cells.length < 5) continue;
    const [provinsi, kabupaten, kecamatan, kelurahan, kodePos] = cells.slice(-5);
    if (!/^\d{5}$/.test(kodePos)) continue;
    if (!kelurahan || !provinsi) continue;
    out.push({ provinsi, kabupaten_kota: kabupaten, kecamatan, kelurahan, kode_pos: kodePos, kode_wilayah: '' });
  }
  return out;
}

/** Daftar tautan satu segmen yang mungkin provinsi. */
export function parseProvinceSlugs(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/href=["']https?:\/\/kodepos\.id\/([a-z][a-z-]+)\/?["']/gi)) {
    const slug = m[1].toLowerCase();
    if (!NOT_PROVINCE.has(slug)) found.add(slug);
  }
  return [...found].sort();
}

/** Kunci baris: kodepos.id tidak punya kode wilayah, jadi hash seluruh namanya. */
function rowKey(r: CollectedRow): string {
  const seed = `${r.kode_pos}|${r.kelurahan}|${r.kecamatan}|${r.kabupaten_kota}|${r.provinsi}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return `k${h.toString(36)}`.slice(0, 13);
}

/**
 * Upsert hasil crawl ke kodepos_baseline, per 500 baris. `diambil_pada` dikirim
 * eksplisit karena upsert PostgREST hanya menyegarkan kolom yang disertakan.
 */
async function simpanBaseline(sb: ReturnType<typeof rest>, rows: CollectedRow[], versi: number): Promise<void> {
  const TERKIRIM = 500;
  for (let i = 0; i < rows.length; i += TERKIRIM) {
    const batch = rows.slice(i, i + TERKIRIM).map((x) => ({
      kode_wilayah: x.kode_wilayah,
      kode_pos: x.kode_pos,
      kelurahan: x.kelurahan,
      kecamatan: x.kecamatan,
      kabupaten_kota: x.kabupaten_kota,
      provinsi: x.provinsi,
      sumber: SOURCE_LABEL,
      versi,
      diambil_pada: new Date().toISOString(),
    }));
    if (batch.length === 0) continue;
    await sb.simpan('kodepos_baseline', batch, { onKonflik: 'kode_wilayah' });
  }
}

/** Hash isi halaman — dipakai untuk tahu sebuah provinsi berubah atau tidak. */
function hashRows(rows: CollectedRow[]): string {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
}

/** Halaman yang di-hash saat commit: awal, tengah, akhir. */
function samplePages(halaman: number): number[] {
  if (halaman <= 0) return [];
  const mid = Math.max(1, Math.round(halaman / 2));
  return [...new Set([1, mid, halaman])];
}

/** peta dengan paralel terbatas, supaya tidak membanjiri situs sumber. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length || 1)).fill(0).map(async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function fetchPage(provinsi: string, page: number): Promise<CollectedRow[]> {
  const res = await fetch(`${SITE}/${encodeURIComponent(provinsi)}?page=${page}`, {
    headers: BROWSER_HEADERS,
  });
  if (!res.ok) throw new Error(`kodepos.id menolak halaman ${provinsi}#${page} (HTTP ${res.status}).`);
  return parseKodePosIdRows(await res.text());
}

/** Ambil beberapa halaman dengan paralel terbatas; berhenti saat halaman kosong. */
async function crawlRange(
  provinsi: string,
  fromPage: number,
  pages: number
): Promise<{ rows: CollectedRow[]; next: number; done: boolean; lastPage: number }> {
  const rows: CollectedRow[] = [];
  let page = fromPage;
  let blanks = 0;
  let lastPage = 0;

  while (page < fromPage + pages) {
    const start = page;
    const batch: number[] = [];
    for (let i = 0; i < CONCURRENCY && page + i < fromPage + pages; i++) batch.push(page + i);
    const results = await Promise.all(batch.map((p) => fetchPage(provinsi, p).catch(() => null)));
    let lastWithData = -1;
    results.forEach((r, i) => {
      if (r && r.length > 0) {
        rows.push(...r);
        lastWithData = i;
      }
    });
    page += batch.length;
    if (lastWithData >= 0) {
      lastPage = start + lastWithData;
      blanks = 0;
      continue;
    }
    // Batch tanpa isi: ulangi sekali lagi sebelum menyimpulkan provinsinya habis.
    blanks++;
    if (blanks >= BLANK_LIMIT) return { rows, next: page, done: true, lastPage };
  }
  return { rows, next: page, done: false, lastPage };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  try {
    const sb = rest();
    const view = url.searchParams.get('view') || 'provinces';

    if (req.method === 'GET' && view === 'provinces') {
      const res2 = await fetch(SITE, { headers: BROWSER_HEADERS });
      if (!res2.ok) throw new Error(`kodepos.id menolak (HTTP ${res2.status}).`);
      const provinces = parseProvinceSlugs(await res2.text());
      if (provinces.length < 20) throw new Error(`Hanya ${provinces.length} provinsi terbaca — struktur situs berubah.`);
      return res.status(200).json({ ok: true, configured: true, source: SOURCE_LABEL, provinces });
    }

    if (req.method === 'GET' && view === 'state') {
      const rows = await sb.semuaBaris('kodepos_crawl_state', {
        kolom: 'provinsi,sumber,halaman,baris,versi,diambil_pada',
        urut: 'provinsi.asc',
      });
      return res.status(200).json({ ok: true, configured: true, source: SOURCE_LABEL, states: rows });
    }

    /**
     * Cek apakah kodepos.id masih sama dengan terakhir kita kumpul.
     * Murah: per provinsi hanya 3 request (pertama, terakhir, halaman setelah
     * terakhir). Provinsi yang tumbuh atau isinya berubah masuk daftar `berubah`.
     *
     * Cloudflare-nya kodepos.id menolak IP datacenter (Vercel dapat 403), jadi
     * kondisi itu dibalas sebagai `blocked: true` supaya klien memakai patokan
     * terakhir alih-alih gagal merah.
     */
    if (req.method === 'GET' && view === 'fresh') {
      let provinces: string[];
      try {
        const res2 = await fetch(SITE, { headers: BROWSER_HEADERS });
        if (!res2.ok) {
          return res.status(200).json({
            ok: true,
            configured: true,
            blocked: true,
            source: SOURCE_LABEL,
            reason: `kodepos.id menolak server (HTTP ${res2.status}).`,
            provinces: [],
            belumPernah: [],
            berubah: [],
            fresh: false,
          });
        }
        provinces = parseProvinceSlugs(await res2.text());
      } catch (err: any) {
        return res.status(200).json({
          ok: true,
          configured: true,
          blocked: true,
          source: SOURCE_LABEL,
          reason: `kodepos.id tidak bisa dihubungi dari server (${err?.message || 'gagal'}).`,
          provinces: [],
          belumPernah: [],
          berubah: [],
          fresh: false,
        });
      }
      if (provinces.length < 20) throw new Error(`Hanya ${provinces.length} provinsi terbaca — struktur situs berubah.`);

      const stored = await sb.semuaBaris<{ provinsi: string; halaman: number; sampel: string | null }>(
        'kodepos_crawl_state',
        { kolom: 'provinsi,halaman,sampel' }
      );
      const byProv = new Map<string, { halaman: number; sampel: Record<string, string> }>();
      for (const s of stored) {
        let sampel: Record<string, string> = {};
        try {
          sampel = JSON.parse(String(s.sampel || '{}'));
        } catch {
          sampel = {};
        }
        byProv.set(String(s.provinsi), { halaman: Number(s.halaman) || 0, sampel });
      }

      const belum = provinces.filter((p) => !byProv.has(p));
      const sudah = provinces.filter((p) => byProv.has(p));

      const hasil = await mapLimit(sudah, 4, async (provinsi) => {
          const st = byProv.get(provinsi)!;
          const cek = samplePages(st.halaman);
          try {
            const [tumbuh, ...sampelRows] = await Promise.all([
              fetchPage(provinsi, st.halaman + 1),
              ...cek.map((p) => fetchPage(provinsi, p)),
            ]);
            if (tumbuh.length > 0) return { provinsi, berubah: true, alasan: 'bertambah' };
            for (let i = 0; i < cek.length; i++) {
              const lama = st.sampel[String(cek[i])];
              if (lama && lama !== hashRows(sampelRows[i])) return { provinsi, berubah: true, alasan: 'isi berubah' };
            }
            return { provinsi, berubah: false };
          } catch {
            // halaman tidak terambil — anggap perlu crawl ulang provinsi itu
            return { provinsi, berubah: true, alasan: 'gagal dicek' };
          }
      });

      const berubah = [...belum, ...hasil.filter((h) => h.berubah).map((h) => h.provinsi)];
      return res.status(200).json({
        ok: true,
        configured: true,
        source: SOURCE_LABEL,
        provinces,
        belumPernah: belum,
        berubah: hasil.filter((h) => h.berubah),
        fresh: berubah.length === 0,
        diperiksa: sudah.length + belum.length,
      });
    }

    /** Simpan jejak crawl satu provinsi supaya ?view=fresh bisa membandingkan. */
    if (req.method === 'POST' && view === 'commit') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const provinsi = String(body.provinsi || '').trim().toLowerCase();
      const halaman = Math.max(0, Math.min(5000, Number(body.halaman) || 0));
      const baris = Math.max(0, Number(body.baris) || 0);
      if (!/^[a-z][a-z-]{2,40}$/.test(provinsi)) {
        return res.status(400).json({ ok: false, error: 'Slug provinsi tidak valid.' });
      }

      const pages = samplePages(halaman);
      const sampelRows = await Promise.all(pages.map((p) => fetchPage(provinsi, p).catch(() => [] as CollectedRow[])));
      const sampel: Record<string, string> = {};
      pages.forEach((p, i) => (sampel[String(p)] = hashRows(sampelRows[i])));

      // Nomor versi dihitung di database: dua tab yang menyimpan bersamaan tidak
      // boleh sama-sama memilih versi yang sama.
      const versi = await sb.rpc<number>('crawl_state_simpan', {
        p_provinsi: provinsi,
        p_sumber: SOURCE_LABEL,
        p_halaman: halaman,
        p_baris: baris,
        p_sampel: JSON.stringify(sampel),
        p_versi: Number(body.versi) || 0,
      });
      return res.status(200).json({ ok: true, configured: true, provinsi, halaman, versi, sampel: pages });
    }

    if (req.method === 'POST' && view === 'crawl') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const provinsi = String(body.provinsi || '').trim().toLowerCase();
      if (!/^[a-z][a-z-]{2,40}$/.test(provinsi)) {
        return res.status(400).json({ ok: false, error: 'Slug provinsi tidak valid.' });
      }
      const fromPage = Math.max(1, Number(body.fromPage) || 1);
      const pages = Math.min(MAX_PAGES_PER_CALL, Math.max(1, Number(body.pages) || MAX_PAGES_PER_CALL));

      let versi = Number(body.versi) || 0;
      if (!versi) versi = await sb.rpc<number>('base_next_versi');

      const { rows, next, done, lastPage } = await crawlRange(provinsi, fromPage, pages);

      // Satu kunci tidak boleh muncul dua kali dalam satu pernyataan upsert.
      const byKey = new Map<string, CollectedRow>();
      for (const barisHasil of rows) byKey.set(rowKey(barisHasil), { ...barisHasil, kode_wilayah: rowKey(barisHasil) });
      const unique = [...byKey.values()];
      await simpanBaseline(sb, unique, versi);

      return res.status(200).json({
        ok: true,
        configured: true,
        provinsi,
        versi,
        upserted: unique.length,
        fromPage,
        next,
        lastPage,
        done,
        source: SOURCE_LABEL,
      });
    }

    /**
     * Terima hasil crawl yang dijalankan dari luar (mis. tools/crawl-kodepos-id.mjs
     * di laptop sendiri, karena IP datacenter ditolak Cloudflare-nya kodepos.id).
     * Body: { rows: [{ kodePos, kelurahan, kecamatan, kabupatenKota, provinsi }] }
     */
    if (req.method === 'POST' && view === 'ingest') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const input = Array.isArray(body.rows) ? body.rows : [];
      if (input.length === 0) return res.status(400).json({ ok: false, error: 'body.rows kosong.' });
      if (input.length > 5000) return res.status(400).json({ ok: false, error: 'Maksimal 5000 baris per permintaan.' });

      let versi = Number(body.versi) || 0;
      if (!versi) versi = await sb.rpc<number>('base_next_versi');

      const byKey = new Map<string, CollectedRow>();
      for (const r of input) {
        const row: CollectedRow = {
          kode_wilayah: '',
          kode_pos: String(r.kodePos ?? r.kode_pos ?? '').trim(),
          kelurahan: String(r.kelurahan ?? '').trim(),
          kecamatan: String(r.kecamatan ?? '').trim(),
          kabupaten_kota: String(r.kabupatenKota ?? r.kabupaten_kota ?? '').trim(),
          provinsi: String(r.provinsi ?? '').trim(),
        };
        if (!/^\d{5}$/.test(row.kode_pos) || !row.kelurahan) continue;
        byKey.set(rowKey(row), { ...row, kode_wilayah: rowKey(row) });
      }
      const unique = [...byKey.values()];
      if (unique.length === 0) return res.status(400).json({ ok: false, error: 'Tidak ada baris yang sah.' });

      await simpanBaseline(sb, unique, versi);
      return res.status(200).json({ ok: true, configured: true, upserted: unique.length, versi, source: SOURCE_LABEL });
    }

    return res.status(400).json({ ok: false, error: 'Gunakan GET ?view=provinces|fresh|state atau POST ?view=crawl|commit|ingest.' });
  } catch (error: any) {
    console.error('Kodepos.id crawl error:', error);
    return res.status(502).json({ ok: false, configured: true, error: pesanRest(error, 'Crawl kodepos.id gagal.') });
  }
}
