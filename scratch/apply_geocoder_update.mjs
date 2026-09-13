import fs from 'fs';

const original = fs.readFileSync('src/utils/geoCoder.ts', 'utf8');
const dati2Code = fs.readFileSync('scratch/dati2_map_code.txt', 'utf8');

// 1. Add Jambi 3-digit prefixes to POSTAL_3DIGIT_MAP
const jambi3Digit = `  // Jambi (361 - 373)
  '361': { lat: -1.6101, lng: 103.6131, city: 'Kota Jambi', province: 'Jambi' },
  '362': { lat: -1.6200, lng: 103.6200, city: 'Kota Jambi Selatan', province: 'Jambi' },
  '363': { lat: -1.5500, lng: 103.8000, city: 'Muaro Jambi', province: 'Jambi' },
  '364': { lat: -1.7500, lng: 103.1167, city: 'Batanghari / Muara Bulian', province: 'Jambi' },
  '365': { lat: -1.0500, lng: 103.1500, city: 'Tanjung Jabung Barat / Kuala Tungkal', province: 'Jambi' },
  '366': { lat: -1.7500, lng: 103.1167, city: 'Batanghari', province: 'Jambi' },
  '367': { lat: -1.1350, lng: 103.8550, city: 'Tanjung Jabung Timur / Muara Sabak', province: 'Jambi' },
  '371': { lat: -2.0667, lng: 101.4000, city: 'Sungai Penuh / Kerinci', province: 'Jambi' },
  '372': { lat: -1.4833, lng: 102.1167, city: 'Bungo / Muara Bungo', province: 'Jambi' },
  '373': { lat: -2.0667, lng: 102.2667, city: 'Merangin / Bangko / Sarolangun', province: 'Jambi' },\n`;

// 2. Add Muara Sabak exact 5-digit postal codes to EXACT_POSTAL_MAP
const muaraSabakExact = `  // Muara Sabak & Tanjung Jabung Timur (36761 - 36766)
  '36761': { lat: -1.1278, lng: 103.8547, city: 'Muara Sabak / Kab. Tanjung Jabung Timur', province: 'Jambi' },
  '36762': { lat: -1.1350, lng: 103.8600, city: 'Muara Sabak Barat / Kab. Tanjung Jabung Timur', province: 'Jambi' },
  '36763': { lat: -1.1400, lng: 103.8700, city: 'Muara Sabak Timur / Kab. Tanjung Jabung Timur', province: 'Jambi' },
  '36764': { lat: -1.1500, lng: 103.8800, city: 'Kuala Jambi / Kab. Tanjung Jabung Timur', province: 'Jambi' },
  '36765': { lat: -1.2500, lng: 104.0500, city: 'Nipah Panjang / Kab. Tanjung Jabung Timur', province: 'Jambi' },
  '36766': { lat: -1.3000, lng: 103.9500, city: 'Rantau Rasau / Kab. Tanjung Jabung Timur', province: 'Jambi' },\n`;

// 3. Add Jambi districts to CITY_DISTRICTS_MAP
const jambiDistricts = `  // Jambi & Tanjung Jabung Timur / Barat
  'MUARA SABAK': { lat: -1.1278, lng: 103.8547, city: 'Muara Sabak', province: 'Jambi' },
  'MUARA SABAK BARAT': { lat: -1.1278, lng: 103.8547, city: 'Muara Sabak Barat', province: 'Jambi' },
  'MUARA SABAK TIMUR': { lat: -1.1400, lng: 103.8700, city: 'Muara Sabak Timur', province: 'Jambi' },
  'TALANG BABAT': { lat: -1.1278, lng: 103.8547, city: 'Talang Babat (Muara Sabak)', province: 'Jambi' },
  'TANJUNG JABUNG TIMUR': { lat: -1.1350, lng: 103.8550, city: 'Tanjung Jabung Timur', province: 'Jambi' },
  'TANJUNG JABUNG BARAT': { lat: -1.0500, lng: 103.1500, city: 'Tanjung Jabung Barat', province: 'Jambi' },
  'KUALA TUNGKAL': { lat: -0.8167, lng: 103.4667, city: 'Tanjung Jabung Barat', province: 'Jambi' },
  'MUARO JAMBI': { lat: -1.5500, lng: 103.8000, city: 'Muaro Jambi', province: 'Jambi' },
  'SENGETI': { lat: -1.4000, lng: 103.5833, city: 'Muaro Jambi (Sengeti)', province: 'Jambi' },
  'SAROLANGUN': { lat: -2.3000, lng: 102.6500, city: 'Sarolangun', province: 'Jambi' },
  'BANGKO': { lat: -2.0667, lng: 102.2667, city: 'Merangin (Bangko)', province: 'Jambi' },
  'MERANGIN': { lat: -2.1667, lng: 102.1333, city: 'Merangin', province: 'Jambi' },
  'MUARA BUNGO': { lat: -1.4833, lng: 102.1167, city: 'Bungo', province: 'Jambi' },
  'BUNGO': { lat: -1.5000, lng: 101.9667, city: 'Bungo', province: 'Jambi' },
  'MUARA TEBO': { lat: -1.4667, lng: 102.4333, city: 'Tebo', province: 'Jambi' },
  'TEBO': { lat: -1.4500, lng: 102.4000, city: 'Tebo', province: 'Jambi' },
  'SUNGAI PENUH': { lat: -2.0667, lng: 101.4000, city: 'Sungai Penuh', province: 'Jambi' },
  'KERINCI': { lat: -2.0833, lng: 101.5000, city: 'Kerinci', province: 'Jambi' },\n`;

