import csv
import hashlib
import hmac
import io
import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlparse
from werkzeug.middleware.proxy_fix import ProxyFix

from flask import Flask, jsonify, request, session, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()
migrate = Migrate()

PRODUCT_CATEGORIES = {
    'Graphics Cards', 'Used Graphics Cards', 'Processors', 'Motherboards', 'Memory', 'Storage',
    'Power Supplies', 'Cases & Cooling', 'Laptops', 'Used Laptops', 'Monitors', 'Audio', 'Accessories',
}
CATEGORY_SORT_ORDER = [
    'Graphics Cards', 'Used Graphics Cards', 'Processors', 'Motherboards', 'Memory', 'Storage',
    'Power Supplies', 'Cases & Cooling', 'Laptops', 'Used Laptops', 'Monitors', 'Audio', 'Accessories',
]
CATEGORY_DEFAULT_PARENTS = {
    'Used Graphics Cards': 'Graphics Cards',
    'Used Laptops': 'Laptops',
}
ORDER_STATUSES = {'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'}
PAYMENT_METHODS = {'cash_on_delivery', 'bank_transfer_manual'}
PAYMENT_STATUSES = {'unpaid', 'pending', 'paid', 'due_on_delivery', 'refunded'}
REVISION_STATUSES = {'draft', 'published', 'discarded', 'superseded'}

_rate_lock = threading.Lock()
_rate_buckets = {}

# ---------------------------------------------------------------------------
# Landing / storefront content defaults (Nutikals-style site_content key/value).
# The storefront renders these values; the admin console edits them with a
# draft -> publish workflow. Structured fields are stored as JSON strings.
# ---------------------------------------------------------------------------
SITE_CONTENT_DEFAULTS = {
    'announcement': 'GOOD GEAR, DELIVERED NATIONWIDE',
    'hero_eyebrow': 'THE NEXT BUILD STARTS HERE',
    'hero_title_top': 'Make your',
    'hero_title_bottom': 'setup',
    'hero_title_accent': 'unstoppable.',
    'hero_subtitle': 'From your first build to your next big upgrade, find the gear that keeps up with you.',
    'hero_cta_text': 'Explore All Gear',
    'hero_cta_url': '/collections/all-gear',
    'hero_social_proof': 'Picked by people who know their specs.',
    'hero_image': 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1400&q=90',
    'hero_image_alt': 'A high-performance gaming PC setup with illuminated components',
    'hero_card_kicker': 'YOUR NEXT UPGRADE',
    'hero_card_title': 'Starts with one part.',
    'hero_badge': 'BUILD YOUR WAY',
    'departments_kicker': 'Find your frequency',
    'departments_title': 'Shop by department',
    'featured_kicker': 'The good stuff',
    'featured_title': 'Worth a closer look.',
    'featured_subtitle': 'Hand-picked tech for work, play, and everything between.',
    'benefits': json.dumps([
        {'title': 'Across Pakistan', 'detail': 'Carefully packed, right to your door.'},
        {'title': 'Gear you can trust', 'detail': 'Authentic products with local warranty.'},
        {'title': 'Real human help', 'detail': 'Get advice before you hit checkout.'},
    ]),
    'checkout_note': 'Cash on delivery available. Final stock and prices are confirmed by the store.',
    'delivery_note': 'Nationwide delivery across Pakistan.',
    'payment_note': 'Pay cash on delivery, or transfer to the account shared after checkout.',
    'order_confirmation_note': 'After your order, our team contacts you by phone or WhatsApp to confirm delivery.',
    'header_brand_prefix': 'TECHNO',
    'header_brand_accent': 'BAAZAR',
    'header_tagline': 'SUPPLY CO.',
    'header_search_placeholder': 'Search laptops, components, gear...',
    'header_mobile_search_placeholder': 'Search the store',
    'header_about_text': 'Why TechnoBaazar',
    'footer_brand_text': 'TECHNOBAAZAR',
    'footer_tagline': 'Good gear for whatever you\u2019re building.',
    'footer_admin_text': 'Admin',
    'footer_home_text': 'Back to home',
    'seo_site_title': 'TechnoBaazar \u2014 Computer Store in Pakistan',
    'seo_site_description': 'Shop graphics cards, processors, laptops, and gaming gear online in Pakistan with nationwide delivery and local warranty.',
    'seo_site_keywords': 'computer store pakistan, gaming pc, graphics cards, laptops, processors, technobaazar',
    'seo_og_image': 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=80',
    'seo_canonical_base': '',
    'seo_google_verification': '',
    'seo_bing_verification': '',
    'seo_google_analytics_id': '',
    'seo_google_tag_manager_id': '',
    'seo_meta_pixel_id': '',
    'seo_robots_txt': 'User-agent: *\nAllow: /',
    'seo_business_name': 'TechnoBaazar',
    'seo_business_legal_name': '',
    'seo_business_phone': '',
    'seo_business_email': '',
    'seo_business_street': '',
    'seo_business_city': 'Karachi',
    'seo_business_region': 'Sindh',
    'seo_business_postal_code': '',
    'seo_business_country': 'PK',
    'seo_business_logo': '',
    'seo_social_facebook': '',
    'seo_social_instagram': '',
    'seo_social_tiktok': '',
    'seo_social_youtube': '',
    'seo_social_x': '',
    'seo_about_title': 'About | TechnoBaazar',
    'seo_about_description': '',
    'seo_cart_title': 'Shopping Cart | TechnoBaazar',
    'seo_cart_description': '',
    'seo_favorites_title': 'Your Favorites | TechnoBaazar',
    'seo_favorites_description': '',
    'seo_account_title': 'My Account | TechnoBaazar',
    'seo_account_description': '',
}
SITE_CONTENT_URL_FIELDS = {'hero_cta_url', 'hero_image', 'seo_og_image', 'seo_business_logo', 'seo_social_facebook', 'seo_social_instagram', 'seo_social_tiktok', 'seo_social_youtube', 'seo_social_x'}
SITE_CONTENT_STRUCTURED_FIELDS = {'benefits'}
SITE_CONTENT_LIMITS = {key: 500 for key in SITE_CONTENT_DEFAULTS}
SITE_CONTENT_LIMITS.update({'hero_subtitle': 500, 'featured_subtitle': 500, 'benefits': 4000,
                             'checkout_note': 500, 'delivery_note': 300, 'payment_note': 500,
                             'order_confirmation_note': 500, 'footer_tagline': 300,
                             'hero_image': 2000, 'hero_image_alt': 300, 'hero_cta_url': 1000,
                             'header_brand_prefix': 40, 'header_brand_accent': 40, 'header_tagline': 60,
                             'header_search_placeholder': 120, 'header_mobile_search_placeholder': 120,
                             'header_about_text': 60, 'footer_brand_text': 60,
                             'footer_admin_text': 40, 'footer_home_text': 60,
                             'seo_site_title': 200, 'seo_site_description': 500,
                             'seo_site_keywords': 500, 'seo_og_image': 2000,
                             'seo_canonical_base': 500, 'seo_robots_txt': 8000,
                             'seo_google_verification': 200, 'seo_bing_verification': 200,
                             'seo_google_analytics_id': 100, 'seo_google_tag_manager_id': 100,
                             'seo_meta_pixel_id': 100, 'seo_business_name': 200,
                             'seo_business_legal_name': 200, 'seo_business_phone': 40,
                             'seo_business_email': 254, 'seo_business_street': 300,
                             'seo_business_city': 120, 'seo_business_region': 120,
                             'seo_business_postal_code': 24, 'seo_business_country': 2,
                             'seo_business_logo': 2000,
                             'seo_about_title': 200, 'seo_about_description': 500,
                             'seo_cart_title': 200, 'seo_cart_description': 500,
                             'seo_favorites_title': 200, 'seo_favorites_description': 500,
                             'seo_account_title': 200, 'seo_account_description': 500})

DELIVERY_CITIES_SEED = [
    ('karachi', 'Karachi', 350), ('lahore', 'Lahore', 350), ('islamabad', 'Islamabad', 350),
    ('rawalpindi', 'Rawalpindi', 350), ('faisalabad', 'Faisalabad', 350), ('multan', 'Multan', 350),
    ('peshawar', 'Peshawar', 350), ('quetta', 'Quetta', 350), ('hyderabad', 'Hyderabad', 350),
    ('gujranwala', 'Gujranwala', 350), ('sialkot', 'Sialkot', 350), ('bahawalpur', 'Bahawalpur', 350),
    ('sargodha', 'Sargodha', 350), ('sukkur', 'Sukkur', 350), ('abbottabad', 'Abbottabad', 400),
    ('mardan', 'Mardan', 400), ('gujrat', 'Gujrat', 400), ('sahiwal', 'Sahiwal', 400),
    ('okara', 'Okara', 400), ('wah-cantt', 'Wah Cantt', 400), ('jhelum', 'Jhelum', 400),
    ('mirpur', 'Mirpur', 450), ('gilgit', 'Gilgit', 500), ('muzaffarabad', 'Muzaffarabad', 500),
]

UPLOAD_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
UPLOAD_MAX_BYTES = 5 * 1024 * 1024

# Starter specification shortcuts per category: (label, placeholder) pairs.
CATEGORY_FIELD_SEEDS = {
    'Graphics Cards': [('Chipset', 'e.g. GeForce RTX 5070'), ('Memory', 'e.g. 12GB GDDR7'),
                       ('Interface', 'e.g. PCI Express 5.0'), ('Cooling', 'e.g. Dual-fan')],
    'Used Graphics Cards': [('Chipset', 'e.g. GeForce RTX 3060'), ('Memory', 'e.g. 12GB GDDR6'),
                            ('Condition', 'e.g. Tested, light use'), ('Warranty', 'e.g. 7-day check warranty')],
    'Processors': [('Cores', 'e.g. 8 cores / 16 threads'), ('Boost clock', 'e.g. Up to 5.2GHz'),
                   ('Socket', 'e.g. AM5'), ('Cache', 'e.g. 96MB 3D V-Cache')],
    'Motherboards': [('Chipset', 'e.g. AMD B650'), ('Socket', 'e.g. AM5'),
                     ('Memory', 'e.g. DDR5 support'), ('Form factor', 'e.g. ATX')],
    'Memory': [('Capacity', 'e.g. 32GB total'), ('Kit', 'e.g. 2 x 16GB'),
               ('Speed', 'e.g. 6000MT/s'), ('Type', 'e.g. DDR5')],
    'Storage': [('Capacity', 'e.g. 1TB'), ('Form factor', 'e.g. M.2 2280'),
                ('Interface', 'e.g. PCIe 4.0 NVMe'), ('Read speed', 'e.g. Up to 6000MB/s')],
    'Power Supplies': [('Output', 'e.g. 850W continuous'), ('Efficiency', 'e.g. 80 PLUS Gold'),
                       ('Modularity', 'e.g. Fully modular'), ('Standards', 'e.g. ATX 3.1')],
    'Cases & Cooling': [('Form factor', 'e.g. Mid-tower, ATX'), ('Front panel', 'e.g. Mesh'),
                        ('Included fans', 'e.g. Four ARGB fans'), ('Side panel', 'e.g. Tempered glass')],
    'Laptops': [('Processor', 'e.g. Core Ultra 7'), ('Memory', 'e.g. 16GB'),
                ('Storage', 'e.g. 1TB NVMe SSD'), ('Display', 'e.g. 14-inch high-resolution')],
    'Used Laptops': [('Processor', 'e.g. Core i7 12th gen'), ('Memory', 'e.g. 16GB'),
                     ('Condition', 'e.g. Grade A, new battery'), ('Warranty', 'e.g. 7-day check warranty')],
    'Monitors': [('Panel', 'e.g. 27-inch QHD IPS'), ('Refresh rate', 'e.g. 180Hz'),
                 ('Response time', 'e.g. 1ms'), ('Sync', 'e.g. Adaptive sync')],
    'Audio': [('Type', 'e.g. Over-ear wireless'), ('Battery', 'e.g. Up to 40 hours'),
              ('Connection', 'e.g. Bluetooth'), ('Noise control', 'e.g. Active cancellation')],
    'Accessories': [('Compatibility', 'e.g. Windows and Mac'), ('Connection', 'e.g. USB-C / wireless'),
                    ('Layout', 'e.g. 75% compact'), ('Extra', 'e.g. Hot-swappable')],
}


