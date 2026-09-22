// N5 butir 0 — "kalau kode pos sudah ada di Data Final, dia tidak boleh dieksekusi lagi,
// kecuali dikembalikan (revisi)". Dijalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-final-skip.mjs
import { executeAnalystPipeline, makeFinalKey, getHeaderStyle, getDataCellStyle, KOLOM_FINAL, barisKeExcelFinal } from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

const cabang = (o) => ({
  Wilayah: '', 'Branch Code': '', 'Kode Cabang': '', 'Sandi Cabang': '', Sandi: '', Cabang: '',
  'Nama Outlet': '', 'Status Outlet': '', ALAMAT: '', 'KODE POS': '', Kelurahan: '', Kecamatan: '',
  'Dati II': '', Provinsi: '', ...o,
});

const masterCabangRows = [
  cabang({ 'Sandi Cabang': '03100001', 'Branch Code': '03100001', 'Kode Cabang': '03100001', Sandi: '031', Cabang: 'BANDUNG', 'Nama Outlet': 'BANDUNG ASIA AFRIKA', 'Status Outlet': 'KC', ALAMAT: 'JL ASIA AFRIKA 126 BANDUNG', 'KODE POS': '40111', Kelurahan: 'BRAGA', Kecamatan: 'SUMUR BANDUNG', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
  cabang({ 'Sandi Cabang': '03100002', 'Branch Code': '03100002', 'Kode Cabang': '03100002', Sandi: '031', Cabang: 'BANDUNG', 'Nama Outlet': 'BANDUNG DAGO', 'Status Outlet': 'KCP', ALAMAT: 'JL DAGO 100 BANDUNG', 'KODE POS': '40132', Kelurahan: 'LEBAK GEBANG', Kecamatan: 'COBLONG', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
  cabang({ 'Sandi Cabang': '03600001', 'Branch Code': '03600001', 'Kode Cabang': '03600001', Sandi: '036', Cabang: 'BEKASI', 'Nama Outlet': 'BEKASI JL KALIMALANG', 'Status Outlet': 'KC', ALAMAT: 'JL KALIMALANG BEKASI', 'KODE POS': '17111', Kelurahan: 'KALIJATI', Kecamatan: 'BEKASI UTARA', 'Dati II': 'BEKASI', Provinsi: 'JAWA BARAT' }),
];

const kodePos = (kodePos, kelurahan, kecamatan, kabupatenKota, provinsi, lat, lng) => ({
  kodePos, kelurahan, kecamatan, kabupatenKota, provinsi, status: 'AKTIF', latitude: lat, longitude: lng,
});
const kodePosList = [
  kodePos('40111', 'BRAGA', 'SUMUR BANDUNG', 'BANDUNG', 'JAWA BARAT', -6.915, 107.61),
  kodePos('40132', 'LEBAK GEBANG', 'COBLONG', 'BANDUNG', 'JAWA BARAT', -6.879, 107.62),
  // Kelurahan kembar: kode pos & nama sama, kecamatan BEDA (kabupaten vs kota) —
  // kunci final wajib 4 bagian supaya yang satu tidak dianggap "sudah final".
  kodePos('17111', 'KALIJATI', 'BEKASI UTARA', 'KOTA BEKASI', 'JAWA BARAT', -6.21, 106.94),
  kodePos('17111', 'KALIJATI', 'TARUMAJAYA', 'KABUPATEN BEKASI', 'JAWA BARAT', -6.27, 107.05),
];

const ptenList = [
  { kodePosPten: '40111', kotaPten: 'BANDUNG', kotaPtenMax15: 'BANDUNG', status: 'AKTIF' },
  { kodePosPten: '17111', kotaPten: 'BEKASI', kotaPtenMax15: 'BEKASI', status: 'AKTIF' },
];

const wilayahSettings = masterCabangRows.map((m) => ({
  wilayah: 'W1', sandiCabang: m['Sandi Cabang'], branchCode: m['Branch Code'], kodeCabang: m['Kode Cabang'],
  namaOutlet: m['Nama Outlet'], statusOutlet: m['Status Outlet'], alamat: m.ALAMAT, kodePos: m['KODE POS'],
  kelurahan: m.Kelurahan, kecamatan: m.Kecamatan, dati2: m['Dati II'], provinsi: m.Provinsi,
}));
const roleList = [{ organisasiTujuan: 'BANDUNG ASIA AFRIKA BRANCH OFFICE', qrsCabsal: 1, qrsCabapv1: 1, qrsCabapv2: 1, grandTotal: 3 }];

const jalankan = (excludeFinalKeys) =>
  executeAnalystPipeline(masterCabangRows, ptenList, kodePosList, wilayahSettings, roleList, undefined, false, undefined, excludeFinalKeys, 3);

const kunci = (r) => makeFinalKey(r.kodePosPten, r.kelurahan, r.kecamatan, r.kotaPten);
const nama = (rows) => rows.map((r) => `${r.kelurahan}/${r.kecamatan}`).sort().join(' , ');

// ── 1. run pertama: semua baris dikerjakan, belum ada yang final ──
const bersih = (await jalankan(new Set())).rows;
console.log('run pertama:', bersih.length, 'baris →', nama(bersih));
asa('FS1 semua kelurahan diproses pada run pertama', bersih.length, 4);
asa('FS1 nol baris dilaporkan dilewati', (await jalankan(new Set())).coverage.skippedFinalRows, 0);

// ── 2. semua baris masuk Final Data → run berikutnya tidak mengerjakan apa pun ──
const semuaFinal = new Set(bersih.map(kunci));
asa('FS2 kunci final unik = jumlah baris (tidak ada kunci kembar)', semuaFinal.size, bersih.length);
const runKedua = await jalankan(semuaFinal);
asa('FS2 run kedua menghasilkan 0 baris (semuanya sudah final)', runKedua.rows.length, 0);
asa('FS2 keempatnya dilaporkan sebagai dilewati', runKedua.coverage.skippedFinalRows, 4);

// ── 3. satu baris di-REVISI (keluar dari Final) → hanya itu yang dikerjakan ulang ──
const braga = bersih.find((r) => r.kelurahan === 'BRAGA');
const setelahRevisi = new Set([...semuaFinal].filter((k) => k !== kunci(braga)));
const runKetiga = await jalankan(setelahRevisi);
asa('FS3 hanya BRAGA yang kembali diproses', nama(runKetiga.rows), 'BRAGA/SUMUR BANDUNG');
asa('FS3 tiga lainnya tetap dilewati', runKetiga.coverage.skippedFinalRows, 3);
asa('FS3 baris hasil revisa masuk sebagai Fase 1 (belum disetujui)', runKetiga.rows[0]?.fase1Approved, false);
asa('FS3 cabang terpasang lagi otomatis', runKetiga.rows[0]?.namaOutlet, 'BANDUNG ASIA AFRIKA');

// ── 4. kunci 4 bagian: kelurahan kembar beda kecamatan tidak ikut "sudah final" ──
const kalijatiUtara = bersih.find((r) => r.kelurahan === 'KALIJATI' && r.kecamatan === 'BEKASI UTARA');
const hanyaUtara = new Set([kunci(kalijatiUtara)]);
const runKeempat = await jalankan(hanyaUtara);
const kalijatiRun4 = runKeempat.rows.filter((r) => r.kelurahan === 'KALIJATI').map((r) => r.kecamatan);
asa('FS4 KALIJATI Tarumajaya tetap diproses walau KALIJATI Bekasi Utara sudah final',
  kalijatiRun4, ['TARUMAJAYA']);
asa('FS4 hanya satu yang dilewati', runKeempat.coverage.skippedFinalRows, 1);

// ── 5. warna header Excel = tangkapan layar operator (N5 butir 2 & 9) ──
// Warna di bawah ini BUKAN tebakan: diukur per-piksel dari berkas gambar yang dilampirkan
// (scratch/baca-warna-png.mjs → #366092 navy, #47D359 hijau, #E97132 oranye).
const NAVY = '366092';
const HIJAU = '47D359';
const ORANYE = 'E97132';
const WARNA_HEADER = [
  ['No', NAVY], ['Wilayah', NAVY], ['Sandi Cabang', NAVY], ['Branch Code', NAVY],
  ['Kode Cabang', NAVY], ['Nama Outlet', NAVY], ['Status Outlet', NAVY],
  ['ALAMAT', HIJAU], ['KODE POS', HIJAU], ['Kelurahan', HIJAU], ['Kecamatan', HIJAU],
  ['Dati II', ORANYE], ['Provinsi', HIJAU],
];
for (const [kolom, harus] of WARNA_HEADER) {
  asa(`FS5 header "${kolom}" warna ${harus}`, getHeaderStyle(kolom)?.fill?.fgColor?.rgb, harus);
}
asa('FS5 semua header pakai teks putih bold', WARNA_HEADER.every(([k]) => {
  const s = getHeaderStyle(k);
  return s.font.color.rgb === 'FFFFFF' && s.font.bold === true;
}), true);
asa('FS5 sel data pakai Calibri 10 (rapi, tidak melar)', getDataCellStyle('ALAMAT').font.sz, 10);

// ── 6. format tabel = format berkas (N5 butir 2, 8, 9) ──
const JUDUL_HARUS = ['No', 'Wilayah', 'Sandi Cabang', 'Branch Code', 'Kode Cabang', 'Nama Outlet', 'Status Outlet',
  'ALAMAT', 'KODE POS', 'Kelurahan', 'Kecamatan', 'Dati II', 'Provinsi'];
asa('FS6 13 kolom, urutan persis permintaan operator', KOLOM_FINAL.map((k) => k.judul), JUDUL_HARUS);
const contohEkspor = barisKeExcelFinal(bersih[2], 3);
asa('FS6 kunci baris ekspor = judul kolom (tanpa kolom aksi)', Object.keys(contohEkspor), JUDUL_HARUS);
asa('FS6 No ditulis ulang sesuai posisi ekspor', contohEkspor.No, 3);
asa('FS6 baris ke-i tetap baris ke-i (ekspor tidak menukar urutan)', contohEkspor.Kelurahan, bersih[2].kelurahan);
asa('FS6 Dati II memakai nama MAX 15 digit (aturan ekspor final)', contohEkspor['Dati II'], bersih[2].kotaPtenMax15 || bersih[2].kotaPten);
asa('FS6 berkas Final Data tidak memuat kolom role/aksi', Object.keys(contohEkspor).some((k) => /ORGANISASI|WONDR|3 ROLE|AKSI|DETAIL|TIPE UNIT/i.test(k)), false);
asa('FS6 grup warna layar = warna berkas (navy/hijau/oranye)',
  KOLOM_FINAL.map((k) => k.grup),
  ['navy', 'navy', 'navy', 'navy', 'navy', 'navy', 'navy', 'hijau', 'hijau', 'hijau', 'hijau', 'oranye', 'hijau']);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} TEST GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
