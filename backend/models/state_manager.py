# backend/models/state_manager.py
import asyncio
from typing import List
from fastapi import WebSocket
from backend.models.schemas import MachineState

class StateManager:
    """
    Singleton that holds the current MachineState and broadcasts
    updates to all connected WebSocket clients.
    """

    def __init__(self):
        self.state = MachineState()
        self.lock = asyncio.Lock()
        self.subscribers: List[WebSocket] = [] # Changed 'clients' to 'subscribers'
        self.loop: asyncio.AbstractEventLoop = None # Added for thread-safety

    async def get_current_state(self) -> MachineState:
        """
        Returns the current MachineState object.
        """
        async with self.lock:
            return self.state

    def update_state_from_thread(self, updates: dict):
        """
        Special method for the MQTT thread to update state 
        without crashing the asyncio loop.
        """
        if self.loop is None:
            return

        # Schedule the update on the main event loop
        asyncio.run_coroutine_threadsafe(self.update_state(updates), self.loop)

    async def update_state(self, updates: dict):
        """
        Merge updates and broadcast to WebSockets.
        """
        async with self.lock:
            for key, value in updates.items():
                if hasattr(self.state, key):
                    setattr(self.state, key, value)
        
        await self.broadcast()

    async def broadcast(self):
        """
        Send current state to all connected WebSockets.
        """
        payload = self.state.model_dump_json()
        dead = []
        # We iterate over a copy to avoid mutation errors
        for client in list(self.subscribers):
            try:
                await client.send_text(payload)
            except Exception:
                dead.append(client)
        
        for client in dead:
            if client in self.subscribers:
                self.subscribers.remove(client)

    def get_state_dict(self) -> dict:
        return self.state.model_dump()

# Module-level singleton
state_manager = StateManager()