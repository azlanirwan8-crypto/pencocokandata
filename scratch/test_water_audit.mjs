import { readFileSync } from 'fs';

const content = readFileSync('src/utils/geoCoder.ts', 'utf-8');

// Test all coordinates in geoCoder.ts
const coordMatches = [...content.matchAll(/lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)/g)];
console.log(`Found ${coordMatches.length} lat/lng pairs in geoCoder.ts`);

const suspicious = [];

for (const m of coordMatches) {
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);

  // Jayapura check: east of 140.705 between -2.51 and -2.58 is water!
  if (lat >= -2.58 && lat <= -2.51 && lng > 140.704) {
    suspicious.push({ lat, lng, reason: 'Jayapura water (Teluk Yos Sudarso)' });
  }

  // Padang check: west of 100.358 between -1.15 and -0.75 is water!
  if (lat >= -1.15 && lat <= -0.75 && lng < 100.358) {
    suspicious.push({ lat, lng, reason: 'Padang ocean (Indian Ocean)' });
  }

  // Semarang check: north of -6.958 between 110.35 and 110.48 is water!
  if (lat > -6.958 && lng >= 110.35 && lng <= 110.48) {
    suspicious.push({ lat, lng, reason: 'Semarang water (Java Sea)' });
  }

  // Surabaya check: north of -7.195 or east of 112.80 is water!
  if ((lat > -7.195 && lng >= 112.65 && lng <= 112.80) || (lng > 112.80 && lat >= -7.33 && lat <= -7.18)) {
    suspicious.push({ lat, lng, reason: 'Surabaya water (Madura Strait)' });
  }

  // Balikpapan check: south of -1.265 or east of 116.890
  if (lat < -1.265 && lng >= 116.80 && lng <= 116.92) {
    suspicious.push({ lat, lng, reason: 'Balikpapan south water' });
  }

  // Makassar check: west of 119.408
  if (lng < 119.408 && lat >= -5.20 && lat <= -5.08) {
    suspicious.push({ lat, lng, reason: 'Makassar west water (Makassar Strait)' });
  }

  // Banda Aceh check: north of 5.575
  if (lat > 5.575 && lng >= 95.25 && lng <= 95.38) {
    suspicious.push({ lat, lng, reason: 'Banda Aceh north water (Andaman Sea)' });
  }

  // Manado check: west of 124.834
  if (lng < 124.834 && lat >= 1.44 && lat <= 1.52) {
    suspicious.push({ lat, lng, reason: 'Manado west water' });
  }
}

console.log('Suspicious coordinates in water:', suspicious);
