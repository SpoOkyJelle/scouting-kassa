import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app  = express()
const PORT = 3001

// ─── Database setup ────────────────────────────────────────────────────────────
const adapter = new JSONFile(join(__dirname, 'kassa.json'))
const db = new Low(adapter, { products: [], receipts: [], _pid: 0, _rid: 0, _iid: 0 })
await db.read()

function nextId(key) {
  db.data[key] = (db.data[key] || 0) + 1
  return db.data[key]
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.static(join(__dirname, 'dist')))

// ─── Products ─────────────────────────────────────────────────────────────────

app.get('/api/products', (_req, res) => {
  const sorted = [...db.data.products].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
  res.json(sorted)
})

app.post('/api/products', async (req, res) => {
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

app.put('/api/products/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const p = db.data.products.find(p => p.id === id)
  if (!p) return res.status(404).json({ error: 'Not found' })
  p.name     = req.body.name
  p.price    = parseFloat(req.body.price)
  p.category = req.body.category || 'overig'
  await db.write()
  res.json(p)
})

app.delete('/api/products/:id', async (req, res) => {
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
      total:      (items || []).reduce((s, i) => s + i.product_price * i.quantity, 0),
      item_count: (items || []).length,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  res.json(list)
})

app.post('/api/receipts', async (req, res) => {
  const { name, items } = req.body
  const rid = nextId('_rid')
  const receipt = {
    id:         rid,
    name:       name || null,
    paid:       0,
    created_at: new Date().toISOString(),
    items:      (items || []).map(item => ({
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
  if (req.body.name !== undefined) receipt.name = req.body.name
  if (req.body.paid !== undefined) receipt.paid = req.body.paid ? 1 : 0
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

// ─── Stats ────────────────────────────────────────────────────────────────────

app.get('/api/stats', (_req, res) => {
  const receipts = db.data.receipts
  const todayStr = new Date().toDateString()

  let totalRevenue = 0, paidRevenue = 0, todayRevenue = 0
  const productMap = {}
  const hourMap    = {}
  const dayMap     = {}

  receipts.forEach(r => {
    const rTotal = (r.items || []).reduce((s, i) => s + i.product_price * i.quantity, 0)
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
      if (!productMap[i.product_name]) {
        productMap[i.product_name] = { name: i.product_name, quantity: 0, revenue: 0 }
      }
      productMap[i.product_name].quantity += i.quantity
      productMap[i.product_name].revenue  += i.product_price * i.quantity
    })
  })

  const paidCount   = receipts.filter(r => r.paid).length
  const unpaidCount = receipts.length - paidCount

  // Revenue by hour (today, only hours that have data)
  const revenueByHour = []
  for (let h = 0; h < 24; h++) {
    if (hourMap[h] != null) {
      revenueByHour.push({ hour: `${String(h).padStart(2, '0')}:00`, revenue: Math.round(hourMap[h] * 100) / 100 })
    }
  }

  // Revenue by day (last 30 days that have data)
  const revenueByDay = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([day, revenue]) => {
      const d     = new Date(day)
      const label = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
      return { day: label, revenue: Math.round(revenue * 100) / 100 }
    })

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map(p => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))

  res.json({
    totalRevenue:    Math.round(totalRevenue * 100) / 100,
    paidRevenue:     Math.round(paidRevenue  * 100) / 100,
    unpaidRevenue:   Math.round((totalRevenue - paidRevenue) * 100) / 100,
    todayRevenue:    Math.round(todayRevenue  * 100) / 100,
    receiptCount:    receipts.length,
    paidCount,
    unpaidCount,
    avgReceiptValue: receipts.length ? Math.round(totalRevenue / receipts.length * 100) / 100 : 0,
    topProducts,
    revenueByHour,
    revenueByDay,
    multiDay: Object.keys(dayMap).length > 1,
  })
})

// ─── SPA fallback ─────────────────────────────────────────────────────────────

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🏕️  Kassa draait op http://localhost:${PORT}`)
})
