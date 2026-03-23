export const UA_DATA = {
  hotspots: [
    { lat:48.8809, lng:2.3553, name:'Gare du Nord',   risk:0.95 },
    { lat:48.8600, lng:2.3470, name:'Châtelet',       risk:0.90 },
    { lat:48.8762, lng:2.3590, name:'Gare de l\'Est', risk:0.82 },
    { lat:48.8432, lng:2.3740, name:'Gare de Lyon',   risk:0.80 },
    { lat:48.8764, lng:2.3274, name:'Saint-Lazare',   risk:0.78 },
    { lat:48.8490, lng:2.3082, name:'Montparnasse',   risk:0.72 },
  ],
  warehouses: [
    { lat:48.8916, lng:2.3516, name:'Entrepôt 18e — Clignancourt' },
    { lat:48.8878, lng:2.3862, name:'Entrepôt 19e — La Villette'  },
    { lat:48.9362, lng:2.3600, name:'Saint-Denis — Hub externe'   },
    { lat:48.9120, lng:2.4180, name:'Aubervilliers — Secondaire'  },
  ],
  veins: [
    { name:'Nord → Saint-Denis',   color:'#4488ff', via_metro:true,
      points:[[48.8809,2.3553],[48.8862,2.3520],[48.8916,2.3516],[48.9120,2.3558],[48.9362,2.3600]] },
    { name:'Est → 19e',            color:'#44ccff', via_metro:true,
      points:[[48.8600,2.3470],[48.8648,2.3600],[48.8715,2.3690],[48.8760,2.3780],[48.8878,2.3862]] },
    { name:'Ouest → Périph',       color:'#00aaff', via_metro:false,
      points:[[48.8764,2.3274],[48.8820,2.3082],[48.8968,2.2958]] },
    { name:'Sud → Périph',         color:'#3366ff', via_metro:false,
      points:[[48.8490,2.3082],[48.8298,2.3220],[48.8140,2.3320]] },
    { name:'Lyon → Aubervilliers', color:'#5599ff', via_metro:true,
      points:[[48.8432,2.3740],[48.8560,2.3680],[48.8650,2.3700],[48.8760,2.3820],[48.9120,2.4180]] },
  ],
  exitVeins: [
    { lat:48.9120, lng:2.3558, name:'Porte de la Chapelle', priority:'CRITIQUE' },
    { lat:48.8968, lng:2.2958, name:'Porte de Clichy',      priority:'HAUTE'    },
    { lat:48.8298, lng:2.3220, name:"Porte d'Orléans",      priority:'HAUTE'    },
    { lat:48.9012, lng:2.4458, name:'Porte de Pantin',      priority:'HAUTE'    },
  ],
  bikeBoxes: [
    { lat:48.8809, lng:2.3553, name:'Gare du Nord'  },
    { lat:48.8600, lng:2.3470, name:'Châtelet'      },
    { lat:48.8432, lng:2.3740, name:'Gare de Lyon'  },
    { lat:48.8764, lng:2.3274, name:'Saint-Lazare'  },
  ],
  views: [
    { center:[48.866,2.355], zoom:12 },
    { center:[48.870,2.360], zoom:11 },
    { center:[48.890,2.340], zoom:11 },
    { center:[48.866,2.355], zoom:13 },
  ],
}

export class UrbanArchitectSim {
  constructor(map) {
    this.map = map; this.active = false; this.phase = -1
    this.t = 0; this.rafId = null; this.layers = []
    this.particles = []; this.pulses = []; this.radarAngle = 0
    this.lastTs = null; this._timeouts = []
    this.cv  = this._initCanvas()
    this.ctx = this.cv.getContext('2d')
  }

  _initCanvas() {
    let cv = document.getElementById('overlay-ua')
    if (!cv) {
      cv = document.createElement('canvas')
      cv.id = 'overlay-ua'
      cv.style.cssText = 'position:absolute;inset:0;z-index:15;pointer-events:none'
      document.body.appendChild(cv)
    }
    cv.width = innerWidth; cv.height = innerHeight
    window.addEventListener('resize', () => { cv.width=innerWidth; cv.height=innerHeight })
    return cv
  }

