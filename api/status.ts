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
    const timeRes = await sql`SELECT NOW() as current_time;`;

    let masterCount = 0;
    let targetCount = 0;
    let kodeposCount = 0;

    try {
      const m = await sql`SELECT COUNT(*)::int as count FROM master_records;`;
      masterCount = m[0]?.count || 0;
    } catch {
      // table might not have been created yet
    }

    try {
      const t = await sql`SELECT COUNT(*)::int as count FROM target_records;`;
      targetCount = t[0]?.count || 0;
    } catch {
      // table might not have been created yet
    }

    try {
      const k = await sql`SELECT COUNT(*)::int as count FROM kodepos_data;`;
      kodeposCount = k[0]?.count || 0;
    } catch {
      // table might not have been created yet
    }

    return res.status(200).json({
      connected: true,
      provider: 'Neon Postgres (Vercel)',
      serverTime: timeRes[0]?.current_time,
      tables: {
        masterRecords: masterCount,
        targetRecords: targetCount,
        kodeposRecords: kodeposCount,
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

