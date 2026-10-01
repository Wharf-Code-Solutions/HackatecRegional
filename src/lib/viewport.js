// El teclado virtual y las barras de Safari iOS no cambian el viewport de layout ni `dvh`: los elementos
// `position: fixed` (la hoja del formulario) quedan tapados. Aquí se mide el viewport *visual* y se publica:
//   html.teclado-abierto  -> solo en móvil y solo mientras hay teclado (sin la clase, el CSS no cambia)
//   --teclado / --vv-top  -> px que tapa el teclado / desplazamiento del viewport visual
//   --app-h               -> alto visible en navegadores sin `dvh` (Safari < 15.4); el resto sigue usando dvh
const UMBRAL_TECLADO = 150 // px: menos que esto son las barras del navegador, no un teclado

export function iniciarViewport(vv = window.visualViewport) {
  const raiz = document.documentElement
  const sinDvh = !(window.CSS && CSS.supports && CSS.supports('height', '100dvh'))
  const movil = window.matchMedia('(max-width: 767px)')
  let abierto = false
  let pendiente = 0

  const actualizar = () => {
    pendiente = 0
    if (sinDvh) raiz.style.setProperty('--app-h', `${window.innerHeight}px`)
    if (!vv) return

    // Con zoom de pellizco el viewport visual también se encoge: no es un teclado
    const tapado = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
    const hay = movil.matches && vv.scale < 1.05 && tapado > UMBRAL_TECLADO

    if (hay) {
      raiz.style.setProperty('--teclado', `${tapado}px`)
      raiz.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`)
    }
    if (hay === abierto) return
    abierto = hay
    raiz.classList.toggle('teclado-abierto', hay)
    if (!hay) {
      raiz.style.removeProperty('--teclado')
      raiz.style.removeProperty('--vv-top')
      if (window.scrollY) window.scrollTo(0, 0) // iOS deja la página desplazada al cerrar el teclado
    }
    window.dispatchEvent(new Event('teclado-cambio'))
  }

  const programar = () => { if (!pendiente) pendiente = requestAnimationFrame(actualizar) }
  window.addEventListener('resize', programar)
  window.addEventListener('orientationchange', programar)
  vv?.addEventListener('resize', programar)
  vv?.addEventListener('scroll', programar)
  actualizar()
}
