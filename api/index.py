import html
import os
import smtplib
import ssl
import time
from collections import defaultdict
from email.message import EmailMessage
from email.utils import formataddr
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
# CORREOS POR ETAPA (SMTP)
# Variables de entorno (NUNCA en el repositorio): SMTP_USER, SMTP_PASSWORD
# Opcionales: SMTP_HOST (smtp.gmail.com), SMTP_PORT (465), MAIL_FROM_NAME
# Sin credenciales, los correos se omiten y el resto de la API funciona igual.
# ─────────────────────────────────────────────
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER")
# Las contraseñas de aplicación de Google se muestran con espacios ("abcd efgh ..."); se usan sin ellos
SMTP_PASSWORD = (os.environ.get("SMTP_PASSWORD") or "").replace(" ", "")
MAIL_FROM_NAME = os.environ.get("MAIL_FROM_NAME", "Reportes Urbanos")
MAX_DESTINATARIOS = 50

GUINDA, DORADO, VERDE = "#9D2449", "#BC955C", "#13322E"

# etapa: (asunto, título del banner, mensaje en HTML, color del banner)
ETAPAS = {
    "recibido": (
        "Recibimos tu reporte",
        "¡Recibimos tu reporte!",
        "Tu reporte fue registrado correctamente y será revisado por las autoridades municipales.",
        GUINDA,
    ),
    "en_proceso": (
        "Tu reporte está en proceso",
        "Tu reporte está en proceso",
        "Una cuadrilla del Ayuntamiento ya está atendiendo la incidencia que reportaste.",
        GUINDA,
    ),
    "atendida": (
        "¡Tu reporte ha sido atendido!",
        "¡Tu reporte ha sido atendido!",
        "Te informamos que la incidencia que reportaste ha sido marcada como <strong>resuelta</strong> "
        "por las autoridades municipales.",
        VERDE,
    ),
}
PASOS = [("recibido", "Recibido"), ("en_proceso", "En proceso"), ("atendida", "Atendido")]


def _folio(incidencia_id: str) -> str:
    return str(incidencia_id)[:8].upper()


def construir_correo(etapa: str, nombre: Optional[str], incidencia_id: str, categoria: Optional[str]):
    """Devuelve (asunto, html, texto) con el estilo del kit gob.mx (CSS en línea, apto para clientes de correo)."""
    asunto, titulo, mensaje, color = ETAPAS[etapa]
    saludo = f"Hola {html.escape(nombre)}," if nombre else "Hola ciudadano,"
    folio = _folio(incidencia_id)
    cat = html.escape(categoria) if categoria else None

    pasos_html = " &rsaquo; ".join(
        f'<strong style="color:{color};">{etiqueta}</strong>' if clave == etapa
        else f'<span style="color:#98989A;">{etiqueta}</span>'
        for clave, etiqueta in PASOS
    )
    categoria_html = (
        f'<p style="margin:0 0 6px;">Tipo de problema: <strong>{cat}</strong></p>' if cat else ""
    )

    cuerpo = f"""<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0; padding:20px; background:#f4f4f4; font-family:'Noto Sans', Arial, sans-serif; color:#545454;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #dddddd; border-radius:8px; overflow:hidden;">

      <!-- Banner superior -->
      <div style="background-color:{color}; color:#ffffff; padding:22px 20px; text-align:center; border-bottom:4px solid {DORADO};">
        <h2 style="margin:0; font-size:22px; line-height:1.3;">{titulo}</h2>
      </div>

      <!-- Cuerpo -->
      <div style="padding:22px 24px; font-size:15px; line-height:1.5;">
        <p style="margin:0 0 12px;">{saludo}</p>
        <p style="margin:0 0 16px;">{mensaje}</p>

        <!-- Seguimiento -->
        <p style="margin:0 0 16px; font-size:13px;">{pasos_html}</p>

        <!-- Recuadro del folio -->
        <div style="background-color:#f4f4f4; border:1px dashed {DORADO}; border-radius:6px; padding:12px 14px; margin:0 0 16px;">
          {categoria_html}
          <p style="margin:0; font-family:'Courier New', monospace; font-size:16px;">
            Folio de seguimiento: <strong style="letter-spacing:1px;">{folio}</strong>
          </p>
        </div>

        <p style="margin:0 0 20px;">Gracias por ayudar a construir una mejor ciudad.</p>

        <!-- Firma -->
        <p style="margin:0; font-size:12px; color:#777777;">
          Atentamente,<br>
          Ayuntamiento Municipal - Plataforma Hackatec
        </p>
      </div>
    </div>
  </body>
</html>"""

    mensaje_texto = mensaje.replace("<strong>", "").replace("</strong>", "")
    texto = (
        f"{saludo.replace(html.escape(nombre or ''), nombre or '')}\n\n{mensaje_texto}\n\n"
        + (f"Tipo de problema: {categoria}\n" if categoria else "")
        + f"Folio de seguimiento: {folio}\n\n"
        "Gracias por ayudar a construir una mejor ciudad.\n\n"
        "Atentamente,\nAyuntamiento Municipal - Plataforma Hackatec\n"
    )
    return asunto, cuerpo, texto


