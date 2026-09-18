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
  /** Diisi saat mode sumber eksternal. */
  sourceLabel?: string;
  /** Satuan angka pembanding: 'kode pos' atau 'baris'. */
  compareUnit?: string;
  note?: string;
  /** Jumlah baris/kode pos yang tersimpan di Neon. */
  dbTotal: number;
  /** Jumlah baris/kode pos di pembanding (master perangkat ini atau sumber internet). */
  compareTotal: number;
  compareLabel: string;
  /** Asal angka pada kartu "belum ada di Neon". */
  sourceDetail: string;
  /** Provinsi yang terdapat selisih. */
  provincesAffected: string[];
  /** false = sumber tidak memuat nama wilayah, hanya untuk pemeriksaan. */
  importable: boolean;
  /** Isi saat sumber resmi: kode wilayah + kode pos yang belum ada di Neon. */
  missingCodes: { kode: string; kodePos: string }[];
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

  const neonTotal = meta.cloudTotal ?? cloudProvinces.reduce((s, p) => s + p.total, 0);
  const sourceDetail =
    `Master perangkat ini (IndexedDB \`kodepos_master_data\`, ${local.length.toLocaleString('id-ID')} baris) ` +
    `dibandingkan dengan tabel \`kodepos_data\` di Neon (${neonTotal.toLocaleString('id-ID')} baris).`;

  if (diffProvinces.length === 0) {
    onProgress?.('Selesai', 100);
    return {
      status: 'SYNCED',
      localTotal: local.length,
      cloudTotal: neonTotal,
      lastUpdated: meta.lastUpdated ?? null,
      missingInCloud: [],
      missingInLocal: [],
      cloudOnlyProvinces,
      diffProvinces,
      dbTotal: neonTotal,
      compareTotal: local.length,
      compareLabel: 'Berkas perangkat ini',
      sourceLabel: 'Berkas kode pos di perangkat ini',
      compareUnit: 'baris',
      sourceDetail,
      provincesAffected: diffProvinces,
      importable: true,
      missingCodes: [],
    };
  }

  const missingInCloud: KodePosRow[] = [];
  const missingInLocal: KodePosRow[] = [];
  // Patokan validasi = KODE POS. Baris yang nama wilayahnya beda tapi kode posnya sudah
  // tersimpan di Neon tidak boleh diusulkan import.
  const cloudCodes = new Set<string>();

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

    ((res.cloudCodes || []) as string[]).forEach((c) => cloudCodes.add(String(c).trim().toUpperCase()));

    const found = new Set<string>((res.missingInCloud || []) as string[]);
    if (found.size > 0) {
      rows.forEach((r) => {
        if (found.has(kodePosRowKey(r))) missingInCloud.push(r);
      });
    }
    (res.missingInLocal || []).forEach((r: KodePosRow) => missingInLocal.push(r));
  }

  const baru = missingInCloud.filter(
    (r) => !cloudCodes.has(String(r.kodePos || '').trim().toUpperCase())
  );
  const provincesAffected = Array.from(new Set(baru.map(kodePosProvinceOf))).sort();

  onProgress?.('Selesai', 100);
  return {
    status: baru.length > 0 ? 'DIFF' : 'SYNCED',
    localTotal: local.length,
    cloudTotal: neonTotal,
    lastUpdated: meta.lastUpdated ?? null,
    missingInCloud: baru,
    missingInLocal,
    cloudOnlyProvinces,
    diffProvinces,
    dbTotal: neonTotal,
    compareTotal: local.length,
    compareLabel: 'Berkas perangkat ini',
    sourceLabel: 'Berkas kode pos di perangkat ini',
    compareUnit: 'baris',
    sourceDetail,
    provincesAffected,
    importable: true,
    missingCodes: [],
  };
}

/**
 * Audit terhadap sumber eksternal (dataset kode pos di GitHub). Server yang
 * mengunduh dan membandingkan, jadi tidak ada puluhan ribu baris lewat browser.
 */
