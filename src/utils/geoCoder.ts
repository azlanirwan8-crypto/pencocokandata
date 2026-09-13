// Geocoding Engine for Indonesian Postal Codes, Dati II (Kabupaten/Kota), and BNI Wilayah
import type { MasterRow, TargetRow } from '../types';
import { formatWilayahName } from './normalizer.ts';

export interface GeoLocation {
  lat: number;
  lng: number;
  city?: string;
  province?: string;
  source: 'postal_exact' | 'postal_prefix' | 'dati2' | 'wilayah_centroid' | 'district_map';
}

export interface PlottedBranchPin {
  id: string;
  lat: number;
  lng: number;
  kodePos: string;
  dati2: string;
  wilayah: string;
  branches: MasterRow[];
  branchCount: number;
  primaryOutletName: string;
  alamatDisplay: string;
  matchedCount: number;
  totalTargetCount: number;
}

// 1. Regional Island Bounds & Centroids (Adjusted to properly frame Aceh & Papua)
export const INDONESIA_REGIONS = {
  ALL: { name: 'Seluruh Indonesia', center: [-1.2000, 117.0000] as [number, number], zoom: 5 },
  SUMATERA: { name: 'Sumatera & Aceh', center: [3.2000, 97.5000] as [number, number], zoom: 6 },
  JAWA: { name: 'Jawa & Banten', center: [-7.2504, 110.1500] as [number, number], zoom: 7 },
  BALI_NUSA: { name: 'Bali & Nusa Tenggara', center: [-8.6500, 118.5000] as [number, number], zoom: 7 },
  KALIMANTAN: { name: 'Kalimantan', center: [-1.2000, 114.0000] as [number, number], zoom: 6 },
  SULAWESI: { name: 'Sulawesi', center: [-2.5000, 121.5000] as [number, number], zoom: 6 },
  MALUKU_PAPUA: { name: 'Maluku & Papua', center: [-3.8000, 136.0000] as [number, number], zoom: 5 },
};

