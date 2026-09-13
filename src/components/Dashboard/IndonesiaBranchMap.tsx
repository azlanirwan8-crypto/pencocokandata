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
} from 'lucide-react';
import type { MasterRow, TargetRow } from '../../types';
import {
  clusterMasterRowsForMap,
  INDONESIA_REGIONS,
  createCurvedArcPoints,
  resolveTargetRowCoordinates,
  FOREIGN_LAND_MASKS,
  type PlottedBranchPin
} from '../../utils/geoCoder';

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
  const mapInstanceRef = useRef<L.Map | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const arcsLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const foreignMaskLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeRegion, setActiveRegion] = useState<keyof typeof INDONESIA_REGIONS>('ALL');
  const [displayScope, setDisplayScope] = useState<DisplayScope>('ALL');
  const [tileProvider, setTileProvider] = useState<TileProvider>('google');
  const [lockIndonesiaOnly, setLockIndonesiaOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPin, setSelectedPin] = useState<PlottedBranchPin | null>(null);
  const [activeBranchIndex, setActiveBranchIndex] = useState(0);

  // Toggle for Curved Arcs and Matched Detail Modal
  const [showCurvedArcs, setShowCurvedArcs] = useState(true);
  const [showMatchedModal, setShowMatchedModal] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // 1. Group & Cluster master rows into pins and correlate with Matched target rows
  const allPins = useMemo(() => {
    return clusterMasterRowsForMap(masterRows, selectedWilayah, targetRows);
  }, [masterRows, selectedWilayah, targetRows]);

  // 2. Filter pins based on Display Scope (Semua vs Hanya Terpilih vs Matched vs Multi)
  const filteredPins = useMemo(() => {
    if (displayScope === 'SELECTED_ONLY') {
      return selectedPin ? [selectedPin] : allPins.slice(0, 1);
    }
    if (displayScope === 'MATCHED_ONLY') {
      return allPins.filter((p) => p.matchedCount > 0);
    }
    if (displayScope === 'MULTI_ONLY') {
      return allPins.filter((p) => p.branchCount > 1);
    }
    return allPins;
  }, [allPins, displayScope, selectedPin]);

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
          const origin = resolveTargetRowCoordinates(matchingTarget);
          const originCity = matchingTarget['Dati II'] || origin.city || 'Aceh';
          const originKp = matchingTarget['KODE POS'] || '';
          items.push({
            pin: p,
            serviceNote: `Melayani data target di ${originCity} (📮 ${originKp})`,
            sourceCoords: [origin.lat, origin.lng],
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
    const multiOutletPins = allPins.filter((p) => p.branchCount > 1).length;
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
  }, [allPins, filteredPins]);

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
    const kp = String(selectedPin.kodePos || '').replace(/\D/g, '').trim();

    return targetRows.filter((t) => {
      if (!t._isMatched) return false;
      const tSandi = String(t['Sandi Cabang'] || t.Sandi || t.Cabang || '').trim();
      const tBranchCode = String(t['Branch Code'] || t['Kode Cabang'] || '').trim();
      const tName = String(t['Nama Outlet'] || '').toLowerCase().trim();
      const tKp = String(t['KODE POS'] || '').replace(/\D/g, '').trim();

      return (
        (tSandi && sandiSet.has(tSandi)) ||
        (tBranchCode && branchCodeSet.has(tBranchCode)) ||
        (tName && outletNameSet.has(tName)) ||
        (kp && tKp && kp === tKp)
      );
    });
  }, [selectedPin, targetRows]);

  // Dedicated Aceh Detection (Kodepos 23xxx/24xxx & Aceh target records served by Cabang KIM)
  const acehTargetMatches = useMemo(() => {
    return targetRows.filter((t) => {
      if (!t._isMatched) return false;
      const kp = String(t['KODE POS'] || '').trim();
      const prov = String(t.Provinsi || '').toLowerCase();
      const dati = String(t['Dati II'] || '').toLowerCase();
      const alamat = String(t.ALAMAT || '').toLowerCase();

      return (
        kp.startsWith('23') ||
        kp.startsWith('24') ||
        prov.includes('aceh') ||
        dati.includes('aceh') ||
        alamat.includes('aceh')
      );
    });
  }, [targetRows]);

  const acehTotalTargetCount = useMemo(() => {
    return targetRows.filter((t) => {
      const kp = String(t['KODE POS'] || '').trim();
      const prov = String(t.Provinsi || '').toLowerCase();
      const dati = String(t['Dati II'] || '').toLowerCase();
      const alamat = String(t.ALAMAT || '').toLowerCase();

      return (
        kp.startsWith('23') ||
        kp.startsWith('24') ||
        prov.includes('aceh') ||
        dati.includes('aceh') ||
        alamat.includes('aceh')
      );
    }).length;
  }, [targetRows]);

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
      const canvasRenderer = L.canvas({ padding: 0.5 });
      canvasRendererRef.current = canvasRenderer;

      const map = L.map(mapContainerRef.current, {
        center: INDONESIA_REGIONS.ALL.center,
        zoom: 5,
        minZoom: 5,                  // Strict lock: cannot zoom out beyond Indonesian archipelago
        maxZoom: 18,                 // High detail zoom to street level
        maxBounds: indonesiaBounds,  // Strict lock on Indonesia
        maxBoundsViscosity: 1.0,     // 100% rigid boundary: impossible to pan outside Indonesia
        zoomControl: true,
        scrollWheelZoom: true,
        preferCanvas: true,          // GPU Canvas for zero lag
      });

      // Fit bounds immediately on load so Aceh and Papua are completely visible
      map.fitBounds(indonesiaBounds, { padding: [15, 15] });

      // Ultra-clean, fast tile layer (Default: Google Maps Roadmap)
      const tileLayer = getMapTileLayer('google', indonesiaBounds).addTo(map);
      tileLayerRef.current = tileLayer;

      // Layer for masking foreign countries (Malaysia, Singapore, Brunei, Philippines, Australia, PNG, Timor-Leste)
      const foreignMaskLayer = L.layerGroup().addTo(map);
      foreignMaskLayerRef.current = foreignMaskLayer;

      const markersLayer = L.layerGroup().addTo(map);
      const arcsLayer = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = markersLayer;
      arcsLayerRef.current = arcsLayer;
    }

    return () => {
      if (mapInstanceRef.current) {
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

  // Render & Update Foreign Country Masks (Covering Malaysia, Singapore, Brunei, Philippines, Australia, PNG, Timor-Leste)
  useEffect(() => {
    const maskLayer = foreignMaskLayerRef.current;
    if (!maskLayer) return;

    maskLayer.clearLayers();

    if (!lockIndonesiaOnly) return;

    const isSatellite = tileProvider === 'google_hybrid';
    const maskFillColor = isSatellite ? '#0b1329' : '#f8fafc';
    const maskBorderColor = isSatellite ? '#1e293b' : '#cbd5e1';
    const maskFillOpacity = isSatellite ? 0.94 : 0.92;

    FOREIGN_LAND_MASKS.forEach((mask) => {
      const polygon = L.polygon(mask.coords, {
        fillColor: maskFillColor,
        fillOpacity: maskFillOpacity,
        color: maskBorderColor,
        weight: 1.5,
        interactive: true,
      });

      polygon.bindTooltip(
        `<div style="font-size:11px;font-weight:600;color:${isSatellite ? '#94a3b8' : '#64748b'};padding:2px 4px;">
          🚫 ${mask.name}<br/>
          <span style="font-size:10px;color:${isSatellite ? '#64748b' : '#94a3b8'};">Di luar jangkauan operasional BNI</span>
        </div>`,
        { sticky: true }
      );

      maskLayer.addLayer(polygon);
    });
  }, [lockIndonesiaOnly, tileProvider]);

  // Synchronize dynamic Map constraints based on lockIndonesiaOnly
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (lockIndonesiaOnly) {
      map.setMaxBounds(indonesiaBounds);
      map.setMinZoom(5);
      if (map.getZoom() < 5) {
        map.setZoom(5);
      }
    } else {
      map.setMinZoom(3);
    }
  }, [lockIndonesiaOnly, indonesiaBounds]);

  // 8. Render CircleMarkers on GPU Canvas with Live Matched Data Correlation
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const canvasRenderer = canvasRendererRef.current;
    if (!map || !markersLayer || !canvasRenderer) return;

    markersLayer.clearLayers();

    filteredPins.forEach((pin) => {
      const isMulti = pin.branchCount > 1;
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

      const marker = L.circleMarker([pin.lat, pin.lng], {
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

      // Click to select, fly to pin, and open drawer
      marker.on('click', () => {
        setSelectedPin(pin);
        setActiveBranchIndex(0);
      });

      markersLayer.addLayer(marker);
    });

    // Auto-fit if specific wilayah or single selected pin
    if (displayScope === 'SELECTED_ONLY' && selectedPin) {
      map.flyTo([selectedPin.lat, selectedPin.lng], 13, { duration: 0.9 });
    } else if (selectedWilayah !== 'ALL' && filteredPins.length > 0) {
      const bounds = L.latLngBounds(filteredPins.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [filteredPins, selectedPin, displayScope, selectedWilayah]);

  // 9. Render Realistic Curved Arcs (Garis Melengkung Match) from Source Records to Destination Branch
  useEffect(() => {
    const map = mapInstanceRef.current;
    const arcsLayer = arcsLayerRef.current;
    if (!map || !arcsLayer) return;

    arcsLayer.clearLayers();

    if (!selectedPin || !showCurvedArcs || selectedMatchedRows.length === 0) {
      return;
    }

    // Group matched target rows by distinct origin locations (up to 20 representative clusters)
    const destCoords: [number, number] = [selectedPin.lat, selectedPin.lng];
    const originGroups = new Map<string, { lat: number; lng: number; rows: TargetRow[] }>();

    selectedMatchedRows.forEach((r, idx) => {
      const origin = resolveTargetRowCoordinates(r);
      let originLat = origin.lat;
      let originLng = origin.lng;

      // If origin coordinates are identical to branch pin (e.g. same postal code),
      // create radial fan-out so trajectories flow from realistic surrounding client/transaction points
      const dLat = Math.abs(originLat - destCoords[0]);
      const dLng = Math.abs(originLng - destCoords[1]);
      if (dLat < 0.0008 && dLng < 0.0008) {
        // Detect west-coast Sumatra (e.g. Padang, Sibolga, Bengkulu)
        const isWestCoastSumatra = destCoords[1] >= 95.0 && destCoords[1] <= 102.5 && destCoords[0] <= 6.0 && destCoords[0] >= -5.0;
        let angle: number;
        if (isWestCoastSumatra) {
          // Inland angles: -70 deg to +70 deg (eastward into land, away from the ocean)
          const angleSpread = Math.PI * 0.7;
          angle = -angleSpread / 2 + ((idx % 12) / 11) * angleSpread;
        } else {
          angle = (idx % 12) * (Math.PI / 6);
        }
        const radiusDist = 0.008 + ((idx % 4) * 0.004); // ~800m - 2.4km fan-out
        originLat = destCoords[0] + Math.sin(angle) * radiusDist;
        originLng = destCoords[1] + Math.cos(angle) * radiusDist;
      }

      // Hard safety check for Padang coast (shoreline at lng ~ 100.354)
      if (destCoords[1] >= 100.33 && destCoords[1] <= 100.48 && destCoords[0] >= -1.15 && destCoords[0] <= -0.80) {
        originLng = Math.max(originLng, 100.3605);
      }

      const key = `${originLat.toFixed(3)}_${originLng.toFixed(3)}`;
      if (!originGroups.has(key)) {
        originGroups.set(key, { lat: originLat, lng: originLng, rows: [] });
      }
      originGroups.get(key)!.rows.push(r);
    });

    // Limit to top 20 arc groups for maximum smoothness & 60fps performance
    const topOrigins = Array.from(originGroups.values()).slice(0, 20);

    topOrigins.forEach((group, gIdx) => {
      const startCoords: [number, number] = [group.lat, group.lng];

      // Subtle, sleek curve curvature
      const curveDirection = gIdx % 2 === 0 ? 0.15 : -0.12;
      const arcPoints = createCurvedArcPoints(startCoords, destCoords, curveDirection, 24);

      // Curved Trajectory Line
      const curvedPolyline = L.polyline(arcPoints, {
        color: '#0ab39c',
        weight: 2.8,
        opacity: 0.85,
        className: 'bni-flow-arc',
      });

      curvedPolyline.bindTooltip(
        `<div style="font-size:11px;font-weight:600;color:#0f766e;">
          Alur ${group.rows.length} Data Target ➔ ${selectedPin.primaryOutletName}
        </div>`,
        { sticky: true }
      );

      arcsLayer.addLayer(curvedPolyline);

      // Source Origin Point (Pulsing Dot)
      const originDot = L.circleMarker(startCoords, {
        radius: 4.5,
        fillColor: '#38bdf8',
        color: '#ffffff',
        weight: 1.8,
        fillOpacity: 0.95,
      });

      const firstRow = group.rows[0];
      originDot.bindTooltip(
        `<div style="font-size:11px;padding:2px 4px;">
          <strong style="color:#0284c7;">📍 Titik Sumber Target (${group.rows.length} Data)</strong>
          <div style="color:#334155;margin-top:2px;">${firstRow['Nama Outlet'] || firstRow.ALAMAT || 'Data Target'}</div>
          <div style="color:#64748b;font-size:10px;">${firstRow.Kecamatan || ''} ${firstRow['Dati II'] || ''} (📮 ${firstRow['KODE POS'] || '-'})</div>
        </div>`,
        { direction: 'top' }
      );

      arcsLayer.addLayer(originDot);
    });

    // Fit bounds around the selected pin and its incoming arcs
    if (displayScope === 'SELECTED_ONLY' && topOrigins.length > 0) {
      const allArcCoords = [destCoords, ...topOrigins.map((o) => [o.lat, o.lng] as [number, number])];
      const arcBounds = L.latLngBounds(allArcCoords);
      map.fitBounds(arcBounds, { padding: [60, 60], maxZoom: 14 });
    }
  }, [selectedPin, showCurvedArcs, selectedMatchedRows, displayScope]);

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

  // Select a suggestion pin (supports frame fitting for remote links like Aceh -> KIM)
  const handleSelectSuggestion = (item: SearchSuggestionItem | PlottedBranchPin) => {
    const pin = 'pin' in item ? item.pin : item;
    const sourceCoords = 'sourceCoords' in item ? item.sourceCoords : undefined;

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

      {/* Control Bar 1: Island Navigation, Tile Provider, and Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.65rem',
          marginBottom: '0.6rem',
        }}
      >
        {/* Island Navigation Pills (Aceh Included) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.71rem', fontWeight: 600, color: '#878a99', marginRight: '0.15rem' }}>
            Pulau:
          </span>
          {(Object.keys(INDONESIA_REGIONS) as Array<keyof typeof INDONESIA_REGIONS>).map((key) => {
            const isActive = activeRegion === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleJumpRegion(key)}
                style={{
                  fontSize: '0.71rem',
                  fontWeight: 600,
                  padding: '0.24rem 0.55rem',
                  borderRadius: '4px',
                  border: isActive ? '1px solid #405189' : '1px solid #e9ebec',
                  background: isActive ? '#405189' : '#f8f9fa',
                  color: isActive ? '#ffffff' : '#495057',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {INDONESIA_REGIONS[key].name}
              </button>
            );
          })}
        </div>

        {/* Right side: Tile Provider Switcher & Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Lock Indonesia Only Toggle Button */}
          <button
            type="button"
            onClick={() => setLockIndonesiaOnly(!lockIndonesiaOnly)}
            title={lockIndonesiaOnly ? 'Peta dikunci 100% khusus wilayah Indonesia (negara tetangga ditutup)' : 'Kunci wilayah Indonesia dinonaktifkan'}
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '4px',
              border: lockIndonesiaOnly ? '1px solid #0ab39c' : '1px solid #ced4da',
              background: lockIndonesiaOnly ? '#ecfdf5' : '#ffffff',
              color: lockIndonesiaOnly ? '#059669' : '#6c757d',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <ShieldCheck size={12} color={lockIndonesiaOnly ? '#059669' : '#878a99'} />
            <span>{lockIndonesiaOnly ? '🇮🇩 Kunci Indonesia Saja' : '🔓 Buka Kunci Negara Lain'}</span>
          </button>

          {/* Tile Layer Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: '#f8f9fa', padding: '0.15rem 0.3rem', borderRadius: '5px', border: '1px solid #e9ebec' }}>
            <Globe size={12} color="#878a99" style={{ marginLeft: '0.2rem', marginRight: '0.1rem' }} />
            <button
              type="button"
              onClick={() => handleSwitchTile('google')}
              title="Peta Standar Google Maps (Ringan, Rapih, Cepat)"
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '0.18rem 0.45rem',
                border: 'none',
                borderRadius: '3px',
                background: tileProvider === 'google' ? '#0ab39c' : 'transparent',
                color: tileProvider === 'google' ? '#ffffff' : '#6c757d',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>🗺️</span> Google Maps
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTile('google_hybrid')}
              title="Google Maps Satelit Hybrid"
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '0.18rem 0.45rem',
                border: 'none',
                borderRadius: '3px',
                background: tileProvider === 'google_hybrid' ? '#0ab39c' : 'transparent',
                color: tileProvider === 'google_hybrid' ? '#ffffff' : '#6c757d',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>🛰️</span> Satelit
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTile('esri')}
              title="Esri World Street Map"
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '0.18rem 0.45rem',
                border: 'none',
                borderRadius: '3px',
                background: tileProvider === 'esri' ? '#405189' : 'transparent',
                color: tileProvider === 'esri' ? '#ffffff' : '#6c757d',
                cursor: 'pointer',
              }}
            >
              Esri
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTile('osm')}
              title="OpenStreetMap"
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '0.18rem 0.45rem',
                border: 'none',
                borderRadius: '3px',
                background: tileProvider === 'osm' ? '#405189' : 'transparent',
                color: tileProvider === 'osm' ? '#ffffff' : '#6c757d',
                cursor: 'pointer',
              }}
            >
              OSM
            </button>
          </div>

          {/* Search Input with Instant Autocomplete */}
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div className="search-input-wrapper" style={{ flex: 1 }}>
                <Search size={13} className="search-icon-pos" />
                <input
                  type="text"
                  className="search-input"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem 0.3rem 1.85rem', width: '100%' }}
                  placeholder="Cari Kota, Outlet, atau Kode Pos..."
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
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.73rem',
                  whiteSpace: 'nowrap',
                  borderRadius: '4px',
                }}
              >
                Lacak
              </button>
            </form>

            {/* Autocomplete Dropdown List */}
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
        </div>
      </div>

      {/* Control Bar 2: Filter Mode (Semua vs Hanya Terpilih vs Matched vs Multi) & Garis Melengkung Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '0.75rem',
          padding: '0.4rem 0.65rem',
          background: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #eef0f2',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.3rem' }}>
            <Filter size={13} color="#878a99" />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#495057' }}>Filter Tampilan:</span>
          </div>

          <button
            type="button"
            onClick={() => setDisplayScope('ALL')}
            style={{
              fontSize: '0.71rem',
              fontWeight: 600,
              padding: '0.22rem 0.55rem',
              borderRadius: '4px',
              border: displayScope === 'ALL' ? '1px solid #405189' : '1px solid #ced4da',
              background: displayScope === 'ALL' ? '#405189' : '#ffffff',
              color: displayScope === 'ALL' ? '#ffffff' : '#495057',
              cursor: 'pointer',
            }}
          >
            🌐 Semua Titik ({allPins.length})
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedPin) {
                setDisplayScope('SELECTED_ONLY');
              } else {
                alert('Silakan klik salah satu titik cabang pada peta terlebih dahulu untuk mengisolasi tampilannya.');
              }
            }}
            style={{
              fontSize: '0.71rem',
              fontWeight: 600,
              padding: '0.22rem 0.55rem',
              borderRadius: '4px',
              border: displayScope === 'SELECTED_ONLY' ? '1px solid #f59e0b' : '1px solid #ced4da',
              background: displayScope === 'SELECTED_ONLY' ? '#f59e0b' : '#ffffff',
              color: displayScope === 'SELECTED_ONLY' ? '#ffffff' : (selectedPin ? '#b45309' : '#878a99'),
              cursor: selectedPin ? 'pointer' : 'default',
            }}
            title="Hanya menampilkan titik cabang yang sedang dipilih dan garis koneksi match-nya"
          >
            🎯 Hanya Titik Terpilih Saja {selectedPin ? `(${selectedPin.primaryOutletName.slice(0, 16)}...)` : ''}
          </button>

          <button
            type="button"
            onClick={() => setDisplayScope('MATCHED_ONLY')}
            style={{
              fontSize: '0.71rem',
              fontWeight: 600,
              padding: '0.22rem 0.55rem',
              borderRadius: '4px',
              border: displayScope === 'MATCHED_ONLY' ? '1px solid #0ab39c' : '1px solid #ced4da',
              background: displayScope === 'MATCHED_ONLY' ? '#0ab39c' : '#ffffff',
              color: displayScope === 'MATCHED_ONLY' ? '#ffffff' : '#0ab39c',
              cursor: 'pointer',
            }}
          >
            ✓ Hanya Titik Matched ({stats.pinsWithMatchCount})
          </button>

          <button
            type="button"
            onClick={() => setDisplayScope('MULTI_ONLY')}
            style={{
              fontSize: '0.71rem',
              fontWeight: 600,
              padding: '0.22rem 0.55rem',
              borderRadius: '4px',
              border: displayScope === 'MULTI_ONLY' ? '1px solid #f06548' : '1px solid #ced4da',
              background: displayScope === 'MULTI_ONLY' ? '#f06548' : '#ffffff',
              color: displayScope === 'MULTI_ONLY' ? '#ffffff' : '#f06548',
              cursor: 'pointer',
            }}
          >
            ⚠️ Multi-Outlet Saja ({stats.multiOutletPins})
          </button>
          {/* Dedicated Aceh Tracking Button if Aceh data exists */}
          {acehTargetMatches.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const kimPin =
                  allPins.find(
                    (p) =>
                      p.primaryOutletName.toUpperCase().includes('KIM') ||
                      p.branches.some((b) =>
                        String(b.Cabang || b['Nama Outlet'] || b['Branch Code'] || '').toUpperCase().includes('KIM')
                      )
                  ) || allPins.find((p) => p.wilayah === 'W01' || p.dati2.toUpperCase().includes('MEDAN'));

                if (kimPin) {
                  handleSelectSuggestion({
                    pin: kimPin,
                    serviceNote: `Melayani ${acehTargetMatches.length} Data Aceh`,
                    sourceCoords: [5.5530, 95.3220],
                  });
                } else {
                  alert('Cabang KIM tidak ditemukan di master data cabang.');
                }
              }}
              style={{
                fontSize: '0.71rem',
                fontWeight: 700,
                padding: '0.22rem 0.6rem',
                borderRadius: '4px',
                border: '1px solid #0891b2',
                background: '#ecfeff',
                color: '#0e7490',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 1px 2px rgba(8,145,178,0.1)',
              }}
              title="Klik untuk melacak alur trajektori data kodepos Aceh yang diarahkan ke Cabang KIM"
            >
              <span>🕌</span> Lacak Alur Aceh ➔ KIM ({acehTargetMatches.length} Data)
            </button>
          )}

          {acehTargetMatches.length === 0 && acehTotalTargetCount > 0 && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid #fed7aa',
                background: '#fff7ed',
                color: '#c2410c',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Data Aceh terdeteksi tapi masih berada di tab Rekomendasi"
            >
              <span>ℹ️</span> {acehTotalTargetCount} Data Aceh (Di tab Rekomendasi ➔ Cabang KIM)
            </span>
          )}
        </div>

        {/* Toggle Garis Melengkung Match */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowCurvedArcs(!showCurvedArcs)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.71rem',
              fontWeight: 600,
              padding: '0.24rem 0.6rem',
              borderRadius: '4px',
              border: showCurvedArcs ? '1px solid rgba(10, 179, 156, 0.4)' : '1px solid #ced4da',
              background: showCurvedArcs ? 'rgba(10, 179, 156, 0.12)' : '#ffffff',
              color: showCurvedArcs ? '#0ab39c' : '#878a99',
              cursor: 'pointer',
            }}
            title="Aktifkan garis melengkung trajektori data match yang terhubung ke cabang terpilih"
          >
            <Share2 size={12} />
            <span>Garis Lengkung Match: {showCurvedArcs ? 'Aktif' : 'Nonaktif'}</span>
          </button>
        </div>
      </div>

      {/* Main Map Container & Interactive Side Panel */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedPin ? '1fr 340px' : '1fr',
          gap: '0.85rem',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Leaflet Hardware Canvas Map */}
        <div className="bni-map-container" style={{ position: 'relative' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '530px', borderRadius: '6px' }} />

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
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPin(null);
                    if (displayScope === 'SELECTED_ONLY') {
                      setDisplayScope('ALL');
                    }
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
                        {selectedPin.matchedCount > 0
                          ? `TERKORELASI: ${selectedPin.matchedCount.toLocaleString('id-ID')} DATA MATCHED`
                          : 'Belum Ada Transaksi Cocok'}
                      </div>
                      <div style={{ fontSize: '0.67rem', color: '#64748b' }}>
                        {selectedPin.matchedCount > 0
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
                  onClick={() => setDisplayScope(displayScope === 'SELECTED_ONLY' ? 'ALL' : 'SELECTED_ONLY')}
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

            {/* Bottom Actions: Google Maps & Master Navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <a
                href={currentGmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-success"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 0.9rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  borderRadius: '4px',
                  boxShadow: '0 2px 4px rgba(10, 179, 156, 0.25)',
                }}
              >
                <ExternalLink size={14} />
                <span>Buka di Google Maps</span>
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
                  </tr>
                </thead>
                <tbody>
                  {filteredModalRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#878a99' }}>
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
    </div>
  );
};
