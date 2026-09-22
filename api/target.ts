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
 * /api/target — Supabase Postgres CRUD Data Target & Match, lewat PostgREST.
 *
 * GET    ?limit=N&offset=M   → halaman saja + total (tanpa param = semua baris, kompatibel lama)
 * POST   body { rows, fileName, mode:'replace'|'append' }
 * DELETE → kosongkan tabel
 *
 * --- ?view=final (Data Final Analisa; satu-satunya jalur cloud untuk `analyst_final_data`) ---
 * GET    ?view=final&limit=N&offset=M → halaman baris + total (order = row_key agar paging stabil)
 * POST   ?view=final  body { rows, mode:'upsert'|'replace' } → upsert per baris, tanpa menghapus
 *        baris lain (kecuali mode 'replace'), jadi tidak ada jendela "cloud kosong".
 * POST   ?view=final  body { mode:'hapus', keys:[...] } → hapus ≤1000 baris sekali jalan
 *        (lewat fungsi final_hapus: kuncinya parameter ternama, bukan teks yang digabung).
 * DELETE ?view=final&key=K  → hapus 1 baris | ?view=final&all=1 → kosongkan seluruh tabel
 *
 * Skema + fungsinya dibuat server/supabase-bootstrap.sql, bukan oleh fungsi ini.
 */

// Impor puluhan ribu baris bisa lama — samakan batas dengan /api/kodepos.
export const maxDuration = 60;

const PAGE_SIZE_CAP = 500;

