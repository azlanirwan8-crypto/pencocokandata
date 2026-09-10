import type { MasterRow, TargetRow } from '../types';

export interface NeonStatus {
  connected: boolean;
  provider?: string;
  serverTime?: string;
  message?: string;
}

/**
 * Fast fetch helper with timeout to avoid network hanging
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Check if Vercel Neon serverless endpoint is available and connected
 */
export async function checkNeonStatus(): Promise<NeonStatus> {
  try {
    const res = await fetchWithTimeout('/api/status', {}, 3500);
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
    const res = await fetchWithTimeout('/api/master', {}, 5000);
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
export async function saveMasterToNeon(rows: MasterRow[], fileName: string): Promise<boolean> {
  try {
    const res = await fetch('/api/master', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        rows,
        updatedAt: new Date().toISOString(),
      }),
    });
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
    const res = await fetchWithTimeout('/api/target', {}, 5000);
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
 * Sanitize and strip non-essential properties from TargetRows before transmitting to DB
 * Reduces payload size by ~60% to stay safely within Vercel body limits
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
    return clean as TargetRow;
  });
}

/**
 * Save Target & Match Data to Neon DB via /api/target
 */
export async function saveTargetToNeon(payload: SavedTargetPayload): Promise<boolean> {
  try {
    const res = await fetch('/api/target', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        rows: sanitizeTargetRowsForStorage(payload.rows),
        updatedAt: new Date().toISOString(),
      }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.ok);
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

