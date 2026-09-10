import React from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';

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
          maxWidth: '640px',
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
                Panduan Perhitungan Skor & Rekomendasi Cabang
              </h3>
              <p style={{ fontSize: '0.76rem', color: '#878a99', margin: '0.15rem 0 0 0' }}>
                Urutan pencarian otomatis cabang terdekat untuk data yang belum match
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
          {/* Info Khusus Aceh */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '6px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.82rem',
              color: '#065f46',
            }}
          >
            <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0 }} />
            <div>
              <strong>Aturan Khusus Wilayah Aceh:</strong> Data yang berlokasi di Provinsi Aceh secara otomatis dialokasikan ke <strong>Cabang KIM</strong> (Skor 99%).
            </div>
          </div>

          {/* Urutan Pengecekan Cabang Terdekat */}
          <div>
            <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.65rem 0' }}>
              Tahapan Pengecekan Lokasi Cabang Terdekat:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {/* Tahap 1 */}
              <div
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#0ab39c',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  1
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Pengecekan Pertama: Kelurahan Sama</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0ab39c', background: 'rgba(10, 179, 156, 0.1)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                      Skor 95% - 98%
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                    Sistem mengecek apakah di kelurahan target yang sama terdapat cabang. Jika ada lebih dari 1 cabang di kelurahan tersebut, sistem otomatis memilih yang paling dekat dengan lokasi (kode pos/alamat).
                  </p>
                </div>
              </div>

              {/* Tahap 2 */}
              <div
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#3577f1',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  2
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Jika Tidak Ada: Kelurahan Terdekat</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3577f1', background: 'rgba(53, 119, 241, 0.1)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                      Skor 85% - 94%
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                    Mencari cabang di kelurahan tetangga dalam radius kode pos yang sama (3-4 digit kode pos sama/bersebelahan).
                  </p>
                </div>
              </div>

              {/* Tahap 3 */}
              <div
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#f7b84b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  3
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Jika Tidak Juga: Cek Kecamatan Sama</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#d97706', background: 'rgba(247, 184, 75, 0.2)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                      Skor 75% - 84%
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                    Mencari cabang di kecamatan yang sama. <strong>Jika di kecamatan itu ada 2 cabang atau lebih, sistem otomatis mengambil cabang yang jarak kode pos dan alamatnya paling dekat dengan lokasi target.</strong>
                  </p>
                </div>
              </div>

              {/* Tahap 4 */}
              <div
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#878a99',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  4
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Cek Kota / Kabupaten (Dati II)</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#878a99', background: '#f3f3f9', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                      Skor 60% - 74%
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                    Jika di kecamatan tidak ada cabang, sistem mengambil cabang terdekat yang masih berada di Kota/Kabupaten yang sama.
                  </p>
                </div>
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
