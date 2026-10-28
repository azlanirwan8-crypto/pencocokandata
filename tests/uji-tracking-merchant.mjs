// Tracking Merchant — uji dua hal: (1) ekstraksi literal `trackingMIDDatabase` dari HTML
// sumber + pemotongan kolom sensitif, dijalankan APA ADANYA dari api/tracking-merchant.ts
// (bukan salinan), supaya tidak ada drift antara yang diuji dan yang dipakai produksi;
// (2) angka turunan & kolom ekspor yang dibaca tabel.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-tracking-merchant.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFINISI_KOLOM_TM, KOLOM_EKSPOR_TM, KOLOM_TM, KUNCI_STORAGE_TRACKING, KETERANGAN_STATUS,
  LABEL_KERANJANG, SUMUR_TRACKING, barisKeExcelTm, cocokCari, keranjangStatus, riwayatMerchant,
  ringkasTracking,
} from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

// ── (1) Blok produksi dieksekusi apa adanya ─────────────────────────────────
const sumberApi = readFileSync(fileURLToPath(new URL('../api/tracking-merchant.ts', import.meta.url)), 'utf8');
const AWAL = '// <<PANAH-AWAL>>';
const AKHIR = '// <<PANAH-AKHIR>>';
const iAwal = sumberApi.indexOf(AWAL);
const iAkhir = sumberApi.indexOf(AKHIR);
asa('penanda blok ekstraksi ada di api/tracking-merchant.ts', iAwal >= 0 && iAkhir > iAwal, true);

const potongan = sumberApi.slice(iAwal + AWAL.length, iAkhir);
const { FIELD_TM, ambilLiteralTrackingMID, ratakanMerchantTm } = new Function(
  `${potongan}\nreturn { FIELD_TM, ambilLiteralTrackingMID, ratakanMerchantTm };`
)();

// Sumbernya tidak pernah mengirim JSON endpoint — hanya HTML dengan literal ini.
const HTML_UJI = `<html><body>
<script>
  const trackingMIDDatabase = [
    {
      "mid": "601741069", "nama_merchant": "AISA PONSEL", "kriteria": "(UME) Usaha Menengah",
      "kota": "Mandailing Natal", "provinsi": "Sumatera Utara", "rekening": "2020******",
      "events": [
        {
          "source_onboarding": "BNI MOM", "inputer_name": "P031190 - Nama Orang",
          "nama_merchant": "AISA PONSEL", "ref_no": "REF2629501349218", "mid": "601741069",
          "jenis_pengajuan": "Edit Settlement Type", "jenis_qr": "QR Sticker",
          "tgl_pengajuan": "2026-10-22 20:05:59", "last_update": "2026-10-22 20:05:59",
          "status": "On Progress Approver 1", "nomor_rekening": "2020******",
          "nomor_ktp": "12770345********", "nomor_npwp": "-", "email": "a@b.com",
          "no_hp": "081394******", "no_telp": "0636", "kriteria_merchant": "(UME) Usaha Menengah",
          "jenis_usaha": "TELECOMMUNICATION EQUIPMENT & TELEPHONE SALES",
          "alamat": "LINTAS BARAT PANYABUNGAN",
          "provinsi": "Sumatera Utara", "kabupaten_kota": "Mandailing Natal",
          "kecamatan": "Siabu", "kelurahan": "Aek Mual", "kode_pos": "22976",
          "branch_code": "60108801 - PANYABUNGAN", "merchant_segment": "RR0 - Retail",
          "referral_code": "RF-2026-A"
        },
        {
          "source_onboarding": "N/A", "nama_merchant": "AISA PONSEL", "ref_no": "REF2510000000001",
          "mid": "601741069", "jenis_pengajuan": "Add New Merchant", "jenis_qr": "QR Sticker",
          "tgl_pengajuan": "2025-01-09 08:00:00", "last_update": "2025-02-01 09:30:00",
          "status": "Active", "email": "a@b.com", "nomor_ktp": "12770345********",
          "alamat": "LINTAS BARAT PANYABUNGAN", "provinsi": "Sumatera Utara",
          "kecamatan": "Siabu", "kelurahan": "Aek Mual", "kode_pos": "22976",
          "branch_code": "60108801 - PANYABUNGAN", "merchant_segment": "-", "referral_code": "-"
        }
      ]
    },
    {
      "mid": "601771072", "nama_merchant": "UD IVAN JAYA 2", "kriteria": "(UME) Usaha Menengah",
      "kota": "Tapanuli Tengah", "provinsi": "Sumatera Utara", "rekening": "2120******",
      "events": [
        {
          "mid": "601771072", "nama_merchant": "UD IVAN JAYA 2", "ref_no": "REF2629501349216",
          "jenis_pengajuan": "Edit Settlement Type", "jenis_qr": "QR Sticker",
          "tgl_pengajuan": "2026-10-22 20:05:58", "last_update": "2026-10-22 20:05:58",
          "status": "Reject by PTEN", "nomor_rekening": "2120******", "no_hp": "085360******",
          "branch_code": "60107702 - PADANG SIDEMPUAN"
        }
      ]
    }
  ];
  // teks setelah literal harus tidak ikut termakan
  const penutup = { contoh: ']}' };
</script></body></html>`;

