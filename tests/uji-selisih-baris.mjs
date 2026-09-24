// Rincian perbedaan baris — mencari padanan terdekat + lapangan yang bikin beda.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-selisih-baris.mjs
//
// Semua fixture baris NYATA: diambil dari /api/target?view=final dan
// /api/kodepos?view=page&search=... di match-sepia.vercel.app, 2026-09-24.
import { indeksSisiSelisih, cariPadananSelisih, bedaSisiSelisih } from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

// Master Kode Pos: Waena/Heram punya DUA kode pos (99328 dan 99332).
const master = [
  { kodePos: '99328', kelurahan: 'Waena', kecamatan: 'Heram', kota: 'Kota Jayapura' },
  { kodePos: '99332', kelurahan: 'Waena', kecamatan: 'Heram', kota: 'Kota Jayapura' },
  { kodePos: '95770', kelurahan: 'Tangagah', kecamatan: 'Bolaang Uki', kota: 'Kabupaten Bolaang Mongondow Selatan' },
  { kodePos: '95774', kelurahan: 'Momalia', kecamatan: 'Posigadan', kota: 'Kabupaten Bolaang Mongondow' },
  { kodePos: '97544', kelurahan: 'Waenalut', kecamatan: 'Namrole', kota: 'Kabupaten Buru Selatan' },
];
const indeks = indeksSisiSelisih(master);

// ── SN1: Waena 99332 "belum ada di Final" padahal Final memakai 99328 ──
const waena = cariPadananSelisih(indeks, { kodePos: '99332', kelurahan: 'Waena', kecamatan: 'Heram', kota: 'JAYAPURA' });
asa('SN1 ketemu sebagai nama kembar beda kode pos', waena.lewat, 'nama sama, kode pos beda');
asa('SN1 lawannya baris 99328', waena.lawan.kodePos, '99328');
asa('SN1 hanya kode pos yang beda (kota "JAYAPURA" = "Kota Jayapura")', waena.beda, ['kodePos']);

// ── SN2: 95774 / BOLAANG MONGONDOW SELATAN — nama itu sebenarnya nama KABUPATEN ──
const bolmong = cariPadananSelisih(indeks, {
  kodePos: '95774', kelurahan: 'BOLAANG MONGONDOW SELATAN', kecamatan: 'BOLAANG MONGONDOW SELATAN', kota: 'BOLMONG SELATAN',
});
asa('SN2 kode posnya ada, namanya bukan kelurahan', bolmong.lewat, 'kode pos sama, nama beda');
asa('SN2 lawannya Momalia/Posigadan', [bolmong.lawan.kelurahan, bolmong.lawan.kecamatan], ['Momalia', 'Posigadan']);
asa('SN2 bedanya kelurahan + kecamatan + kota', bolmong.beda, ['kelurahan', 'kecamatan', 'kota']);

// ── SN3: kode pos tidak dikenal sama sekali -> cuma boleh disebut PERKIRAAN ──
const takDikenal = cariPadananSelisih(indeks, { kodePos: '95771', kelurahan: 'Inodoudenga', kecamatan: 'Pinogaluman', kota: 'BOLMONG UTARA' });
asa('SN3 tidak ada kode posnya, diambil sekabupaten', takDikenal.lewat, 'kode pos sekabupaten');
asa('SN3 nama tetap dilaporkan beda', takDikenal.beda.includes('kelurahan'), true);

// ── SN4: sampai empat digit kode pos pun tidak ada -> jangan mengarang pasangan ──
const hantu = cariPadananSelisih(indeks, { kodePos: '12345', kelurahan: 'Nirnama', kecamatan: 'Nirtuan', kota: 'Nikab' });
asa('SN4 tanpa padanan sama sekali', [hantu.lawan, hantu.lewat, hantu.beda], [null, null, []]);
asa('SN4 kode pos kosong tidak dicari', cariPadananSelisih(indeks, { kodePos: '', kelurahan: 'Waena', kecamatan: 'Heram', kota: '' }).lawan, null);

// ── SN5: beda kemasan label ("Desa Momalia / Kec. Posigadan") = bukan beda data ──
const desa = cariPadananSelisih(indeks, { kodePos: '95774', kelurahan: 'DESA MOMALIA', kecamatan: 'KEC. POSIGADAN', kota: 'KAB. BOLAANG MONGONDOW' });
asa('SN5 tetap ketemu pasangan kodenya', desa.lewat, 'kode pos sama, nama beda');
asa('SN5 keempat lapangan sebenarnya sama', desa.beda, []);

// ── SN6: pembanding lapangan per lapangan, berdiri sendiri ──
asa('SN6 beda hanya kode pos', bedaSisiSelisih(
  { kodePos: '99328', kelurahan: 'Waena', kecamatan: 'Heram', kota: 'Kota Jayapura' },
  { kodePos: '99332', kelurahan: 'Waena', kecamatan: 'Heram', kota: 'Kota Jayapura' }
), ['kodePos']);
asa('SN6 kota kosong di salah satu sisi tidak dianggap beda', bedaSisiSelisih(
  { kodePos: '99332', kelurahan: 'Waena', kecamatan: 'Heram', kota: '' },
  { kodePos: '99328', kelurahan: 'Waena', kecamatan: 'Heram', kota: 'Kota Jayapura' }
), ['kodePos']);
asa('SN6 identik = tidak ada yang beda', bedaSisiSelisih(master[0], master[0]), []);

// ── SN7: pemilih kandidat terdekat tidak boleh asal ambil baris pertama ──
const banyak = indeksSisiSelisih([
  { kodePos: '97544', kelurahan: 'Waenalut', kecamatan: 'Namrole', kota: 'Buru Selatan' },
  { kodePos: '97544', kelurahan: 'Waena', kecamatan: 'Namrole', kota: 'Buru Selatan' },
  { kodePos: '97544', kelurahan: 'Waekasu', kecamatan: 'Namrole', kota: 'Buru Selatan' },
]);
asa('SN7 yang paling mirip yang dipilih', cariPadananSelisih(banyak, { kodePos: '97544', kelurahan: 'WAENA', kecamatan: 'Namrole', kota: '' }).lawan.kelurahan, 'Waena');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} ASersi GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
