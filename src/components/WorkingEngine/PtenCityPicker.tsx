import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface PtenCityPickerProps {
  options: string[];
  value: string;
  onChange: (kota: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Dropdown pencarian kota PTEN: ketik untuk menyaring, klik untuk memilih.
export const PtenCityPicker: React.FC<PtenCityPickerProps> = ({
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Cari kota PTEN…',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return options;
    return options.filter((o) => o.toUpperCase().includes(q));
  }, [options, query]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: '220px' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
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
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 50,
            background: '#fff',
            border: '1px solid #d5dce8',
            borderRadius: '4px',
            boxShadow: '0 6px 18px rgba(15,23,42,0.15)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.5rem', borderBottom: '1px solid #eef1f6' }}>
            <Search size={12} color="#878a99" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ketik nama kota…"
              style={{ border: 'none', outline: 'none', fontSize: '0.75rem', width: '100%', padding: 0 }}
            />
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '0.5rem', fontSize: '0.72rem', color: '#878a99', textAlign: 'center' }}>
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
                  padding: '0.35rem 0.55rem',
                  fontSize: '0.75rem',
                  border: 'none',
                  background: o === value ? '#e8f7f5' : '#fff',
                  color: o === value ? '#0ab39c' : '#212529',
                  cursor: 'pointer',
                }}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
