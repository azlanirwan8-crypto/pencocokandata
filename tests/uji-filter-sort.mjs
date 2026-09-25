// Sort + filter header ala Excel (src/utils/filterSort.ts).
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-filter-sort.mjs
import {
  BATAS_DAFTAR_NILAI, KOSONG, barisLolosFilter, cariDalamNilai, daftarNilaiUnik, dasarDaftarNilai,
  buatDefinisiKolomGrid, jumlahFilterAktif, saringBaris, sortirBaris, terapkanKeadaan,
} from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

const kolomTeks = { kunci: 'Cabang', nilai: (r) => r.cabang };
const kolomAngka = { kunci: 'Jarak', nilai: (r) => r.km, jenis: 'angka' };
const kolomPos = { kunci: 'Kode Pos', nilai: (r) => r.kodePos, jenis: 'angka' };

const baris = [
  { id: 1, cabang: 'BIAK', km: 42, kodePos: '95774' },
  { id: 2, cabang: 'biak', km: 9, kodePos: '95775' },
  { id: 3, cabang: 'Wamena', km: null, kodePos: '99511' },
  { id: 4, cabang: 'JAYAPURA', km: 380, kodePos: '' },
  { id: 5, cabang: '  wamena  ', km: 10, kodePos: '99511' },
  { id: 6, cabang: '', km: 100, kodePos: '99328' },
];

// ── FS1: nilai unik tidak membedakan besar/kecil dan spasi, kosong paling akhir ──
// Yang ditampilkan tetap tulisan pertama seperti di data ("Wamena", bukan "WAMENA"),
// tapi URUTANNYA memakai bentuk huruf-besar supaya tidak melompat ke belakang.
asa('FS1 nilai unik terurut + (kosong) di akhir', daftarNilaiUnik(baris, kolomTeks).semua, ['BIAK', 'JAYAPURA', 'Wamena', KOSONG]);
asa('FS1 jumlah unik dihitung setelah disatukan', daftarNilaiUnik(baris, kolomTeks).totalUnik, 4);
asa('FS1 kode pos ikut sebagai angka', daftarNilaiUnik(baris, kolomPos).semua, ['95774', '95775', '99328', '99511', KOSONG]);

// ── FS2: daftar panjang DIPOTONG HANYA untuk ditampilkan, pencarian menjangkau sisanya ──
const banyak = Array.from({ length: 600 }, (_, i) => ({ cabang: `KELURAHAN ${String(i).padStart(3, '0')}` }));
banyak[599].cabang = 'ZWAALDENBERG TIJAL';
const d = daftarNilaiUnik(banyak, kolomTeks);
asa('FS2 semua nilai tetap dikembalikan', d.semua.length, 600);
asa('FS2 tampilan awal dipotong ke batas', cariDalamNilai(d.semua, '').length, BATAS_DAFTAR_NILAI);
asa('FS2 kata di luar potongan tetap ditemukan', cariDalamNilai(d.semua, 'TIJAL'), ['ZWAALDENBERG TIJAL']);
asa('FS2 pencarian tidak peka besar/kecil', cariDalamNilai(d.semua, 'zwaaldenberg').length, 1);

// ── FS3: predicate filter ──
asa('FS3 memilih "BIAK" juga meloloskan baris "biak"', barisLolosFilter(baris[1], kolomTeks, new Set(['BIAK'])), true);
asa('FS3 spasi berlebih di data tidak menggagalkan cocok', barisLolosFilter(baris[4], kolomTeks, new Set(['WAMENA'])), true);
asa('FS3 baris tanpa nilai lolos lewat (kosong)', barisLolosFilter(baris[3], kolomPos, new Set([KOSONG])), true);
asa('FS3 nilai lain ditolak', barisLolosFilter(baris[0], kolomTeks, new Set(['WAMENA'])), false);

