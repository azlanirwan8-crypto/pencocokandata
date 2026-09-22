import { buatSql, ambilUrlDb } from '../server/sql';

/**
 * /api/kodepos-source — audit database kode pos terhadap sumber eksternal.
 *
 * GET ?view=audit&source=resmi|komunitas
 *
 * source=resmi (default)
 *   cahyadsn/wilayah_kodepos, db/wilayah_kodepos.sql: kode wilayah level-4
 *   (desa/kelurahan) menurut Kepmendagri No 300.2.2-2138 Tahun 2025 dipasangkan
 *   dengan daftar kode pos Pos Indonesia (src/pos-data.csv pada repo yang sama).
 *   83.762 desa/kelurahan. File ini tidak memuat nama wilayah, jadi hasilnya
 *   daftar kode pos + kode wilayah untuk memeriksa kelengkapan - bukan bahan impor.
 *
 * source=komunitas
 *   teguh02/Wilayah-Indonesia-Beserta-Kode-Pos, CSV/full.csv (asal data: repo
 *   komunitas edwin/database-kodepos-seluruh-indonesia). 81.248 baris lengkap
 *   dengan nama wilayah sehingga bisa diimpor, tetapi bukan sumber resmi dan
 *   penamaan wilayahnya beda vintage dengan database kita.
 *
 * Perbandingan selalu di LEVEL KODE POS. Di level kelurahan dataset komunitas
 * menghasilkan puluhan ribu "beda" yang hanya beda penamaan, bukan data baru.
 */

export const maxDuration = 60;

const OFFICIAL_URL = 'https://raw.githubusercontent.com/cahyadsn/wilayah_kodepos/main/db/wilayah_kodepos.sql';
const OFFICIAL_LABEL = 'cahyadsn/wilayah_kodepos - kode wilayah Kepmendagri 300.2.2-2138/2025 + daftar kode pos Pos Indonesia';
const COMMUNITY_URL = 'https://raw.githubusercontent.com/teguh02/Wilayah-Indonesia-Beserta-Kode-Pos/main/CSV/full.csv';
const COMMUNITY_LABEL = 'teguh02/Wilayah-Indonesia-Beserta-Kode-Pos - dataset komunitas (bukan resmi)';

const ROW_CAP = 5000;
const CACHE_MS = 10 * 60 * 1000;

interface SourceRow {
  kodePos: string;
  kelurahan: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi: string;
  status: string;
}

/** Pasangan resmi: kode wilayah level-4 -> kode pos. */
interface OfficialRow {
  kode: string;
  kodePos: string;
}

let officialStore: { at: number; rows: OfficialRow[] } | null = null;
let communityStore: { at: number; rows: SourceRow[]; skipped: number } | null = null;

const norm = (v: string) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

/** Baris dump: ('11.01.01.2001', '23773'), */
function parseOfficial(text: string): OfficialRow[] {
  const out: OfficialRow[] = [];
  const re = /\('(\d{2}\.\d{2}\.\d{2}\.\d{4})',\s*'(\d{5})'\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ kode: m[1], kodePos: m[2] });
  return out;
}

/** Nama wilayah kadang mengandung koma: 6 field pertama numerik, 4 nama dari belakang. */
function parseCommunity(text: string): { rows: SourceRow[]; skipped: number } {
  const rows: SourceRow[] = [];
  let skipped = 0;
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const f = line.split(',');
    if (f.length < 10) {
      skipped++;
      continue;
    }
    const provinsi = f[f.length - 1];
    const kota = f[f.length - 2];
    const kec = f[f.length - 3];
    const kel = f.slice(6, f.length - 3).join(',');
    const kodePos = f[5].trim();
    if (!/^\d{5}$/.test(kodePos) || !kel.trim()) {
      skipped++;
      continue;
    }
    rows.push({
      kodePos,
      kelurahan: kel.trim(),
      kecamatan: kec.trim(),
      kabupatenKota: kota.trim(),
      provinsi: provinsi.trim(),
      status: 'AKTIF',
    });
  }
  return { rows, skipped };
}

async function loadOfficial() {
  if (officialStore && Date.now() - officialStore.at < CACHE_MS) return officialStore;
  const res = await fetch(OFFICIAL_URL);
  if (!res.ok) throw new Error(`Sumber resmi menolak (HTTP ${res.status}).`);
  officialStore = { at: Date.now(), rows: parseOfficial(await res.text()) };
  return officialStore;
}

