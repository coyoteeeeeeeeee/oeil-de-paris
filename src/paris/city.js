import * as THREE from 'three'
import { GEO, HOTSPOTS, geoToWorld } from '../utils/geo.js'
import { buildArrondissementBorders } from './arrondissements.js'

// ── Matériaux — contraste élevé pour être lisible depuis les airs
const MAT = {
  ground:   new THREE.MeshLambertMaterial({ color: 0x0a1220 }),           // fond sombre bleu nuit
  road:     new THREE.MeshLambertMaterial({ color: 0x1e2e44 }),           // routes : bleu-gris visible
  roadMain: new THREE.MeshLambertMaterial({ color: 0x2a3f5a }),           // boulevards : plus clairs
  bldA:     new THREE.MeshLambertMaterial({ color: 0x1a3050, emissive: 0x060e1a }),  // haussmannien standard
  bldB:     new THREE.MeshLambertMaterial({ color: 0x223860, emissive: 0x080f20 }),  // variation légèrement plus clair
  bldHigh:  new THREE.MeshLambertMaterial({ color: 0x2a4870, emissive: 0x0a1428 }),  // immeubles hauts
  bldGlass: new THREE.MeshLambertMaterial({ color: 0x2060a0, emissive: 0x102840 }),  // tours La Défense : bleu vif
  bldPark:  new THREE.MeshLambertMaterial({ color: 0x0e1c10, emissive: 0x040808 }),  // parcs : très sombre verdâtre
  water:    new THREE.MeshLambertMaterial({ color: 0x08183a, emissive: 0x04101a }),  // Seine : bleu profond
  quai:     new THREE.MeshLambertMaterial({ color: 0x152238 }),
  monument: new THREE.MeshLambertMaterial({ color: 0x3a5878, emissive: 0x101e2a }),  // monuments : bien visibles
  winWarm:  new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.55 }),
  winCool:  new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.40 }),
}

// ── LCG déterministe pour le tissu urbain
let _seed = 0x4a2f91b3
function rand() {
  _seed = (Math.imul(1664525, _seed) + 1013904223) >>> 0
  return _seed / 0x100000000
}
function randRange(a, b) { return a + rand() * (b - a) }

// ══════════════════════════════════════════════════════
//  ENTRÉE PRINCIPALE
// ══════════════════════════════════════════════════════
export function buildParis(scene) {
  const root = new THREE.Group()
  root.name  = 'paris'

  buildGround(root)
  buildSeine(root)
  buildHaussmannGrid(root)
  buildArrondissements(root)
  buildMonuments(root)
  buildWindowLights(root)
  buildArrondissementBorders(scene)  // ← ajouter cette ligne

  scene.add(root)
  return root
}

// ──────────────────────────────────────────────────────
//  SOL — avec canvas texture pour ajouter une grille visible
// ──────────────────────────────────────────────────────
function buildGround(root) {
  // Texture procédurale : fond sombre + quadrillage d'arrondissements
  const size = 1024
  const cv   = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')

  // Fond
  ctx.fillStyle = '#0a1220'
  ctx.fillRect(0, 0, size, size)

  // Grille fine (rues)
  ctx.strokeStyle = 'rgba(30,50,80,0.6)'
  ctx.lineWidth   = 1
  const step = size / 40
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke()
  }

  // Grille grossière (arrondissements)
  ctx.strokeStyle = 'rgba(50,80,120,0.5)'
  ctx.lineWidth   = 2
  const big = size / 8
  for (let i = 0; i <= size; i += big) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke()
  }

  // Cercle périphérique (le Périph)
  ctx.strokeStyle = 'rgba(60,100,150,0.4)'
  ctx.lineWidth   = 3
  ctx.beginPath()
  ctx.ellipse(size/2, size/2, size*0.43, size*0.40, 0, 0, Math.PI*2)
  ctx.stroke()

  const tex  = new THREE.CanvasTexture(cv)
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(GEO.size * 1.15, GEO.size * 1.15),
    new THREE.MeshBasicMaterial({ map: tex })
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -0.5
  root.add(mesh)
}

