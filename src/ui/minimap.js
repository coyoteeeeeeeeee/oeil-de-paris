import { GEO, HOTSPOTS } from '../utils/geo.js'

const canvas = document.getElementById('minimap')
const ctx    = canvas.getContext('2d')
const S      = 200  // taille canvas
const W      = GEO.size

function wx(x) { return (x / W + 0.5) * S }
function wz(z) { return (z / W + 0.5) * S }

export function drawMinimap(thefts, camera, mcData) {
  ctx.clearRect(0, 0, S, S)

  // Fond
  ctx.fillStyle = 'rgba(1,4,12,0.97)'
  ctx.fillRect(0, 0, S, S)

  // Grille
  ctx.strokeStyle = 'rgba(0,255,153,0.055)'
  ctx.lineWidth   = 1
  for (let i = 0; i <= S; i += 20) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke()
  }

  // MC heatmap (overlay doré)
  if (mcData?.length) {
    mcData.forEach(pt => {
      const r = 3 + pt.intensity * 6
      ctx.fillStyle = `rgba(255,200,30,${pt.intensity * 0.45})`
      ctx.beginPath()
      ctx.arc(wx(pt.x), wz(pt.z), r, 0, Math.PI*2)
      ctx.fill()
    })
  }

  // Hotspots (cercles discrets)
  HOTSPOTS.forEach(h => {
    ctx.strokeStyle = 'rgba(255,34,68,0.45)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.arc(wx(h.x), wz(h.z), 3, 0, Math.PI*2)
    ctx.stroke()
  })

  // Points de vols
  thefts.forEach(t => {
    const mx = wx(t.x), mz = wz(t.z)
    if (mx < 0 || mx > S || mz < 0 || mz > S) return
    ctx.fillStyle = t.recovered ? 'rgba(0,255,153,0.6)' : 'rgba(255,34,68,0.45)'
    ctx.beginPath()
    ctx.arc(mx, mz, 1.4, 0, Math.PI*2)
    ctx.fill()
  })

  // Position caméra
  const cx = wx(camera.position.x)
  const cz = wz(camera.position.z)
  ctx.strokeStyle = '#00ff99'
  ctx.lineWidth   = 1.5
  ctx.shadowColor = '#00ff99'
  ctx.shadowBlur  = 6
  ctx.beginPath()
  ctx.arc(cx, cz, 4, 0, Math.PI*2)
  ctx.stroke()
  ctx.shadowBlur = 0

  // Direction caméra (petite flèche)
  const fwd = new DOMMatrix().rotate(0, 0, 0) // placeholder, direction approximée
  ctx.strokeStyle = 'rgba(0,255,153,0.5)'
  ctx.lineWidth   = 1
}
