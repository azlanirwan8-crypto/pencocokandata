// Gerbang provinsi (dilaporkan operator 2026-09-29): 62 kelurahan Kota Solo dipasangi
// kantor SOLOK di Sumatera Barat — 1.356 km — dan lolos sampai Data Final.
// Dua lapis yang diuji di sini:
//   1. `calculateRealDistance` boleh lagi menyimpulkan "dekat" dari kemiripan nama
//      lintas provinsi ('SOLOK' memuat 'SOLO' → dulu dinilai 9,7 km dan MENANG).
//   2. `nyebrangWilayahCabang` = predikat tunggal yang dipakai gerbang setujui massal
//      (App) dan saringan "Lintas Provinsi" (grid). Ia harus SAMA dengan kategori
//      PULAU/PROVINSI pada kartu anomali, supaya angka kartu tidak menyimpang dari
//      baris yang benar-benar tertahan.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-gerbang-provinsi.mjs
import { calculateRealDistance, indeksWilayahCabang, lintasWilayahCabang, nyebrangWilayahCabang, detectFinalAnomalies, buildMasterProximityIndex, findClosestMasterRecommendation } from './out/entry-uji.js';

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
const target = (o) => ({
  No: 1, Wilayah: '', 'Sandi Cabang': '', Provinsi: '', 'Dati II': '', Kelurahan: '', Kecamatan: '',
  'KODE POS': '', ALAMAT: '', ...o,
});

// ── 1. GERBANG JARAK: nama mirip beda provinsi tidak lagi dihitung berdekatan ──
const solo = target({ Provinsi: 'JAWA TENGAH', 'Dati II': 'SOLO', Kelurahan: 'KEPATIHAN KULON', Kecamatan: 'LAWEYAN', 'KODE POS': '57129' });
const solok = cabang({ 'Nama Outlet': 'SOLOK', 'Kode Cabang': '14100001', 'Branch Code': '14100001', Provinsi: 'SUMATERA BARAT', 'Dati II': 'SOLOK', Kelurahan: 'ALAHAN PANJANG', Kecamatan: 'LUBUK BEGALANG', 'KODE POS': '27322' });
const jarakNyebrang = calculateRealDistance(solo, solok);
asa('JP1 SOLO × SOLOK tidak lagi disebut satu kota', /^Satu /.test(jarakNyebrang.basis), false);
asa('JP1 SOLO × SOLOK tidak lagi disebut satu kecamatan/kelurahan', /Satu Kecamatan|Satu Kelurahan|Satu Koridor/.test(jarakNyebrang.basis), false);
console.log(`     jarak yang dilaporkan sekarang: ${jarakNyebrang.formattedDistance} — ${jarakNyebrang.basis}`);

// Kontrol: penjaga ini hanya boleh membunyikan provinsinya, bukan merusak pasangan benar.
const soloSediri = cabang({ 'Nama Outlet': 'SRIKANDI', 'Kode Cabang': '09100002', Provinsi: 'JAWA TENGAH', 'Dati II': 'SURAKARTA SOLO', Kelurahan: 'KEPATIHAN KULON', Kecamatan: 'LAWEYAN', 'KODE POS': '57129' });
asa('JP1 kontrol: SOLO × kantor Solo (Jateng) tetap satu kota', /^Satu /.test(calculateRealDistance(solo, soloSediri).basis), true);
const provKabupaten = cabang({ 'Nama Outlet': 'SOLOK', Provinsi: '', 'Dati II': 'SOLOK', Kelurahan: 'ALAHAN PANJANG', Kecamatan: 'LUBUK BEGALANG' });
asa('JP1 provinsi tidak diketahui → penjaga diam (tidak menebak)', /^Satu /.test(calculateRealDistance(solo, provKabupaten).basis), true);
// Nama kelurahan/kecamatan yang dipakai bersama dua provinsi: dulu menang di KASUS 1/2.
const padangTarget = target({ Provinsi: 'JAWA TENGAH', 'Dati II': 'BATANG', Kelurahan: 'PADANG', Kecamatan: 'LIMPUNG', 'KODE POS': '51274' });
const padangMaster = cabang({ 'Nama Outlet': 'PADANG', Provinsi: 'SUMATERA BARAT', 'Dati II': 'PADANG', Kelurahan: 'PADANG', Kecamatan: 'PADANG BARAT', 'KODE POS': '25100' });
asa('JP1 kelurahan "PADANG" Jateng × kantor PADANG Sumbar bukan satu kelurahan', calculateRealDistance(padangTarget, padangMaster).basis, 'Antar Wilayah (PADANG)');

