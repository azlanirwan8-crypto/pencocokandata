import React, { useMemo, useState, useDeferredValue } from 'react';
import { ClipboardCheck, Search, FileSpreadsheet, Undo2 } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import type { AnalystRow } from '../../utils/analystPipeline';
import { formatWilayahCode } from '../../utils/excel';

interface FinalDataManagerProps {
  rows: AnalystRow[];
  onReturnAll: () => void;
}

const PAGE_SIZE = 25;

// Final Data: hasil analisa 3 fase yang sudah disetujui operator.
// Baris dipindah dari Data Analyst ke sini (IndexedDB `analyst_final_data`).
export const FinalDataManager: React.FC<FinalDataManagerProps> = ({ rows, onReturnAll }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [wilayahFilter, setWilayahFilter] = useState('ALL');
  const [page, setPage] = useState(1);

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
        r.kodePosPten?.includes(q)
      );
    });
  }, [rows, deferredSearch, wilayahFilter]);

  const totalHal = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const hal = Math.min(page, totalHal);
  const tampil = filtered.slice((hal - 1) * PAGE_SIZE, hal * PAGE_SIZE);

  const handleExport = () => {
    const data = filtered.map((r, i) => ({
      No: i + 1,
      Wilayah: r.wilayah,
      'Sandi Cabang': r.sandiCabang,
      'Branch Code': r.branchCode,
      'Kode Cabang': r.kodeCabang,
      'Nama Outlet': r.namaOutlet,
      'KOTA/KABUPATEN (MAX 15 DIGIT)': r.kotaPtenMax15 || r.kotaPten,
      'KODE POS': r.kodePosPten,
      Kelurahan: r.kelurahan,
      Kecamatan: r.kecamatan,
      Provinsi: r.provinsi,
      'ORGANISASI TUJUAN': r.organisasiTujuan,
      'Tipe Unit': r.tipeUnit,
      QRS_CABSAL: r.roleCabsal,
      QRS_CABAPV1: r.roleCabapv1,
      QRS_CABAPV2: r.roleCabapv2,
      'Grand Total': r.roleGrandTotal,
      'Alur Wondr': r.alurWondr,
      Status: r.isFinalApproved ? 'FINAL' : r.statusAnalisa,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
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
                if (window.confirm(`Kembalikan ${rows.length.toLocaleString('id-ID')} baris ke Data Analyst? Final Data akan kosong.`)) onReturnAll();
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
          <table className="modern-table" style={{ width: '100%', minWidth: '1100px', fontSize: '0.76rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Wilayah</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Sandi Cabang</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Branch Code</th>
                <th style={{ minWidth: '160px' }}>Nama Outlet</th>
                <th style={{ minWidth: '150px' }} title="Kolom PTEN KOTA/KABUPATEN MAX 15 DIGIT">Kota / Kab (MAX 15 Digit)</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Kode Pos</th>
                <th style={{ minWidth: '130px' }}>Kelurahan</th>
                <th style={{ minWidth: '130px' }}>Kecamatan</th>
                <th style={{ minWidth: '130px' }}>Provinsi</th>
                <th style={{ minWidth: '180px' }}>Organisasi Tujuan</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Tipe</th>
                <th style={{ width: '70px', textAlign: 'center' }}>3 Role</th>
                <th style={{ minWidth: '150px' }}>Alur Wondr</th>
              </tr>
            </thead>
            <tbody>
              {tampil.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '2rem', color: '#878a99' }}>
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
                    <td style={{ fontWeight: 600, color: '#405189' }}>{r.namaOutlet}</td>
                    <td>{r.kotaPtenMax15 || r.kotaPten}</td>
                    <td className="code-cell" style={{ textAlign: 'center', color: '#0ab39c', fontWeight: 700 }}>{r.kodePosPten}</td>
                    <td>{r.kelurahan}</td>
                    <td>{r.kecamatan}</td>
                    <td>{r.provinsi}</td>
                    <td>{r.organisasiTujuan}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${r.tipeUnit === 'KC' ? 'badge-match' : 'badge-level2'}`}>{r.tipeUnit}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: r.is3RoleLengkap ? '#0ab39c' : '#f06548' }}>
                      {r.roleGrandTotal}/3
                    </td>
                    <td>
                      <span className="badge badge-match" style={{ fontSize: '0.68rem' }}>{r.alurWondr}</span>
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
      </div>
    </div>
  );
};
