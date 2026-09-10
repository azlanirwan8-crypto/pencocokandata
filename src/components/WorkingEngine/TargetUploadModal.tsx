import React, { useRef, useState } from 'react';
import { UploadCloud, Download, AlertCircle, CheckCircle, X, RotateCcw } from 'lucide-react';
import type { TargetRow } from '../../types';
import { parseExcelFile, validateTargetHeaders, downloadTargetTemplate } from '../../utils/excel';

interface TargetUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTargetLoaded: (rows: TargetRow[], fileName: string) => void;
  currentTargetCount: number;
}

export const TargetUploadModal: React.FC<TargetUploadModalProps> = ({
  isOpen,
  onClose,
  onTargetLoaded,
  currentTargetCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);
    setUploadProgress(15);
    setUploadStage('Mempersiapkan & membaca berkas Excel target...');

    try {
      await new Promise((r) => setTimeout(r, 120));
      setUploadProgress(45);
      setUploadStage('Mengekstrak baris data lembar kerja...');

      const { data, headers } = await parseExcelFile<TargetRow>(file);

      setUploadProgress(70);
      setUploadStage('Memvalidasi format & kolom data target...');
      await new Promise((r) => setTimeout(r, 100));

      // Verifikasi kecocokan header target
      const validation = validateTargetHeaders(headers);
      if (!validation.isValid) {
        setErrorMessage(
          `Header file tidak sesuai spesifikasi kolom target. Kolom belum ditemukan: [${validation.missing.join(', ')}]`
        );
        setIsLoading(false);
        return;
      }

      if (data.length === 0) {
        setErrorMessage('Berkas Excel target kosong.');
        setIsLoading(false);
        return;
      }

      setUploadProgress(88);
      setUploadStage('Menata nomor urut & validasi baris...');
      await new Promise((r) => setTimeout(r, 100));

      // Pastikan kolom No terisi rapi
      const sanitized = data.map((r, idx) => ({
        ...r,
        No: r.No !== undefined && r.No !== '' ? r.No : currentTargetCount + idx + 1,
      }));

      setUploadProgress(95);
      setUploadStage('Menyimpan data target baru...');
      await new Promise((r) => setTimeout(r, 100));

      onTargetLoaded(sanitized, file.name);

      setUploadProgress(100);
      setUploadStage('Proses selesai!');
      await new Promise((r) => setTimeout(r, 120));

      setIsLoading(false);
      setSuccessMessage(
        `Berhasil menambahkan ${sanitized.length.toLocaleString('id-ID')} baris data target dari "${file.name}".`
      );

      // Otomatis tutup modal setelah 1.5 detik jika sukses
      setTimeout(() => {
        if (fileInputRef.current) fileInputRef.current.value = '';
        onClose();
        setSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsLoading(false);
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

  const handleClose = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      onClick={handleClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          border: '1px solid #e9ebec',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e9ebec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(53, 119, 241, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3577f1',
              }}
            >
              <UploadCloud size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                Upload & Tambah Data Cek (Target)
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#878a99', margin: '0.1rem 0 0 0' }}>
                Saat ini tersimpan {currentTargetCount.toLocaleString('id-ID')} baris data target
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#878a99',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem' }}>


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

          {/* Dropzone Area */}
          <div
            className={`dropzone-container ${isDragging ? 'drag-over' : ''}`}
            style={{
              border: isDragging ? '2px dashed #3577f1' : '2px dashed #ced4da',
              background: isDragging ? 'rgba(53, 119, 241, 0.04)' : '#f8f9fa',
              borderRadius: '6px',
              padding: '2rem 1.25rem',
              textAlign: 'center',
              cursor: isLoading ? 'wait' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
            }}
            onClick={() => {
              if (!isLoading) fileInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isLoading ? (
              <div style={{ width: '100%', padding: '0.5rem 0.25rem' }}>
                <RotateCcw size={28} color="#3577f1" className="pulse-dot" style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3577f1' }}>
                    {uploadStage || 'Sedang membaca berkas target...'}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3577f1' }}>
                    {uploadProgress}%
                  </span>
                </div>
                {/* Modern Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: '#e9ebec', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${uploadProgress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3577f1 0%, #0ab39c 100%)',
                      borderRadius: '4px',
                      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#878a99', marginTop: '0.5rem', textAlign: 'center' }}>
                  Mohon jangan menutup jendela selama proses pembacaan & penataan data
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(53, 119, 241, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3577f1',
                  }}
                >
                  <UploadCloud size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#212529' }}>
                    Tarik berkas ke sini atau <span style={{ color: '#3577f1', textDecoration: 'underline' }}>Pilih File</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#878a99', marginTop: '0.2rem' }}>
                    Mendukung format: .xlsx, .xls, .csv (Sampai kolom Provinsi)
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div
              style={{
                marginTop: '0.85rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '4px',
                background: 'rgba(240, 101, 72, 0.08)',
                border: '1px solid rgba(240, 101, 72, 0.25)',
                color: '#f06548',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                marginTop: '0.85rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '4px',
                background: 'rgba(10, 179, 156, 0.08)',
                border: '1px solid rgba(10, 179, 156, 0.25)',
                color: '#0ab39c',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
              }}
            >
              <CheckCircle size={15} style={{ flexShrink: 0 }} />
              <div>{successMessage}</div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e9ebec',
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => downloadTargetTemplate(false)}
            title="Unduh format template Excel target"
            style={{ fontSize: '0.78rem' }}
          >
            <Download size={13} />
            <span>Unduh Template Target</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleClose}
            style={{ fontSize: '0.78rem' }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
