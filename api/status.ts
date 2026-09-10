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
      message: 'DATABASE_URL Neon belum terpasang di Vercel.',
    });
  }

  try {
    const sql = neon(connectionString);
    const result = await sql`SELECT NOW() as current_time;`;

    return res.status(200).json({
      connected: true,
      provider: 'Neon Postgres (Vercel)',
      serverTime: result[0]?.current_time,
    });
  } catch (error: any) {
    return res.status(200).json({
      connected: false,
      provider: 'Neon Postgres (Vercel)',
      error: error.message,
    });
  }
}
