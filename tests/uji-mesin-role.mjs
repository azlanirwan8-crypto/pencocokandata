// Uji runtime Fase 2 (Cabang KIM) + Fase 3 (D1/D2/D5): mesin otomatis harus sama
// dengan engine layar DAN tidak boleh menulis peran yang belum ada di Data Mapping Role.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-mesin-role.mjs
import { matchRoleForOutlet, findTopRoleMatchesByLocation, isKimBranchAceh, findKimBranch } from './out/entry-uji.js';

const row = (o) => ({
  Wilayah: '', 'Branch Code': '', 'Kode Cabang': '', 'Sandi Cabang': '', 'Nama Outlet': '',
  Cabang: '', 'Status Outlet': '', ALAMAT: '', 'KODE POS': '', Kelurahan: '', Kecamatan: '',
  'Dati II': '', Provinsi: '', ...o,
});
const role = (org, m = 1, c = 1, s = 1) => ({
  organisasiTujuan: org, qrsCabsal: m, qrsCabapv1: c, qrsCabapv2: s, grandTotal: m + c + s,
});

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

// ── FASE 2: aturan Cabang KIM ───────────────────────────────────────────────
const arHakimMedan = row({ 'Nama Outlet': 'AR HAKIM', Cabang: 'MEDAN', 'Sandi Cabang': '60100664', 'Status Outlet': 'KC', 'Dati II': 'MEDAN', Provinsi: 'SUMATERA UTARA', ALAMAT: 'JL AR HAKIM MEDAN' });
const kimBandaAceh = row({ 'Nama Outlet': 'KIM BANDA ACEH', Cabang: 'BANDA ACEH', 'Sandi Cabang': '01100001', 'Status Outlet': 'KC', 'Dati II': 'BANDA ACEH', Provinsi: 'ACEH', ALAMAT: 'JL ISKANDAR MUDA BANDA ACEH' });

asa('AR HAKIM (Medan) bukan Cabang KIM', isKimBranchAceh(arHakimMedan), false);
asa('KIM BANDA ACEH = Cabang KIM', isKimBranchAceh(kimBandaAceh), true);
asa('findKimBranch: hanya AR HAKIM → null', findKimBranch([arHakimMedan]), null);
asa('findKimBranch: ada KIM Aceh → KIM', findKimBranch([arHakimMedan, kimBandaAceh])?.['Nama Outlet'], 'KIM BANDA ACEH');

