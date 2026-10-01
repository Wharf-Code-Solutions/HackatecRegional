import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Source } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './Dashboard.css';
import { LIMITES_MEXICO, ZOOM_MINIMO } from '../lib/mexico';
import IncidentDetails from './IncidentDetails';
import Toast from './Toast';
import { getIncidencias, hace, folio, nivelPrioridad, coordenadas, textoColonia } from '../lib/api';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const REFRESCO_MS = 30000;

// Mapa de calor: la intensidad de una zona crece con el número de reportes de sus incidencias
const CAPA_CALOR = {
  id: 'calor',
  type: 'heatmap',
  paint: {
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'peso'], 1, 0.35, 5, 0.8, 10, 1],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 15, 2],
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0, 'rgba(188,149,92,0)', 0.2, 'rgba(221,201,163,0.55)', 0.5, 'rgba(188,149,92,0.8)',
      0.8, 'rgba(157,36,73,0.85)', 1, 'rgba(97,18,50,0.95)',
    ],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 18, 13, 38, 16, 70],
    'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 17, 0.3], // se desvanece al acercarse para ver los pines
  },
};

const PESTANAS = [
  { id: 'activas', etiqueta: 'Activas', estado: undefined },
  { id: 'atendida', etiqueta: 'Atendidas', estado: 'atendida' },
  { id: 'rechazada', etiqueta: 'Rechazadas', estado: 'rechazada' },
];

