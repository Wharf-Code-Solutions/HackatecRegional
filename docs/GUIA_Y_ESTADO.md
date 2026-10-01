# Plataforma de Reportes Ciudadanos: guía, estado y siguientes pasos

## 1. Qué es
Una web donde un ciudadano marca en un mapa un problema urbano (bache, fuga, luminaria…), adjunta una foto y lo envía. Reportes cercanos de la misma categoría se agrupan en una sola **incidencia** y suben su prioridad. Los funcionarios verán después un dashboard y un mapa de calor para atenderlas.

## 2. Arquitectura
```
Navegador (React + Vite)
   ├── Supabase directo (anon key, pública) ──► leer `categorias` + subir foto a Storage
   └── /api/*  ──► FastAPI (api/index.py, Vercel) ──► Supabase (service_role, secreta)
                                                        └─ funciones SQL: registrar / resolver / rechazar_incidencia
```
- **Frontend:** `src/` (React 19, Vite, `react-map-gl` + Mapbox).
- **Backend:** `api/index.py` (FastAPI). `vercel.json` manda `/api/*` a Python y todo lo demás a `index.html`.
- **Base de datos:** Supabase (PostgreSQL + PostGIS). Fuente de verdad. Detalle en `GUIA_BASE_DE_DATOS.md` (fuera del repo, en la carpeta compartida del equipo).

Reglas clave: nombres en `snake_case` tal cual la BD; el frontend **solo** lee `categorias` y sube fotos; todo lo demás pasa por FastAPI; Mapbox usa `lng` pero la API usa `lon`.

## 3. Cómo funciona el formulario (Dev 2)
Archivos: `src/components/ReportForm.jsx` (+ `.css`), `src/lib/supabase.js`, `src/lib/subirFoto.js`.

1. Al montar, carga las categorías: `supabase.from('categorias').select('id, slug, nombre')`.
2. El usuario elige categoría, escribe descripción (máx. 500), foto opcional (JPG/PNG/WebP) y correo opcional.
3. Al enviar: si hay foto, `subirFoto()` la comprime en el navegador (JPEG, ≤1 MB, ≤1600 px), la sube al bucket `reportes-fotos` con nombre `crypto.randomUUID()` y obtiene la URL pública.
4. Envía `POST /api/reportes` con:
   ```json
   { "categoria_id": 1, "lat": 19.17, "lon": -96.13,
     "descripcion": null, "foto_url": null, "email_ciudadano": null }
   ```
   Los campos vacíos van como `null`, nunca `""`.
5. Muestra el resultado: nuevo problema, o "ya había N reportes" si `agrupado: true`.

Props de `ReportForm`: `lat`, `lon` (del marcador central del mapa) y `onSuccess(data)` opcional.
**Integración con Dev 1:** `<ReportForm lat={center.lat} lon={center.lng} />`.

## 4. Variables de entorno
Pide los valores al equipo y crea `.env` en la raíz (nunca se sube):

| Variable | Dónde | Notas |
| --- | --- | --- |
| `VITE_MAPBOX_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` | Frontend | Públicas. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Solo backend | **Jamás con `VITE_`.** |
| `MOCK_API=1` | Solo local (opcional) | Simula `POST /api/reportes` sin backend. |

En Vercel deben estar en **Production y Preview**, y hay que redeployar al cambiarlas.

## 5. Cómo probar esta rama (`test/ciudadano-form`)
Esta rama = `feat/ciudadano-form` + un `App.jsx` de pruebas que muestra solo el formulario con coordenadas fijas (Veracruz: 19.1734, -96.1342).

**Local**
```bash
git fetch origin && git checkout test/ciudadano-form
npm install
# crea .env con las VITE_*  (añade MOCK_API=1 si el backend aún falla)
npm run dev      # http://localhost:5173
```
**Preview en Vercel:** el push genera una URL en Vercel → Deployments (o en el PR).

**Checklist**
- [ ] Las 7 categorías aparecen como radios con ícono (Baches, Alumbrado, Señalizaciones, Rampas, Semáforos, Coladeras, Obstrucciones).
- [ ] "Tomar foto" abre la cámara en el celular.
- [ ] Foto grande → se sube; la URL pública abre en el navegador.
- [ ] En Network, el POST lleva `null` (no `""`) en campos vacíos.
- [ ] Respuesta 200 con `incidencia_id`. Dos envíos a <10 m de la misma categoría → `agrupado: true`.
- [ ] Probar en celular.

## Cambios de BD recientes
Ejecutar en orden en Supabase (SQL Editor), antes de desplegar: `db/003_nombre_y_rampas.sql` (columna `reportes.nombre_ciudadano`, parámetro `p_nombre` en `registrar_incidencia`, categoría "Rampas dañadas").
El formulario envía `nombre_ciudadano` (obligatorio en la interfaz, opcional en BD).

