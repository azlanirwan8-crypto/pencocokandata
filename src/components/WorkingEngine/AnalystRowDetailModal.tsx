import React from 'react';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { DialogPanel } from '../BaseModal';
import type { AnalystRow } from '../../utils/analystPipeline';
import { penjelasanFase1, penjelasanFase2, penjelasanFase3 } from '../../utils/analystPipeline';

interface Props {
  row: AnalystRow | null;
  /** Kabupaten/kota kelurahan ini menurut Data KodePos (dihitung di grid, tidak disimpan di baris). */
  datiII?: string;
  onClose: () => void;
}

const BARIS: React.CSSProperties = { display: 'flex', gap: '0.5rem', padding: '0.2rem 0', borderBottom: '1px dashed #eef1f4', fontSize: '0.78rem' };
const LABEL: React.CSSProperties = { flex: '0 0 150px', color: '#878a99' };
const NILAI: React.CSSProperties = { flex: 1, color: '#212529', fontWeight: 600, wordBreak: 'break-word' };

function Kelompok({ judul, hasil, isi }: { judul: string; hasil: { label: string; alasan: string; nada: 'ok' | 'waspada' | 'buruk' }; isi: React.ReactNode }) {
  const Ikon = hasil.nada === 'ok' ? CheckCircle2 : hasil.nada === 'waspada' ? AlertTriangle : Info;
  const warna = hasil.nada === 'ok' ? '#059669' : hasil.nada === 'waspada' ? '#d97706' : '#dc2626';
  return (
    <section style={{ border: '1px solid #e9ebec', borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '0.7rem', background: '#fcfdfe' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'nowrap' }}>
        <h5 style={{ margin: 0, fontSize: '0.82rem', color: '#405189' }}>{judul}</h5>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 700, color: warna, flexShrink: 0 }} title={hasil.alasan}>
          <Ikon size={13} style={{ flexShrink: 0 }} />
          {hasil.label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.45rem' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hasil.alasan}>{hasil.alasan}</span>
      </div>
      {isi}
    </section>
  );
}

const B = (label: string, nilai: React.ReactNode, key?: React.Key) => (
  <div style={BARIS} key={key}>
    <span style={LABEL}>{label}</span>
    <span style={NILAI}>{nilai === '' || nilai === null || nilai === undefined ? '-' : nilai}</span>
  </div>
);

/**
 * Jendela "Detail" satu baris hasil analisa: seluruh atribut yang dibaca mesin per fase,
 * dibaca tanpa mengubah apa pun (koreksi data tetap lewat menu Data Master).
 */
export const AnalystRowDetailModal: React.FC<Props> = ({ row, datiII, onClose }) => {
  if (!row) return null;
  const r = row;
  const ya = (n?: number) => (n === 1 ? '✓ ada' : '✗ belum ada');
  return (
    <DialogPanel onClose={onClose} label={`Detail baris ${r.no}`} style={{ maxWidth: '760px' }}>
      <div className="modal-header">
        <h4 className="modal-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          #{r.no} {r.kelurahan} · {r.kotaPtenMax15 || r.kotaPten || r.groupKota}
        </h4>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
      </div>

      <div className="modal-body">
        <Kelompok
          judul="Fase 1 — Kelurahan ini dipetakan ke kota PTEN mana"
          hasil={penjelasanFase1(r)}
          isi={
            <>
              {B('Kode pos (Data KodePos)', r.kodePosKelurahan, 'kp')}
              {B('Kelurahan', r.kelurahan, 'kel')}
              {B('Kecamatan', r.kecamatan, 'kec')}
              {B('Dati II (Data KodePos)', datiII, 'dati')}
              {B('Provinsi', r.provinsi, 'prov')}
              {B('Kota PTEN', r.kotaPten, 'kotapten')}
              {B('Kota PTEN (MAX 15 digit)', r.kotaPtenMax15, 'kotamax')}
              {B('Kode pos PTEN', r.kodePosPten, 'kppten')}
              {B('Status PTEN', r.statusPten, 'statuspten')}
            </>
          }
        />
        <Kelompok
          judul="Fase 2 — Cabang yang memegang wilayah ini"
          hasil={penjelasanFase2(r)}
          isi={
            <>
              {B('Wilayah / Kanwil', r.wilayah, 'wil')}
              {B('Sandi Cabang', r.sandiCabang, 'sandi')}
              {B('Branch Code', r.branchCode, 'bc')}
              {B('Kode Cabang', r.kodeCabang, 'kc')}
              {B('Nama Outlet', r.namaOutlet, 'outlet')}
              {B('Status Outlet', r.statusOutlet, 'statusoutlet')}
              {B('Alamat', r.alamat, 'alamat')}
              {B('Jarak ke cabang', r.fase2JarakKm > 0 ? `${r.fase2JarakKm.toLocaleString('id-ID')} km` : '-', 'jarak')}
              {B('Peringkat', r.fase2Tier === 1 ? '1 — cabang sekota' : r.fase2Tier === 3 ? '3 — di luar provinsi' : r.fase2Tier ? '2 — sepulau/seprovinsi' : '-', 'tier')}
            </>
          }
        />
        <Kelompok
          judul="Fase 3 — Role & alur Wondr cabang tersebut"
          hasil={penjelasanFase3(r)}
          isi={
            <>
              {B('Organisasi Tujuan', r.organisasiTujuan, 'org')}
              {B('Tipe Unit', r.tipeUnit, 'unit')}
              {B('Sales (Cabsal)', ya(r.roleCabsal), 'sal')}
              {B('Verifikator 1', ya(r.roleCabapv1), 'v1')}
              {B('Verifikator 2', ya(r.roleCabapv2), 'v2')}
              {B('Total pegawai', `${r.roleGrandTotal ?? 0} Org`, 'peg')}
              {B('Alur Wondr', r.alurWondr, 'wondr')}
            </>
          }
        />

        <div style={{ fontSize: '0.72rem', color: '#878a99', lineHeight: 1.6 }}>
          Status analisa: <strong>{r.statusAnalisa}</strong> · Keyakinan {r.confidenceScore}% · {r.matchingAlgorithm}
          <br />
          Persetujuan: Fase 1 {r.fase1Approved ? '✓' : '—'} · Fase 2 {r.fase2Approved ? '✓' : '—'} · Fase 3 {r.fase3Approved ? '✓' : '—'} · Final {r.isFinalApproved ? '✓' : '—'}
          {r.editedManually && ' · pernah dikoreksi manual'}
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Tutup
        </button>
      </div>
    </DialogPanel>
  );
};
