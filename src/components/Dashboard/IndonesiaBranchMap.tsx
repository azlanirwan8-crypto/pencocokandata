import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  Eye,
  Globe,
  Share2,
  X,
  Radio,
  FileSpreadsheet,
  ShieldCheck,
  Key,
  Info,
} from 'lucide-react';
import type { MasterRow, TargetRow } from '../../types';
import {
  clusterMasterRowsForMap,
  INDONESIA_REGIONS,
  createCurvedArcPoints,
  resolveTargetOriginCoordinates,
  resolveBranchCoordinates,
  clampToIndonesia,
  isAcehTargetRow,
  groupTargetOriginsForMap,
  type PlottedBranchPin,
  getAllMatchedCoordinates,
} from '../../utils/geoCoder';
import {
  buildMasterQuery,
  buildTargetQuery,
  batchGeocodeUniqueQueries,
  getStoredGoogleApiKey,
  setStoredGoogleApiKey,
  type GeoLocationResult,
  type BatchProgress,
} from '../../utils/onlineGeoCoder';
import { get, keys } from 'idb-keyval';
import { cleanDati, cleanProvinsi } from '../../utils/normalizer';

interface IndonesiaBranchMapProps {
  masterRows: MasterRow[];
  targetRows?: TargetRow[];
  selectedWilayah?: string;
  onNavigateToMaster?: () => void;
  onNavigateToEngine?: (searchFilter?: string) => void;
}

type DisplayScope = 'ALL' | 'SELECTED_ONLY' | 'MATCHED_ONLY' | 'MULTI_ONLY';
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

function getIslandGroup(province: string): string {
  const normalized = cleanProvinsi(province);
  if (['aceh', 'sumatera utara', 'sumatera barat', 'riau', 'kepulauan riau', 'jambi', 'sumatera selatan', 'kepulauan bangka belitung', 'bengkulu', 'lampung'].includes(normalized)) return 'SUMATERA';
  if (['banten', 'dki jakarta', 'jawa barat', 'jawa tengah', 'daerah istimewa yogyakarta', 'di yogyakarta', 'jawa timur'].includes(normalized)) return 'JAWA';
  if (['bali', 'nusa tenggara barat', 'nusa tenggara timur'].includes(normalized)) return 'BALI_NUSA';
  if (['kalimantan barat', 'kalimantan tengah', 'kalimantan selatan', 'kalimantan timur', 'kalimantan utara'].includes(normalized)) return 'KALIMANTAN';
  if (['sulawesi utara', 'gorontalo', 'sulawesi tengah', 'sulawesi barat', 'sulawesi selatan', 'sulawesi tenggara'].includes(normalized)) return 'SULAWESI';
  if (['maluku', 'maluku utara', 'papua', 'papua barat', 'papua barat daya', 'papua tengah', 'papua pegunungan', 'papua selatan'].includes(normalized)) return 'MALUKU_PAPUA';
  return normalized;
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
  selectedWilayah = 'ALL',
  onNavigateToMaster,
  onNavigateToEngine,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const anomalyMapRef = useRef<HTMLDivElement | null>(null);
  const anomalyMapInstanceRef = useRef<L.Map | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const arcsLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);


  const [activeRegion, setActiveRegion] = useState<keyof typeof INDONESIA_REGIONS>('ALL');
  const [displayScope, setDisplayScope] = useState<DisplayScope>('ALL');
  const [tileProvider, setTileProvider] = useState<TileProvider>('google');

  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPin, setSelectedPin] = useState<PlottedBranchPin | null>(null);
  const [activeBranchIndex, setActiveBranchIndex] = useState(0);

  // Toggle for Curved Arcs and Matched Detail Modal
  const [showCurvedArcs, setShowCurvedArcs] = useState(true);
  const [showMatchedModal, setShowMatchedModal] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [trackingMode, setTrackingMode] = useState<'none' | 'aceh_kim'>('none');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showAnomalyPanel, setShowAnomalyPanel] = useState(false);
  const [selectedAnomalyTarget, setSelectedAnomalyTarget] = useState<TargetRow | null>(null);
  const [mapInteractionTick, setMapInteractionTick] = useState(0);
