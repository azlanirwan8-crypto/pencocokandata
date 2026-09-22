// Permintaan pemilik produk 2026-09-22 (lanjutan N4): di tab Fase 2 kolom WILAYAH /
// SANDI CABANG / BRANCH CODE / KODE CABANG wajib SUDAH terisi mengikuti "Pilihan 1"
// pada kartu kandidat — TANPA menekan "Gunakan Cabang Ini". Kartu itu dihitung grid
// (AnalystResultsGrid.tsx `fase2Recs`), kolomnya dibaca dari field baris (hasil
// pipeline). Kalau keduanya beda, layar menampilkan rekomendasi tapi kolomnya kosong
// — persis keluhan pada screenshot KOLAKA / 19 November / Wundulako.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-isi-otomatis.mjs
import { executeAnalystPipeline, buildMasterProximityIndex, findClosestMasterRecommendation, paketFase2DariMaster } from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK    ' : 'GAGAL '}${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

const cabang = (o) => ({
  Wilayah: '', 'Branch Code': '', 'Kode Cabang': '', 'Sandi Cabang': '', Sandi: '', Cabang: '',
  'Nama Outlet': '', 'Status Outlet': '', ALAMAT: '', 'KODE POS': '', Kelurahan: '', Kecamatan: '',
  'Dati II': '', Provinsi: '', ...o,
});

