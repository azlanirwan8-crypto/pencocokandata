import React from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
} from 'lucide-react';
import type { MatchingStats } from '../../types';

interface FinalMetrics {
  finalCount: number;
  distinctKodePos: number;
  totalKodePos: number;
  belumDikerjakan: number;
  anomali: number;
  top: { kodePos: string; count: number; kota: string };
}

interface MetricCardsProps {
  stats: MatchingStats;
  finalMetrics: FinalMetrics;
  masterCount?: number;
  multiCabangCount?: number;
}

const fmt = (n: number) => n.toLocaleString('id-ID');

export const MetricCards: React.FC<MetricCardsProps> = ({ stats, finalMetrics }) => {
  const fm = finalMetrics;

  return (
    <div
      className="metrics-grid"
      style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
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
        <div className="metric-value">{fmt(stats.totalProcessed)}</div>
        <div className="metric-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#405189', fontWeight: 600 }}>Volume Input</span>
          <span style={{ color: '#878a99', fontSize: '0.68rem' }}>100% Terindeks</span>
        </div>
      </div>

      {/* 2. TOTAL KODE POS YANG SUDAH DISESUAIKAN (Data Final) */}
      <div className="metric-card emerald">
        <div className="metric-header">
          <span className="metric-title">KODE POS DISESUAIKAN</span>
          <div className="metric-icon-bubble">
            <CheckCircle2 size={14} />
          </div>
        </div>
        <div className="metric-value">{fmt(fm.finalCount)}</div>
        <div className="metric-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#0ab39c', fontWeight: 600 }}>Ada di Data Final</span>
          <span style={{ color: '#878a99', fontSize: '0.68rem' }}>{fmt(fm.distinctKodePos)} kode pos unik</span>
        </div>
      </div>

      {/* 3. TOTAL KODE POS YANG BELUM DIKERJAKAN (Master Kode Pos vs Data Final) */}
      <div className="metric-card amber">
        <div className="metric-header">
          <span className="metric-title">KODE POS BELUM DIKERJAKAN</span>
          <div className="metric-icon-bubble">
            <Clock size={14} />
          </div>
        </div>
        <div className="metric-value">{fmt(fm.belumDikerjakan)}</div>
        <div className="metric-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#d68b0c', fontWeight: 600 }}>
            {fm.totalKodePos > 0 ? `${((fm.belumDikerjakan / fm.totalKodePos) * 100).toFixed(1)}% Sisa` : 'Menunggu Master'}
          </span>
          <span style={{ color: '#878a99', fontSize: '0.68rem' }}>dari {fmt(fm.totalKodePos)} Master Kode Pos</span>
        </div>
      </div>

      {/* 4. TOTAL ANOMALI (penempatan beda pulau, kecuali Aceh) */}
      <div className="metric-card rose">
        <div className="metric-header">
          <span className="metric-title">TOTAL ANOMALI</span>
          <div className="metric-icon-bubble">
            <AlertTriangle size={14} />
          </div>
        </div>
        <div className="metric-value" style={{ color: fm.anomali > 0 ? '#f06548' : '#0ab39c' }}>{fmt(fm.anomali)}</div>
        <div className="metric-footer">
          {fm.anomali > 0 ? (
            <span style={{ color: '#f06548', fontWeight: 600 }}>Penempatan beda pulau (di luar Aceh)</span>
          ) : (
            <span style={{ color: '#0ab39c', fontWeight: 600 }}>Tidak ada pelanggaran pulau</span>
          )}
        </div>
      </div>

      {/* 5. KODE POS DENGAN CABANG TERBANYAK */}
      <div className="metric-card purple">
        <div className="metric-header">
          <span className="metric-title">CABANG TERBANYAK / KODE POS</span>
          <div className="metric-icon-bubble">
            <MapPin size={14} />
          </div>
        </div>
        <div className="metric-value" style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
          <span>{fmt(fm.top.count)}</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6559cc' }}>cabang</span>
        </div>
        <div className="metric-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#6559cc', fontWeight: 600 }}>Kode Pos {fm.top.kodePos}</span>
          <span style={{ color: '#878a99', fontSize: '0.68rem' }}>{fm.top.kota}</span>
        </div>
      </div>
    </div>
  );
};
