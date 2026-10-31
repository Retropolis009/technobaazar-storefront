import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import session from 'express-session'
import SequelizeStoreFactory from 'connect-session-sequelize'
import cors from 'cors'
import multer from 'multer'
import { zipSync, strToU8 } from 'fflate'
import { Op, literal, UniqueConstraintError } from 'sequelize'
import { sequelize, models } from './database.js'
import defaults from './config/store-defaults.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const {
  Admin, CatalogState, Category, CategoryCustomField, Product, ProductContent, Customer,
  CartItem, Favorite, GuestCart, GuestCartItem, Coupon, StoreSetting, DeliveryCity,
  Order, OrderItem, OrderStockMovement, SiteContent, SiteContentRevision,
} = models
const { SITE_CONTENT_DEFAULTS, LEGACY_SITE_CONTENT_DEFAULTS, PRIOR_SITE_CONTENT_DEFAULTS,
  SITE_CONTENT_URL_FIELDS, SITE_CONTENT_LIMITS, DELIVERY_CITIES_SEED, CATEGORY_FIELD_SEEDS,
  PRODUCT_CATEGORIES, CATEGORY_SORT_ORDER, CATEGORY_DEFAULT_PARENTS, ORDER_STATUSES,
  PAYMENT_METHODS, PAYMENT_STATUSES, UPLOAD_EXTENSIONS, UPLOAD_MAX_BYTES } = defaults
const production = (process.env.APP_ENV || '').toLowerCase() === 'production'
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean)
const trustedProxyHops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS || '0', 10)
if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0 || trustedProxyHops > 5) throw new Error('TRUSTED_PROXY_HOPS must be between 0 and 5.')
const secret = process.env.FLASK_SECRET_KEY || process.env.SESSION_SECRET || 'dev-only-change-me'
if (production && (secret.length < 32 || ['dev-only-change-me', 'replace-with-a-long-random-secret'].includes(secret))) throw new Error('Set a unique SESSION_SECRET (or FLASK_SECRET_KEY) of at least 32 characters in production.')
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR?.trim() || path.join(__dirname, 'images'))
await fs.mkdir(uploadDirectory, { recursive: true })

const app = express()
if (trustedProxyHops) app.set('trust proxy', trustedProxyHops)
const SequelizeStore = SequelizeStoreFactory(session.Store)
const sessionStore = new SequelizeStore({ db: sequelize, tableName: 'session', checkExpirationInterval: 15 * 60 * 1000, expiration: 8 * 60 * 60 * 1000 })
app.disable('x-powered-by')
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    const normalized = origin.replace(/\/$/, '')
    if (allowedOrigins.includes(normalized)) return callback(null, true)
    if (!production) {
      try {
        const url = new URL(normalized)
        if (['localhost', '127.0.0.1'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol)) return callback(null, true)
        if (url.protocol === 'https:' && url.hostname.endsWith('.e2b.app')) return callback(null, true)
      } catch {}
    }
    return callback(new Error('Origin is not allowed.'))
  },
}))
app.use((req, res, next) => {
  if (production && (req.path.startsWith('/api/admin') || req.path.startsWith('/admin')) && !req.secure) return res.status(426).json({ error: 'Admin access requires HTTPS. Configure trusted proxy headers if TLS terminates upstream.' })
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !originAllowed(req.get('Origin'))) return res.status(403).json({ error: 'Request origin is not allowed.' })
  next()
})
app.use(express.json({ limit: '100kb', strict: false }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))
app.use(session({
  name: 'technobaazar.sid', secret, store: sessionStore, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, path: '/', sameSite: 'lax', secure: production || allowedOrigins.some(origin => origin.startsWith('https://')), maxAge: 8 * 60 * 60 * 1000 },
}))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})

