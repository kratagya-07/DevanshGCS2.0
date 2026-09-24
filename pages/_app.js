import { useState } from 'react';
import '../styles/globals.css';
import 'leaflet/dist/leaflet.css';
import Toast from '../components/Toast';

export default function App({ Component, pageProps }) {
  const [geofenceArea, setGeofenceArea] = useState(null);
  const [zones, setZones] = useState([]);
  const [waypoints, setWaypoints] = useState({ 0: [], 1: [] });
  const [toasts, setToasts] = useState([]);

  return (
    <>
      <Component
        {...pageProps}
        geofenceArea={geofenceArea}
        setGeofenceArea={setGeofenceArea}
        zones={zones}
        setZones={setZones}
        waypoints={waypoints}
        setWaypoints={setWaypoints}
        setToasts={setToasts}
      />
      <Toast toasts={toasts} setToasts={setToasts} />
    </>
  );
}
