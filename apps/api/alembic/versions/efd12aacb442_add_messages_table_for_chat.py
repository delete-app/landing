"""Add messages table for chat

Revision ID: efd12aacb442
Revises: 0005
Create Date: 2025-12-08 23:55:55.880136

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'efd12aacb442'
down_revision: Union[str, None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('messages',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('match_id', sa.UUID(), nullable=False),
    sa.Column('sender_id', sa.UUID(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('is_deleted', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['match_id'], ['matches.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_messages_created', 'messages', ['match_id', 'created_at'], unique=False)
    op.create_index('ix_messages_match', 'messages', ['match_id'], unique=False)
    op.create_index('ix_messages_sender', 'messages', ['sender_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_messages_sender', table_name='messages')
    op.drop_index('ix_messages_match', table_name='messages')
    op.drop_index('ix_messages_created', table_name='messages')
    op.drop_table('messages')
