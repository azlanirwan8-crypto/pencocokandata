import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  MapPin,
  Play,
  RotateCcw,
  X,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Check,
  Building2,
} from 'lucide-react';
import type { TargetRow, MasterRow } from '../../types';
import { generateRecommendationsForUnmatched, type RecommendationResult } from '../../utils/recommender';

interface TargetDataGridProps {
  rows: TargetRow[];
  totalInputRows: number;
  masterRows: MasterRow[];
  wilayahList: string[];
  selectedWilayah: string;
  onWilayahChange: (wilayah: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  onExecuteMatching: () => void;
  onApproveAllRecommendations: (recommendations: RecommendationResult[]) => void;
  onApproveRecommendation: (rowNo: number | string, recommendedMaster: MasterRow) => void;
  isProcessing: boolean;
  canExecute: boolean;
  matchedDone: boolean;
}

export const TargetDataGrid: React.FC<TargetDataGridProps> = ({
  rows,
  totalInputRows,
  masterRows,
  wilayahList,
  selectedWilayah,
  onWilayahChange,
  searchTerm,
  onSearchChange,
  onExecuteMatching,
  onApproveAllRecommendations,
  onApproveRecommendation,
  isProcessing,
  canExecute,
  matchedDone,
}) => {
  // 3 Sub-Tabs State: 'unmatched' | 'recommendation' | 'matched'
  const [checkerTab, setCheckerTab] = useState<'unmatched' | 'recommendation' | 'matched'>('unmatched');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Filter rows into Unmatched vs Matched
  const unmatchedRows = useMemo(() => {
    return rows.filter((r) => !r._isMatched && !r.Sandi && !r['Sandi Cabang']);
  }, [rows]);

  const matchedRows = useMemo(() => {
    return rows.filter((r) => r._isMatched || r.Sandi || r['Sandi Cabang']);
  }, [rows]);

  // Generate recommendations for unmatched rows based on master data proximity
  const recommendations: RecommendationResult[] = useMemo(() => {
    return generateRecommendationsForUnmatched(unmatchedRows, masterRows);
  }, [unmatchedRows, masterRows]);

  // Determine current dataset based on active tab
  const currentTabRows = useMemo(() => {
    if (checkerTab === 'unmatched') return unmatchedRows;
    if (checkerTab === 'matched') return matchedRows;
    return []; // For recommendation tab, we use `recommendations` list directly
  }, [checkerTab, unmatchedRows, matchedRows]);

  const currentTabRecs = useMemo(() => {
    if (checkerTab !== 'recommendation') return [];
    if (!searchTerm.trim()) return recommendations;
    const q = searchTerm.toLowerCase();
    return recommendations.filter((rec) => {
      const r = rec.targetRow;
      const m = rec.recommendedMaster;
      return (
        String(r.Wilayah || '').toLowerCase().includes(q) ||
        String(r.ALAMAT || '').toLowerCase().includes(q) ||
        String(r['KODE POS'] || '').toLowerCase().includes(q) ||
        String(r.Kecamatan || '').toLowerCase().includes(q) ||
        String(r.Kelurahan || '').toLowerCase().includes(q) ||
        String(r['Dati II'] || '').toLowerCase().includes(q) ||
        String(m['Sandi Cabang'] || m.Cabang || '').toLowerCase().includes(q) ||
        String(m['Nama Outlet'] || '').toLowerCase().includes(q) ||
        String(m.ALAMAT || '').toLowerCase().includes(q)
      );
    });
  }, [checkerTab, recommendations, searchTerm]);

  const totalPages = useMemo(() => {
    if (checkerTab === 'recommendation') {
      return Math.ceil(currentTabRecs.length / pageSize) || 1;
    }
    return Math.ceil(currentTabRows.length / pageSize) || 1;
  }, [checkerTab, currentTabRecs.length, currentTabRows.length, pageSize]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return currentTabRows.slice(start, start + pageSize);
  }, [currentTabRows, page, pageSize]);

