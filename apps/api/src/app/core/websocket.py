"""WebSocket connection manager for real-time chat."""

import uuid
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections for chat rooms (matches)."""

    def __init__(self):
        # match_id -> set of (user_id, websocket) tuples
        self.active_connections: Dict[uuid.UUID, Set[tuple[uuid.UUID, WebSocket]]] = {}

    async def connect(
        self, websocket: WebSocket, match_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        """Connect a user to a chat room."""
        await websocket.accept()
        if match_id not in self.active_connections:
            self.active_connections[match_id] = set()
        self.active_connections[match_id].add((user_id, websocket))

    def disconnect(
        self, websocket: WebSocket, match_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        """Disconnect a user from a chat room."""
        if match_id in self.active_connections:
            self.active_connections[match_id].discard((user_id, websocket))
            if not self.active_connections[match_id]:
                del self.active_connections[match_id]

    async def send_to_match(
        self, match_id: uuid.UUID, message: dict, exclude_user: uuid.UUID | None = None
    ) -> None:
        """Send a message to all users in a match room."""
        if match_id not in self.active_connections:
            return

        for user_id, websocket in self.active_connections[match_id]:
            if exclude_user and user_id == exclude_user:
                continue
            try:
                await websocket.send_json(message)
            except Exception:
                # Connection closed, will be cleaned up
                pass

    async def send_to_user(
        self, match_id: uuid.UUID, user_id: uuid.UUID, message: dict
    ) -> None:
        """Send a message to a specific user in a match room."""
        if match_id not in self.active_connections:
            return

        for uid, websocket in self.active_connections[match_id]:
            if uid == user_id:
                try:
                    await websocket.send_json(message)
                except Exception:
                    pass


# Global connection manager instance
manager = ConnectionManager()
