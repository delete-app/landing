"""Add matching tables (likes, passes, matches, blocks, reports, trait_scores)

Revision ID: 0004
Revises: 0003
Create Date: 2024-12-03

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create likes table
    op.create_table(
        "likes",
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
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("liked_item", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_likes_from_user", "likes", ["from_user_id"])
    op.create_index("ix_likes_to_user", "likes", ["to_user_id"])
    op.create_index("ix_likes_unique", "likes", ["from_user_id", "to_user_id"], unique=True)

    # Create passes table (30-day cooldown)
    op.create_table(
        "passes",
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
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_passes_from_user", "passes", ["from_user_id"])
    op.create_index("ix_passes_expires", "passes", ["expires_at"])
    op.create_index("ix_passes_unique", "passes", ["from_user_id", "to_user_id"], unique=True)

    # Create matches table
    op.create_table(
        "matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user1_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user2_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "matched_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), default="active"),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unmatched_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unmatch_reason", sa.String(30), nullable=True),
    )
    op.create_index("ix_matches_user1", "matches", ["user1_id"])
    op.create_index("ix_matches_user2", "matches", ["user2_id"])
    op.create_index("ix_matches_status", "matches", ["status"])
    op.create_index("ix_matches_unique", "matches", ["user1_id", "user2_id"], unique=True)

    # Create blocks table
    op.create_table(
        "blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "blocker_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "blocked_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_blocks_blocker", "blocks", ["blocker_id"])
    op.create_index("ix_blocks_blocked", "blocks", ["blocked_id"])
    op.create_index("ix_blocks_unique", "blocks", ["blocker_id", "blocked_id"], unique=True)

    # Create reports table
    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "reporter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reported_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(30), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action_taken", sa.String(50), nullable=True),
    )
    op.create_index("ix_reports_reporter", "reports", ["reporter_id"])
    op.create_index("ix_reports_reported", "reports", ["reported_id"])
    op.create_index("ix_reports_pending", "reports", ["reviewed_at"])

    # Create user_trait_scores table (derived from quiz)
    op.create_table(
        "user_trait_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("introvert_extrovert", sa.Integer(), nullable=False),
        sa.Column("planner_spontaneous", sa.Integer(), nullable=False),
        sa.Column("conflict_talk_space", sa.Integer(), nullable=False),
        sa.Column("together_alone_time", sa.Integer(), nullable=False),
        sa.Column("slow_quick_decisions", sa.Integer(), nullable=False),
        sa.Column("routine_novelty", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_trait_scores_user", "user_trait_scores", ["user_id"])

    # Create daily_like_counts table (for rate limiting)
    op.create_table(
        "daily_like_counts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("like_count", sa.Integer(), default=0),
        sa.Column("first_like_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_like_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_daily_likes_user_date", "daily_like_counts", ["user_id", "date"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_daily_likes_user_date", table_name="daily_like_counts")
    op.drop_table("daily_like_counts")

    op.drop_index("ix_trait_scores_user", table_name="user_trait_scores")
    op.drop_table("user_trait_scores")

    op.drop_index("ix_reports_pending", table_name="reports")
    op.drop_index("ix_reports_reported", table_name="reports")
    op.drop_index("ix_reports_reporter", table_name="reports")
    op.drop_table("reports")

    op.drop_index("ix_blocks_unique", table_name="blocks")
    op.drop_index("ix_blocks_blocked", table_name="blocks")
    op.drop_index("ix_blocks_blocker", table_name="blocks")
    op.drop_table("blocks")

    op.drop_index("ix_matches_unique", table_name="matches")
    op.drop_index("ix_matches_status", table_name="matches")
    op.drop_index("ix_matches_user2", table_name="matches")
    op.drop_index("ix_matches_user1", table_name="matches")
    op.drop_table("matches")

    op.drop_index("ix_passes_unique", table_name="passes")
    op.drop_index("ix_passes_expires", table_name="passes")
    op.drop_index("ix_passes_from_user", table_name="passes")
    op.drop_table("passes")

    op.drop_index("ix_likes_unique", table_name="likes")
    op.drop_index("ix_likes_to_user", table_name="likes")
    op.drop_index("ix_likes_from_user", table_name="likes")
    op.drop_table("likes")