// ── 2. GERBANG SETUJU MASSAL: predikat tunggal, satu sumber dengan kartu anomali ──
const masterRows = [
  cabang({ 'Nama Outlet': 'SOLOK', 'Kode Cabang': '14100001', 'Branch Code': '14100001', Provinsi: 'SUMATERA BARAT', 'Dati II': 'SOLOK', Kelurahan: 'ALAHAN PANJANG', Kecamatan: 'LUBUK BEGALANG', 'KODE POS': '27322' }),
  cabang({ 'Nama Outlet': 'SRIKANDI', 'Kode Cabang': '09100002', 'Branch Code': '09100002', Provinsi: 'JAWA TENGAH', 'Dati II': 'SURAKARTA', Kelurahan: 'KEPATIHAN KULON', Kecamatan: 'LAWEYAN', 'KODE POS': '57129' }),
  cabang({ 'Nama Outlet': 'BANDUNG ASIA AFRIKA', 'Kode Cabang': '03100001', 'Branch Code': '03100001', Provinsi: 'JAWA BARAT', 'Dati II': 'BANDUNG', Kelurahan: 'BRAGA', Kecamatan: 'SUMUR BANDUNG', 'KODE POS': '40113' }),
  cabang({ 'Nama Outlet': 'KIM BANDA ACEH', 'Kode Cabang': '01100001', 'Branch Code': '01100001', Provinsi: 'ACEH', 'Dati II': 'BANDA ACEH', Kelurahan: 'KAMPANG BARU', Kecamatan: 'BANDA ACEH', 'KODE POS': '23115' }),
  cabang({ 'Nama Outlet': 'MEULABOH', 'Kode Cabang': '01100002', 'Branch Code': '01100002', Provinsi: 'ACEH', 'Dati II': 'ACEH BARAT', Kelurahan: 'PENGAHA', Kecamatan: 'MEULABOH', 'KODE POS': '23657' }),
];
const idx = indeksWilayahCabang(masterRows);

const baris = (o) => ({
  provinsi: 'JAWA TENGAH', kotaPten: 'SOLO', kotaPtenMax15: 'SOLO', kelurahan: 'KEPATIHAN KULON', kecamatan: 'LAWEYAN',
  namaOutlet: 'SRIKANDI', kodeCabang: '09100002', branchCode: '09100002',
  statusAnalisa: 'EXACT_MATCH', placementStatus: 'VERIFIED', is3RoleLengkap: true,
  roleCabsal: 1, roleCabapv1: 1, roleCabapv2: 1, roleGrandTotal: 3, id: 'x', ...o,
});

const kasus = {
  'Solo → kantor Solo': baris({}),
  'Solo → kantor SOLOK (kasus operator)': baris({ namaOutlet: 'SOLOK', kodeCabang: '14100001', branchCode: '14100001' }),
  'Bandung → kantor Solo': baris({ provinsi: 'JAWA BARAT', kotaPten: 'BANDUNG', kotaPtenMax15: 'BANDUNG', kelurahan: 'BRAGA', kecamatan: 'SUMUR BANDUNG', namaOutlet: 'SRIKANDI' }),
  'Beda pulau (Kalteng → kantor Jabar)': baris({ provinsi: 'KALIMANTAN TENGAH', kotaPten: 'PALANGKARAYA', kotaPtenMax15: 'PALANGKARAYA', kelurahan: 'KERUKI', kecamatan: 'JERAHABLING', namaOutlet: 'BANDUNG ASIA AFRIKA', kodeCabang: '03100001' }),
  'Aceh → KIM (aturan resmi, lintas kota)': baris({ provinsi: 'ACEH', kotaPten: 'MEULABOH', kotaPtenMax15: 'MEULABOH', kelurahan: 'PENGAHA', kecamatan: 'MEULABOH', namaOutlet: 'KIM BANDA ACEH', kodeCabang: '01100001' }),
  'Aturan Aceh→KIM tanpa teks provinsi': baris({ provinsi: '', kotaPten: '', kotaPtenMax15: '', namaOutlet: 'KIM BANDA ACEH', kodeCabang: '01100001', fase2Sumber: 'ATURAN_ACEH_KIM' }),
  'Kantor tidak ada di Data Cabang': baris({ namaOutlet: 'TIDAK ADA DI MASTER', kodeCabang: '99999999', branchCode: '99999999' }),
};

