"""Daily Discovery API endpoints with costly signaling mechanics.

Endpoints:
- GET /daily-discovery - Get current daily state and profile
- POST /daily-discovery/view/start - Start viewing a profile
- POST /daily-discovery/view/end - End viewing (interest or pass)
- POST /daily-discovery/reset - Reset for testing (dev only)
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_user_id
from app.db.session import get_db
from app.schemas.discovery import (
    DailyDiscoveryInitResponse,
    DailyDiscoveryStateOut,
    DailyDiscoveryProfileOut,
    DiscoveryPhotoOut,
    DiscoveryPromptOut,
    DiscoveryBadgeOut,
    ViewStartRequest,
    ViewStartResponse,
    ViewEndRequest,
    ViewEndResponse,
    ExpressInterestRequest,
    ExpressInterestResponse,
    PassProfileRequest,
    PassProfileResponse,
    InterestType,
)
from app.services.daily_discovery import (
    get_daily_discovery_state,
    start_profile_view,
    end_profile_view,
    get_next_profile,
    reset_daily_state_for_testing,
    DailyProfileData,
    MINIMUM_VIEW_SECONDS,
)

router = APIRouter(prefix="/daily-discovery", tags=["daily-discovery"])


def profile_data_to_schema(profile: DailyProfileData) -> DailyDiscoveryProfileOut:
    """Convert service data class to Pydantic schema."""
    return DailyDiscoveryProfileOut(
        id=profile.id,
        name=profile.name,
        age=profile.age,
        bio=profile.bio,
        location=profile.location,
        photos=[DiscoveryPhotoOut(**p) for p in profile.photos],
        prompts=[DiscoveryPromptOut(**p) for p in profile.prompts],
        badges=[DiscoveryBadgeOut(**b) for b in profile.badges],
    )


@router.get("", response_model=DailyDiscoveryInitResponse)
async def get_daily_discovery(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DailyDiscoveryInitResponse:
    """
    Get current daily discovery state and profile to view.

    Returns:
    - Today's discovery state (profiles, progress, free pick status)
    - Current profile to view (if not complete)
    - Active view info if already viewing a profile
    """
    state_data, current_profile, active_view_id, active_view_started_at = (
        await get_daily_discovery_state(db, uuid.UUID(user_id))
    )

    # Convert profiles to schema
    profiles_out = [profile_data_to_schema(p) for p in state_data.profiles]

    state_out = DailyDiscoveryStateOut(
        date=state_data.date,
        profiles=profiles_out,
        current_index=state_data.current_index,
        total_profiles=state_data.total_profiles,
        viewed_count=state_data.viewed_count,
        is_free_pick=state_data.is_free_pick,
        free_pick_used=state_data.free_pick_used,
        interested_count=state_data.interested_count,
        passed_count=state_data.passed_count,
        is_complete=state_data.is_complete,
    )

    current_profile_out = None
    if current_profile:
        current_profile_out = profile_data_to_schema(current_profile)

    return DailyDiscoveryInitResponse(
        state=state_out,
        current_profile=current_profile_out,
        active_view_id=active_view_id,
        active_view_started_at=active_view_started_at,
    )


@router.post("/view/start", response_model=ViewStartResponse)
async def start_view(
    request: ViewStartRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ViewStartResponse:
    """
    Start viewing a profile. Records server-side timestamp.

    Call this when displaying a profile to the user.
    The server records the exact start time for validation.
    """
    result = await start_profile_view(db, uuid.UUID(user_id), request.profile_id)

    if not result:
        raise HTTPException(
            status_code=400,
            detail="Profile not found in today's discovery queue",
        )

    return ViewStartResponse(
        view_id=result.view_id,
        profile=profile_data_to_schema(result.profile),
        started_at=result.started_at,
        minimum_view_seconds=MINIMUM_VIEW_SECONDS,
        is_free_pick=result.is_free_pick,
    )


@router.post("/view/end", response_model=ViewEndResponse)
async def end_view(
    request: ViewEndRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ViewEndResponse:
    """
    End viewing a profile with an action (interest or pass).

    Server validates:
    - View exists and belongs to user
    - For 'interest' with free_pick already used: minimum view time met
    - Server calculates actual duration (not client-provided)

    Free pick rules:
    - First interest of the day is always allowed (becomes 'free_pick')
    - Subsequent interests require MINIMUM_VIEW_SECONDS seconds of viewing
    """
    result = await end_profile_view(
        db,
        uuid.UUID(user_id),
        request.view_id,
        request.action,
    )

    if not result.success:
        raise HTTPException(
            status_code=400,
            detail=result.error or "Failed to end view",
        )

    return ViewEndResponse(
        success=result.success,
        view_duration_seconds=result.view_duration_seconds,
        action=result.action,
        interest_type=InterestType(result.interest_type.value) if result.interest_type else None,
        error=result.error,
    )


@router.post("/interest", response_model=ExpressInterestResponse)
async def express_interest(
    request: ExpressInterestRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ExpressInterestResponse:
    """
    Express interest in a profile (convenience endpoint).

    Ends the view with 'interest' action and returns next profile.
    """
    result = await end_profile_view(
        db,
        uuid.UUID(user_id),
        request.view_id,
        "interest",
    )

    if not result.success:
        raise HTTPException(
            status_code=400,
            detail=result.error or "Failed to express interest",
        )

    # Get next profile
    next_profile, is_complete = await get_next_profile(db, uuid.UUID(user_id))

    return ExpressInterestResponse(
        success=True,
        interest_type=InterestType(result.interest_type.value) if result.interest_type else InterestType.EARNED,
        view_duration_seconds=result.view_duration_seconds,
        next_profile=profile_data_to_schema(next_profile) if next_profile else None,
        is_complete=is_complete,
    )


@router.post("/pass", response_model=PassProfileResponse)
async def pass_profile(
    request: PassProfileRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PassProfileResponse:
    """
    Pass on a profile (convenience endpoint).

    Ends the view with 'pass' action and returns next profile.
    Pass does not require minimum view time.
    """
    result = await end_profile_view(
        db,
        uuid.UUID(user_id),
        request.view_id,
        "pass",
    )

    if not result.success:
        raise HTTPException(
            status_code=400,
            detail=result.error or "Failed to pass",
        )

    # Get next profile
    next_profile, is_complete = await get_next_profile(db, uuid.UUID(user_id))

    return PassProfileResponse(
        success=True,
        next_profile=profile_data_to_schema(next_profile) if next_profile else None,
        is_complete=is_complete,
    )


@router.post("/reset", status_code=204)
async def reset_for_testing(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Reset daily discovery state for testing.

    Only available in development mode.
    """
    if not settings.debug:
        raise HTTPException(
            status_code=403,
            detail="Reset is only available in development mode",
        )

    await reset_daily_state_for_testing(db, uuid.UUID(user_id))
