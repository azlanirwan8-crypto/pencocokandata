// Uji aturan Impor Data Mapping Role (2026-10): impor menambal yang kosong dan
// menyimpan yang belum ada — ia TIDAK PERNAH menimpa role yang sudah terisi.
// Jalankan:
//   npx vite build --ssr tests/entry-uji.ts --outDir tests/out
//   node tests/uji-impor-role.mjs
import { gabungImporRole, kunciOrganisasiRole, punyaTigaRole } from './out/entry-uji.js';

const role = (org, m = 0, v = 0, p = 0, extra = {}) => ({
  organisasiTujuan: org, qrsCabsal: m, qrsCabapv1: v, qrsCabapv2: p, grandTotal: 1, ...extra,
});
const angka = (r) => [r.qrsCabsal, r.qrsCabapv1, r.qrsCabapv2];
const cari = (list, org) => list.find((r) => r.organisasiTujuan === org);

let gagal = 0;
const asa = (label, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${ok ? '' : `\n       dapat: ${JSON.stringify(dapat)}\n       harus: ${JSON.stringify(harus)}`}`);
};

// ── 1. organisasi belum ada → disimpan ──────────────────────────────────────
const kosong = [];
const satu = gabungImporRole(kosong, [role('BANDUNG BRANCH OFFICE', 1, 0, 1)]);
asa('baris baru disimpan', [satu.barisBaru, satu.gabungan.length], [1, 1]);
asa('baris baru membawa nilai Excel apa adanya', angka(cari(satu.gabungan, 'BANDUNG BRANCH OFFICE')), [1, 0, 1]);
asa('bukan hasil tambal', [satu.slotDitambal, satu.organisasiDitambal], [0, 0]);

// ── 2. role yang masih kosong diisi dari Excel ──────────────────────────────
const dua = gabungImporRole([role('SURABAYA BRANCH OFFICE')], [role('SURABAYA BRANCH OFFICE', 1, 0, 1)]);
asa('(0,0,0) + Excel (1,0,1) → (1,0,1)', angka(cari(dua.gabungan, 'SURABAYA BRANCH OFFICE')), [1, 0, 1]);
asa('tercatat sebagai 2 slot ditambal', [dua.organisasiDitambal, dua.slotDitambal, dua.barisBaru], [1, 2, 0]);

const tiga = gabungImporRole([role('SEMARANG BRANCH OFFICE', 1, 1, 0)], [role('SEMARANG BRANCH OFFICE', 1, 1, 1)]);
asa('terisi sebagian (1,1,0) tetap ditambal per slot', angka(cari(tiga.gabungan, 'SEMARANG BRANCH OFFICE')), [1, 1, 1]);
asa('hanya 1 slot yang ditulis', [tiga.organisasiDitambal, tiga.slotDitambal], [1, 1]);

// ── 3. tiga role sudah terisi → dibiarkan, walaupun Excel berbeda ────────────
const empat = gabungImporRole([role('JAKARTA BRANCH OFFICE', 1, 1, 1)], [role('JAKARTA BRANCH OFFICE', 1, 0, 0)]);
asa('(1,1,1) + Excel (1,0,0) → tetap (1,1,1)', angka(cari(empat.gabungan, 'JAKARTA BRANCH OFFICE')), [1, 1, 1]);
asa('dihitung sebagai sudah penuh, nol tulisan', [empat.sudahPenuh, empat.slotDitambal], [1, 0]);

const lima = gabungImporRole([role('MAKASSAR BRANCH OFFICE', 1, 0, 0)], [role('MAKASSAR BRANCH OFFICE', 0, 1, 0)]);
asa('Excel 0 tidak pernah menurunkan DB 1 (satu arah)', angka(cari(lima.gabungan, 'MAKASSAR BRANCH OFFICE')), [1, 1, 0]);

// ── berkas yang sama di-upload dua kali → nol perubahan ─────────────────────
const pustakaEnam = [role('MEDAN BRANCH OFFICE', 1, 0, 1)];
const enam = gabungImporRole(pustakaEnam, [role('MEDAN BRANCH OFFICE', 1, 0, 1)]);
asa('impor ulang data yang sama tidak menulis apa pun',
  [enam.barisBaru, enam.slotDitambal, enam.tidakBerubah, enam.gabungan.length], [0, 0, 1, 1]);

// ── kunci pencocokan ────────────────────────────────────────────────────────
asa('kapital + spasi ganda dianggap organisasi yang sama',
  kunciOrganisasiRole({ organisasiTujuan: '  bandung  branch office ' }), 'BANDUNG BRANCH OFFICE');
const tujuh = gabungImporRole([role('BANDUNG BRANCH OFFICE', 0, 0, 0)], [role('bandung  Branch Office', 1, 1, 1)]);
asa('spasi ganda tidak melahirkan baris kembar', [tujuh.barisBaru, tujuh.gabungan.length, tujuh.slotDitambal], [0, 1, 3]);
asa('setelah ditambal penuh, predikat 3 role aktif', punyaTigaRole(cari(tujuh.gabungan, 'BANDUNG BRANCH OFFICE')), true);

// ── data baris lama tidak boleh hilang ──────────────────────────────────────
const delapan = gabungImporRole(
  [role('DENPASAR BRANCH OFFICE', 1, 0, 0, { id: 'abc-123', keterangan: 'verifikator menunggu SK', grandTotal: 7 })],
  [role('DENPASAR BRANCH OFFICE', 1, 1, 0)]
);
const denpasar = cari(delapan.gabungan, 'DENPASAR BRANCH OFFICE');
asa('id, keterangan dan grandTotal lama bertahan saat slot ditambal',
  [denpasar.id, denpasar.keterangan, denpasar.grandTotal, denpasar.qrsCabapv1],
  ['abc-123', 'verifikator menunggu SK', 7, 1]);

const pustakaSembilan = [role('BALIKPAPAN BRANCH OFFICE', 1, 1, 1)];
const sembilan = gabungImporRole(pustakaSembilan, [role('BALIKPAPAN BRANCH OFFICE', 1, 0, 0)]);
asa('array pustaka caller tidak dimutasi (undo masih mungkin)', angka(pustakaSembilan[0]), [1, 1, 1]);
asa('objek baris yang tidak berubah dipakai kembali', sembilan.gabungan[0] === pustakaSembilan[0], true);

// ── campuran + duplikat di dalam berkas ─────────────────────────────────────
const sepuluh = gabungImporRole(
  [role('KCP A', 0, 0, 0), role('KC B', 1, 1, 1)],
  [role('KCP A', 1, 0, 1), role('KC B', 0, 0, 0), role('KC C', 1, 1, 1), role('KC C', 1, 1, 1)]
);
asa('ringkasan campuran',
  [sepuluh.barisBaru, sepuluh.slotDitambal, sepuluh.sudahPenuh, sepuluh.duplikatBerkas, sepuluh.gabungan.length],
  [1, 2, 1, 1, 3]);

// ── skala: seluruh pustaka default di-upload ulang ──────────────────────────
const DEFAULT_DATA = [
  role('AMBON BRANCH OFFICE', 1, 1, 1), role('AMBON BRANCH OFFICE - BURU SELATAN SUB BRANCH', 1, 0, 1),
  role('BALIKPAPAN BRANCH OFFICE', 1, 1, 1),
];
const berkas = [...DEFAULT_DATA, role('PTEN BARU', 1, 1, 1)];
const skala = gabungImporRole(DEFAULT_DATA, berkas);
asa('file identik + 1 organisasi baru = hanya 1 tulisan', [skala.barisBaru, skala.slotDitambal, skala.gabungan.length], [1, 0, 4]);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} TEST GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