// ── FASE 3: satu mesin + tidak mengarang peran ─────────────────────────────
const masterRows = [
  row({ 'Sandi Cabang': '031', 'Branch Code': '031', 'Nama Outlet': 'BANDUNG', Cabang: 'BANDUNG', 'Status Outlet': 'KC', ALAMAT: 'JL ASIA AFRIKA BANDUNG', 'KODE POS': '40111', Kelurahan: 'BRAGA', Kecamatan: 'SUMUR BANDUNG', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
  row({ 'Sandi Cabang': '031-DAGO', 'Branch Code': '031-DAGO', 'Nama Outlet': 'BANDUNG DAGO', Cabang: 'BANDUNG', 'Status Outlet': 'KCP', ALAMAT: 'JL DAGO BANDUNG', 'KODE POS': '40132', Kelurahan: 'LEBAK GEBANG', Kecamatan: 'COBLONG', 'Dati II': 'BANDUNG', Provinsi: 'JAWA BARAT' }),
  row({ 'Sandi Cabang': '051', 'Branch Code': '051', 'Nama Outlet': 'SURABAYA', Cabang: 'SURABAYA', 'Status Outlet': 'KC', ALAMAT: 'JL BUNGKUL SURABAYA', 'KODE POS': '60111', Kelurahan: 'TEGAL SARI', Kecamatan: 'GENTENG', 'Dati II': 'SURABAYA', Provinsi: 'JAWA TIMUR' }),
  row({ 'Sandi Cabang': '077', 'Branch Code': '077', 'Nama Outlet': 'MAKASSAR', Cabang: 'MAKASSAR', 'Status Outlet': 'KC', ALAMAT: 'JL SUNU MAKASSAR', 'KODE POS': '90111', Kelurahan: 'SUMU', Kecamatan: 'ULUJANG', 'Dati II': 'MAKASSAR', Provinsi: 'SULAWESI SELATAN' }),
];
const roleList = [
  role('BANDUNG BRANCH OFFICE'),
  role('SURABAYA BRANCH OFFICE'),
  role('SEMARANG BRANCH OFFICE', 1, 0, 1), // tidak lengkap 3 role — bukan anggota pool
];

const kcBandung = masterRows[0];
const kcpDago = masterRows[1];
const kcMakassar = masterRows[3];
const kcpTanpaPulau = row({ 'Sandi Cabang': '099-X', 'Branch Code': '099-X', 'Nama Outlet': 'JAKARTA KUNINGAN', Cabang: 'JAKARTA', 'Status Outlet': 'KCP', ALAMAT: 'JR RUMBAI', 'Dati II': '', Provinsi: '' });
masterRows.push(row({ 'Sandi Cabang': '010', 'Branch Code': '010', 'Nama Outlet': 'JAKARTA', Cabang: 'JAKARTA', 'Status Outlet': 'KC', ALAMAT: 'JL THAMRIN JAKARTA', 'KODE POS': '10110', Kelurahan: 'DURI PULO', Kecamatan: 'TAMANSARI', 'Dati II': 'JAKARTA PUSAT', Provinsi: 'DKI JAKARTA' }));
const roleListJakarta = [...roleList, role('JAKARTA BRANCH OFFICE')];

const jalankan = (label, master, list) => {
  const engine = findTopRoleMatchesByLocation(master, undefined, list, masterRows, 4);
  const auto = matchRoleForOutlet(master, undefined, list, masterRows);
  const target = engine.find((e) => !e.synthetic) || null;
  asa(`${label}: otomatis = kandidat engine layar ber-record nyata`, auto.organisasiTujuan, target ? target.rec.organisasiTujuan : '');
  return { label, auto, engine };
};

const bandung = jalankan('KC Bandung (ada record nyata)', kcBandung, roleList);
asa('  → skor 100 dari record nyata, bukan karangan', [bandung.auto.confidenceScore, bandung.auto.statusAnalisa], [100, 'EXACT_MATCH']);

const dago = jalankan('KCP Dago (cabang induk punya record)', kcpDago, roleList);
asa('  → 95 EXACT_MATCH', [dago.auto.confidenceScore, dago.auto.statusAnalisa], [95, 'EXACT_MATCH']);

const makassar = jalankan('KC Makassar (TIDAK ada di Data Role)', kcMakassar, roleList);
asa('  → kosong + ANOMALI, bukan "MAKASSAR BRANCH OFFICE 3/3/3"', [makassar.auto.organisasiTujuan, makassar.auto.statusAnalisa, makassar.auto.is3RoleLengkap], ['', 'ANOMALI', false]);
asa('  → alasan menyebut cabang usulan', (makassar.auto.temuanCatatan?.[11] || []).some((t) => t.includes('MAKASSAR BRANCH OFFICE')), true);

const tanpaPulau = jalankan('KCP pulau tak teridentifikasi', kcpTanpaPulau, roleListJakarta);
asa('  → dipaksa REVIEW (skor 60) + catatan pulau', [tanpaPulau.auto.confidenceScore, tanpaPulau.auto.statusAnalisa, (tanpaPulau.auto.temuanCatatan?.[11] || []).length > 0], [60, 'PERLU_REVIEW', true]);

const kosong = matchRoleForOutlet(kcBandung, undefined, [], masterRows);
asa('Daftar role kosong → ANOMALI', [kosong.organisasiTujuan, kosong.statusAnalisa, kosong.alurWondr], ['', 'ANOMALI', '']);

const t0 = performance.now();
for (let i = 0; i < 400; i++) matchRoleForOutlet(i % 2 ? kcBandung : kcpDago, undefined, roleList, masterRows);
console.log(`\n400 panggilan matchRoleForOutlet: ${(Math.round((performance.now() - t0) * 10) / 10)} ms`);
console.log(gagal === 0 ? 'SEMUA LULUS' : `${gagal} TEST GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
