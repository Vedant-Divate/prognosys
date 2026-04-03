# backend/models/state_manager.py
import asyncio
from typing import List
from backend.models.schemas import MachineState


class StateManager:
    """
    Singleton that holds the current MachineState and broadcasts
    updates to all connected WebSocket clients.
    Uses asyncio.Lock to prevent race conditions between the MQTT
    ingestion thread and the WebSocket broadcast coroutine.
    """

    def __init__(self):
        self.state = MachineState()
        self.lock = asyncio.Lock()
        self.clients: List = []

    async def update_state(self, updates: dict):
        """
        Merge a dict of field updates into the current MachineState,
        then broadcast the new state to all connected clients.
        """
        async with self.lock:
            for key, value in updates.items():
                if hasattr(self.state, key):
                    setattr(self.state, key, value)
            await self.broadcast()

    async def broadcast(self):
        """
        Send the current MachineState as JSON to every connected
        WebSocket client. Uses dead-list pattern to safely remove
        disconnected clients without mutating the list mid-iteration.
        """
        payload = self.state.model_dump_json()
        dead = []
        for client in self.clients:
            try:
                await client.send_text(payload)
            except Exception:
                dead.append(client)
        for client in dead:
            self.clients.remove(client)

    def get_state_dict(self) -> dict:
        """
        Return the current state as a plain dict.
        Used by routers that need a snapshot without broadcasting.
        """
        return self.state.model_dump()


# Module-level singleton — import this instance across all routers and services
state_manager = StateManager()