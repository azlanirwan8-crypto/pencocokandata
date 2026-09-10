import React, { useRef, useState } from 'react';
import { UploadCloud, Download, RefreshCw, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import type { TargetRow } from '../../types';
import { parseExcelFile, validateTargetHeaders, downloadTargetTemplate } from '../../utils/excel';

interface TargetUploadProps {
  onTargetLoaded: (rows: TargetRow[], fileName: string) => void;
  onLoadSample: () => void;
  targetCount: number;
}

export const TargetUpload: React.FC<TargetUploadProps> = ({
  onTargetLoaded,
  onLoadSample,
  targetCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, headers } = await parseExcelFile<TargetRow>(file);

      // Verifikasi kecocokan header target (mendukung Sandi Cabang 1 kolom maupun terpisah)
      const validation = validateTargetHeaders(headers);
      if (!validation.isValid) {
        setErrorMessage(
          `Header file tidak sesuai spesifikasi kolom target. Kolom belum ditemukan: [${validation.missing.join(', ')}]`
        );
        return;
      }

      if (data.length === 0) {
        setErrorMessage('Berkas Excel target kosong.');
        return;
      }

      // Pastikan kolom No terkunci berurutan 1..N jika kosong
      const sanitized = data.map((r, idx) => ({
        ...r,
        No: r.No !== undefined && r.No !== '' ? r.No : idx + 1,
      }));

      onTargetLoaded(sanitized, file.name);
      setSuccessMessage(
        `Berhasil mengunggah ${sanitized.length.toLocaleString('id-ID')} baris target dari ${file.name}. Integritas baris N_in = ${sanitized.length} berhasil dikunci permanen.`
      );
    } catch (err: any) {
      setErrorMessage(`Gagal membaca berkas Excel: ${err?.message || 'Format tidak valid'}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="glass-card">
      <div className="section-header">
        <div>
          <h2 className="section-title" style={{ fontSize: '1.25rem' }}>
            Upload Target File (19 Kolom)
          </h2>
          <p className="section-subtitle">
            Unggah file transaksi operasional cabang yang akan diperkaya 7 atribut master dan divalidasi kode pos PTEN.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => downloadTargetTemplate(false)}
            title="Unduh template Excel 19 kolom kosong"
          >
            <Download size={14} />
            <span>Template Target Kosong</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onLoadSample}
            title="Muat contoh transaksi operasional perbankan"
          >
            <RefreshCw size={14} />
            <span>Muat Contoh Data Target (19 Kolom)</span>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
          }
        }}
      />

      <div
        className={`dropzone-container ${isDragging ? 'drag-over' : ''}`}
        style={{ marginTop: '1.25rem' }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="dropzone-icon">
          <UploadCloud size={30} />
        </div>
        <div>
          <div className="dropzone-title">
            Klik atau Drag & Drop Berkas Target Operasional di Sini
          </div>
          <p className="dropzone-desc">
            Sistem membaca 19 kolom baku dan mencatat jumlah baris awal <strong>(N_in)</strong>. Kolom No dikunci permanen agar urutan tidak bergeser.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#60a5fa', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
          <Lock size={15} />
          <span>Baris Terkunci (N_in): <strong>{targetCount.toLocaleString('id-ID')} Data</strong></span>
        </div>
      </div>

      {errorMessage && (
        <div style={{ marginTop: '1rem', padding: '0.85rem 1.1rem', borderRadius: 'var(--radius-md)', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>{errorMessage}</div>
        </div>
      )}

      {successMessage && (
        <div style={{ marginTop: '1rem', padding: '0.85rem 1.1rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <div>{successMessage}</div>
        </div>
      )}
    </div>
  );
};
