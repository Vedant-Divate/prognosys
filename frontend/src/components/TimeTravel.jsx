// frontend/src/components/TimeTravel.jsx
import { useState, useRef, useEffect, useCallback } from 'react'

const HOUR_MAX = 168

// ── Tiny sparkline for the trajectory chart ───────────────────
function TrajectoryChart({ trajectory, cursorHour, onHover }) {
  const svgRef = useRef(null)
  const W = 276, H = 80

  if (!trajectory || trajectory.length === 0) {
    return (
      <div style={{
        width: '100%', height: `${H}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px dashed #1a2a4a', borderRadius: '4px',
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '9px', color: '#2a3a5a', letterSpacing: '2px',
      }}>
        NO TRAJECTORY DATA
      </div>
    )
  }

  const hours  = trajectory.map(p => p.hour)
  const scores = trajectory.map(p => p.health_score)
  const maxH   = Math.max(...hours)
  const toX = h  => (h / maxH) * (W - 20) + 10
  const toY = s  => H - 8 - ((s / 100) * (H - 16))

  // Build polyline points
  const points = trajectory.map(p => `${toX(p.hour)},${toY(p.health_score)}`).join(' ')

  // Colour each segment based on score
  const segments = []
  for (let i = 0; i < trajectory.length - 1; i++) {
    const s = trajectory[i].health_score
    const color = s >= 70 ? '#22cc22' : s >= 40 ? '#ffaa00' : '#ff2200'
    segments.push({
      x1: toX(trajectory[i].hour),   y1: toY(trajectory[i].health_score),
      x2: toX(trajectory[i+1].hour), y2: toY(trajectory[i+1].health_score),
      color,
    })
  }

  // Find failure point (first score < 20)
  const failurePoint = trajectory.find(p => p.health_score < 20)

  // Cursor X position
  const cursorX = toX(cursorHour)
  const cursorScore = trajectory.reduce((best, p) =>
    Math.abs(p.hour - cursorHour) < Math.abs(best.hour - cursorHour) ? p : best
  , trajectory[0])

  const handleMouseMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left - 10
    const h = Math.round((x / (W - 20)) * maxH)
    onHover(Math.max(0, Math.min(HOUR_MAX, h)))
  }

  return (
    <svg
      ref={svgRef}
      width="100%" viewBox={`0 0 ${W} ${H}`}
      style={{ cursor: 'crosshair', display: 'block' }}
      onMouseMove={handleMouseMove}
    >
      {/* Background */}
      <rect width={W} height={H} fill="rgba(0,0,0,0.3)" rx="4" />

      {/* Threshold zones */}
      <rect x="10" y={toY(70)}  width={W-20} height={toY(40)-toY(70)}  fill="rgba(255,170,0,0.06)" />
      <rect x="10" y={toY(40)}  width={W-20} height={toY(0)-toY(40)}   fill="rgba(255,34,0,0.06)" />

      {/* Threshold lines */}
      <line x1="10" y1={toY(70)} x2={W-10} y2={toY(70)} stroke="#ffaa0033" strokeWidth="1" strokeDasharray="3,3" />
      <line x1="10" y1={toY(40)} x2={W-10} y2={toY(40)} stroke="#ff220033" strokeWidth="1" strokeDasharray="3,3" />

      {/* Threshold labels */}
      <text x="12" y={toY(70)-2} fill="#ffaa0066" fontSize="7" fontFamily="monospace">70%</text>
      <text x="12" y={toY(40)-2} fill="#ff220066" fontSize="7" fontFamily="monospace">40%</text>

      {/* Coloured line segments */}
      {segments.map((seg, i) => (
        <line key={i}
          x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
          stroke={seg.color} strokeWidth="2" strokeLinecap="round"
        />
      ))}

      {/* Failure marker */}
      {failurePoint && (
        <>
          <line
            x1={toX(failurePoint.hour)} y1="0"
            x2={toX(failurePoint.hour)} y2={H}
            stroke="#ff220066" strokeWidth="1" strokeDasharray="2,2"
          />
          <text
            x={toX(failurePoint.hour) + 2} y="10"
            fill="#ff2200" fontSize="7" fontFamily="monospace"
          >
            FAIL@{failurePoint.hour}h
          </text>
        </>
      )}

      {/* Cursor vertical line */}
      {cursorHour > 0 && (
        <>
          <line
            x1={cursorX} y1="0" x2={cursorX} y2={H}
            stroke="#00d4ff88" strokeWidth="1"
          />
          <circle
            cx={cursorX} cy={toY(cursorScore.health_score)} r="4"
            fill="#00d4ff" stroke="#060b19" strokeWidth="1.5"
          />
        </>
      )}

      {/* X axis labels */}
      {[0, 48, 96, 144, 168].map(h => (
        <text key={h} x={toX(h)} y={H - 1}
          fill="#2a3a5a" fontSize="7" fontFamily="monospace" textAnchor="middle"
        >
          {h}h
        </text>
      ))}
    </svg>
  )
}

// ── Predicted state display ────────────────────────────────────
function ProjectedState({ point }) {
  if (!point) return null
  const hs = point.health_score
  const color = hs >= 70 ? '#22cc22' : hs >= 40 ? '#ffaa00' : '#ff2200'
  const isFailing = hs < 20

  return (
    <div style={{
      padding: '10px',
      background: isFailing ? 'rgba(255,34,0,0.08)' : 'rgba(0,0,0,0.25)',
      border: `1px solid ${isFailing ? '#ff220055' : '#1a2a4a'}`,
      borderRadius: '6px',
      transition: 'all 0.3s ease',
    }}>
      {/* Failure banner */}
      {isFailing && (
        <div style={{
          textAlign: 'center', marginBottom: '8px',
          padding: '5px',
          background: 'rgba(255,34,0,0.15)',
          border: '1px solid #ff220088',
          borderRadius: '4px',
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '11px', fontWeight: 700,
          letterSpacing: '3px', color: '#ff2200',
          animation: 'pulse-red 1s infinite',
        }}>
          ⚠ PREDICTED FAILURE
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <div style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: '8px', letterSpacing: '2px',
            color: '#2a4a7a', textTransform: 'uppercase',
            marginBottom: '2px',
          }}>Health</div>
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '18px', fontWeight: 'bold', color,
            transition: 'color 0.3s',
          }}>
            {hs.toFixed(1)}%
          </div>
        </div>

        <div>
          <div style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: '8px', letterSpacing: '2px',
            color: '#2a4a7a', textTransform: 'uppercase',
            marginBottom: '2px',
          }}>RUL</div>
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '18px', color: '#00d4ff',
          }}>
            {point.rul_hours?.toFixed(0) ?? '--'}h
          </div>
        </div>

        <div>
          <div style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: '8px', letterSpacing: '2px',
            color: '#2a4a7a', textTransform: 'uppercase',
            marginBottom: '2px',
          }}>Vibration</div>
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '12px',
            color: (point.vibration_rms ?? 0) > 4.5 ? '#ff2200' : '#22cc22',
          }}>
            {point.vibration_rms?.toFixed(2) ?? '--'} mm/s
          </div>
        </div>

        <div>
          <div style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: '8px', letterSpacing: '2px',
            color: '#2a4a7a', textTransform: 'uppercase',
            marginBottom: '2px',
          }}>Temperature</div>
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '12px',
            color: (point.temperature_c ?? 0) > 85 ? '#ff2200' : '#22cc22',
          }}>
            {point.temperature_c?.toFixed(1) ?? '--'}°C
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div style={{
        marginTop: '8px', textAlign: 'center',
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: '9px', letterSpacing: '2px',
        textTransform: 'uppercase',
        color, padding: '3px',
        border: `1px solid ${color}44`,
        borderRadius: '3px',
        background: `${color}11`,
      }}>
        {point.status ?? (hs >= 70 ? 'NOMINAL' : hs >= 40 ? 'DEGRADED' : 'CRITICAL')}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function TimeTravel({ trajectory, currentState }) {
  const [hour, setHour] = useState(0)
  const [hoveredHour, setHoveredHour] = useState(0)

  // Use hovered hour from chart OR slider hour
  const activeHour = hoveredHour > 0 ? hoveredHour : hour

  // Find the trajectory point closest to activeHour
  const activePoint = trajectory && trajectory.length > 0
    ? trajectory.reduce((best, p) =>
        Math.abs(p.hour - activeHour) < Math.abs(best.hour - activeHour) ? p : best
      , trajectory[0])
    : null

  // Slider track colour — green → amber → red
  const sliderNorm = hour / HOUR_MAX
  const sliderColor = sliderNorm < 0.4 ? '#22cc22'
    : sliderNorm < 0.7 ? '#ffaa00'
    : '#ff2200'

  const hasData = trajectory && trajectory.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>

      {/* Hour display */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '9px', letterSpacing: '3px',
          textTransform: 'uppercase', color: '#2a4a7a',
        }}>
          Projection Horizon
        </div>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '16px', fontWeight: 'bold',
          color: sliderColor,
          transition: 'color 0.3s ease',
        }}>
          +{activeHour}h
        </div>
      </div>

      {/* Trajectory chart */}
      {hasData ? (
        <TrajectoryChart
          trajectory={trajectory}
          cursorHour={activeHour}
          onHover={setHoveredHour}
        />
      ) : (
        <div style={{
          height: '80px', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          border: '1px dashed #1a2a4a', borderRadius: '4px',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '9px', color: '#2a3a5a', letterSpacing: '2px',
          flexShrink: 0,
        }}>
          AWAITING TRAJECTORY DATA
        </div>
      )}

      {/* Time slider */}
      <div>
        <input
          type="range"
          min={0} max={HOUR_MAX} step={1}
          value={hour}
          onChange={e => {
            setHour(parseInt(e.target.value))
            setHoveredHour(0) // clear chart hover when slider moves
          }}
          style={{
            width: '100%', appearance: 'none',
            height: '6px', borderRadius: '3px', outline: 'none',
            cursor: 'pointer',
            background: `linear-gradient(to right,
              #22cc22 0%,
              #22cc22 40%,
              #ffaa00 40%,
              #ffaa00 70%,
              #ff2200 70%,
              #ff2200 100%
            )`,
          }}
        />
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '8px', color: '#2a3a5a', marginTop: '2px',
        }}>
          <span>NOW</span>
          <span>+48h</span>
          <span>+96h</span>
          <span>+168h</span>
        </div>
      </div>

      {/* Projected state */}
      {hasData && activePoint ? (
        <ProjectedState point={activePoint} />
      ) : (
        <div style={{
          padding: '10px', textAlign: 'center',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '9px', color: '#2a3a5a', letterSpacing: '2px',
          border: '1px dashed #1a2a4a', borderRadius: '6px',
        }}>
          START SIMULATOR TO<br/>ENABLE PREDICTIONS
        </div>
      )}

      {/* Download PDF button */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('download-health-cert'))}
        style={{
          marginTop: 'auto',
          width: '100%', padding: '8px',
          background: 'transparent',
          border: '1px solid #1a3a6a',
          borderRadius: '4px',
          color: '#00d4ff',
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '10px', letterSpacing: '2px',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => {
          e.target.style.background = '#00d4ff15'
          e.target.style.borderColor = '#00d4ff'
        }}
        onMouseLeave={e => {
          e.target.style.background = 'transparent'
          e.target.style.borderColor = '#1a3a6a'
        }}
      >
        ⬇ Download Health Certificate
      </button>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          appearance: none;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #00d4ff;
          border: 2px solid #060b19;
          box-shadow: 0 0 8px #00d4ffaa;
          cursor: pointer;
        }
        @keyframes pulse-red {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}