// frontend/src/components/MachineViewer.jsx
import { useEffect, useRef } from 'react'

const MachineViewer = ({ subsystemStates, healthScore }) => {
  const canvasRef       = useRef(null)
  const engineRef       = useRef(null)
  const sceneRef        = useRef(null)
  const hlRef           = useRef(null)
  const labelsRef       = useRef([])
  const resultRef       = useRef(null)   // stores ImportMeshAsync result
  const subsystemStatesRef = useRef(subsystemStates) // latest states for async access

  const colorMap = {
    green: [0.133, 0.8,   0.133],
    amber: [1.0,   0.667, 0.0  ],
    red:   [1.0,   0.133, 0.0  ],
  }

  // Keep ref in sync with prop
  useEffect(() => {
    subsystemStatesRef.current = subsystemStates
  }, [subsystemStates])

  // ── Scene setup — runs once ──────────────────────────────────
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
      camera.lowerRadiusLimit    = 8
      camera.upperRadiusLimit    = 30
      camera.upperBetaLimit      = Math.PI / 2.05
      camera.wheelDeltaPercentage = 0.01
      camera.attachControl(canvasRef.current, true)
      camera.useAutoRotationBehavior = true
      camera.autoRotationBehavior.idleRotationSpeed   = 0.2
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

        const size       = max.subtract(min)
        const maxDim     = Math.max(size.x, size.y, size.z)
        const scale      = 10 / maxDim
        root.scaling     = new BABYLON.Vector3(scale, scale, scale)

        const centre     = min.add(max).scale(0.5)
        root.position    = new BABYLON.Vector3(
          -centre.x * scale,
          -min.y   * scale,
          -centre.z * scale
        )

        // ── Floating labels ──
        const labelDefs = [
          { name: 'spindle', text: '◉ SPINDLE', pos: new BABYLON.Vector3(-3, 7,  1) },
          { name: 'bearing', text: '◎ BEARING', pos: new BABYLON.Vector3( 0, 6, -2) },
          { name: 'tool',    text: '▼ TOOL',    pos: new BABYLON.Vector3( 3, 5,  1) },
          { name: 'coolant', text: '~ COOLANT', pos: new BABYLON.Vector3( 1, 4, -3) },
        ]

        labelDefs.forEach(({ name, text, pos }) => {
          const plane = BABYLON.MeshBuilder.CreatePlane(`lbl_${name}`, {
            width: 2.4, height: 0.55,
          }, scene)
          plane.position     = pos
          plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL

          const dt  = new BABYLON.DynamicTexture(`dt_${name}`, { width: 320, height: 72 }, scene)
          const ctx = dt.getContext()

          const draw = (color) => {
            ctx.clearRect(0, 0, 320, 72)
            // Use composite operation to ensure real transparency
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
          mat.alphaMode                  = 2 // BABYLON.Engine.ALPHA_COMBINE
          plane.material                 = mat

          labelsRef.current.push({ name, plane, dt, draw })
        })

      } catch (err) {
        console.error('[MachineViewer] GLB load failed:', err)
        // Fallback box
        const fb  = BABYLON.MeshBuilder.CreateBox('fb', { size: 4 }, scene)
        fb.position.y = 2
        const fm  = new BABYLON.StandardMaterial('fm', scene)
        fm.emissiveColor = new BABYLON.Color3(0.05, 0.2, 0.4)
        fb.material = fm
      }

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

  // ── Subsystem colour updates ──────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current || !subsystemStates || !resultRef.current) return

    import('@babylonjs/core').then((BABYLON) => {
      if (!sceneRef.current || !hlRef.current) return

      const hl       = hlRef.current
      const allMeshes = resultRef.current.meshes.filter(
        m => m.getTotalVertices && m.getTotalVertices() > 0
      )

      if (allMeshes.length === 0) return

      hl.removeAllMeshes()

      // Determine worst status
      const priority = { red: 3, amber: 2, green: 1 }
      let worst = 'green'
      Object.values(subsystemStates).forEach(s => {
        if ((priority[s] ?? 0) > (priority[worst] ?? 0)) worst = s
      })

      // Very subtle emissive tint on all meshes — keeps original colours
      const [r, g, b] = colorMap[worst] ?? colorMap.green
      const emissive   = new BABYLON.Color3(r * 0.08, g * 0.08, b * 0.08)

      allMeshes.forEach(mesh => {
        if (!mesh?.material) return
        try {
          BABYLON.Animation.CreateAndStartAnimation(
            `em_${mesh.uniqueId}`, mesh.material, 'emissiveColor',
            60, 20,
            mesh.material.emissiveColor?.clone() ?? new BABYLON.Color3(0, 0, 0),
            emissive,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
          )
        } catch (_) {}
      })

      // HighlightLayer glow — only on fault, only on a subset of meshes
      // Use first 25% of meshes (spindle/headstock area of the lathe)
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
      />

      {/* Health badge */}
      <div style={{
        position: 'absolute', top: 10, left: 12,
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '11px', letterSpacing: '2px',
        color: healthScore >= 70 ? '#22cc22'
             : healthScore >= 40 ? '#ffaa00' : '#ff2200',
        background: 'rgba(4,9,20,0.82)',
        padding: '4px 10px',
        border: `1px solid ${
          healthScore >= 70 ? '#22cc2255'
          : healthScore >= 40 ? '#ffaa0055' : '#ff220055'
        }`,
        borderRadius: '3px',
        transition: 'all 0.5s ease',
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

      {/* Credit */}
      <div style={{
        position: 'absolute', bottom: 6, right: 10,
        fontFamily: 'monospace', fontSize: '8px',
        color: '#1a3050', letterSpacing: '1px',
      }}>
        EMCONICN CNC LATHE — DIGITAL TWIN
      </div>
    </div>
  )
}

export default MachineViewer