import { buatSql, ambilUrlDb } from '../server/sql';

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
        await sql`
          CREATE TABLE IF NOT EXISTS kodepos_geo (
            kode_pos              VARCHAR(10) PRIMARY KEY,
            latitude              DOUBLE PRECISION,
            longitude             DOUBLE PRECISION,
            sumber                TEXT,
            presisi               TEXT,
            terverifikasi_google  BOOLEAN DEFAULT FALSE,
            alamat                TEXT,
            dicari                TEXT,
            provinsi              TEXT,
            kabupaten_kota        TEXT,
            diambil_pada          TIMESTAMPTZ,
            dibuat_pada           TIMESTAMPTZ DEFAULT NOW()
          );
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS kodepos_koordinat (
            kode_wilayah   VARCHAR(13) PRIMARY KEY,
            kode_pos       VARCHAR(10),
            latitude       DOUBLE PRECISION NOT NULL,
            longitude      DOUBLE PRECISION NOT NULL,
            elevasi        INT,
            sumber         TEXT,
            diambil_pada   TIMESTAMPTZ DEFAULT NOW()
          );
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_koordinat_kode_pos ON kodepos_koordinat(kode_pos);`;
        await sql`ALTER TABLE kodepos_data ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;`;
        await sql`ALTER TABLE kodepos_data ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;`;
        await sql`ALTER TABLE kodepos_data ADD COLUMN IF NOT EXISTS sumber_koordinat TEXT;`;
        await sql`ALTER TABLE kodepos_data ADD COLUMN IF NOT EXISTS diambil_pada TIMESTAMPTZ;`;
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

