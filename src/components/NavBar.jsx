// src/components/shared/NavBar.jsx
import { Link } from 'react-router-dom';
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

      <nav className="navbar-links">
        <Link to="/admin" title="Acceso para funcionarios">
          Panel Funcionario
        </Link>
        <Link to="/rastreo" title="Consulta el estado de tu reporte">
          Rastreo de Reportes
        </Link>
      </nav>
    </header>
  );
}