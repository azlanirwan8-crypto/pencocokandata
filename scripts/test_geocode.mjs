// Validasi offline logika "penempatan 100% real" pakai kodepos.csv asli.
// Menyalin algoritma resolveCityByGeocode dari src/utils/analystPipeline.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(__dirname, '..', 'kodepos.csv');

function splitLine(line, d) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === d) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur); return out.map((s) => s.trim());
}
const raw = fs.readFileSync(CSV, 'utf8').replace(/^/, '');
const lines = raw.split(/\r?\n/).filter(Boolean);
const header = splitLine(lines[0], ';');
const col = (n) => header.findIndex((h) => h.toLowerCase() === n.toLowerCase());
const iProv = col('Provinsi'), iKab = col('Kabupaten/Kota'), iKec = col('Kecamatan'), iDesa = col('Desa/Kelurahan'), iKp = col('Kode Pos');
const rows = [];
for (let n = 1; n < lines.length; n++) {
  const f = splitLine(lines[n], ';');
  const kodePos = (f[iKp] || '').replace(/\D/g, '').padStart(5, '0').slice(-5);
  if (!kodePos || kodePos === '00000') continue;
  rows.push({ kodePos, kelurahan: f[iDesa] || '', kecamatan: f[iKec] || '', kabupatenKota: f[iKab] || '', provinsi: f[iProv] || '' });
}
console.log(`Baris kodepos terbaca: ${rows.length.toLocaleString('id-ID')}`);

// ── port normalisasi ──
const ADMIN = new Set(['KOTA','KABUPATEN','KAB','KODYA','KOTAMADYA','ADMINISTRASI','ADM','DAERAH','KHUSUS','I','KECAMATAN','KEC','KELURAHAN','KEL','DESA','DUSUN','DUKUH']);
const THES = { KAB: 'KABUPATEN', 'KAB.': 'KABUPATEN', KODYA: 'KOTA', KEC: 'KECAMATAN', KEL: 'KELURAHAN', KEP: 'KEPULAUAN' };
const key = (s) => String(s || '').toUpperCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').map((w) => THES[w] || w).filter((w) => w && !ADMIN.has(w)).join(' ');
const jaro = (a, b) => {
  if (a === b) return 1; if (!a.length || !b.length) return 0;
  const W = Math.max(a.length, b.length), range = Math.max(Math.floor(W / 2) - 1, 0);
  const fa = new Array(a.length).fill(false), fb = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) for (let j = Math.max(0, i - range); j <= Math.min(b.length - 1, i + range); j++)
    if (!fb[j] && a[i] === b[j]) { fa[i] = fb[j] = true; m++; break; }
  if (!m) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) { if (!fa[i]) continue; while (!fb[k]) k++; if (a[i] !== b[k]) t++; k++; }
  const J = m / a.length + m / b.length + (m - t / 2) / m;
  return J / 3;
};
const jaccard = (a, b) => {
  const A = new Set(a.split(' ').filter(Boolean)), B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let i = 0; A.forEach((t) => { if (B.has(t)) i++; });
  return i / new Set([...A, ...B]).size;
};
// city-strict (versi ringkas: tanpa fonetik, konservatif)
const strictCityScore = (a, b) => {
  if (a === b && a.length) return 1;
  const j = jaro(a, b), jc = jaccard(a, b);
  const best = Math.max(j, jc);
  return best >= 0.9 && (jc >= 0.6 || j >= 0.93) ? best : 0.55 * jc + 0.45 * j;
};

