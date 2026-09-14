import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Database, RefreshCw, Zap, Table, Server } from 'lucide-react';
import { checkNeonStatus, type NeonStatus } from '../utils/neonSync';

interface NeonDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectedChange?: (connected: boolean) => void;
}

export const NeonDatabaseModal: React.FC<NeonDatabaseModalProps> = ({
  isOpen,
  onClose,
  onConnectedChange,
}) => {
  const [neonStatus, setNeonStatus] = useState<NeonStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const fetchNeonHealth = async () => {
    setIsChecking(true);
    const status = await checkNeonStatus();
    setNeonStatus(status);
    setIsChecking(false);
    if (status.connected && onConnectedChange) {
      onConnectedChange(true);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNeonHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '560px',
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
        onClick={(e) => e.stopPropagation()}
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
          title="Tutup Modal"
        >
          <X size={16} />
        </button>

        {/* Header Title */}
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
            }}
          >
            <Database size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#212529' }}>
              Database Vercel (Neon Postgres)
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Penyimpanan data nyata di tabel relasional Cloud Database Vercel
            </p>
          </div>
        </div>

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
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {neonStatus?.connected ? (
              <CheckCircle size={20} color="#0ab39c" />
            ) : (
              <AlertCircle size={20} color="#d68b0c" />
            )}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: neonStatus?.connected ? '#0ab39c' : '#b45309' }}>
                {neonStatus?.connected ? 'Terhubung ke Neon Postgres (Vercel)' : 'Neon Belum Terkoneksi (Mode Lokal)'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {neonStatus?.connected
                  ? `Server time: ${neonStatus.serverTime || 'Online'}`
                  : 'Data tersimpan di cache lokal browser (IndexedDB).'}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={fetchNeonHealth}
            disabled={isChecking}
            style={{ fontSize: '0.75rem', gap: '0.3rem' }}
          >
            <RefreshCw size={12} className={isChecking ? 'spin' : ''} />
            <span>{isChecking ? 'Memeriksa...' : 'Cek Status'}</span>
          </button>
        </div>

        {/* Live Relational Tables Information */}
        <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '1rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Table size={15} color="#405189" />
            <span>Tabel Relasional Database Aktif di Neon Postgres:</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {/* Table 1: master_records */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.6rem 0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#405189' }}>
                  master_records
                </div>
                <div style={{ fontSize: '0.71rem', color: '#64748b' }}>
                  Menyimpan seluruh data master cabang per baris (alamat, kode pos, dati II, provinsi, dll)
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: 'rgba(64, 81, 137, 0.1)',
                  color: '#405189',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                {neonStatus?.tables ? `${neonStatus.tables.masterRecords.toLocaleString('id-ID')} baris` : 'Tersinkronisasi'}
              </span>
            </div>

            {/* Table 2: target_records */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.6rem 0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0ab39c' }}>
                  target_records
                </div>
                <div style={{ fontSize: '0.71rem', color: '#64748b' }}>
                  Menyimpan seluruh data target &amp; status hasil pencocokan (is_matched, match_level)
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: 'rgba(10, 179, 156, 0.1)',
                  color: '#0ab39c',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                {neonStatus?.tables ? `${neonStatus.tables.targetRecords.toLocaleString('id-ID')} baris` : 'Tersinkronisasi'}
              </span>
            </div>
          </div>
        </div>

        {/* Persistence & Reset Guarantee Box */}
        <div style={{ background: '#f0fdf4', borderRadius: '6px', padding: '0.85rem 1rem', border: '1px solid #bbf7d0', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#166534', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Server size={15} color="#16a34a" />
            <span>Jaminan Penyimpanan Data:</span>
          </div>
          <ul style={{ fontSize: '0.74rem', color: '#14532d', lineHeight: 1.6, paddingLeft: '1.2rem', margin: 0 }}>
            <li>Setiap kali Anda upload atau tambah data, data otomatis tersimpan permanen di database cloud Neon.</li>
            <li>Data tetap ada saat refresh, saat laptop dimatikan, atau saat dibuka bersama rekan lain di link Vercel.</li>
            <li>Data <strong>hanya akan terhapus</strong> jika Anda secara sengaja menekan tombol <strong>Reset Data</strong>.</li>
          </ul>
        </div>

        {/* How to connect Neon on Vercel */}
        <div style={{ background: '#f8f9fa', borderRadius: '6px', padding: '0.9rem', border: '1px solid #e9ebec' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#405189', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={14} color="#0ab39c" />
            <span>Koneksi Neon di Vercel:</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#495057', lineHeight: 1.6, margin: 0 }}>
            Database Neon Postgres terhubung langsung via backend serverless Vercel melalui environment variable <code>POSTGRES_URL</code> / <code>DATABASE_URL</code>. Seluruh auto-migrasi tabel dijalankan otomatis tanpa perlu konfigurasi SQL manual.
          </p>
        </div>
      </div>
    </div>
  );
};
