import React, { useRef, useState } from 'react';
import { UploadCloud, Download, AlertCircle, CheckCircle, X, RotateCcw, PlusCircle } from 'lucide-react';
import type { MasterRow } from '../../types';
import { parseExcelFile, validateMasterHeaders, downloadMasterTemplate } from '../../utils/excel';

interface MasterUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMasterLoaded: (rows: MasterRow[], fileName: string) => void;
  currentMasterCount: number;
}

export const MasterUploadModal: React.FC<MasterUploadModalProps> = ({
  isOpen,
  onClose,
  onMasterLoaded,
  currentMasterCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const { data, headers } = await parseExcelFile<MasterRow>(file);

      // Verifikasi kecocokan header master
      const validation = validateMasterHeaders(headers);
      if (!validation.isValid) {
        setErrorMessage(
          `Header berkas belum lengkap. Kolom tidak ditemukan: [${validation.missing.join(', ')}]`
        );
        setIsLoading(false);
        return;
      }

      if (data.length === 0) {
        setErrorMessage('Berkas Excel master tidak berisi baris data.');
        setIsLoading(false);
        return;
      }

      onMasterLoaded(data, file.name);
      setSuccessMessage(
        `Berhasil menambahkan ${data.length.toLocaleString('id-ID')} baris data master dari "${file.name}".`
      );
      setIsLoading(false);

      // Otomatis tutup modal setelah 1.2 detik jika sukses
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1200);
    } catch (err: any) {
      setIsLoading(false);
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

  const handleClose = () => {
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
                background: 'rgba(64, 81, 137, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#405189',
              }}
            >
              <UploadCloud size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                Upload & Tambah Data Master
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#878a99', margin: '0.1rem 0 0 0' }}>
                Saat ini tersimpan {currentMasterCount.toLocaleString('id-ID')} cabang
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
          {/* Info Append Banner */}
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '6px',
              background: 'rgba(64, 81, 137, 0.06)',
              border: '1px solid rgba(64, 81, 137, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.78rem',
              color: '#405189',
            }}
          >
            <PlusCircle size={15} style={{ flexShrink: 0 }} />
            <span>
              Berkas yang diunggah akan <strong>menambahkan data baru</strong> ke database master yang sudah ada.
            </span>
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

          {/* Dropzone Area */}
          <div
            className={`dropzone-container ${isDragging ? 'drag-over' : ''}`}
            style={{
              border: isDragging ? '2px dashed #405189' : '2px dashed #ced4da',
              background: isDragging ? 'rgba(64, 81, 137, 0.04)' : '#f8f9fa',
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
              <>
                <RotateCcw size={32} color="#405189" className="pulse-dot" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#405189' }}>
                  Sedang membaca berkas Excel...
                </span>
                <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
                  Mohon tunggu beberapa saat
                </span>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(64, 81, 137, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#405189',
                  }}
                >
                  <UploadCloud size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#212529' }}>
                    Tarik berkas ke sini atau <span style={{ color: '#405189', textDecoration: 'underline' }}>Pilih File</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#878a99', marginTop: '0.2rem' }}>
                    Mendukung format: .xlsx, .xls, .csv
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
            onClick={() => downloadMasterTemplate(false)}
            title="Unduh format template Excel master"
            style={{ fontSize: '0.78rem' }}
          >
            <Download size={13} />
            <span>Unduh Template Master</span>
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