export default function Dashboard() {
  const mapRef = useRef(null);
  const [pestana, setPestana] = useState('activas');
  const [filtro, setFiltro] = useState('todos'); // todos | urgentes | slug de categoría
  const [vista, setVista] = useState('lista'); // lista | mapa (solo en pantallas chicas)
  const [seleccionId, setSeleccionId] = useState(null);
  const [tick, setTick] = useState(0);
  const [aviso, setAviso] = useState(null); // { tipo, texto }
  const [calor, setCalor] = useState(true);

  // Resultado asociado a la pestaña que lo pidió: "cargando" = aún no llega el de la pestaña actual
  const [datos, setDatos] = useState({ pestana: null, items: [], error: null });
  const cargando = datos.pestana !== pestana;

  useEffect(() => {
    let vigente = true;
    const estado = PESTANAS.find((p) => p.id === pestana).estado;
    getIncidencias(estado)
      .then((items) => vigente && setDatos({ pestana, items, error: null }))
      .catch((e) => vigente && setDatos({ pestana, items: [], error: e.message }));
    return () => { vigente = false; };
  }, [pestana, tick]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), REFRESCO_MS);
    return () => clearInterval(t);
  }, []);

  // El mapa estaba oculto (display:none) en la vista Lista: hay que recalcular su tamaño
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 50);
    return () => clearTimeout(t);
  }, [vista]);

  const items = datos.items;

  const categorias = useMemo(() => {
    const mapa = {};
    items.forEach((i) => {
      mapa[i.categoria] ??= { slug: i.categoria, nombre: i.categoria_nombre, cantidad: 0 };
      mapa[i.categoria].cantidad += 1;
    });
    return Object.values(mapa).sort((a, b) => b.cantidad - a.cantidad);
  }, [items]);

  const urgentes = items.filter((i) => nivelPrioridad(i.prioridad) === 'alta').length;

  const visibles = items.filter((i) => {
    if (filtro === 'todos') return true;
    if (filtro === 'urgentes') return nivelPrioridad(i.prioridad) === 'alta';
    return i.categoria === filtro;
  });

  function cambiarPestana(id) {
    setPestana(id);
    setFiltro('todos');
    setSeleccionId(null);
  }

  function seleccionar(incidencia) {
    setSeleccionId(incidencia.id);
    mapRef.current?.flyTo({ center: [incidencia.lon, incidencia.lat], zoom: 16, duration: 800 });
  }

  function alCambiar(texto, tipo = 'success') {
    setAviso({ tipo, texto });
    setTick((n) => n + 1);
  }

  // Cada incidencia pesa por su número de reportes
  const geojsonCalor = useMemo(() => ({
    type: 'FeatureCollection',
    features: visibles.map((i) => ({
      type: 'Feature',
      properties: { peso: i.reportes_count },
      geometry: { type: 'Point', coordinates: [i.lon, i.lat] },
    })),
  }), [visibles]);

  const seleccionado = items.find((i) => i.id === seleccionId) ?? null;

  return (
    <div className="dashboard-container">
      <div className="dashboard-vista" role="tablist" aria-label="Vista">
        <button type="button" role="tab" aria-selected={vista === 'lista'}
          className={vista === 'lista' ? 'activa' : ''} onClick={() => setVista('lista')}>Lista</button>
        <button type="button" role="tab" aria-selected={vista === 'mapa'}
          className={vista === 'mapa' ? 'activa' : ''} onClick={() => setVista('mapa')}>Mapa</button>
      </div>

      {/* PANEL LATERAL */}
      <aside className={`dashboard-sidebar${vista === 'mapa' ? ' oculto-movil' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-titulo">
            <div>
              <h2>Reportes ciudadanos</h2>
              <p>Incidencias registradas en la plataforma</p>
            </div>
            <div className="badge-total">{items.length} {pestana === 'activas' ? 'activas' : 'en esta lista'}</div>
          </div>

          <div className="pestanas" role="tablist">
            {PESTANAS.map((p) => (
              <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id}
                className={pestana === p.id ? 'activa' : ''} onClick={() => cambiarPestana(p.id)}>
                {p.etiqueta}
              </button>
            ))}
          </div>

        </div>

        <div className="sidebar-filters">
          <button type="button" className={`filter-chip${filtro === 'todos' ? ' active' : ''}`}
            onClick={() => setFiltro('todos')}>Todos ({items.length})</button>
          <button type="button" className={`filter-chip${filtro === 'urgentes' ? ' active' : ''}`}
            onClick={() => setFiltro('urgentes')}>Urgentes ({urgentes})</button>
          {categorias.map((c) => (
            <button key={c.slug} type="button" className={`filter-chip${filtro === c.slug ? ' active' : ''}`}
              onClick={() => setFiltro(c.slug)}>{c.nombre}</button>
          ))}
          <button type="button" className="filter-chip filter-actualizar" onClick={() => setTick((n) => n + 1)}>
            Actualizar
          </button>
        </div>

        <div className="sidebar-list">
          {cargando ? (
            <p className="lista-vacia">Cargando reportes…</p>
          ) : datos.error ? (
            <div className="alert alert-danger" role="alert">
              {datos.error}{' '}
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setTick((n) => n + 1)}>
                Reintentar
              </button>
            </div>
          ) : visibles.length === 0 ? (
            <p className="lista-vacia">No hay reportes en esta lista.</p>
          ) : (
            visibles.map((r) => {
              const nivel = nivelPrioridad(r.prioridad);
              return (
                <div key={r.id} className={`report-card prioridad-${nivel}${r.id === seleccionId ? ' seleccionada' : ''}`}>
                  <div className="card-header">
                    <h3>
                      <span className={`punto punto-${nivel}`}>●</span>
                      {r.categoria_nombre}
                    </h3>
                    <span className="card-time">{hace(r.created_at)}</span>
                  </div>
                  <div className="card-location">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <div className="card-location__texto">
                      <span className="card-colonia" title={textoColonia(r)}>{textoColonia(r)}</span>
                      <span className="card-direccion" title={r.direccion || coordenadas(r)}>{r.direccion || coordenadas(r)}</span>
                    </div>
                  </div>
                  <div className="card-footer">
                    <span className={r.reportes_count > 1 ? 'tag-agrupado' : 'tag-normal'}>
                      {r.reportes_count > 1 ? `Agrupado: ${r.reportes_count} reportes` : '1 reporte'}
                      {r.estado === 'en_proceso' ? ' · En proceso' : ''}
                    </span>
                    <div className="card-actions">
                      <span className="card-id">#{folio(r.id)}</span>
                      <button type="button" className="btn-asignar" onClick={() => seleccionar(r)}>Ver</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ÁREA DEL MAPA */}
      <section className={`dashboard-map-area${vista === 'lista' ? ' oculto-movil' : ''}`}>
        <Map
          ref={mapRef}
          initialViewState={{ longitude: -96.1342, latitude: 19.1734, zoom: 13 }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={MAPBOX_TOKEN}
          maxBounds={LIMITES_MEXICO}
          minZoom={ZOOM_MINIMO}
          style={{ width: '100%', height: '100%' }}
        >
          {calor && (
            <Source id="reportes-calor" type="geojson" data={geojsonCalor}>
              <Layer {...CAPA_CALOR} />
            </Source>
          )}
          {visibles.map((r) => (
            <Marker key={r.id} longitude={r.lon} latitude={r.lat} anchor="bottom">
              <button type="button" aria-label={`${r.categoria_nombre}, prioridad ${r.prioridad}`}
                className={`marcador marcador-${nivelPrioridad(r.prioridad)}${r.id === seleccionId ? ' seleccionado' : ''}`}
                onClick={() => seleccionar(r)} />
            </Marker>
          ))}
        </Map>

        <div className="mapa-controles">
          <button type="button" className={`btn-calor${calor ? ' activo' : ''}`} aria-pressed={calor}
            onClick={() => setCalor((v) => !v)}>
            Mapa de calor
          </button>
        </div>
        {calor && (
          <div className="leyenda-calor" aria-label="Leyenda del mapa de calor">
            <span>Menos reportes</span>
            <i className="leyenda-calor__barra" />
            <span>Más reportes</span>
          </div>
        )}
      </section>

      <Toast aviso={aviso} onClose={() => setAviso(null)} />

      {seleccionId && (
        <IncidentDetails
          id={seleccionId}
          resumen={seleccionado}
          onClose={() => setSeleccionId(null)}
          onCambio={alCambiar}
        />
      )}
    </div>
  );
}
