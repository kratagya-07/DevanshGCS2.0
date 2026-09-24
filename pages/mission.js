import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as turf from '@turf/turf';
import Header from '../components/Header';
import MissionSidebar from '../components/MissionSidebar';

const LeafletMap = dynamic(() => import('../components/LeafletMap'), { ssr: false });

// ── Default drone state ───────────────────────────────────────────────────────
// Drones start at map center so icons are visible immediately.
// When real MAVLink GPS data arrives, they move to actual positions.
const MAP_CENTER = { lat: 28.6139, lon: 77.209 };

const INITIAL_DRONES = {
  a: {
    id: 'DRONE-01', color: '#3ed6c4',
    lat: MAP_CENTER.lat, lon: MAP_CENTER.lon,
    alt: 0, hdg: 0, spd: 0,
    batt: 0, armed: false, trail: [],
    connected: false,
  },
  b: {
    id: 'DRONE-02', color: '#e3a857',
    lat: MAP_CENTER.lat, lon: MAP_CENTER.lon,
    alt: 0, hdg: 0, spd: 0,
    batt: 0, armed: false, trail: [],
    connected: false,
  },
};

// ── MAVLink bridge config ─────────────────────────────────────────────────────
const MAVLINK_WS_URL =
  process.env.NEXT_PUBLIC_MAVLINK_WS_URL || 'ws://localhost:8088/ws/mavlink';

const SYSID_MAP = { 1: 'a', 2: 'b' };