const rateBuckets = new Map()
function rateLimit(name, limit, windowMs) {
  return (req, res, next) => {
    const now = Date.now(), key = `${name}:${req.ip || req.socket.remoteAddress || 'unknown'}`
    const live = (rateBuckets.get(key) || []).filter(stamp => now - stamp < windowMs)
    if (live.length >= limit) { rateBuckets.set(key, live); return res.status(429).json({ error: 'Too many attempts. Please try again later.' }) }
    live.push(now); rateBuckets.set(key, live)
    next()
  }
}
const asyncRoute = (handler, ...downstream) => (req, res, next) => {
  const dispatch = index => index >= downstream.length ? next() : downstream[index](req, res, error => error ? next(error) : dispatch(index + 1))
  return Promise.resolve().then(() => handler(req, res, downstream.length ? () => dispatch(0) : next)).catch(next)
}
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const jsonObject = req => isObject(req.body) ? req.body : null
function validText(data, key, maximum, required = false) {
  const value = data?.[key]
  if (typeof value !== 'string') return !required && value == null ? null : false
  const trimmed = value.trim()
  return (trimmed || !required) && trimmed.length <= maximum ? trimmed : false
}
function positiveInt(value, allowZero = false) {
  if (typeof value === 'boolean' || value == null || (typeof value !== 'number' && typeof value !== 'string')) return null
  const text = String(value).trim()
  if (!/^\d+$/.test(text)) return null
  const number = Number(text)
  return Number.isSafeInteger(number) && number >= (allowZero ? 0 : 1) ? number : null
}
function slugify(value = '') { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
function originAllowed(origin) {
  const normalized = (origin || '').replace(/\/$/, '')
  if (allowedOrigins.includes(normalized)) return true
  if (production || !normalized) return false
  try {
    const url = new URL(normalized)
    if (['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1'].includes(url.hostname)) return true
    return url.protocol === 'https:' && url.hostname.endsWith('.e2b.app')
  } catch { return false }
}
function localOrHttpUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 2000) return false
  if (value.startsWith('/') || value.startsWith('#') || value.startsWith('./') || value.startsWith('../')) return true
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.host) } catch { return false }
}
function passwordHash(password, iterations = 600000) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64')
  return `pbkdf2:sha256:${iterations}$${salt}$${derived}`
}
function verifyPassword(encoded, password) {
  try {
    const [method, salt, expected] = String(encoded).split('$')
    if (!method || !salt || !expected) return false
    let actual
    if (method.startsWith('pbkdf2:sha256:')) actual = crypto.pbkdf2Sync(password, salt, Number(method.split(':')[2]), 32, 'sha256').toString('base64')
    else if (method.startsWith('scrypt:')) {
      const [, n, r, p] = method.split(':').map(Number)
      const keyLength = expected.length / 2
      actual = crypto.scryptSync(password, salt, keyLength, { N: n, r, p, maxmem: Math.max(64 * 1024 * 1024, 128 * n * r + 1024) }).toString('hex')
    } else return false
    const a = Buffer.from(actual), b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch { return false }
}
function serializeProduct(product, content = product.content) {
  const p = product.get ? product.get({ plain: true }) : product
  const c = content?.get ? content.get({ plain: true }) : content
  return {
    slug: p.slug, name: p.name, category: p.category, brand: p.brand, detail: p.detail || '', description: p.description || '', specifications: p.specifications || [],
    price: `Rs. ${Number(p.price_value).toLocaleString('en-US')}`, priceValue: p.price_value,
    compareAtPrice: p.compare_at_price ?? null, compareAt: p.compare_at_price ? `Rs. ${Number(p.compare_at_price).toLocaleString('en-US')}` : null,
    trackStock: p.track_stock, badge: p.badge || '', image: p.image || '', imageAlt: p.image_alt || '', stockQuantity: p.stock_quantity, active: p.active,
    seo: { title: p.seo_title || '', description: p.seo_description || '', keywords: p.seo_keywords || '', ogTitle: p.og_title || '', ogDescription: p.og_description || '', ogImage: p.og_image || '', canonicalUrl: p.canonical_url || '' },
    content: c ? { subtitle: c.subtitle || '', size: c.size || '', gallery: c.gallery || [], eyebrow: c.eyebrow || '', intro: c.intro || '', notes: c.notes || [] } : blankProductContent(),
  }
}
function blankProductContent() { return { subtitle: '', size: '', gallery: [], eyebrow: '', intro: '', notes: [] } }
function serializeCategory(category, parentName = category.parent?.name || null) {
  return { id: category.id, name: category.name, slug: category.slug, sortOrder: category.sort_order, visible: category.visible, parentId: category.parent_id ?? null, parentName }
}
function serializeCity(city) { return { slug: city.city_slug, name: city.city_name, fee: city.delivery_fee, active: city.active } }
function serializeCoupon(c) { return { id: c.id, code: c.code, discountType: c.discount_type, value: c.value, minimumSubtotal: c.minimum_subtotal, startsAt: c.starts_at?.toISOString?.() || null, endsAt: c.ends_at?.toISOString?.() || null, maxUses: c.max_uses, usedCount: c.used_count, active: c.active } }
function serializeOrder(order) {
  const o = order.get ? order.get({ plain: true }) : order
  return { orderNumber: o.order_number, status: o.status, paymentMethod: o.payment_method, paymentStatus: o.payment_status,
    subtotal: o.subtotal, discountAmount: o.discount_amount, shipping: o.shipping, total: o.total, couponCode: o.coupon_code,
    customerName: o.customer_name, phone: o.phone, email: o.email, address: o.address, city: o.city, postalCode: o.postal_code, note: o.note,
    createdAt: (o.created_at instanceof Date ? o.created_at : new Date(o.created_at)).toISOString(),
    items: (o.items || []).map(item => ({ name: item.product_name, slug: item.product_slug, unitPrice: item.unit_price, quantity: item.quantity })),
  }
}
const productInclude = [{ model: ProductContent, as: 'content', required: false }]
async function findProducts(where = {}, order = [['category', 'ASC'], ['name', 'ASC']]) {
  return Product.findAll({ where, order, include: productInclude })
}

async function ensureStoreDefaults() {
  const t = await sequelize.transaction()
  try {
    for (const [key, value] of Object.entries({ delivery_fee: '350', free_delivery_threshold: '0', low_stock_threshold: '3' })) await StoreSetting.findOrCreate({ where: { key }, defaults: { value }, transaction: t })
    const categories = new Map()
    for (const [index, name] of CATEGORY_SORT_ORDER.entries()) {
      const [category] = await Category.findOrCreate({ where: { name }, defaults: { slug: slugify(name), sort_order: (index + 1) * 10, visible: true }, transaction: t })
      categories.set(name, category)
    }
    for (const [name, parentName] of Object.entries(CATEGORY_DEFAULT_PARENTS)) {
      const child = categories.get(name), parent = categories.get(parentName)
      if (child && parent && !child.parent_id) await child.update({ parent_id: parent.id }, { transaction: t })
    }
    for (const [category, fields] of Object.entries(CATEGORY_FIELD_SEEDS)) for (const [i, [label, placeholder]] of fields.entries()) {
      await CategoryCustomField.findOrCreate({ where: { category_name: category, label }, defaults: { placeholder, sort_order: (i + 1) * 10 }, transaction: t })
    }
    for (const [i, [city_slug, city_name, delivery_fee]] of DELIVERY_CITIES_SEED.entries()) await DeliveryCity.findOrCreate({ where: { city_slug }, defaults: { city_name, delivery_fee, active: true, sort_order: (i + 1) * 10 }, transaction: t })
    const published = await SiteContentRevision.findOne({ where: { status: 'published' }, order: [['id', 'DESC']], transaction: t })
    const existing = await SiteContent.count({ transaction: t })
    if (!published && existing < Object.keys(SITE_CONTENT_DEFAULTS).length) {
      for (const [content_key, content_value] of Object.entries(SITE_CONTENT_DEFAULTS)) await SiteContent.findOrCreate({ where: { content_key }, defaults: { content_value }, transaction: t })
      await SiteContentRevision.create({ content: SITE_CONTENT_DEFAULTS, status: 'published', editor: 'system', note: 'Initial published content', published_at: new Date() }, { transaction: t })
    }
    await t.commit()
  } catch (error) { await t.rollback(); throw error }
}
function normalizeSiteContent(values) {
  const result = { ...SITE_CONTENT_DEFAULTS }
  if (isObject(values)) for (const key of Object.keys(SITE_CONTENT_DEFAULTS)) if (typeof values[key] === 'string') {
    const legacy = [LEGACY_SITE_CONTENT_DEFAULTS[key], PRIOR_SITE_CONTENT_DEFAULTS[key]].filter(v => v != null)
    if (!legacy.includes(values[key])) result[key] = values[key]
  }
  return result
}
async function readPublishedSiteContent() {
  let revision = await SiteContentRevision.findOne({ where: { status: 'published' }, order: [['id', 'DESC']] })
  if (revision && isObject(revision.content)) return normalizeSiteContent(revision.content)
  const rows = await SiteContent.findAll()
  if (rows.length) return normalizeSiteContent(Object.fromEntries(rows.map(row => [row.content_key, row.content_value])))
  await ensureStoreDefaults()
  return { ...SITE_CONTENT_DEFAULTS }
}
async function readWorkingSiteContent() {
  const draft = await SiteContentRevision.findOne({ where: { status: 'draft' }, order: [['id', 'DESC']] })
  if (draft && isObject(draft.content)) return { ...normalizeSiteContent(draft.content), _revision_id: draft.id, _has_draft: true }
  const published = await readPublishedSiteContent()
  const revision = await SiteContentRevision.findOne({ where: { status: 'published' }, order: [['id', 'DESC']] })
  return { ...published, _revision_id: revision?.id ?? null, _has_draft: false }
}
function validateSiteContent(values) {
  if (!isObject(values)) return null
  const cleaned = {}
  const whatsappHosts = new Set(['wa.me', 'api.whatsapp.com', 'web.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com', 'chat.whatsapp.com'])
  for (const key of Object.keys(SITE_CONTENT_DEFAULTS)) if (key in values) {
    let value = values[key]
    if (typeof value !== 'string' || value.length > SITE_CONTENT_LIMITS[key]) return null
    value = value.trim()
    if (SITE_CONTENT_URL_FIELDS.includes(key) && value && !localOrHttpUrl(value)) return null
    if (key === 'whatsapp_url' && value) { try { const url = new URL(value); if (url.protocol !== 'https:' || !whatsappHosts.has(url.hostname.toLowerCase())) return null } catch { return null } }
    if (key === 'seo_robots_txt' && /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) return null
    if (key === 'seo_google_analytics_id' && value && !/^G-[A-Z0-9]+$/.test(value)) return null
    if (key === 'seo_google_tag_manager_id' && value && !/^GTM-[A-Z0-9]+$/.test(value)) return null
    if (key === 'seo_meta_pixel_id' && value && !/^\d{5,20}$/.test(value)) return null
    if (key === 'benefits') {
      let benefits
      try { benefits = value ? JSON.parse(value) : [] } catch { return null }
      if (!Array.isArray(benefits) || benefits.length > 6 || benefits.some(b => !isObject(b) || typeof b.title !== 'string' || typeof b.detail !== 'string' || b.title.length > 80 || b.detail.length > 200)) return null
      value = JSON.stringify(benefits.map(b => ({ title: b.title.trim(), detail: b.detail.trim() })))
    }
    cleaned[key] = value
  }
  return cleaned
}
function validateProductContent(payload) {
  if (!isObject(payload)) return null
  const { eyebrow = '', subtitle = '', size = '', intro = '', gallery = [], notes = [] } = payload
  if (typeof eyebrow !== 'string' || eyebrow.length > 200 || typeof subtitle !== 'string' || subtitle.length > 500 || typeof size !== 'string' || size.length > 100 || typeof intro !== 'string' || intro.length > 2000 || !Array.isArray(gallery) || gallery.length > 8 || gallery.some(url => typeof url !== 'string' || !url.trim() || !localOrHttpUrl(url.trim())) || !Array.isArray(notes) || notes.length > 20 || notes.some(n => !isObject(n) || typeof n.label !== 'string' || typeof n.value !== 'string' || n.label.length > 120 || n.value.length > 500)) return null
  return { eyebrow: eyebrow.trim(), subtitle: subtitle.trim(), size: size.trim(), intro: intro.trim(), gallery: gallery.map(s => s.trim()), notes: notes.map(n => ({ label: n.label.trim(), value: n.value.trim() })) }
}
async function settingInt(key, fallback) { const row = await StoreSetting.findByPk(key); const n = Number.parseInt(row?.value, 10); return Number.isFinite(n) ? Math.max(0, n) : fallback }
async function deliveryFeeForCity(name) { return (await DeliveryCity.findByPk(slugify(name || ''), { where: { active: true } }))?.delivery_fee ?? settingInt('delivery_fee', 350) }
async function shippingForSubtotal(subtotal, city) { const threshold = await settingInt('free_delivery_threshold', 0); return threshold > 0 && subtotal >= threshold ? 0 : deliveryFeeForCity(city) }
async function requireAdmin(req, res, next) {
  const id = req.session.admin_id, authenticatedAt = req.session.admin_authenticated_at
  const admin = id ? await Admin.findByPk(id) : null
  if (!admin || typeof authenticatedAt !== 'number' || Date.now() / 1000 - authenticatedAt > 8 * 60 * 60) { req.session.destroy(() => {}); return res.status(401).json({ error: 'Admin sign-in required. Please enter your credentials again.' }) }
  req.admin = admin; next()
}
function sessionCustomer(req) { return req.session.customer_id ? Customer.findByPk(req.session.customer_id) : Promise.resolve(null) }
async function ensureGuestToken(req) {
  let token = req.session.guest_cart_token
  if (token && !/^[a-f0-9]{32}$/.test(token)) token = null
  if (!token) { token = crypto.randomBytes(16).toString('hex'); req.session.guest_cart_token = token; await GuestCart.findOrCreate({ where: { token } }) }
  return token
}
async function readCartLines(req) {
  const customer = await sessionCustomer(req)
  const token = customer ? null : req.session.guest_cart_token
  const rows = customer ? await CartItem.findAll({ where: { customer_id: customer.id }, include: [{ model: Product, as: 'product' }] }) : token ? await GuestCartItem.findAll({ where: { cart_token: token }, include: [{ model: Product, as: 'product' }] }) : []
  return rows.filter(row => row.product?.active).map(row => ({ slug: row.product.slug, quantity: row.quantity }))
}
async function writeCartLines(req, entries) {
  if (!Array.isArray(entries) || entries.length > 100) return 'Cart must contain at most 100 items.'
  const normalized = new Map()
  for (const item of entries) {
    if (!isObject(item) || typeof item.slug !== 'string') return 'Each cart item needs a product slug and quantity.'
    const qty = positiveInt(item.quantity)
    if (!qty || qty > 99 || normalized.has(item.slug)) return 'Cart quantities must be unique and between 1 and 99.'
    const product = await Product.findOne({ where: { slug: item.slug, active: true } })
    if (!product) return 'Cart contains an unavailable product.'
    normalized.set(product.id, qty)
  }
  const customer = await sessionCustomer(req)
  if (customer) {
    await CartItem.destroy({ where: { customer_id: customer.id } })
    for (const [product_id, quantity] of normalized) await CartItem.create({ customer_id: customer.id, product_id, quantity })
  } else {
    const token = await ensureGuestToken(req)
    await GuestCartItem.destroy({ where: { cart_token: token } })
    for (const [product_id, quantity] of normalized) await GuestCartItem.create({ cart_token: token, product_id, quantity })
  }
  return null
}
async function mergeGuestCart(req, customer) {
  const token = req.session.guest_cart_token
  if (!token) return
  const guests = await GuestCartItem.findAll({ where: { cart_token: token }, include: [{ model: Product, as: 'product' }] })
  const existing = new Map((await CartItem.findAll({ where: { customer_id: customer.id } })).map(item => [item.product_id, item]))
  for (const row of guests) if (row.product?.active) {
    if (existing.has(row.product_id)) await existing.get(row.product_id).update({ quantity: Math.min(99, existing.get(row.product_id).quantity + row.quantity) })
    else await CartItem.create({ customer_id: customer.id, product_id: row.product_id, quantity: Math.min(99, row.quantity) })
  }
  await GuestCartItem.destroy({ where: { cart_token: token } })
  delete req.session.guest_cart_token
}
function signAttemptKey(key) { return crypto.createHmac('sha256', secret).update(key).digest('hex').slice(0, 32) }
function verifyAttemptKey(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([0-9a-f]{32})$/i)
  if (!match || !crypto.timingSafeEqual(Buffer.from(signAttemptKey(match[1])), Buffer.from(match[2]))) return null
  return match[1]
}
async function lookupCoupon(code, subtotal) {
  const normalized = (typeof code === 'string' ? code : '').trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,40}$/.test(normalized)) return { error: 'This coupon code can’t be applied. Check it and try again.' }
  const coupon = await Coupon.findOne({ where: sequelize.where(sequelize.fn('lower', sequelize.col('code')), normalized.toLowerCase()) })
  const now = Date.now()
  if (!coupon?.active) return { error: 'This coupon code can’t be applied to this order.' }
  if ((coupon.starts_at && new Date(coupon.starts_at).getTime() > now) || (coupon.ends_at && new Date(coupon.ends_at).getTime() <= now) || (subtotal < coupon.minimum_subtotal) || (coupon.max_uses != null && coupon.used_count >= coupon.max_uses)) return { error: 'This coupon code can’t be applied to this order.' }
  return { coupon }
}
function couponDiscount(coupon, subtotal) { return coupon.discount_type === 'percent' ? Math.min(subtotal, Math.floor(subtotal * coupon.value / 100)) : Math.min(subtotal, coupon.value) }
function serializeProductContent(content) { return content ? content.get({ plain: true }) : blankProductContent() }
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

