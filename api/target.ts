import { neon } from '@neondatabase/serverless';

/**
 * /api/target — Neon Postgres CRUD Data Target & Match
 *
 * GET    ?limit=N&offset=M   → halaman saja + total (tanpa param = semua baris, kompatibel lama)
 * POST   body { rows, fileName, mode:'replace'|'append' }
 * DELETE → kosongkan tabel
 *
 * Tabel: target_records (+ target_meta, app_store fallback) dengan index.
 *
 * --- ?view=final (Data Final Analisa; satu-satunya jalur cloud untuk `analyst_final_data`) ---
 * GET    ?view=final&limit=N&offset=M → halaman baris + total (order = row_key agar paging stabil)
 * POST   ?view=final  body { rows, mode:'upsert'|'replace' } → upsert per baris, tanpa menghapus
 *        baris lain (kecuali mode 'replace'), jadi tidak ada jendela "cloud kosong".
 * DELETE ?view=final&key=K  → hapus 1 baris | ?view=final&all=1 → kosongkan seluruh tabel
 *
 * Tabel per-baris (bukan 1 blob JSONB) karena Final Data bisa puluhan ribu baris × ~40 field:
 * satu blob utuh menabrak batas body Vercel (~4,5 MB) dan read-modify-write per chunk mahal.
 */

// Impor puluhan ribu baris bisa lama — samakan batas dengan /api/kodepos.
export const maxDuration = 60;

const PAGE_SIZE_CAP = 500;

/** ?view=final selalu dipaging — tanpa `limit` pun satu baca maksimal seukuran ini. */
const FINAL_PAGE_DEFAULT = 500;
/** Baris per INSERT; ~40 kolom × 200 baris masih jauh di bawah batas body/proses serverless. */
const FINAL_INSERT_CHUNK = 200;

