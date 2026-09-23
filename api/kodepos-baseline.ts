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
 * /api/kodepos-baseline — patokan kode pos nasional yang disimpan di database sendiri.
 *
 * GET  ?view=meta   ringkasan isi tabel baseline
 * GET  ?view=diff   adukan kodepos_data dengan seluruh isi baseline
 * GET  ?view=koordinat  cakupan titik per desa (patokan + tabel kerja + adu kode pos)
 * POST ?view=fetch  tarik satu tahap (maks. 5 halaman x 1000 baris) lalu upsert per kode
 *                   wilayah; klien mengulang sampai `done`
 * POST ?view=import-missing  salin semua baris patokan yang belum ada ke kodepos_data
 * POST ?view=koordinat-ingest  { rows: [{kode, lat, lng, kodePos?, elev?}] } upsert titik
 * POST ?view=koordinat-salin   turunkan titik patokan ke baris kodepos_data
 * DELETE            kosongkan tabel baseline untuk mulai ulang
 *
 * Sumber dicoba berurutan; sumber yang benar-benar dipakai dicatat di kolom `sumber`:
 *  1. Dump resmi Kemendagri (dua berkas SQL di GitHub cahyadsn) — `wilayah.sql` memberi kode
 *     wilayah 12 digit + nama semua level, `wilayah_kodepos.sql` memberi kode pos per kode
 *     wilayah. Digabung pada kode wilayah, hasilnya 83.762 baris lengkap (terukur 2026-09-20).
 *     https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql
 *     https://raw.githubusercontent.com/cahyadsn/wilayah_kodepos/main/db/wilayah_kodepos.sql
 *  2. Satu Data Indonesia (penerbit Kementerian PPN/Bappenas) — dataset "Kode Pos Desa
 *     Kelurahan di Indonesia", dilayani JabarCloud. https://data.go.id/dataset/dataset/kode-pos-desa-kelurahan-di-indonesia
 *  3. Mirror GitHub wilayah + kode pos (teguh02, asal-usul komunitas) — dipakai hanya bila
 *     portal pemerintah menolak (WAF-nya sering memblokir IP di luar Indonesia).
 */

export const maxDuration = 60;

const PAGE_SIZE = 1000;
const PAGES_PER_CALL = 5;
const DIFF_CAP = 5000;

const PEMDA_URL = 'https://data.jabarprov.go.id/api-backend/bigdata/dispusipda/kode_pos_kab_kota_indonesia';
const CSV_URL = 'https://raw.githubusercontent.com/teguh02/Wilayah-Indonesia-Beserta-Kode-Pos/main/CSV/full.csv';
const WILAYAH_URL = 'https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql';
const KODEPOS_SQL_URL = 'https://raw.githubusercontent.com/cahyadsn/wilayah_kodepos/main/db/wilayah_kodepos.sql';

/** Baris normal yang disimpan ke tabel baseline. */
interface NormRow {
  kode_wilayah: string;
  kode_pos: string;
  kelurahan: string;
  kecamatan: string;
  kabupaten_kota: string;
  provinsi: string;
  tahun: string;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Referer: 'https://data.go.id/',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'id-ID,id;q=0.9',
};

const norm = (v: any) => String(v ?? '').trim();

