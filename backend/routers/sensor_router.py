# backend/routers/sensor_router.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.models.state_manager import state_manager

router = APIRouter()


@router.websocket("/ws/machine-state")
async def machine_state_websocket(websocket: WebSocket):
    """
    WebSocket endpoint — clients connect here to receive live
    MachineState JSON broadcasts whenever a new MQTT message
    is processed by the backend.
    """
    await websocket.accept()
    state_manager.clients.append(websocket)
    print(f"[sensor_router] Client connected. Total clients: {len(state_manager.clients)}")

    # Send the current state immediately on connection
    # so the frontend does not show empty gauges on load
    await websocket.send_text(state_manager.state.model_dump_json())

    try:
        # Keep the connection alive — wait for client messages
        # (we don't expect any, but this prevents the coroutine from exiting)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        state_manager.clients.remove(websocket)
        print(f"[sensor_router] Client disconnected. Total clients: {len(state_manager.clients)}")


@router.get("/api/machine-state")
async def get_machine_state():
    """
    REST fallback — returns the current MachineState as JSON.
    Useful for the frontend to fetch initial state on page load
    before the WebSocket connection is established.
    """
    return state_manager.get_state_dict()