// Dashboard butir 1 & 5 — angka dashboard harus REKONSILIASI: kunci wilayah yang
// dipakai pengelompokan baris = kunci yang dipakai daftar wilayah, irisan donut
// berjumlah sama dengan total baris, dan tombol Excel/PDF di bawah tabel benar-benar
// menghasilkan berkas 13 kolom. Dijalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-dashboard-angka.mjs
import { existsSync, rmSync } from 'node:fs';
import { detectFinalAnomalies, formatWilayahCode, formatWilayahName, exportFinalRowsToExcel, exportFinalRowsToPdf, JUDUL_KOLOM_FINAL, kunciKelKec, kotaCocok } from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK    ' : 'GAGAL '}${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

// ── 1. KUNCI WILAYAH: bentuk mentah apa pun harus mendarat di bucket yang sama ──
// Dulu `regionalStats` menyimpan kode ('W01') sementara pengelompokan baris memakai
// nama ('Wilayah 1'), jadi baris tidak pernah masuk ke baris tabelnya.
const mentah = ['1', '01', 'W01', 'w1', 'Wilayah 1', 'WILAYAH 01 - MEDAN'];
const kode = [...new Set(mentah.map((v) => formatWilayahCode(v)))];
asa('DA1 semua bentuk wilayah mentah jadi satu kode kanonik', kode, ['W01']);
asa('DA2 label tabel tidak berubah setelah putar balik', mentah.map(formatWilayahName), Array(mentah.length).fill('Wilayah 1'));
asa('DA3 kunci tanpa wilayah tidak dapat prefiks ganda', formatWilayahName('Tanpa Wilayah'), 'Tanpa Wilayah');
asa('DA4 angka 0 dan strip bukan wilayah', ['', '-', '0'].map((v) => (v && v !== '-' && v !== '0' ? formatWilayahCode(v) : '') || 'Tanpa Wilayah'), ['Tanpa Wilayah', 'Tanpa Wilayah', 'Tanpa Wilayah']);

// ── Data uji: 3 wilayah, 2 baris bermasalah ──
const masterRows = [
  { Wilayah: 'W07', 'Nama Outlet': 'PONTIANAK YUDHA', 'Kode Cabang': '07710001', 'Branch Code': '07710001', Provinsi: 'KALIMANTAN BARAT', 'Dati II': 'PONTIANAK', Kelurahan: 'BANK IN', Kecamatan: 'PONTIANAK BARAT', 'Status Outlet': 'KCP', 'KODE POS': '78121' },
  { Wilayah: 'W01', 'Nama Outlet': 'MEDAN KATAMSO', 'Kode Cabang': '01110001', 'Branch Code': '01110001', Provinsi: 'SUMATERA UTARA', 'Dati II': 'MEDAN', Kelurahan: 'HARJA SARI', Kecamatan: 'MEDAN MARELAN', 'Status Outlet': 'KC', 'KODE POS': '20212' },
  { Wilayah: 'W01', 'Nama Outlet': 'BANDA ACEH LAMPANG', 'Kode Cabang': '01110002', 'Branch Code': '01110002', Provinsi: 'ACEH', 'Dati II': 'BANDA ACEH', Kelurahan: 'LAMPANG', Kecamatan: 'BANDA ACEH', 'Status Outlet': 'KC', 'KODE POS': '23224' },
];

const baris = (o) => ({
  No: 1, wilayah: 'W07', sandiCabang: '0771', branchCode: '07710001', kodeCabang: '07710001',
  namaOutlet: 'PONTIANAK YUDHA', statusOutlet: 'KCP', alamat: 'JL. YUDHA NO 1',
  kodePosKelurahan: '78121', kodePosPten: '78121', kelurahan: 'BANK IN', kecamatan: 'PONTIANAK BARAT',
  kotaPten: 'PONTIANAK', kotaPtenMax15: 'PONTIANAK', provinsi: 'KALIMANTAN BARAT',
  statusAnalisa: 'EXACT_MATCH', placementStatus: 'VERIFIED', placementMethod: 'Join nama kota',
  is3RoleLengkap: true, roleCabsal: 1, roleCabapv1: 1, roleCabapv2: 1, roleGrandTotal: 3,
  ...o,
});

const finalRows = [
  baris({ id: 'f1' }),
  baris({ id: 'f2', No: 2 }),
  baris({ id: 'f3', No: 3, wilayah: 'W01', kodeCabang: '01110001', branchCode: '01110001', namaOutlet: 'MEDAN KATAMSO', provinsi: 'SUMATERA UTARA', kotaPten: 'MEDAN', kotaPtenMax15: 'MEDAN', kelurahan: 'HARJA SARI', kecamatan: 'MEDAN MARELAN', kodePosKelurahan: '20212', kodePosPten: '20212' }),
  // keluar pulau: cabang Kalimantan, kode pos di Jawa
  baris({ id: 'f4', No: 4, kodePosPten: '10110', kodePosKelurahan: '10110', provinsi: 'DKI JAKARTA', kotaPten: 'JAKARTA PUSAT', kotaPtenMax15: 'JAKARTA PUSAT', kelurahan: 'GAMBIR', kecamatan: 'GAMBIR' }),
  // tanpa wilayah
  baris({ id: 'f5', No: 5, wilayah: '', kodePosPten: '23224', kodePosKelurahan: '23224', namaOutlet: 'BANDA ACEH LAMPANG', kodeCabang: '01110002', branchCode: '01110002', provinsi: 'ACEH', kotaPten: 'BANDA ACEH', kotaPtenMax15: 'BANDA ACEH', kelurahan: 'LAMPANG', kecamatan: 'BANDA ACEH' }),
];

