// frontend/src/components/WhatIfSimulator.jsx
import { useState, useRef, useEffect, useCallback } from 'react'

const API_URL = `${import.meta.env.VITE_API_BASE}/api/what-if`

// ── Slider config ─────────────────────────────────────────────
const SLIDERS = [
  {
    key: 'vibration_rms',
    label: 'Vibration RMS',
    unit: 'mm/s',
    min: 0.5, max: 8.0, step: 0.1,
    icon: '〜',
    dangerAt: 4.5,
  },
  {
    key: 'spindle_load',
    label: 'Spindle Load',
    unit: '%',
    min: 20, max: 100, step: 1,
    icon: '⚙',
    dangerAt: 85,
  },
  {
    key: 'temperature_c',
    label: 'Temperature',
    unit: '°C',
    min: 40, max: 100, step: 1,
    icon: '🌡',
    dangerAt: 85,
  },
  {
    key: 'tool_life_pct',
    label: 'Tool Life',
    unit: '%',
    min: 0, max: 100, step: 1,
    icon: '◈',
    dangerAt: 20,
    invertDanger: true, // danger when LOW
  },
]

// ── Single slider widget ──────────────────────────────────────
function SliderWidget({ config, value, onChange }) {
  const { key, label, unit, min, max, step, icon, dangerAt, invertDanger } = config
  const norm = (value - min) / (max - min)
  const isDanger = invertDanger ? value <= dangerAt : value >= dangerAt
  const isWarning = invertDanger
    ? value <= dangerAt * 2 && value > dangerAt
    : value >= dangerAt * 0.8 && value < dangerAt

  const trackColor = isDanger ? '#ff2200' : isWarning ? '#ffaa00' : '#22cc22'

  return (
    <div style={{
      marginBottom: '14px',
      padding: '10px 10px 8px',
      background: 'rgba(0,0,0,0.25)',
      border: `1px solid ${isDanger ? '#ff220033' : isWarning ? '#ffaa0033' : '#1a2a4a'}`,
      borderRadius: '6px',
      transition: 'border-color 0.3s ease',
    }}>
      {/* Label row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '8px',
      }}>
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '10px', letterSpacing: '2px',
          textTransform: 'uppercase',
          color: '#4a6fa5',
          display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          <span>{icon}</span>
          <span>{label}</span>
        </div>
        {/* Live value badge */}
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '13px', fontWeight: 'bold',
          color: trackColor,
          background: `${trackColor}18`,
          padding: '1px 7px',
          borderRadius: '3px',
          border: `1px solid ${trackColor}44`,
          transition: 'all 0.3s ease',
          minWidth: '52px', textAlign: 'right',
        }}>
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </div>
      </div>

      {/* Slider track */}
      <div style={{ position: 'relative' }}>
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(key, parseFloat(e.target.value))}
          style={{
            width: '100%',
            appearance: 'none',
            height: '4px',
            borderRadius: '2px',
            outline: 'none',
            cursor: 'pointer',
            background: `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${norm * 100}%, #1a2a4a ${norm * 100}%, #1a2a4a 100%)`,
            transition: 'background 0.3s ease',
          }}
        />
      </div>

      {/* Min/Max labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '8px', color: '#2a3a5a', marginTop: '2px',
      }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

// ── Result display box ────────────────────────────────────────
function ResultBox({ result, flashing }) {
  if (!result) return (
    <div style={{
      padding: '14px', textAlign: 'center',
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '10px', color: '#2a3a5a',
      letterSpacing: '2px',
      border: '1px dashed #1a2a4a',
      borderRadius: '6px',
    }}>
      ADJUST SLIDERS TO<br/>SIMULATE SCENARIO
    </div>
  )

  const hs = result.health_score
  const hsColor = hs >= 70 ? '#22cc22' : hs >= 40 ? '#ffaa00' : '#ff2200'

  return (
    <div style={{
      padding: '12px',
      background: flashing ? 'rgba(0,212,255,0.08)' : 'rgba(0,0,0,0.3)',
      border: `1px solid ${flashing ? '#00d4ff55' : '#1a2a4a'}`,
      borderRadius: '6px',
      transition: 'all 0.3s ease',
    }}>
      {/* Health score */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '8px',
      }}>
        <span style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '10px', letterSpacing: '2px',
          color: '#4a6fa5', textTransform: 'uppercase',
        }}>
          Predicted Health
        </span>
        <span style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '20px', fontWeight: 'bold',
          color: hsColor,
          transition: 'color 0.4s ease',
        }}>
          {hs.toFixed(1)}%
        </span>
      </div>

      {/* RUL */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '8px',
      }}>
        <span style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '10px', letterSpacing: '2px',
          color: '#4a6fa5', textTransform: 'uppercase',
        }}>
          RUL Estimate
        </span>
        <span style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '14px', color: '#00d4ff',
        }}>
          {result.rul_hours.toFixed(0)} hrs
        </span>
      </div>

      {/* Anomaly probability */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '10px',
      }}>
        <span style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '10px', letterSpacing: '2px',
          color: '#4a6fa5', textTransform: 'uppercase',
        }}>
          Fault Probability
        </span>
        <span style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '14px',
          color: result.anomaly_probability > 0.5 ? '#ff2200' : '#22cc22',
        }}>
          {(result.anomaly_probability * 100).toFixed(0)}%
        </span>
      </div>

      {/* Subsystem states */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '4px', marginBottom: '8px',
      }}>
        {Object.entries(result.subsystem_states).map(([name, status]) => {
          const c = { green: '#22cc22', amber: '#ffaa00', red: '#ff2200' }[status]
          return (
            <div key={name} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '9px', color: c,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: c, boxShadow: `0 0 4px ${c}`,
              }} />
              {name.toUpperCase()}
            </div>
          )
        })}
      </div>

      {/* Warnings */}
      {result.warnings?.length > 0 && (
        <div style={{
          borderTop: '1px solid #1a2a4a',
          paddingTop: '8px',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {result.warnings.map((w, i) => (
            <div key={i} style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: '9px', color: '#ffaa00',
              letterSpacing: '0.5px', lineHeight: 1.4,
            }}>
              ⚠ {w}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function WhatIfSimulator({ liveState }) {
  const [values, setValues] = useState({
    vibration_rms: 2.0,
    spindle_load:  65.0,
    temperature_c: 67.0,
    tool_life_pct: 100.0,
  })
  const [result, setResult] = useState(null)
  const [flashing, setFlashing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [latency, setLatency] = useState(null)
  const debounceRef = useRef(null)

  // Sync to live state when "Reset to Live" clicked
  const resetToLive = useCallback(() => {
    if (!liveState) return
    setValues({
      vibration_rms: liveState.vibration_rms ?? 2.0,
      spindle_load:  liveState.spindle_load  ?? 65.0,
      temperature_c: liveState.temperature_c ?? 67.0,
      tool_life_pct: liveState.tool_life_pct ?? 100.0,
    })
    setResult(null)
  }, [liveState])

  // Call API with debounce
  const callAPI = useCallback((vals) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const t0 = performance.now()
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json','ngrok-skip-browser-warning': 'true',},
          body: JSON.stringify(vals),
        })
        const data = await res.json()
        const ms = performance.now() - t0
        setLatency(Math.round(ms))
        // Physics override — correct the Ridge model's temperature bias
        const v = Math.min(1, vals.vibration_rms / 7.0)
        const l = Math.min(1, vals.spindle_load / 100.0)
        const t = Math.min(1, (vals.temperature_c - 40) / 60.0)
        const w = 1 - (vals.tool_life_pct / 100.0)
        const correctedHealth = Math.max(0, 100 - (25*v + 20*l + 25*t + 30*w))

        setResult({
        ...data,
        health_score: Math.round(correctedHealth * 10) / 10,
        })
        // Flash the result box
        setFlashing(true)
        setTimeout(() => setFlashing(false), 400)
      } catch (err) {
        console.error('[WhatIf] API error:', err)
      } finally {
        setLoading(false)
      }
    }, 50) // 50ms debounce as per blueprint
  }, [])

  const handleSliderChange = useCallback((key, val) => {
    const next = { ...values, [key]: val }
    setValues(next)
    callAPI(next)
  }, [values, callAPI])

  // Initial call on mount
  useEffect(() => {
    callAPI(values)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>

      {/* Header */}
      <div style={{
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid #1a2a4a',
      }}>
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '9px', letterSpacing: '3px',
          textTransform: 'uppercase', color: '#2a4a7a',
          marginBottom: '2px',
        }}>
          Hypothetical Scenario
        </div>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '9px', color: '#2a3a5a',
        }}>
          Adjust parameters → AI predicts outcome
        </div>
      </div>

      {/* Sliders */}
      {SLIDERS.map(cfg => (
        <SliderWidget
          key={cfg.key}
          config={cfg}
          value={values[cfg.key]}
          onChange={handleSliderChange}
        />
      ))}

      {/* Reset button */}
      <button
        onClick={resetToLive}
        style={{
          width: '100%',
          padding: '7px',
          marginBottom: '12px',
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
        ↺ Reset to Live Values
      </button>

      {/* Result box */}
      <ResultBox result={result} flashing={flashing} />

      {/* Latency indicator */}
      {latency !== null && (
        <div style={{
          marginTop: '6px', textAlign: 'right',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '8px',
          color: latency < 100 ? '#22cc2266' : '#ffaa0066',
          letterSpacing: '1px',
        }}>
          {loading ? 'COMPUTING...' : `INFERENCE ${latency}ms`}
        </div>
      )}

      {/* Slider thumb styles */}
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #00d4ff;
          border: 2px solid #060b19;
          box-shadow: 0 0 6px #00d4ff88;
          cursor: pointer;
          transition: box-shadow 0.2s;
        }
        input[type=range]::-webkit-slider-thumb:hover {
          box-shadow: 0 0 12px #00d4ffcc;
        }
        input[type=range]::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #00d4ff;
          border: 2px solid #060b19;
          box-shadow: 0 0 6px #00d4ff88;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}