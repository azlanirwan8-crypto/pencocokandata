#!/usr/bin/env node
/**
 * Ambil koordinat per desa/kelurahan dari kodepos.co.id lalu dorong ke Neon.
 *
 * Kenapa dari laptop: sumbernya 7.277 halaman kecamatan (±100 KB per halaman).
 * Dijalankan lewat fungsi Vercel akan makan ratusan panggilan; dari koneksi
 * rumahan selesai beberapa menit dengan concurrency 8.
 *
 * Cara pakai (dari folder proyek):
 *   node tools/crawl-koordinat.mjs --base https://match-sepia.vercel.app
 *
 * Opsional:
 *   --dry            hanya kumpulkan ke scratch/koordinat.csv, tidak mengirim
 *   --csv berkas     dorong isi berkas hasil --dry tanpa mengambil ulang halaman
 *   --concurrency 8  --batch 2000  --start 0  --limit 0
 *   --resume         lanjut dari index tersimpan di scratch/koordinat.state.json
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SITEMAP = 'https://kodepos.co.id/sitemaps/kecamatan.xml';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : '1';
};

const DRY = Boolean(arg('dry', ''));
const base = (arg('base', process.env.APP_BASE || '') || '').replace(/\/+$/, '');
if (!DRY && !/^https?:\/\//.test(base)) {
  console.error('Contoh: node tools/crawl-koordinat.mjs --base https://match-sepia.vercel.app');
  process.exit(1);
}
const CONCURRENCY = Math.max(1, Math.min(12, Number(arg('concurrency', 8))));
const BATCH = Math.max(200, Math.min(5000, Number(arg('batch', 2000))));
const LIMIT = Math.max(0, Number(arg('limit', 0)));
const STATE = path.resolve('scratch/koordinat.state.json');
const OUT = path.resolve('scratch/koordinat.csv');

/**
 * Satu-satunya daftar lengkap per halaman: payload Next.js di dalam self.__next_f.
 * Tabel HTML-nya dipotong 25 desa (terukur: 214 kecamatan kehilangan 2.865 desa).
 */
const DESA_RE =
  /"nama":"((?:[^"\\]|\\.)*)","slug":"[^"]*","kodePos":"(\d{5})","kodeKemendagri":"(\d{2}\.\d{2}\.\d{2}\.\d{4})","lat":(-?\d+(?:\.\d+)?),"lng":(-?\d+(?:\.\d+)?)(?:,"elevasi":(-?\d+(?:\.\d+)?))?/g;

function unescapePayload(html) {
  let teks = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      teks += JSON.parse(m[1]);
    } catch {
      /* chunk tidak lengkap — lewati */
    }
  }
  return teks;
}

function parsePage(html) {
  const rows = [];
  for (const m of unescapePayload(html).matchAll(DESA_RE)) {
    const lat = Number(m[4]);
    const lng = Number(m[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -11 || lat > 41 || lng < 89 || lng > 145) continue;
    const elev = Number(m[6]);
    rows.push({
      kode: m[3],
      kodePos: m[2],
      desa: JSON.parse(`"${m[1]}"`),
      lat,
      lng,
      elev: Number.isFinite(elev) ? Math.round(elev) : null,
    });
  }
  return rows;
}

async function getText(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === tries) throw err;
      await sleep(600 * i);
    }
  }
  return null;
}

async function postJson(url, body, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      return json;
    } catch (err) {
      if (i === tries) throw err;
      await sleep(1500 * i);
    }
  }
  return null;
}

