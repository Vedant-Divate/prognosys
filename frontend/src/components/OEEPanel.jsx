// frontend/src/components/OEEPanel.jsx
import { useState, useEffect, useRef } from 'react'

// ── OEE Calculation Logic ─────────────────────────────────────
// Derived from live sensor state — no backend needed
//
// Availability = uptime / planned_time
//   → degrades when temperature > 85 (thermal stop) or vibration > 5 (emergency stop)
//
// Performance = actual_output / theoretical_output
//   → degrades when spindle_load deviates from optimal (65-75%)
//   → degrades when tool_life < 40% (worn tool = slower feed rate)
//
// Quality = good_parts / total_parts
//   → degrades when vibration > 3.5 (surface finish affected)
//   → degrades when temperature > 78 (thermal expansion affects tolerance)

function calcOEE(state) {
  const {
    vibration_rms   = 2.0,
    spindle_load    = 65.0,
    temperature_c   = 67.0,
    tool_life_pct   = 100.0,
    is_anomaly      = false,
  } = state

  // ── Availability ──────────────────────────────────────────
  let availability = 1.0
  // Thermal stop simulation
  if (temperature_c > 90) availability -= 0.35
  else if (temperature_c > 85) availability -= 0.20
  else if (temperature_c > 78) availability -= 0.08
  // Vibration-induced stop
  if (vibration_rms > 5.5) availability -= 0.25
  else if (vibration_rms > 4.5) availability -= 0.12
  // Anomaly flag = unplanned downtime
  if (is_anomaly) availability -= 0.10
  availability = Math.max(0.1, Math.min(1.0, availability))

  // ── Performance ───────────────────────────────────────────
  let performance = 1.0
  // Optimal spindle load is 60-75% — deviation = speed loss
  const loadDeviation = Math.abs(spindle_load - 67.5) / 67.5
  performance -= loadDeviation * 0.4
  // Worn tool forces reduced feed rate
  if (tool_life_pct < 20) performance -= 0.25
  else if (tool_life_pct < 40) performance -= 0.12
  else if (tool_life_pct < 60) performance -= 0.05
  // High vibration = reduced cutting speed
  if (vibration_rms > 4.0) performance -= 0.15
  else if (vibration_rms > 3.0) performance -= 0.06
  performance = Math.max(0.1, Math.min(1.0, performance))

  // ── Quality ───────────────────────────────────────────────
  let quality = 1.0
  // High vibration degrades surface finish
  if (vibration_rms > 4.5) quality -= 0.30
  else if (vibration_rms > 3.5) quality -= 0.15
  else if (vibration_rms > 2.8) quality -= 0.05
  // Thermal expansion affects dimensional tolerance
  if (temperature_c > 85) quality -= 0.20
  else if (temperature_c > 78) quality -= 0.10
  else if (temperature_c > 72) quality -= 0.03
  // Worn tool = poor surface finish and dimensional accuracy
  if (tool_life_pct < 10) quality -= 0.25
  else if (tool_life_pct < 25) quality -= 0.12
  quality = Math.max(0.1, Math.min(1.0, quality))

  const oee = availability * performance * quality

  return {
    oee:          Math.round(oee * 1000) / 10,          // %
    availability: Math.round(availability * 1000) / 10,
    performance:  Math.round(performance * 1000) / 10,
    quality:      Math.round(quality * 1000) / 10,
  }
}

