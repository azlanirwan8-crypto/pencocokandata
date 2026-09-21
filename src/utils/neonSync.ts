import type { MasterRow, TargetRow, WilayahSetting } from '../types';

export interface NeonStatus {
  connected: boolean;
  provider?: string;
  serverTime?: string;
  message?: string;
  tables?: {
    masterRecords: number;
    targetRecords: number;
    kodeposRecords: number;
    finalRecords: number;
  };
}

/**
 * Fast fetch helper with timeout and exponential backoff retry to avoid network hiccups
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs = 4500,
  maxRetries = 2
): Promise<Response> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok || res.status < 500) {
        return res;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < maxRetries) {
      // Exponential backoff: 800ms, 1600ms
      await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

/**
 * Check if Vercel Neon serverless endpoint is available and connected
 */
export async function checkNeonStatus(): Promise<NeonStatus> {
  try {
    const res = await fetchWithRetry('/api/status', {}, 3500, 1);
    if (!res.ok) {
      return { connected: false, message: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return data;
  } catch {
    // Expected when running purely on localhost without Vercel dev server or timeout
    return { connected: false, message: 'Endpoint /api/status tidak dapat diakses (mode lokal offline).' };
  }
}

/**
 * Load Master Data from Neon DB via /api/master
 */
export async function loadMasterFromNeon(): Promise<{ rows: MasterRow[]; fileName: string } | null> {
  try {
    const res = await fetchWithRetry('/api/master', {}, 5000, 2);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok && json.data && Array.isArray(json.data.rows) && json.data.rows.length > 0) {
      return {
        rows: json.data.rows,
        fileName: json.data.fileName || 'Master_Neon_Vercel.xlsx',
      };
    }
    return null;
  } catch (err) {
    console.warn('Neon load error (fallbacking to local):', err);
    return null;
  }
}

/**
 * Save Master Data to Neon DB via /api/master
 */
export async function saveMasterToNeon(
  rows: MasterRow[],
  fileName: string,
  mode: 'replace' | 'append' = 'replace'
): Promise<boolean> {
  try {
    const res = await fetchWithRetry(
      '/api/master',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          rows,
          mode,
          updatedAt: new Date().toISOString(),
        }),
      },
      8000,
      2
    );
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.ok);
  } catch (err) {
    console.warn('Neon save error:', err);
    return false;
  }
}

/**
 * Clear Master Data from Neon DB via /api/master
 */
export async function clearMasterFromNeon(): Promise<boolean> {
  try {
    const res = await fetch('/api/master', {
      method: 'DELETE',
    });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.ok);
  } catch (err) {
    console.warn('Neon delete error:', err);
    return false;
  }
}

export interface SavedTargetPayload {
  rows: TargetRow[];
  fileName: string;
  initialCount: number;
  matchedDone: boolean;
}

/**
 * Load Target & Match Data from Neon DB via /api/target
 */
export async function loadTargetFromNeon(): Promise<SavedTargetPayload | null> {
  try {
    const res = await fetchWithRetry('/api/target', {}, 5000, 2);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok && json.data && Array.isArray(json.data.rows) && json.data.rows.length > 0) {
      return {
        rows: json.data.rows,
        fileName: json.data.fileName || 'Target_Neon_Vercel.xlsx',
        initialCount: json.data.initialCount || json.data.rows.length,
        matchedDone: Boolean(json.data.matchedDone),
      };
    }
    return null;
  } catch (err) {
    console.warn('Neon target load error:', err);
    return null;
  }
}

/**
 * Sanitize and preserve essential properties from TargetRows before transmitting to DB
 */
