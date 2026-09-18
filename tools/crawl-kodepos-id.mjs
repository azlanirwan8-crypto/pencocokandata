#!/usr/bin/env node
/**
 * Ambil seluruh kode pos dari kodepos.id lalu dorong ke tabel patokan (kodepos_baseline)
 * di Neon lewat /api/kodepos-id?view=ingest.
 *
 * Kenapa harus dari laptop: kodepos.id memakai Cloudflare yang menolak IP datacenter,
 * jadi fungsi Vercel dibalas 403 sementara koneksi rumahan normal (200).
 *
 * Cara pakai (dari folder proyek, setelah `npm install` tidak diperlukan):
 *   node tools/crawl-kodepos-id.mjs --base https://nama-app.vercel.app
 *
 * Opsional: --concurrency 6  --batch 2000  --provinsi bali,jawa-barat
 */
import { setTimeout as sleep } from 'node:timers/promises';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const SITE = 'https://kodepos.id';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const base = (arg('base', process.env.APP_BASE || '') || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('Contoh: node tools/crawl-kodepos-id.mjs --base https://nama-app.vercel.app');
  process.exit(1);
}
const CONCURRENCY = Math.max(1, Number(arg('concurrency', 6)));
const BATCH = Math.max(100, Math.min(5000, Number(arg('batch', 2000))));
const ONLY = arg('provinsi', '').split(',').map((s) => s.trim()).filter(Boolean);

const clean = (v) =>
  v.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&#0?39;|&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();

function parseRows(html) {
  const out = [];
  for (const tr of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => clean(c[1]));
    if (cells.length < 5) continue;
    const [provinsi, kabupaten, kecamatan, kelurahan, kodePos] = cells.slice(-5);
    if (!/^\d{5}$/.test(kodePos) || !kelurahan || !provinsi) continue;
    out.push({ kodePos, kelurahan, kecamatan, kabupatenKota: kabupaten, provinsi });
  }
  return out;
}

function parseProvinces(html) {
  const skip = new Set(['cari', 'jalan', 'gang', 'pencarian', 'index', 'kodepos1', 'about', 'kontak',
    'tentang-kami', 'privacy-policy', 'syarat-kebijakan-privasi', 'sitemap']);
  const found = new Set();
  for (const m of html.matchAll(/href=["']https?:\/\/kodepos\.id\/([a-z][a-z-]+)\/?["']/gi)) {
    const slug = m[1].toLowerCase();
    if (!skip.has(slug)) found.add(slug);
  }
  return [...found].sort();
}

async function getHtml(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
      if (res.status === 403) throw new Error('Ditolak Cloudflare (403). Jalankan dari koneksi rumah/kantor, bukan dari server.');
      if (res.ok) return await res.text();
    } catch (err) {
      if (i === tries - 1) throw err;
      if (/403/.test(String(err.message))) throw err;
    }
    await sleep(400 * (i + 1));
  }
  return '';
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(new Array(Math.min(limit, items.length || 1)).fill(0).map(async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

async function postRows(rows, versi) {
  const res = await fetch(`${base}/api/kodepos-id?view=ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, versi }),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* bukan JSON */ }
  if (!res.ok || !json?.ok) {
    throw new Error(`${base}/api/kodepos-id menolak (HTTP ${res.status}): ${json?.error || text.slice(0, 160)}`);
  }
  return json;
}

const provinces = ONLY.length ? ONLY : parseProvinces(await getHtml(SITE));
if (provinces.length === 0) throw new Error('Tidak ada provinsi terbaca dari kodepos.id.');
console.log(`kodepos.id: ${provinces.length} provinsi, paralel ${CONCURRENCY}, kirim per ${BATCH} baris`);

let buffer = [];
let total = 0;
let versi;

async function flush(force = false) {
  while (buffer.length >= BATCH || (force && buffer.length)) {
    const part = buffer.splice(0, BATCH);
    const res = await postRows(part, versi);
    versi = res.versi;
    console.log(`  terkirim ${part.length} baris (versi ${res.versi}, ${total.toLocaleString('id-ID')} baris diproses sumber)`);
  }
}

for (const provinsi of provinces) {
  let page = 1;
  let rows = 0;
  let blanks = 0;
  while (page < 5000) {
    const pages = [];
    for (let i = 0; i < CONCURRENCY; i++) pages.push(page + i);
    const results = await mapLimit(pages, CONCURRENCY, async (p) => {
      try { return parseRows(await getHtml(`${SITE}/${provinsi}?page=${p}`, 2)); } catch { return []; }
    });
    let hit = 0;
    for (const r of results) {
      hit += r.length;
      for (const row of r) buffer.push(row);
    }
    total += hit;
    rows += hit;
    if (hit === 0) {
      blanks++;
      if (blanks >= 2) break;
    } else blanks = 0;
    page += CONCURRENCY;
    await flush();
  }
  console.log(`${provinsi}: ${rows.toLocaleString('id-ID')} baris`);
}

await flush(true);
console.log(`\nSelesai. ${total.toLocaleString('id-ID')} baris dibaca, patokan versi ${versi} siap dipakai Sync Data.`);
