import { supabase } from './supabase'

const BUCKET = 'reportes-fotos'

// crypto.randomUUID no existe en Safari < 15.4 ni fuera de HTTPS
function idUnico() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

// Versión pequeña (≈512 px, ~0.1 MB) en base64 para que el modelo de visión la analice sin gastar cuota
export async function reducirParaAnalizar(archivo) {
  const { default: imageCompression } = await import('browser-image-compression')
  const chica = await imageCompression(archivo, {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 512,
    fileType: 'image/jpeg',
    useWebWorker: false, // el worker baja su código de un CDN y falla en Safari/redes con bloqueadores
  })
  const url = await imageCompression.getDataUrlFromFile(chica)
  return url.split(',')[1]
}

// Comprime en el navegador (salida siempre JPEG, por si viene HEIC/PNG grande),
// sube a Storage con nombre único y devuelve la URL pública.
export async function subirFoto(archivo) {
  const { default: imageCompression } = await import('browser-image-compression') // solo si hay foto
  const comprimida = await imageCompression(archivo, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    fileType: 'image/jpeg',
    useWebWorker: false,
  })

  const ruta = `${idUnico()}.jpg`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, comprimida, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`)

  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl
}
