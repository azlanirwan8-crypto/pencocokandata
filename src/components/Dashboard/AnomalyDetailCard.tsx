import React, { useDeferredValue, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { KATEGORI_ANOMALI, URUTAN_KATEGORI } from '../../utils/finalAnomaly';
import type { AnomalyCategory, FinalAnomaly } from '../../utils/finalAnomaly';
import { useVirtualWindow } from '../../utils/useVirtualWindow';

interface AnomalyDetailCardProps {
  /** Anomali hasil detectFinalAnomalies, sudah dipotong filter wilayah dashboard. */
  anomali: FinalAnomaly[];
  /** Jumlah baris Data Final pada wilayah yang sama — penyebut persen. */
  totalBarisFinal: number;
}

type Saring = 'SEMUA' | AnomalyCategory;

const TH: React.CSSProperties = {
  padding: '0.42rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0,
  background: '#f9fafb', color: '#4b5563', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.02em',
  borderBottom: '1px solid #e9ebec', zIndex: 1,
};
const TD: React.CSSProperties = { padding: '0.4rem 0.6rem', whiteSpace: 'nowrap', fontSize: '0.75rem', verticalAlign: 'top', color: '#374151' };

function badge(kategori: AnomalyCategory, kecil = false) {
  const k = KATEGORI_ANOMALI[kategori];
  return (
    <span
      title={k.arti}
      style={{
        display: 'inline-block', fontSize: kecil ? '0.62rem' : '0.68rem', fontWeight: 800, padding: kecil ? '0.05rem 0.3rem' : '0.1rem 0.42rem',
        borderRadius: '5px', background: k.bg, color: k.color, border: `1px solid ${k.border}`, whiteSpace: 'nowrap',
      }}
    >
      {k.label}
    </span>
  );
}

/** Semua anomali Data Final, dengan alasan tiap baris — bukan cuma angkanya. */
export const AnomalyDetailCard: React.FC<AnomalyDetailCardProps> = ({ anomali, totalBarisFinal }) => {
  const [saring, setSaring] = useState<Saring>('SEMUA');
  const [cari, setCari] = useState('');
  const tundaCari = useDeferredValue(cari);
  const scrollRef = useRef<HTMLDivElement>(null);

  const jumlah = useMemo(() => {
    const per: Record<Saring, number> = { SEMUA: anomali.length, PULAU: 0, PROVINSI: 0, STATUS: 0, PENEMPATAN: 0, ROLE: 0 };
    for (const a of anomali) for (const c of a.categories) per[c] += 1;
    return per;
  }, [anomali]);

  // Diurutkan SEKALI per ganti data (kelas tersortir dulu, baru wilayah, baru kode pos) —
  // penyaring dan pencarian tinggal menyapu daftar yang sudah urut. localeCompare di sini
  // terbukti mahal: atas 82 ribu baris ia memakan detik, bukan milidetik.
  const berurutan = useMemo(() => {
    const tingkat = new Map(URUTAN_KATEGORI.map((c, i) => [c, i]));
    const tingkatDari = (a: FinalAnomaly) => tingkat.get(a.primary) ?? 99;
    const wilayahDari = (a: FinalAnomaly) => String(a.row.wilayah || '');
    const kodeDari = (a: FinalAnomaly) => String(a.row.kodePosKelurahan || a.row.kodePosPten || '');
    return [...anomali].sort((x, y) => {
      const t = tingkatDari(x) - tingkatDari(y);
      if (t) return t;
      const wx = wilayahDari(x), wy = wilayahDari(y);
      if (wx !== wy) return wx < wy ? -1 : 1;
      const kx = kodeDari(x), ky = kodeDari(y);
      return kx < ky ? -1 : kx > ky ? 1 : 0;
    });
  }, [anomali]);

  const tersaring = useMemo(() => {
    const q = tundaCari.trim().toLowerCase();
    const out: FinalAnomaly[] = [];
    for (const a of berurutan) {
      if (saring !== 'SEMUA' && !a.categories.includes(saring)) continue;
      if (q) {
        const r = a.row;
        const teks = `${r.wilayah} ${r.namaOutlet} ${r.kodeCabang} ${r.branchCode} ${r.sandiCabang} ${r.kelurahan} ${r.kecamatan} ${r.kotaPtenMax15 || r.kotaPten} ${r.provinsi} ${r.kodePosKelurahan || r.kodePosPten} ${r.statusAnalisa} ${a.reasons.join(' ')}`.toLowerCase();
        if (!teks.includes(q)) continue;
      }
      out.push(a);
    }
    return out;
  }, [berurutan, saring, tundaCari]);

  // Semua baris bisa digulir, tapi hanya yang terlihat yang masuk DOM — daftarnya bisa
  // puluhan ribu baris (terukur 82.834 anomali pada cloud 2026-09-24).
  const win = useVirtualWindow({ containerRef: scrollRef, itemCount: tersaring.length, fallbackRowHeight: 34 });
  const tampil = win.active ? tersaring.slice(win.start, win.end) : tersaring;
  const mulaiNomor = win.active ? win.start : 0;

  if (totalBarisFinal === 0) return null;

  const persen = (anomali.length / totalBarisFinal) * 100;

  return (
    <div
      className="glass-card"
      style={{ padding: '1.1rem 1.25rem', marginBottom: '1.25rem', background: '#ffffff', border: '1px solid #e9ebec', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '0.85rem', borderBottom: '1px solid #f3f6f9', marginBottom: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(240, 101, 72, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f06548', flexShrink: 0 }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#212529' }}>Anomali Data Final &amp; Alasannya</h3>
              <span
                style={{
                  fontSize: '0.68rem', fontWeight: 700, padding: '0.12rem 0.5rem', borderRadius: '6px',
                  background: anomali.length > 0 ? 'rgba(240, 101, 72, 0.1)' : 'rgba(10, 179, 156, 0.1)',
                  color: anomali.length > 0 ? '#f06548' : '#0ab39c',
                  border: `1px solid ${anomali.length > 0 ? 'rgba(240, 101, 72, 0.25)' : 'rgba(10, 179, 156, 0.25)'}`,
                }}
              >
                {anomali.length.toLocaleString('id-ID')} dari {totalBarisFinal.toLocaleString('id-ID')} baris ({persen.toFixed(1)}%)
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#878a99' }}>
              Lima aturan penempatan dinilai per baris: beda pulau, beda provinsi, status analisa, bukti penempatan kelurahan ke kota, dan kelengkapan 3 role. Arahkan kursor ke label kelas untuk arti tiap aturan.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari outlet, kode pos, kelurahan…"
              aria-label="Cari baris anomali"
              style={{ fontSize: '0.75rem', padding: '0.32rem 0.6rem 0.32rem 1.6rem', border: '1px solid #e9ebec', borderRadius: 5, background: '#f9fafb', width: 220, outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Strip kelas anomali = penyaring, angkanya dihitung dari baris yang sama */}
      <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f3f6f9', border: '1px solid #e9ebec', borderRadius: 6, padding: 3, gap: 2, flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        {(['SEMUA', ...URUTAN_KATEGORI] as Saring[]).map((k) => {
          const aktif = saring === k;
          const arti = k === 'SEMUA' ? 'Semua baris yang punya minimal satu temuan.' : KATEGORI_ANOMALI[k].arti;
          return (
            <button
              key={k}
              type="button"
              title={arti}
              onClick={() => setSaring(k)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem', border: 'none', cursor: 'pointer',
                background: aktif ? '#ffffff' : 'transparent', boxShadow: aktif ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                color: aktif ? '#405189' : '#6c757d', fontWeight: aktif ? 700 : 500, fontSize: '0.73rem',
                padding: '0.24rem 0.6rem', borderRadius: 4,
              }}
            >
              {k === 'SEMUA' ? 'Semua' : KATEGORI_ANOMALI[k].label}
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.68rem', color: aktif ? '#405189' : '#9ca3af', fontWeight: 800 }}>
                {jumlah[k].toLocaleString('id-ID')}
              </span>
            </button>
          );
        })}
      </div>

      {tersaring.length === 0 ? (
        <div style={{ padding: '0.9rem', textAlign: 'center', background: '#f9fafb', border: '1px dashed #e9ebec', borderRadius: 6, fontSize: '0.78rem', color: '#878a99' }}>
          {anomali.length === 0
            ? 'Tidak ada anomali pada Data Final wilayah ini — semua baris lolos lima aturan penempatan.'
            : `Tidak ada dari ${anomali.length.toLocaleString('id-ID')} baris anomali yang cocok dengan filter ini.`}
        </div>
      ) : (
        <div ref={scrollRef} style={{ border: '1px solid #e9ebec', borderRadius: 6, overflow: 'auto', maxHeight: '460px' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.75rem' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 52 }}>#</th>
                <th style={TH}>KELAS</th>
                <th style={TH}>WILAYAH</th>
                <th style={TH}>KODE POS</th>
                <th style={TH}>KELURAHAN / KECAMATAN</th>
                <th style={TH}>ASAL DATA</th>
                <th style={TH}>CABANG TERPASANG</th>
                <th style={TH}>STATUS ANALISA</th>
                <th style={TH}>ALASAN ANOMALI</th>
              </tr>
            </thead>
            <tbody>
              {win.active && win.padTop > 0 && <tr aria-hidden="true" style={{ height: `${win.padTop}px` }} />}
              {tampil.map((a, i) => {
                const r = a.row;
                const kode = r.kodePosKelurahan || r.kodePosPten || '-';
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #f3f6f9' }}>
                    <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', color: '#9ca3af' }}>{(mulaiNomor + i + 1).toLocaleString('id-ID')}</td>
                    <td style={TD}>
                      <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }}>
                        {badge(a.primary)}
                        {a.categories.filter((c) => c !== a.primary).map((c) => <React.Fragment key={c}>{badge(c, true)}</React.Fragment>)}
                      </span>
                    </td>
                    <td style={TD}>{r.wilayah || '-'}</td>
                    <td style={{ ...TD, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#405189' }}>
                      {kode}
                      {r.kodePosKelurahan && r.kodePosPten && r.kodePosKelurahan !== r.kodePosPten && (
                        <span style={{ color: '#9ca3af', fontWeight: 500 }} title={`Kode pos kota dari PTEN: ${r.kodePosPten}`}> ·{r.kodePosPten}</span>
                      )}
                    </td>
                    <td style={{ ...TD, fontWeight: 600, color: '#212529' }}>{r.kelurahan || '-'} / {r.kecamatan || '-'}</td>
                    <td style={TD}>{r.kotaPtenMax15 || r.kotaPten || '-'} · {r.provinsi || '-'}</td>
                    <td style={TD}>
                      <span style={{ fontWeight: 600, color: '#0284c7' }}>{r.namaOutlet || '-'}</span>
                      <span style={{ color: '#9ca3af' }}> ({r.tipeUnit || r.statusOutlet || '-'}{r.branchCode ? ` · ${r.branchCode}` : ''})</span>
                    </td>
                    <td style={TD}>{r.statusAnalisa || '-'}</td>
                    <td style={{ ...TD, color: '#6b7280' }}>{a.reasons.join(' · ')}</td>
                  </tr>
                );
              })}
              {win.active && win.padBottom > 0 && <tr aria-hidden="true" style={{ height: `${win.padBottom}px` }} />}
            </tbody>
          </table>
        </div>
      )}

      {tersaring.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.6rem' }}>
          <span style={{ fontSize: '0.72rem', color: '#878a99' }}>
            {tersaring.length.toLocaleString('id-ID')} baris pada saringan ini — gulir tabel untuk melihat semuanya
          </span>
        </div>
      )}
    </div>
  );
};
