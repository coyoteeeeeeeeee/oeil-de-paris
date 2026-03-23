import './style.css'
import L from 'leaflet'
import { UrbanArchitectSim } from './simulation/urban-architect.js'
import { generateTheftData, dateMin, dateMax } from './simulation/thefts.js'
import { runMonteCarlo, buildMCHeatData } from './simulation/montecarlo.js'

// ══════════════════════════════════════════════════════════════
//  BOOT SEQUENCE
// ══════════════════════════════════════════════════════════════
const BOOT_LINES = [
  { t:0,    c:'#00ff99', txt:"L'ŒIL DE PARIS // SYSTÈME DE SURVEILLANCE URBAINE v2.0" },
  { t:150,  c:'#1a3a2a', txt:'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' },
  { t:300,  c:'#00cc77', txt:'INITIALISATION DU NOYAU...                          [OK]' },
  { t:460,  c:'#00cc77', txt:'CHARGEMENT CARTE SATELLITE PARIS (ESRI)...          [OK]' },
  { t:620,  c:'#00cc77', txt:'CONNEXION OPENDATA PARIS — ARRONDISSEMENTS...       [OK]' },
  { t:780,  c:'#00cc77', txt:'IMPORT DONNÉES VOLS 2023-2024...                    [OK]' },
  { t:940,  c:'#00cc77', txt:'CALIBRATION HOTSPOTS (6 ZONES TRANSIT)...          [OK]' },
  { t:1100, c:'#00cc77', txt:'MOTEUR MONTE CARLO (100 SIMULATIONS)...             [OK]' },
  { t:1260, c:'#00cc77', txt:'MODULE URBAN ARCHITECT — DIGITAL TWIN...            [OK]' },
  { t:1420, c:'#1a3a2a', txt:'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' },
  { t:1580, c:'#ff8844', txt:'⚠  DONNÉES SENSIBLES — ACCÈS RESTREINT MIT/PARIS' },
  { t:1720, c:'#ffcc44', txt:'   SOURCE : Préfecture de Police de Paris' },
  { t:1860, c:'#ffcc44', txt:'   8 742 vols recensés · Période Jan 2023 – Déc 2024' },
  { t:2000, c:'#1a3a2a', txt:'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' },
  { t:2160, c:'#00ff99', txt:'SYSTÈME OPÉRATIONNEL. EN ATTENTE OPÉRATEUR...' },
]

function runBoot(onDone) {
  const screen = document.getElementById('login-screen')
  const inner  = screen.querySelector('.login-inner')
  inner.innerHTML = `
    <div id="boot-lines" style="font-family:'Share Tech Mono',monospace;font-size:11px;line-height:1.7;text-align:left;width:580px;max-width:90vw"></div>
    <span id="boot-cursor" style="color:#00ff99;font-size:16px">█</span>
  `
  const linesEl = document.getElementById('boot-lines')
  let maxT = 0

  for (const line of BOOT_LINES) {
    maxT = Math.max(maxT, line.t)
    setTimeout(() => {
      const el = document.createElement('div')
      el.style.color = line.c
      el.textContent = line.txt
      linesEl.appendChild(el)
    }, line.t)
  }

  setTimeout(() => {
    document.getElementById('boot-cursor').style.display = 'none'
    const btn = document.createElement('button')
    btn.textContent = '▶  INITIALISER LA CONNEXION'
    btn.style.cssText = 'margin-top:24px;padding:12px 36px;background:transparent;border:1px solid #00ff99;color:#00ff99;font-family:Orbitron,sans-serif;font-size:11px;letter-spacing:2px;cursor:pointer;display:block;transition:.2s'
    btn.onmouseenter = () => { btn.style.background='#00ff99'; btn.style.color='#000' }
    btn.onmouseleave = () => { btn.style.background='transparent'; btn.style.color='#00ff99' }
    btn.onclick = () => {
      screen.style.transition = 'opacity 0.6s'; screen.style.opacity = '0'
      setTimeout(() => { screen.style.display='none'; onDone() }, 600)
    }
    inner.appendChild(btn)
  }, maxT + 600)
}

// ══════════════════════════════════════════════════════════════
//  CARTE LEAFLET
// ══════════════════════════════════════════════════════════════
const map = L.map('map', { center:[48.8566,2.3522], zoom:13, zoomControl:false, attributionControl:false })
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19}).addTo(map)

// ══════════════════════════════════════════════════════════════
//  URBAN ARCHITECT
// ══════════════════════════════════════════════════════════════
const uaSim = new UrbanArchitectSim(map)

