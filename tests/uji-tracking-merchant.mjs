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
const sumberApi = readFileSync(fileURLToPath(new URL('../api/rolemapping.ts', import.meta.url)), 'utf8');
const AWAL = '// <<PANAH-AWAL>>';
const AKHIR = '// <<PANAH-AKHIR>>';
const iAwal = sumberApi.indexOf(AWAL);
const iAkhir = sumberApi.indexOf(AKHIR);
asa('penanda blok ekstraksi ada di api/rolemapping.ts', iAwal >= 0 && iAkhir > iAwal, true);

const potongan = sumberApi.slice(iAwal + AWAL.length, iAkhir);
const { FIELD_TM, ambilLiteralTrackingMID, ratakanMerchantTm, ambilRingkasanSumber } = new Function(
  `${potongan}\nreturn { FIELD_TM, ambilLiteralTrackingMID, ratakanMerchantTm, ambilRingkasanSumber };`
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

// ── (4) Penjaga waktu: sumber lambat, jangan sampai fungsi mati diam-diam ──
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

console.log(gagal === 0 ? 'SEMUA LULUS' : `${gagal} UJIAN GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
