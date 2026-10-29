"""nutikals-style store: cms content, guest carts, coupons, cities, richer orders

Revision ID: c41f2d90a7b3
Revises: 9ac4b8d71e02
Create Date: 2026-10-28

"""
from alembic import op
import sqlalchemy as sa


revision = 'c41f2d90a7b3'
down_revision = '9ac4b8d71e02'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'category',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('visible', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
        sa.UniqueConstraint('slug'),
    )
    op.create_index('ix_category_slug', 'category', ['slug'], unique=False)

    op.add_column('product', sa.Column('compare_at_price', sa.Integer(), nullable=True))
    op.add_column('product', sa.Column('track_stock', sa.Boolean(), server_default=sa.true(), nullable=False))

    op.create_table(
        'product_content',
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('subtitle', sa.String(length=500), nullable=False),
        sa.Column('size', sa.String(length=100), nullable=False),
        sa.Column('gallery', sa.JSON(), nullable=False),
        sa.Column('eyebrow', sa.String(length=200), nullable=False),
        sa.Column('intro', sa.Text(), nullable=False),
        sa.Column('notes', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['product.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('product_id'),
    )

    op.create_table(
        'guest_cart',
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('token'),
    )
    op.create_table(
        'guest_cart_item',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cart_token', sa.String(length=64), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['cart_token'], ['guest_cart.token'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['product.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cart_token', 'product_id'),
    )
    op.create_index('ix_guest_cart_item_cart_token', 'guest_cart_item', ['cart_token'], unique=False)

    op.create_table(
        'coupon',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=40), nullable=False),
        sa.Column('discount_type', sa.String(length=12), nullable=False),
        sa.Column('value', sa.Integer(), nullable=False),
        sa.Column('minimum_subtotal', sa.Integer(), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('used_count', sa.Integer(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_coupon_code', 'coupon', ['code'], unique=True)

    op.create_table(
        'store_setting',
        sa.Column('key', sa.String(length=80), nullable=False),
        sa.Column('value', sa.String(length=200), nullable=False),
        sa.PrimaryKeyConstraint('key'),
    )

    op.create_table(
        'delivery_city',
        sa.Column('city_slug', sa.String(length=100), nullable=False),
        sa.Column('city_name', sa.String(length=120), nullable=False),
        sa.Column('delivery_fee', sa.Integer(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('city_slug'),
    )

    with op.batch_alter_table('order', schema=None) as batch_op:
        batch_op.alter_column('customer_id', existing_type=sa.Integer(), nullable=True)
        batch_op.add_column(sa.Column('idempotency_key', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('discount_amount', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('shipping', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('coupon_code', sa.String(length=40), server_default='', nullable=False))
        batch_op.add_column(sa.Column('email', sa.String(length=255), server_default='', nullable=False))
        batch_op.add_column(sa.Column('city', sa.String(length=120), server_default='', nullable=False))
        batch_op.add_column(sa.Column('postal_code', sa.String(length=20), server_default='', nullable=False))
        batch_op.add_column(sa.Column('note', sa.String(length=500), server_default='', nullable=False))
        batch_op.add_column(sa.Column('stock_restored_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index('ix_order_customer_id', ['customer_id'], unique=False)
        batch_op.create_index('ix_order_idempotency_key', ['idempotency_key'], unique=True)

    op.create_table(
        'order_stock_movement',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('restored_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['order.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['product.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id', 'product_id'),
    )
    op.create_index('ix_order_stock_movement_order_id', 'order_stock_movement', ['order_id'], unique=False)

    op.create_table(
        'site_content',
        sa.Column('content_key', sa.String(length=80), nullable=False),
        sa.Column('content_value', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('content_key'),
    )
    op.create_table(
        'site_content_revision',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('editor', sa.String(length=120), nullable=False),
        sa.Column('note', sa.String(length=240), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_site_content_revision_status', 'site_content_revision', ['status'], unique=False)


def downgrade():
    op.drop_index('ix_site_content_revision_status', table_name='site_content_revision')
    op.drop_table('site_content_revision')
    op.drop_table('site_content')
    op.drop_index('ix_order_stock_movement_order_id', table_name='order_stock_movement')
    op.drop_table('order_stock_movement')
    with op.batch_alter_table('order', schema=None) as batch_op:
        batch_op.drop_index('ix_order_idempotency_key')
        batch_op.drop_index('ix_order_customer_id')
        batch_op.drop_column('stock_restored_at')
        batch_op.drop_column('note')
        batch_op.drop_column('postal_code')
        batch_op.drop_column('city')
        batch_op.drop_column('email')
        batch_op.drop_column('coupon_code')
        batch_op.drop_column('shipping')
        batch_op.drop_column('discount_amount')
        batch_op.drop_column('idempotency_key')
        batch_op.alter_column('customer_id', existing_type=sa.Integer(), nullable=False)
    op.drop_table('delivery_city')
    op.drop_table('store_setting')
    op.drop_index('ix_coupon_code', table_name='coupon')
    op.drop_table('coupon')
    op.drop_index('ix_guest_cart_item_cart_token', table_name='guest_cart_item')
    op.drop_table('guest_cart_item')
    op.drop_table('guest_cart')
    op.drop_table('product_content')
    op.drop_column('product', 'track_stock')
    op.drop_column('product', 'compare_at_price')
    op.drop_index('ix_category_slug', table_name='category')
    op.drop_table('category')
