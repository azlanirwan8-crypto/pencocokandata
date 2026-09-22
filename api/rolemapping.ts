import { buatSql, ambilUrlDb } from '../server/sql';

/** DDL app_store cukup sekali per warm instance; kegagalan tidak memblokir baca. */
let appStoreReady: Promise<void> | null = null;
async function ensureAppStore(sql: any) {
  if (!appStoreReady) {
    appStoreReady = (async () => {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS app_store (
            key VARCHAR(100) PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;
      } catch (err) {
        console.warn('Migrasi app_store dilewati:', err);
      }
    })();
  }
  await appStoreReady;
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

  const connectionString = ambilUrlDb();

  if (!connectionString) {
    return res.status(200).json({
      ok: false,
      configured: false,
      message: 'DATABASE_URL (Supabase Postgres) belum terpasang di Vercel Environment Variables.',
    });
  }

  try {
    const sql = buatSql(connectionString);
    await ensureAppStore(sql);

    if (req.method === 'GET') {
      const result = await sql`
        SELECT data, updated_at
        FROM app_store
        WHERE key = 'rolemapping_data'
        LIMIT 1;
      `;
      if (result && result.length > 0) {
        return res.status(200).json({ ok: true, configured: true, data: result[0].data, updatedAt: result[0].updated_at });
      }
      return res.status(200).json({ ok: true, configured: true, data: null });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const dataJson = JSON.stringify(body);
      await sql`
        INSERT INTO app_store (key, data, updated_at)
        VALUES ('rolemapping_data', ${dataJson}::jsonb, NOW())
        ON CONFLICT (key)
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
      `;
      return res.status(200).json({ ok: true, configured: true, message: 'Data master RoleMapping berhasil disimpan ke Supabase Postgres.' });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM app_store WHERE key = 'rolemapping_data';`;
      return res.status(200).json({ ok: true, configured: true, message: 'Data master RoleMapping berhasil dibersihkan dari Supabase Postgres.' });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Neon DB API Error (RoleMapping):', error);
    return res.status(500).json({ ok: false, configured: true, error: error.message || 'Internal Server Error' });
  }
}
