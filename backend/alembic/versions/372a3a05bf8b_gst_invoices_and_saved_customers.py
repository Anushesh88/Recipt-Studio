"""gst invoices and saved customers

GST tax invoices: the account's address, GSTIN and invoice prefix, each
receipt's document type, and a consecutive invoice series per financial year.
Saved customers and items for autofill in the Generate form.

Revision ID: 372a3a05bf8b
Revises: 0f99c8bfc5d7
Create Date: 2026-10-10 17:28:19.873714

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '372a3a05bf8b'
down_revision: str | Sequence[str] | None = '0f99c8bfc5d7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('catalog_items',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('description_key', sa.Text(), nullable=False),
    sa.Column('hsn', sa.Text(), nullable=True),
    sa.Column('unit', sa.Text(), nullable=True),
    sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('gst_rate', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'description_key', name='uq_catalog_items_user_id_description_key')
    )
    op.create_table('customers',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('name_key', sa.Text(), nullable=False),
    sa.Column('email', sa.Text(), nullable=True),
    sa.Column('gstin', sa.Text(), nullable=True),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('state_code', sa.Text(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'name_key', name='uq_customers_user_id_name_key')
    )
    op.create_table('invoice_series',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('financial_year', sa.Integer(), autoincrement=False, nullable=False),
    sa.Column('next_seq', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id', 'financial_year')
    )
    # batch mode so SQLite (local dev) can add the CHECK constraint
    with op.batch_alter_table('receipts') as batch_op:
        batch_op.add_column(sa.Column('document_type', sa.Text(), server_default='receipt', nullable=False))
        batch_op.create_check_constraint(
            'receipts_document_type_check', "document_type IN ('receipt', 'gst_invoice')"
        )
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('business_address', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('gstin', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('invoice_prefix', sa.Text(), server_default='INV/', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('invoice_prefix')
        batch_op.drop_column('gstin')
        batch_op.drop_column('business_address')
    with op.batch_alter_table('receipts') as batch_op:
        batch_op.drop_constraint('receipts_document_type_check', type_='check')
        batch_op.drop_column('document_type')
    op.drop_table('invoice_series')
    op.drop_table('customers')
    op.drop_table('catalog_items')
