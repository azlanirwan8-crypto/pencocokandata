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
// yang tidak boleh lagi adalah membajak NAMA KOTA-nya. Sejak 516fbad peminjaman lintas
// kota ini warning non-fatal: statusnya tetap OTOMATIS_VALID, alasannya di `fase2Temuan`.
asa('Baburino dipasangi cabang terdekat (TOBELO), bukan dibiarkan kosong', baburino[0]?.namaOutlet, 'TOBELO');
asa('statusnya tetap terisi otomatis (warning lintas kota tidak mengunci baris)', baburino[0]?.fase2Status, 'OTOMATIS_VALID');
asa('alasannya menyebut cabang di luar kota', (baburino[0]?.fase2Temuan || []).some((t) => /di luar kota/.test(t)), true);
asa('KanJORU tetap kotanya HALMAHERA UTARA', h1.rows.find((r) => r.kelurahan === 'KANJORU')?.kotaPten, 'HALMAHERA UTARA');

// ── kontrol positif: kota yang cabangnya memang ada sendiri tetap terisi ──
const timurJuga = [...utaraSaja, cabang({ 'Nama Outlet': 'MABA', Cabang: 'HALMAHERA TIMUR', 'Status Outlet': 'KCP', 'Dati II': 'HALMAHERA TIMUR', Provinsi: 'MALUKU UTARA', 'KODE POS': '97862', Kelurahan: 'BABURINO', Kecamatan: 'MABA', 'Branch Code': '09100002', 'Kode Cabang': '09100002', 'Sandi Cabang': '09100002' })];
const h2 = await jalankan(timurJuga);
const b2 = h2.rows.find((r) => r.kelurahan === 'BABURINO');
asa('cabang sekota tetap terpakai (Fase 2 tidak jadi kosong)', b2?.namaOutlet, 'MABA');
asa('dan tetap kota HALMAHERA TIMUR', b2?.kotaPten, 'HALMAHERA TIMUR');

// ── KP2: penjaga PROVINSI — nama mirip beda provinsi tidak boleh jadi jodoh ──
// Pindai cloud 2026-09-29 atas 479 nama kota PTEN × 172 nama kota Data Kode Pos:
// BANGKA (Kep. Bangka Belitung) vs BANGKALAN (Jawa Timur) dinilai mesin 0,93 dan
// SOLO vs SOLOK 0,96 — bentuk hurufnya tidak bisa dibedakan dari salah ketik yang
// wajib lolos (MANOKWAR → MANOKWARI), jadi provinsi yang memutuskan. Kasus nyatanya
// dilaporkan operator: kelurahan Kota Solo digariskan 1.356 km ke kantor SOLOK.
const jalankanNama = (daftarPten) =>
  executeAnalystPipeline(
    [cabang({ 'Nama Outlet': 'SUNGAILIAT', Cabang: 'BANGKA', 'Status Outlet': 'KC', 'Dati II': 'BANGKA', Provinsi: 'KEPULAUAN BANGKA BELITUNG', 'KODE POS': '33115', Kelurahan: 'SUNGUELIAU', Kecamatan: 'SUNGAILIAT', 'Branch Code': '04100001', 'Kode Cabang': '04100001', 'Sandi Cabang': '04100001' })],
    daftarPten,
    [
      kp('33115', 'SUNGUELIAU', 'SUNGAILIAT', 'Kabupaten Bangka', 'KEPULAUAN BANGKA BELITUNG'),
      kp('69161', 'TANAH MERAH', 'BANGKALAN', 'Kabupaten Bangkalan', 'JAWA TIMUR'),
    ],
    [],
    []
  );

const h3 = await jalankanNama([pten('69161', 'BANGKALAN')]);
const bangka = h3.rows.find((r) => r.kelurahan === 'SUNGUELIAU');
asa('KP2 Bangka tidak dibajak BANGKALAN dari Jawa Timur', bangka?.kotaPten || '(kosong)', '(kosong)');
asa('KP2 barisnya masuk antrean, bukan hilang', [bangka?.kategori, bangka?.statusAnalisa], ['TIDAK_ANALISA', 'PERLU_REVIEW']);
asa('KP2 barisnya tetap ada (tidak hilang diam-diam)', h3.rows.filter((r) => r.kelurahan === 'SUNGUELIAU').length, 1);
const h4 = await jalankanNama([pten('69161', 'BANGKALAN'), pten('33115', 'BANGKA')]);
asa('KP2 begitu PTEN-nya benar, kotanya terisi seperti biasa', h4.rows.find((r) => r.kelurahan === 'SUNGUELIAU')?.kotaPten, 'BANGKA');

// ── KP3: nama kota PTEN yang SAMA duduk di dua provinsi — yang dipilih harus rekor
//    yang blok kode posnya memang milik kota master ini. Pindai cloud 2026-09-29:
//    76 baris kelurahan BANJAR (Kalimantan Selatan, 70xxx) ikut membawa kode pos
//    PTEN 46322 milik BANJAR (Jawa Barat) karena `candidates[0]` yang menang.
// Kode pos kantor sengaja 70322 — TIDAK ada di daftar PTEN — supaya jalur
// `candidates.find(kodePos === kodePosPten)` tidak menang dan pemilihan per blok
// yang memutuskan (kalau kantor kebetulan 70155, jalur tepat sudah benar sendiri).
const jalankanBanjar = (daftarPten) =>
  executeAnalystPipeline(
    [cabang({ 'Nama Outlet': 'BANJAR BARU', Cabang: 'BANJAR', 'Status Outlet': 'KC', 'Dati II': 'BANJAR', Provinsi: 'KALIMANTAN SELATAN', 'KODE POS': '70322', Kelurahan: 'TURTANG JAYA', Kecamatan: 'BANJAR', 'Branch Code': '06100001', 'Kode Cabang': '06100001', 'Sandi Cabang': '06100001' })],
    daftarPten,
    [
      kp('70155', 'TURTANG JAYA', 'BANJAR', 'Kabupaten Banjar', 'KALIMANTAN SELATAN'),
      kp('70181', 'PARUNG', 'JAWA', 'Kabupaten Banjar', 'KALIMANTAN SELATAN'),
    ],
    [],
    []
  );

const h5 = await jalankanBanjar([pten('46322', 'BANJAR'), pten('70155', 'BANJAR')]);
// Kelurahan yang kode posnya TIDAK ada di tabel PTEN: di sini `candidates[0]` yang
// dulu memutuskan, jadi inilah baris yang benar-benar membuktikan penjaga blok.
const parung = h5.rows.find((r) => r.kelurahan === 'PARUNG');
asa('KP3 kotanya tetap BANJAR', parung?.kotaPten, 'BANJAR');
asa('KP3 Parung (70181) dapat kode pos PTEN blok 70xxx, bukan 46xxx Jawa Barat', parung?.kodePosPten, '70155');
asa('KP3 kontrol: kelurahan yang kode posnya persis di PTEN tetap pakai yang persis',
  h5.rows.find((r) => r.kelurahan === 'TURTANG JAYA')?.kodePosPten, '70155');
asa('KP3 kontrol: bila hanya rekor Jawa Barat yang ada, tetap terpakai (jangan kosong)',
  (await jalankanBanjar([pten('46322', 'BANJAR')])).rows.find((r) => r.kelurahan === 'PARUNG')?.kodePosPten, '46322');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} TEST GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
