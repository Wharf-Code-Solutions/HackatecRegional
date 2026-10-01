import { useEffect, useState } from 'react';
import { getEstadisticas } from '../lib/api';
import './DashboardInfo.css';

const REFRESCO_MS = 30000;

const RANGOS = [
  { id: '7', etiqueta: '7 días', dias: 7 },
  { id: '30', etiqueta: '30 días', dias: 30 },
  { id: '90', etiqueta: '90 días', dias: 90 },
  { id: 'todo', etiqueta: 'Todo', dias: null },
];

const ESTADOS = [
  { id: 'pendiente', etiqueta: 'Pendientes', color: '#BC955C' },
  { id: 'en_proceso', etiqueta: 'En proceso', color: '#2F6F9F' },
  { id: 'atendida', etiqueta: 'Atendidas', color: '#13322E' },
  { id: 'rechazada', etiqueta: 'Rechazadas', color: '#9D2449' },
];

function Dona({ kpis }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  let acumulado = 0;
  return (
    <svg viewBox="0 0 140 140" className="dashinfo__dona" role="img" aria-label="Distribución por estado">
      <circle cx="70" cy="70" r={R} fill="none" stroke="#eee" strokeWidth="20" />
      {kpis.total > 0 &&
        ESTADOS.map((e) => {
          const largo = (kpis[e.id] / kpis.total) * C;
          const el = (
            <circle
              key={e.id}
              cx="70" cy="70" r={R} fill="none" stroke={e.color} strokeWidth="20"
              strokeDasharray={`${largo} ${C - largo}`}
              strokeDashoffset={-acumulado}
              transform="rotate(-90 70 70)"
            />
          );
          acumulado += largo;
          return el;
        })}
      <text x="70" y="68" textAnchor="middle" className="dashinfo__dona-num">{kpis.total}</text>
      <text x="70" y="86" textAnchor="middle" className="dashinfo__dona-txt">incidencias</text>
    </svg>
  );
}

function Barras({ filas, etiqueta, sub, color }) {
  const max = Math.max(1, ...filas.map((f) => f.total));
  if (!filas.length) return <p className="dashinfo__vacio">Sin datos en este periodo</p>;
  return (
    <ul className="dashinfo__barras">
      {filas.map((f, i) => (
        <li key={i}>
          <div className="dashinfo__barra-info">
            <span className="dashinfo__barra-nombre">
              {etiqueta(f)}
              {sub && sub(f) && <small> · {sub(f)}</small>}
            </span>
            <strong>{f.total}</strong>
          </div>
          <div className="dashinfo__pista">
            <span style={{ width: `${(f.total / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardInfo() {
  const [rango, setRango] = useState('30');
  const [municipio, setMunicipio] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tick, setTick] = useState(0);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [categorias, setCategorias] = useState([]); // se conservan aunque se filtre por una

  useEffect(() => {
    let vigente = true;
    const dias = RANGOS.find((r) => r.id === rango).dias;
    const desde = dias ? new Date(Date.now() - dias * 86400000).toISOString() : undefined;
    getEstadisticas({ desde, municipio, categoria })
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        setError(null);
        if (!categoria) setCategorias(d.por_categoria.map((c) => ({ slug: c.slug, nombre: c.nombre })));
      })
      .catch((e) => vigente && setError(e.message));
    return () => { vigente = false; };
  }, [rango, municipio, categoria, tick]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), REFRESCO_MS);
    return () => clearInterval(t);
  }, []);

  const k = datos?.kpis;
  const tarjetas = k && [
    { etiqueta: 'Incidencias', valor: k.total },
    { etiqueta: 'Urgentes activas', valor: k.urgentes, alerta: k.urgentes > 0 },
    { etiqueta: 'Reportes ciudadanos', valor: k.reportes_totales },
    { etiqueta: '% resueltas', valor: `${k.porcentaje_resolucion}%` },
    {
      etiqueta: 'Tiempo prom. atención',
      valor: k.tiempo_promedio_horas == null ? '—' : k.tiempo_promedio_horas >= 48
        ? `${(k.tiempo_promedio_horas / 24).toFixed(1)} d` : `${k.tiempo_promedio_horas} h`,
    },
  ];

  return (
    <section className="dashinfo">
      <div className="dashinfo__contenido">
        <header className="dashinfo__cabecera">
          <h2>Estadísticas de reportes</h2>
          <div className="dashinfo__filtros">
            <div className="dashinfo__rangos" role="group" aria-label="Periodo">
              {RANGOS.map((r) => (
                <button
                  key={r.id} type="button"
                  className={rango === r.id ? 'activo' : ''}
                  onClick={() => setRango(r.id)}
                >{r.etiqueta}</button>
              ))}
            </div>
            <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} aria-label="Municipio">
              <option value="">Todos los municipios</option>
              {(datos?.municipios || []).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {categorias.map((c) => <option key={c.slug} value={c.slug}>{c.nombre}</option>)}
            </select>
          </div>
        </header>

        {error && <p className="dashinfo__error" role="alert">{error}</p>}
        {!datos && !error && <p className="dashinfo__vacio">Cargando…</p>}

        {datos && (
          <>
            <div className="dashinfo__kpis">
              {tarjetas.map((t) => (
                <div key={t.etiqueta} className={`dashinfo__kpi${t.alerta ? ' dashinfo__kpi--alerta' : ''}`}>
                  <strong>{t.valor}</strong>
                  <span>{t.etiqueta}</span>
                </div>
              ))}
            </div>

            <div className="dashinfo__rejilla">
              <article className="dashinfo__panel">
                <h3>Por estado</h3>
                <div className="dashinfo__estado">
                  <Dona kpis={k} />
                  <ul className="dashinfo__leyenda">
                    {ESTADOS.map((e) => (
                      <li key={e.id}>
                        <i style={{ background: e.color }} />
                        {e.etiqueta} <strong>{k[e.id]}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="dashinfo__panel">
                <h3>Por tipo de problema</h3>
                <Barras
                  filas={datos.por_categoria}
                  etiqueta={(f) => f.nombre}
                  sub={(f) => `${f.activas} activas`}
                  color="#9D2449"
                />
              </article>

              <article className="dashinfo__panel dashinfo__panel--ancho">
                <h3>Colonias con más incidencias</h3>
                <Barras
                  filas={datos.por_colonia}
                  etiqueta={(f) => f.colonia}
                  sub={(f) => f.municipio}
                  color="#BC955C"
                />
              </article>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
