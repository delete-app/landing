"""Chat API: WebSocket and REST endpoints for messaging."""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_user_id
from app.core.websocket import manager
from app.db.session import get_db
from app.services import chat as chat_service


router = APIRouter(prefix="/chat", tags=["chat"])


# Schemas
class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: uuid.UUID
    match_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    created_at: datetime
    read_at: datetime | None
    is_own: bool  # True if current user sent this message

    model_config = {"from_attributes": True}


class MessagesResponse(BaseModel):
    messages: list[MessageResponse]
    has_more: bool


class UnreadCountResponse(BaseModel):
    unread_count: int


# WebSocket authentication helper
async def get_user_id_from_token(token: str) -> str | None:
    """Extract user ID from JWT token for WebSocket auth."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except JWTError:
        return None


# REST Endpoints
@router.get("/matches/{match_id}/messages", response_model=MessagesResponse)
async def get_messages(
    match_id: uuid.UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=100),
    before: uuid.UUID | None = Query(None),
) -> MessagesResponse:
    """Get message history for a match."""
    user_uuid = uuid.UUID(user_id)

    # Verify access
    if not await chat_service.verify_match_access(db, match_id, user_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this conversation"
        )

    messages = await chat_service.get_messages(db, match_id, limit + 1, before)
    has_more = len(messages) > limit
    if has_more:
        messages = messages[1:]  # Remove oldest if we got more than limit

    return MessagesResponse(
        messages=[
            MessageResponse(
                id=msg.id,
                match_id=msg.match_id,
                sender_id=msg.sender_id,
                content=msg.content,
                created_at=msg.created_at,
                read_at=msg.read_at,
                is_own=msg.sender_id == user_uuid
            )
            for msg in messages
        ],
        has_more=has_more
    )


@router.post("/matches/{match_id}/messages", response_model=MessageResponse)
async def send_message(
    match_id: uuid.UUID,
    message_in: MessageCreate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Send a message (REST fallback, prefer WebSocket)."""
    user_uuid = uuid.UUID(user_id)

    if not message_in.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty"
        )

    # Verify access
    if not await chat_service.verify_match_access(db, match_id, user_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to send messages to this conversation"
        )

    message = await chat_service.create_message(db, match_id, user_uuid, message_in.content.strip())

    # Broadcast via WebSocket to other users in the match
    await manager.send_to_match(
        match_id,
        {
            "type": "new_message",
            "message": {
                "id": str(message.id),
                "match_id": str(message.match_id),
                "sender_id": str(message.sender_id),
                "content": message.content,
                "created_at": message.created_at.isoformat(),
                "read_at": None,
            }
        },
        exclude_user=user_uuid
    )

    return MessageResponse(
        id=message.id,
        match_id=message.match_id,
        sender_id=message.sender_id,
        content=message.content,
        created_at=message.created_at,
        read_at=message.read_at,
        is_own=True
    )


@router.post("/matches/{match_id}/read")
async def mark_read(
    match_id: uuid.UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Mark all messages in a match as read."""
    user_uuid = uuid.UUID(user_id)

    if not await chat_service.verify_match_access(db, match_id, user_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )

    count = await chat_service.mark_messages_read(db, match_id, user_uuid)

    # Notify other users that messages were read
    partner_id = await chat_service.get_match_partner_id(db, match_id, user_uuid)
    if partner_id:
        await manager.send_to_user(
            match_id,
            partner_id,
            {"type": "messages_read", "reader_id": str(user_uuid)}
        )

    return {"marked_read": count}


@router.get("/matches/{match_id}/unread", response_model=UnreadCountResponse)
async def get_unread_count(
    match_id: uuid.UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UnreadCountResponse:
    """Get unread message count for a match."""
    user_uuid = uuid.UUID(user_id)

    if not await chat_service.verify_match_access(db, match_id, user_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )

    count = await chat_service.get_unread_count(db, match_id, user_uuid)
    return UnreadCountResponse(unread_count=count)


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: uuid.UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Delete a message (soft delete, sender only)."""
    user_uuid = uuid.UUID(user_id)

    success = await chat_service.delete_message(db, message_id, user_uuid)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or not authorized to delete"
        )

    return {"deleted": True}


# WebSocket Endpoint
@router.websocket("/ws/{match_id}")
async def websocket_chat(
    websocket: WebSocket,
    match_id: uuid.UUID,
    token: str = Query(...),
):
    """
    WebSocket endpoint for real-time chat.

    Connect with: ws://host/v1/chat/ws/{match_id}?token={access_token}

    Message format (send):
    {"type": "message", "content": "Hello!"}
    {"type": "typing"}
    {"type": "read"}

    Message format (receive):
    {"type": "new_message", "message": {...}}
    {"type": "typing", "user_id": "..."}
    {"type": "messages_read", "reader_id": "..."}
    """
    # Authenticate
    user_id_str = await get_user_id_from_token(token)
    if not user_id_str:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = uuid.UUID(user_id_str)

    # Get database session
    from app.db.session import async_session_maker
    async with async_session_maker() as db:
        # Verify match access
        if not await chat_service.verify_match_access(db, match_id, user_id):
            await websocket.close(code=4003, reason="Not authorized for this conversation")
            return

        partner_id = await chat_service.get_match_partner_id(db, match_id, user_id)

    # Connect to room
    await manager.connect(websocket, match_id, user_id)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "message":
                content = data.get("content", "").strip()
                if not content:
                    await websocket.send_json({"type": "error", "message": "Empty message"})
                    continue

                # Save message
                async with async_session_maker() as db:
                    message = await chat_service.create_message(db, match_id, user_id, content)

                # Broadcast to room (including sender for confirmation)
                await manager.send_to_match(
                    match_id,
                    {
                        "type": "new_message",
                        "message": {
                            "id": str(message.id),
                            "match_id": str(message.match_id),
                            "sender_id": str(message.sender_id),
                            "content": message.content,
                            "created_at": message.created_at.isoformat(),
                            "read_at": None,
                        }
                    }
                )

            elif msg_type == "typing":
                # Broadcast typing indicator to partner only
                if partner_id:
                    await manager.send_to_user(
                        match_id,
                        partner_id,
                        {"type": "typing", "user_id": str(user_id)}
                    )

            elif msg_type == "read":
                # Mark messages as read
                async with async_session_maker() as db:
                    await chat_service.mark_messages_read(db, match_id, user_id)

                # Notify partner
                if partner_id:
                    await manager.send_to_user(
                        match_id,
                        partner_id,
                        {"type": "messages_read", "reader_id": str(user_id)}
                    )

    except WebSocketDisconnect:
        manager.disconnect(websocket, match_id, user_id)
    except Exception as e:
        manager.disconnect(websocket, match_id, user_id)
        # Log error in production
        print(f"WebSocket error: {e}")
