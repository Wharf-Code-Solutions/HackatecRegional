import os
import time
from collections import defaultdict
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional
from uuid import UUID
import httpx
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# APP y CORS (Fase 2 - Integración)
# ─────────────────────────────────────────────
app = FastAPI(
    title="API Hackatec Regional",
    description="Backend de la plataforma de reportes ciudadanos.",
    version="1.0.0",
)

# Permitimos que el Frontend de React pueda hacer peticiones sin ser bloqueado
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # En producción: URL de Vercel
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# CONEXIÓN A SUPABASE (service_role = salta el RLS)
# ─────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Variables que faltan. Si no están, la API NO se cae al arrancar (en Vercel eso da un
# 500 FUNCTION_INVOCATION_FAILED sin explicación): arranca y responde 503 con el detalle.
VARIABLES_FALTANTES = [
    nombre for nombre, valor in (
        ("SUPABASE_URL", SUPABASE_URL),
        ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY),
    ) if not valor
]

supabase: Optional[Client] = None
if not VARIABLES_FALTANTES:
    # HTTP/1.1: con HTTP/2 y un cliente compartido, dos peticiones simultáneas
    # (p. ej. lista + detalle del panel) provocan ConnectionTerminated.
    supabase = create_client(
        SUPABASE_URL,
        SUPABASE_KEY,
        options=ClientOptions(httpx_client=httpx.Client(http2=False, timeout=30)),
    )


@app.middleware("http")
async def exigir_base_de_datos(request: Request, call_next):
    """Sin credenciales de Supabase solo responde /api/health; el resto devuelve 503 claro."""
    if supabase is None and request.url.path != "/api/health":
        return JSONResponse(
            status_code=503,
            content={"detail": f"Falta configurar en el servidor: {', '.join(VARIABLES_FALTANTES)}"},
        )
    return await call_next(request)

# ─────────────────────────────────────────────
# RATE LIMIT ANTI-SPAM (Fase 4)
# Máximo 5 reportes por IP en 60 segundos.
# ─────────────────────────────────────────────
_rate_store: dict = defaultdict(list)
RATE_LIMIT  = 5
RATE_WINDOW = 60.0

def check_rate_limit(ip: str) -> None:
    now = time.time()
    _rate_store[ip] = [t for t in _rate_store[ip] if now - t < RATE_WINDOW]
    if len(_rate_store[ip]) >= RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Demasiados reportes. Espera un momento antes de volver a enviar.",
        )
    _rate_store[ip].append(now)


# ─────────────────────────────────────────────
# HELPER: Simulación de correo (Fase 4)
# Para conectar SendGrid/Resend reemplaza el print.
# ─────────────────────────────────────────────
def enviar_correos_resolucion(incidencia_id: str, correos: list) -> None:
    if not correos:
        return
    for email in correos:
        print(
            f"[MOCK EMAIL] Para: {email} | "
            f"Asunto: Tu reporte fue atendido | "
            f"Incidencia: {incidencia_id}"
        )


def enmascarar_correo(email: Optional[str]) -> Optional[str]:
    """ju***@gmail.com: el panel no necesita ver el correo completo."""
    if not email or "@" not in email:
        return None
    usuario, dominio = email.split("@", 1)
    return f"{usuario[:2]}***@{dominio}"


# ─────────────────────────────────────────────
# MODELOS PYDANTIC
# ─────────────────────────────────────────────
class ReporteNuevo(BaseModel):
    categoria_id: int          = Field(..., ge=1, description="ID de categoría")
    lat: float                 = Field(..., ge=-90,  le=90,  description="Latitud GPS")
    lon: float                 = Field(..., ge=-180, le=180, description="Longitud GPS")
    descripcion: Optional[str] = Field(None, max_length=500)
    foto_url:    Optional[str] = None
    email_ciudadano: Optional[EmailStr] = None
    nombre_ciudadano: Optional[str] = Field(None, max_length=100)

    @field_validator("descripcion", "foto_url", "nombre_ciudadano", mode="before")
    @classmethod
    def limpiar_vacios(cls, v):
        if isinstance(v, str) and v.strip() == "": return None
        return v


