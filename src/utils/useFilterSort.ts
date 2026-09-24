import { useCallback, useMemo } from 'react';
import { useTampilanTersimpan } from './useTampilanTersimpan';
import {
  jumlahFilterAktif,
  saringBaris,
  sortirBaris,
  type DefinisiKolomFilter,
  type KeadaanSaring,
  type KeadaanUrut,
} from './filterSort';

/**
 * State sort + filter header untuk satu tabel. Keadaan disimpan lewat
 * `useTampilanTersimpan` seperti sort/halaman yang sudah ada, supaya tetap ada saat
 * operator pindah menu lalu kembali (A6).
 */
export function useFilterSort<T>(kunci: string, definisi: readonly DefinisiKolomFilter<T>[], rows: readonly T[]) {
  const [urut, setUrut] = useTampilanTersimpan<KeadaanUrut>(`tampilan.${kunci}.urut`, { kolom: '', naik: true });
  const [saring, setSaring] = useTampilanTersimpan<KeadaanSaring>(`tampilan.${kunci}.saring`, {});

  /** Hasil saring saja, masih dalam urutan masuk — inilah yang dipakai ekspor. */
  const tersaring = useMemo(() => saringBaris(rows, definisi, saring), [rows, definisi, saring]);
  /** Yang ditampilkan tabel: saring lalu sortir. */
  const baris = useMemo(() => {
    const kolomUrut = definisi.find((d) => d.kunci === urut.kolom);
    return kolomUrut ? sortirBaris(tersaring, kolomUrut, urut.naik) : tersaring;
  }, [tersaring, definisi, urut]);

  /** Klik header: kolom yang sama membalik arah, kolom baru mulai dari naik. */
  const gantiUrut = useCallback((kolom: string) => {
    setUrut((s) => (s.kolom === kolom ? { kolom, naik: !s.naik } : { kolom, naik: true }));
  }, [setUrut]);

  const setNilaiKolom = useCallback((kolom: string, nilai: string[]) => {
    setSaring((s) => {
      const next = { ...s };
      if (nilai.length === 0) delete next[kolom];
      else next[kolom] = nilai;
      return next;
    });
  }, [setSaring]);

  const bersihkanKolom = useCallback((kolom: string) => setNilaiKolom(kolom, []), [setNilaiKolom]);
  const bersihkanSemua = useCallback(() => setSaring({}), [setSaring]);
  /** Kembali ke urutan masuk (bukan membalik arah). */
  const resetUrut = useCallback(() => setUrut({ kolom: '', naik: true }), [setUrut]);

  const definisiUntuk = useCallback((kolom: string) => definisi.find((d) => d.kunci === kolom), [definisi]);

  return {
    baris,
    tersaring,
    urut,
    saring,
    gantiUrut,
    setNilaiKolom,
    bersihkanKolom,
    bersihkanSemua,
    resetUrut,
    definisiUntuk,
    jumlahAktif: jumlahFilterAktif(saring),
  };
}
