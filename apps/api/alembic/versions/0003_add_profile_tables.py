"""Add profile tables (photos, prompts, quiz_responses, badges)

Revision ID: 0003
Revises: 0002
Create Date: 2024-12-03

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create photos table
    op.create_table(
        "photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("order", sa.Integer(), default=0),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_photos_user_id", "photos", ["user_id"])

    # Create prompts table
    op.create_table(
        "prompts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question", sa.String(200), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("order", sa.Integer(), default=0),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_prompts_user_id", "prompts", ["user_id"])

    # Create quiz_responses table
    op.create_table(
        "quiz_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question_key", sa.String(50), nullable=False),
        sa.Column("answer_value", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_quiz_responses_user_id", "quiz_responses", ["user_id"])

    # Create badges table
    op.create_table(
        "badges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("badge_type", sa.String(50), nullable=False),
        sa.Column("label", sa.String(50), nullable=False),
        sa.Column("description", sa.String(200), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_badges_user_id", "badges", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_badges_user_id", table_name="badges")
    op.drop_table("badges")
    op.drop_index("ix_quiz_responses_user_id", table_name="quiz_responses")
    op.drop_table("quiz_responses")
    op.drop_index("ix_prompts_user_id", table_name="prompts")
    op.drop_table("prompts")
    op.drop_index("ix_photos_user_id", table_name="photos")
    op.drop_table("photos")