app.get('/api', (_req, res) => res.json({ status: 'ok', health: '/api/health', catalog: '/api/catalog', products: '/api/products' }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.get('/api/products', asyncRoute(async (_req, res) => res.json((await findProducts({ active: true })).map(p => serializeProduct(p)))))
app.get('/api/catalog', asyncRoute(async (_req, res) => {
  const state = await CatalogState.findByPk(1)
  res.json({ initialized: Boolean(state?.initialized), products: (await findProducts({ active: true })).map(p => serializeProduct(p)) })
}))
app.get('/api/categories', asyncRoute(async (_req, res) => {
  await ensureStoreDefaults()
  const rows = await Category.findAll({ where: { visible: true }, order: [['sort_order', 'ASC'], ['name', 'ASC']], include: [{ model: Category, as: 'parent', required: false }] })
  res.json(rows.filter(row => !row.parent_id || row.parent?.visible).map(row => serializeCategory(row)))
}))
app.get('/api/site-content', asyncRoute(async (_req, res) => res.json(await readPublishedSiteContent())))
app.get('/robots.txt', asyncRoute(async (req, res) => {
  const content = await readPublishedSiteContent(); let rules = (content.seo_robots_txt || 'User-agent: *\nAllow: /').trim()
  const sitemap = content.seo_canonical_base?.trim() ? `${content.seo_canonical_base.replace(/\/$/, '')}/sitemap.xml` : ''
  if (sitemap && !/^\s*Sitemap:/im.test(rules)) rules = rules ? `${rules}\nSitemap: ${sitemap}` : `Sitemap: ${sitemap}`
  res.type('text/plain').send(rules + (rules ? '\n' : ''))
}))
app.get('/sitemap.xml', asyncRoute(async (req, res) => {
  const content = await readPublishedSiteContent()
  const base = content.seo_canonical_base?.trim().replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`
  const categories = await Category.findAll({ where: { visible: true }, order: [['sort_order', 'ASC'], ['name', 'ASC']] })
  const products = await Product.findAll({ where: { active: true }, order: [['slug', 'ASC']] })
  const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
  const urls = ['/', '/about', ...categories.map(c => `/collections/${c.slug}`), ...products.map(p => `/products/${p.slug}`)]
  res.type('application/xml').send(`<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(route => `<url><loc>${esc(base + route)}</loc></url>`).join('')}</urlset>`)
}))
app.get('/api/store-settings', asyncRoute(async (_req, res) => {
  await ensureStoreDefaults()
  const cities = await DeliveryCity.findAll({ where: { active: true }, order: [['sort_order', 'ASC'], ['city_name', 'ASC']] })
  res.json({ deliveryFee: await settingInt('delivery_fee', 350), freeShippingThreshold: await settingInt('free_delivery_threshold', 0), cities: cities.map(serializeCity) })
}))
app.get('/api/media/:filename', asyncRoute(async (req, res) => {
  const filename = path.basename(req.params.filename)
  if (!filename || req.params.filename.includes('..')) return res.status(404).json({ error: 'File not found.' })
  const file = path.join(uploadDirectory, filename)
  try { await fs.access(file); res.setHeader('Cache-Control', 'public, max-age=86400'); return res.sendFile(file) } catch { return res.status(404).json({ error: 'File not found.' }) }
}))
app.get('/api/cart', asyncRoute(async (req, res) => res.json({ items: await readCartLines(req) })))
app.put('/api/cart', asyncRoute(async (req, res) => {
  const data = jsonObject(req) || {}, error = await writeCartLines(req, data.items ?? [])
  if (error) return res.status(400).json({ error })
  res.json({ ok: true, items: await readCartLines(req) })
}))
app.post('/api/checkout-attempt', rateLimit('checkout-attempt', 30, 3600000), (req, res) => {
  const key = jsonObject(req)?.key
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return res.status(400).json({ error: 'A valid checkout attempt key is required. Refresh checkout and try again.' })
  res.json({ key: `${key}.${signAttemptKey(key)}` })
})
app.post('/api/coupons/preview', rateLimit('coupon-preview', 20, 900000), asyncRoute(async (req, res) => {
  const data = jsonObject(req) || {}, lines = await readCartLines(req)
  if (!lines.length) return res.status(400).json({ error: 'Your cart is empty.' })
  const products = await Product.findAll({ where: { slug: { [Op.in]: lines.map(line => line.slug) }, active: true } })
  const bySlug = new Map(products.map(p => [p.slug, p])), subtotal = lines.reduce((sum, line) => sum + (bySlug.get(line.slug)?.price_value || 0) * line.quantity, 0)
  const { coupon, error } = await lookupCoupon(data.code, subtotal)
  if (error) return res.status(400).json({ error })
  const discountAmount = couponDiscount(coupon, subtotal), shipping = await shippingForSubtotal(subtotal - discountAmount, typeof data.city === 'string' ? data.city : '')
  res.json({ code: coupon.code, subtotal, discountAmount, shipping, total: subtotal - discountAmount + shipping })
}))

async function buildOrder(req, data, customer) {
  const fields = { customerName: 160, phone: 40, email: 255, address: 1000, city: 120, postalCode: 20, note: 500 }
  const values = Object.fromEntries(Object.entries(fields).map(([key, max]) => [key, validText(data, key, max, true)]))
  const { customerName, phone, email, address, city, postalCode, note } = values
  if (email && email !== false && !emailPattern.test(email)) return { error: { error: 'Enter a valid email address.' }, status: 400 }
  if (Object.values(values).some(value => !value || value === false)) return { error: { error: 'Name, phone, email, delivery address, city, postal code, and delivery instructions are required.' }, status: 400 }
  if (!await DeliveryCity.findOne({ where: { city_slug: slugify(city), active: true } })) return { error: { error: 'Choose a delivery city from the available Pakistan cities.' }, status: 400 }
  if (!PAYMENT_METHODS.includes(data.paymentMethod)) return { error: { error: 'Choose a valid payment method.' }, status: 400 }
  const attemptKey = verifyAttemptKey(data.attemptKey)
  if (!attemptKey) return { error: { error: 'Your checkout session expired. Refresh checkout and try again.' }, status: 400 }
  const existing = await Order.findOne({ where: { idempotency_key: attemptKey }, include: [{ model: OrderItem, as: 'items' }] })
  if (existing) return { order: serializeOrder(existing), status: 200 }
  const guestToken = req.session.guest_cart_token
  const cartRows = customer ? await CartItem.findAll({ where: { customer_id: customer.id }, include: [{ model: Product, as: 'product' }] }) : guestToken ? await GuestCartItem.findAll({ where: { cart_token: guestToken }, include: [{ model: Product, as: 'product' }] }) : []
  if (!cartRows.length) return { error: { error: 'Your cart is empty.' }, status: 400 }
  const subtotal = cartRows.reduce((sum, row) => sum + (row.product?.price_value || 0) * row.quantity, 0)
  for (const row of cartRows) if (!row.product?.active) return { error: { error: 'Your cart contains an unavailable product.' }, status: 400 }
  for (const row of cartRows) if (row.product.track_stock && row.quantity > row.product.stock_quantity) return { error: { error: `${row.product.name} is out of stock or has insufficient stock.` }, status: 409 }
  let coupon = null, discountAmount = 0
  if (typeof data.couponCode === 'string' && data.couponCode.trim()) {
    const result = await lookupCoupon(data.couponCode, subtotal)
    if (result.error) return { error: { error: result.error }, status: 400 }
    coupon = result.coupon; discountAmount = couponDiscount(coupon, subtotal)
  }
  const shipping = await shippingForSubtotal(subtotal - discountAmount, city), total = subtotal - discountAmount + shipping
  const transaction = await sequelize.transaction()
  try {
    const order = await Order.create({ order_number: `TB-${crypto.randomBytes(5).toString('hex').toUpperCase()}`, customer_id: customer?.id ?? null, idempotency_key: attemptKey, subtotal, discount_amount: discountAmount, shipping, total, coupon_code: coupon?.code || '', customer_name: customerName, phone, email: email.toLowerCase(), address, city, postal_code: postalCode, note, payment_method: data.paymentMethod, payment_status: data.paymentMethod === 'cash_on_delivery' ? 'due_on_delivery' : 'pending' }, { transaction })
    for (const row of cartRows) {
      const p = row.product
      if (p.track_stock) {
        const [changed] = await Product.update({ stock_quantity: literal(`stock_quantity - ${row.quantity}`) }, { where: { id: p.id, active: true, stock_quantity: { [Op.gte]: row.quantity } }, transaction })
        if (changed !== 1) throw Object.assign(new Error(`${p.name} is out of stock or has insufficient stock.`), { status: 409 })
        await OrderStockMovement.create({ order_id: order.id, product_id: p.id, quantity: row.quantity }, { transaction })
      }
      await OrderItem.create({ order_id: order.id, product_id: p.id, product_name: p.name, product_slug: p.slug, unit_price: p.price_value, quantity: row.quantity }, { transaction })
    }
    if (coupon) {
      const [changed] = await Coupon.update({ used_count: literal('used_count + 1') }, { where: { id: coupon.id, active: true, [Op.or]: [{ max_uses: null }, literal('used_count < max_uses')] }, transaction })
      if (changed !== 1) throw Object.assign(new Error('This coupon just ran out. Remove it and try again.'), { status: 409 })
    }
    if (customer) await CartItem.destroy({ where: { customer_id: customer.id }, transaction })
    if (guestToken) await GuestCartItem.destroy({ where: { cart_token: guestToken }, transaction })
    await transaction.commit()
    const saved = await Order.findByPk(order.id, { include: [{ model: OrderItem, as: 'items' }] })
    return { order: serializeOrder(saved), status: 201 }
  } catch (error) { await transaction.rollback(); return { error: { error: error.message || 'Could not place the order.' }, status: error.status || 409 } }
}
app.post('/api/orders', rateLimit('orders', 10, 3600000), asyncRoute(async (req, res) => {
  const data = jsonObject(req); if (!data) return res.status(400).json({ error: 'A JSON object is required.' })
  const result = await buildOrder(req, data, await sessionCustomer(req)); if (result.error) return res.status(result.status).json(result.error)
  res.status(result.status).json(result.order)
}))

app.post('/api/customer/register', rateLimit('register', 5, 3600000), asyncRoute(async (req, res) => {
  const data = jsonObject(req); if (!data) return res.status(400).json({ error: 'A JSON object is required.' })
  const email = validText(data, 'email', 255, true), name = validText(data, 'name', 160, true), password = data.password
  if (!email || email === false || !emailPattern.test(email) || !name || name === false || typeof password !== 'string' || password.length < 8 || password.length > 256) return res.status(400).json({ error: 'Enter your name, a valid email, and a password with at least 8 characters.' })
  if (await Customer.findOne({ where: { email: email.toLowerCase() } })) return res.status(409).json({ error: 'An account with that email already exists.' })
  const customer = await Customer.create({ email: email.toLowerCase(), name, password_hash: passwordHash(password) })
  const guestToken = req.session.guest_cart_token; await new Promise(resolve => req.session.regenerate(resolve)); if (guestToken) req.session.guest_cart_token = guestToken
  req.session.customer_id = customer.id; await mergeGuestCart(req, customer)
  res.status(201).json({ id: customer.id, email: customer.email, name: customer.name })
}))
app.post('/api/customer/login', rateLimit('customer-login', 10, 900000), asyncRoute(async (req, res) => {
  const data = jsonObject(req); if (!data || typeof data.email !== 'string' || typeof data.password !== 'string') return res.status(401).json({ error: 'Invalid email or password.' })
  const customer = await Customer.findOne({ where: { email: data.email.trim().toLowerCase() } })
  if (!customer || data.password.length > 256 || !verifyPassword(customer.password_hash, data.password)) return res.status(401).json({ error: 'Invalid email or password.' })
  const guestToken = req.session.guest_cart_token; await new Promise(resolve => req.session.regenerate(resolve)); if (guestToken) req.session.guest_cart_token = guestToken
  req.session.customer_id = customer.id; await mergeGuestCart(req, customer)
  res.json({ id: customer.id, email: customer.email, name: customer.name })
}))
app.post('/api/customer/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })))
app.get('/api/customer/session', asyncRoute(async (req, res) => { const c = await sessionCustomer(req); res.json({ authenticated: Boolean(c), id: c?.id ?? null, email: c?.email ?? null, name: c?.name ?? null }) }))
app.get('/api/customer/cart', asyncRoute(async (req, res) => { const c = await sessionCustomer(req); if (!c) return res.status(401).json({ error: 'Sign in required.' }); res.json(await readCartLines(req)) }))
app.put('/api/customer/cart', asyncRoute(async (req, res) => { if (!await sessionCustomer(req)) return res.status(401).json({ error: 'Sign in required.' }); const error = await writeCartLines(req, jsonObject(req)?.items ?? []); if (error) return res.status(400).json({ error }); res.json({ ok: true }) }))
app.get('/api/customer/favorites', asyncRoute(async (req, res) => { const c = await sessionCustomer(req); if (!c) return res.status(401).json({ error: 'Sign in required.' }); const rows = await Favorite.findAll({ where: { customer_id: c.id }, include: [{ model: Product, as: 'product' }] }); res.json(rows.filter(x => x.product?.active).map(x => x.product.slug)) }))
app.put('/api/customer/favorites', asyncRoute(async (req, res) => {
  const c = await sessionCustomer(req); if (!c) return res.status(401).json({ error: 'Sign in required.' })
  const slugs = jsonObject(req)?.slugs ?? []
  if (!Array.isArray(slugs) || slugs.length > 200 || slugs.some(s => typeof s !== 'string')) return res.status(400).json({ error: 'Favorites must be a list of at most 200 product slugs.' })
  const unique = [...new Set(slugs)], products = await Product.findAll({ where: { slug: { [Op.in]: unique }, active: true } })
  if (products.length !== unique.length || unique.length !== slugs.length) return res.status(400).json({ error: 'Favorites contain an unavailable product.' })
  const t = await sequelize.transaction(); try { await Favorite.destroy({ where: { customer_id: c.id }, transaction: t }); for (const p of products) await Favorite.create({ customer_id: c.id, product_id: p.id }, { transaction: t }); await t.commit() } catch (e) { await t.rollback(); throw e }
  res.json({ ok: true })
}))
app.post('/api/customer/orders', rateLimit('orders', 10, 3600000), asyncRoute(async (req, res) => { const c = await sessionCustomer(req); if (!c) return res.status(401).json({ error: 'Sign in before checking out.' }); const data = jsonObject(req); if (!data) return res.status(400).json({ error: 'A JSON object is required.' }); const result = await buildOrder(req, data, c); if (result.error) return res.status(result.status).json(result.error); res.status(result.status).json(result.order) }))
app.get('/api/customer/orders', asyncRoute(async (req, res) => { const c = await sessionCustomer(req); if (!c) return res.status(401).json({ error: 'Sign in required.' }); const orders = await Order.findAll({ where: { customer_id: c.id }, order: [['created_at', 'DESC']], include: [{ model: OrderItem, as: 'items' }] }); res.json(orders.map(serializeOrder)) }))

// -- admin authentication and reporting ----------------------------------------------
app.post('/api/admin/login', rateLimit('admin-login', 10, 900000), asyncRoute(async (req, res) => {
  const data = jsonObject(req)
  if (!data || typeof data.email !== 'string' || typeof data.password !== 'string') return res.status(401).json({ error: 'Invalid email or password' })
  const admin = await Admin.findOne({ where: { email: data.email.trim().toLowerCase() } })
  if (!admin || data.password.length > 256 || !verifyPassword(admin.password_hash, data.password)) return res.status(401).json({ error: 'Invalid email or password' })
  await new Promise(resolve => req.session.regenerate(resolve))
  req.session.admin_id = admin.id; req.session.admin_authenticated_at = Date.now() / 1000
  res.json({ email: admin.email })
}))
app.post('/api/admin/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })))
app.get('/api/admin/session', asyncRoute(async (req, res) => {
  const admin = req.session.admin_id ? await Admin.findByPk(req.session.admin_id) : null
  const valid = admin && typeof req.session.admin_authenticated_at === 'number' && Date.now() / 1000 - req.session.admin_authenticated_at <= 8 * 60 * 60
  if (!valid) req.session.destroy(() => {})
  res.json({ authenticated: Boolean(valid), email: valid ? admin.email : null })
}))
app.get('/api/admin/dashboard', asyncRoute(requireAdmin, asyncRoute(async (_req, res) => {
  const [products, orders] = await Promise.all([Product.findAll(), Order.findAll({ include: [{ model: OrderItem, as: 'items' }] })])
  const threshold = await settingInt('low_stock_threshold', 3), activeOrders = orders.filter(o => o.status !== 'cancelled')
  const lowStock = products.filter(p => p.track_stock && p.active && p.stock_quantity <= threshold).sort((a,b) => a.stock_quantity-b.stock_quantity).slice(0,10).map(p => ({ slug:p.slug,name:p.name,stockQuantity:p.stock_quantity }))
  const recent = orders.sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).slice(0,5)
  res.json({ products:products.length, unitsInStock:products.reduce((n,p)=>n+(p.track_stock?p.stock_quantity:0),0), categories:new Set(products.map(p=>p.category)).size, catalogValue:products.reduce((n,p)=>n+p.price_value,0), orders:orders.length, pendingOrders:orders.filter(o=>o.status==='pending').length, revenue:activeOrders.reduce((n,o)=>n+o.total,0), lowStock, recentOrders:recent.map(serializeOrder) })
})))
app.get('/api/admin/sales', asyncRoute(requireAdmin, asyncRoute(async (req, res) => {
  const days = Number.parseInt(req.query.days || '30',10)
  if (![7,30,90].includes(days)) return res.status(400).json({ error: 'Sales range must be 7, 30, or 90 days.' })
  const today = new Date(); today.setUTCHours(0,0,0,0)
  const first = new Date(today); first.setUTCDate(first.getUTCDate()-days+1)
  const prior = new Date(first); prior.setUTCDate(prior.getUTCDate()-days)
  const orders = await Order.findAll({ where: { status: { [Op.ne]:'cancelled' }, created_at: { [Op.gte]:prior, [Op.lt]:new Date(today.getTime()+86400000) } }, include: [{ model: OrderItem, as: 'items' }] })
  const current = orders.filter(o=>new Date(o.created_at)>=first), previous = orders.filter(o=>new Date(o.created_at)<first)
  const daily = new Map(Array.from({length:days},(_,i)=>{const d=new Date(first);d.setUTCDate(d.getUTCDate()+i);const key=d.toISOString().slice(0,10);return [key,{date:key,orders:0,revenue:0}]}))
  for(const order of current){const key=new Date(order.created_at).toISOString().slice(0,10);if(daily.has(key)){daily.get(key).orders++;daily.get(key).revenue+=order.total}}
  const top=new Map()
  for(const order of current)for(const item of order.items){const row=top.get(item.product_name)||{name:item.product_name,units:0,revenue:0};row.units+=item.quantity;row.revenue+=item.unit_price*item.quantity;top.set(item.product_name,row)}
  const revenue=current.reduce((n,o)=>n+o.total,0), previousRevenue=previous.reduce((n,o)=>n+o.total,0)
  res.json({days,orders:current.length,revenue,averageOrderValue:current.length?Math.round(revenue/current.length):0,previousRevenue,previousOrders:previous.length,daily:[...daily.values()],topProducts:[...top.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,8)})
})))

function orderFilter(req) {
  const where = {}, search = String(req.query.search || '').trim().slice(0,120)
  if (search) where[Op.or] = ['order_number','customer_name','phone','email'].map(field => sequelize.where(sequelize.fn('lower',sequelize.col(field)),{[Op.like]:`%${search.toLowerCase()}%`}))
  for (const [key, allowed, field, message] of [['status',ORDER_STATUSES,'status','Invalid order status filter.'],['payment_status',PAYMENT_STATUSES,'payment_status','Invalid payment status filter.'],['payment_method',PAYMENT_METHODS,'payment_method','Invalid payment method filter.']]) {
    const value=req.query[key]; if(value){if(!allowed.includes(value))return {error:message};where[field]=value}
  }
  return {where}
}
app.get('/api/admin/orders', asyncRoute(requireAdmin, asyncRoute(async (req,res)=>{
  const {where,error}=orderFilter(req);if(error)return res.status(400).json({error})
  const page=Math.max(1,Math.min(1000000,Number.parseInt(req.query.page||'1',10))), pageSize=Math.max(1,Math.min(100,Number.parseInt(req.query.pageSize||'25',10)))
  if(!Number.isFinite(page)||!Number.isFinite(pageSize))return res.status(400).json({error:'Invalid pagination.'})
  const {count,rows}=await Order.findAndCountAll({where,order:[['created_at','DESC']],offset:(page-1)*pageSize,limit:pageSize,distinct:true,col:'id',include:[{model:OrderItem,as:'items'}]})
  res.json({total:count,page,pageSize,orders:rows.map(serializeOrder)})
})))
const orderExportHeaders=['Order','Date','Customer','Phone','Email','City','Address','Postal code','Delivery instructions','Status','Payment method','Payment status','Items','Subtotal (PKR)','Discount (PKR)','Coupon','Shipping (PKR)','Total (PKR)']
async function getExportOrders(req,res){const {where,error}=orderFilter(req);if(error){res.status(400).json({error});return null}return Order.findAll({where,order:[['created_at','DESC']],limit:5000,include:[{model:OrderItem,as:'items'}]})}
app.get('/api/admin/orders/export.csv',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const orders=await getExportOrders(req,res);if(!orders)return
  const headers=['Order','Date','Customer','Phone','Email','City','Address','Status','Payment method','Payment status','Items','Subtotal','Discount','Shipping','Total']
  const q=value=>`"${String(value??'').replaceAll('"','""')}"`
  const lines=[headers,...orders.map(o=>[o.order_number,o.created_at.toISOString(),o.customer_name,o.phone,o.email,o.city,o.address,o.status,o.payment_method,o.payment_status,o.items.map(i=>`${i.product_name} x${i.quantity}`).join('; '),o.subtotal,o.discount_amount,o.shipping,o.total])].map(row=>row.map(q).join(','))
  res.type('text/csv').setHeader('Content-Disposition','attachment; filename=technobaazar-orders.csv').send(lines.join('\r\n'))
})))
function columnName(number){let name='';while(number){number--;name=String.fromCharCode(65+number%26)+name;number=Math.floor(number/26)}return name}
function cleanSheetText(value){return String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'')}
function makeXlsx(rows){
  const main='http://schemas.openxmlformats.org/spreadsheetml/2006/main',office='http://schemas.openxmlformats.org/officeDocument/2006/relationships',pkg='http://schemas.openxmlformats.org/package/2006/relationships',types='http://schemas.openxmlformats.org/package/2006/content-types',xml='http://www.w3.org/XML/1998/namespace'
  const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')
  const sheetRows=rows.map((values,rowIndex)=>`<row r="${rowIndex+1}">${values.map((raw,colIndex)=>{const ref=`${columnName(colIndex+1)}${rowIndex+1}`;if(typeof raw==='number'&&Number.isFinite(raw))return `<c r="${ref}" t="n"><v>${raw}</v></c>`;const text=cleanSheetText(raw),preserve=/^\s|\s$/.test(text)?` xml:space="preserve"`:'';return `<c r="${ref}" t="inlineStr"><is><t${preserve}>${esc(text)}</t></is></c>`}).join('')}</row>`).join('')
  const files={
    '[Content_Types].xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${types}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${main}" xmlns:r="${office}"><sheets><sheet name="Orders" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${main}" xmlns:r="${office}" xmlns:xml="${xml}"><sheetData>${sheetRows}</sheetData></worksheet>`,
  }
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([name,value])=>[name,strToU8(value)])),{level:6}))
}
app.get('/api/admin/orders/export.xlsx',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const orders=await getExportOrders(req,res);if(!orders)return
  const rows=[orderExportHeaders,...orders.map(o=>[o.order_number,o.created_at.toISOString(),o.customer_name,o.phone,o.email,o.city,o.address,o.postal_code,o.note,o.status,o.payment_method,o.payment_status,o.items.map(i=>`${i.product_name} x${i.quantity} @ PKR ${Number(i.unit_price).toLocaleString('en-US')}`).join('; '),o.subtotal,o.discount_amount,o.coupon_code,o.shipping,o.total])]
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').setHeader('Content-Disposition','attachment; filename=technobaazar-orders.xlsx').send(makeXlsx(rows))
})))
app.patch('/api/admin/orders/:order_number',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const order=await Order.findOne({where:{order_number:req.params.order_number},include:[{model:OrderItem,as:'items'}]});if(!order)return res.status(404).json({error:'Order not found.'})
  const data=jsonObject(req)||{}
  if('status'in data&& !ORDER_STATUSES.includes(data.status))return res.status(400).json({error:'Invalid order status.'})
  if('status'in data&&order.status==='cancelled'&&data.status!=='cancelled')return res.status(409).json({error:'Cancelled orders cannot be reopened. Create a new order instead.'})
  if('paymentStatus'in data&&!PAYMENT_STATUSES.includes(data.paymentStatus))return res.status(400).json({error:'Invalid payment status.'})
  const nextNote='note'in data?validText(data,'note',500):null
  if(nextNote===false)return res.status(400).json({error:'Order note is too long.'})
  const t=await sequelize.transaction()
  try{
    if('status'in data){if(data.status==='cancelled'&&order.status!=='cancelled'&&!order.stock_restored_at){const movements=await OrderStockMovement.findAll({where:{order_id:order.id,restored_at:null},transaction:t});for(const m of movements){if(m.product_id)await Product.update({stock_quantity:literal(`stock_quantity + ${Number(m.quantity)}`)},{where:{id:m.product_id},transaction:t});await m.update({restored_at:new Date()},{transaction:t})}order.stock_restored_at=new Date()};order.status=data.status}
    if('paymentStatus'in data)order.payment_status=data.paymentStatus
    if('note'in data)order.note=nextNote||''
    await order.save({transaction:t});await t.commit();await order.reload({include:[{model:OrderItem,as:'items'}]});res.json(serializeOrder(order))
  }catch(e){await t.rollback();throw e}
})))
app.delete('/api/admin/orders/:order_number',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const order=await Order.findOne({where:{order_number:req.params.order_number}});if(!order)return res.status(404).json({error:'Order not found.'})
  const t=await sequelize.transaction();try{if(!order.stock_restored_at){const ms=await OrderStockMovement.findAll({where:{order_id:order.id,restored_at:null},transaction:t});for(const m of ms)if(m.product_id)await Product.update({stock_quantity:literal(`stock_quantity + ${Number(m.quantity)}`)},{where:{id:m.product_id},transaction:t});if(ms.length)order.stock_restored_at=new Date()}
    if(order.coupon_code){const coupon=await Coupon.findOne({where:{code:order.coupon_code},transaction:t});if(coupon&&coupon.used_count>0)await coupon.update({used_count:coupon.used_count-1},{transaction:t})}
    await OrderStockMovement.destroy({where:{order_id:order.id},transaction:t});await OrderItem.destroy({where:{order_id:order.id},transaction:t});await order.destroy({transaction:t});await t.commit();res.status(204).end()
  }catch(e){await t.rollback();throw e}
})))

