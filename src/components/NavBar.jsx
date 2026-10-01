// src/components/shared/NavBar.jsx
import { Link, useLocation } from 'react-router-dom';
import './NavBar.css';

// Renderizado condicional: cada módulo muestra solo el enlace que le corresponde
function enlacesPara(ruta) {
  if (ruta.startsWith('/admin/dashboard')) {
    return [{ to: '/admin', texto: 'Incidencias', title: 'Volver al panel de incidencias' }];
  }
  if (ruta.startsWith('/admin')) {
    return [{ to: '/admin/dashboard', texto: 'Dashboard', title: 'Dashboard de información' }];
  }
  if (ruta.startsWith('/rastreo')) {
    return [{ to: '/', texto: 'Reportar un problema', title: 'Ir al mapa para hacer un reporte' }];
  }
  if (ruta.startsWith('/terminos')) {
    return [{ to: '/', texto: 'Reportar un problema', title: 'Ir al mapa para hacer un reporte' }];
  }
  // Módulo ciudadano de reportes
  return [
    { to: '/rastreo', texto: 'Rastreo de Reportes', title: 'Consulta el estado de tu reporte' },
    { to: '/terminos', texto: 'Términos', title: 'Términos y condiciones de uso' },
  ];
}

export default function NavBar() {
  const { pathname } = useLocation();
  const enlaces = enlacesPara(pathname);

  return (
    <header className="navbar-gob">
      <div className="navbar-izq">
        <img
          src="https://framework-gb.cdn.gob.mx/landing/img/logoheader.svg"
          alt="Gobierno de México"
          className="navbar-logo"
        />
        <div className="navbar-divisor"></div>
        <span className="navbar-titulo">
          SIGRIV
        </span>
      </div>

      <nav className="navbar-links" aria-label="Navegación principal">
        {enlaces.map((e) => (
          <Link key={e.to} to={e.to} title={e.title}>
            {e.texto}
          </Link>
        ))}
      </nav>
    </header>
  );
}
