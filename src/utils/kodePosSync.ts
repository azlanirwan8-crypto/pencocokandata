import { getItem } from './storage';
import type { KodePosRow } from './neonSync';

/**
 * Perbandingan Master Kode Pos lokal (IndexedDB) dengan tabel cloud
 * `kodepos_data` di Supabase.
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
  /** Baris lokal yang belum ada di cloud — kandidat import ke database. */
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
  /** Jumlah kode pos unik yang tersimpan di Supabase. */
  dbTotal: number;
  /** Jumlah baris wilayah di Supabase (satu kode pos bisa dipakai beberapa kelurahan). */
  dbRows?: number;
  /** Jumlah baris/kode pos di pembanding (master perangkat ini atau sumber internet). */
  compareTotal: number;
  compareLabel: string;
  /** Asal angka pada kartu "belum ada di Supabase". */
  sourceDetail: string;
  /** Provinsi yang terdapat selisih. */
  provincesAffected: string[];
  /** false = sumber tidak memuat nama wilayah, hanya untuk pemeriksaan. */
  importable: boolean;
  /** Isi saat sumber resmi: kode wilayah + kode pos yang belum ada di Supabase. */
  missingCodes: { kode: string; kodePos: string }[];
  /** Jumlah kode pos patokan yang belum ada di Supabase — bisa lebih besar dari daftar contoh. */
  missingTotal?: number;
  /** true bila `missingInCloud` cuma contoh terbatas (DIFF_CAP), bukan seluruhnya. */
  listTruncated?: boolean;
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
    throw new Error(`Server menolak ${url} (HTTP ${res.status}): ${detail}`);
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

  onProgress?.('Mengambil sidik jari dari database...', 12);
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
    `dibandingkan dengan tabel \`kodepos_data\` di Supabase (${neonTotal.toLocaleString('id-ID')} baris).`;

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
  // tersimpan di Supabase tidak boleh diusulkan import.
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
        `${missingCodes.length} kode pos resmi belum ada di Supabase, ${onlyInDb} kode pos di Supabase tidak dikenal sumber.`,
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
      `${newCodes.length} kode pos dikenal sumber tetapi belum ada di Supabase, ${onlyInDb} kode pos hanya ada di Supabase.`,
    provincesAffected: provinces,
    importable: true,
    missingCodes: [],
    note:
      'Perbandingan di level kode pos, karena dataset komunitas ini memakai penamaan wilayah berbeda ' +
      'di level kelurahan.',
  };
}

/** Bangun rencana hasil adu dari respons /api/kodepos-baseline?view=diff. */
function planFromBaselineDiff(json: any, noteTambahan?: string): KodePosSyncPlan {
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
    dbRows: json.dbRows ?? 0,
    compareTotal: json.baselineCodes ?? 0,
    compareLabel: 'patokan di database kita',
    sourceDetail:
      `Tarikan ke-${json.version ?? '?'} pada tabel \`kodepos_baseline\` ` +
      `(${(json.baselineRows ?? 0).toLocaleString('id-ID')} baris, ${(json.baselineCodes ?? 0).toLocaleString('id-ID')} kode pos unik) ` +
      `- sumber: ${json.source}. ` +
      `${(json.missingCodesTotal ?? 0).toLocaleString('id-ID')} kode pos patokan belum ada di Supabase, ` +
      `${(json.codesOnlyInDb ?? 0).toLocaleString('id-ID')} kode pos hanya ada di Supabase.`,
    provincesAffected: provinces,
    importable: true,
    missingCodes: [],
    missingTotal: json.missingCodesTotal ?? rows.length,
    listTruncated: Boolean(json.truncated),
    note:
      (noteTambahan ? noteTambahan + ' ' : '') +
      (json.truncated
        ? `Daftar dibatasi ${rows.length.toLocaleString('id-ID')} baris pertama; `
        : '') +
      'Perbandingan dilakukan di level kode pos, jadi nama wilayah yang ditulis beda (mis. UPPERCASE) ' +
      'tidak dianggap data baru.',
  };
}

