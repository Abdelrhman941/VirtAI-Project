"""db_overhaul_phase3

Revision ID: a1723b819136
Revises: 1f587d96a315
Create Date: 2026-06-28 18:06:57.068005

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1723b819136'
down_revision: Union[str, Sequence[str], None] = '1f587d96a315'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

disable_transaction = True


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('documents', 'normalized_content_hash')
    op.drop_column('documents', 'retry_count')
    op.drop_column('documents', 'queue_time_ms')

    op.alter_column('avatars', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('chat_sessions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('chat_sessions', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('chat_sessions', 'last_message_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('diagram_cache', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('document_chunks', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('documents', 'upload_date',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('messages', 'timestamp',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('quiz_attempt_answers', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('quiz_attempts', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('quiz_questions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('quizzes', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('summary_cache', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('users', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('users', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('visualization_cache', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=sa.text('now()'),
               existing_nullable=False)

    with op.get_context().autocommit_block():
        op.create_index('ix_quiz_attempt_answers_attempt_id', 'quiz_attempt_answers', ['attempt_id'], unique=False, postgresql_concurrently=True)
        op.create_index('ix_quiz_attempt_answers_question_id', 'quiz_attempt_answers', ['question_id'], unique=False, postgresql_concurrently=True)
        op.create_index('ix_quiz_attempts_quiz_id', 'quiz_attempts', ['quiz_id'], unique=False, postgresql_concurrently=True)
        op.create_index('ix_quiz_attempts_user_id', 'quiz_attempts', ['user_id'], unique=False, postgresql_concurrently=True)
        op.create_index('ix_quiz_questions_quiz_id', 'quiz_questions', ['quiz_id'], unique=False, postgresql_concurrently=True)
        op.create_index('ix_quizzes_document_id', 'quizzes', ['document_id'], unique=False, postgresql_concurrently=True)
        op.create_index('ix_quizzes_user_id', 'quizzes', ['user_id'], unique=False, postgresql_concurrently=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.get_context().autocommit_block():
        op.drop_index('ix_quizzes_user_id', table_name='quizzes', postgresql_concurrently=True)
        op.drop_index('ix_quizzes_document_id', table_name='quizzes', postgresql_concurrently=True)
        op.drop_index('ix_quiz_questions_quiz_id', table_name='quiz_questions', postgresql_concurrently=True)
        op.drop_index('ix_quiz_attempts_user_id', table_name='quiz_attempts', postgresql_concurrently=True)
        op.drop_index('ix_quiz_attempts_quiz_id', table_name='quiz_attempts', postgresql_concurrently=True)
        op.drop_index('ix_quiz_attempt_answers_question_id', table_name='quiz_attempt_answers', postgresql_concurrently=True)
        op.drop_index('ix_quiz_attempt_answers_attempt_id', table_name='quiz_attempt_answers', postgresql_concurrently=True)

    op.alter_column('visualization_cache', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('users', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('users', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('summary_cache', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('quizzes', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('quiz_questions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('quiz_attempts', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('quiz_attempt_answers', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('messages', 'timestamp',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('documents', 'upload_date',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('document_chunks', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('diagram_cache', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('chat_sessions', 'last_message_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('chat_sessions', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('chat_sessions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)
    op.alter_column('avatars', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               server_default=None,
               existing_nullable=False)

    op.add_column('documents', sa.Column('queue_time_ms', sa.INTEGER(), autoincrement=False, nullable=True))
    op.add_column('documents', sa.Column('retry_count', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False))
    op.add_column('documents', sa.Column('normalized_content_hash', sa.VARCHAR(length=64), autoincrement=False, nullable=True))

