import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { neon } from '@neondatabase/serverless'

function geocodeDevMiddleware(): Plugin {
  return {
    name: 'geocode-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/geocode', async (req, res) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const query = url.searchParams.get('query');
        const userApiKey = url.searchParams.get('apiKey');

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (!query || !query.trim()) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Query parameter is required' }));
        }

        const cleanQuery = query.trim();
        const apiKey = userApiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

        // 1. Google Maps Geocoding API if key provided
        if (apiKey) {
          try {
            const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanQuery)}&key=${apiKey}&region=id&language=id`;
            const gRes = await fetch(googleUrl);
            const gData = await gRes.json() as any;
            if (gData.status === 'OK' && gData.results && gData.results.length > 0) {
              const top = gData.results[0];
              res.statusCode = 200;
              return res.end(JSON.stringify({
                lat: top.geometry.location.lat,
                lng: top.geometry.location.lng,
                formattedAddress: top.formatted_address,
                source: 'google',
                status: 'OK',
              }));
            }
          } catch (e: any) {
            console.warn('[Vite Geocode] Google Geocode error:', e.message);
          }
        }

        // 2. ESRI ArcGIS World Geocoding
        try {
          const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(cleanQuery + ', Indonesia')}&maxLocations=1&countryCode=IDN`;
          const eRes = await fetch(esriUrl);
          const eData = await eRes.json() as any;
          if (eData.candidates && eData.candidates.length > 0) {
            const cand = eData.candidates[0];
            res.statusCode = 200;
            return res.end(JSON.stringify({
              lat: cand.location.y,
              lng: cand.location.x,
              formattedAddress: cand.address,
              source: 'esri',
              status: 'OK',
            }));
          }
        } catch (e: any) {
          console.warn('[Vite Geocode] ESRI Geocode error:', e.message);
        }

        // 3. Photon OSM
        try {
          const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=1`;
          const pRes = await fetch(photonUrl);
          const pData = await pRes.json() as any;
          if (pData.features && pData.features.length > 0) {
            const feat = pData.features[0];
            const [lng, lat] = feat.geometry.coordinates;
            res.statusCode = 200;
            return res.end(JSON.stringify({
              lat,
              lng,
              formattedAddress: feat.properties.name || cleanQuery,
              source: 'osm',
              status: 'OK',
            }));
          }
        } catch (e: any) {
          console.warn('[Vite Geocode] OSM Geocode error:', e.message);
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Location not found', query: cleanQuery }));
      });
    },
  };
}

function kodeposDevMiddleware(connectionString: string): Plugin {
  return {
    name: 'kodepos-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/kodepos', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end(); }

        if (!connectionString) {
          res.statusCode = 200;
          return res.end(JSON.stringify({ ok: false, configured: false, message: 'DATABASE_URL belum diset untuk dev. Buat file .env.local berisi DATABASE_URL=...' }));
        }

        try {
          const sql = neon(connectionString);
          await sql`CREATE TABLE IF NOT EXISTS kodepos_data (
            id SERIAL PRIMARY KEY, kode_pos VARCHAR(10) NOT NULL, kelurahan TEXT, kecamatan TEXT,
            kabupaten_kota TEXT, provinsi TEXT, status VARCHAR(20) DEFAULT 'AKTIF',
            created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());`;

          if (req.method === 'GET') {
            const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
            const view = url.searchParams.get('view') || 'page';
            const search = (url.searchParams.get('search') || '').trim();
            const prov = url.searchParams.get('provinsi');
            const kota = url.searchParams.get('kota');
            const status = url.searchParams.get('status');

            const where: string[] = [];
            const params: any[] = [];
            if (prov) { params.push(prov); where.push(`provinsi = $${params.length}`); }
            if (kota) { params.push(kota); where.push(`kabupaten_kota = $${params.length}`); }
            if (status) { params.push(status); where.push(`upper(status) = upper($${params.length})`); }
            if (search) {
              const idx = params.length + 1;
              params.push(`%${search}%`);
              where.push(`(kode_pos ILIKE $${idx} OR kelurahan ILIKE $${idx} OR kecamatan ILIKE $${idx} OR kabupaten_kota ILIKE $${idx} OR provinsi ILIKE $${idx})`);
            }
            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const map = (r: any) => ({ id: r.id ?? null, kodePos: r.kode_pos ?? '', kelurahan: r.kelurahan ?? '', kecamatan: r.kecamatan ?? '', kabupatenKota: r.kabupaten_kota ?? '', provinsi: r.provinsi ?? '', status: r.status ?? 'AKTIF' });

            if (view === 'stats') {
              const s = await sql`SELECT COUNT(*)::int AS total, COUNT(DISTINCT provinsi)::int AS provinsi, COUNT(DISTINCT kabupaten_kota)::int AS kota, COUNT(DISTINCT kecamatan)::int AS kecamatan, COUNT(DISTINCT kelurahan)::int AS kelurahan, COUNT(*) FILTER (WHERE upper(status) <> 'NON-AKTIF')::int AS aktif FROM kodepos_data;`;
              const row = (s && s[0]) || {};
              res.statusCode = 200;
              return res.end(JSON.stringify({ ok: true, configured: true, stats: { total: row.total ?? 0, totalProvinsi: row.provinsi ?? 0, totalKota: row.kota ?? 0, totalKecamatan: row.kecamatan ?? 0, totalKelurahan: row.kelurahan ?? 0, totalAktif: row.aktif ?? 0 } }));
            }

            if (view === 'options') {
              const provRows = await sql`SELECT DISTINCT provinsi FROM kodepos_data WHERE provinsi IS NOT NULL AND provinsi <> '' ORDER BY provinsi;`;
              let kotaRows: any[];
              if (prov) {
                kotaRows = await sql.query(`SELECT DISTINCT kabupaten_kota FROM kodepos_data WHERE kabupaten_kota IS NOT NULL AND kabupaten_kota <> '' AND provinsi = $1 ORDER BY kabupaten_kota;`, [prov]);
              } else {
                kotaRows = await sql`SELECT DISTINCT kabupaten_kota FROM kodepos_data WHERE kabupaten_kota IS NOT NULL AND kabupaten_kota <> '' ORDER BY kabupaten_kota;`;
              }
              res.statusCode = 200;
              return res.end(JSON.stringify({ ok: true, configured: true, provinsi: (provRows || []).map((r: any) => r.provinsi), kota: (kotaRows || []).map((r: any) => r.kabupaten_kota) }));
            }

            if (view === 'export') {
              const rows = await sql.query(`SELECT id, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status FROM kodepos_data ${whereSql} ORDER BY id;`, params);
              res.statusCode = 200;
              return res.end(JSON.stringify({ ok: true, configured: true, count: (rows || []).length, data: (rows || []).map(map) }));
            }

            const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
            const pageSize = Math.min(500, Math.max(1, parseInt(url.searchParams.get('pageSize') || '25', 10) || 25));
            const countRes = await sql.query(`SELECT COUNT(*)::int AS n FROM kodepos_data ${whereSql};`, params);
            const total = (countRes && countRes[0] && countRes[0].n) || 0;
            const limitIdx = params.length + 1;
            const offsetIdx = params.length + 2;
            const rows = await sql.query(`SELECT id, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status FROM kodepos_data ${whereSql} ORDER BY id LIMIT $${limitIdx} OFFSET $${offsetIdx};`, [...params, pageSize, (page - 1) * pageSize]);
            res.statusCode = 200;
            return res.end(JSON.stringify({ ok: true, configured: true, data: (rows || []).map(map), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }));
          }

          if (req.method === 'POST') {
            let raw = '';
            for await (const chunk of req) raw += chunk;
            const { rows, mode = 'replace' } = JSON.parse(raw || '{}');
            if (!Array.isArray(rows) || rows.length === 0) {
              res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'rows harus array tidak kosong.' }));
            }
            if (mode === 'replace') await sql`TRUNCATE TABLE kodepos_data RESTART IDENTITY;`;
            const BATCH = 500;
            for (let i = 0; i < rows.length; i += BATCH) {
              const batch = rows.slice(i, i + BATCH);
              const ph: string[] = []; const vals: any[] = [];
              batch.forEach((r: any, j: number) => {
                const b = j * 6;
                ph.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`);
                vals.push(String(r.kodePos ?? ''), String(r.kelurahan ?? ''), String(r.kecamatan ?? ''), String(r.kabupatenKota ?? ''), String(r.provinsi ?? ''), String(r.status ?? 'AKTIF'));
              });
              await sql.query(`INSERT INTO kodepos_data (kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status) VALUES ${ph.join(',')} ON CONFLICT DO NOTHING;`, vals);
            }
            res.statusCode = 200;
            return res.end(JSON.stringify({ ok: true, configured: true, inserted: rows.length, total: rows.length }));
          }

          if (req.method === 'PUT') {
            const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
            const id = parseInt(url.searchParams.get('id') || '', 10);
            if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'id wajib diisi untuk update.' })); }
            let rawPut = '';
            for await (const chunk of req) rawPut += chunk;
            const body = JSON.parse(rawPut || '{}');
            const row = body.row || body;
            await sql.query(`UPDATE kodepos_data SET kode_pos=$1, kelurahan=$2, kecamatan=$3, kabupaten_kota=$4, provinsi=$5, status=$6, updated_at=NOW() WHERE id=$7;`, [String(row.kodePos ?? ''), String(row.kelurahan ?? ''), String(row.kecamatan ?? ''), String(row.kabupatenKota ?? ''), String(row.provinsi ?? ''), String(row.status ?? 'AKTIF'), id]);
            res.statusCode = 200;
            return res.end(JSON.stringify({ ok: true, configured: true, updated: 1 }));
          }

          if (req.method === 'DELETE') {
            const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
            const id = url.searchParams.get('id');
            if (id) {
              await sql.query(`DELETE FROM kodepos_data WHERE id=$1;`, [parseInt(id, 10)]);
              res.statusCode = 200;
              return res.end(JSON.stringify({ ok: true, configured: true, deleted: 1 }));
            }
            if (url.searchParams.get('all') === '1') {
              await sql`TRUNCATE TABLE kodepos_data RESTART IDENTITY;`;
              res.statusCode = 200;
              return res.end(JSON.stringify({ ok: true, configured: true }));
            }
            res.statusCode = 400;
            return res.end(JSON.stringify({ ok: false, error: 'DELETE butuh ?id=X (satu baris) atau ?all=1 (truncate).' }));
          }

          res.statusCode = 405;
          return res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
        } catch (e: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ ok: false, configured: true, error: e.message }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const dbUrl = env.DATABASE_URL || env.POSTGRES_URL || env.NEON_DATABASE_URL || '';

  return {
    plugins: [react(), geocodeDevMiddleware(), kodeposDevMiddleware(dbUrl)],
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('xlsx')) return 'vendor-excel';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
            if (id.includes('leaflet')) return 'vendor-map';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('idb-keyval') || id.includes('@neondatabase') || id.includes('@supabase')) return 'vendor-db';
            return 'vendor-libs';
          }
        },
      },
    },
  },
  };
})