class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)


class CatalogState(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    initialized = db.Column(db.Boolean, nullable=False, default=False)


class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False, index=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    visible = db.Column(db.Boolean, nullable=False, default=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('category.id', ondelete='CASCADE'), nullable=True, index=True)
    parent = db.relationship('Category', remote_side=[id], backref=db.backref('children', lazy='select'))

    def as_dict(self):
        return {'id': self.id, 'name': self.name, 'slug': self.slug,
                'sortOrder': self.sort_order, 'visible': self.visible,
                'parentId': self.parent_id, 'parentName': self.parent.name if self.parent else None}


class CategoryCustomField(db.Model):
    """Per-category specification shortcuts. The admin defines labels once per
    category (e.g. VRAM, Chipset for Graphics Cards); the product editor then
    offers them as one-click rows so listings stay consistent."""
    id = db.Column(db.Integer, primary_key=True)
    category_name = db.Column(db.String(100), nullable=False, index=True)
    label = db.Column(db.String(100), nullable=False)
    placeholder = db.Column(db.String(200), nullable=False, default='')
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    __table_args__ = (db.UniqueConstraint('category_name', 'label'),)

    def as_dict(self):
        return {'id': self.id, 'category': self.category_name, 'label': self.label,
                'placeholder': self.placeholder, 'sortOrder': self.sort_order}


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(180), unique=True, nullable=False, index=True)
    name = db.Column(db.String(240), nullable=False)
    category = db.Column(db.String(100), nullable=False, index=True)
    brand = db.Column(db.String(120), nullable=False)
    detail = db.Column(db.String(300), nullable=False, default='')
    description = db.Column(db.Text, nullable=False, default='')
    specifications = db.Column(db.JSON, nullable=False, default=list)
    price_value = db.Column(db.Integer, nullable=False)
    compare_at_price = db.Column(db.Integer, nullable=True)
    track_stock = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())
    badge = db.Column(db.String(100), nullable=False, default='')
    image = db.Column(db.Text, nullable=False, default='')
    image_alt = db.Column(db.String(300), nullable=False, default='')
    seo_title = db.Column(db.String(200), nullable=False, default='')
    seo_description = db.Column(db.String(500), nullable=False, default='')
    seo_keywords = db.Column(db.String(500), nullable=False, default='')
    og_title = db.Column(db.String(200), nullable=False, default='')
    og_description = db.Column(db.String(500), nullable=False, default='')
    og_image = db.Column(db.Text, nullable=False, default='')
    canonical_url = db.Column(db.String(1000), nullable=False, default='')
    stock_quantity = db.Column(db.Integer, nullable=False, default=0, server_default='0')
    active = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())

    def as_dict(self, content=None):
        return {
            'slug': self.slug, 'name': self.name, 'category': self.category,
            'brand': self.brand, 'detail': self.detail, 'description': self.description,
            'specifications': self.specifications or [],
            'price': f"Rs. {self.price_value:,}", 'priceValue': self.price_value,
            'compareAtPrice': self.compare_at_price,
            'compareAt': f"Rs. {self.compare_at_price:,}" if self.compare_at_price else None,
            'trackStock': self.track_stock,
            'badge': self.badge, 'image': self.image, 'imageAlt': self.image_alt,
            'stockQuantity': self.stock_quantity, 'active': self.active,
            'seo': {'title': self.seo_title or '', 'description': self.seo_description or '',
                    'keywords': self.seo_keywords or '', 'ogTitle': self.og_title or '',
                    'ogDescription': self.og_description or '', 'ogImage': self.og_image or '',
                    'canonicalUrl': self.canonical_url or ''},
            'content': (content or {}).as_dict() if content is not None and not isinstance(content, dict) else (content or ProductContent.blank()),
        }


class ProductContent(db.Model):
    """Customizable product-page blocks (Nutikals-style product_content)."""
    product_id = db.Column(db.Integer, db.ForeignKey('product.id', ondelete='CASCADE'), primary_key=True)
    product = db.relationship('Product', backref=db.backref('page_content', uselist=False, cascade='all, delete-orphan'))
    subtitle = db.Column(db.String(500), nullable=False, default='')
    size = db.Column(db.String(100), nullable=False, default='')
    gallery = db.Column(db.JSON, nullable=False, default=list)
    eyebrow = db.Column(db.String(200), nullable=False, default='')
    intro = db.Column(db.Text, nullable=False, default='')
    notes = db.Column(db.JSON, nullable=False, default=list)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def as_dict(self):
        return {'subtitle': self.subtitle or '', 'size': self.size or '', 'gallery': self.gallery or [],
                'eyebrow': self.eyebrow or '', 'intro': self.intro or '', 'notes': self.notes or []}

    @staticmethod
    def blank():
        return {'subtitle': '', 'size': '', 'gallery': [], 'eyebrow': '', 'intro': '', 'notes': []}


class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    name = db.Column(db.String(160), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class CartItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id', ondelete='CASCADE'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id', ondelete='CASCADE'), nullable=False)
    product = db.relationship('Product')
    quantity = db.Column(db.Integer, nullable=False, default=1)
    __table_args__ = (db.UniqueConstraint('customer_id', 'product_id'),)


class Favorite(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id', ondelete='CASCADE'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id', ondelete='CASCADE'), nullable=False)
    product = db.relationship('Product')
    __table_args__ = (db.UniqueConstraint('customer_id', 'product_id'),)


class GuestCart(db.Model):
    token = db.Column(db.String(64), primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class GuestCartItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cart_token = db.Column(db.String(64), db.ForeignKey('guest_cart.token', ondelete='CASCADE'), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id', ondelete='CASCADE'), nullable=False)
    product = db.relationship('Product')
    quantity = db.Column(db.Integer, nullable=False, default=1)
    __table_args__ = (db.UniqueConstraint('cart_token', 'product_id'),)


class Coupon(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(40), unique=True, nullable=False, index=True)
    discount_type = db.Column(db.String(12), nullable=False)
    value = db.Column(db.Integer, nullable=False)
    minimum_subtotal = db.Column(db.Integer, nullable=False, default=0)
    starts_at = db.Column(db.DateTime(timezone=True), nullable=True)
    ends_at = db.Column(db.DateTime(timezone=True), nullable=True)
    max_uses = db.Column(db.Integer, nullable=True)
    used_count = db.Column(db.Integer, nullable=False, default=0)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def as_dict(self):
        return {'id': self.id, 'code': self.code, 'discountType': self.discount_type, 'value': self.value,
                'minimumSubtotal': self.minimum_subtotal,
                'startsAt': self.starts_at.isoformat() if self.starts_at else None,
                'endsAt': self.ends_at.isoformat() if self.ends_at else None,
                'maxUses': self.max_uses, 'usedCount': self.used_count, 'active': self.active}


class StoreSetting(db.Model):
    key = db.Column(db.String(80), primary_key=True)
    value = db.Column(db.String(200), nullable=False, default='')


class DeliveryCity(db.Model):
    city_slug = db.Column(db.String(100), primary_key=True)
    city_name = db.Column(db.String(120), nullable=False)
    delivery_fee = db.Column(db.Integer, nullable=False, default=350)
    active = db.Column(db.Boolean, nullable=False, default=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)

    def as_dict(self):
        return {'slug': self.city_slug, 'name': self.city_name, 'fee': self.delivery_fee, 'active': self.active}


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(40), unique=True, nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=True, index=True)
    idempotency_key = db.Column(db.String(64), unique=True, nullable=True, index=True)
    status = db.Column(db.String(30), nullable=False, default='pending')
    payment_method = db.Column(db.String(30), nullable=False, default='cash_on_delivery')
    payment_status = db.Column(db.String(30), nullable=False, default='unpaid')
    subtotal = db.Column(db.Integer, nullable=False)
    discount_amount = db.Column(db.Integer, nullable=False, default=0)
    shipping = db.Column(db.Integer, nullable=False, default=0)
    total = db.Column(db.Integer, nullable=False)
    coupon_code = db.Column(db.String(40), nullable=False, default='')
    customer_name = db.Column(db.String(160), nullable=False)
    phone = db.Column(db.String(40), nullable=False)
    email = db.Column(db.String(255), nullable=False, default='')
    address = db.Column(db.Text, nullable=False)
    city = db.Column(db.String(120), nullable=False, default='')
    postal_code = db.Column(db.String(20), nullable=False, default='')
    note = db.Column(db.String(500), nullable=False, default='')
    stock_restored_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def as_dict(self):
        return {
            'orderNumber': self.order_number, 'status': self.status,
            'paymentMethod': self.payment_method, 'paymentStatus': self.payment_status,
            'subtotal': self.subtotal, 'discountAmount': self.discount_amount,
            'shipping': self.shipping, 'total': self.total, 'couponCode': self.coupon_code,
            'customerName': self.customer_name, 'phone': self.phone, 'email': self.email,
            'address': self.address, 'city': self.city, 'postalCode': self.postal_code,
            'note': self.note,
            'createdAt': self.created_at.isoformat(),
            'items': [item.as_dict() for item in self.items],
        }


class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id', ondelete='CASCADE'), nullable=False)
    order = db.relationship('Order', backref=db.backref('items', cascade='all, delete-orphan'))
    product_id = db.Column(db.Integer, db.ForeignKey('product.id', ondelete='SET NULL'), nullable=True)
    product_name = db.Column(db.String(240), nullable=False)
    product_slug = db.Column(db.String(180), nullable=False)
    unit_price = db.Column(db.Integer, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)

    def as_dict(self):
        return {'name': self.product_name, 'slug': self.product_slug, 'unitPrice': self.unit_price, 'quantity': self.quantity}


class OrderStockMovement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id', ondelete='CASCADE'), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id', ondelete='SET NULL'), nullable=True)
    quantity = db.Column(db.Integer, nullable=False)
    restored_at = db.Column(db.DateTime(timezone=True), nullable=True)
    __table_args__ = (db.UniqueConstraint('order_id', 'product_id'),)


class SiteContent(db.Model):
    content_key = db.Column(db.String(80), primary_key=True)
    content_value = db.Column(db.Text, nullable=False, default='')
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class SiteContentRevision(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.JSON, nullable=False, default=dict)
    status = db.Column(db.String(20), nullable=False, index=True)
    editor = db.Column(db.String(120), nullable=False, default='system')
    note = db.Column(db.String(240), nullable=False, default='')
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    published_at = db.Column(db.DateTime(timezone=True), nullable=True)


def slugify(value):
    slug = re.sub(r'[^a-z0-9]+', '-', (value or '').lower()).strip('-')
    return slug


def is_local_or_http_url(value):
    if not isinstance(value, str) or not value or len(value) > 2000:
        return False
    if value.startswith(('/', '#', './', '../')):
        return True
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    return parsed.scheme in {'http', 'https'} and bool(parsed.netloc)


def parse_allowed_origins(raw):
    """FRONTEND_ORIGIN may be one origin or a comma-separated list."""
    origins = [part.strip().rstrip('/') for part in (raw or '').split(',') if part.strip()]
    return origins or ['http://localhost:5173']


