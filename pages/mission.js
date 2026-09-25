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
  const [missionActive, setMissionActive] = useState(false);
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

  const handleAutoPartition = (type = 'vertical') => {
    if (!geofenceArea) return;
    const poly = getTurfPoly(geofenceArea);
    const box = turf.bbox(poly);
    
    // add padding to box to ensure it fully covers the polygon
    const minX = box[0] - 10, minY = box[1] - 10, maxX = box[2] + 10, maxY = box[3] + 10;
    const midX = (box[0] + box[2]) / 2;
    const midY = (box[1] + box[3]) / 2;
    
    let cutterCoords;
    if (type === 'vertical') {
      cutterCoords = [
        [minX, minY],
        [midX, minY],
        [midX, maxY],
        [minX, maxY],
        [minX, minY]
      ];
    } else if (type === 'horizontal') {
      cutterCoords = [
        [minX, minY],
        [maxX, minY],
        [maxX, midY],
        [minX, midY],
        [minX, minY]
      ];
    } else if (type === 'diagonal1') {
      // Top-Left to Bottom-Right split
      // Cut with a triangle
      cutterCoords = [
        [minX, maxY],
        [maxX, minY],
        [minX, minY],
        [minX, maxY]
      ];
    } else if (type === 'diagonal2') {
      // Bottom-Left to Top-Right split
      cutterCoords = [
        [minX, minY],
        [maxX, maxY],
        [maxX, minY],
        [minX, minY]
      ];
    }

    const cutter = turf.polygon([cutterCoords]);
    splitAndSetZones(cutter);
  };

  const handleManualPartition = () => {
    setPartitionMode('drawing');
    setManualLine([]);
  };

  const handleAutoWaypoints = (pattern = 'vertical') => {
    if (!zones || zones.length !== 2) return;
    const newWaypoints = { 0: [], 1: [] };
    
    zones.forEach((zone, index) => {
      const poly = getTurfPoly(zone);
      let safePoly = poly;
      try {
        // Create a 1 meter inward buffer from partition/geofence
        const buffered = turf.buffer(poly, -1, { units: 'meters' });
        if (buffered && buffered.geometry) {
          safePoly = buffered;
        } else if (buffered && buffered.features && buffered.features.length > 0) {
          safePoly = buffered.features[0];
        }
      } catch (e) {
        console.warn('Buffer failed, using original polygon', e);
      }

      const bbox = turf.bbox(safePoly);
      const numLines = pattern.startsWith('dense') ? 6 : 2; // 2 lines = ~4 waypoints
      let dir = 1;

      if (pattern.includes('vertical')) {
        const stepX = (bbox[2] - bbox[0]) / (numLines + 1);
        for (let i = 1; i <= numLines; i++) {
          const x = bbox[0] + stepX * i;
          let insidePts = [];
          const stepsY = 50; // sample resolution along line
          const stepY = (bbox[3] - bbox[1]) / stepsY;
          for (let j = 0; j <= stepsY; j++) {
            const y = bbox[1] + stepY * j;
            if (turf.booleanPointInPolygon(turf.point([x, y]), safePoly)) {
              insidePts.push([y, x]); // leafet lat,lng
            }
          }
          if (insidePts.length > 0) {
            // Only keep the edges of the area (first and last valid points)
            let linePts = [insidePts[0], insidePts[insidePts.length - 1]];
            if (insidePts.length === 1) linePts = [insidePts[0]];
            if (dir === -1) linePts.reverse();
            newWaypoints[index].push(...linePts);
            dir *= -1;
          }
        }
      } else {
        // horizontal sweep
        const stepY = (bbox[3] - bbox[1]) / (numLines + 1);
        for (let i = 1; i <= numLines; i++) {
          const y = bbox[1] + stepY * i;
          let insidePts = [];
          const stepsX = 50;
          const stepX = (bbox[2] - bbox[0]) / stepsX;
          for (let j = 0; j <= stepsX; j++) {
            const x = bbox[0] + stepX * j;
            if (turf.booleanPointInPolygon(turf.point([x, y]), safePoly)) {
              insidePts.push([y, x]);
            }
          }
          if (insidePts.length > 0) {
            let linePts = [insidePts[0], insidePts[insidePts.length - 1]];
            if (insidePts.length === 1) linePts = [insidePts[0]];
            if (dir === -1) linePts.reverse();
            newWaypoints[index].push(...linePts);
            dir *= -1;
          }
        }
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
      let safePoly = poly;
      try {
        const buffered = turf.buffer(poly, -1, { units: 'meters' });
        if (buffered && buffered.geometry) {
          safePoly = buffered;
        } else if (buffered && buffered.features && buffered.features.length > 0) {
          safePoly = buffered.features[0];
        }
      } catch (e) {
        console.warn('Buffer failed, using original polygon', e);
      }
      
      const pt = turf.point([latlng.lng, latlng.lat]);
      
      if (turf.booleanPointInPolygon(pt, safePoly)) {
        setWaypoints(prev => ({
          ...prev,
          [droneIdx]: [...prev[droneIdx], [latlng.lat, latlng.lng]]
        }));
      } else {
        alert(`Invalid Point! Must be at least 1 meter away from the boundaries of Drone ${droneIdx + 1}'s zone.`);
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
    setMissionActive(true);
    // TODO: Send waypoints to drones via WebSocket or REST API
  };

  // ── Abort Mission ────────────────────────────────────────────────────────────
  // ArduCopter flight mode numbers:
  //   6 = RTL, 9 = LAND, 5 = LOITER, 16 = POSHOLD, 4 = GUIDED
  const handleAbortMission = (mode = 6) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Send to both drones
      [1, 2].forEach(sysid => {
        wsRef.current.send(JSON.stringify({ action: 'SET_MODE', sysid, mode }));
      });
      const modeNames = { 6: 'RTL', 9: 'LAND', 5: 'LOITER', 16: 'POSHOLD' };
      setMissionActive(false);
      setToasts(prev => [...prev, { id: Date.now(), msg: `⚠️ MISSION ABORTED → ${modeNames[mode] || 'MODE ' + mode}` }]);
    } else {
      alert('WebSocket not connected');
    }
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
          onAbortMission={handleAbortMission}
          missionActive={missionActive}
        />
      </main>
    </div>
  );
}
