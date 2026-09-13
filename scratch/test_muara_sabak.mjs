import fs from 'fs';

const file = fs.readFileSync('src/utils/geoCoder.ts', 'utf8');

function cleanDati2(raw) {
  return raw
    .toUpperCase()
    .replace(/^KABUPATEN\s+/i, '')
    .replace(/^KAB\.\s+/i, '')
    .replace(/^KOTA\s+ADM(?:INISTRASI)?\.?\s+/i, '')
    .replace(/^KOTA\s+/i, '')
    .replace(/^DATI\s+II\s+/i, '')
    .replace(/^DATI\s+2\s+/i, '')
    .trim();
}

// Extract DATI2_MAP
const datiStart = file.indexOf('const DATI2_MAP');
const datiEnd = file.indexOf('const WILAYAH_CENTROID_MAP');
const datiSub = file.substring(datiStart, datiEnd);

const datiEntries = [];
for (const line of datiSub.split('\n')) {
  const m = line.match(/^\s*['"]([^'"]+)['"]\s*:\s*\{\s*lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)/);
  if (m) {
    datiEntries.push({ key: m[1], lat: parseFloat(m[2]), lng: parseFloat(m[3]), line: line.trim() });
  }
}
console.log('Total DATI2_MAP entries:', datiEntries.length);

const cleaned = cleanDati2('Kabupaten Tanjung Jabung Timur');
console.log('Cleaned Dati II:', cleaned);

let matchedDati = false;
for (const entry of datiEntries) {
  if (cleaned === entry.key) {
    console.log('EXACT MATCH DATI2:', entry);
    matchedDati = true;
    break;
  }
}
if (!matchedDati) {
  for (const entry of datiEntries) {
    if (cleaned.includes(entry.key) || entry.key.includes(cleaned)) {
      console.log('SUBSTRING MATCH DATI2: cleaned="' + cleaned + '" vs entry.key="' + entry.key + '" ->', entry);
      matchedDati = true;
      break;
    }
  }
}
if (!matchedDati) console.log('NO MATCH in DATI2_MAP');

// Next: POSTAL_3DIGIT_MAP with '367'
const kp = '36761';
console.log('Testing rawKodePos.slice(0,3):', kp.slice(0, 3));
const p3Start = file.indexOf('const POSTAL_3DIGIT_MAP');
const p3End = file.indexOf('const CITY_DISTRICTS_MAP');
const p3Sub = file.substring(p3Start, p3End);
const p3Entries = {};
for (const line of p3Sub.split('\n')) {
  const m = line.match(/^\s*['"]([^'"]+)['"]\s*:\s*\{\s*lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)/);
  if (m) {
    p3Entries[m[1]] = { lat: parseFloat(m[2]), lng: parseFloat(m[3]), line: line.trim() };
  }
}
console.log('POSTAL_3DIGIT_MAP[367]:', p3Entries['367']);

// Next: POSTAL_PREFIX_MAP with '36'
const p2Start = file.indexOf('const POSTAL_PREFIX_MAP');
const p2End = file.indexOf('const EXACT_POSTAL_MAP');
const p2Sub = file.substring(p2Start, p2End);
const p2Entries = {};
for (const line of p2Sub.split('\n')) {
  const m = line.match(/^\s*['"]([^'"]+)['"]\s*:\s*\{\s*lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)/);
  if (m) {
    p2Entries[m[1]] = { lat: parseFloat(m[2]), lng: parseFloat(m[3]), line: line.trim() };
  }
}
console.log('POSTAL_PREFIX_MAP[36]:', p2Entries['36']);
