import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRastreo, fechaHora } from '../lib/api';
import CategoriaIcono from './CategoriaIcono';
import './Rastreo.css';

const FORMATO_FOLIO = /^[0-9A-Fa-f]{8}$/;

// Pasos reales del sistema (los mismos estados que usa el funcionario)
const PASOS = [
  { clave: 'pendiente', titulo: 'Reporte recibido' },
  { clave: 'en_proceso', titulo: 'En proceso de atención' },
  { clave: 'atendida', titulo: 'Atendido' },
];
const ETIQUETA_ESTADO = { pendiente: 'Recibido', en_proceso: 'En proceso', atendida: 'Atendido' };

// "08:04 p.m." ya termina en punto: evita "p.m.."
const conPunto = (texto) => (texto.endsWith('.') ? texto : `${texto}.`);

const limpiarFolio = (valor) => valor.trim().replace(/^#/, '').toUpperCase();

function estadoDelPaso(indice, estado) {
  const actual = PASOS.findIndex((p) => p.clave === estado);
  if (estado === 'atendida' || indice < actual) return 'hecho';
  return indice === actual ? 'actual' : 'pendiente';
}

function textoDelPaso(clave, situacion, r) {
  if (clave === 'pendiente') {
    const registrado = conPunto(`Registrado el ${fechaHora(r.created_at)}`);
    return situacion === 'actual' ? `${registrado} Está en espera de que lo revisen.` : registrado;
  }
  if (clave === 'en_proceso') {
    if (situacion === 'actual') return 'Una cuadrilla del Ayuntamiento ya está atendiendo el problema.';
    return situacion === 'hecho' ? 'Se atendió el problema.' : 'Aún no ha iniciado la atención.';
  }
  if (situacion === 'hecho') return r.atendida_at ? conPunto(`Resuelto el ${fechaHora(r.atendida_at)}`) : 'Resuelto.';
  return 'Pendiente.';
}

function Resultado({ r, onActualizar, onOtro }) {
  const zona = r.colonia
    ? `Col. ${r.colonia}${r.municipio ? `, ${r.municipio}` : ''}`
    : (r.municipio || 'No disponible');

  return (
    <article className="rastreo-resultado" aria-live="polite">
      <header className="rastreo-resultado__cabecera">
        <span className="rastreo-resultado__icono"><CategoriaIcono slug={r.categoria} size={30} /></span>
        <div className="rastreo-resultado__titulo">
          <h2>{r.categoria_nombre}</h2>
          <span className="rastreo-folio">Folio {r.folio}</span>
        </div>
        <span className={`rastreo-estado rastreo-estado--${r.estado}`}>{ETIQUETA_ESTADO[r.estado] ?? r.estado}</span>
      </header>

      <ol className="rastreo-pasos" aria-label="Avance del reporte">
        {PASOS.map((p, i) => {
          const situacion = estadoDelPaso(i, r.estado);
          return (
            <li key={p.clave} className={`rastreo-paso rastreo-paso--${situacion}`} aria-current={situacion === 'actual' ? 'step' : undefined}>
              <span className="rastreo-paso__marca" aria-hidden="true">{situacion === 'hecho' ? '✓' : i + 1}</span>
              <div>
                <strong>{p.titulo}</strong>
                <p>{textoDelPaso(p.clave, situacion, r)}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <dl className="rastreo-datos">
        <div><dt>Zona</dt><dd>{zona}</dd></div>
        <div>
          <dt>Reportes ciudadanos</dt>
          <dd>
            {r.reportes_count === 1
              ? '1 reporte'
              : `${r.reportes_count} reportes sobre este mismo problema`}
          </dd>
        </div>
      </dl>

      <div className="rastreo-acciones">
        <button type="button" className="btn btn-outline-secondary" onClick={onActualizar}>Actualizar estado</button>
        <button type="button" className="btn btn-outline-secondary" onClick={onOtro}>Buscar otro folio</button>
        <Link to="/" className="btn btn-primary">Hacer un nuevo reporte</Link>
      </div>
      <p className="rastreo-nota">Esta consulta solo muestra el avance público; no incluye datos personales.</p>
    </article>
  );
}

export default function Rastreo() {
  const [params, setParams] = useSearchParams();
  const folioUrl = limpiarFolio(params.get('folio') ?? '');
  const [entrada, setEntrada] = useState(folioUrl);
  const [errorEntrada, setErrorEntrada] = useState(null);
  const [tick, setTick] = useState(0);
  const [respuesta, setRespuesta] = useState({ folio: null, tick: -1, datos: null, error: null });
  const inputRef = useRef(null);

  const formatoValido = FORMATO_FOLIO.test(folioUrl);
  const hayConsulta = folioUrl !== '';
  // "Cargando" = todavía no llega la respuesta de la consulta actual (folio + actualización)
  const cargando = formatoValido && (respuesta.folio !== folioUrl || respuesta.tick !== tick);

  useEffect(() => {
    if (!FORMATO_FOLIO.test(folioUrl)) return undefined;
    let vigente = true;
    getRastreo(folioUrl)
      .then((datos) => vigente && setRespuesta({ folio: folioUrl, tick, datos, error: null }))
      .catch((e) => vigente && setRespuesta({ folio: folioUrl, tick, datos: null, error: { mensaje: e.message, status: e.status ?? 0 } }));
    return () => { vigente = false; };
  }, [folioUrl, tick]);

  function buscar(e) {
    e.preventDefault();
    const folio = limpiarFolio(entrada);
    if (!folio) return setErrorEntrada('Escribe el folio de tu reporte.');
    if (!FORMATO_FOLIO.test(folio)) {
      return setErrorEntrada('El folio tiene 8 caracteres: números y letras de la A a la F, por ejemplo 840C9033.');
    }
    setErrorEntrada(null);
    setEntrada(folio);
    setParams({ folio }); // la URL queda compartible: /rastreo?folio=840C9033
    setTick((n) => n + 1);
  }

  function otroFolio() {
    setParams({});
    setEntrada('');
    setErrorEntrada(null);
    inputRef.current?.focus();
  }

  let contenido = null;
  if (hayConsulta && !formatoValido) {
    contenido = (
      <div className="rastreo-aviso rastreo-aviso--error" role="alert">
        El folio «{folioUrl}» no tiene el formato correcto. Debe tener 8 caracteres, por ejemplo 840C9033.
      </div>
    );
  } else if (cargando) {
    contenido = (
      <div className="rastreo-cargando" role="status">
        <span className="rastreo-cargando__giro" />
        Buscando tu reporte…
      </div>
    );
  } else if (hayConsulta && respuesta.error) {
    const { mensaje, status } = respuesta.error;
    const titulo = status === 404 ? 'Folio no encontrado' : status === 429 ? 'Espera un momento' : 'No pudimos mostrar el reporte';
    // "Reintentar" solo ayuda ante fallos de red o del servidor; si el folio no existe hay que corregirlo
    const reintentable = status === 0 || status >= 500;
    contenido = (
      <div className="rastreo-aviso rastreo-aviso--error" role="alert">
        <strong>{titulo}</strong>
        <span>{mensaje}</span>
        {reintentable && (
          <button type="button" className="btn btn-outline-secondary" onClick={() => setTick((n) => n + 1)}>Reintentar</button>
        )}
      </div>
    );
  } else if (hayConsulta && respuesta.datos) {
    contenido = <Resultado r={respuesta.datos} onActualizar={() => setTick((n) => n + 1)} onOtro={otroFolio} />;
  }

  return (
    <section className="rastreo">
      <div className="rastreo__contenido">
        <header className="rastreo-intro">
          <h1>Seguimiento de reportes</h1>
          <p>Consulta el avance de tu reporte con el folio que recibiste al enviarlo.</p>
        </header>

        <form className="rastreo-buscador" onSubmit={buscar} noValidate>
          <label htmlFor="rastreo-folio">Folio de tu reporte</label>
          <div className="rastreo-buscador__fila">
            <input
              ref={inputRef}
              id="rastreo-folio"
              className="form-control"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={9}
              placeholder="Ej. 840C9033"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value.toUpperCase())}
              aria-invalid={errorEntrada ? 'true' : undefined}
              aria-describedby={errorEntrada ? 'rastreo-error' : 'rastreo-ayuda'}
            />
            <button type="submit" className="btn btn-primary" disabled={cargando}>
              {cargando ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
          {errorEntrada
            ? <p id="rastreo-error" className="rastreo-buscador__error" role="alert">{errorEntrada}</p>
            : <p id="rastreo-ayuda" className="rastreo-buscador__ayuda">Está en la pantalla de confirmación y en el correo que te enviamos.</p>}
        </form>

        {contenido}
      </div>
    </section>
  );
}
