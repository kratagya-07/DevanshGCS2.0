import { useState } from 'react';

// ── ArduPilot failsafe parameter definitions ────────────────────────────────
// Each entry maps to a real ArduPilot parameter with its possible values.
const FAILSAFE_CATEGORIES = [
  {
    id: 'batt',
    label: 'BATTERY FAILSAFE',
    icon: '🔋',
    param: 'FS_BATT_ENABLE',
    description: 'Action when battery voltage/capacity is critical',
    options: [
      { value: 0, label: 'Disabled' },
      { value: 1, label: 'Land' },
      { value: 2, label: 'RTL (Return to Launch)' },
      { value: 3, label: 'SmartRTL or RTL' },
      { value: 4, label: 'SmartRTL or Land' },
      { value: 5, label: 'Terminate' },
    ],
  },
  {
    id: 'rc',
    label: 'RC / RADIO FAILSAFE',
    icon: '📡',
    param: 'FS_THR_ENABLE',
    description: 'Action when RC signal is lost',
    options: [
      { value: 0, label: 'Disabled' },
      { value: 1, label: 'RTL (Return to Launch)' },
      { value: 2, label: 'Continue Mission' },
      { value: 3, label: 'Land' },
      { value: 4, label: 'SmartRTL or RTL' },
      { value: 5, label: 'SmartRTL or Land' },
    ],
  },
  {
    id: 'gcs',
    label: 'GCS FAILSAFE',
    icon: '🖥️',
    param: 'FS_GCS_ENABLE',
    description: 'Action when GCS heartbeat is lost',
    options: [
      { value: 0, label: 'Disabled' },
      { value: 1, label: 'RTL (Return to Launch)' },
      { value: 2, label: 'Continue Mission' },
      { value: 3, label: 'Land' },
      { value: 4, label: 'SmartRTL or RTL' },
      { value: 5, label: 'SmartRTL or Land' },
    ],
  },
  {
    id: 'ekf',
    label: 'EKF / GPS FAILSAFE',
    icon: '🛰️',
    param: 'FS_EKF_ACTION',
    description: 'Action when EKF/GPS position is unreliable',
    options: [
      { value: 0, label: 'Disabled' },
      { value: 1, label: 'Land' },
      { value: 2, label: 'AltHold' },
      { value: 3, label: 'RTL (Return to Launch)' },
    ],
  },
  {
    id: 'crash',
    label: 'CRASH CHECK',
    icon: '💥',
    param: 'FS_CRASH_CHECK',
    description: 'Action when crash is detected',
    options: [
      { value: 0, label: 'Disabled' },
      { value: 1, label: 'Disarm' },
    ],
  },
  {
    id: 'vibe',
    label: 'VIBRATION FAILSAFE',
    icon: '📳',
    param: 'FS_VIBE_ENABLE',
    description: 'Action on high vibration detection',
    options: [
      { value: 0, label: 'Disabled' },
      { value: 1, label: 'Land' },
    ],
  },
];

