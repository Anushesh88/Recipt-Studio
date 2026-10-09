"""users server defaults

Adds the database-level defaults from docs/03-schema.md (receipt_prefix 'R-',
numbering_mode 'sequential', receipt_next_seq 1). The initial migration only had
ORM-side defaults, so rows inserted outside SQLAlchemy failed NOT NULL.

Revision ID: 0f99c8bfc5d7
Revises: c7a5619f9b2e
Create Date: 2026-10-10 01:46:04.523484

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0f99c8bfc5d7'
down_revision: str | Sequence[str] | None = 'c7a5619f9b2e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # batch mode so SQLite (local dev) can alter columns; a plain ALTER on Postgres
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "receipt_prefix", existing_type=sa.Text(), existing_nullable=False,
            server_default="R-",
        )
        batch_op.alter_column(
            "numbering_mode", existing_type=sa.Text(), existing_nullable=False,
            server_default="sequential",
        )
        batch_op.alter_column(
            "receipt_next_seq", existing_type=sa.Integer(), existing_nullable=False,
            server_default=sa.text("1"),
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "receipt_prefix", existing_type=sa.Text(), existing_nullable=False,
            server_default=None,
        )
        batch_op.alter_column(
            "numbering_mode", existing_type=sa.Text(), existing_nullable=False,
            server_default=None,
        )
        batch_op.alter_column(
            "receipt_next_seq", existing_type=sa.Integer(), existing_nullable=False,
            server_default=None,
        )
