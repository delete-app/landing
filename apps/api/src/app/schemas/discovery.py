"""Schemas for discovery with costly signaling: view tracking, interests, daily state."""

import uuid
from datetime import datetime, date
from enum import Enum

from pydantic import BaseModel, Field


# Enums
class InterestType(str, Enum):
    FREE_PICK = "free_pick"
    EARNED = "earned"


# Profile schemas (simplified for discovery - no PII)
class DiscoveryPhotoOut(BaseModel):
    id: str
    url: str
    order: int


class DiscoveryPromptOut(BaseModel):
    id: str
    question: str
    answer: str


class DiscoveryBadgeOut(BaseModel):
    id: str
    label: str
    description: str


class DailyDiscoveryProfileOut(BaseModel):
    """Profile for daily discovery - age calculated server-side, no PII."""
    id: uuid.UUID
    name: str | None
    age: int | None  # Calculated server-side from birth_date
    bio: str | None
    location: str | None
    photos: list[DiscoveryPhotoOut]
    prompts: list[DiscoveryPromptOut]
    badges: list[DiscoveryBadgeOut]

    model_config = {"from_attributes": True}


# View tracking schemas
class ViewStartRequest(BaseModel):
    """Request to start viewing a profile."""
    profile_id: uuid.UUID


class ViewStartResponse(BaseModel):
    """Response when starting to view a profile."""
    view_id: uuid.UUID
    profile: DailyDiscoveryProfileOut
    started_at: datetime
    minimum_view_seconds: int = Field(default=20, description="Minimum seconds before interest allowed")
    is_free_pick: bool = Field(description="Whether this is the user's free pick (no wait required)")


class ViewEndRequest(BaseModel):
    """Request to end viewing (interest or pass)."""
    view_id: uuid.UUID
    action: str = Field(..., pattern="^(interest|pass)$")


class ViewEndResponse(BaseModel):
    """Response when ending a view."""
    success: bool
    view_duration_seconds: int
    action: str
    interest_type: InterestType | None = None  # Only set if action is 'interest'
    error: str | None = None


# Daily discovery state schemas
class DailyDiscoveryStateOut(BaseModel):
    """Current state of user's daily discovery."""
    date: date
    profiles: list[DailyDiscoveryProfileOut]
    current_index: int
    total_profiles: int
    viewed_count: int  # interested + passed
    is_free_pick: bool
    free_pick_used: bool
    interested_count: int
    passed_count: int
    is_complete: bool  # All profiles viewed

    model_config = {"from_attributes": True}


class DailyDiscoveryInitResponse(BaseModel):
    """Response when initializing/getting daily discovery."""
    state: DailyDiscoveryStateOut
    current_profile: DailyDiscoveryProfileOut | None
    # Active view if user is currently viewing a profile
    active_view_id: uuid.UUID | None = None
    active_view_started_at: datetime | None = None


# Interest schemas
class ExpressInterestRequest(BaseModel):
    """Request to express interest in a profile."""
    view_id: uuid.UUID


class ExpressInterestResponse(BaseModel):
    """Response when expressing interest."""
    success: bool
    interest_type: InterestType
    view_duration_seconds: int
    # Next profile info
    next_profile: DailyDiscoveryProfileOut | None = None
    is_complete: bool = False
    error: str | None = None


# Pass schemas
class PassProfileRequest(BaseModel):
    """Request to pass on a profile."""
    view_id: uuid.UUID


class PassProfileResponse(BaseModel):
    """Response when passing on a profile."""
    success: bool
    # Next profile info
    next_profile: DailyDiscoveryProfileOut | None = None
    is_complete: bool = False
    error: str | None = None


# Interest record for history
class InterestRecordOut(BaseModel):
    """Record of expressed interest."""
    id: uuid.UUID
    to_user_id: uuid.UUID
    to_user_name: str | None
    to_user_photo: str | None
    interest_type: str
    view_duration_seconds: int
    created_at: datetime

    model_config = {"from_attributes": True}
