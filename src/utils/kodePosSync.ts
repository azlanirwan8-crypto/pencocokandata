import { getItem } from './storage';
import type { KodePosRow } from './neonSync';

/**
 * Perbandingan Master Kode Pos lokal (IndexedDB) dengan tabel cloud
 * `kodepos_data` di Neon.
 *
 * Strategi: sidik jari SHA-256 per provinsi (murah, satu request) lalu diff
 * himpunan kunci hanya untuk provinsi yang berbeda. Tidak pernah memindahkan
 * puluhan ribu baris untuk data yang ternyata sudah sama.
 */

/** Harus identik dengan ROW_KEY_SQL di api/kodepos.ts. */
export function kodePosRowKey(r: Partial<KodePosRow>): string {
  return [r.kodePos, r.kelurahan, r.kecamatan, r.kabupatenKota, r.provinsi]
    .map((v) => String(v ?? '').trim().toUpperCase())
    .join('|');
}

export function kodePosProvinceOf(r: Partial<KodePosRow>): string {
  const p = String(r.provinsi ?? '').trim().toUpperCase();
  return p || '(TANPA PROVINSI)';
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Urutan sort harus sama dengan `ORDER BY k COLLATE "C"` di Postgres (urutan
 * byte UTF-8). Untuk kunci yang seluruhnya ASCII, perbandingan kode-unit JS
 * menghasilkan urutan yang sama.
 */
export async function fingerprintKeys(keys: string[]): Promise<string> {
  return sha256Hex(keys.slice().sort().join('\n'));
}

export interface CloudProvince {
  provinsi: string;
  total: number;
  fingerprint: string;
}

export interface KodePosSyncPlan {
  status: 'SYNCED' | 'DIFF';
  localTotal: number;
  cloudTotal: number;
  lastUpdated: string | null;
  /** Baris lokal yang belum ada di cloud — kandidat import ke Neon. */
  missingInCloud: KodePosRow[];
  /** Contoh baris cloud yang tidak dimiliki lokal (maks. 500 per provinsi). */
  missingInLocal: KodePosRow[];
  cloudOnlyProvinces: { provinsi: string; total: number }[];
  diffProvinces: string[];
}

export type SyncProgress = (step: string, pct: number) => void;

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // respons bukan JSON (mis. fungsi API gagal dimuat) — simpan cuplikannya
  }
  if (!res.ok || !json?.ok) {
    if (res.status === 404) {
      throw new Error('Endpoint /api/kodepos?view=sync-meta tidak ditemukan. Jalankan dari aplikasi yang sudah ter-deploy (Vercel), karena fungsi API tidak tersedia di dev server lokal.');
    }
    const detail =
      json?.error || json?.message || (text ? text.slice(0, 200).replace(/\s+/g, ' ') : `HTTP ${res.status}`);
    throw new Error(`Neon menolak ${url} (HTTP ${res.status}): ${detail}`);
  }
  return json;
}

export async function runKodePosSync(onProgress?: SyncProgress): Promise<KodePosSyncPlan> {
  if (!crypto?.subtle) {
    throw new Error('Browser ini tidak mendukung Web Crypto (SHA-256), sinkronisasi tidak dapat dihitung.');
  }

  onProgress?.('Membaca master kode pos di perangkat ini...', 5);
  const local = (await getItem<KodePosRow[]>('kodepos_master_data')) || [];
  if (!Array.isArray(local) || local.length === 0) {
    throw new Error('Master kode pos lokal kosong. Impor berkas kode pos terlebih dahulu.');
  }

  onProgress?.('Mengambil sidik jari dari Neon...', 12);
  const meta = await fetchJson('/api/kodepos?view=sync-meta');
  const cloudProvinces: CloudProvince[] = meta.provinces || [];
  const cloudByName = new Map(cloudProvinces.map((p) => [p.provinsi, p]));

  const byProvince = new Map<string, KodePosRow[]>();
  local.forEach((r) => {
    const prov = kodePosProvinceOf(r);
    const bucket = byProvince.get(prov);
    if (bucket) bucket.push(r);
    else byProvince.set(prov, [r]);
  });

  const provinceNames = Array.from(
    new Set([...byProvince.keys(), ...cloudProvinces.map((p) => p.provinsi)])
  ).sort();

  const diffProvinces: string[] = [];
  const cloudOnlyProvinces: { provinsi: string; total: number }[] = [];

  for (let i = 0; i < provinceNames.length; i++) {
    const name = provinceNames[i];
    const rows = byProvince.get(name) || [];
    const cloud = cloudByName.get(name);
    const cloudTotal = cloud?.total ?? 0;

    onProgress?.(`Membandingkan ${name} (${i + 1}/${provinceNames.length})...`, 15 + Math.round((i / Math.max(1, provinceNames.length)) * 55));

    if (rows.length !== cloudTotal) {
      if (rows.length === 0 && cloudTotal > 0) cloudOnlyProvinces.push({ provinsi: name, total: cloudTotal });
      else diffProvinces.push(name);
      continue;
    }
    if (cloudTotal === 0) continue;

    const fp = await fingerprintKeys(rows.map(kodePosRowKey));
    if (fp !== cloud?.fingerprint) diffProvinces.push(name);
  }

  if (diffProvinces.length === 0) {
    onProgress?.('Selesai', 100);
    return {
      status: 'SYNCED',
      localTotal: local.length,
      cloudTotal: meta.cloudTotal ?? cloudProvinces.reduce((s, p) => s + p.total, 0),
      lastUpdated: meta.lastUpdated ?? null,
      missingInCloud: [],
      missingInLocal: [],
      cloudOnlyProvinces,
      diffProvinces,
    };
  }

  const missingInCloud: KodePosRow[] = [];
  const missingInLocal: KodePosRow[] = [];

  for (let i = 0; i < diffProvinces.length; i++) {
    const name = diffProvinces[i];
    const rows = byProvince.get(name) || [];
    onProgress?.(`Menghitung selisih ${name} (${i + 1}/${diffProvinces.length})...`, 70 + Math.round((i / Math.max(1, diffProvinces.length)) * 28));

    if (rows.length === 0) continue;

    const keys = rows.map(kodePosRowKey);
    const res = await fetchJson('/api/kodepos?view=sync-diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Pemisah chr(31) dipakai agar tidak bergantung serialisasi array driver
      body: JSON.stringify({ keys, cap: 500 }),
    });

    const found = new Set<string>((res.missingInCloud || []) as string[]);
    if (found.size > 0) {
      rows.forEach((r) => {
        if (found.has(kodePosRowKey(r))) missingInCloud.push(r);
      });
    }
    (res.missingInLocal || []).forEach((r: KodePosRow) => missingInLocal.push(r));
  }

  onProgress?.('Selesai', 100);
  return {
    status: 'DIFF',
    localTotal: local.length,
    cloudTotal: meta.cloudTotal ?? cloudProvinces.reduce((s, p) => s + p.total, 0),
    lastUpdated: meta.lastUpdated ?? null,
    missingInCloud,
    missingInLocal,
    cloudOnlyProvinces,
    diffProvinces,
  };
}
