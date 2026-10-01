// Súbela cuando cambie el texto de los términos: todos los dispositivos tendrán que aceptar de nuevo
const VERSION = '1'
const CLAVE = 'terminos_aceptados'

export function terminosAceptados() {
  try { return localStorage.getItem(CLAVE) === VERSION } catch { return false }
}

export function guardarAceptacion() {
  try { localStorage.setItem(CLAVE, VERSION) } catch { /* sin almacenamiento: se vuelve a pedir en la próxima visita */ }
}