def enviar_correos(etapa: str, incidencia_id: str, destinatarios: list, categoria: Optional[str]) -> dict:
    """Envía el correo de la etapa a [(email, nombre), ...] en UNA sola sesión SMTP.
    Nunca lanza: un fallo de correo no debe romper el reporte ni el cambio de estado."""
    resultado = {"enviados": [], "fallidos": 0, "configurado": bool(SMTP_USER and SMTP_PASSWORD)}
    destinatarios = destinatarios[:MAX_DESTINATARIOS]
    if not destinatarios:
        return resultado
    if not resultado["configurado"]:
        print(f"[CORREO OMITIDO] SMTP_USER/SMTP_PASSWORD no configurados ({etapa}, {len(destinatarios)} destinatario(s))")
        resultado["fallidos"] = len(destinatarios)
        return resultado

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10, context=ssl.create_default_context()) as smtp:
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            for email, nombre in destinatarios:
                try:
                    asunto, cuerpo, texto = construir_correo(etapa, nombre, incidencia_id, categoria)
                    msg = EmailMessage()
                    msg["Subject"] = asunto
                    msg["From"] = formataddr((MAIL_FROM_NAME, SMTP_USER))
                    msg["To"] = email
                    msg.set_content(texto)
                    msg.add_alternative(cuerpo, subtype="html")
                    smtp.send_message(msg)
                    resultado["enviados"].append(email)
                except Exception as e:  # un destinatario inválido no frena a los demás
                    resultado["fallidos"] += 1
                    print(f"ERROR correo ({etapa}) a {enmascarar_correo(email)}: {type(e).__name__}")
    except Exception as e:
        # conexión/login: solo el tipo de error, para no filtrar datos de la cuenta
        resultado["fallidos"] = len(destinatarios) - len(resultado["enviados"])
        print(f"ERROR SMTP ({etapa}): {type(e).__name__}")
    return resultado


def destinatarios_de(incidencia_id: str) -> list:
    """Correos únicos (con el nombre del primer reporte que los usó) de una incidencia."""
    filas = (
        supabase.table("reportes")
        .select("nombre_ciudadano, email_ciudadano")
        .eq("incidencia_id", str(incidencia_id))
        .order("created_at", desc=False)
        .execute()
        .data
    )
    vistos, lista = set(), []
    for f in filas:
        email = f.get("email_ciudadano")
        if email and email.lower() not in vistos:
            vistos.add(email.lower())
            lista.append((email, f.get("nombre_ciudadano")))
    return lista


def nombre_categoria_de(incidencia_id: str) -> Optional[str]:
    try:
        r = supabase.table("v_incidencias_admin").select("categoria_nombre").eq("id", str(incidencia_id)).execute().data
        return r[0]["categoria_nombre"] if r else None
    except Exception:
        return None


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
        if isinstance(v, str):
            v = v.strip()
            if v == "": return None
        return v

    @field_validator("nombre_ciudadano")
    @classmethod
    def validar_nombre(cls, v):
        if v is None:
            return v
        if len(v) < 2:
            raise ValueError("El nombre debe tener al menos 2 caracteres.")
        if not all(c.isalpha() or c in " '.-" for c in v) or sum(c.isalpha() for c in v) < 2:
            raise ValueError("El nombre solo puede contener letras, espacios, apóstrofo, punto y guion.")
        return v

    @field_validator("foto_url")
    @classmethod
    def validar_foto(cls, v):
        # Solo se aceptan fotos subidas al bucket público de este proyecto de Supabase
        if v is None or not SUPABASE_URL:
            return v
        prefijo = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/reportes-fotos/"
        if not v.startswith(prefijo):
            raise ValueError("La foto debe subirse al almacenamiento de la plataforma.")
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


