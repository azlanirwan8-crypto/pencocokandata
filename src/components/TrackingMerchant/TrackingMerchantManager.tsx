import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Radar,
  RefreshCw,
  Search,
  Download,
  X,
  AlertCircle,
  Timer,
  Flag,
  MapPin,
  QrCode,
  Check,
} from 'lucide-react';
import type {
  BarisMerchant,
  KartuRingkasan,
  KartuTahun,
  MuatanTracking,
  PeriodeQr,
  SaringanRekap,
} from '../../utils/trackingMerchant';
import {
  KOLOM_EKSPOR_TM,
  KUNCI_STORAGE_TRACKING,
  PERIODE_QR_DEFAULT,
  SARINGAN_REKAP_KOSONG,
  SUMUR_TRACKING,
  barisKeExcelTm,
  daftarMerchantTerverifikasi,
  daftarPeriodeQr,
  formatAngka,
  halamanDaftar,
  kartuMerchant,
  keranjangStatus,
  keteranganRef,
  labelStatusSumber,
  periodeQrAktif,
  ringkasAngkaBesar,
  riwayatMerchant,
  ringkasTracking,
  saringMerchantTerverifikasi,
  segmenDonat,
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
  aktif: 'tm-status tm-status--aktif',
  proses: 'tm-status tm-status--proses',
  tolak: 'tm-status tm-status--tolak',
  lain: 'tm-status tm-status--lain',
};

/** Sama dengan REKAP_PAGE_SIZE halaman sumber. */
const UKURAN_HALAMAN_REKAP = 20;

// Warna label mengikuti getPengajuanBadge() di halaman sumber; urutan cek penting
// karena 'Edit Settlement' harus diputuskan sebelum 'Edit'.
function kelasJenisPengajuan(jenis?: string): string {
  const teks = jenis || '';
  if (teks.includes('Add New Merchant')) return 'tm-jenis tm-jenis--biru';
  if (teks.includes('Add New Outlet')) return 'tm-jenis tm-jenis--langit';
  if (teks.includes('Edit Settlement')) return 'tm-jenis tm-jenis--teal';
  if (teks.includes('Edit')) return 'tm-jenis tm-jenis--kuning';
  if (teks.includes('Blokir')) return 'tm-jenis tm-jenis--merah';
  return 'tm-jenis';
}

