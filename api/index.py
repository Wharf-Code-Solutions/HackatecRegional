from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Vercel requiere que la instancia se llame 'app'
app = FastAPI(docs_url="/api/docs", openapi_url="/api/openapi.json")

# Evitar problemas de CORS entre tu React y tu FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def read_root():
    return {"status": "online", "message": "Motor FastAPI inicializado en Vercel"}

# Aquí agregaremos después tu ruta para el envío de correos
@app.post("/api/notificar-cierre")
def enviar_notificacion():
    return {"status": "pendiente", "message": "Módulo de correos por construir"}