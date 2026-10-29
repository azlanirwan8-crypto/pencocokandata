import { createHash } from 'node:crypto';

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
 * /api/kodepos-pos — ambil SELURUH kode pos dari situs resmi Pos Indonesia.
 *
 * GET  ?view=ringkasan   tarik situs, laporkan jumlah baris/kode pos (tanpa tulis database)
 * POST ?view=sync        body { import?: boolean } — tarik situs, bandingkan dengan
 *                        kodepos_data; bila `import` true, baris yang belum ada langsung
 *                        disalin (tabel kosong / hanya kekurangan baris situs)
 * POST ?view=import      tarik situs, salin SEMUA baris yang belum ada ke kodepos_data
 *
 * Sumber: https://kodepos.posindonesia.co.id/CariKodepos. Form pencariannya memakai
 * POST `kodepos=...`; wildcard `%` mengembalikan seluruh isi tabel dalam satu halaman
 * HTML (±20 MB, terukur 2026-10-29: 85.595 baris, 85.575 unik, 11.594 kode pos unik).
 * Situs ini dilindungi Akamai: tanpa header Referer/Origin permintaan dibalas 403,
 * jadi header browser lengkap wajib dikirim.
 *
 * Kunci baris = lima kolom penuh (kode pos + kelurahan + kecamatan + kabupaten/kota +
 * provinsi), sama dengan kodePosRowKey() di aplikasi. Situs sendiri memuat 20 baris
 * duplikat persis; duplikat itu dilaporkan, tetapi hanya baris unik yang disimpan.
 */

export const maxDuration = 60;

const POS_URL = 'https://kodepos.posindonesia.co.id/CariKodepos';
const POS_LABEL = 'kodepos.posindonesia.co.id (situs resmi Pos Indonesia)';
const POS_BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
  Referer: 'https://kodepos.posindonesia.co.id/',
  Origin: 'https://kodepos.posindonesia.co.id',
};

/** Lantai kewarasan: situs resmi memuat >80 ribu baris; di bawah ini berarti tarikan gagal. */
const POS_MIN_BARIS = 60_000;
const POS_TIMEOUT_MS = 45_000;
const POS_COBA = 3;
const CONTOH_CAP = 5000;
const TULIS_BATCH = 1000;
const TULIS_PARALEL = 6;

interface BarisPos {
  kodePos: string;
  kelurahan: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi: string;
}

interface KunciDb {
  kode_pos?: unknown;
  kelurahan?: unknown;
  kecamatan?: unknown;
  kabupaten_kota?: unknown;
  provinsi?: unknown;
}

/** btrim() SQL hanya membuang spasi, bukan tab — dipakai agar sidik jari sama persis. */
const btrim = (v: unknown) => String(v ?? '').replace(/^ +| +$/g, '');

function decodeHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Baris tabel hasil pencarian. DataTables merender seluruh hasil di server, jadi satu
 * balasan berisi semua baris; tidak ada endpoint JSON berpaginasi.
 */
function parseBaris(html: string): BarisPos[] {
  const out: BarisPos[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const sel = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => decodeHtml(m[1]));
    if (sel.length < 6 || !/^\d+$/.test(sel[0])) continue;
    const kodePos = sel[1];
    if (!/^\d{5}$/.test(kodePos)) continue;
    out.push({
      kodePos,
      kelurahan: sel[2],
      kecamatan: sel[3],
      kabupatenKota: sel[4],
      provinsi: sel[5],
    });
  }
  return out;
}

const kunciBaris = (r: Partial<BarisPos> | KunciDb): string => {
  const get = (camel: keyof BarisPos, snake: keyof KunciDb) =>
    btrim((r as any)[camel] ?? (r as any)[snake] ?? '').toUpperCase();
  return [
    get('kodePos', 'kode_pos'),
    get('kelurahan', 'kelurahan'),
    get('kecamatan', 'kecamatan'),
    get('kabupatenKota', 'kabupaten_kota'),
    get('provinsi', 'provinsi'),
  ].join('|');
};

const provinsiDari = (r: Partial<BarisPos> | KunciDb): string => {
  const v = btrim((r as any).provinsi ?? '').toUpperCase();
  return v || '(TANPA PROVINSI)';
};

