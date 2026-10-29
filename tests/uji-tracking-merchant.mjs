// Tracking Merchant — uji angka turunan, kolom ekspor, dan pemilihan periode yang
// dibaca tabel. Menu ini hanya menampilkan muatan tersimpan, jadi fixture-nya berbentuk
// `BarisMerchant` langsung (tidak ada lagi parser sumber yang perlu dijalankan).
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-tracking-merchant.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFINISI_KOLOM_TM, KOLOM_EKSPOR_TM, KOLOM_TM, KUNCI_STORAGE_TRACKING, KETERANGAN_STATUS,
  LABEL_KERANJANG, PERIODE_QR_DEFAULT, SARINGAN_REKAP_KOSONG, barisKeExcelTm, cocokCari,
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

// ── (1) Fixture muatan tersimpan ────────────────────────────────────────────
// Bentuk baris = `BarisMerchant` (lihat src/utils/trackingMerchant.ts). Kolom
// sensitif memang tidak ada di sini karena muatan cloud tidak pernah memuatnya.
const buatBaris = (o) => ({
  mid: '', namaMerchant: '', kriteria: '', jenisPengajuan: '', jenisQr: '', tglPengajuan: '',
  lastUpdate: '', status: '', refNo: '', sumberOnboarding: '', merchantSegment: '', branchCode: '',
  alamat: '', provinsi: '', kabupatenKota: '', kecamatan: '', kelurahan: '', kodePos: '',
  jenisUsaha: '', referralCode: '', totalRiwayat: 1, idxRiwayat: 1, ...o,
});

const INDUK_1 = {
  mid: '601741069', namaMerchant: 'AISA PONSEL', namaMerchantInduk: 'AISA PONSEL',
  kriteria: '(UME) Usaha Menengah', kriteriaInduk: '(UME) Usaha Menengah', jenisQr: 'QR Sticker',
  provinsi: 'Sumatera Utara', kabupatenKota: 'Mandailing Natal', kecamatan: 'Siabu',
  kelurahan: 'Aek Mual', kodePos: '22976', alamat: 'LINTAS BARAT PANYABUNGAN',
  jenisUsaha: 'TELECOMMUNICATION EQUIPMENT & TELEPHONE SALES', totalRiwayat: 2,
};
const baris = [
  buatBaris({
    ...INDUK_1, idxRiwayat: 1, jenisPengajuan: 'Edit Settlement Type',
    tglPengajuan: '2026-10-22 20:05:59', lastUpdate: '2026-10-22 20:05:59',
    status: 'On Progress Approver 1', refNo: 'REF2629501349218', sumberOnboarding: 'BNI MOM',
    merchantSegment: 'RR0 - Retail', branchCode: '60108801 - PANYABUNGAN', referralCode: 'RF-2026-A',
  }),
  buatBaris({
    ...INDUK_1, idxRiwayat: 2, jenisPengajuan: 'Add New Merchant',
    tglPengajuan: '2025-01-09 08:00:00', lastUpdate: '2025-02-01 09:30:00',
    status: 'Active', refNo: 'REF2510000000001', sumberOnboarding: 'N/A',
    merchantSegment: '-', branchCode: '60108801 - PANYABUNGAN', referralCode: '-',
  }),
  buatBaris({
    mid: '601771072', namaMerchant: 'UD IVAN JAYA 2', namaMerchantInduk: 'UD IVAN JAYA 2',
    kriteria: '(UME) Usaha Menengah', kriteriaInduk: '(UME) Usaha Menengah',
    jenisPengajuan: 'Edit Settlement Type', jenisQr: 'QR Sticker', jenisQrInduk: 'QR API',
    tglPengajuan: '2026-10-22 20:05:58', lastUpdate: '2026-10-22 20:05:58',
    status: 'Reject by PTEN', refNo: 'REF2629501349216',
    provinsi: 'Sumatera Utara', kabupatenKota: 'Tapanuli Tengah',
    branchCode: '60107702 - PADANG SIDEMPUAN',
  }),
];

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
asa('kolom yang kosong di muatan tetap kosong di Excel', excel[2]['Segmen Merchant'], '');
asa('kunci storage cloud & lokal sama', KUNCI_STORAGE_TRACKING, 'tracking_merchant_data');

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

asa('20 kolom sumber + 2 kolom turunan', KOLOM_TM.length - 2, 20);
for (const k of ['aktif', 'proses', 'tolak', 'lain']) {
  asa(`penjelasan keranjang ${k} ada`, KETERANGAN_STATUS[k].length > 20, true);
}
asa('penjelasan Reject mengatakan alasannya tidak ada di sumber', /tidak menyertakan kolom alasan/.test(KETERANGAN_STATUS.tolak), true);
asa('muatan tidak punya kolom nmid — angka itu rekaan halaman sumber', Object.keys(baris[0]).includes('nmid'), false);

