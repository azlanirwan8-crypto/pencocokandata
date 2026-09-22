import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { NotificationCtx, type NotifItem, type NotifType } from './NotificationContext';

const BATAS_TAMPIL = 5;
const AUTO_HAPUS: Record<NotifType, number> = { success: 4000, info: 4000, warning: 8000, error: 0 };
const WARNA: Record<NotifType, string> = {
  success: '#0ab39c',
  info: '#299cdb',
  warning: '#f0ad4e',
  error: '#f06548',
};
const IKON: Record<NotifType, React.ReactNode> = {
  success: <CheckCircle2 size={16} />,
  info: <Info size={16} />,
  warning: <AlertTriangle size={16} />,
  error: <XCircle size={16} />,
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<NotifItem[]>([]);
  const timers = useRef(new Map<number, number>());
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t !== undefined) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const add = useCallback(
    (message: string, type: NotifType = 'info') => {
      const id = ++seq.current;
      setItems((prev) => [...prev, { id, type, message }].slice(-BATAS_TAMPIL));
      const ms = AUTO_HAPUS[type];
      if (ms > 0) timers.current.set(id, window.setTimeout(() => dismiss(id), ms));
    },
    [dismiss]
  );

  // Timer milik notifikasi yang masih terbuka harus dimatikan saat unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => window.clearTimeout(t));
      map.clear();
    };
  }, []);

  const api = useMemo(() => ({ add, dismiss }), [add, dismiss]);

  return (
    <NotificationCtx.Provider value={api}>
      {children}
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            right: '1.1rem',
            bottom: '1.1rem',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxWidth: 'min(420px, calc(100vw - 2.2rem))',
            pointerEvents: 'none',
          }}
        >
          {items.map((n) => (
            <div
              key={n.id}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.55rem',
                background: '#ffffff',
                border: '1px solid #e6e9ec',
                borderLeft: `4px solid ${WARNA[n.type]}`,
                borderRadius: '6px',
                boxShadow: '0 5px 12px rgba(30, 32, 37, 0.16)',
                padding: '0.6rem 0.7rem',
              }}
            >
              <span style={{ color: WARNA[n.type], display: 'inline-flex', marginTop: '1px' }}>{IKON[n.type]}</span>
              <span style={{ flex: '1 1 auto', fontSize: '0.8rem', color: '#343a40', lineHeight: 1.45, wordBreak: 'break-word' }}>
                {n.message}
              </span>
              <button
                type="button"
                onClick={() => dismiss(n.id)}
                aria-label="Tutup notifikasi"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#adb5bd',
                  padding: '0.1rem',
                  display: 'inline-flex',
                  lineHeight: 1,
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </NotificationCtx.Provider>
  );
};