// ──────────────────────────────────────────────────────
//  SEINE — ruban plat sur le sol (PlaneGeometry le long de la courbe)
// ──────────────────────────────────────────────────────
function buildSeine(root) {
  const gpsPts = [
    { lat:48.833, lon:2.418 }, // Charenton
    { lat:48.840, lon:2.395 }, // Bercy
    { lat:48.845, lon:2.378 }, // Gare de Lyon
    { lat:48.851, lon:2.362 }, // Île Saint-Louis Est
    { lat:48.852, lon:2.350 }, // Notre-Dame / Île de la Cité
    { lat:48.854, lon:2.337 }, // Pont-Neuf
    { lat:48.858, lon:2.323 }, // Louvre / Tuileries
    { lat:48.861, lon:2.310 }, // Trocadéro Sud
    { lat:48.857, lon:2.293 }, // Tour Eiffel Ouest
    { lat:48.847, lon:2.278 }, // Javel
    { lat:48.837, lon:2.263 }, // Issy-les-Moulineaux
  ].map(p => { const w = geoToWorld(p.lat, p.lon); return new THREE.Vector3(w.x, 0.3, w.z) })

  const curve = new THREE.CatmullRomCurve3(gpsPts)

  // Construire un ruban plat (série de quads le long de la courbe)
  const SEG   = 120
  const WIDTH = 18   // largeur de la Seine en unités world
  const verts = []
  const uvs   = []
  const idx   = []

  for (let i = 0; i <= SEG; i++) {
    const t   = i / SEG
    const pt  = curve.getPoint(t)
    const tan = curve.getTangent(t)
    // Perpendiculaire dans le plan XZ
    const perp = new THREE.Vector3(-tan.z, 0, tan.x).normalize()

    verts.push(
      pt.x - perp.x * WIDTH, 0.4, pt.z - perp.z * WIDTH,
      pt.x + perp.x * WIDTH, 0.4, pt.z + perp.z * WIDTH
    )
    uvs.push(0, t, 1, t)

    if (i < SEG) {
      const b = i * 2
      idx.push(b, b+1, b+2,  b+1, b+3, b+2)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvs),   2))
  geo.setIndex(idx)
  geo.computeVertexNormals()

  root.add(new THREE.Mesh(geo, MAT.water))

  // Quais (légèrement plus larges et plus sombres, en dessous)
  const quaiGeo = geo.clone()
  const quaiPos = quaiGeo.attributes.position.array
  // Élargir de 6 unités de chaque côté
  for (let i = 0; i <= SEG; i++) {
    const b = i * 6
    quaiPos[b]   -= 3 * (-gpsPts[Math.min(i, gpsPts.length-1)].z)   // approx
    quaiPos[b+3] += 3
  }
  root.add(new THREE.Mesh(quaiGeo, MAT.quai))
}

// ──────────────────────────────────────────────────────
//  GRILLE HAUSSMANNIENNE
//  Paris a un système de boulevards radiaux partant de
//  plusieurs "étoiles" (Étoile, Opéra, Bastille, Nation)
//  + une grille orthogonale de rues secondaires.
// ──────────────────────────────────────────────────────

// Étoiles haussmanniennes (centres de rayonnement)
const ETOILES = [
  { lat:48.874, lon:2.295, r:7, name:'Étoile'         }, // Arc de Triomphe
  { lat:48.871, lon:2.331, r:5, name:'Opéra'           },
  { lat:48.854, lon:2.369, r:6, name:'Bastille'        },
  { lat:48.848, lon:2.395, r:5, name:'Nation'          },
  { lat:48.840, lon:2.321, r:4, name:'Montparnasse'    },
  { lat:48.863, lon:2.353, r:5, name:'République'      },
].map(e => ({ ...e, ...geoToWorld(e.lat, e.lon) }))

