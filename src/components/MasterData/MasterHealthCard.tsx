import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import type { MasterHealth } from '../../types';

interface MasterHealthCardProps {
  health: MasterHealth;
}

export const MasterHealthCard: React.FC<MasterHealthCardProps> = ({ health }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div style={{ marginTop: '1.25rem' }}>
      {health.multiOutletCount > 0 ? (
        <div className="health-warning-banner">
          <ShieldAlert size={22} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong style={{ color: '#fbbf24', fontSize: '0.92rem' }}>
                  Peringatan Indikator Kesehatan Master: Terdeteksi {health.multiOutletCount} Kode Pos Multi-Cabang
                </strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Terdapat {health.multiOutletCount} kode pos yang menampung lebih dari 1 outlet cabang. Sistem akan secara otomatis mengeksekusi <strong>Level 2 Tie-Breaker</strong> (resolusi bertingkat Kecamatan $\rightarrow$ Kelurahan $\rightarrow$ Dati II) untuk memastikan cabang yang terpilih 100% akurat.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowDetails(!showDetails)}
                style={{ fontSize: '0.78rem' }}
              >
                <span>{showDetails ? 'Tutup Detail' : 'Lihat Daftar Kode Pos Multi-Cabang'}</span>
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {showDetails && (
              <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', marginBottom: '0.5rem' }}>
                  Daftar Kode Pos dengan Multi-Outlet:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
                  {health.multiOutletItems.map((item) => (
                    <div key={item.kodePos} style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd', fontWeight: 700 }}>
                          KODE POS: {item.kodePos}
                        </span>
                        <span style={{ color: '#fbbf24', fontWeight: 600 }}>{item.count} Cabang</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '0.2rem' }}>
                        Kecamatan: {item.kecamatan}
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.74rem', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.outlets.join(' | ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="health-warning-banner success">
          <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#34d399', fontSize: '0.88rem' }}>
              Indikator Kesehatan Master Optimal (100% Unique Mapping)
            </strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              Seluruh {health.uniqueKodePos} kode pos terpetakan 1-to-1 secara presisi tanpa ada kode pos bentrok.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