document.getElementById('ua-start-btn').addEventListener('click', () => {
  document.getElementById('ua-start-btn').style.display = 'none'
  document.getElementById('ua-stop-btn').style.display  = 'block'
  uaSim.start()
})
document.getElementById('ua-stop-btn').addEventListener('click', () => {
  document.getElementById('ua-stop-btn').style.display  = 'none'
  document.getElementById('ua-start-btn').style.display = 'block'
  uaSim.stop()
})

// ══════════════════════════════════════════════════════════════
//  CANVAS OVERLAY
// ══════════════════════════════════════════════════════════════
const canvas = document.getElementById('overlay')
const ctx    = canvas.getContext('2d')
function resizeCanvas(){ canvas.width=innerWidth; canvas.height=innerHeight }
resizeCanvas()
window.addEventListener('resize', () => { resizeCanvas(); refresh() })
map.on('move zoom moveend zoomend', () => refresh())
function ll2s(lat,lng){ const p=map.latLngToContainerPoint([lat,lng]); return{x:p.x,y:p.y} }

// ══════════════════════════════════════════════════════════════
//  DONNÉES
// ══════════════════════════════════════════════════════════════
let allThefts = generateTheftData()
const filters = { hourMin:0, hourMax:23, showRecovered:true }
const tl = { playing:false, progress:0, speed:1 }
let mcData=null, simMode='DONNÉES RÉELLES', showArr=true, showHeat=true

function getFiltered(){
  return allThefts.filter(t => t.hour>=filters.hourMin && t.hour<=filters.hourMax && (filters.showRecovered||!t.recovered))
}
function getVisible(){
  const cutoff=dateMin+tl.progress*(dateMax-dateMin)
  return getFiltered().filter(t=>t.date<=cutoff)
}

// ══════════════════════════════════════════════════════════════
//  ARRONDISSEMENTS GeoJSON
// ══════════════════════════════════════════════════════════════
let arrGeoJSON=null, arrLayer=null
const ARR_COLORS = {
  1:'#00ffcc',2:'#00ffcc',3:'#00ffcc',4:'#00ffcc',
  5:'#44aaff',6:'#44aaff',7:'#44aaff',
  8:'#44ff88',16:'#44ff88',17:'#44ff88',
  9:'#ffee44',10:'#ffee44',18:'#ffee44',
  11:'#ff8844',12:'#ff8844',19:'#ff8844',20:'#ff8844',
  13:'#cc44ff',14:'#cc44ff',15:'#cc44ff',
}

fetch('https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/arrondissements/exports/geojson')
  .then(r=>r.json()).then(data=>{
    arrGeoJSON=data
    arrLayer=L.geoJSON(data,{
      style:f=>{const n=f.properties.c_ar,c=ARR_COLORS[n]||'#fff';return{color:c,weight:2,opacity:.85,fillColor:c,fillOpacity:.07}},
      onEachFeature:(f,layer)=>{
        const center=layer.getBounds().getCenter(),n=f.properties.c_ar,label=n===1?'1er':`${n}e`
        L.marker(center,{icon:L.divIcon({className:'',
          html:`<span style="font-family:Orbitron,monospace;font-size:11px;font-weight:bold;color:${ARR_COLORS[n]||'#fff'};text-shadow:0 0 8px ${ARR_COLORS[n]||'#fff'};white-space:nowrap;pointer-events:none">${label}</span>`,
          iconAnchor:[12,8]}),interactive:false,zIndexOffset:-100}).addTo(map)
      }
    })
    if(showArr) arrLayer.addTo(map)
    refresh()
  }).catch(e=>console.warn('GeoJSON indisponible',e))

function getArrFromGeoJSON(lat,lng){
  if(!arrGeoJSON) return null
  for(const f of arrGeoJSON.features){
    const rings=f.geometry.type==='Polygon'?[f.geometry.coordinates[0]]:f.geometry.coordinates.map(p=>p[0])
    for(const ring of rings){
      let inside=false
      for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const[ln_i,la_i]=ring[i],[ln_j,la_j]=ring[j]
        if(((ln_i>lng)!==(ln_j>lng))&&(lat<(la_j-la_i)*(lng-ln_i)/(ln_j-ln_i)+la_i))inside=!inside
      }
      if(inside){const n=f.properties.c_ar;return{label:n===1?'1er':`${n}e`,cssColor:ARR_COLORS[n]||'#fff'}}
    }
  }
  return null
}

