import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import MapView from './components/MapView';
import Dashboard from './components/Dashboard';

export default function App() {
  const [ubicacionReporte, setUbicacionReporte] = useState(null);

  const handleLocationChange = (coords) => {
    setUbicacionReporte(coords);
    console.log("El ciudadano movió el pin a:", coords);
  };

  return (
    <BrowserRouter>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <NavBar />

        <main style={{ marginTop: '60px', height: 'calc(100vh - 60px)', position: 'relative' }}>
          <Routes>
            {/* Ruta Principal: App Ciudadana */}
            <Route 
              path="/" 
              element={<MapView onLocationChange={handleLocationChange} />} 
            />
            
            {/* Ruta del Funcionario: Dashboard Admin */}
            <Route 
              path="/admin" 
              element={<Dashboard />} 
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}