async function loadCommunity() {
  if (communityStore && Date.now() - communityStore.at < CACHE_MS) return communityStore;
  const res = await fetch(COMMUNITY_URL);
  if (!res.ok) throw new Error(`Sumber komunitas menolak (HTTP ${res.status}).`);
  const parsed = parseCommunity(await res.text());
  communityStore = { at: Date.now(), rows: parsed.rows, skipped: parsed.skipped };
  return communityStore;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const connectionString = ambilUrlDb();

  if (!connectionString) {
    return res.status(200).json({ ok: false, configured: false, message: 'DATABASE_URL (Supabase Postgres) belum terpasang.' });
  }

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.searchParams.get('view') !== 'audit') {
      return res.status(400).json({ ok: false, error: 'Gunakan ?view=audit&source=resmi|komunitas' });
    }
    const sourceKey = url.searchParams.get('source') === 'komunitas' ? 'komunitas' : 'resmi';

    const [src, dbRes] = await Promise.all([
      sourceKey === 'resmi' ? loadOfficial() : loadCommunity(),
      buatSql(connectionString)`SELECT DISTINCT upper(btrim(kode_pos)) AS kode_pos FROM kodepos_data;`,
    ]);
    const dbCodes = new Set<string>((dbRes as any[]).map((r) => String(r.kode_pos).trim()));

    if (sourceKey === 'resmi') {
      const rows = (src as { rows: OfficialRow[] }).rows;
      const officialCodes = new Set<string>(rows.map((r) => norm(r.kodePos)));

      const missingCodes: OfficialRow[] = [];
      const seen = new Set<string>();
      for (const r of rows) {
        const code = norm(r.kodePos);
        if (dbCodes.has(code) || seen.has(code)) continue;
        seen.add(code);
        if (missingCodes.length < ROW_CAP) missingCodes.push(r);
      }
      let codesOnlyInDb = 0;
      for (const code of dbCodes) if (!officialCodes.has(code)) codesOnlyInDb++;
      // 2 digit pertama kode wilayah = kode provinsi (Kepmendagri)
      const provCodes = Array.from(new Set(missingCodes.map((r) => r.kode.slice(0, 2)))).sort();

      return res.status(200).json({
        ok: true,
        configured: true,
        importable: false,
        source: {
          key: 'resmi',
          label: OFFICIAL_LABEL,
          url: OFFICIAL_URL,
          total: rows.length,
          distinctCodes: officialCodes.size,
          cachedAt: new Date((officialStore as { at: number }).at).toISOString(),
        },
        db: { distinctCodes: dbCodes.size },
        missingCodes,
        missingCodesTotal: seen.size,
        provincesAffected: provCodes,
        codesOnlyInDb,
        note:
          'Sumber resmi hanya memuat kode wilayah + kode pos (tanpa nama kelurahan), jadi hasilnya untuk ' +
          'memeriksa kelengkapan. Untuk mengisi barisnya secara lengkap, impor dari berkas master yang bernama.',
      });
    }

    const rows = (src as { rows: SourceRow[] }).rows;
    const sourceCodes = new Set<string>(rows.map((r) => norm(r.kodePos)));

    // Kode pos yang dikenal sumber tapi belum ada di database -> kandidat import
    const newCodes = new Set<string>();
    for (const row of rows) {
      const code = norm(row.kodePos);
      if (!dbCodes.has(code)) newCodes.add(code);
    }
    const onlyInSource: SourceRow[] = [];
    for (const row of rows) {
      if (!newCodes.has(norm(row.kodePos))) continue;
      if (onlyInSource.length >= ROW_CAP) break;
      onlyInSource.push(row);
    }
    let codesOnlyInDb = 0;
    for (const code of dbCodes) if (!sourceCodes.has(code)) codesOnlyInDb++;

    return res.status(200).json({
      ok: true,
      configured: true,
      importable: true,
      source: {
        key: 'komunitas',
        label: COMMUNITY_LABEL,
        url: COMMUNITY_URL,
        total: rows.length,
        distinctCodes: sourceCodes.size,
        cachedAt: new Date((communityStore as { at: number }).at).toISOString(),
      },
      db: { distinctCodes: dbCodes.size },
      newCodes: [...newCodes].sort(),
      onlyInSource,
      onlyInSourceTruncated: onlyInSource.length >= ROW_CAP,
      codesOnlyInDb,
      cap: ROW_CAP,
    });
  } catch (error: any) {
    console.error('Kodepos source audit error:', error);
    return res.status(500).json({ ok: false, configured: true, error: error?.message || 'Audit sumber eksternal gagal.' });
  }
}
