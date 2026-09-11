import React from 'react';
import {
  X,
  Sparkles,
  MapPin,
  Building2,
  FileText,
  CheckCircle2,
  Check,
  AlertTriangle,
  Info,
  ExternalLink,
} from 'lucide-react';
import type { TargetRow, MasterRow, WilayahSetting } from '../../types';
import type { CandidateOption } from '../../utils/recommender';
import { calculateRealDistance, buildGoogleMapsDirectionsUrl } from '../../utils/geoDistance';
import { extractWilayahFromBranchCode } from '../../utils/normalizer';

interface CandidateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    targetRow: TargetRow;
    candidate: CandidateOption;
  } | null;
  onApprove: (rowNo: number | string, master: MasterRow) => void;
  wilayahSettings?: WilayahSetting[];
}

export const CandidateDetailModal: React.FC<CandidateDetailModalProps> = ({
  isOpen,
  onClose,
  data,
  onApprove,
  wilayahSettings = [],
}) => {
  if (!isOpen || !data) return null;

  const { targetRow: r, candidate: cand } = data;
  const m = cand.master;
  const isTop1 = cand.rank === 1;
  const themeColor = isTop1 ? '#0ab39c' : cand.rank === 2 ? '#d97706' : '#3577f1';

  const candWilayahInfo = extractWilayahFromBranchCode(
    m['Branch Code'] || m['Kode Cabang'] || r['Branch Code'] || r['Kode Cabang'] || '',
    wilayahSettings,
    m.Wilayah || r.Wilayah || '-'
  );

  // Pembersihan teks untuk komparasi akurat
  const clean = (val: unknown) => String(val || '').trim().toUpperCase();

  const targetProv = clean(r.Provinsi);
  const masterProv = clean(m.Provinsi);
  const provMatch = !!(targetProv && masterProv && (targetProv === masterProv || targetProv.includes(masterProv) || masterProv.includes(targetProv)));

  const targetDati = clean(r['Dati II']);
  const masterDati = clean(m['Dati II']);
  const datiMatch = !!(targetDati && masterDati && (targetDati === masterDati || targetDati.includes(masterDati) || masterDati.includes(targetDati)));

  const targetKec = clean(r.Kecamatan);
  const masterKec = clean(m.Kecamatan);
  const kecMatch = !!(targetKec && masterKec && (targetKec === masterKec || targetKec.includes(masterKec) || masterKec.includes(targetKec)));

  const targetKel = clean(r.Kelurahan);
  const masterKel = clean(m.Kelurahan);
  const kelMatch = !!(targetKel && masterKel && (targetKel === masterKel || targetKel.includes(masterKel) || masterKel.includes(targetKel)));

  const targetPos = String(r['KODE POS'] || '').trim();
  const masterPos = String(m['KODE POS'] || '').trim();
  const posMatch = !!(targetPos && masterPos && targetPos === masterPos);
  const pos3Match = !!(targetPos.length >= 3 && masterPos.length >= 3 && targetPos.slice(0, 3) === masterPos.slice(0, 3));

  // Penjelasan Narasi Ramah & Mudah Dipahami Orang Umum
  const isAceh = targetProv.includes('ACEH') || clean(r.ALAMAT).includes('ACEH');
  const isKim = clean(m.Cabang).includes('KIM') || clean(m['Nama Outlet']).includes('KIM');

  let explanationTitle = '';
  let explanationDescription = '';

  if (isAceh && isKim) {
    explanationTitle = 'Alokasi Khusus Wilayah Aceh (Otomatis Cabang KIM)';
    explanationDescription =
      'Berdasarkan kebijakan operasional perusahaan, seluruh data target di Provinsi Aceh dilayani langsung oleh Cabang KIM.';
  } else if (kelMatch && kecMatch && datiMatch) {
    explanationTitle = 'Kecocokan Sangat Tinggi (Satu Kelurahan & Kecamatan)';
    explanationDescription = `Cabang master ini berada di kelurahan (${m.Kelurahan || r.Kelurahan}) dan kecamatan (${m.Kecamatan || r.Kecamatan}) yang sama persis dengan data target. Ini adalah titik pelayanan terdekat paling ideal.`;
  } else if (kecMatch && datiMatch) {
    explanationTitle = 'Kecocokan Tinggi (Satu Kecamatan)';
    explanationDescription = `Cabang master ini berada di kecamatan yang sama (${m.Kecamatan || r.Kecamatan}), Kota/Kab. ${m['Dati II'] || r['Dati II']}. Karena belum ada cabang di kelurahan yang persis sama, sistem memilih cabang terdekat di tingkat kecamatan.`;
  } else if (datiMatch) {
    explanationTitle = 'Satu Kota / Kabupaten (Radius Terdekat)';
    explanationDescription = `Cabang master ini berada di Kota/Kabupaten yang sama (${m['Dati II'] || r['Dati II']}). Sistem merekomendasikannya sebagai cabang terdekat di wilayah administratif tersebut berdasarkan kedekatan zona kode pos.`;
  } else if (provMatch) {
    explanationTitle = 'Alternatif Terdekat Satu Provinsi';
    explanationDescription = `Pada data master tidak ditemukan cabang yang beralamat di ${r['Dati II'] || 'Kota/Kabupaten target'}. Oleh karena itu, sistem secara otomatis mencarikan cabang alternatif terdekat yang masih berada dalam satu naungan Provinsi ${r.Provinsi || m.Provinsi} (${m['Dati II'] || m.Cabang || 'Master'}).`;
  } else {
    explanationTitle = 'Alternatif Jangkauan Regional Terdekat';
    explanationDescription = `Sistem mencarikan cabang terdekat yang tersedia berdasarkan kesesuaian zona pos terluar dan radius regional data master.`;
  }

  const handleApprove = () => {
    onApprove(r.No, m);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1060,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.12), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e9ebec',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e9ebec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8f9fa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '6px',
                background: isTop1 ? 'rgba(10, 179, 156, 0.12)' : 'rgba(247, 184, 75, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isTop1 ? '#0ab39c' : '#d97706',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#212529', margin: 0 }}>
                Detail Rekomendasi & Alasan Penilaian Skor
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#878a99',
              cursor: 'pointer',
              padding: '0.3rem',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
              transition: 'color 0.15s ease',
            }}
            title="Tutup Modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Highlight Box: Cabang Terpilih & Skor */}
          <div
            style={{
              background: isTop1 ? 'rgba(10, 179, 156, 0.05)' : 'rgba(247, 184, 75, 0.06)',
              border: isTop1 ? '1px solid rgba(10, 179, 156, 0.3)' : '1px solid rgba(247, 184, 75, 0.35)',
              borderRadius: '6px',
              padding: '0.85rem 1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span
                style={{
                  padding: '0.18rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  background: isTop1 ? 'rgba(10, 179, 156, 0.15)' : 'rgba(247, 184, 75, 0.2)',
                  color: isTop1 ? '#0ab39c' : '#d97706',
                }}
              >
                {isTop1 ? 'Pilihan 1 (Utama)' : `Pilihan ${cand.rank} (Alternatif)`}
              </span>
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: isTop1 ? '#0ab39c' : '#d97706',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Sparkles size={14} /> Kemiripan Skor: {cand.score}%
              </span>
            </div>

            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#212529' }}>
              {m['Sandi Cabang'] || m.Cabang || m.Sandi || '-'}
              {m['Nama Outlet'] && (
                <span style={{ fontSize: '0.86rem', color: '#405189', fontWeight: 600, marginLeft: '0.4rem' }}>
                  • {m['Nama Outlet']}
                </span>
              )}
            </div>

            {/* Branch Code & Wilayah Tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              {candWilayahInfo.branchCode && (
                <span
                  className="code-cell"
                  style={{
                    fontSize: '0.74rem',
                    color: '#405189',
                    background: 'rgba(64, 81, 137, 0.08)',
                    border: '1px solid rgba(64, 81, 137, 0.2)',
                    padding: '0.12rem 0.5rem',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontWeight: 600,
                  }}
                  title={`Branch Code: ${candWilayahInfo.branchCode}`}
                >
                  <Building2 size={12} /> Branch: <strong>{candWilayahInfo.branchCode}</strong>
                </span>
              )}

              <span
                className="badge badge-match"
                style={{
                  fontSize: '0.74rem',
                  padding: '0.12rem 0.55rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
                title={`Wilayah ditentukan berdasarkan 2 digit kode branch: ${candWilayahInfo.wilayahName}`}
              >
                <MapPin size={11} /> {candWilayahInfo.wilayahName}
              </span>
            </div>
          </div>

          {/* Section: Alasan Penilaian Skor & Penjelasan Bahasa Awam */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e9ebec',
              borderRadius: '6px',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#405189', fontWeight: 700, fontSize: '0.82rem' }}>
              <FileText size={15} />
              <span>Alasan Penilaian & Indikator Wilayah</span>
            </div>

            {/* Box Bukti Jarak Nyata & Verifikasi Google Maps Langsung */}
            {(() => {
              const realDist =
                cand.distanceKm !== undefined
                  ? {
                      distanceKm: cand.distanceKm,
                      formattedDistance: cand.formattedDistance || `~${cand.distanceKm} km`,
                      basis: cand.distanceBasis || 'Jarak Wilayah',
                      googleMapsUrl: cand.googleMapsUrl || buildGoogleMapsDirectionsUrl(r, m),
                    }
                  : calculateRealDistance(r, m);

              return (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(53, 119, 241, 0.06), rgba(10, 179, 156, 0.08))',
                    border: '1px solid rgba(53, 119, 241, 0.25)',
                    borderRadius: '6px',
                    padding: '0.8rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'rgba(53, 119, 241, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#3577f1',
                        flexShrink: 0,
                      }}
                    >
                      <MapPin size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span>Estimasi Jarak Fisik Real:</span>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.05rem 0.35rem', borderRadius: '3px', fontSize: '0.66rem' }}>
                          Terverifikasi Geografis
                        </span>
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>
                        {realDist.formattedDistance}{' '}
                        <span style={{ fontSize: '0.73rem', fontWeight: 500, color: '#64748b' }}>
                          • {realDist.basis}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Google Maps Resmi */}
                  <a
                    href={realDist.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.45rem 0.95rem',
                      borderRadius: '5px',
                      background: '#3577f1',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      boxShadow: '0 2px 5px rgba(53, 119, 241, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    title="Buka rute Google Maps resmi antara Target dan Cabang Master di tab baru"
                  >
                    <MapPin size={14} />
                    <span>Cek Rute di Google Maps</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              );
            })()}

            {/* Kotak Narasi Penjelasan */}
            <div
              style={{
                background: '#f8f9fa',
                padding: '0.75rem 0.9rem',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                {explanationTitle}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.55 }}>
                {explanationDescription}
              </div>
            </div>

            {/* Rincian Status Kecocokan Bidang Wilayah */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.45rem',
                fontSize: '0.72rem',
              }}
            >
              {/* Provinsi */}
              <div
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '4px',
                  background: provMatch ? '#f0fdf4' : '#fffbeb',
                  border: provMatch ? '1px solid #bbf7d0' : '1px solid #fef3c7',
                  color: provMatch ? '#166534' : '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {provMatch ? <Check size={13} color="#16a34a" /> : <AlertTriangle size={13} color="#d97706" />}
                <div>
                  <strong>Provinsi: </strong>
                  <span>{provMatch ? 'Satu Provinsi' : 'Beda'}</span>
                </div>
              </div>

              {/* Kota / Dati II */}
              <div
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '4px',
                  background: datiMatch ? '#f0fdf4' : '#fffbeb',
                  border: datiMatch ? '1px solid #bbf7d0' : '1px solid #fef3c7',
                  color: datiMatch ? '#166534' : '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {datiMatch ? <Check size={13} color="#16a34a" /> : <AlertTriangle size={13} color="#d97706" />}
                <div>
                  <strong>Kota/Kab: </strong>
                  <span>{datiMatch ? 'Satu Kota' : 'Beda Kota'}</span>
                </div>
              </div>

              {/* Kecamatan */}
              <div
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '4px',
                  background: kecMatch ? '#f0fdf4' : '#f8fafc',
                  border: kecMatch ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                  color: kecMatch ? '#166534' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {kecMatch ? <Check size={13} color="#16a34a" /> : <Info size={13} color="#64748b" />}
                <div>
                  <strong>Kecamatan: </strong>
                  <span>{kecMatch ? 'Satu Kec.' : 'Beda Kec.'}</span>
                </div>
              </div>

              {/* Kode Pos */}
              <div
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '4px',
                  background: posMatch ? '#f0fdf4' : pos3Match ? '#f0f9ff' : '#f8fafc',
                  border: posMatch ? '1px solid #bbf7d0' : pos3Match ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                  color: posMatch ? '#166534' : pos3Match ? '#0369a1' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {posMatch ? <Check size={13} color="#16a34a" /> : <Info size={13} color="#0284c7" />}
                <div>
                  <strong>Kode Pos: </strong>
                  <span>{posMatch ? 'Sama' : pos3Match ? 'Satu Zona' : 'Beda Zona'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Komparasi Berdampingan Rapi & Rata Kiri-Kanan */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.45rem' }}>
              Perbandingan Data Lapangan (Target vs Master):
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {/* Kolom Kiri: Data Target Operasional */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Header Kartu Target */}
                <div
                  style={{
                    padding: '0.55rem 0.75rem',
                    background: '#fff7ed',
                    borderBottom: '1px solid #fed7aa',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: '#c2410c',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                  }}
                >
                  <MapPin size={14} />
                  <span>Data Target Operasional</span>
                </div>

                {/* Body Baris Data Target */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Branch Code */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Branch Code</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: r['Branch Code'] || r['Sandi Cabang'] || r.Cabang || r.Sandi ? '#c2410c' : '#64748b', fontWeight: 700 }}>
                      {r['Branch Code'] || r['Sandi Cabang'] || r.Cabang || r.Sandi || '-'}
                    </div>
                  </div>

                  {/* Nama Outlet */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Nama Outlet</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#1e293b', fontWeight: 600 }}>
                      {r['Nama Outlet'] || r.Cabang || '-'}
                    </div>
                  </div>

                  {/* Kode Pos */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Kode Pos</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#c2410c', fontWeight: 700 }}>{r['KODE POS'] || '-'}</div>
                  </div>

                  {/* Kecamatan */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Kecamatan</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#1e293b', fontWeight: 600 }}>{r.Kecamatan || '-'}</div>
                  </div>

                  {/* Kelurahan */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Kelurahan</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#1e293b', fontWeight: 600 }}>{r.Kelurahan || '-'}</div>
                  </div>

                  {/* Dati II (Kota) */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Dati II (Kota)</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#1e293b', fontWeight: 600 }}>{r['Dati II'] || '-'}</div>
                  </div>

                  {/* Provinsi */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Provinsi</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#1e293b', fontWeight: 600 }}>{r.Provinsi || '-'}</div>
                  </div>

                  {/* Alamat Target */}
                  <div style={{ padding: '0.55rem 0.75rem', background: '#fafafa', minHeight: '68px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Alamat Target:
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#1e293b', lineHeight: 1.45, wordBreak: 'break-word' }}>
                      {r.ALAMAT || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Tidak terisi</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Data Cabang Master Terpilih */}
              <div
                style={{
                  border: '1px solid rgba(10, 179, 156, 0.3)',
                  borderRadius: '6px',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Header Kartu Master */}
                <div
                  style={{
                    padding: '0.55rem 0.75rem',
                    background: '#f0fdf4',
                    borderBottom: '1px solid #bbf7d0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: '#15803d',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                  }}
                >
                  <Building2 size={14} />
                  <span>Data Cabang Master Terpilih</span>
                </div>

                {/* Body Baris Data Master */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Branch Code */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Branch Code</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: themeColor, fontWeight: 700 }}>
                      {m['Branch Code'] || m['Sandi Cabang'] || m.Cabang || m.Sandi || '-'}
                    </div>
                  </div>

                  {/* Nama Outlet */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Nama Outlet</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#1e293b', fontWeight: 700 }}>
                      {m['Nama Outlet'] || m.Cabang || '-'}
                    </div>
                  </div>

                  {/* Kode Pos */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Kode Pos</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#15803d', fontWeight: 700 }}>{m['KODE POS'] || '-'}</div>
                  </div>

                  {/* Kecamatan */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Kecamatan</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#1e293b', fontWeight: 600 }}>{m.Kecamatan || '-'}</div>
                  </div>

                  {/* Kelurahan */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Kelurahan</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#1e293b', fontWeight: 600 }}>{m.Kelurahan || '-'}</div>
                  </div>

                  {/* Dati II (Kota) */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Dati II (Kota)</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#1e293b', fontWeight: 600 }}>{m['Dati II'] || '-'}</div>
                  </div>

                  {/* Provinsi */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.38rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', minHeight: '30px' }}>
                    <div style={{ width: '105px', minWidth: '105px', color: '#64748b', fontWeight: 600 }}>Provinsi</div>
                    <div style={{ width: '12px', color: '#cbd5e1' }}>:</div>
                    <div style={{ flex: 1, color: '#1e293b', fontWeight: 600 }}>{m.Provinsi || '-'}</div>
                  </div>

                  {/* Alamat Master */}
                  <div style={{ padding: '0.55rem 0.75rem', background: '#fafafa', minHeight: '68px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Alamat Master:
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#1e293b', lineHeight: 1.45, wordBreak: 'break-word' }}>
                      {m.ALAMAT || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Tidak terisi di master</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e9ebec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8f9fa',
          }}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}
          >
            Tutup
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleApprove}
            style={{
              fontSize: '0.78rem',
              padding: '0.38rem 1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: themeColor,
              borderColor: themeColor,
            }}
          >
            <CheckCircle2 size={14} />
            <span>Gunakan Cabang Ini</span>
          </button>
        </div>
      </div>
    </div>
  );
};
