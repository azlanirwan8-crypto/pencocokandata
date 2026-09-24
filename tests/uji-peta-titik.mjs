// Peta — asal titik & jembatan kode pos <-> kantor outlet.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-peta-titik.mjs
//
// Angka dasar TERUKUR dari backend produksi 2026-09-24 (match-sepia.vercel.app):
//   /api/kodepos-geo?view=points -> 10.597 kode pos unik, sumber 'desa' (rata-rata titik desa)
//   /api/master                  -> 1.776 cabang, 0 baris punya kolom koordinat
//   /api/target?view=final       -> 58.500 baris; 100% outletnya dikenali di Data Cabang,
//                                   12.860 garis unik, median 13,4 km, P90 94,4 km
import {
  kodePosLima, bangunJembatanOutlet, indeksKantorCabang, bagiPinKeSelLayar, resolveBranchCoordinates, kategoriUnitCabang,
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
  '23611': { lat: 4.15975980833333, lng: 96.121840525, sumber: 'desa' },      // 12 titik desa, Suak Indrapuri / Aceh Barat
  '20242': { lat: 3.6565962, lng: 98.6819793, sumber: 'desa' },               // 2 titik desa, kantor KIM Medan
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

// ── PT5: jembatan dua arah KELURAHAN <-> KANTOR OUTLET (Data Final + Data Cabang) ──
// Fixture-nya baris nyata dari /api/target?view=final 2026-09-24:
//   Suak Indrapuri / Johan Pahlawan / ACEH BARAT (23611) dipegang KC KAWASAN INDUSTRI
//   MEDAN (Branch Code 60105300) yang kantornya di KP 20242, Kota Medan -> 289 km.
// kodePosPten baris ini SAMA dengan kodePosKelurahannya (23611), jadi jembatan lama yang
// menghubungkan keduanya tidak pernah menggambar garis apa pun untuk kelurahan ini.
const kantorRows = [
  cabang({ 'Status Outlet': 'KC', 'Nama Outlet': 'KAWASAN INDUSTRI MEDAN', 'Branch Code': '60105300', 'Kode Cabang': 'KIM', 'Sandi Cabang': '53', 'KODE POS': '20242' }),
  cabang({ 'Status Outlet': 'KCP', 'Nama Outlet': 'MEULABOH', 'Branch Code': '60101234', 'Kode Cabang': 'MUL', 'Sandi Cabang': '88', 'KODE POS': '23111' }),
  cabang({ 'Status Outlet': 'KC', 'Nama Outlet': 'BANDUNG', 'Branch Code': '60200001', 'Kode Cabang': 'BDG', 'Sandi Cabang': '07', 'KODE POS': '40111' }),
  cabang({ 'Status Outlet': 'KCP', 'Nama Outlet': 'TANPA KODE POS', 'Branch Code': '60200002', 'Kode Cabang': 'XX', 'Sandi Cabang': '09', 'KODE POS': '' }),
];
const kantor = indeksKantorCabang(kantorRows, TITIK);
asa('PT5 kantor cabang dicari lewat Branch Code', kantor.get('60105300').kode, '20242');
asa('PT5 kantor cabang dicari lewat Kode Cabang', kantor.get('MUL').kode, '23111');
asa('PT5 kantor tanpa kode pos tidak ikut diindeks', kantor.has('XX'), false);

const finalRows = [
  { kodePosPten: '23611', kodePosKelurahan: '23611', kelurahan: 'Suak Indrapuri', branchCode: '60105300', kodeCabang: 'KIM', namaOutlet: 'KAWASAN INDUSTRI MEDAN', statusAnalisa: 'PERLU_REVIEW', placementStatus: 'VERIFIED', is3RoleLengkap: true },
  { kodePosPten: '23611', kodePosKelurahan: '23611', kelurahan: 'Suak Bahgie', branchCode: '60105300', kodeCabang: 'KIM', namaOutlet: 'KAWASAN INDUSTRI MEDAN', statusAnalisa: 'EXACT_MATCH', placementStatus: 'VERIFIED', is3RoleLengkap: true },
  { kodePosPten: '23611', kodePosKelurahan: '24111', kelurahan: 'Meulaboh', branchCode: '60101234', kodeCabang: 'MUL', namaOutlet: 'MEULABOH', statusAnalisa: 'ANOMALI', placementStatus: 'VERIFIED', is3RoleLengkap: true },
  { kodePosPten: '40111', kodePosKelurahan: '40111', kelurahan: 'Dago', branchCode: '60200001', kodeCabang: 'BDG', namaOutlet: 'BANDUNG', statusAnalisa: 'EXACT_MATCH', placementStatus: 'VERIFIED', is3RoleLengkap: true },
  { kodePosPten: '20242', kodePosKelurahan: '97111', kelurahan: 'Tak Bertitik', branchCode: '60105300', kodeCabang: 'KIM', namaOutlet: 'KAWASAN INDUSTRI MEDAN', statusAnalisa: 'EXACT_MATCH', placementStatus: 'VERIFIED', is3RoleLengkap: true },
  { kodePosPten: '20242', kodePosKelurahan: '24111', kelurahan: 'Krueng Anoi', branchCode: '', kodeCabang: '', namaOutlet: '', statusAnalisa: 'EXACT_MATCH', placementStatus: 'VERIFIED', is3RoleLengkap: true },
];
const { koneksi, status, tanpaKantor } = bangunJembatanOutlet(finalRows, TITIK, kantor);
asa('PT5 kedua ujung garis tercatat', [koneksi.has('23611'), koneksi.has('20242')], [true, true]);
asa('PT5 titik kelurahan -> kantor outletnya', (koneksi.get('23611') || []).map((k) => [k.kode, k.baris]), [['20242', 2]]);
asa('PT5 ujung jauh memakai koordinat Data Kode Pos kantor', [koneksi.get('23611')[0].lat, koneksi.get('23611')[0].lng], [TITIK['20242'].lat, TITIK['20242'].lng]);
asa('PT5 ujung jauh benar-benar berjauhan (> 2 derajat bujur)', Math.abs(koneksi.get('23611')[0].lng - TITIK['23611'].lng) > 2, true);
asa('PT5 dua ujung diberi label dua arah', [koneksi.get('23611')[0].outlet, koneksi.get('23611')[0].kel], ['KAWASAN INDUSTRI MEDAN', 'SUAK INDRAPURI']);
asa('PT5 kantor -> kelurahan yang dipegangnya', (koneksi.get('20242') || []).map((k) => [k.kode, k.baris]), [['23611', 2]]);
asa('PT5 kelurahan kantor itu sendiri tidak jadi garis', koneksi.has('40111'), false);
asa('PT5 kelurahan tanpa titik kode pos dilewati', (koneksi.get('20242') || []).some((k) => k.kode === '97111'), false);
asa('PT5 baris tanpa outlet tidak jadi garis, tetap dihitung', [tanpaKantor, (koneksi.get('24111') || []).some((k) => k.kode === '20242')], [1, false]);
asa('PT5 outlet lain tetap dapat garisnya sendiri', (koneksi.get('24111') || []).map((k) => k.kode), ['23111']);
asa('PT5 status terburuk menang', [status.get('24111'), status.get('23611')], ['ANOMALI', 'REVIEW']);
asa('PT5 kode pos tak bertitik tetap dihitung statusnya', status.get('97111'), 'OK');

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
