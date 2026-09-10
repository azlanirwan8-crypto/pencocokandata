import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { MasterRow } from '../../types';

interface MasterDataGridProps {
  masterRows: MasterRow[];
}

export const MasterDataGrid: React.FC<MasterDataGridProps> = ({ masterRows }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const hasCombinedSandiCabang = useMemo(() => {
    return masterRows.some(r => r['Sandi Cabang'] && (!r.Sandi || r.Sandi === r['Sandi Cabang']));
  }, [masterRows]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return masterRows;
    const q = searchTerm.toLowerCase();
    return masterRows.filter((r) => {
      return (
        r.Wilayah?.toLowerCase().includes(q) ||
        r['Sandi Cabang']?.toLowerCase().includes(q) ||
        r.Sandi?.toLowerCase().includes(q) ||
        r.Cabang?.toLowerCase().includes(q) ||
        r['Branch Code']?.toLowerCase().includes(q) ||
        r['Kode Cabang']?.toLowerCase().includes(q) ||
        r['Nama Outlet']?.toLowerCase().includes(q) ||
        r['KODE POS']?.toLowerCase().includes(q) ||
        r.Kecamatan?.toLowerCase().includes(q) ||
        r.Kelurahan?.toLowerCase().includes(q) ||
        r['Dati II']?.toLowerCase().includes(q) ||
        r.ALAMAT?.toLowerCase().includes(q)
      );
    });
  }, [masterRows, searchTerm]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  if (masterRows.length === 0) return null;

  return (
    <div className="glass-card" style={{ marginTop: '1.25rem', padding: '1.25rem 1.5rem' }}>
      {/* Table Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
            Data Grid Master Cabang
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Menampilkan {filteredRows.length.toLocaleString('id-ID')} entri terfilter dari total {masterRows.length.toLocaleString('id-ID')} baris aktif.
          </p>
        </div>

        {/* Clean Search Input */}
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon-pos" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari Sandi, Outlet, Alamat..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            style={{ width: '220px', paddingRight: searchTerm ? '2rem' : '0.85rem' }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '0.5rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
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

      {/* Clean Table Container */}
      <div className="table-container">
        <table className="modern-table">
          <thead>
            <tr>
              <th style={{ width: '50px', textAlign: 'center' }}>No</th>
              <th>Wilayah</th>
              {hasCombinedSandiCabang ? (
                <th style={{ minWidth: '180px' }}>Sandi Cabang</th>
              ) : (
                <>
                  <th>Sandi</th>
                  <th style={{ minWidth: '160px' }}>Cabang</th>
                </>
              )}
              <th>Nama Outlet</th>
              <th>Branch Code</th>
              <th>Kode Cabang</th>
              <th>Status</th>
              <th style={{ color: '#38bdf8' }}>KODE POS</th>
              <th>Kecamatan</th>
              <th>Kelurahan</th>
              <th>Dati II</th>
              <th style={{ minWidth: '220px' }}>ALAMAT</th>
              <th>Telepon</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  Tidak ada data yang cocok dengan kata kunci "{searchTerm}".
                </td>
              </tr>
            ) : (
              paginatedRows.map((r, idx) => {
                const globalIndex = (page - 1) * pageSize + idx + 1;
                return (
                  <tr key={`${r['KODE POS']}-${idx}`} style={{ transition: 'background-color 0.15s' }}>
                    <td className="code-cell" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {globalIndex}
                    </td>
                    <td><span style={{ color: '#cbd5e1' }}>{r.Wilayah || '-'}</span></td>
                    {hasCombinedSandiCabang ? (
                      <td>
                        <strong style={{ color: '#ffffff', fontWeight: 600 }}>
                          {r['Sandi Cabang'] || r.Cabang || '-'}
                        </strong>
                      </td>
                    ) : (
                      <>
                        <td className="code-cell">{r.Sandi || '-'}</td>
                        <td><strong style={{ color: '#ffffff' }}>{r.Cabang || '-'}</strong></td>
                      </>
                    )}
                    <td style={{ color: '#93c5fd', fontWeight: 500 }}>{r['Nama Outlet'] || '-'}</td>
                    <td className="code-cell">{r['Branch Code'] || '-'}</td>
                    <td className="code-cell">{r['Kode Cabang'] || '-'}</td>
                    <td>
                      <span className="badge badge-match">{r['Status Outlet'] || 'Aktif'}</span>
                    </td>
                    <td className="code-cell" style={{ color: '#38bdf8', fontWeight: 700 }}>
                      {r['KODE POS']}
                    </td>
                    <td>{r.Kecamatan || '-'}</td>
                    <td>{r.Kelurahan || '-'}</td>
                    <td>{r['Dati II'] || '-'}</td>
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.ALAMAT}>
                      {r.ALAMAT || '-'}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{r.Telp || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Clean Pagination Bar */}
      <div className="pagination-row" style={{ marginTop: '0.75rem', paddingTop: '0.5rem' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Menampilkan {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredRows.length)} dari {filteredRows.length.toLocaleString('id-ID')} baris
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
          <span style={{ padding: '0 0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
            {page} / {totalPages}
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