// KOLAKA ditiru dari screenshot operator: baris ada di Kec. Wundulako, cabang master
// terdekatnya di Kec. Pomalaa (beda kecamatan, satu kabupaten).
const masterCabangRows = [
  cabang({ 'Sandi Cabang': '80', 'Branch Code': '60708062', 'Kode Cabang': '60708062', Sandi: '070', Cabang: 'KOLAKA', 'Nama Outlet': 'POMALAA', 'Status Outlet': 'KCP', ALAMAT: 'JL. R.A. KARTINI POMALAA', 'KODE POS': '93562', Kelurahan: 'DAWI-DAWI', Kecamatan: 'POMALAA', 'Dati II': 'KOLAKA', Provinsi: 'SULAWESI TENGGARA' }),
  cabang({ 'Sandi Cabang': '80', 'Branch Code': '60708061', 'Kode Cabang': '60708061', Sandi: '070', Cabang: 'KOLAKA', 'Nama Outlet': 'KOLAKA', 'Status Outlet': 'KC', ALAMAT: 'JL. KELAPA KOLAKA', 'KODE POS': '93553', Kelurahan: 'LALODDE', Kecamatan: 'KOLAKA', 'Dati II': 'KOLAKA', Provinsi: 'SULAWESI TENGGARA' }),
  cabang({ 'Sandi Cabang': '031', 'Branch Code': '03100001', 'Kode Cabang': '03100001', Sandi: '031', Cabang: 'BANDUNG', 'Nama Outlet': 'BANDUNG ASIA AFRIKA', 'Status Outlet': 'KC', ALAMAT: 'JL ASIA AFRIKA 126 BANDUNG', 'KODE POS': '40111', Kelurahan: 'BRAGA', Kecamatan: 'SUMUR BANDUNG', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
  // Kota tanpa cabang sendiri (mirip OKU Selatan): kolom wajib tetap terisi cabang
  // terdekat, bukan dibiarkan kosong.
  cabang({ 'Sandi Cabang': '032', 'Branch Code': '03200001', 'Kode Cabang': '03200001', Sandi: '032', Cabang: 'SAMARINDA', 'Nama Outlet': 'SAMARINDA PANDAN', 'Status Outlet': 'KC', ALAMAT: 'JL. PANDAN SAMARINDA', 'KODE POS': '79111', Kelurahan: 'AIR HITAM', Kecamatan: 'SAMARINDA', 'Dati II': 'SAMARINDA', Provinsi: 'KALIMANTAN TIMUR' }),
];

const kodePos = (kp, kel, kec, kota, prov, lat, lng) => ({
  kodePos: kp, kelurahan: kel, kecamatan: kec, kabupatenKota: kota, provinsi: prov, status: 'AKTIF', latitude: lat, longitude: lng,
});
const kodePosList = [
  kodePos('93563', '19 NOVEMBER', 'WUNDULAKO', 'KOLAKA', 'SULAWESI TENGGARA', -3.9952, 122.0657),
  kodePos('93562', 'DAWI-DAWI', 'POMALAA', 'KOLAKA', 'SULAWESI TENGGARA', -3.9669, 122.1023),
  kodePos('40111', 'BRAGA', 'SUMUR BANDUNG', 'BANDUNG', 'JAWA BARAT', -6.915, 107.61),
  kodePos('79133', 'KAMPUNG BARU BARAT', 'SINGKAWANG SELATAN', 'SINGKAWANG', 'KALIMANTAN BARAT', -0.1, 109.0),
];

const ptenList = [
  { kodePosPten: '93563', kotaPten: 'KOLAKA', kotaPtenMax15: 'KOLAKA', status: 'AKTIF' },
  { kodePosPten: '40111', kotaPten: 'BANDUNG', kotaPtenMax15: 'BANDUNG', status: 'AKTIF' },
  { kodePosPten: '79133', kotaPten: 'SINGKAWANG', kotaPtenMax15: 'SINGKAWANG', status: 'AKTIF' },
];

const wilayahSettings = [
  { wilayah: '7', kodeWilayah: '07', keterangan: 'WILAYAH 7 - KENDARI', sandiCabang: '070', branchCode: '', kodeCabang: '', namaOutlet: '', statusOutlet: '', alamat: '', kodePos: '', kelurahan: '', kecamatan: '', dati2: '', provinsi: '', telp: '' },
  { wilayah: '3', kodeWilayah: '03', keterangan: 'WILAYAH 3 - BANDUNG', sandiCabang: '031', branchCode: '', kodeCabang: '', namaOutlet: '', statusOutlet: '', alamat: '', kodePos: '', kelurahan: '', kecamatan: '', dati2: '', provinsi: '', telp: '' },
];
const roleList = [];

const jalankan = (sampaiFase) =>
  executeAnalystPipeline(masterCabangRows, ptenList, kodePosList, wilayahSettings, roleList, undefined, false, undefined, undefined, sampaiFase);

// Salinan proyeksi grid (AnalystResultsGrid.tsx `targetFromAnalystRow`) — kalau fungsi
// itu berubah, uji ini yang menegur.
const targetSepertiGrid = (r) => ({
  No: r.no, Wilayah: r.wilayah, 'Sandi Cabang': r.sandiCabang, 'Branch Code': r.branchCode,
  'Kode Cabang': r.kodeCabang, 'Nama Outlet': r.namaOutlet, 'Status Outlet': r.statusOutlet,
  'KODE POS': r.kodePosKelurahan || r.kodePosPten, Kelurahan: r.kelurahan, Kecamatan: r.kecamatan,
  'Dati II': r.groupKota, 'Kode Dati II': '', Provinsi: r.provinsi, ALAMAT: '',
});

const hasilF2 = (await jalankan(2)).rows.filter((r) => r.kategori !== 'TIDAK_ANALISA');
const indeks = buildMasterProximityIndex(masterCabangRows);

console.log(`baris hasil run sampai Fase 2: ${hasilF2.length}`);
asa('AO0 semua baris ter-analisa', hasilF2.length >= 4, true);

// ── Inti permintaan: kolom identitas = kandidat rank-1 kartu, tanpa klik ──
let beda = 0;
for (const r of hasilF2) {
  const rec = findClosestMasterRecommendation(targetSepertiGrid(r), indeks);
  const m = rec?.candidates?.[0]?.master;
  if (!m) { beda++; console.log(`       GAGAL ${r.kelurahan}: kartu tidak memberi kandidat sama sekali`); continue; }
  const kolom = [r.sandiCabang, r.branchCode, r.kodeCabang, r.namaOutlet];
  const kartu = [String(m['Sandi Cabang'] || ''), String(m['Branch Code'] || ''), String(m['Kode Cabang'] || ''), String(m['Nama Outlet'] || '')];
  const ok = kolom.every((v, i) => v === kartu[i]);
  if (!ok) { beda++; console.log(`       GAGAL ${r.kelurahan}: kolom=${JSON.stringify(kolom)} kartu=${JSON.stringify(kartu)}`); }
}
asa('AO1 kolom Fase 2 = Pilihan 1 kartu untuk SEMUA baris', beda, 0);

// ── Kasus screenshot: kelurahan beda kecamatan di kabupaten yang sama ──
// Cabangnya TIDAK dikarang di sini: yang diuji adalah kolomnya SAMA dengan Pilihan 1
// kartu baris itu (AO1 sudah memuat semua baris; ini contoh satu baris yang dilaporkan
// operator). Di fixture ini KC "KOLAKA" menang atas KCP POMALAA karena aturan KC (C2b).
const kolaka = hasilF2.find((r) => r.kelurahan === '19 NOVEMBER');
const kartuKolaka = findClosestMasterRecommendation(targetSepertiGrid(kolaka), indeks)?.candidates?.[0]?.master;
asa('AO2 baris KOLAKA tidak lagi kosong kolomnya', [kolaka?.sandiCabang, kolaka?.branchCode, kolaka?.kodeCabang], [String(kartuKolaka?.['Sandi Cabang'] || ''), String(kartuKolaka?.['Branch Code'] || ''), String(kartuKolaka?.['Kode Cabang'] || '')]);
asa('AO3 outlet terisi otomatis', kolaka?.namaOutlet, String(kartuKolaka?.['Nama Outlet'] || ''));
asa('AO4 wilayah ikut terisi', kolaka?.wilayah, 'WILAYAH 7 - KENDARI');
asa('AO5 status baris bukan "belum diproses"', kolaka?.fase2Status, 'OTOMATIS_VALID');

// ── Kota tanpa cabang sendiri: kolom tetap terisi, bukan diam-diam kosong ──
const singkawang = hasilF2.find((r) => r.kelurahan === 'KAMPUNG BARU BARAT');
asa('AO6 kota tanpa cabang sendiri tetap dapat cabang', Boolean(singkawang?.branchCode), true);
asa('AO7 alasannya tercatat (bukan hilang)', (singkawang?.fase2Temuan || []).length > 0, true);

// ── State yang operator lihat: run yang BERHENTI di Fase 1 memang belum punya kolom ──
const hasilF1 = (await jalankan(1)).rows.filter((r) => r.kategori !== 'TIDAK_ANALISA');
const k1 = hasilF1.find((r) => r.kelurahan === '19 NOVEMBER');
asa('AO8 run Fase 1 saja: kolom identitas masih kosong (kondisi "belum jalan")', [k1?.sandiCabang, k1?.branchCode, k1?.kodeCabang], ['', '', '']);
asa('AO9 dan barisnya berstatus SIAP_DIPROSES, bukan OTOMATIS_VALID', k1?.fase2Status, 'SIAP_DIPROSES');
asa('AO10 Fase 1 tetap mengisi kelurahan/kecamatan/kota', [k1?.kelurahan, k1?.kecamatan, k1?.kotaPten], ['19 NOVEMBER', 'WUNDULAKO', 'KOLAKA']);

// ── SATU RUMUS: nilai yang ditampilkan grid = nilai yang ditulis pipeline ──
let bedaRumus = 0;
const kolomBandin = ['wilayah', 'sandiCabang', 'branchCode', 'kodeCabang', 'namaOutlet', 'statusOutlet', 'alamat'];
for (const r of hasilF2) {
  const m = findClosestMasterRecommendation(targetSepertiGrid(r), indeks)?.candidates?.[0]?.master;
  const p = paketFase2DariMaster(m, wilayahSettings);
  const salah = kolomBandin.find((k) => r[k] !== p[k]);
  if (salah) { bedaRumus++; console.log(`       GAGAL ${r.kelurahan}.${salah}: baris=${JSON.stringify(r[salah])} rumus=${JSON.stringify(p[salah])}`); }
}
asa('AO11 rumus tampilan grid == rumus tulis pipeline untuk SEMUA baris', bedaRumus, 0);

// ── Janji ke operator: baris yang belum lewat Fase 2 tetap menampilkan kandidatnya ──
const kartuK1 = findClosestMasterRecommendation(targetSepertiGrid(k1), indeks)?.candidates?.[0]?.master;
const p1 = paketFase2DariMaster(kartuK1, wilayahSettings);
asa('AO12 nilai tampilan baris Fase 1 == nilai yang ditulis saat Fase 2 nanti',
  [p1.sandiCabang, p1.branchCode, p1.kodeCabang, p1.wilayah],
  [kolaka.sandiCabang, kolaka.branchCode, kolaka.kodeCabang, kolaka.wilayah]);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} PENGUJIAN GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
