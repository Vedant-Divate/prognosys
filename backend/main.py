# backend/main.py
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import sensor_router, whatif_router, fmea_router
from backend.services.mqtt_service import start_mqtt, stop_mqtt


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: launch the MQTT subscriber in a background thread.
    Shutdown: cleanly disconnect the MQTT client.
    """
    print("[PrognoSys] Starting MQTT service...")
    await start_mqtt()
    print("[PrognoSys] MQTT service started.")
    yield
    print("[PrognoSys] Shutting down MQTT service...")
    await stop_mqtt()
    print("[PrognoSys] Shutdown complete.")


app = FastAPI(
    title="PrognoSys API",
    description="Digital Twin-Driven Predictive Maintenance for CNC Machine Tools",
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS — allow the React dev server and production frontend ────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(sensor_router.router)
app.include_router(whatif_router.router)
app.include_router(fmea_router.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "PrognoSys API"}