// ══════════════════════════════════════════════════════════════
//  STATS RÉELLES (Préfecture de Police, 2023-2024)
// ══════════════════════════════════════════════════════════════
const REAL_STATS = {
  total:8742, recoveryRate:7.99, avgPerDay:23.9, ebikePct:34, organizedCrime:61,
  hourly:[120,80,60,45,40,55,120,280,480,520,490,510,540,500,480,510,560,780,820,710,580,420,310,200],
}

function initStats(){
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v}
  s('stat-total', REAL_STATS.total.toLocaleString('fr-FR'))
  s('stat-daily', REAL_STATS.avgPerDay)
  s('stat-recovery', REAL_STATS.recoveryRate+'%')
  s('stat-ebike', REAL_STATS.ebikePct+'%')
  s('stat-orga', REAL_STATS.organizedCrime+'%')
  const cv=document.getElementById('stats-hour-chart'); if(!cv) return
  const c=cv.getContext('2d'),mx=Math.max(...REAL_STATS.hourly)
  REAL_STATS.hourly.forEach((v,i)=>{
    const h=(v/mx)*(cv.height-10),x=i*(cv.width/24),w=cv.width/24-1
    const g=c.createLinearGradient(0,cv.height-h,0,cv.height)
    const pk=i===18
    g.addColorStop(0,pk?'#ff2244':'rgba(0,255,153,.8)'); g.addColorStop(1,pk?'rgba(255,34,68,.1)':'rgba(0,255,153,.1)')
    c.fillStyle=g; c.fillRect(x,cv.height-h,w,h)
    if(pk){c.fillStyle='#ff2244';c.font='7px monospace';c.textAlign='center';c.fillText('▲PIC',x+w/2,cv.height-h-3)}
  })
  c.fillStyle='rgba(255,255,255,.2)';c.font='7px monospace';c.textAlign='center'
  ;[0,6,12,18,23].forEach(h=>c.fillText(h+'h',h*(cv.width/24)+(cv.width/48),cv.height-1))
}

function updateLiveHistogram(vis){
  const cv=document.getElementById('live-histogram'); if(!cv||!vis.length) return
  const c=cv.getContext('2d'),hours=new Array(24).fill(0)
  vis.forEach(t=>hours[t.hour]++)
  const mx=Math.max(...hours,1)
  c.clearRect(0,0,cv.width,cv.height)
  hours.forEach((v,i)=>{
    const h=(v/mx)*(cv.height-6),x=i*(cv.width/24),w=cv.width/24-1
    c.fillStyle=i===18?'rgba(255,34,68,.85)':'rgba(0,180,255,.6)'
    c.fillRect(x,cv.height-h,w,h)
  })
  const el=document.getElementById('live-count');if(el)el.textContent=vis.length.toLocaleString('fr-FR')
}

// ══════════════════════════════════════════════════════════════
//  DESSIN CANVAS
// ══════════════════════════════════════════════════════════════
function drawAll(vis){
  ctx.clearRect(0,0,canvas.width,canvas.height)
  if(showHeat) drawHeatmap(vis)
  drawTheftDots(vis)
  if(mcData) drawMCHeatmap()
  drawMinimap(vis)
  updateLiveHistogram(vis)
}

function drawHeatmap(thefts){
  const R=Math.max(8,40-map.getZoom()*1.8); ctx.globalCompositeOperation='screen'
  for(const t of thefts){
    const{x,y}=ll2s(t.lat,t.lng); if(x<-R||x>canvas.width+R||y<-R||y>canvas.height+R) continue
    const g=ctx.createRadialGradient(x,y,0,x,y,R)
    if(t.recovered){g.addColorStop(0,'rgba(0,255,100,.55)');g.addColorStop(.5,'rgba(0,255,100,.12)');g.addColorStop(1,'rgba(0,0,0,0)')}
    else{g.addColorStop(0,'rgba(255,30,60,.60)');g.addColorStop(.5,'rgba(255,30,60,.14)');g.addColorStop(1,'rgba(0,0,0,0)')}
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.fill()
  }
  ctx.globalCompositeOperation='source-over'
}

function drawTheftDots(thefts){
  const r=Math.max(2,map.getZoom()-11)
  for(const t of thefts){
    const{x,y}=ll2s(t.lat,t.lng); if(x<0||x>canvas.width||y<0||y>canvas.height) continue
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2)
    ctx.fillStyle=t.recovered?'rgba(0,255,153,.9)':'rgba(255,34,68,.9)';ctx.fill()
  }
}

