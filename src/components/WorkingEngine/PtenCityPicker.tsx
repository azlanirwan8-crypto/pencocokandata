import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';

interface PtenCityPickerProps {
  options: string[];
  value: string;
  onChange: (kota: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Dropdown pencarian kota PTEN: menggunakan portal agar tidak terpotong oleh overflow/tabel.
export const PtenCityPicker: React.FC<PtenCityPickerProps> = ({
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Cari kota PTEN…',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 220,
    placeAbove: false,
  });

  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Hitung posisi dropdown relatif terhadap trigger button
  const updatePosition = () => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const dropdownHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placeAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    setCoords({
      top: placeAbove ? rect.top - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 260) - 8)),
      width: Math.max(rect.width, 260),
      placeAbove,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return options;
    return options.filter((o) => o.toUpperCase().includes(q));
  }, [options, query]);

  const handleToggle = () => {
    if (disabled) return;
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const dropdownHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placeAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      setCoords({
        top: placeAbove ? rect.top - 4 : rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 280) - 8)),
        width: Math.max(rect.width, 280),
        placeAbove,
      });
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: '220px', width: '100%' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.4rem',
          padding: '0.3rem 0.55rem',
          fontSize: '0.75rem',
          border: '1px solid #d5dce8',
          borderRadius: '4px',
          background: '#fff',
          color: value ? '#212529' : '#878a99',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        {value && !disabled ? (
          <X
            size={13}
            style={{ flexShrink: 0, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
          />
        ) : (
          <ChevronDown size={13} style={{ flexShrink: 0 }} />
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: coords.placeAbove ? 'auto' : `${coords.top}px`,
              bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : 'auto',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
              background: '#fff',
              border: '1px solid #d5dce8',
              borderRadius: '6px',
              boxShadow: '0 10px 25px -3px rgba(15,23,42,0.2), 0 4px 6px -4px rgba(15,23,42,0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.6rem',
                borderBottom: '1px solid #eef1f6',
                background: '#fafbfc',
              }}
            >
              <Search size={13} color="#878a99" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ketik nama kota…"
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.75rem',
                  width: '100%',
                  padding: 0,
                  background: 'transparent',
                }}
              />
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div style={{ padding: '0.6rem', fontSize: '0.74rem', color: '#878a99', textAlign: 'center' }}>
                  Tidak ada kota PTEN cocok
                </div>
              )}
              {filtered.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                    setQuery('');
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.4rem 0.65rem',
                    fontSize: '0.75rem',
                    border: 'none',
                    background: o === value ? '#e8f7f5' : '#fff',
                    color: o === value ? '#0ab39c' : '#212529',
                    fontWeight: o === value ? 600 : 400,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (o !== value) e.currentTarget.style.background = '#f4f6f8';
                  }}
                  onMouseLeave={(e) => {
                    if (o !== value) e.currentTarget.style.background = '#fff';
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
