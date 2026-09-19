import React, { useEffect, useState } from 'react';
import { Key, X } from 'lucide-react';
import { getStoredGoogleApiKey, setStoredGoogleApiKey } from '../utils/onlineGeoCoder';

interface GoogleApiKeyModalProps {
  onClose: () => void;
  onSaved?: (key: string) => void;
}

/** Kunci Google Geocoding dipakai bersama oleh layar peta dan menu Data KodePos. Render hanya saat terbuka. */
export const GoogleApiKeyModal: React.FC<GoogleApiKeyModalProps> = ({ onClose, onSaved }) => {
  const [draft, setDraft] = useState(() => getStoredGoogleApiKey());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = (key: string) => {
    setStoredGoogleApiKey(key);
    onSaved?.(key);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-api-key-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          maxWidth: '460px',
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
              <Key size={18} />
            </div>
            <div>
              <h4 id="google-api-key-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Google Maps Geocoding API
              </h4>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                Validasi koordinat langsung ke server Google Maps
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog API key"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.35rem', lineHeight: 1 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.75rem', color: '#334155', lineHeight: 1.5 }}>
          <p style={{ margin: 0, marginBottom: '0.4rem' }}>
            💡 <strong>Gratis $200/bulan dari Google Cloud</strong> (setara ~40.000 request gratis setiap bulan).
          </p>
          <p style={{ margin: 0, color: '#64748b' }}>
            Jika dikosongkan, sistem secara otomatis menggunakan engine publik (ESRI / OpenStreetMap) secara gratis tanpa perlu API Key.
          </p>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="google-api-key-input" style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
            Google Maps API Key:
          </label>
          <input
            id="google-api-key-input"
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="AIzaSy..."
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              fontSize: '0.82rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              outline: 'none',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => apply('')}
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: '#e11d48',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Hapus Key
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.74rem',
                fontWeight: 600,
                color: '#64748b',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => apply(draft.trim())}
              style={{
                padding: '0.4rem 0.95rem',
                fontSize: '0.74rem',
                fontWeight: 600,
                color: '#ffffff',
                background: '#2563eb',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              }}
            >
              Simpan & Terapkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