function buildHaussmannGrid(root) {
  const boulevards = []  // gros axes
  const rues       = []  // rues secondaires

  // ── Boulevards radiaux depuis chaque étoile (largeur augmentée)
  for (const et of ETOILES) {
    for (let a = 0; a < et.r; a++) {
      const angle  = (a / et.r) * Math.PI * 2
      const length = randRange(100, 260)
      const ex     = et.x + Math.cos(angle) * length
      const ez     = et.z + Math.sin(angle) * length
      boulevards.push(makeRoad(et.x, et.z, ex, ez, 10))
    }
  }

  // Grands axes parisiens (GPS → world) — ajoutés manuellement pour la lisibilité
  const AXES = [
    // Boulevard Saint-Michel / Sébastopol (N-S centre)
    [geoToWorld(48.815, 2.347), geoToWorld(48.867, 2.347)],
    // Boulevard Haussmann (E-O nord)
    [geoToWorld(48.875, 2.300), geoToWorld(48.875, 2.380)],
    // Rue de Rivoli (E-O centre)
    [geoToWorld(48.856, 2.295), geoToWorld(48.856, 2.370)],
    // Grands Boulevards
    [geoToWorld(48.871, 2.330), geoToWorld(48.871, 2.370)],
    // Av. des Champs-Élysées
    [geoToWorld(48.866, 2.295), geoToWorld(48.873, 2.307)],
  ]
  for (const [a, b] of AXES) {
    boulevards.push(makeRoad(a.x, a.z, b.x, b.z, 12))
  }

  // ── Grille orthogonale (rues secondaires — espacement plus serré)
  const STEP = 48
  for (let x = -920; x <= 920; x += STEP) {
    rues.push(makeRoad(x, -960, x, 960, 4))
  }
  for (let z = -920; z <= 920; z += STEP) {
    rues.push(makeRoad(-960, z, 960, z, 4))
  }

  // ── Périphérique
  const RING = 64
  for (let i = 0; i < RING; i++) {
    const a0 = (i / RING) * Math.PI * 2
    const a1 = ((i+1) / RING) * Math.PI * 2
    const rx = 850, rz = 800
    boulevards.push(makeRoad(
      Math.cos(a0)*rx, Math.sin(a0)*rz,
      Math.cos(a1)*rx, Math.sin(a1)*rz,
      9
    ))
  }

  // Merger séparément pour avoir deux matériaux
  root.add(mergeBoxes(rues,       MAT.road))
  root.add(mergeBoxes(boulevards, MAT.roadMain))
}

/** Crée une route (box plate) entre deux points */
function makeRoad(x0, z0, x1, z1, width) {
  const dx  = x1 - x0, dz = z1 - z0
  const len = Math.sqrt(dx*dx + dz*dz)
  const geo = new THREE.BoxGeometry(len, 0.3, width)
  geo.rotateY(Math.atan2(dx, dz))
  geo.translate((x0+x1)/2, 0.15, (z0+z1)/2)
  return geo
}

// ──────────────────────────────────────────────────────
//  ARRONDISSEMENTS — tissu bâti par zone
//  Chaque arrondissement a sa densité et hauteur propres
// ──────────────────────────────────────────────────────
const ARRONDISSEMENTS = [
  { cx: -55, cz: -25, r:120, density:0.70, minH:16, maxH:26, type:'haussmann' }, // 1er-4e centre
  { cx:-100, cz:  55, r:160, density:0.65, minH:14, maxH:22, type:'hausB'     }, // 8e-9e-10e
  { cx: -80, cz:-115, r:140, density:0.62, minH:13, maxH:21, type:'haussmann' }, // 5e-6e-7e
  { cx:  90, cz:  20, r:180, density:0.58, minH:10, maxH:20, type:'hausB'     }, // 11e-12e-20e
  { cx:-140, cz: 130, r:150, density:0.55, minH:10, maxH:18, type:'haussmann' }, // 17e-18e
  { cx: -60, cz:-200, r:200, density:0.50, minH:10, maxH:28, type:'high'      }, // 13e-14e-15e
  { cx:-500, cz: 100, r: 80, density:0.50, minH:55, maxH:130,type:'glass'     }, // La Défense
  { cx:-420, cz:  60, r:100, density:0.04, minH: 3, maxH:  6, type:'park'     }, // Bois de Boulogne
  { cx: 350, cz:  60, r: 90, density:0.04, minH: 3, maxH:  5, type:'park'     }, // Bois de Vincennes
]

function buildArrondissements(root) {
  const BLOCK = 42  // taille d'un bloc

  // Grille de base sur tout Paris
  const bldGeoms = []

  for (let x = -950; x < 950; x += BLOCK) {
    for (let z = -950; z < 950; z += BLOCK) {
      // Trouver le "contexte" de cet emplacement
      const ctx = getContext(x, z)
      if (!ctx || rand() > ctx.density) continue

      // Éviter la Seine (zone centrale)
      if (isOnSeine(x, z)) continue

      const w = BLOCK * randRange(0.45, 0.75)
      const d = BLOCK * randRange(0.45, 0.75)
      const h = randRange(ctx.minH, ctx.maxH)

      const geo = new THREE.BoxGeometry(w, h, d)
      geo.translate(
        x + (rand() - 0.5) * 8,
        h / 2,
        z + (rand() - 0.5) * 8
      )

      bldGeoms.push({ geo, type: ctx.type })
    }
  }

  // Séparer par type de matériau et merger
  for (const type of ['haussmann', 'hausB', 'high', 'glass', 'park']) {
    const subset = bldGeoms.filter(b => b.type === type).map(b => b.geo)
    if (!subset.length) continue
    const mat = type === 'glass' ? MAT.bldGlass
              : type === 'high'  ? MAT.bldHigh
              : type === 'park'  ? MAT.bldPark
              : type === 'hausB' ? MAT.bldB
              :                    MAT.bldA
    root.add(mergeBoxes(subset, mat))
  }
}

