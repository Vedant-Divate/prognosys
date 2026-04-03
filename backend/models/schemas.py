# backend/models/schemas.py
from pydantic import BaseModel, Field
from typing import List, Dict, Optional


# ── Inbound: raw sensor reading arriving from MQTT ───────────────────────────
class SensorReading(BaseModel):
    timestamp: str = ""
    vibration_rms: float = 0.0
    spindle_load: float = 0.0
    temperature_c: float = 0.0
    tool_life_pct: float = 100.0
    fault_class: Optional[str] = "normal"


# ── Core: the full machine state broadcast over WebSocket ────────────────────
class MachineState(BaseModel):
    machine_id: str = "CNC-01"
    timestamp: str = ""
    vibration_rms: float = 0.0
    spindle_load: float = 0.0
    temperature_c: float = 0.0
    tool_life_pct: float = 0.0
    health_score: float = 100.0
    rul_hours: float = 168.0
    is_anomaly: bool = False
    anomaly_score: float = 0.0
    lstm_anomaly: bool = False
    lstm_error: float = 0.0
    anomaly_flags: List[str] = []
    subsystem_states: Dict[str, str] = {
        "spindle": "green",
        "bearing": "green",
        "coolant": "green",
        "tool":    "green"
    }
    deterioration_trajectory: List[dict] = []


# ── What-If: request and response for POST /api/what-if ─────────────────────
class WhatIfRequest(BaseModel):
    vibration_rms: float = Field(..., ge=0.5,  le=10.0)
    spindle_load:  float = Field(..., ge=0.0,  le=150.0)
    temperature_c: float = Field(..., ge=20.0, le=120.0)
    tool_life_pct: float = Field(..., ge=0.0,  le=100.0)


class WhatIfResponse(BaseModel):
    health_score:        float
    rul_hours:           float
    anomaly_probability: float
    subsystem_states:    Dict[str, str]
    warnings:            List[str]


# ── FMEA: response for GET /api/fmea/{anomaly_flag} ─────────────────────────
class RootCauseModel(BaseModel):
    name:             str
    description:      str
    detection_method: str


class CorrectiveActionModel(BaseModel):
    name:           str
    steps:          List[str]
    urgency:        str
    downtime_hours: float
    spare_parts:    List[str]


class FMEAResponse(BaseModel):
    failure_mode:       str
    severity:           str
    affected_subsystem: str
    root_causes:        List[RootCauseModel]
    corrective_actions: List[CorrectiveActionModel]


# ── Simulation: one point in the deterioration trajectory ───────────────────
class TrajectoryPoint(BaseModel):
    hour:          int
    vibration_rms: float
    spindle_load:  float
    temperature_c: float
    tool_life_pct: float
    health_score:  float
    rul_hours:     float
    status:        str