/** Lantai baris patokan: dump resmi Kemendagri memuat 83.762 desa (diukur 2026-09-20). */
const PATOKAN_LANTAI_BARIS = 83_000;
const PATOKAN_MAKS_UMUR_HARI = 30;

/** Alasan penarikan ulang, atau null bila patokan sudah layak dipakai. */
function alasanTarikPatokan(json: any): string | null {
  if (!json?.ready) return 'Patokan belum ada';
  const baris = Number(json.baselineRows || 0);
  if (baris < PATOKAN_LANTAI_BARIS) {
    return `Patokan baru ${baris.toLocaleString('id-ID')} baris, di bawah ${PATOKAN_LANTAI_BARIS.toLocaleString('id-ID')} daftar resmi`;
  }
  const diambil = new Date(json.takenAt || 0).getTime();
  if (!diambil || Date.now() - diambil > PATOKAN_MAKS_UMUR_HARI * 86_400_000) {
    return `Patokan sudah lebih dari ${PATOKAN_MAKS_UMUR_HARI} hari`;
  }
  return null;
}

/**
 * Salin SELURUH baris patokan yang belum ada ke tabel kerja. Server membatasi satu
 * window per panggilan (role `anon` Supabase memotong statement di 8 detik), jadi
 * fungsi ini yang mengulang dari titik berhenti sampai selesai.
 */
export async function importSemuaPatokan(
  onProgress?: SyncProgress
): Promise<{ masuk: number; totalSetelah: number }> {
  let mulai = 0;
  let masuk = 0;
  let totalSetelah = 0;
  for (let tahap = 0; tahap < 60; tahap++) {
    const json = await fetchJson('/api/kodepos-baseline?view=import-missing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mulai }),
    });
    if (!json?.ok) throw new Error(json?.error || 'Penyalinan patokan ke tabel kerja gagal.');
    masuk += Number(json.masuk || 0);
    totalSetelah = Number(json.totalSetelah || 0);
    const totalPatokan = Number(json.totalPatokan || 0);
    if (json.selesai || json.berikutnya == null) {
      onProgress?.('Penyalinan patokan selesai', 100);
      return { masuk, totalSetelah };
    }
    mulai = Number(json.berikutnya);
    onProgress?.(
      `Menyalin patokan ke tabel kerja: ${mulai.toLocaleString('id-ID')} dari ${totalPatokan.toLocaleString('id-ID')} baris...`,
      Math.min(95, Math.round((mulai / Math.max(1, totalPatokan)) * 100))
    );
  }
  throw new Error(
    `Penyalinan patokan berhenti di baris ke-${mulai.toLocaleString('id-ID')} dari ${totalSetelah.toLocaleString('id-ID')} — tekan Sync Data lagi untuk melanjutkan.`
  );
}

/** Cakupan titik koordinat per baris tabel kerja. */
export interface KoordinatCakupan {
  patokanTitik: number;
  dataTotal: number;
  dataTitik: number;
  tanpaTitik: number;
  kodePosTitik: number;
  diLuarWilayah: number;
  takTerkenalan: number;
  /** Kode wilayah titik yang dikenali daftar patokan Kemendagri. */
  kodeWilayahCocok: number;
  /** ... dan kode pos sumbernya juga sama dengan kode pos Kemendagri. */
  kodePosCocok: number;
  terakhir: string | null;
}

export async function cakupanKoordinat(): Promise<KoordinatCakupan | null> {
  try {
    const json = await fetchJson('/api/kodepos-baseline?view=koordinat');
    return json?.ok ? (json as KoordinatCakupan) : null;
  } catch (err) {
    console.warn('Cakupan koordinat tidak terbaca:', err);
    return null;
  }
}

/**
 * Turunkan titik per desa dari tabel patokan ke baris tabel kerja. Dipanggil setelah
 * penyalinan patokan supaya baris baru langsung punya koordinatnya sendiri.
 */
