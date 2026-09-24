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
  { kodePosPten: '21457', kotaPten: 'LABUHAN BATU UTARA', kotaPtenMax15: 'LABUHANBATU UTA' },
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
  { kodePos: '21457', kabupatenKota: 'Kabupaten Labuhanbatu Utara' },
  { kodePos: '10110', kabupatenKota: 'Jakarta Pusat' },
];
const h = tabrakKotaPtenKodePos(pten, kodePos);
const beda = (k) => h.bedaBlok.find((x) => x.kunci === k);
const cari = (daftar, k) => daftar.find((x) => x.kunci === k);

// ── TK1: satu kunci, dua ejaan di PTEN (kasus SURAKARTA / SOLO) ──
// "SURAKARTA (SOLO)" dan "SURAKARTA" sekarang SATU kunci — catatan alias dalam kurung
// dibuang cityMatchKey. Blok 57116/57122 ikut keduanya, jadi tidak lagi dilaporkan
// "cuma di Master Kode Pos"; yang tersisa cuma 57124 (khusus PTEN) dan 57111 (khusus KP).
const solo = beda('SURAKARTA');
asa('TK1 dua nama PTEN untuk satu kota dilaporkan', solo.namaPten, ['SURAKARTA', 'SURAKARTA (SOLO)']);
asa('TK1 nama di Master Kode Pos ikut tampil', solo.namaKodePos, ['KOTA SURAKARTA']);
asa('TK1 blok yang cuma ada di PTEN', solo.hanyaDiPten, ['57124']);
asa('TK1 blok yang cuma ada di Master Kode Pos', solo.hanyaDiKodePos, ['57111']);

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

// ── TK5: catatan kurung sudah BUKAN pemisah lagi, tapi spasi masih ──
// "BOLAANG MONGONDOW (BOLMONG)" + max15 "BOLMONG" sekarang satu kunci dengan
// "Kabupaten Bolaang Mongondow" → tidak lagi dilaporkan sama sekali.
asa('TK5 nama bercatatan kurung tidak lagi masuk tanpaPten', h.tanpaPten.some((k) => k.kunci.includes('BOLAANG')), false);
asa('TK5 dan tidak lagi masuk tanpaKodePos', h.tanpaKodePos.some((k) => k.kunci.includes('BOLAANG')), false);
asa('TK5 bloknya juga tidak dilaporkan beda', h.bedaBlok.some((k) => k.kunci.includes('BOLAANG')), false);
// "LABUHAN BATU UTARA" (PTEN, ada spasi) vs "Kabupaten Labuhanbatu Utara" (KP) tetap
// dua kunci — tapi kolom MAX 15 PTEN ("LABUHANBATU UTA") sudah memuat ejaan yang sama.
const labuhan = cari(h.tanpaPten, 'LABUHANBATU UTARA');
asa('TK5 kota kode pos ini tidak ketemu kunci nama lengkap PTEN', labuhan.terdampak, 1);
asa('TK5 tapi kolom MAX 15 PTEN sudah memuat ejaan yang sama', labuhan.dariKolomLain, ['LABUHANBATU UTA']);
asa('TK5 max15 dihitung sebagai kelurahan yang bisa diambil dari berkas sendiri', h.kelurahanAdaDiMax15, 1);
asa('TK5 namanya tercatat sebagai kota sendiri di sisi PTEN', cari(h.tanpaKodePos, 'LABUHAN BATU UTARA').nama, ['LABUHAN BATU UTARA']);

// ── TK6: urutan & jumlah kunci ──
asa('TK6 jumlah kunci tiap tabel', [h.totalKunciPten, h.totalKunciKodePos], [6, 6]);
asa('TK6 tanpaPten terurut dari kelurahan terbanyak', h.tanpaPten.map((k) => k.kunci), ['GUNUNGKIDUL', 'LABUHANBATU UTARA']);
asa('TK6 bedaBlok terurut dari selisih blok terbesar', h.bedaBlok.map((k) => k.kunci), ['LAMONGAN', 'SURAKARTA']);
asa('TK6 total kelurahan bernama tabrak', h.kelurahanBedaNama, 3);

// ── TK7: data kosong tidak mengarang temuan ──
const kosong = tabrakKotaPtenKodePos([], []);
asa('TK7 tanpa data = tanpa temuan', [kosong.tanpaPten.length, kosong.tanpaKodePos.length, kosong.bedaBlok.length, kosong.kelurahanBedaNama, kosong.kelurahanAdaDiMax15], [0, 0, 0, 0, 0]);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} ASERSI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
