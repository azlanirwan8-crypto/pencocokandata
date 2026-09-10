import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  CheckCircle,
  AlertCircle,
  Layers,
} from 'lucide-react';
import type { TargetRow, WilayahStat } from '../../types';
import { formatWilayahName } from '../../utils/normalizer';
import { exportCleanMatchedToExcel } from '../../utils/excel';
import { exportMatchedDataToPdf } from '../../utils/pdfExport';

interface DashboardMatchTableProps {
  allTargetRows: TargetRow[];
  regionalStats: WilayahStat[];
  selectedWilayah?: string;
}

export const DashboardMatchTable: React.FC<DashboardMatchTableProps> = ({
  allTargetRows,
  regionalStats,
  selectedWilayah = 'ALL',
}) => {
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Helper to determine if a row is clean matched data
  const isRowMatched = (r: TargetRow) =>
    Boolean(r._isMatched) || Boolean(r.Sandi) || Boolean(r['Sandi Cabang']) || Boolean(r.Cabang);

  // Filter matched data
  const allMatchedRows = useMemo(() => {
    return allTargetRows.filter(isRowMatched);
  }, [allTargetRows]);

  // Group matched rows by Wilayah
  const matchedByWilayah = useMemo(() => {
    const map = new Map<string, TargetRow[]>();
    allMatchedRows.forEach((r) => {
      const w = String(r.Wilayah || 'Tanpa Wilayah').trim();
      let arr = map.get(w);
      if (!arr) {
        arr = [];
        map.set(w, arr);
      }
      arr.push(r);
    });
    return map;
  }, [allMatchedRows]);

  // Group ALL target rows by Wilayah (for totals)
  const allByWilayah = useMemo(() => {
    const map = new Map<string, TargetRow[]>();
    allTargetRows.forEach((r) => {
      const w = String(r.Wilayah || 'Tanpa Wilayah').trim();
      let arr = map.get(w);
      if (!arr) {
        arr = [];
        map.set(w, arr);
      }
      arr.push(r);
    });
    return map;
  }, [allTargetRows]);

  // Filter regional stats based on selected Wilayah filter in Dashboard
  const displayedRegions = useMemo(() => {
    let list = [...regionalStats];
    if (selectedWilayah && selectedWilayah !== 'ALL') {
      list = list.filter((s) => String(s.wilayah).trim() === String(selectedWilayah).trim());
    }
    // Urutkan dari total data terbanyak
    return list.sort((a, b) => b.total - a.total);
  }, [regionalStats, selectedWilayah]);

  // Handler: Download Excel per Wilayah
  const handleDownloadExcel = (wilayahKey: string) => {
    setAlertInfo(null);
    const rows = matchedByWilayah.get(wilayahKey) || [];
    if (rows.length === 0) {
      setAlertInfo({
        type: 'error',
        message: `Belum ada data match (bersih) untuk ${formatWilayahName(wilayahKey)}.`,
      });
      return;
    }

    const res = exportCleanMatchedToExcel(rows, wilayahKey);
    if (res.success) {
      setAlertInfo({
        type: 'success',
        message: `Berhasil mengunduh ${res.rowCount.toLocaleString('id-ID')} data match ke file "${res.filename}".`,
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
        message: `Belum ada data match (bersih) untuk ${formatWilayahName(wilayahKey)}.`,
      });
      return;
    }

    const res = exportMatchedDataToPdf({
      wilayahLabel: wilayahKey,
      rows,
      totalTargetRows: totalRows,
    });

    if (res.success) {
      setAlertInfo({
        type: 'success',
        message: `Berhasil mencetak laporan PDF profesional: "${res.filename}".`,
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
        message: 'Belum ada data match yang tersedia untuk diunduh.',
      });
      return;
    }

    const res = exportCleanMatchedToExcel(allMatchedRows, 'Semua_Wilayah');
    if (res.success) {
      setAlertInfo({
        type: 'success',
        message: `Berhasil mengunduh seluruh ${res.rowCount.toLocaleString('id-ID')} data match ke file "${res.filename}".`,
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
        message: 'Belum ada data match yang tersedia untuk diunduh.',
      });
      return;
    }

    const res = exportMatchedDataToPdf({
      wilayahLabel: 'Semua Wilayah',
      rows: allMatchedRows,
      totalTargetRows: allTargetRows.length,
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
              Rekapitulasi Data Match per Wilayah (Data Bersih)
            </h4>
            <span style={{ fontSize: '0.71rem', color: '#878a99' }}>
              Daftar data target yang telah berhasil cocok dengan master cabang operasional beserta opsi ekspor
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
            title="Unduh seluruh data match semua wilayah dalam 1 file Excel"
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
            title="Unduh dokumen laporan PDF eksekutif untuk semua wilayah"
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
            {allMatchedRows.length.toLocaleString('id-ID')} Data Match
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

      {/* Data Table */}
      <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '5px', overflowX: 'auto' }}>
        <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: '48px', textAlign: 'center', background: '#f3f6f9', color: '#405189' }}>No</th>
              <th style={{ minWidth: '160px', color: '#405189' }}>Wilayah Operasional</th>
              <th style={{ minWidth: '140px', textAlign: 'center', color: '#405189' }}>Data Match (Bersih)</th>
              <th style={{ minWidth: '120px', textAlign: 'center', color: '#405189' }}>Total Target</th>
              <th style={{ minWidth: '180px', color: '#405189' }}>Tingkat Keberhasilan</th>
              <th style={{ minWidth: '130px', textAlign: 'center', color: '#405189' }}>Status</th>
              <th style={{ minWidth: '180px', textAlign: 'center', color: '#405189' }}>Aksi Unduh Laporan</th>
            </tr>
          </thead>
          <tbody>
            {displayedRegions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#878a99' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                    <Layers size={28} color="#adb5bd" />
                    <strong style={{ fontSize: '0.9rem', color: '#212529' }}>Belum Ada Data Target</strong>
                    <span style={{ fontSize: '0.75rem', color: '#878a99' }}>
                      Unggah data target di menu Data Cek untuk menampilkan rekapitulasi data match.
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
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#6c757d', background: '#fcfdfe' }}>
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

                    {/* 3. Jumlah Data Match */}
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

                    {/* 4. Total Target */}
                    <td style={{ textAlign: 'center', fontSize: '0.78rem', color: '#495057', fontWeight: 500 }}>
                      {totalCount.toLocaleString('id-ID')} Data
                    </td>

                    {/* 5. Tingkat Keberhasilan (Progress Bar) */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                          <span style={{ fontWeight: 600, color: isOptimal ? '#0ab39c' : isGood ? '#d97706' : '#f06548' }}>
                            {rate.toFixed(1)}% Cocok
                          </span>
                          <span style={{ color: '#878a99', fontSize: '0.67rem' }}>
                            {matchedCount} dari {totalCount}
                          </span>
                        </div>
                        <div
                          style={{
                            height: '5px',
                            background: '#eff2f7',
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
                          color: rate === 100 ? '#0ab39c' : rate > 0 ? '#d97706' : '#f06548',
                        }}
                      >
                        {rate === 100 ? 'Lengkap 100%' : rate > 0 ? 'Sebagian Cocok' : 'Belum Cocok'}
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
                          title={`Unduh Data Match ${formatWilayahName(region.wilayah)} format Excel`}
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
                          title={`Unduh Laporan PDF ${formatWilayahName(region.wilayah)}`}
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
