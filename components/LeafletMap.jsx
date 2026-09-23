import { Fragment, useEffect } from 'react';
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

function FollowController({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.panTo(target, { animate: true, duration: 0.5 });
  }, [target, map]);
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

export default function LeafletMap({ drones, followId, baseLayer, onCursorMove, onMapClick, geofenceArea, zones, waypoints, manualLine, partitionMode, cursor }) {
  const followTarget = followId && drones && drones[followId] ? [drones[followId].lat, drones[followId].lon] : null;

  return (
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

      <FollowController target={followTarget} />
      <MapEventsHandler onMove={onCursorMove} onClick={onMapClick} />
    </MapContainer>
  );
}
