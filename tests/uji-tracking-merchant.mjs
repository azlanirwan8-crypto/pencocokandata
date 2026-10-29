// Tracking Merchant — uji dua hal: (1) ekstraksi literal `trackingMIDDatabase` dari HTML
// sumber + pemotongan kolom sensitif, dijalankan APA ADANYA dari api/rolemapping.ts
// (bukan salinan), supaya tidak ada drift antara yang diuji dan yang dipakai produksi;
// (2) angka turunan & kolom ekspor yang dibaca tabel.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-tracking-merchant.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFINISI_KOLOM_TM, KOLOM_EKSPOR_TM, KOLOM_TM, KUNCI_STORAGE_TRACKING, KETERANGAN_STATUS,
  LABEL_KERANJANG, SUMUR_TRACKING, PERIODE_QR_DEFAULT, SARINGAN_REKAP_KOSONG, barisKeExcelTm, cocokCari,
  daftarMerchantTerverifikasi, daftarPeriodeQr, formatAngka, halamanDaftar, kartuMerchant,
  keranjangStatus, keteranganRef, labelStatusSumber, periodeQrAktif, ringkasAngkaBesar, riwayatMerchant,
  ringkasTracking, saringMerchantTerverifikasi, segmenDonat, temukanMerchant, warnaLembut,
  kelasAlamatMerchant, kueriPetaMerchant, daftarMerchantPeta, kelompokkanMerchantPeta, ringkasMerchantPeta,
} from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

// ── (1) Blok produksi dieksekusi apa adanya ─────────────────────────────────
const sumberApi = readFileSync(fileURLToPath(new URL('../api/rolemapping.ts', import.meta.url)), 'utf8');
const AWAL = '// <<PANAH-AWAL>>';
const AKHIR = '// <<PANAH-AKHIR>>';
const iAwal = sumberApi.indexOf(AWAL);
const iAkhir = sumberApi.indexOf(AKHIR);
asa('penanda blok ekstraksi ada di api/rolemapping.ts', iAwal >= 0 && iAkhir > iAwal, true);

