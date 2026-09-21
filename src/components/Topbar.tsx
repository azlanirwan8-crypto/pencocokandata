import React, { useState } from 'react';
import { Menu, Archive, Database, Save } from 'lucide-react';
import { flushPendingWrites } from '../utils/storage';

interface TopbarProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isNeonConnected?: boolean;
  lastSyncedAt?: string | null;
  onOpenSnapshotModal?: () => void;
  onOpenNeonModal?: () => void;
  onOpenSupabaseModal?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenSnapshotModal,
  isNeonConnected,
  lastSyncedAt,
  onOpenNeonModal,
}) => {
  const [savedTick, setSavedTick] = useState(false);

  const handleSaveNow = async () => {
    await flushPendingWrites();
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 2000);
  };

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
        {/* Status koneksi cloud (Neon) */}
        {isNeonConnected !== undefined && (
          <span
            title={isNeonConnected ? `Terhubung ke Neon Postgres${lastSyncedAt ? ` · disinkron ${lastSyncedAt}` : ''}` : 'Tidak terhubung ke cloud — data hanya tersimpan di browser ini'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.72rem', fontWeight: 600, padding: '0.25rem 0.6rem', borderRadius: '9999px',
              background: isNeonConnected ? 'rgba(10,179,156,0.1)' : 'rgba(240,101,72,0.1)',
              color: isNeonConnected ? '#07796a' : '#c0392b',
              border: `1px solid ${isNeonConnected ? 'rgba(10,179,156,0.35)' : 'rgba(240,101,72,0.35)'}`,
            }}
          >
            <Database size={12} />
            {isNeonConnected ? `Terhubung${lastSyncedAt ? ` · ${lastSyncedAt}` : ''}` : 'Offline'}
          </span>
        )}
        {onOpenNeonModal && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onOpenNeonModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', padding: '0.25rem 0.65rem', borderColor: '#ced4da', color: '#495057', background: '#ffffff', fontWeight: 600 }}
            title="Periksa koneksi & kelola database Neon"
          >
            <Database size={13} color="#3577f1" />
            <span>Database</span>
          </button>
        )}
        {/* Simpan sekarang: dorong semua penulisan tertunda (IndexedDB) */}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={handleSaveNow}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', padding: '0.25rem 0.65rem', borderColor: '#ced4da', color: '#495057', background: '#ffffff', fontWeight: 600 }}
          title="Simpan semua perubahan yang masih tertunda di browser"
        >
          <Save size={13} color={savedTick ? '#0ab39c' : '#3577f1'} />
          <span>{savedTick ? 'Tersimpan ✓' : 'Simpan'}</span>
        </button>
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
      </div>
    </header>
  );
};
