import React, { useMemo, useState } from 'react';
import {
  X, MapPin, Building2, Mail, Copy, Check, ExternalLink, Sparkles, Navigation,
  CheckCircle2, AlertTriangle, Info, ShieldCheck, Users, Route,
} from 'lucide-react';
import { DialogPanel } from '../BaseModal';
import type { AnalystRow } from '../../utils/analystPipeline';
import { penjelasanFase1, penjelasanFase2, penjelasanFase3 } from '../../utils/analystPipeline';
import type { MasterRow } from '../../types';
import type { KodePosRow } from '../../utils/neonSync';
import { mapsUrlFor } from '../../utils/neonSync';
import { resolveBranchCoordinates } from '../../utils/geoCoder';
import { kunciKelKec, kotaCocok } from '../../utils/geoTitik';

interface Props {
  row: AnalystRow | null;
  /** Nomor yang dipakai di kepala modal. Data Final menampilkan urutan masuk, bukan `no`. */
  nomor?: number;
  /** Kabupaten/kota kelurahan ini menurut Data KodePos (dihitung di grid, tidak disimpan di baris). */
  datiII?: string;
  /** Sumber titik kelurahan di peta — tanpa ini peta hanya bisa menunjuk cabang. */
  kodePosRows?: KodePosRow[];
  /** Baris Data Cabang; titik cabang hanya dipercaya kalau kolomnya benar-benar tersimpan. */
  masterRows?: MasterRow[];
  onClose: () => void;
}

const KARTU = { background: '#f8f9fa', border: '1px solid #eef0f3', borderRadius: '6px', padding: '0.65rem 0.8rem', minWidth: 0 } as const;
const LABEL = { fontSize: '0.66rem', color: '#878a99', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' } as const;
const NILAI = { fontSize: '0.86rem', fontWeight: 600, color: '#212529', marginTop: '0.2rem', overflowWrap: 'anywhere' } as const;

function Kartu({ label, nilai, mono, icon: Ikon, nada }: { label: string; nilai: React.ReactNode; mono?: boolean; icon?: React.ElementType; nada?: 'ok' | 'waspada' | 'buruk' }) {
  const kosong = nilai === '' || nilai === null || nilai === undefined;
  const warna = nada === 'ok' ? '#0ab39c' : nada === 'waspada' ? '#d68b0c' : nada === 'buruk' ? '#f06548' : '#f06548';
  return (
    <div style={KARTU}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        {Ikon ? <Ikon size={12} color={warna} /> : null}
        <span style={LABEL}>{label}</span>
      </div>
      <div style={{ ...NILAI, ...(mono ? { fontFamily: 'var(--font-mono)' } : {}), ...(kosong ? { color: '#adb5bd', fontWeight: 500 } : {}) }}>
        {kosong ? '-' : nilai}
      </div>
    </div>
  );
}

function Bagian({ judul, hasil, isi }: { judul: string; hasil: { label: string; alasan: string; nada: 'ok' | 'waspada' | 'buruk' }; isi: React.ReactNode }) {
  const Ikon = hasil.nada === 'ok' ? CheckCircle2 : hasil.nada === 'waspada' ? AlertTriangle : Info;
  const warna = hasil.nada === 'ok' ? '#0ab39c' : hasil.nada === 'waspada' ? '#d68b0c' : '#f06548';
  return (
    <section style={{ border: '1px solid #e9ebec', borderRadius: '6px', padding: '0.7rem 0.8rem', background: '#ffffff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.35rem' }}>
        <h5 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, color: '#405189', letterSpacing: '0.02em' }}>{judul}</h5>
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', fontWeight: 700, color: warna, background: `${warna}14`, border: `1px solid ${warna}44`, borderRadius: '999px', padding: '0.15rem 0.5rem', flexShrink: 0 }}
          title={hasil.alasan}
        >
          <Ikon size={12} />
          {hasil.label}
        </span>
      </div>
      <div style={{ fontSize: '0.72rem', color: '#5b5f6e', marginBottom: '0.6rem', lineHeight: 1.45 }}>{hasil.alasan}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>{isi}</div>
    </section>
  );
}