export function sanitizeTargetRowsForStorage(rows: TargetRow[]): TargetRow[] {
  return rows.map((r) => {
    const clean: Record<string, any> = {
      No: r.No,
      Wilayah: r.Wilayah,
      'Branch Code': r['Branch Code'] || '',
      'Kode Cabang': r['Kode Cabang'] || '',
      'Nama Outlet': r['Nama Outlet'] || '',
      'Status Outlet': r['Status Outlet'] || '',
      ALAMAT: r.ALAMAT || '',
      'KODE POS': r['KODE POS'] || '',
      Kelurahan: r.Kelurahan || '',
      Kecamatan: r.Kecamatan || '',
      'Dati II': r['Dati II'] || '',
      'Kode Dati II': r['Kode Dati II'] || '',
      Provinsi: r.Provinsi || '',
    };
    if (r['Sandi Cabang']) clean['Sandi Cabang'] = r['Sandi Cabang'];
    if (r.Sandi) clean.Sandi = r.Sandi;
    if (r.Cabang) clean.Cabang = r.Cabang;
    if (r['SUMBER DATA']) clean['SUMBER DATA'] = r['SUMBER DATA'];
    if (r._isMatched !== undefined) clean._isMatched = r._isMatched;
    if (r._matchLevel !== undefined) clean._matchLevel = r._matchLevel;
    if (r._matchedAt) clean._matchedAt = r._matchedAt;
    if (r._matchedBy) clean._matchedBy = r._matchedBy;
    if (r.organisasiRole) clean.organisasiRole = r.organisasiRole;
    if (r.tipeUnitRole) clean.tipeUnitRole = r.tipeUnitRole;
    if (r.alurWondr) clean.alurWondr = r.alurWondr;
    if (r.flowDescription) clean.flowDescription = r.flowDescription;
    if (r.roleCabsal !== undefined) clean.roleCabsal = r.roleCabsal;
    if (r.roleCabapv1 !== undefined) clean.roleCabapv1 = r.roleCabapv1;
    if (r.roleCabapv2 !== undefined) clean.roleCabapv2 = r.roleCabapv2;
    if (r.roleGrandTotal !== undefined) clean.roleGrandTotal = r.roleGrandTotal;
    if (r['KOTA PTEN']) clean['KOTA PTEN'] = r['KOTA PTEN'];
    if (r['KODE POS PTEN']) clean['KODE POS PTEN'] = r['KODE POS PTEN'];
    if (r['CEK KODE POS + PTEN']) clean['CEK KODE POS + PTEN'] = r['CEK KODE POS + PTEN'];
    if (r['CEK DUPLIKAT KODE POS']) clean['CEK DUPLIKAT KODE POS'] = r['CEK DUPLIKAT KODE POS'];
    return clean as TargetRow;
  });
}

/**
 * Save Target & Match Data to Neon DB via /api/target
 * Automatically chunks large datasets (>1500 rows) to stay safely within Vercel execution limits
 */
export async function saveTargetToNeon(
  payload: SavedTargetPayload,
  mode: 'replace' | 'append' = 'replace'
): Promise<boolean> {
  try {
    const sanitizedRows = sanitizeTargetRowsForStorage(payload.rows);
    const CHUNK_SIZE = 1500;

    if (sanitizedRows.length <= CHUNK_SIZE) {
      const res = await fetchWithRetry(
        '/api/target',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...payload,
            mode,
            rows: sanitizedRows,
            updatedAt: new Date().toISOString(),
          }),
        },
        10000,
        2
      );
      if (!res.ok) return false;
      const json = await res.json();
      return Boolean(json.ok);
    }

    // Large datasets: Send initial chunk with 'replace', then append remaining chunks
    let allSuccess = true;
    for (let i = 0; i < sanitizedRows.length; i += CHUNK_SIZE) {
      const chunk = sanitizedRows.slice(i, i + CHUNK_SIZE);
      const chunkMode = i === 0 ? mode : 'append';

      const res = await fetchWithRetry(
        '/api/target',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: payload.fileName,
            initialCount: payload.initialCount,
            matchedDone: payload.matchedDone,
            mode: chunkMode,
            rows: chunk,
            updatedAt: new Date().toISOString(),
          }),
        },
        12000,
        2
      );

      if (!res.ok) {
        allSuccess = false;
        break;
      }
      const json = await res.json();
      if (!json.ok) {
        allSuccess = false;
        break;
      }
    }

    return allSuccess;
  } catch (err) {
    console.warn('Neon target save error:', err);
    return false;
  }
}

