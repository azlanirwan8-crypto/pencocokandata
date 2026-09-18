import { neon } from '@neondatabase/serverless';
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
        await sql`
          CREATE TABLE IF NOT EXISTS kodepos_crawl_state (
            provinsi     TEXT PRIMARY KEY,
            sumber       TEXT,
            halaman      INT NOT NULL DEFAULT 0,
            baris        INT NOT NULL DEFAULT 0,
            sampel       TEXT,
            versi        INT,
            diambil_pada TIMESTAMPTZ DEFAULT NOW()
          );
        `;
      } catch (err) {
        console.warn('Migrasi kodepos_baseline (kodepos.id) dilewati:', err);
        schemaReady = null;
      }
    })();
  }
  return schemaReady;
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

    if (req.method === 'GET' && view === 'state') {
      await ensureSchema(sql);
      const rows = await sql`
        SELECT provinsi, sumber, halaman, baris, versi, diambil_pada
        FROM kodepos_crawl_state ORDER BY provinsi;
      `;
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
      await ensureSchema(sql);
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

      const stored = await sql`SELECT provinsi, halaman, sampel FROM kodepos_crawl_state;`;
      const byProv = new Map<string, { halaman: number; sampel: Record<string, string> }>();
      for (const s of stored as any[]) {
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
      await ensureSchema(sql);
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const provinsi = String(body.provinsi || '').trim().toLowerCase();
      const halaman = Math.max(0, Math.min(5000, Number(body.halaman) || 0));
      const baris = Math.max(0, Number(body.baris) || 0);
      if (!/^[a-z][a-z-]{2,40}$/.test(provinsi)) {
        return res.status(400).json({ ok: false, error: 'Slug provinsi tidak valid.' });
      }

      let versi = Number(body.versi) || 0;
      if (!versi) {
        const max = await sql`SELECT COALESCE(MAX(versi), 0)::int AS v FROM kodepos_crawl_state;`;
        versi = (max?.[0]?.v || 0) + 1;
      }

      const pages = samplePages(halaman);
      const sampelRows = await Promise.all(pages.map((p) => fetchPage(provinsi, p).catch(() => [] as CollectedRow[])));
      const sampel: Record<string, string> = {};
      pages.forEach((p, i) => (sampel[String(p)] = hashRows(sampelRows[i])));

      await sql`
        INSERT INTO kodepos_crawl_state (provinsi, sumber, halaman, baris, sampel, versi, diambil_pada)
        VALUES (${provinsi}, ${SOURCE_LABEL}, ${halaman}, ${baris}, ${JSON.stringify(sampel)}, ${versi}, NOW())
        ON CONFLICT (provinsi) DO UPDATE SET
          sumber = EXCLUDED.sumber,
          halaman = EXCLUDED.halaman,
          baris = EXCLUDED.baris,
          sampel = EXCLUDED.sampel,
          versi = EXCLUDED.versi,
          diambil_pada = NOW();
      `;
      return res.status(200).json({ ok: true, configured: true, provinsi, halaman, versi, sampel: pages });
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

      const { rows, next, done, lastPage } = await crawlRange(provinsi, fromPage, pages);

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
      await ensureSchema(sql);
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const input = Array.isArray(body.rows) ? body.rows : [];
      if (input.length === 0) return res.status(400).json({ ok: false, error: 'body.rows kosong.' });
      if (input.length > 5000) return res.status(400).json({ ok: false, error: 'Maksimal 5000 baris per permintaan.' });

      let versi = Number(body.versi) || 0;
      if (!versi) {
        const max = await sql`SELECT COALESCE(MAX(versi), 0)::int AS v FROM kodepos_baseline;`;
        versi = (max?.[0]?.v || 0) + 1;
      }

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
      return res.status(200).json({ ok: true, configured: true, upserted: unique.length, versi, source: SOURCE_LABEL });
    }

    return res.status(400).json({ ok: false, error: 'Gunakan GET ?view=provinces|fresh|state atau POST ?view=crawl|commit|ingest.' });
  } catch (error: any) {
    console.error('Kodepos.id crawl error:', error);
    return res.status(502).json({ ok: false, configured: true, error: error?.message || 'Crawl kodepos.id gagal.' });
  }
}
