import { useState } from 'react';
import SwarmTerminal from './SwarmTerminal';
import FailsafePanel from './FailsafePanel';
import HUD from './HUD';
import RoundHUD from './RoundHUD';

export default function Sidebar({ drones, followId, setFollowId, toggleArm, wsRef, haversineDist, MAP_CENTER }) {
  const [expandedHudKey, setExpandedHudKey] = useState(null);

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
            const isSelected = followId === key;
            return (
              <div
                key={key}
                className={`drone-card ${key} ${isSelected ? 'selected' : ''}`}
              >
                <div className="row1" onClick={() => setFollowId(key)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="name">{d.id}</span>
                    <span style={{ fontSize: '10px', color: d.connected ? '#22c55e' : 'var(--text-dim)', fontFamily: 'IBM Plex Mono, monospace' }}>
                      {d.connected ? '● LIVE' : '○ OFFLINE'}
                    </span>
                  </div>
                  <span
                    className={`badge ${d.armed ? 'armed' : 'disarmed'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleArm(key);
                    }}
                    title={d.armed ? 'Click to Disarm' : 'Click to Arm'}
                  >
                    {d.armed ? 'ARMED' : 'DISARMED'}
                  </span>
                </div>

                {/* Compact Telemetry flanked around Center Round HUD */}
                <div className="drone-telemetry-panel">
                  {/* Left Column: Dynamics & Power */}
                  <div className="telem-col">
                    <div className={`telem-row accent-${key}`} title="Altitude (m)">
                      <span className="telem-key">ALT</span>
                      <span className="telem-val">{d.alt != null ? `${d.alt.toFixed(1)}m` : '0m'}</span>
                    </div>
                    <div className="telem-row" title="Ground Speed (m/s)">
                      <span className="telem-key">SPD</span>
                      <span className="telem-val">{d.spd != null ? `${d.spd.toFixed(1)}` : '0.0'}</span>
                    </div>
                    <div className="telem-row" title="Vertical Speed (m/s)">
                      <span className="telem-key">VZ</span>
                      <span className="telem-val">{d.vz != null ? `${d.vz > 0 ? '+' : ''}${d.vz.toFixed(1)}` : '0.0'}</span>
                    </div>
                    <div className="telem-row" title="Heading (deg)">
                      <span className="telem-key">HDG</span>
                      <span className="telem-val">{d.hdg != null ? `${d.hdg.toFixed(0)}°` : '0°'}</span>
                    </div>
                    <div className="telem-row" title="Battery Remaining (%)">
                      <span className="telem-key">BATT</span>
                      <span
                        className="telem-val"
                        style={{ color: d.batt < 20 ? '#ef4444' : d.batt < 40 ? '#f97316' : '#22c55e' }}
                      >
                        {d.batt != null ? `${d.batt.toFixed(0)}%` : '0%'}
                      </span>
                    </div>
                    <div className="telem-row" title="Satellites Visible">
                      <span className="telem-key">SATS</span>
                      <span className="telem-val">{d.sats || 0}</span>
                    </div>
                  </div>

                  {/* Center: Round Shape HUD */}
                  <div className="round-hud-wrapper">
                    <RoundHUD
                      drone={d}
                      color={d.color}
                      size={130}
                      onExpand={() => setExpandedHudKey(key)}
                    />
                  </div>

                  {/* Right Column: Position & Attitude */}
                  <div className="telem-col">
                    <div className="telem-row" title="Latitude">
                      <span className="telem-key">LAT</span>
                      <span className="telem-val">{d.lat != null ? d.lat.toFixed(5) : '0.00000'}</span>
                    </div>
                    <div className="telem-row" title="Longitude">
                      <span className="telem-key">LON</span>
                      <span className="telem-val">{d.lon != null ? d.lon.toFixed(5) : '0.00000'}</span>
                    </div>
                    <div className="telem-row" title="Roll (deg)">
                      <span className="telem-key">RLL</span>
                      <span className="telem-val">
                        {d.roll != null ? `${d.roll >= 0 ? '+' : ''}${d.roll.toFixed(1)}°` : '0.0°'}
                      </span>
                    </div>
                    <div className="telem-row" title="Pitch (deg)">
                      <span className="telem-key">PTC</span>
                      <span className="telem-val">
                        {d.pitch != null ? `${d.pitch >= 0 ? '+' : ''}${d.pitch.toFixed(1)}°` : '0.0°'}
                      </span>
                    </div>
                    <div className="telem-row" title="Yaw (deg)">
                      <span className="telem-key">YAW</span>
                      <span className="telem-val">
                        {d.yaw != null ? `${d.yaw.toFixed(1)}°` : '0.0°'}
                      </span>
                    </div>
                    <div className="telem-row" title="Horizontal Velocity (m/s)">
                      <span className="telem-key">VXY</span>
                      <span className="telem-val">
                        {Math.hypot(d.vx || 0, d.vy || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Modal HUD */}
      {expandedHudKey && drones[expandedHudKey] && (
        <div className="hud-modal-backdrop" onClick={() => setExpandedHudKey(null)}>
          <div className="hud-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="hud-modal-header">
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '13px',
                  color: drones[expandedHudKey].color,
                  fontFamily: 'IBM Plex Mono, monospace',
                  letterSpacing: '1px',
                }}
              >
                {drones[expandedHudKey].id} — PRIMARY FLIGHT DISPLAY (PFD)
              </span>
              <button className="hud-modal-close" onClick={() => setExpandedHudKey(null)}>
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <HUD
                drone={drones[expandedHudKey]}
                label={drones[expandedHudKey].id}
                color={drones[expandedHudKey].color}
                expanded={true}
                hideExpand={true}
                width={480}
                height={350}
                distGCS={
                  haversineDist && MAP_CENTER && drones[expandedHudKey].lat && drones[expandedHudKey].lon
                    ? haversineDist(
                        MAP_CENTER.lat,
                        MAP_CENTER.lon,
                        drones[expandedHudKey].lat,
                        drones[expandedHudKey].lon
                      )
                    : null
                }
              />
            </div>
          </div>
        </div>
      )}

      <FailsafePanel wsRef={wsRef} drones={drones} />

      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--panel-border)' }}>
        <SwarmTerminal />
      </div>
    </aside>
  );
}
