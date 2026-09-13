import { extractWCode, clusterMasterRowsForMap, resolveBranchCoordinates, createCurvedArcPoints, resolveTargetRowCoordinates } from '../src/utils/geoCoder.ts';

console.log('=== RUNNING COMPREHENSIVE MAP AUDIT SUITE ===');

// 1. Audit extractWCode
const wTests = [
  { in: 'WILAYAH 01', expected: 'W01' },
  { in: 'Wilayah 02', expected: 'W02' },
  { in: 'W03', expected: 'W03' },
  { in: 'W17', expected: 'W17' },
  { in: 'WILAYAH 8', expected: 'W08' },
  { in: '5', expected: 'W05' },
  { in: '', expected: '' },
  { in: 'UNKNOWN', expected: '' },
];

let wFailures = 0;
for (const t of wTests) {
  const res = extractWCode(t.in);
  if (res !== t.expected) {
    console.error(`❌ extractWCode failed for "${t.in}": got "${res}", expected "${t.expected}"`);
    wFailures++;
  }
}
if (wFailures === 0) {
  console.log('✅ 1. extractWCode: All 8 test cases passed.');
}

// 2. Audit clusterMasterRowsForMap Wilayah filtering
const mockMasterRows = [
  { id: '1', 'Nama Outlet': 'KC Banda Aceh', Wilayah: 'W01', 'KODE POS': '23241', 'Dati II': 'KOTA BANDA ACEH' },
  { id: '2', 'Nama Outlet': 'KC Medan', Wilayah: 'W01', 'KODE POS': '20111', 'Dati II': 'KOTA MEDAN' },
  { id: '3', 'Nama Outlet': 'KC Padang', Wilayah: 'W02', 'KODE POS': '25111', 'Dati II': 'KOTA PADANG' },
  { id: '4', 'Nama Outlet': 'KC Palembang', Wilayah: 'W03', 'KODE POS': '30111', 'Dati II': 'KOTA PALEMBANG' },
];

const mockTargetRows = [
  { id: 't1', 'Nama Outlet': 'BANDA ACEH ATM', 'Branch Code': 'KC Banda Aceh', 'KODE POS': '23241', _isMatched: true },
  { id: 't2', 'Nama Outlet': 'PADANG PLAZA', 'Branch Code': 'KC Padang', 'KODE POS': '25111', _isMatched: true },
];

// Test ALL
const allClustered = clusterMasterRowsForMap(mockMasterRows, 'ALL', mockTargetRows);
console.log(`Cluster with 'ALL': ${allClustered.length} pins (expected 4). ${allClustered.length === 4 ? '✅' : '❌'}`);

// Test 'Wilayah 01' with master having 'W01'
const w01Clustered = clusterMasterRowsForMap(mockMasterRows, 'Wilayah 01', mockTargetRows);
console.log(`Cluster with 'Wilayah 01': ${w01Clustered.length} pins (expected 2). ${w01Clustered.length === 2 ? '✅' : '❌'}`);

// Test 'W02' with master having 'W02'
const w02Clustered = clusterMasterRowsForMap(mockMasterRows, 'W02', mockTargetRows);
console.log(`Cluster with 'W02': ${w02Clustered.length} pins (expected 1). ${w02Clustered.length === 1 ? '✅' : '❌'}`);

// 3. Audit Arc Generator
const arc = createCurvedArcPoints([-0.9471, 100.3543], [-0.9312, 100.3621], 0.15, 15);
console.log(`Curved Arc points count: ${arc.length} (expected 16). ${arc.length === 16 ? '✅' : '❌'}`);
const allValidCoords = arc.every(pt => typeof pt[0] === 'number' && !isNaN(pt[0]) && typeof pt[1] === 'number' && !isNaN(pt[1]));
console.log(`All Arc Coordinates Valid: ${allValidCoords ? '✅' : '❌'}`);

// 4. Audit Padang coordinate inland protection
const padangLoc = resolveBranchCoordinates({
  id: 'p1',
  'Nama Outlet': 'KCP IMAM BONJOL PADANG',
  ALAMAT: 'JL. IMAM BONJOL NO 1 PADANG BARAT',
  'Dati II': 'KOTA PADANG',
  'KODE POS': '25111',
  Wilayah: 'W02'
});
console.log(`Padang coordinate: lat=${padangLoc.lat}, lng=${padangLoc.lng}`);
const isInlandPadang = padangLoc.lat < 0 && padangLoc.lng >= 100.35;
console.log(`Padang pin strictly inland (lng >= 100.35): ${isInlandPadang ? '✅' : '❌'}`);

console.log('=== AUDIT COMPLETE ===');
