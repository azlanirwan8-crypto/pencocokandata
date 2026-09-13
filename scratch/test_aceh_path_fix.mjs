import {
  isAcehTargetRow,
  resolveTargetOriginCoordinates,
  groupTargetOriginsForMap,
  createCurvedArcPoints,
  isForeignLand,
  clampToIndonesia,
} from '../src/utils/geoCoder.ts';

const kimDest = [3.5952, 98.6722];

function makeAcehRow(overrides = {}) {
  return {
    No: overrides.No || 1,
    _isMatched: true,
    Provinsi: overrides.Provinsi || 'ACEH',
    'Dati II': overrides['Dati II'] || 'KOTA BANDA ACEH',
    Kecamatan: overrides.Kecamatan || 'BAITURRAHMAN',
    Kelurahan: overrides.Kelurahan || 'Kampung Baru',
    'KODE POS': overrides['KODE POS'] || '23241',
    'Nama Outlet': 'ARRAHAKIM KIM',
    ALAMAT: 'JL. ARIEF RAHMAN HAKIM JL. LENGKONG, TEGAL SARI III, KEC. MEDAN AREA, KOTA MEDAN, SUMATERA UTARA',
    Wilayah: 'Wilayah 01',
    ...overrides,
  };
}

console.log('=== TEST PERBAIKAN JALUR ACEH → KIM ===\n');

const banda = makeAcehRow();
const langsa = makeAcehRow({ No: 2, 'Dati II': 'KOTA LANGSA', Kecamatan: 'Langsa Kota', 'KODE POS': '24411' });
const lhok = makeAcehRow({ No: 3, 'Dati II': 'KOTA LHOKSEUMAWE', Kecamatan: 'Banda Sakti', 'KODE POS': '24351' });
const acehTenggara = makeAcehRow({ No: 4, 'Dati II': 'KAB. ACEH TENGGARA', Kecamatan: 'Lawe Sigala-Gala', 'KODE POS': '24651' });

const cases = [banda, langsa, lhok, acehTenggara];
let fail = 0;

for (const row of cases) {
  const origin = resolveTargetOriginCoordinates(row);
  const inAceh = origin.lat >= 2.0 && origin.lat <= 6.2 && origin.lng >= 94.9 && origin.lng <= 98.4;
  const foreign = isForeignLand(origin.lat, origin.lng);
  const notMedan = !(origin.lat > 3.4 && origin.lat < 3.8 && origin.lng > 98.5 && origin.lng < 99.0);
  const ok = isAcehTargetRow(row) && inAceh && !foreign && notMedan;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${row['Dati II']} → [${origin.lat}, ${origin.lng}] ${origin.city} source=${origin.source}`
  );
  if (!ok) fail++;
}

const mass = Array.from({ length: 296 }, (_, i) =>
  makeAcehRow({
    No: i + 1,
    'Dati II': i % 3 === 0 ? 'KOTA BANDA ACEH' : i % 3 === 1 ? 'KOTA LANGSA' : 'KOTA LHOKSEUMAWE',
    Kecamatan: i % 3 === 0 ? 'BAITURRAHMAN' : i % 3 === 1 ? 'Langsa Kota' : 'Banda Sakti',
    'KODE POS': i % 3 === 0 ? '23241' : i % 3 === 1 ? '24411' : '24351',
  })
);

const groups = groupTargetOriginsForMap(mass);
console.log(`\n296 baris Aceh terkelompok jadi ${groups.length} titik (harus 3, bukan 296)`);
if (groups.length !== 3) {
  console.log('FAIL grouping');
  fail++;
} else {
  console.log('PASS grouping per kabupaten');
}

let wild = 0;
for (const g of groups) {
  if (g.lat < 2 || g.lat > 6.2 || g.lng < 94.9 || g.lng > 98.4 || isForeignLand(g.lat, g.lng)) {
    wild++;
    console.log('FAIL titik liar', g);
  }
  const arc = createCurvedArcPoints([g.lat, g.lng], kimDest, 0.15, 24);
  for (const [lat, lng] of arc) {
    if (isForeignLand(lat, lng) || lng > 100.5 || lat < 1.5) {
      wild++;
      console.log('FAIL busur nyasar', lat, lng);
      break;
    }
  }
}
if (wild === 0) console.log('PASS tidak ada titik/busur di Malaysia, Medan-salah, atau Sulawesi');

const [cLat, cLng] = clampToIndonesia(3.2, 101.4);
console.log(`clamp Malaysia KL [${cLat}, ${cLng}] foreign=${isForeignLand(cLat, cLng)}`);
if (isForeignLand(cLat, cLng)) {
  console.log('FAIL clamp masih di luar negeri');
  fail++;
} else {
  console.log('PASS clamp keluar dari Malaysia');
}

if (fail + wild > 0) {
  console.error('\nADA KEGAGALAN');
  process.exit(1);
}
console.log('\n=== SEMUA TES JALUR ACEH LULUS ===');