class ResolverIncidencia(BaseModel):
    incidencia_id:  str           = Field(..., description="UUID de la incidencia")
    funcionario_id: Optional[str] = Field(None, description="UUID del funcionario")


class CambioEstado(BaseModel):
    incidencia_id: UUID = Field(..., description="UUID de la incidencia")


class RechazarIncidencia(BaseModel):
    incidencia_id:  str           = Field(..., description="UUID de la incidencia")
    funcionario_id: Optional[str] = Field(None, description="UUID del funcionario")
    motivo: Optional[str]         = Field(None, max_length=200)

    @field_validator("motivo", mode="before")
    @classmethod
    def limpiar_motivo(cls, v):
        if isinstance(v, str) and v.strip() == "": return None
        return v


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/health", tags=["Sistema"])
def health_check():
    return {
        "status": "online",
        "db_connected": supabase is not None,
        "faltan_variables": VARIABLES_FALTANTES,
    }


@app.get("/api/categorias", tags=["Ciudadano"])
def obtener_categorias():
    """Retorna categorías activas para el selector del formulario (Dev 2 lo consume)."""
    try:
        res = supabase.table("categorias").select("id, slug, nombre, prioridad_base").eq("activa", True).execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reportes", tags=["Ciudadano"], status_code=201)
def registrar_reporte(reporte: ReporteNuevo, request: Request):
    """Registra un reporte ciudadano. Incluye rate-limit 5 req/min por IP."""
    # Detrás del proxy de Vercel, la IP real del ciudadano viene en X-Forwarded-For
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")
    check_rate_limit(ip)

    payload = {
        "p_categoria_id": reporte.categoria_id,
        "p_lat":          reporte.lat,
        "p_lon":          reporte.lon,
        "p_descripcion":  reporte.descripcion,
        "p_foto_url":     reporte.foto_url,
        "p_email":        str(reporte.email_ciudadano) if reporte.email_ciudadano else None,
        "p_nombre":       reporte.nombre_ciudadano,
    }

    try:
        response = supabase.rpc("registrar_incidencia", payload).execute()
        return response.data
    except Exception as e:
        error_msg = str(e)
        print(f"ERROR POST /api/reportes: {error_msg}")
        if "22023" in error_msg or "inválida" in error_msg.lower() or "inactiva" in error_msg.lower():
            raise HTTPException(status_code=422, detail=f"Datos inválidos: {error_msg}")
        raise HTTPException(status_code=500, detail="Error interno del servidor.")


@app.get("/api/admin/incidencias", tags=["Admin"])
def obtener_incidencias(estado: Optional[str] = None):
    """Dashboard municipal. Sin params devuelve pendiente+en_proceso ordenadas por prioridad."""
    ESTADOS_VALIDOS = {"pendiente", "en_proceso", "atendida", "rechazada"}
    if estado and estado not in ESTADOS_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Permitidos: {sorted(ESTADOS_VALIDOS)}")

    try:
        estados_filtro = [estado] if estado else ["pendiente", "en_proceso"]
        # La vista ya entrega lat/lon, categoria_nombre y foto_principal aplanados
        response = (
            supabase.table("v_incidencias_admin")
            .select("*")
            .in_("estado", estados_filtro)
            .order("prioridad", desc=True)
            .order("created_at", desc=False)
            .execute()
        )
        return response.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/incidencias/{incidencia_id}", tags=["Admin"])
