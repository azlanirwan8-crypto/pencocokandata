import React from 'react';
import { MapPin } from 'lucide-react';
import type { WilayahStat } from '../../types';

interface WilayahChartProps {
  stats: WilayahStat[];
}

export const WilayahChart: React.FC<WilayahChartProps> = ({ stats }) => {
  return (
    <div className="glass-card">
      <div className="section-header">
        <div>
          <h2 className="section-title" style={{ fontSize: '1.15rem' }}>
            Widget Distribusi Wilayah
          </h2>
          <p className="section-subtitle">
            Jumlah data operasional per Wilayah/Region beserta persentase kecocokan master.
          </p>
        </div>
      </div>

      {stats.length === 0 ? (
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Belum ada data target yang dimuat. Unggah berkas target di Menu 3 untuk melihat grafik wilayah.
        </div>
      ) : (
        <div className="chart-bars-list">
          {stats.map((item) => {
            const matchedWidth = (item.matched / item.total) * 100;
            const unmatchedWidth = (item.unmatched / item.total) * 100;

            return (
              <div key={item.wilayah} className="chart-bar-item">
                <div className="chart-bar-label-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={14} color="var(--accent-blue)" />
                    <span className="chart-bar-name">{item.wilayah}</span>
                  </div>
                  <div className="chart-bar-stats">
                    <span style={{ color: '#34d399' }}>{item.matched} Match ({item.rate.toFixed(1)}%)</span>
                    {item.unmatched > 0 && (
                      <span style={{ color: '#fb7185' }}>{item.unmatched} Unmatch</span>
                    )}
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      Total: {item.total}
                    </span>
                  </div>
                </div>

                <div className="chart-bar-track" title={`${item.wilayah}: ${item.matched}/${item.total} (${item.rate.toFixed(1)}%)`}>
                  <div
                    className="chart-bar-fill-matched"
                    style={{ width: `${matchedWidth}%` }}
                  />
                  <div
                    className="chart-bar-fill-unmatched"
                    style={{ width: `${unmatchedWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
