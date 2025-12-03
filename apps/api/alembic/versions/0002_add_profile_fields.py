"""Add profile fields to users table

Revision ID: 0002
Revises: 0001
Create Date: 2024-12-03

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("gender", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("location", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("looking_for", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("height_cm", sa.Integer(), nullable=True))
    op.add_column(
        "users",
        sa.Column("profile_complete", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("users", "profile_complete")
    op.drop_column("users", "height_cm")
    op.drop_column("users", "looking_for")
    op.drop_column("users", "location")
    op.drop_column("users", "bio")
    op.drop_column("users", "gender")
    op.drop_column("users", "birth_date")
