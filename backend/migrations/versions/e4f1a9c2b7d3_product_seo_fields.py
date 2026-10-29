"""product seo fields

Revision ID: e4f1a9c2b7d3
Revises: a71d4f2c9e30
Create Date: 2026-10-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e4f1a9c2b7d3'
down_revision = 'a71d4f2c9e30'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('product', sa.Column('seo_title', sa.String(length=200), nullable=False, server_default=''))
    op.add_column('product', sa.Column('seo_description', sa.String(length=500), nullable=False, server_default=''))
    op.add_column('product', sa.Column('seo_keywords', sa.String(length=500), nullable=False, server_default=''))
    op.add_column('product', sa.Column('og_title', sa.String(length=200), nullable=False, server_default=''))
    op.add_column('product', sa.Column('og_description', sa.String(length=500), nullable=False, server_default=''))
    op.add_column('product', sa.Column('og_image', sa.Text(), nullable=False, server_default=''))
    op.add_column('product', sa.Column('canonical_url', sa.String(length=1000), nullable=False, server_default=''))


def downgrade():
    op.drop_column('product', 'canonical_url')
    op.drop_column('product', 'og_image')
    op.drop_column('product', 'og_description')
    op.drop_column('product', 'og_title')
    op.drop_column('product', 'seo_keywords')
    op.drop_column('product', 'seo_description')
    op.drop_column('product', 'seo_title')
