import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Download,
  Layers,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { TargetRow, MasterRow } from '../../types';

interface PTENManagerProps {
  targetRows?: TargetRow[];
  masterRows?: MasterRow[];
}

export interface PTENRecord {
  id?: string;
  kodePosPten: string;
  kotaPten: string;
  provinsiPten: string;
  keterangan: string;
  status: 'AKTIF' | 'NON-AKTIF';
}

const DEFAULT_PTEN_DATA: PTENRecord[] = [
  { kodePosPten: '10110', kotaPten: 'Kota Jakarta Pusat', provinsiPten: 'DKI Jakarta', keterangan: 'Gambir', status: 'AKTIF' },
  { kodePosPten: '10210', kotaPten: 'Kota Jakarta Pusat', provinsiPten: 'DKI Jakarta', keterangan: 'Bendungan Hilir / Senayan', status: 'AKTIF' },
  { kodePosPten: '10350', kotaPten: 'Kota Jakarta Pusat', provinsiPten: 'DKI Jakarta', keterangan: 'Menteng / Gondangdia', status: 'AKTIF' },
  { kodePosPten: '12190', kotaPten: 'Kota Jakarta Selatan', provinsiPten: 'DKI Jakarta', keterangan: 'Senayan / SCBD Sudirman', status: 'AKTIF' },
  { kodePosPten: '13310', kotaPten: 'Jakarta Timur', provinsiPten: 'DKI Jakarta', keterangan: 'Bali Mester / Jatinegara', status: 'AKTIF' },
  { kodePosPten: '14240', kotaPten: 'Kota Jakarta Utara', provinsiPten: 'DKI Jakarta', keterangan: 'Kelapa Gading Timur', status: 'AKTIF' },
  { kodePosPten: '14250', kotaPten: 'Kota Jakarta Utara', provinsiPten: 'DKI Jakarta', keterangan: 'Kelapa Gading Barat (PTEN Node)', status: 'AKTIF' },
  { kodePosPten: '15321', kotaPten: 'Kota Tangerang Selatan', provinsiPten: 'Banten', keterangan: 'Serpong / Lengkong Gudang', status: 'AKTIF' },
  { kodePosPten: '20112', kotaPten: 'Kota Medan', provinsiPten: 'Sumatera Utara', keterangan: 'Medan Petisah', status: 'AKTIF' },
  { kodePosPten: '20151', kotaPten: 'Kota Medan', provinsiPten: 'Sumatera Utara', keterangan: 'Medan Maimun / Aur', status: 'AKTIF' },
  { kodePosPten: '25119', kotaPten: 'Kota Padang', provinsiPten: 'Sumatera Barat', keterangan: 'Padang Barat / Kampung Pondok', status: 'AKTIF' },
  { kodePosPten: '30126', kotaPten: 'Kota Palembang', provinsiPten: 'Sumatera Selatan', keterangan: 'Ilir Timur I', status: 'AKTIF' },
  { kodePosPten: '40111', kotaPten: 'Kota Bandung', provinsiPten: 'Jawa Barat', keterangan: 'Braga / Asia Afrika', status: 'AKTIF' },
  { kodePosPten: '40117', kotaPten: 'Kota Bandung', provinsiPten: 'Jawa Barat', keterangan: 'Babakan Ciamis / Perintis', status: 'AKTIF' },
  { kodePosPten: '50132', kotaPten: 'Kota Semarang', provinsiPten: 'Jawa Tengah', keterangan: 'Semarang Tengah / Sekayu', status: 'AKTIF' },
  { kodePosPten: '50137', kotaPten: 'Kota Semarang', provinsiPten: 'Jawa Tengah', keterangan: 'Purwodinatan', status: 'AKTIF' },
  { kodePosPten: '55122', kotaPten: 'Kota Yogyakarta', provinsiPten: 'D.I. Yogyakarta', keterangan: 'Gondomanan / Ngupasan', status: 'AKTIF' },
  { kodePosPten: '60234', kotaPten: 'Kota Surabaya', provinsiPten: 'Jawa Timur', keterangan: 'Menanggal / Gayungan', status: 'AKTIF' },
  { kodePosPten: '60265', kotaPten: 'Kota Surabaya', provinsiPten: 'Jawa Timur', keterangan: 'Keputran / Darmo', status: 'AKTIF' },
  { kodePosPten: '60271', kotaPten: 'Kota Surabaya', provinsiPten: 'Jawa Timur', keterangan: 'Genteng / Basuki Rahmat', status: 'AKTIF' },
  { kodePosPten: '65119', kotaPten: 'Kota Malang', provinsiPten: 'Jawa Timur', keterangan: 'Klojen / Kauman', status: 'AKTIF' },
  { kodePosPten: '70111', kotaPten: 'Kota Banjarmasin', provinsiPten: 'Kalimantan Selatan', keterangan: 'Banjarmasin Tengah', status: 'AKTIF' },
  { kodePosPten: '80234', kotaPten: 'Kota Denpasar', provinsiPten: 'Bali', keterangan: 'Denpasar Timur / Renon', status: 'AKTIF' },
  { kodePosPten: '90115', kotaPten: 'Kota Makassar', provinsiPten: 'Sulawesi Selatan', keterangan: 'Ujung Pandang / Pisang Utara', status: 'AKTIF' },
  { kodePosPten: '95122', kotaPten: 'Kota Manado', provinsiPten: 'Sulawesi Utara', keterangan: 'Wenang / Pinaesaan', status: 'AKTIF' },
  { kodePosPten: '99224', kotaPten: 'Kota Jayapura', provinsiPten: 'Papua', keterangan: 'Jayapura Selatan / Entrop', status: 'AKTIF' },
];

