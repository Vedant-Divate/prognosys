# ml/generator.py
import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta

def generate_cnc_telemetry(n_samples=2000, seed=42, fault_free=False):
    """
    Generates synthetic CNC sensor time-series data with physics-informed
    fault injections for vibration, load, temperature, and tool life.
    """
    np.random.seed(seed)

    # Configuration Constants
    BASELINE_VIB = (1.2, 2.8)
    BASELINE_LOAD = (55, 75)
    BASELINE_TEMP = (62, 72)
    VIB_NOISE_STD = 0.15
    LOAD_NOISE_STD = 2.0
    TEMP_NOISE_STD = 0.8

    # Initialization
    timestamps = [datetime.now() + timedelta(seconds=i) for i in range(n_samples)]
    vibration = np.random.uniform(BASELINE_VIB[0], BASELINE_VIB[1], n_samples)
    spindle_load = np.random.uniform(BASELINE_LOAD[0], BASELINE_LOAD[1], n_samples)
    temperature = np.random.uniform(BASELINE_TEMP[0], BASELINE_TEMP[1], n_samples)
    tool_life = np.ones(n_samples) * 100.0
    labels = ["normal"] * n_samples

    # Fault Injection Parameters
    bearing_wear_start = 1200
    coolant_failure_start = 1600

    if fault_free:
        bearing_wear_start = 99999
        coolant_failure_start = 99999

    for i in range(1, n_samples):
        # 1. Base Noise and Normal Drift
        vibration[i] += np.random.normal(0, VIB_NOISE_STD)
        spindle_load[i] += np.random.normal(0, LOAD_NOISE_STD)
        temperature[i] += np.random.normal(0, TEMP_NOISE_STD)

        # 2. Tool Life Depletion Logic (Taylor-derived)
        current_depletion = np.random.uniform(0.04, 0.07)
        if spindle_load[i] > 80:
            current_depletion = np.random.uniform(0.12, 0.18)
        tool_life[i] = max(0, tool_life[i - 1] - current_depletion)

        # 3. Bearing Wear Injection (Vibration Drift)
        if i >= bearing_wear_start:
            # Progressive rise toward 7.0 over 400 samples
            drift = (i - bearing_wear_start) * (4.2 / 400)
            vibration[i] += drift
            labels[i] = "bearing_wear"
            # Mechanical Correlation: High vibration increases spindle load
            if vibration[i] > 4.0:
                spindle_load[i] += (vibration[i] - 4.0) * 8.0

        # 4. Thermal Coupling and Coolant Failure
        # Standard coupling: 0.12 deg per % load > 70
        if spindle_load[i] > 70:
            temperature[i] += 0.12 * (spindle_load[i] - 70)

        if i >= coolant_failure_start:
            # Coolant failure drives temp above 85 within 50 samples
            temp_drift = (i - coolant_failure_start) * 0.5
            temperature[i] += temp_drift
            if labels[i] == "bearing_wear":
                labels[i] = "composite_fault"
            else:
                labels[i] = "thermal_overload"

        # 5. Tool Worn Threshold
        if tool_life[i] < 5:
            if labels[i] == "normal":
                labels[i] = "tool_worn"
            elif labels[i] != "tool_worn":
                labels[i] = "composite_fault"

    # Assemble DataFrame
    df = pd.DataFrame({
        "timestamp": [t.isoformat() for t in timestamps],
        "vibration_rms": vibration,
        "spindle_load": spindle_load,
        "temperature_c": temperature,
        "tool_life_pct": tool_life,
        "fault_class": labels
    })
    return df


# Execution
if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)

    full_df = generate_cnc_telemetry(2000)
    full_df.to_csv("data/cnc_telemetry_2000.csv", index=False)

    # Generate separate healthy baseline (200 samples)
    healthy_df = generate_cnc_telemetry(200, seed=101, fault_free=True)
    healthy_df.to_csv("data/healthy_baseline.csv", index=False)

    print("Synthetic data generation complete.")
    print(f"Full dataset shape: {full_df.shape}")
    print(f"Healthy baseline shape: {healthy_df.shape}")
    print(f"\nFault class distribution:")
    print(full_df['fault_class'].value_counts())
