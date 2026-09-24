import React, { useState, useEffect, useRef } from 'react';

const MESSAGES = [
  "[DRONE-01] -> [DRONE-02]: Pos sync ok",
  "[DRONE-02] -> [DRONE-01]: ACK pos, maintaining gap",
  "[DRONE-01]: Adjusting yaw for wind comp",
  "[DRONE-02]: Collision vector clear",
  "[DRONE-01] -> [BASE]: Sending telemetry burst",
  "[DRONE-02] -> [DRONE-01]: Route waypoint 4 reached",
  "[DRONE-01]: Scanning terrain...",
  "[DRONE-02]: Battery draw nominal",
  "[DRONE-01] -> [DRONE-02]: Mesh signal strength 98%",
];

export default function SwarmTerminal() {
  const [logs, setLogs] = useState([]);
  const endRef = useRef(null);

  useEffect(() => {
    // Initial startup sequence
    setLogs([
      "SYSTEM BOOT",
      "ESTABLISHING MESH NETWORK...",
      "MESH CONNECTED: 2 NODES",
      "HANDSHAKE COMPLETE",
    ]);

    const interval = setInterval(() => {
      const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      const timestamp = new Date().toISOString().substring(11, 19);
      setLogs(prev => {
        const next = [...prev, `[${timestamp}] ${msg}`];
        if (next.length > 50) return next.slice(next.length - 50);
        return next;
      });
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = endRef.current?.parentElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="swarm-terminal">
      <div className="terminal-header">SWARM COMMS LINK (M2M)</div>
      <div className="terminal-content">
        {logs.map((log, i) => (
          <div key={i} className="terminal-line">{log}</div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
