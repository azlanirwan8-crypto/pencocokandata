import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  ExternalLink,
  Layers,
  Compass,
  ChevronRight,
  Building2,
  Filter,
  CheckCircle,
  CheckCircle2,
  MapPin,
  Eye,
  Globe,
  Share2,
  X,
  Radio,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import type { MasterRow, TargetRow } from '../../types';
import type { AnalystRow } from '../../utils/analystPipeline';
import type { KodePosRow } from '../../utils/neonSync';
import { kunciKelKec, kotaCocok, kodePosLima, bangunJembatanOutlet, indeksKantorCabang, bagiPinKeSelLayar, type KoneksiTitik, type StatusTitik } from '../../utils/geoTitik';
import { detectFinalAnomalies } from '../../utils/finalAnomaly';
import { formatWilayahName } from '../../utils/normalizer';
import { useVirtualWindow } from '../../utils/useVirtualWindow';
import { DEFAULT_PTEN_DATA } from '../PTENData/defaultPtenData';
import {
  clusterMasterRowsForMap,
  INDONESIA_REGIONS,
  createCurvedArcPoints,
  resolveTargetOriginCoordinates,
  clampToIndonesia,
  isAcehTargetRow,
  groupTargetOriginsForMap,
  type PlottedBranchPin,
  getAllMatchedCoordinates,
  kategoriUnitCabang,
} from '../../utils/geoCoder';
import {
  buildMasterQuery,
  buildTargetQuery,
  batchGeocodeUniqueQueries,

  muatTitikKodePos,
  kodePosUjung,
  type GeoLocationResult,
  type BatchProgress,
} from '../../utils/onlineGeoCoder';
import { get, keys } from 'idb-keyval';

import { cleanDati, cleanProvinsi } from '../../utils/normalizer';
import { getUnitCategory } from '../../utils/roleHelpers';
import { useNotification } from '../Notification/NotificationContext';
import { DialogPanel } from '../BaseModal';

// ── Ikon penanda peta: bentuk = JENIS titik, warna = STATUS (agar user langsung tahu
//    "ini KC / KCP / Kode Pos / Multi-Outlet" tanpa harus klik). ──
type PinKind = 'KODEPOS' | 'KC' | 'KCP' | 'MULTI';
// Kunci cadangan penentuan titik: kelurahan+kecamatan+kota (lihat `geoTitik.ts`).

const PIN_GLYPH: Record<PinKind, string> = { KODEPOS: '📮', KC: '🏦', KCP: '🏬', MULTI: '🏢' };
const PIN_LABEL: Record<PinKind, string> = { KODEPOS: 'Kode Pos', KC: 'KC (Cabang)', KCP: 'KCP (Outlet)', MULTI: 'Multi-Outlet' };

// Satu warna untuk SEMUA pin bulat (KC, KCP, Multi, Kodepos) dan semua garis lengkung;
// titik yang dipilih baru jadi biru. Jenis titik dibaca dari bentuk/ikon, bukan dari warna.
const WARNA_PIN = '#405189';
const WARNA_PIN_TERPILIH = '#299cdb';
const WARNA_GARIS = '#299cdb';

function makePinIcon(kind: PinKind, color: string, selected: boolean): L.DivIcon {
  const s = selected ? 34 : 26; // diameter kepala pin
  const html =
    `<div class="bni-map-pin${selected ? ' bni-map-pin--selected' : ''}" style="--pin:${color};--s:${s}px;">` +
    `<span class="bni-map-pin__glyph">${PIN_GLYPH[kind]}</span></div>`;
  return L.divIcon({
    html,
    className: 'bni-map-pin-wrap',
    iconSize: [s, s + 8],
    iconAnchor: [s / 2, s + 8],
    tooltipAnchor: [0, -(s + 8) + 6],
  });
}

function makeClusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 34 : count < 50 ? 40 : count < 200 ? 46 : 54;
  const html = `<div class="bni-map-cluster" style="width:${size}px;height:${size}px;"><span>${count.toLocaleString('id-ID')}</span></div>`;
  return L.divIcon({
    html,
    className: 'bni-map-cluster-wrap',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface IndonesiaBranchMapProps {
  masterRows: MasterRow[];
  targetRows?: TargetRow[];
  finalRows?: AnalystRow[];
  /** Tabel Data Kode Pos — dipakai sebagai kunci cadangan penentuan titik (lihat `kunciTitikNama`). */
  kodePosRows?: KodePosRow[];
  selectedWilayah?: string;
  onNavigateToMaster?: () => void;
  onNavigateToEngine?: (searchFilter?: string) => void;
}

/** Empat pilihan di dropdown + satu mode dalam (titik yang sedang diisolasi). */
type DisplayScope = 'KC' | 'KCP' | 'MULTI' | 'KODEPOS' | 'ISOLASI';
type TileProvider = 'google' | 'google_hybrid' | 'esri' | 'osm';

export interface SearchSuggestionItem {
  pin: PlottedBranchPin;
  serviceNote?: string;
  sourceCoords?: [number, number];
}

function hasExplicitCoordinates(row: MasterRow | TargetRow): boolean {
  const lat = Number(row.Latitude ?? row.lat ?? row.LATITUDE);
  const lng = Number(row.Longitude ?? row.lng ?? row.LONGITUDE);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}

function isTargetInSelectedBranchRegion(target: TargetRow, branches: MasterRow[]): boolean {
  const targetProvince = cleanProvinsi(target.Provinsi);
  const targetDati = cleanDati(target['Dati II']);
  if (!targetProvince && !targetDati) return true;

  return branches.some((branch) => {
    const branchProvince = cleanProvinsi(branch.Provinsi);
    const branchDati = cleanDati(branch['Dati II']);
    const provinceMatches = !targetProvince || !branchProvince || targetProvince === branchProvince;
    const datiMatches = !targetDati || !branchDati || targetDati === branchDati;
    return provinceMatches && datiMatches;
  });
}

// Menghitung jarak garis lurus (geodesik) menggunakan Haversine Formula dalam km
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === 0 || lon1 === 0 || lat2 === 0 || lon2 === 0) return 0;
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Radius bumi dalam kilometer
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export type AnomalyType = 'PULAU' | 'PROVINSI' | 'STATUS' | 'PENEMPATAN' | 'ROLE';

export interface AnomalyItem {
  row: AnalystRow;
  lat: number;
  lng: number;
  hasCoord: boolean;
  anomalyType: AnomalyType;
  anomalyTitle: string;
  anomalyBadge: { text: string; bg: string; color: string; border: string };
  reasons: string[];
}


// Lapisan dasar awal: OSM
function tileBawaan(): TileProvider {
  return 'osm';
}

// Clean, lightweight tile layer factory supporting Google Maps, Satellite, Esri, and OSM
function getMapTileLayer(provider: TileProvider, bounds: L.LatLngBounds): L.TileLayer {
  if (provider === 'google') {
    return L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps',
      minZoom: 5,
      maxZoom: 20,
      bounds,
      noWrap: true,
    });
  }
  if (provider === 'google_hybrid') {
    return L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps',
      minZoom: 5,
      maxZoom: 20,
      bounds,
      noWrap: true,
    });
  }
  if (provider === 'osm') {
    return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      minZoom: 5,
      maxZoom: 19,
      bounds,
      noWrap: true,
    });
  }
  // Default: Esri World Street Map
  return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri, HERE, Garmin, USGS',
    minZoom: 5,
    maxZoom: 18,
    bounds,
    noWrap: true,
  });
}

export const IndonesiaBranchMap: React.FC<IndonesiaBranchMapProps> = ({
  masterRows,
  targetRows = [],
  finalRows = [],
  kodePosRows = [],
  selectedWilayah = 'ALL',
  onNavigateToMaster,
  onNavigateToEngine,
}) => {
  const { add: notify } = useNotification();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const svgRendererRef = useRef<L.SVG | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const arcsLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);


  const [activeRegion, setActiveRegion] = useState<keyof typeof INDONESIA_REGIONS>('ALL');
  const [mapSelectedWilayah, setMapSelectedWilayah] = useState<string>(selectedWilayah || 'ALL');

  useEffect(() => {
    if (selectedWilayah) {
      setMapSelectedWilayah(selectedWilayah);
    }
  }, [selectedWilayah]);

  const [displayScope, setDisplayScope] = useState<DisplayScope>('KC');
  // Lapisan yang sedang dibuka sebelum sebuah titik diisolasi. Dicatat saat masuk
  // isolasi supaya tombol "lepas isolasi" kembali ke lapisan yang sama.
  const [lapisanSebelumIsolasi, setLapisanSebelumIsolasi] = useState<DisplayScope>('KC');
  const masukIsolasi = () => {
    if (displayScope !== 'ISOLASI') setLapisanSebelumIsolasi(displayScope);
    setDisplayScope('ISOLASI');
  };
  // Tile OSM sebagai bawaan yang aman.
  const [tileProvider, setTileProvider] = useState<TileProvider>(tileBawaan);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPin, setSelectedPin] = useState<PlottedBranchPin | null>(null);
  const [activeBranchIndex, setActiveBranchIndex] = useState(0);

  // Toggle for Curved Arcs and Matched Detail Modal
  const [showCurvedArcs, setShowCurvedArcs] = useState(true);
  const [cameraLocked, setCameraLocked] = useState(false);
  const [showMatchedModal, setShowMatchedModal] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [trackingMode, setTrackingMode] = useState<'none' | 'aceh_kim'>('none');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showAnomalyPanel, setShowAnomalyPanel] = useState(false);
  const [selectedAnomalyRow, setSelectedAnomalyRow] = useState<AnalystRow | null>(null);
  const [mapInteractionTick, setMapInteractionTick] = useState(0);
