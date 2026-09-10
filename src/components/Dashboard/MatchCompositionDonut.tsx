import React, { useState } from 'react';
import { PieChart, CheckCircle2, Sparkles, Layers, AlertCircle, ShieldCheck } from 'lucide-react';
import type { MatchingStats } from '../../types';

interface MatchCompositionDonutProps {
  stats: MatchingStats;
}

export const MatchCompositionDonut: React.FC<MatchCompositionDonutProps> = ({ stats }) => {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const total = stats.totalProcessed || 0;
  const l1 = stats.level1Count || 0;
  const l2 = stats.level2Count || 0;
  const rec = stats.recommendationCount || 0;
  const unmatch = stats.unmatchedCount || 0;

  const ptenSame = stats.ptenSameCount || 0;
  const ptenDiff = stats.ptenDifferentCount || 0;
  const ptenOther = Math.max(0, total - ptenSame - ptenDiff);

  const segments = [
    { id: 'l1', label: 'Match L1 (Otomatis Sempurna)', count: l1, color: '#0ab39c', icon: CheckCircle2 },
    { id: 'l2', label: 'Match L2 (Tie-Breaker Pos/Kec)', count: l2, color: '#f7b84b', icon: Sparkles },
    { id: 'rec', label: 'Match Rekomendasi (Disetujui)', count: rec, color: '#3577f1', icon: Layers },
    { id: 'unmatch', label: 'Belum Cocok (Unmatched)', count: unmatch, color: '#f06548', icon: AlertCircle },
  ];

  // Calculate SVG stroke dashes for a donut chart
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let accumulatedAngle = 0;

  const donutSlices = segments.map((seg) => {
    const fraction = total > 0 ? seg.count / total : 0;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle * circumference;
    accumulatedAngle += fraction;
    return {
      ...seg,
      fraction,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const activeSeg = hoveredSegment ? segments.find((s) => s.id === hoveredSegment) : null;

  return (
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
      {/* Header */}
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
              background: 'rgba(64, 81, 137, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#405189',
            }}
          >
            <PieChart size={15} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#212529', margin: 0 }}>
              Dekomposisi Kualitas Pencocokan
            </h4>
            <span style={{ fontSize: '0.71rem', color: '#878a99' }}>
              Proporsi metode pencocokan data target terhadap master
            </span>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '0.12rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(10, 179, 156, 0.1)',
            color: '#0ab39c',
            border: '1px solid rgba(10, 179, 156, 0.25)',
          }}
        >
          {stats.matchingRate.toFixed(1)}% Terpetakan
        </span>
      </div>

      {total === 0 ? (
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#878a99', fontSize: '0.78rem' }}>
          Belum ada data target untuk divisualisasikan.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          {/* Top Half: Donut Chart + Central Stats + Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            {/* SVG Donut */}
            <div style={{ position: 'relative', width: '160px', height: '160px', flexShrink: 0 }}>
              <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="#f1f3f5"
                  strokeWidth="20"
                />
                {/* Slices */}
                {donutSlices.map((slice) => {
                  if (slice.count === 0) return null;
                  const isHovered = hoveredSegment === slice.id;
                  return (
                    <circle
                      key={slice.id}
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth={isHovered ? 23 : 20}
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      style={{
                        transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                        cursor: 'pointer',
                        opacity: hoveredSegment && !isHovered ? 0.6 : 1,
                      }}
                      onMouseEnter={() => setHoveredSegment(slice.id)}
                      onMouseLeave={() => setHoveredSegment(null)}
                    />
                  );
                })}
              </svg>

              {/* Center Stat inside Donut */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '0.66rem', color: '#878a99', fontWeight: 600, textTransform: 'uppercase' }}>
                  {activeSeg ? activeSeg.id.toUpperCase() : 'TOTAL'}
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: activeSeg ? activeSeg.color : '#212529', lineHeight: 1.1 }}>
                  {activeSeg ? activeSeg.count.toLocaleString('id-ID') : total.toLocaleString('id-ID')}
                </span>
                <span style={{ fontSize: '0.67rem', color: '#878a99', fontWeight: 500 }}>
                  {activeSeg
                    ? `${((activeSeg.count / total) * 100).toFixed(1)}%`
                    : 'Baris Data'}
                </span>
              </div>
            </div>

            {/* Interactive Legends */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1, minWidth: '200px' }}>
              {segments.map((seg) => {
                const pct = total > 0 ? (seg.count / total) * 100 : 0;
                const isHovered = hoveredSegment === seg.id;
                const Icon = seg.icon;

                return (
                  <div
                    key={seg.id}
                    onMouseEnter={() => setHoveredSegment(seg.id)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.35rem 0.55rem',
                      borderRadius: '4px',
                      background: isHovered ? '#f8f9fa' : 'transparent',
                      border: isHovered ? `1px solid ${seg.color}` : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Icon size={13} color={seg.color} />
                      <span style={{ fontSize: '0.74rem', color: isHovered ? '#212529' : '#495057', fontWeight: isHovered ? 600 : 500 }}>
                        {seg.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: seg.color, fontFamily: 'var(--font-mono)' }}>
                        {seg.count.toLocaleString('id-ID')}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#878a99' }}>
                        ({pct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Half: PTEN Compliance Verification Gauge */}
          <div
            style={{
              background: '#f8f9fb',
              border: '1px solid #edf0f2',
              borderRadius: '5px',
              padding: '0.6rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
              <span style={{ fontWeight: 600, color: '#495057', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <ShieldCheck size={13} color="#405189" />
                Integritas Kode Pos vs PTEN:
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.69rem' }}>
                <span style={{ color: '#0ab39c', fontWeight: 600 }}>
                  Same: {ptenSame} ({((ptenSame / total) * 100).toFixed(0)}%)
                </span>
                <span style={{ color: ptenDiff > 0 ? '#f06548' : '#878a99', fontWeight: 600 }}>
                  Diff: {ptenDiff} ({((ptenDiff / total) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>

            {/* Split Progress Track */}
            <div
              style={{
                height: '5px',
                background: '#e9ebec',
                borderRadius: '9999px',
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: `${(ptenSame / total) * 100}%`,
                  height: '100%',
                  background: '#0ab39c',
                  transition: 'width 0.5s ease',
                }}
                title={`PTEN Sesuai: ${ptenSame}`}
              />
              <div
                style={{
                  width: `${(ptenDiff / total) * 100}%`,
                  height: '100%',
                  background: '#f06548',
                  transition: 'width 0.5s ease',
                }}
                title={`PTEN Berbeda: ${ptenDiff}`}
              />
              <div
                style={{
                  width: `${(ptenOther / total) * 100}%`,
                  height: '100%',
                  background: '#ced4da',
                  transition: 'width 0.5s ease',
                }}
                title={`Belum Ditentukan: ${ptenOther}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