async function main() {
  const started = Date.now();

  // Mode set ulang: dorong hasil crawl yang sudah tersimpan (--csv) tanpa mengambil ulang.
  const csvPath = arg('csv', '');
  if (csvPath) {
    const teks = (await readFile(path.resolve(csvPath), 'utf8')).split(/\r?\n/);
    const rows = [];
    for (const baris of teks) {
      const m = baris.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{4}),(\d{5}),"([^"]*)",(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d*)$/);
      if (!m) continue;
      rows.push({ kode: m[1], kodePos: m[2], desa: m[3], lat: Number(m[4]), lng: Number(m[5]), elev: m[6] === '' ? null : Number(m[6]) });
    }
    console.log(`${rows.length} baris koordinat dari ${csvPath}`);
    let masuk = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const json = await postJson(`${base}/api/kodepos-baseline?view=koordinat-ingest`, { rows: rows.slice(i, i + BATCH) });
      masuk += json?.masuk ?? 0;
      console.log(`  ${masuk} titik masuk`);
    }
    const r = await postJson(`${base}/api/kodepos-baseline?view=koordinat-salin`, {});
    console.log(`Salin ke tabel kerja: ${JSON.stringify(r)} · ${((Date.now() - started) / 1000).toFixed(1)} detik`);
    return;
  }

  console.log(`Ambil daftar URL kecamatan dari sitemap...`);
  const xml = await getText(SITEMAP);
  if (!xml) throw new Error('Sitemap tidak bisa diambil.');
  const urls = [...xml.matchAll(/<loc>\s*(https:\/\/kodepos\.co\.id\/kodepos\/[^<]+)\s*<\/loc>/g)].map(
    (m) => m[1]
  );
  console.log(`${urls.length} halaman kecamatan.`);

  let start = Math.max(0, Number(arg('start', 0)));
  if (arg('resume', '') && !start) {
    try {
      start = Number(JSON.parse(await readFile(STATE, 'utf8')).next || 0);
      console.log(`Lanjut dari index ${start}.`);
    } catch {
      /* belum ada state */
    }
  }
  const stop = LIMIT > 0 ? Math.min(urls.length, start + LIMIT) : urls.length;

  await mkdir(path.dirname(OUT), { recursive: true });
  const out = DRY ? createWriteStream(OUT, { flags: start ? 'a' : 'w' }) : null;
  if (out && !start) out.write('kode_wilayah,kode_pos,desa,latitude,longitude,elevasi\n');

  const pending = urls.slice(start, stop);
  let cursor = 0;
  let buffer = [];
  let sent = 0;
  let pages = 0;
  let empty = 0;
  let gagal = 0;
  const missingKode = new Set();
  const seen = new Set();

  const flush = async () => {
    if (!buffer.length) return;
    const rows = buffer;
    buffer = [];
    if (DRY) {
      for (const r of rows) out.write(`${r.kode},${r.kodePos},"${r.desa}",${r.lat},${r.lng},${r.elev ?? ''}\n`);
      sent += rows.length;
      return;
    }
    const json = await postJson(`${base}/api/kodepos-baseline?view=koordinat-ingest`, { rows });
    sent += json?._masuk ?? rows.length;
    console.log(
      `  terkirim ${sent} koordinat (baris cocok: ${json?.cocok ?? '-'}, total halaman selesai ${pages})`
    );
  };

  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= pending.length) return;
      const url = pending[i];
      try {
        const html = await getText(url);
        const rows = html ? parsePage(html) : [];
        if (!rows.length) {
          empty++;
          missingKode.add(url.split('/').slice(-3).join('/'));
        } else {
          pages++;
          for (const r of rows) {
            if (seen.has(r.kode)) continue;
            seen.add(r.kode);
            buffer.push(r);
          }
        }
      } catch (err) {
        gagal++;
        if (gagal <= 5) console.warn(`  gagal ${url}: ${err.message}`);
      }
      if (buffer.length >= BATCH) await flush();
      if ((i + 1) % 500 === 0) {
        console.log(
          `${i + 1}/${pending.length} halaman · ${seen.size} desa · ${((Date.now() - started) / 1000).toFixed(0)}s`
        );
        await writeFile(STATE, JSON.stringify({ next: start + i + 1, desa: seen.size }));
      }
      await sleep(40);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await flush();
  await writeFile(STATE, JSON.stringify({ next: stop, desa: seen.size, selesai: true }));
  out?.end();

  if (!DRY && seen.size) {
    const r = await postJson(`${base}/api/kodepos-baseline?view=koordinat-salin`, {});
    console.log(`Salin ke tabel kerja: ${JSON.stringify(r)}`);
  }

  const detik = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\nSelesai: ${pages} halaman menghasilkan koordinat, ${empty} halaman tanpa tabel, ${gagal} gagal.` +
      `\nTotal ${seen.size} desa unik dengan koordinat. ${detik} detik.`
  );
  if (empty) {
    console.log('Contoh kecamatan tanpa koordinat:');
    for (const k of [...missingKode].slice(0, 10)) console.log(`  ${k}`);
  }
  if (DRY) console.log(`CSV: ${OUT}`);
}

main().catch((err) => {
  console.error('Gagal:', err);
  process.exit(1);
});
