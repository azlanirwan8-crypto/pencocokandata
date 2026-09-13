import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Search,
  ExternalLink,
  Layers,
  Compass,
  ChevronRight,
  Building2,
  Zap,
  Filter,
  Eye
} from 'lucide-react';
import type { MasterRow } from '../../types';
import {
  clusterMasterRowsForMap,
  INDONESIA_REGIONS,
  type PlottedBranchPin
} from '../../utils/geoCoder';

interface IndonesiaBranchMapProps {
  masterRows: MasterRow[];
  selectedWilayah?: string;
  onNavigateToMaster?: () => void;
}

type OutletTypeFilter = 'ALL' | 'KC' | 'KCP' | 'KK' | 'MULTI_ONLY';

export const IndonesiaBranchMap: React.FC<IndonesiaBranchMapProps> = ({
  masterRows,
  selectedWilayah = 'ALL',
  onNavigateToMaster,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeRegion, setActiveRegion] = useState<keyof typeof INDONESIA_REGIONS>('ALL');
  const [typeFilter, setTypeFilter] = useState<OutletTypeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPin, setSelectedPin] = useState<PlottedBranchPin | null>(null);
  const [activeBranchIndex, setActiveBranchIndex] = useState(0);

  // 1. Group & Cluster master rows into pins based on postal code & Wilayah
  const allPins = useMemo(() => {
    return clusterMasterRowsForMap(masterRows, selectedWilayah);
  }, [masterRows, selectedWilayah]);

  // 2. Filter pins based on outlet type or multi-outlet only
  const filteredPins = useMemo(() => {
    if (typeFilter === 'ALL') return allPins;
    if (typeFilter === 'MULTI_ONLY') {
      return allPins.filter((p) => p.branchCount > 1);
    }
    return allPins.filter((p) =>
      p.branches.some((b) => {
        const status = String(b['Status Outlet'] || b['Nama Outlet'] || '').toUpperCase();
        if (typeFilter === 'KC') return status.includes(' KC ') || status.startsWith('KC ') || status === 'KC';
        if (typeFilter === 'KCP') return status.includes('KCP');
        if (typeFilter === 'KK') return status.includes(' KK ') || status.includes('KAS');
        return true;
      })
    );
  }, [allPins, typeFilter]);

  // 3. Search suggestions (top 5 matches)
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    const matches: PlottedBranchPin[] = [];

    for (const p of allPins) {
      if (
        p.kodePos.includes(q) ||
        p.dati2.toLowerCase().includes(q) ||
        p.primaryOutletName.toLowerCase().includes(q) ||
        p.branches.some(
          (b) =>
            String(b['Sandi Cabang'] || b.Sandi || '').includes(q) ||
            String(b['Nama Outlet'] || '').toLowerCase().includes(q)
        )
      ) {
        matches.push(p);
        if (matches.length >= 6) break;
      }
    }
    return matches;
  }, [allPins, searchQuery]);

  // Map Summary Statistics
  const stats = useMemo(() => {
    const totalBranches = allPins.reduce((acc, p) => acc + p.branchCount, 0);
    const multiOutletPins = allPins.filter((p) => p.branchCount > 1).length;
    return {
      totalBranches,
      uniqueSpots: allPins.length,
      multiOutletPins,
      activeShowing: filteredPins.length,
    };
  }, [allPins, filteredPins]);

  // 4. Initialize Map with GPU Hardware Canvas Renderer & Ultra-Fast CartoDB Voyager CDN Tiles
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // GPU Accelerated Canvas renderer for instant rendering of thousands of pins
      const canvasRenderer = L.canvas({ padding: 0.5 });
      canvasRendererRef.current = canvasRenderer;

      const map = L.map(mapContainerRef.current, {
        center: INDONESIA_REGIONS.ALL.center,
        zoom: INDONESIA_REGIONS.ALL.zoom,
        zoomControl: true,
        scrollWheelZoom: true,
        preferCanvas: true, // Canvas-first mode for zero lag
      });

      // CartoDB Voyager Global Cloudflare CDN (Ultra-fast, beautiful light fintech theme)
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markersLayerRef.current = markersLayer;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 5. Draw CircleMarkers on GPU Canvas (Instant 0ms, No heavy DOM nodes)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const canvasRenderer = canvasRendererRef.current;
    if (!map || !markersLayer || !canvasRenderer) return;

    markersLayer.clearLayers();

    filteredPins.forEach((pin) => {
      const isMulti = pin.branchCount > 1;

      // GPU Canvas CircleMarker: Lightweight, highly responsive, gorgeous styling
      const marker = L.circleMarker([pin.lat, pin.lng], {
        renderer: canvasRenderer,
        radius: isMulti ? 8.5 : 5.5,
        fillColor: isMulti ? '#f06548' : '#0ab39c',
        color: '#ffffff',
        weight: isMulti ? 2.5 : 1.8,
        opacity: 1,
        fillOpacity: isMulti ? 0.95 : 0.85,
      });

      // Instant lightweight hover tooltip
      const tooltipContent = `
        <div style="font-family:inherit;font-size:11.5px;padding:2px 4px;line-height:1.35;">
          <div style="font-weight:700;color:#212529;display:flex;align-items:center;gap:4px;">
            <span>${pin.primaryOutletName}</span>
          </div>
          <div style="color:#6c757d;font-size:10.5px;margin-top:2px;">
            ${pin.dati2} &bull; <strong style="color:#405189;">📮 ${pin.kodePos}</strong>
          </div>
          ${isMulti ? `<div style="color:#f06548;font-weight:700;font-size:10.5px;margin-top:2px;">⚠️ ${pin.branchCount} Cabang di Titik ini</div>` : ''}
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -6],
        opacity: 0.96,
        className: 'bni-map-fast-tooltip',
      });

      // Click to select & open drawer
      marker.on('click', () => {
        setSelectedPin(pin);
        setActiveBranchIndex(0);
      });

      markersLayer.addLayer(marker);
    });

    // Auto-fit if specific wilayah is selected
    if (selectedWilayah !== 'ALL' && filteredPins.length > 0) {
      const bounds = L.latLngBounds(filteredPins.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [filteredPins, selectedWilayah]);

  // Handle Quick Island Navigation
  const handleJumpRegion = (regionKey: keyof typeof INDONESIA_REGIONS) => {
    setActiveRegion(regionKey);
    const map = mapInstanceRef.current;
    if (!map) return;
    const reg = INDONESIA_REGIONS[regionKey];
    map.flyTo(reg.center, reg.zoom, { duration: 0.9 });
  };

  // Select a suggestion pin
  const handleSelectSuggestion = (pin: PlottedBranchPin) => {
    setSelectedPin(pin);
    setActiveBranchIndex(0);
    setShowSuggestions(false);
    setSearchQuery(pin.primaryOutletName);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([pin.lat, pin.lng], 14, { duration: 0.9 });
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
                <Zap size={10} />
                LIGHTWEIGHT GPU GIS
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#878a99', margin: '0.15rem 0 0 0' }}>
              Visualisasi geospasial sebaran cabang aktif per kode pos & wilayah operasional
            </p>
          </div>
        </div>

        {/* Real-Time Stats Counters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '0.3rem 0.65rem',
              background: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #e9ebec',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Building2 size={13} color="#405189" />
            <span style={{ fontSize: '0.73rem', color: '#6c757d' }}>Cabang:</span>
            <strong style={{ fontSize: '0.78rem', color: '#405189' }}>
              {stats.totalBranches.toLocaleString('id-ID')}
            </strong>
          </div>

          <div
            style={{
              padding: '0.3rem 0.65rem',
              background: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #e9ebec',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <MapPin size={13} color="#0ab39c" />
            <span style={{ fontSize: '0.73rem', color: '#6c757d' }}>Titik Lokasi:</span>
            <strong style={{ fontSize: '0.78rem', color: '#0ab39c' }}>
              {stats.uniqueSpots.toLocaleString('id-ID')}
            </strong>
          </div>

          <div
            style={{
              padding: '0.3rem 0.65rem',
              background: 'rgba(240, 101, 72, 0.08)',
              borderRadius: '4px',
              border: '1px solid rgba(240, 101, 72, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
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

      {/* Control Bar 1: Island Navigation & Search Autocomplete */}
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
        {/* Island Navigation Pills */}
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

        {/* Search Input with Instant Autocomplete */}
        <div style={{ position: 'relative', minWidth: '280px' }}>
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
              {searchSuggestions.map((sug) => (
                <div
                  key={sug.id}
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
                    <strong style={{ color: '#212529', display: 'block' }}>{sug.primaryOutletName}</strong>
                    <span style={{ color: '#878a99', fontSize: '0.7rem' }}>
                      {sug.dati2} &bull; 📮 {sug.kodePos}
                    </span>
                  </div>
                  {sug.branchCount > 1 && (
                    <span
                      style={{
                        background: 'rgba(240, 101, 72, 0.1)',
                        color: '#f06548',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                      }}
                    >
                      {sug.branchCount} Cabang
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Control Bar 2: Quick Filter Pills (Outlet Types) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          flexWrap: 'wrap',
          marginBottom: '0.75rem',
          padding: '0.35rem 0.6rem',
          background: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #eef0f2',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.3rem' }}>
          <Filter size={12} color="#878a99" />
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6c757d' }}>Filter Tipe:</span>
        </div>

        {[
          { id: 'ALL', label: 'Semua Tipe Cabang' },
          { id: 'KC', label: 'Kantor Cabang (KC)' },
          { id: 'KCP', label: 'KCP' },
          { id: 'KK', label: 'Kantor Kas (KK)' },
          { id: 'MULTI_ONLY', label: '⚠️ Multi-Outlet Saja (>1 Cabang)' },
        ].map((f) => {
          const isActive = typeFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id as OutletTypeFilter)}
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                border: isActive ? '1px solid #0ab39c' : '1px solid #ced4da',
                background: isActive ? '#0ab39c' : '#ffffff',
                color: isActive ? '#ffffff' : '#495057',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {f.label}
            </button>
          );
        })}

        <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#878a99' }}>
          Menampilkan <strong style={{ color: '#212529' }}>{filteredPins.length.toLocaleString('id-ID')}</strong> titik
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
          <div ref={mapContainerRef} style={{ width: '100%', height: '520px', borderRadius: '6px' }} />

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
              <span style={{ color: '#495057', fontWeight: 600 }}>1 Cabang</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f06548', display: 'inline-block', border: '2px solid #fff' }} />
              <span style={{ color: '#495057', fontWeight: 600 }}>Multi-Cabang (&gt;1)</span>
            </div>
            <span style={{ color: '#878a99' }}>&bull; Hover untuk info cepat, klik untuk rincian</span>
          </div>
        </div>

        {/* Selected Pin Side Drawer / Detail Card */}
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
                  onClick={() => setSelectedPin(null)}
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
    </div>
  );
};
