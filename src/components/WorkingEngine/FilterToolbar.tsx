import React from 'react';
import { Filter, Play, Search, MapPin, RotateCcw } from 'lucide-react';

interface FilterToolbarProps {
  wilayahList: string[];
  selectedWilayah: string;
  onWilayahChange: (wilayah: string) => void;
  statusFilter: 'all' | 'matched' | 'unmatched' | 'pten_diff';
  onStatusFilterChange: (status: 'all' | 'matched' | 'unmatched' | 'pten_diff') => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  onExecuteMatching: () => void;
  isProcessing: boolean;
  canExecute: boolean;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  wilayahList,
  selectedWilayah,
  onWilayahChange,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
  onExecuteMatching,
  isProcessing,
  canExecute,
}) => {
  return (
    <div className="filter-toolbar">
      <div className="filter-group">
        {/* Wilayah / Regional Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MapPin size={15} color="var(--accent-blue)" />
          <select
            className="filter-select"
            value={selectedWilayah}
            onChange={(e) => onWilayahChange(e.target.value)}
            id="filter-select-wilayah"
          >
            <option value="ALL">Semua Wilayah / Region ({wilayahList.length})</option>
            {wilayahList.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        {/* Status Pencocokan Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={15} color="#94a3b8" />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as any)}
            id="filter-select-status"
          >
            <option value="all">Status: Semua Data (All)</option>
            <option value="matched">Status: Matched Only</option>
            <option value="unmatched">Status: Unmatched Only</option>
            <option value="pten_diff">Status: PTEN Discrepancy Only</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon-pos" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari Sandi, Outlet, Alamat..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Execution Button */}
        <button
          type="button"
          className="btn btn-primary"
          onClick={onExecuteMatching}
          disabled={!canExecute || isProcessing}
          id="btn-mulai-pencocokan"
        >
          {isProcessing ? (
            <>
              <RotateCcw size={16} className="pulse-dot" />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" />
              <span>Pencocokan</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
