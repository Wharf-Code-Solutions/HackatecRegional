// Cliente de la API del panel de funcionarios (FastAPI en /api/admin/*)

async function request(ruta, opciones = {}) {
  let res
  try {
    res = await fetch(ruta, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', ...opciones.headers },
    })
  } catch {
    throw new Error('No hay conexión con el servidor')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status >= 500 && res.status !== 503) throw new Error('Error del servidor, intenta de nuevo')
    throw new Error(typeof data?.detail === 'string' ? data.detail : 'Datos inválidos')
  }
  return data
}

const patch = (ruta, cuerpo) =>
  request(ruta, { method: 'PATCH', body: JSON.stringify(cuerpo) })

// Sin estado: pendiente + en_proceso. Con estado: 'atendida' | 'rechazada' | …
export const getIncidencias = (estado) =>
  request(estado ? `/api/admin/incidencias?estado=${estado}` : '/api/admin/incidencias')

// Pines del mapa ciudadano: endpoint público, solo activas y sin datos personales
export const getIncidenciasPublicas = () => request('/api/incidencias')

export const getDetalle = (id) => request(`/api/admin/incidencias/${id}`)

export const marcarEnProceso = (id) => patch('/api/admin/en-proceso', { incidencia_id: id })
export const restaurar = (id) => patch('/api/admin/restaurar', { incidencia_id: id })
export const resolver = (id) => patch('/api/admin/resolver', { incidencia_id: id })
export const rechazar = (id, motivo) =>
  patch('/api/admin/rechazar', { incidencia_id: id, motivo: motivo?.trim() || null })

// ---- Formato ----
const ZONA = 'America/Mexico_City'

export function fechaHora(iso) {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: ZONA,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function hora(iso) {
  return new Date(iso).toLocaleTimeString('es-MX', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })
}

export function hace(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'Hace un momento'
  if (min < 60) return `Hace ${min} min`
  if (min < 1440) return `Hace ${Math.round(min / 60)} h`
  return `Hace ${Math.round(min / 1440)} d`
}

export const folio = (id) => id.slice(0, 8).toUpperCase()

export function nivelPrioridad(p) {
  if (p >= 7) return 'alta'
  if (p >= 4) return 'media'
  return 'baja'
}

export const coordenadas = (i) => `${i.lat.toFixed(5)}, ${i.lon.toFixed(5)}`

// "Col. Moderno, Veracruz" | "Veracruz" | "Sin colonia identificada" (en zonas rurales Mapbox no trae colonia)
export function textoColonia(i) {
  if (i.colonia && i.municipio) return `Col. ${i.colonia}, ${i.municipio}`
  if (i.colonia) return `Col. ${i.colonia}`
  if (i.municipio) return i.municipio
  return 'Sin colonia identificada'
}
