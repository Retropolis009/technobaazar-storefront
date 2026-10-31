import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sequelize, models as m } from './database.js'
import defaults from './config/store-defaults.json' with { type: 'json' }
const { CatalogState, Product, StoreSetting, Category, CategoryCustomField, DeliveryCity, SiteContent, SiteContentRevision } = m
const dir = path.dirname(fileURLToPath(import.meta.url))
const slugify = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
async function seedStore() {
  for (const [key,value] of Object.entries({delivery_fee:'350',free_delivery_threshold:'0',low_stock_threshold:'3'})) await StoreSetting.findOrCreate({where:{key},defaults:{value}})
  const categories=new Map()
  for(const [i,name]of defaults.CATEGORY_SORT_ORDER.entries()){const[row]=await Category.findOrCreate({where:{name},defaults:{slug:slugify(name),sort_order:(i+1)*10,visible:true}});categories.set(name,row)}
  for(const[name,parentName]of Object.entries(defaults.CATEGORY_DEFAULT_PARENTS)){const c=categories.get(name),p=categories.get(parentName);if(c&&p&&!c.parent_id)await c.update({parent_id:p.id})}
  for(const[category,fields]of Object.entries(defaults.CATEGORY_FIELD_SEEDS))for(const[i,[label,placeholder]]of fields.entries())await CategoryCustomField.findOrCreate({where:{category_name:category,label},defaults:{placeholder,sort_order:(i+1)*10}})
  for(const[i,[city_slug,city_name,delivery_fee]]of defaults.DELIVERY_CITIES_SEED.entries())await DeliveryCity.findOrCreate({where:{city_slug},defaults:{city_name,delivery_fee,active:true,sort_order:(i+1)*10}})
  const published=await SiteContentRevision.findOne({where:{status:'published'},order:[['id','DESC']]})
  if(!published&&await SiteContent.count()<Object.keys(defaults.SITE_CONTENT_DEFAULTS).length){for(const[content_key,content_value]of Object.entries(defaults.SITE_CONTENT_DEFAULTS))await SiteContent.findOrCreate({where:{content_key},defaults:{content_value}});await SiteContentRevision.create({content:defaults.SITE_CONTENT_DEFAULTS,status:'published',editor:'system',note:'Initial published content',published_at:new Date()})}
}
try {
  await sequelize.authenticate()
  if(await CatalogState.findByPk(1)) throw new Error('Catalog is already initialized; existing database data was left unchanged.')
  await seedStore()
  const rows=JSON.parse(await fs.readFile(path.join(dir,'seed_products.json'),'utf8'))
  const t=await sequelize.transaction()
  try {
    for(const data of rows){const seo=data.seo||{};await Product.create({slug:data.slug,name:data.name,category:data.category,brand:data.brand,detail:data.detail||'',description:data.description||'',specifications:data.specifications||[],price_value:data.priceValue,compare_at_price:data.compareAtPrice??null,badge:data.badge||'',image:data.image||'',image_alt:data.imageAlt||'',stock_quantity:data.stockQuantity??10,track_stock:data.trackStock??true,active:data.active??true,seo_title:seo.title||'',seo_description:seo.description||'',seo_keywords:seo.keywords||'',og_title:seo.ogTitle||'',og_description:seo.ogDescription||'',og_image:seo.ogImage||'',canonical_url:seo.canonicalUrl||''},{transaction:t})}
    await CatalogState.create({id:1,initialized:true},{transaction:t});await t.commit()
  }catch(error){await t.rollback();throw error}
  console.log(`Seeded ${rows.length} products into the database.`)
}catch(error){console.error(error.message||error);process.exitCode=1}finally{await sequelize.close()}
