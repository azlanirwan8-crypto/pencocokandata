var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/geoCoder.ts
var geoCoder_exports = {};
__export(geoCoder_exports, {
  CITY_DISTRICTS_MAP: () => CITY_DISTRICTS_MAP,
  EXACT_POSTAL_MAP: () => EXACT_POSTAL_MAP,
  FOREIGN_LAND_MASKS: () => FOREIGN_LAND_MASKS,
  INDONESIA_REGIONS: () => INDONESIA_REGIONS,
  POSTAL_3DIGIT_MAP: () => POSTAL_3DIGIT_MAP,
  clampToIndonesia: () => clampToIndonesia,
  clampToInland: () => clampToInland,
  clusterMasterRowsForMap: () => clusterMasterRowsForMap,
  createCurvedArcPoints: () => createCurvedArcPoints,
  extractWCode: () => extractWCode,
  getAllMatchedCoordinates: () => getAllMatchedCoordinates,
  groupTargetOriginsForMap: () => groupTargetOriginsForMap,
  isAcehTargetRow: () => isAcehTargetRow,
  isForeignLand: () => isForeignLand,
  resolveBranchCoordinates: () => resolveBranchCoordinates,
  resolveTargetOriginCoordinates: () => resolveTargetOriginCoordinates,
  resolveTargetRowCoordinates: () => resolveTargetRowCoordinates
});
module.exports = __toCommonJS(geoCoder_exports);

// src/utils/normalizer.ts
function formatWilayahName(val) {
  if (val === null || val === void 0) return "Tanpa Wilayah";
  const str = String(val).trim();
  if (!str || str === "-" || str === "0") return "Tanpa Wilayah";
  if (/^wilayah\b/i.test(str)) {
    return str.replace(/^wilayah/i, "Wilayah");
  }
  if (/^region\b/i.test(str)) {
    return str;
  }
  return `Wilayah ${str}`;
}

