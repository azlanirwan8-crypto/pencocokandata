import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Database,
  FileCheck,
  Layers,
  Map,
  ShieldCheck,
  Store,
  Users,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

export type ActiveTab = 'dashboard' | 'working' | 'wilayah' | 'pten' | 'master' | 'mapping_role';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isCollapsed: boolean;
  masterCount?: number;
  targetCount?: number;
  wilayahCount?: number;
  ptenCount?: number;
  roleMappingCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  masterCount,
  targetCount,
  wilayahCount,
  ptenCount,
  roleMappingCount,
}) => {
  // Is Data Master submenu expanded?
  const isMasterActive = activeTab === 'master' || activeTab === 'wilayah' || activeTab === 'pten' || activeTab === 'mapping_role';
  const [isMasterOpen, setIsMasterOpen] = useState<boolean>(true);

  // Auto-expand Data Master when one of its children becomes active
  useEffect(() => {
    if (isMasterActive) {
      setIsMasterOpen(true);
    }
  }, [isMasterActive]);

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`} id="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo">
          <Layers size={20} />
        </div>
        <div className="sidebar-brand-text">
          <span className="brand-title">DATA MATCHER</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="sidebar-menu-wrapper">
        <div className="sidebar-menu-title">MENU UTAMA</div>
        <nav className="sidebar-nav">
          {/* 1. Dashboard */}
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            id="sidebar-btn-dashboard"
            title="Dashboard"
          >
            <div className="nav-item-icon">
              <LayoutDashboard size={17} />
            </div>
            <span className="nav-item-label">Dashboard</span>
          </button>

          {/* 2. Data Analisa */}
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'working' ? 'active' : ''}`}
            onClick={() => setActiveTab('working')}
            id="sidebar-btn-working"
            title="Data Analisa Pencocokan"
          >
            <div className="nav-item-icon">
              <FileCheck size={17} />
            </div>
            <span className="nav-item-label">Data Analisa</span>
            {targetCount !== undefined && targetCount > 0 && (
              <span className="sidebar-badge badge-target">{targetCount}</span>
            )}
          </button>

          {/* 3. Data Master (Collapsible Parent) */}
          <div>
            <button
              type="button"
              className={`sidebar-nav-item ${isMasterActive ? 'active' : ''}`}
              onClick={() => {
                if (!isMasterOpen) {
                  setIsMasterOpen(true);
                  if (!isMasterActive) setActiveTab('wilayah');
                } else {
                  setIsMasterOpen(!isMasterOpen);
                }
              }}
              id="sidebar-btn-datamaster"
              title="Data Master (Wilayah, PTEN, Cabang, Mapping Role)"
              style={{ justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div className="nav-item-icon">
                  <Database size={17} />
                </div>
                <span className="nav-item-label">Data Master</span>
              </div>
              <div className="nav-item-collapse-icon" style={{ color: '#8c9cd0', display: 'flex', alignItems: 'center' }}>
                {isMasterOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            </button>

            {/* Submenu Data Master: Clean list with full counters */}
            {isMasterOpen && (
              <div className="sidebar-submenu">
                {/* 3.a. Wilayah */}
                <button
                  type="button"
                  className={`sidebar-sub-item ${activeTab === 'wilayah' ? 'active' : ''}`}
                  onClick={() => setActiveTab('wilayah')}
                  id="sidebar-btn-wilayah"
                  title="Master Setting Wilayah"
                >
                  <Map size={14} />
                  <span>Wilayah</span>
                  {wilayahCount !== undefined && wilayahCount > 0 && (
                    <span className="sidebar-sub-badge">
                      {wilayahCount.toLocaleString('id-ID')}
                    </span>
                  )}
                </button>

                {/* 3.b. PTEN */}
                <button
                  type="button"
                  className={`sidebar-sub-item ${activeTab === 'pten' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pten')}
                  id="sidebar-btn-pten"
                  title="Master Data PTEN"
                >
                  <ShieldCheck size={14} />
                  <span>PTEN</span>
                  {ptenCount !== undefined && ptenCount > 0 ? (
                    <span className="sidebar-sub-badge">
                      {ptenCount.toLocaleString('id-ID')}
                    </span>
                  ) : null}
                </button>

                {/* 3.c. Cabang */}
                <button
                  type="button"
                  className={`sidebar-sub-item ${activeTab === 'master' ? 'active' : ''}`}
                  onClick={() => setActiveTab('master')}
                  id="sidebar-btn-master"
                  title="Master Data Cabang & Outlet"
                >
                  <Store size={14} />
                  <span>Cabang</span>
                  {masterCount !== undefined && masterCount > 0 && (
                    <span className="sidebar-sub-badge">
                      {masterCount.toLocaleString('id-ID')}
                    </span>
                  )}
                </button>

                {/* 3.d. Mapping Role */}
                <button
                  type="button"
                  className={`sidebar-sub-item ${activeTab === 'mapping_role' ? 'active' : ''}`}
                  onClick={() => setActiveTab('mapping_role')}
                  id="sidebar-btn-mapping-role"
                  title="Master Mapping Role Organisasi"
                >
                  <Users size={14} />
                  <span>Mapping Role</span>
                  {roleMappingCount !== undefined && roleMappingCount > 0 ? (
                    <span className="sidebar-sub-badge">
                      {roleMappingCount.toLocaleString('id-ID')}
                    </span>
                  ) : null}
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
};
