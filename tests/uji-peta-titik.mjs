// Peta — asal titik & jembatan kode pos.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-peta-titik.mjs
//
// Angka dasar TERUKUR dari backend produksi 2026-09-24 (match-sepia.vercel.app):
//   /api/kodepos-geo?view=points -> 10.596 kode pos unik, 10.590 (99,94%) sumber 'desa'
//   /api/master                  -> 1.776 cabang, 0 baris punya kolom koordinat
//   /api/target?view=final        -> 83.748 baris; 96,6% kedua kode posnya bertitik
import {
  kodePosLima, bangunJembatanKodePos, bagiPinKeSelLayar, resolveBranchCoordinates, kategoriUnitCabang,
  clusterMasterRowsForMap, sumberPerkiraan,
} from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

// Titik asli dari /api/kodepos-geo?view=points (rata-rata koordinat desa di Data Kode Pos).
const TITIK = {
  '24313': { lat: 5.07964966470588, lng: 97.1121430235294, sumber: 'desa' }, // 17 titik desa
  '24111': { lat: 5.38265716666667, lng: 95.9532372, sumber: 'desa' },       // 3 titik desa
  '23111': { lat: 5.5707329, lng: 95.3687717, sumber: 'desa' },
  '40111': { lat: -6.9181138, lng: 107.6085594, sumber: 'desa' },
  '10110': { lat: -6.1762629, lng: 106.8293243, sumber: 'desa' },
};

const cabang = (o) => ({
  Wilayah: '', 'Branch Code': '', 'Kode Cabang': '', 'Sandi Cabang': '', Sandi: '', Cabang: '',
  'Nama Outlet': '', 'Status Outlet': '', ALAMAT: '', 'KODE POS': '', Kelurahan: '', Kecamatan: '',
  'Dati II': '', Provinsi: '', ...o,
});

// ── PT1: pembacaan kode pos ──
asa('PT1 kode pos polos', kodePosLima('24313'), '24313');
asa('PT1 kode pos dengan spasi', kodePosLima(' 24313 '), '24313');
asa('PT1 kode pos di ujung teks', kodePosLima('KP-24313'), '24313');
asa('PT1 angka Excel bulat', kodePosLima(24313), '24313');
asa('PT1 kurang dari 5 digit ditolak', kodePosLima('2431'), '');
asa('PT1 kosong ditolak', kodePosLima(null), '');

// ── PT2: KC vs KCP dari kolom Status Outlet Data Cabang ──
asa('PT2 KC', kategoriUnitCabang(cabang({ 'Status Outlet': 'KC' })), 'KC');
asa('PT2 KCP', kategoriUnitCabang(cabang({ 'Status Outlet': 'KCP' })), 'KCP');
asa('PT2 KCP d/h KK ikut KCP', kategoriUnitCabang(cabang({ 'Status Outlet': 'KCP d/h KK' })), 'KCP');
asa('PT2 Status kosong pakai nama bercabang', kategoriUnitCabang(cabang({ 'Nama Outlet': 'MEDAN - BINJAI' })), 'KCP');
asa('PT2 Status kosong, nama polos', kategoriUnitCabang(cabang({ 'Nama Outlet': 'BALIGE' })), 'KC');

// ── PT3: titik cabang diambil dari koordinat Data Kode Pos, bukan pusat wilayah ──
const balige = cabang({
  Wilayah: '1', 'Status Outlet': 'KC', 'Nama Outlet': 'BALIGE', 'KODE POS': '24313',
  'Dati II': 'Kabupaten Toba', Provinsi: 'Sumatera Utara',
});
const hasilBalige = resolveBranchCoordinates(balige, undefined, TITIK);
asa('PT3 sumber = kodepos_data', hasilBalige.source, 'kodepos_data');
// clampToIndonesia membulatkan ke 5 desimal (± 1,1 meter) — koordinatnya tetap sama.
asa('PT3 koordinatnya titik Data Kode Pos', [hasilBalige.lat, hasilBalige.lng], [5.07965, 97.112143]);
asa('PT3 bukan titik perkiraan', sumberPerkiraan(hasilBalige.source), false);

