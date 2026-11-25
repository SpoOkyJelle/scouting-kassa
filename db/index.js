import knex from 'knex'
import pg from 'pg'
import knexConfig from '../knexfile.js'

// pg returns some types as strings/Date by default; normalize them so the rest
// of the app (and the frontend) sees the same shapes the old SQLite layer gave:
//   numeric/decimal → JS number   (prices, amounts)
//   bigint          → JS number   (ids; safe for this app's volumes)
//   date            → 'YYYY-MM-DD' string
//   timestamp(tz)   → ISO string   (so .split('T') and new Date() keep working)
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)))      // numeric
pg.types.setTypeParser(20,   (v) => (v === null ? null : parseInt(v, 10)))    // int8 / bigint
pg.types.setTypeParser(1082, (v) => v)                                        // date
pg.types.setTypeParser(1114, (v) => (v === null ? null : new Date(v + 'Z').toISOString())) // timestamp
pg.types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString()))        // timestamptz

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