for (const [label, r] of Object.entries(kasus)) {
  const w = lintasWilayahCabang(r, idx);
  console.log(`     ${label}: provinsi=${w.provinsi} pulau=${w.pulau} (${w.provinsiBaris || '?'} → ${w.provinsiCabang || '?'})`);
}

asa('JP2 Solo → SOLOK tertahan', nyebrangWilayahCabang(kasus['Solo → kantor SOLOK (kasus operator)'], idx), true);
asa('JP2 Solo → Solo sendiri lolos', nyebrangWilayahCabang(kasus['Solo → kantor Solo'], idx), false);
asa('JP2 beda provinsi satu pulau (Jabar → Jateng) tertahan', nyebrangWilayahCabang(kasus['Bandung → kantor Solo'], idx), true);
asa('JP2 beda pulau tertahan', nyebrangWilayahCabang(kasus['Beda pulau (Kalteng → kantor Jabar)'], idx), true);
asa('JP2 Aceh → KIM dikecualikan', nyebrangWilayahCabang(kasus['Aceh → KIM (aturan resmi, lintas kota)'], idx), false);
asa('JP2 penanda ATURAN_ACEH_KIM dikecualikan walau provinsinya kosong', nyebrangWilayahCabang(kasus['Aturan Aceh→KIM tanpa teks provinsi'], idx), false);
asa('JP2 kantor tak dikenal tidak pernah dilarang (tanpa bukti)', nyebrangWilayahCabang(kasus['Kantor tidak ada di Data Cabang'], idx), false);

// ── 3. SATU SUMBER: predikat gerbang == kategori PULAU/PROVINSI kartu anomali ──
// Kalau dua-duanya boleh berbeda, kartu Dashboard bilang "897 anomali" sementara
// setujui massal menahan jumlah lain — kelas bug yang sudah dilarang di proyek ini.
for (const [label, r] of Object.entries(kasus)) {
  const a = detectFinalAnomalies([{ ...r, id: label }], masterRows)[0];
  const diKartu = !!a && (a.categories.includes('PULAU') || a.categories.includes('PROVINSI'));
  asa(`JP3 "${label}" — gerbang dan kartu sependapat`, nyebrangWilayahCabang(r, idx) === diKartu, true);
}

// ── 4. Bentuk pemisahan yang dilakukan App.handleApproveAllAnalystFinal ──
const antrean = Object.values(kasus);
const lulusStruktur = (r) => r.statusAnalisa !== 'MENUNGGU';
const siap = antrean.filter(lulusStruktur);
const nyebrang = siap.filter((r) => nyebrangWilayahCabang(r, idx));
const moving = siap.filter((r) => !nyebrangWilayahCabang(r, idx));
asa('JP4 baris nyebrang tidak ikut pindah ke Data Final', nyebrang.length, 3);
asa('JP4 sisanya tetap diproses (gerbang tidak mematikan alur)', moving.length, 4);
asa('JP4 total tetap (tidak ada baris hilang diam-diam)', nyebrang.length + moving.length, antrean.length);

// Data Cabang kosong = tidak ada bukti provinsi = gerbang diam, alur tetap jalan.
asa('JP4 tanpa Data Cabang gerbang tidak menahan apa pun', siap.filter((r) => nyebrangWilayahCabang(r, indeksWilayahCabang([]))).length, 0);

