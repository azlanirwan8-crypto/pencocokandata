import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  Zap,
  Check,
  Edit,
  Search,
  X,
  FileSpreadsheet,
  FileText,
  MapPin,
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import type { AnalystRow } from '../../utils/analystPipeline';
import type { WilayahSetting } from '../../types';
import { AnalystRowEditModal } from './AnalystRowEditModal';
import { formatWilayahName } from '../../utils/normalizer';
import { formatWilayahCode } from '../../utils/excel';
import { exportAnalystExecutivePdf } from '../../utils/pdfExport';

interface AnalystResultsGridProps {
  rows: AnalystRow[];
  onUpdateRow: (updatedRow: AnalystRow) => void;
  onApproveSingleRow: (rowId: string) => void;
  onApproveAllFinal: () => void;
  onApproveFase: (fase: 1 | 2 | 3) => void;
  onReRunAll: () => void;
  onReRunAnomaliesOnly: () => void;
  isProcessing: boolean;
  wilayahSettings: WilayahSetting[];
}

export const AnalystResultsGrid: React.FC<AnalystResultsGridProps> = ({
  rows,
  onUpdateRow,
  onApproveSingleRow,
  onApproveAllFinal,
  onApproveFase,
  onReRunAll,
  onReRunAnomaliesOnly,
  isProcessing,
  wilayahSettings,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'fase1' | 'fase2' | 'fase3'>('all');
  const [selectedWilayah, setSelectedWilayah] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ANOMALI' | 'EXACT_MATCH' | 'HIGH_CONFIDENCE'>('ALL');

  // Pagination states
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(15);

  // Edit Modal
  const [editingRow, setEditingRow] = useState<AnalystRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Success Notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Unique Wilayah list for filter
  const wilayahList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.wilayah) set.add(r.wilayah);
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }, [rows]);

  // Executive KPI Aggregates
  const stats = useMemo(() => {
    const total = rows.length;
    let exact = 0;
    let highConf = 0;
    let anomalies = 0;
    let approved = 0;
    let role3Complete = 0;

    rows.forEach((r) => {
      if (r.statusAnalisa === 'EXACT_MATCH') exact++;
      else if (r.statusAnalisa === 'HIGH_CONFIDENCE') highConf++;
      else anomalies++;

      if (r.isFinalApproved) approved++;
      if (r.is3RoleLengkap) role3Complete++;
    });

    const accuracyRate = total > 0 ? (((exact + highConf) / total) * 100).toFixed(1) : '100';
    const isAllApproved = total > 0 && approved === total;

    return {
      total,
      exact,
      highConf,
      anomalies,
      approved,
      role3Complete,
      accuracyRate,
      isAllApproved,
    };
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      if (selectedWilayah !== 'ALL' && r.wilayah !== selectedWilayah) return false;
      if (statusFilter === 'ANOMALI' && r.statusAnalisa !== 'ANOMALI' && r.statusAnalisa !== 'PERLU_REVIEW') return false;
      if (statusFilter === 'EXACT_MATCH' && r.statusAnalisa !== 'EXACT_MATCH') return false;
      if (statusFilter === 'HIGH_CONFIDENCE' && r.statusAnalisa !== 'HIGH_CONFIDENCE') return false;

      if (q) {
        const match =
          String(r.no).includes(q) ||
          r.kotaPten?.toLowerCase().includes(q) ||
          r.kodePosPten?.includes(q) ||
          r.kelurahan?.toLowerCase().includes(q) ||
          r.kecamatan?.toLowerCase().includes(q) ||
          r.wilayah?.toLowerCase().includes(q) ||
          r.sandiCabang?.toLowerCase().includes(q) ||
          r.branchCode?.toLowerCase().includes(q) ||
          r.namaOutlet?.toLowerCase().includes(q) ||
          r.organisasiTujuan?.toLowerCase().includes(q) ||
          r.alamat?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [rows, selectedWilayah, statusFilter, searchTerm]);

  // Pagination calculation
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    if (pageSize === 'ALL') return filteredRows;
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Export Multi-Sheet per Wilayah (W01 - W17)
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Group rows by Wilayah
      const wilayahMap = new Map<string, AnalystRow[]>();
      rows.forEach((r) => {
        const wKey = formatWilayahCode(r.wilayah || 'W01');
        if (!wilayahMap.has(wKey)) wilayahMap.set(wKey, []);
        wilayahMap.get(wKey)!.push(r);
      });

      // Sort sheet keys W01, W02, ...
      const sortedKeys = Array.from(wilayahMap.keys()).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      sortedKeys.forEach((wKey) => {
        const groupRows = wilayahMap.get(wKey)!;
        const exportData = groupRows.map((r, idx) => ({
          'No': idx + 1,
          'Wilayah': r.wilayah,
          'Sandi Cabang': r.sandiCabang,
          'Branch Code': r.branchCode,
          'Kode Cabang': r.kodeCabang,
          'Nama Outlet': r.namaOutlet,
          'Status Outlet': r.statusOutlet,
          'ALAMAT': r.alamat,
          'KODE POS': r.kodePosPten,
          'Kelurahan': r.kelurahan,
          'Kecamatan': r.kecamatan,
          'Dati II': r.kotaPten,
          'Provinsi': r.provinsi,
          'KOTA PTEN': r.kotaPten,
          'KODE POS PTEN': r.kodePosPten,
          'CEK KODE POS + PTEN': r.statusPten,
          'ORGANISASI TUJUAN': r.organisasiTujuan,
          'Tipe Unit': r.tipeUnit,
          'Alur Wondr': r.alurWondr,
          'QRS_CABSAL': r.roleCabsal,
          'QRS_CABAPV1': r.roleCabapv1,
          'QRS_CABAPV2': r.roleCabapv2,
          'Grand Total': r.roleGrandTotal,
          'Status Analisa': r.isFinalApproved ? 'VERIFIED' : r.statusAnalisa,
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, wKey);
      });

      // Sheet Summary All
      const allExport = rows.map((r, idx) => ({
        'No': idx + 1,
        'Wilayah': r.wilayah,
        'Sandi Cabang': r.sandiCabang,
        'Branch Code': r.branchCode,
        'Kode Cabang': r.kodeCabang,
        'Nama Outlet': r.namaOutlet,
        'Status Outlet': r.statusOutlet,
        'ALAMAT': r.alamat,
        'KODE POS': r.kodePosPten,
        'Kelurahan': r.kelurahan,
        'Kecamatan': r.kecamatan,
        'Dati II': r.kotaPten,
        'Provinsi': r.provinsi,
        'ORGANISASI TUJUAN': r.organisasiTujuan,
        'Tipe Unit': r.tipeUnit,
        'Alur Wondr': r.alurWondr,
      }));
      const wsAll = XLSX.utils.json_to_sheet(allExport);
      XLSX.utils.book_append_sheet(wb, wsAll, 'SEMUA_DATA');

      XLSX.writeFile(wb, `Laporan_Final_Data_Analyst_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`Berhasil mengunduh ${rows.length.toLocaleString('id-ID')} baris data ke Excel Multi-Sheet!`);
    } catch (e: any) {
      alert('Gagal mengekspor berkas Excel: ' + e.message);
    }
  };

  const handleExportPdf = () => {
    const result = exportAnalystExecutivePdf({ rows, stats: { total: stats.total, exact: stats.exact, highConf: stats.highConf, anomalies: stats.anomalies, approved: stats.approved, role3Complete: stats.role3Complete, accuracyRate: stats.accuracyRate }, wilayahCount: wilayahList.length });
    if (result.success) {
      showToast(`Berhasil mengunduh laporan PDF: ${result.filename}`);
    } else {
      alert('Gagal membuat dokumen PDF: ' + result.error);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. EXECUTIVE METRIC CARDS                                                 */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {/* Total Data */}
        <div className="metric-card blue">
          <div className="metric-header">
            <span className="metric-title">Total Data Dianalisa</span>
            <div className="metric-icon-bubble">
              <Building2 size={15} />
            </div>
          </div>
          <div className="metric-value">{stats.total.toLocaleString('id-ID')}</div>
          <div className="metric-footer">{wilayahList.length} Wilayah / Kanwil Terpetakan</div>
        </div>

        {/* Akurasi Engine */}
        <div className="metric-card emerald">
          <div className="metric-header">
            <span className="metric-title">Tingkat Akurasi Engine</span>
            <div className="metric-icon-bubble">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="metric-value">{stats.accuracyRate}%</div>
          <div className="metric-footer">{stats.exact.toLocaleString('id-ID')} Exact Cocok Sempurna</div>
        </div>

        {/* Fase 1: PTEN & Kode Pos */}
        <div className="metric-card cyan">
          <div className="metric-header">
            <span className="metric-title">Fase 1: PTEN & Pos</span>
            <div className="metric-icon-bubble">
              <MapPin size={15} />
            </div>
          </div>
          <div className="metric-value">100%</div>
          <div className="metric-footer">Kelurahan & Kecamatan Lengkap</div>
        </div>

        {/* Fase 3: 3 Role Lengkap */}
        <div className={`metric-card ${stats.anomalies > 0 ? 'amber' : 'emerald'}`}>
          <div className="metric-header">
            <span className="metric-title">Fase 3: 3 Role Wondr</span>
            <div className="metric-icon-bubble">
              <Users size={15} />
            </div>
          </div>
          <div className="metric-value">{stats.role3Complete.toLocaleString('id-ID')}</div>
          <div className="metric-footer">
            {stats.anomalies > 0 ? `${stats.anomalies} entri perlu review` : 'Seluruh unit terpetakan rapi'}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            background: notification.type === 'success' ? '#e8f7f5' : '#eff2f7',
            color: notification.type === 'success' ? '#0ab39c' : '#405189',
            border: `1px solid ${notification.type === 'success' ? '#b7ebe4' : '#dce4f5'}`,
            padding: '0.75rem 1.25rem',
            borderRadius: '6px',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} />
            <span>{notification.message}</span>
          </div>
          <button type="button" onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. SMART ACTION CONTROLS & DECISION TOOLBAR                              */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          background: '#ffffff',
          border: '1px solid #e9ebec',
          borderRadius: '8px',
          padding: '0.9rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Left: Re-run & Approval Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onReRunAll}
            disabled={isProcessing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
            title="Jalankan ulang seluruh analisa 3 fase dari data master"
          >
            <RotateCcw size={13} />
            <span>Ulangi Analisa Total</span>
          </button>

          {stats.anomalies > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onReRunAnomaliesOnly}
              disabled={isProcessing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                fontSize: '0.78rem',
                color: '#f7b84b',
                borderColor: 'rgba(247, 184, 75, 0.4)',
                background: 'rgba(247, 184, 75, 0.06)',
              }}
              title="Hanya analisa ulang baris data yang belum cocok / anomali"
            >
              <Zap size={13} />
              <span>Ulangi yang Salah Saja ({stats.anomalies})</span>
            </button>
          )}

          <div style={{ display: 'inline-flex', gap: '0.25rem', borderLeft: '1px solid #e9ebec', paddingLeft: '0.55rem' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { onApproveFase(1); showToast('Fase 1 (PTEN & Kode Pos) disetujui seluruhnya!'); }}
              disabled={isProcessing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.65rem', fontSize: '0.74rem', color: '#299cdb', borderColor: 'rgba(41, 156, 219, 0.3)' }}
              title="Setujui seluruh hasil analisa Fase 1: PTEN & Kode Pos"
            >
              <MapPin size={12} />
              <span>Setujui Fase 1</span>
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { onApproveFase(2); showToast('Fase 2 (Wilayah & Cabang) disetujui seluruhnya!'); }}
              disabled={isProcessing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.65rem', fontSize: '0.74rem', color: '#405189', borderColor: 'rgba(64, 81, 137, 0.3)' }}
              title="Setujui seluruh hasil analisa Fase 2: Wilayah & Master Cabang"
            >
              <Building2 size={12} />
              <span>Setujui Fase 2</span>
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { onApproveFase(3); showToast('Fase 3 (Mapping Role & Wondr) disetujui seluruhnya!'); }}
              disabled={isProcessing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.65rem', fontSize: '0.74rem', color: '#0ab39c', borderColor: 'rgba(10, 179, 156, 0.3)' }}
              title="Setujui seluruh hasil analisa Fase 3: Mapping Role & Wondr"
            >
              <Users size={12} />
              <span>Setujui Fase 3</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={onApproveAllFinal}
            disabled={isProcessing || stats.isAllApproved}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1.1rem',
              fontWeight: 700,
              fontSize: '0.8rem',
              background: stats.isAllApproved ? '#34c38f' : '#0ab39c',
              borderColor: '#0ab39c',
            }}
          >
            {stats.isAllApproved ? (
              <>
                <Lock size={14} />
                <span>Analisa Final Telah Disetujui</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Saya Setuju (Masuk ke Final Analisa)</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Export Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportPdf}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.95rem', fontSize: '0.8rem', color: '#405189', borderColor: '#405189' }}
          >
            <FileText size={15} />
            <span>Ekspor PDF Executive</span>
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportExcel}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.95rem', fontSize: '0.8rem', color: '#0ab39c', borderColor: '#0ab39c' }}
          >
            <FileSpreadsheet size={15} />
            <span>Ekspor Excel Multi-Sheet</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. SUB-TAB BAR & FILTERS                                                  */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
        {/* Navigation Sub-Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #e9ebec', paddingBottom: '0.65rem' }}>
          <div className="nav-tabs">
            <button
              type="button"
              className={`nav-tab-btn ${activeSubTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('all')}
            >
              📑 1. Ringkasan Final (Semua Atribut)
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeSubTab === 'fase1' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('fase1')}
            >
              📍 2. Detail Fase 1 (PTEN & Kode Pos)
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeSubTab === 'fase2' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('fase2')}
            >
              🏢 3. Detail Fase 2 (Kanwil & Master Cabang)
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeSubTab === 'fase3' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('fase3')}
            >
              👥 4. Detail Fase 3 (Mapping Role & Wondr)
            </button>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
            Menampilkan <strong style={{ color: '#212529' }}>{filteredRows.length.toLocaleString('id-ID')}</strong> dari{' '}
            {rows.length.toLocaleString('id-ID')} baris
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="filter-toolbar" style={{ marginBottom: '1rem' }}>
          <div className="filter-group" style={{ flex: 1, minWidth: '280px' }}>
            {/* Search Input */}
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '0.65rem', color: '#878a99' }} />
              <input
                type="text"
                className="search-input"
                style={{ width: '100%', paddingLeft: '2rem' }}
                placeholder="Cari cabang, kota PTEN, kelurahan, kecamatan, sandi, role..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#878a99' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Wilayah */}
            <select
              className="filter-select"
              value={selectedWilayah}
              onChange={(e) => {
                setSelectedWilayah(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Semua Wilayah ({wilayahList.length})</option>
              {wilayahList.map((w) => (
                <option key={w} value={w}>
                  {formatWilayahName(w)}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
            >
              <option value="ALL">Semua Status</option>
              <option value="EXACT_MATCH">Exact Cocok Sempurna ({stats.exact})</option>
              <option value="HIGH_CONFIDENCE">High Confidence ({stats.highConf})</option>
              {stats.anomalies > 0 && <option value="ANOMALI">Perlu Review / Anomali ({stats.anomalies})</option>}
            </select>
          </div>

          <div className="filter-group">
            <span style={{ fontSize: '0.78rem', color: '#878a99' }}>Tampilkan:</span>
            <select
              className="filter-select"
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setPageSize(val);
                setPage(1);
              }}
            >
              <option value={15}>15 Baris</option>
              <option value={30}>30 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
              <option value="ALL">Semua ({filteredRows.length})</option>
            </select>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* 4. DATA TABLES PER SUB-TAB                                                */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', maxHeight: '600px', overflowX: 'auto' }}>
          <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
              {/* TAB 1: ALL COLUMNS */}
              {activeSubTab === 'all' && (
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Wilayah</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Sandi</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Branch Code</th>
                  <th style={{ minWidth: '160px' }}>Nama Outlet</th>
                  <th style={{ width: '110px' }}>Kota PTEN</th>
                  <th style={{ width: '75px', textAlign: 'center' }}>Kode Pos</th>
                  <th>Kelurahan / Kec.</th>
                  <th style={{ minWidth: '180px' }}>ORGANISASI TUJUAN</th>
                  <th style={{ width: '75px', textAlign: 'center' }}>Tipe Unit</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>3 Role</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Aksi Review</th>
                </tr>
              )}

              {/* TAB 2: FASE 1 PTEN & KODE POS */}
              {activeSubTab === 'fase1' && (
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ minWidth: '140px' }}>Kota PTEN</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Kode Pos PTEN</th>
                  <th>Kelurahan Acuan</th>
                  <th>Kecamatan Acuan</th>
                  <th>Provinsi</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Status PTEN</th>
                  <th style={{ minWidth: '160px' }}>Group Kota PTEN</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Aksi Review</th>
                </tr>
              )}

              {/* TAB 3: FASE 2 WILAYAH & CABANG */}
              {activeSubTab === 'fase2' && (
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Kanwil</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Sandi Cabang</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Branch Code</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Kode Cabang</th>
                  <th style={{ minWidth: '180px' }}>Nama Outlet Master</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                  <th style={{ minWidth: '220px' }}>ALAMAT Cabang</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Aksi Review</th>
                </tr>
              )}

              {/* TAB 4: FASE 3 MAPPING ROLE & WONDR */}
              {activeSubTab === 'fase3' && (
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ minWidth: '180px' }}>Nama Outlet</th>
                  <th style={{ minWidth: '220px' }}>ORGANISASI TUJUAN</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Tipe Unit</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Sales</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Verifikator</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Penyetuju</th>
                  <th style={{ minWidth: '160px' }}>Rekomendasi Alur Wondr</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Pegawai</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Aksi Review</th>
                </tr>
              )}
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                    Tidak ada baris analisa yang cocok dengan filter pencarian "{searchTerm}".
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, idx) => {
                  const displayIdx = pageSize === 'ALL' ? idx + 1 : (page - 1) * (pageSize as number) + idx + 1;

                  return (
                    <tr key={r.id || idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                      {/* TAB 1: ALL COLUMNS */}
                      {activeSubTab === 'all' && (
                        <>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{displayIdx}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-level1">{r.wilayah}</span>
                          </td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.sandiCabang}</td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.branchCode || '-'}</td>
                          <td style={{ fontWeight: 600, color: '#405189' }}>{r.namaOutlet}</td>
                          <td>{r.kotaPten}</td>
                          <td className="code-cell" style={{ textAlign: 'center', color: '#0ab39c', fontWeight: 700 }}>
                            {r.kodePosPten}
                          </td>
                          <td>
                            <div>{r.kelurahan}</div>
                            <div style={{ fontSize: '0.7rem', color: '#878a99' }}>{r.kecamatan}</div>
                          </td>
                          <td style={{ fontWeight: 600, color: '#212529' }}>{r.organisasiTujuan}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${r.tipeUnit === 'KC' ? 'badge-match' : 'badge-level2'}`}>
                              {r.tipeUnit}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${r.is3RoleLengkap ? 'badge-match' : 'badge-level2'}`}>
                              {r.is3RoleLengkap ? '3 Role OK' : 'Parsial'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${r.isFinalApproved ? 'badge-match' : 'badge-level1'}`}>
                              {r.isFinalApproved ? '✓ Disetujui' : r.statusAnalisa}
                            </span>
                          </td>
                        </>
                      )}

                      {/* TAB 2: FASE 1 PTEN & KODE POS */}
                      {activeSubTab === 'fase1' && (
                        <>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{displayIdx}</td>
                          <td style={{ fontWeight: 700, color: '#212529' }}>{r.kotaPten}</td>
                          <td className="code-cell" style={{ textAlign: 'center', color: '#0ab39c', fontWeight: 700 }}>
                            {r.kodePosPten}
                          </td>
                          <td>{r.kelurahan}</td>
                          <td>{r.kecamatan}</td>
                          <td>{r.provinsi}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-match">{r.statusPten}</span>
                          </td>
                          <td>
                            <span className="badge badge-level1" style={{ fontSize: '0.72rem' }}>
                              Grup: {r.groupKota}
                            </span>
                          </td>
                        </>
                      )}

                      {/* TAB 3: FASE 2 WILAYAH & CABANG */}
                      {activeSubTab === 'fase2' && (
                        <>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{displayIdx}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-level1">{r.wilayah}</span>
                          </td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.sandiCabang}</td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.branchCode || '-'}</td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.kodeCabang || '-'}</td>
                          <td style={{ fontWeight: 700, color: '#405189' }}>{r.namaOutlet}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-match">{r.statusOutlet}</span>
                          </td>
                          <td title={r.alamat}>{r.alamat}</td>
                        </>
                      )}

                      {/* TAB 4: FASE 3 MAPPING ROLE & WONDR */}
                      {activeSubTab === 'fase3' && (
                        <>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{displayIdx}</td>
                          <td style={{ fontWeight: 600, color: '#405189' }}>{r.namaOutlet}</td>
                          <td style={{ fontWeight: 700, color: '#212529' }}>{r.organisasiTujuan}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${r.tipeUnit === 'KC' ? 'badge-match' : 'badge-level2'}`}>
                              {r.tipeUnit}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: r.roleCabsal === 1 ? '#0ab39c' : '#f06548' }}>
                            {r.roleCabsal === 1 ? '✓' : '-'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: r.roleCabapv1 === 1 ? '#0ab39c' : '#f06548' }}>
                            {r.roleCabapv1 === 1 ? '✓' : '-'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: r.roleCabapv2 === 1 ? '#0ab39c' : '#f06548' }}>
                            {r.roleCabapv2 === 1 ? '✓' : '-'}
                          </td>
                          <td>
                            <span className="badge badge-match" style={{ fontSize: '0.72rem' }}>{r.alurWondr}</span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.roleGrandTotal} Org</td>
                        </>
                      )}

                      {/* ACTION REVIEW BUTTONS (Appears on ALL tabs) */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              onApproveSingleRow(r.id);
                              showToast(`Baris #${r.no} (${r.namaOutlet}) disetujui!`);
                            }}
                            title="Setujui Hasil Baris Ini (OK)"
                            style={{
                              background: r.isFinalApproved ? '#0ab39c' : 'rgba(10, 179, 156, 0.1)',
                              border: '1px solid rgba(10, 179, 156, 0.3)',
                              color: r.isFinalApproved ? '#ffffff' : '#0ab39c',
                              borderRadius: '4px',
                              padding: '0.22rem 0.4rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRow(r);
                              setIsEditModalOpen(true);
                            }}
                            title="Edit / Koreksi Manual Baris Ini"
                            style={{
                              background: 'rgba(64, 81, 137, 0.1)',
                              border: '1px solid rgba(64, 81, 137, 0.3)',
                              color: '#405189',
                              borderRadius: '4px',
                              padding: '0.22rem 0.4rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Edit size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Master Pagination Footer */}
        {pageSize !== 'ALL' && totalPages > 1 && (
          <div
            className="pagination-row"
            style={{
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginTop: '1rem',
              borderTop: '1px solid #e9ebec',
              paddingTop: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
              Halaman <strong style={{ color: '#212529' }}>{page}</strong> dari{' '}
              <strong style={{ color: '#212529' }}>{totalPages}</strong>
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
                title="Halaman Pertama"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronsLeft size={13} />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                title="Halaman Sebelumnya"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronLeft size={13} />
              </button>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0 0.5rem', color: '#405189' }}>
                {page}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                title="Halaman Selanjutnya"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                title="Halaman Terakhir"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <AnalystRowEditModal
        isOpen={isEditModalOpen}
        row={editingRow}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRow(null);
        }}
        onSave={(updated) => {
          onUpdateRow(updated);
          showToast(`Berhasil menyimpan koreksi pada baris #${updated.no} (${updated.namaOutlet})!`);
        }}
        wilayahSettings={wilayahSettings}
      />
    </div>
  );
};