// ── (3b) Kartu MID & urutan event ──────────────────────────────────────────
// Kartu membaca identitas INDUK (nama/kriteria/kota/provinsi/status terakhir),
// tabel merender event apa adanya. MID 666100032 adalah kasus nyata yang membedakan
// keduanya: kriteria induk UMI vs event terakhir UKE, status induk Active vs event
// terbaru ditolak, dan urutan tersimpan tidak kronologis.
const INDUK_PARITAS = {
  mid: '666100032', namaMerchant: 'Nama Event Saja', namaMerchantInduk: 'Induk Merchant QA',
  kriteriaInduk: '(UMI) Usaha Mikro', kotaInduk: 'Blitar', provinsiInduk: 'Jawa Timur',
  statusTerakhir: 'Active', jenisQr: 'QR Sticker & API', provinsi: 'Jawa Timur',
  kabupatenKota: 'Blitar', totalRiwayat: 3,
};
const paritas = [
  buatBaris({ ...INDUK_PARITAS, idxRiwayat: 1, refNo: 'REF-A', jenisPengajuan: 'Edit Merchant Data Non PTEN',
    tglPengajuan: '2026-07-30 18:14:01', lastUpdate: '2026-07-30 18:14:01', status: 'Active' }),
  buatBaris({ ...INDUK_PARITAS, idxRiwayat: 2, refNo: 'REF-B', jenisPengajuan: 'Edit Merchant Data PTEN',
    tglPengajuan: '2026-09-17 17:41:36', lastUpdate: '2026-09-17 17:41:36', status: 'Rejected By Approver 1' }),
  buatBaris({ ...INDUK_PARITAS, idxRiwayat: 3, refNo: 'REF-C', jenisPengajuan: 'Edit Merchant Data Non PTEN',
    tglPengajuan: '2026-06-30 14:00:00', lastUpdate: '2026-06-30 14:00:00', status: 'Active' }),
];
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



// ── (5) Batas 12 fungsi api/ milik Vercel Hobby ─────────────────────────────
// Terukur 2026-10-28: commit yang membuat api/ berisi 13 berkas menggagalkan SEMUA
// deployment ("Deployment has failed", dpl_FFmNL8yunpsrUKu7pTKLrwYBYfLc), dan produksi
// tetap menyajikan bundel lama. Karena itu muatan Tracking Merchant dibaca lewat fungsi
// Role Mapping (?tm=1), bukan berkas sendiri.
const neonSync = readFileSync(fileURLToPath(new URL('../src/utils/neonSync.ts', import.meta.url)), 'utf8');
const apiTs = readdirSync(fileURLToPath(new URL('../api/', import.meta.url))).filter((f) => f.endsWith('.ts'));
asa('api/ tidak melewati 12 fungsi (batas Hobby)', apiTs.length <= 12, true);
asa('api/tracking-merchant.ts tidak kembali sebagai berkas ke-13', apiTs.includes('tracking-merchant.ts'), false);
asa('klien memakai rute gabungan ?tm=1',
  /JALUR_TRACKING_MERCHANT = '\/api\/rolemapping\?tm=1'/.test(neonSync), true);

// ── (8) Komposisi jenis QR: muatan tersimpan ────────────────────────────────
// Angka komposisi adalah literal data lake nasional yang tersimpan apa adanya;
// jangan diturunkan dari `baris` (262 merchant perwakilan).
const periodeUji = {
  '2025': {
    label: 'Tahun 2025', shortLabel: '2025',
    totalRawEvents: 503893, totalUniqueMIDs: 371186, duplicateEventsEliminated: 132707,
    qrGroups: [
      { name: 'QR Sticker', rawCount: 470000, uniqueCount: 350000, pct: 94.29,
        dupEliminated: 120000, desc: 'Statis (Meja / Kasir UMKM)', color: '#0284c7', isApi: false },
    ],
  },
  '2026': {
    label: 'Tahun 2026', shortLabel: '2026',
    totalRawEvents: 720663, totalUniqueMIDs: 540939, duplicateEventsEliminated: 179724,
    qrGroups: [
      { name: 'QR Sticker', rawCount: 661452, uniqueCount: 504924, pct: 93.34,
        dupEliminated: 156528, desc: 'Statis (Meja / Kasir UMKM)', color: '#0284c7', isApi: false },
      { name: 'QR API', rawCount: 196, uniqueCount: 12178, pct: 2.25,
        dupEliminated: 1, desc: 'E-Commerce & Payment Gateway API', color: '#64748b', isApi: true },
    ],
  },
};

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
asa('saringan rekap: nomor rekening tidak dicari (tidak ada di muatan)', cariRekap({ kueri: '2120' }), []);
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
asa('komponen: tidak ada lagi tombol/aksi Sync Data',
  [/Sync Data/.test(komponenTm), /handleSync/.test(komponenTm), /syncTrackingMerchantDariSumber/.test(neonSync)],
  [false, false, false]);
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
