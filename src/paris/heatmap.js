import * as THREE from 'three'

// ── Texture disque dégradé (créée une seule fois)
function makeHeatTex(r, g, b) {
  const s  = 64
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx  = cv.getContext('2d')
  const grad = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2)
  grad.addColorStop(0,    `rgba(${r},${g},${b},0.70)`)
  grad.addColorStop(0.40, `rgba(${r},${g},${b},0.22)`)
  grad.addColorStop(1,    `rgba(0,0,0,0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(cv)
}

const SHARED = {
  matRed: new THREE.MeshBasicMaterial({ map: makeHeatTex(255,30,60),  transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending }),
  matGld: new THREE.MeshBasicMaterial({ map: makeHeatTex(255,190,20), transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending }),
  markerR: new THREE.MeshBasicMaterial({ color:0xff2244, transparent:true, opacity:0.88 }),
  markerG: new THREE.MeshBasicMaterial({ color:0x00ff99, transparent:true, opacity:0.88 }),
  dotGeo:  new THREE.SphereGeometry(2.2, 6, 6),
  diskGeo: new THREE.PlaneGeometry(1, 1),  // on scale au moment du placement
}

export class HeatmapLayer {
  constructor(scene) {
    this.scene      = scene
    this.heatGroup  = new THREE.Group(); scene.add(this.heatGroup)
    this.markerGrp  = new THREE.Group(); scene.add(this.markerGrp)
    this.mcGroup    = new THREE.Group(); scene.add(this.mcGroup)
  }

  /** Met à jour la heatmap avec un nouveau set de vols */
  update(thefts) {
    this._clear(this.heatGroup)
    this._clear(this.markerGrp)

    const count = thefts.length
    if (!count) return

    // ── InstancedMesh disques — rotation intégrée dans chaque matrice d'instance
    // (appliquer rotation.x sur le Mesh lui-même n'affecte PAS les matrices d'instance)
    const diskMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(38, 38),
      SHARED.matRed,
      count
    )
    const dummy = new THREE.Object3D()
    thefts.forEach((t, i) => {
      dummy.position.set(t.x, 1.0, t.z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)   // couché à plat ici
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      diskMesh.setMatrixAt(i, dummy.matrix)
    })
    diskMesh.instanceMatrix.needsUpdate = true
    this.heatGroup.add(diskMesh)

    // ── Points individuels (InstancedMesh rouge/vert)
    const stolen    = thefts.filter(t => !t.recovered)
    const recovered = thefts.filter(t =>  t.recovered)

    this._addDots(stolen,    SHARED.markerR, this.markerGrp)
    this._addDots(recovered, SHARED.markerG, this.markerGrp)
  }

  /** Met à jour la heatmap Monte Carlo (overlay doré) */
  updateMC(mcData) {
    this._clear(this.mcGroup)
    if (!mcData?.length) return

    const mesh  = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      SHARED.matGld,
      mcData.length
    )
    const dummy = new THREE.Object3D()
    mcData.forEach((pt, i) => {
      const size = 25 + pt.intensity * 85
      dummy.position.set(pt.x, 2.0, pt.z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)   // couché à plat dans la matrice
      dummy.scale.set(size, size, size)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    this.mcGroup.add(mesh)
  }

  clearMC() { this._clear(this.mcGroup) }

  _addDots(list, mat, group) {
    if (!list.length) return
    const mesh  = new THREE.InstancedMesh(SHARED.dotGeo, mat, list.length)
    const dummy = new THREE.Object3D()
    list.forEach((t, i) => {
      dummy.position.set(t.x, 4, t.z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    group.add(mesh)
  }

  _clear(group) {
    while (group.children.length) {
      const c = group.children[0]
      c.geometry?.dispose()
      group.remove(c)
    }
  }
}