  const paginatedRecs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return currentTabRecs.slice(start, start + pageSize);
  }, [currentTabRecs, page, pageSize]);

  const hasCombinedSandiCabang = rows.some((r) => r['Sandi Cabang'] && (!r.Sandi || r.Sandi === r['Sandi Cabang']));

  const handleApproveAll = () => {
    if (recommendations.length === 0) return;
    onApproveAllRecommendations(recommendations);
    // Pindah langsung ke Tab 3 (Data Match)
    setCheckerTab('matched');
    setPage(1);
  };

  return (
    <div className="glass-card" style={{ marginTop: '1rem', padding: '1.25rem 1.5rem' }}>
      {/* Top Header: Title & Matching Execution Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '0.85rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#212529', letterSpacing: '-0.01em' }}>
            Pratinjau & Manajemen Data Target
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#878a99', marginTop: '0.15rem' }}>
            Total {rows.length.toLocaleString('id-ID')} baris data terfilter (dari total {totalInputRows.toLocaleString('id-ID')} baris input awal).
          </p>
        </div>

        {/* Execution Button di dalam card tabel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onExecuteMatching}
            disabled={!canExecute || isProcessing}
            id="btn-mulai-pencocokan"
            style={{ padding: '0.42rem 0.95rem' }}
          >
            {isProcessing ? (
              <>
                <RotateCcw size={14} className="pulse-dot" />
                <span>Memproses...</span>
              </>
            ) : matchedDone ? (
              <>
                <RotateCcw size={14} />
                <span>Ulangi Pencocokan</span>
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" />
                <span>Mulai Pencocokan Bertingkat</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3 SUB-TABS (VELZON UNDERLINE STYLE) */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid #e9ebec',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        {/* Tab 1: Data Tidak Match */}
        <button
          type="button"
          onClick={() => {
            setCheckerTab('unmatched');
            setPage(1);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.65rem 1.1rem',
            fontSize: '0.82rem',
            fontWeight: checkerTab === 'unmatched' ? 600 : 500,
            color: checkerTab === 'unmatched' ? '#f06548' : '#878a99',
            background: 'transparent',
            border: 'none',
            borderBottom: checkerTab === 'unmatched' ? '2px solid #f06548' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            marginBottom: '-1px',
          }}
          id="tab-btn-unmatched"
        >
          <AlertTriangle size={14} color={checkerTab === 'unmatched' ? '#f06548' : '#878a99'} />
          <span>Tab 1: Data Tidak Match</span>
          <span
            style={{
              padding: '0.12rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 600,
              background: unmatchedRows.length > 0 ? 'rgba(240, 101, 72, 0.1)' : '#f3f3f9',
              color: unmatchedRows.length > 0 ? '#f06548' : '#878a99',
              border: unmatchedRows.length > 0 ? '1px solid rgba(240, 101, 72, 0.25)' : '1px solid #e9ebec',
            }}
          >
            {unmatchedRows.length.toLocaleString('id-ID')}
          </span>
        </button>

        {/* Tab 2: Rekomendasi Data */}
        <button
          type="button"
          onClick={() => {
            setCheckerTab('recommendation');
            setPage(1);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.65rem 1.1rem',
            fontSize: '0.82rem',
            fontWeight: checkerTab === 'recommendation' ? 600 : 500,
            color: checkerTab === 'recommendation' ? '#d97706' : '#878a99',
            background: 'transparent',
            border: 'none',
            borderBottom: checkerTab === 'recommendation' ? '2px solid #f7b84b' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            marginBottom: '-1px',
          }}
          id="tab-btn-recommendation"
        >
          <Sparkles size={14} color={checkerTab === 'recommendation' ? '#d97706' : '#878a99'} />
          <span>Tab 2: Rekomendasi Data</span>
          <span
            style={{
              padding: '0.12rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 600,
              background: recommendations.length > 0 ? 'rgba(247, 184, 75, 0.15)' : '#f3f3f9',
              color: recommendations.length > 0 ? '#d97706' : '#878a99',
              border: recommendations.length > 0 ? '1px solid rgba(247, 184, 75, 0.3)' : '1px solid #e9ebec',
            }}
          >
            {recommendations.length.toLocaleString('id-ID')} Rekomendasi
          </span>
        </button>

        {/* Tab 3: Data Match */}
        <button
          type="button"
          onClick={() => {
            setCheckerTab('matched');
            setPage(1);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.65rem 1.1rem',
            fontSize: '0.82rem',
            fontWeight: checkerTab === 'matched' ? 600 : 500,
            color: checkerTab === 'matched' ? '#0ab39c' : '#878a99',
            background: 'transparent',
            border: 'none',
            borderBottom: checkerTab === 'matched' ? '2px solid #0ab39c' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            marginBottom: '-1px',
          }}
          id="tab-btn-matched"
        >
          <CheckCircle2 size={14} color={checkerTab === 'matched' ? '#0ab39c' : '#878a99'} />
          <span>Tab 3: Data Match</span>
          <span
            style={{
              padding: '0.12rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 600,
              background: matchedRows.length > 0 ? 'rgba(10, 179, 156, 0.12)' : '#f3f3f9',
              color: matchedRows.length > 0 ? '#0ab39c' : '#878a99',
              border: matchedRows.length > 0 ? '1px solid rgba(10, 179, 156, 0.25)' : '1px solid #e9ebec',
            }}
          >
            {matchedRows.length.toLocaleString('id-ID')}
          </span>
        </button>
      </div>

      {/* Filter & Search Toolbar (Integrated inside Card) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.6rem',
          padding: '0.65rem 0.85rem',
          background: '#f8f9fa',
          border: '1px solid #e9ebec',
          borderRadius: '6px',
          marginBottom: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Dropdown Wilayah */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MapPin size={14} color="#405189" />
            <select
              className="filter-select"
              value={selectedWilayah}
              onChange={(e) => {
                onWilayahChange(e.target.value);
                setPage(1);
              }}
              id="filter-select-wilayah"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
            >
              <option value="ALL">Semua Wilayah / Region ({wilayahList.length})</option>
              {wilayahList.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* Action button in Tab 2: SETUJUI SEMUA REKOMENDASI */}
          {checkerTab === 'recommendation' && recommendations.length > 0 && (
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={handleApproveAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                padding: '0.32rem 0.85rem',
              }}
              id="btn-setujui-semua-rekomendasi"
            >
              <Check size={14} />
              <span>Setujui Semua Rekomendasi ({recommendations.length})</span>
            </button>
          )}
        </div>

        {/* Input Search */}
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon-pos" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari Sandi, Outlet, Alamat..."
            value={searchTerm}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setPage(1);
            }}
            style={{ width: '240px', paddingRight: searchTerm ? '2rem' : '0.85rem' }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                setPage(1);
              }}
              style={{
                position: 'absolute',
                right: '0.5rem',
                background: 'transparent',
                border: 'none',
                color: '#878a99',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          TAB CONTENT RENDERING
          ========================================================================= */}

      {/* TAB 2: REKOMENDASI DATA (SMART PROXIMITY SUGGESTIONS) */}
      {checkerTab === 'recommendation' ? (
        <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center', background: '#f3f6f9', color: '#405189' }}>No</th>
                <th style={{ minWidth: '160px', background: '#fff9f0', color: '#d97706' }}>Kandidat Rekomendasi Master</th>
                <th style={{ minWidth: '140px', background: '#fff9f0', color: '#d97706' }}>Skor & Dasar Kedekatan</th>
                <th style={{ minWidth: '100px', textAlign: 'center', background: '#fff9f0' }}>Aksi</th>
                {/* Data Target Asli */}
                <th style={{ color: '#878a99' }}>Wilayah Target</th>
                <th style={{ color: '#878a99' }}>KODE POS Target</th>
                <th style={{ color: '#878a99' }}>Kecamatan Target</th>
                <th style={{ color: '#878a99' }}>Kelurahan Target</th>
                <th style={{ color: '#878a99' }}>Dati II Target</th>
                <th style={{ minWidth: '220px', color: '#878a99' }}>ALAMAT Target</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecs.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: '#878a99' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={32} color="#0ab39c" />
                      <strong style={{ color: '#212529', fontSize: '0.95rem' }}>
                        Tidak Ada Rekomendasi Tertunda
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: '#878a99' }}>
                        {unmatchedRows.length === 0
                          ? 'Semua data target telah berhasil dicocokkan ke Data Master (Tab 1 & Tab 2 kosong).'
                          : 'Tidak ada data tidak match yang cocok dengan filter pencarian saat ini.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecs.map((rec) => {
                  const r = rec.targetRow;
                  const m = rec.recommendedMaster;
                  const badgeColor =
                    rec.score >= 80 ? '#0ab39c' : rec.score >= 60 ? '#d97706' : '#405189';
                  const badgeBg =
                    rec.score >= 80
                      ? 'rgba(10, 179, 156, 0.12)'
                      : rec.score >= 60
                      ? 'rgba(247, 184, 75, 0.15)'
                      : 'rgba(64, 81, 137, 0.1)';

                  return (
                    <tr key={String(r.No)} style={{ background: '#ffffff' }}>
                      <td className="code-cell" style={{ textAlign: 'center', color: '#405189' }}>
                        {r.No}
                      </td>

                      {/* Kandidat Rekomendasi Master */}
                      <td style={{ background: '#fffdfa' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <strong style={{ color: '#212529', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Building2 size={13} color="#d97706" />
                            <span>{m['Sandi Cabang'] || [m.Sandi, m.Cabang].filter(Boolean).join(' - ') || m.Cabang}</span>
                          </strong>
                          <span style={{ color: '#405189', fontWeight: 600, fontSize: '0.78rem' }}>
                            {m['Nama Outlet']}
                          </span>
                          <span style={{ color: '#878a99', fontSize: '0.72rem' }}>
                            Kode Pos Master: <strong>{m['KODE POS']}</strong> • {m.Kecamatan}, {m['Dati II']}
                          </span>
                        </div>
                      </td>

                      {/* Skor & Dasar Kedekatan */}
                      <td style={{ background: '#fffdfa' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: badgeColor,
                              background: badgeBg,
                              width: 'fit-content',
                            }}
                          >
                            <Sparkles size={11} /> Kemiripan {rec.score}%
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#878a99' }}>{rec.reason}</span>
                        </div>
                      </td>

                      {/* Aksi Setujui per baris */}
                      <td style={{ textAlign: 'center', background: '#fffdfa' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => onApproveRecommendation(r.No, m)}
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.25rem 0.55rem',
                            color: '#0ab39c',
                            borderColor: 'rgba(10, 179, 156, 0.3)',
                          }}
                          title="Setujui rekomendasi untuk baris ini"
                        >
                          <Check size={12} /> Setujui
                        </button>
                      </td>

                      {/* Data Target Asli */}
                      <td><span style={{ color: '#495057' }}>{r.Wilayah || '-'}</span></td>
                      <td className="code-cell" style={{ color: '#f06548', fontWeight: 700 }}>{r['KODE POS']}</td>
                      <td>{r.Kecamatan || '-'}</td>
                      <td>{r.Kelurahan || '-'}</td>
                      <td>{r['Dati II'] || '-'}</td>
                      <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.ALAMAT}>
                        {r.ALAMAT || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* TAB 1 & TAB 3: DATA GRID BIASA (UNMATCHED vs MATCHED) */
        <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center', background: '#f3f6f9', borderRight: '1px solid #e9ebec', color: '#405189' }}>No</th>
                <th>Status Match</th>
                <th>Wilayah</th>
                {/* Atribut Hasil Enrichment Master */}
                {hasCombinedSandiCabang ? (
                  <th style={{ color: '#405189' }}>Sandi Cabang (Master)</th>
                ) : (
                  <>
                    <th style={{ color: '#405189' }}>Sandi (Master)</th>
                    <th style={{ color: '#405189' }}>Cabang (Master)</th>
                  </>
                )}
                <th style={{ color: '#405189' }}>Branch Code (Master)</th>
                <th style={{ color: '#405189' }}>Kode Cabang (Master)</th>
                <th style={{ color: '#405189' }}>Nama Outlet (Master)</th>
                <th style={{ color: '#405189' }}>Status Outlet (Master)</th>
                <th style={{ color: '#405189' }}>ALAMAT (Master)</th>
                {/* Kolom Target Asli (Sampai Provinsi) */}
                <th>KODE POS</th>
                <th>Kelurahan</th>
                <th>Kecamatan</th>
                <th>Dati II</th>
                <th>Kode Dati II</th>
                <th>Provinsi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={16} style={{ textAlign: 'center', padding: '3rem', color: '#878a99' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      {checkerTab === 'unmatched' ? (
                        <>
                          <CheckCircle2 size={32} color="#0ab39c" />
                          <strong style={{ color: '#212529', fontSize: '0.95rem' }}>
                            Semua Data Telah Berhasil Dicocokkan!
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: '#878a99' }}>
                            Tidak ada data target yang berstatus Unmatched (Tab 1 & Tab 2 kosong).
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={32} color="#878a99" />
                          <strong style={{ color: '#212529', fontSize: '0.95rem' }}>
                            Belum Ada Data yang Cocok
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: '#878a99' }}>
                            Jalankan pencocokan bertingkat atau setujui rekomendasi pada Tab 2.
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => {
                  const isMatched = r._isMatched ?? (r.Sandi !== '' || r['Sandi Cabang'] !== '');

                  return (
                    <tr
                      key={String(r.No)}
                      className={isMatched ? 'row-matched' : 'row-unmatched'}
                    >
                      {/* 1. Locked Column No */}
                      <td
                        className="code-cell"
                        style={{
                          textAlign: 'center',
                          background: '#ffffff',
                          fontWeight: 700,
                          color: '#405189',
                          borderRight: '1px solid #e9ebec',
                        }}
                      >
                        {r.No}
                      </td>

                      {/* Status Match Badge */}
                      <td>
                        {isMatched ? (
                          <span
                            className={`badge ${
                              r._matchLevel === 'recommendation'
                                ? 'badge-level2'
                                : r._matchLevel === 'level2'
                                ? 'badge-level2'
                                : 'badge-match'
                            }`}
                          >
                            {r._matchLevel === 'recommendation'
                              ? 'MATCH (REKOMENDASI)'
                              : r._matchLevel === 'level2'
                              ? 'MATCH (L2 TIE)'
                              : 'MATCH (L1)'}
                          </span>
                        ) : (
                          <span className="badge badge-unmatched">UNMATCHED</span>
                        )}
                      </td>

                      {/* Wilayah */}
                      <td><span style={{ color: '#495057' }}>{r.Wilayah || '-'}</span></td>

                      {/* Auto-populated Master Attributes */}
                      {hasCombinedSandiCabang ? (
                        <td>
                          <strong style={{ color: isMatched ? '#212529' : '#878a99' }}>
                            {r['Sandi Cabang'] || r.Cabang || '-'}
                          </strong>
                        </td>
                      ) : (
                        <>
                          <td className="code-cell" style={{ color: '#405189' }}>
                            {r.Sandi || <span style={{ color: '#878a99' }}>-</span>}
                          </td>
                          <td>
                            <strong style={{ color: isMatched ? '#212529' : '#878a99' }}>
                              {r.Cabang || '-'}
                            </strong>
                          </td>
                        </>
                      )}
                      <td className="code-cell">
                        {r['Branch Code'] || <span style={{ color: '#878a99' }}>-</span>}
                      </td>
                      <td className="code-cell">
                        {r['Kode Cabang'] || <span style={{ color: '#878a99' }}>-</span>}
                      </td>
                      <td style={{ color: '#405189', fontWeight: 500 }}>{r['Nama Outlet'] || <span style={{ color: '#878a99' }}>-</span>}</td>
                      <td>
                        {r['Status Outlet'] ? (
                          <span className="badge badge-match">{r['Status Outlet']}</span>
                        ) : (
                          <span style={{ color: '#878a99' }}>-</span>
                        )}
                      </td>
                      <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.ALAMAT}>
                        {r.ALAMAT || <span style={{ color: '#878a99' }}>-</span>}
                      </td>

                      {/* Target Data Asli (Sampai Provinsi) */}
                      <td className="code-cell" style={{ color: '#405189', fontWeight: 700 }}>{r['KODE POS']}</td>
                      <td>{r.Kelurahan || '-'}</td>
                      <td>{r.Kecamatan || '-'}</td>
                      <td>{r['Dati II'] || '-'}</td>
                      <td className="code-cell">{r['Kode Dati II'] || '-'}</td>
                      <td>{r.Provinsi || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Clean Pagination Bar */}
      <div className="pagination-row" style={{ marginTop: '0.75rem', paddingTop: '0.5rem' }}>
        <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
          Menampilkan{' '}
          {checkerTab === 'recommendation'
            ? `${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, currentTabRecs.length)} dari ${currentTabRecs.length.toLocaleString('id-ID')} rekomendasi`
            : `${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, currentTabRows.length)} dari ${currentTabRows.length.toLocaleString('id-ID')} baris`}
        </div>
        <div className="pagination-controls">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            <ChevronLeft size={13} />
            <span>Sebelumnya</span>
          </button>
          <span style={{ padding: '0 0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#495057' }}>
            Hal {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          >
            <span>Berikutnya</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
