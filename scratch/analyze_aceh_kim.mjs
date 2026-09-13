import { resolveBranchCoordinates, resolveTargetRowCoordinates, clusterMasterRowsForMap, createCurvedArcPoints } from '../src/utils/geoCoder.ts';
import { findClosestMasterRecommendation, buildMasterProximityIndex } from '../src/utils/recommender.ts';

console.log('=== ANALISIS LENGKAP KASUS KODEPOS ACEH & CABANG KIM ===\n');

// 1. Definisikan Master Cabang KIM (Kawasan Industri Medan - Wilayah 01)
const masterRows = [
  {
    Wilayah: 'W01',
    'Sandi Cabang': '00123 - KC MEDAN KIM',
    Sandi: '00123',
    Cabang: 'KC MEDAN KIM',
    'Branch Code': '00123',
    'Kode Cabang': '123',
    'Nama Outlet': 'KC MEDAN KIM',
    'Status Outlet': 'Aktif',
    ALAMAT: 'JL. PULAU PINANG NO. 1 KAWASAN INDUSTRI MEDAN',
    'KODE POS': '20242',
    Kelurahan: 'Mabar',
    Kecamatan: 'Medan Deli',
    'Dati II': 'KOTA MEDAN',
    'Kode Dati II': '1271',
    Provinsi: 'Sumatera Utara',
    Telp: '061-6851234'
  },
  {
    Wilayah: 'W01',
    'Sandi Cabang': '00001 - KCU MEDAN',
    Sandi: '00001',
    Cabang: 'KCU MEDAN',
    'Branch Code': '00001',
    'Kode Cabang': '001',
    'Nama Outlet': 'KCU MEDAN',
    'Status Outlet': 'Aktif',
    ALAMAT: 'JL. PEMUDA NO. 1',
    'KODE POS': '20111',
    'Dati II': 'KOTA MEDAN',
    Provinsi: 'Sumatera Utara',
    Telp: ''
  }
];

// 2. Definisikan Data Target dengan Kode Pos Aceh (Misal 23241 Banda Aceh)
const targetRowAceh = {
  No: 1,
  Wilayah: 'Wilayah 01',
  'Nama Outlet': 'ATM BANDA ACEH PASAR ACEH',
  'Status Outlet': 'Aktif',
  ALAMAT: 'JL. DIPONEGORO NO. 10 BANDA ACEH',
  'KODE POS': '23241',
  Kelurahan: 'Kampung Baru',
  Kecamatan: 'Baiturrahman',
  'Dati II': 'KOTA BANDA ACEH',
  'Kode Dati II': '1171',
  Provinsi: 'ACEH',
  _isMatched: false
};

console.log('1. Cek Rekomendasi untuk Target Aceh:');
const index = buildMasterProximityIndex(masterRows);
const rec = findClosestMasterRecommendation(targetRowAceh, index);
console.log('   Hasil Rekomendasi Cabang:', rec?.recommendedMaster?.['Nama Outlet']);
console.log('   Alasan Rekomendasi:', rec?.candidates?.[0]?.reason);

// 3. Simulasikan jika rekomendasi disetujui (Approve)
const approvedTarget = {
  ...targetRowAceh,
  _isMatched: true,
  _matchLevel: 'recommendation',
  'Sandi Cabang': rec?.recommendedMaster?.['Sandi Cabang'],
  Sandi: rec?.recommendedMaster?.Sandi,
  Cabang: rec?.recommendedMaster?.Cabang,
  'Branch Code': rec?.recommendedMaster?.['Branch Code'],
  'Kode Cabang': rec?.recommendedMaster?.['Kode Cabang'],
  'Nama Outlet': rec?.recommendedMaster?.['Nama Outlet'], // PERHATIAN: Di App.tsx baris 713, Nama Outlet di-overwrite jadi KC MEDAN KIM!
  ALAMAT: rec?.recommendedMaster?.ALAMAT,                 // PERHATIAN: Di App.tsx baris 715, ALAMAT di-overwrite jadi Alamat KIM Medan!
  Wilayah: 'Wilayah 01',
};

console.log('\n2. Evaluasi Koordinat Asal Target Aceh setelah Approved:');
console.log('   KODE POS Target:', approvedTarget['KODE POS']);
console.log('   Dati II Target:', approvedTarget['Dati II']);
console.log('   Alamat yang tersimpan setelah approve:', approvedTarget.ALAMAT);

const resolvedTargetCoords = resolveTargetRowCoordinates(approvedTarget);
console.log('   Koordinat Target Terhitung:', resolvedTargetCoords);

// 4. Evaluasi Koordinat Cabang KIM (Tujuan):
const kimCoords = resolveBranchCoordinates(masterRows[0]);
console.log('   Koordinat Cabang KIM (Medan):', kimCoords);

// 5. Cek apakah clusterMasterRowsForMap mengaitkan data matched ini ke pin KIM:
const pins = clusterMasterRowsForMap(masterRows, 'ALL', [approvedTarget]);
const kimPin = pins.find(p => p.primaryOutletName.includes('KIM'));
console.log('\n3. Evaluasi Pin Cabang KIM di Peta:');
console.log('   Pin Cabang KIM ditemukan:', !!kimPin);
console.log('   Matched Count pada Pin KIM:', kimPin?.matchedCount);

// 6. Cek apakah ada pin cabang yang BERLOKASI FISIK DI ACEH:
const acehPins = pins.filter(p => p.lat >= 2.0 && p.lat <= 6.0 && p.lng <= 98.0 && (p.dati2.includes('ACEH') || p.kodePos.startsWith('23') || p.kodePos.startsWith('24')));
console.log('\n4. Pin Cabang Fisik yang Berlokasi di Provinsi Aceh:');
console.log(`   Jumlah Pin Cabang Fisik di Aceh: ${acehPins.length}`);
if (acehPins.length === 0) {
  console.log('   ⚠️ PENJELASAN: Di master data BNI, TIDAK ADA kantor cabang fisik di Provinsi Aceh karena operasional BNI Aceh dialihkan/dilayani oleh Cabang KIM (Sumut).');
}

// 7. Cek Trajektori Garis Lengkung dari Aceh ke KIM Medan:
if (kimPin && resolvedTargetCoords) {
  const arc = createCurvedArcPoints([resolvedTargetCoords.lat, resolvedTargetCoords.lng], [kimPin.lat, kimPin.lng]);
  console.log('\n5. Trajektori Busur Garis Lengkung (Aceh -> Medan KIM):');
  console.log(`   Dari: [${resolvedTargetCoords.lat}, ${resolvedTargetCoords.lng}] (${resolvedTargetCoords.city})`);
  console.log(`   Menuju: [${kimPin.lat}, ${kimPin.lng}] (${kimPin.dati2})`);
  console.log(`   Jumlah Titik Kurva: ${arc.length}`);
}