export async function runKodePosSourceAudit(
  source: 'resmi' | 'komunitas' = 'resmi',
  onProgress?: SyncProgress
): Promise<KodePosSyncPlan> {
  onProgress?.('Mengunduh dataset kode pos eksternal dan membandingkannya...', 30);
  const json = await fetchJson(`/api/kodepos-source?view=audit&source=${source}`);
  onProgress?.('Selesai', 100);

  const dbCodes: number = json.db?.distinctCodes ?? 0;
  const srcCodes: number = json.source?.distinctCodes ?? 0;
  const onlyInDb = json.codesOnlyInDb ?? 0;

  if (source === 'resmi') {
    const missingCodes: { kode: string; kodePos: string }[] = json.missingCodes || [];
    return {
      status: missingCodes.length > 0 ? 'DIFF' : 'SYNCED',
      localTotal: dbCodes,
      cloudTotal: srcCodes,
      lastUpdated: json.source?.cachedAt ?? null,
      missingInCloud: [],
      missingInLocal: [],
      cloudOnlyProvinces: [],
      diffProvinces: [],
      sourceLabel: 'Sumber resmi: Kepmendagri + Pos Indonesia',
      compareUnit: 'kode pos',
      dbTotal: dbCodes,
      compareTotal: srcCodes,
      compareLabel: 'Sumber resmi',
      sourceDetail:
        `${json.source?.label} - ${json.source?.total} desa/kelurahan, ${srcCodes} kode pos unik. ` +
        `${missingCodes.length} kode pos resmi belum ada di Neon, ${onlyInDb} kode pos di Neon tidak dikenal sumber.`,
      provincesAffected: json.provincesAffected || [],
      importable: false,
      missingCodes,
      note: json.note,
    };
  }

  const rows: KodePosRow[] = json.onlyInSource || [];
  const newCodes: string[] = json.newCodes || [];
  const provinces = Array.from(new Set(rows.map((r) => kodePosProvinceOf(r)))).sort();

  return {
    status: rows.length > 0 ? 'DIFF' : 'SYNCED',
    localTotal: dbCodes,
    cloudTotal: srcCodes,
    lastUpdated: json.source?.cachedAt ?? null,
    missingInCloud: rows,
    missingInLocal: [],
    cloudOnlyProvinces: [],
    diffProvinces: [],
    sourceLabel: 'Dataset GitHub komunitas (teguh02)',
    compareUnit: 'kode pos',
    dbTotal: dbCodes,
    compareTotal: srcCodes,
    compareLabel: 'Sumber komunitas',
    sourceDetail:
      `${json.source?.label} - ${json.source?.total} baris / ${srcCodes} kode pos unik. ` +
      `${newCodes.length} kode pos dikenal sumber tetapi belum ada di Neon, ${onlyInDb} kode pos hanya ada di Neon.`,
    provincesAffected: provinces,
    importable: true,
    missingCodes: [],
    note:
      'Perbandingan di level kode pos, karena dataset komunitas ini memakai penamaan wilayah berbeda ' +
      'di level kelurahan.',
  };
}

/**
 * Patokan tersimpan di database sendiri (tabel kodepos_baseline). Pemeriksaan sync tidak
 * menyentuh situs pihak ketiga saat dijalankan — hanya saat baseline ditarik ulang.
 */
export async function runKodePosBaselineAudit(onProgress?: SyncProgress): Promise<KodePosSyncPlan> {
  onProgress?.('Membandingkan database dengan baseline tersimpan...', 40);
  const json = await fetchJson('/api/kodepos-baseline?view=diff');
  onProgress?.('Selesai', 100);

  if (!json.ready) {
    throw new Error('Patokan belum tersimpan di database. Klik tombol "Tarik data terbaru" sekali terlebih dahulu.');
  }

  const rows: KodePosRow[] = json.missingInDb || [];
  const provinces = Array.from(new Set(rows.map((r) => kodePosProvinceOf(r)))).sort();
  return {
    status: rows.length > 0 ? 'DIFF' : 'SYNCED',
    localTotal: json.dbCodes ?? 0,
    cloudTotal: json.baselineCodes ?? 0,
    lastUpdated: json.takenAt ?? null,
    missingInCloud: rows,
    missingInLocal: [],
    cloudOnlyProvinces: [],
    diffProvinces: [],
    sourceLabel: json.source,
    compareUnit: 'kode pos',
    dbTotal: json.dbCodes ?? 0,
    compareTotal: json.baselineCodes ?? 0,
    compareLabel: 'patokan di database kita',
    sourceDetail:
      `Tarikan ke-${json.version ?? '?'} pada tabel \`kodepos_baseline\` ` +
      `(${(json.baselineRows ?? 0).toLocaleString('id-ID')} baris, ${(json.baselineCodes ?? 0).toLocaleString('id-ID')} kode pos unik) ` +
      `- sumber: ${json.source}. ` +
      `${(json.missingCodesTotal ?? 0).toLocaleString('id-ID')} kode pos baseline belum ada di Neon, ` +
      `${(json.codesOnlyInDb ?? 0).toLocaleString('id-ID')} kode pos hanya ada di Neon.`,
    provincesAffected: provinces,
    importable: true,
    missingCodes: [],
    note:
      (json.truncated
        ? `Daftar dibatasi ${rows.length.toLocaleString('id-ID')} baris pertama; `
        : '') +
      'Perbandingan dilakukan di level kode pos dan nama wilayah dari sumber pemerintah ditulis UPPERCASE ' +
      '(mis. "KEUDE BAKONGAN"), jadi gaya penulisan baris hasil impor bisa berbeda dengan master yang sekarang.',
  };
}

