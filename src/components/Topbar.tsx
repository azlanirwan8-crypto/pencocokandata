import React, { useState } from 'react';
import { Menu, Archive, Database, Save, KeyRound } from 'lucide-react';
import { flushPendingWrites } from '../utils/storage';
import { getStoredGoogleApiKey } from '../utils/onlineGeoCoder';
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
  isNeonConnected,
  lastSyncedAt,
  onOpenNeonModal,
}) => {
  const [savedTick, setSavedTick] = useState(false);
  const { add: notify } = useNotification();
  // Kunci Google menentukan sumber titik koordinat & lapisan peta — statusnya sering
  // tidak terlihat padahal mengubah hasil, jadi tampil di baris atas.
  const kunciGoogle = Boolean(getStoredGoogleApiKey());

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
        {/* Status koneksi cloud (Supabase Postgres) */}
        {isNeonConnected !== undefined && (
          <span
            title={isNeonConnected ? `Terhubung ke Supabase Postgres${lastSyncedAt ? ` · disinkron ${lastSyncedAt}` : ''}` : 'Tidak terhubung ke cloud — data hanya tersimpan di browser ini'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.72rem', fontWeight: 600, padding: '0.25rem 0.6rem', borderRadius: '9999px',
              background: isNeonConnected ? 'rgba(10,179,156,0.1)' : 'rgba(240,101,72,0.1)',
              color: isNeonConnected ? '#07796a' : '#c0392b',
              border: `1px solid ${isNeonConnected ? 'rgba(10,179,156,0.35)' : 'rgba(240,101,72,0.35)'}`,
            }}
          >
            <Database size={12} />
            {isNeonConnected ? 'Terhubung' : 'Offline'}
          </span>
        )}
        <span
          title={kunciGoogle
            ? 'Kunci Google tersimpan di browser ini — pencarian titik memakai Google lebih dulu dan peta memakai lapisan Google.'
            : 'Belum ada kunci Google di browser ini — titik dicari lewat ESRI/OpenStreetMap dan peta memakai OpenStreetMap. Isi kunci lewat menu Data Kode Pos.'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            fontSize: '0.72rem', fontWeight: 600, padding: '0.25rem 0.6rem', borderRadius: '9999px',
            background: kunciGoogle ? 'rgba(53,119,241,0.1)' : 'rgba(134,142,150,0.12)',
            color: kunciGoogle ? '#2b5fa8' : '#6c757d',
            border: `1px solid ${kunciGoogle ? 'rgba(53,119,241,0.35)' : 'rgba(134,142,150,0.35)'}`,
          }}
        >
          <KeyRound size={12} />
          Google {kunciGoogle ? '✓' : '✗'}
        </span>
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