function drawMCHeatmap(){
  ctx.globalCompositeOperation='screen'; const R=Math.max(15,60-map.getZoom()*2.5)
  for(const pt of mcData){
    const{x,y}=ll2s(pt.lat,pt.lng); if(x<-R||x>canvas.width+R||y<-R||y>canvas.height+R) continue
    const r=R*(.3+pt.intensity*.8),g=ctx.createRadialGradient(x,y,0,x,y,r)
    g.addColorStop(0,`rgba(255,200,20,${.55*pt.intensity})`);g.addColorStop(.6,`rgba(255,140,0,${.15*pt.intensity})`);g.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()
  }
  ctx.globalCompositeOperation='source-over'
}

const PARIS={latMin:48.815,latMax:48.905,lngMin:2.260,lngMax:2.420}
function drawMinimap(thefts){
  const MW=200,MH=200,MX=canvas.width-224,MY=canvas.height-340
  const p=(lat,lng)=>({x:MX+((lng-PARIS.lngMin)/(PARIS.lngMax-PARIS.lngMin))*MW,y:MY+((PARIS.latMax-lat)/(PARIS.latMax-PARIS.latMin))*MH})
  ctx.fillStyle='rgba(1,5,14,.92)';ctx.fillRect(MX,MY,MW,MH)
  ctx.strokeStyle='rgba(0,255,153,.25)';ctx.lineWidth=1;ctx.strokeRect(MX,MY,MW,MH)
  ctx.strokeStyle='rgba(0,255,153,.05)'
  for(let i=0;i<=MW;i+=20){ctx.beginPath();ctx.moveTo(MX+i,MY);ctx.lineTo(MX+i,MY+MH);ctx.stroke();ctx.beginPath();ctx.moveTo(MX,MY+i);ctx.lineTo(MX+MW,MY+i);ctx.stroke()}
  if(showArr&&arrGeoJSON){
    for(const f of arrGeoJSON.features){
      const coords=f.geometry.type==='Polygon'?f.geometry.coordinates[0]:f.geometry.coordinates[0][0]
      ctx.beginPath(); coords.forEach(([lng,lat],i)=>{const q=p(lat,lng);i===0?ctx.moveTo(q.x,q.y):ctx.lineTo(q.x,q.y)})
      ctx.closePath();ctx.strokeStyle=ARR_COLORS[f.properties.c_ar]||'#fff';ctx.lineWidth=.8;ctx.globalAlpha=.5;ctx.stroke();ctx.globalAlpha=1
    }
  }
  for(const t of thefts){
    const q=p(t.lat,t.lng);if(q.x<MX||q.x>MX+MW||q.y<MY||q.y>MY+MH) continue
    ctx.beginPath();ctx.arc(q.x,q.y,1.5,0,Math.PI*2);ctx.fillStyle=t.recovered?'rgba(0,255,153,.7)':'rgba(255,34,68,.5)';ctx.fill()
  }
  const b=map.getBounds(),tl2=p(b.getNorth(),b.getWest()),br2=p(b.getSouth(),b.getEast())
  ctx.strokeStyle='rgba(0,255,153,.8)';ctx.lineWidth=1.2;ctx.strokeRect(tl2.x,tl2.y,br2.x-tl2.x,br2.y-tl2.y)
}

function updateHUD(vis){
  document.getElementById('theft-count').textContent=vis.length
  document.getElementById('sim-label').textContent=simMode
  document.getElementById('zoom-val').textContent=map.getZoom()
  const center=map.getCenter(),arr=getArrFromGeoJSON(center.lat,center.lng)
  const el=document.getElementById('arr-val')
  if(arr){el.textContent=arr.label;el.style.color=arr.cssColor}else{el.textContent='—';el.style.color=''}
}

// ══════════════════════════════════════════════════════════════
//  MODE PRÉSENTATION  (touche F)
// ══════════════════════════════════════════════════════════════
let presentationMode=false
const UI_PANELS=['hud','filter-panel','sim-panel','ua-panel','stats-panel','minimap-container','timeline-panel','detail-panel']

function togglePresentation(){
  presentationMode=!presentationMode
  const op=presentationMode?'0':'1'
  UI_PANELS.forEach(id=>{const el=document.getElementById(id);if(el){el.style.transition='opacity .4s';el.style.opacity=op}})
  document.getElementById('present-toggle').textContent=presentationMode?'⊞ AFFICHER UI':'⊡ MODE PRÉSENTATION'
}

