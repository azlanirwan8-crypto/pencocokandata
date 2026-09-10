import React, { useState, useEffect } from 'react';
import { Cloud, X, CheckCircle, AlertCircle, Copy, Check, Database, RefreshCw, Zap } from 'lucide-react';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
  SUPABASE_SQL_SETUP,
} from '../utils/supabase';
import { checkNeonStatus, type NeonStatus } from '../utils/neonSync';

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
  const [activeDbTab, setActiveDbTab] = useState<'neon' | 'supabase'>('neon');

  // Neon State
  const [neonStatus, setNeonStatus] = useState<NeonStatus | null>(null);
  const [isCheckingNeon, setIsCheckingNeon] = useState(false);

  // Supabase State
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseStatusMsg, setSupabaseStatusMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const fetchNeonHealth = async () => {
    setIsCheckingNeon(true);
    const status = await checkNeonStatus();
    setNeonStatus(status);
    setIsCheckingNeon(false);
    if (status.connected && onConnectedChange) {
      onConnectedChange(true);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      setUrl(creds.url);
      setKey(creds.key);
      setSupabaseStatusMsg(null);
      fetchNeonHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseStatusMsg(null);

    saveSupabaseCredentials(url, key);
    const result = await testSupabaseConnection();

    setIsTestingSupabase(false);
    setSupabaseStatusMsg({
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
          maxWidth: '620px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #00df8f, #0284c7)',
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
              Pusat Konfigurasi Cloud Database
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Data Master tersimpan permanen di cloud agar tidak hilang saat di-deploy online ke Vercel.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.5rem' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setActiveDbTab('neon')}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.82rem',
              borderRadius: '6px',
              fontWeight: 600,
              background: activeDbTab === 'neon' ? 'rgba(0, 223, 143, 0.15)' : 'transparent',
              color: activeDbTab === 'neon' ? '#00df8f' : 'var(--text-muted)',
              border: activeDbTab === 'neon' ? '1px solid rgba(0, 223, 143, 0.4)' : '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Zap size={14} />
            <span>Vercel Postgres (Neon)</span>
            <span style={{ fontSize: '0.65rem', background: '#00df8f', color: '#000', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>Rekomendasi</span>
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => setActiveDbTab('supabase')}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.82rem',
              borderRadius: '6px',
              fontWeight: 600,
              background: activeDbTab === 'supabase' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: activeDbTab === 'supabase' ? '#34d399' : 'var(--text-muted)',
              border: activeDbTab === 'supabase' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Cloud size={14} />
            <span>Supabase</span>
          </button>
        </div>

        {/* TAB 1: NEON POSTGRES (VERCEL) */}
        {activeDbTab === 'neon' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Status Card */}
            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: neonStatus?.connected ? 'rgba(0, 223, 143, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${neonStatus?.connected ? 'rgba(0, 223, 143, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {neonStatus?.connected ? (
                  <CheckCircle size={20} color="#00df8f" />
                ) : (
                  <AlertCircle size={20} color="#f59e0b" />
                )}
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: neonStatus?.connected ? '#00df8f' : '#f59e0b' }}>
                    {neonStatus?.connected ? 'Terhubung ke Neon Postgres (Vercel)' : 'Neon Belum Terkoneksi / Mode Lokal'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {neonStatus?.connected
                      ? `Server time: ${neonStatus.serverTime || 'Online'}`
                      : 'Data master saat ini disimpan aman di IndexedDB (Browser).'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={fetchNeonHealth}
                disabled={isCheckingNeon}
                style={{ fontSize: '0.75rem', gap: '0.3rem' }}
              >
                <RefreshCw size={12} className={isCheckingNeon ? 'spin' : ''} />
                <span>{isCheckingNeon ? 'Memeriksa...' : 'Cek Status'}</span>
              </button>
            </div>

            {/* How to activate Neon on Vercel */}
            <div style={{ background: 'rgba(0, 0, 0, 0.35)', borderRadius: 'var(--radius-md)', padding: '1.1rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={15} />
                <span>Cara Mengaktifkan Neon di Vercel (1-Klik Tanpa Ketik SQL):</span>
              </div>
              <ol style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.7, paddingLeft: '1.2rem', margin: 0 }}>
                <li>Buka project Anda di dashboard <strong>Vercel</strong>.</li>
                <li>Pilih tab <strong>Storage</strong> di menu bagian atas.</li>
                <li>Klik tombol <strong>Create Database</strong> &rarr; pilih <strong>Postgres (Powered by Neon)</strong>.</li>
                <li>Klik tombol <strong>Connect to Project</strong>. Vercel akan otomatis mengisi <code style={{ color: '#00df8f' }}>POSTGRES_URL</code> dan <code style={{ color: '#00df8f' }}>DATABASE_URL</code>.</li>
                <li>
                  <strong>Selesai!</strong> Sistem otomatis melakukan auto-migrasi tabel saat aplikasi dibuka pertama kali.
                </li>
              </ol>
            </div>

            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              💡 <em>Catatan:</em> Aplikasi telah memiliki backend serverless Vercel di <code>/api/master</code> yang siap langsung berkomunikasi dengan Neon Postgres begitu dihubungkan.
            </div>
          </div>
        )}

        {/* TAB 2: SUPABASE */}
        {activeDbTab === 'supabase' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                onClick={handleSaveAndTestSupabase}
                disabled={isTestingSupabase || !url || !key}
                style={{ flex: 1 }}
              >
                <Cloud size={16} />
                <span>{isTestingSupabase ? 'Menguji Koneksi...' : 'Simpan & Tes Koneksi'}</span>
              </button>
            </div>

            {supabaseStatusMsg && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: supabaseStatusMsg.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                  border: `1px solid ${supabaseStatusMsg.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                  color: supabaseStatusMsg.success ? '#34d399' : '#fb7185',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {supabaseStatusMsg.success ? <CheckCircle size={16} style={{ flexShrink: 0 }} /> : <AlertCircle size={16} style={{ flexShrink: 0 }} />}
                <div>{supabaseStatusMsg.text}</div>
              </div>
            )}

            {/* SQL Instructions */}
            <div style={{ marginTop: '0.5rem', background: 'rgba(0, 0, 0, 0.35)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
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
          </div>
        )}
      </div>
    </div>
  );
};