// 2. Postal Code 2-digit / 3-digit prefix mapping to Lat/Lng centroids
const POSTAL_PREFIX_MAP: Record<string, { lat: number; lng: number; city: string; province: string }> = {
  // DKI Jakarta & Bodetabek (10 - 17)
  '10': { lat: -6.1818, lng: 106.8340, city: 'Jakarta Pusat', province: 'DKI Jakarta' },
  '11': { lat: -6.1683, lng: 106.7588, city: 'Jakarta Barat', province: 'DKI Jakarta' },
  '12': { lat: -6.2615, lng: 106.8106, city: 'Jakarta Selatan', province: 'DKI Jakarta' },
  '13': { lat: -6.2250, lng: 106.9004, city: 'Jakarta Timur', province: 'DKI Jakarta' },
  '14': { lat: -6.1384, lng: 106.8640, city: 'Jakarta Utara', province: 'DKI Jakarta' },
  '15': { lat: -6.2088, lng: 106.6381, city: 'Tangerang / Tangerang Selatan', province: 'Banten' },
  '16': { lat: -6.5971, lng: 106.8060, city: 'Bogor / Depok', province: 'Jawa Barat' },
  '17': { lat: -6.2383, lng: 106.9756, city: 'Bekasi', province: 'Jawa Barat' },

  // Sumatera Utara & Aceh (20 - 24)
  '20': { lat: 3.5952, lng: 98.6722, city: 'Medan', province: 'Sumatera Utara' },
  '21': { lat: 3.2500, lng: 99.2000, city: 'Asahan / Batubara', province: 'Sumatera Utara' },
  '22': { lat: 1.7420, lng: 98.7850, city: 'Tapanuli / Sibolga', province: 'Sumatera Utara' },
  '23': { lat: 5.5530, lng: 95.3220, city: 'Banda Aceh', province: 'Aceh' },
  '24': { lat: 4.8000, lng: 97.0000, city: 'Lhokseumawe / Langsa', province: 'Aceh' },

  // Sumatera Barat & Riau / Kepri (25 - 29)
  '25': { lat: -0.9478, lng: 100.3685, city: 'Padang', province: 'Sumatera Barat' },
  '26': { lat: -0.3000, lng: 100.3700, city: 'Bukittinggi / Agam', province: 'Sumatera Barat' },
  '27': { lat: -1.0000, lng: 100.8000, city: 'Solok / Tanah Datar', province: 'Sumatera Barat' },
  '28': { lat: 0.5071, lng: 101.4478, city: 'Pekanbaru / Kampar', province: 'Riau' },
  '29': { lat: 1.1301, lng: 104.0529, city: 'Batam / Tanjung Pinang', province: 'Kepulauan Riau' },

  // Sumatera Selatan, Bangka Belitung, Bengkulu, Lampung, Jambi (30 - 37)
  '30': { lat: -2.9761, lng: 104.7754, city: 'Palembang', province: 'Sumatera Selatan' },
  '31': { lat: -3.8000, lng: 103.8000, city: 'Prabumulih / Lahat', province: 'Sumatera Selatan' },
  '32': { lat: -4.0000, lng: 104.2000, city: 'Baturaja / OKU', province: 'Sumatera Selatan' },
  '33': { lat: -2.1316, lng: 106.1115, city: 'Pangkal Pinang / Belitung', province: 'Bangka Belitung' },
  '34': { lat: -4.8000, lng: 105.0000, city: 'Kotabumi / Lampung Utara', province: 'Lampung' },
  '35': { lat: -5.4500, lng: 105.2667, city: 'Bandar Lampung / Metro', province: 'Lampung' },
  '36': { lat: -1.6101, lng: 103.6131, city: 'Jambi', province: 'Jambi' },
  '37': { lat: -2.0000, lng: 102.5000, city: 'Muara Bungo / Kerinci', province: 'Jambi' },
  '38': { lat: -3.7928, lng: 102.2680, city: 'Bengkulu', province: 'Bengkulu' },

  // Jawa Barat & Banten (40 - 46)
  '40': { lat: -6.9175, lng: 107.6191, city: 'Bandung / Cimahi', province: 'Jawa Barat' },
  '41': { lat: -6.5500, lng: 107.7500, city: 'Purwakarta / Subang', province: 'Jawa Barat' },
  '42': { lat: -6.1200, lng: 106.1503, city: 'Serang / Cilegon / Pandeglang', province: 'Banten' },
  '43': { lat: -6.9277, lng: 106.9300, city: 'Sukabumi / Cianjur', province: 'Jawa Barat' },
  '44': { lat: -7.2278, lng: 107.9087, city: 'Garut', province: 'Jawa Barat' },
  '45': { lat: -6.7320, lng: 108.5523, city: 'Cirebon / Indramayu / Majalengka / Kuningan', province: 'Jawa Barat' },
  '46': { lat: -7.3274, lng: 108.2207, city: 'Tasikmalaya / Ciamis / Banjar', province: 'Jawa Barat' },

  // Jawa Tengah & D.I. Yogyakarta (50 - 59)
  '50': { lat: -6.9667, lng: 110.4167, city: 'Semarang', province: 'Jawa Tengah' },
  '51': { lat: -6.8886, lng: 109.6753, city: 'Pekalongan / Batang', province: 'Jawa Tengah' },
  '52': { lat: -6.8694, lng: 109.1402, city: 'Tegal / Brebes / Pemalang', province: 'Jawa Tengah' },
  '53': { lat: -7.4244, lng: 109.2302, city: 'Purwokerto / Banyumas / Cilacap', province: 'Jawa Tengah' },
  '54': { lat: -7.6750, lng: 109.6500, city: 'Kebumen / Purworejo', province: 'Jawa Tengah' },
  '55': { lat: -7.7956, lng: 110.3695, city: 'Yogyakarta / Sleman / Bantul', province: 'D.I. Yogyakarta' },
  '56': { lat: -7.4706, lng: 110.2178, city: 'Magelang / Temanggung', province: 'Jawa Tengah' },
  '57': { lat: -7.5755, lng: 110.8243, city: 'Surakarta (Solo) / Klaten / Sukoharjo / Karanganyar', province: 'Jawa Tengah' },
  '58': { lat: -7.0000, lng: 111.0000, city: 'Grobogan / Blora', province: 'Jawa Tengah' },
  '59': { lat: -6.8048, lng: 110.8405, city: 'Kudus / Pati / Jepara / Rembang', province: 'Jawa Tengah' },

  // Jawa Timur & Madura (60 - 69)
  '60': { lat: -7.2575, lng: 112.7521, city: 'Surabaya', province: 'Jawa Timur' },
  '61': { lat: -7.4530, lng: 112.7180, city: 'Sidoarjo / Gresik', province: 'Jawa Timur' },
  '62': { lat: -7.1167, lng: 112.0000, city: 'Bojonegoro / Tuban / Lamongan', province: 'Jawa Timur' },
  '63': { lat: -7.6298, lng: 111.5239, city: 'Madiun / Ngawi / Magetan / Ponorogo', province: 'Jawa Timur' },
  '64': { lat: -7.8167, lng: 112.0167, city: 'Kediri / Nganjuk / Tulungagung / Blitar', province: 'Jawa Timur' },
  '65': { lat: -7.9797, lng: 112.6304, city: 'Malang / Batu', province: 'Jawa Timur' },
  '66': { lat: -7.7543, lng: 113.2159, city: 'Probolinggo / Pasuruan', province: 'Jawa Timur' },
  '67': { lat: -8.1724, lng: 113.7000, city: 'Jember / Lumajang', province: 'Jawa Timur' },
  '68': { lat: -8.2192, lng: 114.3691, city: 'Banyuwangi / Situbondo / Bondowoso', province: 'Jawa Timur' },
  '69': { lat: -7.0167, lng: 113.8667, city: 'Madura (Bangkalan / Pamekasan / Sumenep)', province: 'Jawa Timur' },

  // Kalimantan (70 - 79)
  '70': { lat: -3.3167, lng: 114.5900, city: 'Banjarmasin / Banjarbaru', province: 'Kalimantan Selatan' },
  '71': { lat: -2.8000, lng: 115.3000, city: 'Hulu Sungai / Barabai', province: 'Kalimantan Selatan' },
  '72': { lat: -3.5000, lng: 116.0000, city: 'Kotabaru / Tanah Bumbu', province: 'Kalimantan Selatan' },
  '73': { lat: -2.2100, lng: 113.9213, city: 'Palangka Raya', province: 'Kalimantan Tengah' },
  '74': { lat: -2.5000, lng: 112.0000, city: 'Sampit / Pangkalan Bun', province: 'Kalimantan Tengah' },
  '75': { lat: -0.5022, lng: 117.1536, city: 'Samarinda / Kutai Kartanegara', province: 'Kalimantan Timur' },
  '76': { lat: -1.2580, lng: 116.8350, city: 'Balikpapan / Penajam Paser', province: 'Kalimantan Timur' },
  '77': { lat: 3.3276, lng: 117.5925, city: 'Tarakan / Tanjung Selor / Nunukan', province: 'Kalimantan Utara' },
  '78': { lat: -0.0263, lng: 109.3425, city: 'Pontianak / Kubu Raya', province: 'Kalimantan Barat' },
  '79': { lat: 0.9083, lng: 108.9872, city: 'Singkawang / Sambas / Sintang', province: 'Kalimantan Barat' },

  // Bali, NTB, NTT (80 - 87)
  '80': { lat: -8.6705, lng: 115.2126, city: 'Denpasar / Badung / Sanur', province: 'Bali' },
  '81': { lat: -8.1120, lng: 115.0882, city: 'Singaraja / Buleleng', province: 'Bali' },
  '82': { lat: -8.5300, lng: 115.4000, city: 'Gianyar / Klungkung / Karangasem', province: 'Bali' },
  '83': { lat: -8.5833, lng: 116.1167, city: 'Mataram / Lombok Barat / Lombok Tengah', province: 'Nusa Tenggara Barat' },
  '84': { lat: -8.4900, lng: 117.4200, city: 'Sumbawa Besar / Bima / Dompu', province: 'Nusa Tenggara Barat' },
  '85': { lat: -10.1772, lng: 123.6070, city: 'Kupang', province: 'Nusa Tenggara Timur' },
  '86': { lat: -8.5069, lng: 119.8878, city: 'Labuan Bajo / Manggarai / Ende / Maumere', province: 'Nusa Tenggara Timur' },
  '87': { lat: -9.6500, lng: 120.2600, city: 'Waingapu / Sumba', province: 'Nusa Tenggara Timur' },

  // Sulawesi (90 - 96)
  '90': { lat: -5.1477, lng: 119.4327, city: 'Makassar / Gowa / Maros', province: 'Sulawesi Selatan' },
  '91': { lat: -4.0100, lng: 119.6200, city: 'Parepare / Pinrang / Polewali Mandar', province: 'Sulawesi Selatan' },
  '92': { lat: -5.5000, lng: 120.2000, city: 'Bulukumba / Sinjai / Bone', province: 'Sulawesi Selatan' },
  '93': { lat: -3.9985, lng: 122.5126, city: 'Kendari / Kolaka / Baubau', province: 'Sulawesi Tenggara' },
  '94': { lat: -0.9003, lng: 119.8779, city: 'Palu / Donggala / Poso / Luwuk', province: 'Sulawesi Tengah' },
  '95': { lat: 1.4748, lng: 124.8421, city: 'Manado / Bitung / Tomohon / Minahasa', province: 'Sulawesi Utara' },
  '96': { lat: 0.5435, lng: 123.0568, city: 'Gorontalo', province: 'Gorontalo' },

  // Maluku & Papua (97 - 99)
  '97': { lat: -3.6954, lng: 128.1814, city: 'Ambon / Tual / Maluku Tengah', province: 'Maluku' },
  '98': { lat: 0.7900, lng: 127.3800, city: 'Ternate / Tidore / Halmahera', province: 'Maluku Utara' },
  '99': { lat: -2.5380, lng: 140.7020, city: 'Jayapura / Sorong / Manokwari / Merauke / Timika', province: 'Papua' },
};