/** DDL idempoten: sekali per warm instance, bukan tiap request. */
let readyPromise: Promise<void> | null = null;
function ensureSchema(sql: any): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS target_records (
          id SERIAL PRIMARY KEY,
          no_urut INT,
          wilayah TEXT,
          branch_code TEXT,
          kode_cabang TEXT,
          nama_outlet TEXT,
          sandi_cabang TEXT,
          sandi TEXT,
          cabang TEXT,
          status_outlet TEXT,
          alamat TEXT,
          kode_pos TEXT,
          kelurahan TEXT,
          kecamatan TEXT,
          dati_ii TEXT,
          kode_dati_ii TEXT,
          provinsi TEXT,
          sumber_data TEXT,
          is_matched BOOLEAN DEFAULT false,
          match_level TEXT,
          matched_at TEXT,
          matched_by TEXT,
          raw_data JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_target_no_urut   ON target_records(no_urut, id);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_target_wilayah   ON target_records(wilayah);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_target_is_matched ON target_records(is_matched);`;
      await sql`
        CREATE TABLE IF NOT EXISTS target_meta (
          key VARCHAR(50) PRIMARY KEY,
          file_name TEXT,
          initial_count INT,
          matched_done BOOLEAN DEFAULT false,
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
      await sql`
        CREATE TABLE IF NOT EXISTS final_rows (
          row_key TEXT PRIMARY KEY,
          raw_data JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
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
    try {
      await ensureSchema(sql);
    } catch (err) {
      console.warn('Migrasi skema target dilewati:', err);
    }

    // 1. GET: Fetch target & match data (first from dedicated target_records table, fallback to app_store)
    if (req.method === 'GET') {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const limitRaw = url.searchParams.get('limit');
      const limit =
        limitRaw === null ? null : Math.min(PAGE_SIZE_CAP, Math.max(1, Number(limitRaw) || 1));
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

      // 1a. ?view=final → Data Final (selalu dipaging; blob utuh bisa >4,5 MB)
      if (url.searchParams.get('view') === 'final') {
        const fLimit = limit ?? FINAL_PAGE_DEFAULT;
        const records = await sql`
          SELECT raw_data FROM final_rows ORDER BY row_key ASC LIMIT ${fLimit} OFFSET ${offset};
        `;
        const total = (await sql`SELECT COUNT(*)::int as count FROM final_rows;`)[0]?.count ?? 0;

        return res.status(200).json({
          ok: true,
          configured: true,
          table: 'final_rows',
          total,
          returned: records.length,
          offset,
          limit: fLimit,
          data: {
            rows: records.map((r: any) => r.raw_data),
          },
        });
      }

      const records = limit
        ? await sql`SELECT * FROM target_records ORDER BY no_urut ASC, id ASC LIMIT ${limit} OFFSET ${offset};`
        : await sql`SELECT * FROM target_records ORDER BY no_urut ASC, id ASC;`;

      if (records && records.length > 0) {
        const meta = await sql`
          SELECT file_name, initial_count, matched_done FROM target_meta WHERE key = 'target_meta' LIMIT 1;
        `;
        const fileName = meta[0]?.file_name || `${records.length} Data Target (Target_Neon.xlsx)`;
        const initialCount = meta[0]?.initial_count || records.length;
        const matchedDone = Boolean(meta[0]?.matched_done);

        const mappedRows = records.map((r: any) => ({
          No: r.no_urut,
          Wilayah: r.wilayah || '',
          'Branch Code': r.branch_code || '',
          'Kode Cabang': r.kode_cabang || '',
          'Nama Outlet': r.nama_outlet || '',
          'Status Outlet': r.status_outlet || '',
          'Sandi Cabang': r.sandi_cabang || '',
          Sandi: r.sandi || '',
          Cabang: r.cabang || '',
          ALAMAT: r.alamat || '',
          'KODE POS': r.kode_pos || '',
          Kelurahan: r.kelurahan || '',
          Kecamatan: r.kecamatan || '',
          'Dati II': r.dati_ii || '',
          'Kode Dati II': r.kode_dati_ii || '',
          Provinsi: r.provinsi || '',
          'SUMBER DATA': r.sumber_data || '',
          _isMatched: Boolean(r.is_matched),
          _matchLevel: r.match_level || undefined,
          _matchedAt: r.matched_at || undefined,
          _matchedBy: r.matched_by || undefined,
          ...(r.raw_data || {}),
        }));

        // Saat dipaging, total = jumlah seluruh baris (untuk kalkulasi halaman klien)
        const total = limit
          ? (await sql`SELECT COUNT(*)::int as count FROM target_records;`)[0]?.count ?? mappedRows.length
          : mappedRows.length;

        return res.status(200).json({
          ok: true,
          configured: true,
          table: 'target_records',
          total,
          returned: mappedRows.length,
          offset,
          data: {
            rows: mappedRows,
            fileName,
            initialCount,
            matchedDone,
          },
        });
      }

      // Fallback: check app_store
      const storeResult = await sql`
        SELECT data, updated_at 
        FROM app_store 
        WHERE key = 'target_data' 
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
        table: 'target_records',
        total: 0,
        data: null,
      });
    }

    // 2. POST: Save / Update target & match data into dedicated target_records table
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      const urlPost = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const viewPost = urlPost.searchParams.get('view');

      // Sama seperti DELETE: `view` tak dikenal tidak boleh jatuh ke jalur target_records
      // (mode 'replace' di sana menghapus seluruh tabel lebih dulu).
      if (viewPost && viewPost !== 'final') {
        return res.status(400).json({
          ok: false,
          configured: true,
          error: `view=${viewPost} tidak dikenal untuk POST /api/target.`,
        });
      }

      // 2a. POST ?view=final → upsert baris Data Final. Default 'upsert' (tanpa DELETE),
      //     supaya kegagalan di tengah chunk tidak pernah meninggalkan cloud dalam keadaan kosong.
      if (viewPost === 'final') {
        const fMode = body?.mode === 'replace' ? 'replace' : 'upsert';
        if (fMode === 'replace') {
          await sql`DELETE FROM final_rows;`;
        }

        let written = 0;
        for (let i = 0; i < rows.length; i += FINAL_INSERT_CHUNK) {
          const chunk = rows
            .slice(i, i + FINAL_INSERT_CHUNK)
            .map((r: any) => ({ row_key: String(r?.id ?? '').trim(), raw_data: r }))
            .filter((r) => r.row_key.length > 0);
          if (chunk.length === 0) continue;

          await sql`
            INSERT INTO final_rows (row_key, raw_data, updated_at)
            SELECT row_key, raw_data, NOW()
            FROM json_to_recordset(${JSON.stringify(chunk)}::json) as x(
              row_key TEXT, raw_data JSONB
            )
            ON CONFLICT (row_key)
            DO UPDATE SET raw_data = EXCLUDED.raw_data, updated_at = NOW();
          `;
          written += chunk.length;
        }

        const total = (await sql`SELECT COUNT(*)::int as count FROM final_rows;`)[0]?.count ?? written;
        return res.status(200).json({
          ok: true,
          configured: true,
          table: 'final_rows',
          written,
          totalRows: total,
          message: `${written} baris Data Final tersimpan permanen di tabel final_rows (total ${total} baris).`,
        });
      }

      const fileName = body?.fileName || 'Target_Neon_Vercel.xlsx';
      const initialCount = body?.initialCount || rows.length;
      const matchedDone = Boolean(body?.matchedDone);
      const mode = body?.mode || 'replace'; // 'replace' or 'append'

      if (mode === 'replace') {
        await sql`DELETE FROM target_records;`;
      }

      if (rows.length > 0) {
        // Chunk insert in batches of 200 using native PostgreSQL json_to_recordset
        const chunkSize = 200;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize).map((r: any, idx: number) => ({
            no_urut: typeof r.No === 'number' ? r.No : parseInt(r.No, 10) || i + idx + 1,
            wilayah: String(r.Wilayah || '').trim(),
            branch_code: String(r['Branch Code'] || r['Kode Cabang'] || '').trim(),
            kode_cabang: String(r['Kode Cabang'] || r['Branch Code'] || '').trim(),
            nama_outlet: String(r['Nama Outlet'] || '').trim(),
            sandi_cabang: String(r['Sandi Cabang'] || r.Sandi || r.Cabang || '').trim(),
            sandi: String(r.Sandi || r['Sandi Cabang'] || '').trim(),
            cabang: String(r.Cabang || '').trim(),
            status_outlet: String(r['Status Outlet'] || '').trim(),
            alamat: String(r.ALAMAT || '').trim(),
            kode_pos: String(r['KODE POS'] || '').trim(),
            kelurahan: String(r.Kelurahan || '').trim(),
            kecamatan: String(r.Kecamatan || '').trim(),
            dati_ii: String(r['Dati II'] || '').trim(),
            kode_dati_ii: String(r['Kode Dati II'] || '').trim(),
            provinsi: String(r.Provinsi || '').trim(),
            sumber_data: String(r['SUMBER DATA'] || '').trim(),
            is_matched: Boolean(r._isMatched),
            match_level: r._matchLevel ? String(r._matchLevel) : null,
            matched_at: r._matchedAt ? String(r._matchedAt) : null,
            matched_by: r._matchedBy ? String(r._matchedBy) : null,
            raw_data: r,
          }));

          await sql`
            INSERT INTO target_records (
              no_urut, wilayah, branch_code, kode_cabang, nama_outlet,
              sandi_cabang, sandi, cabang, status_outlet, alamat,
              kode_pos, kelurahan, kecamatan, dati_ii, kode_dati_ii,
              provinsi, sumber_data, is_matched, match_level, matched_at, matched_by,
              raw_data, updated_at
            )
            SELECT
              no_urut, wilayah, branch_code, kode_cabang, nama_outlet,
              sandi_cabang, sandi, cabang, status_outlet, alamat,
              kode_pos, kelurahan, kecamatan, dati_ii, kode_dati_ii,
              provinsi, sumber_data, is_matched, match_level, matched_at, matched_by,
              raw_data, NOW()
            FROM json_to_recordset(${JSON.stringify(chunk)}::json) as x(
              no_urut INT, wilayah TEXT, branch_code TEXT, kode_cabang TEXT, nama_outlet TEXT,
              sandi_cabang TEXT, sandi TEXT, cabang TEXT, status_outlet TEXT, alamat TEXT,
              kode_pos TEXT, kelurahan TEXT, kecamatan TEXT, dati_ii TEXT, kode_dati_ii TEXT,
              provinsi TEXT, sumber_data TEXT, is_matched BOOLEAN, match_level TEXT, matched_at TEXT, matched_by TEXT,
              raw_data JSONB
            );
          `;
        }
      }

      // Upsert metadata
      const totalCount = (await sql`SELECT COUNT(*)::int as count FROM target_records;`)[0]?.count || rows.length;
      await sql`
        INSERT INTO target_meta (key, file_name, initial_count, matched_done, updated_at)
        VALUES ('target_meta', ${fileName}, ${initialCount}, ${matchedDone}, NOW())
        ON CONFLICT (key)
        DO UPDATE SET 
          file_name = EXCLUDED.file_name,
          initial_count = EXCLUDED.initial_count,
          matched_done = EXCLUDED.matched_done,
          updated_at = NOW();
      `;

      // Dual sync to app_store for fast backup
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
        table: 'target_records',
        totalRows: totalCount,
        message: `Sebanyak ${rows.length} data target & status matching berhasil disimpan permanen ke tabel target_records di Neon Postgres.`,
      });
    }

    // 3. DELETE: Reset / wipe target data (only when user clicks reset)
    if (req.method === 'DELETE') {
      const urlDel = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const viewDel = urlDel.searchParams.get('view');

      // Parameter `view` yang tidak dikenal = salah ketik URL. Tanpa penolakan ini,
      // satu karakter `&` yang tertinggal akan menjatuhkan permintaan ke penghapusan
      // seluruh target_records di bawah.
      if (viewDel && viewDel !== 'final') {
        return res.status(400).json({
          ok: false,
          configured: true,
          error: `view=${viewDel} tidak dikenal untuk DELETE /api/target.`,
        });
      }

      // 3a. DELETE ?view=final → hapus 1 baris (?key=K) atau kosongkan (?all=1).
      //     Tanpa keduanya: tolak, agar satu DELETE lupa param tidak menghapus semua hasil.
      if (viewDel === 'final') {
        const oneKey = (urlDel.searchParams.get('key') || '').trim();
        if (urlDel.searchParams.get('all') === '1') {
          const deleted = await sql`DELETE FROM final_rows RETURNING row_key;`;
          return res.status(200).json({
            ok: true,
            configured: true,
            table: 'final_rows',
            deleted: deleted.length,
            message: `Tabel final_rows berhasil dikosongkan (${deleted.length} baris dihapus).`,
          });
        }
        if (oneKey) {
          const deleted = await sql`DELETE FROM final_rows WHERE row_key = ${oneKey} RETURNING row_key;`;
          return res.status(200).json({
            ok: true,
            configured: true,
            table: 'final_rows',
            deleted: deleted.length,
            message: deleted.length
              ? `Baris Data Final ${oneKey} berhasil dihapus dari Neon Postgres.`
              : `Baris ${oneKey} tidak ditemukan di final_rows (mungkin belum pernah disinkronkan).`,
          });
        }
        return res.status(400).json({
          ok: false,
          configured: true,
          error: 'DELETE ?view=final membutuhkan ?key=<row id> atau ?all=1.',
        });
      }

      await sql`DELETE FROM target_records;`;
      await sql`DELETE FROM target_meta;`;
      await sql`DELETE FROM app_store WHERE key = 'target_data';`;

      return res.status(200).json({
        ok: true,
        configured: true,
        message: 'Tabel target_records dan target_meta berhasil direset/dikosongkan dari Neon Postgres.',
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Neon DB API Error (Target):', error);
    return res.status(500).json({
      ok: false,
      configured: true,
      error: error.message || 'Internal Server Error',
    });
  }
}