// ── FS4: sortir ──
asa('FS4 angka dibandingkan sebagai angka (9 < 10 < 42 < 100 < 380, kosong akhir)', sortirBaris(baris, kolomAngka, true).map((r) => r.id), [2, 5, 1, 6, 4, 3]);
asa('FS4 nilai kosong tetap paling akhir walau turun', sortirBaris(baris, kolomAngka, false).map((r) => r.id), [4, 6, 1, 5, 2, 3]);
asa('FS4 teks dibandingkan tanpa peduli besar/kecil', sortirBaris(baris, kolomTeks, true).map((r) => r.cabang).slice(0, 2), ['BIAK', 'biak']);
asa('FS4 seri menjaga urutan masuk (stabil)', sortirBaris(baris, kolomTeks, true).filter((r) => r.cabang.toUpperCase() === 'BIAK').map((r) => r.id), [1, 2]);

// ── FS5: dua kolom filter digabung DAN, sort hanya atas yang lolos ──
asa('FS5 filter lalu sort naik', terapkanKeadaan(baris, [kolomTeks, kolomAngka], { kolom: 'Jarak', naik: true }, { Cabang: ['BIAK'] }).map((r) => r.id), [2, 1]);
asa('FS5 arah turun hanya membalik yang lolos filter', terapkanKeadaan(baris, [kolomTeks, kolomAngka], { kolom: 'Jarak', naik: false }, { Cabang: ['BIAK'] }).map((r) => r.id), [1, 2]);
asa('FS5 nilai dengan spasi berlebih tetap tersaring', terapkanKeadaan(baris, [kolomTeks], { kolom: '', naik: true }, { Cabang: ['WAMENA'] }).map((r) => r.id), [3, 5]);
asa('FS5 tanpa keadaan = urutan masuk utuh', terapkanKeadaan(baris, [kolomTeks], { kolom: '', naik: true }, {}).map((r) => r.id), [1, 2, 3, 4, 5, 6]);

// ── FS6: keadaan kosong tidak dihitung sebagai filter ──
asa('FS6 array kosong bukan filter', jumlahFilterAktif({ Cabang: [], Provinsi: ['ACEH'] }), 1);

// ── FS7: biaya membangun daftar nilai atas data sebesar Data Final ──
const besar = Array.from({ length: 83747 }, (_, i) => ({ cabang: `KEL-${i % 60000}`, km: i % 999 }));
const t0 = performance.now();
const db = daftarNilaiUnik(besar, kolomTeks);
const tUnik = performance.now() - t0;
const s0 = performance.now();
sortirBaris(besar, kolomTeks, true);
const tSort = performance.now() - s0;
console.log(`FS7 83.747 baris: daftar nilai ${tUnik.toFixed(0)} ms (${db.totalUnik} unik) · sortir ${tSort.toFixed(0)} ms`);
asa('FS7 membangun daftar nilai di bawah 1 detik', tUnik < 1000, true);
asa('FS7 sortir 83.747 baris di bawah 1 detik', tSort < 1000, true);

// ── FS8: definisi kolom Grid Analis lengkap & kuncinya tidak dobel ──
// Dua <ThFilter> berkunci sama dalam SATU baris header akan berbagi state sort/filter
// secara diam-diam — asersi ini yang menahan agar itu tidak lolos build.
const defGrid = buatDefinisiKolomGrid(() => 'KOTA DARI KODEPOS');
const kunciGrid = defGrid.map((d) => d.kunci);
asa('FS8 tidak ada kunci kolom grid yang dobel', kunciGrid.length, new Set(kunciGrid).size);
asa('FS8 semua definisi punya pengambil nilai', defGrid.every((d) => typeof d.nilai === 'function'), true);
asa('FS8 hanya kotaKodePos yang memakai resolver suntikan', kunciGrid.filter((k) => defGrid.find((d) => d.kunci === k).nilai({}) === 'KOTA DARI KODEPOS'), ['kotaKodePos']);
// Dati II & KOTA PTEN menampilkan teks yang sama tapi HARUS kunci terpisah: keduanya
// tampil berdampingan di tab Data Final.
asa('FS8 Dati II dan KOTA PTEN tetap dua kunci berbeda', ['datiII', 'kotaPtenMax15'].every((k) => kunciGrid.includes(k)), true);
const contohBaris = { no: 7, kelurahan: 'Jajar', kecamatan: 'Laweyan', kotaPten: 'SURAKARTA', kotaPtenMax15: 'SOLO', kodePosPten: '57124', kodePosKelurahan: '57144' };
const ambil = (k) => defGrid.find((d) => d.kunci === k).nilai(contohBaris);
asa('FS8 Dati II memakai nama MAX 15 seperti selnya', [ambil('datiII'), ambil('kotaPtenMax15')], ['SOLO', 'SOLO']);
asa('FS8 KOTA PTEN menyimpan nama persis PTEN', ambil('kotaPten'), 'SURAKARTA');
asa('FS8 validasi fase dibaca dari label, bukan mentahan', typeof ambil('statusPten'), 'string');