// 3. Known Major Cities / Dati II Centroids
const DATI2_MAP: Record<string, { lat: number; lng: number; province: string }> = {
  // Jabodetabek
  'JAKARTA PUSAT': { lat: -6.1818, lng: 106.8340, province: 'DKI Jakarta' },
  'JAKARTA SELATAN': { lat: -6.2615, lng: 106.8106, province: 'DKI Jakarta' },
  'JAKARTA BARAT': { lat: -6.1683, lng: 106.7588, province: 'DKI Jakarta' },
  'JAKARTA TIMUR': { lat: -6.2250, lng: 106.9004, province: 'DKI Jakarta' },
  'JAKARTA UTARA': { lat: -6.1384, lng: 106.8640, province: 'DKI Jakarta' },
  'KOTA BOGOR': { lat: -6.5971, lng: 106.8060, province: 'Jawa Barat' },
  'KAB. BOGOR': { lat: -6.5500, lng: 106.8800, province: 'Jawa Barat' },
  'KOTA DEPOK': { lat: -6.4025, lng: 106.7942, province: 'Jawa Barat' },
  'KOTA TANGERANG': { lat: -6.1783, lng: 106.6319, province: 'Banten' },
  'KOTA TANGERANG SELATAN': { lat: -6.2936, lng: 106.7099, province: 'Banten' },
  'KAB. TANGERANG': { lat: -6.1900, lng: 106.5000, province: 'Banten' },
  'KOTA BEKASI': { lat: -6.2383, lng: 106.9756, province: 'Jawa Barat' },
  'KAB. BEKASI': { lat: -6.2800, lng: 107.1500, province: 'Jawa Barat' },

  // Jawa Barat
  'KOTA BANDUNG': { lat: -6.9175, lng: 107.6191, province: 'Jawa Barat' },
  'KAB. BANDUNG': { lat: -7.0252, lng: 107.5197, province: 'Jawa Barat' },
  'KAB. BANDUNG BARAT': { lat: -6.8500, lng: 107.4500, province: 'Jawa Barat' },
  'KOTA CIMAHI': { lat: -6.8722, lng: 107.5432, province: 'Jawa Barat' },
  'KOTA CIREBON': { lat: -6.7320, lng: 108.5523, province: 'Jawa Barat' },
  'KAB. CIREBON': { lat: -6.7600, lng: 108.4800, province: 'Jawa Barat' },
  'KOTA TASIKMALAYA': { lat: -7.3274, lng: 108.2207, province: 'Jawa Barat' },
  'KAB. TASIKMALAYA': { lat: -7.4500, lng: 108.1500, province: 'Jawa Barat' },
  'KOTA SUKABUMI': { lat: -6.9277, lng: 106.9300, province: 'Jawa Barat' },
  'KAB. SUKABUMI': { lat: -7.0000, lng: 106.7000, province: 'Jawa Barat' },
  'KAB. KARAWANG': { lat: -6.3050, lng: 107.3000, province: 'Jawa Barat' },
  'KAB. PURWAKARTA': { lat: -6.5500, lng: 107.4400, province: 'Jawa Barat' },
  'KAB. SUBANG': { lat: -6.5700, lng: 107.7600, province: 'Jawa Barat' },
  'KAB. INDRAMAYU': { lat: -6.3300, lng: 108.3200, province: 'Jawa Barat' },
  'KAB. MAJALENGKA': { lat: -6.8300, lng: 108.2300, province: 'Jawa Barat' },
  'KAB. KUNINGAN': { lat: -6.9800, lng: 108.4800, province: 'Jawa Barat' },
  'KAB. SUMEDANG': { lat: -6.8600, lng: 107.9200, province: 'Jawa Barat' },
  'KAB. GARUT': { lat: -7.2278, lng: 107.9087, province: 'Jawa Barat' },
  'KAB. CIANJUR': { lat: -6.8200, lng: 107.1400, province: 'Jawa Barat' },
  'KAB. CIAMIS': { lat: -7.3300, lng: 108.3500, province: 'Jawa Barat' },
  'KOTA BANJAR': { lat: -7.3700, lng: 108.5300, province: 'Jawa Barat' },

  // Banten
  'KOTA SERANG': { lat: -6.1200, lng: 106.1503, province: 'Banten' },
  'KAB. SERANG': { lat: -6.1500, lng: 106.0000, province: 'Banten' },
  'KOTA CILEGON': { lat: -6.0174, lng: 106.0538, province: 'Banten' },
  'KAB. PANDEGLANG': { lat: -6.3100, lng: 106.1000, province: 'Banten' },
  'KAB. LEBAK': { lat: -6.5500, lng: 106.2500, province: 'Banten' },

  // Jawa Tengah & DIY
  'KOTA SEMARANG': { lat: -6.9667, lng: 110.4167, province: 'Jawa Tengah' },
  'KAB. SEMARANG': { lat: -7.1500, lng: 110.4300, province: 'Jawa Tengah' },
  'KOTA SURAKARTA': { lat: -7.5755, lng: 110.8243, province: 'Jawa Tengah' },
  'KOTA YOGYAKARTA': { lat: -7.7956, lng: 110.3695, province: 'D.I. Yogyakarta' },
  'KAB. SLEMAN': { lat: -7.7167, lng: 110.3556, province: 'D.I. Yogyakarta' },
  'KAB. BANTUL': { lat: -7.8900, lng: 110.3300, province: 'D.I. Yogyakarta' },
  'KAB. KULON PROGO': { lat: -7.7700, lng: 110.1600, province: 'D.I. Yogyakarta' },
  'KAB. GUNUNGKIDUL': { lat: -7.9600, lng: 110.6000, province: 'D.I. Yogyakarta' },
  'KOTA PEKALONGAN': { lat: -6.8886, lng: 109.6753, province: 'Jawa Tengah' },
  'KOTA TEGAL': { lat: -6.8694, lng: 109.1402, province: 'Jawa Tengah' },
  'KOTA SALATIGA': { lat: -7.3305, lng: 110.5084, province: 'Jawa Tengah' },
  'KOTA MAGELANG': { lat: -7.4706, lng: 110.2178, province: 'Jawa Tengah' },
  'KAB. BANYUMAS': { lat: -7.4244, lng: 109.2302, province: 'Jawa Tengah' },
  'KAB. CILACAP': { lat: -7.7279, lng: 109.0076, province: 'Jawa Tengah' },
  'KAB. KUDUS': { lat: -6.8048, lng: 110.8405, province: 'Jawa Tengah' },
  'KAB. PATI': { lat: -6.7500, lng: 111.0300, province: 'Jawa Tengah' },
  'KAB. JEPARA': { lat: -6.5900, lng: 110.6700, province: 'Jawa Tengah' },
  'KAB. KLATEN': { lat: -7.7000, lng: 110.6000, province: 'Jawa Tengah' },
  'KAB. SUKOHARJO': { lat: -7.6800, lng: 110.8300, province: 'Jawa Tengah' },
  'KAB. KARANGANYAR': { lat: -7.5900, lng: 110.9500, province: 'Jawa Tengah' },
  'KAB. BOYOLALI': { lat: -7.5300, lng: 110.5900, province: 'Jawa Tengah' },
  'KAB. SRAGEN': { lat: -7.4200, lng: 111.0200, province: 'Jawa Tengah' },
  'KAB. WONOGIRI': { lat: -7.8100, lng: 110.9200, province: 'Jawa Tengah' },
  'KAB. KENDAL': { lat: -6.9200, lng: 110.2000, province: 'Jawa Tengah' },
  'KAB. BATANG': { lat: -6.9100, lng: 109.7300, province: 'Jawa Tengah' },
  'KAB. PEMALANG': { lat: -6.8900, lng: 109.3800, province: 'Jawa Tengah' },
  'KAB. BREBES': { lat: -6.8700, lng: 109.0400, province: 'Jawa Tengah' },
  'KAB. PURBALINGGA': { lat: -7.3800, lng: 109.3600, province: 'Jawa Tengah' },
  'KAB. BANJARNEGARA': { lat: -7.3900, lng: 109.7000, province: 'Jawa Tengah' },
  'KAB. KEBUMEN': { lat: -7.6750, lng: 109.6500, province: 'Jawa Tengah' },
  'KAB. PURWOREJO': { lat: -7.7100, lng: 110.0100, province: 'Jawa Tengah' },
  'KAB. TEMANGGUNG': { lat: -7.3100, lng: 110.1700, province: 'Jawa Tengah' },
  'KAB. WONOSOBO': { lat: -7.3600, lng: 109.9000, province: 'Jawa Tengah' },
  'KAB. BLORA': { lat: -7.0000, lng: 111.4100, province: 'Jawa Tengah' },
  'KAB. REMBANG': { lat: -6.7100, lng: 111.3400, province: 'Jawa Tengah' },
  'KAB. GROBOGAN': { lat: -7.0200, lng: 110.9100, province: 'Jawa Tengah' },

  // Jawa Timur
  'KOTA SURABAYA': { lat: -7.2575, lng: 112.7521, province: 'Jawa Timur' },
  'KOTA MALANG': { lat: -7.9797, lng: 112.6304, province: 'Jawa Timur' },
  'KOTA BATU': { lat: -7.8700, lng: 112.5200, province: 'Jawa Timur' },
  'KAB. SIDOARJO': { lat: -7.4530, lng: 112.7180, province: 'Jawa Timur' },
  'KAB. GRESIK': { lat: -7.1566, lng: 112.6555, province: 'Jawa Timur' },
  'KOTA MOJOKERTO': { lat: -7.4722, lng: 112.4381, province: 'Jawa Timur' },
  'KAB. MOJOKERTO': { lat: -7.5500, lng: 112.4500, province: 'Jawa Timur' },
  'KOTA PASURUAN': { lat: -7.6469, lng: 112.9075, province: 'Jawa Timur' },
  'KAB. PASURUAN': { lat: -7.6500, lng: 112.7500, province: 'Jawa Timur' },
  'KOTA PROBOLINGGO': { lat: -7.7543, lng: 113.2159, province: 'Jawa Timur' },
  'KAB. PROBOLINGGO': { lat: -7.8000, lng: 113.2500, province: 'Jawa Timur' },
  'KOTA KEDIRI': { lat: -7.8167, lng: 112.0167, province: 'Jawa Timur' },
  'KAB. KEDIRI': { lat: -7.8500, lng: 112.1500, province: 'Jawa Timur' },
  'KOTA BLITAR': { lat: -8.0983, lng: 112.1681, province: 'Jawa Timur' },
  'KAB. BLITAR': { lat: -8.1500, lng: 112.2000, province: 'Jawa Timur' },
  'KOTA MADIUN': { lat: -7.6298, lng: 111.5239, province: 'Jawa Timur' },
  'KAB. MADIUN': { lat: -7.5500, lng: 111.6500, province: 'Jawa Timur' },
  'KAB. JEMBER': { lat: -8.1724, lng: 113.7000, province: 'Jawa Timur' },
  'KAB. BANYUWANGI': { lat: -8.2192, lng: 114.3691, province: 'Jawa Timur' },
  'KAB. LUMAJANG': { lat: -8.1300, lng: 113.2200, province: 'Jawa Timur' },
  'KAB. BONDOWOSO': { lat: -7.9100, lng: 113.8200, province: 'Jawa Timur' },
  'KAB. SITUBONDO': { lat: -7.7000, lng: 114.0000, province: 'Jawa Timur' },
  'KAB. BOJONEGORO': { lat: -7.1500, lng: 111.8800, province: 'Jawa Timur' },
  'KAB. TUBAN': { lat: -6.8900, lng: 112.0600, province: 'Jawa Timur' },
  'KAB. LAMONGAN': { lat: -7.1200, lng: 112.4100, province: 'Jawa Timur' },
  'KAB. TULUNGAGUNG': { lat: -8.0600, lng: 111.9000, province: 'Jawa Timur' },
  'KAB. TRENGGALEK': { lat: -8.0500, lng: 111.7100, province: 'Jawa Timur' },
  'KAB. NGANJUK': { lat: -7.6000, lng: 111.9000, province: 'Jawa Timur' },
  'KAB. MAGETAN': { lat: -7.6500, lng: 111.3200, province: 'Jawa Timur' },
  'KAB. NGAWI': { lat: -7.4000, lng: 111.4500, province: 'Jawa Timur' },
  'KAB. PACITAN': { lat: -8.2000, lng: 111.0900, province: 'Jawa Timur' },
  'KAB. PONOROGO': { lat: -7.8600, lng: 111.4600, province: 'Jawa Timur' },
  'KAB. BANGKALAN': { lat: -7.0300, lng: 112.7500, province: 'Jawa Timur' },
  'KAB. SAMPANG': { lat: -7.1800, lng: 113.2400, province: 'Jawa Timur' },
  'KAB. PAMEKASAN': { lat: -7.1600, lng: 113.4800, province: 'Jawa Timur' },
  'KAB. SUMENEP': { lat: -7.0167, lng: 113.8667, province: 'Jawa Timur' },

  // Sumatera
  'KOTA MEDAN': { lat: 3.5952, lng: 98.6722, province: 'Sumatera Utara' },
  'KOTA BINJAI': { lat: 3.6000, lng: 98.4800, province: 'Sumatera Utara' },
  'KOTA PEMATANGSIANTAR': { lat: 2.9600, lng: 99.0600, province: 'Sumatera Utara' },
  'KOTA TEBING TINGGI': { lat: 3.3200, lng: 99.1600, province: 'Sumatera Utara' },
  'KAB. DELI SERDANG': { lat: 3.5500, lng: 98.8500, province: 'Sumatera Utara' },
  // Aceh (Wilayah 01 / Dilayani Cabang KIM)
  'KOTA BANDA ACEH': { lat: 5.5530, lng: 95.3220, province: 'Aceh' },
  'KAB. ACEH BESAR': { lat: 5.3800, lng: 95.5200, province: 'Aceh' },
  'KOTA SABANG': { lat: 5.8900, lng: 95.3200, province: 'Aceh' },
  'KAB. PIDIE': { lat: 5.3800, lng: 95.9600, province: 'Aceh' },
  'KAB. PIDIE JAYA': { lat: 5.2500, lng: 96.2000, province: 'Aceh' },
  'KAB. BIREUEN': { lat: 5.2000, lng: 96.7000, province: 'Aceh' },
  'KOTA LHOKSEUMAWE': { lat: 5.1800, lng: 97.1400, province: 'Aceh' },
  'KAB. ACEH UTARA': { lat: 5.0000, lng: 97.2000, province: 'Aceh' },
  'KOTA LANGSA': { lat: 4.4700, lng: 97.9700, province: 'Aceh' },
  'KAB. ACEH TIMUR': { lat: 4.7800, lng: 97.6400, province: 'Aceh' },
  'KAB. ACEH TAMIANG': { lat: 4.2600, lng: 98.0500, province: 'Aceh' },
  'KAB. BENER MERIAH': { lat: 4.7300, lng: 96.8600, province: 'Aceh' },
  'KAB. ACEH TENGAH': { lat: 4.6300, lng: 96.8400, province: 'Aceh' },
  'KAB. GAYO LUES': { lat: 3.9600, lng: 97.3500, province: 'Aceh' },
  'KAB. ACEH TENGGARA': { lat: 3.4800, lng: 97.8000, province: 'Aceh' },
  'KAB. ACEH BARAT': { lat: 4.1400, lng: 96.1300, province: 'Aceh' },
  'KAB. NAGAN RAYA': { lat: 4.1600, lng: 96.3300, province: 'Aceh' },
  'KAB. ACEH JAYA': { lat: 4.6400, lng: 95.6500, province: 'Aceh' },
  'KAB. ACEH BARAT DAYA': { lat: 3.7500, lng: 96.8400, province: 'Aceh' },
  'KAB. ACEH SELATAN': { lat: 3.2500, lng: 97.1800, province: 'Aceh' },
  'KOTA SUBULUSSALAM': { lat: 2.6400, lng: 98.0000, province: 'Aceh' },
  'KAB. ACEH SINGKIL': { lat: 2.3300, lng: 97.8000, province: 'Aceh' },
  'KAB. SIMEULUE': { lat: 2.4800, lng: 96.3800, province: 'Aceh' },
  'KOTA SIBOLGA': { lat: 1.7420, lng: 98.7850, province: 'Sumatera Utara' },
  'KOTA PADANG': { lat: -0.9478, lng: 100.3685, province: 'Sumatera Barat' },
  'KOTA BUKITTINGGI': { lat: -0.3056, lng: 100.3692, province: 'Sumatera Barat' },
  'KOTA PARIAMAN': { lat: -0.6264, lng: 100.1220, province: 'Sumatera Barat' },
  'KAB. PADANG PARIAMAN': { lat: -0.6300, lng: 100.2700, province: 'Sumatera Barat' },
  'KOTA PEKANBARU': { lat: 0.5071, lng: 101.4478, province: 'Riau' },
  'KOTA DUMAI': { lat: 1.6667, lng: 101.4500, province: 'Riau' },
  'KOTA BATAM': { lat: 1.1301, lng: 104.0529, province: 'Kepulauan Riau' },
  'KOTA TANJUNG PINANG': { lat: 0.9167, lng: 104.4500, province: 'Kepulauan Riau' },
  'KOTA PALEMBANG': { lat: -2.9761, lng: 104.7754, province: 'Sumatera Selatan' },
  'KOTA PRABUMULIH': { lat: -3.4300, lng: 104.2300, province: 'Sumatera Selatan' },
  'KOTA JAMBI': { lat: -1.6101, lng: 103.6131, province: 'Jambi' },
  'KOTA BENGKULU': { lat: -3.7928, lng: 102.2680, province: 'Bengkulu' },
  'KOTA BANDAR LAMPUNG': { lat: -5.4500, lng: 105.2667, province: 'Lampung' },
  'KOTA METRO': { lat: -5.1139, lng: 105.3067, province: 'Lampung' },
  'KOTA PANGKAL PINANG': { lat: -2.1316, lng: 106.1115, province: 'Bangka Belitung' },

  // Bali, NTB, NTT
  'KOTA DENPASAR': { lat: -8.6705, lng: 115.2126, province: 'Bali' },
  'KAB. BADUNG': { lat: -8.5800, lng: 115.1800, province: 'Bali' },
  'KAB. GIANYAR': { lat: -8.5400, lng: 115.3300, province: 'Bali' },
  'KAB. TABANAN': { lat: -8.5400, lng: 115.1200, province: 'Bali' },
  'KAB. BULELENG': { lat: -8.1120, lng: 115.0882, province: 'Bali' },
  'KOTA MATARAM': { lat: -8.5833, lng: 116.1167, province: 'Nusa Tenggara Barat' },
  'KOTA BIMA': { lat: -8.4600, lng: 118.7300, province: 'Nusa Tenggara Barat' },
  'KOTA KUPANG': { lat: -10.1772, lng: 123.6070, province: 'Nusa Tenggara Timur' },
  'KAB. MANGGARAI BARAT': { lat: -8.5069, lng: 119.8878, province: 'Nusa Tenggara Timur' },

  // Kalimantan
  'KOTA BANJARMASIN': { lat: -3.3167, lng: 114.5900, province: 'Kalimantan Selatan' },
  'KOTA BANJARBARU': { lat: -3.4400, lng: 114.8300, province: 'Kalimantan Selatan' },
  'KOTA BALIKPAPAN': { lat: -1.2580, lng: 116.8350, province: 'Kalimantan Timur' },
  'KOTA SAMARINDA': { lat: -0.5022, lng: 117.1536, province: 'Kalimantan Timur' },
  'KOTA BONTANG': { lat: 0.1333, lng: 117.5000, province: 'Kalimantan Timur' },
  'KOTA PONTIANAK': { lat: -0.0263, lng: 109.3425, province: 'Kalimantan Barat' },
  'KOTA SINGKAWANG': { lat: 0.9083, lng: 108.9872, province: 'Kalimantan Barat' },
  'KOTA PALANGKA RAYA': { lat: -2.2100, lng: 113.9213, province: 'Kalimantan Tengah' },
  'KOTA TARAKAN': { lat: 3.3276, lng: 117.5925, province: 'Kalimantan Utara' },

  // Sulawesi
  'KOTA MAKASSAR': { lat: -5.1477, lng: 119.4327, province: 'Sulawesi Selatan' },
  'KOTA PAREPARE': { lat: -4.0100, lng: 119.6200, province: 'Sulawesi Selatan' },
  'KOTA PALOPO': { lat: -2.9900, lng: 120.1900, province: 'Sulawesi Selatan' },
  'KOTA MANADO': { lat: 1.4748, lng: 124.8421, province: 'Sulawesi Utara' },
  'KOTA BITUNG': { lat: 1.4400, lng: 125.1900, province: 'Sulawesi Utara' },
  'KOTA TOMOHON': { lat: 1.3200, lng: 124.8400, province: 'Sulawesi Utara' },
  'KOTA PALU': { lat: -0.9003, lng: 119.8779, province: 'Sulawesi Tengah' },
  'KOTA KENDARI': { lat: -3.9985, lng: 122.5126, province: 'Sulawesi Tenggara' },
  'KOTA BAUBAU': { lat: -5.4600, lng: 122.6100, province: 'Sulawesi Tenggara' },
  'KOTA GORONTALO': { lat: 0.5435, lng: 123.0568, province: 'Gorontalo' },

  // Maluku & Papua
  'KOTA AMBON': { lat: -3.6954, lng: 128.1814, province: 'Maluku' },
  'KOTA TERNATE': { lat: 0.7900, lng: 127.3800, province: 'Maluku Utara' },
  'KOTA JAYAPURA': { lat: -2.5380, lng: 140.7020, province: 'Papua' },
  'KOTA SORONG': { lat: -0.8800, lng: 131.2500, province: 'Papua Barat Daya' },
};

