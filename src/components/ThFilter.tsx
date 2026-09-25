import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronsUpDown, Filter } from 'lucide-react';
import { BATAS_DAFTAR_NILAI, cariDalamNilai, daftarNilaiUnik, type DefinisiKolomFilter } from '../utils/filterSort';

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
  /** Semua baris tabel (sebelum sort/filter header) — sumber daftar nilai unik. */
  sumber: readonly T[];
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
  label, definisi, sumber, urutKolom, urutNaik, onUrut, terpilih, onTerapkan,
  latar, warna, tengah, gayaSel, rowSpan, colSpan, title, bolehFilter = true,
}: ThFilterProps<T>) {
  // Kepala tabel berwarna gelap (palet grup kolom) butuh teks putih; yang tidak punya
  // latar sendiri harus mewarisi warna tabel, bukan dipaksa putih lalu jadi tak terbaca.
  const warnaTeks = warna ?? (latar ? '#ffffff' : 'inherit');
  const [buka, setBuka] = useState(false);
  const [cari, setCari] = useState('');
  const [draf, setDraf] = useState<Set<string>>(() => new Set(terpilih));
  const [posisi, setPosisi] = useState<{ top: number; left: number } | null>(null);
  const selRef = useRef<HTMLTableCellElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const aktifUrut = !!onUrut && urutKolom === definisi.kunci;
  const IkonUrut = aktifUrut ? (urutNaik ? ArrowUp : ArrowDown) : ChevronsUpDown;

  const daftar = useMemo(() => (buka ? daftarNilaiUnik(sumber, definisi) : null), [buka, sumber, definisi]);
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
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: tengah ? 'center' : 'flex-start' }}>
        <button
          type="button"
          onClick={onUrut}
          disabled={!onUrut}
          title={onUrut ? `Urutkan ${label} ${aktifUrut ? (urutNaik ? '— klik untuk turun' : '— klik untuk naik') : '(belum diurutkan)'}` : label}
          style={{
            all: 'unset', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: onUrut ? 'pointer' : 'default',
            userSelect: 'none', font: 'inherit', color: 'inherit',
          }}
        >
          {label}
          {onUrut && <IkonUrut size={11} style={{ opacity: aktifUrut ? 1 : 0.55, flexShrink: 0 }} />}
        </button>
        {bolehFilter && (
          <button
            type="button"
            onClick={bukaPopover}
            aria-haspopup="dialog"
            aria-expanded={buka}
            title={`Filter ${label}${terpilih.length ? ` — ${terpilih.length} nilai dipilih` : ''}`}
            style={{
              all: 'unset', cursor: 'pointer', display: 'inline-flex', padding: '1px 2px', borderRadius: 3, font: 'inherit',
              background: terpilih.length ? 'rgba(255,255,255,.85)' : 'transparent',
              color: terpilih.length ? '#1f2937' : 'inherit',
            }}
          >
            <Filter size={11} />
          </button>
        )}
      </span>

      {buka && posisi && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Filter ${label}`}
          style={{
            position: 'fixed', top: posisi.top, left: posisi.left, zIndex: 1200, width: 268,
            background: '#fff', color: '#1f2937', border: '1px solid #d7dce3', borderRadius: 8,
            boxShadow: '0 10px 28px rgba(15,23,42,.18)', fontSize: '0.74rem', padding: '0.5rem',
          }}
        >
          <input
            className="search-input"
            autoFocus
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={`Cari nilai ${label}…`}
            style={{ width: '100%', marginBottom: '0.4rem', fontSize: '0.73rem' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.15rem 0.1rem', borderBottom: '1px solid #eef1f4', marginBottom: '0.2rem' }}>
            <input
              type="checkbox"
              checked={tampil.length > 0 && tampil.every((n) => draf.has(n))}
              onChange={(e) => pilihSemuaTampil(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 700 }}>(Pilih Semua)</span>
          </label>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {tampil.length === 0 && (
              <div style={{ padding: '0.4rem 0.15rem', color: '#878a99' }}>
                {daftar && daftar.totalUnik === 0 ? 'Kolom ini kosong di semua baris.' : 'Tidak ada nilai yang cocok dengan pencarian.'}
              </div>
            )}
            {tampil.map((n) => (
              <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.1rem 0.15rem', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={draf.has(n)} onChange={(e) => centang(n, e.target.checked)} style={{ cursor: 'pointer' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>
              </label>
            ))}
          </div>
          {daftar && (
            <div style={{ padding: '0.3rem 0.15rem 0.15rem', color: '#878a99', fontSize: '0.68rem' }}>
              {daftar.totalUnik > BATAS_DAFTAR_NILAI && !cari.trim()
                ? `${daftar.totalUnik.toLocaleString('id-ID')} nilai unik — hanya ${BATAS_DAFTAR_NILAI} pertama ditampilkan, ketik untuk mencari sisanya.`
                : `${tampil.length} dari ${daftar.totalUnik.toLocaleString('id-ID')} nilai unik.`}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem', marginTop: '0.35rem' }}>
            <button type="button" className="btn btn-sm btn-outline" style={{ fontSize: '0.68rem' }} onClick={() => { onTerapkan([]); tutup(); }}>
              Bersihkan
            </button>
            <span style={{ display: 'flex', gap: '0.4rem' }}>
              <button type="button" className="btn btn-sm btn-outline" style={{ fontSize: '0.68rem' }} onClick={tutup}>Batalkan</button>
              <button type="button" className="btn btn-sm" style={{ fontSize: '0.68rem' }} onClick={() => { onTerapkan([...draf]); tutup(); }}>
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
