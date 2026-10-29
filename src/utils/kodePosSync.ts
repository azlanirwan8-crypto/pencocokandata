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
  /** Baris patokan yang baru saja disalin ke tabel kerja oleh pemeriksaan ini. */
  barisDisalin?: number;
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
      throw new Error(`Endpoint ${url} tidak ditemukan. Pastikan aplikasi sudah ter-deploy ulang (Vercel) karena fungsi api/ tidak ikut build statis.`);
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

/**
 * Crawl titik koordinat per desa dari kodepos.co.id, dipanggil per ±1.500 halaman
 * kecamatan. Sumbernya sama seperti dulu saat masih harus dari laptop — hanya sekarang
 * server yang mengambilnya (terukur: 220 ms per halaman dari Vercel, 7.277 halaman).
 */
export async function crawlKoordinatPatokan(onProgress?: SyncProgress): Promise<number> {
  let mulai = 0;
  let masuk = 0;
  let total = 0;
  let gagal = 0;
  for (let tahap = 0; tahap < 40; tahap++) {
    const json = await fetchJson('/api/kodepos-baseline?view=koordinat-crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mulai }),
    });
    masuk += Number(json.masuk || 0);
    gagal += Number(json.gagal || 0);
    total = Number(json.total || total);
    if (json.selesai) {
      onProgress?.('Titik koordinat tersimpan', 100);
      return masuk;
    }
    if (json.berikutnya == null || Number(json.berikutnya) <= mulai) {
      throw new Error('Crawl koordinat berhenti tanpa kemajuan.');
    }
    mulai = Number(json.berikutnya);
    onProgress?.(
      `Mengambil titik koordinat dari kodepos.co.id: ${mulai.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} kecamatan — ${masuk.toLocaleString('id-ID')} titik${gagal ? ` (${gagal.toLocaleString('id-ID')} halaman bolong)` : ''}...`,
      Math.round((mulai / Math.max(1, total)) * 100)
    );
  }
  throw new Error(`Crawl koordinat berhenti di halaman ke-${mulai.toLocaleString('id-ID')}; tekan Sync Data lagi untuk melanjutkan.`);
}

/**
 * Salin SELURUH baris patokan yang belum ada ke tabel kerja. Server memindahkan satu
 * window per panggilan — statement panjang dipotong ±8 detik oleh role `anon`, dan
 * tiap balasan baca dipotong 1.000 baris — jadi fungsi ini yang mengulang sampai selesai.
 */