// 4. Centroids for BNI Wilayah Codes (Fallback)
const WILAYAH_CENTROID_MAP: Record<string, { lat: number; lng: number; regionName: string }> = {
  'W01': { lat: 3.5952, lng: 98.6722, regionName: 'Sumatera Bagian Utara (Medan)' },
  'W02': { lat: 0.5071, lng: 101.4478, regionName: 'Riau & Kepri (Padang / Pekanbaru)' },
  'W03': { lat: -2.9761, lng: 104.7754, regionName: 'Sumatera Bagian Selatan (Palembang)' },
  'W04': { lat: -6.9175, lng: 107.6191, regionName: 'Jawa Barat (Bandung)' },
  'W05': { lat: -6.9667, lng: 110.4167, regionName: 'Jawa Tengah & DIY (Semarang)' },
  'W06': { lat: -7.2575, lng: 112.7521, regionName: 'Jawa Timur (Surabaya)' },
  'W07': { lat: -5.1477, lng: 119.4327, regionName: 'Sulawesi Selatan & Tenggara (Makassar)' },
  'W08': { lat: -8.6705, lng: 115.2126, regionName: 'Bali, NTB & NTT (Denpasar)' },
  'W09': { lat: -3.3167, lng: 114.5900, regionName: 'Kalimantan (Banjarmasin)' },
  'W10': { lat: -6.1818, lng: 106.8340, regionName: 'DKI Jakarta (Senayan / Jakarta)' },
  'W11': { lat: 1.4748, lng: 124.8421, regionName: 'Sulawesi Utara & Maluku (Manado)' },
  'W12': { lat: -6.2383, lng: 106.9756, regionName: 'Jakarta Kota / Bekasi' },
  'W14': { lat: -6.2088, lng: 106.6381, regionName: 'Jakarta Barat / Tangerang' },
  'W15': { lat: -6.2615, lng: 106.8106, regionName: 'Jakarta Selatan' },
  'W16': { lat: -2.5380, lng: 140.7020, regionName: 'Papua (Jayapura)' },
  'W17': { lat: -7.7956, lng: 110.3695, regionName: 'Yogyakarta' },
  'W18': { lat: -7.9797, lng: 112.6304, regionName: 'Malang' },
};

