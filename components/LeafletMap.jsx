import { Fragment, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

function droneIcon(color, hdg) {
  return L.divIcon({
    className: '',
    html: `<div class="drone-icon" style="width:26px;height:26px; transform:rotate(${hdg}deg);">
             <svg width="26" height="26" viewBox="0 0 26 26">
               <polygon points="13,2 20,22 13,17 6,22" fill="${color}" stroke="#0a0f14" stroke-width="1"/>
             </svg>
           </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function FollowController({ target, followId }) {
  const map = useMap();
  const prevFollowId = useRef(null);

  useEffect(() => {
    // Only pan when the user explicitly changes which drone to follow
    if (followId && target && followId !== prevFollowId.current) {
      prevFollowId.current = followId;
      map.panTo(target, { animate: true, duration: 0.5 });
    }
    // If followId is cleared, reset so next selection works
    if (!followId) {
      prevFollowId.current = null;
    }
  }, [followId, map]);
  return null;
}

function MapEventsHandler({ onMove, onClick }) {
  useMapEvents({
    mousemove(e) {
      if (onMove) onMove(e.latlng);
    },
    click(e) {
      if (onClick) onClick(e.latlng);
    }
  });
  return null;
}

// Captures the map instance and stores it in a ref
function MapRefCapture({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

// Search bar rendered OUTSIDE MapContainer — no Leaflet event interference
function SearchOverlay({ mapRef }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const doSearch = async (val) => {
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val.trim())}&limit=6`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      setResults(data || []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => doSearch(val), 450);
  };

  const handleSelect = (r) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const map = mapRef.current;
    if (map) {
      map.flyTo([lat, lon], 15, { animate: true, duration: 1.5 });
    }
    const label = r.display_name.split(',').slice(0, 2).join(', ');
    setQuery(label);
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current && inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setResults([]); }
    if (e.key === 'Enter' && results.length > 0) handleSelect(results[0]);
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'absolute',
        top: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: '340px',
        fontFamily: "'Space Grotesk', sans-serif",
        pointerEvents: 'all',
      }}
    >
      {/* Input row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(10, 15, 20, 0.93)',
        border: `1px solid ${open && results.length > 0 ? 'rgba(62,214,196,0.65)' : 'rgba(62,214,196,0.32)'}`,
        borderRadius: open && results.length > 0 ? '10px 10px 0 0' : '10px',
        padding: '9px 13px',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 4px 22px rgba(0,0,0,0.65)',
        transition: 'border-color 0.2s, border-radius 0.12s',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke={loading ? '#e3a857' : '#3ed6c4'} strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search any location..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#dceef5', fontSize: '13px', letterSpacing: '0.4px', fontFamily: 'inherit',
          }}
        />
        {loading && (
          <div style={{
            width: '14px', height: '14px', flexShrink: 0,
            border: '2px solid rgba(62,214,196,0.2)',
            borderTop: '2px solid #3ed6c4',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}/>
        )}
        {query.length > 0 && !loading && (
          <button
            onClick={handleClear}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '50%',
              width: '20px', height: '20px', flexShrink: 0,
              cursor: 'pointer', color: '#8aabb8', fontSize: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: 0, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,92,92,0.28)'; e.currentTarget.style.color = '#e05c5c'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#8aabb8'; }}
          >✕</button>
        )}
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <ul style={{
          listStyle: 'none', margin: 0, padding: 0,
          background: 'rgba(10,15,20,0.97)',
          border: '1px solid rgba(62,214,196,0.35)',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.65)',
          overflow: 'hidden',
          maxHeight: '270px', overflowY: 'auto',
        }}>
          {results.map((r, i) => {
            const parts = r.display_name.split(',');
            const primary = parts.slice(0, 2).join(',').trim();
            const secondary = parts.slice(2, 5).join(',').trim();
            return (
              <li key={r.place_id}
                onClick={() => handleSelect(r)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(62,214,196,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#3ed6c4"
                  style={{ marginTop: '3px', flexShrink: 0 }}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
                </svg>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#dceef5', fontSize: '12.5px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {primary}
                  </div>
                  {secondary && (
                    <div style={{ color: '#4d7080', fontSize: '11px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {secondary}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open && !loading && query.trim() && results.length === 0 && (
        <div style={{
          background: 'rgba(10,15,20,0.97)',
          border: '1px solid rgba(62,214,196,0.2)',
          borderTop: 'none', borderRadius: '0 0 10px 10px',
          padding: '14px', color: '#4d7080', fontSize: '12px',
          textAlign: 'center', backdropFilter: 'blur(18px)',
        }}>
          No locations found
        </div>
      )}
    </div>
  );
}

export default function LeafletMap({ drones, followId, baseLayer, onCursorMove, onMapClick, geofenceArea, zones, waypoints, manualLine, partitionMode, cursor }) {
  const followTarget = followId && drones && drones[followId] ? [drones[followId].lat, drones[followId].lon] : null;
  const mapRef = useRef(null);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={[28.6139, 77.209]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl
        attributionControl
      >
        {baseLayer === 'street' ? (
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            attribution="&copy; OpenStreetMap contributors"
          />
        ) : (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            attribution="Tiles &copy; Esri"
          />
        )}

        {Object.keys(drones || {}).map((key) => {
          const d = drones[key];
          return (
            <Fragment key={key}>
              <Marker position={[d.lat, d.lon]} icon={droneIcon(d.color, d.hdg)} />
              <Polyline positions={d.trail} pathOptions={{ color: d.color, weight: 2, opacity: 0.7 }} />
            </Fragment>
          );
        })}

        {(!zones || zones.length === 0) && geofenceArea && (
          <Polygon
            positions={geofenceArea}
            pathOptions={{ color: '#e05c5c', fillColor: '#e05c5c', fillOpacity: 0.15, weight: 2, dashArray: '5, 5' }}
          />
        )}

        {zones && zones.length > 0 && (
          <>
            <Polygon positions={zones[0]} pathOptions={{ color: '#3ed6c4', fillColor: '#3ed6c4', fillOpacity: 0.2, weight: 2 }} />
            {zones.length > 1 && (
              <Polygon positions={zones[1]} pathOptions={{ color: '#e3a857', fillColor: '#e3a857', fillOpacity: 0.2, weight: 2 }} />
            )}
          </>
        )}

        {partitionMode === 'drawing' && (
          <>
            {manualLine && manualLine.length > 0 && <Marker position={manualLine[0]} />}
            {manualLine && manualLine.length === 1 && cursor && (
              <Polyline positions={[manualLine[0], [cursor.lat, cursor.lng]]} pathOptions={{ color: '#fff', weight: 2, dashArray: '4, 4' }} />
            )}
          </>
        )}

        {waypoints && waypoints[0] && waypoints[0].length > 0 && (
          <>
            <Polyline positions={waypoints[0]} pathOptions={{ color: '#3ed6c4', weight: 2 }} />
            {waypoints[0].map((pt, i) => (
              <CircleMarker key={`wp0-${i}`} center={pt} radius={4} pathOptions={{ color: '#3ed6c4', fillColor: '#131e24', fillOpacity: 1, weight: 2 }} />
            ))}
          </>
        )}

        {waypoints && waypoints[1] && waypoints[1].length > 0 && (
          <>
            <Polyline positions={waypoints[1]} pathOptions={{ color: '#e3a857', weight: 2 }} />
            {waypoints[1].map((pt, i) => (
              <CircleMarker key={`wp1-${i}`} center={pt} radius={4} pathOptions={{ color: '#e3a857', fillColor: '#131e24', fillOpacity: 1, weight: 2 }} />
            ))}
          </>
        )}

        <FollowController target={followTarget} followId={followId} />
        <MapEventsHandler onMove={onCursorMove} onClick={onMapClick} />
        <MapRefCapture mapRef={mapRef} />
      </MapContainer>

      {/* Search bar is OUTSIDE MapContainer — no Leaflet interference */}
      <SearchOverlay mapRef={mapRef} />
    </div>
  );
}
