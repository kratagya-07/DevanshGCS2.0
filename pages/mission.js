import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as turf from '@turf/turf';
import Header from '../components/Header';
import MissionSidebar from '../components/MissionSidebar';

const LeafletMap = dynamic(() => import('../components/LeafletMap'), { ssr: false });

const INITIAL_DRONES = {
  a: { id: 'DRONE-01', color: '#3ed6c4', lat: 28.6139, lon: 77.209, alt: 60, hdg: 0, spd: 6, batt: 96, armed: true, trail: [] },
  b: { id: 'DRONE-02', color: '#e3a857', lat: 28.6205, lon: 77.215, alt: 55, hdg: 90, spd: 5, batt: 91, armed: true, trail: [] },
};

export default function Mission({ geofenceArea, setGeofenceArea, zones, setZones, waypoints, setWaypoints }) {
  const [drones, setDrones] = useState(INITIAL_DRONES);
  const [followId, setFollowId] = useState('a');
  const [baseLayer, setBaseLayer] = useState('street');
  const [cursor, setCursor] = useState(null);
  const [partitionMode, setPartitionMode] = useState('idle'); // 'idle', 'drawing'
  const [manualLine, setManualLine] = useState([]); // Array of 2 points [lat, lng]
  const [waypointMode, setWaypointMode] = useState('idle'); // 'idle', 'drone0', 'drone1'
  const tRef = useRef(0);

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

  const toggleArm = (key) => {
    setDrones((prev) => ({
      ...prev,
      [key]: { ...prev[key], armed: !prev[key].armed },
    }));
  };

  useEffect(() => {
    const id = setInterval(() => {
      tRef.current += 1;
      const t = tRef.current;

      setDrones((prev) => {
        const next = { ...prev };

        if (prev.a.armed) {
          const lat = 28.6139 + 0.004 * Math.sin(t / 20);
          const lon = 77.209 + 0.004 * Math.cos(t / 20);
          const trail = [...prev.a.trail, [lat, lon]].slice(-300);
          next.a = {
            ...prev.a,
            lat, lon, trail,
            alt: 60 + 5 * Math.sin(t / 15),
            hdg: (t * 4) % 360,
            spd: 5.5 + Math.sin(t / 10),
            batt: Math.max(20, 96 - t * 0.05),
          };
        } else {
          next.a = { ...prev.a, spd: 0 };
        }

        if (prev.b.armed) {
          const lat = 28.6205 + 0.003 * Math.cos(t / 25);
          const lon = 77.215 + 0.003 * Math.sin(t / 25);
          const trail = [...prev.b.trail, [lat, lon]].slice(-300);
          next.b = {
            ...prev.b,
            lat, lon, trail,
            alt: 55 + 4 * Math.cos(t / 18),
            hdg: (t * 3 + 90) % 360,
            spd: 4.8 + Math.cos(t / 12),
            batt: Math.max(20, 91 - t * 0.04),
          };
        } else {
          next.b = { ...prev.b, spd: 0 };
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(id);
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
        />
      </main>
    </div>
  );
}
