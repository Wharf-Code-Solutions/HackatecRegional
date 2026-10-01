import { useCallback, useEffect, useRef, useState } from 'react';
import './BottomSheet.css';

const DURACION_SALIDA = 240; // ms, igual que --sheet-salida en el CSS
const UMBRAL_DISTANCIA = 0.25; // fracción de la altura que hay que arrastrar para cerrar
const UMBRAL_VELOCIDAD = 0.6; // px/ms

const esEscritorio = () => window.matchMedia('(min-width: 768px)').matches;
const sinAnimacion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Hoja inferior (móvil) / tarjeta lateral (escritorio).
 * - Entra y sale con animación; se cierra con Esc, tap en el fondo, botón ×
 *   o deslizando hacia abajo desde el asa/cabecera (el contenido solo hace scroll).
 * - `bloqueante`: no se puede cerrar (solo el contenido decide cuándo desaparecer) y en escritorio
 *   centra la tarjeta con fondo oscuro. El cuerpo no hace scroll: lo reparte el contenido.
 */
export default function BottomSheet({ titulo, onClose, bloqueante = false, children }) {
  const hojaRef = useRef(null);
  const fondoRef = useRef(null);
  const arrastre = useRef(null);
  const [cerrando, setCerrando] = useState(false);

  const cerrar = useCallback(() => {
    if (cerrando) return;
    setCerrando(true);
    setTimeout(onClose, sinAnimacion() ? 0 : DURACION_SALIDA);
  }, [cerrando, onClose]);

  // El padre suele pasar `onClose` en línea (cambia en cada render, p. ej. al refrescar los pines o mover el mapa).
  // El efecto de foco lee siempre la versión actual desde estas refs y solo corre al abrir y cerrar la hoja:
  // si dependiera de `cerrar`, cada render del padre le quitaría el foco al campo que se está escribiendo.
  const cerrarRef = useRef(cerrar);
  const bloqueanteRef = useRef(bloqueante);
  useEffect(() => {
    cerrarRef.current = cerrar;
    bloqueanteRef.current = bloqueante;
  });

  // Foco, tecla Esc y devolución del foco al elemento que abrió la hoja
  useEffect(() => {
    const previo = document.activeElement;
    hojaRef.current?.focus({ preventScroll: true });
    const alTeclear = (e) => { if (e.key === 'Escape' && !bloqueanteRef.current) cerrarRef.current(); };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      previo?.focus?.({ preventScroll: true });
    };
  }, []);

  // ---- Deslizar hacia abajo para cerrar (solo móvil) ----
  function alPulsar(e) {
    if (bloqueante || esEscritorio() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* puntero sin captura: el arrastre sigue funcionando dentro del elemento */ }
    arrastre.current = { y0: e.clientY, t0: performance.now(), dy: 0 };
    hojaRef.current.style.transition = 'none';
  }

  function alMover(e) {
    const a = arrastre.current;
    if (!a) return;
    a.dy = Math.max(0, e.clientY - a.y0); // solo hacia abajo
    hojaRef.current.style.transform = `translateY(${a.dy}px)`;
    const altura = hojaRef.current.offsetHeight || 1;
    fondoRef.current.style.opacity = String(1 - Math.min(1, a.dy / altura) * 0.8);
  }

  function alSoltar() {
    const a = arrastre.current;
    if (!a) return;
    arrastre.current = null;
    const hoja = hojaRef.current;
    const altura = hoja.offsetHeight || 1;
    const velocidad = a.dy / Math.max(1, performance.now() - a.t0);
    hoja.style.transition = '';

    if (a.dy > altura * UMBRAL_DISTANCIA || (velocidad > UMBRAL_VELOCIDAD && a.dy > 30)) {
      hoja.style.transform = 'translateY(100%)';
      fondoRef.current.style.opacity = '0';
      setCerrando(true);
      setTimeout(onClose, sinAnimacion() ? 0 : DURACION_SALIDA);
    } else {
      hoja.style.transform = '';
      fondoRef.current.style.opacity = '';
    }
  }

  // Con el teclado virtual abierto, lleva el campo enfocado a la vista
  function alEnfocar(e) {
    const el = e.target;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
    // Con el teclado de iOS abierto, iOS ya desplaza por su cuenta: solo se asegura que el campo quede visible
    setTimeout(() => el.scrollIntoView(
      document.documentElement.classList.contains('teclado-abierto')
        ? { block: 'nearest' }
        : { block: 'center', behavior: 'smooth' },
    ), 300);
  }

  return (
    <div
      ref={fondoRef}
      className={`sheet-fondo${cerrando ? ' is-cerrando' : ''}${bloqueante ? ' sheet-fondo--bloqueante' : ''}`}
      onPointerDown={(e) => {
        if (bloqueante || e.target !== e.currentTarget) return;
        // Con un campo enfocado, el primer toque fuera solo baja el teclado (no descarta lo escrito)
        const activo = document.activeElement;
        if (activo && /^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName)) { activo.blur(); return; }
        cerrar();
      }}
    >
      <section
        ref={hojaRef}
        className={`sheet${cerrando ? ' is-cerrando' : ''}${bloqueante ? ' sheet--bloqueante' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
      >
        <div
          className="sheet__cabecera"
          onPointerDown={alPulsar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          <span className="sheet__asa" aria-hidden="true" />
          <div className="sheet__titulo">
            <h2>{titulo}</h2>
            {!bloqueante && (
              <button
                type="button"
                className="sheet__cerrar"
                onClick={cerrar}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Cerrar"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="sheet__cuerpo" onFocusCapture={alEnfocar}>
          {children}
        </div>
      </section>
    </div>
  );
}