// -- admin products and customizable product pages -----------------------------------
function productFieldMap(data) {
  const strings={slug:validText(data,'slug',180,true),name:validText(data,'name',240,true),category:validText(data,'category',100,true),brand:validText(data,'brand',120,true)}
  const price=positiveInt(data.priceValue), compare=data.compareAtPrice==null||data.compareAtPrice===''?null:positiveInt(data.compareAtPrice),stock=positiveInt(data.stockQuantity??0,true)
  const specs=data.specifications??[],image=data.image??'',trackStock=data.trackStock??true
  const optional={detail:validText(data,'detail',300),description:validText(data,'description',5000),badge:validText(data,'badge',100),image_alt:validText(data,'imageAlt',300),seo_title:validText(data,'seoTitle',200),seo_description:validText(data,'seoDescription',500),seo_keywords:validText(data,'seoKeywords',500),og_title:validText(data,'ogTitle',200),og_description:validText(data,'ogDescription',500),og_image:validText(data,'ogImage',2000),canonical_url:validText(data,'canonicalUrl',1000)}
  if(Object.values(strings).some(v=>!v||v===false)||!/^([a-z0-9]+)(-[a-z0-9]+)*$/.test(strings.slug)||!price||price>1e12||(data.compareAtPrice!=null&&data.compareAtPrice!==''&&!compare)||stock==null||stock>1e6||!Array.isArray(specs)||specs.length>100||specs.some(s=>typeof s!=='string'||s.length>300)||typeof image!=='string'||image.length>2000||(image&&!localOrHttpUrl(image))||Object.values(optional).some(v=>v===false)||(optional.og_image&&!localOrHttpUrl(optional.og_image))||typeof trackStock!=='boolean'||('active'in data&&typeof data.active!=='boolean'))return null
  return {...strings,price_value:price,compare_at_price:compare,stock_quantity:stock,specifications:specs,image,track_stock:trackStock,active:data.active??true,...Object.fromEntries(Object.entries(optional).map(([k,v])=>[k,v||'']))}
}
app.post('/api/admin/products',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const data=jsonObject(req);if(!data)return res.status(400).json({error:'A JSON object is required.'})
  if(!['slug','name','category','brand','priceValue'].every(k=>k in data))return res.status(400).json({error:'slug, name, category, brand, and priceValue are required'})
  const fields=productFieldMap(data);if(!fields)return res.status(400).json({error:'Product fields have invalid values.'})
  if(!PRODUCT_CATEGORIES.includes(fields.category)&&!await Category.findOne({where:{name:fields.category}}))return res.status(400).json({error:'Choose one of the existing product categories.'})
  const content=typeof data.content==='object'&&data.content!==null?validateProductContent(data.content):null;if(data.content&&!content)return res.status(400).json({error:'Product content has invalid values.'})
  const t=await sequelize.transaction();try{const product=await Product.create(fields,{transaction:t});if(content)await ProductContent.create({product_id:product.id,...content},{transaction:t});await t.commit();await product.reload({include:productInclude});res.status(201).json(serializeProduct(product))}catch(e){await t.rollback();if(e instanceof UniqueConstraintError)return res.status(409).json({error:'Could not save product. Check for duplicate slug.'});throw e}
})))
app.put('/api/admin/products/:slug',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const product=await Product.findOne({where:{slug:req.params.slug}});if(!product)return res.status(404).json({error:'Product not found.'})
  const data=jsonObject(req);if(!data)return res.status(400).json({error:'A JSON object is required.'})
  const map={name:['name',240],category:['category',100],brand:['brand',120],detail:['detail',300],description:['description',5000],badge:['badge',100],imageAlt:['image_alt',300],seoTitle:['seo_title',200],seoDescription:['seo_description',500],seoKeywords:['seo_keywords',500],ogTitle:['og_title',200],ogDescription:['og_description',500],canonicalUrl:['canonical_url',1000]};const changes={}
  for(const [incoming,[column,max]] of Object.entries(map))if(incoming in data){const v=validText(data,incoming,max,['name','brand','category'].includes(incoming));if(v===false)return res.status(400).json({error:`${incoming} is too long or invalid.`});changes[column]=v||''}
  for(const [incoming,column,max,allowZero] of [['priceValue','price_value',1e12,false],['stockQuantity','stock_quantity',1e6,true]])if(incoming in data){const v=positiveInt(data[incoming],allowZero);if(v==null||v>max)return res.status(400).json({error:`${incoming} is outside the supported range.`});changes[column]=v}
  if('compareAtPrice'in data){const v=data.compareAtPrice==null||data.compareAtPrice===''?null:positiveInt(data.compareAtPrice);if(data.compareAtPrice!=null&&data.compareAtPrice!==''&&!v)return res.status(400).json({error:'compareAtPrice is outside the supported range.'});changes.compare_at_price=v}
  if('specifications'in data){if(!Array.isArray(data.specifications)||data.specifications.length>100||data.specifications.some(s=>typeof s!=='string'||s.length>300))return res.status(400).json({error:'specifications must be a list of at most 100 short strings.'});changes.specifications=data.specifications}
  for(const [incoming,column]of [['trackStock','track_stock'],['active','active']])if(incoming in data){if(typeof data[incoming]!=='boolean')return res.status(400).json({error:`${incoming} must be a boolean.`});changes[column]=data[incoming]}
  for(const [incoming,column]of [['image','image'],['ogImage','og_image']])if(incoming in data){const v=data[incoming];if(typeof v!=='string'||v.length>2000||(v&&!localOrHttpUrl(v)))return res.status(400).json({error:`${incoming} must be a relative path or an HTTP(S) URL.`});changes[column]=v}
  if(changes.category&&!PRODUCT_CATEGORIES.includes(changes.category)&&!await Category.findOne({where:{name:changes.category}}))return res.status(400).json({error:'Choose one of the existing product categories.'})
  await product.update(changes);await product.reload({include:productInclude});res.json(serializeProduct(product))
})))
app.put('/api/admin/products/:slug/content',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const product=await Product.findOne({where:{slug:req.params.slug}});if(!product)return res.status(404).json({error:'Product not found.'})
  const content=validateProductContent(jsonObject(req));if(!content)return res.status(400).json({error:'Product content has invalid values.'})
  await ProductContent.upsert({product_id:product.id,...content,updated_at:new Date()});await product.reload({include:productInclude});res.json(serializeProduct(product))
})))
app.delete('/api/admin/products/:slug',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const product=await Product.findOne({where:{slug:req.params.slug}});if(!product)return res.status(404).json({error:'Product not found.'});await product.destroy();res.status(204).end()
})))

