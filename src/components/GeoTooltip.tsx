import React, { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type Anchor = { text: string; top: number; bottom: number; centerX: number };

const TIP_WIDTH = 320;
const GAP = 8;

/**
 * Tooltip sumber koordinat. Wajib di-portal ke <body>: .modal-container menahan
 * `transform` dari animasi masuk, sehingga keturunan position:fixed ter-clip overflow modal.
 */
export function useGeoTooltip() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const show = useCallback((text: string, target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!text || !el?.getBoundingClientRect) return;
    const rect = el.getBoundingClientRect();
    setAnchor({ text, top: rect.top, bottom: rect.bottom, centerX: rect.left + rect.width / 2 });
  }, []);

  const hide = useCallback(() => setAnchor(null), []);

  const tipProps = useMemo(
    () => (text: string) => ({
      onMouseEnter: (e: React.MouseEvent) => show(text, e.currentTarget),
      onMouseLeave: hide,
      onFocus: (e: React.FocusEvent) => show(text, e.currentTarget),
      onBlur: hide,
    }),
    [show, hide]
  );

  return { tipProps, hideTip: hide, tooltipNode: anchor ? <GeoTooltipLayer anchor={anchor} /> : null };
}

function GeoTooltipLayer({ anchor }: { anchor: Anchor }) {
  const width = Math.min(TIP_WIDTH, window.innerWidth - 24);
  const left = Math.max(12, Math.min(anchor.centerX - width / 2, window.innerWidth - width - 12));
  const above = anchor.top > 120;

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left,
        width,
        [above ? 'bottom' : 'top']: above ? window.innerHeight - anchor.top + GAP : anchor.bottom + GAP,
        zIndex: 1200,
        pointerEvents: 'none',
        background: '#0f172a',
        color: '#f8fafc',
        fontSize: '0.85rem',
        lineHeight: 1.45,
        padding: '0.45rem 0.6rem',
        borderRadius: 6,
        boxShadow: '0 6px 18px rgba(15, 23, 42, 0.28)',
      }}
    >
      {anchor.text}
    </div>,
    document.body
  );
}
