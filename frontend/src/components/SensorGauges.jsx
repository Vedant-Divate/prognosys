// frontend/src/components/SensorGauges.jsx
import React, { useEffect, useRef, useState } from 'react';

// ─── Arc math helpers ────────────────────────────────────────────────────────
// The semicircle goes from 210° to 330° (a 240° sweep), starting at bottom-left.
const RADIUS = 54;
const CX = 70;
const CY = 70;
const SWEEP_DEG = 240;
const START_DEG = 210; // degrees from 3-o'clock (SVG convention)

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

// ─── Gauge colour based on normalized value [0,1] and danger direction ───────
// dangerHigh = true  → value increasing = bad (vibration, temp, load)
// dangerHigh = false → value decreasing = bad (tool life)
function gaugeColor(norm, dangerHigh) {
  const t = dangerHigh ? norm : 1 - norm;
  if (t < 0.5) return '#22cc22';   // green
  if (t < 0.75) return '#ffaa00';  // amber
  return '#ff2200';                  // red
}

// ─── Individual Arc Gauge ────────────────────────────────────────────────────
function ArcGauge({ label, value, unit, min, max, dangerHigh, icon }) {
  const displayRef = useRef(value);
  const animRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(value);

  // Smoothly animate the displayed number
  useEffect(() => {
    const start = displayRef.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    if (animRef.current) cancelAnimationFrame(animRef.current);

    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = start + (end - start) * eased;
      setDisplayValue(current);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        displayRef.current = end;
      }
    }
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [value]);

  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const color = gaugeColor(norm, dangerHigh);
  const fillAngle = START_DEG + norm * SWEEP_DEG;

  const trackPath = describeArc(CX, CY, RADIUS, START_DEG, START_DEG + SWEEP_DEG);
  const fillPath  = norm > 0.001
    ? describeArc(CX, CY, RADIUS, START_DEG, Math.min(fillAngle, START_DEG + SWEEP_DEG))
    : null;

  // Tick marks at 0%, 25%, 50%, 75%, 100%
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const angle = START_DEG + t * SWEEP_DEG;
    const inner = polarToCartesian(CX, CY, RADIUS - 8, angle);
    const outer = polarToCartesian(CX, CY, RADIUS + 2, angle);
    return { inner, outer, angle };
  });

  return (
    <div
      className="gauge-card"
      style={{
        background: 'linear-gradient(145deg, #0d1424, #0a0f1a)',
        border: '1px solid #1a2a4a',
        borderRadius: '12px',
        padding: '16px 12px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        position: 'relative',
        overflow: 'hidden',
        minWidth: '150px',
        flex: '1',
        boxShadow: `0 0 20px ${color}18`,
        transition: 'box-shadow 0.5s ease',
      }}
    >
      {/* Corner glow accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '60px', height: '60px',
        background: `radial-gradient(circle at top right, ${color}22, transparent 70%)`,
        pointerEvents: 'none',
        transition: 'background 0.5s ease',
      }} />

      {/* Label row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: '11px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        color: '#4a6fa5',
        fontWeight: 600,
      }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>

      {/* SVG Arc */}
      <svg width="140" height="100" viewBox="0 0 140 110" style={{ overflow: 'visible' }}>
        {/* Background glow ring */}
        <defs>
          <filter id={`glow-${label.replace(/\s/g,'')}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track (background arc) */}
        <path
          d={trackPath}
          fill="none"
          stroke="#1a2a3a"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Filled arc */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            filter={`url(#glow-${label.replace(/\s/g,'')})`}
            style={{ transition: 'stroke 0.5s ease' }}
          />
        )}

        {/* Tick marks */}
        {ticks.map((tick, i) => (
          <line
            key={i}
            x1={tick.inner.x} y1={tick.inner.y}
            x2={tick.outer.x} y2={tick.outer.y}
            stroke="#1e3050"
            strokeWidth={i === 0 || i === 4 ? 2 : 1}
          />
        ))}

        {/* Center value */}
        <text
          x={CX}
          y={CY + 8}
          textAnchor="middle"
          fill={color}
          fontFamily="'Share Tech Mono', monospace"
          fontSize="22"
          fontWeight="bold"
          style={{ transition: 'fill 0.5s ease' }}
        >
          {displayValue.toFixed(unit === '%' ? 0 : 1)}
        </text>

        {/* Unit label */}
        <text
          x={CX}
          y={CY + 24}
          textAnchor="middle"
          fill="#4a6fa5"
          fontFamily="'Rajdhani', sans-serif"
          fontSize="10"
          letterSpacing="1"
        >
          {unit}
        </text>

        {/* Min / Max labels */}
        <text
          x={polarToCartesian(CX, CY, RADIUS + 14, START_DEG).x}
          y={polarToCartesian(CX, CY, RADIUS + 14, START_DEG).y + 4}
          textAnchor="middle"
          fill="#2a3a5a"
          fontFamily="'Share Tech Mono', monospace"
          fontSize="8"
        >
          {min}
        </text>
        <text
          x={polarToCartesian(CX, CY, RADIUS + 14, START_DEG + SWEEP_DEG).x}
          y={polarToCartesian(CX, CY, RADIUS + 14, START_DEG + SWEEP_DEG).y + 4}
          textAnchor="middle"
          fill="#2a3a5a"
          fontFamily="'Share Tech Mono', monospace"
          fontSize="8"
        >
          {max}
        </text>
      </svg>

      {/* Status badge */}
      <div style={{
        fontSize: '9px',
        fontFamily: "'Rajdhani', sans-serif",
        letterSpacing: '2px',
        fontWeight: 700,
        color: color,
        textTransform: 'uppercase',
        padding: '2px 10px',
        border: `1px solid ${color}55`,
        borderRadius: '4px',
        background: `${color}11`,
        transition: 'all 0.5s ease',
      }}>
        {(() => {
          const t = dangerHigh ? norm : 1 - norm;
          if (t < 0.5) return 'NOMINAL';
          if (t < 0.75) return 'CAUTION';
          return 'CRITICAL';
        })()}
      </div>
    </div>
  );
}

