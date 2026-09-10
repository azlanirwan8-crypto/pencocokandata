import React, { useRef, useState } from 'react';
import { UploadCloud, Download, RefreshCw, AlertCircle, CheckCircle2, Lock, FileSpreadsheet, Check } from 'lucide-react';
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
  const [lastFileName, setLastFileName] = useState<string | null>(null);

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

      setLastFileName(file.name);
      onTargetLoaded(sanitized, file.name);
      setSuccessMessage(
        `Berhasil mengunggah ${sanitized.length.toLocaleString('id-ID')} baris target dari "${file.name}". Integritas baris N_in = ${sanitized.length} berhasil dikunci permanen.`
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
    <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
      {/* Velzon Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#212529', letterSpacing: '-0.01em' }}>
            Unggah Berkas Data Cek (19 Kolom Target)
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#878a99', marginTop: '0.15rem' }}>
            Unggah berkas transaksi operasional yang akan dicocokkan dengan master dan divalidasi kode pos PTEN.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => downloadTargetTemplate(false)}
            title="Unduh template Excel 19 kolom kosong"
          >
            <Download size={13} />
            <span>Template Target</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onLoadSample}
            title="Muat contoh transaksi operasional perbankan"
          >
            <RefreshCw size={13} />
            <span>Muat Contoh Data</span>
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
            Tarik & Lepas Berkas Target Operasional di Sini atau <span style={{ color: '#405189', textDecoration: 'underline' }}>Pilih Berkas</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#878a99', marginTop: '0.2rem' }}>
            Sistem membaca 19 kolom baku dan mencatat jumlah baris awal <strong>(N_in)</strong>. Kolom No terkunci otomatis.
          </p>
        </div>
      </div>

      {/* Velzon File Preview Card when target rows loaded */}
      {targetCount > 0 && (
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
                background: 'rgba(64, 81, 137, 0.1)',
                color: '#405189',
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
                <span>{lastFileName || 'Berkas Target Aktif'}</span>
                <span style={{ fontSize: '0.7rem', color: '#0ab39c', background: 'rgba(10, 179, 156, 0.1)', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Check size={11} /> Baris Terkunci
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#878a99', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Lock size={12} color="#405189" />
                <span>N_in = <strong>{targetCount.toLocaleString('id-ID')} Baris</strong> (Urutan Terkunci Permanen)</span>
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
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <div>{successMessage}</div>
        </div>
      )}
    </div>
  );
};
