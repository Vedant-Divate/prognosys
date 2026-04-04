# mqtt_simulator.py
import pandas as pd
import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion
import json
import time
import argparse
import sys
import os


def main():
    parser = argparse.ArgumentParser(description="PrognoSys MQTT Telemetry Simulator")
    parser.add_argument("--rate",  type=float, default=1.0,
                        help="Messages per second (default: 1.0)")
    parser.add_argument("--fault", type=str,
                        choices=["bearing_wear", "thermal_overload",
                                 "tool_worn", "composite_fault"],
                        help="Start from first row of this fault type")
    parser.add_argument("--host", type=str, default="localhost")
    parser.add_argument("--port", type=int, default=1883)
    args = parser.parse_args()

    # ── Connect to broker ────────────────────────────────────────────────────
    client = mqtt.Client(CallbackAPIVersion.VERSION2)

    def on_connect(client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            print(f"[simulator] Connected to broker at {args.host}:{args.port}")
        else:
            print(f"[simulator] Connection failed: {reason_code}")
            sys.exit(1)

    client.on_connect = on_connect

    try:
        client.connect(args.host, args.port, 60)
        client.loop_start()
        time.sleep(0.5)  # wait for on_connect to fire
    except Exception as e:
        print(f"[simulator] Error connecting to MQTT broker at {args.host}:{args.port}")
        print(f"[simulator] Is the Mosquitto broker running? Error: {e}")
        sys.exit(1)

    # ── Load dataset ─────────────────────────────────────────────────────────
    csv_path = os.path.join(os.path.dirname(__file__), "data", "cnc_telemetry_2000.csv")
    if not os.path.exists(csv_path):
        print(f"[simulator] Dataset not found at {csv_path}")
        print("[simulator] Run ml/generator.py first.")
        sys.exit(1)

    df = pd.read_csv(csv_path)
    current_row = 0

    # ── Fault injection: jump to first row of fault type ────────────────────
    if args.fault:
        fault_rows = df[df["fault_class"] == args.fault]
        if fault_rows.empty:
            print(f"[simulator] No rows found for fault type: {args.fault}")
        else:
            current_row = fault_rows.index[0]
            print(f"[simulator] Injecting fault: {args.fault} — starting at row {current_row}")

    print(f"[simulator] Streaming at {args.rate} msg/s. Press Ctrl+C to stop.\n")

    # ── Main publish loop ────────────────────────────────────────────────────
    try:
        while True:
            row = df.iloc[current_row].to_dict()

            # Publish only sensor fields — not fault_class label
            payload = {
                "timestamp":     row.get("timestamp", ""),
                "vibration_rms": round(float(row["vibration_rms"]), 4),
                "spindle_load":  round(float(row["spindle_load"]),  2),
                "temperature_c": round(float(row["temperature_c"]), 2),
                "tool_life_pct": round(float(row["tool_life_pct"]), 2),
            }

            client.publish("cnc/machine01/telemetry", json.dumps(payload))

            if current_row % 10 == 0:
                print(
                    f"Row {current_row:4d} | "
                    f"{row['fault_class']:20s} | "
                    f"Vib: {row['vibration_rms']:5.2f} mm/s | "
                    f"Load: {row['spindle_load']:5.1f}% | "
                    f"Temp: {row['temperature_c']:5.1f}°C | "
                    f"Tool: {row['tool_life_pct']:5.1f}%"
                )

            current_row = (current_row + 1) % len(df)
            time.sleep(1.0 / args.rate)

    except KeyboardInterrupt:
        print("\n[simulator] Stopped by user.")
        client.loop_stop()
        client.disconnect()
        print("[simulator] Disconnected cleanly.")


if __name__ == "__main__":
    main()