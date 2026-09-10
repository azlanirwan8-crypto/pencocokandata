import React from 'react';
import { LayoutDashboard, Database, FileCheck, Layers } from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'master' | 'working';
  setActiveTab: (tab: 'dashboard' | 'master' | 'working') => void;
  masterCount: number;
  targetCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  masterCount,
  targetCount,
}) => {
  return (
    <aside className="app-sidebar">
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
          >
            <div className="nav-item-icon">
              <Database size={18} />
            </div>
            <span className="nav-item-label">Data Master</span>
            {masterCount > 0 && (
              <span className="sidebar-badge badge-master">
                {masterCount.toLocaleString('id-ID')}
              </span>
            )}
          </button>

          {/* 3. Data Cek */}
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'working' ? 'active' : ''}`}
            onClick={() => setActiveTab('working')}
            id="sidebar-btn-working"
          >
            <div className="nav-item-icon">
              <FileCheck size={18} />
            </div>
            <span className="nav-item-label">Data Cek</span>
            {targetCount > 0 && (
              <span className="sidebar-badge badge-target">
                {targetCount.toLocaleString('id-ID')}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Sidebar Footer Info */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-card">
          <span className="footer-label">Velzon Enterprise</span>
          <span className="footer-status">● Sistem Siap</span>
        </div>
      </div>
    </aside>
  );
};
