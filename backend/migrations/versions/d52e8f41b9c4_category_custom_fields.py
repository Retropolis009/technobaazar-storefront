"""category custom fields

Revision ID: d52e8f41b9c4
Revises: c41f2d90a7b3
Create Date: 2026-10-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd52e8f41b9c4'
down_revision = 'c41f2d90a7b3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'category_custom_field',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category_name', sa.String(length=100), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.Column('placeholder', sa.String(length=200), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('category_name', 'label'),
    )
    op.create_index('ix_category_custom_field_category_name', 'category_custom_field', ['category_name'], unique=False)


def downgrade():
    op.drop_index('ix_category_custom_field_category_name', table_name='category_custom_field')
    op.drop_table('category_custom_field')
