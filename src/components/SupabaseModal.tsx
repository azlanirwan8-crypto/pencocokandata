import React, { useState, useEffect } from 'react';
import { Cloud, X, CheckCircle, AlertCircle, Copy, Check, Database } from 'lucide-react';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
  SUPABASE_SQL_SETUP,
} from '../utils/supabase';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectedChange?: (connected: boolean) => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  onConnectedChange,
}) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      setUrl(creds.url);
      setKey(creds.key);
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTest = async () => {
    setIsTesting(true);
    setStatusMessage(null);

    saveSupabaseCredentials(url, key);
    const result = await testSupabaseConnection();

    setIsTesting(false);
    setStatusMessage({
      success: result.success,
      text: result.message,
    });

    if (result.success && onConnectedChange) {
      onConnectedChange(true);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SETUP);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '580px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          position: 'relative',
          background: '#0d1527',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            color: 'var(--text-muted)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <Database size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
              Koneksi Cloud Database (Supabase)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Data Master tersimpan permanen di cloud agar tidak hilang saat di-deploy ke Vercel.
            </p>
          </div>
        </div>

        {/* Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
              Project URL Supabase
            </label>
            <input
              type="text"
              placeholder="https://xyzcompany.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                width: '100%',
                background: '#090e1a',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
              API Anon / Public Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              style={{
                width: '100%',
                background: '#090e1a',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveAndTest}
              disabled={isTesting || !url || !key}
              style={{ flex: 1 }}
            >
              <Cloud size={16} />
              <span>{isTesting ? 'Menguji Koneksi...' : 'Simpan & Tes Koneksi'}</span>
            </button>
          </div>

          {statusMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: statusMessage.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                border: `1px solid ${statusMessage.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                color: statusMessage.success ? '#34d399' : '#fb7185',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {statusMessage.success ? <CheckCircle size={16} style={{ flexShrink: 0 }} /> : <AlertCircle size={16} style={{ flexShrink: 0 }} />}
              <div>{statusMessage.text}</div>
            </div>
          )}

          {/* SQL Instructions */}
          <div style={{ marginTop: '0.75rem', background: 'rgba(0, 0, 0, 0.35)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#93c5fd' }}>
                Script SQL Setup (Jalankan 1x di Supabase SQL Editor):
              </span>
              <button
                type="button"
                onClick={handleCopySql}
                className="btn btn-outline btn-sm"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              >
                {copiedSql ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                <span>{copiedSql ? 'Disalin!' : 'Salin SQL'}</span>
              </button>
            </div>
            <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#94a3b8', overflowX: 'auto', padding: '0.5rem', background: '#070b14', borderRadius: '4px' }}>
              {SUPABASE_SQL_SETUP}
            </pre>
          </div>

          {/* Vercel Environment Variables tip */}
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            💡 <strong>Untuk Vercel</strong>: Anda juga dapat memasukkan konfigurasi ini di dashboard Vercel pada menu <em>Settings &rarr; Environment Variables</em> dengan nama:
            <div style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd', marginTop: '0.25rem' }}>
              • VITE_SUPABASE_URL<br />
              • VITE_SUPABASE_ANON_KEY
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
