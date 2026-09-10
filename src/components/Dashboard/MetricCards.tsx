import React from 'react';
import { Layers, CheckCircle2, AlertTriangle, Database } from 'lucide-react';
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
  return (
    <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {/* 1. TOTAL DATA TARGET */}
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
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>Data Operasional</span> • Integritas Baris 100%
        </div>
      </div>

      {/* 2. DATA BERHASIL COCOK (MATCHED) */}
      <div className="metric-card emerald">
        <div className="metric-header">
          <span className="metric-title">DATA COCOK (MATCHED)</span>
          <div className="metric-icon-bubble">
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className="metric-value">
          {stats.matchedCount.toLocaleString('id-ID')}
        </div>
        <div className="metric-footer">
          <span style={{ color: '#34d399', fontWeight: 600 }}>Terverifikasi</span> • Cocok dengan Sandi Master
        </div>
      </div>

      {/* 3. DATA BELUM COCOK (UNMATCHED) */}
      <div className="metric-card rose">
        <div className="metric-header">
          <span className="metric-title">DATA BELUM COCOK</span>
          <div className="metric-icon-bubble">
            <AlertTriangle size={16} />
          </div>
        </div>
        <div className="metric-value">
          {stats.unmatchedCount.toLocaleString('id-ID')}
        </div>
        <div className="metric-footer">
          <span style={{ color: '#fb7185', fontWeight: 600 }}>Perlu Tindakan</span> • Tersedia di Tab Rekomendasi
        </div>
      </div>

      {/* 4. DATABASE MASTER CABANG */}
      <div className="metric-card cyan">
        <div className="metric-header">
          <span className="metric-title">REFERENSI MASTER CABANG</span>
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
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Database Aktif & Siap Digunakan</span>
          )}
        </div>
      </div>
    </div>
  );
};
