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

export const IndonesiaBranchMap: React.FC<IndonesiaBranchMapProps> = ({
  masterRows,
  selectedWilayah = 'ALL',
  onNavigateToMaster,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeRegion, setActiveRegion] = useState<keyof typeof INDONESIA_REGIONS>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPin, setSelectedPin] = useState<PlottedBranchPin | null>(null);
  const [activeBranchIndex, setActiveBranchIndex] = useState(0);

  // Compute clustered pins based on master data and selected Wilayah
  const pins = useMemo(() => {
    return clusterMasterRowsForMap(masterRows, selectedWilayah);
  }, [masterRows, selectedWilayah]);

  // Map statistics
  const stats = useMemo(() => {
    const totalBranches = pins.reduce((acc, p) => acc + p.branchCount, 0);
    const multiOutletPins = pins.filter((p) => p.branchCount > 1).length;
    return {
      totalBranches,
      uniqueSpots: pins.length,
      multiOutletPins,
    };
  }, [pins]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: INDONESIA_REGIONS.ALL.center,
        zoom: INDONESIA_REGIONS.ALL.zoom,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      // Standard crisp OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

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

  // Update Markers when pins change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // Limit rendered markers to top 1,500 if dataset is huge, prioritized by multi-outlets
    const sortedPins = [...pins].sort((a, b) => b.branchCount - a.branchCount);
    const displayPins = sortedPins.slice(0, 1200);

    displayPins.forEach((pin) => {
      const isMulti = pin.branchCount > 1;

      // Create Custom SVG DivIcon
      const iconHtml = isMulti
        ? `<div class="bni-pin-icon" style="position:relative;width:32px;height:38px;filter:drop-shadow(0 3px 6px rgba(240,101,72,0.4));">
            <svg viewBox="0 0 24 30" width="32" height="38" fill="none">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 18 12 18s12-9 12-18c0-6.63-5.37-12-12-12z" fill="#f06548"/>
              <circle cx="12" cy="11" r="7.5" fill="#ffffff"/>
            </svg>
            <span style="position:absolute;top:4px;left:0;width:32px;text-align:center;font-size:10.5px;font-weight:800;color:#f06548;font-family:sans-serif;">${pin.branchCount}</span>
          </div>`
        : `<div class="bni-pin-icon" style="width:26px;height:32px;filter:drop-shadow(0 2px 4px rgba(10,179,156,0.35));">
            <svg viewBox="0 0 24 30" width="26" height="32" fill="none">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 18 12 18s12-9 12-18c0-6.63-5.37-12-12-12z" fill="#0ab39c"/>
              <circle cx="12" cy="11" r="5" fill="#ffffff"/>
            </svg>
          </div>`;

      const customIcon = L.divIcon({
        className: 'bni-map-pin',
        html: iconHtml,
        iconSize: isMulti ? [32, 38] : [26, 32],
        iconAnchor: isMulti ? [16, 38] : [13, 32],
        popupAnchor: [0, isMulti ? -38 : -32],
      });

      const marker = L.marker([pin.lat, pin.lng], { icon: customIcon });

      // Build popup content
      const firstBranch = pin.branches[0];
      const gmapsQuery = encodeURIComponent(
        `BNI ${firstBranch['Nama Outlet']} ${firstBranch.ALAMAT || ''} ${pin.kodePos}`
      );
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${gmapsQuery}`;

      const popupHtml = `
        <div style="min-width:250px;max-width:300px;font-family:inherit;">
          <div style="background:linear-gradient(135deg, #405189 0%, #2f3e6b 100%);padding:0.75rem 0.9rem;border-radius:7px 7px 0 0;color:#ffffff;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.3rem;">
              <span style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:rgba(255,255,255,0.2);padding:0.15rem 0.45rem;border-radius:3px;">
                ${pin.wilayah || 'Wilayah BNI'}
              </span>
              <span style="font-size:0.7rem;font-weight:700;background:#0ab39c;color:#ffffff;padding:0.15rem 0.5rem;border-radius:3px;">
                📮 ${pin.kodePos}
              </span>
            </div>
            <h5 style="margin:0;font-size:0.88rem;font-weight:700;color:#ffffff;line-height:1.3;">
              ${pin.primaryOutletName}
            </h5>
            ${isMulti ? `<div style="font-size:0.7rem;color:#f7b84b;font-weight:600;margin-top:0.25rem;">⚠️ ${pin.branchCount} Cabang di Titik/Kode Pos ini</div>` : ''}
          </div>
          <div style="padding:0.8rem 0.9rem;">
            <div style="font-size:0.75rem;color:#495057;margin-bottom:0.4rem;display:flex;gap:0.4rem;">
              <span style="color:#878a99;font-weight:600;min-width:55px;">Sandi:</span>
              <strong style="color:#212529;">${firstBranch['Sandi Cabang'] || firstBranch.Sandi || '-'}</strong>
              <span style="color:#878a99;font-weight:600;margin-left:auto;">${firstBranch['Status Outlet'] || ''}</span>
            </div>
            <div style="font-size:0.75rem;color:#495057;margin-bottom:0.4rem;display:flex;gap:0.4rem;">
              <span style="color:#878a99;font-weight:600;min-width:55px;">Lokasi:</span>
              <span>${pin.dati2}</span>
            </div>
            <div style="font-size:0.73rem;color:#6c757d;line-height:1.35;margin-bottom:0.75rem;background:#f8f9fa;padding:0.4rem 0.55rem;border-radius:4px;border:1px solid #e9ebec;">
              ${pin.alamatDisplay || 'Alamat tidak terdata'}
            </div>
            <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;gap:0.45rem;width:100%;padding:0.45rem 0.75rem;background:#0ab39c;color:#ffffff;font-size:0.75rem;font-weight:600;border-radius:4px;text-decoration:none;box-shadow:0 2px 4px rgba(10,179,156,0.25);transition:all 0.15s ease;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span>Buka di Google Maps</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { closeButton: false, offset: [0, -10] });

      // When clicked, also update local panel state for rich multi-branch view
      marker.on('click', () => {
        setSelectedPin(pin);
        setActiveBranchIndex(0);
      });

      markersLayer.addLayer(marker);
    });

    // Auto fit bounds if Wilayah is selected and not ALL
    if (selectedWilayah !== 'ALL' && displayPins.length > 0) {
      const bounds = L.latLngBounds(displayPins.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [pins, selectedWilayah]);

  // Handle Quick Island Navigation
  const handleJumpRegion = (regionKey: keyof typeof INDONESIA_REGIONS) => {
    setActiveRegion(regionKey);
    const map = mapInstanceRef.current;
    if (!map) return;
    const reg = INDONESIA_REGIONS[regionKey];
    map.flyTo(reg.center, reg.zoom, { duration: 1.2 });
  };

  // Handle Search in Map
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const q = searchQuery.toLowerCase().trim();
    const foundPin = pins.find(
      (p) =>
        p.kodePos.includes(q) ||
        p.dati2.toLowerCase().includes(q) ||
        p.primaryOutletName.toLowerCase().includes(q) ||
        p.branches.some(
          (b) =>
            String(b['Sandi Cabang'] || b.Sandi || '').includes(q) ||
            String(b['Nama Outlet'] || '').toLowerCase().includes(q)
        )
    );

    if (foundPin && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([foundPin.lat, foundPin.lng], 14, { duration: 1.2 });
      setSelectedPin(foundPin);
      setActiveBranchIndex(0);
    }
  };

  // Active branch in drawer/popup
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
        padding: '1.25rem',
        background: '#ffffff',
        border: '1px solid #e9ebec',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(56, 65, 74, 0.06)',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
          borderBottom: '1px solid #eef0f2',
          paddingBottom: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(64, 81, 137, 0.12) 0%, rgba(10, 179, 156, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#405189',
              flexShrink: 0,
            }}
          >
            <Compass size={22} color="#405189" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#212529', margin: 0 }}>
                Peta Tracking Penyebaran Cabang BNI di Indonesia
              </h4>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background: 'rgba(10, 179, 156, 0.12)',
                  color: '#0ab39c',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                }}
              >
                LIVE GIS
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#878a99', margin: '0.15rem 0 0 0' }}>
              Visualisasi geospasial sebaran cabang aktif per kode pos & wilayah operasional
            </p>
          </div>
        </div>

        {/* Stats Counters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '0.35rem 0.75rem',
              background: '#f8f9fa',
              borderRadius: '6px',
              border: '1px solid #e9ebec',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <Building2 size={14} color="#405189" />
            <span style={{ fontSize: '0.74rem', color: '#6c757d' }}>Total Cabang:</span>
            <strong style={{ fontSize: '0.8rem', color: '#405189' }}>
              {stats.totalBranches.toLocaleString('id-ID')}
            </strong>
          </div>

          <div
            style={{
              padding: '0.35rem 0.75rem',
              background: '#f8f9fa',
              borderRadius: '6px',
              border: '1px solid #e9ebec',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <MapPin size={14} color="#0ab39c" />
            <span style={{ fontSize: '0.74rem', color: '#6c757d' }}>Titik Lokasi:</span>
            <strong style={{ fontSize: '0.8rem', color: '#0ab39c' }}>
              {stats.uniqueSpots.toLocaleString('id-ID')}
            </strong>
          </div>

          <div
            style={{
              padding: '0.35rem 0.75rem',
              background: 'rgba(240, 101, 72, 0.08)',
              borderRadius: '6px',
              border: '1px solid rgba(240, 101, 72, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <Layers size={14} color="#f06548" />
            <span style={{ fontSize: '0.74rem', color: '#878a99' }}>Multi-Outlet:</span>
            <strong style={{ fontSize: '0.8rem', color: '#f06548' }}>
              {stats.multiOutletPins.toLocaleString('id-ID')} Titik
            </strong>
          </div>
        </div>
      </div>

      {/* Map Control Toolbar (Quick Region Jump & Search Bar) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.65rem',
          marginBottom: '0.75rem',
        }}
      >
        {/* Island Navigation Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#878a99', marginRight: '0.2rem' }}>
            Pilih Pulau:
          </span>
          {(Object.keys(INDONESIA_REGIONS) as Array<keyof typeof INDONESIA_REGIONS>).map((key) => {
            const isActive = activeRegion === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleJumpRegion(key)}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.28rem 0.65rem',
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

        {/* Search Input for Instant Zoom */}
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            minWidth: '260px',
          }}
        >
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <Search size={13} className="search-icon-pos" />
            <input
              type="text"
              className="search-input"
              style={{ fontSize: '0.76rem', padding: '0.32rem 0.6rem 0.32rem 1.85rem', width: '100%' }}
              placeholder="Cari Kota, Outlet, atau Kode Pos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              padding: '0.32rem 0.75rem',
              fontSize: '0.74rem',
              whiteSpace: 'nowrap',
              borderRadius: '4px',
            }}
          >
            Lacak
          </button>
        </form>
      </div>

      {/* Main Map Container & Interactive Side Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedPin ? '1fr 340px' : '1fr', gap: '1rem', transition: 'all 0.2s ease' }}>
        {/* Leaflet Map */}
        <div className="bni-map-container" style={{ position: 'relative' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '520px', borderRadius: '8px' }} />

          {/* Map Legend Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(4px)',
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
              fontSize: '0.7rem',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0ab39c', display: 'inline-block' }} />
              <span style={{ color: '#495057', fontWeight: 600 }}>1 Cabang</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f06548', display: 'inline-block' }} />
              <span style={{ color: '#495057', fontWeight: 600 }}>Multi-Cabang (&gt;1)</span>
            </div>
            <span style={{ color: '#878a99' }}>| Klik pin untuk rincian</span>
          </div>
        </div>

        {/* Selected Pin Side Drawer / Detail Card */}
        {selectedPin && currentBranch && (
          <div
            style={{
              background: '#f8f9fa',
              border: '1px solid #e9ebec',
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div>
              {/* Drawer Top Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
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
                    padding: '0.5rem',
                    marginBottom: '0.85rem',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f06548', marginBottom: '0.35rem' }}>
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
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#212529', margin: '0 0 0.4rem 0', lineHeight: 1.3 }}>
                  {currentBranch['Nama Outlet']}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.65rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
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
                      fontSize: '0.7rem',
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

                <div style={{ fontSize: '0.76rem', color: '#495057', lineHeight: 1.4, marginBottom: '0.75rem' }}>
                  <div style={{ color: '#878a99', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.15rem' }}>
                    ALAMAT RESMI:
                  </div>
                  <div style={{ background: '#ffffff', padding: '0.5rem 0.65rem', borderRadius: '4px', border: '1px solid #e9ebec' }}>
                    {currentBranch.ALAMAT || 'Alamat tidak terdata'}
                  </div>
                </div>

                {/* Location attributes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.72rem', marginBottom: '0.75rem' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <a
                href={currentGmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-success"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  borderRadius: '6px',
                  boxShadow: '0 2px 4px rgba(10, 179, 156, 0.25)',
                }}
              >
                <ExternalLink size={15} />
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
                    padding: '0.4rem',
                    fontSize: '0.72rem',
                    color: '#405189',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  <span>Lihat entri ini di Tab Data Master</span>
                  <ChevronRight size={13} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
