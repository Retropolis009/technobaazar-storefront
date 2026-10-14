"""create customer, cart, favorite, and order tables

Revision ID: 9ac4b8d71e02
Revises: f8168b0c1243
Create Date: 2026-10-14

"""
from alembic import op
import sqlalchemy as sa


revision = '9ac4b8d71e02'
down_revision = 'f8168b0c1243'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('product', sa.Column('stock_quantity', sa.Integer(), server_default='0', nullable=False))
    op.add_column('product', sa.Column('active', sa.Boolean(), server_default=sa.true(), nullable=False))
    op.create_table(
        'customer',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=160), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_customer_email', 'customer', ['email'], unique=True)
    op.create_table(
        'cart_item',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customer.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['product.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('customer_id', 'product_id'),
    )
    op.create_table(
        'favorite',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customer.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['product.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('customer_id', 'product_id'),
    )
    op.create_table(
        'order',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_number', sa.String(length=40), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('payment_method', sa.String(length=30), nullable=False),
        sa.Column('payment_status', sa.String(length=30), nullable=False),
        sa.Column('subtotal', sa.Integer(), nullable=False),
        sa.Column('total', sa.Integer(), nullable=False),
        sa.Column('customer_name', sa.String(length=160), nullable=False),
        sa.Column('phone', sa.String(length=40), nullable=False),
        sa.Column('address', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customer.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_number'),
    )
    op.create_index('ix_order_order_number', 'order', ['order_number'], unique=True)
    op.create_table(
        'order_item',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('product_name', sa.String(length=240), nullable=False),
        sa.Column('product_slug', sa.String(length=180), nullable=False),
        sa.Column('unit_price', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['order.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['product.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('order_item')
    op.drop_index('ix_order_order_number', table_name='order')
    op.drop_table('order')
    op.drop_table('favorite')
    op.drop_table('cart_item')
    op.drop_index('ix_customer_email', table_name='customer')
    op.drop_table('customer')
    with op.batch_alter_table('product') as batch_op:
        batch_op.drop_column('active')
        batch_op.drop_column('stock_quantity')
