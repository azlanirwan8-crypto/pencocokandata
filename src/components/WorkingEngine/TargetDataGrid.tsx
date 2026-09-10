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
  Eye,
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
  const [pageSize, setPageSize] = useState<number | 'all'>(15);
  const effectivePageSize = useMemo(() => (pageSize === 'all' ? 999999 : pageSize), [pageSize]);

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
  const [activeCandidateByRow, setActiveCandidateByRow] = useState<Record<string | number, number>>({});

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
    if (pageSize === 'all') return 1;
    const totalItems = checkerTab === 'recommendation' ? currentTabRecs.length : currentTabRows.length;
    return Math.ceil(totalItems / effectivePageSize) || 1;
  }, [checkerTab, currentTabRecs.length, currentTabRows.length, pageSize, effectivePageSize]);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return currentTabRows;
    const start = (page - 1) * effectivePageSize;
    return currentTabRows.slice(start, start + effectivePageSize);
  }, [currentTabRows, page, pageSize, effectivePageSize]);

  const paginatedRecs = useMemo(() => {
    if (pageSize === 'all') return currentTabRecs;
    const start = (page - 1) * effectivePageSize;
    return currentTabRecs.slice(start, start + effectivePageSize);
  }, [currentTabRecs, page, pageSize, effectivePageSize]);

  const hasCombinedSandiCabang = rows.some((r) => r['Sandi Cabang'] && (!r.Sandi || r.Sandi === r['Sandi Cabang']));

  const handleApproveAll = () => {
    if (recommendations.length === 0) return;
    const effectiveRecs = recommendations.map((rec) => {
      const activeRank = activeCandidateByRow[rec.targetRow.No];
      if (activeRank && rec.candidates) {
        const chosen = rec.candidates.find((c) => c.rank === activeRank);
        if (chosen) {
          return {
            ...rec,
            recommendedMaster: chosen.master,
            score: chosen.score,
            reason: chosen.reason,
          };
        }
      }
      return rec;
    });
    onApproveAllRecommendations(effectiveRecs);
    setRecommendations([]);
    // Pindah langsung ke Tab 3 (Data Match)
    setCheckerTab('matched');
    setPage(1);
  };

  return (
    <div className="glass-card" style={{ marginTop: '0.65rem', padding: '0.75rem 1.1rem' }}>
      {/* Top Header: Title & Matching Execution Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.65rem',
          marginBottom: '0.65rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '0.96rem', fontWeight: 600, color: '#212529', letterSpacing: '-0.01em' }}>
            Pratinjau & Manajemen Data Target
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#878a99', marginTop: '0.1rem' }}>
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
          gap: '0.4rem',
          borderBottom: '1px solid #e9ebec',
          marginBottom: '0.75rem',
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
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            fontSize: '0.78rem',
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
          <Layers size={13} color={checkerTab === 'upload' ? '#3577f1' : '#878a99'} />
          <span>Data Upload</span>
          <span
            style={{
              padding: '0.08rem 0.42rem',
              borderRadius: '9999px',
              fontSize: '0.67rem',
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
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            fontSize: '0.78rem',
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
          <Sparkles size={13} color={checkerTab === 'recommendation' ? '#d97706' : '#878a99'} />
          <span>Rekomendasi Data</span>
          <span
            style={{
              padding: '0.08rem 0.42rem',
              borderRadius: '9999px',
              fontSize: '0.67rem',
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
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            fontSize: '0.78rem',
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
          <CheckCircle2 size={13} color={checkerTab === 'matched' ? '#0ab39c' : '#878a99'} />
          <span>Data Match</span>
          <span
            style={{
              padding: '0.08rem 0.42rem',
              borderRadius: '9999px',
              fontSize: '0.67rem',
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

          {/* Tombol Tampilkan Semua Data di Toolbar */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setPageSize((prev) => (prev === 'all' ? 15 : 'all'));
              setPage(1);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.78rem',
              padding: '0.32rem 0.75rem',
              color: pageSize === 'all' ? '#0ab39c' : '#405189',
              borderColor: pageSize === 'all' ? '#0ab39c' : '#ced4da',
              background: pageSize === 'all' ? 'rgba(10, 179, 156, 0.08)' : '#ffffff',
              fontWeight: 600,
            }}
            title="Tampilkan seluruh baris data tanpa batasan per halaman"
          >
            <Eye size={14} />
            <span>{pageSize === 'all' ? 'Mode Halaman (15 Baris)' : 'Tampilkan Semua Record'}</span>
          </button>
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
              padding: '1.75rem 1.25rem',
              background: '#ffffff',
              borderRadius: '6px',
              border: '1px solid #e9ebec',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(247, 184, 75, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.6rem',
              }}
            >
              <Sparkles size={20} color="#d97706" />
            </div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#212529', margin: '0 0 0.25rem' }}>
              Belum Ada Rekomendasi Data
            </h4>
            <p style={{ fontSize: '0.78rem', color: '#878a99', margin: '0 auto 0.85rem', maxWidth: '440px' }}>
              Pencocokan data belum dijalankan. Silakan buka tab <strong>Data Upload</strong> dan klik tombol <strong>"Pencocokan"</strong> untuk menganalisa data target.
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setCheckerTab('upload');
                setPage(1);
              }}
              style={{ fontSize: '0.76rem', padding: '0.3rem 0.85rem' }}
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
          <table className="modern-table" style={{ width: '100%', minWidth: '1200px', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th
                  style={{
                    width: '44px',
                    minWidth: '44px',
                    maxWidth: '44px',
                    textAlign: 'center',
                    background: '#f3f6f9',
                    color: '#405189',
                    position: 'sticky',
                    left: 0,
                    top: 0,
                    zIndex: 20,
                    borderRight: '1px solid #e9ebec',
                    borderBottom: '1px solid #e9ebec',
                  }}
                >
                  No
                </th>
                <th
                  style={{
                    minWidth: '385px',
                    maxWidth: '385px',
                    width: '385px',
                    background: '#fff9f0',
                    color: '#d97706',
                    position: 'sticky',
                    left: '44px',
                    top: 0,
                    zIndex: 20,
                    boxShadow: '3px 0 6px -2px rgba(0, 0, 0, 0.06)',
                    borderRight: '2px solid #f7b84b',
                    borderBottom: '1px solid #e9ebec',
                  }}
                >
                  Kandidat Rekomendasi Master (Top 2–3 Pilihan Terdekat)
                </th>
                {/* Data Target Asli (Wilayah Target Dihapus sesuai permintaan user) */}
                <th style={{ color: '#878a99', minWidth: '95px', borderBottom: '1px solid #e9ebec' }}>KODE POS Target</th>
                <th style={{ color: '#878a99', minWidth: '120px', borderBottom: '1px solid #e9ebec' }}>Kecamatan Target</th>
                <th style={{ color: '#878a99', minWidth: '120px', borderBottom: '1px solid #e9ebec' }}>Kelurahan Target</th>
                <th style={{ color: '#878a99', minWidth: '120px', borderBottom: '1px solid #e9ebec' }}>Dati II Target</th>
                <th style={{ minWidth: '240px', color: '#878a99', borderBottom: '1px solid #e9ebec' }}>ALAMAT Target</th>
                <th style={{ minWidth: '110px', borderBottom: '1px solid #e9ebec' }}>Provinsi Target</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#878a99' }}>
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
                  const globalIndex = pageSize === 'all' ? idx + 1 : (page - 1) * effectivePageSize + idx + 1;

                  return (
                    <tr key={`rec-${r.No}-${idx}`} style={{ background: '#fffdfa', verticalAlign: 'top' }}>
                      <td
                        className="code-cell"
                        style={{
                          textAlign: 'center',
                          color: '#878a99',
                          fontWeight: 700,
                          paddingTop: '0.6rem',
                          position: 'sticky',
                          left: 0,
                          zIndex: 5,
                          background: '#fffdfa',
                          borderRight: '1px solid #e9ebec',
                          borderBottom: '1px solid #e9ebec',
                        }}
                      >
                        {globalIndex}
                      </td>

                      {/* Multi-Kandidat Rekomendasi (Top 2 - 3 Opsi Asli Master dengan Segmented Pill Toggle) - FROZEN / STICKY */}
                      <td
                        style={{
                          background: '#fffdfa',
                          padding: '0.45rem 0.55rem',
                          position: 'sticky',
                          left: '44px',
                          zIndex: 5,
                          boxShadow: '3px 0 6px -2px rgba(0, 0, 0, 0.06)',
                          borderRight: '2px solid rgba(247, 184, 75, 0.45)',
                          borderBottom: '1px solid #e9ebec',
                          minWidth: '385px',
                          maxWidth: '385px',
                          width: '385px',
                        }}
                      >
                        {(() => {
                          const activeRank = activeCandidateByRow[r.No] || 1;
                          const activeCand = candidates.find((c) => c.rank === activeRank) || candidates[0];
                          const m = activeCand.master;
                          const isTop1 = activeCand.rank === 1;

                          const badgeBg = isTop1
                            ? 'rgba(10, 179, 156, 0.12)'
                            : activeCand.rank === 2
                            ? 'rgba(247, 184, 75, 0.15)'
                            : 'rgba(53, 119, 241, 0.1)';
                          const badgeColor = isTop1 ? '#0ab39c' : activeCand.rank === 2 ? '#d97706' : '#3577f1';
                          const cardBorder = isTop1 ? '1px solid rgba(10, 179, 156, 0.35)' : '1px solid #e9ebec';
                          const cardBg = isTop1 ? '#ffffff' : '#fafafa';

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              {/* Horizontal Segmented Pill Selector jika ada lebih dari 1 opsi */}
                              {candidates.length > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.1rem' }}>
                                  <span style={{ fontSize: '0.68rem', color: '#878a99', fontWeight: 600, marginRight: '0.1rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    Opsi:
                                  </span>
                                  {candidates.map((cand) => {
                                    const isSelected = cand.rank === activeCand.rank;
                                    const pillActiveBg = cand.rank === 1 ? '#0ab39c' : cand.rank === 2 ? '#d97706' : '#3577f1';

                                    return (
                                      <button
                                        key={`pill-${r.No}-${cand.rank}`}
                                        type="button"
                                        onClick={() => setActiveCandidateByRow((prev) => ({ ...prev, [r.No]: cand.rank }))}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          padding: '0.15rem 0.45rem',
                                          borderRadius: '9999px',
                                          fontSize: '0.7rem',
                                          fontWeight: isSelected ? 700 : 500,
                                          background: isSelected ? pillActiveBg : '#f3f6f9',
                                          color: isSelected ? '#ffffff' : '#495057',
                                          border: isSelected ? `1px solid ${pillActiveBg}` : '1px solid #e9ebec',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease',
                                          flexShrink: 0,
                                          whiteSpace: 'nowrap',
                                        }}
                                        title={`Klik untuk melihat Pilihan ${cand.rank} (${cand.score}%)`}
                                      >
                                        <span>{cand.rank === 1 ? 'Pilihan 1' : `Pilihan ${cand.rank}`}</span>
                                        <span
                                          style={{
                                            fontSize: '0.65rem',
                                            padding: '0.05rem 0.3rem',
                                            borderRadius: '9999px',
                                            background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                                            color: isSelected ? '#ffffff' : '#6c757d',
                                            fontWeight: 700,
                                          }}
                                        >
                                          {cand.score}%
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Single Active Candidate Card */}
                              <div
                                style={{
                                  border: cardBorder,
                                  borderRadius: '6px',
                                  padding: '0.42rem 0.62rem',
                                  background: cardBg,
                                  boxShadow: isTop1 ? '0 1px 2px rgba(10, 179, 156, 0.08)' : 'none',
                                }}
                              >
                                {/* Header Opsi: Badge Pilihan + Skor + Tombol (i) & Tombol Pilih Cabang Ini (WAJIB 1 BARIS) */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'nowrap',
                                    gap: '0.4rem',
                                    marginBottom: '0.25rem',
                                    width: '100%',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    <span
                                      style={{
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '3px',
                                        fontSize: '0.68rem',
                                        fontWeight: 700,
                                        background: badgeBg,
                                        color: badgeColor,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {isTop1 ? 'Pilihan 1 (Utama)' : `Pilihan ${activeCand.rank} (Alternatif)`}
                                    </span>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.18rem',
                                        fontSize: '0.68rem',
                                        fontWeight: 600,
                                        color: badgeColor,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      <Sparkles size={10} /> Skor {activeCand.score}%
                                    </span>
                                  </div>

                                  {/* Tombol Info (i) & Tombol Pilih Cabang Ini */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCandidateDetail({ targetRow: r, candidate: activeCand })}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '4px',
                                        border: isTop1
                                          ? '1px solid rgba(10, 179, 156, 0.4)'
                                          : activeCand.rank === 2
                                          ? '1px solid rgba(217, 119, 6, 0.4)'
                                          : '1px solid rgba(53, 119, 241, 0.4)',
                                        background: isTop1
                                          ? 'rgba(10, 179, 156, 0.05)'
                                          : activeCand.rank === 2
                                          ? 'rgba(217, 119, 6, 0.05)'
                                          : 'rgba(53, 119, 241, 0.05)',
                                        color: badgeColor,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        flexShrink: 0,
                                      }}
                                      title="Lihat alasan penilaian skor & detail wilayah"
                                    >
                                      <Info size={12} />
                                    </button>

                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      onClick={() => onApproveRecommendation(r.No, m)}
                                      style={{
                                        fontSize: '0.7rem',
                                        padding: '0.18rem 0.55rem',
                                        color: badgeColor,
                                        borderColor: isTop1
                                          ? 'rgba(10, 179, 156, 0.45)'
                                          : activeCand.rank === 2
                                          ? 'rgba(217, 119, 6, 0.45)'
                                          : 'rgba(53, 119, 241, 0.45)',
                                        background: isTop1
                                          ? 'rgba(10, 179, 156, 0.08)'
                                          : activeCand.rank === 2
                                          ? 'rgba(217, 119, 6, 0.08)'
                                          : 'rgba(53, 119, 241, 0.08)',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                      }}
                                      title="Pilih dan setujui cabang master ini"
                                    >
                                      <Check size={11} /> Gunakan Cabang Ini
                                    </button>
                                  </div>
                                </div>

                                {/* Rincian Cabang Master & Alamat Lengkap Real */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
                                  <div style={{ fontSize: '0.81rem', fontWeight: 600, color: '#212529' }}>
                                    {m['Sandi Cabang'] || m.Cabang || m.Sandi || '-'}
                                    {m['Nama Outlet'] && (
                                      <span style={{ fontSize: '0.73rem', color: '#405189', fontWeight: 500, marginLeft: '0.35rem' }}>
                                        • {m['Nama Outlet']}
                                      </span>
                                    )}
                                  </div>

                                  {/* Alamat Lengkap Master Asli (Clean & Ringkas) */}
                                  <div
                                    style={{
                                      fontSize: '0.71rem',
                                      color: '#343a40',
                                      background: '#f8f9fa',
                                      padding: '0.18rem 0.45rem',
                                      borderRadius: '4px',
                                      border: '1px solid #edf0f2',
                                      marginTop: '0.12rem',
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
                            </div>
                          );
                        })()}
                      </td>

                      {/* Data Target Asli (Wilayah Target Dihapus, Teks Alamat Tampil Utuh) */}
                      <td className="code-cell" style={{ color: '#f06548', fontWeight: 700, paddingTop: '0.55rem' }}>
                        {r['KODE POS']}
                      </td>
                      <td style={{ paddingTop: '0.55rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r.Kecamatan || '-'}
                      </td>
                      <td style={{ paddingTop: '0.55rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r.Kelurahan || '-'}
                      </td>
                      <td style={{ paddingTop: '0.55rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r['Dati II'] || '-'}
                      </td>
                      <td
                        style={{
                          paddingTop: '0.55rem',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          lineHeight: 1.35,
                          fontSize: '0.75rem',
                          color: '#212529',
                        }}
                      >
                        {r.ALAMAT || '-'}
                      </td>
                      <td style={{ paddingTop: '0.55rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
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
            padding: '1.75rem 1.25rem',
            background: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #e9ebec',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(10, 179, 156, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.65rem',
            }}
          >
            <CheckCircle2 size={24} color="#0ab39c" />
          </div>
          <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#212529', margin: '0 0 0.25rem' }}>
            Data sudah di Analisa silahkan cek di tab selanjutnya
          </h4>
          <p style={{ fontSize: '0.8rem', color: '#878a99', margin: '0 auto 1rem', maxWidth: '480px' }}>
            Seluruh data target berhasil diproses dan dipindahkan. Silakan cek tab <strong>Rekomendasi Data</strong> untuk data yang perlu ditinjau atau <strong>Data Match</strong> untuk data yang telah cocok.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
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
                gap: '0.35rem',
                fontSize: '0.78rem',
                padding: '0.35rem 0.95rem',
                color: '#d97706',
                borderColor: '#f7b84b',
                background: '#fffdf5',
              }}
            >
              <Sparkles size={14} />
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
                gap: '0.35rem',
                fontSize: '0.78rem',
                padding: '0.35rem 0.95rem',
                background: '#0ab39c',
                borderColor: '#0ab39c',
              }}
            >
              <CheckCircle2 size={14} />
              <span>Buka Data Match ({matchedRows.length.toLocaleString('id-ID')})</span>
            </button>
          </div>
        </div>
      ) : checkerTab === 'matched' && !matchedDone ? (
        /* TAB 3: PRE-MATCHING STATE (BELUM DI-KLIK PENCOCOKAN) */
        <div
          style={{
            textAlign: 'center',
            padding: '1.75rem 1.25rem',
            background: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #e9ebec',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(10, 179, 156, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.6rem',
            }}
          >
            <CheckCircle2 size={20} color="#0ab39c" />
          </div>
          <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#212529', margin: '0 0 0.25rem' }}>
            Belum Ada Data Match
          </h4>
          <p style={{ fontSize: '0.78rem', color: '#878a99', margin: '0 auto 0.85rem', maxWidth: '440px' }}>
            Pencocokan data belum dijalankan. Silakan buka tab <strong>Data Upload</strong> dan klik tombol <strong>"Pencocokan"</strong> untuk menemukan data yang cocok dengan master.
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setCheckerTab('upload');
              setPage(1);
            }}
            style={{ fontSize: '0.76rem', padding: '0.3rem 0.85rem' }}
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
        <div className="pagination-row" style={{ marginTop: '0.75rem', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Info Jumlah Data & Pilihan Tampilkan Semua Data */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
              Menampilkan{' '}
              {pageSize === 'all'
                ? `Semua ${checkerTab === 'recommendation' ? currentTabRecs.length.toLocaleString('id-ID') : currentTabRows.length.toLocaleString('id-ID')} data`
                : checkerTab === 'recommendation'
                ? `${(page - 1) * effectivePageSize + 1} - ${Math.min(page * effectivePageSize, currentTabRecs.length)} dari ${currentTabRecs.length.toLocaleString('id-ID')} rekomendasi`
                : `${(page - 1) * effectivePageSize + 1} - ${Math.min(page * effectivePageSize, currentTabRows.length)} dari ${currentTabRows.length.toLocaleString('id-ID')} baris`}
            </div>

            {/* Dropdown Pilihan Jumlah Data / Tampilkan Semua Data */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#495057' }}>
              <span>Tampilkan:</span>
              <select
                value={String(pageSize)}
                onChange={(e) => {
                  const val = e.target.value;
                  setPageSize(val === 'all' ? 'all' : Number(val));
                  setPage(1);
                }}
                style={{
                  padding: '0.22rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #ced4da',
                  background: '#ffffff',
                  fontSize: '0.76rem',
                  color: '#495057',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="15">15 per halaman</option>
                <option value="25">25 per halaman</option>
                <option value="50">50 per halaman</option>
                <option value="100">100 per halaman</option>
                <option value="all">Semua Data (Tampilkan Semua)</option>
              </select>
            </div>
          </div>

          {/* Tombol Navigasi Pagination */}
          {pageSize !== 'all' && totalPages > 1 && (
            <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setPageSize('all');
                  setPage(1);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  padding: '0.24rem 0.65rem',
                  color: '#405189',
                  borderColor: '#ced4da',
                  background: '#ffffff',
                  fontWeight: 600,
                  marginLeft: '0.5rem',
                }}
                title="Tampilkan seluruh data tanpa batasan per halaman"
              >
                <Eye size={13} />
                <span>Tampilkan Semua Record</span>
              </button>
            </div>
          )}

          {pageSize === 'all' && (
            <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setPageSize(15);
                  setPage(1);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  padding: '0.24rem 0.65rem',
                  color: '#405189',
                  borderColor: '#ced4da',
                  background: '#ffffff',
                  fontWeight: 600,
                }}
              >
                <ChevronLeft size={13} />
                <span>Kembali ke Mode Paginasi (15 per Hal)</span>
              </button>
            </div>
          )}
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