// ─── SensorGauges — the four-gauge row ───────────────────────────────────────
const GAUGE_CONFIG = [
  {
    key: 'vibration_rms',
    label: 'Vibration RMS',
    unit: 'mm/s',
    min: 0,
    max: 8,
    dangerHigh: true,
    icon: '〜',
  },
  {
    key: 'spindle_load',
    label: 'Spindle Load',
    unit: '%',
    min: 0,
    max: 100,
    dangerHigh: true,
    icon: '⚙',
  },
  {
    key: 'temperature_c',
    label: 'Temperature',
    unit: '°C',
    min: 40,
    max: 100,
    dangerHigh: true,
    icon: '🌡',
  },
  {
    key: 'tool_life_pct',
    label: 'Tool Life',
    unit: '%',
    min: 0,
    max: 100,
    dangerHigh: false,
    icon: '◈',
  },
];

const SensorGauges = ({ machineState }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      padding: '16px',
      background: '#060b14',
      borderTop: '1px solid #0d1e33',
      flexWrap: 'wrap',
    }}>
      {/* Section header */}
      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '4px',
      }}>
        <div style={{
          width: '3px', height: '14px',
          background: 'linear-gradient(to bottom, #00d4ff, #0050aa)',
          borderRadius: '2px',
        }} />
        <span style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '11px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: '#4a6fa5',
          fontWeight: 600,
        }}>
          Live Sensor Telemetry
        </span>
        <div style={{
          flex: 1, height: '1px',
          background: 'linear-gradient(to right, #1a2a4a, transparent)',
        }} />
        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#22cc22',
            boxShadow: '0 0 8px #22cc22',
            animation: 'pulse-green 1.5s infinite',
          }} />
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '9px',
            color: '#22cc22',
            letterSpacing: '1px',
          }}>
            STREAMING
          </span>
        </div>
      </div>

      {/* The four gauges */}
      {GAUGE_CONFIG.map((cfg) => (
        <ArcGauge
          key={cfg.key}
          label={cfg.label}
          value={machineState?.[cfg.key] ?? (cfg.min + (cfg.max - cfg.min) * 0.3)}
          unit={cfg.unit}
          min={cfg.min}
          max={cfg.max}
          dangerHigh={cfg.dangerHigh}
          icon={cfg.icon}
        />
      ))}

      {/* Inline keyframes for the pulse animation */}
      <style>{`
        @keyframes pulse-green {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #22cc22; }
          50% { opacity: 0.4; box-shadow: 0 0 3px #22cc22; }
        }
      `}</style>
    </div>
  );
};

export default SensorGauges;