import { useEffect, useRef } from 'react';

const DEG = Math.PI / 180;

/**
 * RoundHUD - A circular aviation-grade Attitude Director Indicator (ADI) / Artificial Horizon
 * Designed to fit compactly between drone telemetry data columns.
 */
function drawRoundHUD(canvas, drone, color, size) {
  const ctx = canvas.getContext('2d');
  const dpr = typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2;

  // Set high-DPI canvas buffer (supersampled for razor-sharp rendering)
  const targetBuffer = Math.round(size * dpr);
  if (canvas.width !== targetBuffer || canvas.height !== targetBuffer) {
    canvas.width = targetBuffer;
    canvas.height = targetBuffer;
  }

  ctx.save();
  ctx.clearRect(0, 0, targetBuffer, targetBuffer);
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const rollR = outerR - 4;
  const innerR = outerR - 12;

  const roll  = drone?.roll  || 0;
  const pitch = drone?.pitch || 0;
  const hdg   = ((drone?.hdg  || 0) + 360) % 360;
  const accentColor = color || '#3ed6c4';

  // ── 1. Outer Dark Instrument Bezel with Ambient Glow ────────────────────────
  const bezelGrad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  bezelGrad.addColorStop(0, '#16222f');
  bezelGrad.addColorStop(0.7, '#0e1620');
  bezelGrad.addColorStop(1, '#070c10');
  ctx.fillStyle = bezelGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();

  // Outer bezel border with vivid accent ring
  ctx.save();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.6;
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Inner bezel groove
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR - 1.5, 0, Math.PI * 2);
  ctx.stroke();

  // ── 2. Roll Scale (Top Arc) ────────────────────────────────────────────────
  // Roll arc line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, rollR, -150 * DEG, -30 * DEG);
  ctx.stroke();

  // Roll tick marks: 0, 10, 20, 30, 45, 60 degrees bank
  const rollTicks = [0, 10, 20, 30, 45, 60];
  rollTicks.forEach((t) => {
    [-1, 1].forEach((sign) => {
      if (t === 0 && sign === -1) return; // avoid duplicate 0
      const angle = (-90 + sign * t) * DEG;
      const isMajor = t === 0 || t === 30 || t === 60;
      const tickLen = isMajor ? 5.5 : 3.5;

      ctx.strokeStyle = t === 0 ? '#fde047' : isMajor ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = isMajor ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + rollR * Math.cos(angle), cy + rollR * Math.sin(angle));
      ctx.lineTo(
        cx + (rollR - tickLen) * Math.cos(angle),
        cy + (rollR - tickLen) * Math.sin(angle)
      );
      ctx.stroke();
    });
  });

  // Top center zero-roll indicator triangle (fixed on bezel)
  ctx.fillStyle = '#fde047';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - rollR + 1);
  ctx.lineTo(cx - 3.5, cy - rollR - 4.5);
  ctx.lineTo(cx + 3.5, cy - rollR - 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ── 3. Rotating Roll Pointer (moves with roll) ──────────────────────────────
  const rollPtrAngle = (-90 - roll) * DEG;
  const perp = rollPtrAngle + Math.PI / 2;
  const ptrTip = innerR + 1;
  const ptrBase = innerR + 6.5;
  ctx.fillStyle = '#fde047';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + ptrTip * Math.cos(rollPtrAngle), cy + ptrTip * Math.sin(rollPtrAngle));
  ctx.lineTo(
    cx + ptrBase * Math.cos(rollPtrAngle) + 3.8 * Math.cos(perp),
    cy + ptrBase * Math.sin(rollPtrAngle) + 3.8 * Math.sin(perp)
  );
  ctx.lineTo(
    cx + ptrBase * Math.cos(rollPtrAngle) - 3.8 * Math.cos(perp),
    cy + ptrBase * Math.sin(rollPtrAngle) - 3.8 * Math.sin(perp)
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ── 4. Inner Circular Artificial Horizon (Clipped) ──────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.clip();

  // Translate and rotate for attitude
  ctx.translate(cx, cy);
  ctx.rotate(-roll * DEG);

  // Scale pitch in pixels (approx 1.35px per degree)
  const pxPerDeg = innerR / 30;
  const pitchPx = pitch * pxPerDeg;

  // Sky Gradient - Rich vibrant aeronautical cockpit sky
  const skyGrad = ctx.createLinearGradient(0, -innerR * 2.5 + pitchPx, 0, pitchPx);
  skyGrad.addColorStop(0, '#0052cc'); // Deep cobalt sky
  skyGrad.addColorStop(0.6, '#0070f3'); // High-visibility bright sky
  skyGrad.addColorStop(1, '#0284c7'); // Vivid horizon blue
  ctx.fillStyle = skyGrad;
  ctx.fillRect(-innerR * 2.5, -innerR * 2.5 + pitchPx, innerR * 5, innerR * 2.5);

  // Ground Gradient - Rich warm earth amber / terracotta
  const gndGrad = ctx.createLinearGradient(0, pitchPx, 0, innerR * 2.5 + pitchPx);
  gndGrad.addColorStop(0, '#b45309'); // Warm earth amber near horizon
  gndGrad.addColorStop(0.55, '#85370b'); // Terracotta
  gndGrad.addColorStop(1, '#531f08'); // Deep earth
  ctx.fillStyle = gndGrad;
  ctx.fillRect(-innerR * 2.5, pitchPx, innerR * 5, innerR * 2.5);

  // Horizon Line - Brilliant, razor-sharp demarcation
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 2;
  ctx.beginPath();
  ctx.moveTo(-innerR * 2.5, pitchPx);
  ctx.lineTo(innerR * 2.5, pitchPx);
  ctx.stroke();
  ctx.restore();

  // Pitch Ladder Rungs - High contrast with crisp text shadows
  ctx.font = 'bold 8.5px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let deg = -40; deg <= 40; deg += 10) {
    if (deg === 0) continue;
    const y = pitchPx - deg * pxPerDeg;
    if (Math.abs(y) > innerR * 1.1) continue;

    const isMajor = deg % 20 === 0;
    const lineW = isMajor ? innerR * 0.52 : innerR * 0.34;
    const tickH = deg > 0 ? 3.5 : -3.5; // ticks point down in sky, up in ground

    ctx.save();
    // Drop shadow ensures instant legibility against both sky and ground
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = isMajor ? 1.6 : 1.2;

    if (deg < 0) {
      // Dashed for ground pitch
      ctx.setLineDash([4, 2.5]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(-lineW / 2, y);
    ctx.lineTo(lineW / 2, y);
    ctx.stroke();
    ctx.setLineDash([]); // reset dash

    // Downward/upward end ticks
    ctx.beginPath();
    ctx.moveTo(-lineW / 2, y);
    ctx.lineTo(-lineW / 2, y + tickH);
    ctx.moveTo(lineW / 2, y);
    ctx.lineTo(lineW / 2, y + tickH);
    ctx.stroke();

    // Pitch degree labels
    ctx.fillStyle = '#ffffff';
    ctx.fillText(Math.abs(deg), -lineW / 2 - 7, y);
    ctx.fillText(Math.abs(deg), lineW / 2 + 7, y);
    ctx.restore();
  }

  ctx.restore(); // end horizon clipping

  // ── 5. Inner Glass Shadow & Ring ────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 1, 0, Math.PI * 2);
  ctx.stroke();

  // ── 6. Fixed Aircraft Reticle / Symbol (Center) ─────────────────────────────
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 3.5;

  // Center pip
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Wing bars
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2.2;
  const wingGap = 6;
  const wingSpan = 19;

  // Left wing
  ctx.beginPath();
  ctx.moveTo(cx - wingSpan, cy);
  ctx.lineTo(cx - wingGap, cy);
  ctx.lineTo(cx - wingGap, cy + 3.5);
  ctx.stroke();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(cx + wingGap, cy + 3.5);
  ctx.lineTo(cx + wingGap, cy);
  ctx.lineTo(cx + wingSpan, cy);
  ctx.stroke();

  ctx.restore();

  // Safe rounded rect helper
  const drawPill = (x, y, w, h, r) => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
    }
  };

  // ── 7. Bottom Digital Readout Pill (HDG) ────────────────────────────────────
  const pillW = 46;
  const pillH = 13.5;
  const pillY = cy + innerR - pillH - 2;

  ctx.fillStyle = 'rgba(6, 11, 16, 0.95)';
  drawPill(cx - pillW / 2, pillY, pillW, pillH, 3);
  ctx.fill();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.2;
  drawPill(cx - pillW / 2, pillY, pillW, pillH, 3);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(hdg).toString().padStart(3, '0')}°`, cx, pillY + pillH / 2);

  // ── 8. Top Attitude Mini Readout (P & R) ────────────────────────────────────
  const topPillW = 56;
  const topPillH = 12;
  const topPillY = cy - innerR + 2;

  ctx.fillStyle = 'rgba(6, 11, 16, 0.9)';
  drawPill(cx - topPillW / 2, topPillY, topPillW, topPillH, 3);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  drawPill(cx - topPillW / 2, topPillY, topPillW, topPillH, 3);
  ctx.stroke();

  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 8px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const rSign = roll >= 0 ? '+' : '';
  const pSign = pitch >= 0 ? '+' : '';
  ctx.fillText(`R${rSign}${Math.round(roll)}° P${pSign}${Math.round(pitch)}°`, cx, topPillY + topPillH / 2);

  ctx.restore(); // restore dpr scale
}

export default function RoundHUD({ drone, color, size = 124, onExpand }) {
  const canvasRef = useRef(null);

  const roll  = drone?.roll;
  const pitch = drone?.pitch;
  const hdg   = drone?.hdg;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawRoundHUD(canvas, drone, color, size);
  }, [roll, pitch, hdg, color, size, drone]);

  const accentColor = color || '#3ed6c4';

  return (
    <div
      className="round-hud-box"
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        cursor: onExpand ? 'pointer' : 'default',
      }}
      onClick={onExpand}
      title={onExpand ? 'Click to expand HUD' : undefined}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'block',
          borderRadius: '50%',
        }}
      />
      {onExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="round-hud-expand-btn"
          title="Expand HUD"
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            background: 'rgba(0, 0, 0, 0.7)',
            border: `1px solid ${accentColor}66`,
            color: accentColor,
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '9px',
            lineHeight: '14px',
            textAlign: 'center',
            cursor: 'pointer',
            padding: 0,
            opacity: 0.75,
            transition: 'opacity 0.15s, transform 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'scale(1.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.75';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ⛶
        </button>
      )}
    </div>
  );
}
