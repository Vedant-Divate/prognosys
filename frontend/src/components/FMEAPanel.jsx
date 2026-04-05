// frontend/src/components/FMEAPanel.jsx
import { useState, useEffect, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE

// ── Severity badge ─────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const cfg = {
    critical: { color: '#ff2200', bg: 'rgba(255,34,0,0.12)', label: 'CRITICAL' },
    major:    { color: '#ffaa00', bg: 'rgba(255,170,0,0.12)', label: 'MAJOR'    },
    minor:    { color: '#22cc22', bg: 'rgba(34,204,34,0.12)', label: 'MINOR'    },
  }[severity?.toLowerCase()] ?? { color: '#4a6fa5', bg: 'rgba(74,111,165,0.12)', label: 'UNKNOWN' }

  return (
    <span style={{
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: '9px', letterSpacing: '2px',
      fontWeight: 700, color: cfg.color,
      background: cfg.bg,
      padding: '2px 8px',
      border: `1px solid ${cfg.color}66`,
      borderRadius: '3px',
    }}>
      {cfg.label}
    </span>
  )
}

// ── Root cause item ────────────────────────────────────────────
function RootCauseItem({ cause, index }) {
  return (
    <div style={{
      display: 'flex', gap: '8px', alignItems: 'flex-start',
      padding: '6px 0',
      borderBottom: '1px solid #0d1e33',
    }}>
      <div style={{
        flexShrink: 0, width: '18px', height: '18px',
        borderRadius: '50%',
        border: '1px solid #ffaa0066',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '9px', color: '#ffaa00',
      }}>
        {index + 1}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '10px', fontWeight: 600,
          letterSpacing: '1px', color: '#ffaa00',
          textTransform: 'uppercase', marginBottom: '2px',
        }}>
          {cause.name?.replace(/_/g, ' ')}
        </div>
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '9px', color: '#4a6fa5',
          lineHeight: 1.4,
        }}>
          {cause.description}
        </div>
        <div style={{
          marginTop: '3px',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '8px', color: '#2a4a7a',
          letterSpacing: '1px',
        }}>
          DETECT: {cause.detection_method}
        </div>
      </div>
    </div>
  )
}