// ── Simulated runtime tracker ─────────────────────────────────
// Accumulates planned vs actual runtime since component mount
function useRuntimeTracker(state) {
  const plannedRef    = useRef(0)   // seconds machine should have run
  const actualRef     = useRef(0)   // seconds machine actually ran
  const goodPartsRef  = useRef(0)
  const totalPartsRef = useRef(0)
  const [stats, setStats] = useState({
    plannedMins: 0, actualMins: 0,
    goodParts: 0,   totalParts: 0,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      plannedRef.current += 1

      // Machine is "running" when spindle_load > 20 and no thermal stop
      const running = state.spindle_load > 20 && state.temperature_c < 92
      if (running) actualRef.current += 1

      // Simulate part production: 1 part every ~8 seconds at nominal speed
      const speed = Math.max(0.1, Math.min(1.0, state.spindle_load / 75))
      const partChance = speed * 0.125  // ~1 part per 8s at full speed
      if (Math.random() < partChance) {
        totalPartsRef.current += 1
        // Part is "good" if vibration and temp are within tolerance
        const isGood = state.vibration_rms < 3.5 && state.temperature_c < 78
        if (isGood) goodPartsRef.current += 1
      }

      setStats({
        plannedMins: Math.round(plannedRef.current / 60 * 10) / 10,
        actualMins:  Math.round(actualRef.current  / 60 * 10) / 10,
        goodParts:   goodPartsRef.current,
        totalParts:  totalPartsRef.current,
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [state])

  return stats
}

// ── Animated bar ──────────────────────────────────────────────
function OEEBar({ label, value, target = 85 }) {
  const color =
    value >= 85 ? 'var(--status-green)' :
    value >= 65 ? 'var(--status-amber)' :
    'var(--status-red)'

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginBottom: '4px',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '9px',
          color: 'var(--text-muted)', letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          color, fontWeight: 700,
          transition: 'color 0.5s ease',
        }}>
          {value.toFixed(1)}%
        </span>
      </div>
      {/* Track */}
      <div style={{
        height: '6px', background: 'var(--bg-elevated)',
        borderRadius: '3px', overflow: 'hidden', position: 'relative',
      }}>
        {/* Target marker */}
        <div style={{
          position: 'absolute',
          left: `${target}%`,
          top: 0, bottom: 0,
          width: '1px',
          background: 'rgba(255,255,255,0.2)',
          zIndex: 2,
        }} />
        {/* Fill */}
        <div style={{
          height: '100%',
          width: `${value}%`,
          background: color,
          borderRadius: '3px',
          boxShadow: `0 0 6px ${color}88`,
          transition: 'width 0.6s ease, background 0.5s ease',
        }} />
      </div>
    </div>
  )
}

// ── Main OEEPanel ─────────────────────────────────────────────
export default function OEEPanel({ state }) {
  const { oee, availability, performance, quality } = calcOEE(state)
  const runtime = useRuntimeTracker(state)

  const oeeColor =
    oee >= 85 ? 'var(--status-green)' :
    oee >= 65 ? 'var(--status-amber)' :
    'var(--status-red)'

  const oeeGrade =
    oee >= 85 ? 'WORLD CLASS' :
    oee >= 75 ? 'GOOD' :
    oee >= 65 ? 'AVERAGE' :
    'POOR'

  return (
    <div style={{ padding: '10px 12px 12px' }}>

      {/* OEE Score — large centrepiece */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '10px',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '38px', fontWeight: 700,
            color: oeeColor, lineHeight: 1,
            transition: 'color 0.5s ease',
          }}>
            {oee.toFixed(1)}%
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '8px',
            color: 'var(--text-muted)', letterSpacing: '0.15em',
            marginTop: '2px',
          }}>
            OEE SCORE
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '9px',
          color: oeeColor,
          border: `1px solid ${oeeColor}55`,
          padding: '3px 8px', borderRadius: '2px',
          background: `color-mix(in srgb, ${oeeColor} 10%, transparent)`,
          letterSpacing: '0.1em',
          transition: 'all 0.5s ease',
        }}>
          {oeeGrade}
        </div>
      </div>

      {/* A × P × Q bars */}
      <OEEBar label="Availability" value={availability} />
      <OEEBar label="Performance"  value={performance}  />
      <OEEBar label="Quality"      value={quality}      />

      {/* Formula display */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: '6px',
        fontFamily: 'var(--font-mono)', fontSize: '9px',
        color: 'var(--text-muted)', marginBottom: '10px',
        padding: '6px 0',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span style={{ color: 'var(--status-green)' }}>{availability.toFixed(0)}%</span>
        <span>×</span>
        <span style={{ color: 'var(--status-amber)' }}>{performance.toFixed(0)}%</span>
        <span>×</span>
        <span style={{ color: 'var(--accent-blue)' }}>{quality.toFixed(0)}%</span>
        <span>=</span>
        <span style={{ color: oeeColor, fontWeight: 700 }}>{oee.toFixed(1)}%</span>
      </div>

      {/* Runtime stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '6px',
      }}>
        {[
          { label: 'PLANNED',    value: `${runtime.plannedMins}m`,  color: 'var(--text-secondary)' },
          { label: 'ACTUAL RUN', value: `${runtime.actualMins}m`,   color: 'var(--accent-blue)'    },
          { label: 'TOTAL PARTS',value: runtime.totalParts,          color: 'var(--text-secondary)' },
          { label: 'GOOD PARTS', value: runtime.goodParts,           color: 'var(--status-green)'   },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '3px', padding: '5px 8px',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '7px',
              color: 'var(--text-muted)', letterSpacing: '0.15em',
              marginBottom: '2px',
            }}>
              {label}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '16px',
              fontWeight: 700, color,
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}

// ── Export calc function for VR HUD use ───────────────────────
export { calcOEE }