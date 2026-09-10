import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MasterRow } from '../../types';

interface MasterDataGridProps {
  masterRows: MasterRow[];
}

export const MasterDataGrid: React.FC<MasterDataGridProps> = ({ masterRows }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return masterRows;
    const q = searchTerm.toLowerCase();
    return masterRows.filter((r) => {
      return (
        r.Wilayah?.toLowerCase().includes(q) ||
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

  return (
    <div className="glass-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-header">
        <div>
          <h2 className="section-title" style={{ fontSize: '1.15rem' }}>
            Data Grid & Pratinjau Master
          </h2>
          <p className="section-subtitle">
            Seluruh data master aktif ({filteredRows.length.toLocaleString('id-ID')} entri terfilter dari total {masterRows.length.toLocaleString('id-ID')}).
          </p>
        </div>

        <div className="search-input-wrapper">
          <Search size={15} className="search-icon-pos" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari Sandi, Cabang, Kode Pos..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="table-container" style={{ marginTop: '1rem' }}>
        <table className="modern-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Wilayah</th>
              <th>Sandi</th>
              <th>Cabang</th>
              <th>Branch Code</th>
              <th>Kode Cabang</th>
              <th>Nama Outlet</th>
              <th>Status</th>
              <th>KODE POS</th>
              <th>Kecamatan</th>
              <th>Kelurahan</th>
              <th>Dati II</th>
              <th>ALAMAT</th>
              <th>Telepon</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  Tidak ada data master yang sesuai dengan pencarian "{searchTerm}".
                </td>
              </tr>
            ) : (
              paginatedRows.map((r, idx) => {
                const globalIndex = (page - 1) * pageSize + idx + 1;
                return (
                  <tr key={`${r['KODE POS']}-${r.Sandi}-${idx}`}>
                    <td className="code-cell">{globalIndex}</td>
                    <td><span style={{ color: '#cbd5e1' }}>{r.Wilayah}</span></td>
                    <td className="code-cell">{r.Sandi}</td>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{r.Cabang}</strong></td>
                    <td className="code-cell">{r['Branch Code']}</td>
                    <td className="code-cell">{r['Kode Cabang']}</td>
                    <td>{r['Nama Outlet']}</td>
                    <td>
                      <span className="badge badge-match">{r['Status Outlet'] || 'Aktif'}</span>
                    </td>
                    <td className="code-cell" style={{ color: '#60a5fa' }}>{r['KODE POS']}</td>
                    <td>{r.Kecamatan}</td>
                    <td>{r.Kelurahan}</td>
                    <td>{r['Dati II']}</td>
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.ALAMAT}>
                      {r.ALAMAT}
                    </td>
                    <td>{r.Telp}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="pagination-row">
        <div>
          Menampilkan {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredRows.length)} dari {filteredRows.length} baris
        </div>
        <div className="pagination-controls">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(p - 1, 1))}
          >
            <ChevronLeft size={14} />
            <span>Sebelumnya</span>
          </button>
          <span style={{ padding: '0 0.5rem', fontFamily: 'var(--font-mono)' }}>
            Hal {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
          >
            <span>Berikutnya</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
