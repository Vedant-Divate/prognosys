import './index.css'


export default function App() {
  
  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-void)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        fontFamily: 'var(--font-display)',
      }}
    >
      <div className="panel corner-tl corner-br" style={{ padding: '40px 60px', textAlign: 'center' }}>
        <div className="section-label" style={{ marginBottom: '12px' }}>SYSTEM STATUS</div>
        <div style={{ fontSize: '48px', fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: '0.05em' }}>
          PROGNOSYS
        </div>
        <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12px', marginTop: '8px' }}>
          Digital Twin Predictive Maintenance — CNC-01
        </div>
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <span className="badge badge-online">DESIGN SYSTEM ✓</span>
          <span className="badge badge-online">VITE ✓</span>
          <span className="badge badge-online">TAILWIND ✓</span>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
        Phase 5 scaffold verified — proceeding to Step 13
      </div>
    </div>
  )
}