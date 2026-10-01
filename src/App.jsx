import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'
import NavBar from './components/NavBar';
import CiudadanoPage from './components/CiudadanoPage';
import Dashboard from './components/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <NavBar />

        <main style={{ marginTop: '60px', height: 'calc(100vh - 60px)', position: 'relative' }}>
          <Routes>
            {/* Ruta Principal: App Ciudadana */}
            <Route path="/" element={<CiudadanoPage />} />

            {/* Ruta del Funcionario: Dashboard Admin */}
            <Route path="/admin" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
