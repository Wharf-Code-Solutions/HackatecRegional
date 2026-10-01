const ACCESIBILIDAD = (
  <>
    <circle cx="10" cy="4" r="1.6" />
    <path d="M10 7v6h5l3 5M10 10h4M8 21a5 5 0 1 1 0-9" />
  </>
)

// Íconos de trazo por slug de categoría. Un slug nuevo cae en el ícono genérico.
const ICONOS = {
  bache: (
    <>
      <ellipse cx="12" cy="15" rx="7" ry="3" />
      <path d="M3 20h18M12 4v3M12 9.5v1.5" />
    </>
  ),
  alumbrado: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
    </>
  ),
  senalizacion: (
    <>
      <path d="M12 12v9M9 21h6" />
      <path d="M8 2h8l4 4v2l-4 4H8L4 8V6l4-4z" />
    </>
  ),
  rampa: ACCESIBILIDAD,
  semaforo: (
    <>
      <rect x="8" y="2" width="8" height="20" rx="2" />
      <circle cx="12" cy="7" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="17" r="1.5" />
    </>
  ),
  coladera: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M6 12h12M8 8h8M8 16h8" />
    </>
  ),
  obstruccion: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
}

const GENERICO = <path d="M12 3L2 20h20L12 3zM12 10v4M12 17v.5" />

export default function CategoriaIcono({ slug, size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONOS[slug] ?? GENERICO}
    </svg>
  )
}
