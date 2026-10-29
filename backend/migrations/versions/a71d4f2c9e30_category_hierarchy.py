"""add parent categories

Revision ID: a71d4f2c9e30
Revises: d52e8f41b9c4
Create Date: 2026-10-29

"""
from alembic import op
import sqlalchemy as sa


revision = 'a71d4f2c9e30'
down_revision = 'd52e8f41b9c4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('category') as batch_op:
        batch_op.add_column(sa.Column('parent_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_category_parent_id', ['parent_id'], unique=False)
        batch_op.create_foreign_key('fk_category_parent_id_category', 'category', ['parent_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE category AS child SET parent_id = parent.id FROM category AS parent WHERE (child.name = 'Used Laptops' AND parent.name = 'Laptops') OR (child.name = 'Used Graphics Cards' AND parent.name = 'Graphics Cards')")


def downgrade():
    with op.batch_alter_table('category') as batch_op:
        batch_op.drop_constraint('fk_category_parent_id_category', type_='foreignkey')
        batch_op.drop_index('ix_category_parent_id')
        batch_op.drop_column('parent_id')
