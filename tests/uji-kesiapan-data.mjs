// Checklist Kesiapan Data (Data Analyst Engine).
// Yang dijaga di sini bukan labelnya, tapi dua aturan yang kalau dilanggar membuat
// alur rusak: (a) data contoh bawaan tidak boleh dihitung siap, dan (b) melepas
// Mapping Role = Fase 3 DILEWATI, bukan "belum selesai" — tanpa keadaan ketiga ini
// tombol "Masuk ke Data Final" tidak pernah aktif lagi.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-kesiapan-data.mjs
import {
  SUMBER_ANALISA, alasanFaseTerkunci, catatanSumber, executeAnalystPipeline, faseWajib, halanganNyalakanRole,
  hitungKesiapan, jumlahBarisDilewati, nilaiKesiapan, sumberFase, statusFase,
} from './out/entry-uji.js';

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

// Jumlah contoh bawaan sumber wajib dipinjam dari bentuk aslinya: PTEN & Role punya
// seed, Wilayah & Cabang tidak (keduanya murni diisi operator).
const CONTOH = { pten: 620, kodepos: 139, wilayah: 0, cabang: 0, role: 40 };
const PENUH = { pten: 1200, kodepos: 40846, wilayah: 17, cabang: 3200, role: 900 };

const siap = (bahan, roleDipakai = true) => hitungKesiapan({ ...PENUH, ...bahan }, CONTOH, roleDipakai);

// 1. Peta sumber → fase harus sama dengan kartu fase di layar
asa('Fase  = PTEN + Kode Pos', sumberFase(1).map((d) => d.kunci), ['pten', 'kodepos']);
asa('Fase 2 = Wilayah + Cabang', sumberFase(2).map((d) => d.kunci), ['wilayah', 'cabang']);
asa('Fase 3 = Mapping Role saja', sumberFase(3).map((d) => d.kunci), ['role']);

// 2. Hanya Mapping Role yang boleh dilepas
asa('empat sumber wajib, satu opsional', [SUMBER_ANALISA.filter((d) => d.wajib).length, SUMBER_ANALISA.filter((d) => !d.wajib).length], [4, 1]);
asa('opsionalnya persis Mapping Role', SUMBER_ANALISA.filter((d) => !d.wajib).map((d) => d.kunci), ['role']);
asa('Fase 1 & 2 wajib, Fase 3 opsional', [1, 2, 3].map((f) => faseWajib(f)), [true, true, false]);

// 3. Data contoh bawaan BUKAN siap — ini alasan badge lama menipu
asa('kodepos seed = contoh, bukan siap', nilaiKesiapan(139, 139), 'contoh');
asa('kodepos kosong = kosong, bukan contoh', nilaiKesiapan(0, 139), 'kosong');
asa('sumber tanpa seed: 1 baris sudah siap', nilaiKesiapan(1, 0), 'siap');
asa('sumber di atas seed = siap', nilaiKesiapan(140, 139), 'siap');

const seedKodePos = siap({ kodepos: 139 });
asa('seed kodepos tidak membuat Fase 1 siap', statusFase(1, seedKodePos), 'terkunci');
asa('Fase 2 tidak ikut terkunci oleh seed kodepos', statusFase(2, seedKodePos), 'siap');
asa('alasan kunci menyebut sumbernya', alasanFaseTerkunci(1, seedKodePos).includes('Kode Pos (139)'), true);

const cabangKosong = siap({ cabang: 0 });
asa('cabang kosong mengunci Fase 2', [statusFase(2, cabangKosong), statusFase(1, cabangKosong)], ['terkunci', 'siap']);
asa('alasan kunci Fase 2 kosong', alasanFaseTerkunci(2, siap({ wilayah: 0 })).includes('belum terisi'), true);
asa('fase siap tidak punya alasan kunci', alasanFaseTerkunci(3, siap({})), '');

// 4. Lepas Mapping Role = Fase 3 DILEWATI, fase lain tidak tersentuh
const kesiapanFull = siap({});
asa('semua sumber penuh = semua fase siap', [1, 2, 3].map((f) => statusFase(f, kesiapanFull)), ['siap', 'siap', 'siap']);
const roleOff = siap({}, false);
asa('role lepas = Fase 3 dilewati', statusFase(3, roleOff), 'dilewati');
asa('role lepas tidak menutup Fase 1 & 2', [1, 2].map((f) => statusFase(f, roleOff)), ['siap', 'siap']);
asa('Fase 1 & 2 tidak pernah bisa "dilewati"', [1, 2].map((f) => statusFase(f, roleOff) === 'dilewati'), [false, false]);
asa('role lepas = sumbernya tidak dipakai', roleOff.role.dipakai, false);
asa('sumber wajib tetap dipakai walau role lepas', [roleOff.pten.dipakai, roleOff.cabang.dipakai], [true, true]);

// 5. Role tanpa isi tidak bisa dipaksakan ikut: centang on tetap berarti Fase 3 dilewati,
//    supaya gerbang layar dan mesin tidak bisa berbeda pendapat.
const roleKosong = siap({ role: 0 }, true);
asa('role kosong = tidak dipakai meski dicentang', [roleKosong.role.status, roleKosong.role.dipakai], ['kosong', false]);
asa('role kosong = Fase 3 ikut dilewati, bukan jalan di atas tabel kosong', statusFase(3, roleKosong), 'dilewati');