/**
 * Normalizes Dati II string (e.g., "KOTA JAKARTA SELATAN" -> "JAKARTA SELATAN")
 */
function cleanDati2(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .toUpperCase()
    .replace(/^KOTA\s+ADM\.?\s*/i, 'KOTA ')
    .replace(/^KABUPATEN\s+/i, 'KAB. ')
    .trim();
}

// Padang Districts accurate inland coordinates (firmly inland, never in ocean)
const KECAMATAN_PADANG_MAP: Record<string, { lat: number; lng: number }> = {
  'PADANG BARAT': { lat: -0.9450, lng: 100.3595 },
  'PADANG TIMUR': { lat: -0.9452, lng: 100.3780 },
  'PADANG UTARA': { lat: -0.9150, lng: 100.3620 },
  'PADANG SELATAN': { lat: -0.9650, lng: 100.3700 },
  'KURANJI': { lat: -0.9250, lng: 100.4050 },
  'NANGGALO': { lat: -0.9080, lng: 100.3750 },
  'LUBUK BEGALUNG': { lat: -0.9780, lng: 100.3950 },
  'LUBUK KILANGAN': { lat: -0.9650, lng: 100.4400 },
  'PAUH': { lat: -0.9250, lng: 100.4450 },
  'KOTO TANGAH': { lat: -0.8350, lng: 100.3650 },
  'BUNGUS TELUK KABUNG': { lat: -1.0450, lng: 100.4000 },
};


