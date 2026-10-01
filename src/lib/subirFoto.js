import { supabase } from './supabase'

const BUCKET = 'reportes-fotos'

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
