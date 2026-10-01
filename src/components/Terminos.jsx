import { useState } from 'react';
import { Link } from 'react-router-dom';
import BottomSheet from './BottomSheet';
import { guardarAceptacion } from '../lib/terminos';
import './Terminos.css';

function TextoTerminos() {
  return (
    <div className="terminos__texto">
      <h3>Qué datos recopilamos</h3>
      <p>
        Solo los necesarios para atender tu reporte: tu <strong>nombre</strong>, tu <strong>correo electrónico</strong>{' '}
        (opcional), la <strong>ubicación</strong> que eliges en el mapa al reportar, la <strong>descripción</strong> y la{' '}
        <strong>foto</strong> que decidas adjuntar. No recopilamos ningún otro dato personal ni rastreamos tu ubicación
        en segundo plano.
      </p>

      <h3>Para qué los usamos</h3>
      <p>
        Únicamente para dar seguimiento a tu reporte ante la autoridad responsable y notificarte por correo cuando cambie
        su estado. No los vendemos ni los usamos para otros fines. Tu nombre y correo no se muestran públicamente: el mapa
        solo muestra el tipo de problema, su estado y su ubicación.
      </p>

      <h3>Tu foto y la verificación automática</h3>
      <p>
        Las fotos se almacenan para que el personal pueda atender el problema. Para ayudarte a elegir el tipo de problema y
        evitar fotos que no corresponden, la imagen se envía a un servicio de análisis de imágenes (inteligencia
        artificial) que solo la clasifica; no se usa para identificarte. Evita que aparezcan rostros, placas o datos de
        personas. Para evitar abusos, el sistema también procesa temporalmente tu dirección IP.
      </p>

      <h3>Reglas de uso</h3>
      <p>Este canal comunica a la ciudadanía con organismos públicos. Al usarlo te comprometes a:</p>
      <ul>
        <li>Reportar únicamente problemas urbanos reales y en la ubicación indicada.</li>
        <li>No subir contenido obsceno, sexual, violento, ofensivo, discriminatorio ni ajeno al problema reportado.</li>
        <li>No enviar reportes falsos, de broma o repetidos para saturar el servicio, ni suplantar a otra persona.</li>
        <li>No incluir datos personales de terceros en la descripción o en las fotos.</li>
      </ul>
      <p>
        Los reportes que incumplan estas reglas podrán ser rechazados o eliminados, y el uso indebido de un servicio
        público puede tener las consecuencias que establezcan las leyes aplicables.
      </p>

      <h3>Tus derechos</h3>
      <p>
        Puedes solicitar el acceso, la rectificación, la cancelación o la oposición al tratamiento de tus datos
        (derechos ARCO) comunicándote con la autoridad municipal responsable de este servicio, con tu folio de reporte.
        El tratamiento se rige por la normativa mexicana de protección de datos personales aplicable.
      </p>
    </div>
  );
}

// Aviso bloqueante sobre la hoja de la app (BottomSheet): no se usa el sistema hasta aceptar
export function TerminosGate({ onAceptar }) {
  const [acepto, setAcepto] = useState(false);

  function continuar() {
    guardarAceptacion();
    onAceptar();
  }

  return (
    <BottomSheet titulo="Términos y condiciones" bloqueante onClose={() => {}}>
      <p className="terminos__intro">Antes de reportar, lee cómo usamos tus datos y las reglas de uso.</p>
      <TextoTerminos />
      <div className="terminos__pie">
        <label className="terminos__casilla">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>He leído y acepto los términos y condiciones y el uso de mis datos para dar seguimiento a mi reporte.</span>
        </label>
        <button type="button" className="btn btn-primary" disabled={!acepto} onClick={continuar}>
          Continuar
        </button>
      </div>
    </BottomSheet>
  );
}

// Página de consulta (/terminos): mismo esquema que Rastreo (fondo gris, columna central, tarjeta con borde dorado)
export default function TerminosPagina() {
  return (
    <div className="terminos-pagina">
      <div className="terminos-pagina__contenido">
        <h1>Términos y condiciones</h1>
        <article className="terminos-pagina__tarjeta">
          <TextoTerminos />
        </article>
        <Link to="/" className="btn btn-primary">Volver al mapa</Link>
      </div>
    </div>
  );
}