// ══════════════════════════════════════════════════════════════
//  RACCOURCIS CLAVIER
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if(e.target.tagName==='INPUT') return
  if(e.key==='f'||e.key==='F') togglePresentation()
  if(e.key===' '){ e.preventDefault(); document.getElementById('play-btn').click() }
  if(e.key==='1') uaSim.goToPhase(0)
  if(e.key==='2') uaSim.goToPhase(1)
  if(e.key==='3') uaSim.goToPhase(2)
  if(e.key==='4') uaSim.goToPhase(3)
  if(e.key==='Escape'&&presentationMode) togglePresentation()
})

// ══════════════════════════════════════════════════════════════
//  CLUSTERS
// ══════════════════════════════════════════════════════════════
let clusterMarkers=[],clusterTimer=null
function rebuildClusters(thefts){
  clusterMarkers.forEach(m=>map.removeLayer(m));clusterMarkers=[]
  if(map.getZoom()<12) return
  const R=0.008,visited=new Uint8Array(thefts.length)
  for(let i=0;i<thefts.length;i++){
    if(visited[i]) continue
    const cl={pts:[thefts[i]],lat:thefts[i].lat,lng:thefts[i].lng,rec:thefts[i].recovered?1:0}
    for(let j=i+1;j<thefts.length;j++){
      if(visited[j]) continue
      const dl=thefts[j].lat-thefts[i].lat,dg=thefts[j].lng-thefts[i].lng
      if(dl*dl+dg*dg<R*R){cl.pts.push(thefts[j]);cl.lat+=thefts[j].lat;cl.lng+=thefts[j].lng;if(thefts[j].recovered)cl.rec++;visited[j]=1}
    }
    visited[i]=1;cl.lat/=cl.pts.length;cl.lng/=cl.pts.length;if(cl.pts.length<4)continue
    const pct=Math.round(cl.rec/cl.pts.length*100)
    const icon=L.divIcon({className:'',html:`<div style="background:rgba(2,8,18,.92);border:1px solid #ff2244;border-radius:50%;width:46px;height:46px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Share Tech Mono',monospace;box-shadow:0 0 10px rgba(255,34,68,.4);cursor:pointer"><span style="font-family:Orbitron,sans-serif;font-size:13px;color:#ff2244;line-height:1">${cl.pts.length}</span><span style="font-size:7px;color:rgba(255,255,255,.4);margin-top:2px">${pct}% ret.</span></div>`,iconSize:[46,46],iconAnchor:[23,23]})
    const marker=L.marker([cl.lat,cl.lng],{icon,zIndexOffset:500})
    marker.on('click',()=>showClusterDetail(cl));marker.addTo(map);clusterMarkers.push(marker)
  }
}

function showClusterDetail(cl){
  const hours=new Array(24).fill(0);cl.pts.forEach(p=>hours[p.hour]++)
  const peak=hours.indexOf(Math.max(...hours))
  document.getElementById('detail-title').textContent=cl.pts[0]?.zone||'—'
  document.getElementById('detail-count').textContent=`${cl.pts.length} vols recensés`
  document.getElementById('detail-found').textContent=`${cl.rec} retrouvés (${Math.round(cl.rec/cl.pts.length*100)}%)`
  document.getElementById('detail-peak').textContent=`Pic horaire : ${peak}h – ${peak+1}h`
  const cv=document.getElementById('hour-chart'),c=cv.getContext('2d'),mx=Math.max(...hours)
  c.clearRect(0,0,cv.width,cv.height)
  hours.forEach((v,i)=>{const h=(v/mx)*cv.height;c.fillStyle=i===peak?'#ff2244':'rgba(0,255,153,.4)';c.fillRect(i*(cv.width/24),cv.height-h,cv.width/24-1,h)})
  c.fillStyle='rgba(255,255,255,.3)';c.font='9px monospace'
  c.fillText('0h',2,cv.height-2);c.fillText('12h',cv.width/2-8,cv.height-2);c.fillText('23h',cv.width-22,cv.height-2)
  document.getElementById('detail-panel').style.display='block'
  map.flyTo([cl.lat,cl.lng],Math.max(map.getZoom(),14),{duration:.8})
}
document.getElementById('detail-close').addEventListener('click',()=>{document.getElementById('detail-panel').style.display='none'})