// -- admin landing CMS ----------------------------------------------------------------
app.get('/api/admin/site-content',asyncRoute(requireAdmin,asyncRoute(async(_req,res)=>res.json(await readWorkingSiteContent()))))
app.put('/api/admin/site-content',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const data=jsonObject(req)||{},cleaned=validateSiteContent(data.values||{});if(!cleaned)return res.status(400).json({error:'Landing content has invalid values.'})
  const note=validText(data,'note',240);if(note===false)return res.status(400).json({error:'Revision note is too long.'})
  const base=await readWorkingSiteContent(),snapshot=Object.fromEntries(Object.keys(SITE_CONTENT_DEFAULTS).map(k=>[k,base[k]??SITE_CONTENT_DEFAULTS[k]]));Object.assign(snapshot,cleaned)
  const t=await sequelize.transaction();try{await SiteContentRevision.update({status:'superseded'},{where:{status:'draft'},transaction:t});const rev=await SiteContentRevision.create({content:snapshot,status:'draft',editor:req.admin.email.slice(0,120),note:note||''},{transaction:t});await t.commit();res.json({revisionId:rev.id,hasDraft:true})}catch(e){await t.rollback();throw e}
})))
app.post('/api/admin/site-content/publish',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const draft=await SiteContentRevision.findOne({where:{status:'draft'},order:[['id','DESC']]});if(!draft)return res.status(400).json({error:'There is no saved content draft to publish.'})
  const content=normalizeSiteContent(draft.content),t=await sequelize.transaction();try{await SiteContentRevision.update({status:'superseded'},{where:{status:'published'},transaction:t});await draft.update({status:'published',editor:req.admin.email.slice(0,120),published_at:new Date()},{transaction:t});for(const [content_key,content_value]of Object.entries(content))await SiteContent.upsert({content_key,content_value,updated_at:new Date()},{transaction:t});await t.commit();res.json({...content,_revision_id:draft.id,_has_draft:false})}catch(e){await t.rollback();throw e}
})))
app.post('/api/admin/site-content/discard',asyncRoute(requireAdmin,asyncRoute(async(_req,res)=>{const draft=await SiteContentRevision.findOne({where:{status:'draft'},order:[['id','DESC']]});if(!draft)return res.status(400).json({error:'There is no saved content draft to discard.'});await draft.update({status:'discarded'});res.json({ok:true})})))
app.get('/api/admin/site-content/history',asyncRoute(requireAdmin,asyncRoute(async(_req,res)=>{const rows=await SiteContentRevision.findAll({order:[['id','DESC']],limit:20});res.json(rows.map(r=>({id:r.id,status:r.status,editor:r.editor,note:r.note,createdAt:r.created_at.toISOString(),publishedAt:r.published_at?.toISOString()||null}))) })))
app.post('/api/admin/site-content/history/:revision_id/restore',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const rev=await SiteContentRevision.findByPk(positiveInt(req.params.revision_id));if(!rev||!isObject(rev.content))return res.status(404).json({error:'Revision not found.'})
  await SiteContentRevision.update({status:'superseded'},{where:{status:'draft'}});const draft=await SiteContentRevision.create({content:normalizeSiteContent(rev.content),status:'draft',editor:req.admin.email.slice(0,120),note:`Restored from revision ${rev.id}`.slice(0,240)});res.json({revisionId:draft.id,hasDraft:true})
})))

