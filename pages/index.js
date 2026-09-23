import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import VideoFeed from '../components/VideoFeed';

const LeafletMap = dynamic(() => import('../components/LeafletMap'), { ssr: false });

const INITIAL_DRONES = {
  a: { id: 'DRONE-01', color: '#3ed6c4', lat: 28.6139, lon: 77.209, alt: 60, hdg: 0, spd: 6, batt: 96, armed: true, trail: [], vx: 0, vy: 0, vz: 0, roll: 0, pitch: 0, yaw: 0 },
  b: { id: 'DRONE-02', color: '#e3a857', lat: 28.6205, lon: 77.215, alt: 55, hdg: 90, spd: 5, batt: 91, armed: true, trail: [], vx: 0, vy: 0, vz: 0, roll: 0, pitch: 0, yaw: 0 },
};

export default function Home({ geofenceArea, zones, waypoints }) {
  const [drones, setDrones] = useState(INITIAL_DRONES);
  const [followId, setFollowId] = useState('a');
  const [baseLayer, setBaseLayer] = useState('street');
  const [cursor, setCursor] = useState(null);
  const tRef = useRef(0);

  const toggleArm = (key) => {
    setDrones((prev) => ({
      ...prev,
      [key]: { ...prev[key], armed: !prev[key].armed },
    }));
  };

  // Single place real telemetry plugs into: replace the body of this
  // interval with data coming from your WebSocket / MAVLink bridge and
  // call setDrones() the same way.
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
            vx: 5.5 * Math.cos(t / 20),
            vy: -5.5 * Math.sin(t / 20),
            vz: 0.3 * Math.cos(t / 15),
            roll: 8 * Math.sin(t / 10),
            pitch: 5 * Math.cos(t / 12),
            yaw: (t * 4) % 360,
          };
        } else {
          next.a = { ...prev.a, spd: 0, vx: 0, vy: 0, vz: 0, roll: 0, pitch: 0 };
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
            vx: 4.8 * -Math.sin(t / 25),
            vy: 4.8 * Math.cos(t / 25),
            vz: 0.2 * -Math.sin(t / 18),
            roll: -6 * Math.sin(t / 8),
            pitch: -4 * Math.cos(t / 15),
            yaw: (t * 3 + 90) % 360,
          };
        } else {
          next.b = { ...prev.b, spd: 0, vx: 0, vy: 0, vz: 0, roll: 0, pitch: 0 };
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(id);
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
        </div>

        <Sidebar drones={drones} followId={followId} setFollowId={setFollowId} toggleArm={toggleArm} />
      </main>
    </div>
  );
}
