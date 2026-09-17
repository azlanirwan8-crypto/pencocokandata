export interface KodePosRecord {
  id?: string;
  kodePos: string;
  kelurahan: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi: string;
  status: 'AKTIF' | 'NON-AKTIF';
}

export const DEFAULT_KODEPOS_DATA: KodePosRecord[] = [
  // DKI JAKARTA - JAKARTA PUSAT
  { kodePos: '10110', kelurahan: 'Gambir', kecamatan: 'Gambir', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10120', kelurahan: 'Kebon Kelapa', kecamatan: 'Gambir', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10130', kelurahan: 'Petojo Utara', kecamatan: 'Gambir', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10140', kelurahan: 'Duri Pulo', kecamatan: 'Gambir', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10150', kelurahan: 'Cideng', kecamatan: 'Gambir', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10160', kelurahan: 'Petojo Selatan', kecamatan: 'Gambir', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10210', kelurahan: 'Bendungan Hilir', kecamatan: 'Tanah Abang', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10220', kelurahan: 'Karet Tengsin', kecamatan: 'Tanah Abang', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10230', kelurahan: 'Kebon Melati', kecamatan: 'Tanah Abang', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10240', kelurahan: 'Kebon Kacang', kecamatan: 'Tanah Abang', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10250', kelurahan: 'Kampung Bali', kecamatan: 'Tanah Abang', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10270', kelurahan: 'Gelora', kecamatan: 'Tanah Abang', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10310', kelurahan: 'Menteng', kecamatan: 'Menteng', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10320', kelurahan: 'Pegangsaan', kecamatan: 'Menteng', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10330', kelurahan: 'Cikini', kecamatan: 'Menteng', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10340', kelurahan: 'Kebon Sirih', kecamatan: 'Menteng', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10350', kelurahan: 'Gondangdia', kecamatan: 'Menteng', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10410', kelurahan: 'Senen', kecamatan: 'Senen', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10420', kelurahan: 'Kwitang', kecamatan: 'Senen', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10430', kelurahan: 'Kenari', kecamatan: 'Senen', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10440', kelurahan: 'Paseban', kecamatan: 'Senen', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10450', kelurahan: 'Kramat', kecamatan: 'Senen', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10460', kelurahan: 'Bungur', kecamatan: 'Senen', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10510', kelurahan: 'Cempaka Putih Timur', kecamatan: 'Cempaka Putih', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10520', kelurahan: 'Cempaka Putih Barat', kecamatan: 'Cempaka Putih', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10530', kelurahan: 'Rawasari', kecamatan: 'Cempaka Putih', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10610', kelurahan: 'Kemayoran', kecamatan: 'Kemayoran', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10620', kelurahan: 'Gunung Sahari Selatan', kecamatan: 'Kemayoran', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10630', kelurahan: 'Kebon Kosong', kecamatan: 'Kemayoran', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10640', kelurahan: 'Harapan Mulya', kecamatan: 'Kemayoran', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10650', kelurahan: 'Cempaka Baru', kecamatan: 'Kemayoran', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10710', kelurahan: 'Pasar Baru', kecamatan: 'Sawah Besar', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10720', kelurahan: 'Gunung Sahari Utara', kecamatan: 'Sawah Besar', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10730', kelurahan: 'Mangga Dua Selatan', kecamatan: 'Sawah Besar', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10740', kelurahan: 'Karang Anyar', kecamatan: 'Sawah Besar', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '10750', kelurahan: 'Kartini', kecamatan: 'Sawah Besar', kabupatenKota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta', status: 'AKTIF' },

  // DKI JAKARTA - JAKARTA SELATAN
  { kodePos: '12110', kelurahan: 'Selong', kecamatan: 'Kebayoran Baru', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12120', kelurahan: 'Gunung', kecamatan: 'Kebayoran Baru', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12130', kelurahan: 'Kramat Pela', kecamatan: 'Kebayoran Baru', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12140', kelurahan: 'Gandaria Utara', kecamatan: 'Kebayoran Baru', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12150', kelurahan: 'Cipete Utara', kecamatan: 'Kebayoran Baru', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12160', kelurahan: 'Pulo', kecamatan: 'Kebayoran Baru', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12170', kelurahan: 'Petogogan', kecamatan: 'Kebayoran Baru', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12180', kelurahan: 'Rawa Barat', kecamatan: 'Kebayoran Baru', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12190', kelurahan: 'Senayan', kecamatan: 'Kebayoran Baru', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12910', kelurahan: 'Karet Semanggi', kecamatan: 'Setiabudi', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12920', kelurahan: 'Karet Kuningan', kecamatan: 'Setiabudi', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12930', kelurahan: 'Karet', kecamatan: 'Setiabudi', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12940', kelurahan: 'Menteng Atas', kecamatan: 'Setiabudi', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12950', kelurahan: 'Pasar Manggis', kecamatan: 'Setiabudi', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '12960', kelurahan: 'Guntur', kecamatan: 'Setiabudi', kabupatenKota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta', status: 'AKTIF' },

  // DKI JAKARTA - JAKARTA BARAT
  { kodePos: '11110', kelurahan: 'Pinangsia', kecamatan: 'Taman Sari', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11120', kelurahan: 'Glodok', kecamatan: 'Taman Sari', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11130', kelurahan: 'Keagungan', kecamatan: 'Taman Sari', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11140', kelurahan: 'Krukut', kecamatan: 'Taman Sari', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11150', kelurahan: 'Taman Sari', kecamatan: 'Taman Sari', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11160', kelurahan: 'Maphar', kecamatan: 'Taman Sari', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11170', kelurahan: 'Tangki', kecamatan: 'Taman Sari', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11180', kelurahan: 'Mangga Besar', kecamatan: 'Taman Sari', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11210', kelurahan: 'Tanah Sereal', kecamatan: 'Tambora', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11220', kelurahan: 'Tambora', kecamatan: 'Tambora', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11230', kelurahan: 'Roa Malaka', kecamatan: 'Tambora', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11240', kelurahan: 'Pekojan', kecamatan: 'Tambora', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11250', kelurahan: 'Jembatan Lima', kecamatan: 'Tambora', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11470', kelurahan: 'Tanjung Duren Utara', kecamatan: 'Grogol Petamburan', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '11480', kelurahan: 'Kemanggisan', kecamatan: 'Palmerah', kabupatenKota: 'Kota Jakarta Barat', provinsi: 'DKI Jakarta', status: 'AKTIF' },

  // DKI JAKARTA - JAKARTA TIMUR & UTARA
  { kodePos: '13310', kelurahan: 'Bidara Cina', kecamatan: 'Jatinegara', kabupatenKota: 'Kota Jakarta Timur', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '13320', kelurahan: 'Kampung Melayu', kecamatan: 'Jatinegara', kabupatenKota: 'Kota Jakarta Timur', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '13330', kelurahan: 'Bali Mester', kecamatan: 'Jatinegara', kabupatenKota: 'Kota Jakarta Timur', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '13340', kelurahan: 'Rawa Bunga', kecamatan: 'Jatinegara', kabupatenKota: 'Kota Jakarta Timur', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '13350', kelurahan: 'Cipinang Cempedak', kecamatan: 'Jatinegara', kabupatenKota: 'Kota Jakarta Timur', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '13220', kelurahan: 'Rawamangun', kecamatan: 'Pulo Gadung', kabupatenKota: 'Kota Jakarta Timur', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '14240', kelurahan: 'Kelapa Gading Barat', kecamatan: 'Kelapa Gading', kabupatenKota: 'Kota Jakarta Utara', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '14250', kelurahan: 'Pegangsaan Dua', kecamatan: 'Kelapa Gading', kabupatenKota: 'Kota Jakarta Utara', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '14310', kelurahan: 'Sunter Agung', kecamatan: 'Tanjung Priok', kabupatenKota: 'Kota Jakarta Utara', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '14320', kelurahan: 'Sunter Jaya', kecamatan: 'Tanjung Priok', kabupatenKota: 'Kota Jakarta Utara', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '14330', kelurahan: 'Papanggo', kecamatan: 'Tanjung Priok', kabupatenKota: 'Kota Jakarta Utara', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '14410', kelurahan: 'Penjaringan', kecamatan: 'Penjaringan', kabupatenKota: 'Kota Jakarta Utara', provinsi: 'DKI Jakarta', status: 'AKTIF' },
  { kodePos: '14450', kelurahan: 'Pluit', kecamatan: 'Penjaringan', kabupatenKota: 'Kota Jakarta Utara', provinsi: 'DKI Jakarta', status: 'AKTIF' },

  // JAWA BARAT - BANDUNG, BOGOR, BEKASI, DEPOK, CIREBON
  { kodePos: '40111', kelurahan: 'Braga', kecamatan: 'Sumur Bandung', kabupatenKota: 'Kota Bandung', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '40112', kelurahan: 'Kebon Pisang', kecamatan: 'Sumur Bandung', kabupatenKota: 'Kota Bandung', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '40113', kelurahan: 'Babakan Ciamis', kecamatan: 'Sumur Bandung', kabupatenKota: 'Kota Bandung', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '40115', kelurahan: 'Tamansari', kecamatan: 'Bandung Wetan', kabupatenKota: 'Kota Bandung', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '40116', kelurahan: 'Citarum', kecamatan: 'Bandung Wetan', kabupatenKota: 'Kota Bandung', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '40132', kelurahan: 'Lebak Siliwangi', kecamatan: 'Coblong', kabupatenKota: 'Kota Bandung', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '40291', kelurahan: 'Antapani Tengah', kecamatan: 'Antapani', kabupatenKota: 'Kota Bandung', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '16121', kelurahan: 'Babakan Pasar', kecamatan: 'Bogor Tengah', kabupatenKota: 'Kota Bogor', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '16122', kelurahan: 'Gudang', kecamatan: 'Bogor Tengah', kabupatenKota: 'Kota Bogor', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '16128', kelurahan: 'Pabaton', kecamatan: 'Bogor Tengah', kabupatenKota: 'Kota Bogor', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '16411', kelurahan: 'Depok', kecamatan: 'Pancoran Mas', kabupatenKota: 'Kota Depok', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '16424', kelurahan: 'Margonda', kecamatan: 'Beji', kabupatenKota: 'Kota Depok', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '17141', kelurahan: 'Pekayon Jaya', kecamatan: 'Bekasi Selatan', kabupatenKota: 'Kota Bekasi', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '17144', kelurahan: 'Marga Jaya', kecamatan: 'Bekasi Selatan', kabupatenKota: 'Kota Bekasi', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '45111', kelurahan: 'Kejaksan', kecamatan: 'Kejaksan', kabupatenKota: 'Kota Cirebon', provinsi: 'Jawa Barat', status: 'AKTIF' },
  { kodePos: '46311', kelurahan: 'Banjar', kecamatan: 'Banjar', kabupatenKota: 'Kota Banjar', provinsi: 'Jawa Barat', status: 'AKTIF' },

  // BANTEN - TANGERANG, TANGERANG SELATAN, SERANG, CILEGON
  { kodePos: '15111', kelurahan: 'Sukasari', kecamatan: 'Tangerang', kabupatenKota: 'Kota Tangerang', provinsi: 'Banten', status: 'AKTIF' },
  { kodePos: '15117', kelurahan: 'Babakan', kecamatan: 'Tangerang', kabupatenKota: 'Kota Tangerang', provinsi: 'Banten', status: 'AKTIF' },
  { kodePos: '15321', kelurahan: 'Lengkong Gudang', kecamatan: 'Serpong', kabupatenKota: 'Kota Tangerang Selatan', provinsi: 'Banten', status: 'AKTIF' },
  { kodePos: '15322', kelurahan: 'Rawa Buntu', kecamatan: 'Serpong', kabupatenKota: 'Kota Tangerang Selatan', provinsi: 'Banten', status: 'AKTIF' },
  { kodePos: '15412', kelurahan: 'Ciputat', kecamatan: 'Ciputat', kabupatenKota: 'Kota Tangerang Selatan', provinsi: 'Banten', status: 'AKTIF' },
  { kodePos: '42111', kelurahan: 'Serang', kecamatan: 'Serang', kabupatenKota: 'Kota Serang', provinsi: 'Banten', status: 'AKTIF' },
  { kodePos: '42411', kelurahan: 'Cibeber', kecamatan: 'Cibeber', kabupatenKota: 'Kota Cilegon', provinsi: 'Banten', status: 'AKTIF' },

  // JAWA TENGAH & DI YOGYAKARTA
  { kodePos: '50134', kelurahan: 'Kauman', kecamatan: 'Semarang Tengah', kabupatenKota: 'Kota Semarang', provinsi: 'Jawa Tengah', status: 'AKTIF' },
  { kodePos: '50137', kelurahan: 'Pekunden', kecamatan: 'Semarang Tengah', kabupatenKota: 'Kota Semarang', provinsi: 'Jawa Tengah', status: 'AKTIF' },
  { kodePos: '50241', kelurahan: 'Peterongan', kecamatan: 'Semarang Selatan', kabupatenKota: 'Kota Semarang', provinsi: 'Jawa Tengah', status: 'AKTIF' },
  { kodePos: '57111', kelurahan: 'Kauman', kecamatan: 'Pasar Kliwon', kabupatenKota: 'Kota Surakarta', provinsi: 'Jawa Tengah', status: 'AKTIF' },
  { kodePos: '57131', kelurahan: 'Sriwedari', kecamatan: 'Laweyan', kabupatenKota: 'Kota Surakarta', provinsi: 'Jawa Tengah', status: 'AKTIF' },
  { kodePos: '55122', kelurahan: 'Ngupasan', kecamatan: 'Gondomanan', kabupatenKota: 'Kota Yogyakarta', provinsi: 'DI Yogyakarta', status: 'AKTIF' },
  { kodePos: '55222', kelurahan: 'Kotabaru', kecamatan: 'Gondokusuman', kabupatenKota: 'Kota Yogyakarta', provinsi: 'DI Yogyakarta', status: 'AKTIF' },
  { kodePos: '55281', kelurahan: 'Caturtunggal', kecamatan: 'Depok', kabupatenKota: 'Kabupaten Sleman', provinsi: 'DI Yogyakarta', status: 'AKTIF' },

  // JAWA TIMUR
  { kodePos: '60111', kelurahan: 'Krembangan Selatan', kecamatan: 'Krembangan', kabupatenKota: 'Kota Surabaya', provinsi: 'Jawa Timur', status: 'AKTIF' },
  { kodePos: '60261', kelurahan: 'Embong Kaliasin', kecamatan: 'Genteng', kabupatenKota: 'Kota Surabaya', provinsi: 'Jawa Timur', status: 'AKTIF' },
  { kodePos: '60271', kelurahan: 'Gubeng', kecamatan: 'Gubeng', kabupatenKota: 'Kota Surabaya', provinsi: 'Jawa Timur', status: 'AKTIF' },
  { kodePos: '65111', kelurahan: 'Klojen', kecamatan: 'Klojen', kabupatenKota: 'Kota Malang', provinsi: 'Jawa Timur', status: 'AKTIF' },
  { kodePos: '65119', kelurahan: 'Oro-oro Dowo', kecamatan: 'Klojen', kabupatenKota: 'Kota Malang', provinsi: 'Jawa Timur', status: 'AKTIF' },
  { kodePos: '61211', kelurahan: 'Sidoarjo', kecamatan: 'Sidoarjo', kabupatenKota: 'Kabupaten Sidoarjo', provinsi: 'Jawa Timur', status: 'AKTIF' },

  // SUMATERA (MEDAN, PADANG, PALEMBANG, PEKANBARU, BANDAR LAMPUNG)
  { kodePos: '20111', kelurahan: 'Kesawan', kecamatan: 'Medan Barat', kabupatenKota: 'Kota Medan', provinsi: 'Sumatera Utara', status: 'AKTIF' },
  { kodePos: '20151', kelurahan: 'Petisah Tengah', kecamatan: 'Medan Petisah', kabupatenKota: 'Kota Medan', provinsi: 'Sumatera Utara', status: 'AKTIF' },
  { kodePos: '25111', kelurahan: 'Kampung Pondok', kecamatan: 'Padang Barat', kabupatenKota: 'Kota Padang', provinsi: 'Sumatera Barat', status: 'AKTIF' },
  { kodePos: '25119', kelurahan: 'Olo', kecamatan: 'Padang Barat', kabupatenKota: 'Kota Padang', provinsi: 'Sumatera Barat', status: 'AKTIF' },
  { kodePos: '30111', kelurahan: '16 Ilir', kecamatan: 'Ilir Timur I', kabupatenKota: 'Kota Palembang', provinsi: 'Sumatera Selatan', status: 'AKTIF' },
  { kodePos: '30126', kelurahan: '24 Ilir', kecamatan: 'Bukit Kecil', kabupatenKota: 'Kota Palembang', provinsi: 'Sumatera Selatan', status: 'AKTIF' },
  { kodePos: '28111', kelurahan: 'Kota Tinggi', kecamatan: 'Pekanbaru Kota', kabupatenKota: 'Kota Pekanbaru', provinsi: 'Riau', status: 'AKTIF' },
  { kodePos: '35111', kelurahan: 'Gunung Sari', kecamatan: 'Enggal', kabupatenKota: 'Kota Bandar Lampung', provinsi: 'Lampung', status: 'AKTIF' },
  { kodePos: '29411', kelurahan: 'Lubuk Baja Kota', kecamatan: 'Lubuk Baja', kabupatenKota: 'Kota Batam', provinsi: 'Kepulauan Riau', status: 'AKTIF' },

  // BALI & NUSA TENGGARA
  { kodePos: '80111', kelurahan: 'Dangin Puri', kecamatan: 'Denpasar Timur', kabupatenKota: 'Kota Denpasar', provinsi: 'Bali', status: 'AKTIF' },
  { kodePos: '80234', kelurahan: 'Renon', kecamatan: 'Denpasar Selatan', kabupatenKota: 'Kota Denpasar', provinsi: 'Bali', status: 'AKTIF' },
  { kodePos: '80361', kelurahan: 'Kuta', kecamatan: 'Kuta', kabupatenKota: 'Kabupaten Badung', provinsi: 'Bali', status: 'AKTIF' },
  { kodePos: '83111', kelurahan: 'Mataram Barat', kecamatan: 'Selaparang', kabupatenKota: 'Kota Mataram', provinsi: 'Nusa Tenggara Barat', status: 'AKTIF' },
  { kodePos: '85111', kelurahan: 'Oeba', kecamatan: 'Kota Lama', kabupatenKota: 'Kota Kupang', provinsi: 'Nusa Tenggara Timur', status: 'AKTIF' },

  // KALIMANTAN
  { kodePos: '76111', kelurahan: 'Klandasan Ulu', kecamatan: 'Balikpapan Kota', kabupatenKota: 'Kota Balikpapan', provinsi: 'Kalimantan Timur', status: 'AKTIF' },
  { kodePos: '75111', kelurahan: 'Pelabuhan', kecamatan: 'Samarinda Kota', kabupatenKota: 'Kota Samarinda', provinsi: 'Kalimantan Timur', status: 'AKTIF' },
  { kodePos: '70111', kelurahan: 'Kertak Baru Ilir', kecamatan: 'Banjarmasin Tengah', kabupatenKota: 'Kota Banjarmasin', provinsi: 'Kalimantan Selatan', status: 'AKTIF' },
  { kodePos: '78111', kelurahan: 'Benua Melayu Laut', kecamatan: 'Pontianak Selatan', kabupatenKota: 'Kota Pontianak', provinsi: 'Kalimantan Barat', status: 'AKTIF' },

  // SULAWESI, MALUKU & PAPUA
  { kodePos: '90111', kelurahan: 'Bulo Gading', kecamatan: 'Ujung Pandang', kabupatenKota: 'Kota Makassar', provinsi: 'Sulawesi Selatan', status: 'AKTIF' },
  { kodePos: '90115', kelurahan: 'Sawerigading', kecamatan: 'Ujung Pandang', kabupatenKota: 'Kota Makassar', provinsi: 'Sulawesi Selatan', status: 'AKTIF' },
  { kodePos: '95111', kelurahan: 'Wenang Selatan', kecamatan: 'Wenang', kabupatenKota: 'Kota Manado', provinsi: 'Sulawesi Utara', status: 'AKTIF' },
  { kodePos: '97126', kelurahan: 'Honipopu', kecamatan: 'Sirimau', kabupatenKota: 'Kota Ambon', provinsi: 'Maluku', status: 'AKTIF' },
  { kodePos: '99111', kelurahan: 'Gurabesi', kecamatan: 'Jayapura Utara', kabupatenKota: 'Kota Jayapura', provinsi: 'Papua', status: 'AKTIF' },
];