// ── port algoritma ──
function build(len) {
  const byCity = new Map(), prof = new Map();
  rows.forEach((r) => {
    const ck = key(r.kabupatenKota); if (!ck) return;
    if (!byCity.has(ck)) byCity.set(ck, []); byCity.get(ck).push(r);
    if (!prof.has(ck)) prof.set(ck, { p4: new Set(), p3: new Set(), p2: new Set(), prefixes: new Set(), kecamatanSet: new Set() });
    const p = prof.get(ck);
    p.p4.add(r.kodePos.slice(0, 4)); p.p3.add(r.kodePos.slice(0, 3)); p.p2.add(r.kodePos.slice(0, 2));
    p.prefixes.add(r.kodePos.slice(0, len));
    const kc = key(r.kecamatan); if (kc) p.kecamatanSet.add(kc);
  });
  const byPrefix = new Map();
  prof.forEach((p, ck) => p.prefixes.forEach((pre) => { const a = byPrefix.get(pre) || []; if (!a.includes(ck)) a.push(ck); byPrefix.set(pre, a); }));
  return { byCity, prof, byPrefix };
}
function resolve(ptenKey, ptenKp, len, idx) {
  const { byCity, prof, byPrefix } = idx;
  const exact = byCity.get(ptenKey);
  if (exact && exact.length) {
    if (!ptenKp) return { ck: ptenKey, why: 'exact-no-code', n: exact.length, v: false };
    const p = prof.get(ptenKey);
    const ok = (ptenKp.length >= 4 && p.p4.has(ptenKp.slice(0, 4))) || (ptenKp.length >= 3 && p.p3.has(ptenKp.slice(0, 3))) || (ptenKp.length >= 2 && p.p2.has(ptenKp.slice(0, 2)));
    return { ck: ptenKey, why: ok ? 'exact+block-ok' : 'exact-BLOCK-MISMATCH', n: exact.length, v: ok };
  }
  const kp = String(ptenKp || '');
  if (kp.length < len) return { ck: null, why: 'no-code', n: 0, v: false };
  const p1 = kp.slice(0, len);
  const list = byPrefix.get(p1) || [];
  if (list.length) {
    for (const ck of list) if (strictCityScore(ptenKey, ck) >= 0.9) return { ck, why: `block+name(${p1})`, n: byCity.get(ck).length, v: true };
    const owners = list.filter((ck) => prof.get(ck).kecamatanSet.has(ptenKey));
    if (owners.length === 1) return { ck: owners[0], why: `block+kecamatan(${p1})`, n: byCity.get(owners[0]).length, v: true };
    if (list.length === 1 && prof.get(list[0]).prefixes.size <= 3) return { ck: list[0], why: `block-only-compact(${p1})`, n: byCity.get(list[0]).length, v: true };
    return { ck: null, why: `ambiguous(${list.length})`, n: 0, v: false };
  }
  const cand = [];
  prof.forEach((_, ck) => { const s = strictCityScore(ptenKey, ck); if (s >= 0.88) cand.push({ ck, s }); });
  cand.sort((a, b) => b.s - a.s);
  for (const c of cand) { const p = prof.get(c.ck); if (p.prefixes.size && !p.prefixes.has(p1)) continue; return { ck: c.ck, why: 'fuzzy+block-ok', n: byCity.get(c.ck).length, v: true }; }
  return { ck: null, why: 'no-block', n: 0, v: false };
}

// ── CHECK 1: seberapa diskriminatif blok kode pos? ──
for (const len of [2, 3, 4]) {
  const { byCity, byPrefix } = build(len);
  let blocks = 0, unique = 0;
  byPrefix.forEach((c) => { blocks++; if (c.length === 1) unique++; });
  const cityBlocks = [];
  byPrefix.forEach((c) => { if (c.length > 1) cityBlocks.push(c.length); });
  cityBlocks.sort((a, b) => b - a);
  console.log(`\n[len=${len}] blok=${blocks} owner-unik=${unique} (${(unique / blocks * 100).toFixed(1)}%) | blok multi-kota=${cityBlocks.length} max=${cityBlocks[0] || 0} | kota=${byCity.size}`);
}

// ── CHECK 2: kota bernama mirip yang BLOKNYA sama (rawan salah tempel) ──
{
  const len = 2, { byCity, prof, byPrefix } = build(len);
  const risky = [];
  byPrefix.forEach((cities, pre) => {
    for (let i = 0; i < cities.length; i++) for (let j = i + 1; j < cities.length; j++) {
      const a = cities[i], b = cities[j];
      const s = strictCityScore(a, b);
      if (s >= 0.75) risky.push({ pre, a, b, s: s.toFixed(3) });
    }
  });
  console.log(`\nCHECK 2 — pasangan kota seprovinsi yang namanya mirip (rawan salah tempel bila hanya andal nama): ${risky.length}`);
  risky.slice(0, 15).forEach((r) => console.log(`   blok ${r.pre}: "${r.a}" vs "${r.b}" (skor nama ${r.s})`));
  const overlap = risky.filter((r) => {
    const pa = [...prof.get(r.a).prefixes], pb = [...prof.get(r.b).prefixes];
    return pa.some((x) => pb.includes(x));
  });
  console.log(`   yang BLOK KODE POSNYA tumpang tindih: ${overlap.length}/${risky.length}`);
  overlap.slice(0, 10).forEach((r) => {
    const pa = [...prof.get(r.a).prefixes], pb = [...prof.get(r.b).prefixes];
    const shared = pa.filter((x) => pb.includes(x));
    console.log(`   !! "${r.a}" [${pa.join(',')}] vs "${r.b}" [${pb.join(',')}] shared=${shared.join(',')}`);
  });
}

