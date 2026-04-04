# backend/main.py
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import routers and the state manager
from backend.routers import sensor_router, whatif_router, fmea_router
from backend.models.state_manager import state_manager
from backend.services.mqtt_service import start_mqtt, stop_mqtt

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. CRITICAL: Capture the running event loop for thread-safe state updates
    state_manager.loop = asyncio.get_running_loop()
    
    # 2. Start MQTT
    print("[PrognoSys] Starting MQTT service...")
    await start_mqtt()
    print("[PrognoSys] MQTT service started.")
    
    yield
    
    # 3. Shutdown
    print("[PrognoSys] Shutting down MQTT service...")
    await stop_mqtt()
    print("[PrognoSys] Shutdown complete.")

app = FastAPI(
    title="PrognoSys API",
    description="Digital Twin-Driven Predictive Maintenance for CNC Machine Tools",
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS — allow React dev servers ────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Simplified for hackathon development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────
# inside backend/main.py
app.include_router(sensor_router.router, prefix="/api/sensor", tags=["sensors"])
app.include_router(whatif_router.router)
app.include_router(fmea_router.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "PrognoSys API"}