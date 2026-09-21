import React, { useMemo, useState, useDeferredValue } from 'react';
import { ClipboardCheck, Search, FileSpreadsheet, Undo2, RotateCcw, Eye, Trash2, X, Building2, ShieldCheck, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import type { AnalystRow } from '../../utils/analystPipeline';
import { formatWilayahCode, applyStandardSheetStyle } from '../../utils/excel';
import { ConfirmDialog } from './ConfirmDialog';
import { DialogPanel } from '../BaseModal';
import { useTampilanTersimpan } from '../../utils/useTampilanTersimpan';

interface FinalDataManagerProps {
  rows: AnalystRow[];
  onReturnAll: () => void;
  onReturnRow: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
}

const PAGE_SIZE = 25;

// Final Data: hasil analisa 3 fase yang sudah disetujui operator.
// Baris dipindah dari Data Analyst ke sini (IndexedDB `analyst_final_data`).
export const FinalDataManager: React.FC<FinalDataManagerProps> = ({ rows, onReturnAll, onReturnRow, onDeleteRow }) => {
  // A6: filter & halaman bertahan saat operator pindah menu lalu kembali.
  const [searchTerm, setSearchTerm] = useTampilanTersimpan('tampilan.final.cari', '');
  const deferredSearch = useDeferredValue(searchTerm);
  const [wilayahFilter, setWilayahFilter] = useTampilanTersimpan('tampilan.final.wilayah', 'ALL');
  const [page, setPage] = useTampilanTersimpan('tampilan.final.page', 1);
  // Aksi yang butuh konfirmasi (menggantikan window.confirm native).
  const [confirmAction, setConfirmAction] = useState<{ kind: 'returnAll' | 'revise' | 'delete'; row?: AnalystRow } | null>(null);
  // Modal Detail (View) per baris.
  const [detailRow, setDetailRow] = useState<AnalystRow | null>(null);

  // Card informasi ringkas (kebutuhan BRD 5d).
  const metrics = useMemo(() => ({
    total: rows.length,
    kc: rows.filter((r) => r.tipeUnit === 'KC').length,
    kcp: rows.filter((r) => r.tipeUnit === 'KCP').length,
    roleLengkap: rows.filter((r) => r.is3RoleLengkap).length,
    wilayah: new Set(rows.map((r) => r.wilayah).filter(Boolean)).size,
  }), [rows]);

  const wilayahOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.wilayah && s.add(r.wilayah));
    return Array.from(s).sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (wilayahFilter !== 'ALL' && r.wilayah !== wilayahFilter) return false;
      if (!q) return true;
      return (
        r.namaOutlet?.toLowerCase().includes(q) ||
        r.kotaPtenMax15?.toLowerCase().includes(q) ||
        r.kotaPten?.toLowerCase().includes(q) ||
        r.kelurahan?.toLowerCase().includes(q) ||
        r.kecamatan?.toLowerCase().includes(q) ||
        r.provinsi?.toLowerCase().includes(q) ||
        r.sandiCabang?.toLowerCase().includes(q) ||
        r.branchCode?.toLowerCase().includes(q) ||
        r.organisasiTujuan?.toLowerCase().includes(q) ||
        r.kodePosPten?.includes(q) ||
        r.kodePosKelurahan?.includes(q)
      );
    });
  }, [rows, deferredSearch, wilayahFilter]);

  const totalHal = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const hal = Math.min(page, totalHal);
  const tampil = filtered.slice((hal - 1) * PAGE_SIZE, hal * PAGE_SIZE);

  const handleExport = () => {
    const columns = [
      'No', 'Wilayah', 'Sandi Cabang', 'Branch Code', 'Kode Cabang', 'Nama Outlet', 'Status Outlet',
      'ALAMAT', 'KODE POS', 'Kelurahan', 'Kecamatan', 'Dati II', 'Provinsi', 'KODE POS PTEN',
      'ORGANISASI TUJUAN', 'Tipe Unit', '3 Role Lengkap', 'Status',
    ];
    const data = filtered.map((r, i) => ({
      No: i + 1,
      Wilayah: r.wilayah,
      'Sandi Cabang': r.sandiCabang,
      'Branch Code': r.branchCode,
      'Kode Cabang': r.kodeCabang,
      'Nama Outlet': r.namaOutlet,
      'Status Outlet': r.statusOutlet,
      ALAMAT: r.alamat,
      'KODE POS': r.kodePosKelurahan || r.kodePosPten,
      Kelurahan: r.kelurahan,
      Kecamatan: r.kecamatan,
      'Dati II': r.kotaPtenMax15 || r.kotaPten,
      Provinsi: r.provinsi,
      'KODE POS PTEN': r.kodePosPten,
      'ORGANISASI TUJUAN': r.organisasiTujuan,
      'Tipe Unit': r.tipeUnit,
      '3 Role Lengkap': r.is3RoleLengkap ? 'LENGKAP' : `${r.roleGrandTotal}/3 BELUM`,
      Status: r.isFinalApproved ? 'FINAL' : r.statusAnalisa,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: columns });
    applyStandardSheetStyle(ws, columns, data.length);
    XLSX.utils.book_append_sheet(wb, ws, 'FINAL_DATA');
    XLSX.writeFile(wb, `Final_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      <div className="glass-card" style={{ padding: '1.15rem 1.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <ClipboardCheck size={19} color="#0ab39c" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#212529' }}>Final Data</div>
              <div style={{ fontSize: '0.74rem', color: '#878a99' }}>
                {rows.length.toLocaleString('id-ID')} baris hasil analisa yang telah disetujui
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                if (rows.length === 0) return;
                setConfirmAction({ kind: 'returnAll' });
              }}
              disabled={rows.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem' }}
              title="Kembalikan seluruh baris ke menu Data Analyst"
            >
              <Undo2 size={13} /> Kembalikan ke Data Analyst
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={handleExport}
              disabled={filtered.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', fontWeight: 700 }}
            >
              <FileSpreadsheet size={13} /> Export Excel
            </button>
          </div>
        </div>

        {/* Card informasi ringkas */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
          {[
            { icon: <ClipboardCheck size={13} />, label: 'Total Baris', value: metrics.total, color: '#405189' },
            { icon: <Building2 size={13} />, label: 'KC', value: metrics.kc, color: '#0ab39c' },
            { icon: <Building2 size={13} />, label: 'KCP', value: metrics.kcp, color: '#f7b84b' },
            { icon: <ShieldCheck size={13} />, label: '3 Role Lengkap', value: metrics.roleLengkap, color: '#7048e8' },
            { icon: <ClipboardCheck size={13} />, label: 'Wilayah', value: metrics.wilayah, color: '#299cdb' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #e9ebec', borderRadius: '6px', padding: '0.4rem 0.7rem', background: '#fbfcfd' }}>
              <span style={{ color: m.color }}>{m.icon}</span>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{m.label}</span>
              <strong style={{ fontSize: '0.8rem', color: '#212529' }}>{m.value.toLocaleString('id-ID')}</strong>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#878a99' }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: '1.9rem' }}
              placeholder="Cari outlet, kota, kelurahan, kode pos, sandi, role..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select className="filter-select" value={wilayahFilter} onChange={(e) => { setWilayahFilter(e.target.value); setPage(1); }}>
            <option value="ALL">Semua Wilayah ({wilayahOptions.length})</option>
            {wilayahOptions.map((w) => (
              <option key={w} value={w}>
                {formatWilayahCode(w)}
              </option>
            ))}
          </select>
        </div>

        <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', maxHeight: '580px', overflow: 'auto' }}>
          <table className="modern-table" style={{ width: '100%', minWidth: '1650px', fontSize: '0.76rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Wilayah</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Sandi Cabang</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Branch Code</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Kode Cabang</th>
                <th style={{ minWidth: '160px' }}>Nama Outlet</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Status Outlet</th>
                <th style={{ minWidth: '200px' }}>ALAMAT</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Kode Pos</th>
                <th style={{ minWidth: '130px' }}>Kelurahan</th>
                <th style={{ minWidth: '130px' }}>Kecamatan</th>
                <th style={{ minWidth: '150px' }} title="Kolom PTEN KOTA/KABUPATEN MAX 15 DIGIT">Dati II (Kota/Kab MAX 15)</th>
                <th style={{ minWidth: '130px' }}>Provinsi</th>
                <th style={{ minWidth: '180px' }}>Organisasi Tujuan</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Tipe Unit</th>
                <th style={{ width: '90px', textAlign: 'center' }} title="Cek cabang tujuan 3 role lengkap (Sales+Verifikator+Penyetuju)">3 Role</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tampil.length === 0 ? (
                <tr>
                  <td colSpan={17} style={{ textAlign: 'center', padding: '2rem', color: '#878a99' }}>
                    {rows.length === 0
                      ? 'Belum ada Final Data — setujui seluruh fase di menu Data Analyst lalu klik "Saya Setuju (Masuk ke Final Analisa)".'
                      : 'Tidak ada baris yang cocok dengan pencarian/filter.'}
                  </td>
                </tr>
              ) : (
                tampil.map((r, i) => (
                  <tr key={r.id || `${hal}-${i}`}>
                    <td style={{ textAlign: 'center', color: '#878a99' }}>{(hal - 1) * PAGE_SIZE + i + 1}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-level1">{r.wilayah}</span>
                    </td>
                    <td className="code-cell" style={{ textAlign: 'center' }}>{r.sandiCabang}</td>
                    <td className="code-cell" style={{ textAlign: 'center' }}>{r.branchCode || '-'}</td>
                    <td className="code-cell" style={{ textAlign: 'center' }}>{r.kodeCabang || '-'}</td>
                    <td style={{ fontWeight: 600, color: '#405189' }}>{r.namaOutlet}</td>
                    <td style={{ textAlign: 'center' }}>{r.statusOutlet || '-'}</td>
                    <td style={{ maxWidth: '260px' }} title={r.alamat || ''}>{r.alamat || '-'}</td>
                    <td className="code-cell" style={{ textAlign: 'center', color: '#0ab39c', fontWeight: 700 }}>{r.kodePosKelurahan || r.kodePosPten}</td>
                    <td>{r.kelurahan}</td>
                    <td>{r.kecamatan}</td>
                    <td>{r.kotaPtenMax15 || r.kotaPten}</td>
                    <td>{r.provinsi}</td>
                    <td>{r.organisasiTujuan}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${r.tipeUnit === 'KC' ? 'badge-match' : 'badge-level2'}`}>{r.tipeUnit}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${r.is3RoleLengkap ? 'badge-match' : 'badge-diff'}`}>
                        {r.is3RoleLengkap ? 'LENGKAP' : `${r.roleGrandTotal}/3`}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setDetailRow(r)}
                          title="Lihat detail lengkap baris ini"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', padding: '0.25rem 0.5rem', color: '#405189', borderColor: 'rgba(64,81,137,0.4)' }}
                        >
                          <Eye size={12} /> Detail
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setConfirmAction({ kind: 'revise', row: r })}
                          title="Kembalikan ke Data Analyst mulai Fase 1"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', padding: '0.25rem 0.5rem', color: '#d97706', borderColor: 'rgba(217,119,6,0.4)' }}
                        >
                          <RotateCcw size={12} /> Revisi
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setConfirmAction({ kind: 'delete', row: r })}
                          title="Hapus permanen dari Final Data"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', padding: '0.25rem 0.5rem', color: '#f06548', borderColor: 'rgba(240,101,72,0.4)' }}
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.7rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
              Menampilkan {(hal - 1) * PAGE_SIZE + 1}–{Math.min(hal * PAGE_SIZE, filtered.length)} dari {filtered.length.toLocaleString('id-ID')} baris
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button type="button" className="btn btn-outline btn-sm" disabled={hal <= 1} onClick={() => setPage(hal - 1)}>← Prev</button>
              <span style={{ alignSelf: 'center', fontSize: '0.74rem', color: '#878a99' }}>Hal {hal} / {totalHal}</span>
              <button type="button" className="btn btn-outline btn-sm" disabled={hal >= totalHal} onClick={() => setPage(hal + 1)}>Next →</button>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={confirmAction !== null}
          icon={<AlertTriangle size={20} />}
          accent={confirmAction?.kind === 'delete' ? '#f06548' : '#f7b84b'}
          title={
            confirmAction?.kind === 'delete' ? 'Hapus Data Final?'
              : confirmAction?.kind === 'revise' ? 'Revisi Baris?'
                : 'Kembalikan ke Data Analyst?'
          }
          message={
            confirmAction?.kind === 'delete' && confirmAction.row
              ? `Baris #${confirmAction.row.no} (${confirmAction.row.kelurahan}, ${confirmAction.row.kotaPtenMax15 || confirmAction.row.kotaPten}) akan DIHAPUS PERMANEN dari Final Data. Baris ini bisa dianalisa ulang dari awal bila diperlukan.`
                : confirmAction?.kind === 'revise' && confirmAction.row
                  ? `Baris #${confirmAction.row.no} (${confirmAction.row.namaOutlet}) akan keluar dari Final Data dan kembali ke Data Analyst mulai Fase 1 untuk diproses ulang.`
                    : `${rows.length.toLocaleString('id-ID')} baris akan dikembalikan ke Data Analyst mulai Fase 1 (persetujuan tiap fase dilepas, sama seperti "Revisi" per baris). Final Data akan kosong.`
          }
          confirmLabel={confirmAction?.kind === 'delete' ? 'Ya, Hapus Permanen' : 'Ya, Lanjutkan'}
          onConfirm={() => {
            if (!confirmAction) return;
            if (confirmAction.kind === 'returnAll') onReturnAll();
            else if (confirmAction.kind === 'revise' && confirmAction.row) onReturnRow(confirmAction.row.id);
            else if (confirmAction.kind === 'delete' && confirmAction.row) onDeleteRow(confirmAction.row.id);
            setConfirmAction(null);
          }}
          onClose={() => setConfirmAction(null)}
        />

        {detailRow && (
          <DialogPanel
            onClose={() => setDetailRow(null)}
            label="Detail baris Final Data"
            backdropClassName=""
            backdropStyle={{ position: 'fixed', inset: 0, zIndex: 1070, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', padding: '1rem' }}
            className=""
            style={{ width: '100%', maxWidth: '860px', maxHeight: '86vh', overflowY: 'auto', background: '#ffffff', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.18)', border: '1px solid #e9ebec' }}
          >
              <div style={{ padding: '1.1rem 1.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eef1f4' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#212529', margin: 0 }}>
                    Detail Baris #{detailRow.no} — {detailRow.namaOutlet}
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
                    {detailRow.kelurahan}, {detailRow.kotaPtenMax15 || detailRow.kotaPten} · Kode Pos {detailRow.kodePosPten}
                  </span>
                </div>
                <button type="button" onClick={() => setDetailRow(null)} aria-label="Tutup detail" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#adb5bd', padding: '0.2rem', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ padding: '0.9rem 1.4rem 1.2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.55rem 1.1rem', fontSize: '0.78rem' }}>
                {([
                  ['Fase 1 — Kota/Kabupaten', detailRow.kotaPtenMax15 || detailRow.kotaPten],
                  ['Fase 1 — Kode Pos PTEN', detailRow.kodePosPten],
                  ['Fase 1 — Kode Pos Kelurahan', detailRow.kodePosKelurahan || '—'],
                  ['Fase 1 — Kelurahan', detailRow.kelurahan],
                  ['Fase 1 — Kecamatan', detailRow.kecamatan],
                  ['Fase 1 — Provinsi', detailRow.provinsi],
                  ['Fase 1 — Status PTEN', detailRow.statusPten],
                  ['Fase 1 — Penempatan', detailRow.placementStatus],
                  ['Fase 1 — Metode', detailRow.placementMethod],
                  ['Fase 2 — Wilayah', detailRow.wilayah],
                  ['Fase 2 — Sandi Cabang', detailRow.sandiCabang],
                  ['Fase 2 — Cabang', detailRow.cabang],
                  ['Fase 2 — Branch Code', detailRow.branchCode],
                  ['Fase 2 — Kode Cabang', detailRow.kodeCabang],
                  ['Fase 2 — Status Outlet', detailRow.statusOutlet],
                  ['Fase 2 — ALAMAT', detailRow.alamat],
                  ['Fase 3 — Organisasi Tujuan', detailRow.organisasiTujuan],
                  ['Fase 3 — Tipe Unit', detailRow.tipeUnit],
                  ['Fase 3 — CABSAL / CABAPV1 / CABAPV2', `${detailRow.roleCabsal} / ${detailRow.roleCabapv1} / ${detailRow.roleCabapv2}`],
                  ['Fase 3 — 3 Role Lengkap', detailRow.is3RoleLengkap ? 'LENGKAP' : 'BELUM'],
                  ['Fase 3 — Alur Wondr', detailRow.alurWondr],
                  ['Fase 3 — Skor Keyakinan', `${detailRow.confidenceScore}%`],
                  ['Status Analisa', detailRow.isFinalApproved ? 'FINAL' : detailRow.statusAnalisa],
                ] as [string, string | number][]).map(([label, value]) => (
                  <div key={label} style={{ borderBottom: '1px dashed #eef1f4', paddingBottom: '0.3rem' }}>
                    <div style={{ fontSize: '0.66rem', color: '#878a99', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
                    <div style={{ color: '#212529', fontWeight: 600, wordBreak: 'break-word' }}>{String(value || '-')}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0.9rem 1.4rem', borderTop: '1px solid #eef1f4', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setDetailRow(null)} style={{ padding: '0.45rem 1.1rem', fontSize: '0.8rem' }}>
                  Tutup
                </button>
              </div>
          </DialogPanel>
        )}
      </div>
    </div>
  );
};
