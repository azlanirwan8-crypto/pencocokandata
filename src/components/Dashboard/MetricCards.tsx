import React from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Percent,
  FileSpreadsheet,
} from 'lucide-react';
import type { MatchingStats } from '../../types';

interface MetricCardsProps {
  stats: MatchingStats;
  masterCount?: number;
  multiCabangCount?: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  stats,
}) => {
  const matchRate = stats.totalProcessed > 0 ? (stats.matchedCount / stats.totalProcessed) * 100 : 0;
  const ptenDiffRate = stats.totalProcessed > 0 ? ((stats.ptenDifferentCount || 0) / stats.totalProcessed) * 100 : 0;

  const isRateHigh = matchRate >= 90;
  const isRateMedium = matchRate >= 70 && matchRate < 90;

  return (
    <div
      className="metrics-grid"
      style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.65rem',
      }}
    >
      {/* 1. TOTAL DATA TARGET */}
      <div className="metric-card blue">
        <div className="metric-header">
          <span className="metric-title">TOTAL DATA TARGET</span>
          <div className="metric-icon-bubble">
            <Layers size={14} />
          </div>
        </div>
        <div className="metric-value">
          {stats.totalProcessed.toLocaleString('id-ID')}
        </div>
        <div className="metric-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#405189', fontWeight: 600 }}>Volume Input</span>
          <span style={{ color: '#878a99', fontSize: '0.68rem' }}>100% Terindeks</span>
        </div>
      </div>

      {/* 2. OVERALL MATCH RATE (KPI UTAMA ANALIS) */}
      <div className="metric-card emerald">
        <div className="metric-header">
          <span className="metric-title">TINGKAT KEBERHASILAN (MATCH RATE)</span>
          <div className="metric-icon-bubble">
            <Percent size={14} />
          </div>
        </div>
        <div className="metric-value" style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span>{matchRate.toFixed(1)}%</span>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.08rem 0.4rem',
              borderRadius: '3px',
              background: isRateHigh
                ? 'rgba(10, 179, 156, 0.12)'
                : isRateMedium
                ? 'rgba(247, 184, 75, 0.15)'
                : 'rgba(240, 101, 72, 0.12)',
              color: isRateHigh ? '#0ab39c' : isRateMedium ? '#d97706' : '#f06548',
            }}
          >
            {isRateHigh ? 'Optimal' : isRateMedium ? 'Wajar' : 'Perlu Review'}
          </span>
        </div>
        <div className="metric-footer">
          <div
            style={{
              height: '4px',
              background: '#eff2f7',
              borderRadius: '2px',
              overflow: 'hidden',
              marginTop: '0.2rem',
            }}
          >
            <div
              style={{
                width: `${Math.min(matchRate, 100)}%`,
                height: '100%',
                background: isRateHigh ? '#0ab39c' : isRateMedium ? '#f7b84b' : '#f06548',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. DATA COCOK (MATCHED) & DEKOMPOSISI METODE */}
      <div className="metric-card emerald">
        <div className="metric-header">
          <span className="metric-title">DATA MATCH (TERHUBUNG)</span>
          <div className="metric-icon-bubble">
            <CheckCircle2 size={14} />
          </div>
        </div>
        <div className="metric-value" style={{ color: '#0ab39c' }}>
          {stats.matchedCount.toLocaleString('id-ID')}
        </div>
        <div className="metric-footer" style={{ fontSize: '0.67rem', color: '#6c757d' }}>
          <span>L1: {stats.level1Count || 0}</span>
          <span style={{ margin: '0 0.25rem' }}>•</span>
          <span>L2: {stats.level2Count || 0}</span>
          <span style={{ margin: '0 0.25rem' }}>•</span>
          <span>Rekom: {stats.recommendationCount || 0}</span>
        </div>
      </div>

      {/* 4. DATA BELUM COCOK (UNMATCHED - ACTION ITEM) */}
      <div className="metric-card rose">
        <div className="metric-header">
          <span className="metric-title">BELUM COCOK (ACTION ITEM)</span>
          <div className="metric-icon-bubble">
            <AlertTriangle size={14} />
          </div>
        </div>
        <div className="metric-value" style={{ color: stats.unmatchedCount > 0 ? '#f06548' : '#878a99' }}>
          {stats.unmatchedCount.toLocaleString('id-ID')}
        </div>
        <div className="metric-footer">
          {stats.unmatchedCount > 0 ? (
            <span style={{ color: '#f06548', fontWeight: 600 }}>
              {((stats.unmatchedCount / (stats.totalProcessed || 1)) * 100).toFixed(1)}% Menunggu Review
            </span>
          ) : (
            <span style={{ color: '#0ab39c', fontWeight: 600 }}>Semua Data Terpetakan</span>
          )}
        </div>
      </div>

      {/* 5. ANOMALI PTEN / DISCREPANCY RISK */}
      <div className="metric-card amber">
        <div className="metric-header">
          <span className="metric-title">CEK POS VS PTEN</span>
          <div className="metric-icon-bubble">
            <FileSpreadsheet size={14} />
          </div>
        </div>
        <div className="metric-value" style={{ color: (stats.ptenDifferentCount || 0) > 0 ? '#d97706' : '#212529' }}>
          {(stats.ptenDifferentCount || 0).toLocaleString('id-ID')}
          <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#878a99', marginLeft: '0.35rem' }}>
            ({ptenDiffRate.toFixed(1)}%)
          </span>
        </div>
        <div className="metric-footer" style={{ fontSize: '0.67rem' }}>
          <span style={{ color: '#0ab39c' }}>Sesuai: {stats.ptenSameCount || 0}</span>
          <span style={{ margin: '0 0.25rem' }}>•</span>
          <span style={{ color: (stats.ptenDifferentCount || 0) > 0 ? '#d97706' : '#878a99' }}>
            Beda: {stats.ptenDifferentCount || 0}
          </span>
        </div>
      </div>
    </div>
  );
};
