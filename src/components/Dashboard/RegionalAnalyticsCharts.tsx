import React from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import type { WilayahStat, MatchingStats } from '../../types';
import { MatchCompositionDonut } from './MatchCompositionDonut';
import { formatWilayahName } from '../../utils/normalizer';

interface RegionalAnalyticsChartsProps {
  stats: WilayahStat[];
  matchingStats: MatchingStats;
  totalDataCount?: number;
  selectedWilayah?: string;
}

export const RegionalAnalyticsCharts: React.FC<RegionalAnalyticsChartsProps> = ({
  stats,
  matchingStats,
  selectedWilayah = 'ALL',
}) => {
  // Filter ketat: jika difilter, hanya tampilkan wilayah yang dipilih
  const displayedStats = React.useMemo(() => {
    if (!selectedWilayah || selectedWilayah === 'ALL') {
      return [...stats].sort((a, b) => b.total - a.total);
    }
    return stats.filter((s) => String(s.wilayah).trim() === String(selectedWilayah).trim());
  }, [stats, selectedWilayah]);

  if (displayedStats.length === 0) {
    return (
      <div
        className="glass-card"
        style={{
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          background: '#ffffff',
          borderRadius: '6px',
          border: '1px solid #e9ebec',
          boxShadow: '0 1px 2px rgba(56, 65, 74, 0.05)',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(64, 81, 137, 0.08)',
            color: '#405189',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.65rem',
          }}
        >
          <BarChart3 size={22} />
        </div>
        <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#212529', margin: '0 0 0.25rem' }}>
          Grafik Analisis Wilayah Belum Tersedia
        </h4>
        <p style={{ fontSize: '0.78rem', color: '#878a99', maxWidth: '420px', margin: '0 auto' }}>
          Unggah data target operasional di menu <strong>Data Cek</strong> untuk memvisualisasikan volume data serta perbandingan status pencocokan per wilayah.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '0.85rem',
      }}
    >
      {/* 1. KOLOM KIRI: GRAFIK DONUT DEKOMPOSISI KUALITAS PENCOCOKAN */}
      <MatchCompositionDonut stats={matchingStats} />

      {/* 2. KOLOM KANAN: PERINGKAT & DISTRIBUSI KINERJA PER WILAYAH */}
      <div
        className="glass-card"
        style={{
          padding: '1.1rem 1.25rem',
          background: '#ffffff',
          border: '1px solid #e9ebec',
          borderRadius: '6px',
          boxShadow: '0 1px 2px rgba(56, 65, 74, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Header Card 2 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.85rem',
            borderBottom: '1px solid #f3f3f9',
            paddingBottom: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '5px',
                background: 'rgba(53, 119, 241, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3577f1',
              }}
            >
              <TrendingUp size={15} />
            </div>
            <div>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                Kinerja Pencocokan per Wilayah
              </h4>
              <span style={{ fontSize: '0.71rem', color: '#878a99' }}>
                Perbandingan volume input vs keberhasilan mapping master
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.12rem 0.5rem',
              borderRadius: '4px',
              background: 'rgba(53, 119, 241, 0.08)',
              color: '#3577f1',
              border: '1px solid rgba(53, 119, 241, 0.2)',
            }}
          >
            {displayedStats.length} Wilayah
          </span>
        </div>

        {/* List Bars per Region */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1, overflowY: 'auto', maxHeight: '330px', paddingRight: '0.2rem' }}>
          {displayedStats.map((item, idx) => {
            const matchedWidth = item.total > 0 ? (item.matched / item.total) * 100 : 0;
            const isHigh = item.rate >= 90;
            const isMedium = item.rate >= 75 && item.rate < 90;

            return (
              <div
                key={`reg-${item.wilayah}`}
                style={{
                  padding: '0.45rem 0.65rem',
                  background: '#fafbfc',
                  border: '1px solid #edf0f2',
                  borderRadius: '5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {/* Top Row: Region Name + Exact Stats + Success Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '3px',
                        background: '#f1f3f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.67rem',
                        fontWeight: 700,
                        color: '#6c757d',
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ fontWeight: 600, color: '#212529' }}>
                      {formatWilayahName(item.wilayah)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.71rem', color: '#6c757d' }}>
                      <strong style={{ color: '#0ab39c' }}>{item.matched}</strong> / {item.total} Data
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.08rem 0.38rem',
                        borderRadius: '3px',
                        background: isHigh
                          ? 'rgba(10, 179, 156, 0.12)'
                          : isMedium
                          ? 'rgba(247, 184, 75, 0.15)'
                          : 'rgba(240, 101, 72, 0.12)',
                        color: isHigh ? '#0ab39c' : isMedium ? '#d97706' : '#f06548',
                      }}
                    >
                      {item.rate.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar (Dual Color: Green matched + Red unmatched) */}
                <div
                  style={{
                    height: '6px',
                    background: '#e9ebec',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                  title={`${item.wilayah}: ${item.matched} Cocok, ${item.unmatched} Belum Cocok`}
                >
                  <div
                    style={{
                      width: `${matchedWidth}%`,
                      height: '100%',
                      background: '#0ab39c',
                      transition: 'width 0.4s ease',
                    }}
                  />
                  <div
                    style={{
                      width: `${100 - matchedWidth}%`,
                      height: '100%',
                      background: item.unmatched > 0 ? '#f06548' : '#0ab39c',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
