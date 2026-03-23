/**
 * Système de coordonnées
 * Paris intra-muros → world space [-1000, 1000]²
 */
export const GEO = {
  latMin: 48.815, latMax: 48.905,
  lonMin: 2.260,  lonMax: 2.420,
  size:   2000,
}

export function geoToWorld(lat, lon) {
  const x = ((lon - GEO.lonMin) / (GEO.lonMax - GEO.lonMin) - 0.5) * GEO.size
  const z = ((1 - (lat - GEO.latMin) / (GEO.latMax - GEO.latMin)) - 0.5) * GEO.size
  return { x, z }
}

/** Hotspots de vols — coordonnées GPS réelles Paris */
export const HOTSPOTS = [
  { lat:48.860, lon:2.347, weight:18, name:'Châtelet / Les Halles'      },
  { lat:48.867, lon:2.363, weight:14, name:'République / Bastille'       },
  { lat:48.876, lon:2.327, weight:10, name:'Saint-Lazare / Opéra'        },
  { lat:48.848, lon:2.396, weight:12, name:'Nation / Gare de Lyon'       },
  { lat:48.842, lon:2.321, weight: 8, name:'Montparnasse'                },
  { lat:48.844, lon:2.373, weight: 9, name:'Bercy / Quai de la Rapée'    },
  { lat:48.852, lon:2.344, weight: 7, name:'Saint-Michel / Luxembourg'   },
  { lat:48.856, lon:2.352, weight:11, name:'Marais / Hôtel de Ville'     },
  { lat:48.858, lon:2.294, weight: 5, name:'Tour Eiffel / Champ de Mars' },
  { lat:48.861, lon:2.384, weight: 6, name:'Canal Saint-Martin'          },
  { lat:48.886, lon:2.345, weight: 5, name:'Pigalle / Montmartre'        },
  { lat:48.832, lon:2.343, weight: 4, name:'Denfert / Alésia'            },
].map(h => ({ ...h, ...geoToWorld(h.lat, h.lon) }))
