import { useEffect } from 'react';
import './Toast.css';

const DURACION_MS = 5000;

/** Aviso centrado en la parte superior de la pantalla. Se cierra solo a los 5 s. */
export default function Toast({ aviso, onClose }) {
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(onClose, DURACION_MS);
    return () => clearTimeout(t);
  }, [aviso, onClose]);

  if (!aviso) return null;
  return (
    <div className={`toast-aviso toast-${aviso.tipo}`} role={aviso.tipo === 'danger' ? 'alert' : 'status'}>
      <span>{aviso.texto}</span>
      <button type="button" onClick={onClose} aria-label="Cerrar aviso">×</button>
    </div>
  );
}
