import { neon } from '@neondatabase/serverless';

/**
 * /api/kodepos-koordinat — titik per desa/kelurahan, dipakai untuk kolom
 * LATITUDE/LONGITUDE di tabel kerja.
 *
 * GET  ?view=progress        cakupan titik di tabel patokan + tabel kerja
 * POST ?view=ingest          { rows: [{ kode, lat, lng, kodePos?, elev? }] } upsert per kode wilayah
 * POST ?view=salin-ke-data   turunkan titik patokan ke kodepos_data (adu kunci baris)
 *
 * Titik disimpan per KODE WILAYAH (13 digit), bukan per kode pos, supaya tiap baris
 * kelurahan punya titiknya sendiri — satu kode pos bisa menutup belasan desa.
 * Sumber: halaman kecamatan kodepos.co.id. Terukur 2026-09-20: 7.277 halaman, tiap
 * halaman memuat tabel desa dengan kolom kode wilayah + "lat, lng" + elevasi.
 * Pengambilannya dijalankan dari laptop (tools/crawl-koordinat.mjs) karena 7.277
 * halaman x ±100 KB tidak masuk akal dipaksa lewat fungsi serverless.
 */

export const maxDuration = 60;

const SUDAH_DIINGEST = 5000;

/** Kunci identitas baris — sama dengan ROW_KEY_SQL di api/kodepos.ts. */
function rowKey(alias: string) {
  const c = (col: string) => `upper(btrim(COALESCE(${alias}.${col},'')))`;
  return `${c('kode_pos')}||'|'||${c('kelurahan')}||'|'||${c('kecamatan')}||'|'||${c('kabupaten_kota')}||'|'||${c('provinsi')}`;
}

let schemaReady: Promise<void> | null = null;

async function pastikanSkema(sql: any) {
  if (!schemaReady) {
    schemaReady = (async () => {
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
    })();
  }
  await schemaReady;
}

/** Hanya terima koordinat yang layak: kode wilayah 13 digit + titik di wilayah Indonesia. */
function bersih(raw: any): { kode: string; kodePos: string; lat: number; lng: number; elev: number | null } | null {
  const kode = String(raw?.kode ?? raw?.kode_wilayah ?? '').trim();
  if (!/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/.test(kode)) return null;
  const lat = Number(raw?.lat ?? raw?.latitude);
  const lng = Number(raw?.lng ?? raw?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -11 || lat > 41 || lng < 89 || lng > 145) return null;
  const elev = Number(raw?.elev ?? raw?.elevasi);
  const kodePos = String(raw?.kodePos ?? raw?.kode_pos ?? '').trim().slice(0, 10);
  return { kode, kodePos, lat, lng, elev: Number.isFinite(elev) ? Math.round(elev) : null };
}

export default async function handler(req: any, res: any) {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    return res.status(200).json({ ok: false, configured: false, message: 'DATABASE_URL Neon belum terpasang.' });
  }

  try {
    const sql = neon(connectionString);
    await pastikanSkema(sql);
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const view = url.searchParams.get('view') || 'progress';

    // ─────────────── CAKUPAN ───────────────
    if (req.method === 'GET' && view === 'progress') {
      const r = await sql.query(`
        SELECT
          (SELECT COUNT(*)::int FROM kodepos_koordinat)                                    AS patokanTitik,
          (SELECT MAX(diambil_pada) FROM kodepos_koordinat)                                AS terakhir,
          (SELECT COUNT(*)::int FROM kodepos_data)                                         AS dataTotal,
          (SELECT COUNT(*)::int FROM kodepos_data WHERE latitude IS NOT NULL)              AS dataTitik,
          (SELECT COUNT(DISTINCT upper(btrim(kode_pos)))::int FROM kodepos_data
            WHERE latitude IS NOT NULL)                                                    AS kodePosTitik,
          (SELECT COUNT(*)::int FROM kodepos_data
            WHERE latitude IS NOT NULL
              AND (latitude NOT BETWEEN -11 AND 41 OR longitude NOT BETWEEN 89 AND 145))   AS diLuarWilayah,
          (SELECT COUNT(*)::int FROM kodepos_koordinat k
            WHERE NOT EXISTS (SELECT 1 FROM kodepos_baseline b WHERE b.kode_wilayah = k.kode_wilayah)) AS takTerkenalan;
      `);
      const s = r?.[0] || {};
      return res.status(200).json({
        ok: true,
        configured: true,
        patokanTitik: s.patokanTitik ?? 0,
        dataTotal: s.dataTotal ?? 0,
        dataTitik: s.dataTitik ?? 0,
        tanpaTitik: (s.dataTotal ?? 0) - (s.dataTitik ?? 0),
        kodePosTitik: s.kodePosTitik ?? 0,
        diLuarWilayah: s.diLuarWilayah ?? 0,
        takTerkenalan: s.takTerkenalan ?? 0,
        terakhir: s.terakhir ?? null,
      });
    }

    // ─────────────── SETOR HASIL CRAWL ───────────────
    if (req.method === 'POST' && view === 'ingest') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const raw = Array.isArray(body?.rows) ? body.rows : [];
      if (!raw.length) return res.status(400).json({ ok: false, error: 'body.rows harus array tidak kosong.' });
      const rows = raw.slice(0, SUDAH_DIINGEST).map(bersih).filter(Boolean) as NonNullable<
        ReturnType<typeof bersih>
      >[];
      if (!rows.length) return res.status(400).json({ ok: false, error: 'Tidak ada baris valid (kode wilayah 13 digit + titik Indonesia).' });

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
      return res.status(200).json({
        ok: true,
        configured: true,
        masuk: (masuk || []).length,
        ditolak: raw.length - rows.length,
      });
    }

    // ─────────────── TURUNKAN KE TABEL KERJA ───────────────
    if (req.method === 'POST' && (view === 'salin-ke-data' || view === 'salin')) {
      const hasil = await sql.query(`
        WITH src AS (
          SELECT DISTINCT ON (kunci) kunci, latitude, longitude, sumber, diambil_pada
          FROM (
            SELECT ${rowKey('b')} AS kunci, k.latitude, k.longitude, k.sumber, k.diambil_pada, b.kode_wilayah
            FROM kodepos_koordinat k
            JOIN kodepos_baseline b ON b.kode_wilayah = k.kode_wilayah
          ) t
          ORDER BY kunci, kode_wilayah
        )
        UPDATE kodepos_data d
        SET latitude = src.latitude,
            longitude = src.longitude,
            sumber_koordinat = src.sumber,
            diambil_pada = src.diambil_pada
        FROM src
        WHERE src.kunci = ${rowKey('d')}
          AND (d.latitude IS DISTINCT FROM src.latitude OR d.longitude IS DISTINCT FROM src.longitude)
        RETURNING d.id;
      `);
      const bolong = await sql.query(
        `SELECT COUNT(*)::int AS n FROM kodepos_data WHERE latitude IS NULL;`
      );
      return res.status(200).json({
        ok: true,
        configured: true,
        disalin: (hasil || []).length,
        tanpaTitik: bolong?.[0]?.n ?? 0,
      });
    }

    return res.status(400).json({ ok: false, error: 'Gunakan ?view=progress, ?view=ingest atau ?view=salin-ke-data.' });
  } catch (error: any) {
    console.error('Kodepos koordinat error:', error);
    const status = Number(error?.status) || 500;
    return res.status(status).json({ ok: false, configured: true, error: error?.message || 'Gagal memproses koordinat.' });
  }
}