## Panel de funcionarios (`/admin`)
- Rutas: `/` = ciudadano (mapa + formulario), `/admin` = panel (react-router, `vercel.json` ya redirige a `index.html`).
- Pestañas Activas / Atendidas / Rechazadas, filtros (Urgentes = prioridad ≥ 7, por categoría), marcadores en el mapa, actualización cada 30 s.
- Detalle: foto, coordenadas, fecha (hora de México), estado en 3 pasos, reportes vinculados (nombre, correo enmascarado, descripción).
- Acciones: Marcar en proceso, Resolver (avisa a los correos; envío simulado), Rechazar (motivo opcional), Restaurar.
- Endpoints: `GET /api/admin/incidencias[?estado=]`, `GET /api/admin/incidencias/{id}`, `PATCH /api/admin/{en-proceso|resolver|rechazar|restaurar}`.
- **Pendiente de seguridad:** el panel y los PATCH no piden login; cualquiera con la URL puede operar. Siguiente paso: Supabase Auth + validar el token en el backend (y registrar `atendida_por`/`moderada_por`).
- Backend: el cliente de Supabase usa HTTP/1.1 (`httpx.Client(http2=False)`); con HTTP/2 las peticiones simultáneas fallaban con `ConnectionTerminated`.
- Local: `API_TARGET=http://localhost:8000` en `.env` apunta el proxy de Vite a un FastAPI local (`uvicorn index:app --port 8000` dentro de `api/`).

## Vista ciudadana móvil
- `BottomSheet` (`src/components/BottomSheet.jsx`): hoja inferior con animación; se cierra deslizando hacia abajo desde el asa/cabecera, con tap en el fondo, × o Esc. El cuerpo hace scroll con `overscroll-behavior: contain` para no mover el mapa. En ≥768 px es una tarjeta lateral.
- Validación (`src/lib/validar.js`): nombre (2–100, solo letras/espacios/`'.-`), correo válido si se escribe, descripción ≤ 500, tipo de problema obligatorio, foto JPG/PNG/WebP ≤ 15 MB; mensajes bajo cada campo. El backend repite la validación (nombre, foto solo del bucket del proyecto).
- Aviso de éxito con folio corto de 8 caracteres y botón "Copiar".
- Pines públicos: `GET /api/incidencias` devuelve solo activas (pendiente, en proceso) con `categoria, categoria_nombre, estado, prioridad, reportes_count, lat, lon`. **Nunca** id, foto, dirección, nombre, correo ni descripción. La ficha del pin muestra solo esos datos.

## Correos por etapa
- Se envían por SMTP (Gmail) desde el backend en 3 momentos: **Recibido** (al crear el reporte, solo a quien reporta), **En proceso** (al marcarla en el panel, a todos los ciudadanos vinculados) y **Atendido** (al resolverla). Rechazar **no** envía correo.
- Plantilla HTML con colores del kit gob.mx (banner guinda/verde, borde dorado, recuadro del folio de 8 caracteres) y versión en texto plano. Solo incluye nombre, tipo de problema y folio.
- Un fallo de correo **nunca** rompe el reporte ni el cambio de estado; el panel informa cuántos correos salieron.
- Variables de entorno en Vercel (Production y Preview, **solo backend, sin `VITE_`**): `SMTP_USER` (cuenta de Gmail) y `SMTP_PASSWORD` (contraseña de aplicación de 16 caracteres, márcala como Secret). Opcionales: `SMTP_HOST` (smtp.gmail.com), `SMTP_PORT` (465), `MAIL_FROM_NAME`. Sin ellas los correos se omiten y todo lo demás funciona.
- **Nunca** guardes la contraseña en el repositorio, en el chat ni en `.env` versionado.
- Límites: Gmail permite unos 500 correos al día por cuenta. El endpoint de reportes tiene límite de 5 por minuto por IP, pero alguien podría escribir un correo ajeno; para producción real conviene confirmar el correo o usar un servicio transaccional.

## Rendimiento de carga
- `index.html` trae un **shell prerenderizado** (barra superior + indicador) con CSS crítico en línea, así que algo se ve al instante. Las fuentes y el kit gob.mx cargan sin bloquear el primer pintado.
- Las rutas (`/` y `/admin`), el formulario y la compresión de fotos se cargan bajo demanda; el JS inicial pasó de ~575 KB a ~261 KB (173 → 83 KB comprimido). `mapbox-gl` (~517 KB comprimido) se descarga justo después del primer pintado.
- `vercel.json` marca `/assets/*` como inmutables (caché de un año; los nombres llevan hash).

## Solo República Mexicana
- El mapa (ciudadano y panel) no se puede alejar ni desplazar fuera de México (`maxBounds` + zoom mínimo 4, `src/lib/mexico.js`).
- La ubicación del reporte se valida contra un **contorno aproximado del país** (con margen de decenas de km en costa y frontera), en el formulario y en el backend (`MEXICO_POLIGONO` en `api/index.py`). Fuera de México responde 422. "Ubicarme" avisa si el GPS está en otro país.
- Los dos contornos (JS y Python) deben mantenerse iguales. Es una aproximación: cerca de la frontera puede aceptar puntos a pocos km del otro lado.

