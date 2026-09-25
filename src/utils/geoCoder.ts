// Clean, Lightweight Geocoding & Geographic Utilities for Indonesia
// Dynamic coordinates are resolved via Google Maps & Realtime Online Geocoder (onlineGeoCoder.ts).
// No massive hardcoded coordinate dictionaries in source code.

import type { MasterRow, TargetRow } from '../types';
import { formatWilayahName, kapital } from './normalizer.ts';
import { getUnitCategory } from './roleHelpers';
import { kodePosLima } from './geoTitik';

export interface GeoLocation {
  lat: number;
  lng: number;
  city?: string;
  province?: string;
  source: 'google' | 'esri' | 'osm' | 'row_data' | 'kodepos_data' | 'wilayah_centroid' | 'default';
  formattedAddress?: string;
}

/** Titik satu kode pos dari Data Kode Pos (rata-rata koordinat desa per kode pos). */
export type TitikKodePos = Record<string, { lat: number; lng: number; sumber?: string }>;

/** Sumber koordinat yang bukan kantor sungguhan: pusat wilayah / titik aman Jakarta. */
export function sumberPerkiraan(source: GeoLocation['source']): boolean {
  return source === 'wilayah_centroid' || source === 'default';
}

export interface PlottedBranchPin {
  id: string;
  lat: number;
  lng: number;
  kodePos: string;
  dati2: string;
  wilayah: string;
  branches: MasterRow[];
  branchCount: number;
  primaryOutletName: string;
  alamatDisplay: string;
  matchedCount: number;
  totalTargetCount: number;
  isOnlineVerified?: boolean;
  onlineSource?: 'google' | 'esri' | 'osm';
  /** Dari mana koordinat pin ini datang — 'kodepos_data' = koordinat Data Kode Pos. */
  sumberTitik?: GeoLocation['source'];
  /** Titiknya pusat wilayah, bukan kantor. Jangan diklaim sebagai lokasi nyata. */
  perkiraan?: boolean;
  /** Klasifikasi dari kolom Status Outlet Data Cabang. */
  unitKat?: 'KC' | 'KCP';
  /** Titik kode pos dari Data Kode Pos (lapisan nasional), bukan kantor. */
  isTitikKodePos?: boolean;
  // Layer Final Data: status penempatan baris analisa (bukan cabang master)
  finalStatus?: 'OK' | 'REVIEW' | 'ANOMALI';
  finalCount?: number;
}

// 1. Regional Island Centroids (for rapid map zooming and camera bounds)
export const INDONESIA_REGIONS = {
  ALL: { name: 'Seluruh Indonesia', center: [-1.2000, 117.0000] as [number, number], zoom: 5 },
  SUMATERA: { name: 'Sumatera & Aceh', center: [3.2000, 97.5000] as [number, number], zoom: 6 },
  JAWA: { name: 'Jawa & Banten', center: [-7.2504, 110.1500] as [number, number], zoom: 7 },
  BALI_NUSA: { name: 'Bali & Nusa Tenggara', center: [-8.6500, 118.5000] as [number, number], zoom: 7 },
  KALIMANTAN: { name: 'Kalimantan', center: [-1.2000, 114.0000] as [number, number], zoom: 6 },
  SULAWESI: { name: 'Sulawesi', center: [-2.5000, 121.5000] as [number, number], zoom: 6 },
  MALUKU_PAPUA: { name: 'Maluku & Papua', center: [-3.8000, 136.0000] as [number, number], zoom: 5 },
};

