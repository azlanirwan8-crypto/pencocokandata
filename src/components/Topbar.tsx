import React, { useState } from 'react';
import { Menu, Archive, Database, Save } from 'lucide-react';
import { flushPendingWrites } from '../utils/storage';
import { useNotification } from './Notification/NotificationContext';

interface TopbarProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isNeonConnected?: boolean;
  lastSyncedAt?: string | null;
  onOpenSnapshotModal?: () => void;
  onOpenNeonModal?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenSnapshotModal,
  onOpenNeonModal,
}) => {
  const [savedTick, setSavedTick] = useState(false);
  const { add: notify } = useNotification();

  const handleSaveNow = async () => {
    const { jumlah, gagal } = await flushPendingWrites();
    if (gagal > 0) {
      notify(`${gagal} dari ${jumlah} perubahan gagal ditulis di browser — tutup tab sebelum mencoba lagi berisiko kehilangan data.`, 'error');
      return;
    }
    if (jumlah === 0) notify('Tidak ada perubahan tertunda — semua sudah tersimpan di browser.', 'info');
    else notify(`${jumlah} perubahan tersimpan di browser.`, 'success');
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

        {onOpenNeonModal && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onOpenNeonModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', padding: '0.25rem 0.65rem', borderColor: '#ced4da', color: '#495057', background: '#ffffff', fontWeight: 600 }}
            title="Periksa koneksi & kelola database Supabase"
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
