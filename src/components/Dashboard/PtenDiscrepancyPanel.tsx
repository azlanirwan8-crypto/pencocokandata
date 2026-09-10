import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle2, FileWarning, Sparkles } from 'lucide-react';
import type { TargetRow } from '../../types';

interface PtenDiscrepancyPanelProps {
  targetRows: TargetRow[];
}

export const PtenDiscrepancyPanel: React.FC<PtenDiscrepancyPanelProps> = ({ targetRows }) => {
  const analysis = useMemo(() => {
    if (targetRows.length === 0) {
      return {
        total: 0,
        matchedPten: 0,
        diffPten: 0,
        topDiffCities: [] as { city: string; count: number }[],
        complianceRate: 0,
      };
    }

    let matchedPten = 0;
    let diffPten = 0;
    const cityDiffMap = new Map<string, number>();

    targetRows.forEach((r) => {
      const status = r['CEK KODE POS + PTEN'];
      if (status === 'MATCH') {
        matchedPten++;
      } else if (status === 'DIFFERENT') {
        diffPten++;
        const city = r['KOTA PTEN'] || r['Dati II'] || 'Kota Lainnya';
        cityDiffMap.set(city, (cityDiffMap.get(city) || 0) + 1);
      }
    });

    const topDiffCities = Array.from(cityDiffMap.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const evaluated = matchedPten + diffPten;
    const complianceRate = evaluated > 0 ? (matchedPten / evaluated) * 100 : 0;

    return {
      total: targetRows.length,
      matchedPten,
      diffPten,
      topDiffCities,
      complianceRate,
    };
  }, [targetRows]);

  return (
    <div className="glass-card">
      <div className="section-header">
        <div>
          <h2 className="section-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <FileWarning size={16} color="#f59e0b" />
            <span>Matriks Kepatuhan PTEN vs Operasional</span>
          </h2>
          <p className="section-subtitle" style={{ fontSize: '0.78rem' }}>
            Perbandingan akurasi kode pos operasional terhadap standar database PTEN nasional.
          </p>
        </div>
      </div>

      {analysis.total === 0 ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Belum ada data target yang dievaluasi PTEN.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.75rem' }}>
          {/* Summary Mini Ratio */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <div
              style={{
                background: 'rgba(10, 179, 156, 0.08)',
                border: '1px solid rgba(10, 179, 156, 0.25)',
                borderRadius: '6px',
                padding: '0.65rem 0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0ab39c', fontSize: '0.72rem', fontWeight: 600 }}>
                <CheckCircle2 size={13} />
                <span>PTEN Selaras (MATCH)</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#212529', marginTop: '0.2rem', fontFamily: 'var(--font-sans)' }}>
                {analysis.matchedPten.toLocaleString('id-ID')}
                <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#878a99', marginLeft: '0.3rem' }}>
                  ({analysis.complianceRate.toFixed(1)}%)
                </span>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(240, 101, 72, 0.08)',
                border: '1px solid rgba(240, 101, 72, 0.25)',
                borderRadius: '6px',
                padding: '0.65rem 0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f06548', fontSize: '0.72rem', fontWeight: 600 }}>
                <AlertCircle size={13} />
                <span>Selisih (DIFFERENT)</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f06548', marginTop: '0.2rem', fontFamily: 'var(--font-sans)' }}>
                {analysis.diffPten.toLocaleString('id-ID')}
                <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#878a99', marginLeft: '0.3rem' }}>
                  ({(100 - analysis.complianceRate).toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Top Discrepancy Cities */}
          {analysis.topDiffCities.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Kota/Kabupaten dengan Selisih Terbanyak:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {analysis.topDiffCities.map((item, i) => (
                  <div
                    key={item.city}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.76rem',
                      padding: '0.4rem 0.65rem',
                      borderRadius: '4px',
                      background: '#f8f9fa',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ color: '#495057' }}>
                      <strong style={{ color: '#405189', marginRight: '0.35rem' }}>#{i + 1}</strong>
                      {item.city}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f06548' }}>
                      {item.count} anomali
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analyst Advice Pill */}
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              background: 'rgba(64, 81, 137, 0.08)',
              border: '1px solid rgba(64, 81, 137, 0.2)',
              fontSize: '0.73rem',
              color: '#405189',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Sparkles size={13} style={{ flexShrink: 0 }} />
            <span>
              {analysis.diffPten === 0
                ? 'Semua data operasional telah sinkron dengan kode pos standar PTEN.'
                : `${analysis.diffPten} baris selisih perlu diverifikasi penulisan kode pos operasionalnya.`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
