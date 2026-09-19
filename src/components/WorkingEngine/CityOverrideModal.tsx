import React from 'react';
import { X, CheckCircle2, MapPin } from 'lucide-react';
import type { KodePosRow } from '../../utils/neonSync';

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
          maxWidth: '640px',
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
          <div style={{ color: '#878a99', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Baris di bawah ini persis yang akan masuk Fase 1 dengan nama kota PTEN tersebut.
          </div>
        </div>

        <div style={{ padding: '0.7rem 1.1rem', overflowY: 'auto', flex: 1 }}>
          <table className="modern-table" style={{ width: '100%', fontSize: '0.73rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f6f9' }}>
              <tr>
                <th style={{ textAlign: 'left' }}>Kelurahan/Desa</th>
                <th style={{ textAlign: 'left' }}>Kecamatan</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Kode Pos</th>
                <th style={{ textAlign: 'left', width: '140px' }}>Provinsi</th>
              </tr>
            </thead>
            <tbody>
              {masterRows.map((r, i) => (
                <tr key={`${r.kodePos}-${r.kelurahan}-${i}`} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                  <td>{r.kelurahan}</td>
                  <td>{r.kecamatan}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#0ab39c' }}>{r.kodePos}</td>
                  <td>{r.provinsi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            padding: '0.8rem 1.1rem',
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
