import knex from 'knex'
import knexConfig from '../knexfile.js'

// Single shared Knex/pg connection pool for the whole app.
const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development'
export const db = knex(knexConfig[environment])

// Tenant tables: every row belongs to exactly one account and MUST be filtered
// by account_id on read and stamped with account_id on write.
export const TENANT_TABLES = new Set([
  'products', 'receipts', 'receipt_items', 'inkoop',
  'donaties', 'kas', 'kas_correcties', 'settings',
])

// Central tables are NOT tenant-scoped (auth/accounts). Touch these directly via `db`.
export const CENTRAL_TABLES = new Set(['accounts', 'users', 'memberships', 'sessions'])

/**
 * The ONLY sanctioned way to read/write tenant data from application code.
 * `account_id` must come from the authenticated session — never from the client.
 *
 *   const t = scoped(req.accountId)
 *   await t.table('products').orderBy('sort_order')         // auto WHERE account_id = ?
 *   await t.insert('products', { name, price, ... })        // auto-stamps account_id
 */
export function scoped(accountId) {
  if (accountId == null) throw new Error('scoped() requires an accountId from the session')

  function assertTenant(name) {
    if (!TENANT_TABLES.has(name)) throw new Error(`"${name}" is not a tenant table`)
  }

  return {
    accountId,

    // Query builder pre-filtered to this account.
    table(name) {
      assertTenant(name)
      return db(name).where({ account_id: accountId })
    },

    // Insert one row or many, stamping account_id on each. Returns inserted rows.
    insert(name, rows) {
      assertTenant(name)
      const list = (Array.isArray(rows) ? rows : [rows]).map(r => ({ ...r, account_id: accountId }))
      return db(name).insert(list).returning('*')
    },

    // Run work inside a transaction, still scoped to this account.
    transaction(fn) {
      return db.transaction((trx) => fn({
        table: (name) => { assertTenant(name); return trx(name).where({ account_id: accountId }) },
        insert: (name, rows) => {
          assertTenant(name)
          const list = (Array.isArray(rows) ? rows : [rows]).map(r => ({ ...r, account_id: accountId }))
          return trx(name).insert(list).returning('*')
        },
        trx,
      }))
    },
  }
}