// ── 5. GERBANG KANDIDAT FASE 2 (recommender) ──
// Yang di atas baru menahan PERSETUJUAN. Ini sumber usulannya: indeks byDati menyimpan
// 'SOLOK' di bawah kunci yang sama dengan 'SOLO', lalu seluruh pool itu dibuang gerbang
// provinsi — dan fallback-nya tetap memakai pool mentah itu, sehingga SOLOK jadi Rank 1
// untuk kelurahan Kota Solo. Terukur pada Data Cabang asli 2026-09-29.
const cabangF2 = (o) => cabang({ 'Branch Code': o.kode, 'Kode Cabang': o.kode, 'Sandi Cabang': o.kode, ...o });
// Sengaja TIDAK ada kantor Jawa Tengah yang kelurahan/kecamatannya sama dengan target:
// kalau ada, ia ikut masuk pool Dati II dan jalur yang bocor tidak lagi teruji.
const indeksF2 = buildMasterProximityIndex([
  cabangF2({ kode: '14100001', 'Nama Outlet': 'SOLOK', 'Status Outlet': 'KC', Provinsi: 'SUMATERA BARAT', 'Dati II': 'KOTA SOLOK', Kelurahan: 'PANDAN', Kecamatan: 'TANJUNG HARAPAN', 'KODE POS': '27322' }),
  cabangF2({ kode: '09100001', 'Nama Outlet': 'SURAKARTA', 'Status Outlet': 'KC', Provinsi: 'JAWA TENGAH', 'Dati II': 'KOTA SURAKARTA', Kelurahan: 'KEPARAK', Kecamatan: 'LAWEYAN', 'KODE POS': '57111' }),
  cabangF2({ kode: '09100002', 'Nama Outlet': 'SEMARANG PANDAAN', 'Status Outlet': 'KCP', Provinsi: 'JAWA TENGAH', 'Dati II': 'SEMARANG', Kelurahan: 'PEGADEN', Kecamatan: 'SEMARANG SELATAN', 'KODE POS': '50120' }),
]);
const usulan = (o) => (findClosestMasterRecommendation(target(o), indeksF2)?.candidates || [])[0]?.master?.['Nama Outlet'] || '(tidak ada)';
const barisSolo = { Provinsi: 'JAWA TENGAH', 'Dati II': 'SOLO', Kelurahan: 'KEPATIHAN KULON', Kecamatan: 'LAWEYAN', 'KODE POS': '57129' };
asa('JP5 kelurahan Solo tidak lagi diusuli kantor SOLOK', usulan(barisSolo), 'SURAKARTA');
asa('JP5 kontrol: kota Solok sungguhan tetap dapat SOLOK', usulan({ Provinsi: 'SUMATERA BARAT', 'Dati II': 'SOLOK', Kelurahan: 'PANDAN', Kecamatan: 'TANJUNG HARAPAN', 'KODE POS': '27322' }), 'SOLOK');

// ── 6. LAPIS SKOR: kantor beda provinsi tidak boleh LAGI diberi label "Kota/Kabupaten Sama" ──
// JP5 menutup pool kandidat, tapi label & skor dihitung di lapis sendiri dan dipakai
// jalur lain (panel "Opsi Pilihan" di layar Data Analyst). Baris nyata yang dilaporkan
// operator: PURWOSARI / LAWEYAN / 57142 (Jawa Tengah) ditulis "Di data: 304 – Sesuai
// Rekomendasi 1 (Utama) • Skor 72%" — 72 itu persis nilai cabang sekota.
const indeksHanyaSolok = buildMasterProximityIndex([
  cabangF2({ kode: '14100001', 'Nama Outlet': 'SOLOK', 'Status Outlet': 'KC', Provinsi: 'SUMATERA BARAT', 'Dati II': 'KOTA SOLOK', Kelurahan: 'PANDAN', Kecamatan: 'TANJUNG HARAPAN', 'KODE POS': '27322' }),
]);
const skorSolo = findClosestMasterRecommendation(target(barisSolo), indeksHanyaSolok)?.candidates?.[0];
asa('JP6 labelnya tidak lagi mengaku kota sama', /Kota\/Kabupaten Sama/.test(skorSolo?.reason || ''), false);
asa('JP6 labelnya menyebut jelas ini luar provinsi', /Luar Provinsi/.test(skorSolo?.reason || ''), true);
asa('JP6 skornya turun ke lantai penalti, bukan 72', skorSolo?.score, 30);
const skorSolokAsli = findClosestMasterRecommendation(
  target({ Provinsi: 'SUMATERA BARAT', 'Dati II': 'SOLOK', Kelurahan: 'PANDAN', Kecamatan: 'TANJUNG HARAPAN', 'KODE POS': '27322' }),
  indeksHanyaSolok
)?.candidates?.[0];
asa('JP6 kontrol: provinsi sama tetap dinilai penuh', skorSolokAsli?.score >= 72, true);
asa('JP6 kontrol: provinsinya tidak diketahui → tidak ada veto (mesin tetap jalan)',
  findClosestMasterRecommendation(target({ Provinsi: '', 'Dati II': 'SOLOK', Kelurahan: 'PANDAN', Kecamatan: 'TANJUNG HARAPAN', 'KODE POS': '27322' }), indeksHanyaSolok)?.candidates?.[0]?.master?.['Nama Outlet'], 'SOLOK');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} TEST GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
