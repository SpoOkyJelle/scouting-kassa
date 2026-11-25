// One-off importer: copies the existing single-tenant SQLite database (kassa.db)
// into PostgreSQL as the first account. Safe to read; it only writes to Postgres.
//
//   node scripts/import-sqlite.js
//
// Env (see .env.example): DATABASE_URL, and optionally OWNER_ORG / OWNER_EMAIL /
// OWNER_PASSWORD to create the owner user for the imported account.
//
// Run migrations first:  npm run migrate

import 'dotenv/config'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlitePath = join(__dirname, '..', 'kassa.db')

async function main() {
  if (!existsSync(sqlitePath)) {
    console.error(`[import] kassa.db not found at ${sqlitePath} — nothing to import.`)
    process.exit(1)
  }
  const sq = new Database(sqlitePath, { readonly: true })
  const all = (q) => sq.prepare(q).all()
  const one = (q) => sq.prepare(q).get()

  await db.transaction(async (trx) => {
    // 1. Account
    const [account] = await trx('accounts')
      .insert({ name: process.env.OWNER_ORG || 'Account 1', slug: 'account-1' })
      .returning('*')
    const accountId = account.id
    console.log(`[import] created account #${accountId} "${account.name}"`)

    // 2. Optional owner user + membership
    if (process.env.OWNER_EMAIL && process.env.OWNER_PASSWORD) {
      const [user] = await trx('users').insert({
        email: process.env.OWNER_EMAIL.toLowerCase(),
        password_hash: bcrypt.hashSync(process.env.OWNER_PASSWORD, 10),
        name: 'Owner',
      }).returning('*')
      await trx('memberships').insert({ user_id: user.id, account_id: accountId, role: 'owner' })
      console.log(`[import] created owner ${user.email}`)
    } else {
      console.log('[import] no OWNER_EMAIL/OWNER_PASSWORD set — skipped owner user')
    }

    // 3. Products (remember old→new id mapping for receipt_items)
    const productIdMap = new Map()
    for (const p of all('SELECT * FROM products')) {
      const [row] = await trx('products').insert({
        account_id: accountId,
        name: p.name, price: p.price, cost_price: p.cost_price ?? null,
        category: p.category || 'overig', available: p.available !== 0,
        sort_order: p.sort_order ?? 0, created_at: p.created_at || new Date().toISOString(),
      }).returning('id')
      productIdMap.set(p.id, row.id)
    }

    // 4. Receipts + items
    for (const r of all('SELECT * FROM receipts')) {
      const [row] = await trx('receipts').insert({
        account_id: accountId,
        name: r.name ?? null, note: r.note ?? null, paid: r.paid !== 0,
        discount_pct: r.discount_pct || 0, donation: r.donation || 0,
        promo_discount: r.promo_discount || 0,
        promo_lines: typeof r.promo_lines === 'string' ? r.promo_lines : JSON.stringify(r.promo_lines || []),
        payment_method: r.payment_method ?? null,
        payments: r.payments || '[]',
        created_at: r.created_at || new Date().toISOString(),
      }).returning('id')
      const items = sq.prepare('SELECT * FROM receipt_items WHERE receipt_id = ?').all(r.id)
      for (const i of items) {
        await trx('receipt_items').insert({
          account_id: accountId, receipt_id: row.id,
          product_id: productIdMap.get(i.product_id) ?? null,
          product_name: i.product_name, product_price: i.product_price, quantity: i.quantity,
        })
      }
    }

    // 5. Inkoop, donaties
    for (const b of all('SELECT * FROM inkoop')) {
      await trx('inkoop').insert({
        account_id: accountId, description: b.description, amount: b.amount, date: b.date,
        note: b.note ?? null, submitted_by: b.submitted_by ?? null,
        created_at: b.created_at || new Date().toISOString(),
      })
    }
    for (const d of all('SELECT * FROM donaties')) {
      await trx('donaties').insert({
        account_id: accountId, name: d.name ?? null, amount: d.amount, date: d.date,
        note: d.note ?? null, created_at: d.created_at || new Date().toISOString(),
      })
    }

    // 6. Kas + correcties
    for (const k of all('SELECT * FROM kas')) {
      const [row] = await trx('kas').insert({
        account_id: accountId, datum: k.datum, begin_bedrag: k.begin_bedrag || 0,
        eind_bedrag: k.eind_bedrag ?? null, note: k.note ?? null,
        created_at: k.created_at || new Date().toISOString(),
      }).returning('id')
      const corr = sq.prepare('SELECT * FROM kas_correcties WHERE kas_id = ?').all(k.id)
      for (const c of corr) {
        await trx('kas_correcties').insert({
          account_id: accountId, kas_id: row.id, type: c.type || 'contant',
          amount: c.amount, description: c.description || '',
          created_at: c.created_at || new Date().toISOString(),
        })
      }
    }

    // 7. Settings (the single global row becomes this account's settings)
    const s = one("SELECT value FROM settings WHERE key = 'settings'")
    const data = s ? s.value : '{}'
    await trx('settings').insert({ account_id: accountId, data })

    console.log('[import] done.')
  })

  sq.close()
  await db.destroy()
}

main().catch((err) => {
  console.error('[import] failed:', err)
  process.exit(1)
})
