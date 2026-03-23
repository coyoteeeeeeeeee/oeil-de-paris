import * as THREE from 'three'

// ── État clavier
export const keys = { z:false, q:false, s:false, d:false, e:false, a:false, shift:false }

document.addEventListener('keydown', ev => {
  // AZERTY physique → code JS :
  //   Z phys = KeyW   S phys = KeyS
  //   Q phys = KeyA   D phys = KeyD
  //   E phys = KeyE   A phys = KeyQ
  if (ev.code === 'KeyW') keys.z = true
  if (ev.code === 'KeyS') keys.s = true
  if (ev.code === 'KeyA') keys.q = true   // Q physique AZERTY
  if (ev.code === 'KeyD') keys.d = true
  if (ev.code === 'KeyE') keys.e = true   // E → MONTER
  if (ev.code === 'KeyQ') keys.a = true   // A physique AZERTY → DESCENDRE
  if (ev.key  === 'Shift') keys.shift = true
})
document.addEventListener('keyup', ev => {
  if (ev.code === 'KeyW') keys.z = false
  if (ev.code === 'KeyS') keys.s = false
  if (ev.code === 'KeyA') keys.q = false
  if (ev.code === 'KeyD') keys.d = false
  if (ev.code === 'KeyE') keys.e = false
  if (ev.code === 'KeyQ') keys.a = false
  if (ev.key  === 'Shift') keys.shift = false
})

// ── Fly-to caméra (interpolation douce)
let flyTarget   = null
let flyProgress = 0
const flyFrom   = new THREE.Vector3()

function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t }

export function flyTo(target) {
  flyFrom.copy(target)  // sera remplacé au premier tick
  flyTarget   = target.clone()
  flyProgress = -1       // -1 = "copier la position caméra au prochain tick"
}

/** Appelé à chaque frame. Retourne true si un fly-to est en cours. */
export function tickControls(controls, camera, delta) {
  const BASE = 250
  const spd  = keys.shift ? BASE * 3 : BASE

  // Fly-to
  if (flyTarget) {
    if (flyProgress < 0) {
      flyFrom.copy(camera.position)
      flyProgress = 0
    }
    flyProgress = Math.min(1, flyProgress + delta * 1.1)
    camera.position.lerpVectors(flyFrom, flyTarget, easeInOut(flyProgress))
    if (flyProgress >= 1) flyTarget = null
    return  // pas de mouvement manuel pendant le fly-to
  }

  if (!controls.isLocked) return

  if (keys.z) controls.moveForward( spd * delta)
  if (keys.s) controls.moveForward(-spd * delta)
  if (keys.q) controls.moveRight(  -spd * delta)
  if (keys.d) controls.moveRight(   spd * delta)
  if (keys.e) camera.position.y += spd * delta   // E → MONTER
  if (keys.a) camera.position.y -= spd * delta   // A → DESCENDRE

  // Plancher
  camera.position.y = Math.max(5, camera.position.y)
}
