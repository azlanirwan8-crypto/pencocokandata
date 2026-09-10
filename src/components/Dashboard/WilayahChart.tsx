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
          <h2 className="section-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <MapPin size={16} color="var(--accent-blue)" />
            <span>Distribusi Kinerja per Wilayah</span>
          </h2>
          <p className="section-subtitle" style={{ fontSize: '0.78rem' }}>
            Volume data operasional per Region dan tingkat kecocokan master.
          </p>
        </div>
      </div>

      {stats.length === 0 ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Belum ada data target yang dimuat untuk dianalisis per wilayah.
        </div>
      ) : (
        <div className="chart-bars-list" style={{ marginTop: '0.75rem', gap: '0.65rem' }}>
          {stats.map((item) => {
            const matchedWidth = item.total > 0 ? (item.matched / item.total) * 100 : 0;
            const unmatchedWidth = item.total > 0 ? (item.unmatched / item.total) * 100 : 0;

            return (
              <div key={item.wilayah} className="chart-bar-item">
                <div className="chart-bar-label-row" style={{ fontSize: '0.76rem' }}>
                  <span className="chart-bar-name" style={{ color: '#f8fafc', fontWeight: 600 }}>
                    {item.wilayah}
                  </span>
                  <div className="chart-bar-stats" style={{ display: 'flex', gap: '0.6rem', fontSize: '0.74rem' }}>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>
                      {item.matched} Match ({item.rate.toFixed(1)}%)
                    </span>
                    {item.unmatched > 0 && (
                      <span style={{ color: '#fb7185' }}>{item.unmatched} Unmatch</span>
                    )}
                    <span style={{ color: '#94a3b8' }}>
                      Tot: {item.total}
                    </span>
                  </div>
                </div>

                <div className="chart-bar-track" style={{ height: '6px', borderRadius: '3px' }} title={`${item.wilayah}: ${item.matched}/${item.total} (${item.rate.toFixed(1)}%)`}>
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
