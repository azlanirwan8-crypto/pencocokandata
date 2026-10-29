// Pencocokan blok PTEN ↔ kelurahan di Fase 1. Patokannya PTEN: blok sekota yang lebih
// halus dari daftar kelurahan (kode pos kelurahan hanya satu per kelurahan) harus tetap
// terpakai, tidak boleh dibiarkan "Belum digunakan" padahal padanannya ada.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-blok-pten.mjs
import { indeksBlokPtenPerKota, pilihBlokPten, sisaBlokPten } from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

// ── Tingkat pencocokan ──────────────────────────────────────────────────────
const JP = ['10110', '10115', '10120', '10131'];
asa('kode kelurahan yang disebut PTEN menang persis',
  pilihBlokPten('10115', JP, new Set()), { blok: '10115', tingkat: 'persis' });
asa('persis tetap menang walau bloknya sudah dipakai kelurahan lain',
  pilihBlokPten('10115', JP, new Set(['10115'])), { blok: '10115', tingkat: 'persis' });
asa('tanpa padanan persis: blok terdekat prefik 4 yang belum dipakai',
  pilihBlokPten('10119', JP, new Set()), { blok: '10110', tingkat: 'prefik4' });
asa('blok prefik 4 yang sudah dipakai tidak diambil dua kali',
  pilihBlokPten('10119', JP, new Set(['10110'])), { blok: '10115', tingkat: 'prefik4' });
asa('prefik 4 habis → turun ke prefik 3',
  pilihBlokPten('10119', ['10110', '10115', '10120'], new Set(['10110', '10115', '10120'])),
  { blok: '', tingkat: 'tidak' });
asa('prefik 3 masih punya sisa → dipakai',
  pilihBlokPten('10234', ['10110', '10115', '10200'], new Set(['10110', '10115'])),
  { blok: '10200', tingkat: 'prefik3' });
asa('blok di luar prefik 3 kota itu tidak direbut',
  pilihBlokPten('11111', ['12100', '12150'], new Set()), { blok: '', tingkat: 'tidak' });
asa('kode kelurahan kosong tidak mengarang blok',
  pilihBlokPten('', JP, new Set()), { blok: '', tingkat: 'tidak' });
asa('spasi/titik pada kode tidak memutus pencocokan',
  pilihBlokPten(' 10.119 ', JP, new Set()), { blok: '10110', tingkat: 'prefik4' });

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

// ── Sifat yang dikejar: tidak ada blok menganggur kalau ada padanannya ──────
// 6 kelurahan, 6 blok PTEN sekota. Tiga kelurahan punya blok persis; sisanya harus
// menyerap blok yang tersisa lewat prefik — bukan jatuh ke satu blok kota yang sama.
const blokKota = ['10110', '10115', '10120', '10125', '10131', '10240'];
const kelurahan = ['10110', '10120', '10131', '10199', '10288', '10377'];
const terpakai = new Set();
const diambil = kelurahan.map((k) => {
  const h = pilihBlokPten(k, blokKota, terpakai);
  if (h.blok) terpakai.add(h.blok);
  return h.blok;
});
asa('blok diserap berjenjang: persis → prefik 3 → kosong', diambil,
  ['10110', '10120', '10131', '10115', '10240', '']);
asa('satu blok tidak dipakai dua kelurahan',
  new Set(diambil.filter(Boolean)).size, diambil.filter(Boolean).length);
asa('kelurahan tanpa prefik sekota tidak mengarang blok (jatuh ke blok kota)',
  diambil[5], '');
asa('blok terserap semua kecuali yang tak berprefik sama sekali', [...terpakai].sort(),
  ['10110', '10115', '10120', '10131', '10240']);

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
  const h = pilihBlokPten(k, ['10110', '10115', '10120'], terpakaiTutup);
  if (h.blok) terpakaiTutup.add(h.blok);
}
asa('kota yang tuntas terserap tidak menyisakan antrean review',
  sisaBlokPten([{ kodePosPten: '10110' }, { kodePosPten: '10115' }], terpakaiTutup).length, 0);

console.log(gagal === 0 ? 'SEMUA LULUS' : `${gagal} UJIAN GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
