import React, { useState } from 'react';

export default function MissionSidebar({ 
  onFileUpload, 
  hasGeofence, 
  hasZones,
  onAutoPartition, 
  onManualPartition, 
  partitionMode,
  onAutoWaypoints,
  onClearWaypoints,
  waypointMode,
  setWaypointMode,
  hasWaypoints,
  onExecuteMission,
  onAbortMission,
  missionActive
}) {
  const [showAutoOptions, setShowAutoOptions] = useState(false);
  const [showWaypointOptions, setShowWaypointOptions] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      try {
        if (file.name.toLowerCase().endsWith('.kml')) {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, "text/xml");
          
          let coordsStr = null;
          // Try to find a Polygon explicitly
          const polygons = xmlDoc.getElementsByTagName("Polygon");
          if (polygons.length > 0) {
            const coordsNode = polygons[0].getElementsByTagName("coordinates")[0];
            if (coordsNode) coordsStr = coordsNode.textContent.trim();
          } else {
            // Fallback: Find the first coordinates block with at least 3 points
            const allCoords = xmlDoc.getElementsByTagName("coordinates");
            for (let i = 0; i < allCoords.length; i++) {
              const textContent = allCoords[i].textContent.trim();
              if (textContent.split(/\s+/).filter(Boolean).length >= 3) {
                coordsStr = textContent;
                break;
              }
            }
          }
          
          if (coordsStr) {
            const points = coordsStr.split(/\s+/).filter(Boolean).map(p => {
              const parts = p.split(',').map(Number);
              return [parts[0], parts[1]]; // lng, lat
            });
            
            const geojson = {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [points]
              }
            };
            if (onFileUpload) onFileUpload(geojson);
          } else {
            alert("No valid Polygon found in KML file.");
          }
        } else {
          const json = JSON.parse(text);
          if (onFileUpload) onFileUpload(json);
        }
      } catch (err) {
        console.error("Failed to parse file", err);
        alert("Invalid file format");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <aside className="sidebar">
      <div>
        <h2>MISSION CONTROL</h2>
        <div style={{ marginTop: '16px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label className="upload-btn">
            UPLOAD AREA FILE
            <input 
              type="file" 
              accept=".json,.geojson,.kml" 
              style={{ display: 'none' }} 
              onChange={handleFileChange} 
            />
          </label>
          
          {hasGeofence && (
            <>
              {showAutoOptions ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button className="upload-btn" onClick={() => { onAutoPartition('vertical'); setShowAutoOptions(false); }} style={{ fontSize: '10px', background: 'rgba(227, 168, 87, 0.1)', borderColor: 'var(--accent-b)', color: 'var(--accent-b)' }}>VERTICAL</button>
                  <button className="upload-btn" onClick={() => { onAutoPartition('horizontal'); setShowAutoOptions(false); }} style={{ fontSize: '10px', background: 'rgba(227, 168, 87, 0.1)', borderColor: 'var(--accent-b)', color: 'var(--accent-b)' }}>HORIZONTAL</button>
                  <button className="upload-btn" onClick={() => { onAutoPartition('diagonal1'); setShowAutoOptions(false); }} style={{ fontSize: '10px', background: 'rgba(227, 168, 87, 0.1)', borderColor: 'var(--accent-b)', color: 'var(--accent-b)' }}>DIAGONAL 1</button>
                  <button className="upload-btn" onClick={() => { onAutoPartition('diagonal2'); setShowAutoOptions(false); }} style={{ fontSize: '10px', background: 'rgba(227, 168, 87, 0.1)', borderColor: 'var(--accent-b)', color: 'var(--accent-b)' }}>DIAGONAL 2</button>
                </div>
              ) : (
                <button className="upload-btn" onClick={() => setShowAutoOptions(true)} style={{ background: 'rgba(227, 168, 87, 0.1)', borderColor: 'var(--accent-b)', color: 'var(--accent-b)' }}>
                  AUTO PARTITION OPTIONS
                </button>
              )}
              <button className="upload-btn" onClick={onManualPartition} style={{ background: partitionMode === 'drawing' ? 'rgba(224, 92, 92, 0.2)' : 'rgba(224, 92, 92, 0.1)', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                {partitionMode === 'drawing' ? 'DRAWING LINE...' : 'MANUAL PARTITION'}
              </button>
            </>
          )}
        </div>
        
        {hasZones && (
          <>
            <h2>WAYPOINT PLANNING</h2>
            <div style={{ marginTop: '16px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {showWaypointOptions ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button className="upload-btn" onClick={() => { onAutoWaypoints('vertical'); setShowWaypointOptions(false); }} style={{ fontSize: '10px', background: 'rgba(62, 214, 196, 0.1)', borderColor: 'var(--accent-a)', color: 'var(--accent-a)' }}>VERTICAL</button>
                  <button className="upload-btn" onClick={() => { onAutoWaypoints('horizontal'); setShowWaypointOptions(false); }} style={{ fontSize: '10px', background: 'rgba(62, 214, 196, 0.1)', borderColor: 'var(--accent-a)', color: 'var(--accent-a)' }}>HORIZONTAL</button>
                  <button className="upload-btn" onClick={() => { onAutoWaypoints('dense-vertical'); setShowWaypointOptions(false); }} style={{ fontSize: '10px', background: 'rgba(62, 214, 196, 0.1)', borderColor: 'var(--accent-a)', color: 'var(--accent-a)' }}>DENSE VERT</button>
                  <button className="upload-btn" onClick={() => { onAutoWaypoints('dense-horizontal'); setShowWaypointOptions(false); }} style={{ fontSize: '10px', background: 'rgba(62, 214, 196, 0.1)', borderColor: 'var(--accent-a)', color: 'var(--accent-a)' }}>DENSE HORZ</button>
                </div>
              ) : (
                <button className="upload-btn" onClick={() => setShowWaypointOptions(true)} style={{ background: 'rgba(62, 214, 196, 0.1)', borderColor: 'var(--accent-a)', color: 'var(--accent-a)' }}>
                  AUTO WAYPOINTS OPTIONS
                </button>
              )}
              <button className="upload-btn" onClick={() => setWaypointMode(waypointMode === 'drone0' ? 'idle' : 'drone0')} style={{ background: waypointMode === 'drone0' ? 'rgba(62, 214, 196, 0.2)' : 'rgba(62, 214, 196, 0.1)', borderColor: 'var(--accent-a)', color: 'var(--accent-a)' }}>
                {waypointMode === 'drone0' ? 'DRAWING D1...' : 'MANUAL D1 WAYPOINTS'}
              </button>
              <button className="upload-btn" onClick={() => setWaypointMode(waypointMode === 'drone1' ? 'idle' : 'drone1')} style={{ background: waypointMode === 'drone1' ? 'rgba(227, 168, 87, 0.2)' : 'rgba(227, 168, 87, 0.1)', borderColor: 'var(--accent-b)', color: 'var(--accent-b)' }}>
                {waypointMode === 'drone1' ? 'DRAWING D2...' : 'MANUAL D2 WAYPOINTS'}
              </button>
              <button className="upload-btn" onClick={onClearWaypoints} style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                CLEAR WAYPOINTS
              </button>
            </div>
          </>
        )}

        {hasWaypoints && (
          <>
            <h2>EXECUTION</h2>
            <div style={{ marginTop: '16px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="upload-btn" 
                onClick={onExecuteMission} 
                style={{ background: 'rgba(34, 197, 94, 0.2)', borderColor: '#22c55e', color: '#22c55e', fontWeight: 'bold' }}
                disabled={missionActive}
              >
                {missionActive ? 'MISSION ACTIVE' : 'EXECUTE MISSION'}
              </button>
            </div>
            
            {missionActive && (
              <div style={{ marginTop: '16px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.05)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#ef4444', textAlign: 'center' }}>⚠️ ABORT MISSION</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <button 
                    onClick={() => onAbortMission(6)} // RTL
                    style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    RTL
                  </button>
                  <button 
                    onClick={() => onAbortMission(9)} // LAND
                    style={{ background: '#f97316', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    LAND
                  </button>
                  <button 
                    onClick={() => onAbortMission(5)} // LOITER
                    style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    HOLD
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="note" style={{ marginTop: 0 }}>
        Upload a GeoJSON file containing a Polygon to define the operating area. The map will automatically display the geofence boundary.
      </div>
    </aside>
  );
}
