// Realtime Online Geocoding Engine (Google Maps, ESRI & OSM)
// Zero hardcoded coordinate bloat in source code.
import type { MasterRow, TargetRow } from '../types';
import { get, set } from 'idb-keyval';

export interface GeoLocationResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  source: 'google' | 'esri' | 'osm' | 'locationiq' | 'cache' | 'desa';
}

const IDB_PREFIX = 'geo_cache_';

// In-Memory ephemeral session cache (RAM only, 0 bytes in code/harddisk)
const sessionCache = new Map<string, GeoLocationResult>();

type TitikSimpanan = { lat: number; lng: number; sumber: 'google' | 'esri' | 'osm' | 'desa' };
let titikKodePosJanji: Promise<Record<string, TitikSimpanan>> | null = null;

/** Kode pos = angka 5 digit paling ujung query (bukan nomor jalan di tengah alamat). */
export function kodePosUjung(query: string): string | undefined {
  return (query.trim().match(/(\d{5})(?:,\s*Indonesia)?\s*$/) || [])[1];
}

/**
 * Titik kode pos yang sudah tersimpan di cloud — prioritas rata-rata titik desa per kode
 * pos (kodepos_data), sisanya cache geocoding (kodepos_geo). Inilah sumber lokasi peta
 * dashboard: sekali muat per sesi, tidak menebak ulang lewat internet.
 *
 * Balasan yang gagal ATAU kosong tidak boleh menular: tanpa pelemparan di bawah, satu
 * 500 saat boot (terukur 2026-09-24 di match-sepia.vercel.app) membuat `titikKodePos`
 * kosong sepanjang sesi — semua titik cabang jatuh ke pusat wilayah dan lapisan kode pos
 * tampil 0 titik. Cache dihapus supaya pemanggil berikutnya mencoba lagi.
 */
export function muatTitikKodePos(): Promise<Record<string, TitikSimpanan>> {
  if (!titikKodePosJanji) {
    titikKodePosJanji = fetch('/api/kodepos-geo?view=points')
      .then(async (r) => {
        if (!r.ok) throw new Error(`/api/kodepos-geo membalas HTTP ${r.status}`);
        return r.json();
      })
      .then((json: any) => {
        const out: Record<string, TitikSimpanan> = {};
        for (const t of json?.data || []) {
          const kode = String(t?.kodePos || '').trim();
          const lat = Number(t?.lat);
          const lng = Number(t?.lng);
          const sumber = t?.sumber;
          if (!kode || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          if (sumber !== 'google' && sumber !== 'esri' && sumber !== 'osm' && sumber !== 'desa') continue;
          out[kode] = { lat, lng, sumber };
        }
        if (Object.keys(out).length === 0) throw new Error('/api/kodepos-geo mengirim 0 titik');
        return out;
      })
      .catch((err) => {
        titikKodePosJanji = null;
        console.warn('Titik kode pos belum terbaca, akan dicoba lagi:', err);
        return {} as Record<string, TitikSimpanan>;
      });
  }
  return titikKodePosJanji;
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
 * Kode pos yang sudah punya titik di cloud dipakai lebih dulu; selain itu baru cache,
 * lalu proxy backend /api/geocode dan penyedia publik.
 */
export async function geocodeRealtime(
  query: string
): Promise<GeoLocationResult | null> {
  const clean = query.trim();
  if (!clean) return null;

  const cacheKey = clean.toLowerCase();

  // 0. Titik kode pos yang tersimpan di Neon menang mutlak (dan idealnya sudah
  //    terverifikasi Google): peta dashboard memakai titik yang sama dengan Kode Pos.
  const kodePos = kodePosUjung(clean);
  if (kodePos) {
    const titik = (await muatTitikKodePos())[kodePos];
    if (titik) {
      const result: GeoLocationResult = {
        lat: titik.lat,
        lng: titik.lng,
        formattedAddress: `Titik kode pos ${kodePos} (tersimpan di Supabase Postgres)`,
        source: titik.sumber,
      };
      sessionCache.set(cacheKey, result);
      try { await set(IDB_PREFIX + cacheKey, result); } catch (e) {}
      return result;
    }
  }

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

  // 1. Try local or Vercel serverless /api/geocode endpoint
  try {
    const params = new URLSearchParams({ query: clean });

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
  onProgress?: (p: BatchProgress) => void
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
          const loc = await geocodeRealtime(query);
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
