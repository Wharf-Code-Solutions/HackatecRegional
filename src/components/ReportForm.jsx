import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subirFoto } from '../lib/subirFoto'
import './ReportForm.css'

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FOTO_MB = 15 // límite de entrada; se comprime antes de subir (bucket: 5 MB)

// Props: lat / lon del marcador central (Mapbox: center.lat, center.lng -> lon)
export default function ReportForm({ lat, lon, onSuccess }) {
  const [categorias, setCategorias] = useState([])
  const [categoriaId, setCategoriaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [email, setEmail] = useState('')
  const [foto, setFoto] = useState(null)
  const [estado, setEstado] = useState('idle') // idle | subiendo | enviando
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    supabase
      .from('categorias')
      .select('id, slug, nombre')
      .order('id')
      .then(({ data, error }) => {
        if (error) setError('No se pudieron cargar las categorías')
        else setCategorias(data ?? [])
      })
  }, [])

  const preview = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  function elegirFoto(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    if (!TIPOS_FOTO.includes(archivo.type)) {
      setError('La foto debe ser JPG, PNG o WebP')
      return
    }
    if (archivo.size > MAX_FOTO_MB * 1024 * 1024) {
      setError(`La foto no debe pasar de ${MAX_FOTO_MB} MB`)
      return
    }
    setError(null)
    setFoto(archivo)
  }

  async function enviar(e) {
    e.preventDefault()
    setError(null)
    if (!categoriaId) return setError('Elige una categoría')
    if (lat == null || lon == null) return setError('Mueve el mapa para marcar la ubicación')

    try {
      let foto_url = null
      if (foto) {
        setEstado('subiendo')
        foto_url = await subirFoto(foto)
      }

      setEstado('enviando')
      const res = await fetch('/api/reportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoria_id: Number(categoriaId),
          lat,
          lon,
          descripcion: descripcion.trim() || null,
          foto_url,
          email_ciudadano: email.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const detalle = typeof data?.detail === 'string' ? data.detail : 'Datos inválidos'
        throw new Error(res.status >= 500 ? 'Error del servidor, intenta de nuevo' : detalle)
      }

      setResultado(data)
      onSuccess?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setEstado('idle')
    }
  }

  function reiniciar() {
    setResultado(null)
    setCategoriaId('')
    setDescripcion('')
    setEmail('')
    setFoto(null)
  }

  const ocupado = estado !== 'idle'

  if (resultado) {
    return (
      <div className="report-form" role="status">
        <h2>¡Reporte enviado!</h2>
        <p>
          {resultado.agrupado
            ? `Ya había ${resultado.reportes_count - 1} reporte(s) de este problema; el tuyo se sumó.`
            : 'Registramos un nuevo problema.'}
        </p>
        <p className="report-form__meta">Folio: {resultado.incidencia_id}</p>
        <button type="button" onClick={reiniciar}>Hacer otro reporte</button>
      </div>
    )
  }

  return (
    <form className="report-form" onSubmit={enviar}>
      <h2>Reportar problema</h2>
      <p className="report-form__meta">
        {lat != null ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'Mueve el mapa para elegir ubicación'}
      </p>

      <label>
        Categoría
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
          <option value="">Selecciona…</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </label>

      <label>
        Descripción (opcional)
        <textarea
          rows={3}
          maxLength={500}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
        <span className="report-form__meta">{descripcion.length}/500</span>
      </label>

      <label>
        Foto (opcional)
        <input type="file" accept={TIPOS_FOTO.join(',')} onChange={elegirFoto} />
      </label>
      {preview && <img className="report-form__preview" src={preview} alt="Vista previa" />}

      <label>
        Correo para avisarte (opcional)
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>

      {error && <p className="report-form__error" role="alert">{error}</p>}

      <button type="submit" disabled={ocupado}>
        {estado === 'subiendo' ? 'Subiendo foto…' : estado === 'enviando' ? 'Enviando…' : 'Enviar reporte'}
      </button>
    </form>
  )
}
