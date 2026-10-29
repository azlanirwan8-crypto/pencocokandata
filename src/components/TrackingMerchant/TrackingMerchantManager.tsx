import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Radar,
  RefreshCw,
  Search,
  AlertCircle,
  Timer,
  Flag,
  MapPin,
  QrCode,
} from 'lucide-react';
import type {
  BarisMerchant,
  KartuRingkasan,
  KartuTahun,
  MuatanTracking,
} from '../../utils/trackingMerchant';
import {
  KUNCI_STORAGE_TRACKING,
  kartuMerchant,
  keranjangStatus,
  keteranganRef,
  labelStatusSumber,
  riwayatMerchant,
  ringkasTracking,
  temukanMerchant,
} from '../../utils/trackingMerchant';
import { getItem, setItem } from '../../utils/storage';
import { loadTrackingMerchantFromNeon } from '../../utils/neonSync';

interface TrackingMerchantManagerProps {
  /** Identik dengan badge sidebar: berapa merchant yang tampil. */
  onTrackingCountChange?: (jumlahMerchant: number) => void;
  /** Baris terbaru untuk peta Dashboard (klik KC → busur ke merchant sekota). */
  onTrackingRowsChange?: (baris: BarisMerchant[]) => void;
}

const KELAS_KERANJANG: Record<string, string> = {
  aktif: 'tm-status tm-status--aktif',
  proses: 'tm-status tm-status--proses',
  tolak: 'tm-status tm-status--tolak',
  lain: 'tm-status tm-status--lain',
};


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
  onTrackingRowsChange,
}) => {
  const [baris, setBaris] = useState<BarisMerchant[]>([]);
  const [ringkasan, setRingkasan] = useState<KartuRingkasan[]>([]);
  const [distribusi, setDistribusi] = useState<KartuTahun[]>([]);
  const [statusMuat, setStatusMuat] = useState<'memuat' | 'siap'>('memuat');

  // Panel Aktivitas Tracking Merchant: MID yang jejaknya sedang dibuka + kata kunci input.
  const [midJejak, setMidJejak] = useState<string | null>(null);
  const [kueriJejak, setKueriJejak] = useState<string>('');
  /** Kueri yang tidak punya padanan di data nyata — ditampilkan sebagai pemberitahuan, bukan kartu. */
  const [kueriKosong, setKueriKosong] = useState<string>('');
  const panelJejakRef = useRef<HTMLDivElement | null>(null);

  const uatMuatan = useCallback((muatan: MuatanTracking) => {
    setBaris(muatan.baris);
    setRingkasan(Array.isArray(muatan.ringkasan) ? muatan.ringkasan : []);
    setDistribusi(Array.isArray(muatan.distribusi) ? muatan.distribusi : []);
    // Data berganti: pemberitahuan "tidak ditemukan" bisa jadi sudah tidak berlaku.
    setKueriKosong('');
  }, []);

  const simpanLokal = useCallback((muatan: MuatanTracking) => {
    const { sumber: _abaikan, ...isi } = muatan as MuatanTracking & { sumber?: string };
    return setItem(KUNCI_STORAGE_TRACKING, isi);
  }, []);

  // Muat: browser dulu supaya tabel langsung terisi, lalu cloud menang kalau lebih baru.
  useEffect(() => {
    let hidup = true;
    (async () => {
      const lokal = await getItem<MuatanTracking & { sumber?: string }>(KUNCI_STORAGE_TRACKING).catch(() => null);
      if (hidup && lokal && Array.isArray(lokal.baris) && lokal.baris.length > 0) {
        uatMuatan(lokal);
        if (lokal.sumber !== undefined) void simpanLokal(lokal);
      }
      const cloud = await loadTrackingMerchantFromNeon();
      if (!hidup) return;
      if (cloud && Array.isArray(cloud.baris) && cloud.baris.length > 0) {
        const lebihBaru = !lokal || String(cloud.diambilPada) > String(lokal.diambilPada);
        if (lebihBaru) {
          uatMuatan(cloud);
          void simpanLokal(cloud);
        }
      }
      setStatusMuat('siap');
    })();
    return () => {
      hidup = false;
    };
  }, [simpanLokal, uatMuatan]);

  // Satu sumber angka merchant — diturunkan dari baris, dipakai baris meta DAN badge
  // sidebar, jadi keduanya tidak mungkin menunjukkan angka berbeda.
  const ringkasSemua = useMemo(() => ringkasTracking(baris), [baris]);

  useEffect(() => {
    onTrackingCountChange?.(ringkasSemua.merchant);
  }, [ringkasSemua.merchant, onTrackingCountChange]);

  // Baris kosong saat mount bukan kabar bahwa data hilang (App sudah memuatnya
  // sendiri); hanya muatan yang benar-benar berisi yang diteruskan ke peta.
  useEffect(() => {
    if (baris.length > 0) onTrackingRowsChange?.(baris);
  }, [baris, onTrackingRowsChange]);

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

  // Klik "Lihat jejak" / pencarian membawa operator ke panel ini, bukan membuka lapisan lain.
  useEffect(() => {
    if (midJejak || kueriKosong) panelJejakRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [midJejak, kueriKosong]);

  return (
    <div>
      {/* 1. Kepala menu */}
      <div className="glass-card tm-kepala-kartu">
        <div className="tm-kepala">
          <div className="section-title tm-kepala-judul">
            <Radar size={18} />
            <span>Tracking Merchant</span>
          </div>
        </div>
      </div>

      {ringkasan.length > 0 && (
        <div className="tm-ringkasan">
          {ringkasan.map((k) => (
            <div key={k.label} className={`tm-kartu tm-kartu--${k.warna}`}>
              <div className="tm-kartu-label">{k.label}</div>
              <div className="tm-kartu-nilai">{k.nilai}</div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Panel aktivitas satu MID / keadaan kosong */}
      {statusMuat === 'memuat' ? (
        <div className="glass-card tm-kosong">
          <RefreshCw size={20} className="tm-putar" />
          <span>Memuat data tersimpan…</span>
        </div>
      ) : baris.length === 0 ? (
        <div className="glass-card tm-kosong">
          <Radar size={26} />
          <div className="tm-kosong-judul">Belum ada data Tracking Merchant di sini.</div>
          <div className="tm-kosong-isi">
            Menu ini hanya menampilkan data yang sudah tersimpan di cloud. Tidak ada pengambilan
            data dari sini.
          </div>
        </div>
      ) : (
        // Aktivitas satu MID — pintu masuk dari kotak cari.
        <div className="glass-card tm-aktivitas" ref={panelJejakRef}>
          <div className="tm-aktivitas-kepala">
            <div className="section-title">Aktivitas Tracking Merchant</div>
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
                  {baris.length.toLocaleString('id-ID')} baris tersimpan — bukan MID terdaftar dan tidak
                  ada nama merchant yang cocok. Hanya data nyata yang ditampilkan di sini.
                </span>
              </div>
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

      {/* 3. Kinerja onboarding per tahun. */}
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
