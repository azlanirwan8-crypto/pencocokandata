import React from 'react';
import { Layers, CheckCircle2, AlertTriangle, FileWarning, Database, Award } from 'lucide-react';
import type { MatchingStats } from '../../types';

interface MetricCardsProps {
  stats: MatchingStats;
  masterCount?: number;
  multiCabangCount?: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  stats,
  masterCount = 0,
  multiCabangCount = 0,
}) => {
  // Compute Data Quality Health Score (0 - 100)
  const qualityScore = React.useMemo(() => {
    if (stats.totalProcessed === 0) return 0;
    const matchScore = stats.matchingRate * 0.6; // 60% weight
    const ptenScore = (100 - stats.ptenDiscrepancyRate) * 0.3; // 30% weight
    const masterBonus = masterCount > 0 ? (multiCabangCount === 0 ? 10 : Math.max(5, 10 - multiCabangCount * 0.1)) : 0; // 10% weight
    return Math.min(100, Math.round(matchScore + ptenScore + masterBonus));
  }, [stats, masterCount, multiCabangCount]);

  return (
    <div className="metrics-grid">
      {/* 1. TOTAL DATA DIPROSES */}
      <div className="metric-card blue">
        <div className="metric-header">
          <span className="metric-title">TOTAL DATA TARGET</span>
          <div className="metric-icon-bubble">
            <Layers size={16} />
          </div>
        </div>
        <div className="metric-value">
          {stats.totalProcessed.toLocaleString('id-ID')}
        </div>
        <div className="metric-footer">
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>N_in Terkunci</span> • Integritas baris 100%
        </div>
      </div>

      {/* 2. MATCHING RATE (SUKSES) */}
      <div className="metric-card emerald">
        <div className="metric-header">
          <span className="metric-title">MATCHING RATE</span>
          <div className="metric-icon-bubble">
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className="metric-value">
          {stats.matchingRate.toFixed(1)}%
        </div>
        <div className="metric-footer">
          <span style={{ color: '#34d399', fontWeight: 600 }}>{stats.matchedCount.toLocaleString('id-ID')}</span> cocok presisi via O(1)
        </div>
      </div>

      {/* 3. UNMATCHED RECORDS */}
      <div className="metric-card rose">
        <div className="metric-header">
          <span className="metric-title">UNMATCHED</span>
          <div className="metric-icon-bubble">
            <AlertTriangle size={16} />
          </div>
        </div>
        <div className="metric-value">
          {stats.totalProcessed > 0 ? (100 - stats.matchingRate).toFixed(1) : '0.0'}%
        </div>
        <div className="metric-footer">
          <span style={{ color: '#fb7185', fontWeight: 600 }}>{stats.unmatchedCount.toLocaleString('id-ID')}</span> perlu update referensi
        </div>
      </div>

      {/* 4. PTEN DISCREPANCY */}
      <div className="metric-card amber">
        <div className="metric-header">
          <span className="metric-title">SELISIH KODE POS PTEN</span>
          <div className="metric-icon-bubble">
            <FileWarning size={16} />
          </div>
        </div>
        <div className="metric-value">
          {stats.ptenDiscrepancyRate.toFixed(1)}%
        </div>
        <div className="metric-footer">
          <span style={{ color: '#fbbf24', fontWeight: 600 }}>{stats.ptenDiscrepancyCount.toLocaleString('id-ID')}</span> beda pos vs PTEN
        </div>
      </div>

      {/* 5. DATA MASTER AKTIF */}
      <div className="metric-card cyan">
        <div className="metric-header">
          <span className="metric-title">REFERENSI MASTER</span>
          <div className="metric-icon-bubble">
            <Database size={16} />
          </div>
        </div>
        <div className="metric-value">
          {masterCount.toLocaleString('id-ID')}
        </div>
        <div className="metric-footer">
          {multiCabangCount > 0 ? (
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{multiCabangCount} Multi-Cabang Alert</span>
          ) : (
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Indeks Terverifikasi</span>
          )}
        </div>
      </div>

      {/* 6. DATA QUALITY HEALTH SCORE */}
      <div className="metric-card purple">
        <div className="metric-header">
          <span className="metric-title">SKOR KUALITAS DATA</span>
          <div className="metric-icon-bubble">
            <Award size={16} />
          </div>
        </div>
        <div className="metric-value">
          {stats.totalProcessed > 0 ? qualityScore : '--'}
          {stats.totalProcessed > 0 && <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '2px' }}>/100</span>}
        </div>
        <div className="metric-footer">
          {qualityScore >= 85 ? (
            <span style={{ color: '#34d399', fontWeight: 600 }}>Kondisi Sangat Prima</span>
          ) : qualityScore >= 60 ? (
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>Kondisi Cukup Baik</span>
          ) : stats.totalProcessed > 0 ? (
            <span style={{ color: '#fb7185', fontWeight: 600 }}>Perlu Perhatian</span>
          ) : (
            <span>Menunggu Eksekusi Data</span>
          )}
        </div>
      </div>
    </div>
  );
};