function getContext(x, z) {
  let best = null, bestDist = Infinity
  for (const arr of ARRONDISSEMENTS) {
    const d = Math.sqrt((x-arr.cx)**2 + (z-arr.cz)**2)
    if (d < arr.r && d < bestDist) { bestDist = d; best = arr }
  }
  if (best) return best
  // Zone périphérique : peu dense
  if (Math.abs(x) < 950 && Math.abs(z) < 950) {
    return { density: 0.38, minH: 8, maxH: 16, type: 'haussmann' }
  }
  return null
}

function isOnSeine(x, z) {
  // Approximation : bande courbe autour du tracé de la Seine
  const seinePoints = [
    [-380, 260], [-150, 70], [0, -15], [120, -55], [300, -100],
  ]
  for (const [sx, sz] of seinePoints) {
    if (Math.sqrt((x-sx)**2 + (z-sz)**2) < 30) return true
  }
  return false
}

// ──────────────────────────────────────────────────────
//  MONUMENTS ICONIQUES (géométrie procédurale)
// ──────────────────────────────────────────────────────
function buildMonuments(root) {
  // ── Tour Eiffel (treillis simplifié)
  buildEiffelTower(root, geoToWorld(48.8584, 2.2945))

  // ── Arc de Triomphe
  buildArcDeTriomphe(root, geoToWorld(48.8738, 2.2950))

  // ── Notre-Dame
  buildNotreDame(root, geoToWorld(48.8530, 2.3499))

  // ── Sacré-Cœur (Montmartre)
  buildSacreCœur(root, geoToWorld(48.8867, 2.3431))

  // ── Tour Montparnasse
  buildTourMontparnasse(root, geoToWorld(48.8421, 2.3219))
}

function buildEiffelTower(root, pos) {
  const g = new THREE.Group()
  g.position.set(pos.x, 0, pos.z)

  // Jambes (4 piliers inclinés)
  const legMat  = new THREE.MeshLambertMaterial({ color: 0x1a3040 })
  const legData = [
    [-14,  14], [ 14,  14],
    [-14, -14], [ 14, -14],
  ]
  legData.forEach(([lx, lz]) => {
    const geo = new THREE.CylinderGeometry(1.5, 3.5, 80, 4)
    const mesh = new THREE.Mesh(geo, legMat)
    // Incliner vers le centre
    mesh.position.set(lx * 0.4, 40, lz * 0.4)
    mesh.rotation.z = -lx * 0.012
    mesh.rotation.x = -lz * 0.012
    g.add(mesh)
  })

  // Corps central
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4, 8, 60, 8), legMat)
  body.position.y = 85
  g.add(body)

  // Flèche
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2, 50, 6), legMat)
  spire.position.y = 145
  g.add(spire)

  // Halo lumineux
  const light = new THREE.PointLight(0xffcc44, 80, 350)
  light.position.y = 80
  g.add(light)

  root.add(g)
}

function buildArcDeTriomphe(root, pos) {
  const mat = MAT.monument
  const g   = new THREE.Group()
  g.position.set(pos.x, 0, pos.z)

  // Corps principal
  const body = new THREE.Mesh(new THREE.BoxGeometry(30, 50, 18), mat)
  body.position.y = 25
  g.add(body)

  // Arche (trou) — on la simule avec deux piliers + linteau
  const pilL  = new THREE.Mesh(new THREE.BoxGeometry(8, 38, 18), MAT.ground)
  pilL.position.set(-11, 19, 0)
  g.add(pilL)
  const pilR  = new THREE.Mesh(new THREE.BoxGeometry(8, 38, 18), MAT.ground)
  pilR.position.set(11, 19, 0)
  g.add(pilR)

  root.add(g)
}

function buildNotreDame(root, pos) {
  const g = new THREE.Group()
  g.position.set(pos.x, 0, pos.z)

  // Nef
  const nef = new THREE.Mesh(new THREE.BoxGeometry(20, 22, 50), MAT.monument)
  nef.position.y = 11
  g.add(nef)

  // Tours façade
  ;[[-8, 28], [8, 28]].forEach(([x, z]) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(7, 35, 7), MAT.monument)
    t.position.set(x, 17.5, z)
    g.add(t)
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3, 15, 8), MAT.monument)
    spire.position.set(x, 42, z)
    g.add(spire)
  })

  // Flèche centrale
  const fl = new THREE.Mesh(new THREE.ConeGeometry(2.5, 30, 8), MAT.monument)
  fl.position.set(0, 37, -5)
  g.add(fl)

  root.add(g)
}

