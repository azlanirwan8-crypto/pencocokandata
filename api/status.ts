import { buatSql, ambilUrlDb } from '../server/sql';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const connectionString = ambilUrlDb();

  if (!connectionString) {
    return res.status(200).json({
      connected: false,
      provider: 'none',
      message: 'DATABASE_URL Neon belum terpasang di Vercel Environment Variables.',
    });
  }

  try {
    const sql = buatSql(connectionString);

    // Semua query paralel: round-trip berurutan membuat boot aplikasi lambat
    const [timeRes, masterRes, targetRes, kodeposRes, finalRes] = await Promise.all([
      sql`SELECT NOW() as current_time;`,
      sql`SELECT COUNT(*)::int as count FROM master_records;`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(*)::int as count FROM target_records;`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(*)::int as count FROM kodepos_data;`.catch(() => [{ count: 0 }]),
      // final_rows dibuat otomatis oleh /api/target; belum ada = 0 (belum pernah sinkron Final).
      sql`SELECT COUNT(*)::int as count FROM final_rows;`.catch(() => [{ count: 0 }]),
    ]);

    return res.status(200).json({
      connected: true,
      provider: 'Supabase Postgres (Vercel)',
      serverTime: timeRes[0]?.current_time,
      tables: {
        masterRecords: masterRes[0]?.count || 0,
        targetRecords: targetRes[0]?.count || 0,
        kodeposRecords: kodeposRes[0]?.count || 0,
        finalRecords: finalRes[0]?.count || 0,
      },
    });
  } catch (error: any) {
    return res.status(200).json({
      connected: false,
      provider: 'Supabase Postgres (Vercel)',
      error: error.message,
    });
  }
}

