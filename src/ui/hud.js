// Éléments DOM
const els = {
  status:     document.getElementById('status-val'),
  speed:      document.getElementById('speed-val'),
  alt:        document.getElementById('alt-val'),
  fps:        document.getElementById('fps-val'),
  theftCount: document.getElementById('theft-count'),
  simLabel:   document.getElementById('sim-label'),
  arrVal:     document.getElementById('arr-val'),
  hud:        document.getElementById('hud'),
}

// FPS — moyenne glissante sur 30 frames
const FPS_SAMPLES = 30
const fpsBuf  = new Float64Array(FPS_SAMPLES)
let   fpsIdx  = 0

export function updateHUD({ camera, prevPos, delta, theftCount, simMode, alert, arr }) {
  // FPS
  fpsBuf[fpsIdx % FPS_SAMPLES] = 1 / delta
  fpsIdx++
  if (fpsIdx % 5 === 0) {
    const avg = fpsBuf.reduce((a,b)=>a+b,0) / Math.min(fpsIdx, FPS_SAMPLES)
    els.fps.textContent = avg.toFixed(0)
  }

  // Vitesse (m/s → km/h)
  const dist  = camera.position.distanceTo(prevPos)
  const speed = (dist / delta) * 3.6
  els.speed.textContent = speed.toFixed(1)
  els.alt.textContent   = camera.position.y.toFixed(0)

  // Vols & mode
  els.theftCount.textContent = theftCount
  els.simLabel.textContent   = simMode

  // Arrondissement courant
  function getArrondissement(lat, lng) {
  if (!arrGeoJSON) return null
  for (const f of arrGeoJSON.features) {
    if (isPointInGeoJSONFeature(lat, lng, f)) {
      const n = f.properties.c_ar
      return { label: n === 1 ? '1er' : `${n}e`, cssColor: ARR_COLORS[n] || '#fff' }
    }
  }
  return null
}

function isPointInGeoJSONFeature(lat, lng, feature) {
  const coords = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates[0]]
    : feature.geometry.coordinates.map(p => p[0])
  return coords.some(ring => pointInRing(lat, lng, ring))
}

function pointInRing(lat, lng, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ln_i, la_i] = ring[i]   // GeoJSON = [lng, lat]
    const [ln_j, la_j] = ring[j]
    if (((ln_i > lng) !== (ln_j > lng)) &&
        (lat < (la_j - la_i) * (lng - ln_i) / (ln_j - ln_i) + la_i))
      inside = !inside
  }
  return inside
}

  // Alerte
  if (alert !== els.hud.classList.contains('alert-mode')) {
    els.hud.classList.toggle('alert-mode', alert)
    els.status.textContent = alert ? '⚠ CIBLE DÉTECTÉE' : 'SURVEILLANCE'
  }
}

// ── Panneau détail cluster
const detailPanel = document.getElementById('detail-panel')
const hourChart   = document.getElementById('hour-chart')

export function showClusterDetail(cl) {
  const hours = new Array(24).fill(0)
  cl.pts.forEach(p => hours[p.hour]++)
  const peak = hours.indexOf(Math.max(...hours))

  document.getElementById('detail-title').textContent = cl.pts[0]?.zone || '—'
  document.getElementById('detail-count').textContent = `${cl.pts.length} vols recensés`
  document.getElementById('detail-found').textContent = `${cl.rec} retrouvés (${Math.round(cl.rec/cl.pts.length*100)}%)`
  document.getElementById('detail-peak').textContent  = `Pic horaire : ${peak}h – ${peak+1}h`

  const cv  = hourChart
  const ctx = cv.getContext('2d')
  const mx  = Math.max(...hours)
  ctx.clearRect(0, 0, cv.width, cv.height)
  hours.forEach((v, i) => {
    const h = (v / mx) * cv.height
    ctx.fillStyle = i === peak ? '#ff2244' : 'rgba(0,255,153,0.4)'
    ctx.fillRect(i * (cv.width/24), cv.height - h, cv.width/24 - 1, h)
  })
  ctx.fillStyle = 'rgba(255,255,255,.3)'
  ctx.font      = '9px monospace'
  ctx.fillText('0h',  2,             cv.height - 2)
  ctx.fillText('12h', cv.width/2-8,  cv.height - 2)
  ctx.fillText('23h', cv.width-22,   cv.height - 2)

  detailPanel.style.display = 'block'
}

export function hideClusterDetail() {
  detailPanel.style.display = 'none'
}