/** Urutan byte UTF-8, sama dengan `ORDER BY ... COLLATE "C"` di Postgres. */
function urutByte(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

interface SitusHasil {
  baris: number;
  unik: BarisPos[];
  duplikat: number;
  kodePosUnik: number;
  provinsi: number;
  kota: number;
  kecamatan: number;
  diambilPada: string;
}

/** Bentuk ringkas yang dikirim ke klien — daftar barisnya tidak ikut. */
function ringkasanSitus(situs: SitusHasil) {
  return {
    baris: situs.baris,
    unik: situs.unik.length,
    duplikat: situs.duplikat,
    kodePosUnik: situs.kodePosUnik,
    provinsi: situs.provinsi,
    kota: situs.kota,
    kecamatan: situs.kecamatan,
  };
}

async function tarikSitus(): Promise<SitusHasil> {
  let terakhir: Error | null = null;
  for (let coba = 1; coba <= POS_COBA; coba++) {
    try {
      const res = await fetch(POS_URL, {
        method: 'POST',
        headers: POS_BROWSER_HEADERS,
        body: 'kodepos=%25',
        signal: AbortSignal.timeout(POS_TIMEOUT_MS),
      });
      const html = await res.text();
      if (res.status === 403 || /Akses Diblokir/i.test(html.slice(0, 5000))) {
        throw new Error('Situs Pos Indonesia menolak permintaan (Akamai 403).');
      }
      if (!res.ok) throw new Error(`Situs Pos Indonesia membalas HTTP ${res.status}.`);

      const semua = parseBaris(html);
      if (semua.length < POS_MIN_BARIS) {
        throw new Error(
          `Situs Pos Indonesia hanya mengirim ${semua.length.toLocaleString('id-ID')} baris ` +
            `(minimum ${POS_MIN_BARIS.toLocaleString('id-ID')}) — tarikan dibatalkan supaya data lama tidak tertimpa.`
        );
      }

      const unik = new Map<string, BarisPos>();
      for (const r of semua) if (!unik.has(kunciBaris(r))) unik.set(kunciBaris(r), r);
      const rows = [...unik.values()];

      return {
        baris: semua.length,
        unik: rows,
        duplikat: semua.length - rows.length,
        kodePosUnik: new Set(rows.map((r) => r.kodePos)).size,
        provinsi: new Set(rows.map((r) => provinsiDari(r))).size,
        kota: new Set(rows.map((r) => r.kabupatenKota.toUpperCase())).size,
        kecamatan: new Set(rows.map((r) => `${r.kecamatan.toUpperCase()}|${r.kabupatenKota.toUpperCase()}|${provinsiDari(r)}`)).size,
        diambilPada: new Date().toISOString(),
      };
    } catch (err: any) {
      terakhir = err instanceof Error ? err : new Error(String(err));
      if (coba < POS_COBA) await new Promise((r) => setTimeout(r, 900 * coba));
    }
  }
  throw terakhir || new Error('Situs Pos Indonesia tidak dapat diambil.');
}

interface MetaProvinsi {
  provinsi: string;
  total: number;
  fingerprint: string;
}

/**
 * Sidik jari per provinsi dihitung dengan rumus yang sama seperti `kp_sync_meta()`
 * (kunci 5 kolom, urut byte, gabung newline, SHA-256). Bila seluruh sidik jari sama,
 * himpunan baris database identik dengan situs — tanpa perlu membaca 85 ribu baris.
 */
function sidikSitus(rows: BarisPos[]): Map<string, MetaProvinsi> {
  const per = new Map<string, string[]>();
  for (const r of rows) {
    const prov = provinsiDari(r);
    const daftar = per.get(prov);
    if (daftar) daftar.push(kunciBaris(r));
    else per.set(prov, [kunciBaris(r)]);
  }
  const out = new Map<string, MetaProvinsi>();
  for (const [provinsi, keys] of per) {
    keys.sort(urutByte);
    out.set(provinsi, {
      provinsi,
      total: keys.length,
      fingerprint: createHash('sha256').update(keys.join('\n'), 'utf8').digest('hex'),
    });
  }
  return out;
}

function metaCocok(situs: Map<string, MetaProvinsi>, meta: MetaProvinsi[]): boolean {
  if (meta.length !== situs.size) return false;
  for (const m of meta) {
    const s = situs.get(m.provinsi);
    if (!s || Number(m.total) !== s.total || m.fingerprint !== s.fingerprint) return false;
  }
  return true;
}

async function bacaKunciDb(r: Rest): Promise<{ keys: Set<string>; baris: number; kodePosUnik: number }> {
  const rows = await r.semuaBaris<KunciDb>('kodepos_data', {
    kolom: 'kode_pos,kelurahan,kecamatan,kabupaten_kota,provinsi',
  });
  const keys = new Set(rows.map((x) => kunciBaris(x)));
  const kode = new Set(rows.map((x) => btrim(x.kode_pos).toUpperCase()).filter(Boolean));
  return { keys, baris: rows.length, kodePosUnik: kode.size };
}

function barisDb(r: BarisPos) {
  return {
    kode_pos: r.kodePos,
    kelurahan: r.kelurahan,
    kecamatan: r.kecamatan,
    kabupaten_kota: r.kabupatenKota,
    provinsi: r.provinsi,
    status: 'AKTIF',
  };
}

async function simpanBaris(r: Rest, rows: BarisPos[]): Promise<void> {
  for (let i = 0; i < rows.length; i += TULIS_BATCH * TULIS_PARALEL) {
    const potongan: BarisPos[][] = [];
    for (let j = i; j < Math.min(i + TULIS_BATCH * TULIS_PARALEL, rows.length); j += TULIS_BATCH) {
      potongan.push(rows.slice(j, j + TULIS_BATCH));
    }
    await Promise.all(potongan.map((bagian) => r.simpan('kodepos_data', bagian.map(barisDb))));
  }
}

function contoh(r: BarisPos) {
  return {
    kodePos: r.kodePos,
    kelurahan: r.kelurahan,
    kecamatan: r.kecamatan,
    kabupatenKota: r.kabupatenKota,
    provinsi: r.provinsi,
    status: 'AKTIF',
    latitude: null,
    longitude: null,
  };
}

function rencanaKurang(situs: SitusHasil, keys: Set<string>) {
  const kurang = situs.unik.filter((r) => !keys.has(kunciBaris(r)));
  const provinsi = [...new Set(kurang.map((r) => provinsiDari(r)))].sort(urutByte);
  return {
    total: kurang.length,
    rows: kurang.slice(0, CONTOH_CAP).map(contoh),
    truncated: kurang.length > CONTOH_CAP,
    provinces: provinsi,
    semua: kurang,
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const view = url.searchParams.get('view') || 'ringkasan';

  try {
    const r = rest();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    // HanyaSync otomatis mengisi bila klien memintanya; setelah impor manual client
    // mengirim import:false supaya pilihan baris pengguna tidak dilengkapi diam-diam.
    const bolehIsi = body?.import === true;

    if (req.method === 'GET' && view === 'ringkasan') {
      const situs = await tarikSitus();
      return res.status(200).json({
        ok: true,
        configured: true,
        sumber: POS_LABEL,
        url: POS_URL,
        diambilPada: situs.diambilPada,
        situs: ringkasanSitus(situs),
        contoh: situs.unik.slice(0, 5).map(contoh),
      });
    }

    if (req.method === 'POST' && view === 'sync') {
      const situs = await tarikSitus();
      const stats = await r.rpc<Record<string, number>>('kp_stats');
      let dbBaris = Number(stats?.total || 0);

      // Tabel kerja kosong = pemakaian pertama. Isi penuh supaya satu kali Sync Data
      // langsung menghasilkan seluruh dataset situs (85.575 baris unik).
      if (bolehIsi && dbBaris === 0) {
        await simpanBaris(r, situs.unik);
        dbBaris = await r.hitung('kodepos_data');
        if (dbBaris !== situs.unik.length) {
          throw new Error(
            `Database menerima ${dbBaris.toLocaleString('id-ID')} dari ${situs.unik.length.toLocaleString('id-ID')} baris. ` +
              'Tekan Sync Data lagi — baris yang sudah masuk tidak akan digandakan.'
          );
        }
        return res.status(200).json({
          ok: true,
          configured: true,
          sumber: POS_LABEL,
          url: POS_URL,
          diambilPada: situs.diambilPada,
          situs: ringkasanSitus(situs),
          db: { baris: dbBaris, kodePosUnik: situs.kodePosUnik },
          missing: { total: 0, rows: [], truncated: false, provinces: [] },
          barisDisalin: situs.unik.length,
          totalSetelah: dbBaris,
          catatan:
            `Tabel kerja kosong, jadi seluruh ${situs.unik.length.toLocaleString('id-ID')} baris unik situs ` +
            `langsung disalin. Situs memuat ${situs.baris.toLocaleString('id-ID')} baris; ` +
            `${situs.duplikat.toLocaleString('id-ID')} di antaranya duplikat identik.`,
        });
      }

      // Database sudah terisi: sidik jari per provinsi menjawab "sama persis" tanpa
      // memindahkan puluhan ribu baris. Bila berbeda, kunci dibaca sekali untuk
      // menghitung selisih tingkat baris yang tepat.
      const meta = (await r.rpc<{ provinces?: MetaProvinsi[] }>('kp_sync_meta'))?.provinces || [];
      const sidik = sidikSitus(situs.unik);
      if (metaCocok(sidik, meta)) {
        return res.status(200).json({
          ok: true,
          configured: true,
          sumber: POS_LABEL,
          url: POS_URL,
          diambilPada: situs.diambilPada,
          situs: ringkasanSitus(situs),
          db: {
            baris: meta.reduce((s, p) => s + Number(p.total || 0), 0),
            kodePosUnik: situs.kodePosUnik,
          },
          missing: { total: 0, rows: [], truncated: false, provinces: [] },
          barisDisalin: 0,
          totalSetelah: dbBaris,
          catatan: 'Sidik jari seluruh provinsi sama dengan database — tidak ada yang perlu disalin.',
        });
      }

      const db = await bacaKunciDb(r);
      const kurang = rencanaKurang(situs, db.keys);

      /*
       * Database yang hanya KEKURANGAN baris situs (sync pertama terputus di tengah,
       * atau tabel lama yang seluruh isinya ada di situs) dilengkapi pada panggilan ini
       * juga. Himpunan baris asing TIDAK pernah dihapus di sini.
       */
      const kunciSitus = new Set(situs.unik.map(kunciBaris));
      const adaBarisAsing = [...db.keys].some((k) => !kunciSitus.has(k));
      if (bolehIsi && !adaBarisAsing && kurang.semua.length > 0) {
        await simpanBaris(r, kurang.semua);
        const totalSetelah = await r.hitung('kodepos_data');
        const diharapkan = db.baris + kurang.semua.length;
        if (totalSetelah !== diharapkan) {
          throw new Error(
            `Database menerima ${totalSetelah.toLocaleString('id-ID')} dari ${diharapkan.toLocaleString('id-ID')} baris yang diharapkan. ` +
              'Tekan Sync Data lagi — baris yang sudah masuk tidak akan digandakan.'
          );
        }
        return res.status(200).json({
          ok: true,
          configured: true,
          sumber: POS_LABEL,
          url: POS_URL,
          diambilPada: situs.diambilPada,
          situs: ringkasanSitus(situs),
          db: { baris: totalSetelah, kodePosUnik: situs.kodePosUnik },
          missing: { total: 0, rows: [], truncated: false, provinces: [] },
          barisDisalin: kurang.semua.length,
          totalSetelah,
          catatan:
            `${kurang.semua.length.toLocaleString('id-ID')} baris situs yang belum ada langsung disalin, ` +
            `sehingga database kini memuat ${totalSetelah.toLocaleString('id-ID')} baris — ` +
            `sama dengan ${situs.unik.length.toLocaleString('id-ID')} baris unik situs.`,
        });
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        sumber: POS_LABEL,
        url: POS_URL,
        diambilPada: situs.diambilPada,
        situs: ringkasanSitus(situs),
        db: { baris: db.baris, kodePosUnik: db.kodePosUnik },
        missing: {
          total: kurang.total,
          rows: kurang.rows,
          truncated: kurang.truncated,
          provinces: kurang.provinces,
        },
        barisDisalin: 0,
        totalSetelah: db.baris,
        catatan:
          kurang.total > 0
            ? `${kurang.total.toLocaleString('id-ID')} baris situs belum ada di tabel kerja.`
            : 'Semua baris situs sudah ada di tabel kerja; selisih hanya pada baris lama database.',
      });
    }

    if (req.method === 'POST' && view === 'import') {
      const situs = await tarikSitus();
      const db = await bacaKunciDb(r);
      const kurang = rencanaKurang(situs, db.keys);
      if (kurang.semua.length > 0) await simpanBaris(r, kurang.semua);

      const totalSetelah = await r.hitung('kodepos_data');
      const diharapkan = db.baris + kurang.semua.length;
      if (totalSetelah !== diharapkan) {
        throw new Error(
          `Setelah penyalinan database berisi ${totalSetelah.toLocaleString('id-ID')} baris, ` +
            `diharapkan ${diharapkan.toLocaleString('id-ID')}. Tekan Sync Data lagi untuk melanjutkan.`
        );
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        sumber: POS_LABEL,
        url: POS_URL,
        diambilPada: situs.diambilPada,
        totalSitus: situs.unik.length,
        barisSitus: situs.baris,
        duplikatSitus: situs.duplikat,
        masuk: kurang.semua.length,
        totalSetelah,
      });
    }

    return res.status(400).json({
      ok: false,
      error: 'Gunakan GET ?view=ringkasan atau POST ?view=sync|import.',
    });
  } catch (error: any) {
    console.error('Kodepos Pos Indonesia error:', error);
    const status = Number(error?.status) || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      ok: false,
      configured: true,
      error: pesanRest(error, 'Pengambilan data kodepos.posindonesia.co.id gagal.'),
    });
  }
}
