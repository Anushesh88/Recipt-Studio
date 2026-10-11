"""assets in database

Uploaded logos and signatures are kept in the database, so they survive on
hosts whose disk is wiped on every restart (free plans). Earlier uploads stay
files on disk (content NULL) and are still read from there.

Revision ID: b3f0e6a1c2d4
Revises: 8d41c2e7a9f3
Create Date: 2026-10-11 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b3f0e6a1c2d4'
down_revision: str | Sequence[str] | None = '8d41c2e7a9f3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('assets', sa.Column('content', sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('assets') as batch_op:
        batch_op.drop_column('content')
