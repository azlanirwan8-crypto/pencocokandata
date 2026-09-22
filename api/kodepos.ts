import { rest, pesanRest } from './rest';

/**
 * /api/kodepos — Supabase Postgres CRUD Master Data Kode Pos Indonesia, lewat PostgREST.
 *
 * GET    ?view=page|stats|options|export|sync-meta   (paging + filter di server)
 *          filter: search, provinsi, kota, status   paging: page (1-based), pageSize (cap 500)
 * POST   body { rows, mode:'replace'|'append' }  → bulk import / reset / create
 * POST   ?view=sync-diff  body { keys:[...] }    → adu kunci baris lokal dengan cloud
 * PUT    ?id=X body { row }                      → update satu baris
 * DELETE ?id=X | ?all=1
 *
 * Baca/tulis berat tidak lagi berupa teks SQL di berkas ini: semuanya hidup di
 * fungsi bernama hasil server/supabase-bootstrap.sql (kp_halaman, kp_stats,
 * kp_options, kp_sync_meta, kp_sync_diff, kp_kosongkan). Alasannya, publishable
 * key hanya boleh memanggil fungsi — tidak boleh mengirim SQL bebas, dan juga
 * tidak boleh membuat tabel.
 */

// Bulk import (83k baris) & export bisa lama — naikkan batas serverless Vercel.
export const maxDuration = 60;

const PAGE_SIZE_CAP = 500;
const SYNC_DIFF_CAP = 500;
const SYNC_KEYS_CAP = 20000;
/** Baris per kiriman INSERT; 1.000 baris ≈ 120 kB, aman di bawah batas body. */
const INSERT_BATCH = 1000;
/** Halaman pengambilan penuh (export). */
const EXPORT_BATCH = 1000;

function mapRow(r: any) {
  return {
    id: r.id ?? null,
    kodePos: r.kode_pos ?? '',
    kelurahan: r.kelurahan ?? '',
    kecamatan: r.kecamatan ?? '',
    kabupatenKota: r.kabupaten_kota ?? '',
    provinsi: r.provinsi ?? '',
    status: r.status ?? 'AKTIF',
    latitude: r.latitude == null ? null : Number(r.latitude),
    longitude: r.longitude == null ? null : Number(r.longitude),
    geoSumber: r.geo_sumber ?? null,
    geoPresisi: r.geo_presisi ?? null,
    geoTerverifikasi: r.terverifikasi_google === true,
  };
}

