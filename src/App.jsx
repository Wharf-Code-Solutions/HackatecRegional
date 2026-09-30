import { useState } from 'react';
import './App.css'
import NavBar from './components/NavBar';
import MapView from './components/MapView';
import ReportForm from './components/ReportForm';

export default function App() {
  // 1. Los estados siempre van adentro del componente
  const [ubicacionReporte, setUbicacionReporte] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  // 2. Esta función también va ADENTRO, antes del return
  const handleLocationChange = (coords) => {
    setUbicacionReporte(coords);
    console.log("El ciudadano movió el pin a:", coords);
  };

  // "Generar Reporte": toma las coordenadas actuales del pin y abre el formulario
  const handleGenerarReporte = (coords) => {
    setUbicacionReporte(coords);
    setMostrarForm(true);
  };

  // 3. El return dibuja la interfaz
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <NavBar />

      <main style={{ marginTop: '60px', height: 'calc(100vh - 60px)', position: 'relative' }}>
        <MapView
          onLocationChange={handleLocationChange}
          onGenerarReporte={handleGenerarReporte}
        />
      </main>

      {mostrarForm && (
        <ReportForm
          lat={ubicacionReporte?.lat}
          lon={ubicacionReporte?.lon}
          onClose={() => setMostrarForm(false)}
        />
      )}
    </div>
  );
}
