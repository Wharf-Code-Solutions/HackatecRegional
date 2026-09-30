// src/components/shared/NavBar.jsx
import './NavBar.css';

export default function NavBar() {
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
          Reportes Urbanos
        </span>
      </div>

      {/* Sección Derecha: Solo el rastreo ciudadano */}
      <nav className="navbar-links">
        <a href="/rastreo" title="Consulta el estado de tu reporte">
          Rastreo de Reportes
        </a>
      </nav>
    </header>
  );
}