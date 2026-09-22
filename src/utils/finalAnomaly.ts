import type { AnalystRow } from './analystPipeline';
import type { MasterRow } from '../types';
import { getIslandFromProvinsi } from './roleMatcher';
import { cleanProvinsi } from './normalizer';

// ─── SATU definisi anomali Final Data, dipakai kartu Dashboard & panel Peta ───
// Sebuah baris dianggap anomali bila melanggar salah satu aturan penempatan:
//  • PULAU      → cabang penempatan beda pulau dengan asal data (Aceh→KIM dikecualikan)
//  • PROVINSI   → cabang penempatan beda provinsi (masih satu pulau pun tetap dilaporkan)
//  • STATUS     → status analisa ANOMALI / PERLU_REVIEW
//  • PENEMPATAN → kelurahan/kecamatan→kota belum terbukti / pakai fallback
//  • ROLE       → cabang 3 role belum lengkap
export type AnomalyCategory = 'PULAU' | 'PROVINSI' | 'STATUS' | 'PENEMPATAN' | 'ROLE';

export interface FinalAnomaly {
  row: AnalystRow;
  categories: AnomalyCategory[];
  /** kategori utama untuk badge tunggal (urutan prioritas) */
  primary: AnomalyCategory;
  reasons: string[];
}

const PRIORITY: AnomalyCategory[] = ['PULAU', 'PROVINSI', 'STATUS', 'PENEMPATAN', 'ROLE'];

const isAcehText = (s: string) => /ACEH|NANGGROE|\bNAD\b/.test(String(s || '').toUpperCase());

export function detectFinalAnomalies(finalRows: AnalystRow[], masterRows: MasterRow[]): FinalAnomaly[] {
  // Peta pulau & provinsi cabang di-resolusi dari Master (baris final tidak menyimpan
  // provinsi cabang — yang tersimpan hanya nama outlet / kode cabangnya).
  const islandByOutlet = new Map<string, string>();
  const islandByKode = new Map<string, string>();
  const provinsiByOutlet = new Map<string, string>();
  const provinsiByKode = new Map<string, string>();
  for (const m of masterRows) {
    const island = getIslandFromProvinsi(m.Provinsi, m['Dati II'], `${m.Kelurahan} ${m.Kecamatan}`);
    const provinsi = cleanProvinsi(m.Provinsi);
    const no = String(m['Nama Outlet'] || '').trim().toUpperCase();
    if (no && !islandByOutlet.has(no)) {
      islandByOutlet.set(no, island);
      provinsiByOutlet.set(no, provinsi);
    }
    const kc = String(m['Kode Cabang'] || m['Branch Code'] || '').trim();
    if (kc && !islandByKode.has(kc)) {
      islandByKode.set(kc, island);
      provinsiByKode.set(kc, provinsi);
    }
  }

  const out: FinalAnomaly[] = [];
  for (const r of finalRows) {
    const cats: AnomalyCategory[] = [];
    const reasons: string[] = [];

    // Baris yang BELUM pernah dianalisa tidak bisa disebut "penempatannya belum terbukti"
    // atau "role-nya belum lengkap" — kolom itu memang belum diisi sama sekali.
    // Dulu keduanya ikut dihitung, sehingga kartu TOTAL ANOMALI menunjukkan seluruh
    // isi Data Final (83.764 dari 83.764) dan angkanya tidak ada gunanya lagi.
    // Yang sudah diproses tetap dinilai penuh seperti sebelumnya.
    const sudahDianalisa = r.statusAnalisa !== 'MENUNGGU';

    const outletKey = String(r.namaOutlet || '').trim().toUpperCase();
    const kodeKey = String(r.kodeCabang || r.branchCode || '').trim();
    const cabangIsland = islandByOutlet.get(outletKey) ?? islandByKode.get(kodeKey);
    const cabangProvinsi = provinsiByOutlet.get(outletKey) ?? provinsiByKode.get(kodeKey);
    // Aceh dikecualikan dari dua aturan wilayah: penempatan ke Cabang KIM memang lintas kota.
    const bukanAceh = !isAcehText(`${r.provinsi} ${r.kotaPten} ${r.kotaPtenMax15} ${r.kelurahan} ${r.kecamatan}`);

    if (bukanAceh) {
      const rowIsland = getIslandFromProvinsi(r.provinsi, r.kotaPtenMax15 || r.kotaPten, `${r.kelurahan} ${r.kecamatan}`);
      if (cabangIsland && rowIsland !== 'Lainnya' && cabangIsland !== 'Lainnya' && rowIsland !== cabangIsland) {
        cats.push('PULAU');
        reasons.push(`Penempatan beda pulau: asal ${rowIsland} → cabang ${cabangIsland}`);
      }

      // Lebih spesifik dari PULAU: beda provinsi tapi masih satu pulau (mis. Jawa Barat
      // → Jawa Tengah) selama ini lolos, padahal itu justru yang mau dilihat operator.
      const rowProvinsi = cleanProvinsi(r.provinsi);
      if (cabangProvinsi && rowProvinsi && cabangProvinsi !== rowProvinsi) {
        cats.push('PROVINSI');
        reasons.push(`Penempatan beda provinsi: asal ${rowProvinsi.toUpperCase()} → cabang ${cabangProvinsi.toUpperCase()}`);
      }
    }

    if (r.statusAnalisa === 'ANOMALI') {
      cats.push('STATUS');
      reasons.push('Status analisa ANOMALI');
    } else if (r.statusAnalisa === 'PERLU_REVIEW') {
      cats.push('STATUS');
      reasons.push('Status analisa PERLU REVIEW (keyakinan rendah)');
    }

    if (r.placementStatus === 'REVIEW') {
      cats.push('PENEMPATAN');
      reasons.push(`Penempatan kelurahan/kecamatan → kota belum terbukti (${r.placementMethod || 'metode review'})`);
    } else if (r.placementStatus === 'FALLBACK') {
      cats.push('PENEMPATAN');
      reasons.push('Penempatan memakai fallback (tanpa bukti blok kode pos)');
    }

    if (sudahDianalisa && !r.is3RoleLengkap) {
      cats.push('ROLE');
      reasons.push(`Role belum lengkap ${r.roleGrandTotal}/3 (Sales ${r.roleCabsal}, Verifikator ${r.roleCabapv1}, Penyetuju ${r.roleCabapv2})`);
    }

    if (cats.length > 0) {
      out.push({ row: r, categories: cats, primary: PRIORITY.find((p) => cats.includes(p))!, reasons });
    }
  }
  return out;
}
