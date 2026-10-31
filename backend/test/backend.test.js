import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'

const databaseFile = path.join(os.tmpdir(), `technobaazar-node-test-${process.pid}.sqlite`)
const uploadDirectory = path.join(os.tmpdir(), `technobaazar-node-test-media-${process.pid}`)
process.env.UPLOAD_DIR = uploadDirectory
process.env.DATABASE_URL = `sqlite:////${databaseFile.replace(/^\//, '')}`
process.env.AUTO_CREATE_TABLES = 'true'
process.env.FLASK_SECRET_KEY = 'node-backend-test-secret-at-least-32-characters-long'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'

let app, sequelize, models, server, baseUrl, adminCookie = '', guestCookie = ''
const origin = 'http://localhost:5173'
async function api(url, { method='GET', body, cookie='guest', headers={} } = {}) {
  const requestHeaders = { Origin: origin, ...headers }
  if (body !== undefined && !(body instanceof FormData)) requestHeaders['Content-Type'] = 'application/json'
  const storedCookie = cookie === 'admin' ? adminCookie : guestCookie
  if (storedCookie) requestHeaders.Cookie = storedCookie
  const response = await fetch(`${baseUrl}${url}`, { method, headers: requestHeaders, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) })
  const setCookie = response.headers.getSetCookie?.()?.[0]
  if (setCookie) {
    if (cookie === 'admin') adminCookie = setCookie.split(';')[0]
    else guestCookie = setCookie.split(';')[0]
  }
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer())
  return { response, data }
}

before(async () => {
  await fs.rm(databaseFile, { force: true })
  await fs.rm(uploadDirectory, { recursive: true, force: true })
  const db = await import('../database.js')
  ;({ sequelize, models } = db)
  const runtime = await import('../server.js')
  app = runtime.app
  await runtime.initializeBackend()
  const product = await models.Product.create({ slug: 'node-test-product', name: 'Node Test Product', category: 'Graphics Cards', brand: 'TestBrand', detail: 'Test product', description: '', specifications: [], price_value: 10000, stock_quantity: 5, track_stock: true, active: true, image: '/images/test.jpg' })
  await models.CatalogState.upsert({ id: 1, initialized: true })
  // Hash fixture produced by Werkzeug's current scrypt default, ensuring
  // existing Flask administrator accounts remain usable after migration.
  await models.Admin.create({ email: 'node-test@example.com', password_hash: 'scrypt:32768:8:1$RQPa2agtkIaLYooP$34bfc6ee9ab43d63881f144e911d222ccb046e858c9757d7a14923855c52483554ca13204e424618075c24326fde2db83d92bf1156379105874e7e05645d3ede' })
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
  assert.equal(product.slug, 'node-test-product')
})

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  if (sequelize) await sequelize.close()
  await fs.rm(databaseFile, { force: true })
  await fs.rm(uploadDirectory, { recursive: true, force: true })
})

test('public catalog, CMS galleries, checkout, sessions, exports, and uploads work on Node', async () => {
  const catalog = await api('/api/catalog')
  assert.equal(catalog.response.status, 200)
  assert.equal(catalog.data.initialized, true)
  assert.equal(catalog.data.products[0].slug, 'node-test-product')

  const gallery = ['https://images.example/angle-a.jpg', 'https://images.example/angle-b.jpg']
  const savedGallery = await api('/api/admin/products/node-test-product/content', { method: 'PUT', body: { gallery } })
  assert.equal(savedGallery.response.status, 401)
  const login = await api('/api/admin/login', { method: 'POST', cookie: 'admin', body: { email: 'node-test@example.com', password: 'test-password' } })
  assert.equal(login.response.status, 200)
  assert.equal(login.data.email, 'node-test@example.com')
  const saved = await api('/api/admin/products/node-test-product/content', { method: 'PUT', cookie: 'admin', body: { gallery } })
  assert.deepEqual(saved.data.content.gallery, gallery)
  const publicProduct = (await api('/api/products')).data.find(product => product.slug === 'node-test-product')
  assert.deepEqual(publicProduct.content.gallery, gallery)

  const working = (await api('/api/admin/site-content', { cookie: 'admin' })).data
  delete working._revision_id; delete working._has_draft
  working.whatsapp_url = 'https://wa.me/923001234567'
  working.hero_ticker_text = 'Node backend integration test'
  const draft = await api('/api/admin/site-content', { method: 'PUT', cookie: 'admin', body: { values: working, note: 'node test' } })
  assert.equal(draft.response.status, 200)
  assert.equal((await api('/api/admin/site-content/publish', { method: 'POST', cookie: 'admin' })).data.hero_ticker_text, 'Node backend integration test')
  assert.equal((await api('/api/admin/site-content/history', { cookie: 'admin' })).response.status, 200)

  await api('/api/cart', { method: 'PUT', body: { items: [{ slug: 'node-test-product', quantity: 2 }] } })
  const attempt = (await api('/api/checkout-attempt', { method: 'POST', body: { key: 'b13b4e20-f2cc-4a72-b91d-3dbec7b05a49' } })).data.key
  const checkout = { customerName: 'Test Customer', phone: '03001234567', email: 'test@example.com', address: 'Street 1', city: 'Karachi', postalCode: '75300', note: 'Call first', paymentMethod: 'cash_on_delivery', attemptKey: attempt }
  const order = await api('/api/orders', { method: 'POST', body: checkout })
  assert.equal(order.response.status, 201)
  assert.equal(order.data.total, 20350)
  const duplicate = await api('/api/orders', { method: 'POST', body: checkout })
  assert.equal(duplicate.response.status, 200)
  assert.equal(duplicate.data.orderNumber, order.data.orderNumber)
  assert.equal((await models.Product.findByPk(1)).stock_quantity, 3)

  const listedOrders = await api('/api/admin/orders?status=pending', { cookie: 'admin' })
  assert.equal(listedOrders.data.total, 1)
  const xlsx = await api('/api/admin/orders/export.xlsx', { cookie: 'admin' })
  const zip = unzipSync(xlsx.data), worksheet = strFromU8(zip['xl/worksheets/sheet1.xml'])
  assert.ok(zip['[Content_Types].xml'])
  assert.ok(worksheet.includes(order.data.orderNumber))
  assert.ok(worksheet.includes('Test Customer'))

  const image = new FormData()
  image.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a7sAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'tiny.png')
  const uploaded = await api('/api/admin/uploads', { method: 'POST', cookie: 'admin', body: image })
  assert.equal(uploaded.response.status, 201)
  assert.match(uploaded.data.url, /^\/api\/media\/[a-f0-9]+\.png$/)
})