## Score de prioridad por entorno
`prioridad = min(10, prioridad_base de la categoría + (reportes - 1) + bonus_entorno)`
- **bonus_entorno (0 a 4)** según lo que haya a 250 m del reporte (Mapbox Tilequery, `poi_label`, mismo token público del mapa):
  - Peso por tipo de lugar: Hospital 4 · Jardín de niños 4 · Guardería 4 · Clínica 3 · Escuela 3 · Bomberos 3 · Consultorio 2 · Universidad 2 · Policía 2 · Asistencia social 2 · Dentista/Farmacia/Palacio municipal/Biblioteca 1. Si el tipo no está pero su clase sí: médico 1, educativo 2.
  - Factor por distancia: ≤50 m x1.0 · ≤100 m x0.8 · ≤150 m x0.6 · ≤200 m x0.4 · ≤250 m x0.25. Se toma el mejor candidato (peso x factor, redondeado).
  - +1 si hay 3 o más lugares sensibles (peso ≥ 2) en el radio. Tope total: +4.
- Se calcula **una sola vez**, al crear la incidencia (su ubicación no cambia); si Mapbox falla, el reporte queda con la prioridad base.
- Requiere ejecutar `db/004_entorno_prioridad.sql` (columnas `entorno_bonus` y `entorno_detalle`, función `aplicar_entorno`, `registrar_incidencia` ponderada y vista con `prioridad_base`). Antes de ejecutarlo todo funciona igual, sin bonus.
- Las incidencias anteriores quedan con bonus 0. El panel muestra el desglose (tipo + reportes + entorno) y los lugares cercanos.
- Los pesos son una propuesta ajustable: están en `LUGARES_SENSIBLES` de `api/index.py`.

## 6. Flujo de ramas
- `main` = producción (Vercel). Solo entra código por PR.
- `feat/*` = una rama por módulo, creada desde `main` actualizado. Cada push genera un preview en Vercel.
- `test/*` = ramas de prueba/integración. **No se mergean a `main`** (pueden contener `App.jsx` de prueba).
- Antes de empezar cada fase: `git pull origin main`.
- Archivos compartidos (`App.jsx`, `package.json`, `vite.config.js`): avisar antes de tocarlos.

## 7. Estado actual
| Fase | Módulo | Dev | Estado |
| --- | --- | --- | --- |
| 1 | `MapView.jsx` + `NavBar` | 1 | **Hecho** en `main` |
| 1 | `ReportForm.jsx` + subida de foto | 2 | **Hecho** (categorías como radios con ícono, cámara, compresión, Storage, kit gob.mx) |
| 1 | `POST /api/reportes` | 3 | Código en `main`; **el despliegue falla**: `/api/health` da `db_connected: false` y el POST responde `name 'supabase' is not defined` |
| 2 | Integración mapa + formulario | 1-2 | **Hecho** en `feat/ciudadano-integracion` (pendiente PR y prueba en Vercel) |
| 3 | Panel de funcionarios (`/admin`) + `/api/admin` | 1-2-3 | **Hecho** en `feat/admin` (lista, detalle, en proceso, resolver, rechazar, restaurar). Pendiente: HeatMap |
| 4 | Pulido, geocodificación, casos límite | 1-2-3 | Pendiente |

## 8. Qué sigue
1. **Dev 3 (bloqueante):** configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en Vercel (Production y Preview) y redeployar; hacer que la API responda 503/500 claro si el cliente no existe; mapear errores de la BD a 400/422 (`22023`) en vez de 500.
2. **Dev 1:** revisar los cambios mínimos en `MapView.jsx` (prop `onGenerarReporte`, import `react-map-gl/mapbox`) y `App.jsx`.
3. **Dev 2:** abrir PR `feat/ciudadano-integracion` → `main`; probar en el preview: mover mapa → Generar Reporte → foto → enviar → 200 + ID.
4. **Kit gob.mx:** cargado vía CSS del CDN en `index.html`; tokens `--gob-*` alineados a la paleta oficial en `src/index.css`. Ojo: el kit fija `html{font-size:10px}`, usar `px` en estilos nuevos.
5. **Fase 3:** dashboard (`Dashboard.jsx`), `HeatMap.jsx` (Dev 2, leyendo `v_incidencias_admin` vía API, excluyendo `rechazada`/`atendida`) y `/api/admin` con PATCH resolver/rechazar.
6. **Fase 4:** UX mobile-first, geocodificación inversa (Mapbox) para `direccion`, pruebas de casos límite y correos.

## 9. Problemas conocidos
| Síntoma | Causa |
| --- | --- |
| Select de categorías vacío | Falta o está mal `VITE_SUPABASE_*`, o no se redeployó en Vercel. |
| POST devuelve 500 `name 'supabase' is not defined` | Faltan variables del backend en Vercel. |
| Foto no sube | >5 MB tras comprimir, formato no permitido o bucket mal escrito. |
| Pin en otro país | Se invirtió `[lat, lon]` ↔ `[lon, lat]`, o se mandó `lng` en vez de `lon`. |
