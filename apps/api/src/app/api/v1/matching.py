"""Matching API endpoints: discovery, likes, passes, matches, blocks, reports."""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models import User, Photo
from app.models.matching import ReportReason as ReportReasonEnum, UnmatchReason as UnmatchReasonEnum
from app.schemas.matching import (
    BlockCreate,
    BlockOut,
    CompatibilityOut,
    DiscoveryProfileOut,
    DiscoveryResultOut,
    LikeCreate,
    LikeResultOut,
    MatchOut,
    PassCreate,
    PassOut,
    PendingLikeOut,
    ReportCreate,
    ReportOut,
    TraitComparisonOut,
    UnmatchRequest,
)
from app.services.discovery import get_discovery_queue
from app.services.matching import (
    send_like,
    send_pass,
    undo_pass,
    block_user,
    report_user,
    unmatch,
    get_user_matches,
    get_pending_likes,
    get_daily_likes_remaining,
)
from app.services.compatibility import get_compatibility_between_users

router = APIRouter(prefix="/matching", tags=["matching"])


def calculate_age(birth_date: date | None) -> int | None:
    """Calculate age from birth date."""
    if not birth_date:
        return None
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


# Discovery endpoints
@router.get("/discover", response_model=DiscoveryResultOut)
async def get_discovery_feed(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DiscoveryResultOut:
    """
    Get discovery feed with up to 10 curated profiles.

    Returns profiles ranked by compatibility, completeness, and activity.
    Handles scarcity gracefully with suggestions if pool is limited.
    """
    result = await get_discovery_queue(db, uuid.UUID(user_id))
    likes_remaining = await get_daily_likes_remaining(db, uuid.UUID(user_id))

    profiles = []
    for dp in result.profiles:
        # Convert compatibility to schema
        compat_out = None
        if dp.compatibility:
            compat_out = CompatibilityOut(
                overall_score=dp.compatibility.overall_score,
                trait_comparisons=[
                    TraitComparisonOut(
                        trait_name=tc.trait_name,
                        user_score=tc.user_score,
                        other_score=tc.other_score,
                        difference=tc.difference,
                        compatibility=tc.compatibility,
                        description=tc.description,
                    )
                    for tc in dp.compatibility.trait_comparisons
                ],
                summary=dp.compatibility.summary,
                highlights=dp.compatibility.highlights,
            )

        profiles.append(DiscoveryProfileOut(
            id=dp.user.id,
            name=dp.user.name,
            age=calculate_age(dp.user.birth_date),
            gender=dp.user.gender,
            bio=dp.user.bio,
            location=dp.user.location,
            photos=[{"id": str(p.id), "url": p.url, "order": p.order} for p in dp.photos],
            prompts=[{"id": str(p.id), "question": p.question, "answer": p.answer} for p in dp.prompts],
            compatibility=compat_out,
            is_new_user=dp.is_new_user,
        ))

    return DiscoveryResultOut(
        profiles=profiles,
        total_available=result.total_available,
        exhausted_pool=result.exhausted_pool,
        suggestions=result.suggestions,
        likes_remaining=likes_remaining,
    )


# Like endpoints
@router.post("/likes", response_model=LikeResultOut, status_code=201)
async def send_like_to_user(
    like_in: LikeCreate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LikeResultOut:
    """
    Send a like to another user.

    - Limited to 10 likes per day
    - First 5 likes require a comment
    - Rate limited to prevent spam
    - Creates a match if mutual
    """
    result = await send_like(
        db,
        uuid.UUID(user_id),
        like_in.to_user_id,
        like_in.message,
        like_in.liked_item,
    )
    return LikeResultOut(
        success=result.success,
        is_match=result.is_match,
        match_id=result.match_id,
        error=result.error,
    )


@router.get("/likes/pending", response_model=list[PendingLikeOut])
async def get_likes_received(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PendingLikeOut]:
    """Get likes received that you haven't acted on yet."""
    likes = await get_pending_likes(db, uuid.UUID(user_id))

    result = []
    for like in likes:
        # Get user info
        user_result = await db.execute(
            select(User).where(User.id == like.from_user_id)
        )
        from_user = user_result.scalars().first()

        # Get first photo
        photo_result = await db.execute(
            select(Photo).where(Photo.user_id == like.from_user_id).order_by(Photo.order).limit(1)
        )
        first_photo = photo_result.scalars().first()

        result.append(PendingLikeOut(
            id=like.id,
            from_user_id=like.from_user_id,
            from_user_name=from_user.name if from_user else None,
            from_user_photo=first_photo.url if first_photo else None,
            message=like.message,
            liked_item=like.liked_item,
            created_at=like.created_at,
        ))

    return result


# Pass endpoints
@router.post("/passes", response_model=PassOut, status_code=201)
async def pass_on_user(
    pass_in: PassCreate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PassOut:
    """
    Pass on a profile.

    - Not permanent: expires after 30 days
    - User will see this profile again after cooldown
    """
    from datetime import UTC, datetime, timedelta

    success = await send_pass(db, uuid.UUID(user_id), pass_in.to_user_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to pass")

    # Return the pass info
    from app.models.matching import Pass
    result = await db.execute(
        select(Pass).where(
            Pass.from_user_id == uuid.UUID(user_id),
            Pass.to_user_id == pass_in.to_user_id
        )
    )
    pass_record = result.scalars().first()

    return PassOut(
        id=pass_record.id,
        to_user_id=pass_record.to_user_id,
        created_at=pass_record.created_at,
        expires_at=pass_record.expires_at,
    )


@router.delete("/passes/{to_user_id}", status_code=204)
async def undo_pass_on_user(
    to_user_id: uuid.UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Undo a pass (limited usage).

    Use this if you accidentally passed on someone.
    """
    success = await undo_pass(db, uuid.UUID(user_id), to_user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pass not found")


# Match endpoints
@router.get("/matches", response_model=list[MatchOut])
async def list_matches(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[MatchOut]:
    """Get all your matches."""
    from app.models.matching import MatchStatus

    matches = await get_user_matches(db, uuid.UUID(user_id), MatchStatus.ACTIVE)

    result = []
    for match in matches:
        # Determine other user
        other_user_id = match.user2_id if str(match.user1_id) == user_id else match.user1_id

        # Get other user info
        user_result = await db.execute(
            select(User).where(User.id == other_user_id)
        )
        other_user = user_result.scalars().first()

        # Get first photo
        photo_result = await db.execute(
            select(Photo).where(Photo.user_id == other_user_id).order_by(Photo.order).limit(1)
        )
        first_photo = photo_result.scalars().first()

        result.append(MatchOut(
            id=match.id,
            other_user_id=other_user_id,
            other_user_name=other_user.name if other_user else None,
            other_user_photo=first_photo.url if first_photo else None,
            matched_at=match.matched_at,
            status=match.status,
            last_message_at=match.last_message_at,
        ))

    return result


@router.delete("/matches/{match_id}", status_code=204)
async def unmatch_user(
    match_id: uuid.UUID,
    unmatch_req: UnmatchRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Unmatch from a match."""
    reason = UnmatchReasonEnum(unmatch_req.reason.value)
    success = await unmatch(db, uuid.UUID(user_id), match_id, reason)
    if not success:
        raise HTTPException(status_code=404, detail="Match not found")


# Block endpoints
@router.post("/blocks", response_model=BlockOut, status_code=201)
async def block_another_user(
    block_in: BlockCreate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BlockOut:
    """
    Block a user.

    - They will never appear in your feed again
    - You will never appear in their feed
    - Any active match will be ended
    """
    await block_user(db, uuid.UUID(user_id), block_in.blocked_id)

    from app.models.matching import Block
    result = await db.execute(
        select(Block).where(
            Block.blocker_id == uuid.UUID(user_id),
            Block.blocked_id == block_in.blocked_id
        )
    )
    block_record = result.scalars().first()

    return BlockOut(
        id=block_record.id,
        blocked_id=block_record.blocked_id,
        created_at=block_record.created_at,
    )


# Report endpoints
@router.post("/reports", response_model=ReportOut, status_code=201)
async def report_another_user(
    report_in: ReportCreate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ReportOut:
    """
    Report a user for review.

    - User will be automatically blocked
    - Report will be reviewed by moderators
    """
    reason = ReportReasonEnum(report_in.reason.value)
    report_id = await report_user(
        db,
        uuid.UUID(user_id),
        report_in.reported_id,
        reason,
        report_in.details,
    )

    from app.models.matching import Report
    result = await db.execute(
        select(Report).where(Report.id == report_id)
    )
    report_record = result.scalars().first()

    return ReportOut(
        id=report_record.id,
        reported_id=report_record.reported_id,
        reason=report_record.reason,
        created_at=report_record.created_at,
    )


# Compatibility endpoint
@router.get("/compatibility/{other_user_id}", response_model=CompatibilityOut)
async def get_compatibility(
    other_user_id: uuid.UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CompatibilityOut:
    """Get compatibility details with another user."""
    result = await get_compatibility_between_users(db, uuid.UUID(user_id), other_user_id)

    if not result:
        raise HTTPException(status_code=404, detail="Compatibility data not available")

    return CompatibilityOut(
        overall_score=result.overall_score,
        trait_comparisons=[
            TraitComparisonOut(
                trait_name=tc.trait_name,
                user_score=tc.user_score,
                other_score=tc.other_score,
                difference=tc.difference,
                compatibility=tc.compatibility,
                description=tc.description,
            )
            for tc in result.trait_comparisons
        ],
        summary=result.summary,
        highlights=result.highlights,
    )