// 2. Compact BNI Wilayah Centroids (Lightweight fallback while online geocoding is streaming)
export const WILAYAH_CENTROIDS: Record<string, { lat: number; lng: number; name: string }> = {
  '01': { lat: 3.5952, lng: 98.6722, name: 'Wilayah 01 - Medan' },
  '02': { lat: -0.9478, lng: 100.3685, name: 'Wilayah 02 - Padang' },
  '03': { lat: -2.9761, lng: 104.7754, name: 'Wilayah 03 - Palembang' },
  '04': { lat: -6.9175, lng: 107.6191, name: 'Wilayah 04 - Bandung' },
  '05': { lat: -6.9667, lng: 110.4167, name: 'Wilayah 05 - Semarang' },
  '06': { lat: -7.2575, lng: 112.7521, name: 'Wilayah 06 - Surabaya' },
  '07': { lat: -5.1477, lng: 119.4327, name: 'Wilayah 07 - Makassar' },
  '08': { lat: -8.6500, lng: 115.2167, name: 'Wilayah 08 - Denpasar' },
  '09': { lat: -3.3167, lng: 114.5900, name: 'Wilayah 09 - Banjarmasin' },
  '10': { lat: -6.1818, lng: 106.8340, name: 'Wilayah 10 - Jakarta Senayan' },
  '11': { lat: 1.4748, lng: 124.8428, name: 'Wilayah 11 - Manado' },
  '12': { lat: -6.1683, lng: 106.7588, name: 'Wilayah 12 - Jakarta Kota' },
  '13': { lat: -6.2383, lng: 106.9756, name: 'Wilayah 13 - Tangerang / BSD' },
  '14': { lat: -6.2250, lng: 106.9004, name: 'Wilayah 14 - Jakarta Harmoni' },
  '15': { lat: -6.2615, lng: 106.8106, name: 'Wilayah 15 - Jakarta BSD' },
  '16': { lat: -2.5337, lng: 140.7181, name: 'Wilayah 16 - Papua (Jayapura)' },
  '17': { lat: -7.7956, lng: 110.3695, name: 'Wilayah 17 - Yogyakarta' },
  '18': { lat: -7.9797, lng: 112.6304, name: 'Wilayah 18 - Malang' },
};

export function extractWCode(wilayahStr: string): string {
  const match = String(wilayahStr || '').match(/\b(0?[1-9]|1[0-8])\b/);
  if (match) return match[1].padStart(2, '0');
  const wCodeMatch = String(wilayahStr || '').match(/W(\d{1,2})/i);
  if (wCodeMatch) return wCodeMatch[1].padStart(2, '0');
  return '';
}

