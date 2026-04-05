// frontend/src/components/MachineViewer.jsx
import { useEffect, useRef, useState } from 'react'
import { calcOEE } from './OEEPanel'

const MachineViewer = ({ subsystemStates, healthScore, machineState }) => {
  const canvasRef          = useRef(null)
  const engineRef          = useRef(null)
  const sceneRef           = useRef(null)
  const hlRef              = useRef(null)
  const labelsRef          = useRef([])
  const resultRef          = useRef(null)
  const subsystemStatesRef = useRef(subsystemStates)
  const xrRef              = useRef(null)
  const hudMeshRef         = useRef(null)
  const hudTextureRef      = useRef(null)

  const [vrSupported, setVrSupported] = useState(false)
  const [vrActive,    setVrActive]    = useState(false)

  const colorMap = {
    green: [0.133, 0.8,   0.133],
    amber: [1.0,   0.667, 0.0  ],
    red:   [1.0,   0.133, 0.0  ],
  }

  // Keep ref in sync with prop
  useEffect(() => {
    subsystemStatesRef.current = subsystemStates
  }, [subsystemStates])

  // ── Check WebXR support on mount ──────────────────────────────
  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr')
        .then(supported => setVrSupported(supported))
        .catch(() => setVrSupported(false))
    }
  }, [])

  // ── Scene setup — runs once ───────────────────────────────────
  useEffect(() => {
    let cleanup = false

    const init = async () => {
      const BABYLON = await import('@babylonjs/core')
      await import('@babylonjs/loaders')

      if (cleanup || !canvasRef.current) return

      // ── Engine ──
      const engine = new BABYLON.Engine(canvasRef.current, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      })
      const scene = new BABYLON.Scene(engine)
      scene.clearColor = new BABYLON.Color4(0.024, 0.043, 0.098, 1) // #060b19
      engineRef.current = engine
      sceneRef.current  = scene

      // ── Camera ──
      const camera = new BABYLON.ArcRotateCamera(
        'cam', -Math.PI / 2.2, Math.PI / 3.5, 18,
        new BABYLON.Vector3(0, 1.5, 0), scene
      )
      camera.lowerRadiusLimit      = 8
      camera.upperRadiusLimit      = 30
      camera.upperBetaLimit        = Math.PI / 2.05
      camera.wheelDeltaPercentage  = 0.01
      camera.attachControl(canvasRef.current, true)
      camera.useAutoRotationBehavior = true
      camera.autoRotationBehavior.idleRotationSpeed    = 0.2
      camera.autoRotationBehavior.idleRotationWaitTime = 2000

      // ── Lighting ──
      const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene)
      hemi.intensity   = 0.7
      hemi.diffuse     = new BABYLON.Color3(0.9, 0.95, 1.0)
      hemi.groundColor = new BABYLON.Color3(0.1, 0.15, 0.25)

      const key = new BABYLON.DirectionalLight('key', new BABYLON.Vector3(-1, -2, -1), scene)
      key.position  = new BABYLON.Vector3(8, 12, 8)
      key.intensity = 1.4
      key.diffuse   = new BABYLON.Color3(1.0, 0.97, 0.9)

      const fill = new BABYLON.PointLight('fill', new BABYLON.Vector3(-6, 4, 6), scene)
      fill.intensity = 12
      fill.diffuse   = new BABYLON.Color3(0.3, 0.5, 1.0)

      // ── Ground ──
      const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 40, height: 40 }, scene)
      const gMat   = new BABYLON.StandardMaterial('gMat', scene)
      gMat.diffuseColor  = new BABYLON.Color3(0.025, 0.04, 0.07)
      gMat.specularColor = new BABYLON.Color3(0, 0, 0)
      ground.material    = gMat

      // Grid lines
      for (let i = -10; i <= 10; i += 2) {
        const mkGrid = (axis) => {
          const g = BABYLON.MeshBuilder.CreateBox(`g${axis}${i}`, {
            width:  axis === 'x' ? 40 : 0.025,
            height: 0.004,
            depth:  axis === 'x' ? 0.025 : 40,
          }, scene)
          g.position.set(axis === 'z' ? i : 0, 0.003, axis === 'x' ? i : 0)
          const m = new BABYLON.StandardMaterial(`gm${axis}${i}`, scene)
          m.emissiveColor = new BABYLON.Color3(0.0, 0.12, 0.28)
          g.material = m
        }
        mkGrid('x')
        mkGrid('z')
      }

      // ── HighlightLayer ──
      const hl = new BABYLON.HighlightLayer('hl', scene, {
        blurHorizontalSize: 1.2,
        blurVerticalSize:   1.2,
      })
      hlRef.current = hl

      // ── Load GLB ──
      try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync('', '/cnc.glb', '', scene)
        resultRef.current = result

        const meshes = result.meshes
        const root   = meshes[0]

        // Auto-scale to fit 10 units
        let min = new BABYLON.Vector3( Infinity,  Infinity,  Infinity)
        let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity)
        meshes.forEach(m => {
          if (!m.getBoundingInfo) return
          m.computeWorldMatrix(true)
          const bi = m.getBoundingInfo()
          if (!bi) return
          min = BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld)
          max = BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld)
        })

        const size    = max.subtract(min)
        const maxDim  = Math.max(size.x, size.y, size.z)
        const scale   = 10 / maxDim
        root.scaling  = new BABYLON.Vector3(scale, scale, scale)

        const centre  = min.add(max).scale(0.5)
        root.position = new BABYLON.Vector3(
          -centre.x * scale,
          -min.y   * scale,
          -centre.z * scale
        )

        // ── Floating labels ──
        const labelDefs = [
          { name: 'spindle', text: '◉ SPINDLE', pos: new BABYLON.Vector3(-4, 8,  0) },
          { name: 'bearing', text: '◎ BEARING', pos: new BABYLON.Vector3(-2, 6,  3) },
          { name: 'tool',    text: '▼ TOOL',    pos: new BABYLON.Vector3( 4, 5,  0) },
          { name: 'coolant', text: '~ COOLANT', pos: new BABYLON.Vector3( 2, 7, -3) },
        ]

        labelDefs.forEach(({ name, text, pos }) => {
          const plane = BABYLON.MeshBuilder.CreatePlane(`lbl_${name}`, {
            width: 2.4, height: 0.55,
          }, scene)
          plane.position      = pos
          plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL

          const dt  = new BABYLON.DynamicTexture(`dt_${name}`, { width: 320, height: 72 }, scene)
          const ctx = dt.getContext()

          const draw = (color) => {
            ctx.clearRect(0, 0, 320, 72)
            ctx.globalCompositeOperation = 'source-over'
            ctx.fillStyle = 'rgba(4,9,20,0.88)'
            ctx.fillRect(0, 0, 320, 72)
            ctx.strokeStyle = color + 'cc'
            ctx.lineWidth   = 2
            ctx.strokeRect(2, 2, 316, 68)
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(18, 36, 4, 0, Math.PI * 2)
            ctx.fill()
            ctx.font         = 'bold 20px monospace'
            ctx.fillStyle    = color
            ctx.textAlign    = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(text, 168, 36)
            dt.update()
          }

          draw('#00d4ff')

          const mat = new BABYLON.StandardMaterial(`lblMat_${name}`, scene)
          dt.hasAlpha                    = true
          mat.diffuseTexture             = dt
          mat.emissiveTexture            = dt
          mat.useAlphaFromDiffuseTexture = true
          mat.backFaceCulling            = false
          mat.alphaMode                  = 2
          plane.material                 = mat

          labelsRef.current.push({ name, plane, dt, draw })
        })

      } catch (err) {
        console.error('[MachineViewer] GLB load failed:', err)
        const fb = BABYLON.MeshBuilder.CreateBox('fb', { size: 4 }, scene)
        fb.position.y = 2
        const fm = new BABYLON.StandardMaterial('fm', scene)
        fm.emissiveColor = new BABYLON.Color3(0.05, 0.2, 0.4)
        fb.material = fm
        resultRef.current = { meshes: [fb] }
      }

      // ── VR HUD plane (hidden until VR starts) ──────────────────
      const hudPlane = BABYLON.MeshBuilder.CreatePlane(
        'hud', { width: 1.6, height: 1.0 }, scene
      )
      hudPlane.position  = new BABYLON.Vector3(2.5, 5, 0)
      hudPlane.isVisible = false
      hudMeshRef.current = hudPlane

      const hudTexture = new BABYLON.DynamicTexture(
        'hudTex', { width: 640, height: 400 }, scene
      )
      hudTextureRef.current = hudTexture

      const hudMat = new BABYLON.StandardMaterial('hudMat', scene)
      hudMat.diffuseTexture             = hudTexture
      hudMat.emissiveTexture            = hudTexture
      hudMat.backFaceCulling            = false
      hudMat.alphaMode                  = 2
      hudTexture.hasAlpha               = true
      hudMat.useAlphaFromDiffuseTexture = true
      hudPlane.material                 = hudMat

      // Render loop
      engine.runRenderLoop(() => { if (scene) scene.render() })

      const onResize = () => engine.resize()
      window.addEventListener('resize', onResize)
      engineRef.current._onResize = onResize
    }

    init()

    return () => {
      cleanup = true
      if (engineRef.current) {
        window.removeEventListener('resize', engineRef.current._onResize)
        engineRef.current.dispose()
        engineRef.current = null
        sceneRef.current  = null
      }
    }
  }, [])

  // ── Enter / Exit VR ───────────────────────────────────────────
  const toggleVR = async () => {
    const scene = sceneRef.current
    if (!scene) return

    if (vrActive && xrRef.current) {
      try {
        await xrRef.current.baseExperience.exitXRAsync()
      } catch (_) {}
      setVrActive(false)
      if (hudMeshRef.current) hudMeshRef.current.isVisible = false
      return
    }

    try {
      const BABYLON = await import('@babylonjs/core')

      // Ground mesh for teleportation floor
      const floorMeshes = scene.meshes.filter(m => m.name === 'ground')

      const xr = await scene.createDefaultXRExperienceAsync({
        floorMeshes,
        optionalFeatures:      true,
        disableTeleportation:  false,
      })
      xrRef.current = xr

      // Track XR state changes
      xr.baseExperience.onStateChangedObservable.add(state => {
        const isInXR = state === BABYLON.WebXRState.IN_XR
        setVrActive(isInXR)
        if (hudMeshRef.current) {
          hudMeshRef.current.isVisible = isInXR
        }
      })

      // Position HUD in front of user when first pose is known
      xr.baseExperience.onInitialXRPoseInitializedObservable.add(xrCamera => {
        if (!hudMeshRef.current) return
        const forward = xrCamera.getDirection(BABYLON.Axis.Z)
        // Place HUD 2m ahead and slightly to the right at eye level
        hudMeshRef.current.position = xrCamera.position
          .add(forward.scale(2.0))
          .add(new BABYLON.Vector3(0.8, 0, 0))
        hudMeshRef.current.lookAt(xrCamera.position)
      })

      await xr.baseExperience.enterXRAsync('immersive-vr', 'local-floor')
      setVrActive(true)
      if (hudMeshRef.current) hudMeshRef.current.isVisible = true

    } catch (err) {
      console.error('[VR] Failed to enter XR:', err)
      alert(
        'Could not start VR session.\n\n' +
        'Make sure you are using the Meta Quest Browser ' +
        'and the page is served over HTTP/HTTPS on your local network.\n\n' +
        'Navigate to http://<your-laptop-ip>:5173 on the Quest.'
      )
    }
  }

  // ── Subsystem colour updates ──────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current || !subsystemStates || !resultRef.current) return

    import('@babylonjs/core').then((BABYLON) => {
      if (!sceneRef.current || !hlRef.current) return

      const hl        = hlRef.current
      const allMeshes = resultRef.current.meshes.filter(
        m => m.getTotalVertices && m.getTotalVertices() > 0
      )

      if (allMeshes.length === 0) return

      hl.removeAllMeshes()

      const priority = { red: 3, amber: 2, green: 1 }
      let worst = 'green'
      Object.values(subsystemStates).forEach(s => {
        if ((priority[s] ?? 0) > (priority[worst] ?? 0)) worst = s
      })

      if (worst === 'red' || worst === 'amber') {
        const glowColor  = worst === 'red'
          ? new BABYLON.Color3(1.0, 0.05, 0.0)
          : new BABYLON.Color3(1.0, 0.55, 0.0)
        const glowCount  = Math.max(3, Math.floor(allMeshes.length * 0.25))
        const glowMeshes = allMeshes.slice(0, glowCount)
        glowMeshes.forEach(m => {
          try { hl.addMesh(m, glowColor) } catch (_) {}
        })
      }

      // Update floating label colours
      Object.entries(subsystemStates).forEach(([name, status]) => {
        const lbl = labelsRef.current.find(l => l.name === name)
        if (!lbl) return
        const lc = { green: '#22cc22', amber: '#ffaa00', red: '#ff2200' }
        lbl.draw(lc[status] ?? '#22cc22')
      })
    })
  }, [subsystemStates])

  // ── Critical health — full red glow ──────────────────────────
  useEffect(() => {
    if (!hlRef.current || !resultRef.current || !sceneRef.current) return
    if (healthScore < 30) {
      import('@babylonjs/core').then((BABYLON) => {
        if (!hlRef.current) return
        const allMeshes = resultRef.current.meshes.filter(
          m => m.getTotalVertices && m.getTotalVertices() > 0
        )
        allMeshes.forEach(m => {
          try { hlRef.current.addMesh(m, new BABYLON.Color3(0.9, 0.0, 0.0)) } catch (_) {}
        })
      })
    }
  }, [healthScore])

  // ── Update VR HUD whenever machineState changes ───────────────
  useEffect(() => {
    const texture = hudTextureRef.current
    if (!texture || !machineState) return

    // Only paint if VR is active — saves GPU when not in headset
    if (!vrActive && hudMeshRef.current && !hudMeshRef.current.isVisible) return

    const ctx = texture.getContext()
    const W = 640, H = 400

    // Background
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(5, 10, 20, 0.90)'
    roundRect(ctx, 0, 0, W, H, 20)
    ctx.fill()

    // Border colour based on health
    const h = machineState.health_score ?? 100
    const borderCol = h >= 70 ? '#00ff88' : h >= 40 ? '#ffaa00' : '#ff3300'
    ctx.strokeStyle = borderCol
    ctx.lineWidth   = 4
    roundRect(ctx, 2, 2, W - 4, H - 4, 18)
    ctx.stroke()

    // Title bar
    ctx.fillStyle = 'rgba(0, 180, 255, 0.12)'
    roundRect(ctx, 4, 4, W - 8, 52, 14)
    ctx.fill()
    ctx.font      = 'bold 20px monospace'
    ctx.fillStyle = '#a0c8ff'
    ctx.fillText('PrognoSys  ·  CNC-01  LIVE TELEMETRY', 20, 36)

    // Divider
    ctx.strokeStyle = '#1a3060'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(20, 60); ctx.lineTo(W - 20, 60)
    ctx.stroke()

    // Health score — large centrepiece
    const hColour = h >= 70 ? '#00ff88' : h >= 40 ? '#ffaa00' : '#ff3300'
    ctx.font      = 'bold 64px monospace'
    ctx.fillStyle = hColour
    ctx.fillText(`${h.toFixed(1)}%`, 20, 135)

    ctx.font      = '15px monospace'
    ctx.fillStyle = '#556688'
    ctx.fillText('COMPOSITE HEALTH SCORE', 20, 155)

    // RUL — top right
    ctx.font      = 'bold 36px monospace'
    ctx.fillStyle = '#88aadd'
    ctx.textAlign = 'right'
    ctx.fillText(`${(machineState.rul_hours ?? 168).toFixed(0)}h`, W - 20, 115)
    ctx.font      = '14px monospace'
    ctx.fillStyle = '#445566'
    ctx.fillText('RUL REMAINING', W - 20, 135)
    ctx.textAlign = 'left'

    // Divider
    ctx.strokeStyle = '#1a3060'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(20, 168); ctx.lineTo(W - 20, 168)
    ctx.stroke()

    // Sensor rows — 2 columns
    const leftRows = [
      { label: 'VIBRATION RMS', value: `${(machineState.vibration_rms ?? 0).toFixed(2)} mm/s`  },
      { label: 'SPINDLE LOAD',  value: `${(machineState.spindle_load  ?? 0).toFixed(1)} %`      },
    ]
    const rightRows = [
      { label: 'TEMPERATURE',   value: `${(machineState.temperature_c ?? 0).toFixed(1)} °C`     },
      { label: 'TOOL LIFE',     value: `${(machineState.tool_life_pct ?? 100).toFixed(1)} %`    },
    ]

    leftRows.forEach(({ label, value }, i) => {
      const y = 205 + i * 48
      ctx.font      = '13px monospace'
      ctx.fillStyle = '#445577'
      ctx.fillText(label, 20, y)
      ctx.font      = 'bold 22px monospace'
      ctx.fillStyle = '#cce0ff'
      ctx.fillText(value, 20, y + 24)
    })

    rightRows.forEach(({ label, value }, i) => {
      const y = 205 + i * 48
      ctx.font      = '13px monospace'
      ctx.fillStyle = '#445577'
      ctx.fillText(label, W / 2 + 20, y)
      ctx.font      = 'bold 22px monospace'
      ctx.fillStyle = '#cce0ff'
      ctx.fillText(value, W / 2 + 20, y + 24)
    })

    // Divider
    ctx.strokeStyle = '#1a3060'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(20, 308); ctx.lineTo(W - 20, 308)
    ctx.stroke()

    // Anomaly status badge
    const isAnomaly = machineState.is_anomaly || machineState.lstm_anomaly
    ctx.fillStyle   = isAnomaly ? '#cc1100' : '#006633'
    roundRect(ctx, 20, 318, 260, 40, 8)
    ctx.fill()
    ctx.font      = 'bold 15px monospace'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(
      isAnomaly ? '⚠  ANOMALY DETECTED' : '✓  NOMINAL OPERATION',
      34, 342
    )

    // Active anomaly flags
    if (machineState.anomaly_flags?.length > 0) {
      ctx.font      = '13px monospace'
      ctx.fillStyle = '#ff8855'
      ctx.fillText(
        machineState.anomaly_flags.slice(0, 2).join('  ·  '),
        300, 342
      )
    }

    // Anomaly score bar
    const score = machineState.anomaly_score ?? 0
    ctx.fillStyle = '#0a1428'
    roundRect(ctx, 20, 364, W - 40, 20, 4)
    ctx.fill()
    const barW = Math.max(0, Math.min(1, score)) * (W - 40)
    ctx.fillStyle = score > 0.7 ? '#ff3300' : score > 0.4 ? '#ffaa00' : '#00aa66'
    roundRect(ctx, 20, 364, barW, 20, 4)
    ctx.fill()
    ctx.font      = '11px monospace'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`ANOMALY SCORE  ${(score * 100).toFixed(0)}%`, 28, 379)

    // Inside drawHUD, after the anomaly bar, before texture.update():
    const { oee, availability, performance, quality } = calcOEE(machineState)
    const oeeColor = oee >= 85 ? '#00ff88' : oee >= 65 ? '#ffaa00' : '#ff3300'
    ctx.font      = 'bold 13px monospace'
    ctx.fillStyle = '#445577'
    ctx.textAlign = 'left'
    ctx.fillText('OEE', 20, 400 - 10)
    ctx.font      = 'bold 28px monospace'
    ctx.fillStyle = oeeColor
    ctx.fillText(`${oee.toFixed(1)}%`, 20, 400 + 18)
    // A P Q mini bars
    const barLabels = [
      { label: 'A', val: availability },
      { label: 'P', val: performance  },
      { label: 'Q', val: quality      },
    ]
    barLabels.forEach(({ label, val }, i) => {
      const bx = W / 2 + 20 + i * 120
      const bc = val >= 85 ? '#00ff88' : val >= 65 ? '#ffaa00' : '#ff3300'
      ctx.font      = '11px monospace'
      ctx.fillStyle = '#445577'
      ctx.fillText(label, bx, 400)
      ctx.fillStyle = '#0a1428'
      roundRect(ctx, bx, 405, 100, 12, 3); ctx.fill()
      ctx.fillStyle = bc
      roundRect(ctx, bx, 405, val, 12, 3); ctx.fill()
      ctx.font      = 'bold 11px monospace'
      ctx.fillStyle = bc
      ctx.fillText(`${val.toFixed(0)}%`, bx, 430)
    })
    texture.update()
  }, [machineState, vrActive])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
      />

      {/* Health badge */}
      <div style={{
        position:   'absolute', top: 10, left: 12,
        fontFamily: "'Share Tech Mono', monospace",
        fontSize:   '11px', letterSpacing: '2px',
        color: healthScore >= 70 ? '#22cc22'
             : healthScore >= 40 ? '#ffaa00' : '#ff2200',
        background: 'rgba(4,9,20,0.82)',
        padding:    '4px 10px',
        border: `1px solid ${
          healthScore >= 70 ? '#22cc2255'
          : healthScore >= 40 ? '#ffaa0055' : '#ff220055'
        }`,
        borderRadius: '3px',
        transition:   'all 0.5s ease',
      }}>
        HEALTH {healthScore?.toFixed(1) ?? '--'}%
      </div>

      {/* HUD corner brackets */}
      {[
        { top: 0,    left: 0,   borderTop:    '2px solid', borderLeft:   '2px solid' },
        { top: 0,    right: 0,  borderTop:    '2px solid', borderRight:  '2px solid' },
        { bottom: 0, left: 0,   borderBottom: '2px solid', borderLeft:   '2px solid' },
        { bottom: 0, right: 0,  borderBottom: '2px solid', borderRight:  '2px solid' },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', width: 18, height: 18,
          borderColor: '#00d4ff55', ...s,
        }} />
      ))}

      {/* VR Button — shown only when WebXR is supported */}
      {vrSupported && (
        <button
          onClick={toggleVR}
          style={{
            position:      'absolute',
            bottom:        '20px',
            right:         '20px',
            padding:       '10px 22px',
            background:    vrActive
              ? 'linear-gradient(135deg, #cc2200, #991100)'
              : 'linear-gradient(135deg, #0055ff, #0033bb)',
            color:         '#ffffff',
            border:        'none',
            borderRadius:  '8px',
            cursor:        'pointer',
            fontFamily:    'monospace',
            fontWeight:    'bold',
            fontSize:      '13px',
            letterSpacing: '1.5px',
            boxShadow:     vrActive
              ? '0 4px 20px rgba(200,30,0,0.5)'
              : '0 4px 20px rgba(0,80,255,0.45)',
            zIndex:        10,
            transition:    'all 0.3s ease',
          }}
        >
          {vrActive ? '⏹  EXIT VR' : '🥽  ENTER VR'}
        </button>
      )}

      {/* Desktop fallback hint — shown when WebXR not available */}
      {!vrSupported && (
        <div style={{
          position:   'absolute', bottom: '20px', right: '20px',
          padding:    '8px 14px',
          background: 'rgba(10, 18, 35, 0.88)',
          color:      '#334466',
          borderRadius: '8px',
          fontFamily:   'monospace',
          fontSize:     '11px',
          letterSpacing: '1px',
          border:       '1px solid #1a3050',
        }}>
          🥽 VR — open on Quest Browser
        </div>
      )}

      {/* Credit */}
      <div style={{
        position:   'absolute', bottom: 6, right: 10,
        fontFamily: 'monospace', fontSize: '8px',
        color:      '#1a3050', letterSpacing: '1px',
      }}>
        EMCONICN CNC LATHE — DIGITAL TWIN
      </div>
    </div>
  )
}

// ── Helper: rounded rectangle canvas path ─────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y,     x + w, y + r,     r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x,     y + h, x,     y + h - r, r)
  ctx.lineTo(x,    y + r)
  ctx.arcTo(x,     y,     x + r, y,         r)
  ctx.closePath()
}

export default MachineViewer
