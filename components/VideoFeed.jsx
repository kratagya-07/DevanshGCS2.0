import React, { useState } from 'react';

export default function VideoFeed({ droneId, color }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`video-feed ${expanded ? 'expanded' : ''}`} style={{ borderColor: color }}>
      <div className="video-overlay">
        <span className="cam-id" style={{ color }}>{droneId} - CAM</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="expand-btn" 
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Minimize" : "Expand"}
          >
            {expanded ? '▼' : '⛶'}
          </button>
          <span className="rec-dot"></span>
        </div>
      </div>
      <div className="crosshair"></div>
      <div className="video-bg"></div>
    </div>
  );
}
