import React, { useState } from 'react';
import {
  Brain,
  MapPin,
  Building2,
  Users,
  Play,
  Check,
  ClipboardCheck,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';
import { SINYAL_PENCOCOKAN } from '../../utils/analystPipeline';
import {
  SUMBER_ANALISA,
  alasanFaseTerkunci,
  faseWajib,
  statusFase,
  type Kesiapan,
} from '../../utils/analystSources';
import { ConfirmDialog } from './ConfirmDialog';

interface AnalystCanvasProps {
  isAnalyzing: boolean;
  progressPercent: number;
  progressMessage: string;
  onStartAnalysis: () => void;
  onResetAnalysis: () => void;
  /** ✋ Hentikan run yang sedang berjalan; hasil run itu tidak disimpan (A4). */
  onBatalkanAnalysis?: () => void;
  /** true bila tombol Batal sudah ditekan tapi loop belum sampai ke `tick()` berikutnya. */
  isCancelling?: boolean;
  hasExistingResults: boolean;
  /**
   * Kesiapan tiap sumber, dihitung dari angka yang benar-benar akan dipakai run
   * berikutnya. Menggantikan `masterCounts` lama: badge jumlah dan checklist tidak
   * boleh punya dua angka berbeda untuk hal yang sama.
   */
  kesiapan: Kesiapan;
  /**false = Mapping Role dilepas, Fase 3 dilewati. */
  roleDipakai: boolean;
  onToggleRole: () => void;
  /** Baris hasil lama yang Fase 3-nya memang tidak dihitung mesin. */
  jumlahBarisDilewati?: number;
  phaseProgress?: { 1: number; 2: number; 3: number };
  currentActivePhase?: 0 | 1 | 2 | 3;
  completedPhases?: Set<number>;
  /** Persentase baris yang sudah di-approve per fase + status selesai ketat (tanpa pembulatan). */
  phaseApproval?: {
    pct: { 1: number; 2: number; 3: number };
    /** A7: jumlah baris fase itu yang BELUM di-approve (baris `TIDAK_ANALISA` tidak dihitung). */
    sisa?: { 1: number; 2: number; 3: number };
    selesai: { 1: boolean; 2: boolean; 3: boolean };
    /** Baris yang ikut dihitung persetujuan (di luar TIDAK_ANALISA). */
    total?: number;
    /** Fase 3 tidak dihitung mesin untuk baris ini (Mapping Role dilepas) = selesai, bukan tertunda. */
    dilewati?: { 1: boolean; 2: boolean; 3: boolean };
  };
  /** Fase pertama yang belum disetujui penuh — yang dijalankan tombol utama. */
  faseBerikutnya?: 1 | 2 | 3;
  /** Jumlah baris hasil analisa yang tertangkap tiap sinyal (nomor kartu 1..13). */
  temuanSinyal?: Record<number, number>;
  /** Buka modal detail temuan satu sinyal. */
  onLihatTemuan?: (no: number) => void;
  /** Ada hasil analisa lama yang belum menyimpan bitmask sinyal (sebelum fitur ini dibuat). */
  bitmaskBelumAda?: boolean;
  /** Setujui satu fase (tombol "Setujui Fase N" pindah ke baris ini, lihat catatan di bawah). */
  onApproveFase?: (fase: 1 | 2 | 3) => void;
  /** Pindahkan seluruh baris ber-cabang ke Data Final. */
  onApproveAllFinal?: () => void;
  /** Fase yang kolomnya belum pernah ditulis mesin — belum layak disetujui. */
  faseTertulis?: { 1: boolean; 2: boolean; 3: boolean };
  /** Semua baris antrean sudah berstatus Final: tombol "Masuk ke Data Final" tidak aktif lagi. */
  semuaSudahFinal?: boolean;
}

export const AnalystCanvas: React.FC<AnalystCanvasProps> = ({
  isAnalyzing,
  progressPercent,
  progressMessage,
  onStartAnalysis,
  onResetAnalysis,
  onBatalkanAnalysis,
  isCancelling = false,
  hasExistingResults,
  kesiapan,
  roleDipakai,
  onToggleRole,
  jumlahBarisDilewati = 0,
  phaseProgress = { 1: 0, 2: 0, 3: 0 },
  currentActivePhase = 0,
  completedPhases = new Set(),
  phaseApproval = { pct: { 1: 0, 2: 0, 3: 0 }, sisa: { 1: 0, 2: 0, 3: 0 }, selesai: { 1: false, 2: false, 3: false } },
  faseBerikutnya = 1,
  temuanSinyal = {},
  onLihatTemuan,
  bitmaskBelumAda = false,
  onApproveFase,
  onApproveAllFinal,
  faseTertulis = { 1: true, 2: true, 3: true },
  semuaSudahFinal = false,
}) => {
  const [showTheories, setShowTheories] = useState<boolean>(true);
  // Reset Analisa menghapus seluruh hasil kerja (bukan cuma menyembunyikan),
  // jadi tidak boleh jalan dari satu klik tanpa konfirmasi.
  const [konfirmasiReset, setKonfirmasiReset] = useState<boolean>(false);
  const [konfirmasiLangkah, setKonfirmasiLangkah] = useState<null | 1 | 2 | 3 | 'final'>(null);

  // SATU tombol = satu langkah berikutnya. Dulu "Jalankan Fase N" (kartu ini) dan
  // "Setujui Fase N" (baris di bawah tabel) dua tombol terpisah, dan yang pertama mengunci
  // dengan tulisan "setujui dulu di bawah" — operator harus mencari tombolnya sendiri.
  const statusFaseAktif = (f: 1 | 2 | 3) => statusFase(f, kesiapan);
  const dilewati = (f: 1 | 2 | 3) => statusFaseAktif(f) === 'dilewati';
  const faseAktif: 1 | 2 | 3 = !phaseApproval.selesai[1] && !dilewati(1) ? 1 : !phaseApproval.selesai[2] && !dilewati(2) ? 2 : 3;
  const sudahDijalankan = (f: 1 | 2 | 3) => (f === 1 ? !!hasExistingResults : faseTertulis[f]);
  const semuaFaseSetuju = (phaseApproval.total ?? 0) > 0 && ([1, 2, 3] as const).every((f) => phaseApproval.selesai[f] || dilewati(f));
  const terkunciAktif = statusFaseAktif(faseAktif) === 'terkunci';
  const langkah: { jenis: 'proses' | 'jalankan' | 'setujui' | 'final' | 'selesai' | 'terkunci'; label: string; ket: string } = isAnalyzing
    ? { jenis: 'proses', label: `Sedang Memproses Fase ${faseBerikutnya} (${progressPercent}%)...`, ket: 'Tekan Batalkan untuk menghentikan run ini tanpa menyimpan.' }
    : semuaFaseSetuju
      ? semuaSudahFinal
        ? { jenis: 'selesai', label: 'Semua baris sudah di Data Final', ket: 'Tidak ada yang menunggu persetujuan.' }
        : { jenis: 'final', label: 'Masuk ke Data Final', ket: 'Baris yang sudah punya cabang dipindahkan ke menu Data Final.' }
      : terkunciAktif
        ? { jenis: 'terkunci', label: `Fase ${faseAktif} terkunci`, ket: alasanFaseTerkunci(faseAktif, kesiapan) }
        : !sudahDijalankan(faseAktif)
          ? {
              jenis: 'jalankan',
              label: hasExistingResults ? `Lanjut Fase ${faseAktif}` : `Jalankan Fase ${faseAktif}`,
              ket: `Mesin mengerjakan Fase ${faseAktif} saja, lalu berhenti untuk kamu review.`,
            }
          : { jenis: 'setujui', label: `Setujui Fase ${faseAktif}`, ket: `Seluruh baris hasil Fase ${faseAktif} dinyatakan benar dan fase berikutnya terbuka.` };

  const tekanLangkah = () => {
    if (langkah.jenis === 'jalankan') onStartAnalysis();
    else if (langkah.jenis === 'setujui') setKonfirmasiLangkah(faseAktif);
    else if (langkah.jenis === 'final') setKonfirmasiLangkah('final');
  };

  // Pesan langkah terbaru tampil di kartu fase yang sedang berjalan (prefix [Fase n] dibuang).
  const stepText = (fallback: string) => {
    const m = (progressMessage || '').replace(/^\[Fase \d\]\s*/, '');
    return m || fallback;
  };

  // Satu baris keterangan di bawah checklist. Status 'contoh' sengaja dibedakan dari
  // 'kosong': badge lama menyamar keduanya sebagai siap, padahal 139 baris contoh
  // bawaan bukan isi database.
  const ARTI_STATUS: Record<'contoh' | 'kosong', string> = {
    contoh: 'masih data contoh bawaan, bukan isi database',
    kosong: 'belum terisi',
  };
  const belumSiap = SUMBER_ANALISA.filter((d) => kesiapan[d.kunci].status !== 'siap');
  const keteranganKesiapan =
    roleDipakai && jumlahBarisDilewati > 0
      ? `${jumlahBarisDilewati.toLocaleString('id-ID')} baris hasil lama dikerjakan tanpa Mapping Role — jalankan ulang Fase 3 untuk mengisinya.`
      : belumSiap.length > 0
        ? belumSiap.map((d) => `${d.label} ${ARTI_STATUS[kesiapan[d.kunci].status as 'contoh' | 'kosong']}`).join('; ') + '.'
        : roleDipakai
          ? 'Kelima sumber ikut dianalisa.'
          : 'Mapping Role dilepas — Fase 3 dilewati, empat sumber lainnya tetap jalan.';

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
          borderRadius: '6px',
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
                boxShadow: '0 5px 14px rgba(64, 81, 137, 0.25)',
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
                Pengolahan & validasi lintas {roleDipakai ? '5' : '4'} Data Master secara otomatis dengan 3 Fase Analisis berurutan tanpa perlu unggah berkas.
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
                  wajib={faseWajib(f.phase)}
                  dicentang={f.phase === 3 ? kesiapan.role.dipakai : true}
                  bisaDilepas={f.phase === 3 && kesiapan.role.status !== 'kosong'}
                  onToggle={onToggleRole}
                  berjalan={isAnalyzing}
                  aktif={currentActivePhase === f.phase}
                  persenJalan={phaseProgress[f.phase]}
                  dieksekusi={completedPhases.has(f.phase)}
                  persenReview={phaseApproval.pct[f.phase]}
                  disetujui={phaseApproval.selesai[f.phase]}
                  dilewati={dilewati(f.phase)}
                  pesanKunci={
                    statusFaseAktif(f.phase) === 'terkunci'
                      ? alasanFaseTerkunci(f.phase, kesiapan)
                      : f.phase === 3 && kesiapan.role.status === 'kosong'
                        ? 'Fase 3 tidak bisa dipilih — Mapping Role belum terisi.'
                        : ''
                  }
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
          {/* Baris Kesiapan Data = STATUS isi kelima sumber, bukan saklar. Saklar satu-satunya
              ada di kartu Fase 3; dua tempat mencentang hal yang sama hanya membuka peluang
              layar dan mesin berbeda pendapat. */}
          <div className="kesiapan-list">
            <span className="kesiapan-judul">Kesiapan Data:</span>
            {SUMBER_ANALISA.map((d) => {
              const s = kesiapan[d.kunci];
              const TANDA: Record<'siap' | 'contoh' | 'kosong', string> = { siap: '✓', contoh: '!', kosong: '✗' };
              return (
                <span
                  key={d.kunci}
                  className={`kesiapan-item ${s.dipakai ? `is-${s.status}` : 'is-lepas'}`}
                  title={s.dipakai ? d.alasan : `${d.label} tidak diikutkan — ${d.alasan}`}
                >
                  <span className="kesiapan-tanda">{s.dipakai ? TANDA[s.status] : '–'}</span>
                  <span>{d.label}</span>
                  <span className="kesiapan-meta">{s.jumlah.toLocaleString('id-ID')}</span>
                </span>
              );
            })}
            <span className="kesiapan-arti">{keteranganKesiapan}</span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {hasExistingResults && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setKonfirmasiReset(true)}
                disabled={isAnalyzing}
                style={{ color: '#f06548', borderColor: 'rgba(240, 101, 72, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', fontWeight: 700, fontSize: '0.84rem' }}
                title="Reset seluruh hasil analisa"
              >
                <RotateCcw size={15} />
                <span>Reset Analisa</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-outline"
              onClick={onBatalkanAnalysis}
              disabled={!isAnalyzing || isCancelling}
              title={isCancelling ? 'Menghentikan pada langkah berjalan...' : 'Hentikan analisa — hasil run ini tidak akan disimpan'}
              style={{
                display: isAnalyzing ? 'inline-flex' : 'none',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1.1rem',
                fontSize: '0.84rem',
                color: '#f06548',
                borderColor: 'rgba(240, 101, 72, 0.45)',
                fontWeight: 700,
              }}
            >
              <X size={15} />
              <span>{isCancelling ? 'Membatalkan...' : 'Batalkan'}</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={tekanLangkah}
              disabled={isAnalyzing || langkah.jenis === 'proses' || langkah.jenis === 'selesai' || langkah.jenis === 'terkunci'}
              title={langkah.ket}
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
                  <span>{langkah.label}</span>
                </>
              ) : (
                <>
                  {langkah.jenis === 'setujui' ? <Check size={15} /> : langkah.jenis === 'final' ? <ClipboardCheck size={15} /> : <Play size={15} />}
                  <span>{langkah.label}</span>
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
          borderRadius: '6px',
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
                (klik kartu untuk melihat temuannya)
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
            {bitmaskBelumAda && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  fontSize: '0.72rem',
                  color: '#f06548',
                  background: '#fff5f3',
                  border: '1px solid #ffe3dc',
                  borderRadius: '6px',
                  padding: '0.4rem 0.6rem',
                }}
              >
                Hasil analisa tersimpan ini dibuat sebelum catatan per-sinyal ada, jadi semua kartu bernilai 0.
                Jalankan ulang analisa supaya jumlah temuan terisi.
              </div>
            )}
            {SINYAL_PENCOCOKAN.map((s) => {
              const temuan = temuanSinyal[s.no] || 0;
              return (
              <button
                key={s.no}
                type="button"
                onClick={() => onLihatTemuan?.(s.no)}
                className="sinyal-card"
                style={{ background: '#f9fbfd', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #edf2f7', textAlign: 'left', cursor: 'pointer' }}
                title={temuan > 0 ? `Lihat ${temuan} temuan sinyal ini` : 'Sinyal ini belum menangkap temuan pada analisa berjalan'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                  <span
                    style={{
                      flex: '1 1 auto',
                      minWidth: 0,
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: s.warna,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.no}. {s.emoji} {s.judul}
                  </span>
                  <span
                    className={`sinyal-count ${temuan > 0 ? 'sinyal-count-aktif' : ''}`}
                    style={{ flex: '0 0 auto' }}
                  >
                    {temuan}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: '#878a99',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {s.deskripsi}
                </div>
              </button>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={konfirmasiReset}
        icon={<RotateCcw size={20} />}
        accent="#f06548"
        title="Reset seluruh hasil analisa?"
        message="Semua baris hasil Fase 1-3 di layar ini akan dihapus dan harus dikerjakan ulang dari awal."
        detail="Data Final yang sudah disetujui di menu Data Final TIDAK terhapus — hanya antrean analisa yang kembali kosong."
        confirmLabel="Ya, Reset Analisa"
        cancelLabel="Batal"
        onClose={() => setKonfirmasiReset(false)}
        onConfirm={() => {
          setKonfirmasiReset(false);
          onResetAnalysis();
        }}
      />

      <ConfirmDialog
        isOpen={konfirmasiLangkah !== null}
        icon={<Check size={20} />}
        accent="#0ab39c"
        title={konfirmasiLangkah === 'final' ? 'Pindahkan ke Data Final?' : `Setujui hasil Fase ${konfirmasiLangkah ?? ''}?`}
        message={`${(phaseApproval.total ?? 0).toLocaleString('id-ID')} baris ikut disetujui.`}
        detail={
          konfirmasiLangkah === 'final'
            ? 'Hanya baris yang kolom cabangnya sudah terisi yang pindah. Baris tanpa cabang tetap tertinggal di antrean Data Final agar tidak menjadi hasil kosong.'
            : `Fase ${konfirmasiLangkah} dinyatakan benar dan fase berikutnya terbuka. Masih bisa direvisi dari menu Data Final.`
        }
        confirmLabel={konfirmasiLangkah === 'final' ? 'Ya, Masuk ke Data Final' : 'Ya, Setujui & Lanjut'}
        cancelLabel="Batal"
        onClose={() => setKonfirmasiLangkah(null)}
        onConfirm={() => {
          if (konfirmasiLangkah === 'final') onApproveAllFinal?.();
          else if (konfirmasiLangkah) onApproveFase?.(konfirmasiLangkah);
          setKonfirmasiLangkah(null);
        }}
      />
    </div>
  );
};

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
  /** false = fase ini boleh tidak dihitung karena sumbernya opsional (Mapping Role). */
  wajib?: boolean;
  /** Fase ini ikut dianalisa (centang pada kartu). */
  dicentang?: boolean;
  /** true = centang fase ini bisa ditekan operator (hanya Fase 3). */
  bisaDilepas?: boolean;
  onToggle?: () => void;
  berjalan: boolean;
  aktif: boolean;
  persenJalan: number;
  dieksekusi: boolean;
  persenReview: number;
  disetujui: boolean;
  /** Fase ini tidak dihitung mesin karena sumbernya dilepas dari checklist. */
  dilewati?: boolean;
  /** Alasan fase tidak boleh dijalankan karena data wajibnya belum siap. */
  pesanKunci?: string;
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
  wajib = true,
  dicentang = true,
  bisaDilepas = false,
  onToggle,
  berjalan,
  aktif,
  persenJalan,
  dieksekusi,
  persenReview,
  disetujui,
  dilewati = false,
  pesanKunci = '',
  faseSebelumnyaSetuju,
  pesanLangkah,
  adaHasil,
}) => {
  const { phase, judul, deskripsi, detail, aksen, gradien, Ikon } = definisi;
  // `pesanKunci` = datanya belum siap; `terkunci` di bawah = menunggu fase sebelumnya.
  const terkunciData = pesanKunci.trim().length > 0;
  const sudahBeres = disetujui || dilewati;
  const terkunci = !berjalan && !sudahBeres && !faseSebelumnyaSetuju;
  const pct = berjalan ? persenJalan : persenReview;
  const status = berjalan
    ? dieksekusi
      ? 'Dieksekusi mesin'
      : aktif
        ? pesanLangkah
        : 'Menunggu...'
    : dilewati
      ? 'Dilewati — Mapping Role dilepas'
      : disetujui
        ? 'Berhasil diselesaikan'
        : pesanKunci
          ? pesanKunci
          : terkunci
            ? `Menunggu Fase ${phase - 1}`
            : 'Menunggu review';
  const warnaTeks = sudahBeres && !berjalan ? (dilewati && !disetujui ? '#878a99' : '#0ab39c') : terkunci ? '#878a99' : aksen;
  const showBar = berjalan || adaHasil;

  return (
    <div
      style={{
        background: '#ffffff',
        border: `1px solid ${aktif ? aksen : sudahBeres && !berjalan ? '#d5f3ee' : '#e9ebec'}`,
        borderRadius: '6px',
        padding: '0.75rem 0.9rem',
        boxShadow: aktif ? `0 0 0 3px ${aksen}26` : '0 1px 3px rgba(0,0,0,0.03)',
        borderLeft: `4px solid ${sudahBeres && !berjalan ? (dilewati && !disetujui ? '#ced4da' : '#0ab39c') : terkunci ? '#ced4da' : aksen}`,
        transition: 'border-color 0.3s, box-shadow 0.3s, opacity 0.3s',
        opacity: terkunci || dilewati ? 0.72 : 1,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
          <label
            className={`fase-cek ${terkunciData ? 'is-kunci' : wajib ? 'is-wajib' : 'is-opsional'}`}
            title={
              terkunciData
                ? pesanKunci
                : !wajib
                  ? dicentang
                    ? 'Tekan untuk melewati fase ini — Mapping Role tidak diikutkan analisa'
                    : 'Tekan untuk mengikutkan Mapping Role dan menjalankan Fase 3'
                  : 'Wajib — fase ini selalu dianalisa selama data sumbernya siap'
            }
          >
            <input type="checkbox" checked={dicentang} disabled={!bisaDilepas} onChange={bisaDilepas ? onToggle : undefined} />
          </label>
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: warnaTeks, whiteSpace: 'nowrap' }}>FASE {phase}</span>
          <span className={`fase-tag ${wajib ? 'is-wajib' : 'is-opsional'}`} title={wajib ? 'Sumber datanya wajib — tidak bisa dilepas dari analisa' : 'Opsional — dilepas lewat checklist Kesiapan Data, fase ini ikut dilewati'}>
            {wajib ? 'WAJIB' : 'OPSIONAL'}
          </span>
        </div>
        {disetujui && !berjalan ? (
          <span className="fase-chip-selesai" style={{ fontSize: '0.78rem', color: '#0ab39c', fontWeight: 700, whiteSpace: 'nowrap' }}>
            ✓ Selesai
          </span>
        ) : dilewati && !berjalan ? (
          <span className="fase-chip-selesai" style={{ fontSize: '0.78rem', color: '#878a99', fontWeight: 700, whiteSpace: 'nowrap' }}>
            Dilewati
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
