// E8 — ukur akurasi pencocok nama kota pada himpunan pasangan BERLABEL yang lebih
// besar dari 27 (klaim lama). Sengaja TIDAK ada pasangan identik: itu hanya mengukur
// `a === b`, bukan mesinnya. Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-akurasi-nama.mjs
import { calculateCityMatchScore } from './out/entry-uji.js';

const AMBANG_TERIMA = 0.88; // sama dengan produksi: di bawah ini kota tidak dianggap cocok

// [a, b, harusMatch, kategori]
const PASANGAN = [
  // ── positif: salah ketik & ejaan lama ─────────────────────────────────────
  ['PEKALONAGN', 'PEKALONGAN', true, 'huruf tertukar'],
  ['MAKASAR', 'MAKASSAR', true, 'huruf ganda hilang'],
  ['SOERABAYA', 'SURABAYA', true, 'ejaan lama'],
  ['GOEBENG', 'GUBENG', true, 'ejaan lama'],
  ['SINGARADJA', 'SINGARAJA', true, 'ejaan lama'],
  ['TJUNG PANDANG', 'UJUNG PANDANG', true, 'ejaan lama'],
  ['JAKARTA PSAT', 'JAKARTA PUSAT', true, 'huruf hilang'],
  ['SMARANG TENGAH', 'SEMARANG TENGAH', true, 'huruf hilang'],
  ['SURABAYA WTAN', 'SURABAYA WETAN', true, 'huruf hilang'],
  ['BANDAR LAMPUANG', 'BANDAR LAMPUNG', true, 'vokal tertukar'],
  ['MANOKWAR', 'MANOKWARI', true, 'huruf hilang'],
  ['TJINIAN', 'CIANJUR', true, 'ejaan lama'],
  ['OEGHESOEKARNOPUTRI', 'SOEKARNO PUTRI', false, 'ejaan lama tapi beda nama'],
  ['PONDOK AREN', 'PONDOK AREN', true, 'persis (kontrol rendah)'],
  // ── positif: spasi / tanda baca / urutan kata ─────────────────────────────
  ['PANGKAL PINANG', 'PANGKALPINANG', true, 'spasi vs gabung'],
  ['TEBING TINGGI', 'TEBINGTINGGI', true, 'spasi vs gabung'],
  ['TANJUNG BALAI', 'TANJUNGBALAI', true, 'spasi vs gabung'],
  ['PADANG PANJANG', 'PADANGPANJANG', true, 'spasi vs gabung'],
  ['BUKITTINGGI', 'BUKIT TINGGI', true, 'spasi vs gabung'],
  ['BANDUNG BARAT', 'BARAT BANDUNG', true, 'urutan kata terbalik'],
  ['CABANG-PEMBANTU BANDUNG', 'CABANG PEMBANTU BANDUNG', true, 'tanda strip'],
  ['JL. RAYA KEMBROS 10', 'JL RAYA KEMBROS 10', true, 'tanda baca'],
  ['KOTA MEDAN BALAI KOTA', 'BALAI KOTA MEDAN', true, 'urutan kata'],
  // ── positif: gelar administratif dibuang ──────────────────────────────────
  ['KOTA BANDUNG', 'BANDUNG', true, 'prefix KOTA'],
  ['KAB BOGOR', 'BOGOR', true, 'prefix KAB'],
  ['KABUPATEN TANGERANG', 'TANGERANG', true, 'prefix KABUPATEN'],
  ['KEP SERIBU', 'KEPULAUAN SERIBU', true, 'singkatan administratif'],
  ['KABUPATEN MANOKWARI', 'MANOKWARI', true, 'prefix kabupaten'],
  ['PROV KALIMANTAN TIMUR', 'KALIMANTAN TIMUR', true, 'prefix PROV'],
  // ── positif: pemotongan 15 karakter master PTEN ───────────────────────────
  ['MANDAILING NATA', 'MANDAILING NATAL', true, 'potong 15 karakter'],
  ['BENGKULU SEL', 'BENGKULU SELATAN', true, 'singkatan per kata'],
  ['SERAM BAG TIMUR', 'SERAM BAGIAN TIMUR', true, 'singkatan per kata'],
  ['KALIMANTAN BARAT', 'KALIMANTAN BARAT', true, 'persis (kontrol)'],
  // ── positif: kota kembar dengan jenis daerah berbeda tetap beda ───────────
  ['BOGOR', 'BOGOR', true, 'persis (kontrol)'],
  // ── negatif: beda wilayah sungguhan ───────────────────────────────────────
  ['TANGERANG', 'TANGERANG SELATAN', false, 'kota otonom vs kabupaten'],
  ['BANDUNG', 'BANDUNG BARAT', false, 'kota vs kabupaten tetangga'],
  ['JAKARTA PUSAT', 'JAKARTA TIMUR', false, 'kota administrasi beda'],
  ['BALI', 'BALIKPAPAN', false, 'nama mirip, pulau vs kota'],
  ['MEDAN', 'MATARAM', false, 'mirip huruf, kota beda'],
  ['PEKANBARU', 'PANGKALPINANG', false, 'sama-sama Sumatera, beda kota'],
  ['BARAT', 'TIMUR', false, 'arah berlawanan'],
  ['SURABAYA', 'SIDOARJO', false, 'kota beda'],
  ['ALAM SUTRA', 'ALAM SUTRA UTARA', false, 'kawasan vs kelurahan'],
  ['JL MELAWAI', 'JL MELAWAI RAYA', false, 'nama jalan beda'],
  ['KCP 001', 'KCP 002', false, 'nomor cabang beda'],
  ['BANDAR LAMPUNG', 'BANDUNG', false, 'prefix mirip, kota beda'],
  ['SEMARANG', 'SRAGEN', false, 'sama-sama Jateng, beda kota'],
  ['PASURUAN', 'BATU', false, 'kota tetangga'],
  ['MALANG', 'MALANG KECAMATAN', false, 'kota vs gelar'],
  ['DEPOK', 'SIDOARJO', false, 'empat huruf beda'],
  ['BITUNG', 'BONTANG', false, 'mirip huruf, propinsi beda'],
  ['PAREPARE', 'PARIAMAN', false, 'mirip huruf, pulau beda'],
  ['TEGAL', 'TUAL', false, 'tiga huruf sama'],
  ['SALATIGA', 'SOLIGAPURA', false, 'sama-sama Jateng, beda'],
  ['GUNUNGSITOLI', 'GUNUNG SUGIH', false, 'kata pertama sama'],
  ['NUSA TENGGARA BARAT', 'NUSA TENGGARA TIMUR', false, 'arah beda'],
  ['KALIMANTAN TENGAH', 'KALIMANTAN SELATAN', false, 'arah beda'],
  ['SUMATERA UTARA', 'SUMATERA UTARA BARAT', false, 'arah tambahan'],
  ['ACEH', 'ACEH BARAT', false, 'provinsi vs kabupaten'],
  ['SRI SAWALJO', 'SRI SAWARJO', false, 'bukan nama kota'],
  ['JAMBI', 'SAMOSIR', false, 'tidak berhubungan'],
  ['KUPANG', 'KAPUAS', false, 'huruf sama beda urutan'],
  ['PRAYA', 'PAREPARE', false, 'awal sama'],
  ['LEBAK', 'LEMBANG', false, 'awal sama'],
  ['POHUWATO', 'BOALEMO', false, 'sama-sama Gorontalo, beda'],
  ['MAMUJU', 'MAJENE', false, 'sama-sama Sulbar, beda'],
  ['BUKITTINGGI', 'BUKIT BARISA', false, 'kata pertama mirip'],
  ['TANJUNG PINANG', 'TANJUNG REDEB', false, 'kata pertama sama'],
  ['SERANG', 'SEMARAPURA', false, 'awal sama'],
  ['SOLOK', 'SOLOK SELATAN', false, 'kabupaten vs kota'],
  ['LABUHAN BATU', 'LABUHA', false, 'awal sama'],
  ['BENER MERIAH', 'TAHAN BENER', false, 'satu kata sama'],
];

