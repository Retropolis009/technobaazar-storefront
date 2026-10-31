import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sequelize, models } from './database.js'
const { Product }=models,dir=path.dirname(fileURLToPath(import.meta.url))
const slugify=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
try{
 await sequelize.authenticate();const data=JSON.parse(await fs.readFile(path.join(dir,'config/more-listings.json'),'utf8'));let added=0
 for(const[category,listings]of Object.entries(data)){let current=await Product.count({where:{category}});for(const[index,[name,brand,price,detail,extra]]of listings.entries()){if(current>=5)break;const slug=slugify(`${brand}-${name}`);if(await Product.findOne({where:{slug}}))continue;await Product.create({slug,name,category,brand,detail:`${detail} · ${extra}`,description:`${name} from ${brand} is selected for dependable everyday performance and is available with checkout through TechnoBaazar.`,specifications:[detail,extra],price_value:price,badge:index<2?'New listing':'In stock',image:'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=760&q=85',image_alt:`${name} product listing`,stock_quantity:10,track_stock:true,active:true});current++;added++}}
 console.log(`Added ${added} product listings`)
}catch(error){console.error(error.message||error);process.exitCode=1}finally{await sequelize.close()}
