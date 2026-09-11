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
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react';
import type { TargetRow, MasterRow } from '../../types';
import {
  generateRecommendationsProgressive,
  buildMasterProximityIndex,
  type RecommendationResult,
  type CandidateOption,
} from '../../utils/recommender';
import { ProximityGuideModal } from './ProximityGuideModal';
import { CandidateDetailModal } from './CandidateDetailModal';
import { formatWilayahName } from '../../utils/normalizer';

export interface ColumnOption {
  key: string;
  label: string;
}

export const TOGGLEABLE_COLUMNS: ColumnOption[] = [
  { key: 'Branch Code', label: 'Branch Code' },
  { key: 'Kode Cabang', label: 'Kode Cabang' },
  { key: 'Nama Outlet', label: 'Nama Outlet' },
  { key: 'Status Outlet', label: 'Status Outlet' },
  { key: 'ALAMAT', label: 'ALAMAT Master' },
  { key: 'KODE POS', label: 'KODE POS Target' },
  { key: 'Kelurahan', label: 'Kelurahan Target' },
  { key: 'Kecamatan', label: 'Kecamatan Target' },
  { key: 'Dati II', label: 'Dati II Target' },
  { key: 'Kode Dati II', label: 'Kode Dati II Target' },
  { key: 'Provinsi', label: 'Provinsi Target' },
];

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
  onRevertRecommendation?: (rowNo: number | string) => void;
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
  onRevertRecommendation,
  isProcessing,
  canExecute,
  matchedDone = false,
}) => {
  // 3 Sub-Tabs State: 'upload' | 'recommendation' | 'matched'
  const [checkerTab, setCheckerTab] = useState<'upload' | 'recommendation' | 'matched'>('upload');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(15);
  const effectivePageSize = useMemo(() => (pageSize === 'all' ? 999999 : pageSize), [pageSize]);

  // Multi-Selection State for Recommendations Tab
  const [selectedRowNos, setSelectedRowNos] = useState<Set<string | number>>(new Set());

  // Column Visibility Toggle State (with localStorage persistence)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('target_grid_hidden_cols');
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
  });
  const [isColDropdownOpen, setIsColDropdownOpen] = useState<boolean>(false);

  const toggleCol = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem('target_grid_hidden_cols', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Reset multi-select when switching tabs, filtering wilayah, or searching
  useEffect(() => {
    setSelectedRowNos(new Set());
  }, [checkerTab, searchTerm, selectedWilayah]);

  // Helper to determine if a row is clean / matched
  const isRowMatched = (r: TargetRow) => Boolean(r._isMatched) || Boolean(r.Sandi) || Boolean(r['Sandi Cabang']);

  // Tab 3: Data Match (Data Bersih yang sudah cocok) - SELALU TERSEDIA jika ada data matched, tidak hilang saat upload baru
  const matchedRows = useMemo(() => {
    return rows.filter(isRowMatched);
  }, [rows]);

  // Tab 2: Unmatched (Data yang sudah dianalisa tetapi belum cocok -> masuk rekomendasi)
  const unmatchedRows = useMemo(() => {
    return rows.filter((r) => !isRowMatched(r) && r._matchLevel === 'none');
  }, [rows]);

  // Tab 1: Data Upload (Data baru hasil upload yang masih menunggu pencocokan)
  const pendingUploadRows = useMemo(() => {
    return rows.filter((r) => !isRowMatched(r) && r._matchLevel !== 'none');
  }, [rows]);

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

  // Trigger recommendation calculation ONLY when Tab 2 is active and there are unmatched rows
  useEffect(() => {
    if (checkerTab !== 'recommendation') {
      setRecommendations([]);
      return;
    }
    if (unmatchedRows.length === 0 || masterRows.length === 0) {
      setRecommendations([]);
      return;
    }

    setIsComputingRecs(true);
    const cancelProgressive = generateRecommendationsProgressive(
      unmatchedRows,
      masterRows,
      masterProximityIndex,
      (recs) => {
        setRecommendations(recs);
        if (recs.length >= unmatchedRows.length) {
          setIsComputingRecs(false);
        }
      },
      25,
      100
    );

    return () => {
      cancelProgressive();
    };
  }, [checkerTab, unmatchedRows, masterRows, masterProximityIndex]);

  // Determine current dataset based on active tab
  const currentTabRows = useMemo(() => {
    if (checkerTab === 'upload') {
      return pendingUploadRows;
    }
    if (checkerTab === 'matched') {
      return matchedRows;
    }
    return []; // For recommendation tab, we use `recommendations` list directly
  }, [checkerTab, pendingUploadRows, matchedRows]);

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

  // Cek apakah seluruh baris rekomendasi di halaman saat ini sudah dicentang
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedRecs.length === 0) return false;
    return paginatedRecs.every((rec) => selectedRowNos.has(rec.targetRow.No));
  }, [paginatedRecs, selectedRowNos]);

  // Toggle centang semua di halaman saat ini
  const toggleSelectAllCurrentPage = () => {
    setSelectedRowNos((prev) => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        paginatedRecs.forEach((rec) => next.delete(rec.targetRow.No));
      } else {
        paginatedRecs.forEach((rec) => next.add(rec.targetRow.No));
      }
      return next;
    });
  };

  // Toggle centang satu baris
  const toggleSelectRow = (no: string | number) => {
    setSelectedRowNos((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  // Setujui Rekomendasi Terpilih (Batch Selected Approval)
  const handleApproveSelected = () => {
    if (selectedRowNos.size === 0) return;
    const selectedRecs: RecommendationResult[] = [];
    recommendations.forEach((rec) => {
      if (selectedRowNos.has(rec.targetRow.No)) {
        const activeRank = activeCandidateByRow[rec.targetRow.No];
        if (activeRank && rec.candidates) {
          const chosen = rec.candidates.find((c) => c.rank === activeRank);
          if (chosen) {
            selectedRecs.push({
              ...rec,
              recommendedMaster: chosen.master,
              score: chosen.score,
              reason: chosen.reason,
            });
            return;
          }
        }
        selectedRecs.push(rec);
      }
    });

    onApproveAllRecommendations(selectedRecs);
    setSelectedRowNos(new Set());
    if (selectedRecs.length === recommendations.length) {
      setCheckerTab('matched');
      setPage(1);
    }
  };

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
    setSelectedRowNos(new Set());
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
            {pendingUploadRows.length > 0
              ? `${pendingUploadRows.length.toLocaleString('id-ID')} baris data target baru menunggu pencocokan • ${matchedRows.length.toLocaleString('id-ID')} Data Match (Bersih) tersimpan`
              : `Analisis selesai • ${matchedRows.length.toLocaleString('id-ID')} Data Match (Bersih) • ${unmatchedRows.length.toLocaleString('id-ID')} Rekomendasi Data`}
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
              background: pendingUploadRows.length > 0 ? 'rgba(53, 119, 241, 0.1)' : '#f3f3f9',
              color: pendingUploadRows.length > 0 ? '#3577f1' : '#878a99',
              border: pendingUploadRows.length > 0 ? '1px solid rgba(53, 119, 241, 0.25)' : '1px solid #e9ebec',
            }}
          >
            {pendingUploadRows.length === 0 ? '0 Data (Selesai)' : `${pendingUploadRows.length.toLocaleString('id-ID')} Data`}
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
              background: (recommendations.length > 0 || unmatchedRows.length > 0) ? 'rgba(247, 184, 75, 0.15)' : '#f3f3f9',
              color: (recommendations.length > 0 || unmatchedRows.length > 0) ? '#d97706' : '#878a99',
              border: (recommendations.length > 0 || unmatchedRows.length > 0) ? '1px solid rgba(247, 184, 75, 0.3)' : '1px solid #e9ebec',
            }}
          >
            {recommendations.length > 0
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
              background: matchedRows.length > 0 ? 'rgba(10, 179, 156, 0.12)' : '#f3f3f9',
              color: matchedRows.length > 0 ? '#0ab39c' : '#878a99',
              border: matchedRows.length > 0 ? '1px solid rgba(10, 179, 156, 0.25)' : '1px solid #e9ebec',
            }}
          >
            {matchedRows.length > 0 ? `${matchedRows.length.toLocaleString('id-ID')} Match` : '0 Match'}
          </span>
        </button>
      </div>

      {/* Filter & Search Toolbar (Integrated inside Card) */}
      {!(
        (checkerTab === 'upload' && pendingUploadRows.length === 0) ||
        (checkerTab === 'recommendation' && unmatchedRows.length === 0 && recommendations.length === 0) ||
        (checkerTab === 'matched' && matchedRows.length === 0)
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
          {checkerTab === 'upload' && pendingUploadRows.length > 0 && (
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
                  {formatWilayahName(w)}
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

          {/* Action button in Tab 2: SETUJUI BARIS TERPILIH */}
          {checkerTab === 'recommendation' && selectedRowNos.size > 0 && (
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={handleApproveSelected}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                padding: '0.32rem 0.85rem',
                background: '#0ab39c',
                borderColor: '#0ab39c',
                fontWeight: 600,
              }}
              id="btn-setujui-terpilih"
            >
              <Check size={14} />
              <span>Setujui {selectedRowNos.size} Baris Terpilih</span>
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

          {/* Dropdown Visibilitas Kolom */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIsColDropdownOpen(!isColDropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                padding: '0.32rem 0.75rem',
                color: '#495057',
                borderColor: '#ced4da',
                background: isColDropdownOpen ? '#f3f6f9' : '#ffffff',
                fontWeight: 500,
              }}
              id="btn-toggle-columns"
              title="Pilih kolom yang ingin ditampilkan atau disembunyikan"
            >
              <SlidersHorizontal size={13} />
              <span>
                Kolom {hiddenCols.size > 0 ? `(${TOGGLEABLE_COLUMNS.length - hiddenCols.size}/${TOGGLEABLE_COLUMNS.length})` : ''}
              </span>
            </button>

            {isColDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '0.35rem',
                  background: '#ffffff',
                  border: '1px solid #e9ebec',
                  borderRadius: '6px',
                  boxShadow: '0 5px 15px rgba(0, 0, 0, 0.12)',
                  zIndex: 50,
                  minWidth: '210px',
                  padding: '0.5rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '0.35rem',
                    borderBottom: '1px solid #f3f6f9',
                    marginBottom: '0.35rem',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#495057' }}>Visibilitas Kolom</span>
                  <button
                    type="button"
                    onClick={() => {
                      setHiddenCols(new Set());
                      localStorage.removeItem('target_grid_hidden_cols');
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '0.68rem',
                      color: '#3577f1',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Reset Semua
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '220px', overflowY: 'auto' }}>
                  {TOGGLEABLE_COLUMNS.map((col) => (
                    <label
                      key={col.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontSize: '0.74rem',
                        color: '#495057',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenCols.has(col.key)}
                        onChange={() => toggleCol(col.key)}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
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
        (unmatchedRows.length === 0 && recommendations.length === 0) ? (
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
              {pendingUploadRows.length > 0
                ? 'Ada data baru di tab Data Upload yang belum dijalankan pencocokan.'
                : 'Semua data target telah berhasil dicocokkan ke master data.'}
            </p>
            {pendingUploadRows.length > 0 && (
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
            )}
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
                    width: '36px',
                    minWidth: '36px',
                    maxWidth: '36px',
                    textAlign: 'center',
                    background: '#f3f6f9',
                    position: 'sticky',
                    left: 0,
                    top: 0,
                    zIndex: 21,
                    borderRight: '1px solid #e9ebec',
                    borderBottom: '1px solid #e9ebec',
                  }}
                  title="Pilih / Batalkan Semua di Halaman Ini"
                >
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={toggleSelectAllCurrentPage}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th
                  style={{
                    width: '44px',
                    minWidth: '44px',
                    maxWidth: '44px',
                    textAlign: 'center',
                    background: '#f3f6f9',
                    color: '#405189',
                    position: 'sticky',
                    left: '36px',
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
                    minWidth: '420px',
                    maxWidth: '420px',
                    width: '420px',
                    background: '#fff9f0',
                    color: '#d97706',
                    position: 'sticky',
                    left: '80px',
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
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#878a99' }}>
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
                  const isRowChecked = selectedRowNos.has(r.No);

                  return (
                    <tr key={`rec-${r.No}-${idx}`} style={{ background: isRowChecked ? '#f0fdf4' : '#fffdfa', verticalAlign: 'top' }}>
                      <td
                        style={{
                          width: '36px',
                          minWidth: '36px',
                          maxWidth: '36px',
                          textAlign: 'center',
                          paddingTop: '0.65rem',
                          position: 'sticky',
                          left: 0,
                          zIndex: 6,
                          background: isRowChecked ? '#f0fdf4' : '#fffdfa',
                          borderRight: '1px solid #e9ebec',
                          borderBottom: '1px solid #e9ebec',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isRowChecked}
                          onChange={() => toggleSelectRow(r.No)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      <td
                        className="code-cell"
                        style={{
                          textAlign: 'center',
                          color: '#878a99',
                          fontWeight: 700,
                          paddingTop: '0.6rem',
                          position: 'sticky',
                          left: '36px',
                          zIndex: 5,
                          background: isRowChecked ? '#f0fdf4' : '#fffdfa',
                          borderRight: '1px solid #e9ebec',
                          borderBottom: '1px solid #e9ebec',
                        }}
                      >
                        {globalIndex}
                      </td>

                      {/* Multi-Kandidat Rekomendasi (Top 2 - 3 Opsi Asli Master dengan Segmented Pill Toggle) - FROZEN / STICKY */}
                      <td
                        style={{
                          background: isRowChecked ? '#f0fdf4' : '#fffdfa',
                          padding: '0.45rem 0.55rem',
                          position: 'sticky',
                          left: '80px',
                          zIndex: 5,
                          boxShadow: '3px 0 6px -2px rgba(0, 0, 0, 0.06)',
                          borderRight: '2px solid rgba(247, 184, 75, 0.45)',
                          borderBottom: '1px solid #e9ebec',
                          minWidth: '420px',
                          maxWidth: '420px',
                          width: '420px',
                          boxSizing: 'border-box',
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
                              {/* Indikator Audit Rekomendasi vs Pilihan yang Sudah Diisi di Excel */}
                              {rec.userPrefilledAudit && rec.userPrefilledAudit.hasPrefilled && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.2rem 0.45rem',
                                    borderRadius: '4px',
                                    fontSize: '0.68rem',
                                    fontWeight: 600,
                                    background:
                                      rec.userPrefilledAudit.status === 'match_top1'
                                        ? 'rgba(10, 179, 156, 0.08)'
                                        : rec.userPrefilledAudit.status === 'match_top2' || rec.userPrefilledAudit.status === 'match_top3'
                                        ? 'rgba(247, 184, 75, 0.12)'
                                        : 'rgba(53, 119, 241, 0.08)',
                                    color:
                                      rec.userPrefilledAudit.status === 'match_top1'
                                        ? '#07796a'
                                        : rec.userPrefilledAudit.status === 'match_top2' || rec.userPrefilledAudit.status === 'match_top3'
                                        ? '#925807'
                                        : '#2563eb',
                                    border:
                                      rec.userPrefilledAudit.status === 'match_top1'
                                        ? '1px solid rgba(10, 179, 156, 0.28)'
                                        : rec.userPrefilledAudit.status === 'match_top2' || rec.userPrefilledAudit.status === 'match_top3'
                                        ? '1px solid rgba(247, 184, 75, 0.35)'
                                        : '1px solid rgba(53, 119, 241, 0.25)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    boxSizing: 'border-box',
                                  }}
                                  title={`Di Excel terisi: "${rec.userPrefilledAudit.prefilledText}". ${rec.userPrefilledAudit.message}`}
                                >
                                  {rec.userPrefilledAudit.status === 'match_top1' ? (
                                    <CheckCircle2 size={12} color="#0ab39c" style={{ flexShrink: 0 }} />
                                  ) : rec.userPrefilledAudit.status === 'match_top2' || rec.userPrefilledAudit.status === 'match_top3' ? (
                                    <AlertTriangle size={12} color="#d97706" style={{ flexShrink: 0 }} />
                                  ) : (
                                    <Info size={12} color="#3577f1" style={{ flexShrink: 0 }} />
                                  )}
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    Di Excel: <strong>"{rec.userPrefilledAudit.prefilledText}"</strong> → {rec.userPrefilledAudit.message}
                                  </span>
                                </div>
                              )}

                              {/* Horizontal Segmented Pill Selector jika ada lebih dari 1 opsi */}
                              {candidates.length > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.1rem' }}>
                                  <span style={{ fontSize: '0.68rem', color: '#878a99', fontWeight: 600, marginRight: '0.1rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    Opsi:
                                  </span>
                                  {candidates.map((cand) => {
                                    const isSelected = cand.rank === activeCand.rank;
                                    const pillActiveBg = cand.rank === 1 ? '#0ab39c' : cand.rank === 2 ? '#d97706' : '#3577f1';
                                    const isUserChoice = rec.userPrefilledAudit?.matchedRank === cand.rank;

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
                                          border: isSelected ? `1px solid ${pillActiveBg}` : isUserChoice ? '1px dashed #d97706' : '1px solid #e9ebec',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease',
                                          flexShrink: 0,
                                          whiteSpace: 'nowrap',
                                        }}
                                        title={`Klik untuk melihat Pilihan ${cand.rank} (${cand.score}%)${isUserChoice ? ' - Ini cabang yang Anda isi di Excel' : ''}`}
                                      >
                                        <span>{cand.rank === 1 ? 'Pilihan 1' : `Pilihan ${cand.rank}`}</span>
                                        {isUserChoice && (
                                          <span
                                            style={{
                                              fontSize: '0.58rem',
                                              padding: '0.02rem 0.25rem',
                                              borderRadius: '3px',
                                              background: isSelected ? 'rgba(255,255,255,0.3)' : 'rgba(217, 119, 6, 0.15)',
                                              color: isSelected ? '#ffffff' : '#925807',
                                              fontWeight: 700,
                                            }}
                                          >
                                            Pilihan Anda
                                          </span>
                                        )}
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
                                  padding: '0.45rem 0.6rem',
                                  background: cardBg,
                                  boxShadow: isTop1 ? '0 1px 2px rgba(10, 179, 156, 0.08)' : 'none',
                                  overflow: 'hidden',
                                  boxSizing: 'border-box',
                                }}
                              >
                                {/* Header Opsi: Badge Pilihan + Skor + Jarak & Action Quick Links (Maps + Info) */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'nowrap',
                                    gap: '0.35rem',
                                    marginBottom: '0.3rem',
                                    width: '100%',
                                  }}
                                >
                                  {/* Kiri: Pilihan + Skor + Jarak Fisik */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    <span
                                      style={{
                                        padding: '0.1rem 0.38rem',
                                        borderRadius: '3px',
                                        fontSize: '0.67rem',
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
                                        gap: '0.15rem',
                                        fontSize: '0.67rem',
                                        fontWeight: 600,
                                        color: badgeColor,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      <Sparkles size={10} /> Skor {activeCand.score}%
                                    </span>
                                    {activeCand.formattedDistance && (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.15rem',
                                          fontSize: '0.67rem',
                                          fontWeight: 600,
                                          color: '#0d9488',
                                          background: 'rgba(13, 148, 136, 0.08)',
                                          padding: '0.08rem 0.32rem',
                                          borderRadius: '3px',
                                          whiteSpace: 'nowrap',
                                        }}
                                        title={`Estimasi jarak fisik: ${activeCand.formattedDistance} (${activeCand.distanceBasis || 'Jarak darat'})`}
                                      >
                                        <MapPin size={9} /> {activeCand.formattedDistance}
                                      </span>
                                    )}
                                  </div>

                                  {/* Kanan: Tombol Maps & Tombol Info (i) */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    {activeCand.googleMapsUrl && (
                                      <a
                                        href={activeCand.googleMapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.2rem',
                                          height: '18px',
                                          padding: '0 0.35rem',
                                          fontSize: '0.67rem',
                                          fontWeight: 600,
                                          color: '#2563eb',
                                          background: 'rgba(37, 99, 235, 0.08)',
                                          border: '1px solid rgba(37, 99, 235, 0.25)',
                                          borderRadius: '3px',
                                          textDecoration: 'none',
                                          cursor: 'pointer',
                                          boxSizing: 'border-box',
                                          lineHeight: '18px',
                                        }}
                                        title="Buka rute navigasi & cek jarak real di Google Maps langsung"
                                      >
                                        <ExternalLink size={10} /> Maps
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCandidateDetail({ targetRow: r, candidate: activeCand })}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '3px',
                                        border: '1px solid #d1d5db',
                                        background: '#f8fafc',
                                        color: '#64748b',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        flexShrink: 0,
                                        boxSizing: 'border-box',
                                        padding: 0,
                                      }}
                                      title="Lihat alasan penilaian skor & detail wilayah"
                                    >
                                      <Info size={10} />
                                    </button>
                                  </div>
                                </div>

                                {/* Baris Cabang Master + Tombol Utama Gunakan Cabang Ini */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.4rem',
                                      marginBottom: '0.1rem',
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: '0.81rem',
                                        fontWeight: 600,
                                        color: '#212529',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {m['Sandi Cabang'] || m.Cabang || m.Sandi || '-'}
                                      {m['Nama Outlet'] && (
                                        <span style={{ fontSize: '0.73rem', color: '#405189', fontWeight: 500, marginLeft: '0.35rem' }}>
                                          • {m['Nama Outlet']}
                                        </span>
                                      )}
                                    </div>

                                    {/* Tombol Gunakan Cabang Ini (Kompak & Pas di Baris Cabang) */}
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      onClick={() => onApproveRecommendation(r.No, m)}
                                      style={{
                                        fontSize: '0.69rem',
                                        padding: '0.16rem 0.52rem',
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
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.2rem',
                                      }}
                                      title="Pilih dan setujui cabang master ini"
                                    >
                                      <Check size={11} /> Gunakan Cabang Ini
                                    </button>
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
      ) : checkerTab === 'upload' && pendingUploadRows.length === 0 ? (
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
            Seluruh antrean data target berhasil diproses dan dipindahkan. Silakan cek tab <strong>Rekomendasi Data</strong> untuk data yang perlu ditinjau atau <strong>Data Match</strong> untuk data yang telah cocok.
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
      ) : checkerTab === 'matched' && matchedRows.length === 0 ? (
        /* TAB 3: PRE-MATCHING STATE (BELUM ADA DATA MATCH) */
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
                <th style={{ minWidth: '150px' }}>Status Match</th>
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
                {!hiddenCols.has('Branch Code') && <th style={{ color: '#405189' }}>Branch Code (Master)</th>}
                {!hiddenCols.has('Kode Cabang') && <th style={{ color: '#405189' }}>Kode Cabang (Master)</th>}
                {!hiddenCols.has('Nama Outlet') && <th style={{ color: '#405189' }}>Nama Outlet (Master)</th>}
                {!hiddenCols.has('Status Outlet') && <th style={{ color: '#405189' }}>Status Outlet (Master)</th>}
                {!hiddenCols.has('ALAMAT') && <th style={{ color: '#405189' }}>ALAMAT (Master)</th>}
                {/* Kolom Target Asli (Sampai Provinsi & PTEN) */}
                {!hiddenCols.has('KODE POS') && <th>KODE POS</th>}
                {!hiddenCols.has('Kelurahan') && <th>Kelurahan</th>}
                {!hiddenCols.has('Kecamatan') && <th>Kecamatan</th>}
                {!hiddenCols.has('Dati II') && <th>Dati II</th>}
                {!hiddenCols.has('Kode Dati II') && <th>Kode Dati II</th>}
                {!hiddenCols.has('Provinsi') && <th>Provinsi</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={18 - hiddenCols.size} style={{ textAlign: 'center', padding: '3rem', color: '#878a99' }}>
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

                      {/* Status Match Badge + Revert Action */}
                      <td style={{ minWidth: '150px' }}>
                        {isMatched ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem', alignItems: 'flex-start' }}>
                            <span
                              className={`badge ${
                                r._matchLevel === 'recommendation'
                                  ? 'badge-level2'
                                  : r._matchLevel === 'level2'
                                  ? 'badge-level2'
                                  : 'badge-match'
                              }`}
                              style={{
                                fontSize: '0.67rem',
                                padding: '0.14rem 0.45rem',
                                letterSpacing: '0.02em',
                                whiteSpace: 'nowrap',
                              }}
                              title={r._matchedAt ? `Diverifikasi: ${new Date(r._matchedAt).toLocaleString('id-ID')} (${r._matchedBy || 'Sistem'})` : undefined}
                            >
                              {r._matchLevel === 'recommendation'
                                ? 'MATCH (REKOMENDASI)'
                                : r._matchLevel === 'level2'
                                ? 'MATCH (L2 TIE)'
                                : 'MATCH (L1)'}
                            </span>

                            {/* Audit Kesesuaian dengan Isi Awal Excel */}
                            {r._hasUserFilledData && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.61rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {(() => {
                                  const uSandi = String(r._originalFilledSandi || '').trim().toLowerCase();
                                  const uCabang = String(r._originalFilledCabang || '').trim().toLowerCase();
                                  const mSandi = String(r.Sandi || '').trim().toLowerCase();
                                  const mCabang = String(r.Cabang || '').trim().toLowerCase();
                                  const isAgree =
                                    (uSandi && mSandi && uSandi === mSandi) ||
                                    (uCabang && mCabang && (uCabang === mCabang || mCabang.includes(uCabang) || uCabang.includes(mCabang)));

                                  return isAgree ? (
                                    <span style={{ color: '#059669', background: 'rgba(5, 150, 105, 0.08)', padding: '0.04rem 0.25rem', borderRadius: '2px' }} title="Pencocokan sistem sesuai dengan cabang yang Anda isi di file Excel">
                                      ✓ Sesuai Excel Anda
                                    </span>
                                  ) : (
                                    <span style={{ color: '#d97706', background: 'rgba(217, 119, 6, 0.08)', padding: '0.04rem 0.25rem', borderRadius: '2px' }} title={`Di Excel Anda isi: ${r._originalFilledCabang || r._originalFilledSandi || r._originalFilledSandiCabang}`}>
                                      ⚠️ Beda dr Excel
                                    </span>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Baris 2: Timestamp dan Tombol Batalkan Berdampingan Sejajar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                              {r._matchedAt && (
                                <span style={{ fontSize: '0.65rem', color: '#878a99', fontWeight: 500 }}>
                                  {new Date(r._matchedAt).toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                              {/* Tombol Batalkan / Revert jika baris hasil persetujuan rekomendasi */}
                              {onRevertRecommendation && r._matchLevel === 'recommendation' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Batalkan persetujuan rekomendasi baris #${r.No}? Baris ini akan dikembalikan ke tab Rekomendasi Data.`)) {
                                      onRevertRecommendation(r.No);
                                    }
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    height: '17px',
                                    padding: '0 0.35rem',
                                    borderRadius: '3px',
                                    border: '1px solid rgba(240, 101, 72, 0.3)',
                                    background: 'rgba(240, 101, 72, 0.06)',
                                    color: '#e05338',
                                    fontSize: '0.64rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxSizing: 'border-box',
                                    lineHeight: '17px',
                                  }}
                                  title="Batalkan status match rekomendasi dan kembalikan ke tab Rekomendasi Data"
                                >
                                  <RotateCcw size={9} />
                                  <span>Batalkan</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="badge badge-unmatched">UNMATCHED</span>
                        )}
                      </td>

                      {/* Wilayah */}
                      <td><span style={{ color: '#495057', fontWeight: 500 }}>{formatWilayahName(r.Wilayah)}</span></td>

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
                      {!hiddenCols.has('Branch Code') && (
                        <td className="code-cell">
                          {r['Branch Code'] || <span style={{ color: '#878a99' }}>-</span>}
                        </td>
                      )}
                      {!hiddenCols.has('Kode Cabang') && (
                        <td className="code-cell">
                          {r['Kode Cabang'] || <span style={{ color: '#878a99' }}>-</span>}
                        </td>
                      )}
                      {!hiddenCols.has('Nama Outlet') && (
                        <td style={{ color: '#405189', fontWeight: 500 }}>{r['Nama Outlet'] || <span style={{ color: '#878a99' }}>-</span>}</td>
                      )}
                      {!hiddenCols.has('Status Outlet') && (
                        <td>
                          {r['Status Outlet'] ? (
                            <span className="badge badge-match">{r['Status Outlet']}</span>
                          ) : (
                            <span style={{ color: '#878a99' }}>-</span>
                          )}
                        </td>
                      )}
                      {!hiddenCols.has('ALAMAT') && (
                        <td style={{ minWidth: '220px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4 }} title={r.ALAMAT}>
                          {r.ALAMAT || <span style={{ color: '#878a99' }}>-</span>}
                        </td>
                      )}

                      {/* Target Data Asli (Sampai Provinsi & PTEN) */}
                      {!hiddenCols.has('KODE POS') && <td className="code-cell" style={{ color: '#405189', fontWeight: 700 }}>{r['KODE POS']}</td>}
                      {!hiddenCols.has('Kelurahan') && <td>{r.Kelurahan || '-'}</td>}
                      {!hiddenCols.has('Kecamatan') && <td>{r.Kecamatan || '-'}</td>}
                      {!hiddenCols.has('Dati II') && <td>{r['Dati II'] || '-'}</td>}
                      {!hiddenCols.has('Kode Dati II') && <td className="code-cell">{r['Kode Dati II'] || '-'}</td>}
                      {!hiddenCols.has('Provinsi') && <td>{r.Provinsi || '-'}</td>}
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

          {/* Tombol Navigasi Pagination & Quick Jump */}
          {pageSize !== 'all' && totalPages > 1 && (
            <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                <ChevronLeft size={13} />
                <span>Sebelumnya</span>
              </button>
              <span style={{ padding: '0 0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#495057' }}>
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

              {/* Quick Jump to Page */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.75rem',
                  color: '#495057',
                  marginLeft: '0.4rem',
                  paddingLeft: '0.4rem',
                  borderLeft: '1px solid #ced4da',
                }}
              >
                <span>Ke Hal:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  defaultValue={page}
                  key={`jump-${page}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setPage(val);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= totalPages && val !== page) {
                      setPage(val);
                    }
                  }}
                  style={{
                    width: '46px',
                    padding: '0.18rem 0.3rem',
                    textAlign: 'center',
                    borderRadius: '4px',
                    border: '1px solid #ced4da',
                    fontSize: '0.75rem',
                    outline: 'none',
                  }}
                  title="Ketik nomor halaman lalu tekan Enter"
                />
              </div>

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
