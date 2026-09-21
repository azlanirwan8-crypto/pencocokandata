import React from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
} from 'lucide-react';
import type { MatchingStats } from '../../types';
import { AnimatedMetricValue } from './AnimatedMetricValue';

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

// `fmt` dipertahankan untuk angka yang bukan inti animasi (teks kecil/persen).
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
        <div className="metric-value"><AnimatedMetricValue value={stats.totalProcessed} /></div>
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
        <div className="metric-value"><AnimatedMetricValue value={fm.distinctKodePos} /></div>
        <div className="metric-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#0ab39c', fontWeight: 600 }}>Kode pos di Data Final</span>
          <span style={{ color: '#878a99', fontSize: '0.68rem' }}>{fmt(fm.finalCount)} baris</span>
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
        <div className="metric-value"><AnimatedMetricValue value={fm.belumDikerjakan} /></div>
        <div className="metric-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#d68b0c', fontWeight: 600 }}>
            {fm.totalKodePos > 0 ? `${((fm.belumDikerjakan / fm.totalKodePos) * 100).toFixed(1)}% Sisa` : 'Menunggu Master'}
          </span>
          <span style={{ color: '#878a99', fontSize: '0.68rem' }}>dari {fmt(fm.totalKodePos)} kode pos</span>
        </div>
      </div>

      {/* 4. TOTAL ANOMALI (definisi tunggal, sama dgn panel Peta) */}
      <div className="metric-card rose">
        <div className="metric-header">
          <span className="metric-title">TOTAL ANOMALI</span>
          <div className="metric-icon-bubble">
            <AlertTriangle size={14} />
          </div>
        </div>
        <div className="metric-value" style={{ color: fm.anomali > 0 ? '#f06548' : '#0ab39c' }}><AnimatedMetricValue value={fm.anomali} /></div>
        <div className="metric-footer">
          {fm.anomali > 0 ? (
            <span style={{ color: '#f06548', fontWeight: 600 }}>Beda pulau / status / penempatan / role</span>
          ) : (
            <span style={{ color: '#0ab39c', fontWeight: 600 }}>Semua aturan penempatan bersih</span>
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
          <span><AnimatedMetricValue value={fm.top.count} /></span>
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
