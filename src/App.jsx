import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'
import NavBar from './components/NavBar';

// Tras un nuevo despliegue, una pestaña con la versión anterior pide archivos con nombres que ya no existen y la
// ruta se queda en "Cargando…". Si falla la descarga, se recarga la página una vez para tomar la versión nueva.
const CLAVE_RECARGA = 'recarga_por_actualizacion';
function lazyRuta(importar) {
  return lazy(() =>
    importar().then(
      (modulo) => {
        try { sessionStorage.removeItem(CLAVE_RECARGA); } catch { /* sin almacenamiento: no pasa nada */ }
        return modulo;
      },
      (error) => {
        try {
          if (!sessionStorage.getItem(CLAVE_RECARGA)) {
            sessionStorage.setItem(CLAVE_RECARGA, '1');
            window.location.reload();
            return new Promise(() => {}); // la página se recarga: no hay nada que pintar
          }
        } catch { /* sin almacenamiento: se muestra el error */ }
        throw error;
      },
    ),
  );
}

// Carga diferida por ruta: el mapa (mapbox-gl pesa ~1.8 MB) ya no frena el primer pintado
const CiudadanoPage = lazyRuta(() => import('./components/CiudadanoPage'));
const Dashboard = lazyRuta(() => import('./components/Dashboard'));
const DashboardInfo = lazyRuta(() => import('./components/DashboardInfo'));
const Rastreo = lazyRuta(() => import('./components/Rastreo'));
const Terminos = lazyRuta(() => import('./components/Terminos'));

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

              {/* Términos y condiciones (consulta) */}
              <Route path="/terminos" element={<Terminos />} />

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
