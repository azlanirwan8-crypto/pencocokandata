import { neon } from '@neondatabase/serverless';

/**
 * /api/kodepos — Neon Postgres CRUD for Master Data Kode Pos Indonesia
 *
 * GET    ?view=page|stats|options|export   (server-side pagination + filter)
 *          filter: search, provinsi, kota, status
 *          paging: page (1-based), pageSize (default 25, cap 500)
 * POST   body { rows, mode:'replace'|'append' }  → bulk import / reset / create
 * PUT    ?id=X body { row }                      → update satu baris
 * DELETE ?id=X                                  → hapus satu baris
 * DELETE ?all=1                                 → truncate semua
 *
 * Table: kodepos_data (dedicated, dengan index). Titik koordinat per baris ada di kolom
 * latitude/longitude baru itu sendiri (diturunkan dari kodepos_koordinat oleh
 * /api/kodepos-baseline?view=koordinat-salin); kodepos_geo tetap dipakai sebagai cache
 * geocoding per kode pos untuk baris yang belum punya titik sendiri.
 */

// Bulk import (83k baris) & export bisa lama — naikkan batas serverless Vercel.
export const maxDuration = 60;

const PAGE_SIZE_CAP = 500;

/** Kunci identitas satu baris kode pos — HARUS sama dengan kodePosRowKey() di klien. */
const ROW_KEY_SQL = `upper(btrim(kode_pos))||'|'||upper(btrim(COALESCE(kelurahan,'')))||'|'||upper(btrim(COALESCE(kecamatan,'')))||'|'||upper(btrim(COALESCE(kabupaten_kota,'')))||'|'||upper(btrim(COALESCE(provinsi,'')))`;
const PROV_SQL = `COALESCE(NULLIF(upper(btrim(provinsi)),''),'(TANPA PROVINSI)')`;
const SYNC_DIFF_CAP = 500;
const SYNC_KEYS_CAP = 20000;

/** DDL hanya sekali per warm instance. */
let schemaReady: Promise<void> | null = null;

function mapRow(r: any) {
  return {
    id: r.id ?? null,
    kodePos: r.kode_pos ?? '',
    kelurahan: r.kelurahan ?? '',
    kecamatan: r.kecamatan ?? '',
    kabupatenKota: r.kabupaten_kota ?? '',
    provinsi: r.provinsi ?? '',
    status: r.status ?? 'AKTIF',
    latitude: r.latitude == null ? null : Number(r.latitude),
    longitude: r.longitude == null ? null : Number(r.longitude),
    geoSumber: r.geo_sumber ?? null,
    geoPresisi: r.geo_presisi ?? null,
    geoTerverifikasi: r.terverifikasi_google === true,
  };
}

/** Tabel geo pernah gagal dibaca — setelah itu halaman selalu jatuh ke query polos. */
let geoTerganggu = false;

/**
 * Titik per baris (kodepos_data.latitude, hasil salinan patokan) lebih diutamakan
 * daripada cache per kode pos di kodepos_geo — satu kode pos bisa menutup belasan desa.
 */
const GEO_PILIH = `
  COALESCE(s.d_lat, g.latitude)  AS latitude,
  COALESCE(s.d_lng, g.longitude) AS longitude,
  CASE WHEN s.d_lat IS NOT NULL THEN COALESCE(NULLIF(s.d_sumber, ''), 'kodepos.co.id') ELSE g.sumber END AS geo_sumber,
  CASE WHEN s.d_lat IS NOT NULL THEN 'titik desa' ELSE g.presisi END AS geo_presisi,
  g.terverifikasi_google`;

/** Kolom dalam CTE `s`: nama asli + titik baris dengan alias agar tidak bentrok dengan kodepos_geo. */
const S_KOLOM = `id, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status,
           latitude AS d_lat, longitude AS d_lng, sumber_koordinat AS d_sumber`;
const S_AMBIL = `s.id, s.kode_pos, s.kelurahan, s.kecamatan, s.kabupaten_kota, s.provinsi, s.status`;

/**
 * Baca dengan titik koordinat, tetapi jangan pernah membuat tabel kode pos mati
 * hanya karena kodepos_geo belum ada/belum bisa dibuat di deployment ini.
 */
