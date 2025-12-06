"""Daily discovery service with costly signaling mechanics.

Key features:
- Limited daily profiles (default 5)
- Server-side view time tracking
- First pick is free (no wait), subsequent picks require minimum view time
- Server validates all timestamps to prevent client manipulation
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, date, timedelta

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Photo, Prompt, Badge
from app.models.discovery import (
    ProfileView,
    DailyDiscoveryState,
    Interest,
    InterestType,
    ViewAction,
)
from app.services.discovery import get_discovery_queue


# Configuration
DAILY_PROFILE_LIMIT = 5
MINIMUM_VIEW_SECONDS = 20  # Must view for at least 20 seconds for 'earned' interest


@dataclass
class DailyProfileData:
    """Profile data for daily discovery (no PII like birth_date)."""
    id: uuid.UUID
    name: str | None
    age: int | None  # Calculated from birth_date
    bio: str | None
    location: str | None
    photos: list[dict]  # [{id, url, order}]
    prompts: list[dict]  # [{id, question, answer}]
    badges: list[dict]  # [{id, label, description}]


@dataclass
class DailyStateData:
    """Daily discovery state data."""
    date: date
    profiles: list[DailyProfileData]
    current_index: int
    total_profiles: int
    viewed_count: int
    is_free_pick: bool
    free_pick_used: bool
    interested_count: int
    passed_count: int
    is_complete: bool


@dataclass
class ViewStartResult:
    """Result of starting a profile view."""
    view_id: uuid.UUID
    profile: DailyProfileData
    started_at: datetime
    is_free_pick: bool


@dataclass
class ViewEndResult:
    """Result of ending a profile view."""
    success: bool
    view_duration_seconds: int
    action: str
    interest_type: InterestType | None = None
    error: str | None = None


def calculate_age(birth_date: date | None) -> int | None:
    """Calculate age from birth date (server-side only)."""
    if not birth_date:
        return None
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


async def get_profile_data(db: AsyncSession, user_id: uuid.UUID) -> DailyProfileData | None:
    """Get profile data for a user (age calculated server-side, no PII sent)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        return None

    # Get photos
    photos_result = await db.execute(
        select(Photo).where(Photo.user_id == user_id).order_by(Photo.order)
    )
    photos = [
        {"id": str(p.id), "url": p.url, "order": p.order}
        for p in photos_result.scalars().all()
    ]

    # Get prompts
    prompts_result = await db.execute(
        select(Prompt).where(Prompt.user_id == user_id).order_by(Prompt.order)
    )
    prompts = [
        {"id": str(p.id), "question": p.question, "answer": p.answer}
        for p in prompts_result.scalars().all()
    ]

    # Get badges
    badges_result = await db.execute(
        select(Badge).where(Badge.user_id == user_id)
    )
    badges = [
        {"id": str(b.id), "label": b.label, "description": b.description}
        for b in badges_result.scalars().all()
    ]

    return DailyProfileData(
        id=user.id,
        name=user.name,
        age=calculate_age(user.birth_date),
        bio=user.bio,
        location=user.location,
        photos=photos,
        prompts=prompts,
        badges=badges,
    )


