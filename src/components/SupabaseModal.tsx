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
        backgroundColor: 'rgba(33, 37, 41, 0.45)',
        backdropFilter: 'blur(4px)',
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
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          position: 'relative',
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 10px 25px rgba(56, 65, 74, 0.15)',
          borderRadius: '8px',
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
            background: '#f3f3f9',
            border: 'none',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
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
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #405189, #0ab39c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(64, 81, 137, 0.25)',
            }}
          >
            <Database size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#212529' }}>
              Pusat Konfigurasi Cloud Database
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Data Master tersimpan permanen di cloud agar tidak hilang saat di-deploy ke Vercel.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', background: '#f3f3f9', padding: '0.25rem', borderRadius: '6px' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setActiveDbTab('neon')}
            style={{
              flex: 1,
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              fontWeight: 600,
              background: activeDbTab === 'neon' ? '#ffffff' : 'transparent',
              color: activeDbTab === 'neon' ? '#405189' : 'var(--text-secondary)',
              border: activeDbTab === 'neon' ? '1px solid #e9ebec' : '1px solid transparent',
              boxShadow: activeDbTab === 'neon' ? '0 1px 2px rgba(56, 65, 74, 0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <Zap size={14} color="#0ab39c" />
            <span>Vercel Postgres (Neon)</span>
            <span style={{ fontSize: '0.65rem', background: 'rgba(10, 179, 156, 0.12)', color: '#0ab39c', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>Rekomendasi</span>
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => setActiveDbTab('supabase')}
            style={{
              flex: 1,
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              fontWeight: 600,
              background: activeDbTab === 'supabase' ? '#ffffff' : 'transparent',
              color: activeDbTab === 'supabase' ? '#405189' : 'var(--text-secondary)',
              border: activeDbTab === 'supabase' ? '1px solid #e9ebec' : '1px solid transparent',
              boxShadow: activeDbTab === 'supabase' ? '0 1px 2px rgba(56, 65, 74, 0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <Cloud size={14} color="#3577f1" />
            <span>Supabase</span>
          </button>
        </div>

        {/* TAB 1: NEON POSTGRES (VERCEL) */}
        {activeDbTab === 'neon' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Status Card */}
            <div
              style={{
                padding: '0.9rem 1rem',
                borderRadius: '6px',
                background: neonStatus?.connected ? 'rgba(10, 179, 156, 0.08)' : 'rgba(247, 184, 75, 0.08)',
                border: `1px solid ${neonStatus?.connected ? 'rgba(10, 179, 156, 0.25)' : 'rgba(247, 184, 75, 0.25)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                {neonStatus?.connected ? (
                  <CheckCircle size={18} color="#0ab39c" />
                ) : (
                  <AlertCircle size={18} color="#d68b0c" />
                )}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: neonStatus?.connected ? '#0ab39c' : '#b45309' }}>
                    {neonStatus?.connected ? 'Terhubung ke Neon Postgres (Vercel)' : 'Neon Belum Terkoneksi / Mode Lokal'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
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
            <div style={{ background: '#f8f9fa', borderRadius: '6px', padding: '1rem', border: '1px solid #e9ebec' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#405189', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={14} color="#0ab39c" />
                <span>Cara Mengaktifkan Neon di Vercel (1-Klik Tanpa Ketik SQL):</span>
              </div>
              <ol style={{ fontSize: '0.78rem', color: '#495057', lineHeight: 1.7, paddingLeft: '1.2rem', margin: 0 }}>
                <li>Buka project Anda di dashboard <strong>Vercel</strong>.</li>
                <li>Pilih tab <strong>Storage</strong> di menu bagian atas.</li>
                <li>Klik tombol <strong>Create Database</strong> &rarr; pilih <strong>Postgres (Powered by Neon)</strong>.</li>
                <li>Klik tombol <strong>Connect to Project</strong>. Vercel akan otomatis mengisi <code style={{ color: '#0ab39c', background: '#f3f3f9', padding: '1px 4px', borderRadius: '3px' }}>POSTGRES_URL</code> dan <code style={{ color: '#0ab39c', background: '#f3f3f9', padding: '1px 4px', borderRadius: '3px' }}>DATABASE_URL</code>.</li>
                <li>
                  <strong>Selesai!</strong> Sistem otomatis melakukan auto-migrasi tabel saat aplikasi dibuka pertama kali.
                </li>
              </ol>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              💡 <em>Catatan:</em> Aplikasi telah memiliki backend serverless Vercel di <code>/api/master</code> yang siap langsung berkomunikasi dengan Neon Postgres begitu dihubungkan.
            </div>
          </div>
        )}

        {/* TAB 2: SUPABASE */}
        {activeDbTab === 'supabase' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                Project URL Supabase
              </label>
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #ced4da',
                  color: '#495057',
                  padding: '0.55rem 0.8rem',
                  borderRadius: '4px',
                  fontSize: '0.82rem',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#495057', marginBottom: '0.35rem' }}>
                API Anon / Public Key
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #ced4da',
                  color: '#495057',
                  padding: '0.55rem 0.8rem',
                  borderRadius: '4px',
                  fontSize: '0.82rem',
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
                <Cloud size={15} />
                <span>{isTestingSupabase ? 'Menguji Koneksi...' : 'Simpan & Tes Koneksi'}</span>
              </button>
            </div>

            {supabaseStatusMsg && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '4px',
                  background: supabaseStatusMsg.success ? 'rgba(10, 179, 156, 0.1)' : 'rgba(240, 101, 72, 0.1)',
                  border: `1px solid ${supabaseStatusMsg.success ? 'rgba(10, 179, 156, 0.25)' : 'rgba(240, 101, 72, 0.25)'}`,
                  color: supabaseStatusMsg.success ? '#0ab39c' : '#f06548',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {supabaseStatusMsg.success ? <CheckCircle size={15} style={{ flexShrink: 0 }} /> : <AlertCircle size={15} style={{ flexShrink: 0 }} />}
                <div>{supabaseStatusMsg.text}</div>
              </div>
            )}

            {/* SQL Instructions */}
            <div style={{ marginTop: '0.35rem', background: '#f8f9fa', borderRadius: '6px', padding: '0.9rem', border: '1px solid #e9ebec' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#405189' }}>
                  Script SQL Setup (Jalankan 1x di Supabase SQL Editor):
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="btn btn-outline btn-sm"
                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }}
                >
                  {copiedSql ? <Check size={12} color="#0ab39c" /> : <Copy size={12} />}
                  <span>{copiedSql ? 'Disalin!' : 'Salin SQL'}</span>
                </button>
              </div>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#495057', overflowX: 'auto', padding: '0.5rem', background: '#ffffff', borderRadius: '4px', border: '1px solid #e9ebec' }}>
                {SUPABASE_SQL_SETUP}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
