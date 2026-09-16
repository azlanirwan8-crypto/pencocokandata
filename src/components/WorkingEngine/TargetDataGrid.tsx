import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  MapPin,
  Play,
  RotateCcw,
  X,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Check,
  HelpCircle,
  Layers,
  Info,
  Eye,
  SlidersHorizontal,
  ExternalLink,
  Building2,
  Shield,
} from 'lucide-react';
import type { RoleMappingRecord } from '../../components/RoleMapping/RoleMappingManager';
import { getUnitCategory } from '../../components/RoleMapping/RoleMappingManager';
import type { TargetRow, MasterRow, WilayahSetting } from '../../types';
import {
  generateRecommendationsProgressive,
  buildMasterProximityIndex,
  findClosestMasterRecommendation,
  type RecommendationResult,
  type CandidateOption,
} from '../../utils/recommender';
import { ProximityGuideModal } from './ProximityGuideModal';
import { CandidateDetailModal } from './CandidateDetailModal';
import { formatWilayahName, extractWilayahFromBranchCode, cleanKelurahan, cleanKecamatan } from '../../utils/normalizer';

export interface ColumnOption {
  key: string;
  label: string;
}

export const TOGGLEABLE_COLUMNS: ColumnOption[] = [
  { key: 'Branch Code', label: 'Branch Code' },
  { key: 'Kode Cabang', label: 'Kode Cabang' },
  { key: 'Nama Outlet', label: 'Nama Outlet' },
  { key: 'Status Outlet', label: 'Status Outlet' },
  { key: 'ALAMAT', label: 'ALAMAT Master' },
  { key: 'KODE POS', label: 'KODE POS Target' },
  { key: 'Kelurahan', label: 'Kelurahan Target' },
  { key: 'Kecamatan', label: 'Kecamatan Target' },
  { key: 'Dati II', label: 'Dati II Target' },
  { key: 'Kode Dati II', label: 'Kode Dati II Target' },
  { key: 'Provinsi', label: 'Provinsi Target' },
  { key: 'PTEN', label: 'Validasi PTEN' },
  { key: 'RoleMapping', label: 'Tipe Unit & Alur Wondr' },
];

interface TargetDataGridProps {
  rows: TargetRow[];
  totalInputRows: number;
  masterRows: MasterRow[];
  wilayahList: string[];
  selectedWilayah: string;
  onWilayahChange: (wilayah: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  onExecuteMatching: () => void;
  onApproveAllRecommendations: (recommendations: RecommendationResult[]) => void;
  onApproveRecommendation: (rowNo: number | string, recommendedMaster: MasterRow) => void;
  onRevertRecommendation?: (rowNo: number | string) => void;
  isProcessing: boolean;
  canExecute: boolean;
  matchedDone?: boolean;
  wilayahSettings?: WilayahSetting[];
  roleMappingList?: RoleMappingRecord[];
}

/** Koordinat pusat kota (lat, lng) dan pulau untuk semua branch office BNI yang ada di mapping */
const CITY_GEO: Record<string, { lat: number; lng: number; island: string }> = {
  // ── JAWA ──────────────────────────────────────────────────────────────────
  JAKARTA: { lat: -6.2088, lng: 106.8456, island: 'Jawa' },
  'JAKARTA PUSAT': { lat: -6.1862, lng: 106.8307, island: 'Jawa' },
  'JAKARTA THAMRIN': { lat: -6.2009, lng: 106.8229, island: 'Jawa' },
  'JAKARTA UTARA': { lat: -6.1382, lng: 106.8668, island: 'Jawa' },
  'JAKARTA SELATAN': { lat: -6.2615, lng: 106.8106, island: 'Jawa' },
  'JAKARTA BARAT': { lat: -6.1673, lng: 106.7636, island: 'Jawa' },
  'JAKARTA TIMUR': { lat: -6.2257, lng: 106.9004, island: 'Jawa' },
  BOGOR: { lat: -6.5971, lng: 106.8060, island: 'Jawa' },
  BEKASI: { lat: -6.2383, lng: 106.9756, island: 'Jawa' },
  DEPOK: { lat: -6.4025, lng: 106.7942, island: 'Jawa' },
  TANGERANG: { lat: -6.1783, lng: 106.6319, island: 'Jawa' },
  BANDUNG: { lat: -6.9175, lng: 107.6191, island: 'Jawa' },
  'BANDUNG ASIA AFRIKA': { lat: -6.9210, lng: 107.6068, island: 'Jawa' },
  CIREBON: { lat: -6.7063, lng: 108.5571, island: 'Jawa' },
  TASIKMALAYA: { lat: -7.3274, lng: 108.2207, island: 'Jawa' },
  BANJAR: { lat: -7.3673, lng: 108.5400, island: 'Jawa' },
  SUKABUMI: { lat: -6.9177, lng: 106.9280, island: 'Jawa' },
  KARAWANG: { lat: -6.3219, lng: 107.3387, island: 'Jawa' },
  SEMARANG: { lat: -7.0051, lng: 110.4381, island: 'Jawa' },
  'SEMARANG BRIGJEN SUDIARTO': { lat: -6.9748, lng: 110.4487, island: 'Jawa' },
  SOLO: { lat: -7.5755, lng: 110.8243, island: 'Jawa' },
  SURAKARTA: { lat: -7.5755, lng: 110.8243, island: 'Jawa' },
  YOGYAKARTA: { lat: -7.7956, lng: 110.3695, island: 'Jawa' },
  SURABAYA: { lat: -7.2575, lng: 112.7521, island: 'Jawa' },
  'SURABAYA BASUKI RAHMAT': { lat: -7.2619, lng: 112.7391, island: 'Jawa' },
  MALANG: { lat: -7.9666, lng: 112.6326, island: 'Jawa' },
  SIDOARJO: { lat: -7.4478, lng: 112.7183, island: 'Jawa' },
  KEDIRI: { lat: -7.8167, lng: 112.0115, island: 'Jawa' },
  PASURUAN: { lat: -7.6449, lng: 112.9031, island: 'Jawa' },
  MADIUN: { lat: -7.6298, lng: 111.5243, island: 'Jawa' },
  JEMBER: { lat: -8.1845, lng: 113.6882, island: 'Jawa' },
  BANYUWANGI: { lat: -8.2192, lng: 114.3691, island: 'Jawa' },
  // ── SUMATERA ──────────────────────────────────────────────────────────────
  MEDAN: { lat: 3.5952, lng: 98.6722, island: 'Sumatera' },
  'MEDAN BALAI KOTA': { lat: 3.5862, lng: 98.6764, island: 'Sumatera' },
  PALEMBANG: { lat: -2.9761, lng: 104.7754, island: 'Sumatera' },
  PADANG: { lat: -0.9493, lng: 100.3543, island: 'Sumatera' },
  PEKANBARU: { lat: 0.5071, lng: 101.4478, island: 'Sumatera' },
  BATAM: { lat: 1.1301, lng: 104.0529, island: 'Sumatera' },
  JAMBI: { lat: -1.6101, lng: 103.6131, island: 'Sumatera' },
  BANDA_ACEH: { lat: 5.5483, lng: 95.3238, island: 'Sumatera' },
  ACEH: { lat: 5.5483, lng: 95.3238, island: 'Sumatera' },
  BANDAR_LAMPUNG: { lat: -5.4295, lng: 105.2610, island: 'Sumatera' },
  LAMPUNG: { lat: -5.4295, lng: 105.2610, island: 'Sumatera' },
  BENGKULU: { lat: -3.7928, lng: 102.2608, island: 'Sumatera' },
  RANTAUPRAPAT: { lat: 2.0948, lng: 99.8308, island: 'Sumatera' },
  KISARAN: { lat: 2.9826, lng: 99.6100, island: 'Sumatera' },
  'PEMATANG SIANTAR': { lat: 2.9598, lng: 99.0687, island: 'Sumatera' },
  'TEBING TINGGI': { lat: 3.3272, lng: 99.1625, island: 'Sumatera' },
  // ── KALIMANTAN ────────────────────────────────────────────────────────────
  BALIKPAPAN: { lat: -1.2654, lng: 116.8312, island: 'Kalimantan' },
  SAMARINDA: { lat: -0.5022, lng: 117.1536, island: 'Kalimantan' },
  BANJARMASIN: { lat: -3.3186, lng: 114.5944, island: 'Kalimantan' },
  PONTIANAK: { lat: -0.0263, lng: 109.3425, island: 'Kalimantan' },
  PALANGKARAYA: { lat: -2.2096, lng: 113.9136, island: 'Kalimantan' },
  // ── SULAWESI ──────────────────────────────────────────────────────────────
  MAKASSAR: { lat: -5.1477, lng: 119.4327, island: 'Sulawesi' },
  MANADO: { lat: 1.4748, lng: 124.8421, island: 'Sulawesi' },
  PALU: { lat: -0.8917, lng: 119.8707, island: 'Sulawesi' },
  KENDARI: { lat: -3.9985, lng: 122.5130, island: 'Sulawesi' },
  GORONTALO: { lat: 0.5387, lng: 123.0595, island: 'Sulawesi' },
  // ── BALI ──────────────────────────────────────────────────────────────────
  DENPASAR: { lat: -8.6705, lng: 115.2126, island: 'Bali' },
  'DENPASAR RENON': { lat: -8.6784, lng: 115.2215, island: 'Bali' },
  // ── NUSA TENGGARA ─────────────────────────────────────────────────────────
  MATARAM: { lat: -8.5833, lng: 116.1167, island: 'Lombok' },
  KUPANG: { lat: -10.1772, lng: 123.6070, island: 'NTT' },
  ENDE: { lat: -8.8432, lng: 121.6573, island: 'NTT' },
  // ── MALUKU ────────────────────────────────────────────────────────────────
  AMBON: { lat: -3.6954, lng: 128.1814, island: 'Maluku' },
  TERNATE: { lat: 0.7821, lng: 127.3787, island: 'Maluku Utara' },
  // ── PAPUA ─────────────────────────────────────────────────────────────────
  JAYAPURA: { lat: -2.5337, lng: 140.7181, island: 'Papua' },
  MANOKWARI: { lat: -0.8670, lng: 134.0806, island: 'Papua Barat' },
  SORONG: { lat: -0.8767, lng: 131.2520, island: 'Papua Barat' },
};

/** Haversine distance (km) antara dua titik koordinat */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Ekstrak nama kota dari nama organisasi (e.g. "JAKARTA PUSAT BRANCH OFFICE" → "JAKARTA PUSAT") */
function extractCityFromOrgName(orgName: string): string {
  return orgName
    .toUpperCase()
    .replace(/\s*BRANCH OFFICE.*$/i, '')
    .replace(/\s*-.*$/i, '')
    .trim();
}

/** Lookup koordinat kota — coba exact match dulu, lalu first-token match */
function lookupCityGeo(cityName: string): { lat: number; lng: number; island: string } | null {
  if (!cityName) return null;
  const key = cityName.toUpperCase().trim();
  if (CITY_GEO[key]) return CITY_GEO[key];
  // First token (e.g. "JAKARTA" from "JAKARTA PUSAT")
  const firstToken = key.split(/\s+/)[0];
  if (firstToken && CITY_GEO[firstToken]) return CITY_GEO[firstToken];
  // Partial match scan
  for (const [k, v] of Object.entries(CITY_GEO)) {
    if (key.startsWith(k) || k.startsWith(key)) return v;
  }
  return null;
}

export interface RoleMatchWithDistance {
  rec: RoleMappingRecord;
  distanceKm: number | null;
  sameIsland: boolean;
  branchCity: string;
}

/**
 * Find top 3 role mapping branches with ALL 3 roles complete (M=1, C=1, S=1)
 * • Filter: same island as active candidate only
 * • Sort: closest first (haversine distance in km)
 */
function findTopRoleMatchesByLocation(
  activeCandidateDati2: string,
  activeProvinsi: string,
  roleMappingList: RoleMappingRecord[],
  count = 3
): RoleMatchWithDistance[] {
  if (!roleMappingList || roleMappingList.length === 0) return [];

  // Filter: only full 3-role branches (Maker=1, Checker=1, Signer=1)
  const fullRoleList = roleMappingList.filter(
    (r) => r.qrsCabsal === 1 && r.qrsCabapv1 === 1 && r.qrsCabapv2 === 1
  );
  if (fullRoleList.length === 0) return [];

  // Resolve candidate's geo
  const candidateCity = String(activeCandidateDati2 || '')
    .toUpperCase()
    .replace(/^(KOTA|KABUPATEN|KAB)\s+/i, '')
    .trim();
  const candidateGeo = lookupCityGeo(candidateCity) ||
    lookupCityGeo(String(activeProvinsi || '').replace(/^PROVINSI\s*/i, '').trim());

  const scored: RoleMatchWithDistance[] = fullRoleList.map((rec) => {
    const branchCity = extractCityFromOrgName(rec.organisasiTujuan);
    const branchGeo = lookupCityGeo(branchCity);

    let distanceKm: number | null = null;
    let sameIsland = true; // default: tampilkan jika tidak bisa tentukan pulau

    if (candidateGeo && branchGeo) {
      distanceKm = Math.round(haversineKm(candidateGeo.lat, candidateGeo.lng, branchGeo.lat, branchGeo.lng));
      sameIsland = candidateGeo.island === branchGeo.island;
    }

    return { rec, distanceKm, sameIsland, branchCity };
  });

  // Prioritaskan: same island saja, sort by distance asc
  const sameIslandList = scored.filter((s) => s.sameIsland);
  const sortedSameIsland = sameIslandList.sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) return 0;
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    return a.distanceKm - b.distanceKm;
  });

  if (sortedSameIsland.length >= count) {
    return sortedSameIsland.slice(0, count);
  }

  // Jika kurang dari count, tambah dari pulau lain (fallback)
  const otherIsland = scored
    .filter((s) => !s.sameIsland)
    .sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

  return [...sortedSameIsland, ...otherIsland].slice(0, count);
}

