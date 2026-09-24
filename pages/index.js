import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import VideoFeed from '../components/VideoFeed';
import HUD from '../components/HUD';

const LeafletMap = dynamic(() => import('../components/LeafletMap'), { ssr: false });

// ── Default drone state ───────────────────────────────────────────────────────
// Drones start at map center so icons are visible immediately.
// When real MAVLink GPS data arrives, they move to actual positions.
// Drone key → MAVLink system-id: a → 1, b → 2
const MAP_CENTER = { lat: 28.6139, lon: 77.209 }; // map default center (also GCS position)

// ── Haversine distance (metres) ───────────────────────────────────────────────
function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in metres
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const INITIAL_DRONES = {
  a: {
    id: 'DRONE-01', color: '#3ed6c4',
    lat: MAP_CENTER.lat, lon: MAP_CENTER.lon,
    alt: 0, hdg: 0, spd: 0,
    batt: 0, armed: false, trail: [],
    vx: 0, vy: 0, vz: 0,
    roll: 0, pitch: 0, yaw: 0,
    connected: false,
  },
  b: {
    id: 'DRONE-02', color: '#e3a857',
    lat: MAP_CENTER.lat, lon: MAP_CENTER.lon,
    alt: 0, hdg: 0, spd: 0,
    batt: 0, armed: false, trail: [],
    vx: 0, vy: 0, vz: 0,
    roll: 0, pitch: 0, yaw: 0,
    connected: false,
  },
};

// ── MAVLink bridge config ─────────────────────────────────────────────────────
// Set NEXT_PUBLIC_MAVLINK_WS_URL in .env.local to override.
// Default: mavlink2rest running locally on port 8088.
const MAVLINK_WS_URL =
  process.env.NEXT_PUBLIC_MAVLINK_WS_URL || 'ws://localhost:8088/ws/mavlink';

const SYSID_MAP = { 1: 'a', 2: 'b' };