// src/utils/geoCoder.ts
var INDONESIA_REGIONS = {
  ALL: { name: "Seluruh Indonesia", center: [-1.2, 117], zoom: 5 },
  SUMATERA: { name: "Sumatera & Aceh", center: [3.2, 97.5], zoom: 6 },
  JAWA: { name: "Jawa & Banten", center: [-7.2504, 110.15], zoom: 7 },
  BALI_NUSA: { name: "Bali & Nusa Tenggara", center: [-8.65, 118.5], zoom: 7 },
  KALIMANTAN: { name: "Kalimantan", center: [-1.2, 114], zoom: 6 },
  SULAWESI: { name: "Sulawesi", center: [-2.5, 121.5], zoom: 6 },
  MALUKU_PAPUA: { name: "Maluku & Papua", center: [-3.8, 136], zoom: 5 }
};
var POSTAL_PREFIX_MAP = {
  // DKI Jakarta & Bodetabek (10 - 17)
  "10": { lat: -6.1818, lng: 106.834, city: "Jakarta Pusat", province: "DKI Jakarta" },
  "11": { lat: -6.1683, lng: 106.7588, city: "Jakarta Barat", province: "DKI Jakarta" },
  "12": { lat: -6.2615, lng: 106.8106, city: "Jakarta Selatan", province: "DKI Jakarta" },
  "13": { lat: -6.225, lng: 106.9004, city: "Jakarta Timur", province: "DKI Jakarta" },
  "14": { lat: -6.1384, lng: 106.864, city: "Jakarta Utara", province: "DKI Jakarta" },
  "15": { lat: -6.2088, lng: 106.6381, city: "Tangerang / Tangerang Selatan", province: "Banten" },
  "16": { lat: -6.5971, lng: 106.806, city: "Bogor / Depok", province: "Jawa Barat" },
  "17": { lat: -6.2383, lng: 106.9756, city: "Bekasi", province: "Jawa Barat" },
  // Sumatera Utara & Aceh (20 - 24)
  "20": { lat: 3.5952, lng: 98.6722, city: "Medan", province: "Sumatera Utara" },
  "21": { lat: 3.25, lng: 99.2, city: "Asahan / Batubara", province: "Sumatera Utara" },
  "22": { lat: 1.742, lng: 98.785, city: "Tapanuli / Sibolga", province: "Sumatera Utara" },
  "23": { lat: 5.553, lng: 95.322, city: "Banda Aceh", province: "Aceh" },
  "24": { lat: 4.8, lng: 97, city: "Lhokseumawe / Langsa", province: "Aceh" },
  // Sumatera Barat & Riau / Kepri (25 - 29)
  "25": { lat: -0.9478, lng: 100.3685, city: "Padang", province: "Sumatera Barat" },
  "26": { lat: -0.3, lng: 100.37, city: "Bukittinggi / Agam", province: "Sumatera Barat" },
  "27": { lat: -1, lng: 100.8, city: "Solok / Tanah Datar", province: "Sumatera Barat" },
  "28": { lat: 0.5071, lng: 101.4478, city: "Pekanbaru / Kampar", province: "Riau" },
  "29": { lat: 1.1301, lng: 104.0529, city: "Batam / Tanjung Pinang", province: "Kepulauan Riau" },
  // Sumatera Selatan, Bangka Belitung, Bengkulu, Lampung, Jambi (30 - 37)
  "30": { lat: -2.9761, lng: 104.7754, city: "Palembang", province: "Sumatera Selatan" },
  "31": { lat: -3.8, lng: 103.8, city: "Prabumulih / Lahat", province: "Sumatera Selatan" },
  "32": { lat: -4, lng: 104.2, city: "Baturaja / OKU", province: "Sumatera Selatan" },
  "33": { lat: -2.1316, lng: 106.1115, city: "Pangkal Pinang / Belitung", province: "Bangka Belitung" },
  "34": { lat: -4.8, lng: 105, city: "Kotabumi / Lampung Utara", province: "Lampung" },
  "35": { lat: -5.45, lng: 105.2667, city: "Bandar Lampung / Metro", province: "Lampung" },
  "36": { lat: -1.6101, lng: 103.6131, city: "Jambi", province: "Jambi" },
  "37": { lat: -2, lng: 102.5, city: "Muara Bungo / Kerinci", province: "Jambi" },
  "38": { lat: -3.7928, lng: 102.268, city: "Bengkulu", province: "Bengkulu" },
  // Jawa Barat & Banten (40 - 46)
  "40": { lat: -6.9175, lng: 107.6191, city: "Bandung / Cimahi", province: "Jawa Barat" },
  "41": { lat: -6.55, lng: 107.75, city: "Purwakarta / Subang", province: "Jawa Barat" },
  "42": { lat: -6.12, lng: 106.1503, city: "Serang / Cilegon / Pandeglang", province: "Banten" },
  "43": { lat: -6.9277, lng: 106.93, city: "Sukabumi / Cianjur", province: "Jawa Barat" },
  "44": { lat: -7.2278, lng: 107.9087, city: "Garut", province: "Jawa Barat" },
  "45": { lat: -6.732, lng: 108.5523, city: "Cirebon / Indramayu / Majalengka / Kuningan", province: "Jawa Barat" },
  "46": { lat: -7.3274, lng: 108.2207, city: "Tasikmalaya / Ciamis / Banjar", province: "Jawa Barat" },
  // Jawa Tengah & D.I. Yogyakarta (50 - 59)
  "50": { lat: -6.9667, lng: 110.4167, city: "Semarang", province: "Jawa Tengah" },
  "51": { lat: -6.8886, lng: 109.6753, city: "Pekalongan / Batang", province: "Jawa Tengah" },
  "52": { lat: -6.8694, lng: 109.1402, city: "Tegal / Brebes / Pemalang", province: "Jawa Tengah" },
  "53": { lat: -7.4244, lng: 109.2302, city: "Purwokerto / Banyumas / Cilacap", province: "Jawa Tengah" },
  "54": { lat: -7.675, lng: 109.65, city: "Kebumen / Purworejo", province: "Jawa Tengah" },
  "55": { lat: -7.7956, lng: 110.3695, city: "Yogyakarta / Sleman / Bantul", province: "D.I. Yogyakarta" },
  "56": { lat: -7.4706, lng: 110.2178, city: "Magelang / Temanggung", province: "Jawa Tengah" },
  "57": { lat: -7.5755, lng: 110.8243, city: "Surakarta (Solo) / Klaten / Sukoharjo / Karanganyar", province: "Jawa Tengah" },
  "58": { lat: -7, lng: 111, city: "Grobogan / Blora", province: "Jawa Tengah" },
  "59": { lat: -6.8048, lng: 110.8405, city: "Kudus / Pati / Jepara / Rembang", province: "Jawa Tengah" },
  // Jawa Timur & Madura (60 - 69)
  "60": { lat: -7.2575, lng: 112.7521, city: "Surabaya", province: "Jawa Timur" },
  "61": { lat: -7.453, lng: 112.718, city: "Sidoarjo / Gresik", province: "Jawa Timur" },
  "62": { lat: -7.1167, lng: 112, city: "Bojonegoro / Tuban / Lamongan", province: "Jawa Timur" },
  "63": { lat: -7.6298, lng: 111.5239, city: "Madiun / Ngawi / Magetan / Ponorogo", province: "Jawa Timur" },
  "64": { lat: -7.8167, lng: 112.0167, city: "Kediri / Nganjuk / Tulungagung / Blitar", province: "Jawa Timur" },
  "65": { lat: -7.9797, lng: 112.6304, city: "Malang / Batu", province: "Jawa Timur" },
  "66": { lat: -7.7543, lng: 113.2159, city: "Probolinggo / Pasuruan", province: "Jawa Timur" },
  "67": { lat: -8.1724, lng: 113.7, city: "Jember / Lumajang", province: "Jawa Timur" },
  "68": { lat: -8.2192, lng: 114.3691, city: "Banyuwangi / Situbondo / Bondowoso", province: "Jawa Timur" },
  "69": { lat: -7.0167, lng: 113.8667, city: "Madura (Bangkalan / Pamekasan / Sumenep)", province: "Jawa Timur" },
  // Kalimantan (70 - 79)
  "70": { lat: -3.3167, lng: 114.59, city: "Banjarmasin / Banjarbaru", province: "Kalimantan Selatan" },
  "71": { lat: -2.8, lng: 115.3, city: "Hulu Sungai / Barabai", province: "Kalimantan Selatan" },
  "72": { lat: -3.5, lng: 116, city: "Kotabaru / Tanah Bumbu", province: "Kalimantan Selatan" },
  "73": { lat: -2.21, lng: 113.9213, city: "Palangka Raya", province: "Kalimantan Tengah" },
  "74": { lat: -2.5, lng: 112, city: "Sampit / Pangkalan Bun", province: "Kalimantan Tengah" },
  "75": { lat: -0.5022, lng: 117.1536, city: "Samarinda / Kutai Kartanegara", province: "Kalimantan Timur" },
  "76": { lat: -1.258, lng: 116.835, city: "Balikpapan / Penajam Paser", province: "Kalimantan Timur" },
  "77": { lat: 3.3276, lng: 117.5925, city: "Tarakan / Tanjung Selor / Nunukan", province: "Kalimantan Utara" },
  "78": { lat: -0.0263, lng: 109.3425, city: "Pontianak / Kubu Raya", province: "Kalimantan Barat" },
  "79": { lat: 0.9083, lng: 108.9872, city: "Singkawang / Sambas / Sintang", province: "Kalimantan Barat" },
  // Bali, NTB, NTT (80 - 87)
  "80": { lat: -8.6705, lng: 115.2126, city: "Denpasar / Badung / Sanur", province: "Bali" },
  "81": { lat: -8.112, lng: 115.0882, city: "Singaraja / Buleleng", province: "Bali" },
  "82": { lat: -8.53, lng: 115.4, city: "Gianyar / Klungkung / Karangasem", province: "Bali" },
  "83": { lat: -8.5833, lng: 116.1167, city: "Mataram / Lombok Barat / Lombok Tengah", province: "Nusa Tenggara Barat" },
  "84": { lat: -8.49, lng: 117.42, city: "Sumbawa Besar / Bima / Dompu", province: "Nusa Tenggara Barat" },
  "85": { lat: -10.1772, lng: 123.607, city: "Kupang", province: "Nusa Tenggara Timur" },
  "86": { lat: -8.5069, lng: 119.8878, city: "Labuan Bajo / Manggarai / Ende / Maumere", province: "Nusa Tenggara Timur" },
  "87": { lat: -9.65, lng: 120.26, city: "Waingapu / Sumba", province: "Nusa Tenggara Timur" },
  // Sulawesi (90 - 96)
  "90": { lat: -5.1477, lng: 119.4327, city: "Makassar / Gowa / Maros", province: "Sulawesi Selatan" },
  "91": { lat: -4.01, lng: 119.62, city: "Parepare / Pinrang / Polewali Mandar", province: "Sulawesi Selatan" },
  "92": { lat: -5.5, lng: 120.2, city: "Bulukumba / Sinjai / Bone", province: "Sulawesi Selatan" },
  "93": { lat: -3.9985, lng: 122.5126, city: "Kendari / Kolaka / Baubau", province: "Sulawesi Tenggara" },
  "94": { lat: -0.9003, lng: 119.8779, city: "Palu / Donggala / Poso / Luwuk", province: "Sulawesi Tengah" },
  "95": { lat: 1.4748, lng: 124.8421, city: "Manado / Bitung / Tomohon / Minahasa", province: "Sulawesi Utara" },
  "96": { lat: 0.5435, lng: 123.0568, city: "Gorontalo", province: "Gorontalo" },
  // Maluku & Papua (97 - 99)
  "97": { lat: -3.6954, lng: 128.1814, city: "Ambon / Tual / Maluku Tengah", province: "Maluku" },
  "98": { lat: 0.79, lng: 127.38, city: "Ternate / Tidore / Halmahera", province: "Maluku Utara" },
  "99": { lat: -2.538, lng: 140.702, city: "Jayapura / Sorong / Manokwari / Merauke / Timika", province: "Papua" }
};
var POSTAL_3DIGIT_MAP = {
  // Aceh (231 - 246)
  "231": { lat: 5.553, lng: 95.322, city: "Banda Aceh", province: "Aceh" },
  "232": { lat: 5.38, lng: 95.52, city: "Aceh Besar / Aceh Jaya", province: "Aceh" },
  "233": { lat: 5.38, lng: 95.96, city: "Pidie / Pidie Jaya", province: "Aceh" },
  "234": { lat: 5.89, lng: 95.32, city: "Sabang", province: "Aceh" },
  "235": { lat: 5.38, lng: 95.52, city: "Aceh Besar", province: "Aceh" },
  "236": { lat: 4.14, lng: 96.13, city: "Aceh Barat / Nagan Raya", province: "Aceh" },
  "237": { lat: 3.25, lng: 97.18, city: "Aceh Selatan / Aceh Barat Daya", province: "Aceh" },
  "238": { lat: 2.64, lng: 98, city: "Subulussalam / Aceh Singkil / Simeulue", province: "Aceh" },
  "241": { lat: 4.63, lng: 96.84, city: "Aceh Tengah / Bener Meriah", province: "Aceh" },
  "242": { lat: 3.96, lng: 97.35, city: "Gayo Lues", province: "Aceh" },
  "243": { lat: 5.18, lng: 97.14, city: "Lhokseumawe / Bireuen / Aceh Utara", province: "Aceh" },
  "244": { lat: 4.47, lng: 97.97, city: "Langsa / Aceh Timur", province: "Aceh" },
  "245": { lat: 4.26, lng: 98.05, city: "Aceh Tamiang", province: "Aceh" },
  "246": { lat: 3.48, lng: 97.8, city: "Aceh Tenggara", province: "Aceh" },
  // Sumatera Utara (201 - 229)
  "201": { lat: 3.5952, lng: 98.6722, city: "Medan Kota", province: "Sumatera Utara" },
  "202": { lat: 3.58, lng: 98.68, city: "Medan Timur / Medan Barat", province: "Sumatera Utara" },
  "203": { lat: 3.55, lng: 98.85, city: "Deli Serdang / Lubuk Pakam", province: "Sumatera Utara" },
  "204": { lat: 3.57, lng: 98.65, city: "Medan Amplas / Medan Johor", province: "Sumatera Utara" },
  "205": { lat: 3.55, lng: 98.85, city: "Deli Serdang", province: "Sumatera Utara" },
  "206": { lat: 3.32, lng: 99.16, city: "Tebing Tinggi / Serdang Bedagai", province: "Sumatera Utara" },
  "207": { lat: 3.6, lng: 98.48, city: "Binjai / Langkat", province: "Sumatera Utara" },
  "208": { lat: 3.8, lng: 98.4, city: "Langkat / Stabat", province: "Sumatera Utara" },
  "209": { lat: 3.2, lng: 98.5, city: "Karo / Berastagi / Kabanjahe", province: "Sumatera Utara" },
  "211": { lat: 2.96, lng: 99.06, city: "Pematangsiantar / Simalungun", province: "Sumatera Utara" },
  "212": { lat: 3.25, lng: 99.2, city: "Asahan / Kisaran", province: "Sumatera Utara" },
  "213": { lat: 3.16, lng: 99.55, city: "Batubara / Tanjung Balai", province: "Sumatera Utara" },
  "214": { lat: 2.8, lng: 99.4, city: "Labuhanbatu / Rantauprapat", province: "Sumatera Utara" },
  "221": { lat: 2.3, lng: 99.07, city: "Toba / Samosir / Tarutung", province: "Sumatera Utara" },
  "222": { lat: 2.7485, lng: 98.3125, city: "Dairi / Sidikalang / Pakpak Bharat", province: "Sumatera Utara" },
  "223": { lat: 2.6074, lng: 98.7092, city: "Samosir / Pangururan / Toba", province: "Sumatera Utara" },
  // BENCHMARK GOOGLE MAPS FOR SAMOSIR & PANGURURAN!
  "224": { lat: 1.742, lng: 98.788, city: "Sibolga / Tapanuli Tengah", province: "Sumatera Utara" },
  "225": { lat: 1.742, lng: 98.788, city: "Sibolga", province: "Sumatera Utara" },
  "227": { lat: 1.37, lng: 99.27, city: "Padangsidimpuan / Tapanuli Selatan", province: "Sumatera Utara" },
  "228": { lat: 1, lng: 97.6, city: "Nias / Gunungsitoli", province: "Sumatera Utara" },
  "229": { lat: 1.2, lng: 99.6, city: "Padang Lawas / Mandailing Natal", province: "Sumatera Utara" },
  // Sumatera Barat (251 - 277)
  "251": { lat: -0.9478, lng: 100.3685, city: "Padang (Kota)", province: "Sumatera Barat" },
  "252": { lat: -0.92, lng: 100.38, city: "Padang Utara / Kuranji", province: "Sumatera Barat" },
  "253": { lat: -0.835, lng: 100.365, city: "Padang Koto Tangah", province: "Sumatera Barat" },
  "255": { lat: -0.63, lng: 100.27, city: "Pariaman / Padang Pariaman", province: "Sumatera Barat" },
  "256": { lat: -1.3, lng: 100.57, city: "Pesisir Selatan / Painan", province: "Sumatera Barat" },
  "261": { lat: -0.3056, lng: 100.3692, city: "Bukittinggi", province: "Sumatera Barat" },
  "262": { lat: -0.25, lng: 100.15, city: "Agam / Lubuk Basung", province: "Sumatera Barat" },
  "263": { lat: -0.05, lng: 100.05, city: "Pasaman / Lubuk Sikaping", province: "Sumatera Barat" },
  "264": { lat: 0.15, lng: 99.8, city: "Pasaman Barat / Simpang Empat", province: "Sumatera Barat" },
  "271": { lat: -0.7983, lng: 100.654, city: "Solok (Kota)", province: "Sumatera Barat" },
  "273": { lat: -0.95, lng: 100.75, city: "Kab. Solok / Alahan Panjang", province: "Sumatera Barat" },
  "274": { lat: -0.22, lng: 100.63, city: "Payakumbuh / Limapuluh Kota", province: "Sumatera Barat" },
  "275": { lat: -0.98, lng: 101.3, city: "Sijunjung / Muaro Sijunjung / Dharmasraya", province: "Sumatera Barat" },
  "276": { lat: -0.46, lng: 100.57, city: "Tanah Datar / Batusangkar / Padang Panjang", province: "Sumatera Barat" },
  "277": { lat: -1.5658, lng: 101.2568, city: "Padang Aro / Kab. Solok Selatan (Sangir)", province: "Sumatera Barat" },
  // BENCHMARK GOOGLE MAPS FOR PADANG ARO!
  // Situbondo / Jawa Timur (683)
  "683": { lat: -7.706, lng: 114.005, city: "Situbondo / Besuki / Asembagus", province: "Jawa Timur" }
};
var EXACT_POSTAL_MAP = {
  // Pangururan & Samosir (22390 - 22398) - Benchmarked to Pulau Samosir
  "22390": { lat: 2.6074, lng: 98.7092, city: "Pangururan / Kab. Samosir", province: "Sumatera Utara" },
  "22391": { lat: 2.6074, lng: 98.7092, city: "Pangururan (Pardomuan I) / Kab. Samosir", province: "Sumatera Utara" },
  "22392": { lat: 2.68, lng: 98.75, city: "Simanindo / Kab. Samosir", province: "Sumatera Utara" },
  "22393": { lat: 2.53, lng: 98.88, city: "Onan Runggu / Kab. Samosir", province: "Sumatera Utara" },
  "22394": { lat: 2.45, lng: 98.88, city: "Nainggolan / Kab. Samosir", province: "Sumatera Utara" },
  "22395": { lat: 2.5, lng: 98.72, city: "Palipi / Kab. Samosir", province: "Sumatera Utara" },
  "22396": { lat: 2.62, lng: 98.78, city: "Ronggur Nihuta / Kab. Samosir", province: "Sumatera Utara" },
  "22397": { lat: 2.4, lng: 98.67, city: "Sitio-tio / Kab. Samosir", province: "Sumatera Utara" },
  "22398": { lat: 2.58, lng: 98.65, city: "Sianjur Mula Mula / Kab. Samosir", province: "Sumatera Utara" },
  // Padang Aro & Solok Selatan (27778, 27779, 27777) - Benchmarked to Sangir / Solok Selatan
  "27778": { lat: -1.5658, lng: 101.2568, city: "Padang Aro / Kab. Solok Selatan (Sangir)", province: "Sumatera Barat" },
  "27779": { lat: -1.58, lng: 101.24, city: "Sangir Jujuan / Kab. Solok Selatan", province: "Sumatera Barat" },
  "27777": { lat: -1.54, lng: 101.27, city: "Sangir Balai Janggo / Kab. Solok Selatan", province: "Sumatera Barat" },
  // Sidikalang & Dairi (22211 - 22214)
  "22211": { lat: 2.7485, lng: 98.3125, city: "Sidikalang Kota / Kab. Dairi", province: "Sumatera Utara" },
  "22212": { lat: 2.7485, lng: 98.3125, city: "Batang Beruh / Sidikalang", province: "Sumatera Utara" },
  "22214": { lat: 2.74, lng: 98.32, city: "Kuta Gambir / Sidikalang", province: "Sumatera Utara" },
  // Sibolga & Tapanuli Tengah (22411 - 22414, 22611)
  "22411": { lat: 1.742, lng: 98.788, city: "Sibolga Kota", province: "Sumatera Utara" },
  "22412": { lat: 1.745, lng: 98.785, city: "Sibolga Utara", province: "Sumatera Utara" },
  "22413": { lat: 1.738, lng: 98.785, city: "Sibolga Selatan", province: "Sumatera Utara" },
  "22414": { lat: 1.74, lng: 98.79, city: "Sibolga Sambas", province: "Sumatera Utara" },
  "22611": { lat: 1.685, lng: 98.835, city: "Pandan / Kab. Tapanuli Tengah", province: "Sumatera Utara" },
  // Tarutung & Tapanuli Utara (22452)
  "22452": { lat: 2.0235, lng: 98.9667, city: "Tarutung / Kab. Tapanuli Utara", province: "Sumatera Utara" },
  // Balige & Toba (22311 - 22316)
  "22311": { lat: 2.3333, lng: 99.0667, city: "Balige / Kab. Toba", province: "Sumatera Utara" },
  "22312": { lat: 2.33, lng: 99.07, city: "Balige Kota / Kab. Toba", province: "Sumatera Utara" }
};
var ACEH_LOCATION_KEYWORDS = [
  "banda aceh",
  "aceh besar",
  "aceh utara",
  "aceh timur",
  "aceh barat",
  "aceh selatan",
  "aceh tengah",
  "aceh tenggara",
  "lhokseumawe",
  "langsa",
  "sabang",
  "subulussalam",
  "pidie",
  "bireuen",
  "bener meriah",
  "gayo lues",
  "aceh singkil",
  "simeulue",
  "aceh tamiang",
  "nagan raya",
  "aceh jaya",
  "aceh barat daya"
];
var DATI2_MAP = {
  // Jabodetabek
  "JAKARTA PUSAT": { lat: -6.1818, lng: 106.834, province: "DKI Jakarta" },
  "JAKARTA SELATAN": { lat: -6.2615, lng: 106.8106, province: "DKI Jakarta" },
  "JAKARTA BARAT": { lat: -6.1683, lng: 106.7588, province: "DKI Jakarta" },
  "JAKARTA TIMUR": { lat: -6.225, lng: 106.9004, province: "DKI Jakarta" },
  "JAKARTA UTARA": { lat: -6.1384, lng: 106.864, province: "DKI Jakarta" },
  "KOTA BOGOR": { lat: -6.5971, lng: 106.806, province: "Jawa Barat" },
  "KAB. BOGOR": { lat: -6.55, lng: 106.88, province: "Jawa Barat" },
  "KOTA DEPOK": { lat: -6.4025, lng: 106.7942, province: "Jawa Barat" },
  "KOTA TANGERANG": { lat: -6.1783, lng: 106.6319, province: "Banten" },
  "KOTA TANGERANG SELATAN": { lat: -6.2936, lng: 106.7099, province: "Banten" },
  "KAB. TANGERANG": { lat: -6.19, lng: 106.5, province: "Banten" },
  "KOTA BEKASI": { lat: -6.2383, lng: 106.9756, province: "Jawa Barat" },
  "KAB. BEKASI": { lat: -6.28, lng: 107.15, province: "Jawa Barat" },
  // Jawa Barat
  "KOTA BANDUNG": { lat: -6.9175, lng: 107.6191, province: "Jawa Barat" },
  "KAB. BANDUNG": { lat: -7.0252, lng: 107.5197, province: "Jawa Barat" },
  "KAB. BANDUNG BARAT": { lat: -6.85, lng: 107.45, province: "Jawa Barat" },
  "KOTA CIMAHI": { lat: -6.8722, lng: 107.5432, province: "Jawa Barat" },
  "KOTA CIREBON": { lat: -6.732, lng: 108.5523, province: "Jawa Barat" },
  "KAB. CIREBON": { lat: -6.76, lng: 108.48, province: "Jawa Barat" },
  "KOTA TASIKMALAYA": { lat: -7.3274, lng: 108.2207, province: "Jawa Barat" },
  "KAB. TASIKMALAYA": { lat: -7.45, lng: 108.15, province: "Jawa Barat" },
  "KOTA SUKABUMI": { lat: -6.9277, lng: 106.93, province: "Jawa Barat" },
  "KAB. SUKABUMI": { lat: -7, lng: 106.7, province: "Jawa Barat" },
  "KAB. KARAWANG": { lat: -6.305, lng: 107.3, province: "Jawa Barat" },
  "KAB. PURWAKARTA": { lat: -6.55, lng: 107.44, province: "Jawa Barat" },
  "KAB. SUBANG": { lat: -6.57, lng: 107.76, province: "Jawa Barat" },
  "KAB. INDRAMAYU": { lat: -6.33, lng: 108.32, province: "Jawa Barat" },
  "KAB. MAJALENGKA": { lat: -6.83, lng: 108.23, province: "Jawa Barat" },
  "KAB. KUNINGAN": { lat: -6.98, lng: 108.48, province: "Jawa Barat" },
  "KAB. SUMEDANG": { lat: -6.86, lng: 107.92, province: "Jawa Barat" },
  "KAB. GARUT": { lat: -7.2278, lng: 107.9087, province: "Jawa Barat" },
  "KAB. CIANJUR": { lat: -6.82, lng: 107.14, province: "Jawa Barat" },
  "KAB. CIAMIS": { lat: -7.33, lng: 108.35, province: "Jawa Barat" },
  "KOTA BANJAR": { lat: -7.37, lng: 108.53, province: "Jawa Barat" },
  // Banten
  "KOTA SERANG": { lat: -6.12, lng: 106.1503, province: "Banten" },
  "KAB. SERANG": { lat: -6.15, lng: 106, province: "Banten" },
  "KOTA CILEGON": { lat: -6.0174, lng: 106.0538, province: "Banten" },
  "KAB. PANDEGLANG": { lat: -6.31, lng: 106.1, province: "Banten" },
  "KAB. LEBAK": { lat: -6.55, lng: 106.25, province: "Banten" },
  // Jawa Tengah & DIY
  "KOTA SEMARANG": { lat: -6.9667, lng: 110.4167, province: "Jawa Tengah" },
  "KAB. SEMARANG": { lat: -7.15, lng: 110.43, province: "Jawa Tengah" },
  "KOTA SURAKARTA": { lat: -7.5755, lng: 110.8243, province: "Jawa Tengah" },
  "KOTA YOGYAKARTA": { lat: -7.7956, lng: 110.3695, province: "D.I. Yogyakarta" },
  "KAB. SLEMAN": { lat: -7.7167, lng: 110.3556, province: "D.I. Yogyakarta" },
  "KAB. BANTUL": { lat: -7.89, lng: 110.33, province: "D.I. Yogyakarta" },
  "KAB. KULON PROGO": { lat: -7.77, lng: 110.16, province: "D.I. Yogyakarta" },
  "KAB. GUNUNGKIDUL": { lat: -7.96, lng: 110.6, province: "D.I. Yogyakarta" },
  "KOTA PEKALONGAN": { lat: -6.8886, lng: 109.6753, province: "Jawa Tengah" },
  "KOTA TEGAL": { lat: -6.8694, lng: 109.1402, province: "Jawa Tengah" },
  "KOTA SALATIGA": { lat: -7.3305, lng: 110.5084, province: "Jawa Tengah" },
  "KOTA MAGELANG": { lat: -7.4706, lng: 110.2178, province: "Jawa Tengah" },
  "KAB. BANYUMAS": { lat: -7.4244, lng: 109.2302, province: "Jawa Tengah" },
  "KAB. CILACAP": { lat: -7.7279, lng: 109.0076, province: "Jawa Tengah" },
  "KAB. KUDUS": { lat: -6.8048, lng: 110.8405, province: "Jawa Tengah" },
  "KAB. PATI": { lat: -6.75, lng: 111.03, province: "Jawa Tengah" },
  "KAB. JEPARA": { lat: -6.59, lng: 110.67, province: "Jawa Tengah" },
  "KAB. KLATEN": { lat: -7.7, lng: 110.6, province: "Jawa Tengah" },
  "KAB. SUKOHARJO": { lat: -7.68, lng: 110.83, province: "Jawa Tengah" },
  "KAB. KARANGANYAR": { lat: -7.59, lng: 110.95, province: "Jawa Tengah" },
  "KAB. BOYOLALI": { lat: -7.53, lng: 110.59, province: "Jawa Tengah" },
  "KAB. SRAGEN": { lat: -7.42, lng: 111.02, province: "Jawa Tengah" },
  "KAB. WONOGIRI": { lat: -7.81, lng: 110.92, province: "Jawa Tengah" },
  "KAB. KENDAL": { lat: -6.92, lng: 110.2, province: "Jawa Tengah" },
  "KAB. BATANG": { lat: -6.91, lng: 109.73, province: "Jawa Tengah" },
  "KAB. PEMALANG": { lat: -6.89, lng: 109.38, province: "Jawa Tengah" },
  "KAB. BREBES": { lat: -6.87, lng: 109.04, province: "Jawa Tengah" },
  "KAB. PURBALINGGA": { lat: -7.38, lng: 109.36, province: "Jawa Tengah" },
  "KAB. BANJARNEGARA": { lat: -7.39, lng: 109.7, province: "Jawa Tengah" },
  "KAB. KEBUMEN": { lat: -7.675, lng: 109.65, province: "Jawa Tengah" },
  "KAB. PURWOREJO": { lat: -7.71, lng: 110.01, province: "Jawa Tengah" },
  "KAB. TEMANGGUNG": { lat: -7.31, lng: 110.17, province: "Jawa Tengah" },
  "KAB. WONOSOBO": { lat: -7.36, lng: 109.9, province: "Jawa Tengah" },
  "KAB. BLORA": { lat: -7, lng: 111.41, province: "Jawa Tengah" },
  "KAB. REMBANG": { lat: -6.71, lng: 111.34, province: "Jawa Tengah" },
  "KAB. GROBOGAN": { lat: -7.02, lng: 110.91, province: "Jawa Tengah" },
  // Jawa Timur
  "KOTA SURABAYA": { lat: -7.2575, lng: 112.7521, province: "Jawa Timur" },
  "KOTA MALANG": { lat: -7.9797, lng: 112.6304, province: "Jawa Timur" },
  "KOTA BATU": { lat: -7.87, lng: 112.52, province: "Jawa Timur" },
  "KAB. SIDOARJO": { lat: -7.453, lng: 112.718, province: "Jawa Timur" },
  "KAB. GRESIK": { lat: -7.1566, lng: 112.6555, province: "Jawa Timur" },
  "KOTA MOJOKERTO": { lat: -7.4722, lng: 112.4381, province: "Jawa Timur" },
  "KAB. MOJOKERTO": { lat: -7.55, lng: 112.45, province: "Jawa Timur" },
  "KOTA PASURUAN": { lat: -7.6469, lng: 112.9075, province: "Jawa Timur" },
  "KAB. PASURUAN": { lat: -7.65, lng: 112.75, province: "Jawa Timur" },
  "KOTA PROBOLINGGO": { lat: -7.7543, lng: 113.2159, province: "Jawa Timur" },
  "KAB. PROBOLINGGO": { lat: -7.8, lng: 113.25, province: "Jawa Timur" },
  "KOTA KEDIRI": { lat: -7.8167, lng: 112.0167, province: "Jawa Timur" },
  "KAB. KEDIRI": { lat: -7.85, lng: 112.15, province: "Jawa Timur" },
  "KOTA BLITAR": { lat: -8.0983, lng: 112.1681, province: "Jawa Timur" },
  "KAB. BLITAR": { lat: -8.15, lng: 112.2, province: "Jawa Timur" },
  "KOTA MADIUN": { lat: -7.6298, lng: 111.5239, province: "Jawa Timur" },
  "KAB. MADIUN": { lat: -7.55, lng: 111.65, province: "Jawa Timur" },
  "KAB. JEMBER": { lat: -8.1724, lng: 113.7, province: "Jawa Timur" },
  "KAB. BANYUWANGI": { lat: -8.2192, lng: 114.3691, province: "Jawa Timur" },
  "KAB. LUMAJANG": { lat: -8.13, lng: 113.22, province: "Jawa Timur" },
  "KAB. BONDOWOSO": { lat: -7.91, lng: 113.82, province: "Jawa Timur" },
  "KAB. SITUBONDO": { lat: -7.7, lng: 114, province: "Jawa Timur" },
  "KAB. BOJONEGORO": { lat: -7.15, lng: 111.88, province: "Jawa Timur" },
  "KAB. TUBAN": { lat: -6.89, lng: 112.06, province: "Jawa Timur" },
  "KAB. LAMONGAN": { lat: -7.12, lng: 112.41, province: "Jawa Timur" },
  "KAB. TULUNGAGUNG": { lat: -8.06, lng: 111.9, province: "Jawa Timur" },
  "KAB. TRENGGALEK": { lat: -8.05, lng: 111.71, province: "Jawa Timur" },
  "KAB. NGANJUK": { lat: -7.6, lng: 111.9, province: "Jawa Timur" },
  "KAB. MAGETAN": { lat: -7.65, lng: 111.32, province: "Jawa Timur" },
  "KAB. NGAWI": { lat: -7.4, lng: 111.45, province: "Jawa Timur" },
  "KAB. PACITAN": { lat: -8.2, lng: 111.09, province: "Jawa Timur" },
  "KAB. PONOROGO": { lat: -7.86, lng: 111.46, province: "Jawa Timur" },
  "KAB. BANGKALAN": { lat: -7.03, lng: 112.75, province: "Jawa Timur" },
  "KAB. SAMPANG": { lat: -7.18, lng: 113.24, province: "Jawa Timur" },
  "KAB. PAMEKASAN": { lat: -7.16, lng: 113.48, province: "Jawa Timur" },
  "KAB. SUMENEP": { lat: -7.0167, lng: 113.8667, province: "Jawa Timur" },
  // Sumatera
  "KOTA MEDAN": { lat: 3.5952, lng: 98.6722, province: "Sumatera Utara" },
  "KOTA BINJAI": { lat: 3.6, lng: 98.48, province: "Sumatera Utara" },
  "KOTA PEMATANGSIANTAR": { lat: 2.96, lng: 99.06, province: "Sumatera Utara" },
  "KOTA TEBING TINGGI": { lat: 3.32, lng: 99.16, province: "Sumatera Utara" },
  "KAB. DELI SERDANG": { lat: 3.55, lng: 98.85, province: "Sumatera Utara" },
  // Aceh (Wilayah 01 / Dilayani Cabang KIM)
  "KOTA BANDA ACEH": { lat: 5.553, lng: 95.322, province: "Aceh" },
  "KAB. ACEH BESAR": { lat: 5.38, lng: 95.52, province: "Aceh" },
  "KOTA SABANG": { lat: 5.89, lng: 95.32, province: "Aceh" },
  "KAB. PIDIE": { lat: 5.38, lng: 95.96, province: "Aceh" },
  "KAB. PIDIE JAYA": { lat: 5.25, lng: 96.2, province: "Aceh" },
  "KAB. BIREUEN": { lat: 5.2, lng: 96.7, province: "Aceh" },
  "KOTA LHOKSEUMAWE": { lat: 5.18, lng: 97.14, province: "Aceh" },
  "KAB. ACEH UTARA": { lat: 5, lng: 97.2, province: "Aceh" },
  "KOTA LANGSA": { lat: 4.47, lng: 97.97, province: "Aceh" },
  "KAB. ACEH TIMUR": { lat: 4.78, lng: 97.64, province: "Aceh" },
  "KAB. ACEH TAMIANG": { lat: 4.26, lng: 98.05, province: "Aceh" },
  "KAB. BENER MERIAH": { lat: 4.73, lng: 96.86, province: "Aceh" },
  "KAB. ACEH TENGAH": { lat: 4.63, lng: 96.84, province: "Aceh" },
  "KAB. GAYO LUES": { lat: 3.96, lng: 97.35, province: "Aceh" },
  "KAB. ACEH TENGGARA": { lat: 3.48, lng: 97.8, province: "Aceh" },
  "KAB. ACEH BARAT": { lat: 4.14, lng: 96.13, province: "Aceh" },
  "KAB. NAGAN RAYA": { lat: 4.16, lng: 96.33, province: "Aceh" },
  "KAB. ACEH JAYA": { lat: 4.64, lng: 95.65, province: "Aceh" },
  "KAB. ACEH BARAT DAYA": { lat: 3.75, lng: 96.84, province: "Aceh" },
  "KAB. ACEH SELATAN": { lat: 3.25, lng: 97.18, province: "Aceh" },
  "KOTA SUBULUSSALAM": { lat: 2.64, lng: 98, province: "Aceh" },
  "KAB. ACEH SINGKIL": { lat: 2.33, lng: 97.8, province: "Aceh" },
  "KAB. SIMEULUE": { lat: 2.48, lng: 96.38, province: "Aceh" },
  "KOTA SIBOLGA": { lat: 1.742, lng: 98.788, province: "Sumatera Utara" },
  "SIBOLGA": { lat: 1.742, lng: 98.788, province: "Sumatera Utara" },
  "KAB. SAMOSIR": { lat: 2.6074, lng: 98.7092, province: "Sumatera Utara" },
  "SAMOSIR": { lat: 2.6074, lng: 98.7092, province: "Sumatera Utara" },
  "KABUPATEN SAMOSIR": { lat: 2.6074, lng: 98.7092, province: "Sumatera Utara" },
  "KAB. DAIRI": { lat: 2.7485, lng: 98.3125, province: "Sumatera Utara" },
  "DAIRI": { lat: 2.7485, lng: 98.3125, province: "Sumatera Utara" },
  "KABUPATEN DAIRI": { lat: 2.7485, lng: 98.3125, province: "Sumatera Utara" },
  "KAB. TAPANULI TENGAH": { lat: 1.7, lng: 98.85, province: "Sumatera Utara" },
  "TAPANULI TENGAH": { lat: 1.7, lng: 98.85, province: "Sumatera Utara" },
  "KABUPATEN TAPANULI TENGAH": { lat: 1.7, lng: 98.85, province: "Sumatera Utara" },
  "KAB. TAPANULI UTARA": { lat: 2.0235, lng: 98.9667, province: "Sumatera Utara" },
  "TAPANULI UTARA": { lat: 2.0235, lng: 98.9667, province: "Sumatera Utara" },
  "KABUPATEN TAPANULI UTARA": { lat: 2.0235, lng: 98.9667, province: "Sumatera Utara" },
  "KAB. TOBA": { lat: 2.3333, lng: 99.0667, province: "Sumatera Utara" },
  "KAB. TOBA SAMOSIR": { lat: 2.3333, lng: 99.0667, province: "Sumatera Utara" },
  "TOBA": { lat: 2.3333, lng: 99.0667, province: "Sumatera Utara" },
  "TOBA SAMOSIR": { lat: 2.3333, lng: 99.0667, province: "Sumatera Utara" },
  "KAB. KARO": { lat: 3.12, lng: 98.5, province: "Sumatera Utara" },
  "KAB. SIMALUNGUN": { lat: 2.96, lng: 99.06, province: "Sumatera Utara" },
  "KAB. TAPANULI SELATAN": { lat: 1.5, lng: 99.25, province: "Sumatera Utara" },
  "KOTA PADANG SIDEMPUAN": { lat: 1.37, lng: 99.27, province: "Sumatera Utara" },
  "KOTA PADANGSIDIMPUAN": { lat: 1.37, lng: 99.27, province: "Sumatera Utara" },
  "KAB. MANDAILING NATAL": { lat: 0.86, lng: 99.56, province: "Sumatera Utara" },
  "KAB. ASAHAN": { lat: 2.98, lng: 99.62, province: "Sumatera Utara" },
  "KAB. BATUBARA": { lat: 3.16, lng: 99.55, province: "Sumatera Utara" },
  "KOTA TANJUNG BALAI": { lat: 2.96, lng: 99.8, province: "Sumatera Utara" },
  "KAB. LABUHANBATU": { lat: 2.1, lng: 99.83, province: "Sumatera Utara" },
  "KAB. LABUHANBATU UTARA": { lat: 2.33, lng: 99.65, province: "Sumatera Utara" },
  "KAB. LABUHANBATU SELATAN": { lat: 1.88, lng: 100.08, province: "Sumatera Utara" },
  "KOTA GUNUNGSITOLI": { lat: 1.28, lng: 97.61, province: "Sumatera Utara" },
  "KAB. NIAS": { lat: 1.15, lng: 97.75, province: "Sumatera Utara" },
  // Sumatera Barat
  "KOTA PADANG": { lat: -0.9478, lng: 100.3685, province: "Sumatera Barat" },
  "KOTA BUKITTINGGI": { lat: -0.3056, lng: 100.3692, province: "Sumatera Barat" },
  "KOTA PARIAMAN": { lat: -0.6264, lng: 100.122, province: "Sumatera Barat" },
  "KOTA SOLOK": { lat: -0.7983, lng: 100.654, province: "Sumatera Barat" },
  "KAB. SOLOK": { lat: -0.95, lng: 100.65, province: "Sumatera Barat" },
  "SOLOK": { lat: -0.95, lng: 100.65, province: "Sumatera Barat" },
  "KAB. PADANG PARIAMAN": { lat: -0.63, lng: 100.27, province: "Sumatera Barat" },
  "KAB. SOLOK SELATAN": { lat: -1.5658, lng: 101.2568, province: "Sumatera Barat" },
  "SOLOK SELATAN": { lat: -1.5658, lng: 101.2568, province: "Sumatera Barat" },
  "KABUPATEN SOLOK SELATAN": { lat: -1.5658, lng: 101.2568, province: "Sumatera Barat" },
  "KOTA PAYAKUMBUH": { lat: -0.2244, lng: 100.6322, province: "Sumatera Barat" },
  "KOTA PADANG PANJANG": { lat: -0.4635, lng: 100.402, province: "Sumatera Barat" },
  "KOTA SAWAHLUNTO": { lat: -0.6811, lng: 100.785, province: "Sumatera Barat" },
  "KAB. AGAM": { lat: -0.25, lng: 100.15, province: "Sumatera Barat" },
  "KAB. PASAMAN": { lat: -0.05, lng: 100.05, province: "Sumatera Barat" },
  "KAB. PASAMAN BARAT": { lat: 0.15, lng: 99.8, province: "Sumatera Barat" },
  "KAB. PESISIR SELATAN": { lat: -1.35, lng: 100.57, province: "Sumatera Barat" },
  "KAB. SIJUNJUNG": { lat: -0.69, lng: 101.3, province: "Sumatera Barat" },
  "KAB. TANAH DATAR": { lat: -0.46, lng: 100.57, province: "Sumatera Barat" },
  "KAB. DHARMASRAYA": { lat: -1.05, lng: 101.53, province: "Sumatera Barat" },
  "KOTA PEKANBARU": { lat: 0.5071, lng: 101.4478, province: "Riau" },
  "KOTA DUMAI": { lat: 1.6667, lng: 101.45, province: "Riau" },
  "KOTA BATAM": { lat: 1.1301, lng: 104.0529, province: "Kepulauan Riau" },
  "KOTA TANJUNG PINANG": { lat: 0.9167, lng: 104.45, province: "Kepulauan Riau" },
  "KOTA PALEMBANG": { lat: -2.9761, lng: 104.7754, province: "Sumatera Selatan" },
  "KOTA PRABUMULIH": { lat: -3.43, lng: 104.23, province: "Sumatera Selatan" },
  "KOTA JAMBI": { lat: -1.6101, lng: 103.6131, province: "Jambi" },
  "KOTA BENGKULU": { lat: -3.7928, lng: 102.268, province: "Bengkulu" },
  "KOTA BANDAR LAMPUNG": { lat: -5.45, lng: 105.2667, province: "Lampung" },
  "KOTA METRO": { lat: -5.1139, lng: 105.3067, province: "Lampung" },
  "KOTA PANGKAL PINANG": { lat: -2.1316, lng: 106.1115, province: "Bangka Belitung" },
  // Bali, NTB, NTT
  "KOTA DENPASAR": { lat: -8.6705, lng: 115.2126, province: "Bali" },
  "KAB. BADUNG": { lat: -8.58, lng: 115.18, province: "Bali" },
  "KAB. GIANYAR": { lat: -8.54, lng: 115.33, province: "Bali" },
  "KAB. TABANAN": { lat: -8.54, lng: 115.12, province: "Bali" },
  "KAB. BULELENG": { lat: -8.112, lng: 115.0882, province: "Bali" },
  "KOTA MATARAM": { lat: -8.5833, lng: 116.1167, province: "Nusa Tenggara Barat" },
  "KOTA BIMA": { lat: -8.46, lng: 118.73, province: "Nusa Tenggara Barat" },
  "KOTA KUPANG": { lat: -10.1772, lng: 123.607, province: "Nusa Tenggara Timur" },
  "KAB. MANGGARAI BARAT": { lat: -8.5069, lng: 119.8878, province: "Nusa Tenggara Timur" },
  // Kalimantan
  "KOTA BANJARMASIN": { lat: -3.3167, lng: 114.59, province: "Kalimantan Selatan" },
  "KOTA BANJARBARU": { lat: -3.44, lng: 114.83, province: "Kalimantan Selatan" },
  "KOTA BALIKPAPAN": { lat: -1.258, lng: 116.835, province: "Kalimantan Timur" },
  "KOTA SAMARINDA": { lat: -0.5022, lng: 117.1536, province: "Kalimantan Timur" },
  "KOTA BONTANG": { lat: 0.1333, lng: 117.5, province: "Kalimantan Timur" },
  "KOTA PONTIANAK": { lat: -0.0263, lng: 109.3425, province: "Kalimantan Barat" },
  "KOTA SINGKAWANG": { lat: 0.9083, lng: 108.9872, province: "Kalimantan Barat" },
  "KOTA PALANGKA RAYA": { lat: -2.21, lng: 113.9213, province: "Kalimantan Tengah" },
  "KOTA TARAKAN": { lat: 3.3276, lng: 117.5925, province: "Kalimantan Utara" },
  // Sulawesi
  "KOTA MAKASSAR": { lat: -5.1477, lng: 119.4327, province: "Sulawesi Selatan" },
  "KOTA PAREPARE": { lat: -4.01, lng: 119.62, province: "Sulawesi Selatan" },
  "KOTA PALOPO": { lat: -2.99, lng: 120.19, province: "Sulawesi Selatan" },
  "KOTA MANADO": { lat: 1.4748, lng: 124.8421, province: "Sulawesi Utara" },
  "KOTA BITUNG": { lat: 1.44, lng: 125.19, province: "Sulawesi Utara" },
  "KOTA TOMOHON": { lat: 1.32, lng: 124.84, province: "Sulawesi Utara" },
  "KOTA PALU": { lat: -0.9003, lng: 119.8779, province: "Sulawesi Tengah" },
  "KOTA KENDARI": { lat: -3.9985, lng: 122.5126, province: "Sulawesi Tenggara" },
  "KOTA BAUBAU": { lat: -5.46, lng: 122.61, province: "Sulawesi Tenggara" },
  "KOTA GORONTALO": { lat: 0.5435, lng: 123.0568, province: "Gorontalo" },
  // Maluku & Papua
  "KOTA AMBON": { lat: -3.6954, lng: 128.1814, province: "Maluku" },
  "KOTA TERNATE": { lat: 0.79, lng: 127.38, province: "Maluku Utara" },
  "KOTA JAYAPURA": { lat: -2.538, lng: 140.702, province: "Papua" },
  "KOTA SORONG": { lat: -0.88, lng: 131.25, province: "Papua Barat Daya" }
};
var WILAYAH_CENTROID_MAP = {
  "W01": { lat: 3.5952, lng: 98.6722, regionName: "Sumatera Bagian Utara (Medan)" },
  "W02": { lat: 0.5071, lng: 101.4478, regionName: "Riau & Kepri (Padang / Pekanbaru)" },
  "W03": { lat: -2.9761, lng: 104.7754, regionName: "Sumatera Bagian Selatan (Palembang)" },
  "W04": { lat: -6.9175, lng: 107.6191, regionName: "Jawa Barat (Bandung)" },
  "W05": { lat: -6.9667, lng: 110.4167, regionName: "Jawa Tengah & DIY (Semarang)" },
  "W06": { lat: -7.2575, lng: 112.7521, regionName: "Jawa Timur (Surabaya)" },
  "W07": { lat: -5.1477, lng: 119.4327, regionName: "Sulawesi Selatan & Tenggara (Makassar)" },
  "W08": { lat: -8.6705, lng: 115.2126, regionName: "Bali, NTB & NTT (Denpasar)" },
  "W09": { lat: -3.3167, lng: 114.59, regionName: "Kalimantan (Banjarmasin)" },
  "W10": { lat: -6.1818, lng: 106.834, regionName: "DKI Jakarta (Senayan / Jakarta)" },
  "W11": { lat: 1.4748, lng: 124.8421, regionName: "Sulawesi Utara & Maluku (Manado)" },
  "W12": { lat: -6.2383, lng: 106.9756, regionName: "Jakarta Kota / Bekasi" },
  "W14": { lat: -6.2088, lng: 106.6381, regionName: "Jakarta Barat / Tangerang" },
  "W15": { lat: -6.2615, lng: 106.8106, regionName: "Jakarta Selatan" },
  "W16": { lat: -2.538, lng: 140.702, regionName: "Papua (Jayapura)" },
  "W17": { lat: -7.7956, lng: 110.3695, regionName: "Yogyakarta" },
  "W18": { lat: -7.9797, lng: 112.6304, regionName: "Malang" }
};
function cleanDati2(raw) {
  if (!raw) return "";
  return String(raw).toUpperCase().replace(/^KOTA\s+ADM\.?\s*/i, "KOTA ").replace(/^KABUPATEN\s+/i, "KAB. ").trim();
}
var KECAMATAN_PADANG_MAP = {
  "PADANG BARAT": { lat: -0.945, lng: 100.3595 },
  "PADANG TIMUR": { lat: -0.9452, lng: 100.378 },
  "PADANG UTARA": { lat: -0.915, lng: 100.362 },
  "PADANG SELATAN": { lat: -0.965, lng: 100.37 },
  "KURANJI": { lat: -0.925, lng: 100.405 },
  "NANGGALO": { lat: -0.908, lng: 100.375 },
  "LUBUK BEGALUNG": { lat: -0.978, lng: 100.395 },
  "LUBUK KILANGAN": { lat: -0.965, lng: 100.44 },
  "PAUH": { lat: -0.925, lng: 100.445 },
  "KOTO TANGAH": { lat: -0.835, lng: 100.365 },
  "BUNGUS TELUK KABUNG": { lat: -1.045, lng: 100.4 }
};
function extractWCode(raw) {
  if (!raw) return "";
  const match = raw.match(/(?:W(?:ILAYAH)?\s*|W)(\d{1,2})/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return `W${num < 10 ? "0" + num : num}`;
  }
  const pureNum = parseInt(raw, 10);
  if (!isNaN(pureNum) && pureNum >= 1 && pureNum <= 18) {
    return `W${pureNum < 10 ? "0" + pureNum : pureNum}`;
  }
  return "";
}
function clampToInland(lat, lng) {
  let cLat = lat;
  let cLng = lng;
  if (cLat >= -2.57 && cLat <= -2.51 && cLng > 140.7035) {
    cLng = 140.7015;
  }
  if (cLat >= -2.61 && cLat < -2.57 && cLng > 140.697) {
    cLng = 140.692;
  }
  if (cLat >= -1.15 && cLat <= -0.75 && cLng < 100.3595) {
    cLng = 100.3605;
  }
  if (cLat > -6.958 && cLng >= 110.35 && cLng <= 110.48) {
    cLat = -6.968;
  }
  if (cLat > -7.198 && cLng >= 112.65 && cLng <= 112.8) {
    cLat = -7.215;
  }
  if (cLng > 112.795 && cLat >= -7.33 && cLat <= -7.18) {
    cLng = 112.785;
  }
  if (cLat < -1.26 && cLng >= 116.8 && cLng <= 116.92) {
    cLat = -1.255;
  }
  if (cLng > 116.885 && cLat >= -1.27 && cLat <= -1.15) {
    cLng = 116.875;
  }
  if (cLng < 119.408 && cLat >= -5.2 && cLat <= -5.08) {
    cLng = 119.418;
  }
  if (cLat > 5.575 && cLat < 5.8 && cLng >= 95.25 && cLng <= 95.38) {
    cLat = 5.56;
  }
  if (cLng < 124.834 && cLat >= 1.44 && cLat <= 1.52) {
    cLng = 124.842;
  }
  if (cLat > -10.158 && cLng >= 123.55 && cLng <= 123.65) {
    cLat = -10.17;
  }
  if (cLng < 98.78 && cLat >= 1.7 && cLat <= 1.78) {
    cLng = 98.788;
  }
  if (cLng < 102.26 && cLat >= -3.85 && cLat <= -3.75) {
    cLng = 102.27;
  }
  return [Number(cLat.toFixed(6)), Number(cLng.toFixed(6))];
}
var CITY_DISTRICTS_MAP = {
  // Jayapura (Papua) - Strictly on real town / commercial districts on land
  "JAYAPURA UTARA": { lat: -2.533, lng: 140.702, city: "Jayapura", province: "Papua" },
  "GURABESI": { lat: -2.535, lng: 140.702, city: "Jayapura", province: "Papua" },
  "MANDALA": { lat: -2.534, lng: 140.7025, city: "Jayapura", province: "Papua" },
  "DOK": { lat: -2.525, lng: 140.702, city: "Jayapura", province: "Papua" },
  "JAYAPURA SELATAN": { lat: -2.56, lng: 140.688, city: "Jayapura", province: "Papua" },
  "ARGAPURA": { lat: -2.5515, lng: 140.7015, city: "Jayapura", province: "Papua" },
  "KOTI": { lat: -2.545, lng: 140.7015, city: "Jayapura", province: "Papua" },
  "WEREF": { lat: -2.542, lng: 140.7015, city: "Jayapura", province: "Papua" },
  "POLIMAK": { lat: -2.545, lng: 140.692, city: "Jayapura", province: "Papua" },
  "ENTROP": { lat: -2.568, lng: 140.685, city: "Jayapura", province: "Papua" },
  "HAMADI": { lat: -2.558, lng: 140.694, city: "Jayapura", province: "Papua" },
  "ABEPURA": { lat: -2.601, lng: 140.672, city: "Jayapura", province: "Papua" },
  "KOTARAJA": { lat: -2.595, lng: 140.675, city: "Jayapura", province: "Papua" },
  "VIM": { lat: -2.604, lng: 140.668, city: "Jayapura", province: "Papua" },
  "WAENA": { lat: -2.585, lng: 140.625, city: "Jayapura", province: "Papua" },
  "HERAM": { lat: -2.585, lng: 140.625, city: "Jayapura", province: "Papua" },
  "SENTANI": { lat: -2.56, lng: 140.515, city: "Jayapura", province: "Papua" },
  "MUARA TAMI": { lat: -2.635, lng: 140.825, city: "Jayapura", province: "Papua" },
  "JAYAPURA": { lat: -2.538, lng: 140.702, city: "Jayapura", province: "Papua" },
  // Surabaya (Jawa Timur)
  "GENTENG": { lat: -7.26, lng: 112.745, city: "Surabaya", province: "Jawa Timur" },
  "TEGALSARI": { lat: -7.27, lng: 112.738, city: "Surabaya", province: "Jawa Timur" },
  "GUBENG": { lat: -7.275, lng: 112.755, city: "Surabaya", province: "Jawa Timur" },
  "WONOKROMO": { lat: -7.3, lng: 112.735, city: "Surabaya", province: "Jawa Timur" },
  "RUNGKUT": { lat: -7.32, lng: 112.77, city: "Surabaya", province: "Jawa Timur" },
  "TANDES": { lat: -7.26, lng: 112.68, city: "Surabaya", province: "Jawa Timur" },
  // Semarang (Jawa Tengah)
  "SEMARANG TENGAH": { lat: -6.98, lng: 110.42, city: "Semarang", province: "Jawa Tengah" },
  "SEMARANG SELATAN": { lat: -7, lng: 110.425, city: "Semarang", province: "Jawa Tengah" },
  "SEMARANG BARAT": { lat: -6.99, lng: 110.39, city: "Semarang", province: "Jawa Tengah" },
  "BANYUMANIK": { lat: -7.06, lng: 110.42, city: "Semarang", province: "Jawa Tengah" },
  "CANDISARI": { lat: -7.015, lng: 110.425, city: "Semarang", province: "Jawa Tengah" },
  // Makassar (Sulawesi Selatan)
  "PANAKKUKANG": { lat: -5.145, lng: 119.45, city: "Makassar", province: "Sulawesi Selatan" },
  "RAPPOCINI": { lat: -5.165, lng: 119.44, city: "Makassar", province: "Sulawesi Selatan" },
  "TAMALANREA": { lat: -5.135, lng: 119.49, city: "Makassar", province: "Sulawesi Selatan" },
  "UJUNG PANDANG": { lat: -5.135, lng: 119.412, city: "Makassar", province: "Sulawesi Selatan" },
  // Medan (Sumatera Utara)
  "MEDAN KOTA": { lat: 3.578, lng: 98.685, city: "Medan", province: "Sumatera Utara" },
  "MEDAN BARU": { lat: 3.57, lng: 98.655, city: "Medan", province: "Sumatera Utara" },
  "MEDAN PETISAH": { lat: 3.59, lng: 98.665, city: "Medan", province: "Sumatera Utara" },
  "MEDAN BARAT": { lat: 3.605, lng: 98.67, city: "Medan", province: "Sumatera Utara" },
  "MEDAN DELI": { lat: 3.655, lng: 98.68, city: "Medan", province: "Sumatera Utara" },
  // Balikpapan (Kalimantan Timur)
  "BALIKPAPAN KOTA": { lat: -1.26, lng: 116.835, city: "Balikpapan", province: "Kalimantan Timur" },
  "BALIKPAPAN SELATAN": { lat: -1.25, lng: 116.865, city: "Balikpapan", province: "Kalimantan Timur" },
  "BALIKPAPAN UTARA": { lat: -1.21, lng: 116.86, city: "Balikpapan", province: "Kalimantan Timur" },
  // Manado (Sulawesi Utara)
  "WENANG": { lat: 1.485, lng: 124.845, city: "Manado", province: "Sulawesi Utara" },
  "WANEA": { lat: 1.465, lng: 124.845, city: "Manado", province: "Sulawesi Utara" },
  "MALALAYANG": { lat: 1.455, lng: 124.838, city: "Manado", province: "Sulawesi Utara" },
  // Situbondo & Sekitarnya (Jawa Timur - Benchmarked from Google Maps / OSM)
  "BESUKI": { lat: -7.7343, lng: 113.6902, city: "Situbondo", province: "Jawa Timur" },
  "ASEMBAGUS": { lat: -7.7491, lng: 114.2181, city: "Situbondo", province: "Jawa Timur" },
  "SITUBONDO": { lat: -7.706, lng: 114.005, city: "Situbondo", province: "Jawa Timur" },
  "PANJI": { lat: -7.712, lng: 114.02, city: "Situbondo", province: "Jawa Timur" },
  "KAPONGAN": { lat: -7.718, lng: 114.09, city: "Situbondo", province: "Jawa Timur" },
  "BANYUGLUGUR": { lat: -7.73, lng: 113.6, city: "Situbondo", province: "Jawa Timur" },
  "SUBOH": { lat: -7.745, lng: 113.72, city: "Situbondo", province: "Jawa Timur" },
  "MANGARAN": { lat: -7.685, lng: 114.035, city: "Situbondo", province: "Jawa Timur" },
  "JANGKAR": { lat: -7.72, lng: 114.18, city: "Situbondo", province: "Jawa Timur" },
  // Banda Aceh (Aceh)
  "BAITURRAHMAN": { lat: 5.5455, lng: 95.3191, city: "Banda Aceh", province: "Aceh" },
  "KUTA ALAM": { lat: 5.56, lng: 95.335, city: "Banda Aceh", province: "Aceh" },
  "SYIAH KUALA": { lat: 5.57, lng: 95.35, city: "Banda Aceh", province: "Aceh" },
  "ULEE KARENG": { lat: 5.545, lng: 95.355, city: "Banda Aceh", province: "Aceh" },
  // Solok Selatan / Padang Aro (Sumatera Barat)
  "PADANG ARO": { lat: -1.5658, lng: 101.2568, city: "Solok Selatan", province: "Sumatera Barat" },
  "SANGIR": { lat: -1.5658, lng: 101.2568, city: "Solok Selatan", province: "Sumatera Barat" },
  "LUBUK GADANG": { lat: -1.5658, lng: 101.2568, city: "Solok Selatan", province: "Sumatera Barat" },
  "SANGIR JALAI": { lat: -1.58, lng: 101.24, city: "Solok Selatan", province: "Sumatera Barat" },
  // Samosir, Dairi, Sibolga & Tapanuli (Sumatera Utara - Benchmarked from Google Maps)
  "PANGURURAN": { lat: 2.6074, lng: 98.7092, city: "Pangururan (Samosir)", province: "Sumatera Utara" },
  "SAMOSIR": { lat: 2.6074, lng: 98.7092, city: "Samosir", province: "Sumatera Utara" },
  "PARDOMUAN": { lat: 2.608, lng: 98.709, city: "Pangururan (Samosir)", province: "Sumatera Utara" },
  "SIMANINDO": { lat: 2.68, lng: 98.75, city: "Samosir", province: "Sumatera Utara" },
  "ONAN RUNGGU": { lat: 2.53, lng: 98.88, city: "Samosir", province: "Sumatera Utara" },
  "NAINGGOLAN": { lat: 2.45, lng: 98.88, city: "Samosir", province: "Sumatera Utara" },
  "PALIPPI": { lat: 2.5, lng: 98.72, city: "Samosir", province: "Sumatera Utara" },
  "RONGGUR NIHUTA": { lat: 2.62, lng: 98.78, city: "Samosir", province: "Sumatera Utara" },
  "SITIO-TIO": { lat: 2.4, lng: 98.67, city: "Samosir", province: "Sumatera Utara" },
  "SIANJUR MULA MULA": { lat: 2.58, lng: 98.65, city: "Samosir", province: "Sumatera Utara" },
  "SIDIKALANG": { lat: 2.7485, lng: 98.3125, city: "Dairi (Sidikalang)", province: "Sumatera Utara" },
  "DAIRI": { lat: 2.7485, lng: 98.3125, city: "Dairi", province: "Sumatera Utara" },
  "SIBOLGA": { lat: 1.742, lng: 98.788, city: "Sibolga", province: "Sumatera Utara" },
  "PANDAN": { lat: 1.685, lng: 98.835, city: "Tapanuli Tengah", province: "Sumatera Utara" },
  "TAPANULI TENGAH": { lat: 1.7, lng: 98.85, city: "Tapanuli Tengah", province: "Sumatera Utara" },
  "TARUTUNG": { lat: 2.0235, lng: 98.9667, city: "Tapanuli Utara (Tarutung)", province: "Sumatera Utara" },
  "TAPANULI UTARA": { lat: 2.0235, lng: 98.9667, city: "Tapanuli Utara", province: "Sumatera Utara" },
  "BALIGE": { lat: 2.3333, lng: 99.0667, city: "Toba (Balige)", province: "Sumatera Utara" },
  "TOBA": { lat: 2.3333, lng: 99.0667, city: "Toba", province: "Sumatera Utara" },
  "TOBA SAMOSIR": { lat: 2.3333, lng: 99.0667, city: "Toba", province: "Sumatera Utara" }
};
function resolveBranchCoordinates(row) {
  const rawKodePos = String(row["KODE POS"] || "").replace(/\D/g, "").trim();
  const rawDati2 = cleanDati2(row["Dati II"] || row["Kode Dati II"] || "");
  const rawWilayah = String(row.Wilayah || "").toUpperCase().trim();
  const rawKecamatan = String(row.Kecamatan || "").toUpperCase().trim();
  const rawKelurahan = String(row.Kelurahan || "").toUpperCase().trim();
  const rawAlamat = String(row.ALAMAT || "").toUpperCase().trim();
  const rawNama = String(row["Nama Outlet"] || "").toUpperCase().trim();
  const fullText = `${rawNama} ${rawKelurahan} ${rawKecamatan} ${rawAlamat} ${rawDati2}`;
  if (rawKodePos.length === 5 && EXACT_POSTAL_MAP[rawKodePos]) {
    const ep = EXACT_POSTAL_MAP[rawKodePos];
    const [cLat2, cLng2] = clampToInland(ep.lat, ep.lng);
    return {
      lat: cLat2,
      lng: cLng2,
      city: ep.city,
      province: ep.province,
      source: "postal_exact"
    };
  }
  for (const [districtKey, distData] of Object.entries(CITY_DISTRICTS_MAP)) {
    const escaped = districtKey.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`(?:^|[\\s,./-])${escaped}(?:$|[\\s,./-])`, "i");
    if (regex.test(fullText)) {
      const [cLat2, cLng2] = clampToInland(distData.lat, distData.lng);
      return {
        lat: cLat2,
        lng: cLng2,
        city: distData.city,
        province: distData.province,
        source: "district_map"
      };
    }
  }
  if (rawKodePos.length >= 3) {
    const p3 = rawKodePos.slice(0, 3);
    if (POSTAL_3DIGIT_MAP[p3]) {
      const base = POSTAL_3DIGIT_MAP[p3];
      const [cLat2, cLng2] = clampToInland(base.lat, base.lng);
      return {
        lat: cLat2,
        lng: cLng2,
        city: base.city,
        province: base.province,
        source: "postal_prefix"
      };
    }
  }
  const isPadangArea = rawDati2.includes("PADANG") || rawKodePos.startsWith("25") || fullText.includes("PADANG");
  if (isPadangArea) {
    for (const [kec, coords] of Object.entries(KECAMATAN_PADANG_MAP)) {
      if (fullText.includes(kec)) {
        const [cLat2, cLng2] = clampToInland(coords.lat, coords.lng);
        return {
          lat: cLat2,
          lng: cLng2,
          city: "Padang",
          province: "Sumatera Barat",
          source: "dati2"
        };
      }
    }
  }
  if (rawDati2) {
    if (DATI2_MAP[rawDati2]) {
      const d = DATI2_MAP[rawDati2];
      const [cLat2, cLng2] = clampToInland(d.lat, d.lng);
      return {
        lat: cLat2,
        lng: cLng2,
        city: rawDati2,
        province: d.province,
        source: "dati2"
      };
    }
    for (const [key, d] of Object.entries(DATI2_MAP)) {
      if (rawDati2.includes(key) || key.includes(rawDati2)) {
        const [cLat2, cLng2] = clampToInland(d.lat, d.lng);
        return {
          lat: cLat2,
          lng: cLng2,
          city: key,
          province: d.province,
          source: "dati2"
        };
      }
    }
  }
  if (rawKodePos.length >= 2) {
    const p2 = rawKodePos.slice(0, 2);
    if (POSTAL_PREFIX_MAP[p2]) {
      const base = POSTAL_PREFIX_MAP[p2];
      const [cLat2, cLng2] = clampToInland(base.lat, base.lng);
      return {
        lat: cLat2,
        lng: cLng2,
        city: base.city,
        province: base.province,
        source: "postal_prefix"
      };
    }
  }
  const wCode = extractWCode(rawWilayah);
  if (wCode && WILAYAH_CENTROID_MAP[wCode]) {
    const w = WILAYAH_CENTROID_MAP[wCode];
    const [cLat2, cLng2] = clampToInland(w.lat, w.lng);
    return {
      lat: cLat2,
      lng: cLng2,
      city: w.regionName,
      source: "wilayah_centroid"
    };
  }
  const [cLat, cLng] = clampToInland(-6.1754, 106.8272);
  return {
    lat: cLat,
    lng: cLng,
    city: "Jakarta Pusat",
    province: "DKI Jakarta",
    source: "wilayah_centroid"
  };
}
function clusterMasterRowsForMap(masterRows, selectedWilayah = "ALL", targetRows = []) {
  const sandiMatchMap = /* @__PURE__ */ new Map();
  const kpMatchMap = /* @__PURE__ */ new Map();
  if (targetRows && targetRows.length > 0) {
    for (const t of targetRows) {
      const isMatched = !!t._isMatched;
      const s = String(t["Sandi Cabang"] || t.Sandi || t.Cabang || "").trim();
      const kp = String(t["KODE POS"] || "").replace(/\D/g, "").trim();
      if (s) {
        const cur = sandiMatchMap.get(s) || { matched: 0, total: 0 };
        cur.total++;
        if (isMatched) cur.matched++;
        sandiMatchMap.set(s, cur);
      }
      if (kp && kp.length >= 5) {
        const cur = kpMatchMap.get(kp) || { matched: 0, total: 0 };
        cur.total++;
        if (isMatched) cur.matched++;
        kpMatchMap.set(kp, cur);
      }
    }
  }
  const filtered = selectedWilayah === "ALL" ? masterRows : masterRows.filter((r) => {
    const rowCode = extractWCode(r.Wilayah || "");
    const selCode = extractWCode(selectedWilayah || "");
    if (rowCode && selCode && rowCode === selCode) return true;
    const rowNorm = formatWilayahName(r.Wilayah || "").toUpperCase();
    const selNorm = formatWilayahName(selectedWilayah || "").toUpperCase();
    if (rowNorm && selNorm && rowNorm === selNorm) return true;
    const rowW = String(r.Wilayah || "").trim().toUpperCase();
    const selW = String(selectedWilayah || "").trim().toUpperCase();
    return rowW === selW || rowW.startsWith(selW) || selW.startsWith(rowW);
  });
  const groups = /* @__PURE__ */ new Map();
  for (const row of filtered) {
    const kp = String(row["KODE POS"] || "").replace(/\D/g, "").trim();
    const d2 = cleanDati2(row["Dati II"] || "");
    const w = String(row.Wilayah || "").trim();
    const groupKey = kp.length >= 5 ? `KP_${kp}` : d2 ? `D2_${d2}` : `W_${w}_${row["Nama Outlet"]}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push(row);
  }
  const pins = [];
  groups.forEach((branches, key) => {
    if (branches.length === 0) return;
    const first = branches[0];
    const coords = resolveBranchCoordinates(first);
    const kp = String(first["KODE POS"] || "").replace(/\D/g, "").trim();
    let matchedCount = 0;
    let totalTargetCount = 0;
    for (const b of branches) {
      const s = String(b["Sandi Cabang"] || b.Sandi || b["Kode Cabang"] || "").trim();
      if (s && sandiMatchMap.has(s)) {
        const st = sandiMatchMap.get(s);
        matchedCount += st.matched;
        totalTargetCount += st.total;
      }
    }
    if (matchedCount === 0 && kp && kpMatchMap.has(kp)) {
      const kt = kpMatchMap.get(kp);
      matchedCount += kt.matched;
      totalTargetCount += kt.total;
    }
    const branchCount = branches.length;
    const baseLat = coords.lat;
    const baseLng = coords.lng;
    pins.push({
      id: `pin_${key}_${first["Sandi Cabang"] || first.Sandi || first["Kode Cabang"] || Math.random().toString(36).slice(2, 7)}`,
      lat: baseLat,
      lng: baseLng,
      kodePos: String(first["KODE POS"] || "-"),
      dati2: String(first["Dati II"] || coords.city || "-"),
      wilayah: String(first.Wilayah || "-"),
      branches,
      branchCount,
      primaryOutletName: first["Nama Outlet"] || "Outlet BNI",
      alamatDisplay: first.ALAMAT || `${first.Kecamatan || ""}, ${first["Dati II"] || ""}`,
      matchedCount,
      totalTargetCount
    });
  });
  return pins;
}
function isAcehTargetRow(row) {
  const kp = String(row["KODE POS"] || "").replace(/\D/g, "");
  const prov = String(row.Provinsi || "").toLowerCase();
  const dati = String(row["Dati II"] || "").toLowerCase();
  const kec = String(row.Kecamatan || "").toLowerCase();
  const kel = String(row.Kelurahan || "").toLowerCase();
  if (kp.startsWith("23") || kp.startsWith("24")) return true;
  if (prov.includes("aceh") || prov.includes("nad") || prov.includes("nanggroe")) return true;
  if (dati.includes("aceh")) return true;
  return ACEH_LOCATION_KEYWORDS.some((k) => dati.includes(k) || kec.includes(k) || kel.includes(k));
}
function resolveTargetOriginCoordinates(row) {
  const rawKodePos = String(row["KODE POS"] || "").replace(/\D/g, "").trim();
  const rawDati2 = cleanDati2(String(row["Dati II"] || row["Kode Dati II"] || ""));
  const rawKecamatan = String(row.Kecamatan || "").toUpperCase().trim();
  const rawKelurahan = String(row.Kelurahan || "").toUpperCase().trim();
  const rawProv = String(row.Provinsi || "").toUpperCase().trim();
  const adminText = `${rawKelurahan} ${rawKecamatan} ${rawDati2} ${rawProv}`;
  if (rawKodePos.length === 5 && EXACT_POSTAL_MAP[rawKodePos]) {
    const ep = EXACT_POSTAL_MAP[rawKodePos];
    const [cLat2, cLng2] = clampToIndonesia(ep.lat, ep.lng);
    return {
      lat: cLat2,
      lng: cLng2,
      city: ep.city,
      province: ep.province,
      source: "postal_exact"
    };
  }
  for (const [districtKey, distData] of Object.entries(CITY_DISTRICTS_MAP)) {
    const escaped = districtKey.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`(?:^|[\\s,./-])${escaped}(?:$|[\\s,./-])`, "i");
    if (regex.test(adminText)) {
      const [cLat2, cLng2] = clampToIndonesia(distData.lat, distData.lng);
      return {
        lat: cLat2,
        lng: cLng2,
        city: distData.city,
        province: distData.province,
        source: "district_map"
      };
    }
  }
  if (rawDati2) {
    if (DATI2_MAP[rawDati2]) {
      const d = DATI2_MAP[rawDati2];
      const [cLat2, cLng2] = clampToIndonesia(d.lat, d.lng);
      return { lat: cLat2, lng: cLng2, city: rawDati2, province: d.province, source: "dati2" };
    }
    for (const [key, d] of Object.entries(DATI2_MAP)) {
      if (rawDati2.includes(key) || key.includes(rawDati2)) {
        const [cLat2, cLng2] = clampToIndonesia(d.lat, d.lng);
        return { lat: cLat2, lng: cLng2, city: key, province: d.province, source: "dati2" };
      }
    }
  }
  if (rawKodePos.length >= 3 && POSTAL_3DIGIT_MAP[rawKodePos.slice(0, 3)]) {
    const z = POSTAL_3DIGIT_MAP[rawKodePos.slice(0, 3)];
    const [cLat2, cLng2] = clampToIndonesia(z.lat, z.lng);
    return { lat: cLat2, lng: cLng2, city: z.city, province: z.province || "Aceh", source: "postal_prefix" };
  }
  if (rawKodePos.length >= 2 && POSTAL_PREFIX_MAP[rawKodePos.slice(0, 2)]) {
    const base = POSTAL_PREFIX_MAP[rawKodePos.slice(0, 2)];
    const [cLat2, cLng2] = clampToIndonesia(base.lat, base.lng);
    return { lat: cLat2, lng: cLng2, city: base.city, province: base.province, source: "postal_prefix" };
  }
  if (isAcehTargetRow(row)) {
    const [cLat2, cLng2] = clampToIndonesia(5.553, 95.322);
    return { lat: cLat2, lng: cLng2, city: "Banda Aceh", province: "Aceh", source: "postal_prefix" };
  }
  const wCode = extractWCode(String(row.Wilayah || ""));
  if (wCode && WILAYAH_CENTROID_MAP[wCode]) {
    const w = WILAYAH_CENTROID_MAP[wCode];
    const [cLat2, cLng2] = clampToIndonesia(w.lat, w.lng);
    return { lat: cLat2, lng: cLng2, city: w.regionName, source: "wilayah_centroid" };
  }
  const [cLat, cLng] = clampToIndonesia(-6.1754, 106.8272);
  return { lat: cLat, lng: cLng, city: "Jakarta Pusat", province: "DKI Jakarta", source: "wilayah_centroid" };
}
function resolveTargetRowCoordinates(row) {
  return resolveTargetOriginCoordinates(row);
}
function groupTargetOriginsForMap(rows) {
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const origin = resolveTargetOriginCoordinates(row);
    const [lat, lng] = clampToIndonesia(origin.lat, origin.lng);
    const dati = String(row["Dati II"] || origin.city || "").trim();
    const kec = String(row.Kecamatan || "").trim();
    const kp3 = String(row["KODE POS"] || "").replace(/\D/g, "").slice(0, 3);
    const key = `${dati.toUpperCase()}|${kec.toUpperCase()}|${kp3}|${lat.toFixed(2)}|${lng.toFixed(2)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        lat,
        lng,
        label: [kec, dati].filter(Boolean).join(", ") || origin.city || "Titik Asal",
        rows: []
      });
    }
    groups.get(key).rows.push(row);
  }
  return Array.from(groups.values()).sort((a, b) => b.rows.length - a.rows.length);
}
function getAllMatchedCoordinates(rows) {
  return rows.filter((r) => r._isMatched).map((r) => {
    const loc = resolveTargetOriginCoordinates(r);
    return clampToIndonesia(loc.lat, loc.lng);
  });
}
function createCurvedArcPoints(start, end, curveOffset = 0.15, numPoints = 24) {
  const [lat1, lng1] = clampToIndonesia(start[0], start[1]);
  const [lat2, lng2] = clampToIndonesia(end[0], end[1]);
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  if (dist < 5e-4) {
    return [];
  }
  const capped = Math.min(Math.abs(curveOffset), dist > 2 ? 0.08 : 0.15);
  const signedOffset = curveOffset < 0 ? -capped : capped;
  const arcHeight = Math.min(Math.max(dist * Math.abs(signedOffset), 4e-3), 0.32);
  const normLat = -dLng / dist;
  const normLng = dLat / dist;
  let controlLat = midLat + normLat * arcHeight * Math.sign(signedOffset || 1);
  let controlLng = midLng + normLng * arcHeight * Math.sign(signedOffset || 1);
  const [clampedLat, clampedLng] = clampToIndonesia(controlLat, controlLng);
  if (clampedLat !== controlLat || clampedLng !== controlLng || isForeignLand(controlLat, controlLng)) {
    controlLng = midLng - normLng * arcHeight * Math.sign(signedOffset || 1);
    controlLat = midLat - normLat * arcHeight * Math.sign(signedOffset || 1);
  }
  [controlLat, controlLng] = clampToIndonesia(controlLat, controlLng);
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const oneMinusT = 1 - t;
    const lat = oneMinusT * oneMinusT * lat1 + 2 * oneMinusT * t * controlLat + t * t * lat2;
    const lng = oneMinusT * oneMinusT * lng1 + 2 * oneMinusT * t * controlLng + t * t * lng2;
    points.push(clampToIndonesia(lat, lng));
  }
  return points;
}
var FOREIGN_LAND_MASKS = [
  // 1. Peninsular Malaysia, Singapore & Southern Thailand
  {
    name: "Malaysia Barat & Singapura",
    coords: [
      [1.24, 103.4],
      [1.32, 103.62],
      [1.48, 104.05],
      [1.75, 104.35],
      [6.8, 102.3],
      [7.2, 100.2],
      [6.5, 99.5],
      [3, 101],
      [1.5, 102.9],
      [1.24, 103.4]
    ]
  },
  // 2. Sarawak, Sabah & Brunei (Malaysia Timur)
  {
    name: "Malaysia Timur (Sarawak, Sabah) & Brunei",
    coords: [
      [2.08, 109.64],
      [1.75, 110.35],
      [1.2, 110.8],
      [0.9, 111.7],
      [1.3, 112.5],
      [1.8, 113.8],
      [2.5, 115],
      [4.18, 115.6],
      [4.18, 117.65],
      [4.6, 118.5],
      [5.5, 119],
      [7.4, 117.3],
      [6, 115.5],
      [4.9, 114.8],
      [4.5, 114],
      [3.2, 113],
      [2.08, 109.64]
    ]
  },
  // 3. Papua New Guinea (East of 141° E)
  {
    name: "Papua New Guinea",
    coords: [
      [-2.5, 141.02],
      [-2.5, 155],
      [-12, 155],
      [-12, 141.02],
      [-9.15, 141.02],
      [-6.9, 141.25],
      [-6, 141.02],
      [-2.5, 141.02]
    ]
  },
  // 4. Australia (Darwin / Northern Territory / Cocos)
  {
    name: "Australia & Samudra Selatan",
    coords: [
      [-11.6, 110],
      [-11.6, 143],
      [-25, 143],
      [-25, 110],
      [-11.6, 110]
    ]
  },
  // 5. Philippines (Mindanao & Kepulauan Sulu)
  {
    name: "Filipina (Mindanao & Kepulauan Sulu)",
    coords: [
      [5.8, 119.5],
      [10, 119.5],
      [10, 127.5],
      [5.8, 127.5],
      [5.8, 119.5]
    ]
  },
  // 6. Timor-Leste
  {
    name: "Timor-Leste",
    coords: [
      [-8.3, 125.05],
      [-8.3, 127.4],
      [-9.35, 127.4],
      [-9.35, 125.05],
      [-8.3, 125.05]
    ]
  }
];
function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0];
    const xi = ring[i][1];
    const yj = ring[j][0];
    const xj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < (xj - xi) * (lat - yi) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
