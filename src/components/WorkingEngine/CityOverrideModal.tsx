import React, { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, MapPin, Navigation, Search } from 'lucide-react';
import { mapsUrlFor, type KodePosRow } from '../../utils/neonSync';
import { muatTitikKodePos } from '../../utils/onlineGeoCoder';

interface CityOverrideModalProps {
  isOpen: boolean;
  masterCity: string; // nama kota master yang belum terpetakan
  masterRows: KodePosRow[]; // SEMUA baris master kota itu yang akan berpindah
  ptenKota: string; // kota PTEN pilihan operator
  ptenKodePos: string[]; // kode pos milik kota PTEN itu
  onConfirm: () => void;
  onClose: () => void;
  isProcessing: boolean;
}

const HALAMAN_SIZE = 25;

// Pratinjau pemetaan manual: daftar persis baris yang akan berubah, supaya
// operator yakin data yang terlihat = data yang dipindahkan saat Setujui diklik.
export const CityOverrideModal: React.FC<CityOverrideModalProps> = ({
  isOpen,
  masterCity,
  masterRows,
  ptenKota,
  ptenKodePos,
  onConfirm,
  onClose,
  isProcessing,
}) => {
  const [cari, setCari] = useState('');
  const [hal, setHal] = useState(1);
  const [titik, setTitik] = useState<Record<string, { lat: number; lng: number }>>({});

  useEffect(() => {
    if (!isOpen) return;
    setCari('');
    setHal(1);
    void muatTitikKodePos().then(setTitik);
  }, [isOpen, masterRows]);

  const terfilter = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return masterRows;
    return masterRows.filter((r) =>
      [r.kelurahan, r.kecamatan, r.kodePos, r.provinsi].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [masterRows, cari]);

  const totalHal = Math.max(1, Math.ceil(terfilter.length / HALAMAN_SIZE));
  const halAman = Math.min(hal, totalHal);
  const barisHalaman = terfilter.slice((halAman - 1) * HALAMAN_SIZE, halAman * HALAMAN_SIZE);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1060,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(15,23,42,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.9rem 1.1rem',
            borderBottom: '1px solid #eef1f6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.95rem', color: '#212529' }}>
            <MapPin size={17} color="#405189" />
            Setujui Pemetaan Kota Manual
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#878a99' }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '0.9rem 1.1rem 0', fontSize: '0.82rem', color: '#495057', lineHeight: 1.6 }}>
          <div>
            <strong>{masterRows.length.toLocaleString('id-ID')} baris</strong> kota{' '}
            <strong style={{ color: '#212529' }}>{masterCity}</strong> akan dipetakan ke kota PTEN{' '}
            <strong style={{ color: '#0ab39c' }}>{ptenKota}</strong> ({ptenKodePos.join(', ') || 'tanpa kode pos'}).
          </div>
        </div>

        {/* Search + scroll table */}
        <div style={{ padding: '0.7rem 1.1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#878a99' }} />
              <input
                type="text"
                value={cari}
                onChange={(e) => {
                  setCari(e.target.value);
                  setHal(1);
                }}
                placeholder="Cari kelurahan, kecamatan, kode pos, provinsi..."
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem 0.4rem 1.7rem',
                  fontSize: '0.78rem',
                  border: '1px solid #d5dce8',
                  borderRadius: '5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <span style={{ fontSize: '0.72rem', color: '#878a99', whiteSpace: 'nowrap' }}>
              {terfilter.length.toLocaleString('id-ID')} dari {masterRows.length.toLocaleString('id-ID')} baris
            </span>
          </div>
        </div>

        <div style={{ margin: '0 1.1rem', overflowY: 'auto', flex: 1, border: '1px solid #eef1f6', borderRadius: '6px' }}>
          <table className="modern-table" style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                {(['Kelurahan/Desa', 'Kecamatan', 'Kode Pos', 'Provinsi', 'Maps'] as const).map((h, i) => (
                  <th
                    key={h}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      background: '#f3f6f9',
                      textAlign: i === 2 || i === 4 ? 'center' : 'left',
                      width: i === 2 ? '80px' : i === 3 ? '140px' : i === 4 ? '54px' : undefined,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {barisHalaman.map((r, i) => {
                const t = titik[String(r.kodePos || '').trim()];
                return (
                  <tr key={`${r.kodePos}-${r.kelurahan}-${(halAman - 1) * HALAMAN_SIZE + i}`} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                    <td>{r.kelurahan}</td>
                    <td>{r.kecamatan}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#0ab39c' }}>{r.kodePos}</td>
                    <td>{r.provinsi}</td>
                    <td style={{ textAlign: 'center' }}>
                      {t ? (
                        <button
                          type="button"
                          title="Buka titik di Google Maps"
                          onClick={() => window.open(mapsUrlFor(t.lat, t.lng), '_blank', 'noopener,noreferrer')}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            border: '1px solid rgba(10, 179, 156, 0.3)',
                            borderRadius: '4px',
                            background: 'rgba(10, 179, 156, 0.12)',
                            color: '#0ab39c',
                            cursor: 'pointer',
                          }}
                        >
                          <Navigation size={12} />
                        </button>
                      ) : (
                        <span style={{ color: '#adb5bd' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {barisHalaman.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '1.2rem', color: '#878a99' }}>
                    Tidak ada baris yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 1.1rem 0' }}>
          <button
            type="button"
            disabled={halAman <= 1}
            onClick={() => setHal(halAman - 1)}
            style={{
              padding: '0.3rem 0.7rem',
              fontSize: '0.74rem',
              border: '1px solid #d5dce8',
              borderRadius: '5px',
              background: '#fff',
              color: halAman <= 1 ? '#adb5bd' : '#495057',
              cursor: halAman <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
            Hal {halAman} / {totalHal}
          </span>
          <button
            type="button"
            disabled={halAman >= totalHal}
            onClick={() => setHal(halAman + 1)}
            style={{
              padding: '0.3rem 0.7rem',
              fontSize: '0.74rem',
              border: '1px solid #d5dce8',
              borderRadius: '5px',
              background: '#fff',
              color: halAman >= totalHal ? '#adb5bd' : '#495057',
              cursor: halAman >= totalHal ? 'not-allowed' : 'pointer',
            }}
          >
            Next →
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            padding: '0.8rem 1.1rem',
            marginTop: '0.4rem',
            borderTop: '1px solid #eef1f6',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.8rem',
              border: '1px solid #d5dce8',
              borderRadius: '5px',
              background: '#fff',
              color: '#495057',
              cursor: 'pointer',
            }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.9rem',
              fontSize: '0.8rem',
              border: 'none',
              borderRadius: '5px',
              background: '#0ab39c',
              color: '#fff',
              fontWeight: 600,
              cursor: isProcessing ? 'wait' : 'pointer',
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            <CheckCircle2 size={14} />
            {isProcessing ? 'Memproses ulang…' : 'Setujui'}
          </button>
        </div>
      </div>
    </div>
  );
};
