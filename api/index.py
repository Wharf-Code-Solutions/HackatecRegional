import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from supabase import create_client, Client

from dotenv import load_dotenv # <-- NUEVA LÍNEA

load_dotenv() # <-- NUEVA LÍNEA (Carga el .env en la memoria de Python)

app = FastAPI(title="API Hackatec Regional")

# 1. Conexión a Supabase (Usando la llave Service Role para saltar el RLS)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Evita que falle localmente si se nos olvida poner las variables en la terminal
if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 2. Modelo de Validación (Contrato con el Frontend)
class ReporteNuevo(BaseModel):
    categoria_id: int
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    descripcion: Optional[str] = Field(None, max_length=500)
    foto_url: Optional[str] = None
    email_ciudadano: Optional[EmailStr] = None

# 3. Health Check
@app.get("/api/health")
def health_check():
    return {"status": "online", "db_connected": bool(SUPABASE_URL)}

# 4. Endpoint Principal: Registrar Incidencia
@app.post("/api/reportes")
def registrar_incidencia(reporte: ReporteNuevo):
    # Mapeamos los datos de React a los parámetros "p_" que pide tu función SQL
    payload = {
        "p_categoria_id": reporte.categoria_id,
        "p_lat": reporte.lat,
        "p_lon": reporte.lon,
        "p_descripcion": reporte.descripcion if reporte.descripcion else None,
        "p_foto_url": reporte.foto_url if reporte.foto_url else None,
        "p_email": reporte.email_ciudadano
    }

    try:
        # Ejecutamos la función mágica de la base de datos
        response = supabase.rpc("registrar_incidencia", payload).execute()
        return response.data
    except Exception as e:
        error_msg = str(e)
        print(f"🔥 ERROR REAL: {error_msg}") # Esto lo imprimirá en tu consola
        
        # Capturamos el código 22023 (Coordenadas inválidas o Categoría inactiva)
        if "22023" in error_msg or "inválida" in error_msg.lower():
            raise HTTPException(status_code=422, detail=f"Error de validación: {error_msg}")
            
        # Temporalmente enviamos el error real a Swagger para leerlo si es otro tipo de error
        raise HTTPException(status_code=500, detail=f"Detalle técnico: {error_msg}")