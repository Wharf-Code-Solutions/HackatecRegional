import { supabase } from './supabase'

const BUCKET = 'reportes-fotos'

// Versión pequeña (≈512 px, ~0.1 MB) en base64 para que el modelo de visión la analice sin gastar cuota
export async function reducirParaAnalizar(archivo) {
  const { default: imageCompression } = await import('browser-image-compression')
  const chica = await imageCompression(archivo, {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 512,
    fileType: 'image/jpeg',
    useWebWorker: true,
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
    useWebWorker: true,
  })

  const ruta = `${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, comprimida, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`)

  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl
}
