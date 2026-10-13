"""business profile and brand kit

More business details for templates to print (phone, email, UPI ID, PAN, bank
details, licence numbers), and the brand kit: a logo, a colour and a font
pairing that templates take on.

Revision ID: e4b8f2a6c1d9
Revises: d7a2c4e9f1b6
Create Date: 2026-10-13 10:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e4b8f2a6c1d9'
down_revision: str | Sequence[str] | None = 'd7a2c4e9f1b6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PROFILE_COLUMNS = ('business_phone', 'business_email', 'upi_id', 'pan', 'bank_details', 'licence')


def upgrade() -> None:
    """Upgrade schema."""
    for name in PROFILE_COLUMNS:
        op.add_column('users', sa.Column(name, sa.Text(), nullable=True))
    # Batch mode, so SQLite (the tests) can add the foreign key too
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('brand_logo_asset_id', sa.UUID(), nullable=True))
        batch.create_foreign_key(
            'users_brand_logo_asset_id_fkey', 'assets', ['brand_logo_asset_id'], ['id'], ondelete='SET NULL'
        )
    op.add_column('users', sa.Column('brand_color', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('brand_fonts', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'brand_fonts')
    op.drop_column('users', 'brand_color')
    with op.batch_alter_table('users') as batch:
        batch.drop_constraint('users_brand_logo_asset_id_fkey', type_='foreignkey')
        batch.drop_column('brand_logo_asset_id')
    for name in reversed(PROFILE_COLUMNS):
        op.drop_column('users', name)