// @ts-ignore: suppress unused setter warning
  const [showAllMatchMarkers, setShowAllMatchMarkers] = useState(false);

  // Realtime Online Geocoding State
  const [resolvedCoords, setResolvedCoords] = useState<Map<string, GeoLocationResult>>(new Map());
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState<BatchProgress | null>(null);
  // Flag: true once the IndexedDB pre-load pass completes (so geocoding effect knows cache is ready)
  const [cachePreloaded, setCachePreloaded] = useState(false);
  // Flag: true once the stored kode pos points (kodepos_geo) are loaded into memory
  const [titikKodePosSiap, setTitikKodePosSiap] = useState(false);
  // Indeks titik kode pos tersimpan (tabel kodepos_geo): kodePos(5 digit) → {lat,lng,sumber}.
  // Dipakai layer Final Data agar tidak men-geocode ulang dari nol.
  const [titikKodePos, setTitikKodePos] = useState<Record<string, { lat: number; lng: number; sumber?: string }>>({});

  // Cadangan penentuan titik: kelurahan+kecamatan -> koordinat. Sumbernya TETAP tabel
  // Data Kode Pos (bukan geocoder internet); yang berubah cuma caranya mencari.
  const titikByNama = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number; sumber?: string; kode: string; kota: string }[]>();
    for (const r of kodePosRows) {
      const lat = Number(r.latitude);
      const lng = Number(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const kode = String(r.kodePos || '').trim();
      const t = titikKodePos[kode];
      if (!t) continue;
      const k = kunciKelKec(r.kelurahan, r.kecamatan);
      const titik = { lat: t.lat, lng: t.lng, sumber: t.sumber, kode, kota: r.kabupatenKota || '' };
      const daftar = m.get(k);
      if (!daftar) m.set(k, [titik]);
      else if (!daftar.some((d) => d.kode === kode)) daftar.push(titik);
    }
    return m;
  }, [kodePosRows, titikKodePos]);

  /** Titik satu baris Data Final: kode posnya dulu, kalau gagal pakai nama wilayah. */
  const titikUntukBaris = useMemo(() => (r: AnalystRow) => {
    const kp = String(r.kodePosPten || '').replace(/\D/g, '').trim();
    const viaKode = kp ? titikKodePos[kp] : undefined;
    if (viaKode) return { lat: viaKode.lat, lng: viaKode.lng, kode: kp, sumber: viaKode.sumber, viaNama: false };
    const daftar = titikByNama.get(kunciKelKec(r.kelurahan, r.kecamatan));
    if (!daftar?.length) return null;
    // Kota hanya jadi pemecah: nama kota PTEN bisa berprefiks beda atau terpotong
    // (kolom MAX 15), jadi kalau tidak ada yang cocok tapi alternatifnya tunggal,
    // titik itu tetap aman dipakai. Banyak alternatif tanpa kecocokan kota -> jangan menebak.
    const cocok = daftar.find((d) => kotaCocok(d.kota, r.kotaPtenMax15 || r.kotaPten || ''));
    const pilih = cocok || (daftar.length === 1 ? daftar[0] : null);
    return pilih ? { ...pilih, viaNama: true } : null;
  }, [titikKodePos, titikByNama]);
  const lastAutoFitKeyRef = useRef('');
  const mapInteractionRef = useRef(false);
  const mapInteractionHandlersRef = useRef<{
    pauseMarkerRedraw: () => void;
    resumeMarkerRedraw: () => void;
  } | null>(null);

  // PRE-LOAD: On mount, bulk-read all previously cached geocoding results from IndexedDB
  // This makes subsequent page loads instant — no network calls for already-resolved addresses
  useEffect(() => {
    let cancelled = false;
    const IDB_PREFIX = 'geo_cache_';
    (async () => {
      try {
        const allKeys = await keys<string>();
        const geoKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(IDB_PREFIX));
        if (geoKeys.length === 0) {
          if (!cancelled) setCachePreloaded(true);
          return;
        }
        // Bulk-fetch all cached entries in parallel (all from local IndexedDB, ultra-fast)
        const entries = await Promise.all(
          geoKeys.map(async (k) => {
            const val = await get<GeoLocationResult>(k);
            return val ? [k.slice(IDB_PREFIX.length), val] as [string, GeoLocationResult] : null;
          })
        );
        if (!cancelled) {
          const preloaded = new Map<string, GeoLocationResult>();
          entries.forEach((e) => { if (e) preloaded.set(e[0], e[1]); });
          setResolvedCoords(preloaded);
          setCachePreloaded(true);
        }
      } catch {
        // IndexedDB unavailable (private browsing etc.) — proceed without preload
        if (!cancelled) setCachePreloaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []); // run once on mount

  // Titik kode pos tersimpan (tabel kodepos_geo) menjadi lokasi baris target:
  // satu sumber dengan menu Kode Pos, jadi peta tidak menebak sendiri.
  useEffect(() => {
    if (!cachePreloaded) return;
    let alive = true;
    void (async () => {
      // Satu balasan gagal tidak boleh menghapus titik sepanjang sesi: coba lagi
      // beberapa kali sebelum menyerah dan menggambar peta tanpa koordinat nyata.
      for (let percobaan = 0; percobaan < 3; percobaan++) {
        const titik = await muatTitikKodePos();
        if (Object.keys(titik).length > 0) return titik;
        await new Promise((r) => setTimeout(r, 1500));
      }
      return {};
    })().then((titik) => {
      if (!alive) return;
      const seed = new Map<string, GeoLocationResult>();
      for (const t of targetRows || []) {
        if (!t._isMatched || hasExplicitCoordinates(t)) continue;
        const q = buildTargetQuery(t);
        const kode = q ? kodePosUjung(q) : undefined;
        const p = kode ? titik[kode] : undefined;
        if (!p) continue;
        seed.set(q, {
          lat: p.lat,
          lng: p.lng,
          formattedAddress: `Titik kode pos ${kode} (tersimpan di Supabase Postgres)`,
          source: p.sumber,
        });
      }
      if (seed.size > 0) {
        setResolvedCoords((prev) => {
          const next = new Map(prev);
          seed.forEach((val, key) => next.set(key, val));
          return next;
        });
      }
      setTitikKodePos(titik);
      setTitikKodePosSiap(true);
    });
    return () => {
      alive = false;
    };
  }, [cachePreloaded, targetRows]);

  // Realtime Geocoding Hook: Resolves unique branch & target coordinates via Google Maps / Online API
  // Only runs AFTER cache preload & stored kode pos points so it fetches truly unknown addresses
  useEffect(() => {
    // Wait for IndexedDB preload + the kodepos_geo index before checking what's missing
    if (!cachePreloaded || !titikKodePosSiap) return;
    if (!masterRows || masterRows.length === 0) return;

    let isMounted = true;
    const queriesToFetch: string[] = [];
    const hasCachedCoordinate = (query: string) =>
      resolvedCoords.has(query) || resolvedCoords.has(query.toLowerCase());

    for (const r of masterRows) {
      if (hasExplicitCoordinates(r)) continue;
      // Cabang yang kode posnya sudah punya titik di Data Kode Pos tidak perlu dicari
      // lewat internet: hasilnya pasti kalah prioritas dari koordinat operator sendiri.
      const kode = kodePosLima(r['KODE POS']);
      if (kode && titikKodePos[kode]) continue;
      const q = buildMasterQuery(r);
      if (q && !hasCachedCoordinate(q)) {
        queriesToFetch.push(q);
      }
    }

    if (targetRows && targetRows.length > 0) {
      for (const t of targetRows) {
        if (!t._isMatched || hasExplicitCoordinates(t)) continue;
        const q = buildTargetQuery(t);
        if (q && !hasCachedCoordinate(q)) {
          queriesToFetch.push(q);
        }
      }
    }

    const uniqueQueries = Array.from(new Set(queriesToFetch));
    // If everything is already in cache — skip entirely, no loading bar shown
    if (uniqueQueries.length === 0) return;

    setIsGeocoding(true);
    setGeocodingProgress({ completed: 0, total: uniqueQueries.length, percent: 0 });

    const runBackgroundGeocoding = async () => {
      const QUERY_CHUNK_SIZE = 120;
      let completedBeforeChunk = 0;

      for (let i = 0; i < uniqueQueries.length; i += QUERY_CHUNK_SIZE) {
        if (!isMounted) return;
        const chunk = uniqueQueries.slice(i, i + QUERY_CHUNK_SIZE);
        const newResults = await batchGeocodeUniqueQueries(
          chunk,
          (prog) => {
            if (isMounted) {
              setGeocodingProgress({
                ...prog,
                completed: completedBeforeChunk + prog.completed,
                total: uniqueQueries.length,
                percent: Math.round(((completedBeforeChunk + prog.completed) / uniqueQueries.length) * 100),
              });
            }
          }
        );

        if (!isMounted) return;
        completedBeforeChunk += chunk.length;
        setResolvedCoords((prev) => {
          const next = new Map(prev);
          newResults.forEach((val, key) => next.set(key, val));
          return next;
        });

        // Yield to painting and user input before starting the next network chunk.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }

      if (isMounted) {
        setIsGeocoding(false);
        setGeocodingProgress(null);
      }
    };

    void runBackgroundGeocoding();

    return () => {
      isMounted = false;
    };
  }, [cachePreloaded, titikKodePosSiap, titikKodePos, masterRows, targetRows]);

  // List of exact Wilayah for map filtering
  const mapWilayahList = useMemo(() => {
    const set = new Set<string>();
    masterRows.forEach((m) => {
      if (m.Wilayah && String(m.Wilayah).trim()) {
        const norm = formatWilayahName(m.Wilayah);
        if (norm && norm !== 'Tanpa Wilayah') set.add(norm);
      }
    });
    targetRows.forEach((r) => {
      if (r.Wilayah && String(r.Wilayah).trim()) {
        const norm = formatWilayahName(r.Wilayah);
        if (norm && norm !== 'Tanpa Wilayah') set.add(norm);
      }
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }, [masterRows, targetRows]);

  const mapWilayahPinCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of masterRows) {
      if (m.Wilayah) {
        const norm = formatWilayahName(m.Wilayah);
        map.set(norm, (map.get(norm) || 0) + 1);
      }
    }
    return map;
  }, [masterRows]);

  // Set kode pos PTEN untuk pencocokan instan O(1) di popup detail
  const ptenKpSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < DEFAULT_PTEN_DATA.length; i++) {
      const kp = String(DEFAULT_PTEN_DATA[i].kodePosPten || '').replace(/\D/g, '').trim();
      if (kp && kp.length === 5) set.add(kp);
    }
    for (const m of masterRows) {
      const kp = String(m['KODE POS PTEN'] || m['KODE POS'] || '').replace(/\D/g, '').trim();
      if (kp && kp.length === 5) set.add(kp);
    }
    return set;
  }, [masterRows]);

  // Pin terpilih menyimpan snapshot baris (`selectedPin.branches`). Bila salah satu
  // sumber data berganti, snapshot itu bisa menunjuk hasil lama → tutup drawer.
  // Dilakukan di render (bukan `useEffect`) supaya tidak ada commit dengan data usang.
  const [sumberPinSebelum, setSumberPinSebelum] = useState([masterRows, targetRows, finalRows]);
  if (
    sumberPinSebelum[0] !== masterRows ||
    sumberPinSebelum[1] !== targetRows ||
    sumberPinSebelum[2] !== finalRows
  ) {
    setSumberPinSebelum([masterRows, targetRows, finalRows]);
    if (selectedPin) setSelectedPin(null);
  }

  // 1. Group & Cluster master rows into pins using dynamic resolved coordinates & map selected Wilayah
  const allPins = useMemo(() => {
    return clusterMasterRowsForMap(masterRows, mapSelectedWilayah, targetRows, resolvedCoords, titikKodePos);
  }, [masterRows, mapSelectedWilayah, targetRows, resolvedCoords, titikKodePos]);

  const multiOutletKodePos = useMemo(() => {
    const counts = new Map<string, number>();
    allPins.forEach((pin) => {
      const kodePos = String(pin.kodePos || '').replace(/\D/g, '').trim();
      if (kodePos) counts.set(kodePos, (counts.get(kodePos) || 0) + pin.branchCount);
    });
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([kodePos]) => kodePos));
  }, [allPins]);

  const isMultiOutletPin = useCallback((pin: PlottedBranchPin) => {
    const kodePos = String(pin.kodePos || '').replace(/\D/g, '').trim();
    return pin.branchCount > 1 || (kodePos !== '' && multiOutletKodePos.has(kodePos));
  }, [multiOutletKodePos]);

  // Titik kantor tiap cabang (KODE POS baris Data Cabang -> koordinat Data Kode Pos).
  const kantorCabang = useMemo(() => indeksKantorCabang(masterRows, titikKodePos), [masterRows, titikKodePos]);

  // ── JEMBATAN DATA FINAL: kelurahan baris <-> kantor outlet yang memegangnya ──
  // Sekali per muat data — BUKAN per ganti lapisan, karena garisnya dipakai KC/KCP
  // maupun titik kodepos.
  const jembatanFinal = useMemo(
    () => (finalRows.length > 0 ? bangunJembatanOutlet(finalRows, titikKodePos, kantorCabang)
      : { koneksi: new Map<string, KoneksiTitik[]>(), status: new Map<string, StatusTitik>(), tanpaKantor: 0 }),
    [finalRows, titikKodePos, kantorCabang]
  );

  // ── LAYER KODE POS NASIONAL: semua titik dari Data Kode Pos, bukan hanya yang punya cabang ──
  // Status per titik TIDAK disimpan di objek pin-nya: kalau ikut, setiap kali indeks
  // jembatan berubah harus ada 10.596 objek baru. Diambil lewat lookup saat render.
  const kodePosPins = useMemo<PlottedBranchPin[]>(() => {
    const namaPerKode = new Map<string, { kota: string; provinsi: string }>();
    for (const r of kodePosRows) {
      const k = String(r.kodePos || '').trim();
      if (!k || namaPerKode.has(k)) continue;
      namaPerKode.set(k, { kota: String(r.kabupatenKota || r.kecamatan || '').trim() || '-', provinsi: cleanProvinsi(r.provinsi) || '-' });
    }
    const pins: PlottedBranchPin[] = [];
    for (const [kode, t] of Object.entries(titikKodePos)) {
      if (!Number.isFinite(t.lat) || !Number.isFinite(t.lng)) continue;
      const w = namaPerKode.get(kode);
      pins.push({
        id: `kp-${kode}`,
        lat: t.lat,
        lng: t.lng,
        kodePos: kode,
        dati2: w?.kota || '-',
        wilayah: w?.provinsi || '-',
        branches: [],
        branchCount: 1,
        primaryOutletName: `Kode pos ${kode}`,
        alamatDisplay: `${w?.kota || '-'}, ${w?.provinsi || '-'}`,
        matchedCount: 0,
        totalTargetCount: 0,
        sumberTitik: 'kodepos_data',
        isTitikKodePos: true,
      });
    }
    return pins;
  }, [titikKodePos, kodePosRows]);

  // Pencarian kode pos harus sampai ke titik kode posnya, bukan hanya ke cabang.
  const pinPerKode = useMemo(() => new Map(kodePosPins.map((p) => [p.kodePos, p])), [kodePosPins]);

  // Baris Data Final yang TIDAK muncul di peta: tidak dapat titik dari tabel kode pos,
  // baik lewat kode posnya maupun lewat nama kelurahan+kecamatan+kota.
  const finalBelumTerpetakan = useMemo<AnalystRow[]>(() => {
    if (!finalRows || finalRows.length === 0) return [];
    return finalRows.filter((r) => !titikUntukBaris(r));
  }, [finalRows, titikUntukBaris]);

  // Angka untuk dropdown: dihitung dari baris datanya, bukan dari jumlah pin.
  const hitunganLayer = useMemo(() => {
    let kc = 0;
    let kcp = 0;
    for (const m of masterRows) {
      if (kategoriUnitCabang(m) === 'KC') kc++;
      else kcp++;
    }
    const outletMulti = allPins.reduce((n, p) => (isMultiOutletPin(p) ? n + p.branchCount : n), 0);
    return { kc, kcp, outletMulti, kodePos: Object.keys(titikKodePos).length };
  }, [masterRows, allPins, titikKodePos, isMultiOutletPin]);

  // 2. Filter pins based on Display Scope
  const filteredPins = useMemo(() => {
    if (displayScope === 'ISOLASI') {
      return selectedPin ? [selectedPin] : allPins.slice(0, 1);
    }
    if (displayScope === 'KODEPOS') return kodePosPins;
    if (displayScope === 'MULTI') return allPins.filter(isMultiOutletPin);
    return allPins.filter((p) => p.unitKat === displayScope);
  }, [allPins, kodePosPins, displayScope, selectedPin, isMultiOutletPin]);

  // Satu sumber untuk label dropdown dan panelnya — tidak bisa lagi beda angka.
  // Warnanya sengaja SERAGAM: jenis titik dibaca dari ikon/label, bukan dari warna.
  const opsiLayer: { value: DisplayScope; label: string; n: number; satuan: string; teks: string; desc: string }[] = [
    { value: 'KC', label: 'KC', n: hitunganLayer.kc, satuan: 'KC', teks: `KC (${hitunganLayer.kc.toLocaleString('id-ID')})`, desc: 'Kantor Cabang — dari kolom Status Outlet Data Cabang' },
    { value: 'KCP', label: 'KCP', n: hitunganLayer.kcp, satuan: 'KCP', teks: `KCP (${hitunganLayer.kcp.toLocaleString('id-ID')})`, desc: 'Kantor Cabang Pembantu, termasuk KCP d/h KK' },
    { value: 'MULTI', label: 'Multi-Outlet', n: hitunganLayer.outletMulti, satuan: 'outlet', teks: `Multi-Outlet (${hitunganLayer.outletMulti.toLocaleString('id-ID')} outlet)`, desc: 'Outlet yang titiknya dipakai lebih dari satu cabang' },
    { value: 'KODEPOS', label: 'Kodepos', n: hitunganLayer.kodePos, satuan: 'titik', teks: `Kodepos (${hitunganLayer.kodePos.toLocaleString('id-ID')} titik)`, desc: 'Semua titik kode pos Indonesia dari Data Kode Pos. Klik satu titik untuk menarik garis lengkung ke KC/KCP pasangannya di Data Final.' },
  ];
  const aktifLayer = opsiLayer.find((o) => o.value === displayScope);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Debounce search query so typing isn't lagging on large datasets
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 120);
    return () => clearTimeout(timer);
  }, [searchQuery]);


  // Pre-index target records by keywords to make target lookup instant (O(1)) instead of O(N*M)
  const targetSearchIndex = useMemo(() => {
    if (!targetRows || targetRows.length === 0) return null;
    const sandiToTargets = new Map<string, TargetRow[]>();
    const branchCodeToTargets = new Map<string, TargetRow[]>();

    targetRows.forEach((t) => {
      if (!t._isMatched) return;
      const sandi = String(t['Sandi Cabang'] || t.Sandi || t.Cabang || '').trim();
      const code = String(t['Branch Code'] || t['Kode Cabang'] || '').trim();
      if (sandi) {
        if (!sandiToTargets.has(sandi)) sandiToTargets.set(sandi, []);
        sandiToTargets.get(sandi)!.push(t);
      }
      if (code) {
        if (!branchCodeToTargets.has(code)) branchCodeToTargets.set(code, []);
        branchCodeToTargets.get(code)!.push(t);
      }
    });

    return { sandiToTargets, branchCodeToTargets };
  }, [targetRows]);

  // 3. Search suggestions (top matches, fast indexed lookup)
  const searchSuggestions = useMemo((): SearchSuggestionItem[] => {
    const qRaw = debouncedSearchQuery.trim();
    if (!qRaw || qRaw.length < 2) return [];
    const q = qRaw.toLowerCase();
    const items: SearchSuggestionItem[] = [];
    const addedPinIds = new Set<string>();

    // 0. Kode pos 5 digit: yang dicari ADALAH titik kode posnya. Tanpa langkah ini,
    //    mengetik 23611 meloloskan cabang yang hanya kebetulan melayani data bernomor
    //    sama (terlihat di layar: "UNIV. PENDIDIKAN INDONESIA · Kota Bandung · 40154").
    let titikEksak = false;
    if (/^\d{5}$/.test(qRaw)) {
      const titikPin = pinPerKode.get(qRaw);
      if (titikPin) {
        titikEksak = true;
        const pasangan = jembatanFinal.koneksi.get(qRaw) || [];
        const terdekat = pasangan
          .map((k) => ({ k, km: calculateDistanceKm(titikPin.lat, titikPin.lng, k.lat, k.lng) }))
          .sort((a, b) => a.km - b.km)[0];
        items.push({
          pin: titikPin,
          serviceNote: terdekat
            ? `Dipegang ${pasangan.length.toLocaleString('id-ID')} outlet · terdekat ${terdekat.k.outlet} (KP ${terdekat.k.kode}) ${terdekat.km.toLocaleString('id-ID', { maximumFractionDigits: 0 })} km`
            : 'Titik Data Kode Pos — belum ada baris Data Final yang memakai kelurahan ini',
        });
        addedPinIds.add(titikPin.id);
      }
    }

    // 1. Direct branch matches (kode pos, nama cabang, kota)
    for (const p of allPins) {
      const isDirectMatch =
        p.kodePos.includes(q) ||
        p.dati2.toLowerCase().includes(q) ||
        p.primaryOutletName.toLowerCase().includes(q) ||
        p.branches.some(
          (b) =>
            String(b['Sandi Cabang'] || b.Sandi || '').toLowerCase().includes(q) ||
            String(b['Branch Code'] || b['Kode Cabang'] || '').toLowerCase().includes(q) ||
            String(b['Nama Outlet'] || '').toLowerCase().includes(q)
        );

      if (isDirectMatch) {
        items.push({ pin: p });
        addedPinIds.add(p.id);
        if (items.length >= 7) break;
      }
    }

    // 2. Fast lookup for target origins (e.g. searching 'Aceh' or target postal code).
    //    Dilewati kalau kode posnya ketemu sebagai titik: daftar outlet pemegang titik
    //    itu sudah disajikan lebih akurat lewat garis lengkung + panel rincian.
    if (!titikEksak && items.length < 8 && targetSearchIndex && allPins.length > 0) {
      for (const p of allPins) {
        if (addedPinIds.has(p.id)) continue;

        // Get matched targets attached to this pin using index
        let matchingTarget: TargetRow | undefined;
        for (const b of p.branches) {
          const sandi = String(b['Sandi Cabang'] || b.Sandi || b['Kode Cabang'] || '').trim();
          const code = String(b['Branch Code'] || b['Kode Cabang'] || '').trim();
          const candidates = [
            ...(targetSearchIndex.sandiToTargets.get(sandi) || []),
            ...(targetSearchIndex.branchCodeToTargets.get(code) || []),
          ];

          matchingTarget = candidates.find((t) => {
            const targetText = `${t['KODE POS'] || ''} ${t['Dati II'] || ''} ${t.Provinsi || ''} ${t.Kecamatan || ''} ${t.ALAMAT || ''}`.toLowerCase();
            return targetText.includes(q);
          });

          if (matchingTarget) break;
        }

        if (matchingTarget) {
          const origin = resolveTargetOriginCoordinates(matchingTarget, resolvedCoords);
          const [oLat, oLng] = clampToIndonesia(origin.lat, origin.lng);
          const originCity = matchingTarget['Dati II'] || origin.city || 'Aceh';
          const originKp = matchingTarget['KODE POS'] || '';
          items.push({
            pin: p,
            serviceNote: `Melayani data target di ${originCity} (📮 ${originKp})`,
            sourceCoords: [oLat, oLng],
          });
          addedPinIds.add(p.id);
          if (items.length >= 8) break;
        }
      }
    }

    return items;
  }, [allPins, debouncedSearchQuery, targetSearchIndex, resolvedCoords, pinPerKode, jembatanFinal]);


  // Map Summary Statistics
  const stats = useMemo(() => {
    const totalBranches = allPins.reduce((acc, p) => acc + p.branchCount, 0);
    const multiOutletPins = allPins.filter(isMultiOutletPin).length;
    const pinsWithMatch = allPins.filter((p) => p.matchedCount > 0);
    const totalMatchedRecords = allPins.reduce((acc, p) => acc + p.matchedCount, 0);

    return {
      totalBranches,
      uniqueSpots: allPins.length,
      multiOutletPins,
      pinsWithMatchCount: pinsWithMatch.length,
      totalMatchedRecords,
      activeShowing: filteredPins.length,
    };
  }, [allPins, filteredPins, isMultiOutletPin]);

  // 4. Find all Matched Target Rows associated with the currently selected branch
  const selectedMatchedRows = useMemo(() => {
    if (!selectedPin || targetRows.length === 0) return [];
    const sandiSet = new Set(
      selectedPin.branches
        .map((b) => String(b['Sandi Cabang'] || b.Sandi || b['Kode Cabang'] || '').trim())
        .filter(Boolean)
    );
    const branchCodeSet = new Set(
      selectedPin.branches
        .map((b) => String(b['Branch Code'] || b['Kode Cabang'] || '').trim())
        .filter(Boolean)
    );
    const outletNameSet = new Set(
      selectedPin.branches.map((b) => String(b['Nama Outlet'] || '').toLowerCase().trim()).filter(Boolean)
    );
    const attached = targetRows.filter((t) => {
      if (!t._isMatched) return false;
      const tSandi = String(t['Sandi Cabang'] || t.Sandi || t.Cabang || '').trim();
      const tBranchCode = String(t['Branch Code'] || t['Kode Cabang'] || '').trim();
      const tName = String(t['Nama Outlet'] || '').toLowerCase().trim();
      const isExplicitMatch =
        (tSandi && sandiSet.has(tSandi)) ||
        (tBranchCode && branchCodeSet.has(tBranchCode)) ||
        (tName && outletNameSet.has(tName));

      if (isExplicitMatch && isTargetInSelectedBranchRegion(t, selectedPin.branches)) return true;

      // Postal code alone is not enough to draw a relation to a branch. It can
      // represent several outlets and creates misleading long arcs on the map.
      return false;
    });

    if (trackingMode === 'aceh_kim') {
      return attached.filter((t) => isAcehTargetRow(t));
    }
    return attached;
  }, [selectedPin, targetRows, trackingMode]);

  // Dedicated Aceh Detection — administrative fields only (kode pos / Dati II / provinsi)
  const acehTargetMatches = useMemo(() => {
    return targetRows.filter((t) => t._isMatched && isAcehTargetRow(t));
  }, [targetRows]);

  const [anomalyTypeFilter, setAnomalyTypeFilter] = useState<'ALL' | AnomalyType>('ALL');

  // Esc menutup panel anomali, sama seperti dialog lain di aplikasi ini.
  useEffect(() => {
    if (!showAnomalyPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAnomalyPanel(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAnomalyPanel]);

  // ── Anomali: SATU definisi (detectFinalAnomalies) — identik dgn kartu Dashboard ──
  const anomalyRows: AnomalyItem[] = useMemo(() => {
    if (!showAnomalyPanel) return [];
    const detected = detectFinalAnomalies(finalRows || [], masterRows || []);
    return detected.map(({ row: r, primary, reasons }) => {
      const titik = titikUntukBaris(r) || undefined;

      let anomalyTitle = 'Anomali Status Analisa';
      let anomalyBadge: { text: string; bg: string; color: string; border: string } = { text: r.statusAnalisa, bg: '#fdeae5', color: '#991b1b', border: '#f87171' };
      if (primary === 'PULAU') {
        anomalyTitle = 'Penempatan Beda Pulau';
        anomalyBadge = { text: 'Beda Pulau', bg: '#fdeae5', color: '#991b1b', border: '#f87171' };
      } else if (primary === 'PROVINSI') {
        anomalyTitle = 'Penempatan Beda Provinsi';
        anomalyBadge = { text: 'Beda Provinsi', bg: '#ffedd5', color: '#9a3412', border: '#fb923c' };
      } else if (primary === 'PENEMPATAN') {
        anomalyTitle = 'Penempatan Belum Terverifikasi';
        anomalyBadge = { text: `Penempatan ${r.placementStatus}`, bg: '#ffedd5', color: '#9a3412', border: '#fb923c' };
      } else if (primary === 'ROLE') {
        anomalyTitle = 'Role Belum Lengkap';
        anomalyBadge = { text: `Role ${r.roleGrandTotal}/3`, bg: '#fef3c7', color: '#92400e', border: '#f7b84b' };
      }

      return {
        row: r,
        lat: titik?.lat ?? 0,
        lng: titik?.lng ?? 0,
        hasCoord: !!titik,
        anomalyType: primary,
        anomalyTitle,
        anomalyBadge,
        reasons,
      };
    });
  }, [finalRows, masterRows, titikUntukBaris, showAnomalyPanel]);

  const filteredAnomalyRows = useMemo(() => {
    if (anomalyTypeFilter === 'ALL') return anomalyRows;
    return anomalyRows.filter((item) => item.anomalyType === anomalyTypeFilter);
  }, [anomalyRows, anomalyTypeFilter]);

  // Fly ke titik anomali ketika dipilih dari panel
  useEffect(() => {
    if (!selectedAnomalyRow || cameraLocked) return;
    const titik = titikUntukBaris(selectedAnomalyRow);
    const map = mapInstanceRef.current;
    if (map && titik) map.flyTo([titik.lat, titik.lng], Math.max(map.getZoom(), 11), { duration: 0.6 });
  }, [selectedAnomalyRow, titikUntukBaris, cameraLocked]);


  // Filtered rows inside the Matched Detail Modal
  const filteredModalRows = useMemo(() => {
    if (!modalSearchTerm.trim()) return selectedMatchedRows;
    const q = modalSearchTerm.toLowerCase().trim();
    return selectedMatchedRows.filter(
      (r) =>
        String(r.No || '').includes(q) ||
        String(r['Nama Outlet'] || '').toLowerCase().includes(q) ||
        String(r.ALAMAT || '').toLowerCase().includes(q) ||
        String(r.Kecamatan || '').toLowerCase().includes(q) ||
        String(r['KODE POS'] || '').includes(q)
    );
  }, [selectedMatchedRows, modalSearchTerm]);

  // Modal bisa memuat seluruh baris satu pin (puluhan ribu) — jendela render-nya
  const modalScrollRef = useRef<HTMLDivElement | null>(null);
  const modalWin = useVirtualWindow({ containerRef: modalScrollRef, itemCount: filteredModalRows.length });
  const renderedModalRows = modalWin.active ? filteredModalRows.slice(modalWin.start, modalWin.end) : filteredModalRows;
  const modalRowOffset = modalWin.active ? modalWin.start : 0;

  // 5. Strict geographical bounds for Indonesia (Sabang / Aceh to Merauke / Papua)
  const indonesiaBounds = useMemo(() => {
    return L.latLngBounds(
      L.latLng(-11.2, 94.5), // West & South: Strict boundary at Sabang & Rote Ndao
      L.latLng(6.2, 141.2)   // North & East: Strict boundary at Miangas & Merauke
    );
  }, []);

  // 6. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const canvasRenderer = L.canvas({ padding: 0.5, tolerance: 12 });
      canvasRendererRef.current = canvasRenderer;
      // Renderer SVG khusus utk arc & halo terpilih → animasi CSS (flowDash/pulse) jadi hidup
      const svgRenderer = L.svg({ padding: 0.6 });
      svgRendererRef.current = svgRenderer;

      const map = L.map(mapContainerRef.current, {
        center: INDONESIA_REGIONS.ALL.center,
        zoom: 5,
        minZoom: 2,                  // Allow zooming out freely
        maxZoom: 18,
        zoomControl: true,
        scrollWheelZoom: true,
        zoomDelta: 0.5,
        zoomSnap: 0.5,
        wheelDebounceTime: 80,
        wheelPxPerZoomLevel: 120,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        inertia: true,
        inertiaDeceleration: 2600,
        easeLinearity: 0.22,
        preferCanvas: true,
      });

      // Dedicated z-index panes so markers are always above background arcs
      if (!map.getPane('arcsPane')) {
        const arcsPane = map.createPane('arcsPane');
        arcsPane.style.zIndex = '450';
      }
      if (!map.getPane('markersPane')) {
        const markersPane = map.createPane('markersPane');
        markersPane.style.zIndex = '550';
      }
      if (!map.getPane('selectedPane')) {
        const selectedPane = map.createPane('selectedPane');
        selectedPane.style.zIndex = '540';
      }

      // Fit Indonesia bounds on load
      map.fitBounds(indonesiaBounds, { padding: [20, 20] });

      // Ultra-clean, fast tile layer (Google bila kunci ada, selain itu OSM)
      const tileLayer = getMapTileLayer(tileBawaan(), indonesiaBounds).addTo(map);
      tileLayerRef.current = tileLayer;

      // Add arcs layer first, then markers layer on top
      const arcsLayer = L.layerGroup().addTo(map);
      const markersLayer = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = markersLayer;
      arcsLayerRef.current = arcsLayer;

      const pauseMarkerRedraw = () => { mapInteractionRef.current = true; };
      const resumeMarkerRedraw = () => {
        mapInteractionRef.current = false;
        setMapInteractionTick((tick) => tick + 1);
      };
      map.on('zoomstart movestart', pauseMarkerRedraw);
      map.on('zoomend moveend', resumeMarkerRedraw);

      mapInteractionHandlersRef.current = { pauseMarkerRedraw, resumeMarkerRedraw };
    }

    return () => {
      if (mapInstanceRef.current) {
        const handlers = mapInteractionHandlersRef.current;
        if (handlers) {
          mapInstanceRef.current.off('zoomstart movestart', handlers.pauseMarkerRedraw);
          mapInstanceRef.current.off('zoomend moveend', handlers.resumeMarkerRedraw);
        }
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [indonesiaBounds]);

  // ANI-1: titik pertama selama ini muncul tiba-tiba begitu cluster selesai dihitung.
  // Layer pin dibiarkan memudar masuk sekali saja, lalu animasi dilepas supaya redraw
  // berikutnya (filter/zoom) tidak ikut berkedip.
  const pinFadeDoneRef = useRef(false);
  useEffect(() => {
    if (pinFadeDoneRef.current) return;
    const pane = mapInstanceRef.current?.getPane('markersPane');
    if (!pane) return;
    pane.style.animation = 'qdrFade 0.45s ease both';
    const selesai = () => { pane.style.animation = ''; };
    pane.addEventListener('animationend', selesai, { once: true });
    pinFadeDoneRef.current = true;
    return () => pane.removeEventListener('animationend', selesai);
  }, [filteredPins.length]);

  // 7. Handle Tile Provider Switch (Google Maps vs Google Satelit vs Esri vs OSM)
  const handleSwitchTile = (provider: TileProvider) => {
    setTileProvider(provider);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const newLayer = getMapTileLayer(provider, indonesiaBounds).addTo(map);
    tileLayerRef.current = newLayer;
  };



  // 8. Render CircleMarkers on GPU Canvas with Live Matched Data Correlation
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const canvasRenderer = canvasRendererRef.current;
    if (!map || !markersLayer || !canvasRenderer) return;
    if (mapInteractionRef.current) return;

    markersLayer.clearLayers();
    const overlapCounts = new Map<string, number>();

    // Render satu pin sebagai ikon jenis (perilaku normal saat tidak ter-cluster).
    const addPinMarker = (pin: PlottedBranchPin) => {
      const isMulti = isMultiOutletPin(pin);
      const hasMatch = pin.matchedCount > 0;
      const isSelected = selectedPin?.id === pin.id;

      // Titik lapisan kode pos mengambil status & jumlah barisnya dari indeks jembatan
      // saat render — disimpan di objek pin berarti 10.596 pin harus dibuat ulang tiap
      // indeks berubah, dan itu yang membuat pindah lapisan terasa berat.
      const kodeTitik = pin.isTitikKodePos ? kodePosLima(pin.kodePos) : '';
      const koneksiTitik = kodeTitik ? jembatanFinal.koneksi.get(kodeTitik) : undefined;
      const tampil: PlottedBranchPin = pin.isTitikKodePos
        ? {
            ...pin,
            finalStatus: jembatanFinal.status.get(kodeTitik),
            finalCount: koneksiTitik?.reduce((n, k) => n + k.baris, 0) || undefined,
          }
        : pin;

      // Bentuk = jenis titik. Warna TIDAK lagi dipakai membedakan jenis atau status:
      // satu warna untuk semua, titik terpilih biru.
      const kind: PinKind = tampil.isTitikKodePos || tampil.finalStatus
        ? 'KODEPOS'
        : isMulti
        ? 'MULTI'
        : getUnitCategory(tampil.primaryOutletName) === 'KC'
        ? 'KC'
        : 'KCP';
      const fillColor = isSelected ? WARNA_PIN_TERPILIH : WARNA_PIN;

      const overlapKey = `${pin.lat.toFixed(5)}:${pin.lng.toFixed(5)}`;
      const overlappingIndex = overlapCounts.get(overlapKey) || 0;
      overlapCounts.set(overlapKey, overlappingIndex + 1);
      const visualCoords: [number, number] = overlappingIndex === 0
        ? [pin.lat, pin.lng]
        : [pin.lat + Math.sin(overlappingIndex * 2.4) * 0.002, pin.lng + Math.cos(overlappingIndex * 2.4) * 0.002];

      const marker = L.marker(visualCoords, {
        pane: 'markersPane',
        icon: makePinIcon(kind, fillColor, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
        keyboard: false,
      });

      // Instant lightweight hover tooltip
      const finalBadge = tampil.finalStatus
        ? `<div style="font-weight:700;font-size:11px;margin-top:3px;color:${tampil.finalStatus === 'ANOMALI' ? '#f06548' : tampil.finalStatus === 'REVIEW' ? '#d68b0c' : '#0ab39c'};">
            ${tampil.finalStatus === 'ANOMALI' ? '⛔ Anomali' : tampil.finalStatus === 'REVIEW' ? '⚠️ Perlu Review' : '✓ Final · Terverifikasi'} · ${tampil.finalCount?.toLocaleString('id-ID') ?? tampil.branchCount.toLocaleString('id-ID')} baris
          </div>`
        : pin.isTitikKodePos
        ? `<div style="color:#878a99;font-size:10.5px;margin-top:2px;">Belum terhubung ke Data Final</div>`
        : '';
      const garisBadge = koneksiTitik?.length
        ? `<div style="color:#299cdb;font-weight:700;font-size:10.5px;margin-top:2px;">${koneksiTitik.length.toLocaleString('id-ID')} pasangan — klik untuk garis lengkung</div>`
        : '';
      // Jujur soal asal titik: kode pos = koordinat berkas operator; pusat wilayah = bukan kantor.
      const asalTitik = pin.perkiraan
        ? `<div style="color:#f06548;font-weight:700;font-size:10.5px;margin-top:2px;">Titik perkiraan (pusat wilayah) — kode pos cabang tidak ada di Data Kode Pos</div>`
        : pin.sumberTitik === 'kodepos_data'
        ? `<div style="color:#878a99;font-size:10px;margin-top:2px;">Koordinat dari Data Kode Pos</div>`
        : '';
      const tooltipContent = `
        <div style="font-family:inherit;font-size:11.5px;padding:3px 5px;line-height:1.4;">
          <div style="font-weight:700;color:#212529;display:flex;align-items:center;gap:4px;">
            <span>${PIN_GLYPH[kind]} ${PIN_LABEL[kind]}</span>
          </div>
          <div style="color:#212529;font-size:11px;margin-top:1px;">
            <span>${tampil.primaryOutletName}</span>
          </div>
          <div style="color:#6c757d;font-size:10.5px;margin-top:2px;">
            ${tampil.dati2} &bull; <strong style="color:#405189;">📮 ${tampil.kodePos}</strong>
          </div>
          ${finalBadge}
          ${garisBadge}
          ${asalTitik}
          ${!tampil.finalStatus && hasMatch ? `<div style="color:#0ab39c;font-weight:700;font-size:11px;margin-top:3px;display:flex;align-items:center;gap:4px;">
            <span>✓</span> <strong>${tampil.matchedCount.toLocaleString('id-ID')} Data Matched (Klik untuk Garis Lengkung)</strong>
          </div>` : ''}
          ${!tampil.finalStatus && isMulti ? `<div style="color:#f06548;font-weight:700;font-size:10.5px;margin-top:2px;">⚠️ ${tampil.branchCount} Cabang di Titik ini</div>` : ''}
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -6],
        opacity: 0.96,
        className: 'bni-map-fast-tooltip',
      });

      // Instant cursor feedback on hover
      marker.on('mouseover', () => {
        if (mapContainerRef.current) {
          mapContainerRef.current.style.cursor = 'pointer';
        }
      });
      marker.on('mouseout', () => {
        if (mapContainerRef.current) {
          mapContainerRef.current.style.cursor = 'default';
        }
      });

      // Click to select, fly to pin, and open drawer (with stopPropagation)
      marker.on('click', () => {
        setTrackingMode('none');
        setSelectedAnomalyRow(null);
        setSelectedPin(pin);
        setActiveBranchIndex(0);
        // Invalidate size after panel appears (grid layout changes width)
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize({ animate: false });
          }
        }, 250);
      });

      markersLayer.addLayer(marker);
    };

    // ── CLUSTERING layar: pin yang berdekatan dilebur jadi gelembung hitung,
    //    supaya jumlah node DOM (bukan ambang jumlah) yang menjaga peta tetap ringan.
    //    Klik cluster → zoom ke anggotanya. Pin terpilih selalu tampil utuh. ──
    const zoom = map.getZoom();
    if (filteredPins.length <= 40) {
      filteredPins.forEach(addPinMarker);
    } else {
      // Pin terpilih selalu tampil utuh; sisanya lewat penyaring layar + sel clustering.
      const terpilih = selectedPin && filteredPins.some((p) => p.id === selectedPin.id) ? selectedPin : null;
      if (terpilih) addPinMarker(terpilih);
      const { sel: buckets } = bagiPinKeSelLayar(
        terpilih ? filteredPins.filter((p) => p.id !== terpilih.id) : filteredPins,
        (pin) => map.latLngToContainerPoint([pin.lat, pin.lng]),
        map.getSize()
      );
      buckets.forEach((b) => {
        if (b.pins.length === 1) {
          addPinMarker(b.pins[0]);
          return;
        }
        const center: [number, number] = [b.sumLat / b.pins.length, b.sumLng / b.pins.length];
        const totalBranches = b.pins.reduce((n, p) => n + (p.branchCount || 1), 0);
        const isian = b.pins[0]?.isTitikKodePos ? 'titik kode pos' : 'cabang';
        const cluster = L.marker(center, {
          pane: 'markersPane',
          icon: makeClusterIcon(b.pins.length),
          zIndexOffset: -10,
          keyboard: false,
        });
        cluster.bindTooltip(
          `<div style="font-size:11px;font-weight:600;">${b.pins.length.toLocaleString('id-ID')} titik · ${totalBranches.toLocaleString('id-ID')} ${isian}<br/><span style="color:#878a99;font-weight:400;">Klik untuk memperbesar</span></div>`,
          { direction: 'top', className: 'bni-map-fast-tooltip' }
        );
        cluster.on('mouseover', () => { if (mapContainerRef.current) mapContainerRef.current.style.cursor = 'zoom-in'; });
        cluster.on('mouseout', () => { if (mapContainerRef.current) mapContainerRef.current.style.cursor = 'default'; });
        cluster.on('click', () => {
          const bounds = L.latLngBounds(b.pins.map((p) => [p.lat, p.lng] as [number, number]));
          map.fitBounds(bounds.pad(0.4), { maxZoom: Math.min(zoom + 3, 17), animate: true, duration: 0.5 });
        });
        markersLayer.addLayer(cluster);
      });
    }

    // Render all matched target coordinates as orange markers when enabled
    if (showAllMatchMarkers) {
      const allCoords = getAllMatchedCoordinates(targetRows, resolvedCoords);
      allCoords.forEach(([lat, lng]) => {
        const marker = L.circleMarker([lat, lng], {
          pane: 'markersPane',
          renderer: canvasRenderer,
          radius: 4,
          fillColor: '#ff6600',
          color: '#ffffff',
          weight: 1,
          fillOpacity: 0.9,
        });
        markersLayer.addLayer(marker);
      });
    }

    if (selectedAnomalyRow) {
      const titik = titikUntukBaris(selectedAnomalyRow);
      if (titik) {
        const anomalyMarker = L.circleMarker([titik.lat, titik.lng], {
          pane: 'markersPane',
          renderer: canvasRenderer,
          radius: 3,
          fillColor: '#f06548',
          color: '#ffffff',
          weight: 3,
          fillOpacity: 0.95,
        });
        anomalyMarker.bindTooltip(
          `<strong style="color:#c2410c;">⚠️ Anomali Final · ${selectedAnomalyRow.namaOutlet || '-'}</strong><br/>${selectedAnomalyRow.kotaPtenMax15 || selectedAnomalyRow.kotaPten || '-'}<br/>KP ${selectedAnomalyRow.kodePosPten || '-'}`,
          { direction: 'top', className: 'bni-map-fast-tooltip' }
        );
        markersLayer.addLayer(anomalyMarker);
        // Titik anomali membesar saat muncul, bukan langsung penuh. Canvas tidak
        // mengambil animasi CSS, jadi radiusnya dijalankan per frame (~130 ms).
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          let frame = 0;
          const membesar = () => {
            frame += 1;
            anomalyMarker.setRadius(3 + 8 * Math.min(1, frame / 8));
            if (frame < 8) requestAnimationFrame(membesar);
          };
          requestAnimationFrame(membesar);
        }
      }
    }
    }, [filteredPins, selectedPin, showAllMatchMarkers, resolvedCoords, selectedAnomalyRow, titikUntukBaris, jembatanFinal, mapInteractionTick]);

  // Canvas hit-testing can miss a marker while thousands of points are being redrawn.
  // A pixel-distance fallback keeps the map clickable even when a marker event is missed.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      if (mapInteractionRef.current || filteredPins.length === 0) return;

      const clickPoint = map.latLngToContainerPoint(event.latlng);
      let nearestPin: PlottedBranchPin | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      filteredPins.forEach((pin) => {
        const markerPoint = map.latLngToContainerPoint([pin.lat, pin.lng]);
        const distance = clickPoint.distanceTo(markerPoint);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPin = pin;
        }
      });

      if (nearestPin && nearestDistance <= 28) {
        setTrackingMode('none');
        setSelectedAnomalyRow(null);
        setSelectedPin(nearestPin);
        setActiveBranchIndex(0);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [filteredPins]);

  // Camera movement is intentionally separate from marker redraws. Geocoding can update
  // coordinates many times, but it must not interrupt the user's current zoom or click.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || filteredPins.length === 0) return;

    const cameraKey = displayScope === 'ISOLASI' && selectedPin
      ? `selected:${selectedPin.id}`
      : selectedWilayah !== 'ALL'
      ? `wilayah:${selectedWilayah}`
      : '';
    if (!cameraKey) {
      lastAutoFitKeyRef.current = '';
      return;
    }
    if (lastAutoFitKeyRef.current === cameraKey) return;

    // Kamera terkunci: kunci tetap dicatat supaya saat dibuka tidak melompat mendadak.
    if (cameraLocked) {
      lastAutoFitKeyRef.current = cameraKey;
      return;
    }

    lastAutoFitKeyRef.current = cameraKey;
    if (displayScope === 'ISOLASI' && selectedPin) {
      map.flyTo([selectedPin.lat, selectedPin.lng], 14, { duration: 0.55 });
    } else if (selectedWilayah !== 'ALL') {
      const bounds = L.latLngBounds(filteredPins.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12, animate: true, duration: 0.55 });
    }
  }, [displayScope, selectedPin, selectedWilayah, filteredPins, cameraLocked]);

  useEffect(() => {
    if (!selectedPin) return;
    const invalidate = () => mapInstanceRef.current?.invalidateSize({ animate: false });
    const firstFrame = requestAnimationFrame(() => {
      invalidate();
      requestAnimationFrame(invalidate);
    });
    const settled = window.setTimeout(invalidate, 260);
    return () => {
      cancelAnimationFrame(firstFrame);
      window.clearTimeout(settled);
    };
  }, [selectedPin]);

  // 9. Render arcs from real administrative origin points → selected branch (no unbounded fan-out)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const arcsLayer = arcsLayerRef.current;
    if (!map || !arcsLayer) return;

    arcsLayer.clearLayers();

    const auditRows = selectedMatchedRows;
    if (!selectedPin || !showCurvedArcs || auditRows.length === 0) {
      return;
    }

    const destCoords: [number, number] = clampToIndonesia(selectedPin.lat, selectedPin.lng);
    const isIsolated = displayScope === 'ISOLASI' || trackingMode === 'aceh_kim';
    const originGroups = groupTargetOriginsForMap(auditRows, resolvedCoords);
    // Semua titik asal data matched ikut digambar. Yang bukan hasil geocode nyata
    // (pusat wilayah / default) tetap tampil tapi ditandai "perkiraan" agar jujur.
    const APPROX_SOURCES = new Set(['wilayah_centroid', 'default']);
    const visibleGroups = isIsolated ? originGroups : originGroups.slice(0, 24);
    const allArcEndpoints: [number, number][] = [destCoords];

    visibleGroups.forEach((group, gIdx) => {
      const startCoords: [number, number] = clampToIndonesia(group.lat, group.lng);
      const dLat = startCoords[0] - destCoords[0];
      const dLng = startCoords[1] - destCoords[1];
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      const isOnSite = dist < 0.001;
      const count = group.rows.length;
      const firstRow = group.rows[0];
      const isAnomalyGroup = false;
      const isApprox = APPROX_SOURCES.has(group.source);

      if (!isOnSite) {
        const curveDirection = gIdx % 2 === 0 ? 0.1 : -0.08;
        const arcPoints = createCurvedArcPoints(startCoords, destCoords, curveDirection, 22);
        if (arcPoints.length > 0) {
          const curvedPolyline = L.polyline(arcPoints, {
            pane: 'arcsPane',
            renderer: svgRendererRef.current || undefined,
            color: isAnomalyGroup ? '#f06548' : isApprox ? '#adb5bd' : '#0ab39c',
            weight: Math.min(2 + Math.log10(count + 1), 4),
            opacity: isApprox ? 0.55 : 0.82,
            interactive: false, // Prevents curved lines from blocking clicks on markers
            className: isApprox ? 'bni-flow-arc bni-flow-arc--approx' : 'bni-flow-arc',
          });
          curvedPolyline.bindTooltip(
            `<div style="font-size:11px;font-weight:600;color:${isApprox ? '#495057' : '#0f766e'};">
              ${count.toLocaleString('id-ID')} data dari ${group.label}<br/>
              <span style="font-size:10px;color:${isAnomalyGroup ? '#f06548' : '#878a99'};">${isAnomalyGroup ? '⚠️ Audit anomali →' : '➔'} ${selectedPin.primaryOutletName}${isApprox ? ' · <em>titik asal perkiraan (pusat wilayah)</em>' : ''}</span>
            </div>`,
            { sticky: true }
          );
          arcsLayer.addLayer(curvedPolyline);
        }
        allArcEndpoints.push(startCoords);
      }

      const originDot = L.circleMarker(isOnSite ? destCoords : startCoords, {
        pane: 'arcsPane',
        radius: isOnSite ? 4 : Math.min(5 + Math.log10(count + 1) * 2, 9),
        fillColor: isOnSite ? '#a78bfa' : isApprox ? '#adb5bd' : '#38bdf8',
        color: '#ffffff',
        weight: 1.8,
        fillOpacity: 0.95,
      });
      originDot.on('mouseover', () => {
        if (mapContainerRef.current) {
          mapContainerRef.current.style.cursor = 'pointer';
        }
      });
      originDot.on('mouseout', () => {
        if (mapContainerRef.current) {
          mapContainerRef.current.style.cursor = 'default';
        }
      });
      originDot.bindTooltip(
        `<div style="font-size:11px;padding:2px 4px;max-width:280px;">
          <strong style="color:#299cdb;">📍 ${group.label}</strong>
          <div style="color:#495057;margin-top:2px;">${count.toLocaleString('id-ID')} data dari Excel upload</div>
          <div style="color:#878a99;font-size:10px;">Sumber koordinat: ${group.source}</div>
          <div style="color:#878a99;font-size:10px;margin-top:3px;">📮 ${firstRow['KODE POS'] || '-'} · ${firstRow.Kecamatan || ''}</div>
          <div style="color:#495057;font-size:10px;margin-top:3px;max-height:96px;overflow:auto;">
            ${group.rows.slice(0, 12).map((row) => `No. ${row.No || '-'} · ${row['Nama Outlet'] || '-'} · ${row.ALAMAT || '-'} · KP ${row['KODE POS'] || '-'}`).join('<br/>')}
            ${group.rows.length > 12 ? `<br/>+${group.rows.length - 12} record lainnya` : ''}
          </div>
        </div>`,
        { direction: 'top' }
      );
      arcsLayer.addLayer(originDot);
    });

    if (!cameraLocked && isIsolated && allArcEndpoints.length > 0) {
      if (allArcEndpoints.length > 1) {
        const arcBounds = L.latLngBounds(allArcEndpoints);
        map.fitBounds(arcBounds, { padding: [60, 60], maxZoom: 13 });
      } else {
        map.flyTo(destCoords, 14, { duration: 0.8 });
      }
    }
  }, [selectedPin, showCurvedArcs, selectedMatchedRows, displayScope, trackingMode, resolvedCoords, cameraLocked]);

  // 9b. Titik terpilih → garis lengkung ke pasangan kode posnya, dua arah:
  //     - titik lapisan Kodepos diklik → garis ke titik KC/KCP tempat outletnya berada;
  //     - pin KC/KCP diklik → garis ke titik kode pos PTEN yang terpasang padanya.
  //     Pasangannya datang dari Data Final: satu baris menyimpan kode pos PTEN DAN kode
  //     pos kelurahan outlet, dan keduanya punya koordinat nyata di Data Kode Pos.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const arcsLayer = arcsLayerRef.current;
    if (!map || !arcsLayer) return;
    const pin = selectedPin;
    if (!pin || !showCurvedArcs) return;

    const daftar = jembatanFinal.koneksi.get(kodePosLima(pin.kodePos)) || [];
    if (daftar.length === 0) return;

    // Ujung jauhnya beda arah: dari titik kelurahan melihat kantor outlet, dari pin
    // kantor melihat kelurahan yang ia pegang.
    const namaTujuan = pin.isTitikKodePos ? 'Kantor outlet' : 'Kelurahan yang dilayani';
    const labelTujuan = (k: KoneksiTitik) => (pin.isTitikKodePos ? k.outlet : k.kel);
    const dari = clampToIndonesia(pin.lat, pin.lng);
    const BATAS_GARIS = 30;
    const titik: [number, number][] = [dari];
    daftar.slice(0, BATAS_GARIS).forEach((k, i) => {
      const ke = clampToIndonesia(k.lat, k.lng);
      const km = calculateDistanceKm(dari[0], dari[1], ke[0], ke[1]);
      const garis = L.polyline(createCurvedArcPoints(dari, ke, i % 2 === 0 ? 0.1 : -0.08, 22), {
        pane: 'arcsPane',
        renderer: svgRendererRef.current || undefined,
        color: WARNA_GARIS,
        weight: Math.min(2 + Math.log10(k.baris + 1), 4),
        opacity: 0.82,
        interactive: false,
        className: 'bni-flow-arc',
      });
      garis.bindTooltip(
        `<div style="font-size:11px;font-weight:600;color:#1b6fa8;">
          KP ${pin.kodePos} ➔ KP ${k.kode} · ${km.toLocaleString('id-ID', { maximumFractionDigits: 1 })} km<br/>
          <span style="font-size:10px;color:#878a99;">${k.baris.toLocaleString('id-ID')} baris Data Final · ${labelTujuan(k)}</span>
        </div>`,
        { sticky: true }
      );
      arcsLayer.addLayer(garis);

      const ujung = L.circleMarker(ke, {
        pane: 'arcsPane',
        radius: Math.min(5 + Math.log10(k.baris + 1) * 2, 10),
        fillColor: WARNA_PIN_TERPILIH,
        color: '#ffffff',
        weight: 1.8,
        fillOpacity: 0.95,
      });
      ujung.bindTooltip(
        `<strong style="color:#299cdb;">${namaTujuan} · KP ${k.kode}</strong><br/>` +
        `${k.baris.toLocaleString('id-ID')} baris · ${labelTujuan(k)}<br/>` +
        `<span style="color:#878a99;font-size:10px;">${km.toLocaleString('id-ID', { maximumFractionDigits: 1 })} km dari KP ${pin.kodePos}</span>`,
        { direction: 'top', className: 'bni-map-fast-tooltip' }
      );
      arcsLayer.addLayer(ujung);
      titik.push(ke);
    });

    if (!cameraLocked && titik.length > 1) {
      map.fitBounds(L.latLngBounds(titik), { padding: [60, 60], maxZoom: 13, animate: true, duration: 0.6 });
    }
  }, [selectedPin, showCurvedArcs, jembatanFinal, cameraLocked]);


  // Handle Quick Island Navigation
  const handleJumpRegion = (regionKey: keyof typeof INDONESIA_REGIONS) => {
    setActiveRegion(regionKey);
    const map = mapInstanceRef.current;
    if (!map) return;
    if (regionKey === 'ALL') {
      map.fitBounds(indonesiaBounds, { padding: [15, 15] });
    } else {
      const reg = INDONESIA_REGIONS[regionKey];
      map.flyTo(reg.center, reg.zoom, { duration: 0.9 });
    }
  };

  const findKimPin = (pins: PlottedBranchPin[]): PlottedBranchPin | undefined => {
    const scorePin = (p: PlottedBranchPin): number => {
      const text = [
        p.primaryOutletName,
        ...p.branches.map((b) => `${b['Nama Outlet'] || ''} ${b.Cabang || ''} ${b['Sandi Cabang'] || ''} ${b['Branch Code'] || ''}`),
      ]
        .join(' ')
        .toUpperCase();
      if (/\bKIM\b/.test(text) || text.includes(' KIM')) return 3;
      if (text.includes('KIM')) return 2;
      return 0;
    };
    return [...pins]
      .map((p) => ({ p, score: scorePin(p) }))
      .filter((x) => x.score >= 2)
      .sort((a, b) => b.score - a.score)[0]?.p;
  };

  const startAcehKimTracking = () => {
    const kimPin = findKimPin(allPins);
    if (!kimPin) {
      notify('Cabang KIM tidak ditemukan di master data cabang.', 'error');
      return;
    }
    setTrackingMode('aceh_kim');
    masukIsolasi();
    setShowCurvedArcs(true);
    setSelectedPin(kimPin);
    setActiveBranchIndex(0);
    setSearchQuery(kimPin.primaryOutletName);
    setShowSuggestions(false);
  };

  // Select a suggestion pin (supports frame fitting for remote links like Aceh -> KIM)
  const handleSelectSuggestion = (item: SearchSuggestionItem | PlottedBranchPin) => {
    const pin = 'pin' in item ? item.pin : item;
    const sourceCoords = 'sourceCoords' in item ? item.sourceCoords : undefined;

    setTrackingMode('none');
    // Pin harus ada di lapisan yang sedang tampil, kalau tidak ia tidak ikut digambar.
    if (pin.isTitikKodePos) setDisplayScope('KODEPOS');
    else if (displayScope === 'KODEPOS' || displayScope === 'MULTI' || displayScope === 'ISOLASI') {
      setDisplayScope(pin.unitKat || 'KC');
    }
    setSelectedPin(pin);
    setActiveBranchIndex(0);
    setShowSuggestions(false);
    setSearchQuery(pin.primaryOutletName);
    setShowCurvedArcs(true);

    if (mapInstanceRef.current) {
      if (sourceCoords) {
        const bounds = L.latLngBounds([sourceCoords, [pin.lat, pin.lng]]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
      } else {
        mapInstanceRef.current.flyTo([pin.lat, pin.lng], 14, { duration: 0.9 });
      }
    }
  };

  // Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (searchSuggestions.length > 0) {
      handleSelectSuggestion(searchSuggestions[0]);
    } else {
      const q = searchQuery.toLowerCase().trim();
      const found = allPins.find(
        (p) =>
          p.kodePos.includes(q) ||
          p.dati2.toLowerCase().includes(q) ||
          p.primaryOutletName.toLowerCase().includes(q)
      );
      if (found && mapInstanceRef.current) {
        handleSelectSuggestion(found);
      } else {
        notify(`Pencarian "${searchQuery.trim()}" tidak ketemu di ${allPins.length.toLocaleString('id-ID')} titik cabang yang ada di peta.`, 'warning');
      }
    }
  };

  const currentBranch = selectedPin
    ? selectedPin.branches[activeBranchIndex] || selectedPin.branches[0]
    : null;

  const currentGmapsUrl = currentBranch
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `BNI ${currentBranch['Nama Outlet']} ${currentBranch.ALAMAT || ''} ${selectedPin?.kodePos || ''}`
      )}`
    : '#';

  return (
    <div
      className="glass-card"
      style={{
        marginTop: '1.25rem',
        padding: '1.15rem 1.25rem',
        background: '#ffffff',
        border: '1px solid #e9ebec',
        borderRadius: '6px',
        boxShadow: '0 2px 4px rgba(56, 65, 74, 0.05)',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '0.85rem',
          borderBottom: '1px solid #eef1f4',
          paddingBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, rgba(64, 81, 137, 0.12) 0%, rgba(10, 179, 156, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#405189',
              flexShrink: 0,
            }}
          >
            <Compass size={20} color="#405189" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#212529', margin: 0 }}>
                Peta Tracking Penyebaran Cabang BNI di Indonesia
              </h4>
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  background: 'rgba(10, 179, 156, 0.12)',
                  color: '#0ab39c',
                  padding: '0.12rem 0.45rem',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <CheckCircle size={10} />
                TERKOLABORASI DATA MATCHED
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#878a99', margin: '0.15rem 0 0 0' }}>
              Monitoring geospasial sebaran kantor cabang BNI dan korelasi data matched transaksi
            </p>
          </div>
        </div>

        {/* Real-Time Stats Counters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '0.3rem 0.6rem',
              background: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #e9ebec',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Building2 size={13} color="#405189" />
            <span style={{ fontSize: '0.73rem', color: '#6c757d' }}>Total Cabang:</span>
            <strong style={{ fontSize: '0.78rem', color: '#405189' }}>
              {stats.totalBranches.toLocaleString('id-ID')}
            </strong>
          </div>

          <div
            style={{
              padding: '0.3rem 0.6rem',
              background: 'rgba(10, 179, 156, 0.08)',
              borderRadius: '4px',
              border: '1px solid rgba(10, 179, 156, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <CheckCircle size={13} color="#0ab39c" />
            <span style={{ fontSize: '0.73rem', color: '#0ab39c' }}>Cabang Matched:</span>
            <strong style={{ fontSize: '0.78rem', color: '#0ab39c' }}>
              {stats.pinsWithMatchCount.toLocaleString('id-ID')} Titik ({stats.totalMatchedRecords.toLocaleString('id-ID')} Record)
            </strong>
          </div>

          <div
            style={{
              padding: '0.3rem 0.6rem',
              background: 'rgba(240, 101, 72, 0.08)',
              borderRadius: '4px',
              border: '1px solid rgba(240, 101, 72, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Layers size={13} color="#f06548" />
            <span style={{ fontSize: '0.73rem', color: '#878a99' }}>Multi-Outlet:</span>
            <strong style={{ fontSize: '0.78rem', color: '#f06548' }}>
              {stats.multiOutletPins.toLocaleString('id-ID')}
            </strong>
          </div>
        </div>
      </div>

      {/* Unified Single-Row Control Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.65rem',
          padding: '0.4rem 0.6rem',
          background: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #eef1f4',
          flexWrap: 'wrap',
        }}
      >
        {/* 1. Island / Region Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Compass size={13} color="#878a99" />
          <select
            value={activeRegion}
            onChange={(e) => handleJumpRegion(e.target.value as keyof typeof INDONESIA_REGIONS)}
            style={{
              fontSize: '0.73rem',
              fontWeight: 600,
              padding: '0.25rem 0.5rem',
              borderRadius: '5px',
              border: '1px solid #ced4da',
              background: '#ffffff',
              color: '#405189',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '140px',
            }}
          >
            {(Object.keys(INDONESIA_REGIONS) as Array<keyof typeof INDONESIA_REGIONS>).map((key) => (
              <option key={key} value={key}>{INDONESIA_REGIONS[key].name}</option>
            ))}
          </select>
        </div>

        <div style={{ width: '1px', height: '20px', background: '#dee2e6', flexShrink: 0 }} />

        {/* 2. Tile / Map Style Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Globe size={13} color="#878a99" />
          <select
            value={tileProvider}
            onChange={(e) => handleSwitchTile(e.target.value as TileProvider)}
            style={{
              fontSize: '0.73rem',
              fontWeight: 600,
              padding: '0.25rem 0.5rem',
              borderRadius: '5px',
              border: '1px solid #ced4da',
              background: '#ffffff',
              color: '#212529',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '130px',
            }}
          >
            <option value="google">🗺️ Google Maps</option>
            <option value="google_hybrid">🛰️ Satelit</option>
            <option value="esri">🌐 Esri Street</option>
            <option value="osm">📍 OpenStreetMap</option>
          </select>
        </div>

        <div style={{ width: '1px', height: '20px', background: '#dee2e6', flexShrink: 0 }} />

        {/* Dropdown Filter Wilayah pada Peta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <MapPin size={13} color="#405189" />
          <select
            value={mapSelectedWilayah}
            onChange={(e) => {
              setMapSelectedWilayah(e.target.value);
              setSelectedPin(null);
            }}
            id="map-filter-select-wilayah"
            style={{
              fontSize: '0.73rem',
              fontWeight: 600,
              padding: '0.25rem 0.5rem',
              borderRadius: '5px',
              border: '1px solid #ced4da',
              background: '#ffffff',
              color: '#212529',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '160px',
            }}
            title="Filter cabang pada peta berdasarkan Wilayah"
          >
            <option value="ALL">Semua Wilayah ({masterRows.length} Cabang)</option>
            {mapWilayahList.map((w) => {
              const count = mapWilayahPinCounts.get(w) || 0;
              return (
                <option key={w} value={w}>
                  {formatWilayahName(w)} ({count} Cabang)
                </option>
              );
            })}
          </select>
        </div>

        <div style={{ width: '1px', height: '20px', background: '#dee2e6', flexShrink: 0 }} />

        {/* 3. Display Filter — Custom Dropdown with Colored Bullets */}
        <div style={{ position: 'relative' }}>
          {/* Trigger Button */}
          <button
            type="button"
            onClick={() => setShowFilterDropdown((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.73rem',
              fontWeight: 600,
              padding: '0.25rem 0.6rem 0.25rem 0.45rem',
              borderRadius: '5px',
              border: '1px solid #ced4da',
              background: '#ffffff',
              color: '#212529',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minWidth: '170px',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Filter size={12} color="#878a99" />
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: WARNA_PIN, display: 'inline-block', flexShrink: 0 }} />
              <span>{aktifLayer ? aktifLayer.teks : 'Titik Terpilih'}</span>
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: showFilterDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="#878a99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Custom Dropdown Panel */}
          {showFilterDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                background: '#ffffff',
                border: '1px solid #e9ebec',
                borderRadius: '6px',
                boxShadow: '0 5px 10px rgba(30, 32, 37, 0.12)',
                zIndex: 2000,
                minWidth: '230px',
                overflow: 'hidden',
              }}
            >
              {/* Section label */}
              <div style={{ padding: '0.4rem 0.75rem 0.2rem', fontSize: '0.63rem', fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Filter Tampilan Peta
              </div>

              {/* Empat lapisan data — satu sumber angka dengan label tombol */}
              {opsiLayer.map((opt) => {
                const isActive = displayScope === opt.value;
                const dot = WARNA_PIN;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setTrackingMode('none');
                      setSelectedPin(null);
                      setDisplayScope(opt.value);
                      setShowFilterDropdown(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: isActive ? `${dot}14` : 'transparent',
                      border: 'none',
                      borderLeft: isActive ? `3px solid ${dot}` : '3px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f9fbfd'; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Colored bullet */}
                    <span style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: dot,
                      display: 'inline-block',
                      flexShrink: 0,
                      boxShadow: isActive ? `0 0 0 3px ${dot}30` : 'none',
                    }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isActive ? dot : '#212529' }}>
                          {opt.label}
                        </span>
                        <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: isActive ? dot : '#f8f9fa',
                            color: isActive ? '#fff' : '#878a99',
                            padding: '0.05rem 0.4rem',
                            borderRadius: '6px',
                            minWidth: '28px',
                            textAlign: 'center',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {opt.n.toLocaleString('id-ID')}
                          </span>
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#adb5bd', display: 'block', marginTop: '1px' }}>{opt.desc}</span>
                    </span>
                  </button>
                );
              })}

              <div style={{ height: '0.35rem' }} />
            </div>
          )}

          {/* Click-away handler */}
          {showFilterDropdown && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 1999 }}
              onClick={() => setShowFilterDropdown(false)}
            />
          )}
        </div>

        <div style={{ width: '1px', height: '20px', background: '#dee2e6', flexShrink: 0 }} />

        {/* 4. Curved Arcs Toggle */}
        <button
          type="button"
          onClick={() => setShowCurvedArcs(!showCurvedArcs)}
          title="Toggle garis lengkung data matched"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.73rem',
            fontWeight: 600,
            padding: '0.25rem 0.55rem',
            borderRadius: '5px',
            border: showCurvedArcs ? '1px solid #0ab39c' : '1px solid #ced4da',
            background: showCurvedArcs ? 'rgba(10,179,156,0.1)' : '#ffffff',
            color: showCurvedArcs ? '#0ab39c' : '#6c757d',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Share2 size={12} />
          <span>Garis Match</span>
        </button>

        {/* 5. Aceh Tracking (conditional) */}
        {acehTargetMatches.length > 0 && (
          <button
            type="button"
            onClick={startAcehKimTracking}
            title={`Lacak ${acehTargetMatches.length} data Aceh ke cabang KIM`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.73rem',
              fontWeight: 700,
              padding: '0.25rem 0.55rem',
              borderRadius: '5px',
              border: trackingMode === 'aceh_kim' ? '1px solid #0e7490' : '1px solid #0891b2',
              background: trackingMode === 'aceh_kim' ? '#0e7490' : '#ecfeff',
              color: trackingMode === 'aceh_kim' ? '#ffffff' : '#0e7490',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span>🕌</span><span>Aceh→KIM ({acehTargetMatches.length})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowAnomalyPanel((visible) => !visible)}
          title="Periksa data upload yang berada di pulau berbeda dari Master"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.73rem',
            fontWeight: 700,
            padding: '0.25rem 0.55rem',
            borderRadius: '5px',
            border: anomalyRows.length > 0 ? '1px solid #f06548' : '1px solid #ced4da',
            background: showAnomalyPanel ? '#f06548' : (anomalyRows.length > 0 ? 'rgba(240,101,72,0.1)' : '#ffffff'),
            color: showAnomalyPanel ? '#ffffff' : (anomalyRows.length > 0 ? '#c2410c' : '#6c757d'),
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <span>⚠️</span><span>Anomali Wilayah ({anomalyRows.length})</span>
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* 6. Search Bar */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <Search size={13} className="search-icon-pos" />
              <input
                type="text"
                className="search-input"
                style={{ fontSize: '0.73rem', padding: '0.26rem 0.6rem 0.26rem 1.85rem', width: '100%' }}
                placeholder="Cari kota, outlet, kode pos..."
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.26rem 0.65rem', fontSize: '0.73rem', whiteSpace: 'nowrap', borderRadius: '5px' }}
            >
              Lacak
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: '#ffffff',
                border: '1px solid #e9ebec',
                borderRadius: '6px',
                boxShadow: '0 5px 10px rgba(30, 32, 37, 0.12)',
                zIndex: 1050,
                maxHeight: '220px',
                overflowY: 'auto',
              }}
            >
              {searchSuggestions.map((sug, sIdx) => {
                const p = sug.pin;
                return (
                  <div
                    key={`${p.id}_${sIdx}`}
                    onClick={() => handleSelectSuggestion(sug)}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderBottom: '1px solid #f3f3f9',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f9fa')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                  >
                    <div>
                      <strong style={{ color: '#212529', display: 'block' }}>{p.primaryOutletName}</strong>
                      <span style={{ color: '#878a99', fontSize: '0.7rem' }}>
                        {p.dati2} &bull; 📮 {p.kodePos}
                      </span>
                      {sug.serviceNote && (
                        <div style={{ color: '#0891b2', fontSize: '0.68rem', fontWeight: 600, marginTop: '2px' }}>
                          ✦ {sug.serviceNote}
                        </div>
                      )}
                    </div>
                    {p.matchedCount > 0 && (
                      <span
                        style={{
                          background: 'rgba(10, 179, 156, 0.1)',
                          color: '#0ab39c',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                        }}
                      >
                        ✓ {p.matchedCount} Cocok
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAnomalyPanel && (
        <div className="bni-pop" style={{ marginBottom: '0.65rem', padding: '0.75rem 0.95rem', border: '1px solid rgba(240,101,72,0.35)', borderRadius: '6px', background: '#fff8f6', color: '#7c2d12', fontSize: '0.74rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.82rem', color: '#991b1b' }}>⚠️ Anomali Data Final</strong>
              <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#fdeae5', color: '#991b1b', fontWeight: 700 }}>
                {anomalyRows.length} baris
              </span>
            </div>
            {/* Filter kategori anomali */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: `Semua (${anomalyRows.length})` },
                { id: 'PULAU', label: `Beda Pulau (${anomalyRows.filter((r) => r.anomalyType === 'PULAU').length})` },
                { id: 'PROVINSI', label: `Beda Provinsi (${anomalyRows.filter((r) => r.anomalyType === 'PROVINSI').length})` },
                { id: 'STATUS', label: `Status (${anomalyRows.filter((r) => r.anomalyType === 'STATUS').length})` },
                { id: 'PENEMPATAN', label: `Penempatan (${anomalyRows.filter((r) => r.anomalyType === 'PENEMPATAN').length})` },
                { id: 'ROLE', label: `Role (${anomalyRows.filter((r) => r.anomalyType === 'ROLE').length})` },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setAnomalyTypeFilter(btn.id as 'ALL' | AnomalyType)}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: anomalyTypeFilter === btn.id ? 700 : 500,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    border: anomalyTypeFilter === btn.id ? '1px solid #c2410c' : '1px solid #fed7aa',
                    background: anomalyTypeFilter === btn.id ? '#ea580c' : '#ffffff',
                    color: anomalyTypeFilter === btn.id ? '#ffffff' : '#9a3412',
                    cursor: 'pointer',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAnomalyPanel(false)}
              aria-label="Tutup panel anomali"
              title="Tutup (Esc)"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9a3412', padding: '0.15rem', display: 'flex', flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          </div>

          {filteredAnomalyRows.length === 0 ? (
            <div style={{ padding: '0.75rem', textAlign: 'center', background: '#ffffff', borderRadius: '6px', border: '1px dashed #fed7aa', color: '#9a3412' }}>
              {anomalyRows.length === 0
                ? (finalRows.length === 0 ? 'Belum ada Final Data. Setujui analisa di menu Data Analyst terlebih dahulu.' : 'Tidak ada anomali pada Final Data — semua penempatan, status & role bersih.')
                : 'Tidak ada anomali pada filter ini.'}
            </div>
          ) : (
            <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gap: '0.35rem' }}>
              {filteredAnomalyRows.slice(0, 80).map(({ row, anomalyBadge, reasons, hasCoord }) => (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setTrackingMode('none');
                    // Bawa ke lapisan kode pos dan pilih titik baris ini: garis lengkung
                    // ke pasangan KC/KCP-nya ikut muncul, jadi anomali punya konteks ruang.
                    const t = titikUntukBaris(row);
                    const pin = t ? kodePosPins.find((p) => p.kodePos === t.kode) || null : null;
                    setDisplayScope('KODEPOS');
                    setSelectedAnomalyRow(row);
                    setSelectedPin(pin);
                  }}
                  style={{ padding: '0.4rem 0.6rem', background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
                >
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        background: anomalyBadge.bg,
                        color: anomalyBadge.color,
                        border: `1px solid ${anomalyBadge.border}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {anomalyBadge.text}
                    </span>
                    <span>
                      <strong style={{ color: '#405189' }}>{row.namaOutlet || '-'}</strong> · <span style={{ color: '#f06548', fontWeight: 600 }}>{row.kotaPtenMax15 || row.kotaPten || '-'} ({row.provinsi || '-'})</span> · 📮 {row.kodePosPten || '-'}
                    </span>
                    <span style={{ width: '100%', fontSize: '0.68rem', color: '#9a3412' }}>{reasons.join(' · ')}</span>
                    {!hasCoord && (
                      <span style={{ fontSize: '0.66rem', color: '#878a99', background: '#f8f9fa', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>tanpa titik kodepos</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#c2410c', flexShrink: 0 }}>Lihat di peta →</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Main Map Container & Interactive Side Panel */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedPin ? '1fr 340px' : '1fr',
          gap: '0.85rem',
        }}
      >
        {/* Leaflet Hardware Canvas Map */}
        <div
          className="bni-map-container"
          role="region"
          aria-label={`Peta sebaran cabang dan outlet — ${hitunganLayer.kc} KC, ${hitunganLayer.kcp} KCP, ${hitunganLayer.kodePos} titik kode pos, ${filteredPins.length} tampil`}
          tabIndex={0}
          style={{ position: 'relative' }}
        >
          <div ref={mapContainerRef} style={{ width: '100%', height: '580px', borderRadius: '6px', cursor: 'default' }} />

          {/* Legenda bentuk penanda (bentuk = jenis, warna = status) + pengunci kamera */}
          <div
            className="bni-pop"
            style={{
              position: 'absolute',
              left: '12px',
              bottom: '12px',
              zIndex: 900,
              pointerEvents: 'none',
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid #e9ebec',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(33,37,41,0.12)',
              padding: '0.5rem 0.65rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              fontSize: '0.68rem',
              color: '#495057',
              maxWidth: '240px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontWeight: 700, color: '#405189', marginBottom: '0.05rem' }}>Jenis Titik</span>
              <span><span style={{ marginRight: 4 }}>🏦</span>KC (Cabang Utama)</span>
              <span><span style={{ marginRight: 4 }}>🏬</span>KCP (Outlet / Sub Branch)</span>
              <span><span style={{ marginRight: 4 }}>🏢</span>Multi-Outlet (banyak cabang 1 titik)</span>
              <span><span style={{ marginRight: 4 }}>📮</span>Kode Pos (titik dari Data Kode Pos)</span>
            </div>
            <div style={{ height: 1, background: '#e9ebec' }} />
            {finalBelumTerpetakan.length > 0 ? (
              <span style={{ color: '#c2410c', fontWeight: 600, lineHeight: 1.35 }}>
                {finalBelumTerpetakan.length.toLocaleString('id-ID')} baris Data Final belum terpetakan — tidak ketemu di Data Kode Pos lewat kode pos MAUPUN kelurahan+kecamatan+kota
              </span>
            ) : (
              <span style={{ color: '#0ab39c', fontWeight: 600 }}>
                Seluruh baris Data Final terpetakan
              </span>
            )}
            <div style={{ height: 1, background: '#e9ebec' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontWeight: 700, color: '#405189', marginBottom: '0.05rem' }}>Status Titik</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0ab39c', display: 'inline-block', border: '1.5px solid #fff', flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>Cabang Matched</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6559cc', display: 'inline-block', border: '1.5px solid #fff', flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>Cabang Master</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#f06548', display: 'inline-block', border: '2px solid #fff', flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>Multi-Cabang (&gt;1)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '14px', height: '3px', background: '#0ab39c', display: 'inline-block', borderRadius: '2px', flexShrink: 0 }} />
                <span style={{ color: '#0ab39c', fontWeight: 600 }}>Garis Lengkung Match</span>
              </div>
            </div>
            <div style={{ height: 1, background: '#e9ebec' }} />
            <button
              type="button"
              onClick={() => setCameraLocked((v) => !v)}
              title={
                cameraLocked
                  ? 'Kamera terkunci: peta tidak otomatis bergeser/memperbesar saat memilih titik, wilayah, atau garis. Klik untuk membuka.'
                  : 'Klik untuk mengunci posisi & zoom peta agar tidak melompat saat memilih titik.'
              }
              style={{
                pointerEvents: 'auto',
                cursor: 'pointer',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.3rem 0.5rem',
                borderRadius: '6px',
                border: cameraLocked ? '1px solid #0ab39c' : '1px solid #ced4da',
                background: cameraLocked ? 'rgba(10,179,156,0.12)' : '#ffffff',
                color: cameraLocked ? '#0ab39c' : '#6c757d',
                textAlign: 'left',
              }}
            >
              {cameraLocked ? '🔒 Kamera terkunci' : '🔓 Kamera bebas'}
            </button>
          </div>

          {selectedPin && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                maxWidth: 'min(320px, calc(100% - 24px))',
                padding: '0.45rem 0.65rem',
                background: 'rgba(255, 255, 255, 0.96)',
                border: '1px solid rgba(247,184,75, 0.55)',
                borderRadius: '6px',
                boxShadow: '0 3px 12px rgba(33,37,41, 0.16)',
                color: '#92400e',
                fontSize: '0.7rem',
                fontWeight: 700,
                pointerEvents: 'none',
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f7b84b', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Dipilih: {selectedPin.primaryOutletName} · {selectedPin.kodePos}
              </span>
            </div>
          )}

          {trackingMode === 'aceh_kim' && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                right: '12px',
                zIndex: 1000,
                background: 'rgba(236, 254, 255, 0.96)',
                border: '1px solid #67e8f9',
                borderRadius: '6px',
                padding: '0.45rem 0.7rem',
                fontSize: '0.72rem',
                color: '#0e7490',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(8,145,178,0.12)',
              }}
            >
              Mode lacak Aceh: {selectedMatchedRows.length.toLocaleString('id-ID')} data Aceh
              {' → '}
              {groupTargetOriginsForMap(selectedMatchedRows).length} titik kabupaten/kota
              {' → '}
              Cabang KIM Medan. Titik mengikuti Dati II / kecamatan / kode pos asal, bukan alamat cabang.
            </div>
          )}

        </div>

        {/* Selected Pin Side Drawer / Detail Card with Matched Data Correlation */}
        {selectedPin && currentBranch && (
          <div
            className="bni-pop"
            style={{
              background: '#f8f9fa',
              border: '1px solid #e9ebec',
              borderRadius: '6px',
              padding: '0.95rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div>
              {/* Drawer Top Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: '#405189',
                      color: '#ffffff',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {selectedPin.wilayah || 'BNI'}
                  </span>
                  <span
                    style={{
                      marginLeft: '0.4rem',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: 'rgba(10, 179, 156, 0.15)',
                      color: '#0ab39c',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    📮 {selectedPin.kodePos}
                  </span>
                  {selectedPin.isOnlineVerified && (
                    <span
                      style={{
                        marginLeft: '0.4rem',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: selectedPin.onlineSource === 'google' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(10,179,156, 0.15)',
                        color: selectedPin.onlineSource === 'google' ? '#3577f1' : '#0ab39c',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                      title={selectedPin.alamatDisplay}
                    >
                      <span>{selectedPin.onlineSource === 'google' ? '🗺️ Google Verified' : '🌐 Online Verified'}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPin(null);
                    setTrackingMode('none');
                    if (displayScope === 'ISOLASI') {
                      setDisplayScope(lapisanSebelumIsolasi);
                    }
                    // Reset cursor
                    if (mapContainerRef.current) {
                      mapContainerRef.current.style.cursor = 'default';
                    }
                    // Leaflet needs to recalculate container size after grid layout changes
                    setTimeout(() => {
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.invalidateSize({ animate: false });
                      }
                    }, 250);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#878a99',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0.1rem 0.3rem',
                  }}
                  title="Tutup Panel"
                >
                  ✕
                </button>
              </div>

              {/* Daftar pasangan kode pos dari Data Final — dua arah: titik kodepos <-> KC/KCP */}
              {(() => {
                const daftar = jembatanFinal.koneksi.get(kodePosLima(selectedPin.kodePos)) || [];
                if (daftar.length === 0 && !selectedPin.isTitikKodePos) return null;
                const totalBaris = daftar.reduce((n, k) => n + k.baris, 0);
                const dari: [number, number] = [selectedPin.lat, selectedPin.lng];
                const judul = selectedPin.isTitikKodePos ? 'outlet memegang titik ini' : 'kelurahan dipegang cabang ini';
                const labelUjung = (k: KoneksiTitik) => (selectedPin.isTitikKodePos ? k.outlet : k.kel);
                return (
                  <div
                    style={{
                      background: 'rgba(41, 156, 219, 0.07)',
                      border: '1px solid rgba(41, 156, 219, 0.28)',
                      borderRadius: '6px',
                      padding: '0.55rem 0.75rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2472a8' }}>
                      {daftar.length.toLocaleString('id-ID')} {judul} · {totalBaris.toLocaleString('id-ID')} baris Data Final
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#878a99', marginBottom: daftar.length ? '0.35rem' : 0 }}>
                      {daftar.length
                        ? selectedPin.isTitikKodePos
                          ? 'Garis lengkung menarik dari titik ini ke kantor outlet yang memegangnya.'
                          : 'Garis lengkung menarik dari kantor ini ke kelurahan yang dipegangnya.'
                        : 'Titik ini belum terhubung ke baris Data Final mana pun.'}
                    </div>
                    {daftar.slice(0, 8).map((k) => (
                      <div
                        key={k.kode}
                        style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', fontSize: '0.68rem', color: '#495057', marginTop: '0.15rem' }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', color: '#405189', fontWeight: 700 }}>{k.kode}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelUjung(k)}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#878a99' }}>
                          {k.baris.toLocaleString('id-ID')} baris ·{' '}
                          {calculateDistanceKm(dari[0], dari[1], k.lat, k.lng).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km
                        </span>
                      </div>
                    ))}
                    {daftar.length > 8 && (
                      <div style={{ fontSize: '0.66rem', color: '#878a99', marginTop: '0.2rem' }}>
                        +{(daftar.length - 8).toLocaleString('id-ID')} titik lain
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Matched Data Collaboration Highlight Box (INTERACTIVE CLICKABLE) */}
              {!selectedPin.isTitikKodePos && (
              <div
                onClick={() => {
                  if (selectedMatchedRows.length > 0) {
                    setShowMatchedModal(true);
                  }
                }}
                style={{
                  background: selectedPin.matchedCount > 0 ? 'rgba(10, 179, 156, 0.08)' : '#f8f9fa',
                  border: `1px solid ${selectedPin.matchedCount > 0 ? 'rgba(10, 179, 156, 0.3)' : '#ced4da'}`,
                  borderRadius: '6px',
                  padding: '0.55rem 0.75rem',
                  marginBottom: '0.75rem',
                  cursor: selectedPin.matchedCount > 0 ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  boxShadow: selectedPin.matchedCount > 0 ? '0 1px 3px rgba(10, 179, 156, 0.1)' : 'none',
                }}
                title={selectedPin.matchedCount > 0 ? 'Klik untuk melihat rincian 180 data matched di cabang ini' : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <CheckCircle size={16} color={selectedPin.matchedCount > 0 ? '#0ab39c' : '#878a99'} />
                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: selectedPin.matchedCount > 0 ? '#0ab39c' : '#495057' }}>
                        {trackingMode === 'aceh_kim'
                          ? `ALUR ACEH: ${selectedMatchedRows.length.toLocaleString('id-ID')} DATA → KIM`
                          : selectedPin.matchedCount > 0
                          ? `TERKORELASI: ${selectedPin.matchedCount.toLocaleString('id-ID')} DATA MATCHED`
                          : 'Belum Ada Transaksi Cocok'}
                      </div>
                      <div style={{ fontSize: '0.67rem', color: '#878a99' }}>
                        {trackingMode === 'aceh_kim'
                          ? `${groupTargetOriginsForMap(selectedMatchedRows).length} titik kabupaten/kota Aceh`
                          : selectedPin.matchedCount > 0
                          ? 'Klik untuk melihat daftar data cocok & garis lengkung'
                          : 'Monitoring aktivitas data target pada cabang ini'}
                      </div>
                    </div>
                  </div>
                  {selectedPin.matchedCount > 0 && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: '#0ab39c',
                        color: '#ffffff',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <span>Lihat Data</span>
                      <ChevronRight size={12} />
                    </span>
                  )}
                </div>
              </div>
              )}

              {/* Isolate Selected Pin View Switcher */}
              <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (displayScope === 'ISOLASI') {
                      setTrackingMode('none');
                      setDisplayScope(lapisanSebelumIsolasi);
                    } else {
                      masukIsolasi();
                    }
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    padding: '0.32rem 0.5rem',
                    fontSize: '0.71rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    border: displayScope === 'ISOLASI' ? '1px solid #f7b84b' : '1px solid #ced4da',
                    background: displayScope === 'ISOLASI' ? '#f7b84b' : '#ffffff',
                    color: displayScope === 'ISOLASI' ? '#ffffff' : '#495057',
                    cursor: 'pointer',
                  }}
                >
                  <Radio size={12} />
                  <span>{displayScope === 'ISOLASI' ? 'Sedang Diisolasi' : 'Isolasi Titik Ini Saja'}</span>
                </button>

                {selectedPin.matchedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowMatchedModal(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      padding: '0.32rem 0.55rem',
                      fontSize: '0.71rem',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: '1px solid rgba(10, 179, 156, 0.4)',
                      background: 'rgba(10, 179, 156, 0.1)',
                      color: '#0ab39c',
                      cursor: 'pointer',
                    }}
                  >
                    <FileSpreadsheet size={12} />
                    <span>Rincian</span>
                  </button>
                )}
              </div>

              {/* Multi-Branch Switcher if > 1 branch */}
              {selectedPin.branchCount > 1 && (
                <div
                  style={{
                    background: 'rgba(240, 101, 72, 0.08)',
                    border: '1px solid rgba(240, 101, 72, 0.25)',
                    borderRadius: '6px',
                    padding: '0.45rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f06548', marginBottom: '0.3rem' }}>
                    ⚠️ {selectedPin.branchCount} Cabang di Lokasi/Kode Pos ini:
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {selectedPin.branches.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveBranchIndex(idx)}
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          border: activeBranchIndex === idx ? '1px solid #f06548' : '1px solid #ced4da',
                          background: activeBranchIndex === idx ? '#f06548' : '#ffffff',
                          color: activeBranchIndex === idx ? '#ffffff' : '#495057',
                          cursor: 'pointer',
                        }}
                      >
                        Cabang #{idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Branch Information */}
              <div style={{ marginBottom: '0.85rem' }}>
                <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: '#212529', margin: '0 0 0.35rem 0', lineHeight: 1.3 }}>
                  {currentBranch['Nama Outlet']}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.6rem' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      background: '#eef1f4',
                      color: '#405189',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '3px',
                    }}
                  >
                    Sandi: {currentBranch['Sandi Cabang'] || currentBranch.Sandi || '-'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      background: '#eef1f4',
                      color: '#495057',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '3px',
                    }}
                  >
                    {currentBranch['Status Outlet'] || 'Outlet'}
                  </span>
                </div>

                <div style={{ fontSize: '0.74rem', color: '#495057', lineHeight: 1.4, marginBottom: '0.65rem' }}>
                  <div style={{ color: '#878a99', fontSize: '0.68rem', fontWeight: 600, marginBottom: '0.15rem' }}>
                    ALAMAT RESMI:
                  </div>
                  <div style={{ background: '#ffffff', padding: '0.45rem 0.6rem', borderRadius: '4px', border: '1px solid #e9ebec' }}>
                    {currentBranch.ALAMAT || 'Alamat tidak terdata'}
                  </div>
                </div>

                {/* Location attributes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontSize: '0.71rem' }}>
                  <div>
                    <span style={{ color: '#878a99', display: 'block' }}>Kecamatan:</span>
                    <strong style={{ color: '#212529' }}>{currentBranch.Kecamatan || '-'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#878a99', display: 'block' }}>Kota / Dati II:</span>
                    <strong style={{ color: '#212529' }}>{currentBranch['Dati II'] || selectedPin.dati2}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#878a99', display: 'block' }}>Provinsi:</span>
                    <strong style={{ color: '#212529' }}>{currentBranch.Provinsi || '-'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#878a99', display: 'block' }}>Telepon:</span>
                    <strong style={{ color: '#212529' }}>{currentBranch.Telp || '-'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* GPS & Benchmark Ground-Truth Coordinates */}
            <div
              style={{
                marginBottom: '0.65rem',
                background: '#f9fbfd',
                border: '1px solid #e9ebec',
                borderRadius: '6px',
                padding: '0.45rem 0.65rem',
                fontSize: '0.69rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#878a99', fontWeight: 600 }}>📍 Titik GPS Real:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0f766e' }}>
                  {selectedPin.lat.toFixed(6)}, {selectedPin.lng.toFixed(6)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0ab39c', fontWeight: 600, fontSize: '0.67rem' }}>
                <ShieldCheck size={12} />
                <span>Terverifikasi Real Daratan (Benchmark Google Maps)</span>
              </div>
            </div>

            {/* Bottom Actions: Google Maps & Master Navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selectedPin.lat},${selectedPin.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-success"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.8rem',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  borderRadius: '4px',
                  boxShadow: '0 2px 4px rgba(10, 179, 156, 0.25)',
                }}
                title="Buka titik koordinat real langsung di Google Maps"
              >
                <ExternalLink size={13} />
                <span>Buka di Google Maps (Titik Real GPS)</span>
              </a>

              <a
                href={currentGmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.7rem',
                  fontSize: '0.72rem',
                  color: '#405189',
                  background: 'rgba(64, 81, 137, 0.08)',
                  border: '1px solid rgba(64, 81, 137, 0.2)',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
                title="Cari berdasarkan nama cabang dan alamat di Google Maps"
              >
                <ExternalLink size={12} />
                <span>Cari Alamat di Google Maps</span>
              </a>

              {onNavigateToMaster && (
                <button
                  type="button"
                  onClick={onNavigateToMaster}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem',
                    fontSize: '0.71rem',
                    color: '#405189',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  <Eye size={12} />
                  <span>Lihat entri di Tab Data Master</span>
                  <ChevronRight size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL RINCIAN DATA MATCHED UNTUK CABANG INI ("DATA INI SAYA BISA LIHAT DI MANA YA") */}
      {showMatchedModal && selectedPin && (
        <DialogPanel
          onClose={() => setShowMatchedModal(false)}
          backdropClassName=""
          backdropStyle={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(33, 37, 41, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          className=""
          style={{
              background: '#ffffff',
              borderRadius: '6px',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
              border: '1px solid #e9ebec',
          }}
        >
            {/* Modal Header */}
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #eef1f4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafbfc',
                borderRadius: '6px 6px 0 0',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={18} color="#0ab39c" />
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#212529' }}>
                    Daftar {selectedMatchedRows.length} Data Target Matched ➔ {selectedPin.primaryOutletName}
                  </h4>
                </div>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#878a99' }}>
                  Cabang BNI {selectedPin.wilayah} | Kode Pos: <strong>{selectedPin.kodePos}</strong> | {selectedPin.dati2}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowMatchedModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: '#878a99',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Toolbar: Search & Action Button */}
            <div
              style={{
                padding: '0.75rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                borderBottom: '1px solid #eef1f4',
                background: '#ffffff',
                flexWrap: 'wrap',
              }}
            >
              <div className="search-input-wrapper" style={{ width: '260px' }}>
                <Search size={13} className="search-icon-pos" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Cari dalam data cocok ini..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem 0.35rem 1.85rem' }}
                />
              </div>

              {onNavigateToEngine && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setShowMatchedModal(false);
                    const s = currentBranch?.['Sandi Cabang'] || currentBranch?.Sandi || selectedPin.kodePos;
                    onNavigateToEngine(s);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.8rem',
                  }}
                >
                  <Eye size={13} />
                  <span>Saring & Buka di Tab Data Cek</span>
                </button>
              )}
            </div>

            {/* Modal Table Body */}
            <div ref={modalScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1.25rem', maxHeight: '460px' }}>
              <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>No</th>
                    <th style={{ minWidth: '140px', textAlign: 'center', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Status Match</th>
                    <th style={{ minWidth: '95px', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Wilayah</th>
                    <th style={{ minWidth: '120px', color: '#405189', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Sandi Cabang</th>
                    <th style={{ minWidth: '150px', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Nama Outlet Target</th>
                    <th style={{ minWidth: '220px', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Alamat Lengkap Target</th>
                    <th style={{ minWidth: '80px', textAlign: 'center', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Kode Pos</th>
                    <th style={{ minWidth: '100px', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Kelurahan</th>
                    <th style={{ minWidth: '100px', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Kecamatan</th>
                    <th style={{ minWidth: '100px', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Dati II</th>
                    <th style={{ minWidth: '100px', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Provinsi</th>
                    <th style={{ minWidth: '110px', textAlign: 'center', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>PTEN</th>
                    <th style={{ minWidth: '100px', textAlign: 'center', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Google Maps</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModalRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#878a99' }}>
                        Tidak ada record yang sesuai dengan pencarian "{modalSearchTerm}".
                      </td>
                    </tr>
                  ) : (
                    <>
                      {modalWin.active && modalWin.padTop > 0 && <tr aria-hidden="true" style={{ height: `${modalWin.padTop}px` }} />}
                      {renderedModalRows.map((row, i) => {
                      const idx = modalRowOffset + i;
                      const targetKp = String(row['KODE POS'] || '').replace(/\D/g, '').trim();
                      const rawStatus = String(row['CEK KODE POS + PTEN'] || '').toUpperCase().trim();
                      const isPtenMatch =
                        rawStatus === 'COCOK' ||
                        rawStatus === 'SAME' ||
                        rawStatus === 'MATCH' ||
                        (targetKp.length === 5 && ptenKpSet.has(targetKp));

                      return (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', color: '#878a99', fontWeight: 600 }}>{row.No || idx + 1}</td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                background: row._matchLevel === 'level1'
                                  ? 'rgba(10, 179, 156, 0.12)'
                                  : row._matchLevel === 'level2'
                                  ? 'rgba(53, 119, 241, 0.12)'
                                  : 'rgba(247, 184, 75, 0.15)',
                                color: row._matchLevel === 'level1'
                                  ? '#0ab39c'
                                  : row._matchLevel === 'level2'
                                  ? '#3577f1'
                                  : '#d68b0c',
                                padding: '0.12rem 0.45rem',
                                borderRadius: '4px',
                                display: 'inline-block',
                              }}
                            >
                              {row._matchLevel === 'level1' ? '✓ Level 1 (Sandi)' : row._matchLevel === 'level2' ? '✓ Level 2 (Nama/Alamat)' : '✓ Rekomendasi Terpilih'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500, color: '#495057', whiteSpace: 'nowrap' }}>
                            {formatWilayahName(row.Wilayah || currentBranch?.Wilayah || '-')}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#405189', whiteSpace: 'nowrap' }}>
                            {row['Sandi Cabang'] || row.Sandi || currentBranch?.['Sandi Cabang'] || currentBranch?.Sandi || '-'}
                          </td>
                          <td style={{ fontWeight: 600, color: '#212529', minWidth: '150px' }}>
                            {row['Nama Outlet'] || '-'}
                          </td>
                          <td style={{ color: '#495057', minWidth: '200px', lineHeight: 1.35 }}>
                            {row.ALAMAT || '-'}
                          </td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#405189' }}>
                            {row['KODE POS'] || '-'}
                          </td>
                          <td style={{ color: '#495057' }}>{row.Kelurahan || '-'}</td>
                          <td style={{ color: '#495057' }}>{row.Kecamatan || '-'}</td>
                          <td style={{ color: '#495057' }}>{row['Dati II'] || '-'}</td>
                          <td style={{ color: '#495057' }}>{row.Provinsi || '-'}</td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {isPtenMatch ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  color: '#0ab39c',
                                  background: 'rgba(10, 179, 156, 0.12)',
                                  border: '1px solid rgba(10, 179, 156, 0.3)',
                                  borderRadius: '4px',
                                  padding: '0.1rem 0.4rem',
                                }}
                              >
                                <CheckCircle2 size={10} color="#0ab39c" /> Match PTEN
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 600,
                                  color: '#6c757d',
                                  background: '#f8f9fa',
                                  border: '1px solid #e9ebec',
                                  borderRadius: '4px',
                                  padding: '0.1rem 0.4rem',
                                }}
                              >
                                Tidak Ada Data PTEN
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${row['Nama Outlet'] || ''} ${row.ALAMAT || ''} ${row.Kecamatan || ''} ${row['Dati II'] || ''} ${row['KODE POS'] || ''}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-ghost-primary"
                              style={{
                                padding: '0.15rem 0.45rem',
                                fontSize: '0.67rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                borderRadius: '4px',
                                color: '#3577f1',
                                background: 'rgba(53,119,241, 0.08)',
                                border: '1px solid rgba(53,119,241, 0.2)',
                                textDecoration: 'none',
                                fontWeight: 600,
                              }}
                              title="Buka dan verifikasi alamat record ini langsung di Google Maps"
                            >
                              <ExternalLink size={11} />
                              <span>Google Maps</span>
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                      {modalWin.active && modalWin.padBottom > 0 && <tr aria-hidden="true" style={{ height: `${modalWin.padBottom}px` }} />}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid #eef1f4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafbfc',
                borderRadius: '0 0 8px 8px',
                fontSize: '0.75rem',
                color: '#878a99',
              }}
            >
              <div>
                Menampilkan <strong style={{ color: '#212529' }}>{filteredModalRows.length}</strong> dari total {selectedMatchedRows.length} record cocok
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowMatchedModal(false)}
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
              >
                Tutup
              </button>
            </div>
        </DialogPanel>
      )}

      {/* Floating Live Realtime Geocoding Progress Pill */}
      {isGeocoding && geocodingProgress && (
        <div
          className="bni-pop"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: 'rgba(33,37,41, 0.92)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '0.65rem 1.1rem',
            borderRadius: '50px',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.78rem',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              border: '2px solid #0ab39c',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'qdrSpin 1s linear infinite',
            }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>
              Mencari titik {geocodingProgress.completed} dari {geocodingProgress.total}

            </div>
            {geocodingProgress.activeItem && (
              <div style={{ fontSize: '0.68rem', color: '#adb5bd', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {geocodingProgress.activeItem}
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
};
