"""Matching system models: Likes, Passes, Matches, Blocks, Reports."""

import uuid
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MatchStatus(str, Enum):
    """Match lifecycle states."""
    ACTIVE = "active"          # Both users can message
    UNMATCHED = "unmatched"    # One user unmatched
    ARCHIVED = "archived"      # Stale (no messages in 7 days)
    DATING = "dating"          # Users marked as dating
    DELETED = "deleted"        # Account deletion


class UnmatchReason(str, Enum):
    """Reasons for unmatching."""
    NOT_INTERESTED = "not_interested"
    NO_RESPONSE = "no_response"
    INAPPROPRIATE = "inappropriate"
    MET_OFFLINE = "met_offline"
    OTHER = "other"


class ReportReason(str, Enum):
    """Reasons for reporting a user."""
    FAKE_PROFILE = "fake_profile"
    INAPPROPRIATE_CONTENT = "inappropriate_content"
    HARASSMENT = "harassment"
    SPAM = "spam"
    UNDERAGE = "underage"
    OTHER = "other"


class Like(Base):
    """A user likes another user's profile."""
    __tablename__ = "likes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    from_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Comment on specific content (required for first 5 likes, then optional)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # What they liked: "photo_1", "prompt_2", "bio", etc.
    liked_item: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_likes_from_user", "from_user_id"),
        Index("ix_likes_to_user", "to_user_id"),
        Index("ix_likes_unique", "from_user_id", "to_user_id", unique=True),
    )


class Pass(Base):
    """A user passes on another user. 30-day cooldown, not permanent."""
    __tablename__ = "passes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    from_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    # Pass expires after 30 days - user will see them again
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_passes_from_user", "from_user_id"),
        Index("ix_passes_expires", "expires_at"),
        Index("ix_passes_unique", "from_user_id", "to_user_id", unique=True),
    )


class Match(Base):
    """Mutual like = match. Tracks lifecycle."""
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user1_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    user2_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    matched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    status: Mapped[str] = mapped_column(
        String(20), default=MatchStatus.ACTIVE.value
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Who unmatched (if applicable)
    unmatched_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    unmatch_reason: Mapped[str | None] = mapped_column(String(30), nullable=True)

    __table_args__ = (
        Index("ix_matches_user1", "user1_id"),
        Index("ix_matches_user2", "user2_id"),
        Index("ix_matches_status", "status"),
        Index("ix_matches_unique", "user1_id", "user2_id", unique=True),
    )


class Block(Base):
    """User blocks another user. Permanent, bidirectional hiding."""
    __tablename__ = "blocks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    blocker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    blocked_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_blocks_blocker", "blocker_id"),
        Index("ix_blocks_blocked", "blocked_id"),
        Index("ix_blocks_unique", "blocker_id", "blocked_id", unique=True),
    )


class Report(Base):
    """User reports another user for review."""
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reported_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[str] = mapped_column(String(30), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    # Admin review status
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    action_taken: Mapped[str | None] = mapped_column(String(50), nullable=True)

    __table_args__ = (
        Index("ix_reports_reporter", "reporter_id"),
        Index("ix_reports_reported", "reported_id"),
        Index("ix_reports_pending", "reviewed_at"),
    )


class UserTraitScore(Base):
    """Derived trait scores from quiz responses. Computed, not raw answers."""
    __tablename__ = "user_trait_scores"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    # Trait scores (1-5 scale, derived from quiz)
    introvert_extrovert: Mapped[int] = mapped_column(Integer, nullable=False)  # 1=introvert, 5=extrovert
    planner_spontaneous: Mapped[int] = mapped_column(Integer, nullable=False)  # 1=planner, 5=spontaneous
    conflict_talk_space: Mapped[int] = mapped_column(Integer, nullable=False)  # 1=talk immediately, 5=need space
    together_alone_time: Mapped[int] = mapped_column(Integer, nullable=False)  # 1=together, 5=alone
    slow_quick_decisions: Mapped[int] = mapped_column(Integer, nullable=False)  # 1=slow, 5=quick
    routine_novelty: Mapped[int] = mapped_column(Integer, nullable=False)       # 1=routine, 5=novelty
    # Computed compatibility metadata
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_trait_scores_user", "user_id"),
    )


class DailyLikeCount(Base):
    """Track daily like count for rate limiting and abuse detection."""
    __tablename__ = "daily_like_counts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    # Timestamps for abuse detection
    first_like_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_like_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_daily_likes_user_date", "user_id", "date", unique=True),
    )
