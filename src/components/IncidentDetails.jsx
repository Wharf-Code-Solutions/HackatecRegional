import { useEffect, useState } from 'react';
import './IncidentDetails.css';
import {
  getDetalle, marcarEnProceso, resolver, rechazar, restaurar,
  fechaHora, hora, folio, nivelPrioridad, coordenadas,
} from '../lib/api';

const ETIQUETA_PRIORIDAD = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' };

const PASOS = [
  { clave: 'pendiente', etiqueta: 'Recibida' },
  { clave: 'en_proceso', etiqueta: 'En proceso' },
  { clave: 'atendida', etiqueta: 'Atendida' },
];

function claseDePaso(indice, estado) {
  const actual = PASOS.findIndex((p) => p.clave === estado);
  if (estado === 'atendida' || indice < actual) return 'done';
  return indice === actual ? 'active' : 'pending';
}

// Si la foto no carga (URL rota o borrada) se muestra el recuadro "Sin foto" en lugar de un hueco vacío
function Foto({ url, alt }) {
  const [fallo, setFallo] = useState(false);
  if (!url || fallo) return <div className="incident-image sin-foto">{url ? 'No se pudo cargar la foto' : 'Sin foto'}</div>;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} className="incident-image" onError={() => setFallo(true)} />
    </a>
  );
}

