"""Chat service: Message persistence and retrieval."""

import uuid
from datetime import UTC, datetime
from typing import Sequence

from sqlalchemy import select, and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Message, Match
from app.models.matching import MatchStatus


async def verify_match_access(
    db: AsyncSession, match_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    """Verify user is part of the match and match is active."""
    result = await db.execute(
        select(Match).where(
            Match.id == match_id,
            or_(Match.user1_id == user_id, Match.user2_id == user_id),
            Match.status == MatchStatus.ACTIVE.value
        )
    )
    return result.scalars().first() is not None


async def get_match_partner_id(
    db: AsyncSession, match_id: uuid.UUID, user_id: uuid.UUID
) -> uuid.UUID | None:
    """Get the other user's ID in a match."""
    result = await db.execute(
        select(Match).where(
            Match.id == match_id,
            or_(Match.user1_id == user_id, Match.user2_id == user_id)
        )
    )
    match = result.scalars().first()
    if not match:
        return None
    return match.user2_id if match.user1_id == user_id else match.user1_id


async def create_message(
    db: AsyncSession,
    match_id: uuid.UUID,
    sender_id: uuid.UUID,
    content: str
) -> Message:
    """Create and save a new message."""
    message = Message(
        match_id=match_id,
        sender_id=sender_id,
        content=content
    )
    db.add(message)

    # Update last_message_at on the match
    await db.execute(
        update(Match)
        .where(Match.id == match_id)
        .values(last_message_at=datetime.now(UTC))
    )

    await db.commit()
    await db.refresh(message)
    return message


async def get_messages(
    db: AsyncSession,
    match_id: uuid.UUID,
    limit: int = 50,
    before_id: uuid.UUID | None = None
) -> Sequence[Message]:
    """Get messages for a match, ordered by created_at desc (newest first)."""
    query = select(Message).where(
        Message.match_id == match_id,
        Message.is_deleted == False
    )

    if before_id:
        # Get the created_at of the before_id message
        result = await db.execute(
            select(Message.created_at).where(Message.id == before_id)
        )
        before_time = result.scalar()
        if before_time:
            query = query.where(Message.created_at < before_time)

    query = query.order_by(Message.created_at.desc()).limit(limit)

    result = await db.execute(query)
    # Return in chronological order for display
    return list(reversed(result.scalars().all()))


async def mark_messages_read(
    db: AsyncSession,
    match_id: uuid.UUID,
    user_id: uuid.UUID
) -> int:
    """Mark all unread messages in a match as read for user. Returns count."""
    now = datetime.now(UTC)
    result = await db.execute(
        update(Message)
        .where(
            Message.match_id == match_id,
            Message.sender_id != user_id,  # Only mark others' messages
            Message.read_at.is_(None)
        )
        .values(read_at=now)
    )
    await db.commit()
    return result.rowcount  # type: ignore


async def get_unread_count(
    db: AsyncSession,
    match_id: uuid.UUID,
    user_id: uuid.UUID
) -> int:
    """Get count of unread messages for user in a match."""
    from sqlalchemy import func
    result = await db.execute(
        select(func.count()).where(
            Message.match_id == match_id,
            Message.sender_id != user_id,
            Message.read_at.is_(None),
            Message.is_deleted == False
        )
    )
    return result.scalar() or 0


async def delete_message(
    db: AsyncSession,
    message_id: uuid.UUID,
    user_id: uuid.UUID
) -> bool:
    """Soft delete a message. Only sender can delete."""
    result = await db.execute(
        select(Message).where(
            Message.id == message_id,
            Message.sender_id == user_id
        )
    )
    message = result.scalars().first()
    if not message:
        return False

    message.is_deleted = True
    await db.commit()
    return True
