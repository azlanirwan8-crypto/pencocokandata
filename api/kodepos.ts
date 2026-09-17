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
 * Table: kodepos_data (dedicated, dengan index)
 */

// Bulk import (83k baris) & export bisa lama — naikkan batas serverless Vercel.
export const maxDuration = 60;

const PAGE_SIZE_CAP = 500;

function mapRow(r: any) {
  return {
    id: r.id ?? null,
    kodePos: r.kode_pos ?? '',
    kelurahan: r.kelurahan ?? '',
    kecamatan: r.kecamatan ?? '',
    kabupatenKota: r.kabupaten_kota ?? '',
    provinsi: r.provinsi ?? '',
    status: r.status ?? 'AKTIF',
  };
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

    // Auto-migrate: buat tabel kodepos_data dengan index
    await sql`
      CREATE TABLE IF NOT EXISTS kodepos_data (
        id             SERIAL PRIMARY KEY,
        kode_pos       VARCHAR(10)  NOT NULL,
        kelurahan      TEXT,
        kecamatan      TEXT,
        kabupaten_kota TEXT,
        provinsi       TEXT,
        status         VARCHAR(20)  DEFAULT 'AKTIF',
        created_at     TIMESTAMPTZ  DEFAULT NOW(),
        updated_at     TIMESTAMPTZ  DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_kodepos_kode       ON kodepos_data(kode_pos);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_kodepos_provinsi   ON kodepos_data(provinsi);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_kodepos_kabupaten  ON kodepos_data(kabupaten_kota);`;

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
        const s = await sql`
          SELECT
            COUNT(*)::int                                             AS total,
            COUNT(DISTINCT provinsi)::int                             AS provinsi,
            COUNT(DISTINCT kabupaten_kota)::int                       AS kota,
            COUNT(DISTINCT kecamatan)::int                            AS kecamatan,
            COUNT(DISTINCT kelurahan)::int                            AS kelurahan,
            COUNT(*) FILTER (WHERE upper(status) <> 'NON-AKTIF')::int AS aktif
          FROM kodepos_data;
        `;
        const row = (s && s[0]) || {};
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
        const rows = await sql.query(
          `SELECT id, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status
           FROM kodepos_data ${whereSql} ORDER BY id;`,
          params
        );
        return res
          .status(200)
          .json({ ok: true, configured: true, count: (rows || []).length, data: (rows || []).map(mapRow) });
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
      const rows = await sql.query(
        `SELECT id, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status
         FROM kodepos_data ${whereSql}
         ORDER BY id
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
      await sql.query(
        `UPDATE kodepos_data
         SET kode_pos=$1, kelurahan=$2, kecamatan=$3, kabupaten_kota=$4, provinsi=$5, status=$6, updated_at=NOW()
         WHERE id=$7;`,
        [
          String(row.kodePos ?? ''),
          String(row.kelurahan ?? ''),
          String(row.kecamatan ?? ''),
          String(row.kabupatenKota ?? ''),
          String(row.provinsi ?? ''),
          String(row.status ?? 'AKTIF'),
          id,
        ]
      );
      return res.status(200).json({ ok: true, configured: true, updated: 1 });
    }

    // ─────────────── POST (bulk import / reset / create) ───────────────
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
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
