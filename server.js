import 'dotenv/config'
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

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

// ─── Database ─────────────────────────────────────────────────────────────────
const adapter = new JSONFile(join(__dirname, 'kassa.json'))
const db = new Low(adapter, {
  products: [], receipts: [], sessions: {}, settings: {}, inkoop: [], _pid: 0, _rid: 0, _iid: 0, _bid: 0,
})
await db.read()

function nextId(key) {
  db.data[key] = (db.data[key] || 0) + 1
  return db.data[key]
}

// Migrate sessions from old array format to object format
if (Array.isArray(db.data.sessions)) {
  db.data.sessions = Object.fromEntries((db.data.sessions).map(t => [t, 'admin']))
  await db.write()
}
if (!db.data.sessions || typeof db.data.sessions !== 'object') {
  db.data.sessions = {}
  await db.write()
}

// Sessions: Map<token, role>
const sessions = new Map(Object.entries(db.data.sessions))

async function saveSession(token, role) {
  sessions.set(token, role)
  db.data.sessions = Object.fromEntries(sessions)
  await db.write()
}

async function deleteSession(token) {
  sessions.delete(token)
  db.data.sessions = Object.fromEntries(sessions)
  await db.write()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcTotal(items, discount_pct) {
  const base = (items || []).reduce((s, i) => s + i.product_price * i.quantity, 0)
  return base * (1 - (discount_pct || 0) / 100)
}

const SETTING_DEFAULTS = {
  paymentUrl:  'https://www.ing.nl/payreq/m/?trxid=aUZVw7cSEoc3M52nCif1fjGgLPCCcbnO',
  paymentName: 'Sint Martinus Explos\nPannenkoeken actie 2026',
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.static(join(__dirname, 'dist')))

// ─── Auth endpoints (no token required) ──────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { pin } = req.body
  let role = null
  if (pin && pin === ADMIN_PIN)                      role = 'admin'
  if (pin && CASHIER_PIN && pin === CASHIER_PIN)     role = 'cashier'
  if (!role) return res.status(401).json({ error: 'Verkeerde PIN' })
  const token = randomUUID()
  await saveSession(token, role)
  res.json({ token, role })
})

app.post('/api/auth/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) await deleteSession(token)
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

// ─── Products ─────────────────────────────────────────────────────────────────

app.get('/api/products', (_req, res) => {
  res.json([...db.data.products].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  ))
})

app.get('/api/products/popular', (_req, res) => {
  const counts = {}
  db.data.receipts.forEach(r => {
    ;(r.items || []).forEach(i => {
      counts[i.product_id] = (counts[i.product_id] || 0) + i.quantity
    })
  })
  const popular = db.data.products
    .map(p => ({ ...p, orderCount: counts[p.id] || 0 }))
    .filter(p => p.orderCount > 0)
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 6)
  res.json(popular)
})

app.post('/api/products', requireAdmin, async (req, res) => {
  const { name, price, category } = req.body
  if (!name || price === undefined) return res.status(400).json({ error: 'Name and price required' })
  const product = {
    id: nextId('_pid'), name,
    price: parseFloat(price),
    category: category || 'overig',
    created_at: new Date().toISOString(),
  }
  db.data.products.push(product)
  await db.write()
  res.json(product)
})

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  const p = db.data.products.find(p => p.id === id)
  if (!p) return res.status(404).json({ error: 'Not found' })
  p.name     = req.body.name
  p.price    = parseFloat(req.body.price)
  p.category = req.body.category || 'overig'
  await db.write()
  res.json(p)
})

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  db.data.products = db.data.products.filter(p => p.id !== id)
  await db.write()
  res.json({ ok: true })
})

// ─── Receipts ─────────────────────────────────────────────────────────────────

app.get('/api/receipts', (_req, res) => {
  const list = db.data.receipts
    .map(({ items, ...r }) => ({
      ...r,
      total:      calcTotal(items, r.discount_pct),
      item_count: (items || []).length,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  res.json(list)
})

app.post('/api/receipts', async (req, res) => {
  const { name, items, note } = req.body
  const rid = nextId('_rid')
  const receipt = {
    id:           rid,
    name:         name || null,
    note:         note || null,
    paid:         0,
    discount_pct: 0,
    created_at:   new Date().toISOString(),
    items:        (items || []).map(item => ({
      id:            nextId('_iid'),
      receipt_id:    rid,
      product_id:    item.product_id,
      product_name:  item.product_name,
      product_price: item.product_price,
      quantity:      item.quantity,
    })),
  }
  db.data.receipts.push(receipt)
  await db.write()
  const { items: _, ...withoutItems } = receipt
  res.json(withoutItems)
})

app.get('/api/receipts/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const receipt = db.data.receipts.find(r => r.id === id)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  res.json(receipt)
})

app.put('/api/receipts/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const receipt = db.data.receipts.find(r => r.id === id)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  if (req.body.name         !== undefined) receipt.name         = req.body.name
  if (req.body.note         !== undefined) receipt.note         = req.body.note || null
  if (req.body.paid         !== undefined) receipt.paid         = req.body.paid ? 1 : 0
  if (req.body.discount_pct !== undefined) receipt.discount_pct = parseFloat(req.body.discount_pct) || 0
  await db.write()
  const { items, ...rest } = receipt
  res.json(rest)
})

app.delete('/api/receipts/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  db.data.receipts = db.data.receipts.filter(r => r.id !== id)
  await db.write()
  res.json({ ok: true })
})

