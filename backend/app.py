import os
import json
import re
import threading
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4
from urllib.parse import urlparse
from werkzeug.middleware.proxy_fix import ProxyFix

from flask import Flask, jsonify, request, session
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()
migrate = Migrate()
PRODUCT_CATEGORIES = {
    'Graphics Cards', 'Processors', 'Motherboards', 'Memory', 'Storage',
    'Power Supplies', 'Cases & Cooling', 'Laptops', 'Monitors', 'Audio', 'Accessories',
}

_rate_lock = threading.Lock()
_rate_buckets = {}


class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)


class CatalogState(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    initialized = db.Column(db.Boolean, nullable=False, default=False)


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
    badge = db.Column(db.String(100), nullable=False, default='')
    image = db.Column(db.Text, nullable=False, default='')
    image_alt = db.Column(db.String(300), nullable=False, default='')
    stock_quantity = db.Column(db.Integer, nullable=False, default=0, server_default='0')
    active = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())

    def as_dict(self):
        return {
            'slug': self.slug, 'name': self.name, 'category': self.category,
            'brand': self.brand, 'detail': self.detail, 'description': self.description,
            'specifications': self.specifications or [],
            'price': f"Rs. {self.price_value:,}", 'priceValue': self.price_value,
            'badge': self.badge, 'image': self.image, 'imageAlt': self.image_alt,
            'stockQuantity': self.stock_quantity, 'active': self.active,
        }


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
    quantity = db.Column(db.Integer, nullable=False, default=1)
    __table_args__ = (db.UniqueConstraint('customer_id', 'product_id'),)


