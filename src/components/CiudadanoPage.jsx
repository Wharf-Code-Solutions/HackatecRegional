import { lazy, Suspense, useEffect, useState } from 'react';
import MapView from './MapView';
import BottomSheet from './BottomSheet';
import { getIncidenciasPublicas, nivelPrioridad } from '../lib/api';

// El formulario (y supabase-js) se descarga al abrirlo, no en la carga inicial
const ReportForm = lazy(() => import('./ReportForm'));

const REFRESCO_MS = 60000;
const ETIQUETA_ESTADO = { pendiente: 'Pendiente de atención', en_proceso: 'En proceso de atención' };
const ETIQUETA_PRIORIDAD = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' };

// Vista ciudadana: mapa con pin central + pines de incidencias activas + formulario de reporte
export default function CiudadanoPage() {
  const [ubicacionReporte, setUbicacionReporte] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [incidencias, setIncidencias] = useState([]);
  const [pinSeleccionado, setPinSeleccionado] = useState(null);
  const [tick, setTick] = useState(0);

  // Los pines son informativos: si falla la carga, el mapa sigue siendo usable
  useEffect(() => {
    let vigente = true;
    getIncidenciasPublicas()
      .then((datos) => vigente && setIncidencias(datos))
      .catch(() => {});
    return () => { vigente = false; };
  }, [tick]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), REFRESCO_MS);
    return () => clearInterval(t);
  }, []);

  const handleLocationChange = (coords) => {
    setUbicacionReporte(coords);
  };

  // "Generar Reporte": toma las coordenadas actuales del pin y abre el formulario
  const handleGenerarReporte = (coords) => {
    setUbicacionReporte(coords);
    setPinSeleccionado(null);
    setMostrarForm(true);
  };

  const nivel = pinSeleccionado ? nivelPrioridad(pinSeleccionado.prioridad) : null;

  return (
    <>
      <MapView
        onLocationChange={handleLocationChange}
        onGenerarReporte={handleGenerarReporte}
        incidencias={incidencias}
        onSeleccionarIncidencia={setPinSeleccionado}
      />

      {mostrarForm && (
        <Suspense fallback={null}>
          <ReportForm
            lat={ubicacionReporte?.lat}
            lon={ubicacionReporte?.lon}
            onClose={() => setMostrarForm(false)}
            onSuccess={() => setTick((n) => n + 1)}
          />
        </Suspense>
      )}

      {pinSeleccionado && !mostrarForm && (
        <BottomSheet titulo={pinSeleccionado.categoria_nombre} onClose={() => setPinSeleccionado(null)}>
          {/* Solo datos públicos: nada de nombres, correos, descripciones ni fotos */}
          <ul className="ficha-pin">
            <li><strong>Estado:</strong> {ETIQUETA_ESTADO[pinSeleccionado.estado] ?? pinSeleccionado.estado}</li>
            <li><strong>Reportes ciudadanos:</strong> {pinSeleccionado.reportes_count}</li>
            <li><strong>Prioridad:</strong> {ETIQUETA_PRIORIDAD[nivel]}</li>
          </ul>
          <p className="ficha-pin__nota">
            Si ves el mismo problema, repórtalo desde el mapa: tu reporte se sumará a este y subirá su prioridad.
          </p>
        </BottomSheet>
      )}
    </>
  );
}
