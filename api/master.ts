import { buatSql, ambilUrlDb } from '../server/sql';

/**
 * /api/master — Supabase Postgres CRUD Master Data Cabang
 *
 * GET    ?limit=N&offset=M   → halaman saja + total (tanpa param = semua baris, kompatibel lama)
 * POST   body { rows, fileName, mode:'replace'|'append' }
 * DELETE → kosongkan tabel
 *
 * Tabel: master_records (+ master_meta, app_store fallback) dengan index.
 */

// Impor/ekspor puluhan ribu baris bisa lama — samakan batas dengan /api/kodepos.
export const maxDuration = 60;

const PAGE_SIZE_CAP = 500;

/**
 * DDL idempoten: cukup sekali per warm instance, bukan tiap request
 * (tiap CREATE TABLE/INDEX IF NOT EXISTS = 1 round-trip ke Postgres).
 */
let readyPromise: Promise<void> | null = null;
function ensureSchema(sql: any): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS master_records (
          id SERIAL PRIMARY KEY,
          branch_code TEXT,
          kode_cabang TEXT,
          nama_outlet TEXT,
          sandi_cabang TEXT,
          sandi TEXT,
          cabang TEXT,
          wilayah TEXT,
          status_outlet TEXT,
          alamat TEXT,
          kode_pos TEXT,
          kelurahan TEXT,
          kecamatan TEXT,
          dati_ii TEXT,
          kode_dati_ii TEXT,
          provinsi TEXT,
          telp TEXT,
          raw_data JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_master_wilayah     ON master_records(wilayah);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_master_branch_code ON master_records(branch_code);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_master_kode_pos    ON master_records(kode_pos);`;
      await sql`
        CREATE TABLE IF NOT EXISTS master_meta (
          key VARCHAR(50) PRIMARY KEY,
          file_name TEXT,
          total_count INT,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS app_store (
          key VARCHAR(100) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;
    })().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

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
    try {
      await ensureSchema(sql);
    } catch (err) {
      console.warn('Migrasi skema master dilewati:', err);
    }

    // 1. GET: Fetch master data (first from dedicated master_records table, fallback to app_store)
    if (req.method === 'GET') {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const limitRaw = url.searchParams.get('limit');
      const limit =
        limitRaw === null ? null : Math.min(PAGE_SIZE_CAP, Math.max(1, Number(limitRaw) || 1));
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

      const records = limit
        ? await sql`SELECT * FROM master_records ORDER BY id ASC LIMIT ${limit} OFFSET ${offset};`
        : await sql`SELECT * FROM master_records ORDER BY id ASC;`;

      if (records && records.length > 0) {
        const meta = await sql`
          SELECT file_name, total_count FROM master_meta WHERE key = 'master_meta' LIMIT 1;
        `;
        const fileName = meta[0]?.file_name || `${records.length} Cabang (Master_Neon.xlsx)`;

        const mappedRows = records.map((r: any) => ({
          Wilayah: r.wilayah || '',
          'Sandi Cabang': r.sandi_cabang || '',
          Sandi: r.sandi || '',
          Cabang: r.cabang || '',
          'Branch Code': r.branch_code || '',
          'Kode Cabang': r.kode_cabang || '',
          'Nama Outlet': r.nama_outlet || '',
          'Status Outlet': r.status_outlet || '',
          ALAMAT: r.alamat || '',
          'KODE POS': r.kode_pos || '',
          Kelurahan: r.kelurahan || '',
          Kecamatan: r.kecamatan || '',
          'Dati II': r.dati_ii || '',
          'Kode Dati II': r.kode_dati_ii || '',
          Provinsi: r.provinsi || '',
          Telp: r.telp || '',
          ...(r.raw_data || {}),
        }));

        // Saat dipaging, total = jumlah seluruh baris (untuk kalkulasi halaman klien)
        const total = limit
          ? (await sql`SELECT COUNT(*)::int as count FROM master_records;`)[0]?.count ?? mappedRows.length
          : mappedRows.length;

        return res.status(200).json({
          ok: true,
          configured: true,
          table: 'master_records',
          total,
          returned: mappedRows.length,
          offset,
          data: {
            rows: mappedRows,
            fileName,
          },
        });
      }

      // Fallback: check app_store
      const storeResult = await sql`
        SELECT data, updated_at 
        FROM app_store 
        WHERE key = 'master_data' 
        LIMIT 1;
      `;

      if (storeResult && storeResult.length > 0) {
        return res.status(200).json({
          ok: true,
          configured: true,
          table: 'app_store',
          data: storeResult[0].data,
          updatedAt: storeResult[0].updated_at,
        });
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        table: 'master_records',
        total: 0,
        data: null,
      });
    }

    // 2. POST: Save / Append master data into dedicated master_records table
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      const fileName = body?.fileName || 'Master_Neon_Vercel.xlsx';
      const mode = body?.mode || 'replace'; // 'replace' or 'append'

      if (mode === 'replace') {
        await sql`DELETE FROM master_records;`;
      }

      if (rows.length > 0) {
        // Chunk insert in batches of 200 using native PostgreSQL json_to_recordset
        const chunkSize = 200;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize).map((r: any) => ({
            branch_code: String(r['Branch Code'] || r['Kode Cabang'] || '').trim(),
            kode_cabang: String(r['Kode Cabang'] || r['Branch Code'] || '').trim(),
            nama_outlet: String(r['Nama Outlet'] || r['Sandi Cabang'] || r.Cabang || '').trim(),
            sandi_cabang: String(r['Sandi Cabang'] || r.Sandi || '').trim(),
            sandi: String(r.Sandi || r['Sandi Cabang'] || '').trim(),
            cabang: String(r.Cabang || '').trim(),
            wilayah: String(r.Wilayah || '').trim(),
            status_outlet: String(r['Status Outlet'] || '').trim(),
            alamat: String(r.ALAMAT || '').trim(),
            kode_pos: String(r['KODE POS'] || '').trim(),
            kelurahan: String(r.Kelurahan || '').trim(),
            kecamatan: String(r.Kecamatan || '').trim(),
            dati_ii: String(r['Dati II'] || '').trim(),
            kode_dati_ii: String(r['Kode Dati II'] || '').trim(),
            provinsi: String(r.Provinsi || '').trim(),
            telp: String(r.Telp || '').trim(),
            raw_data: r,
          }));

          await sql`
            INSERT INTO master_records (
              branch_code, kode_cabang, nama_outlet, sandi_cabang, sandi, cabang,
              wilayah, status_outlet, alamat, kode_pos, kelurahan, kecamatan,
              dati_ii, kode_dati_ii, provinsi, telp, raw_data, updated_at
            )
            SELECT
              branch_code, kode_cabang, nama_outlet, sandi_cabang, sandi, cabang,
              wilayah, status_outlet, alamat, kode_pos, kelurahan, kecamatan,
              dati_ii, kode_dati_ii, provinsi, telp, raw_data, NOW()
            FROM json_to_recordset(${JSON.stringify(chunk)}::json) as x(
              branch_code TEXT, kode_cabang TEXT, nama_outlet TEXT, sandi_cabang TEXT, sandi TEXT, cabang TEXT,
              wilayah TEXT, status_outlet TEXT, alamat TEXT, kode_pos TEXT, kelurahan TEXT, kecamatan TEXT,
              dati_ii TEXT, kode_dati_ii TEXT, provinsi TEXT, telp TEXT, raw_data JSONB
            );
          `;
        }
      }

      // Upsert metadata
      const totalCount = (await sql`SELECT COUNT(*)::int as count FROM master_records;`)[0]?.count || rows.length;
      await sql`
        INSERT INTO master_meta (key, file_name, total_count, updated_at)
        VALUES ('master_meta', ${fileName}, ${totalCount}, NOW())
        ON CONFLICT (key)
        DO UPDATE SET file_name = EXCLUDED.file_name, total_count = EXCLUDED.total_count, updated_at = NOW();
      `;

      // Dual sync to app_store for fast backup
      const dataJson = JSON.stringify(body);
      await sql`
        INSERT INTO app_store (key, data, updated_at)
        VALUES ('master_data', ${dataJson}::jsonb, NOW())
        ON CONFLICT (key)
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
      `;

      return res.status(200).json({
        ok: true,
        configured: true,
        table: 'master_records',
        totalRows: totalCount,
        message: `Sebanyak ${rows.length} data master berhasil disimpan permanen ke tabel master_records di Supabase Postgres.`,
      });
    }

    // 3. DELETE: Reset / wipe master data (only when user clicks reset)
    if (req.method === 'DELETE') {
      await sql`DELETE FROM master_records;`;
      await sql`DELETE FROM master_meta;`;
      await sql`DELETE FROM app_store WHERE key = 'master_data';`;

      return res.status(200).json({
        ok: true,
        configured: true,
        message: 'Tabel master_records dan master_meta berhasil direset/dikosongkan dari Supabase Postgres.',
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Neon DB API Error (Master):', error);
    return res.status(500).json({
      ok: false,
      configured: true,
      error: error.message || 'Internal Server Error',
    });
  }
}

