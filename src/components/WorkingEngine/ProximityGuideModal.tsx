import React from 'react';
import { X, Sparkles, Building2, MapPin, Mail, Globe } from 'lucide-react';

interface ProximityGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProximityGuideModal: React.FC<ProximityGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1060,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '620px',
          background: '#ffffff',
          borderRadius: '10px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          border: '1px solid #e9ebec',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid #e9ebec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #fffdf8, #ffffff)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(247, 184, 75, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d97706',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#212529', margin: 0 }}>
                Panduan Sederhana: Skor Kedekatan Cabang
              </h3>
              <p style={{ fontSize: '0.76rem', color: '#878a99', margin: '0.15rem 0 0 0' }}>
                Penjelasan mudah tentang cara sistem mencocokkan cabang terdekat
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
              padding: '0.3rem',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.4rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Pengantar Bahasa Awam */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '6px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '0.82rem',
              color: '#334155',
              lineHeight: 1.5,
            }}
          >
            💡 <strong>Tujuan Fitur:</strong> Data cek Anda yang belum ada cabangnya otomatis dicocokkan dengan <strong>cabang yang paling dekat lokasinya</strong> di peta, sehingga Anda tidak perlu mencocokkan satu per satu secara manual.
          </div>

          {/* 4 Unsur Penilaian */}
          <div>
            <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.6rem 0' }}>
              4 Unsur Penentu Kedekatan Lokasi (Total 100%):
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.65rem' }}>
              <div
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  gap: '0.6rem',
                }}
              >
                <div style={{ color: '#d97706', marginTop: '2px' }}><Building2 size={16} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                    1. Kota / Kabupaten (Paling Utama: 35%)
                  </div>
                  <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Jika nama Kota atau Kabupaten sama, poin otomatis tinggi karena pasti satu kota.
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  gap: '0.6rem',
                }}
              >
                <div style={{ color: '#d97706', marginTop: '2px' }}><MapPin size={16} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                    2. Kecamatan (Paling Utama: 35%)
                  </div>
                  <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Jika nama kecamatan cocok, cabang dipastikan berada di lingkungan terdekat.
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  gap: '0.6rem',
                }}
              >
                <div style={{ color: '#d97706', marginTop: '2px' }}><Mail size={16} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                    3. Kode Pos Berdekatan (20%)
                  </div>
                  <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Kode pos yang angka depannya mirip menandakan jarak fisik lokasi yang saling bertetangga.
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  gap: '0.6rem',
                }}
              >
                <div style={{ color: '#d97706', marginTop: '2px' }}><Globe size={16} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                    4. Satu Provinsi (10%)
                  </div>
                  <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Memastikan data tidak keliru nyasar ke luar pulau atau provinsi lain.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Arti Persentase Angka */}
          <div
            style={{
              padding: '0.9rem 1rem',
              borderRadius: '8px',
              background: '#fffdf8',
              border: '1px solid rgba(247, 184, 75, 0.35)',
            }}
          >
            <h4 style={{ fontSize: '0.84rem', fontWeight: 700, color: '#92400e', margin: '0 0 0.55rem 0' }}>
              Arti Persentase (Kenapa ada 60%, 70%, 90%?):
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                    background: 'rgba(10, 179, 156, 0.15)',
                    color: '#0ab39c',
                    fontSize: '0.72rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  80% - 99% (Sangat Cocok)
                </span>
                <span style={{ color: '#475569', lineHeight: 1.4 }}>
                  Kota sama, Kecamatan sama, dan Kode Pos sama/mirip. <strong>Sangat aman untuk langsung disetujui.</strong>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                    background: 'rgba(247, 184, 75, 0.2)',
                    color: '#d97706',
                    fontSize: '0.72rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  65% - 79% (Cabang Terdekat)
                </span>
                <span style={{ color: '#475569', lineHeight: 1.4 }}>
                  Satu Kota dan satu Provinsi, tapi di kecamatan tetangga (karena di kecamatan tersebut belum ada cabang). <strong>Layak disetujui sebagai cabang pelayan terdekat.</strong>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                    background: 'rgba(53, 119, 241, 0.12)',
                    color: '#3577f1',
                    fontSize: '0.72rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  50% - 64% (Alternatif Sekitar)
                </span>
                <span style={{ color: '#475569', lineHeight: 1.4 }}>
                  Cabang alternatif yang masih berada dalam satu area regional yang sama.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.4rem',
            borderTop: '1px solid #e9ebec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            background: '#fafafa',
          }}
        >
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onClose}
            style={{ padding: '0.4rem 1.25rem', fontSize: '0.82rem', fontWeight: 600 }}
          >
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>
  );
};
