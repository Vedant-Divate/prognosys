# backend/services/mqtt_service.py
import json
import asyncio
import threading
import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

from backend.models.state_manager import state_manager
from backend.services.ml_service import run_inference

# ── Configuration ─────────────────────────────────────────────────────────────
MQTT_BROKER   = "localhost"
MQTT_PORT     = 1883
MQTT_TOPIC    = "cnc/machine01/telemetry"
RECONNECT_DELAY = 5  # seconds between reconnection attempts

# ── Module-level client reference ────────────────────────────────────────────
_mqtt_client: mqtt.Client = None
_loop: asyncio.AbstractEventLoop = None


def _on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print(f"[mqtt_service] Connected to broker at {MQTT_BROKER}:{MQTT_PORT}")
        client.subscribe(MQTT_TOPIC)
        print(f"[mqtt_service] Subscribed to topic: {MQTT_TOPIC}")
    else:
        print(f"[mqtt_service] Connection failed with code: {reason_code}")


def _on_disconnect(client, userdata, flags, reason_code, properties):
    print(f"[mqtt_service] Disconnected (code: {reason_code}). Reconnecting in {RECONNECT_DELAY}s...")


def _on_message(client, userdata, msg):
    """
    Called on every incoming MQTT message.
    Runs in the Paho background thread — schedules the async
    state update onto the main event loop using thread-safe call.
    """
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
        result  = run_inference(payload)

        # Add timestamp from payload if available
        if "timestamp" in payload:
            result["timestamp"] = payload["timestamp"]

        # Schedule the coroutine on the main asyncio event loop
        if _loop and not _loop.is_closed():
            asyncio.run_coroutine_threadsafe(
                state_manager.update_state(result),
                _loop
            )
    except json.JSONDecodeError as e:
        print(f"[mqtt_service] JSON decode error: {e}")
    except Exception as e:
        print(f"[mqtt_service] Error processing message: {e}")


def _mqtt_thread():
    """
    Runs the Paho network loop in a dedicated background thread.
    loop_forever() handles reconnection automatically.
    """
    global _mqtt_client
    _mqtt_client = mqtt.Client(CallbackAPIVersion.VERSION2)
    _mqtt_client.on_connect    = _on_connect
    _mqtt_client.on_disconnect = _on_disconnect
    _mqtt_client.on_message    = _on_message

    _mqtt_client.reconnect_delay_set(
        min_delay=1,
        max_delay=30
    )

    try:
        _mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        _mqtt_client.loop_forever()
    except Exception as e:
        print(f"[mqtt_service] Could not connect to broker: {e}")
        print("[mqtt_service] Backend will run without live MQTT data.")


async def start_mqtt():
    """
    Called by FastAPI lifespan on startup.
    Captures the running event loop then starts the MQTT thread.
    """
    global _loop
    _loop = asyncio.get_event_loop()
    thread = threading.Thread(target=_mqtt_thread, daemon=True)
    thread.start()


async def stop_mqtt():
    """
    Called by FastAPI lifespan on shutdown.
    """
    global _mqtt_client
    if _mqtt_client:
        _mqtt_client.disconnect()
        print("[mqtt_service] MQTT client disconnected.")