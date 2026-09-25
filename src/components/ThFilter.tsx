import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronsUpDown, Filter } from 'lucide-react';
import { BATAS_DAFTAR_NILAI, cariDalamNilai, daftarNilaiUnik, dasarDaftarNilai, type DefinisiKolomFilter, type KeadaanSaring } from '../utils/filterSort';

/**
 * Sel header dengan sort asc/desc + popover filter ala Excel (cari nilai + checkbox).
 *
 * Popover-nya lewat portal ke <body>: tabel di aplikasi ini `overflow:auto` dengan
 * header sticky, jadi popover biasa akan terpotong atau tertimpa (alasan yang sama
 * dengan GeoTooltip). Daftar nilai dihitung HANYA saat popover dibuka — atas 83 ribu
 * baris itu kerja yang tidak boleh masuk jalur render.
 */

interface ThFilterProps<T> {
  label: string;
  definisi: DefinisiKolomFilter<T>;
  /** Semua baris tabel (sebelum sort/filter header) — dasar daftar nilai unik. */
  sumber: readonly T[];
  /** Seluruh definisi kolom + saringan aktif: dipakai membuat daftarnya berjenjang. */
  semuaDefinisi: readonly DefinisiKolomFilter<T>[];
  saringSemua: KeadaanSaring;
  urutKolom?: string;
  urutNaik?: boolean;
  onUrut?: () => void;
  terpilih: string[];
  onTerapkan: (nilai: string[]) => void;
  /** Warna latar belakang kepala tabel (grup kolom). */
  latar?: string;
  warna?: string;
  tengah?: boolean;
  gayaSel?: React.CSSProperties;
  /** Kepala tabel gabungan (header 2 baris pada Grid Analis). */
  rowSpan?: number;
  colSpan?: number;
  title?: string;
  /** Kolom yang nilainya tidak pernah dipakai operator tidak perlu dibekali popover. */
  bolehFilter?: boolean;
}

