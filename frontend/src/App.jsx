// frontend/src/App.jsx
import { useState, useEffect, useRef } from 'react'
import './index.css'
import { useWebSocket } from './hooks/useWebSocket'
import HealthScoreCard from './components/HealthScoreCard'
import SensorGauges from './components/SensorGauges'
import MachineViewer from './components/MachineViewer'
import WhatIfSimulator from './components/WhatIfSimulator'
import TimeTravel from './components/TimeTravel'
import FMEAPanel from './components/FMEAPanel'

const WS_URL = 'ws://127.0.0.1:8000/api/sensor/ws/machine-state'

// ── Connection Status Indicator ──────────────────────────────
function StatusDot({ status }) {
  const colors = {
    connected:    'var(--status-green)',
    connecting:   'var(--status-amber)',
    reconnecting: 'var(--status-amber)',
    disconnected: 'var(--status-red)',
  }
  const labels = {
    connected:    'LIVE',
    connecting:   'CONNECTING',
    reconnecting: 'RECONNECTING',
    disconnected: 'OFFLINE',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: colors[status] || 'var(--status-red)',
        boxShadow: `0 0 6px ${colors[status] || 'var(--status-red)'}`,
        animation: status === 'connected' ? 'pulse-red 2s infinite' : 'none',
      }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px',
        color: colors[status], letterSpacing: '0.1em',
      }}>
        {labels[status] || 'OFFLINE'}
      </span>
    </div>
  )
}

// ── Top Header Bar ───────────────────────────────────────────
function Header({ status, machineId, timestamp }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header style={{
      height: '48px', flexShrink: 0,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px', zIndex: 100,
    }}>
      {/* Left: Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '28px', height: '28px',
          border: '1px solid var(--accent-blue)',
          borderRadius: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" stroke="var(--accent-blue)" strokeWidth="1.5"/>
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5L5 11M11 5l1.5-1.5"
              stroke="var(--accent-blue)" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
          </svg>
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '18px',
            fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: '0.08em',
            lineHeight: 1,
          }}>
            PROGNOSYS
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            color: 'var(--text-muted)', letterSpacing: '0.15em',
          }}>
            DIGITAL TWIN PREDICTIVE MAINTENANCE
          </div>
        </div>
      </div>

      {/* Center: Machine ID */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '12px',
          color: 'var(--text-secondary)',
          padding: '4px 12px',
          border: '1px solid var(--border-subtle)',
          borderRadius: '2px',
        }}>
          MACHINE: <span style={{ color: 'var(--accent-blue)' }}>{machineId}</span>
        </div>
        <StatusDot status={status} />
      </div>

      {/* Right: Clock */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '13px',
        color: 'var(--text-secondary)', letterSpacing: '0.05em',
      }}>
        {time}
      </div>
    </header>
  )
}

// ── Panel Header Label ───────────────────────────────────────
export function PanelLabel({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: '9px',
      letterSpacing: '0.2em', textTransform: 'uppercase',
      color: 'var(--text-muted)', padding: '8px 12px 6px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', gap: '8px',
    }}>
      <div style={{
        width: '4px', height: '4px', borderRadius: '50%',
        background: 'var(--accent-blue)',
        boxShadow: '0 0 4px var(--accent-blue)',
      }} />
      {children}
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const { state, status } = useWebSocket(WS_URL)
  const [fmeaVisible, setFmeaVisible] = useState(false)
  const prevAnomalyRef = useRef(false)

  // Auto-show FMEA panel when anomaly is detected
  useEffect(() => {
    if (state.is_anomaly && !prevAnomalyRef.current) {
      setFmeaVisible(true)
    }
    if (!state.is_anomaly && prevAnomalyRef.current) {
      setFmeaVisible(false)
    }
    prevAnomalyRef.current = state.is_anomaly
  }, [state.is_anomaly])

  // Critical alarm vignette — health below 30
  const isCritical = state.health_score < 30

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Critical alarm vignette overlay */}
      {isCritical && <div className="alarm-vignette" />}

      {/* Header */}
      <Header
        status={status}
        machineId={state.machine_id}
        timestamp={state.timestamp}
      />

      {/* 3-Panel Layout */}
      <div style={{
        flex: 1, display: 'flex', overflow: 'hidden',
        background: 'var(--bg-void)',
      }}>

        {/* ── LEFT PANEL: What-If Simulator ── */}
        <aside style={{
          width: '260px', flexShrink: 0,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <PanelLabel>What-If Simulator</PanelLabel>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            <WhatIfSimulator liveState={state} />
          </div>
        </aside>

        {/* ── CENTER PANEL: 3D Viewer + Gauges ── */}
        <main style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', minWidth: 0,
        }}>
          {/* 3D Machine Viewer — top 60% */}
          <div style={{
            flex: '0 0 60%',
            background: 'var(--bg-base)',
            borderBottom: '1px solid var(--border-subtle)',
            position: 'relative',
          }}>
            <PanelLabel>3D Digital Twin — CNC-01</PanelLabel>
            <div style={{ height: 'calc(100% - 29px)' }}>
              <MachineViewer
                subsystemStates={state.subsystem_states}
                healthScore={state.health_score}
              />
            </div>
          </div>

          {/* Sensor Gauges — bottom 40% */}
          <div style={{
            flex: '0 0 44%',
            background: 'var(--bg-surface)',
            overflow: 'hidden',
          }}>
            <PanelLabel>Live Sensor Telemetry</PanelLabel>
            <div style={{ height: 'calc(100% - 29px)', padding: '4px 8px', overflowY: 'auto' }}>
              <SensorGauges machineState={state} />
            </div>
          </div>
        </main>

        {/* ── RIGHT PANEL: Health + FMEA + TimeTravel ── */}
        <aside style={{
          width: '300px', flexShrink: 0,
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Health Score Card */}
          <div style={{ flexShrink: 0 }}>
            <PanelLabel>Machine Health</PanelLabel>
            <HealthScoreCard state={state} />
          </div>

          <div className="divider" />

          {/* FMEA Panel — slides in when anomaly detected */}
          <div style={{
            flexShrink: 0,
            maxHeight: fmeaVisible ? '320px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <PanelLabel>FMEA — Fault Analysis</PanelLabel>
            <FMEAPanel
              anomalyFlags={state.anomaly_flags}
              isVisible={fmeaVisible}
            />
          </div>

          {fmeaVisible && <div className="divider" />}

          {/* Time Travel Slider */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <PanelLabel>Predictive Time-Travel</PanelLabel>
            <div style={{ flex: 1, overflow: 'hidden', padding: '8px 12px' }}>
              <TimeTravel
                trajectory={state.deterioration_trajectory}
                currentState={state}
              />
            </div>
          </div>
        </aside>

      </div>
    </div>
  )
}