/** Argumen fungsi kp_halaman — satu sumber untuk page, export, dan hitung. */
function argumenBaca(p: {
  search: string | null;
  provinsi: string | null;
  kota: string | null;
  status: string | null;
  sort: string | null;
  dir: string | null;
  limit: number;
  offset: number;
}) {
  return {
    p_search: p.search?.trim() || null,
    p_provinsi: p.provinsi || null,
    p_kota: p.kota || null,
    p_status: p.status || null,
    p_sort: p.sort || null,
    p_dir: p.dir || null,
    p_limit: p.limit,
    p_offset: p.offset,
  };
}

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
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  try {
    const view = url.searchParams.get('view') || 'page';
    const search = url.searchParams.get('search');
    const provinsi = url.searchParams.get('provinsi');
    const kota = url.searchParams.get('kota');
    const status = url.searchParams.get('status');

    // ─────────────────────────── GET ───────────────────────────
    if (req.method === 'GET') {
      if (view === 'stats') {
        const s = await r.rpc<Record<string, number>>('kp_stats');
        return res.status(200).json({
          ok: true,
          configured: true,
          stats: {
            total: s?.total ?? 0,
            totalProvinsi: s?.provinsi ?? 0,
            totalKota: s?.kota ?? 0,
            totalKecamatan: s?.kecamatan ?? 0,
            totalKelurahan: s?.kelurahan ?? 0,
            totalAktif: s?.aktif ?? 0,
            totalBerTitik: s?.ber_titik ?? 0,
          },
        });
      }

      if (view === 'options') {
        const o = await r.rpc<{ provinsi: string[]; kota: string[] }>('kp_options', {
          p_provinsi: provinsi || null,
        });
        return res.status(200).json({
          ok: true,
          configured: true,
          provinsi: o?.provinsi || [],
          kota: o?.kota || [],
        });
      }

      if (view === 'export') {
        // Diambil per halaman: balasan tunggal puluhan ribu baris bisa lebih besar
        // daripada batas sebuah fungsi serverless.
        const semua: any[] = [];
        let total = 0;
        for (let mulai = 0; ; mulai += EXPORT_BATCH) {
          const halaman = await r.rpc<{ rows: any[]; total: number }>('kp_halaman',
            argumenBaca({ search, provinsi, kota, status, sort: null, dir: null, limit: EXPORT_BATCH, offset: mulai }));
          const rows = halaman?.rows || [];
          semua.push(...rows);
          total = Number(halaman?.total || 0);
          if (rows.length === 0 || semua.length >= total) break;
        }
        return res.status(200).json({ ok: true, configured: true, count: semua.length, data: semua.map(mapRow) });
      }

      if (view === 'sync-meta') {
        const m = await r.rpc<{ provinces: any[]; lastUpdated: string | null }>('kp_sync_meta');
        const provinces = m?.provinces || [];
        return res.status(200).json({
          ok: true,
          configured: true,
          cloudTotal: provinces.reduce((sum: number, p: any) => sum + Number(p.total || 0), 0),
          lastUpdated: m?.lastUpdated || null,
          provinces,
        });
      }

      // default: page — satu halaman data + total untuk pagination
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const rawSize = parseInt(url.searchParams.get('pageSize') || '25', 10) || 25;
      const pageSize = Math.min(PAGE_SIZE_CAP, Math.max(1, rawSize));

      const dibaca = await r.rpc<{ rows: any[]; total: number }>('kp_halaman',
        argumenBaca({
          search,
          provinsi,
          kota,
          status,
          sort: url.searchParams.get('sort'),
          dir: url.searchParams.get('dir'),
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }));
      const total = Number(dibaca?.total || 0);

      return res.status(200).json({
        ok: true,
        configured: true,
        data: (dibaca?.rows || []).map(mapRow),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    // ─────────────── PUT (update satu baris) ───────────────
    if (req.method === 'PUT') {
      const id = parseInt(url.searchParams.get('id') || '', 10);
      if (!id) return res.status(400).json({ ok: false, error: 'id wajib diisi untuk update.' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const row = body.row || body;
      const patch: Record<string, unknown> = {
        kode_pos: String(row.kodePos ?? ''),
        kelurahan: String(row.kelurahan ?? ''),
        kecamatan: String(row.kecamatan ?? ''),
        kabupaten_kota: String(row.kabupatenKota ?? ''),
        provinsi: String(row.provinsi ?? ''),
        status: String(row.status ?? 'AKTIF'),
        updated_at: new Date().toISOString(),
      };
      // Titik koordinat hanya ditulis bila pengirimnya memang menyertakan kolom itu —
      // formulir teks lama tidak boleh menghapus titik yang sudah ada.
      if (row.latitude !== undefined || row.longitude !== undefined) {
        const angka = (v: any) => {
          if (v === null || v === '') return null;
          const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
          return Number.isFinite(n) ? n : null;
        };
        const lat = angka(row.latitude ?? null);
        const lng = angka(row.longitude ?? null);
        patch.latitude = lat;
        patch.longitude = lng;
        patch.sumber_koordinat = lat === null ? null : 'manual';
      }
      await r.ubah('kodepos_data', patch, { id: `eq.${id}` });
      return res.status(200).json({ ok: true, configured: true, updated: 1 });
    }

    // ─────────────── POST ───────────────
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // sync-diff: adu himpunan kunci baris milik klien dengan milik cloud.
      // Kunci dikirim sebagai satu string ber-pemisah chr(31), masuk sebagai satu
      // parameter bertanda → tidak ada teks permintaan yang jadi bagian pernyataan SQL.
      if (view === 'sync-diff') {
        const keys: string[] = Array.isArray(body?.keys) ? body.keys.slice(0, SYNC_KEYS_CAP) : [];
        if (keys.length === 0) {
          return res.status(400).json({ ok: false, error: 'body.keys harus array tidak kosong.' });
        }
        const cap = Math.min(SYNC_DIFF_CAP, Math.max(1, Number(body?.cap) || SYNC_DIFF_CAP));
        const diadu = await r.rpc<{ missingInCloud: string[]; missingInLocal: any[]; cloudCodes: string[] }>(
          'kp_sync_diff',
          { p_keys: keys.join(String.fromCharCode(31)), p_cap: cap }
        );
        return res.status(200).json({
          ok: true,
          configured: true,
          keysReceived: keys.length,
          missingInCloud: diadu?.missingInCloud || [],
          missingInLocal: (diadu?.missingInLocal || []).map(mapRow),
          cloudCodes: (diadu?.cloudCodes || []).map((k: any) => String(k)),
          cap,
        });
      }

      const { rows, mode = 'replace' } = body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ ok: false, error: 'rows harus array tidak kosong.' });
      }

      if (mode === 'replace') {
        await r.rpc('kp_kosongkan');
      }

      let inserted = 0;
      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        const batch = rows.slice(i, i + INSERT_BATCH).map((raw: any) => ({
          kode_pos: String(raw.kodePos ?? ''),
          kelurahan: String(raw.kelurahan ?? ''),
          kecamatan: String(raw.kecamatan ?? ''),
          kabupaten_kota: String(raw.kabupatenKota ?? ''),
          provinsi: String(raw.provinsi ?? ''),
          status: String(raw.status ?? 'AKTIF'),
        }));
        if (batch.length === 0) continue;
        await r.simpan('kodepos_data', batch);
        inserted += batch.length;
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        inserted,
        total: rows.length,
        message: `${inserted} data kode pos berhasil disimpan ke Supabase Postgres.`,
      });
    }

    // ─────────────── DELETE ───────────────
    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (id) {
        await r.hapus('kodepos_data', { id: `eq.${parseInt(id, 10)}` });
        return res.status(200).json({ ok: true, configured: true, deleted: 1 });
      }
      if (url.searchParams.get('all') === '1') {
        await r.rpc('kp_kosongkan');
        return res.status(200).json({
          ok: true,
          configured: true,
          message: 'Semua data kode pos berhasil dihapus dari Supabase Postgres.',
        });
      }
      return res.status(400).json({ ok: false, error: 'DELETE butuh ?id=X (satu baris) atau ?all=1 (truncate).' });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Supabase API Error (Kode Pos):', error);
    return res.status(500).json({ ok: false, configured: true, error: pesanRest(error) });
  }
}
