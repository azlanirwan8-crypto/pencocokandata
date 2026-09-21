import React, { useEffect, useState } from 'react';

/**
 * A6: state tampilan grid (filter, pencarian, urutan, halaman) harus bertahan saat
 * operator pindah menu — `App.tsx` hanya merender tab aktif, jadi komponen di-unmount.
 *
 * Pakai `sessionStorage` (bukan IndexedDB): ini preferensi tampilan, bukan data kerja,
 * dan harus hilang saat tab ditutup supaya sesi berikutnya mulai bersih.
 */
export function useTampilanTersimpan<T>(kunci: string, awal: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [nilai, setNilai] = useState<T>(() => {
    try {
      const tersimpan = sessionStorage.getItem(kunci);
      return tersimpan === null ? awal : (JSON.parse(tersimpan) as T);
    } catch {
      return awal;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(kunci, JSON.stringify(nilai));
    } catch {
      /* penyimpanan mode privat penuh/diblokir: tampilan tetap jalan tanpa persistensi */
    }
  }, [kunci, nilai]);

  return [nilai, setNilai];
}
