// Realtime Online Geocoding Engine (Google Maps, ESRI & OSM)
// Zero hardcoded coordinate bloat in source code.
import type { MasterRow, TargetRow } from '../types';
import { get, set } from 'idb-keyval';

export interface GeoLocationResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  source: 'google' | 'esri' | 'osm' | 'locationiq' | 'cache';
}

const STORAGE_KEY_GOOGLE_API = 'tools_matcher_google_maps_api_key';
const IDB_PREFIX = 'geo_cache_';

// In-Memory ephemeral session cache (RAM only, 0 bytes in code/harddisk)
const sessionCache = new Map<string, GeoLocationResult>();

export function getStoredGoogleApiKey(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem(STORAGE_KEY_GOOGLE_API) ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  );
}

export function setStoredGoogleApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key.trim()) {
    localStorage.setItem(STORAGE_KEY_GOOGLE_API, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_GOOGLE_API);
  }
}

/**
 * Builds an optimal search query for a Master Branch row.
 * E.g., "BNI KC Medan, Jl. Balai Kota No. 1, Kota Medan, Sumatera Utara, Indonesia"
 */
export function buildMasterQuery(row: MasterRow): string {
  const parts = [
    row['Nama Outlet'],
    row.ALAMAT,
    row.Kecamatan,
    row['Dati II'],
    row.Provinsi,
  ]
    .map((p) => String(p || '').trim())
    .filter(Boolean);

  if (parts.length === 0) return 'Indonesia';
  return parts.join(', ');
}

/**
 * Builds an optimal search query for a Target row (transaction origin).
 * E.g., "Kuta Alam, Banda Aceh, Aceh, 23121, Indonesia"
 */
export function buildTargetQuery(row: TargetRow): string {
  const parts = [
    row.Kelurahan,
    row.Kecamatan,
    row['Dati II'],
    row.Provinsi,
    row['KODE POS'],
  ]
    .map((p) => String(p || '').trim())
    .filter(Boolean);

  if (parts.length === 0) return 'Indonesia';
  return parts.join(', ');
}

/**
 * Single realtime online geocoding lookup.
 * Checks RAM session cache first, then calls backend proxy or public provider.
 */
export async function geocodeRealtime(
  query: string,
  apiKey?: string
): Promise<GeoLocationResult | null> {
  const clean = query.trim();
  if (!clean) return null;

  const cacheKey = clean.toLowerCase();
  
  // L1 Cache: In-Memory
  if (sessionCache.has(cacheKey)) {
    return sessionCache.get(cacheKey)!;
  }

  // L2 Cache: IndexedDB Persistent Cache
  try {
    const cachedData = await get<GeoLocationResult>(IDB_PREFIX + cacheKey);
    if (cachedData) {
      sessionCache.set(cacheKey, cachedData);
      return cachedData;
    }
  } catch (err) {
    // ignore idb error
  }

  const activeKey = apiKey || getStoredGoogleApiKey();

  // 1. Try local or Vercel serverless /api/geocode endpoint
  try {
    const params = new URLSearchParams({ query: clean });
    if (activeKey) params.append('apiKey', activeKey);

    const res = await fetch(`/api/geocode?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
        const result: GeoLocationResult = {
          lat: data.lat,
          lng: data.lng,
          formattedAddress: data.formattedAddress || clean,
          source: data.source || 'google',
        };
        sessionCache.set(cacheKey, result);
        try { await set(IDB_PREFIX + cacheKey, result); } catch (e) {}
        return result;
      }
    }
  } catch (err) {
    // API endpoint unavailable, fall back to direct browser fetch
  }

  // 2. Client-side direct fallback: ESRI ArcGIS World Geocoder (CORS enabled, public)
  try {
    const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(clean + ', Indonesia')}&maxLocations=1&countryCode=IDN`;
    const res = await fetch(esriUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.candidates && data.candidates.length > 0) {
        const top = data.candidates[0];
        const result: GeoLocationResult = {
          lat: Number(top.location.y),
          lng: Number(top.location.x),
          formattedAddress: top.address || clean,
          source: 'esri',
        };
        sessionCache.set(cacheKey, result);
        try { await set(IDB_PREFIX + cacheKey, result); } catch (e) {}
        return result;
      }
    }
  } catch (err) {
    // ESRI failed
  }

  // 3. Client-side direct fallback: Photon OSM (CORS enabled, public)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&limit=1`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const feat = data.features[0];
        const [lng, lat] = feat.geometry.coordinates;
        const result: GeoLocationResult = {
          lat: Number(lat),
          lng: Number(lng),
          formattedAddress: feat.properties.name || clean,
          source: 'osm',
        };
        sessionCache.set(cacheKey, result);
        try { await set(IDB_PREFIX + cacheKey, result); } catch (e) {}
        return result;
      }
    }
  } catch (err) {
    // Photon failed
  }

  // 4. Client-side direct fallback: LocationIQ (free tier, 10k req/month)
  try {
    const LOCATIONIQ_KEY = 'pk.34bc363aee1f8e1880252863ee3816e0';
    const liqUrl = `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(clean + ', Indonesia')}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(liqUrl);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const top = data[0];
        const result: GeoLocationResult = {
          lat: Number(top.lat),
          lng: Number(top.lon),
          formattedAddress: top.display_name || clean,
          source: 'locationiq',
        };
        sessionCache.set(cacheKey, result);
        try { await set(IDB_PREFIX + cacheKey, result); } catch (e) {}
        return result;
      }
    }
  } catch (err) {
    // LocationIQ failed
  }

  return null;
}

export interface BatchProgress {
  completed: number;
  total: number;
  percent: number;
  activeItem?: string;
}

/**
 * Batch resolve locations with smart de-duplication:
 * Only unique addresses are queried over the internet.
 * Concurrency is rate-managed so browser stays ultra-responsive.
 */
export async function batchGeocodeUniqueQueries(
  queries: string[],
  onProgress?: (p: BatchProgress) => void,
  apiKey?: string
): Promise<Map<string, GeoLocationResult>> {
  const uniqueQueries = Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean)));
  const results = new Map<string, GeoLocationResult>();
  const total = uniqueQueries.length;
  let completed = 0;

  if (total === 0) return results;

  // Process in small parallel chunks (e.g. 5 concurrent requests)
  const CHUNK_SIZE = 5;
  for (let i = 0; i < uniqueQueries.length; i += CHUNK_SIZE) {
    const chunk = uniqueQueries.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (query) => {
        try {
          const loc = await geocodeRealtime(query, apiKey);
          if (loc) {
            results.set(query, loc);
          }
        } catch {
          // ignore individual failures
        } finally {
          completed++;
          if (onProgress) {
            onProgress({
              completed,
              total,
              percent: Math.round((completed / total) * 100),
              activeItem: query,
            });
          }
        }
      })
    );
  }

  return results;
}
