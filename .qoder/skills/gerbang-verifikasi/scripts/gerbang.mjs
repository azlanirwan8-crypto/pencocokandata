#!/usr/bin/env node
/**
 * Gerbang verifikasi proyek pencocokandata — satu-satunya urutan yang sah sebelum
 * melaporkan pekerjaan selesai. Dicetak ringkas supaya aman untuk konteks agen:
 * satu baris per langkah, detail hanya untuk langkah yang gagal.
 *
 * Jalankan dari mana saja:  node .qoder/skills/gerbang-verifikasi/scripts/gerbang.mjs
 * Flag:                      --hanya=tes,tsc   --oksidise=56   --rinci
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const argv = process.argv.slice(2);
const flag = (nama) => argv.find((a) => a.startsWith(`--${nama}=`))?.split('=')[1];
const RINCI = argv.includes('--rinci');

// Node tidak ada di PATH Git Bash di mesin ini; ia dipasang portabel di C:\tools\node.
const ENV = { ...process.env, PATH: `C:\\tools\\node;${process.env.PATH || ''}` };

const jalan = (perintah, args) => {
  const r = spawnSync(perintah, args, { cwd: ROOT, env: ENV, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  // stdout dan stderr TIDAK digabung: test yang sah menulis hasil ke stdout dan
  // catatan (mis. `LEWAT …`) ke stderr, jadi menggabungkannya membuat penilaian
  // 'baris terakhir' salah — ia membaca stderr sebagai kesimpulan.
  return { keluar: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
};

const potong = (teks, n = 24) => {
  const baris = teks.split('\n').map((b) => b.trimEnd()).filter(Boolean);
  if (baris.length <= n) return baris.join('\n');
  return `${baris.slice(0, n).join('\n')}\n   … +${baris.length - n} baris lagi (pakai --rinci)`;
};

const hasil = [];
const catat = (nama, ok, pesan = '', detail = '') => {
  hasil.push({ nama, ok, pesan, detail });
  console.log(`${ok ? 'LULUS ' : 'GAGAL'} ${nama}${pesan ? ' — ' : ''}${pesan}`);
  if (!ok && detail) console.log(potong(detail).split('\n').map((b) => `   ${b}`).join('\n'));
  else if (RINCI && detail) console.log(potong(detail).split('\n').map((b) => `   ${b}`).join('\n'));
};

const mau = (nama) => {
  const hanya = flag('hanya');
  return !hanya || hanya.split(',').includes(nama);
};

process.chdir(ROOT);

// 1 — Tipe. `tsc --noEmit -p tsconfig.json` di sini no-op (project references),
// jadi `-b` wajib; tanpa itu langkah ini terasa lulus padahal tidak memeriksa apa pun.
if (mau('tsc')) {
  const t0 = Date.now();
  const r = jalan('npx', ['tsc', '-b']);
  catat('tsc -b', r.keluar === 0, `${((Date.now() - t0) / 1000).toFixed(1)} s`, `${r.stdout}${r.stderr}`);
}

// 2 — Berkas uji. Bundle SSR harus dibangun ulang sebelum test jalan, kalau tidak
// yang teruji adalah kode lama.
if (mau('tes')) {
  const b = jalan('npx', ['vite', 'build', '--ssr', 'tests/entry-uji.ts', '--outDir', 'tests/out']);
  if (b.keluar !== 0) catat('build bundle uji', false, '', `${b.stdout}${b.stderr}`);
  else {
    catat('build bundle uji', true, 'tests/out/entry-uji.js');
    const berkas = readdirSync(path.join(ROOT, 'tests')).filter((f) => /^uji-.*\.mjs$/.test(f)).sort();
    if (berkas.length === 0) catat('test', false, 'tidak ada tests/uji-*.mjs');
    const lewat = [];
    let lulus = 0;
    for (const f of berkas) {
      const t0 = Date.now();
      const r = jalan('node', [`tests/${f}`]);
      // Dianggap lulus hanya kalau prosesnya bersih DAN stdout-nya menutup dengan
      // 'SEMUA LULUS' tanpa satu pun baris 'GAGAL '.
      const adaGagal = /^\s*GAGAL\b/m.test(r.stdout);
      const ok = r.keluar === 0 && !adaGagal && /SEMUA LULUS\s*$/.test(r.stdout.trim());
      for (const barisLewat of r.stdout.match(/^\s*LEWAT .*$/gm) || []) lewat.push(`${f}:${barisLewat.trim().replace(/\s+/g, ' ')}`);
      catat(`test ${f}`, ok, `${((Date.now() - t0) / 1000).toFixed(1)} s`, r.stdout);
      if (ok) lulus++;
    }
    if (berkas.length) console.log(`   ${lulus}/${berkas.length} berkas test lulus`);
    if (lewat.length) console.log(`   YANG TIDAK DIUKUR (${lewat.length}):\n${lewat.map((l) => `     ${l}`).join('\n')}`);
  }
}

// 3 — Lint. Yang dijaga adalah BASELINE, bukan nol: kode lama sudah punya
// sejumlah peringatan, dan naik satu pun itu regresi.
if (mau('lint')) {
  const BATAS = Number(flag('oksidise') ?? 56);
  const r = jalan('npx', ['oxlint']);
  const teks = `${r.stdout}${r.stderr}`;
  const m = /Found (\d+) warnings? and (\d+) errors?/.exec(teks);
  if (!m) catat('oxlint', false, 'keluaran tidak dikenali', teks);
  else {
    const [, w, e] = m.map(Number);
    const ok = e === 0 && w <= BATAS;
    catat('oxlint', ok, `${w} peringatan (batas ${BATAS}), ${e} error${w < BATAS ? ' · baseline boleh diturunkan ke ' + w : ''}`, teks);
  }
}

// 4 — Build produksi.
if (mau('build')) {
  const t0 = Date.now();
  const r = jalan('npx', ['vite', 'build']);
  const teks = `${r.stdout}${r.stderr}`;
  const ok = r.keluar === 0 && !/error during build/i.test(teks);
  catat('vite build', ok, `${((Date.now() - t0) / 1000).toFixed(1)} s`, teks);
}

const gagal = hasil.filter((h) => !h.ok);
console.log('─'.repeat(56));
if (gagal.length === 0) {
  console.log(`GERBANG LULUS — ${hasil.length} langkah, 0 gagal`);
  process.exit(0);
}
console.log(`GERBANG GAGAL — ${gagal.length} dari ${hasil.length} langkah: ${gagal.map((g) => g.nama).join(', ')}`);
process.exit(1);