export function extractWCode(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/(?:W(?:ILAYAH)?\s*|W)(\d{1,2})/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return `W${num < 10 ? '0' + num : num}`;
  }
  const pureNum = parseInt(raw, 10);
  if (!isNaN(pureNum) && pureNum >= 1 && pureNum <= 18) {
    return `W${pureNum < 10 ? '0' + pureNum : pureNum}`;
  }
  return '';
}

/**
 * Strict Inland Protection: Prevents any coordinates from falling into oceans, bays, or straits.
 * Enforces land boundaries across all major coastal cities in Indonesia (Jayapura, Padang, Semarang, Surabaya, etc.)
 */
export function clampToInland(lat: number, lng: number): [number, number] {
  let cLat = lat;
  let cLng = lng;

  // 1. Jayapura / Teluk Yos Sudarso:
  // Water is east of lng 140.7035 between lat -2.570 and -2.510.
  if (cLat >= -2.570 && cLat <= -2.510 && cLng > 140.7035) {
    cLng = 140.7015; // Kept strictly inland on town corridor (Jl. Argapura / Jl. Koti)
  }
  // Hamadi / Tobati bay area:
  if (cLat >= -2.610 && cLat < -2.570 && cLng > 140.6970) {
    cLng = 140.6920; // Kept inland (Entrop / Vim)
  }

  // 2. Padang:
  // Shoreline at lng ~ 100.354. Water is west of lng 100.358.
  if (cLat >= -1.15 && cLat <= -0.75 && cLng < 100.3595) {
    cLng = 100.3605; // Kept strictly inland eastward
  }

  // 3. Semarang:
  // Water is north of lat -6.958 between lng 110.35 and 110.48.
  if (cLat > -6.958 && cLng >= 110.35 && cLng <= 110.48) {
    cLat = -6.968; // Kept strictly inland southward
  }

  // 4. Surabaya:
  // North water: lat > -7.198. East water (Madura Strait): lng > 112.795.
  if (cLat > -7.198 && cLng >= 112.65 && cLng <= 112.80) {
    cLat = -7.215;
  }
  if (cLng > 112.795 && cLat >= -7.33 && cLat <= -7.18) {
    cLng = 112.785;
  }

  // 5. Balikpapan:
  // South water: lat < -1.260. East water: lng > 116.885.
  if (cLat < -1.260 && cLng >= 116.80 && cLng <= 116.92) {
    cLat = -1.255;
  }
  if (cLng > 116.885 && cLat >= -1.27 && cLat <= -1.15) {
    cLng = 116.875;
  }

  // 6. Makassar:
  // Water to the west (lng < 119.408).
  if (cLng < 119.408 && cLat >= -5.20 && cLat <= -5.08) {
    cLng = 119.418;
  }

  // 7. Banda Aceh:
  // Water to the north (lat > 5.575) - excludes Pulau Weh (lat > 5.80)
  if (cLat > 5.575 && cLat < 5.80 && cLng >= 95.25 && cLng <= 95.38) {
    cLat = 5.560;
  }

  // 8. Manado:
  // Water to the west (lng < 124.834).
  if (cLng < 124.834 && cLat >= 1.44 && cLat <= 1.52) {
    cLng = 124.842;
  }

  // 9. Kupang:
  // Water to the northwest (lat > -10.158).
  if (cLat > -10.158 && cLng >= 123.55 && cLng <= 123.65) {
    cLat = -10.170;
  }

  // 10. Sibolga:
  // Water to the west (lng < 98.780).
  if (cLng < 98.780 && cLat >= 1.70 && cLat <= 1.78) {
    cLng = 98.788;
  }

  // 11. Bengkulu:
  // Water to the southwest (lng < 102.260).
  if (cLng < 102.260 && cLat >= -3.85 && cLat <= -3.75) {
    cLng = 102.270;
  }

  return [Number(cLat.toFixed(6)), Number(cLng.toFixed(6))];
}

export const CITY_DISTRICTS_MAP: Record<string, { lat: number; lng: number; city: string; province: string }> = {
  // Jayapura (Papua) - Strictly on real town / commercial districts on land
  'JAYAPURA UTARA': { lat: -2.5330, lng: 140.7020, city: 'Jayapura', province: 'Papua' },
  'GURABESI': { lat: -2.5350, lng: 140.7020, city: 'Jayapura', province: 'Papua' },
  'MANDALA': { lat: -2.5340, lng: 140.7025, city: 'Jayapura', province: 'Papua' },
  'DOK': { lat: -2.5250, lng: 140.7020, city: 'Jayapura', province: 'Papua' },
  'JAYAPURA SELATAN': { lat: -2.5600, lng: 140.6880, city: 'Jayapura', province: 'Papua' },
  'ARGAPURA': { lat: -2.5515, lng: 140.7015, city: 'Jayapura', province: 'Papua' },
  'KOTI': { lat: -2.5450, lng: 140.7015, city: 'Jayapura', province: 'Papua' },
  'WEREF': { lat: -2.5420, lng: 140.7015, city: 'Jayapura', province: 'Papua' },
  'POLIMAK': { lat: -2.5450, lng: 140.6920, city: 'Jayapura', province: 'Papua' },
  'ENTROP': { lat: -2.5680, lng: 140.6850, city: 'Jayapura', province: 'Papua' },
  'HAMADI': { lat: -2.5580, lng: 140.6940, city: 'Jayapura', province: 'Papua' },
  'ABEPURA': { lat: -2.6010, lng: 140.6720, city: 'Jayapura', province: 'Papua' },
  'KOTARAJA': { lat: -2.5950, lng: 140.6750, city: 'Jayapura', province: 'Papua' },
  'VIM': { lat: -2.6040, lng: 140.6680, city: 'Jayapura', province: 'Papua' },
  'WAENA': { lat: -2.5850, lng: 140.6250, city: 'Jayapura', province: 'Papua' },
  'HERAM': { lat: -2.5850, lng: 140.6250, city: 'Jayapura', province: 'Papua' },
  'SENTANI': { lat: -2.5600, lng: 140.5150, city: 'Jayapura', province: 'Papua' },
  'MUARA TAMI': { lat: -2.6350, lng: 140.8250, city: 'Jayapura', province: 'Papua' },
  'JAYAPURA': { lat: -2.5380, lng: 140.7020, city: 'Jayapura', province: 'Papua' },

  // Surabaya (Jawa Timur)
  'GENTENG': { lat: -7.2600, lng: 112.7450, city: 'Surabaya', province: 'Jawa Timur' },
  'TEGALSARI': { lat: -7.2700, lng: 112.7380, city: 'Surabaya', province: 'Jawa Timur' },
  'GUBENG': { lat: -7.2750, lng: 112.7550, city: 'Surabaya', province: 'Jawa Timur' },
  'WONOKROMO': { lat: -7.3000, lng: 112.7350, city: 'Surabaya', province: 'Jawa Timur' },
  'RUNGKUT': { lat: -7.3200, lng: 112.7700, city: 'Surabaya', province: 'Jawa Timur' },
  'TANDES': { lat: -7.2600, lng: 112.6800, city: 'Surabaya', province: 'Jawa Timur' },

  // Semarang (Jawa Tengah)
  'SEMARANG TENGAH': { lat: -6.9800, lng: 110.4200, city: 'Semarang', province: 'Jawa Tengah' },
  'SEMARANG SELATAN': { lat: -7.0000, lng: 110.4250, city: 'Semarang', province: 'Jawa Tengah' },
  'SEMARANG BARAT': { lat: -6.9900, lng: 110.3900, city: 'Semarang', province: 'Jawa Tengah' },
  'BANYUMANIK': { lat: -7.0600, lng: 110.4200, city: 'Semarang', province: 'Jawa Tengah' },
  'CANDISARI': { lat: -7.0150, lng: 110.4250, city: 'Semarang', province: 'Jawa Tengah' },

  // Makassar (Sulawesi Selatan)
  'PANAKKUKANG': { lat: -5.1450, lng: 119.4500, city: 'Makassar', province: 'Sulawesi Selatan' },
  'RAPPOCINI': { lat: -5.1650, lng: 119.4400, city: 'Makassar', province: 'Sulawesi Selatan' },
  'TAMALANREA': { lat: -5.1350, lng: 119.4900, city: 'Makassar', province: 'Sulawesi Selatan' },
  'UJUNG PANDANG': { lat: -5.1350, lng: 119.4120, city: 'Makassar', province: 'Sulawesi Selatan' },

  // Medan (Sumatera Utara)
  'MEDAN KOTA': { lat: 3.5780, lng: 98.6850, city: 'Medan', province: 'Sumatera Utara' },
  'MEDAN BARU': { lat: 3.5700, lng: 98.6550, city: 'Medan', province: 'Sumatera Utara' },
  'MEDAN PETISAH': { lat: 3.5900, lng: 98.6650, city: 'Medan', province: 'Sumatera Utara' },
  'MEDAN BARAT': { lat: 3.6050, lng: 98.6700, city: 'Medan', province: 'Sumatera Utara' },
  'MEDAN DELI': { lat: 3.6550, lng: 98.6800, city: 'Medan', province: 'Sumatera Utara' },

  // Balikpapan (Kalimantan Timur)
  'BALIKPAPAN KOTA': { lat: -1.2600, lng: 116.8350, city: 'Balikpapan', province: 'Kalimantan Timur' },
  'BALIKPAPAN SELATAN': { lat: -1.2500, lng: 116.8650, city: 'Balikpapan', province: 'Kalimantan Timur' },
  'BALIKPAPAN UTARA': { lat: -1.2100, lng: 116.8600, city: 'Balikpapan', province: 'Kalimantan Timur' },

  // Manado (Sulawesi Utara)
  'WENANG': { lat: 1.4850, lng: 124.8450, city: 'Manado', province: 'Sulawesi Utara' },
  'WANEA': { lat: 1.4650, lng: 124.8450, city: 'Manado', province: 'Sulawesi Utara' },
  'MALALAYANG': { lat: 1.4550, lng: 124.8380, city: 'Manado', province: 'Sulawesi Utara' },

  // Banda Aceh (Aceh)
  'BAITURRAHMAN': { lat: 5.5500, lng: 95.3200, city: 'Banda Aceh', province: 'Aceh' },
  'KUTA ALAM': { lat: 5.5600, lng: 95.3350, city: 'Banda Aceh', province: 'Aceh' },
  'SYIAH KUALA': { lat: 5.5700, lng: 95.3500, city: 'Banda Aceh', province: 'Aceh' },
  'ULEE KARENG': { lat: 5.5450, lng: 95.3550, city: 'Banda Aceh', province: 'Aceh' },
};

