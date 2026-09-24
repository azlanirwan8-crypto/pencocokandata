// Dashboard butir 2 — parameter anomali harus benar-benar menyala, termasuk "keluar
// pulau" dan "beda provinsi". Dijalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-anomali.mjs
import { detectFinalAnomalies, KATEGORI_ANOMALI, URUTAN_KATEGORI } from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

const master = (o) => ({
  Wilayah: '', 'Branch Code': '', 'Kode Cabang': '', 'Sandi Cabang': '', Sandi: '', Cabang: '',
  'Nama Outlet': '', 'Status Outlet': '', ALAMAT: '', 'KODE POS': '', Kelurahan: '', Kecamatan: '',
  'Dati II': '', Provinsi: '', ...o,
});

const masterRows = [
  master({ 'Nama Outlet': 'BANDUNG ASIA AFRIKA', 'Kode Cabang': '03100001', 'Branch Code': '03100001', Provinsi: 'JAWA BARAT', 'Dati II': 'BANDUNG', Kelurahan: 'BRAGA', Kecamatan: 'SUMUR BANDUNG' }),
  master({ 'Nama Outlet': 'SEMARANG MAYANG', 'Kode Cabang': '03200001', 'Branch Code': '03200001', Provinsi: 'JAWA TENGAH', 'Dati II': 'SEMARANG', Kelurahan: 'SUMUR MAGUANG', Kecamatan: 'SEMARANG' }),
  master({ 'Nama Outlet': 'PONTIANAK YUDHA', 'Kode Cabang': '07700001', 'Branch Code': '07700001', Provinsi: 'KALIMANTAN BARAT', 'Dati II': 'PONTIANAK', Kelurahan: 'BANK IN', Kecamatan: 'PONTIANAK BARAT' }),
  master({ 'Nama Outlet': 'KIM BANDA ACEH', 'Kode Cabang': '01100001', 'Branch Code': '01100001', Provinsi: 'ACEH', 'Dati II': 'BANDA ACEH', Kelurahan: 'KAMPANG BARU', Kecamatan: 'BANDA ACEH' }),
];

const baris = (o) => ({
  provinsi: 'JAWA BARAT', kotaPten: 'BANDUNG', kotaPtenMax15: 'BANDUNG', kelurahan: 'BRAGA', kecamatan: 'SUMUR BANDUNG',
  namaOutlet: 'BANDUNG ASIA AFRIKA', kodeCabang: '03100001', branchCode: '03100001',
  statusAnalisa: 'EXACT_MATCH', placementStatus: 'VERIFIED', placementMethod: 'Join nama kota',
  is3RoleLengkap: true, roleCabsal: 1, roleCabapv1: 1, roleCabapv2: 1, roleGrandTotal: 3,
  ...o,
});

const kategoriUntuk = (r) => {
  const hasil = detectFinalAnomalies([r], masterRows);
  return hasil[0] ? hasil[0].categories : [];
};

// ── 1. bersih: tidak boleh muncul sebagai anomali ──
asa('AN1 baris sekota & role lengkap = tidak dilaporkan', kategoriUntuk(baris({})), []);
asa('AN1 jumlah keluaran nol', detectFinalAnomalies([baris({})], masterRows).length, 0);

// ── 2. KELUAR PULAU ──
const bedaPulau = kategoriUntuk(baris({ provinsi: 'KALIMANTAN BARAT', kotaPten: 'PONTIANAK', kotaPtenMax15: 'PONTIANAK', kelurahan: 'BANK IN', kecamatan: 'PONTIANAK BARAT', namaOutlet: 'BANDUNG ASIA AFRIKA', kodeCabang: '03100001' }));
asa('AN2 beda pulau tertangkap (kategori pertama PULAU)', bedaPulau[0], 'PULAU');
asa('AN2 beda pulau juga otomatis beda provinsi', bedaPulau.includes('PROVINSI'), true);

// ── 3. BEDA PROVINSI, masih satu pulau — aturan yang baru ──
const bedaProv = kategoriUntuk(baris({ namaOutlet: 'SEMARANG MAYANG', kodeCabang: '03200001' }));
asa('AN3 Jawa Barat → cabang Jawa Tengah dilaporkan', bedaProv, ['PROVINSI']);
asa('AN3 alasannya menyebut dua provinsi', /asal JAWA BARAT → cabang JAWA TENGAH/.test((detectFinalAnomalies([baris({ namaOutlet: 'SEMARANG MAYANG', kodeCabang: '03200001' })], masterRows)[0]?.reasons || []).join(' ')), true);

