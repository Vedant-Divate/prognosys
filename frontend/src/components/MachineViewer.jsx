// frontend/src/components/MachineViewer.jsx
import { useEffect, useRef } from 'react'

const MachineViewer = ({ subsystemStates, healthScore }) => {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const sceneRef = useRef(null)
  const hlRef = useRef(null)
  const labelsRef = useRef([])
  // We'll map subsystem names to mesh name fragments found in the GLB
  const subsystemMeshesRef = useRef({
    spindle: [],
    bearing: [],
    tool: [],
    coolant: [],
  })

  const colorMap = {
    green: [0.133, 0.8,   0.133],
    amber: [1.0,   0.667, 0.0  ],
    red:   [1.0,   0.133, 0.0  ],
  }

  // ── Scene setup ───────────────────────────────────────────
  useEffect(() => {
    let cleanup = false

    const init = async () => {
      const BABYLON = await import('@babylonjs/core')
      await import('@babylonjs/loaders')

      if (cleanup || !canvasRef.current) return

      // Engine & Scene
      const engine = new BABYLON.Engine(canvasRef.current, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      })
      const scene = new BABYLON.Scene(engine)
      scene.clearColor = new BABYLON.Color4(0.024, 0.043, 0.098, 1)
      engineRef.current = engine
      sceneRef.current = scene

      // Camera — positioned to show the lathe from a good angle
      const camera = new BABYLON.ArcRotateCamera(
        'cam', -Math.PI / 2.2, Math.PI / 3.5, 18,
        new BABYLON.Vector3(0, 1.5, 0), scene
      )
      camera.lowerRadiusLimit = 8
      camera.upperRadiusLimit = 30
      camera.upperBetaLimit = Math.PI / 2.05
      camera.wheelDeltaPercentage = 0.01
      camera.attachControl(canvasRef.current, true)
      camera.useAutoRotationBehavior = true
      camera.autoRotationBehavior.idleRotationSpeed = 0.2
      camera.autoRotationBehavior.idleRotationWaitTime = 2000

      // Lighting — industrial feel
      const hemi = new BABYLON.HemisphericLight(
        'hemi', new BABYLON.Vector3(0, 1, 0), scene
      )
      hemi.intensity = 0.6
      hemi.diffuse = new BABYLON.Color3(0.85, 0.9, 1.0)
      hemi.groundColor = new BABYLON.Color3(0.1, 0.15, 0.25)

      const keyLight = new BABYLON.DirectionalLight(
        'key', new BABYLON.Vector3(-1, -2, -1), scene
      )
      keyLight.position = new BABYLON.Vector3(8, 12, 8)
      keyLight.intensity = 1.2
      keyLight.diffuse = new BABYLON.Color3(1.0, 0.95, 0.85)

      const fillLight = new BABYLON.PointLight(
        'fill', new BABYLON.Vector3(-6, 4, 6), scene
      )
      fillLight.intensity = 15
      fillLight.diffuse = new BABYLON.Color3(0.2, 0.5, 1.0)

      // Rim light from below-back for industrial drama
      const rimLight = new BABYLON.PointLight(
        'rim', new BABYLON.Vector3(0, -2, -8), scene
      )
      rimLight.intensity = 8
      rimLight.diffuse = new BABYLON.Color3(0.0, 0.6, 1.0)

      // Ground plane with grid
      const ground = BABYLON.MeshBuilder.CreateGround('ground', {
        width: 40, height: 40,
      }, scene)
      const groundMat = new BABYLON.StandardMaterial('groundMat', scene)
      groundMat.diffuseColor = new BABYLON.Color3(0.04, 0.07, 0.12)
      groundMat.specularColor = new BABYLON.Color3(0, 0, 0)
      ground.material = groundMat
      ground.position.y = -0.01

      // Grid lines
      for (let i = -10; i <= 10; i += 2) {
        const makeGrid = (axis) => {
          const g = BABYLON.MeshBuilder.CreateBox(`g${axis}${i}`, {
            width: axis === 'x' ? 40 : 0.025,
            height: 0.005,
            depth: axis === 'x' ? 0.025 : 40,
          }, scene)
          g.position.set(axis === 'z' ? i : 0, 0.003, axis === 'x' ? i : 0)
          const m = new BABYLON.StandardMaterial(`gm${axis}${i}`, scene)
          m.emissiveColor = new BABYLON.Color3(0.0, 0.15, 0.3)
          g.material = m
        }
        makeGrid('x')
        makeGrid('z')
      }

      // HighlightLayer
      const hl = new BABYLON.HighlightLayer('hl', scene, {
        blurHorizontalSize: 1.5,
        blurVerticalSize: 1.5,
      })
      hlRef.current = hl

      // ── Load the GLB model ──────────────────────────────
      try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
          '', '/cnc.glb', '', scene
        )

        // Auto-scale and centre the model
        const meshes = result.meshes
        const root = meshes[0] // __root__ node

        // Compute bounding box to auto-scale
        let min = new BABYLON.Vector3(Infinity, Infinity, Infinity)
        let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity)
        meshes.forEach(m => {
          if (!m.getBoundingInfo) return
          m.computeWorldMatrix(true)
          const bi = m.getBoundingInfo()
          if (!bi) return
          min = BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld)
          max = BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld)
        })

        const size = max.subtract(min)
        const maxDim = Math.max(size.x, size.y, size.z)
        const targetSize = 10 // fit within 10 units
        const scaleFactor = targetSize / maxDim

        root.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor)

        // Centre on origin, sit on ground
        const centre = min.add(max).scale(0.5)
        root.position = new BABYLON.Vector3(
          -centre.x * scaleFactor,
          -min.y * scaleFactor,
          -centre.z * scaleFactor
        )

        // Assign meshes to subsystems by index splits
        // The lathe has: body/enclosure, spindle head (left), tool turret (right), coolant lines
        const allMeshes = meshes.filter(m => m.name !== '__root__')
        const total = allMeshes.length

        // Split mesh list into 4 rough regions by index
        const q = Math.floor(total / 4)
        subsystemMeshesRef.current = {
          spindle: allMeshes.slice(0, q),
          bearing: allMeshes.slice(q, q * 2),
          tool:    allMeshes.slice(q * 2, q * 3),
          coolant: allMeshes.slice(q * 3),
        }

        // Add floating labels
        const labelDefs = [
          { name: 'spindle', text: '◉ SPINDLE',  offset: new BABYLON.Vector3(-3, 6, 0) },
          { name: 'bearing', text: '◎ BEARING',  offset: new BABYLON.Vector3(-1, 5, 2) },
          { name: 'tool',    text: '▼ TOOL',     offset: new BABYLON.Vector3(3, 4, 0) },
          { name: 'coolant', text: '~ COOLANT',  offset: new BABYLON.Vector3(1, 3, -2) },
        ]

        labelDefs.forEach(({ name, text, offset }) => {
          const plane = BABYLON.MeshBuilder.CreatePlane(`lbl_${name}`, {
            width: 2.2, height: 0.5,
          }, scene)
          plane.position = offset
          plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL

          const dt = new BABYLON.DynamicTexture(`dt_${name}`, {
            width: 320, height: 72,
          }, scene)
          const ctx = dt.getContext()
          const draw = (color) => {
            ctx.clearRect(0, 0, 320, 72)
            ctx.fillStyle = 'rgba(4,9,20,0.88)'
            ctx.fillRect(0, 0, 320, 72)
            ctx.strokeStyle = color + 'aa'
            ctx.lineWidth = 2
            ctx.strokeRect(1, 1, 318, 70)
            ctx.font = 'bold 22px monospace'
            ctx.fillStyle = color
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(text, 160, 36)
            dt.update()
          }
          draw('#00d4ff')

          const mat = new BABYLON.StandardMaterial(`lblMat_${name}`, scene)
          mat.diffuseTexture = dt
          mat.emissiveTexture = dt
          mat.opacityTexture = dt
          mat.backFaceCulling = false
          plane.material = mat

          labelsRef.current.push({ name, plane, dt, draw })
        })

      } catch (err) {
        console.error('[MachineViewer] Failed to load GLB:', err)
        // Fallback: show a simple box so the panel isn't empty
        const fallback = BABYLON.MeshBuilder.CreateBox('fallback', { size: 4 }, scene)
        fallback.position.y = 2
        const fm = new BABYLON.StandardMaterial('fm', scene)
        fm.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.5)
        fallback.material = fm
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
        sceneRef.current = null
      }
    }
  }, [])

  // ── Subsystem colour updates ──────────────────────────────
  useEffect(() => {
    if (!sceneRef.current || !subsystemStates) return

    import('@babylonjs/core').then((BABYLON) => {
      if (!sceneRef.current) return
      const hl = hlRef.current
      if (!hl) return

      hl.removeAllMeshes()

      Object.entries(subsystemStates).forEach(([name, status]) => {
        const meshList = subsystemMeshesRef.current[name] ?? []
        const [r, g, b] = colorMap[status] ?? colorMap.green
        const emissive = new BABYLON.Color3(r * 0.25, g * 0.25, b * 0.25)
        const glowColor = new BABYLON.Color3(r, g, b)

        meshList.forEach(mesh => {
          if (!mesh || !mesh.material) return
          // Animate emissive
          BABYLON.Animation.CreateAndStartAnimation(
            `em_${name}_${mesh.name}`,
            mesh.material,
            'emissiveColor',
            60, 20,
            mesh.material.emissiveColor ?? new BABYLON.Color3(0, 0, 0),
            emissive,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
          )
          // Glow on fault
          if (status === 'red' || status === 'amber') {
            hl.addMesh(mesh, glowColor)
          }
        })

        // Update label colour
        const lbl = labelsRef.current.find(l => l.name === name)
        if (lbl) {
          const lc = { green: '#22cc22', amber: '#ffaa00', red: '#ff2200' }
          lbl.draw(lc[status] ?? '#22cc22')
        }
      })
    })
  }, [subsystemStates])

  // ── Critical health — full scene red glow ─────────────────
  useEffect(() => {
    if (!hlRef.current || !sceneRef.current) return
    if (healthScore < 30) {
      import('@babylonjs/core').then((BABYLON) => {
        const allMeshes = Object.values(subsystemMeshesRef.current).flat()
        allMeshes.forEach(m => {
          if (m) hlRef.current.addMesh(m, new BABYLON.Color3(0.9, 0.0, 0.0))
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
        color: healthScore >= 70 ? '#22cc22' : healthScore >= 40 ? '#ffaa00' : '#ff2200',
        background: 'rgba(4,9,20,0.8)',
        padding: '4px 10px',
        border: `1px solid ${healthScore >= 70 ? '#22cc2255' : healthScore >= 40 ? '#ffaa0055' : '#ff220055'}`,
        borderRadius: '3px',
        transition: 'all 0.5s ease',
      }}>
        HEALTH {healthScore?.toFixed(1) ?? '--'}%
      </div>

      {/* HUD corner brackets */}
      {[
        { top: 0, left: 0,   borderTop: '2px solid', borderLeft: '2px solid'   },
        { top: 0, right: 0,  borderTop: '2px solid', borderRight: '2px solid'  },
        { bottom: 0, left: 0,  borderBottom: '2px solid', borderLeft: '2px solid'  },
        { bottom: 0, right: 0, borderBottom: '2px solid', borderRight: '2px solid' },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', width: 18, height: 18,
          borderColor: '#00d4ff44', ...s,
        }} />
      ))}

      {/* Model credit — tiny, bottom right */}
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