// -- categories and category specification fields ------------------------------------
app.get('/api/admin/categories',asyncRoute(requireAdmin,asyncRoute(async(_req,res)=>{await ensureStoreDefaults();const rows=await Category.findAll({order:[['sort_order','ASC'],['name','ASC']],include:[{model:Category,as:'parent'}]});res.json(rows.map(r=>serializeCategory(r)))})))
app.post('/api/admin/categories',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  await ensureStoreDefaults();const data=jsonObject(req)||{},name=validText(data,'name',100,true);if(!name||name===false)return res.status(400).json({error:'Enter a category name up to 100 characters.'})
  if(await Category.findOne({where:sequelize.where(sequelize.fn('lower',sequelize.col('name')),name.toLowerCase())}))return res.status(409).json({error:'A category with that name already exists.'})
  let parent=null;if(data.parentId!=null){const id=positiveInt(data.parentId);if(!id)return res.status(400).json({error:'Choose a valid parent category.'});parent=await Category.findByPk(id);if(!parent||parent.parent_id!=null)return res.status(400).json({error:'Subcategories must be created under a main category.'})}
  const slug=slugify(name);if(!slug||await Category.findOne({where:{slug}}))return res.status(409).json({error:'That category name has an invalid or duplicate URL slug.'})
  const siblings=await Category.count({where:{parent_id:parent?.id??null}}),category=await Category.create({name,slug,parent_id:parent?.id??null,sort_order:(siblings+1)*10,visible:true});const joined=await Category.findByPk(category.id,{include:[{model:Category,as:'parent'}]});res.status(201).json(serializeCategory(joined))
})))
app.put('/api/admin/categories/:id',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const category=await Category.findByPk(positiveInt(req.params.id));if(!category)return res.status(404).json({error:'Category not found.'});const data=jsonObject(req)||{},changes={}
  if('visible'in data){if(typeof data.visible!=='boolean')return res.status(400).json({error:'visible must be a boolean.'});changes.visible=data.visible}
  if('sortOrder'in data){const n=positiveInt(data.sortOrder,true);if(n==null||n>100000)return res.status(400).json({error:'sortOrder must be between 0 and 100000.'});changes.sort_order=n}
  if('parentId'in data){const id=data.parentId==null?null:positiveInt(data.parentId);const parent=id?await Category.findByPk(id):null;if((id&&(!parent||parent.id===category.id||parent.parent_id!=null))||(id==null&&data.parentId!=null))return res.status(400).json({error:'Choose a main category as the parent.'});if(id&&await Category.count({where:{parent_id:category.id}}))return res.status(400).json({error:'A category with subcategories cannot be moved under another category.'});changes.parent_id=parent?.id??null}
  await category.update(changes);const updated=await Category.findByPk(category.id,{include:[{model:Category,as:'parent'}]});res.json(serializeCategory(updated))
})))
app.get('/api/admin/category-fields',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{await ensureStoreDefaults();const where=req.query.category?{category_name:req.query.category}:{};const rows=await CategoryCustomField.findAll({where,order:[['category_name','ASC'],['sort_order','ASC'],['label','ASC']]});res.json(rows.map(f=>({id:f.id,category:f.category_name,label:f.label,placeholder:f.placeholder,sortOrder:f.sort_order})))})))
app.post('/api/admin/category-fields',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const data=jsonObject(req)||{},category=validText(data,'category',100,true),label=validText(data,'label',100,true),placeholder=validText(data,'placeholder',200)||''
  if(!category||category===false||(!PRODUCT_CATEGORIES.includes(category)&&!await Category.findOne({where:{name:category}})))return res.status(400).json({error:'Choose one of the existing product categories.'})
  if(!label||label===false)return res.status(400).json({error:'Enter a field label up to 100 characters.'});if(placeholder===false)return res.status(400).json({error:'Placeholder must be at most 200 characters.'})
  if(await CategoryCustomField.findOne({where:{category_name:category,label}}))return res.status(409).json({error:'That field already exists for this category.'})
  const top=await CategoryCustomField.findOne({where:{category_name:category},order:[['sort_order','DESC']]}),field=await CategoryCustomField.create({category_name:category,label,placeholder,sort_order:(top?.sort_order||0)+10});res.status(201).json({id:field.id,category:field.category_name,label:field.label,placeholder:field.placeholder,sortOrder:field.sort_order})
})))
app.put('/api/admin/category-fields/:id',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{
  const field=await CategoryCustomField.findByPk(positiveInt(req.params.id));if(!field)return res.status(404).json({error:'Field not found.'});const data=jsonObject(req)||{},changes={}
  if('label'in data){const label=validText(data,'label',100,true);if(!label||label===false)return res.status(400).json({error:'Enter a field label up to 100 characters.'});if(label!==field.label&&await CategoryCustomField.findOne({where:{category_name:field.category_name,label}}))return res.status(409).json({error:'That field already exists for this category.'});changes.label=label}
  if('placeholder'in data){const v=validText(data,'placeholder',200)||'';if(v===false)return res.status(400).json({error:'Placeholder must be at most 200 characters.'});changes.placeholder=v}
  if('sortOrder'in data){const n=positiveInt(data.sortOrder,true);if(n==null||n>100000)return res.status(400).json({error:'sortOrder must be between 0 and 100000.'});changes.sort_order=n}
  await field.update(changes);res.json({id:field.id,category:field.category_name,label:field.label,placeholder:field.placeholder,sortOrder:field.sort_order})
})))
app.delete('/api/admin/category-fields/:id',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{const f=await CategoryCustomField.findByPk(positiveInt(req.params.id));if(!f)return res.status(404).json({error:'Field not found.'});await f.destroy();res.status(204).end()})))

