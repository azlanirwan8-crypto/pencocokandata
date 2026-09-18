import { useEffect, useRef, useState } from 'react';

interface VirtualWindowParams {
  containerRef: React.RefObject<HTMLElement | null>;
  itemCount: number;
  /** Tinggi baris awal sebelum terukur; akan dikoreksi otomatis dari DOM. */
  fallbackRowHeight?: number;
  /** Jumlah baris ekstra di atas/bawah viewport supaya scroll tidak bolong. */
  overscan?: number;
  /** Di bawah ambang ini seluruh baris tetap dirender normal (tanpa windowing). */
  minRowsToWindow?: number;
}

export interface VirtualWindow {
  active: boolean;
  start: number;
  end: number;
  padTop: number;
  padBottom: number;
  rowHeight: number;
}

/**
 * Windowing baris tabel tanpa dependensi eksternal: hanya baris yang terlihat
 * (plus overscan) yang masuk DOM, sisanya diganti dua <tr> spacer.
 */
export function useVirtualWindow({
  containerRef,
  itemCount,
  fallbackRowHeight = 44,
  overscan = 8,
  minRowsToWindow = 200,
}: VirtualWindowParams): VirtualWindow {
  const [rowHeight, setRowHeight] = useState(fallbackRowHeight);
  const [view, setView] = useState({ top: 0, height: 600 });
  const frameRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => {
      frameRef.current = 0;
      setView((prev) =>
        Math.abs(prev.top - el.scrollTop) < 2 && Math.abs(prev.height - el.clientHeight) < 2
          ? prev
          : { top: el.scrollTop, height: el.clientHeight }
      );
    };
    const onScroll = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(sync);
    };
    sync();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      ro?.disconnect();
    };
  }, [containerRef, itemCount > 0]);

  // Koreksi estimasi tinggi baris dari baris asli pertama yang ter-render.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || itemCount <= minRowsToWindow) return;
    const row = el.querySelector<HTMLElement>('tbody tr[data-vrow]');
    const h = row?.offsetHeight || 0;
    if (h > 8 && Math.abs(h - rowHeight) > 2) setRowHeight(h);
  }, [containerRef, view, rowHeight, itemCount, minRowsToWindow]);

  const active = itemCount > minRowsToWindow;
  if (!active) return { active, start: 0, end: itemCount, padTop: 0, padBottom: 0, rowHeight };

  const first = Math.floor(view.top / rowHeight);
  const visibleCount = Math.ceil(view.height / rowHeight) + overscan * 2;
  const start = Math.max(0, first - overscan);
  const end = Math.min(itemCount, start + visibleCount);
  return {
    active,
    start,
    end,
    padTop: start * rowHeight,
    padBottom: Math.max(0, (itemCount - end) * rowHeight),
    rowHeight,
  };
}
