import React from 'react';

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
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        if (onFileUpload) onFileUpload(json);
      } catch (err) {
        console.error("Failed to parse file", err);
        alert("Invalid JSON file");
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
              accept=".json,.geojson" 
              style={{ display: 'none' }} 
              onChange={handleFileChange} 
            />
          </label>
          
          {hasGeofence && (
            <>
              <button className="upload-btn" onClick={onAutoPartition} style={{ background: 'rgba(227, 168, 87, 0.1)', borderColor: 'var(--accent-b)', color: 'var(--accent-b)' }}>
                AUTO PARTITION
              </button>
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
              <button className="upload-btn" onClick={onAutoWaypoints} style={{ background: 'rgba(62, 214, 196, 0.1)', borderColor: 'var(--accent-a)', color: 'var(--accent-a)' }}>
                AUTO WAYPOINTS
              </button>
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
