import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';

/** Elemen yang bisa menerima fokus, urut sesuai DOM. */
export const PEMILIH_FOKUS =
  'input:not([type="hidden"]), select, textarea, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Perilaku aksesibilitas yang wajib ada di setiap dialog (A3), dipakai `BaseModal`
 * dan dialog yang tampilannya khusus (mis. `ConfirmDialog`):
 * - Esc menutup, dari mana pun fokus berada;
 * - fokus pindah ke elemen pertama dialog saat terbuka dan kembali ke pemicunya saat tutup;
 * - Tab tertahan di dalam panel.
 *
 * Panel WAJIB `ref={panelRef}` + `tabIndex={-1}` supaya bisa menerima fokus awal
 * (kalau di dalamnya belum ada elemen yang bisa difokuskan).
 */
export function useDialogBehavior({
  isOpen,
  onClose,
  panelRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
}) {
  const pemicuRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    pemicuRef.current = document.activeElement;
    const panel = panelRef.current;
    const pertama = panel?.querySelector<HTMLElement>(PEMILIH_FOKUS);
    (pertama ?? panel)?.focus();
    return () => {
      const pemicu = pemicuRef.current as HTMLElement | null;
      if (pemicu && document.contains(pemicu)) pemicu.focus();
      pemicuRef.current = null;
    };
  }, [isOpen, panelRef]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const daftar = Array.from(panel.querySelectorAll<HTMLElement>(PEMILIH_FOKUS)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (daftar.length === 0) return;
    const pertama = daftar[0];
    const terakhir = daftar[daftar.length - 1];
    const aktif = document.activeElement;
    if (e.shiftKey && (aktif === pertama || aktif === panel)) {
      e.preventDefault();
      terakhir.focus();
    } else if (!e.shiftKey && (aktif === terakhir || aktif === panel)) {
      e.preventDefault();
      pertama.focus();
    }
  };
}
