import React, { useEffect, useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { SINYAL_PENCOCOKAN, bitUntuk, bitTemuanBaris, hitungBit, type AnalystRow } from '../../utils/analystPipeline';

interface Props {
  no: number;
  rows: AnalystRow[];
  onClose: () => void;
}

const TABEL_BATAS_AWAL = 150;

/**
 * Detail "temuan" satu sinyal pencocokan. Daftar barisnya berasal dari bitmask
 * `sinyalBit` yang ditulis engine saat analisa — jadi isinya bukti nyata, bukan reka ulang.
 */
export const SinyalTemuanModal: React.FC<Props> = ({ no, rows, onClose }) => {
  const meta = SINYAL_PENCOCOKAN.find((s) => s.no === no);
  const [batas, setBatas] = useState(TABEL_BATAS_AWAL);
  const [cari, setCari] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const bit = bitUntuk(no);
  const temuan = useMemo(() => (bit ? rows.filter((r) => bitTemuanBaris(r) & bit) : []), [rows, bit]);
  const termFilter = useMemo(() => {
    const q = cari.trim().toUpperCase();
    if (!q) return temuan;
    return temuan.filter((r) =>
      `${r.kotaPten} ${r.kelurahan} ${r.namaOutlet} ${r.organisasiTujuan}`.toUpperCase().includes(q)
    );
  }, [temuan, cari]);
  const tampil = termFilter.slice(0, batas);

  if (!meta) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '1020px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Temuan sinyal ${meta.judul}`}
      >
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
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.75rem', lineHeight: 1.45 }}>
            {meta.deskripsi}
          </p>
          <p style={{ fontSize: '0.74rem', color: '#878a99', margin: '0 0 0.85rem' }}>
            "Temuan" = baris hasil analisa yang benar-benar dibantu sinyal ini (dicatat engine saat pencocokan
            berjalan, bukan dihitung ulang setelahnya). Kolom Fase 2/Fase 3 masih kosong bila fase itu belum
            dijalankan.
          </p>

          {temuan.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
              <div style={{ position: 'relative', flex: '0 0 280px' }}>
                <Search size={14} style={{ position: 'absolute', left: '9px', top: '9px', color: '#adb5bd' }} />
                <input
                  type="search"
                  className="form-control"
                  style={{ paddingLeft: '28px', height: '32px', fontSize: '0.8rem' }}
                  placeholder="Filter kota / kelurahan / outlet"
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
                    <th>Kota PTEN (Fase 1)</th>
                    <th style={{ width: '84px' }}>Kode Pos</th>
                    <th>Kelurahan</th>
                    <th>Nama Outlet (Fase 2)</th>
                    <th>Organisasi Tujuan (Fase 3)</th>
                    <th style={{ width: '150px' }}>Algoritma terpilih</th>
                    <th style={{ width: '58px' }}>Skor</th>
                    <th style={{ width: '120px' }}>Sinyal lain</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((r) => {
                    const lain = hitungBit(bitTemuanBaris(r)).filter((n) => n !== no);
                    return (
                      <tr key={r.id}>
                        <td>{r.no}</td>
                        <td title={r.kotaPten}>{r.kotaPten}</td>
                        <td>{r.kodePosPten}</td>
                        <td title={r.kelurahan}>{r.kelurahan}</td>
                        <td title={r.namaOutlet}>{r.namaOutlet || '-'}</td>
                        <td title={r.organisasiTujuan}>{r.organisasiTujuan || '-'}</td>
                        <td title={r.matchingAlgorithm}>{r.matchingAlgorithm || '-'}</td>
                        <td>{r.confidenceScore ? `${r.confidenceScore}%` : '-'}</td>
                        <td title={lain.map((n) => SINYAL_PENCOCOKAN.find((s) => s.no === n)?.judul || '').filter(Boolean).join(' · ')}>
                          {lain.length > 0 ? lain.map((n) => `#${n}`).join(' ') : '-'}
                        </td>
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
      </div>
    </div>
  );
};
