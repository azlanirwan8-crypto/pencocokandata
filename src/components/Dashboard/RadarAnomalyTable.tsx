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
          <h2 className="section-title" style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} color="#fb7185" />
            Radar Anomali / Top 10 Unmatched Area
          </h2>
          <p className="section-subtitle">
            Daftar Kecamatan & Kode Pos tanpa data master untuk tindak lanjut tim referensi.
          </p>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        {unmatchedAreas.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Tidak ada area anomali yang belum cocok. Semua data teridentifikasi di Data Master!
          </div>
        ) : (
          unmatchedAreas.slice(0, 10).map((item, idx) => (
            <div key={`${item.kodePos}-${idx}`} className="anomaly-table-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {idx + 1}
                </span>
                <div>
                  <div className="anomaly-area-name">
                    {item.kecamatan || 'Kecamatan Tidak Teridentifikasi'}
                  </div>
                  <div className="anomaly-area-sub">
                    Kode Pos: <span style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>{item.kodePos}</span> • {item.wilayah}
                  </div>
                </div>
              </div>
              <div className="anomaly-count-pill" title={`${item.count} baris transaksi tanpa data master`}>
                {item.count} Unmatched
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
