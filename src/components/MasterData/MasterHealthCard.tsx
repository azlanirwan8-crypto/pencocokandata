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

  // Search filter
  const filteredDuplicates = useMemo(() => {
    if (!searchTerm.trim()) return allDuplicateRows;
    const q = searchTerm.toLowerCase();
    return allDuplicateRows.filter(({ kodePos, row }) => {
      return (
        kodePos.includes(q) ||
        row.Wilayah?.toLowerCase().includes(q) ||
        row['Sandi Cabang']?.toLowerCase().includes(q) ||
        row.Sandi?.toLowerCase().includes(q) ||
        row.Cabang?.toLowerCase().includes(q) ||
        row['Nama Outlet']?.toLowerCase().includes(q) ||
        row['Branch Code']?.toLowerCase().includes(q) ||
        row['Kode Cabang']?.toLowerCase().includes(q) ||
        row.ALAMAT?.toLowerCase().includes(q) ||
        row.Kelurahan?.toLowerCase().includes(q) ||
        row.Kecamatan?.toLowerCase().includes(q) ||
        row['Dati II']?.toLowerCase().includes(q)
      );
    });
  }, [allDuplicateRows, searchTerm]);

  const totalPages = Math.ceil(filteredDuplicates.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDuplicates.slice(start, start + pageSize);
  }, [filteredDuplicates, page, pageSize]);

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {health.multiOutletCount > 0 ? (
        <div
          style={{
            background: 'rgba(17, 27, 49, 0.85)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          {/* Header Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fbbf24',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={22} />
              </div>
              <div>
                <strong style={{ color: '#fbbf24', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Indikator Kesehatan Master: Terdeteksi {health.multiOutletCount} Kode Pos Multi-Cabang ({allDuplicateRows.length} Baris Terlibat)
                </strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Berikut rincian seluruh kolom data cabang yang menggunakan kode pos sama untuk mitigasi dini dan acuan Level 2 Tie-Breaker.
                </p>
              </div>
            </div>

            {/* Search Input for multi-cabang */}
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
                style={{ width: '240px', paddingRight: searchTerm ? '2rem' : '0.85rem' }}
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

          {/* Full Columns Table */}
          <div className="table-container" style={{ border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-md)' }}>
            <table className="modern-table">
              <thead>
                <tr style={{ background: '#141e36' }}>
                  <th style={{ color: '#fbbf24', background: '#192644', minWidth: '130px' }}>KODE POS</th>
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
                    <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Tidak ada data multi-cabang yang cocok dengan "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map(({ kodePos, row, indexInKp }, idx) => (
                    <tr
                      key={`${kodePos}-${row['Branch Code'] || row['Kode Cabang'] || idx}`}
                      style={{
                        background: idx % 2 === 0 ? 'rgba(245, 158, 11, 0.025)' : 'transparent',
                      }}
                    >
                      <td
                        className="code-cell"
                        style={{
                          fontWeight: 800,
                          color: '#fbbf24',
                          background: 'rgba(245, 158, 11, 0.07)',
                          borderRight: '1px solid rgba(245, 158, 11, 0.2)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <MapPin size={13} color="#fbbf24" />
                          <span>{kodePos}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>#{indexInKp}</span>
                        </div>
                      </td>
                      <td>{row.Wilayah || '-'}</td>
                      <td>
                        <strong style={{ color: '#ffffff' }}>
                          {row['Sandi Cabang'] || [row.Sandi, row.Cabang].filter(Boolean).join(' - ') || '-'}
                        </strong>
                      </td>
                      <td style={{ color: '#93c5fd', fontWeight: 600 }}>{row['Nama Outlet'] || '-'}</td>
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
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{row.Telp || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="pagination-row" style={{ marginTop: '0.75rem', paddingTop: '0.5rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
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
      ) : (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
          }}
        >
          <CheckCircle2 size={22} color="#10b981" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#34d399', fontSize: '0.92rem' }}>
              Indikator Kesehatan Master Optimal (100% Unique Mapping)
            </strong>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              Seluruh {health.uniqueKodePos.toLocaleString('id-ID')} kode pos terpetakan 1-to-1 secara presisi tanpa ada duplikasi kode pos multi-cabang.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