function lev(a, b) {
  const m = [...a];
  const n = [...b];
  let prev = Array.from({ length: n.length + 1 }, (_, j) => j);
  for (let i = 1; i <= m.length; i++) {
    const cur = [i];
    for (let j = 1; j <= n.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (m[i - 1] === n[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n.length] / Math.max(m.length, n.length, 1);
}
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const baselineLev = (a, b) => lev(norm(a), norm(b)) >= 0.88;

const hasil = { salahGabung: [], lewat: [], benar: 0, total: 0 };
const perKategori = new Map();
for (const [a, b, harus, kategori] of PASANGAN) {
  const { score } = calculateCityMatchScore(a, b);
  const prediksi = score >= AMBANG_TERIMA;
  const ok = prediksi === harus;
  hasil.total++;
  if (ok) hasil.benar++;
  else if (harus) hasil.lewat.push(`${a} ⟷ ${b} (${kategori}) skor ${(score * 100).toFixed(0)}%`);
  else hasil.salahGabung.push(`${a} ⟷ ${b} (${kategori}) skor ${(score * 100).toFixed(0)}%`);
  const k = perKategori.get(kategori) || { ok: 0, n: 0 };
  k.n++;
  if (ok) k.ok++;
  perKategori.set(kategori, k);
}

const pos = PASANGAN.filter((p) => p[2]).length;
const neg = PASANGAN.length - pos;
const bl = PASANGAN.filter(([a, b, harus]) => baselineLev(a, b) === harus).length;

console.log(`Himpunan: ${PASANGAN.length} pasangan berlabel (${pos} harus cocok, ${neg} harus beda)`);
console.log(`Ambang produksi ${AMBANG_TERIMA * 100}%`);
console.log(`Akurasi mesin : ${((hasil.benar / hasil.total) * 100).toFixed(1)}% (${hasil.benar}/${hasil.total})`);
console.log(`Akurasi Levenshtein saja: ${((bl / hasil.total) * 100).toFixed(1)}% (${bl}/${hasil.total})`);
console.log(`\nSALAH GABUNG (berbahaya: dua kota beda disatukan) = ${hasil.salahGabung.length}`);
hasil.salahGabung.forEach((t) => console.log('  - ' + t));
console.log(`\nTERLEWAT (seharusnya cocok, mesin menolak → masuk manual) = ${hasil.lewat.length}`);
hasil.lewat.forEach((t) => console.log('  - ' + t));
