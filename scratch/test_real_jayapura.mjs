import { clampToInland, resolveBranchCoordinates, resolveTargetRowCoordinates } from '../src/utils/geoCoder.ts';

console.log('=== TEST JAYAPURA REAL INLAND COORDINATES ===');

// 1. KCU Jayapura (Base: -2.5489, 140.7181)
const [clampedLat, clampedLng] = clampToInland(-2.5489, 140.7181);
console.log(`Original: [-2.5489, 140.7181] -> Clamped: [${clampedLat}, ${clampedLng}]`);

// Is it in the ocean? (In Jayapura, bay is east of 140.707 between -2.57 and -2.51)
const isSafeInland = clampedLng <= 140.707;
console.log(`KCU Jayapura clamped safely on land (lng <= 140.707): ${isSafeInland ? '✅' : '❌'}`);

// 2. Test district resolution
const testRows = [
  { 'Nama Outlet': 'ATM BNI ABEPURA', ALAMAT: 'JL. RAYA ABEPURA NO 10', Kecamatan: 'ABEPURA', 'Dati II': 'KOTA JAYAPURA' },
  { 'Nama Outlet': 'ATM BNI ENTROP', ALAMAT: 'KOMPLEK RUKO ENTROP', Kecamatan: 'JAYAPURA SELATAN', Kelurahan: 'ENTROP', 'Dati II': 'KOTA JAYAPURA' },
  { 'Nama Outlet': 'ATM BNI WAENA', ALAMAT: 'JL. RAYA WAENA', Kecamatan: 'HERAM', 'Dati II': 'KOTA JAYAPURA' },
  { 'Nama Outlet': 'KCP ARGAPURA', ALAMAT: 'JL. ARGAPURA NO 5', Kecamatan: 'JAYAPURA SELATAN', Kelurahan: 'ARGAPURA', 'Dati II': 'KOTA JAYAPURA' }
];

console.log('\n2. Resolving Real District Target Rows:');
testRows.forEach(r => {
  const coords = resolveTargetRowCoordinates(r);
  const safe = coords.lng <= 140.707;
  console.log(`- ${r['Nama Outlet']}: [${coords.lat}, ${coords.lng}] (${coords.city}) Safe on land: ${safe ? '✅' : '❌'}`);
});