export const TrackingMerchantManager: React.FC<TrackingMerchantManagerProps> = ({
  onTrackingCountChange,
}) => {
  const { add: notify } = useNotification();

  const [baris, setBaris] = useState<BarisMerchant[]>([]);
  const [ringkasan, setRingkasan] = useState<KartuRingkasan[]>([]);
  const [distribusi, setDistribusi] = useState<KartuTahun[]>([]);
  const [periodeQr, setPeriodeQr] = useState<Record<string, PeriodeQr> | null>(null);
  const [periodePilih, setPeriodePilih] = useState(PERIODE_QR_DEFAULT);
  const [saringanRekap, setSaringanRekap] = useState<SaringanRekap>(SARINGAN_REKAP_KOSONG);
  const [halamanRekap, setHalamanRekap] = useState(1);
  const [statusMuat, setStatusMuat] = useState<'memuat' | 'siap' | 'syncing'>('memuat');
  const [galat, setGalat] = useState<string | null>(null);

  // Panel Aktivitas Tracking Merchant: MID yang jejaknya sedang dibuka + kata kunci input.
  const [midJejak, setMidJejak] = useState<string | null>(null);
  const [kueriJejak, setKueriJejak] = useState<string>('');
  /** Kueri yang tidak punya padanan di data nyata — ditampilkan sebagai pemberitahuan, bukan kartu. */
  const [kueriKosong, setKueriKosong] = useState<string>('');
  const [memeriksaSumber, setMemeriksaSumber] = useState(false);
  const panelJejakRef = useRef<HTMLDivElement | null>(null);
  const panelRekapRef = useRef<HTMLDivElement | null>(null);
  /** Stempel `diambilPada` data yang sedang tampil — pembanding saat cloud diperiksa ulang. */
  const stempelRef = useRef<string>('');

  const uatMuatan = useCallback((muatan: MuatanTracking) => {
    stempelRef.current = String(muatan.diambilPada || '');
    setBaris(muatan.baris);
    setRingkasan(Array.isArray(muatan.ringkasan) ? muatan.ringkasan : []);
    setDistribusi(Array.isArray(muatan.distribusi) ? muatan.distribusi : []);
    setPeriodeQr(muatan.periodeQr && typeof muatan.periodeQr === 'object' ? muatan.periodeQr : null);
    // Data berganti: pemberitahuan "tidak ditemukan" bisa jadi sudah tidak berlaku.
    setKueriKosong('');
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
    () => (midJejak ? riwayatMerchant(baris, midJejak) : []),
    [baris, midJejak]
  );
  // Kartu identitas memakai objek induk — sama seperti renderMIDDetail() di sumber.
  const kartu = useMemo(() => kartuMerchant(jejak), [jejak]);
  const rentangTahun = useMemo(() => {
    if (distribusi.length === 0) return '';
    const bersih = (label: string) => label.replace(/TAHUN\s+/i, '').replace(/\s*YTD/i, '').trim();
    return `${bersih(distribusi[0].label)} – ${bersih(distribusi[distribusi.length - 1].label)}`;
  }, [distribusi]);

  // ── Komposisi jenis QR: angka literal sumber, disalin saat sync ────────────
  const periodeTersedia = useMemo(() => daftarPeriodeQr(periodeQr || undefined), [periodeQr]);
  const periodeData = useMemo(
    () => periodeQrAktif(periodeQr || undefined, periodePilih),
    [periodeQr, periodePilih]
  );
  // Kunci yang benar-benar tampil: pilihan operator, lalu 2026, lalu periode pertama.
  const kunciPeriodeAktif =
    periodeQr && periodeQr[periodePilih]
      ? periodePilih
      : periodeQr && periodeQr[PERIODE_QR_DEFAULT]
        ? PERIODE_QR_DEFAULT
        : periodeTersedia[0] || '';
  const segmenCincin = useMemo(
    () => (periodeData ? segmenDonat(periodeData.qrGroups, periodeData.totalUniqueMIDs) : []),
    [periodeData]
  );
  // Warna titik jenis QR diambil dari komposisi sumber; nama yang tidak ada di sana abu-abu.
  const warnaQr = useMemo(() => {
    const peta: Record<string, string> = {};
    for (const p of Object.values(periodeQr || {})) {
      for (const g of p.qrGroups) if (!peta[g.name]) peta[g.name] = g.color;
    }
    return peta;
  }, [periodeQr]);
  const warnaJenis = (nama: string) => warnaQr[nama] || '#64748b';

  // ── Daftar merchant terverifikasi: satu baris per MID unik ────────────────
  const merchantTerverifikasi = useMemo(() => daftarMerchantTerverifikasi(baris), [baris]);
  const opsiJenisQr = useMemo(
    () => Array.from(new Set(merchantTerverifikasi.map((m) => m.jenisQr).filter(Boolean))).sort(),
    [merchantTerverifikasi]
  );
  const merchantTersaring = useMemo(
    () => saringMerchantTerverifikasi(merchantTerverifikasi, saringanRekap),
    [merchantTerverifikasi, saringanRekap]
  );
  const halamanMerchant = useMemo(
    () => halamanDaftar(merchantTersaring, halamanRekap, UKURAN_HALAMAN_REKAP),
    [merchantTersaring, halamanRekap]
  );

  const ubahSaringanRekap = useCallback((ubahan: Partial<SaringanRekap>) => {
    setSaringanRekap((lama) => ({ ...lama, ...ubahan }));
    setHalamanRekap(1);
  }, []);

  // Tombol "Filter List" di tabel agregasi: saring daftar, lalu bawa operator ke sana.
  const saringDaftarDariAgregasi = useCallback(
    (jenisQr: string) => {
      ubahSaringanRekap({ jenisQr });
      panelRekapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [ubahSaringanRekap]
  );

  // Satu aturan pencarian untuk dua jalur: data yang sedang tampil, dan data yang baru
  // diambil dari sumber. Hasilnya sama supaya "tidak ketemu" tidak pernah sepihak.
  const tampilkanHasilCari = useCallback(
    (kueri: string, daftar: BarisMerchant[]): 'ditemukan' | 'kosong' => {
      const mid = temukanMerchant(daftar, kueri);
      if (mid) {
        setKueriKosong('');
        setMidJejak(mid);
        return 'ditemukan';
      }
      // Tidak ada padanan: beri tahu apa adanya. Halaman sumber mengarang kartu di titik ini,
      // tapi data karangan (ref acak) tidak pernah bisa sama dengan sumber — jadi tidak ditampilkan.
      setMidJejak(null);
      setKueriKosong(kueri.trim());
      return 'kosong';
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
      if (tampilkanHasilCari(kueri, barisBaru) === 'kosong') {
        notify(`"${kueri.trim()}" juga tidak ada di hasil sinkron terbaru ${SUMUR_TRACKING}.`, 'warning');
      }
    } finally {
      setMemeriksaSumber(false);
    }
  }, [handleSync, kueriJejak, memeriksaSumber, notify, tampilkanHasilCari]);

  // Klik "Lihat jejak" / pencarian membawa operator ke panel ini, bukan membuka lapisan lain.
  useEffect(() => {
    if (midJejak || kueriKosong) panelJejakRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [midJejak, kueriKosong]);

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
        // Aktivitas satu MID — pintu masuk dari kotak cari.
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
            {(midJejak || kueriKosong || kueriJejak) && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setMidJejak(null); setKueriKosong(''); setKueriJejak(''); }}
              >
                Reset
              </button>
            )}
          </div>

          {kueriKosong && (
            <div className="tm-aktivitas-catatan">
              <div className="tm-aktivitas-catatan-isi">
                <AlertCircle size={14} />
                <span>
                  <strong>&ldquo;{kueriKosong}&rdquo;</strong> tidak ditemukan di{' '}
                  {baris.length.toLocaleString('id-ID')} baris hasil sinkron — bukan MID terdaftar dan tidak
                  ada nama merchant yang cocok. Hanya data nyata yang ditampilkan di sini.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm tm-aktivitas-catatan-aksi"
                onClick={() => void cekSumberLaluCari()}
                disabled={memeriksaSumber || sinkronSedang}
              >
                <RefreshCw size={13} className={memeriksaSumber || sinkronSedang ? 'tm-putar' : undefined} />
                <span>{memeriksaSumber ? 'Memeriksa sumber…' : 'Cek ke sumber'}</span>
              </button>
            </div>
          )}

          {kartu && jejak.length > 0 && (
            <>
              {/* Kartu identitas merchant — susunannya mengikuti kartu profil di halaman sumber. */}
              <div className="tm-profil">
                <div className="tm-profil-kiri">
                  <div className="tm-profil-lencana">
                    <span className="tm-profil-mid">MID: {kartu.mid}</span>
                    {jejak.length > 1 && (
                      <span className="tm-profil-multi">
                        <Flag size={10} />
                        Multi-Riwayat ({jejak.length}×)
                      </span>
                    )}
                    <span className="tm-profil-kriteria">{kartu.kriteria}</span>
                  </div>
                  <div className="tm-profil-nama">{kartu.nama}</div>
                  <div className="tm-profil-lokasi">
                    <MapPin size={13} />
                    <span>{kartu.lokasi}</span>
                  </div>
                </div>
                <div className="tm-profil-kanan">
                  <span className={`tm-profil-status tm-profil-status--${keranjangStatus(kartu.status)}`}>
                    <i aria-hidden="true" />
                    {kartu.status}
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
                <div className="tm-histori-kepala">
                  <div className="tm-histori-judul">
                    <span className="tm-histori-titik" aria-hidden="true" />
                    <span>Histori Pengajuan &amp; Perubahan Siklus (Data Lake QRIS)</span>
                  </div>
                  <span className="tm-histori-jumlah">
                    {jejak.length} Pengajuan Terdata
                    {jejak.length > 1 && (
                      <span className="tm-histori-multi">
                        (<Flag size={10} aria-hidden="true" />
                        Multi-Riwayat)
                      </span>
                    )}
                  </span>
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
                          <td>
                            <span className={kelasJenisPengajuan(r.jenisPengajuan)}>
                              {r.jenisPengajuan || 'Pengajuan'}
                            </span>
                          </td>
                          <td>
                            <span className="tm-qr">
                              <QrCode size={13} aria-hidden="true" />
                              {r.jenisQr || 'QR Sticker'}
                            </span>
                          </td>
                          <td className="tm-mono tm-tgl">{r.tglPengajuan || '-'}</td>
                          <td className="tm-mono">{r.lastUpdate || '-'}</td>
                          <td>
                            <span className={KELAS_KERANJANG[keranjangStatus(r.status)]}>
                              {labelStatusSumber(r.status)}
                            </span>
                          </td>
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
                    // Sumber mewarnai titik merah untuk Reject lebih dulu, baru biru untuk tahap terkini.
                    const nada =
                      keranjangStatus(r.status) === 'tolak' ? 'tolak' : terkini ? 'terkini' : 'lama';
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

      {/* 3. Komposisi & rekap jenis QR. Angkanya literal PERIODS_MASTER_DATA di halaman
          sumber (data lake nasional), disalin apa adanya saat sync — bukan hasil hitung
          `baris`. Periode yang tidak tersimpan dikatakan apa adanya, tidak dikarang. */}
      {statusMuat !== 'memuat' && baris.length > 0 && (
        <>
          <div className="tm-qr-grid">
            <div className="glass-card tm-qr-kartu">
              <div className="tm-qr-kepala">
                <div>
                  <div className="tm-qr-judul">Distribusi Komposisi Jenis QR</div>
                  <div className="tm-qr-sub">
                    {periodeData
                      ? `${periodeData.label} • ${formatAngka(periodeData.totalRawEvents)} log mentah → ${formatAngka(periodeData.totalUniqueMIDs)} MID unik`
                      : `Komposisi jenis QR dibaca dari ${SUMUR_TRACKING} saat sync.`}
                  </div>
                </div>
                {periodeTersedia.length > 0 && (
                  <select
                    className="filter-select"
                    aria-label="Periode komposisi jenis QR"
                    value={kunciPeriodeAktif}
                    onChange={(e) => setPeriodePilih(e.target.value)}
                  >
                    {periodeTersedia.map((kunci) => (
                      <option key={kunci} value={kunci}>
                        {periodeQr?.[kunci]?.shortLabel || kunci}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {periodeData ? (
                <div className="tm-donat-baris">
                  <div className="tm-donat">
                    <svg
                      viewBox="0 0 120 120"
                      width="120"
                      height="120"
                      role="img"
                      aria-label={`Komposisi jenis QR ${periodeData.label}: ${periodeData.qrGroups
                        .map((g) => `${g.name} ${formatAngka(g.pct)}%`)
                        .join(', ')}`}
                    >
                      <circle cx="60" cy="60" r="40" fill="none" stroke="var(--border-subtle)" strokeWidth="15" />
                      <g transform="rotate(-90 60 60)">
                        {segmenCincin.map((s) => (
                          <circle
                            key={s.name}
                            cx="60"
                            cy="60"
                            r="40"
                            fill="none"
                            stroke={s.color}
                            strokeWidth="15"
                            strokeDasharray={s.dasharray}
                            strokeDashoffset={s.dashoffset}
                          />
                        ))}
                      </g>
                    </svg>
                    <div className="tm-donat-tengah">
                      <div className="tm-donat-nilai">{ringkasAngkaBesar(periodeData.totalUniqueMIDs)}</div>
                      <div className="tm-donat-label">MID Unik</div>
                    </div>
                  </div>
                  <ul className="tm-qr-legend">
                    {periodeData.qrGroups.map((g) => (
                      <li key={g.name}>
                        <i className="tm-qr-titik" style={{ background: g.color }} aria-hidden="true" />
                        <span className="tm-qr-legend-nama">{g.name}</span>
                        <span className="tm-qr-legend-angka">{formatAngka(g.uniqueCount)}</span>
                        <strong className="tm-qr-legend-pct">{formatAngka(g.pct)}%</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="tm-qr-nihil">
                  <AlertCircle size={14} />
                  <span>
                    Komposisi belum ada di data yang tampil. Angka ini ikut dibaca saat{' '}
                    <strong>Sync Data</strong>; muatan lama tidak menyimpannya dan angka tidak
                    dikarang di sini.
                  </span>
                </div>
              )}
            </div>

            <div className="glass-card tm-qr-kartu">
              <div className="tm-qr-kepala">
                <div>
                  <div className="tm-qr-judul">Tabel Ringkasan Agregasi per Jenis QR</div>
                  <div className="tm-qr-sub">
                    {periodeData
                      ? `${periodeData.label} • ${periodeData.qrGroups.length} jenis QR, ${formatAngka(periodeData.duplicateEventsEliminated)} log duplikat dieliminasi`
                      : 'Rekap per jenis QR mengikuti periode komposisi di samping.'}
                  </div>
                </div>
              </div>

              {periodeData ? (
                <div className="table-container">
                  <table className="modern-table tm-qr-tabel">
                    <thead>
                      <tr>
                        <th>Jenis QR</th>
                        <th className="tm-kanan">Raw Log</th>
                        <th className="tm-kanan">MID Unik</th>
                        <th className="tm-kanan">% Pangsa</th>
                        <th className="tm-kanan">Duplikasi</th>
                        <th className="tm-tengah">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodeData.qrGroups.map((g) => (
                        <tr key={g.name}>
                          <td>
                            <div className="tm-qr-nama">
                              <i className="tm-qr-titik" style={{ background: g.color }} aria-hidden="true" />
                              <span>{g.name}</span>
                            </div>
                            {g.desc && <div className="tm-qr-desc">{g.desc}</div>}
                          </td>
                          <td className="tm-kanan tm-mono">{formatAngka(g.rawCount)}</td>
                          <td className="tm-kanan tm-mono tm-tebal">{formatAngka(g.uniqueCount)}</td>
                          <td className="tm-kanan tm-mono">{formatAngka(g.pct)}%</td>
                          <td className="tm-kanan tm-mono tm-redup">{formatAngka(g.dupEliminated)}</td>
                          <td className="tm-tengah">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => saringDaftarDariAgregasi(g.name)}
                              title={`Saring daftar merchant terverifikasi ke ${g.name}`}
                            >
                              Filter List
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>TOTAL REKAP</td>
                        <td className="tm-kanan tm-mono">{formatAngka(periodeData.totalRawEvents)}</td>
                        <td className="tm-kanan tm-mono">{formatAngka(periodeData.totalUniqueMIDs)}</td>
                        <td className="tm-kanan tm-mono">100%</td>
                        <td className="tm-kanan tm-mono">{formatAngka(periodeData.duplicateEventsEliminated)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="tm-qr-nihil">
                  <AlertCircle size={14} />
                  <span>Rekap belum tersedia — tekan <strong>Sync Data</strong> untuk membacanya dari sumber.</span>
                </div>
              )}
              {periodeData && (
                <p className="tm-qr-catatan">
                  Baris TOTAL dibaca langsung dari angka periode di sumber; jumlah per jenis QR bisa
                  berbeda tipis dari TOTAL karena pembulatan di sumber.
                </p>
              )}
            </div>
          </div>

          {/* Daftar merchant terverifikasi — satu baris per MID, nama & wilayah dari objek induk. */}
          <div className="glass-card tm-rekap" ref={panelRekapRef}>
            <div className="tm-qr-kepala">
              <div>
                <div className="tm-qr-judul">Daftar Merchant Terverifikasi (MID Unik)</div>
                <div className="tm-qr-sub">
                  Satu baris per MID. Nama, kriteria, dan wilayah dibaca dari objek induk seperti
                  tabel sumber — nomor rekening tidak ikut karena dipotong parser.
                </div>
              </div>
              <span className="tm-qr-pil">
                {formatAngka(halamanMerchant.total)} / {formatAngka(merchantTerverifikasi.length)} MID
              </span>
            </div>

            <div className="tm-rekap-saring">
              <div className="search-input-wrapper">
                <Search size={15} className="search-icon-pos" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Cari MID, nama merchant, atau kota…"
                  value={saringanRekap.kueri}
                  onChange={(e) => ubahSaringanRekap({ kueri: e.target.value })}
                />
              </div>
              <select
                className="filter-select"
                aria-label="Saring jenis QR"
                value={saringanRekap.jenisQr}
                onChange={(e) => ubahSaringanRekap({ jenisQr: e.target.value })}
              >
                <option value="">Semua jenis QR</option>
                <option value="GROUP_API">Grup: QR API</option>
                <option value="GROUP_NON_API">Grup: QR Non-API</option>
                {opsiJenisQr.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
              <select
                className="filter-select"
                aria-label="Saring jumlah log"
                value={saringanRekap.duplikasi}
                onChange={(e) => ubahSaringanRekap({ duplikasi: e.target.value as SaringanRekap['duplikasi'] })}
              >
                <option value="">Semua log</option>
                <option value="multi">Multi-log (flag)</option>
                <option value="single">Satu log</option>
              </select>
              {(saringanRekap.kueri || saringanRekap.jenisQr || saringanRekap.duplikasi) && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => ubahSaringanRekap(SARINGAN_REKAP_KOSONG)}
                >
                  Reset saringan
                </button>
              )}
            </div>

            <div className="table-container">
              <table className="modern-table tm-rekap-tabel">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>MID</th>
                    <th>Nama Merchant</th>
                    <th>Jenis QR</th>
                    <th>Kriteria &amp; Wilayah</th>
                    <th>Validasi MID</th>
                    <th>Update Terakhir</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {halamanMerchant.isi.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="tm-rekap-kosong">
                        Tidak ada MID yang cocok dengan saringan ini.
                      </td>
                    </tr>
                  ) : (
                    halamanMerchant.isi.map((m, i) => (
                      <tr key={m.mid}>
                        <td className="tm-mono">{formatAngka(halamanMerchant.mulai + i)}</td>
                        <td className="tm-mono tm-tebal">{m.mid}</td>
                        <td>
                          <div className="tm-rekap-nama">{m.nama || '-'}</div>
                          <span className={KELAS_KERANJANG[keranjangStatus(m.statusTerakhir)]}>
                            {labelStatusSumber(m.statusTerakhir)}
                          </span>
                        </td>
                        <td>
                          <span className="tm-qr">
                            <i className="tm-qr-titik" style={{ background: warnaJenis(m.jenisQr) }} aria-hidden="true" />
                            {m.jenisQr || '-'}
                          </span>
                        </td>
                        <td>
                          <div>{m.kriteria || '-'}</div>
                          <div className="tm-rekap-wilayah">
                            {[m.kota, m.provinsi].filter(Boolean).join(' • ') || '-'}
                          </div>
                        </td>
                        <td>
                          {m.jumlahRiwayat > 1 ? (
                            <span className="tm-validasi tm-validasi--multi">
                              <Flag size={10} aria-hidden="true" />
                              MID Unik ({m.jumlahRiwayat}× Log)
                            </span>
                          ) : (
                            <span className="tm-validasi tm-validasi--tunggal">
                              <Check size={10} aria-hidden="true" />
                              MID Unik (1× Log)
                            </span>
                          )}
                        </td>
                        <td className="tm-mono">{m.lastUpdate || '-'}</td>
                        <td>
                          <button
                            type="button"
                            className="tm-mid-tombol"
                            onClick={() => {
                              setMidJejak(m.mid);
                              setKueriJejak(m.mid);
                              setKueriKosong('');
                            }}
                          >
                            Riwayat &rarr;
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="tm-rekap-halaman">
              <span>
                {halamanMerchant.total === 0
                  ? 'Tidak ada baris'
                  : `${formatAngka(halamanMerchant.mulai)}–${formatAngka(halamanMerchant.akhir)} dari ${formatAngka(
                      halamanMerchant.total
                    )} MID`}
              </span>
              <div className="tm-rekap-nav">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={halamanMerchant.halaman <= 1}
                  onClick={() => setHalamanRekap(halamanMerchant.halaman - 1)}
                >
                  Sebelumnya
                </button>
                <span>
                  Halaman {halamanMerchant.halaman} / {halamanMerchant.totalHalaman}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={halamanMerchant.halaman >= halamanMerchant.totalHalaman}
                  onClick={() => setHalamanRekap(halamanMerchant.halaman + 1)}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 4. Kinerja onboarding per tahun — tetap di bawah Aktivitas & rekap. */}
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
    </div>
  );
};
