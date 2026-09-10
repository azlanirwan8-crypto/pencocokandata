import React from 'react';
import { Trash2 } from 'lucide-react';

interface TopbarProps {
  activeTab: 'dashboard' | 'master' | 'working';
  onResetAll?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ activeTab, onResetAll }) => {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard';
      case 'master':
        return 'Data Master';
      case 'working':
        return 'Data Cek';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <h4 className="topbar-title">{getTabTitle()}</h4>
        <div className="topbar-breadcrumb">
          <span>Aplikasi</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{getTabTitle()}</span>
        </div>
      </div>

      <div className="topbar-right">
        {onResetAll && (
          <button
            type="button"
            className="btn btn-outline btn-sm topbar-reset-btn"
            onClick={onResetAll}
            title="Kosongkan seluruh data untuk memulai proses baru"
            id="btn-topbar-reset"
          >
            <Trash2 size={13} color="#f06548" />
            <span>Reset Data</span>
          </button>
        )}
      </div>
    </header>
  );
};
