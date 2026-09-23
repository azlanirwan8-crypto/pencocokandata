import React, { useMemo, useState } from 'react';
import {
  X, MapPin, Building2, Mail, Copy, Check, ExternalLink, Navigation,
  CheckCircle2, AlertTriangle, Info, ShieldCheck, Users, Route, Store, ArrowRight
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
  nomor?: number;
  datiII?: string;
  kodePosRows?: KodePosRow[];
  masterRows?: MasterRow[];
  onClose: () => void;
}

const KARTU = { background: '#f8f9fa', border: '1px solid #eef0f3', borderRadius: '6px', padding: '0.55rem 0.75rem', minWidth: 0 } as const;
const LABEL = { fontSize: '0.65rem', color: '#878a99', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' } as const;
const NILAI = { fontSize: '0.84rem', fontWeight: 600, color: '#212529', marginTop: '0.15rem', overflowWrap: 'anywhere' } as const;

function KartuItem({ label, nilai, mono, icon: Ikon, highlight }: { label: string; nilai: React.ReactNode; mono?: boolean; icon?: React.ElementType; highlight?: boolean }) {
  const kosong = nilai === '' || nilai === null || nilai === undefined;
  return (
    <div style={{ ...KARTU, ...(highlight ? { background: '#f0fdf4', borderColor: '#bbf7d0' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        {Ikon ? <Ikon size={11} color={highlight ? '#16a34a' : '#878a99'} /> : null}
        <span style={{ ...LABEL, ...(highlight ? { color: '#166534' } : {}) }}>{label}</span>
      </div>
      <div style={{ ...NILAI, ...(mono ? { fontFamily: 'var(--font-mono)' } : {}), ...(kosong ? { color: '#adb5bd', fontWeight: 500 } : highlight ? { color: '#15803d', fontWeight: 700 } : {}) }}>
        {kosong ? '-' : nilai}
      </div>
    </div>
  );
}

function KolomBlok({ judul, ikon: Ikon, warnaHeader, anak }: { judul: string; ikon: React.ElementType; warnaHeader: string; anak: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: '240px', background: '#ffffff', border: '1px solid #e9ecef', borderRadius: '6px', overflow: 'hidden' }}>
      <div style={{ background: `${warnaHeader}0f`, borderBottom: `1px solid ${warnaHeader}25`, padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Ikon size={13} color={warnaHeader} />
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: warnaHeader, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{judul}</span>
      </div>
      <div style={{ padding: '0.6rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.45rem' }}>
        {anak}
      </div>
    </div>
  );
}

function SeksiFase({
  judul,
  faseTag,
  hasil,
  blok1,
  blok2,
  blokHasil
}: {
  judul: string;
  faseTag: string;
  hasil: { label: string; alasan: string; nada: 'ok' | 'waspada' | 'buruk' };
  blok1: React.ReactNode;
  blok2: React.ReactNode;
  blokHasil?: React.ReactNode;
}) {
  const Ikon = hasil.nada === 'ok' ? CheckCircle2 : hasil.nada === 'waspada' ? AlertTriangle : Info;
  const warna = hasil.nada === 'ok' ? '#0ab39c' : hasil.nada === 'waspada' ? '#d68b0c' : '#f06548';

  return (
    <section style={{ border: '1px solid #e9ebec', borderRadius: '8px', padding: '0.8rem', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
      {/* Header Fase */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#405189', color: '#ffffff', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
            {faseTag}
          </span>
          <h5 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#333b54' }}>{judul}</h5>
        </div>
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', fontWeight: 700, color: warna, background: `${warna}14`, border: `1px solid ${warna}44`, borderRadius: '999px', padding: '0.15rem 0.55rem', flexShrink: 0 }}
          title={hasil.alasan}
        >
          <Ikon size={12} />
          {hasil.label}
        </span>
      </div>
      <div style={{ fontSize: '0.72rem', color: '#6c757d', marginBottom: '0.7rem', lineHeight: 1.45 }}>{hasil.alasan}</div>

      {/* Perbandingan Data Berdampingan */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {blok1}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 0.1rem', color: '#adb5bd' }}>
          <ArrowRight size={16} />
        </div>
        {blok2}
      </div>

      {/* Blok Tambahan Hasil Integrasi */}
      {blokHasil ? (
        <div style={{ marginTop: '0.6rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '0.55rem 0.75rem' }}>
          <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.45rem', letterSpacing: '0.03em' }}>
            Status & Parameter Penempatan
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.45rem' }}>
            {blokHasil}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const SUMBER_TITIK: Record<string, string> = {
  row_data: 'titik tersimpan di Data Cabang',
  google: 'geocoding Google',
  esri: 'geocoding Esri',
  osm: 'geocoding Nominatim',
  wilayah_centroid: 'PERKIRAAN centroid kanwil — bukan titik kantor',
  default: 'PERKIRAAN pusat kota — bukan titik kantor',
};

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
  const ya = (n?: number) => (n === 1 ? 'Ada (1)' : 'Tidak (0)');
  const kodePosTampil = r.kodePosKelurahan || r.kodePosPten || '';

  return (
    <DialogPanel onClose={onClose} label={`Detail baris ${no}`} style={{ maxWidth: '1080px' }}>
      <div className="modal-header" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #eef1f4' }}>
        <h4 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '1rem', fontWeight: 700, color: '#1f2937' }}>
          <MapPin size={18} color="#405189" />
          Detail Analisa Baris #{no} — {r.namaOutlet || r.kelurahan}
        </h4>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
      </div>

      <div className="modal-body" style={{ padding: '1.1rem', maxHeight: '82vh', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, 1fr)', gap: '1rem', alignItems: 'start' }}>
          
          {/* ─────────── KIRI: PERBANDINGAN DATA LENGKAP TIAP FASE (1, 2, 3) ─────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', minWidth: 0 }}>
            
            {/* Header Informasi Utama Baris */}
            <div style={{ ...KARTU, background: '#f8fafc', borderColor: '#e2e8f0', padding: '0.85rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ ...LABEL, color: '#64748b' }}>Kelurahan / Lokasi Target</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>{r.kelurahan || '-'}</div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.1rem' }}>
                    {[r.kecamatan, datiII || r.kotaPtenMax15 || r.kotaPten, r.provinsi].filter(Boolean).join(' · ') || '-'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#ffffff', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <Mail size={13} color="#64748b" />
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#f06548', fontFamily: 'var(--font-mono)' }}>
                    {kodePosTampil || '-'}
                  </span>
                  {kodePosTampil ? (
                    <button
                      type="button"
                      onClick={() => salin(kodePosTampil, 'kp')}
                      aria-label={`Salin kode pos ${kodePosTampil}`}
                      style={{ background: 'transparent', border: 'none', color: tersalin === 'kp' ? '#0ab39c' : '#94a3b8', cursor: 'pointer', padding: '0.15rem', display: 'inline-flex' }}
                    >
                      {tersalin === 'kp' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* ════════ FASE 1: PERBANDINGAN DATA KODEPOS VS DATA PTEN ════════ */}
            <SeksiFase
              faseTag="FASE 1"
              judul="Perbandingan Data KodePos vs Data PTEN"
              hasil={penjelasanFase1(r)}
              blok1={
                <KolomBlok judul="1. Data KodePos (Wilayah)" ikon={Mail} warnaHeader="#3577f1" anak={
                  <>
                    <KartuItem label="Kode Pos Wilayah" mono highlight nilai={r.kodePosKelurahan || kodePosTampil} />
                    <KartuItem label="Kelurahan / Desa" nilai={r.kelurahan} />
                    <KartuItem label="Kecamatan" nilai={r.kecamatan} />
                    <KartuItem label="Kota/Kab (KodePos)" nilai={datiII || r.groupKota || '-'} />
                    <KartuItem label="Provinsi" nilai={r.provinsi} />
                  </>
                } />
              }
              blok2={
                <KolomBlok judul="2. Data PTEN (Target Match)" ikon={ShieldCheck} warnaHeader="#0ab39c" anak={
                  <>
                    <KartuItem label="Kode Pos PTEN" mono nilai={r.kodePosPten} />
                    <KartuItem label="Kota PTEN" highlight nilai={r.kotaPten} />
                    <KartuItem label="Kota PTEN (Maks 15)" mono highlight nilai={r.kotaPtenMax15} />
                    <KartuItem label="Status PTEN" nilai={r.statusPten} />
                    <KartuItem label="Grup Kota" nilai={r.groupKota} />
                  </>
                } />
              }
              blokHasil={
                <>
                  <KartuItem label="Hasil Penempatan" nilai={r.placementStatus} />
                  <KartuItem label="Metode Penempatan" nilai={r.placementMethod} />
                  <KartuItem label="Urutan Kelurahan" nilai={`${r.kelurahanSeq ?? '-'} dari ${r.allKelurahanCount ?? '-'} di kota ini`} />
                  <KartuItem label="Index Baris Sumber" mono nilai={r.sourceRowIndex} />
                </>
              }
            />

            {/* ════════ FASE 2: PERBANDINGAN HASIL FASE 1 VS DATA CABANG & WILAYAH ════════ */}
            <SeksiFase
              faseTag="FASE 2"
              judul="Perbandingan Hasil Fase 1 vs Data Cabang & Wilayah"
              hasil={penjelasanFase2(r)}
              blok1={
                <KolomBlok judul="1. Hasil Kota PTEN (Fase 1)" ikon={Building2} warnaHeader="#d68b0c" anak={
                  <>
                    <KartuItem label="Kota PTEN Terpilih" highlight nilai={r.kotaPtenMax15 || r.kotaPten} />
                    <KartuItem label="Kelurahan / Desa" nilai={r.kelurahan} />
                    <KartuItem label="Kecamatan" nilai={r.kecamatan} />
                    <KartuItem label="Provinsi" nilai={r.provinsi} />
                    <KartuItem label="Kode Pos" mono nilai={kodePosTampil} />
                  </>
                } />
              }
              blok2={
                <KolomBlok judul="2. Data Cabang Terdekat (Master Cabang)" ikon={Store} warnaHeader="#0284c7" anak={
                  <>
                    <KartuItem label="Nama Outlet" highlight nilai={r.namaOutlet} />
                    <KartuItem label="Branch Code" mono highlight nilai={r.branchCode} />
                    <KartuItem label="Kode Cabang" mono nilai={r.kodeCabang} />
                    <KartuItem label="Sandi Cabang" mono nilai={r.sandiCabang} />
                    <KartuItem label="Wilayah / Kanwil" mono nilai={r.wilayah} />
                    <KartuItem label="Nama Cabang" nilai={r.cabang} />
                    <KartuItem label="Status Outlet" nilai={r.statusOutlet} />
                    <KartuItem label="Alamat Cabang" nilai={r.alamat} />
                  </>
                } />
              }
              blokHasil={
                <>
                  <KartuItem label="Jarak Administratif" highlight nilai={r.fase2JarakKm > 0 ? `${r.fase2JarakKm.toLocaleString('id-ID')} km` : '0 km'} />
                  <KartuItem label="Tingkat Cakupan" nilai={r.fase2Tier === 1 ? 'Tier 1 — Sekota' : r.fase2Tier === 3 ? 'Tier 3 — Luar Provinsi' : r.fase2Tier ? 'Tier 2 — Seprovinsi' : '-'} />
                  <KartuItem label="Sumber Penempatan" nilai={r.fase2Sumber} />
                  <KartuItem label="Status Fase 2" nilai={r.fase2Status} />
                </>
              }
            />

            {r.fase2Temuan?.length ? (
              <div style={{ ...KARTU, border: '1px solid #fed7aa', background: '#fffbeb', padding: '0.65rem 0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AlertTriangle size={13} color="#d97706" />
                  <span style={{ ...LABEL, color: '#b45309' }}>Catatan / Temuan Fase 2 ({r.fase2Temuan.length})</span>
                </div>
                <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem', fontSize: '0.75rem', color: '#92400e', lineHeight: 1.55 }}>
                  {r.fase2Temuan.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            ) : null}

            {/* ════════ FASE 3: PERBANDINGAN CABANG VS DATA MAPPING ROLE & WONDR ════════ */}
            <SeksiFase
              faseTag="FASE 3"
              judul="Perbandingan Cabang vs Data Mapping Role & Wondr"
              hasil={penjelasanFase3(r)}
              blok1={
                <KolomBlok judul="1. Identitas Cabang Terpilih" ikon={Store} warnaHeader="#6366f1" anak={
                  <>
                    <KartuItem label="Nama Outlet" highlight nilai={r.namaOutlet} />
                    <KartuItem label="Branch Code" mono nilai={r.branchCode} />
                    <KartuItem label="Organisasi Tujuan" highlight nilai={r.organisasiTujuan} />
                    <KartuItem label="Tipe Unit" nilai={r.tipeUnit} />
                  </>
                } />
              }
              blok2={
                <KolomBlok judul="2. Data Mapping Role Pegawai" ikon={Users} warnaHeader="#8b5cf6" anak={
                  <>
                    <KartuItem label="Sales (CABSAL)" nilai={ya(r.roleCabsal)} />
                    <KartuItem label="Verifikator 1 (CABAPV1)" nilai={ya(r.roleCabapv1)} />
                    <KartuItem label="Penyetuju 2 (CABAPV2)" nilai={ya(r.roleCabapv2)} />
                    <KartuItem label="Grand Total Pegawai" highlight nilai={`${r.roleGrandTotal ?? 0} orang`} />
                  </>
                } />
              }
              blokHasil={
                <>
                  <KartuItem label="Kelengkapan 3 Role" highlight nilai={r.is3RoleLengkap ? 'LENGKAP' : 'BELUM LENGKAP'} />
                  <KartuItem label="Alur Rekomendasi Wondr" highlight icon={Route} nilai={r.alurWondr} />
                  <KartuItem label="Skor Keyakinan (Confidence)" nilai={`${r.confidenceScore ?? 0}%`} />
                  <KartuItem label="Algoritma Matching" nilai={r.matchingAlgorithm} />
                </>
              }
            />

          </div>

          {/* ─────────── KANAN: PETA TITIK KOORDINAT & PERSETUJUAN ─────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
            {titik ? (
              <iframe
                title={`Peta ${titik.untuk === 'cabang' ? r.namaOutlet : r.kelurahan}`}
                src={`https://maps.google.com/maps?q=${titik.lat},${titik.lng}&z=14&hl=id&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                style={{ width: '100%', minHeight: '340px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}
              />
            ) : (
              <div style={{ minHeight: '340px', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1.2rem', textAlign: 'center' }}>
                <MapPin size={28} color="#94a3b8" />
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Titik Koordinat Belum Tersedia</div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Kelurahan ini belum memiliki koordinat tersimpan di Data Kode Pos dan kantor {r.namaOutlet || 'terpilih'} belum memiliki koordinat di Data Cabang.
                </div>
              </div>
            )}

            {/* Info Koordinat Card */}
            <div style={{ ...KARTU, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', padding: '0.75rem 0.85rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Navigation size={11} color="#f06548" /> Titik Lokasi ({titik ? titik.untuk : 'koordinat'})
                </div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)', fontSize: '0.84rem', marginTop: '0.15rem' }}>
                  {titik ? `${titik.lat.toFixed(6)}, ${titik.lng.toFixed(6)}` : 'Belum ada'}
                </div>
                {titik ? <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem' }}>Sumber: {titik.sumber}</div> : null}
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
                  fontSize: '0.72rem', padding: '0.3rem 0.6rem', fontWeight: 600
                }}
              >
                <ExternalLink size={12} /> Buka Maps
              </button>
            </div>

            {/* Status Riwayat Persetujuan */}
            <div style={{ ...KARTU, padding: '0.75rem 0.85rem' }}>
              <span style={LABEL}>Riwayat Persetujuan Fase</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginTop: '0.45rem', fontSize: '0.75rem', fontWeight: 700 }}>
                <div style={{ background: r.fase1Approved ? '#f0fdf4' : '#f8fafc', color: r.fase1Approved ? '#16a34a' : '#94a3b8', padding: '0.3rem', borderRadius: '4px', textAlign: 'center', border: '1px solid', borderColor: r.fase1Approved ? '#bbf7d0' : '#e2e8f0' }}>
                  Fase 1 {r.fase1Approved ? '✓' : '—'}
                </div>
                <div style={{ background: r.fase2Approved ? '#f0fdf4' : '#f8fafc', color: r.fase2Approved ? '#16a34a' : '#94a3b8', padding: '0.3rem', borderRadius: '4px', textAlign: 'center', border: '1px solid', borderColor: r.fase2Approved ? '#bbf7d0' : '#e2e8f0' }}>
                  Fase 2 {r.fase2Approved ? '✓' : '—'}
                </div>
                <div style={{ background: r.fase3Approved ? '#f0fdf4' : '#f8fafc', color: r.fase3Approved ? '#16a34a' : '#94a3b8', padding: '0.3rem', borderRadius: '4px', textAlign: 'center', border: '1px solid', borderColor: r.fase3Approved ? '#bbf7d0' : '#e2e8f0' }}>
                  Fase 3 {r.fase3Approved ? '✓' : '—'}
                </div>
              </div>
              {r.editedManually ? (
                <div style={{ fontSize: '0.68rem', color: '#d97706', marginTop: '0.4rem', fontWeight: 600 }}>
                  * Baris ini pernah disesuaikan secara manual oleh operator
                </div>
              ) : null}
            </div>

          </div>
        </div>
      </div>

      <div className="modal-footer" style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #eef1f4' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Tutup
        </button>
      </div>
    </DialogPanel>
  );
};