export default function FailsafePanel({ wsRef, drones }) {
  const [open, setOpen] = useState(false);
  const [activeDrone, setActiveDrone] = useState('a'); // which drone to configure
  const [values, setValues] = useState({
    a: Object.fromEntries(FAILSAFE_CATEGORIES.map(c => [c.id, 0])),
    b: Object.fromEntries(FAILSAFE_CATEGORIES.map(c => [c.id, 0])),
  });
  const [sending, setSending] = useState(null); // which param is currently being sent
  const [lastSent, setLastSent] = useState(null); // feedback for last sent

  const sysId = activeDrone === 'a' ? 1 : 2;
  const droneData = drones?.[activeDrone];
  const droneColor = activeDrone === 'a' ? '#3ed6c4' : '#e3a857';

  const handleChange = (catId, newValue) => {
    setValues(prev => ({
      ...prev,
      [activeDrone]: { ...prev[activeDrone], [catId]: Number(newValue) },
    }));
  };

  const sendParam = (cat) => {
    const val = values[activeDrone][cat.id];
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'PARAM_SET',
        sysid: sysId,
        param_id: cat.param,
        param_value: val,
      }));
      setSending(cat.id);
      setLastSent({ catId: cat.id, param: cat.param, val, drone: activeDrone });
      setTimeout(() => setSending(null), 800);
    } else {
      alert('WebSocket not connected');
    }
  };

  const sendAll = () => {
    FAILSAFE_CATEGORIES.forEach((cat, i) => {
      setTimeout(() => sendParam(cat), i * 200);
    });
  };

  return (
    <div className="failsafe-wrapper">
      {/* Toggle button */}
      <button
        className={`failsafe-toggle ${open ? 'active' : ''}`}
        onClick={() => setOpen(prev => !prev)}
      >
        <span className="fs-icon">⚠️</span>
        <span>FAILSAFE</span>
        <span className="fs-arrow">{open ? '▾' : '▸'}</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="failsafe-panel" style={{ borderColor: `${droneColor}44` }}>
          {/* Drone selector tabs */}
          <div className="fs-drone-tabs">
            {['a', 'b'].map(key => (
              <button
                key={key}
                className={`fs-drone-tab ${activeDrone === key ? 'active' : ''}`}
                onClick={() => setActiveDrone(key)}
                style={activeDrone === key
                  ? { borderColor: key === 'a' ? '#3ed6c4' : '#e3a857', color: key === 'a' ? '#3ed6c4' : '#e3a857' }
                  : {}
                }
              >
                <span className="fs-tab-dot" style={{ background: key === 'a' ? '#3ed6c4' : '#e3a857' }} />
                {drones?.[key]?.id || `DRONE-0${key === 'a' ? 1 : 2}`}
                {droneData?.connected && activeDrone === key && <span className="fs-connected">●</span>}
              </button>
            ))}
          </div>

          {/* Connection status */}
          <div className="fs-status" style={{ color: droneData?.connected ? '#22c55e' : '#ef4444' }}>
            {droneData?.connected ? '● CONNECTED' : '● DISCONNECTED'} — SysID {sysId}
          </div>

          {/* Failsafe categories */}
          <div className="fs-categories">
            {FAILSAFE_CATEGORIES.map(cat => (
              <div key={cat.id} className="fs-category">
                <div className="fs-cat-header">
                  <span className="fs-cat-icon">{cat.icon}</span>
                  <div className="fs-cat-info">
                    <span className="fs-cat-label">{cat.label}</span>
                    <span className="fs-cat-desc">{cat.description}</span>
                  </div>
                </div>
                <div className="fs-cat-controls">
                  <select
                    className="fs-select"
                    value={values[activeDrone][cat.id]}
                    onChange={(e) => handleChange(cat.id, e.target.value)}
                    style={{ borderColor: `${droneColor}33` }}
                  >
                    {cat.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    className={`fs-send-btn ${sending === cat.id ? 'sending' : ''}`}
                    onClick={() => sendParam(cat)}
                    disabled={!droneData?.connected}
                    style={{ background: sending === cat.id ? '#22c55e22' : undefined, borderColor: `${droneColor}55` }}
                    title={`Set ${cat.param} = ${values[activeDrone][cat.id]}`}
                  >
                    {sending === cat.id ? '✓' : 'SET'}
                  </button>
                </div>
                <div className="fs-param-name">{cat.param} = {values[activeDrone][cat.id]}</div>
              </div>
            ))}
          </div>

          {/* Send All button */}
          <button
            className="fs-send-all"
            onClick={sendAll}
            disabled={!droneData?.connected}
            style={{ borderColor: droneColor, color: droneColor }}
          >
            ⬆ UPLOAD ALL FAILSAFE TO {drones?.[activeDrone]?.id || 'DRONE'}
          </button>

          {/* Last sent feedback */}
          {lastSent && (
            <div className="fs-feedback">
              Last: {lastSent.param} = {lastSent.val} → {drones?.[lastSent.drone]?.id}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