// ── CHECK 3: uji kasus salah tempel klasik ──
console.log('\nCHECK 3 — studi kasus (nama kota PTEN + kode pos → kota yang dipilih):');
const cases = [
  ['TANGERANG SELATAN', '15110', 'harus Tangsel, bukan Kota Tangerang'],
  ['KOTA TANGERANG', '15110', 'kode pos 15xxx = Tangsel → harus ditolak/ambigiu'],
  ['JAKARTA PUSAT', '10110', 'master pakai "KOTA ADM JAKARTA PUSAT"'],
  ['BOGOR', '16110', 'Kota vs Kabupaten Bogor'],
  ['SLEMAN', '55281', 'Kabupaten'],
  ['MEDAN', '20112', ''],
  ['KEP SERIBU', '14510', ''],
  ['BANDAR LAMPUNG', '35110', ''],
  ['DEPOK', '16411', ''],
  ['TANGERANG SELATAN', '12345', 'kode pos Jakarta Pusat → harus REVIEW'],
];
for (const len of [2, 3]) {
  const idx = build(len);
  console.log(`  --- len=${len} ---`);
  cases.forEach(([nm, kp, note]) => {
    const r = resolve(key(nm), kp, len, idx);
    console.log(`   ${nm} + ${kp} → ${r.ck ? `"${r.ck}" (${r.n} kelurahan) [${r.why}]` : `TIDAK DITEMUKAN [${r.why}]`} ${note ? '// ' + note : ''}`);
  });
}

// ── CHECK 4: self-consistency master — setiap kota punya bloknya sendiri ──
{
  const len = 2, idx = build(len);
  let ok = 0, fail = 0; const fails = [];
  idx.byCity.forEach((entries, ck) => {
    const sample = entries[0];
    const r = resolve(ck, sample.kodePos, len, idx);
    if (r.ck === ck) ok++; else { fail++; if (fails.length < 8) fails.push(`${ck} (${r.why} → ${r.ck})`); }
  });
  console.log(`\nCHECK 4 — self-check ${idx.byCity.size} kota: tepat ${ok}, meleset ${fail}`);
  fails.forEach((f) => console.log('   ' + f));
}

// ── CHECK 5: berapa kelurahan tiap blok & risiko over-expand aturan 'block-only' ──
{
  const len = 2, { byCity, prof, byPrefix } = build(len);
  let onlyCompact = 0, rowsIfUsed = 0;
  byPrefix.forEach((cities, pre) => {
    if (cities.length === 1 && prof.get(cities[0]).prefixes.size <= 3) { onlyCompact++; rowsIfUsed += byCity.get(cities[0]).length; }
  });
  console.log(`\nCHECK 5 — blok 'kota tunggal kompak' = ${onlyCompact}, rata-rata ${(rowsIfUsed / Math.max(onlyCompact, 1)).toFixed(1)} kelurahan/blok`);
}

// ── CHECK 6: simulasi pipeline final — "kode pos kota mana yang benar" ──
{
  const idx4 = build(4), idx3 = build(3), idx2 = build(2);
  const resolveFinal = (k, kp) => {
    for (const [i, ix] of [idx4, idx3, idx2].entries()) {
      const pre = kp.slice(0, 4 - i);
      const exact = ix.byCity.get(k);
      if (exact && exact.length) {
        const p = ix.prof.get(k);
        const ok = (kp.length >= 4 && p.p4.has(kp.slice(0, 4))) || (kp.length >= 3 && p.p3.has(kp.slice(0, 3))) || (kp.length >= 2 && p.p2.has(kp.slice(0, 2)));
        return { ...resolve(k, kp, 4 - i, ix), tried: `blok${4 - i}` };
      }
      if ((ix.byPrefix.get(pre) || []).length) return { ...resolve(k, kp, 4 - i, ix), tried: `blok${4 - i}` };
    }
    return { ...resolve(k, kp, 3, idx3), tried: 'fuzzy' };
  };
  const cases = [
    ['KOTA TANGERANG', '15110', 'KAB TANGERANG punya blok sendiri → 15xxx harus MISMATCH'],
    ['TANGERANG SELATAN', '15110', 'benar'],
    ['OGAN KOMERING ULU', '32110', 'vs OKU TIMUR, skor nama 0,913'],
    ['OGAN KOMERING ULU TIMUR', '32110', ''],
    ['BOGOR', '16110', 'Kab Bogor 16xxx, Kota Bogor 161xx — cek ambiguitas'],
    ['KEP SERIBU', '14510', 'butuh fonetik/alias → kemungkinan REVIEW'],
    ['TANGERANG SELATAN', '12345', 'kode pos Jakarta Pusat → harus MISMATCH/REVIEW'],
    ['SLEMAN', '55281', ''],
    ['BANDA ACEH', '23111', ''],
    ['ACEH BARAT', '23111', 'blok 23 sama dgn Aceh Barat Daya'],
  ];
  console.log('\nCHECK 6 — studi kasus dengan algoritma final (cascade blok 4→3→2 + cek konsistensi):');
  cases.forEach(([nm, kp]) => {
    const r = resolveFinal(key(nm), kp);
    console.log(`   ${nm.padEnd(24)} + ${kp} → ${r.ck ? `"${r.ck}" (${r.n} kel) ${r.v ? 'VERIFIED' : 'REVIEW '}` : '(kosong) REVIEW '} [${r.why} | ${r.tried}]`);
  });

  // simulasi penuh: setiap kota master diwakili kode pos pertamanya
  let verified = 0, review = 0, rowsV = 0, rowsR = 0; const revs = [];
  idx2.byCity.forEach((entries, ck) => {
    const kp = entries[0].kodePos;
    const r = resolveFinal(ck, kp);
    if (r.ck === ck && r.v) { verified++; rowsV += entries.length; }
    else { review++; rowsR += entries.length; if (revs.length < 10) revs.push(`${ck} ${kp} → ${r.ck || '-'} [${r.why}]`); }
  });
  console.log(`\nCHECK 7 — simulasi 488 kota master: VERIFIED ${verified} kota (${rowsV.toLocaleString('id-ID')} kelurahan), REVIEW ${review} kota (${rowsR.toLocaleString('id-ID')} kelurahan)`);
  revs.forEach((r) => console.log('   ' + r));
}

