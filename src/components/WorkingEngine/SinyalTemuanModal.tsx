import React, { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { DialogPanel } from '../BaseModal';
import { kapital } from '../../utils/normalizer';
import { SINYAL_PENCOCOKAN, bitUntuk, bitTemuanBaris, hitungBit, type AnalystRow } from '../../utils/analystPipeline';

interface Props {
  no: number;
  rows: AnalystRow[];
  onClose: () => void;
}

const TABEL_BATAS_AWAL = 150;
const SEL_POTONG: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 };

/**
 * E7: bukti tiap fase disimpan TERPISAH di baris (`sinyalBit` / `sinyalF2Bit` /
 * `sinyalRoleBit`) dan baru digabung saat mencari baris yang kena. Di modal, bukti
 * ditampilkan per kelompok supaya operator tahu fase mana yang menghasilkan temuan.
 */
const FASE_BUKTI: Array<{ label: string; nama: string; ambil: (r: AnalystRow) => number }> = [
  { label: 'F1', nama: 'Fase 1 — pencocokan nama kota/kelurahan', ambil: (r) => r.sinyalBit || 0 },
  { label: 'F2', nama: 'Fase 2 — nama kota cabang yang terpilih', ambil: (r) => r.sinyalF2Bit || 0 },
  { label: 'F3', nama: 'Fase 3 — nama organisasi tujuan dari Mapping Role', ambil: (r) => r.sinyalRoleBit || 0 },
];

/**
 * Detail "temuan" satu sinyal pencocokan, ditulis untuk pembaca non-teknis:
 * berapa banyak, dan kenapa tiap baris masuk daftar (catatan `temuanCatatan`
 * yang dicatat engine saat pencocokan berjalan — bukan dihitung ulang setelahnya).
 */
