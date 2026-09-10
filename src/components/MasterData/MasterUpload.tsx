import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import type { MasterRow } from '../../types';
import { parseExcelFile, validateMasterHeaders, downloadMasterTemplate } from '../../utils/excel';

interface MasterUploadProps {
  onMasterLoaded: (rows: MasterRow[], fileName: string) => void;
  onLoadSample: () => void;
  masterCount: number;
  masterFileName?: string;
}

export const MasterUpload: React.FC<MasterUploadProps> = ({
  onMasterLoaded,
  onLoadSample,
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

      // Verifikasi kecocokan header master (mendukung Sandi Cabang 1 kolom maupun Sandi & Cabang terpisah)
      const validation = validateMasterHeaders(headers);
      if (!validation.isValid) {
        setErrorMessage(
          `Header berkas tidak sesuai spesifikasi master cabang. Kolom yang belum ditemukan: [${validation.missing.join(', ')}]`
        );
        return;
      }

      if (data.length === 0) {
        setErrorMessage('File Excel master tidak berisi baris data.');
        return;
      }

      onMasterLoaded(data, file.name);
      setSuccessMessage(`Berhasil memuat ${data.length.toLocaleString('id-ID')} baris data master dari ${file.name}. In-Memory Hash Map O(1) telah dibangun.`);
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
            Modul Upload File Master (15 Kolom)
          </h2>
          <p className="section-subtitle">
            Unggah berkas referensi cabang (.xlsx). Sistem otomatis membangun In-Memory Hash Map KODE POS untuk latensi O(1).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => downloadMasterTemplate(false)}
            title="Unduh template Excel 15 kolom kosong"
          >
            <Download size={14} />
            <span>Template Master Kosong</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onLoadSample}
            title="Muat contoh data master cabang perbankan Indonesia"
          >
            <RefreshCw size={14} />
            <span>Muat Contoh Data Master (15 Kolom)</span>
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
            Klik atau Drag & Drop Berkas Master Cabang di Sini
          </div>
          <p className="dropzone-desc">
            Mendukung file format <strong>.xlsx</strong> dengan 15 kolom standar (Wilayah, Sandi, Cabang, Branch Code, Kode Cabang, Nama Outlet, Status Outlet, ALAMAT, KODE POS, Kelurahan, Kecamatan, Dati II, Kode Dati II, Provinsi, Telp).
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          <FileSpreadsheet size={15} />
          <span>Berkas: <strong>{masterFileName || 'Belum diunggah'}</strong> ({masterCount.toLocaleString('id-ID')} Baris Aktif)</span>
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
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <div>{successMessage}</div>
        </div>
      )}
    </div>
  );
};
