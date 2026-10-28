// Sumber data yang dipakai Data Analyst Engine.
//
// Empat sumber wajib dan satu boleh dilepas. Alasannya bukan kebiasaan: sumbernya
// terikat 1:1 ke fase (Fase 1 = PTEN + Kode Pos, Fase 2 = Wilayah + Cabang,
// Fase 3 = Mapping Role), jadi melepas suatu sumber berarti menutup fase yang
// memakainya — bukan sekadar menghilangkan satu kolom di tabel.
export type KunciSumber = 'pten' | 'kodepos' | 'wilayah' | 'cabang' | 'role';

export interface DefinisiSumber {
  kunci: KunciSumber;
  label: string;
  fase: 1 | 2 | 3;
  wajib: boolean;
  alasan: string;
}

export const SUMBER_ANALISA: DefinisiSumber[] = [
  {
    kunci: 'pten',
    label: 'PTEN',
    fase: 1,
    wajib: true,
    alasan: 'Penghasil antrean kelurahan yang dianalisa — tanpa ini tidak ada baris sama sekali.',
  },
  {
    kunci: 'kodepos',
    label: 'Kode Pos',
    fase: 1,
    wajib: true,
    alasan: 'Sumber Kelurahan dan Kecamatan untuk tiap blok PTEN.',
  },
  {
    kunci: 'wilayah',
    label: 'Wilayah',
    fase: 2,
    wajib: true,
    alasan: 'Baca sandi Kanwil W01-W17 dari Branch Code tanpa ini kolom Wilayah kosong.',
  },
  {
    kunci: 'cabang',
    label: 'Cabang',
    fase: 2,
    wajib: true,
    alasan: 'Indeks kedekatan kantor: Nama Outlet, Sandi, Branch Code.',
  },
  {
    kunci: 'role',
    label: 'Mapping Role',
    fase: 3,
    wajib: false,
    alasan: 'Hanya dipakai Fase 3. Boleh dilepas, dan Fase 3 ikut dilewati.',
  },
];

/** IndexedDB: pilihan role disimpan sendiri supaya bertahan antar sesi. */
export const KUNCI_SUMBER_DIPILIH = 'analyst_sumber_dipilih';

export type StatusKesiapan = 'siap' | 'contoh' | 'kosong';
export type StatusFase = 'siap' | 'terkunci' | 'dilewati';

export interface KesiapanSumber {
  kunci: KunciSumber;
  status: StatusKesiapan;
  jumlah: number;
  /** Sumber yang benar-benar ikut run berikutnya. */
  dipakai: boolean;
}

export type Kesiapan = Record<KunciSumber, KesiapanSumber>;

/**
 * Data contoh bawaan TIDAK dihitung siap. Dulu badge hijau di atas 139 baris seed
 * sementara database aslinya puluhan ribu baris, jadi "siap" melaporkan sesuatu
 * yang tidak akan dipakai mesin.
 */
export function nilaiKesiapan(jumlah: number, jumlahContoh: number): StatusKesiapan {
  if (!jumlah || jumlah <= 0) return 'kosong';
  if (jumlah <= jumlahContoh) return 'contoh';
  return 'siap';
}

export function hitungKesiapan(
  bahan: Record<KunciSumber, number>,
  contoh: Record<KunciSumber, number>,
  roleDipakai: boolean
): Kesiapan {
  const hasil = {} as Kesiapan;
  for (const d of SUMBER_ANALISA) {
    const status = nilaiKesiapan(bahan[d.kunci], contoh[d.kunci]);
    const dipakai = d.wajib ? true : roleDipakai && status !== 'kosong';
    hasil[d.kunci] = { kunci: d.kunci, status, jumlah: bahan[d.kunci], dipakai };
  }
  return hasil;
}

export function sumberFase(fase: 1 | 2 | 3): DefinisiSumber[] {
  return SUMBER_ANALISA.filter((d) => d.fase === fase);
}

/** Fase 1 & 2 wajib (sumbernya tidak bisa dilepas); Fase 3 opsional lewat Mapping Role. */
export function faseWajib(fase: 1 | 2 | 3): boolean {
  return sumberFase(fase).some((d) => d.wajib);
}

/**
 * Fase 3 berstatus `dilewati` (bukan `belum selesai`) saat role lepas. Tanpa keadaan
 * ketiga ini tombol "Masuk ke Data Final" tidak pernah aktif, karena gerbang alur
 * menuntut seluruh fase disetujui.
 */
export function statusFase(fase: 1 | 2 | 3, kesiapan: Kesiapan): StatusFase {
  const sumber = sumberFase(fase);
  if (!sumber.some((d) => d.wajib) && !sumber.some((d) => kesiapan[d.kunci].dipakai)) return 'dilewati';
  return sumber.some((d) => d.wajib && kesiapan[d.kunci].status !== 'siap') ? 'terkunci' : 'siap';
}

export function alasanFaseTerkunci(fase: 1 | 2 | 3, kesiapan: Kesiapan): string {
  const kurang = sumberFase(fase).filter((d) => d.wajib && kesiapan[d.kunci].status !== 'siap');
  if (kurang.length === 0) return '';
  const sebut = kurang.map((d) => `${d.label} (${kesiapan[d.kunci].jumlah.toLocaleString('id-ID')})`).join(' dan ');
  const kata = kurang.some((d) => kesiapan[d.kunci].status === 'contoh') ? 'masih berisi data contoh' : 'belum terisi';
  return `Fase ${fase} terkunci — ${sebut} ${kata}.`;
}

export function faseDilewati(fase: 1 | 2 | 3, kesiapan: Kesiapan): boolean {
  return statusFase(fase, kesiapan) === 'dilewati';
}

/**
 * Menyalakan kembali role setelah ada Data Final tidak mengoreksi baris itu: analisis
 * inkremental melewati kelurahan yang sudah final, jadi Fase 3-nya tetap kosong tanpa
 * pernah terlihat. Ditolak, bukan dijalankan diam-diam.
 */
export function halanganNyalakanRole(roleDipakai: boolean, jumlahFinal: number): string | null {
  if (roleDipakai || jumlahFinal === 0) return null;
  return (
    `${jumlahFinal.toLocaleString('id-ID')} baris sudah ada di Data Final dan akan dilewati saat Fase 3 dijalankan lagi, ` +
    'sehingga role-nya tidak akan pernah terisi. Kembalikan baris itu dari menu Final Data lebih dulu, ' +
    'atau biarkan Mapping Role terlepas.'
  );
}

/** Baris yang dihasilkan run tanpa role: dipakai untuk ekspor dan penanda di grid. */
export function jumlahBarisDilewati(rows: { fase3Dilewati?: boolean }[]): number {
  return rows.filter((r) => r.fase3Dilewati === true).length;
}

export function catatanSumber(kesiapan: Kesiapan): string {
  const pakai = SUMBER_ANALISA.filter((d) => kesiapan[d.kunci].dipakai).map((d) => d.label);
  const lepas = SUMBER_ANALISA.filter((d) => !kesiapan[d.kunci].dipakai).map((d) => d.label);
  const dasar = `Sumber analisa: ${pakai.join(', ')}`;
  return lepas.length ? `${dasar} — ${lepas.join(', ')} tidak diikutkan (Fase 3 dilewati).` : `${dasar} — semuanya diikutkan.`;
}