/** Dump SQL resmi di-cache per instance (1 jam): 83.762 baris hasil gabungan dua berkas. */
let kemendagriCache: { at: number; rows: NormRow[] } | null = null;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url.split('/').pop()} menolak (HTTP ${res.status}).`);
  return res.text();
}

/**
 * Sumber 1: dump resmi Kemendagri. `wilayah.sql` memetakan kode wilayah -> nama pada semua
 * level (provinsi 2, kab/kota 5, kecamatan 8, desa 13 karakter), `wilayah_kodepos.sql`
 * memetakan kode desa -> kode pos. Kuncinya sama-sama kode wilayah 12 digit.
 */
async function loadKemendagriPage(skip: number, size = PAGE_SIZE): Promise<{ rows: NormRow[]; total: number }> {
  if (!kemendagriCache || Date.now() - kemendagriCache.at > 60 * 60 * 1000) {
    const [wilayahText, kodePosText] = await Promise.all([fetchText(WILAYAH_URL), fetchText(KODEPOS_SQL_URL)]);

    const nama = new Map<string, string>();
    // Level 1-3 memakai segmen 2 digit (11 / 11.05 / 11.05.07); level 4 empat digit (11.05.07.2002).
    for (const m of wilayahText.matchAll(/\('(\d{2}(?:\.\d{2,4}){0,3})','((?:[^']|'')*)'\)/g)) {
      nama.set(m[1], m[2].replace(/''/g, "'").trim());
    }

    const rows: NormRow[] = [];
    for (const m of kodePosText.matchAll(/\('(\d{2}\.\d{2}\.\d{2}\.\d{4})',\s*'(\d{5})'\)/g)) {
      const kode = m[1];
      rows.push({
        kode_wilayah: kode,
        kode_pos: m[2],
        kelurahan: nama.get(kode) || '',
        kecamatan: nama.get(kode.slice(0, 8)) || '',
        kabupaten_kota: nama.get(kode.slice(0, 5)) || '',
        provinsi: nama.get(kode.slice(0, 2)) || '',
        tahun: '',
      });
    }

    if (rows.length === 0) throw new Error('Dump Kemendagri tidak menghasilkan satu barispun.');
    rows.sort((a, b) => a.kode_wilayah.localeCompare(b.kode_wilayah));
    kemendagriCache = { at: Date.now(), rows };
  }
  return { rows: kemendagriCache.rows.slice(skip, skip + size), total: kemendagriCache.rows.length };
}

/** Sumber 1: portal pemerintah (JSON berpaginasi, ada nama wilayah + kode kemendagri). */
async function loadPemdaPage(skip: number, size = PAGE_SIZE): Promise<{ rows: NormRow[]; total: number }> {
  const res = await fetch(`${PEMDA_URL}?limit=${size}&skip=${skip}`, { headers: BROWSER_HEADERS });
  const text = await res.text();
  if (!res.ok) throw new Error(`Sumber pemerintah menolak (HTTP ${res.status}).`);
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Sumber pemerintah membalas halaman non-JSON (kemungkinan diblokir WAF).');
  }
  const data = Array.isArray(json?.data) ? json.data : [];
  const rows: NormRow[] = data.map((r: any) => ({
    kode_wilayah: norm(r.kemendagri_kode_desa_kelurahan || r.bps_kode_desa_kelurahan),
    kode_pos: norm(r.kode_pos),
    kelurahan: norm(r.kemendagri_nama_desa_kelurahan || r.bps_nama_desa_kelurahan),
    kecamatan: norm(r.kemendagri_nama_kecamatan || r.bps_nama_kecamatan),
    kabupaten_kota: norm(r.nama_kabupaten_kota || r.kemendagri_nama_kabupaten_kota),
    provinsi: norm(r.nama_kemendagri_provinsi || r.nama_bps_provinsi),
    tahun: norm(r.tahun).slice(0, 4),
  }));
  const total = Number(json?.meta?.total_record || json?.metadata?.total_record || 0);
  return { rows, total: total || rows.length };
}

/** Sumber 2: CSV GitHub dengan nama wilayah (di-cache per instance, 10 menit). */
let csvCache: { at: number; rows: NormRow[] } | null = null;

/** Nama wilayah bisa mengandung koma: 6 field pertama numerik, 4 nama dari belakang. */
function parseCsv(text: string): NormRow[] {
  const rows: NormRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const f = line.split(',');
    if (f.length < 10) continue;
    const kodePos = f[5].trim();
    const kel = f.slice(6, f.length - 3).join(',').trim();
    if (!/^\d{5}$/.test(kodePos) || !kel) continue;
    rows.push({
      // Dataset ini tidak punya kode wilayah resmi; subdis_id-nya dipakai sebagai kunci
      // stabil supaya baris tidak menumpuk saat sumber hanya mengganti nama wilayah.
      kode_wilayah: `id${f[1].trim()}`.slice(0, 13),
      kode_pos: kodePos,
      kelurahan: kel,
      kecamatan: f[f.length - 3].trim(),
      kabupaten_kota: f[f.length - 2].trim(),
      provinsi: f[f.length - 1].trim(),
      tahun: '',
    });
  }
  return rows;
}

async function loadCsvPage(skip: number, size = PAGE_SIZE): Promise<{ rows: NormRow[]; total: number }> {
  if (!csvCache || Date.now() - csvCache.at > 10 * 60 * 1000) {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`Sumber cadangan menolak (HTTP ${res.status}).`);
    csvCache = { at: Date.now(), rows: parseCsv(await res.text()) };
  }
  return { rows: csvCache.rows.slice(skip, skip + size), total: csvCache.rows.length };
}

type SourceId = 'kemendagri' | 'pemda' | 'cadangan';

interface BaselineSource {
  id: SourceId;
  label: string;
  load: (skip: number, size?: number) => Promise<{ rows: NormRow[]; total: number }>;
}

const SOURCES: BaselineSource[] = [
  { id: 'kemendagri', label: 'Dump resmi Kemendagri (wilayah + kode pos)', load: loadKemendagriPage },
  { id: 'pemda', label: 'Satu Data Indonesia (Bappenas)', load: loadPemdaPage },
  { id: 'cadangan', label: 'Mirror GitHub (komunitas)', load: loadCsvPage },
];

function sourceById(id: string | null | undefined): BaselineSource {
  return SOURCES.find((s) => s.id === id) || SOURCES[0];
}

/**
 * Kunci baris baseline: kode wilayah asli, atau pengganti pendek bila sumber tak memilikinya. */
function baseKey(r: NormRow): string {
  const k = r.kode_wilayah.replace(/\s+/g, '');
  if (k && k.length <= 13) return k;
  let h = 2166136261;
  const seed = `${r.kode_pos}|${r.kelurahan}|${r.kecamatan}`;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return `x${h.toString(36)}`;
}

/** Titik diterima hanya bila kode wilayah 13 digit dan koodinatnya masuk wilayah Indonesia. */
function bersihTitik(raw: any) {
  const kode = String(raw?.kode ?? raw?.kode_wilayah ?? '').trim();
  if (!/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/.test(kode)) return null;
  const lat = Number(raw?.lat ?? raw?.latitude);
  const lng = Number(raw?.lng ?? raw?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -11 || lat > 41 || lng < 89 || lng > 145) return null;
  const elev = Number(raw?.elev ?? raw?.elevasi);
  return {
    kode,
    kodePos: String(raw?.kodePos ?? raw?.kode_pos ?? '').trim().slice(0, 10),
    lat,
    lng,
    elev: Number.isFinite(elev) ? Math.round(elev) : null,
  };
}

/**
 * Pilih sumber untuk penarikan baru: coba setiap sumber dengan satu halaman kecil.
 * Sumber pertama yang membalas JSON/CSV yang masuk akal dipakai sampai selesai.
 */
async function resolveSource(): Promise<BaselineSource> {
  const errors: string[] = [];
  for (const s of SOURCES) {
    try {
      const probe = await s.load(0, 5);
      if (probe.rows.length > 0 && /^\d{5}$/.test(probe.rows[0].kode_pos)) return s;
      errors.push(`${s.id}: balasan kosong/tidak dikenali`);
    } catch (err: any) {
      errors.push(`${s.id}: ${err?.message || err}`);
    }
  }
  throw new Error(`Semua sumber gagal — ${errors.join(' | ')}`);
}

/** Bentuk baris baseline untuk upsert (PostgREST hanya menyegarkan kolom yang dikirim). */
function barisBaseline(r: NormRow, sumber: string, versi: number) {
  return {
    kode_wilayah: r.kode_wilayah,
    kode_pos: r.kode_pos,
    kelurahan: r.kelurahan,
    kecamatan: r.kecamatan,
    kabupaten_kota: r.kabupaten_kota,
    provinsi: r.provinsi,
    sumber,
    versi,
    diambil_pada: new Date().toISOString(),
  };
}

/** Kirim hasil unduhan per 500 baris supaya badan permintaan tetap kecil. */
async function simpanBaseline(sb: ReturnType<typeof rest>, rows: NormRow[], sumber: string, versi: number): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    await sb.simpan('kodepos_baseline', rows.slice(i, i + 500).map((r) => barisBaseline(r, sumber, versi)), {
      onKonflik: 'kode_wilayah',
    });
  }
}

/**
 * Probe murah: minta 1 byte dari tiap sumber. Dipakai `?view=meta&probe=1` untuk
 * menjawab "kenapa penarikan gagal" tanpa menulis apa pun ke database.
 */
async function probeSumber(): Promise<Record<string, string>> {
  const target: Record<string, string> = {
    kemendagri_wilayah: WILAYAH_URL,
    kemendagri_kodepos: KODEPOS_SQL_URL,
    pemda: PEMDA_URL,
    cadangan: CSV_URL,
    titik_situs: 'https://kodepos.co.id/sitemaps/kecamatan.xml',
  };
  const out: Record<string, string> = {};
  await Promise.all(
    Object.entries(target).map(async ([id, u]) => {
      try {
        const r = await fetch(u, { headers: { Range: 'bytes=0-0' }, redirect: 'follow' });
        out[id] = String(r.status);
      } catch (err: any) {
        out[id] = String(err?.message || err).slice(0, 90);
      }
    })
  );

  /*
   * Satu halaman kecamatan sungguhan: status + ukuran + berapa desa yang terbaca di
   * payload Next.js. Angka ini yang menentukan apakah crawl koordinat bisa dijalankan
   * dari server (bukan hanya dari laptop) — dan berapa panggilan yang dibutuhkan.
   */
  try {
    const t0 = Date.now();
    const xml = await (await fetch(target.titik_situs)).text();
    const url = (xml.match(/<loc>(https?:\/\/[^<]+)<\/loc>/g) || [])
      .map((s) => s.replace(/<\/?loc>/g, ''))
      .find((s) => !s.endsWith('kecamatan.xml'));
    if (!url) {
      out.titik_halaman = 'sitemap tidak memuat URL halaman';
    } else {
      const html = await (await fetch(url)).text();
      let teks = '';
      for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
        try {
          teks += JSON.parse(m[1]);
        } catch {
          /* chunk tidak lengkap */
        }
      }
      const desa = (teks.match(/"kodeKemendagri":"\d{2}\.\d{2}\.\d{2}\.\d{4}","lat":-?\d+(\.\d+)?/g) || []).length;
      out.titik_halaman = `${url.split('/').slice(-1)[0]}: ${html.length} byte, ${desa} desa berkoordinat, ${Date.now() - t0} ms`;
    }
  } catch (err: any) {
    out.titik_halaman = String(err?.message || err).slice(0, 90);
  }
  return out;
}

/** Titik per desa diambil dari sini; sitemap kecamatan-nya daftar lengkapnya. */
const SITUS_TITIK = 'https://kodepos.co.id';
const SITEMAP_TITIK = `${SITUS_TITIK}/sitemaps/kecamatan.xml`;
const TITIK_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/**
 * Satu-satunya daftar lengkap per halaman: payload Next.js di dalam self.__next_f.
 * Tabel HTML-nya dipotong 25 desa (terukur 2026-09-20: 214 kecamatan kehilangan 2.865 desa).
 */
const DESA_RE =
  /"nama":"((?:[^"\\]|\\.)*)","slug":"[^"]*","kodePos":"(\d{5})","kodeKemendagri":"(\d{2}\.\d{2}\.\d{2}\.\d{4})","lat":(-?\d+(?:\.\d+)?),"lng":(-?\d+(?:\.\d+)?)(?:,"elevasi":(-?\d+(?:\.\d+)?))?/g;

function unescapePayload(html: string): string {
  let teks = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      teks += JSON.parse(m[1]);
    } catch {
      /* chunk tidak lengkap — lewati */
    }
  }
  return teks;
}

/** Desa berkoordinat pada satu halaman kecamatan, sudah dilewatkan pemeriksaan kewarasan. */
function parseTitikHalaman(html: string) {
  const rows: { kode: string; kodePos: string; lat: number; lng: number; elev: number | null }[] = [];
  for (const m of unescapePayload(html).matchAll(DESA_RE)) {
    const lat = Number(m[4]);
    const lng = Number(m[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -11 || lat > 41 || lng < 89 || lng > 145) continue;
    const elev = Number(m[6]);
    rows.push({ kode: m[3], kodePos: m[2], lat, lng, elev: Number.isFinite(elev) ? Math.round(elev) : null });
  }
  return rows;
}

/** Daftar URL kecamatan dari sitemap; di-cache per instance 1 jam (7.277 URL). */
let sitemapCache: { at: number; url: string[] } | null = null;

async function daftarUrlKecamatan(): Promise<string[]> {
  if (sitemapCache && Date.now() - sitemapCache.at < 60 * 60 * 1000) return sitemapCache.url;
  const res = await fetch(SITEMAP_TITIK, { headers: { 'User-Agent': TITIK_UA } });
  if (!res.ok) throw new Error(`Sitemap kecamatan menolak (HTTP ${res.status}).`);
  const xml = await res.text();
  const url = [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => !u.endsWith('kecamatan.xml'));
  if (url.length < 1000) throw new Error(`Hanya ${url.length} URL kecamatan terbaca — sitemap berubah atau diblokir.`);
  sitemapCache = { at: Date.now(), url };
  return url;
}

async function ambilHalamanTitik(url: string): Promise<string> {
  for (let coba = 1; coba <= 2; coba++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': TITIK_UA, Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return await res.text();
      if (res.status === 404) return '';
    } catch {
      /* timeout / koneksi putus — dicoba sekali lagi */
    }
    if (coba === 2) return '';
  }
  return '';
}

/**
 * Crawl SEBAGIAN halaman kecamatan per panggilan. Terukur dari Vercel 2026-09-23:
 * 98.719 byte per halaman, ±220 ms untuk sitemap + satu halaman, HTTP 200 tanpa blok.
 * 800 halaman pada paralel 8 ≈ 20 detik ambil + beberapa detik tulis — aman di dalam
 * anggaran 60 detik fungsi, dan seluruh Indonesia (7.277 halaman) butuh ±10 panggilan.
 * Dari laptop dulu 460 detik; sekarang tombol cukup.
 */
async function crawlTitik(sb: ReturnType<typeof rest>, mulai: number, jumlah: number, onProgress?: (s: string) => void) {
  const urls = await daftarUrlKecamatan();
  const ambil = Math.max(0, Math.min(jumlah, urls.length - mulai));
  const target = urls.slice(mulai, mulai + ambil);
  const CONC = 8;
  const rows: { kode: string; kodePos: string; lat: number; lng: number; elev: number | null }[] = [];
  let sukses = 0;
  let gagal = 0;

  for (let i = 0; i < target.length; i += CONC) {
    const rombongan = target.slice(i, i + CONC);
    const hasil = await Promise.all(rombongan.map((u) => ambilHalamanTitik(u).catch(() => '')));
    for (const html of hasil) {
      if (!html) {
        gagal++;
        continue;
      }
      const desa = parseTitikHalaman(html);
      if (desa.length === 0) gagal++;
      else sukses++;
      rows.push(...desa);
    }
    onProgress?.(`${sukses + gagal}/${target.length} halaman`);
  }

  const unik = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!unik.has(r.kode)) unik.set(r.kode, r);
  const titik = [...unik.values()];
  const diambil_pada = new Date().toISOString();
  /*
   * 500 baris per statement — ukuran yang sudah terbukti di ?view=koordinat-ingest —
   * dan maksimal 5 statement berjalan bersamaan supaya tidak menghabiskan kolam
   * koneksi Supabase.
   */
  const POTONG = 500;
  const PARALEL_TULIS = 5;
  const potongan: typeof titik[] = [];
  for (let i = 0; i < titik.length; i += POTONG) potongan.push(titik.slice(i, i + POTONG));
  for (let i = 0; i < potongan.length; i += PARALEL_TULIS) {
    await Promise.all(
      potongan.slice(i, i + PARALEL_TULIS).map((bagian) =>
        sb.simpan(
          'kodepos_koordinat',
          bagian.map((x) => ({
            kode_wilayah: x.kode,
            kode_pos: x.kodePos || null,
            latitude: x.lat,
            longitude: x.lng,
            elevasi: x.elev,
            sumber: 'kodepos.co.id',
            diambil_pada,
          })),
          { onKonflik: 'kode_wilayah' }
        )
      )
    );
  }

  return { masuk: titik.length, barisDibaca: rows.length, sukses, gagal, total: urls.length, berikutnya: mulai + ambil };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  try {
    const sb = rest();
    const view = url.searchParams.get('view') || 'meta';

    // ─────────────── GET meta ───────────────
    if (req.method === 'GET' && view === 'meta') {
      const stats = await sb.rpc<Record<string, unknown>>('base_meta');
      return res.status(200).json({
        ok: true,
        configured: true,
        ready: Number(stats?.baris || 0) > 0,
        sumber: SOURCES.map((s) => s.label).join(' → '),
        stats: stats || null,
        probe: url.searchParams.get('probe') === '1' ? await probeSumber() : undefined,
      });
    }

    // ─────────────── GET diff ───────────────
    if (req.method === 'GET' && view === 'diff') {
      // base_diff mengerjakan seluruh aduan (kode pos unik, baris contoh, titik
      // dari kodepos_geo) dalam satu panggilan ke database.
      const t = (await sb.rpc<Record<string, any>>('base_diff', { p_cap: DIFF_CAP })) || {};
      const contoh: any[] = t.missingInDb || [];
      if (!Number(t.baris || 0)) {
        return res.status(200).json({ ok: true, configured: true, ready: false, message: 'Baseline belum tersimpan.' });
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        ready: true,
        version: t.versi || null,
        source: t.sumber || SOURCES[0].label,
        takenAt: t.diambil_pada || null,
        baselineRows: t.baris || 0,
        baselineCodes: t.kode_pos_unik || 0,
        dbCodes: t.dbCodes || 0,
        dbRows: t.dbRows || 0,
        missingCodesTotal: t.belum || 0,
        missingInDb: contoh.map((r) => ({
          kodePos: r.kodePos,
          kelurahan: r.kelurahan || '',
          kecamatan: r.kecamatan || '',
          kabupatenKota: r.kabupatenKota || '',
          provinsi: r.provinsi || '',
          status: 'AKTIF',
          latitude: r.latitude == null ? null : Number(r.latitude),
          longitude: r.longitude == null ? null : Number(r.longitude),
          geoSumber: r.geoSumber ?? null,
          geoPresisi: r.geoPresisi ?? null,
          geoTerverifikasi: r.geoTerverifikasi === true,
        })),
        codesOnlyInDb: t.hanyaDiDb || 0,
        truncated: contoh.length >= DIFF_CAP,
      });
    }

    // ─────────────── POST fetch (satu tahap) ───────────────
    // Upsert per kunci kode_wilayah (indeks unik yang sudah ada di tabel): panggilan
    // ulang tidak pernah membuat baris ganda, jadi penarikan yang terputus aman diulang.
    if (req.method === 'POST' && view === 'fetch') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const start = Math.max(0, Number(body.start) || 0);
      const pages = Math.min(PAGES_PER_CALL, Math.max(1, Number(body.pages) || PAGES_PER_CALL));
      const source = body.sourceId ? sourceById(String(body.sourceId)) : await resolveSource();

      let vers = Number(body.versi) || 0;
      if (!vers) vers = await sb.rpc<number>('base_next_versi');

      let upserted = 0;
      let total = 0;
      let consumed = 0;
      let exhausted = false;
      for (let p = 0; p < pages; p++) {
        const skip = start + p * PAGE_SIZE;
        const page = await source.load(skip);
        total = page.total || total;
        if (page.rows.length < PAGE_SIZE) exhausted = true;
        consumed = p + 1;

        // Satu kunci tidak boleh muncul dua kali dalam satu pernyataan upsert.
        const byKey = new Map<string, NormRow>();
        for (const r of page.rows) {
          if (!/^\d{5}$/.test(r.kode_pos)) continue;
          // Dump wilayah dan dump kode pos rilis pada tanggal berbeda: terukur 2026-09-23,
          // 560 dari 83.762 kode wilayah tidak punya nama lengkap 4 levelnya. Baris tanpa
          // nama tidak bisa dipakai memverifikasi alamat dan hanya menambah sel kosong
          // di tabel kerja (base_import_missing menyalin apa adanya).
          if (!r.kelurahan || !r.kecamatan || !r.kabupaten_kota || !r.provinsi) continue;
          const key = baseKey(r);
          byKey.set(key, { ...r, kode_wilayah: key });
        }
        const rows = [...byKey.values()];
        if (rows.length > 0) {
          await simpanBaseline(sb, rows, source.label, vers);
          upserted += rows.length;
        }
        if (exhausted || (total > 0 && skip + PAGE_SIZE >= total)) break;
      }

      const nextStart = start + consumed * PAGE_SIZE;
      const done = exhausted || (total > 0 && nextStart >= total);

      // Tarikan selesai -> buang versi lama. Diff membaca seluruh tabel tanpa filter versi,
      // jadi baris sumber lama yang tertinggal akan muncul sebagai desa ganda di atas yang baru.
      //
      // HANYA untuk dump resmi: kalau GitHub sedang menolak dan `resolveSource()` jatuh ke
      // mirror komunitas (terukur 81.061 baris vs 83.762 resmi), pembersihan ini akan
      // menguras patokan resmi yang sudah ada demi sumber yang lebih kecil.
      let dibuang = 0;
      if (done && upserted > 0 && source.id === 'kemendagri') {
        const filterLama = { versi: `neq.${vers}` };
        dibuang = await sb.hitung('kodepos_baseline', filterLama);
        await sb.hapus('kodepos_baseline', filterLama);
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        versi: vers,
        upserted,
        total,
        dibuang,
        nextStart: done ? null : nextStart,
        done,
        sumber: source.label,
        sumberId: source.id,
      });
    }

    /*
     * POST ?view=import-missing  salin patokan ke tabel kerja, SATU WINDOW PER PANGGILAN.
     *
     * Fungsi base_import_missing() menyalin seluruhnya dalam satu statement dan itu
     * selalu mati: Supabase memotong statement role `anon` (publishable key) pada 8
     * detik, sedang patokan 83 ribu baris (terukur 2026-09-23: "canceling statement
     * due to statement timeout"). Window per window lewat REST tetap di bawah batas
     * itu, dan `{ mulai }` membuat penarikan yang terputus bisa dilanjutkan persis
     * dari titik berhenti — tanpa langkah manual di konsol Supabase.
     */
    if (req.method === 'POST' && view === 'import-missing') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const mulai = Math.max(0, Number(body.mulai) || 0);
      const batas = Math.min(10_000, Math.max(200, Number(body.batas) || 10_000));
      /*
       * Batas baris per balasan PostgREST proyek ini 1.000 — terukur 2026-09-23:
       * `?limit=5000` tetap membalas 1.000 baris (`Content-Range: 0-999`). Window
       * besar jadi harus dibaca per halaman, kalau tidak tiap panggilan diam-diam
       * cuma memindahkan 1.000 baris dan pengisian penuh butuh 84 panggilan.
       */
      const PER_HALAMAN = 1000;
      const PER_STATEMENT = 2000;
      const bersih = (v: unknown) => String(v ?? '').trim();
      /*
       * Kunci baris = lima kolom penuh, SAMA dengan kodePosRowKey() di aplikasi.
       * Kunci lama (kode pos + kelurahan saja) menekan 33 desa yang namanya memang
       * kembar di kecamatan berbeda — data resmi hilang diam-diam di jalan masuk.
       */
      const KOLOM_KUNCI = 'kode_pos,kelurahan,kecamatan,kabupaten_kota,provinsi';
      const kunci = (r: Record<string, unknown>) =>
        ['kode_pos', 'kelurahan', 'kecamatan', 'kabupaten_kota', 'provinsi']
          .map((c) => bersih(r[c]).toUpperCase())
          .join('|');

      const KOLOM_PATOKAN = `kode_wilayah,${KOLOM_KUNCI}`;

      const halaman = Math.ceil(batas / PER_HALAMAN);
      const hasilHalaman = await Promise.all(
        Array.from({ length: halaman }, (_, i) =>
          sb
            .baris<Record<string, unknown>>('kodepos_baseline', {
              kolom: KOLOM_PATOKAN,
              urut: 'kode_wilayah.asc',
              batas: PER_HALAMAN,
              mulai: mulai + i * PER_HALAMAN,
              count: i === 0,
            })
            .catch((err: any) => {
              // Offset lewat isi: PostgREST membalas 416, bukan baris kosong.
              if (err?.status !== 416) throw err;
              return { rows: [] as Record<string, unknown>[], total: null };
            })
        )
      );
      const patokan = hasilHalaman.flatMap((h) => h.rows);
      const totalPatokan = hasilHalaman.find((h) => h.total != null)?.total ?? null;

      if (patokan.length === 0) {
        return res.status(200).json({
          ok: true, configured: true, masuk: 0, totalSetelah: await sb.hitung('kodepos_data'),
          selesai: true, berikutnya: null, totalPatokan: totalPatokan ?? 0,
        });
      }

      // Yang diperiksa hanya kode pos yang muncul di window ini, dan idx_kodepos_kode
      // memakainya — bukan membaca ulang seluruh tabel kerja tiap tahap. `semuaBaris`
      // wajib karena satu kode pos bisa membawa jauh lebih dari 1.000 baris kerja.
      const kodeUnik = [...new Set(patokan.map((r) => bersih(r.kode_pos)).filter((k) => /^\d{5}$/.test(k)))];
      const periksa: string[][] = [];
      for (let i = 0; i < kodeUnik.length; i += 500) periksa.push(kodeUnik.slice(i, i + 500));
      const sudahAda = new Set<string>();
      (
        await Promise.all(
          periksa.map((bagian) =>
            sb.semuaBaris<Record<string, unknown>>('kodepos_data', {
              kolom: KOLOM_KUNCI,
              filter: { kode_pos: `in.(${bagian.join(',')})` },
            })
          )
        )
      ).forEach((rows) => rows.forEach((r) => sudahAda.add(kunci(r))));

      const baru = new Map<string, Record<string, unknown>>();

      /*
       * Titik per desa ikut dibawa SEJAK PENYALINAN, bukan lewat `koordinat_salin`
       * di belakang: fungsi SQL itu harus memindahkan 85 ribu baris dalam satu
       * statement dan dipotong 8 detik oleh batas role `anon` — persis cacat yang
       * baru saja diperbaiki pada baris patokan. Kuncinya kode wilayah, sama seperti
       * saat crawl titik menyimpannya.
       */
      const kodeDesa = [...new Set(patokan.map((r) => bersih(r.kode_wilayah)).filter((k) => k.length === 13))];
      const titik = new Map<string, Record<string, unknown>>();
      const rombangKode: string[][] = [];
      for (let i = 0; i < kodeDesa.length; i += 400) rombangKode.push(kodeDesa.slice(i, i + 400));
      (
        await Promise.all(
          rombangKode.map((bagian) =>
            sb.semuaBaris<Record<string, unknown>>('kodepos_koordinat', {
              kolom: 'kode_wilayah,latitude,longitude,sumber,diambil_pada',
              filter: { kode_wilayah: `in.(${bagian.join(',')})` },
            })
          )
        )
      ).forEach((rows) => rows.forEach((t) => titik.set(bersih(t.kode_wilayah), t)));
      let bertitik = 0;

      for (const r of patokan) {
        const k = kunci(r);
        if (sudahAda.has(k) || baru.has(k)) continue;
        const t = titik.get(bersih(r.kode_wilayah));
        const lat = Number(t?.latitude);
        const lng = Number(t?.longitude);
        const punyaTitik = Number.isFinite(lat) && Number.isFinite(lng);
        if (punyaTitik) bertitik++;
        baru.set(k, {
          kode_pos: bersih(r.kode_pos),
          kelurahan: bersih(r.kelurahan),
          kecamatan: bersih(r.kecamatan),
          kabupaten_kota: bersih(r.kabupaten_kota),
          provinsi: bersih(r.provinsi),
          status: 'AKTIF',
          latitude: punyaTitik ? lat : null,
          longitude: punyaTitik ? lng : null,
          sumber_koordinat: punyaTitik ? String(t?.sumber || 'kodepos.co.id') : null,
          diambil_pada: punyaTitik ? t?.diambil_pada ?? null : null,
        });
      }
      const kiriman = [...baru.values()];

      /*
       * Dipecah karena satu statement 83 ribu baris dipotong 8 detik oleh batas role
       * `anon` — tapi pecahannya jalan PARALEL, bukan berurutan: yang berurutan itulah
       * yang membuat pengisian penuh terasa memakan waktu ber menit-menit.
       */
      const potongan: unknown[][] = [];
      for (let i = 0; i < kiriman.length; i += PER_STATEMENT) potongan.push(kiriman.slice(i, i + PER_STATEMENT));
      await Promise.all(potongan.map((bagian) => sb.simpan('kodepos_data', bagian)));

      return res.status(200).json({
        ok: true,
        configured: true,
        masuk: kiriman.length,
        bertitik,
        totalSetelah: await sb.hitung('kodepos_data'),
        berikutnya: mulai + patokan.length,
        selesai: mulai + patokan.length >= (totalPatokan ?? 0),
        totalPatokan: totalPatokan ?? 0,
      });
    }

    // ─────────────── KOORDINAT: cakupan ───────────────
    if (req.method === 'GET' && view === 'koordinat') {
      const s = (await sb.rpc<Record<string, any>>('koordinat_cakupan')) || {};
      return res.status(200).json({
        ok: true,
        configured: true,
        patokanTitik: s.patokan_titik ?? 0,
        dataTotal: s.data_total ?? 0,
        dataTitik: s.data_titik ?? 0,
        tanpaTitik: (s.data_total ?? 0) - (s.data_titik ?? 0),
        kodePosTitik: s.kode_pos_titik ?? 0,
        diLuarWilayah: s.di_luar_wilayah ?? 0,
        takTerkenalan: s.tak_terkenalan ?? 0,
        kodeWilayahCocok: s.kode_wilayah_cocok ?? 0,
        kodePosCocok: s.kode_pos_cocok ?? 0,
        terakhir: s.terakhir ?? null,
      });
    }

    // ─────────────── KOORDINAT: setor hasil crawl ───────────────
    if (req.method === 'POST' && view === 'koordinat-ingest') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const raw = Array.isArray(body?.rows) ? body.rows : [];
      if (!raw.length) return res.status(400).json({ ok: false, error: 'body.rows harus array tidak kosong.' });
      const rows = raw
        .slice(0, 5000)
        .map(bersihTitik)
        .filter((x): x is NonNullable<ReturnType<typeof bersihTitik>> => Boolean(x));
      if (!rows.length) {
        return res.status(400).json({ ok: false, error: 'Tidak ada baris valid (kode wilayah 13 digit + titik Indonesia).' });
      }
      // Upsert per 500 baris; kolom yang dikirim sama persis dengan yang dulu ditulis
      // pernyataan INSERT ... ON CONFLICT.
      for (let i = 0; i < rows.length; i += 500) {
        await sb.simpan(
          'kodepos_koordinat',
          rows.slice(i, i + 500).map((x) => ({
            kode_wilayah: x.kode,
            kode_pos: x.kodePos || null,
            latitude: x.lat,
            longitude: x.lng,
            elevasi: x.elev,
            sumber: 'kodepos.co.id',
            diambil_pada: new Date().toISOString(),
          })),
          { onKonflik: 'kode_wilayah' }
        );
      }
      return res.status(200).json({ ok: true, configured: true, masuk: rows.length, ditolak: raw.length - rows.length });
    }

    // ─────────────── KOORDINAT: crawl halaman kecamatan ───────────────
    if (req.method === 'POST' && view === 'koordinat-crawl') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const mulai = Math.max(0, Number(body.mulai) || 0);
      const jumlah = Math.min(1500, Math.max(50, Number(body.jumlah) || 800));
      const r = await crawlTitik(sb, mulai, jumlah);
      return res.status(200).json({
        ok: true,
        configured: true,
        masuk: r.masuk,
        barisDibaca: r.barisDibaca,
        sukses: r.sukses,
        gagal: r.gagal,
        total: r.total,
        berikutnya: r.berikutnya,
        selesai: r.berikutnya >= r.total,
      });
    }

    // ─────────────── KOORDINAT: turunkan ke tabel kerja ───────────────
    if (req.method === 'POST' && view === 'koordinat-salin') {
      const hasil = (await sb.rpc<{ disalin: number; tanpaTitik: number }>('koordinat_salin')) || {
        disalin: 0,
        tanpaTitik: 0,
      };
      return res.status(200).json({
        ok: true,
        configured: true,
        disalin: Number(hasil.disalin || 0),
        tanpaTitik: Number(hasil.tanpaTitik || 0),
      });
    }

    // ─────────────── RESET ───────────────
    if (req.method === 'DELETE') {
      await sb.hapus('kodepos_baseline');
      return res.status(200).json({ ok: true, configured: true, message: 'Tabel baseline dikosongkan.' });
    }

    return res.status(400).json({
      ok: false,
      error: 'Gunakan ?view=meta|diff|koordinat atau POST ?view=fetch|import-missing|koordinat-ingest|koordinat-salin.',
    });
  } catch (error: any) {
    console.error('Kodepos baseline error:', error);
    const status = Number(error?.status) || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      ok: false,
      configured: true,
      error: pesanRest(error, 'Baseline kodepos gagal.'),
    });
  }
}