  start() {
    this.active = true; this.t = 0; this.particles = []; this.radarAngle = 0
    this.pulses = UA_DATA.hotspots.map(h => ({ ...h, r:0, r2:22, r3:44, maxR:65, speed:0.5+h.risk*0.5 }))
    this._clearTimeouts(); this._goToPhase(0)
    this.lastTs = null
    this.rafId = requestAnimationFrame(ts => this._tick(ts))
  }

  stop() {
    this.active = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this._clearTimeouts()
    this.layers.forEach(l => { try{ this.map.removeLayer(l) } catch(e){} })
    this.layers = []; this.particles = []; this.pulses = []
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height)
    this._status(''); this.phase = -1
  }

  goToPhase(n) { if (this.active && n >= 0 && n <= 3) this._goToPhase(n) }

  _goToPhase(n) {
    this._clearTimeouts()
    this.phase = n
    const v = UA_DATA.views[n]
    if (v) this.map.flyTo(v.center, v.zoom, { duration:1.1 })
    const MSGS = [
      '⚡ PHASE I — Hotspots : transit hubs haute fréquence de vol',
      '🔵 PHASE II — Trafficking Veins : trajets de consolidation actifs',
      '🚨 PHASE III — Exit Veins & entrepôts détectés',
      '🟢 PHASE IV — Secure Bike Boxes : zones de déploiement recommandées',
    ]
    this._status(MSGS[n] || '')
    if (n === 0) this._setTimeout(() => this._goToPhase(1), 5000)
    if (n === 1) { this._showVeins();     this._setTimeout(() => this._goToPhase(2), 7000) }
    if (n === 2) { this._showExitVeins(); this._setTimeout(() => this._goToPhase(3), 6000) }
    if (n === 3) { this._showBikeBoxes() }
  }

  _tick(ts) {
    if (!this.active) return
    const dt = this.lastTs ? Math.min(ts-this.lastTs,100) : 16
    this.lastTs = ts; this.t += dt
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height)
    this._drawRadar()
    this._drawPulses(dt)
    this._drawParticles(dt)
    if (this.phase >= 2) this._drawExitGlow()
    this.rafId = requestAnimationFrame(t => this._tick(t))
  }

  _drawRadar() {
    this.radarAngle = (this.radarAngle + 0.009) % (Math.PI*2)
    const c = this.map.latLngToContainerPoint([48.866, 2.355])
    const R = Math.min(this.cv.width, this.cv.height) * 0.44
    // Cercles concentriques
    this.ctx.strokeStyle = 'rgba(0,255,153,0.07)'; this.ctx.lineWidth = 1
    for (let r=R*0.25; r<=R; r+=R*0.25) {
      this.ctx.beginPath(); this.ctx.arc(c.x,c.y,r,0,Math.PI*2); this.ctx.stroke()
    }
    // Balayage
    const a0=this.radarAngle-0.6, a1=this.radarAngle
    this.ctx.beginPath(); this.ctx.moveTo(c.x,c.y)
    this.ctx.arc(c.x,c.y,R,a0,a1); this.ctx.closePath()
    const g=this.ctx.createLinearGradient(c.x+Math.cos(a0)*R,c.y+Math.sin(a0)*R,c.x+Math.cos(a1)*R,c.y+Math.sin(a1)*R)
    g.addColorStop(0,'rgba(0,255,153,0)'); g.addColorStop(1,'rgba(0,255,153,0.15)')
    this.ctx.fillStyle=g; this.ctx.fill()
    // Ligne
    this.ctx.beginPath(); this.ctx.moveTo(c.x,c.y)
    this.ctx.lineTo(c.x+Math.cos(a1)*R, c.y+Math.sin(a1)*R)
    this.ctx.strokeStyle='rgba(0,255,153,0.55)'; this.ctx.lineWidth=1.5; this.ctx.stroke()
  }

  _drawPulses(dt) {
    for (const p of this.pulses) {
      p.r  = (p.r  + dt*p.speed*0.050) % p.maxR
      p.r2 = (p.r2 + dt*p.speed*0.038) % p.maxR
      p.r3 = (p.r3 + dt*p.speed*0.026) % p.maxR
      const {x,y} = this._xy(p.lat,p.lng)
      for (const [r,a] of [[p.r,0.9],[p.r2,0.5],[p.r3,0.25]]) {
        this.ctx.beginPath(); this.ctx.arc(x,y,r,0,Math.PI*2)
        this.ctx.strokeStyle=`rgba(255,30,60,${(1-r/p.maxR)*a})`
        this.ctx.lineWidth=2; this.ctx.stroke()
      }
      this.ctx.beginPath(); this.ctx.arc(x,y,6,0,Math.PI*2)
      this.ctx.fillStyle='#ff2244'; this.ctx.shadowColor='#ff2244'; this.ctx.shadowBlur=18
      this.ctx.fill(); this.ctx.shadowBlur=0
      this.ctx.font='bold 10px Orbitron,monospace'; this.ctx.fillStyle='#ff9aaa'
      this.ctx.textAlign='left'; this.ctx.textBaseline='middle'
      this.ctx.shadowColor='#ff2244'; this.ctx.shadowBlur=6
      this.ctx.fillText('⚠ '+p.name, x+12, y); this.ctx.shadowBlur=0
      this.ctx.fillStyle='rgba(255,34,68,0.15)'; this.ctx.fillRect(x+12,y+10,40,3)
      this.ctx.fillStyle='#ff2244'; this.ctx.fillRect(x+12,y+10,40*p.risk,3)
    }
  }

  _showVeins() {
    this.layers.forEach(l=>{try{this.map.removeLayer(l)}catch(e){}});this.layers=[]
    for (const v of UA_DATA.veins) {
      const poly=L.polyline(v.points,{color:v.color,weight:v.via_metro?2:3,opacity:0.65,dashArray:v.via_metro?'6 4':null}).addTo(this.map)
      this.layers.push(poly)
      if (v.via_metro) {
        const mid=v.points[Math.floor(v.points.length/2)]
        const b=L.marker(mid,{icon:L.divIcon({className:'',
          html:`<div style="background:rgba(0,40,120,.9);border:1px solid ${v.color};color:${v.color};font-family:'Share Tech Mono',monospace;font-size:8px;padding:2px 6px;white-space:nowrap;box-shadow:0 0 8px ${v.color}66">⬇ MÉTRO / Wi-Fi Sniffing</div>`,
          iconAnchor:[60,8]}),interactive:false}).addTo(this.map)
        this.layers.push(b)
      }
    }
    for (const wh of UA_DATA.warehouses) {
      const m=L.marker([wh.lat,wh.lng],{icon:L.divIcon({className:'',
        html:`<div style="background:rgba(18,0,35,.92);border:1px solid #aa44ff;color:#cc88ff;font-family:'Share Tech Mono',monospace;font-size:9px;padding:3px 7px;white-space:nowrap;box-shadow:0 0 10px #aa44ff55">📦 ${wh.name}</div>`,
        iconAnchor:[65,8]}),zIndexOffset:700}).addTo(this.map)
      this.layers.push(m)
    }
    this._spawnParticles()
  }

  _spawnParticles() {
    for (const v of UA_DATA.veins) {
      const spawn=()=>{
        if(!this.active||this.phase<1) return
        this.particles.push({v,prog:0,speed:0.0005+Math.random()*0.0007})
        this._setTimeout(spawn,400+Math.random()*700)
      }
      this._setTimeout(spawn,Math.random()*600)
    }
  }

  _drawParticles(dt) {
    this.particles=this.particles.filter(p=>p.prog<=1)
    for (const p of this.particles) {
      p.prog+=dt*p.speed
      const pt=this._lerp(p.v.points,p.prog); if(!pt) continue
      const {x,y}=this._xy(pt[0],pt[1])
      const ug=p.v.via_metro&&p.prog>0.15&&p.prog<0.85
      this.ctx.beginPath(); this.ctx.arc(x,y,ug?3:5,0,Math.PI*2)
      this.ctx.fillStyle=ug?'rgba(120,210,255,.8)':p.v.color+'dd'
      this.ctx.shadowColor=p.v.color; this.ctx.shadowBlur=ug?5:14
      this.ctx.fill(); this.ctx.shadowBlur=0
      this.ctx.beginPath(); this.ctx.arc(x,y,ug?1.5:3,0,Math.PI*2)
      this.ctx.fillStyle='rgba(255,255,255,.35)'; this.ctx.fill()
    }
  }

  _showExitVeins() {
    const PC={CRITIQUE:'#ff2244',HAUTE:'#ff8800',MOYENNE:'#ffcc44'}
    for (const ev of UA_DATA.exitVeins) {
      const c=PC[ev.priority]||'#fff'
      const m=L.marker([ev.lat,ev.lng],{icon:L.divIcon({className:'',
        html:`<div style="background:rgba(8,2,18,.94);border:2px solid ${c};color:${c};font-family:'Share Tech Mono',monospace;font-size:9px;padding:5px 8px;white-space:nowrap;box-shadow:0 0 16px ${c}88;text-align:center">⚠ ${ev.name}<br><span style="font-size:8px;opacity:.7">${ev.priority}</span></div>`,
        iconAnchor:[55,20]}),zIndexOffset:800}).addTo(this.map)
      this.layers.push(m)
    }
  }

  _drawExitGlow() {
    const PC={CRITIQUE:'255,34,68',HAUTE:'255,136,0',MOYENNE:'255,204,68'}
    for (const ev of UA_DATA.exitVeins) {
      const {x,y}=this._xy(ev.lat,ev.lng),c=PC[ev.priority]||'255,255,255'
      const pulse=0.3+0.7*Math.abs(Math.sin(this.t*0.0025))
      this.ctx.beginPath(); this.ctx.arc(x,y,24,0,Math.PI*2)
      this.ctx.fillStyle=`rgba(${c},${pulse*0.25})`; this.ctx.fill()
      this.ctx.beginPath(); this.ctx.arc(x,y,7,0,Math.PI*2)
      this.ctx.fillStyle=`rgba(${c},.95)`
      this.ctx.shadowColor=`rgb(${c})`; this.ctx.shadowBlur=18
      this.ctx.fill(); this.ctx.shadowBlur=0
    }
  }

  _showBikeBoxes() {
    for (const bz of UA_DATA.bikeBoxes) {
      const m=L.marker([bz.lat,bz.lng],{icon:L.divIcon({className:'',
        html:`<div style="background:rgba(0,22,12,.94);border:1.5px solid #00ff99;color:#00ff99;font-family:'Share Tech Mono',monospace;font-size:9px;padding:3px 8px;white-space:nowrap;box-shadow:0 0 14px #00ff9966">🔒 ${bz.name}</div>`,
        iconAnchor:[60,8]}),zIndexOffset:900}).addTo(this.map)
      this.layers.push(m)
    }
  }

  _xy(lat,lng){const p=this.map.latLngToContainerPoint([lat,lng]);return{x:p.x,y:p.y}}
  _lerp(pts,t){const n=pts.length-1,i=Math.min(Math.floor(t*n),n-1),f=t*n-i,a=pts[i],b=pts[Math.min(i+1,n)];return[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]}
  _status(msg){const el=document.getElementById('ua-status');if(el){el.textContent=msg;el.style.opacity=msg?'1':'0'}}
  _setTimeout(fn,ms){const id=setTimeout(fn,ms);this._timeouts.push(id);return id}
  _clearTimeouts(){this._timeouts.forEach(clearTimeout);this._timeouts=[]}
}