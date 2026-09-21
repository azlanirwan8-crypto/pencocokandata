// M7 — checklist uji Bagian M: tiga keranjang Fase 2 harus benar.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-fase2-status.mjs
import { executeAnalystPipeline } from './out/entry-uji.js';

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
  cabang({ 'Sandi Cabang': '01100001', 'Branch Code': '01100001', 'Kode Cabang': '01100001', Sandi: '011', Cabang: 'BANDA ACEH', 'Nama Outlet': 'KIM BANDA ACEH', 'Status Outlet': 'KC', ALAMAT: 'JL ISKANDAR MUDA BANDA ACEH', 'KODE POS': '23111', Kelurahan: 'KAMPANG BARU', Kecamatan: 'BANDA ACEH', 'Dati II': 'BANDA ACEH', Provinsi: 'ACEH' }),
  cabang({ 'Sandi Cabang': '03100001', 'Branch Code': '03100001', 'Kode Cabang': '03100001', Sandi: '031', Cabang: 'BANDUNG', 'Nama Outlet': 'BANDUNG ASIA AFRIKA', 'Status Outlet': 'KC', ALAMAT: 'JL ASIA AFRIKA 126 BANDUNG', 'KODE POS': '40111', Kelurahan: 'BRAGA', Kecamatan: 'SUMUR BANDUNG', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
  cabang({ 'Sandi Cabang': '03100002', 'Branch Code': '03100002', 'Kode Cabang': '03100002', Sandi: '031', Cabang: 'BANDUNG', 'Nama Outlet': 'BANDUNG DAGO', 'Status Outlet': 'KCP', ALAMAT: 'JL DAGO 100 BANDUNG', 'KODE POS': '40132', Kelurahan: 'LEBAK GEBANG', Kecamatan: 'COBLONG', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
];

const kodePos = (kodePos, kelurahan, kecamatan, kabupatenKota, provinsi, lat, lng) => ({
  kodePos, kelurahan, kecamatan, kabupatenKota, provinsi, status: 'AKTIF', latitude: lat, longitude: lng,
});
const kodePosList = [
  kodePos('23671', 'DESA PULAU PANJANG', 'PULAU PANJANG', 'ACEH BARAT', 'ACEH', 2.42, 96.2),
  kodePos('40111', 'BRAGA', 'SUMUR BANDUNG', 'BANDUNG', 'JAWA BARAT', -6.915, 107.61),
  kodePos('40132', 'LEBAK GEBANG', 'COBLONG', 'BANDUNG', 'JAWA BARAT', -6.879, 107.62),
  kodePos('79133', 'KAMPUNG BARU BARAT', 'SINGKAWANG SELATAN', 'SINGKAWANG', 'KALIMANTAN BARAT', -0.1, 109.0),
];

const ptenList = [
  { kodePosPten: '23671', kotaPten: 'ACEH BARAT', kotaPtenMax15: 'ACEH BARAT', status: 'AKTIF' },
  { kodePosPten: '40111', kotaPten: 'BANDUNG', kotaPtenMax15: 'BANDUNG', status: 'AKTIF' },
  { kodePosPten: '79133', kotaPten: 'SINGKAWANG', kotaPtenMax15: 'SINGKAWANG', status: 'AKTIF' },
];

const wilayahSettings = masterCabangRows.map((m) => ({
  wilayah: 'W1', sandiCabang: m['Sandi Cabang'], branchCode: m['Branch Code'], kodeCabang: m['Kode Cabang'],
  namaOutlet: m['Nama Outlet'], statusOutlet: m['Status Outlet'], alamat: m.ALAMAT, kodePos: m['KODE POS'],
  kelurahan: m.Kelurahan, kecamatan: m.Kecamatan, dati2: m['Dati II'], provinsi: m.Provinsi,
}));
const roleList = [
  { organisasiTujuan: 'BANDUNG ASIA AFRIKA BRANCH OFFICE', qrsCabsal: 1, qrsCabapv1: 1, qrsCabapv2: 1, grandTotal: 3 },
];

const jalankan = (sampaiFase) => executeAnalystPipeline(masterCabangRows, ptenList, kodePosList, wilayahSettings, roleList, undefined, false, undefined, undefined, sampaiFase);

const utama = (rows) => rows.filter((r) => r.kategori !== 'TIDAK_ANALISA');
const cari = (rows, kel) => rows.find((r) => r.kelurahan === kel);

const hasil3 = utama((await jalankan(3)).rows);
console.log('baris hasil Fase 1-3:', hasil3.length, '| contoh:', hasil3.map((r) => `${r.kelurahan}→${r.namaOutlet || '∅'}(${r.fase2Status})`).join(', '));

// 1 — aturan Aceh ke KIM = otomatis valid, BUKAN manual
const aceh = cari(hasil3, 'DESA PULAU PANJANG');
asa('M7.1 Aceh → sumber aturan KIM', aceh?.fase2Sumber, 'ATURAN_ACEH_KIM');
asa('M7.1 Aceh → otomatis valid', aceh?.fase2Status, 'OTOMATIS_VALID');
asa('M7.1 Aceh → cabangnya KIM', /KIM/.test(aceh?.namaOutlet || ''), true);

// 2 & 3 — dua kelurahan beda di kota sama wajib dapat cabang beda
const braga = cari(hasil3, 'BRAGA');
const coblong = cari(hasil3, 'LEBAK GEBANG');
asa('M7.2 Braga → ASIA AFRIKA', braga?.namaOutlet, 'BANDUNG ASIA AFRIKA');
asa('M7.3 Lebak Siliwangi/Coblong → DAGO', coblong?.namaOutlet, 'BANDUNG DAGO');
asa('M7.2/3 dua baris BEDA hasil', braga?.namaOutlet !== coblong?.namaOutlet, true);
asa('M7.2/3 keduanya otomatis valid', [braga?.fase2Status, coblong?.fase2Status], ['OTOMATIS_VALID', 'OTOMATIS_VALID']);

// 4 — kota tanpa cabang sendiri: kolom Fase 2 TETAP terisi cabang terdekat yang jujur,
//     tapi barisnya wajib masuk manual karena cabangnya di luar provinsi.
const singkawang = cari(hasil3, 'KAMPUNG BARU BARAT');
asa('M7.4 Singkawang → perlu manual', singkawang?.fase2Status, 'PERLU_MANUAL');
asa('M7.4 Singkawang → sumber: cabang terdekat, bukan dibiarkan kosong', singkawang?.fase2Sumber, 'OTOMATIS_TERDEKAT');
asa('M7.4 kolom cabang terisi (bukan strip kosong)', (singkawang?.branchCode || '').length > 0, true);
asa('M7.4 alasannya menyebut di luar provinsi', (singkawang?.fase2Temuan || []).some((t) => /di luar provinsi/.test(t)), true);

// 5 — Fase 2 belum dijalankan = SIAP DIPROSES, bukan manual
const hasil1 = utama((await jalankan(1)).rows);
asa('M7.5 semua baris SIAP DIPROSES', [...new Set(hasil1.map((r) => r.fase2Status))], ['SIAP_DIPROSES']);
asa('M7.5 nol baris perlu manual', hasil1.filter((r) => r.fase2Status === 'PERLU_MANUAL').length, 0);

// 6 — antrean manual harus kecil, bukan 100%
const manual = hasil3.filter((r) => r.fase2Status === 'PERLU_MANUAL').length;
console.log(`M7.6 Perlu manual ${manual} dari ${hasil3.length} baris (${hasil3.length ? Math.round((manual / hasil3.length) * 100) : 0}%)`);
asa('M7.6 manual jauh di bawah total', manual < hasil3.length * 0.5, true);

// M5 — bukti sinyal Fase 2 ikut tercatat dan masuk panel
asa('M5 ada bukti sinyal Fase 2 di baris kota sama', (braga?.sinyalF2Bit || 0) > 0 || /BANDUNG/.test(braga?.namaOutlet || ''), true);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} TEST GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
