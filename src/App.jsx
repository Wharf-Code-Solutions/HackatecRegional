import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'
import NavBar from './components/NavBar';
<<<<<<< HEAD

// Carga diferida por ruta: el mapa (mapbox-gl pesa ~1.8 MB) ya no frena el primer pintado
const CiudadanoPage = lazy(() => import('./components/CiudadanoPage'));
const Dashboard = lazy(() => import('./components/Dashboard'));

function Cargando() {
  return (
    <div className="cargando-ruta" role="status">
      <div className="cargando-ruta__giro" />
      <span>Cargando…</span>
    </div>
  );
}
=======
import CiudadanoPage from './components/CiudadanoPage';
import Dashboard from './components/Dashboard';
import Rastreo from './components/Rastreo';
>>>>>>> origin/main

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <NavBar />

        <main style={{ marginTop: '60px', height: 'calc(100vh - 60px)', position: 'relative' }}>
          <Suspense fallback={<Cargando />}>
            <Routes>
              {/* Ruta Principal: App Ciudadana */}
              <Route path="/" element={<CiudadanoPage />} />

<<<<<<< HEAD
              {/* Ruta del Funcionario: Dashboard Admin */}
              <Route path="/admin" element={<Dashboard />} />
            </Routes>
          </Suspense>
=======
            {/* Ruta del Funcionario: Dashboard Admin */}
            <Route path="/admin" element={<Dashboard />} />

            {/* Ruta del ciudadano: Seguimiento de Reportes */}
            <Route path="/rastreo" element={<Rastreo />} />
            
          </Routes>
>>>>>>> origin/main
        </main>
      </div>
    </BrowserRouter>
  );
}