const potongan = sumberApi.slice(iAwal + AWAL.length, iAkhir);
const {
  FIELD_TM, ambilLiteralTrackingMID, ratakanMerchantTm, ambilRingkasanSumber, ambilDistribusiSumber,
  ambilLiteralPeriodeQr, rapikanPeriodeQr,
} = new Function(
  `${potongan}\nreturn { FIELD_TM, ambilLiteralTrackingMID, ratakanMerchantTm, ambilRingkasanSumber, ambilDistribusiSumber, ambilLiteralPeriodeQr, rapikanPeriodeQr };`
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
      "jenis_qr": "QR API",
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
asa('bentuk baris = whitelist + penanda riwayat + identitas induk', kunciBaris, [
  'alamat', 'branchCode', 'idxRiwayat', 'jenisPengajuan', 'jenisQr', 'jenisQrInduk', 'jenisUsaha',
  'kabupatenKota', 'kecamatan', 'kelurahan', 'kodePos', 'kotaInduk', 'kriteria', 'kriteriaInduk',
  'lastUpdate', 'mid', 'merchantSegment', 'namaMerchant', 'namaMerchantInduk', 'provinsi',
  'provinsiInduk', 'refNo', 'referralCode', 'status', 'statusTerakhir', 'sumberOnboarding',
  'tglPengajuan', 'totalRiwayat',
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
asa('riwayat satu MID, urutan sumber (idx 1 dulu)', riwayat.map((r) => r.tglPengajuan), ['2026-10-22 20:05:59', '2025-01-09 08:00:00']);
asa('riwayat MID lain tidak ikut', riwayatMerchant(baris, '601771072').length, 1);

// Panel Aktivitas: kotak cari harus berakhir di MID yang benar sebelum jejaknya dibuka.
// Semantiknya disamakan dengan searchTrackingMID() sumber: MID persis atau nama induk.
asa('cari jejak: MID persis', temukanMerchant(baris, '601741069'), '601741069');
asa('cari jejak: MID persis dengan spasi di tepi', temukanMerchant(baris, ' 601741069 '), '601741069');
asa('cari jejak: nama merchant', temukanMerchant(baris, 'aisa'), '601741069');
asa('cari jejak: awalan MID tidak dikenali sumber → null', temukanMerchant(baris, '601771'), null);
asa('cari jejak: potongan MID → null', temukanMerchant(baris, '6017'), null);
asa('cari jejak: kata kunci asing → null', temukanMerchant(baris, 'surabaya tidak ada'), null);
asa('cari jejak: kueri kosong → null', temukanMerchant(baris, '   '), null);
asa('keterangan ref: sumber peka huruf besar/kecil', [keteranganRef('Reject by PTEN'), keteranganRef('Rejected By Approver 1'), keteranganRef('rejected by approver 1'), keteranganRef('Active')],
  ['FDS NMR v5.2 Compliance Check', 'FDS NMR v5.2 Compliance Check', 'Lifecycle Onboarding Stage', 'Lifecycle Onboarding Stage']);
asa('badge status: Active selalu tertulis NMID Terbit', [labelStatusSumber('Active'), labelStatusSumber('active'), labelStatusSumber('Rejected By Approver 1'), labelStatusSumber('Send To Cardlink'), labelStatusSumber('')],
  ['Active (NMID Terbit)', 'Active (NMID Terbit)', 'Rejected By Approver 1', 'Send To Cardlink', 'In Process']);

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

// ── (3b) Kartu MID & urutan event: sama dengan renderMIDDetail() sumber ─────
// Terukur 2026-10-29 di sumber: kartu membaca objek INDUK (nama/kriteria/kota/provinsi/
// status_terakhir), tabel merender event apa adanya. MID 666100032 adalah kasus nyata
// yang membedakan keduanya: kriteria induk UMI vs event terakhir UKE, status induk Active
// vs event terbaru ditolak, dan urutan tersimpan tidak kronologis.
const HTML_PARITAS = `<html><body><script>
  const trackingMIDDatabase = [
    {
      "mid": "666100032", "nama_merchant": "Induk Merchant QA", "kriteria": "(UMI) Usaha Mikro",
      "kota": "Blitar", "provinsi": "Jawa Timur", "status_terakhir": "Active", "status": "Active",
      "events": [
        { "mid": "666100032", "nama_merchant": "Nama Event Saja", "ref_no": "REF-A",
          "jenis_pengajuan": "Edit Merchant Data Non PTEN", "jenis_qr": "QR Sticker & API",
          "tgl_pengajuan": "2026-07-30 18:14:01", "last_update": "2026-07-30 18:14:01",
          "status": "Active", "kriteria_merchant": "(UMI) Usaha Mikro",
          "kabupaten_kota": "Blitar", "provinsi": "Jawa Timur" },
        { "mid": "666100032", "nama_merchant": "Nama Event Saja", "ref_no": "REF-B",
          "jenis_pengajuan": "Edit Merchant Data PTEN", "jenis_qr": "QR Sticker & API",
          "tgl_pengajuan": "2026-09-17 17:41:36", "last_update": "2026-09-17 17:41:36",
          "status": "Rejected By Approver 1", "kriteria_merchant": "(UKE) Usaha Kecil",
          "kabupaten_kota": "Blitar", "provinsi": "Jawa Timur" },
        { "mid": "666100032", "nama_merchant": "Nama Event Saja", "ref_no": "REF-C",
          "jenis_pengajuan": "Edit Merchant Data Non PTEN", "jenis_qr": "QR Sticker & API",
          "tgl_pengajuan": "2026-06-30 14:00:00", "last_update": "2026-06-30 14:00:00",
          "status": "Active", "kriteria_merchant": "(UMI) Usaha Mikro",
          "kabupaten_kota": "Blitar", "provinsi": "Jawa Timur" }
      ]
    }
  ];
</script></body></html>`;
const paritas = ratakanMerchantTm(ambilLiteralTrackingMID(HTML_PARITAS));
const jejakParitas = riwayatMerchant(paritas, '666100032');
const kartuParitas = kartuMerchant(jejakParitas);
asa('urutan event = urutan tersimpan sumber, bukan tanggal', jejakParitas.map((r) => r.refNo), ['REF-A', 'REF-B', 'REF-C']);
asa('kartu: nama dari induk', kartuParitas.nama, 'Induk Merchant QA');
asa('kartu: kriteria dari induk, bukan event terakhir', kartuParitas.kriteria, '(UMI) Usaha Mikro');
asa('kartu: status dari status_terakhir induk, bukan event terbaru', kartuParitas.status, 'Active (NMID Terbit)');
asa('kartu: lokasi kota • provinsi induk', kartuParitas.lokasi, 'Blitar • Jawa Timur');
asa('kartu: MID seperti sumber', kartuParitas.mid, '666100032');
asa('kartu kosong → null', kartuMerchant([]), null);
asa('kartu tanpa status_terakhir jatuh ke status event terakhir',
  kartuMerchant(riwayatMerchant(baris, '601741069')).status, 'Active (NMID Terbit)');
asa('cari jejak: nama induk dikenali', temukanMerchant(paritas, 'induk merchant'), '666100032');
asa('cari jejak: nama event saja tidak dikenali (sumber memakai nama induk)', temukanMerchant(paritas, 'nama event'), null);
asa('kartu muatan lama tanpa kolom induk tetap terisi',
  [kartuMerchant(riwayatMerchant(baris, '601771072')).nama, kartuMerchant(riwayatMerchant(baris, '601771072')).lokasi],
  ['UD IVAN JAYA 2', 'Tapanuli Tengah • Sumatera Utara']);


// Terukur 2026-10-28: tiga percobaan unduhan ke 154.19.37.201 → 8,5 s; 52,5 s;
// dan satu terpotong di 60 s (41.743 byte dari 793.373).
const neonSync = readFileSync(fileURLToPath(new URL('../src/utils/neonSync.ts', import.meta.url)), 'utf8');
const maxDur = Number((sumberApi.match(/export const maxDuration = (\d+)/) || [])[1]);
const abort = Number((sumberApi.match(/UNDUH_ABORT_MS = (\d+)_000/) || [])[1]);
const klien = Number((neonSync.match(/&ambil=1`.*?, (\d+)_000, 0/) || [])[1]);
asa('fungsi punya maxDuration 60 s (konvensi repo untuk kerja lambat)', maxDur, 60);
asa('abort unduhan (50 s) di dalam anggaran fungsi', abort > 0 && abort < maxDur, true);
asa('timeout klien (75 s) lebih panjang dari fungsi', klien > maxDur, true);
asa('unduhan terpotong ditolak, bukan diimpor setengah',
  [sumberApi.includes('terpotong'), sumberApi.includes('html.length < diharapkan * 0.98')], [true, true]);
asa('balasan HTML dikenali sebagai rute belum ter-deploy', /belum terpasang di server/.test(neonSync), true);

// ── (5) Batas 12 fungsi api/ milik Vercel Hobby ─────────────────────────────
// Terukur 2026-10-28: commit yang membuat api/ berisi 13 berkas menggagalkan SEMUA
// deployment ("Deployment has failed", dpl_FFmNL8yunpsrUKu7pTKLrwYBYfLc), dan produksi
// tetap menyajikan bundel lama. Karena itu rute Tracking Merchant menumpang di fungsi
// Role Mapping (?tm=1), bukan berkas sendiri.
const apiTs = readdirSync(fileURLToPath(new URL('../api/', import.meta.url))).filter((f) => f.endsWith('.ts'));
asa('api/ tidak melewati 12 fungsi (batas Hobby)', apiTs.length <= 12, true);
asa('api/tracking-merchant.ts tidak kembali sebagai berkas ke-13', apiTs.includes('tracking-merchant.ts'), false);
asa('klien memakai rute gabungan ?tm=1',
  /JALUR_TRACKING_MERCHANT = '\/api\/rolemapping\?tm=1'/.test(neonSync), true);

// ── (6) Kartu ringkasan sumber dibaca apa adanya ────────────────────────────
// Angkanya teks statis di HTML sumber (bukan hasil hitung tabel), jadi satu-satunya
// cara menyamakan tampilan adalah menyalin nilainya saat sync. Fixture di bawah memakai
// struktur markup asli 2026-10-28.
const HTML_KARTU = `<div class="grid">
  <div>
    <span class="text-[10px] font-bold uppercase tracking-wider">Total Merchant Terdata</span>
    <div class="text-3xl font-black text-slate-900 tracking-tight font-mono">5.747.459</div>
    <p class="text-slate-500 text-[11px] mt-1 leading-snug"> Akumulasi 11 batch arsip pendaftaran dari Mei 2021 hingga 22 Oktober 2026. </p>
  </div>
  <div class="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold">
    <span>28 Kolom Standar</span><span class="text-blue-700 font-bold">100% Terarsip</span>
  </div>
  <div>
    <span class="text-[10px] font-bold uppercase tracking-wider">Active &amp; NMID Terbit</span>
    <div class="text-3xl font-black text-emerald-700 tracking-tight font-mono">5.122.585</div>
    <p class="text-slate-500 text-[11px] mt-1 leading-snug"> Tingkat keberhasilan registrasi nasional mencapai <strong>89,1%</strong> dengan NMID aktif. </p>
  </div>
  <div class="pt-3 mt-3 border-t border-emerald-100 flex items-center justify-between text-[10px] font-semibold">
    <span>Standar Nasional ASPI</span><span class="font-bold">Live Transaksi</span>
  </div>
  <div>
    <span class="text-[10px] font-bold uppercase tracking-wider">Reject PTEN (2026 YTD)</span>
    <div class="text-3xl font-black text-red-600 tracking-tight font-mono">132.744</div>
    <p class="text-slate-500 text-[11px] mt-1 leading-snug"> Penolakan meningkat ke <strong>18,4%</strong> di 2026. </p>
  </div>
  <div class="pt-3 mt-3 border-t border-red-100 flex items-center justify-between text-[10px] font-semibold">
    <span>FDS Nama vs MCC &amp; Kodepos</span><span class="font-bold">Butuh Pre-Validation</span>
  </div>
  <div>
    <span class="text-[10px] font-bold uppercase tracking-wider">Digital Onboarding (MOM)</span>
    <div class="text-3xl font-black text-purple-700 tracking-tight font-mono">1.596.280</div>
    <p class="text-slate-500 text-[11px] mt-1 leading-snug"> Registrasi melalui aplikasi <strong>BNI MOM</strong> sejak migrasi pertengahan 2023. </p>
  </div>
  <div class="pt-3 mt-3 border-t border-purple-100 flex items-center justify-between text-[10px] font-semibold">
    <span>74% Porsi Pengajuan 2026</span><span class="font-bold">Saluran Utama</span>
  </div>
</div>`;
const kartu = ambilRingkasanSumber(HTML_KARTU);
asa('empat kartu sumber terbaca', kartu.length, 4);
asa('nilai kartu = nilai di sumber', kartu.map((k) => k.nilai), ['5.747.459', '5.122.585', '132.744', '1.596.280']);
asa('label &amp; di sumber tetap terbaca', kartu[1].label, 'Active & NMID Terbit');
asa('keterangan kartu dibersihkan dari tag', kartu[1].keterangan.includes('<strong>'), false);
asa('kaki kartu terbaca', [kartu[0].kakiKiri, kartu[0].kakiKanan], ['28 Kolom Standar', '100% Terarsip']);
asa('kartu yang tidak ada dilewati, bukan melempar', ambilRingkasanSumber('<html>tanpa kartu</html>'), []);

// ── (7) Kartu distribusi tahunan (2021–2026) ────────────────────────────────
// Enam kartu "Kinerja Onboarding Merchant" juga teks statis; fixture memakai markup
// asli 2026-10-28, termasuk kartu 2026 berbingkai oranye dan bagian sesudahnya.
const HTML_TAHUN = `<html><body>
  <p>TAHUN 2021 — sebutan lama di luar bagian distribusi, tidak boleh terbaca</p>
  <span class="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Distribusi &amp; Pertumbuhan Tahunan</span>
  <div class="grid">
    <div class="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/90">
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-black text-slate-800 font-mono">TAHUN 2021</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">3 Periode</span>
        </div>
        <div class="text-xl font-black text-slate-900 font-mono">1.680.011</div>
        <p class="text-[10px] text-slate-400 font-medium mb-3">Mei – Des 2021</p>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex mb-2.5">
          <div style="width: 92.2%" class="bg-emerald-500 h-full" title="Active: 92.2%"></div>
          <div style="width: 6.4%" class="bg-red-500 h-full" title="Reject PTEN: 6.4%"></div>
          <div style="width: 1.4%" class="bg-slate-300 h-full" title="Others: 1.4%"></div>
        </div>
      </div>
      <div class="pt-2 border-t border-slate-200/60 text-[10px] space-y-1 text-slate-500 font-medium">
        <div class="flex justify-between"><span>Active:</span><strong class="text-emerald-700">1.549.696 (92%)</strong></div>
        <div class="flex justify-between"><span>Reject PTEN:</span><strong class="text-red-600">107.499 (6%)</strong></div>
        <div class="flex justify-between"><span>Channel:</span><span class="text-slate-700 font-semibold">Direct Batch</span></div>
      </div>
    </div>
    <div class="p-4 rounded-2xl bg-orange-50/50 border-2 border-orange-400/80">
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-black text-orange-950 font-mono">TAHUN 2026 YTD</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-200 text-orange-900">Aktif Berjalan</span>
        </div>
        <div class="text-xl font-black text-orange-900 font-mono">720.663</div>
        <p class="text-[10px] text-orange-700 font-medium mb-3">s.d 22 Okt 2026</p>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex mb-2.5">
          <div style="width: 73.6%" class="bg-emerald-500 h-full" title="Active: 73.6%"></div>
          <div style="width: 18.4%" class="bg-red-500 h-full" title="Reject PTEN: 18.4%"></div>
          <div style="width: 8.0%" class="bg-slate-300 h-full" title="Others/Failed: 8.0%"></div>
        </div>
      </div>
      <div class="pt-2 border-t border-orange-200 text-[10px] space-y-1 text-slate-700 font-medium">
        <div class="flex justify-between"><span>Active:</span><strong class="text-emerald-700">530.550 (74%)</strong></div>
        <div class="flex justify-between"><span>Reject PTEN:</span><strong class="text-red-600 font-black">132.744 (18%)</strong></div>
        <div class="flex justify-between"><span>BNI MOM:</span><span class="text-purple-700 font-bold">533.204 (74%)</span></div>
      </div>
    </div>
  </div>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div>ANALISIS REJECT PTEN (NMR 5.2)</div>
    <div class="flex justify-between"><span>Active:</span><strong>999.999 (99%)</strong></div>
  </div>
</body></html>`;
const tahunan = ambilDistribusiSumber(HTML_TAHUN);
asa('kartu tahunan: sebutan di luar bagian tidak ikut', tahunan.length, 2);
asa('kartu tahunan: label & nilai', tahunan.map((k) => [k.label, k.nilai]),
  [['TAHUN 2021', '1.680.011'], ['TAHUN 2026 YTD', '720.663']]);
asa('kartu tahunan: emblem & keterangan', [tahunan[0].emblem, tahunan[0].keterangan], ['3 Periode', 'Mei – Des 2021']);
asa('kartu tahunan: lebar segmen = angka di sumber', tahunan[0].segmen,
  [{ jenis: 'aktif', persen: 92.2 }, { jenis: 'tolak', persen: 6.4 }, { jenis: 'lain', persen: 1.4 }]);
asa('kartu tahunan: baris kaki + nadanya', tahunan[0].kaki.map((k) => [k.label, k.nilai, k.jenis]), [
  ['Active', '1.549.696 (92%)', 'aktif'],
  ['Reject PTEN', '107.499 (6%)', 'tolak'],
  ['Channel', 'Direct Batch', 'saluran'],
]);
asa('kartu tahunan: hanya 2026 YTD yang unggulan',
  [tahunan[0].unggulan, tahunan[1].unggulan], [false, true]);
asa('kartu tahunan: bagian reject sesudahnya tidak ikut terbaca',
  tahunan[1].kaki.map((k) => k.nilai), ['530.550 (74%)', '132.744 (18%)', '533.204 (74%)']);
asa('kartu tahunan: halaman tanpa bagian distribusi → kosong', ambilDistribusiSumber('<html>tanpa kartu</html>'), []);

// ── (8) Komposisi jenis QR: literal PERIODS_MASTER_DATA ────────────────────
// Angka komposisi BUKAN hasil hitung `trackingMIDDatabase` (262 merchant perwakilan),
// melainkan literal terpisah di halaman sumber. Fixture memakai bentuk asli 2026-10-29:
// `qrGroups` adalah OBJEK ber-key nama grup, bukan array.
const HTML_PERIODE = `<html><body><script>
  const PERIODS_MASTER_DATA = {
    "2025": {
      "label": "Tahun 2025", "shortLabel": "2025",
      "totalRawEvents": 503893, "totalUniqueMIDs": 371186, "duplicateEventsEliminated": 132707,
      "qrGroups": {
        "QR Sticker": { "name": "QR Sticker", "rawCount": 470000, "uniqueCount": 350000,
          "pct": 94.29, "dupEliminated": 120000, "desc": "Statis (Meja / Kasir UMKM)",
          "color": "#0284c7", "isApi": false }
      }
    },
    "2026": {
      "label": "Tahun 2026", "shortLabel": "2026",
      "totalRawEvents": 720663, "totalUniqueMIDs": 540939, "duplicateEventsEliminated": 179724,
      "qrGroups": {
        "QR Sticker": { "name": "QR Sticker", "rawCount": 661452, "uniqueCount": 504924,
          "pct": 93.34, "dupEliminated": 156528, "desc": "Statis (Meja / Kasir UMKM)",
          "color": "#0284c7", "isApi": false },
        "QR API": { "name": "QR API", "rawCount": 196, "uniqueCount": 12178,
          "pct": 2.25, "dupEliminated": 1, "desc": "E-Commerce & Payment Gateway API",
          "color": "bg-sky-50", "isApi": true }
      }
    }
  };
  const sesudah = { contoh: ']}' };
</script></body></html>`;

const literalPeriode = ambilLiteralPeriodeQr(HTML_PERIODE);
asa('komposisi: periode terbaca dari literal sumber', Object.keys(literalPeriode), ['2025', '2026']);
const periodeUji = rapikanPeriodeQr(literalPeriode);
asa('komposisi: label & total periode disalin apa adanya',
  [periodeUji['2026'].label, periodeUji['2026'].shortLabel, periodeUji['2026'].totalRawEvents,
    periodeUji['2026'].totalUniqueMIDs, periodeUji['2026'].duplicateEventsEliminated],
  ['Tahun 2026', '2026', 720663, 540939, 179724]);
asa('komposisi: urutan grup = urutan sumber', periodeUji['2026'].qrGroups.map((g) => g.name), ['QR Sticker', 'QR API']);
asa('komposisi: isi grup seperti sumber',
  periodeUji['2026'].qrGroups[0],
  { name: 'QR Sticker', rawCount: 661452, uniqueCount: 504924, pct: 93.34, dupEliminated: 156528,
    desc: 'Statis (Meja / Kasir UMKM)', color: '#0284c7', isApi: false });
asa('komposisi: warna non-hex sumber diganti warna baku', periodeUji['2026'].qrGroups[1].color, '#64748b');
asa('komposisi: penanda API ikut tersalin', periodeUji['2026'].qrGroups[1].isApi, true);

let salahPeriode = '';
try { ambilLiteralPeriodeQr('<html>tanpa komposisi</html>'); } catch (e) { salahPeriode = e.message; }
asa('komposisi: marker hilang → pesan yang menjelaskan', /tidak lagi memuat komposisi/i.test(salahPeriode), true);
asa('sync ikut membawa komposisi QR', /periodeQr: rapikanPeriodeQr\(ambilLiteralPeriodeQr\(html\)\)/.test(sumberApi), true);

// Pemilihan periode di layar
asa('komposisi: default halaman sumber = 2026', PERIODE_QR_DEFAULT, '2026');
asa('komposisi: daftar periode mengikuti literal', daftarPeriodeQr(periodeUji), ['2025', '2026']);
asa('komposisi: periode pilihan dipakai', periodeQrAktif(periodeUji, '2025').label, 'Tahun 2025');
asa('komposisi: kunci tak dikenal jatuh ke 2026', periodeQrAktif(periodeUji, '2019').label, 'Tahun 2026');
asa('komposisi: tanpa 2026 jatuh ke periode pertama', periodeQrAktif({ '2025': periodeUji['2025'] }, '2019').label, 'Tahun 2025');
asa('komposisi: muatan lama tanpa komposisi → null', [periodeQrAktif(undefined, '2026'), daftarPeriodeQr(undefined)], [null, []]);

// Angka & donat
asa('angka ribuan memakai gaya Indonesia', formatAngka(540939), '540.939');
asa('angka donat diringkas seperti sumber',
  [ringkasAngkaBesar(540939), ringkasAngkaBesar(4655815), ringkasAngkaBesar(0)], ['540,9k', '4,66M', '0,0k']);
const cincin = segmenDonat([
  { name: 'A', color: '#111111', rawCount: 1, uniqueCount: 1, pct: 25, dupEliminated: 0, desc: '', isApi: false },
  { name: 'B', color: '#222222', rawCount: 3, uniqueCount: 3, pct: 75, dupEliminated: 0, desc: '', isApi: false },
], 4);
asa('donat: potongan & offset mengikuti pangsa MID unik',
  cincin.map((s) => [s.name, s.color, s.dasharray, s.dashoffset]),
  [['A', '#111111', '62.832 188.496', '0.000'], ['B', '#222222', '188.496 62.832', '-62.832']]);
asa('donat: total nol tidak menghasilkan NaN',
  segmenDonat([{ name: 'A', color: '#111111', rawCount: 0, uniqueCount: 0, pct: 0, dupEliminated: 0, desc: '', isApi: false }], 0)[0].dasharray,
  '0.000 251.327');
asa('donat: satu potongan penuh = keliling cincin (dipakai sebagai keadaan awal animasi)',
  segmenDonat([{ name: 'A', color: '#111111', rawCount: 1, uniqueCount: 1, pct: 100, dupEliminated: 0, desc: '', isApi: false }], 1)[0].dasharray,
  '251.327 0.000');
asa('donat: potongan yang busurnya tak terlihat ditandai, bukan digambar', cincin.map((s) => s.tampil), [true, true]);
const cincinKecil = segmenDonat([
  { name: 'A', color: '#111111', rawCount: 10000, uniqueCount: 10000, pct: 99.99, dupEliminated: 0, desc: '', isApi: false },
  { name: 'B', color: '#222222', rawCount: 1, uniqueCount: 1, pct: 0.01, dupEliminated: 0, desc: '', isApi: true },
], 10001);
asa('donat: porsi 0,01% (0,025 px) dilewati seperti sumber', cincinKecil.map((s) => s.tampil), [true, false]);

// Pil persen & angka MID memakai warna jenis QR dari data, bukan hex komponen.
asa('warna lembut: hex 6 digit jadi rgba', warnaLembut('#7c3aed', 0.14), 'rgba(124, 58, 237, 0.14)');
asa('warna lembut: hex 3 digit dikembangkan', warnaLembut('#0af', 0.5), 'rgba(0, 170, 255, 0.5)');
asa('warna lembut: alfa dijepit 0..1',
  [warnaLembut('#000000', 4), warnaLembut('#000000', -1)], ['rgba(0, 0, 0, 1)', 'rgba(0, 0, 0, 0)']);
asa('warna lembut: bukan hex dikembalikan apa adanya', warnaLembut('var(--x)', 0.2), 'var(--x)');
asa('warna lembut: kosong jatuh ke abu-abu lembut', warnaLembut('', 0.2), 'rgba(100, 116, 139, 0.12)');

// ── (9) Daftar merchant terverifikasi: satu baris per MID ──────────────────
const daftarMid = daftarMerchantTerverifikasi(baris);
asa('daftar MID: satu baris per MID unik, urutan sumber', daftarMid.map((m) => m.mid), ['601741069', '601771072']);
asa('daftar MID: identitas induk; jenis QR induk dipakai, event jadi cadangan',
  [daftarMid[0].nama, daftarMid[0].jenisQr, daftarMid[1].jenisQr], ['AISA PONSEL', 'QR Sticker', 'QR API']);
asa('daftar MID: jumlah log & update event terakhir di urutan sumber',
  [daftarMid[0].jumlahRiwayat, daftarMid[0].lastUpdate], [2, '2025-02-01 09:30:00']);

const cariRekap = (saringan) =>
  saringMerchantTerverifikasi(daftarMid, { ...SARINGAN_REKAP_KOSONG, ...saringan }).map((m) => m.mid);
asa('saringan rekap: pencarian MID', cariRekap({ kueri: '601771' }), ['601771072']);
asa('saringan rekap: pencarian nama & kota',
  [cariRekap({ kueri: 'ivan' }), cariRekap({ kueri: 'tapanuli' })], [['601771072'], ['601771072']]);
asa('saringan rekap: nomor rekening tidak dicari (dipotong parser)', cariRekap({ kueri: '2120' }), []);
asa('saringan rekap: grup QR API / Non-API',
  [cariRekap({ jenisQr: 'GROUP_API' }), cariRekap({ jenisQr: 'GROUP_NON_API' })],
  [['601771072'], ['601741069']]);
asa('saringan rekap: jenis QR persis', cariRekap({ jenisQr: 'QR Sticker' }), ['601741069']);
asa('saringan rekap: multi-log vs satu log',
  [cariRekap({ duplikasi: 'multi' }), cariRekap({ duplikasi: 'single' })],
  [['601741069'], ['601771072']]);

const banyak = Array.from({ length: 45 }, (_, i) => i + 1);
const hal3 = halamanDaftar(banyak, 3, 20);
asa('halaman: potongan terakhir 41–45 dari 45', [hal3.isi.length, hal3.mulai, hal3.akhir, hal3.totalHalaman], [5, 41, 45, 3]);
asa('halaman: nomor di luar rentang dijepit',
  [halamanDaftar(banyak, 9, 20).halaman, halamanDaftar(banyak, 0, 20).halaman], [3, 1]);
const halKosong = halamanDaftar([], 2, 20);
asa('halaman: daftar kosong tidak NaN',
  [halKosong.isi.length, halKosong.mulai, halKosong.akhir, halKosong.totalHalaman, halKosong.total],
  [0, 0, 0, 1, 0]);

// Urutan panel & ukuran halaman di komponen
const komponenTm = readFileSync(
  fileURLToPath(new URL('../src/components/TrackingMerchant/TrackingMerchantManager.tsx', import.meta.url)), 'utf8');
asa('komponen: 20 baris per halaman seperti sumber', /UKURAN_HALAMAN_REKAP = 20/.test(komponenTm), true);
asa('komponen: Aktivitas dirender sebelum Kinerja tahunan',
  komponenTm.indexOf('glass-card tm-aktivitas') >= 0 &&
    komponenTm.indexOf('glass-card tm-aktivitas') < komponenTm.indexOf('glass-card tm-tahunan'), true);
asa('komponen: daftar MID terverifikasi jadi bagian paling bawah, setelah Kinerja tahunan',
  komponenTm.indexOf('glass-card tm-tahunan') >= 0 &&
    komponenTm.indexOf('glass-card tm-tahunan') < komponenTm.indexOf('glass-card tm-rekap'), true);
asa('komponen: komposisi kosong diberi pemberitahuan, bukan angka karangan',
  [komponenTm.includes('tm-qr-nihil'), komponenTm.includes('totalUniqueMIDs:')], [true, false]);
asa('komponen: pemilih periode tersegmentasi seperti sumber',
  [komponenTm.includes('Kumulatif ({periodeKumulatif.shortLabel})'), komponenTm.includes('(Aktif)'),
    komponenTm.includes('Pilih Tahun')], [true, true, true]);
asa('komponen: rekap agregasi bisa diekspor sendiri',
  [komponenTm.includes('Export Excel'), /eksporRekapQr = useCallback/.test(komponenTm),
    komponenTm.includes("'MID Unik (Validasi)'")], [true, true, true]);
asa('komponen: potongan donat tak terlihat dilewati',
  /segmen\s*\.filter\(\(s\) => s\.tampil\)/.test(komponenTm), true);
asa('komponen: pil angka memakai warna jenis QR dari data',
  [/warnaLembut\(g\.color, 0\.14\)/.test(komponenTm), /warnaLembut\(warnaJenis\(m\.jenisQr\), 0\.1\)/.test(komponenTm)],
  [true, true]);
asa('komponen: total rekap menyebut periode & menyatakan 100% unik',
  [komponenTm.includes('TOTAL REKAP ({periodeData.shortLabel})'), komponenTm.includes('100% Unik')],
  [true, true]);

// ── Titik peta: kelas alamat, kueri, kelompok, dan angka panel ─────────────
const barisPeta = [
  {
    mid: 'A1', namaMerchant: 'Toko Satu', namaMerchantInduk: 'Toko Satu',
    alamat: 'Jl. Merdeka No. 10', kelurahan: '', kecamatan: '',
    kabupatenKota: 'Bandung', provinsi: 'Jawa Barat', kotaInduk: 'Kota Bandung', provinsiInduk: 'Jawa Barat',
  },
  {
    mid: 'A2', namaMerchant: 'Toko Dua', namaMerchantInduk: 'Toko Dua',
    alamat: 'Jl. Merdeka No. 10', kelurahan: '', kecamatan: '',
    kabupatenKota: 'Bandung', provinsi: 'Jawa Barat', kotaInduk: 'Kota Bandung', provinsiInduk: 'Jawa Barat',
  },
  {
    mid: 'A3', namaMerchant: 'Toko Tiga', namaMerchantInduk: 'Toko Tiga',
    alamat: 'PANGKALPINANG', kelurahan: '', kecamatan: '',
    kabupatenKota: 'Pangkal Pinang', provinsi: 'Bangka Belitung', kotaInduk: '', provinsiInduk: '',
  },
  {
    mid: 'A4', namaMerchant: 'Toko Empat', namaMerchantInduk: 'Toko Empat',
    alamat: 'tes', kelurahan: '', kecamatan: '',
    kabupatenKota: 'Jakarta Pusat', provinsi: 'DKI Jakarta', kotaInduk: '', provinsiInduk: '',
  },
];
asa('peta: kelas alamat membedakan presisi, kasar, dan tidak valid', [
  kelasAlamatMerchant('Jl. Merdeka No. 10'),
  kelasAlamatMerchant('Lantai 2, Grand Mall, Sudirman'),
  kelasAlamatMerchant('Jakarta Pusat, Tanah Abang'),
  kelasAlamatMerchant('Desa Passo'),
  kelasAlamatMerchant('tes'),
  kelasAlamatMerchant('8398'),
  kelasAlamatMerchant('http://192.168.123.132'),
  kelasAlamatMerchant(''),
], ['presisi', 'presisi', 'kasar', 'kasar', 'tidak-valid', 'tidak-valid', 'tidak-valid', 'tidak-valid']);
asa('peta: kueri tidak mengulang kota yang sudah ada di alamat',
  kueriPetaMerchant({ alamat: 'Jl. Merdeka No. 10, Bandung', kota: 'Kota Bandung', provinsi: 'Jawa Barat' }),
  'Jl. Merdeka No. 10, Bandung, Jawa Barat, Indonesia');
asa('peta: kueri menambah kota dan negara bila belum ada',
  kueriPetaMerchant({ alamat: 'Jl. Merdeka No. 10', kota: 'Bandung', provinsi: 'Jawa Barat' }),
  'Jl. Merdeka No. 10, Bandung, Jawa Barat, Indonesia');
const petaA = daftarMerchantPeta(barisPeta);
asa('peta: satu baris per MID dengan identitas induk',
  [petaA.length, petaA.map((m) => m.mid)], [4, ['A1', 'A2', 'A3', 'A4']]);
asa('peta: alamat tidak valid tidak punya kueri', petaA.find((m) => m.mid === 'A4').kueri, '');
const kelPresisi = kelompokkanMerchantPeta(petaA);
asa('peta: kelompok bawaan hanya alamat presisi, satu busur per alamat',
  [kelPresisi.length, kelPresisi[0].merchants.length], [1, 2]);
const kelSemua = kelompokkanMerchantPeta(petaA, true);
asa('peta: alamat perkiraan ikut bila diminta',
  [kelSemua.length, kelSemua.some((k) => k.kelas === 'kasar')], [2, true]);
asa('peta: ringkasan menghitung titik unik, bukan baris', ringkasMerchantPeta(petaA),
  { total: 4, presisi: 2, kasar: 1, tidakValid: 1, titikPresisi: 1, titikKasar: 1 });

// Animasi chart: cincin digambar setelah frame pertama, bilah & legenda lewat CSS,
// dan semuanya harus dimatikan saat pengguna memilih reduced motion.
const gayaTm = readFileSync(fileURLToPath(new URL('../src/styles/index.css', import.meta.url)), 'utf8');
asa('komponen: cincin digambar bertahap dan diulang saat periode berganti',
  [/KELILING_DONAT = \(2 \* Math\.PI \* 40\)\.toFixed\(3\)/.test(komponenTm),
    /const CincinKomposisi[\s\S]*requestAnimationFrame\(\(\) => setSiap\(true\)\)/.test(komponenTm),
    /<CincinKomposisi/.test(komponenTm), /key=\{kunciPeriodeAktif\}/.test(komponenTm)],
  [true, true, true, true]);
asa('komponen: kartu galat memakai kelas, bukan gaya inline',
  [komponenTm.includes('glass-card tm-galat'), komponenTm.includes("fontSize: '0.84rem'")], [true, false]);
asa('komponen: kartu kepala memakai kelas, bukan gaya inline',
  [komponenTm.includes('glass-card tm-kepala-kartu'), komponenTm.includes("marginBottom: '1rem'"),
    /\.tm-kepala-kartu \{ margin-bottom: 1rem; \}/.test(gayaTm), /\.tm-kepala-judul \{/.test(gayaTm)],
  [true, false, true, true]);
asa('gaya: animasi chart tersedia (cincin, bilah, legenda, kartu tahunan, ringkasan)',
  ['@keyframes tm-muncul', '@keyframes tm-bilah', '@keyframes tm-naik', '.tm-donat circle',
    '.tm-qr-bar-track > i', '.tm-tahun-seg', '.tm-ringkasan .tm-kartu']
    .map((kunci) => gayaTm.includes(kunci)),
  [true, true, true, true, true, true, true]);
asa('gaya: animasi dimatikan saat prefers-reduced-motion',
  /prefers-reduced-motion: reduce[\s\S]{0,200}animation-duration: 0\.001ms/.test(gayaTm), true);
asa('gaya: panel tujuan gulir tidak tertutup topbar lengket',
  /\.tm-aktivitas,\s*\n\.tm-rekap \{\s*\n\s*scroll-margin-top: 4\.2rem;/.test(gayaTm), true);

console.log(gagal === 0 ? 'SEMUA LULUS' : `${gagal} UJIAN GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
