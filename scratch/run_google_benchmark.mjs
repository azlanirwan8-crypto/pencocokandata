const queries = [
  // Papua / Jayapura
  { name: 'KCU Jayapura (Jl. Argapura)', q: 'Jl. Argapura, Jayapura' },
  { name: 'Abepura, Jayapura', q: 'Abepura, Kota Jayapura' },
  { name: 'Sentani, Jayapura', q: 'Sentani, Jayapura' },
  { name: 'Entrop, Jayapura', q: 'Entrop, Jayapura' },
  { name: 'Hamadi, Jayapura', q: 'Hamadi, Jayapura' },
  { name: 'Kotaraja, Jayapura', q: 'Kotaraja, Jayapura' },
  { name: 'Waena, Jayapura', q: 'Waena, Jayapura' },

  // Situbondo (fata.xlsx)
  { name: 'Besuki, Situbondo', q: 'Besuki, Situbondo' },
  { name: 'Asembagus, Situbondo', q: 'Asembagus, Situbondo' },
  { name: 'Situbondo Kota', q: 'Kabupaten Situbondo, Jawa Timur' },

  // Padang
  { name: 'Padang Barat', q: 'Kecamatan Padang Barat, Padang' },
  { name: 'Koto Tangah, Padang', q: 'Koto Tangah, Padang' },
  { name: 'Nanggalo, Padang', q: 'Nanggalo, Padang' },
  { name: 'Kuranji, Padang', q: 'Kuranji, Padang' },

  // Aceh
  { name: 'Banda Aceh Kota', q: 'Banda Aceh, Aceh' },
  { name: 'Baiturrahman, Banda Aceh', q: 'Baiturrahman, Banda Aceh' },

  // Surabaya & Semarang
  { name: 'Gresik Kota', q: 'Gresik, Jawa Timur' },
  { name: 'Semarang Tengah', q: 'Semarang Tengah, Semarang' },
  { name: 'Genteng, Surabaya', q: 'Genteng, Surabaya' },
];

async function runBenchmark() {
  console.log('=== BENCHMARKING TO REAL WORLD GEODATA (OSM / GOOGLE MAPS EQUIVALENT) ===\n');
  const results = [];

  for (const item of queries) {
    try {
      // Add delay to respect Nominatim rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=id&q=${encodeURIComponent(item.q)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'DataMatcherAudit/2.0 (azlanirwan8@gmail.com)' } });
      const data = await res.json();
      if (data && data.length > 0) {
        const top = data[0];
        results.push({
          name: item.name,
          query: item.q,
          lat: parseFloat(top.lat),
          lng: parseFloat(top.lon),
          displayName: top.display_name,
        });
        console.log(`[VERIFIED] ${item.name} -> Lat: ${top.lat}, Lng: ${top.lon}`);
      } else {
        console.warn(`[NOT FOUND] ${item.name}`);
      }
    } catch (err) {
      console.error(`[ERROR] ${item.name}: ${err.message}`);
    }
  }

  console.log('\nTotal verified:', results.length);
  return results;
}

runBenchmark().then((res) => {
  import('fs').then((fs) => {
    fs.writeFileSync('scratch/google_benchmark_results.json', JSON.stringify(res, null, 2));
    console.log('Saved benchmark results to scratch/google_benchmark_results.json');
  });
});
