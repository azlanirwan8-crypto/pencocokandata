import type { MasterRow } from '../types';

export interface NeonStatus {
  connected: boolean;
  provider?: string;
  serverTime?: string;
  message?: string;
}

/**
 * Check if Vercel Neon serverless endpoint is available and connected
 */
export async function checkNeonStatus(): Promise<NeonStatus> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) {
      return { connected: false, message: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return data;
  } catch {
    // Expected when running purely on localhost without Vercel dev server
    return { connected: false, message: 'Endpoint /api/status tidak dapat diakses (mode lokal offline).' };
  }
}

/**
 * Load Master Data from Neon DB via /api/master
 */
export async function loadMasterFromNeon(): Promise<{ rows: MasterRow[]; fileName: string } | null> {
  try {
    const res = await fetch('/api/master');
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