def obtener_detalle_incidencia(incidencia_id: UUID):
    """Detalle de una incidencia: fila de la vista + reportes individuales (correo enmascarado)."""
    try:
        inc = (
            supabase.table("v_incidencias_admin")
            .select("*")
            .eq("id", str(incidencia_id))
            .execute()
        )
        if not inc.data:
            raise HTTPException(status_code=404, detail="Incidencia no encontrada.")
        reps = (
            supabase.table("reportes")
            .select("id, nombre_ciudadano, descripcion, foto_url, email_ciudadano, created_at")
            .eq("incidencia_id", str(incidencia_id))
            .order("created_at", desc=False)
            .execute()
        )
        reportes = [
            {
                "id":               r["id"],
                "nombre_ciudadano": r.get("nombre_ciudadano"),
                "descripcion":      r.get("descripcion"),
                "foto_url":         r.get("foto_url"),
                "email":            enmascarar_correo(r.get("email_ciudadano")),
                "created_at":       r["created_at"],
            }
            for r in reps.data
        ]
        return {**inc.data[0], "reportes": reportes}
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR GET /incidencias/id: {e}")
        raise HTTPException(status_code=500, detail="Error interno al obtener la incidencia.")


def _cambiar_estado(incidencia_id: UUID, desde: str, hacia: str, mensaje: str):
    """Único update directo permitido por la guía de BD: pendiente→en_proceso y rechazada→pendiente."""
    try:
        res = (
            supabase.table("incidencias")
            .update({"estado": hacia})
            .eq("id", str(incidencia_id))
            .eq("estado", desde)
            .execute()
        )
    except Exception as e:
        print(f"ERROR cambio de estado {desde}->{hacia}: {e}")
        raise HTTPException(status_code=500, detail="Error interno al cambiar el estado.")
    if not res.data:
        raise HTTPException(status_code=409, detail=f"La incidencia no existe o no está en estado '{desde}'.")
    return {"mensaje": mensaje, "estado": hacia}


@app.patch("/api/admin/en-proceso", tags=["Admin"])
def marcar_en_proceso(payload: CambioEstado):
    """pendiente → en_proceso (una cuadrilla ya la atiende)."""
    return _cambiar_estado(payload.incidencia_id, "pendiente", "en_proceso", "Incidencia marcada en proceso.")


@app.patch("/api/admin/restaurar", tags=["Admin"])
def restaurar_incidencia(payload: CambioEstado):
    """rechazada → pendiente (el trigger de la BD limpia el motivo)."""
    return _cambiar_estado(payload.incidencia_id, "rechazada", "pendiente", "Incidencia restaurada.")


@app.patch("/api/admin/resolver", tags=["Admin"])
def resolver_incidencia_endpoint(payload: ResolverIncidencia):
    """Marca como atendida y notifica por correo a los ciudadanos (simulado)."""
    try:
        res = supabase.rpc("resolver_incidencia", {
            "p_incidencia_id": payload.incidencia_id,
            "p_funcionario":   payload.funcionario_id,
        }).execute()
        correos = res.data or []
        enviar_correos_resolucion(payload.incidencia_id, correos)
        return {"mensaje": "Incidencia marcada como atendida.", "correos_notificados": correos}
    except Exception as e:
        error_msg = str(e)
        print(f"ERROR PATCH /resolver: {error_msg}")
        if "P0002" in error_msg or "cerrada" in error_msg.lower():
            raise HTTPException(status_code=409, detail="Incidencia no encontrada o ya cerrada.")
        raise HTTPException(status_code=500, detail="Error interno al resolver la incidencia.")


@app.patch("/api/admin/rechazar", tags=["Admin"])
def rechazar_incidencia_endpoint(payload: RechazarIncidencia):
    """Borrado suave: pasa a rechazada con motivo opcional. No notifica al ciudadano."""
    try:
        supabase.rpc("rechazar_incidencia", {
            "p_incidencia_id": payload.incidencia_id,
            "p_funcionario":   payload.funcionario_id,
            "p_motivo":        payload.motivo,
        }).execute()
        return {"mensaje": "Incidencia rechazada y marcada como spam."}
    except Exception as e:
        error_msg = str(e)
        print(f"ERROR PATCH /rechazar: {error_msg}")
        if "P0002" in error_msg or "cerrada" in error_msg.lower():
            raise HTTPException(status_code=409, detail="Incidencia no encontrada o ya cerrada.")
        raise HTTPException(status_code=500, detail="Error interno al rechazar la incidencia.")