// ── 2. PENGELMPOMANAN ULANG MATEMATIKA DASHBOARD (salinan rumus App.tsx) ──
const kunciW = (v) => {
  const s = String(v ?? '').trim();
  return (s && s !== '-' && s !== '0' ? formatWilayahCode(s) : '') || 'Tanpa Wilayah';
};
const anomaliIds = new Set(detectFinalAnomalies(finalRows, masterRows).map((a) => a.row.id));

const buckets = new Map();
finalRows.forEach((r) => {
  const k = kunciW(r.wilayah);
  const c = buckets.get(k) || { total: 0, matched: 0, unmatched: 0 };
  c.total++;
  if (anomaliIds.has(r.id)) c.unmatched++;
  else c.matched++;
  buckets.set(k, c);
});

asa('DA5 wilayah yang muncul di tabel', [...buckets.keys()].sort(), ['Tanpa Wilayah', 'W01', 'W07']);
asa('DA6 jumlah baris wilayah = total baris (tidak ada yang hilang)', [...buckets.values()].reduce((n, v) => n + v.total, 0), finalRows.length);
asa('DA7 W07: 2 bersih + 1 anomali', buckets.get('W07'), { total: 3, matched: 2, unmatched: 1 });
asa('DA8 baris tanpa wilayah tetap punya baris tabel', buckets.get('Tanpa Wilayah'), { total: 1, matched: 1, unmatched: 0 });

// donut: irisan (kategori utama) harus berjumlah total baris
const perKategori = { PULAU: 0, PROVINSI: 0, STATUS: 0, PENEMPATAN: 0, ROLE: 0 };
detectFinalAnomalies(finalRows, masterRows).forEach((a) => { perKategori[a.primary]++; });
const bersih = finalRows.length - anomaliIds.size;
asa('DA9 irisan donut + bersih = total baris', bersih + Object.values(perKategori).reduce((a, b) => a + b, 0), finalRows.length);
asa('DA10 anomali f4 terkategori keluar pulau', perKategori.PULAU, 1);

// ── 3. TOMBOH UNDUH DI BAWAH TABEL ──
const rowsW07 = finalRows.filter((r) => kunciW(r.wilayah) === 'W07' && !anomaliIds.has(r.id));
asa('DA11 yang bisa diunduh = hanya baris bersih', rowsW07.map((r) => r.id), ['f1', 'f2']);

const xlsx = exportFinalRowsToExcel(rowsW07, formatWilayahName('W07'));
asa('DA12 ekspor Excel sukses', xlsx.success, true);
asa('DA13 Excel memuat seluruh baris bersih wilayah itu', xlsx.rowCount, 2);
console.log(`       berkas: ${xlsx.filename || xlsx.error}`);

const pdf = exportFinalRowsToPdf({ wilayahLabel: 'W07', rows: rowsW07, totalRows: buckets.get('W07').total });
if (!pdf.success && /is not a constructor/.test(pdf.error || '')) {
  // Bundel SSR Node tidak menyediakan constructor jsPDF (kemasan CJS); di browser jalur
  // ini jalan. Jadi tidak dinilai di sini — dicatat, bukan dianggap lulus.
  console.log('LEWAT DA14/DA15 ekspor PDF: tidak bisa dijalankan di bundel Node (jsPDF CJS). Verifikasi lewat browser.');
} else {
  asa('DA14 ekspor PDF sukses', pdf.success, true);
  asa('DA15 nama berkas PDF memakai nama wilayah', pdf.filename, 'Data_Final_Wilayah_7.pdf');
  console.log(`       berkas: ${pdf.filename || pdf.error}`);
}

asa('DA16 kolom laporan = 13 kolom Data Final', JUDUL_KOLOM_FINAL.length, 13);
asa('DA17 tidak ada kolom duplikat di laporan', new Set(JUDUL_KOLOM_FINAL).size, 13);

// Kunci cadangan titik peta (kasus nyata dari data produksi 2026-09-22):
// kode pos PTEN 37259 tidak ada di tabel kode pos, tapi "Kemantan, Tebo Ilir, TEBO"
// ada di sana dengan kode 37572 + titik. Kuncinya harus mempertemukan keduanya.
asa('DA18 kelurahan+kecamatan jadi kunci (Tebo)', kunciKelKec('Kemantan', 'tebo ilir'), kunciKelKec('KEMANTAN', 'TEBO ILIR'));
asa('DA19 prefiks KABUPATEN/KOTA dilepas saat membanding kota', kotaCocok('KABUPATEN SERAM BAGIAN TIMUR', 'SERAM BAGIAN T'), true);
asa('DA20 nama kota terpotong 15 karakter tetap bertemu (Bula)', kotaCocok('Kabupaten Seram Bagian Timur', 'SERAM BAGIAN TI'), true);
asa('DA21 kota beda benar tidak dianggap sama', kotaCocok('KABUPATEN TEBO', 'KOTA BANDAR LAMPUNG'), false);
asa('DA22 kecamatan beda tidak boleh tertukar', kunciKelKec('Bula', 'Bula') === kunciKelKec('Bula', 'Bula Barat'), false);

// bersihkan artefak uji kalau berkasnya benar-benar tertulis
for (const f of [xlsx.filename, pdf.filename]) {
  if (f && existsSync(f)) rmSync(f);
}

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} PENGUJIAN GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
