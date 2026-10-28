import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Radar,
  RefreshCw,
  Search,
  Download,
  X,
  Eye,
  Cloud,
  CloudOff,
  AlertCircle,
  Building2,
  Store,
  Clock,
  Timer,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { BarisMerchant, MuatanTracking } from '../../utils/trackingMerchant';
import {
  DEFINISI_KOLOM_TM,
  KOLOM_EKSPOR_TM,
  KOLOM_TM,
  KUNCI_STORAGE_TRACKING,
  KETERANGAN_STATUS,
  LABEL_KERANJANG,
  SUMUR_TRACKING,
  barisKeExcelTm,
  cocokCari,
  keranjangStatus,
  riwayatMerchant,
  ringkasTracking,
} from '../../utils/trackingMerchant';
import { useFilterSort } from '../../utils/useFilterSort';
import { useVirtualWindow } from '../../utils/useVirtualWindow';
import { ThFilter } from '../ThFilter';
import { DialogPanel } from '../BaseModal';
import { tulisLembarExcel } from '../../utils/excel';
import { tanggalBerkas } from '../../utils/normalizer';
import { getItem, setItem } from '../../utils/storage';
import { loadTrackingMerchantFromNeon, syncTrackingMerchantDariSumber } from '../../utils/neonSync';
import { useNotification } from '../Notification/NotificationContext';

interface TrackingMerchantManagerProps {
  /** Identik dengan badge sidebar: berapa merchant yang ikut ter-sync. */
  onTrackingCountChange?: (jumlahMerchant: number) => void;
}

const KELAS_KERANJANG: Record<string, string> = {
  aktif: 'badge badge-match',
  proses: 'badge badge-level2',
  tolak: 'badge badge-diff',
  lain: 'badge badge-unmatched',
};

/** MID punya sel sendiri (code-cell), jadi sel biasa mulai dari kolom kedua. */
const KOLOM_SEL = KOLOM_TM.slice(1);

const waktuTayang = (iso: string): string => {
  if (!iso) return 'belum pernah sync';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
};

