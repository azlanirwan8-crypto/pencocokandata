import { neon } from '@neondatabase/serverless';

/**
 * /api/kodepos-id — pengumpul patokan kode pos dari kodepos.id.
 *
 * Situs itu tidak punya API maupun berkas unduhan, tapi halaman provinsinya
 * berpaginasi rapi: https://kodepos.id/{slug-provinsi}?page=N berisi tabel
 * [Provinsi, Kota/Kabupaten, Kecamatan, Kelurahan, Kode Pos] 20 baris per
 * halaman, berhenti sendiri saat halamannya kosong. Total nasional ±4.700
 * halaman, jadi satu kali crawl penuh masih masuk akal.
 *
 * GET  ?view=provinces      daftar slug provinsi dari halaman utama
 * POST ?view=crawl          body { provinsi, fromPage, pages, versi }
 *                           -> ambil `pages` halaman (paralel terbatas), upsert
 *                              ke kodepos_baseline, balas { upserted, next, done }
 *
 * Hasilnya masuk ke tabel patokan yang sama dengan sumber pemerintah, jadi
 * pemeriksaan "Sync Data" tidak berubah dan tetap tidak menyentuh internet.
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
        console.warn('Migrasi kodepos_baseline (kodepos.id) dilewati:', err);
        schemaReady = null;
      }
    })();
  }
  return schemaReady;
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
): Promise<{ rows: CollectedRow[]; next: number; done: boolean }> {
  const rows: CollectedRow[] = [];
  let page = fromPage;
  let blanks = 0;

  while (page < fromPage + pages) {
    const batch: number[] = [];
    for (let i = 0; i < CONCURRENCY && page + i < fromPage + pages; i++) batch.push(page + i);
    const results = await Promise.all(batch.map((p) => fetchPage(provinsi, p).catch(() => null)));
    let hit = 0;
    for (const r of results) {
      if (r && r.length > 0) {
        rows.push(...r);
        hit += r.length;
      }
    }
    page += batch.length;
    // Halaman terakhir batch tidak bisa dipastikan; kalau batch ini kosong semua,
    // ulangi sekali untuk memastikan provinsinya memang sudah habis.
    if (hit === 0) {
      blanks++;
      if (blanks >= BLANK_LIMIT) return { rows, next: page - batch.length, done: true };
    } else {
      blanks = 0;
    }
  }
  return { rows, next: page, done: false };
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

  try {
    const sql = neon(connectionString);
    const view = url.searchParams.get('view') || 'provinces';

    if (req.method === 'GET' && view === 'provinces') {
      const res2 = await fetch(SITE, { headers: BROWSER_HEADERS });
      if (!res2.ok) throw new Error(`kodepos.id menolak (HTTP ${res2.status}).`);
      const provinces = parseProvinceSlugs(await res2.text());
      if (provinces.length < 20) throw new Error(`Hanya ${provinces.length} provinsi terbaca — struktur situs berubah.`);
      return res.status(200).json({ ok: true, configured: true, source: SOURCE_LABEL, provinces });
    }

    if (req.method === 'POST' && view === 'crawl') {
      await ensureSchema(sql);
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const provinsi = String(body.provinsi || '').trim().toLowerCase();
      if (!/^[a-z][a-z-]{2,40}$/.test(provinsi)) {
        return res.status(400).json({ ok: false, error: 'Slug provinsi tidak valid.' });
      }
      const fromPage = Math.max(1, Number(body.fromPage) || 1);
      const pages = Math.min(MAX_PAGES_PER_CALL, Math.max(1, Number(body.pages) || MAX_PAGES_PER_CALL));

      let versi = Number(body.versi) || 0;
      if (!versi) {
        const max = await sql`SELECT COALESCE(MAX(versi), 0)::int AS v FROM kodepos_baseline;`;
        versi = (max?.[0]?.v || 0) + 1;
      }

      const { rows, next, done } = await crawlRange(provinsi, fromPage, pages);

      // Satu kunci tidak boleh muncul dua kali dalam satu pernyataan upsert.
      const byKey = new Map<string, CollectedRow>();
      for (const r of rows) byKey.set(rowKey(r), { ...r, kode_wilayah: rowKey(r) });
      const unique = [...byKey.values()];

      if (unique.length > 0) {
        const chunk = JSON.stringify(unique);
        await sql`
          INSERT INTO kodepos_baseline (kode_wilayah, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, sumber, versi, diambil_pada)
          SELECT kode_wilayah, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi,
                 ${SOURCE_LABEL}, ${versi}, NOW()
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
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        provinsi,
        versi,
        upserted: unique.length,
        fromPage,
        next,
        done,
        source: SOURCE_LABEL,
      });
    }

    return res.status(400).json({ ok: false, error: 'Gunakan GET ?view=provinces atau POST ?view=crawl.' });
  } catch (error: any) {
    console.error('Kodepos.id crawl error:', error);
    return res.status(502).json({ ok: false, configured: true, error: error?.message || 'Crawl kodepos.id gagal.' });
  }
}