/**
 * Resolves accurate coordinates for a MasterRow based on Kode Pos, Dati II, and Wilayah
 */
export function resolveBranchCoordinates(row: MasterRow): GeoLocation {
  const rawKodePos = String(row['KODE POS'] || '').replace(/\D/g, '').trim();
  const rawDati2 = cleanDati2(row['Dati II'] || row['Kode Dati II'] || '');
  const rawWilayah = String(row.Wilayah || '').toUpperCase().trim();
  const rawKecamatan = String(row.Kecamatan || '').toUpperCase().trim();
  const rawKelurahan = String(row.Kelurahan || '').toUpperCase().trim();
  const rawAlamat = String(row.ALAMAT || '').toUpperCase().trim();
  const rawNama = String(row['Nama Outlet'] || '').toUpperCase().trim();
  const fullText = `${rawNama} ${rawKelurahan} ${rawKecamatan} ${rawAlamat} ${rawDati2}`;

  // 1. High-accuracy real district matching across major Indonesian cities (Jayapura, Padang, Medan, etc.)
  for (const [districtKey, distData] of Object.entries(CITY_DISTRICTS_MAP)) {
    if (fullText.includes(districtKey)) {
      const [cLat, cLng] = clampToInland(distData.lat, distData.lng);
      return {
        lat: cLat,
        lng: cLng,
        city: distData.city,
        province: distData.province,
        source: 'district_map',
      };
    }
  }

  // 2. Padang district fallback
  const isPadangArea =
    rawDati2.includes('PADANG') ||
    rawKodePos.startsWith('25') ||
    fullText.includes('PADANG');

  if (isPadangArea) {
    for (const [kec, coords] of Object.entries(KECAMATAN_PADANG_MAP)) {
      if (fullText.includes(kec)) {
        const [cLat, cLng] = clampToInland(coords.lat, coords.lng);
        return {
          lat: cLat,
          lng: cLng,
          city: 'Padang',
          province: 'Sumatera Barat',
          source: 'dati2',
        };
      }
    }
  }

  // 3. Try exact or 2-digit postal prefix
  if (rawKodePos.length >= 2) {
    const p2 = rawKodePos.slice(0, 2);
    if (POSTAL_PREFIX_MAP[p2]) {
      const base = POSTAL_PREFIX_MAP[p2];
      const [cLat, cLng] = clampToInland(base.lat, base.lng);
      return {
        lat: cLat,
        lng: cLng,
        city: base.city,
        province: base.province,
        source: 'postal_prefix',
      };
    }
  }

  // 4. Try Dati II / Kota lookup
  if (rawDati2) {
    if (DATI2_MAP[rawDati2]) {
      const d = DATI2_MAP[rawDati2];
      const [cLat, cLng] = clampToInland(d.lat, d.lng);
      return {
        lat: cLat,
        lng: cLng,
        city: rawDati2,
        province: d.province,
        source: 'dati2',
      };
    }
    // Substring search in DATI2_MAP
    for (const [key, d] of Object.entries(DATI2_MAP)) {
      if (rawDati2.includes(key) || key.includes(rawDati2)) {
        const [cLat, cLng] = clampToInland(d.lat, d.lng);
        return {
          lat: cLat,
          lng: cLng,
          city: key,
          province: d.province,
          source: 'dati2',
        };
      }
    }
  }

  // 5. Fallback to Wilayah Centroid
  const wCode = extractWCode(rawWilayah);
  if (wCode && WILAYAH_CENTROID_MAP[wCode]) {
    const w = WILAYAH_CENTROID_MAP[wCode];
    const [cLat, cLng] = clampToInland(w.lat, w.lng);
    return {
      lat: cLat,
      lng: cLng,
      city: w.regionName,
      source: 'wilayah_centroid',
    };
  }

  // 6. Default fallback: Monas Jakarta
  const [cLat, cLng] = clampToInland(-6.1754, 106.8272);
  return {
    lat: cLat,
    lng: cLng,
    city: 'Jakarta Pusat',
    province: 'DKI Jakarta',
    source: 'wilayah_centroid',
  };
}

/**
 * Groups master rows by location/postal code to avoid overlapping pins
 * and calculate multi-branch spots.
 */
