import { useCallback, useState, useRef } from 'react';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapView.css';
import { LIMITES_MEXICO, ZOOM_MINIMO, dentroDeMexico } from '../lib/mexico';
import Toast from './Toast';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView({ onLocationChange, onGenerarReporte, incidencias = [], onSeleccionarIncidencia }) {
  const mapRef = useRef();
  const [ubicando, setUbicando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo, texto }
  const cerrarAviso = useCallback(() => setAviso(null), []);

  const [viewState, setViewState] = useState({
    longitude: -96.1342,
    latitude: 19.1734,
    zoom: 14
  });

  const handleMoveEnd = (e) => {
    setViewState(e.viewState);
    if (onLocationChange) {
      onLocationChange({
        lat: e.viewState.latitude,
        lon: e.viewState.longitude
      });
    }
  };

  const handleBotonClick = () => {
    console.log("¡Botón presionado! Coordenadas listas:", viewState.latitude, viewState.longitude);
    if (onGenerarReporte) {
      onGenerarReporte({ lat: viewState.latitude, lon: viewState.longitude });
    }
  };

  // GPS del dispositivo. Sin tiempo límite algunos navegadores esperan indefinidamente y el botón parece roto,
  // así que: indicador de carga, límite de espera y un segundo intento con la otra precisión.
  const handleUbicarme = () => {
    if (ubicando) return;
    if (!('geolocation' in navigator)) {
      setAviso({ tipo: 'danger', texto: 'Tu dispositivo no soporta geolocalización.' });
      return;
    }
    setAviso(null);
    setUbicando(true);

    const alExito = ({ coords }) => {
      setUbicando(false);
      if (!dentroDeMexico(coords.latitude, coords.longitude)) {
        setAviso({ tipo: 'danger', texto: 'Tu ubicación está fuera de México. Esta plataforma solo recibe reportes dentro del país.' });
        return;
      }
      // Movemos el mapa a donde está el usuario con un zoom más cercano (16)
      setViewState({ longitude: coords.longitude, latitude: coords.latitude, zoom: 16 });
    };

    const alFallar = (error) => {
      setUbicando(false);
      const texto = error.code === 1
        ? 'No tenemos permiso para ver tu ubicación. Actívalo en los ajustes del navegador y vuelve a intentarlo.'
        : error.code === 3
          ? 'Tu ubicación tardó demasiado en responder. Revisa que el GPS esté activo e inténtalo de nuevo.'
          : 'No pudimos obtener tu ubicación. Revisa que el GPS esté activo e inténtalo de nuevo.';
      setAviso({ tipo: 'danger', texto });
    };

    // 1.º ubicación aproximada (rápida, por red); si no responde, 2.º con GPS de alta precisión
    navigator.geolocation.getCurrentPosition(alExito, (error) => {
      if (error.code === 1) { alFallar(error); return; }
      navigator.geolocation.getCurrentPosition(alExito, alFallar, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  };

  return (
    <div className="map-container">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={e => setViewState(e.viewState)}
        onMoveEnd={handleMoveEnd}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
        maxBounds={LIMITES_MEXICO}
        minZoom={ZOOM_MINIMO}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Incidencias activas de otros ciudadanos (sin datos personales) */}
        {incidencias.map((inc, i) => (
          <Marker key={`${inc.lat},${inc.lon},${inc.categoria},${i}`} longitude={inc.lon} latitude={inc.lat} anchor="bottom">
            <button
              type="button"
              className={`pin-publico pin-publico-${inc.prioridad >= 7 ? 'alta' : inc.prioridad >= 4 ? 'media' : 'baja'}`}
              aria-label={`${inc.categoria_nombre}, ${inc.reportes_count} reporte(s)`}
              onClick={() => onSeleccionarIncidencia?.(inc)}
            />
          </Marker>
        ))}
      </Map>

      {/* Marcador Central Fijo */}
      <div className="map-marker-container">
        <div className="map-marker-tooltip">
          Ubica el problema aquí
        </div>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--gob-guinda)" stroke="var(--gob-dorado)" strokeWidth="1">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
        </svg>
      </div>

      {/* NUEVO: Botón Personalizado "Ubicarme" */}
      <button className="btn-ubicarme" onClick={handleUbicarme} disabled={ubicando} aria-busy={ubicando}>
        {ubicando ? <i className="btn-ubicarme__giro" aria-hidden="true" /> : (
        <svg 
          width="18" height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="var(--gob-guinda)" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19 12h2M3 12h2M12 19v2M12 3v2"></path>
        </svg>
        )}
        {ubicando ? 'Ubicando…' : 'Ubicarme'}
      </button>

      <Toast aviso={aviso} onClose={cerrarAviso} />

      {/* Botón de Generar Reporte */}
      <button className="btn-generar-reporte" onClick={handleBotonClick}>
        <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" style={{ marginRight: '8px' }}>
          <path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z"/>
        </svg>
        Generar Reporte
      </button>
    </div>
  );
}