/** Kunci identitas satu baris — harus sama dengan ROW_KEY_SQL di api/kodepos.ts. */
function rowKey(alias: string) {
  const c = (col: string) => `upper(btrim(COALESCE(${alias}.${col},'')))`;
  return `${c('kode_pos')}||'|'||${c('kelurahan')}||'|'||${c('kecamatan')}||'|'||${c('kabupaten_kota')}||'|'||${c('provinsi')}`;
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

  const connectionString = ambilUrlDb();

  if (!connectionString) {
    return res.status(200).json({ ok: false, configured: false, message: 'DATABASE_URL (Supabase Postgres) belum terpasang.' });
  }

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  try {
    const sql = buatSql(connectionString);
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
        // Titik koordinatnya ikut dibawa dari kodepos_geo supaya tab Sinkronisasi
        // menampilkan kolom lokasi yang sama dengan tabel induk.
        sql.query(
          `WITH b AS (
             SELECT kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi
             FROM kodepos_baseline
             WHERE upper(btrim(kode_pos)) NOT IN ${DB_CODES_SUB}
             ORDER BY provinsi, kabupaten_kota, kecamatan, kode_pos
             LIMIT $1
           )
           SELECT b.*, g.latitude, g.longitude,
                  g.sumber AS geo_sumber, g.presisi AS geo_presisi, g.terverifikasi_google
           FROM b LEFT JOIN kodepos_geo g ON g.kode_pos = upper(btrim(b.kode_pos));`,
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
          latitude: r.latitude == null ? null : Number(r.latitude),
          longitude: r.longitude == null ? null : Number(r.longitude),
          geoSumber: r.geo_sumber ?? null,
          geoPresisi: r.geo_presisi ?? null,
          geoTerverifikasi: r.terverifikasi_google === true,
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

      // Tarikan selesai -> buang versi lama. Diff membaca seluruh tabel tanpa filter versi,
      // jadi baris sumber lama yang tertinggal akan muncul sebagai desa ganda di atas yang baru.
      let dibuang = 0;
      if (done && upserted > 0) {
        const sisa = await sql`SELECT COUNT(*)::int AS n FROM kodepos_baseline WHERE versi <> ${vers};`;
        await sql`DELETE FROM kodepos_baseline WHERE versi <> ${vers};`;
        dibuang = Number((sisa?.[0] as any)?.n || 0);
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

    // ─────────────── POST import-missing ───────────────
    // Salin SEMUA baris patokan yang belum ada ke tabel kerja, langsung di database.
    // Jalur browser biasa terbatas DIFF_CAP baris contoh, jadi tidak bisa dipakai untuk
    // mengisi puluhan ribu baris sekali jalan.
    if (req.method === 'POST' && view === 'import-missing') {
      const sebelum = await sql`SELECT COUNT(*)::int AS n FROM kodepos_data;`;
      await sql`
        INSERT INTO kodepos_data (kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status)
        SELECT b.kode_pos, b.kelurahan, b.kecamatan, b.kabupaten_kota, b.provinsi, 'AKTIF'
        FROM kodepos_baseline b
        WHERE b.kode_pos ~ '^[0-9]{5}$'
          AND NOT EXISTS (
            SELECT 1 FROM kodepos_data d
            WHERE upper(btrim(d.kode_pos)) = upper(btrim(b.kode_pos))
              AND lower(btrim(coalesce(d.kelurahan, ''))) = lower(btrim(coalesce(b.kelurahan, '')))
          )
        ON CONFLICT DO NOTHING;
      `;
      const sesudah = await sql`SELECT COUNT(*)::int AS n FROM kodepos_data;`;
      const masuk = Number((sesudah?.[0] as any)?.n || 0) - Number((sebelum?.[0] as any)?.n || 0);
      return res.status(200).json({
        ok: true,
        configured: true,
        masuk,
        totalSetelah: Number((sesudah?.[0] as any)?.n || 0),
      });
    }

    // ─────────────── KOORDINAT: cakupan ───────────────
    if (req.method === 'GET' && view === 'koordinat') {
      const r = await sql.query(`
        SELECT
          (SELECT COUNT(*)::int FROM kodepos_koordinat)                                    AS patokan_titik,
          (SELECT MAX(diambil_pada) FROM kodepos_koordinat)                                AS terakhir,
          (SELECT COUNT(*)::int FROM kodepos_data)                                         AS data_total,
          (SELECT COUNT(*)::int FROM kodepos_data WHERE latitude IS NOT NULL)              AS data_titik,
          (SELECT COUNT(DISTINCT upper(btrim(kode_pos)))::int FROM kodepos_data
            WHERE latitude IS NOT NULL)                                                    AS kode_pos_titik,
          (SELECT COUNT(*)::int FROM kodepos_data
            WHERE latitude IS NOT NULL
              AND (latitude NOT BETWEEN -11 AND 41 OR longitude NOT BETWEEN 89 AND 145))   AS di_luar_wilayah,
          (SELECT COUNT(*)::int FROM kodepos_koordinat k
            WHERE NOT EXISTS (SELECT 1 FROM kodepos_baseline b WHERE b.kode_wilayah = k.kode_wilayah)) AS tak_terkenalan,
          (SELECT COUNT(*)::int FROM kodepos_koordinat k
            JOIN kodepos_baseline b ON b.kode_wilayah = k.kode_wilayah)                                AS kode_wilayah_cocok,
          (SELECT COUNT(*)::int FROM kodepos_koordinat k
            JOIN kodepos_baseline b ON b.kode_wilayah = k.kode_wilayah
            WHERE upper(btrim(k.kode_pos)) = upper(btrim(b.kode_pos)))                                AS kode_pos_cocok;
      `);
      // Alias Postgres dilipat ke huruf kecil, jadi baca namanya apa adanya.
      const s = (r?.[0] as any) || {};
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
        .filter((r): r is NonNullable<ReturnType<typeof bersihTitik>> => Boolean(r));
      if (!rows.length) {
        return res.status(400).json({ ok: false, error: 'Tidak ada baris valid (kode wilayah 13 digit + titik Indonesia).' });
      }
      const nilai: string[] = [];
      const params: any[] = [];
      rows.forEach((r, i) => {
        const b = i * 6;
        nilai.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},NOW())`);
        params.push(r.kode, r.kodePos || null, r.lat, r.lng, r.elev, 'kodepos.co.id');
      });
      const masuk = await sql.query(
        `INSERT INTO kodepos_koordinat (kode_wilayah, kode_pos, latitude, longitude, elevasi, sumber, diambil_pada)
         VALUES ${nilai.join(',')}
         ON CONFLICT (kode_wilayah) DO UPDATE SET
           kode_pos = EXCLUDED.kode_pos,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           elevasi = EXCLUDED.elevasi,
           sumber = EXCLUDED.sumber,
           diambil_pada = NOW()
         RETURNING kode_wilayah;`,
        params
      );
      return res.status(200).json({ ok: true, configured: true, masuk: (masuk || []).length, ditolak: raw.length - rows.length });
    }

    // ─────────────── KOORDINAT: turunkan ke tabel kerja ───────────────
    if (req.method === 'POST' && view === 'koordinat-salin') {
      const hasil = await sql.query(`
        WITH src AS (
          SELECT DISTINCT ON (kunci) kunci, latitude, longitude, sumber, diambil_pada
          FROM (
            SELECT ${rowKey('b')} AS kunci, k.latitude, k.longitude, k.sumber, k.diambil_pada, b.kode_wilayah
            FROM kodepos_koordinat k
            JOIN kodepos_baseline b ON b.kode_wilayah = k.kode_wilayah
          ) t
          ORDER BY kunci, kode_wilayah
        ),
        upd AS (
          UPDATE kodepos_data d
          SET latitude = src.latitude,
              longitude = src.longitude,
              sumber_koordinat = src.sumber,
              diambil_pada = src.diambil_pada
          FROM src
          WHERE src.kunci = ${rowKey('d')}
            AND (d.latitude IS DISTINCT FROM src.latitude OR d.longitude IS DISTINCT FROM src.longitude)
          RETURNING 1
        )
        SELECT COUNT(*)::int AS n FROM upd;
      `);
      const bolong = await sql`SELECT COUNT(*)::int AS n FROM kodepos_data WHERE latitude IS NULL;`;
      return res.status(200).json({
        ok: true,
        configured: true,
        disalin: (hasil?.[0] as any)?.n ?? 0,
        tanpaTitik: (bolong?.[0] as any)?.n ?? 0,
      });
    }

    // ─────────────── RESET ───────────────
    if (req.method === 'DELETE') {
      await sql`DELETE FROM kodepos_baseline;`;
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
      error: error?.message || 'Baseline kodepos gagal.',
    });
  }
}
