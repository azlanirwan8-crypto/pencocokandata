// Pencocokan blok PTEN ↔ kelurahan di Fase 1. Patokannya PTEN, dan kodenya harus PERSIS:
// sebuah blok hanya boleh dibawa kelurahan yang kode posnya sama, atau kelurahan yang
// operator patokkan lewat antrean review. Prefik 4/3 digit dulu boleh meminjamkan blok
// sekota — hasilnya baris Final membaca "cocok" padahal tidak (Canggu 80365 membawa
// blok 80364). Blok yang benar-benar tidak berpadanan wajib keluar sebagai antrean,
// lengkap dengan usulan kelurahan, bukan lenyap jadi badge "Belum digunakan".
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-blok-pten.mjs
import { indeksBlokPtenPerKota, pilihBlokPten, kandidatKelurahanBlok, sisaBlokPten } from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

// ── Tingkat pencocokan: hanya persis dan patokan operator ───────────────────
const JP = ['10110', '10115', '10120', '10131'];
asa('kode kelurahan yang disebut PTEN menang persis',
  pilihBlokPten('10115', JP), { blok: '10115', tingkat: 'persis' });
asa('spasi/titik pada kode tidak memutus pencocokan persis',
  pilihBlokPten(' 10.115 ', JP), { blok: '10115', tingkat: 'persis' });
asa('TANPA padanan persis: blok sekota tidak lagi dipinjam',
  pilihBlokPten('10119', JP), { blok: '', tingkat: 'tidak' });
asa('blok sekota yang jauh prefiknya juga tidak direbut',
  pilihBlokPten('11111', ['12100', '12150']), { blok: '', tingkat: 'tidak' });
asa('patokan operator dipakai kalau bloknya memang baris PTEN sekota',
  pilihBlokPten('10119', JP, '10115'), { blok: '10115', tingkat: 'manual' });
asa('patokan ke blok yang tidak ada di kota itu ditolak',
  pilihBlokPten('10119', JP, '19999'), { blok: '', tingkat: 'tidak' });
asa('patokan yang sama dengan kode kelurahan sendiri tidak menyalakan status manual',
  pilihBlokPten('10115', JP, '10115'), { blok: '10115', tingkat: 'persis' });
asa('kode kelurahan kosong tidak mengarang blok',
  pilihBlokPten('', JP, '10115'), { blok: '', tingkat: 'tidak' });

// ── Usulan kelurahan untuk blok yatim ───────────────────────────────────────
const kelJP = [
  { kodePos: '10110', kelurahan: 'Duri Pulo', kecamatan: 'Gambir', provinsi: 'DKI JAKARTA' },
  { kodePos: '10110', kelurahan: 'Cideng', kecamatan: 'Gambir', provinsi: 'DKI JAKARTA' },
  { kodePos: '10110', kelurahan: 'Kebon Kelapa', kecamatan: 'Gambir', provinsi: 'DKI JAKARTA' },
  { kodePos: '10110', kelurahan: 'Gambir', kecamatan: 'Gambir', provinsi: 'DKI JAKARTA' },
  { kodePos: '10120', kelurahan: 'Menteng', kecamatan: 'Cempaka Putih', provinsi: 'DKI JAKARTA' },
  { kodePos: '10210', kelurahan: 'Cikini', kecamatan: 'Gambir', provinsi: 'DKI JAKARTA' },
];
asa('blok yatim diusulkan ke kelurahan 4 digit terdepan, dipotong ke 3 usulan',
  kandidatKelurahanBlok('10115', kelJP).map((k) => `${k.kodePos} ${k.kelurahan}`),
  ['10110 Duri Pulo', '10110 Cideng', '10110 Kebon Kelapa']);
asa('blok yang kodenya sudah punya kelurahan tidak diusulkan ke kelurahan itu sendiri',
  kandidatKelurahanBlok('10110', kelJP).map((k) => k.kodePos), ['10120']);
asa('tanpa padanan prefik 4, turun ke prefik 3',
  kandidatKelurahanBlok('10199', kelJP).map((k) => k.kodePos), ['10110', '10110', '10110']);