export function clusterMasterRowsForMap(
  masterRows: MasterRow[],
  selectedWilayah: string = 'ALL',
  targetRows: TargetRow[] = []
): PlottedBranchPin[] {
  // Build fast indexes of target rows for 0ms lookup
  const sandiMatchMap = new Map<string, { matched: number; total: number }>();
  const kpMatchMap = new Map<string, { matched: number; total: number }>();

  if (targetRows && targetRows.length > 0) {
    for (const t of targetRows) {
      const isMatched = !!t._isMatched;
      const s = String(t['Sandi Cabang'] || t.Sandi || t.Cabang || '').trim();
      const kp = String(t['KODE POS'] || '').replace(/\D/g, '').trim();

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

  // Filter by Wilayah if specified with extractWCode and formatWilayahName normalization
  const filtered = selectedWilayah === 'ALL'
    ? masterRows
    : masterRows.filter((r) => {
        const rowCode = extractWCode(r.Wilayah || '');
        const selCode = extractWCode(selectedWilayah || '');
        if (rowCode && selCode && rowCode === selCode) return true;

        const rowNorm = formatWilayahName(r.Wilayah || '').toUpperCase();
        const selNorm = formatWilayahName(selectedWilayah || '').toUpperCase();
        if (rowNorm && selNorm && rowNorm === selNorm) return true;

        const rowW = String(r.Wilayah || '').trim().toUpperCase();
        const selW = String(selectedWilayah || '').trim().toUpperCase();
        return rowW === selW || rowW.startsWith(selW) || selW.startsWith(rowW);
      });

  // Group by (cleaned Kode Pos + Dati II) or fallback key
  const groups = new Map<string, MasterRow[]>();

  for (const row of filtered) {
    const kp = String(row['KODE POS'] || '').replace(/\D/g, '').trim();
    const d2 = cleanDati2(row['Dati II'] || '');
    const w = String(row.Wilayah || '').trim();
    
    // Group key: exact postal code if >= 5 digits, else Dati II + Wilayah
    const groupKey = kp.length >= 5 ? `KP_${kp}` : (d2 ? `D2_${d2}` : `W_${w}_${row['Nama Outlet']}`);
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(row);
  }

  const pins: PlottedBranchPin[] = [];

  groups.forEach((branches, key) => {
    if (branches.length === 0) return;
    const first = branches[0];
    const coords = resolveBranchCoordinates(first);
    const kp = String(first['KODE POS'] || '').replace(/\D/g, '').trim();

    // Compute matched target records associated with this pin
    let matchedCount = 0;
    let totalTargetCount = 0;

    for (const b of branches) {
      const s = String(b['Sandi Cabang'] || b.Sandi || b['Kode Cabang'] || '').trim();
      if (s && sandiMatchMap.has(s)) {
        const st = sandiMatchMap.get(s)!;
        matchedCount += st.matched;
        totalTargetCount += st.total;
      }
    }

    if (matchedCount === 0 && kp && kpMatchMap.has(kp)) {
      const kt = kpMatchMap.get(kp)!;
      matchedCount += kt.matched;
      totalTargetCount += kt.total;
    }

    const branchCount = branches.length;
    const baseLat = coords.lat;
    const baseLng = coords.lng;

    pins.push({
      id: `pin_${key}_${first['Sandi Cabang'] || first.Sandi || first['Kode Cabang'] || Math.random().toString(36).slice(2, 7)}`,
      lat: baseLat,
      lng: baseLng,
      kodePos: String(first['KODE POS'] || '-'),
      dati2: String(first['Dati II'] || coords.city || '-'),
      wilayah: String(first.Wilayah || '-'),
      branches,
      branchCount,
      primaryOutletName: first['Nama Outlet'] || 'Outlet BNI',
      alamatDisplay: first.ALAMAT || `${first.Kecamatan || ''}, ${first['Dati II'] || ''}`,
      matchedCount,
      totalTargetCount,
    });
  });

  return pins;
}

/**
 * Resolves coordinates for a TargetRow
 */
export function resolveTargetRowCoordinates(row: TargetRow): GeoLocation {
  const pseudoMaster: MasterRow = {
    Wilayah: String(row.Wilayah || ''),
    'Branch Code': String(row['Branch Code'] || row['Kode Cabang'] || ''),
    'Kode Cabang': String(row['Kode Cabang'] || ''),
    'Nama Outlet': String(row['Nama Outlet'] || ''),
    'Status Outlet': String(row['Status Outlet'] || ''),
    ALAMAT: String(row.ALAMAT || ''),
    'KODE POS': String(row['KODE POS'] || ''),
    Kelurahan: String(row.Kelurahan || ''),
    Kecamatan: String(row.Kecamatan || ''),
    'Dati II': String(row['Dati II'] || ''),
    'Kode Dati II': String(row['Kode Dati II'] || ''),
    Provinsi: String(row.Provinsi || ''),
    Telp: '',
  };
  return resolveBranchCoordinates(pseudoMaster);
}

/**
 * Computes sampled points along a quadratic Bezier curve to render
 * smooth, realistic arc trajectories between source data and matched destination branch.
 */
export function createCurvedArcPoints(
  start: [number, number],
  end: [number, number],
  curveOffset: number = 0.15,
  numPoints: number = 24
): [number, number][] {
  const [lat1, lng1] = clampToInland(start[0], start[1]);
  const [lat2, lng2] = clampToInland(end[0], end[1]);

  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);

  // If distance is zero or negligible (on-site record), do NOT create circular loops into water
  if (dist < 0.0005) {
    return [];
  }

  // Normal vector perpendicular to chord
  const normLat = -dLng / dist;
  const normLng = dLat / dist;

  const arcHeight = Math.max(dist * curveOffset, 0.004);
  let controlLat = midLat + normLat * arcHeight;
  let controlLng = midLng + normLng * arcHeight;

  // Test whether control point bows toward water; if so, flip normal vector to bend inland!
  const [clampedLat, clampedLng] = clampToInland(controlLat, controlLng);
  if (clampedLat !== controlLat || clampedLng !== controlLng) {
    controlLng = midLng - normLng * arcHeight;
    controlLat = midLat - normLat * arcHeight;
  }
  [controlLat, controlLng] = clampToInland(controlLat, controlLng);

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const oneMinusT = 1 - t;
    const lat = oneMinusT * oneMinusT * lat1 + 2 * oneMinusT * t * controlLat + t * t * lat2;
    const lng = oneMinusT * oneMinusT * lng1 + 2 * oneMinusT * t * controlLng + t * t * lng2;
    points.push(clampToInland(lat, lng));
  }

  return points;
}

export interface ForeignLandMask {
  name: string;
  coords: [number, number][];
}

export const FOREIGN_LAND_MASKS: ForeignLandMask[] = [
  // 1. Peninsular Malaysia, Singapore & Southern Thailand
  {
    name: 'Malaysia Barat & Singapura',
    coords: [
      [1.24, 103.40],
      [1.32, 103.62],
      [1.48, 104.05],
      [1.75, 104.35],
      [6.80, 102.30],
      [7.20, 100.20],
      [6.50, 99.50],
      [3.00, 101.00],
      [1.50, 102.90],
      [1.24, 103.40],
    ],
  },
  // 2. Sarawak, Sabah & Brunei (Malaysia Timur)
  {
    name: 'Malaysia Timur (Sarawak, Sabah) & Brunei',
    coords: [
      [2.08, 109.64],
      [1.75, 110.35],
      [1.20, 110.80],
      [0.90, 111.70],
      [1.30, 112.50],
      [1.80, 113.80],
      [2.50, 115.00],
      [4.18, 115.60],
      [4.18, 117.65],
      [4.60, 118.50],
      [5.50, 119.00],
      [7.40, 117.30],
      [6.00, 115.50],
      [4.90, 114.80],
      [4.50, 114.00],
      [3.20, 113.00],
      [2.08, 109.64],
    ],
  },
  // 3. Papua New Guinea (East of 141° E)
  {
    name: 'Papua New Guinea',
    coords: [
      [-2.50, 141.02],
      [-2.50, 155.00],
      [-12.00, 155.00],
      [-12.00, 141.02],
      [-9.15, 141.02],
      [-6.90, 141.25],
      [-6.00, 141.02],
      [-2.50, 141.02],
    ],
  },
  // 4. Australia (Darwin / Northern Territory / Cocos)
  {
    name: 'Australia & Samudra Selatan',
    coords: [
      [-11.60, 110.00],
      [-11.60, 143.00],
      [-25.00, 143.00],
      [-25.00, 110.00],
      [-11.60, 110.00],
    ],
  },
  // 5. Philippines (Mindanao & Kepulauan Sulu)
  {
    name: 'Filipina (Mindanao & Kepulauan Sulu)',
    coords: [
      [5.80, 119.50],
      [10.00, 119.50],
      [10.00, 127.50],
      [5.80, 127.50],
      [5.80, 119.50],
    ],
  },
  // 6. Timor-Leste
  {
    name: 'Timor-Leste',
    coords: [
      [-8.30, 125.05],
      [-8.30, 127.40],
      [-9.35, 127.40],
      [-9.35, 125.05],
      [-8.30, 125.05],
    ],
  },
];
