import React, { useState, useMemo } from 'react';
import { Download, CheckCircle, ShieldAlert, FileSpreadsheet, MapPin } from 'lucide-react';
import type { TargetRow } from '../../types';
import { exportTargetToExcel } from '../../utils/excel';
import { formatWilayahName } from '../../utils/normalizer';

interface ExportActionProps {
  allTargetRows: TargetRow[];
  filteredRows?: TargetRow[];
  selectedWilayah?: string;
  totalInputRows: number;
}

export const ExportAction: React.FC<ExportActionProps> = ({
  allTargetRows,
  totalInputRows,
}) => {
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Download mode: isAllChecked (true = unduh semua data urut wilayah, false = filter wilayah tertentu)
  const [isAllChecked, setIsAllChecked] = useState<boolean>(true);
  const [selectedExportWilayah, setSelectedExportWilayah] = useState<string>('ALL');

  // Extract unique Wilayah list and count per wilayah
  const { wilayahList, wilayahCounts } = useMemo(() => {
    const map = new Map<string, number>();
    allTargetRows.forEach((r) => {
      const w = String(r.Wilayah || 'Tanpa Wilayah').trim();
      map.set(w, (map.get(w) || 0) + 1);
    });

    const list = Array.from(map.keys()).sort();
    return { wilayahList: list, wilayahCounts: map };
  }, [allTargetRows]);

  // Compute dataset to export
  const exportData = useMemo(() => {
    if (isAllChecked || selectedExportWilayah === 'ALL') {
      // KETIKA CEKLIST ALL:
      // Seluruh data di-download dan DIURUTKAN BERDASARKAN WILAYAH (A-Z)
      const sorted = [...allTargetRows].sort((a, b) => {
        const wA = String(a.Wilayah || '').trim();
        const wB = String(b.Wilayah || '').trim();
        const cmp = wA.localeCompare(wB, 'id', { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return (Number(a.No) || 0) - (Number(b.No) || 0);
      });
      return {
        rows: sorted,
        label: 'SEMUA_WILAYAH_URUT',
        isFiltered: false,
      };
    } else {
      // KETIKA DI-FILTER SESUAI WILAYAH:
      const filtered = allTargetRows.filter(
        (r) => String(r.Wilayah || 'Tanpa Wilayah').trim() === selectedExportWilayah
      );
      return {
        rows: filtered,
        label: selectedExportWilayah,
        isFiltered: true,
      };
    }
  }, [allTargetRows, isAllChecked, selectedExportWilayah]);

  if (allTargetRows.length === 0) return null;

  const handleDownload = () => {
    setAlertInfo(null);
    const { rows, label, isFiltered } = exportData;

    const result = exportTargetToExcel(
      rows,
      label,
      isFiltered ? rows.length : totalInputRows || allTargetRows.length,
      isFiltered
    );

    if (!result.success) {
      setAlertInfo({
        type: 'error',
        message: result.error || 'Terjadi kesalahan saat memproses ekspor Excel.',
      });
    } else {
      const infoText = isFiltered
        ? `Berhasil mengunduh ${result.rowCount.toLocaleString('id-ID')} baris data ke berkas "${result.filename}" (Tab sheet: ${result.filename.replace('.xlsx', '')}).`
        : `Berhasil mengunduh seluruh ${result.rowCount.toLocaleString('id-ID')} baris data ke berkas "${result.filename}" (Dikelompokkan per tab sheet wilayah: W01, W02, dst).`;

      setAlertInfo({
        type: 'success',
        message: infoText,
      });
    }
  };

  return (
    <div
      className="glass-card"
      style={{
        marginTop: '0.65rem',
        padding: '0.65rem 1.15rem',
        background: '#ffffff',
        border: '1px solid #e9ebec',
        borderRadius: '6px',
        boxShadow: '0 1px 2px rgba(56, 65, 74, 0.05)',
        overflowX: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          gap: '1rem',
          minWidth: '780px',
        }}
      >
        {/* Left Side: Title & Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              background: 'rgba(10, 179, 156, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0ab39c',
              flexShrink: 0,
            }}
          >
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#212529', margin: 0, whiteSpace: 'nowrap' }}>
              Ekspor Hasil Pencocokan (.xlsx)
            </h4>
          </div>
        </div>

        {/* Right Side: Controls in 1 Single Line (Checkbox ALL, Filter Wilayah, Download Button) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
          {/* Checkbox ALL */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: isAllChecked ? '#0ab39c' : '#495057',
              background: isAllChecked ? 'rgba(10, 179, 156, 0.08)' : '#f8f9fa',
              border: isAllChecked ? '1px solid rgba(10, 179, 156, 0.3)' : '1px solid #ced4da',
              padding: '0.35rem 0.65rem',
              borderRadius: '4px',
              transition: 'all 0.15s ease',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
            id="label-download-all"
          >
            <input
              type="checkbox"
              checked={isAllChecked}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsAllChecked(checked);
                if (checked) {
                  setSelectedExportWilayah('ALL');
                } else if (wilayahList.length > 0) {
                  setSelectedExportWilayah(wilayahList[0]);
                }
              }}
              style={{ accentColor: '#0ab39c', cursor: 'pointer', width: '14px', height: '14px' }}
              id="checkbox-download-all"
            />
            <span>Semua Wilayah (ALL)</span>
          </label>

          {/* Dropdown Filter Wilayah */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <MapPin size={13} color="#405189" />
            <select
              className="filter-select"
              value={selectedExportWilayah}
              disabled={isAllChecked}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedExportWilayah(val);
                if (val === 'ALL') {
                  setIsAllChecked(true);
                } else {
                  setIsAllChecked(false);
                }
              }}
              id="select-export-wilayah"
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.78rem',
                borderRadius: '4px',
                borderColor: isAllChecked ? '#e9ebec' : '#ced4da',
                background: isAllChecked ? '#f8f9fa' : '#ffffff',
                color: isAllChecked ? '#878a99' : '#212529',
                cursor: isAllChecked ? 'not-allowed' : 'pointer',
                maxWidth: '220px',
              }}
              title={isAllChecked ? 'Hilangkan centang "Semua Wilayah" untuk memilih wilayah spesifik' : 'Pilih Wilayah untuk diunduh'}
            >
              <option value="ALL">Semua Wilayah ({allTargetRows.length.toLocaleString('id-ID')} Baris)</option>
              {wilayahList.map((w) => {
                const count = wilayahCounts.get(w) || 0;
                return (
                  <option key={w} value={w}>
                    {formatWilayahName(w)} ({count.toLocaleString('id-ID')} Baris)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Download Button */}
          <button
            type="button"
            className="btn btn-success"
            onClick={handleDownload}
            id="btn-execute-download"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.4rem 0.95rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: '#0ab39c',
              borderColor: '#0ab39c',
              color: '#ffffff',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(10, 179, 156, 0.2)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title={isAllChecked ? `Unduh ${allTargetRows.length} baris diurutkan berdasarkan wilayah` : `Unduh data wilayah ${selectedExportWilayah}`}
          >
            <Download size={14} />
            <span>
              {isAllChecked
                ? `Unduh Excel (${allTargetRows.length.toLocaleString('id-ID')} Baris - Urut Wilayah)`
                : `Unduh Excel (${exportData.rows.length.toLocaleString('id-ID')} Baris)`}
            </span>
          </button>
        </div>
      </div>

      {/* Alert info */}
      {alertInfo && (
        <div
          style={{
            marginTop: '0.85rem',
            padding: '0.65rem 0.85rem',
            borderRadius: '4px',
            background: alertInfo.type === 'success' ? 'rgba(10, 179, 156, 0.08)' : 'rgba(240, 101, 72, 0.08)',
            border: `1px solid ${alertInfo.type === 'success' ? 'rgba(10, 179, 156, 0.25)' : 'rgba(240, 101, 72, 0.25)'}`,
            color: alertInfo.type === 'success' ? '#0ab39c' : '#f06548',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
          }}
        >
          {alertInfo.type === 'success' ? (
            <CheckCircle size={15} style={{ flexShrink: 0 }} />
          ) : (
            <ShieldAlert size={15} style={{ flexShrink: 0 }} />
          )}
          <div>{alertInfo.message}</div>
        </div>
      )}
    </div>
  );
};
