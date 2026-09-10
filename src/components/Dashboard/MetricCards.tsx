import React from 'react';
import { Layers, CheckCircle2, AlertTriangle, FileWarning } from 'lucide-react';
import type { MatchingStats } from '../../types';

interface MetricCardsProps {
  stats: MatchingStats;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ stats }) => {
  return (
    <div className="metrics-grid">
      {/* 1. TOTAL DATA DIPROSES */}
      <div className="metric-card blue">
        <div className="metric-header">
          <span className="metric-title">TOTAL DATA DIPROSES</span>
          <div className="metric-icon-bubble">
            <Layers size={20} />
          </div>
        </div>
        <div className="metric-value">
          {stats.totalProcessed.toLocaleString('id-ID')}
        </div>
        <div className="metric-footer">
          Akumulasi seluruh baris data operasional yang telah dievaluasi sistem.
        </div>
      </div>

      {/* 2. MATCHING RATE (SUKSES) */}
      <div className="metric-card emerald">
        <div className="metric-header">
          <span className="metric-title">MATCHING RATE (SUKSES)</span>
          <div className="metric-icon-bubble">
            <CheckCircle2 size={20} />
          </div>
        </div>
        <div className="metric-value">
          {stats.matchingRate.toFixed(1)}%
        </div>
        <div className="metric-footer">
          {stats.matchedCount.toLocaleString('id-ID')} baris berhasil dicocokkan ke master cabang secara presisi.
        </div>
      </div>

      {/* 3. UNMATCHED RECORDS */}
      <div className="metric-card rose">
        <div className="metric-header">
          <span className="metric-title">UNMATCHED RECORDS</span>
          <div className="metric-icon-bubble">
            <AlertTriangle size={20} />
          </div>
        </div>
        <div className="metric-value">
          {stats.totalProcessed > 0 ? (100 - stats.matchingRate).toFixed(1) : '0.0'}%
        </div>
        <div className="metric-footer">
          {stats.unmatchedCount.toLocaleString('id-ID')} baris tanpa pasangan master (butuh penambahan master).
        </div>
      </div>

      {/* 4. PTEN DISCREPANCY */}
      <div className="metric-card amber">
        <div className="metric-header">
          <span className="metric-title">PTEN DISCREPANCY</span>
          <div className="metric-icon-bubble">
            <FileWarning size={20} />
          </div>
        </div>
        <div className="metric-value">
          {stats.ptenDiscrepancyRate.toFixed(1)}%
        </div>
        <div className="metric-footer">
          {stats.ptenDiscrepancyCount.toLocaleString('id-ID')} baris di mana KODE POS asli tidak selaras dengan KODE POS PTEN.
        </div>
      </div>
    </div>
  );
};
