import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), geocodeDevMiddleware()],
})