asa('blok yang sama sekali tak berprefik dengan kota itu tidak punya usulan',
  kandidatKelurahanBlok('80311', kelJP), []);
asa('blok tanpa kode 5 digit tidak menghasilkan usulan',
  kandidatKelurahanBlok('', kelJP), []);
asa('daftar kelurahan kosong aman',
  kandidatKelurahanBlok('10115', undefined), []);

// ── Indeks blok per kota ────────────────────────────────────────────────────
const pten = [
  { kotaPten: 'SURAKARTA (SOLO)', kodePosPten: '57157' },
  { kotaPten: 'SURAKARTA', kodePosPten: '57124' },
  { kotaPten: 'SURAKARTA', kodePosPten: '57124' },
  { kotaPten: 'SEMARANG', kodePosPten: '50271' },
  { kotaPten: 'SEMARANG', kodePosPten: '50149' },
  { kotaPten: 'BEKASI', kodePosPten: '' },
];
const indeks = indeksBlokPtenPerKota(pten);
const kunciSolo = [...indeks.keys()].find((k) => k.includes('SURAKARTA'));
asa('catatan alias dalam kurung tidak memecah kota',
  indeks.get(kunciSolo), ['57124', '57157']);
asa('kode duplikat hanya dicatat sekali dan daftar terurut',
  indeks.get(kunciSolo).length, 2);
const kunciSmar = [...indeks.keys()].find((k) => k.includes('SEMARANG'));
asa('blok sekota terurut naik supaya hasil run stabil', indeks.get(kunciSmar), ['50149', '50271']);
asa('baris tanpa kode pos tidak masuk indeks',
  [...indeks.values()].some((d) => d.includes('')), false);

// ── Sifat yang dikejar: hanya kode persis yang mengklaim blok ───────────────
const blokKota = ['10110', '10115', '10120', '10125', '10131', '10240'];
const kelurahan = ['10110', '10120', '10131', '10199', '10288', '10377'];
const diambil = kelurahan.map((k) => pilihBlokPten(k, blokKota).blok);
asa('tiga kelurahan berkode persis dapat bloknya, tiga lainnya tidak meminjam',
  diambil, ['10110', '10120', '10131', '', '', '']);
asa('blok yang tidak diambil siapa pun tetap tercatat sebagai sisa',
  blokKota.filter((b) => !diambil.includes(b)), ['10115', '10125', '10240']);

// ── Akuntansi arah PTEN: yang kalah tabrak harus kelihatan, bukan menguap ──
const masterPten = [
  { kotaPten: 'JAKARTA PUSAT', kodePosPten: '10110' },
  { kotaPten: 'JAKARTA PUSAT', kodePosPten: '10115' },
  { kotaPten: 'JAKARTA PUSAT', kodePosPten: '10199' },
  { kotaPten: 'BANDUNG', kodePosPten: '40111' },
  { kotaPten: 'BANDUNG', kodePosPten: '' },
];
asa('blok yang sudah terpakai tidak dilaporkan sebagai sisa',
  sisaBlokPten(masterPten, new Set(['10110', '40111'])).map((p) => p.kodePosPten),
  ['10115', '10199', '']);
asa('baris PTEN tanpa kode pos ikut tercatat sebagai sisa, bukan hilang',
  sisaBlokPten(masterPten, new Set(['10110', '10115', '10199', '40111'])).map((p) => p.kodePosPten), ['']);
asa('daftar PTEN kosong tidak melempar', sisaBlokPten(undefined, new Set()), []);

const terpakaiTutup = new Set();
for (const k of ['10110', '10115', '10120']) {
  const h = pilihBlokPten(k, ['10110', '10115', '10120']);
  if (h.blok) terpakaiTutup.add(h.blok);
}
asa('kota yang kodenya cocok semua tidak menyisakan antrean review',
  sisaBlokPten([{ kodePosPten: '10110' }, { kodePosPten: '10115' }], terpakaiTutup).length, 0);

console.log(gagal === 0 ? 'SEMUA LULUS' : `${gagal} UJIAN GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
