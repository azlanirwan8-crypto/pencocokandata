import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Radar,
  RefreshCw,
  Search,
  Download,
  X,
  AlertCircle,
  Clock,
  Timer,
  Flag,
  MapPin,
} from 'lucide-react';
import type { BarisMerchant, KartuRingkasan, KartuTahun, MuatanTracking } from '../../utils/trackingMerchant';
import {
  KOLOM_EKSPOR_TM,
  KUNCI_STORAGE_TRACKING,
  SUMUR_TRACKING,
  barisKeExcelTm,
  contohMerchant,
  contohJejakMerchant,
  kandidatMerchant,
  keranjangStatus,
  keteranganRef,
  riwayatMerchant,
  ringkasTracking,
  temukanMerchant,
} from '../../utils/trackingMerchant';
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

/** Teks badge mengikuti halaman sumber: status Active selalu tertulis "Active (NMID Terbit)". */
const labelStatusSumber = (status: string) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('active')) return 'Active (NMID Terbit)';
  return status || 'In Process';
};

export const TrackingMerchantManager: React.FC<TrackingMerchantManagerProps> = ({
  onTrackingCountChange,
}) => {
  const { add: notify } = useNotification();

  const [baris, setBaris] = useState<BarisMerchant[]>([]);
  const [ringkasan, setRingkasan] = useState<KartuRingkasan[]>([]);
  const [distribusi, setDistribusi] = useState<KartuTahun[]>([]);
  const [statusMuat, setStatusMuat] = useState<'memuat' | 'siap' | 'syncing'>('memuat');
  const [galat, setGalat] = useState<string | null>(null);

  // Panel Aktivitas Tracking Merchant: MID yang jejaknya sedang dibuka + kata kunci input.
  const [midJejak, setMidJejak] = useState<string | null>(null);
  const [kueriJejak, setKueriJejak] = useState<string>('');
  const [galatJejak, setGalatJejak] = useState<string>('');
  /** Kartu contoh untuk MID yang tidak ada di data — ditampilkan saja, tidak disimpan. */
  const [jejakContoh, setJejakContoh] = useState<BarisMerchant[] | null>(null);
  const [memeriksaSumber, setMemeriksaSumber] = useState(false);
  const panelJejakRef = useRef<HTMLDivElement | null>(null);
  /** Stempel `diambilPada` data yang sedang tampil — pembanding saat cloud diperiksa ulang. */
  const stempelRef = useRef<string>('');

  const uatMuatan = useCallback((muatan: MuatanTracking) => {
    stempelRef.current = String(muatan.diambilPada || '');
    setBaris(muatan.baris);
    setRingkasan(Array.isArray(muatan.ringkasan) ? muatan.ringkasan : []);
    setDistribusi(Array.isArray(muatan.distribusi) ? muatan.distribusi : []);
    // Data berganti: kartu contoh lama bisa jadi sudah punya padanan nyata.
    setJejakContoh(null);
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
        }
      }
      setStatusMuat('siap');
    })();
    return () => {
      hidup = false;
    };
  }, [uatMuatan]);

  // Realtime ringan: cloud hanya dibaca (tidak menulis, tidak menyentuh sumber), jadi
  // aman dijalankan berkala. Hasil sync siapa pun langsung terlihat tanpa reload.
  useEffect(() => {
    let hidup = true;
    let sedangDiperiksa = false;

    const periksaCloud = async () => {
      if (!hidup || sedangDiperiksa || document.visibilityState === 'hidden') return;
      sedangDiperiksa = true;
      try {
        const cloud = await loadTrackingMerchantFromNeon();
        if (!hidup || !cloud || !Array.isArray(cloud.baris) || cloud.baris.length === 0) return;
        if (String(cloud.diambilPada) <= stempelRef.current) return;
        uatMuatan(cloud);
        setItem(KUNCI_STORAGE_TRACKING, cloud).catch(() => undefined);
        notify(
          `Data Tracking Merchant diperbarui otomatis: ${ringkasTracking(cloud.baris).riwayat.toLocaleString('id-ID')} riwayat tersinkron.`,
          'info'
        );
      } catch {
        // Diamkan; percobaan berikutnya mengulang sendiri.
      } finally {
        sedangDiperiksa = false;
      }
    };

    const saatTerlihat = () => {
      if (document.visibilityState === 'visible') void periksaCloud();
    };
    const pewaktu = window.setInterval(() => void periksaCloud(), 60_000);
    document.addEventListener('visibilitychange', saatTerlihat);
    window.addEventListener('focus', saatTerlihat);
    return () => {
      hidup = false;
      window.clearInterval(pewaktu);
      document.removeEventListener('visibilitychange', saatTerlihat);
      window.removeEventListener('focus', saatTerlihat);
    };
  }, [notify, uatMuatan]);

  const handleSync = useCallback(async (): Promise<BarisMerchant[] | null> => {
    setStatusMuat('syncing');
    setGalat(null);
    const hasil = await syncTrackingMerchantDariSumber();
    if (!hasil.muatan) {
      setStatusMuat('siap');
      const pesan = hasil.pesan || `Tidak bisa menghubungi ${SUMUR_TRACKING}.`;
      setGalat(pesan);
      notify(`Sync gagal: ${pesan}`, 'error');
      return null;
    }
    uatMuatan(hasil.muatan);
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
    return hasil.muatan.baris;
  }, [notify, uatMuatan]);

  // Satu sumber angka merchant — diturunkan dari baris, dipakai baris meta DAN badge
  // sidebar, jadi keduanya tidak mungkin menunjukkan angka berbeda.
  const ringkasSemua = useMemo(() => ringkasTracking(baris), [baris]);

  useEffect(() => {
    onTrackingCountChange?.(ringkasSemua.merchant);
  }, [ringkasSemua.merchant, onTrackingCountChange]);

  const handleExport = () => {
    if (baris.length === 0) {
      notify('Belum ada data tersinkron — tidak ada yang bisa diunduh.', 'warning');
      return;
    }
    tulisLembarExcel({
      namaLembar: 'Tracking_Merchant',
      namaBerkas: `Tracking_Merchant_${tanggalBerkas()}.xlsx`,
      kolom: [...KOLOM_EKSPOR_TM],
      baris: barisKeExcelTm(baris),
    });
    notify(`${baris.length.toLocaleString('id-ID')} riwayat merchant diunduh.`, 'success');
  };

  const jejak = useMemo(
    () => jejakContoh ?? (midJejak ? riwayatMerchant(baris, midJejak) : []),
    [baris, jejakContoh, midJejak]
  );
  const contoh = useMemo(() => contohMerchant(baris, 3), [baris]);
  const rentangTahun = useMemo(() => {
    if (distribusi.length === 0) return '';
    const bersih = (label: string) => label.replace(/TAHUN\s+/i, '').replace(/\s*YTD/i, '').trim();
    return `${bersih(distribusi[0].label)} – ${bersih(distribusi[distribusi.length - 1].label)}`;
  }, [distribusi]);

  // Satu aturan pencarian untuk dua jalur: data yang sedang tampil, dan data yang baru
  // diambil dari sumber. Hasilnya sama supaya "tidak ketemu" tidak pernah sepihak.
  const tampilkanHasilCari = useCallback(
    (kueri: string, daftar: BarisMerchant[]): 'ditemukan' | 'ambigu' | 'contoh' => {
      const mid = temukanMerchant(daftar, kueri);
      if (mid) {
        setGalatJejak('');
        setJejakContoh(null);
        setMidJejak(mid);
        return 'ditemukan';
      }
      setMidJejak(null);
      const kandidat = kandidatMerchant(daftar, kueri);
      if (kandidat.length > 0) {
        setJejakContoh(null);
        setGalatJejak(
          `"${kueri.trim()}" cocok dengan beberapa MID: ${kandidat.join(', ')}${kandidat.length >= 6 ? ', …' : ''}. Tulis MID lengkap untuk membuka jejaknya.`
        );
        return 'ambigu';
      }
      // Tidak ada padanan: tampilkan kartu contoh seperti halaman sumber, bukan layar kosong.
      setGalatJejak('');
      setJejakContoh(contohJejakMerchant(kueri));
      return 'contoh';
    },
    []
  );

  const bukaJejak = useCallback(
    (kueri: string) => {
      setKueriJejak(kueri);
      tampilkanHasilCari(kueri, baris);
    },
    [baris, tampilkanHasilCari]
  );

  // Dipakai tombol "Cek ke sumber": tarik data terbaru dulu (aksi yang sama dengan Sync
  // Data), lalu ulangi pencarian atas baris baru — bukan atas data lama.
  const cekSumberLaluCari = useCallback(async () => {
    const kueri = kueriJejak;
    if (!kueri.trim() || memeriksaSumber) return;
    setMemeriksaSumber(true);
    try {
      const barisBaru = await handleSync();
      if (!barisBaru) return;
      if (tampilkanHasilCari(kueri, barisBaru) === 'contoh') {
        notify(`"${kueri.trim()}" juga tidak ada di hasil sinkron terbaru ${SUMUR_TRACKING}.`, 'warning');
      }
    } finally {
      setMemeriksaSumber(false);
    }
  }, [handleSync, kueriJejak, memeriksaSumber, notify, tampilkanHasilCari]);

  // Klik "Lihat jejak" / pencarian membawa operator ke panel ini, bukan membuka lapisan lain.
  useEffect(() => {
    if (midJejak || jejakContoh) panelJejakRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [midJejak, jejakContoh]);

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
      </div>

      {ringkasan.length > 0 && (
        <div className="tm-ringkasan">
          {ringkasan.map((k) => (
            <div key={k.label} className={`tm-kartu tm-kartu--${k.warna}`}>
              <div className="tm-kartu-label">{k.label}</div>
              <div className="tm-kartu-nilai">{k.nilai}</div>
              {k.keterangan && <p className="tm-kartu-ket">{k.keterangan}</p>}
              {(k.kakiKiri || k.kakiKanan) && (
                <div className="tm-kartu-kaki">
                  <span>{k.kakiKiri}</span>
                  <span>{k.kakiKanan}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {distribusi.length > 0 && (
        <div className="glass-card tm-tahunan">
          <div className="tm-tahunan-kepala">
            <div>
              <div className="tm-tahunan-judul">Kinerja Onboarding Merchant ({rentangTahun})</div>
            </div>
            <div className="tm-legend">
              <span><i className="tm-legend-titik tm-legend-titik--aktif" />Active (NMID Terbit)</span>
              <span><i className="tm-legend-titik tm-legend-titik--tolak" />Reject by PTEN</span>
              <span><i className="tm-legend-titik tm-legend-titik--lain" />Pending / Others</span>
            </div>
          </div>
          <div className="tm-tahun-grid">
            {distribusi.map((k) => (
              <div key={k.label} className={k.unggulan ? 'tm-tahun tm-tahun--unggulan' : 'tm-tahun'}>
                <div className="tm-tahun-atas">
                  <span className="tm-tahun-label">{k.label}</span>
                  {k.emblem && <span className="tm-tahun-emblem">{k.emblem}</span>}
                </div>
                <div className="tm-tahun-nilai">{k.nilai}</div>
                {k.keterangan && <p className="tm-tahun-ket">{k.keterangan}</p>}
                {k.segmen.length > 0 && (
                  <div
                    className="tm-tahun-bar"
                    role="img"
                    aria-label={k.segmen.map((s) => `${s.jenis} ${s.persen}%`).join(', ')}
                  >
                    {k.segmen.map((s) => (
                      <span key={s.jenis} className={`tm-tahun-seg tm-tahun-seg--${s.jenis}`} style={{ width: `${s.persen}%` }} />
                    ))}
                  </div>
                )}
                {k.kaki.length > 0 && (
                  <div className="tm-tahun-kaki">
                    {k.kaki.map((barisKaki) => (
                      <div key={barisKaki.label} className="tm-tahun-kaki-baris">
                        <span>{barisKaki.label}</span>
                        <strong className={`tm-tahun-kaki-nilai tm-tahun-kaki-nilai--${barisKaki.jenis}`}>
                          {barisKaki.nilai}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* 2. Panel aktivitas satu MID / keadaan kosong */}
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
        // Aktivitas satu MID — pintu masuk dari kotak cari dan pilihan cepat.
        <div className="glass-card tm-aktivitas" ref={panelJejakRef}>
          <div className="tm-aktivitas-kepala">
            <div className="section-title">Aktivitas Tracking Merchant</div>
            <div className="section-subtitle">
              Pantau riwayat lengkap perubahan pengajuan satu MID: jenis pengajuan, jenis QR,
              tanggal pengajuan, last update, dan status permohonan.
            </div>
          </div>

          <div className="tm-aktivitas-cari">
            <div className="search-input-wrapper">
              <Search size={15} className="search-icon-pos" />
              <input
                type="text"
                className="search-input"
                placeholder="Masukkan Nomor MID atau nama merchant (contoh: 601741069)…"
                value={kueriJejak}
                onChange={(e) => setKueriJejak(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') bukaJejak(kueriJejak);
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => bukaJejak(kueriJejak)}
              disabled={!kueriJejak.trim()}
            >
              <Search size={13} />
              <span>Cari MID</span>
            </button>
            {(midJejak || jejakContoh || kueriJejak || galatJejak) && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setMidJejak(null); setJejakContoh(null); setKueriJejak(''); setGalatJejak(''); }}
              >
                Reset
              </button>
            )}
          </div>

          {contoh.length > 0 && (
            <div className="tm-aktivitas-contoh">
              {contoh.map((c) => (
                <button key={c.mid} type="button" className="tm-contoh-mid" onClick={() => bukaJejak(c.mid)}>
                  <strong>{c.mid}</strong>
                  <small>{c.nama || 'tanpa nama'} — {c.total} riwayat</small>
                </button>
              ))}
            </div>
          )}

          {galatJejak && (
            <div className="tm-aktivitas-galat">
              <AlertCircle size={14} />
              <span>{galatJejak}</span>
            </div>
          )}

          {jejakContoh && (
            <div className="tm-contoh-catatan">
              <div className="tm-contoh-isi">
                <AlertCircle size={14} />
                <span>
                  Kartu contoh: MID ini tidak ada di {baris.length.toLocaleString('id-ID')} baris hasil
                  sinkron. Isinya disusun seperti halaman sumber (nomor referensi acak) dan{' '}
                  <strong>tidak</strong> disimpan, dihitung, atau ikut diekspor.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm tm-contoh-cek"
                onClick={() => void cekSumberLaluCari()}
                disabled={memeriksaSumber || sinkronSedang}
              >
                <RefreshCw size={13} className={memeriksaSumber || sinkronSedang ? 'tm-putar' : undefined} />
                <span>{memeriksaSumber ? 'Memeriksa sumber…' : 'Cek ke sumber'}</span>
              </button>
            </div>
          )}

          {jejak.length > 0 && (
            <>
              {/* Kartu identitas merchant — susunannya mengikuti kartu profil di halaman sumber. */}
              <div className="tm-profil">
                <div className="tm-profil-kiri">
                  <div className="tm-profil-lencana">
                    <span className="tm-profil-mid">MID: {midJejak || jejak[0].mid}</span>
                    {jejak.length > 1 && (
                      <span className="tm-profil-multi">
                        <Flag size={10} />
                        Multi-Riwayat ({jejak.length}×)
                      </span>
                    )}
                    {jejak[0].kriteria && <span className="tm-profil-kriteria">{jejak[0].kriteria}</span>}
                  </div>
                  <div className="tm-profil-nama">{jejak[0].namaMerchant || 'Merchant QRIS'}</div>
                  <div className="tm-profil-lokasi">
                    <MapPin size={13} />
                    <span>
                      {[jejak[0].kabupatenKota, jejak[0].provinsi].filter(Boolean).join(' • ') || 'Indonesia'}
                    </span>
                  </div>
                </div>
                <div className="tm-profil-kanan">
                  <span className={`tm-profil-status tm-profil-status--${keranjangStatus(jejak[0].status)}`}>
                    <i aria-hidden="true" />
                    {labelStatusSumber(jejak[0].status)}
                  </span>
                  {jejak[0].branchCode && jejak[0].branchCode !== '-' && (
                    <div className="tm-profil-metrik">
                      Cabang: <strong>{jejak[0].branchCode}</strong>
                    </div>
                  )}
                  <div className="tm-profil-aktivitas">
                    {jejak.length} Aktivitas Tercatat{jejak.length > 1 ? ' (Multi-Event)' : ''}
                  </div>
                </div>
              </div>

              <div className="tm-histori">
                <div className="tm-histori-judul">
                  <Clock size={14} />
                  <span>Histori Pengajuan &amp; Perubahan Siklus (Data Lake QRIS)</span>
                  <span className="tm-histori-jumlah">{jejak.length} Pengajuan Terdata</span>
                </div>
                <div className="table-container">
                  <table className="modern-table tm-histori-tabel">
                    <thead>
                      <tr>
                        <th>Jenis Pengajuan</th>
                        <th>Jenis QR</th>
                        <th>Tanggal Pengajuan</th>
                        <th>Last Update</th>
                        <th>Status</th>
                        <th>Ref No &amp; Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jejak.map((r, i) => (
                        <tr key={`${r.refNo}-${r.tglPengajuan}-${i}`}>
                          <td>{r.jenisPengajuan || '-'}</td>
                          <td>{r.jenisQr || '-'}</td>
                          <td className="tm-mono">{r.tglPengajuan || '-'}</td>
                          <td className="tm-mono">{r.lastUpdate || '-'}</td>
                          <td><span className={KELAS_KERANJANG[keranjangStatus(r.status)]}>{r.status || '-'}</span></td>
                          <td>
                            <div className="tm-ref">{r.refNo || '-'}</div>
                            <div className="tm-ref-ket">{keteranganRef(r.status)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="tm-jejak">
                <div className="tm-jejak-judul">
                  <Timer size={14} />
                  <span>Kronologi Siklus Perubahan (Lifecycle Audit Trail)</span>
                </div>
                <ol className="tm-jejak-daftar">
                  {jejak.map((r, i) => {
                    const terkini = i === 0;
                    const nada = terkini ? 'terkini' : keranjangStatus(r.status) === 'tolak' ? 'tolak' : 'lama';
                    return (
                      <li key={`${r.refNo}-${r.tglPengajuan}-${i}`} className={`tm-jejak-node tm-jejak-node--${nada}`}>
                        <div className="tm-jejak-kartu">
                          <div className="tm-jejak-baris">
                            <span className="tm-jejak-nama">{r.jenisPengajuan || '-'}</span>
                            <span className="tm-jejak-qr">({r.jenisQr || '-'})</span>
                            {jejak.length > 1 && (
                              <span className="tm-jejak-riwayat">Riwayat {i + 1} dari {jejak.length}</span>
                            )}
                            <span className="tm-jejak-tanggal">{r.tglPengajuan || '-'}</span>
                          </div>
                          <p className="tm-jejak-status">
                            Status Pembaruan: <strong>{r.status || '-'}</strong> &bull; Last Update:{' '}
                            <span className="tm-mono">{r.lastUpdate || '-'}</span>
                          </p>
                          <div className="tm-jejak-kaki">
                            <span>Nomor Referensi: <strong className="tm-mono">{r.refNo || '-'}</strong></span>
                            <span className={terkini ? 'tm-jejak-tanda tm-jejak-tanda--terkini' : 'tm-jejak-tanda'}>
                              {terkini ? 'Tahap Terkini' : 'Riwayat Terdahulu'}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