// -- coupons and delivery settings ----------------------------------------------------
function validateCoupon(data, existing) {
  const code=validText(data,'code',40, !existing);if(code===false||(code&&!/^[A-Z0-9_-]{3,40}$/i.test(code)))return {error:'Coupon code must be 3-40 characters (letters, numbers, _ or -).'}
  const discount_type=data.discountType??existing?.discount_type;if(!['percent','fixed'].includes(discount_type))return {error:'discountType must be percent or fixed.'}
  const value=positiveInt(data.value??existing?.value),minimum=positiveInt(data.minimumSubtotal??existing?.minimum_subtotal??0,true)
  if(!value||(discount_type==='percent'&&value>100)||value>1e9)return {error:'Coupon value is outside the supported range.'};if(minimum==null||minimum>1e12)return {error:'minimumSubtotal is outside the supported range.'}
  const parseDate=(raw,prior)=>{if(raw===undefined)return prior??null;if(raw==null||raw==='')return null;if(typeof raw!=='string'||!Number.isFinite(Date.parse(raw)))return false;return new Date(raw)}
  const starts_at=parseDate(data.startsAt,existing?.starts_at),ends_at=parseDate(data.endsAt,existing?.ends_at);if(starts_at===false||ends_at===false)return {error:'Coupon dates must be valid ISO timestamps or blank.'};if(starts_at&&ends_at&&ends_at<=starts_at)return {error:'Coupon end date must be after the start date.'}
  let max_uses=data.maxUses===undefined?existing?.max_uses??null:data.maxUses;if(max_uses===''||max_uses==null)max_uses=null;else{max_uses=positiveInt(max_uses);if(max_uses==null||max_uses>1e6)return {error:'maxUses must be a positive whole number or blank.'}}
  const active=data.active??existing?.active??true;if(typeof active!=='boolean')return {error:'active must be a boolean.'}
  return {values:{...(code?{code:code.toUpperCase()}:{}),discount_type,value,minimum_subtotal:minimum,starts_at,ends_at,max_uses,active}}
}
app.get('/api/admin/coupons',asyncRoute(requireAdmin,asyncRoute(async(_req,res)=>res.json((await Coupon.findAll({order:[['code','ASC']]})).map(serializeCoupon)))))
app.post('/api/admin/coupons',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{const v=validateCoupon(jsonObject(req)||{});if(v.error)return res.status(400).json({error:v.error});if(await Coupon.findOne({where:sequelize.where(sequelize.fn('lower',sequelize.col('code')),v.values.code.toLowerCase())}))return res.status(409).json({error:'A coupon with that code already exists.'});res.status(201).json(serializeCoupon(await Coupon.create(v.values)))})))
app.put('/api/admin/coupons/:id',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{const c=await Coupon.findByPk(positiveInt(req.params.id));if(!c)return res.status(404).json({error:'Coupon not found.'});const v=validateCoupon(jsonObject(req)||{},c);if(v.error)return res.status(400).json({error:v.error});if(v.values.code&&v.values.code.toLowerCase()!==c.code.toLowerCase()&&await Coupon.findOne({where:{id:{[Op.ne]:c.id},[Op.and]:sequelize.where(sequelize.fn('lower',sequelize.col('code')),v.values.code.toLowerCase())}}))return res.status(409).json({error:'A coupon with that code already exists.'});await c.update(v.values);res.json(serializeCoupon(c))})))
app.delete('/api/admin/coupons/:id',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{const c=await Coupon.findByPk(positiveInt(req.params.id));if(!c)return res.status(404).json({error:'Coupon not found.'});await c.destroy();res.status(204).end()})))
app.get('/api/admin/settings',asyncRoute(requireAdmin,asyncRoute(async(_req,res)=>{await ensureStoreDefaults();const cities=await DeliveryCity.findAll({order:[['sort_order','ASC'],['city_name','ASC']]});res.json({deliveryFee:await settingInt('delivery_fee',350),freeDeliveryThreshold:await settingInt('free_delivery_threshold',0),lowStockThreshold:await settingInt('low_stock_threshold',3),cities:cities.map(serializeCity)})})))
async function saveSetting(key,req,field,max,label,res){const n=positiveInt(jsonObject(req)?.[field],true);if(n==null||n>max){res.status(400).json({error:`${label} is outside the supported range.`});return false}await StoreSetting.upsert({key,value:String(n)});return true}
for(const [route,key,max,label,responseKey,fallback] of [['delivery-fee','delivery_fee',1e6,'Delivery fee','deliveryFee',350],['free-delivery-threshold','free_delivery_threshold',1e12,'Free delivery threshold','freeDeliveryThreshold',0],['low-stock-threshold','low_stock_threshold',100000,'Low stock threshold','lowStockThreshold',3]])app.put(`/api/admin/settings/${route}`,asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{if(await saveSetting(key,req,'value',max,label,res))res.json({[responseKey]:await settingInt(key,fallback)})})))
app.put('/api/admin/settings/cities/:city_slug',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{const city=await DeliveryCity.findByPk(req.params.city_slug);if(!city)return res.status(404).json({error:'City not found.'});const data=jsonObject(req)||{},changes={};if('fee'in data){const n=positiveInt(data.fee,true);if(n==null||n>1e6)return res.status(400).json({error:'City delivery fee is outside the supported range.'});changes.delivery_fee=n}if('active'in data){if(typeof data.active!=='boolean')return res.status(400).json({error:'active must be a boolean.'});changes.active=data.active}await city.update(changes);res.json(serializeCity(city))})))