/**
 * Clear Target & Match Data from Neon DB via /api/target
 */
export async function clearTargetFromNeon(): Promise<boolean> {
  try {
    const res = await fetch('/api/target', {
      method: 'DELETE',
    });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.ok);
  } catch (err) {
    console.warn('Neon target delete error:', err);
    return false;
  }
}

/**
 * ---------------------------------------------------------------------------
 * Data Final Analisa (tabel `final_rows`, dilayani /api/target?view=final)
 *
 * `analyst_final_data` di IndexedDB adalah satu-satunya salinan hasil Final selama
 * endpoint ini tidak dipakai: ganti perangkat atau bersihkan browser = hasil hilang.
 * Barisnya longgar (`any[]`) supaya modul ini tidak mengimpor dari analystPipeline
 * (analystPipeline sudah mengimpor tipe dari modul ini — siklus impor harus dihindari).
 * ---------------------------------------------------------------------------
 */

export interface FinalNeonPayload {
  rows: any[];
  total: number;
}

/** Baris per permintaan POST; ~40 kolom × 300 ≈ 350 KB, aman di bawah batas body Vercel. */
const FINAL_CHUNK_SIZE = 300;
const FINAL_PAGE_SIZE = 500;

/**
 * Muat SELURUH Data Final dari cloud (dipaging).
 * `null` = endpoint tidak tersedia/gagal; `{ rows: [] }` = cloud memang kosong.
 */
export async function loadFinalFromNeon(): Promise<FinalNeonPayload | null> {
  const all: any[] = [];
  try {
    let offset = 0;
    let total = 0;
    // 200 halaman = 100 ribu baris; pelindung kalau `total` tidak pernah konsisten.
    for (let page = 0; page < 200; page++) {
      const res = await fetchWithRetry(
        `/api/target?view=final&limit=${FINAL_PAGE_SIZE}&offset=${offset}`,
        {},
        10000,
        2
      );
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.ok || !json.data || !Array.isArray(json.data.rows)) return null;

      const pageRows: any[] = json.data.rows;
      all.push(...pageRows);
      total = Number(json.total ?? all.length);
      offset += pageRows.length;
      if (pageRows.length === 0 || all.length >= total) break;
    }
    return { rows: all, total };
  } catch (err) {
    console.warn('Neon final load error:', err);
    return null;
  }
}

/**
 * Dorong Data Final ke cloud. Default 'upsert': baris yang tidak ikut dikirim TIDAK
 * dihapus, jadi kegagalan di tengah chunk tidak pernah menyisakan cloud dalam keadaan kosong.
 * Panggil dengan mode 'replace' hanya untuk penanaman awal (seed) dari satu daftar lengkap.
 */
export async function saveFinalToNeon(
  rows: any[],
  mode: 'upsert' | 'replace' = 'upsert'
): Promise<boolean> {
  try {
    for (let i = 0; i < rows.length; i += FINAL_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + FINAL_CHUNK_SIZE);
      const chunkMode = i === 0 ? mode : 'upsert';

      const res = await fetchWithRetry(
        '/api/target?view=final',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk, mode: chunkMode }),
        },
        20000,
        2
      );
      if (!res.ok) return false;
      const json = await res.json().catch(() => null);
      if (!json?.ok) return false;
    }
    return true;
  } catch (err) {
    console.warn('Neon final save error:', err);
    return false;
  }
}

/** Hapus satu baris Data Final di cloud (aksi Revisi / Hapus per baris). */
export async function deleteFinalRowInNeon(rowKey: string): Promise<boolean> {
  try {
    const res = await fetchWithRetry(
      `/api/target?view=final&key=${encodeURIComponent(rowKey)}`,
      { method: 'DELETE' },
      8000,
      2
    );
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.ok);
  } catch (err) {
    console.warn('Neon final delete error:', err);
    return false;
  }
}

/** Kosongkan seluruh Data Final di cloud (aksi "Kembalikan ke Data Analyst"). */
export async function clearFinalInNeon(): Promise<boolean> {
  try {
    const res = await fetchWithRetry('/api/target?view=final&all=1', { method: 'DELETE' }, 15000, 2);
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.ok);
  } catch (err) {
    console.warn('Neon final clear error:', err);
    return false;
  }
}

