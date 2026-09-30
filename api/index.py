import os
import time
from collections import defaultdict
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional
from supabase import create_client, Client
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

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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

    @field_validator("descripcion", "foto_url", mode="before")
    @classmethod
    def limpiar_vacios(cls, v):
        if isinstance(v, str) and v.strip() == "": return None
        return v


class ResolverIncidencia(BaseModel):
    incidencia_id:  str           = Field(..., description="UUID de la incidencia")
    funcionario_id: Optional[str] = Field(None, description="UUID del funcionario")


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
    return {"status": "online", "db_connected": bool(SUPABASE_URL)}


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
    ip = request.client.host if request.client else "unknown"
    check_rate_limit(ip)

    payload = {
        "p_categoria_id": reporte.categoria_id,
        "p_lat":          reporte.lat,
        "p_lon":          reporte.lon,
        "p_descripcion":  reporte.descripcion,
        "p_foto_url":     reporte.foto_url,
        "p_email":        str(reporte.email_ciudadano) if reporte.email_ciudadano else None,
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
        response = (
            supabase.table("incidencias")
            .select("id, estado, prioridad, reportes_count, created_at, atendida_at, motivo_rechazo, categorias(slug, nombre), reportes(foto_url, email_ciudadano)")
            .in_("estado", estados_filtro)
            .order("prioridad", desc=True)
            .order("created_at", desc=False)
            .execute()
        )
        resultado = []
        for inc in response.data:
            cat  = inc.get("categorias") or {}
            reps = inc.get("reportes") or []
            fotos = [r["foto_url"] for r in reps if r.get("foto_url")]
            resultado.append({
                "id":               inc["id"],
                "categoria":        cat.get("slug"),
                "categoria_nombre": cat.get("nombre"),
                "estado":           inc["estado"],
                "prioridad":        inc["prioridad"],
                "reportes_count":   inc["reportes_count"],
                "created_at":       inc["created_at"],
                "atendida_at":      inc.get("atendida_at"),
                "motivo_rechazo":   inc.get("motivo_rechazo"),
                "foto_principal":   fotos[0] if fotos else None,
            })
        return resultado
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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