export async function salinKoordinatPatokan(): Promise<{ disalin: number; tanpaTitik: number } | null> {
  try {
    const json = await fetchJson('/api/kodepos-baseline?view=koordinat-salin', { method: 'POST' });
    return json?.ok ? { disalin: Number(json.disalin || 0), tanpaTitik: Number(json.tanpaTitik || 0) } : null;
  } catch (err) {
    console.warn('Penyalinan koordinat ke tabel kerja dilewati:', err);
    return null;
  }
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
 * Crawl satu provinsi dari kodepos.id sampai halamannya habis, lalu simpan
 * jejaknya (jumlah halaman + hash halaman sampel) supaya pemeriksaan berikutnya
 * cukup membandingkan beberapa halaman saja.
 */
async function crawlKodePosIdProvince(
  provinsi: string,
  versi: number | undefined,
  onRow?: (tambah: number, halaman: number) => void
): Promise<{ versi: number; rows: number; halaman: number }> {
  let fromPage = 1;
  let rows = 0;
  let lastPage = 0;
  let v = versi;
  for (let guard = 0; guard < 200; guard++) {
    const json = await fetchJson('/api/kodepos-id?view=crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provinsi, fromPage, versi: v }),
    });
    v = json.versi;
    rows += json.upserted || 0;
    lastPage = Math.max(lastPage, json.lastPage || 0);
    onRow?.(json.upserted || 0, json.next - 1);
    if (json.done || json.next <= fromPage) break;
    fromPage = json.next;
  }
  const commit = await fetchJson('/api/kodepos-id?view=commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provinsi, halaman: lastPage, baris: rows, versi: v }),
  });
  return { versi: commit.versi ?? v ?? 0, rows, halaman: lastPage };
}

/** Kumpul ulang SELURUH kodepos.id (±4.700 halaman, ±8-10 menit). */
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
    const r = await crawlKodePosIdProvince(provinces[i], versi, (tambah, halaman) => {
      rows += tambah;
      onProgress?.(
        `Mengambil ${provinces[i]} (halaman ${halaman}) — total ${rows.toLocaleString('id-ID')} baris...`,
        Math.min(97, Math.round(((i + 1) / provinces.length) * 100))
      );
    });
    versi = r.versi;
  }
  onProgress?.('Patokan tersimpan', 100);
  return { version: versi ?? 0, rows, provinces: provinces.length, sumber: list.source || 'kodepos.id' };
}

/**
 * Pastikan tabel patokan terisi dan layak dipakai: kosong, di bawah daftar resmi,
 * atau lebih dari 30 hari -> tarik sendiri dari dump resmi Kemendagri. Sumber ini
 * layanannya GitHub, jadi tidak ikut diblokir Cloudflare saat aplikasi jalan di server.
 */
async function pastikanPatokanTerisi(onProgress?: SyncProgress): Promise<number> {
  const bacaPatokan = async () => {
    const m = await fetchJson('/api/kodepos-baseline?view=meta');
    return {
      ready: Boolean(m.ready),
      baselineRows: Number(m.stats?.baris || 0),
      takenAt: m.stats?.diambil_pada || null,
    };
  };

  const alasan = alasanTarikPatokan(await bacaPatokan());
  if (!alasan) return 0;
  onProgress?.(`${alasan} — menarik dump resmi Kemendagri...`, 8);
  const hasil = await pullKodePosBaseline((pesan, pct) => onProgress?.(pesan, 8 + Math.round(pct * 0.3)));
  const sesudah = await bacaPatokan();
  if (sesudah.baselineRows < PATOKAN_LANTAI_BARIS) {
    throw new Error(
      `Patokan baru ${sesudah.baselineRows.toLocaleString('id-ID')} baris setelah ditarik, ` +
      `di bawah ${PATOKAN_LANTAI_BARIS.toLocaleString('id-ID')} daftar resmi — sumber cadangan yang terpakai. ` +
      'Coba lagi, atau periksa apakah GitHub sedang menolak server ini.'
    );
  }
  return hasil.rows;
}

