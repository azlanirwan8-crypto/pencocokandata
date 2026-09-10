import React, { useRef, useState } from 'react';
import { UploadCloud, Download, AlertCircle, CheckCircle, X, RotateCcw } from 'lucide-react';
import type { MasterRow } from '../../types';
import { parseExcelFile, validateMasterHeaders, downloadMasterTemplate } from '../../utils/excel';

interface MasterUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMasterLoaded: (rows: MasterRow[], fileName: string) => void;
  currentMasterCount: number;
  existingMasterRows?: MasterRow[];
}

export const MasterUploadModal: React.FC<MasterUploadModalProps> = ({
  isOpen,
  onClose,
  onMasterLoaded,
  currentMasterCount,
  existingMasterRows = [],
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [duplicateReport, setDuplicateReport] = useState<{
    totalRows: number;
    newAdded: number;
    duplicateCount: number;
    duplicateSamples: string[];
  } | null>(null);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setDuplicateReport(null);
    setIsLoading(true);
    setUploadProgress(15);
    setUploadStage('Mempersiapkan & membaca berkas Excel...');

    try {
      await new Promise((r) => setTimeout(r, 120));
      setUploadProgress(40);
      setUploadStage('Membaca data lembar kerja...');

      const { data, headers } = await parseExcelFile<MasterRow>(file);

      setUploadProgress(60);
      setUploadStage('Memvalidasi format & kelengkapan kolom...');
      await new Promise((r) => setTimeout(r, 100));

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

      setUploadProgress(78);
      setUploadStage('Memeriksa & menyaring data duplikat...');
      await new Promise((r) => setTimeout(r, 150));

      // Bangun indeks fingerprint dari data master yang sudah ada
      const existingKeys = new Set<string>();
      for (const r of existingMasterRows) {
        const bc = String(r['Branch Code'] || r['Kode Cabang'] || '').trim().toUpperCase();
        const name = String(r['Nama Outlet'] || r['Sandi Cabang'] || r.Cabang || '').trim().toUpperCase();
        const kp = String(r['KODE POS'] || '').trim();
        const addr = String(r.ALAMAT || '').trim().toUpperCase();

        if (bc && bc !== '-' && bc !== '0') existingKeys.add(`bc:${bc}`);
        if (name && kp) existingKeys.add(`ot:${name}|${kp}`);
        if (name && addr) existingKeys.add(`oa:${name}|${addr}`);
      }

      // Saring data baru untuk mencegah duplikasi (baik terhadap master yang ada maupun internal berkas)
      const uniqueRows: MasterRow[] = [];
      const duplicateSamples: string[] = [];
      let duplicateCount = 0;

      for (const r of data) {
        const bc = String(r['Branch Code'] || r['Kode Cabang'] || '').trim().toUpperCase();
        const name = String(r['Nama Outlet'] || r['Sandi Cabang'] || r.Cabang || '').trim();
        const kp = String(r['KODE POS'] || '').trim();
        const addr = String(r.ALAMAT || '').trim().toUpperCase();

        const branchKey = bc && bc !== '-' && bc !== '0' ? `bc:${bc}` : '';
        const outletKey = name && kp ? `ot:${name.toUpperCase()}|${kp}` : '';
        const outletAddrKey = name && addr ? `oa:${name.toUpperCase()}|${addr}` : '';

        const isDuplicate =
          (branchKey && existingKeys.has(branchKey)) ||
          (outletKey && existingKeys.has(outletKey)) ||
          (outletAddrKey && existingKeys.has(outletAddrKey));

        if (isDuplicate) {
          duplicateCount++;
          if (duplicateSamples.length < 8) {
            const label = name ? `${name}${bc ? ` (${bc})` : ''}` : (bc || 'Baris Duplikat');
            if (!duplicateSamples.includes(label)) {
              duplicateSamples.push(label);
            }
          }
        } else {
          // Tandai key agar baris kembar berikutnya dalam file yang sama juga tersaring
          if (branchKey) existingKeys.add(branchKey);
          if (outletKey) existingKeys.add(outletKey);
          if (outletAddrKey) existingKeys.add(outletAddrKey);
          uniqueRows.push(r);
        }
      }

      setUploadProgress(92);
      setUploadStage('Menyimpan data master baru...');
      await new Promise((r) => setTimeout(r, 120));

      if (uniqueRows.length > 0) {
        onMasterLoaded(uniqueRows, file.name);
      }

      setUploadProgress(100);
      setUploadStage('Proses selesai!');
      await new Promise((r) => setTimeout(r, 150));

      setIsLoading(false);
      setDuplicateReport({
        totalRows: data.length,
        newAdded: uniqueRows.length,
        duplicateCount,
        duplicateSamples,
      });

      if (uniqueRows.length > 0 && duplicateCount === 0) {
        setSuccessMessage(
          `Berhasil menambahkan seluruh ${uniqueRows.length.toLocaleString('id-ID')} baris data master dari "${file.name}" (0 data duplikat).`
        );
        // Otomatis tutup jika 100% data baru dan tanpa duplikat
        setTimeout(() => {
          if (fileInputRef.current) fileInputRef.current.value = '';
          onClose();
          setSuccessMessage(null);
          setDuplicateReport(null);
        }, 1800);
      } else if (uniqueRows.length > 0 && duplicateCount > 0) {
        setSuccessMessage(
          `Berhasil menambahkan ${uniqueRows.length.toLocaleString('id-ID')} baris baru. Ditemukan ${duplicateCount.toLocaleString('id-ID')} data duplikat yang otomatis diabaikan.`
        );
      } else {
        // Semua duplikat
        setErrorMessage(
          `Tidak ada data baru yang ditambahkan. Semua ${duplicateCount.toLocaleString('id-ID')} baris data pada berkas "${file.name}" sudah terdaftar di Data Master (duplikat).`
        );
      }
    } catch (err: any) {
      if (fileInputRef.current) fileInputRef.current.value = '';
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
              <div style={{ width: '100%', padding: '0.5rem 0.25rem' }}>
                <RotateCcw size={28} color="#405189" className="pulse-dot" style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#405189' }}>
                    {uploadStage || 'Sedang membaca berkas Excel...'}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#405189' }}>
                    {uploadProgress}%
                  </span>
                </div>
                {/* Modern Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: '#e9ebec', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${uploadProgress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #405189 0%, #0ab39c 100%)',
                      borderRadius: '4px',
                      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#878a99', marginTop: '0.5rem', textAlign: 'center' }}>
                  Mohon jangan menutup jendela selama proses verifikasi & penyaringan data
                </div>
              </div>
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

          {/* Duplicate Audit Breakdown Report */}
          {duplicateReport && (
            <div
              style={{
                marginTop: '0.85rem',
                padding: '0.85rem 1rem',
                borderRadius: '6px',
                background: '#ffffff',
                border: duplicateReport.duplicateCount > 0 ? '1px solid #f7b84b' : '1px solid #0ab39c',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#212529' }}>
                  Ringkasan Audit Upload Data:
                </span>
                <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
                  Total di Berkas: <strong>{duplicateReport.totalRows.toLocaleString('id-ID')} baris</strong>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: duplicateReport.duplicateSamples.length > 0 ? '0.65rem' : '0' }}>
                <div style={{ background: 'rgba(10, 179, 156, 0.08)', padding: '0.5rem 0.65rem', borderRadius: '4px', borderLeft: '3px solid #0ab39c' }}>
                  <div style={{ fontSize: '0.7rem', color: '#0ab39c', fontWeight: 600 }}>DATA BARU DITAMBAHKAN</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0ab39c' }}>
                    +{duplicateReport.newAdded.toLocaleString('id-ID')}
                  </div>
                </div>

                <div style={{ background: duplicateReport.duplicateCount > 0 ? 'rgba(247, 184, 75, 0.12)' : 'rgba(135, 138, 153, 0.08)', padding: '0.5rem 0.65rem', borderRadius: '4px', borderLeft: duplicateReport.duplicateCount > 0 ? '3px solid #d97706' : '3px solid #878a99' }}>
                  <div style={{ fontSize: '0.7rem', color: duplicateReport.duplicateCount > 0 ? '#d97706' : '#878a99', fontWeight: 600 }}>DUPLIKAT DIABAIKAN</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: duplicateReport.duplicateCount > 0 ? '#d97706' : '#878a99' }}>
                    {duplicateReport.duplicateCount.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {duplicateReport.duplicateSamples.length > 0 && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #e9ebec' }}>
                  <div style={{ fontSize: '0.72rem', color: '#878a99', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Contoh Data Duplikat yang Ditolak:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', maxHeight: '75px', overflowY: 'auto' }}>
                    {duplicateReport.duplicateSamples.map((sample, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '3px',
                          background: 'rgba(247, 184, 75, 0.2)',
                          color: '#92400e',
                          fontWeight: 500,
                          border: '1px solid rgba(247, 184, 75, 0.4)',
                        }}
                      >
                        {sample}
                      </span>
                    ))}
                    {duplicateReport.duplicateCount > duplicateReport.duplicateSamples.length && (
                      <span style={{ fontSize: '0.68rem', color: '#878a99', padding: '0.15rem 0.3rem' }}>
                        +{duplicateReport.duplicateCount - duplicateReport.duplicateSamples.length} lainnya...
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