async function bacaDenganTitik(
  sql: any,
  sqlGeo: string,
  sqlPolos: string,
  params: any[]
): Promise<any[]> {
  if (!geoTerganggu) {
    try {
      return (await sql.query(sqlGeo, params)) as any[];
    } catch (err) {
      geoTerganggu = true;
      console.warn('kodepos_geo belum terbaca, halaman disajikan tanpa titik koordinat:', err);
    }
  }
  return (await sql.query(sqlPolos, params)) as any[];
}

/**
 * Bangun klausa WHERE + array parameter dari filter (search/provinsi/kota/status).
 * Dipakai bersama oleh query COUNT, PAGE, dan EXPORT agar hasilnya konsisten.
 */
function buildFilterWhere(q: {
  search?: string | null;
  provinsi?: string | null;
  kota?: string | null;
  status?: string | null;
}): { whereSql: string; params: any[] } {
  const where: string[] = [];
  const params: any[] = [];

  if (q.provinsi) {
    params.push(q.provinsi);
    where.push(`provinsi = $${params.length}`);
  }
  if (q.kota) {
    params.push(q.kota);
    where.push(`kabupaten_kota = $${params.length}`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`upper(status) = upper($${params.length})`);
  }
  const search = (q.search || '').trim();
  if (search) {
    const idx = params.length + 1;
    params.push(`%${search}%`);
    where.push(
      `(kode_pos ILIKE $${idx} OR kelurahan ILIKE $${idx} OR kecamatan ILIKE $${idx} OR kabupaten_kota ILIKE $${idx} OR provinsi ILIKE $${idx})`
    );
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/**
 * Bangun klausa ORDER BY dari `sort`/`dir` (whitelist — nama kolom tidak pernah
 * diambil mentah dari permintaan). Titik koordinat dibaca dari kodepos_data atau,
 * bila kosong, dari cache kodepos_geo per kode pos; urutan memakai aturan yang sama
 * supaya halaman ke-N benar-benar lanjutan halaman ke-1.
 */
const KOLOM_URUT: Record<string, { dalam: string; luar: string; polos: string }> = {
  kodePos: { dalam: 'kode_pos', luar: 's.kode_pos', polos: 'kode_pos' },
  kelurahan: { dalam: 'kelurahan', luar: 's.kelurahan', polos: 'kelurahan' },
  kecamatan: { dalam: 'kecamatan', luar: 's.kecamatan', polos: 'kecamatan' },
  kabupatenKota: { dalam: 'kabupaten_kota', luar: 's.kabupaten_kota', polos: 'kabupaten_kota' },
  provinsi: { dalam: 'provinsi', luar: 's.provinsi', polos: 'provinsi' },
  latitude: {
    dalam: `COALESCE(latitude, (SELECT g2.latitude FROM kodepos_geo g2 WHERE g2.kode_pos = upper(btrim(kodepos_data.kode_pos)) LIMIT 1))`,
    luar: 'COALESCE(s.d_lat, g.latitude)',
    polos: 'latitude',
  },
  longitude: {
    dalam: `COALESCE(longitude, (SELECT g2.longitude FROM kodepos_geo g2 WHERE g2.kode_pos = upper(btrim(kodepos_data.kode_pos)) LIMIT 1))`,
    luar: 'COALESCE(s.d_lng, g.longitude)',
    polos: 'longitude',
  },
};

function buildUrut(sort: string | null, dir: string | null) {
  const k = KOLOM_URUT[sort || ''];
  if (!k) {
    return { dalam: 'ORDER BY id', luar: 'ORDER BY s.id', polos: 'ORDER BY id' };
  }
  const arah = (dir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return {
    dalam: `ORDER BY ${k.dalam} ${arah} NULLS LAST, id`,
    luar: `ORDER BY ${k.luar} ${arah} NULLS LAST, s.id`,
    polos: `ORDER BY ${k.polos} ${arah} NULLS LAST, id`,
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL;

  if (!connectionString) {
    return res.status(200).json({
      ok: false,
      configured: false,
      message: 'DATABASE_URL / POSTGRES_URL Neon belum terpasang di Vercel Environment Variables.',
    });
  }

  try {
    const sql = neon(connectionString);

    // Auto-migrate sekali per warm instance. Kegagalan DDL sengaja tidak dilempar ke
    // pemanggil: tabel sudah ada di deployment aktif, jadi baca tetap jalan terus.
    if (!schemaReady) {
      schemaReady = (async () => {
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS kodepos_data (
              id             SERIAL PRIMARY KEY,
              kode_pos       VARCHAR(10)  NOT NULL,
              kelurahan      TEXT,
              kecamatan      TEXT,
              kabupaten_kota TEXT,
              provinsi       TEXT,
              status         VARCHAR(20)  DEFAULT 'AKTIF',
              latitude       DOUBLE PRECISION,
              longitude      DOUBLE PRECISION,
              sumber_koordinat TEXT,
              diambil_pada   TIMESTAMPTZ,
              created_at     TIMESTAMPTZ  DEFAULT NOW(),
              updated_at     TIMESTAMPTZ  DEFAULT NOW()
            );
          `;
          await sql`ALTER TABLE kodepos_data ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;`;
          await sql`ALTER TABLE kodepos_data ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;`;
          await sql`ALTER TABLE kodepos_data ADD COLUMN IF NOT EXISTS sumber_koordinat TEXT;`;
          await sql`ALTER TABLE kodepos_data ADD COLUMN IF NOT EXISTS diambil_pada TIMESTAMPTZ;`;
          await sql`CREATE INDEX IF NOT EXISTS idx_kodepos_kode       ON kodepos_data(kode_pos);`;
          await sql`CREATE INDEX IF NOT EXISTS idx_kodepos_provinsi   ON kodepos_data(provinsi);`;
          await sql`CREATE INDEX IF NOT EXISTS idx_kodepos_kabupaten  ON kodepos_data(kabupaten_kota);`;
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
        } catch (err) {
          console.warn('Migrasi skema kodepos dilewati:', err);
        }
      })();
    }
    await schemaReady;

    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

    // ─────────────────────────── GET ───────────────────────────
    if (req.method === 'GET') {
      const view = url.searchParams.get('view') || 'page';
      const search = url.searchParams.get('search');
      const provinsi = url.searchParams.get('provinsi');
      const kota = url.searchParams.get('kota');
      const status = url.searchParams.get('status');

      // stats agregat global (untuk KPI card)
      if (view === 'stats') {
        // ber_titik harus seluas bacaan tabel: titik milik baris sendiri ATAU cache
        // per kode pos di kodepos_geo — kalau tidak, KPI dan kolom tidak cocok.
        const AGREGAT = `
          COUNT(*)::int AS total,
          COUNT(DISTINCT d.provinsi)::int AS provinsi,
          COUNT(DISTINCT d.kabupaten_kota)::int AS kota,
          COUNT(DISTINCT d.kecamatan)::int AS kecamatan,
          COUNT(DISTINCT d.kelurahan)::int AS kelurahan,
          COUNT(*) FILTER (WHERE upper(d.status) <> 'NON-AKTIF')::int AS aktif,`;
        let row: any = {};
        try {
          row =
            ((await sql.query(
              `SELECT ${AGREGAT}
                 COUNT(*) FILTER (WHERE d.latitude IS NOT NULL OR g.latitude IS NOT NULL)::int AS ber_titik
               FROM kodepos_data d
               LEFT JOIN kodepos_geo g ON g.kode_pos = upper(btrim(d.kode_pos)) AND g.latitude IS NOT NULL;`
            )) as any[])?.[0] || {};
        } catch (err) {
          console.warn('kodepos_geo ikut gagal dibaca saat stats:', err);
          row =
            ((await sql.query(
              `SELECT ${AGREGAT}
                 COUNT(*) FILTER (WHERE d.latitude IS NOT NULL)::int AS ber_titik
               FROM kodepos_data d;`
            )) as any[])?.[0] || {};
        }
        return res.status(200).json({
          ok: true,
          configured: true,
          stats: {
            total: row.total ?? 0,
            totalProvinsi: row.provinsi ?? 0,
            totalKota: row.kota ?? 0,
            totalKecamatan: row.kecamatan ?? 0,
            totalKelurahan: row.kelurahan ?? 0,
            totalAktif: row.aktif ?? 0,
            totalBerTitik: row.ber_titik ?? 0,
          },
        });
      }

      // opsi dropdown provinsi + kota/kab (kota bisa difilter provinsi)
      if (view === 'options') {
        const provRows = await sql`
          SELECT DISTINCT provinsi FROM kodepos_data
          WHERE provinsi IS NOT NULL AND provinsi <> ''
          ORDER BY provinsi;
        `;
        let kotaRows: any[];
        if (provinsi) {
          kotaRows = await sql.query(
            `SELECT DISTINCT kabupaten_kota FROM kodepos_data
             WHERE kabupaten_kota IS NOT NULL AND kabupaten_kota <> '' AND provinsi = $1
             ORDER BY kabupaten_kota;`,
            [provinsi]
          );
        } else {
          kotaRows = await sql`
            SELECT DISTINCT kabupaten_kota FROM kodepos_data
            WHERE kabupaten_kota IS NOT NULL AND kabupaten_kota <> ''
            ORDER BY kabupaten_kota;
          `;
        }
        return res.status(200).json({
          ok: true,
          configured: true,
          provinsi: (provRows || []).map((r: any) => r.provinsi),
          kota: (kotaRows || []).map((r: any) => r.kabupaten_kota),
        });
      }

      const { whereSql, params } = buildFilterWhere({ search, provinsi, kota, status });

      // export: semua baris yang cocok filter (tanpa pagination)
      if (view === 'export') {
        const rows = await bacaDenganTitik(
          sql,
          `WITH s AS (
             SELECT ${S_KOLOM}
             FROM kodepos_data ${whereSql}
           )
           SELECT ${S_AMBIL}, ${GEO_PILIH}
           FROM s LEFT JOIN kodepos_geo g ON g.kode_pos = upper(btrim(s.kode_pos))
           ORDER BY s.id;`,
          `SELECT id, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status
           FROM kodepos_data ${whereSql} ORDER BY id;`,
          params
        );
        return res
          .status(200)
          .json({ ok: true, configured: true, count: (rows || []).length, data: (rows || []).map(mapRow) });
      }

      // sync-meta: sidik jari per provinsi untuk membandingkan DB lokal vs cloud
      // tanpa mengirim puluhan ribu baris. sha256 atas kunci baris yang diurutkan
      // dengan COLLATE "C" (urutan byte) supaya sama dengan sort di JavaScript.
      if (view === 'sync-meta') {
        const meta = await sql.query(
          `WITH k AS (
             SELECT ${PROV_SQL} AS provinsi, ${ROW_KEY_SQL} AS k FROM kodepos_data
           )
           SELECT provinsi,
                  COUNT(*)::int AS total,
                  encode(sha256(convert_to(string_agg(k, E'\n' ORDER BY k COLLATE "C"), 'UTF8')), 'hex') AS fingerprint
           FROM k GROUP BY provinsi ORDER BY provinsi COLLATE "C";`
        );
        const lastUpdated = await sql.query(`SELECT MAX(updated_at) AS updated_at FROM kodepos_data;`);
        const provinces = (meta || []).map((m: any) => ({
          provinsi: m.provinsi,
          total: m.total,
          fingerprint: m.fingerprint,
        }));
        return res.status(200).json({
          ok: true,
          configured: true,
          cloudTotal: provinces.reduce((sum: number, p: any) => sum + p.total, 0),
          lastUpdated: lastUpdated?.[0]?.updated_at || null,
          provinces,
        });
      }

      // default: page — satu halaman data + total untuk pagination
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const rawSize = parseInt(url.searchParams.get('pageSize') || '25', 10) || 25;
      const pageSize = Math.min(PAGE_SIZE_CAP, Math.max(1, rawSize));

      const countRes = await sql.query(
        `SELECT COUNT(*)::int AS n FROM kodepos_data ${whereSql};`,
        params
      );
      const total = (countRes && countRes[0] && countRes[0].n) || 0;

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;
      const urut = buildUrut(url.searchParams.get('sort'), url.searchParams.get('dir'));
      const rows = await bacaDenganTitik(
        sql,
        `WITH s AS (
           SELECT ${S_KOLOM}
           FROM kodepos_data ${whereSql} ${urut.dalam} LIMIT $${limitIdx} OFFSET $${offsetIdx}
         )
         SELECT ${S_AMBIL}, ${GEO_PILIH}
         FROM s LEFT JOIN kodepos_geo g ON g.kode_pos = upper(btrim(s.kode_pos))
         ${urut.luar};`,
        `SELECT id, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status
         FROM kodepos_data ${whereSql}
         ${urut.polos}
         LIMIT $${limitIdx} OFFSET $${offsetIdx};`,
        [...params, pageSize, (page - 1) * pageSize]
      );

      return res.status(200).json({
        ok: true,
        configured: true,
        data: (rows || []).map(mapRow),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    // ─────────────── PUT (update satu baris) ───────────────
    if (req.method === 'PUT') {
      const id = parseInt(url.searchParams.get('id') || '', 10);
      if (!id) return res.status(400).json({ ok: false, error: 'id wajib diisi untuk update.' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const row = body.row || body;
      const set: string[] = [
        'kode_pos=$1', 'kelurahan=$2', 'kecamatan=$3', 'kabupaten_kota=$4', 'provinsi=$5', 'status=$6',
      ];
      const vals: any[] = [
        String(row.kodePos ?? ''),
        String(row.kelurahan ?? ''),
        String(row.kecamatan ?? ''),
        String(row.kabupatenKota ?? ''),
        String(row.provinsi ?? ''),
        String(row.status ?? 'AKTIF'),
      ];
      // Titik koordinat hanya ditulis bila pengirimnya memang menyertakan kolom itu —
      // formulir teks lama tidak boleh menghapus titik yang sudah ada.
      if (row.latitude !== undefined || row.longitude !== undefined) {
        const angka = (v: any) => {
          if (v === null || v === '') return null;
          const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
          return Number.isFinite(n) ? n : null;
        };
        const lat = angka(row.latitude ?? null);
        const lng = angka(row.longitude ?? null);
        vals.push(lat, lng);
        set.push(`latitude=$${vals.length - 1}`, `longitude=$${vals.length}`, `sumber_koordinat=${lat === null ? 'NULL' : "'manual'"}`);
      }
      vals.push(id);
      await sql.query(
        `UPDATE kodepos_data SET ${set.join(', ')}, updated_at=NOW() WHERE id=$${vals.length};`,
        vals
      );
      return res.status(200).json({ ok: true, configured: true, updated: 1 });
    }

    // ─────────────── POST (bulk import / reset / create) ───────────────
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // sync-diff: adu himpunan kunci baris milik klien dengan milik cloud.
      // Kunci dikirim sebagai satu string ber-pemisah chr(31) agar tidak bergantung
      // pada serialisasi array driver Neon.
      if (url.searchParams.get('view') === 'sync-diff') {
        const keys: string[] = Array.isArray(body?.keys) ? body.keys.slice(0, SYNC_KEYS_CAP) : [];
        if (keys.length === 0) {
          return res.status(400).json({ ok: false, error: 'body.keys harus array tidak kosong.' });
        }
        const cap = Math.min(SYNC_DIFF_CAP, Math.max(1, Number(body?.cap) || SYNC_DIFF_CAP));
        const keysParam = keys.join(String.fromCharCode(31));

        // Kunci milik klien yang belum ada di cloud (kandidat import) — daftar penuh,
        // karena klien butuh seluruhnya untuk tombol "pilih semua".
        const notInCloud = await sql.query(
          `WITH loc AS (SELECT DISTINCT unnest(string_to_array($1, chr(31))) AS k),
                  cloud AS (SELECT ${ROW_KEY_SQL} AS k FROM kodepos_data)
           SELECT loc.k FROM loc LEFT JOIN cloud ON cloud.k = loc.k WHERE cloud.k IS NULL
           LIMIT ${SYNC_KEYS_CAP};`,
          [keysParam]
        );

        // Kunci milik cloud yang tidak dikirim klien (informasi: DB lokal ketinggalan).
        // Dibatasi ke provinsi yang sama dengan kunci yang dikirim, karena klien
        // mengirim kunci hanya untuk provinsi yang berbeda.
        const notInLocal = await sql.query(
          `WITH loc AS (SELECT DISTINCT unnest(string_to_array($1, chr(31))) AS k),
                  cloud AS (
                    SELECT ${ROW_KEY_SQL} AS k, id, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status
                    FROM kodepos_data
                    WHERE ${PROV_SQL} IN (SELECT DISTINCT split_part(k, '|', 5) FROM loc)
                  )
           SELECT cloud.id, cloud.kode_pos, cloud.kelurahan, cloud.kecamatan, cloud.kabupaten_kota, cloud.provinsi, cloud.status
           FROM cloud LEFT JOIN loc ON loc.k = cloud.k WHERE loc.k IS NULL
           LIMIT $2;`,
          [keysParam, cap]
        );

        // Daftar kode pos yang sudah ada di cloud untuk provinsi yang diadu. Validasi
        // import ada di LEVEL KODE POS: kode pos yang sudah tersimpan tidak diusulkan lagi.
        const cloudCodes = await sql.query(
          `WITH loc AS (SELECT DISTINCT unnest(string_to_array($1, chr(31))) AS k)
           SELECT DISTINCT upper(btrim(kode_pos)) AS kode_pos FROM kodepos_data
           WHERE ${PROV_SQL} IN (SELECT DISTINCT split_part(k, '|', 5) FROM loc);`,
          [keysParam]
        );

        return res.status(200).json({
          ok: true,
          configured: true,
          keysReceived: keys.length,
          missingInCloud: (notInCloud || []).map((r: any) => r.k),
          missingInLocal: (notInLocal || []).map(mapRow),
          cloudCodes: (cloudCodes || []).map((r: any) => String(r.kode_pos)),
          cap,
        });
      }

      const { rows, mode = 'replace' } = body;

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ ok: false, error: 'rows harus array tidak kosong.' });
      }

      if (mode === 'replace') {
        await sql`TRUNCATE TABLE kodepos_data RESTART IDENTITY;`;
      }

      const BATCH = 500; // 500 baris x 6 kolom = 3000 parameter (aman di bawah limit 65535)
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const placeholders: string[] = [];
        const values: any[] = [];
        batch.forEach((r: any, j: number) => {
          const b = j * 6;
          placeholders.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`);
          values.push(
            String(r.kodePos ?? ''),
            String(r.kelurahan ?? ''),
            String(r.kecamatan ?? ''),
            String(r.kabupatenKota ?? ''),
            String(r.provinsi ?? ''),
            String(r.status ?? 'AKTIF')
          );
        });
        await sql.query(
          `INSERT INTO kodepos_data (kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status)
           VALUES ${placeholders.join(',')}
           ON CONFLICT DO NOTHING;`,
          values
        );
        inserted += batch.length;
      }

      return res.status(200).json({ ok: true, configured: true, inserted, total: rows.length, message: `${inserted} data kode pos berhasil disimpan ke Neon Postgres.` });
    }

    // ─────────────── DELETE ───────────────
    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (id) {
        await sql.query(`DELETE FROM kodepos_data WHERE id=$1;`, [parseInt(id, 10)]);
        return res.status(200).json({ ok: true, configured: true, deleted: 1 });
      }
      if (url.searchParams.get('all') === '1') {
        await sql`TRUNCATE TABLE kodepos_data RESTART IDENTITY;`;
        return res.status(200).json({ ok: true, configured: true, message: 'Semua data kode pos berhasil dihapus dari Neon Postgres.' });
      }
      return res.status(400).json({ ok: false, error: 'DELETE butuh ?id=X (satu baris) atau ?all=1 (truncate).' });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Neon DB API Error (Kode Pos):', error);
    return res.status(500).json({ ok: false, configured: true, error: error.message || 'Internal Server Error' });
  }
}
