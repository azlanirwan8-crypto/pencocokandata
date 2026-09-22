import { rest, bacaAppStore, tulisAppStore, hapusAppStore, pesanRest } from './_db';

/**
 * /api/target — Supabase Postgres CRUD Data Target & Match, lewat PostgREST.
 *
 * GET    ?limit=N&offset=M   → halaman saja + total (tanpa param = semua baris, kompatibel lama)
 * POST   body { rows, fileName, mode:'replace'|'append' }
 * DELETE → kosongkan tabel
 *
 * --- ?view=final (Data Final Analisa; satu-satunya jalur cloud untuk `analyst_final_data`) ---
 * GET    ?view=final&limit=N&offset=M → halaman baris + total (order = row_key agar paging stabil)
 * POST   ?view=final  body { rows, mode:'upsert'|'replace' } → upsert per baris, tanpa menghapus
 *        baris lain (kecuali mode 'replace'), jadi tidak ada jendela "cloud kosong".
 * POST   ?view=final  body { mode:'hapus', keys:[...] } → hapus ≤1000 baris sekali jalan
 *        (lewat fungsi final_hapus: kuncinya parameter ternama, bukan teks yang digabung).
 * DELETE ?view=final&key=K  → hapus 1 baris | ?view=final&all=1 → kosongkan seluruh tabel
 *
 * Skema + fungsinya dibuat server/supabase-bootstrap.sql, bukan oleh fungsi ini.
 */

// Impor puluhan ribu baris bisa lama — samakan batas dengan /api/kodepos.
export const maxDuration = 60;

const PAGE_SIZE_CAP = 500;

