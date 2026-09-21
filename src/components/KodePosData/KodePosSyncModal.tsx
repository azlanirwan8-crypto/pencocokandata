import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, X, CloudUpload, CheckCircle2, AlertCircle, ShieldCheck, ExternalLink } from 'lucide-react';
import {
  runKodePosLiveSync,
  importSemuaPatokan,
  salinKoordinatPatokan,
  cakupanKoordinat,
  type KodePosSyncPlan,
  type KoordinatCakupan,
  type SyncProgress,
} from '../../utils/kodePosSync';
import { saveKodePosToNeon, mapsUrlFor, geoLabel, type KodePosRow } from '../../utils/neonSync';
import { useVirtualWindow } from '../../utils/useVirtualWindow';
import { useGeoTooltip } from '../GeoTooltip';
import { DialogPanel } from '../BaseModal';

interface KodePosSyncModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

type Phase = 'checking' | 'ready' | 'importing';

type TipProps = (text: string) => {
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onFocus: (e: React.FocusEvent) => void;
  onBlur: () => void;
};

const fmt = (n: number) => n.toLocaleString('id-ID');

const StatCard: React.FC<{ label: string; value: string; sub: string; color: string; tip?: string; tipProps: TipProps }> = ({ label, value, sub, color, tip, tipProps }) => (
  <div {...(tip ? tipProps(tip) : {})} style={{ border: '1px solid #e9ebec', borderLeft: `4px solid ${color}`, borderRadius: '6px', padding: '0.75rem 0.9rem' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#5b5f6e', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
      {label}
    </div>
    <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
    <div style={{ fontSize: '0.8rem', color: '#5b5f6e' }}>{sub}</div>
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
  const [cakupan, setCakupan] = useState<KoordinatCakupan | null>(null);

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { tipProps, tooltipNode } = useGeoTooltip();
  const rows = plan?.missingInCloud || [];
  const shownRows = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.kodePos} ${r.kelurahan} ${r.kecamatan} ${r.kabupatenKota} ${r.provinsi}`.toLowerCase().includes(q)
    );
  }, [rows, deferredSearch]);
  const win = useVirtualWindow({ containerRef: scrollRef, itemCount: shownRows.length, minRowsToWindow: 60 });
  const renderedRows = win.active ? shownRows.slice(win.start, win.end) : shownRows;

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
    setSearch('');
    try {
      const result = await runKodePosLiveSync(onProgress);
      setPlan(result);
      setSelected(new Set(result.missingInCloud.map(rowKey)));
      setPhase('ready');
      void cakupanKoordinat().then((c) => c && setCakupan(c));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Pemeriksaan sinkronisasi gagal.');
      setPhase('ready');
    }
  };

  useEffect(() => {
    if (open) void startCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const allChecked = shownRows.length > 0 && shownRows.every((r) => selected.has(rowKey(r)));
  const someChecked = shownRows.some((r) => selected.has(rowKey(r)));
  const checking = phase === 'checking';

  const tipKoordinat = !cakupan
    ? 'Endpoint ?view=koordinat belum tersedia di deployment ini.'
    : `Titik per kode wilayah desa, sumber kodepos.co.id — ${fmt(cakupan.patokanTitik)} titik${
        cakupan.terakhir
          ? `, terakhir diperbarui ${new Date(cakupan.terakhir).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}`
          : ''
      }.` +
      ` Cross-check: ${fmt(cakupan.kodePosCocok)} dari ${fmt(
        cakupan.kodeWilayahCocok
      )} titik desa kode pos-nya sama dengan dump Kemendagri.` +
      (cakupan.diLuarWilayah > 0 ? ` ${fmt(cakupan.diLuarWilayah)} titik di luar wilayah Indonesia.` : '') +
      (cakupan.tanpaTitik > 0
        ? ` ${fmt(cakupan.tanpaTitik)} baris belum punya titik sendiri — kartu Titik Koordinat masih bisa mencari titik per kode pos.`
        : ' Tiap baris kelurahan punya titiknya sendiri, bukan satu titik untuk seluruh kode pos.');

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(shownRows.map(rowKey)));
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

  // Salin seluruh patokan yang belum ada, langsung di database (tanpa batas daftar contoh),
  // lalu turunkan titik koordinat per desa ke baris kerja yang sama.
  const handleImportAll = async () => {
    setPhase('importing');
    setStep('Menyalin seluruh patokan ke tabel kerja...');
    try {
      const { masuk, totalSetelah } = await importSemuaPatokan();
      setStep('Menyalin titik koordinat per desa ke baris kerja...');
      const titik = await salinKoordinatPatokan();
      const bagian = [`${fmt(masuk)} baris patokan disalin ke tabel kerja`];
      if (titik) {
        bagian.push(
          titik.disalin > 0
            ? `${fmt(titik.disalin)} baris mendapat titik`
            : 'titik sudah sesuai patokan'
        );
        if (titik.tanpaTitik > 0) bagian.push(`${fmt(titik.tanpaTitik)} baris masih tanpa titik`);
      }
      const msg = `${bagian.join(' · ')} — total ${fmt(totalSetelah)} baris.`;
      setImportMsg(msg);
      onImported?.();
      await startCheck(msg);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Penyalinan patokan gagal.');
      setPhase('ready');
    }
  };

  if (!open) return null;

  return (
    <>
      <DialogPanel onClose={onClose} closableOnOutside={false} labelledBy="kodepos-sync-title" style={{ maxWidth: '1000px' }}>
        <div className="modal-header">
          <h4 className="modal-title" id="kodepos-sync-title">
            <RefreshCw size={16} color="#405189" />
            Sinkronisasi Kode Pos Seluruh Indonesia
          </h4>
          {plan?.lastUpdated && !checking && (
            <span style={{ marginLeft: 'auto', marginRight: '0.75rem', fontSize: '0.72rem', color: '#5b5f6e', whiteSpace: 'nowrap' }}>
              diperbarui {new Date(plan.lastUpdated).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup dialog sinkronisasi">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {checking && (
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
                Server membuka halaman provinsi kodepos.id, membandingkan beberapa halaman sampel dengan
                jejak terakhir, mengambil ulang yang berubah, lalu database Neon diadu terhadapnya.
              </p>
            </div>
          )}

          {!checking && errorMsg && (
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

          {!checking && !errorMsg && plan && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                <StatCard
                  tipProps={tipProps}
                  label="1. Total Kode Pos"
                  value={fmt(plan.dbRows || 0)}
                  sub="baris wilayah tersimpan di Neon"
                  tip={`${fmt(plan.dbTotal)} kode pos unik dipakai ${fmt(plan.dbRows || 0)} baris wilayah`}
                  color="#405189"
                />
                <StatCard
                  tipProps={tipProps}
                  label="2. Kode Pos belum ada"
                  value={fmt(rows.length)}
                  sub="baris patokan yang belum tersimpan di Neon"
                  color={rows.length > 0 ? '#f06548' : '#0ab39c'}
                />
                <StatCard
                  tipProps={tipProps}
                  label="3. Provinsi terdampak"
                  value={fmt(plan.provincesAffected.length)}
                  sub="provinsi yang punya selisih data"
                  color="#d68b0c"
                />
                <StatCard
                  tipProps={tipProps}
                  label="4. Titik koordinat"
                  value={cakupan ? fmt(cakupan.dataTitik) : '—'}
                  sub={cakupan ? `dari ${fmt(cakupan.dataTotal)} baris punya titik sendiri` : 'cakupan belum terbaca'}
                  color={!cakupan ? '#5b5f6e' : cakupan.tanpaTitik > 0 ? '#d68b0c' : '#0ab39c'}
                  tip={tipKoordinat}
                />
              </div>
              {importMsg && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: '#0ab39c' }}>
                  <CheckCircle2 size={15} />
                  {importMsg}
                </div>
              )}
            </>
          )}

          {!checking && !errorMsg && plan && plan.status === 'SYNCED' && (
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
                  Tidak ada selisih: seluruh kode pos dari {plan.compareLabel.toLowerCase()} sudah tersimpan di Neon.
                  {plan.lastUpdated ? ` Diperbarui: ${new Date(plan.lastUpdated).toLocaleString('id-ID')}.` : ''}
                </div>
              </div>
            </div>
          )}

          {!checking && !errorMsg && plan && plan.status === 'DIFF' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="search"
                  className="form-control"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari kode pos / kelurahan / kecamatan / kota / provinsi..."
                  style={{ maxWidth: '420px', fontSize: '0.78rem' }}
                />
                <span style={{ fontSize: '0.74rem', color: '#878a99', whiteSpace: 'nowrap' }}>
                  {fmt(shownRows.length)} dari {fmt(rows.length)} baris
                </span>
              </div>

              <div ref={scrollRef} className="table-container" style={{ maxHeight: 'calc(90vh - 300px)', minHeight: '200px', overflow: 'auto', border: '1px solid #e9ebec', borderRadius: '6px', minWidth: 0 }}>
                <table className="modern-table kp-sticky-col" style={{ fontSize: '0.78rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f3f6f9' }}>
                    <tr>
                      <th className="sticky-col" style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = someChecked && !allChecked;
                          }}
                          onChange={toggleAll}
                          aria-label="Pilih semua baris"
                        />
                      </th>
                      <th className="sticky-col" style={{ width: '80px', textAlign: 'center' }}>Kode Pos</th>
                      <th>Kelurahan</th>
                      <th>Kecamatan</th>
                      <th>Kota / Kabupaten</th>
                      <th>Provinsi</th>
                      <th style={{ width: '105px', textAlign: 'right' }}>Latitude</th>
                      <th style={{ width: '105px', textAlign: 'right' }}>Longitude</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>Maps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#878a99' }}>
                          {rows.length === 0 ? 'Tidak ada baris yang perlu dikirim ke Neon.' : 'Tidak ada yang cocok dengan pencarian.'}
                        </td>
                      </tr>
                    ) : (
                      <>
                        {win.active && win.padTop > 0 && <tr aria-hidden="true" style={{ height: `${win.padTop}px` }} />}
                        {renderedRows.map((r, i) => {
                          const key = rowKey(r);
                          const idx = (win.active ? win.start : 0) + i;
                          return (
                            <tr
                              key={`${key}-${idx}`}
                              data-vrow={i === 0 ? 'true' : undefined}
                              style={{
                                background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd',
                                ['--row-bg' as never]: idx % 2 === 0 ? '#ffffff' : '#f9fbfd',
                              }}
                            >
                              <td className="sticky-col" style={{ textAlign: 'center' }}>
                                <input type="checkbox" checked={selected.has(key)} onChange={() => toggleOne(key)} aria-label={`Pilih kode pos ${r.kodePos}`} />
                              </td>
                              <td className="code-cell sticky-col" style={{ textAlign: 'center', fontWeight: 700, color: '#0ab39c' }}>{r.kodePos}</td>
                              <td style={{ fontWeight: 600, color: '#212529' }}>{r.kelurahan}</td>
                              <td>{r.kecamatan}</td>
                              <td>{r.kabupatenKota}</td>
                              <td>{r.provinsi}</td>
                              <td
                                {...tipProps(geoLabel(r))}
                                style={{
                                  textAlign: 'right',
                                  fontFamily: 'monospace',
                                  color: r.latitude == null ? '#adb5bd' : '#495057',
                                }}
                              >
                                {r.latitude == null ? '—' : r.latitude.toFixed(6)}
                              </td>
                              <td
                                {...tipProps(geoLabel(r))}
                                style={{
                                  textAlign: 'right',
                                  fontFamily: 'monospace',
                                  color: r.longitude == null ? '#adb5bd' : '#495057',
                                }}
                              >
                                {r.longitude == null ? '—' : r.longitude.toFixed(6)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  disabled={r.latitude == null || r.longitude == null}
                                  onClick={() =>
                                    window.open(
                                      mapsUrlFor(r.latitude as number, r.longitude as number),
                                      '_blank',
                                      'noopener,noreferrer'
                                    )
                                  }
                                  aria-label={`Buka Maps untuk kode pos ${r.kodePos}`}
                                  {...tipProps(
                                    r.latitude == null
                                      ? 'Titik koordinat belum ada — pakai aksi di kartu Titik Koordinat pada tabel Kode Pos'
                                      : `Buka Maps/Google · ${geoLabel(r)}`
                                  )}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: r.latitude == null ? '#ced4da' : '#0ab39c',
                                    cursor: r.latitude == null ? 'not-allowed' : 'pointer',
                                    padding: '0.35rem',
                                    lineHeight: 1,
                                  }}
                                >
                                  <ExternalLink size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {win.active && win.padBottom > 0 && <tr aria-hidden="true" style={{ height: `${win.padBottom}px` }} />}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
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
          {((plan?.listTruncated && (plan.missingTotal ?? 0) > 0) ||
            (plan && (cakupan?.tanpaTitik ?? 0) > 0)) && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleImportAll()}
              disabled={phase !== 'ready'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              title="Menyalin semua baris patokan yang belum ada dan menurunkan titik koordinat per desa — bukan hanya daftar contoh yang tampil di layar ini."
            >
              <CloudUpload size={13} />
              {phase === 'importing' ? 'Menyalin...' : 'Isi Semua Patokan + Titik'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handleImport()}
            disabled={phase !== 'ready' || selectedRows.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <CloudUpload size={13} />
            {phase === 'importing' ? 'Menyimpan...' : `Simpan/Import Data Terpilih ke Neon (${fmt(selectedRows.length)})`}
          </button>
        </div>
      </DialogPanel>
      {tooltipNode}
    </>
  );
};

function rowKey(r: KodePosRow) {
  return `${r.kodePos}|${r.kelurahan}|${r.kecamatan}`;
}
