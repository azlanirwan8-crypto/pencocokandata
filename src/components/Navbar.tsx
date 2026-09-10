import React from 'react';
import { LayoutDashboard, Database, Cpu, ShieldCheck, Trash2 } from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'master' | 'working';
  setActiveTab: (tab: 'dashboard' | 'master' | 'working') => void;
  masterCount: number;
  targetCount: number;
  onResetAll?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  masterCount,
  targetCount,
  onResetAll,
}) => {
  return (
    <header className="top-navbar">
      <div className="brand-section">
        <div className="brand-logo">
          <Cpu size={26} />
        </div>
        <div className="brand-info">
          <h1>
            Data Matcher Cabang & Outlet
            <span className="badge-version">v2.0 Architecture</span>
          </h1>
          <p>Otomasi Pencocokan, Validasi PTEN & Pengayaan Data Operasional Cabang</p>
        </div>
      </div>

      <nav className="nav-tabs" aria-label="Main Navigation">
        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
          id="nav-btn-dashboard"
        >
          <LayoutDashboard size={16} />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'master' ? 'active' : ''}`}
          onClick={() => setActiveTab('master')}
          id="nav-btn-master"
        >
          <Database size={16} />
          <span>Data Master</span>
          {masterCount > 0 && <span className="nav-tab-badge">{masterCount}</span>}
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'working' ? 'active' : ''}`}
          onClick={() => setActiveTab('working')}
          id="nav-btn-working"
        >
          <Cpu size={16} />
          <span>Data yang Akan Dicocokan</span>
          {targetCount > 0 && <span className="nav-tab-badge">{targetCount}</span>}
        </button>
      </nav>

      <div className="nav-actions">
        {(masterCount > 0 || targetCount > 0) && onResetAll && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onResetAll}
            title="Kosongkan data untuk mengunggah berkas baru"
            style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
          >
            <Trash2 size={13} />
            <span>Reset Data</span>
          </button>
        )}
        <div className="status-pill" title="Arsitektur Anti-Stopper Chunk Stream Aktif">
          <span className="pulse-dot"></span>
          <ShieldCheck size={14} />
          <span>Anti-Stopper O(1)</span>
        </div>
      </div>
    </header>
  );
};
