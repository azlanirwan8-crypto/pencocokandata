import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { UnmatchedArea } from '../../types';

interface RadarAnomalyTableProps {
  unmatchedAreas: UnmatchedArea[];
  totalUnmatchedCount?: number;
}

export const RadarAnomalyTable: React.FC<RadarAnomalyTableProps> = ({
  unmatchedAreas,
  totalUnmatchedCount = 0,
}) => {
  const topAreas = unmatchedAreas.slice(0, 8);

  return (
    <div
      className="glass-card"
      style={{
        padding: '1.1rem 1.25rem',
        background: '#ffffff',
        border: '1px solid #e9ebec',
        borderRadius: '6px',
        boxShadow: '0 1px 2px rgba(56, 65, 74, 0.05)',
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
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '5px',
              background: 'rgba(240, 101, 72, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f06548',
            }}
          >
            <ShieldAlert size={15} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#212529', margin: 0 }}>
              Radar Hotspot Anomali (Titik Terbanyak Belum Cocok)
            </h4>
            <span style={{ fontSize: '0.71rem', color: '#878a99' }}>
              Daftar kecamatan & kode pos target yang belum memiliki cabang master aktif
            </span>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '0.12rem 0.5rem',
            borderRadius: '4px',
            background: topAreas.length > 0 ? 'rgba(240, 101, 72, 0.1)' : 'rgba(10, 179, 156, 0.1)',
            color: topAreas.length > 0 ? '#f06548' : '#0ab39c',
            border: topAreas.length > 0 ? '1px solid rgba(240, 101, 72, 0.25)' : '1px solid rgba(10, 179, 156, 0.25)',
          }}
        >
          {topAreas.length > 0 ? `${topAreas.length} Titik Anomali` : 'Semua Bersih'}
        </span>
      </div>

      {/* Anomaly Grid / List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {topAreas.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#878a99', fontSize: '0.78rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(10, 179, 156, 0.1)',
                color: '#0ab39c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.5rem',
              }}
            >
              <ShieldAlert size={18} />
            </div>
            <span style={{ fontWeight: 600, color: '#212529' }}>Tidak ada area anomali</span>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.73rem' }}>
              Seluruh baris data target operasional telah berhasil dicocokkan ke Data Master.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '0.55rem',
            }}
          >
            {topAreas.map((item, idx) => {
              const contributionPct = totalUnmatchedCount > 0 ? (item.count / totalUnmatchedCount) * 100 : 0;
              const isHighImpact = idx < 2 || item.count >= 5;

              return (
                <div
                  key={`${item.kodePos}-${item.kecamatan}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '5px',
                    background: '#ffffff',
                    border: isHighImpact ? '1px solid rgba(240, 101, 72, 0.25)' : '1px solid #e9ebec',
                    boxShadow: '0 1px 2px rgba(56, 65, 74, 0.03)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                    <span
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '4px',
                        background: isHighImpact ? 'rgba(240, 101, 72, 0.12)' : '#f3f3f9',
                        color: isHighImpact ? '#f06548' : '#6c757d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#212529',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.kecamatan}
                      >
                        {item.kecamatan || 'Kecamatan Tidak Teridentifikasi'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#878a99', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>Pos:</span>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: '#405189',
                            fontWeight: 600,
                            background: '#f3f6f9',
                            padding: '0.04rem 0.25rem',
                            borderRadius: '3px',
                          }}
                        >
                          {item.kodePos || '-'}
                        </span>
                        <span>•</span>
                        <span style={{ color: '#6c757d' }}>{item.wilayah}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#f06548',
                        background: 'rgba(240, 101, 72, 0.08)',
                        padding: '0.12rem 0.45rem',
                        borderRadius: '3px',
                        border: '1px solid rgba(240, 101, 72, 0.2)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.count} Baris
                    </span>
                    {totalUnmatchedCount > 0 && (
                      <span style={{ fontSize: '0.66rem', color: '#878a99', marginTop: '0.15rem' }}>
                        {contributionPct.toFixed(0)}% anomali
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
