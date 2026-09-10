import React, { useState } from 'react';
import {
  BarChart3,
  Sparkles,
  MapPin,
  Layers,
  PieChart,
} from 'lucide-react';
import type { WilayahStat } from '../../types';

interface RegionalAnalyticsChartsProps {
  stats: WilayahStat[];
  totalDataCount: number;
}

export const RegionalAnalyticsCharts: React.FC<RegionalAnalyticsChartsProps> = ({
  stats,
  totalDataCount,
}) => {
  // Mode switch: 'all' (Grid 3 kartu) atau tab individual
  const [activeView, setActiveView] = useState<'grid' | 'volume' | 'match' | 'recommendation'>('grid');

  if (stats.length === 0) {
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
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(64, 81, 137, 0.08)',
            color: '#405189',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.75rem',
          }}
        >
          <BarChart3 size={24} />
        </div>
        <h4 style={{ fontSize: '0.94rem', fontWeight: 600, color: '#212529', margin: '0 0 0.3rem' }}>
          Grafik Analisis Wilayah Belum Tersedia
        </h4>
        <p style={{ fontSize: '0.8rem', color: '#878a99', maxWidth: '420px', margin: '0 auto' }}>
          Unggah data target operasional di menu <strong>Data Cek</strong> untuk memvisualisasikan volume data, perbandingan match vs tidak match, dan efektivitas rekomendasi per wilayah.
        </p>
      </div>
    );
  }

  // Max total volume for scale calculation
  const maxTotal = Math.max(...stats.map((s) => s.total), 1);
  const totalUnmatchedAll = stats.reduce((acc, s) => acc + s.unmatched, 0);
  const totalMatchedAll = stats.reduce((acc, s) => acc + s.matched, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.25rem' }}>
      {/* Top Header & View Filter Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#212529',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              margin: 0,
            }}
          >
            <BarChart3 size={18} color="#405189" />
            <span>Analisis Komparasi Data per Wilayah</span>
          </h3>
          <p style={{ fontSize: '0.76rem', color: '#878a99', margin: '0.15rem 0 0 0' }}>
            Memetakan {stats.length} Region Operasional dari total {totalDataCount.toLocaleString('id-ID')} baris data cek
          </p>
        </div>

        {/* View Switcher Buttons */}
        <div
          style={{
            display: 'inline-flex',
            background: '#f3f3f9',
            padding: '0.2rem',
            borderRadius: '6px',
            border: '1px solid #e9ebec',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveView('grid')}
            style={{
              padding: '0.3rem 0.65rem',
              fontSize: '0.74rem',
              fontWeight: activeView === 'grid' ? 600 : 500,
              color: activeView === 'grid' ? '#405189' : '#878a99',
              background: activeView === 'grid' ? '#ffffff' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: activeView === 'grid' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Semua Grafik (3-Grid)
          </button>

          <button
            type="button"
            onClick={() => setActiveView('volume')}
            style={{
              padding: '0.3rem 0.65rem',
              fontSize: '0.74rem',
              fontWeight: activeView === 'volume' ? 600 : 500,
              color: activeView === 'volume' ? '#405189' : '#878a99',
              background: activeView === 'volume' ? '#ffffff' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: activeView === 'volume' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            1. Volume Cek
          </button>

          <button
            type="button"
            onClick={() => setActiveView('match')}
            style={{
              padding: '0.3rem 0.65rem',
              fontSize: '0.74rem',
              fontWeight: activeView === 'match' ? 600 : 500,
              color: activeView === 'match' ? '#0ab39c' : '#878a99',
              background: activeView === 'match' ? '#ffffff' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: activeView === 'match' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            2. Match vs Unmatch
          </button>

          <button
            type="button"
            onClick={() => setActiveView('recommendation')}
            style={{
              padding: '0.3rem 0.65rem',
              fontSize: '0.74rem',
              fontWeight: activeView === 'recommendation' ? 600 : 500,
              color: activeView === 'recommendation' ? '#d97706' : '#878a99',
              background: activeView === 'recommendation' ? '#ffffff' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: activeView === 'recommendation' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            3. Potensi Rekomendasi
          </button>
        </div>
      </div>

      {/* 3 CHARTS CONTAINER */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            activeView === 'grid' ? 'repeat(auto-fit, minmax(340px, 1fr))' : '1fr',
          gap: '1.25rem',
        }}
      >
        {/* =========================================================================
            CHART 1: GRAFIK VOLUME DATA PER WILAYAH BERDASARKAN DATA CEK
            ========================================================================= */}
        {(activeView === 'grid' || activeView === 'volume') && (
          <div
            className="glass-card"
            style={{
              padding: '1.25rem',
              background: '#ffffff',
              border: '1px solid #e9ebec',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(56, 65, 74, 0.05)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                borderBottom: '1px solid #f3f3f9',
                paddingBottom: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    background: 'rgba(64, 81, 137, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#405189',
                  }}
                >
                  <Layers size={15} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                    1. Volume Data Cek per Wilayah
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: '#878a99' }}>
                    Total baris data yang diunggah per Region
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#405189',
                  background: '#f3f6f9',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '4px',
                }}
              >
                {totalDataCount.toLocaleString('id-ID')} Total
              </span>
            </div>

            {/* List of Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              {stats.map((item) => {
                const percentage = totalDataCount > 0 ? (item.total / totalDataCount) * 100 : 0;
                const barWidth = (item.total / maxTotal) * 100;

                return (
                  <div key={`vol-${item.wilayah}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.76rem',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: '#343a40',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <MapPin size={12} color="#405189" />
                        <span>{item.wilayah}</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontWeight: 700, color: '#405189' }}>
                          {item.total.toLocaleString('id-ID')} Baris
                        </span>
                        <span style={{ color: '#878a99', fontSize: '0.7rem' }}>
                          ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Track */}
                    <div
                      style={{
                        height: '7px',
                        background: '#f3f3f9',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                      title={`${item.wilayah}: ${item.total} baris (${percentage.toFixed(1)}% dari total)`}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${barWidth}%`,
                          background: 'linear-gradient(90deg, #405189 0%, #3577f1 100%)',
                          borderRadius: '4px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            CHART 2: GRAFIK DATA MATCH VS TIDAK MATCH PER WILAYAH
            ========================================================================= */}
        {(activeView === 'grid' || activeView === 'match') && (
          <div
            className="glass-card"
            style={{
              padding: '1.25rem',
              background: '#ffffff',
              border: '1px solid #e9ebec',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(56, 65, 74, 0.05)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                borderBottom: '1px solid #f3f3f9',
                paddingBottom: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    background: 'rgba(10, 179, 156, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0ab39c',
                  }}
                >
                  <PieChart size={15} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                    2. Match vs Tidak Match per Wilayah
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: '#878a99' }}>
                    Perbandingan kecocokan Sandi Master
                  </span>
                </div>
              </div>

              {/* Legend Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.68rem' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    color: '#0ab39c',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0ab39c' }} />
                  Match ({totalMatchedAll})
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    color: '#f06548',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f06548' }} />
                  Unmatched ({totalUnmatchedAll})
                </span>
              </div>
            </div>

            {/* List of Stacked Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              {stats.map((item) => {
                const matchPct = item.total > 0 ? (item.matched / item.total) * 100 : 0;
                const unmatchPct = item.total > 0 ? (item.unmatched / item.total) * 100 : 0;

                return (
                  <div key={`match-${item.wilayah}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.76rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#343a40' }}>{item.wilayah}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ color: '#0ab39c', fontWeight: 700 }}>
                          {item.matched} Match
                        </span>
                        <span style={{ color: '#ced4da' }}>|</span>
                        <span style={{ color: item.unmatched > 0 ? '#f06548' : '#878a99', fontWeight: 600 }}>
                          {item.unmatched} Belum
                        </span>
                      </div>
                    </div>

                    {/* Stacked Bar Track */}
                    <div
                      style={{
                        height: '7px',
                        background: '#f3f3f9',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                      title={`${item.wilayah}: ${item.matched} Match (${matchPct.toFixed(1)}%), ${item.unmatched} Unmatched (${unmatchPct.toFixed(1)}%)`}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${matchPct}%`,
                          background: '#0ab39c',
                          transition: 'width 0.4s ease',
                        }}
                      />
                      <div
                        style={{
                          height: '100%',
                          width: `${unmatchPct}%`,
                          background: '#f06548',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            CHART 3: GRAFIK REKOMENDASI & TINGKAT AKURASI PER WILAYAH
            ========================================================================= */}
        {(activeView === 'grid' || activeView === 'recommendation') && (
          <div
            className="glass-card"
            style={{
              padding: '1.25rem',
              background: '#ffffff',
              border: '1px solid #e9ebec',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(56, 65, 74, 0.05)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                borderBottom: '1px solid #f3f3f9',
                paddingBottom: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    background: 'rgba(247, 184, 75, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#d97706',
                  }}
                >
                  <Sparkles size={15} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                    3. Rekomendasi & Akurasi Wilayah
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: '#878a99' }}>
                    Tingkat keberhasilan & potensi penyelesaian
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#d97706',
                  background: 'rgba(247, 184, 75, 0.12)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '4px',
                }}
              >
                {totalUnmatchedAll} Potensi Rekomendasi
              </span>
            </div>

            {/* List of Recommendation & Accuracy Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              {stats.map((item) => {
                const matchRate = item.total > 0 ? (item.matched / item.total) * 100 : 0;
                const isHigh = matchRate >= 80;
                const isMedium = matchRate >= 50 && matchRate < 80;

                const statusBg = isHigh
                  ? 'rgba(10, 179, 156, 0.1)'
                  : isMedium
                  ? 'rgba(247, 184, 75, 0.12)'
                  : 'rgba(240, 101, 72, 0.1)';

                const statusColor = isHigh ? '#0ab39c' : isMedium ? '#d97706' : '#f06548';
                const statusText = isHigh ? 'Optimal' : isMedium ? 'Perlu Rekomendasi' : 'Prioritas';

                return (
                  <div
                    key={`rec-${item.wilayah}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      padding: '0.35rem 0.5rem',
                      borderRadius: '4px',
                      background: '#fafbfc',
                      border: '1px solid #f0f2f5',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.76rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#343a40' }}>{item.wilayah}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '3px',
                            background: statusBg,
                            color: statusColor,
                          }}
                        >
                          {statusText}
                        </span>
                        <span style={{ fontWeight: 700, color: '#212529' }}>
                          {matchRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar & Recommendation resolution note */}
                    <div
                      style={{
                        height: '6px',
                        background: '#e9ebec',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                      title={`${item.wilayah}: Akurasi ${matchRate.toFixed(1)}%. ${item.unmatched} data dapat diselesaikan via Rekomendasi.`}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${matchRate}%`,
                          background: isHigh ? '#0ab39c' : isMedium ? '#f7b84b' : '#f06548',
                          borderRadius: '3px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.7rem',
                        color: '#878a99',
                        marginTop: '0.1rem',
                      }}
                    >
                      <span>
                        {item.unmatched > 0
                          ? `Tersedia ${item.unmatched} rekomendasi cabang terdekat`
                          : 'Seluruh cabang telah 100% cocok'}
                      </span>
                      {item.unmatched > 0 && (
                        <span style={{ color: '#d97706', fontWeight: 600 }}>Siap Setuju</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