/** ?view=final selalu dipaging — tanpa `limit` pun satu baca maksimal seukuran ini. */
const FINAL_PAGE_DEFAULT = 500;
/** Baris per kiriman; ~40 kolom × 200 baris masih jauh di bawah batas body serverless. */
const FINAL_INSERT_CHUNK = 200;
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
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw === null ? null : Math.min(PAGE_SIZE_CAP, Math.max(1, Number(limitRaw) || 1));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

  try {
    // ─────────────── GET ───────────────
    if (req.method === 'GET') {
      if (url.searchParams.get('view') === 'final') {
        const fLimit = limit ?? FINAL_PAGE_DEFAULT;
        const { rows, total } = await r.baris<{ raw_data: any }>('final_rows', {
          kolom: 'raw_data',
          urut: 'row_key.asc',
          batas: fLimit,
          mulai: offset,
          count: true,
        });
        return res.status(200).json({
          ok: true,
          configured: true,
          table: 'final_rows',
          total: total ?? rows.length,
          returned: rows.length,
          offset,
          limit: fLimit,
          data: { rows: rows.map((x) => x.raw_data) },
        });
      }

      const dibaca = limit
        ? await r.baris<any>('target_records', { urut: 'no_urut.asc,id.asc', batas: limit, mulai: offset, count: true })
        : { rows: await r.semuaBaris<any>('target_records', { urut: 'no_urut.asc,id.asc' }), total: null as number | null };
      const records = dibaca.rows;

      if (records.length > 0) {
        const meta = await r
          .baris<{ file_name: string | null; initial_count: number | null; matched_done: boolean | null }>(
            'target_meta',
            { kolom: 'file_name,initial_count,matched_done', filter: { key: 'eq.target_meta' }, batas: 1 }
          )
          .then((x) => x.rows[0]);

        const fileName = meta?.file_name || `${records.length} Data Target (Target_Neon.xlsx)`;
        const initialCount = meta?.initial_count || records.length;
        const matchedDone = Boolean(meta?.matched_done);

        const mappedRows = records.map((raw: any) => ({
          No: raw.no_urut,
          Wilayah: raw.wilayah || '',
          'Branch Code': raw.branch_code || '',
          'Kode Cabang': raw.kode_cabang || '',
          'Nama Outlet': raw.nama_outlet || '',
          'Status Outlet': raw.status_outlet || '',
          'Sandi Cabang': raw.sandi_cabang || '',
          Sandi: raw.sandi || '',
          Cabang: raw.cabang || '',
          ALAMAT: raw.alamat || '',
          'KODE POS': raw.kode_pos || '',
          Kelurahan: raw.kelurahan || '',
          Kecamatan: raw.kecamatan || '',
          'Dati II': raw.dati_ii || '',
          'Kode Dati II': raw.kode_dati_ii || '',
          Provinsi: raw.provinsi || '',
          'SUMBER DATA': raw.sumber_data || '',
          _isMatched: Boolean(raw.is_matched),
          _matchLevel: raw.match_level || undefined,
          _matchedAt: raw.matched_at || undefined,
          _matchedBy: raw.matched_by || undefined,
          ...(raw.raw_data || {}),
        }));

        return res.status(200).json({
          ok: true,
          configured: true,
          table: 'target_records',
          total: dibaca.total ?? mappedRows.length,
          returned: mappedRows.length,
          offset,
          data: { rows: mappedRows, fileName, initialCount, matchedDone },
        });
      }

      const simpanan = await bacaAppStore(r, 'target_data');
      if (simpanan) {
        return res
          .status(200)
          .json({ ok: true, configured: true, table: 'app_store', data: simpanan.data, updatedAt: simpanan.updated_at });
      }

      return res.status(200).json({ ok: true, configured: true, table: 'target_records', total: 0, data: null });
    }

    // ─────────────── POST ───────────────
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      const viewPost = url.searchParams.get('view');

      // `view` tak dikenal tidak boleh jatuh ke jalur target_records
      // (mode 'replace' di sana menghapus seluruh tabel lebih dulu).
      if (viewPost && viewPost !== 'final') {
        return res.status(400).json({
          ok: false,
          configured: true,
          error: `view=${viewPost} tidak dikenal untuk POST /api/target.`,
        });
      }

      if (viewPost === 'final') {
        if (body?.mode === 'hapus') {
          const mentah: unknown[] = Array.isArray(body.keys) ? body.keys : [];
          const kunci = [...new Set(mentah.map((k) => String(k ?? '').trim()).filter(Boolean))];
          if (kunci.length === 0) {
            return res.status(400).json({ ok: false, configured: true, error: "mode 'hapus' membutuhkan body.keys berisi row_key." });
          }
          if (kunci.length > 1000) {
            return res.status(400).json({
              ok: false,
              configured: true,
              error: `Maksimal 1000 kunci per permintaan (diterima ${kunci.length}); kirim per chunk.`,
            });
          }
          const terhapus = (await r.rpc<string[]>('final_hapus', { p_keys: kunci })) || [];
          return res.status(200).json({
            ok: true,
            configured: true,
            table: 'final_rows',
            deleted: terhapus.length,
            diminta: kunci.length,
            message: `${terhapus.length} dari ${kunci.length} baris Data Final terhapus dari Supabase Postgres.`,
          });
        }

        const fMode = body?.mode === 'replace' ? 'replace' : 'upsert';
        if (fMode === 'replace') await r.hapus('final_rows');

        let written = 0;
        for (let i = 0; i < rows.length; i += FINAL_INSERT_CHUNK) {
          const chunk = rows
            .slice(i, i + FINAL_INSERT_CHUNK)
            .map((raw: any) => ({ row_key: String(raw?.id ?? '').trim(), raw_data: raw }))
            .filter((x) => x.row_key.length > 0);
          if (chunk.length === 0) continue;
          await r.simpan('final_rows', chunk, { onKonflik: 'row_key' });
          written += chunk.length;
        }

        const total = await r.hitung('final_rows').catch(() => written);
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
      const mode = body?.mode || 'replace';

      if (mode === 'replace') await r.hapus('target_records');

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((raw: any, idx: number) => ({
          no_urut: typeof raw.No === 'number' ? raw.No : parseInt(raw.No, 10) || i + idx + 1,
          wilayah: String(raw.Wilayah || '').trim(),
          branch_code: String(raw['Branch Code'] || raw['Kode Cabang'] || '').trim(),
          kode_cabang: String(raw['Kode Cabang'] || raw['Branch Code'] || '').trim(),
          nama_outlet: String(raw['Nama Outlet'] || '').trim(),
          sandi_cabang: String(raw['Sandi Cabang'] || raw.Sandi || raw.Cabang || '').trim(),
          sandi: String(raw.Sandi || raw['Sandi Cabang'] || '').trim(),
          cabang: String(raw.Cabang || '').trim(),
          status_outlet: String(raw['Status Outlet'] || '').trim(),
          alamat: String(raw.ALAMAT || '').trim(),
          kode_pos: String(raw['KODE POS'] || '').trim(),
          kelurahan: String(raw.Kelurahan || '').trim(),
          kecamatan: String(raw.Kecamatan || '').trim(),
          dati_ii: String(raw['Dati II'] || '').trim(),
          kode_dati_ii: String(raw['Kode Dati II'] || '').trim(),
          provinsi: String(raw.Provinsi || '').trim(),
          sumber_data: String(raw['SUMBER DATA'] || '').trim(),
          is_matched: Boolean(raw._isMatched),
          match_level: raw._matchLevel ? String(raw._matchLevel) : null,
          matched_at: raw._matchedAt ? String(raw._matchedAt) : null,
          matched_by: raw._matchedBy ? String(raw._matchedBy) : null,
          raw_data: raw,
          updated_at: new Date().toISOString(),
        }));
        if (chunk.length > 0) await r.simpan('target_records', chunk);
      }

      const totalCount = await r.hitung('target_records').catch(() => rows.length);
      await r.simpan(
        'target_meta',
        [
          {
            key: 'target_meta',
            file_name: fileName,
            initial_count: initialCount,
            matched_done: matchedDone,
            updated_at: new Date().toISOString(),
          },
        ],
        { onKonflik: 'key' }
      );
      await tulisAppStore(r, 'target_data', body);

      return res.status(200).json({
        ok: true,
        configured: true,
        table: 'target_records',
        totalRows: totalCount,
        message: `Sebanyak ${rows.length} data target & status matching berhasil disimpan permanen ke tabel target_records di Supabase Postgres.`,
      });
    }

    // ─────────────── DELETE ───────────────
    if (req.method === 'DELETE') {
      const viewDel = url.searchParams.get('view');

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

      if (viewDel === 'final') {
        const oneKey = (url.searchParams.get('key') || '').trim();
        if (url.searchParams.get('all') === '1') {
          const sebelum = await r.hitung('final_rows');
          await r.hapus('final_rows');
          return res.status(200).json({
            ok: true,
            configured: true,
            table: 'final_rows',
            deleted: sebelum,
            message: `Tabel final_rows berhasil dikosongkan (${sebelum} baris dihapus).`,
          });
        }
        if (oneKey) {
          const terhapus = (await r.rpc<string[]>('final_hapus', { p_keys: [oneKey] })) || [];
          return res.status(200).json({
            ok: true,
            configured: true,
            table: 'final_rows',
            deleted: terhapus.length,
            message: terhapus.length
              ? `Baris Data Final ${oneKey} berhasil dihapus dari Supabase Postgres.`
              : `Baris ${oneKey} tidak ditemukan di final_rows (mungkin belum pernah disinkronkan).`,
          });
        }
        return res.status(400).json({
          ok: false,
          configured: true,
          error: 'DELETE ?view=final membutuhkan ?key=<row id> atau ?all=1.',
        });
      }

      await r.hapus('target_records');
      await r.hapus('target_meta');
      await hapusAppStore(r, 'target_data');

      return res.status(200).json({
        ok: true,
        configured: true,
        message: 'Tabel target_records dan target_meta berhasil direset/dikosongkan dari Supabase Postgres.',
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Supabase API Error (Target):', error);
    return res.status(500).json({ ok: false, configured: true, error: pesanRest(error) });
  }
}
