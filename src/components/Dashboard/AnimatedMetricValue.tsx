import { useEffect, useRef, useState } from 'react';

const DURASI_MS = 400; // singkat agar tetap "premium" tapi tidak membuat layar terasa lambat

function preferReduzGerak(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Nilai KPI yang beranimasi halus saat berubah (count-up/count-down ~0,4 detik).
 * Memakai rAF + easing ease-out; hormati `prefers-reduced-motion` (langsung loncat ke nilai).
 * Tidak mengubah data — hanya presentasi angka yang sudah dihitung.
 */
export const AnimatedMetricValue: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = useState(value);
  const dariRef = useRef(value);
  const bingkaiRef = useRef(0);

  useEffect(() => {
    if (preferReduzGerak()) {
      setDisplay(value);
      dariRef.current = value;
      return;
    }
    const dari = dariRef.current;
    if (dari === value) return;
    const mulai = performance.now();
    const langkah = (now: number) => {
      const t = Math.min(1, (now - mulai) / DURASI_MS);
      const mudah = 1 - Math.pow(1 - t, 3); // ease-out kubik
      setDisplay(Math.round(dari + (value - dari) * mudah));
      if (t < 1) bingkaiRef.current = requestAnimationFrame(langkah);
      else dariRef.current = value;
    };
    bingkaiRef.current = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(bingkaiRef.current);
  }, [value]);

  return <>{display.toLocaleString('id-ID')}</>;
};