"""Schemas for matching system: discovery, likes, passes, matches, blocks, reports."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


# Enums
class MatchStatus(str, Enum):
    ACTIVE = "active"
    UNMATCHED = "unmatched"
    ARCHIVED = "archived"
    DATING = "dating"
    DELETED = "deleted"


class UnmatchReason(str, Enum):
    NOT_INTERESTED = "not_interested"
    NO_RESPONSE = "no_response"
    INAPPROPRIATE = "inappropriate"
    MET_OFFLINE = "met_offline"
    OTHER = "other"


class ReportReason(str, Enum):
    FAKE_PROFILE = "fake_profile"
    INAPPROPRIATE_CONTENT = "inappropriate_content"
    HARASSMENT = "harassment"
    SPAM = "spam"
    UNDERAGE = "underage"
    OTHER = "other"


# Trait/Compatibility schemas
class TraitComparisonOut(BaseModel):
    trait_name: str
    user_score: int
    other_score: int
    difference: int
    compatibility: str
    description: str


class CompatibilityOut(BaseModel):
    overall_score: int = Field(..., ge=0, le=100)
    trait_comparisons: list[TraitComparisonOut]
    summary: str
    highlights: list[str]


# Discovery schemas
class DiscoveryProfileOut(BaseModel):
    id: uuid.UUID
    name: str | None
    age: int | None
    gender: str | None
    bio: str | None
    location: str | None
    photos: list[dict]  # List of photo objects with id, url, order
    prompts: list[dict]  # List of prompt objects with id, question, answer
    compatibility: CompatibilityOut | None
    is_new_user: bool

    model_config = {"from_attributes": True}


class DiscoveryResultOut(BaseModel):
    profiles: list[DiscoveryProfileOut]
    total_available: int
    exhausted_pool: bool
    suggestions: list[str]
    likes_remaining: int


# Like schemas
class LikeCreate(BaseModel):
    to_user_id: uuid.UUID
    message: str | None = Field(None, max_length=500)
    liked_item: str | None = Field(None, max_length=50)  # e.g., "photo_1", "prompt_2"


class LikeOut(BaseModel):
    id: uuid.UUID
    from_user_id: uuid.UUID
    to_user_id: uuid.UUID
    message: str | None
    liked_item: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LikeResultOut(BaseModel):
    success: bool
    is_match: bool
    match_id: uuid.UUID | None
    error: str | None


# Pass schemas
class PassCreate(BaseModel):
    to_user_id: uuid.UUID


class PassOut(BaseModel):
    id: uuid.UUID
    to_user_id: uuid.UUID
    created_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}


# Match schemas
class MatchOut(BaseModel):
    id: uuid.UUID
    other_user_id: uuid.UUID
    other_user_name: str | None
    other_user_photo: str | None  # First photo URL
    matched_at: datetime
    status: str
    last_message_at: datetime | None

    model_config = {"from_attributes": True}


class UnmatchRequest(BaseModel):
    reason: UnmatchReason


# Block schemas
class BlockCreate(BaseModel):
    blocked_id: uuid.UUID


class BlockOut(BaseModel):
    id: uuid.UUID
    blocked_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# Report schemas
class ReportCreate(BaseModel):
    reported_id: uuid.UUID
    reason: ReportReason
    details: str | None = Field(None, max_length=1000)


class ReportOut(BaseModel):
    id: uuid.UUID
    reported_id: uuid.UUID
    reason: str
    created_at: datetime

    model_config = {"from_attributes": True}


# Pending like (someone who liked you)
class PendingLikeOut(BaseModel):
    id: uuid.UUID
    from_user_id: uuid.UUID
    from_user_name: str | None
    from_user_photo: str | None
    message: str | None
    liked_item: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
