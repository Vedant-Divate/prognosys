# backend/routers/whatif_router.py
from fastapi import APIRouter, HTTPException
import numpy as np
import pandas as pd
from backend.models.schemas import WhatIfRequest, WhatIfResponse
from backend.services.ml_service import what_if_model, FEATURES

router = APIRouter()

# Model is imported directly from ml_service where it is already
# loaded at startup — no second joblib.load() call needed here.


def _physics_subsystem_states(vib: float, load: float, temp: float, tool: float) -> dict:
    bearing = (
        "red"   if vib > 4.5  else
        "amber" if vib > 3.0  else
        "green"
    )
    spindle = (
        "red"   if (load > 85 and temp > 80) else
        "amber" if (load > 75 or  temp > 75) else
        "green"
    )
    tool_st = (
        "red"   if tool < 20 else
        "amber" if tool < 40 else
        "green"
    )
    coolant = (
        "red"   if temp > 85 else
        "amber" if temp > 75 else
        "green"
    )
    return {
        "spindle": spindle,
        "bearing": bearing,
        "coolant": coolant,
        "tool":    tool_st
    }


def _build_warnings(vib: float, load: float, temp: float, tool: float, states: dict) -> list:
    warnings = []
    if states["bearing"] == "red":
        warnings.append(f"CRITICAL: Bearing vibration at {vib:.1f} mm/s exceeds safe limit of 4.5 mm/s")
    elif states["bearing"] == "amber":
        warnings.append(f"WARNING: Bearing vibration at {vib:.1f} mm/s approaching limit (3.0 mm/s)")
    if temp > 85:
        warnings.append(f"CRITICAL: Temperature {temp:.1f}°C exceeds safe limit. Cooling efficiency compromised.")
    elif temp > 75:
        warnings.append(f"WARNING: Temperature {temp:.1f}°C elevated. Monitor coolant flow.")
    if states["tool"] == "red":
        warnings.append(f"CRITICAL: Tool life at {tool:.1f}%. Schedule immediate tool change.")
    elif states["tool"] == "amber":
        warnings.append(f"WARNING: Tool life at {tool:.1f}%. Plan tool change within 8 hours.")
    if states["spindle"] == "red":
        warnings.append(f"CRITICAL: Spindle overload — load {load:.1f}% at {temp:.1f}°C.")
    return warnings


@router.post("/api/what-if", response_model=WhatIfResponse)
async def predict_what_if(req: WhatIfRequest):
    """
    Uses the already-loaded Ridge model from ml_service.
    No disk I/O on this path — sub-10ms guaranteed after startup.
    """
    features_df = pd.DataFrame(
        [[req.vibration_rms, req.spindle_load, req.temperature_c, req.tool_life_pct]],
        columns=FEATURES
    )

    try:
        preds = what_if_model.predict(features_df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")

    health_score        = round(float(np.clip(preds[0][0], 0.0, 100.0)), 1)
    rul_hours           = round(float(np.clip(preds[0][1], 0.0, 999.0)), 1)
    anomaly_probability = round(float(np.clip(preds[0][2], 0.0, 1.0)),   3)

    states   = _physics_subsystem_states(
        req.vibration_rms, req.spindle_load,
        req.temperature_c, req.tool_life_pct
    )
    warnings = _build_warnings(
        req.vibration_rms, req.spindle_load,
        req.temperature_c, req.tool_life_pct,
        states
    )

    return WhatIfResponse(
        health_score        = health_score,
        rul_hours           = rul_hours,
        anomaly_probability = anomaly_probability,
        subsystem_states    = states,
        warnings            = warnings
    )