/**
 * INI YANG JALAN SAAT KLIK "Sync Data".
 * 1) pastikan tabel patokan terisi — kalau kosong/kurang/usang, tarik dump resmi Kemendagri
 * 2) tanya kodepos.id: ada provinsi yang berubah sejak patokan diambil? kalau ada, crawl provinsinya
 * 3) adukan kodepos_data (tabel kerja) terhadap patokan di level kode pos
 * 4) kalau tabel kerja masih kosong sama sekali, salin patokan penuh ke dalamnya
 *
 * Cloudflare kodepos.id menolak IP datacenter, jadi langkah (2) dilewati saat server
 * diblokir — itu tidak lagi menghentikan pemeriksaan karena (1) tidak lewat kodepos.id.
 */
export async function runKodePosLiveSync(onProgress?: SyncProgress): Promise<KodePosSyncPlan> {
  const barisPatokanBaru = await pastikanPatokanTerisi(onProgress);

  onProgress?.('Menanyakan kondisi terbaru ke kodepos.id...', 40);
  const fresh = await fetchJson('/api/kodepos-id?view=fresh');

  const ambilPatokan = async () => {
    onProgress?.('Membandingkan dengan database Supabase...', 88);
    const json = await fetchJson('/api/kodepos-baseline?view=diff');
    if (!json.ready) {
      throw new Error('Patokan masih kosong setelah ditarik dari sumber resmi. Coba lagi satu kali.');
    }
    return { ...json, source: fresh.source || json.source };
  };

  const perlu: string[] = fresh.blocked
    ? []
    : [
        ...((fresh.belumPernah || []) as string[]),
        ...((fresh.berubah || []) as any[]).map((b) => String(b.provinsi)),
      ];

  let versi: number | undefined;
  for (let i = 0; i < perlu.length; i++) {
    onProgress?.(
      `Ada perubahan — mengambil ulang ${perlu[i]} (${i + 1}/${perlu.length})...`,
      40 + Math.round(((i + 1) / perlu.length) * 48)
    );
    const r = await crawlKodePosIdProvince(perlu[i], versi);
    versi = r.versi;
  }

  let json = await ambilPatokan();

  let catatan = fresh.blocked
    ? `kodepos.id menolak server ini (${fresh.reason || '403'}) — perbandingan memakai patokan resmi di database.`
    : perlu.length
      ? `${perlu.length} provinsi diperbarui barusan dari kodepos.id (${perlu.slice(0, 4).join(', ')}${perlu.length > 4 ? ', ...' : ''}).`
      : 'kodepos.id masih sama dengan patokan terakhir, jadi tidak perlu ambil ulang.';
  if (barisPatokanBaru > 0) {
    catatan = `Patokan resmi baru ditarik ke database (${barisPatokanBaru.toLocaleString('id-ID')} baris). ` + catatan;
  }

  /*
   * Tabel kerja masih kosong = pertama kali dipakai. Salin penuh sekaligus titik
   * koordinatnya supaya satu kali tekan Sync Data langsung menampilkan data,
   * lalu baca ulang selisihnya agar angka yang tampil benar-benar kondisi terakhir.
   */
  if (Number(json.dbRows || 0) === 0 && Number(json.missingCodesTotal || 0) > 0) {
    onProgress?.('Tabel kerja kosong — menyalin seluruh patokan ke tabel kerja...', 92);
    const { masuk, totalSetelah } = await importSemuaPatokan((pesan, pct) =>
      onProgress?.(pesan, 92 + Math.round(pct * 0.06))
    );
    const titik = await salinKoordinatPatokan();
    json = await ambilPatokan();
    catatan =
      `${masuk.toLocaleString('id-ID')} baris patokan disalin ke tabel kerja (total ${totalSetelah.toLocaleString('id-ID')} baris)` +
      (titik && titik.disalin > 0 ? `, ${titik.disalin.toLocaleString('id-ID')} baris mendapat titik koordinat` : '') +
      `. ` + catatan;
  }

  return planFromBaselineDiff(json, catatan);
}