/**
 * Load Wilayah Settings from Neon DB via /api/wilayah
 */
export async function loadWilayahFromNeon(): Promise<WilayahSetting[] | null> {
  try {
    const res = await fetchWithRetry('/api/wilayah', {}, 5000, 2);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok && json.data && Array.isArray(json.data)) {
      return json.data;
    }
    return null;
  } catch (err) {
    console.warn('Neon wilayah load error:', err);
    return null;
  }
}

/**
 * Save Wilayah Settings to Neon DB via /api/wilayah
 */
export async function saveWilayahToNeon(settings: WilayahSetting[]): Promise<boolean> {
  try {
    const res = await fetchWithRetry(
      '/api/wilayah',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      },
      6000,
      2
    );
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.ok);
  } catch (err) {
    console.warn('Neon wilayah save error:', err);
    return false;
  }
}

/**
 * Load Kode Pos Master Data from Neon DB via /api/kodepos
 */
export async function loadKodePosFromNeon(): Promise<any[] | null> {
  try {
    const res = await fetchWithRetry('/api/kodepos', {}, 8000, 2);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok && Array.isArray(json.data) && json.data.length > 0) {
      return json.data;
    }
    return null;
  } catch (err) {
    console.warn('Neon kodepos load error:', err);
    return null;
  }
}

/**
 * Save Kode Pos Master Data to Neon DB via /api/kodepos
 * Chunks besar otomatis dipecah 5000 rows per request
 */
export async function saveKodePosToNeon(
  rows: any[],
  mode: 'replace' | 'append' = 'replace'
): Promise<boolean> {
  try {
    // Chunk besar agar tidak timeout (ribuan data)
    const CHUNK_SIZE = 5000;
    let allSuccess = true;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const chunkMode = i === 0 ? mode : 'append';

      const res = await fetchWithRetry(
        '/api/kodepos',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk, mode: chunkMode }),
        },
        15000,
        2
      );

      if (!res.ok) { allSuccess = false; break; }
      const json = await res.json();
      if (!json.ok) { allSuccess = false; break; }
    }

    return allSuccess;
  } catch (err) {
    console.warn('Neon kodepos save error:', err);
    return false;
  }
}

/**
 * Clear Kode Pos Master Data from Neon DB via /api/kodepos?all=1
 */
export async function clearKodePosFromNeon(): Promise<boolean> {
  try {
    const res = await fetch('/api/kodepos?all=1', { method: 'DELETE' });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.ok);
  } catch (err) {
    console.warn('Neon kodepos delete error:', err);
    return false;
  }
}

export interface KodePosRow {
  id?: number | null;
  kodePos: string;
  kelurahan: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi: string;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  geoSumber?: string | null;
  geoPresisi?: string | null;
  geoTerverifikasi?: boolean;
}

export interface KodePosGeoStats {
  googleSiap: boolean;
  menunggu: number;
  /** Termasuk `menunggu`, ditambah yang pernah gagal dan sudah lewat jeda coba ulang. */
  menungguUlang: number;
  perluVerifikasi: number;
  geo: {
    tercatat: number;
    punya: number;
    gagal: number;
    google: number;
    esri: number;
    osm: number;
    perkiraan: number;
  };
}

export interface KodePosGeoRunResult {
  diproses: number;
  berhasil: number;
  gagal: number;
  googleTerhenti: boolean;
  menunggu: number;
  error?: string;
}

/** Ambil ringkasan titik koordinat kode pos dari Neon. */
export async function fetchKodePosGeoStats(): Promise<KodePosGeoStats | null> {
  try {
    const res = await fetchWithRetry('/api/kodepos-geo?view=stats', {}, 15000, 1);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.ok ? (json as KodePosGeoStats) : null;
  } catch (err) {
    console.warn('Neon kodepos geo stats error:', err);
    return null;
  }
}