// ── CHECK 8: token alias kota yang belum ada di thesaurus ──
{
  const idx = build(2);
  const alias = {};
  idx.byCity.forEach((entries, ck) => {
    const first = ck.split(' ')[0];
    if (['KEP','KEPULAUAN','NAD','DIY','D.I'].includes(first)) alias[first] = (alias[first] || 0) + 1;
  });
  console.log('\nCHECK 8 — prefix token kota yang perlu alias:', JSON.stringify(alias));
  const kep = [...idx.byCity.keys()].filter((k) => k.startsWith('KEP '));
  console.log('   contoh:', kep.join(' | '));
}

// ── CHECK 9: anomali master (kota cuma 1 kelurahan / kota duplikat nama) ──
{
  const idx = build(2);
  const tiny = []; idx.byCity.forEach((e, ck) => { if (e.length === 1) tiny.push(`${ck}(${e[0].kodePos})`); });
  console.log(`\nCHECK 9 — kota dengan HANYA 1 kelurahan di master: ${tiny.length}`);
  console.log('   ', tiny.slice(0, 25).join(', '));
  const provOf = new Map(); idx.byCity.forEach((e, ck) => provOf.set(ck, e[0].provinsi));
  const multiProv = [...idx.byCity.keys()].filter((ck) => {
    const ps = new Set(rows.filter((r) => key(r.kabupatenKota) === ck).map((r) => r.provinsi));
    return ps.size > 1;
  });
  console.log(`   kota yang barisnya横跨 >1 provinsi (inkonsistensi master): ${multiProv.length}`);
  multiProv.slice(0, 10).forEach((c) => console.log('     ' + c));
}

// ── CHECK 10: kasus nama kota lintas provinsi + alias thesaurus ──
{
  const idx = build(2);
  const provByCity = new Map();
  rows.forEach((r) => { const ck = key(r.kabupatenKota); if (!provByCity.has(ck)) provByCity.set(ck, new Set()); provByCity.get(ck).add(r.provinsi); });
  const cross = [...provByCity.entries()].filter(([, ps]) => ps.size > 1).map(([ck]) => ck);
  console.log(`\nCHECK 10 — nama kota milik >1 provinsi: ${cross.length} → ${cross.join(', ')}`);
  cross.forEach((ck) => {
    const groups = new Map();
    idx.byCity.get(ck).forEach((r) => { const p = r.kodePos.slice(0, 2); groups.set(p, (groups.get(p) || 0) + 1); });
    console.log(`   "${ck}": ${[...groups.entries()].map(([p, n]) => `${p}xxx=${n}kel`).join(' + ')}`);
    // simulasi penyaringan by PTEN kode pos
    for (const [pre] of groups) {
      const kp = pre + '111';
      const same = idx.byCity.get(ck).filter((r) => r.kodePos.slice(0, 2) === kp.slice(0, 2));
      console.log(`      PTEN "${ck}" + ${kp} → dipertahankan ${same.length}/${idx.byCity.get(ck).length} kelurahan, provinsi=${[...new Set(same.map((s) => s.provinsi))].join('/')}`);
    }
  });
  console.log('   alias: "KEP SERIBU" → key', key('KEP SERIBU'), '| "KEP SIAU" →', key('KEP SIAU'), '| ada di master:', idx.byCity.has(key('KEP SERIBU')), idx.byCity.has(key('KEP SIAU')));
}