// Bulk update receipts (mark multiple as paid/unpaid)
app.post('/api/receipts/bulk', async (req, res) => {
  const { ids, paid } = req.body
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' })
  ids.forEach(id => {
    const r = db.data.receipts.find(r => r.id === id)
    if (r) r.paid = paid ? 1 : 0
  })
  await db.write()
  res.json({ ok: true, count: ids.length })
})

// ─── Receipt items ─────────────────────────────────────────────────────────────

app.post('/api/receipts/:id/items', async (req, res) => {
  const receiptId = parseInt(req.params.id)
  const receipt   = db.data.receipts.find(r => r.id === receiptId)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  const { product_id, product_name, product_price, quantity } = req.body
  const item = {
    id:            nextId('_iid'),
    receipt_id:    receiptId,
    product_id,
    product_name,
    product_price,
    quantity:      quantity ?? 1,
  }
  receipt.items.push(item)
  await db.write()
  res.json(item)
})

app.put('/api/receipts/:id/items/:itemId', async (req, res) => {
  const receiptId = parseInt(req.params.id)
  const itemId    = parseInt(req.params.itemId)
  const receipt   = db.data.receipts.find(r => r.id === receiptId)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  const item = receipt.items.find(i => i.id === itemId)
  if (!item) return res.status(404).json({ error: 'Item not found' })
  item.quantity = req.body.quantity
  await db.write()
  res.json(item)
})

app.delete('/api/receipts/:id/items/:itemId', async (req, res) => {
  const receiptId = parseInt(req.params.id)
  const itemId    = parseInt(req.params.itemId)
  const receipt   = db.data.receipts.find(r => r.id === receiptId)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  receipt.items = receipt.items.filter(i => i.id !== itemId)
  await db.write()
  res.json({ ok: true })
})

// ─── Inkoop bonnetjes ─────────────────────────────────────────────────────────

app.get('/api/inkoop', requireAdmin, (_req, res) => {
  const list = (db.data.inkoop || [])
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  res.json(list)
})

app.post('/api/inkoop', requireAdmin, async (req, res) => {
  const { description, amount, date, note } = req.body
  if (!description || amount === undefined) return res.status(400).json({ error: 'description and amount required' })
  if (!db.data.inkoop) db.data.inkoop = []
  const bon = {
    id:          nextId('_bid'),
    description,
    amount:      parseFloat(amount),
    date:        date || new Date().toISOString().slice(0, 10),
    note:        note || null,
    created_at:  new Date().toISOString(),
  }
  db.data.inkoop.push(bon)
  await db.write()
  res.json(bon)
})

app.put('/api/inkoop/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  const bon = (db.data.inkoop || []).find(b => b.id === id)
  if (!bon) return res.status(404).json({ error: 'Not found' })
  if (req.body.description !== undefined) bon.description = req.body.description
  if (req.body.amount      !== undefined) bon.amount      = parseFloat(req.body.amount)
  if (req.body.date        !== undefined) bon.date        = req.body.date
  if (req.body.note        !== undefined) bon.note        = req.body.note || null
  await db.write()
  res.json(bon)
})

app.delete('/api/inkoop/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  db.data.inkoop = (db.data.inkoop || []).filter(b => b.id !== id)
  await db.write()
  res.json({ ok: true })
})

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', (_req, res) => {
  res.json({ ...SETTING_DEFAULTS, ...(db.data.settings || {}) })
})

app.put('/api/settings', requireAdmin, async (req, res) => {
  db.data.settings = { ...SETTING_DEFAULTS, ...(db.data.settings || {}), ...req.body }
  await db.write()
  res.json(db.data.settings)
})

// ─── Stats ────────────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  const todayStr    = new Date().toDateString()
  const filterToday = req.query.period === 'today'

  const receipts = filterToday
    ? db.data.receipts.filter(r => new Date(r.created_at).toDateString() === todayStr)
    : db.data.receipts

  let totalRevenue = 0, paidRevenue = 0, todayRevenue = 0
  const productMap = {}, hourMap = {}, dayMap = {}

  receipts.forEach(r => {
    const rTotal = calcTotal(r.items, r.discount_pct)
    totalRevenue += rTotal
    if (r.paid) paidRevenue += rTotal

    const date    = new Date(r.created_at)
    const isToday = date.toDateString() === todayStr

    if (isToday) {
      todayRevenue += rTotal
      const h = date.getHours()
      hourMap[h] = (hourMap[h] || 0) + rTotal
    }

    const dayKey = r.created_at.split('T')[0]
    dayMap[dayKey] = (dayMap[dayKey] || 0) + rTotal

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
    .slice(0, 8)
    .map(p => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))

  // ── Inkoop / kosten ────────────────────────────────────────────────────────
  const allInkoop = db.data.inkoop || []
  const inkoopFiltered = filterToday
    ? allInkoop.filter(b => new Date(b.created_at).toDateString() === todayStr)
    : allInkoop
  const totalCosts    = inkoopFiltered.reduce((s, b) => s + (b.amount || 0), 0)
  const todayCosts    = allInkoop
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
    revenueByHour,
    revenueByDay: filterToday ? [] : revenueByDay,
    multiDay: !filterToday && Object.keys(dayMap).length > 1,
    totalCosts:      Math.round(totalCosts   * 100) / 100,
    profit:          Math.round((totalRevenue - totalCosts) * 100) / 100,
    todayCosts:      Math.round(todayCosts   * 100) / 100,
    todayProfit:     Math.round((todayRevenue - todayCosts) * 100) / 100,
  })
})

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🏕️  Kassa draait op http://localhost:${PORT}`)
  if (CASHIER_PIN) console.log(`   Kassier-PIN actief (rol: cashier)`)
})
