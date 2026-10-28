// Merge Impor Excel → pustaka Data Mapping Role.
//
// Aturan bisnis (2026-10): fokusnya mencari data yang BELUM ADA dan slot role yang
// MASIH KOSONG, bukan memperbaiki data yang sudah diisi.
//   1. Organisasi belum ada di pustaka  → simpan sebagai baris baru.
//   2. Slot role masih kosong (0) dan Excel mengisinya (1) → naikkan jadi 1.
//   3. Ketiga role sudah terisi → barisnya tidak disentuh, walaupun Excel berbeda.
//
// Konsekuensi `0`: di model ini `0` dipakai untuk "belum diisi" dan untuk "memang
// tidak ada role itu di unit ini" — keduanya tidak bisa dibedakan. Karena itu merge
// ini satu arah (0 → 1 saja); menurunkan `1 → 0` akan menghapus keputusan operator.
import type { RoleMappingRecord } from '../components/RoleMapping/RoleMappingManager';

/**
 * Kunci pencocokan organisasi. Spasi dalam dirapatkan karena nama unit kerja berupa
 * teks bebas yang panjang, dan dua spasi di tengah nama tidak boleh melahirkan
 * baris kembar.
 */
export function kunciOrganisasiRole(x: { organisasiTujuan?: string }): string {
  return String(x.organisasiTujuan || '').toUpperCase().trim().replace(/\s+/g, ' ');
}

/** Ketiga peran terisi — baris begini tidak boleh disentuh oleh impor. */
export function punyaTigaRole(r: { qrsCabsal: number; qrsCabapv1: number; qrsCabapv2: number }): boolean {
  return r.qrsCabsal === 1 && r.qrsCabapv1 === 1 && r.qrsCabapv2 === 1;
}

/** Naik satu arah: `1` lama tidak pernah diturunkan, `0` lama hanya bisa jadi `1`. */
const tambalSlot = (sekarang: number, dari: number) => (sekarang === 1 ? 1 : dari === 1 ? 1 : sekarang);

export interface HasilGabungRole {
  gabungan: RoleMappingRecord[];
  barisBaru: number;
  organisasiDitambal: number;
  slotDitambal: number;
  sudahPenuh: number;
  tidakBerubah: number;
  duplikatBerkas: number;
}

export function gabungImporRole(
  pustaka: RoleMappingRecord[],
  imported: RoleMappingRecord[]
): HasilGabungRole {
  const gabungan = [...pustaka];
  const letak = new Map<string, number>();
  pustaka.forEach((item, i) => {
    const k = kunciOrganisasiRole(item);
    if (k && !letak.has(k)) letak.set(k, i);
  });

  const terlihat = new Set<string>();
  const hasil: HasilGabungRole = {
    gabungan,
    barisBaru: 0,
    organisasiDitambal: 0,
    slotDitambal: 0,
    sudahPenuh: 0,
    tidakBerubah: 0,
    duplikatBerkas: 0,
  };

  imported.forEach((item) => {
    const k = kunciOrganisasiRole(item);
    if (!k) return;
    if (terlihat.has(k)) {
      hasil.duplikatBerkas++;
      return;
    }
    terlihat.add(k);

    const idx = letak.get(k);
    if (idx === undefined) {
      letak.set(k, gabungan.length);
      gabungan.push(item);
      hasil.barisBaru++;
      return;
    }

    const lama = gabungan[idx];
    // Objek lama di-spread, bukan diganti: pemetaan Excel tidak mengeluarkan `id`
    // dan `keterangan`, jadi replace akan menghapus keduanya diam-diam.
    const ditambal: RoleMappingRecord = {
      ...lama,
      qrsCabsal: tambalSlot(lama.qrsCabsal, item.qrsCabsal),
      qrsCabapv1: tambalSlot(lama.qrsCabapv1, item.qrsCabapv1),
      qrsCabapv2: tambalSlot(lama.qrsCabapv2, item.qrsCabapv2),
    };
    const jumlahSlot =
      Number(ditambal.qrsCabsal !== lama.qrsCabsal) +
      Number(ditambal.qrsCabapv1 !== lama.qrsCabapv1) +
      Number(ditambal.qrsCabapv2 !== lama.qrsCabapv2);

    if (jumlahSlot === 0) {
      if (punyaTigaRole(lama)) hasil.sudahPenuh++;
      else hasil.tidakBerubah++;
      return;
    }

    gabungan[idx] = ditambal;
    hasil.organisasiDitambal++;
    hasil.slotDitambal += jumlahSlot;
  });

  return hasil;
}
