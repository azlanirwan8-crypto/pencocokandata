import React, { useState, useEffect, useMemo } from 'react';
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
  HelpCircle,
  Layers,
  Info,
} from 'lucide-react';
import type { TargetRow, MasterRow } from '../../types';
import {
  generateRecommendationsForUnmatched,
  buildMasterProximityIndex,
  type RecommendationResult,
  type CandidateOption,
} from '../../utils/recommender';
import { ProximityGuideModal } from './ProximityGuideModal';
import { CandidateDetailModal } from './CandidateDetailModal';

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
  matchedDone?: boolean;
}

export const TargetDataGrid: React.FC<TargetDataGridProps> = ({
  rows,
  totalInputRows: _totalInputRows,
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
  matchedDone = false,
}) => {
  // 3 Sub-Tabs State: 'upload' | 'recommendation' | 'matched'
  const [checkerTab, setCheckerTab] = useState<'upload' | 'recommendation' | 'matched'>('upload');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Filter rows into Unmatched vs Matched (Hanya terisi jika sudah dilakukan pencocokan)
  const unmatchedRows = useMemo(() => {
    if (!matchedDone) return [];
    return rows.filter((r) => !r._isMatched && !r.Sandi && !r['Sandi Cabang']);
  }, [rows, matchedDone]);

  const matchedRows = useMemo(() => {
    if (!matchedDone) return [];
    return rows.filter((r) => r._isMatched || r.Sandi || r['Sandi Cabang']);
  }, [rows, matchedDone]);

  // Build Master Proximity Index once (O(1) bucket index)
  const masterProximityIndex = useMemo(() => {
    return buildMasterProximityIndex(masterRows);
  }, [masterRows]);

  // Recommendations state - LAZY evaluated so opening 'Data Cek' is 100% INSTANT!
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [isComputingRecs, setIsComputingRecs] = useState<boolean>(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState<{
    targetRow: TargetRow;
    candidate: CandidateOption;
  } | null>(null);

  // Trigger recommendation calculation ONLY when Tab 2 is active AND matchedDone is true
  useEffect(() => {
    if (checkerTab !== 'recommendation' || !matchedDone) {
      setRecommendations([]);
      return;
    }
    if (unmatchedRows.length === 0 || masterRows.length === 0) {
      setRecommendations([]);
      return;
    }

    setIsComputingRecs(true);
    // Non-blocking asynchronous calculation
    const timer = setTimeout(() => {
      const recs = generateRecommendationsForUnmatched(unmatchedRows, masterRows, masterProximityIndex);
      setRecommendations(recs);
      setIsComputingRecs(false);
    }, 40);

    return () => clearTimeout(timer);
  }, [checkerTab, unmatchedRows, masterRows, masterProximityIndex, matchedDone]);

  // Determine current dataset based on active tab
  const currentTabRows = useMemo(() => {
    if (checkerTab === 'upload') {
      // Jika sudah di-analisa (pencocokan), data di tab upload kosong karena sudah berpindah
      if (matchedDone) return [];
      return rows;
    }
    if (checkerTab === 'matched') {
      // Sebelum pencocokan dilakukan, tab matched masih kosong
      if (!matchedDone) return [];
      return matchedRows;
    }
    return []; // For recommendation tab, we use `recommendations` list directly
  }, [checkerTab, rows, matchedRows, matchedDone]);

  const currentTabRecs = useMemo(() => {
    if (checkerTab !== 'recommendation') return [];
    if (!searchTerm.trim()) return recommendations;
    const q = searchTerm.toLowerCase();
    return recommendations.filter((rec) => {
      const r = rec.targetRow;
      const m = rec.recommendedMaster;
      const candsMatch = (rec.candidates || []).some((c) => {
        const cm = c.master;
        return (
          String(cm['Sandi Cabang'] || cm.Cabang || cm.Sandi || '').toLowerCase().includes(q) ||
          String(cm['Nama Outlet'] || '').toLowerCase().includes(q) ||
          String(cm.ALAMAT || '').toLowerCase().includes(q) ||
          String(cm.Kecamatan || '').toLowerCase().includes(q) ||
          String(cm['Dati II'] || '').toLowerCase().includes(q) ||
          String(cm['KODE POS'] || '').toLowerCase().includes(q)
        );
      });

      return (
        candsMatch ||
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
    setRecommendations([]);
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
            {matchedDone
              ? `Analisis selesai • ${matchedRows.length.toLocaleString('id-ID')} Data Match • ${unmatchedRows.length.toLocaleString('id-ID')} Rekomendasi Data`
              : `Total ${rows.length.toLocaleString('id-ID')} baris data target menunggu pencocokan.`}
          </p>
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
        {/* Tab 1: Data Upload */}
        <button
          type="button"
          onClick={() => {
            setCheckerTab('upload');
            setPage(1);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.65rem 1.1rem',
            fontSize: '0.82rem',
            fontWeight: checkerTab === 'upload' ? 600 : 500,
            color: checkerTab === 'upload' ? '#3577f1' : '#878a99',
            background: 'transparent',
            border: 'none',
            borderBottom: checkerTab === 'upload' ? '2px solid #3577f1' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            marginBottom: '-1px',
          }}
          id="tab-btn-upload"
        >
          <Layers size={14} color={checkerTab === 'upload' ? '#3577f1' : '#878a99'} />
          <span>Data Upload</span>
          <span
            style={{
              padding: '0.12rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 600,
              background: (!matchedDone && rows.length > 0) ? 'rgba(53, 119, 241, 0.1)' : '#f3f3f9',
              color: (!matchedDone && rows.length > 0) ? '#3577f1' : '#878a99',
              border: (!matchedDone && rows.length > 0) ? '1px solid rgba(53, 119, 241, 0.25)' : '1px solid #e9ebec',
            }}
          >
            {matchedDone ? '0 Data (Selesai)' : `${rows.length.toLocaleString('id-ID')} Data`}
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
          <span>Rekomendasi Data</span>
          <span
            style={{
              padding: '0.12rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 600,
              background: (matchedDone && (recommendations.length > 0 || unmatchedRows.length > 0)) ? 'rgba(247, 184, 75, 0.15)' : '#f3f3f9',
              color: (matchedDone && (recommendations.length > 0 || unmatchedRows.length > 0)) ? '#d97706' : '#878a99',
              border: (matchedDone && (recommendations.length > 0 || unmatchedRows.length > 0)) ? '1px solid rgba(247, 184, 75, 0.3)' : '1px solid #e9ebec',
            }}
          >
            {!matchedDone
              ? '0 Rekomendasi'
              : recommendations.length > 0
              ? `${recommendations.length.toLocaleString('id-ID')} Rekomendasi`
              : unmatchedRows.length > 0
              ? `${unmatchedRows.length.toLocaleString('id-ID')} Belum Cocok`
              : '0 Rekomendasi'}
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
          <span>Data Match</span>
          <span
            style={{
              padding: '0.12rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 600,
              background: (matchedDone && matchedRows.length > 0) ? 'rgba(10, 179, 156, 0.12)' : '#f3f3f9',
              color: (matchedDone && matchedRows.length > 0) ? '#0ab39c' : '#878a99',
              border: (matchedDone && matchedRows.length > 0) ? '1px solid rgba(10, 179, 156, 0.25)' : '1px solid #e9ebec',
            }}
          >
            {!matchedDone ? '0 Match' : `${matchedRows.length.toLocaleString('id-ID')} Match`}
          </span>
        </button>
      </div>

      {/* Filter & Search Toolbar (Integrated inside Card) */}
      {!(
        (checkerTab === 'upload' && matchedDone) ||
        (!matchedDone && (checkerTab === 'recommendation' || checkerTab === 'matched'))
      ) && (
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
          {/* Action button in Tab 1: PENCOCOKAN */}
          {checkerTab === 'upload' && !matchedDone && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onExecuteMatching}
              disabled={!canExecute || isProcessing}
              id="btn-mulai-pencocokan"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.78rem',
                padding: '0.35rem 0.95rem',
              }}
            >
              {isProcessing ? (
                <>
                  <RotateCcw size={14} className="pulse-dot" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  <span>Pencocokan</span>
                </>
              )}
            </button>
          )}

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

          {/* Tombol Panduan Skor di Samping Button Setuju */}
          {checkerTab === 'recommendation' && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIsGuideModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                padding: '0.32rem 0.75rem',
                color: '#d97706',
                borderColor: 'rgba(247, 184, 75, 0.45)',
                background: '#fffdf5',
              }}
              id="btn-panduan-skor"
              title="Buka panduan sederhana cara sistem menghitung skor kedekatan cabang"
            >
              <HelpCircle size={14} />
              <span>Panduan Skor</span>
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
      )}

      {/* =========================================================================
          TAB CONTENT RENDERING
          ========================================================================= */}

      {/* TAB 2: REKOMENDASI DATA (SMART PROXIMITY SUGGESTIONS) */}
      {checkerTab === 'recommendation' ? (
        !matchedDone ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3.8rem 1.5rem',
              background: '#ffffff',
              borderRadius: '6px',
              border: '1px solid #e9ebec',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(247, 184, 75, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.85rem',
              }}
            >
              <Sparkles size={24} color="#d97706" />
            </div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#212529', margin: '0 0 0.35rem' }}>
              Belum Ada Rekomendasi Data
            </h4>
            <p style={{ fontSize: '0.78rem', color: '#878a99', margin: '0 auto 1.25rem', maxWidth: '440px' }}>
              Pencocokan data belum dijalankan. Silakan buka tab <strong>Data Upload</strong> dan klik tombol <strong>"Pencocokan"</strong> untuk menganalisa data target.
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setCheckerTab('upload');
                setPage(1);
              }}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.95rem' }}
            >
              Buka Tab Data Upload
            </button>
          </div>
        ) : isComputingRecs ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3.5rem 1.5rem',
              background: '#ffffff',
              borderRadius: '6px',
              border: '1px solid #e9ebec',
            }}
          >
            <RotateCcw size={28} className="pulse-dot" color="#3577f1" style={{ margin: '0 auto 0.85rem' }} />
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#212529', margin: '0 0 0.35rem' }}>
              Menganalisis Rekomendasi Cabang Terdekat...
            </h4>
            <p style={{ fontSize: '0.78rem', color: '#878a99', margin: 0 }}>
              Mencocokkan {unmatchedRows.length.toLocaleString('id-ID')} data dengan indeks wilayah & kode pos
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto' }}>
          <table className="modern-table" style={{ width: '100%', minWidth: '1050px' }}>
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center', background: '#f3f6f9', color: '#405189' }}>No</th>
                <th style={{ minWidth: '380px', background: '#fff9f0', color: '#d97706' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span>Kandidat Rekomendasi Master (Top 2–3 Pilihan Terdekat)</span>
                    <div
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.72rem' }}
                      onClick={() => setIsGuideModalOpen(true)}
                      title="Klik untuk melihat penjelasan cara hitung skor"
                    >
                      <HelpCircle size={13} color="#d97706" />
                      <span>Panduan Skor</span>
                    </div>
                  </div>
                </th>
                {/* Data Target Asli (Wilayah Target Dihapus sesuai permintaan user) */}
                <th style={{ color: '#878a99', minWidth: '95px' }}>KODE POS Target</th>
                <th style={{ color: '#878a99', minWidth: '120px' }}>Kecamatan Target</th>
                <th style={{ color: '#878a99', minWidth: '120px' }}>Kelurahan Target</th>
                <th style={{ color: '#878a99', minWidth: '120px' }}>Dati II Target</th>
                <th style={{ minWidth: '240px', color: '#878a99' }}>ALAMAT Target</th>
                <th style={{ minWidth: '110px' }}>Provinsi Target</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                    Tidak ada rekomendasi yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                paginatedRecs.map((rec, idx) => {
                  const r = rec.targetRow;
                  const candidates = rec.candidates && rec.candidates.length > 0 ? rec.candidates : [
                    {
                      master: rec.recommendedMaster,
                      score: rec.score,
                      reason: rec.reason,
                      rank: 1,
                    }
                  ];
                  const globalIndex = (page - 1) * pageSize + idx + 1;

                  return (
                    <tr key={`rec-${r.No}-${idx}`} style={{ background: '#fffdfa', verticalAlign: 'top' }}>
                      <td className="code-cell" style={{ textAlign: 'center', color: '#878a99', fontWeight: 700, paddingTop: '0.85rem' }}>
                        {globalIndex}
                      </td>

                      {/* Multi-Kandidat Rekomendasi (Top 2 - 3 Opsi Asli Master) */}
                      <td style={{ background: '#fffdfa', padding: '0.65rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                          {candidates.map((cand) => {
                            const m = cand.master;
                            const isTop1 = cand.rank === 1;
                            const badgeBg = isTop1
                              ? 'rgba(10, 179, 156, 0.12)'
                              : cand.rank === 2
                              ? 'rgba(247, 184, 75, 0.15)'
                              : 'rgba(53, 119, 241, 0.1)';
                            const badgeColor = isTop1 ? '#0ab39c' : cand.rank === 2 ? '#d97706' : '#3577f1';
                            const cardBorder = isTop1 ? '1px solid rgba(10, 179, 156, 0.35)' : '1px solid #e9ebec';
                            const cardBg = isTop1 ? '#ffffff' : '#fafafa';

                            return (
                              <div
                                key={`cand-${cand.rank}-${m['Branch Code'] || m.Cabang}-${idx}`}
                                style={{
                                  border: cardBorder,
                                  borderRadius: '6px',
                                  padding: '0.6rem 0.75rem',
                                  background: cardBg,
                                  boxShadow: isTop1 ? '0 1px 3px rgba(10, 179, 156, 0.08)' : 'none',
                                }}
                              >
                                {/* Header Opsi: Badge Pilihan + Skor + Tombol Pilih */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '0.4rem',
                                    marginBottom: '0.35rem',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <span
                                      style={{
                                        padding: '0.12rem 0.5rem',
                                        borderRadius: '4px',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        background: badgeBg,
                                        color: badgeColor,
                                      }}
                                    >
                                      {isTop1 ? 'Pilihan 1 (Utama)' : `Pilihan ${cand.rank} (Alternatif)`}
                                    </span>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.2rem',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        color: badgeColor,
                                      }}
                                    >
                                      <Sparkles size={11} /> Skor {cand.score}%
                                    </span>
                                  </div>

                                  {/* Tombol Info (i) & Tombol Pilih Cabang Ini */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCandidateDetail({ targetRow: r, candidate: cand })}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '26px',
                                        height: '26px',
                                        borderRadius: '4px',
                                        border: '1px solid #ced4da',
                                        background: '#ffffff',
                                        color: '#405189',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        flexShrink: 0,
                                      }}
                                      title="Lihat alasan penilaian skor & detail wilayah"
                                    >
                                      <Info size={13} />
                                    </button>

                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      onClick={() => onApproveRecommendation(r.No, m)}
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '0.22rem 0.65rem',
                                        color: isTop1 ? '#0ab39c' : '#405189',
                                        borderColor: isTop1 ? 'rgba(10, 179, 156, 0.4)' : '#ced4da',
                                        background: isTop1 ? 'rgba(10, 179, 156, 0.06)' : '#ffffff',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                      }}
                                      title="Pilih dan setujui cabang master ini"
                                    >
                                      <Check size={12} /> Gunakan Cabang Ini
                                    </button>
                                  </div>
                                </div>

                                {/* Rincian Cabang Master & Alamat Lengkap Real (Clean & Compact) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem' }}>
                                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#212529' }}>
                                    {m['Sandi Cabang'] || m.Cabang || m.Sandi || '-'}
                                    {m['Nama Outlet'] && (
                                      <span style={{ fontSize: '0.76rem', color: '#405189', fontWeight: 500, marginLeft: '0.4rem' }}>
                                        • {m['Nama Outlet']}
                                      </span>
                                    )}
                                  </div>

                                  {/* Alamat Lengkap Master Asli (Clean & Ringkas) */}
                                  <div
                                    style={{
                                      fontSize: '0.74rem',
                                      color: '#343a40',
                                      background: '#f8f9fa',
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '4px',
                                      border: '1px solid #edf0f2',
                                      marginTop: '0.15rem',
                                      whiteSpace: 'normal',
                                      wordBreak: 'break-word',
                                      lineHeight: 1.35,
                                    }}
                                  >
                                    <span style={{ fontWeight: 600, color: '#6c757d' }}>Alamat Master: </span>
                                    {m.ALAMAT || <em style={{ color: '#adb5bd' }}>Alamat tidak terisi di master</em>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Data Target Asli (Wilayah Target Dihapus, Teks Alamat Tampil Utuh) */}
                      <td className="code-cell" style={{ color: '#f06548', fontWeight: 700, paddingTop: '0.85rem' }}>
                        {r['KODE POS']}
                      </td>
                      <td style={{ paddingTop: '0.85rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r.Kecamatan || '-'}
                      </td>
                      <td style={{ paddingTop: '0.85rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r.Kelurahan || '-'}
                      </td>
                      <td style={{ paddingTop: '0.85rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r['Dati II'] || '-'}
                      </td>
                      <td
                        style={{
                          paddingTop: '0.85rem',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          lineHeight: 1.4,
                          fontSize: '0.78rem',
                          color: '#212529',
                        }}
                      >
                        {r.ALAMAT || '-'}
                      </td>
                      <td style={{ paddingTop: '0.85rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r.Provinsi || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )
      ) : checkerTab === 'upload' && matchedDone ? (
        /* TAB 1: DATA SUDAH DI-ANALISA (POST-MATCHING STATE) */
        <div
          style={{
            textAlign: 'center',
            padding: '3.8rem 1.5rem',
            background: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #e9ebec',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(10, 179, 156, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.2rem',
            }}
          >
            <CheckCircle2 size={30} color="#0ab39c" />
          </div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#212529', margin: '0 0 0.45rem' }}>
            Data sudah di Analisa silahkan cek di tab selanjutnya
          </h4>
          <p style={{ fontSize: '0.82rem', color: '#878a99', margin: '0 auto 1.5rem', maxWidth: '480px' }}>
            Seluruh data target berhasil diproses dan dipindahkan. Silakan cek tab <strong>Rekomendasi Data</strong> untuk data yang perlu ditinjau atau <strong>Data Match</strong> untuk data yang telah cocok.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setCheckerTab('recommendation');
                setPage(1);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                padding: '0.45rem 1.1rem',
                color: '#d97706',
                borderColor: '#f7b84b',
                background: '#fffdf5',
              }}
            >
              <Sparkles size={15} />
              <span>Buka Rekomendasi Data ({unmatchedRows.length.toLocaleString('id-ID')})</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setCheckerTab('matched');
                setPage(1);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                padding: '0.45rem 1.1rem',
                background: '#0ab39c',
                borderColor: '#0ab39c',
              }}
            >
              <CheckCircle2 size={15} />
              <span>Buka Data Match ({matchedRows.length.toLocaleString('id-ID')})</span>
            </button>
          </div>
        </div>
      ) : checkerTab === 'matched' && !matchedDone ? (
        /* TAB 3: PRE-MATCHING STATE (BELUM DI-KLIK PENCOCOKAN) */
        <div
          style={{
            textAlign: 'center',
            padding: '3.8rem 1.5rem',
            background: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #e9ebec',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(10, 179, 156, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.85rem',
            }}
          >
            <CheckCircle2 size={24} color="#0ab39c" />
          </div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#212529', margin: '0 0 0.35rem' }}>
            Belum Ada Data Match
          </h4>
          <p style={{ fontSize: '0.78rem', color: '#878a99', margin: '0 auto 1.25rem', maxWidth: '440px' }}>
            Pencocokan data belum dijalankan. Silakan buka tab <strong>Data Upload</strong> dan klik tombol <strong>"Pencocokan"</strong> untuk menemukan data yang cocok dengan master.
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setCheckerTab('upload');
              setPage(1);
            }}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.95rem' }}
          >
            Buka Tab Data Upload
          </button>
        </div>
      ) : (
        /* TAB 1 (PRE-MATCHING) ATAU TAB 3 (POST-MATCHING) DATA GRID */
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
                {/* Kolom Target Asli (Sampai Provinsi & PTEN) */}
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
                  <td colSpan={18} style={{ textAlign: 'center', padding: '3rem', color: '#878a99' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      {checkerTab === 'upload' ? (
                        <>
                          <AlertTriangle size={32} color="#878a99" />
                          <strong style={{ color: '#212529', fontSize: '0.95rem' }}>
                            Belum Ada Data Upload Target
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: '#878a99' }}>
                            Silakan unggah berkas Excel target melalui tombol Upload Data Cek di atas.
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={32} color="#878a99" />
                          <strong style={{ color: '#212529', fontSize: '0.95rem' }}>
                            Tidak Ada Data Match yang Sesuai
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: '#878a99' }}>
                            Tidak ditemukan data match yang sesuai dengan filter pencarian saat ini.
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
                      <td style={{ minWidth: '220px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4 }} title={r.ALAMAT}>
                        {r.ALAMAT || <span style={{ color: '#878a99' }}>-</span>}
                      </td>

                      {/* Target Data Asli (Sampai Provinsi & PTEN) */}
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
      {!(
        (checkerTab === 'upload' && matchedDone) ||
        (!matchedDone && (checkerTab === 'recommendation' || checkerTab === 'matched'))
      ) && (
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
      )}

      {/* Modal Panduan Skor Kedekatan untuk Pengguna Awam */}
      <ProximityGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />

      {/* Modal Detail Rekomendasi & Alasan Penilaian Skor */}
      <CandidateDetailModal
        isOpen={Boolean(selectedCandidateDetail)}
        onClose={() => setSelectedCandidateDetail(null)}
        data={selectedCandidateDetail}
        onApprove={onApproveRecommendation}
      />
    </div>
  );
};
