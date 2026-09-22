import React, { useId } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { DialogPanel } from '../BaseModal';

export interface ConfirmDialogProps {
  isOpen: boolean;
  icon: React.ReactNode;
  accent: string; // hex color for icon chip + primary button
  title: string;
  message: React.ReactNode;
  detail?: React.ReactNode; // optional warning/info box
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

const BACKDROP: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1070,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(33,37,41, 0.65)',
  backdropFilter: 'blur(4px)',
  padding: '1rem',
};

const PANEL: React.CSSProperties = {
  width: '100%',
  maxWidth: '480px',
  background: '#ffffff',
  borderRadius: '6px',
  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
  overflow: 'hidden',
  border: '1px solid #e9ebec',
};

// Dialog konfirmasi standar sebelum menyetujui tiap fase / final analisa.
// Sengaja TIDAK menutup saat klik latar: keputusan fase tidak boleh hilang karena
// klik tak sengaja (Esc dan "Batal" tetap menutup).
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  icon,
  accent,
  title,
  message,
  detail,
  confirmLabel,
  cancelLabel = 'Batal',
  onConfirm,
  onClose,
}) => {
  const judulId = useId();

  return (
    <DialogPanel
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={judulId}
      closableOnOutside={false}
      backdropClassName=""
      backdropStyle={BACKDROP}
      className="qdr-confirm-panel"
      style={PANEL}
    >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.4rem 0.4rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '6px',
                background: `${accent}1a`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accent,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
            <h3 id={judulId} style={{ fontSize: '1.05rem', fontWeight: 800, color: '#212529', margin: 0, lineHeight: 1.3 }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#adb5bd',
              padding: '0.2rem',
              display: 'flex',
              lineHeight: 1,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0.5rem 1.4rem 0.25rem' }}>
          {/* `message` boleh berisi blok (<div>/<ul>) — jangan dibungkus <p> agar tidak
              jadi HTML invalid (div di dalam p memicu error hidrasi React). */}
          <div style={{ fontSize: '0.85rem', color: '#5c636a', lineHeight: 1.55, margin: 0 }}>{message}</div>
          {detail && (
            <div
              style={{
                marginTop: '0.9rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                background: '#fff8ec',
                border: '1px solid #f5d9a8',
                borderRadius: '6px',
                padding: '0.65rem 0.8rem',
                fontSize: '0.78rem',
                color: '#8a5a00',
                lineHeight: 1.45,
              }}
            >
              <AlertTriangle size={15} color="#d68b0c" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>{detail}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1.15rem 1.4rem',
            marginTop: '0.9rem',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.6rem',
            background: '#fbfcfd',
            borderTop: '1px solid #eef1f4',
          }}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
            style={{ padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontWeight: 600 }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#ffffff',
              background: accent,
              border: `1px solid ${accent}`,
              borderRadius: '6px',
            }}
          >
            {confirmLabel}
          </button>
        </div>
    </DialogPanel>
  );
};
