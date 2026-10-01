import { useState, useEffect } from 'react';
import Map from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './Dashboard.css';
import IncidentDetails from './IncidentDetails'; // 1. Importamos el panel

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function Dashboard() {
  const [viewState, setViewState] = useState({
    longitude: -96.1342,
    latitude: 19.1734,
    zoom: 13
  });

  // 2. Estado para controlar qué panel está abierto
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);

  const [reportes, setReportes] = useState([
    { 
      id: '045', 
      titulo: 'Bache Profundo', 
      ubicacion: 'Col. Centro, Av. Hidalgo #402', 
      tiempo: 'Hace 12 min', 
      etiqueta: 'Agrupado: 4 reportes', 
      tipoEtiqueta: 'critico', 
      prioridad: 'alta' 
    }
  ]);

  const [estadisticas, setEstadisticas] = useState({
    totalActivas: 1,
    sectores: [
      { id: 1, nombre: 'Sector 01 - Centro', cantidad: 1, porcentaje: 100, tipo: 'critico' }
    ]
  });

  useEffect(() => {
    // Aquí irá el fetch a FastAPI en el futuro
  }, []);

  return (
    <div className="dashboard-container">
      
      {/* PANEL LATERAL IZQUIERDO */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2>Zonas Críticas</h2>
              <p>Saturación en tiempo real por cuadrante</p>
            </div>
            <div className="badge-total">{estadisticas.totalActivas} Incidencias activas</div>
          </div>

          {estadisticas.sectores.map(sector => (
            <div key={sector.id} className="sector-progress">
              <div className="sector-info">
                <span>{sector.nombre}</span>
                <span className={`porcentaje-${sector.tipo}`}>
                  {sector.cantidad} incidencias ({sector.porcentaje}%)
                </span>
              </div>
              <div className="progress-bar-bg">
                <div 
                  className={`progress-bar-fill fill-${sector.tipo}`} 
                  style={{ width: `${sector.porcentaje}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-filters">
          <button className="filter-chip active">Todos ({reportes.length})</button>
          <button className="filter-chip" style={{color: 'var(--gob-guinda)'}}>● Urgentes</button>
          <button className="filter-chip">Baches</button>
        </div>

        <div className="sidebar-list">
          {reportes.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>No hay reportes activos.</p>
          ) : (
            reportes.map(reporte => (
              <div key={reporte.id} className={`report-card prioridad-${reporte.prioridad}`}>
                <div className="card-header">
                  <h3>
                    <span style={{ color: reporte.prioridad === 'alta' ? 'var(--gob-guinda)' : 'var(--gob-dorado)' }}>●</span>
                    {reporte.titulo}
                  </h3>
                  <span className="card-time">{reporte.tiempo}</span>
                </div>
                <div className="card-location">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  {reporte.ubicacion}
                </div>
                <div className="card-footer">
                  <span className={reporte.tipoEtiqueta === 'critico' ? 'tag-agrupado' : 'tag-normal'}>
                    {reporte.etiqueta}
                  </span>
                  <div className="card-actions">
                    <span className="card-id">#{reporte.id}</span>
                    {/* 3. El botón ahora dice "Ver" y abre el panel */}
                    <button 
                      className="btn-asignar"
                      onClick={() => setReporteSeleccionado(reporte)}
                    >
                      Ver
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ÁREA DEL MAPA PRINCIPAL */}
      <main className="dashboard-map-area">
        <div className="map-toolbar-top">
          <div className="toolbar-panel">
            <span>🗺️ Plataforma Geospace Táctico</span>
            <span style={{color: '#666'}}>{Math.abs(viewState.latitude).toFixed(4)}°N {Math.abs(viewState.longitude).toFixed(4)}°W</span>
          </div>
        </div>

        <Map
          {...viewState}
          onMove={e => setViewState(e.viewState)}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
        />
        
        {/* 4. Renderizamos el panel deslizable sobre el mapa */}
        <IncidentDetails 
          reporte={reporteSeleccionado} 
          onClose={() => setReporteSeleccionado(null)} 
        />
      </main>

    </div>
  );
}