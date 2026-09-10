import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import type { MasterHealth, MasterRow } from '../../types';

interface MasterHealthCardProps {
  health: MasterHealth;
}

export const MasterHealthCard: React.FC<MasterHealthCardProps> = ({ health }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (health.totalRows === 0) return null;

  // Flatten all multi-outlet master rows
  const allDuplicateRows: { kodePos: string; row: MasterRow; indexInKp: number }[] = [];
  health.multiOutletItems.forEach((item) => {
    (item.matchingMasterRows || []).forEach((r, idx) => {
      allDuplicateRows.push({
        kodePos: item.kodePos,
        row: r,
        indexInKp: idx + 1,
      });
    });
  });

  return (
    <div style={{ marginTop: '1.25rem' }}>
      {health.multiOutletCount > 0 ? (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem',
          }}
        >
          {/* Header Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fbbf24',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={20} />
              </div>
              <div>
                <strong style={{ color: '#fbbf24', fontSize: '0.95rem' }}>
                  Indikator Kesehatan Master: Terdeteksi {health.multiOutletCount} Kode Pos Multi-Cabang ({allDuplicateRows.length} Baris Terlibat)
                </strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Berikut rincian seluruh kolom data cabang yang menggunakan kode pos yang sama untuk mempermudah pengecekan lokasi dan resolusi Level 2 Tie-Breaker.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{ fontSize: '0.78rem', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.3)' }}
            >
              <span>{isExpanded ? 'Sembunyikan Tabel Rincian' : 'Tampilkan Full Kolom'}</span>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Full Columns Table */}
          {isExpanded && (
            <div style={{ marginTop: '1.25rem' }}>
              <div className="table-container" style={{ maxHeight: '360px', background: 'rgba(10, 15, 29, 0.85)' }}>
                <table className="modern-table">
                  <thead>
                    <tr style={{ background: '#131d33' }}>
                      <th style={{ color: '#fbbf24', background: '#17233d' }}>KODE POS</th>
                      <th>Wilayah</th>
                      <th>Sandi Cabang</th>
                      <th>Nama Outlet</th>
                      <th>Branch Code</th>
                      <th>Kode Cabang</th>
                      <th>ALAMAT</th>
                      <th>Kelurahan</th>
                      <th>Kecamatan</th>
                      <th>Dati II</th>
                      <th>Provinsi</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDuplicateRows.map(({ kodePos, row, indexInKp }, idx) => (
                      <tr
                        key={`${kodePos}-${idx}`}
                        style={{
                          background: idx % 2 === 0 ? 'rgba(245, 158, 11, 0.03)' : 'transparent',
                        }}
                      >
                        <td
                          className="code-cell"
                          style={{
                            fontWeight: 800,
                            color: '#fbbf24',
                            background: 'rgba(245, 158, 11, 0.08)',
                            borderRight: '1px solid rgba(245, 158, 11, 0.2)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                        <td style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.ALAMAT}>
                          {row.ALAMAT || '-'}
                        </td>
                        <td>{row.Kelurahan || '-'}</td>
                        <td>{row.Kecamatan || '-'}</td>
                        <td>{row['Dati II'] || '-'}</td>
                        <td>{row.Provinsi || '-'}</td>
                        <td>
                          <span className="badge badge-match">{row['Status Outlet'] || 'Aktif'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
          }}
        >
          <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#34d399', fontSize: '0.88rem' }}>
              Indikator Kesehatan Master Optimal (100% Unique Mapping)
            </strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
              Seluruh {health.uniqueKodePos} kode pos terpetakan 1-to-1 secara presisi tanpa ada duplikasi kode pos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