// -- image media library ---------------------------------------------------------------
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:UPLOAD_MAX_BYTES}})
function imageExtension(buffer){if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return'.jpg';if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'.png';if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return'.webp';if(['GIF87a','GIF89a'].includes(buffer.toString('ascii',0,6)))return'.gif';return null}
app.post('/api/admin/uploads',asyncRoute(requireAdmin,upload.single('file'),asyncRoute(async(req,res)=>{if(!req.file)return res.status(400).json({error:'Attach an image as the file field.'});const ext=imageExtension(req.file.buffer);if(!ext)return res.status(400).json({error:'Only JPG, PNG, WebP, or GIF images are allowed.'});const filename=`${crypto.randomBytes(16).toString('hex')}${ext}`;await fs.writeFile(path.join(uploadDirectory,filename),req.file.buffer,{flag:'wx'});res.status(201).json({filename,url:`/api/media/${filename}`})})))
app.get('/api/admin/media',asyncRoute(requireAdmin,asyncRoute(async(_req,res)=>{const rows=await fs.readdir(uploadDirectory,{withFileTypes:true}),files=[];for(const item of rows){if(!item.isFile()||!UPLOAD_EXTENSIONS.includes(path.extname(item.name).toLowerCase()))continue;const stat=await fs.stat(path.join(uploadDirectory,item.name));files.push({filename:item.name,url:`/api/media/${item.name}`,size:stat.size,uploadedAt:stat.mtime.toISOString()})}files.sort((a,b)=>Date.parse(b.uploadedAt)-Date.parse(a.uploadedAt));res.json(files.slice(0,200))})))
app.delete('/api/admin/media/:filename',asyncRoute(requireAdmin,asyncRoute(async(req,res)=>{const filename=path.basename(req.params.filename);if(!filename||req.params.filename.includes('..')||!UPLOAD_EXTENSIONS.includes(path.extname(filename).toLowerCase()))return res.status(404).json({error:'File not found.'});try{await fs.unlink(path.join(uploadDirectory,filename));res.status(204).end()}catch{return res.status(404).json({error:'File not found.'})}})))

// -- single-service static storefront and HTTP lifecycle --------------------------------
const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist')
try {
  await fs.access(frontendDist)
  app.use(express.static(frontendDist, { maxAge: '1h', setHeaders(res, filename) { if (filename.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') } }))
  app.get('*', (req,res,next)=>{if(req.path==='/api'||req.path.startsWith('/api/'))return res.status(404).json({error:'Not found.'});res.sendFile(path.join(frontendDist,'index.html'),error=>error&&next(error))})
} catch {}
app.use((req,res)=>res.status(404).json({error:'Not found.'}))
app.use((error,req,res,_next)=>{
  if(error?.type==='entity.too.large'||error instanceof multer.MulterError&&error.code==='LIMIT_FILE_SIZE')return res.status(413).json({error:'Request body is too large.'})
  if(error instanceof multer.MulterError)return res.status(400).json({error:'Could not upload this image.'})
  if(error?.message==='Origin is not allowed.')return res.status(403).json({error:'Request origin is not allowed.'})
  console.error(error)
  if(res.headersSent)return
  res.status(500).json({error:production?'An unexpected server error occurred.':'An unexpected server error occurred.'})
})

async function initializeBackend() {
  await sequelize.authenticate()
  const autoSetting=process.env.AUTO_CREATE_TABLES?.toLowerCase()
  const autoCreate=autoSetting==null ? !production : !['0','false','no'].includes(autoSetting)
  if(autoCreate) await sequelize.sync()
  await sessionStore.sync()
  await ensureStoreDefaults()
}

if (process.env.NODE_ENV !== 'test') {
  try {
    await initializeBackend()
    const port=Number(process.env.PORT||5000),host=process.env.HOST||'0.0.0.0'
    app.listen(port,host,()=>console.log(`TechnoBaazar Node API listening on ${host}:${port}`))
  } catch(error) {
    console.error('Backend startup failed:',error)
    process.exitCode=1
  }
}

export { app, initializeBackend, sequelize, models }
