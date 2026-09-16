import React from 'react';
import { Menu, Archive } from 'lucide-react';

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