export default function IncidentDetails({ id, resumen, onClose, onCambio }) {
  const [version, setVersion] = useState(0);
  const [detalle, setDetalle] = useState({ id: null, data: null, error: null });
  const [accion, setAccion] = useState(null); // 'proceso' | 'resolver' | 'rechazar' | 'restaurar' mientras se ejecuta
  const [confirmando, setConfirmando] = useState(null); // 'resolver' | 'rechazar'
  const [motivo, setMotivo] = useState('');
  const [errorAccion, setErrorAccion] = useState(null);

  useEffect(() => {
    let vigente = true;
    getDetalle(id)
      .then((data) => vigente && setDetalle({ id, data, error: null }))
      .catch((e) => vigente && setDetalle({ id, data: null, error: e.message }));
    return () => { vigente = false; };
  }, [id, version]);

  const cargando = detalle.id !== id;
  const d = detalle.id === id && detalle.data ? detalle.data : resumen;

  async function ejecutar(nombre, fn, mensaje) {
    setAccion(nombre);
    setErrorAccion(null);
    try {
      const res = await fn();
      setConfirmando(null);
      setMotivo('');
      const extra = nombre === 'resolver' && res?.correos_notificados
        ? ` Se notificó a ${res.correos_notificados.length} ciudadano(s).` : '';
      onCambio(`${mensaje}${extra}`);
      setVersion((v) => v + 1);
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setAccion(null);
    }
  }

  const ocupado = accion !== null;
  const reportes = detalle.id === id && detalle.data ? detalle.data.reportes : [];
  const correos = reportes.filter((r) => r.email).length;

  return (
    <div className="incident-panel" role="dialog" aria-label="Detalle del reporte">
      <div className="panel-header">
        <div className="header-tags">
          <span className="tag-folio">FOLIO #{folio(id)}</span>
          {d && (
            <span className={`tag-prioridad tag-${nivelPrioridad(d.prioridad)}`}>
              {ETIQUETA_PRIORIDAD[nivelPrioridad(d.prioridad)]}
            </span>
          )}
        </div>
        <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar detalle">✕</button>
      </div>

      <div className="panel-content">
        {detalle.error && <div className="alert alert-danger" role="alert">{detalle.error}</div>}

        {d ? (
          <>
            <div className="incident-category">{d.estado.replace('_', ' ')}</div>
            <h2 className="incident-title">{d.categoria_nombre}</h2>

            <Foto key={d.foto_principal} url={d.foto_principal} alt={`Foto del reporte: ${d.categoria_nombre}`} />

            <div className="info-box">
              <div className="info-grid">
                <div>
                  <div className="info-label">Coordenadas GPS</div>
                  <div className="info-value">{coordenadas(d)}</div>
                </div>
                <div>
                  <div className="info-label">Fecha y hora</div>
                  <div className="info-value">{fechaHora(d.created_at)}</div>
                </div>
              </div>
              {d.direccion && <div className="info-direccion">{d.direccion}</div>}
            </div>

            <div className="info-box">
              <div className="workflow-header">
                <span>Estado de atención</span>
              </div>
              {d.estado === 'rechazada' ? (
                <div className="alert alert-danger mb-0">
                  <strong>Rechazada.</strong> {d.motivo_rechazo || 'Sin motivo indicado.'}
                </div>
              ) : (
                <div className="workflow-steps">
                  {PASOS.map((p, i) => {
                    const clase = claseDePaso(i, d.estado);
                    return (
                      <div key={p.clave} className={`step ${clase}`}>
                        <div className="step-icon">{clase === 'done' ? '✓' : i + 1}</div>
                        <div className="step-label">{p.etiqueta}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {d.atendida_at && <div className="info-direccion">Atendida: {fechaHora(d.atendida_at)}</div>}
            </div>

            <div className="info-box">
              <div className="workflow-header">
                <span>Impacto ciudadano</span>
              </div>
              <div className="impact-stats">
                <div className="stat-item">
                  <div className="stat-number">{d.reportes_count}</div>
                  <div className="stat-label">{d.reportes_count === 1 ? 'Reporte' : 'Reportes agrupados'}</div>
                </div>
              </div>

              <div className="lista-reportes">
                <div className="workflow-header">
                  <span>Ciudadanos vinculados</span>
                  <span className="texto-suave">{cargando ? 'Cargando…' : `${correos} con correo`}</span>
                </div>
                {reportes.map((r, i) => (
                  <div key={r.id} className="email-item reporte-item">
                    <div>
                      <strong>{r.nombre_ciudadano || 'Sin nombre'}</strong>
                      <div className="texto-suave">{r.email || 'Sin correo'}</div>
                      {r.descripcion && <div className="reporte-desc">{r.descripcion}</div>}
                      {r.foto_url && (
                        <a href={r.foto_url} target="_blank" rel="noreferrer" className="texto-suave">Ver foto</a>
                      )}
                    </div>
                    <span className="email-role">{i === 0 ? 'Primer reporte' : 'Coincidente'} · {hora(r.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          !detalle.error && <p className="texto-suave">Cargando detalle…</p>
        )}
      </div>

      {d && (
        <div className="panel-footer">
          {errorAccion && <div className="alert alert-danger mb-0" role="alert">{errorAccion}</div>}

          {confirmando === 'resolver' && (
            <div className="alert alert-warning mb-0" role="alert">
              ¿Marcar como atendida? Se avisará por correo a {correos} ciudadano(s).
              <div className="footer-botones">
                <button type="button" className="btn btn-primary" disabled={ocupado}
                  onClick={() => ejecutar('resolver', () => resolver(id), 'Reporte marcado como atendido.')}>
                  {accion === 'resolver' ? 'Guardando…' : 'Confirmar'}
                </button>
                <button type="button" className="btn btn-outline-secondary" disabled={ocupado} onClick={() => setConfirmando(null)}>Cancelar</button>
              </div>
            </div>
          )}

          {confirmando === 'rechazar' && (
            <div className="alert alert-warning mb-0">
              <label className="form-label" htmlFor="motivo">Motivo del rechazo (opcional)</label>
              <textarea id="motivo" className="form-control" rows={2} maxLength={200}
                value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <div className="footer-botones">
                <button type="button" className="btn btn-primary" disabled={ocupado}
                  onClick={() => ejecutar('rechazar', () => rechazar(id, motivo), 'Reporte rechazado.')}>
                  {accion === 'rechazar' ? 'Guardando…' : 'Confirmar rechazo'}
                </button>
                <button type="button" className="btn btn-outline-secondary" disabled={ocupado} onClick={() => setConfirmando(null)}>Cancelar</button>
              </div>
            </div>
          )}

          {!confirmando && (d.estado === 'pendiente' || d.estado === 'en_proceso') && (
            <>
              {d.estado === 'pendiente' && (
                <button type="button" className="btn btn-outline-secondary" disabled={ocupado}
                  onClick={() => ejecutar('proceso', () => marcarEnProceso(id), 'Reporte marcado en proceso.')}>
                  {accion === 'proceso' ? 'Guardando…' : 'Marcar en proceso'}
                </button>
              )}
              <div className="footer-botones">
                <button type="button" className="btn btn-primary" disabled={ocupado} onClick={() => setConfirmando('resolver')}>
                  Resolver
                </button>
                <button type="button" className="btn btn-outline-danger" disabled={ocupado} onClick={() => setConfirmando('rechazar')}>
                  Rechazar
                </button>
              </div>
            </>
          )}

          {!confirmando && d.estado === 'rechazada' && (
            <button type="button" className="btn btn-primary" disabled={ocupado}
              onClick={() => ejecutar('restaurar', () => restaurar(id), 'Reporte restaurado a pendiente.')}>
              {accion === 'restaurar' ? 'Guardando…' : 'Restaurar como pendiente'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
