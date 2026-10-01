import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, variablesFaltantes } from '../lib/supabase'
import { reducirParaAnalizar, subirFoto } from '../lib/subirFoto'
import { analizarFoto, folio } from '../lib/api'
import {
  MAX_DESCRIPCION, MAX_NOMBRE, TIPOS_FOTO,
  esHeic, validarFoto, validarFormulario,
} from '../lib/validar'
import BottomSheet from './BottomSheet'
import CategoriaIcono from './CategoriaIcono'
import './ReportForm.css'

// Orden en pantalla: el primer campo con error recibe el foco
const ORDEN_CAMPOS = ['foto', 'categoria', 'descripcion', 'nombre', 'email', 'ubicacion']
const CONFIANZA_ALTA = 0.6 // por debajo, la sugerencia de la foto no bloquea otra elección del usuario
const SIN_ANALISIS = { estado: 'idle', slug: null, confianza: 0 } // idle | analizando | ok | no_disponible
const MODO_DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
const ID_CAMPO = { categoria: 'rf-categoria', descripcion: 'rf-descripcion', foto: 'rf-foto', nombre: 'rf-nombre', email: 'rf-email' }

async function copiarAlPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // Respaldo para navegadores/contextos sin Clipboard API
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, ta.value.length) // iOS ignora select() en un textarea; esto sí copia
    try { return document.execCommand('copy') } finally { ta.remove() }
  }
}

function MensajeError({ id, texto }) {
  if (!texto) return null
  return <div id={id} className="rf-error" role="alert">{texto}</div>
}

function ReporteEnviado({ resultado, onOtro, onClose }) {
  const codigo = folio(resultado.incidencia_id)
  const [copiado, setCopiado] = useState(false)
  const temporizador = useRef(null)
  useEffect(() => () => clearTimeout(temporizador.current), [])

  async function copiar() {
    if (!(await copiarAlPortapapeles(codigo))) return
    setCopiado(true)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="rf-exito" role="status">
      <svg className="rf-exito__check" viewBox="0 0 52 52" aria-hidden="true">
        <circle className="rf-exito__circulo" cx="26" cy="26" r="24" />
        <path className="rf-exito__marca" d="M14 27l8 8 16-17" />
      </svg>
      <h3>¡Reporte enviado!</h3>
      <p>
        {resultado.agrupado
          ? `Ya había ${resultado.reportes_count - 1} reporte(s) de este problema; el tuyo se sumó y sube su prioridad.`
          : 'Registramos un nuevo problema. Gracias por ayudar a mejorar tu ciudad.'}
      </p>

      {resultado.correo === 'enviado' && (
        <p className="rf-exito__correo">Te enviamos un correo de confirmación.</p>
      )}

      <div className="rf-folio">
        <div>
          <span className="rf-folio__etiqueta">Folio</span>
          <span className="rf-folio__codigo">{codigo}</span>
        </div>
        <button type="button" className="rf-folio__copiar" onClick={copiar} aria-label="Copiar folio">
          {copiado ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
              Copiado
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              Copiar
            </>
          )}
        </button>
      </div>
      <span className="visually-hidden" aria-live="polite">{copiado ? 'Folio copiado' : ''}</span>
      <p className="rf-folio__nota">
        Guárdalo para dar seguimiento a tu reporte.{' '}
        <Link to={`/rastreo?folio=${codigo}`}>Ver el avance de mi reporte</Link>
      </p>

      <div className="report-form__acciones">
        <button type="button" className="btn btn-primary" onClick={onOtro}>Hacer otro reporte</button>
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  )
}