function buildSacreCœur(root, pos) {
  const g = new THREE.Group()
  g.position.set(pos.x, 0, pos.z)

  // Colline de Montmartre
  const hill = new THREE.Mesh(new THREE.CylinderGeometry(45, 65, 18, 12), MAT.bldLow)
  hill.position.y = 9
  g.add(hill)

  // Dôme principal
  const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 8, 0, Math.PI*2, 0, Math.PI*0.6), MAT.monument)
  dome.position.y = 36
  g.add(dome)

  // Tour-lanterne
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 18, 8), MAT.monument)
  lantern.position.y = 58
  g.add(lantern)
  const cap = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 8), MAT.monument)
  cap.position.y = 73
  g.add(cap)

  // Petits dômes latéraux
  ;[[-18, -8], [18, -8], [0, 16]].forEach(([x, z]) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 6, 0, Math.PI*2, 0, Math.PI*0.55), MAT.monument)
    d.position.set(x, 35, z)
    g.add(d)
  })

  root.add(g)
}

function buildTourMontparnasse(root, pos) {
  const g = new THREE.Group()
  g.position.set(pos.x, 0, pos.z)

  const body = new THREE.Mesh(new THREE.BoxGeometry(18, 210, 26), MAT.bldGlass)
  body.position.y = 105
  g.add(body)

  const light = new THREE.PointLight(0x4488ff, 40, 300)
  light.position.y = 210
  g.add(light)

  root.add(g)
}

// ──────────────────────────────────────────────────────
//  LUMIÈRES DE FENÊTRES (scatter instanced)
//  Simule les fenêtres allumées la nuit
// ──────────────────────────────────────────────────────
function buildWindowLights(root) {
  const count  = 10000
  const dummy  = new THREE.Object3D()

  // Deux types de fenêtres : chaudes et froides
  for (const [mat, ratio] of [[MAT.winWarm, 0.7], [MAT.winCool, 0.3]]) {
    const n    = Math.round(count * ratio)
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.8, 1.1), mat, n)
    let   k    = 0

    for (const arr of ARRONDISSEMENTS) {
      const share = Math.round(n * arr.density / ARRONDISSEMENTS.reduce((s,a)=>s+a.density,0))
      for (let j = 0; j < share && k < n; j++, k++) {
        const angle  = rand() * Math.PI * 2
        const dist   = rand() * arr.r * 0.9
        const bx     = arr.cx + Math.cos(angle) * dist
        const bz     = arr.cz + Math.sin(angle) * dist
        const height = randRange(2, arr.maxH * 0.85)
        dummy.position.set(bx + randRange(-2,2), height, bz + randRange(-2,2))
        dummy.rotation.set(0, randRange(0, Math.PI*2), 0)
        dummy.scale.set(1,1,1)
        dummy.updateMatrix()
        mesh.setMatrixAt(k, dummy.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    root.add(mesh)
  }
}

// ──────────────────────────────────────────────────────
//  UTILITAIRE — Merge une liste de BoxGeometry en un seul Mesh
// ──────────────────────────────────────────────────────
function mergeBoxes(geos, mat) {
  if (!geos.length) return new THREE.Group()

  // Compter les vertices totaux
  let totalPos  = 0
  let totalIdx  = 0
  for (const g of geos) {
    totalPos += g.attributes.position.count
    if (g.index) totalIdx += g.index.count
  }

  const positions = new Float32Array(totalPos * 3)
  const normals   = new Float32Array(totalPos * 3)
  const indices   = totalIdx > 0 ? new Uint32Array(totalIdx) : null

  let vOff = 0, iOff = 0, baseVtx = 0

  for (const g of geos) {
    const pos = g.attributes.position.array
    const nor = g.attributes.normal ? g.attributes.normal.array : null

    positions.set(pos, vOff * 3)
    if (nor) normals.set(nor, vOff * 3)

    if (g.index && indices) {
      const idx = g.index.array
      for (let k = 0; k < idx.length; k++) {
        indices[iOff + k] = idx[k] + baseVtx
      }
      iOff += idx.length
    }

    baseVtx += g.attributes.position.count
    vOff    += g.attributes.position.count
    g.dispose()
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setAttribute('normal',   new THREE.BufferAttribute(normals,   3))
  if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1))

  return new THREE.Mesh(merged, mat)
}
