"""Add discovery view tracking tables for costly signaling feature

Revision ID: 0005
Revises: 0004
Create Date: 2024-12-06

Tables:
- profile_views: Track when user starts viewing a profile (server-side time validation)
- daily_discovery_state: Track daily profile queue and free pick usage
- interests: Record expressed interest with type (free_pick vs earned)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create profile_views table - tracks view start time for server-side validation
    op.create_table(
        "profile_views",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "viewer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "viewed_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        # Null until action taken (interest/pass)
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        # Server calculates duration = ended_at - started_at
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        # Action taken: 'interest', 'pass', or null (still viewing)
        sa.Column("action", sa.String(20), nullable=True),
        # Date for daily grouping
        sa.Column("view_date", sa.Date(), nullable=False),
    )
    op.create_index("ix_profile_views_viewer", "profile_views", ["viewer_id"])
    op.create_index("ix_profile_views_viewer_date", "profile_views", ["viewer_id", "view_date"])
    op.create_index(
        "ix_profile_views_active",
        "profile_views",
        ["viewer_id", "viewed_id"],
        postgresql_where=sa.text("ended_at IS NULL"),
    )

    # Create daily_discovery_state table - tracks daily queue and free pick
    op.create_table(
        "daily_discovery_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        # JSON array of profile IDs assigned for the day
        sa.Column("profile_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
        # Current position in the queue (0-indexed)
        sa.Column("current_index", sa.Integer(), nullable=False, server_default="0"),
        # Whether free pick has been used today
        sa.Column("free_pick_used", sa.Boolean(), nullable=False, server_default="false"),
        # IDs of profiles user expressed interest in
        sa.Column("interested_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
        # IDs of profiles user passed on
        sa.Column("passed_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_daily_discovery_user_date",
        "daily_discovery_states",
        ["user_id", "date"],
        unique=True,
    )

    # Create interests table - records interest with type for analytics
    op.create_table(
        "interests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "from_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "to_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Type: 'free_pick' or 'earned'
        sa.Column("interest_type", sa.String(20), nullable=False),
        # Time spent viewing before expressing interest (server-validated)
        sa.Column("view_duration_seconds", sa.Integer(), nullable=False),
        # Reference to the profile_view record
        sa.Column(
            "profile_view_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profile_views.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_interests_from_user", "interests", ["from_user_id"])
    op.create_index("ix_interests_to_user", "interests", ["to_user_id"])
    op.create_index(
        "ix_interests_unique",
        "interests",
        ["from_user_id", "to_user_id"],
        unique=True,
    )
    op.create_index("ix_interests_type", "interests", ["interest_type"])


def downgrade() -> None:
    op.drop_index("ix_interests_type", table_name="interests")
    op.drop_index("ix_interests_unique", table_name="interests")
    op.drop_index("ix_interests_to_user", table_name="interests")
    op.drop_index("ix_interests_from_user", table_name="interests")
    op.drop_table("interests")

    op.drop_index("ix_daily_discovery_user_date", table_name="daily_discovery_states")
    op.drop_table("daily_discovery_states")

    op.drop_index("ix_profile_views_active", table_name="profile_views")
    op.drop_index("ix_profile_views_viewer_date", table_name="profile_views")
    op.drop_index("ix_profile_views_viewer", table_name="profile_views")
    op.drop_table("profile_views")
