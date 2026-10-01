import { useState } from 'react';
import './Rastreo.css';

export default function Rastreo() {
  const [folioInput, setFolioInput] = useState('');
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // Función SIMULADA solo para diseño (sin llamadas reales al servidor)
  const handleBuscar = () => {
    // Limpiamos espacios y quitamos el # si el usuario lo puso
    const folioLimpio = folioInput.trim().replace('#', '');
    if (!folioLimpio) return;

    setCargando(true);
    setError(null);
    setResultado(null);

    // Simulamos el tiempo de carga del servidor (500ms)
    setTimeout(() => {
      setCargando(false);
      
      // Mapeamos datos estáticos de prueba (Mock) para ver el diseño
      setResultado({
        folio: `123e4567-e89b-12d3-a456-${folioLimpio.substring(0, 12).padEnd(12, '0')}`, // Simulamos un UUID
        fecha: new Date().toISOString(),
        titulo: 'Bache Profundo en Vía Principal',
        ubicacion: 'Col. Centro, Calle 5 de Mayo esq. Av. Hidalgo',
        estado: 'EN PROCESO — Revisión',
        impactoCiudadanos: 4
      });
    }, 500);
  };

  return (
    <div className="rastreo-wrapper">
      
      <div className="rastreo-header">
        <h1>📄 Consulta de Folios</h1>
        <p>Conoce el estado y avance de tu reporte ciudadano en tiempo real ante las cuadrillas municipales.</p>
      </div>

      {/* CAJA DE BÚSQUEDA */}
      <div className="search-box">
        <label className="search-label">Número de Folio Oficial (UUID)</label>
        <div className="search-input-group">
          <input 
            type="text" 
            className="search-input" 
            placeholder="Ej. 123e4567-e89b-12d3-a456-426614174000"
            value={folioInput}
            onChange={(e) => setFolioInput(e.target.value)}
            disabled={cargando}
          />
          <button className="btn-buscar" onClick={handleBuscar} disabled={cargando}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            {cargando ? 'Buscando...' : 'Buscar Folio'}
          </button>
        </div>
        {error && <p style={{ color: 'var(--gob-guinda)', fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>{error}</p>}
      </div>

      {/* RESULTADO DE LA BÚSQUEDA */}
      {resultado && (
        <div className="result-card">
          <div className="result-header">
            <div className="result-folio-row">
              <span className="tag-folio-dark">FOLIO COMPROBADO</span>
              <span className="result-date">🕒 {new Date(resultado.fecha).toLocaleString()}</span>
            </div>
            <h2 className="result-title">{resultado.titulo}</h2>
            <div className="result-location">
              📍 {resultado.ubicacion}
            </div>
            <span className="status-badge">● {resultado.estado}</span>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
              ID UUID: {resultado.folio}
            </div>
          </div>

          <div className="timeline-section">
            <div className="timeline-title">
              📈 Línea de Avance Oficial
            </div>

            <div className="timeline">
              <div className="timeline-item completed">
                <div className="timeline-icon">✓</div>
                <div className="step-header">
                  <span className="step-title">1. Reporte recibido y verificado</span>
                </div>
                <div className="step-desc">
                  Registrado exitosamente en la base de datos del sistema municipal.
                </div>
              </div>

              <div className="timeline-item active">
                <div className="timeline-icon">📋</div>
                <div className="step-header">
                  <span className="step-title" style={{color: 'var(--gob-guinda)'}}>2. Triage y priorización</span>
                </div>
                <div className="step-highlight">
                  Fase actual: <strong>{resultado.estado}</strong>
                </div>
              </div>

              <div className="timeline-item pending">
                <div className="timeline-icon">🚚</div>
                <div className="step-header">
                  <span className="step-title">3. Cuadrilla despachada</span>
                  <span className="step-time">Pendiente</span>
                </div>
              </div>

              <div className="timeline-item pending">
                <div className="timeline-icon">🔒</div>
                <div className="step-header">
                  <span className="step-title">4. Reparación y cierre con evidencia</span>
                  <span className="step-time">Pendiente</span>
                </div>
              </div>
            </div>

            {/* Impacto / Resonancia */}
            <div className="community-impact">
              <div className="impact-icon">👥</div>
              <div className="impact-text">
                <h4>Resonancia Comunitaria</h4>
                <p><strong>{resultado.impactoCiudadanos} ciudadanos</strong> han reportado esta misma incidencia en la zona (Clúster activo).</p>
              </div>
            </div>
          </div>

          <div className="result-footer">
            <button className="btn-secondary" onClick={() => window.location.href='/'}>Volver al mapa</button>
            <button className="btn-secondary" onClick={() => {setResultado(null); setFolioInput('');}}>Buscar otro folio</button>
          </div>
        </div>
      )}

      <div className="disclaimer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        Centro Cívico garantiza trazabilidad pública e inalterable en todos los reportes emitidos.
      </div>

    </div>
  );
}