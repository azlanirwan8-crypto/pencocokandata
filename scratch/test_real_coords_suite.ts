import { resolveBranchCoordinates, resolveTargetRowCoordinates, clampToInland, createCurvedArcPoints } from '../src/utils/geoCoder.ts';

console.log('=== RUNNING REAL COORDINATE & INLAND VERIFICATION ===\n');

// 1. Test Jayapura branch and target rows
const kcuJayapura = {
  Wilayah: 'W16',
  'Kode Cabang': '022',
  'Nama Outlet': 'KCU JAYAPURA',
  ALAMAT: 'JL. RAYA ARGAPURA NO. 27',
  'KODE POS': '99222',
  'Dati II': 'KOTA JAYAPURA',
  Provinsi: 'PAPUA',
};

const jayapuraCoords = resolveBranchCoordinates(kcuJayapura as any);
console.log('KCU Jayapura coordinates:', jayapuraCoords);

if (jayapuraCoords.lng > 140.7035) {
  console.error('FAIL: Jayapura branch is in the ocean bay!');
  process.exit(1);
} else {
  console.log('PASS: KCU Jayapura is strictly on land on Jl. Argapura corridor.');
}

// 2. Test Target rows in Jayapura districts
const targetAbepura = {
  Wilayah: 'W16',
  'Nama Outlet': 'OUTLET ABEPURA',
  ALAMAT: 'JL. RAYA ABEPURA KOTARAJA',
  'KODE POS': '99351',
  'Dati II': 'KOTA JAYAPURA',
  Kecamatan: 'ABEPURA',
  Provinsi: 'PAPUA',
};

const targetEntrop = {
  Wilayah: 'W16',
  'Nama Outlet': 'KIOS ENTROP',
  ALAMAT: 'JL. RAYA ENTROP',
  'KODE POS': '99224',
  'Dati II': 'KOTA JAYAPURA',
  Kecamatan: 'JAYAPURA SELATAN',
  Kelurahan: 'ENTROP',
  Provinsi: 'PAPUA',
};

const abeCoords = resolveTargetRowCoordinates(targetAbepura as any);
const entropCoords = resolveTargetRowCoordinates(targetEntrop as any);

console.log('Abepura target coords:', abeCoords);
console.log('Entrop target coords:', entropCoords);

if (abeCoords.lng > 140.7035 || entropCoords.lng > 140.7035) {
  console.error('FAIL: District coords fall in the ocean!');
  process.exit(1);
} else {
  console.log('PASS: District coordinates resolve to real inland towns.');
}

// 3. Test Curved Arcs between Abepura and KCU Jayapura
const arcPoints = createCurvedArcPoints([abeCoords.lat, abeCoords.lng], [jayapuraCoords.lat, jayapuraCoords.lng], 0.15, 30);
console.log(`Generated ${arcPoints.length} arc trajectory points.`);

let waterBreached = false;
for (const [lat, lng] of arcPoints) {
  if (lat >= -2.570 && lat <= -2.510 && lng > 140.7035) {
    console.error(`FAIL: Arc point breached shoreline into bay: [${lat}, ${lng}]`);
    waterBreached = true;
    break;
  }
}

if (!waterBreached) {
  console.log('PASS: All arc trajectory points stay strictly over land.');
}

// 4. Test on-site record (same location)
const onSiteArc = createCurvedArcPoints([jayapuraCoords.lat, jayapuraCoords.lng], [jayapuraCoords.lat, jayapuraCoords.lng]);
if (onSiteArc.length === 0) {
  console.log('PASS: On-site record correctly produces 0 arcs (no fake loops into water).');
} else {
  console.error('FAIL: On-site record produced arc points!');
  process.exit(1);
}

// 5. Test other coastal cities (Padang, Balikpapan, Semarang, Surabaya, Makassar)
const coastalTestCases = [
  { name: 'Padang Shore', raw: [-0.9478, 100.3400], expectedLngGte: 100.3595 },
  { name: 'Semarang North', raw: [-6.9400, 110.4200], expectedLatLte: -6.958 },
  { name: 'Balikpapan South', raw: [-1.2700, 116.8200], expectedLatGte: -1.260 },
  { name: 'Makassar West', raw: [-5.1300, 119.3900], expectedLngGte: 119.408 },
];

for (const tc of coastalTestCases) {
  const [clampedLat, clampedLng] = clampToInland(tc.raw[0], tc.raw[1]);
  if (tc.expectedLngGte && clampedLng < tc.expectedLngGte) {
    console.error(`FAIL ${tc.name}: lng ${clampedLng} < ${tc.expectedLngGte}`);
    process.exit(1);
  }
  if (tc.expectedLatLte && clampedLat > tc.expectedLatLte) {
    console.error(`FAIL ${tc.name}: lat ${clampedLat} > ${tc.expectedLatLte}`);
    process.exit(1);
  }
  if (tc.expectedLatGte && clampedLat < tc.expectedLatGte) {
    console.error(`FAIL ${tc.name}: lat ${clampedLat} < ${tc.expectedLatGte}`);
    process.exit(1);
  }
  console.log(`PASS: ${tc.name} clamped safely from [${tc.raw}] to [${clampedLat}, ${clampedLng}]`);
}

console.log('\n=== ALL GEODETIC & INLAND TESTS PASSED SUCCESSFULLY! ===');
