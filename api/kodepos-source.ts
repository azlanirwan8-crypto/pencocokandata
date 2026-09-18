import { neon } from '@neondatabase/serverless';

/**
 * /api/kodepos-source — audit database kode pos terhadap sumber eksternal.
 *
 * GET ?view=audit  → unduh dataset referensi, bandingkan dengan tabel kodepos_data,
 *                    balas baris yang belum ada di database + ringkasan.
 *
 * Sumber: teguh02/Wilayah-Indonesia-Beserta-Kode-Pos, CSV/full.csv
 * (postal_id, subdis_id, dis_id, city_id, prov_id, postal_code,
 *  subdis_name, dis_name, city_name, prov_name)
 *
 * Perbandingan dilakukan pada LEVEL KODE POS. Di level kelurahan dataset ini
 * berbeda vintage/penamaan (37 ribu baris "beda" yang bukan data baru), jadi
 * itu tidak dipakai sebagai daftar import.
 */

export const maxDuration = 60;

const SOURCE_URL =
  'https://raw.githubusercontent.com/teguh02/Wilayah-Indonesia-Beserta-Kode-Pos/main/CSV/full.csv';
const SOURCE_LABEL = 'teguh02/Wilayah-Indonesia-Beserta-Kode-Pos (CSV/full.csv)';
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

let cache: { at: number; rows: SourceRow[]; skipped: number } | null = null;

const norm = (v: string) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

/** Nama wilayah kadang mengandung koma: 6 field pertama numerik, 4 nama dari belakang. */
function parseCsv(text: string): { rows: SourceRow[]; skipped: number } {
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

async function loadSource() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Sumber eksternal menolak (HTTP ${res.status}).`);
  const parsed = parseCsv(await res.text());
  cache = { at: Date.now(), rows: parsed.rows, skipped: parsed.skipped };
  return cache;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL;

  if (!connectionString) {
    return res.status(200).json({ ok: false, configured: false, message: 'DATABASE_URL Neon belum terpasang.' });
  }

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.searchParams.get('view') !== 'audit') {
      return res.status(400).json({ ok: false, error: 'Gunakan ?view=audit' });
    }

    const [source, dbRes] = await Promise.all([
      loadSource(),
      neon(connectionString)`SELECT DISTINCT upper(btrim(kode_pos)) AS kode_pos FROM kodepos_data;`,
    ]);

    const dbCodes = new Set<string>((dbRes as any[]).map((r) => String(r.kode_pos).trim()));
    const sourceCodes = new Set<string>(source.rows.map((r) => norm(r.kodePos)));

    // Kode pos yang dikenal sumber tapi belum ada di database -> kandidat import
    const newCodes = new Set<string>();
    for (const row of source.rows) {
      const code = norm(row.kodePos);
      if (!dbCodes.has(code)) newCodes.add(code);
    }
    const onlyInSource: SourceRow[] = [];
    for (const row of source.rows) {
      if (!newCodes.has(norm(row.kodePos))) continue;
      if (onlyInSource.length >= ROW_CAP) break;
      onlyInSource.push(row);
    }

    // Kode pos di database yang tidak dikenal sumber (informasi, tidak dihapus)
    const onlyInDbCodes: string[] = [];
    let codesOnlyInDbTotal = 0;
    for (const code of dbCodes) {
      if (sourceCodes.has(code)) continue;
      codesOnlyInDbTotal++;
      if (onlyInDbCodes.length < 200) onlyInDbCodes.push(code);
    }

    return res.status(200).json({
      ok: true,
      configured: true,
      source: {
        label: SOURCE_LABEL,
        url: SOURCE_URL,
        total: source.rows.length,
        distinctCodes: sourceCodes.size,
        unparsable: source.skipped,
        cachedAt: new Date(cache!.at).toISOString(),
      },
      db: { distinctCodes: dbCodes.size },
      newCodes: [...newCodes].sort(),
      onlyInSource,
      onlyInSourceTruncated: onlyInSource.length >= ROW_CAP,
      codesOnlyInDb: { total: codesOnlyInDbTotal, sample: onlyInDbCodes },
      cap: ROW_CAP,
    });
  } catch (error: any) {
    console.error('Kodepos source audit error:', error);
    return res.status(500).json({ ok: false, configured: true, error: error?.message || 'Audit sumber eksternal gagal.' });
  }
}
