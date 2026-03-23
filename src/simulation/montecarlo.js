import { generateTheftData } from './thefts.js'

const HOTSPOT_NAMES = [
  'Châtelet / Les Halles','République / Bastille','Saint-Lazare / Opéra',
  'Nation / Gare de Lyon','Montparnasse','Bercy / Quai de la Rapée',
  'Saint-Michel / Luxembourg','Marais / Hôtel de Ville',
  'Tour Eiffel / Champ de Mars','Canal Saint-Martin',
  'Pigalle / Montmartre','Denfert / Alésia',
]

export function runMonteCarlo(n, onProgress, onDone) {
  const zoneAccum  = Object.fromEntries(HOTSPOT_NAMES.map(n=>[n,0]))
  const hourAccum  = new Array(24).fill(0)
  let totalVols=0, totalFound=0, i=0

  function step(){
    if(i>=n){
      const total=Object.values(zoneAccum).reduce((a,b)=>a+b,0)
      const zoneScores=Object.entries(zoneAccum)
        .map(([name,c])=>({name,score:c/total*100}))
        .sort((a,b)=>b.score-a.score)
      onDone({ zoneScores, peakHour:hourAccum.indexOf(Math.max(...hourAccum)), recovRate:totalVols>0?(totalFound/totalVols*100).toFixed(1):'—' })
      return
    }
    const sim=generateTheftData(i*0x9e3779b9+42)
    for(const t of sim){
      if(zoneAccum[t.zone]!==undefined) zoneAccum[t.zone]++
      hourAccum[t.hour]++; totalVols++; if(t.recovered) totalFound++
    }
    i++; onProgress(i,n)
    if(i%4===0) setTimeout(step,0); else step()
  }
  setTimeout(step,0)
}

// Heatmap MC — retourne des points avec vraies coords GPS
export function buildMCHeatData(n) {
  // Grille en degrés (résolution ~300m)
  const CELL_LAT = 0.003
  const CELL_LNG = 0.004
  const grid = new Map()

  for(let s=0;s<n;s++){
    const sim=generateTheftData(s*137+17)
    for(const t of sim){
      const gLat = Math.round(t.lat/CELL_LAT)
      const gLng = Math.round(t.lng/CELL_LNG)
      const key  = gLat*10000+gLng
      grid.set(key,(grid.get(key)||0)+1)
    }
  }

  const vals=[ ...grid.values() ]
  const maxV=Math.max(...vals)
  return [ ...grid.entries() ].map(([key,v])=>({
    lat: Math.round(key/10000)*CELL_LAT,
    lng: (key%10000)*CELL_LNG,
    intensity: v/maxV,
  }))
}