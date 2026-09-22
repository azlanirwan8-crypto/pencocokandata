import { rest, bacaAppStore, tulisAppStore, hapusAppStore, pesanRest } from './_db';

/**
 * /api/master — Supabase Postgres CRUD Master Data Cabang, lewat PostgREST.
 *
 * GET    ?limit=N&offset=M   → halaman saja + total (tanpa param = semua baris, kompatibel lama)
 * POST   body { rows, fileName, mode:'replace'|'append' }
 * DELETE → kosongkan tabel
 *
 * Tabel: master_records (+ master_meta, app_store fallback). Skema & index dibuat
 * oleh server/supabase-bootstrap.sql, bukan lagi oleh fungsi ini.
 */

// Impor/ekspor puluhan ribu baris bisa lama — samakan batas dengan /api/kodepos.
export const maxDuration = 60;

const PAGE_SIZE_CAP = 500;
const CHUNK = 200;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  const r = rest();

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const limitRaw = url.searchParams.get('limit');
      const limit =
        limitRaw === null ? null : Math.min(PAGE_SIZE_CAP, Math.max(1, Number(limitRaw) || 1));
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

      const dibaca = limit
        ? await r.baris<any>('master_records', { urut: 'id.asc', batas: limit, mulai: offset, count: true })
        : { rows: await r.semuaBaris<any>('master_records', { urut: 'id.asc' }), total: null as number | null };
      const records = dibaca.rows;

      if (records.length > 0) {
        const meta = await r
          .baris<{ file_name: string | null; total_count: number | null }>('master_meta', {
            kolom: 'file_name,total_count',
            filter: { key: 'eq.master_meta' },
            batas: 1,
          })
          .then((x) => x.rows[0]);

        const fileName = meta?.file_name || `${records.length} Cabang (Master_Neon.xlsx)`;

        const mappedRows = records.map((raw: any) => ({
          Wilayah: raw.wilayah || '',
          'Sandi Cabang': raw.sandi_cabang || '',
          Sandi: raw.sandi || '',
          Cabang: raw.cabang || '',
          'Branch Code': raw.branch_code || '',
          'Kode Cabang': raw.kode_cabang || '',
          'Nama Outlet': raw.nama_outlet || '',
          'Status Outlet': raw.status_outlet || '',
          ALAMAT: raw.alamat || '',
          'KODE POS': raw.kode_pos || '',
          Kelurahan: raw.kelurahan || '',
          Kecamatan: raw.kecamatan || '',
          'Dati II': raw.dati_ii || '',
          'Kode Dati II': raw.kode_dati_ii || '',
          Provinsi: raw.provinsi || '',
          Telp: raw.telp || '',
          ...(raw.raw_data || {}),
        }));

        // Saat dipaging, total = jumlah seluruh baris (untuk kalkulasi halaman klien).
        const total = dibaca.total ?? mappedRows.length;

        return res.status(200).json({
          ok: true,
          configured: true,
          table: 'master_records',
          total,
          returned: mappedRows.length,
          offset,
          data: { rows: mappedRows, fileName },
        });
      }

      // Fallback: cek app_store (format lama).
      const simpanan = await bacaAppStore(r, 'master_data');
      if (simpanan) {
        return res
          .status(200)
          .json({ ok: true, configured: true, table: 'app_store', data: simpanan.data, updatedAt: simpanan.updated_at });
      }

      return res.status(200).json({ ok: true, configured: true, table: 'master_records', total: 0, data: null });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      const fileName = body?.fileName || 'Master_Neon_Vercel.xlsx';
      const mode = body?.mode || 'replace';

      if (mode === 'replace') {
        await r.hapus('master_records');
      }

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((raw: any) => ({
          branch_code: String(raw['Branch Code'] || raw['Kode Cabang'] || '').trim(),
          kode_cabang: String(raw['Kode Cabang'] || raw['Branch Code'] || '').trim(),
          nama_outlet: String(raw['Nama Outlet'] || raw['Sandi Cabang'] || raw.Cabang || '').trim(),
          sandi_cabang: String(raw['Sandi Cabang'] || raw.Sandi || '').trim(),
          sandi: String(raw.Sandi || raw['Sandi Cabang'] || '').trim(),
          cabang: String(raw.Cabang || '').trim(),
          wilayah: String(raw.Wilayah || '').trim(),
          status_outlet: String(raw['Status Outlet'] || '').trim(),
          alamat: String(raw.ALAMAT || '').trim(),
          kode_pos: String(raw['KODE POS'] || '').trim(),
          kelurahan: String(raw.Kelurahan || '').trim(),
          kecamatan: String(raw.Kecamatan || '').trim(),
          dati_ii: String(raw['Dati II'] || '').trim(),
          kode_dati_ii: String(raw['Kode Dati II'] || '').trim(),
          provinsi: String(raw.Provinsi || '').trim(),
          telp: String(raw.Telp || '').trim(),
          raw_data: raw,
          updated_at: new Date().toISOString(),
        }));
        if (chunk.length > 0) await r.simpan('master_records', chunk);
      }

      const totalCount = await r.hitung('master_records').catch(() => rows.length);
      await r.simpan(
        'master_meta',
        [{ key: 'master_meta', file_name: fileName, total_count: totalCount, updated_at: new Date().toISOString() }],
        { onKonflik: 'key' }
      );

      // Cadangan utuh di app_store, sama seperti sebelumnya.
      await tulisAppStore(r, 'master_data', body);

      return res.status(200).json({
        ok: true,
        configured: true,
        table: 'master_records',
        totalRows: totalCount,
        message: `Sebanyak ${rows.length} data master berhasil disimpan permanen ke tabel master_records di Supabase Postgres.`,
      });
    }

    if (req.method === 'DELETE') {
      await r.hapus('master_records');
      await r.hapus('master_meta');
      await hapusAppStore(r, 'master_data');
      return res.status(200).json({
        ok: true,
        configured: true,
        message: 'Tabel master_records dan master_meta berhasil direset/dikosongkan dari Supabase Postgres.',
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Supabase API Error (Master):', error);
    return res.status(500).json({ ok: false, configured: true, error: pesanRest(error) });
  }
}
