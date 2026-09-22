import { rest, bacaAppStore, tulisAppStore, hapusAppStore, pesanRest } from './rest';

/**
 * /api/pten — master PTEN tersimpan di app_store kunci `pten_data`.
 * Bicara ke Supabase lewat PostgREST + publishable key: tanpa kata sandi basis data.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  const r = rest();
  const KUNCI = 'pten_data';

  try {
    if (req.method === 'GET') {
      const baris = await bacaAppStore(r, KUNCI);
      return res
        .status(200)
        .json(
          baris
            ? { ok: true, configured: true, data: baris.data, updatedAt: baris.updated_at }
            : { ok: true, configured: true, data: null }
        );
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await tulisAppStore(r, KUNCI, body);
      return res.status(200).json({
        ok: true,
        configured: true,
        message: 'Data master PTEN berhasil disimpan ke Supabase Postgres.',
      });
    }

    if (req.method === 'DELETE') {
      await hapusAppStore(r, KUNCI);
      return res.status(200).json({
        ok: true,
        configured: true,
        message: 'Data master PTEN berhasil dibersihkan dari Supabase Postgres.',
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Supabase API Error (PTEN):', error);
    return res.status(500).json({ ok: false, configured: true, error: pesanRest(error) });
  }
}
