import React, { useState, useMemo } from 'react';
import { ShieldAlert, Search, Building2, ChevronRight, X, Layers, Info } from 'lucide-react';
import type { MasterHealth, MasterRow } from '../../types';
import { formatWilayahName } from '../../utils/normalizer';

interface MasterDuplicateChartProps {
  masterHealth: MasterHealth;
  masterRows: MasterRow[];
  selectedWilayah?: string;
  onNavigateToMaster?: () => void;
}

export const MasterDuplicateChart: React.FC<MasterDuplicateChartProps> = ({
  masterHealth,
  masterRows,
  selectedWilayah = 'ALL',
  onNavigateToMaster,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');

  // Filter multi-outlet items based on selectedWilayah
  const filteredItems = useMemo(() => {
    let items = masterHealth.multiOutletItems || [];

    // Filter by Wilayah if specified and not 'ALL'
    if (selectedWilayah && selectedWilayah !== 'ALL') {
      items = items.filter((item) => {
        return (item.matchingMasterRows || []).some(
          (r) => String(r.Wilayah || '').trim().toUpperCase() === selectedWilayah.trim().toUpperCase()
        );
      });
    }

    // Filter by Search Query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter((item) => {
        const matchKp = String(item.kodePos || '').toLowerCase().includes(q);
        const matchKec = String(item.kecamatan || '').toLowerCase().includes(q);
        const matchOutlets = (item.outlets || []).some((o) => o.toLowerCase().includes(q));
        const matchRows = (item.matchingMasterRows || []).some(
          (r) =>
            String(r['Dati II'] || '').toLowerCase().includes(q) ||
            String(r.ALAMAT || '').toLowerCase().includes(q) ||
            String(r['Sandi Cabang'] || '').toLowerCase().includes(q) ||
            String(r.Cabang || '').toLowerCase().includes(q)
        );
        return matchKp || matchKec || matchOutlets || matchRows;
      });
    }

    // Sort by count descending (most branches first)
    return [...items].sort((a, b) => b.count - a.count);
  }, [masterHealth.multiOutletItems, selectedWilayah, searchTerm]);

  // All multi-outlet items available for the visual chart (with 5 visible + scrollable)
  const chartItems = useMemo(() => {
    return filteredItems;
  }, [filteredItems]);

  const maxCount = useMemo(() => {
    if (chartItems.length === 0) return 1;
    return Math.max(...chartItems.map((i) => i.count));
  }, [chartItems]);

  const totalBranchesInMulti = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.count, 0);
  }, [filteredItems]);

  if (masterRows.length === 0) return null;

  return (
    <div
      className="glass-card"
      style={{
        padding: '1.1rem 1.25rem',
        marginBottom: '1.25rem',
        background: '#ffffff',
        border: '1px solid #e9ebec',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '0.85rem',
          borderBottom: '1px solid #f3f6f9',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(240, 101, 72, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f06548',
              flexShrink: 0,
            }}
          >
            <Layers size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#212529' }}>
                Analisis Duplikasi & Multi-Outlet Master Data
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.12rem 0.5rem',
                  borderRadius: '12px',
                  background: filteredItems.length > 0 ? 'rgba(240, 101, 72, 0.1)' : 'rgba(10, 179, 156, 0.1)',
                  color: filteredItems.length > 0 ? '#e05338' : '#0ab39c',
                  border: filteredItems.length > 0 ? '1px solid rgba(240, 101, 72, 0.25)' : '1px solid rgba(10, 179, 156, 0.25)',
                }}
              >
                {filteredItems.length.toLocaleString('id-ID')} Kode Pos ({totalBranchesInMulti.toLocaleString('id-ID')} Cabang)
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#878a99' }}>
              Monitoring kode pos yang memiliki lebih dari 1 cabang resmi Master (otomatis diselesaikan dengan Level 2 Tie-Breaker).
            </p>
          </div>
        </div>

        {/* Action Controls & View Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Segmented View Mode */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#f3f6f9',
              border: '1px solid #e9ebec',
              borderRadius: '5px',
              padding: '2px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('chart')}
              style={{
                border: 'none',
                background: activeTab === 'chart' ? '#ffffff' : 'transparent',
                color: activeTab === 'chart' ? '#405189' : '#6c757d',
                fontWeight: activeTab === 'chart' ? 700 : 500,
                fontSize: '0.73rem',
                padding: '0.22rem 0.6rem',
                borderRadius: '4px',
                boxShadow: activeTab === 'chart' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              Grafik Visual
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              style={{
                border: 'none',
                background: activeTab === 'table' ? '#ffffff' : 'transparent',
                color: activeTab === 'table' ? '#405189' : '#6c757d',
                fontWeight: activeTab === 'table' ? 700 : 500,
                fontSize: '0.73rem',
                padding: '0.22rem 0.6rem',
                borderRadius: '4px',
                boxShadow: activeTab === 'table' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              Daftar Rincian
            </button>
          </div>

          {/* Search Input */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#ffffff',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              padding: '0 0.5rem',
              height: '30px',
              gap: '0.35rem',
            }}
          >
            <Search size={13} color="#878a99" />
            <input
              type="text"
              placeholder="Cari Kode Pos / Cabang..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.75rem',
                width: '160px',
                color: '#495057',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: '#878a99' }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {onNavigateToMaster && (
            <button
              type="button"
              onClick={onNavigateToMaster}
              className="btn btn-outline btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.74rem',
                padding: '0.28rem 0.6rem',
                color: '#405189',
                borderColor: '#ced4da',
              }}
            >
              <span>Kelola di Master</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Body Content */}
      {filteredItems.length === 0 ? (
        <div
          style={{
            padding: '2.5rem 1rem',
            textAlign: 'center',
            background: '#f8f9fa',
            borderRadius: '6px',
            border: '1px dashed #e9ebec',
          }}
        >
          <ShieldAlert size={28} color="#0ab39c" style={{ marginBottom: '0.4rem' }} />
          <h4 style={{ margin: '0 0 0.2rem', fontSize: '0.88rem', color: '#212529', fontWeight: 600 }}>
            Tidak Ada Duplikasi Kode Pos
          </h4>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#878a99' }}>
            {searchTerm
              ? `Tidak ada data multi-outlet yang sesuai dengan pencarian "${searchTerm}".`
              : selectedWilayah !== 'ALL'
              ? `Seluruh kode pos master di ${formatWilayahName(selectedWilayah)} unik 1-ke-1 tanpa duplikasi cabang.`
              : 'Seluruh kode pos pada Data Master Anda unik 1-ke-1 (tidak ada yang multi-cabang).'}
          </p>
        </div>
      ) : activeTab === 'chart' ? (
        /* VISUAL BAR CHART VIEW */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#878a99', fontWeight: 600 }}>
              KODE POS DENGAN CABANG TERBANYAK {selectedWilayah !== 'ALL' ? `(${formatWilayahName(selectedWilayah).toUpperCase()})` : ''}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#405189' }}>
              Menampilkan {chartItems.length} kode pos {chartItems.length > 5 ? '(5 Terlihat & Scroll)' : ''}
            </span>
          </div>

          {/* Visual Chart: 5 Records Visible + Smooth Scroll */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '430px', overflowY: 'auto', paddingRight: '0.35rem' }}>
            {chartItems.map((item, idx) => {
              const percentage = Math.round((item.count / maxCount) * 100);
              const datiName = item.matchingMasterRows?.[0]?.['Dati II'] || '';
              const provName = item.matchingMasterRows?.[0]?.Provinsi || '';
              const wilName = item.matchingMasterRows?.[0]?.Wilayah || '';

              return (
                <div
                  key={`chart-kp-${item.kodePos}-${idx}`}
                  style={{
                    padding: '0.6rem 0.85rem',
                    background: '#fbfcfd',
                    borderRadius: '6px',
                    border: '1px solid #edf0f2',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Row 1: Kode Pos, Info Wilayah & Badge Jumlah */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#405189',
                          background: 'rgba(64, 81, 137, 0.08)',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '4px',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {item.kodePos}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#212529' }}>
                        Kec. {item.kecamatan || '-'}
                      </span>
                      {datiName && (
                        <span style={{ fontSize: '0.72rem', color: '#6c757d' }}>
                          • {datiName} {provName ? `(${provName})` : ''}
                        </span>
                      )}
                      {wilName && (
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 600,
                            color: '#0ab39c',
                            background: 'rgba(10, 179, 156, 0.08)',
                            padding: '0.05rem 0.35rem',
                            borderRadius: '3px',
                          }}
                        >
                          {formatWilayahName(wilName)}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#e05338',
                          background: 'rgba(240, 101, 72, 0.1)',
                          border: '1px solid rgba(240, 101, 72, 0.25)',
                          padding: '0.1rem 0.5rem',
                          borderRadius: '12px',
                        }}
                      >
                        {item.count} Cabang Aktif
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Visual Horizontal Bar */}
                  <div
                    style={{
                      height: '6px',
                      background: '#e9ebec',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${percentage}%`,
                        background: 'linear-gradient(90deg, #f06548 0%, #f7b84b 100%)',
                        borderRadius: '3px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>

                  {/* Row 3: Outlet Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                    <span style={{ fontSize: '0.67rem', color: '#878a99', fontWeight: 600 }}>Cabang terdaftar:</span>
                    {(item.matchingMasterRows || []).map((r, rIdx) => {
                      const outletLabel = r['Nama Outlet'] || r['Sandi Cabang'] || r.Cabang || `Outlet #${rIdx + 1}`;
                      const sandiLabel = r.Sandi || r['Kode Cabang'] || '';
                      return (
                        <span
                          key={`outlet-${rIdx}`}
                          style={{
                            fontSize: '0.68rem',
                            color: '#405189',
                            background: '#ffffff',
                            border: '1px solid #d8e2ef',
                            padding: '0.08rem 0.4rem',
                            borderRadius: '3px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                          title={`Alamat: ${r.ALAMAT || '-'}\nKelurahan: ${r.Kelurahan || '-'}`}
                        >
                          <Building2 size={10} color="#405189" />
                          <strong style={{ fontWeight: 600 }}>{outletLabel}</strong>
                          {sandiLabel && <span style={{ color: '#878a99' }}>({sandiLabel})</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredItems.length > 8 && (
            <div style={{ textAlign: 'center', marginTop: '0.85rem' }}>
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#405189',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <span>Lihat seluruh {filteredItems.length} kode pos multi-cabang di Tabel Rincian</span>
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* INTERACTIVE TABLE BREAKDOWN VIEW */
        <div className="table-container" style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid #e9ebec', borderRadius: '6px' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                <th style={{ width: '90px' }}>Kode Pos</th>
                <th style={{ minWidth: '130px' }}>Kecamatan</th>
                <th style={{ minWidth: '120px' }}>Dati II</th>
                <th style={{ width: '95px' }}>Wilayah</th>
                <th style={{ width: '95px', textAlign: 'center' }}>Total Cabang</th>
                <th style={{ minWidth: '320px' }}>Daftar Nama Cabang & Sandi</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => {
                const datiName = item.matchingMasterRows?.[0]?.['Dati II'] || '-';
                const wilName = item.matchingMasterRows?.[0]?.Wilayah || '-';

                return (
                  <tr key={`table-kp-${item.kodePos}-${idx}`}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#878a99' }}>{idx + 1}</td>
                    <td className="code-cell" style={{ fontWeight: 700, color: '#405189' }}>
                      {item.kodePos}
                    </td>
                    <td style={{ fontWeight: 600, color: '#212529' }}>{item.kecamatan || '-'}</td>
                    <td style={{ color: '#495057' }}>{datiName}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.67rem',
                          fontWeight: 600,
                          color: '#0ab39c',
                          background: 'rgba(10, 179, 156, 0.08)',
                          padding: '0.08rem 0.35rem',
                          borderRadius: '3px',
                        }}
                      >
                        {formatWilayahName(wilName)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#e05338',
                          background: 'rgba(240, 101, 72, 0.1)',
                          border: '1px solid rgba(240, 101, 72, 0.25)',
                          padding: '0.08rem 0.45rem',
                          borderRadius: '12px',
                        }}
                      >
                        {item.count} Cabang
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {(item.matchingMasterRows || []).map((r, rIdx) => (
                          <div
                            key={`tbl-sub-${rIdx}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.71rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ color: '#405189', fontWeight: 600 }}>
                              {r['Nama Outlet'] || r.Cabang || '-'}
                            </span>
                            {r.Sandi && <span style={{ color: '#878a99' }}>({r.Sandi})</span>}
                            {r.ALAMAT && (
                              <span style={{ color: '#adb5bd', fontSize: '0.67rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                • {r.ALAMAT}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Info Notice */}
      <div
        style={{
          marginTop: '0.85rem',
          padding: '0.45rem 0.75rem',
          background: 'rgba(64, 81, 137, 0.04)',
          borderRadius: '4px',
          border: '1px solid rgba(64, 81, 137, 0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontSize: '0.72rem',
          color: '#405189',
        }}
      >
        <Info size={13} style={{ flexShrink: 0 }} />
        <span>
          <strong>Informasi Audit:</strong> Saat target data memiliki kode pos di atas, sistem secara otomatis mengevaluasi
          kesamaan Kecamatan, Kelurahan, hingga <strong>Koridor Jalan / Landmark</strong> (Level 2 Tie-Breaker) untuk menentukan cabang yang tepat.
        </span>
      </div>
    </div>
  );
};
