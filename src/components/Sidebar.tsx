import React from 'react';
import { LayoutDashboard, Database, FileCheck, Layers, Map } from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'master' | 'working' | 'wilayah';
  setActiveTab: (tab: 'dashboard' | 'master' | 'working' | 'wilayah') => void;
  isCollapsed: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
}) => {
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
        <div className="sidebar-menu-title">MENU</div>
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
              <LayoutDashboard size={18} />
            </div>
            <span className="nav-item-label">Dashboard</span>
          </button>

          {/* 2. Data Master */}
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'master' ? 'active' : ''}`}
            onClick={() => setActiveTab('master')}
            id="sidebar-btn-master"
            title="Data Master"
          >
            <div className="nav-item-icon">
              <Database size={18} />
            </div>
            <span className="nav-item-label">Data Master</span>
          </button>

          {/* 3. Data Cek */}
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'working' ? 'active' : ''}`}
            onClick={() => setActiveTab('working')}
            id="sidebar-btn-working"
            title="Data Cek"
          >
            <div className="nav-item-icon">
              <FileCheck size={18} />
            </div>
            <span className="nav-item-label">Data Cek</span>
          </button>
          {/* 4. Setting Wilayah */}
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'wilayah' ? 'active' : ''}`}
            onClick={() => setActiveTab('wilayah')}
            id="sidebar-btn-wilayah"
            title="Setting Wilayah"
          >
            <div className="nav-item-icon">
              <Map size={18} />
            </div>
            <span className="nav-item-label">Setting Wilayah</span>
          </button>
        </nav>
      </div>
    </aside>
  );
};