// 4. Province Centroids dictionary for 100% reliable fallback
const provinceCentroidsCode = `// 3b. Provincial Centroids for Safe Regional Fallback (Never jumps across islands)
export const PROVINCE_CENTROIDS: Record<string, { lat: number; lng: number; city: string; province: string }> = {
  'ACEH': { lat: 5.5483, lng: 95.3238, city: 'Banda Aceh', province: 'Aceh' },
  'SUMATERA UTARA': { lat: 3.5952, lng: 98.6722, city: 'Medan', province: 'Sumatera Utara' },
  'SUMATERA BARAT': { lat: -0.9471, lng: 100.4172, city: 'Padang', province: 'Sumatera Barat' },
  'RIAU': { lat: 0.5071, lng: 101.4478, city: 'Pekanbaru', province: 'Riau' },
  'KEPULAUAN RIAU': { lat: 0.9167, lng: 104.4500, city: 'Tanjungpinang', province: 'Kepulauan Riau' },
  'JAMBI': { lat: -1.6101, lng: 103.6131, city: 'Jambi', province: 'Jambi' },
  'SUMATERA SELATAN': { lat: -2.9761, lng: 104.7754, city: 'Palembang', province: 'Sumatera Selatan' },
  'KEPULAUAN BANGKA BELITUNG': { lat: -2.1333, lng: 106.1167, city: 'Pangkalpinang', province: 'Kepulauan Bangka Belitung' },
  'BANGKA BELITUNG': { lat: -2.1333, lng: 106.1167, city: 'Pangkalpinang', province: 'Kepulauan Bangka Belitung' },
  'BENGKULU': { lat: -3.8004, lng: 102.2655, city: 'Bengkulu', province: 'Bengkulu' },
  'LAMPUNG': { lat: -5.4292, lng: 105.2611, city: 'Bandar Lampung', province: 'Lampung' },
  'DKI JAKARTA': { lat: -6.1818, lng: 106.8340, city: 'Jakarta Pusat', province: 'DKI Jakarta' },
  'JAKARTA': { lat: -6.1818, lng: 106.8340, city: 'Jakarta Pusat', province: 'DKI Jakarta' },
  'JAWA BARAT': { lat: -6.9175, lng: 107.6191, city: 'Bandung', province: 'Jawa Barat' },
  'BANTEN': { lat: -6.1104, lng: 106.1639, city: 'Serang', province: 'Banten' },
  'JAWA TENGAH': { lat: -6.9932, lng: 110.4203, city: 'Semarang', province: 'Jawa Tengah' },
  'D.I. YOGYAKARTA': { lat: -7.7956, lng: 110.3695, city: 'Yogyakarta', province: 'D.I. Yogyakarta' },
  'DI YOGYAKARTA': { lat: -7.7956, lng: 110.3695, city: 'Yogyakarta', province: 'D.I. Yogyakarta' },
  'YOGYAKARTA': { lat: -7.7956, lng: 110.3695, city: 'Yogyakarta', province: 'D.I. Yogyakarta' },
  'JAWA TIMUR': { lat: -7.2575, lng: 112.7521, city: 'Surabaya', province: 'Jawa Timur' },
  'BALI': { lat: -8.6705, lng: 115.2126, city: 'Denpasar', province: 'Bali' },
  'NUSA TENGGARA BARAT': { lat: -8.5833, lng: 116.1167, city: 'Mataram', province: 'Nusa Tenggara Barat' },
  'NTB': { lat: -8.5833, lng: 116.1167, city: 'Mataram', province: 'Nusa Tenggara Barat' },
  'NUSA TENGGARA TIMUR': { lat: -10.1772, lng: 123.6070, city: 'Kupang', province: 'Nusa Tenggara Timur' },
  'NTT': { lat: -10.1772, lng: 123.6070, city: 'Kupang', province: 'Nusa Tenggara Timur' },
  'KALIMANTAN BARAT': { lat: -0.0263, lng: 109.3425, city: 'Pontianak', province: 'Kalimantan Barat' },
  'KALIMANTAN TENGAH': { lat: -2.2167, lng: 113.9167, city: 'Palangkaraya', province: 'Kalimantan Tengah' },
  'KALIMANTAN SELATAN': { lat: -3.3167, lng: 114.5900, city: 'Banjarmasin', province: 'Kalimantan Selatan' },
  'KALIMANTAN TIMUR': { lat: -0.5022, lng: 117.1536, city: 'Samarinda', province: 'Kalimantan Timur' },
  'KALIMANTAN UTARA': { lat: 2.9000, lng: 117.3333, city: 'Tanjung Selor', province: 'Kalimantan Utara' },
  'SULAWESI UTARA': { lat: 1.4748, lng: 124.8421, city: 'Manado', province: 'Sulawesi Utara' },
  'GORONTALO': { lat: 0.5406, lng: 123.0595, city: 'Gorontalo', province: 'Gorontalo' },
  'SULAWESI TENGAH': { lat: -0.8917, lng: 119.8707, city: 'Palu', province: 'Sulawesi Tengah' },
  'SULAWESI BARAT': { lat: -2.6748, lng: 118.8885, city: 'Mamuju', province: 'Sulawesi Barat' },
  'SULAWESI SELATAN': { lat: -5.1477, lng: 119.4327, city: 'Makassar', province: 'Sulawesi Selatan' },
  'SULAWESI TENGGARA': { lat: -3.9667, lng: 122.5833, city: 'Kendari', province: 'Sulawesi Tenggara' },
  'MALUKU': { lat: -3.6958, lng: 128.1831, city: 'Ambon', province: 'Maluku' },
  'MALUKU UTARA': { lat: 0.7833, lng: 127.3667, city: 'Ternate / Sofifi', province: 'Maluku Utara' },
  'PAPUA': { lat: -2.5527, lng: 140.7140, city: 'Jayapura', province: 'Papua' },
  'PAPUA BARAT': { lat: -0.8667, lng: 134.0833, city: 'Manokwari', province: 'Papua Barat' },
  'PAPUA BARAT DAYA': { lat: -0.8667, lng: 131.2500, city: 'Sorong', province: 'Papua Barat Daya' },
  'PAPUA SELATAN': { lat: -8.4667, lng: 140.3333, city: 'Merauke', province: 'Papua Selatan' },
  'PAPUA TENGAH': { lat: -3.3667, lng: 135.5000, city: 'Nabire', province: 'Papua Tengah' },
  'PAPUA PEGUNUNGAN': { lat: -4.0833, lng: 138.9500, city: 'Wamena', province: 'Papua Pegunungan' },
};\n`;

