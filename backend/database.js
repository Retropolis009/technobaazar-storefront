import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { Sequelize, DataTypes } from 'sequelize'

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') })
const root = path.dirname(fileURLToPath(import.meta.url))
const rawUrl = process.env.DATABASE_URL
let sequelize
if (rawUrl?.startsWith('sqlite:') || (!rawUrl && !process.env.DB_NAME && !process.env.DB_USER)) {
  const sqlitePath = rawUrl?.startsWith('sqlite:') ? rawUrl.slice('sqlite:'.length) : '///store.db'
  let file
  if (sqlitePath.startsWith('////')) file = path.resolve(`/${sqlitePath.slice(4)}`)
  else if (sqlitePath.startsWith('///')) file = path.resolve(root, sqlitePath.slice(3) || 'store.db')
  else file = path.resolve(root, sqlitePath.replace(/^\/\//, '') || 'store.db')
  sequelize = new Sequelize({ dialect: 'sqlite', storage: file, logging: false })
} else {
  const production = (process.env.APP_ENV || '').toLowerCase() === 'production'
  const connection = rawUrl
    ? rawUrl.replace('postgresql+psycopg://', 'postgres://').replace('postgresql+psycopg2://', 'postgres://')
    : {
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    }
  const options = {
    logging: false,
    pool: { max: Number(process.env.DB_POOL_MAX || 10), min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: production && process.env.DATABASE_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: process.env.DATABASE_SSL_VERIFY !== 'false' } } : {},
  }
  sequelize = rawUrl ? new Sequelize(connection, options) : new Sequelize({ ...connection, ...options })
}

const common = { timestamps: false, freezeTableName: true, underscored: true }
const models = {}
const define = (name, tableName, attributes, options = {}) => {
  models[name] = sequelize.define(name, attributes, { ...common, tableName, ...options })
  return models[name]
}

const { INTEGER, STRING, TEXT, BOOLEAN, DATE, JSON: JSONTYPE } = DataTypes
const Admin = define('Admin', 'admin', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, email: { type: STRING(255), allowNull: false, unique: true }, password_hash: { type: STRING(255), allowNull: false } })
const CatalogState = define('CatalogState', 'catalog_state', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, initialized: { type: BOOLEAN, allowNull: false, defaultValue: false } })
const Category = define('Category', 'category', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, name: { type: STRING(100), allowNull: false, unique: true }, slug: { type: STRING(100), allowNull: false, unique: true }, sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 }, visible: { type: BOOLEAN, allowNull: false, defaultValue: true }, parent_id: { type: INTEGER, allowNull: true } })
const CategoryCustomField = define('CategoryCustomField', 'category_custom_field', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, category_name: { type: STRING(100), allowNull: false }, label: { type: STRING(100), allowNull: false }, placeholder: { type: STRING(200), allowNull: false, defaultValue: '' }, sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 } })
const Product = define('Product', 'product', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, slug: { type: STRING(180), allowNull: false, unique: true }, name: { type: STRING(240), allowNull: false }, category: { type: STRING(100), allowNull: false }, brand: { type: STRING(120), allowNull: false }, detail: { type: STRING(300), allowNull: false, defaultValue: '' }, description: { type: TEXT, allowNull: false, defaultValue: '' }, specifications: { type: JSONTYPE, allowNull: false, defaultValue: [] }, price_value: { type: INTEGER, allowNull: false }, compare_at_price: { type: INTEGER }, track_stock: { type: BOOLEAN, allowNull: false, defaultValue: true }, badge: { type: STRING(100), allowNull: false, defaultValue: '' }, image: { type: TEXT, allowNull: false, defaultValue: '' }, image_alt: { type: STRING(300), allowNull: false, defaultValue: '' }, seo_title: { type: STRING(200), allowNull: false, defaultValue: '' }, seo_description: { type: STRING(500), allowNull: false, defaultValue: '' }, seo_keywords: { type: STRING(500), allowNull: false, defaultValue: '' }, og_title: { type: STRING(200), allowNull: false, defaultValue: '' }, og_description: { type: STRING(500), allowNull: false, defaultValue: '' }, og_image: { type: TEXT, allowNull: false, defaultValue: '' }, canonical_url: { type: STRING(1000), allowNull: false, defaultValue: '' }, stock_quantity: { type: INTEGER, allowNull: false, defaultValue: 0 }, active: { type: BOOLEAN, allowNull: false, defaultValue: true } })
const ProductContent = define('ProductContent', 'product_content', { product_id: { type: INTEGER, primaryKey: true }, subtitle: { type: STRING(500), allowNull: false, defaultValue: '' }, size: { type: STRING(100), allowNull: false, defaultValue: '' }, gallery: { type: JSONTYPE, allowNull: false, defaultValue: [] }, eyebrow: { type: STRING(200), allowNull: false, defaultValue: '' }, intro: { type: TEXT, allowNull: false, defaultValue: '' }, notes: { type: JSONTYPE, allowNull: false, defaultValue: [] }, updated_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW } })
const Customer = define('Customer', 'customer', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, email: { type: STRING(255), allowNull: false, unique: true }, name: { type: STRING(160), allowNull: false }, password_hash: { type: STRING(255), allowNull: false }, created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW } })
const CartItem = define('CartItem', 'cart_item', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, customer_id: { type: INTEGER, allowNull: false }, product_id: { type: INTEGER, allowNull: false }, quantity: { type: INTEGER, allowNull: false, defaultValue: 1 } })
const Favorite = define('Favorite', 'favorite', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, customer_id: { type: INTEGER, allowNull: false }, product_id: { type: INTEGER, allowNull: false } })
const GuestCart = define('GuestCart', 'guest_cart', { token: { type: STRING(64), primaryKey: true }, created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW } })
const GuestCartItem = define('GuestCartItem', 'guest_cart_item', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, cart_token: { type: STRING(64), allowNull: false }, product_id: { type: INTEGER, allowNull: false }, quantity: { type: INTEGER, allowNull: false, defaultValue: 1 } })
const Coupon = define('Coupon', 'coupon', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, code: { type: STRING(40), allowNull: false, unique: true }, discount_type: { type: STRING(12), allowNull: false }, value: { type: INTEGER, allowNull: false }, minimum_subtotal: { type: INTEGER, allowNull: false, defaultValue: 0 }, starts_at: { type: DATE }, ends_at: { type: DATE }, max_uses: { type: INTEGER }, used_count: { type: INTEGER, allowNull: false, defaultValue: 0 }, active: { type: BOOLEAN, allowNull: false, defaultValue: true }, created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW } })
const StoreSetting = define('StoreSetting', 'store_setting', { key: { type: STRING(80), primaryKey: true }, value: { type: STRING(200), allowNull: false, defaultValue: '' } })
const DeliveryCity = define('DeliveryCity', 'delivery_city', { city_slug: { type: STRING(100), primaryKey: true }, city_name: { type: STRING(120), allowNull: false }, delivery_fee: { type: INTEGER, allowNull: false, defaultValue: 350 }, active: { type: BOOLEAN, allowNull: false, defaultValue: true }, sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 } })
const Order = define('Order', 'order', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, order_number: { type: STRING(40), allowNull: false, unique: true }, customer_id: { type: INTEGER }, idempotency_key: { type: STRING(64), unique: true }, status: { type: STRING(30), allowNull: false, defaultValue: 'pending' }, payment_method: { type: STRING(30), allowNull: false, defaultValue: 'cash_on_delivery' }, payment_status: { type: STRING(30), allowNull: false, defaultValue: 'unpaid' }, subtotal: { type: INTEGER, allowNull: false }, discount_amount: { type: INTEGER, allowNull: false, defaultValue: 0 }, shipping: { type: INTEGER, allowNull: false, defaultValue: 0 }, total: { type: INTEGER, allowNull: false }, coupon_code: { type: STRING(40), allowNull: false, defaultValue: '' }, customer_name: { type: STRING(160), allowNull: false }, phone: { type: STRING(40), allowNull: false }, email: { type: STRING(255), allowNull: false, defaultValue: '' }, address: { type: TEXT, allowNull: false }, city: { type: STRING(120), allowNull: false, defaultValue: '' }, postal_code: { type: STRING(20), allowNull: false, defaultValue: '' }, note: { type: STRING(500), allowNull: false, defaultValue: '' }, stock_restored_at: { type: DATE }, created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW } })
const OrderItem = define('OrderItem', 'order_item', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, order_id: { type: INTEGER, allowNull: false }, product_id: { type: INTEGER }, product_name: { type: STRING(240), allowNull: false }, product_slug: { type: STRING(180), allowNull: false }, unit_price: { type: INTEGER, allowNull: false }, quantity: { type: INTEGER, allowNull: false } })
const OrderStockMovement = define('OrderStockMovement', 'order_stock_movement', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, order_id: { type: INTEGER, allowNull: false }, product_id: { type: INTEGER }, quantity: { type: INTEGER, allowNull: false }, restored_at: { type: DATE } })
const SiteContent = define('SiteContent', 'site_content', { content_key: { type: STRING(80), primaryKey: true }, content_value: { type: TEXT, allowNull: false, defaultValue: '' }, updated_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW } })
const SiteContentRevision = define('SiteContentRevision', 'site_content_revision', { id: { type: INTEGER, primaryKey: true, autoIncrement: true }, content: { type: JSONTYPE, allowNull: false, defaultValue: {} }, status: { type: STRING(20), allowNull: false }, editor: { type: STRING(120), allowNull: false, defaultValue: 'system' }, note: { type: STRING(240), allowNull: false, defaultValue: '' }, created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW }, published_at: { type: DATE } })

