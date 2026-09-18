import { neon } from '@neondatabase/serverless';

/**
 * /api/kodepos-baseline — patokan kode pos nasional yang disimpan di database sendiri.
 *
 * GET  ?view=meta   ringkasan isi tabel baseline
 * GET  ?view=diff   adukan kodepos_data dengan seluruh isi baseline
 * POST ?view=fetch  tarik satu tahap (maks. 5 halaman x 1000 baris) lalu upsert per kode
 *                   wilayah; klien mengulang sampai `done`
 * DELETE            kosongkan tabel baseline untuk mulai ulang
 *
 * Sumber dicoba berurutan; sumber yang benar-benar dipakai dicatat di kolom `sumber`:
 *  1. Satu Data Indonesia (penerbit Kementerian PPN/Bappenas) — dataset "Kode Pos Desa
 *     Kelurahan di Indonesia", dilayani JabarCloud. https://data.go.id/dataset/dataset/kode-pos-desa-kelurahan-di-indonesia
 *  2. Mirror GitHub wilayah + kode pos (teguh02, asal-usul komunitas) — dipakai hanya bila
 *     portal pemerintah menolak (WAF-nya sering memblokir IP di luar Indonesia).
 */

export const maxDuration = 60;

const PAGE_SIZE = 1000;
const PAGES_PER_CALL = 5;
const DIFF_CAP = 5000;

const PEMDA_URL = 'https://data.jabarprov.go.id/api-backend/bigdata/dispusipda/kode_pos_kab_kota_indonesia';
const CSV_URL = 'https://raw.githubusercontent.com/teguh02/Wilayah-Indonesia-Beserta-Kode-Pos/main/CSV/full.csv';

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

type SourceId = 'pemda' | 'cadangan';

interface BaselineSource {
  id: SourceId;
  label: string;
  load: (skip: number, size?: number) => Promise<{ rows: NormRow[]; total: number }>;
}

const SOURCES: BaselineSource[] = [
  { id: 'pemda', label: 'Satu Data Indonesia (Bappenas)', load: loadPemdaPage },
  { id: 'cadangan', label: 'Mirror GitHub (komunitas)', load: loadCsvPage },
];

function sourceById(id: string | null | undefined): BaselineSource {
  return SOURCES.find((s) => s.id === id) || SOURCES[0];
}

/**
 * Tabel baseline sudah ada di Neon (id, kode_wilayah UNIQUE, status, created_at).
 * Yang ditambahkan di sini hanya kolom isi dataset; semuanya nullable + ada default,
 * jadi tidak menabrak baris yang sudah ada.
 */
