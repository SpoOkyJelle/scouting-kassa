import 'dotenv/config'
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, renameSync } from 'fs'
import Database from 'better-sqlite3'
import { computePromotions } from './src/promotions.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app  = express()
const PORT = 3001

// ─── PINs ─────────────────────────────────────────────────────────────────────
const ADMIN_PIN   = process.env.PIN
const CASHIER_PIN = process.env.CASHIER_PIN || null

if (!ADMIN_PIN) {
  console.error('\n[kassa] FOUT: PIN niet ingesteld.')
  console.error('[kassa] Maak een .env bestand aan met: PIN=jouw_pin\n')
  process.exit(1)
}

// ─── SQLite setup ─────────────────────────────────────────────────────────────
const db = new Database(join(__dirname, 'kassa.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    price      REAL    NOT NULL,
    cost_price REAL,
    category   TEXT    NOT NULL DEFAULT 'overig',
    available  INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS receipts (
    id             INTEGER PRIMARY KEY,
    name           TEXT,
    note           TEXT,
    paid           INTEGER NOT NULL DEFAULT 0,
    discount_pct   REAL    NOT NULL DEFAULT 0,
    donation       REAL    NOT NULL DEFAULT 0,
    promo_discount REAL    NOT NULL DEFAULT 0,
    promo_lines    TEXT    NOT NULL DEFAULT '[]',
    payment_method TEXT,
    payments       TEXT    NOT NULL DEFAULT '[]',
    created_at     TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS receipt_items (
    id            INTEGER PRIMARY KEY,
    receipt_id    INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    product_id    INTEGER,
    product_name  TEXT    NOT NULL,
    product_price REAL    NOT NULL,
    quantity      INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS inkoop (
    id           INTEGER PRIMARY KEY,
    description  TEXT NOT NULL,
    amount       REAL NOT NULL,
    date         TEXT NOT NULL,
    note         TEXT,
    submitted_by TEXT,
    created_at   TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS donaties (
    id         INTEGER PRIMARY KEY,
    name       TEXT,
    amount     REAL NOT NULL,
    date       TEXT NOT NULL,
    note       TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kas (
    id           INTEGER PRIMARY KEY,
    datum        TEXT NOT NULL UNIQUE,
    begin_bedrag REAL NOT NULL DEFAULT 0,
    eind_bedrag  REAL,
    note         TEXT,
    created_at   TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kas_correcties (
    id          INTEGER PRIMARY KEY,
    kas_id      INTEGER NOT NULL REFERENCES kas(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'contant',
    amount      REAL NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    role  TEXT NOT NULL
  );
`)

// ─── Lightweight column migrations for existing databases ─────────────────────
function ensureColumn(table, col, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!cols.some(c => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`)
  }
}
// Promotions ("acties") snapshot, frozen per receipt when its items last changed.
ensureColumn('receipts', 'promo_discount', 'REAL NOT NULL DEFAULT 0')
ensureColumn('receipts', 'promo_lines',    "TEXT NOT NULL DEFAULT '[]'")

// ─── Migrate from kassa.json (one-time) ──────────────────────────────────────
{
  const jsonPath = join(__dirname, 'kassa.json')
  if (existsSync(jsonPath)) {
    const { n } = db.prepare('SELECT COUNT(*) as n FROM receipts').get()
    const { p } = db.prepare('SELECT COUNT(*) as p FROM products').get()
    if (n === 0 && p === 0) {
      console.log('[kassa] Migratie van kassa.json naar SQLite...')
      const json = JSON.parse(readFileSync(jsonPath, 'utf-8'))

      db.transaction(() => {
        for (const p of (json.products || [])) {
          db.prepare(`INSERT INTO products (id,name,price,cost_price,category,available,sort_order,created_at)
                      VALUES (?,?,?,?,?,?,?,?)`).run(
            p.id, p.name, p.price, p.cost_price ?? null,
            p.category || 'overig', p.available !== false ? 1 : 0,
            p.sort_order ?? 0, p.created_at || new Date().toISOString(),
          )
        }
        for (const r of (json.receipts || [])) {
          db.prepare(`INSERT INTO receipts (id,name,note,paid,discount_pct,donation,payment_method,payments,created_at)
                      VALUES (?,?,?,?,?,?,?,?,?)`).run(
            r.id, r.name ?? null, r.note ?? null, r.paid ? 1 : 0,
            r.discount_pct || 0, r.donation || 0,
            r.payment_method ?? null, JSON.stringify(r.payments || []),
            r.created_at || new Date().toISOString(),
          )
          for (const i of (r.items || [])) {
            db.prepare(`INSERT INTO receipt_items (id,receipt_id,product_id,product_name,product_price,quantity)
                        VALUES (?,?,?,?,?,?)`).run(
              i.id, r.id, i.product_id ?? null, i.product_name, i.product_price, i.quantity,
            )
          }
        }
        for (const b of (json.inkoop || [])) {
          db.prepare(`INSERT INTO inkoop (id,description,amount,date,note,submitted_by,created_at)
                      VALUES (?,?,?,?,?,?,?)`).run(
            b.id, b.description, b.amount,
            b.date || new Date().toISOString().slice(0, 10),
            b.note ?? null, b.submitted_by ?? null,
            b.created_at || new Date().toISOString(),
          )
        }
        for (const d of (json.donaties || [])) {
          db.prepare(`INSERT INTO donaties (id,name,amount,date,note,created_at)
                      VALUES (?,?,?,?,?,?)`).run(
            d.id, d.name ?? null, d.amount,
            d.date || new Date().toISOString().slice(0, 10),
            d.note ?? null, d.created_at || new Date().toISOString(),
          )
        }
        for (const k of (json.kas || [])) {
          db.prepare(`INSERT INTO kas (id,datum,begin_bedrag,eind_bedrag,note,created_at)
                      VALUES (?,?,?,?,?,?)`).run(
            k.id, k.datum, k.begin_bedrag || 0, k.eind_bedrag ?? null,
            k.note ?? null, k.created_at || new Date().toISOString(),
          )
          for (const c of (k.correcties || [])) {
            db.prepare(`INSERT INTO kas_correcties (id,kas_id,type,amount,description,created_at)
                        VALUES (?,?,?,?,?,?)`).run(
              c.id, k.id, c.type || 'contant', c.amount || 0,
              c.description || '', c.created_at || new Date().toISOString(),
            )
          }
        }
        if (json.settings && Object.keys(json.settings).length > 0) {
          db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('settings',?)").run(
            JSON.stringify(json.settings),
          )
        }
      })()

      renameSync(jsonPath, jsonPath + '.bak')
      console.log('[kassa] Migratie voltooid. kassa.json → kassa.json.bak')
    }
  }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
const sessions = new Map(
  db.prepare('SELECT token, role FROM sessions').all().map(r => [r.token, r.role]),
)

function saveSession(token, role) {
  sessions.set(token, role)
  db.prepare('INSERT OR REPLACE INTO sessions (token,role) VALUES (?,?)').run(token, role)
}

function deleteSession(token) {
  sessions.delete(token)
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

// ─── Settings helpers ─────────────────────────────────────────────────────────
function getSettingsFromDb() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'settings'").get()
  return row ? JSON.parse(row.value) : {}
}

function saveSettingsToDb(s) {
  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('settings',?)").run(JSON.stringify(s))
}

// ─── Receipt helpers ──────────────────────────────────────────────────────────
function getReceiptWithItems(id) {
  const r = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id)
  if (!r) return null
  r.items    = db.prepare('SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY id').all(id)
  r.payments = JSON.parse(r.payments || '[]')
  r.promo_lines = JSON.parse(r.promo_lines || '[]')
  return r
}

// Map product_id → category id, for category-scoped promotions.
function getProductCatMap() {
  return Object.fromEntries(
    db.prepare('SELECT id, category FROM products').all().map(p => [p.id, p.category || 'overig'])
  )
}

// Recompute and store the promotion snapshot for a receipt, from the CURRENT
// promotion settings and the receipt's items. Called whenever the items change,
// so the stored discount is frozen against later edits to the promotion config.
function recomputePromo(receiptId) {
  const items = db.prepare(
    'SELECT product_id, product_name, product_price, quantity FROM receipt_items WHERE receipt_id = ?'
  ).all(receiptId)
  const promotions = getSettingsFromDb().promotions || []
  const { discount, lines } = computePromotions(items, promotions, getProductCatMap())
  db.prepare('UPDATE receipts SET promo_discount = ?, promo_lines = ? WHERE id = ?')
    .run(discount, JSON.stringify(lines), receiptId)
  return { promo_discount: discount, promo_lines: lines }
}

function getAllReceiptsWithItems() {
  const receipts = db.prepare('SELECT * FROM receipts').all()
  const items    = db.prepare('SELECT * FROM receipt_items').all()
  const byReceipt = {}
  for (const i of items) {
    ;(byReceipt[i.receipt_id] ??= []).push(i)
  }
  return receipts.map(r => ({ ...r, items: byReceipt[r.id] || [], payments: JSON.parse(r.payments || '[]') }))
}

// ─── Kas helpers ──────────────────────────────────────────────────────────────
function getKasWithCorrecties(id) {
  const k = db.prepare('SELECT * FROM kas WHERE id = ?').get(id)
  if (!k) return null
  k.correcties = db.prepare('SELECT * FROM kas_correcties WHERE kas_id = ? ORDER BY id').all(id)
  return k
}

// ─── Klantenscherm display state + SSE ───────────────────────────────────────
let displayState = { active: false, updatedAt: null }
const sseClients = new Set()

const SETTING_DEFAULTS = {
  paymentUrl:  'https://www.ing.nl/payreq/m/?trxid=aUZVw7cSEoc3M52nCif1fjGgLPCCcbnO',
  paymentName: 'Sint Martinus Explos\nPannenkoeken actie 2026',
  // Product categories are configurable in Settings → Categories; these are the
  // defaults used until an admin changes them. Kept in sync with
  // DEFAULT_CATEGORIES in src/categories.js.
  categories: [
    { id: 'pannenkoeken', label: 'Pannenkoeken', icon: 'ChefHat', color: '#C77A1A' },
    { id: 'beleg',        label: 'Beleg',        icon: 'Layers',  color: '#5C8A3C' },
    { id: 'drinken',      label: 'Drinken',      icon: 'Coffee',  color: '#3C7A86' },
    { id: 'overig',       label: 'Overig',       icon: 'Tag',     color: '#8A8374' },
  ],
  // Promotions / "acties" (e.g. "elke 5e gratis"). Configurable in Settings;
  // empty by default. See src/promotions.js for the engine and shapes.
  promotions: [],
}

function getDisplayPayload() {
  const data = { ...displayState }
  if (data.updatedAt && Date.now() - new Date(data.updatedAt).getTime() > 10 * 60 * 1000) {
    data.active = false
  }
  const s = getSettingsFromDb()
  return {
    ...data,
    settings: {
      logoDataUrl: s.logoDataUrl || null,
      paymentUrl:  s.paymentUrl  || SETTING_DEFAULTS.paymentUrl,
      paymentName: s.paymentName || SETTING_DEFAULTS.paymentName,
    },
  }
}

function broadcastDisplay() {
  const payload = `data: ${JSON.stringify(getDisplayPayload())}\n\n`
  for (const client of sseClients) {
    try { client.write(payload) } catch { sseClients.delete(client) }
  }
}

function autoUpdateDisplay(receiptId) {
  if (!displayState.active || displayState.id !== receiptId) return
  const r   = getReceiptWithItems(receiptId)
  if (!r) return
  const sub        = (r.items || []).reduce((s, i) => s + i.product_price * i.quantity, 0)
  const promo      = r.promo_discount || 0
  const afterPromo = Math.max(0, sub - promo)
  const disc = afterPromo * (r.discount_pct || 0) / 100
  const tot  = afterPromo - disc
  const don  = r.donation || 0
  displayState = {
    ...displayState,
    name:         r.name,
    items:        r.items.map(i => ({
      name: i.product_name, qty: i.quantity,
      price: i.product_price, subtotal: i.product_price * i.quantity,
    })),
    subtotal:     sub,
    promo_discount: promo, promo_lines: r.promo_lines || [],
    discount_pct: r.discount_pct || 0, discount_amt: disc,
    total:        tot, donation: don, total_due: tot + don,
    paid:         !!r.paid,
    updatedAt:    new Date().toISOString(),
  }
  broadcastDisplay()
}

// ─── PIN helpers ──────────────────────────────────────────────────────────────
function getAdminPin()   { return getSettingsFromDb().adminPin   || ADMIN_PIN }
function getCashierPin() { return getSettingsFromDb().cashierPin || CASHIER_PIN }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcTotal(items, discount_pct, promo_discount) {
  const base       = (items || []).reduce((s, i) => s + i.product_price * i.quantity, 0)
  const afterPromo = Math.max(0, base - (promo_discount || 0))
  return afterPromo * (1 - (discount_pct || 0) / 100)
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.static(join(__dirname, 'dist')))

// ─── SSE / display endpoints (no auth) ───────────────────────────────────────
app.get('/display-events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  sseClients.add(res)
  res.write(`data: ${JSON.stringify(getDisplayPayload())}\n\n`)

  const ping = setInterval(() => {
    try { res.write(': ping\n\n') } catch { clearInterval(ping); sseClients.delete(res) }
  }, 20000)

  req.on('close', () => { clearInterval(ping); sseClients.delete(res) })
})

app.get('/display-data', (_req, res) => res.json(getDisplayPayload()))

// ─── Auth endpoints (no token required) ──────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body
  const adminPin   = getAdminPin()
  const cashierPin = getCashierPin()
  let role = null
  if (pin && pin === adminPin)               role = 'admin'
  if (pin && cashierPin && pin === cashierPin) role = 'cashier'
  if (!role) return res.status(401).json({ error: 'Verkeerde PIN' })
  const token = randomUUID()
  saveSession(token, role)
  res.json({ token, role })
})

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) deleteSession(token)
  res.json({ ok: true })
})

