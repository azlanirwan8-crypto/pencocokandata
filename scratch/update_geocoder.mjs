import fs from 'fs';
import { INDONESIA_ALL_DATI2 } from './indonesia_all_dati2.js';

// Build complete DATI2_MAP code
const entries = [];
INDONESIA_ALL_DATI2.forEach(item => {
  const rawName = item.name.toUpperCase().trim();
  const bareName = rawName
    .replace(/^KOTA\s+ADM(?:INISTRASI)?\.?\s*/i, '')
    .replace(/^KOTA\s+/i, '')
    .replace(/^KABUPATEN\s+/i, '')
    .replace(/^KAB\.\s*/i, '')
    .trim();

  const coords = `{ lat: ${item.lat}, lng: ${item.lng}, province: '${item.province}' }`;
  entries.push(`  '${rawName}': ${coords},`);
  entries.push(`  '${bareName}': ${coords},`);
  if (rawName.startsWith('KAB.')) {
    entries.push(`  'KABUPATEN ${bareName}': ${coords},`);
  } else if (rawName.startsWith('KOTA')) {
    entries.push(`  'KOTA ${bareName}': ${coords},`);
  }
});

// Remove duplicate keys while preserving order
const seen = new Set();
const uniqueEntries = [];
for (const e of entries) {
  const key = e.split(':')[0].trim();
  if (!seen.has(key)) {
    seen.add(key);
    uniqueEntries.push(e);
  }
}

console.log(`Generated ${uniqueEntries.length} unique DATI2_MAP entries across all 514+ Kabupaten/Kota.`);
fs.writeFileSync('scratch/dati2_map_code.txt', uniqueEntries.join('\n'), 'utf8');