/**
 * Satu tahap pengerjaan titik koordinat (server hanya bisa jalan 60 detik,
 * jadi pemanggil mengulang fungsi ini sampai `menunggu` habis).
 */
export async function runKodePosGeoBatch(opts: {
  mode?: 'isi' | 'verifikasi';
  jumlah?: number;
  provinsi?: string | null;
  apiKey?: string;
  /** Sekalian kode pos yang pernah dicari tapi tidak ketemu. */
  ulang?: boolean;
}): Promise<KodePosGeoRunResult | null> {
  try {
    const res = await fetch('/api/kodepos-geo?view=run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: opts.mode || 'isi',
        jumlah: opts.jumlah || 40,
        provinsi: opts.provinsi || undefined,
        apiKey: opts.apiKey || undefined,
        ulang: opts.ulang || undefined,
      }),
    });
    const json = await res.json().catch(() => null);
    if (json?.ok) return json as KodePosGeoRunResult;
    if (json?.error) {
      return { diproses: 0, berhasil: 0, gagal: 0, googleTerhenti: false, menunggu: 0, error: String(json.error) };
    }
    return null;
  } catch (err) {
    console.warn('Neon kodepos geo run error:', err);
    return null;
  }
}

/** URL Google Maps untuk satu titik tersimpan. */
export function mapsUrlFor(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

/** Keterangan sumber & mutu satu titik koordinat kode pos (dipakai tabel Kode Pos & tab Sync). */
export function geoLabel(row: KodePosRow): string {
  if (row.latitude == null || row.longitude == null) {
    return row.geoSumber === 'TIDAK DITEMUKAN'
      ? 'Sudah dicari di Google / ESRI / OpenStreetMap, tidak ditemukan'
      : 'Titik belum dicari — pakai aksi di kartu Titik Koordinat';
  }
  const sumber = row.geoTerverifikasi
    ? 'Google Geocoding API (terverifikasi)'
    : row.geoSumber === 'esri'
      ? 'ESRI World Geocoder (belum diverifikasi Google)'
      : row.geoSumber === 'osm'
        ? 'OpenStreetMap (belum diverifikasi Google)'
        : row.geoSumber === 'kodepos.co.id'
          ? 'titik desa kodepos.co.id (sumber data, belum dicek Google)'
          : row.geoSumber === 'manual'
            ? 'diisi manual dari aplikasi'
            : row.geoSumber || 'penyedia peta';
  return `Sumber: ${sumber}${row.geoPresisi ? ` · Presisi: ${row.geoPresisi}` : ''}`;
}

export interface KodePosPageQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  provinsi?: string;
  kota?: string;
  status?: string;
  sort?: KodePosSortKolom;
  dir?: 'asc' | 'desc';
}

/** Kolom tabel Kode Pos yang bisa diurutkan di server (sama dengan whitelist API). */
export type KodePosSortKolom =
  | 'kodePos'
  | 'kelurahan'
  | 'kecamatan'
  | 'kabupatenKota'
  | 'provinsi'
  | 'latitude'
  | 'longitude';

