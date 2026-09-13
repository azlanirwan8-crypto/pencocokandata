import xlsx from 'xlsx';

const POSTAL_PREFIX_MAP = {
  '10': { lat: -6.1818, lng: 106.8340, city: 'Jakarta Pusat', province: 'DKI Jakarta' },
  '11': { lat: -6.1683, lng: 106.7588, city: 'Jakarta Barat', province: 'DKI Jakarta' },
  '12': { lat: -6.2615, lng: 106.8106, city: 'Jakarta Selatan', province: 'DKI Jakarta' },
  '13': { lat: -6.2250, lng: 106.9004, city: 'Jakarta Timur', province: 'DKI Jakarta' },
  '14': { lat: -6.1384, lng: 106.8640, city: 'Jakarta Utara', province: 'DKI Jakarta' },
  '15': { lat: -6.2088, lng: 106.6381, city: 'Tangerang / Tangerang Selatan', province: 'Banten' },
  '16': { lat: -6.5971, lng: 106.8060, city: 'Bogor / Depok', province: 'Jawa Barat' },
  '17': { lat: -6.2383, lng: 106.9756, city: 'Bekasi', province: 'Jawa Barat' },
  '60': { lat: -7.2575, lng: 112.7521, city: 'Surabaya', province: 'Jawa Timur' },
  '61': { lat: -7.4530, lng: 112.7180, city: 'Sidoarjo / Gresik', province: 'Jawa Timur' },
  '62': { lat: -7.1167, lng: 112.0000, city: 'Bojonegoro / Tuban / Lamongan', province: 'Jawa Timur' },
  '63': { lat: -7.6298, lng: 111.5239, city: 'Madiun / Ngawi / Magetan / Ponorogo', province: 'Jawa Timur' },
  '64': { lat: -7.8167, lng: 112.0167, city: 'Kediri / Nganjuk / Tulungagung / Blitar', province: 'Jawa Timur' },
  '65': { lat: -7.9797, lng: 112.6304, city: 'Malang / Batu', province: 'Jawa Timur' },
  '66': { lat: -7.7543, lng: 113.2159, city: 'Probolinggo / Pasuruan', province: 'Jawa Timur' },
  '67': { lat: -8.1724, lng: 113.7000, city: 'Jember / Lumajang', province: 'Jawa Timur' },
  '68': { lat: -8.2192, lng: 114.3691, city: 'Banyuwangi / Situbondo / Bondowoso', province: 'Jawa Timur' },
  '69': { lat: -7.0167, lng: 113.8667, city: 'Madura', province: 'Jawa Timur' },
};

const DATI2_MAP = {
  'KOTA JAKARTA PUSAT': { lat: -6.1805, lng: 106.8284, province: 'DKI Jakarta' },
  'JAKARTA PUSAT': { lat: -6.1805, lng: 106.8284, province: 'DKI Jakarta' },
  'SITUBONDO': { lat: -7.7061, lng: 114.0048, province: 'Jawa Timur' },
  'KAB. SITUBONDO': { lat: -7.7061, lng: 114.0048, province: 'Jawa Timur' },
  'KOTA SURABAYA': { lat: -7.2575, lng: 112.7521, province: 'Jawa Timur' },
};

const CITY_DISTRICTS_MAP = {
  'BESUKI': { lat: -7.7343, lng: 113.6902, city: 'Situbondo', province: 'Jawa Timur' },
  'ASEMBAGUS': { lat: -7.7491, lng: 114.2181, city: 'Situbondo', province: 'Jawa Timur' },
  'SITUBONDO': { lat: -7.7060, lng: 114.0050, city: 'Situbondo', province: 'Jawa Timur' },
  'PANJI': { lat: -7.7120, lng: 114.0200, city: 'Situbondo', province: 'Jawa Timur' },
  'KAPONGAN': { lat: -7.7180, lng: 114.0900, city: 'Situbondo', province: 'Jawa Timur' },
  'BANYUGLUGUR': { lat: -7.7300, lng: 113.6000, city: 'Situbondo', province: 'Jawa Timur' },
  'SUBOH': { lat: -7.7450, lng: 113.7200, city: 'Situbondo', province: 'Jawa Timur' },
  'MANGARAN': { lat: -7.6850, lng: 114.0350, city: 'Situbondo', province: 'Jawa Timur' },
  'JANGKAR': { lat: -7.7200, lng: 114.1800, city: 'Situbondo', province: 'Jawa Timur' },
  'GAMBIR': { lat: -6.1750, lng: 106.8230, city: 'Jakarta Pusat', province: 'DKI Jakarta' },
  'MENTENG': { lat: -6.1950, lng: 106.8300, city: 'Jakarta Pusat', province: 'DKI Jakarta' },
  'SENEN': { lat: -6.1850, lng: 106.8450, city: 'Jakarta Pusat', province: 'DKI Jakarta' },
};