function isForeignLand(lat, lng) {
  return FOREIGN_LAND_MASKS.some((mask) => pointInRing(lat, lng, mask.coords));
}
function clampToIndonesia(lat, lng) {
  let [cLat, cLng] = clampToInland(lat, lng);
  cLat = Math.min(6.15, Math.max(-11, cLat));
  cLng = Math.min(141, Math.max(94.9, cLng));
  if (isForeignLand(cLat, cLng)) {
    const idLat = -2.5;
    const idLng = 118;
    for (let step = 0; step < 8 && isForeignLand(cLat, cLng); step++) {
      cLat += (idLat - cLat) * 0.35;
      cLng += (idLng - cLng) * 0.35;
    }
    if (isForeignLand(cLat, cLng)) {
      return clampToInland(-2.5, 118);
    }
  }
  return [Number(cLat.toFixed(6)), Number(cLng.toFixed(6))];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CITY_DISTRICTS_MAP,
  EXACT_POSTAL_MAP,
  FOREIGN_LAND_MASKS,
  INDONESIA_REGIONS,
  POSTAL_3DIGIT_MAP,
  clampToIndonesia,
  clampToInland,
  clusterMasterRowsForMap,
  createCurvedArcPoints,
  extractWCode,
  getAllMatchedCoordinates,
  groupTargetOriginsForMap,
  isAcehTargetRow,
  isForeignLand,
  resolveBranchCoordinates,
  resolveTargetOriginCoordinates,
  resolveTargetRowCoordinates
});