// ── Corrective action checklist ────────────────────────────────
function CorrectiveAction({ action }) {
  const [checked, setChecked] = useState([])

  const steps = action.steps?.length > 0
    ? action.steps
    : [
        `Inspect ${action.name?.replace(/_/g, ' ')}`,
        'Document findings in maintenance log',
        'Replace worn components if needed',
        'Verify machine returns to nominal parameters',
      ]

  const toggleStep = (i) => {
    setChecked(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    )
  }

  const urgencyColor = {
    immediate:      '#ff2200',
    within_8_hours: '#ffaa00',
    scheduled:      '#22cc22',
  }[action.urgency] ?? '#4a6fa5'

  return (
    <div style={{
      padding: '8px',
      background: 'rgba(0,0,0,0.2)',
      border: '1px solid #1a2a4a',
      borderRadius: '6px',
    }}>
      {/* Action header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '8px',
      }}>
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '10px', fontWeight: 700,
          letterSpacing: '1px', color: '#00d4ff',
          textTransform: 'uppercase',
        }}>
          {action.name?.replace(/_/g, ' ')}
        </div>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '8px', color: urgencyColor,
          border: `1px solid ${urgencyColor}55`,
          padding: '1px 6px', borderRadius: '2px',
        }}>
          {action.urgency?.replace(/_/g, ' ').toUpperCase()}
        </div>
      </div>

      {/* Meta row */}
      <div style={{
        display: 'flex', gap: '12px', marginBottom: '8px',
      }}>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '8px', color: '#2a4a7a',
        }}>
          ⏱ {action.downtime_hours}h downtime
        </div>
        {action.spare_parts?.length > 0 && (
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '8px', color: '#2a4a7a',
          }}>
            🔧 {action.spare_parts.join(', ')}
          </div>
        )}
      </div>

      {/* Checklist steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {steps.map((step, i) => (
          <div
            key={i}
            onClick={() => toggleStep(i)}
            style={{
              display: 'flex', gap: '8px', alignItems: 'flex-start',
              cursor: 'pointer', padding: '4px 6px',
              borderRadius: '4px',
              background: checked.includes(i) ? 'rgba(34,204,34,0.08)' : 'transparent',
              transition: 'background 0.2s',
            }}
          >
            {/* Checkbox */}
            <div style={{
              flexShrink: 0, width: '14px', height: '14px',
              border: `1px solid ${checked.includes(i) ? '#22cc22' : '#1a3a6a'}`,
              borderRadius: '2px',
              background: checked.includes(i) ? '#22cc22' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              marginTop: '1px',
            }}>
              {checked.includes(i) && (
                <svg width="8" height="8" viewBox="0 0 8 8">
                  <path d="M1 4l2 2 4-4" stroke="#060b19" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
            </div>
            {/* Step text */}
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: '10px', lineHeight: 1.4,
              color: checked.includes(i) ? '#22cc2299' : '#6a8fa5',
              textDecoration: checked.includes(i) ? 'line-through' : 'none',
              transition: 'all 0.2s',
            }}>
              {step}
            </div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div style={{ marginTop: '8px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '8px', color: '#2a3a5a',
          marginBottom: '3px',
        }}>
          <span>PROGRESS</span>
          <span>{checked.length}/{steps.length}</span>
        </div>
        <div style={{
          height: '3px', background: '#0d1e33',
          borderRadius: '2px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: '2px',
            background: '#22cc22',
            width: `${(checked.length / steps.length) * 100}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {[80, 60, 90, 50].map((w, i) => (
        <div key={i} style={{
          height: '10px', borderRadius: '3px',
          background: 'linear-gradient(90deg, #0d1e33, #1a2a4a, #0d1e33)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.2s infinite',
          width: `${w}%`,
        }} />
      ))}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

// ── Main FMEAPanel ─────────────────────────────────────────────
export default function FMEAPanel({ anomalyFlags, isVisible }) {
  const [fmeaData, setFmeaData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const lastFlagRef = useRef(null)

  // Fetch FMEA data when anomaly flag changes
  useEffect(() => {
    if (!anomalyFlags || anomalyFlags.length === 0) {
      setFmeaData(null)
      lastFlagRef.current = null
      return
    }

    const flag = anomalyFlags[0] // use first flag
    if (flag === lastFlagRef.current) return // avoid duplicate fetches
    lastFlagRef.current = flag

    setLoading(true)
    setError(null)

    fetch(`${API_BASE}/api/fmea/${flag}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }   // ADD THIS
    })
      .then(res => {
        if (!res.ok) throw new Error(`FMEA fetch failed: ${res.status}`)
        return res.json()
      })
      .then(data => {
        setFmeaData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('[FMEA]', err)
        setError(err.message)
        setLoading(false)
      })
  }, [anomalyFlags])

  if (!isVisible) return null

  return (
    <div style={{
      padding: '8px 12px 12px',
      display: 'flex', flexDirection: 'column', gap: '10px',
      maxHeight: '310px', overflowY: 'auto',
    }}>
      {loading && <LoadingSkeleton />}

      {error && (
        <div style={{
          padding: '8px', textAlign: 'center',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '9px', color: '#ff220099',
          border: '1px solid #ff220033', borderRadius: '4px',
        }}>
          FMEA QUERY FAILED<br/>{error}
        </div>
      )}

      {!loading && !error && !fmeaData && (
        <div style={{
          padding: '10px', textAlign: 'center',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '9px', color: '#2a3a5a', letterSpacing: '2px',
          border: '1px dashed #1a2a4a', borderRadius: '4px',
        }}>
          AWAITING ANOMALY FLAGS
        </div>
      )}

      {fmeaData && (
        <>
          {/* Fault name + severity */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: '13px', fontWeight: 700,
              letterSpacing: '2px', color: '#ff2200',
              textTransform: 'uppercase',
            }}>
              {fmeaData.failure_mode?.replace(/_/g, ' ')}
            </div>
            <SeverityBadge severity={fmeaData.severity} />
          </div>

          {/* Affected subsystem */}
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '8px', color: '#2a4a7a', letterSpacing: '2px',
          }}>
            SUBSYSTEM: {fmeaData.affected_subsystem?.toUpperCase()}
          </div>

          {/* Root causes */}
          {fmeaData.root_causes?.length > 0 && (
            <div>
              <div style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '9px', letterSpacing: '3px',
                textTransform: 'uppercase', color: '#2a4a7a',
                marginBottom: '4px',
              }}>
                Root Causes
              </div>
              {fmeaData.root_causes.map((rc, i) => (
                <RootCauseItem key={i} cause={rc} index={i} />
              ))}
            </div>
          )}

          {/* Corrective actions */}
          {fmeaData.corrective_actions?.length > 0 && (
            <div>
              <div style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '9px', letterSpacing: '3px',
                textTransform: 'uppercase', color: '#2a4a7a',
                marginBottom: '6px',
              }}>
                Corrective Actions
              </div>
              {fmeaData.corrective_actions.map((action, i) => (
                <CorrectiveAction key={i} action={action} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}