/** ?view=final selalu dipaging — tanpa `limit` pun satu baca maksimal seukuran ini. */
const FINAL_PAGE_DEFAULT = 500;
/** Baris per kiriman; ~40 kolom × 200 baris masih jauh di bawah batas body serverless. */
const FINAL_INSERT_CHUNK = 200;
const CHUNK = 200;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  const r = rest();
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw === null ? null : Math.min(PAGE_SIZE_CAP, Math.max(1, Number(limitRaw) || 1));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

  try {
    // ─────────────── GET ───────────────
    if (req.method === 'GET') {
      if (url.searchParams.get('view') === 'final') {
        const fLimit = limit ?? FINAL_PAGE_DEFAULT;
        const { rows, total } = await r.baris<{ raw_data: any }>('final_rows', {
          kolom: 'raw_data',
          urut: 'row_key.asc',
          batas: fLimit,
          mulai: offset,
          count: true,
        });
        return res.status(200).json({
          ok: true,
          configured: true,
          table: 'final_rows',
          total: total ?? rows.length,
          returned: rows.length,
          offset,
          limit: fLimit,
          data: { rows: rows.map((x) => x.raw_data) },
        });
      }

      const dibaca = limit
        ? await r.baris<any>('target_records', { urut: 'no_urut.asc,id.asc', batas: limit, mulai: offset, count: true })
        : { rows: await r.semuaBaris<any>('target_records', { urut: 'no_urut.asc,id.asc' }), total: null as number | null };
      const records = dibaca.rows;

      if (records.length > 0) {
        const meta = await r
          .baris<{ file_name: string | null; initial_count: number | null; matched_done: boolean | null }>(
            'target_meta',
            { kolom: 'file_name,initial_count,matched_done', filter: { key: 'eq.target_meta' }, batas: 1 }
          )
          .then((x) => x.rows[0]);

        const fileName = meta?.file_name || `${records.length} Data Target (Target_Neon.xlsx)`;
        const initialCount = meta?.initial_count || records.length;
        const matchedDone = Boolean(meta?.matched_done);

        const mappedRows = records.map((raw: any) => ({
          No: raw.no_urut,
          Wilayah: raw.wilayah || '',
          'Branch Code': raw.branch_code || '',
          'Kode Cabang': raw.kode_cabang || '',
          'Nama Outlet': raw.nama_outlet || '',
          'Status Outlet': raw.status_outlet || '',
          'Sandi Cabang': raw.sandi_cabang || '',
          Sandi: raw.sandi || '',
          Cabang: raw.cabang || '',
          ALAMAT: raw.alamat || '',
          'KODE POS': raw.kode_pos || '',
          Kelurahan: raw.kelurahan || '',
          Kecamatan: raw.kecamatan || '',
          'Dati II': raw.dati_ii || '',
          'Kode Dati II': raw.kode_dati_ii || '',
          Provinsi: raw.provinsi || '',
          'SUMBER DATA': raw.sumber_data || '',
          _isMatched: Boolean(raw.is_matched),
          _matchLevel: raw.match_level || undefined,
          _matchedAt: raw.matched_at || undefined,
          _matchedBy: raw.matched_by || undefined,
          ...(raw.raw_data || {}),
        }));

        return res.status(200).json({
          ok: true,
          configured: true,
          table: 'target_records',
          total: dibaca.total ?? mappedRows.length,
          returned: mappedRows.length,
          offset,
          data: { rows: mappedRows, fileName, initialCount, matchedDone },
        });
      }

      const simpanan = await bacaAppStore(r, 'target_data');
      if (simpanan) {
        return res
          .status(200)
          .json({ ok: true, configured: true, table: 'app_store', data: simpanan.data, updatedAt: simpanan.updated_at });
      }

      return res.status(200).json({ ok: true, configured: true, table: 'target_records', total: 0, data: null });
    }

    // ─────────────── POST ───────────────
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      const viewPost = url.searchParams.get('view');

      // `view` tak dikenal tidak boleh jatuh ke jalur target_records
      // (mode 'replace' di sana menghapus seluruh tabel lebih dulu).
      if (viewPost && viewPost !== 'final') {
        return res.status(400).json({
          ok: false,
          configured: true,
          error: `view=${viewPost} tidak dikenal untuk POST /api/target.`,
        });
      }

      if (viewPost === 'final') {
        if (body?.mode === 'hapus') {
          const mentah: unknown[] = Array.isArray(body.keys) ? body.keys : [];
          const kunci = [...new Set(mentah.map((k) => String(k ?? '').trim()).filter(Boolean))];
          if (kunci.length === 0) {
            return res.status(400).json({ ok: false, configured: true, error: "mode 'hapus' membutuhkan body.keys berisi row_key." });
          }
          if (kunci.length > 1000) {
            return res.status(400).json({
              ok: false,
              configured: true,
              error: `Maksimal 1000 kunci per permintaan (diterima ${kunci.length}); kirim per chunk.`,
            });
          }
          const terhapus = (await r.rpc<string[]>('final_hapus', { p_keys: kunci })) || [];
          return res.status(200).json({
            ok: true,
            configured: true,
            table: 'final_rows',
            deleted: terhapus.length,
            diminta: kunci.length,
            message: `${terhapus.length} dari ${kunci.length} baris Data Final terhapus dari Supabase Postgres.`,
          });
        }

        const fMode = body?.mode === 'replace' ? 'replace' : 'upsert';
        if (fMode === 'replace') await r.hapus('final_rows');

        let written = 0;
        for (let i = 0; i < rows.length; i += FINAL_INSERT_CHUNK) {
          const chunk = rows
            .slice(i, i + FINAL_INSERT_CHUNK)
            .map((raw: any) => ({ row_key: String(raw?.id ?? '').trim(), raw_data: raw }))
            .filter((x) => x.row_key.length > 0);
          if (chunk.length === 0) continue;
          await r.simpan('final_rows', chunk, { onKonflik: 'row_key' });
          written += chunk.length;
        }

        const total = await r.hitung('final_rows').catch(() => written);
        return res.status(200).json({
          ok: true,
          configured: true,
          table: 'final_rows',
          written,
          totalRows: total,
          message: `${written} baris Data Final tersimpan permanen di tabel final_rows (total ${total} baris).`,
        });
      }

      const fileName = body?.fileName || 'Target_Neon_Vercel.xlsx';
      const initialCount = body?.initialCount || rows.length;
      const matchedDone = Boolean(body?.matchedDone);
      const mode = body?.mode || 'replace';

      if (mode === 'replace') await r.hapus('target_records');

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((raw: any, idx: number) => ({
          no_urut: typeof raw.No === 'number' ? raw.No : parseInt(raw.No, 10) || i + idx + 1,
          wilayah: String(raw.Wilayah || '').trim(),
          branch_code: String(raw['Branch Code'] || raw['Kode Cabang'] || '').trim(),
          kode_cabang: String(raw['Kode Cabang'] || raw['Branch Code'] || '').trim(),
          nama_outlet: String(raw['Nama Outlet'] || '').trim(),
          sandi_cabang: String(raw['Sandi Cabang'] || raw.Sandi || raw.Cabang || '').trim(),
          sandi: String(raw.Sandi || raw['Sandi Cabang'] || '').trim(),
          cabang: String(raw.Cabang || '').trim(),
          status_outlet: String(raw['Status Outlet'] || '').trim(),
          alamat: String(raw.ALAMAT || '').trim(),
          kode_pos: String(raw['KODE POS'] || '').trim(),
          kelurahan: String(raw.Kelurahan || '').trim(),
          kecamatan: String(raw.Kecamatan || '').trim(),
          dati_ii: String(raw['Dati II'] || '').trim(),
          kode_dati_ii: String(raw['Kode Dati II'] || '').trim(),
          provinsi: String(raw.Provinsi || '').trim(),
          sumber_data: String(raw['SUMBER DATA'] || '').trim(),
          is_matched: Boolean(raw._isMatched),
          match_level: raw._matchLevel ? String(raw._matchLevel) : null,
          matched_at: raw._matchedAt ? String(raw._matchedAt) : null,
          matched_by: raw._matchedBy ? String(raw._matchedBy) : null,
          raw_data: raw,
          updated_at: new Date().toISOString(),
        }));
        if (chunk.length > 0) await r.simpan('target_records', chunk);
      }

      const totalCount = await r.hitung('target_records').catch(() => rows.length);
      await r.simpan(
        'target_meta',
        [
          {
            key: 'target_meta',
            file_name: fileName,
            initial_count: initialCount,
            matched_done: matchedDone,
            updated_at: new Date().toISOString(),
          },
        ],
        { onKonflik: 'key' }
      );
      await tulisAppStore(r, 'target_data', body);

      return res.status(200).json({
        ok: true,
        configured: true,
        table: 'target_records',
        totalRows: totalCount,
        message: `Sebanyak ${rows.length} data target & status matching berhasil disimpan permanen ke tabel target_records di Supabase Postgres.`,
      });
    }

    // ─────────────── DELETE ───────────────
    if (req.method === 'DELETE') {
      const viewDel = url.searchParams.get('view');

      // Parameter `view` yang tidak dikenal = salah ketik URL. Tanpa penolakan ini,
      // satu karakter `&` yang tertinggal akan menjatuhkan permintaan ke penghapusan
      // seluruh target_records di bawah.
      if (viewDel && viewDel !== 'final') {
        return res.status(400).json({
          ok: false,
          configured: true,
          error: `view=${viewDel} tidak dikenal untuk DELETE /api/target.`,
        });
      }

      if (viewDel === 'final') {
        const oneKey = (url.searchParams.get('key') || '').trim();
        if (url.searchParams.get('all') === '1') {
          const sebelum = await r.hitung('final_rows');
          await r.hapus('final_rows');
          return res.status(200).json({
            ok: true,
            configured: true,
            table: 'final_rows',
            deleted: sebelum,
            message: `Tabel final_rows berhasil dikosongkan (${sebelum} baris dihapus).`,
          });
        }
        if (oneKey) {
          const terhapus = (await r.rpc<string[]>('final_hapus', { p_keys: [oneKey] })) || [];
          return res.status(200).json({
            ok: true,
            configured: true,
            table: 'final_rows',
            deleted: terhapus.length,
            message: terhapus.length
              ? `Baris Data Final ${oneKey} berhasil dihapus dari Supabase Postgres.`
              : `Baris ${oneKey} tidak ditemukan di final_rows (mungkin belum pernah disinkronkan).`,
          });
        }
        return res.status(400).json({
          ok: false,
          configured: true,
          error: 'DELETE ?view=final membutuhkan ?key=<row id> atau ?all=1.',
        });
      }

      await r.hapus('target_records');
      await r.hapus('target_meta');
      await hapusAppStore(r, 'target_data');

      return res.status(200).json({
        ok: true,
        configured: true,
        message: 'Tabel target_records dan target_meta berhasil direset/dikosongkan dari Supabase Postgres.',
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Supabase API Error (Target):', error);
    return res.status(500).json({ ok: false, configured: true, error: pesanRest(error) });
  }
}
