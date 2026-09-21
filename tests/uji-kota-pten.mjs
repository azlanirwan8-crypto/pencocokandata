// Regresi tabrakan kota Fase 1 (kasih nama operator): "Kabupaten Halmahera Timur"
// (Data KodePos) × "HALMAHERA TIMUR" (Data PTEN) pernah dibajak cabang "HALMAHERA UTARA"
// yang skornya 0,93 lolos ambang 0,88, lalu nama kota PTEN ditimpa Dati II pembajak itu
// sehingga seluruh kelurahan Halmahera Timur jatuh ke "Perlu Analisa Manual".
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-kota-pten.mjs
import { executeAnalystPipeline, cityMatchKey } from './out/entry-uji.js';

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
const kp = (kodePos, kelurahan, kecamatan, kabupatenKota, provinsi) => ({
  kodePos, kelurahan, kecamatan, kabupatenKota, provinsi, status: 'AKTIF',
});
const pten = (kodePosPten, kotaPten) => ({ kodePosPten, kotaPten, kotaPtenMax15: kotaPten, status: 'AKTIF' });

// ── nama kota: gelar administratif dibuang, arah tidak boleh dianggap sama ──
asa('cityMatchKey Kabupaten Halmahera Timur', cityMatchKey('Kabupaten Halmahera Timur'), 'HALMAHERA TIMUR');
asa('cityMatchKey Kabupaten Kepulauan Talaud', cityMatchKey('Kabupaten Kepulauan Talaud'), cityMatchKey('KEPULAUAN TALAUD'));
asa('TIMUR vs UTARA bukan kunci yang sama', cityMatchKey('HALMAHERA TIMUR') === cityMatchKey('HALMAHERA UTARA'), false);

// ── pipeline nyata: Halmahera Timur dengan SATU-SATUNYA cabang di Halmahera Utara ──
const jalankan = (masterCabang) =>
  executeAnalystPipeline(
    masterCabang,
    [pten('97862', 'HALMAHERA TIMUR'), pten('97762', 'HALMAHERA UTARA')],
    [
      kp('97860', 'BABURINO', 'MABA', 'Kabupaten Halmahera Timur', 'MALUKU UTARA'),
      kp('97762', 'KANJORU', 'HALMAHERA', 'Kabupaten Halmahera Utara', 'MALUKU UTARA'),
    ],
    [],
    []
  );

const utaraSaja = [cabang({ 'Nama Outlet': 'TOBELO', Cabang: 'HALMAHERA UTARA', 'Status Outlet': 'KC', 'Dati II': 'HALMAHERA UTARA', Provinsi: 'MALUKU UTARA', 'KODE POS': '97762', Kelurahan: 'KANJORU', Kecamatan: 'HALMAHERA', 'Branch Code': '09100001', 'Kode Cabang': '09100001', 'Sandi Cabang': '09100001' })];
const h1 = await jalankan(utaraSaja);
const baburino = h1.rows.filter((r) => r.kelurahan === 'BABURINO');
asa('Baburino muncul 1x di hasil (bukan di antrean manual)', baburino.length, 1);
asa('kota Baburino = HALMAHERA TIMUR, bukan hasil bajakan', baburino[0]?.kotaPten, 'HALMAHERA TIMUR');
asa('Baburino berstatus DIANALISA', baburino[0]?.kategori, 'DIANALISA');
asa('kode pos PTEN ikut terbawa', baburino[0]?.kodePosPten, '97862');
asa('tidak ada baris BABURINO atas nama HALMAHERA UTARA', h1.rows.filter((r) => r.kelurahan === 'BABURINO' && r.kotaPten === 'HALMAHERA UTARA').length, 0);
// Cabang UTARA boleh MEMINJAMI kolom Fase 2 kota TIMUR sebagai kandidat terdekat —
// yang tidak boleh lagi adalah membajak NAMA KOTA-nya. Barisnya wajib tetap manual.
asa('Baburino dipasangi cabang terdekat (TOBELO), bukan dibiarkan kosong', baburino[0]?.namaOutlet, 'TOBELO');
asa('tapi statusnya tetap perlu manual', baburino[0]?.fase2Status, 'PERLU_MANUAL');
asa('alasannya menyebut cabang di luar kota', (baburino[0]?.fase2Temuan || []).some((t) => /di luar kota/.test(t)), true);
asa('KanJORU tetap kotanya HALMAHERA UTARA', h1.rows.find((r) => r.kelurahan === 'KANJORU')?.kotaPten, 'HALMAHERA UTARA');

// ── kontrol positif: kota yang cabangnya memang ada sendiri tetap terisi ──
const timurJuga = [...utaraSaja, cabang({ 'Nama Outlet': 'MABA', Cabang: 'HALMAHERA TIMUR', 'Status Outlet': 'KCP', 'Dati II': 'HALMAHERA TIMUR', Provinsi: 'MALUKU UTARA', 'KODE POS': '97862', Kelurahan: 'BABURINO', Kecamatan: 'MABA', 'Branch Code': '09100002', 'Kode Cabang': '09100002', 'Sandi Cabang': '09100002' })];
const h2 = await jalankan(timurJuga);
const b2 = h2.rows.find((r) => r.kelurahan === 'BABURINO');
asa('cabang sekota tetap terpakai (Fase 2 tidak jadi kosong)', b2?.namaOutlet, 'MABA');
asa('dan tetap kota HALMAHERA TIMUR', b2?.kotaPten, 'HALMAHERA TIMUR');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} TEST GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