export function cleanDati2(dati2: string): string {
  return String(dati2 || '')
    .toUpperCase()
    .replace(/^(KAB\.|KABUPATEN|KOTA|ADM\.)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Foreign Land Polygon Masks: Prevents arcs or points from dipping into neighboring countries
 */
export interface ForeignLandMask {
  name: string;
  coords: [number, number][];
}

export const FOREIGN_LAND_MASKS: ForeignLandMask[] = [
  {
    name: 'Malaysia Barat & Singapura',
    coords: [
      [1.24, 103.4],
      [1.32, 103.62],
      [1.48, 104.05],
      [1.75, 104.35],
      [6.8, 102.3],
      [7.2, 100.2],
      [6.5, 99.5],
      [3.0, 101.0],
      [1.5, 102.9],
      [1.24, 103.4],
    ],
  },
  {
    name: 'Malaysia Timur & Brunei',
    coords: [
      [2.08, 109.64],
      [1.75, 110.35],
      [1.2, 110.8],
      [0.9, 111.7],
      [1.3, 112.5],
      [1.8, 113.8],
      [2.5, 115.0],
      [4.18, 115.6],
      [4.18, 117.65],
      [4.6, 118.5],
      [5.5, 119.0],
      [7.4, 117.3],
      [6.0, 115.5],
      [4.9, 114.8],
      [4.5, 114.0],
      [3.2, 113.0],
      [2.08, 109.64],
    ],
  },
  {
    name: 'Papua New Guinea',
    coords: [
      [-2.5, 141.02],
      [-2.5, 155.0],
      [-12.0, 155.0],
      [-12.0, 141.02],
      [-9.15, 141.02],
      [-6.9, 141.25],
      [-6.0, 141.02],
      [-2.5, 141.02],
    ],
  },
  {
    name: 'Timor-Leste',
    coords: [
      [-8.3, 125.05],
      [-8.3, 127.4],
      [-9.35, 127.4],
      [-9.35, 125.05],
      [-8.3, 125.05],
    ],
  },
];

function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0];
    const xi = ring[i][1];
    const yj = ring[j][0];
    const xj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isForeignLand(lat: number, lng: number): boolean {
  return FOREIGN_LAND_MASKS.some((mask) => pointInRing(lat, lng, mask.coords));
}

export function clampToIndonesia(lat: number, lng: number): [number, number] {
  let cLat = Math.min(6.15, Math.max(-11.0, lat));
  let cLng = Math.min(141.0, Math.max(94.9, lng));

  if (isForeignLand(cLat, cLng)) {
    const idLat = -2.5;
    const idLng = 118.0;
    for (let step = 0; step < 8 && isForeignLand(cLat, cLng); step++) {
      cLat += (idLat - cLat) * 0.35;
      cLng += (idLng - cLng) * 0.35;
    }
  }

  return [Number(cLat.toFixed(6)), Number(cLng.toFixed(6))];
}

/**
 * True if the TARGET's own administrative fields are in Aceh.
 */
export function isAcehTargetRow(row: TargetRow | MasterRow | Record<string, unknown>): boolean {
  const kp = String(row['KODE POS'] || '').replace(/\D/g, '');
  const prov = String(row.Provinsi || '').toLowerCase();
  const dati = String(row['Dati II'] || '').toLowerCase();
  const kec = String(row.Kecamatan || '').toLowerCase();
  const kel = String(row.Kelurahan || '').toLowerCase();

  if (kp.startsWith('23') || kp.startsWith('24')) return true;
  if (prov.includes('aceh') || prov.includes('nad') || prov.includes('nanggroe')) return true;
  if (dati.includes('aceh') || kec.includes('aceh') || kel.includes('aceh')) return true;
  return false;
}

/**
 * KC atau KCP — dari kolom `Status Outlet` Data Cabang (terukur lengkap di 1.776 baris:
 * 'KC', 'KCP', 'KCP d/h KK'). `tipeUnit` hasil analisa TIDAK dipakai: kolom itu berisi
 * organisasi tujuan (induk), sehingga terbaca 'KC' untuk semua baris.
 */
export function kategoriUnitCabang(row: MasterRow): 'KC' | 'KCP' {
  const status = String(row['Status Outlet'] || '').toUpperCase();
  if (status) return status.includes('KCP') || status.includes('PEMBANTU') || /\bKK\b/.test(status) ? 'KCP' : 'KC';
  return getUnitCategory(String(row['Nama Outlet'] || ''));
}

/**
 * Resolves coordinates for a MasterRow:
 * 1. Checks if row already has explicit Latitude & Longitude columns
 * 2. Titik kode pos cabang itu di Data Kode Pos — koordinat milik operator sendiri
 * 3. Checks dynamic real-time online cache map
 * 4. Fallback to BNI Wilayah centroid
 */
export function resolveBranchCoordinates(
  row: MasterRow,
  resolvedMap?: Map<string, { lat: number; lng: number; source?: string; formattedAddress?: string }>,
  titikKodePos?: TitikKodePos
): GeoLocation {
  // 1. Direct explicit coordinates in row data
  const explicitLat = Number(row.Latitude ?? row.lat ?? row.LATITUDE);
  const explicitLng = Number(row.Longitude ?? row.lng ?? row.LONGITUDE);
  if (!isNaN(explicitLat) && !isNaN(explicitLng) && explicitLat !== 0 && explicitLng !== 0) {
    const [cLat, cLng] = clampToIndonesia(explicitLat, explicitLng);
    return {
      lat: cLat,
      lng: cLng,
      city: row['Dati II'] || row.Kecamatan,
      province: row.Provinsi,
      source: 'row_data',
    };
  }

  // 2. Titik kode pos cabang ini di Data Kode Pos. Data Cabang sendiri tidak punya
  //    kolom koordinat (terukur 0 dari 500 baris), jadi ini satu-satunya koordinat
  //    nyata yang bersumber dari berkas operator — bukan tebakan geocoder.
  if (titikKodePos) {
    const kode = kodePosLima(row['KODE POS']);
    const titik = kode ? titikKodePos[kode] : undefined;
    if (titik && Number.isFinite(titik.lat) && Number.isFinite(titik.lng)) {
      const [cLat, cLng] = clampToIndonesia(titik.lat, titik.lng);
      return {
        lat: cLat,
        lng: cLng,
        city: row['Dati II'] || row.Kecamatan,
        province: row.Provinsi,
        source: 'kodepos_data',
        formattedAddress: `Titik kode pos ${kode} (Data Kode Pos)`,
      };
    }
  }

  // 3. Realtime Online resolved coordinates
  if (resolvedMap) {
    const keys = [
      [row['Nama Outlet'], row.ALAMAT, row.Kecamatan, row['Dati II'], row.Provinsi].filter(Boolean).join(', ').trim(),
      [row['Nama Outlet'], row['Dati II']].filter(Boolean).join(', ').trim(),
      row['Nama Outlet'],
      row.ALAMAT,
    ];

    for (const key of keys) {
      const found = key ? (resolvedMap.get(key) || resolvedMap.get(key.toLowerCase())) : undefined;
      if (found) {
        const [cLat, cLng] = clampToIndonesia(found.lat, found.lng);
        return {
          lat: cLat,
          lng: cLng,
          city: row['Dati II'] || row.Kecamatan,
          province: row.Provinsi,
          source: (found.source as any) || 'google',
          formattedAddress: found.formattedAddress,
        };
      }
    }
  }

  // 4. Fallback: Wilayah Centroid (Temporary placeholder while geocoding is ongoing)
  const wCode = extractWCode(String(row.Wilayah || ''));
  if (wCode && WILAYAH_CENTROIDS[wCode]) {
    const wc = WILAYAH_CENTROIDS[wCode];
    const [cLat, cLng] = clampToIndonesia(wc.lat, wc.lng);
    return {
      lat: cLat,
      lng: cLng,
      city: wc.name,
      source: 'wilayah_centroid',
    };
  }

  // Safe default: Jakarta Pusat
  const [cLat, cLng] = clampToIndonesia(-6.1818, 106.834);
  return {
    lat: cLat,
    lng: cLng,
    city: 'Jakarta Pusat',
    province: 'DKI Jakarta',
    source: 'default',
  };
}

/**
 * Resolves origin coordinates for a Target row (where transaction/account originates)
 */
export function resolveTargetOriginCoordinates(
  row: TargetRow,
  resolvedMap?: Map<string, { lat: number; lng: number; source?: string; formattedAddress?: string }>,
  titikKodePos?: TitikKodePos
): GeoLocation {
  // 1. Explicit coords
  const explicitLat = Number(row.Latitude ?? row.lat ?? row.LATITUDE);
  const explicitLng = Number(row.Longitude ?? row.lng ?? row.LONGITUDE);
  if (!isNaN(explicitLat) && !isNaN(explicitLng) && explicitLat !== 0 && explicitLng !== 0) {
    const [cLat, cLng] = clampToIndonesia(explicitLat, explicitLng);
    return {
      lat: cLat,
      lng: cLng,
      city: row['Dati II'] || row.Kecamatan,
      province: row.Provinsi,
      source: 'row_data',
    };
  }

  // 2. Titik kode pos baris ini di Data Kode Pos — koordinat dari berkas operator
  //    sendiri, bukan tebakan geocoder. Data Target juga tidak punya kolom koordinat.
  if (titikKodePos) {
    const kode = kodePosLima(row['KODE POS']);
    const titik = kode ? titikKodePos[kode] : undefined;
    if (titik && Number.isFinite(titik.lat) && Number.isFinite(titik.lng)) {
      const [cLat, cLng] = clampToIndonesia(titik.lat, titik.lng);
      return {
        lat: cLat,
        lng: cLng,
        city: row['Dati II'] || row.Kecamatan,
        province: row.Provinsi,
        source: 'kodepos_data',
        formattedAddress: `Titik kode pos ${kode} (Data Kode Pos)`,
      };
    }
  }

  // 3. Realtime Online resolved coords
  if (resolvedMap) {
    const keys = [
      [row.Kelurahan, row.Kecamatan, row['Dati II'], row.Provinsi, row['KODE POS']].filter(Boolean).join(', ').trim(),
      [row.Kecamatan, row['Dati II'], row.Provinsi].filter(Boolean).join(', ').trim(),
      [row['Dati II'], row.Provinsi].filter(Boolean).join(', ').trim(),
    ];

    for (const key of keys) {
      const found = key ? (resolvedMap.get(key) || resolvedMap.get(key.toLowerCase())) : undefined;
      if (found) {
        const [cLat, cLng] = clampToIndonesia(found.lat, found.lng);
        return {
          lat: cLat,
          lng: cLng,
          city: row['Dati II'] || row.Kecamatan,
          province: row.Provinsi,
          source: (found.source as any) || 'google',
          formattedAddress: found.formattedAddress,
        };
      }
    }
  }

  // 4. Aceh detection
  if (isAcehTargetRow(row)) {
    const [cLat, cLng] = clampToIndonesia(5.553, 95.322);
    return { lat: cLat, lng: cLng, city: 'Banda Aceh', province: 'Aceh', source: 'default' };
  }

  // 5. Wilayah Centroid fallback
  const wCode = extractWCode(String(row.Wilayah || ''));
  if (wCode && WILAYAH_CENTROIDS[wCode]) {
    const wc = WILAYAH_CENTROIDS[wCode];
    const [cLat, cLng] = clampToIndonesia(wc.lat, wc.lng);
    return { lat: cLat, lng: cLng, city: wc.name, source: 'wilayah_centroid' };
  }

  const [cLat, cLng] = clampToIndonesia(-6.1818, 106.834);
  return { lat: cLat, lng: cLng, city: 'Jakarta Pusat', province: 'DKI Jakarta', source: 'default' };
}

export function resolveTargetRowCoordinates(
  row: TargetRow,
  resolvedMap?: Map<string, { lat: number; lng: number; source?: string }>
): GeoLocation {
  return resolveTargetOriginCoordinates(row, resolvedMap);
}

/**
 * Cluster master rows for Leaflet branch markers
 */
export function clusterMasterRowsForMap(
  masterRows: MasterRow[],
  selectedWilayah: string = 'ALL',
  targetRows: TargetRow[] = [],
  resolvedMap?: Map<string, { lat: number; lng: number; source?: string; formattedAddress?: string }>,
  titikKodePos?: TitikKodePos
): PlottedBranchPin[] {
  const sandiMatchMap = new Map<string, { matched: number; total: number }>();
  const kpMatchMap = new Map<string, { matched: number; total: number }>();

  if (targetRows && targetRows.length > 0) {
    for (const t of targetRows) {
      const isMatched = !!t._isMatched;
      const s = String(t['Sandi Cabang'] || t.Sandi || t.Cabang || '').trim();
      const kp = String(t['KODE POS'] || '').replace(/\D/g, '').trim();

      if (s) {
        const cur = sandiMatchMap.get(s) || { matched: 0, total: 0 };
        cur.total++;
        if (isMatched) cur.matched++;
        sandiMatchMap.set(s, cur);
      }

      if (kp && kp.length >= 5) {
        const cur = kpMatchMap.get(kp) || { matched: 0, total: 0 };
        cur.total++;
        if (isMatched) cur.matched++;
        kpMatchMap.set(kp, cur);
      }
    }
  }

  const filtered = selectedWilayah === 'ALL'
    ? masterRows
    : masterRows.filter((r) => {
        const rowCode = extractWCode(r.Wilayah || '');
        const selCode = extractWCode(selectedWilayah || '');
        if (rowCode && selCode && rowCode === selCode) return true;

        const rowNorm = formatWilayahName(r.Wilayah || '').toUpperCase();
        const selNorm = formatWilayahName(selectedWilayah || '').toUpperCase();
        if (rowNorm && selNorm && rowNorm === selNorm) return true;

        const rowW = String(r.Wilayah || '').trim().toUpperCase();
        const selW = String(selectedWilayah || '').trim().toUpperCase();
        return rowW === selW || rowW.startsWith(selW) || selW.startsWith(rowW);
      });

  const groups = new Map<string, MasterRow[]>();

  for (const row of filtered) {
    const kp = String(row['KODE POS'] || '').replace(/\D/g, '').trim();
    const d2 = cleanDati2(row['Dati II'] || '');
    const w = String(row.Wilayah || '').trim();
    const name = String(row['Nama Outlet'] || '').trim();

    // Group key: Outlet name + Dati II (or postal code) to keep individual branches distinct
    const groupKey = `${name}_${d2 || kp || w}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(row);
  }

  const pins: PlottedBranchPin[] = [];

  groups.forEach((branches, key) => {
    if (branches.length === 0) return;
    const first = branches[0];
    const coords = resolveBranchCoordinates(first, resolvedMap, titikKodePos);
    const kp = String(first['KODE POS'] || '').replace(/\D/g, '').trim();

    let matchedCount = 0;
    let totalTargetCount = 0;

    for (const b of branches) {
      const s = String(b['Sandi Cabang'] || b.Sandi || b['Kode Cabang'] || '').trim();
      if (s && sandiMatchMap.has(s)) {
        const st = sandiMatchMap.get(s)!;
        matchedCount += st.matched;
        totalTargetCount += st.total;
      }
    }

    if (matchedCount === 0 && kp && kpMatchMap.has(kp)) {
      const kt = kpMatchMap.get(kp)!;
      matchedCount += kt.matched;
      totalTargetCount += kt.total;
    }

    const isOnline = coords.source === 'google' || coords.source === 'esri' || coords.source === 'osm';

    pins.push({
      id: `pin_${key}_${first['Sandi Cabang'] || first.Sandi || first['Kode Cabang'] || Math.random().toString(36).slice(2, 7)}`,
      lat: coords.lat,
      lng: coords.lng,
      kodePos: String(first['KODE POS'] || '-'),
      dati2: kapital(first['Dati II'] || coords.city) || '-',
      wilayah: String(first.Wilayah || '-'),
      branches,
      branchCount: branches.length,
      primaryOutletName: first['Nama Outlet'] || 'Outlet BNI',
      alamatDisplay: coords.formattedAddress || first.ALAMAT || `${kapital(first.Kecamatan)}, ${kapital(first['Dati II'])}`,
      matchedCount,
      totalTargetCount,
      isOnlineVerified: isOnline,
      onlineSource: isOnline ? (coords.source as any) : undefined,
      sumberTitik: coords.source,
      perkiraan: sumberPerkiraan(coords.source),
      unitKat: kategoriUnitCabang(first),
    });
  });

  return pins;
}

export interface TargetOriginGroup {
  lat: number;
  lng: number;
  label: string;
  rows: TargetRow[];
  source: GeoLocation['source'];
}

export function groupTargetOriginsForMap(
  rows: TargetRow[],
  resolvedMap?: Map<string, { lat: number; lng: number; source?: string; formattedAddress?: string }>
): TargetOriginGroup[] {
  const groups = new Map<string, TargetOriginGroup>();

  for (const row of rows) {
    const origin = resolveTargetOriginCoordinates(row, resolvedMap);
    const [lat, lng] = clampToIndonesia(origin.lat, origin.lng);
    const dati = kapital(String(row['Dati II'] || origin.city || '').trim());
    const kec = kapital(String(row.Kecamatan || '').trim());
    const kp3 = String(row['KODE POS'] || '').replace(/\D/g, '').slice(0, 3);
    const key = `${dati.toUpperCase()}|${kec.toUpperCase()}|${kp3}|${lat.toFixed(3)}|${lng.toFixed(3)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        lat,
        lng,
        label: [kec, dati].filter(Boolean).join(', ') || origin.city || 'Titik Asal',
        rows: [],
        source: origin.source,
      });
    }
    groups.get(key)!.rows.push(row);
  }

  return Array.from(groups.values()).sort((a, b) => b.rows.length - a.rows.length);
}

