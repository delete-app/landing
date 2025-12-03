"""Matching service: Likes, passes, matches, blocks, reports with abuse prevention."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Sequence

from sqlalchemy import select, and_, or_, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.models.matching import (
    Like, Pass, Match, Block, Report, DailyLikeCount,
    MatchStatus, UnmatchReason, ReportReason
)


# Configuration
PASS_COOLDOWN_DAYS = 30
MAX_DAILY_LIKES = 10
REQUIRED_COMMENT_THRESHOLD = 5  # First N likes require a comment
RATE_LIMIT_WINDOW_SECONDS = 60  # If all likes in < 60 seconds, suspicious
SPAM_MESSAGE_THRESHOLD = 3  # Same message 3+ times = spam flag


@dataclass
class LikeResult:
    """Result of a like action."""
    success: bool
    is_match: bool
    match_id: uuid.UUID | None
    error: str | None


@dataclass
class AbuseCheck:
    """Result of abuse detection check."""
    is_suspicious: bool
    reason: str | None


async def check_abuse_patterns(
    db: AsyncSession, user_id: uuid.UUID, message: str | None
) -> AbuseCheck:
    """Check for abuse patterns in liking behavior."""
    today = datetime.now(UTC).date()
    today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=UTC)

    # Get today's like count record
    result = await db.execute(
        select(DailyLikeCount).where(
            DailyLikeCount.user_id == user_id,
            DailyLikeCount.date >= today_start,
            DailyLikeCount.date < today_start + timedelta(days=1)
        )
    )
    daily_record = result.scalars().first()

    if daily_record:
        # Check rate limit: all likes in < 60 seconds is suspicious
        if daily_record.first_like_at and daily_record.last_like_at:
            time_span = (daily_record.last_like_at - daily_record.first_like_at).total_seconds()
            if daily_record.like_count >= 5 and time_span < RATE_LIMIT_WINDOW_SECONDS:
                return AbuseCheck(
                    is_suspicious=True,
                    reason="Likes sent too quickly — please slow down"
                )

    # Check for spam messages (same message used 3+ times)
    if message:
        result = await db.execute(
            select(func.count()).where(
                Like.from_user_id == user_id,
                Like.message == message
            )
        )
        same_message_count = result.scalar() or 0
        if same_message_count >= SPAM_MESSAGE_THRESHOLD:
            return AbuseCheck(
                is_suspicious=True,
                reason="Please personalize your messages"
            )

    return AbuseCheck(is_suspicious=False, reason=None)


async def get_user_like_count(
    db: AsyncSession, user_id: uuid.UUID
) -> int:
    """Get the number of likes sent by user."""
    result = await db.execute(
        select(func.count()).where(Like.from_user_id == user_id)
    )
    return result.scalar() or 0


async def requires_comment(db: AsyncSession, user_id: uuid.UUID) -> bool:
    """Check if user must include a comment with their like."""
    like_count = await get_user_like_count(db, user_id)
    return like_count < REQUIRED_COMMENT_THRESHOLD


async def get_daily_likes_remaining(
    db: AsyncSession, user_id: uuid.UUID
) -> int:
    """Get remaining likes for today."""
    today = datetime.now(UTC).date()
    today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=UTC)

    result = await db.execute(
        select(DailyLikeCount).where(
            DailyLikeCount.user_id == user_id,
            DailyLikeCount.date >= today_start,
            DailyLikeCount.date < today_start + timedelta(days=1)
        )
    )
    record = result.scalars().first()

    if not record:
        return MAX_DAILY_LIKES

    return max(0, MAX_DAILY_LIKES - record.like_count)


async def increment_daily_like_count(
    db: AsyncSession, user_id: uuid.UUID
) -> None:
    """Increment daily like count for rate limiting."""
    today = datetime.now(UTC).date()
    today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=UTC)
    now = datetime.now(UTC)

    result = await db.execute(
        select(DailyLikeCount).where(
            DailyLikeCount.user_id == user_id,
            DailyLikeCount.date >= today_start,
            DailyLikeCount.date < today_start + timedelta(days=1)
        )
    )
    record = result.scalars().first()

    if record:
        record.like_count += 1
        record.last_like_at = now
    else:
        record = DailyLikeCount(
            user_id=user_id,
            date=today_start,
            like_count=1,
            first_like_at=now,
            last_like_at=now
        )
        db.add(record)


async def check_already_passed_you(
    db: AsyncSession, from_user_id: uuid.UUID, to_user_id: uuid.UUID
) -> bool:
    """Check if the target user has already passed on the liking user."""
    now = datetime.now(UTC)
    result = await db.execute(
        select(Pass).where(
            Pass.from_user_id == to_user_id,
            Pass.to_user_id == from_user_id,
            Pass.expires_at > now
        )
    )
    return result.scalars().first() is not None


async def send_like(
    db: AsyncSession,
    from_user_id: uuid.UUID,
    to_user_id: uuid.UUID,
    message: str | None = None,
    liked_item: str | None = None
) -> LikeResult:
    """
    Send a like to another user.

    Handles:
    - Daily like limits
    - Required comments for first N likes
    - Abuse detection
    - Match creation on mutual like
    - Silently handles case where target already passed
    """
    # Check daily limit
    remaining = await get_daily_likes_remaining(db, from_user_id)
    if remaining <= 0:
        return LikeResult(
            success=False,
            is_match=False,
            match_id=None,
            error="You've used all your likes for today"
        )

    # Check if comment is required
    if await requires_comment(db, from_user_id) and not message:
        return LikeResult(
            success=False,
            is_match=False,
            match_id=None,
            error="Please add a comment with your first few likes"
        )

    # Check abuse patterns
    abuse_check = await check_abuse_patterns(db, from_user_id, message)
    if abuse_check.is_suspicious:
        return LikeResult(
            success=False,
            is_match=False,
            match_id=None,
            error=abuse_check.reason
        )

    # Check if already liked
    result = await db.execute(
        select(Like).where(
            Like.from_user_id == from_user_id,
            Like.to_user_id == to_user_id
        )
    )
    if result.scalars().first():
        return LikeResult(
            success=False,
            is_match=False,
            match_id=None,
            error="You've already liked this person"
        )

    # Check if target already passed (silently succeed but don't match)
    target_passed = await check_already_passed_you(db, from_user_id, to_user_id)

    # Create the like
    like = Like(
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        message=message,
        liked_item=liked_item
    )
    db.add(like)

    # Increment daily count
    await increment_daily_like_count(db, from_user_id)

    # If target passed, don't check for match
    if target_passed:
        await db.commit()
        return LikeResult(
            success=True,
            is_match=False,
            match_id=None,
            error=None
        )

    # Check for mutual like (match)
    result = await db.execute(
        select(Like).where(
            Like.from_user_id == to_user_id,
            Like.to_user_id == from_user_id
        )
    )
    mutual_like = result.scalars().first()

    if mutual_like:
        # Create match!
        match = Match(
            user1_id=min(from_user_id, to_user_id, key=str),
            user2_id=max(from_user_id, to_user_id, key=str),
            status=MatchStatus.ACTIVE.value
        )
        db.add(match)
        await db.commit()
        await db.refresh(match)

        return LikeResult(
            success=True,
            is_match=True,
            match_id=match.id,
            error=None
        )

    await db.commit()
    return LikeResult(
        success=True,
        is_match=False,
        match_id=None,
        error=None
    )


async def send_pass(
    db: AsyncSession,
    from_user_id: uuid.UUID,
    to_user_id: uuid.UUID
) -> bool:
    """
    Pass on a profile. 30-day cooldown, not permanent.

    Returns True if successful.
    """
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=PASS_COOLDOWN_DAYS)

    # Check if pass already exists
    result = await db.execute(
        select(Pass).where(
            Pass.from_user_id == from_user_id,
            Pass.to_user_id == to_user_id
        )
    )
    existing = result.scalars().first()

    if existing:
        # Update expiration
        existing.expires_at = expires_at
        existing.created_at = now
    else:
        # Create new pass
        pass_record = Pass(
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            expires_at=expires_at
        )
        db.add(pass_record)

    await db.commit()
    return True


async def undo_pass(
    db: AsyncSession,
    from_user_id: uuid.UUID,
    to_user_id: uuid.UUID
) -> bool:
    """
    Undo a pass (limited usage - e.g., 1 per week).

    Returns True if successful.
    """
    result = await db.execute(
        select(Pass).where(
            Pass.from_user_id == from_user_id,
            Pass.to_user_id == to_user_id
        )
    )
    pass_record = result.scalars().first()

    if pass_record:
        await db.delete(pass_record)
        await db.commit()
        return True

    return False


async def block_user(
    db: AsyncSession,
    blocker_id: uuid.UUID,
    blocked_id: uuid.UUID
) -> bool:
    """
    Block a user. They'll never appear to each other again.
    Also ends any active match.
    """
    # Check if already blocked
    result = await db.execute(
        select(Block).where(
            Block.blocker_id == blocker_id,
            Block.blocked_id == blocked_id
        )
    )
    if result.scalars().first():
        return True  # Already blocked

    # Create block
    block = Block(blocker_id=blocker_id, blocked_id=blocked_id)
    db.add(block)

    # End any active match
    result = await db.execute(
        select(Match).where(
            or_(
                and_(Match.user1_id == blocker_id, Match.user2_id == blocked_id),
                and_(Match.user1_id == blocked_id, Match.user2_id == blocker_id)
            ),
            Match.status == MatchStatus.ACTIVE.value
        )
    )
    match = result.scalars().first()
    if match:
        match.status = MatchStatus.UNMATCHED.value
        match.unmatched_by = blocker_id
        match.unmatch_reason = UnmatchReason.OTHER.value

    await db.commit()
    return True


async def report_user(
    db: AsyncSession,
    reporter_id: uuid.UUID,
    reported_id: uuid.UUID,
    reason: ReportReason,
    details: str | None = None
) -> uuid.UUID:
    """
    Report a user for review. Returns report ID.
    """
    report = Report(
        reporter_id=reporter_id,
        reported_id=reported_id,
        reason=reason.value,
        details=details
    )
    db.add(report)

    # Auto-block after report
    await block_user(db, reporter_id, reported_id)

    await db.commit()
    await db.refresh(report)
    return report.id


async def unmatch(
    db: AsyncSession,
    user_id: uuid.UUID,
    match_id: uuid.UUID,
    reason: UnmatchReason
) -> bool:
    """
    Unmatch from a match.
    """
    result = await db.execute(
        select(Match).where(
            Match.id == match_id,
            or_(Match.user1_id == user_id, Match.user2_id == user_id),
            Match.status == MatchStatus.ACTIVE.value
        )
    )
    match = result.scalars().first()

    if not match:
        return False

    match.status = MatchStatus.UNMATCHED.value
    match.unmatched_by = user_id
    match.unmatch_reason = reason.value

    await db.commit()
    return True


async def get_user_matches(
    db: AsyncSession,
    user_id: uuid.UUID,
    status: MatchStatus | None = None
) -> Sequence[Match]:
    """Get all matches for a user, optionally filtered by status."""
    query = select(Match).where(
        or_(Match.user1_id == user_id, Match.user2_id == user_id)
    )

    if status:
        query = query.where(Match.status == status.value)
    else:
        # By default, exclude deleted
        query = query.where(Match.status != MatchStatus.DELETED.value)

    query = query.order_by(Match.matched_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


async def get_pending_likes(
    db: AsyncSession,
    user_id: uuid.UUID
) -> Sequence[Like]:
    """Get likes received that haven't been acted on yet."""
    # Get users I've already liked or passed
    result = await db.execute(
        select(Like.to_user_id).where(Like.from_user_id == user_id)
    )
    liked_ids = {row[0] for row in result.fetchall()}

    now = datetime.now(UTC)
    result = await db.execute(
        select(Pass.to_user_id).where(
            Pass.from_user_id == user_id,
            Pass.expires_at > now
        )
    )
    passed_ids = {row[0] for row in result.fetchall()}

    acted_on_ids = liked_ids | passed_ids

    # Get likes from users I haven't acted on
    query = select(Like).where(
        Like.to_user_id == user_id
    )
    if acted_on_ids:
        query = query.where(Like.from_user_id.not_in(acted_on_ids))

    query = query.order_by(Like.created_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


async def archive_stale_matches(db: AsyncSession, days: int = 7) -> int:
    """
    Archive matches with no messages in N days.
    Returns count of archived matches.
    """
    cutoff = datetime.now(UTC) - timedelta(days=days)

    result = await db.execute(
        select(Match).where(
            Match.status == MatchStatus.ACTIVE.value,
            or_(
                Match.last_message_at < cutoff,
                and_(Match.last_message_at.is_(None), Match.matched_at < cutoff)
            )
        )
    )
    matches = result.scalars().all()

    for match in matches:
        match.status = MatchStatus.ARCHIVED.value

    await db.commit()
    return len(matches)
