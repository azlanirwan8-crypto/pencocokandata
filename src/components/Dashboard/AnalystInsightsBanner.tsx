import React from 'react';
import { Lightbulb, ArrowRight } from 'lucide-react';
import type { MatchingStats, WilayahStat } from '../../types';

interface AnalystInsightsBannerProps {
  stats: MatchingStats;
  regionalStats: WilayahStat[];
  onNavigateToWorking: () => void;
}

export const AnalystInsightsBanner: React.FC<AnalystInsightsBannerProps> = ({
  stats,
  regionalStats,
  onNavigateToWorking,
}) => {
  if (stats.totalProcessed === 0) return null;

  // Find top performer and lowest performer
  const sortedRegions = [...regionalStats].filter((r) => r.total > 0).sort((a, b) => b.rate - a.rate);
  const bestRegion = sortedRegions.length > 0 ? sortedRegions[0] : null;
  const lowestRegion = sortedRegions.length > 1 ? sortedRegions[sortedRegions.length - 1] : null;

  const hasUnmatched = stats.unmatchedCount > 0;
  const matchRate = stats.matchingRate;

  return (
    <div
      className="glass-card"
      style={{
        background: 'linear-gradient(135deg, #f8faff 0%, #f4f8fd 100%)',
        border: '1px solid rgba(64, 81, 137, 0.18)',
        borderRadius: '6px',
        padding: '0.85rem 1.15rem',
        boxShadow: '0 1px 2px rgba(56, 65, 74, 0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Left Side: Analyst Icon & Headline */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flex: 1, minWidth: '300px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #405189, #3577f1)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(64, 81, 137, 0.25)',
            }}
          >
            <Lightbulb size={16} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#212529' }}>
                Analyst Takeaway & Rekomendasi Operasional:
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '0.08rem 0.4rem',
                  borderRadius: '3px',
                  background: matchRate >= 90 ? 'rgba(10, 179, 156, 0.12)' : 'rgba(247, 184, 75, 0.15)',
                  color: matchRate >= 90 ? '#0ab39c' : '#d97706',
                }}
              >
                {matchRate >= 90 ? 'Kinerja Sangat Baik' : 'Butuh Intervensi'}
              </span>
            </div>

            <div style={{ fontSize: '0.74rem', color: '#495057', lineHeight: 1.4 }}>
              {bestRegion && (
                <span>
                  Wilayah <strong>{bestRegion.wilayah}</strong> mencatat tingkat kecocokan tertinggi (
                  <span style={{ color: '#0ab39c', fontWeight: 600 }}>{bestRegion.rate.toFixed(1)}%</span> dari{' '}
                  {bestRegion.total} data).
                </span>
              )}
              {lowestRegion && lowestRegion.wilayah !== bestRegion?.wilayah && (
                <span>
                  {' '}Fokus perhatian pada <strong>{lowestRegion.wilayah}</strong> (
                  <span style={{ color: '#f06548', fontWeight: 600 }}>{lowestRegion.rate.toFixed(1)}%</span> cocok,{' '}
                  {lowestRegion.unmatched} belum terhubung).
                </span>
              )}
              {stats.ptenDifferentCount && stats.ptenDifferentCount > 0 ? (
                <span>
                  {' '}Ditemukan <strong>{stats.ptenDifferentCount} baris</strong> perbedaan kode pos vs PTEN yang disarankan diverifikasi ulang.
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action Button */}
        {hasUnmatched && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onNavigateToWorking}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.34rem 0.85rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span>Tinjau {stats.unmatchedCount.toLocaleString('id-ID')} Data Belum Cocok</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
};
