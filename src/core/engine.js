import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

export function createEngine() {
  // ── Scène
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020810)
  scene.fog = new THREE.FogExp2(0x020810, 0.00012)  // brouillard très léger — Paris visible depuis haut

  // ── Caméra — position de départ : vue aérienne centrale sur Paris
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.5, 8000)
  camera.position.set(0, 500, 300)
  camera.lookAt(0, 0, 0)

  // ── Renderer — paramètres max perf
  const renderer = new THREE.WebGLRenderer({
    antialias:      true,
    powerPreference:'high-performance',
    stencil:        false,
    depth:          true,
  })
  renderer.setSize(innerWidth, innerHeight)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.shadowMap.enabled  = false  // désactivé pour les perfs (Paris procédural)
  renderer.sortObjects        = false  // on gère nous-mêmes
  renderer.info.autoReset     = false  // stats manuelles
  document.body.appendChild(renderer.domElement)

  // ── Lumières — calibrées pour rendre Paris lisible depuis les airs
  scene.add(new THREE.AmbientLight(0x2a4060, 4.0))   // ambiant bleu-nuit assez fort

  const moon = new THREE.DirectionalLight(0xaabbdd, 2.0)   // lumière de lune forte
  moon.position.set(-300, 800, 200)
  scene.add(moon)

  // Lumière chaude venant du bas (reflets de la ville)
  const cityGlow = new THREE.DirectionalLight(0xff9944, 0.6)
  cityGlow.position.set(0, -1, 0)
  scene.add(cityGlow)

  const warm = new THREE.HemisphereLight(0xff7733, 0x001530, 0.5)
  scene.add(warm)

  // ── Étoiles (instanced pour perf)
  {
    const count = 4000
    const pos   = new Float32Array(count * 3)
    for (let i = 0; i < pos.length; i++) pos[i] = (Math.random() - 0.5) * 12000
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color:0xffffff, size:1.1, sizeAttenuation:true })))
  }

  // ── Controls
  const controls = new PointerLockControls(camera, document.body)

  // ── Resize
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
  })

  return { scene, camera, renderer, controls }
}
