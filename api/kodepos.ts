import { neon } from '@neondatabase/serverless';

/**
 * /api/kodepos — Neon Postgres CRUD for Master Data Kode Pos Indonesia
 *
 * GET    → ambil semua data kode pos
 * POST   → simpan batch (replace/append) chunked
 * DELETE → hapus semua data
 *
 * Table: kodepos_data (dedicated, dengan index)
 * Backup: app_store key=kodepos_master_data (JSONB, untuk full-restore)
 */
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

    // app_store fallback (sama pola wilayah)
    await sql`
      CREATE TABLE IF NOT EXISTS app_store (
        key        VARCHAR(100) PRIMARY KEY,
        data       JSONB        NOT NULL,
        updated_at TIMESTAMPTZ  DEFAULT NOW()
      );
    `;

    // GET
    if (req.method === 'GET') {
      const result = await sql`
        SELECT data, updated_at FROM app_store
        WHERE key = 'kodepos_master_data' LIMIT 1;
      `;
      if (result && result.length > 0 && result[0].data) {
        const dataArr = Array.isArray(result[0].data) ? result[0].data : [];
        return res.status(200).json({ ok: true, configured: true, count: dataArr.length, data: dataArr, updatedAt: result[0].updated_at });
      }
      return res.status(200).json({ ok: true, configured: true, count: 0, data: [] });
    }

    // POST
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { rows, mode = 'replace' } = body;

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ ok: false, error: 'rows harus array tidak kosong.' });
      }

      if (mode === 'replace') {
        await sql`TRUNCATE TABLE kodepos_data RESTART IDENTITY;`;
      }

      const CHUNK = 500;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        for (const r of chunk) {
          await sql`
            INSERT INTO kodepos_data (kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status, updated_at)
            VALUES (${r.kodePos||''}, ${r.kelurahan||''}, ${r.kecamatan||''}, ${r.kabupatenKota||''}, ${r.provinsi||''}, ${r.status||'AKTIF'}, NOW())
            ON CONFLICT DO NOTHING;
          `;
          inserted++;
        }
      }

      const dataJson = JSON.stringify(rows);
      await sql`
        INSERT INTO app_store (key, data, updated_at) VALUES ('kodepos_master_data', ${dataJson}::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
      `;

      return res.status(200).json({ ok: true, configured: true, inserted, total: rows.length, message: `${inserted} data kode pos berhasil disimpan ke Neon Postgres.` });
    }

    // DELETE
    if (req.method === 'DELETE') {
      await sql`TRUNCATE TABLE kodepos_data RESTART IDENTITY;`;
      await sql`DELETE FROM app_store WHERE key = 'kodepos_master_data';`;
      return res.status(200).json({ ok: true, configured: true, message: 'Semua data kode pos berhasil dihapus dari Neon Postgres.' });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Neon DB API Error (Kode Pos):', error);
    return res.status(500).json({ ok: false, configured: true, error: error.message || 'Internal Server Error' });
  }
}