// ─── Auth middleware ──────────────────────────────────────────────────────────
app.use('/api', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  const role  = token ? sessions.get(token) : null
  if (!role) return res.status(401).json({ error: 'Niet ingelogd' })
  req.role = role
  next()
})

function requireAdmin(req, res, next) {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Geen toegang' })
  next()
}

// ─── Display endpoints ────────────────────────────────────────────────────────
app.put('/api/display', (req, res) => {
  displayState = { ...req.body, updatedAt: new Date().toISOString() }
  broadcastDisplay()
  res.json(displayState)
})

app.delete('/api/display', (_req, res) => {
  displayState = { active: false, updatedAt: null }
  broadcastDisplay()
  res.json({ ok: true })
})

// ─── PIN wijzigen ─────────────────────────────────────────────────────────────
app.post('/api/auth/change-pin', requireAdmin, (req, res) => {
  const { currentPin, newPin, target } = req.body
  if (currentPin !== getAdminPin()) return res.status(403).json({ error: 'Huidige PIN is onjuist' })
  if (!newPin || String(newPin).length < 4) return res.status(400).json({ error: 'PIN moet minimaal 4 tekens zijn' })
  const s = getSettingsFromDb()
  if (target === 'cashier') s.cashierPin = String(newPin)
  else                      s.adminPin   = String(newPin)
  saveSettingsToDb(s)
  res.json({ ok: true })
})

