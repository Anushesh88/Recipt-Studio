"""google sign-in

Accounts made with "Sign in with Google" have no password, and every account
that has signed in with Google keeps Google's account ID.

Revision ID: 8d41c2e7a9f3
Revises: 5beb9e43ca2b
Create Date: 2026-10-11 02:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '8d41c2e7a9f3'
down_revision: str | Sequence[str] | None = '5beb9e43ca2b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # batch mode so SQLite (local dev) can change the column and add the constraint
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('password_hash', existing_type=sa.Text(), nullable=True)
        batch_op.add_column(sa.Column('google_sub', sa.Text(), nullable=True))
        batch_op.create_unique_constraint('users_google_sub_key', ['google_sub'])


def downgrade() -> None:
    """Downgrade schema."""
    # Accounts without a password can't be kept once a password is required
    op.execute("DELETE FROM users WHERE password_hash IS NULL")
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('users_google_sub_key', type_='unique')
        batch_op.drop_column('google_sub')
        batch_op.alter_column('password_hash', existing_type=sa.Text(), nullable=False)
