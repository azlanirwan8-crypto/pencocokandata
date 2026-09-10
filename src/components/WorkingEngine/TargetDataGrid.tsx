import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TargetRow } from '../../types';

interface TargetDataGridProps {
  rows: TargetRow[];
  totalInputRows: number;
}

export const TargetDataGrid: React.FC<TargetDataGridProps> = ({ rows, totalInputRows }) => {
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const hasCombinedSandiCabang = rows.some(r => r['Sandi Cabang'] && (!r.Sandi || r.Sandi === r['Sandi Cabang']));

  return (
    <div className="glass-card" style={{ marginTop: '1.25rem' }}>
      <div className="section-header">
        <div>
          <h2 className="section-title" style={{ fontSize: '1.15rem' }}>
            Pratinjau Data Target Operasional
          </h2>
          <p className="section-subtitle">
            Menampilkan {rows.length.toLocaleString('id-ID')} baris data terfilter (dari {totalInputRows.toLocaleString('id-ID')} baris input awal).
          </p>
        </div>
      </div>

      <div className="table-container" style={{ marginTop: '1rem' }}>
        <table className="modern-table">
          <thead>
            <tr>
              <th style={{ background: '#f3f6f9', borderRight: '1px solid var(--border-subtle)', color: '#405189' }}>No (Kunci Urutan)</th>
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
                <td colSpan={20} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
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
                        background: '#ffffff',
                        fontWeight: 700,
                        color: '#405189',
                        borderRight: '1px solid var(--border-subtle)',
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
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>

                    {/* Wilayah */}
                    <td><span style={{ color: '#cbd5e1' }}>{r.Wilayah}</span></td>

                    {/* Auto-populated Master Attributes */}
                    {hasCombinedSandiCabang ? (
                      <td>
                        <strong style={{ color: isMatched ? '#ffffff' : 'var(--text-muted)' }}>
                          {r['Sandi Cabang'] || r.Cabang || '-'}
                        </strong>
                      </td>
                    ) : (
                      <>
                        <td className="code-cell" style={{ color: '#93c5fd' }}>
                          {r.Sandi || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                        </td>
                        <td>
                          <strong style={{ color: isMatched ? '#ffffff' : 'var(--text-muted)' }}>
                            {r.Cabang || '-'}
                          </strong>
                        </td>
                      </>
                    )}
                    <td className="code-cell">
                      {r['Branch Code'] || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td className="code-cell">
                      {r['Kode Cabang'] || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td>{r['Nama Outlet'] || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                    <td>
                      {r['Status Outlet'] ? (
                        <span className="badge badge-match">{r['Status Outlet']}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.ALAMAT}>
                      {r.ALAMAT || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>

                    {/* Target Data Asli */}
                    <td className="code-cell" style={{ color: '#38bdf8' }}>{r['KODE POS']}</td>
                    <td>{r.Kelurahan}</td>
                    <td>{r.Kecamatan}</td>
                    <td>{r['Dati II']}</td>
                    <td className="code-cell">{r['Kode Dati II']}</td>
                    <td>{r.Provinsi}</td>
                    <td>{r['KOTA PTEN']}</td>
                    <td
                      className="code-cell"
                      style={{ color: isPtenDiff ? '#fb7185' : '#93c5fd' }}
                    >
                      {r['KODE POS PTEN']}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {r['SUMBER DATA']}
                      </span>
                    </td>
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
          Menampilkan {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, rows.length)} dari {rows.length} baris
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
