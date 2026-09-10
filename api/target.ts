import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  // Setup CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

    // Auto-migrate: create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS app_store (
        key VARCHAR(100) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 1. GET: Fetch target & match data
    if (req.method === 'GET') {
      const result = await sql`
        SELECT data, updated_at 
        FROM app_store 
        WHERE key = 'target_data' 
        LIMIT 1;
      `;

      if (result && result.length > 0) {
        return res.status(200).json({
          ok: true,
          configured: true,
          data: result[0].data,
          updatedAt: result[0].updated_at,
        });
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        data: null,
      });
    }

    // 2. POST: Upsert target & match data
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const dataJson = JSON.stringify(body);

      await sql`
        INSERT INTO app_store (key, data, updated_at)
        VALUES ('target_data', ${dataJson}::jsonb, NOW())
        ON CONFLICT (key)
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
      `;

      return res.status(200).json({
        ok: true,
        configured: true,
        message: 'Data target & hasil pencocokan (data match) berhasil disimpan permanen ke Neon Postgres.',
      });
    }

    // 3. DELETE: Reset target data
    if (req.method === 'DELETE') {
      await sql`DELETE FROM app_store WHERE key = 'target_data';`;
      return res.status(200).json({
        ok: true,
        configured: true,
        message: 'Data target & data match berhasil dibersihkan dari Neon Postgres.',
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Neon DB Target API Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Terjadi kesalahan pada server database Neon Postgres: ' + (error?.message || error),
    });
  }
}
