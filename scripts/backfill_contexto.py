"""Completa dirección, colonia, municipio y bonus de entorno de las incidencias que aún no los tienen.

Uso (desde la raíz del repo; requiere db/004 y db/005 aplicados en Supabase):
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VITE_MAPBOX_TOKEN=... python scripts/backfill_contexto.py
    ... python scripts/backfill_contexto.py --solo-ver      # solo muestra qué haría

Usa las mismas funciones que el backend (api/index.py) y hace una pausa entre incidencias
para no rozar el límite de peticiones de Mapbox. Es seguro repetirlo: solo toca lo que falta.
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
import index  # noqa: E402  (carga las credenciales del entorno)

SOLO_VER = "--solo-ver" in sys.argv


def faltantes():
    filas = index.supabase.table("v_incidencias_admin").select("*").order("created_at").execute().data
    for f in filas:
        if not index.dentro_de_mexico(f["lat"], f["lon"]):
            print(f"  omitida {f['id'][:8]}: fuera de México ({f['lat']}, {f['lon']})")
            continue
        # Falta algo si no hay dirección, o (con db/005 aplicado) no hay colonia
        if not f.get("direccion") or ("colonia" in f and not f.get("colonia")):
            yield f


def main():
    pendientes = list(faltantes())
    print(f"{len(pendientes)} incidencia(s) por completar")
    for f in pendientes:
        ctx = index.calcular_contexto(f["lat"], f["lon"])
        resumen = f"{f['id'][:8]} {f['categoria']:12s} | {ctx['colonia']} / {ctx['municipio']} | +{ctx['bonus']} | {ctx['direccion']}"
        if SOLO_VER:
            print("  (ver)", resumen)
        else:
            nueva = index.aplicar_contexto(f["id"], ctx)
            print("  ok   ", resumen, f"| prioridad -> {nueva}" if nueva is not None else "")
        time.sleep(0.8)


if __name__ == "__main__":
    main()
