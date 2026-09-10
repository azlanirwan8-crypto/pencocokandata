import React from 'react';
import { Menu, Database, Archive, Cloud, HardDrive, CheckCircle2 } from 'lucide-react';

interface TopbarProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isNeonConnected?: boolean;
  isCloudConnected?: boolean;
  lastSyncedAt?: string | null;
  onOpenSnapshotModal?: () => void;
  onOpenSupabaseModal?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  isNeonConnected = false,
  isCloudConnected = false,
  lastSyncedAt,
  onOpenSnapshotModal,
  onOpenSupabaseModal,
}) => {
  return (
    <header className="app-topbar">
      <div className="topbar-left">
        {/* Velzon Hamburger Toggle Button */}
        <button
          type="button"
          className="topbar-hamburger-btn"
          onClick={onToggleSidebar}
          id="btn-toggle-sidebar"
          title={isSidebarCollapsed ? 'Tampilkan Menu Sidebar' : 'Sembunyikan / Perkecil Sidebar'}
          aria-label="Toggle Sidebar"
        >
          <Menu size={19} />
        </button>
      </div>

      <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {/* Real-time Cloud Database Status Badge */}
        {isNeonConnected ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.22rem 0.55rem',
              borderRadius: '4px',
              background: 'rgba(10, 179, 156, 0.1)',
              color: '#0ab39c',
              border: '1px solid rgba(10, 179, 156, 0.25)',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
            title="Tersambung ke Database Neon Postgres di Vercel"
          >
            <Database size={13} />
            <span>Neon Postgres Aktif</span>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#0ab39c',
                display: 'inline-block',
              }}
            />
          </div>
        ) : isCloudConnected ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.22rem 0.55rem',
              borderRadius: '4px',
              background: 'rgba(53, 119, 241, 0.1)',
              color: '#3577f1',
              border: '1px solid rgba(53, 119, 241, 0.25)',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
            title="Tersambung ke Supabase Cloud"
          >
            <Cloud size={13} />
            <span>Supabase Cloud Aktif</span>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#3577f1',
                display: 'inline-block',
              }}
            />
          </div>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.22rem 0.55rem',
              borderRadius: '4px',
              background: '#f3f3f9',
              color: '#878a99',
              border: '1px solid #e9ebec',
              fontSize: '0.72rem',
              fontWeight: 500,
            }}
            title="Data tersimpan di cache lokal browser (IndexedDB)"
          >
            <HardDrive size={13} />
            <span>Lokal (IndexedDB)</span>
          </div>
        )}

        {/* Last Sync Indicator */}
        {lastSyncedAt && (
          <span
            style={{
              fontSize: '0.68rem',
              color: '#878a99',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <CheckCircle2 size={11} color="#0ab39c" />
            <span>Sync: {lastSyncedAt}</span>
          </span>
        )}

        {/* Snapshot / Cadangan Sesi Button */}
        {onOpenSnapshotModal && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onOpenSnapshotModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.74rem',
              padding: '0.25rem 0.65rem',
              borderColor: '#ced4da',
              color: '#495057',
              background: '#ffffff',
              fontWeight: 600,
            }}
            title="Buka menu Cadangan Sesi (Download / Restore Snapshot)"
          >
            <Archive size={13} color="#3577f1" />
            <span>Cadangan Sesi</span>
          </button>
        )}

        {/* Supabase Cloud Config Modal Button */}
        {onOpenSupabaseModal && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onOpenSupabaseModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.74rem',
              padding: '0.25rem 0.65rem',
              borderColor: '#ced4da',
              color: '#495057',
              background: '#ffffff',
              fontWeight: 600,
            }}
            title="Konfigurasi Database Cloud Supabase"
          >
            <Cloud size={13} color="#0ab39c" />
            <span>Cloud DB</span>
          </button>
        )}
      </div>
    </header>
  );
};