export const PTENManager: React.FC<PTENManagerProps> = ({
  targetRows = [],
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'master' | 'audit'>('master');
  const [ptenList] = useState<PTENRecord[]>(DEFAULT_PTEN_DATA);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [detailRow, setDetailRow] = useState<any | null>(null);

  // Pagination states (Default 10)
  const [masterPage, setMasterPage] = useState<number>(1);
  const [masterPageSize, setMasterPageSize] = useState<number | 'ALL'>(10);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditPageSize, setAuditPageSize] = useState<number | 'ALL'>(10);

  // Analisa Audit PTEN dari Target Data
  const auditAnalysis = useMemo(() => {
    let same = 0;
    let diff = 0;
    let empty = 0;
    const diffRows: TargetRow[] = [];

    targetRows.forEach((r) => {
      const kp = String(r['KODE POS'] || '').trim();
      const pten = String(r['KODE POS PTEN'] || '').trim();
      const cek = String(r['CEK KODE POS + PTEN'] || '').toUpperCase();

      if (cek === 'SAME' || cek === 'COCOK' || (kp && pten && kp === pten)) {
        same++;
      } else if (cek === 'DIFFERENT' || cek === 'TIDAK COCOK' || (kp && pten && kp !== pten)) {
        diff++;
        diffRows.push(r);
      } else {
        empty++;
      }
    });

    return {
      total: targetRows.length,
      same,
      diff,
      empty,
      diffRows,
      matchPercentage: targetRows.length > 0 ? ((same / targetRows.length) * 100).toFixed(1) : '100',
    };
  }, [targetRows]);

  // Filtered Master Data PTEN
  const filteredPten = useMemo(() => {
    return ptenList.filter((item) => {
      if (!searchTerm.trim()) return true;
      const t = searchTerm.toLowerCase();
      return (
        item.kodePosPten.toLowerCase().includes(t) ||
        item.kotaPten.toLowerCase().includes(t) ||
        item.provinsiPten.toLowerCase().includes(t) ||
        item.keterangan.toLowerCase().includes(t)
      );
    });
  }, [ptenList, searchTerm]);

  // Master pagination
  const totalMasterPages = masterPageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredPten.length / masterPageSize));
  useEffect(() => {
    if (masterPage > totalMasterPages) setMasterPage(1);
  }, [totalMasterPages, masterPage]);

  const paginatedPten = useMemo(() => {
    if (masterPageSize === 'ALL') return filteredPten;
    const start = (masterPage - 1) * masterPageSize;
    return filteredPten.slice(start, start + masterPageSize);
  }, [filteredPten, masterPage, masterPageSize]);

  // Audit pagination
  const totalAuditPages = auditPageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(auditAnalysis.diffRows.length / auditPageSize));
  useEffect(() => {
    if (auditPage > totalAuditPages) setAuditPage(1);
  }, [totalAuditPages, auditPage]);

  const paginatedAuditRows = useMemo(() => {
    if (auditPageSize === 'ALL') return auditAnalysis.diffRows;
    const start = (auditPage - 1) * auditPageSize;
    return auditAnalysis.diffRows.slice(start, start + auditPageSize);
  }, [auditAnalysis.diffRows, auditPage, auditPageSize]);

  // Export PTEN Master
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(
      ptenList.map((p) => ({
        'Kode Pos PTEN': p.kodePosPten,
        'Kota / Dati II PTEN': p.kotaPten,
        'Provinsi PTEN': p.provinsiPten,
        Keterangan: p.keterangan,
        Status: p.status,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master_PTEN');
    XLSX.writeFile(wb, `Master_PTEN_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Top Header Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          background: '#ffffff',
          padding: '1.15rem 1.4rem',
          borderRadius: '8px',
          border: '1px solid #e9ebec',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(247, 184, 75, 0.15) 0%, rgba(64, 81, 137, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d68b0c',
              border: '1px solid rgba(247, 184, 75, 0.3)',
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#212529', margin: 0 }}>
              Master Data PTEN & Verifikasi Integritas
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#878a99', margin: '0.2rem 0 0' }}>
              Referensi kode pos dan validasi rekonsiliasi data transaksi nasional (PTEN vs Kode Pos Outlet).
            </p>
          </div>
        </div>

        {/* Tab switcher & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              background: '#f3f6f9',
              padding: '3px',
              borderRadius: '6px',
              border: '1px solid #e9ebec',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveSubTab('master')}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: activeSubTab === 'master' ? 700 : 500,
                color: activeSubTab === 'master' ? '#405189' : '#878a99',
                background: activeSubTab === 'master' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeSubTab === 'master' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Master Referensi PTEN
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('audit')}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: activeSubTab === 'audit' ? 700 : 500,
                color: activeSubTab === 'audit' ? '#405189' : '#878a99',
                background: activeSubTab === 'audit' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeSubTab === 'audit' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <span>Hasil Verifikasi PTEN</span>
              {auditAnalysis.diff > 0 && (
                <span
                  style={{
                    background: '#f06548',
                    color: '#ffffff',
                    padding: '0.05rem 0.35rem',
                    borderRadius: '10px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                  }}
                >
                  {auditAnalysis.diff}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExport}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={13} />
            <span>Ekspor Master PTEN</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <div className="glass-card" style={{ padding: '0.9rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(64, 81, 137, 0.1)',
              color: '#405189',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600, textTransform: 'uppercase' }}>
              Master Kode Pos PTEN
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#212529' }}>
              {ptenList.length} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#878a99' }}>Node</span>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '0.9rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(10, 179, 156, 0.1)',
              color: '#0ab39c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600, textTransform: 'uppercase' }}>
              PTEN Sesuai (Cocok)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0ab39c' }}>
              {auditAnalysis.same} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#878a99' }}>Baris</span>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '0.9rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(240, 101, 72, 0.1)',
              color: '#f06548',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600, textTransform: 'uppercase' }}>
              Perbedaan Kode Pos PTEN
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: auditAnalysis.diff > 0 ? '#f06548' : '#212529' }}>
              {auditAnalysis.diff} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#878a99' }}>Perbedaan</span>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '0.9rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(41, 156, 219, 0.1)',
              color: '#299cdb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#878a99', fontWeight: 600, textTransform: 'uppercase' }}>
              Tingkat Integritas PTEN
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#299cdb' }}>
              {auditAnalysis.total > 0 ? `${auditAnalysis.matchPercentage}%` : '100%'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeSubTab === 'master' ? (
        <div className="glass-card" style={{ padding: '1.15rem 1.35rem' }}>
          {/* Filter & Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ position: 'relative', minWidth: '260px', maxWidth: '450px', flex: 1 }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#878a99',
                }}
              />
              <input
                type="text"
                placeholder="Cari kode pos PTEN, kota, provinsi, keterangan..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setMasterPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem 0.45rem 2.1rem',
                  fontSize: '0.8rem',
                  borderRadius: '5px',
                  border: '1px solid #ced4da',
                  outline: 'none',
                  background: '#ffffff',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#878a99' }}>
                <span>Tampilkan:</span>
                <select
                  value={masterPageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                    setMasterPageSize(val);
                    setMasterPage(1);
                  }}
                  style={{
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.78rem',
                    borderRadius: '4px',
                    border: '1px solid #ced4da',
                    outline: 'none',
                    background: '#ffffff',
                    color: '#495057',
                    cursor: 'pointer',
                  }}
                >
                  <option value={10}>10 Baris</option>
                  <option value={25}>25 Baris</option>
                  <option value={50}>50 Baris</option>
                  <option value="ALL">Lihat Semua ({filteredPten.length})</option>
                </select>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#878a99' }}>
                Menampilkan{' '}
                <strong style={{ color: '#212529' }}>
                  {filteredPten.length === 0
                    ? 0
                    : masterPageSize === 'ALL'
                    ? 1
                    : (masterPage - 1) * (masterPageSize as number) + 1}
                </strong>{' '}
                -{' '}
                <strong style={{ color: '#212529' }}>
                  {masterPageSize === 'ALL'
                    ? filteredPten.length
                    : Math.min(masterPage * (masterPageSize as number), filteredPten.length)}
                </strong>{' '}
                dari <strong style={{ color: '#212529' }}>{filteredPten.length}</strong> master referensi PTEN
              </div>
            </div>
          </div>

          {/* Table Master PTEN */}
          <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px' }}>
            <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>Kode Pos PTEN</th>
                  <th>Kota / Dati II PTEN</th>
                  <th>Provinsi PTEN</th>
                  <th>Keterangan / Kelurahan Node</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPten.map((item, idx) => {
                  const displayRowNo =
                    masterPageSize === 'ALL'
                      ? idx + 1
                      : (masterPage - 1) * (masterPageSize as number) + idx + 1;

                  return (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                      <td style={{ textAlign: 'center', color: '#878a99' }}>{displayRowNo}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="code-cell" style={{ background: '#fff9e6', color: '#d68b0c', fontWeight: 700 }}>
                          {item.kodePosPten}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#212529' }}>{item.kotaPten}</td>
                      <td style={{ color: '#495057' }}>{item.provinsiPten}</td>
                      <td style={{ color: '#6c757d' }}>{item.keterangan}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-match" style={{ fontSize: '0.7rem' }}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Master Pagination Footer */}
          {masterPageSize !== 'ALL' && totalMasterPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid #e9ebec',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
                Halaman <strong style={{ color: '#212529' }}>{masterPage}</strong> dari{' '}
                <strong style={{ color: '#212529' }}>{totalMasterPages}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setMasterPage(1)}
                  disabled={masterPage === 1}
                  title="Halaman Pertama"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
                >
                  <ChevronsLeft size={13} />
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setMasterPage((p) => Math.max(1, p - 1))}
                  disabled={masterPage === 1}
                  title="Halaman Sebelumnya"
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                >
                  <ChevronLeft size={13} />
                </button>

                {Array.from({ length: totalMasterPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setMasterPage(pageNum)}
                    style={{
                      minWidth: '28px',
                      height: '28px',
                      padding: '0 0.4rem',
                      fontSize: '0.74rem',
                      fontWeight: masterPage === pageNum ? 700 : 500,
                      borderRadius: '4px',
                      border: masterPage === pageNum ? '1px solid #405189' : '1px solid #ced4da',
                      background: masterPage === pageNum ? '#405189' : '#ffffff',
                      color: masterPage === pageNum ? '#ffffff' : '#495057',
                      cursor: 'pointer',
                    }}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setMasterPage((p) => Math.min(totalMasterPages, p + 1))}
                  disabled={masterPage === totalMasterPages}
                  title="Halaman Berikutnya"
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                >
                  <ChevronRight size={13} />
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setMasterPage(totalMasterPages)}
                  disabled={masterPage === totalMasterPages}
                  title="Halaman Terakhir"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
                >
                  <ChevronsRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Audit View: Perbedaan Kode Pos PTEN */
        <div className="glass-card" style={{ padding: '1.15rem 1.35rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#212529', margin: '0 0 0.25rem' }}>
                Daftar Baris dengan Perbedaan Kode Pos PTEN ({auditAnalysis.diffRows.length} Data)
              </h4>
              <p style={{ fontSize: '0.76rem', color: '#878a99', margin: 0 }}>
                Baris di bawah memiliki perbedaan antara kolom <strong>KODE POS</strong> dan <strong>KODE POS PTEN</strong> pada data target.
              </p>
            </div>

            {auditAnalysis.diffRows.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#878a99' }}>
                <span>Tampilkan:</span>
                <select
                  value={auditPageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                    setAuditPageSize(val);
                    setAuditPage(1);
                  }}
                  style={{
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.78rem',
                    borderRadius: '4px',
                    border: '1px solid #ced4da',
                    outline: 'none',
                    background: '#ffffff',
                    color: '#495057',
                    cursor: 'pointer',
                  }}
                >
                  <option value={10}>10 Baris</option>
                  <option value={25}>25 Baris</option>
                  <option value={50}>50 Baris</option>
                  <option value="ALL">Lihat Semua ({auditAnalysis.diffRows.length})</option>
                </select>
              </div>
            )}
          </div>

          {auditAnalysis.diffRows.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#0ab39c' }}>
              <CheckCircle2 size={36} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Seluruh Kode Pos Target Sesuai dengan PTEN!</div>
              <div style={{ fontSize: '0.76rem', color: '#878a99', marginTop: '0.25rem' }}>
                Tidak ditemukan anomali atau perbedaan antara Kode Pos Master dan Kode Pos PTEN.
              </div>
            </div>
          ) : (
            <>
              <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto' }}>
                <table className="modern-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                      <th>Wilayah</th>
                      <th>Nama Outlet / Cabang</th>
                      <th>Alamat</th>
                      <th style={{ width: '110px', textAlign: 'center' }}>Kode Pos Target</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Kode Pos PTEN</th>
                      <th style={{ width: '130px', textAlign: 'center' }}>Status PTEN</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAuditRows.map((r, idx) => {
                      const displayRowNo =
                        auditPageSize === 'ALL'
                          ? idx + 1
                          : (auditPage - 1) * (auditPageSize as number) + idx + 1;

                      return (
                        <tr key={idx} style={{ background: '#fffcf5' }}>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{displayRowNo}</td>
                          <td>
                            <span className="badge badge-level1">{r.Wilayah || '-'}</span>
                          </td>
                          <td style={{ fontWeight: 600, color: '#212529' }}>
                            {r['Nama Outlet'] || r.Cabang || r['Sandi Cabang'] || '-'}
                          </td>
                          <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.ALAMAT || '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="code-cell" style={{ background: '#e8f7f5', color: '#0ab39c', fontWeight: 700 }}>
                              {r['KODE POS'] || '-'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="code-cell" style={{ background: '#fff0ee', color: '#f06548', fontWeight: 700 }}>
                              {r['KODE POS PTEN'] || '-'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: 'rgba(240, 101, 72, 0.1)',
                                color: '#f06548',
                                border: '1px solid rgba(240, 101, 72, 0.3)',
                              }}
                            >
                              TIDAK COCOK
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setDetailRow(r)}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                            >
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Audit Pagination Footer */}
              {auditPageSize !== 'ALL' && totalAuditPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    marginTop: '1rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #e9ebec',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
                    Halaman <strong style={{ color: '#212529' }}>{auditPage}</strong> dari{' '}
                    <strong style={{ color: '#212529' }}>{totalAuditPages}</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setAuditPage(1)}
                      disabled={auditPage === 1}
                      title="Halaman Pertama"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
                    >
                      <ChevronsLeft size={13} />
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      disabled={auditPage === 1}
                      title="Halaman Sebelumnya"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                    >
                      <ChevronLeft size={13} />
                    </button>

                    {Array.from({ length: totalAuditPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setAuditPage(pageNum)}
                        style={{
                          minWidth: '28px',
                          height: '28px',
                          padding: '0 0.4rem',
                          fontSize: '0.74rem',
                          fontWeight: auditPage === pageNum ? 700 : 500,
                          borderRadius: '4px',
                          border: auditPage === pageNum ? '1px solid #405189' : '1px solid #ced4da',
                          background: auditPage === pageNum ? '#405189' : '#ffffff',
                          color: auditPage === pageNum ? '#ffffff' : '#495057',
                          cursor: 'pointer',
                        }}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                      disabled={auditPage === totalAuditPages}
                      title="Halaman Berikutnya"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                    >
                      <ChevronRight size={13} />
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setAuditPage(totalAuditPages)}
                      disabled={auditPage === totalAuditPages}
                      title="Halaman Terakhir"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
                    >
                      <ChevronsRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {detailRow && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              border: '1px solid #e9ebec',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #e9ebec',
                background: '#fafbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#212529' }}>
                Detail Rekonsiliasi Kode Pos PTEN
              </h4>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#878a99' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Nama Outlet / Lokasi</span>
                <strong style={{ color: '#212529' }}>{detailRow['Nama Outlet'] || detailRow.Cabang || '-'}</strong>
              </div>
              <div>
                <span style={{ color: '#878a99', display: 'block', fontSize: '0.72rem' }}>Alamat Lengkap</span>
                <div>{detailRow.ALAMAT || '-'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                <div style={{ background: '#e8f7f5', padding: '0.65rem', borderRadius: '4px', border: '1px solid #b7ebe4' }}>
                  <span style={{ color: '#0ab39c', fontWeight: 600, display: 'block', fontSize: '0.72rem' }}>Kode Pos Target</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0ab39c', fontFamily: 'var(--font-mono)' }}>
                    {detailRow['KODE POS'] || '-'}
                  </div>
                </div>
                <div style={{ background: '#fff0ee', padding: '0.65rem', borderRadius: '4px', border: '1px solid #fedcd6' }}>
                  <span style={{ color: '#f06548', fontWeight: 600, display: 'block', fontSize: '0.72rem' }}>Kode Pos PTEN</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f06548', fontFamily: 'var(--font-mono)' }}>
                    {detailRow['KODE POS PTEN'] || '-'}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid #e9ebec',
                background: '#fafbfe',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setDetailRow(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
