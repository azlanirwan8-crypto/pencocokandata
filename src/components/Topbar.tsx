import React from 'react';
import { Menu } from 'lucide-react';

interface TopbarProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
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

      <div className="topbar-right">
      </div>
    </header>
  );
};
