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
- [ ] Las 7 categorías aparecen como radios con ícono (Baches, Alumbrado, Señalizaciones, Banquetas, Semáforos, Coladeras, Obstrucciones).
- [ ] "Tomar foto" abre la cámara en el celular.
- [ ] Foto grande → se sube; la URL pública abre en el navegador.
- [ ] En Network, el POST lleva `null` (no `""`) en campos vacíos.
- [ ] Respuesta 200 con `incidencia_id`. Dos envíos a <10 m de la misma categoría → `agrupado: true`.
- [ ] Probar en celular.

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
| 3 | Dashboard, HeatMap, `/api/admin` | 1-2-3 | Pendiente |
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
