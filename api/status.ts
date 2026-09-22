import { rest, pesanRest } from './_db';

/**
 * /api/status — pil "Terhubung" di kepala aplikasi.
 *
 * `app_now()` dipanggil lebih dulu: kalau fungsi itu saja tidak ada, seluruh
 * tabel pasti belum dibuat, dan menjawab connected:true dengan angka nol akan
 * terbaca sebagai "database kosong" (padahal belum di-bootstrap).
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const r = rest();
  try {
    const serverTime = await r.rpc<string>('app_now');

    const [masterRecords, targetRecords, kodeposRecords, finalRecords] = await Promise.all([
      r.hitung('master_records').catch(() => 0),
      r.hitung('target_records').catch(() => 0),
      r.hitung('kodepos_data').catch(() => 0),
      r.hitung('final_rows').catch(() => 0),
    ]);

    return res.status(200).json({
      connected: true,
      provider: 'Supabase Postgres (Vercel)',
      serverTime,
      tables: { masterRecords, targetRecords, kodeposRecords, finalRecords },
    });
  } catch (error: any) {
    console.error('Supabase API Error (Status):', error);
    return res.status(200).json({
      connected: false,
      provider: 'Supabase Postgres (Vercel)',
      error: pesanRest(error),
    });
  }
}