export default function Mission({ geofenceArea, setGeofenceArea, zones, setZones, waypoints, setWaypoints, setToasts }) {
  const [drones, setDrones] = useState(INITIAL_DRONES);
  const [followId, setFollowId] = useState(null);
  const [baseLayer, setBaseLayer] = useState('street');
  const [cursor, setCursor] = useState(null);
  const [partitionMode, setPartitionMode] = useState('idle'); // 'idle', 'drawing'
  const [manualLine, setManualLine] = useState([]); // Array of 2 points [lat, lng]
  const [waypointMode, setWaypointMode] = useState('idle'); // 'idle', 'drone0', 'drone1'
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const handleFileUpload = (geojson) => {
    try {
      let coords = null;
      if (geojson.type === 'FeatureCollection') {
        const feature = geojson.features.find(f => f.geometry && f.geometry.type === 'Polygon');
        if (feature) coords = feature.geometry.coordinates;
      } else if (geojson.type === 'Feature' && geojson.geometry && geojson.geometry.type === 'Polygon') {
        coords = geojson.geometry.coordinates;
      } else if (geojson.type === 'Polygon') {
        coords = geojson.coordinates;
      }

      if (coords && coords.length > 0) {
        const leafletCoords = coords[0].map(coord => [coord[1], coord[0]]);
        setGeofenceArea(leafletCoords);
        setZones([]);
        setPartitionMode('idle');
        setManualLine([]);
        setWaypoints({ 0: [], 1: [] });
        setWaypointMode('idle');
      } else {
        alert("No valid Polygon found in the uploaded file.");
      }
    } catch (e) {
      console.error("Error processing GeoJSON:", e);
      alert("Error processing the GeoJSON file.");
    }
  };

  const getTurfPoly = (leafletCoords) => {
    let c = leafletCoords.map(pt => [pt[1], pt[0]]);
    if (c[0][0] !== c[c.length-1][0] || c[0][1] !== c[c.length-1][1]) c.push([...c[0]]);
    return turf.polygon([c]);
  };

  const splitAndSetZones = (cutterPoly) => {
    try {
      const poly = getTurfPoly(geofenceArea);
      const fc1 = turf.featureCollection([poly, cutterPoly]);
      const intersection = turf.intersect(fc1);
      const difference = turf.difference(fc1);

      const newZones = [];
      if (intersection && intersection.geometry) {
        let geom = intersection.geometry;
        if (geom.type === 'Polygon') newZones.push(geom.coordinates[0].map(c => [c[1], c[0]]));
        else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => newZones.push(p[0].map(c => [c[1], c[0]])));
      }
      if (difference && difference.geometry) {
        let geom = difference.geometry;
        if (geom.type === 'Polygon') newZones.push(geom.coordinates[0].map(c => [c[1], c[0]]));
        else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => newZones.push(p[0].map(c => [c[1], c[0]])));
      }
      
      if (newZones.length >= 2) {
        setZones([newZones[0], newZones[1]]);
      } else {
        alert("The split line did not divide the polygon correctly.");
      }
    } catch (e) {
      console.error(e);
      alert("Partition failed.");
    }
  };

  const handleAutoPartition = () => {
    if (!geofenceArea) return;
    const poly = getTurfPoly(geofenceArea);
    const box = turf.bbox(poly);
    const midX = (box[0] + box[2]) / 2;
    const cutter = turf.polygon([[
      [box[0] - 10, box[1] - 10],
      [midX, box[1] - 10],
      [midX, box[3] + 10],
      [box[0] - 10, box[3] + 10],
      [box[0] - 10, box[1] - 10]
    ]]);
    splitAndSetZones(cutter);
  };

  const handleManualPartition = () => {
    setPartitionMode('drawing');
    setManualLine([]);
  };

  const handleAutoWaypoints = () => {
    if (!zones || zones.length !== 2) return;
    const newWaypoints = { 0: [], 1: [] };
    
    zones.forEach((zone, index) => {
      const poly = getTurfPoly(zone);
      const bbox = turf.bbox(poly);
      
      const stepX = (bbox[2] - bbox[0]) / 6;
      const stepY = (bbox[3] - bbox[1]) / 6;
      
      let dir = 1;
      for (let x = bbox[0] + stepX/2; x <= bbox[2]; x += stepX) {
        let colPts = [];
        for (let y = bbox[1] + stepY/2; y <= bbox[3]; y += stepY) {
          const pt = turf.point([x, y]);
          if (turf.booleanPointInPolygon(pt, poly)) {
            colPts.push([y, x]);
          }
        }
        if (dir === -1) colPts.reverse();
        newWaypoints[index].push(...colPts);
        dir *= -1;
      }
    });
    setWaypoints(newWaypoints);
    setWaypointMode('idle');
  };

  const handleClearWaypoints = () => {
    setWaypoints({ 0: [], 1: [] });
    setWaypointMode('idle');
  };

  const handleMapClick = (latlng) => {
    if (partitionMode === 'drawing') {
      const newLine = [...manualLine, [latlng.lat, latlng.lng]];
      setManualLine(newLine);
      if (newLine.length === 2) {
        setPartitionMode('idle');
        
        const pt1 = [newLine[0][1], newLine[0][0]];
        const pt2 = [newLine[1][1], newLine[1][0]];
        const dx = pt2[0] - pt1[0];
        const dy = pt2[1] - pt1[1];
        
        const nx = -dy * 1000;
        const ny = dx * 1000;
        
        const ext1 = [pt1[0] + dx * 1000, pt1[1] + dy * 1000];
        const ext2 = [pt1[0] - dx * 1000, pt1[1] - dy * 1000];
        
        const cutter = turf.polygon([[
          ext1,
          ext2,
          [ext2[0] + nx, ext2[1] + ny],
          [ext1[0] + nx, ext1[1] + ny],
          ext1
        ]]);
        
        splitAndSetZones(cutter);
      }
      return;
    }

    if (waypointMode === 'drone0' || waypointMode === 'drone1') {
      const droneIdx = waypointMode === 'drone0' ? 0 : 1;
      if (!zones || zones.length !== 2) return;
      
      const poly = getTurfPoly(zones[droneIdx]);
      const pt = turf.point([latlng.lng, latlng.lat]);
      
      if (turf.booleanPointInPolygon(pt, poly)) {
        setWaypoints(prev => ({
          ...prev,
          [droneIdx]: [...prev[droneIdx], [latlng.lat, latlng.lng]]
        }));
      } else {
        alert(`Invalid Point! Must be within Drone ${droneIdx + 1}'s zone.`);
      }
    }
  };

  const handleCursorMove = (latlng) => {
    setCursor(latlng);
  };

  const handleExecuteMission = () => {
    if (!waypoints || (!waypoints[0].length && !waypoints[1].length)) {
      alert("No waypoints to execute!");
      return;
    }
    alert("Mission Executing! (Waypoints sent to drones...)");
    // TODO: Send waypoints to drones via WebSocket or REST API
  };

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
                  alt: m.relative_alt / 1000,
                  hdg: m.hdg / 100,
                  vx: m.vx / 100,
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
      <Header activeTab="mission" />

      <main>
        <div className="map-col">
          <LeafletMap
            drones={drones}
            followId={followId}
            baseLayer={baseLayer}
            onCursorMove={handleCursorMove}
            onMapClick={handleMapClick}
            geofenceArea={geofenceArea}
            zones={zones}
            waypoints={waypoints}
            manualLine={manualLine}
            partitionMode={partitionMode}
            cursor={cursor}
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
            <div className="coords-readout">
              {cursor ? `LAT ${cursor.lat.toFixed(5)} · LON ${cursor.lng.toFixed(5)}` : 'LAT — · LON —'}
            </div>
          </div>
        </div>

        <MissionSidebar 
          onFileUpload={handleFileUpload} 
          hasGeofence={!!geofenceArea}
          hasZones={zones && zones.length === 2}
          onAutoPartition={handleAutoPartition}
          onManualPartition={handleManualPartition}
          partitionMode={partitionMode}
          onAutoWaypoints={handleAutoWaypoints}
          onClearWaypoints={handleClearWaypoints}
          waypointMode={waypointMode}
          setWaypointMode={setWaypointMode}
          hasWaypoints={waypoints && (waypoints[0].length > 0 || waypoints[1].length > 0)}
          onExecuteMission={handleExecuteMission}
        />
      </main>
    </div>
  );
}
