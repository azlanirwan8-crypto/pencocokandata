import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { MasterRow } from '../types';

const STORAGE_KEY_URL = 'tools_matcher_supabase_url';
const STORAGE_KEY_ANON = 'tools_matcher_supabase_anon';

// Default from environment variables (e.g. set in Vercel or .env)
const ENV_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let clientInstance: SupabaseClient | null = null;

export function getSupabaseCredentials(): { url: string; key: string } {
  const localUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
  const localKey = localStorage.getItem(STORAGE_KEY_ANON) || '';
  return {
    url: (localUrl || ENV_URL).trim(),
    key: (localKey || ENV_KEY).trim(),
  };
}

export function saveSupabaseCredentials(url: string, key: string) {
  localStorage.setItem(STORAGE_KEY_URL, url.trim());
  localStorage.setItem(STORAGE_KEY_ANON, key.trim());
  clientInstance = null; // reset client so next getSupabaseClient() recreates it
}

export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) return clientInstance;

  const { url, key } = getSupabaseCredentials();
  if (!url || !key) return null;

  try {
    clientInstance = createClient(url, key);
    return clientInstance;
  } catch (err) {
    console.error('Error creating Supabase client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key);
}

/**
 * Test connectivity with Supabase
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'URL atau Anon Key Supabase belum diatur.' };
  }

  try {
    // Try pinging app_cloud_store or master_cabang
    const { error: err1 } = await client.from('app_cloud_store').select('key').limit(1);
    if (!err1) {
      return { success: true, message: 'Koneksi ke Supabase berhasil (Tabel app_cloud_store aktif).' };
    }

    const { error: err2 } = await client.from('master_cabang').select('id').limit(1);
    if (!err2) {
      return { success: true, message: 'Koneksi ke Supabase berhasil (Tabel master_cabang aktif).' };
    }

    return {
      success: false,
      message: `Tersambung ke Supabase, namun tabel belum dibuat. Silakan jalankan script SQL di menu SQL Editor Supabase. (${err1.message})`,
    };
  } catch (err: any) {
    return { success: false, message: `Gagal tersambung: ${err?.message || 'Periksa koneksi internet dan credentials'}` };
  }
}

/**
 * Save Master Data to Supabase Cloud
 */
export async function saveMasterToCloud(rows: MasterRow[], fileName: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    // Try saving to app_cloud_store first (JSON format)
    const { error: storeError } = await client.from('app_cloud_store').upsert({
      key: 'master_data',
      payload: {
        fileName,
        rows,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    });

    if (!storeError) return true;

    // Fallback: try master_cabang table
    // Delete existing rows and insert new ones
    await client.from('master_cabang').delete().neq('id', -1);
    
    // Chunk insert (500 rows per batch)
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map(r => ({
        wilayah: r.Wilayah || '',
        sandi_cabang: r['Sandi Cabang'] || '',
        sandi: r.Sandi || '',
        cabang: r.Cabang || '',
        branch_code: r['Branch Code'] || '',
        kode_cabang: r['Kode Cabang'] || '',
        nama_outlet: r['Nama Outlet'] || '',
        status_outlet: r['Status Outlet'] || '',
        alamat: r.ALAMAT || '',
        kode_pos: r['KODE POS'] || '',
        kelurahan: r.Kelurahan || '',
        kecamatan: r.Kecamatan || '',
        dati_ii: r['Dati II'] || '',
        kode_dati_ii: r['Kode Dati II'] || '',
        provinsi: r.Provinsi || '',
        telp: r.Telp || '',
      }));
      await client.from('master_cabang').insert(chunk);
    }

    return true;
  } catch (err) {
    console.error('Gagal menyimpan ke Supabase:', err);
    return false;
  }
}

/**
 * Load Master Data from Supabase Cloud
 */
export async function loadMasterFromCloud(): Promise<{ rows: MasterRow[]; fileName: string } | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    // 1. Check app_cloud_store
    const { data: storeData, error: storeError } = await client
      .from('app_cloud_store')
      .select('payload')
      .eq('key', 'master_data')
      .single();

    if (!storeError && storeData?.payload?.rows?.length > 0) {
      return {
        rows: storeData.payload.rows as MasterRow[],
        fileName: storeData.payload.fileName || 'Master_Cloud_Supabase.xlsx',
      };
    }

    // 2. Check master_cabang
    const { data: tableData, error: tableError } = await client
      .from('master_cabang')
      .select('*')
      .order('id', { ascending: true });

    if (!tableError && tableData && tableData.length > 0) {
      const rows: MasterRow[] = tableData.map(r => ({
        Wilayah: r.wilayah || '',
        'Sandi Cabang': r.sandi_cabang || '',
        Sandi: r.sandi || '',
        Cabang: r.cabang || '',
        'Branch Code': r.branch_code || '',
        'Kode Cabang': r.kode_cabang || '',
        'Nama Outlet': r.nama_outlet || '',
        'Status Outlet': r.status_outlet || '',
        ALAMAT: r.alamat || '',
        'KODE POS': r.kode_pos || '',
        Kelurahan: r.kelurahan || '',
        Kecamatan: r.kecamatan || '',
        'Dati II': r.dati_ii || '',
        'Kode Dati II': r.kode_dati_ii || '',
        Provinsi: r.provinsi || '',
        Telp: r.telp || '',
      }));

      return {
        rows,
        fileName: 'Master_Cloud_Supabase.xlsx',
      };
    }

    return null;
  } catch (err) {
    console.error('Gagal memuat dari Supabase:', err);
    return null;
  }
}

/**
 * Clear Master Data from Supabase Cloud
 */
export async function clearMasterFromCloud(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    await client.from('app_cloud_store').delete().eq('key', 'master_data');
    await client.from('master_cabang').delete().neq('id', -1);
    return true;
  } catch (err) {
    console.error('Gagal menghapus data dari Supabase:', err);
    return false;
  }
}

/**
 * Standard SQL Setup Script for Supabase SQL Editor
 */
export const SUPABASE_SQL_SETUP = `-- Script Setup Otomatis Database Tools Data Matcher
-- Jalankan di menu SQL Editor pada dashboard Supabase Anda:

CREATE TABLE IF NOT EXISTS app_cloud_store (
  key TEXT PRIMARY KEY,
  payload JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Izinkan akses publik (baca dan tulis) untuk aplikasi
ALTER TABLE app_cloud_store ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access app_cloud_store" ON app_cloud_store;
CREATE POLICY "Public access app_cloud_store" ON app_cloud_store FOR ALL USING (true) WITH CHECK (true);
`;
