// frontend/src/components/HealthScoreCard.jsx
import { useState, useEffect, useRef } from 'react'

// Circular SVG progress ring
function RingProgress({ score }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, score))
  const offset = circumference - (progress / 100) * circumference

  const color =
    score >= 70 ? 'var(--status-green)' :
    score >= 40 ? 'var(--status-amber)' :
    'var(--status-red)'

  return (
    <svg width="140" height="140" style={{ position: 'absolute', top: 0, left: 0 }}>
      {/* Track */}
      <circle
        cx="70" cy="70" r={radius}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth="4"
      />
      {/* Progress arc */}
      <circle
        cx="70" cy="70" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
        style={{
          transition: 'stroke-dashoffset 600ms ease, stroke 600ms ease',
          filter: `drop-shadow(0 0 6px ${color})`,
        }}
      />
    </svg>
  )
}

// Animated number counter
function AnimatedNumber({ value, decimals = 1 }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef(null)

  useEffect(() => {
    const start = prevRef.current
    const end = value
    const duration = 600
    const startTime = performance.now()

    const animate = (now) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplay(start + (end - start) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
      else prevRef.current = end
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  return <>{display.toFixed(decimals)}</>
}

export default function HealthScoreCard({ state }) {
  const { health_score = 100, rul_hours = 168, is_anomaly = false } = state

  const scoreColor =
    health_score >= 70 ? 'var(--status-green)' :
    health_score >= 40 ? 'var(--status-amber)' :
    'var(--status-red)'

  const statusLabel =
    health_score >= 70 ? 'NOMINAL' :
    health_score >= 40 ? 'DEGRADED' :
    'CRITICAL'

  const isCritical = health_score < 40
  const isWarning  = health_score >= 40 && health_score < 70

  return (
    <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>

      {/* Circular ring + score number */}
      <div style={{ position: 'relative', width: '140px', height: '140px' }}>
        <RingProgress score={health_score} />

        {/* Center content */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '52px',
            fontWeight: 700,
            lineHeight: 1,
            color: scoreColor,
            transition: 'color 600ms ease',
            animation: isCritical ? 'glow-pulse 2s ease-in-out infinite' : 'none',
          }}>
            <AnimatedNumber value={health_score} decimals={0} />
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: 'var(--text-muted)',
            letterSpacing: '0.15em',
            marginTop: '2px',
          }}>
            HEALTH %
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.2em',
        color: scoreColor,
        padding: '3px 12px',
        border: `1px solid ${scoreColor}`,
        borderRadius: '2px',
        background: `color-mix(in srgb, ${scoreColor} 10%, transparent)`,
        transition: 'all 600ms ease',
        animation: isCritical ? 'blink-critical 1s ease-in-out infinite' :
                   isWarning  ? 'pulse-amber 1.5s ease-in-out infinite' : 'none',
      }}>
        ● {statusLabel}
      </div>

      {/* RUL display */}
      <div style={{
        width: '100%',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '3px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Clock icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            color: 'var(--text-muted)', letterSpacing: '0.1em',
          }}>
            RUL ESTIMATE
          </span>
        </div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          fontWeight: 600,
          color: scoreColor,
          transition: 'color 600ms ease',
        }}>
          <AnimatedNumber value={rul_hours} decimals={0} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '3px' }}>hrs</span>
        </div>
      </div>

      {/* Anomaly flag */}
      {is_anomaly && (
        <div style={{
          width: '100%',
          background: 'rgba(255,34,0,0.08)',
          border: '1px solid rgba(255,34,0,0.3)',
          borderRadius: '3px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          animation: 'slide-in-up 300ms ease forwards',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--status-red)',
            animation: 'blink-critical 1s ease-in-out infinite',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            color: 'var(--status-red)', letterSpacing: '0.1em',
          }}>
            ANOMALY DETECTED
          </span>
        </div>
      )}

      {/* Subsystem state pills */}
      <div style={{ width: '100%' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '8px',
          color: 'var(--text-muted)', letterSpacing: '0.15em',
          marginBottom: '6px',
        }}>
          SUBSYSTEM STATUS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {Object.entries(state.subsystem_states || {}).map(([name, status]) => {
            const c =
              status === 'green' ? 'var(--status-green)' :
              status === 'amber' ? 'var(--status-amber)' :
              'var(--status-red)'
            return (
              <div key={name} style={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${c}44`,
                borderRadius: '2px',
                padding: '4px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'border-color 600ms ease',
              }}>
                <div style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: c, boxShadow: `0 0 4px ${c}`,
                  flexShrink: 0,
                  transition: 'background 600ms ease, box-shadow 600ms ease',
                }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px',
                  color: 'var(--text-secondary)', textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  {name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}