// Status Pakai Data PTEN — kode pos PTEN dianggap dipakai kalau kode posnya muncul
// di baris Data Final (hasil analisa yang sudah selesai/disetujui).
// Kunci = kode pos 5 digit, bukan nomor urut baris: satu baris PTEN bisa melahirkan
// banyak baris Data Final yang semuanya membawa kode pos PTEN yang sama.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-pten-pakai.mjs
import {
  STATUS_BELUM_PAKAI, STATUS_PAKAI, adalahPtenTerpakai, himpunPtenTerpakai,
  indeksKodePosPtenTerpakai, normKodePosPten, statusPakaiPten,
} from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

const pten = (kodePosPten, kotaPten = 'JAKARTA PUSAT') => ({ kodePosPten, kotaPten, status: 'AKTIF' });
const final = (kodePosPten) => ({ id: `f-${kodePosPten}`, kodePosPten });

const jakarta = pten('10110');
const jakarta2 = pten('10120');
const bandung = pten('40132');
const berawalanNol = pten('00110', 'CONTOH');
// Dua baris master dengan kode pos sama (mis. beda kota) — keduanya memakai kode pos itu.
const kembar = pten('10110', 'KOTA LAIN');
const master = [jakarta, jakarta2, bandung, berawalanNol, kembar];

// 1. Kode pos yang muncul di Data Final = Digunakan; yang tidak = Belum digunakan
const pakai = indeksKodePosPtenTerpakai([final('10110'), final('40132')]);
asa('kode pos di Data Final = Digunakan', statusPakaiPten(jakarta, pakai), STATUS_PAKAI);
asa('kode pos lain tidak ikut berubah', statusPakaiPten(jakarta2, pakai), STATUS_BELUM_PAKAI);
asa('satu baris Final cukup untuk menandai kode pos', adalahPtenTerpakai(bandung, pakai), true);

// 2. Normalisasi: spasi/titik tidak boleh memutus pasangan
asa('kode pos bertitik tetap cocok', normKodePosPten('10.110'), '10110');
asa('spasi berlebih tetap cocok', adalahPtenTerpakai(jakarta, indeksKodePosPtenTerpakai([final(' 10110 ')])), true);
asa('nol di depan dipertahankan', normKodePosPten('00110'), '00110');
asa('nol di depan tetap dikenali', statusPakaiPten(berawalanNol, indeksKodePosPtenTerpakai([final('00110')])), STATUS_PAKAI);

// 3. Data Final kosong = belum ada yang dipakai (bukan semuanya terpakai)
asa('Data Final kosong: semua Belum digunakan', himpunPtenTerpakai(master, indeksKodePosPtenTerpakai([])).size, 0);
asa('Data Final kosong: status per baris', statusPakaiPten(jakarta, indeksKodePosPtenTerpakai([])), STATUS_BELUM_PAKAI);

// 4. Baris Final tanpa kode pos tidak boleh menjaring semua baris
asa('kode pos kosong tidak jadi kunci', indeksKodePosPtenTerpakai([final(''), final(null)]).size, 0);

// 5. Satu sumber angka: himpunan baris dan penghitung menilai sama
const terhimpun = himpunPtenTerpakai(master, pakai);
asa('penghitung pakai = jumlah badge Digunakan', terhimpun.size, master.filter((m) => adalahPtenTerpakai(m, pakai)).length);
asa('kode pos kembar ikut Digunakan', terhimpun.has(kembar), true);
asa('tiga baris (dua kode pos) dari lima dipakai', terhimpun.size, 3);

console.log(gagal === 0 ? 'SEMUA LULUS' : `${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
