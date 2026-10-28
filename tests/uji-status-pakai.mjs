// Status Pakai Data Cabang — cabang dianggap dipakai kalau kantornya muncul di Data Final.
// Kunci = identitas cabang yang DISALIN Fase 2, bukan nomor urut dan bukan `sourceRowIndex`
// (yang indeksnya menunjuk `itemsToProcess`, bukan `masterRows`).
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-status-pakai.mjs
import {
  STATUS_BELUM_PAKAI, STATUS_PAKAI, adalahCabangTerpakai, himpunCabangTerpakai,
  indeksCabangTerpakai, kunciIdentitasCabang, paketFase2DariMaster, statusPakaiCabang,
} from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

const cabang = (o) => ({
  Wilayah: '', 'Sandi Cabang': '', Sandi: '', Cabang: '', 'Branch Code': '', 'Kode Cabang': '',
  'Nama Outlet': '', 'Status Outlet': 'Aktif', ALAMAT: '', 'KODE POS': '', Kelurahan: '',
  Kecamatan: '', 'Dati II': '', 'Kode Dati II': '', Provinsi: '', Telp: '', ...o,
});

const dago = cabang({
  'Sandi Cabang': '03100002', 'Branch Code': '03100002', 'Kode Cabang': '03100002', Sandi: '031',
  Cabang: 'BANDUNG', 'Nama Outlet': 'Bandung Dago', ALAMAT: 'JL DAGO 100 BANDUNG', 'KODE POS': '40132',
});
const asiaAfrika = cabang({
  'Sandi Cabang': '03100001', 'Branch Code': '03100001', 'Kode Cabang': '03100001', Sandi: '031',
  Cabang: 'BANDUNG', 'Nama Outlet': 'BANDUNG ASIA AFRIKA', ALAMAT: 'JL ASIA AFRIKA 126 BANDUNG', 'KODE POS': '40111',
});
// Cabang tanpa Branch Code/Kode Cabang sama sekali — hanya bisa dikenali dari outlet + alamat.
const tanpaKode = cabang({
  Cabang: 'BIAK', 'Nama Outlet': 'BIAK KOTOR', ALAMAT: 'JL SERUI 5 BIAK', 'KODE POS': '99753',
});
const master = [dago, asiaAfrika, tanpaKode];

// Baris Data Final dibangun dari rumus salinan yang SAMA dengan pipeline, jadi uji ini
// menangkap perubahan pada `paketFase2DariMaster` juga.
const barisFinal = (m, lebih = {}) => ({ id: `f-${m['Nama Outlet']}`, ...lebih, ...paketFase2DariMaster(m, []) });

// 1. Pakainya kunci, bukan nomor urut / sourceRowIndex
const pakai = indeksCabangTerpakai([barisFinal(dago, { sourceRowIndex: 7, no: 999 })]);
asa('cabang yang kantornya ada di Data Final = Digunakan', statusPakaiCabang(dago, pakai), STATUS_PAKAI);
asa('cabang lain tidak ikut berubah', statusPakaiCabang(asiaAfrika, pakai), STATUS_BELUM_PAKAI);
asa('sourceRowIndex tidak dipakai sebagai kunci', adalahCabangTerpakai(asiaAfrika, pakai), false);

// 2. Bentuk kunci: baris master dan baris analisa menghasilkan kunci yang sama
asa('kunci baris master == kunci baris analisa', kunciIdentitasCabang(dago), kunciIdentitasCabang(barisFinal(dago)));

// 3. Cabang tanpa kode cabang tetap dikenali lewat outlet + alamat
const pakaiTanpaKode = indeksCabangTerpakai([barisFinal(tanpaKode)]);
asa('tanpa Branch Code: tetap cocok lewat outlet+alamat', statusPakaiCabang(tanpaKode, pakaiTanpaKode), STATUS_PAKAI);
asa('tanpa Branch Code: cabang lain tidak ikut kena', himpunCabangTerpakai(master, pakaiTanpaKode).size, 1);

// 4. Besar/kecil dan spasi berlebih tidak boleh membelah pasangan (hanya jalur outlet+alamat)
const pakaiKasar = indeksCabangTerpakai([barisFinal({ ...dago, 'Branch Code': '', 'Kode Cabang': '', 'Nama Outlet': '  bandung   dago  ', ALAMAT: 'jl dago 100   bandung' })]);
asa('beda kapital & spasi tetap satu cabang', statusPakaiCabang(dago, pakaiKasar), STATUS_PAKAI);

// 5. Data Final kosong = belum ada yang dipakai (bukan semuanya terpakai)
asa('Data Final kosong: tidak ada cabang terpakai', himpunCabangTerpakai(master, indeksCabangTerpakai([])).size, 0);

// 6. Satu sumber angka: himpunan baris, badge sel, dan penghitung menilai sama
const pakaiDua = indeksCabangTerpakai([barisFinal(dago), barisFinal(asiaAfrika)]);
const terhimpun = himpunCabangTerpakai(master, pakaiDua);
asa('penghitung pakai = jumlah badge Digunakan', terhimpun.size, master.filter((m) => adalahCabangTerpakai(m, pakaiDua)).length);
asa('dua cabang dipakai dari tiga', [terhimpun.size, master.length], [2, 3]);

// 7. Kode kosong/'-' tidak boleh jadi kunci yang menjaring semua baris
asa('Branch Code placeholder tidak jadi kunci', kunciIdentitasCabang(cabang({ 'Branch Code': '-', 'Kode Cabang': '0' })), []);

console.log(gagal === 0 ? 'SEMUA LULUS' : `${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
