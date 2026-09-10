import React, { useState, useMemo } from 'react';
import { ShieldAlert, CheckCircle2, MapPin, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { MasterHealth, MasterRow } from '../../types';

interface MasterHealthCardProps {
  health: MasterHealth;
}

export const MasterHealthCard: React.FC<MasterHealthCardProps> = ({ health }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  if (health.totalRows === 0) return null;

  // Flatten all multi-outlet master rows
  const allDuplicateRows: { kodePos: string; row: MasterRow; indexInKp: number }[] = useMemo(() => {
    const list: { kodePos: string; row: MasterRow; indexInKp: number }[] = [];
    health.multiOutletItems.forEach((item) => {
      (item.matchingMasterRows || []).forEach((r, idx) => {
        list.push({
          kodePos: item.kodePos,
          row: r,
          indexInKp: idx + 1,
        });
      });
    });
    return list;
  }, [health.multiOutletItems]);

  // Search filter (Safe for any data types)
  const filteredDuplicates = useMemo(() => {
    if (!searchTerm.trim()) return allDuplicateRows;
    const q = searchTerm.toLowerCase();
    return allDuplicateRows.filter(({ kodePos, row }) => {
      return (
        String(kodePos || '').toLowerCase().includes(q) ||
        String(row.Wilayah || '').toLowerCase().includes(q) ||
        String(row['Sandi Cabang'] || '').toLowerCase().includes(q) ||
        String(row.Sandi || '').toLowerCase().includes(q) ||
        String(row.Cabang || '').toLowerCase().includes(q) ||
        String(row['Nama Outlet'] || '').toLowerCase().includes(q) ||
        String(row['Branch Code'] || '').toLowerCase().includes(q) ||
        String(row['Kode Cabang'] || '').toLowerCase().includes(q) ||
        String(row.ALAMAT || '').toLowerCase().includes(q) ||
        String(row.Kelurahan || '').toLowerCase().includes(q) ||
        String(row.Kecamatan || '').toLowerCase().includes(q) ||
        String(row['Dati II'] || '').toLowerCase().includes(q)
      );
    });
  }, [allDuplicateRows, searchTerm]);

  const totalPages = Math.ceil(filteredDuplicates.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDuplicates.slice(start, start + pageSize);
  }, [filteredDuplicates, page, pageSize]);

  return (
    <div style={{ marginTop: '1rem' }}>
      {health.multiOutletCount > 0 ? (
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
          {/* Header Banner khas Velzon */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(247, 184, 75, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={22} />
              </div>
              <div>
                <strong style={{ color: '#212529', fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Indikator Kesehatan Master: Terdeteksi {health.multiOutletCount} Kode Pos Multi-Cabang ({allDuplicateRows.length} Baris Terlibat)
                </strong>
                <p style={{ fontSize: '0.78rem', color: '#878a99', marginTop: '0.15rem' }}>
                  Rincian seluruh kolom cabang dengan kode pos ganda untuk mitigasi dini dan acuan Tie-Breaker Level 2.
                </p>
              </div>
            </div>

            {/* Clean Velzon Search Input */}
            <div className="search-input-wrapper">
              <Search size={14} className="search-icon-pos" />
              <input
                type="text"
                className="search-input"
                placeholder="Cari Kode Pos, Outlet, Alamat..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                style={{ width: '250px', paddingRight: searchTerm ? '2rem' : '0.85rem' }}
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

          {/* Clean Velzon Table */}
          <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '130px', color: '#d97706' }}>KODE POS</th>
                  <th>Wilayah</th>
                  <th>Sandi Cabang</th>
                  <th>Nama Outlet</th>
                  <th>Branch Code</th>
                  <th>Kode Cabang</th>
                  <th>Status</th>
                  <th>Kelurahan</th>
                  <th>Kecamatan</th>
                  <th>Dati II</th>
                  <th>Provinsi</th>
                  <th style={{ minWidth: '240px' }}>ALAMAT</th>
                  <th>Telepon</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: '#878a99' }}>
                      Tidak ada data multi-cabang yang cocok dengan "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map(({ kodePos, row, indexInKp }, idx) => (
                    <tr
                      key={`${kodePos}-${row['Branch Code'] || row['Kode Cabang'] || idx}`}
                      style={{ background: idx % 2 === 0 ? '#fafbfe' : '#ffffff' }}
                    >
                      <td
                        className="code-cell"
                        style={{
                          fontWeight: 700,
                          color: '#d97706',
                          background: 'rgba(247, 184, 75, 0.08)',
                          borderRight: '1px solid #e9ebec',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <MapPin size={13} color="#d97706" />
                          <span>{kodePos}</span>
                          <span style={{ fontSize: '0.7rem', color: '#878a99' }}>#{indexInKp}</span>
                        </div>
                      </td>
                      <td>{row.Wilayah || '-'}</td>
                      <td>
                        <strong style={{ color: '#212529' }}>
                          {row['Sandi Cabang'] || [row.Sandi, row.Cabang].filter(Boolean).join(' - ') || '-'}
                        </strong>
                      </td>
                      <td style={{ color: '#405189', fontWeight: 600 }}>{row['Nama Outlet'] || '-'}</td>
                      <td className="code-cell">{row['Branch Code'] || '-'}</td>
                      <td className="code-cell">{row['Kode Cabang'] || '-'}</td>
                      <td>
                        <span className="badge badge-match">{row['Status Outlet'] || 'Aktif'}</span>
                      </td>
                      <td>{row.Kelurahan || '-'}</td>
                      <td>{row.Kecamatan || '-'}</td>
                      <td>{row['Dati II'] || '-'}</td>
                      <td>{row.Provinsi || '-'}</td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.ALAMAT}>
                        {row.ALAMAT || '-'}
                      </td>
                      <td style={{ color: '#878a99', fontSize: '0.78rem' }}>{row.Telp || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Clean Pagination Bar */}
          <div className="pagination-row" style={{ marginTop: '0.75rem', paddingTop: '0.5rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
              Menampilkan {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredDuplicates.length)} dari {filteredDuplicates.length.toLocaleString('id-ID')} baris
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
      ) : (
        <div
          className="glass-card"
          style={{
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(10, 179, 156, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0ab39c',
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <strong style={{ color: '#0ab39c', fontSize: '0.95rem' }}>
              Kondisi Data Master 100% Sehat & Unik
            </strong>
            <p style={{ fontSize: '0.78rem', color: '#878a99', marginTop: '0.1rem' }}>
              Tidak terdeteksi kode pos multi-cabang. Setiap kode pos memetakan 1 cabang unik secara deterministik.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