// ─── Backup & Restore ─────────────────────────────────────────────────────────
app.get('/api/backup', requireAdmin, (_req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY sort_order').all()
  const receipts = getAllReceiptsWithItems()
  const inkoop   = db.prepare('SELECT * FROM inkoop ORDER BY created_at').all()
  const donaties = db.prepare('SELECT * FROM donaties ORDER BY created_at').all()
  const kas      = db.prepare('SELECT * FROM kas ORDER BY datum').all().map(k => ({
    ...k,
    correcties: db.prepare('SELECT * FROM kas_correcties WHERE kas_id = ? ORDER BY id').all(k.id),
  }))
  res.json({ products, receipts, inkoop, donaties, kas, settings: getSettingsFromDb() })
})

app.post('/api/restore', requireAdmin, (req, res) => {
  const data = req.body
  if (!Array.isArray(data.products) || !Array.isArray(data.receipts))
    return res.status(400).json({ error: 'Ongeldig backup bestand' })

  db.transaction(() => {
    db.prepare('DELETE FROM receipt_items').run()
    db.prepare('DELETE FROM receipts').run()
    db.prepare('DELETE FROM products').run()
    db.prepare('DELETE FROM inkoop').run()
    db.prepare('DELETE FROM donaties').run()
    db.prepare('DELETE FROM kas_correcties').run()
    db.prepare('DELETE FROM kas').run()

    for (const p of (data.products || [])) {
      db.prepare(`INSERT INTO products (id,name,price,cost_price,category,available,sort_order,created_at)
                  VALUES (?,?,?,?,?,?,?,?)`).run(
        p.id, p.name, p.price, p.cost_price ?? null, p.category || 'overig',
        p.available !== false ? 1 : 0, p.sort_order ?? 0, p.created_at || new Date().toISOString(),
      )
    }
    for (const r of (data.receipts || [])) {
      db.prepare(`INSERT INTO receipts (id,name,note,paid,discount_pct,donation,promo_discount,promo_lines,payment_method,payments,created_at)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        r.id, r.name ?? null, r.note ?? null, r.paid ? 1 : 0, r.discount_pct || 0, r.donation || 0,
        r.promo_discount || 0,
        typeof r.promo_lines === 'string' ? r.promo_lines : JSON.stringify(r.promo_lines || []),
        r.payment_method ?? null, JSON.stringify(r.payments || []), r.created_at || new Date().toISOString(),
      )
      for (const i of (r.items || [])) {
        db.prepare(`INSERT INTO receipt_items (id,receipt_id,product_id,product_name,product_price,quantity)
                    VALUES (?,?,?,?,?,?)`).run(
          i.id, r.id, i.product_id ?? null, i.product_name, i.product_price, i.quantity,
        )
      }
    }
    for (const b of (data.inkoop || [])) {
      db.prepare(`INSERT INTO inkoop (id,description,amount,date,note,submitted_by,created_at)
                  VALUES (?,?,?,?,?,?,?)`).run(
        b.id, b.description, b.amount, b.date, b.note ?? null, b.submitted_by ?? null, b.created_at,
      )
    }
    for (const d of (data.donaties || [])) {
      db.prepare(`INSERT INTO donaties (id,name,amount,date,note,created_at)
                  VALUES (?,?,?,?,?,?)`).run(d.id, d.name ?? null, d.amount, d.date, d.note ?? null, d.created_at)
    }
    for (const k of (data.kas || [])) {
      db.prepare(`INSERT INTO kas (id,datum,begin_bedrag,eind_bedrag,note,created_at)
                  VALUES (?,?,?,?,?,?)`).run(
        k.id, k.datum, k.begin_bedrag || 0, k.eind_bedrag ?? null, k.note ?? null, k.created_at,
      )
      for (const c of (k.correcties || [])) {
        db.prepare(`INSERT INTO kas_correcties (id,kas_id,type,amount,description,created_at)
                    VALUES (?,?,?,?,?,?)`).run(c.id, k.id, c.type, c.amount, c.description, c.created_at)
      }
    }
    if (data.settings) saveSettingsToDb(data.settings)
  })()

  res.json({ ok: true })
})

// ─── Products ─────────────────────────────────────────────────────────────────
app.get('/api/products', (_req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY sort_order').all())
})

app.get('/api/products/popular', (_req, res) => {
  const rows = db.prepare(`
    SELECT ri.product_id, SUM(ri.quantity) as cnt
    FROM receipt_items ri
    GROUP BY ri.product_id
    ORDER BY cnt DESC
    LIMIT 6
  `).all()
  const products = []
  for (const row of rows) {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(row.product_id)
    if (p) products.push({ ...p, orderCount: row.cnt })
  }
  res.json(products)
})

app.post('/api/products', requireAdmin, (req, res) => {
  const { name, price, category } = req.body
  if (!name || price === undefined) return res.status(400).json({ error: 'Name and price required' })
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM products').get().m
  const info = db.prepare(`
    INSERT INTO products (name,price,cost_price,category,available,sort_order,created_at)
    VALUES (?,?,?,?,1,?,?)
  `).run(
    name, parseFloat(price),
    req.body.cost_price != null ? parseFloat(req.body.cost_price) : null,
    category || 'overig', maxOrder + 1, new Date().toISOString(),
  )
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid))
})

app.put('/api/products/reorder', requireAdmin, (req, res) => {
  const { order } = req.body
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order required' })
  const stmt = db.prepare('UPDATE products SET sort_order = ? WHERE id = ?')
  db.transaction(() => { order.forEach((id, idx) => stmt.run(idx, id)) })()
  res.json({ ok: true })
})

app.put('/api/products/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id)
  const p  = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  if (!p) return res.status(404).json({ error: 'Not found' })
  const name       = req.body.name      !== undefined ? req.body.name      : p.name
  const price      = req.body.price     !== undefined ? parseFloat(req.body.price) : p.price
  const category   = req.body.category  !== undefined ? (req.body.category || 'overig') : p.category
  const available  = req.body.available !== undefined ? (req.body.available !== false ? 1 : 0) : p.available
  const cost_price = req.body.cost_price !== undefined
    ? (req.body.cost_price != null ? parseFloat(req.body.cost_price) : null)
    : p.cost_price
  db.prepare('UPDATE products SET name=?,price=?,category=?,available=?,cost_price=? WHERE id=?')
    .run(name, price, category, available, cost_price, id)
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(id))
})

app.delete('/api/products/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(parseInt(req.params.id))
  res.json({ ok: true })
})

// ─── Receipts ─────────────────────────────────────────────────────────────────
app.get('/api/receipts', (_req, res) => {
  const rows = db.prepare(`
    SELECT r.*, COUNT(ri.id) as item_count
    FROM receipts r
    LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `).all()
  res.json(rows.map(r => {
    const { payments: _, ...rest } = r
    return { ...rest, total: 0 }
  }).map(r => {
    const items = db.prepare('SELECT product_price, quantity FROM receipt_items WHERE receipt_id = ?').all(r.id)
    const sub   = items.reduce((s, i) => s + i.product_price * i.quantity, 0)
    const row   = db.prepare('SELECT discount_pct, donation, promo_discount FROM receipts WHERE id = ?').get(r.id)
    return {
      ...r,
      total: calcTotal(items, row?.discount_pct, row?.promo_discount),
      donation: row?.donation || 0,
      promo_lines: JSON.parse(r.promo_lines || '[]'),
    }
  }))
})

app.post('/api/receipts', (req, res) => {
  const { name, items, note } = req.body
  const info = db.prepare(`
    INSERT INTO receipts (name,note,paid,discount_pct,donation,payments,created_at)
    VALUES (?,?,0,0,0,'[]',?)
  `).run(name || null, note || null, new Date().toISOString())
  const rid = info.lastInsertRowid
  const stmt = db.prepare(`
    INSERT INTO receipt_items (receipt_id,product_id,product_name,product_price,quantity)
    VALUES (?,?,?,?,?)
  `)
  db.transaction(() => {
    for (const i of (items || [])) stmt.run(rid, i.product_id, i.product_name, i.product_price, i.quantity)
  })()
  recomputePromo(rid)
  const r = db.prepare('SELECT * FROM receipts WHERE id = ?').get(rid)
  res.json({ ...r, payments: JSON.parse(r.payments || '[]'), promo_lines: JSON.parse(r.promo_lines || '[]') })
})

app.get('/api/receipts/:id', (req, res) => {
  const r = getReceiptWithItems(parseInt(req.params.id))
  if (!r) return res.status(404).json({ error: 'Not found' })
  res.json(r)
})

app.put('/api/receipts/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const r  = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id)
  if (!r) return res.status(404).json({ error: 'Not found' })
  const name           = req.body.name           !== undefined ? req.body.name           : r.name
  const note           = req.body.note           !== undefined ? (req.body.note || null) : r.note
  const paid           = req.body.paid           !== undefined ? (req.body.paid ? 1 : 0) : r.paid
  const discount_pct   = req.body.discount_pct   !== undefined ? parseFloat(req.body.discount_pct) || 0 : r.discount_pct
  const donation       = req.body.donation       !== undefined ? parseFloat(req.body.donation) || 0 : r.donation
  const payment_method = req.body.payment_method !== undefined ? (req.body.payment_method || null) : r.payment_method
  const payments       = req.body.payments       !== undefined ? JSON.stringify(req.body.payments || []) : r.payments
  db.prepare(`UPDATE receipts SET name=?,note=?,paid=?,discount_pct=?,donation=?,payment_method=?,payments=? WHERE id=?`)
    .run(name, note, paid, discount_pct, donation, payment_method, payments, id)
  autoUpdateDisplay(id)
  const updated = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id)
  res.json({ ...updated, payments: JSON.parse(updated.payments || '[]'), promo_lines: JSON.parse(updated.promo_lines || '[]') })
})

app.delete('/api/receipts/:id', (req, res) => {
  db.prepare('DELETE FROM receipts WHERE id = ?').run(parseInt(req.params.id))
  res.json({ ok: true })
})

app.post('/api/receipts/bulk', (req, res) => {
  const { ids, paid } = req.body
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' })
  const stmt = db.prepare('UPDATE receipts SET paid = ? WHERE id = ?')
  db.transaction(() => { ids.forEach(id => stmt.run(paid ? 1 : 0, id)) })()
  res.json({ ok: true, count: ids.length })
})

// ─── Receipt items ─────────────────────────────────────────────────────────────
app.post('/api/receipts/:id/items', (req, res) => {
  const receiptId = parseInt(req.params.id)
  if (!db.prepare('SELECT id FROM receipts WHERE id = ?').get(receiptId))
    return res.status(404).json({ error: 'Not found' })
  const { product_id, product_name, product_price, quantity } = req.body
  const info = db.prepare(`
    INSERT INTO receipt_items (receipt_id,product_id,product_name,product_price,quantity)
    VALUES (?,?,?,?,?)
  `).run(receiptId, product_id, product_name, product_price, quantity ?? 1)
  const item = db.prepare('SELECT * FROM receipt_items WHERE id = ?').get(info.lastInsertRowid)
  const promo = recomputePromo(receiptId)
  autoUpdateDisplay(receiptId)
  res.json({ ...item, ...promo })
})

app.put('/api/receipts/:id/items/:itemId', (req, res) => {
  const receiptId = parseInt(req.params.id)
  const itemId    = parseInt(req.params.itemId)
  db.prepare('UPDATE receipt_items SET quantity = ? WHERE id = ? AND receipt_id = ?')
    .run(req.body.quantity, itemId, receiptId)
  const item = db.prepare('SELECT * FROM receipt_items WHERE id = ?').get(itemId)
  if (!item) return res.status(404).json({ error: 'Item not found' })
  const promo = recomputePromo(receiptId)
  autoUpdateDisplay(receiptId)
  res.json({ ...item, ...promo })
})

app.delete('/api/receipts/:id/items/:itemId', (req, res) => {
  const receiptId = parseInt(req.params.id)
  const itemId    = parseInt(req.params.itemId)
  db.prepare('DELETE FROM receipt_items WHERE id = ? AND receipt_id = ?').run(itemId, receiptId)
  const promo = recomputePromo(receiptId)
  autoUpdateDisplay(receiptId)
  res.json({ ok: true, ...promo })
})

// ─── Inkoop bonnetjes ─────────────────────────────────────────────────────────
app.get('/api/inkoop', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM inkoop ORDER BY created_at DESC').all())
})

app.post('/api/inkoop', requireAdmin, (req, res) => {
  const { description, amount, date, note, submitted_by } = req.body
  if (!description || amount === undefined) return res.status(400).json({ error: 'description and amount required' })
  const info = db.prepare(`
    INSERT INTO inkoop (description,amount,date,note,submitted_by,created_at)
    VALUES (?,?,?,?,?,?)
  `).run(
    description, parseFloat(amount),
    date || new Date().toISOString().slice(0, 10),
    note || null, submitted_by || null, new Date().toISOString(),
  )
  res.json(db.prepare('SELECT * FROM inkoop WHERE id = ?').get(info.lastInsertRowid))
})

app.put('/api/inkoop/:id', requireAdmin, (req, res) => {
  const id  = parseInt(req.params.id)
  const bon = db.prepare('SELECT * FROM inkoop WHERE id = ?').get(id)
  if (!bon) return res.status(404).json({ error: 'Not found' })
  const description  = req.body.description  !== undefined ? req.body.description  : bon.description
  const amount       = req.body.amount       !== undefined ? parseFloat(req.body.amount) : bon.amount
  const date         = req.body.date         !== undefined ? req.body.date         : bon.date
  const note         = req.body.note         !== undefined ? (req.body.note || null) : bon.note
  const submitted_by = req.body.submitted_by !== undefined ? (req.body.submitted_by || null) : bon.submitted_by
  db.prepare('UPDATE inkoop SET description=?,amount=?,date=?,note=?,submitted_by=? WHERE id=?')
    .run(description, amount, date, note, submitted_by, id)
  res.json(db.prepare('SELECT * FROM inkoop WHERE id = ?').get(id))
})

app.delete('/api/inkoop/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM inkoop WHERE id = ?').run(parseInt(req.params.id))
  res.json({ ok: true })
})

// ─── Losse donaties ───────────────────────────────────────────────────────────
app.get('/api/donaties', (_req, res) => {
  res.json(db.prepare('SELECT * FROM donaties ORDER BY created_at DESC').all())
})

app.post('/api/donaties', (req, res) => {
  const { name, amount, date, note } = req.body
  if (amount === undefined) return res.status(400).json({ error: 'amount required' })
  const info = db.prepare(`
    INSERT INTO donaties (name,amount,date,note,created_at)
    VALUES (?,?,?,?,?)
  `).run(
    name?.trim() || null, parseFloat(amount),
    date || new Date().toISOString().slice(0, 10),
    note?.trim() || null, new Date().toISOString(),
  )
  res.json(db.prepare('SELECT * FROM donaties WHERE id = ?').get(info.lastInsertRowid))
})

app.put('/api/donaties/:id', (req, res) => {
  const id  = parseInt(req.params.id)
  const don = db.prepare('SELECT * FROM donaties WHERE id = ?').get(id)
  if (!don) return res.status(404).json({ error: 'Not found' })
  const name   = req.body.name   !== undefined ? (req.body.name?.trim() || null)  : don.name
  const amount = req.body.amount !== undefined ? parseFloat(req.body.amount)       : don.amount
  const date   = req.body.date   !== undefined ? req.body.date                     : don.date
  const note   = req.body.note   !== undefined ? (req.body.note?.trim() || null)   : don.note
  db.prepare('UPDATE donaties SET name=?,amount=?,date=?,note=? WHERE id=?').run(name, amount, date, note, id)
  res.json(db.prepare('SELECT * FROM donaties WHERE id = ?').get(id))
})

app.delete('/api/donaties/:id', (req, res) => {
  db.prepare('DELETE FROM donaties WHERE id = ?').run(parseInt(req.params.id))
  res.json({ ok: true })
})

// ─── Kasregistraties ──────────────────────────────────────────────────────────
app.get('/api/kas', requireAdmin, (_req, res) => {
  const records = db.prepare('SELECT * FROM kas ORDER BY datum DESC').all()
  res.json(records.map(k => ({
    ...k,
    correcties: db.prepare('SELECT * FROM kas_correcties WHERE kas_id = ? ORDER BY id').all(k.id),
  })))
})

app.post('/api/kas', requireAdmin, (req, res) => {
  const datum = req.body.datum || new Date().toISOString().slice(0, 10)
  let record  = db.prepare('SELECT * FROM kas WHERE datum = ?').get(datum)
  if (record) {
    const begin_bedrag = req.body.begin_bedrag !== undefined ? parseFloat(req.body.begin_bedrag) || 0 : record.begin_bedrag
    const eind_bedrag  = req.body.eind_bedrag  !== undefined ? (req.body.eind_bedrag !== null ? parseFloat(req.body.eind_bedrag) : null) : record.eind_bedrag
    const note         = req.body.note         !== undefined ? (req.body.note || null) : record.note
    db.prepare('UPDATE kas SET begin_bedrag=?,eind_bedrag=?,note=? WHERE id=?').run(begin_bedrag, eind_bedrag, note, record.id)
  } else {
    const info = db.prepare(`
      INSERT INTO kas (datum,begin_bedrag,eind_bedrag,note,created_at)
      VALUES (?,?,null,?,?)
    `).run(datum, parseFloat(req.body.begin_bedrag) || 0, req.body.note || null, new Date().toISOString())
    record = { id: info.lastInsertRowid }
  }
  res.json(getKasWithCorrecties(record.id || db.prepare('SELECT id FROM kas WHERE datum = ?').get(datum).id))
})

app.put('/api/kas/:id', requireAdmin, (req, res) => {
  const id     = parseInt(req.params.id)
  const record = db.prepare('SELECT * FROM kas WHERE id = ?').get(id)
  if (!record) return res.status(404).json({ error: 'Not found' })
  const begin_bedrag = req.body.begin_bedrag !== undefined ? parseFloat(req.body.begin_bedrag) || 0 : record.begin_bedrag
  const eind_bedrag  = req.body.eind_bedrag  !== undefined ? (req.body.eind_bedrag !== null ? parseFloat(req.body.eind_bedrag) : null) : record.eind_bedrag
  const note         = req.body.note         !== undefined ? (req.body.note || null) : record.note
  db.prepare('UPDATE kas SET begin_bedrag=?,eind_bedrag=?,note=? WHERE id=?').run(begin_bedrag, eind_bedrag, note, id)
  res.json(getKasWithCorrecties(id))
})

app.delete('/api/kas/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM kas WHERE id = ?').run(parseInt(req.params.id))
  res.json({ ok: true })
})

app.post('/api/kas/:id/correcties', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id)
  if (!db.prepare('SELECT id FROM kas WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Not found' })
  const info = db.prepare(`
    INSERT INTO kas_correcties (kas_id,type,amount,description,created_at)
    VALUES (?,?,?,?,?)
  `).run(id, req.body.type || 'contant', parseFloat(req.body.amount) || 0, req.body.description || '', new Date().toISOString())
  res.json(db.prepare('SELECT * FROM kas_correcties WHERE id = ?').get(info.lastInsertRowid))
})

app.delete('/api/kas/:id/correcties/:cid', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM kas_correcties WHERE id = ? AND kas_id = ?')
    .run(parseInt(req.params.cid), parseInt(req.params.id))
  res.json({ ok: true })
})

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', (_req, res) => {
  res.json({ ...SETTING_DEFAULTS, ...getSettingsFromDb() })
})

app.put('/api/settings', requireAdmin, (req, res) => {
  const s = { ...SETTING_DEFAULTS, ...getSettingsFromDb(), ...req.body }
  saveSettingsToDb(s)
  res.json(s)
})

// ─── Stats ────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const todayStr     = new Date().toDateString()
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString()
  const filterToday     = req.query.period === 'today'
  const filterYesterday = req.query.period === 'yesterday'
  const filterDate      = req.query.period === 'date' && req.query.date ? req.query.date : null
  const filterDateStr   = filterDate ? new Date(filterDate + 'T12:00:00').toDateString() : null

  const allReceipts = getAllReceiptsWithItems()
  const receipts    = filterToday
    ? allReceipts.filter(r => new Date(r.created_at).toDateString() === todayStr)
    : filterYesterday
      ? allReceipts.filter(r => new Date(r.created_at).toDateString() === yesterdayStr)
      : filterDate
        ? allReceipts.filter(r => new Date(r.created_at).toDateString() === filterDateStr)
        : allReceipts

  let totalRevenue = 0, paidRevenue = 0, todayRevenue = 0, todayPaidRevenue = 0, totalDonations = 0, todayDonations = 0
  const productMap = {}, hourMap = {}, dayMap = {}
  const paymentBreakdown      = { contant: 0, pin: 0, qr: 0, onbekend: 0 }
  const todayPaymentBreakdown = { contant: 0, pin: 0, qr: 0, onbekend: 0 }

  receipts.forEach(r => {
    const rTotal    = calcTotal(r.items, r.discount_pct, r.promo_discount)
    const rDonation = r.donation || 0
    totalRevenue   += rTotal + rDonation
    totalDonations += rDonation
    if (r.paid) {
      paidRevenue += rTotal + rDonation
      if (r.payments?.length > 0) {
        r.payments.forEach(p => {
          const m = p.method || 'onbekend'
          paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (p.amount || 0)
        })
      } else {
        const m = r.payment_method || 'onbekend'
        paymentBreakdown[m] = (paymentBreakdown[m] || 0) + rTotal + rDonation
      }
    }

    const date    = new Date(r.created_at)
    const isToday = date.toDateString() === todayStr

    if (isToday) {
      todayRevenue += rTotal + rDonation
      if (r.paid) {
        todayPaidRevenue += rTotal + rDonation
        if (r.payments?.length > 0) {
          r.payments.forEach(p => {
            const m = p.method || 'onbekend'
            todayPaymentBreakdown[m] = (todayPaymentBreakdown[m] || 0) + (p.amount || 0)
          })
        } else {
          const m = r.payment_method || 'onbekend'
          todayPaymentBreakdown[m] = (todayPaymentBreakdown[m] || 0) + rTotal + rDonation
        }
      }
      todayDonations += rDonation
      const h = date.getHours()
      hourMap[h] = (hourMap[h] || 0) + rTotal + rDonation
    }

    const dayKey = r.created_at.split('T')[0]
    dayMap[dayKey] = (dayMap[dayKey] || 0) + rTotal + rDonation

    ;(r.items || []).forEach(i => {
      if (!productMap[i.product_name])
        productMap[i.product_name] = { name: i.product_name, quantity: 0, revenue: 0 }
      productMap[i.product_name].quantity += i.quantity
      productMap[i.product_name].revenue  += i.product_price * i.quantity
    })
  })

  const paidCount = receipts.filter(r => r.paid).length

  const revenueByHour = []
  for (let h = 0; h < 24; h++) {
    if (hourMap[h] != null)
      revenueByHour.push({ hour: `${String(h).padStart(2, '0')}:00`, revenue: Math.round(hourMap[h] * 100) / 100 })
  }

  const revenueByDay = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([day, revenue]) => ({
      day: new Date(day).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
      revenue: Math.round(revenue * 100) / 100,
    }))

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .map(p => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))

  // Estimated costs based on product cost prices × sold quantities
  const soldQtyMap = {}
  receipts.forEach(r => {
    ;(r.items || []).forEach(i => {
      soldQtyMap[i.product_id] = (soldQtyMap[i.product_id] || 0) + i.quantity
    })
  })
  const allProducts = db.prepare('SELECT id, cost_price FROM products').all()
  const costPriceMap = Object.fromEntries(allProducts.map(p => [p.id, p.cost_price]))
  let estimatedCosts = 0
  Object.entries(soldQtyMap).forEach(([pid, qty]) => {
    const cp = costPriceMap[parseInt(pid)]
    if (cp) estimatedCosts += cp * qty
  })

  const categoryMap = {}
  const productCatMap = Object.fromEntries(db.prepare('SELECT id, category FROM products').all().map(p => [p.id, p.category || 'overig']))
  receipts.forEach(r => {
    ;(r.items || []).forEach(i => {
      const cat = productCatMap[i.product_id] || 'overig'
      if (!categoryMap[cat]) categoryMap[cat] = { cat, quantity: 0, revenue: 0 }
      categoryMap[cat].quantity += i.quantity
      categoryMap[cat].revenue  += i.product_price * i.quantity
    })
  })
  const categoryStats = Object.values(categoryMap)
    .map(c => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)

  // Yesterday totals (always calculated regardless of period filter)
  let yesterdayRevenue = 0
  allReceipts.forEach(r => {
    if (new Date(r.created_at).toDateString() === yesterdayStr)
      yesterdayRevenue += calcTotal(r.items, r.discount_pct, r.promo_discount) + (r.donation || 0)
  })

  // Losse donaties
  const allDonaties = db.prepare('SELECT * FROM donaties').all()
  const donatiesFiltered = filterToday
    ? allDonaties.filter(d => new Date(d.created_at).toDateString() === todayStr)
    : filterYesterday
      ? allDonaties.filter(d => new Date(d.created_at).toDateString() === yesterdayStr)
      : filterDate
        ? allDonaties.filter(d => new Date(d.created_at).toDateString() === filterDateStr)
        : allDonaties
  donatiesFiltered.forEach(d => {
    const amt = d.amount || 0
    totalRevenue   += amt
    paidRevenue    += amt
    totalDonations += amt
    const isToday = new Date(d.created_at).toDateString() === todayStr
    if (isToday) {
      todayRevenue     += amt
      todayPaidRevenue += amt
      todayDonations   += amt
      const h = new Date(d.created_at).getHours()
      hourMap[h] = (hourMap[h] || 0) + amt
    }
    const dayKey = d.created_at.split('T')[0]
    dayMap[dayKey] = (dayMap[dayKey] || 0) + amt
  })
  allDonaties.forEach(d => {
    if (new Date(d.created_at).toDateString() === yesterdayStr)
      yesterdayRevenue += d.amount || 0
  })

  // Inkoop / kosten
  const allInkoop = db.prepare('SELECT * FROM inkoop').all()
  const inkoopFiltered = filterToday
    ? allInkoop.filter(b => new Date(b.created_at).toDateString() === todayStr)
    : filterYesterday
      ? allInkoop.filter(b => new Date(b.created_at).toDateString() === yesterdayStr)
      : filterDate
        ? allInkoop.filter(b => new Date(b.created_at).toDateString() === filterDateStr)
        : allInkoop
  const totalCosts = inkoopFiltered.reduce((s, b) => s + (b.amount || 0), 0)
  const todayCosts = allInkoop
    .filter(b => new Date(b.created_at).toDateString() === todayStr)
    .reduce((s, b) => s + (b.amount || 0), 0)

  res.json({
    totalRevenue:    Math.round(totalRevenue    * 100) / 100,
    paidRevenue:     Math.round(paidRevenue     * 100) / 100,
    unpaidRevenue:   Math.round((totalRevenue - paidRevenue) * 100) / 100,
    todayRevenue:    Math.round(todayRevenue    * 100) / 100,
    receiptCount:    receipts.length,
    paidCount,
    unpaidCount:     receipts.length - paidCount,
    avgReceiptValue: receipts.length ? Math.round(totalRevenue / receipts.length * 100) / 100 : 0,
    topProducts,
    categoryStats,
    revenueByHour,
    revenueByDay: (filterToday || filterYesterday || filterDate) ? [] : revenueByDay,
    multiDay: !filterToday && !filterYesterday && !filterDate && Object.keys(dayMap).length > 1,
    totalCosts:      Math.round(totalCosts      * 100) / 100,
    profit:          Math.round((paidRevenue - totalCosts) * 100) / 100,
    todayCosts:      Math.round(todayCosts      * 100) / 100,
    todayProfit:     Math.round((todayPaidRevenue - todayCosts) * 100) / 100,
    totalDonations:  Math.round(totalDonations  * 100) / 100,
    todayDonations:  Math.round(todayDonations  * 100) / 100,
    paymentBreakdown:      Object.fromEntries(Object.entries(paymentBreakdown).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    todayPaymentBreakdown: Object.fromEntries(Object.entries(todayPaymentBreakdown).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    estimatedCosts:        Math.round(estimatedCosts   * 100) / 100,
    estimatedProfit:       Math.round((paidRevenue - estimatedCosts) * 100) / 100,
    yesterdayRevenue:      Math.round(yesterdayRevenue * 100) / 100,
  })
})

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🍺  Tappy draait op http://localhost:${PORT}`)
  if (CASHIER_PIN) console.log(`   Kassier-PIN actief (rol: cashier)`)
})
