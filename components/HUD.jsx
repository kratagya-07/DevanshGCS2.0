import { useEffect, useRef } from 'react';

const DEG = Math.PI / 180;

function drawHUD(canvas, drone, label, color, W, H, distGCS, dpr = 1) {
  const cx = W / 2;
  const cy = H / 2;
  const ctx = canvas.getContext('2d');

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const roll  = drone?.roll  || 0;
  const pitch = drone?.pitch || 0;
  const hdg   = ((drone?.hdg  || 0) + 360) % 360;
  const spd   = drone?.spd   || 0;
  const alt   = drone?.alt   || 0;
  const vz    = drone?.vz    || 0;
  const batt  = drone?.batt  || 0;
  const sats  = drone?.sats  || 0;
  const armed = drone?.armed || false;
  const yaw   = drone?.yaw   || 0;
  const gspd  = Math.sqrt((drone?.vx||0)**2 + (drone?.vy||0)**2).toFixed(1);
  const pitchPx = pitch * (H / 80); // scale pitch with height

  // ── ARTIFICIAL HORIZON ─────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-roll * DEG);

  // Sky - Rich cockpit cobalt to vibrant aeronautical sky
  const skyGrad = ctx.createLinearGradient(0, -H * 2 + pitchPx, 0, pitchPx);
  skyGrad.addColorStop(0, '#0047ab'); // Cobalt Blue
  skyGrad.addColorStop(0.65, '#0066cc'); // Aviation Blue
  skyGrad.addColorStop(1, '#0284c7'); // Vivid horizon blue
  ctx.fillStyle = skyGrad;
  ctx.fillRect(-W * 2, -H * 2 + pitchPx, W * 4, H * 2);

  // Ground - Rich warm earth amber / terracotta
  const gndGrad = ctx.createLinearGradient(0, pitchPx, 0, H * 2 + pitchPx);
  gndGrad.addColorStop(0, '#b45309'); // Warm earth amber
  gndGrad.addColorStop(0.55, '#85370b'); // Terracotta
  gndGrad.addColorStop(1, '#451a03'); // Deep earth
  ctx.fillStyle = gndGrad;
  ctx.fillRect(-W * 2, pitchPx, W * 4, H * 2);

  // Horizon line - Brilliant white with shadow
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 3;
  ctx.beginPath();
  ctx.moveTo(-W * 2, pitchPx);
  ctx.lineTo(W * 2, pitchPx);
  ctx.stroke();
  ctx.restore();

  // ── PITCH LADDER ───────────────────────────────────────────────────────────
  ctx.font = `bold ${Math.max(9, W * 0.042)}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center';
  for (let deg = -40; deg <= 40; deg += 5) {
    if (deg === 0) continue;
    const y = pitchPx - deg * (H / 80);
    const isMajor = deg % 10 === 0;
    const lineW = isMajor ? W * 0.22 : W * 0.12;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = isMajor ? 2 : 1.2;

    if (deg < 0) {
      ctx.setLineDash([5, 3]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(-lineW, y);
    ctx.lineTo(lineW, y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (isMajor) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(Math.abs(deg), -lineW - W * 0.07, y + 4);
      ctx.fillText(Math.abs(deg), lineW + W * 0.07, y + 4);
    }
    ctx.restore();
  }
  ctx.restore(); // end horizon rotation

  // ── ROLL ARC ──────────────────────────────────────────────────────────────
  const arcR = Math.min(cx, cy) * 0.82;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, arcR, -150 * DEG, -30 * DEG);
  ctx.stroke();

  [0, 10, 20, 30, 45, 60].forEach(t => {
    [-1, 1].forEach(sign => {
      const angle = (-90 + sign * t) * DEG;
      const isMajor = t % 30 === 0;
      ctx.strokeStyle = t === 0 ? '#fde047' : isMajor ? '#ffffff' : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = isMajor ? 2 : 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + arcR * Math.cos(angle), cy + arcR * Math.sin(angle));
      ctx.lineTo(cx + (arcR - (isMajor ? 10 : 6)) * Math.cos(angle), cy + (arcR - (isMajor ? 10 : 6)) * Math.sin(angle));
      ctx.stroke();
    });
  });

  // Roll pointer (yellow triangle rotates)
  const triAngle = (-90 - roll) * DEG;
  const perp = triAngle + Math.PI / 2;
  const triTip = arcR;
  const triBase = arcR - 12;
  ctx.fillStyle = '#fde047';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + triTip * Math.cos(triAngle), cy + triTip * Math.sin(triAngle));
  ctx.lineTo(cx + triBase * Math.cos(triAngle) + 5 * Math.cos(perp), cy + triBase * Math.sin(triAngle) + 5 * Math.sin(perp));
  ctx.lineTo(cx + triBase * Math.cos(triAngle) - 5 * Math.cos(perp), cy + triBase * Math.sin(triAngle) - 5 * Math.sin(perp));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ── AIRCRAFT SYMBOL ────────────────────────────────────────────────────────
  const wingW = W * 0.18;
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2.8;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 4;
  ctx.beginPath(); ctx.moveTo(cx - wingW, cy); ctx.lineTo(cx - 10, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 18, cy); ctx.lineTo(cx - 18, cy + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + wingW, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 18, cy); ctx.lineTo(cx + 18, cy + 6); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, Math.PI * 2); ctx.fillStyle = '#fde047'; ctx.fill();
  ctx.strokeStyle = '#fde047'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy - 14); ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore(); // end global clip

  // ── SPEED TAPE (left) ─────────────────────────────────────────────────────
  const tapeW = Math.round(W * 0.18);
  const tapeH = H * 0.55;
  const tapePX = 4;
  const tapeCY = cy;

  ctx.fillStyle = 'rgba(5, 10, 15, 0.9)';
  ctx.fillRect(tapePX, tapeCY - tapeH / 2, tapeW, tapeH);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(tapePX, tapeCY - tapeH / 2, tapeW, tapeH);

  const boxH = Math.max(22, W * 0.08);

  for (let s = Math.floor(spd - 30); s <= Math.ceil(spd + 30); s += 5) {
    if (s < 0) continue;
    const yPos = tapeCY + (spd - s) * (tapeH / 60);
    if (yPos < tapeCY - tapeH / 2 || yPos > tapeCY + tapeH / 2) continue;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(tapePX + tapeW - 7, yPos); ctx.lineTo(tapePX + tapeW, yPos); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(8.5, W * 0.038)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(s, tapePX + tapeW - 9, yPos + 3);
  }
  ctx.fillStyle = 'rgba(4, 8, 12, 0.95)'; ctx.fillRect(tapePX, tapeCY - boxH / 2, tapeW, boxH);
  ctx.strokeStyle = '#fde047'; ctx.lineWidth = 1.8; ctx.strokeRect(tapePX, tapeCY - boxH / 2, tapeW, boxH);
  ctx.fillStyle = '#fde047'; ctx.font = `bold ${Math.max(10.5, W * 0.05)}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center'; ctx.fillText(spd.toFixed(1), tapePX + tapeW / 2, tapeCY + boxH * 0.25);
  ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.max(7.5, W * 0.034)}px "IBM Plex Mono", monospace`;
  ctx.fillText('SPD', tapePX + tapeW / 2, tapeCY - tapeH / 2 - 3);

  // ── ALTITUDE TAPE (right) ─────────────────────────────────────────────────
  const altTapeX = W - tapePX - tapeW;
  ctx.fillStyle = 'rgba(5, 10, 15, 0.9)'; ctx.fillRect(altTapeX, tapeCY - tapeH / 2, tapeW, tapeH);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 1;
  ctx.strokeRect(altTapeX, tapeCY - tapeH / 2, tapeW, tapeH);

  for (let a = Math.floor(alt - 20); a <= Math.ceil(alt + 20); a += 5) {
    const yPos = tapeCY + (alt - a) * (tapeH / 40);
    if (yPos < tapeCY - tapeH / 2 || yPos > tapeCY + tapeH / 2) continue;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(altTapeX, yPos); ctx.lineTo(altTapeX + 7, yPos); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(8.5, W * 0.038)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(a, altTapeX + 9, yPos + 3);
  }
  ctx.fillStyle = 'rgba(4, 8, 12, 0.95)'; ctx.fillRect(altTapeX, tapeCY - boxH / 2, tapeW, boxH);
  ctx.strokeStyle = color || '#3ed6c4'; ctx.lineWidth = 1.8; ctx.strokeRect(altTapeX, tapeCY - boxH / 2, tapeW, boxH);
  ctx.fillStyle = color || '#3ed6c4'; ctx.font = `bold ${Math.max(10.5, W * 0.05)}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center'; ctx.fillText(alt.toFixed(1), altTapeX + tapeW / 2, tapeCY + boxH * 0.25);
  ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.max(7.5, W * 0.034)}px "IBM Plex Mono", monospace`;
  ctx.fillText('ALT', altTapeX + tapeW / 2, tapeCY - tapeH / 2 - 3);
  const vzColor = vz < -0.3 ? '#3ed6c4' : vz > 0.3 ? '#f97316' : '#94a3b8';
  ctx.fillStyle = vzColor; ctx.font = `bold ${Math.max(8.5, W * 0.035)}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'right';
  ctx.fillText(`${vz > 0 ? '↑' : vz < 0 ? '↓' : '→'}${Math.abs(vz).toFixed(1)}`, altTapeX - 4, tapeCY + 4);

  // ── HEADING TAPE (top) ────────────────────────────────────────────────────
  const hdgH = 24;
  const hdgW = W * 0.55;
  const hdgX = cx - hdgW / 2;
  ctx.fillStyle = 'rgba(5, 10, 15, 0.9)'; ctx.fillRect(hdgX, 2, hdgW, hdgH);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 1; ctx.strokeRect(hdgX, 2, hdgW, hdgH);

  const hdgRange = 35;
  const pxPerDeg = hdgW / (hdgRange * 2);
  const cardinals = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  for (let d = -hdgRange; d <= hdgRange; d += 5) {
    const compassDeg = ((Math.round(hdg / 5) * 5 + d) + 360) % 360;
    const xPos = cx + d * pxPerDeg;
    if (xPos < hdgX || xPos > hdgX + hdgW) continue;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xPos, 2 + hdgH - 6); ctx.lineTo(xPos, 2 + hdgH); ctx.stroke();
    const card = cardinals[compassDeg];
    ctx.fillStyle = card ? '#fde047' : '#ffffff';
    ctx.font = card ? `bold ${Math.max(9.5, W * 0.042)}px "IBM Plex Mono", monospace` : `${Math.max(8.5, W * 0.035)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(card || compassDeg, xPos, 2 + 11);
  }
  const hdgBoxW = 42;
  ctx.fillStyle = 'rgba(4, 8, 12, 0.95)'; ctx.fillRect(cx - hdgBoxW / 2, 2, hdgBoxW, hdgH);
  ctx.strokeStyle = '#fde047'; ctx.lineWidth = 1.8; ctx.strokeRect(cx - hdgBoxW / 2, 2, hdgBoxW, hdgH);
  ctx.fillStyle = '#fde047'; ctx.font = `bold ${Math.max(10.5, W * 0.048)}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center'; ctx.fillText(String(Math.round(hdg)).padStart(3, '0') + '°', cx, 2 + 15);

  // ── BOTTOM STATUS BAR ──────────────────────────────────────────────────────
  const barH = 30;
  const barY = H - barH;
  ctx.fillStyle = 'rgba(4, 8, 12, 0.95)'; ctx.fillRect(0, barY, W, barH);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(W, barY); ctx.stroke();

  // Format distance from GCS
  const distVal = distGCS != null ? (distGCS < 1000 ? `${distGCS.toFixed(0)}m` : `${(distGCS / 1000).toFixed(2)}km`) : '—';
  const distCol = distGCS == null ? '#94a3b8' : distGCS < 500 ? '#22c55e' : distGCS < 2000 ? '#fde047' : '#ef4444';

  const stats = [
    { label: 'BATT', value: `${batt.toFixed(0)}%`, col: batt < 20 ? '#ef4444' : batt < 40 ? '#f97316' : '#22c55e' },
    { label: 'SATS', value: sats, col: sats < 6 ? '#ef4444' : '#22c55e' },
    { label: 'GSPD', value: gspd, col: '#f8fafc' },
    { label: 'DIST', value: distVal, col: distCol },
    { label: 'VZ', value: `${vz.toFixed(1)}`, col: vz < -0.5 ? '#3ed6c4' : vz > 0.5 ? '#f97316' : '#f8fafc' },
  ];
  const colW = (W - 44) / stats.length;
  stats.forEach((s, i) => {
    const x = colW * (i + 0.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.font = `bold ${Math.max(7.5, W * 0.032)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center'; ctx.fillText(s.label, x, barY + 10);
    ctx.fillStyle = s.col; ctx.font = `bold ${Math.max(9.5, W * 0.044)}px "IBM Plex Mono", monospace`;
    ctx.fillText(s.value, x, barY + 23);
  });
  // Armed badge
  ctx.fillStyle = armed ? '#22c55e33' : '#ef444433';
  ctx.fillRect(W - 42, barY + 2, 40, barH - 4);
  ctx.strokeStyle = armed ? '#22c55e' : '#ef4444'; ctx.lineWidth = 1.2;
  ctx.strokeRect(W - 42, barY + 2, 40, barH - 4);
  ctx.fillStyle = armed ? '#22c55e' : '#ef4444';
  ctx.font = `bold ${Math.max(8.5, W * 0.04)}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(armed ? 'ARMED' : 'DSMD', W - 22, barY + 17);

  // ── LABEL (top-left corner) ────────────────────────────────────────────────
  ctx.fillStyle = color || '#3ed6c4';
  ctx.font = `bold ${Math.max(9.5, W * 0.044)}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(label || 'DRONE', 6, H - barH - 6);

  ctx.restore(); // restore dpr scale
}

export default function HUD({ drone, label, color, expanded, onToggleExpand, distGCS, width, height, hideExpand }) {
  const canvasRef = useRef(null);

  const W = width || (expanded ? 420 : 240);
  const H = height || (expanded ? 340 : 200);

  const roll  = drone?.roll;
  const pitch = drone?.pitch;
  const hdg   = drone?.hdg;
  const spd   = drone?.spd;
  const alt   = drone?.alt;
  const vz    = drone?.vz;
  const batt  = drone?.batt;
  const sats  = drone?.sats;
  const armed = drone?.armed;
  const yaw   = drone?.yaw;
  const vx    = drone?.vx;
  const vy    = drone?.vy;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2;
    const targetW = Math.round(W * dpr);
    const targetH = Math.round(H * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width  = targetW;
      canvas.height = targetH;
    }
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    drawHUD(canvas, drone, label, color, W, H, distGCS, dpr);
  }, [roll, pitch, hdg, spd, alt, vz, batt, sats, armed, yaw, vx, vy, label, color, W, H, distGCS]);

  const accentColor = color || '#3ed6c4';

  return (
    <div style={{
      position: 'relative',
      borderRadius: '6px',
      overflow: 'hidden',
      border: `2px solid ${accentColor}55`,
      boxShadow: `0 4px 24px rgba(0,0,0,0.7), 0 0 10px ${accentColor}22`,
      background: '#000',
      transition: 'width 0.2s ease, height 0.2s ease',
    }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block' }} />

      {/* Expand / Minimize button overlay */}
      {!hideExpand && (
        <button
          onClick={onToggleExpand}
          title={expanded ? 'Minimize HUD' : 'Expand HUD'}
        style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          background: 'rgba(0,0,0,0.65)',
          border: `1px solid ${accentColor}66`,
          color: accentColor,
          borderRadius: '3px',
          width: '20px',
          height: '20px',
          fontSize: '12px',
          lineHeight: '20px',
          textAlign: 'center',
          cursor: 'pointer',
          padding: 0,
          zIndex: 10,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.9)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.65)'}
      >
        {expanded ? '⊟' : '⛶'}
      </button>
      )}
    </div>
  );
}
