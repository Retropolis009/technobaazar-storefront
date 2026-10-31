import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sequelize, models } from './database.js'
const { Product, CatalogState }=models
const dir=path.dirname(fileURLToPath(import.meta.url))
try{
 await sequelize.authenticate()
 const rows=JSON.parse(await fs.readFile(path.join(dir,'seed_products.json'),'utf8')),expected=new Set(rows.map(p=>p.slug)),present=new Set((await Product.findAll({attributes:['slug']})).map(p=>p.slug)),missing=[...expected].filter(slug=>!present.has(slug)),state=await CatalogState.findByPk(1),actual=await Product.count()
 if(!state?.initialized||missing.length){throw new Error(`Catalog verification failed: initialized=${Boolean(state?.initialized)}, ${expected.size-missing.length}/${expected.size} starter products present, ${actual} products total. Missing: ${missing.slice(0,5).join(', ')||'catalog initialization'}.`)}
 console.log(`Catalog verified: ${expected.size}/${expected.size} starter products present (${actual} total) in ${sequelize.getDialect()} database.`)
}catch(error){console.error(error.message||error);process.exitCode=1}finally{await sequelize.close()}