export async function importSemuaPatokan(
  onProgress?: SyncProgress
): Promise<{ masuk: number; bertitik: number; totalSetelah: number }> {
  let mulai = 0;
  let masuk = 0;
  let bertitik = 0;
  let totalSetelah = 0;
  let totalPatokan = 0;
  // Batas lama 60 pernah menghentikan pengisian di tengah jalan (server membalas
  // 1.000 baris per halaman, jadi window kecil butuh puluhan tahap).
  for (let tahap = 0; tahap < 400; tahap++) {
    const json = await fetchJson('/api/kodepos-baseline?view=import-missing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mulai }),
    });
    if (!json?.ok) throw new Error(json?.error || 'Penyalinan patokan ke tabel kerja gagal.');
    masuk += Number(json.masuk || 0);
    bertitik += Number(json.bertitik || 0);
    totalSetelah = Number(json.totalSetelah || 0);
    totalPatokan = Number(json.totalPatokan || totalPatokan);
    if (json.selesai || json.berikutnya == null) {
      onProgress?.('Penyalinan patokan selesai', 100);
      return { masuk, bertitik, totalSetelah };
    }
    mulai = Number(json.berikutnya);
    onProgress?.(
      `Menyalin patokan ke tabel kerja: ${mulai.toLocaleString('id-ID')} dari ${totalPatokan.toLocaleString('id-ID')} baris...`,
      Math.min(95, Math.round((mulai / Math.max(1, totalPatokan)) * 100))
    );
  }
  throw new Error(
    `Penyalinan patokan berhenti di baris ke-${mulai.toLocaleString('id-ID')} dari ${(totalPatokan || mulai).toLocaleString('id-ID')} — tekan Sync Data lagi untuk melanjutkan.`
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
  /*
   * Terukur di produksi 2026-09-23: `koordinat_cakupan` butuh 4,1-5,7 detik dan
   * kadang dipotong batas statement 8 detik role `anon`. Null bukan berarti "titik
   * belum ada", jadi dibaca ulang sekali — kegagalan dua kali baru dianggap kosong
   * (jalur di bawahnya memang masih aman: crawl hanya menimpah per kode wilayah).
   */
  for (let percobaan = 0; percobaan < 2; percobaan++) {
    try {
      const json = await fetchJson('/api/kodepos-baseline?view=koordinat');
      return json?.ok ? (json as KoordinatCakupan) : null;
    } catch (err) {
      if (percobaan === 0) await new Promise((r) => setTimeout(r, 400));
      else console.warn('Cakupan koordinat tidak terbaca:', err);
    }
  }
  return null;
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
 * Sumber PATOKANUtama: scrape seluruh halaman kecamatan kodepos.co.id dari server.
 * Satu panggilan = satu window ±800 halaman (terukur: 17,0-34,8 d per window 800
 * halaman, anggaran fungsi 60 d), jadi 7.277 halaman butuh ±10 panggilan. Setiap
 * baris membawa kode pos, nama 5 level, dan titik koordinatnya sekaligus.
 */
export async function pullPatokanDariSitus(
  onProgress?: SyncProgress
): Promise<{ rows: number; titik: number; versi: number; halaman: number; gagal: number }> {
  let mulai = 0;
  let versi = 0;
  let rows = 0;
  let titik = 0;
  let gagal = 0;
  let total = 0;
  for (let tahap = 0; tahap < 40; tahap++) {
    const json = await fetchJson('/api/kodepos-baseline?view=situs-baseline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mulai, versi: versi || undefined }),
    });
    versi = Number(json.versi) || versi;
    rows += Number(json.masuk || 0);
    titik += Number(json.titik || 0);
    gagal += Number(json.gagal || 0);
    total = Number(json.total || total);
    if (json.selesai) {
      if (!rows) throw new Error('kodepos.co.id tidak mengirim satu barispun.');
      onProgress?.('Patokan kodepos.co.id tersimpan', 100);
      return { rows, titik, versi, halaman: total, gagal };
    }
    if (json.berikutnya == null || Number(json.berikutnya) <= mulai) {
      throw new Error('Scrape kodepos.co.id berhenti tanpa kemajuan.');
    }
    mulai = Number(json.berikutnya);
    onProgress?.(
      `Mengambil wilayah + kode pos + titik dari kodepos.co.id: ${mulai.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} kecamatan — ${rows.toLocaleString('id-ID')} baris${gagal ? ` (${gagal.toLocaleString('id-ID')} halaman bolong)` : ''}...`,
      Math.min(95, Math.round((mulai / Math.max(1, total)) * 100))
    );
  }
  throw new Error(`Scrape kodepos.co.id berhenti di halaman ke-${mulai.toLocaleString('id-ID')}; tekan Sync Data lagi untuk melanjutkan.`);
}

/**
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
 * INI YANG JALAN SAAT KLIK "Sync Data" — satu sumber: kodepos.posindonesia.co.id.
 *
 * Server menarik SELURUH isi situs lewat pencarian wildcard `%` (terukur 2026-10-29:
 * 85.595 baris, 85.575 unik, 11.594 kode pos unik), lalu:
 * 1) tabel kerja kosong -> seluruh baris unik langsung disalin (sekali tekan beres);
 * 2) tabel kerja terisi -> sidik jari per provinsi dipakai untuk memastikan "sama
 *    persis" tanpa memindahkan puluhan ribu baris; bila berbeda, selisih tingkat
 *    baris dihitung dan dikembalikan sebagai daftar contoh untuk disalin.
 *
 * Situs ini tidak menyediakan titik koordinat. Titik yang sudah ada di tabel kerja
 * tidak diubah; baris baru bisa diberi titik lewat tindakan Titik Koordinat.
 */
