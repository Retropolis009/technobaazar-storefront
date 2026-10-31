import crypto from 'node:crypto'
import { sequelize, models } from './database.js'
const { Admin } = models
function hashPassword(password){const iterations=600000,salt=crypto.randomBytes(16).toString('hex'),hash=crypto.pbkdf2Sync(password,salt,iterations,32,'sha256').toString('base64');return `pbkdf2:sha256:${iterations}$${salt}$${hash}`}
try{
  const email=(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),password=process.env.ADMIN_PASSWORD||''
  if(!email||!password)throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running npm run create-admin.')
  if(password.length<12||password.length>256||password.toLowerCase().startsWith('replace-with-'))throw new Error('ADMIN_PASSWORD must be a non-placeholder password between 12 and 256 characters.')
  await sequelize.authenticate();if(await Admin.findOne({where:{email}}))throw new Error(`Admin ${email} already exists.`)
  await Admin.create({email,password_hash:hashPassword(password)});console.log(`Created admin: ${email}`)
}catch(error){console.error(error.message||error);process.exitCode=1}finally{await sequelize.close()}