// 6. Menyalakan role belakangan tidak boleh diam-diam melewati baris yang sudah final
asa('final ada & role sedang lepas = ditolak', typeof halanganNyalakanRole(false, 1500), 'string');
asa('pesan penolakan menyebut Final Data', halanganNyalakanRole(false, 1500).includes('Data Final'), true);
asa('final kosong = boleh menyalakan', halanganNyalakanRole(false, 0), null);
asa('role sudah dipakai = bukan perubahan, tidak dilarang', halanganNyalakanRole(true, 1500), null);

// 7. Penghitung baris dilewati hanya melihat tanda mesin, bukan tebakan
asa('hitung baris bertanda', jumlahBarisDilewati([{ fase3Dilewati: true }, { fase3Dilewati: false }, {}, { fase3Dilewati: true }]), 2);
asa('tanpa baris = 0', jumlahBarisDilewati([]), 0);

// 8. Catatan sumber untuk ekspor: hasil tanpa Fase 3 harus bedanya terlihat
asa('catatan role on', catatanSumber(kesiapanFull).includes('tidak diikutkan'), false);
asa('catatan role off menyebut Fase 3 dilewati', catatanSumber(roleOff).includes('Fase 3 dilewati'), true);
asa('daftar sumber on memuat lima label', (catatanSumber(kesiapanFull).match(/,/g) || []).length, 4);

// 9. Mesin: `roleDipakai: false` harus benar-benar melewati Fase 3, bukan
//    menjalankan Fase 3 di atas tabel kosong (itu yang menghasilkan 'ANOMALI' palsu).
const cabang = (o) => ({
  Wilayah: '', 'Branch Code': '', 'Kode Cabang': '', 'Sandi Cabang': '', Sandi: '', Cabang: '',
  'Nama Outlet': '', 'Status Outlet': '', ALAMAT: '', 'KODE POS': '', Kelurahan: '', Kecamatan: '',
  'Dati II': '', Provinsi: '', ...o,
});
const masterCabangRows = [
  cabang({ 'Sandi Cabang': '03100001', 'Branch Code': '03100001', 'Kode Cabang': '03100001', Sandi: '031', Cabang: 'BANDUNG', 'Nama Outlet': 'BANDUNG ASIA AFRIKA', 'Status Outlet': 'KC', ALAMAT: 'JL ASIA AFRIKA 126 BANDUNG', 'KODE POS': '40111', Kelurahan: 'BRAGA', Kecamatan: 'SUMUR BANDUNG', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
];
const kodePosList = [
  { kodePos: '40111', kelurahan: 'BRAGA', kecamatan: 'SUMUR BANDUNG', kabupatenKota: 'BANDUNG', provinsi: 'JAWA BARAT', status: 'AKTIF', latitude: -6.915, longitude: 107.61 },
];
const ptenList = [{ kodePosPten: '40111', kotaPten: 'BANDUNG', kotaPtenMax15: 'BANDUNG', status: 'AKTIF' }];
const wilayahSettings = [{
  wilayah: 'W1', sandiCabang: '03100001', branchCode: '03100001', kodeCabang: '03100001',
  namaOutlet: 'BANDUNG ASIA AFRIKA', statusOutlet: 'KC', alamat: 'JL ASIA AFRIKA 126 BANDUNG',
  kodePos: '40111', kelurahan: 'BRAGA', kecamatan: 'SUMUR BANDUNG', dati2: 'BANDUNG', provinsi: 'JAWA BARAT',
}];
const roleList = [{ organisasiTujuan: 'BANDUNG ASIA AFRIKA BRANCH OFFICE', qrsCabsal: 1, qrsCabapv1: 1, qrsCabapv2: 1, grandTotal: 3 }];

const jalankan = (roleDipakai) =>
  executeAnalystPipeline(masterCabangRows, ptenList, kodePosList, wilayahSettings, roleList, undefined, false, undefined, undefined, 3, undefined, roleDipakai);
const antrean = (rows) => rows.filter((r) => r.kategori !== 'TIDAK_ANALISA');

const denganRole = antrean((await jalankan(true)).rows);
const tanpaRole = antrean((await jalankan(false)).rows);

asa('run kecil menghasilkan baris', [denganRole.length, tanpaRole.length], [1, 1]);
asa('role on: Fase 3 dihitung dan role terpasang', [!!denganRole[0].fase3Dilewati, denganRole[0].organisasiTujuan !== ''], [false, true]);
asa('role off: baris ditandai dilewati', [tanpaRole[0].fase3Dilewati, tanpaRole[0].organisasiTujuan, tanpaRole[0].is3RoleLengkap], [true, '', false]);
asa('role off: tidak ada role yang tertempel', tanpaRole.some((r) => r.organisasiTujuan || r.tipeUnit !== 'OUTLET' || r.roleGrandTotal), false);
// Melewati Fase 3 tidak boleh mengubah hasil Fase 1 & 2 — kalau berubah, centangan itu
// diam-diam mengganti perhitungan yang sudah disetujui operator.
asa('Fase 1 & 2 identik dengan atau tanpa role',
  denganRole.map((r) => `${r.kelurahan}|${r.kodePosPten}|${r.namaOutlet}|${r.wilayah}`),
  tanpaRole.map((r) => `${r.kelurahan}|${r.kodePosPten}|${r.namaOutlet}|${r.wilayah}`));

console.log(gagal === 0 ? 'SEMUA LULUS' : `${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