export const SinyalTemuanModal: React.FC<Props> = ({ no, rows, onClose }) => {
  const meta = SINYAL_PENCOCOKAN.find((s) => s.no === no);
  const [batas, setBatas] = useState(TABEL_BATAS_AWAL);
  const [cari, setCari] = useState('');

  const bit = bitUntuk(no);
  const temuan = useMemo(() => (bit ? rows.filter((r) => bitTemuanBaris(r) & bit) : []), [rows, bit]);
  const namaSinyal = useMemo(() => {
    const m = new Map<number, string>();
    SINYAL_PENCOCOKAN.forEach((s) => m.set(s.no, `${s.emoji} ${s.judul}`));
    return m;
  }, []);
  const termFilter = useMemo(() => {
    const q = cari.trim().toUpperCase();
    if (!q) return temuan;
    return temuan.filter((r) =>
      `${r.kotaPten} ${r.kelurahan} ${r.namaOutlet} ${r.temuanCatatan?.[no]?.join(' ') || ''}`.toUpperCase().includes(q)
    );
  }, [temuan, cari, no]);
  const tampil = termFilter.slice(0, batas);
  const adaAlasan = useMemo(() => temuan.some((r) => (r.temuanCatatan?.[no] || []).length > 0), [temuan, no]);
  // E7: berapa baris yang buktinya datang dari masing-masing fase.
  const jumlahPerFase = useMemo(
    () => FASE_BUKTI.map((f) => ({ ...f, n: bit ? temuan.filter((r) => (f.ambil(r) & bit) !== 0).length : 0 })),
    [temuan, bit]
  );
  const buktiBaris = (r: AnalystRow) =>
    FASE_BUKTI.map((f) => {
      const b = bit ? f.ambil(r) & bit : 0;
      if (!b) return null;
      const lain = hitungBit(b).filter((n) => n !== no).map((n) => namaSinyal.get(n) || `#${n}`);
      return `${f.label}: ${lain.length ? lain.join(', ') : 'sinyal ini saja'}`;
    })
      .filter(Boolean)
      .join(' · ');

  if (!meta) return null;

  return (
    <DialogPanel onClose={onClose} label={`Temuan sinyal ${meta.judul}`} style={{ maxWidth: '980px' }}>
        <div className="modal-header">
          <h4 className="modal-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ color: meta.warna }}>{meta.no}.</span> {meta.emoji} {meta.judul}
            <span className="sinyal-count sinyal-count-aktif" style={{ marginLeft: '0.5rem' }}>
              {temuan.length} temuan
            </span>
          </h4>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p
            style={{
              fontSize: '0.84rem',
              color: '#495057',
              margin: '0 0 0.85rem',
              lineHeight: 1.5,
              background: '#f9fbfd',
              border: '1px solid #edf2f7',
              borderLeft: `3px solid ${meta.warna}`,
              borderRadius: '6px',
              padding: '0.6rem 0.75rem',
            }}
          >
            {meta.penjelasan}
          </p>

          {temuan.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.7rem', fontSize: '0.74rem', color: '#878a99' }}>
              <span>Bukti dari fase:</span>
              {jumlahPerFase.map((f) => (
                <span
                  key={f.label}
                  title={f.nama}
                  style={{
                    padding: '0.08rem 0.45rem', borderRadius: '9999px', fontWeight: 700,
                    background: f.n ? '#eef6ff' : '#f6f7f8', color: f.n ? '#405189' : '#adb5bd',
                  }}
                >
                  {f.label} {f.n.toLocaleString('id-ID')}
                </span>
              ))}
            </div>
          )}

          {!adaAlasan && temuan.length > 0 && (
            <div
              style={{
                fontSize: '0.75rem',
                color: '#f06548',
                background: '#fff5f3',
                border: '1px solid #ffe3dc',
                borderRadius: '6px',
                padding: '0.45rem 0.65rem',
                marginBottom: '0.75rem',
              }}
            >
              Baris hasil analisa lama belum menyimpan alasannya. Jalankan ulang analisa supaya kolom
              &quot;Kenapa masuk daftar ini&quot; terisi.
            </div>
          )}

          {temuan.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
              <div style={{ position: 'relative', flex: '0 0 280px' }}>
                <Search size={14} style={{ position: 'absolute', left: '9px', top: '9px', color: '#adb5bd' }} />
                <input
                  type="search"
                  className="form-control"
                  style={{ paddingLeft: '28px', height: '32px', fontSize: '0.8rem' }}
                  placeholder="Cari kota / kelurahan / alasan"
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                  aria-label="Filter temuan"
                />
              </div>
              <span style={{ fontSize: '0.74rem', color: '#878a99' }}>
                {termFilter.length === temuan.length
                  ? `Menampilkan ${tampil.length} dari ${temuan.length} baris`
                  : `${termFilter.length} cocok dari ${temuan.length} temuan`}
              </span>
            </div>
          )}

          {temuan.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#878a99', fontSize: '0.82rem' }}>
              0 temuan — sinyal ini belum menangkap apa pun pada analisa yang sudah dijalankan.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: '52px' }}>No</th>
                    <th style={{ width: '180px' }}>Kota (Fase 1)</th>
                    <th style={{ width: '84px' }}>Kode Pos</th>
                    <th style={{ width: '160px' }}>Kelurahan</th>
                    <th style={{ width: '190px' }}>Nama Outlet (Fase 2)</th>
                    <th>Kenapa masuk daftar ini</th>
                    <th style={{ width: '170px' }} title="F1 = Fase 1 (nama kota/kelurahan), F2 = Fase 2 (kota cabang terpilih), F3 = Fase 3 (nama organisasi tujuan)">Bukti per fase</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((r) => {
                    const alasan = r.temuanCatatan?.[no] || [];
                    const bukti = buktiBaris(r);
                    return (
                      <tr key={r.id}>
                        <td>{r.no}</td>
                        <td style={SEL_POTONG} title={kapital(r.kotaPten)}>{kapital(r.kotaPten) || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.kodePosPten}</td>
                        <td style={SEL_POTONG} title={kapital(r.kelurahan)}>{kapital(r.kelurahan) || '-'}</td>
                        <td style={SEL_POTONG} title={r.namaOutlet}>{r.namaOutlet || '-'}</td>
                        <td style={{ ...SEL_POTONG, maxWidth: '360px' }} title={alasan.join(' · ') || undefined}>
                          {alasan.length > 0 ? alasan.join(' · ') : '-'}
                        </td>
                        <td style={SEL_POTONG} title={bukti}>{bukti || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {batas < termFilter.length && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: '0.65rem' }}
                  onClick={() => setBatas((b) => b + 300)}
                >
                  Tampilkan {Math.min(300, termFilter.length - batas)} baris lagi (sisa {termFilter.length - batas})
                </button>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
    </DialogPanel>
  );
};
