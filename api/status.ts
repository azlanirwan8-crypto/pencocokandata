import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

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
      connected: false,
      provider: 'none',
      message: 'DATABASE_URL Neon belum terpasang di Vercel Environment Variables.',
    });
  }

  try {
    const sql = neon(connectionString);

    // Semua query paralel: 4 round-trip berurutan membuat boot aplikasi lambat
    const [timeRes, masterRes, targetRes, kodeposRes] = await Promise.all([
      sql`SELECT NOW() as current_time;`,
      sql`SELECT COUNT(*)::int as count FROM master_records;`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(*)::int as count FROM target_records;`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(*)::int as count FROM kodepos_data;`.catch(() => [{ count: 0 }]),
    ]);

    return res.status(200).json({
      connected: true,
      provider: 'Neon Postgres (Vercel)',
      serverTime: timeRes[0]?.current_time,
      tables: {
        masterRecords: masterRes[0]?.count || 0,
        targetRecords: targetRes[0]?.count || 0,
        kodeposRecords: kodeposRes[0]?.count || 0,
      },
    });
  } catch (error: any) {
    return res.status(200).json({
      connected: false,
      provider: 'Neon Postgres (Vercel)',
      error: error.message,
    });
  }
}