@app.get("/api/incidencias", tags=["Ciudadano"])
def incidencias_publicas():
    """Pines del mapa ciudadano: solo activas y SIN datos personales
    (nada de id, fotos, direcciones, nombres, correos ni descripciones)."""
    try:
        res = (
            supabase.table("v_incidencias_admin")
            .select("categoria, categoria_nombre, estado, prioridad, reportes_count, lat, lon")
            .in_("estado", ["pendiente", "en_proceso"])
            .order("prioridad", desc=True)
            .execute()
        )
        return res.data
    except Exception as e:
        print(f"ERROR GET /api/incidencias: {e}")
        raise HTTPException(status_code=500, detail="Error interno al obtener las incidencias.")


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
        datos = response.data
    except Exception as e:
        error_msg = str(e)
        print(f"ERROR POST /api/reportes: {error_msg}")
        if "22023" in error_msg or "inválida" in error_msg.lower() or "inactiva" in error_msg.lower():
            raise HTTPException(status_code=422, detail=f"Datos inválidos: {error_msg}")
        raise HTTPException(status_code=500, detail="Error interno del servidor.")

    # Etapa 1: confirmación al ciudadano que reporta (si dejó correo). Un fallo de correo no afecta al reporte.
    if reporte.email_ciudadano and isinstance(datos, dict) and datos.get("incidencia_id"):
        envio = enviar_correos(
            "recibido",
            datos["incidencia_id"],
            [(str(reporte.email_ciudadano), reporte.nombre_ciudadano)],
            nombre_categoria_de(datos["incidencia_id"]),
        )
        datos = {**datos, "correo": "enviado" if envio["enviados"] else "no_enviado"}
    return datos


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
    respuesta = _cambiar_estado(payload.incidencia_id, "pendiente", "en_proceso", "Incidencia marcada en proceso.")
    # Etapa 2: aviso a los ciudadanos vinculados (un fallo de correo no revierte el cambio de estado)
    try:
        envio = enviar_correos(
            "en_proceso", str(payload.incidencia_id), destinatarios_de(payload.incidencia_id),
            nombre_categoria_de(payload.incidencia_id),
        )
    except Exception as e:
        print(f"ERROR avisos en proceso: {type(e).__name__}")
        envio = {"enviados": [], "fallidos": 0}
    return {**respuesta, "correos_notificados": envio["enviados"], "correos_fallidos": envio["fallidos"]}


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
    except Exception as e:
        error_msg = str(e)
        print(f"ERROR PATCH /resolver: {error_msg}")
        if "P0002" in error_msg or "cerrada" in error_msg.lower():
            raise HTTPException(status_code=409, detail="Incidencia no encontrada o ya cerrada.")
        raise HTTPException(status_code=500, detail="Error interno al resolver la incidencia.")

    # Etapa 3: aviso de atendido. La incidencia ya quedó cerrada, así que un fallo de correo no es un error de la operación.
    try:
        nombres = {email.lower(): nombre for email, nombre in destinatarios_de(payload.incidencia_id)}
        envio = enviar_correos(
            "atendida", payload.incidencia_id,
            [(c, nombres.get(c.lower())) for c in correos],
            nombre_categoria_de(payload.incidencia_id),
        )
    except Exception as e:
        print(f"ERROR avisos atendida: {type(e).__name__}")
        envio = {"enviados": [], "fallidos": len(correos)}
    return {
        "mensaje": "Incidencia marcada como atendida.",
        "correos_notificados": envio["enviados"],
        "correos_fallidos": envio["fallidos"],
    }


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