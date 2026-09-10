import React from 'react';
import { X, Sparkles, MapPin, Building2, FileText, CheckCircle2 } from 'lucide-react';
import type { TargetRow, MasterRow } from '../../types';
import type { CandidateOption } from '../../utils/recommender';

interface CandidateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    targetRow: TargetRow;
    candidate: CandidateOption;
  } | null;
  onApprove: (rowNo: number | string, master: MasterRow) => void;
}

export const CandidateDetailModal: React.FC<CandidateDetailModalProps> = ({
  isOpen,
  onClose,
  data,
  onApprove,
}) => {
  if (!isOpen || !data) return null;

  const { targetRow: r, candidate: cand } = data;
  const m = cand.master;
  const isTop1 = cand.rank === 1;

  const handleApprove = () => {
    onApprove(r.No, m);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1060,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e9ebec',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e9ebec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8f9fa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: isTop1 ? 'rgba(10, 179, 156, 0.12)' : 'rgba(247, 184, 75, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isTop1 ? '#0ab39c' : '#d97706',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                Detail Rekomendasi & Alasan Penilaian Skor
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#878a99', margin: '0.1rem 0 0 0' }}>
                Pilihan {cand.rank} • Baris Target No. {r.No}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#878a99',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Highlight Box: Cabang Terpilih & Skor */}
          <div
            style={{
              background: isTop1 ? 'rgba(10, 179, 156, 0.04)' : 'rgba(247, 184, 75, 0.05)',
              border: isTop1 ? '1px solid rgba(10, 179, 156, 0.25)' : '1px solid rgba(247, 184, 75, 0.3)',
              borderRadius: '6px',
              padding: '0.85rem 1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span
                style={{
                  padding: '0.15rem 0.55rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: isTop1 ? 'rgba(10, 179, 156, 0.15)' : 'rgba(247, 184, 75, 0.2)',
                  color: isTop1 ? '#0ab39c' : '#d97706',
                }}
              >
                {isTop1 ? 'Pilihan 1 (Utama)' : `Pilihan ${cand.rank} (Alternatif)`}
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isTop1 ? '#0ab39c' : '#d97706' }}>
                Kemiripan: {cand.score}%
              </span>
            </div>

            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#212529' }}>
              {m['Sandi Cabang'] || m.Cabang || m.Sandi || '-'}
              {m['Nama Outlet'] && (
                <span style={{ fontSize: '0.85rem', color: '#405189', fontWeight: 600, marginLeft: '0.4rem' }}>
                  • {m['Nama Outlet']}
                </span>
              )}
            </div>
          </div>

          {/* Section: Alasan Penilaian Skor & Kedekatan Wilayah (Sesuai Gambar User) */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e9ebec',
              borderRadius: '6px',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#405189', fontWeight: 600, fontSize: '0.82rem' }}>
              <FileText size={15} />
              <span>Alasan Penilaian & Indikator Wilayah</span>
            </div>

            <div
              style={{
                background: '#f8f9fa',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #edf0f2',
                fontSize: '0.78rem',
                color: '#212529',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                lineHeight: 1.5,
              }}
            >
              <div>
                <span style={{ color: '#878a99', fontWeight: 600 }}>Pos: </span>
                <strong style={{ color: '#405189' }}>{m['KODE POS'] || '-'}</strong> •{' '}
                <span>
                  {m.Kelurahan ? `${m.Kelurahan}, ` : ''}
                  {m.Kecamatan ? `${m.Kecamatan}, ` : ''}
                  {m['Dati II'] || '-'} ({m.Provinsi || '-'})
                </span>
              </div>
              <div style={{ color: '#212529', fontWeight: 600 }}>
                {cand.reason}
              </div>
            </div>

            {/* Alamat Lengkap Master */}
            <div style={{ fontSize: '0.78rem', color: '#495057', marginTop: '0.2rem' }}>
              <strong style={{ color: '#212529' }}>Alamat Master: </strong>
              <span style={{ wordBreak: 'break-word' }}>
                {m.ALAMAT || <em style={{ color: '#adb5bd' }}>Alamat tidak terisi di master</em>}
              </span>
            </div>
          </div>

          {/* Section: Komparasi Berdampingan (Target vs Master) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {/* Kolom 1: Data Target Asli */}
            <div
              style={{
                border: '1px solid #e9ebec',
                borderRadius: '6px',
                padding: '0.75rem 0.85rem',
                background: '#fafafa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f06548', fontWeight: 600, fontSize: '0.78rem', marginBottom: '0.5rem' }}>
                <MapPin size={14} />
                <span>Data Target Operasional</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.74rem', color: '#495057' }}>
                <div><strong>Kode Pos:</strong> <span style={{ color: '#f06548', fontWeight: 700 }}>{r['KODE POS'] || '-'}</span></div>
                <div><strong>Kecamatan:</strong> {r.Kecamatan || '-'}</div>
                <div><strong>Kelurahan:</strong> {r.Kelurahan || '-'}</div>
                <div><strong>Dati II (Kota):</strong> {r['Dati II'] || '-'}</div>
                <div><strong>Provinsi:</strong> {r.Provinsi || '-'}</div>
                <div style={{ marginTop: '0.25rem', wordBreak: 'break-word' }}>
                  <strong>Alamat Target:</strong><br />
                  <span style={{ color: '#212529' }}>{r.ALAMAT || '-'}</span>
                </div>
              </div>
            </div>

            {/* Kolom 2: Data Master Cabang */}
            <div
              style={{
                border: '1px solid rgba(10, 179, 156, 0.25)',
                borderRadius: '6px',
                padding: '0.75rem 0.85rem',
                background: '#fcfdfd',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0ab39c', fontWeight: 600, fontSize: '0.78rem', marginBottom: '0.5rem' }}>
                <Building2 size={14} />
                <span>Data Cabang Master Terpilih</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.74rem', color: '#495057' }}>
                <div><strong>Kode Pos:</strong> <span style={{ color: '#405189', fontWeight: 700 }}>{m['KODE POS'] || '-'}</span></div>
                <div><strong>Kecamatan:</strong> {m.Kecamatan || '-'}</div>
                <div><strong>Kelurahan:</strong> {m.Kelurahan || '-'}</div>
                <div><strong>Dati II (Kota):</strong> {m['Dati II'] || '-'}</div>
                <div><strong>Provinsi:</strong> {m.Provinsi || '-'}</div>
                <div style={{ marginTop: '0.25rem', wordBreak: 'break-word' }}>
                  <strong>Alamat Master:</strong><br />
                  <span style={{ color: '#212529' }}>{m.ALAMAT || '-'}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e9ebec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8f9fa',
          }}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}
          >
            Tutup
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleApprove}
            style={{
              fontSize: '0.78rem',
              padding: '0.38rem 1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#0ab39c',
              borderColor: '#0ab39c',
            }}
          >
            <CheckCircle2 size={14} />
            <span>Gunakan Cabang Ini</span>
          </button>
        </div>
      </div>
    </div>
  );
};
