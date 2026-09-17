// Import kodepos.csv -> Neon Postgres (table: kodepos_data)
//
// Dry-run (default, tanpa DB):
//   node scripts/import_kodepos.mjs
// Push ke DB (butuh connection string Neon):
//   DATABASE_URL="postgres://..." node scripts/import_kodepos.mjs --push
//   node scripts/import_kodepos.mjs --push "postgres://..."
//
// File: kodepos.csv (delimiter ';', kolom: No;Kode Wilayah;Provinsi;
//       Kabupaten/Kota;Kecamatan;Desa/Kelurahan;Kode Pos;Alamat Lengkap)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, '..', 'kodepos.csv');

const args = process.argv.slice(2);
const PUSH = args.includes('--push');
const connFromArg = args.find((a) => a.startsWith('postgres'));
const CONNECTION = connFromArg || process.env.DATABASE_URL || process.env.POSTGRES_URL;

// Quote-aware CSV line splitter for a single-char delimiter
function splitLine(line, delim) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv() {
  let raw = fs.readFileSync(CSV_PATH, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // strip BOM
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitLine(lines[0], ';');
  const col = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const iProv = col('Provinsi');
  const iKab = col('Kabupaten/Kota');
  const iKec = col('Kecamatan');
  const iDesa = col('Desa/Kelurahan');
  const iKp = col('Kode Pos');

  if (iKp === -1) throw new Error(`Kolom 'Kode Pos' tidak ditemukan. Header: ${header.join(' | ')}`);

  const records = [];
  let skipped = 0;
  for (let n = 1; n < lines.length; n++) {
    const f = splitLine(lines[n], ';');
    const kodePos = (f[iKp] || '').replace(/\D/g, '').padStart(5, '0').slice(-5);
    const kelurahan = f[iDesa] || '';
    const kecamatan = f[iKec] || '';
    const kabupatenKota = f[iKab] || '';
    const provinsi = f[iProv] || '';
    if (!kodePos || kodePos === '00000' || (!kelurahan && !kecamatan)) { skipped++; continue; }
    records.push({ kodePos, kelurahan, kecamatan, kabupatenKota, provinsi, status: 'AKTIF' });
  }
  return { header, records, skipped, totalLines: lines.length - 1 };
}

async function pushToNeon(records) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(CONNECTION);

  await sql`
    CREATE TABLE IF NOT EXISTS kodepos_data (
      id             SERIAL PRIMARY KEY,
      kode_pos       VARCHAR(10)  NOT NULL,
      kelurahan      TEXT,
      kecamatan      TEXT,
      kabupaten_kota TEXT,
      provinsi       TEXT,
      status         VARCHAR(20)  DEFAULT 'AKTIF',
      created_at     TIMESTAMPTZ  DEFAULT NOW(),
      updated_at     TIMESTAMPTZ  DEFAULT NOW()
    );
  `;

  console.log('TRUNCATE kodepos_data (mode replace)...');
  await sql`TRUNCATE TABLE kodepos_data RESTART IDENTITY;`;

  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const placeholders = [];
    const values = [];
    batch.forEach((r, j) => {
      const b = j * 6;
      placeholders.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`);
      values.push(r.kodePos, r.kelurahan, r.kecamatan, r.kabupatenKota, r.provinsi, r.status);
    });
    await sql.query(
      `INSERT INTO kodepos_data (kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status)
       VALUES ${placeholders.join(',')};`,
      values
    );
    done += batch.length;
    process.stdout.write(`\r  inserted ${done.toLocaleString('id-ID')} / ${records.length.toLocaleString('id-ID')}`);
  }
  process.stdout.write('\n');

  const cnt = await sql`SELECT COUNT(*)::int AS c FROM kodepos_data;`;
  console.log(`Selesai. Total baris di kodepos_data: ${cnt[0].c.toLocaleString('id-ID')}`);
}

const { header, records, skipped, totalLines } = parseCsv();
console.log('Header  :', header.join(' | '));
console.log('Baris   :', totalLines.toLocaleString('id-ID'));
console.log('Valid   :', records.length.toLocaleString('id-ID'));
console.log('Skipped :', skipped.toLocaleString('id-ID'));
console.log('Sampel  :', JSON.stringify(records.slice(0, 3), null, 2));

if (!PUSH) {
  console.log('\n[DRY-RUN] Tidak ada koneksi ke DB. Jalankan dengan --push untuk menyimpan ke Neon.');
  process.exit(0);
}

if (!CONNECTION) {
  console.error('\n[ERROR] --push butuh connection string. Set DATABASE_URL atau berikan sebagai argumen.');
  process.exit(1);
}

await pushToNeon(records);