/** Cicil penarikan baseline (server membatasi 5 halaman x 1000 baris tiap panggilan). */
export async function pullKodePosBaseline(
  onProgress?: SyncProgress
): Promise<{ version: number; rows: number; sumber: string }> {
  let start = 0;
  let versi: number | undefined;
  let rows = 0;
  let sumberId: string | undefined;
  let sumber = '';
  for (let guard = 0; guard < 40; guard++) {
    const json = await fetchJson('/api/kodepos-baseline?view=fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, versi, sourceId: sumberId }),
    });
    versi = json.versi;
    sumberId = json.sumberId || sumberId;
    sumber = json.sumber || sumber;
    rows += json.upserted || 0;
    if (json.done) {
      if (!rows) throw new Error('Sumber tidak mengirim satu barispun, jadi baseline tidak diperbarui.');
      onProgress?.('Baseline tersimpan', 100);
      return { version: versi ?? 0, rows, sumber: sumber || 'sumber' };
    }
    if (!json.nextStart) {
      throw new Error('Sumber berhenti di tengah jalan tanpa memberi lanjutan data.');
    }
    start = json.nextStart;
    onProgress?.(
      `Menarik baseline (${sumber || 'sumber'}): ${rows.toLocaleString('id-ID')} dari ${(json.total || 0).toLocaleString('id-ID')} baris...`,
      Math.min(95, Math.round((rows / Math.max(1, json.total || 1)) * 100))
    );
  }
  throw new Error('Penarikan baseline berhenti setelah 40 tahap; jalankan ulang untuk melanjutkan.');
}

/**
 * Kumpul patokan dari kodepos.id. Situs ini tidak punya API maupun berkas
 * unduhan, jadi server menelusuri halaman provinsinya yang berpaginasi
 * (±4.700 halaman). Dipanggil per provinsi supaya tiap fungsi selesai < 60 detik.
 */
export async function crawlKodePosId(
  onProgress?: SyncProgress
): Promise<{ version: number; rows: number; provinces: number; sumber: string }> {
  onProgress?.('Membaca daftar provinsi dari kodepos.id...', 2);
  const list = await fetchJson('/api/kodepos-id?view=provinces');
  const provinces: string[] = list.provinces || [];
  if (provinces.length === 0) throw new Error('Tidak ada provinsi terbaca dari kodepos.id.');

  let versi: number | undefined;
  let rows = 0;
  for (let i = 0; i < provinces.length; i++) {
    const provinsi = provinces[i];
    let fromPage = 1;
    for (let guard = 0; guard < 200; guard++) {
      const json = await fetchJson('/api/kodepos-id?view=crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provinsi, fromPage, versi }),
      });
      versi = json.versi;
      rows += json.upserted || 0;
      onProgress?.(
        `Mengambil ${provinsi} (halaman ${json.next - 1}) — total ${rows.toLocaleString('id-ID')} baris...`,
        Math.min(97, Math.round(((i + 1) / provinces.length) * 100))
      );
      if (json.done || json.next <= fromPage) break;
      fromPage = json.next;
    }
  }
  onProgress?.('Patokan tersimpan', 100);
  return { version: versi ?? 0, rows, provinces: provinces.length, sumber: list.source || 'kodepos.id' };
}
