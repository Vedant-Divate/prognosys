# backend/services/ml_service.py
import numpy as np
import joblib
import onnxruntime as ort
import pandas as pd
import os
from collections import deque
from backend.models.schemas import MachineState

# ── Robust Path Resolution ──────────────────────────────────────────────────
# Get the absolute path to the 'models' folder relative to this script
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../models"))

def get_model_path(filename):
    return os.path.join(BASE_DIR, filename)

SCALER_PATH         = get_model_path("scaler.pkl")
ISOLATION_PATH      = get_model_path("isolation_forest.pkl")
WHAT_IF_PATH        = get_model_path("what_if_model.pkl")
LSTM_ONNX_PATH      = get_model_path("lstm_autoencoder.onnx")
LSTM_SCALER_PATH    = get_model_path("lstm_scaler.pkl")
LSTM_THRESHOLD_PATH = get_model_path("lstm_threshold.npy")

# ── Load all models at module import time ────────────────────────────────────
print(f"[ml_service] Loading models from: {BASE_DIR}")
scaler          = joblib.load(SCALER_PATH)
iso_forest      = joblib.load(ISOLATION_PATH)
what_if_model   = joblib.load(WHAT_IF_PATH)
lstm_scaler     = joblib.load(LSTM_SCALER_PATH)
lstm_threshold  = float(np.load(LSTM_THRESHOLD_PATH))

# Use CPU provider explicitly
lstm_session    = ort.InferenceSession(LSTM_ONNX_PATH, providers=['CPUExecutionProvider'])

print(f"[ml_service] All models loaded. LSTM threshold: {lstm_threshold:.6f}")

# ── Sliding window buffer (30 timesteps x 4 features) ───────────────────────
SEQ_LEN = 30
FEATURES = ["vibration_rms", "spindle_load", "temperature_c", "tool_life_pct"]
_sequence_buffer = deque(maxlen=SEQ_LEN)

def _compute_subsystem_states(vib: float, load: float, temp: float, tool: float) -> dict:
    bearing = "red" if vib > 4.5 else "amber" if vib > 3.0 else "green"
    spindle = "red" if (load > 85 and temp > 80) else "amber" if (load > 75 or temp > 75) else "green"
    tool_st = "red" if tool < 20 else "amber" if tool < 40 else "green"
    coolant = "red" if temp > 85 else "amber" if temp > 75 else "green"
    return {"spindle": spindle, "bearing": bearing, "coolant": coolant, "tool": tool_st}

def _compute_anomaly_flags(sub_states: dict, is_iso: bool, is_lstm: bool) -> list:
    flags = []
    if sub_states["bearing"] in ("red", "amber"): flags.append("bearing_wear")
    if sub_states["coolant"] in ("red", "amber"): flags.append("thermal_overload")
    if sub_states["tool"] in ("red", "amber"): flags.append("tool_worn")
    if sub_states["spindle"] in ("red", "amber"): flags.append("spindle_vibration")
    if is_iso and is_lstm: flags.append("composite_fault")
    return flags

def run_inference(reading: dict) -> dict:
    vib   = float(reading.get("vibration_rms", 0.0))
    load  = float(reading.get("spindle_load",  0.0))
    temp  = float(reading.get("temperature_c", 0.0))
    tool  = float(reading.get("tool_life_pct", 100.0))

    features_array = np.array([[vib, load, temp, tool]])
    features_df = pd.DataFrame(features_array, columns=FEATURES)

    # 1. Isolation Forest
    scaled = scaler.transform(features_df)
    iso_score = iso_forest.decision_function(scaled)[0]
    anomaly_score = float(np.clip(1.0 - (iso_score + 0.5), 0.0, 1.0))
    is_anomaly = bool(iso_forest.predict(scaled)[0] == -1)

    # 2. LSTM Autoencoder (ONNX)
    _sequence_buffer.append([vib, load, temp, tool])
    lstm_anomaly, lstm_error = False, 0.0
    if len(_sequence_buffer) == SEQ_LEN:
        seq_np = np.array(list(_sequence_buffer))
        seq_scaled = lstm_scaler.transform(seq_np).astype(np.float32)
        seq_input = np.expand_dims(seq_scaled, axis=0)
        
        # Run ONNX inference
        input_name = lstm_session.get_inputs()[0].name
        ort_out = lstm_session.run(None, {input_name: seq_input})[0]
        
        lstm_error = float(np.mean((ort_out - seq_input) ** 2))
        lstm_anomaly = bool(lstm_error > lstm_threshold)

    # 3. Ridge Regression Predictions
    #features_df = pd.DataFrame(features_array, columns=FEATURES)
    preds = what_if_model.predict(features_df)[0]
    
    sub_states = _compute_subsystem_states(vib, load, temp, tool)
    return {
        "vibration_rms": vib, "spindle_load": load, "temperature_c": temp, "tool_life_pct": tool,
        "health_score": round(float(np.clip(preds[0], 0, 100)), 1),
        "rul_hours": round(float(np.clip(preds[1], 0, 999)), 1),
        "is_anomaly": is_anomaly, "anomaly_score": round(anomaly_score, 3),
        "lstm_anomaly": lstm_anomaly, "lstm_error": round(lstm_error, 6),
        "subsystem_states": sub_states,
        "anomaly_flags": _compute_anomaly_flags(sub_states, is_anomaly, lstm_anomaly),
    }