// ── FS9: daftar nilai BERTINGKAT — kolom lain memotong, saringan sendiri tidak ──
const DEF_CAB = { kunci: 'Cabang', nilai: (r) => r.cabang };
const DEF_PROV = { kunci: 'Provinsi', nilai: (r) => r.prov };
const DEF_KEC = { kunci: 'Kecamatan', nilai: (r) => r.kec };
const DEF3 = [DEF_CAB, DEF_PROV, DEF_KEC];
const b9 = [
  { id: 1, cabang: 'BIAK', prov: 'PAPUA', kec: 'SAMOFA' },
  { id: 2, cabang: 'WAMENA', prov: 'PAPUA', kec: 'MILIMOKO' },
  { id: 3, cabang: 'BIAK', prov: 'PAPUA', kec: 'AIMBOKU' },
  { id: 4, cabang: 'JAYAPURA', prov: 'PAPUA', kec: 'HERAM' },
  { id: 5, cabang: 'MEDAN', prov: 'SUMUT', kec: 'PERCUT' },
  { id: 6, cabang: 'BINJAI', prov: 'SUMUT', kec: 'CANGKU' },
];
const daftarDari = (saring, kolom) => daftarNilaiUnik(dasarDaftarNilai(b9, DEF3, saring, kolom.kunci), kolom).semua;

asa('FS9 tanpa saringan = daftar penuh', daftarDari({}, DEF_KEC), ['AIMBOKU', 'CANGKU', 'HERAM', 'MILIMOKO', 'PERCUT', 'SAMOFA']);
// Saringan Provinsi SUMUT hanya menyisakan 2 baris → daftarnya ikut mengecil.
asa('FS9 kolom lain memotong daftar', daftarDari({ Provinsi: ['SUMUT'] }, DEF_KEC), ['CANGKU', 'PERCUT']);
asa('FS9 dua kolom lain memotong bersama', daftarDari({ Provinsi: ['SUMUT'], Cabang: ['BINJAI'] }, DEF_KEC), ['CANGKU']);
// Saringan diri sendiri dikecualikan: kalau tidak, begitu 'PERCUT' dipilih opsi lain
// hilang dari daftar dan popover tidak bisa dipakai mengubah pilihan lagi.
asa('FS9 saringan sendiri TIDAK memotong daftarnya', daftarDari({ Kecamatan: ['PERCUT'] }, DEF_KEC), ['AIMBOKU', 'CANGKU', 'HERAM', 'MILIMOKO', 'PERCUT', 'SAMOFA']);
// Arah sebaliknya juga jalan: Cabang ikut mengikuti Provinsi, bukan daftar mentah.
asa('FS9 dua arah: daftar cabang mengikuti provinsi', daftarDari({ Provinsi: ['SUMUT'] }, DEF_CAB), ['BINJAI', 'MEDAN']);
// Yang disaring tetap AND penuh — berjenjang hanya soal ISI DAFTAR, bukan baris.
asa('FS9 baris tetap hasil AND semua kolom aktif', saringBaris(b9, DEF3, { Provinsi: ['SUMUT'], Kecamatan: ['PERCUT'] }).map((r) => r.id), [5]);
asa('FS9 nilai dari provinsi lain tidak ikut masuk daftar', daftarDari({ Provinsi: ['PAPUA'] }, DEF_CAB), ['BIAK', 'JAYAPURA', 'WAMENA']);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} ASERSI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
