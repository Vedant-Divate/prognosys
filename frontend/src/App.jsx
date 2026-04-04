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
  // ── Health Certificate PDF generation ─────────────────────
  useEffect(() => {
    const handler = async () => {
      const { jsPDF } = await import('jspdf')
      await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210, pageH = 297

      // ── Dark header bar ──
      doc.setFillColor(6, 11, 25)
      doc.rect(0, 0, W, 38, 'F')

      // Header accent line
      doc.setFillColor(0, 212, 255)
      doc.rect(0, 38, W, 1.2, 'F')

      // Logo text
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.setTextColor(0, 212, 255)
      doc.text('PROGNOSYS', 14, 18)

      // Subtitle
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(74, 111, 165)
      doc.text('DIGITAL TWIN PREDICTIVE MAINTENANCE SYSTEM', 14, 25)

      // Certificate title  
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(180, 200, 220)
      doc.text('DIGITAL TWIN HEALTH CERTIFICATE', 14, 33)

      // Right side: machine ID + timestamp
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(74, 111, 165)
      doc.text(`MACHINE: ${state.machine_id}`, W - 14, 18, { align: 'right' })
      doc.text(`GENERATED: ${new Date().toLocaleString()}`, W - 14, 24, { align: 'right' })
      doc.text(`REPORT ID: CERT-${Date.now().toString(36).toUpperCase()}`, W - 14, 30, { align: 'right' })

      // ── Health score stamp ──
      const hs = state.health_score
      const hsPass = hs >= 70
      const hsColor = hs >= 70
        ? [34, 204, 34]
        : hs >= 40 ? [255, 170, 0] : [255, 34, 0]

      // Score circle background
      doc.setFillColor(10, 15, 30)
      doc.circle(W - 35, 68, 22, 'F')
      doc.setDrawColor(...hsColor)
      doc.setLineWidth(1.5)
      doc.circle(W - 35, 68, 22, 'S')

      // Score number
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(26)
      doc.setTextColor(...hsColor)
      doc.text(`${hs.toFixed(0)}`, W - 35, 72, { align: 'center' })

      doc.setFontSize(8)
      doc.setTextColor(...hsColor)
      doc.text('HEALTH %', W - 35, 80, { align: 'center' })

      // PASS / ATTENTION stamp
      const stampColor = hsPass ? [34, 204, 34] : [255, 34, 0]
      const stampText  = hsPass ? 'PASS' : 'ATTENTION REQUIRED'
      doc.setFillColor(...stampColor.map(c => Math.floor(c * 0.15)))
      doc.setDrawColor(...stampColor)
      doc.setLineWidth(2)
      doc.roundedRect(W - 62, 86, 48, 12, 2, 2, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...stampColor)
      doc.text(stampText, W - 38, 94, { align: 'center' })

      // ── Section: Machine Summary ──
      let y = 48
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(0, 212, 255)
      doc.text('MACHINE SUMMARY', 14, y)
      doc.setFillColor(0, 212, 255)
      doc.rect(14, y + 1.5, 60, 0.4, 'F')
      y += 8

      const summaryRows = [
        ['Machine ID',       state.machine_id],
        ['Status',           state.health_score >= 70 ? 'NOMINAL' : state.health_score >= 40 ? 'DEGRADED' : 'CRITICAL'],
        ['Health Score',     `${state.health_score.toFixed(1)}%`],
        ['RUL Estimate',     `${state.rul_hours.toFixed(0)} hours`],
        ['Anomaly Detected', state.is_anomaly ? 'YES' : 'NO'],
        ['Active Flags',     state.anomaly_flags?.join(', ') || 'None'],
      ]

      doc.autoTable({
        startY: y,
        head: [],
        body: summaryRows,
        theme: 'plain',
        styles: {
          font: 'helvetica', fontSize: 9,
          textColor: [140, 170, 200],
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [74, 111, 165], cellWidth: 50 },
          1: { textColor: [180, 210, 240] },
        },
        margin: { left: 14, right: 14 },
        tableWidth: 110,
      })

      // ── Section: Sensor Readings ──
      y = doc.lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(0, 212, 255)
      doc.text('SENSOR READINGS', 14, y)
      doc.setFillColor(0, 212, 255)
      doc.rect(14, y + 1.5, 60, 0.4, 'F')
      y += 6

      doc.autoTable({
        startY: y,
        head: [['Parameter', 'Value', 'Unit', 'Threshold', 'Status']],
        body: [
          [
            'Vibration RMS',
            state.vibration_rms.toFixed(2),
            'mm/s', '4.5 mm/s',
            state.vibration_rms > 4.5 ? 'CRITICAL' : state.vibration_rms > 3.0 ? 'WARNING' : 'NOMINAL',
          ],
          [
            'Spindle Load',
            state.spindle_load.toFixed(1),
            '%', '85%',
            state.spindle_load > 85 ? 'CRITICAL' : state.spindle_load > 75 ? 'WARNING' : 'NOMINAL',
          ],
          [
            'Temperature',
            state.temperature_c.toFixed(1),
            '°C', '85°C',
            state.temperature_c > 85 ? 'CRITICAL' : state.temperature_c > 75 ? 'WARNING' : 'NOMINAL',
          ],
          [
            'Tool Life',
            state.tool_life_pct.toFixed(1),
            '%', '20%',
            state.tool_life_pct < 20 ? 'CRITICAL' : state.tool_life_pct < 40 ? 'WARNING' : 'NOMINAL',
          ],
        ],
        theme: 'grid',
        headStyles: {
          fillColor: [10, 20, 40],
          textColor: [0, 212, 255],
          fontStyle: 'bold', fontSize: 8,
          lineColor: [26, 42, 74], lineWidth: 0.3,
        },
        bodyStyles: {
          textColor: [140, 170, 200],
          fontSize: 8,
          fillColor: [6, 11, 25],
          lineColor: [20, 35, 60], lineWidth: 0.2,
        },
        alternateRowStyles: {
          fillColor: [10, 18, 35],
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const txt = data.cell.text[0]
            const color = txt === 'CRITICAL' ? [255, 34, 0]
              : txt === 'WARNING' ? [255, 170, 0]
              : [34, 204, 34]
            data.doc.setTextColor(...color)
            data.doc.setFont('helvetica', 'bold')
            data.doc.text(
              txt,
              data.cell.x + data.cell.width / 2,
              data.cell.y + data.cell.height / 2 + 1,
              { align: 'center' }
            )
            // Return false prevents default text draw
            return false
          }
        },
        margin: { left: 14, right: 14 },
      })

      // ── Section: Subsystem States ──
      y = doc.lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(0, 212, 255)
      doc.text('SUBSYSTEM STATUS', 14, y)
      doc.setFillColor(0, 212, 255)
      doc.rect(14, y + 1.5, 65, 0.4, 'F')
      y += 8

      const subsystems = Object.entries(state.subsystem_states ?? {})
      const colW = (W - 28) / Math.max(subsystems.length, 1)
      subsystems.forEach(([name, subStatus], i) => {
        const c = subStatus === 'red'   ? [255, 34, 0]
                : subStatus === 'amber' ? [255, 170, 0]
                : [34, 204, 34]
        const x = 14 + i * colW
        doc.setFillColor(10, 20, 40)
        doc.setDrawColor(...c)
        doc.setLineWidth(0.5)
        doc.roundedRect(x, y, colW - 4, 16, 2, 2, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...c)
        doc.text(name.toUpperCase(), x + (colW - 4) / 2, y + 6, { align: 'center' })
        doc.setFontSize(7)
        doc.text(subStatus.toUpperCase(), x + (colW - 4) / 2, y + 12, { align: 'center' })
      })

      // ── AI Models section ──
      y += 24
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(0, 212, 255)
      doc.text('AI DIAGNOSTIC MODELS', 14, y)
      doc.setFillColor(0, 212, 255)
      doc.rect(14, y + 1.5, 72, 0.4, 'F')
      y += 6

      doc.autoTable({
        startY: y,
        head: [['Model', 'Type', 'Result']],
        body: [
          ['Isolation Forest', 'Point Anomaly Detection',
            state.is_anomaly ? 'ANOMALY DETECTED' : 'NOMINAL'],
          ['LSTM Autoencoder', 'Sequential Pattern Detection',
            state.lstm_anomaly ? 'PATTERN ANOMALY' : 'NOMINAL'],
          ['Ridge Regression', 'RUL & Health Prediction',
            `Health: ${state.health_score.toFixed(1)}% | RUL: ${state.rul_hours.toFixed(0)}h`],
        ],
        theme: 'grid',
        headStyles: {
          fillColor: [10, 20, 40], textColor: [0, 212, 255],
          fontStyle: 'bold', fontSize: 8,
          lineColor: [26, 42, 74], lineWidth: 0.3,
        },
        bodyStyles: {
          textColor: [140, 170, 200], fontSize: 8,
          fillColor: [6, 11, 25],
          lineColor: [20, 35, 60], lineWidth: 0.2,
        },
        alternateRowStyles: { fillColor: [10, 18, 35] },
        margin: { left: 14, right: 14 },
      })

      // ── Footer ──
      y = pageH - 18
      doc.setFillColor(6, 11, 25)
      doc.rect(0, y - 4, W, 22, 'F')
      doc.setFillColor(0, 212, 255)
      doc.rect(0, y - 4, W, 0.4, 'F')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(42, 58, 90)
      doc.text(
        'Generated by PrognoSys Digital Twin System — Trimiti Innovations Hackathon 2026',
        W / 2, y + 2, { align: 'center' }
      )
      doc.text(
        'This report is auto-generated. Verify with certified maintenance personnel before action.',
        W / 2, y + 7, { align: 'center' }
      )
      doc.text(
        `CNC-01 | ${new Date().toISOString()}`,
        W / 2, y + 12, { align: 'center' }
      )

      // ── Save ──
      doc.save(`PrognoSys_HealthCert_${state.machine_id}_${Date.now()}.pdf`)
    }

    window.addEventListener('download-health-cert', handler)
    return () => window.removeEventListener('download-health-cert', handler)
  }, [state])

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