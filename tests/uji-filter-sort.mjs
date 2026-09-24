// Sort + filter header ala Excel (src/utils/filterSort.ts).
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-filter-sort.mjs
import {
  BATAS_DAFTAR_NILAI, KOSONG, barisLolosFilter, cariDalamNilai, daftarNilaiUnik,
  jumlahFilterAktif, sortirBaris, terapkanKeadaan,
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

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} ASERSI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