Category.belongsTo(Category, { as: 'parent', foreignKey: 'parent_id' })
Category.hasMany(Category, { as: 'children', foreignKey: 'parent_id' })
Product.hasOne(ProductContent, { as: 'content', foreignKey: 'product_id', onDelete: 'CASCADE' })
ProductContent.belongsTo(Product, { as: 'product', foreignKey: 'product_id' })
Customer.hasMany(CartItem, { as: 'cartItems', foreignKey: 'customer_id', onDelete: 'CASCADE' })
CartItem.belongsTo(Product, { as: 'product', foreignKey: 'product_id' })
Customer.hasMany(Favorite, { as: 'favorites', foreignKey: 'customer_id', onDelete: 'CASCADE' })
Favorite.belongsTo(Product, { as: 'product', foreignKey: 'product_id' })
GuestCart.hasMany(GuestCartItem, { as: 'items', foreignKey: 'cart_token', onDelete: 'CASCADE' })
GuestCartItem.belongsTo(Product, { as: 'product', foreignKey: 'product_id' })
Order.hasMany(OrderItem, { as: 'items', foreignKey: 'order_id', onDelete: 'CASCADE' })
OrderItem.belongsTo(Product, { as: 'product', foreignKey: 'product_id' })
Order.hasMany(OrderStockMovement, { as: 'stockMovements', foreignKey: 'order_id', onDelete: 'CASCADE' })
OrderStockMovement.belongsTo(Product, { as: 'product', foreignKey: 'product_id' })

export { sequelize, models }
