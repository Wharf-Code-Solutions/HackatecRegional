import { useState } from 'react';
import MapView from './MapView';
import ReportForm from './ReportForm';

// Vista ciudadana: mapa con pin central + formulario de reporte
export default function CiudadanoPage() {
  const [ubicacionReporte, setUbicacionReporte] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const handleLocationChange = (coords) => {
    setUbicacionReporte(coords);
  };

  // "Generar Reporte": toma las coordenadas actuales del pin y abre el formulario
  const handleGenerarReporte = (coords) => {
    setUbicacionReporte(coords);
    setMostrarForm(true);
  };

  return (
    <>
      <MapView
        onLocationChange={handleLocationChange}
        onGenerarReporte={handleGenerarReporte}
      />

      {mostrarForm && (
        <ReportForm
          lat={ubicacionReporte?.lat}
          lon={ubicacionReporte?.lon}
          onClose={() => setMostrarForm(false)}
        />
      )}
    </>
  );
}
