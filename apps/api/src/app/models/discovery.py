"""Discovery models: Profile views, daily state, interests with time validation."""

import uuid
from datetime import UTC, datetime, date
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, func, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InterestType(str, Enum):
    """Type of interest expression."""
    FREE_PICK = "free_pick"  # First pick of the day (no wait required after viewing)
    EARNED = "earned"        # Required minimum view time


class ViewAction(str, Enum):
    """Action taken after viewing a profile."""
    INTEREST = "interest"
    PASS = "pass"


class ProfileView(Base):
    """
    Tracks when a user starts viewing a profile.

    Server-side time validation:
    - started_at is set when user starts viewing
    - ended_at is set when user takes action (interest/pass)
    - duration_seconds = ended_at - started_at (calculated server-side)
    - Minimum view time enforced before allowing 'earned' interest
    """
    __tablename__ = "profile_views"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    viewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    viewed_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    # Null until action taken
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Server calculates: ended_at - started_at
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Action taken: 'interest', 'pass', or null (still viewing)
    action: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Date for daily grouping/querying
    view_date: Mapped[date] = mapped_column(Date, nullable=False)

    __table_args__ = (
        Index("ix_profile_views_viewer", "viewer_id"),
        Index("ix_profile_views_viewer_date", "viewer_id", "view_date"),
        Index(
            "ix_profile_views_active",
            "viewer_id",
            "viewed_id",
            postgresql_where=text("ended_at IS NULL"),
        ),
    )


class DailyDiscoveryState(Base):
    """
    Tracks daily discovery queue and free pick usage per user.

    Each day, user gets a fresh set of profiles to view.
    First interest is 'free_pick', subsequent require earned time.
    """
    __tablename__ = "daily_discovery_states"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    # JSON array of profile UUIDs assigned for the day
    profile_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # Current position in the queue (0-indexed)
    current_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Whether free pick has been used today
    free_pick_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # IDs of profiles user expressed interest in (as strings)
    interested_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # IDs of profiles user passed on (as strings)
    passed_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_daily_discovery_user_date", "user_id", "date", unique=True),
    )


class Interest(Base):
    """
    Records expressed interest with type and validated view duration.

    Separate from 'likes' table - this tracks the costly signaling mechanics.
    An interest may convert to a like later when the other user also shows interest.
    """
    __tablename__ = "interests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    from_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Type: 'free_pick' or 'earned'
    interest_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # Server-validated view duration
    view_duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    # Reference to the profile_view record
    profile_view_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profile_views.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_interests_from_user", "from_user_id"),
        Index("ix_interests_to_user", "to_user_id"),
        Index("ix_interests_unique", "from_user_id", "to_user_id", unique=True),
        Index("ix_interests_type", "interest_type"),
    )