let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: any): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS kodepos_baseline (
            id             SERIAL PRIMARY KEY,
            kode_wilayah   VARCHAR(13) UNIQUE NOT NULL,
            kode_pos       VARCHAR(10),
            kelurahan      TEXT,
            kecamatan      TEXT,
            kabupaten_kota TEXT,
            provinsi       TEXT,
            sumber         TEXT,
            versi          INT,
            diambil_pada   TIMESTAMPTZ DEFAULT NOW()
          );
        `;
        await sql`ALTER TABLE kodepos_baseline ADD COLUMN IF NOT EXISTS kode_pos VARCHAR(10);`;
        await sql`ALTER TABLE kodepos_baseline ADD COLUMN IF NOT EXISTS kelurahan TEXT;`;
        await sql`ALTER TABLE kodepos_baseline ADD COLUMN IF NOT EXISTS kecamatan TEXT;`;
        await sql`ALTER TABLE kodepos_baseline ADD COLUMN IF NOT EXISTS kabupaten_kota TEXT;`;
        await sql`ALTER TABLE kodepos_baseline ADD COLUMN IF NOT EXISTS provinsi TEXT;`;
        await sql`ALTER TABLE kodepos_baseline ADD COLUMN IF NOT EXISTS sumber TEXT;`;
        await sql`ALTER TABLE kodepos_baseline ADD COLUMN IF NOT EXISTS versi INT;`;
        await sql`ALTER TABLE kodepos_baseline ADD COLUMN IF NOT EXISTS diambil_pada TIMESTAMPTZ DEFAULT NOW();`;
        await sql`CREATE INDEX IF NOT EXISTS idx_baseline_kode_pos ON kodepos_baseline(kode_pos);`;
      } catch (err) {
        console.warn('Migrasi kodepos_baseline dilewati:', err);
        schemaReady = null;
      }
    })();
  }
  return schemaReady;
}

/** Kunci baris baseline: kode wilayah asli, atau pengganti pendek bila sumber tak memilikinya. */
function baseKey(r: NormRow): string {
  const k = r.kode_wilayah.replace(/\s+/g, '');
  if (k && k.length <= 13) return k;
  let h = 2166136261;
  const seed = `${r.kode_pos}|${r.kelurahan}|${r.kecamatan}`;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return `x${h.toString(36)}`;
}

/** Kumpulan kode pos yang sudah ada di master aplikasi — dipakai untuk selisih. */
const DB_CODES_SQL = 'SELECT DISTINCT upper(btrim(kode_pos)) AS kode_pos FROM kodepos_data;';
const DB_CODES_SUB = '(SELECT DISTINCT upper(btrim(kode_pos)) FROM kodepos_data)';

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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
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

  try {
    const sql = neon(connectionString);
    await ensureSchema(sql);
    const view = url.searchParams.get('view') || 'meta';

    // ─────────────── GET meta ───────────────
    if (req.method === 'GET' && view === 'meta') {
      const stats = await sql`
        SELECT MAX(versi) AS versi, MAX(diambil_pada) AS diambil_pada, MAX(sumber) AS sumber,
               COUNT(*)::int AS baris, COUNT(DISTINCT upper(kode_pos))::int AS kode_pos_unik
        FROM kodepos_baseline;
      `;
      return res.status(200).json({
        ok: true,
        configured: true,
        ready: ((stats?.[0] as any)?.baris || 0) > 0,
        sumber: SOURCES.map((s) => s.label).join(' → '),
        stats: stats?.[0] || null,
      });
    }

    // ─────────────── GET diff ───────────────
    if (req.method === 'GET' && view === 'diff') {
      const [dbRes, baseRes, totals] = await Promise.all([
        sql.query(DB_CODES_SQL),
        // Kode pos baseline yang belum ada di master aplikasi (baris contoh, dibatasi).
        sql.query(
          `SELECT b.kode_pos, b.kelurahan, b.kecamatan, b.kabupaten_kota, b.provinsi
             FROM kodepos_baseline b
             WHERE upper(btrim(b.kode_pos)) NOT IN ${DB_CODES_SUB}
             ORDER BY b.provinsi, b.kabupaten_kota, b.kecamatan, b.kode_pos
             LIMIT $1;`,
          [DIFF_CAP]
        ),
        sql.query(
          `SELECT COUNT(*)::int AS baris,
                  COUNT(DISTINCT upper(btrim(kode_pos)))::int AS kode_pos_unik,
                  MAX(sumber) AS sumber, MAX(diambil_pada) AS diambil_pada, MAX(versi) AS versi,
                  COUNT(DISTINCT CASE WHEN upper(btrim(kode_pos)) NOT IN ${DB_CODES_SUB}
                        THEN upper(btrim(kode_pos)) END)::int AS belum
             FROM kodepos_baseline;`
        ),
      ]);

      const dbRows = await sql`SELECT COUNT(*)::int AS n FROM kodepos_data;`;
      const dbCodes = new Set<string>((dbRes as any[]).map((r) => String(r.kode_pos).trim()));
      const baseCodes = await sql`SELECT DISTINCT upper(btrim(kode_pos)) AS kode_pos FROM kodepos_baseline;`;
      const baseCodeSet = new Set<string>(
        (baseCodes as any[]).map((r) => String(r.kode_pos ?? '').trim()).filter(Boolean)
      );
      let codesOnlyInDb = 0;
      for (const c of dbCodes) if (!baseCodeSet.has(c)) codesOnlyInDb++;

      const t = (totals?.[0] || {}) as any;
      if (!t.baris) {
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
        baselineCodes: t.kode_pos_unik || baseCodeSet.size,
        dbCodes: dbCodes.size,
        dbRows: (dbRows?.[0] as any)?.n || 0,
        missingCodesTotal: t.belum || 0,
        missingInDb: (baseRes as any[]).map((r) => ({
          kodePos: r.kode_pos,
          kelurahan: r.kelurahan || '',
          kecamatan: r.kecamatan || '',
          kabupatenKota: r.kabupaten_kota || '',
          provinsi: r.provinsi || '',
          status: 'AKTIF',
        })),
        codesOnlyInDb,
        truncated: (baseRes as any[]).length >= DIFF_CAP,
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
      if (!vers) {
        const max = await sql`SELECT COALESCE(MAX(versi), 0)::int AS v FROM kodepos_baseline;`;
        vers = (max?.[0]?.v || 0) + 1;
      }

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
          const key = baseKey(r);
          byKey.set(key, { ...r, kode_wilayah: key });
        }
        const rows = [...byKey.values()];
        if (rows.length > 0) {
          const chunk = JSON.stringify(rows);
          await sql`
            INSERT INTO kodepos_baseline (kode_wilayah, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, sumber, versi, diambil_pada)
            SELECT kode_wilayah, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi,
                   ${source.label}, ${vers}, NOW()
            FROM json_to_recordset(${chunk}::json) as x(
              kode_wilayah VARCHAR(13), kode_pos VARCHAR(10), kelurahan TEXT,
              kecamatan TEXT, kabupaten_kota TEXT, provinsi TEXT
            )
            ON CONFLICT (kode_wilayah) DO UPDATE SET
              kode_pos = EXCLUDED.kode_pos,
              kelurahan = EXCLUDED.kelurahan,
              kecamatan = EXCLUDED.kecamatan,
              kabupaten_kota = EXCLUDED.kabupaten_kota,
              provinsi = EXCLUDED.provinsi,
              sumber = EXCLUDED.sumber,
              versi = EXCLUDED.versi,
              diambil_pada = NOW();
          `;
          upserted += rows.length;
        }
        if (exhausted || (total > 0 && skip + PAGE_SIZE >= total)) break;
      }

      const nextStart = start + consumed * PAGE_SIZE;
      const done = exhausted || (total > 0 && nextStart >= total);

      return res.status(200).json({
        ok: true,
        configured: true,
        versi: vers,
        upserted,
        total,
        nextStart: done ? null : nextStart,
        done,
        sumber: source.label,
        sumberId: source.id,
      });
    }

    // ─────────────── RESET ───────────────
    if (req.method === 'DELETE') {
      await sql`DELETE FROM kodepos_baseline;`;
      return res.status(200).json({ ok: true, configured: true, message: 'Tabel baseline dikosongkan.' });
    }

    return res.status(400).json({ ok: false, error: 'Gunakan ?view=meta|diff atau POST ?view=fetch.' });
  } catch (error: any) {
    console.error('Kodepos baseline error:', error);
    const status = Number(error?.status) || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      ok: false,
      configured: true,
      error: error?.message || 'Baseline kodepos gagal.',
    });
  }
}
