import React from 'react';
import './IncidentDetails.css';

export default function IncidentDetails({ reporte, onClose }) {
  if (!reporte) return null;

  return (
    <div className="incident-panel">
      
      {/* 1. Cabecera */}
      <div className="panel-header">
        <div className="header-tags">
          <span className="tag-folio">FOLIO #{reporte.id || '045'}</span>
          <span className="tag-prioridad">
            <span style={{fontSize: '10px'}}>●</span> PRIORIDAD CRÍTICA
          </span>
        </div>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>

      {/* 2. Contenido Scrolleable */}
      <div className="panel-content">
        <div className="incident-category">⚠️ Infraestructura Vial {'>'} Daño Estructural</div>
        <h2 className="incident-title">{reporte.titulo || 'Bache Profundo con Afectación a Dos Carriles'}</h2>
        
        <img 
          src="https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=400" 
          alt="Bache" 
          className="incident-image"
        />

        {/* Cuadrícula de Info: Coordenadas restauradas, dirección simplificada a Colonia */}
        <div className="info-box">
          <div className="info-grid">
            <div>
              <div className="info-label">Coordenadas GPS</div>
              <div className="info-value">19.4326° N, 99.1332° W</div>
            </div>
            <div>
              <div className="info-label">Fecha y Hora</div>
              <div className="info-value">Hoy, 14:32 hrs (-18 min)</div>
            </div>
          </div>
          <div style={{fontSize: '13px', color: '#555', marginTop: '8px'}}>
            📍 Col. Centro
          </div>
          <span className="gps-badge">● GPS Verificado</span>
        </div>

        {/* Workflow de Resolución */}
        <div className="info-box">
          <div className="workflow-header">
            <span>Workflow de Resolución</span>
            <span style={{color: '#888'}}>Paso 2 de 4</span>
          </div>
          
          <div className="workflow-steps">
            <div className="step done">
              <div className="step-icon">✓</div>
              <div className="step-label">Recepción</div>
              <div className="step-time">14:32</div>
            </div>
            <div className="step active">
              <div className="step-icon">📋</div>
              <div className="step-label" style={{color: 'var(--gob-guinda)'}}>Triage</div>
              <div className="step-time">En revisión</div>
            </div>
            <div className="step pending">
              <div className="step-icon">🚚</div>
              <div className="step-label">Despacho</div>
              <div className="step-time">Pendiente</div>
            </div>
            <div className="step pending">
              <div className="step-icon">🔒</div>
              <div className="step-label">Cierre</div>
              <div className="step-time">Pendiente</div>
            </div>
          </div>

          <div className="workflow-assign">
            <span>👷‍♂️ Cuadrilla Asignada: <b>Pendiente de asignación</b></span>
          </div>
        </div>

        {/* Impacto Ciudadano (Simplificado a 1 solo dato) y Correos */}
        <div className="info-box">
          <div className="workflow-header">
            <span>Impacto Ciudadano</span>
            <span className="tag-folio">Cluster #C-18</span>
          </div>
          
          <div className="impact-stats" style={{ gridTemplateColumns: '1fr' }}>
            <div className="stat-item" style={{ borderRight: 'none' }}>
              <div className="stat-number">4</div>
              <div className="stat-label">Incidencias<br/>Agrupadas</div>
            </div>
          </div>

          {/* LISTA DE CORREOS */}
          <div style={{ marginTop: '24px', borderTop: '1px solid #EEE', paddingTop: '16px' }}>
            <div className="workflow-header" style={{ marginBottom: '8px' }}>
              <span>Ciudadanos vinculados a esta resolución:</span>
              <span style={{color: '#888', textTransform: 'none'}}>Notificación Email</span>
            </div>
            <div className="email-list">
              <div className="email-item">
                <span>ju***@gmail.com</span>
                <span className="email-role">Reportante primario • 14:32</span>
              </div>
              <div className="email-item">
                <span>ma***@hotmail.com</span>
                <span className="email-role">Reporte coincidente • 14:37</span>
              </div>
              <div className="email-item">
                <span>ro***@gmail.com</span>
                <span className="email-role">Reporte coincidente • 14:44</span>
              </div>
              <div className="email-item">
                <span>ca***@outlook.com</span>
                <span className="email-role">Reporte coincidente • 14:48</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Footer de Acciones Fijo */}
      <div className="panel-footer">
        <button className="btn-primary-dark">
          Avanzar a Despacho ➔
        </button>
      </div>

    </div>
  );
}