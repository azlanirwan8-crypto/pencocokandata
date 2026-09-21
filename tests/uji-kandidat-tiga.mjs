// Uji: baris Manual harus selalu punya TIGA rekomendasi cabang.
// Aturan pemilik produk 2026-09-22: "jika yang manual itu harus muncul 3 rekomendasinya".
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-kandidat-tiga.mjs
import { findClosestMasterRecommendation, buildMasterProximityIndex } from './out/entry-uji.js';

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

const M = [
  // Kota target: HANYA dua cabang sekota
  cabang({ 'Branch Code': '03100001', 'Kode Cabang': '03100001', 'Sandi Cabang': '03100001', Sandi: '031', Cabang: 'BANDUNG', 'Nama Outlet': 'BANDUNG ASIA AFRIKA', 'Status Outlet': 'KC', ALAMAT: 'JL ASIA AFRIKA 126', 'KODE POS': '40111', Kelurahan: 'BRAGA', Kecamatan: 'SUMUR BANDUNG', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
  cabang({ 'Branch Code': '03100002', 'Kode Cabang': '03100002', 'Sandi Cabang': '03100002', Sandi: '031', Cabang: 'BANDUNG', 'Nama Outlet': 'BANDUNG DAGO', 'Status Outlet': 'KCP', ALAMAT: 'JL DAGO 100', 'KODE POS': '40132', Kelurahan: 'LEBAK GEBANG', Kecamatan: 'COBLONG', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
  // Kota tetangga, provinsi SAMA — kode pos 40211 (selisih 100 dari 40111)
  cabang({ 'Branch Code': '03200001', 'Kode Cabang': '03200001', 'Sandi Cabang': '03200001', Sandi: '032', Cabang: 'CIMAHI', 'Nama Outlet': 'CIMAHI AKASIA', 'Status Outlet': 'KCP', ALAMAT: 'JL AKASIA 5', 'KODE POS': '40211', Kelurahan: 'AKASIA', Kecamatan: 'CIMAHI BARAT', 'Dati II': 'CIMAHI', Provinsi: 'JAWA BARAT' }),
  cabang({ 'Branch Code': '03300001', 'Kode Cabang': '03300001', 'Sandi Cabang': '03300001', Sandi: '033', Cabang: 'BEKASI', 'Nama Outlet': 'BEKASI KALIMALANG', 'Status Outlet': 'KCP', ALAMAT: 'JL KALIMALANG 8', 'KODE POS': '40999', Kelurahan: 'BEKASI JAYA', Kecamatan: 'BEKASI TIMUR', 'Dati II': 'BEKASI', Provinsi: 'JAWA BARAT' }),
  // Provinsi lain — kode pos lebih dekat ke target daripada BEKASI, supaya uji
  // "provinsi sama didahulukan" benar-benar menguji prioritas, bukan jarak.
  cabang({ 'Branch Code': '02100001', 'Kode Cabang': '02100001', 'Sandi Cabang': '02100001', Sandi: '021', Cabang: 'SEMARANG', 'Nama Outlet': 'SEMARANG PANDAAN', 'Status Outlet': 'KC', ALAMAT: 'JL PANDAAN 3', 'KODE POS': '40120', Kelurahan: 'PEGADEN', Kecamatan: 'SEMARANG SELATAN', 'Dati II': 'SEMARANG', Provinsi: 'JAWA TENGAH' }),
];

const target = (o) => ({
  No: 1, Wilayah: 'Wilayah 3', 'Branch Code': '', 'Kode Cabang': '', 'Nama Outlet': '',
  'Status Outlet': '', ALAMAT: '', 'Kode Dati II': '', ...o,
});

const BANDUNG = target({
  ALAMAT: 'JL ASIA AFRIKA 126 BANDUNG', 'KODE POS': '40111', Kelurahan: 'BRAGA',
  Kecamatan: 'SUMUR BANDUNG', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT',
});

const idx = buildMasterProximityIndex(M);
const rec = findClosestMasterRecommendation(BANDUNG, idx);
const nama = (c) => c.master['Nama Outlet'];

asa('kota dengan 2 cabang tetap menampilkan 3 pilihan', rec.candidates.length, 3);
asa('rank 1 tetap cabang sekota (bukan tambahan)', [rec.candidates[0].rank, rec.candidates[0].diLuarZona], [1, false]);
asa('rank 2 tetap cabang sekota', [rec.candidates[1].rank, rec.candidates[1].diLuarZona], [2, false]);
asa('rank 3 = tambahan di luar zona', [rec.candidates[2].rank, rec.candidates[2].diLuarZona], [3, true]);
asa('tambahan diprioritaskan satu provinsi meski provinsi lain lebih dekat', nama(rec.candidates[2]), 'CIMAHI AKASIA');
asa('tidak ada outlet kembar di daftar', new Set(rec.candidates.map(nama)).size, 3);
asa('alasan tambahan menyebut jelas ini bukan hasil mesin', /di luar kota ini/.test(rec.candidates[2].reason), true);
asa('skor tambahan di bawah kandidat zona', rec.candidates[2].score < rec.candidates[0].score, true);

// Kota yang cuma punya SATU cabang: 1 zona + 2 tambahan.
const SEMARANG = target({
  ALAMAT: 'JL PANDAAN 3 SEMARANG', 'KODE POS': '50120', Kelurahan: 'PANDAAN',
  Kecamatan: 'SEMARANG TIMUR', 'Dati II': 'SEMARANG', Provinsi: 'JAWA TENGAH',
});
const rec1 = findClosestMasterRecommendation(SEMARANG, idx);
asa('kota dengan 1 cabang pun menampilkan 3 pilihan', rec1.candidates.length, 3);
asa('hanya rank 1 yang berasal dari zona sendiri', rec1.candidates.filter((c) => !c.diLuarZona).map(nama), ['SEMARANG PANDAAN']);
asa('dua sisanya ditandai di luar zona', rec1.candidates.slice(1).every((c) => c.diLuarZona === true), true);

// Master cuma satu cabang di dunia: mesin tidak boleh mengarang duplikat.
const recSatu = findClosestMasterRecommendation(BANDUNG, buildMasterProximityIndex([M[0]]));
asa('master 1 cabang -> 1 pilihan, tidak diduplikasi', recSatu.candidates.map(nama), ['BANDUNG ASIA AFRIKA']);
asa('pilihan tunggal tidak ditandai luar zona', recSatu.candidates[0].diLuarZona, false);

// Kode pos target kosong: tetap kumpul kandidat zona, tidak boleh crash.
const recTanpaKp = findClosestMasterRecommendation(
  { ...BANDUNG, 'KODE POS': '' },
  idx
);
asa('target tanpa kode pos tetap memberi 3 pilihan', recTanpaKp.candidates.length, 3);
asa('rank 1 tidak berubah saat kode pos kosong', nama(recTanpaKp.candidates[0]), 'BANDUNG ASIA AFRIKA');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
