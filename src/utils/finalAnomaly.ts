import type { AnalystRow } from './analystPipeline';
import type { MasterRow } from '../types';
import { getIslandFromProvinsi } from './roleMatcher';

// ─── SATU definisi anomali Final Data, dipakai kartu Dashboard & panel Peta ───
// Sebuah baris dianggap anomali bila melanggar salah satu aturan penempatan:
//  • PULAU      → cabang penempatan beda pulau dengan asal data (Aceh→KIM dikecualikan)
//  • STATUS     → status analisa ANOMALI / PERLU_REVIEW
//  • PENEMPATAN → kelurahan/kecamatan→kota belum terbukti / pakai fallback
//  • ROLE       → cabang 3 role belum lengkap
export type AnomalyCategory = 'PULAU' | 'STATUS' | 'PENEMPATAN' | 'ROLE';

export interface FinalAnomaly {
  row: AnalystRow;
  categories: AnomalyCategory[];
  /** kategori utama untuk badge tunggal (urutan prioritas) */
  primary: AnomalyCategory;
  reasons: string[];
}

const PRIORITY: AnomalyCategory[] = ['PULAU', 'STATUS', 'PENEMPATAN', 'ROLE'];

const isAcehText = (s: string) => /ACEH|NANGGROE|\bNAD\b/.test(String(s || '').toUpperCase());

export function detectFinalAnomalies(finalRows: AnalystRow[], masterRows: MasterRow[]): FinalAnomaly[] {
  // Peta pulau cabang di-resolusi dari Master (baris final tidak menyimpan provinsi cabang).
  const islandByOutlet = new Map<string, string>();
  const islandByKode = new Map<string, string>();
  for (const m of masterRows) {
    const island = getIslandFromProvinsi(m.Provinsi, m['Dati II'], `${m.Kelurahan} ${m.Kecamatan}`);
    const no = String(m['Nama Outlet'] || '').trim().toUpperCase();
    if (no && !islandByOutlet.has(no)) islandByOutlet.set(no, island);
    const kc = String(m['Kode Cabang'] || m['Branch Code'] || '').trim();
    if (kc && !islandByKode.has(kc)) islandByKode.set(kc, island);
  }

  const out: FinalAnomaly[] = [];
  for (const r of finalRows) {
    const cats: AnomalyCategory[] = [];
    const reasons: string[] = [];

    // PULAU — kecuali Aceh (penempatan ke Cabang KIM memang lintas kota)
    if (!isAcehText(`${r.provinsi} ${r.kotaPten} ${r.kotaPtenMax15} ${r.kelurahan} ${r.kecamatan}`)) {
      const branchIsland =
        islandByOutlet.get(String(r.namaOutlet || '').trim().toUpperCase()) ??
        islandByKode.get(String(r.kodeCabang || r.branchCode || '').trim());
      const rowIsland = getIslandFromProvinsi(r.provinsi, r.kotaPtenMax15 || r.kotaPten, `${r.kelurahan} ${r.kecamatan}`);
      if (branchIsland && rowIsland !== 'Lainnya' && branchIsland !== 'Lainnya' && rowIsland !== branchIsland) {
        cats.push('PULAU');
        reasons.push(`Penempatan beda pulau: asal ${rowIsland} → cabang ${branchIsland}`);
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

    if (!r.is3RoleLengkap) {
      cats.push('ROLE');
      reasons.push(`Role belum lengkap ${r.roleGrandTotal}/3 (Sales ${r.roleCabsal}, Verifikator ${r.roleCabapv1}, Penyetuju ${r.roleCabapv2})`);
    }

    if (cats.length > 0) {
      out.push({ row: r, categories: cats, primary: PRIORITY.find((p) => cats.includes(p))!, reasons });
    }
  }
  return out;
}
