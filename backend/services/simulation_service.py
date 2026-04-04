# backend/services/simulation_service.py
import numpy as np
import pandas as pd
from typing import List
from backend.services.ml_service import what_if_model, FEATURES


def generate_deterioration_trajectory(
    current_vibration: float,
    current_spindle_load: float,
    current_temperature: float,
    current_tool_life: float,
    hours: int = 168
) -> List[dict]:
    """
    Projects machine health forward in time using physics-informed
    deterioration rules from the blueprint:

    1. Vibration: +0.04 mm/s per 24hr. Exponential after 48hr.
    2. Tool Life: -15% per 24hr linear depletion.
    3. Temperature: +0.02°C per unit of vibration increase (thermal coupling).
    4. Spindle Load: +0.5% per °C above 72°C.

    For each 24-hour step, projects values are fed to the Ridge model
    to generate future health_score and rul_hours estimates.
    Returns a list of TrajectoryPoint dicts covering 0 to `hours`.
    """
    trajectory = []

    vib  = float(current_vibration)
    load = float(current_spindle_load)
    temp = float(current_temperature)
    tool = float(current_tool_life)

    # Step size — one point every 24 hours
    step_hours = 24
    n_steps = hours // step_hours

    for step in range(n_steps + 1):
        hour = step * step_hours

        if step > 0:
            # ── 1. Vibration deterioration ───────────────────────────────
            if hour <= 48:
                # Linear phase
                vib_delta = 0.04
            else:
                # Exponential phase after 48 hours
                vib_delta = 0.04 * np.exp(0.02 * (hour - 48))

            prev_vib = vib
            vib = float(np.clip(vib + vib_delta, 0.0, 15.0))

            # ── 2. Tool life depletion ────────────────────────────────────
            tool = float(np.clip(tool - 15.0, 0.0, 100.0))

            # ── 3. Thermal coupling ───────────────────────────────────────
            vib_increase = vib - prev_vib
            temp = float(np.clip(temp + 0.02 * vib_increase, 0.0, 150.0))

            # ── 4. Spindle load coupling ──────────────────────────────────
            if temp > 72:
                load = float(np.clip(load + 0.5 * (temp - 72), 0.0, 150.0))

        # ── Ridge prediction for this timestep ───────────────────────────
        features_df = pd.DataFrame(
            [[vib, load, temp, tool]],
            columns=FEATURES
        )
        preds        = what_if_model.predict(features_df)[0]
        health_score = float(np.clip(preds[0], 0.0, 100.0))
        rul_hours    = float(np.clip(preds[1], 0.0, 999.0))

        # ── Status label ─────────────────────────────────────────────────
        if health_score >= 70:
            status = "healthy"
        elif health_score >= 40:
            status = "degraded"
        else:
            status = "critical"

        trajectory.append({
            "hour":          hour,
            "vibration_rms": round(vib,  3),
            "spindle_load":  round(load, 2),
            "temperature_c": round(temp, 2),
            "tool_life_pct": round(tool, 2),
            "health_score":  round(health_score, 1),
            "rul_hours":     round(rul_hours, 1),
            "status":        status
        })

    return trajectory