// Props: lat / lon del marcador central (MapView ya entrega { lat, lon })
export default function ReportForm({ lat, lon, onClose, onSuccess }) {
  const [categorias, setCategorias] = useState([])
  const [categoriaId, setCategoriaId] = useState('')
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [email, setEmail] = useState('')
  const [foto, setFoto] = useState(null)
  const [errorFoto, setErrorFoto] = useState(null)
  const [tocados, setTocados] = useState({}) // campos que ya se abandonaron
  const [intentado, setIntentado] = useState(false) // ya se intentó enviar
  const [estado, setEstado] = useState('idle') // idle | subiendo | enviando
  const [errorEnvio, setErrorEnvio] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [analisis, setAnalisis] = useState(SIN_ANALISIS) // lo que el modelo vio en la foto
  const [sugerida, setSugerida] = useState(false) // el tipo elegido vino de la foto
  const idAnalisis = useRef(0) // descarta respuestas de fotos que ya se reemplazaron
  const inputCamara = useRef(null)
  const inputGaleria = useRef(null)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('categorias')
      .select('id, slug, nombre')
      .order('id')
      .then(({ data, error }) => {
        if (error) setErrorEnvio('No se pudieron cargar las categorías')
        else setCategorias(data ?? [])
      })
  }, [])

  const preview = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  // Los errores se derivan de los valores; solo se muestran los de campos tocados o tras intentar enviar
  const errorFotoObligatoria = foto ? null : 'Agrega una foto del problema'
  const errores = { ...validarFormulario({ categoriaId, descripcion, nombre, email, lat, lon }), ...((errorFoto || errorFotoObligatoria) ? { foto: errorFoto || errorFotoObligatoria } : {}) }
  const ver = (campo) => ((tocados[campo] || intentado) ? errores[campo] : null)
  const tocar = (campo) => setTocados((t) => ({ ...t, [campo]: true }))
  const props = (campo) => ({
    id: ID_CAMPO[campo],
    'aria-invalid': ver(campo) ? 'true' : undefined,
    'aria-describedby': ver(campo) ? `${ID_CAMPO[campo]}-error` : undefined,
    onBlur: () => tocar(campo),
  })

  // Tipo que el modelo detectó con confianza suficiente para contradecir al usuario
  const detectada = analisis.estado === 'ok' && analisis.confianza >= CONFIANZA_ALTA
    ? categorias.find((c) => c.slug === analisis.slug)
    : null
  const conflicto = foto && detectada && categoriaId && String(detectada.id) !== categoriaId ? detectada : null
  const analizando = analisis.estado === 'analizando'

  function quitarFoto() {
    idAnalisis.current += 1
    setFoto(null)
    setErrorFoto(null)
    setAnalisis(SIN_ANALISIS)
    setSugerida(false)
  }

  async function elegirFoto(e) {
    const archivo = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!archivo) return
    const problema = validarFoto(archivo)
    setErrorFoto(problema)
    if (problema) return

    // Una sola llamada por foto: sugiere el tipo y verifica que sea un problema reportable
    const id = ++idAnalisis.current
    setFoto(archivo)
    setAnalisis({ ...SIN_ANALISIS, estado: 'analizando' })
    // Dos pasos separados para saber cuál falla (en Safari suele ser la compresión) sin romper el envío del reporte
    let veredicto
    let imagen = null
    try {
      imagen = await reducirParaAnalizar(archivo)
    } catch (err) {
      console.warn('analizar-foto: no se pudo preparar la imagen', err)
      if (esHeic(archivo)) { // este navegador no sabe abrir HEIC: tampoco podría subirla después
        setFoto(null)
        setAnalisis(SIN_ANALISIS)
        setErrorFoto('No pudimos leer esa foto (formato HEIC). Usa "Tomar foto" o elige una imagen JPG o PNG.')
        return
      }
      veredicto = { estado: 'no_disponible', razon: 'compresion' }
    }
    if (imagen) {
      try {
        veredicto = await analizarFoto(imagen)
      } catch (err) {
        console.warn('analizar-foto: falló la solicitud', err?.status, err?.message)
        veredicto = { estado: 'no_disponible', razon: err?.motivo || 'error' }
      }
    }
    if (id !== idAnalisis.current) return // ya se eligió otra foto o se quitó esta
    if (!veredicto) veredicto = { estado: 'no_disponible', razon: 'respuesta_vacia' }
    if (veredicto.estado === 'no_disponible') console.warn('analizar-foto no disponible:', veredicto.razon)

    if (veredicto.estado === 'rechazada') {
      setFoto(null)
      setAnalisis(SIN_ANALISIS)
      setErrorFoto(veredicto.motivo || 'La foto no corresponde a un problema urbano reportable.')
      return
    }
    if (veredicto.estado !== 'ok') {
      setAnalisis({ ...SIN_ANALISIS, estado: 'no_disponible', razon: veredicto.razon || null })
      return
    }
    setAnalisis({ estado: 'ok', slug: veredicto.categoria_slug, confianza: veredicto.confianza ?? 0 })
    const cat = categorias.find((c) => c.slug === veredicto.categoria_slug)
    if (!cat && !categoriaId) setAnalisis({ estado: 'ok', slug: null, confianza: veredicto.confianza ?? 0, sinTipo: true })
    if (cat && !categoriaId) { // no pisa una elección del usuario
      setCategoriaId(String(cat.id))
      setSugerida(true)
    }
  }

  function usarDetectada() {
    setCategoriaId(String(conflicto.id))
    setSugerida(true)
  }

  async function enviar(e) {
    e.preventDefault()
    setErrorEnvio(null)
    setIntentado(true)

    if (conflicto) {
      document.getElementById('rf-conflicto')?.focus()
      return
    }
    const primero = ORDEN_CAMPOS.find((c) => errores[c])
    if (primero) {
      // 'ubicacion' no tiene campo propio: el aviso se muestra arriba del formulario
      document.getElementById(ID_CAMPO[primero] ?? 'rf-ubicacion')?.focus()
      return
    }

    try {
      setEstado('subiendo')
      const foto_url = await subirFoto(foto)

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
        let detalle = 'Datos inválidos'
        if (typeof data?.detail === 'string') detalle = data.detail
        else if (Array.isArray(data?.detail) && data.detail[0]?.msg) detalle = data.detail[0].msg.replace(/^Value error, /, '')
        throw new Error(res.status >= 500 && res.status !== 503 ? 'Error del servidor, intenta de nuevo' : detalle)
      }

      setResultado(data)
      onSuccess?.(data)
    } catch (err) {
      setErrorEnvio(err.message)
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
    setErrorFoto(null)
    setAnalisis(SIN_ANALISIS)
    setSugerida(false)
    idAnalisis.current += 1
    setTocados({})
    setIntentado(false)
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
    contenido = <ReporteEnviado resultado={resultado} onOtro={reiniciar} onClose={onClose} />
  } else {
    contenido = (
      <form onSubmit={enviar} noValidate>
        <p id="rf-ubicacion" tabIndex={-1} className={`report-form__meta${intentado && errores.ubicacion ? ' rf-error' : ''}`}>
          {errores.ubicacion ? errores.ubicacion : `Ubicación: ${lat.toFixed(5)}, ${lon.toFixed(5)}`}
        </p>

        <div className="mb-3">
          <span className="form-label d-block">Foto (obligatoria): muestra el problema</span>
          <div className="report-form__acciones">
            <button
              {...props('foto')}
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => inputCamara.current.click()}
            >
              Tomar foto
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => inputGaleria.current.click()}>
              Elegir de galería
            </button>
          </div>
          <input ref={inputCamara} type="file" hidden accept={TIPOS_FOTO.join(',')} capture="environment" onChange={elegirFoto} />
          <input ref={inputGaleria} type="file" hidden accept={TIPOS_FOTO.join(',')} onChange={elegirFoto} />
          <MensajeError id="rf-foto-error" texto={ver('foto')} />
          {preview && (
            <div className="report-form__foto">
              <img src={preview} alt="Vista previa de la foto" />
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={quitarFoto}>
                Quitar
              </button>
            </div>
          )}
          <div className="rf-analisis" role="status" aria-live="polite">
            {analizando && <span className="rf-analisis__texto"><i className="rf-analisis__giro" />Analizando foto…</span>}
            {analisis.estado === 'no_disponible' && (
              <span className="rf-analisis__aviso">
                No pudimos verificar la foto automáticamente; elige el tipo de problema.
                {MODO_DEBUG && analisis.razon ? ` (motivo: ${analisis.razon})` : ''}
              </span>
            )}
            {analisis.estado === 'ok' && analisis.sinTipo && !categoriaId && (
              <span className="rf-analisis__aviso">No identificamos el tipo de problema en la foto; elígelo tú.</span>
            )}
          </div>
        </div>

        <fieldset className={`categorias${analizando ? ' is-analizando' : ''}`} disabled={ocupado}>
          <legend className="form-label">Tipo de problema</legend>
          {sugerida && !conflicto && <p className="rf-sugerido">Sugerido por la foto. Puedes cambiarlo.</p>}
          <div className="categorias__grid" role="radiogroup" aria-describedby={ver('categoria') ? 'rf-categoria-error' : undefined}>
            {categorias.map((c, i) => (
              <label key={c.id} className={`categoria${String(c.id) === categoriaId ? ' is-selected' : ''}${sugerida && String(c.id) === categoriaId ? ' is-sugerida' : ''}`}>
                <input
                  type="radio"
                  name="categoria"
                  value={c.id}
                  id={i === 0 ? 'rf-categoria' : undefined}
                  checked={String(c.id) === categoriaId}
                  onChange={(e) => { setCategoriaId(e.target.value); setSugerida(false); tocar('categoria') }}
                  aria-invalid={ver('categoria') ? 'true' : undefined}
                />
                <CategoriaIcono slug={c.slug} />
                <span>{c.nombre}</span>
              </label>
            ))}
          </div>
          <MensajeError id="rf-categoria-error" texto={ver('categoria')} />
          {conflicto && (
            <div id="rf-conflicto" className="alert alert-warning rf-conflicto" role="alert" tabIndex={-1}>
              <p>La foto parece ser de <strong>{conflicto.nombre}</strong>, pero elegiste otro tipo.</p>
              <div className="report-form__acciones">
                <button type="button" className="btn btn-sm btn-primary" onClick={usarDetectada}>Usar «{conflicto.nombre}»</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={quitarFoto}>Quitar foto</button>
              </div>
            </div>
          )}
        </fieldset>

        <div className="mb-3">
          <label className="form-label" htmlFor="rf-descripcion">Descripción (opcional)</label>
          <textarea
            {...props('descripcion')}
            className="form-control"
            rows={3}
            maxLength={MAX_DESCRIPCION}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <div className="report-form__meta">{descripcion.length}/{MAX_DESCRIPCION}</div>
          <MensajeError id="rf-descripcion-error" texto={ver('descripcion')} />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="rf-nombre">Nombre</label>
          <input
            {...props('nombre')}
            className="form-control"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            maxLength={MAX_NOMBRE}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <MensajeError id="rf-nombre-error" texto={ver('nombre')} />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="rf-email">Correo electrónico</label>
          <input
            {...props('email')}
            className="form-control"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <MensajeError id="rf-email-error" texto={ver('email')} />
        </div>

        {errorEnvio && <div className="alert alert-danger" role="alert">{errorEnvio}</div>}

        <button type="submit" className="btn btn-primary w-100" disabled={ocupado || analizando}>
          {analizando ? 'Analizando foto…' : estado === 'subiendo' ? 'Subiendo foto…' : estado === 'enviando' ? 'Enviando…' : 'Enviar reporte'}
        </button>
        <p className="report-form__meta">
          Al enviar aceptas los <Link to="/terminos" target="_blank" rel="noopener">términos y condiciones</Link>.
        </p>
      </form>
    )
  }

  return (
    <BottomSheet titulo={resultado ? 'Reporte enviado' : 'Reportar problema'} onClose={onClose}>
      {contenido}
    </BottomSheet>
  )
}