// Tanpa peta titik (keadaan lama) cabang ini jatuh ke pusat wilayah = bukan kantor.
const tanpaTitik = resolveBranchCoordinates(balige, undefined, undefined);
asa('PT3 tanpa Data Kode Pos -> pusat wilayah', tanpaTitik.source, 'wilayah_centroid');
asa('PT3 pusat wilayah ditandai perkiraan', sumberPerkiraan(tanpaTitik.source), true);

// Koordinat eksplisit di baris tetap menang.
const denganKoordinat = cabang({ ...balige, Latitude: -6.9181138, Longitude: 107.6085594 });
asa('PT3 koordinat eksplisit menang', resolveBranchCoordinates(denganKoordinat, new Map(), TITIK).source, 'row_data');

// Kode pos cabang tidak ada di Data Kode Pos -> tidak boleh mengaku nyata.
const kehilangan = cabang({ ...balige, 'KODE POS': '99999' });
asa('PT3 kode pos tak dikenal -> perkiraan', sumberPerkiraan(resolveBranchCoordinates(kehilangan, undefined, TITIK).source), true);

// ── PT4: pin hasil clustering membawa asal titik + jenis unit ──
const masterRows = [
  cabang({ 'Status Outlet': 'KC', 'Nama Outlet': 'BANDA ACEH KIM', 'KODE POS': '23111', Wilayah: '01', 'Dati II': 'BANDA ACEH', Provinsi: 'ACEH' }),
  cabang({ 'Status Outlet': 'KCP', 'Nama Outlet': 'ACEH BESANG', 'KODE POS': '24313', Wilayah: '01', 'Dati II': 'ACEH BESAR', Provinsi: 'ACEH' }),
  cabang({ 'Status Outlet': 'KCP d/h KK', 'Nama Outlet': 'BANDUNG DAGO', 'KODE POS': '40111', Wilayah: '04', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
  cabang({ 'Status Outlet': 'KC', 'Nama Outlet': 'TIDAK ADA KOSENS', 'KODE POS': '99999', Wilayah: '04', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
];
const pins = clusterMasterRowsForMap(masterRows, 'ALL', [], undefined, TITIK);
asa('PT4 satu pin per cabang', pins.length, 4);
asa('PT4 jenis unit ikut di pin', pins.map((p) => p.unitKat), ['KC', 'KCP', 'KCP', 'KC']);
asa('PT4 tiga pin nyata, satu perkiraan', pins.map((p) => !p.perkiraan), [true, true, true, false]);
asa('PT4 pin nyata memakai koordinat titiknya', pins[1].lat, 5.07965);
asa('PT4 pin perkiraan ditandai di asal titik', pins[3].sumberTitik, 'wilayah_centroid');

// ── PT5: jembatan dua arah dari Data Final ──
const finalRows = [
  { kodePosPten: '24313', kodePosKelurahan: '24111', namaOutlet: 'KIM BANDA ACEH', statusAnalisa: 'EXACT_MATCH', placementStatus: 'VERIFIED', is3RoleLengkap: true },
  { kodePosPten: '24313', kodePosKelurahan: '24111', namaOutlet: 'KIM BANDA ACEH', statusAnalisa: 'EXACT_MATCH', placementStatus: 'VERIFIED', is3RoleLengkap: true },
  { kodePosPten: '24313', kodePosKelurahan: '23111', namaOutlet: 'BANDA ACEH KIM', statusAnalisa: 'ANOMALI', placementStatus: 'VERIFIED', is3RoleLengkap: true },
  { kodePosPten: '40111', kodePosKelurahan: '40111', namaOutlet: 'BANDUNG KOTA', statusAnalisa: 'EXACT_MATCH', placementStatus: 'VERIFIED', is3RoleLengkap: true },
  { kodePosPten: '24313', kodePosKelurahan: '88888', namaOutlet: 'TANPA TITIK', statusAnalisa: 'EXACT_MATCH', placementStatus: 'VERIFIED', is3RoleLengkap: true },
];
const { koneksi, status } = bangunJembatanKodePos(finalRows, TITIK);
asa('PT5 dua arah tercatat', [koneksi.has('24313'), koneksi.has('24111'), koneksi.has('23111')], [true, true, true]);
asa('PT5 baris kembar dilebur jadi satu garis', koneksi.get('24313').map((k) => [k.kode, k.baris]), [['24111', 2], ['23111', 1]]);
asa('PT5 ujung garis memakai koordinat Data Kode Pos', koneksi.get('24313')[0].lat, TITIK['24111'].lat);
asa('PT5 nama outlet pertama ikut disimpan', koneksi.get('24313')[0].outlet, 'KIM BANDA ACEH');
asa('PT5 kode pos sama tidak jadi garis', koneksi.has('40111'), false);
asa('PT5 pasangan tanpa koordinat dilewati', (koneksi.get('24111') || []).some((k) => k.kode === '88888'), false);
asa('PT5 status terburuk menang di kedua ujung', [status.get('24313'), status.get('23111')], ['ANOMALI', 'ANOMALI']);
asa('PT5 titik bersih tetap OK', status.get('24111'), 'OK');
asa('PT5 kode pos tak bertitik tetap dihitung statusnya', status.get('88888'), 'OK');

// ── PT6: tidak ada jalur yang mengarang koordinat di luar kotak Indonesia ──
const diLuarNegeri = cabang({ 'Status Outlet': 'KC', 'Nama Outlet': 'SINGAPURA', 'KODE POS': '24313', Wilayah: '01', Latitude: 1.35, Longitude: 103.82 });
asa('PT6 koordinat di luar Indonesia dipotong ke kotak aman', resolveBranchCoordinates(diLuarNegeri, undefined, TITIK).lat > -11.5 && resolveBranchCoordinates(diLuarNegeri, undefined, TITIK).lat < 7.5, true);

// ── PT7: penyaring layar — jumlah node dibatasi luas kanvas, BUKAN banyaknya data ──
// 10.596 titik disebar pseudo-acak seluas Indonesia (bd 95-141, ls -11..+7); 1° = 20 px.
const pinBanyak = Array.from({ length: 10596 }, (_, i) => ({
  lat: -11 + ((i * 7919) % 1800) / 100,
  lng: 95 + ((i * 104729) % 4600) / 100,
}));
const proyeksi = (p) => ({ x: (p.lng - 95) * 20, y: (p.lat + 11) * 20 });
const KELUAR = 56;
const diLuar = (p, k) => {
  const q = proyeksi(p);
  return q.x < -KELUAR || q.y < -KELUAR || q.x > k.x + KELUAR || q.y > k.y + KELUAR;
};

const kanvasKecil = { x: 400, y: 300 };
const hasilKecil = bagiPinKeSelLayar(pinBanyak, proyeksi, kanvasKecil);
const harusDibuang = pinBanyak.filter((p) => diLuar(p, kanvasKecil)).length;
asa('PT7 fixture memang melebihi kanvas', harusDibuang > 3000, true);
asa('PT7 pin di luar layar dibuang persis', hasilKecil.dibuang, harusDibuang);
// Sel yang muat: (400+2*56)/56 kolom x (300+2*56)/56 baris = 9 x 7 + tepi.
asa('PT7 node dibatasi kanvas (<= 9*7)', hasilKecil.sel.size <= 9 * 7, true);
asa('PT7 tidak ada pin yang hilang diam-diam', [...hasilKecil.sel.values()].reduce((n, b) => n + b.pins.length, 0) + hasilKecil.dibuang, pinBanyak.length);

const kanvasBesar = bagiPinKeSelLayar(pinBanyak, proyeksi, { x: 1000, y: 400 });
asa('PT7 kanvas selebar data: tidak ada yang dibuang', kanvasBesar.dibuang, 0);
asa('PT7 titik tengah sel = rata-rata anggotanya', (() => {
  const b = [...kanvasBesar.sel.values()][3];
  const rata = b.pins.reduce((n, p) => n + p.lat, 0) / b.pins.length;
  return Math.abs(b.sumLat / b.pins.length - rata) < 1e-9 && b.pins.length > 1;
})(), true);

// Pin yang tepat di tepi masih ikut digambar; yang jauh dibuang.
const tepi = bagiPinKeSelLayar(
  [{ lat: 0, lng: 0 }, { lat: 0, lng: 0.5 }, { lat: 0, lng: 20 }],
  (p) => ({ x: p.lng * 20, y: p.lat * 20 }),
  { x: 10, y: 10 },
  56
);
asa('PT7 tepi kanvas dihitung terlihat', tepi.sel.size, 1);
asa('PT7 yang jauh dari kanvas dibuang', tepi.dibuang, 1);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
