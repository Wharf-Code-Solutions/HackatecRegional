import { useState, useRef } from 'react';
import Map from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapView.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView({ onLocationChange, onGenerarReporte }) {
  const mapRef = useRef();
  
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

  // NUEVA FUNCIÓN: Leer GPS nativo del celular/PC
  const handleUbicarme = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        // Movemos el mapa a donde está parado el usuario con un zoom más cercano (16)
        setViewState({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
          zoom: 16
        });
      }, () => {
        alert("Por favor, permite el acceso a tu ubicación en tu navegador para usar esta función.");
      });
    } else {
      alert("Tu dispositivo no soporta geolocalización.");
    }
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
        style={{ width: '100%', height: '100%' }}
      />

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
      <button className="btn-ubicarme" onClick={handleUbicarme}>
        {/* Ícono de Mira/Ubicación en color Guinda oficial */}
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
        Ubicarme
      </button>

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