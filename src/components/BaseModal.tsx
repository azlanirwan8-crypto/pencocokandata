import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogBehavior } from './useDialogBehavior';

export interface DialogPanelProps {
  /** `false` = dialog tidak di-render sama sekali. Default `true` untuk dialog yang
   *  sudah dikondisikan oleh induknya. */
  isOpen?: boolean;
  onClose: () => void;
  /** Nama dialog untuk pembaca layar (mis. "Edit Data Master Cabang"). */
  label?: string;
  /** ID elemen judul di dalam `children`, bila nama dialog diambil dari elemen itu. */
  labelledBy?: string;
  children: React.ReactNode;
  /** Kelas panel; default `.modal-container` (gaya Velzon di `styles/index.css`). */
  className?: string;
  style?: React.CSSProperties;
  backdropClassName?: string;
  backdropStyle?: React.CSSProperties;
  /**
   * Dialog yang menyetujui/membatalkan sesuatu yang penting sebaiknya `false`:
   * tertutup karena klik tak sengaja = keputusan hilang. Esc tetap menutup (= batal).
   */
  closableOnOutside?: boolean;
}

/**
 * Perilaku dialog (A3) di atas markup dialog yang sudah ada: portal ke <body>,
 * `role="dialog"` + `aria-modal` + `aria-label`, Esc menutup, klik-luar opsional,
 * fokus masuk ke dialog dan kembali ke pemicunya, Tab tertahan di dalam panel.
 *
 * Tidak mengubah tampilan sedikit pun — backdrop & panel tetap memakai kelas/gaya
 * yang diberikan pemanggil. `BaseModal` = komponen ini + tata letak standar.
 */
export const DialogPanel: React.FC<DialogPanelProps> = ({
  isOpen = true,
  onClose,
  label,
  labelledBy,
  children,
  className = 'modal-container',
  style,
  backdropClassName = 'modal-backdrop',
  backdropStyle,
  closableOnOutside = true,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tahanTab = useDialogBehavior({ isOpen, onClose, panelRef });

  // Nama dialog diambil dari judul yang terlihat (.modal-title / heading pertama) supaya
  // tidak perlu menuliskan label dua kali; props `label`/`labelledBy` untuk yang khusus.
  useEffect(() => {
    if (!isOpen || labelledBy || label) return;
    const panel = panelRef.current;
    const judul = panel?.querySelector<HTMLElement>('.modal-title, h1, h2, h3, h4, h5, h6');
    if (!panel || !judul) return;
    if (!judul.id) judul.id = `qdr-modal-judul-${Math.random().toString(36).slice(2, 8)}`;
    panel.setAttribute('aria-labelledby', judul.id);
  }, [isOpen, labelledBy, label]);

  if (!isOpen) return null;

  return createPortal(
    <div className={backdropClassName} style={backdropStyle} onClick={closableOnOutside ? onClose : undefined}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        className={className}
        style={{ outline: 'none', ...style }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={tahanTab}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closableOnOutside?: boolean;
  maxWidth?: string;
  panelClassName?: string;
  bodyStyle?: React.CSSProperties;
  closeLabel?: string;
}

/**
 * Dialog lengkap dengan tata letak standar (header + judul + tombol tutup, body
 * scroll, footer) untuk dialog baru. `title` dipakai sebagai `aria-labelledby`.
 */
export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  closableOnOutside = true,
  maxWidth = '720px',
  panelClassName,
  bodyStyle,
  closeLabel = 'Tutup',
}) => {
  const judulId = useId();

  return (
    <DialogPanel
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={judulId}
      closableOnOutside={closableOnOutside}
      className={panelClassName ? `modal-container ${panelClassName}` : 'modal-container'}
      style={{ maxWidth }}
    >
      <div className="modal-header">
        <h4 id={judulId} className="modal-title" style={{ minWidth: 0 }}>
          {title}
        </h4>
        <button type="button" className="modal-close" onClick={onClose} aria-label={closeLabel}>
          <X size={18} />
        </button>
      </div>
      <div className="modal-body" style={bodyStyle}>
        {children}
      </div>
      {footer ? <div className="modal-footer">{footer}</div> : null}
    </DialogPanel>
  );
};
