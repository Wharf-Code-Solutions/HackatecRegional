import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'
import NavBar from './components/NavBar';

// Carga diferida por ruta: el mapa (mapbox-gl pesa ~1.8 MB) ya no frena el primer pintado
const CiudadanoPage = lazy(() => import('./components/CiudadanoPage'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const DashboardInfo = lazy(() => import('./components/DashboardInfo'));
const Rastreo = lazy(() => import('./components/Rastreo'));

function Cargando() {
  return (
    <div className="cargando-ruta" role="status">
      <div className="cargando-ruta__giro" />
      <span>Cargando…</span>
    </div>
  );
}

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

              {/* Ruta del ciudadano: Seguimiento de Reportes */}
              <Route path="/rastreo" element={<Rastreo />} />

              {/* Rutas del Funcionario: panel de incidencias y dashboard de información */}
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/dashboard" element={<DashboardInfo />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}
