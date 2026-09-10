import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, MapPin, Filter, Play, RotateCcw, X } from 'lucide-react';
import type { TargetRow } from '../../types';

interface TargetDataGridProps {
  rows: TargetRow[];
  totalInputRows: number;
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
  matchedDone: boolean;
}

export const TargetDataGrid: React.FC<TargetDataGridProps> = ({
  rows,
  totalInputRows,
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
  matchedDone,
}) => {
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const hasCombinedSandiCabang = rows.some(r => r['Sandi Cabang'] && (!r.Sandi || r.Sandi === r['Sandi Cabang']));

  return (
    <div className="glass-card" style={{ marginTop: '1rem', padding: '1.25rem 1.5rem' }}>
      {/* Top Row: Title & Action Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#212529', letterSpacing: '-0.01em' }}>
            Pratinjau Data Target Operasional
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#878a99', marginTop: '0.15rem' }}>
            Menampilkan {rows.length.toLocaleString('id-ID')} baris data terfilter (dari total {totalInputRows.toLocaleString('id-ID')} baris input awal).
          </p>
        </div>

        {/* Execution Button di dalam card tabel */}
        <div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onExecuteMatching}
            disabled={!canExecute || isProcessing}
            id="btn-mulai-pencocokan"
            style={{ padding: '0.42rem 0.95rem' }}
          >
            {isProcessing ? (
              <>
                <RotateCcw size={14} className="pulse-dot" />
                <span>Memproses...</span>
              </>
            ) : matchedDone ? (
              <>
                <RotateCcw size={14} />
                <span>Ulangi Pencocokan</span>
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" />
                <span>Mulai Pencocokan Bertingkat</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter & Search Bar langsung di dalam tabel card (Velzon datatable filter row) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.6rem',
          padding: '0.65rem 0.85rem',
          background: '#f8f9fa',
          border: '1px solid #e9ebec',
          borderRadius: '6px',
          marginBottom: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Dropdown Wilayah */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MapPin size={14} color="#405189" />
            <select
              className="filter-select"
              value={selectedWilayah}
              onChange={(e) => {
                onWilayahChange(e.target.value);
                setPage(1);
              }}
              id="filter-select-wilayah"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
            >
              <option value="ALL">Semua Wilayah / Region ({wilayahList.length})</option>
              {wilayahList.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Filter size={14} color="#878a99" />
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => {
                onStatusFilterChange(e.target.value as any);
                setPage(1);
              }}
              id="filter-select-status"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
            >
              <option value="all">Status: Semua Data (All)</option>
              <option value="matched">Status: Matched Only</option>
              <option value="unmatched">Status: Unmatched Only</option>
              <option value="pten_diff">Status: PTEN Discrepancy Only</option>
            </select>
          </div>
        </div>

        {/* Input Search */}
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon-pos" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari Sandi, Outlet, Alamat..."
            value={searchTerm}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setPage(1);
            }}
            style={{ width: '240px', paddingRight: searchTerm ? '2rem' : '0.85rem' }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                setPage(1);
              }}
              style={{
                position: 'absolute',
                right: '0.5rem',
                background: 'transparent',
                border: 'none',
                color: '#878a99',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px' }}>
        <table className="modern-table">
          <thead>
            <tr>
              <th style={{ width: '60px', textAlign: 'center', background: '#f3f6f9', borderRight: '1px solid #e9ebec', color: '#405189' }}>No</th>
              <th>Status Match</th>
              <th>CEK PTEN</th>
              <th>Wilayah</th>
              {/* Atribut Hasil Enrichment Master */}
              {hasCombinedSandiCabang ? (
                <th style={{ color: '#405189' }}>Sandi Cabang (Master)</th>
              ) : (
                <>
                  <th style={{ color: '#405189' }}>Sandi (Master)</th>
                  <th style={{ color: '#405189' }}>Cabang (Master)</th>
                </>
              )}
              <th style={{ color: '#405189' }}>Branch Code (Master)</th>
              <th style={{ color: '#405189' }}>Kode Cabang (Master)</th>
              <th style={{ color: '#405189' }}>Nama Outlet (Master)</th>
              <th style={{ color: '#405189' }}>Status Outlet (Master)</th>
              <th style={{ color: '#405189' }}>ALAMAT (Master)</th>
              {/* Kolom Target Asli & Validasi */}
              <th>KODE POS</th>
              <th>Kelurahan</th>
              <th>Kecamatan</th>
              <th>Dati II</th>
              <th>Kode Dati II</th>
              <th>Provinsi</th>
              <th>KOTA PTEN</th>
              <th>KODE POS PTEN</th>
              <th>SUMBER DATA</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={20} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                  Tidak ada baris data yang cocok dengan kriteria filter saat ini.
                </td>
              </tr>
            ) : (
              paginatedRows.map((r) => {
                const isMatched = r._isMatched ?? (r.Sandi !== '' || r['Sandi Cabang'] !== '');
                const isPtenDiff = r['CEK KODE POS + PTEN'] === 'DIFFERENT';

                return (
                  <tr
                    key={String(r.No)}
                    className={isMatched ? 'row-matched' : 'row-unmatched'}
                  >
                    {/* 1. Locked Column No */}
                    <td
                      className="code-cell"
                      style={{
                        textAlign: 'center',
                        background: '#ffffff',
                        fontWeight: 700,
                        color: '#405189',
                        borderRight: '1px solid #e9ebec',
                      }}
                    >
                      {r.No}
                    </td>

                    {/* Status Match Badge */}
                    <td>
                      {isMatched ? (
                        <span className={`badge ${r._matchLevel === 'level2' ? 'badge-level2' : 'badge-match'}`}>
                          {r._matchLevel === 'level2' ? 'MATCH (L2 TIE)' : 'MATCH (L1)'}
                        </span>
                      ) : (
                        <span className="badge badge-unmatched">UNMATCHED</span>
                      )}
                    </td>

                    {/* CEK KODE POS + PTEN */}
                    <td>
                      {r['CEK KODE POS + PTEN'] === 'MATCH' ? (
                        <span className="badge badge-match">MATCH</span>
                      ) : r['CEK KODE POS + PTEN'] === 'DIFFERENT' ? (
                        <span className="badge badge-diff">DIFFERENT</span>
                      ) : (
                        <span style={{ color: '#878a99' }}>-</span>
                      )}
                    </td>

                    {/* Wilayah */}
                    <td><span style={{ color: '#495057' }}>{r.Wilayah || '-'}</span></td>

                    {/* Auto-populated Master Attributes */}
                    {hasCombinedSandiCabang ? (
                      <td>
                        <strong style={{ color: isMatched ? '#212529' : '#878a99' }}>
                          {r['Sandi Cabang'] || r.Cabang || '-'}
                        </strong>
                      </td>
                    ) : (
                      <>
                        <td className="code-cell" style={{ color: '#405189' }}>
                          {r.Sandi || <span style={{ color: '#878a99' }}>-</span>}
                        </td>
                        <td>
                          <strong style={{ color: isMatched ? '#212529' : '#878a99' }}>
                            {r.Cabang || '-'}
                          </strong>
                        </td>
                      </>
                    )}
                    <td className="code-cell">
                      {r['Branch Code'] || <span style={{ color: '#878a99' }}>-</span>}
                    </td>
                    <td className="code-cell">
                      {r['Kode Cabang'] || <span style={{ color: '#878a99' }}>-</span>}
                    </td>
                    <td style={{ color: '#405189', fontWeight: 500 }}>{r['Nama Outlet'] || <span style={{ color: '#878a99' }}>-</span>}</td>
                    <td>
                      {r['Status Outlet'] ? (
                        <span className="badge badge-match">{r['Status Outlet']}</span>
                      ) : (
                        <span style={{ color: '#878a99' }}>-</span>
                      )}
                    </td>
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.ALAMAT}>
                      {r.ALAMAT || <span style={{ color: '#878a99' }}>-</span>}
                    </td>

                    {/* Target Data Asli */}
                    <td className="code-cell" style={{ color: '#405189', fontWeight: 700 }}>{r['KODE POS']}</td>
                    <td>{r.Kelurahan || '-'}</td>
                    <td>{r.Kecamatan || '-'}</td>
                    <td>{r['Dati II'] || '-'}</td>
                    <td className="code-cell">{r['Kode Dati II'] || '-'}</td>
                    <td>{r.Provinsi || '-'}</td>
                    <td>{r['KOTA PTEN'] || '-'}</td>
                    <td
                      className="code-cell"
                      style={{ color: isPtenDiff ? '#f06548' : '#405189', fontWeight: isPtenDiff ? 700 : 600 }}
                    >
                      {r['KODE POS PTEN'] || '-'}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#878a99' }}>
                        {r['SUMBER DATA'] || '-'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Clean Pagination Bar */}
      <div className="pagination-row" style={{ marginTop: '0.75rem', paddingTop: '0.5rem' }}>
        <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
          Menampilkan {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, rows.length)} dari {rows.length.toLocaleString('id-ID')} baris
        </div>
        <div className="pagination-controls">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(p - 1, 1))}
          >
            <ChevronLeft size={13} />
            <span>Sebelumnya</span>
          </button>
          <span style={{ padding: '0 0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#495057' }}>
            Hal {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
          >
            <span>Berikutnya</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
