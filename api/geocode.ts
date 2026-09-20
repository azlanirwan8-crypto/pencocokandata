// Vercel Serverless Function: Realtime Geocoding Proxy (Google Maps with ESRI & OSM Fallback)
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.method === 'POST' ? req.body?.query : req.query?.query;
  const userApiKey = req.method === 'POST' ? req.body?.apiKey : req.query?.apiKey;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  const cleanQuery = query.trim();
  const apiKey = userApiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

  // 1. If Google Maps API Key is available, query Google Geocoding API first
  if (apiKey) {
    try {
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanQuery)}&key=${apiKey}&region=id&language=id`;
      const gRes = await fetch(googleUrl);
      const gData: any = await gRes.json();

      if (gData.status === 'OK' && gData.results && gData.results.length > 0) {
        const topResult = gData.results[0];
        const { lat, lng } = topResult.geometry.location;
        return res.status(200).json({
          lat: Number(lat),
          lng: Number(lng),
          formattedAddress: topResult.formatted_address,
          source: 'google',
          status: 'OK',
        });
      }
    } catch (err: any) {
      console.warn('Google Geocoding API failed, falling back to public engine:', err?.message);
    }
  }

  // 2. Fallback: ESRI ArcGIS World Geocoding (High precision in Indonesia, public CORS enabled)
  try {
    const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(cleanQuery + ', Indonesia')}&maxLocations=1&countryCode=IDN`;
    const eRes = await fetch(esriUrl);
    const eData: any = await eRes.json();

    if (eData.candidates && eData.candidates.length > 0) {
      const cand = eData.candidates[0];
      return res.status(200).json({
        lat: Number(cand.location.y),
        lng: Number(cand.location.x),
        formattedAddress: cand.address,
        source: 'esri',
        status: 'OK',
      });
    }
  } catch (err: any) {
    console.warn('ESRI Geocoding failed:', err?.message);
  }

  // 3. Fallback: Photon / OpenStreetMap
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=1`;
    const pRes = await fetch(photonUrl);
    const pData: any = await pRes.json();

    if (pData.features && pData.features.length > 0) {
      const feat = pData.features[0];
      const [lng, lat] = feat.geometry.coordinates;
      return res.status(200).json({
        lat: Number(lat),
        lng: Number(lng),
        formattedAddress: feat.properties.name || cleanQuery,
        source: 'osm',
        status: 'OK',
      });
    }
  } catch (err: any) {
    console.warn('Photon OSM Geocoding failed:', err?.message);
  }

  return res.status(404).json({
    error: 'Location not found',
    query: cleanQuery,
  });
}