const list = ambilLiteralTrackingMID(HTML_UJI);
asa('literal diambil dari HTML tanpa ikut sisa skrip', Array.isArray(list) && list.length, 2);

const baris = ratakanMerchantTm(list);
asa('satu baris per riwayat (3 event dari 2 merchant)', baris.length, 3);
asa('riwayat terbaru MID pertama jadi idx 1', [baris[0].refNo, baris[0].idxRiwayat, baris[0].totalRiwayat], ['REF2629501349218', 1, 2]);
asa('riwayat lama MID pertama jadi idx 2', [baris[1].idxRiwayat, baris[1].status], [2, 'Active']);
asa('merchant kedua tetap muncul walau event-nya minim', [baris[2].mid, baris[2].namaMerchant, baris[2].kabupatenKota], ['601771072', 'UD IVAN JAYA 2', 'Tapanuli Tengah']);
asa('fallback kota dari induk saat event tidak punya kabupaten_kota', baris[2].provinsi, 'Sumatera Utara');

// 27 kolom data sumber, kita ambil 20 kolom operasional (lihat FIELD_TM di api).
const SENSITIF = ['nomor_rekening', 'nomor_ktp', 'nomor_npwp', 'email', 'no_hp', 'no_telp', 'inputer_name', 'rekening'];
const kunciBaris = Object.keys(baris[0]).sort();
asa('kolom sensitif tidak pernah keluar dari fungsi', SENSITIF.filter((k) => JSON.stringify(baris).toLowerCase().includes(k.toLowerCase())), []);
asa('bentuk baris = whitelist + penanda riwayat', kunciBaris, [
  'alamat', 'branchCode', 'idxRiwayat', 'jenisPengajuan', 'jenisQr', 'jenisUsaha', 'kabupatenKota',
  'kecamatan', 'kelurahan', 'kodePos', 'kriteria', 'lastUpdate', 'mid', 'merchantSegment',
  'namaMerchant', 'provinsi', 'refNo', 'referralCode', 'sumberOnboarding', 'status', 'tglPengajuan',
  'totalRiwayat',
].sort());
asa('daftar putih sumber = 20 kolom operasional', FIELD_TM.length, 20);
asa('Jenis Usaha ikut terbawa (kolom 18 sumber)', baris[0].jenisUsaha, 'TELECOMMUNICATION EQUIPMENT & TELEPHONE SALES');
asa('Referral Code ikut terbawa (kolom 28 sumber)', baris[0].referralCode, 'RF-2026-A');
asa('kolom sumber yang tidak ada di baris = hanya yang sensitif',
  ['inputer_name', 'nomor_rekening', 'nomor_ktp', 'nomor_npwp', 'email', 'no_hp', 'no_telp']
    .filter((k) => FIELD_TM.includes(k)), []);

let salahMarker = '';
try { ambilLiteralTrackingMID('<html>tidak ada datanya</html>'); } catch (e) { salahMarker = e.message; }
asa('marker hilang → pesan yang menjelaskan', /marker tidak ditemukan/i.test(salahMarker), true);

// ── (2) Angka & kolom yang dibaca tabel ────────────────────────────────────
asa('keranjang status mengikuti halaman sumber', [
  keranjangStatus('Active'), keranjangStatus('On Progress Approver 2'),
  keranjangStatus('Reject by PTEN'), keranjangStatus('Rejected By Approver 2'),
  keranjangStatus(''), keranjangStatus(null),
], ['aktif', 'proses', 'tolak', 'tolak', 'lain', 'lain']);

const k = ringkasTracking(baris);
asa('ringkasan: merchant unik, bukan jumlah baris', [k.merchant, k.riwayat], [2, 3]);
asa('ringkasan: pecahan status', [k.aktif, k.proses, k.tolak, k.lain], [1, 1, 1, 0]);
asa('ringkasan: cabang & provinsi unik', [k.cabang, k.provinsi], [2, 1]);
asa('ringkasan: update terakhir', k.updateTerakhir, '2026-10-22 20:05:59');
asa('ringkasan atas nol baris tidak NaN', ringkasTracking([]), {
  merchant: 0, riwayat: 0, aktif: 0, proses: 0, tolak: 0, lain: 0, cabang: 0, provinsi: 0, updateTerakhir: '',
});