console.log('Step 1: Preparing updated geoCoder.ts content...');

// Replace DATI2_MAP
const datiStart = original.indexOf('const DATI2_MAP: Record<string, { lat: number; lng: number; province: string }> = {');
const datiEnd = original.indexOf('// 4. Centroids for BNI Wilayah Codes (Fallback)');

if (datiStart === -1 || datiEnd === -1) {
  throw new Error(`Markers not found! start: ${datiStart}, end: ${datiEnd}`);
}

const beforeDati = original.substring(0, datiStart);
const afterDati = original.substring(datiEnd);

const newDatiBlock = `export const DATI2_MAP: Record<string, { lat: number; lng: number; province: string }> = {\n${dati2Code}\n};\n\n${provinceCentroidsCode}\n`;

let updated = beforeDati + newDatiBlock + afterDati;

// Insert Jambi into POSTAL_3DIGIT_MAP (before Situbondo)
const situbondoMarker = `  // Situbondo / Jawa Timur (683)`;
updated = updated.replace(situbondoMarker, `${jambi3Digit}\n${situbondoMarker}`);

// Insert Muara Sabak into EXACT_POSTAL_MAP (after Balige)
const exactMarker = `  // Balige & Toba (22311 - 22316)`;
updated = updated.replace(exactMarker, `${muaraSabakExact}\n${exactMarker}`);

// Insert Jambi into CITY_DISTRICTS_MAP (before Situbondo)
const districtsSitubondo = `  // Situbondo & Sekitarnya`;
updated = updated.replace(districtsSitubondo, `${jambiDistricts}\n${districtsSitubondo}`);

// Replace cleanDati2 implementation
const oldCleanDati = `function cleanDati2(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .toUpperCase()
    .replace(/^KOTA\\s+ADM\\.?\\s*/i, 'KOTA ')
    .replace(/^KABUPATEN\\s+/i, 'KAB. ')
    .trim();
}`;

const newCleanDati = `export function cleanDati2(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .toUpperCase()
    .replace(/^KOTA\\s+ADM(?:INISTRASI)?\\.?\\s*/i, '')
    .replace(/^KOTA\\s+/i, '')
    .replace(/^KABUPATEN\\s+/i, '')
    .replace(/^KAB\\.\\s*/i, '')
    .replace(/^DATI\\s+II\\s+/i, '')
    .replace(/^DATI\\s+2\\s+/i, '')
    .trim();
}`;

updated = updated.replace(oldCleanDati, newCleanDati);

fs.writeFileSync('src/utils/geoCoder.ts', updated, 'utf8');
console.log('Successfully updated src/utils/geoCoder.ts with 514+ Kabupaten/Kota database!');