export function ThFilter<T>({
  label, definisi, sumber, semuaDefinisi, saringSemua, urutKolom, urutNaik, onUrut, terpilih, onTerapkan,
  latar, warna, tengah, gayaSel, rowSpan, colSpan, title, bolehFilter = true,
}: ThFilterProps<T>) {
  // Kepala tabel berwarna gelap (palet grup kolom) butuh teks putih; yang tidak punya
  // latar sendiri harus mewarisi warna tabel, bukan dipaksa putih lalu jadi tak terbaca.
  const warnaTeks = warna ?? (latar ? 'var(--text-inverse)' : 'inherit');
  const [buka, setBuka] = useState(false);
  const [cari, setCari] = useState('');
  const [draf, setDraf] = useState<Set<string>>(() => new Set(terpilih));
  const [posisi, setPosisi] = useState<{ top: number; left: number } | null>(null);
  const selRef = useRef<HTMLTableCellElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const aktifUrut = !!onUrut && urutKolom === definisi.kunci;
  const IkonUrut = aktifUrut ? (urutNaik ? ArrowUp : ArrowDown) : ChevronsUpDown;

  // Berjenjang: kolom lain yang sedang disaring memotong dasar daftar, saringan kolom
  // ini sendiri tidak (kalau ikut, pilihan lain di kolom ini hilang begitu satu nilai
  // dipilih dan popopver tidak bisa dipakai mengubah pilihan lagi).
  const daftar = useMemo(
    () => (buka ? daftarNilaiUnik(dasarDaftarNilai(sumber, semuaDefinisi, saringSemua, definisi.kunci), definisi) : null),
    [buka, sumber, semuaDefinisi, saringSemua, definisi]
  );
  const tampil = useMemo(() => (daftar ? cariDalamNilai(daftar.semua, cari) : []), [daftar, cari]);

  const tutup = useCallback(() => setBuka(false), []);

  useEffect(() => {
    if (!buka) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') tutup(); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || selRef.current?.contains(t)) return;
      tutup();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [buka, tutup]);

  const bukaPopover = () => {
    const kotak = selRef.current?.getBoundingClientRect();
    if (kotak) setPosisi({ top: Math.min(kotak.bottom + 4, window.innerHeight - 24), left: Math.min(kotak.left, window.innerWidth - 300) });
    setDraf(new Set(terpilih));
    setCari('');
    setBuka(true);
  };

  const centang = (nilai: string, on: boolean) => {
    setDraf((s) => {
      const next = new Set(s);
      if (on) next.add(nilai); else next.delete(nilai);
      return next;
    });
  };

  const pilihSemuaTampil = (on: boolean) => {
    setDraf((s) => {
      const next = new Set(s);
      tampil.forEach((n) => (on ? next.add(n) : next.delete(n)));
      return next;
    });
  };

  return (
    <th
      ref={selRef}
      rowSpan={rowSpan}
      colSpan={colSpan}
      title={title}
      aria-sort={onUrut ? (aktifUrut ? (urutNaik ? 'ascending' : 'descending') : 'none') : undefined}
      style={{
        background: latar, color: warnaTeks, whiteSpace: 'nowrap',
        textAlign: tengah ? 'center' : 'left', ...gayaSel,
      }}
    >
      <span className={tengah ? 'th-isi th-isi-tengah' : 'th-isi'}>
        <button
          type="button"
          className={aktifUrut ? 'th-urut th-urut-aktif' : 'th-urut'}
          onClick={onUrut}
          disabled={!onUrut}
          title={onUrut ? `Urutkan ${label} ${aktifUrut ? (urutNaik ? '— klik untuk turun' : '— klik untuk naik') : '(belum diurutkan)'}` : label}
        >
          {label}
          {onUrut && <IkonUrut size={11} />}
        </button>
        {bolehFilter && (
          <button
            type="button"
            className={terpilih.length ? 'th-korek th-korek-aktif' : 'th-korek'}
            onClick={bukaPopover}
            aria-haspopup="dialog"
            aria-expanded={buka}
            title={`Filter ${label}${terpilih.length ? ` — ${terpilih.length} nilai dipilih` : ''}`}
          >
            <Filter size={11} />
          </button>
        )}
      </span>

      {buka && posisi && createPortal(
        <div
          ref={popoverRef}
          className="th-popup"
          role="dialog"
          aria-label={`Filter ${label}`}
          style={{ top: posisi.top, left: posisi.left }}
        >
          <input
            className="search-input"
            autoFocus
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={`Cari nilai ${label}…`}
          />
          <label className="th-popup-baris th-popup-pilar th-popup-baris-kuat">
            <input
              type="checkbox"
              checked={tampil.length > 0 && tampil.every((n) => draf.has(n))}
              onChange={(e) => pilihSemuaTampil(e.target.checked)}
            />
            <span>(Pilih Semua)</span>
          </label>
          <div className="th-popup-daftar">
            {tampil.length === 0 && (
              <div className="th-popup-kosong">
                {daftar && daftar.totalUnik === 0 ? 'Kolom ini kosong di semua baris.' : 'Tidak ada nilai yang cocok dengan pencarian.'}
              </div>
            )}
            {tampil.map((n) => (
              <label key={n} className="th-popup-baris" title={n}>
                <input type="checkbox" checked={draf.has(n)} onChange={(e) => centang(n, e.target.checked)} />
                <span>{n}</span>
              </label>
            ))}
          </div>
          {daftar && (
            <div className="th-popup-catatan">
              {daftar.totalUnik > BATAS_DAFTAR_NILAI && !cari.trim()
                ? `${daftar.totalUnik.toLocaleString('id-ID')} nilai unik — hanya ${BATAS_DAFTAR_NILAI} pertama ditampilkan, ketik untuk mencari sisanya.`
                : `${tampil.length} dari ${daftar.totalUnik.toLocaleString('id-ID')} nilai unik.`}
            </div>
          )}
          <div className="th-popup-aksi">
            <button type="button" className="btn btn-sm btn-outline" onClick={() => { onTerapkan([]); tutup(); }}>
              Bersihkan
            </button>
            <span className="th-popup-aksi-kanan">
              <button type="button" className="btn btn-sm btn-outline" onClick={tutup}>Batalkan</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => { onTerapkan([...draf]); tutup(); }}>
                Terapkan{draf.size ? ` (${draf.size})` : ''}
              </button>
            </span>
          </div>
        </div>,
        document.body
      )}
    </th>
  );
}
