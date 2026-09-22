import React, { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  Zap,
  Check,
  Search,
  X,
  FileSpreadsheet,
  FileText,
  MapPin,
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  Info,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Shield,
  Store,
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import type { AnalystRow, AnalystCoverage } from '../../utils/analystPipeline';
import { cityMatchKey, matchRoleForOutlet, penjelasanFase1, penjelasanFase2, penjelasanFase3, paketFase2DariMaster } from '../../utils/analystPipeline';
import { useTampilanTersimpan } from '../../utils/useTampilanTersimpan';
import type { KodePosRow } from '../../utils/neonSync';
import type { PTENRecord } from '../PTENData/PTENManager';
import type { MasterRow, TargetRow, WilayahSetting } from '../../types';
import type { RoleMappingRecord } from '../RoleMapping/RoleMappingManager';
import { buildMasterProximityIndex, findClosestMasterRecommendation, type CandidateOption, type RecommendationResult } from '../../utils/recommender';
import { findTopRoleMatchesByLocation, type RoleMatchScored } from '../../utils/roleRecommender';
import { getUnitCategory, getWondrRecommendation } from '../RoleMapping/RoleMappingManager';
import { extractWilayahFromBranchCode } from '../../utils/normalizer';
import { CandidateDetailModal } from './CandidateDetailModal';
import { AnalystRowDetailModal } from './AnalystRowDetailModal';
import { PtenCityPicker } from './PtenCityPicker';
import { CityOverrideModal } from './CityOverrideModal';
import { ConfirmDialog } from './ConfirmDialog';
import { formatWilayahName, cleanKelurahan, cleanKecamatan } from '../../utils/normalizer';
import { formatWilayahCode, applyStandardSheetStyle } from '../../utils/excel';
import { exportAnalystExecutivePdf } from '../../utils/pdfExport';
import { useVirtualWindow } from '../../utils/useVirtualWindow';
import { useNotification } from '../Notification/NotificationContext';

/** Satu sel "validasi fase N" di tab Data Final: badge hasil + alasannya satu baris. */
const SelValidasi: React.FC<{
  p: { label: string; alasan: string; nada: 'ok' | 'waspada' | 'buruk' };
  warnaGaris?: string;
}> = ({ p, warnaGaris }) => {
  const cls = p.nada === 'ok' ? 'badge-match' : p.nada === 'waspada' ? 'badge-level2' : 'badge-diff';
  return (
    <td style={{ textAlign: 'center', borderLeft: warnaGaris }} title={p.alasan}>
      <span className={`badge ${cls}`}>{p.label}</span>
      <div
        style={{
          fontSize: '0.62rem',
          color: '#878a99',
          margin: '2px auto 0',
          maxWidth: '200px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {p.alasan}
      </div>
    </td>
  );
};

/** Kolom tabel yang bisa diurutkan lewat klik header. */
type SortKolom =
  | 'no' | 'kelurahan' | 'kecamatan' | 'provinsi' | 'kotaPten' | 'statusPten'
  | 'kodePosPten' | 'kodePosKelurahan' | 'namaOutlet' | 'wilayah' | 'organisasiTujuan';

const PENGAMBIL_SORT: Record<SortKolom, (r: AnalystRow) => string | number> = {
  no: (r) => r.no,
  kelurahan: (r) => r.kelurahan || '',
  kecamatan: (r) => r.kecamatan || '',
  provinsi: (r) => r.provinsi || '',
  kotaPten: (r) => r.kotaPten || r.groupKota || '',
  statusPten: (r) => `${r.statusPten || ''}|${r.placementMethod || ''}`,
  kodePosPten: (r) => r.kodePosPten || '',
  kodePosKelurahan: (r) => r.kodePosKelurahan || '',
  namaOutlet: (r) => r.namaOutlet || '',
  wilayah: (r) => r.wilayah || '',
  organisasiTujuan: (r) => r.organisasiTujuan || '',
};

/** Sort selalu mengembalikan salinan — `rows` adalah state yang tidak boleh diubah. */
function terapkanSort(rows: AnalystRow[], kolom: SortKolom | null, arah: 'asc' | 'desc'): AnalystRow[] {
  if (!kolom) return rows;
  const ambil = PENGAMBIL_SORT[kolom];
  const tanda = arah === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = ambil(a);
    const y = ambil(b);
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * tanda || a.no - b.no;
    return String(x).localeCompare(String(y), 'id') * tanda || a.no - b.no;
  });
}

interface AnalystResultsGridProps {
  rows: AnalystRow[];
  onUpdateRow: (updatedRow: AnalystRow) => void;
  onApproveSingleRow: (rowId: string) => void;
  onApproveAllFinal: () => void;
  onApproveFase: (fase: 1 | 2 | 3) => void;
  /** "Setujui semua" pada tab manual: baris dianggap bersih, tetap di fase yang sama. */
  onBersihkanManual: (rowIds: string[]) => void;
  /**
   * N3: satu pembaruan array untuk banyak baris terpilih. onUpdateRow per baris akan
   * men-scan ulang seluruh hasil untuk SETIAP baris terpilih, jadi aksi massal wajib
   * lewat jalur ini.
   */
  onPatchMassal: (rowIds: string[], patch: Partial<AnalystRow>) => void;
  /** A7: disaring ke baris yang belum disetujui pada fase ini (null = tanpa saringan). */
  filterBelumSetuju?: 1 | 2 | 3 | null;
  onResetBelumSetuju?: () => void;
  onReRunAll: () => void;
  onReRunAnomaliesOnly: () => void;
  isProcessing: boolean;
  wilayahSettings: WilayahSetting[];
  coverage?: AnalystCoverage | null;
  ptenList?: PTENRecord[];
  kodePosRows?: KodePosRow[];
  cityOverrides?: Record<string, string>;
  onApproveCityOverride?: (masterCity: string, ptenKota: string) => void;
  onRemoveCityOverride?: (masterKey: string) => void;
  masterRows?: MasterRow[];
  roleMappingList?: RoleMappingRecord[];
  /** N0 butir 4: baris manual tidak bisa dibetulkan di sini — bawa operator ke menu Data Cabang. */
  onBukaMasterCabang?: () => void;
}

// Cache rekomendasi Fase 2: mesin ini ±10 ms/baris dan dipanggil ulang tiap jendela
// luncatan bergeser. Ditaruh di luar komponen (map komponen mati saat unmount) dan
// dikunci per indeks master + cabang yang sedang terpasang — lihat `fase2Recs`.
const kunciFase2 = (r: AnalystRow) =>
  `${r.kodePosKelurahan || r.kodePosPten}|${r.kelurahan}|${r.kecamatan}|${r.groupKota || r.kotaPten}|${r.sandiCabang}|${r.namaOutlet}|${r.branchCode}`;
const cacheRecFase2 = new WeakMap<
  ReturnType<typeof buildMasterProximityIndex>,
  Map<string, RecommendationResult | null>
>();

export const AnalystResultsGrid: React.FC<AnalystResultsGridProps> = ({
  rows,
  onUpdateRow,
  onApproveSingleRow,
  onApproveAllFinal,
  onApproveFase,
  onBersihkanManual,
  onPatchMassal,
  filterBelumSetuju = null,
  onResetBelumSetuju,
  onReRunAll,
  onReRunAnomaliesOnly,
  isProcessing,
  wilayahSettings,
  coverage,
  ptenList = [],
  kodePosRows = [],
  cityOverrides = {},
  onApproveCityOverride,
  onRemoveCityOverride,
  masterRows = [],
  roleMappingList = [],
  onBukaMasterCabang,
}) => {
  const { add: notify } = useNotification();
  // A6: tampilan (tab/filter/cari/urut/halaman) bertahan saat pindah menu — komponen ini
  // di-unmount oleh App saat tab lain aktif. Pilihan kandidat (fase2Choice/fase3RoleChoice)
  // sengaja TIDAK disimpan: kuncinya `id` baris yang berubah tiap kali analisa dijalankan.
  const [activeSubTab, setActiveSubTab] = useTampilanTersimpan<'all' | 'fase1' | 'fase2' | 'fase3'>('tampilan.analyst.subTab', 'fase1');
  const [selectedWilayah, setSelectedWilayah] = useTampilanTersimpan<string>('tampilan.analyst.wilayah', 'ALL');
  const [searchTerm, setSearchTerm] = useTampilanTersimpan<string>('tampilan.analyst.cari', '');
  // Pencarian 83 ribu baris: biarkan input langsung, saring di nilai tertunda
  const deferredSearch = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useTampilanTersimpan<'ALL' | 'ANOMALI' | 'EXACT_MATCH' | 'HIGH_CONFIDENCE' | 'PENEMPATAN_REVIEW'>('tampilan.analyst.status', 'ALL');
  // Inner tab pada tiap fase: hasil mesin yang siap disetujui vs yang masih butuh
  // kerja operator. Satu state untuk semua fase — hanya labelnya yang berbeda.
  const [innerTab, setInnerTab] = useTampilanTersimpan<'BERES' | 'MANUAL'>('tampilan.analyst.innerTab', 'BERES');
  // Urutan kolom — dikerjakan lokal karena seluruh baris fase ini sudah ada di memori.
  const [sortKolom, setSortKolom] = useTampilanTersimpan<SortKolom | null>('tampilan.analyst.sortKolom', null);
  const [sortDir, setSortDir] = useTampilanTersimpan<'asc' | 'desc'>('tampilan.analyst.sortDir', 'asc');
  // Pilihan kandidat aktif per baris (rank 1-3) + modal detail kandidat
  const [fase2Choice, setFase2Choice] = useState<Record<string, number>>({});
  const [fase2Detail, setFase2Detail] = useState<{
    row: AnalystRow;
    target: TargetRow;
    rec: RecommendationResult;
    chosen: CandidateOption;
  } | null>(null);
  // Pilihan role mapping per baris Fase 3 (index kandidat 0-2)
  const [fase3RoleChoice, setFase3RoleChoice] = useState<Record<string, number>>({});

  // Dialog konfirmasi sebelum menyetujui tiap fase / final analisa
  const [confirmKind, setConfirmKind] = useState<null | 'fase1' | 'fase2' | 'fase3' | 'final'>(null);
  // Konfirmasi "Revisi ke Perlu Analisa Manual" per baris (menggantikan window.confirm).
  const [confirmManualRow, setConfirmManualRow] = useState<AnalystRow | null>(null);
  // Jendela "Detail" per baris (tab Data Final) — baca saja, tidak mengubah data.
  const [detailRow, setDetailRow] = useState<AnalystRow | null>(null);
  // N3: pilihan massal. Disimpan bersama kunci tab-nya di sessionStorage supaya bertahan
  // saat komponen ini di-unmount (pindah menu, pola A6) TETAPI otomatis kosong begitu
  // operator pindah tab fase atau tab Berhasil/Manual — lihat `kunciTab` di blok N3.
  const [pilihan, setPilihan] = useState<{ tab: string; ids: string[] }>(() => {
    try {
      const tersimpan = sessionStorage.getItem('tampilan.analyst.terpilih');
      const nilai = tersimpan ? JSON.parse(tersimpan) : null;
      return nilai && typeof nilai.tab === 'string' && Array.isArray(nilai.ids)
        ? { tab: nilai.tab, ids: nilai.ids.map(String) }
        : { tab: '', ids: [] };
    } catch {
      return { tab: '', ids: [] };
    }
  });
  const [konfirmasiRevisiMassal, setKonfirmasiRevisiMassal] = useState(false);

  // Pagination states
  const [page, setPage] = useTampilanTersimpan<number>('tampilan.analyst.page', 1);
  const [pageSize, setPageSize] = useTampilanTersimpan<number | 'ALL'>('tampilan.analyst.pageSize', 15);

  // Pemetaan kota manual (laporan cakupan): pilihan sementara per kota + modal konfirmasi
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});
  const [overrideModal, setOverrideModal] = useState<{
    masterCity: string;
    masterRows: KodePosRow[];
    ptenKota: string;
    ptenKodePos: string[];
  } | null>(null);

  // Daftar nama kota unik di PTEN untuk dropdown pemetaan manual
  const ptenKotaOptions = useMemo(() => {
    const set = new Set<string>();
    ptenList.forEach((p) => {
      const k = String(p.kotaPten || '').trim();
      if (k) set.add(k);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));
  }, [ptenList]);

  // Nama kota ASLI dari Data KodePos, dipakai HANYA untuk tampilan kolom pembanding di
  // tab Fase 1 (baris hasil analisa tidak menyimpannya). Kunci: kode pos + kelurahan.
  const namaKotaKodePos = useMemo(() => {
    const m = new Map<string, string>();
    kodePosRows.forEach((r) => {
      const kel = cleanKelurahan(r.kelurahan || '');
      if (!m.has(`${r.kodePos}|${kel}`)) m.set(`${r.kodePos}|${kel}`, r.kabupatenKota || '');
    });
    return m;
  }, [kodePosRows]);
  const kotaKodePosDari = (r: AnalystRow) =>
    namaKotaKodePos.get(`${r.kodePosKelurahan}|${cleanKelurahan(r.kelurahan || '')}`) ||
    namaKotaKodePos.get(`${r.kodePosPten}|${cleanKelurahan(r.kelurahan || '')}`) ||
    '';

  const cityRowSummary = useMemo(() => {
    const m = new Map<string, { name: string; kodePos: string; provinsi: string; count: number }>();
    kodePosRows.forEach((r) => {
      const k = cityMatchKey(r.kabupatenKota);
      if (!k) return;
      const s = m.get(k);
      if (s) s.count++;
      else m.set(k, { name: r.kabupatenKota, kodePos: r.kodePos, provinsi: r.provinsi, count: 1 });
    });
    return m;
  }, [kodePosRows]);

  // Baris master milik 1 kota (dipakai modal pratinjau — persis yang akan berpindah)
  const masterRowsForCity = (cityRaw: string): KodePosRow[] => {
    const key = cityMatchKey(cityRaw);
    return kodePosRows.filter((r) => cityMatchKey(r.kabupatenKota) === key);
  };

  // ── FASE 2: 3 rekomendasi outlet terdekat (engine lama recommender.ts, dipakai ulang) ──
  const masterIndex = useMemo(
    () => (masterRows.length > 0 ? buildMasterProximityIndex(masterRows) : null),
    [masterRows]
  );
  // Proyeksi baris hasil analisa → bentuk TargetRow (dipakai recommender & role engine lama)
  const targetFromAnalystRow = (r: AnalystRow): TargetRow => ({
    No: r.no,
    Wilayah: r.wilayah,
    'Sandi Cabang': r.sandiCabang,
    'Branch Code': r.branchCode,
    'Kode Cabang': r.kodeCabang,
    'Nama Outlet': r.namaOutlet,
    'Status Outlet': r.statusOutlet,
    'KODE POS': r.kodePosKelurahan || r.kodePosPten,
    Kelurahan: r.kelurahan,
    Kecamatan: r.kecamatan,
    'Dati II': r.groupKota,
    'Kode Dati II': '',
    Provinsi: r.provinsi,
    // ALAMAT sengaja tidak ikut: nilai itu adalah alamat cabang yang SEDANG terpasang,
    // kalau dikirim mesin akan menganggapnya "satu jalur" dengan dirinya sendiri.
    ALAMAT: '',
    _originalFilledSandiCabang: r.sandiCabang,
    _originalFilledNamaOutlet: r.namaOutlet,
  } as unknown as TargetRow);

  const applyFase2Candidate = (r: AnalystRow, master: MasterRow) => {
    const branchCode = String(master['Branch Code'] || master['Kode Cabang'] || '').trim();
    const resolved = extractWilayahFromBranchCode(branchCode, wilayahSettings, r.wilayah || master.Wilayah || '');
    const finalWilayah = resolved.wilayahName && resolved.wilayahName !== '-' ? resolved.wilayahName : (master.Wilayah || r.wilayah || '');
    const sandiCabang = String(
      master['Sandi Cabang'] ||
        (master.Sandi && master.Cabang ? `${master.Sandi} - ${master.Cabang}` : master.Cabang || master.Sandi || r.sandiCabang)
    );
    const namaOutlet = String(master['Nama Outlet'] || master.Cabang || r.namaOutlet);
    const role = matchRoleForOutlet(master, targetFromAnalystRow(r), roleMappingList, masterRows);
    onUpdateRow({
      ...r,
      wilayah: finalWilayah || r.wilayah,
      sandiCabang,
      branchCode,
      kodeCabang: String(master['Kode Cabang'] || branchCode),
      namaOutlet,
      statusOutlet: String(master['Status Outlet'] || r.statusOutlet || 'Aktif'),
      alamat: String(master.ALAMAT || r.alamat),
      fase2Temuan: [],
      fase2Status: 'OTOMATIS_VALID',
      fase2Sumber: 'PILIHAN_OPERATOR',
      ...role,
      isFinalApproved: role.statusAnalisa === 'EXACT_MATCH' ? r.isFinalApproved : false,
      editedManually: true,
    });
    showToast(`Baris #${r.no}: outlet diganti ke ${namaOutlet} — wilayah & role dihitung ulang`);
  };

  // ── FASE 3: rekomendasi mapping role 3-cabang-terdekat (engine lama, strict 1 pulau) ──
  const masterByBranchCode = useMemo(() => {
    const mp = new Map<string, MasterRow>();
    masterRows.forEach((m) => {
      const bc = String(m['Branch Code'] || m['Kode Cabang'] || '').trim();
      if (bc && !mp.has(bc)) mp.set(bc, m);
    });
    return mp;
  }, [masterRows]);

  const applyFase3Role = (r: AnalystRow, rec: RoleMappingRecord) => {
    const isKc = getUnitCategory(rec.organisasiTujuan) === 'KC';
    const tipeUnit: 'KC' | 'KCP' = isKc ? 'KC' : 'KCP';
    const roleCabsal = rec.qrsCabsal ?? 0;
    const roleCabapv1 = rec.qrsCabapv1 ?? 0;
    const roleCabapv2 = rec.qrsCabapv2 ?? 0;
    const is3RoleLengkap = roleCabsal === 1 && roleCabapv1 === 1 && roleCabapv2 === 1;
    const wondr = getWondrRecommendation(rec);
    onUpdateRow({
      ...r,
      organisasiTujuan: rec.organisasiTujuan,
      tipeUnit,
      roleCabsal,
      roleCabapv1,
      roleCabapv2,
      roleGrandTotal: rec.grandTotal ?? roleCabsal + roleCabapv1 + roleCabapv2,
      is3RoleLengkap,
      alurWondr: wondr?.tier || (is3RoleLengkap ? 'Tier 1: Full Approval KC' : 'Tier 2: Dual Approval KCP via KC'),
      flowDescription: wondr?.desc || r.flowDescription,
      confidenceScore: 100,
      matchingAlgorithm: 'Manual Role Selection (Terdekat, 1 Pulau)',
      // D6: pilihan manual bukan temuan mesin — jangan catat sebagai EXACT_MATCH,
      // kalau tidak akurasi mesin ikut naik oleh keputusan manusia dan barisnya
      // lolos ke Final tanpa pernah diperiksa.
      statusAnalisa: 'HIGH_CONFIDENCE',
      isFinalApproved: false,
      editedManually: true,
    });
    showToast(`Baris #${r.no}: role dipasang ke ${rec.organisasiTujuan}`);
  };

  const openOverrideModal = (masterCity: string) => {
    const k = cityMatchKey(masterCity);
    const ptenKota = overrideDrafts[k] || cityOverrides[k];
    if (!ptenKota || !onApproveCityOverride) return;
    const ptenKodePos = Array.from(
      new Set(ptenList.filter((p) => p.kotaPten === ptenKota).map((p) => String(p.kodePosPten || '').trim()).filter(Boolean))
    );
    setOverrideModal({ masterCity, masterRows: masterRowsForCity(masterCity), ptenKota, ptenKodePos });
  };


  // Notifikasi grid dialirkan ke provider global (A1) — tidak ada lagi `setTimeout`
  // tanpa cleanup dan banner yang menempati ruang kerja operator.
  const showToast = (message: string, type: 'success' | 'info' = 'success') => notify(message, type);

  // Jalankan aksi setujui setelah operator mengonfirmasi dialog
  const handleConfirmApprove = () => {
    if (confirmKind === 'fase1') {
      onApproveFase(1);
      setActiveSubTab('fase2');
      showToast('Fase 1 disetujui — Fase 2 (Wilayah & Cabang) kini terbuka untuk direview!');
    } else if (confirmKind === 'fase2') {
      onApproveFase(2);
      setActiveSubTab('fase3');
      showToast('Fase 2 disetujui — Fase 3 (Mapping Role & Wondr) kini terbuka untuk direview!');
    } else if (confirmKind === 'fase3') {
      onApproveFase(3);
      setActiveSubTab('all');
      showToast('Fase 3 disetujui — Data Final kini terbuka!');
    } else if (confirmKind === 'final') {
      onApproveAllFinal();
    }
    setConfirmKind(null);
  };

  // ── HIGH-PERFORMANCE SINGLE-PASS STAGE PARTITIONING & ANALYTICS O(N) ──
  // Mengelompokkan seluruh dataset dalam 1 pass tunggal untuk menghilangkan loop berulang
  // (sebelumnya ada 5x full scans atas 83.000 data per render).
  const rowAnalytics = useMemo(() => {
    const stageBuckets: Record<1 | 2 | 3 | 4, { beres: AnalystRow[]; manual: AnalystRow[]; all: AnalystRow[] }> = {
      1: { beres: [], manual: [], all: [] },
      2: { beres: [], manual: [], all: [] },
      3: { beres: [], manual: [], all: [] },
      4: { beres: [], manual: [], all: [] },
    };
    const wilayahSet = new Set<string>();

    let total = 0;
    let exact = 0;
    let highConf = 0;
    let anomalies = 0;
    let perluReview = 0;
    let anomali = 0;
    let placementReview = 0;
    let placementVerified = 0;
    let approved = 0;
    let role3Complete = 0;
    let f1ApprovedCount = 0;
    let f2ApprovedCount = 0;
    let f3ApprovedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const isTidakAnalisa = r.kategori === 'TIDAK_ANALISA';
      if (r.wilayah) wilayahSet.add(r.wilayah);

      // Stage calculation
      let stage: 1 | 2 | 3 | 4 = 4;
      if (isTidakAnalisa || !r.fase1Approved) stage = 1;
      else if (!r.fase2Approved) stage = 2;
      else if (!r.fase3Approved) stage = 3;

      // Is manual needed calculation
      let isManual = !!r.perluManual;
      if (!isManual) {
        if (stage === 1) isManual = isTidakAnalisa;
        else if (stage === 2) isManual = r.fase2Status === 'PERLU_MANUAL';
        else if (stage === 3) isManual = r.statusAnalisa === 'PERLU_REVIEW' || r.statusAnalisa === 'ANOMALI';
      }

      const bucket = stageBuckets[stage];
      bucket.all.push(r);
      if (isManual) {
        bucket.manual.push(r);
      } else {
        bucket.beres.push(r);
      }

      if (!isTidakAnalisa) {
        total++;
        if (r.fase1Approved) f1ApprovedCount++;
        if (r.fase2Approved) f2ApprovedCount++;
        if (r.fase3Approved) f3ApprovedCount++;

        if (r.statusAnalisa === 'EXACT_MATCH') exact++;
        else if (r.statusAnalisa === 'HIGH_CONFIDENCE') highConf++;
        else if (r.statusAnalisa === 'PERLU_REVIEW') {
          perluReview++;
          anomalies++;
        } else if (r.statusAnalisa === 'ANOMALI') {
          anomali++;
          anomalies++;
        }

        if (r.placementStatus === 'VERIFIED') placementVerified++;
        else placementReview++;

        if (r.isFinalApproved) approved++;
        if (r.is3RoleLengkap) role3Complete++;
      }
    }

    const dinilai = exact + highConf + anomalies;
    const accuracyRate = dinilai > 0 ? (((exact + highConf) / dinilai) * 100).toFixed(1) : '0';
    const isAllApproved = total > 0 && approved === total;

    const queue = {
      fase1: stageBuckets[1].all.length,
      fase2: stageBuckets[2].all.length,
      fase3: stageBuckets[3].all.length,
      all: stageBuckets[4].all.length,
    };
    const step: 1 | 2 | 3 | 4 = queue.fase1 > 0 ? 1 : queue.fase2 > 0 ? 2 : queue.fase3 > 0 ? 3 : 4;

    const sortedWilayah = Array.from(wilayahSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    return {
      stageBuckets,
      wilayahList: sortedWilayah,
      stats: {
        total,
        unanalysed: rows.length - total,
        exact,
        highConf,
        anomalies,
        perluReview,
        anomali,
        placementReview,
        placementVerified,
        approved,
        role3Complete,
        accuracyRate,
        isAllApproved,
      },
      phaseState: {
        fase1Done: total > 0 && f1ApprovedCount === total,
        fase2Done: total > 0 && f2ApprovedCount === total,
        fase3Done: total > 0 && f3ApprovedCount === total,
        queue,
        step,
        locked: {
          fase1: queue.fase1 === 0,
          fase2: queue.fase2 === 0,
          fase3: queue.fase3 === 0,
          all: queue.all === 0,
        } as Record<'all' | 'fase1' | 'fase2' | 'fase3', boolean>,
      },
    };
  }, [rows]);

  const { wilayahList, stats, phaseState, stageBuckets } = rowAnalytics;

  // Tab aktif mengikuti fase yang sedang punya antrean kerja
  const viewTab = phaseState.locked[activeSubTab]
    ? (['fase1', 'fase2', 'fase3', 'all'][phaseState.step - 1] as 'all' | 'fase1' | 'fase2' | 'fase3')
    : activeSubTab;

  const stageTab: 1 | 2 | 3 | 4 = viewTab === 'fase1' ? 1 : viewTab === 'fase2' ? 2 : viewTab === 'fase3' ? 3 : 4;

  // Jumlah per inner tab pada fase yang sedang dibuka (instan O(1) dari stageBuckets)
  const hitunganInner = useMemo(() => {
    const b = stageBuckets[stageTab];
    return { manual: b.manual.length, beres: b.beres.length };
  }, [stageBuckets, stageTab]);

  // Filtered rows (Hanya memproses subset stage yang aktif — 10x-20x lebih cepat)
  const filteredRows = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const sourceRows = filterBelumSetuju
      ? rows
      : innerTab === 'MANUAL'
        ? stageBuckets[stageTab].manual
        : stageBuckets[stageTab].beres;

    const hasil = sourceRows.filter((r) => {
      if (filterBelumSetuju) {
        if (r.kategori === 'TIDAK_ANALISA') return false;
        const sudah =
          filterBelumSetuju === 1 ? r.fase1Approved : filterBelumSetuju === 2 ? r.fase2Approved : r.fase3Approved;
        return !sudah;
      }

      if (r.kategori !== 'TIDAK_ANALISA' && selectedWilayah !== 'ALL' && r.wilayah !== selectedWilayah) return false;
      if (statusFilter === 'ANOMALI' && r.statusAnalisa !== 'ANOMALI' && r.statusAnalisa !== 'PERLU_REVIEW') return false;
      if (statusFilter === 'EXACT_MATCH' && r.statusAnalisa !== 'EXACT_MATCH') return false;
      if (statusFilter === 'HIGH_CONFIDENCE' && r.statusAnalisa !== 'HIGH_CONFIDENCE') return false;
      if (statusFilter === 'PENEMPATAN_REVIEW' && r.placementStatus === 'VERIFIED') return false;

      if (q) {
        const match =
          String(r.no).includes(q) ||
          r.kotaPten?.toLowerCase().includes(q) ||
          r.groupKota?.toLowerCase().includes(q) ||
          r.provinsi?.toLowerCase().includes(q) ||
          r.kodePosPten?.includes(q) ||
          r.kodePosKelurahan?.includes(q) ||
          r.kelurahan?.toLowerCase().includes(q) ||
          r.kecamatan?.toLowerCase().includes(q) ||
          r.wilayah?.toLowerCase().includes(q) ||
          r.sandiCabang?.toLowerCase().includes(q) ||
          r.branchCode?.toLowerCase().includes(q) ||
          r.namaOutlet?.toLowerCase().includes(q) ||
          r.organisasiTujuan?.toLowerCase().includes(q) ||
          r.alamat?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
    return terapkanSort(hasil, sortKolom, sortDir);
  }, [rows, stageBuckets, stageTab, innerTab, selectedWilayah, statusFilter, deferredSearch, sortKolom, sortDir, filterBelumSetuju]);

  const toggleSort = (kolom: SortKolom) => {
    if (sortKolom === kolom) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKolom(kolom);
      setSortDir('asc');
    }
    setPage(1);
  };

  /** Header yang bisa diklik: ⇅ belum dipilih, ▲/▼ sedang mengurutkan kolom ini. */
  const thSort = (
    kolom: SortKolom,
    label: string,
    gaya?: React.CSSProperties,
    attrs?: { rowSpan?: number; colSpan?: number }
  ) => {
    const aktif = sortKolom === kolom;
    return (
      <th
        {...attrs}
        style={{ ...gaya, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => toggleSort(kolom)}
        aria-sort={aktif ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        title={`Urutkan berdasar ${label}`}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem' }}>
          {label}
          <span style={{ fontSize: '0.66rem', color: aktif ? '#405189' : '#adb5bd' }}>
            {aktif ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </span>
      </th>
    );
  };

  // Pagination calculation
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    if (pageSize === 'ALL') return filteredRows;
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Windowing: "Semua" pada puluhan ribu baris hanya boleh memasukkan baris
  // yang terlihat ke DOM, sisanya diwakili dua <tr> spacer.
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  // Tab Fase 2/3 menampilkan KARTU kandidat (tinggi tak seragam).
  // Windowing diaktifkan mulai dari 20 baris agar DOM selalu ringan dan responsif.
  const tabKartu = activeSubTab === 'fase2' || activeSubTab === 'fase3';
  const win = useVirtualWindow({
    containerRef: tableScrollRef,
    itemCount: paginatedRows.length,
    minRowsToWindow: tabKartu ? 20 : 50,
    fallbackRowHeight: tabKartu ? 180 : 44,
    overscan: tabKartu ? 6 : 8,
  });
  const renderedRows = win.active ? paginatedRows.slice(win.start, win.end) : paginatedRows;
  const rowOffset = win.active ? win.start : 0;

  // ── N3: pilihan & aksi massal ──────────────────────────────────────────────
  // "Pilih semua" = baris pada HALAMAN yang sedang tampil (sudah lewat filter,
  // pencarian, dan paginasi) — bukan seluruh isi database, supaya aksi massal tidak
  // diam-diam menyentuh puluhan ribu baris yang tidak dilihat operator.
  const kunciTab = `${viewTab}|${innerTab}`;
  const terpilih = useMemo(
    () => (pilihan.tab === kunciTab ? new Set(pilihan.ids) : new Set<string>()),
    [pilihan, kunciTab]
  );
  const simpanPilihan = (ids: string[]) => {
    const nilai = { tab: kunciTab, ids };
    setPilihan(nilai);
    try {
      sessionStorage.setItem('tampilan.analyst.terpilih', JSON.stringify(nilai));
    } catch {
      /* mode privat penuh/diblokir: pilihan tetap jalan selama menu ini terbuka */
    }
  };
  const toggleTerpilih = (id: string) => {
    const baru = new Set(terpilih);
    if (baru.has(id)) baru.delete(id);
    else baru.add(id);
    simpanPilihan(Array.from(baru));
  };
  const semuaHalamanTerpilih =
    paginatedRows.length > 0 && paginatedRows.every((r) => terpilih.has(r.id));
  const gantiPilihanSemua = () =>
    simpanPilihan(semuaHalamanTerpilih ? [] : paginatedRows.map((r) => r.id));
  // Aksi massal hanya memakai id yang memang ada di halaman ini; pilihan dari tab atau
  // halaman lain diabaikan, jadi tidak perlu efek pembersih dan tidak ada risiko aksi
  // menyasar baris yang tidak dilihat operator.
  const barisTerpilih = useMemo(
    () => paginatedRows.filter((r) => terpilih.has(r.id)),
    [paginatedRows, terpilih]
  );

  // Kolom yang disetujui harus sama persis dengan tombol per baris di tab ini.
  const setujuiTerpilih = () => {
    const ids = barisTerpilih.map((r) => r.id);
    if (innerTab === 'MANUAL') {
      // Sama dengan tombol per baris di tab manual: "setujui" = beres, baris pindah ke
      // tab Berhasil Dianalisa; persetujuan fase masih langkah terpisah.
      onBersihkanManual(ids);
      setInnerTab('BERES');
      setPage(1);
      showToast(`${ids.length.toLocaleString('id-ID')} baris ditandai selesai — cek di tab sebelah kiri, lalu "Setujui Fase".`, 'info');
    } else {
      const patch: Partial<AnalystRow> =
        viewTab === 'fase1' ? { fase1Approved: true }
        : viewTab === 'fase2' ? { fase2Approved: true }
        : viewTab === 'fase3' ? { fase3Approved: true }
        : { isFinalApproved: true };
      onPatchMassal(ids, patch);
      showToast(`${ids.length.toLocaleString('id-ID')} baris terpilih disetujui untuk fase ini.`);
    }
    simpanPilihan([]);
  };
  const revisiTerpilih = () => {
    const ids = barisTerpilih.map((r) => r.id);
    onPatchMassal(ids, { perluManual: true });
    showToast(`${ids.length.toLocaleString('id-ID')} baris dikembalikan ke antrean manual.`);
    setKonfirmasiRevisiMassal(false);
    simpanPilihan([]);
  };
  // Kota berbeda di antara baris terpilih. Override kota berlaku untuk SELURUH kelurahan
  // satu kota (memang begitu mesinnya), jadi modal dibuka untuk kota pertama — sisanya
  // harus dipilih ulang satu per satu, dan itu dinyatakan lewat label tombol + toast ini.
  const kotaTerpilih = useMemo(
    () => Array.from(new Set(barisTerpilih.map((r) => (r.groupKota || r.kotaPten || '').trim()).filter(Boolean))),
    [barisTerpilih]
  );
  const gantiKotaTerpilih = () => {
    const masterCity = kotaTerpilih[0] || '';
    if (!masterCity) {
      showToast('Baris terpilih belum punya nama kota master — tidak ada yang bisa diganti.');
      return;
    }
    const barisKotaIni = barisTerpilih.filter((r) => (r.groupKota || r.kotaPten || '').trim() === masterCity);
    const k = cityMatchKey(masterCity);
    const ptenKota = overrideDrafts[k] || cityOverrides[k] || barisKotaIni[0]?.kotaPten || masterCity;
    const ptenKodePos = Array.from(
      new Set(ptenList.filter((p) => p.kotaPten === ptenKota).map((p) => String(p.kodePosPten || '').trim()).filter(Boolean))
    );
    setOverrideModal({ masterCity, masterRows: masterRowsForCity(masterCity), ptenKota, ptenKodePos });
    if (kotaTerpilih.length > 1) {
      showToast(`Modal terbuka untuk ${masterCity} (${barisKotaIni.length} baris). ${kotaTerpilih.length - 1} kota lain di pilihan ini perlu diganti satu per satu.`, 'info');
    }
  };

  // C2d: kandidat Fase 2 dihitung PER BARIS (kelurahan), bukan per kota — dulu satu kota
  // = satu daftar kandidat sehingga semua kelurahan di kota itu melihat cabang yang sama.
  const fase2Recs = useMemo(() => {
    const m = new Map<string, { rec: RecommendationResult | null; target: TargetRow }>();
    if (!masterIndex) return m;
    let cache = cacheRecFase2.get(masterIndex);
    if (!cache) {
      cache = new Map();
      cacheRecFase2.set(masterIndex, cache);
    }
    renderedRows.forEach((r) => {
      if (r.kategori === 'TIDAK_ANALISA') return;
      const target = targetFromAnalystRow(r);
      const kunci = kunciFase2(r);
      let rec: RecommendationResult | null | undefined = cache.get(kunci);
      if (rec === undefined) {
        try {
          rec = findClosestMasterRecommendation(target, masterIndex);
        } catch {
          rec = null;
        }
        cache.set(kunci, rec);
      }
      m.set(r.id, { rec, target });
    });
    return m;
  }, [renderedRows, masterIndex]);

  // ── Kolom Fase 2 diisi dari kandidat AKTIF baris itu ─────────────────────────
  // Run Fase 2 atas puluhan ribu baris butuh menitan; selama run itu belum selesai
  // (atau tab di-reload di tengah jalan) field baris masih kosong padahal kartunya
  // sudah menampilkan Pilihan 1. Kolom dibaca dari kandidat yang sama, memakai
  // rumus tulis yang sama (`paketFase2DariMaster`), jadi layar dan berkas bicara
  // bahasa yang sama dan operator tidak perlu menekan "Gunakan Cabang Ini".
  const f2Aktif = useMemo(() => {
    const map = new Map<string, ReturnType<typeof paketFase2DariMaster>>();
    if (!masterIndex) return map;
    renderedRows.forEach((r) => {
      if (r.kategori === 'TIDAK_ANALISA') return;
      const entry = fase2Recs.get(r.id);
      const cands = entry?.rec?.candidates || [];
      if (!cands.length) return;
      const audit = entry!.rec!.userPrefilledAudit;
      const rankAktif =
        fase2Choice[r.id] || (audit?.matchedRank && audit.matchedRank <= 3 ? audit.matchedRank : 1);
      const cand = cands.find((c) => c.rank === rankAktif) || cands[0];
      map.set(r.id, paketFase2DariMaster(cand.master, wilayahSettings));
    });
    return map;
  }, [renderedRows, fase2Recs, fase2Choice, wilayahSettings, masterIndex]);

  // Pre-computed Role Matches untuk baris aktif Fase 3 (menjamin 60 FPS saat scrolling di Fase 3)
  const fase3TopRolesMap = useMemo(() => {
    const map = new Map<string, RoleMatchScored[]>();
    if (viewTab !== 'fase3' || !renderedRows.length || !roleMappingList.length) return map;
    renderedRows.forEach((r) => {
      const activeBranchCode = r.branchCode || f2Aktif.get(r.id)?.branchCode || '';
      const activeMaster = masterByBranchCode.get(String(activeBranchCode).trim());
      const topRoles = findTopRoleMatchesByLocation(activeMaster, targetFromAnalystRow(r), roleMappingList, masterRows, 3);
      map.set(r.id, topRoles);
    });
    return map;
  }, [renderedRows, viewTab, f2Aktif, masterByBranchCode, roleMappingList, masterRows]);

  useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0 });
  }, [page, pageSize, selectedWilayah, statusFilter, viewTab, innerTab, sortKolom, sortDir, deferredSearch]);

  // Export Multi-Sheet per Wilayah (W01 - W17)
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Group rows by Wilayah (hanya hasil analisa; baris "TIDAK_ANALISA" bukan keluaran engine)
      const wilayahMap = new Map<string, AnalystRow[]>();
      rows.filter((r) => r.kategori !== 'TIDAK_ANALISA').forEach((r) => {
        const wKey = formatWilayahCode(r.wilayah || 'W01');
        if (!wilayahMap.has(wKey)) wilayahMap.set(wKey, []);
        wilayahMap.get(wKey)!.push(r);
      });

      // Sort sheet keys W01, W02, ...
      const sortedKeys = Array.from(wilayahMap.keys()).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      sortedKeys.forEach((wKey) => {
        const groupRows = wilayahMap.get(wKey)!;
        const exportData = groupRows.map((r, idx) => ({
          'No': idx + 1,
          'Wilayah': r.wilayah,
          'Sandi Cabang': r.sandiCabang,
          'Branch Code': r.branchCode,
          'Kode Cabang': r.kodeCabang,
          'Nama Outlet': r.namaOutlet,
          'Status Outlet': r.statusOutlet,
          'ALAMAT': r.alamat,
          'KODE POS': r.kodePosKelurahan || r.kodePosPten,
          'Kelurahan': r.kelurahan,
          'Kecamatan': r.kecamatan,
          'Dati II': r.kotaPtenMax15 || r.kotaPten,
          'Provinsi': r.provinsi,
          'KOTA PTEN': r.kotaPtenMax15 || r.kotaPten,
          'KODE POS PTEN': r.kodePosPten,
          // `CEK KODE POS + PTEN` membandingkan tingkat KOTA, bukan kode pos kelurahan di atas
          'CEK KODE POS + PTEN': r.statusPten,
          'VERIFIKASI PENEMPATAN': r.placementStatus === 'VERIFIED' ? 'TERVERIFIKASI' : r.placementStatus === 'REVIEW' ? 'PERLU REVIEW' : 'FALLBACK',
          'METODE PENEMPATAN': r.placementMethod,
          'ORGANISASI TUJUAN': r.organisasiTujuan,
          'Tipe Unit': r.tipeUnit,
          'Alur Wondr': r.alurWondr,
          'QRS_CABSAL': r.roleCabsal,
          'QRS_CABAPV1': r.roleCabapv1,
          'QRS_CABAPV2': r.roleCabapv2,
          'Grand Total': r.roleGrandTotal,
          'Status Analisa': r.isFinalApproved ? 'VERIFIED' : r.statusAnalisa,
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        applyStandardSheetStyle(ws, Object.keys(exportData[0] || {}), exportData.length);
        XLSX.utils.book_append_sheet(wb, ws, wKey);
      });

      // Sheet Summary All
      const allExport = rows.filter((r) => r.kategori !== 'TIDAK_ANALISA').map((r, idx) => ({
        'No': idx + 1,
        'Wilayah': r.wilayah,
        'Sandi Cabang': r.sandiCabang,
        'Branch Code': r.branchCode,
        'Kode Cabang': r.kodeCabang,
        'Nama Outlet': r.namaOutlet,
        'Status Outlet': r.statusOutlet,
        'ALAMAT': r.alamat,
        'KODE POS': r.kodePosKelurahan || r.kodePosPten,
        'Kelurahan': r.kelurahan,
        'Kecamatan': r.kecamatan,
        'Dati II': r.kotaPtenMax15 || r.kotaPten,
        'Provinsi': r.provinsi,
        'KODE POS PTEN': r.kodePosPten,
        'ORGANISASI TUJUAN': r.organisasiTujuan,
        'Tipe Unit': r.tipeUnit,
        'Alur Wondr': r.alurWondr,
      }));
      const wsAll = XLSX.utils.json_to_sheet(allExport);
      applyStandardSheetStyle(wsAll, Object.keys(allExport[0] || {}), allExport.length);
      XLSX.utils.book_append_sheet(wb, wsAll, 'SEMUA_DATA');

      XLSX.writeFile(wb, `Laporan_Final_Data_Analyst_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`Berhasil mengunduh ${rows.length.toLocaleString('id-ID')} baris data ke Excel Multi-Sheet!`);
    } catch (e: any) {
      notify('Gagal mengekspor berkas Excel: ' + e.message, 'error');
    }
  };

  const handleExportPdf = () => {
    const result = exportAnalystExecutivePdf({ rows, stats: { total: stats.total, exact: stats.exact, highConf: stats.highConf, anomalies: stats.anomalies, approved: stats.approved, role3Complete: stats.role3Complete, accuracyRate: stats.accuracyRate }, wilayahCount: wilayahList.length });
    if (result.success) {
      showToast(`Berhasil mengunduh laporan PDF: ${result.filename}`);
    } else {
      notify('Gagal membuat dokumen PDF: ' + result.error, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* B1: "KOTA X" + "KABUPATEN X" sengaja satu grup — dilaporkan, tidak dibiar diam */}
      {(coverage?.mergedCities?.length || 0) > 0 && (
        <details style={{ background: '#fff8ec', border: '1px solid #f2d9a8', borderRadius: '6px', padding: '0.6rem 1rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#8a5a00', fontSize: '0.86rem' }}>
            {coverage!.mergedCities.length} nama kota kembar digabung — kelurahan &ldquo;KOTA X&rdquo; dan
            &nbsp;&ldquo;KABUPATEN X&rdquo; masuk satu grup analisa
          </summary>
          <p style={{ fontSize: '0.78rem', color: '#6b5836', margin: '0.5rem 0' }}>
            Nama kota dibandingkan tanpa kata KOTA/KABUPATEN, jadi daerah dengan nama sama diperlakukan sebagai
            &nbsp;satu kota PTEN. Angka = jumlah baris kode pos pada grup itu (nama diambil dari versi Kabupaten):
          </p>
          <p style={{ fontSize: '0.76rem', color: '#6b5836', margin: '0 0 0.2rem', lineHeight: 1.7 }}>
            {coverage!.mergedCities.map((c) => (
              <span key={c.kabupaten} title={`${c.kota} + ${c.kabupaten}`} style={{ display: 'inline-block', marginRight: '0.85rem', whiteSpace: 'nowrap' }}>
                {c.kabupaten.replace(/^(KABUPATEN|KAB)\s+/i, '')} <strong>{c.rows.toLocaleString('id-ID')}</strong>
              </span>
            ))}
          </p>
        </details>
      )}

      {/* G3: Baris dilewati karena sudah ada di Final Data (Analisis Inkremental) */}
      {(coverage?.skippedFinalRows || 0) > 0 && (
        <details style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.6rem 1rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#166534', fontSize: '0.86rem' }}>
            {coverage!.skippedFinalRows.toLocaleString('id-ID')} baris dilewati — data kelurahan sudah berstatus Final (analisis inkremental)
          </summary>
          <p style={{ fontSize: '0.78rem', color: '#15803d', margin: '0.5rem 0' }}>
            Baris berikut tidak dianalisa ulang karena kombinasi kode pos &amp; kelurahan sudah masuk ke Data Final:
          </p>
          <p style={{ fontSize: '0.76rem', color: '#15803d', margin: '0 0 0.2rem', lineHeight: 1.7 }}>
            {coverage!.skippedFinalSamples?.slice(0, 15).map((s, idx) => (
              <span key={idx} style={{ display: 'inline-block', marginRight: '0.85rem', whiteSpace: 'nowrap' }}>
                {s.kelurahan} ({s.kodePos} - {s.kota})
              </span>
            ))}
            {(coverage!.skippedFinalSamples?.length || 0) > 15 && <span>...dan lainnya</span>}
          </p>
        </details>
      )}


      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1b. LAPORAN CAKUPAN KODEPOS → FASE 1 (kenapa jumlah bisa ≠ master)        */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {coverage && coverage.unmappedCities.length > 0 && (
        <details
          style={{ background: '#fff8ec', border: '1px solid #f2d9a8', borderRadius: '6px', padding: '0.75rem 1rem' }}
          open
        >
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#8a5a00', fontSize: '0.86rem' }}>
            Cakupan KodePos → Fase 1: {coverage.resultRows.toLocaleString('id-ID')} dari{' '}
            {coverage.kodePosTotal.toLocaleString('id-ID')} baris masuk ({coverage.unmappedCities.length} kota,{' '}
            {(coverage.kodePosTotal - coverage.kodePosMapped).toLocaleString('id-ID')} baris tidak masuk)
          </summary>
          <p style={{ fontSize: '0.78rem', color: '#6b5836', margin: '0.5rem 0' }}>
            Baris kodepos hanya masuk bila kotanya ada di data PTEN. Pilih kota PTEN yang cocok lalu klik Setujui —
            seluruh baris kota itu ikut dianalisa ulang.
          </p>
          <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #f0e2c2', borderRadius: '4px' }}>
            <table className="modern-table" style={{ width: '100%', fontSize: '0.75rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#fdf3e0' }}>
                <tr>
                  <th style={{ textAlign: 'left' }}>Kota / Kabupaten (di master KodePos)</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Kode Pos</th>
                  <th style={{ textAlign: 'left', width: '160px' }}>Provinsi</th>
                  <th style={{ textAlign: 'right', width: '70px' }}>Baris</th>
                  <th style={{ textAlign: 'left', minWidth: '320px' }}>Kota / Kabupaten (di PTEN)</th>
                </tr>
              </thead>
              <tbody>
                {coverage.unmappedCities.map((c) => {
                  const ck = cityMatchKey(c.city);
                  const draft = overrideDrafts[ck] || '';
                  return (
                    <tr key={c.city}>
                      <td style={{ fontWeight: 600 }}>{c.city}</td>
                      <td style={{ textAlign: 'center' }}>{c.sampleKodePos}</td>
                      <td>{c.provinsi}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.rows.toLocaleString('id-ID')}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <PtenCityPicker
                            options={ptenKotaOptions}
                            value={draft}
                            disabled={isProcessing || !onApproveCityOverride}
                            onChange={(kota) => setOverrideDrafts((prev) => ({ ...prev, [ck]: kota }))}
                          />
                          <button
                            type="button"
                            onClick={() => openOverrideModal(c.city)}
                            disabled={isProcessing || !draft || !onApproveCityOverride}
                            style={{
                              flexShrink: 0,
                              padding: '0.32rem 0.7rem',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              border: 'none',
                              borderRadius: '4px',
                              background: draft ? '#0ab39c' : '#d5dce8',
                              color: '#fff',
                              cursor: draft && !isProcessing ? 'pointer' : 'not-allowed',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Setujui
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Override yang sudah bekerja (kotanya kini terpetakan) tidak ditampilkan lagi
                    di sini — daftar ini khusus kota yang MASIH tidak ada padanannya di PTEN. */}
                {Object.entries(cityOverrides)
                  .filter(([key]) => coverage.unmappedCities.some((c) => cityMatchKey(c.city) === key))
                  .map(([key, ptenKota]) => {
                  const ringkas = cityRowSummary.get(key);
                  const masterName = ringkas?.name || key;
                  const draft = overrideDrafts[key] || ptenKota;
                  return (
                    <tr key={`ov-${key}`} style={{ background: '#f0faf7' }}>
                      <td style={{ fontWeight: 600 }}>
                        {masterName}
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.66rem', fontWeight: 700, color: '#0ab39c' }}>TERSIPAH</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{ringkas?.kodePos || ''}</td>
                      <td>{ringkas?.provinsi || ''}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{(ringkas?.count || 0).toLocaleString('id-ID')}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <PtenCityPicker
                            options={ptenKotaOptions}
                            value={draft}
                            disabled={isProcessing || !onApproveCityOverride}
                            onChange={(kota) => setOverrideDrafts((prev) => ({ ...prev, [key]: kota }))}
                          />
                          <button
                            type="button"
                            onClick={() => openOverrideModal(masterName)}
                            disabled={isProcessing || !draft || !onApproveCityOverride}
                            style={{
                              flexShrink: 0,
                              padding: '0.32rem 0.7rem',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              border: 'none',
                              borderRadius: '4px',
                              background: draft && draft !== ptenKota ? '#0ab39c' : '#405189',
                              color: '#fff',
                              cursor: draft && !isProcessing ? 'pointer' : 'not-allowed',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Revisi
                          </button>
                          {onRemoveCityOverride && (
                            <button
                              type="button"
                              onClick={() => !isProcessing && onRemoveCityOverride(key)}
                              disabled={isProcessing}
                              title="Batalkan pemetaan — kota kembali ke belum terpetakan"
                              style={{
                                flexShrink: 0,
                                padding: '0.32rem 0.55rem',
                                fontSize: '0.73rem',
                                border: '1px solid #d5dce8',
                                borderRadius: '4px',
                                background: '#fff',
                                color: '#878a99',
                                cursor: isProcessing ? 'wait' : 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Batalkan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. SMART ACTION CONTROLS & DECISION TOOLBAR                              */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          background: '#ffffff',
          border: '1px solid #e9ebec',
          borderRadius: '8px',
          padding: '0.9rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Left: Re-run & Approval Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onReRunAll}
            disabled={isProcessing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
            title="Jalankan ulang seluruh analisa 3 fase dari data master"
          >
            <RotateCcw size={13} />
            <span>Ulangi Analisa Total</span>
          </button>

          {stats.anomalies > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onReRunAnomaliesOnly}
              disabled={isProcessing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                fontSize: '0.78rem',
                color: '#f7b84b',
                borderColor: 'rgba(247, 184, 75, 0.4)',
                background: 'rgba(247, 184, 75, 0.06)',
              }}
              title="Hanya analisa ulang baris data yang belum cocok / anomali"
            >
              <Zap size={13} />
              <span>Ulangi yang Salah Saja ({stats.anomalies})</span>
            </button>
          )}

          <div style={{ display: 'inline-flex', gap: '0.25rem', borderLeft: '1px solid #e9ebec', paddingLeft: '0.55rem' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setConfirmKind('fase1')}
              disabled={isProcessing || phaseState.fase1Done}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.65rem', fontSize: '0.74rem', color: phaseState.fase1Done ? '#0ab39c' : '#299cdb', borderColor: phaseState.fase1Done ? 'rgba(10, 179, 156, 0.35)' : 'rgba(41, 156, 219, 0.3)' }}
              title={phaseState.fase1Done ? 'Fase 1 sudah disetujui' : 'Setujui seluruh hasil analisa Fase 1 dan buka Fase 2'}
            >
              {phaseState.fase1Done ? <Check size={12} /> : <MapPin size={12} />}
              <span>{phaseState.fase1Done ? 'Fase 1 Disetujui' : 'Setujui Fase 1'}</span>
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setConfirmKind('fase2')}
              disabled={isProcessing || !phaseState.fase1Done || phaseState.fase2Done}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.65rem', fontSize: '0.74rem', color: phaseState.fase2Done ? '#0ab39c' : !phaseState.fase1Done ? '#a2a7b0' : '#405189', borderColor: phaseState.fase2Done ? 'rgba(10, 179, 156, 0.35)' : 'rgba(64, 81, 137, 0.3)' }}
              title={phaseState.fase2Done ? 'Fase 2 sudah disetujui' : !phaseState.fase1Done ? 'Terkunci — setujui Fase 1 terlebih dahulu' : 'Setujui seluruh hasil analisa Fase 2 dan buka Fase 3'}
            >
              {phaseState.fase2Done ? <Check size={12} /> : !phaseState.fase1Done ? <Lock size={12} /> : <Building2 size={12} />}
              <span>{phaseState.fase2Done ? 'Fase 2 Disetujui' : 'Setujui Fase 2'}</span>
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setConfirmKind('fase3')}
              disabled={isProcessing || !phaseState.fase2Done || phaseState.fase3Done}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.65rem', fontSize: '0.74rem', color: phaseState.fase3Done ? '#0ab39c' : !phaseState.fase2Done ? '#a2a7b0' : '#0ab39c', borderColor: 'rgba(10, 179, 156, 0.3)' }}
              title={phaseState.fase3Done ? 'Fase 3 sudah disetujui' : !phaseState.fase2Done ? 'Terkunci — setujui Fase 2 terlebih dahulu' : 'Setujui seluruh hasil analisa Fase 3 dan buka Data Final'}
            >
              {phaseState.fase3Done ? <Check size={12} /> : !phaseState.fase2Done ? <Lock size={12} /> : <Users size={12} />}
              <span>{phaseState.fase3Done ? 'Fase 3 Disetujui' : 'Setujui Fase 3'}</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={() => setConfirmKind('final')}
            disabled={isProcessing || !phaseState.fase3Done || stats.isAllApproved}
            title={!phaseState.fase3Done ? 'Terkunci — setujui Fase 3 terlebih dahulu' : 'Setujui seluruh baris sebagai Final Analisa'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1.1rem',
              fontWeight: 700,
              fontSize: '0.8rem',
              background: stats.isAllApproved ? '#34c38f' : !phaseState.fase3Done ? '#e9ebec' : '#0ab39c',
              borderColor: '#0ab39c',
            }}
          >
            {stats.isAllApproved ? (
              <>
                <Lock size={14} />
                <span>Analisa Final Telah Disetujui</span>
              </>
            ) : (
              <>
                {!phaseState.fase3Done ? <Lock size={14} /> : <Check size={14} />}
                <span>Saya Setuju (Masuk ke Final Analisa)</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Export Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportPdf}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.95rem', fontSize: '0.8rem', color: '#405189', borderColor: '#405189' }}
          >
            <FileText size={15} />
            <span>Ekspor PDF Executive</span>
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportExcel}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.95rem', fontSize: '0.8rem', color: '#0ab39c', borderColor: '#0ab39c' }}
          >
            <FileSpreadsheet size={15} />
            <span>Ekspor Excel Multi-Sheet</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. SUB-TAB BAR & FILTERS                                                  */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
        {/* Sequential Review Step Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 0.9rem',
            marginBottom: '0.75rem',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            background: phaseState.step === 4 ? '#e8f7f5' : '#eff2f7',
            color: phaseState.step === 4 ? '#0ab39c' : '#405189',
            border: `1px solid ${phaseState.step === 4 ? '#b7ebe4' : '#dce4f5'}`,
          }}
        >
          {phaseState.step === 4 ? <CheckCircle2 size={15} /> : <Lock size={14} />}
          <span>
            {phaseState.step === 1 && 'Langkah 1 dari 4 — Sedang mereview Fase 1 (PTEN & Kode Pos). Klik "Setujui Fase 1" untuk membuka Fase 2.'}
            {phaseState.step === 2 && 'Langkah 2 dari 4 — Sedang mereview Fase 2 (Wilayah & Cabang). Klik "Setujui Fase 2" untuk membuka Fase 3.'}
            {phaseState.step === 3 && 'Langkah 3 dari 4 — Sedang mereview Fase 3 (Mapping Role & Wondr). Klik "Setujui Fase 3" untuk membuka Data Final.'}
            {phaseState.step === 4 && 'Seluruh fase telah disetujui — Data Final terbuka untuk review akhir, persetujuan final, dan ekspor.'}
          </span>
        </div>

        {phaseState.step <= 3 && (
          <div style={{ margin: '-0.35rem 0 0.75rem', fontSize: '0.72rem', color: '#878a99' }}>
            Salah data? Perbaiki di menu Data Master lalu jalankan ulang fase ini — di sini hanya ada Setujui dan Revisi, tidak ada edit field.
          </div>
        )}

        {/* Navigation Sub-Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #e9ebec', paddingBottom: '0.65rem' }}>
          <div className="nav-tabs">
            {([
              { key: 'fase1', label: '📍 1. Review Fase 1 (PTEN & Kode Pos)', done: phaseState.fase1Done, n: phaseState.queue.fase1 },
              { key: 'fase2', label: '🏢 2. Review Fase 2 (Kanwil & Master Cabang)', done: phaseState.fase2Done, n: phaseState.queue.fase2 },
              { key: 'fase3', label: '👥 3. Review Fase 3 (Mapping Role & Wondr)', done: phaseState.fase3Done, n: phaseState.queue.fase3 },
              { key: 'all', label: '📑 4. Data Final (Semua Atribut)', done: stats.isAllApproved, n: phaseState.queue.all },
            ] as const).map((tab) => {
              const locked = phaseState.locked[tab.key];
              const active = viewTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`nav-tab-btn ${active ? 'active' : ''}`}
                  onClick={() => !locked && setActiveSubTab(tab.key)}
                  disabled={locked}
                  title={locked ? 'Tidak ada data di fase ini — gunakan "Revisi" untuk mengirim baris kembali' : tab.label}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: locked ? 0.55 : 1, cursor: locked ? 'not-allowed' : 'pointer' }}
                >
                  {tab.done && <Check size={13} color="#0ab39c" />}
                  {locked && <Lock size={12} />}
                  <span>{tab.label}</span>
                  <span
                    style={{
                      marginLeft: '0.15rem',
                      minWidth: '20px',
                      padding: '0.02rem 0.4rem',
                      borderRadius: '999px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: tab.n > 0 ? 'rgba(240, 101, 72, 0.14)' : 'rgba(10, 179, 156, 0.14)',
                      color: tab.n > 0 ? '#f06548' : '#0ab39c',
                    }}
                  >
                    {tab.n.toLocaleString('id-ID')}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
            Menampilkan <strong style={{ color: '#212529' }}>{filteredRows.length.toLocaleString('id-ID')}</strong> dari{' '}
            {rows.length.toLocaleString('id-ID')} baris
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="filter-toolbar" style={{ marginBottom: '1rem' }}>
          <div className="filter-group" style={{ flex: 1, minWidth: '280px' }}>
            {/* Search Input */}
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '0.65rem', color: '#878a99' }} />
              <input
                type="text"
                className="search-input"
                style={{ width: '100%', paddingLeft: '2rem' }}
                placeholder="Cari cabang, kota PTEN, kelurahan, kecamatan, sandi, role..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#878a99' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Wilayah */}
            <select
              className="filter-select"
              value={selectedWilayah}
              onChange={(e) => {
                setSelectedWilayah(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Semua Wilayah ({wilayahList.length})</option>
              {wilayahList.map((w) => (
                <option key={w} value={w}>
                  {formatWilayahName(w)}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
            >
              <option value="ALL">Semua Status</option>
              <option value="EXACT_MATCH">Exact Cocok Sempurna ({stats.exact})</option>
              <option value="HIGH_CONFIDENCE">High Confidence ({stats.highConf})</option>
              {stats.anomalies > 0 && <option value="ANOMALI">Perlu Review / Anomali ({stats.anomalies})</option>}
              {stats.placementReview > 0 && <option value="PENEMPATAN_REVIEW">Penempatan Belum Terverifikasi ({stats.placementReview})</option>}
            </select>
          </div>

          {filterBelumSetuju && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onResetBelumSetuju}
              title="Tampilkan kembali semua baris fase ini"
              style={{ color: '#b06f0f', borderColor: 'rgba(240, 173, 78, 0.5)', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Hanya baris Fase {filterBelumSetuju} yang belum disetujui — tampilkan semua
            </button>
          )}

          <div className="filter-group">
            <span style={{ fontSize: '0.78rem', color: '#878a99' }}>Tampilkan:</span>
            <select
              className="filter-select"
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setPageSize(val);
                setPage(1);
              }}
            >
              <option value={15}>15 Baris</option>
              <option value={30}>30 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
              <option value="ALL">Semua ({filteredRows.length})</option>
            </select>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* 4. DATA TABLES PER SUB-TAB                                                */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* Inner tab seragam untuk semua fase: siap setujui vs masih perlu kerja */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {([
            {
              key: 'BERES' as const,
              label: `${stageTab === 1 ? '✅ Berhasil Dianalisa' : stageTab === 2 ? '✅ Outlet Tervalidasi' : stageTab === 3 ? '✅ Role Terpasang Rapi' : '✅ Siap Final'} (${hitunganInner.beres.toLocaleString('id-ID')})`,
              color: '#0ab39c',
            },
            {
              key: 'MANUAL' as const,
              label: `${stageTab === 1 ? '⚠️ Perlu Analisa Manual' : stageTab === 2 ? '✋ Perlu Validasi Manual' : stageTab === 3 ? '⚠️ Perlu Review Role' : '✋ Ditandai Manual'} (${hitunganInner.manual.toLocaleString('id-ID')})`,
              color: '#f0ad4e',
            },
          ]).map((t) => {
            const active = innerTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setInnerTab(t.key);
                  setPage(1);
                }}
                style={{
                  background: active ? t.color : '#ffffff',
                  color: active ? '#ffffff' : '#495057',
                  border: `1px solid ${active ? t.color : '#d5dde3'}`,
                  borderRadius: '6px',
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            );
          })}

          {innerTab === 'MANUAL' && (
            <>
              <button
                type="button"
                className="btn btn-sm"
                disabled={isProcessing || filteredRows.length === 0}
                onClick={() => {
                  const ids = filteredRows.map((r) => r.id);
                  onBersihkanManual(ids);
                  setInnerTab('BERES');
                  setPage(1);
                  showToast(`${ids.length.toLocaleString('id-ID')} baris ditandai selesai — cek di tab sebelah kiri, lalu "Setujui Fase".`, 'info');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: 'rgba(10, 179, 156, 0.12)',
                  border: '1px solid rgba(10, 179, 156, 0.35)',
                  color: '#0ab39c',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  whiteSpace: 'nowrap',
                }}
                title="Semua baris yang tampil di tab ini dianggap sudah benar dan pindah ke tab Berhasil Dianalisa. Fase ini belum disetujui — masih bisa direvisi."
              >
                <Check size={13} />
                <span>Setujui semua ({filteredRows.length.toLocaleString('id-ID')})</span>
              </button>
              <span style={{ fontSize: '0.76rem', color: '#878a99' }}>
                {stageTab === 1 && 'Kotanya tidak ada di data PTEN — pilih kota PTEN lewat "Ganti Kab/Kota PTEN", atau setujui apa adanya.'}
                {stageTab === 2 && 'Cabang perlu diputuskan: beda kota/provinsi/pulau, koordinat mencurigakan, atau kota ini tidak ada di Data Cabang — pilih kandidat di kolom Rekomendasi.'}
                {stageTab === 3 && 'Skor kecocokan role rendah — ganti kandidat mapping, atau setujui apa adanya.'}
                {stageTab === 4 && 'Baris yang Anda tarik kembali dari Final Data. Setujui untuk mengirimnya lagi ke penyetujuan akhir.'}
              </span>
            </>
          )}
        </div>

        {/* N3: bar aksi massal — hanya muncul saat ada baris terpilih di halaman ini */}
        {barisTerpilih.length > 0 && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
              padding: '0.4rem 0.6rem', margin: '0 0 0.5rem', background: '#eef6ff',
              border: '1px solid #cfe3f7', borderRadius: '6px',
            }}
          >
            <strong style={{ fontSize: '0.78rem', color: '#405189' }}>{barisTerpilih.length.toLocaleString('id-ID')} baris terpilih</strong>
            <button type="button" className="btn btn-outline btn-sm" onClick={setujuiTerpilih} title="Setujui baris terpilih untuk fase yang sedang dibuka">
              <Check size={12} /> Setujui terpilih
            </button>
            {innerTab === 'BERES' && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setKonfirmasiRevisiMassal(true)} title="Kembalikan baris terpilih ke tab Perlu Analisa Manual">
                <RotateCcw size={12} /> Revisi terpilih
              </button>
            )}
            {innerTab === 'MANUAL' && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={gantiKotaTerpilih}
                title={kotaTerpilih.length > 1
                  ? `Pilihan mencakup ${kotaTerpilih.length} kota. Modal terbuka untuk kota pertama (${kotaTerpilih[0]}) — berlaku untuk seluruh kelurahan kota itu, bukan per baris.`
                  : 'Tetapkan kota/kabupaten PTEN untuk kota asal baris terpilih (berlaku untuk seluruh kelurahan kota itu)'}
              >
                <MapPin size={12} /> Ganti Kab/Kota PTEN{kotaTerpilih.length > 1 ? ` (${kotaTerpilih.length} kota)` : ''}
              </button>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => simpanPilihan([])} title="Kosongkan pilihan">
              Batalkan pilihan
            </button>
          </div>
        )}
        <ConfirmDialog
          isOpen={konfirmasiRevisiMassal}
          icon={<RotateCcw size={18} />}
          accent="#d97706"
          title="Kembalikan baris terpilih ke manual?"
          message={`${barisTerpilih.length.toLocaleString('id-ID')} baris terpilih akan ditandai perlu diperiksa ulang dan keluar dari tab Berhasil Dianalisa.`}
          confirmLabel="Ya, Revisi terpilih"
          onConfirm={revisiTerpilih}
          onClose={() => setKonfirmasiRevisiMassal(false)}
        />

        <div ref={tableScrollRef} className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', maxHeight: '600px', overflow: 'auto' }}>
          {/* N1: `max-content` + wadah scroll = tidak ada nilai yang dipotong jadi
              elipsis; sel tetap satu baris dan tabel digeser horizontal. */}
          <table className="modern-table" style={{ width: 'max-content', minWidth: '100%', fontSize: '0.78rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3f6f9' }}>
              {/* TAB 1: ALL COLUMNS — urutan kolom permintaan operator:
                  identitas cabang (hasil Fase 2) → wilayah data → PTEN (hasil Fase 1) →
                  validasi per fase → aksi. */}
              {viewTab === 'all' && (
                <tr>
                  <th style={{ width: '34px', minWidth: '34px', textAlign: 'center', position: 'sticky', left: 0, background: '#f3f6f9', zIndex: 13, borderRight: '1px solid #e9ebec' }} title="Pilih semua baris pada halaman ini">
                    <input type="checkbox" checked={semuaHalamanTerpilih} onChange={gantiPilihanSemua} aria-label="Pilih semua baris pada halaman ini" style={{ cursor: 'pointer' }} />
                  </th>
                  {thSort('no', 'No', { width: '40px', textAlign: 'center', position: 'sticky', left: 34, background: '#f3f6f9', zIndex: 12, borderRight: '1px solid #e9ebec' })}
                  {thSort('wilayah', 'Wilayah', { width: '90px', textAlign: 'center' })}
                  <th style={{ width: '110px', textAlign: 'center' }}>Sandi Cabang</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Branch Code</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Kode Cabang</th>
                  {thSort('namaOutlet', 'Nama Outlet', { minWidth: '170px' })}
                  <th style={{ width: '95px', textAlign: 'center' }}>Status Outlet</th>
                  <th style={{ minWidth: '200px' }}>ALAMAT</th>
                  <th style={{ width: '90px', textAlign: 'center' }} title="Kode pos kelurahan ini pada Data KodePos">KODE POS</th>
                  {thSort('kelurahan', 'Kelurahan', { minWidth: '140px' })}
                  {thSort('kecamatan', 'Kecamatan', { minWidth: '140px' })}
                  <th style={{ minWidth: '140px' }} title="Sama seperti kolom KOTA PTEN (nama MAX 15 digit) — urutan ini mengikuti ekspor Excel. Berubah oranye bila kota menurut Data KodePos berbeda.">Dati II</th>
                  {thSort('provinsi', 'Provinsi', { minWidth: '130px' })}
                  {thSort('kotaPten', 'KOTA PTEN', { minWidth: '140px', borderLeft: '2px solid #b7ebe4' })}
                  {thSort('kodePosPten', 'KODE POS PTEN', { width: '115px', textAlign: 'center' })}
                  <th style={{ width: '165px', textAlign: 'center', background: '#eef7ff', color: '#2563eb' }} title="Hasil analisa Fase 1 (PTEN & Kode Pos) untuk baris ini">Validasi Fase 1</th>
                  <th style={{ width: '175px', textAlign: 'center', background: '#fff9f0', color: '#d97706' }} title="Hasil analisa Fase 2 (Wilayah & Master Cabang) untuk baris ini">Validasi Fase 2</th>
                  <th style={{ width: '175px', textAlign: 'center', background: '#f0fdf8', color: '#059669' }} title="Hasil analisa Fase 3 (Mapping Role & Wondr) untuk baris ini">Validasi Fase 3</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Aksi Review</th>
                </tr>
              )}

              {/* TAB 2: FASE 1 PTEN & KODE POS (grup header: Data Pos vs Data PTEN) */}
              {viewTab === 'fase1' && (
                <>
                  <tr>
                    <th style={{ width: '34px', textAlign: 'center', verticalAlign: 'middle' }} rowSpan={2} title="Pilih semua baris pada halaman ini">
                      <input type="checkbox" checked={semuaHalamanTerpilih} onChange={gantiPilihanSemua} aria-label="Pilih semua baris pada halaman ini" style={{ cursor: 'pointer' }} />
                    </th>
                    {thSort('no', 'No', { width: '40px', textAlign: 'center', verticalAlign: 'middle' }, { rowSpan: 2 })}
                    <th colSpan={5} style={{ textAlign: 'center', background: '#eff6fb', color: '#299cdb', borderLeft: '2px solid #d5e7f2' }}>
                      📮 DATA POS (Kelurahan &amp; Wilayah Administrasi)
                    </th>
                    <th colSpan={3} style={{ textAlign: 'center', background: '#eefaf6', color: '#0ab39c', borderLeft: '2px solid #b7ebe4' }}>
                      {innerTab === 'MANUAL'
                        ? '🛡️ DATA PTEN (belum terpetakan)'
                        : '🛡️ DATA PTEN (Kota / Provinsi / Kode Pos)'}
                    </th>
                    <th rowSpan={2} style={{ width: '110px', textAlign: 'center', verticalAlign: 'middle' }}>Aksi Review</th>
                  </tr>
                  <tr>
                    {thSort('kelurahan', 'Kelurahan', { minWidth: '140px', borderLeft: '2px solid #d5e7f2' })}
                    <th style={{ minWidth: '150px' }} title="Nama kota/kabupaten persis seperti tertulis di Data KodePos — hanya pembanding tampilan, tidak ikut disimpan di baris hasil">Kota/Kab (dari KodePos)</th>
                    {thSort('kecamatan', 'Kecamatan', { minWidth: '140px' })}
                    {thSort('provinsi', 'Provinsi', { minWidth: '130px' })}
                    {thSort('kodePosKelurahan', 'Kode Pos', { width: '90px', textAlign: 'center' })}
                    {thSort('kotaPten', 'Kota / Kabupaten', { minWidth: '150px', borderLeft: '2px solid #b7ebe4' })}
                    {thSort('kodePosPten', 'Kode Pos PTEN', { width: '115px', textAlign: 'center' })}
                    {thSort('statusPten', 'Status PTEN', { minWidth: '170px', textAlign: 'center' })}
                  </tr>
                </>
              )}

              {/* TAB 3: FASE 2 WILAYAH & CABANG (kandidat kiri sticky, gaya tab "Rekomendasi Data" lama) */}
              {viewTab === 'fase2' && (
                <tr>
                  {/* Kolom pilihan ikut sticky: tabel Fase 2 lebar dan wajib di-scroll
                      horizontal, jadi checkbox harus tetap terlihat saat memilih. */}
                  <th style={{ width: '34px', minWidth: '34px', textAlign: 'center', position: 'sticky', left: 0, background: '#f3f6f9', zIndex: 13, borderRight: '1px solid #e9ebec' }} title="Pilih semua baris pada halaman ini">
                    <input type="checkbox" checked={semuaHalamanTerpilih} onChange={gantiPilihanSemua} aria-label="Pilih semua baris pada halaman ini" style={{ cursor: 'pointer' }} />
                  </th>
                  {thSort('no', 'No', { width: '40px', textAlign: 'center', position: 'sticky', left: 34, background: '#f3f6f9', zIndex: 12, borderRight: '1px solid #e9ebec' })}
                  <th
                    style={{
                      width: '420px',
                      minWidth: '420px',
                      maxWidth: '420px',
                      textAlign: 'left',
                      background: '#fff9f0',
                      color: '#d97706',
                      position: 'sticky',
                      left: '74px',
                      zIndex: 12,
                      boxShadow: '3px 0 6px -2px rgba(0,0,0,0.06)',
                      borderRight: '2px solid #f7b84b',
                    }}
                  >
                    Kandidat Rekomendasi Master
                  </th>
                  {thSort('wilayah', 'Kanwil', { width: '85px', textAlign: 'center' })}
                  <th style={{ width: '90px', textAlign: 'center' }}>Sandi Cabang</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Branch Code</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Kode Cabang</th>
                  {/* Nama Outlet & Alamat Cabang sengaja TIDAK ditampilkan di sini: keduanya
                      milik cabang hasil rekomendasi, bukan data baris ini. Yang dibutuhkan
                      operator untuk memutuskan adalah identitas wilayah barisnya. */}
                  {thSort('kelurahan', 'Kelurahan', { minWidth: '140px' })}
                  {thSort('kecamatan', 'Kecamatan', { minWidth: '140px' })}
                  <th style={{ minWidth: '150px' }} title="Wajib dari kolom PTEN &quot;KOTA/KABUPATEN MAX 15 DIGIT&quot;">Kota / Kab (MAX 15 Digit)</th>
                  <th style={{ width: '95px', textAlign: 'center' }} title="Kode pos dari data PTEN (hasil tabrakan Fase 1)">Kode Pos</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Aksi Review</th>
                </tr>
              )}

              {/* TAB 4: FASE 3 MAPPING ROLE & WONDR
                  Kolom sesuai permintaan operator: role dulu (keputusan yang diambil di tab ini),
                  lalu identitas cabang hasil Fase 2 yang jadi acuannya, lalu data wilayah baris. */}
              {viewTab === 'fase3' && (
                <tr>
                  <th style={{ width: '34px', minWidth: '34px', textAlign: 'center', position: 'sticky', left: 0, background: '#f3f6f9', zIndex: 13, borderRight: '1px solid #e9ebec' }} title="Pilih semua baris pada halaman ini">
                    <input type="checkbox" checked={semuaHalamanTerpilih} onChange={gantiPilihanSemua} aria-label="Pilih semua baris pada halaman ini" style={{ cursor: 'pointer' }} />
                  </th>
                  <th
                    style={{
                      width: '420px',
                      minWidth: '420px',
                      maxWidth: '420px',
                      textAlign: 'left',
                      background: '#f0fdf8',
                      color: '#059669',
                      position: 'sticky',
                      left: '34px',
                      zIndex: 12,
                      boxShadow: '3px 0 6px -2px rgba(0,0,0,0.06)',
                      borderRight: '2px solid rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Shield size={13} color="#059669" />
                      <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Rekomendasi Mapping Role</span>
                    </div>
                  </th>
                  <th style={{ width: '400px', minWidth: '400px', maxWidth: '400px', textAlign: 'left', background: '#fff9f0', color: '#d97706', borderRight: '2px solid #f7b84b' }} title="Cabang Master yang terpilih di Fase 2 — acuan rekomendasi role di kolom kiri">
                    Data Master Outlet
                  </th>
                  <th style={{ width: '95px', textAlign: 'center' }} title="Kode pos dari data PTEN (hasil tabrakan Fase 1)">Kode Pos</th>
                  <th style={{ minWidth: '140px' }}>Kelurahan</th>
                  <th style={{ minWidth: '140px' }}>Kecamatan</th>
                  <th style={{ minWidth: '150px' }} title="Wajib dari kolom PTEN &quot;KOTA/KABUPATEN MAX 15 DIGIT&quot;">Kota / Kab (MAX 15 Digit)</th>
                  <th style={{ minWidth: '130px' }}>Provinsi</th>
                  <th style={{ width: '110px', textAlign: 'center', verticalAlign: 'middle' }}>Aksi Review</th>
                </tr>
              )}
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={25} style={{ textAlign: 'center', padding: '2.5rem', color: '#878a99' }}>
                    Tidak ada baris analisa yang cocok dengan filter pencarian "{searchTerm}".
                  </td>
                </tr>
              ) : (
                <>
                  {win.active && win.padTop > 0 && <tr aria-hidden="true" style={{ height: `${win.padTop}px` }} />}
                  {renderedRows.map((r, i) => {
                    const idx = rowOffset + i;
                    const displayIdx = pageSize === 'ALL' ? idx + 1 : (page - 1) * (pageSize as number) + idx + 1;
                    const p2 = f2Aktif.get(r.id);

                    // Master kandidat aktif — dipakai Fase 3 bila Branch Code baris belum
                    // tertulis. Kolom Fase 2 membaca dari `f2Aktif` (satu sumber di atas).
                    const _f2Entry = fase2Recs.get(r.id);
                    const _f2Cands = _f2Entry?.rec?.candidates || [];
                    const _f2Audit = _f2Entry?.rec?.userPrefilledAudit;
                    const _f2ActiveRank = fase2Choice[r.id] || (_f2Audit?.matchedRank && _f2Audit.matchedRank <= 3 ? _f2Audit.matchedRank : 1);
                    const _activeCandMaster = (_f2Cands.find((c) => c.rank === _f2ActiveRank) || _f2Cands[0])?.master ?? null;

                    return (
                    <tr
                      key={r.id || idx}
                      data-vrow={i === 0 ? 'true' : undefined}
                      style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd' }}
                    >
                      <td
                        style={{
                          width: '34px',
                          minWidth: '34px',
                          textAlign: 'center',
                          ...(viewTab === 'all' || viewTab === 'fase2' || viewTab === 'fase3'
                            ? { position: 'sticky', left: 0, zIndex: 6, background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd', borderRight: '1px solid #e9ebec' }
                            : {}),
                        }}
                      >
                        <input type="checkbox" checked={terpilih.has(r.id)} onChange={() => toggleTerpilih(r.id)} aria-label={`Pilih baris ${r.no}`} style={{ cursor: 'pointer' }} />
                      </td>
                      {/* TAB 1: ALL COLUMNS — Data Final */}
                      {viewTab === 'all' && (
                        <>
                          <td style={{ textAlign: 'center', color: '#878a99', position: 'sticky', left: 34, zIndex: 5, background: idx % 2 === 0 ? '#ffffff' : '#f9fbfd', borderRight: '1px solid #e9ebec' }}>{displayIdx}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-level1">{r.wilayah || p2?.wilayah || '-'}</span>
                          </td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.sandiCabang || p2?.sandiCabang || '-'}</td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.branchCode || p2?.branchCode || '-'}</td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.kodeCabang || p2?.kodeCabang || '-'}</td>
                          <td style={{ fontWeight: 600, color: '#405189' }}>{r.namaOutlet || p2?.namaOutlet || '-'}</td>
                          <td style={{ textAlign: 'center' }}>{r.statusOutlet || p2?.statusOutlet || '-'}</td>
                          <td title={r.alamat || p2?.alamat || ''}>{r.alamat || p2?.alamat || '-'}</td>
                          <td className="code-cell" style={{ textAlign: 'center', color: '#0ab39c', fontWeight: 700 }}>{r.kodePosKelurahan || r.kodePosPten || '-'}</td>
                          <td style={{ fontWeight: 700 }}>{r.kelurahan}</td>
                          <td>{r.kecamatan}</td>
                          <td style={{ color: kotaKodePosDari(r) && kotaKodePosDari(r) !== (r.kotaPtenMax15 || r.kotaPten) ? '#b45309' : '#495057' }} title={`Nilai sama dengan kolom KOTA PTEN (aturan ekspor). Menurut Data KodePos kota ini: ${kotaKodePosDari(r) || 'tidak ada'}`}>
                            {r.kotaPtenMax15 || r.kotaPten || '—'}
                          </td>
                          <td>{r.provinsi}</td>
                          <td style={{ fontWeight: 700, borderLeft: '2px solid #b7ebe4' }} title={`Nama persis di PTEN: ${r.kotaPten || '-'}`}>{r.kotaPtenMax15 || r.kotaPten || '—'}</td>
                          <td className="code-cell" style={{ textAlign: 'center', color: '#0ab39c', fontWeight: 700 }}>
                            {/* Baris belum terpetakan warisi kode pos kelurahan, bukan dari PTEN */}
                            {r.kategori === 'TIDAK_ANALISA' ? '—' : r.kodePosPten || '—'}
                          </td>
                          <SelValidasi p={penjelasanFase1(r)} warnaGaris="2px solid #d8ecff" />
                          <SelValidasi p={penjelasanFase2(r)} warnaGaris="2px solid #f7e3bf" />
                          <SelValidasi p={penjelasanFase3(r)} warnaGaris="2px solid #c7ecdc" />
                        </>
                      )}

                      {/* TAB 2: FASE 1 PTEN & KODE POS — Data Pos | Data PTEN */}
                      {viewTab === 'fase1' && (
                        <>
                          <td style={{ textAlign: 'center', color: '#878a99' }}>{r.kelurahanSeq ?? displayIdx}</td>
                          <td style={{ fontWeight: 700, color: '#212529', borderLeft: '2px solid #d5e7f2' }}>{r.kelurahan}</td>
                          <td style={{ color: kotaKodePosDari(r) && kotaKodePosDari(r) !== r.kotaPten ? '#b45309' : '#495057' }} title="Dari Data KodePos (tampilan saja)">{kotaKodePosDari(r) || '—'}</td>
                          <td>{r.kecamatan}</td>
                          <td>{r.provinsi}</td>
                          <td className="code-cell" style={{ textAlign: 'center', color: '#299cdb', fontWeight: 700 }}>
                            {r.kodePosKelurahan || '—'}
                          </td>
                          <td style={{ fontWeight: 700, color: r.kotaPten ? '#212529' : '#f0ad4e', borderLeft: '2px solid #b7ebe4' }}>
                            {r.kotaPten || `${r.groupKota} (belum terpetakan ke PTEN)`}
                          </td>
                          <td className="code-cell" style={{ textAlign: 'center', color: '#0ab39c', fontWeight: 700 }}>
                            {/* Baris belum terpetakan warisi kode pos kelurahan, bukan dari PTEN */}
                            {r.kategori === 'TIDAK_ANALISA' ? '—' : r.kodePosPten}
                          </td>
                          {/* Satu kartu label: warna = status, teks kecil di bawahnya = alasannya */}
                          <td style={{ textAlign: 'center' }} title={r.placementMethod || ''}>
                            {(() => {
                              const p = penjelasanFase1(r);
                              const cls = p.nada === 'ok' ? 'badge-match' : p.nada === 'waspada' ? 'badge-level2' : 'badge-diff';
                              return (
                                <>
                                  <span className={`badge ${cls}`}>{p.label}</span>
                                  <div
                                    title={p.alasan}
                                    style={{
                                      fontSize: '0.62rem',
                                      color: '#878a99',
                                      margin: '2px auto 0',
                                      maxWidth: '190px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {p.alasan}
                                  </div>
                                </>
                              );
                            })()}
                          </td>
                        </>
                      )}

                      {/* TAB 3: FASE 2 WILAYAH & CABANG */}
                      {viewTab === 'fase2' && (
                        <>
                          <td style={{ textAlign: 'center', color: '#878a99', position: 'sticky', left: 34, background: '#fff', zIndex: 5, borderRight: '1px solid #e9ebec' }}>{displayIdx}</td>
                          {(() => {
                            const entry = fase2Recs.get(r.id);
                            const cands = entry?.rec?.candidates || [];
                            const tdStyle: React.CSSProperties = {
                              position: 'sticky',
                              left: '74px',
                              zIndex: 5,
                              width: '420px',
                              minWidth: '420px',
                              maxWidth: '420px',
                              background: r.fase2Approved ? '#f0fdf4' : '#fffdfa',
                              padding: '0.45rem 0.55rem',
                              verticalAlign: 'top',
                              boxShadow: '3px 0 6px -2px rgba(0,0,0,0.06)',
                              borderRight: '2px solid rgba(247,184,75,0.45)',
                            };
                            if (!entry || !cands.length)
                              return (
                                <td style={tdStyle}>
                                  <span style={{ fontSize: '0.72rem', color: '#adb5bd' }}>Tidak ada kandidat (Master Cabang kosong)</span>
                                </td>
                              );
                            const rec = entry.rec!;
                            const audit = rec.userPrefilledAudit;
                            const activeRank = fase2Choice[r.id] || (audit && audit.matchedRank && audit.matchedRank <= 3 ? audit.matchedRank : 1);
                            const activeCand = cands.find((c) => c.rank === activeRank) || cands[0];
                            const m = activeCand.master;
                            const isTop1 = activeCand.rank === 1;
                            const badgeBg = isTop1 ? 'rgba(10,179,156,0.12)' : activeCand.rank === 2 ? 'rgba(247,184,75,0.15)' : 'rgba(53,119,241,0.1)';
                            const badgeColor = isTop1 ? '#0ab39c' : activeCand.rank === 2 ? '#d97706' : '#3577f1';
                            const candWilayah = extractWilayahFromBranchCode(String(m['Branch Code'] || m['Kode Cabang'] || '').trim(), wilayahSettings, r.wilayah);
                            const isKelMatched = !!(r.kelurahan && m.Kelurahan && cleanKelurahan(r.kelurahan) === cleanKelurahan(m.Kelurahan));
                            const isKecMatched = !!(r.kecamatan && m.Kecamatan && cleanKecamatan(r.kecamatan) === cleanKecamatan(m.Kecamatan));
                            return (
                              <td style={tdStyle}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                  {(r.fase2Temuan?.length || 0) > 0 && (
                                    <div
                                      title={r.fase2Temuan.join(' · ')}
                                      style={{
                                        padding: '0.2rem 0.45rem',
                                        borderRadius: '4px',
                                        fontSize: '0.68rem',
                                        fontWeight: 600,
                                        background: 'rgba(240,101,72,0.1)',
                                        color: '#c0392b',
                                        border: '1px solid rgba(240,101,72,0.3)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      Perlu diputuskan: {r.fase2Temuan.join(' · ')}
                                    </div>
                                  )}
                                  {audit && audit.hasPrefilled && (
                                    <div
                                      title={`Di data terisi: "${audit.prefilledText}". ${audit.message}`}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        padding: '0.2rem 0.45rem',
                                        borderRadius: '4px',
                                        fontSize: '0.68rem',
                                        fontWeight: 600,
                                        background:
                                          audit.status === 'match_top1' ? 'rgba(10,179,156,0.08)'
                                          : audit.status === 'match_top2' || audit.status === 'match_top3' ? 'rgba(247,184,75,0.12)'
                                          : 'rgba(53,119,241,0.08)',
                                        color:
                                          audit.status === 'match_top1' ? '#07796a'
                                          : audit.status === 'match_top2' || audit.status === 'match_top3' ? '#925807'
                                          : '#2563eb',
                                        border: `1px solid ${
                                          audit.status === 'match_top1' ? 'rgba(10,179,156,0.28)'
                                          : audit.status === 'match_top2' || audit.status === 'match_top3' ? 'rgba(247,184,75,0.35)'
                                          : 'rgba(53,119,241,0.25)'}`,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {audit.status === 'match_top1' ? (
                                        <CheckCircle2 size={12} color="#0ab39c" style={{ flexShrink: 0 }} />
                                      ) : audit.status === 'match_top2' || audit.status === 'match_top3' ? (
                                        <AlertTriangle size={12} color="#d97706" style={{ flexShrink: 0 }} />
                                      ) : (
                                        <Info size={12} color="#3577f1" style={{ flexShrink: 0 }} />
                                      )}
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        Di data: <strong>"{audit.prefilledText}"</strong> → {audit.message}
                                      </span>
                                    </div>
                                  )}
                                  {cands.length > 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.1rem' }}>
                                      <span style={{ fontSize: '0.68rem', color: '#878a99', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Opsi:</span>
                                      {cands.map((cand) => {
                                        const isSelected = cand.rank === activeCand.rank;
                                        const pillBg = cand.rank === 1 ? '#0ab39c' : cand.rank === 2 ? '#d97706' : '#3577f1';
                                        const isUserChoice = audit?.matchedRank === cand.rank;
                                        return (
                                          <button
                                            key={`pill-${r.id}-${cand.rank}`}
                                            type="button"
                                            onClick={() => {
                                              setFase2Choice((prev) => ({ ...prev, [r.id]: cand.rank }));
                                              applyFase2Candidate(r, cand.master);
                                            }}
                                            title={`Klik untuk melihat Pilihan ${cand.rank} (${cand.score}%)${cand.diLuarZona ? ' - cabang ini di LUAR kota/provinsi data ini, ditambah hanya supaya Anda punya tiga pilihan' : ''}${isUserChoice ? ' - Ini cabang yang terisi di data' : ''}`}
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.25rem',
                                              padding: '0.15rem 0.45rem',
                                              borderRadius: '9999px',
                                              fontSize: '0.7rem',
                                              fontWeight: isSelected ? 700 : 500,
                                              background: isSelected ? pillBg : '#f3f6f9',
                                              color: isSelected ? '#ffffff' : '#495057',
                                              border: isSelected ? `1px solid ${pillBg}` : isUserChoice ? '1px dashed #d97706' : '1px solid #e9ebec',
                                              cursor: 'pointer',
                                              flexShrink: 0,
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            <span>{cand.rank === 1 ? 'Pilihan 1' : `Pilihan ${cand.rank}`}</span>
                                            {isUserChoice && (
                                              <span style={{ fontSize: '0.58rem', padding: '0.02rem 0.25rem', borderRadius: '3px', background: isSelected ? 'rgba(255,255,255,0.3)' : 'rgba(217,119,6,0.15)', color: isSelected ? '#ffffff' : '#925807', fontWeight: 700 }}>
                                                Pilihan Anda
                                              </span>
                                            )}
                                            <span style={{ fontSize: '0.65rem', padding: '0.05rem 0.3rem', borderRadius: '9999px', background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)', color: isSelected ? '#ffffff' : '#6c757d', fontWeight: 700 }}>
                                              {cand.score}%
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      border: isTop1 ? '1px solid rgba(10,179,156,0.35)' : '1px solid #e9ebec',
                                      borderRadius: '6px',
                                      padding: '0.45rem 0.6rem',
                                      background: isTop1 ? '#ffffff' : '#fafafa',
                                      boxShadow: isTop1 ? '0 1px 2px rgba(10,179,156,0.08)' : 'none',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem', marginBottom: '0.3rem', flexWrap: 'nowrap' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                        <span style={{ padding: '0.1rem 0.38rem', borderRadius: '3px', fontSize: '0.67rem', fontWeight: 700, background: badgeBg, color: badgeColor }}>
                                          {isTop1 ? 'Pilihan 1 (Utama)' : `Pilihan ${activeCand.rank} (Alternatif)`}
                                        </span>
                                        {activeCand.diLuarZona && (
                                          <span style={{ padding: '0.1rem 0.38rem', borderRadius: '3px', fontSize: '0.67rem', fontWeight: 700, background: 'rgba(217,119,6,0.12)', color: '#925807' }} title="Kota ini punya kurang dari tiga cabang di Master, jadi pilihan ini diambil dari luar kota/provinsi — bukan hasil pencocokan otomatis">
                                            LUAR ZONA
                                          </span>
                                        )}
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.67rem', fontWeight: 600, color: badgeColor }}>
                                          <Sparkles size={10} /> Skor {activeCand.score}%
                                        </span>
                                        {activeCand.formattedDistance && (
                                          <span
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.67rem', fontWeight: 600, color: '#0d9488', background: 'rgba(13,148,136,0.08)', padding: '0.08rem 0.32rem', borderRadius: '3px' }}
                                            title={`Estimasi jarak fisik: ${activeCand.formattedDistance} (${activeCand.distanceBasis || 'Jarak darat'})`}
                                          >
                                            <MapPin size={9} /> {activeCand.formattedDistance}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                                        {activeCand.googleMapsUrl && (
                                          <a
                                            href={activeCand.googleMapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Buka rute navigasi & cek jarak real di Google Maps"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', height: '18px', padding: '0 0.35rem', fontSize: '0.67rem', fontWeight: 600, color: '#2563eb', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: '3px', textDecoration: 'none' }}
                                          >
                                            <ExternalLink size={10} /> Maps
                                          </a>
                                        )}
                                        <button
                                          type="button"
                                          title="Lihat alasan penilaian skor & detail wilayah"
                                          onClick={() => setFase2Detail({ row: r, target: entry.target, rec, chosen: activeCand })}
                                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '3px', border: '1px solid #d1d5db', background: '#f8fafc', color: '#64748b', cursor: 'pointer', padding: 0 }}
                                        >
                                          <Info size={10} />
                                        </button>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.1rem' }}>
                                      <div style={{ fontSize: '0.81rem', fontWeight: 600, color: '#212529', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${m['Sandi Cabang'] || m.Cabang || m.Sandi || '-'}${m['Nama Outlet'] ? ` • ${m['Nama Outlet']}` : ''}${m.ALAMAT ? ` — ${m.ALAMAT}` : ''}`}>
                                        {m['Sandi Cabang'] || m.Cabang || m.Sandi || '-'}
                                        {m['Nama Outlet'] && (
                                          <span style={{ fontSize: '0.73rem', color: '#405189', fontWeight: 500, marginLeft: '0.35rem' }}>• {m['Nama Outlet']}</span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => applyFase2Candidate(r, m)}
                                        disabled={isProcessing}
                                        title="Pilih dan setujui cabang master ini"
                                        style={{
                                          fontSize: '0.69rem',
                                          padding: '0.16rem 0.52rem',
                                          color: badgeColor,
                                          borderColor: isTop1 ? 'rgba(10,179,156,0.45)' : activeCand.rank === 2 ? 'rgba(217,119,6,0.45)' : 'rgba(53,119,241,0.45)',
                                          background: isTop1 ? 'rgba(10,179,156,0.08)' : activeCand.rank === 2 ? 'rgba(217,119,6,0.08)' : 'rgba(53,119,241,0.08)',
                                          fontWeight: 600,
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.2rem',
                                        }}
                                      >
                                        <Check size={11} /> Gunakan Cabang Ini
                                      </button>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', margin: '0.12rem 0 0.22rem' }}>
                                      <span className="code-cell" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.69rem', background: '#f3f6f9', color: '#405189', padding: '0.08rem 0.4rem', borderRadius: '3px', border: '1px solid #e9ebec', fontWeight: 600 }} title={`Kode Branch: ${candWilayah.branchCode || '-'}`}>
                                        <Building2 size={10} /> Branch: <strong>{candWilayah.branchCode || '-'}</strong>
                                      </span>
                                      <span className="badge badge-match" style={{ fontSize: '0.69rem', padding: '0.08rem 0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }} title={`Wilayah hasil setting: ${candWilayah.wilayahName}`}>
                                        <MapPin size={9} /> {candWilayah.wilayahName}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.69rem', color: '#495057', background: '#f8fafc', padding: '0.18rem 0.45rem', borderRadius: '4px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                                      <span>Kel: <strong style={{ color: isKelMatched ? '#059669' : '#1e293b' }}>{m.Kelurahan || '-'}</strong></span>
                                      {isKelMatched && <span style={{ fontSize: '0.6rem', padding: '0.02rem 0.25rem', borderRadius: '3px', background: 'rgba(10,179,156,0.12)', color: '#059669', fontWeight: 700 }} title="Kelurahan sama persis">✓ Kelurahan Sama</span>}
                                      <span style={{ color: '#cbd5e1' }}>•</span>
                                      <span>Kec: <strong style={{ color: isKecMatched ? '#2563eb' : '#1e293b' }}>{m.Kecamatan || '-'}</strong></span>
                                      {isKecMatched && <span style={{ fontSize: '0.6rem', padding: '0.02rem 0.25rem', borderRadius: '3px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 700 }} title="Kecamatan sama persis">✓ Kecamatan Sama</span>}
                                      <span style={{ color: '#cbd5e1' }}>•</span>
                                      <span>{m['Dati II'] || '-'}</span>
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '0.25rem' }}>{activeCand.reason}</div>
                                  </div>
                                </div>
                              </td>
                            );
                          })()}
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-level1">{r.wilayah || p2?.wilayah || '-'}</span>
                          </td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.sandiCabang || p2?.sandiCabang || '-'}</td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.branchCode || p2?.branchCode || '-'}</td>
                          <td className="code-cell" style={{ textAlign: 'center' }}>{r.kodeCabang || p2?.kodeCabang || '-'}</td>
                          <td style={{ fontWeight: 700 }}>{r.kelurahan}</td>
                          <td>{r.kecamatan}</td>
                          <td style={{ fontWeight: 600 }} title="Kolom PTEN KOTA/KABUPATEN MAX 15 DIGIT">{r.kotaPtenMax15 || r.kotaPten}</td>
                          <td className="code-cell" style={{ textAlign: 'center', fontWeight: 700 }} title={r.kodePosKelurahan && r.kodePosKelurahan !== r.kodePosPten ? `Kode pos kelurahan ini sendiri: ${r.kodePosKelurahan}` : undefined}>{r.kodePosPten || r.kodePosKelurahan || '-'}</td>
                        </>
                      )}

                      {/* TAB 4: FASE 3 MAPPING ROLE & WONDR */}
                      {viewTab === 'fase3' && (
                        <>
                          {/* Kolom 1 (sticky): 3 cabang role lengkap terdekat dari outlet hasil
                              Fase 2 — strict 1 pulau, KC diprioritaskan, cache per outlet. */}
                          {(() => {
                            const topRoles = fase3TopRolesMap.get(r.id) || [];
                            const autoIdx = topRoles.findIndex((x) => x.rec.organisasiTujuan === r.organisasiTujuan);
                            const selectedIdx = fase3RoleChoice[r.id] ?? (autoIdx >= 0 ? autoIdx : 0);
                            const tdRole: React.CSSProperties = {
                              position: 'sticky',
                              left: '34px',
                              zIndex: 5,
                              width: '420px',
                              minWidth: '420px',
                              maxWidth: '420px',
                              background: r.fase3Approved ? '#f0fdf4' : '#fafffe',
                              padding: '0.45rem 0.55rem',
                              verticalAlign: 'top',
                              boxShadow: '3px 0 6px -2px rgba(0,0,0,0.06)',
                              borderRight: '2px solid rgba(16,185,129,0.45)',
                              boxSizing: 'border-box',
                            };
                            if (topRoles.length === 0)
                              return (
                                <td style={tdRole}>
                                  <span style={{ fontSize: '0.7rem', color: '#adb5bd' }}>
                                    {roleMappingList.length === 0 ? 'Belum ada data Role Mapping — menu ini butuh tab Role Mapping terisi' : 'Belum ada data role lengkap di pulau ini'}
                                  </span>
                                </td>
                              );
                            const rankTheme = [
                              { bg: 'rgba(16,185,129,0.09)', border: '#6ee7b7', text: '#065f46', badge: '#059669', selBg: 'rgba(16,185,129,0.22)', selBorder: '#059669' },
                              { bg: 'rgba(14,165,233,0.07)', border: '#7dd3fc', text: '#0c4a6e', badge: '#0284c7', selBg: 'rgba(14,165,233,0.2)', selBorder: '#0284c7' },
                              { bg: 'rgba(99,102,241,0.07)', border: '#c4b5fd', text: '#312e81', badge: '#4f46e5', selBg: 'rgba(99,102,241,0.18)', selBorder: '#4f46e5' },
                            ];
                            return (
                              <td style={tdRole}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
                                  {topRoles.map((item, rIdx) => {
                                    const role = item.rec;
                                    const isSelected = selectedIdx === rIdx;
                                    const isKc = getUnitCategory(role.organisasiTujuan) === 'KC';
                                    const t = rankTheme[rIdx] || rankTheme[0];
                                    return (
                                      <div
                                        key={`rm-${r.id}-${rIdx}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setFase3RoleChoice((prev) => ({ ...prev, [r.id]: isSelected ? -1 : rIdx }))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') setFase3RoleChoice((prev) => ({ ...prev, [r.id]: isSelected ? -1 : rIdx }));
                                        }}
                                        title={`Klik untuk ${isSelected ? 'batalkan pilihan' : 'pilih'} cabang ini${autoIdx === rIdx ? ' — ini role yang kini terpasang' : ''}`}
                                        style={{
                                          background: isSelected ? t.selBg : t.bg,
                                          border: `1.5px solid ${isSelected ? t.selBorder : t.border}`,
                                          borderRadius: '6px',
                                          padding: '0.3rem 0.42rem',
                                          cursor: 'pointer',
                                          outline: 'none',
                                          boxShadow: isSelected ? `0 0 0 2px ${t.selBorder}33` : 'none',
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
                                          <span style={{ flexShrink: 0, width: '16px', height: '16px', borderRadius: '50%', background: isSelected ? t.selBorder : t.badge, color: '#fff', fontSize: '0.6rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {isSelected ? '✓' : rIdx + 1}
                                          </span>
                                          <span style={{ flex: 1, fontSize: '0.7rem', fontWeight: 700, color: t.text, lineHeight: 1.25, wordBreak: 'break-word' }}>
                                            {role.organisasiTujuan}
                                          </span>
                                          {autoIdx === rIdx && !isSelected && (
                                            <span style={{ flexShrink: 0, fontSize: '0.58rem', fontWeight: 700, color: t.badge }}>Terpasang</span>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingLeft: '1.3rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.04rem 0.28rem', borderRadius: '3px', background: isKc ? 'rgba(64,81,137,0.11)' : 'rgba(41,156,219,0.11)', color: isKc ? '#405189' : '#0284c7' }}>
                                            {isKc ? 'Cabang Utama (KC)' : 'Outlet (KCP)'}
                                          </span>
                                          {item.distanceKm !== null ? (
                                            <span
                                              style={{ fontSize: '0.6rem', fontWeight: 700, color: !item.sameIsland ? '#dc2626' : item.distanceKm < 50 ? '#059669' : item.distanceKm < 200 ? '#d97706' : '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}
                                              title={!item.sameIsland ? 'Peringatan: cabang ini berada di pulau berbeda' : `Estimasi jarak lurus: ${item.distanceKm} km`}
                                            >
                                              <MapPin size={9} />
                                              {item.distanceKm.toLocaleString('id-ID')} km
                                              {!item.sameIsland && ' ⚠️ beda pulau'}
                                            </span>
                                          ) : (
                                            <span style={{ fontSize: '0.6rem', color: '#adb5bd' }}>jarak tidak diketahui</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {selectedIdx >= 0 && topRoles[selectedIdx] && (
                                    <div style={{ fontSize: '0.62rem', color: '#059669', fontWeight: 600, background: 'rgba(16,185,129,0.07)', borderRadius: '4px', padding: '0.2rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <CheckCircle2 size={11} />
                                      Dipilih: {topRoles[selectedIdx].rec.organisasiTujuan}
                                    </div>
                                  )}
                                  {selectedIdx >= 0 && topRoles[selectedIdx] && autoIdx !== selectedIdx && (
                                    <button
                                      type="button"
                                      onClick={() => applyFase3Role(r, topRoles[selectedIdx].rec)}
                                      disabled={isProcessing}
                                      style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.22rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, border: '1px solid #059669', borderRadius: '4px', background: '#059669', color: '#fff', cursor: isProcessing ? 'wait' : 'pointer' }}
                                    >
                                      <Check size={11} /> Terapkan Role Ini
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          })()}

                          {/* Kolom 2: cabang Master yang terpasang dari Fase 2, kartunya sama
                              seperti kandidat terpilih di tab Fase 2 supaya operator mengenali
                              objek yang sama di kedua tab. */}
                          {(() => {
                            const m = masterByBranchCode.get(String(r.branchCode || p2?.branchCode || '').trim()) || _activeCandMaster;
                            const tdMaster: React.CSSProperties = {
                              width: '400px',
                              minWidth: '400px',
                              maxWidth: '400px',
                              background: r.fase3Approved ? '#f0fdf4' : '#fffdfa',
                              padding: '0.45rem 0.55rem',
                              verticalAlign: 'top',
                              borderRight: '2px solid rgba(247,184,75,0.45)',
                              boxSizing: 'border-box',
                            };
                            if (!m)
                              return (
                                <td style={tdMaster}>
                                  <span style={{ fontSize: '0.7rem', color: '#adb5bd' }}>
                                    {r.namaOutlet ? `${r.namaOutlet} — cabang master tidak ditemukan di Branch Code ${r.branchCode || '-'}` : 'Cabang belum dipilih — selesaikan Fase 2 dulu'}
                                  </span>
                                </td>
                              );
                            const isKcUnit = getUnitCategory(String(m['Nama Outlet'] || m['Sandi Cabang'] || '')) === 'KC';
                            const wil = extractWilayahFromBranchCode(String(m['Branch Code'] || m['Kode Cabang'] || '').trim(), wilayahSettings, r.wilayah);
                            const isKelMatched = !!(r.kelurahan && m.Kelurahan && cleanKelurahan(r.kelurahan) === cleanKelurahan(m.Kelurahan));
                            const isKecMatched = !!(r.kecamatan && m.Kecamatan && cleanKecamatan(r.kecamatan) === cleanKecamatan(m.Kecamatan));
                            const ell = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const };
                            return (
                              <td style={tdMaster}>
                                <div style={{ border: '1px solid rgba(247,184,75,0.4)', borderRadius: '6px', padding: '0.45rem 0.6rem', background: '#ffffff', overflow: 'hidden' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.3rem', flexWrap: 'nowrap', ...ell }}>
                                    <span style={{ padding: '0.1rem 0.38rem', borderRadius: '3px', fontSize: '0.67rem', fontWeight: 700, background: 'rgba(247,184,75,0.15)', color: '#d97706', flexShrink: 0 }}>
                                      Cabang Fase 2
                                    </span>
                                    <span style={{ padding: '0.1rem 0.38rem', borderRadius: '3px', fontSize: '0.67rem', fontWeight: 700, background: isKcUnit ? 'rgba(64,81,137,0.11)' : 'rgba(41,156,219,0.11)', color: isKcUnit ? '#405189' : '#0284c7', flexShrink: 0 }}>
                                      {isKcUnit ? 'Cabang Utama (KC)' : 'Outlet (KCP)'}
                                    </span>
                                    {r.fase2JarakKm > 0 && (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.67rem', fontWeight: 600, color: '#0d9488', background: 'rgba(13,148,136,0.08)', padding: '0.08rem 0.32rem', borderRadius: '3px', flexShrink: 0 }} title="Estimasi jarak dari kelurahan data ini ke cabang">
                                        <MapPin size={9} /> {Number(r.fase2JarakKm).toLocaleString('id-ID')} km
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.81rem', fontWeight: 600, color: '#212529', marginBottom: '0.1rem', ...ell }} title={`${m['Sandi Cabang'] || m.Cabang || m.Sandi || '-'}${m['Nama Outlet'] ? ` • ${m['Nama Outlet']}` : ''}`}>
                                    {m['Sandi Cabang'] || m.Cabang || m.Sandi || '-'}
                                    {m['Nama Outlet'] && (
                                      <span style={{ fontSize: '0.73rem', color: '#405189', fontWeight: 500, marginLeft: '0.35rem' }}>• {m['Nama Outlet']}</span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: '0.12rem 0 0.22rem', flexWrap: 'nowrap', overflow: 'hidden' }}>
                                    <span className="code-cell" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.69rem', background: '#f3f6f9', color: '#405189', padding: '0.08rem 0.4rem', borderRadius: '3px', border: '1px solid #e9ebec', fontWeight: 600, flexShrink: 0 }} title={`Kode Cabang: ${r.kodeCabang || p2?.kodeCabang || '-'}`}>
                                      <Building2 size={10} /> Branch: <strong>{r.branchCode || p2?.branchCode || '-'}</strong>
                                    </span>
                                    <span className="badge badge-match" style={{ fontSize: '0.69rem', padding: '0.08rem 0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }} title={`Wilayah hasil setting: ${wil.wilayahName || r.wilayah || p2?.wilayah || '-'}`}>
                                      <MapPin size={9} /> {wil.wilayahName || r.wilayah || p2?.wilayah || '-'}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.69rem', color: '#495057', background: '#f8fafc', padding: '0.18rem 0.45rem', borderRadius: '4px', border: '1px solid #e2e8f0', flexWrap: 'nowrap', ...ell }}>
                                    <span>Kel: <strong style={{ color: isKelMatched ? '#059669' : '#1e293b' }}>{m.Kelurahan || '-'}</strong></span>
                                    {isKelMatched && <span style={{ fontSize: '0.6rem', padding: '0.02rem 0.25rem', borderRadius: '3px', background: 'rgba(10,179,156,0.12)', color: '#059669', fontWeight: 700 }} title="Kelurahan sama persis">✓ Sama</span>}
                                    <span style={{ color: '#cbd5e1' }}>•</span>
                                    <span>Kec: <strong style={{ color: isKecMatched ? '#2563eb' : '#1e293b' }}>{m.Kecamatan || '-'}</strong></span>
                                    {isKecMatched && <span style={{ fontSize: '0.6rem', padding: '0.02rem 0.25rem', borderRadius: '3px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 700 }} title="Kecamatan sama persis">✓ Sama</span>}
                                    <span style={{ color: '#cbd5e1' }}>•</span>
                                    <span>{m['Dati II'] || '-'}</span>
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '0.25rem', ...ell }} title={m.ALAMAT || ''}>
                                    Alamat: {m.ALAMAT || '-'}
                                  </div>
                                </div>
                              </td>
                            );
                          })()}
                          <td className="code-cell" style={{ textAlign: 'center', fontWeight: 700 }} title={r.kodePosKelurahan && r.kodePosKelurahan !== r.kodePosPten ? `Kode pos kelurahan ini sendiri: ${r.kodePosKelurahan}` : undefined}>
                            {r.kodePosPten || r.kodePosKelurahan || '-'}
                          </td>
                          <td style={{ fontWeight: 700 }}>{r.kelurahan}</td>
                          <td>{r.kecamatan}</td>
                          <td style={{ fontWeight: 600 }} title={r.kotaPten}>{r.kotaPtenMax15 || r.kotaPten}</td>
                          <td>{r.provinsi}</td>
                        </>
                      )}

                      {/* ACTION REVIEW BUTTONS (Appears on ALL tabs) */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'nowrap', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                          {/* Urutan aksi tab Data Final: Revisi → Detail → Setujui.
                              N0: tidak ada tombol Edit — koreksi data dilakukan di menu Data
                              Master, lalu analisa dijalankan ulang. */}
                          {innerTab === 'BERES' && (
                            <button
                              type="button"
                              onClick={() => setConfirmManualRow(r)}
                              title="Kembalikan baris ini ke tab Perlu Analisa Manual"
                              className="btn-aksi-baris"
                              style={{
                                background: 'rgba(240, 101, 72, 0.1)',
                                border: '1px solid rgba(240, 101, 72, 0.35)',
                                color: '#f06548',
                              }}
                            >
                              <RotateCcw size={12} />
                              <span>Revisi</span>
                            </button>
                          )}
                          {/* N0 butir 4: baris di antrean manual biasanya butuh perbaikan di
                              data master — sediakan pintunya, bukan field edit di sini. */}
                          {innerTab === 'MANUAL' && onBukaMasterCabang && (
                            <button
                              type="button"
                              onClick={onBukaMasterCabang}
                              title="Perbaiki data cabangnya di menu Data Cabang, lalu jalankan ulang fase ini"
                              className="btn-aksi-baris"
                              style={{
                                background: 'rgba(64, 81, 137, 0.1)',
                                border: '1px solid rgba(64, 81, 137, 0.3)',
                                color: '#405189',
                              }}
                            >
                              <Store size={12} />
                              <span>Data Cabang</span>
                            </button>
                          )}
                          {viewTab === 'all' && (
                            <button
                              type="button"
                              onClick={() => setDetailRow(r)}
                              title="Lihat seluruh atribut baris ini beserta hasil analisa tiap fase"
                              className="btn-aksi-baris"
                              style={{
                                background: 'rgba(53, 119, 241, 0.1)',
                                border: '1px solid rgba(53, 119, 241, 0.3)',
                                color: '#3577f1',
                              }}
                            >
                              <Info size={12} />
                              <span>Detail</span>
                            </button>
                          )}
                          {(() => {
                            const diTabManual = innerTab === 'MANUAL';
                            const sudahSetuju = !diTabManual && (
                              viewTab === 'fase1' ? r.fase1Approved :
                              viewTab === 'fase2' ? r.fase2Approved :
                              viewTab === 'fase3' ? r.fase3Approved :
                              r.isFinalApproved
                            );
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  // Tab manual: "setujui" = barisnya sudah beres, tapi fase
                                  // ini belum diterima — ia pindah ke tab Berhasil Dianalisa.
                                  if (diTabManual) {
                                    onBersihkanManual([r.id]);
                                    showToast(`Baris #${r.no} selesai — pindah ke tab Berhasil Dianalisa.`, 'info');
                                  } else if (viewTab === 'fase1') { onUpdateRow({ ...r, fase1Approved: true }); showToast(`Fase 1 baris #${r.no} disetujui!`); }
                                  else if (viewTab === 'fase2') { onUpdateRow({ ...r, fase2Approved: true }); showToast(`Fase 2 baris #${r.no} disetujui!`); }
                                  else if (viewTab === 'fase3') { onUpdateRow({ ...r, fase3Approved: true }); showToast(`Fase 3 baris #${r.no} disetujui!`); }
                                  else { onApproveSingleRow(r.id); showToast(`Baris #${r.no} (${r.namaOutlet}) disetujui!`); }
                                }}
                                title={diTabManual
                                  ? 'Tandai baris ini sudah diperbaiki → pindah ke tab Berhasil Dianalisa'
                                  : sudahSetuju ? 'Sudah disetujui' : 'Setujui hasil baris ini (OK)'}
                                className={`btn-aksi-baris${viewTab === 'fase1' || viewTab === 'all' ? '' : ' btn-aksi-baris-padat'}`}
                                style={{
                                  background: sudahSetuju ? '#0ab39c' : 'rgba(10, 179, 156, 0.1)',
                                  border: '1px solid rgba(10, 179, 156, 0.3)',
                                  color: sudahSetuju ? '#ffffff' : '#0ab39c',
                                }}
                              >
                                <Check size={12} />
                                {(viewTab === 'fase1' || viewTab === 'all') && <span>Setujui</span>}
                              </button>
                            );
                          })()}
                        </div>
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

        {/* Master Pagination Footer */}
        {pageSize !== 'ALL' && totalPages > 1 && (
          <div
            className="pagination-row"
            style={{
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginTop: '1rem',
              borderTop: '1px solid #e9ebec',
              paddingTop: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: '#878a99' }}>
              Halaman <strong style={{ color: '#212529' }}>{page}</strong> dari{' '}
              <strong style={{ color: '#212529' }}>{totalPages}</strong>
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
                title="Halaman Pertama"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronsLeft size={13} />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                title="Halaman Sebelumnya"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronLeft size={13} />
              </button>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0 0.5rem', color: '#405189' }}>
                {page}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                title="Halaman Selanjutnya"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                title="Halaman Terakhir"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem' }}
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal detail kandidat outlet Fase 2 (engine rekomendasi lama) */}
      <CandidateDetailModal
        isOpen={fase2Detail !== null}
        onClose={() => setFase2Detail(null)}
        wilayahSettings={wilayahSettings}
        data={
          fase2Detail
            ? {
                targetRow: fase2Detail.target,
                candidate: fase2Detail.chosen,
                allCandidates: fase2Detail.rec.candidates,
                recommendationReason: fase2Detail.rec.reason,
              }
            : null
        }
        onApprove={(_no, master) => {
          if (fase2Detail) applyFase2Candidate(fase2Detail.row, master);
          setFase2Detail(null);
        }}
      />

      {/* Modal Setujui Pemetaan Kota Manual */}
      <CityOverrideModal
        isOpen={overrideModal !== null}
        masterCity={overrideModal?.masterCity || ''}
        masterRows={overrideModal?.masterRows || []}
        ptenKota={overrideModal?.ptenKota || ''}
        ptenKodePos={overrideModal?.ptenKodePos || []}
        isProcessing={isProcessing}
        onClose={() => setOverrideModal(null)}
        onConfirm={() => {
          if (!overrideModal || !onApproveCityOverride) return;
          const { masterCity, ptenKota, masterRows } = overrideModal;
          setOverrideModal(null);
          setOverrideDrafts((prev) => {
            const next = { ...prev };
            delete next[cityMatchKey(masterCity)];
            return next;
          });
          showToast(`${masterRows.length.toLocaleString('id-ID')} baris ${masterCity} dipetakan ke ${ptenKota} — menganalisa ulang…`);
          onApproveCityOverride(masterCity, ptenKota);
        }}
      />

      {/* Detail baca-saja satu baris (tombol "Detail" di tab Data Final) */}
      <AnalystRowDetailModal
        row={detailRow}
        datiII={detailRow ? kotaKodePosDari(detailRow) : ''}
        onClose={() => setDetailRow(null)}
      />

      {/* Dialog konfirmasi — wajib sebelum menyetujui Fase 1/2/3 & Final Analisa */}
      {(() => {
        const n = stats.total.toLocaleString('id-ID');
        const cfg = {
          fase1: {
            accent: '#299cdb',
            icon: <MapPin size={20} />,
            title: 'Setujui Hasil Fase 1?',
            msg: `Anda akan menyetujui ${n} baris hasil Fase 1 (PTEN & Kode Pos) dan lanjut ke Fase 2 — Wilayah & Master Cabang.`,
            detail: stats.unanalysed > 0
              ? `Masih ada ${stats.unanalysed.toLocaleString('id-ID')} baris kota yang belum terpetakan ("Perlu Analisa Manual"). Baris itu tidak ikut disetujui dan tetap tertinggal di Fase 1.`
              : undefined,
            confirm: 'Ya, Setujui & Lanjut ke Fase 2',
          },
          fase2: {
            accent: '#405189',
            icon: <Building2 size={20} />,
            title: 'Setujui Hasil Fase 2?',
            msg: `Anda akan menyetujui ${n} baris penempatan outlet ke cabang terdekat (Fase 2) dan lanjut ke Fase 3 — Mapping Role & Wondr.`,
            detail: stats.placementReview > 0
              ? `Masih ada ${stats.placementReview.toLocaleString('id-ID')} baris dengan penempatan berstatus "Perlu Review". Pastikan jarak & wilayahnya sudah benar sebelum lanjut.`
              : undefined,
            confirm: 'Ya, Setujui & Lanjut ke Fase 3',
          },
          fase3: {
            accent: '#0ab39c',
            icon: <Users size={20} />,
            title: 'Setujui Hasil Fase 3?',
            msg: `Anda akan menyetujui ${n} baris mapping role & alur Wondr (Fase 3) dan membuka tab Data Final.`,
            detail: stats.anomalies > 0
              ? `Masih ada ${stats.anomalies.toLocaleString('id-ID')} baris berstatus anomali / perlu review. Tinjau dahulu bila ragu.`
              : undefined,
            confirm: 'Ya, Setujui & Buka Data Final',
          },
          final: {
            accent: '#0ab39c',
            icon: <CheckCircle2 size={20} />,
            title: 'Pindahkan ke Final Analisa?',
            msg: `Seluruh ${n} baris hasil analisa Fase 1–3 akan DIPINDAHKAN ke menu Final Data. Menu Data Analyst akan kembali kosong (hanya menyisakan baris yang belum terpetakan).`,
            detail:
              stats.anomalies > 0
                ? `Termasuk ${stats.perluReview.toLocaleString('id-ID')} baris berstatus "perlu direview" dan ${stats.anomali.toLocaleString('id-ID')} baris "anomali" — keduanya ikut dipindahkan dan masih bisa direvisi satu per satu dari menu Final Data. ` +
                  'Tindakan ini bisa dibatalkan kapan saja lewat tombol "Kembalikan ke Data Analyst" di menu Final Data.'
                : 'Tindakan ini bisa dibatalkan kapan saja lewat tombol "Kembalikan ke Data Analyst" di menu Final Data.',
            confirm: 'Ya, Pindahkan ke Final Data',
          },
        }[confirmKind ?? 'fase1'];
        return (
          <ConfirmDialog
            isOpen={confirmKind !== null}
            icon={cfg.icon}
            accent={cfg.accent}
            title={cfg.title}
            message={cfg.msg}
            detail={cfg.detail}
            confirmLabel={cfg.confirm}
            onConfirm={handleConfirmApprove}
            onClose={() => setConfirmKind(null)}
          />
        );
      })()}
      {/* Konfirmasi revisi ke Perlu Analisa Manual (menggantikan window.confirm) */}
      <ConfirmDialog
        isOpen={confirmManualRow !== null}
        icon={<AlertTriangle size={20} />}
        accent="#f7b84b"
        title="Revisi Baris?"
        message={confirmManualRow ? `Baris #${confirmManualRow.no} (${confirmManualRow.namaOutlet || confirmManualRow.kelurahan}) akan dikembalikan ke tab “Perlu Analisa Manual” pada fase yang sama.` : ''}
        confirmLabel="Ya, Revisi"
        onConfirm={() => {
          if (!confirmManualRow) return;
          onUpdateRow({ ...confirmManualRow, perluManual: true });
          showToast(`Baris #${confirmManualRow.no} dikembalikan ke tab Perlu Analisa Manual.`, 'info');
          setConfirmManualRow(null);
        }}
        onClose={() => setConfirmManualRow(null)}
      />
    </div>
  );
};