function normalizeKodePos(val) {
  if (val == null) return '';
  const str = String(val).trim();
  if (!str) return '';
  const cleanDigits = str.replace(/\D/g, '');
  if (!cleanDigits) return str;
  if (cleanDigits.length <= 5) return cleanDigits.padStart(5, '0');
  return cleanDigits.slice(0, 5);
}

function cleanText(val) {
  if (val == null) return '';
  return String(val).trim().toLowerCase().replace(/[()\[\]{}'\"\`:;*#~]+/g, ' ').replace(/[\s\-_/\\,.]+/g, ' ').trim();
}

function cleanDati2(raw) {
  if (!raw) return '';
  return String(raw).toUpperCase().replace(/^KOTA\s+ADM\.?\s*/i, 'KOTA ').replace(/^KABUPATEN\s+/i, 'KAB. ').trim();
}

function clampToInland(lat, lng) {
  let cLat = lat; let cLng = lng;
  if (cLng < 94.5) cLng = 94.5;
  if (cLng > 141.2) cLng = 141.2;
  if (cLat < -11.2) cLat = -11.2;
  if (cLat > 6.2) cLat = 6.2;

  if (cLat >= -2.570 && cLat <= -2.510 && cLng > 140.7035) cLng = 140.7015;
  if (cLat >= -2.610 && cLat < -2.570 && cLng > 140.6970) cLng = 140.6920;
  if (cLat >= -1.15 && cLat <= -0.75 && cLng < 100.3595) cLng = 100.3605;
  if (cLat > -6.958 && cLng >= 110.35 && cLng <= 110.48) cLat = -6.968;
  if (cLat > -7.198 && cLng >= 112.65 && cLng <= 112.80) cLat = -7.215;
  if (cLng > 112.795 && cLat >= -7.33 && cLat <= -7.18) cLng = 112.785;
  if (cLat < -1.260 && cLng >= 116.80 && cLng <= 116.92) cLat = -1.255;
  if (cLng > 116.885 && cLat >= -1.27 && cLat <= -1.15) cLng = 116.875;
  if (cLng < 119.408 && cLat >= -5.20 && cLat <= -5.08) cLng = 119.418;
  if (cLat > 5.575 && cLat < 5.80 && cLng >= 95.25 && cLng <= 95.38) cLat = 5.560;
  if (cLng < 124.834 && cLat >= 1.44 && cLat <= 1.52) cLng = 124.842;
  if (cLat > -10.158 && cLng >= 123.55 && cLng <= 123.65) cLat = -10.170;
  if (cLng < 98.780 && cLat >= 1.70 && cLat <= 1.78) cLng = 98.788;
  if (cLng < 102.260 && cLat >= -3.85 && cLat <= -3.75) cLng = 102.270;
  return [Number(cLat.toFixed(6)), Number(cLng.toFixed(6))];
}

function resolveCoordinates(row) {
  const rawKodePos = normalizeKodePos(row['KODE POS']);
  const rawDati2 = cleanDati2(row['Dati II'] || '');
  const rawKecamatan = String(row.Kecamatan || '').toUpperCase().trim();
  const rawKelurahan = String(row.Kelurahan || '').toUpperCase().trim();
  const rawAlamat = String(row.ALAMAT || '').toUpperCase().trim();
  const rawNama = String(row['Nama Outlet'] || '').toUpperCase().trim();
  const fullText = `${rawNama} ${rawKelurahan} ${rawKecamatan} ${rawAlamat} ${rawDati2}`;

  // District map
  for (const [districtKey, distData] of Object.entries(CITY_DISTRICTS_MAP)) {
    const escaped = districtKey.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?:^|[\\s,./-])${escaped}(?:$|[\\s,./-])`, 'i');
    if (regex.test(fullText)) {
      return { ...distData, source: 'district_map' };
    }
  }

  // Postal prefix
  if (rawKodePos.length >= 2) {
    const p2 = rawKodePos.slice(0, 2);
    if (POSTAL_PREFIX_MAP[p2]) {
      return { ...POSTAL_PREFIX_MAP[p2], source: 'postal_prefix' };
    }
  }

  // Dati II
  if (rawDati2 && DATI2_MAP[rawDati2]) {
    return { ...DATI2_MAP[rawDati2], source: 'dati2' };
  }
  for (const [key, d] of Object.entries(DATI2_MAP)) {
    if (rawDati2.includes(key) || key.includes(rawDati2)) {
      return { ...d, source: 'dati2_fuzzy' };
    }
  }

  return { lat: -6.1754, lng: 106.8272, city: 'Jakarta Pusat', province: 'DKI Jakarta', source: 'default_jakarta' };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const wb = xlsx.readFile('fata.xlsx', { cellFormula: false, cellText: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
const headers = data[0];
const rows = data.slice(1).map((r) => {
  const obj = {};
  headers.forEach((h, i) => obj[h] = r[i]);
  return obj;
});

console.log('=== ANALISIS DATA FATA.XLSX ===');
console.log('Total baris:', rows.length);

const resolved = rows.map((r) => {
  const coords = resolveCoordinates(r);
  const [clampedLat, clampedLng] = clampToInland(coords.lat, coords.lng);
  return {
    No: r.No,
    Wilayah: r.Wilayah,
    'Nama Outlet': r['Nama Outlet'],
    ALAMAT: r.ALAMAT,
    'KODE POS': r['KODE POS'],
    Kelurahan: r.Kelurahan,
    Kecamatan: r.Kecamatan,
    'Dati II': r['Dati II'],
    Provinsi: r.Provinsi,
    'SUMBER DATA': r['SUMBER DATA'],
    'CEK DUPLIKAT KODE POS': r['CEK DUPLIKAT KODE POS'],
    rawLat: coords.lat,
    rawLng: coords.lng,
    lat: clampedLat,
    lng: clampedLng,
    source: coords.source,
    wasClamped: coords.lat !== clampedLat || coords.lng !== clampedLng,
    isInIndonesiaBox: clampedLat >= -11.2 && clampedLat <= 6.2 && clampedLng >= 94.5 && clampedLng <= 141.2,
  };
});

console.log('\n--- Koordinat per Baris ---');
for (const item of resolved) {
  console.log(`#${item.No} ${item['Nama Outlet'] || '(no outlet)'} | ${item['Dati II']}, ${item.Provinsi} | KP ${item['KODE POS']} | [${item.lat}, ${item.lng}] source=${item.source} clamped=${item.wasClamped} inBox=${item.isInIndonesiaBox}`);
}

// Statistics
const sourceCount = {};
resolved.forEach((r) => { sourceCount[r.source] = (sourceCount[r.source] || 0) + 1; });
console.log('\n--- Distribusi Source Koordinat ---');
console.log(sourceCount);

const clampedCount = resolved.filter(r => r.wasClamped).length;
console.log('Baris yang di-clamp (raw keluar batas):', clampedCount);

const outOfBox = resolved.filter(r => !r.isInIndonesiaBox).length;
console.log('Baris di luar bounding box Indonesia:', outOfBox);

// Pairwise distance matrix
console.log('\n--- Jarak antar Titik (Haversine km) ---');
for (let i = 0; i < resolved.length; i++) {
  for (let j = i + 1; j < resolved.length; j++) {
    const a = resolved[i];
    const b = resolved[j];
    const d = haversineKm(a.lat, a.lng, b.lat, b.lng);
    console.log(`#${a.No} <-> #${b.No}: ${d} km`);
  }
}

// Detect rows with missing master fields
const missingMaster = rows.filter(r => !r['Sandi Cabang'] && !r['Branch Code'] && !r['Kode Cabang'] && !r['Nama Outlet']);
console.log('\nBaris tanpa atribut master (mungkin PTEN-TAMBAHAN/unmatched):', missingMaster.length);

// Wilayah consistency with kode pos
console.log('\n--- Konsistensi Wilayah vs Kode Pos ---');
for (const r of rows) {
  const wil = String(r.Wilayah);
  const kp = normalizeKodePos(r['KODE POS']);
  const prefix = kp.slice(0, 2);
  let expectedRegion = 'Unknown';
  if (['10', '11', '12', '13', '14', '15', '16', '17'].includes(prefix)) expectedRegion = 'Jabodetabek';
  else if (prefix === '68' || prefix === '69') expectedRegion = 'Jawa Timur Timur/Situbondo';
  else if (prefix.startsWith('6')) expectedRegion = 'Jawa Timur';
  else if (prefix.startsWith('1')) expectedRegion = 'Jabodetabek/Jawa Barat/Banten';
  console.log(`#${r.No} Wilayah=${wil} KP=${kp} -> ExpectedRegion=${expectedRegion}`);
}

console.log('\n=== SELESAI ===');
