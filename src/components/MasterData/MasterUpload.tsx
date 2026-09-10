import React, { useRef, useState } from 'react';
import { UploadCloud, Download, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import type { MasterRow } from '../../types';
import { parseExcelFile, validateMasterHeaders, downloadMasterTemplate } from '../../utils/excel';

interface MasterUploadProps {
  onMasterLoaded: (rows: MasterRow[], fileName: string) => void;
  onLoadSample?: () => void;
  masterCount: number;
  masterFileName?: string;
}

export const MasterUpload: React.FC<MasterUploadProps> = ({
  onMasterLoaded,
  masterCount,
  masterFileName,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, headers } = await parseExcelFile<MasterRow>(file);

      // Verifikasi kecocokan header master (mendukung Sandi Cabang 1 kolom maupun terpisah)
      const validation = validateMasterHeaders(headers);
      if (!validation.isValid) {
        setErrorMessage(
          `Header berkas belum lengkap. Kolom tidak ditemukan: [${validation.missing.join(', ')}]`
        );
        return;
      }

      if (data.length === 0) {
        setErrorMessage('File Excel master tidak berisi baris data.');
        return;
      }

      onMasterLoaded(data, file.name);
      setSuccessMessage(`Berhasil memuat ${data.length.toLocaleString('id-ID')} baris data master dari "${file.name}". Hash index O(1) aktif.`);
    } catch (err: any) {
      setErrorMessage(`Gagal membaca berkas: ${err?.message || 'Format Excel tidak valid'}`);
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
    <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Data Master Referensi Cabang
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Mendukung format 1 kolom <strong>Sandi Cabang</strong> atau terpisah (Sandi & Cabang).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {masterCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#34d399',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <FileSpreadsheet size={14} />
              <span>{masterFileName || 'Data Aktif'} ({masterCount.toLocaleString('id-ID')} Baris)</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => downloadMasterTemplate(false)}
            title="Unduh template Excel master kosong"
          >
            <Download size={13} />
            <span>Template Excel</span>
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

      {/* Clean compact dropzone */}
      <div
        className={`dropzone-container ${isDragging ? 'drag-over' : ''}`}
        style={{ padding: '1.5rem', cursor: 'pointer', gap: '0.5rem' }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="dropzone-icon" style={{ width: '42px', height: '42px' }}>
          <UploadCloud size={22} />
        </div>
        <div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
            Klik untuk memilih atau Drag & Drop berkas Excel Data Master di sini
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Format .xlsx / .xls • Otomatis tersimpan di browser
          </p>
        </div>
      </div>

      {errorMessage && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <div>{errorMessage}</div>
        </div>
      )}

      {successMessage && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
          <CheckCircle size={16} style={{ flexShrink: 0 }} />
          <div>{successMessage}</div>
        </div>
      )}
    </div>
  );
};