// ══════════════════════════════════════════════════════════════
//  REFRESH
// ══════════════════════════════════════════════════════════════
function refresh(){
  const vis=getVisible(); drawAll(vis)
  clearTimeout(clusterTimer);clusterTimer=setTimeout(()=>rebuildClusters(vis),150)
  updateHUD(vis)
  const d=new Date(dateMin+tl.progress*(dateMax-dateMin))
  document.getElementById('time-label').textContent=d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})
  document.getElementById('timeline-thumb').style.left=(tl.progress*100).toFixed(1)+'%'
}

// ══════════════════════════════════════════════════════════════
//  LOGIN → BOOT
// ══════════════════════════════════════════════════════════════
runBoot(() => { refresh(); initStats() })

// ══════════════════════════════════════════════════════════════
//  FILTRES
// ══════════════════════════════════════════════════════════════
document.getElementById('filter-hour-min').addEventListener('input',function(){filters.hourMin=+this.value;document.getElementById('hour-min-val').textContent=filters.hourMin+'h';refresh()})
document.getElementById('filter-hour-max').addEventListener('input',function(){filters.hourMax=+this.value;document.getElementById('hour-max-val').textContent=filters.hourMax+'h';refresh()})
document.getElementById('filter-recovered').addEventListener('change',function(){filters.showRecovered=this.checked;refresh()})
document.getElementById('toggle-arr').addEventListener('change',function(){
  showArr=this.checked;if(arrLayer){if(showArr)arrLayer.addTo(map);else map.removeLayer(arrLayer)};refresh()
})
document.getElementById('toggle-heat').addEventListener('change',function(){showHeat=this.checked;refresh()})
document.getElementById('present-toggle')?.addEventListener('click',togglePresentation)

// ══════════════════════════════════════════════════════════════
//  TIMELINE
// ══════════════════════════════════════════════════════════════
const playBtn=document.getElementById('play-btn'),speedBtn=document.getElementById('speed-btn'),tlBar=document.getElementById('timeline-bar')
let lastTs=null
playBtn.addEventListener('click',()=>{tl.playing=!tl.playing;playBtn.textContent=tl.playing?'⏸':'▶';if(tl.playing)requestAnimationFrame(tick)})
speedBtn.addEventListener('click',()=>{tl.speed=tl.speed===1?4:tl.speed===4?16:1;speedBtn.textContent=`×${tl.speed}`})
tlBar.addEventListener('click',e=>{const r=tlBar.getBoundingClientRect();tl.progress=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));tl.playing=false;playBtn.textContent='▶';refresh()})
function tick(ts){
  if(!tl.playing)return
  if(lastTs!==null){const d=(ts-lastTs)/1000;tl.progress=Math.min(1,tl.progress+d*.003*tl.speed);if(tl.progress>=1){tl.playing=false;playBtn.textContent='▶'}refresh()}
  lastTs=ts;requestAnimationFrame(tick)
}

// ══════════════════════════════════════════════════════════════
//  MONTE CARLO
// ══════════════════════════════════════════════════════════════
const simRunBtn=document.getElementById('sim-run-btn'),simResults=document.getElementById('sim-results'),simPrgWrap=document.getElementById('sim-progress-wrap'),simPrgBar=document.getElementById('sim-progress-bar')
simRunBtn.addEventListener('click',()=>{
  simRunBtn.disabled=true;simPrgWrap.style.display='block';simResults.style.display='none';simMode='MC EN COURS…'
  runMonteCarlo(100,
    (done,total)=>{simPrgBar.style.width=(done/total*100)+'%';document.getElementById('sim-progress-label').textContent=`${done} / ${total}`},
    (res)=>{
      const ol=document.getElementById('sim-ranking');ol.innerHTML=''
      res.zoneScores.slice(0,5).forEach(z=>{const li=document.createElement('li');li.innerHTML=`${z.name} — <span>${z.score.toFixed(1)}%</span>`;ol.appendChild(li)})
      document.getElementById('sim-peak-hour').textContent=`${res.peakHour}h – ${res.peakHour+1}h`
      document.getElementById('sim-recov-rate').textContent=`${res.recovRate}%`
      simResults.style.display='block';simPrgWrap.style.display='none';simMode='100 SIMS ✓'
      mcData=buildMCHeatData(100);refresh()
    }
  )
})
document.getElementById('sim-reset-btn').addEventListener('click',()=>{mcData=null;simRunBtn.disabled=false;simResults.style.display='none';simMode='DONNÉES RÉELLES';refresh()})

refresh()