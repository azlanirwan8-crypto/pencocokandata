import React, { useState } from 'react';
import { PieChart, ShieldCheck, Globe2, MapPin, Building2, Move, Users } from 'lucide-react';

export interface KomposisiDashboard {
  /** Total baris Data Final yang sedang dilihat (sudah kena filter wilayah). */
  total: number;
  /** Baris yang lolos semua cek anomali. */
  bersih: number;
  /** Jumlah per kategori, dihitung dari kategori utama tiap baris — jadi irisan = total. */
  perKategori: Record<string, number>;
}

interface MatchCompositionDonutProps {
  komposisi: KomposisiDashboard;
}

const SEGEMEN: { id: string; label: string; color: string; icon: React.ElementType; ket: string }[] = [
  { id: 'PULAU', label: 'Keluar Pulau', color: '#f06548', icon: Globe2, ket: 'Cabangmaster dan kode pos berada di pulau berbeda' },
  { id: 'PROVINSI', label: 'Beda Provinsi', color: '#e8833a', icon: MapPin, ket: 'Provinsi cabang master berbeda dari provinsi kode pos' },
  { id: 'STATUS', label: 'Status Outlet', color: '#f7b84b', icon: Building2, ket: 'Status outlet tidak sesuai aturan penempatan' },
  { id: 'PENEMPATAN', label: 'Penempatan', color: '#3577f1', icon: Move, ket: 'Kota/kabupaten tidak cocok dengan wilayah penugasannya' },
  { id: 'ROLE', label: 'Role Mapping', color: '#6559cc', icon: Users, ket: 'Role mapping cabang belum lengkap atau bertentangan' },
];

export const MatchCompositionDonut: React.FC<MatchCompositionDonutProps> = ({ komposisi }) => {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const total = komposisi.total || 0;
  const bersih = komposisi.bersih || 0;
  const anomali = Math.max(0, total - bersih);

  const segments = [
    { id: 'BERSIH', label: 'Bersih (Siap Cetak)', count: bersih, color: '#0ab39c', icon: ShieldCheck, ket: 'Lolos semua cek anomali' },
    ...SEGEMEN.map((s) => ({ ...s, count: komposisi.perKategori[s.id] || 0 })),
  ];

  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let accumulatedAngle = 0;

  const donutSlices = segments.map((seg) => {
    const fraction = total > 0 ? seg.count / total : 0;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle * circumference;
    accumulatedAngle += fraction;
    return { ...seg, fraction, strokeDasharray, strokeDashoffset };
  });

  const activeSeg = hoveredSegment ? segments.find((s) => s.id === hoveredSegment) : null;
  const pctBersih = total > 0 ? (bersih / total) * 100 : 0;

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
              Komposisi Kualitas Data Final
            </h4>
            <span style={{ fontSize: '0.71rem', color: '#878a99' }}>
              Baris bersih vs temuan anomali (satu baris dihitung pada kategori teratasnya)
            </span>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '0.12rem 0.5rem',
            borderRadius: '4px',
            background: anomali > 0 ? 'rgba(240, 101, 72, 0.1)' : 'rgba(10, 179, 156, 0.1)',
            color: anomali > 0 ? '#f06548' : '#0ab39c',
            border: `1px solid ${anomali > 0 ? 'rgba(240, 101, 72, 0.25)' : 'rgba(10, 179, 156, 0.25)'}`,
          }}
        >
          {pctBersih.toFixed(1)}% Bersih
        </span>
      </div>

      {total === 0 ? (
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#878a99', fontSize: '0.78rem' }}>
          Belum ada Data Final untuk divisualisasikan. Setujui data di menu <strong>Data Analyst</strong> atau unggah di menu <strong>Final Data</strong>.
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
                <circle cx="80" cy="80" r={radius} fill="transparent" stroke="#f1f3f5" strokeWidth="20" />
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
                  {activeSeg ? activeSeg.label.split(' ')[0] : 'TOTAL'}
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: activeSeg ? activeSeg.color : '#212529', lineHeight: 1.1 }}>
                  {activeSeg ? activeSeg.count.toLocaleString('id-ID') : total.toLocaleString('id-ID')}
                </span>
                <span style={{ fontSize: '0.67rem', color: '#878a99', fontWeight: 500 }}>
                  {activeSeg ? `${((activeSeg.count / total) * 100).toFixed(1)}%` : 'Baris Final'}
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
                    title={seg.ket}
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

          {/* Bottom Half: ringkasan anomali */}
          <div
            style={{
              background: '#f8f9fb',
              border: '1px solid #edf0f2',
              borderRadius: '5px',
              padding: '0.6rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
              fontSize: '0.72rem',
            }}
          >
            <span style={{ fontWeight: 600, color: '#495057', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <ShieldCheck size={13} color="#405189" />
              {anomali > 0
                ? `${anomali.toLocaleString('id-ID')} baris perlu dicek ulang di menu Final Data`
                : 'Semua baris lolos cek pulau, provinsi, status, penempatan & role'}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.69rem' }}>
              <span style={{ color: '#0ab39c', fontWeight: 600 }}>Bersih: {bersih.toLocaleString('id-ID')}</span>
              <span style={{ color: anomali > 0 ? '#f06548' : '#878a99', fontWeight: 600 }}>
                Anomali: {anomali.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