// @ts-ignore: suppress unused setter warning
  const [showAllMatchMarkers, setShowAllMatchMarkers] = useState(false);

  // Realtime Google Maps / Online Geocoding State
  const [googleApiKey, setGoogleApiKey] = useState(() => getStoredGoogleApiKey());
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [resolvedCoords, setResolvedCoords] = useState<Map<string, GeoLocationResult>>(new Map());
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState<BatchProgress | null>(null);
  // Flag: true once the IndexedDB pre-load pass completes (so geocoding effect knows cache is ready)
  const [cachePreloaded, setCachePreloaded] = useState(false);
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

  // Realtime Geocoding Hook: Resolves unique branch & target coordinates via Google Maps / Online API
  // Only runs AFTER cache preload so it only fetches truly uncached addresses
  useEffect(() => {
    // Wait for IndexedDB preload to complete before checking what's missing
    if (!cachePreloaded) return;
    if (!masterRows || masterRows.length === 0) return;

    let isMounted = true;
    const queriesToFetch: string[] = [];
    const hasCachedCoordinate = (query: string) =>
      resolvedCoords.has(query) || resolvedCoords.has(query.toLowerCase());

    for (const r of masterRows) {
      if (hasExplicitCoordinates(r)) continue;
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
          },
          googleApiKey
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
  }, [cachePreloaded, masterRows, targetRows, googleApiKey]);

  // 1. Group & Cluster master rows into pins using dynamic resolved coordinates
  const allPins = useMemo(() => {
    return clusterMasterRowsForMap(masterRows, selectedWilayah, targetRows, resolvedCoords);
  }, [masterRows, selectedWilayah, targetRows, resolvedCoords]);

  const multiOutletKodePos = useMemo(() => {
    const counts = new Map<string, number>();
    allPins.forEach((pin) => {
      const kodePos = String(pin.kodePos || '').replace(/\D/g, '').trim();
      if (kodePos) counts.set(kodePos, (counts.get(kodePos) || 0) + pin.branchCount);
    });
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([kodePos]) => kodePos));
  }, [allPins]);

  const isMultiOutletPin = (pin: PlottedBranchPin) => {
    const kodePos = String(pin.kodePos || '').replace(/\D/g, '').trim();
    return pin.branchCount > 1 || (kodePos !== '' && multiOutletKodePos.has(kodePos));
  };

  // 2. Filter pins based on Display Scope (Semua vs Hanya Terpilih vs Matched vs Multi)
  const filteredPins = useMemo(() => {
    if (displayScope === 'SELECTED_ONLY') {
      return selectedPin ? [selectedPin] : allPins.slice(0, 1);
    }
    if (displayScope === 'MATCHED_ONLY') {
      return allPins.filter((p) => p.matchedCount > 0);
    }
    if (displayScope === 'MULTI_ONLY') {
      return allPins.filter(isMultiOutletPin);
    }
    return allPins;
  }, [allPins, displayScope, selectedPin, multiOutletKodePos]);

  // 3. Search suggestions (top matches, including matched target origins like Aceh -> KIM)
  const searchSuggestions = useMemo((): SearchSuggestionItem[] => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    const items: SearchSuggestionItem[] = [];
    const addedPinIds = new Set<string>();

    // 1. Direct branch matches
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
        if (items.length >= 6) break;
      }
    }

    // 2. Also search matched target records (e.g. searching 'Aceh' or '23xxx' finds Cabang KIM)
    if (items.length < 8 && targetRows && targetRows.length > 0) {
      for (const p of allPins) {
        if (addedPinIds.has(p.id)) continue;
        const sandiSet = new Set(
          p.branches.map((b) => String(b['Sandi Cabang'] || b.Sandi || b['Kode Cabang'] || '').trim()).filter(Boolean)
        );
        const branchCodeSet = new Set(
          p.branches.map((b) => String(b['Branch Code'] || b['Kode Cabang'] || '').trim()).filter(Boolean)
        );
        const outletNameSet = new Set(
          p.branches.map((b) => String(b['Nama Outlet'] || '').toLowerCase().trim()).filter(Boolean)
        );

        const matchingTarget = targetRows.find((t) => {
          if (!t._isMatched) return false;
          const tSandi = String(t['Sandi Cabang'] || t.Sandi || t.Cabang || '').trim();
          const tBranchCode = String(t['Branch Code'] || t['Kode Cabang'] || '').trim();
          const tName = String(t['Nama Outlet'] || '').toLowerCase().trim();
          const isAttached =
            (tSandi && sandiSet.has(tSandi)) ||
            (tBranchCode && branchCodeSet.has(tBranchCode)) ||
            (tName && outletNameSet.has(tName));
          if (!isAttached) return false;

          const targetText = `${t['KODE POS'] || ''} ${t['Dati II'] || ''} ${t.Provinsi || ''} ${t.Kecamatan || ''} ${t['Nama Outlet'] || ''} ${t.ALAMAT || ''}`.toLowerCase();
          return targetText.includes(q);
        });

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
  }, [allPins, targetRows, searchQuery]);

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
  }, [allPins, filteredPins, multiOutletKodePos]);

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

  const anomalyRows = useMemo(() => {
    const masterByIdentity = new Map<string, MasterRow>();
    masterRows.forEach((master) => {
      [master['Branch Code'], master['Kode Cabang'], master['Sandi Cabang'], master.Sandi, master.Cabang, master['Nama Outlet']]
        .map((value) => String(value || '').trim().toUpperCase())
        .filter(Boolean)
        .forEach((identity) => masterByIdentity.set(identity, master));
    });

    return targetRows.flatMap((target) => {
      if (!target._isMatched) return [];
      if (isAcehTargetRow(target)) return [];
      const identities = [target['Branch Code'], target['Kode Cabang'], target['Sandi Cabang'], target.Sandi, target.Cabang, target['Nama Outlet']]
        .map((value) => String(value || '').trim().toUpperCase())
        .filter(Boolean);
      const master = identities.map((identity) => masterByIdentity.get(identity)).find(Boolean);
      if (!master) return [];
      const targetIsland = getIslandGroup(target.Provinsi);
      const masterIsland = getIslandGroup(master.Provinsi);
      const islandMismatch = Boolean(targetIsland && masterIsland && targetIsland !== masterIsland);
      return islandMismatch
        ? [{ target, master, islandMismatch }]
        : [];
    });
  }, [targetRows, masterRows]);

  const selectedAnomalyInfo = useMemo(() => {
    if (!selectedAnomalyTarget) return null;
    return anomalyRows.find((item) => String(item.target.No) === String(selectedAnomalyTarget.No)) || null;
  }, [anomalyRows, selectedAnomalyTarget]);

  useEffect(() => {
    if (!selectedAnomalyInfo || !anomalyMapRef.current) return;
    const targetLocation = resolveTargetOriginCoordinates(selectedAnomalyInfo.target, resolvedCoords);
    const masterLocation = resolveBranchCoordinates(selectedAnomalyInfo.master, resolvedCoords);
    const targetPoint: [number, number] = [targetLocation.lat, targetLocation.lng];
    const masterPoint: [number, number] = [masterLocation.lat, masterLocation.lng];
    const bounds = L.latLngBounds([targetPoint, masterPoint]);
    const miniMap = L.map(anomalyMapRef.current, { zoomControl: true, attributionControl: false, minZoom: 3, maxZoom: 18 }).fitBounds(bounds, { padding: [35, 35], maxZoom: 9 });
    const auditBounds = L.latLngBounds(L.latLng(-11.2, 94.5), L.latLng(6.2, 141.2));
    getMapTileLayer('google', auditBounds).addTo(miniMap);
    L.circleMarker(targetPoint, { radius: 10, color: '#ffffff', weight: 3, fillColor: '#dc2626', fillOpacity: 0.95 }).addTo(miniMap).bindTooltip(`Excel No. ${selectedAnomalyInfo.target.No}`, { permanent: true, direction: 'top' });
    L.circleMarker(masterPoint, { radius: 10, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 0.95 }).addTo(miniMap).bindTooltip(`Master ${selectedAnomalyInfo.master['Nama Outlet']}`, { permanent: true, direction: 'top' });
    L.polyline([targetPoint, masterPoint], { color: '#dc2626', weight: 3, dashArray: '8 6', opacity: 0.9 }).addTo(miniMap);
    anomalyMapInstanceRef.current = miniMap;
    return () => {
      miniMap.remove();
      anomalyMapInstanceRef.current = null;
    };
  }, [selectedAnomalyInfo, resolvedCoords]);


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
        fadeAnimation: false,
        markerZoomAnimation: false,
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

      // Ultra-clean, fast tile layer (Default: Google Maps Roadmap)
      const tileLayer = getMapTileLayer('google', indonesiaBounds).addTo(map);
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

    if (selectedPin) {
      const selectedHalo = L.circleMarker([selectedPin.lat, selectedPin.lng], {
        pane: 'selectedPane',
        renderer: canvasRenderer,
        radius: 17,
        color: '#f59e0b',
        weight: 2,
        opacity: 0.9,
        fillColor: '#f59e0b',
        fillOpacity: 0.12,
        interactive: false,
        className: 'bni-selected-halo',
      });
      markersLayer.addLayer(selectedHalo);
    }

    filteredPins.forEach((pin) => {
      const isMulti = isMultiOutletPin(pin);
      const hasMatch = pin.matchedCount > 0;
      const isSelected = selectedPin?.id === pin.id;

      // Color coding:
      // - Selected Pin: Glowing Golden Amber / Cyan Halo
      // - Multi-outlet: Vibrant Orange / Coral (#f06548)
      // - Active with Matched records: Vibrant Teal / Emerald (#0ab39c)
      // - Standby: Slate / Steel Blue (#6366f1)
      let fillColor = '#6366f1';
      let strokeColor = '#ffffff';
      let radius = 5.5;

      if (isSelected) {
        fillColor = '#f59e0b';
        strokeColor = '#ffffff';
        radius = 10;
      } else if (isMulti) {
        fillColor = '#f06548';
        radius = 8.5;
      } else if (hasMatch) {
        fillColor = '#0ab39c';
        radius = 7;
      } else {
        fillColor = '#818cf8';
        radius = 5.5;
      }

      const overlapKey = `${pin.lat.toFixed(5)}:${pin.lng.toFixed(5)}`;
      const overlappingIndex = overlapCounts.get(overlapKey) || 0;
      overlapCounts.set(overlapKey, overlappingIndex + 1);
      const visualCoords: [number, number] = overlappingIndex === 0
        ? [pin.lat, pin.lng]
        : [pin.lat + Math.sin(overlappingIndex * 2.4) * 0.002, pin.lng + Math.cos(overlappingIndex * 2.4) * 0.002];

      const marker = L.circleMarker(visualCoords, {
        pane: 'markersPane',
        renderer: canvasRenderer,
        radius,
        fillColor,
        color: strokeColor,
        weight: isSelected ? 3.5 : (isMulti ? 2.5 : 1.8),
        opacity: 1,
        fillOpacity: isSelected ? 1 : (hasMatch ? 0.95 : 0.85),
      });

      // Instant lightweight hover tooltip
      const tooltipContent = `
        <div style="font-family:inherit;font-size:11.5px;padding:3px 5px;line-height:1.4;">
          <div style="font-weight:700;color:#212529;display:flex;align-items:center;gap:4px;">
            <span>${pin.primaryOutletName}</span>
          </div>
          <div style="color:#6c757d;font-size:10.5px;margin-top:2px;">
            ${pin.dati2} &bull; <strong style="color:#405189;">📮 ${pin.kodePos}</strong>
          </div>
          ${hasMatch ? `<div style="color:#0ab39c;font-weight:700;font-size:11px;margin-top:3px;display:flex;align-items:center;gap:4px;">
            <span>✓</span> <strong>${pin.matchedCount.toLocaleString('id-ID')} Data Matched (Klik untuk Garis Lengkung)</strong>
          </div>` : ''}
          ${isMulti ? `<div style="color:#f06548;font-weight:700;font-size:10.5px;margin-top:2px;">⚠️ ${pin.branchCount} Cabang di Titik ini</div>` : ''}
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
        setSelectedAnomalyTarget(null);
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
    });

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

    if (selectedAnomalyTarget) {
      const anomalyOrigin = resolveTargetOriginCoordinates(selectedAnomalyTarget, resolvedCoords);
      const anomalyMarker = L.circleMarker([anomalyOrigin.lat, anomalyOrigin.lng], {
        pane: 'markersPane',
        renderer: canvasRenderer,
        radius: 11,
        fillColor: '#dc2626',
        color: '#ffffff',
        weight: 3,
        fillOpacity: 0.95,
      });
      anomalyMarker.bindTooltip(
        `<strong style="color:#b91c1c;">⚠️ Anomali Excel No. ${selectedAnomalyTarget.No || '-'}</strong><br/>${selectedAnomalyTarget.ALAMAT || '-'}<br/>KP ${selectedAnomalyTarget['KODE POS'] || '-'}`,
        { direction: 'top', className: 'bni-map-fast-tooltip' }
      );
      markersLayer.addLayer(anomalyMarker);
    }
    }, [filteredPins, selectedPin, showAllMatchMarkers, resolvedCoords, selectedAnomalyTarget, mapInteractionTick]);

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
        setSelectedAnomalyTarget(null);
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

    const cameraKey = displayScope === 'SELECTED_ONLY' && selectedPin
      ? `selected:${selectedPin.id}`
      : selectedWilayah !== 'ALL'
      ? `wilayah:${selectedWilayah}`
      : '';
    if (!cameraKey) {
      lastAutoFitKeyRef.current = '';
      return;
    }
    if (lastAutoFitKeyRef.current === cameraKey) return;

    lastAutoFitKeyRef.current = cameraKey;
    if (displayScope === 'SELECTED_ONLY' && selectedPin) {
      map.flyTo([selectedPin.lat, selectedPin.lng], 14, { duration: 0.55 });
    } else if (selectedWilayah !== 'ALL') {
      const bounds = L.latLngBounds(filteredPins.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12, animate: true, duration: 0.55 });
    }
  }, [displayScope, selectedPin, selectedWilayah, filteredPins]);

  useEffect(() => {
    if (!selectedAnomalyTarget) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const origin = resolveTargetOriginCoordinates(selectedAnomalyTarget, resolvedCoords);
    map.flyTo([origin.lat, origin.lng], Math.max(map.getZoom(), 8), { duration: 0.55 });
  }, [selectedAnomalyTarget, resolvedCoords]);

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

    const auditRows = selectedAnomalyTarget && !selectedMatchedRows.some((row) => String(row.No) === String(selectedAnomalyTarget.No))
      ? [...selectedMatchedRows, selectedAnomalyTarget]
      : selectedMatchedRows;
    if (!selectedPin || !showCurvedArcs || auditRows.length === 0) {
      return;
    }

    const destCoords: [number, number] = clampToIndonesia(selectedPin.lat, selectedPin.lng);
    const isIsolated = displayScope === 'SELECTED_ONLY' || trackingMode === 'aceh_kim';
    const originGroups = groupTargetOriginsForMap(auditRows, resolvedCoords);
    const verifiedOriginSources = new Set(['row_data', 'google', 'esri', 'osm', 'locationiq', 'cache']);
    const auditGroup = selectedAnomalyTarget
      ? originGroups.find((group) => group.rows.some((row) => String(row.No) === String(selectedAnomalyTarget.No)))
      : undefined;
    const verifiedGroups = originGroups.filter((group) => verifiedOriginSources.has(group.source) || group === auditGroup);
    const visibleGroups = isIsolated ? verifiedGroups : verifiedGroups.slice(0, 24);
    const allArcEndpoints: [number, number][] = [destCoords];

    visibleGroups.forEach((group, gIdx) => {
      const startCoords: [number, number] = clampToIndonesia(group.lat, group.lng);
      const dLat = startCoords[0] - destCoords[0];
      const dLng = startCoords[1] - destCoords[1];
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      const isOnSite = dist < 0.001;
      const count = group.rows.length;
      const firstRow = group.rows[0];
      const isAnomalyGroup = selectedAnomalyTarget
        ? group.rows.some((row) => String(row.No) === String(selectedAnomalyTarget.No))
        : false;

      if (!isOnSite) {
        const curveDirection = gIdx % 2 === 0 ? 0.1 : -0.08;
        const arcPoints = createCurvedArcPoints(startCoords, destCoords, curveDirection, 22);
        if (arcPoints.length > 0) {
          const curvedPolyline = L.polyline(arcPoints, {
            pane: 'arcsPane',
            color: isAnomalyGroup ? '#dc2626' : '#0ab39c',
            weight: Math.min(2 + Math.log10(count + 1), 4),
            opacity: 0.82,
            interactive: false, // Prevents curved lines from blocking clicks on markers
            className: 'bni-flow-arc',
          });
          curvedPolyline.bindTooltip(
            `<div style="font-size:11px;font-weight:600;color:#0f766e;">
              ${count.toLocaleString('id-ID')} data dari ${group.label}<br/>
              <span style="font-size:10px;color:${isAnomalyGroup ? '#b91c1c' : '#64748b'};">${isAnomalyGroup ? '⚠️ Audit anomali →' : '➔'} ${selectedPin.primaryOutletName}</span>
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
        fillColor: isOnSite ? '#a78bfa' : '#38bdf8',
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
          <strong style="color:#0284c7;">📍 ${group.label}</strong>
          <div style="color:#334155;margin-top:2px;">${count.toLocaleString('id-ID')} data dari Excel upload</div>
          <div style="color:#64748b;font-size:10px;">Sumber koordinat: ${group.source}</div>
          <div style="color:#64748b;font-size:10px;margin-top:3px;">📮 ${firstRow['KODE POS'] || '-'} · ${firstRow.Kecamatan || ''}</div>
          <div style="color:#475569;font-size:10px;margin-top:3px;max-height:96px;overflow:auto;">
            ${group.rows.slice(0, 12).map((row) => `No. ${row.No || '-'} · ${row['Nama Outlet'] || '-'} · ${row.ALAMAT || '-'} · KP ${row['KODE POS'] || '-'}`).join('<br/>')}
            ${group.rows.length > 12 ? `<br/>+${group.rows.length - 12} record lainnya` : ''}
          </div>
        </div>`,
        { direction: 'top' }
      );
      arcsLayer.addLayer(originDot);
    });

    if (isIsolated && allArcEndpoints.length > 0) {
      if (allArcEndpoints.length > 1) {
        const arcBounds = L.latLngBounds(allArcEndpoints);
        map.fitBounds(arcBounds, { padding: [60, 60], maxZoom: 13 });
      } else {
        map.flyTo(destCoords, 14, { duration: 0.8 });
      }
    }
  }, [selectedPin, showCurvedArcs, selectedMatchedRows, selectedAnomalyTarget, displayScope, trackingMode, resolvedCoords]);


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
      alert('Cabang KIM tidak ditemukan di master data cabang.');
      return;
    }
    setTrackingMode('aceh_kim');
    setDisplayScope('SELECTED_ONLY');
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
        borderRadius: '8px',
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
          borderBottom: '1px solid #eef0f2',
          paddingBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '7px',
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
                  borderRadius: '8px',
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
          borderRadius: '7px',
          border: '1px solid #eef0f2',
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
              {displayScope === 'ALL' && (
                <><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#6366f1', display: 'inline-block', flexShrink: 0 }} /><span>Data Master ({allPins.length})</span></>
              )}
              {displayScope === 'MATCHED_ONLY' && (
                <><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#0ab39c', display: 'inline-block', flexShrink: 0 }} /><span>Data Rekomendasi ({stats.pinsWithMatchCount})</span></>
              )}
              {displayScope === 'MULTI_ONLY' && (
                <><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f06548', display: 'inline-block', flexShrink: 0 }} /><span>Multi-Outlet ({stats.multiOutletPins})</span></>
              )}
              {displayScope === 'SELECTED_ONLY' && (
                <><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} /><span>Titik Terpilih</span></>
              )}
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
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 2000,
                minWidth: '230px',
                overflow: 'hidden',
              }}
            >
              {/* Section label */}
              <div style={{ padding: '0.4rem 0.75rem 0.2rem', fontSize: '0.63rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Filter Tampilan Peta
              </div>

              {/* Option: Data Master */}
              {([
                {
                  value: 'ALL' as DisplayScope,
                  dot: '#6366f1',
                  label: 'Data Master',
                  count: allPins.length,
                  desc: 'Semua titik cabang',
                  icon: '🏦',
                },
                {
                  value: 'MATCHED_ONLY' as DisplayScope,
                  dot: '#0ab39c',
                  label: 'Data Rekomendasi',
                  count: stats.pinsWithMatchCount,
                  desc: 'Cabang dengan data cocok',
                  icon: '✅',
                },
                {
                  value: 'MULTI_ONLY' as DisplayScope,
                  dot: '#f06548',
                  label: 'Data Multi-Outlet',
                  count: stats.multiOutletPins,
                  desc: 'lebih dari 1 cabang di titik sama',
                  icon: '⚠️',
                },
                {
                  value: 'SELECTED_ONLY' as DisplayScope,
                  dot: '#f59e0b',
                  label: 'Titik Terpilih',
                  count: null,
                  desc: 'Cabang yang diklik',
                  icon: '🎯',
                },
              ].map((opt) => {
                const isActive = displayScope === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (opt.value === 'SELECTED_ONLY' && !selectedPin) {
                        alert('Klik salah satu titik cabang di peta terlebih dahulu.');
                        return;
                      }
                      setTrackingMode('none');
                      setDisplayScope(opt.value);
                      setShowFilterDropdown(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: isActive ? `${opt.dot}14` : 'transparent',
                      border: 'none',
                      borderLeft: isActive ? `3px solid ${opt.dot}` : '3px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Colored bullet */}
                    <span style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: opt.dot,
                      display: 'inline-block',
                      flexShrink: 0,
                      boxShadow: isActive ? `0 0 0 3px ${opt.dot}30` : 'none',
                    }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isActive ? opt.dot : '#212529' }}>
                          {opt.icon} {opt.label}
                        </span>
                        {opt.count !== null && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: isActive ? opt.dot : '#f1f5f9',
                            color: isActive ? '#fff' : '#64748b',
                            padding: '0.05rem 0.4rem',
                            borderRadius: '10px',
                            minWidth: '28px',
                            textAlign: 'center',
                          }}>
                            {(opt.count as number).toLocaleString('id-ID')}
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginTop: '1px' }}>{opt.desc}</span>
                    </span>
                  </button>
                );
              }))}

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
                boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
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

        {/* 7. Geocoding API Status Button */}
        <button
          type="button"
          onClick={() => {
            setApiKeyInput(googleApiKey);
            setShowApiKeyModal(true);
          }}
          title="Geocoding: LocationIQ aktif (fallback). Klik untuk tambah Google API Key (opsional)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.73rem',
            fontWeight: 600,
            padding: '0.25rem 0.55rem',
            borderRadius: '5px',
            border: '1px solid #10b981',
            background: 'rgba(16,185,129,0.1)',
            color: '#059669',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Key size={12} />
          <span>{googleApiKey ? 'Google + LocationIQ ✓' : 'LocationIQ Aktif ✓'}</span>
        </button>
      </div>

      {showAnomalyPanel && (
        <div style={{ marginBottom: '0.65rem', padding: '0.7rem 0.85rem', border: '1px solid rgba(240,101,72,0.35)', borderRadius: '7px', background: '#fff8f6', color: '#7c2d12', fontSize: '0.72rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <strong>Audit data upload vs Master</strong>
            <span>{anomalyRows.length === 0 ? 'Tidak ada anomali' : `${anomalyRows.length} record beda pulau`}</span>
          </div>
          {anomalyRows.length > 0 && (
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'grid', gap: '0.3rem' }}>
              {anomalyRows.slice(0, 50).map(({ target, master }) => (
                <div
                  key={`${target.No}-${master['Branch Code']}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const masterIdentity = String(master['Branch Code'] || master['Kode Cabang'] || master['Sandi Cabang'] || '').trim();
                    const pin = allPins.find((candidate) => candidate.branches.some((branch) => String(branch['Branch Code'] || branch['Kode Cabang'] || branch['Sandi Cabang'] || '').trim() === masterIdentity));
                    if (pin) {
                      setTrackingMode('none');
                      setDisplayScope('ALL');
                      setSelectedPin(pin);
                    }
                    setSelectedAnomalyTarget(target);
                  }}
                  style={{ padding: '0.35rem 0.5rem', background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <span style={{ flex: 1 }}><strong>No. {target.No}</strong> · KP {target['KODE POS'] || '-'} · <span style={{ color: '#b91c1c' }}>{target['Dati II'] || '-'}, {target.Provinsi || '-'}</span> → <span style={{ color: '#0369a1' }}>{master['Nama Outlet']} ({master.Provinsi})</span></span>
                  <button
                    type="button"
                    title="Lihat detail anomali"
                    aria-label={`Lihat detail anomali No. ${target.No}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      const masterIdentity = String(master['Branch Code'] || master['Kode Cabang'] || master['Sandi Cabang'] || '').trim();
                      const pin = allPins.find((candidate) => candidate.branches.some((branch) => String(branch['Branch Code'] || branch['Kode Cabang'] || branch['Sandi Cabang'] || '').trim() === masterIdentity));
                      if (pin) {
                        setTrackingMode('none');
                        setDisplayScope('ALL');
                        setSelectedPin(pin);
                      }
                      setSelectedAnomalyTarget(target);
                    }}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #f97316', background: '#fff7ed', color: '#c2410c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <Info size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedAnomalyInfo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Detail anomali No. ${selectedAnomalyInfo.target.No}`}
          onClick={() => setSelectedAnomalyTarget(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(15, 23, 42, 0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(1120px, 96vw)', maxHeight: 'calc(100vh - 32px)', overflow: 'hidden', background: '#ffffff', borderRadius: '10px', boxShadow: '0 20px 50px rgba(15,23,42,0.28)', border: '1px solid #fecdd3', display: 'grid', gridTemplateColumns: '1.2fr 1fr' }}>
            <div style={{ gridColumn: '1 / -1', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fee2e2', background: '#fff7f7' }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#b91c1c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Audit Anomali Lintas Pulau</div>
                <strong style={{ fontSize: '1rem', color: '#4c0519' }}>Record Excel No. {selectedAnomalyInfo.target.No}</strong>
              </div>
              <button type="button" onClick={() => setSelectedAnomalyTarget(null)} title="Tutup detail" aria-label="Tutup detail" style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ minHeight: '560px', background: '#e2e8f0', position: 'relative' }}>
              <div ref={anomalyMapRef} style={{ width: '100%', height: '100%', minHeight: '560px' }} />
              <div style={{ position: 'absolute', left: '12px', bottom: '12px', zIndex: 500, padding: '0.45rem 0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.94)', border: '1px solid #cbd5e1', fontSize: '0.68rem', color: '#334155' }}>
                <span style={{ color: '#dc2626', fontWeight: 800 }}>● Excel</span> → <span style={{ color: '#2563eb', fontWeight: 800 }}>● Master</span>
              </div>
            </div>
            <div style={{ padding: '1rem', maxHeight: 'calc(100vh - 112px)', overflowY: 'auto', display: 'grid', gap: '0.8rem', fontSize: '0.76rem', color: '#334155' }}>
              <div style={{ padding: '0.65rem 0.75rem', border: '1px solid #fecdd3', borderRadius: '7px', background: '#fff1f2' }}>
                <strong style={{ color: '#9f1239' }}>Kesimpulan validasi</strong>
                <div style={{ marginTop: '0.3rem' }}>Lokasi data upload dan Master tujuan berada di pulau berbeda. Ini adalah anomali mapping dan bukan alur Aceh → KIM.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                <div style={{ padding: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '7px' }}>
                  <strong style={{ color: '#b91c1c' }}>Data upload Excel</strong>
                  <div style={{ marginTop: '0.4rem' }}>No: {selectedAnomalyInfo.target.No}</div>
                  <div>Wilayah: {selectedAnomalyInfo.target.Wilayah || '-'}</div>
                  <div>Sandi Cabang: {selectedAnomalyInfo.target['Sandi Cabang'] || selectedAnomalyInfo.target.Sandi || selectedAnomalyInfo.target.Cabang || '-'}</div>
                  <div>Branch Code: {selectedAnomalyInfo.target['Branch Code'] || '-'}</div>
                  <div>Kode Cabang: {selectedAnomalyInfo.target['Kode Cabang'] || '-'}</div>
                  <div>Nama: {selectedAnomalyInfo.target['Nama Outlet'] || '-'}</div>
                  <div>Status: {selectedAnomalyInfo.target['Status Outlet'] || '-'}</div>
                  <div>Alamat: {selectedAnomalyInfo.target.ALAMAT || '-'}</div>
                  <div>Kode pos: {selectedAnomalyInfo.target['KODE POS'] || '-'}</div>
                  <div>Kelurahan: {selectedAnomalyInfo.target.Kelurahan || '-'}</div>
                  <div>Kecamatan: {selectedAnomalyInfo.target.Kecamatan || '-'}</div>
                  <div>Kode Dati II: {selectedAnomalyInfo.target['Kode Dati II'] || '-'}</div>
                  <div>Provinsi: {selectedAnomalyInfo.target.Provinsi || '-'}</div>
                  <div>Dati II: {selectedAnomalyInfo.target['Dati II'] || '-'}</div>
                  <div>Koordinat: {(() => { const origin = resolveTargetOriginCoordinates(selectedAnomalyInfo.target, resolvedCoords); return `${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)} (${origin.source})`; })()}</div>
                </div>
                <div style={{ padding: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '7px' }}>
                  <strong style={{ color: '#0369a1' }}>Master tujuan</strong>
                  <div style={{ marginTop: '0.4rem' }}>Branch Code: {selectedAnomalyInfo.master['Branch Code'] || '-'}</div>
                  <div>Wilayah: {selectedAnomalyInfo.master.Wilayah || '-'}</div>
                  <div>Sandi Cabang: {selectedAnomalyInfo.master['Sandi Cabang'] || selectedAnomalyInfo.master.Sandi || selectedAnomalyInfo.master.Cabang || '-'}</div>
                  <div>Kode Cabang: {selectedAnomalyInfo.master['Kode Cabang'] || '-'}</div>
                  <div>Nama: {selectedAnomalyInfo.master['Nama Outlet'] || '-'}</div>
                  <div>Status: {selectedAnomalyInfo.master['Status Outlet'] || '-'}</div>
                  <div>Alamat: {selectedAnomalyInfo.master.ALAMAT || '-'}</div>
                  <div>Kode pos: {selectedAnomalyInfo.master['KODE POS'] || '-'}</div>
                  <div>Kelurahan: {selectedAnomalyInfo.master.Kelurahan || '-'}</div>
                  <div>Kecamatan: {selectedAnomalyInfo.master.Kecamatan || '-'}</div>
                  <div>Kode Dati II: {selectedAnomalyInfo.master['Kode Dati II'] || '-'}</div>
                  <div>Provinsi: {selectedAnomalyInfo.master.Provinsi || '-'}</div>
                  <div>Dati II: {selectedAnomalyInfo.master['Dati II'] || '-'}</div>
                  <div>Koordinat pin: {(() => { const branch = resolveBranchCoordinates(selectedAnomalyInfo.master, resolvedCoords); return `${branch.lat.toFixed(6)}, ${branch.lng.toFixed(6)} (${branch.source})`; })()}</div>
                </div>
              </div>
              <div style={{ padding: '0.65rem 0.75rem', borderRadius: '7px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <strong>Before → Seharusnya</strong>
                <div style={{ marginTop: '0.3rem' }}><b>Yang salah:</b> data upload No. {selectedAnomalyInfo.target.No} ({selectedAnomalyInfo.target['Dati II'] || '-'}, {selectedAnomalyInfo.target.Provinsi || '-'}) dipetakan ke Branch Code {selectedAnomalyInfo.master['Branch Code'] || '-'} ({selectedAnomalyInfo.master['Dati II'] || '-'}, {selectedAnomalyInfo.master.Provinsi || '-'}).</div>
                <div><b>Before:</b> KP {selectedAnomalyInfo.target['KODE POS'] || '-'} · {getIslandGroup(selectedAnomalyInfo.target.Provinsi)} → Master {getIslandGroup(selectedAnomalyInfo.master.Provinsi)}</div>
                <div><b>Seharusnya:</b> record ini dicocokkan ke Master pada pulau yang sama dengan data upload.</div>
                <div style={{ marginTop: '0.3rem', color: '#64748b' }}>Sumber validasi: kolom Excel upload, kolom Master, normalisasi provinsi, dan kelompok pulau. Garis merah menunjukkan relasi yang perlu diperiksa.</div>
              </div>
            </div>
          </div>
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
        <div className="bni-map-container" style={{ position: 'relative' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '580px', borderRadius: '6px', cursor: 'default' }} />

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
                border: '1px solid rgba(245, 158, 11, 0.55)',
                borderRadius: '7px',
                boxShadow: '0 3px 12px rgba(15, 23, 42, 0.16)',
                color: '#92400e',
                fontSize: '0.7rem',
                fontWeight: 700,
                pointerEvents: 'none',
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
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

          {/* Floating Minimalist Legend */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(6px)',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              fontSize: '0.68rem',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0ab39c', display: 'inline-block', border: '1.5px solid #fff' }} />
              <span style={{ color: '#495057', fontWeight: 600 }}>Cabang Matched</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1', display: 'inline-block', border: '1.5px solid #fff' }} />
              <span style={{ color: '#495057', fontWeight: 600 }}>Cabang Master</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#f06548', display: 'inline-block', border: '2px solid #fff' }} />
              <span style={{ color: '#495057', fontWeight: 600 }}>Multi-Cabang (&gt;1)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '14px', height: '3px', background: '#0ab39c', display: 'inline-block', borderRadius: '2px' }} />
              <span style={{ color: '#0ab39c', fontWeight: 600 }}>Garis Lengkung Match</span>
            </div>
          </div>
        </div>

        {/* Selected Pin Side Drawer / Detail Card with Matched Data Correlation */}
        {selectedPin && currentBranch && (
          <div
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
                        background: selectedPin.onlineSource === 'google' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: selectedPin.onlineSource === 'google' ? '#2563eb' : '#059669',
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
                    if (displayScope === 'SELECTED_ONLY') {
                      setDisplayScope('ALL');
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

              {/* Matched Data Collaboration Highlight Box (INTERACTIVE CLICKABLE) */}
              <div
                onClick={() => {
                  if (selectedMatchedRows.length > 0) {
                    setShowMatchedModal(true);
                  }
                }}
                style={{
                  background: selectedPin.matchedCount > 0 ? 'rgba(10, 179, 156, 0.08)' : '#f1f5f9',
                  border: `1px solid ${selectedPin.matchedCount > 0 ? 'rgba(10, 179, 156, 0.3)' : '#cbd5e1'}`,
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
                    <CheckCircle size={16} color={selectedPin.matchedCount > 0 ? '#0ab39c' : '#64748b'} />
                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: selectedPin.matchedCount > 0 ? '#0ab39c' : '#475569' }}>
                        {trackingMode === 'aceh_kim'
                          ? `ALUR ACEH: ${selectedMatchedRows.length.toLocaleString('id-ID')} DATA → KIM`
                          : selectedPin.matchedCount > 0
                          ? `TERKORELASI: ${selectedPin.matchedCount.toLocaleString('id-ID')} DATA MATCHED`
                          : 'Belum Ada Transaksi Cocok'}
                      </div>
                      <div style={{ fontSize: '0.67rem', color: '#64748b' }}>
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

              {/* Isolate Selected Pin View Switcher */}
              <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (displayScope === 'SELECTED_ONLY') {
                      setTrackingMode('none');
                      setDisplayScope('ALL');
                    } else {
                      setDisplayScope('SELECTED_ONLY');
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
                    border: displayScope === 'SELECTED_ONLY' ? '1px solid #f59e0b' : '1px solid #ced4da',
                    background: displayScope === 'SELECTED_ONLY' ? '#f59e0b' : '#ffffff',
                    color: displayScope === 'SELECTED_ONLY' ? '#ffffff' : '#495057',
                    cursor: 'pointer',
                  }}
                >
                  <Radio size={12} />
                  <span>{displayScope === 'SELECTED_ONLY' ? 'Sedang Diisolasi' : 'Isolasi Titik Ini Saja'}</span>
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
                      background: '#eef0f7',
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
                      background: '#eef0f7',
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
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.45rem 0.65rem',
                fontSize: '0.69rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>📍 Titik GPS Real:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0f766e' }}>
                  {selectedPin.lat.toFixed(6)}, {selectedPin.lng.toFixed(6)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669', fontWeight: 600, fontSize: '0.67rem' }}>
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
        <div
          style={{
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
          onClick={() => setShowMatchedModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #eef0f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafbfc',
                borderRadius: '8px 8px 0 0',
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
                borderBottom: '1px solid #eef0f2',
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
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1.25rem', maxHeight: '420px' }}>
              <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>No</th>
                    <th style={{ minWidth: '160px', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Nama Outlet Target</th>
                    <th style={{ minWidth: '220px', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Alamat Lengkap Target</th>
                    <th style={{ minWidth: '110px', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Kecamatan</th>
                    <th style={{ minWidth: '85px', textAlign: 'center', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Kode Pos</th>
                    <th style={{ minWidth: '100px', textAlign: 'center', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Metode Match</th>
                    <th style={{ minWidth: '110px', textAlign: 'center', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>Google Maps</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModalRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#878a99' }}>
                        Tidak ada record yang sesuai dengan pencarian "{modalSearchTerm}".
                      </td>
                    </tr>
                  ) : (
                    filteredModalRows.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', color: '#878a99', fontWeight: 600 }}>{row.No || idx + 1}</td>
                        <td style={{ fontWeight: 600, color: '#212529' }}>{row['Nama Outlet']}</td>
                        <td style={{ color: '#495057' }}>{row.ALAMAT || '-'}</td>
                        <td style={{ color: '#6c757d' }}>{row.Kecamatan || row['Dati II'] || '-'}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#405189' }}>
                          {row['KODE POS'] || '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
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
                                : '#d97706',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '3px',
                            }}
                          >
                            {row._matchLevel === 'level1' ? 'Level 1 (Sandi)' : row._matchLevel === 'level2' ? 'Level 2 (Nama/Alamat)' : 'Rekomendasi'}
                          </span>
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
                              color: '#2563eb',
                              background: 'rgba(37, 99, 235, 0.08)',
                              border: '1px solid rgba(37, 99, 235, 0.2)',
                              textDecoration: 'none',
                              fontWeight: 600,
                            }}
                            title="Buka dan verifikasi alamat record ini langsung di Google Maps"
                          >
                            <ExternalLink size={11} />
                            <span>Cek Google</span>
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid #eef0f2',
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
          </div>
        </div>
      )}

      {/* Floating Live Realtime Geocoding Progress Pill */}
      {isGeocoding && geocodingProgress && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '0.65rem 1.1rem',
            borderRadius: '50px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
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
              border: '2px solid #34d399',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>
              {googleApiKey ? '🗺️ Validasi Google Maps Realtime:' : '🌐 Validasi Geocoding Realtime:'}{' '}
              {geocodingProgress.completed}/{geocodingProgress.total} ({geocodingProgress.percent}%)
            </div>
            {geocodingProgress.activeItem && (
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {geocodingProgress.activeItem}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Google Maps API Key Configuration Modal */}
      {showApiKeyModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '460px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
                  <Key size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                    Google Maps Geocoding API
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                    Validasi koordinat langsung ke server Google Maps
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.75rem', color: '#334155', lineHeight: 1.5 }}>
              <p style={{ margin: 0, marginBottom: '0.4rem' }}>
                💡 <strong>Gratis $200/bulan dari Google Cloud</strong> (setara ~40.000 request gratis setiap bulan).
              </p>
              <p style={{ margin: 0, color: '#64748b' }}>
                Jika dikosongkan, sistem secara otomatis menggunakan engine publik (ESRI / OpenStreetMap) secara gratis tanpa perlu API Key.
              </p>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Google Maps API Key:
              </label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.82rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setApiKeyInput('');
                  setStoredGoogleApiKey('');
                  setGoogleApiKey('');
                  setShowApiKeyModal(false);
                }}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#e11d48',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Hapus Key
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    color: '#64748b',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cleanKey = apiKeyInput.trim();
                    setStoredGoogleApiKey(cleanKey);
                    setGoogleApiKey(cleanKey);
                    setShowApiKeyModal(false);
                  }}
                  style={{
                    padding: '0.4rem 0.95rem',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    background: '#2563eb',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                  }}
                >
                  Simpan & Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