export default function Home({ geofenceArea, zones, waypoints, setToasts }) {
  const [drones, setDrones] = useState(INITIAL_DRONES);
  const [followId, setFollowId] = useState(null);
  const [baseLayer, setBaseLayer] = useState('street');
  const [cursor, setCursor] = useState(null);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [hudExpanded, setHudExpanded] = useState({ a: false, b: false });
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const toggleHud = (key) => setHudExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  const expandBoth = () => setHudExpanded({ a: true, b: true });
  const collapseBoth = () => setHudExpanded({ a: false, b: false });

  // ── Arm / Disarm via WebSocket ──────────────────────────────────────────────
  const toggleArm = (key) => {
    const drone = drones[key];
    const sysId = key === 'a' ? 1 : 2;
    const arm = drone.armed ? 0 : 1;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "ARM", sysid: sysId, arm: arm }));
    } else {
      alert("WebSocket not connected");
    }
  };

  // ── WebSocket telemetry listener ──────────────────────────────────────────
  useEffect(() => {
    let active = true;

    function connect() {
      if (!active) return;
      setWsStatus('RECONNECTING');
      const ws = new WebSocket(MAVLINK_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) return ws.close();
        setWsStatus('CONNECTED');
        console.log('[MAVLink] Connected:', MAVLINK_WS_URL);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const sysId = msg?.header?.system_id;
          const key = SYSID_MAP[sysId];
          if (!key) return;

          const type = msg?.message?.type;

          setDrones((prev) => {
            const d = prev[key];
            let updated = { ...d, connected: true };

            if (type === 'GLOBAL_POSITION_INT') {
              const m = msg.message;
              const lat = m.lat / 1e7;
              const lon = m.lon / 1e7;
              if (lat !== 0 && lon !== 0) {
                const trail = [...d.trail, [lat, lon]].slice(-300);
                updated = {
                  ...updated, lat, lon, trail,
                  alt: m.relative_alt / 1000,      // mm → m
                  hdg: m.hdg / 100,                 // cdeg → deg
                  vx: m.vx / 100,                   // cm/s → m/s
                  vy: m.vy / 100,
                  vz: m.vz / 100,
                  spd: Math.hypot(m.vx / 100, m.vy / 100),
                };
              }
            }

            if (type === 'GPS_RAW_INT') {
              updated = { ...updated, sats: msg.message.satellites_visible };
            }

            if (type === 'ATTITUDE') {
              const m = msg.message;
              updated = {
                ...updated,
                roll: (m.roll * 180) / Math.PI,
                pitch: (m.pitch * 180) / Math.PI,
                yaw: ((m.yaw * 180) / Math.PI + 360) % 360,
              };
            }

            if (type === 'SYS_STATUS') {
              updated = { ...updated, batt: msg.message.battery_remaining };
            }

            if (type === 'HEARTBEAT') {
              const armed = !!(msg.message.base_mode & 128);
              updated = { ...updated, armed };
            }

            if (type === 'STATUSTEXT') {
              const text = msg.message.text;
              if (text && (text.includes('PreArm:') || text.includes('check'))) {
                setToasts(prev => [...prev, { id: Date.now(), msg: `DRONE-${sysId} PRE-ARM: ${text}` }]);
              }
            }

            if (type === 'DISCONNECT') {
              updated = { batt:0, armed:false, trail:[], vx:0, vy:0, vz:0, roll:0, pitch:0, yaw:0, connected:false, lat:0, lon:0, alt:0, hdg:0, spd:0, sats:0 };
            }
            return { ...prev, [key]: updated };
          });
        } catch (e) {
          console.warn('[MAVLink] Parse error', e);
        }
      };

      ws.onerror = (e) => console.warn('[MAVLink] WS error', e);

      ws.onclose = () => {
        if (!active) return;
        setWsStatus('DISCONNECTED');
        setDrones((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => { next[k] = { ...next[k], connected: false }; });
          return next;
        });
        reconnectTimer.current = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      active = false;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <div className="app">
      <Header />

      <main>
        <div className="map-col">
          <LeafletMap
            drones={drones}
            followId={followId}
            baseLayer={baseLayer}
            onCursorMove={(latlng) => setCursor(latlng)}
            geofenceArea={geofenceArea}
            zones={zones}
            waypoints={waypoints}
          />
          <div className="map-toolbar">
            <button className={baseLayer === 'street' ? 'active' : ''} onClick={() => setBaseLayer('street')}>
              STREET
            </button>
            <button className={baseLayer === 'sat' ? 'active' : ''} onClick={() => setBaseLayer('sat')}>
              SATELLITE
            </button>
          </div>
          <div className="bottom-left-overlay">
            <div className="video-row">
              <VideoFeed droneId={drones.a.id} color={drones.a.color} />
              <VideoFeed droneId={drones.b.id} color={drones.b.color} />
            </div>
            <div className="coords-readout">
              {cursor ? `LAT ${cursor.lat.toFixed(5)} · LON ${cursor.lng.toFixed(5)}` : 'LAT — · LON —'}
            </div>
          </div>

          {/* HUD overlay - right bottom */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            zIndex: 900,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-end',
          }}>
            {/* Expand Both button */}
            <button
              onClick={hudExpanded.a && hudExpanded.b ? collapseBoth : expandBoth}
              title={hudExpanded.a && hudExpanded.b ? 'Collapse Both HUDs' : 'Expand Both HUDs'}
              style={{
                background: 'rgba(0,0,0,0.7)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#e2e8f0',
                borderRadius: '4px',
                padding: '3px 10px',
                fontSize: '10px',
                fontFamily: 'monospace',
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              {hudExpanded.a && hudExpanded.b ? '⊟ COLLAPSE ALL' : '⛶ EXPAND ALL HUDs'}
            </button>

            {/* Both HUDs */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'flex-end' }}>
            <HUD
                drone={drones.a}
                label={drones.a.id}
                color={drones.a.color}
                expanded={hudExpanded.a}
                onToggleExpand={() => toggleHud('a')}
                distGCS={drones.a.lat && drones.a.lon ? haversineDist(MAP_CENTER.lat, MAP_CENTER.lon, drones.a.lat, drones.a.lon) : null}
              />
              <HUD
                drone={drones.b}
                label={drones.b.id}
                color={drones.b.color}
                expanded={hudExpanded.b}
                onToggleExpand={() => toggleHud('b')}
                distGCS={drones.b.lat && drones.b.lon ? haversineDist(MAP_CENTER.lat, MAP_CENTER.lon, drones.b.lat, drones.b.lon) : null}
              />
            </div>
          </div>
        </div>

        <Sidebar drones={drones} followId={followId} setFollowId={setFollowId} toggleArm={toggleArm} wsRef={wsRef} />
      </main>
    </div>
  );
}
