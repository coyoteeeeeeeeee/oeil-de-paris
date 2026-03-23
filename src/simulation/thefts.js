import { RNG } from '../utils/rng.js'

// Hotspots avec vraies coords GPS Paris
const HOTSPOTS = [
  { lat:48.8600, lng:2.3470, weight:18, name:'Châtelet / Les Halles'      },
  { lat:48.8674, lng:2.3631, weight:14, name:'République / Bastille'       },
  { lat:48.8764, lng:2.3274, weight:10, name:'Saint-Lazare / Opéra'        },
  { lat:48.8484, lng:2.3960, weight:12, name:'Nation / Gare de Lyon'       },
  { lat:48.8422, lng:2.3219, weight: 8, name:'Montparnasse'                },
  { lat:48.8440, lng:2.3728, weight: 9, name:'Bercy / Quai de la Rapée'    },
  { lat:48.8520, lng:2.3440, weight: 7, name:'Saint-Michel / Luxembourg'   },
  { lat:48.8560, lng:2.3520, weight:11, name:'Marais / Hôtel de Ville'     },
  { lat:48.8584, lng:2.2945, weight: 5, name:'Tour Eiffel / Champ de Mars' },
  { lat:48.8614, lng:2.3840, weight: 6, name:'Canal Saint-Martin'          },
  { lat:48.8867, lng:2.3431, weight: 5, name:'Pigalle / Montmartre'        },
  { lat:48.8321, lng:2.3430, weight: 4, name:'Denfert / Alésia'            },
]

const HOUR_WEIGHTS = [1,1,1,1,1,2,3,6,8,8,9,10,11,10,9,9,11,13,11,8,6,4,3,2]
const HOUR_TOTAL   = HOUR_WEIGHTS.reduce((a,b)=>a+b,0)
function pickHour(rng) {
  let r = rng.next() * HOUR_TOTAL
  for(let i=0;i<24;i++){ r-=HOUR_WEIGHTS[i]; if(r<=0) return i }
  return 12
}

// 1 degré lat ≈ 111km, 1 degré lng ≈ 73km à Paris
const DEG_LAT = 111000
const DEG_LNG =  73000

export function generateTheftData(seed = 0) {
  const rng    = new RNG(seed || Date.now())
  const now    = Date.now()
  const ONE_YEAR = 365*24*3600*1000
  const thefts = []

  for(const hs of HOTSPOTS){
    const count = Math.round(hs.weight * 10 * (0.8 + rng.next()*0.4))
    for(let i=0;i<count;i++){
      // Spread en mètres → degrés
      const spreadM = hs.weight * 180
      thefts.push({
        lat:       hs.lat + rng.gauss(0, spreadM/DEG_LAT),
        lng:       hs.lng + rng.gauss(0, spreadM/DEG_LNG),
        date:      now - rng.next()*ONE_YEAR,
        hour:      pickHour(rng),
        recovered: rng.next() < 0.08,
        zone:      hs.name,
        weight:    hs.weight,
      })
    }
  }

  thefts.sort((a,b)=>a.date-b.date)
  return thefts
}

export const dateMin = Date.now() - 365*24*3600*1000
export const dateMax = Date.now()