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
 * /api/rolemapping — master pemetaan role tersimpan di app_store kunci `rolemapping_data`.
 * Bicara ke Supabase lewat PostgREST + publishable key: tanpa kata sandi basis data.
 */
export default async function handler(req: any, res: any) {
  // Vercel Hobby membatasi api/ ke 12 fungsi per deploy. Rute Tracking Merchant
  // menumpang di sini (?tm=1) karena berkas terpisah akan jadi fungsi ke-13 dan
  // menggagalkan seluruh deployment.
  if (String(req.query?.tm || '') === '1') return tanganiTrackingMerchant(req, res);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  const r = rest();
  const KUNCI = 'rolemapping_data';

  try {
    if (req.method === 'GET') {
      const baris = await bacaAppStore(r, KUNCI);
      return res
        .status(200)
        .json(
          baris
            ? { ok: true, configured: true, data: baris.data, updatedAt: baris.updated_at }
            : { ok: true, configured: true, data: null }
        );
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await tulisAppStore(r, KUNCI, body);
      return res.status(200).json({
        ok: true,
        configured: true,
        message: 'Data master RoleMapping berhasil disimpan ke Supabase Postgres.',
      });
    }

    if (req.method === 'DELETE') {
      await hapusAppStore(r, KUNCI);
      return res.status(200).json({
        ok: true,
        configured: true,
        message: 'Data master RoleMapping berhasil dibersihkan dari Supabase Postgres.',
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Supabase API Error (RoleMapping):', error);
    return res.status(500).json({ ok: false, configured: true, error: pesanRest(error) });
  }
}

// ─── PENGAMBILAN DATA TRACKING MERCHANT ──────────────────────────────────────
// Blok di antara panah di bawah diuji APA ADANYA oleh tests/uji-tracking-merchant.mjs:
// berkas ini dibaca, potongannya diambil, lalu dijalankan di Node. Karena itu blok ini
// ditulis tanpa anotasi tipe — TypeScript menerima itu, Node juga.
// <<PANAH-AWAL>>
const MARKER_TM = 'trackingMIDDatabase = ';

/**
 * Whitelist kolom: 20 dari 27 kolom data yang ditampilkan sumber. Sengaja daftar putih,
 * bukan daftar hitam — yang sengaja TIDAK diambil adalah inputer_name, nomor_rekening,
 * nomor_ktp, nomor_npwp, email, no_hp, no_telp, dan tidak ada satu pun yang boleh
 * melewati fungsi ini.
 */
const FIELD_TM = [
  'mid', 'nama_merchant', 'kriteria_merchant', 'jenis_pengajuan', 'jenis_qr', 'tgl_pengajuan',
  'last_update', 'status', 'ref_no', 'source_onboarding', 'merchant_segment', 'branch_code',
  'alamat', 'provinsi', 'kabupaten_kota', 'kecamatan', 'kelurahan', 'kode_pos',
  'jenis_usaha', 'referral_code',
];

/** Ambil literal `trackingMIDDatabase = [ ... ]` dari HTML — sumbernya bukan JSON endpoint. */
function ambilLiteralTrackingMID(html) {
  const teks = String(html || '');
  const mulai = teks.indexOf(MARKER_TM);
  if (mulai < 0) {
    throw new Error('Halaman sumber tidak lagi memuat data Tracking Merchant (marker tidak ditemukan).');
  }
  const buka = mulai + MARKER_TM.length;
  let dalam = 0, i = buka, kurung = false, lolos = false;
  for (; i < teks.length; i++) {
    const c = teks[i];
    if (kurung) {
      if (lolos) lolos = false;
      else if (c === '\\') lolos = true;
      else if (c === '"') kurung = false;
      continue;
    }
    if (c === '"') { kurung = true; continue; }
    if (c === '[' || c === '{') dalam++;
    else if (c === ']' || c === '}') {
      dalam--;
      if (dalam === 0) { i++; break; }
    }
  }
  if (dalam !== 0) throw new Error('Literal data Tracking Merchant tidak tertutup — halaman sumber berubah format.');
  let list;
  try {
    list = JSON.parse(teks.slice(buka, i));
  } catch (err) {
    throw new Error('Literal data Tracking Merchant gagal dibaca sebagai JSON: ' + (err && err.message ? err.message : err));
  }
  if (!Array.isArray(list)) throw new Error('Data Tracking Merchant sumber bukan daftar.');
  return list;
}

const teksTm = (v) => (v === null || v === undefined ? '' : String(v).trim());

/**
 * Rata menjadi satu baris per riwayat pengajuan. MID dengan lebih dari satu event
 * menghasilkan lebih dari satu baris; idxRiwayat 1 = paling baru, supaya penanda
 * "2/3" di tabel terbaca seperti riwayat keberapa.
 */
function ratakanMerchantTm(list) {
  const baris = [];
  const asal = Array.isArray(list) ? list : [];
  for (const m of asal) {
    if (!m || typeof m !== 'object') continue;
    const events = Array.isArray(m.events) && m.events.length > 0 ? m.events : [{}];
    const urut = events
      .map((ev, idx) => ({ ev: ev && typeof ev === 'object' ? ev : {}, idx }))
      .sort((a, b) => {
        const x = teksTm(a.ev.tgl_pengajuan), y = teksTm(b.ev.tgl_pengajuan);
        if (x !== y) return x < y ? 1 : -1;
        return a.idx - b.idx;
      });
    urut.forEach(function (pas, n) {
      const ev = pas.ev;
      const barisNi = {};
      for (const k of FIELD_TM) barisNi[k] = teksTm(ev[k]);
      // Nilai identitas merchant kadang hanya ada di induk, bukan di event.
      if (!barisNi.mid) barisNi.mid = teksTm(m.mid);
      if (!barisNi['nama_merchant']) barisNi['nama_merchant'] = teksTm(m.nama_merchant);
      if (!barisNi['kriteria_merchant']) barisNi['kriteria_merchant'] = teksTm(m.kriteria);
      if (!barisNi.provinsi) barisNi.provinsi = teksTm(m.provinsi);
      if (!barisNi['kabupaten_kota']) barisNi['kabupaten_kota'] = teksTm(m.kota);
      baris.push({
        mid: barisNi.mid,
        namaMerchant: barisNi['nama_merchant'],
        kriteria: barisNi['kriteria_merchant'],
        jenisPengajuan: barisNi['jenis_pengajuan'],
        jenisQr: barisNi['jenis_qr'],
        tglPengajuan: barisNi['tgl_pengajuan'],
        lastUpdate: barisNi['last_update'],
        status: barisNi.status,
        refNo: barisNi.ref_no,
        sumberOnboarding: barisNi['source_onboarding'],
        merchantSegment: barisNi['merchant_segment'],
        branchCode: barisNi.branch_code,
        alamat: barisNi.alamat,
        provinsi: barisNi.provinsi,
        kabupatenKota: barisNi['kabupaten_kota'],
        kecamatan: barisNi.kecamatan,
        kelurahan: barisNi.kelurahan,
        kodePos: barisNi.kode_pos,
        jenisUsaha: barisNi.jenis_usaha,
        referralCode: barisNi.referral_code,
        totalRiwayat: urut.length,
        idxRiwayat: n + 1,
      });
    });
  }
  return baris;
}

/**
 * Empat kartu besar di halaman sumber BUKAN hasil hitung tabel: angkanya ditulis
 * langsung di HTML (terukur 2026-10-28 — "5.747.459" hanya muncul sebagai teks, tidak
 * ada satu pun skrip yang menghitungnya, sementara tabel di bawahnya berisi 167
 * merchant). Supaya angka di menu ini sama persis dengan sumber, kartunya dibaca apa
 * adanya saat sync. Label jadi jangkar; kartu yang tidak ditemukan dilewati dan sync
 * tetap jalan.
 */
const KARTU_SUMBER = [
  { label: 'Total Merchant Terdata', warna: 'biru' },
  { label: 'Active & NMID Terbit', warna: 'hijau' },
  { label: 'Reject PTEN (2026 YTD)', warna: 'merah' },
  { label: 'Digital Onboarding (MOM)', warna: 'ungu' },
];

function bersihTeks(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&bull;/g, '•').replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function ambilRingkasanSumber(html) {
  const teks = String(html || '');
  const hasil = [];
  for (const kartu of KARTU_SUMBER) {
    let mulai = -1;
    for (const k of [kartu.label, kartu.label.replace(/&/g, '&amp;')]) {
      const j = teks.indexOf('>' + k + '<');
      if (j >= 0) { mulai = j; break; }
    }
    if (mulai < 0) continue;
    const kelasNilai = teks.indexOf('text-3xl', mulai);
    if (kelasNilai < 0) continue;
    const bukaNilai = teks.indexOf('>', kelasNilai);
    const tutupNilai = bukaNilai >= 0 ? teks.indexOf('<', bukaNilai) : -1;
    if (bukaNilai < 0 || tutupNilai < 0) continue;
    const nilai = bersihTeks(teks.slice(bukaNilai + 1, tutupNilai));
    const pBuka = teks.indexOf('<p ', tutupNilai);
    const pTutup = pBuka >= 0 ? teks.indexOf('</p>', pBuka) : -1;
    const keterangan = pBuka >= 0 && pTutup > pBuka
      ? bersihTeks(teks.slice(teks.indexOf('>', pBuka) + 1, pTutup))
      : '';
    // Kaki kartu hanya diambil kalau memang menempel (< 400 karakter dari paragraf).
    const kakiBuka = pTutup >= 0 ? teks.indexOf('border-t', pTutup) : -1;
    const kaki = kakiBuka >= 0 && kakiBuka - pTutup < 400 ? teks.slice(kakiBuka, kakiBuka + 400) : '';
    const spans = [];
    for (const m of kaki.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)) {
      const isi = bersihTeks(m[1]);
      if (isi) spans.push(isi);
    }
    if (!nilai) continue;
    hasil.push({
      label: kartu.label,
      nilai,
      keterangan,
      kakiKiri: spans[0] || '',
      kakiKanan: spans[1] || '',
      warna: kartu.warna,
    });
  }
  return hasil;
}
// <<PANAH-AKHIR>>

const KUNCI_TM = 'tracking_merchant_data';
const SUMUR_TM = process.env.TRACKING_MERCHANT_URL || 'http://154.19.37.201/migrasi/';
/** Satu unduhan HTML ±0,8 MB per sync; 3 menit cukup untuk klik berulang tanpa membebani sumber. */
const USIA_MAKSIMAL_MS = 3 * 60 * 1000;
/**
 * Sumbernya lambat dan tidak stabil: terukur 2026-10-28, tiga percobaan berturut-turut
 * selesai dalam 8,5 s, 52,5 s, dan satu percobaan terpotong di 60 s (41 KB dari 793 KB).
 * Tanpa durasi maksimum yang sama dengan fungsi /api lain, Sync akan mati di tengah jalan.
 */
export const maxDuration = 60;
/** Sisa anggaran fungsi untuk menulis app_store setelah unduhan selesai. */
const UNDUH_ABORT_MS = 50_000;

/** Hasil ekstraksi terakhir per instans fungsi — bukan pengganti penyimpanan cloud. */
let memoar: { pada: number; muatan: unknown } | null = null;

/** GET biasa tanpa kredensial, tanpa cookie, tanpa header apa pun: murni anonim. */
async function unduhSumber(): Promise<{ baris: any[]; ringkasan: any[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UNDUH_ABORT_MS);
  let html = '';
  let diharapkan = 0;
  try {
    const res = await fetch(SUMUR_TM, { redirect: 'follow', signal: controller.signal });
    if (!res.ok) throw new Error(`Sumber menolak dengan HTTP ${res.status}.`);
    diharapkan = Number(res.headers.get('content-length') || 0);
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }
  // Unduhan terpotong bukan tidak mungkin (servernya pernah berhenti di tengah
  // pengiriman). Lebih baik gagal dengan pesan yang benar daripada setengah data
  // masuk dan terbaca seperti hasil sync yang lengkap.
  if (diharapkan > 0 && html.length < diharapkan * 0.98) {
    throw new Error(`Unduhan dari sumber terpotong (${html.length.toLocaleString('id-ID')} dari ${diharapkan.toLocaleString('id-ID')} byte). Coba Sync lagi.`);
  }
  return {
    baris: ratakanMerchantTm(ambilLiteralTrackingMID(html)),
    ringkasan: ambilRingkasanSumber(html),
  };
}

async function bangunMuatan(): Promise<{ diambilPada: string; sumber: string; baris: any[]; ringkasan: any[] }> {
  const { baris, ringkasan } = await unduhSumber();
  return { diambilPada: new Date().toISOString(), sumber: SUMUR_TM, baris, ringkasan };
}

/**
 * /api/rolemapping?tm=1 — tarik data Tracking Merchant dari 154.19.37.201.
 * (Berkas sendiri tidak bisa: Hobby membatasi api/ ke 12 fungsi per deploy, dan
 * api/ sudah berisi 12. Rute ini menumpang fungsi Role Mapping lewat ?tm=1.)
 *
 * Browser TIDAK bisa mengambil halaman itu sendiri: servernya tidak mengirim header
 * CORS dan aplikasinya jalan di HTTPS, jadi permintaan HTTP ke IP akan diblokir dua
 * kali. Fungsi ini yang berbicara ke sumbernya (anonim, tanpa token), memotong kolom
 * sensitif, lalu menyimpan sisanya di app_store supaya semua pengguna melihat data sama.
 *
 * GET            → baca hasil sync terakhir dari cloud.
 * GET ?ambil=1   → unduh ulang dari sumber + simpan ke cloud (best effort).
 * POST <muatan>  → simpan muatan yang sudah dipegang klien.
 */
async function tanganiTrackingMerchant(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const r = rest();

  try {
    if (req.method === 'GET') {
      const ambilLangsung = String(req.query?.ambil || '') === '1';

      if (!ambilLangsung) {
        const tersimpan = await bacaAppStore(r, KUNCI_TM);
        return res
          .status(200)
          .json(tersimpan ? { ok: true, configured: true, data: tersimpan.data, updatedAt: tersimpan.updated_at }
                         : { ok: true, configured: true, data: null });
      }

      let muatan: { diambilPada: string; sumber: string; baris: any[]; ringkasan?: any[] };
      if (memoar && Date.now() - memoar.pada < USIA_MAKSIMAL_MS) {
        muatan = memoar.muatan as any;
      } else {
        muatan = await bangunMuatan();
        memoar = { pada: Date.now(), muatan };
      }
      // Kegagalan menulis cloud tidak boleh menggagalkan sync: klien tetap menerima
      // barisnya dan menyimpannya di browser.
      let tersimpan = true;
      try {
        await tulisAppStore(r, KUNCI_TM, muatan);
      } catch (err: any) {
        tersimpan = false;
        console.warn('tracking-merchant: gagal menulis app_store:', err?.message || err);
      }
      return res.status(200).json({
        ok: true,
        configured: true,
        data: muatan,
        tersimpanDiCloud: tersimpan,
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.baris)) {
        return res.status(400).json({ ok: false, error: 'Muatan harus berisi array `baris`.' });
      }
      await tulisAppStore(r, KUNCI_TM, body);
      return res.status(200).json({ ok: true, configured: true });
    }

    return res.status(405).json({ ok: false, error: `Metode ${req.method} tidak didukung.` });
  } catch (err: any) {
    console.error('Error in tracking-merchant API:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Gagal mengambil data Tracking Merchant.' });
  }
}
