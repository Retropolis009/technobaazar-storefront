import { sequelize, models as m } from './database.js'
import defaults from './config/store-defaults.json' with { type: 'json' }
const { StoreSetting, Category, CategoryCustomField, DeliveryCity, SiteContent, SiteContentRevision } = m
const slugify = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
try {
  await sequelize.authenticate()
  const t = await sequelize.transaction()
  try {
    for (const [key, value] of Object.entries({ delivery_fee: '350', free_delivery_threshold: '0', low_stock_threshold: '3' })) await StoreSetting.findOrCreate({ where: { key }, defaults: { value }, transaction: t })
    const categories = new Map()
    for (const [index, name] of defaults.CATEGORY_SORT_ORDER.entries()) {
      const [row] = await Category.findOrCreate({ where: { name }, defaults: { slug: slugify(name), sort_order: (index + 1) * 10, visible: true }, transaction: t })
      categories.set(name, row)
    }
    for (const [name, parentName] of Object.entries(defaults.CATEGORY_DEFAULT_PARENTS)) {
      const child = categories.get(name), parent = categories.get(parentName)
      if (child && parent && !child.parent_id) await child.update({ parent_id: parent.id }, { transaction: t })
    }
    for (const [category, fields] of Object.entries(defaults.CATEGORY_FIELD_SEEDS)) for (const [i, [label, placeholder]] of fields.entries()) await CategoryCustomField.findOrCreate({ where: { category_name: category, label }, defaults: { placeholder, sort_order: (i + 1) * 10 }, transaction: t })
    for (const [i, [city_slug, city_name, delivery_fee]] of defaults.DELIVERY_CITIES_SEED.entries()) await DeliveryCity.findOrCreate({ where: { city_slug }, defaults: { city_name, delivery_fee, active: true, sort_order: (i + 1) * 10 }, transaction: t })
    const published = await SiteContentRevision.findOne({ where: { status: 'published' }, order: [['id', 'DESC']], transaction: t })
    if (!published && await SiteContent.count({ transaction: t }) < Object.keys(defaults.SITE_CONTENT_DEFAULTS).length) {
      for (const [content_key, content_value] of Object.entries(defaults.SITE_CONTENT_DEFAULTS)) await SiteContent.findOrCreate({ where: { content_key }, defaults: { content_value }, transaction: t })
      await SiteContentRevision.create({ content: defaults.SITE_CONTENT_DEFAULTS, status: 'published', editor: 'system', note: 'Initial published content', published_at: new Date() }, { transaction: t })
    }
    await t.commit()
  } catch (error) { await t.rollback(); throw error }
  console.log('Store settings, delivery cities, categories, and landing content are ready.')
} catch (error) { console.error(error); process.exitCode = 1 } finally { await sequelize.close() }
