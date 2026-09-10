import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { MasterRow } from '../../types';

interface MasterDataGridProps {
  masterRows: MasterRow[];
}

export const MasterDataGrid: React.FC<MasterDataGridProps> = ({ masterRows }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const hasCombinedSandiCabang = useMemo(() => {
    return masterRows.some(r => r['Sandi Cabang'] && (!r.Sandi || r.Sandi === r['Sandi Cabang']));
  }, [masterRows]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return masterRows;
    const q = searchTerm.toLowerCase();
    return masterRows.filter((r) => {
      switch (searchBy) {
        case 'nama':
          return String(r['Nama Outlet'] || '').toLowerCase().includes(q);
        case 'kodepos':
          return String(r['KODE POS'] || '').toLowerCase().includes(q);
        case 'sandi':
          return (
            String(r['Sandi Cabang'] || '').toLowerCase().includes(q) ||
            String(r.Sandi || '').toLowerCase().includes(q) ||
            String(r.Cabang || '').toLowerCase().includes(q)
          );
        case 'kodecabang':
          return (
            String(r['Branch Code'] || '').toLowerCase().includes(q) ||
            String(r['Kode Cabang'] || '').toLowerCase().includes(q)
          );
        case 'wilayah':
          return String(r.Wilayah || '').toLowerCase().includes(q);
        case 'alamat':
          return (
            String(r.ALAMAT || '').toLowerCase().includes(q) ||
            String(r.Kecamatan || '').toLowerCase().includes(q) ||
            String(r.Kelurahan || '').toLowerCase().includes(q) ||
            String(r['Dati II'] || '').toLowerCase().includes(q) ||
            String(r.Provinsi || '').toLowerCase().includes(q)
          );
        case 'all':
        default:
          return (
            String(r.Wilayah || '').toLowerCase().includes(q) ||
            String(r['Sandi Cabang'] || '').toLowerCase().includes(q) ||
            String(r.Sandi || '').toLowerCase().includes(q) ||
            String(r.Cabang || '').toLowerCase().includes(q) ||
            String(r['Branch Code'] || '').toLowerCase().includes(q) ||
            String(r['Kode Cabang'] || '').toLowerCase().includes(q) ||
            String(r['Nama Outlet'] || '').toLowerCase().includes(q) ||
            String(r['KODE POS'] || '').toLowerCase().includes(q) ||
            String(r.Kecamatan || '').toLowerCase().includes(q) ||
            String(r.Kelurahan || '').toLowerCase().includes(q) ||
            String(r['Dati II'] || '').toLowerCase().includes(q) ||
            String(r.ALAMAT || '').toLowerCase().includes(q)
          );
      }
    });
  }, [masterRows, searchTerm, searchBy]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  if (masterRows.length === 0) return null;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {/* Toolbar Pencarian & Info Entri Master */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#878a99' }}>
          Menampilkan <strong style={{ color: '#212529' }}>{filteredRows.length.toLocaleString('id-ID')}</strong> entri terfilter dari total <strong style={{ color: '#212529' }}>{masterRows.length.toLocaleString('id-ID')}</strong> baris master aktif.
        </div>

        {/* Clean Velzon Search & Filter By Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#878a99', fontWeight: 500 }}>Search by:</span>
            <select
              value={searchBy}
              onChange={(e) => {
                setSearchBy(e.target.value);
                setPage(1);
              }}
              style={{
                fontSize: '0.78rem',
                padding: '0.38rem 0.65rem',
                borderRadius: '4px',
                border: '1px solid #ced4da',
                background: '#ffffff',
                color: '#495057',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">Semua Kolom</option>
              <option value="nama">Nama Outlet</option>
              <option value="kodepos">KODE POS</option>
              <option value="sandi">Sandi Cabang</option>
              <option value="kodecabang">Branch / Kode Cabang</option>
              <option value="wilayah">Wilayah</option>
              <option value="alamat">Alamat / Lokasi</option>
            </select>
          </div>

          <div className="search-input-wrapper">
            <Search size={14} className="search-icon-pos" />
            <input
              type="text"
              className="search-input"
              placeholder={
                searchBy === 'nama' ? 'Cari nama outlet...' :
                searchBy === 'kodepos' ? 'Cari kode pos...' :
                searchBy === 'sandi' ? 'Cari sandi cabang...' :
                searchBy === 'kodecabang' ? 'Cari kode cabang...' :
                searchBy === 'wilayah' ? 'Cari wilayah...' :
                searchBy === 'alamat' ? 'Cari alamat, kecamatan...' :
                'Cari Sandi, Outlet, Alamat...'
              }
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              style={{ width: '230px', paddingRight: searchTerm ? '2rem' : '0.85rem' }}
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
      </div>

      {/* Clean Table Container */}
      <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px' }}>
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
              <th style={{ color: '#405189' }}>KODE POS</th>
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
                <td colSpan={14} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                  Tidak ada data yang cocok dengan kata kunci "{searchTerm}".
                </td>
              </tr>
            ) : (
              paginatedRows.map((r, idx) => {
                const globalIndex = (page - 1) * pageSize + idx + 1;
                return (
                  <tr key={`${r['KODE POS']}-${idx}`} style={{ background: idx % 2 === 0 ? '#fafbfe' : '#ffffff' }}>
                    <td className="code-cell" style={{ textAlign: 'center', color: '#878a99' }}>
                      {globalIndex}
                    </td>
                    <td><span style={{ color: '#495057' }}>{r.Wilayah || '-'}</span></td>
                    {hasCombinedSandiCabang ? (
                      <td>
                        <strong style={{ color: '#212529', fontWeight: 600 }}>
                          {r['Sandi Cabang'] || r.Cabang || '-'}
                        </strong>
                      </td>
                    ) : (
                      <>
                        <td className="code-cell">{r.Sandi || '-'}</td>
                        <td><strong style={{ color: '#212529', fontWeight: 600 }}>{r.Cabang || '-'}</strong></td>
                      </>
                    )}
                    <td style={{ color: '#405189', fontWeight: 500 }}>{r['Nama Outlet'] || '-'}</td>
                    <td className="code-cell">{r['Branch Code'] || '-'}</td>
                    <td className="code-cell">{r['Kode Cabang'] || '-'}</td>
                    <td>
                      <span className="badge badge-match">{r['Status Outlet'] || 'Aktif'}</span>
                    </td>
                    <td className="code-cell" style={{ color: '#405189', fontWeight: 700 }}>
                      {r['KODE POS']}
                    </td>
                    <td>{r.Kecamatan || '-'}</td>
                    <td>{r.Kelurahan || '-'}</td>
                    <td>{r['Dati II'] || '-'}</td>
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.ALAMAT}>
                      {r.ALAMAT || '-'}
                    </td>
                    <td style={{ color: '#878a99', fontSize: '0.78rem' }}>{r.Telp || '-'}</td>
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
  );
};
