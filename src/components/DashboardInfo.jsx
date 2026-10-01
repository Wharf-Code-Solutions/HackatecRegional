import { Link } from 'react-router-dom';
import './DashboardInfo.css';

// Página base del dashboard de información del funcionario (se llenará en una siguiente etapa)
export default function DashboardInfo() {
  return (
    <section className="dashinfo">
      <div className="dashinfo__tarjeta">
        <span className="dashinfo__etiqueta">Dashboard</span>
        <h2>Información y estadísticas</h2>
        <p>
          Aquí se concentrará el análisis de los reportes ciudadanos: zonas con más incidencias, tiempos de
          atención y avance por tipo de problema.
        </p>
        <p className="dashinfo__pronto">Próximamente</p>
        <Link to="/admin" className="btn btn-primary">Ir al panel de incidencias</Link>
      </div>
    </section>
  );
}
