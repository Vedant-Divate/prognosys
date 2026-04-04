// frontend/src/components/MachineViewer.jsx
import { useEffect, useRef } from 'react'

const MachineViewer = ({ subsystemStates, healthScore }) => {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const sceneRef = useRef(null)
  const meshesRef = useRef({})
  const hlRef = useRef(null)
  const labelsRef = useRef([])
  const prevStatesRef = useRef({})

  // ── Colour palette (matching CSS vars) ──────────────────────
  const COLORS = {
    green: { r: 0.133, g: 0.8,   b: 0.133 },  // #22cc22
    amber: { r: 1.0,   g: 0.667, b: 0.0   },  // #ffaa00
    red:   { r: 1.0,   g: 0.133, b: 0.0   },  // #ff2200
    blue:  { r: 0.0,   g: 0.831, b: 1.0   },  // #00d4ff
    body:  { r: 0.1,   g: 0.14,  b: 0.2   },  // dark machine body
  }

  // ── Scene setup — runs once ──────────────────────────────────
  useEffect(() => {
    let BABYLON
    let cleanup = false

    const init = async () => {
      // Dynamic import so Vite bundles it correctly
      BABYLON = await import('@babylonjs/core')

      if (cleanup || !canvasRef.current) return

      // ── Engine & Scene ──
      const engine = new BABYLON.Engine(canvasRef.current, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      })
      const scene = new BABYLON.Scene(engine)
      scene.clearColor = new BABYLON.Color4(0.024, 0.043, 0.098, 1) // #060b19
      engineRef.current = engine
      sceneRef.current = scene

      // ── Camera ──
      const camera = new BABYLON.ArcRotateCamera(
        'cam', -Math.PI / 3, Math.PI / 3.2, 14,
        new BABYLON.Vector3(0, 0.5, 0), scene
      )
      camera.lowerRadiusLimit = 8
      camera.upperRadiusLimit = 22
      camera.upperBetaLimit = Math.PI / 2.1
      camera.attachControl(canvasRef.current, true)
      // Auto-rotate
      camera.useAutoRotationBehavior = true
      camera.autoRotationBehavior.idleRotationSpeed = 0.25
      camera.autoRotationBehavior.idleRotationWaitTime = 1500

      // ── Lights ──
      const hemi = new BABYLON.HemisphericLight(
        'hemi', new BABYLON.Vector3(0, 1, 0), scene
      )
      hemi.intensity = 0.4
      hemi.diffuse = new BABYLON.Color3(0.6, 0.8, 1.0)

      const spot = new BABYLON.SpotLight(
        'spot',
        new BABYLON.Vector3(5, 8, -5),
        new BABYLON.Vector3(-1, -1.5, 1),
        Math.PI / 3, 2, scene
      )
      spot.intensity = 60
      spot.diffuse = new BABYLON.Color3(0.0, 0.831, 1.0)

      const fillLight = new BABYLON.PointLight(
        'fill', new BABYLON.Vector3(-4, 2, 4), scene
      )
      fillLight.intensity = 8
      fillLight.diffuse = new BABYLON.Color3(0.2, 0.4, 0.8)

      // ── Helper: create PBR material ──
      const makeMat = (name, baseColor, emissive = COLORS.green) => {
        const mat = new BABYLON.PBRMaterial(name, scene)
        mat.baseColor = new BABYLON.Color3(baseColor.r, baseColor.g, baseColor.b)
        mat.emissiveColor = new BABYLON.Color3(emissive.r * 0.3, emissive.g * 0.3, emissive.b * 0.3)
        mat.metallic = 0.7
        mat.roughness = 0.35
        return mat
      }

      // ── CNC Machine Body (main cabinet) ──
      const body = BABYLON.MeshBuilder.CreateBox('body', {
        width: 4, height: 3.2, depth: 3.5,
      }, scene)
      body.position.y = 1.6
      body.material = makeMat('bodyMat', COLORS.body, COLORS.blue)
      body.material.metallic = 0.85
      body.material.roughness = 0.25

      // Body panel lines (thin boxes for visual detail)
      const panelTop = BABYLON.MeshBuilder.CreateBox('panelTop', {
        width: 4.05, height: 0.05, depth: 3.55,
      }, scene)
      panelTop.position.y = 3.25
      panelTop.material = (() => {
        const m = new BABYLON.PBRMaterial('panelTopMat', scene)
        m.baseColor = new BABYLON.Color3(0.0, 0.6, 0.9)
        m.emissiveColor = new BABYLON.Color3(0.0, 0.3, 0.5)
        m.metallic = 1; m.roughness = 0.1
        return m
      })()

      // ── Spindle Housing ──
      const spindleHousing = BABYLON.MeshBuilder.CreateCylinder('spindle', {
        diameter: 1.1, height: 1.8, tessellation: 32,
      }, scene)
      spindleHousing.position.set(0, 3.9, 0)
      spindleHousing.material = makeMat('spindleMat', { r: 0.15, g: 0.18, b: 0.25 }, COLORS.green)

      // Spindle cap
      const spindleCap = BABYLON.MeshBuilder.CreateCylinder('spindleCap', {
        diameter: 0.7, height: 0.3, tessellation: 32,
      }, scene)
      spindleCap.position.set(0, 3.05, 0)
      spindleCap.material = makeMat('spindleCapMat', { r: 0.2, g: 0.22, b: 0.3 }, COLORS.blue)

      // ── Bearing Ring ──
      const bearing = BABYLON.MeshBuilder.CreateTorus('bearing', {
        diameter: 1.4, thickness: 0.22, tessellation: 40,
      }, scene)
      bearing.position.set(0, 3.1, 0)
      bearing.material = makeMat('bearingMat', { r: 0.25, g: 0.25, b: 0.3 }, COLORS.green)

      // ── Tool (tapered cylinder) ──
      const tool = BABYLON.MeshBuilder.CreateCylinder('tool', {
        diameterTop: 0.08, diameterBottom: 0.32,
        height: 0.9, tessellation: 16,
      }, scene)
      tool.position.set(0, 2.6, 0)
      tool.material = makeMat('toolMat', { r: 0.5, g: 0.45, b: 0.3 }, COLORS.green)
      tool.material.metallic = 0.95
      tool.material.roughness = 0.1

      // ── Coolant Nozzle assembly ──
      const coolantArm = BABYLON.MeshBuilder.CreateBox('coolant', {
        width: 1.4, height: 0.12, depth: 0.12,
      }, scene)
      coolantArm.position.set(1.1, 2.9, 0.6)
      coolantArm.rotation.z = -0.3
      coolantArm.material = makeMat('coolantMat', { r: 0.1, g: 0.25, b: 0.4 }, COLORS.green)

      const coolantNozzle = BABYLON.MeshBuilder.CreateCylinder('coolantNozzle', {
        diameterTop: 0.06, diameterBottom: 0.14, height: 0.22, tessellation: 12,
      }, scene)
      coolantNozzle.position.set(1.75, 2.72, 0.6)
      coolantNozzle.rotation.z = Math.PI / 2
      coolantNozzle.material = coolantArm.material

      // ── Worktable ──
      const table = BABYLON.MeshBuilder.CreateBox('worktable', {
        width: 4.5, height: 0.18, depth: 3.8,
      }, scene)
      table.position.y = 0.09
      table.material = (() => {
        const m = new BABYLON.PBRMaterial('tableMat', scene)
        m.baseColor = new BABYLON.Color3(0.08, 0.12, 0.18)
        m.metallic = 0.9; m.roughness = 0.2
        return m
      })()

      // Table T-slots (decorative strips)
      for (let i = -1.5; i <= 1.5; i += 1.5) {
        const slot = BABYLON.MeshBuilder.CreateBox(`slot${i}`, {
          width: 4.5, height: 0.04, depth: 0.08,
        }, scene)
        slot.position.set(0, 0.2, i)
        slot.material = (() => {
          const m = new BABYLON.PBRMaterial(`slotMat${i}`, scene)
          m.baseColor = new BABYLON.Color3(0.04, 0.07, 0.1)
          m.metallic = 1; m.roughness = 0.3
          return m
        })()
      }

      // ── Floor reflection plane ──
      const ground = BABYLON.MeshBuilder.CreateGround('ground', {
        width: 20, height: 20,
      }, scene)
      ground.material = (() => {
        const m = new BABYLON.PBRMaterial('groundMat', scene)
        m.baseColor = new BABYLON.Color3(0.02, 0.04, 0.07)
        m.metallic = 0.0; m.roughness = 0.95
        return m
      })()

      // Grid lines on ground (thin boxes)
      for (let i = -8; i <= 8; i += 2) {
        const gl = BABYLON.MeshBuilder.CreateBox(`gl${i}`, {
          width: 20, height: 0.005, depth: 0.02,
        }, scene)
        gl.position.set(0, 0.001, i)
        gl.material = (() => {
          const m = new BABYLON.StandardMaterial(`glMat${i}`, scene)
          m.emissiveColor = new BABYLON.Color3(0.0, 0.12, 0.25)
          return m
        })()

        const gl2 = BABYLON.MeshBuilder.CreateBox(`gl2${i}`, {
          width: 0.02, height: 0.005, depth: 20,
        }, scene)
        gl2.position.set(i, 0.001, 0)
        gl2.material = gl.material
      }

      // ── Store subsystem meshes for colour updates ──
      meshesRef.current = {
        spindle: spindleHousing,
        bearing: bearing,
        tool: tool,
        coolant: coolantArm,
      }

      // ── HighlightLayer for glow effect ──
      const hl = new BABYLON.HighlightLayer('hl', scene, {
        blurHorizontalSize: 1.2,
        blurVerticalSize: 1.2,
      })
      hlRef.current = hl

      // ── Floating text labels ──
      const labelDefs = [
        { name: 'spindle', text: '◉ SPINDLE',  pos: new BABYLON.Vector3(1.2, 5.2, 0) },
        { name: 'bearing', text: '◎ BEARING',  pos: new BABYLON.Vector3(-1.6, 3.4, 0) },
        { name: 'tool',    text: '▼ TOOL',     pos: new BABYLON.Vector3(1.1, 2.2, 0) },
        { name: 'coolant', text: '~ COOLANT',  pos: new BABYLON.Vector3(2.6, 3.2, 0.6) },
      ]

      labelDefs.forEach(({ name, text, pos }) => {
        const label = BABYLON.MeshBuilder.CreatePlane(`label_${name}`, {
          width: 1.6, height: 0.35,
        }, scene)
        label.position = pos
        label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL

        const dt = new BABYLON.DynamicTexture(`dt_${name}`, {
          width: 256, height: 64,
        }, scene)
        const ctx = dt.getContext()
        ctx.fillStyle = 'rgba(6,11,25,0.82)'
        ctx.fillRect(0, 0, 256, 64)
        ctx.strokeStyle = '#00d4ff44'
        ctx.lineWidth = 1.5
        ctx.strokeRect(1, 1, 254, 62)
        ctx.font = 'bold 18px monospace'
        ctx.fillStyle = '#00d4ff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, 128, 32)
        dt.update()

        const labelMat = new BABYLON.StandardMaterial(`labelMat_${name}`, scene)
        labelMat.diffuseTexture = dt
        labelMat.emissiveTexture = dt
        labelMat.useAlphaFromDiffuseTexture = true
        labelMat.backFaceCulling = false
        label.material = labelMat

        labelsRef.current.push({ name, label, dt, ctx })
      })

      // ── Spindle rotation animation ──
      const rotAnim = new BABYLON.Animation(
        'spinRotate', 'rotation.y', 60,
        BABYLON.Animation.ANIMATIONTYPE_FLOAT,
        BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
      )
      rotAnim.setKeys([
        { frame: 0,   value: 0 },
        { frame: 120, value: Math.PI * 2 },
      ])
      spindleHousing.animations = [rotAnim]
      scene.beginAnimation(spindleHousing, 0, 120, true, 0.5)
      spindleCap.animations = [rotAnim]
      scene.beginAnimation(spindleCap, 0, 120, true, 0.5)

      // ── Render loop ──
      engine.runRenderLoop(() => {
        if (scene) scene.render()
      })

      // ── Resize handler ──
      const onResize = () => engine.resize()
      window.addEventListener('resize', onResize)

      // Store cleanup
      engineRef.current._cleanupResize = onResize
    }

    init()

    return () => {
      cleanup = true
      if (engineRef.current) {
        window.removeEventListener('resize', engineRef.current._cleanupResize)
        engineRef.current.dispose()
        engineRef.current = null
        sceneRef.current = null
      }
    }
  }, []) // runs once

  // ── Subsystem colour updates ─────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current || !subsystemStates) return

    // colour map defined below

    const colorMap = {
      green: [0.133, 0.8,   0.133],
      amber: [1.0,   0.667, 0.0  ],
      red:   [1.0,   0.133, 0.0  ],
    }

    import('@babylonjs/core').then((BABYLON) => {
      if (!sceneRef.current) return
      const hl = hlRef.current

      // Clear previous highlights
      hl.removeAllMeshes()

      Object.entries(subsystemStates).forEach(([name, status]) => {
        const mesh = meshesRef.current[name]
        if (!mesh) return

        const [r, g, b] = colorMap[status] ?? colorMap.green
        // const targetColor = new BABYLON.Color3(r, g, b)
        const emissive = new BABYLON.Color3(r * 0.35, g * 0.35, b * 0.35)

        // Animate emissive color transition
        if (mesh.material) {
          BABYLON.Animation.CreateAndStartAnimation(
            `colorAnim_${name}`,
            mesh.material,
            'emissiveColor',
            60, 18, // fps, total frames (~300ms)
            mesh.material.emissiveColor ?? new BABYLON.Color3(0, 0.28, 0.04),
            emissive,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
          )
        }

        // HighlightLayer glow on red / amber
        if (status === 'red') {
          hl.addMesh(mesh, new BABYLON.Color3(1.0, 0.1, 0.0))
        } else if (status === 'amber') {
          hl.addMesh(mesh, new BABYLON.Color3(1.0, 0.6, 0.0))
        }

        // Update floating label colour
        const labelEntry = labelsRef.current.find(l => l.name === name)
        if (labelEntry) {
          const { dt, ctx } = labelEntry
          const labelColors = { green: '#22cc22', amber: '#ffaa00', red: '#ff2200' }
          const lc = labelColors[status] ?? '#22cc22'
          ctx.clearRect(0, 0, 256, 64)
          ctx.fillStyle = 'rgba(6,11,25,0.85)'
          ctx.fillRect(0, 0, 256, 64)
          ctx.strokeStyle = lc + '88'
          ctx.lineWidth = 1.5
          ctx.strokeRect(1, 1, 254, 62)
          ctx.font = 'bold 18px monospace'
          ctx.fillStyle = lc
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const labelText = {
            spindle: '◉ SPINDLE', bearing: '◎ BEARING',
            tool: '▼ TOOL', coolant: '~ COOLANT',
          }
          ctx.fillText(labelText[name] ?? name.toUpperCase(), 128, 32)
          dt.update()
        }
      })
    })
  }, [subsystemStates])

  // ── Health score → vignette intensity via CSS ────────────────
  useEffect(() => {
    // Already handled by alarm-vignette in App.jsx
    // Additionally pulse the highlight layer when critical
    if (!hlRef.current || !meshesRef.current) return
    if (healthScore < 30) {
      import('@babylonjs/core').then((BABYLON) => {
        Object.values(meshesRef.current).forEach(mesh => {
          if (mesh) hlRef.current.addMesh(mesh, new BABYLON.Color3(0.8, 0.0, 0.0))
        })
      })
    }
  }, [healthScore])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
      />

      {/* Health score overlay badge */}
      <div style={{
        position: 'absolute', top: '10px', left: '12px',
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '11px', letterSpacing: '2px',
        color: healthScore >= 70 ? '#22cc22' : healthScore >= 40 ? '#ffaa00' : '#ff2200',
        background: 'rgba(6,11,25,0.75)',
        padding: '4px 10px',
        border: `1px solid ${
          healthScore >= 70 ? '#22cc2244'
          : healthScore >= 40 ? '#ffaa0044'
          : '#ff220044'
        }`,
        borderRadius: '3px',
        transition: 'color 0.5s, border-color 0.5s',
      }}>
        HEALTH {healthScore?.toFixed(1) ?? '--'}%
      </div>

      {/* Corner HUD brackets */}
      {[
        { top: 0, left: 0,  borderTop: '2px solid', borderLeft: '2px solid' },
        { top: 0, right: 0, borderTop: '2px solid', borderRight: '2px solid' },
        { bottom: 0, left: 0,  borderBottom: '2px solid', borderLeft: '2px solid' },
        { bottom: 0, right: 0, borderBottom: '2px solid', borderRight: '2px solid' },
      ].map((style, i) => (
        <div key={i} style={{
          position: 'absolute', width: '16px', height: '16px',
          borderColor: '#00d4ff55',
          ...style,
        }} />
      ))}
    </div>
  )
}

export default MachineViewer