// ── 4. aturan lain tetap menyala ──
asa('AN4 status ANOMALI', kategoriUntuk(baris({ statusAnalisa: 'ANOMALI' })).includes('STATUS'), true);
asa('AN4 penempatan FALLBACK', kategoriUntuk(baris({ placementStatus: 'FALLBACK' })).includes('PENEMPATAN'), true);
asa('AN4 role belum lengkap', kategoriUntuk(baris({ is3RoleLengkap: false, roleGrandTotal: 2 })).includes('ROLE'), true);

// ── 4b. baris yang BELUM dianalisa tidak boleh dihitung sebagai anomali role ──
// Dulu kartu TOTAL ANOMALI di Dashboard menunjukkan seluruh isi Data Final
// (83.764 dari 83.764) karena baris MENUNGGU dianggap "role belum lengkap".
asa('AN8 MENUNGGU + role belum diisi = bukan anomali', kategoriUntuk(baris({ statusAnalisa: 'MENUNGGU', is3RoleLengkap: false, roleGrandTotal: 0 })), []);
asa('AN8 keluaran nol untuk baris MENUNGGU', detectFinalAnomalies([baris({ statusAnalisa: 'MENUNGGU', is3RoleLengkap: false })], masterRows).length, 0);
asa('AN8 tapi beda provinsi tetap dilaporkan walau MENUNGGU', kategoriUntuk(baris({ statusAnalisa: 'MENUNGGU', is3RoleLengkap: false, namaOutlet: 'SEMARANG MAYANG', kodeCabang: '03200001' })), ['PROVINSI']);

// ── 5. pengecualian Aceh (Cabang KIM) tidak dianggap keluar wilayah ──
const aceh = kategoriUntuk(baris({ provinsi: 'ACEH', kotaPten: 'BANDA ACEH', kotaPtenMax15: 'BANDA ACEH', kelurahan: 'KAMPANG BARU', kecamatan: 'BANDA ACEH', namaOutlet: 'KIM BANDA ACEH', kodeCabang: '01100001' }));
asa('AN5 Aceh → KIM Banda Aceh bukan anomali wilayah', aceh, []);

// ── 6. cabang yang tidak ada di Master tidak boleh dianggap keluar provinsi ──
asa('AN6 cabang tak dikenal di Master → tanpa kategori wilayah', kategoriUntuk(baris({ namaOutlet: 'TIDAK ADA DI MASTER', kodeCabang: '99999999' })), []);

// ── 7. primary = prioritas tertinggi ──
const campur = detectFinalAnomalies([baris({ provinsi: 'KALIMANTAN BARAT', kotaPten: 'PONTIANAK', kotaPtenMax15: 'PONTIANAK', kelurahan: 'BANK IN', kecamatan: 'PONTIANAK BARAT', namaOutlet: 'BANDUNG ASIA AFRIKA', kodeCabang: '03100001', is3RoleLengkap: false })], masterRows)[0];
asa('AN7 badge tunggal memakai prioritas (PULAU bukan ROLE)', campur?.primary, 'PULAU');
asa('AN7 semua kategorinya tetap tercatat', campur?.categories, ['PULAU', 'PROVINSI', 'ROLE']);

// ── 8. kontrak kartu rincian anomali: tiap kategori wajib punya label + arti + warna ──
asa('AN8 urutan kelas lengkap 5', URUTAN_KATEGORI, ['PULAU', 'PROVINSI', 'STATUS', 'PENEMPATAN', 'ROLE']);
asa('AN8 tiap kelas punya label, arti dan warna', URUTAN_KATEGORI.every((c) => {
  const k = KATEGORI_ANOMALI[c];
  return !!k && k.label.length > 2 && k.arti.length > 20 && /^#[0-9a-f]{6}$/i.test(k.color) && /^#[0-9a-f]{6}$/i.test(k.bg);
}), true);
asa('AN8 kategori yang benar-benar dihasilkan mesin ada semua di kartu', campur.categories.every((c) => URUTAN_KATEGORI.includes(c)), true);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} TEST GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
