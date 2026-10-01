import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, variablesFaltantes } from '../lib/supabase'
import { subirFoto } from '../lib/subirFoto'
import { folio } from '../lib/api'
import {
  MAX_DESCRIPCION, MAX_NOMBRE, TIPOS_FOTO,
  validarFoto, validarFormulario,
} from '../lib/validar'
import BottomSheet from './BottomSheet'
import CategoriaIcono from './CategoriaIcono'
import './ReportForm.css'

// Orden en pantalla: el primer campo con error recibe el foco
const ORDEN_CAMPOS = ['categoria', 'descripcion', 'foto', 'nombre', 'email', 'ubicacion']
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
      <p className="rf-folio__nota">Guárdalo para dar seguimiento a tu reporte.</p>

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
  const errores = { ...validarFormulario({ categoriaId, descripcion, nombre, email, lat, lon }), ...(errorFoto ? { foto: errorFoto } : {}) }
  const ver = (campo) => ((tocados[campo] || intentado) ? errores[campo] : null)
  const tocar = (campo) => setTocados((t) => ({ ...t, [campo]: true }))
  const props = (campo) => ({
    id: ID_CAMPO[campo],
    'aria-invalid': ver(campo) ? 'true' : undefined,
    'aria-describedby': ver(campo) ? `${ID_CAMPO[campo]}-error` : undefined,
    onBlur: () => tocar(campo),
  })

  function elegirFoto(e) {
    const archivo = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!archivo) return
    const problema = validarFoto(archivo)
    setErrorFoto(problema)
    if (!problema) setFoto(archivo)
  }

  async function enviar(e) {
    e.preventDefault()
    setErrorEnvio(null)
    setIntentado(true)

    const primero = ORDEN_CAMPOS.find((c) => errores[c])
    if (primero) {
      // 'ubicacion' no tiene campo propio: el aviso se muestra arriba del formulario
      document.getElementById(ID_CAMPO[primero] ?? 'rf-ubicacion')?.focus()
      return
    }

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

        <fieldset className="categorias" disabled={ocupado}>
          <legend className="form-label">Tipo de problema</legend>
          <div className="categorias__grid" role="radiogroup" aria-describedby={ver('categoria') ? 'rf-categoria-error' : undefined}>
            {categorias.map((c, i) => (
              <label key={c.id} className={`categoria${String(c.id) === categoriaId ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="categoria"
                  value={c.id}
                  id={i === 0 ? 'rf-categoria' : undefined}
                  checked={String(c.id) === categoriaId}
                  onChange={(e) => { setCategoriaId(e.target.value); tocar('categoria') }}
                  aria-invalid={ver('categoria') ? 'true' : undefined}
                />
                <CategoriaIcono slug={c.slug} />
                <span>{c.nombre}</span>
              </label>
            ))}
          </div>
          <MensajeError id="rf-categoria-error" texto={ver('categoria')} />
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
          <span className="form-label d-block">Foto (opcional)</span>
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
          <MensajeError id="rf-foto-error" texto={errorFoto} />
          {preview && (
            <div className="report-form__foto">
              <img src={preview} alt="Vista previa de la foto" />
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { setFoto(null); setErrorFoto(null) }}>
                Quitar
              </button>
            </div>
          )}
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

        <button type="submit" className="btn btn-primary w-100" disabled={ocupado}>
          {estado === 'subiendo' ? 'Subiendo foto…' : estado === 'enviando' ? 'Enviando…' : 'Enviar reporte'}
        </button>
      </form>
    )
  }

  return (
    <BottomSheet titulo={resultado ? 'Reporte enviado' : 'Reportar problema'} onClose={onClose}>
      {contenido}
    </BottomSheet>
  )
}
