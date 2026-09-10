import React, { useRef, useState } from 'react';
import { UploadCloud, Download, AlertCircle, CheckCircle, FileSpreadsheet, Check } from 'lucide-react';
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
      {/* Card Header khas Velzon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#212529', letterSpacing: '-0.01em' }}>
            Data Master Referensi Cabang
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#878a99', marginTop: '0.15rem' }}>
            Unggah file master cabang (mendukung format 1 kolom <strong>Sandi Cabang</strong> atau terpisah <strong>Sandi & Cabang</strong>).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
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

      {/* Velzon Signature Dropzone */}
      <div
        className={`dropzone-container ${isDragging ? 'drag-over' : ''}`}
        style={{
          border: isDragging ? '2px dashed #405189' : '2px dashed #ced4da',
          background: isDragging ? 'rgba(64, 81, 137, 0.04)' : '#f8f9fa',
          borderRadius: '6px',
          padding: '2.25rem 1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          transition: 'all 0.2s ease',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'rgba(64, 81, 137, 0.08)',
            color: '#405189',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <UploadCloud size={28} />
        </div>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#495057' }}>
            Tarik & Lepas Berkas Excel di Sini atau <span style={{ color: '#405189', textDecoration: 'underline' }}>Pilih Berkas</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#878a99', marginTop: '0.2rem' }}>
            Mendukung ekstensi .xlsx, .xls, .csv • Data tersimpan otomatis di Neon DB / Cloud & Browser
          </p>
        </div>
      </div>

      {/* Velzon File Preview Card when file is loaded */}
      {masterCount > 0 && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: '#ffffff',
            border: '1px solid #e9ebec',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(56, 65, 74, 0.05)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '6px',
                background: 'rgba(10, 179, 156, 0.1)',
                color: '#0ab39c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>{masterFileName || 'Data Master Aktif'}</span>
                <span style={{ fontSize: '0.7rem', color: '#0ab39c', background: 'rgba(10, 179, 156, 0.1)', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Check size={11} /> Aktif & Sinkron
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#878a99', marginTop: '0.1rem' }}>
                {masterCount.toLocaleString('id-ID')} Total Baris Referensi • Hash Indexing Siap
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileInputRef.current?.click()}
            style={{ fontSize: '0.75rem', color: '#405189' }}
          >
            Ganti Berkas
          </button>
        </div>
      )}

      {/* Velzon Alert: Error */}
      {errorMessage && (
        <div
          style={{
            marginTop: '0.85rem',
            padding: '0.75rem 1rem',
            borderRadius: '4px',
            background: 'rgba(240, 101, 72, 0.08)',
            border: '1px solid rgba(240, 101, 72, 0.25)',
            color: '#f06548',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.82rem',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Velzon Alert: Success */}
      {successMessage && (
        <div
          style={{
            marginTop: '0.85rem',
            padding: '0.75rem 1rem',
            borderRadius: '4px',
            background: 'rgba(10, 179, 156, 0.08)',
            border: '1px solid rgba(10, 179, 156, 0.25)',
            color: '#0ab39c',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.82rem',
          }}
        >
          <CheckCircle size={16} style={{ flexShrink: 0 }} />
          <div>{successMessage}</div>
        </div>
      )}
    </div>
  );
};
