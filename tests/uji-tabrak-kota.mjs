// Tabrakan nama kota: berkas PTEN vs Master Kode Pos.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-tabrak-kota.mjs
//
// Semua nama dan blok di fixture ini NYATA, diambil dari /api/pten dan /api/kodepos
// di match-sepia.vercel.app, 2026-09-24.
import { tabrakKotaPtenKodePos } from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

const pten = [
  { kodePosPten: '57116', kotaPten: 'SURAKARTA (SOLO)', kotaPtenMax15: 'SOLO' },
  { kodePosPten: '57122', kotaPten: 'SURAKARTA (SOLO)', kotaPtenMax15: 'SOLO' },
  { kodePosPten: '57124', kotaPten: 'SURAKARTA', kotaPtenMax15: 'SURAKARTA' },
  { kodePosPten: '62213', kotaPten: 'LAMONGAN', kotaPtenMax15: 'LAMONGAN' },
  { kodePosPten: '62261', kotaPten: 'LAMONGAN', kotaPtenMax15: 'LAMONGAN' },
  { kodePosPten: '55182', kotaPten: 'GUNUNG KIDUL', kotaPtenMax15: 'GUNUNG KIDUL' },
  { kodePosPten: '10110', kotaPten: 'ADM JAKARTA PUSAT', kotaPtenMax15: 'ADM JAKARTA PUSAT' },
];
const kodePos = [
  { kodePos: '57116', kabupatenKota: 'Kota Surakarta' },
  { kodePos: '57122', kabupatenKota: 'Kota Surakarta' },
  { kodePos: '57111', kabupatenKota: 'Kota Surakarta' },
  { kodePos: '62213', kabupatenKota: 'Kabupaten Lamongan' },
  { kodePos: '62260', kabupatenKota: 'Kabupaten Lamongan' },
  { kodePos: '62260', kabupatenKota: 'Kabupaten Lamongan' },
  { kodePos: '17182', kabupatenKota: 'Kabupaten Gunungkidul' },
  { kodePos: '17182', kabupatenKota: 'Kabupaten Gunungkidul' },
  { kodePos: '10110', kabupatenKota: 'Jakarta Pusat' },
];
const h = tabrakKotaPtenKodePos(pten, kodePos);
const beda = (k) => h.bedaBlok.find((x) => x.kunci === k);

// ── TK1: satu kunci, dua ejaan di PTEN (kasus SURAKARTA / SOLO) ──
const solo = beda('SURAKARTA');
asa('TK1 dua nama PTEN untuk satu kota dilaporkan', solo.namaPten, ['SURAKARTA', 'SURAKARTA (SOLO)']);
asa('TK1 nama di Master Kode Pos ikut tampil', solo.namaKodePos, ['KOTA SURAKARTA']);
asa('TK1 blok yang cuma ada di PTEN', solo.hanyaDiPten, ['57124']);
asa('TK1 blok yang cuma ada di Master Kode Pos', solo.hanyaDiKodePos, ['57111']);

// ── TK2: Lamongan — 62260 ada di Kode Pos, 62261 ada di PTEN, 62213 sama-sama ada ──
asa('TK2 blok 62260 tercatat cuma di Kode Pos', beda('LAMONGAN').hanyaDiKodePos, ['62260']);
asa('TK2 blok 62261 tercatat cuma di PTEN', beda('LAMONGAN').hanyaDiPten, ['62261']);
asa('TK2 blok yang ada di dua tabel tidak dilaporkan', beda('LAMONGAN').hanyaDiKodePos.includes('62213') || beda('LAMONGAN').hanyaDiPten.includes('62213'), false);

// ── TK3: beda SPASI membuat dua kota tidak ketemu — itu lubang, bukan beda blok ──
asa('TK3 GUNUNGKIDUL tidak ada di sisi PTEN', h.tanpaPten.map((k) => k.kunci), ['GUNUNGKIDUL']);
asa('TK3 2 kelurahan berhenti sebelum dianalisa', h.tanpaPten[0].terdampak, 2);
asa('TK3 pasangan terdekat diajukan', h.tanpaPten[0].padanan.kunci, 'GUNUNG KIDUL');
asa('TK3 sisi PTEN juga melaporkan kotanya sendiri', h.tanpaKodePos.map((k) => k.kunci), ['GUNUNG KIDUL']);
asa('TK3 pasangan terdekat dari sisi PTEN', h.tanpaKodePos[0].padanan.kunci, 'GUNUNGKIDUL');
asa('TK3 ejaan yang sama tidak masuk daftar beda blok', h.bedaBlok.some((k) => k.kunci.includes('GUNUNG')), false);

// ── TK4: "ADM" dilepas cityMatchKey, Jakarta Pusat tidak jadi temuan ──
asa('TK4 kota yang benar-benar cocok tidak dilaporkan', h.bedaBlok.some((k) => k.kunci.includes('JAKARTA')), false);

// ── TK5: kunci yang sama sekali tanpa pasangan tidak masuk bedaBlok ──
asa('TK5 jumlah kunci tiap tabel', [h.totalKunciPten, h.totalKunciKodePos], [4, 4]);
// SURAKARTA dan LAMONGAN sama-sama selisih 2 blok, jadi abjad yang menentukan.
asa('TK5 daftar beda blok terurut dari selisih terbesar', h.bedaBlok.map((k) => k.kunci), ['LAMONGAN', 'SURAKARTA']);

// ── TK6: data kosong tidak mengarang temuan ──
const kosong = tabrakKotaPtenKodePos([], []);
asa('TK6 tanpa data = tanpa temuan', [kosong.tanpaPten.length, kosong.tanpaKodePos.length, kosong.bedaBlok.length, kosong.kelurahanTerhenti], [0, 0, 0, 0]);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} ASERSI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
