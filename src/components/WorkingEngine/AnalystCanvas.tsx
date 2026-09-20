import React, { useState } from 'react';
import {
  Brain,
  MapPin,
  Building2,
  Users,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';

interface AnalystCanvasProps {
  isAnalyzing: boolean;
  progressPercent: number;
  progressMessage: string;
  onStartAnalysis: () => void;
  onResetAnalysis: () => void;
  hasExistingResults: boolean;
  masterCounts: {
    pten: number;
    kodepos: number;
    wilayah: number;
    cabang: number;
    role: number;
  };
  phaseProgress?: { 1: number; 2: number; 3: number };
  currentActivePhase?: 0 | 1 | 2 | 3;
  completedPhases?: Set<number>;
  /** Persentase baris yang sudah di-approve per fase + status selesai ketat (tanpa pembulatan). */
  phaseApproval?: {
    pct: { 1: number; 2: number; 3: number };
    selesai: { 1: boolean; 2: boolean; 3: boolean };
  };
}

export const AnalystCanvas: React.FC<AnalystCanvasProps> = ({
  isAnalyzing,
  progressPercent,
  progressMessage,
  onStartAnalysis,
  onResetAnalysis,
  hasExistingResults,
  masterCounts,
  phaseProgress = { 1: 0, 2: 0, 3: 0 },
  currentActivePhase = 0,
  completedPhases = new Set(),
  phaseApproval = { pct: { 1: 0, 2: 0, 3: 0 }, selesai: { 1: false, 2: false, 3: false } },
}) => {
  const [showTheories, setShowTheories] = useState<boolean>(true);

  // Pesan langkah terbaru tampil di kartu fase yang sedang berjalan (prefix [Fase n] dibuang).
  const stepText = (fallback: string) => {
    const m = (progressMessage || '').replace(/^\[Fase \d\]\s*/, '');
    return m || fallback;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. HERO CANVA BOARD: ANALYST CORE & 3-PHASE PIPELINE FLOW                */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8faff 50%, #f0f5ff 100%)',
          border: '1px solid #dce4f5',
          borderRadius: '12px',
          padding: '1.5rem 1.75rem',
          boxShadow: '0 4px 20px rgba(64, 81, 137, 0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background Decorative Element */}
        <div
          style={{
            position: 'absolute',
            right: '-30px',
            top: '-30px',
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(64, 81, 137, 0.06) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Bagian Kiri: Lingkaran Analyst Pulse Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: '280px' }}>
            <div
              style={{
                position: 'relative',
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #405189 0%, #0ab39c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 8px 24px rgba(64, 81, 137, 0.3)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '50%',
                  border: '2px solid rgba(64, 81, 137, 0.4)',
                  animation: 'pulse 2s infinite',
                }}
              />
              <Brain size={38} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
                <span className="badge badge-level1" style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: 'rgba(64, 81, 137, 0.12)', color: '#405189', fontWeight: 700 }}>
                  100% DATA MASTER DRIVEN
                </span>
                <span className="badge badge-match" style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}>
                  MULTI-ENGINE AI
                </span>
              </div>
              <h2 style={{ fontSize: '1.28rem', fontWeight: 800, color: '#212529', margin: '0 0 0.25rem' }}>
                Data Analyst Engine
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#6c757d', margin: 0, lineHeight: 1.45, maxWidth: '320px' }}>
                Pengolahan & validasi lintas 5 Data Master secara otomatis dengan 3 Fase Analisis berurutan tanpa perlu unggah berkas.
              </p>
            </div>
          </div>

          {/* Bagian Kanan: 3-Phase Stepper Visualizer */}
          <div style={{ flex: 1, minWidth: '320px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#495057', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.65rem' }}>
              Alur Pipeline Analisis 3 Fase:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
              {FASE_META.map((f) => (
                <KartuFase
                  key={f.phase}
                  definisi={f}
                  berjalan={isAnalyzing}
                  aktif={currentActivePhase === f.phase}
                  persenJalan={phaseProgress[f.phase]}
                  dieksekusi={completedPhases.has(f.phase)}
                  persenReview={phaseApproval.pct[f.phase]}
                  disetujui={phaseApproval.selesai[f.phase]}
                  faseSebelumnyaSetuju={f.phase === 1 || phaseApproval.selesai[(f.phase - 1) as 1 | 2]}
                  pesanLangkah={stepText('Memproses...')}
                  adaHasil={hasExistingResults}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* ACTION CONTROLS & READINESS BADGES                                        */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e9ebec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Data Master Readiness Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6c757d', whiteSpace: 'nowrap' }}>Kesiapan Data:</span>
            <span className="badge badge-match" style={{ fontSize: '0.72rem' }}>
              ✓ PTEN ({masterCounts.pten.toLocaleString('id-ID')})
            </span>
            <span className="badge badge-match" style={{ fontSize: '0.72rem' }}>
              ✓ KodePos ({masterCounts.kodepos.toLocaleString('id-ID')})
            </span>
            <span className="badge badge-match" style={{ fontSize: '0.72rem' }}>
              ✓ Wilayah ({masterCounts.wilayah} Kanwil)
            </span>
            <span className="badge badge-match" style={{ fontSize: '0.72rem' }}>
              ✓ Cabang ({masterCounts.cabang.toLocaleString('id-ID')})
            </span>
            <span className="badge badge-match" style={{ fontSize: '0.72rem' }}>
              ✓ Mapping Role ({masterCounts.role.toLocaleString('id-ID')})
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {hasExistingResults && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={onResetAnalysis}
                disabled={isAnalyzing}
                style={{ color: '#f06548', borderColor: 'rgba(240, 101, 72, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                title="Reset seluruh hasil analisa"
              >
                <RotateCcw size={13} />
                <span>Reset Analisa</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={onStartAnalysis}
              disabled={isAnalyzing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1.4rem',
                fontWeight: 700,
                fontSize: '0.84rem',
                background: 'linear-gradient(135deg, #405189 0%, #3577f1 100%)',
                boxShadow: '0 4px 12px rgba(64, 81, 137, 0.25)',
              }}
            >
              {isAnalyzing ? (
                <>
                  <div className="spinner-border spinner-border-sm" role="status" style={{ width: '14px', height: '14px' }} />
                  <span>Sedang Menganalisa ({progressPercent}%)...</span>
                </>
              ) : (
                <>
                  <Play size={15} />
                  <span>{hasExistingResults ? 'Jalankan Ulang Analisa Master' : 'Jalankan Analisa Data Master'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. CARD: 5 METODE TEORI ANALISA PATEN ANTI-TYPO (ACCORDION / DRAWER)     */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          background: '#ffffff',
          border: '1px solid #e9ebec',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div
          onClick={() => setShowTheories(!showTheories)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'rgba(10, 179, 156, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0ab39c',
              }}
            >
              <Award size={15} />
            </div>
            <div>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#212529', whiteSpace: 'nowrap' }}>
                12 Sinyal Pencocokan + 2 Penjaga Identitas
              </span>
              <span style={{ fontSize: '0.72rem', color: '#878a99', marginLeft: '0.5rem' }}>
                (ensemble multi-algoritma · terukur 96,3% akurasi pada 27 pasangan berlabel; Levenshtein saja 63%)
              </span>
            </div>
          </div>

          <div style={{ color: '#878a99', display: 'flex', alignItems: 'center' }}>
            {showTheories ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {showTheories && (
          <div
            className="teori-grid"
            style={{
              marginTop: '0.85rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #f1f3f5',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
              gap: '0.65rem',
            }}
          >
            {SINYAL_PENCOCOKAN.map((s) => (
              <div
                key={s.judul}
                style={{ background: '#f8fafc', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #edf2f7' }}
              >
                <div
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: s.warna,
                    marginBottom: '0.2rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={s.judul}
                >
                  {s.no}. {s.emoji} {s.judul}
                </div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: '#64748b',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  title={s.deskripsi}
                >
                  {s.deskripsi}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** Isi kartu "sinyal pencocokan" — harus tetap sama dengan analystPipeline.ts. */
const SINYAL_PENCOCOKAN: { no: number; emoji: string; judul: string; warna: string; deskripsi: string }[] = [
  { no: 1, emoji: '🔤', judul: 'Canonical Thesaurus', warna: '#405189', deskripsi: 'Standarisasi singkatan otomatis: KAB → KABUPATEN, KCP → KANTOR CABANG PEMBANTU, KCB → KANTOR CABANG, BO → BRANCH OFFICE, JABAR → JAWA BARAT.' },
  { no: 2, emoji: '🧹', judul: 'Pembuang Token Administratif', warna: '#405189', deskripsi: 'KOTA / KABUPATEN / KEC / KEL / DESA dibuang dari kunci, jadi "TEGALSARI" == "KEC. TEGALSARI".' },
  { no: 3, emoji: '🔄', judul: 'Token Set & Jaccard', warna: '#0ab39c', deskripsi: 'Anti-kata terbalik: "KOTA MEDAN BALAI KOTA" dihitung sama dengan "BALAI KOTA MEDAN".' },
  { no: 4, emoji: '🎯', judul: 'Jaro-Winkler', warna: '#f7b84b', deskripsi: 'Kemiripan huruf dengan bobot awalan: PEKALONAGN → PEKALONGAN, MAKASAR → MAKASSAR.' },
  { no: 5, emoji: '✏️', judul: 'Damerau-Levenshtein (OSA)', warna: '#f7b84b', deskripsi: 'Sisipan, hapus, ganti, dan tukar huruf berdampingan dihitung sebagai satu kesalahan.' },
  { no: 6, emoji: '📊', judul: 'Tri-gram Cosine', warna: '#6366f1', deskripsi: 'Vektor potongan tiga huruf: tahan pada nama outlet panjang dan beda spasi/tanda strip.' },
  { no: 7, emoji: '🧬', judul: 'Longest Common Subsequence', warna: '#6366f1', deskripsi: 'Ketahanan terhadap sisipan kata alamat di tengah nama.' },
  { no: 8, emoji: '🎨', judul: 'Ratcliff-Obershelp (Gestalt)', warna: '#6366f1', deskripsi: 'Kemiripan sebagaimana dinilai manusia, bukan sekadar hitung beda huruf.' },
  { no: 9, emoji: '🔊', judul: 'Fonetik Indonesia', warna: '#299cdb', deskripsi: 'Ejaan lama/baru disatukan: DJ→J, TJ→C, SJ→S, CH/KH→K, OE→U, huruf kembar dilipat.' },
  { no: 10, emoji: '🧱', judul: 'Token Containment', warna: '#299cdb', deskripsi: 'Nama pendek ⊆ nama panjang untuk hierarki wilayah, dengan lantai 4 huruf agar tidak asal klaim.' },
  { no: 11, emoji: '🗺️', judul: 'Geo-Hierarchy & Pemekaran', warna: '#299cdb', deskripsi: 'Batas Provinsi/Dati II dikunci; induk-anak pemekaran (BANGGAI → BANGGAI KEPULAUAN) dikenali.' },
  { no: 12, emoji: '🔠', judul: 'Initialism Match', warna: '#0ab39c', deskripsi: '"JP" ↔ "JAKARTA PUSAT", "KCP" ↔ "KANTOR CABANG PEMBANTU".' },
  { no: 13, emoji: '🛡️', judul: 'Penjaga Identitas (2 aturan)', warna: '#f06548', deskripsi: 'Angka beda → nilai dipotong 0,60 (KCP 001 ≠ KCP 002). Penanda wilayah beda → 0,70 (TANGERANG ≠ TANGERANG SELATAN).' },
];

const FASE_META: {
  phase: 1 | 2 | 3;
  judul: string;
  deskripsi: string;
  detail: string;
  aksen: string;
  gradien: string;
  Ikon: typeof MapPin;
}[] = [
  {
    phase: 1,
    judul: 'PTEN & Master Kode Pos',
    deskripsi: 'Kota PTEN → Kode Pos, Kelurahan, Kecamatan',
    detail: 'Cocokkan Kota PTEN ke Kode Pos, ekstrak Kelurahan & Kecamatan, serta grouping per Kota PTEN.',
    aksen: '#299cdb',
    gradien: 'linear-gradient(90deg, #299cdb, #5bbfee)',
    Ikon: MapPin,
  },
  {
    phase: 2,
    judul: 'Wilayah & Master Cabang',
    deskripsi: 'Validasi Kanwil W01-W17 + identitas cabang',
    detail: 'Validasi Kanwil (W01-W17) & tarik identitas resmi: Sandi, Nama Outlet, Branch Code, Kode Cabang.',
    aksen: '#405189',
    gradien: 'linear-gradient(90deg, #405189, #3577f1)',
    Ikon: Building2,
  },
  {
    phase: 3,
    judul: 'Mapping Role 3 Role',
    deskripsi: 'Organisasi Tujuan, Tipe Unit, alur Wondr',
    detail: 'Tentukan Organisasi Tujuan, Tipe Unit (KC/KCP), verifikasi 3 role lengkap, dan alur Wondr.',
    aksen: '#7048e8',
    gradien: 'linear-gradient(90deg, #7048e8, #9a7bff)',
    Ikon: Users,
  },
];

interface KartuFaseProps {
  definisi: (typeof FASE_META)[number];
  berjalan: boolean;
  aktif: boolean;
  persenJalan: number;
  dieksekusi: boolean;
  persenReview: number;
  disetujui: boolean;
  faseSebelumnyaSetuju: boolean;
  pesanLangkah: string;
  adaHasil: boolean;
}

/**
 * Satu kartu fase. "Disetujui" hanya muncul kalau seluruh baris fase itu benar-benar
 * disetujui — hasil eksekusi mesin tidak lagi dihitung sebagai selesai.
 */
const KartuFase: React.FC<KartuFaseProps> = ({
  definisi,
  berjalan,
  aktif,
  persenJalan,
  dieksekusi,
  persenReview,
  disetujui,
  faseSebelumnyaSetuju,
  pesanLangkah,
  adaHasil,
}) => {
  const { phase, judul, deskripsi, detail, aksen, gradien, Ikon } = definisi;
  const terkunci = !berjalan && !disetujui && !faseSebelumnyaSetuju;
  const pct = berjalan ? persenJalan : persenReview;
  const status = berjalan
    ? dieksekusi
      ? 'Dieksekusi mesin'
      : aktif
        ? pesanLangkah
        : 'Menunggu...'
    : disetujui
      ? 'Berhasil diselesaikan'
      : terkunci
        ? `Menunggu Fase ${phase - 1}`
        : 'Menunggu review';
  const warnaTeks = disetujui && !berjalan ? '#0ab39c' : terkunci ? '#878a99' : aksen;
  const showBar = berjalan || adaHasil;

  return (
    <div
      style={{
        background: '#ffffff',
        border: `1px solid ${aktif ? aksen : disetujui && !berjalan ? '#d1fae5' : '#e2e8f0'}`,
        borderRadius: '8px',
        padding: '0.75rem 0.9rem',
        boxShadow: aktif ? `0 0 0 3px ${aksen}26` : '0 1px 3px rgba(0,0,0,0.03)',
        borderLeft: `4px solid ${disetujui && !berjalan ? '#0ab39c' : terkunci ? '#ced4da' : aksen}`,
        transition: 'border-color 0.3s, box-shadow 0.3s, opacity 0.3s',
        opacity: terkunci ? 0.72 : 1,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: warnaTeks, whiteSpace: 'nowrap' }}>FASE {phase}</span>
        {disetujui && !berjalan ? (
          <span className="fase-chip-selesai" style={{ fontSize: '0.78rem', color: '#0ab39c', fontWeight: 700, whiteSpace: 'nowrap' }}>
            ✓ Selesai
          </span>
        ) : (
          <Ikon size={15} color={warnaTeks} />
        )}
      </div>
      <div
        style={{
          fontSize: '0.82rem',
          fontWeight: 700,
          color: '#212529',
          marginBottom: '0.2rem',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={judul}
      >
        {judul}
      </div>
      <div
        style={{
          fontSize: '0.72rem',
          color: '#878a99',
          lineHeight: 1.35,
          marginBottom: showBar ? '0.6rem' : 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={detail}
      >
        {deskripsi}
      </div>
      {showBar && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '0.5rem',
              fontSize: '0.68rem',
              fontWeight: 600,
              color: warnaTeks,
              marginBottom: '0.25rem',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '68%' }} title={status}>
              {status}
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>{pct}%</span>
          </div>
          <div style={{ height: '5px', background: '#e9ebec', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: disetujui && !berjalan ? 'linear-gradient(90deg, #0ab39c, #43c6ac)' : gradien,
                transition: 'width 0.3s ease, background 0.3s ease',
                borderRadius: '4px',
                animation: aktif && pct < 100 ? 'progress-shimmer 1.5s infinite' : 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
