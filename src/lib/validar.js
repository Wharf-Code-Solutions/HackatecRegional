// Validaciones del formulario de reporte. Funciones puras: devuelven el mensaje de error o null.
import { dentroDeMexico } from './mexico'

export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'] // lo que se le pide al selector (iOS convierte HEIC a JPEG con esta lista)
// Algunos navegadores (Chrome/Firefox en iOS, "Archivos") entregan la foto sin tipo MIME o como HEIC
const TIPOS_ACEPTADOS = [...TIPOS_FOTO, 'image/heic', 'image/heif']
const TIPO_POR_EXTENSION = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' }
export const tipoDeFoto = (archivo) =>
  archivo.type || TIPO_POR_EXTENSION[(archivo.name || '').split('.').pop().toLowerCase()] || ''
export const esHeic = (archivo) => /heic|heif/.test(tipoDeFoto(archivo))
export const MAX_FOTO_MB = 15 // límite de entrada; se comprime antes de subir (bucket: 5 MB)
export const MAX_NOMBRE = 100
export const MAX_DESCRIPCION = 500

export function validarNombre(valor) {
  const t = valor.trim()
  if (!t) return 'Escribe tu nombre'
  if (t.length < 2) return 'El nombre debe tener al menos 2 caracteres'
  if (t.length > MAX_NOMBRE) return `El nombre no puede pasar de ${MAX_NOMBRE} caracteres`
  if (!/^\p{L}[\p{L} '.-]*$/u.test(t) || (t.match(/\p{L}/gu) ?? []).length < 2) {
    return 'Usa solo letras, espacios, apóstrofo, punto o guion (sin números ni símbolos)'
  }
  return null
}

// El correo es opcional, pero si se escribe debe tener formato válido
export function validarEmail(valor) {
  const t = valor.trim()
  if (!t) return null
  if (t.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) {
    return 'Escribe un correo válido, por ejemplo nombre@dominio.com'
  }
  return null
}

export function validarDescripcion(valor) {
  if (valor.length > MAX_DESCRIPCION) return `La descripción no puede pasar de ${MAX_DESCRIPCION} caracteres`
  return null
}

export function validarCategoria(valor) {
  return valor ? null : 'Elige el tipo de problema'
}

export function validarFoto(archivo) {
  if (!archivo) return null
  if (!TIPOS_ACEPTADOS.includes(tipoDeFoto(archivo))) return 'La foto debe ser JPG, PNG o WebP'
  if (archivo.size > MAX_FOTO_MB * 1024 * 1024) return `La foto no debe pasar de ${MAX_FOTO_MB} MB`
  return null
}

export function validarUbicacion(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'Mueve el mapa para marcar la ubicación del problema'
  if (!dentroDeMexico(lat, lon)) return 'La ubicación debe estar dentro de la República Mexicana'
  return null
}

// Orden = orden en pantalla; el primero con error recibe el foco
export function validarFormulario({ categoriaId, descripcion, nombre, email, lat, lon }) {
  const errores = {
    categoria: validarCategoria(categoriaId),
    descripcion: validarDescripcion(descripcion),
    nombre: validarNombre(nombre),
    email: validarEmail(email),
    ubicacion: validarUbicacion(lat, lon),
  }
  return Object.fromEntries(Object.entries(errores).filter(([, v]) => v))
}
