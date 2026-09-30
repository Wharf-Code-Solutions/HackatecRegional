import { useState } from 'react';
import './App.css'
import NavBar from './components/NavBar';
import MapView from './components/MapView';

export default function App() {
  // 1. Los estados siempre van adentro del componente
  const [ubicacionReporte, setUbicacionReporte] = useState(null);

  // 2. Esta función también va ADENTRO, antes del return
  const handleLocationChange = (coords) => {
    setUbicacionReporte(coords);
    console.log("El ciudadano movió el pin a:", coords);
  };

  // 3. El return dibuja la interfaz
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <NavBar />

      <main style={{ marginTop: '60px', height: 'calc(100vh - 60px)', position: 'relative' }}>
        <MapView onLocationChange={handleLocationChange} />
      </main>
    </div>
  );
}