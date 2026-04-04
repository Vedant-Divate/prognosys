# backend/routers/sensor_router.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.models.state_manager import state_manager

router = APIRouter()

@router.websocket("/ws/machine-state")
async def machine_state_websocket(websocket: WebSocket):
    await websocket.accept()
    # Ensure your StateManager has a 'subscribers' or 'clients' list
    if not hasattr(state_manager, 'subscribers'):
        state_manager.subscribers = []
    
    state_manager.subscribers.append(websocket)
    print(f"[sensor_router] WebSocket connected. Active: {len(state_manager.subscribers)}")

    # Send initial state
    current = await state_manager.get_current_state()
    await websocket.send_text(current.model_dump_json())

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        state_manager.subscribers.remove(websocket)
        print(f"[sensor_router] WebSocket disconnected.")

@router.get("/live") # This becomes /api/sensor/live when prefixed in main.py
async def get_machine_state():
    """
    Returns the current MachineState as JSON.
    """
    return await state_manager.get_current_state()