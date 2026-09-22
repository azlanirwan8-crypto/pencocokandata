import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  CheckCircle,
  AlertCircle,
  Layers,
} from 'lucide-react';
import type { AnalystRow } from '../../utils/analystPipeline';
import type { WilayahStat } from '../../types';
import { formatWilayahName } from '../../utils/normalizer';
import { exportFinalRowsToExcel, formatWilayahCode } from '../../utils/excel';
import { exportFinalRowsToPdf } from '../../utils/pdfExport';

interface DashboardMatchTableProps {
  /** Baris Data Final — bukan alur unggah Target lama. */
  finalRows: AnalystRow[];
  /** Id baris yang ber-anomali, dari `detectFinalAnomalies` (satu definisi dgn kartu). */
  anomaliIds: Set<string>;
  regionalStats: WilayahStat[];
  selectedWilayah?: string;
}

/** Kunci wilayah kanonik, sama seperti yang dipakai `regionalStats`. */
const kunciW = (v: unknown) => {
  const s = String(v ?? '').trim();
  return (s && s !== '-' && s !== '0' ? formatWilayahCode(s) : '') || 'Tanpa Wilayah';
};

export const DashboardMatchTable: React.FC<DashboardMatchTableProps> = ({
  finalRows,
  anomaliIds,
  regionalStats,
  selectedWilayah = 'ALL',
}) => {
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Baris final tanpa anomali — inilah yang bisa diunduh sebagai "data bersih".
  const allMatchedRows = useMemo(() => finalRows.filter((r) => !anomaliIds.has(r.id)), [finalRows, anomaliIds]);

  const groupByWilayah = (rows: AnalystRow[]) => {
    const map = new Map<string, AnalystRow[]>();
    rows.forEach((r) => {
      const w = kunciW(r.wilayah);
      const arr = map.get(w) || [];
      arr.push(r);
      map.set(w, arr);
    });
    return map;
  };

  const matchedByWilayah = useMemo(() => groupByWilayah(allMatchedRows), [allMatchedRows]);
  const allByWilayah = useMemo(() => groupByWilayah(finalRows), [finalRows]);

  // Sorting state for table (Default: urut berdasarkan Wilayah W1, W2, W3... secara natural)
  const [sortField, setSortField] = useState<'wilayah' | 'matched' | 'total' | 'rate'>('wilayah');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: 'wilayah' | 'matched' | 'total' | 'rate') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'wilayah' ? 'asc' : 'desc');
    }
  };

  // Filter regional stats based on selected Wilayah filter in Dashboard
  const displayedRegions = useMemo(() => {
    let list = [...regionalStats];
    if (selectedWilayah && selectedWilayah !== 'ALL') {
      list = list.filter((s) => String(s.wilayah).trim() === String(selectedWilayah).trim());
    }

    return list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'wilayah') {
        const nameA = formatWilayahName(a.wilayah);
        const nameB = formatWilayahName(b.wilayah);
        cmp = nameA.localeCompare(nameB, 'id', { numeric: true, sensitivity: 'base' });
      } else if (sortField === 'matched') {
        const countA = (matchedByWilayah.get(a.wilayah) || []).length;
        const countB = (matchedByWilayah.get(b.wilayah) || []).length;
        cmp = countA - countB;
      } else if (sortField === 'total') {
        cmp = a.total - b.total;
      } else if (sortField === 'rate') {
        const countA = (matchedByWilayah.get(a.wilayah) || []).length;
        const countB = (matchedByWilayah.get(b.wilayah) || []).length;
        const rateA = a.total > 0 ? (countA / a.total) * 100 : 0;
        const rateB = b.total > 0 ? (countB / b.total) * 100 : 0;
        cmp = rateA - rateB;
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [regionalStats, selectedWilayah, sortField, sortDirection, matchedByWilayah]);

  // Handler: Download Excel per Wilayah (isi = kolom Data Final menu Final Data)
  const handleDownloadExcel = (wilayahKey: string) => {
    setAlertInfo(null);
    const rows = matchedByWilayah.get(wilayahKey) || [];
    if (rows.length === 0) {
      setAlertInfo({
        type: 'error',
        message: `Belum ada data final bersih untuk ${formatWilayahName(wilayahKey)}.`,
      });
      return;
    }

    const res = exportFinalRowsToExcel(rows, formatWilayahName(wilayahKey));
    if (res.success) {
      setAlertInfo({
        type: 'success',
        message: `Berhasil mengunduh ${res.rowCount.toLocaleString('id-ID')} baris data final ke file "${res.filename}".`,
      });
    } else {
      setAlertInfo({
        type: 'error',
        message: res.error || 'Gagal mengekspor file Excel.',
      });
    }
  };

  // Handler: Download PDF per Wilayah
  const handleDownloadPdf = (wilayahKey: string) => {
    setAlertInfo(null);
    const rows = matchedByWilayah.get(wilayahKey) || [];
    const totalRows = allByWilayah.get(wilayahKey)?.length || rows.length;

    if (rows.length === 0) {
      setAlertInfo({
        type: 'error',
        message: `Belum ada data final bersih untuk ${formatWilayahName(wilayahKey)}.`,
      });
      return;
    }

    const res = exportFinalRowsToPdf({
      wilayahLabel: wilayahKey,
      rows,
      totalRows,
    });

    if (res.success) {
      setAlertInfo({
        type: 'success',
        message: `Berhasil mencetak laporan PDF: "${res.filename}" (${rows.length.toLocaleString('id-ID')} dari ${totalRows.toLocaleString('id-ID')} baris wilayah ini).`,
      });
    } else {
      setAlertInfo({
        type: 'error',
        message: res.error || 'Gagal membuat dokumen PDF.',
      });
    }
  };

  // Handler: Download Semua Wilayah (Excel)
  const handleDownloadAllExcel = () => {
    setAlertInfo(null);
    if (allMatchedRows.length === 0) {
      setAlertInfo({
        type: 'error',
        message: 'Belum ada data final bersih yang tersedia untuk diunduh.',
      });
      return;
    }

    const res = exportFinalRowsToExcel(allMatchedRows, 'Semua_Wilayah');
    if (res.success) {
      setAlertInfo({
        type: 'success',
        message: `Berhasil mengunduh seluruh ${res.rowCount.toLocaleString('id-ID')} baris data final bersih ke file "${res.filename}".`,
      });
    } else {
      setAlertInfo({
        type: 'error',
        message: res.error || 'Gagal mengekspor data ke Excel.',
      });
    }
  };

  // Handler: Download Semua Wilayah (PDF)
  const handleDownloadAllPdf = () => {
    setAlertInfo(null);
    if (allMatchedRows.length === 0) {
      setAlertInfo({
        type: 'error',
        message: 'Belum ada data final bersih yang tersedia untuk diunduh.',
      });
      return;
    }

    const res = exportFinalRowsToPdf({
      wilayahLabel: 'Semua Wilayah',
      rows: allMatchedRows,
      totalRows: finalRows.length,
    });

    if (res.success) {
      setAlertInfo({
        type: 'success',
        message: `Berhasil mencetak laporan PDF eksekutif: "${res.filename}".`,
      });
    } else {
      setAlertInfo({
        type: 'error',
        message: res.error || 'Gagal membuat dokumen PDF.',
      });
    }
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: '1.1rem 1.25rem',
        background: '#ffffff',
        border: '1px solid #e9ebec',
        borderRadius: '6px',
        boxShadow: '0 1px 2px rgba(56, 65, 74, 0.05)',
      }}
    >
      {/* Top Header Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.85rem',
          borderBottom: '1px solid #f3f3f9',
          paddingBottom: '0.65rem',
          flexWrap: 'wrap',
          gap: '0.65rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'rgba(10, 179, 156, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0ab39c',
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={16} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#212529', margin: 0 }}>
              Rekapitulasi Data Final per Wilayah
            </h4>
            <span style={{ fontSize: '0.71rem', color: '#878a99' }}>
              Baris Data Final yang bersih dari anomali, per wilayah (5 wilayah teratas tampil, scroll ke bawah)
            </span>
          </div>
        </div>

        {/* Global Actions (Download All Excel / PDF) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleDownloadAllExcel}
            disabled={allMatchedRows.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.74rem',
              padding: '0.32rem 0.75rem',
              background: 'rgba(10, 179, 156, 0.1)',
              color: '#0ab39c',
              border: '1px solid rgba(10, 179, 156, 0.3)',
              fontWeight: 600,
              borderRadius: '4px',
              cursor: allMatchedRows.length === 0 ? 'not-allowed' : 'pointer',
            }}
            title="Unduh seluruh baris data final bersih (semua wilayah) dalam 1 file Excel"
          >
            <FileSpreadsheet size={13} />
            <span>Unduh Semua (.xlsx)</span>
          </button>

          <button
            type="button"
            className="btn btn-sm"
            onClick={handleDownloadAllPdf}
            disabled={allMatchedRows.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.74rem',
              padding: '0.32rem 0.75rem',
              background: 'rgba(240, 101, 72, 0.1)',
              color: '#f06548',
              border: '1px solid rgba(240, 101, 72, 0.3)',
              fontWeight: 600,
              borderRadius: '4px',
              cursor: allMatchedRows.length === 0 ? 'not-allowed' : 'pointer',
            }}
            title="Unduh laporan PDF data final bersih untuk semua wilayah"
          >
            <FileText size={13} />
            <span>Laporan Lengkap (.pdf)</span>
          </button>

          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.12rem 0.5rem',
              borderRadius: '4px',
              background: allMatchedRows.length > 0 ? 'rgba(10, 179, 156, 0.1)' : '#f3f3f9',
              color: allMatchedRows.length > 0 ? '#0ab39c' : '#878a99',
              border: allMatchedRows.length > 0 ? '1px solid rgba(10, 179, 156, 0.25)' : '1px solid #e9ebec',
            }}
          >
            {allMatchedRows.length.toLocaleString('id-ID')} Data Final Bersih
          </span>
        </div>
      </div>

      {/* Alert Feedback Notification */}
      {alertInfo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.45rem 0.75rem',
            marginBottom: '0.65rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            background: alertInfo.type === 'success' ? '#edfcf4' : '#fff5f5',
            border: alertInfo.type === 'success' ? '1px solid #a3e6cd' : '1px solid #fed7d7',
            color: alertInfo.type === 'success' ? '#0f766e' : '#c53030',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {alertInfo.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            <span>{alertInfo.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertInfo(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'inherit' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Data Table: 5 Records Visible + Sticky Header + Smooth Scroll */}
      <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '5px', overflowX: 'auto', maxHeight: '275px', overflowY: 'auto' }}>
        <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: '48px', textAlign: 'center', background: '#f3f6f9', color: '#405189', position: 'sticky', top: 0, zIndex: 3 }}>No</th>
              <th
                onClick={() => toggleSort('wilayah')}
                style={{ minWidth: '160px', color: '#405189', cursor: 'pointer', userSelect: 'none', position: 'sticky', top: 0, zIndex: 3, background: '#f3f6f9' }}
                title="Klik untuk mengurutkan berdasarkan Wilayah"
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  Wilayah Operasional
                  <span style={{ fontSize: '0.75rem', color: sortField === 'wilayah' ? '#405189' : '#adb5bd' }}>
                    {sortField === 'wilayah' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                  </span>
                </span>
              </th>
              <th
                onClick={() => toggleSort('matched')}
                style={{ minWidth: '140px', textAlign: 'center', color: '#405189', cursor: 'pointer', userSelect: 'none', position: 'sticky', top: 0, zIndex: 3, background: '#f3f6f9' }}
                title="Klik untuk mengurutkan berdasarkan jumlah baris bersih"
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                  Data Final Bersih
                  <span style={{ fontSize: '0.75rem', color: sortField === 'matched' ? '#405189' : '#adb5bd' }}>
                    {sortField === 'matched' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                  </span>
                </span>
              </th>
              <th
                onClick={() => toggleSort('total')}
                style={{ minWidth: '120px', textAlign: 'center', color: '#405189', cursor: 'pointer', userSelect: 'none', position: 'sticky', top: 0, zIndex: 3, background: '#f3f6f9' }}
                title="Klik untuk mengurutkan berdasarkan jumlah baris data final wilayah ini"
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                  Total Data Final
                  <span style={{ fontSize: '0.75rem', color: sortField === 'total' ? '#405189' : '#adb5bd' }}>
                    {sortField === 'total' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                  </span>
                </span>
              </th>
              <th
                onClick={() => toggleSort('rate')}
                style={{ minWidth: '180px', color: '#405189', cursor: 'pointer', userSelect: 'none', position: 'sticky', top: 0, zIndex: 3, background: '#f3f6f9' }}
                title="Klik untuk mengurutkan berdasarkan persentase baris bersih"
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  % Bersih
                  <span style={{ fontSize: '0.75rem', color: sortField === 'rate' ? '#405189' : '#adb5bd' }}>
                    {sortField === 'rate' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                  </span>
                </span>
              </th>
              <th style={{ minWidth: '130px', textAlign: 'center', color: '#405189', position: 'sticky', top: 0, zIndex: 3, background: '#f3f6f9' }}>Status</th>
              <th style={{ minWidth: '180px', textAlign: 'center', color: '#405189', position: 'sticky', top: 0, zIndex: 3, background: '#f3f6f9' }}>Aksi Unduh Laporan</th>
            </tr>
          </thead>
          <tbody>
            {displayedRegions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#878a99' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                    <Layers size={28} color="#adb5bd" />
                    <strong style={{ fontSize: '0.9rem', color: '#212529' }}>Belum Ada Data Final</strong>
                    <span style={{ fontSize: '0.75rem', color: '#878a99' }}>
                      Setujui data di menu Data Analyst atau unggah di menu Final Data untuk menampilkan rekapitulasi per wilayah.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              displayedRegions.map((region, idx) => {
                const matchedCount = (matchedByWilayah.get(region.wilayah) || []).length;
                const totalCount = region.total;
                const rate = totalCount > 0 ? (matchedCount / totalCount) * 100 : 0;
                const isOptimal = rate >= 95;
                const isGood = rate >= 75 && rate < 95;

                return (
                  <tr key={`reg-match-${region.wilayah}`} style={{ transition: 'background-color 0.15s ease' }}>
                    {/* 1. No */}
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#6c757d', background: '#f9fbfd' }}>
                      {idx + 1}
                    </td>

                    {/* 2. Wilayah */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            background: 'rgba(64, 81, 137, 0.08)',
                            color: '#405189',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: '#212529' }}>
                            {formatWilayahName(region.wilayah)}
                          </strong>
                        </div>
                      </div>
                    </td>

                    {/* 3. Jumlah baris bersih */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          background: matchedCount > 0 ? 'rgba(10, 179, 156, 0.1)' : '#f8f9fa',
                          color: matchedCount > 0 ? '#0ab39c' : '#878a99',
                          border: matchedCount > 0 ? '1px solid rgba(10, 179, 156, 0.25)' : '1px solid #e9ebec',
                        }}
                      >
                        <CheckCircle2 size={12} />
                        {matchedCount.toLocaleString('id-ID')} Data
                      </span>
                    </td>

                    {/* 4. Total baris Data Final wilayah ini */}
                    <td style={{ textAlign: 'center', fontSize: '0.78rem', color: '#495057', fontWeight: 500 }}>
                      {totalCount.toLocaleString('id-ID')} Data
                    </td>

                    {/* 5. Persentase baris bersih */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                          <span style={{ fontWeight: 600, color: isOptimal ? '#0ab39c' : isGood ? '#d68b0c' : '#f06548' }}>
                            {rate.toFixed(1)}% Bersih
                          </span>
                          <span style={{ color: '#878a99', fontSize: '0.67rem' }}>
                            {matchedCount} bersih dari {totalCount}
                          </span>
                        </div>
                        <div
                          style={{
                            height: '5px',
                            background: '#eef1f4',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(rate, 100)}%`,
                              height: '100%',
                              background: isOptimal ? '#0ab39c' : isGood ? '#f7b84b' : '#f06548',
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 6. Status Badge */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.12rem 0.45rem',
                          borderRadius: '3px',
                          background:
                            rate === 100
                              ? 'rgba(10, 179, 156, 0.12)'
                              : rate > 0
                              ? 'rgba(247, 184, 75, 0.15)'
                              : 'rgba(240, 101, 72, 0.12)',
                          color: rate === 100 ? '#0ab39c' : rate > 0 ? '#d68b0c' : '#f06548',
                        }}
                      >
                        {rate === 100 ? 'Bersih Semua' : rate > 0 ? 'Ada Anomali' : 'Semua Anomali'}
                      </span>
                    </td>

                    {/* 7. Action Buttons (Excel & PDF) */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {/* Download Excel */}
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleDownloadExcel(region.wilayah)}
                          disabled={matchedCount === 0}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.72rem',
                            padding: '0.25rem 0.55rem',
                            background: matchedCount > 0 ? 'rgba(10, 179, 156, 0.08)' : '#f8f9fa',
                            color: matchedCount > 0 ? '#0ab39c' : '#adb5bd',
                            border: matchedCount > 0 ? '1px solid rgba(10, 179, 156, 0.3)' : '1px solid #e9ebec',
                            borderRadius: '4px',
                            cursor: matchedCount === 0 ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            transition: 'all 0.15s ease',
                          }}
                          title={`Unduh Data Final Bersih ${formatWilayahName(region.wilayah)} format Excel`}
                        >
                          <FileSpreadsheet size={13} />
                          <span>Excel</span>
                        </button>

                        {/* Download PDF */}
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleDownloadPdf(region.wilayah)}
                          disabled={matchedCount === 0}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.72rem',
                            padding: '0.25rem 0.55rem',
                            background: matchedCount > 0 ? 'rgba(240, 101, 72, 0.08)' : '#f8f9fa',
                            color: matchedCount > 0 ? '#f06548' : '#adb5bd',
                            border: matchedCount > 0 ? '1px solid rgba(240, 101, 72, 0.3)' : '1px solid #e9ebec',
                            borderRadius: '4px',
                            cursor: matchedCount === 0 ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            transition: 'all 0.15s ease',
                          }}
                          title={`Unduh Laporan PDF ${formatWilayahName(region.wilayah)} (baris bersih)`}
                        >
                          <FileText size={13} />
                          <span>PDF</span>
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
    </div>
  );
};
