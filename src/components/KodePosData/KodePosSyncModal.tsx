import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, X, CloudUpload, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { runKodePosSync, runKodePosSourceAudit, type KodePosSyncPlan, type SyncProgress } from '../../utils/kodePosSync';
import { saveKodePosToNeon, type KodePosRow } from '../../utils/neonSync';
import { useVirtualWindow } from '../../utils/useVirtualWindow';

interface KodePosSyncModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

type Phase = 'checking' | 'ready' | 'importing';

const fmt = (n: number) => n.toLocaleString('id-ID');

export const KodePosSyncModal: React.FC<KodePosSyncModalProps> = ({ open, onClose, onImported }) => {
  const [phase, setPhase] = useState<Phase>('checking');
  const [step, setStep] = useState('Menyiapkan pemeriksaan...');
  const [pct, setPct] = useState(0);
  const [plan, setPlan] = useState<KodePosSyncPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importMsg, setImportMsg] = useState<string | null>(null);
  // 'db' = bandingkan master perangkat ini dengan Neon; 'internet' = bandingkan Neon
  // dengan dataset kode pos eksternal
  const [sourceMode, setSourceMode] = useState<'db' | 'internet'>('db');

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rows = plan?.missingInCloud || [];
  const win = useVirtualWindow({ containerRef: scrollRef, itemCount: rows.length, minRowsToWindow: 60 });
  const renderedRows = win.active ? rows.slice(win.start, win.end) : rows;

  const onProgress: SyncProgress = (message, percent) => {
    setStep(message);
    setPct(percent);
  };

  const startCheck = async () => {
    setPhase('checking');
    setErrorMsg(null);
    setImportMsg(null);
    setPlan(null);
    setSelected(new Set());
    try {
      const result =
        sourceMode === 'internet' ? await runKodePosSourceAudit(onProgress) : await runKodePosSync(onProgress);
      setPlan(result);
      // Default: semua baris yang belum ada di cloud terpilih
      setSelected(new Set(result.missingInCloud.map((r) => `${r.kodePos}|${r.kelurahan}|${r.kecamatan}`)));
      setPhase('ready');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Pemeriksaan sinkronisasi gagal.');
      setPhase('ready');
    }
  };

  useEffect(() => {
    if (open) void startCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourceMode]);

  const rowKey = (r: KodePosRow) => `${r.kodePos}|${r.kelurahan}|${r.kecamatan}`;
  const allChecked = rows.length > 0 && selected.size === rows.length;

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(rows.map(rowKey)));
  };

  const toggleOne = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(rowKey(r))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, selected]
  );

  const handleImport = async () => {
    if (selectedRows.length === 0) return;
    setPhase('importing');
    setStep(`Mengirim ${fmt(selectedRows.length)} baris ke Neon...`);
    setPct(0);
    try {
      const ok = await saveKodePosToNeon(selectedRows, 'append');
      if (!ok) throw new Error('Neon menolak permintaan simpan.');
      setImportMsg(`${fmt(selectedRows.length)} baris berhasil dikirim ke database Neon.`);
      onImported?.();
      await startCheck();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan ke Neon.');
      setPhase('ready');
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: '860px' }}>
        <div className="modal-header">
          <h4 className="modal-title">
            <RefreshCw size={16} color="#405189" />
            Sinkronisasi Kode Pos Seluruh Indonesia
          </h4>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {([
              { key: 'db', label: 'Master perangkat ini vs Neon' },
              { key: 'internet', label: 'Neon vs sumber internet (dataset kode pos)' },
            ] as const).map((s) => {
              const active = sourceMode === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSourceMode(s.key)}
                  disabled={phase === 'checking' || phase === 'importing'}
                  style={{
                    background: active ? '#405189' : '#ffffff',
                    color: active ? '#ffffff' : '#495057',
                    border: `1px solid ${active ? '#405189' : '#d5dde3'}`,
                    borderRadius: '6px',
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: active ? 'default' : 'pointer',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {phase === 'checking' && (
            <div style={{ padding: '1.5rem 0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.7rem' }}>
                <RefreshCw size={16} color="#299cdb" style={{ animation: 'pulse 1.2s ease-in-out infinite' }} />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#405189' }}>{step}</span>
                <span style={{ fontSize: '0.8rem', color: '#878a99', marginLeft: 'auto' }}>{pct}%</span>
              </div>
              <div style={{ height: '6px', background: '#eef1f4', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: '#299cdb', transition: 'width .2s' }} />
              </div>
              <p style={{ fontSize: '0.76rem', color: '#878a99', marginTop: '0.7rem' }}>
                Membandingkan master lokal dengan tabel <code>kodepos_data</code> di Neon memakai sidik jari
                per provinsi, lalu menghitung selisih baris hanya pada provinsi yang berbeda.
              </p>
            </div>
          )}

          {phase !== 'checking' && errorMsg && (
            <div
              style={{
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'flex-start',
                background: 'rgba(240, 101, 72, 0.08)',
                border: '1px solid rgba(240, 101, 72, 0.25)',
                borderRadius: '6px',
                padding: '0.8rem 0.9rem',
              }}
            >
              <AlertCircle size={16} color="#f06548" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f06548' }}>Pemeriksaan gagal</div>
                <div style={{ fontSize: '0.78rem', color: '#878a99' }}>{errorMsg}</div>
              </div>
            </div>
          )}

          {phase !== 'checking' && !errorMsg && plan && plan.status === 'SYNCED' && (
            <div
              style={{
                display: 'flex',
                gap: '0.7rem',
                alignItems: 'flex-start',
                background: 'rgba(10, 179, 156, 0.08)',
                border: '1px solid rgba(10, 179, 156, 0.3)',
                borderRadius: '6px',
                padding: '1rem',
              }}
            >
              <ShieldCheck size={20} color="#0ab39c" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0ab39c' }}>
                  Database kita sudah versi terbaru dan valid.
                </div>
                <div style={{ fontSize: '0.79rem', color: '#495057', marginTop: '0.3rem', lineHeight: 1.6 }}>
                  {sourceMode === 'internet'
                    ? `Database Neon (${fmt(plan.localTotal)} kode pos) sudah memuat seluruh ${fmt(plan.cloudTotal)} kode pos dari sumber eksternal.`
                    : `${fmt(plan.localTotal)} baris lokal sama persis dengan ${fmt(plan.cloudTotal)} baris di Neon (${plan.diffProvinces.length} provinsi berbeda).`}
                  {plan.lastUpdated ? ` Diperbarui: ${new Date(plan.lastUpdated).toLocaleString('id-ID')}.` : ''}
                </div>
                {plan.note && (
                  <div style={{ fontSize: '0.74rem', color: '#878a99', marginTop: '0.5rem' }}>{plan.note}</div>
                )}
                {plan.cloudOnlyProvinces.length > 0 && (
                  <div style={{ fontSize: '0.76rem', color: '#d68b0c', marginTop: '0.5rem' }}>
                    Catatan: {plan.cloudOnlyProvinces.length} provinsi hanya ada di cloud
                    ({plan.cloudOnlyProvinces.map((p) => p.provinsi).join(', ')}).
                  </div>
                )}
              </div>
            </div>
          )}

          {phase !== 'checking' && !errorMsg && plan && plan.status === 'DIFF' && (
            <>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span className="badge badge-level2">
                  {fmt(plan.missingInCloud.length)} baris {sourceMode === 'internet' ? 'dari sumber internet' : 'lokal'} belum ada di Neon
                </span>
                <span className="badge badge-level1">
                  {sourceMode === 'internet' ? (plan.sourceLabel || 'sumber eksternal') : `${plan.diffProvinces.length} provinsi berbeda`}
                </span>
                <span className="badge badge-match">
                  {sourceMode === 'internet' ? 'Neon' : 'Lokal'} {fmt(plan.localTotal)} / Sumber {fmt(plan.cloudTotal)} kode pos
                </span>
              </div>
              {plan.note && (
                <div style={{ fontSize: '0.74rem', color: '#878a99' }}>{plan.note}</div>
              )}

              {importMsg && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: '#0ab39c' }}>
                  <CheckCircle2 size={15} />
                  {importMsg}
                </div>
              )}

              <div ref={scrollRef} className="table-container" style={{ maxHeight: '360px', overflow: 'auto', border: '1px solid #e9ebec', borderRadius: '6px' }}>
                <table className="modern-table" style={{ fontSize: '0.76rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f3f6f9' }}>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input type="checkbox" checked={allChecked} onChange={toggleAll} title="Pilih semua" />
                      </th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Kode Pos</th>
                      <th>Kelurahan</th>
                      <th>Kecamatan</th>
                      <th>Kota / Kabupaten</th>
                      <th>Provinsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#878a99' }}>
                          Tidak ada baris yang perlu dikirim ke Neon.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {win.active && win.padTop > 0 && <tr aria-hidden="true" style={{ height: `${win.padTop}px` }} />}
                        {renderedRows.map((r, i) => {
                          const key = rowKey(r);
                          const idx = (win.active ? win.start : 0) + i;
                          return (
                            <tr key={`${key}-${idx}`} data-vrow={i === 0 ? 'true' : undefined} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}>
                              <td style={{ textAlign: 'center' }}>
                                <input type="checkbox" checked={selected.has(key)} onChange={() => toggleOne(key)} />
                              </td>
                              <td className="code-cell" style={{ textAlign: 'center', fontWeight: 700, color: '#0ab39c' }}>{r.kodePos}</td>
                              <td style={{ fontWeight: 600, color: '#212529' }}>{r.kelurahan}</td>
                              <td>{r.kecamatan}</td>
                              <td>{r.kabupatenKota}</td>
                              <td>{r.provinsi}</td>
                            </tr>
                          );
                        })}
                        {win.active && win.padBottom > 0 && <tr aria-hidden="true" style={{ height: `${win.padBottom}px` }} />}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {plan.missingInLocal.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#878a99' }}>
                  {plan.missingInLocal.length} baris contoh (maks. 500 per provinsi) ada di Neon tetapi tidak ada di
                  master perangkat ini — periksa kembali berkas sumber kode pos lokal bila itu bukan memang dihapus.
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void startCheck()} disabled={phase !== 'ready'}>
            <RefreshCw size={13} style={{ marginRight: '0.3rem' }} />
            Periksa Ulang
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Tutup
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handleImport()}
            disabled={phase !== 'ready' || selectedRows.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <CloudUpload size={13} />
            {phase === 'importing'
              ? 'Menyimpan...'
              : `Simpan/Import Data Terpilih ke Neon (${fmt(selectedRows.length)})`}
          </button>
        </div>
      </div>
    </div>
  );
};
