import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { QueryTypes } from 'sequelize'
import { sequelize } from './database.js'
import SequelizeStoreFactory from 'connect-session-sequelize'
import session from 'express-session'

const directory = path.dirname(fileURLToPath(import.meta.url))
const files = (await fs.readdir(path.join(directory, 'db', 'migrations'))).filter(name => name.endsWith('.sql')).sort()
const statements = sql => sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').split(';').map(s => s.trim()).filter(Boolean)
const Store = SequelizeStoreFactory(session.Store)
try {
  await sequelize.authenticate()
  if (sequelize.getDialect() === 'sqlite') {
    // Sequelize's `alter:true` drops and rebuilds SQLite tables, which can
    // conflict with live foreign keys. Create missing tables, then add only
    // absent columns in place so existing records are never rewritten.
    await sequelize.sync()
    for (const model of Object.values((await import('./database.js')).models)) {
      const table = model.getTableName()
      const tableName = typeof table === 'string' ? table : table.tableName
      const present = new Set((await sequelize.query(`PRAGMA table_info("${tableName.replaceAll('"', '""')}")`, { type: QueryTypes.SELECT })).map(row => row.name))
      for (const [attribute, definition] of Object.entries(model.rawAttributes)) {
        const column = definition.field || attribute
        if (present.has(column) || definition.primaryKey) continue
        let type = definition.type.toSql()
        const value = definition.defaultValue
        let defaultSql = ''
        if (definition.type.key === 'DATE' && value != null) {
          defaultSql = ' DEFAULT CURRENT_TIMESTAMP'
        } else if (value !== undefined && value !== null && typeof value !== 'function') {
          const normalized = value === true ? 1 : value === false ? 0 : typeof value === 'object' ? JSON.stringify(value) : value
          defaultSql = ` DEFAULT ${typeof normalized === 'number' ? normalized : `'${String(normalized).replaceAll("'", "''")}'`}`
        } else if (!definition.allowNull) {
          defaultSql = ` DEFAULT ${type.startsWith('VARCHAR') || type === 'TEXT' ? "''" : type === 'BOOLEAN' || type === 'INTEGER' ? '0' : "'[]'"}`
        }
        const nullableSql = definition.allowNull ? '' : ' NOT NULL'
        await sequelize.query(`ALTER TABLE "${tableName.replaceAll('"', '""')}" ADD COLUMN "${column.replaceAll('"', '""')}" ${type}${nullableSql}${defaultSql}`)
      }
    }
    await sequelize.sync()
  } else {
    await sequelize.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename varchar(200) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)')
    const appliedRows = await sequelize.query('SELECT filename FROM schema_migrations', { type: QueryTypes.SELECT })
    const applied = new Set(appliedRows.map(row => row.filename))
    for (const filename of files) {
      if (applied.has(filename)) { console.log(`skip ${filename} (already applied)`); continue }
      const sql = await fs.readFile(path.join(directory, 'db', 'migrations', filename), 'utf8')
      const transaction = await sequelize.transaction()
      try {
        for (const statement of statements(sql)) await sequelize.query(statement, { transaction })
        await sequelize.query('INSERT INTO schema_migrations (filename) VALUES (:filename)', { replacements: { filename }, transaction })
        await transaction.commit()
        console.log(`applied ${filename}`)
      } catch (error) { await transaction.rollback(); throw error }
    }
    // Create any missing, non-business support tables without modifying the
    // existing schema or rows.
    await sequelize.sync()
  }
  const store = new Store({ db: sequelize, tableName: 'session' })
  await store.sync()
  console.log(`Node backend schema ready (${sequelize.getDialect()}).`)
} catch (error) {
  console.error('Migration failed:', error)
  process.exitCode = 1
} finally { await sequelize.close() }
