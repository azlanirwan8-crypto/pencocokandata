// Tabrakan nama kota: berkas PTEN vs Master Kode Pos.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-tabrak-kota.mjs
//
// Semua nama dan blok di fixture ini NYATA, diambil dari /api/pten dan /api/kodepos
// di match-sepia.vercel.app, 2026-09-24. Kunci yang dipakai = cityMatchKey(kotaPten),
// persis seperti penggerak Fase 1 di analystPipeline — jadi nama bercatatan kurung
// seperti "SURAKARTA (SOLO)" memang tidak ketemu dengan "Kota Surakarta".
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
  { kodePosPten: '96211', kotaPten: 'BOLAANG MONGONDOW (BOLMONG)', kotaPtenMax15: 'BOLMONG' },
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
  { kodePos: '96211', kabupatenKota: 'Kabupaten Bolaang Mongondow' },
  { kodePos: '10110', kabupatenKota: 'Jakarta Pusat' },
];
const h = tabrakKotaPtenKodePos(pten, kodePos);
const beda = (k) => h.bedaBlok.find((x) => x.kunci === k);
const cari = (daftar, k) => daftar.find((x) => x.kunci === k);

// ── TK1: kunci yang sama, isi blok beda ──
// "SURAKARTA (SOLO)" TIDAK ikut grup SURAKARTA (kunci namanya beda), jadi blok 57116 dan
// 57122 tercatat "cuma di Master Kode Pos" bagi grup ini — persis yang dilihat Fase 1.
const solo = beda('SURAKARTA');
asa('TK1 nama PTEN yang benar-benar sekunci', solo.namaPten, ['SURAKARTA']);
asa('TK1 nama di Master Kode Pos ikut tampil', solo.namaKodePos, ['KOTA SURAKARTA']);
asa('TK1 blok yang cuma ada di PTEN', solo.hanyaDiPten, ['57124']);
asa('TK1 blok yang cuma ada di Master Kode Pos', solo.hanyaDiKodePos, ['57111', '57116', '57122']);

// ── TK2: Lamongan — 62260 ada di Kode Pos, 62261 ada di PTEN, 62213 sama-sama ada ──
asa('TK2 blok 62260 tercatat cuma di Kode Pos', beda('LAMONGAN').hanyaDiKodePos, ['62260']);
asa('TK2 blok 62261 tercatat cuma di PTEN', beda('LAMONGAN').hanyaDiPten, ['62261']);
asa('TK2 blok yang ada di dua tabel tidak dilaporkan', beda('LAMONGAN').hanyaDiKodePos.includes('62213') || beda('LAMONGAN').hanyaDiPten.includes('62213'), false);

// ── TK3: beda SPASI membuat dua kota tidak ketemu — itu tabrakan nama, bukan hilangnya data ──
asa('TK3 GUNUNGKIDUL tidak ada kunci yang sama di PTEN', cari(h.tanpaPten, 'GUNUNGKIDUL').terdampak, 2);
asa('TK3 pasangan terdekat diajukan', cari(h.tanpaPten, 'GUNUNGKIDUL').padanan.kunci, 'GUNUNG KIDUL');
asa('TK3 ejaan yang sama tidak masuk daftar beda blok', h.bedaBlok.some((k) => k.kunci.includes('GUNUNG')), false);
asa('TK3 kunci GUNUNGKIDUL belum tercatat di kolom MAX 15 PTEN', cari(h.tanpaPten, 'GUNUNGKIDUL').dariKolomLain, []);

// ── TK4: "ADM" dilepas cityMatchKey, Jakarta Pusat tidak jadi temuan ──
asa('TK4 kota yang benar-benar cocok tidak dilaporkan', h.bedaBlok.some((k) => k.kunci.includes('JAKARTA')), false);
asa('TK4 juga tidak masuk daftar tanpa pasangan', h.tanpaPten.some((k) => k.kunci.includes('JAKARTA')) || h.tanpaKodePos.some((k) => k.kunci.includes('JAKARTA')), false);

// ── TK5: nama PTEN bercatatan kurung jadi kota baru, dan ejaan bakunya ada di MAX 15 ──
const bolmong = cari(h.tanpaPten, 'BOLAANG MONGONDOW');
asa('TK5 kota kode pos ini tidak ketemu kunci nama lengkap PTEN', bolmong.terdampak, 1);
asa('TK5 tapi kolom MAX 15 PTEN sudah memuat ejaan yang sama', bolmong.dariKolomLain, ['BOLMONG']);
asa('TK5 max15 dihitung sebagai kelurahan yang bisa diambil dari berkas sendiri', h.kelurahanAdaDiMax15, 1);
asa('TK5 nama PTEN bercatatan muncul sebagai kotanya sendiri di sisi seberang', cari(h.tanpaKodePos, 'BOLAANG MONGONDOW BOLMONG').nama, ['BOLAANG MONGONDOW (BOLMONG)']);

// ── TK6: urutan & jumlah kunci ──
asa('TK6 jumlah kunci tiap tabel', [h.totalKunciPten, h.totalKunciKodePos], [6, 5]);
asa('TK6 tanpaPten terurut dari kelurahan terbanyak', h.tanpaPten.map((k) => k.kunci), ['GUNUNGKIDUL', 'BOLAANG MONGONDOW']);
asa('TK6 bedaBlok terurut dari selisih blok terbesar', h.bedaBlok.map((k) => k.kunci), ['SURAKARTA', 'LAMONGAN']);
asa('TK6 total kelurahan bernama tabrak', h.kelurahanBedaNama, 3);

// ── TK7: data kosong tidak mengarang temuan ──
const kosong = tabrakKotaPtenKodePos([], []);
asa('TK7 tanpa data = tanpa temuan', [kosong.tanpaPten.length, kosong.tanpaKodePos.length, kosong.bedaBlok.length, kosong.kelurahanBedaNama, kosong.kelurahanAdaDiMax15], [0, 0, 0, 0, 0]);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} ASERSI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
