import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, variablesFaltantes } from '../lib/supabase'
import { subirFoto } from '../lib/subirFoto'
import CategoriaIcono from './CategoriaIcono'
import './ReportForm.css'

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FOTO_MB = 15 // límite de entrada; se comprime antes de subir (bucket: 5 MB)

// Props: lat / lon del marcador central (MapView ya entrega { lat, lon })
export default function ReportForm({ lat, lon, onClose, onSuccess }) {
  const [categorias, setCategorias] = useState([])
  const [categoriaId, setCategoriaId] = useState('')
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [email, setEmail] = useState('')
  const [foto, setFoto] = useState(null)
  const [estado, setEstado] = useState('idle') // idle | subiendo | enviando
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)
  const inputCamara = useRef(null)
  const inputGaleria = useRef(null)

  useEffect(() => {
    if (!supabase) return
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
    e.target.value = '' // permite volver a elegir el mismo archivo
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
    if (!nombre.trim()) return setError('Escribe tu nombre')
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
          nombre_ciudadano: nombre.trim(),
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
    setNombre('')
    setDescripcion('')
    setEmail('')
    setFoto(null)
  }

  const ocupado = estado !== 'idle'

  let contenido
  if (!supabase) {
    contenido = (
      <div className="alert alert-warning" role="alert">
        Este despliegue se compiló sin: {variablesFaltantes.join(', ')}. Agrégalas en Vercel
        (Production y Preview) y vuelve a desplegar sin caché.
      </div>
    )
  } else if (resultado) {
    contenido = (
      <div role="status">
        <div className="alert alert-success">
          <strong>¡Reporte enviado!</strong>{' '}
          {resultado.agrupado
            ? `Ya había ${resultado.reportes_count - 1} reporte(s) de este problema; el tuyo se sumó.`
            : 'Registramos un nuevo problema.'}
          <div className="report-form__meta">Folio: {resultado.incidencia_id}</div>
        </div>
        <div className="report-form__acciones">
          <button type="button" className="btn btn-primary" onClick={reiniciar}>
            Hacer otro reporte
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    )
  } else {
    contenido = (
      <form onSubmit={enviar}>
        <p className="report-form__meta">
          Ubicación: {lat != null ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'mueve el mapa para elegirla'}
        </p>

        <div className="mb-3">
          <label className="form-label" htmlFor="rf-nombre">Nombre</label>
          <input
            id="rf-nombre"
            className="form-control"
            type="text"
            autoComplete="name"
            maxLength={100}
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <fieldset className="categorias" disabled={ocupado}>
          <legend className="form-label">Tipo de problema</legend>
          <div className="categorias__grid">
            {categorias.map((c) => (
              <label
                key={c.id}
                className={`categoria${String(c.id) === categoriaId ? ' is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="categoria"
                  value={c.id}
                  checked={String(c.id) === categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  required
                />
                <CategoriaIcono slug={c.slug} />
                <span>{c.nombre}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mb-3">
          <label className="form-label" htmlFor="rf-descripcion">Descripción (opcional)</label>
          <textarea
            id="rf-descripcion"
            className="form-control"
            rows={3}
            maxLength={500}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <div className="report-form__meta">{descripcion.length}/500</div>
        </div>

        <div className="mb-3">
          <span className="form-label d-block">Foto (opcional)</span>
          <div className="report-form__acciones">
            <button type="button" className="btn btn-outline-secondary" onClick={() => inputCamara.current.click()}>
              Tomar foto
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => inputGaleria.current.click()}>
              Elegir de galería
            </button>
          </div>
          <input ref={inputCamara} type="file" hidden accept={TIPOS_FOTO.join(',')} capture="environment" onChange={elegirFoto} />
          <input ref={inputGaleria} type="file" hidden accept={TIPOS_FOTO.join(',')} onChange={elegirFoto} />
          {preview && (
            <div className="report-form__foto">
              <img src={preview} alt="Vista previa de la foto" />
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setFoto(null)}>
                Quitar
              </button>
            </div>
          )}
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="rf-email">Correo electrónico</label>
          <input
            id="rf-email"
            className="form-control"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <button type="submit" className="btn btn-primary w-100" disabled={ocupado}>
          {estado === 'subiendo' ? 'Subiendo foto…' : estado === 'enviando' ? 'Enviando…' : 'Enviar reporte'}
        </button>
      </form>
    )
  }

  return (
    <div className="report-overlay">
      <section className="report-form" aria-labelledby="rf-titulo">
        <header className="report-form__header">
          <h2 id="rf-titulo">Reportar problema</h2>
          <button type="button" className="report-form__cerrar" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        {contenido}
      </section>
    </div>
  )
}
