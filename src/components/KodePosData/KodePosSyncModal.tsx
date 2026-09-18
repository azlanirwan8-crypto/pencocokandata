import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, X, CloudUpload, CheckCircle2, AlertCircle, ShieldCheck, Download } from 'lucide-react';
import {
  runKodePosSync,
  runKodePosSourceAudit,
  runKodePosBaselineAudit,
  pullKodePosBaseline,
  type KodePosSyncPlan,
  type SyncProgress,
} from '../../utils/kodePosSync';
import { saveKodePosToNeon, type KodePosRow } from '../../utils/neonSync';
import { useVirtualWindow } from '../../utils/useVirtualWindow';

interface KodePosSyncModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

type Phase = 'checking' | 'ready' | 'importing' | 'pulling';

const fmt = (n: number) => n.toLocaleString('id-ID');

const StatCard: React.FC<{ label: string; value: string; sub: string; color: string }> = ({ label, value, sub, color }) => (
  <div style={{ border: '1px solid #e9ebec', borderLeft: `4px solid ${color}`, borderRadius: '6px', padding: '0.75rem 0.9rem' }}>
    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#878a99', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
      {label}
    </div>
    <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: '#878a99' }}>{sub}</div>
  </div>
);

export const KodePosSyncModal: React.FC<KodePosSyncModalProps> = ({ open, onClose, onImported }) => {
  const [phase, setPhase] = useState<Phase>('checking');
  const [step, setStep] = useState('Menyiapkan pemeriksaan...');
  const [pct, setPct] = useState(0);
  const [plan, setPlan] = useState<KodePosSyncPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importMsg, setImportMsg] = useState<string | null>(null);
  // 'baseline' = patokan tersimpan di DB sendiri; 'db' = master perangkat ini vs Neon;
  // 'resmi'/'komunitas' = bandingkan Neon langsung dengan sumber eksternal
  const [sourceMode, setSourceMode] = useState<'baseline' | 'db' | 'resmi' | 'komunitas'>('baseline');

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rows = plan?.missingInCloud || [];
  const codes = plan?.missingCodes || [];
  const missingCount = plan?.importable === false ? codes.length : rows.length;
  const win = useVirtualWindow({ containerRef: scrollRef, itemCount: rows.length, minRowsToWindow: 60 });
  const renderedRows = win.active ? rows.slice(win.start, win.end) : rows;
  const codeWin = useVirtualWindow({ containerRef: scrollRef, itemCount: codes.length, minRowsToWindow: 60 });
  const renderedCodes = codeWin.active ? codes.slice(codeWin.start, codeWin.end) : codes;

  const onProgress: SyncProgress = (message, percent) => {
    setStep(message);
    setPct(percent);
  };

  const startCheck = async (keepMsg?: string) => {
    setPhase('checking');
    setErrorMsg(null);
    setImportMsg(keepMsg ?? null);
    setPlan(null);
    setSelected(new Set());
    try {
      const result =
        sourceMode === 'db'
          ? await runKodePosSync(onProgress)
          : sourceMode === 'baseline'
            ? await runKodePosBaselineAudit(onProgress)
            : await runKodePosSourceAudit(sourceMode, onProgress);
      setPlan(result);
      // Default: semua baris yang belum ada di cloud terpilih
      setSelected(
        new Set(result.missingInCloud.map((r) => `${r.kodePos}|${r.kelurahan}|${r.kecamatan}`))
      );
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
  const busy = phase === 'checking' || phase === 'pulling';

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
      const msg = `${fmt(selectedRows.length)} baris berhasil dikirim ke database Neon.`;
      setImportMsg(msg);
      onImported?.();
      await startCheck(msg);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan ke Neon.');
      setPhase('ready');
    }
  };

  // Tarik salinan resmi dari Satu Data Indonesia (data.go.id) ke tabel kodepos_baseline.
  const handlePullBaseline = async () => {
    setPhase('pulling');
    setErrorMsg(null);
    setImportMsg(null);
    setPct(0);
    try {
      const res = await pullKodePosBaseline(onProgress);
      const msg =
        `Baseline tersimpan di tabel kodepos_baseline: ${fmt(res.rows)} baris (tarikan ke-${res.version}). Sumber: ${res.sumber}.`;
      setImportMsg(msg);
      await startCheck(msg);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menarik baseline dari sumber pemerintah.');
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
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap', overflowX: 'auto' }}>
            {([
              { key: 'baseline', label: 'Baseline DB kita (patokan)' },
              { key: 'db', label: 'Perangkat vs Neon' },
              { key: 'resmi', label: 'Sumber resmi' },
              { key: 'komunitas', label: 'Sumber komunitas' },
            ] as const).map((s) => {
              const active = sourceMode === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSourceMode(s.key)}
                  disabled={busy || phase === 'importing'}
                  title={
                    s.key === 'baseline'
                      ? 'Bandingkan Neon dengan tabel kodepos_baseline milik kita sendiri'
                      : s.key === 'db'
                        ? 'Bandingkan master kode pos di perangkat ini dengan Neon'
                        : s.key === 'resmi'
                          ? 'Kepmendagri + daftar kode pos Pos Indonesia (tanpa nama wilayah, tidak bisa diimpor)'
                          : 'Dataset GitHub lengkap bernama (asal komunitas, bukan resmi)'
                  }
                  style={{
                    background: active ? '#405189' : '#ffffff',
                    color: active ? '#ffffff' : '#495057',
                    border: `1px solid ${active ? '#405189' : '#d5dde3'}`,
                    borderRadius: '6px',
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: active ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {sourceMode === 'baseline' && !busy && phase !== 'importing' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void handlePullBaseline()}>
                <Download size={13} style={{ marginRight: '0.3rem' }} />
                Tarik baseline dari sumber pemerintah
              </button>
              <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
                Sumbernya milik pemerintah (Satu Data Indonesia / Bappenas), jadi versi terbaru dipegang database kita
                sendiri — GitHub orang lain tidak lagi jadi patokan.
              </span>
            </div>
          )}
          {busy && (
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
                {phase === 'pulling'
                  ? 'Fungsi server mengambil data per 1.000 baris (maks. 5 halaman tiap panggilan) lalu menimpanya di tabel kodepos_baseline berdasarkan kode wilayah. Baris lama tetap aman bila sumbernya tidak berubah.'
                  : sourceMode === 'db'
                    ? 'Membandingkan master lokal dengan tabel kodepos_data di Neon memakai sidik jari per provinsi, lalu menghitung selisih hanya pada provinsi yang berbeda.'
                    : sourceMode === 'baseline'
                      ? 'Membandingkan daftar kode pos unik di tabel kodepos_data Neon dengan isi tabel kodepos_baseline milik kita sendiri — tanpa menyentuh internet.'
                      : 'Server mengunduh dataset eksternal lalu membandingkan daftar kode posnya dengan DISTINCT kode_pos di tabel kodepos_data Neon. Hasilnya di-cache 10 menit.'}
              </p>
            </div>
          )}

          {!busy && errorMsg && (
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

          {!busy && !errorMsg && plan && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                <StatCard
                  label="1. Kode pos di Neon"
                  value={fmt(plan.dbTotal)}
                  sub={sourceMode === 'db' ? 'baris tersimpan di cloud' : 'kode pos unik tersimpan di cloud'}
                  color="#405189"
                />
                <StatCard
                  label="2. Belum ada di Neon"
                  value={fmt(missingCount)}
                  sub={`dibandingkan ${plan.compareLabel.toLowerCase()}`}
                  color={missingCount > 0 ? '#f06548' : '#0ab39c'}
                />
                <StatCard
                  label="3. Provinsi terdampak"
                  value={fmt(plan.provincesAffected.length)}
                  sub="provinsi yang punya selisih data"
                  color="#d68b0c"
                />
              </div>
              <div style={{ fontSize: '0.74rem', color: '#878a99', lineHeight: 1.6 }}>
                <strong style={{ color: '#495057' }}>Sumber data kartu 2:</strong> {plan.sourceDetail}
              </div>
              {importMsg && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: '#0ab39c' }}>
                  <CheckCircle2 size={15} />
                  {importMsg}
                </div>
              )}
            </>
          )}

          {!busy && !errorMsg && plan && plan.status === 'SYNCED' && (
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
                  Tidak ada selisih: seluruh data dari {plan.compareLabel.toLowerCase()} sudah tersimpan di Neon.
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

          {!busy && !errorMsg && plan && plan.status === 'DIFF' && (
            <>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#495057' }}>
                {plan.importable === false
                  ? `Daftar ${fmt(codes.length)} kode pos resmi yang belum ada di Neon`
                  : `Daftar ${fmt(rows.length)} baris yang bisa dikirim ke Neon`}
              </div>
              {plan.note && (
                <div style={{ fontSize: '0.74rem', color: '#878a99' }}>{plan.note}</div>
              )}

              {plan.importable === false ? (
                <div ref={scrollRef} className="table-container" style={{ maxHeight: '360px', overflow: 'auto', border: '1px solid #e9ebec', borderRadius: '6px' }}>
                  <table className="modern-table" style={{ fontSize: '0.76rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f3f6f9' }}>
                      <tr>
                        <th style={{ width: '160px' }}>Kode wilayah (Kepmendagri)</th>
                        <th style={{ width: '110px', textAlign: 'center' }}>Kode pos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codes.length === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ textAlign: 'center', padding: '2rem', color: '#878a99' }}>
                            Semua kode pos sumber resmi sudah tersimpan di Neon.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {codeWin.active && codeWin.padTop > 0 && <tr aria-hidden="true" style={{ height: `${codeWin.padTop}px` }} />}
                          {renderedCodes.map((c, i) => (
                            <tr key={`${c.kode}-${i}`} data-vrow={i === 0 ? 'true' : undefined}>
                              <td className="code-cell">{c.kode}</td>
                              <td className="code-cell" style={{ textAlign: 'center', fontWeight: 700, color: '#0ab39c' }}>
                                {c.kodePos}
                              </td>
                            </tr>
                          ))}
                          {codeWin.active && codeWin.padBottom > 0 && <tr aria-hidden="true" style={{ height: `${codeWin.padBottom}px` }} />}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (

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
              )}

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
            disabled={phase !== 'ready' || plan?.importable === false || selectedRows.length === 0}
            title={plan?.importable === false ? 'Sumber resmi tidak memuat nama wilayah, jadi tidak bisa diimpor langsung' : undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <CloudUpload size={13} />
            {phase === 'importing'
              ? 'Menyimpan...'
              : plan?.importable === false
                ? 'Tidak bisa diimpor dari sumber resmi'
                : `Simpan/Import Data Terpilih ke Neon (${fmt(selectedRows.length)})`}
          </button>
        </div>
      </div>
    </div>
  );
};