class Favorite(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id', ondelete='CASCADE'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id', ondelete='CASCADE'), nullable=False)
    __table_args__ = (db.UniqueConstraint('customer_id', 'product_id'),)


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(40), unique=True, nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    status = db.Column(db.String(30), nullable=False, default='pending')
    payment_method = db.Column(db.String(30), nullable=False, default='cash_on_delivery')
    payment_status = db.Column(db.String(30), nullable=False, default='unpaid')
    subtotal = db.Column(db.Integer, nullable=False)
    total = db.Column(db.Integer, nullable=False)
    customer_name = db.Column(db.String(160), nullable=False)
    phone = db.Column(db.String(40), nullable=False)
    address = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def as_dict(self):
        return {
            'orderNumber': self.order_number, 'status': self.status,
            'paymentMethod': self.payment_method, 'paymentStatus': self.payment_status,
            'subtotal': self.subtotal, 'total': self.total, 'customerName': self.customer_name,
            'phone': self.phone, 'address': self.address,
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


def create_app():
    app = Flask(__name__)
    production = os.environ.get('APP_ENV', '').lower() == 'production'
    frontend_origin = os.environ.get('FRONTEND_ORIGIN', 'http://localhost:5173').rstrip('/')
    secret_key = os.environ.get('FLASK_SECRET_KEY')
    trusted_proxy_hops = int(os.environ.get('TRUSTED_PROXY_HOPS', '0'))
    if not 0 <= trusted_proxy_hops <= 5:
        raise RuntimeError('TRUSTED_PROXY_HOPS must be between 0 and 5.')
    if production and (not secret_key or secret_key == 'dev-only-change-me'):
        raise RuntimeError('Set a unique FLASK_SECRET_KEY before starting in production.')
    app.config.update(
        SECRET_KEY=secret_key or 'dev-only-change-me',
        SQLALCHEMY_DATABASE_URI=os.environ.get('DATABASE_URL', 'sqlite:///store.db'),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        MAX_CONTENT_LENGTH=1024 * 1024,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        SESSION_COOKIE_SECURE=production or frontend_origin.startswith('https://'),
    )
    db.init_app(app)
    migrate.init_app(app, db)
    if trusted_proxy_hops:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=trusted_proxy_hops, x_proto=trusted_proxy_hops)
    CORS(app, origins=[frontend_origin], supports_credentials=True)

    @app.before_request
    def enforce_origin_for_mutations():
        if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'}:
            origin = request.headers.get('Origin')
            if not origin or origin.rstrip('/') != frontend_origin:
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

    def json_object():
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

    @app.get('/api/health')
    def health():
        return jsonify({'status': 'ok'})

    @app.get('/api/products')
    def list_products():
        return jsonify([product.as_dict() for product in Product.query.filter_by(active=True).order_by(Product.category, Product.name).all()])

    @app.get('/api/catalog')
    def catalog_state():
        state = db.session.get(CatalogState, 1)
        return jsonify({
            'initialized': bool(state and state.initialized),
            'products': [product.as_dict() for product in Product.query.filter_by(active=True).order_by(Product.category, Product.name).all()],
        })

    def current_customer():
        customer_id = session.get('customer_id')
        return db.session.get(Customer, customer_id) if customer_id else None

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
        session.clear()
        session['customer_id'] = customer.id
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
        session.clear()
        session['customer_id'] = customer.id
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
        if not customer: return jsonify({'error': 'Sign in required.'}), 401
        items = CartItem.query.filter_by(customer_id=customer.id).all()
        return jsonify([{'slug': item.product.slug, 'quantity': item.quantity} for item in items if item.product and item.product.active])

    @app.put('/api/customer/cart')
    def save_customer_cart():
        customer = current_customer()
        if not customer: return jsonify({'error': 'Sign in required.'}), 401
        payload = json_object() or {}
        items = payload.get('items', [])
        if not isinstance(items, list) or len(items) > 100: return jsonify({'error': 'Cart must contain at most 100 items.'}), 400
        normalized = {}
        for entry in items:
            if not isinstance(entry, dict) or not isinstance(entry.get('slug'), str):
                return jsonify({'error': 'Each cart item needs a product slug and quantity.'}), 400
            quantity = positive_int(entry.get('quantity'))
            if not quantity or quantity > 99 or entry['slug'] in normalized:
                return jsonify({'error': 'Cart quantities must be unique and between 1 and 99.'}), 400
            product = Product.query.filter_by(slug=entry['slug'], active=True).first()
            if not product:
                return jsonify({'error': 'Cart contains an unavailable product.'}), 400
            normalized[product.id] = quantity
        CartItem.query.filter_by(customer_id=customer.id).delete()
        for product_id, quantity in normalized.items():
            db.session.add(CartItem(customer_id=customer.id, product_id=product_id, quantity=quantity))
        db.session.commit()
        return jsonify({'ok': True})

    @app.get('/api/customer/favorites')
    def customer_favorites():
        customer = current_customer()
        if not customer: return jsonify({'error': 'Sign in required.'}), 401
        return jsonify([item.product.slug for item in Favorite.query.filter_by(customer_id=customer.id).all() if item.product and item.product.active])

    @app.put('/api/customer/favorites')
    def save_customer_favorites():
        customer = current_customer()
        if not customer: return jsonify({'error': 'Sign in required.'}), 401
        slugs = (json_object() or {}).get('slugs', [])
        if not isinstance(slugs, list) or len(slugs) > 200 or any(not isinstance(slug, str) for slug in slugs): return jsonify({'error': 'Favorites must be a list of at most 200 product slugs.'}), 400
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
    def create_order():
        customer = current_customer()
        if not customer: return jsonify({'error': 'Sign in before checking out.'}), 401
        data = json_object() or {}
        customer_name = valid_text(data, 'customerName', 160, required=True)
        phone = valid_text(data, 'phone', 40, required=True)
        address = valid_text(data, 'address', 1000, required=True)
        if not customer_name or customer_name is False or not phone or phone is False or not address or address is False:
            return jsonify({'error': 'Name, phone, and delivery address are required.'}), 400
        cart_items = CartItem.query.filter_by(customer_id=customer.id).all()
        if not cart_items: return jsonify({'error': 'Your cart is empty.'}), 400
        subtotal = 0
        for item in cart_items:
            if not item.product or not item.product.active or item.quantity > item.product.stock_quantity:
                return jsonify({'error': f'{item.product.name if item.product else "A product"} is out of stock or has insufficient stock.'}), 409
            subtotal += item.product.price_value * item.quantity
        order = Order(order_number=f'TB-{uuid4().hex[:10].upper()}', customer_id=customer.id,
                      subtotal=subtotal, total=subtotal, customer_name=customer_name,
                      phone=phone, address=address, payment_method='cash_on_delivery')
        # Conditional SQL updates keep stock decrements atomic under concurrent checkouts.
        for item in cart_items:
            product = item.product
            result = db.session.query(Product).filter(
                Product.id == product.id,
                Product.active.is_(True),
                Product.stock_quantity >= item.quantity,
            ).update({Product.stock_quantity: Product.stock_quantity - item.quantity}, synchronize_session=False)
            if result != 1:
                db.session.rollback()
                return jsonify({'error': f'{product.name} is out of stock or has insufficient stock.'}), 409
            order.items.append(OrderItem(product_id=product.id, product_name=product.name,
                                         product_slug=product.slug, unit_price=product.price_value, quantity=item.quantity))
        db.session.add(order)
        CartItem.query.filter_by(customer_id=customer.id).delete()
        db.session.commit()
        return jsonify(order.as_dict()), 201

    @app.get('/api/customer/orders')
    def customer_orders():
        customer = current_customer()
        if not customer: return jsonify({'error': 'Sign in required.'}), 401
        orders = Order.query.filter_by(customer_id=customer.id).order_by(Order.created_at.desc()).all()
        return jsonify([order.as_dict() for order in orders])

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

    @app.get('/api/admin/orders')
    def admin_orders():
        denied = require_admin()
        if denied: return denied
        return jsonify([order.as_dict() for order in Order.query.order_by(Order.created_at.desc()).all()])

    @app.patch('/api/admin/orders/<order_number>')
    def update_order_status(order_number):
        denied = require_admin()
        if denied: return denied
        order = Order.query.filter_by(order_number=order_number).first_or_404()
        data = request.get_json(silent=True) or {}
        if data.get('status') not in {'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'}:
            return jsonify({'error': 'Invalid order status.'}), 400
        order.status = data['status']
        db.session.commit()
        return jsonify(order.as_dict())

    def require_admin():
        if not session.get('admin_id') or not db.session.get(Admin, session['admin_id']):
            return jsonify({'error': 'Admin sign-in required'}), 401
        return None

    @app.post('/api/admin/products')
    def create_product():
        denied = require_admin()
        if denied: return denied
        data = json_object()
        if data is None: return jsonify({'error': 'A JSON object is required.'}), 400
        required = ('slug', 'name', 'category', 'brand', 'priceValue')
        if any(key not in data for key in required):
            return jsonify({'error': 'slug, name, category, brand, and priceValue are required'}), 400
        strings = {key: valid_text(data, key, maximum, required=True) for key, maximum in {'slug': 180, 'name': 240, 'category': 100, 'brand': 120}.items()}
        if strings['category'] not in PRODUCT_CATEGORIES:
            return jsonify({'error': 'Choose one of the existing product categories.'}), 400
        price = positive_int(data.get('priceValue'))
        stock = positive_int(data.get('stockQuantity', 0), allow_zero=True)
        specs = data.get('specifications', [])
        image = data.get('image', '')
        optional = {
            'detail': valid_text(data, 'detail', 300),
            'description': valid_text(data, 'description', 5000),
            'badge': valid_text(data, 'badge', 100),
            'imageAlt': valid_text(data, 'imageAlt', 300),
        }
        parsed_image = urlparse(image) if isinstance(image, str) else None
        if any(value is False or not value for value in strings.values()) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', strings['slug']) or not price or price > 1_000_000_000_000 or stock is None or stock > 1_000_000 or not isinstance(specs, list) or len(specs) > 100 or any(not isinstance(spec, str) or len(spec) > 300 for spec in specs) or not isinstance(image, str) or len(image) > 2000 or (image and (parsed_image.scheme not in {'https', 'http'} or not parsed_image.netloc)) or any(value is False for value in optional.values()):
            return jsonify({'error': 'Product fields have invalid values.'}), 400
        product = Product(
            slug=strings['slug'], name=strings['name'], category=strings['category'], brand=strings['brand'],
            detail=optional['detail'] or '', description=optional['description'] or '',
            specifications=specs, price_value=price,
            badge=optional['badge'] or '', image=image, image_alt=optional['imageAlt'] or '',
            stock_quantity=stock, active=data.get('active', True),
        )
        if not isinstance(product.active, bool): return jsonify({'error': 'active must be a boolean.'}), 400
        db.session.add(product)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify({'error': 'Could not save product. Check for duplicate slug.'}), 409
        return jsonify(product.as_dict()), 201

    @app.put('/api/admin/products/<slug>')
    def update_product(slug):
        denied = require_admin()
        if denied: return denied
        product = Product.query.filter_by(slug=slug).first_or_404()
        data = json_object()
        if data is None: return jsonify({'error': 'A JSON object is required.'}), 400
        fields = {'name': 'name', 'category': 'category', 'brand': 'brand', 'detail': 'detail',
                  'description': 'description', 'specifications': 'specifications', 'priceValue': 'price_value',
                  'badge': 'badge', 'image': 'image', 'imageAlt': 'image_alt',
                  'stockQuantity': 'stock_quantity', 'active': 'active'}
        for incoming, attribute in fields.items():
            if incoming in data:
                value = data[incoming]
                if incoming in {'priceValue', 'stockQuantity'}:
                    value = positive_int(value, allow_zero=incoming == 'stockQuantity')
                    maximum = 1_000_000 if incoming == 'stockQuantity' else 1_000_000_000_000
                    if value is None or value > maximum: return jsonify({'error': f'{incoming} is outside the supported range.'}), 400
                elif incoming == 'specifications':
                    if not isinstance(value, list) or len(value) > 100 or any(not isinstance(spec, str) or len(spec) > 300 for spec in value):
                        return jsonify({'error': 'specifications must be a list of at most 100 short strings.'}), 400
                elif incoming in {'active'}:
                    if not isinstance(value, bool): return jsonify({'error': 'active must be a boolean.'}), 400
                elif incoming == 'image':
                    parsed_image = urlparse(value) if isinstance(value, str) else None
                    if not isinstance(value, str) or len(value) > 2000 or (value and (parsed_image.scheme not in {'https', 'http'} or not parsed_image.netloc)):
                        return jsonify({'error': 'image must be an HTTP or HTTPS URL.'}), 400
                elif incoming == 'category':
                    value = valid_text({incoming: value}, incoming, 100, required=True)
                    if value is False or value not in PRODUCT_CATEGORIES:
                        return jsonify({'error': 'Choose one of the existing product categories.'}), 400
                else:
                    maximum = {'name': 240, 'category': 100, 'brand': 120, 'detail': 300, 'description': 5000, 'badge': 100, 'imageAlt': 300}[incoming]
                    value = valid_text({incoming: value}, incoming, maximum, required=incoming in {'name', 'category', 'brand'})
                    if value is False: return jsonify({'error': f'{incoming} is too long or invalid.'}), 400
                setattr(product, attribute, value)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify({'error': 'Could not update product.'}), 400
        return jsonify(product.as_dict())

    @app.delete('/api/admin/products/<slug>')
    def delete_product(slug):
        denied = require_admin()
        if denied: return denied
        product = Product.query.filter_by(slug=slug).first_or_404()
        db.session.delete(product)
        db.session.commit()
        return '', 204

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

    @app.cli.command('seed-catalog')
    def seed_catalog():
        state = db.session.get(CatalogState, 1)
        if state and state.initialized:
            raise SystemExit('Catalog is already initialized; existing database data was left unchanged.')
        seed_file = Path(__file__).with_name('seed_products.json')
        with seed_file.open(encoding='utf-8') as file:
            rows = json.load(file)
        for data in rows:
            db.session.add(Product(
                slug=data['slug'], name=data['name'], category=data['category'], brand=data['brand'],
                detail=data['detail'], description=data['description'], specifications=data['specifications'],
                price_value=data['priceValue'], badge=data['badge'], image=data['image'], image_alt=data['imageAlt'],
                stock_quantity=data.get('stockQuantity', 10),
            ))
        db.session.add(CatalogState(id=1, initialized=True))
        db.session.commit()
        print(f'Seeded {len(rows)} products into the database.')

    return app


app = create_app()
