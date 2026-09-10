import React, { useState } from 'react';
import { Download, CheckCircle, ShieldAlert, FileSpreadsheet } from 'lucide-react';
import type { TargetRow } from '../../types';
import { exportTargetToExcel } from '../../utils/excel';

interface ExportActionProps {
  allTargetRows: TargetRow[];
  filteredRows: TargetRow[];
  selectedWilayah: string;
  totalInputRows: number;
}

export const ExportAction: React.FC<ExportActionProps> = ({
  allTargetRows,
  filteredRows,
  selectedWilayah,
  totalInputRows,
}) => {
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleDownloadAll = () => {
    setAlertInfo(null);
    const result = exportTargetToExcel(allTargetRows, 'SEMUA_WILAYAH', totalInputRows, false);

    if (!result.success) {
      setAlertInfo({
        type: 'error',
        message: result.error || 'Terjadi kesalahan integritas baris.',
      });
    } else {
      setAlertInfo({
        type: 'success',
        message: `Integritas Baris Terpenuhi (100% Valid): Berhasil mengunduh seluruh ${result.rowCount.toLocaleString('id-ID')} baris data ke berkas ${result.filename}.`,
      });
    }
  };

  const handleDownloadFiltered = () => {
    setAlertInfo(null);
    const result = exportTargetToExcel(filteredRows, selectedWilayah, totalInputRows, true);

    if (result.success) {
      setAlertInfo({
        type: 'success',
        message: `Berhasil mengunduh ${result.rowCount.toLocaleString('id-ID')} baris data terfilter (${selectedWilayah}) ke berkas ${result.filename}.`,
      });
    }
  };

  if (allTargetRows.length === 0) return null;

  const isFiltered = filteredRows.length !== allTargetRows.length;

  return (
    <div className="glass-card" style={{ marginTop: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet size={20} color="#34d399" />
            Ekspor Hasil Pencocokan (.xlsx)
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Sistem memvalidasi formula integritas: <span style={{ fontFamily: 'var(--font-mono)', color: '#34d399' }}>Total Baris Unduhan = N_in ({totalInputRows})</span>. Urutan baris dijamin 100% presisi.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isFiltered && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDownloadFiltered}
              id="btn-download-filtered"
            >
              <Download size={15} />
              <span>Unduh Wilayah Terfilter ({filteredRows.length.toLocaleString('id-ID')} Baris)</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-success"
            onClick={handleDownloadAll}
            id="btn-download-excel-all"
          >
            <Download size={16} />
            <span>Unduh Seluruh Data Excel (N_in: {totalInputRows.toLocaleString('id-ID')} Baris)</span>
          </button>
        </div>
      </div>

      {alertInfo && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.85rem 1.1rem',
            borderRadius: 'var(--radius-md)',
            background: alertInfo.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${alertInfo.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            color: alertInfo.type === 'success' ? '#34d399' : '#fb7185',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.85rem',
          }}
        >
          {alertInfo.type === 'success' ? <CheckCircle size={18} style={{ flexShrink: 0 }} /> : <ShieldAlert size={18} style={{ flexShrink: 0 }} />}
          <div>{alertInfo.message}</div>
        </div>
      )}
    </div>
  );
};
