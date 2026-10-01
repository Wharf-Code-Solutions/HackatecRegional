// Área de servicio: República Mexicana.
// LIMITES_MEXICO: caja para limitar el desplazamiento del mapa.
// POLIGONO_MEXICO: contorno aproximado [lon, lat] con margen (para validar). Debe coincidir con api/index.py.
export const LIMITES_MEXICO = [[-118.6, 14.3], [-86.5, 32.8]] // [[oeste, sur], [este, norte]]
export const ZOOM_MINIMO = 4

export const POLIGONO_MEXICO = [
  [-117.3, 32.7], [-115.4, 32.9], [-114.7, 32.9], [-111.0, 31.6], [-108.1, 31.6], [-106.4, 32.1],
  [-104.4, 29.9], [-103.0, 29.3], [-101.4, 29.7], [-100.4, 29.0], [-99.4, 27.9], [-98.1, 26.6],
  [-97.0, 26.3], [-96.3, 25.5], [-96.8, 22.2], [-95.3, 19.2], [-93.6, 18.1], [-91.8, 19.0],
  [-90.2, 20.4], [-89.5, 21.95], [-86.3, 21.9], [-86.2, 20.0], [-87.0, 18.2], [-88.0, 17.9],
  [-89.1, 17.7], [-90.9, 17.6], [-90.3, 16.2], [-91.6, 15.75], [-92.4, 14.3], [-93.2, 13.9],
  [-95.2, 15.5], [-99.9, 16.0], [-104.4, 18.4], [-106.3, 22.5], [-109.0, 22.2], [-110.5, 22.5],
  [-113.0, 24.2], [-115.7, 27.6], [-116.5, 30.0], [-117.7, 32.4],
]

export function dentroDeMexico(lat, lon) {
  let dentro = false
  for (let i = 0, j = POLIGONO_MEXICO.length - 1; i < POLIGONO_MEXICO.length; j = i++) {
    const [xi, yi] = POLIGONO_MEXICO[i]
    const [xj, yj] = POLIGONO_MEXICO[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}