export async function runKodePosLiveSync(
  onProgress?: SyncProgress,
  autoImport = true
): Promise<KodePosSyncPlan> {
  onProgress?.('Menarik seluruh kode pos dari kodepos.posindonesia.co.id...', 12);
  const json = await fetchJson('/api/kodepos-source?view=pos-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ import: autoImport }),
  });

  onProgress?.('Menyusun hasil pemeriksaan...', 95);
  const situs = json.situs || {};
  const db = json.db || {};
  const missing = json.missing || {};
  const rows: KodePosRow[] = Array.isArray(missing.rows) ? missing.rows : [];
  const provincesAffected: string[] = Array.isArray(missing.provinces) ? missing.provinces : [];
  const compareTotal = Number(situs.unik || 0);
  const dbRows = Number(db.baris || 0);
  const duplikat = Number(situs.duplikat || 0);
  const missingTotal = Number(missing.total || 0);

  const sourceDetail =
    `Sumber ${json.sumber || 'kodepos.posindonesia.co.id'}: ` +
    `${Number(situs.baris || 0).toLocaleString('id-ID')} baris dibaca, ` +
    `${compareTotal.toLocaleString('id-ID')} baris unik` +
    (duplikat > 0 ? ` (${duplikat.toLocaleString('id-ID')} duplikat identik di situs)` : '') +
    `, ${Number(situs.kodePosUnik || 0).toLocaleString('id-ID')} kode pos unik, ` +
    `${Number(situs.provinsi || 0)} provinsi / ${Number(situs.kota || 0)} kota-kabupaten / ` +
    `${Number(situs.kecamatan || 0)} kecamatan. ` +
    `Database: ${dbRows.toLocaleString('id-ID')} baris / ${Number(db.kodePosUnik || 0).toLocaleString('id-ID')} kode pos unik.`;

  onProgress?.('Selesai', 100);
  return {
    status: missingTotal > 0 || dbRows !== compareTotal ? 'DIFF' : 'SYNCED',
    localTotal: dbRows,
    cloudTotal: compareTotal,
    lastUpdated: situs.diambilPada ?? null,
    missingInCloud: rows,
    missingInLocal: [],
    cloudOnlyProvinces: [],
    diffProvinces: provincesAffected,
    sourceLabel: json.sumber || 'kodepos.posindonesia.co.id',
    compareUnit: 'baris',
    note: json.catatan,
    dbTotal: Number(db.kodePosUnik || 0),
    dbRows,
    compareTotal,
    barisDisalin: Number(json.barisDisalin || 0),
    compareLabel: 'situs resmi Pos Indonesia',
    sourceDetail,
    provincesAffected,
    importable: true,
    missingCodes: [],
    missingTotal,
    listTruncated: Boolean(missing.truncated),
  };
}

/**
 * Salin SEMUA baris situs Pos Indonesia yang belum ada di tabel kerja. Dipakai tombol
 * "Isi Semua" — server yang menarik situs dan menyalin per pecahan, jadi browser tidak
 * perlu membawa puluhan ribu baris.
 */
export async function importSemuaPos(
  onProgress?: SyncProgress
): Promise<{ masuk: number; totalSetelah: number; totalSitus: number; barisSitus: number; duplikatSitus: number }> {
  onProgress?.('Menarik seluruh kode pos dari kodepos.posindonesia.co.id...', 10);
  const json = await fetchJson('/api/kodepos-source?view=pos-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  onProgress?.('Selesai', 100);
  return {
    masuk: Number(json.masuk || 0),
    totalSetelah: Number(json.totalSetelah || 0),
    totalSitus: Number(json.totalSitus || 0),
    barisSitus: Number(json.barisSitus || 0),
    duplikatSitus: Number(json.duplikatSitus || 0),
  };
}

