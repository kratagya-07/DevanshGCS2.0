import SwarmTerminal from './SwarmTerminal';
import FailsafePanel from './FailsafePanel';

export default function Sidebar({ drones, followId, setFollowId, toggleArm, wsRef }) {
  return (
    <aside className="sidebar">
      <div className="legend">
        <span><i style={{ background: 'var(--accent-a)' }}></i>DRONE-01</span>
        <span><i style={{ background: 'var(--accent-b)' }}></i>DRONE-02</span>
      </div>

      <div>
        <h2>FLEET STATUS</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {Object.keys(drones).map((key) => {
            const d = drones[key];
            return (
              <div
                key={key}
                className={`drone-card ${key}`}
                style={{ opacity: followId === key ? 1 : 0.6 }}
              >
                <div className="row1" onClick={() => setFollowId(key)}>
                  <span className="name">{d.id}</span>
                  <span
                    className={`badge ${d.armed ? 'armed' : 'disarmed'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleArm(key);
                    }}
                  >
                    {d.armed ? 'ARMED' : 'DISARMED'}
                  </span>
                </div>
                <div className="grid3">
                  <div>LAT: <b>{d.lat.toFixed(5)}</b></div>
                  <div>LON: <b>{d.lon.toFixed(5)}</b></div>
                  <div>ALT: <b>{d.alt.toFixed(0)}</b>m</div>
                  
                  <div>VX: <b>{d.vx?.toFixed(1) || 0}</b></div>
                  <div>VY: <b>{d.vy?.toFixed(1) || 0}</b></div>
                  <div>VZ: <b>{d.vz?.toFixed(1) || 0}</b></div>
                  
                  <div>RLL: <b>{d.roll?.toFixed(1) || 0}</b>°</div>
                  <div>PTC: <b>{d.pitch?.toFixed(1) || 0}</b>°</div>
                  <div>YAW: <b>{d.yaw?.toFixed(1) || 0}</b>°</div>
                  
                  <div>BATT: <b>{d.batt.toFixed(0)}</b>%</div>
                  <div>SPD: <b>{d.spd.toFixed(1)}</b></div>
                  <div>HDG: <b>{d.hdg.toFixed(0)}</b>°</div>
                  <div>SATS: <b>{d.sats || 0}</b></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <FailsafePanel wsRef={wsRef} drones={drones} />

      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--panel-border)' }}>
        <SwarmTerminal />
      </div>
    </aside>
  );
}
