import React, { useState, useRef } from 'react';
import {
  X,
  Archive,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import type { MasterRow, TargetRow } from '../types';

export interface WorkspaceSnapshot {
  app: 'tools-data-matcher';
  version: string;
  createdAt: string;
  note?: string;
  masterData: {
    rows: MasterRow[];
    fileName: string;
  };
  targetData: {
    rows: TargetRow[];
    fileName: string;
    initialCount: number;
    matchedDone: boolean;
  };
  summary: {
    totalMaster: number;
    totalTarget: number;
    totalMatched: number;
    wilayahCount: number;
  };
}

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterRows: MasterRow[];
  targetRows: TargetRow[];
  targetFileName: string;
  initialTargetCount: number;
  matchedDone: boolean;
  onRestoreSnapshot: (snapshot: WorkspaceSnapshot) => void;
}

export const SnapshotModal: React.FC<SnapshotModalProps> = ({
  isOpen,
  onClose,
  masterRows,
  targetRows,
  targetFileName,
  initialTargetCount,
  matchedDone,
  onRestoreSnapshot,
}) => {
  const [note, setNote] = useState<string>('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isRowMatched = (r: TargetRow) =>
    Boolean(r._isMatched) || Boolean(r.Sandi) || Boolean(r['Sandi Cabang']) || Boolean(r.Cabang);

  const matchedCount = targetRows.filter(isRowMatched).length;
  const uniqueWilayah = new Set(targetRows.map((r) => String(r.Wilayah || '').trim()).filter(Boolean)).size;

  // Handle Export / Download Snapshot JSON
  const handleDownloadSnapshot = () => {
    try {
      const now = new Date();
      const snapshot: WorkspaceSnapshot = {
        app: 'tools-data-matcher',
        version: '1.0',
        createdAt: now.toISOString(),
        note: note.trim() || undefined,
        masterData: {
          rows: masterRows,
          fileName: 'Master_Data_Backup.xlsx',
        },
        targetData: {
          rows: targetRows,
          fileName: targetFileName || 'Target_Data_Backup.xlsx',
          initialCount: initialTargetCount || targetRows.length,
          matchedDone,
        },
        summary: {
          totalMaster: masterRows.length,
          totalTarget: targetRows.length,
          totalMatched: matchedCount,
          wilayahCount: uniqueWilayah,
        },
      };

      const datePart = now.toISOString().slice(0, 10);
      const timePart = now.toTimeString().slice(0, 5).replace(':', '');
      const filename = `Snapshot_Data_Matcher_${datePart}_${timePart}.json`;

      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setAlert({
        type: 'success',
        message: `Cadangan berhasil diunduh ke berkas "${filename}".`,
      });
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: 'Gagal membuat file cadangan: ' + (err?.message || err),
      });
    }
  };

  // Handle Import / Restore Snapshot JSON
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as WorkspaceSnapshot;

        if (!parsed || parsed.app !== 'tools-data-matcher' || !parsed.targetData) {
          throw new Error('Format file cadangan tidak valid atau bukan dari aplikasi ini.');
        }

        const confirmMsg = `Pulihkan cadangan tanggal ${new Date(parsed.createdAt).toLocaleString('id-ID')}?\n` +
          `• Master Cabang: ${parsed.summary?.totalMaster || parsed.masterData?.rows?.length || 0} Baris\n` +
          `• Target Data: ${parsed.summary?.totalTarget || parsed.targetData?.rows?.length || 0} Baris\n` +
          `• Data Match: ${parsed.summary?.totalMatched || 0} Baris\n\n` +
          `Data di aplikasi akan diperbarui dengan isi cadangan ini.`;

        if (window.confirm(confirmMsg)) {
          onRestoreSnapshot(parsed);
          setAlert({
            type: 'success',
            message: 'Cadangan berhasil dipulihkan ke aplikasi!',
          });
          setTimeout(() => {
            onClose();
          }, 1200);
        }
      } catch (err: any) {
        setAlert({
          type: 'error',
          message: 'Gagal memulihkan cadangan: ' + (err?.message || 'File JSON rusak'),
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop">
      <div
        className="glass-card modal-container"
        style={{
          maxWidth: '540px',
          width: '92%',
          padding: '1.25rem 1.4rem',
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            borderBottom: '1px solid #e9ebec',
            paddingBottom: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
              <Archive size={17} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                Manajemen Cadangan Sesi (Snapshot)
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#878a99' }}>
                Arsipkan riwayat kerja atau pulihkan seluruh data dari file cadangan
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#878a99',
              padding: '0.2rem',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Feedback Alert */}
        {alert && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.75rem',
              marginBottom: '0.85rem',
              borderRadius: '4px',
              fontSize: '0.76rem',
              background: alert.type === 'success' ? '#edfcf4' : '#fff5f5',
              border: alert.type === 'success' ? '1px solid #a3e6cd' : '1px solid #fed7d7',
              color: alert.type === 'success' ? '#0f766e' : '#c53030',
            }}
          >
            {alert.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{alert.message}</span>
          </div>
        )}

        {/* Section 1: Buat Cadangan Saat Ini */}
        <div
          style={{
            background: '#fafbfc',
            border: '1px solid #e9ebec',
            borderRadius: '6px',
            padding: '0.85rem',
            marginBottom: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#212529' }}>
              1. Buat Cadangan Sesi Saat Ini
            </span>
            <span
              style={{
                fontSize: '0.67rem',
                fontWeight: 600,
                color: '#405189',
                background: '#f1f3f9',
                padding: '0.1rem 0.45rem',
                borderRadius: '3px',
              }}
            >
              {targetRows.length} Target • {matchedCount} Match
            </span>
          </div>

          <p style={{ fontSize: '0.73rem', color: '#6c757d', margin: '0 0 0.6rem', lineHeight: 1.4 }}>
            Mengunduh arsip JSON lengkap berisi data target, data master, hasil pencocokan bersih, dan audit timestamp.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Catatan sesi (opsional, misal: 'Batch September Wilayah 1')"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                flex: 1,
                fontSize: '0.75rem',
                padding: '0.35rem 0.65rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                background: '#ffffff',
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleDownloadSnapshot}
              disabled={masterRows.length === 0 && targetRows.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                padding: '0.35rem 0.85rem',
                whiteSpace: 'nowrap',
              }}
            >
              <Download size={13} />
              <span>Unduh Snapshot (.json)</span>
            </button>
          </div>
        </div>

        {/* Section 2: Pulihkan dari File Cadangan */}
        <div
          style={{
            background: '#fafbfc',
            border: '1px solid #e9ebec',
            borderRadius: '6px',
            padding: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#212529' }}>
              2. Pulihkan Sesi dari Berkas (.json)
            </span>
            <span style={{ fontSize: '0.67rem', color: '#878a99' }}>Restore Instan</span>
          </div>

          <p style={{ fontSize: '0.73rem', color: '#6c757d', margin: '0 0 0.65rem', lineHeight: 1.4 }}>
            Unggah file cadangan snapshot yang telah diunduh sebelumnya untuk mengembalikan seluruh kondisi kerja.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              fontSize: '0.76rem',
              padding: '0.45rem',
              borderColor: '#ced4da',
              color: '#405189',
              background: '#ffffff',
              fontWeight: 600,
            }}
          >
            <UploadCloud size={14} />
            <span>Pilih Berkas Cadangan (.json) untuk Dipulihkan</span>
          </button>
        </div>

        {/* Footer Info */}
        <div
          style={{
            marginTop: '0.85rem',
            paddingTop: '0.65rem',
            borderTop: '1px solid #e9ebec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            color: '#878a99',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={12} />
            <span>Format kompatibel: JSON v1.0</span>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClose}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', color: '#6c757d' }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
