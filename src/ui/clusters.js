import * as THREE from 'three'

const container = document.getElementById('cluster-container')

export function updateClusters(thefts, camera, onClusterClick) {
  container.innerHTML = ''
  if (camera.position.y < 55) return

  const R       = camera.position.y / 3.2
  const visited = new Uint8Array(thefts.length)
  const clusters = []

  for (let i = 0; i < thefts.length; i++) {
    if (visited[i]) continue
    const cl = { pts:[thefts[i]], cx:thefts[i].x, cz:thefts[i].z, rec: thefts[i].recovered?1:0 }
    for (let j = i+1; j < thefts.length; j++) {
      if (visited[j]) continue
      const dx = thefts[j].x - thefts[i].x
      const dz = thefts[j].z - thefts[i].z
      if (dx*dx + dz*dz < R*R) {
        cl.pts.push(thefts[j])
        cl.cx += thefts[j].x
        cl.cz += thefts[j].z
        if (thefts[j].recovered) cl.rec++
        visited[j] = 1
      }
    }
    visited[i] = 1
    cl.cx /= cl.pts.length
    cl.cz /= cl.pts.length
    clusters.push(cl)
  }

  for (const cl of clusters) {
    if (cl.pts.length < 4) continue
    const sc = worldToScreen(new THREE.Vector3(cl.cx, 0, cl.cz), camera)
    if (!sc.vis) continue

    const el = document.createElement('div')
    el.className = 'cluster-badge'
    el.style.cssText = `left:${sc.x}px;top:${sc.y}px`
    el.innerHTML = `<span class="cb-count">${cl.pts.length}</span><span class="cb-sub">${Math.round(cl.rec/cl.pts.length*100)}% ret.</span>`
    el.addEventListener('click', () => onClusterClick(cl))
    container.appendChild(el)
  }
}

function worldToScreen(v3, camera) {
  const v = v3.clone().project(camera)
  return {
    x:   (v.x *  0.5 + 0.5) * innerWidth,
    y:   (v.y * -0.5 + 0.5) * innerHeight,
    vis: v.z < 1 && v.z > -1,
  }
}