function kodePosQuery(q: KodePosPageQuery): string {
  const p = new URLSearchParams();
  if (q.page) p.set('page', String(q.page));
  if (q.pageSize) p.set('pageSize', String(q.pageSize));
  if (q.search) p.set('search', q.search);
  if (q.provinsi && q.provinsi !== 'ALL') p.set('provinsi', q.provinsi);
  if (q.kota && q.kota !== 'ALL') p.set('kota', q.kota);
  if (q.status && q.status !== 'ALL') p.set('status', q.status);
  if (q.sort) {
    p.set('sort', q.sort);
    p.set('dir', q.dir === 'desc' ? 'desc' : 'asc');
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export interface KodePosPageResult {
  data: KodePosRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Ambil SATU halaman data kode pos dari Neon (server-side pagination + filter)
 */
export async function fetchKodePosPage(q: KodePosPageQuery): Promise<KodePosPageResult | null> {
  try {
    const res = await fetchWithRetry(`/api/kodepos${kodePosQuery(q)}`, {}, 8000, 2);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok && Array.isArray(json.data)) {
      return {
        data: json.data,
        total: json.total ?? json.data.length,
        page: json.page ?? 1,
        pageSize: json.pageSize ?? 25,
        totalPages: json.totalPages ?? 1,
      };
    }
    return null;
  } catch (err) {
    console.warn('Neon kodepos page error:', err);
    return null;
  }
}

export interface KodePosStats {
  total: number;
  totalProvinsi: number;
  totalKota: number;
  totalKecamatan: number;
  totalKelurahan: number;
  totalAktif: number;
  /** Baris yang punya titiknya sendiri (kodepos_data.latitude terisi). */
  totalBerTitik: number;
}

/**
 * Ambil statistik agregat global untuk KPI cards
 */
export async function fetchKodePosStats(): Promise<KodePosStats | null> {
  try {
    const res = await fetchWithRetry('/api/kodepos?view=stats', {}, 8000, 2);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok && json.stats) return json.stats as KodePosStats;
    return null;
  } catch (err) {
    console.warn('Neon kodepos stats error:', err);
    return null;
  }
}

/**
 * Ambil opsi dropdown provinsi + kota/kab (kota bisa difilter provinsi)
 */
export async function fetchKodePosOptions(provinsi?: string): Promise<{ provinsi: string[]; kota: string[] } | null> {
  try {
    const qs = provinsi && provinsi !== 'ALL' ? `?view=options&provinsi=${encodeURIComponent(provinsi)}` : '?view=options';
    const res = await fetchWithRetry(`/api/kodepos${qs}`, {}, 8000, 2);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok) return { provinsi: json.provinsi || [], kota: json.kota || [] };
    return null;
  } catch (err) {
    console.warn('Neon kodepos options error:', err);
    return null;
  }
}

/**
 * Ambil semua baris yang cocok filter (untuk Ekspor Excel)
 */
export async function fetchKodePosExport(q: KodePosPageQuery): Promise<KodePosRow[] | null> {
  try {
    const res = await fetchWithRetry(`/api/kodepos?view=export${kodePosQuery(q).replace('?', '&')}`, {}, 60000, 1);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok && Array.isArray(json.data)) return json.data as KodePosRow[];
    return null;
  } catch (err) {
    console.warn('Neon kodepos export error:', err);
    return null;
  }
}

/**
 * Update satu baris kode pos berdasarkan id
 */
export async function updateKodePosRow(id: number, row: KodePosRow): Promise<boolean> {
  try {
    const res = await fetchWithRetry(
      `/api/kodepos?id=${id}`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ row }) },
      8000,
      2
    );
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.ok);
  } catch (err) {
    console.warn('Neon kodepos update error:', err);
    return false;
  }
}

/**
 * Hapus satu baris kode pos berdasarkan id
 */
export async function deleteKodePosRow(id: number): Promise<boolean> {
  try {
    const res = await fetchWithRetry(`/api/kodepos?id=${id}`, { method: 'DELETE' }, 8000, 2);
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.ok);
  } catch (err) {
    console.warn('Neon kodepos delete-row error:', err);
    return false;
  }
}

/**
 * Generic Neon app_store sync for an arbitrary key (used by PTEN & RoleMapping masters).
 */
async function loadKeyFromNeon<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetchWithRetry(endpoint, { method: 'GET' });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.ok && json.configured && json.data) {
      return json.data as T;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveKeyToNeon(endpoint: string, data: unknown): Promise<boolean> {
  try {
    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json && json.ok);
  } catch {
    return false;
  }
}

export function loadPtenFromNeon(): Promise<any[] | null> {
  return loadKeyFromNeon<any[]>('/api/pten');
}
export function savePtenToNeon(rows: any[]): Promise<boolean> {
  return saveKeyToNeon('/api/pten', rows);
}
export function loadRoleMappingFromNeon(): Promise<any[] | null> {
  return loadKeyFromNeon<any[]>('/api/rolemapping');
}
export function saveRoleMappingToNeon(rows: any[]): Promise<boolean> {
  return saveKeyToNeon('/api/rolemapping', rows);
}