export const TargetDataGrid: React.FC<TargetDataGridProps> = ({
  rows,
  totalInputRows: _totalInputRows,
  masterRows,
  wilayahList,
  selectedWilayah,
  onWilayahChange,
  searchTerm,
  onSearchChange,
  onExecuteMatching,
  onApproveAllRecommendations,
  onApproveRecommendation,
  onRevertRecommendation,
  isProcessing,
  canExecute,
  matchedDone = false,
  wilayahSettings = [],
  roleMappingList = [],
}) => {
  // 3 Sub-Tabs State: 'upload' | 'recommendation' | 'matched'
  const [checkerTab, setCheckerTab] = useState<'upload' | 'recommendation' | 'matched'>('upload');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const effectivePageSize = useMemo(() => (pageSize === 'all' ? 999999 : pageSize), [pageSize]);

  // Multi-Selection State for Recommendations Tab
  const [selectedRowNos, setSelectedRowNos] = useState<Set<string | number>>(new Set());

  // Column Visibility Toggle State (with localStorage persistence)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('target_grid_hidden_cols');
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
  });
  const [isColDropdownOpen, setIsColDropdownOpen] = useState<boolean>(false);

  const toggleCol = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem('target_grid_hidden_cols', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Reset multi-select when switching tabs, filtering wilayah, or searching
  useEffect(() => {
    setSelectedRowNos(new Set());
  }, [checkerTab, searchTerm, selectedWilayah]);

  // Reactive Set of matched row numbers for O(1) checks and 100% reliable synchronization across stale references
  const matchedNoSet = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r._isMatched) {
        set.add(String(r.No).trim());
      }
    }
    return set;
  }, [rows]);

  // Helper to determine if a row is clean / matched
  const isRowMatched = (r: TargetRow) => Boolean(r._isMatched || (r?.No !== undefined && matchedNoSet.has(String(r.No).trim())));

  // Tab 3: Data Match (Data Bersih yang sudah cocok) - SELALU TERSEDIA jika ada data matched, tidak hilang saat upload baru
  const matchedRows = useMemo(() => {
    return rows.filter(isRowMatched);
  }, [rows, matchedNoSet]);

  // Tab 2: Unmatched (Data yang sudah dianalisa tetapi belum cocok -> masuk rekomendasi)
  const unmatchedRows = useMemo(() => {
    return rows.filter((r) => !isRowMatched(r) && r._matchLevel === 'none');
  }, [rows, matchedNoSet]);

  // Tab 1: Data Upload (Data baru hasil upload yang masih menunggu pencocokan)
  const pendingUploadRows = useMemo(() => {
    return rows.filter((r) => !isRowMatched(r) && r._matchLevel !== 'none');
  }, [rows, matchedNoSet]);

  // Scope Rekomendasi di Tab 2: 'unmatched' atau 'all' (Audit Seluruh Data)
  const [recommendationScope, setRecommendationScope] = useState<'unmatched' | 'all'>(() => {
    return rows.some((r) => r._hasUserFilledData) ? 'all' : 'unmatched';
  });

  // Otomatis sinkronkan ke 'all' bila file Excel yang diunggah terdeteksi berisi data pengerjaan
  useEffect(() => {
    if (rows.some((r) => r._hasUserFilledData)) {
      setRecommendationScope('all');
    }
  }, [rows]);

  // Menentukan baris target yang dievaluasi rekomendasinya di Tab 2
  // PENTING: Hanya baris yang BELUM MATCH (!isRowMatched) yang masuk rekomendasi!
  // Jika sudah disetujui (matched), baris otomatis dikeluarkan dari rekomendasi.
  const targetRecommendationRows = useMemo(() => {
    const unapprovedRows = rows.filter((r) => !isRowMatched(r));
    if (recommendationScope === 'all') {
      return unapprovedRows;
    }
    if (unmatchedRows.length > 0) {
      return unmatchedRows;
    }
    if (pendingUploadRows.length > 0) {
      return pendingUploadRows;
    }
    return unapprovedRows;
  }, [recommendationScope, unmatchedRows, pendingUploadRows, rows, matchedNoSet]);

  // Build Master Proximity Index once (O(1) bucket index)
  const masterProximityIndex = useMemo(() => {
    return buildMasterProximityIndex(masterRows);
  }, [masterRows]);

  // Recommendations state - LAZY evaluated so opening 'Data Cek' is 100% INSTANT!
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [isComputingRecs, setIsComputingRecs] = useState<boolean>(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState<{
    targetRow: TargetRow;
    candidate: CandidateOption;
  } | null>(null);
  const [activeCandidateByRow, setActiveCandidateByRow] = useState<Record<string | number, number>>({});
  // Tracks selected role-mapping branch index (0-based) per row No
  const [selectedRoleByRow, setSelectedRoleByRow] = useState<Record<string | number, number>>({});

  // Fingerprint cache & background cancel ref to prevent redundant calculation
  const lastAnalyzedFingerprintRef = useRef<string>('');
  const cancelProgressiveRef = useRef<(() => void) | null>(null);

  // Progressive rendering state for pageSize === 'all' (smooth 60 FPS, no freeze)
  const [renderedLimit, setRenderedLimit] = useState<number>(60);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Helper membandingkan kesesuaian wilayah (raw atau normalized "Wilayah 1" vs "1")
  const isWilayahMatch = (val: unknown, selected: string): boolean => {
    if (!selected || selected === 'ALL') return true;
    if (!val) return false;
    const s = String(val).trim();
    if (!s) return false;
    if (s.toLowerCase() === selected.toLowerCase()) return true;
    const normA = formatWilayahName(s).toLowerCase();
    const normB = formatWilayahName(selected).toLowerCase();
    return normA === normB;
  };

  // Trigger recommendation calculation in BACKGROUND as soon as data is ready!
  // Sesuai request: Tidak mengganggu UI, berjalan di latar belakang, dan tidak wipe saat pindah tab
  useEffect(() => {
    if (targetRecommendationRows.length === 0 || masterRows.length === 0) {
      setRecommendations([]);
      lastAnalyzedFingerprintRef.current = '';
      setIsComputingRecs(false);
      return;
    }

    // Dataset fingerprint
    const currentFingerprint = `${targetRecommendationRows.length}-${targetRecommendationRows[0]?.No || ''}-${targetRecommendationRows[targetRecommendationRows.length - 1]?.No || ''}-${masterRows.length}`;

    // Jika data sama persis, pertahankan rekomendasi di memori (0ms instant display)
    if (recommendations.length > 0 && lastAnalyzedFingerprintRef.current === currentFingerprint) {
      return;
    }

    if (cancelProgressiveRef.current) {
      cancelProgressiveRef.current();
    }

    setIsComputingRecs(true);
    lastAnalyzedFingerprintRef.current = currentFingerprint;

    const cancel = generateRecommendationsProgressive(
      targetRecommendationRows,
      masterRows,
      masterProximityIndex,
      (recs, isDone) => {
        setRecommendations(recs);
        if (isDone || recs.length >= targetRecommendationRows.length) {
          setIsComputingRecs(false);
        }
      },
      35,
      120
    );

    cancelProgressiveRef.current = cancel;

    return () => {
      // Tetap berjalan di background saat user pindah tab
    };
  }, [targetRecommendationRows, masterRows, masterProximityIndex]);

  // Bersihkan worker hanya saat unmount
  useEffect(() => {
    return () => {
      if (cancelProgressiveRef.current) {
        cancelProgressiveRef.current();
      }
    };
  }, []);

  // Auto load more rows secara halus saat scroll mendekati bawah pada mode 'all'
  useEffect(() => {
    if (pageSize !== 'all') return;
    const totalItems = checkerTab === 'recommendation' ? currentTabRecs.length : currentTabRows.length;
    if (renderedLimit >= totalItems) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRenderedLimit((prev) => Math.min(prev + 60, totalItems));
        }
      },
      { rootMargin: '250px' }
    );

    const el = sentinelRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
  }, [pageSize, renderedLimit, checkerTab]);

  // Reset rendered limit saat tab, filter, atau pencarian berganti
  useEffect(() => {
    setRenderedLimit(60);
  }, [checkerTab, selectedWilayah, searchTerm, pageSize]);

  // Determine current dataset based on active tab with search & wilayah filter
  const currentTabRows = useMemo(() => {
    let source: TargetRow[] = [];
    if (checkerTab === 'upload') {
      source = pendingUploadRows;
    } else if (checkerTab === 'matched') {
      source = matchedRows;
    } else {
      return [];
    }

    // Filter by Wilayah
    if (selectedWilayah !== 'ALL') {
      source = source.filter((r) => isWilayahMatch(r.Wilayah, selectedWilayah));
    }

    // Filter by Search Term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      source = source.filter((r) => {
        return (
          String(r.No || '').toLowerCase().includes(q) ||
          String(r.Wilayah || '').toLowerCase().includes(q) ||
          String(r.Sandi || '').toLowerCase().includes(q) ||
          String(r.Cabang || '').toLowerCase().includes(q) ||
          String(r['Sandi Cabang'] || '').toLowerCase().includes(q) ||
          String(r['Nama Outlet'] || '').toLowerCase().includes(q) ||
          String(r.ALAMAT || '').toLowerCase().includes(q) ||
          String(r['KODE POS'] || '').toLowerCase().includes(q) ||
          String(r.Kecamatan || '').toLowerCase().includes(q) ||
          String(r.Kelurahan || '').toLowerCase().includes(q) ||
          String(r['Dati II'] || '').toLowerCase().includes(q)
        );
      });
    }

    return source;
  }, [checkerTab, pendingUploadRows, matchedRows, selectedWilayah, searchTerm]);

  const currentTabRecs = useMemo(() => {
    if (checkerTab !== 'recommendation') return [];
    // HANYA data yang belum disetujui / belum match yang tampil di tab rekomendasi
    let list = recommendations.filter((rec) => !isRowMatched(rec.targetRow));

    // 1. FILTER BERDASARKAN WILAYAH
    if (selectedWilayah !== 'ALL') {
      list = list.filter((rec) => {
        const r = rec.targetRow;
        const m = rec.recommendedMaster;
        const activeRank = activeCandidateByRow[r.No] || 1;
        const activeCand = (rec.candidates || []).find((c) => c.rank === activeRank) || rec.candidates?.[0];
        const candMaster = activeCand?.master || m;

        // A. Wilayah dari Branch Code via setting wilayah (digit 2 & 3)
        const candWil = extractWilayahFromBranchCode(
          candMaster?.['Branch Code'] || candMaster?.['Kode Cabang'] || r?.['Branch Code'] || '',
          wilayahSettings,
          candMaster?.Wilayah || r?.Wilayah || '-'
        );
        if (candWil.wilayahName && isWilayahMatch(candWil.wilayahName, selectedWilayah)) {
          return true;
        }

        // B. Wilayah dari Master Cabang
        if (candMaster?.Wilayah && isWilayahMatch(candMaster.Wilayah, selectedWilayah)) {
          return true;
        }

        // C. Wilayah dari Baris Target Excel
        if (r?.Wilayah && isWilayahMatch(r.Wilayah, selectedWilayah)) {
          return true;
        }

        // D. Wilayah dari opsi kandidat alternatif
        if (
          (rec.candidates || []).some((c) => {
            const cWil = extractWilayahFromBranchCode(
              c.master?.['Branch Code'] || c.master?.['Kode Cabang'] || '',
              wilayahSettings,
              c.master?.Wilayah || '-'
            );
            return (
              (cWil.wilayahName && isWilayahMatch(cWil.wilayahName, selectedWilayah)) ||
              (c.master?.Wilayah && isWilayahMatch(c.master.Wilayah, selectedWilayah))
            );
          })
        ) {
          return true;
        }

        return false;
      });
    }

    // 2. FILTER BERDASARKAN SEARCH TERM
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((rec) => {
        const r = rec.targetRow;
        const m = rec.recommendedMaster;
        const candsMatch = (rec.candidates || []).some((c) => {
          const cm = c.master;
          return (
            String(cm['Branch Code'] || '').toLowerCase().includes(q) ||
            String(cm['Sandi Cabang'] || cm.Cabang || cm.Sandi || '').toLowerCase().includes(q) ||
            String(cm['Nama Outlet'] || '').toLowerCase().includes(q) ||
            String(cm.ALAMAT || '').toLowerCase().includes(q) ||
            String(cm.Kecamatan || '').toLowerCase().includes(q) ||
            String(cm['Dati II'] || '').toLowerCase().includes(q) ||
            String(cm['KODE POS'] || '').toLowerCase().includes(q)
          );
        });

        return (
          candsMatch ||
          String(r.No || '').toLowerCase().includes(q) ||
          String(r['Branch Code'] || '').toLowerCase().includes(q) ||
          String(r.Wilayah || '').toLowerCase().includes(q) ||
          String(r.ALAMAT || '').toLowerCase().includes(q) ||
          String(r['KODE POS'] || '').toLowerCase().includes(q) ||
          String(r.Kecamatan || '').toLowerCase().includes(q) ||
          String(r.Kelurahan || '').toLowerCase().includes(q) ||
          String(r['Dati II'] || '').toLowerCase().includes(q) ||
          String(m['Branch Code'] || '').toLowerCase().includes(q) ||
          String(m['Sandi Cabang'] || m.Cabang || '').toLowerCase().includes(q) ||
          String(m['Nama Outlet'] || '').toLowerCase().includes(q) ||
          String(m.ALAMAT || '').toLowerCase().includes(q)
        );
      });
    }

    // STRICT GUARANTEE: Urutan rekomendasi SELALU 100% mengikuti urutan baris Excel yang diupload!
    return [...list].sort((a, b) => {
      const idxA = Number(a.targetRow._excelRowIndex ?? a.targetRow.No) || 0;
      const idxB = Number(b.targetRow._excelRowIndex ?? b.targetRow.No) || 0;
      return idxA - idxB;
    });
  }, [checkerTab, recommendations, selectedWilayah, searchTerm, activeCandidateByRow, wilayahSettings]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    const totalItems = checkerTab === 'recommendation' ? currentTabRecs.length : currentTabRows.length;
    return Math.ceil(totalItems / effectivePageSize) || 1;
  }, [checkerTab, currentTabRecs.length, currentTabRows.length, pageSize, effectivePageSize]);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return currentTabRows.slice(0, renderedLimit);
    const start = (page - 1) * effectivePageSize;
    return currentTabRows.slice(start, start + effectivePageSize);
  }, [currentTabRows, page, pageSize, effectivePageSize, renderedLimit]);

  const paginatedRecs = useMemo(() => {
    if (pageSize === 'all') return currentTabRecs.slice(0, renderedLimit);
    const start = (page - 1) * effectivePageSize;
    return currentTabRecs.slice(start, start + effectivePageSize);
  }, [currentTabRecs, page, pageSize, effectivePageSize, renderedLimit]);

  const hasCombinedSandiCabang = rows.some((r) => r['Sandi Cabang'] && (!r.Sandi || r.Sandi === r['Sandi Cabang']));

  // Cek apakah seluruh baris rekomendasi di halaman saat ini sudah dicentang
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedRecs.length === 0) return false;
    return paginatedRecs.every((rec) => selectedRowNos.has(rec.targetRow.No));
  }, [paginatedRecs, selectedRowNos]);

  // Toggle centang semua di halaman saat ini
  const toggleSelectAllCurrentPage = () => {
    setSelectedRowNos((prev) => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        paginatedRecs.forEach((rec) => next.delete(rec.targetRow.No));
      } else {
        paginatedRecs.forEach((rec) => next.add(rec.targetRow.No));
      }
      return next;
    });
  };

  // Toggle centang satu baris
  const toggleSelectRow = (no: string | number) => {
    setSelectedRowNos((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  // Setujui satu rekomendasi (Langsung update state rekomendasi lokal agar instan 0ms)
  const handleApproveSingle = (rowNo: number | string, m: MasterRow) => {
    const targetNoStr = String(rowNo).trim();
    setRecommendations((prev) => prev.filter((r) => String(r.targetRow.No).trim() !== targetNoStr));
    onApproveRecommendation(rowNo, m);
  };

  // Setujui Rekomendasi Terpilih (Batch Selected Approval)
  const handleApproveSelected = () => {
    if (selectedRowNos.size === 0) return;
    const selectedStrSet = new Set(Array.from(selectedRowNos).map((s) => String(s).trim()));
    const selectedRecs: RecommendationResult[] = [];

    recommendations.forEach((rec) => {
      const recNoStr = String(rec.targetRow.No).trim();
      if (selectedStrSet.has(recNoStr)) {
        const activeRank = activeCandidateByRow[rec.targetRow.No];
        if (activeRank && rec.candidates) {
          const chosen = rec.candidates.find((c) => c.rank === activeRank);
          if (chosen) {
            selectedRecs.push({
              ...rec,
              recommendedMaster: chosen.master,
              score: chosen.score,
              reason: chosen.reason,
            });
            return;
          }
        }
        selectedRecs.push(rec);
      }
    });

    onApproveAllRecommendations(selectedRecs);
    setRecommendations((prev) => prev.filter((r) => !selectedStrSet.has(String(r.targetRow.No).trim())));
    setSelectedRowNos(new Set());
    if (selectedRecs.length >= recommendations.length) {
      setCheckerTab('matched');
      setPage(1);
    }
  };

  // Setujui Semua Rekomendasi: Menyetujui seluruh baris yang belum match, membatalkan worker background, mengosongkan rekomendasi, dan langsung pindah ke Tab Data Match
  const handleApproveAll = () => {
    // 1. Hentikan worker background segera agar tidak memicu rekalkulasi berulang
    if (cancelProgressiveRef.current) {
      cancelProgressiveRef.current();
      cancelProgressiveRef.current = null;
    }
    setIsComputingRecs(false);

    // 2. Petakan rekomendasi yang sudah sempat dihitung
    const existingRecMap = new Map<string, RecommendationResult>();
    recommendations.forEach((rec) => {
      existingRecMap.set(String(rec.targetRow.No).trim(), rec);
    });

    // 3. Kumpulkan rekomendasi untuk SELURUH targetRecommendationRows
    const allRecsToApprove: RecommendationResult[] = [];

    for (const row of targetRecommendationRows) {
      const key = String(row.No).trim();
      let rec = existingRecMap.get(key);

      // Jika belum sempat dihitung background worker, hitung saat itu juga via proximity index
      if (!rec) {
        rec = findClosestMasterRecommendation(row, masterProximityIndex) || undefined;
      }

      if (rec) {
        const activeRank = activeCandidateByRow[row.No];
        if (activeRank && rec.candidates) {
          const chosen = rec.candidates.find((c) => c.rank === activeRank);
          if (chosen) {
            allRecsToApprove.push({
              ...rec,
              recommendedMaster: chosen.master,
              score: chosen.score,
              reason: chosen.reason,
            });
            continue;
          }
        }
        allRecsToApprove.push(rec);
      }
    }

    if (allRecsToApprove.length === 0) return;

    onApproveAllRecommendations(allRecsToApprove);
    setSelectedRowNos(new Set());
    setRecommendations([]);
    setIsComputingRecs(false);

    // 4. Pindah langsung ke Tab 3 (Data Match)
    setCheckerTab('matched');
    setPage(1);
  };

  return (
    <div className="glass-card" style={{ marginTop: '0.65rem', padding: '0.75rem 1.1rem' }}>
      {/* Top Header: Title & Matching Execution Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.65rem',
          marginBottom: '0.65rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '0.96rem', fontWeight: 600, color: '#212529', letterSpacing: '-0.01em' }}>
            Pratinjau & Manajemen Data Target
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#878a99', marginTop: '0.1rem' }}>
            {pendingUploadRows.length > 0
              ? `${pendingUploadRows.length.toLocaleString('id-ID')} baris data target baru menunggu pencocokan • ${matchedRows.length.toLocaleString('id-ID')} Data Match (Bersih) tersimpan`
              : `Analisis selesai • ${matchedRows.length.toLocaleString('id-ID')} Data Match (Bersih) • ${unmatchedRows.length.toLocaleString('id-ID')} Rekomendasi Data`}
          </p>
        </div>
      </div>

      {/* 3 SUB-TABS (VELZON UNDERLINE STYLE) */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          borderBottom: '1px solid #e9ebec',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        {/* Tab 1: Data Upload */}
        <button
          type="button"
          onClick={() => {
            setCheckerTab('upload');
            setPage(1);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            fontSize: '0.78rem',
            fontWeight: checkerTab === 'upload' ? 600 : 500,
            color: checkerTab === 'upload' ? '#3577f1' : '#878a99',
            background: 'transparent',
            border: 'none',
            borderBottom: checkerTab === 'upload' ? '2px solid #3577f1' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            marginBottom: '-1px',
          }}
          id="tab-btn-upload"
        >
          <Layers size={13} color={checkerTab === 'upload' ? '#3577f1' : '#878a99'} />
          <span>Data Upload</span>
          <span
            style={{
              padding: '0.08rem 0.42rem',
              borderRadius: '9999px',
              fontSize: '0.67rem',
              fontWeight: 600,
              background: pendingUploadRows.length > 0 ? 'rgba(53, 119, 241, 0.1)' : '#f3f3f9',
              color: pendingUploadRows.length > 0 ? '#3577f1' : '#878a99',
              border: pendingUploadRows.length > 0 ? '1px solid rgba(53, 119, 241, 0.25)' : '1px solid #e9ebec',
            }}
          >
            {pendingUploadRows.length === 0 ? '0 Data (Selesai)' : `${pendingUploadRows.length.toLocaleString('id-ID')} Data`}
          </span>
        </button>

        {/* Tab 2: Rekomendasi Data */}
        <button
          type="button"
          onClick={() => {
            setCheckerTab('recommendation');
            setPage(1);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            fontSize: '0.78rem',
            fontWeight: checkerTab === 'recommendation' ? 600 : 500,
            color: checkerTab === 'recommendation' ? '#d97706' : '#878a99',
            background: 'transparent',
            border: 'none',
            borderBottom: checkerTab === 'recommendation' ? '2px solid #f7b84b' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            marginBottom: '-1px',
          }}
          id="tab-btn-recommendation"
        >
          <Sparkles size={13} color={checkerTab === 'recommendation' ? '#d97706' : '#878a99'} />
          <span>Rekomendasi Data</span>
          <span
            style={{
              padding: '0.08rem 0.42rem',
              borderRadius: '9999px',
              fontSize: '0.67rem',
              fontWeight: 600,
              background: targetRecommendationRows.length > 0 ? 'rgba(247, 184, 75, 0.15)' : '#f3f3f9',
              color: targetRecommendationRows.length > 0 ? '#d97706' : '#878a99',
              border: targetRecommendationRows.length > 0 ? '1px solid rgba(247, 184, 75, 0.3)' : '1px solid #e9ebec',
            }}
          >
            {targetRecommendationRows.length === 0
              ? '0 Rekomendasi (Selesai)'
              : isComputingRecs
              ? `${recommendations.filter((rec) => !isRowMatched(rec.targetRow)).length.toLocaleString('id-ID')} Memproses...`
              : recommendations.filter((rec) => !isRowMatched(rec.targetRow)).length > 0
              ? `${recommendations.filter((rec) => !isRowMatched(rec.targetRow)).length.toLocaleString('id-ID')} Rekomendasi`
              : `${targetRecommendationRows.length.toLocaleString('id-ID')} Siap Dianalisa`}
          </span>
        </button>

        {/* Tab 3: Data Match */}
        <button
          type="button"
          onClick={() => {
            setCheckerTab('matched');
            setPage(1);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            fontSize: '0.78rem',
            fontWeight: checkerTab === 'matched' ? 600 : 500,
            color: checkerTab === 'matched' ? '#0ab39c' : '#878a99',
            background: 'transparent',
            border: 'none',
            borderBottom: checkerTab === 'matched' ? '2px solid #0ab39c' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            marginBottom: '-1px',
          }}
          id="tab-btn-matched"
        >
          <CheckCircle2 size={13} color={checkerTab === 'matched' ? '#0ab39c' : '#878a99'} />
          <span>Data Match</span>
          <span
            style={{
              padding: '0.08rem 0.42rem',
              borderRadius: '9999px',
              fontSize: '0.67rem',
              fontWeight: 600,
              background: matchedRows.length > 0 ? 'rgba(10, 179, 156, 0.12)' : '#f3f3f9',
              color: matchedRows.length > 0 ? '#0ab39c' : '#878a99',
              border: matchedRows.length > 0 ? '1px solid rgba(10, 179, 156, 0.25)' : '1px solid #e9ebec',
            }}
          >
            {matchedRows.length > 0 ? `${matchedRows.length.toLocaleString('id-ID')} Match` : '0 Match'}
          </span>
        </button>
      </div>

      {/* Filter & Search Toolbar (Integrated Clean Velzon Toolbar) */}
      {!(
        (checkerTab === 'upload' && pendingUploadRows.length === 0) ||
        (checkerTab === 'recommendation' && targetRecommendationRows.length === 0 && recommendations.length === 0) ||
        (checkerTab === 'matched' && matchedRows.length === 0)
      ) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'nowrap',
            gap: '0.45rem',
            padding: '0.45rem 0.75rem',
            background: '#ffffff',
            border: '1px solid #e9ebec',
            borderRadius: '6px',
            marginBottom: '0.85rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Toggle Scope Rekomendasi di Tab 2 */}
          {checkerTab === 'recommendation' && rows.length > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f3f6f9', border: '1px solid #e9ebec', borderRadius: '5px', padding: '2px', gap: '2px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => { setRecommendationScope('unmatched'); setPage(1); setRenderedLimit(60); }}
                style={{
                  border: 'none',
                  background: recommendationScope === 'unmatched' ? '#ffffff' : 'transparent',
                  color: recommendationScope === 'unmatched' ? '#212529' : '#6c757d',
                  fontWeight: recommendationScope === 'unmatched' ? 700 : 500,
                  fontSize: '0.72rem',
                  padding: '0.22rem 0.5rem',
                  borderRadius: '4px',
                  boxShadow: recommendationScope === 'unmatched' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Belum Cocok {unmatchedRows.length > 0 ? `(${unmatchedRows.length.toLocaleString('id-ID')})` : ''}
              </button>
              <button
                type="button"
                onClick={() => { setRecommendationScope('all'); setPage(1); setRenderedLimit(60); }}
                style={{
                  border: 'none',
                  background: recommendationScope === 'all' ? '#d97706' : 'transparent',
                  color: recommendationScope === 'all' ? '#ffffff' : '#6c757d',
                  fontWeight: recommendationScope === 'all' ? 700 : 500,
                  fontSize: '0.72rem',
                  padding: '0.22rem 0.5rem',
                  borderRadius: '4px',
                  boxShadow: recommendationScope === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Tampilkan rekomendasi untuk SELURUH baris data target"
              >
                Audit Seluruh Data ({rows.length.toLocaleString('id-ID')})
              </button>
            </div>
          )}

          {/* Separator jika Tab Rekomendasi */}
          {checkerTab === 'recommendation' && rows.length > 0 && (
            <div style={{ width: '1px', height: '18px', background: '#e9ebec', flexShrink: 0 }} />
          )}

          {/* Dropdown Filter Wilayah (Single Unified Clean Box) */}
          <div className="unified-select-box">
            <MapPin size={13} color="#405189" style={{ flexShrink: 0 }} />
            <select
              value={selectedWilayah}
              onChange={(e) => {
                onWilayahChange(e.target.value);
                setPage(1);
                setRenderedLimit(60);
              }}
              id="filter-select-wilayah"
            >
              <option value="ALL">Semua Wilayah ({wilayahList.length})</option>
              {wilayahList.map((w) => (
                <option key={w} value={w}>
                  {formatWilayahName(w)}
                </option>
              ))}
            </select>
          </div>

          {/* Action button in Tab 1: PENCOCOKAN */}
          {checkerTab === 'upload' && pendingUploadRows.length > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onExecuteMatching}
              disabled={!canExecute || isProcessing}
              id="btn-mulai-pencocokan"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.76rem',
                padding: '0.28rem 0.75rem',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {isProcessing ? (
                <>
                  <RotateCcw size={13} className="pulse-dot" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Play size={13} fill="currentColor" />
                  <span>Pencocokan</span>
                </>
              )}
            </button>
          )}

          {/* Action button in Tab 2: SETUJUI SEMUA REKOMENDASI */}
          {checkerTab === 'recommendation' && recommendations.length > 0 && (
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={handleApproveAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                padding: '0.28rem 0.75rem',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
              id="btn-setujui-semua-rekomendasi"
            >
              <Check size={13} />
              <span>Setujui Semua ({recommendations.length.toLocaleString('id-ID')})</span>
            </button>
          )}

          {/* Action button in Tab 2: SETUJUI BARIS TERPILIH */}
          {checkerTab === 'recommendation' && selectedRowNos.size > 0 && (
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={handleApproveSelected}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                padding: '0.28rem 0.75rem',
                background: '#0ab39c',
                borderColor: '#0ab39c',
                fontWeight: 600,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
              id="btn-setujui-terpilih"
            >
              <Check size={13} />
              <span>Setujui {selectedRowNos.size} Terpilih</span>
            </button>
          )}

          {/* Tombol Panduan Skor */}
          {checkerTab === 'recommendation' && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIsGuideModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                padding: '0.28rem 0.65rem',
                color: '#d97706',
                borderColor: 'rgba(247, 184, 75, 0.45)',
                background: '#fffdf5',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
              id="btn-panduan-skor"
              title="Buka panduan sederhana cara sistem menghitung skor kedekatan cabang"
            >
              <HelpCircle size={13} />
              <span>Panduan Skor</span>
            </button>
          )}

          {/* Dropdown Visibilitas Kolom */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIsColDropdownOpen(!isColDropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                padding: '0.28rem 0.65rem',
                color: '#495057',
                borderColor: '#ced4da',
                background: isColDropdownOpen ? '#f3f6f9' : '#ffffff',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
              id="btn-toggle-columns"
              title="Pilih kolom yang ingin ditampilkan atau disembunyikan"
            >
              <SlidersHorizontal size={13} />
              <span>
                Kolom {hiddenCols.size > 0 ? `(${TOGGLEABLE_COLUMNS.length - hiddenCols.size}/${TOGGLEABLE_COLUMNS.length})` : ''}
              </span>
            </button>

            {isColDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '0.35rem',
                  background: '#ffffff',
                  border: '1px solid #e9ebec',
                  borderRadius: '6px',
                  boxShadow: '0 5px 15px rgba(0, 0, 0, 0.12)',
                  zIndex: 50,
                  minWidth: '210px',
                  padding: '0.5rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '0.35rem',
                    borderBottom: '1px solid #f3f6f9',
                    marginBottom: '0.35rem',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#495057' }}>Visibilitas Kolom</span>
                  <button
                    type="button"
                    onClick={() => {
                      setHiddenCols(new Set());
                      localStorage.removeItem('target_grid_hidden_cols');
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '0.68rem',
                      color: '#3577f1',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Reset Semua
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '220px', overflowY: 'auto' }}>
                  {TOGGLEABLE_COLUMNS.map((col) => (
                    <label
                      key={col.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontSize: '0.74rem',
                        color: '#495057',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenCols.has(col.key)}
                        onChange={() => toggleCol(col.key)}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Spacer fleksibel untuk meratakan sisi kanan */}
          <div style={{ flex: 1, minWidth: '4px' }} />

          {/* Tombol Tampilkan Semua Record / Mode Halaman */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setPageSize((prev) => (prev === 'all' ? 15 : 'all'));
              setPage(1);
              setRenderedLimit(60);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.75rem',
              padding: '0.28rem 0.65rem',
              color: pageSize === 'all' ? '#0ab39c' : '#405189',
              borderColor: pageSize === 'all' ? '#0ab39c' : '#ced4da',
              background: pageSize === 'all' ? 'rgba(10, 179, 156, 0.08)' : '#ffffff',
              fontWeight: 600,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
            title="Tampilkan seluruh baris data tanpa batasan per halaman"
          >
            <Eye size={13} />
            <span>{pageSize === 'all' ? 'Mode Paginasi (15 Baris)' : 'Tampilkan Semua Record'}</span>
          </button>

          {/* Input Search */}
          <div className="search-input-wrapper" style={{ flexShrink: 0 }}>
            <Search size={13} className="search-icon-pos" />
            <input
              type="text"
              className="search-input"
              placeholder="Cari Sandi, Outlet, Alamat..."
              value={searchTerm}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setPage(1);
                setRenderedLimit(60);
              }}
              style={{ width: '180px', height: '30px', paddingRight: searchTerm ? '1.8rem' : '0.65rem', fontSize: '0.74rem' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  setPage(1);
                  setRenderedLimit(60);
                }}
                className="search-clear-btn"
                title="Hapus pencarian"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT RENDERING
          ========================================================================= */}

      {/* TAB 2: REKOMENDASI DATA (SMART PROXIMITY SUGGESTIONS) */}
      {checkerTab === 'recommendation' ? (
        (targetRecommendationRows.length === 0 && recommendations.length === 0) ? (
          <div
            style={{
              textAlign: 'center',
              padding: '1.75rem 1.25rem',
              background: '#ffffff',
              borderRadius: '6px',
              border: '1px solid #e9ebec',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(247, 184, 75, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.6rem',
              }}
            >
              <Sparkles size={20} color="#d97706" />
            </div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#212529', margin: '0 0 0.25rem' }}>
              {matchedRows.length > 0 && pendingUploadRows.length === 0
                ? 'Seluruh Rekomendasi Telah Disetujui'
                : 'Belum Ada Rekomendasi Data'}
            </h4>
            <p style={{ fontSize: '0.78rem', color: '#878a99', margin: '0 auto 0.85rem', maxWidth: '440px', lineHeight: 1.5 }}>
              {pendingUploadRows.length > 0
                ? 'Ada data baru di tab Data Upload yang belum dijalankan pencocokan.'
                : matchedRows.length > 0
                ? 'Semua data target telah berhasil dicocokkan dan tersimpan di tab Data Match. Jika ingin membatalkan persetujuan baris tertentu, buka tab Data Match dan klik "Batalkan" agar kembali ke sini.'
                : 'Semua data target telah berhasil dicocokkan ke master data.'}
            </p>
            {pendingUploadRows.length > 0 ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setCheckerTab('upload');
                  setPage(1);
                }}
                style={{ fontSize: '0.76rem', padding: '0.3rem 0.85rem' }}
              >
                Buka Tab Data Upload
              </button>
            ) : matchedRows.length > 0 ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setCheckerTab('matched');
                  setPage(1);
                }}
                style={{ fontSize: '0.76rem', padding: '0.3rem 0.85rem', color: '#0ab39c', borderColor: '#0ab39c' }}
              >
                Lihat di Tab Data Match ({matchedRows.length.toLocaleString('id-ID')})
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {/* Indikator Non-blocking Latar Belakang (Hanya tampil jika masih ada baris yang belum disetujui) */}
            {isComputingRecs && targetRecommendationRows.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.8rem',
                  background: 'rgba(53, 119, 241, 0.06)',
                  border: '1px solid rgba(53, 119, 241, 0.2)',
                  borderRadius: '5px',
                  marginBottom: '0.65rem',
                  fontSize: '0.76rem',
                  color: '#3577f1',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <RotateCcw size={13} className="pulse-dot" />
                  <span>
                    <strong>Menganalisis rekomendasi di latar belakang:</strong> {recommendations.length.toLocaleString('id-ID')} / {targetRecommendationRows.length.toLocaleString('id-ID')} data siap ({Math.min(100, Math.round((recommendations.length / Math.max(1, targetRecommendationRows.length)) * 100))}%)
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#878a99' }}>Tabel tetap aktif & data terus bertambah</span>
              </div>
            )}

            {/* Jika seluruh rekomendasi telah disetujui ATAU hasil filter kosong */}
            {targetRecommendationRows.length === 0 || (currentTabRecs.length === 0 && !isComputingRecs) ? (
              targetRecommendationRows.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2.5rem 1.5rem',
                    background: '#ffffff',
                    borderRadius: '6px',
                    border: '1px solid #e9ebec',
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'rgba(10, 179, 156, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 0.65rem',
                      color: '#0ab39c',
                    }}
                  >
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#212529', margin: '0 0 0.35rem' }}>
                    Seluruh Rekomendasi Telah Disetujui
                  </h4>
                  <p style={{ fontSize: '0.79rem', color: '#878a99', margin: '0 auto 1rem', maxWidth: '480px', lineHeight: 1.5 }}>
                    Daftar rekomendasi saat ini kosong karena semua baris rekomendasi sudah disetujui dan masuk ke tab <strong>Data Match</strong>. Jika ada yang ingin dibatalkan, buka tab <strong>Data Match</strong> lalu klik tombol <strong>"Batalkan"</strong> pada baris terkait untuk mengembalikannya ke sini.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setCheckerTab('matched');
                      setPage(1);
                    }}
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.95rem' }}
                  >
                    Buka Tab Data Match
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2.5rem 1.5rem',
                    background: '#ffffff',
                    borderRadius: '6px',
                    border: '1px solid #e9ebec',
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: '#f3f6f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 0.5rem',
                      color: '#878a99',
                    }}
                  >
                    <Search size={18} />
                  </div>
                  <h5 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#212529', margin: '0 0 0.25rem' }}>
                    Tidak Ada Rekomendasi Sesuai Filter
                  </h5>
                  <p style={{ fontSize: '0.78rem', color: '#878a99', margin: '0 0 0.85rem' }}>
                    Tidak ditemukan rekomendasi yang belum disetujui untuk wilayah "{selectedWilayah !== 'ALL' ? formatWilayahName(selectedWilayah) : ''}" {searchTerm ? `atau kata kunci "${searchTerm}"` : ''}.
                  </p>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      onWilayahChange('ALL');
                      onSearchChange('');
                      setPage(1);
                      setRenderedLimit(60);
                    }}
                    style={{ fontSize: '0.76rem', padding: '0.28rem 0.85rem' }}
                  >
                    Reset Filter & Pencarian
                  </button>
                </div>
              )
            ) : (
              <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px', overflowX: 'auto' }}>
          <table className="modern-table" style={{ width: '100%', minWidth: '1200px', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th
                  style={{
                    width: '36px',
                    minWidth: '36px',
                    maxWidth: '36px',
                    textAlign: 'center',
                    background: '#f3f6f9',
                    position: 'sticky',
                    left: 0,
                    top: 0,
                    zIndex: 21,
                    borderRight: '1px solid #e9ebec',
                    borderBottom: '1px solid #e9ebec',
                  }}
                  title="Pilih / Batalkan Semua di Halaman Ini"
                >
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={toggleSelectAllCurrentPage}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th
                  style={{
                    width: '44px',
                    minWidth: '44px',
                    maxWidth: '44px',
                    textAlign: 'center',
                    background: '#f3f6f9',
                    color: '#405189',
                    position: 'sticky',
                    left: '36px',
                    top: 0,
                    zIndex: 20,
                    borderRight: '1px solid #e9ebec',
                    borderBottom: '1px solid #e9ebec',
                  }}
                >
                  No
                </th>
                <th
                  style={{
                    minWidth: '420px',
                    maxWidth: '420px',
                    width: '420px',
                    background: '#fff9f0',
                    color: '#d97706',
                    position: 'sticky',
                    left: '80px',
                    top: 0,
                    zIndex: 20,
                    boxShadow: '3px 0 6px -2px rgba(0, 0, 0, 0.06)',
                    borderRight: '2px solid #f7b84b',
                    borderBottom: '1px solid #e9ebec',
                  }}
                >
                  Kandidat Rekomendasi Master (Top 2–3 Pilihan Terdekat)
                </th>
                {/* Kolom Rekomendasi Mapping Role - 3 Cabang Role Lengkap Terdekat */}
                {roleMappingList.length > 0 && (
                  <th
                    style={{
                      minWidth: '280px',
                      maxWidth: '280px',
                      width: '280px',
                      background: '#f0fdf8',
                      color: '#059669',
                      borderBottom: '1px solid #e9ebec',
                      borderLeft: '2px solid rgba(16, 185, 129, 0.35)',
                      padding: '0.55rem 0.65rem',
                      verticalAlign: 'middle',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Shield size={13} color="#059669" />
                      <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Rekomendasi Cabang</span>
                    </div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 500, color: '#6b7280', marginTop: '0.1rem' }}>
                      3 Role Lengkap Terdekat (Alur Standar 3 Tahap)
                    </div>
                  </th>
                )}
                {/* Data Target Asli (Wilayah Target Dihapus sesuai permintaan user) */}
                <th style={{ color: '#878a99', minWidth: '95px', borderBottom: '1px solid #e9ebec' }}>KODE POS Target</th>
                <th style={{ color: '#878a99', minWidth: '120px', borderBottom: '1px solid #e9ebec' }}>Kecamatan Target</th>
                <th style={{ color: '#878a99', minWidth: '120px', borderBottom: '1px solid #e9ebec' }}>Kelurahan Target</th>
                <th style={{ color: '#878a99', minWidth: '120px', borderBottom: '1px solid #e9ebec' }}>Dati II Target</th>
                <th style={{ minWidth: '240px', color: '#878a99', borderBottom: '1px solid #e9ebec' }}>ALAMAT Target</th>
                <th style={{ minWidth: '110px', borderBottom: '1px solid #e9ebec' }}>Provinsi Target</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecs.length === 0 ? (
                <tr>
                  <td colSpan={roleMappingList.length > 0 ? 10 : 9} style={{ textAlign: 'center', padding: '2rem', color: '#878a99' }}>
                    Tidak ada rekomendasi yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                paginatedRecs.map((rec, idx) => {
                  const r = rec.targetRow;
                  const candidates = rec.candidates && rec.candidates.length > 0 ? rec.candidates : [
                    {
                      master: rec.recommendedMaster,
                      score: rec.score,
                      reason: rec.reason,
                      rank: 1,
                    }
                  ];
                  const isRowChecked = selectedRowNos.has(r.No);

                  return (
                    <tr key={`rec-${r.No}-${idx}`} style={{ background: isRowChecked ? '#f0fdf4' : '#fffdfa', verticalAlign: 'top' }}>
                      <td
                        style={{
                          width: '36px',
                          minWidth: '36px',
                          maxWidth: '36px',
                          textAlign: 'center',
                          paddingTop: '0.65rem',
                          position: 'sticky',
                          left: 0,
                          zIndex: 6,
                          background: isRowChecked ? '#f0fdf4' : '#fffdfa',
                          borderRight: '1px solid #e9ebec',
                          borderBottom: '1px solid #e9ebec',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isRowChecked}
                          onChange={() => toggleSelectRow(r.No)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      <td
                        className="code-cell"
                        style={{
                          textAlign: 'center',
                          color: '#405189',
                          fontWeight: 700,
                          paddingTop: '0.6rem',
                          position: 'sticky',
                          left: '36px',
                          zIndex: 5,
                          background: isRowChecked ? '#f0fdf4' : '#fffdfa',
                          borderRight: '1px solid #e9ebec',
                          borderBottom: '1px solid #e9ebec',
                        }}
                        title={`Nomor Baris Excel: ${r.No}${r._excelRowIndex ? ` (Urutan Baris Excel #${r._excelRowIndex})` : ''}`}
                      >
                        {r.No}
                      </td>

                      {/* Multi-Kandidat Rekomendasi (Top 2 - 3 Opsi Asli Master dengan Segmented Pill Toggle) - FROZEN / STICKY */}
                      <td
                        style={{
                          background: isRowChecked ? '#f0fdf4' : '#fffdfa',
                          padding: '0.45rem 0.55rem',
                          position: 'sticky',
                          left: '80px',
                          zIndex: 5,
                          boxShadow: '3px 0 6px -2px rgba(0, 0, 0, 0.06)',
                          borderRight: '2px solid rgba(247, 184, 75, 0.45)',
                          borderBottom: '1px solid #e9ebec',
                          minWidth: '420px',
                          maxWidth: '420px',
                          width: '420px',
                          boxSizing: 'border-box',
                        }}
                      >
                        {(() => {
                          const activeRank = activeCandidateByRow[r.No] || 1;
                          const activeCand = candidates.find((c) => c.rank === activeRank) || candidates[0];
                          const m = activeCand.master;
                          const isTop1 = activeCand.rank === 1;

                          const badgeBg = isTop1
                            ? 'rgba(10, 179, 156, 0.12)'
                            : activeCand.rank === 2
                            ? 'rgba(247, 184, 75, 0.15)'
                            : 'rgba(53, 119, 241, 0.1)';
                          const badgeColor = isTop1 ? '#0ab39c' : activeCand.rank === 2 ? '#d97706' : '#3577f1';
                          const cardBorder = isTop1 ? '1px solid rgba(10, 179, 156, 0.35)' : '1px solid #e9ebec';
                          const cardBg = isTop1 ? '#ffffff' : '#fafafa';

                          const candWilayahInfo = extractWilayahFromBranchCode(
                            m['Branch Code'] || m['Kode Cabang'] || r['Branch Code'] || r['Kode Cabang'] || '',
                            wilayahSettings,
                            m.Wilayah || r.Wilayah || '-'
                          );

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              {/* Indikator Audit Rekomendasi vs Pilihan yang Sudah Diisi di Excel */}
                              {rec.userPrefilledAudit && rec.userPrefilledAudit.hasPrefilled && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.2rem 0.45rem',
                                    borderRadius: '4px',
                                    fontSize: '0.68rem',
                                    fontWeight: 600,
                                    background:
                                      rec.userPrefilledAudit.status === 'match_top1'
                                        ? 'rgba(10, 179, 156, 0.08)'
                                        : rec.userPrefilledAudit.status === 'match_top2' || rec.userPrefilledAudit.status === 'match_top3'
                                        ? 'rgba(247, 184, 75, 0.12)'
                                        : 'rgba(53, 119, 241, 0.08)',
                                    color:
                                      rec.userPrefilledAudit.status === 'match_top1'
                                        ? '#07796a'
                                        : rec.userPrefilledAudit.status === 'match_top2' || rec.userPrefilledAudit.status === 'match_top3'
                                        ? '#925807'
                                        : '#2563eb',
                                    border:
                                      rec.userPrefilledAudit.status === 'match_top1'
                                        ? '1px solid rgba(10, 179, 156, 0.28)'
                                        : rec.userPrefilledAudit.status === 'match_top2' || rec.userPrefilledAudit.status === 'match_top3'
                                        ? '1px solid rgba(247, 184, 75, 0.35)'
                                        : '1px solid rgba(53, 119, 241, 0.25)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    boxSizing: 'border-box',
                                  }}
                                  title={`Di Excel terisi: "${rec.userPrefilledAudit.prefilledText}". ${rec.userPrefilledAudit.message}`}
                                >
                                  {rec.userPrefilledAudit.status === 'match_top1' ? (
                                    <CheckCircle2 size={12} color="#0ab39c" style={{ flexShrink: 0 }} />
                                  ) : rec.userPrefilledAudit.status === 'match_top2' || rec.userPrefilledAudit.status === 'match_top3' ? (
                                    <AlertTriangle size={12} color="#d97706" style={{ flexShrink: 0 }} />
                                  ) : (
                                    <Info size={12} color="#3577f1" style={{ flexShrink: 0 }} />
                                  )}
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    Di Excel: <strong>"{rec.userPrefilledAudit.prefilledText}"</strong> → {rec.userPrefilledAudit.message}
                                  </span>
                                </div>
                              )}

                              {/* Horizontal Segmented Pill Selector jika ada lebih dari 1 opsi */}
                              {candidates.length > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.1rem' }}>
                                  <span style={{ fontSize: '0.68rem', color: '#878a99', fontWeight: 600, marginRight: '0.1rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    Opsi:
                                  </span>
                                  {candidates.map((cand) => {
                                    const isSelected = cand.rank === activeCand.rank;
                                    const pillActiveBg = cand.rank === 1 ? '#0ab39c' : cand.rank === 2 ? '#d97706' : '#3577f1';
                                    const isUserChoice = rec.userPrefilledAudit?.matchedRank === cand.rank;

                                    return (
                                      <button
                                        key={`pill-${r.No}-${cand.rank}`}
                                        type="button"
                                        onClick={() => setActiveCandidateByRow((prev) => ({ ...prev, [r.No]: cand.rank }))}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          padding: '0.15rem 0.45rem',
                                          borderRadius: '9999px',
                                          fontSize: '0.7rem',
                                          fontWeight: isSelected ? 700 : 500,
                                          background: isSelected ? pillActiveBg : '#f3f6f9',
                                          color: isSelected ? '#ffffff' : '#495057',
                                          border: isSelected ? `1px solid ${pillActiveBg}` : isUserChoice ? '1px dashed #d97706' : '1px solid #e9ebec',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease',
                                          flexShrink: 0,
                                          whiteSpace: 'nowrap',
                                        }}
                                        title={`Klik untuk melihat Pilihan ${cand.rank} (${cand.score}%)${isUserChoice ? ' - Ini cabang yang Anda isi di Excel' : ''}`}
                                      >
                                        <span>{cand.rank === 1 ? 'Pilihan 1' : `Pilihan ${cand.rank}`}</span>
                                        {isUserChoice && (
                                          <span
                                            style={{
                                              fontSize: '0.58rem',
                                              padding: '0.02rem 0.25rem',
                                              borderRadius: '3px',
                                              background: isSelected ? 'rgba(255,255,255,0.3)' : 'rgba(217, 119, 6, 0.15)',
                                              color: isSelected ? '#ffffff' : '#925807',
                                              fontWeight: 700,
                                            }}
                                          >
                                            Pilihan Anda
                                          </span>
                                        )}
                                        <span
                                          style={{
                                            fontSize: '0.65rem',
                                            padding: '0.05rem 0.3rem',
                                            borderRadius: '9999px',
                                            background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                                            color: isSelected ? '#ffffff' : '#6c757d',
                                            fontWeight: 700,
                                          }}
                                        >
                                          {cand.score}%
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Single Active Candidate Card */}
                              <div
                                style={{
                                  border: cardBorder,
                                  borderRadius: '6px',
                                  padding: '0.45rem 0.6rem',
                                  background: cardBg,
                                  boxShadow: isTop1 ? '0 1px 2px rgba(10, 179, 156, 0.08)' : 'none',
                                  overflow: 'hidden',
                                  boxSizing: 'border-box',
                                }}
                              >
                                {/* Header Opsi: Badge Pilihan + Skor + Jarak & Action Quick Links (Maps + Info) */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'nowrap',
                                    gap: '0.35rem',
                                    marginBottom: '0.3rem',
                                    width: '100%',
                                  }}
                                >
                                  {/* Kiri: Pilihan + Skor + Jarak Fisik */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    <span
                                      style={{
                                        padding: '0.1rem 0.38rem',
                                        borderRadius: '3px',
                                        fontSize: '0.67rem',
                                        fontWeight: 700,
                                        background: badgeBg,
                                        color: badgeColor,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {isTop1 ? 'Pilihan 1 (Utama)' : `Pilihan ${activeCand.rank} (Alternatif)`}
                                    </span>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.15rem',
                                        fontSize: '0.67rem',
                                        fontWeight: 600,
                                        color: badgeColor,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      <Sparkles size={10} /> Skor {activeCand.score}%
                                    </span>
                                    {activeCand.formattedDistance && (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.15rem',
                                          fontSize: '0.67rem',
                                          fontWeight: 600,
                                          color: '#0d9488',
                                          background: 'rgba(13, 148, 136, 0.08)',
                                          padding: '0.08rem 0.32rem',
                                          borderRadius: '3px',
                                          whiteSpace: 'nowrap',
                                        }}
                                        title={`Estimasi jarak fisik: ${activeCand.formattedDistance} (${activeCand.distanceBasis || 'Jarak darat'})`}
                                      >
                                        <MapPin size={9} /> {activeCand.formattedDistance}
                                      </span>
                                    )}
                                  </div>

                                  {/* Kanan: Tombol Maps & Tombol Info (i) */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    {activeCand.googleMapsUrl && (
                                      <a
                                        href={activeCand.googleMapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.2rem',
                                          height: '18px',
                                          padding: '0 0.35rem',
                                          fontSize: '0.67rem',
                                          fontWeight: 600,
                                          color: '#2563eb',
                                          background: 'rgba(37, 99, 235, 0.08)',
                                          border: '1px solid rgba(37, 99, 235, 0.25)',
                                          borderRadius: '3px',
                                          textDecoration: 'none',
                                          cursor: 'pointer',
                                          boxSizing: 'border-box',
                                          lineHeight: '18px',
                                        }}
                                        title="Buka rute navigasi & cek jarak real di Google Maps langsung"
                                      >
                                        <ExternalLink size={10} /> Maps
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCandidateDetail({ targetRow: r, candidate: activeCand })}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '3px',
                                        border: '1px solid #d1d5db',
                                        background: '#f8fafc',
                                        color: '#64748b',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        flexShrink: 0,
                                        boxSizing: 'border-box',
                                        padding: 0,
                                      }}
                                      title="Lihat alasan penilaian skor & detail wilayah"
                                    >
                                      <Info size={10} />
                                    </button>
                                  </div>
                                </div>

                                {/* Baris Cabang Master + Tombol Utama Gunakan Cabang Ini */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.4rem',
                                      marginBottom: '0.1rem',
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: '0.81rem',
                                        fontWeight: 600,
                                        color: '#212529',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {m['Sandi Cabang'] || m.Cabang || m.Sandi || '-'}
                                      {m['Nama Outlet'] && (
                                        <span style={{ fontSize: '0.73rem', color: '#405189', fontWeight: 500, marginLeft: '0.35rem' }}>
                                          • {m['Nama Outlet']}
                                        </span>
                                      )}
                                    </div>

                                    {/* Tombol Gunakan Cabang Ini (Kompak & Pas di Baris Cabang) */}
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      onClick={() => handleApproveSingle(r.No, m)}
                                      style={{
                                        fontSize: '0.69rem',
                                        padding: '0.16rem 0.52rem',
                                        color: badgeColor,
                                        borderColor: isTop1
                                          ? 'rgba(10, 179, 156, 0.45)'
                                          : activeCand.rank === 2
                                          ? 'rgba(217, 119, 6, 0.45)'
                                          : 'rgba(53, 119, 241, 0.45)',
                                        background: isTop1
                                          ? 'rgba(10, 179, 156, 0.08)'
                                          : activeCand.rank === 2
                                          ? 'rgba(217, 119, 6, 0.08)'
                                          : 'rgba(53, 119, 241, 0.08)',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.2rem',
                                      }}
                                      title="Pilih dan setujui cabang master ini"
                                    >
                                      <Check size={11} /> Gunakan Cabang Ini
                                    </button>
                                  </div>

                                  {/* Branch Code & Wilayah Tag (Sesuai Setting Wilayah) */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      flexWrap: 'wrap',
                                      margin: '0.12rem 0 0.22rem',
                                    }}
                                  >
                                    {candWilayahInfo.branchCode ? (
                                      <span
                                        className="code-cell"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          fontSize: '0.69rem',
                                          background: '#f3f6f9',
                                          color: '#405189',
                                          padding: '0.08rem 0.4rem',
                                          borderRadius: '3px',
                                          border: '1px solid #e9ebec',
                                          fontWeight: 600,
                                        }}
                                        title={`Kode Branch: ${candWilayahInfo.branchCode} (Digit ke-2 & 3: ${candWilayahInfo.kodeWilayah || '-'})`}
                                      >
                                        <Building2 size={10} /> Branch: <strong>{candWilayahInfo.branchCode}</strong>
                                      </span>
                                    ) : null}

                                    <span
                                      className="badge badge-match"
                                      style={{
                                        fontSize: '0.69rem',
                                        padding: '0.08rem 0.45rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.2rem',
                                      }}
                                      title={`Wilayah hasil setting: ${candWilayahInfo.wilayahName}`}
                                    >
                                      <MapPin size={9} />
                                      {candWilayahInfo.wilayahName}
                                    </span>
                                  </div>

                                  {/* Info Kelurahan, Kecamatan & Kota Master + Indikator Kesesuaian */}
                                  {(() => {
                                    const isKelMatched = !!(r.Kelurahan && m.Kelurahan && cleanKelurahan(r.Kelurahan) === cleanKelurahan(m.Kelurahan));
                                    const isKecMatched = !!(r.Kecamatan && m.Kecamatan && cleanKecamatan(r.Kecamatan) === cleanKecamatan(m.Kecamatan));

                                    return (
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.3rem',
                                          fontSize: '0.69rem',
                                          color: '#495057',
                                          background: '#f8fafc',
                                          padding: '0.18rem 0.45rem',
                                          borderRadius: '4px',
                                          border: '1px solid #e2e8f0',
                                          margin: '0.1rem 0 0.15rem',
                                          flexWrap: 'wrap',
                                        }}
                                      >
                                        <span>
                                          Kel: <strong style={{ color: isKelMatched ? '#059669' : '#1e293b' }}>{m.Kelurahan || '-'}</strong>
                                        </span>
                                        {isKelMatched && (
                                          <span
                                            style={{
                                              fontSize: '0.6rem',
                                              padding: '0.02rem 0.25rem',
                                              borderRadius: '3px',
                                              background: 'rgba(10, 179, 156, 0.12)',
                                              color: '#059669',
                                              fontWeight: 700,
                                            }}
                                            title="Kelurahan target dan master sama persis"
                                          >
                                            ✓ Kelurahan Sama
                                          </span>
                                        )}
                                        <span style={{ color: '#cbd5e1' }}>•</span>
                                        <span>
                                          Kec: <strong style={{ color: isKecMatched ? '#2563eb' : '#1e293b' }}>{m.Kecamatan || '-'}</strong>
                                        </span>
                                        {isKecMatched && (
                                          <span
                                            style={{
                                              fontSize: '0.6rem',
                                              padding: '0.02rem 0.25rem',
                                              borderRadius: '3px',
                                              background: 'rgba(37, 99, 235, 0.1)',
                                              color: '#2563eb',
                                              fontWeight: 700,
                                            }}
                                            title="Kecamatan target dan master sama persis"
                                          >
                                            ✓ Kecamatan Sama
                                          </span>
                                        )}
                                        <span style={{ color: '#cbd5e1' }}>•</span>
                                        <span>
                                          Kota/Kab: <strong style={{ color: '#1e293b' }}>{m['Dati II'] || '-'}</strong>
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  {/* Alamat Lengkap Master Asli (Clean & Ringkas) */}
                                  <div
                                    style={{
                                      fontSize: '0.71rem',
                                      color: '#343a40',
                                      background: '#f8f9fa',
                                      padding: '0.18rem 0.45rem',
                                      borderRadius: '4px',
                                      border: '1px solid #edf0f2',
                                      marginTop: '0.05rem',
                                      whiteSpace: 'normal',
                                      wordBreak: 'break-word',
                                      lineHeight: 1.35,
                                    }}
                                  >
                                    <span style={{ fontWeight: 600, color: '#6c757d' }}>Alamat Master: </span>
                                    {m.ALAMAT || <em style={{ color: '#adb5bd' }}>Alamat tidak terisi di master</em>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Kolom Rekomendasi Mapping Role - ikuti kandidat aktif, filter same-island, sort by km */}
                      {roleMappingList.length > 0 && (() => {
                        const activeRank = activeCandidateByRow[r.No] || 1;
                        const activeCand = candidates.find((c) => c.rank === activeRank) || candidates[0];
                        const activeMaster = activeCand?.master;
                        const activeDati2 = activeMaster?.['Dati II'] || activeMaster?.Kota || r['Dati II'] || '';
                        const activeProvinsi = activeMaster?.Provinsi || r.Provinsi || '';
                        const topRoles = findTopRoleMatchesByLocation(activeDati2, activeProvinsi, roleMappingList, 3);
                        const selectedIdx = selectedRoleByRow[r.No] ?? -1;

                        return (
                          <td
                            style={{
                              padding: '0.5rem 0.6rem',
                              verticalAlign: 'top',
                              background: '#fafffe',
                              borderLeft: '2px solid rgba(16, 185, 129, 0.2)',
                              minWidth: '280px',
                              maxWidth: '280px',
                              width: '280px',
                              boxSizing: 'border-box',
                            }}
                          >
                            {topRoles.length === 0 ? (
                              <span style={{ fontSize: '0.7rem', color: '#adb5bd' }}>Belum ada data role lengkap di pulau ini</span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
                                {/* Header info lokasi */}
                                <div style={{ fontSize: '0.63rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.02rem' }}>
                                  Pilihan {activeRank} — {activeDati2 || '-'} · Terdekat (1 Pulau)
                                </div>
                                {topRoles.map((item, rIdx) => {
                                  const { rec: role, distanceKm, sameIsland } = item;
                                  const isSelected = selectedIdx === rIdx;
                                  const isKc = getUnitCategory(role.organisasiTujuan) === 'KC';

                                  // Color theme per rank
                                  const rankTheme = [
                                    { bg: 'rgba(16,185,129,0.09)', border: '#6ee7b7', text: '#065f46', badge: '#059669', selBg: 'rgba(16,185,129,0.22)', selBorder: '#059669' },
                                    { bg: 'rgba(14,165,233,0.07)', border: '#7dd3fc', text: '#0c4a6e', badge: '#0284c7', selBg: 'rgba(14,165,233,0.2)', selBorder: '#0284c7' },
                                    { bg: 'rgba(99,102,241,0.07)', border: '#c4b5fd', text: '#312e81', badge: '#4f46e5', selBg: 'rgba(99,102,241,0.18)', selBorder: '#4f46e5' },
                                  ];
                                  const t = rankTheme[rIdx] || rankTheme[0];

                                  return (
                                    <div
                                      key={`rm-${r.No}-${rIdx}`}
                                      onClick={() =>
                                        setSelectedRoleByRow((prev) => ({
                                          ...prev,
                                          [r.No]: isSelected ? -1 : rIdx,
                                        }))
                                      }
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ')
                                          setSelectedRoleByRow((prev) => ({ ...prev, [r.No]: isSelected ? -1 : rIdx }));
                                      }}
                                      style={{
                                        background: isSelected ? t.selBg : t.bg,
                                        border: `1.5px solid ${isSelected ? t.selBorder : t.border}`,
                                        borderRadius: '6px',
                                        padding: '0.3rem 0.42rem',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        transition: 'all 0.15s ease',
                                        boxShadow: isSelected ? `0 0 0 2px ${t.selBorder}33` : 'none',
                                      }}
                                      title={`Klik untuk ${isSelected ? 'batalkan pilihan' : 'pilih'} cabang ini`}
                                    >
                                      {/* Baris atas: nomor rank + nama + centang */}
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
                                        <span
                                          style={{
                                            flexShrink: 0,
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '50%',
                                            background: isSelected ? t.selBorder : t.badge,
                                            color: '#fff',
                                            fontSize: '0.6rem',
                                            fontWeight: 700,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          {isSelected ? '✓' : rIdx + 1}
                                        </span>
                                        <span
                                          style={{
                                            flex: 1,
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            color: t.text,
                                            lineHeight: 1.25,
                                            wordBreak: 'break-word',
                                          }}
                                        >
                                          {role.organisasiTujuan}
                                        </span>
                                        {isSelected && (
                                          <span style={{ flexShrink: 0, fontSize: '0.6rem', fontWeight: 700, color: t.selBorder }}>
                                            Dipilih
                                          </span>
                                        )}
                                      </div>

                                      {/* Baris bawah: KC/KCP badge + jarak km */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingLeft: '1.3rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                                        <span
                                          style={{
                                            fontSize: '0.6rem',
                                            fontWeight: 700,
                                            padding: '0.04rem 0.28rem',
                                            borderRadius: '3px',
                                            background: isKc ? 'rgba(64,81,137,0.11)' : 'rgba(41,156,219,0.11)',
                                            color: isKc ? '#405189' : '#0284c7',
                                          }}
                                        >
                                          {isKc ? 'Cabang Utama (KC)' : 'Outlet (KCP)'}
                                        </span>
                                        {distanceKm !== null ? (
                                          <span
                                            style={{
                                              fontSize: '0.6rem',
                                              fontWeight: 700,
                                              color: !sameIsland ? '#dc2626' : distanceKm < 50 ? '#059669' : distanceKm < 200 ? '#d97706' : '#6b7280',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.15rem',
                                            }}
                                            title={!sameIsland ? 'Peringatan: cabang ini berada di pulau berbeda' : `Estimasi jarak lurus: ${distanceKm} km`}
                                          >
                                            <MapPin size={9} />
                                            {distanceKm.toLocaleString('id-ID')} km
                                            {!sameIsland && ' ⚠️ beda pulau'}
                                          </span>
                                        ) : (
                                          <span style={{ fontSize: '0.6rem', color: '#adb5bd' }}>jarak tidak diketahui</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* Info selected */}
                                {selectedIdx >= 0 && topRoles[selectedIdx] && (
                                  <div
                                    style={{
                                      fontSize: '0.62rem',
                                      color: '#059669',
                                      fontWeight: 600,
                                      background: 'rgba(16,185,129,0.07)',
                                      borderRadius: '4px',
                                      padding: '0.2rem 0.4rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                    }}
                                  >
                                    <CheckCircle2 size={11} />
                                    Dipilih: {topRoles[selectedIdx].rec.organisasiTujuan}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })()}

                      {/* Data Target Asli (Wilayah Target Dihapus, Teks Alamat Tampil Utuh) */}
                      <td className="code-cell" style={{ color: '#f06548', fontWeight: 700, paddingTop: '0.55rem' }}>
                        {r['KODE POS']}
                      </td>
                      <td style={{ paddingTop: '0.55rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r.Kecamatan || '-'}
                      </td>
                      <td style={{ paddingTop: '0.55rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r.Kelurahan || '-'}
                      </td>
                      <td style={{ paddingTop: '0.55rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r['Dati II'] || '-'}
                      </td>
                      <td
                        style={{
                          paddingTop: '0.55rem',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          lineHeight: 1.35,
                          fontSize: '0.75rem',
                          color: '#212529',
                        }}
                      >
                        {r.ALAMAT || '-'}
                      </td>
                      <td style={{ paddingTop: '0.55rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r.Provinsi || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {pageSize === 'all' && (
            <div
              ref={sentinelRef}
              style={{
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8f9fa',
                borderTop: '1px solid #e9ebec',
                fontSize: '0.74rem',
                color: '#878a99',
              }}
            >
              {renderedLimit < currentTabRecs.length ? (
                <span>Memuat baris berikutnya... ({Math.min(renderedLimit, currentTabRecs.length).toLocaleString('id-ID')} / {currentTabRecs.length.toLocaleString('id-ID')})</span>
              ) : (
                <span>✓ Seluruh {currentTabRecs.length.toLocaleString('id-ID')} rekomendasi telah ditampilkan</span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
      ) : checkerTab === 'upload' && pendingUploadRows.length === 0 ? (
        /* TAB 1: DATA SUDAH DI-ANALISA (POST-MATCHING STATE) */
        <div
          style={{
            textAlign: 'center',
            padding: '1.75rem 1.25rem',
            background: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #e9ebec',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(10, 179, 156, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.65rem',
            }}
          >
            <CheckCircle2 size={24} color="#0ab39c" />
          </div>
          <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#212529', margin: '0 0 0.25rem' }}>
            Data sudah di Analisa silahkan cek di tab selanjutnya
          </h4>
          <p style={{ fontSize: '0.8rem', color: '#878a99', margin: '0 auto 1rem', maxWidth: '480px' }}>
            Seluruh antrean data target berhasil diproses dan dipindahkan. Silakan cek tab <strong>Rekomendasi Data</strong> untuk data yang perlu ditinjau atau <strong>Data Match</strong> untuk data yang telah cocok.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setCheckerTab('recommendation');
                setPage(1);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                padding: '0.35rem 0.95rem',
                color: '#d97706',
                borderColor: '#f7b84b',
                background: '#fffdf5',
              }}
            >
              <Sparkles size={14} />
              <span>Buka Rekomendasi Data ({unmatchedRows.length.toLocaleString('id-ID')})</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setCheckerTab('matched');
                setPage(1);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                padding: '0.35rem 0.95rem',
                background: '#0ab39c',
                borderColor: '#0ab39c',
              }}
            >
              <CheckCircle2 size={14} />
              <span>Buka Data Match ({matchedRows.length.toLocaleString('id-ID')})</span>
            </button>
          </div>
        </div>
      ) : checkerTab === 'matched' && matchedRows.length === 0 ? (
        /* TAB 3: PRE-MATCHING STATE (BELUM ADA DATA MATCH) */
        <div
          style={{
            textAlign: 'center',
            padding: '1.75rem 1.25rem',
            background: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #e9ebec',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(10, 179, 156, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.6rem',
            }}
          >
            <CheckCircle2 size={20} color="#0ab39c" />
          </div>
          <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#212529', margin: '0 0 0.25rem' }}>
            Belum Ada Data Match
          </h4>
          <p style={{ fontSize: '0.78rem', color: '#878a99', margin: '0 auto 0.85rem', maxWidth: '440px' }}>
            Pencocokan data belum dijalankan. Silakan buka tab <strong>Data Upload</strong> dan klik tombol <strong>"Pencocokan"</strong> untuk menemukan data yang cocok dengan master.
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setCheckerTab('upload');
              setPage(1);
            }}
            style={{ fontSize: '0.76rem', padding: '0.3rem 0.85rem' }}
          >
            Buka Tab Data Upload
          </button>
        </div>
      ) : (
        /* TAB 1 (PRE-MATCHING) ATAU TAB 3 (POST-MATCHING) DATA GRID */
        <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center', background: '#f3f6f9', borderRight: '1px solid #e9ebec', color: '#405189' }}>No</th>
                <th style={{ minWidth: '220px', whiteSpace: 'nowrap' }}>Status Match</th>
                <th>Wilayah</th>
                {/* Atribut Hasil Enrichment Master */}
                {hasCombinedSandiCabang ? (
                  <th style={{ color: '#405189' }}>Sandi Cabang (Master)</th>
                ) : (
                  <>
                    <th style={{ color: '#405189' }}>Sandi (Master)</th>
                    <th style={{ color: '#405189' }}>Cabang (Master)</th>
                  </>
                )}
                {!hiddenCols.has('Branch Code') && <th style={{ color: '#405189' }}>Branch Code (Master)</th>}
                {!hiddenCols.has('Kode Cabang') && <th style={{ color: '#405189' }}>Kode Cabang (Master)</th>}
                {!hiddenCols.has('Nama Outlet') && <th style={{ color: '#405189' }}>Nama Outlet (Master)</th>}
                {!hiddenCols.has('Status Outlet') && <th style={{ color: '#405189' }}>Status Outlet (Master)</th>}
                {!hiddenCols.has('ALAMAT') && <th style={{ color: '#405189' }}>ALAMAT (Master)</th>}
                {/* Kolom Target Asli (Sampai Provinsi & PTEN) */}
                {!hiddenCols.has('KODE POS') && <th>KODE POS</th>}
                {!hiddenCols.has('Kelurahan') && <th>Kelurahan</th>}
                {!hiddenCols.has('Kecamatan') && <th>Kecamatan</th>}
                {!hiddenCols.has('Dati II') && <th>Dati II</th>}
                {!hiddenCols.has('Kode Dati II') && <th>Kode Dati II</th>}
                {!hiddenCols.has('Provinsi') && <th>Provinsi</th>}
                {!hiddenCols.has('PTEN') && (
                  <th style={{ color: '#0ab39c', textAlign: 'center', minWidth: '165px' }}>
                    <div>Validasi PTEN</div>
                    <div style={{ fontSize: '0.66rem', fontWeight: 500, color: '#878a99' }}>Kode Pos & Kota PTEN</div>
                  </th>
                )}
                {!hiddenCols.has('RoleMapping') && (
                  <th style={{ color: '#405189', textAlign: 'center', minWidth: '220px' }}>
                    <div>Mapping Role BNI</div>
                    <div style={{ fontSize: '0.66rem', fontWeight: 500, color: '#878a99' }}>Unit, Role & Alur Wondr</div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={18 - hiddenCols.size} style={{ textAlign: 'center', padding: '3rem', color: '#878a99' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      {checkerTab === 'upload' ? (
                        <>
                          <AlertTriangle size={32} color="#878a99" />
                          <strong style={{ color: '#212529', fontSize: '0.95rem' }}>
                            Belum Ada Data Upload Target
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: '#878a99' }}>
                            Silakan unggah berkas Excel target melalui tombol Upload Data Cek di atas.
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={32} color="#878a99" />
                          <strong style={{ color: '#212529', fontSize: '0.95rem' }}>
                            Tidak Ada Data Match yang Sesuai
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: '#878a99' }}>
                            Tidak ditemukan data match yang sesuai dengan filter pencarian saat ini.
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => {
                  const isMatched = r._isMatched ?? (r.Sandi !== '' || r['Sandi Cabang'] !== '');

                  return (
                    <tr
                      key={String(r.No)}
                      className={isMatched ? 'row-matched' : 'row-unmatched'}
                    >
                      {/* 1. Locked Column No */}
                      <td
                        className="code-cell"
                        style={{
                          textAlign: 'center',
                          background: '#ffffff',
                          fontWeight: 700,
                          color: '#405189',
                          borderRight: '1px solid #e9ebec',
                        }}
                      >
                        {r.No}
                      </td>

                      {/* Status Match Badge + Revert Action */}
                      <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        {isMatched ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                            <span
                              className={`badge ${
                                r._matchLevel === 'recommendation'
                                  ? 'badge-level2'
                                  : r._matchLevel === 'level2'
                                  ? 'badge-level2'
                                  : 'badge-match'
                              }`}
                              style={{
                                fontSize: '0.67rem',
                                padding: '0.14rem 0.45rem',
                                letterSpacing: '0.02em',
                                whiteSpace: 'nowrap',
                              }}
                              title={r._matchedAt ? `Diverifikasi: ${new Date(r._matchedAt).toLocaleString('id-ID')} (${r._matchedBy || 'Sistem'})` : undefined}
                            >
                              {r._matchLevel === 'recommendation'
                                ? 'MATCH (REKOMENDASI)'
                                : r._matchLevel === 'level2'
                                ? 'MATCH (L2 TIE)'
                                : 'MATCH (L1)'}
                            </span>

                            {/* Timestamp */}
                            {r._matchedAt && (
                              <span style={{ fontSize: '0.65rem', color: '#878a99', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {new Date(r._matchedAt).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}

                            {/* Tombol Batalkan / Revert jika baris hasil persetujuan rekomendasi */}
                            {onRevertRecommendation && r._matchLevel === 'recommendation' && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Batalkan persetujuan rekomendasi baris #${r.No}? Baris ini akan dikembalikan ke tab Rekomendasi Data.`)) {
                                    onRevertRecommendation(r.No);
                                  }
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  height: '18px',
                                  padding: '0 0.35rem',
                                  borderRadius: '3px',
                                  border: '1px solid rgba(240, 101, 72, 0.3)',
                                  background: 'rgba(240, 101, 72, 0.06)',
                                  color: '#e05338',
                                  fontSize: '0.64rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxSizing: 'border-box',
                                  lineHeight: '18px',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Batalkan status match rekomendasi dan kembalikan ke tab Rekomendasi Data"
                              >
                                <RotateCcw size={9} />
                                <span>Batalkan</span>
                              </button>
                            )}

                            {/* Audit Kesesuaian dengan Isi Awal Excel */}
                            {r._hasUserFilledData && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.61rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {(() => {
                                  const uSandi = String(r._originalFilledSandi || '').trim().toLowerCase();
                                  const uCabang = String(r._originalFilledCabang || '').trim().toLowerCase();
                                  const mSandi = String(r.Sandi || '').trim().toLowerCase();
                                  const mCabang = String(r.Cabang || '').trim().toLowerCase();
                                  const isAgree =
                                    (uSandi && mSandi && uSandi === mSandi) ||
                                    (uCabang && mCabang && (uCabang === mCabang || mCabang.includes(uCabang) || uCabang.includes(mCabang)));

                                  return isAgree ? (
                                    <span style={{ color: '#059669', background: 'rgba(5, 150, 105, 0.08)', padding: '0.04rem 0.25rem', borderRadius: '2px', whiteSpace: 'nowrap' }} title="Pencocokan sistem sesuai dengan cabang yang Anda isi di file Excel">
                                      ✓ Sesuai Excel Anda
                                    </span>
                                  ) : (
                                    <span style={{ color: '#d97706', background: 'rgba(217, 119, 6, 0.08)', padding: '0.04rem 0.25rem', borderRadius: '2px', whiteSpace: 'nowrap' }} title={`Di Excel Anda isi: ${r._originalFilledCabang || r._originalFilledSandi || r._originalFilledSandiCabang}`}>
                                      ⚠️ Beda dr Excel
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="badge badge-unmatched" style={{ whiteSpace: 'nowrap' }}>UNMATCHED</span>
                        )}
                      </td>

                      {/* Wilayah */}
                      <td><span style={{ color: '#495057', fontWeight: 500 }}>{formatWilayahName(r.Wilayah)}</span></td>

                      {/* Auto-populated Master Attributes */}
                      {hasCombinedSandiCabang ? (
                        <td>
                          <strong style={{ color: isMatched ? '#212529' : '#878a99' }}>
                            {r['Sandi Cabang'] || r.Cabang || '-'}
                          </strong>
                        </td>
                      ) : (
                        <>
                          <td className="code-cell" style={{ color: '#405189' }}>
                            {r.Sandi || <span style={{ color: '#878a99' }}>-</span>}
                          </td>
                          <td>
                            <strong style={{ color: isMatched ? '#212529' : '#878a99' }}>
                              {r.Cabang || '-'}
                            </strong>
                          </td>
                        </>
                      )}
                      {!hiddenCols.has('Branch Code') && (
                        <td className="code-cell">
                          {r['Branch Code'] || <span style={{ color: '#878a99' }}>-</span>}
                        </td>
                      )}
                      {!hiddenCols.has('Kode Cabang') && (
                        <td className="code-cell">
                          {r['Kode Cabang'] || <span style={{ color: '#878a99' }}>-</span>}
                        </td>
                      )}
                      {!hiddenCols.has('Nama Outlet') && (
                        <td style={{ color: '#405189', fontWeight: 500 }}>{r['Nama Outlet'] || <span style={{ color: '#878a99' }}>-</span>}</td>
                      )}
                      {!hiddenCols.has('Status Outlet') && (
                        <td>
                          {r['Status Outlet'] ? (
                            <span className="badge badge-match">{r['Status Outlet']}</span>
                          ) : (
                            <span style={{ color: '#878a99' }}>-</span>
                          )}
                        </td>
                      )}
                      {!hiddenCols.has('ALAMAT') && (
                        <td style={{ minWidth: '180px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }} title={r.ALAMAT}>
                          {r.ALAMAT || <span style={{ color: '#878a99' }}>-</span>}
                        </td>
                      )}

                      {/* Target Data Asli (Sampai Provinsi & PTEN) */}
                      {!hiddenCols.has('KODE POS') && <td className="code-cell" style={{ color: '#405189', fontWeight: 700 }}>{r['KODE POS']}</td>}
                      {!hiddenCols.has('Kelurahan') && <td>{r.Kelurahan || '-'}</td>}
                      {!hiddenCols.has('Kecamatan') && <td>{r.Kecamatan || '-'}</td>}
                      {!hiddenCols.has('Dati II') && <td>{r['Dati II'] || '-'}</td>}
                      {!hiddenCols.has('Kode Dati II') && <td className="code-cell">{r['Kode Dati II'] || '-'}</td>}
                      {!hiddenCols.has('Provinsi') && <td>{r.Provinsi || '-'}</td>}

                      {/* Kolom Validasi PTEN */}
                      {!hiddenCols.has('PTEN') && (
                        <td style={{ textAlign: 'center', padding: '0.4rem 0.55rem', verticalAlign: 'middle' }}>
                          {(() => {
                            const ptenStatus = String(r['CEK KODE POS + PTEN'] || '').toUpperCase();
                            const fileCity = r['Dati II'] || '-';
                            const ptenCity = r['KOTA PTEN'] || '-';
                            const targetKp = r['KODE POS'] || '-';

                            if (ptenStatus === 'SAME' || ptenStatus === 'COCOK') {
                              return (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      padding: '0.12rem 0.45rem',
                                      borderRadius: '4px',
                                      background: 'rgba(10, 179, 156, 0.12)',
                                      color: '#0ab39c',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                    }}
                                    title={`Kode Pos ${targetKp} cocok dengan Master PTEN: ${ptenCity}`}
                                  >
                                    ✓ Cocok PTEN
                                  </span>
                                  <span style={{ fontSize: '0.66rem', color: '#059669', fontWeight: 600 }}>
                                    {ptenCity}
                                  </span>
                                </div>
                              );
                            }
                            if (ptenStatus === 'DIFFERENT' || ptenStatus === 'TIDAK COCOK') {
                              return (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    padding: '0.3rem 0.5rem',
                                    borderRadius: '5px',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    minWidth: '150px',
                                  }}
                                  title={`Perbedaan Wilayah: Di File Excel "${fileCity}", sedangkan Master PTEN untuk Kode Pos ${targetKp} adalah "${ptenCity}"`}
                                >
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                      padding: '0.06rem 0.38rem',
                                      borderRadius: '3px',
                                      background: 'rgba(217, 119, 6, 0.15)',
                                      color: '#b45309',
                                      fontSize: '0.66rem',
                                      fontWeight: 700,
                                    }}
                                  >
                                    ⚠️ Beda Kota ({ptenCity})
                                  </span>
                                  <div style={{ fontSize: '0.64rem', lineHeight: 1.3, textAlign: 'left', width: '100%' }}>
                                    <div style={{ color: '#64748b' }}>
                                      File: <strong style={{ color: '#d97706' }}>{fileCity}</strong>
                                    </div>
                                    <div style={{ color: '#64748b' }}>
                                      PTEN: <strong style={{ color: '#059669' }}>{ptenCity}</strong>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '0.12rem 0.4rem',
                                    borderRadius: '4px',
                                    background: '#f3f6f9',
                                    color: '#878a99',
                                    fontSize: '0.66rem',
                                    fontWeight: 500,
                                  }}
                                  title="Kode pos belum terdaftar di Master PTEN"
                                >
                                  Belum di PTEN
                                </span>
                                <span style={{ fontSize: '0.62rem', color: '#adb5bd' }}>
                                  KP: {targetKp}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                      )}

                      {/* Kolom Tipe Unit & Alur Wondr Mapping Role */}
                      {!hiddenCols.has('RoleMapping') && (
                        <td style={{ padding: '0.4rem 0.55rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          {r.organisasiRole || r.tipeUnitRole || r.alurWondr ? (
                            <div
                              style={{
                                display: 'inline-flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                                alignItems: 'center',
                                background: '#fcfdfe',
                                padding: '0.35rem 0.55rem',
                                borderRadius: '6px',
                                border: '1px solid #e9ecef',
                                minWidth: '200px',
                              }}
                              title={`Unit: ${r.organisasiRole || '-'}\nTipe: ${r.tipeUnitRole || '-'}\nAlur: ${r.flowDescription || r.alurWondr || '-'}`}
                            >
                              {/* Nama Unit di Mapping Role Database */}
                              <div
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: '#1e293b',
                                  textAlign: 'center',
                                  maxWidth: '220px',
                                  whiteSpace: 'normal',
                                  lineHeight: 1.25,
                                }}
                              >
                                {r.organisasiRole || '-'}
                              </div>

                              {/* Tipe Unit Badge + Alur Wondr */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '0.08rem 0.38rem',
                                    borderRadius: '3px',
                                    background:
                                      r.tipeUnitRole?.includes('KC') || r.tipeUnitRole?.includes('Utama')
                                        ? 'rgba(64, 81, 137, 0.12)'
                                        : 'rgba(41, 156, 219, 0.12)',
                                    color:
                                      r.tipeUnitRole?.includes('KC') || r.tipeUnitRole?.includes('Utama')
                                        ? '#405189'
                                        : '#299cdb',
                                  }}
                                >
                                  {r.tipeUnitRole || (r.organisasiRole ? 'Terpetakan' : '-')}
                                </span>
                                {r.alurWondr && (
                                  <span
                                    style={{
                                      fontSize: '0.65rem',
                                      fontWeight: 600,
                                      color: '#475569',
                                      background: '#f1f5f9',
                                      padding: '0.08rem 0.35rem',
                                      borderRadius: '3px',
                                    }}
                                  >
                                    {r.alurWondr}
                                  </span>
                                )}
                              </div>

                              {/* Status Ketersediaan 3 Role & Total User */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.62rem', fontWeight: 700 }}>
                                <span
                                  style={{
                                    padding: '0.05rem 0.28rem',
                                    borderRadius: '2px',
                                    background: (r.roleCabsal ?? 0) > 0 ? 'rgba(10, 179, 156, 0.15)' : '#f1f5f9',
                                    color: (r.roleCabsal ?? 0) > 0 ? '#059669' : '#94a3b8',
                                  }}
                                  title={`Maker (Sales Cabang / QRS_CABSAL): ${r.roleCabsal ?? 0}`}
                                >
                                  M: {r.roleCabsal ?? 0}
                                </span>
                                <span
                                  style={{
                                    padding: '0.05rem 0.28rem',
                                    borderRadius: '2px',
                                    background: (r.roleCabapv1 ?? 0) > 0 ? 'rgba(10, 179, 156, 0.15)' : '#f1f5f9',
                                    color: (r.roleCabapv1 ?? 0) > 0 ? '#059669' : '#94a3b8',
                                  }}
                                  title={`Checker (Verifikator Cabang / QRS_CABAPV1): ${r.roleCabapv1 ?? 0}`}
                                >
                                  C: {r.roleCabapv1 ?? 0}
                                </span>
                                <span
                                  style={{
                                    padding: '0.05rem 0.28rem',
                                    borderRadius: '2px',
                                    background: (r.roleCabapv2 ?? 0) > 0 ? 'rgba(10, 179, 156, 0.15)' : '#f1f5f9',
                                    color: (r.roleCabapv2 ?? 0) > 0 ? '#059669' : '#94a3b8',
                                  }}
                                  title={`Signer (Penyetuju Cabang / QRS_CABAPV2): ${r.roleCabapv2 ?? 0}`}
                                >
                                  S: {r.roleCabapv2 ?? 0}
                                </span>
                                <span
                                  style={{
                                    padding: '0.05rem 0.32rem',
                                    borderRadius: '2px',
                                    background: 'rgba(64, 81, 137, 0.1)',
                                    color: '#405189',
                                    fontWeight: 700,
                                  }}
                                  title={`Grand Total Pegawai Fisik Unik di Unit ini: ${r.roleGrandTotal ?? 1} User`}
                                >
                                  Total: {r.roleGrandTotal ?? 1} User
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#adb5bd', fontSize: '0.72rem' }}>-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {pageSize === 'all' && (
            <div
              ref={sentinelRef}
              style={{
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8f9fa',
                borderTop: '1px solid #e9ebec',
                fontSize: '0.74rem',
                color: '#878a99',
              }}
            >
              {renderedLimit < currentTabRows.length ? (
                <span>Memuat baris berikutnya... ({Math.min(renderedLimit, currentTabRows.length).toLocaleString('id-ID')} / {currentTabRows.length.toLocaleString('id-ID')})</span>
              ) : (
                <span>✓ Seluruh {currentTabRows.length.toLocaleString('id-ID')} baris telah ditampilkan</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Clean Pagination Bar */}
      {!(
        (checkerTab === 'upload' && matchedDone) ||
        (!matchedDone && (checkerTab === 'recommendation' || checkerTab === 'matched'))
      ) && (
        <div className="pagination-row" style={{ marginTop: '0.75rem', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Info Jumlah Data & Pilihan Tampilkan Semua Data */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.78rem', color: '#878a99', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span>
                Menampilkan{' '}
                {pageSize === 'all'
                  ? `${Math.min(renderedLimit, checkerTab === 'recommendation' ? currentTabRecs.length : currentTabRows.length).toLocaleString('id-ID')} dari ${checkerTab === 'recommendation' ? currentTabRecs.length.toLocaleString('id-ID') : currentTabRows.length.toLocaleString('id-ID')} data (Scroll otomatis)`
                  : checkerTab === 'recommendation'
                  ? `${(page - 1) * effectivePageSize + 1} - ${Math.min(page * effectivePageSize, currentTabRecs.length)} dari ${currentTabRecs.length.toLocaleString('id-ID')} rekomendasi`
                  : `${(page - 1) * effectivePageSize + 1} - ${Math.min(page * effectivePageSize, currentTabRows.length)} dari ${currentTabRows.length.toLocaleString('id-ID')} baris`}
              </span>
              {pageSize === 'all' && renderedLimit < (checkerTab === 'recommendation' ? currentTabRecs.length : currentTabRows.length) && (
                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setRenderedLimit((prev) => Math.min(prev + 100, checkerTab === 'recommendation' ? currentTabRecs.length : currentTabRows.length))}
                    style={{ fontSize: '0.71rem', padding: '0.12rem 0.45rem', height: '22px' }}
                  >
                    +100 Baris
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setRenderedLimit(checkerTab === 'recommendation' ? currentTabRecs.length : currentTabRows.length)}
                    style={{ fontSize: '0.71rem', padding: '0.12rem 0.45rem', height: '22px' }}
                  >
                    Muat Semua Sekaligus
                  </button>
                </div>
              )}
            </div>

            {/* Dropdown Pilihan Jumlah Data / Tampilkan Semua Data */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#495057' }}>
              <span>Tampilkan:</span>
              <select
                value={String(pageSize)}
                onChange={(e) => {
                  const val = e.target.value;
                  setPageSize(val === 'all' ? 'all' : Number(val));
                  setPage(1);
                }}
                style={{
                  padding: '0.22rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #ced4da',
                  background: '#ffffff',
                  fontSize: '0.76rem',
                  color: '#495057',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="15">15 per halaman</option>
                <option value="25">25 per halaman</option>
                <option value="50">50 per halaman</option>
                <option value="100">100 per halaman</option>
                <option value="all">Semua Data (Tampilkan Semua)</option>
              </select>
            </div>
          </div>

          {/* Tombol Navigasi Pagination & Quick Jump */}
          {pageSize !== 'all' && totalPages > 1 && (
            <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                <ChevronLeft size={13} />
                <span>Sebelumnya</span>
              </button>
              <span style={{ padding: '0 0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#495057' }}>
                Hal {page} / {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                <span>Berikutnya</span>
                <ChevronRight size={13} />
              </button>

              {/* Quick Jump to Page */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.75rem',
                  color: '#495057',
                  marginLeft: '0.4rem',
                  paddingLeft: '0.4rem',
                  borderLeft: '1px solid #ced4da',
                }}
              >
                <span>Ke Hal:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  defaultValue={page}
                  key={`jump-${page}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setPage(val);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= totalPages && val !== page) {
                      setPage(val);
                    }
                  }}
                  style={{
                    width: '46px',
                    padding: '0.18rem 0.3rem',
                    textAlign: 'center',
                    borderRadius: '4px',
                    border: '1px solid #ced4da',
                    fontSize: '0.75rem',
                    outline: 'none',
                  }}
                  title="Ketik nomor halaman lalu tekan Enter"
                />
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setPageSize('all');
                  setPage(1);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  padding: '0.24rem 0.65rem',
                  color: '#405189',
                  borderColor: '#ced4da',
                  background: '#ffffff',
                  fontWeight: 600,
                  marginLeft: '0.5rem',
                }}
                title="Tampilkan seluruh data tanpa batasan per halaman"
              >
                <Eye size={13} />
                <span>Tampilkan Semua Record</span>
              </button>
            </div>
          )}

          {pageSize === 'all' && (
            <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setPageSize(15);
                  setPage(1);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  padding: '0.24rem 0.65rem',
                  color: '#405189',
                  borderColor: '#ced4da',
                  background: '#ffffff',
                  fontWeight: 600,
                }}
              >
                <ChevronLeft size={13} />
                <span>Kembali ke Mode Paginasi (15 per Hal)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Panduan Skor Kedekatan untuk Pengguna Awam */}
      <ProximityGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />

      {/* Modal Detail Rekomendasi & Alasan Penilaian Skor */}
      <CandidateDetailModal
        isOpen={Boolean(selectedCandidateDetail)}
        onClose={() => setSelectedCandidateDetail(null)}
        data={selectedCandidateDetail}
        onApprove={(rowNo, m) => {
          handleApproveSingle(rowNo, m);
          setSelectedCandidateDetail(null);
        }}
        wilayahSettings={wilayahSettings}
      />
    </div>
  );
};
