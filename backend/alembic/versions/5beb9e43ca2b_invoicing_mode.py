"""invoicing mode

What each user mostly makes (receipts, GST invoices or both), asked once
after sign-up; NULL until answered, so existing users are asked too.

Revision ID: 5beb9e43ca2b
Revises: 372a3a05bf8b
Create Date: 2026-10-10 19:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '5beb9e43ca2b'
down_revision: str | Sequence[str] | None = '372a3a05bf8b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # batch mode so SQLite (local dev) can add the CHECK constraint
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('invoicing_mode', sa.Text(), nullable=True))
        batch_op.create_check_constraint(
            'users_invoicing_mode_check', "invoicing_mode IN ('receipts', 'gst', 'both')"
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('users_invoicing_mode_check', type_='check')
        batch_op.drop_column('invoicing_mode')