export const TrackingMerchantManager: React.FC<TrackingMerchantManagerProps> = ({
  onTrackingCountChange,
}) => {
  const { add: notify } = useNotification();

  const [baris, setBaris] = useState<BarisMerchant[]>([]);
  const [diambilPada, setDiambilPada] = useState<string>('');
  const [sumber, setSumber] = useState<string>('');
  const [statusMuat, setStatusMuat] = useState<'memuat' | 'siap' | 'syncing'>('memuat');
  const [galat, setGalat] = useState<string | null>(null);
  /** true = hasil sync terakhir benar-benar mendarat di cloud, bukan hanya di browser ini. */
  const [awamCloud, setAwamCloud] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(25);
  const [detailMid, setDetailMid] = useState<string | null>(null);

  const uatMuatan = useCallback((muatan: MuatanTracking) => {
    setBaris(muatan.baris);
    setDiambilPada(muatan.diambilPada || '');
    setSumber(muatan.sumber || SUMUR_TRACKING);
  }, []);

  // Muat: browser dulu supaya tabel langsung terisi, lalu cloud menang kalau lebih baru.
  useEffect(() => {
    let hidup = true;
    (async () => {
      const lokal = await getItem<MuatanTracking>(KUNCI_STORAGE_TRACKING).catch(() => null);
      if (hidup && lokal && Array.isArray(lokal.baris) && lokal.baris.length > 0) uatMuatan(lokal);
      const cloud = await loadTrackingMerchantFromNeon();
      if (!hidup) return;
      if (cloud && Array.isArray(cloud.baris) && cloud.baris.length > 0) {
        const lebihBaru = !lokal || String(cloud.diambilPada) > String(lokal.diambilPada);
        if (lebihBaru) {
          uatMuatan(cloud);
          setItem(KUNCI_STORAGE_TRACKING, cloud).catch(() => undefined);
          setAwamCloud(true);
        }
      }
      setStatusMuat('siap');
    })();
    return () => {
      hidup = false;
    };
  }, [uatMuatan]);

  const handleSync = useCallback(async () => {
    setStatusMuat('syncing');
    setGalat(null);
    const hasil = await syncTrackingMerchantDariSumber();
    if (!hasil.muatan) {
      setStatusMuat('siap');
      const pesan = hasil.pesan || `Tidak bisa menghubungi ${SUMUR_TRACKING}.`;
      setGalat(pesan);
      notify(`Sync gagal: ${pesan}`, 'error');
      return;
    }
    uatMuatan(hasil.muatan);
    setAwamCloud(hasil.tersimpanDiCloud);
    setStatusMuat('siap');
    try {
      await setItem(KUNCI_STORAGE_TRACKING, hasil.muatan);
    } catch {
      notify('Hasil sync gagal disimpan di browser ini.', 'warning');
    }
    const k = ringkasTracking(hasil.muatan.baris);
    notify(
      `Sync selesai: ${k.merchant.toLocaleString('id-ID')} merchant / ${k.riwayat.toLocaleString('id-ID')} riwayat diambil dari ${SUMUR_TRACKING}.`,
      hasil.tersimpanDiCloud ? 'success' : 'warning'
    );
    if (!hasil.tersimpanDiCloud) {
      notify('Cloud gagal menerima hasil sync — data ini hanya tersimpan di browser ini.', 'warning');
    }
  }, [notify, uatMuatan]);

  const barisCari = useMemo(
    () => (deferredSearch.trim() ? baris.filter((r) => cocokCari(r, deferredSearch)) : baris),
    [baris, deferredSearch]
  );

  // Satu sumber angka merchant — diturunkan dari baris, dipakai baris meta DAN badge
  // sidebar, jadi keduanya tidak mungkin menunjukkan angka berbeda.
  const ringkasSemua = useMemo(() => ringkasTracking(baris), [baris]);

  useEffect(() => {
    onTrackingCountChange?.(ringkasSemua.merchant);
  }, [ringkasSemua.merchant, onTrackingCountChange]);

  const {
    baris: barisTampil,
    tersaring: barisTersaring,
    urut,
    saring,
    gantiUrut,
    setNilaiKolom,
    bersihkanSemua,
    jumlahAktif,
  } = useFilterSort('tracking-merchant', DEFINISI_KOLOM_TM, barisCari);

  // KPI dibaca dari populasi yang SAME dengan tabel (hasil cari + saringan kolom),
  // jadi kartu tidak pernah menampilkan angka yang tidak ada di daftar.
  const kpi = useMemo(() => ringkasTracking(barisTersaring), [barisTersaring]);

  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(barisTampil.length / pageSize));
  // Halaman aktif diturunkan, bukan disimpan ulang lewat effect: saringan kolom bisa
  // menyusutkan daftar di tengah halaman, dan operator harus tetap melihat sisa baris,
  // bukan layar kosong.
  const halamanAktif = Math.min(page, totalPages);
  const halamanIni = useMemo(() => {
    if (pageSize === 'ALL') return barisTampil;
    const mulai = (halamanAktif - 1) * pageSize;
    return barisTampil.slice(mulai, mulai + pageSize);
  }, [barisTampil, halamanAktif, pageSize]);

  const tabelRef = useRef<HTMLDivElement | null>(null);
  const win = useVirtualWindow({ containerRef: tabelRef, itemCount: halamanIni.length });
  const barisRender = win.active ? halamanIni.slice(win.start, win.end) : halamanIni;
  const offsetBaris = win.active ? win.start : 0;

  useEffect(() => {
    tabelRef.current?.scrollTo({ top: 0 });
  }, [page, pageSize, deferredSearch]);

  const handleExport = () => {
    if (barisTersaring.length === 0) {
      notify('Tidak ada baris yang cocok dengan pencarian/saringan — tidak ada yang bisa diunduh.', 'warning');
      return;
    }
    tulisLembarExcel({
      namaLembar: 'Tracking_Merchant',
      namaBerkas: `Tracking_Merchant_${tanggalBerkas()}.xlsx`,
      kolom: [...KOLOM_EKSPOR_TM],
      baris: barisKeExcelTm(barisTersaring),
    });
    notify(`${barisTersaring.length.toLocaleString('id-ID')} riwayat merchant diunduh.`, 'success');
  };

  const detail = useMemo(() => (detailMid ? riwayatMerchant(baris, detailMid) : []), [baris, detailMid]);

  const sinkronSedang = statusMuat === 'syncing';

  return (
    <div>
      {/* 1. Kepala menu + aksi sync */}
      <div className="glass-card" style={{ marginBottom: '1rem' }}>
        <div className="tm-kepala">
          <div>
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radar size={18} />
              <span>Tracking Merchant</span>
            </div>
            <div className="section-subtitle">
              Salinan menu Tracking History Merchant di {SUMUR_TRACKING}. Data hanya bisa ditarik
              dari sana — aplikasi ini tidak menulis apa pun ke sumber itu.
            </div>
          </div>
          <div className="tm-kepala-aksi">
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleExport}
              disabled={baris.length === 0}
              title="Unduh daftar yang sedang tampil ke Excel"
            >
              <Download size={16} />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSync()}
              disabled={sinkronSedang || statusMuat === 'memuat'}
              title={`Ambil data terbaru dari ${SUMUR_TRACKING} lewat serverless proxy (anonim, tanpa login)`}
            >
              <RefreshCw size={16} className={sinkronSedang ? 'tm-putar' : undefined} />
              <span>{sinkronSedang ? 'Mengambil data…' : 'Sync Data'}</span>
            </button>
          </div>
        </div>

        <div className="tm-meta">
          <div className="tm-meta-item">
            <span className="tm-meta-label">Sync terakhir</span>
            <span className="tm-meta-nilai">{waktuTayang(diambilPada)}</span>
          </div>
          <div className="tm-meta-item">
            <span className="tm-meta-label">Merchant tercatat</span>
            <span className="tm-meta-nilai">{ringkasSemua.merchant.toLocaleString('id-ID')}</span>
          </div>
          <div className="tm-meta-item">
            <span className="tm-meta-label">Riwayat tersimpan</span>
            <span className="tm-meta-nilai">{baris.length.toLocaleString('id-ID')}</span>
          </div>
          <div className="tm-meta-item">
            <span className="tm-meta-label">Sumber</span>
            <span className="tm-meta-nilai">{sumber || SUMUR_TRACKING}</span>
          </div>
          <div className="tm-meta-item">
            <span className="tm-meta-label">Cloud</span>
            <span className="tm-meta-nilai" title={awamCloud ? 'Hasil sync terakhir tersimpan di Supabase, jadi semua pengguna melihat data yang sama.' : 'Belum ada hasil sync yang tersimpan di cloud.'}>
              {awamCloud ? <Cloud size={13} /> : <CloudOff size={13} />}
              <span>{awamCloud ? 'tersimpan bersama' : 'hanya di browser ini'}</span>
            </span>
          </div>
        </div>

        <div className="tm-sensitif">
          <ShieldNote />
        </div>
      </div>

      {galat && (
        <div
          className="glass-card"
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            fontSize: '0.84rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{galat}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGalat(null)}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* 2. Tabel */}
      {statusMuat === 'memuat' ? (
        <div className="glass-card tm-kosong">
          <RefreshCw size={20} className="tm-putar" />
          <span>Memuat hasil sync tersimpan…</span>
        </div>
      ) : baris.length === 0 ? (
        <div className="glass-card tm-kosong">
          <Radar size={26} />
          <div className="tm-kosong-judul">Belum ada data Tracking Merchant di sini.</div>
          <div className="tm-kosong-isi">
            Klik <strong>Sync Data</strong> untuk menariknya dari {SUMUR_TRACKING}. Unduhan dilakukan
            fungsi serverless di sisi server — browser tidak bisa membuka halaman itu langsung
            (sumbernya HTTP dan tanpa CORS).
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void handleSync()} disabled={sinkronSedang}>
            <RefreshCw size={16} className={sinkronSedang ? 'tm-putar' : undefined} />
            <span>{sinkronSedang ? 'Mengambil data…' : 'Sync Data sekarang'}</span>
          </button>
        </div>
      ) : (
        <div className="glass-card">
          <div className="metrics-grid" style={{ marginBottom: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="metric-card blue">
              <div className="metric-header">
                <span className="metric-title">MERCHANT</span>
                <div className="metric-icon-bubble"><Store size={14} /></div>
              </div>
              <div className="metric-value">{kpi.merchant.toLocaleString('id-ID')}</div>
              <div className="metric-footer">dari {baris.length.toLocaleString('id-ID')} merchant tersinkron</div>
            </div>
            <div className="metric-card cyan">
              <div className="metric-header">
                <span className="metric-title">RIWAYAT</span>
                <div className="metric-icon-bubble"><Clock size={14} /></div>
              </div>
              <div className="metric-value">{kpi.riwayat.toLocaleString('id-ID')}</div>
              <div className="metric-footer">satu baris = satu pengajuan</div>
            </div>
            <div className="metric-card emerald">
              <div className="metric-header">
                <span className="metric-title">ACTIVE</span>
                <div className="metric-icon-bubble"><CheckCircle2 size={14} /></div>
              </div>
              <div className="metric-value">{kpi.aktif.toLocaleString('id-ID')}</div>
              <div className="metric-footer">{LABEL_KERANJANG.aktif}</div>
            </div>
            <div className="metric-card amber">
              <div className="metric-header">
                <span className="metric-title">ON PROGRESS</span>
                <div className="metric-icon-bubble"><Timer size={14} /></div>
              </div>
              <div className="metric-value">{kpi.proses.toLocaleString('id-ID')}</div>
              <div className="metric-footer">{LABEL_KERANJANG.proses}</div>
            </div>
            <div className="metric-card rose">
              <div className="metric-header">
                <span className="metric-title">REJECT</span>
                <div className="metric-icon-bubble"><AlertCircle size={14} /></div>
              </div>
              <div className="metric-value">{kpi.tolak.toLocaleString('id-ID')}</div>
              <div className="metric-footer">{LABEL_KERANJANG.tolak}</div>
            </div>
            <div className="metric-card purple">
              <div className="metric-header">
                <span className="metric-title">CABANG</span>
                <div className="metric-icon-bubble"><Building2 size={14} /></div>
              </div>
              <div className="metric-value">{kpi.cabang.toLocaleString('id-ID')}</div>
              <div className="metric-footer">{kpi.provinsi.toLocaleString('id-ID')} provinsi</div>
            </div>
          </div>

          <div className="filter-toolbar" style={{ marginBottom: '1rem' }}>
            <div className="filter-group" style={{ flex: 1, minWidth: '260px', maxWidth: '560px' }}>
              <div className="search-input-wrapper" style={{ flex: 1, minWidth: '200px' }}>
                <Search size={15} className="search-icon-pos" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Cari MID, nama merchant, cabang, kota, kode pos…"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: '100%' }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="tm-bersih-cari"
                    onClick={() => { setSearchTerm(''); setPage(1); }}
                    title="Kosongkan pencarian"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="filter-group">
              <span className="tm-jumlah-label">
                Menampilkan <strong>{barisTampil.length.toLocaleString('id-ID')}</strong> dari{' '}
                {baris.length.toLocaleString('id-ID')} baris
              </span>
              <select
                className="filter-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10 Baris</option>
                <option value={25}>25 Baris</option>
                <option value={50}>50 Baris</option>
                <option value={100}>100 Baris</option>
                <option value="ALL">Lihat Semua ({barisTampil.length})</option>
              </select>
              {jumlahAktif > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { bersihkanSemua(); setPage(1); }} title="Hapus semua saringan kolom">
                  <X size={12} /> Bersihkan saringan ({jumlahAktif})
                </button>
              )}
            </div>
          </div>

          <div ref={tabelRef} className="table-container" style={{ maxHeight: '580px', overflow: 'auto' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: '44px', textAlign: 'center' }}>No</th>
                  {KOLOM_TM.map((k) => (
                    <ThFilter
                      key={k.label}
                      label={k.label}
                      definisi={DEFINISI_KOLOM_TM.find((d) => d.kunci === k.label)!}
                      sumber={barisCari}
                      semuaDefinisi={DEFINISI_KOLOM_TM}
                      saringSemua={saring}
                      urutKolom={urut.kolom}
                      urutNaik={urut.naik}
                      onUrut={() => gantiUrut(k.label)}
                      terpilih={saring[k.label] || []}
                      onTerapkan={(n) => {
                        setNilaiKolom(k.label, n);
                        setPage(1);
                      }}
                      tengah={k.tengah}
                      title={k.judul}
                      gayaSel={{ minWidth: k.lebar ? `${k.lebar}px` : undefined }}
                    />
                  ))}
                  <th style={{ width: '64px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {barisTampil.length === 0 ? (
                  <tr>
                    <td colSpan={KOLOM_TM.length + 2} className="tm-kosong-sel">
                      Tidak ada riwayat yang cocok dengan pencarian dan saringan kolom.
                    </td>
                  </tr>
                ) : (
                  <>
                    {win.active && win.padTop > 0 && <tr aria-hidden="true" style={{ height: `${win.padTop}px` }} />}
                    {barisRender.map((r, i) => {
                      const no = pageSize === 'ALL'
                        ? offsetBaris + i + 1
                        : (halamanAktif - 1) * (pageSize as number) + offsetBaris + i + 1;
                      return (
                        <tr key={`${r.mid}-${r.refNo}-${r.tglPengajuan}-${i}`} data-vrow={i === 0 ? 'true' : undefined}>
                          <td className="tm-nomor">{no}</td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.mid}</td>
                          {KOLOM_SEL.map((k) => {
                            const nilai = k.nilai(r);
                            if (k.label === 'Status' || k.label === 'Status Verifikasi') {
                              const keranjang = keranjangStatus(r.status);
                              return (
                                <td key={k.label} style={{ textAlign: 'center' }}>
                                  <span className={KELAS_KERANJANG[keranjang]}>{nilai || '-'}</span>
                                </td>
                              );
                            }
                            if (k.label === 'Flagging Riwayat') {
                              return (
                                <td key={k.label} style={{ textAlign: 'center' }} title={`Riwayat ke-${r.idxRiwayat} dari ${r.totalRiwayat} untuk MID ini`}>
                                  <span className={r.totalRiwayat > 1 ? 'badge badge-level1' : 'badge badge-unmatched'}>
                                    {r.totalRiwayat > 1 ? `${nilai} (${r.idxRiwayat}/${r.totalRiwayat})` : nilai}
                                  </span>
                                </td>
                              );
                            }
                            return (
                              <td key={k.label} title={nilai}>{nilai || '-'}</td>
                            );
                          })}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setDetailMid(r.mid)}
                              title={`Lihat seluruh riwayat MID ${r.mid}`}
                            >
                              <Eye size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {win.active && win.padBottom > 0 && <tr aria-hidden="true" style={{ height: `${win.padBottom}px` }} />}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="tm-halaman-bawah">
              <div>
                Halaman <strong>{halamanAktif}</strong> dari <strong>{totalPages}</strong>
              </div>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage(halamanAktif - 1)}
                  disabled={halamanAktif === 1}
                  title="Halaman sebelumnya"
                >
                  <ChevronLeft size={13} />
                </button>
                {(() => {
                  const awal = Math.max(1, Math.min(totalPages - 6, halamanAktif - 3));
                  return Array.from({ length: Math.min(totalPages, 7) }, (_, idx) => {
                    const n = awal + idx;
                    return (
                      <button
                        key={n}
                        type="button"
                        className={n === halamanAktif ? 'tm-halaman tm-halaman-aktif' : 'tm-halaman'}
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </button>
                    );
                  });
                })()}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage(halamanAktif + 1)}
                  disabled={halamanAktif === totalPages}
                  title="Halaman berikutnya"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Panel riwayat satu merchant (hanya-baca) */}
      {detailMid && (
        <DialogPanel onClose={() => setDetailMid(null)} label={`Riwayat merchant ${detailMid}`} closableOnOutside={false}>
          <div className="modal-header">
            <div className="modal-title">
              <Clock size={16} /> Riwayat MID {detailMid}
            </div>
            <button type="button" className="modal-close" onClick={() => setDetailMid(null)} aria-label="Tutup">
              <X size={16} />
            </button>
          </div>
          <div className="modal-body">
            {detail.map((r, idx) => (
              <div key={`${r.refNo}-${r.tglPengajuan}-${idx}`} className="tm-riwayat">
                <div className="tm-riwayat-kepala">
                  <span className={KELAS_KERANJANG[keranjangStatus(r.status)]}>{r.status || '-'}</span>
                  <span className="tm-riwayat-no">Riwayat {idx + 1} dari {detail.length}</span>
                </div>
                <div className="tm-riwayat-keterangan">{KETERANGAN_STATUS[keranjangStatus(r.status)]}</div>
                <div className="tm-riwayat-grid">
                  <Baris label="Status Verifikasi" nilai={LABEL_KERANJANG[keranjangStatus(r.status)]} />
                  <Baris label="Nama Merchant" nilai={r.namaMerchant} />
                  <Baris label="Ref No" nilai={r.refNo} />
                  <Baris label="Jenis Pengajuan" nilai={r.jenisPengajuan} />
                  <Baris label="Jenis QR" nilai={r.jenisQr} />
                  <Baris label="Tanggal Pengajuan" nilai={r.tglPengajuan} />
                  <Baris label="Last Update" nilai={r.lastUpdate} />
                  <Baris label="Sumber Onboarding" nilai={r.sumberOnboarding} />
                  <Baris label="Kriteria" nilai={r.kriteria} />
                  <Baris label="Jenis Usaha" nilai={r.jenisUsaha} />
                  <Baris label="Referral Code" nilai={r.referralCode} />
                  <Baris label="Segmen Merchant" nilai={r.merchantSegment} />
                  <Baris label="Cabang" nilai={r.branchCode} />
                  <Baris label="Alamat" nilai={r.alamat} />
                  <Baris label="Kelurahan" nilai={r.kelurahan} />
                  <Baris label="Kecamatan" nilai={r.kecamatan} />
                  <Baris label="Kota / Kabupaten" nilai={r.kabupatenKota} />
                  <Baris label="Provinsi" nilai={r.provinsi} />
                  <Baris label="Kode Pos" nilai={r.kodePos} />
                </div>
              </div>
            ))}
            <div className="tm-catatan-modal">
              Nomor KTP, nomor rekening, e-mail dan nomor HP merchant sengaja tidak diambil dari
              sumber — kolom itu ada di halaman aslinya tapi tidak diambil karena tidak dipakai di pemantauan ini.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setDetailMid(null)}>
              Tutup
            </button>
          </div>
        </DialogPanel>
      )}
    </div>
  );
};

const Baris: React.FC<{ label: string; nilai: string }> = ({ label, nilai }) => (
  <div className="tm-riwayat-item">
    <span className="tm-riwayat-label">{label}</span>
    <span className="tm-riwayat-nilai">{nilai || '-'}</span>
  </div>
);

/** Catatan privasi ditulis satu kali, dipakai di kepala menu. */
const ShieldNote: React.FC = () => (
  <span>
    Sumber menampilkan 27 kolom data; yang diambil {KOLOM_TM.length} kolom operasional
    termasuk Jenis Usaha dan Referral Code. Sisanya — nama penginput, nomor rekening, KTP,
    NPWP, e-mail, No. HP dan No. telepon — dipotong di sisi server sebelum data masuk
    aplikasi ini maupun cloud.
  </span>
);