async def get_or_create_daily_state(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> DailyDiscoveryState:
    """Get or create today's discovery state for a user."""
    today = date.today()

    # Check for existing state
    result = await db.execute(
        select(DailyDiscoveryState).where(
            DailyDiscoveryState.user_id == user_id,
            DailyDiscoveryState.date == today,
        )
    )
    state = result.scalars().first()

    if state:
        return state

    # Create new state for today
    # Get discovery queue from existing service
    discovery_result = await get_discovery_queue(db, user_id, limit=DAILY_PROFILE_LIMIT)

    # Extract profile IDs
    profile_ids = [str(dp.user.id) for dp in discovery_result.profiles]

    state = DailyDiscoveryState(
        user_id=user_id,
        date=today,
        profile_ids=profile_ids,
        current_index=0,
        free_pick_used=False,
        interested_ids=[],
        passed_ids=[],
    )
    db.add(state)
    await db.flush()

    return state


async def get_daily_discovery_state(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> tuple[DailyStateData, DailyProfileData | None, uuid.UUID | None, datetime | None]:
    """
    Get the current daily discovery state.

    Returns:
        (state_data, current_profile, active_view_id, active_view_started_at)
    """
    state = await get_or_create_daily_state(db, user_id)

    # Build profile data for all profiles
    profiles = []
    for profile_id_str in state.profile_ids:
        profile_data = await get_profile_data(db, uuid.UUID(profile_id_str))
        if profile_data:
            profiles.append(profile_data)

    # Calculate state metrics
    viewed_count = len(state.interested_ids) + len(state.passed_ids)
    is_complete = state.current_index >= len(state.profile_ids)

    state_data = DailyStateData(
        date=state.date,
        profiles=profiles,
        current_index=state.current_index,
        total_profiles=len(state.profile_ids),
        viewed_count=viewed_count,
        is_free_pick=not state.free_pick_used,
        free_pick_used=state.free_pick_used,
        interested_count=len(state.interested_ids),
        passed_count=len(state.passed_ids),
        is_complete=is_complete,
    )

    # Get current profile
    current_profile = None
    if not is_complete and state.current_index < len(profiles):
        current_profile = profiles[state.current_index]

    # Check for active view
    active_view_id = None
    active_view_started_at = None

    if current_profile:
        result = await db.execute(
            select(ProfileView).where(
                ProfileView.viewer_id == user_id,
                ProfileView.viewed_id == current_profile.id,
                ProfileView.ended_at.is_(None),  # Still active
            )
        )
        active_view = result.scalars().first()
        if active_view:
            active_view_id = active_view.id
            active_view_started_at = active_view.started_at

    return state_data, current_profile, active_view_id, active_view_started_at


async def start_profile_view(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
) -> ViewStartResult | None:
    """
    Start viewing a profile. Records server-side timestamp.

    Returns None if profile is not in today's queue.
    """
    state = await get_or_create_daily_state(db, user_id)

    # Verify profile is in today's queue
    if str(profile_id) not in state.profile_ids:
        return None

    # Check if already actively viewing
    result = await db.execute(
        select(ProfileView).where(
            ProfileView.viewer_id == user_id,
            ProfileView.viewed_id == profile_id,
            ProfileView.ended_at.is_(None),
        )
    )
    existing_view = result.scalars().first()

    if existing_view:
        # Return existing view
        profile_data = await get_profile_data(db, profile_id)
        if not profile_data:
            return None

        return ViewStartResult(
            view_id=existing_view.id,
            profile=profile_data,
            started_at=existing_view.started_at,
            is_free_pick=not state.free_pick_used,
        )

    # Create new view
    now = datetime.now(UTC)
    view = ProfileView(
        viewer_id=user_id,
        viewed_id=profile_id,
        started_at=now,
        view_date=now.date(),
    )
    db.add(view)
    await db.flush()

    profile_data = await get_profile_data(db, profile_id)
    if not profile_data:
        return None

    return ViewStartResult(
        view_id=view.id,
        profile=profile_data,
        started_at=now,
        is_free_pick=not state.free_pick_used,
    )


async def end_profile_view(
    db: AsyncSession,
    user_id: uuid.UUID,
    view_id: uuid.UUID,
    action: str,  # 'interest' or 'pass'
) -> ViewEndResult:
    """
    End viewing a profile. Server calculates actual view duration.

    For 'interest' action:
    - If free_pick not used: Always allowed (becomes free_pick)
    - If free_pick used: Must have viewed for MINIMUM_VIEW_SECONDS
    """
    # Get the view
    result = await db.execute(
        select(ProfileView).where(
            ProfileView.id == view_id,
            ProfileView.viewer_id == user_id,
            ProfileView.ended_at.is_(None),  # Must be active
        )
    )
    view = result.scalars().first()

    if not view:
        return ViewEndResult(
            success=False,
            view_duration_seconds=0,
            action=action,
            error="View not found or already ended",
        )

    # Calculate duration (server-side!)
    now = datetime.now(UTC)
    duration_seconds = int((now - view.started_at).total_seconds())

    # Get daily state
    state = await get_or_create_daily_state(db, user_id)
    is_free_pick = not state.free_pick_used

    # Validate minimum view time for earned interest
    if action == ViewAction.INTEREST.value:
        if not is_free_pick and duration_seconds < MINIMUM_VIEW_SECONDS:
            return ViewEndResult(
                success=False,
                view_duration_seconds=duration_seconds,
                action=action,
                error=f"Must view for at least {MINIMUM_VIEW_SECONDS} seconds. "
                      f"Viewed for {duration_seconds}s.",
            )

    # Update the view record
    view.ended_at = now
    view.duration_seconds = duration_seconds
    view.action = action

    # Update daily state
    profile_id_str = str(view.viewed_id)

    if action == ViewAction.INTEREST.value:
        interest_type = InterestType.FREE_PICK if is_free_pick else InterestType.EARNED

        # Create interest record
        interest = Interest(
            from_user_id=user_id,
            to_user_id=view.viewed_id,
            interest_type=interest_type.value,
            view_duration_seconds=duration_seconds,
            profile_view_id=view_id,
        )
        db.add(interest)

        # Update state
        state.interested_ids = state.interested_ids + [profile_id_str]
        if is_free_pick:
            state.free_pick_used = True

        state.current_index = state.current_index + 1

        return ViewEndResult(
            success=True,
            view_duration_seconds=duration_seconds,
            action=action,
            interest_type=interest_type,
        )

    elif action == ViewAction.PASS.value:
        # Update state
        state.passed_ids = state.passed_ids + [profile_id_str]
        state.current_index = state.current_index + 1

        return ViewEndResult(
            success=True,
            view_duration_seconds=duration_seconds,
            action=action,
        )

    return ViewEndResult(
        success=False,
        view_duration_seconds=duration_seconds,
        action=action,
        error="Invalid action",
    )


async def get_next_profile(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> tuple[DailyProfileData | None, bool]:
    """
    Get the next profile to view.

    Returns (profile, is_complete)
    """
    state = await get_or_create_daily_state(db, user_id)

    if state.current_index >= len(state.profile_ids):
        return None, True

    profile_id = uuid.UUID(state.profile_ids[state.current_index])
    profile_data = await get_profile_data(db, profile_id)

    return profile_data, False


async def reset_daily_state_for_testing(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> None:
    """Reset daily state for testing (dev only)."""
    today = date.today()

    # Delete today's state
    result = await db.execute(
        select(DailyDiscoveryState).where(
            DailyDiscoveryState.user_id == user_id,
            DailyDiscoveryState.date == today,
        )
    )
    state = result.scalars().first()
    if state:
        await db.delete(state)

    # Delete today's views
    await db.execute(
        select(ProfileView).where(
            ProfileView.viewer_id == user_id,
            ProfileView.view_date == today,
        )
    )
    # Note: Interests are not deleted as they're permanent records

    await db.flush()
