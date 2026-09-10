import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { UnmatchedArea } from '../../types';

interface RadarAnomalyTableProps {
  unmatchedAreas: UnmatchedArea[];
}

export const RadarAnomalyTable: React.FC<RadarAnomalyTableProps> = ({ unmatchedAreas }) => {
  return (
    <div className="glass-card">
      <div className="section-header">
        <div>
          <h2 className="section-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <ShieldAlert size={16} color="#fb7185" />
            <span>Radar Anomali (Top Unmatched Area)</span>
          </h2>
          <p className="section-subtitle" style={{ fontSize: '0.78rem' }}>
            Kecamatan & Kode Pos tanpa master untuk investigasi tim referensi.
          </p>
        </div>
      </div>

      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {unmatchedAreas.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Tidak ada area anomali. Seluruh data terhubung ke Data Master!
          </div>
        ) : (
          unmatchedAreas.slice(0, 7).map((item, idx) => (
            <div
              key={`${item.kodePos}-${idx}`}
              className="anomaly-table-row"
              style={{ padding: '0.45rem 0.65rem', borderRadius: '5px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#94a3b8',
                  }}
                >
                  {idx + 1}
                </span>
                <div>
                  <div className="anomaly-area-name" style={{ fontSize: '0.8rem', color: '#f1f5f9' }}>
                    {item.kecamatan || 'Kecamatan Tidak Teridentifikasi'}
                  </div>
                  <div className="anomaly-area-sub" style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    Pos: <span style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>{item.kodePos}</span> • {item.wilayah}
                  </div>
                </div>
              </div>
              <div
                className="anomaly-count-pill"
                style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
                title={`${item.count} baris transaksi tanpa data master`}
              >
                {item.count} Unmatched
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
