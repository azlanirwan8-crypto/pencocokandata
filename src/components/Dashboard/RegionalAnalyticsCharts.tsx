import React from 'react';
import {
  BarChart3,
  MapPin,
  Layers,
  PieChart,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { WilayahStat } from '../../types';

interface RegionalAnalyticsChartsProps {
  stats: WilayahStat[];
  totalDataCount: number;
  selectedWilayah?: string;
}

// Palet warna cerah & kontras untuk tiap bar wilayah di grafik volume
const VIBRANT_REGION_COLORS = [
  'linear-gradient(90deg, #3577f1 0%, #299cdb 100%)', // Blue to Cyan
  'linear-gradient(90deg, #0ab39c 0%, #10b981 100%)', // Teal to Emerald
  'linear-gradient(90deg, #f7b84b 0%, #f59e0b 100%)', // Amber to Gold
  'linear-gradient(90deg, #6559cc 0%, #8755f2 100%)', // Purple to Violet
  'linear-gradient(90deg, #f06548 0%, #ff795b 100%)', // Coral Red
  'linear-gradient(90deg, #02a8b5 0%, #00d2d3 100%)', // Turquoise
  'linear-gradient(90deg, #405189 0%, #5a6ea1 100%)', // Deep Navy
  'linear-gradient(90deg, #2b908f 0%, #48c79c 100%)', // Jade
];

const VIBRANT_BORDER_COLORS = [
  '#3577f1',
  '#0ab39c',
  '#f7b84b',
  '#6559cc',
  '#f06548',
  '#02a8b5',
  '#405189',
  '#2b908f',
];

export const RegionalAnalyticsCharts: React.FC<RegionalAnalyticsChartsProps> = ({
  stats,
  totalDataCount,
  selectedWilayah = 'ALL',
}) => {
  // Filter ketat: jika difilter, hanya tampilkan wilayah yang dipilih
  const displayedStats = React.useMemo(() => {
    if (!selectedWilayah || selectedWilayah === 'ALL') return stats;
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
          Unggah data target operasional di menu <strong>Data Cek</strong> untuk memvisualisasikan volume data yang tersimpan serta perbandingan data match vs tidak match per wilayah.
        </p>
      </div>
    );
  }

  // Max total volume for scale calculation
  const maxTotal = Math.max(...displayedStats.map((s) => s.total), 1);
  const totalUnmatchedAll = displayedStats.reduce((acc, s) => acc + s.unmatched, 0);
  const totalMatchedAll = displayedStats.reduce((acc, s) => acc + s.matched, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
      {/* Top Header: Title Only (Subtitle status/deskripsi dihapus sesuai permintaan) */}
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
              fontSize: '0.98rem',
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
        </div>
      </div>

      {/* 2 CHARTS CONTAINER: Langsung 2 Kolom Berdampingan */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* =========================================================================
            GRAFIK 1: VOLUME DATA CEK PER WILAYAH
            Menampilkan data yang di-upload dari excel jumlahnya yang tersimpan
            ========================================================================= */}
        <div
          className="glass-card"
          style={{
            padding: '1.35rem',
            background: '#ffffff',
            border: '1px solid #e9ebec',
            borderRadius: '6px',
            boxShadow: '0 1px 3px rgba(56, 65, 74, 0.05)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header Card 1 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.1rem',
              borderBottom: '1px solid #f3f3f9',
              paddingBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'rgba(53, 119, 241, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3577f1',
                }}
              >
                <Layers size={17} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                  Volume Data Cek per Wilayah
                </h4>
                <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
                  Jumlah baris data hasil upload Excel yang tersimpan per wilayah
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#3577f1',
                background: 'rgba(53, 119, 241, 0.08)',
                border: '1px solid rgba(53, 119, 241, 0.2)',
                padding: '0.25rem 0.65rem',
                borderRadius: '4px',
              }}
            >
              {totalDataCount.toLocaleString('id-ID')} Baris Tersimpan
            </span>
          </div>

          {/* List of Bars with Vibrant Distinct Colors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem', flex: 1 }}>
            {displayedStats.map((item, idx) => {
              const percentage = totalDataCount > 0 ? (item.total / totalDataCount) * 100 : 0;
              const barWidth = Math.max((item.total / maxTotal) * 100, 2);
              const barGradient = VIBRANT_REGION_COLORS[idx % VIBRANT_REGION_COLORS.length];
              const dotColor = VIBRANT_BORDER_COLORS[idx % VIBRANT_BORDER_COLORS.length];

              return (
                <div
                  key={`vol-${item.wilayah}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    padding: '0.45rem 0.65rem',
                    background: '#fcfdfe',
                    border: '1px solid #f1f3f5',
                    borderRadius: '6px',
                  }}
                >
                  {/* Wilayah Label & Exact Row Count */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: '#343a40',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <span
                        style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          background: dotColor,
                          display: 'inline-block',
                        }}
                      />
                      <MapPin size={13} color={dotColor} />
                      <span>{item.wilayah}</span>
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: '#212529', fontSize: '0.82rem' }}>
                        {item.total.toLocaleString('id-ID')} Baris
                      </span>
                      <span
                        style={{
                          color: '#495057',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: '#eaedf1',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '3px',
                        }}
                      >
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* High-Visibility Progress Bar */}
                  <div
                    style={{
                      height: '11px',
                      background: '#e9ecef',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      position: 'relative',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
                    }}
                    title={`${item.wilayah}: ${item.total} baris data tersimpan (${percentage.toFixed(1)}%)`}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${barWidth}%`,
                        background: barGradient,
                        borderRadius: '6px',
                        transition: 'width 0.5s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            GRAFIK 2: MATCH VS TIDAK MATCH PER WILAYAH
            Menampilkan berapa yang Match dan berapa yang Tidak (MATCH REKOMENDASI)
            ========================================================================= */}
        <div
          className="glass-card"
          style={{
            padding: '1.35rem',
            background: '#ffffff',
            border: '1px solid #e9ebec',
            borderRadius: '6px',
            boxShadow: '0 1px 3px rgba(56, 65, 74, 0.05)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header Card 2 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.1rem',
              borderBottom: '1px solid #f3f3f9',
              paddingBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'rgba(10, 179, 156, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0ab39c',
                }}
              >
                <PieChart size={17} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                  Match vs Tidak Match per Wilayah
                </h4>
                <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
                  Perbandingan data Match vs Tidak Match (MATCH REKOMENDASI)
                </span>
              </div>
            </div>

            {/* Legend Badges Berwarna Nyata */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  color: '#0ab39c',
                  fontWeight: 700,
                  background: 'rgba(10, 179, 156, 0.1)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(10, 179, 156, 0.2)',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0ab39c' }} />
                Match ({totalMatchedAll})
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  color: '#e65100',
                  fontWeight: 700,
                  background: 'rgba(247, 184, 75, 0.18)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(247, 184, 75, 0.4)',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f7b84b' }} />
                Tidak Match ({totalUnmatchedAll})
              </span>
            </div>
          </div>

          {/* List of Stacked High-Contrast Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem', flex: 1 }}>
            {displayedStats.map((item) => {
              const matchPct = item.total > 0 ? (item.matched / item.total) * 100 : 0;
              const unmatchPct = item.total > 0 ? (item.unmatched / item.total) * 100 : 0;

              return (
                <div
                  key={`match-${item.wilayah}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    padding: '0.45rem 0.65rem',
                    background: '#fcfdfe',
                    border: '1px solid #f1f3f5',
                    borderRadius: '6px',
                  }}
                >
                  {/* Top Row: Region Name & Numbers */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#343a40' }}>{item.wilayah}</span>

                    {/* Explicit Numbers & Labels */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {/* Match counter */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          color: '#0ab39c',
                          fontWeight: 700,
                        }}
                        title="Data sudah cocok sempurna dengan master"
                      >
                        <CheckCircle2 size={13} color="#0ab39c" />
                        <span>{item.matched} Match</span>
                        <span style={{ fontSize: '0.7rem', color: '#6c757d', fontWeight: 500 }}>
                          ({matchPct.toFixed(0)}%)
                        </span>
                      </span>

                      <span style={{ color: '#ced4da' }}>•</span>

                      {/* Unmatched / Recommendation counter */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          color: item.unmatched > 0 ? '#d97706' : '#878a99',
                          fontWeight: 700,
                        }}
                        title="Data belum cocok yang dialokasikan ke MATCH (REKOMENDASI)"
                      >
                        <AlertCircle size={13} color={item.unmatched > 0 ? '#d97706' : '#878a99'} />
                        <span>{item.unmatched} Belum</span>
                        <span style={{ fontSize: '0.7rem', color: '#6c757d', fontWeight: 500 }}>
                          ({unmatchPct.toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Dual-Color High-Contrast Bar Track */}
                  <div
                    style={{
                      height: '11px',
                      background: '#e9ecef',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      display: 'flex',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
                    }}
                    title={`${item.wilayah}: ${item.matched} Match (${matchPct.toFixed(1)}%), ${item.unmatched} Tidak Match / Butuh Rekomendasi (${unmatchPct.toFixed(1)}%)`}
                  >
                    {/* Hijau Emerald untuk MATCH */}
                    <div
                      style={{
                        height: '100%',
                        width: `${matchPct}%`,
                        background: 'linear-gradient(90deg, #0ab39c 0%, #10b981 100%)',
                        transition: 'width 0.5s ease',
                        boxShadow: matchPct > 0 ? '0 1px 2px rgba(10,179,156,0.3)' : 'none',
                      }}
                    />
                    {/* Oranye Amber untuk TIDAK MATCH (MATCH REKOMENDASI) */}
                    <div
                      style={{
                        height: '100%',
                        width: `${unmatchPct}%`,
                        background: 'linear-gradient(90deg, #f7b84b 0%, #f59e0b 100%)',
                        transition: 'width 0.5s ease',
                        boxShadow: unmatchPct > 0 ? '0 1px 2px rgba(247,184,75,0.3)' : 'none',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