asa('cari di MID', cocokCari(baris[0], '601741'), true);
asa('cari nama merchant huruf kecil tetap kena', cocokCari(baris[0], 'aisa ponsel'), true);
asa('cari di cabang', cocokCari(baris[0], 'pAnyabungan'), true);
asa('cari tidak cocok', cocokCari(baris[0], 'surabaya tidak ada'), false);
asa('cari kosong = semua lolos', cocokCari(baris[0], '  '), true);

const riwayat = riwayatMerchant(baris, '601741069');
asa('riwayat satu MID, terbaru dulu', riwayat.map((r) => r.tglPengajuan), ['2026-10-22 20:05:59', '2025-01-09 08:00:00']);
asa('riwayat MID lain tidak ikut', riwayatMerchant(baris, '601771072').length, 1);

asa('label keranjang dipakai bersama', [LABEL_KERANJANG.aktif, LABEL_KERANJANG.tolak], ['Active', 'Reject']);
asa('kunci saringan = teks header tabel', DEFINISI_KOLOM_TM.map((d) => d.kunci), KOLOM_TM.map((c) => c.label));
asa('header ekspor = No + kolom tabel', KOLOM_EKSPOR_TM, ['No', ...KOLOM_TM.map((c) => c.label)]);

const excel = barisKeExcelTm(baris);
asa('baris Excel memakai label header tabel', Object.keys(excel[0]), KOLOM_EKSPOR_TM);
asa('nomor urut Excel mulai 1', excel.map((r) => r.No), [1, 2, 3]);
asa('kolom wilayah ditampilkan kapital di ekspor', excel[0]['Provinsi'], 'SUMATERA UTARA');
asa('kolom yang kosong di sumber tetap kosong di Excel', excel[2]['Segmen Merchant'], '');
asa('kunci storage cloud & lokal sama', KUNCI_STORAGE_TRACKING, 'tracking_merchant_data');
asa('sumber yang ditampilkan ke user', SUMUR_TRACKING, '154.19.37.201/migrasi');

// ── (3) Kelengkapan kolom: urutan mengikuti sumber + kolom turunan ──────────
asa('22 kolom tabel (20 kolom sumber + Flagging + Status Verifikasi)', KOLOM_TM.map((c) => c.label), [
  'MID', 'Nama Merchant', 'Flagging Riwayat', 'Jenis Pengajuan', 'Jenis QR', 'Tanggal Pengajuan',
  'Last Update', 'Status', 'Status Verifikasi', 'Ref No', 'Sumber', 'Kriteria', 'Jenis Usaha',
  'Segmen Merchant', 'Cabang', 'KODE POS', 'Kelurahan', 'Kecamatan', 'Kota / Kabupaten',
  'Provinsi', 'Alamat', 'Referral Code',
]);
asa('label Flagging Riwayat memakai istilah sumber', KOLOM_TM.find((c) => c.label === 'Flagging Riwayat').nilai(baris[0]), 'Multi-Event');
asa('merchant satu riwayat ditandai Tunggal', KOLOM_TM.find((c) => c.label === 'Flagging Riwayat').nilai(baris[2]), 'Tunggal');
asa('Status Verifikasi adalah keranjang, bukan teks mentah', KOLOM_TM.find((c) => c.label === 'Status Verifikasi').nilai(baris[0]), 'On Progress');
asa('Status mentah tetap utuh di kolomnya sendiri', baris[0].status, 'On Progress Approver 1');
asa('saringan kolom turunan ikut terdaftar', DEFINISI_KOLOM_TM.some((d) => d.kunci === 'Status Verifikasi'), true);

const AMBIL_SUMBER = FIELD_TM.length;
asa('semua kolom sumber yang diambil punya kolom tabel', KOLOM_TM.length - 2, AMBIL_SUMBER);
for (const k of ['aktif', 'proses', 'tolak', 'lain']) {
  asa(`penjelasan keranjang ${k} ada`, KETERANGAN_STATUS[k].length > 20, true);
}
asa('penjelasan Reject mengatakan alasannya tidak ada di sumber', /tidak menyertakan kolom alasan/.test(KETERANGAN_STATUS.tolak), true);
asa('sumber tidak punya kolom nmid — angka itu rekaan halaman sumber', FIELD_TM.includes('nmid'), false);

console.log(gagal === 0 ? 'SEMUA LULUS' : `${gagal} UJIAN GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