def origin_allowed(origin, allowed_origins, production):
    """Exact-match the configured origins. Outside production, also trust
    local hosts and https sandbox previews so the app can be tested from
    hosted preview URLs without weakening production."""
    normalized = (origin or '').rstrip('/')
    if normalized in allowed_origins:
        return True
    if production or not normalized:
        return False
    try:
        parsed = urlparse(normalized)
    except ValueError:
        return False
    host = (parsed.hostname or '').lower()
    if parsed.scheme in {'http', 'https'} and host in {'localhost', '127.0.0.1'}:
        return True
    return parsed.scheme == 'https' and host.endswith('.e2b.app')


def create_app():
    app = Flask(__name__)
    production = os.environ.get('APP_ENV', '').lower() == 'production'
    allowed_origins = parse_allowed_origins(os.environ.get('FRONTEND_ORIGIN', 'http://localhost:5173'))
    secret_key = os.environ.get('FLASK_SECRET_KEY')
    trusted_proxy_hops = int(os.environ.get('TRUSTED_PROXY_HOPS', '0'))
    if not 0 <= trusted_proxy_hops <= 5:
        raise RuntimeError('TRUSTED_PROXY_HOPS must be between 0 and 5.')
    if production and (not secret_key or secret_key == 'dev-only-change-me'):
        raise RuntimeError('Set a unique FLASK_SECRET_KEY before starting in production.')
    upload_dir = os.environ.get('UPLOAD_DIR') or str(Path(__file__).with_name('uploads'))
    Path(upload_dir).mkdir(parents=True, exist_ok=True)
    app.config.update(
        SECRET_KEY=secret_key or 'dev-only-change-me',
        SQLALCHEMY_DATABASE_URI=os.environ.get('DATABASE_URL', 'sqlite:///store.db'),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        MAX_CONTENT_LENGTH=UPLOAD_MAX_BYTES + 1024 * 1024,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        SESSION_COOKIE_SECURE=production or any(origin.startswith('https://') for origin in allowed_origins),
        UPLOAD_DIR=upload_dir,
    )
    db.init_app(app)
    migrate.init_app(app, db)
    if trusted_proxy_hops:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=trusted_proxy_hops, x_proto=trusted_proxy_hops)
    CORS(app, origins=allowed_origins, supports_credentials=True)

    @app.before_request
    def enforce_origin_for_mutations():
        if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'}:
            if not origin_allowed(request.headers.get('Origin'), allowed_origins, production):
                return jsonify({'error': 'Request origin is not allowed.'}), 403

    @app.errorhandler(413)
    def request_too_large(_error):
        return jsonify({'error': 'Request body is too large.'}), 413

    @app.after_request
    def add_security_headers(response):
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('X-Frame-Options', 'DENY')
        response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.headers.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        if production:
            response.headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
        return response

    def rate_limit(limit, window_seconds, bucket_name):
        def decorate(handler):
            def wrapped(*args, **kwargs):
                now = datetime.now(timezone.utc).timestamp()
                ip = request.remote_addr or 'unknown'
                key = (bucket_name, ip)
                with _rate_lock:
                    timestamps = [stamp for stamp in _rate_buckets.get(key, []) if now - stamp < window_seconds]
                    if len(timestamps) >= limit:
                        _rate_buckets[key] = timestamps
                        return jsonify({'error': 'Too many attempts. Please try again later.'}), 429
                    timestamps.append(now)
                    _rate_buckets[key] = timestamps
                return handler(*args, **kwargs)
            wrapped.__name__ = handler.__name__
            return wrapped
        return decorate

    def json_object(max_bytes=100 * 1024):
        if (request.content_length or 0) > max_bytes:
            return None
        value = request.get_json(silent=True)
        return value if isinstance(value, dict) else None

    def valid_text(data, key, maximum, required=False):
        value = data.get(key)
        if not isinstance(value, str):
            return None if not required and value is None else False
        value = value.strip()
        return value if (value or not required) and len(value) <= maximum else False

    def positive_int(value, *, allow_zero=False):
        if isinstance(value, bool):
            return None
        try:
            number = int(value)
        except (TypeError, ValueError, OverflowError):
            return None
        if str(number) != str(value).strip() or number < (0 if allow_zero else 1):
            return None
        return number

    # -- store defaults / settings -------------------------------------------
    def ensure_store_defaults():
        """Idempotent seed for settings, cities, categories, and content."""
        try:
            if not db.session.get(StoreSetting, 'delivery_fee'):
                db.session.add(StoreSetting(key='delivery_fee', value='350'))
            if not db.session.get(StoreSetting, 'free_delivery_threshold'):
                db.session.add(StoreSetting(key='free_delivery_threshold', value='0'))
            if not db.session.get(StoreSetting, 'low_stock_threshold'):
                db.session.add(StoreSetting(key='low_stock_threshold', value='3'))
            for index, name in enumerate(CATEGORY_SORT_ORDER):
                if not Category.query.filter_by(name=name).first():
                    parent_name = CATEGORY_DEFAULT_PARENTS.get(name)
                    parent = Category.query.filter_by(name=parent_name).first() if parent_name else None
                    db.session.add(Category(name=name, slug=slugify(name), sort_order=(index + 1) * 10,
                                            visible=True, parent=parent))
            for category_name, fields in CATEGORY_FIELD_SEEDS.items():
                for order, (label, placeholder) in enumerate(fields):
                    if not CategoryCustomField.query.filter_by(category_name=category_name, label=label).first():
                        db.session.add(CategoryCustomField(category_name=category_name, label=label,
                                                           placeholder=placeholder, sort_order=(order + 1) * 10))
            for index, (city_slug, city_name, fee) in enumerate(DELIVERY_CITIES_SEED):
                if not db.session.get(DeliveryCity, city_slug):
                    db.session.add(DeliveryCity(city_slug=city_slug, city_name=city_name,
                                                delivery_fee=fee, active=True, sort_order=(index + 1) * 10))
            published = SiteContentRevision.query.filter_by(status='published').order_by(SiteContentRevision.id.desc()).first()
            existing_keys = {row.content_key for row in SiteContent.query.all()} if not published else set()
            if not published and len(existing_keys) < len(SITE_CONTENT_DEFAULTS):
                for key, value in SITE_CONTENT_DEFAULTS.items():
                    if key not in existing_keys:
                        db.session.add(SiteContent(content_key=key, content_value=value))
                db.session.flush()
                db.session.add(SiteContentRevision(content=dict(SITE_CONTENT_DEFAULTS), status='published',
                                                   editor='system', note='Initial published content',
                                                   published_at=datetime.now(timezone.utc)))
            db.session.commit()
        except Exception:
            db.session.rollback()

    def setting_int(key, default):
        row = db.session.get(StoreSetting, key)
        try:
            return max(0, int(row.value)) if row else default
        except (TypeError, ValueError):
            return default

    def delivery_fee_for_city(city_name):
        city = DeliveryCity.query.filter_by(city_slug=slugify(city_name or ''), active=True).first()
        if city:
            return city.delivery_fee
        return setting_int('delivery_fee', 350)

    def shipping_for_subtotal(discounted_subtotal, city_name):
        threshold = setting_int('free_delivery_threshold', 0)
        if threshold > 0 and discounted_subtotal >= threshold:
            return 0
        return delivery_fee_for_city(city_name)

    # -- site content ----------------------------------------------------------
    def normalize_site_content(values):
        content = dict(SITE_CONTENT_DEFAULTS)
        if isinstance(values, dict):
            for key in SITE_CONTENT_DEFAULTS:
                if key in values and isinstance(values[key], str):
                    content[key] = values[key]
        return content

    def read_published_site_content():
        revision = SiteContentRevision.query.filter_by(status='published').order_by(SiteContentRevision.id.desc()).first()
        if revision and isinstance(revision.content, dict):
            return normalize_site_content(revision.content)
        rows = SiteContent.query.all()
        if rows:
            return normalize_site_content({row.content_key: row.content_value for row in rows})
        ensure_store_defaults()
        return dict(SITE_CONTENT_DEFAULTS)

    def read_working_site_content():
        draft = SiteContentRevision.query.filter_by(status='draft').order_by(SiteContentRevision.id.desc()).first()
        if draft and isinstance(draft.content, dict):
            content = normalize_site_content(draft.content)
            content['_revision_id'] = draft.id
            content['_has_draft'] = True
            return content
        published = read_published_site_content()
        revision = SiteContentRevision.query.filter_by(status='published').order_by(SiteContentRevision.id.desc()).first()
        published['_revision_id'] = revision.id if revision else None
        published['_has_draft'] = False
        return published

    def validate_site_content(values):
        if not isinstance(values, dict):
            return None
        cleaned = {}
        for key, default in SITE_CONTENT_DEFAULTS.items():
            if key not in values:
                continue
            value = values[key]
            if not isinstance(value, str) or len(value) > SITE_CONTENT_LIMITS[key]:
                return None
            value = value.strip() if key != 'benefits' else value.strip()
            if key in SITE_CONTENT_URL_FIELDS and value and not is_local_or_http_url(value):
                return None
            if key == 'seo_robots_txt' and any(ord(char) < 32 and char not in '\n\r\t' for char in value):
                return None
            if key == 'seo_google_analytics_id' and value and not re.fullmatch(r'G-[A-Z0-9]+', value):
                return None
            if key == 'seo_google_tag_manager_id' and value and not re.fullmatch(r'GTM-[A-Z0-9]+', value):
                return None
            if key == 'seo_meta_pixel_id' and value and not re.fullmatch(r'[0-9]{5,20}', value):
                return None
            if key == 'benefits':
                try:
                    benefits = json.loads(value) if value else []
                except (ValueError, TypeError):
                    return None
                if not isinstance(benefits, list) or len(benefits) > 6:
                    return None
                for benefit in benefits:
                    if (not isinstance(benefit, dict) or not isinstance(benefit.get('title'), str)
                            or not isinstance(benefit.get('detail'), str) or len(benefit['title']) > 80
                            or len(benefit['detail']) > 200):
                        return None
                value = json.dumps([{'title': b['title'].strip(), 'detail': b['detail'].strip()} for b in benefits])
            cleaned[key] = value
        return cleaned

    # -- products ---------------------------------------------------------------
    def content_map_for(product_ids):
        if not product_ids:
            return {}
        rows = ProductContent.query.filter(ProductContent.product_id.in_(list(product_ids))).all()
        return {row.product_id: row for row in rows}

    def serialize_products(products):
        contents = content_map_for([product.id for product in products])
        return [product.as_dict(contents.get(product.id)) for product in products]

    def validate_product_content(payload):
        if not isinstance(payload, dict):
            return None
        eyebrow = payload.get('eyebrow', '')
        subtitle = payload.get('subtitle', '')
        size = payload.get('size', '')
        intro = payload.get('intro', '')
        gallery = payload.get('gallery', [])
        notes = payload.get('notes', [])
        if not isinstance(eyebrow, str) or len(eyebrow) > 200:
            return None
        if not isinstance(subtitle, str) or len(subtitle) > 500:
            return None
        if not isinstance(size, str) or len(size) > 100:
            return None
        if not isinstance(intro, str) or len(intro) > 2000:
            return None
        if not isinstance(gallery, list) or len(gallery) > 8:
            return None
        for url in gallery:
            if not isinstance(url, str) or not url.strip() or not is_local_or_http_url(url.strip()):
                return None
        if not isinstance(notes, list) or len(notes) > 20:
            return None
        for note in notes:
            if (not isinstance(note, dict) or not isinstance(note.get('label'), str)
                    or not isinstance(note.get('value'), str) or len(note['label']) > 120
                    or len(note['value']) > 500):
                return None
        return {'eyebrow': eyebrow.strip(), 'subtitle': subtitle.strip(), 'size': size.strip(),
                'intro': intro.strip(), 'gallery': [url.strip() for url in gallery],
                'notes': [{'label': n['label'].strip(), 'value': n['value'].strip()} for n in notes]}

    # -- carts (customer + guest, Nutikals-style server carts) -------------------
    def current_customer():
        customer_id = session.get('customer_id')
        return db.session.get(Customer, customer_id) if customer_id else None

    def guest_cart_token(create=False):
        token = session.get('guest_cart_token')
        if token and not re.fullmatch(r'[a-f0-9]{32}', token or ''):
            token = None
        if not token and create:
            token = uuid4().hex
            session['guest_cart_token'] = token
            if not db.session.get(GuestCart, token):
                db.session.add(GuestCart(token=token))
                db.session.commit()
        return token

    def read_cart_lines():
        customer = current_customer()
        if customer:
            items = CartItem.query.filter_by(customer_id=customer.id).all()
        else:
            token = guest_cart_token()
            items = GuestCartItem.query.filter_by(cart_token=token).all() if token else []
        return [{'slug': item.product.slug, 'quantity': item.quantity}
                for item in items if item.product and item.product.active]

    def write_cart_lines(entries):
        """Validate and persist cart lines for the current customer or guest."""
        if not isinstance(entries, list) or len(entries) > 100:
            return None, 'Cart must contain at most 100 items.'
        normalized = {}
        for entry in entries:
            if not isinstance(entry, dict) or not isinstance(entry.get('slug'), str):
                return None, 'Each cart item needs a product slug and quantity.'
            quantity = positive_int(entry.get('quantity'))
            if not quantity or quantity > 99 or entry['slug'] in normalized:
                return None, 'Cart quantities must be unique and between 1 and 99.'
            product = Product.query.filter_by(slug=entry['slug'], active=True).first()
            if not product:
                return None, 'Cart contains an unavailable product.'
            normalized[product.id] = quantity
        customer = current_customer()
        if customer:
            CartItem.query.filter_by(customer_id=customer.id).delete()
            for product_id, quantity in normalized.items():
                db.session.add(CartItem(customer_id=customer.id, product_id=product_id, quantity=quantity))
        else:
            token = guest_cart_token(create=True)
            GuestCartItem.query.filter_by(cart_token=token).delete()
            for product_id, quantity in normalized.items():
                db.session.add(GuestCartItem(cart_token=token, product_id=product_id, quantity=quantity))
        db.session.commit()
        return normalized, None

    def merge_guest_cart_into_customer(customer):
        token = session.get('guest_cart_token')
        if not token:
            return
        guest_items = GuestCartItem.query.filter_by(cart_token=token).all()
        if guest_items:
            existing = {item.product_id: item for item in CartItem.query.filter_by(customer_id=customer.id).all()}
            for guest_item in guest_items:
                product = guest_item.product
                if not product or not product.active:
                    continue
                if guest_item.product_id in existing:
                    existing[guest_item.product_id].quantity = min(99, existing[guest_item.product_id].quantity + guest_item.quantity)
                else:
                    db.session.add(CartItem(customer_id=customer.id, product_id=guest_item.product_id,
                                            quantity=min(99, guest_item.quantity)))
            GuestCartItem.query.filter_by(cart_token=token).delete()
            db.session.commit()
        session.pop('guest_cart_token', None)

    def clear_current_cart(customer_id=None, guest_token=None):
        customer = current_customer()
        if customer_id is None and customer:
            customer_id = customer.id
        if guest_token is None:
            guest_token = session.get('guest_cart_token')
        if customer_id:
            CartItem.query.filter_by(customer_id=customer_id).delete()
        if guest_token:
            GuestCartItem.query.filter_by(cart_token=guest_token).delete()

    # -- coupons -----------------------------------------------------------------
    def lookup_coupon(code, subtotal):
        normalized = (code or '').strip().upper()
        if not re.fullmatch(r'[A-Z0-9_-]{3,40}', normalized):
            return None, 'This coupon code can\u2019t be applied. Check it and try again.'
        coupon = Coupon.query.filter(db.func.lower(Coupon.code) == normalized.lower()).first()
        now = datetime.now(timezone.utc)
        if not coupon or not coupon.active:
            return None, 'This coupon code can\u2019t be applied to this order.'
        starts = coupon.starts_at.replace(tzinfo=timezone.utc) if coupon.starts_at and coupon.starts_at.tzinfo is None else coupon.starts_at
        ends = coupon.ends_at.replace(tzinfo=timezone.utc) if coupon.ends_at and coupon.ends_at.tzinfo is None else coupon.ends_at
        if (starts and starts > now) or (ends and ends <= now):
            return None, 'This coupon code can\u2019t be applied to this order.'
        if subtotal < (coupon.minimum_subtotal or 0):
            return None, f"This coupon needs a minimum order of Rs. {coupon.minimum_subtotal:,}."
        if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
            return None, 'This coupon code can\u2019t be applied to this order.'
        return coupon, None

    def coupon_discount(coupon, subtotal):
        if coupon.discount_type == 'percent':
            return min(subtotal, subtotal * coupon.value // 100)
        return min(subtotal, coupon.value)

    def consume_coupon(coupon):
        result = db.session.query(Coupon).filter(
            Coupon.id == coupon.id,
            Coupon.active.is_(True),
            db.or_(Coupon.max_uses.is_(None), Coupon.used_count < Coupon.max_uses),
        ).update({Coupon.used_count: Coupon.used_count + 1}, synchronize_session=False)
        return result == 1

    # -- checkout attempt signing (idempotency) ------------------------------------
    def sign_attempt_key(key):
        return hmac.new(app.secret_key.encode(), key.encode(), hashlib.sha256).hexdigest()[:32]

    def verify_attempt_key(value):
        if not isinstance(value, str) or '.' not in value:
            return None
        key, _, signature = value.partition('.')
        if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', key or '', re.IGNORECASE):
            return None
        if not hmac.compare_digest(sign_attempt_key(key), signature or ''):
            return None
        return key

    # -- public storefront API ------------------------------------------------------
    @app.get('/api/health')
    def health():
        return jsonify({'status': 'ok'})

    @app.get('/api/products')
    def list_products():
        products = Product.query.filter_by(active=True).order_by(Product.category, Product.name).all()
        return jsonify(serialize_products(products))

    @app.get('/api/catalog')
    def catalog_state():
        state = db.session.get(CatalogState, 1)
        products = Product.query.filter_by(active=True).order_by(Product.category, Product.name).all()
        return jsonify({
            'initialized': bool(state and state.initialized),
            'products': serialize_products(products),
        })

    @app.get('/api/categories')
    def list_categories():
        ensure_store_defaults()
        rows = Category.query.filter(Category.visible.is_(True)).filter(
            db.or_(Category.parent_id.is_(None), Category.parent.has(visible=True))
        ).order_by(Category.sort_order, Category.name).all()
        return jsonify([row.as_dict() for row in rows])

    @app.get('/api/site-content')
    def public_site_content():
        return jsonify(read_published_site_content())

    @app.get('/robots.txt')
    def robots_txt():
        content = read_published_site_content()
        rules = (content.get('seo_robots_txt') or 'User-agent: *\nAllow: /').strip()
        sitemap = f"{content.get('seo_canonical_base', '').rstrip('/')}/sitemap.xml" if content.get('seo_canonical_base', '').strip() else ''
        if sitemap and not re.search(r'^\s*Sitemap:', rules, re.IGNORECASE | re.MULTILINE):
            rules = f"{rules}\nSitemap: {sitemap}" if rules else f"Sitemap: {sitemap}"
        return app.response_class(rules + ('\n' if rules else ''), mimetype='text/plain')

    @app.get('/sitemap.xml')
    def sitemap_xml():
        from xml.etree.ElementTree import Element, SubElement, tostring
        content = read_published_site_content()
        base = content.get('seo_canonical_base', '').strip().rstrip('/')
        if not base:
            base = request.url_root.rstrip('/')
        root = Element('urlset', {'xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9'})
        urls = ['/', '/about']
        categories = Category.query.filter_by(visible=True).order_by(Category.sort_order, Category.name).all()
        urls.extend(f"/collections/{category.slug}" for category in categories)
        products = Product.query.filter_by(active=True).order_by(Product.slug).all()
        urls.extend(f"/products/{product.slug}" for product in products)
        for path in urls:
            loc = SubElement(root, 'url')
            SubElement(loc, 'loc').text = f"{base}{path}"
        xml = tostring(root, encoding='utf-8', xml_declaration=True)
        return app.response_class(xml, mimetype='application/xml')

    @app.get('/api/store-settings')
    def public_store_settings():
        ensure_store_defaults()
        cities = DeliveryCity.query.filter_by(active=True).order_by(DeliveryCity.sort_order, DeliveryCity.city_name).all()
        return jsonify({'deliveryFee': setting_int('delivery_fee', 350),
                        'freeShippingThreshold': setting_int('free_delivery_threshold', 0),
                        'cities': [city.as_dict() for city in cities]})

    @app.get('/api/media/<path:filename>')
    def serve_media(filename):
        safe = os.path.basename(filename)
        if not safe or '..' in filename:
            return jsonify({'error': 'File not found.'}), 404
        directory = Path(app.config['UPLOAD_DIR'])
        if not (directory / safe).is_file():
            return jsonify({'error': 'File not found.'}), 404
        return send_from_directory(directory, safe, max_age=86400)

    @app.get('/api/cart')
    def get_cart():
        return jsonify({'items': read_cart_lines()})

    @app.put('/api/cart')
    def save_cart():
        payload = json_object() or {}
        _, error = write_cart_lines(payload.get('items', []))
        if error:
            return jsonify({'error': error}), 400
        return jsonify({'ok': True, 'items': read_cart_lines()})

    @app.post('/api/checkout-attempt')
    @rate_limit(30, 3600, 'checkout-attempt')
    def checkout_attempt():
        data = json_object() or {}
        key = data.get('key')
        if not isinstance(key, str) or not re.fullmatch(
                r'[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', key, re.IGNORECASE):
            return jsonify({'error': 'A valid checkout attempt key is required. Refresh checkout and try again.'}), 400
        return jsonify({'key': f'{key}.{sign_attempt_key(key)}'})

    @app.post('/api/coupons/preview')
    @rate_limit(20, 900, 'coupon-preview')
    def coupon_preview():
        data = json_object() or {}
        code = data.get('code')
        lines = read_cart_lines()
        if not lines:
            return jsonify({'error': 'Your cart is empty.'}), 400
        products = {product.slug: product for product in Product.query.filter(
            Product.slug.in_([line['slug'] for line in lines]), Product.active.is_(True)).all()}
        subtotal = sum(products[line['slug']].price_value * line['quantity'] for line in lines if line['slug'] in products)
        coupon, error = lookup_coupon(code, subtotal)
        if error:
            return jsonify({'error': error}), 400
        discount = coupon_discount(coupon, subtotal)
        city = data.get('city') if isinstance(data.get('city'), str) else ''
        shipping = shipping_for_subtotal(subtotal - discount, city)
        return jsonify({'code': coupon.code, 'subtotal': subtotal, 'discountAmount': discount,
                        'shipping': shipping, 'total': subtotal - discount + shipping})

    def build_order(data, customer):
        """Shared Nutikals-style checkout for guests and signed-in customers."""
        customer_name = valid_text(data, 'customerName', 160, required=True)
        phone = valid_text(data, 'phone', 40, required=True)
        email = valid_text(data, 'email', 255) or ''
        address = valid_text(data, 'address', 1000, required=True)
        city = valid_text(data, 'city', 120, required=True)
        postal_code = valid_text(data, 'postalCode', 20) or ''
        note = valid_text(data, 'note', 500) or ''
        payment_method = data.get('paymentMethod', 'cash_on_delivery')
        coupon_code = data.get('couponCode') if isinstance(data.get('couponCode'), str) else ''
        attempt_key = verify_attempt_key(data.get('attemptKey'))
        if email and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
            return None, ({'error': 'Enter a valid email address or leave it blank.'}, 400)
        if (not customer_name or customer_name is False or not phone or phone is False
                or not address or address is False or not city or city is False):
            return None, ({'error': 'Name, phone, delivery address, and city are required.'}, 400)
        if payment_method not in PAYMENT_METHODS:
            return None, ({'error': 'Choose a valid payment method.'}, 400)
        if not attempt_key:
            return None, ({'error': 'Your checkout session expired. Refresh checkout and try again.'}, 400)
        existing = Order.query.filter_by(idempotency_key=attempt_key).first()
        if existing:
            return existing, ({'duplicate': True}, 200)
        if customer:
            cart_rows = CartItem.query.filter_by(customer_id=customer.id).all()
        else:
            token = guest_cart_token()
            cart_rows = GuestCartItem.query.filter_by(cart_token=token).all() if token else []
        if not cart_rows:
            return None, ({'error': 'Your cart is empty.'}, 400)
        subtotal = 0
        for row in cart_rows:
            product = row.product
            if not product or not product.active:
                return None, ({'error': 'Your cart contains an unavailable product.'}, 400)
            if product.track_stock and row.quantity > product.stock_quantity:
                return None, ({'error': f'{product.name} is out of stock or has insufficient stock.'}, 409)
            subtotal += product.price_value * row.quantity
        coupon = None
        discount = 0
        if coupon_code and coupon_code.strip():
            coupon, error = lookup_coupon(coupon_code, subtotal)
            if error:
                return None, ({'error': error}, 400)
            discount = coupon_discount(coupon, subtotal)
        shipping = shipping_for_subtotal(subtotal - discount, city)
        total = subtotal - discount + shipping
        order = Order(order_number=f'TB-{uuid4().hex[:10].upper()}',
                      customer_id=customer.id if customer else None,
                      idempotency_key=attempt_key,
                      subtotal=subtotal, discount_amount=discount, shipping=shipping, total=total,
                      coupon_code=coupon.code if coupon else '',
                      customer_name=customer_name, phone=phone, email=email.lower() if email else '',
                      address=address, city=city, postal_code=postal_code, note=note,
                      payment_method=payment_method,
                      payment_status='due_on_delivery' if payment_method == 'cash_on_delivery' else 'pending')
        db.session.add(order)
        db.session.flush()
        # Conditional SQL updates keep stock decrements atomic under concurrent checkouts.
        for row in cart_rows:
            product = row.product
            if product.track_stock:
                result = db.session.query(Product).filter(
                    Product.id == product.id,
                    Product.active.is_(True),
                    Product.stock_quantity >= row.quantity,
                ).update({Product.stock_quantity: Product.stock_quantity - row.quantity}, synchronize_session=False)
                if result != 1:
                    db.session.rollback()
                    return None, ({'error': f'{product.name} is out of stock or has insufficient stock.'}, 409)
                db.session.add(OrderStockMovement(order_id=order.id, product_id=product.id, quantity=row.quantity))
            order.items.append(OrderItem(product_id=product.id, product_name=product.name,
                                         product_slug=product.slug, unit_price=product.price_value,
                                         quantity=row.quantity))
        if coupon and not consume_coupon(coupon):
            db.session.rollback()
            return None, ({'error': 'This coupon just ran out. Remove it and try again.'}, 409)
        if customer:
            CartItem.query.filter_by(customer_id=customer.id).delete()
        token = session.get('guest_cart_token')
        if token:
            GuestCartItem.query.filter_by(cart_token=token).delete()
        db.session.commit()
        return order, (None, 201)

    @app.post('/api/orders')
    @rate_limit(10, 3600, 'orders')
    def create_order():
        data = json_object()
        if data is None:
            return jsonify({'error': 'A JSON object is required.'}), 400
        order, (payload, status) = build_order(data, current_customer())
        if order is None:
            return jsonify(payload), status
        if payload and payload.get('duplicate'):
            return jsonify(order.as_dict()), 200
        return jsonify(order.as_dict()), 201

    # -- customer accounts ---------------------------------------------------------
    @app.post('/api/customer/register')
    @rate_limit(5, 3600, 'register')
    def customer_register():
        data = json_object()
        if data is None:
            return jsonify({'error': 'A JSON object is required.'}), 400
        email = valid_text(data, 'email', 255, required=True)
        name = valid_text(data, 'name', 160, required=True)
        password = data.get('password')
        if not email or email is False or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) or not name or name is False or not isinstance(password, str) or not 8 <= len(password) <= 256:
            return jsonify({'error': 'Enter your name, a valid email, and a password with at least 8 characters.'}), 400
        email = email.lower()
        if Customer.query.filter_by(email=email).first():
            return jsonify({'error': 'An account with that email already exists.'}), 409
        customer = Customer(email=email, name=name, password_hash=generate_password_hash(password))
        db.session.add(customer)
        db.session.commit()
        guest_token = session.get('guest_cart_token')
        session.clear()
        if guest_token:
            session['guest_cart_token'] = guest_token
        session['customer_id'] = customer.id
        merge_guest_cart_into_customer(customer)
        return jsonify({'id': customer.id, 'email': customer.email, 'name': customer.name}), 201

    @app.post('/api/customer/login')
    @rate_limit(10, 900, 'customer-login')
    def customer_login():
        data = json_object()
        if data is None or not isinstance(data.get('email'), str) or not isinstance(data.get('password'), str):
            return jsonify({'error': 'Invalid email or password.'}), 401
        customer = Customer.query.filter_by(email=data['email'].strip().lower()).first()
        if not customer or len(data['password']) > 256 or not check_password_hash(customer.password_hash, data['password']):
            return jsonify({'error': 'Invalid email or password.'}), 401
        guest_token = session.get('guest_cart_token')
        session.clear()
        if guest_token:
            session['guest_cart_token'] = guest_token
        session['customer_id'] = customer.id
        merge_guest_cart_into_customer(customer)
        return jsonify({'id': customer.id, 'email': customer.email, 'name': customer.name})

    @app.post('/api/customer/logout')
    def customer_logout():
        session.clear()
        return jsonify({'ok': True})

    @app.get('/api/customer/session')
    def customer_session():
        customer = current_customer()
        return jsonify({'authenticated': bool(customer), 'id': customer.id if customer else None,
                        'email': customer.email if customer else None, 'name': customer.name if customer else None})

    @app.get('/api/customer/cart')
    def customer_cart():
        customer = current_customer()
        if not customer:
            return jsonify({'error': 'Sign in required.'}), 401
        return jsonify(read_cart_lines())

    @app.put('/api/customer/cart')
    def save_customer_cart():
        if not current_customer():
            return jsonify({'error': 'Sign in required.'}), 401
        payload = json_object() or {}
        _, error = write_cart_lines(payload.get('items', []))
        if error:
            return jsonify({'error': error}), 400
        return jsonify({'ok': True})

    @app.get('/api/customer/favorites')
    def customer_favorites():
        customer = current_customer()
        if not customer:
            return jsonify({'error': 'Sign in required.'}), 401
        return jsonify([item.product.slug for item in Favorite.query.filter_by(customer_id=customer.id).all() if item.product and item.product.active])

    @app.put('/api/customer/favorites')
    def save_customer_favorites():
        customer = current_customer()
        if not customer:
            return jsonify({'error': 'Sign in required.'}), 401
        slugs = (json_object() or {}).get('slugs', [])
        if not isinstance(slugs, list) or len(slugs) > 200 or any(not isinstance(slug, str) for slug in slugs):
            return jsonify({'error': 'Favorites must be a list of at most 200 product slugs.'}), 400
        products = Product.query.filter(Product.slug.in_(slugs), Product.active.is_(True)).all()
        if len({product.slug for product in products}) != len(set(slugs)):
            return jsonify({'error': 'Favorites contain an unavailable product.'}), 400
        Favorite.query.filter_by(customer_id=customer.id).delete()
        for product in products:
            db.session.add(Favorite(customer_id=customer.id, product_id=product.id))
        db.session.commit()
        return jsonify({'ok': True})

    @app.post('/api/customer/orders')
    @rate_limit(10, 3600, 'orders')
    def create_customer_order():
        customer = current_customer()
        if not customer:
            return jsonify({'error': 'Sign in before checking out.'}), 401
        data = json_object()
        if data is None:
            return jsonify({'error': 'A JSON object is required.'}), 400
        order, (payload, status) = build_order(data, customer)
        if order is None:
            return jsonify(payload), status
        if payload and payload.get('duplicate'):
            return jsonify(order.as_dict()), 200
        return jsonify(order.as_dict()), 201

    @app.get('/api/customer/orders')
    def customer_orders():
        customer = current_customer()
        if not customer:
            return jsonify({'error': 'Sign in required.'}), 401
        orders = Order.query.filter_by(customer_id=customer.id).order_by(Order.created_at.desc()).all()
        return jsonify([order.as_dict() for order in orders])

    # -- admin auth ------------------------------------------------------------------
    def require_admin():
        if not session.get('admin_id') or not db.session.get(Admin, session['admin_id']):
            return jsonify({'error': 'Admin sign-in required'}), 401
        return None

    def current_admin_email():
        admin = db.session.get(Admin, session.get('admin_id')) if session.get('admin_id') else None
        return admin.email if admin else 'admin'

    @app.post('/api/admin/login')
    @rate_limit(10, 900, 'admin-login')
    def admin_login():
        data = json_object()
        if data is None or not isinstance(data.get('email'), str) or not isinstance(data.get('password'), str):
            return jsonify({'error': 'Invalid email or password'}), 401
        admin = Admin.query.filter_by(email=data['email'].strip().lower()).first()
        if not admin or len(data['password']) > 256 or not check_password_hash(admin.password_hash, data['password']):
            return jsonify({'error': 'Invalid email or password'}), 401
        session.clear()
        session['admin_id'] = admin.id
        return jsonify({'email': admin.email})

    @app.post('/api/admin/logout')
    def admin_logout():
        session.clear()
        return jsonify({'ok': True})

    @app.get('/api/admin/session')
    def admin_session():
        admin = db.session.get(Admin, session.get('admin_id')) if session.get('admin_id') else None
        return jsonify({'authenticated': bool(admin), 'email': admin.email if admin else None})

    @app.get('/api/admin/dashboard')
    def admin_dashboard():
        denied = require_admin()
        if denied:
            return denied
        products = Product.query.all()
        orders = Order.query.all()
        threshold = setting_int('low_stock_threshold', 3)
        active_orders = [order for order in orders if order.status != 'cancelled']
        low_stock = [{'slug': product.slug, 'name': product.name, 'stockQuantity': product.stock_quantity}
                     for product in products if product.track_stock and product.active and product.stock_quantity <= threshold]
        return jsonify({
            'products': len(products),
            'unitsInStock': sum(product.stock_quantity for product in products if product.track_stock),
            'categories': len({product.category for product in products}),
            'catalogValue': sum(product.price_value for product in products),
            'orders': len(orders),
            'pendingOrders': sum(1 for order in orders if order.status == 'pending'),
            'revenue': sum(order.total for order in active_orders),
            'lowStock': sorted(low_stock, key=lambda row: row['stockQuantity'])[:10],
            'recentOrders': [order.as_dict() for order in sorted(orders, key=lambda o: o.created_at, reverse=True)[:5]],
        })

    # -- admin orders ------------------------------------------------------------------
    def filtered_orders(query_args):
        search = (query_args.get('search') or '').strip()[:120]
        status = query_args.get('status') or ''
        payment_status = query_args.get('payment_status') or ''
        payment_method = query_args.get('payment_method') or ''
        query = Order.query
        if search:
            like = f'%{search}%'
            query = query.filter(db.or_(Order.order_number.ilike(like), Order.customer_name.ilike(like),
                                        Order.phone.ilike(like), Order.email.ilike(like)))
        if status:
            if status not in ORDER_STATUSES:
                return None, 'Invalid order status filter.'
            query = query.filter_by(status=status)
        if payment_status:
            if payment_status not in PAYMENT_STATUSES:
                return None, 'Invalid payment status filter.'
            query = query.filter_by(payment_status=payment_status)
        if payment_method:
            if payment_method not in PAYMENT_METHODS:
                return None, 'Invalid payment method filter.'
            query = query.filter_by(payment_method=payment_method)
        return query, None

    @app.get('/api/admin/orders')
    def admin_orders():
        denied = require_admin()
        if denied:
            return denied
        query, error = filtered_orders(request.args)
        if error:
            return jsonify({'error': error}), 400
        try:
            page = max(1, min(1000000, int(request.args.get('page', 1))))
            page_size = max(1, min(100, int(request.args.get('pageSize', 25))))
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid pagination.'}), 400
        total = query.count()
        orders = query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return jsonify({'total': total, 'page': page, 'pageSize': page_size,
                        'orders': [order.as_dict() for order in orders]})

    @app.get('/api/admin/orders/export.csv')
    def admin_orders_export():
        denied = require_admin()
        if denied:
            return denied
        query, error = filtered_orders(request.args)
        if error:
            return jsonify({'error': error}), 400
        orders = query.order_by(Order.created_at.desc()).limit(5000).all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Order', 'Date', 'Customer', 'Phone', 'Email', 'City', 'Address', 'Status',
                         'Payment method', 'Payment status', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Total'])
        for order in orders:
            writer.writerow([order.order_number, order.created_at.isoformat(), order.customer_name, order.phone,
                             order.email, order.city, order.address, order.status, order.payment_method,
                             order.payment_status, '; '.join(f"{item.product_name} x{item.quantity}" for item in order.items),
                             order.subtotal, order.discount_amount, order.shipping, order.total])
        response = app.response_class(output.getvalue(), mimetype='text/csv')
        response.headers['Content-Disposition'] = 'attachment; filename=technobaazar-orders.csv'
        return response

    @app.patch('/api/admin/orders/<order_number>')
    def update_order_status(order_number):
        denied = require_admin()
        if denied:
            return denied
        order = Order.query.filter_by(order_number=order_number).first_or_404()
        data = request.get_json(silent=True) or {}
        if 'status' in data:
            if data['status'] not in ORDER_STATUSES:
                return jsonify({'error': 'Invalid order status.'}), 400
            if data['status'] == 'cancelled' and order.status != 'cancelled' and not order.stock_restored_at:
                movements = OrderStockMovement.query.filter_by(order_id=order.id, restored_at=None).all()
                for movement in movements:
                    if movement.product_id:
                        db.session.query(Product).filter_by(id=movement.product_id).update(
                            {Product.stock_quantity: Product.stock_quantity + movement.quantity},
                            synchronize_session=False)
                    movement.restored_at = datetime.now(timezone.utc)
                order.stock_restored_at = datetime.now(timezone.utc)
            order.status = data['status']
        if 'paymentStatus' in data:
            if data['paymentStatus'] not in PAYMENT_STATUSES:
                return jsonify({'error': 'Invalid payment status.'}), 400
            order.payment_status = data['paymentStatus']
        if 'note' in data:
            note = valid_text(data, 'note', 500)
            if note is False:
                return jsonify({'error': 'Order note is too long.'}), 400
            order.note = note or ''
        db.session.commit()
        return jsonify(order.as_dict())

    # -- admin products ---------------------------------------------------------------
    @app.post('/api/admin/products')
    def create_product():
        denied = require_admin()
        if denied:
            return denied
        data = json_object()
        if data is None:
            return jsonify({'error': 'A JSON object is required.'}), 400
        required = ('slug', 'name', 'category', 'brand', 'priceValue')
        if any(key not in data for key in required):
            return jsonify({'error': 'slug, name, category, brand, and priceValue are required'}), 400
        strings = {key: valid_text(data, key, maximum, required=True) for key, maximum in {'slug': 180, 'name': 240, 'category': 100, 'brand': 120}.items()}
        if strings['category'] not in PRODUCT_CATEGORIES and not Category.query.filter_by(name=strings['category']).first():
            return jsonify({'error': 'Choose one of the existing product categories.'}), 400
        price = positive_int(data.get('priceValue'))
        compare_at = data.get('compareAtPrice')
        compare_at = positive_int(compare_at) if compare_at not in (None, '') else None
        if data.get('compareAtPrice') not in (None, '') and compare_at is None:
            return jsonify({'error': 'compareAtPrice must be a positive whole number or blank.'}), 400
        stock = positive_int(data.get('stockQuantity', 0), allow_zero=True)
        specs = data.get('specifications', [])
        image = data.get('image', '')
        optional = {
            'detail': valid_text(data, 'detail', 300),
            'description': valid_text(data, 'description', 5000),
            'badge': valid_text(data, 'badge', 100),
            'imageAlt': valid_text(data, 'imageAlt', 300),
            'seoTitle': valid_text(data, 'seoTitle', 200),
            'seoDescription': valid_text(data, 'seoDescription', 500),
            'seoKeywords': valid_text(data, 'seoKeywords', 500),
            'ogTitle': valid_text(data, 'ogTitle', 200),
            'ogDescription': valid_text(data, 'ogDescription', 500),
            'ogImage': valid_text(data, 'ogImage', 2000),
            'canonicalUrl': valid_text(data, 'canonicalUrl', 1000),
        }
        parsed_image = urlparse(image) if isinstance(image, str) else None
        track_stock = data.get('trackStock', True)
        if any(value is False or not value for value in strings.values()) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', strings['slug']) or not price or price > 1_000_000_000_000 or stock is None or stock > 1_000_000 or not isinstance(specs, list) or len(specs) > 100 or any(not isinstance(spec, str) or len(spec) > 300 for spec in specs) or not isinstance(image, str) or len(image) > 2000 or (image and not is_local_or_http_url(image)) or any(value is False for value in optional.values()) or (optional['ogImage'] and not is_local_or_http_url(optional['ogImage'])) or not isinstance(track_stock, bool):
            return jsonify({'error': 'Product fields have invalid values.'}), 400
        product = Product(
            slug=strings['slug'], name=strings['name'], category=strings['category'], brand=strings['brand'],
            detail=optional['detail'] or '', description=optional['description'] or '',
            specifications=specs, price_value=price, compare_at_price=compare_at, track_stock=track_stock,
            badge=optional['badge'] or '', image=image, image_alt=optional['imageAlt'] or '',
            seo_title=optional['seoTitle'] or '', seo_description=optional['seoDescription'] or '',
            seo_keywords=optional['seoKeywords'] or '', og_title=optional['ogTitle'] or '',
            og_description=optional['ogDescription'] or '', og_image=optional['ogImage'] or '',
            canonical_url=optional['canonicalUrl'] or '',
            stock_quantity=stock, active=data.get('active', True),
        )
        if not isinstance(product.active, bool):
            return jsonify({'error': 'active must be a boolean.'}), 400
        db.session.add(product)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify({'error': 'Could not save product. Check for duplicate slug.'}), 409
        if isinstance(data.get('content'), dict):
            cleaned = validate_product_content(data['content'])
            if cleaned is None:
                return jsonify({'error': 'Product content has invalid values.'}), 400
            db.session.add(ProductContent(product_id=product.id, **cleaned))
            db.session.commit()
        return jsonify(product.as_dict(db.session.get(ProductContent, product.id))), 201

    @app.put('/api/admin/products/<slug>')
    def update_product(slug):
        denied = require_admin()
        if denied:
            return denied
        product = Product.query.filter_by(slug=slug).first_or_404()
        data = json_object()
        if data is None:
            return jsonify({'error': 'A JSON object is required.'}), 400
        fields = {'name': 'name', 'category': 'category', 'brand': 'brand', 'detail': 'detail',
                  'description': 'description', 'specifications': 'specifications', 'priceValue': 'price_value',
                  'compareAtPrice': 'compare_at_price', 'trackStock': 'track_stock',
                  'badge': 'badge', 'image': 'image', 'imageAlt': 'image_alt',
                  'stockQuantity': 'stock_quantity', 'active': 'active',
                  'seoTitle': 'seo_title', 'seoDescription': 'seo_description',
                  'seoKeywords': 'seo_keywords', 'ogTitle': 'og_title',
                  'ogDescription': 'og_description', 'ogImage': 'og_image',
                  'canonicalUrl': 'canonical_url'}
        for incoming, attribute in fields.items():
            if incoming in data:
                value = data[incoming]
                if incoming in {'priceValue', 'stockQuantity'}:
                    value = positive_int(value, allow_zero=incoming == 'stockQuantity')
                    maximum = 1_000_000 if incoming == 'stockQuantity' else 1_000_000_000_000
                    if value is None or value > maximum:
                        return jsonify({'error': f'{incoming} is outside the supported range.'}), 400
                elif incoming == 'compareAtPrice':
                    if value in (None, ''):
                        value = None
                    else:
                        value = positive_int(value)
                        if value is None or value > 1_000_000_000_000:
                            return jsonify({'error': 'compareAtPrice is outside the supported range.'}), 400
                elif incoming == 'specifications':
                    if not isinstance(value, list) or len(value) > 100 or any(not isinstance(spec, str) or len(spec) > 300 for spec in value):
                        return jsonify({'error': 'specifications must be a list of at most 100 short strings.'}), 400
                elif incoming in {'active', 'trackStock'}:
                    if not isinstance(value, bool):
                        return jsonify({'error': f'{incoming} must be a boolean.'}), 400
                elif incoming in {'image', 'ogImage'}:
                    if not isinstance(value, str) or len(value) > 2000 or (value and not is_local_or_http_url(value)):
                        return jsonify({'error': f'{incoming} must be a relative path or an HTTP(S) URL.'}), 400
                elif incoming == 'category':
                    value = valid_text({incoming: value}, incoming, 100, required=True)
                    if value is False or (value not in PRODUCT_CATEGORIES and not Category.query.filter_by(name=value).first()):
                        return jsonify({'error': 'Choose one of the existing product categories.'}), 400
                else:
                    maximum = {'name': 240, 'brand': 120, 'detail': 300, 'description': 5000, 'badge': 100, 'imageAlt': 300, 'seoTitle': 200, 'seoDescription': 500, 'seoKeywords': 500, 'ogTitle': 200, 'ogDescription': 500, 'canonicalUrl': 1000}[incoming]
                    value = valid_text({incoming: value}, incoming, maximum, required=incoming in {'name', 'brand'})
                    if value is False:
                        return jsonify({'error': f'{incoming} is too long or invalid.'}), 400
                setattr(product, attribute, value)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify({'error': 'Could not update product.'}), 400
        return jsonify(product.as_dict(db.session.get(ProductContent, product.id)))

    @app.put('/api/admin/products/<slug>/content')
    def update_product_content(slug):
        denied = require_admin()
        if denied:
            return denied
        product = Product.query.filter_by(slug=slug).first_or_404()
        cleaned = validate_product_content(json_object())
        if cleaned is None:
            return jsonify({'error': 'Product content has invalid values.'}), 400
        content = db.session.get(ProductContent, product.id)
        if content:
            for key, value in cleaned.items():
                setattr(content, key, value)
            content.updated_at = datetime.now(timezone.utc)
        else:
            content = ProductContent(product_id=product.id, **cleaned)
            db.session.add(content)
        db.session.commit()
        return jsonify(product.as_dict(content))

    @app.delete('/api/admin/products/<slug>')
    def delete_product(slug):
        denied = require_admin()
        if denied:
            return denied
        product = Product.query.filter_by(slug=slug).first_or_404()
        db.session.delete(product)
        db.session.commit()
        return '', 204

    # -- admin site content (landing CMS) -----------------------------------------------
    @app.get('/api/admin/site-content')
    def admin_site_content():
        denied = require_admin()
        if denied:
            return denied
        return jsonify(read_working_site_content())

    @app.put('/api/admin/site-content')
    def save_site_content():
        denied = require_admin()
        if denied:
            return denied
        data = json_object() or {}
        cleaned = validate_site_content(data.get('values', {}))
        if cleaned is None:
            return jsonify({'error': 'Landing content has invalid values.'}), 400
        note = valid_text(data, 'note', 240) or ''
        if note is False:
            return jsonify({'error': 'Revision note is too long.'}), 400
        base = read_working_site_content()
        snapshot = {key: base.get(key, SITE_CONTENT_DEFAULTS[key]) for key in SITE_CONTENT_DEFAULTS}
        snapshot.update(cleaned)
        SiteContentRevision.query.filter_by(status='draft').update({'status': 'superseded'})
        revision = SiteContentRevision(content=snapshot, status='draft', editor=current_admin_email()[:120], note=note)
        db.session.add(revision)
        db.session.commit()
        return jsonify({'revisionId': revision.id, 'hasDraft': True})

    @app.post('/api/admin/site-content/publish')
    def publish_site_content():
        denied = require_admin()
        if denied:
            return denied
        draft = SiteContentRevision.query.filter_by(status='draft').order_by(SiteContentRevision.id.desc()).first()
        if not draft:
            return jsonify({'error': 'There is no saved content draft to publish.'}), 400
        SiteContentRevision.query.filter_by(status='published').update({'status': 'superseded'})
        draft.status = 'published'
        draft.editor = current_admin_email()[:120]
        draft.published_at = datetime.now(timezone.utc)
        content = normalize_site_content(draft.content)
        for key in SITE_CONTENT_DEFAULTS:
            row = db.session.get(SiteContent, key)
            if row:
                row.content_value = content[key]
                row.updated_at = datetime.now(timezone.utc)
            else:
                db.session.add(SiteContent(content_key=key, content_value=content[key]))
        db.session.commit()
        published = dict(content)
        published['_revision_id'] = draft.id
        published['_has_draft'] = False
        return jsonify(published)

    @app.post('/api/admin/site-content/discard')
    def discard_site_content():
        denied = require_admin()
        if denied:
            return denied
        draft = SiteContentRevision.query.filter_by(status='draft').order_by(SiteContentRevision.id.desc()).first()
        if not draft:
            return jsonify({'error': 'There is no saved content draft to discard.'}), 400
        draft.status = 'discarded'
        db.session.commit()
        return jsonify({'ok': True})

    @app.get('/api/admin/site-content/history')
    def site_content_history():
        denied = require_admin()
        if denied:
            return denied
        revisions = SiteContentRevision.query.order_by(SiteContentRevision.id.desc()).limit(20).all()
        return jsonify([{'id': revision.id, 'status': revision.status, 'editor': revision.editor,
                         'note': revision.note, 'createdAt': revision.created_at.isoformat(),
                         'publishedAt': revision.published_at.isoformat() if revision.published_at else None}
                        for revision in revisions])

    @app.post('/api/admin/site-content/history/<int:revision_id>/restore')
    def restore_site_content(revision_id):
        denied = require_admin()
        if denied:
            return denied
        revision = db.session.get(SiteContentRevision, revision_id)
        if not revision or not isinstance(revision.content, dict):
            return jsonify({'error': 'Revision not found.'}), 404
        SiteContentRevision.query.filter_by(status='draft').update({'status': 'superseded'})
        draft = SiteContentRevision(content=normalize_site_content(revision.content), status='draft',
                                    editor=current_admin_email()[:120], note=f'Restored from revision {revision_id}'[:240])
        db.session.add(draft)
        db.session.commit()
        return jsonify({'revisionId': draft.id, 'hasDraft': True})

    # -- admin categories / coupons / settings --------------------------------------------
    @app.get('/api/admin/categories')
    def admin_categories():
        denied = require_admin()
        if denied:
            return denied
        ensure_store_defaults()
        return jsonify([row.as_dict() for row in Category.query.order_by(Category.sort_order, Category.name).all()])

    @app.post('/api/admin/categories')
    def create_category():
        denied = require_admin()
        if denied:
            return denied
        ensure_store_defaults()
        data = json_object() or {}
        name = valid_text(data, 'name', 100, required=True)
        parent_id = data.get('parentId')
        if not name or name is False:
            return jsonify({'error': 'Enter a category name up to 100 characters.'}), 400
        if Category.query.filter(db.func.lower(Category.name) == name.lower()).first():
            return jsonify({'error': 'A category with that name already exists.'}), 409
        parent = None
        if parent_id is not None:
            parent_id = positive_int(parent_id)
            if parent_id is None:
                return jsonify({'error': 'Choose a valid parent category.'}), 400
            parent = db.session.get(Category, parent_id)
            if not parent or parent.parent_id is not None:
                return jsonify({'error': 'Subcategories must be created under a main category.'}), 400
        slug = slugify(name)
        if not slug or Category.query.filter_by(slug=slug).first():
            return jsonify({'error': 'That category name has an invalid or duplicate URL slug.'}), 409
        siblings = Category.query.filter_by(parent_id=parent.id if parent else None).count()
        category = Category(name=name, slug=slug, parent=parent, sort_order=(siblings + 1) * 10, visible=True)
        db.session.add(category)
        db.session.commit()
        return jsonify(category.as_dict()), 201

    @app.put('/api/admin/categories/<int:category_id>')
    def update_category(category_id):
        denied = require_admin()
        if denied:
            return denied
        category = db.session.get(Category, category_id)
        if not category:
            return jsonify({'error': 'Category not found.'}), 404
        data = json_object() or {}
        if 'visible' in data:
            if not isinstance(data['visible'], bool):
                return jsonify({'error': 'visible must be a boolean.'}), 400
            category.visible = data['visible']
        if 'sortOrder' in data:
            order = positive_int(data['sortOrder'], allow_zero=True)
            if order is None or order > 100000:
                return jsonify({'error': 'sortOrder must be between 0 and 100000.'}), 400
            category.sort_order = order
        if 'parentId' in data:
            parent_id = positive_int(data['parentId']) if data['parentId'] is not None else None
            parent = db.session.get(Category, parent_id) if parent_id is not None else None
            if parent_id is not None and (not parent or parent.id == category.id or parent.parent_id is not None):
                return jsonify({'error': 'Choose a main category as the parent.'}), 400
            if category.children and parent_id is not None:
                return jsonify({'error': 'A category with subcategories cannot be moved under another category.'}), 400
            category.parent = parent
        db.session.commit()
        return jsonify(category.as_dict())

    @app.get('/api/admin/category-fields')
    def admin_category_fields():
        denied = require_admin()
        if denied:
            return denied
        ensure_store_defaults()
        category = request.args.get('category', '')
        query = CategoryCustomField.query
        if category:
            query = query.filter_by(category_name=category)
        rows = query.order_by(CategoryCustomField.category_name,
                              CategoryCustomField.sort_order, CategoryCustomField.label).all()
        return jsonify([row.as_dict() for row in rows])

    @app.post('/api/admin/category-fields')
    def create_category_field():
        denied = require_admin()
        if denied:
            return denied
        data = json_object() or {}
        category = valid_text(data, 'category', 100, required=True)
        label = valid_text(data, 'label', 100, required=True)
        placeholder = valid_text(data, 'placeholder', 200) or ''
        if not category or category is False or (category not in PRODUCT_CATEGORIES and not Category.query.filter_by(name=category).first()):
            return jsonify({'error': 'Choose one of the existing product categories.'}), 400
        if not label or label is False:
            return jsonify({'error': 'Enter a field label up to 100 characters.'}), 400
        if placeholder is False:
            return jsonify({'error': 'Placeholder must be at most 200 characters.'}), 400
        if CategoryCustomField.query.filter_by(category_name=category, label=label).first():
            return jsonify({'error': 'That field already exists for this category.'}), 409
        top = CategoryCustomField.query.filter_by(category_name=category).order_by(
            CategoryCustomField.sort_order.desc()).first()
        field = CategoryCustomField(category_name=category, label=label, placeholder=placeholder,
                                    sort_order=(top.sort_order + 10) if top else 10)
        db.session.add(field)
        db.session.commit()
        return jsonify(field.as_dict()), 201

    @app.put('/api/admin/category-fields/<int:field_id>')
    def update_category_field(field_id):
        denied = require_admin()
        if denied:
            return denied
        field = db.session.get(CategoryCustomField, field_id)
        if not field:
            return jsonify({'error': 'Field not found.'}), 404
        data = json_object() or {}
        if 'label' in data:
            label = valid_text(data, 'label', 100, required=True)
            if not label or label is False:
                return jsonify({'error': 'Enter a field label up to 100 characters.'}), 400
            if label != field.label and CategoryCustomField.query.filter_by(
                    category_name=field.category_name, label=label).first():
                return jsonify({'error': 'That field already exists for this category.'}), 409
            field.label = label
        if 'placeholder' in data:
            placeholder = valid_text(data, 'placeholder', 200) or ''
            if placeholder is False:
                return jsonify({'error': 'Placeholder must be at most 200 characters.'}), 400
            field.placeholder = placeholder
        if 'sortOrder' in data:
            order = positive_int(data['sortOrder'], allow_zero=True)
            if order is None or order > 100000:
                return jsonify({'error': 'sortOrder must be between 0 and 100000.'}), 400
            field.sort_order = order
        db.session.commit()
        return jsonify(field.as_dict())

    @app.delete('/api/admin/category-fields/<int:field_id>')
    def delete_category_field(field_id):
        denied = require_admin()
        if denied:
            return denied
        field = db.session.get(CategoryCustomField, field_id)
        if not field:
            return jsonify({'error': 'Field not found.'}), 404
        db.session.delete(field)
        db.session.commit()
        return '', 204

    def validate_coupon_payload(data, existing=None):
        code = valid_text(data, 'code', 40, required=existing is None)
        if code is False or (code is not None and not re.fullmatch(r'[A-Z0-9_-]{3,40}', code.upper())):
            return None, 'Coupon code must be 3-40 characters (letters, numbers, _ or -).'
        discount_type = data.get('discountType', existing.discount_type if existing else None)
        if discount_type not in {'percent', 'fixed'}:
            return None, 'discountType must be percent or fixed.'
        value = positive_int(data.get('value', existing.value if existing else None))
        if value is None or (discount_type == 'percent' and value > 100) or value > 1_000_000_000:
            return None, 'Coupon value is outside the supported range.'
        minimum = positive_int(data.get('minimumSubtotal', existing.minimum_subtotal if existing else 0), allow_zero=True)
        if minimum is None or minimum > 1_000_000_000_000:
            return None, 'minimumSubtotal is outside the supported range.'

        def parse_time(raw):
            if raw in (None, ''):
                return None
            if not isinstance(raw, str):
                return 'invalid'
            try:
                parsed = datetime.fromisoformat(raw.replace('Z', '+00:00'))
            except ValueError:
                return 'invalid'
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

        starts_at = parse_time(data['startsAt']) if 'startsAt' in data else (existing.starts_at if existing else None)
        ends_at = parse_time(data['endsAt']) if 'endsAt' in data else (existing.ends_at if existing else None)
        if starts_at == 'invalid' or ends_at == 'invalid':
            return None, 'Coupon dates must be valid ISO timestamps or blank.'
        if starts_at and ends_at and ends_at <= starts_at:
            return None, 'Coupon end date must be after the start date.'
        max_uses = data.get('maxUses', existing.max_uses if existing else None)
        if max_uses in (None, ''):
            max_uses = None
        else:
            max_uses = positive_int(max_uses)
            if max_uses is None or max_uses > 1_000_000:
                return None, 'maxUses must be a positive whole number or blank.'
        active = data.get('active', existing.active if existing else True)
        if not isinstance(active, bool):
            return None, 'active must be a boolean.'
        cleaned = {'discount_type': discount_type, 'value': value, 'minimum_subtotal': minimum,
                   'starts_at': starts_at, 'ends_at': ends_at, 'max_uses': max_uses, 'active': active}
        if code:
            cleaned['code'] = code.upper()
        return cleaned, None

    @app.get('/api/admin/coupons')
    def admin_coupons():
        denied = require_admin()
        if denied:
            return denied
        return jsonify([coupon.as_dict() for coupon in Coupon.query.order_by(Coupon.code).all()])

    @app.post('/api/admin/coupons')
    def create_coupon():
        denied = require_admin()
        if denied:
            return denied
        cleaned, error = validate_coupon_payload(json_object() or {})
        if error:
            return jsonify({'error': error}), 400
        if Coupon.query.filter(db.func.lower(Coupon.code) == cleaned['code'].lower()).first():
            return jsonify({'error': 'A coupon with that code already exists.'}), 409
        coupon = Coupon(**cleaned)
        db.session.add(coupon)
        db.session.commit()
        return jsonify(coupon.as_dict()), 201

    @app.put('/api/admin/coupons/<int:coupon_id>')
    def update_coupon(coupon_id):
        denied = require_admin()
        if denied:
            return denied
        coupon = db.session.get(Coupon, coupon_id)
        if not coupon:
            return jsonify({'error': 'Coupon not found.'}), 404
        cleaned, error = validate_coupon_payload(json_object() or {}, existing=coupon)
        if error:
            return jsonify({'error': error}), 400
        if 'code' in cleaned and cleaned['code'].lower() != coupon.code.lower():
            if Coupon.query.filter(db.func.lower(Coupon.code) == cleaned['code'].lower()).first():
                return jsonify({'error': 'A coupon with that code already exists.'}), 409
        for key, value in cleaned.items():
            setattr(coupon, key, value)
        db.session.commit()
        return jsonify(coupon.as_dict())

    @app.delete('/api/admin/coupons/<int:coupon_id>')
    def delete_coupon(coupon_id):
        denied = require_admin()
        if denied:
            return denied
        coupon = db.session.get(Coupon, coupon_id)
        if not coupon:
            return jsonify({'error': 'Coupon not found.'}), 404
        db.session.delete(coupon)
        db.session.commit()
        return '', 204

    @app.get('/api/admin/settings')
    def admin_settings():
        denied = require_admin()
        if denied:
            return denied
        ensure_store_defaults()
        cities = DeliveryCity.query.order_by(DeliveryCity.sort_order, DeliveryCity.city_name).all()
        return jsonify({'deliveryFee': setting_int('delivery_fee', 350),
                        'freeDeliveryThreshold': setting_int('free_delivery_threshold', 0),
                        'lowStockThreshold': setting_int('low_stock_threshold', 3),
                        'cities': [city.as_dict() for city in cities]})

    def save_setting_int(key, data, field, maximum, label):
        value = positive_int(data.get(field), allow_zero=True)
        if value is None or value > maximum:
            return jsonify({'error': f'{label} is outside the supported range.'}), 400
        row = db.session.get(StoreSetting, key)
        if row:
            row.value = str(value)
        else:
            db.session.add(StoreSetting(key=key, value=str(value)))
        db.session.commit()
        return None

    @app.put('/api/admin/settings/delivery-fee')
    def update_delivery_fee():
        denied = require_admin()
        if denied:
            return denied
        failed = save_setting_int('delivery_fee', json_object() or {}, 'value', 1_000_000, 'Delivery fee')
        if failed:
            return failed
        return jsonify({'deliveryFee': setting_int('delivery_fee', 350)})

    @app.put('/api/admin/settings/free-delivery-threshold')
    def update_free_delivery_threshold():
        denied = require_admin()
        if denied:
            return denied
        failed = save_setting_int('free_delivery_threshold', json_object() or {}, 'value', 1_000_000_000_000, 'Free delivery threshold')
        if failed:
            return failed
        return jsonify({'freeDeliveryThreshold': setting_int('free_delivery_threshold', 0)})

    @app.put('/api/admin/settings/low-stock-threshold')
    def update_low_stock_threshold():
        denied = require_admin()
        if denied:
            return denied
        failed = save_setting_int('low_stock_threshold', json_object() or {}, 'value', 100000, 'Low stock threshold')
        if failed:
            return failed
        return jsonify({'lowStockThreshold': setting_int('low_stock_threshold', 3)})

    @app.put('/api/admin/settings/cities/<city_slug>')
    def update_delivery_city(city_slug):
        denied = require_admin()
        if denied:
            return denied
        city = db.session.get(DeliveryCity, city_slug)
        if not city:
            return jsonify({'error': 'City not found.'}), 404
        data = json_object() or {}
        if 'fee' in data:
            fee = positive_int(data['fee'], allow_zero=True)
            if fee is None or fee > 1_000_000:
                return jsonify({'error': 'City delivery fee is outside the supported range.'}), 400
            city.delivery_fee = fee
        if 'active' in data:
            if not isinstance(data['active'], bool):
                return jsonify({'error': 'active must be a boolean.'}), 400
            city.active = data['active']
        db.session.commit()
        return jsonify(city.as_dict())

    # -- admin media uploads -----------------------------------------------------------
    def sniff_image_kind(raw):
        if raw.startswith(b'\xff\xd8\xff'):
            return '.jpg'
        if raw.startswith(b'\x89PNG\r\n\x1a\n'):
            return '.png'
        if raw.startswith(b'RIFF') and len(raw) > 12 and raw[8:12] == b'WEBP':
            return '.webp'
        if raw.startswith((b'GIF87a', b'GIF89a')):
            return '.gif'
        return None

    @app.post('/api/admin/uploads')
    def upload_media():
        denied = require_admin()
        if denied:
            return denied
        if 'file' not in request.files:
            return jsonify({'error': 'Attach an image as the file field.'}), 400
        storage = request.files['file']
        raw = storage.read(UPLOAD_MAX_BYTES + 1)
        if not raw or len(raw) > UPLOAD_MAX_BYTES:
            return jsonify({'error': 'Images must be between 1 byte and 5 MB.'}), 400
        kind = sniff_image_kind(raw)
        if not kind:
            return jsonify({'error': 'Only JPG, PNG, WebP, or GIF images are allowed.'}), 400
        filename = f'{uuid4().hex}{kind}'
        Path(app.config['UPLOAD_DIR'], filename).write_bytes(raw)
        return jsonify({'filename': filename, 'url': f'/api/media/{filename}'}), 201

    @app.get('/api/admin/media')
    def list_media():
        denied = require_admin()
        if denied:
            return denied
        directory = Path(app.config['UPLOAD_DIR'])
        files = []
        for path in sorted(directory.glob('*'), key=lambda p: p.stat().st_mtime, reverse=True)[:200]:
            if path.is_file() and path.suffix.lower() in UPLOAD_EXTENSIONS:
                files.append({'filename': path.name, 'url': f'/api/media/{path.name}',
                              'size': path.stat().st_size,
                              'uploadedAt': datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()})
        return jsonify(files)

    @app.delete('/api/admin/media/<filename>')
    def delete_media(filename):
        denied = require_admin()
        if denied:
            return denied
        safe = os.path.basename(filename)
        if not safe or '..' in filename:
            return jsonify({'error': 'File not found.'}), 404
        path = Path(app.config['UPLOAD_DIR'], safe)
        if not path.is_file() or path.suffix.lower() not in UPLOAD_EXTENSIONS:
            return jsonify({'error': 'File not found.'}), 404
        path.unlink()
        return '', 204

    # -- CLI ------------------------------------------------------------------------------
    @app.cli.command('create-admin')
    def create_admin():
        email = os.environ.get('ADMIN_EMAIL', '').strip().lower()
        password = os.environ.get('ADMIN_PASSWORD', '')
        if not email or not password:
            raise SystemExit('Set ADMIN_EMAIL and ADMIN_PASSWORD before running flask create-admin.')
        if Admin.query.filter_by(email=email).first():
            raise SystemExit(f'Admin {email} already exists.')
        db.session.add(Admin(email=email, password_hash=generate_password_hash(password)))
        db.session.commit()
        print(f'Created admin: {email}')

    @app.cli.command('seed-store')
    def seed_store():
        """Seed settings, cities, categories, and landing content (safe to rerun)."""
        ensure_store_defaults()
        print('Store settings, delivery cities, categories, and landing content are ready.')

    @app.cli.command('verify-catalog')
    def verify_catalog():
        """Check that the complete starter catalog is present in the configured database."""
        seed_file = Path(__file__).with_name('seed_products.json')
        expected = len(json.loads(seed_file.read_text(encoding='utf-8')))
        state = db.session.get(CatalogState, 1)
        actual = Product.query.count()
        if not state or not state.initialized or actual != expected:
            raise SystemExit(f'Catalog verification failed: initialized={bool(state and state.initialized)}, found {actual} products, expected {expected}.')
        print(f'Catalog verified: {actual}/{expected} products in {db.engine.url.get_backend_name()} database.')

    @app.cli.command('seed-catalog')
    def seed_catalog():
        state = db.session.get(CatalogState, 1)
        if state and state.initialized:
            raise SystemExit('Catalog is already initialized; existing database data was left unchanged.')
        ensure_store_defaults()
        seed_file = Path(__file__).with_name('seed_products.json')
        with seed_file.open(encoding='utf-8') as file:
            rows = json.load(file)
        for data in rows:
            seo = data.get('seo') if isinstance(data.get('seo'), dict) else {}
            db.session.add(Product(
                slug=data['slug'], name=data['name'], category=data['category'], brand=data['brand'],
                detail=data['detail'], description=data['description'], specifications=data['specifications'],
                price_value=data['priceValue'], compare_at_price=data.get('compareAtPrice'),
                badge=data['badge'], image=data['image'], image_alt=data['imageAlt'],
                stock_quantity=data.get('stockQuantity', 10),
                seo_title=seo.get('title', ''), seo_description=seo.get('description', ''),
                seo_keywords=seo.get('keywords', ''), og_title=seo.get('ogTitle', ''),
                og_description=seo.get('ogDescription', ''), og_image=seo.get('ogImage', ''),
                canonical_url=seo.get('canonicalUrl', ''),
            ))
        db.session.add(CatalogState(id=1, initialized=True))
        db.session.commit()
        print(f'Seeded {len(rows)} products into the database.')

    # Nutikals-style runtime safety net: make sure every table exists even if
    # migrations were never run (typical for a fresh dev checkout). Production
    # deployments should use `flask db upgrade` with AUTO_CREATE_TABLES=false.
    if os.environ.get('AUTO_CREATE_TABLES', 'true').lower() not in {'0', 'false', 'no'}:
        with app.app_context():
            db.create_all()
            ensure_store_defaults()

    # Single-service hosting (Nutikals-style): when the frontend has been
    # built (`npm run build` in frontend/), serve it directly from Flask with
    # an SPA fallback. API routes are registered above and take precedence.
    frontend_dist = Path(__file__).resolve().parent.parent / 'frontend' / 'dist'
    if frontend_dist.is_dir():
        @app.get('/', defaults={'path': ''})
        @app.get('/<path:path>')
        def serve_frontend(path):
            if path == 'api' or path.startswith('api/'):
                return jsonify({'error': 'Not found.'}), 404
            target = frontend_dist / path
            if path and target.is_file():
                max_age = 31536000 if path.startswith('assets/') else 3600
                return send_from_directory(frontend_dist, path, max_age=max_age)
            return send_from_directory(frontend_dist, 'index.html')

    return app


app = create_app()