export function getAllMatchedCoordinates(
  rows: TargetRow[],
  resolvedMap?: Map<string, { lat: number; lng: number; source?: string }>
): [number, number][] {
  return rows
    .filter((r) => r._isMatched)
    .map((r) => {
      const loc = resolveTargetOriginCoordinates(r, resolvedMap);
      return clampToIndonesia(loc.lat, loc.lng);
    });
}

/**
 * Computes sampled points along a quadratic Bezier curve to render
 * smooth trajectories between source data and matched destination branch.
 */
export function createCurvedArcPoints(
  start: [number, number],
  end: [number, number],
  curveOffset: number = 0.15,
  numPoints: number = 24
): [number, number][] {
  const [lat1, lng1] = clampToIndonesia(start[0], start[1]);
  const [lat2, lng2] = clampToIndonesia(end[0], end[1]);

  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);

  if (dist < 0.0005) {
    return [];
  }

  const capped = Math.min(Math.abs(curveOffset), dist > 2 ? 0.08 : 0.15);
  const signedOffset = curveOffset < 0 ? -capped : capped;
  const arcHeight = Math.min(Math.max(dist * Math.abs(signedOffset), 0.004), 0.32);

  const normLat = -dLng / dist;
  const normLng = dLat / dist;

  let controlLat = midLat + normLat * arcHeight * Math.sign(signedOffset || 1);
  let controlLng = midLng + normLng * arcHeight * Math.sign(signedOffset || 1);

  const [clampedLat, clampedLng] = clampToIndonesia(controlLat, controlLng);
  if (clampedLat !== controlLat || clampedLng !== controlLng || isForeignLand(controlLat, controlLng)) {
    controlLng = midLng - normLng * arcHeight * Math.sign(signedOffset || 1);
    controlLat = midLat - normLat * arcHeight * Math.sign(signedOffset || 1);
  }
  [controlLat, controlLng] = clampToIndonesia(controlLat, controlLng);

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const oneMinusT = 1 - t;
    const lat = oneMinusT * oneMinusT * lat1 + 2 * oneMinusT * t * controlLat + t * t * lat2;
    const lng = oneMinusT * oneMinusT * lng1 + 2 * oneMinusT * t * controlLng + t * t * lng2;
    points.push(clampToIndonesia(lat, lng));
  }

  return points;
}
