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
              {/* Card Fase 1 */}
              {(() => {
                const phase = 1;
                const isActive = currentActivePhase === phase;
                const isDone = completedPhases.has(phase);
                const pct = phaseProgress[1];
                const showBar = isAnalyzing || isDone;
                return (
                  <div
                    style={{
                      background: '#ffffff',
                      border: `1px solid ${isActive ? '#299cdb' : isDone ? '#d1fae5' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      padding: '0.75rem 0.9rem',
                      boxShadow: isActive ? '0 0 0 3px rgba(41,156,219,0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                      borderLeft: `4px solid ${isDone ? '#0ab39c' : '#299cdb'}`,
                      transition: 'border-color 0.3s, box-shadow 0.3s',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: isDone ? '#0ab39c' : '#299cdb' }}>FASE 1</span>
                      {isDone ? (
                        <span style={{ fontSize: '0.78rem', color: '#0ab39c', fontWeight: 700 }}>✓ Selesai</span>
                      ) : (
                        <MapPin size={15} color="#299cdb" />
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#212529', marginBottom: '0.2rem' }}>
                      PTEN &amp; Master Kode Pos
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#878a99', lineHeight: 1.35, marginBottom: showBar ? '0.6rem' : 0 }}>
                      Cocokkan Kota PTEN ke Kode Pos, ekstrak Kelurahan &amp; Kecamatan, serta grouping per Kota PTEN.
                    </div>
                    {showBar && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 600, color: isDone ? '#0ab39c' : '#299cdb', marginBottom: '0.25rem' }}>
                          <span
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '68%' }}
                            title={isActive ? stepText('Memproses...') : undefined}
                          >
                            {isDone ? 'Berhasil diselesaikan' : isActive ? stepText('Memproses...') : 'Menunggu...'}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div style={{ height: '5px', background: '#e9ebec', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: isDone
                                ? 'linear-gradient(90deg, #0ab39c, #43c6ac)'
                                : 'linear-gradient(90deg, #299cdb, #5bbfee)',
                              transition: 'width 0.3s ease',
                              borderRadius: '4px',
                              animation: isActive && pct < 100 ? 'progress-shimmer 1.5s infinite' : 'none',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Card Fase 2 */}
              {(() => {
                const phase = 2;
                const isActive = currentActivePhase === phase;
                const isDone = completedPhases.has(phase);
                const pct = phaseProgress[2];
                const showBar = isAnalyzing || isDone;
                return (
                  <div
                    style={{
                      background: '#ffffff',
                      border: `1px solid ${isActive ? '#405189' : isDone ? '#d1fae5' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      padding: '0.75rem 0.9rem',
                      boxShadow: isActive ? '0 0 0 3px rgba(64,81,137,0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                      borderLeft: `4px solid ${isDone ? '#0ab39c' : '#405189'}`,
                      transition: 'border-color 0.3s, box-shadow 0.3s',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: isDone ? '#0ab39c' : '#405189' }}>FASE 2</span>
                      {isDone ? (
                        <span style={{ fontSize: '0.78rem', color: '#0ab39c', fontWeight: 700 }}>✓ Selesai</span>
                      ) : (
                        <Building2 size={15} color="#405189" />
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#212529', marginBottom: '0.2rem' }}>
                      Wilayah &amp; Master Cabang
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#878a99', lineHeight: 1.35, marginBottom: showBar ? '0.6rem' : 0 }}>
                      Validasi Kanwil (W01-W17) &amp; tarik identitas resmi: Sandi, Nama Outlet, Branch Code, Kode Cabang.
                    </div>
                    {showBar && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 600, color: isDone ? '#0ab39c' : '#405189', marginBottom: '0.25rem' }}>
                          <span
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '68%' }}
                            title={isActive ? stepText('Memproses...') : undefined}
                          >
                            {isDone ? 'Berhasil diselesaikan' : isActive ? stepText('Memproses...') : 'Menunggu...'}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div style={{ height: '5px', background: '#e9ebec', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: isDone
                                ? 'linear-gradient(90deg, #0ab39c, #43c6ac)'
                                : 'linear-gradient(90deg, #405189, #3577f1)',
                              transition: 'width 0.3s ease',
                              borderRadius: '4px',
                              animation: isActive && pct < 100 ? 'progress-shimmer 1.5s infinite' : 'none',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Card Fase 3 */}
              {(() => {
                const phase = 3;
                const isActive = currentActivePhase === phase;
                const isDone = completedPhases.has(phase);
                const pct = phaseProgress[3];
                const showBar = isAnalyzing || isDone;
                return (
                  <div
                    style={{
                      background: '#ffffff',
                      border: `1px solid ${isActive ? '#0ab39c' : isDone ? '#d1fae5' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      padding: '0.75rem 0.9rem',
                      boxShadow: isActive ? '0 0 0 3px rgba(10,179,156,0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                      borderLeft: `4px solid #0ab39c`,
                      transition: 'border-color 0.3s, box-shadow 0.3s',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0ab39c' }}>FASE 3</span>
                      {isDone ? (
                        <span style={{ fontSize: '0.78rem', color: '#0ab39c', fontWeight: 700 }}>✓ Selesai</span>
                      ) : (
                        <Users size={15} color="#0ab39c" />
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#212529', marginBottom: '0.2rem' }}>
                      Mapping Role 3 Role
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#878a99', lineHeight: 1.35, marginBottom: showBar ? '0.6rem' : 0 }}>
                      Tentukan Organisasi Tujuan, Tipe Unit (KC/KCP), verifikasi 3 role lengkap, dan alur Wondr.
                    </div>
                    {showBar && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 600, color: '#0ab39c', marginBottom: '0.25rem' }}>
                          <span
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '68%' }}
                            title={isActive ? stepText('Memproses...') : undefined}
                          >
                            {isDone ? 'Berhasil diselesaikan' : isActive ? stepText('Memproses...') : 'Menunggu...'}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div style={{ height: '5px', background: '#e9ebec', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: isDone
                                ? 'linear-gradient(90deg, #0ab39c, #43c6ac)'
                                : 'linear-gradient(90deg, #0ab39c, #43c6ac)',
                              transition: 'width 0.3s ease',
                              borderRadius: '4px',
                              animation: isActive && pct < 100 ? 'progress-shimmer 1.5s infinite' : 'none',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
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
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6c757d' }}>Kesiapan Data:</span>
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
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#212529' }}>
                5 Metode Teori Analisa Paten Anti-Typo & Anti-Salah Kata
              </span>
              <span style={{ fontSize: '0.72rem', color: '#878a99', marginLeft: '0.5rem' }}>
                (Standar Algoritma Pencocokan Presisi Tinggi Beyond Basic Fuzzy)
              </span>
            </div>
          </div>

          <div style={{ color: '#878a99', display: 'flex', alignItems: 'center' }}>
            {showTheories ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {showTheories && (
          <div
            style={{
              marginTop: '0.85rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #f1f3f5',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.65rem',
            }}
          >
            {/* 1. Canonical Thesaurus */}
            <div style={{ background: '#f8fafc', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #edf2f7' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#405189', marginBottom: '0.2rem' }}>
                1. 🔤 Canonical Thesaurus
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.35 }}>
                Standarisasi singkatan otomatis: KAB ➔ KABUPATEN, KCP ➔ KANTOR CABANG PEMBANTU, BO ➔ BRANCH OFFICE.
              </div>
            </div>

            {/* 2. Token Set Jaccard */}
            <div style={{ background: '#f8fafc', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #edf2f7' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0ab39c', marginBottom: '0.2rem' }}>
                2. 🔄 Token Set & Jaccard
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.35 }}>
                Anti-kata terbalik: "KOTA MEDAN BALAI KOTA" dihitung 100% sama dengan "BALAI KOTA MEDAN KOTA".
              </div>
            </div>

            {/* 3. Jaro-Winkler + Damerau */}
            <div style={{ background: '#f8fafc', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #edf2f7' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#f7b84b', marginBottom: '0.2rem' }}>
                3. 🎯 Jaro-Winkler & Damerau
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.35 }}>
                Menangani typo huruf tertukar/kurang: PEKALONAGN ➔ PEKALONGAN, MAKASAR ➔ MAKASSAR.
              </div>
            </div>

            {/* 4. Geo-Hierarchy Anchor */}
            <div style={{ background: '#f8fafc', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #edf2f7' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#299cdb', marginBottom: '0.2rem' }}>
                4. 🗺️ Geo-Hierarchy Anchor
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.35 }}>
                Penguncian batas Provinsi & Dati II: mencegah cabang di Jawa dicocokkan ke Sumatera meskipun nama mirip.
              </div>
            </div>

            {/* 5. N-Gram Vector Cosine */}
            <div style={{ background: '#f8fafc', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #edf2f7' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#6366f1', marginBottom: '0.2rem' }}>
                5. 📊 N-Gram Vector Cosine
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.35 }}>
                Pencocokan kontekstual nama outlet panjang dan toleran terhadap perbedaan spasi atau tanda strip (-).
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
