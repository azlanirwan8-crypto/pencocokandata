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
            const rows = await sql`SELECT kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status FROM kodepos_data ORDER BY id;`;
            const data = (rows || []).map((r: any) => ({
              kodePos: r.kode_pos ?? '', kelurahan: r.kelurahan ?? '', kecamatan: r.kecamatan ?? '',
              kabupatenKota: r.kabupaten_kota ?? '', provinsi: r.provinsi ?? '', status: r.status ?? 'AKTIF',
            }));
            res.statusCode = 200;
            return res.end(JSON.stringify({ ok: true, configured: true, count: data.length, data }));
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

          if (req.method === 'DELETE') {
            await sql`TRUNCATE TABLE kodepos_data RESTART IDENTITY;`;
            res.statusCode = 200;
            return res.end(JSON.stringify({ ok: true, configured: true }));
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

