import 'dotenv/config'
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import bcrypt from 'bcryptjs'
import Stripe from 'stripe'
import nodemailer from 'nodemailer'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app  = express()
const PORT = 3001

const stripe                = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null
const TICKD_ADMIN_KEY       = process.env.TICKD_ADMIN_KEY || null

// ─── E-mail ───────────────────────────────────────────────────────────────────
const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null

const MAIL_FROM = process.env.MAIL_FROM || 'Tickd <noreply@tickd.nl>'
const APP_URL   = process.env.APP_URL   || 'http://localhost:5173'

function emailHtml(title, bodyHtml) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Inter,Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
  <div style="margin-bottom:24px">
    <span style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px">Tick<span style="color:#16a34a">d</span></span>
  </div>
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0">
  <p style="font-size:12px;color:#94a3b8;margin:0">Je ontvangt dit bericht omdat je een Tickd account hebt. <a href="${APP_URL}" style="color:#16a34a">tickd.nl</a></p>
</div></body></html>`
}

async function sendMail(to, subject, bodyHtml) {
  if (!mailer || !to) return
  try {
    await mailer.sendMail({ from: MAIL_FROM, to, subject, html: emailHtml(subject, bodyHtml) })
  } catch (err) {
    console.error('[mail] Verzenden mislukt:', err.message)
  }
}

// Welkomstmail
function sendWelcomeMail(account) {
  return sendMail(account.email, 'Welkom bij Tickd!', `
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px">Welkom, ${account.name}!</h1>
    <p style="color:#475569;line-height:1.6">Je account is aangemaakt. Je hebt <strong>14 dagen gratis</strong> toegang tot alle functies.</p>
    <a href="${APP_URL}" style="display:inline-block;margin:20px 0;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Open Tickd →</a>
    <p style="color:#94a3b8;font-size:13px">Na je proefperiode kun je kiezen voor een abonnement om door te gaan.</p>
  `)
}

// Betaalbevestiging
function sendPaymentConfirmMail(account) {
  return sendMail(account.email, 'Betaling ontvangen — Tickd Pro actief', `
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px">Betaling bevestigd ✓</h1>
    <p style="color:#475569;line-height:1.6">Bedankt! Je <strong>Tickd Pro</strong> abonnement is nu actief voor <em>${account.name}</em>.</p>
    <a href="${APP_URL}" style="display:inline-block;margin:20px 0;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Open Tickd →</a>
  `)
}

// Opzegging
function sendCancellationMail(account) {
  return sendMail(account.email, 'Abonnement opgezegd', `
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px">Abonnement opgezegd</h1>
    <p style="color:#475569;line-height:1.6">Je Tickd abonnement voor <em>${account.name}</em> is opgezegd. Je data blijft 30 dagen bewaard.</p>
    <a href="${APP_URL}?checkout=reactivate" style="display:inline-block;margin:20px 0;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Opnieuw activeren →</a>
  `)
}

// Trial verloop herinnering
function sendTrialReminderMail(account, daysLeft) {
  return sendMail(account.email, `Nog ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagen'} — vernieuw je Tickd abonnement`, `
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px">Je proefperiode verloopt bijna</h1>
    <p style="color:#475569;line-height:1.6">De gratis proefperiode van <em>${account.name}</em> verloopt over <strong>${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagen'}</strong>.</p>
    <p style="color:#475569;line-height:1.6">Upgrade naar Pro om onbeperkt door te gaan.</p>
    <a href="${APP_URL}" style="display:inline-block;margin:20px 0;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Upgrade naar Pro →</a>
  `)
}

// Dagelijkse check voor verlopen trials
async function checkTrialExpirations() {
  const now = Date.now()
  for (const account of db.data.accounts || []) {
    if (account.subscription_status !== 'trial' || !account.trial_ends_at || !account.email) continue
    const msLeft = new Date(account.trial_ends_at) - now
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
    if (daysLeft === 7 && !account.trial_reminder_7d_sent) {
      await sendTrialReminderMail(account, 7)
      account.trial_reminder_7d_sent = true
      await db.write()
    } else if (daysLeft === 1 && !account.trial_reminder_1d_sent) {
      await sendTrialReminderMail(account, 1)
      account.trial_reminder_1d_sent = true
      await db.write()
    }
  }
}
setInterval(checkTrialExpirations, 24 * 60 * 60 * 1000)

// ─── Database ─────────────────────────────────────────────────────────────────
const DEFAULT_ACCOUNT_ID = 1

const adapter = new JSONFile(join(__dirname, 'kassa.json'))
const db = new Low(adapter, {
  products: [], receipts: [], sessions: {}, settings: {}, inkoop: [], kas: [], employees: [],
  ingredients: [], donaties: [], accounts: [], subscriptions: [], accountSettings: {},
  _pid: 0, _rid: 0, _iid: 0, _bid: 0, _kid: 0, _eid: 0, _ingid: 0, _did: 0, _acid: 0, _scid: 0,
})
await db.read()

function nextId(key) {
  db.data[key] = (db.data[key] || 0) + 1
  return db.data[key]
}

function generateSlug(name, id) {
  const base = name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').slice(0, 24)
  return `${base}-${id}`
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

// Migrate: assign sort_order to products that don't have one
if (db.data.products.some(p => p.sort_order === undefined)) {
  db.data.products.forEach((p, idx) => { if (p.sort_order === undefined) p.sort_order = idx })
  await db.write()
}

// Migrate: ensure all products have available field
if (db.data.products.some(p => p.available === undefined)) {
  db.data.products.forEach(p => { if (p.available === undefined) p.available = true })
  await db.write()
}

// Migrate: create default account for existing single-tenant installations
if (!db.data.accounts) db.data.accounts = []
if (!db.data.subscriptions) db.data.subscriptions = []
if (db.data.accounts.length === 0) {
  db.data.accounts.push({
    id: DEFAULT_ACCOUNT_ID,
    name: 'Standaard organisatie',
    email: null,
    password_hash: null,
    created_at: new Date().toISOString(),
    subscription_status: 'active',
    trial_ends_at: null,
    stripe_customer_id: null,
  })
  db.data._acid = DEFAULT_ACCOUNT_ID
  await db.write()
}

// Migrate: flat settings → per-account (accountSettings)
if (!db.data.accountSettings) db.data.accountSettings = {}
if (db.data.settings && typeof db.data.settings === 'object' && Object.keys(db.data.settings).length > 0 && !db.data.accountSettings[DEFAULT_ACCOUNT_ID]) {
  db.data.accountSettings[DEFAULT_ACCOUNT_ID] = db.data.settings
  db.data.settings = {}
  await db.write()
}

// Migrate: add slug to accounts without one
if (db.data.accounts.some(a => !a.slug)) {
  db.data.accounts.forEach(a => { if (!a.slug) a.slug = generateSlug(a.name, a.id) })
  await db.write()
}

// Migrate: add account_id to all existing records
const MIGRATE_COLLECTIONS = ['products','receipts','inkoop','kas','donaties','employees','ingredients']
let didMigrate = false
MIGRATE_COLLECTIONS.forEach(col => {
  ;(db.data[col] || []).forEach(item => {
    if (item.account_id === undefined) { item.account_id = DEFAULT_ACCOUNT_ID; didMigrate = true }
  })
})
if (didMigrate) await db.write()

// Sessions: Map<token, { role, employeeId?, employeeName?, accountId }>
// Backwards compat: old sessions stored as plain string role; inject accountId for existing sessions
const sessions = new Map(
  Object.entries(db.data.sessions).map(([tok, data]) => {
    const session = typeof data === 'string' ? { role: data } : data
    if (!session.accountId) session.accountId = DEFAULT_ACCOUNT_ID
    return [tok, session]
  })
)

async function saveSession(token, data) {
  sessions.set(token, data)
  db.data.sessions = Object.fromEntries(sessions)
  await db.write()
}

async function deleteSession(token) {
  sessions.delete(token)
  db.data.sessions = Object.fromEntries(sessions)
  await db.write()
}

// ─── Klantenscherm display state + SSE ───────────────────────────────────────
let displayState = { active: false, updatedAt: null }
const sseClients = new Set()

function getDisplayPayload() {
  const data = { ...displayState }
  if (data.updatedAt && Date.now() - new Date(data.updatedAt).getTime() > 10 * 60 * 1000) {
    data.active = false
  }
  return {
    ...data,
    settings: data.embeddedSettings || {
      logoDataUrl: null,
      paymentUrl:  SETTING_DEFAULTS.paymentUrl,
      paymentName: SETTING_DEFAULTS.paymentName,
    },
  }
}

function broadcastDisplay() {
  const payload = `data: ${JSON.stringify(getDisplayPayload())}\n\n`
  for (const client of sseClients) {
    try { client.write(payload) } catch { sseClients.delete(client) }
  }
}

// Auto-broadcast als een receipt dat op het klantenscherm staat wijzigt
function autoUpdateDisplay(receiptId) {
  if (!displayState.active || displayState.id !== receiptId) return
  const receipt = db.data.receipts.find(r => r.id === receiptId)
  if (!receipt) return
  const sub  = (receipt.items || []).reduce((s, i) => s + i.product_price * i.quantity, 0)
  const disc = sub * (receipt.discount_pct || 0) / 100
  const tot  = sub - disc
  const don  = receipt.donation || 0
  displayState = {
    ...displayState,
    name:         receipt.name,
    items:        (receipt.items || []).map(i => ({
      name: i.product_name, qty: i.quantity,
      price: i.product_price, subtotal: i.product_price * i.quantity,
    })),
    subtotal:     sub, discount_pct: receipt.discount_pct || 0, discount_amt: disc,
    total:        tot, donation:     don,  total_due:    tot + don,
    paid:         !!receipt.paid,
    updatedAt:    new Date().toISOString(),
  }
  broadcastDisplay()
}

// SSE endpoint — geen auth, klantenscherm heeft geen token
app.get('/display-events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  sseClients.add(res)

  // Stuur huidige staat direct bij verbinding
  res.write(`data: ${JSON.stringify(getDisplayPayload())}\n\n`)

  // Ping elke 20s om verbinding levend te houden
  const ping = setInterval(() => {
    try { res.write(': ping\n\n') } catch { clearInterval(ping); sseClients.delete(res) }
  }, 20000)

  req.on('close', () => { clearInterval(ping); sseClients.delete(res) })
})

// Fallback polling endpoint (blijft bestaan voor backwards compat)
app.get('/display-data', (_req, res) => {
  res.json(getDisplayPayload())
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcTotal(items, discount_pct) {
  const base = (items || []).reduce((s, i) => s + i.product_price * i.quantity, 0)
  return base * (1 - (discount_pct || 0) / 100)
}

const SETTING_DEFAULTS = {
  paymentUrl:  '',
  paymentName: '',
}

function getSettings(accountId) {
  return { ...SETTING_DEFAULTS, ...(db.data.accountSettings?.[accountId] || {}) }
}
async function saveSettings(accountId, patch) {
  if (!db.data.accountSettings) db.data.accountSettings = {}
  db.data.accountSettings[accountId] = { ...(db.data.accountSettings[accountId] || {}), ...patch }
  await db.write()
}

// ─── Stripe webhook (raw body — MUST be before express.json()) ────────────────
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET)
    return res.status(503).json({ error: 'Stripe webhook niet geconfigureerd' })

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).json({ error: `Webhook verificatie mislukt: ${err.message}` })
  }

  const obj = event.data.object

  if (event.type === 'checkout.session.completed') {
    const accountId = parseInt(obj.metadata?.account_id)
    const account = (db.data.accounts || []).find(a => a.id === accountId)
    if (account && obj.subscription) {
      account.subscription_status = 'active'
      if (!db.data.subscriptions) db.data.subscriptions = []
      db.data.subscriptions.push({
        id: nextId('_scid'),
        account_id: accountId,
        plan: obj.metadata?.plan || 'pro',
        stripe_subscription_id: obj.subscription,
        stripe_customer_id: obj.customer,
        start_datum: new Date().toISOString(),
        eind_datum: null,
        created_at: new Date().toISOString(),
      })
      await db.write()
      sendPaymentConfirmMail(account)
    }
  } else if (event.type === 'invoice.paid') {
    if (obj.subscription) {
      const sub = (db.data.subscriptions || []).find(s => s.stripe_subscription_id === obj.subscription)
      if (sub) {
        const account = (db.data.accounts || []).find(a => a.id === sub.account_id)
        if (account) { account.subscription_status = 'active'; await db.write() }
      }
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = (db.data.subscriptions || []).find(s => s.stripe_subscription_id === obj.id)
    if (sub) {
      const account = (db.data.accounts || []).find(a => a.id === sub.account_id)
      if (account) { account.subscription_status = 'cancelled'; sendCancellationMail(account) }
      sub.eind_datum = new Date().toISOString()
      await db.write()
    }
  } else if (event.type === 'customer.subscription.updated') {
    const sub = (db.data.subscriptions || []).find(s => s.stripe_subscription_id === obj.id)
    if (sub) {
      const account = (db.data.accounts || []).find(a => a.id === sub.account_id)
      if (account) {
        account.subscription_status =
          obj.status === 'active'   ? 'active' :
          obj.status === 'trialing' ? 'trial'  : 'expired'
        await db.write()
      }
    }
  }

  res.json({ received: true })
})

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.static(join(__dirname, 'dist')))

// ─── Auth endpoints (no token required) ──────────────────────────────────────

app.post('/api/auth/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) await deleteSession(token)
  res.json({ ok: true })
})

// ─── Account registratie ─────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!name?.trim() || !email?.trim() || !password)
    return res.status(400).json({ error: 'Naam, e-mail en wachtwoord zijn verplicht' })
  if (password.length < 8)
    return res.status(400).json({ error: 'Wachtwoord moet minimaal 8 tekens zijn' })

  const emailLower = email.trim().toLowerCase()
  if ((db.data.accounts || []).some(a => a.email === emailLower))
    return res.status(400).json({ error: 'E-mailadres is al in gebruik' })

  const password_hash = await bcrypt.hash(password, 12)
  if (!db.data.accounts) db.data.accounts = []
  const account = {
    id:                 nextId('_acid'),
    name:               name.trim(),
    email:              emailLower,
    password_hash,
    created_at:         new Date().toISOString(),
    subscription_status: 'trial',
    trial_ends_at:      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    stripe_customer_id: null,
  }
  account.slug = generateSlug(account.name, account.id)
  db.data.accounts.push(account)
  await db.write()

  const token = randomUUID()
  await saveSession(token, { role: 'admin', accountId: account.id })

  const { password_hash: _, ...safeAccount } = account
  sendWelcomeMail(account)
  res.status(201).json({ token, role: 'admin', account: safeAccount })
})

// ─── E-mail login ─────────────────────────────────────────────────────────────

app.post('/api/auth/email-login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'E-mail en wachtwoord zijn verplicht' })

  const account = (db.data.accounts || []).find(a => a.email === email.trim().toLowerCase())
  if (!account?.password_hash) return res.status(401).json({ error: 'Onjuiste inloggegevens' })

  const valid = await bcrypt.compare(password, account.password_hash)
  if (!valid) return res.status(401).json({ error: 'Onjuiste inloggegevens' })

  const token = randomUUID()
  await saveSession(token, { role: 'admin', accountId: account.id })

  const { password_hash: _, ...safeAccount } = account
  res.json({ token, role: 'admin', account: safeAccount })
})

// ─── Intern admin API (eigen key-auth, vóór de algemene auth middleware) ──────

function requireAdminKey(req, res, next) {
  if (!TICKD_ADMIN_KEY) return res.status(503).json({ error: 'Admin API niet geconfigureerd' })
  const key = req.headers['x-admin-key'] || req.query.key
  if (key !== TICKD_ADMIN_KEY) return res.status(401).json({ error: 'Ongeldige admin key' })
  next()
}

app.get('/api/admin/accounts', requireAdminKey, (req, res) => {
  const accounts = (db.data.accounts || []).map(({ password_hash: _, ...a }) => ({
    ...a,
    usage: {
      receipts:  (db.data.receipts  || []).filter(r => r.account_id === a.id).length,
      employees: (db.data.employees || []).filter(e => e.account_id === a.id && e.active !== false).length,
    },
  }))
  res.json(accounts)
})

app.put('/api/admin/accounts/:id', requireAdminKey, async (req, res) => {
  const id = parseInt(req.params.id)
  const account = (db.data.accounts || []).find(a => a.id === id)
  if (!account) return res.status(404).json({ error: 'Niet gevonden' })
  if (req.body.subscription_status !== undefined) account.subscription_status = req.body.subscription_status
  if (req.body.trial_ends_at       !== undefined) account.trial_ends_at       = req.body.trial_ends_at
  await db.write()
  const { password_hash: _, ...safe } = account
  res.json(safe)
})

// ─── Auth middleware ──────────────────────────────────────────────────────────
app.use('/api', (req, res, next) => {
  const token   = req.headers.authorization?.split(' ')[1]
  const session = token ? sessions.get(token) : null
  if (!session) return res.status(401).json({ error: 'Niet ingelogd' })
  req.role         = session.role
  req.employeeId   = session.employeeId   || null
  req.employeeName = session.employeeName || null
  req.accountId    = session.accountId    || DEFAULT_ACCOUNT_ID
  next()
})

function requireAdmin(req, res, next) {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Geen toegang' })
  next()
}

function requireActiveSubscription(req, res, next) {
  const account = (db.data.accounts || []).find(a => a.id === req.accountId)
  if (!account) return res.status(403).json({ error: 'Account niet gevonden' })
  // Auto-expire trial
  if (account.subscription_status === 'trial' && account.trial_ends_at) {
    if (new Date() > new Date(account.trial_ends_at)) {
      account.subscription_status = 'expired'
      db.write()
    }
  }
  const status = account.subscription_status
  if (status === 'active' || status === 'trial') return next()
  return res.status(402).json({ error: 'Abonnement verlopen of niet actief', subscription_status: status })
}

// ─── Display endpoints (require auth via middleware) ─────────────────────────

app.put('/api/display', async (req, res) => {
  const s = getSettings(req.accountId)
  displayState = {
    ...req.body,
    updatedAt: new Date().toISOString(),
    embeddedSettings: { logoDataUrl: s.logoDataUrl || null, paymentUrl: s.paymentUrl, paymentName: s.paymentName },
  }
  broadcastDisplay()
  res.json(displayState)
})

app.delete('/api/display', async (req, res) => {
  displayState = { active: false, updatedAt: null }
  broadcastDisplay()
  res.json({ ok: true })
})

// ─── Backup & Restore ─────────────────────────────────────────────────────────

const BACKUP_COLLECTIONS = ['products','receipts','inkoop','kas','donaties','employees','ingredients']

app.get('/api/backup', requireAdmin, (req, res) => {
  const aid = req.accountId
  const backup = { exported_at: new Date().toISOString() }
  BACKUP_COLLECTIONS.forEach(col => {
    backup[col] = (db.data[col] || []).filter(r => r.account_id === aid)
  })
  backup.settings = db.data.accountSettings?.[aid] || {}
  res.json(backup)
})

app.post('/api/restore', requireAdmin, async (req, res) => {
  const data = req.body
  if (!Array.isArray(data.products) || !Array.isArray(data.receipts))
    return res.status(400).json({ error: 'Ongeldig backup bestand' })

  const aid = req.accountId

  // Verwijder huidige accountdata
  BACKUP_COLLECTIONS.forEach(col => {
    if (db.data[col]) db.data[col] = db.data[col].filter(r => r.account_id !== aid)
  })

  // Importeer backup met dit account_id
  BACKUP_COLLECTIONS.forEach(col => {
    if (Array.isArray(data[col])) {
      data[col].forEach(r => db.data[col].push({ ...r, account_id: aid }))
    }
  })

  // Instellingen terugzetten
  if (data.settings && typeof data.settings === 'object') {
    if (!db.data.accountSettings) db.data.accountSettings = {}
    db.data.accountSettings[aid] = data.settings
  }

  await db.write()
  res.json({ ok: true })
})

// ─── Account info ─────────────────────────────────────────────────────────────

app.get('/api/accounts/me', (req, res) => {
  const account = (db.data.accounts || []).find(a => a.id === req.accountId)
  if (!account) return res.status(404).json({ error: 'Account niet gevonden' })
  const { password_hash: _, ...safeAccount } = account
  const subscription = (db.data.subscriptions || [])
    .filter(s => s.account_id === account.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null
  const usage = {
    receipts:  (db.data.receipts  || []).filter(r => r.account_id === req.accountId).length,
    employees: (db.data.employees || []).filter(e => e.account_id === req.accountId && e.active !== false).length,
  }
  res.json({ ...safeAccount, subscription, usage })
})

// ─── GDPR: account verwijderen ────────────────────────────────────────────────

app.delete('/api/accounts/me', requireAdmin, async (req, res) => {
  const aid = req.accountId
  // Verwijder alle data van dit account
  BACKUP_COLLECTIONS.forEach(col => {
    if (db.data[col]) db.data[col] = db.data[col].filter(r => r.account_id !== aid)
  })
  if (db.data.accountSettings) delete db.data.accountSettings[aid]
  db.data.accounts = db.data.accounts.filter(a => a.id !== aid)
  // Invalideer sessies van dit account
  for (const [tok, s] of sessions) {
    if (s.accountId === aid) sessions.delete(tok)
  }
  db.data.sessions = Object.fromEntries(sessions)
  await db.write()
  res.json({ ok: true })
})


// ─── Stripe: checkout & portal ────────────────────────────────────────────────

app.post('/api/stripe/create-checkout', requireAdmin, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe niet geconfigureerd' })
  const account = (db.data.accounts || []).find(a => a.id === req.accountId)
  if (!account) return res.status(404).json({ error: 'Account niet gevonden' })

  const plan    = req.body.plan || 'pro'
  const priceId = process.env[`STRIPE_PRICE_ID_${plan.toUpperCase()}`] || process.env.STRIPE_PRICE_ID
  if (!priceId) return res.status(400).json({ error: 'Geen Stripe price ID geconfigureerd voor dit plan' })

  let customerId = account.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: account.email,
      name:  account.name,
      metadata: { account_id: String(account.id) },
    })
    customerId = customer.id
    account.stripe_customer_id = customerId
    await db.write()
  }

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    payment_method_types: ['card'],
    line_items:           [{ price: priceId, quantity: 1 }],
    mode:                 'subscription',
    success_url:          req.body.success_url || `${req.headers.origin}/?checkout=success`,
    cancel_url:           req.body.cancel_url  || `${req.headers.origin}/?checkout=cancelled`,
    metadata:             { account_id: String(account.id), plan },
  })
  res.json({ url: session.url })
})

app.post('/api/stripe/portal', requireAdmin, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe niet geconfigureerd' })
  const account = (db.data.accounts || []).find(a => a.id === req.accountId)
  if (!account?.stripe_customer_id) return res.status(400).json({ error: 'Geen Stripe klant gevonden' })

  const session = await stripe.billingPortal.sessions.create({
    customer:   account.stripe_customer_id,
    return_url: req.body.return_url || `${req.headers.origin}/`,
  })
  res.json({ url: session.url })
})

// ─── Products ─────────────────────────────────────────────────────────────────

app.get('/api/products', (req, res) => {
  res.json([...db.data.products].filter(p => p.account_id === req.accountId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
})

app.get('/api/products/popular', (req, res) => {
  const counts = {}
  db.data.receipts.filter(r => r.account_id === req.accountId).forEach(r => {
    ;(r.items || []).forEach(i => {
      counts[i.product_id] = (counts[i.product_id] || 0) + i.quantity
    })
  })
  const popular = db.data.products
    .filter(p => p.account_id === req.accountId)
    .map(p => ({ ...p, orderCount: counts[p.id] || 0 }))
    .filter(p => p.orderCount > 0)
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 6)
  res.json(popular)
})

app.post('/api/products', requireAdmin, async (req, res) => {
  const { name, price, category } = req.body
  if (!name || price === undefined) return res.status(400).json({ error: 'Name and price required' })
  const maxOrder = db.data.products.reduce((m, p) => Math.max(m, p.sort_order ?? -1), -1)
  const product = {
    id: nextId('_pid'), name,
    price:      parseFloat(price),
    cost_price: req.body.cost_price != null ? parseFloat(req.body.cost_price) : null,
    category:   category || 'overig',
    available:  true,
    sort_order: maxOrder + 1,
    account_id: req.accountId,
    created_at: new Date().toISOString(),
  }
  db.data.products.push(product)
  await db.write()
  res.json(product)
})

app.put('/api/products/reorder', requireAdmin, async (req, res) => {
  const { order } = req.body
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order required' })
  order.forEach((id, idx) => {
    const p = db.data.products.find(p => p.id === id && p.account_id === req.accountId)
    if (p) p.sort_order = idx
  })
  await db.write()
  res.json({ ok: true })
})

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  const p = db.data.products.find(p => p.id === id && p.account_id === req.accountId)
  if (!p) return res.status(404).json({ error: 'Not found' })
  if (req.body.name      !== undefined) p.name      = req.body.name
  if (req.body.price     !== undefined) p.price     = parseFloat(req.body.price)
  if (req.body.category  !== undefined) p.category  = req.body.category || 'overig'
  if (req.body.available  !== undefined) p.available  = req.body.available !== false
  if (req.body.cost_price !== undefined) p.cost_price = req.body.cost_price != null ? parseFloat(req.body.cost_price) : null
  if (req.body.recipe     !== undefined) p.recipe     = req.body.recipe || []
  await db.write()
  res.json(p)
})

// ─── Ingrediënten ─────────────────────────────────────────────────────────────

app.get('/api/ingredients', requireAdmin, (req, res) => {
  res.json((db.data.ingredients || []).filter(i => i.account_id === req.accountId))
})

app.post('/api/ingredients', requireAdmin, async (req, res) => {
  const { name, unit } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  if (!db.data.ingredients) db.data.ingredients = []
  const ing = { id: nextId('_ingid'), name: name.trim(), unit: (unit || 'stuks').trim(), account_id: req.accountId }
  db.data.ingredients.push(ing)
  await db.write()
  res.json(ing)
})

app.put('/api/ingredients/:id', requireAdmin, async (req, res) => {
  const ing = (db.data.ingredients || []).find(i => i.id === parseInt(req.params.id) && i.account_id === req.accountId)
  if (!ing) return res.status(404).json({ error: 'Not found' })
  if (req.body.name !== undefined) ing.name = req.body.name.trim()
  if (req.body.unit !== undefined) ing.unit = req.body.unit.trim()
  await db.write()
  res.json(ing)
})

app.delete('/api/ingredients/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  db.data.ingredients = (db.data.ingredients || []).filter(i => !(i.id === id && i.account_id === req.accountId))
  // Verwijder uit recepten van dit account
  db.data.products.filter(p => p.account_id === req.accountId).forEach(p => {
    if (p.recipe) p.recipe = p.recipe.filter(r => r.ingredient_id !== id)
  })
  await db.write()
  res.json({ ok: true })
})

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  db.data.products = db.data.products.filter(p => !(p.id === id && p.account_id === req.accountId))
  await db.write()
  res.json({ ok: true })
})

// ─── Receipts ─────────────────────────────────────────────────────────────────

app.get('/api/receipts', (req, res) => {
  const list = db.data.receipts
    .filter(r => r.account_id === req.accountId)
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
    created_by:   req.employeeName || null,
    paid:         0,
    discount_pct: 0,
    donation:     0,
    account_id:   req.accountId,
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
  const receipt = db.data.receipts.find(r => r.id === id && r.account_id === req.accountId)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  res.json(receipt)
})

app.put('/api/receipts/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const receipt = db.data.receipts.find(r => r.id === id && r.account_id === req.accountId)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  if (req.body.name         !== undefined) receipt.name         = req.body.name
  if (req.body.note         !== undefined) receipt.note         = req.body.note || null
  if (req.body.paid           !== undefined) receipt.paid           = req.body.paid ? 1 : 0
  if (req.body.discount_pct  !== undefined) receipt.discount_pct  = parseFloat(req.body.discount_pct) || 0
  if (req.body.donation      !== undefined) receipt.donation      = parseFloat(req.body.donation) || 0
  if (req.body.payment_method !== undefined) receipt.payment_method = req.body.payment_method || null
  if (req.body.payments       !== undefined) receipt.payments       = req.body.payments || []
  await db.write()
  autoUpdateDisplay(receipt.id)
  const { items, ...rest } = receipt
  res.json(rest)
})

app.delete('/api/receipts/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  db.data.receipts = db.data.receipts.filter(r => !(r.id === id && r.account_id === req.accountId))
  await db.write()
  res.json({ ok: true })
})

// Bulk update receipts (mark multiple as paid/unpaid)
app.post('/api/receipts/bulk', async (req, res) => {
  const { ids, paid } = req.body
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' })
  ids.forEach(id => {
    const r = db.data.receipts.find(r => r.id === id && r.account_id === req.accountId)
    if (r) r.paid = paid ? 1 : 0
  })
  await db.write()
  res.json({ ok: true, count: ids.length })
})

// ─── Receipt items ─────────────────────────────────────────────────────────────

app.post('/api/receipts/:id/items', async (req, res) => {
  const receiptId = parseInt(req.params.id)
  const receipt   = db.data.receipts.find(r => r.id === receiptId && r.account_id === req.accountId)
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
  autoUpdateDisplay(receiptId)
  res.json(item)
})

app.put('/api/receipts/:id/items/:itemId', async (req, res) => {
  const receiptId = parseInt(req.params.id)
  const itemId    = parseInt(req.params.itemId)
  const receipt   = db.data.receipts.find(r => r.id === receiptId && r.account_id === req.accountId)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  const item = receipt.items.find(i => i.id === itemId)
  if (!item) return res.status(404).json({ error: 'Item not found' })
  item.quantity = req.body.quantity
  await db.write()
  autoUpdateDisplay(receiptId)
  res.json(item)
})

app.delete('/api/receipts/:id/items/:itemId', async (req, res) => {
  const receiptId = parseInt(req.params.id)
  const itemId    = parseInt(req.params.itemId)
  const receipt   = db.data.receipts.find(r => r.id === receiptId && r.account_id === req.accountId)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  receipt.items = receipt.items.filter(i => i.id !== itemId)
  await db.write()
  autoUpdateDisplay(receiptId)
  res.json({ ok: true })
})

// ─── Inkoop bonnetjes ─────────────────────────────────────────────────────────

app.get('/api/inkoop', requireAdmin, (req, res) => {
  const list = (db.data.inkoop || [])
    .filter(b => b.account_id === req.accountId)
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  res.json(list)
})

app.post('/api/inkoop', requireAdmin, async (req, res) => {
  const { description, amount, date, note, submitted_by } = req.body
  if (!description || amount === undefined) return res.status(400).json({ error: 'description and amount required' })
  if (!db.data.inkoop) db.data.inkoop = []
  const bon = {
    id:           nextId('_bid'),
    description,
    amount:       parseFloat(amount),
    date:         date || new Date().toISOString().slice(0, 10),
    note:         note || null,
    submitted_by: submitted_by || null,
    account_id:   req.accountId,
    created_at:   new Date().toISOString(),
  }
  db.data.inkoop.push(bon)
  await db.write()
  res.json(bon)
})

app.put('/api/inkoop/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  const bon = (db.data.inkoop || []).find(b => b.id === id && b.account_id === req.accountId)
  if (!bon) return res.status(404).json({ error: 'Not found' })
  if (req.body.description  !== undefined) bon.description  = req.body.description
  if (req.body.amount       !== undefined) bon.amount       = parseFloat(req.body.amount)
  if (req.body.date         !== undefined) bon.date         = req.body.date
  if (req.body.note         !== undefined) bon.note         = req.body.note || null
  if (req.body.submitted_by !== undefined) bon.submitted_by = req.body.submitted_by || null
  await db.write()
  res.json(bon)
})

app.delete('/api/inkoop/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  db.data.inkoop = (db.data.inkoop || []).filter(b => !(b.id === id && b.account_id === req.accountId))
  await db.write()
  res.json({ ok: true })
})

// ─── Losse donaties ───────────────────────────────────────────────────────────

app.get('/api/donaties', (req, res) => {
  const list = (db.data.donaties || [])
    .filter(d => d.account_id === req.accountId)
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  res.json(list)
})

app.post('/api/donaties', async (req, res) => {
  const { name, amount, date, note } = req.body
  if (amount === undefined) return res.status(400).json({ error: 'amount required' })
  if (!db.data.donaties) db.data.donaties = []
  if (!db.data._did) db.data._did = 0
  const donatie = {
    id:         nextId('_did'),
    name:       name?.trim() || null,
    amount:     parseFloat(amount),
    date:       date || new Date().toISOString().slice(0, 10),
    note:       note?.trim() || null,
    account_id: req.accountId,
    created_at: new Date().toISOString(),
  }
  db.data.donaties.push(donatie)
  await db.write()
  res.json(donatie)
})

app.put('/api/donaties/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const donatie = (db.data.donaties || []).find(d => d.id === id && d.account_id === req.accountId)
  if (!donatie) return res.status(404).json({ error: 'Not found' })
  if (req.body.name   !== undefined) donatie.name   = req.body.name?.trim() || null
  if (req.body.amount !== undefined) donatie.amount = parseFloat(req.body.amount)
  if (req.body.date   !== undefined) donatie.date   = req.body.date
  if (req.body.note   !== undefined) donatie.note   = req.body.note?.trim() || null
  await db.write()
  res.json(donatie)
})

app.delete('/api/donaties/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  db.data.donaties = (db.data.donaties || []).filter(d => !(d.id === id && d.account_id === req.accountId))
  await db.write()
  res.json({ ok: true })
})

// ─── Kasregistraties ──────────────────────────────────────────────────────────

app.get('/api/kas', requireAdmin, (req, res) => {
  res.json((db.data.kas || []).filter(k => k.account_id === req.accountId).sort((a, b) => b.datum.localeCompare(a.datum)))
})

app.post('/api/kas', requireAdmin, async (req, res) => {
  if (!db.data.kas) db.data.kas = []
  const datum = req.body.datum || new Date().toISOString().slice(0, 10)
  const existing = db.data.kas.find(k => k.datum === datum && k.account_id === req.accountId)
  if (existing) {
    if (req.body.begin_bedrag !== undefined) existing.begin_bedrag = parseFloat(req.body.begin_bedrag) || 0
    if (req.body.eind_bedrag  !== undefined) existing.eind_bedrag  = req.body.eind_bedrag !== null ? parseFloat(req.body.eind_bedrag) : null
    if (req.body.note         !== undefined) existing.note         = req.body.note || null
    await db.write()
    return res.json(existing)
  }
  const record = {
    id:           nextId('_kid'),
    datum,
    begin_bedrag: parseFloat(req.body.begin_bedrag) || 0,
    eind_bedrag:  null,
    note:         req.body.note || null,
    account_id:   req.accountId,
    created_at:   new Date().toISOString(),
  }
  db.data.kas.push(record)
  await db.write()
  res.json(record)
})

app.put('/api/kas/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  const record = (db.data.kas || []).find(k => k.id === id && k.account_id === req.accountId)
  if (!record) return res.status(404).json({ error: 'Not found' })
  if (req.body.begin_bedrag !== undefined) record.begin_bedrag = parseFloat(req.body.begin_bedrag) || 0
  if (req.body.eind_bedrag  !== undefined) record.eind_bedrag  = req.body.eind_bedrag !== null ? parseFloat(req.body.eind_bedrag) : null
  if (req.body.note         !== undefined) record.note         = req.body.note || null
  await db.write()
  res.json(record)
})

app.delete('/api/kas/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  db.data.kas = (db.data.kas || []).filter(k => !(k.id === id && k.account_id === req.accountId))
  await db.write()
  res.json({ ok: true })
})

app.post('/api/kas/:id/correcties', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  const record = (db.data.kas || []).find(k => k.id === id && k.account_id === req.accountId)
  if (!record) return res.status(404).json({ error: 'Not found' })
  if (!record.correcties) record.correcties = []
  const cid = Math.max(0, ...record.correcties.map(c => c.id)) + 1
  const corr = {
    id:          cid,
    type:        req.body.type || 'contant',
    amount:      parseFloat(req.body.amount) || 0,
    description: req.body.description || '',
    created_at:  new Date().toISOString(),
  }
  record.correcties.push(corr)
  await db.write()
  res.json(corr)
})

app.delete('/api/kas/:id/correcties/:cid', requireAdmin, async (req, res) => {
  const id  = parseInt(req.params.id)
  const cid = parseInt(req.params.cid)
  const record = (db.data.kas || []).find(k => k.id === id && k.account_id === req.accountId)
  if (!record) return res.status(404).json({ error: 'Not found' })
  record.correcties = (record.correcties || []).filter(c => c.id !== cid)
  await db.write()
  res.json({ ok: true })
})

// ─── Medewerkers ──────────────────────────────────────────────────────────────

app.get('/api/employees', requireAdmin, (req, res) => {
  res.json((db.data.employees || []).filter(e => e.account_id === req.accountId))
})

app.post('/api/employees', requireAdmin, async (req, res) => {
  const { name, pin } = req.body
  if (!name?.trim() || !pin) return res.status(400).json({ error: 'name en pin zijn verplicht' })
  if (!db.data.employees) db.data.employees = []
  const conflict = db.data.employees.some(e => e.account_id === req.accountId && e.active !== false && e.pin === pin)
  if (conflict) return res.status(400).json({ error: 'PIN is al in gebruik' })
  const emp = { id: nextId('_eid'), name: name.trim(), pin, active: true, account_id: req.accountId, created_at: new Date().toISOString() }
  db.data.employees.push(emp)
  await db.write()
  res.json(emp)
})

app.put('/api/employees/:id', requireAdmin, async (req, res) => {
  const id  = parseInt(req.params.id)
  const emp = (db.data.employees || []).find(e => e.id === id && e.account_id === req.accountId)
  if (!emp) return res.status(404).json({ error: 'Not found' })
  if (req.body.name   !== undefined) emp.name   = req.body.name.trim()
  if (req.body.active !== undefined) emp.active = req.body.active
  if (req.body.pin    !== undefined) {
    const conflict = db.data.employees.some(e => e.id !== id && e.account_id === req.accountId && e.active !== false && e.pin === req.body.pin)
    if (conflict) return res.status(400).json({ error: 'PIN is al in gebruik' })
    emp.pin = req.body.pin
  }
  await db.write()
  res.json(emp)
})

app.delete('/api/employees/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id)
  db.data.employees = (db.data.employees || []).filter(e => !(e.id === id && e.account_id === req.accountId))
  await db.write()
  res.json({ ok: true })
})

// ─── Keukenscherm ─────────────────────────────────────────────────────────────

app.get('/api/kitchen', (req, res) => {
  const today = new Date().toDateString()
  const orders = db.data.receipts
    .filter(r => r.account_id === req.accountId && !r.paid && !r.kitchen?.bumped && new Date(r.created_at).toDateString() === today)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  res.json(orders)
})

// Increment portie: 0 → 1 → … → qty → 0
app.patch('/api/kitchen/:id/items/:itemId', async (req, res) => {
  const id     = parseInt(req.params.id)
  const itemId = parseInt(req.params.itemId)
  const receipt = db.data.receipts.find(r => r.id === id && r.account_id === req.accountId)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  if (!receipt.kitchen) receipt.kitchen = { items_qty_done: {}, items_done: [], ready: false, ready_at: null }
  if (!receipt.kitchen.items_qty_done) receipt.kitchen.items_qty_done = {}

  const item    = (receipt.items || []).find(i => i.id === itemId)
  const maxQty  = item?.quantity || 1
  const current = receipt.kitchen.items_qty_done[itemId] || 0
  receipt.kitchen.items_qty_done[itemId] = current >= maxQty ? 0 : current + 1

  // Sync items_done voor backwards-compat
  receipt.kitchen.items_done = (receipt.items || [])
    .filter(i => (receipt.kitchen.items_qty_done[i.id] || 0) >= i.quantity)
    .map(i => i.id)

  const allDone = (receipt.items || []).every(i =>
    (receipt.kitchen.items_qty_done[i.id] || 0) >= i.quantity
  )
  receipt.kitchen.ready    = allDone
  receipt.kitchen.ready_at = allDone ? (receipt.kitchen.ready_at || new Date().toISOString()) : null

  await db.write()
  res.json(receipt.kitchen)
})

app.patch('/api/kitchen/:id/reset', async (req, res) => {
  const id = parseInt(req.params.id)
  const receipt = db.data.receipts.find(r => r.id === id && r.account_id === req.accountId)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  receipt.kitchen = { items_qty_done: {}, items_done: [], ready: false, ready_at: null }
  await db.write()
  res.json(receipt.kitchen)
})

// Bump: klaar-order van het keukenscherm verwijderen
app.patch('/api/kitchen/:id/bump', async (req, res) => {
  const id = parseInt(req.params.id)
  const receipt = db.data.receipts.find(r => r.id === id && r.account_id === req.accountId)
  if (!receipt) return res.status(404).json({ error: 'Not found' })
  if (!receipt.kitchen) receipt.kitchen = { items_qty_done: {}, items_done: [], ready: false, ready_at: null }
  receipt.kitchen.bumped    = true
  receipt.kitchen.bumped_at = new Date().toISOString()
  await db.write()
  res.json(receipt.kitchen)
})

// ─── Tafelindeling ────────────────────────────────────────────────────────────

app.get('/api/tafelindeling', (req, res) => {
  res.json(getSettings(req.accountId).tafelindeling || { cols: 6, rows: 4, tables: [] })
})

app.put('/api/tafelindeling', requireAdmin, async (req, res) => {
  await saveSettings(req.accountId, { tafelindeling: req.body })
  res.json(req.body)
})

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  res.json(getSettings(req.accountId))
})

app.put('/api/settings', requireAdmin, async (req, res) => {
  await saveSettings(req.accountId, req.body)
  res.json(getSettings(req.accountId))
})

// ─── Stats ────────────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  const todayStr     = new Date().toDateString()
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString()
  const filterToday     = req.query.period === 'today'
  const filterYesterday = req.query.period === 'yesterday'
  const filterDate      = req.query.period === 'date' && req.query.date ? req.query.date : null
  const filterDateStr   = filterDate ? new Date(filterDate + 'T12:00:00').toDateString() : null

  const accountReceipts = db.data.receipts.filter(r => r.account_id === req.accountId)
  const receipts = filterToday
    ? accountReceipts.filter(r => new Date(r.created_at).toDateString() === todayStr)
    : filterYesterday
      ? accountReceipts.filter(r => new Date(r.created_at).toDateString() === yesterdayStr)
      : filterDate
        ? accountReceipts.filter(r => new Date(r.created_at).toDateString() === filterDateStr)
        : accountReceipts

  let totalRevenue = 0, paidRevenue = 0, todayRevenue = 0, todayPaidRevenue = 0, totalDonations = 0, todayDonations = 0
  const productMap = {}, hourMap = {}, dayMap = {}
  const paymentBreakdown = { contant: 0, pin: 0, qr: 0, onbekend: 0 }
  const todayPaymentBreakdown = { contant: 0, pin: 0, qr: 0, onbekend: 0 }

  receipts.forEach(r => {
    const rTotal    = calcTotal(r.items, r.discount_pct)
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
        const method = r.payment_method || 'onbekend'
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + rTotal + rDonation
      }
    }

    const date    = new Date(r.created_at)
    const isToday = date.toDateString() === todayStr

    if (isToday) {
      todayRevenue     += rTotal + rDonation
      if (r.paid) {
        todayPaidRevenue += rTotal + rDonation
        if (r.payments?.length > 0) {
          r.payments.forEach(p => {
            const m = p.method || 'onbekend'
            todayPaymentBreakdown[m] = (todayPaymentBreakdown[m] || 0) + (p.amount || 0)
          })
        } else {
          const method = r.payment_method || 'onbekend'
          todayPaymentBreakdown[method] = (todayPaymentBreakdown[method] || 0) + rTotal + rDonation
        }
      }
      todayDonations  += rDonation
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
  let estimatedCosts = 0
  Object.entries(soldQtyMap).forEach(([pid, qty]) => {
    const prod = db.data.products.find(p => p.id === parseInt(pid) && p.account_id === req.accountId)
    if (prod?.cost_price) estimatedCosts += prod.cost_price * qty
  })

  const categoryMap = {}
  receipts.forEach(r => {
    ;(r.items || []).forEach(i => {
      const product = db.data.products.find(p => p.id === i.product_id && p.account_id === req.accountId)
      const cat = product?.category || 'overig'
      if (!categoryMap[cat]) categoryMap[cat] = { cat, quantity: 0, revenue: 0 }
      categoryMap[cat].quantity += i.quantity
      categoryMap[cat].revenue  += i.product_price * i.quantity
    })
  })
  const categoryStats = Object.values(categoryMap)
    .map(c => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)

  // ── Gisteren (altijd berekend, ongeacht period filter) ───────────────────
  let yesterdayRevenue = 0
  accountReceipts.forEach(r => {
    if (new Date(r.created_at).toDateString() === yesterdayStr)
      yesterdayRevenue += calcTotal(r.items, r.discount_pct) + (r.donation || 0)
  })
  ;(db.data.donaties || []).filter(d => d.account_id === req.accountId).forEach(d => {
    if (new Date(d.created_at).toDateString() === yesterdayStr)
      yesterdayRevenue += d.amount || 0
  })

  // ── Losse donaties ────────────────────────────────────────────────────────
  const allDonaties = (db.data.donaties || []).filter(d => d.account_id === req.accountId)
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
      todayRevenue      += amt
      todayPaidRevenue  += amt
      todayDonations    += amt
      const h = new Date(d.created_at).getHours()
      hourMap[h] = (hourMap[h] || 0) + amt
    }
    const dayKey = d.created_at.split('T')[0]
    dayMap[dayKey] = (dayMap[dayKey] || 0) + amt
  })

  // ── Inkoop / kosten ────────────────────────────────────────────────────────
  const allInkoop = (db.data.inkoop || []).filter(b => b.account_id === req.accountId)
  const inkoopFiltered = filterToday
    ? allInkoop.filter(b => new Date(b.created_at).toDateString() === todayStr)
    : filterYesterday
      ? allInkoop.filter(b => new Date(b.created_at).toDateString() === yesterdayStr)
      : filterDate
        ? allInkoop.filter(b => new Date(b.created_at).toDateString() === filterDateStr)
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
    paymentBreakdown:      Object.fromEntries(Object.entries(paymentBreakdown).map(([k,v]) => [k, Math.round(v * 100) / 100])),
    todayPaymentBreakdown: Object.fromEntries(Object.entries(todayPaymentBreakdown).map(([k,v]) => [k, Math.round(v * 100) / 100])),
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
  console.log(`🏕️  Kassa draait op http://localhost:${PORT}`)
})