/** Sumber titik peta dengan label yang jujur: titik tersimpan ≠ perkiraan centroid. */
const SUMBER_TITIK: Record<string, string> = {
  row_data: 'titik tersimpan di Data Cabang',
  google: 'geocoding Google',
  esri: 'geocoding Esri',
  osm: 'geocoding Nominatim',
  wilayah_centroid: 'PERKIRAAN centroid kanwil — bukan titik kantor',
  default: 'PERKIRAAN pusat kota — bukan titik kantor',
};

/**
 * Jendela "Detail" satu baris hasil analisa 3 fase: identitas kelurahan, hasil tiap fase,
 * dan titik di peta. Dibaca tanpa mengubah apa pun (koreksi data tetap lewat menu Data Master).
 * Dipakai menu Data Analyst dan Data Final supaya keduanya tidak punya tampilan berbeda
 * untuk baris yang sama.
 */
export const AnalystRowDetailModal: React.FC<Props> = ({ row, nomor, datiII, kodePosRows, masterRows, onClose }) => {
  const [tersalin, setTersalin] = useState('');
  const r = row;

  const titik = useMemo(() => {
    if (!r) return null;
    const kelurahan = (() => {
      const daftar = (kodePosRows || []).filter(
        (k) => k.latitude != null && k.longitude != null && kunciKelKec(k.kelurahan, k.kecamatan) === kunciKelKec(r.kelurahan, r.kecamatan)
      );
      if (!daftar.length) return null;
      const kp = String(r.kodePosKelurahan || r.kodePosPten || '').replace(/\D/g, '');
      const cocok = daftar.find((k) => String(k.kodePos).replace(/\D/g, '') === kp) || daftar.find((k) => kotaCocok(k.kabupatenKota, r.kotaPtenMax15 || r.kotaPten || ''));
      const pilih = cocok || (daftar.length === 1 ? daftar[0] : null);
      return pilih ? { lat: pilih.latitude as number, lng: pilih.longitude as number, sumber: pilih.geoSumber || 'titik Data Kode Pos', untuk: 'kelurahan' } : null;
    })();
    const cabang = (() => {
      const kode = String(r.branchCode || r.kodeCabang || '').trim();
      const m = kode ? (masterRows || []).find((x) => String(x['Branch Code'] || x['Kode Cabang'] || '').trim() === kode) : undefined;
      if (!m) return null;
      const g = resolveBranchCoordinates(m);
      // Centroid kanwil dan default Jakarta selalu dikembalikan fungsi itu — memakainya
      // sebagai "titik kantor" akan membohongi peta, jadi hanya titik nyata yang dipakai.
      return g.source === 'row_data' ? { lat: g.lat, lng: g.lng, sumber: SUMBER_TITIK.row_data, untuk: 'cabang' } : null;
    })();
    return cabang || kelurahan || null;
  }, [r, kodePosRows, masterRows]);

  if (!r) return null;
  const no = nomor ?? r.no;
  const salin = (teks: string, id: string) => {
    navigator.clipboard?.writeText(teks);
    setTersalin(id);
    window.setTimeout(() => setTersalin(''), 1400);
  };
  const ya = (n?: number) => (n === 1 ? 'ada' : 'belum');
  const kodePosTampil = r.kodePosKelurahan || r.kodePosPten || '';

  return (
    <DialogPanel onClose={onClose} label={`Detail baris ${no}`} style={{ maxWidth: '980px' }}>
      <div className="modal-header">
        <h4 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <MapPin size={16} color="#405189" />
          Detail Baris #{no} — {r.namaOutlet || r.kelurahan}
        </h4>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
      </div>

      <div className="modal-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '0.9rem', alignItems: 'start' }}>
          {/* ─────────── kiri: identitas + hasil 3 fase ─────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', minWidth: 0 }}>
            <div style={{ ...KARTU, padding: '0.9rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={12} color="#878a99" />
                <span style={LABEL}>Kode Pos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f06548', fontFamily: 'var(--font-mono)', lineHeight: 1.1, wordBreak: 'break-all' }}>
                  {kodePosTampil || '-'}
                </span>
                {kodePosTampil ? (
                  <button
                    type="button"
                    onClick={() => salin(kodePosTampil, 'kp')}
                    aria-label={`Salin kode pos ${kodePosTampil}`}
                    style={{ background: 'transparent', border: 'none', color: tersalin === 'kp' ? '#0ab39c' : '#878a99', cursor: 'pointer', padding: '0.2rem', display: 'inline-flex' }}
                  >
                    {tersalin === 'kp' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                ) : null}
              </div>
              <div style={{ height: '1px', background: '#e9ecef', margin: '0.7rem 0' }} />
              <span style={LABEL}>Lokasi</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#212529', marginTop: '0.15rem' }}>{r.kelurahan || '-'}</div>
              <div style={{ fontSize: '0.8rem', color: '#5b5f6e', marginTop: '0.1rem' }}>
                {[r.kecamatan, datiII || r.kotaPtenMax15 || r.kotaPten, r.provinsi].filter(Boolean).join(', ') || '-'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <Kartu label="Provinsi" icon={MapPin} nilai={r.provinsi} />
              <Kartu label="Kota / Kabupaten" icon={Building2} nilai={datiII || r.kotaPtenMax15 || r.kotaPten} />
              <Kartu label="Kecamatan" icon={Sparkles} nilai={r.kecamatan} />
              <Kartu label="Kelurahan / Desa" icon={CheckCircle2} nilai={r.kelurahan} />
            </div>

            <Bagian
              judul="HASIL FASE 1 — pemetaan kelurahan ke kota PTEN"
              hasil={penjelasanFase1(r)}
              isi={
                <>
                  <Kartu label="Kota PTEN" nilai={r.kotaPten} />
                  <Kartu label="Kota PTEN (maks 15)" nilai={r.kotaPtenMax15} />
                  <Kartu label="Kode Pos PTEN" mono nilai={r.kodePosPten} />
                  <Kartu label="Kode Pos Kelurahan" mono nilai={r.kodePosKelurahan} />
                  <Kartu label="Status PTEN" nilai={r.statusPten} />
                  <Kartu label="Penempatan" nilai={r.placementStatus} />
                  <Kartu label="Metode Penempatan" nilai={r.placementMethod} />
                  <Kartu label="Grup Kota" nilai={r.groupKota} />
                  <Kartu label="Kelurahan ke-" nilai={`${r.kelurahanSeq ?? '-'} dari ${r.allKelurahanCount ?? '-'} di kota ini`} />
                  <Kartu label="Baris Sumber" mono nilai={r.sourceRowIndex} />
                </>
              }
            />

            <Bagian
              judul="HASIL FASE 2 — cabang yang memegang kelurahan ini"
              hasil={penjelasanFase2(r)}
              isi={
                <>
                  <Kartu label="Wilayah / Kanwil" mono nilai={r.wilayah} />
                  <Kartu label="Sandi Cabang" mono nilai={r.sandiCabang} />
                  <Kartu label="Branch Code" mono nilai={r.branchCode} />
                  <Kartu label="Kode Cabang" mono nilai={r.kodeCabang} />
                  <Kartu label="Nama Outlet" nilai={r.namaOutlet} />
                  <Kartu label="Cabang" nilai={r.cabang} />
                  <Kartu label="Status Outlet" nilai={r.statusOutlet} />
                  <Kartu label="Alamat" nilai={r.alamat} />
                  <Kartu label="Jarak" nilai={r.fase2JarakKm > 0 ? `${r.fase2JarakKm.toLocaleString('id-ID')} km` : ''} />
                  <Kartu label="Peringkat" nilai={r.fase2Tier === 1 ? '1 — sekota' : r.fase2Tier === 3 ? '3 — luar provinsi' : r.fase2Tier ? '2 — seprovinsi' : ''} />
                  <Kartu label="Sumber Penempatan" nilai={r.fase2Sumber} />
                  <Kartu label="Status Fase 2" nilai={r.fase2Status} />
                </>
              }
            />

            {r.fase2Temuan?.length ? (
              <div style={{ ...KARTU, border: '1px solid #f2d9a8', background: '#fff8ec' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AlertTriangle size={12} color="#d68b0c" />
                  <span style={{ ...LABEL, color: '#8a5a00' }}>Temuan Fase 2 ({r.fase2Temuan.length})</span>
                </div>
                <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem', fontSize: '0.76rem', color: '#8a5a00', lineHeight: 1.6 }}>
                  {r.fase2Temuan.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            ) : null}

            <Bagian
              judul="HASIL FASE 3 — role & alur Wondr cabang tersebut"
              hasil={penjelasanFase3(r)}
              isi={
                <>
                  <Kartu label="Organisasi Tujuan" icon={Building2} nilai={r.organisasiTujuan} />
                  <Kartu label="Tipe Unit" icon={Users} nilai={r.tipeUnit} />
                  <Kartu label="Sales (CABSAL)" nilai={ya(r.roleCabsal)} />
                  <Kartu label="Verifikator 1" nilai={ya(r.roleCabapv1)} />
                  <Kartu label="Verifikator 2" nilai={ya(r.roleCabapv2)} />
                  <Kartu label="Grand Total" nilai={`${r.roleGrandTotal ?? 0} org`} />
                  <Kartu label="3 Role" nilai={r.is3RoleLengkap ? 'LENGKAP' : 'BELUM LENGKAP'} />
                  <Kartu label="Alur Wondr" icon={Route} nilai={r.alurWondr} />
                  <Kartu label="Keyakinan" nilai={`${r.confidenceScore ?? 0}%`} />
                  <Kartu label="Algoritma" nilai={r.matchingAlgorithm} />
                  <Kartu label="Status Analisa" icon={ShieldCheck} nilai={r.isFinalApproved ? 'FINAL' : r.statusAnalisa} />
                  <Kartu label="Kategori" nilai={r.kategori} />
                </>
              }
            />
          </div>

          {/* ─────────── kanan: peta + koordinat + persetujuan ─────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 0 }}>
            {titik ? (
              <iframe
                title={`Peta ${titik.untuk === 'cabang' ? r.namaOutlet : r.kelurahan}`}
                src={`https://maps.google.com/maps?q=${titik.lat},${titik.lng}&z=14&hl=id&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                style={{ width: '100%', minHeight: '330px', border: '1px solid #eef0f3', borderRadius: '6px', background: '#f1f3f5' }}
              />
            ) : (
              <div style={{ minHeight: '330px', border: '1px dashed #d0d7de', borderRadius: '6px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', textAlign: 'center' }}>
                <MapPin size={26} color="#adb5bd" />
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5b5f6e' }}>Titik belum tersedia</div>
                <div style={{ fontSize: '0.76rem', color: '#878a99', lineHeight: 1.5 }}>
                  Kelurahan ini belum punya titik di Data Kode Pos dan kantor {r.namaOutlet || 'terpilih'} belum menyimpan koordinat
                  di Data Cabang. Peta sengaja tidak memakai perkiraan centroid.
                </div>
              </div>
            )}

            <div style={{ ...KARTU, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Navigation size={11} color="#f06548" /> Titik {titik ? titik.untuk : 'koordinat'}
                </div>
                <div style={{ fontWeight: 700, color: '#212529', fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}>
                  {titik ? `${titik.lat.toFixed(6)}, ${titik.lng.toFixed(6)}` : 'belum ada'}
                </div>
                {titik ? <div style={{ fontSize: '0.68rem', color: '#878a99', marginTop: '0.1rem' }}>{titik.sumber}</div> : null}
              </div>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!titik}
                onClick={() => titik && window.open(mapsUrlFor(titik.lat, titik.lng), '_blank', 'noopener,noreferrer')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap',
                  background: 'rgba(10, 179, 156, 0.12)', border: '1px solid rgba(10, 179, 156, 0.3)',
                  color: titik ? '#0ab39c' : '#adb5bd', cursor: titik ? 'pointer' : 'not-allowed',
                }}
              >
                <ExternalLink size={12} /> Buka Maps
              </button>
            </div>

            <div style={KARTU}>
              <span style={LABEL}>Persetujuan</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 0.6rem', marginTop: '0.35rem', fontSize: '0.76rem', color: '#212529', fontWeight: 600 }}>
                <span>Fase 1 {r.fase1Approved ? '✓' : '—'}</span>
                <span>Fase 2 {r.fase2Approved ? '✓' : '—'}</span>
                <span>Fase 3 {r.fase3Approved ? '✓' : '—'}</span>
                <span>Final {r.isFinalApproved ? '✓' : '—'}</span>
              </div>
              {r.editedManually ? <div style={{ fontSize: '0.7rem', color: '#d68b0c', marginTop: '0.35rem' }}>pernah dikoreksi manual</div> : null}
            </div>
          </div>
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
