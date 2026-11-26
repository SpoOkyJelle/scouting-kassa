import 'dotenv/config'
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { computePromotions } from './src/promotions.js'
import { sendInviteEmail, mailerConfigured } from './src/mailer.js'
import { PLAN_IDS, DEFAULT_PLAN, planHasCapability } from './src/plans.js'
import { createReaderCheckout, getReaderCheckout } from './src/sumup.js'
import { db, scoped } from './db/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app  = express()
const PORT = 3001

// Behind Caddy/Nginx: trust the first proxy so req.ip reflects X-Forwarded-For
// (used by the rate limiter) and req.protocol respects X-Forwarded-Proto.
app.set('trust proxy', 1)

// Minimal in-memory rate limiter (per IP) for brute-force-sensitive endpoints.
function rateLimit({ windowMs, max }) {
  const hits = new Map()
  return (req, res, next) => {
    const now = Date.now()
    const key = req.ip || 'unknown'
    let rec = hits.get(key)
    if (!rec || now > rec.reset) { rec = { count: 0, reset: now + windowMs }; hits.set(key, rec) }
    rec.count++
    if (rec.count > max) {
      const retry = Math.ceil((rec.reset - now) / 1000)
      res.setHeader('Retry-After', String(retry))
      return res.status(429).json({ error: 'Te veel pogingen. Probeer het later opnieuw.' })
    }
    // Opportunistic cleanup so the map can't grow unbounded.
    if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k)
    next()
  }
}
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 })

// PIN fallback from env (used for account 1 until PINs are set per account).
const ADMIN_PIN   = process.env.PIN || null
const CASHIER_PIN = process.env.CASHIER_PIN || null

// Wrap async route handlers so rejections reach the error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// ─── Sessions (persisted to the DB, cached in memory) ──────────────────────────
// Survive restarts. In-memory cache avoids a DB hit on every request; the DB row
// is the source of truth. token → { accountId, role, userId, expiresAt }.
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000  // 7 days
const sessionCache = new Map()
const normRole = (r) => (r === 'owner' ? 'admin' : r)

async function createSession({ accountId, role, userId = null }) {
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL)
  await db('sessions').insert({
    token, user_id: userId, account_id: accountId, role, expires_at: expiresAt.toISOString(),
  })
  sessionCache.set(token, { accountId, role, userId, expiresAt })
  return token
}

async function getSession(token) {
  if (!token) return null
  let s = sessionCache.get(token)
  if (!s) {
    const row = await db('sessions').where({ token }).first()
    if (!row) return null
    s = { accountId: row.account_id, role: row.role, userId: row.user_id, expiresAt: new Date(row.expires_at) }
    sessionCache.set(token, s)
  }
  if (s.expiresAt.getTime() < Date.now()) { await deleteSession(token); return null }
  return s
}

async function deleteSession(token) {
  if (!token) return
  sessionCache.delete(token)
  await db('sessions').where({ token }).del().catch(() => {})
}

// ─── Settings (per account) ────────────────────────────────────────────────────
const SETTING_DEFAULTS = {
  // Betaalverzoek is leeg tot een account zelf een betaallink instelt.
  paymentUrl:  '',
  paymentName: '',
  sumupEnabled: false,
  sumupMerchantCode: '',
  sumupReaderId: '',
  sumupApiKey: '',   // secret — stripped from client responses by safeSettings
  categories: [
    { id: 'pannenkoeken', label: 'Pannenkoeken', icon: 'ChefHat', color: '#C77A1A' },
    { id: 'beleg',        label: 'Beleg',        icon: 'Layers',  color: '#5C8A3C' },
    { id: 'drinken',      label: 'Drinken',      icon: 'Coffee',  color: '#3C7A86' },
    { id: 'overig',       label: 'Overig',       icon: 'Tag',     color: '#8A8374' },
  ],
  promotions: [],
}

// Raw stored settings (no defaults merged) — use when persisting a delta.
async function getRawSettings(accountId) {
  const row = await db('settings').where({ account_id: accountId }).first()
  return row?.data || {}
}
async function getSettings(accountId) {
  return { ...SETTING_DEFAULTS, ...(await getRawSettings(accountId)) }
}
// Settings fields that may be overwritten by a restored backup. Everything else
// (sumupApiKey, adminPinHash, cashierPinHash, displayToken, …) is preserved from
// the account's current settings so a backup file can't inject or wipe secrets.
const SAFE_SETTING_KEYS = [
  'paymentUrl', 'paymentName', 'categories', 'promotions',
  'logoDataUrl', 'faviconDataUrl', 'sumupEnabled', 'sumupMerchantCode', 'sumupReaderId',
  'onboarded',
]

// Strip secrets before sending settings to the client (any session can read them).
function safeSettings(s) {
  const { adminPin, cashierPin, adminPinHash, cashierPinHash, displayToken, sumupApiKey, ...safe } = s
  // Expose whether a SumUp API key is configured, without leaking the key itself.
  safe.sumupApiKeySet = !!sumupApiKey
  return safe
}
// Store only the raw (non-default) object; defaults are merged on read.
async function saveSettings(accountId, data) {
  await db('settings')
    .insert({ account_id: accountId, data: JSON.stringify(data) })
    .onConflict('account_id')
    .merge()
}

async function firstAccountId() {
  const row = await db('accounts').orderBy('id').first()
  return row?.id ?? null
}

// The env PINs are a plaintext bootstrap for the very first account only (the
// original single-tenant till); other accounts set their own PIN in the UI.
async function envPinApplies(accountId) {
  return accountId === (await firstAccountId())
}
// PINs are stored hashed (adminPinHash / cashierPinHash). Returns the role the
// PIN unlocks ('admin' | 'cashier'), or null.
async function verifyPin(accountId, pin) {
  if (!pin) return null
  const raw = await getRawSettings(accountId)
  if (raw.adminPinHash   && bcrypt.compareSync(pin, raw.adminPinHash))   return 'admin'
  if (raw.cashierPinHash && bcrypt.compareSync(pin, raw.cashierPinHash)) return 'cashier'
  if (await envPinApplies(accountId)) {
    if (!raw.adminPinHash   && ADMIN_PIN   && pin === ADMIN_PIN)   return 'admin'
    if (!raw.cashierPinHash && CASHIER_PIN && pin === CASHIER_PIN) return 'cashier'
  }
  return null
}
// True when this account already has an admin PIN (its own, or the env bootstrap).
async function hasAdminPin(accountId) {
  const raw = await getRawSettings(accountId)
  if (raw.adminPinHash) return true
  return Boolean(ADMIN_PIN) && (await envPinApplies(accountId))
}

// ─── Promotions snapshot ───────────────────────────────────────────────────────
async function getProductCatMap(accountId) {
  const rows = await scoped(accountId).table('products').select('id', 'category')
  return Object.fromEntries(rows.map((p) => [p.id, p.category || 'overig']))
}

async function recomputePromo(accountId, receiptId) {
  const items = await scoped(accountId).table('receipt_items')
    .where({ receipt_id: receiptId })
    .select('product_id', 'product_name', 'product_price', 'quantity')
  const promotions = (await getSettings(accountId)).promotions || []
  const { discount, lines } = computePromotions(items, promotions, await getProductCatMap(accountId))
  await scoped(accountId).table('receipts').where({ id: receiptId })
    .update({ promo_discount: discount, promo_lines: JSON.stringify(lines) })
  return { promo_discount: discount, promo_lines: lines }
}

// ─── Receipt helpers ──────────────────────────────────────────────────────────
async function getReceiptWithItems(accountId, id) {
  const r = await scoped(accountId).table('receipts').where({ id }).first()
  if (!r) return null
  r.items = await scoped(accountId).table('receipt_items').where({ receipt_id: id }).orderBy('id')
  r.payments = r.payments || []
  r.promo_lines = r.promo_lines || []
  return r
}

async function getAllReceiptsWithItems(accountId) {
  const receipts = await scoped(accountId).table('receipts')
  const items    = await scoped(accountId).table('receipt_items')
  const byReceipt = {}
  for (const i of items) (byReceipt[i.receipt_id] ??= []).push(i)
  return receipts.map((r) => ({
    ...r,
    items: byReceipt[r.id] || [],
    payments: r.payments || [],
    promo_lines: r.promo_lines || [],
  }))
}

async function getKasWithCorrecties(accountId, id) {
  const k = await scoped(accountId).table('kas').where({ id }).first()
  if (!k) return null
  k.correcties = await scoped(accountId).table('kas_correcties').where({ kas_id: id }).orderBy('id')
  return k
}

function calcTotal(items, discount_pct, promo_discount) {
  const base       = (items || []).reduce((s, i) => s + i.product_price * i.quantity, 0)
  const afterPromo = Math.max(0, base - (promo_discount || 0))
  return afterPromo * (1 - (discount_pct || 0) / 100)
}

// ─── Customer display (per account) ─────────────────────────────────────────────
// Each account has its own live display state and SSE subscribers. The public
// /display page identifies the account via an opaque display token (stored in the
// account's settings) passed as ?token=… — no login needed on the display device.
const displayStates = new Map()  // accountId → state
const sseClients     = new Map()  // accountId → Set<res>

function getState(accountId) {
  return displayStates.get(accountId) || { active: false, updatedAt: null }
}
function clientsFor(accountId) {
  let set = sseClients.get(accountId)
  if (!set) { set = new Set(); sseClients.set(accountId, set) }
  return set
}

// Resolve a display token to its account id (token lives in settings.data.displayToken).
async function accountForDisplayToken(token) {
  if (!token) return null
  const rows = await db('settings').whereRaw("data->>'displayToken' = ?", [token]).select('account_id')
  return rows[0]?.account_id ?? null
}

// Get (or lazily create) the display token for an account.
async function ensureDisplayToken(accountId) {
  const raw = await getRawSettings(accountId)
  if (raw.displayToken) return raw.displayToken
  const token = randomUUID().replace(/-/g, '')
  await saveSettings(accountId, { ...raw, displayToken: token })
  return token
}

async function getDisplayPayload(accountId) {
  const data = { ...getState(accountId) }
  if (data.updatedAt && Date.now() - new Date(data.updatedAt).getTime() > 10 * 60 * 1000) data.active = false
  const s = accountId ? await getSettings(accountId) : SETTING_DEFAULTS
  return {
    ...data,
    settings: {
      logoDataUrl: s.logoDataUrl || null,
      paymentUrl:  s.paymentUrl  || '',
      paymentName: s.paymentName || '',
    },
  }
}

async function broadcastDisplay(accountId) {
  const payload = `data: ${JSON.stringify(await getDisplayPayload(accountId))}\n\n`
  for (const client of clientsFor(accountId)) {
    try { client.write(payload) } catch { clientsFor(accountId).delete(client) }
  }
}

async function autoUpdateDisplay(accountId, receiptId) {
  const state = getState(accountId)
  if (!state.active || state.id !== receiptId) return
  const r = await getReceiptWithItems(accountId, receiptId)
  if (!r) return
  const sub        = (r.items || []).reduce((s, i) => s + i.product_price * i.quantity, 0)
  const promo      = r.promo_discount || 0
  const afterPromo = Math.max(0, sub - promo)
  const disc = afterPromo * (r.discount_pct || 0) / 100
  const tot  = afterPromo - disc
  const don  = r.donation || 0
  displayStates.set(accountId, {
    ...state,
    name: r.name,
    items: r.items.map((i) => ({ name: i.product_name, qty: i.quantity, price: i.product_price, subtotal: i.product_price * i.quantity })),
    subtotal: sub, promo_discount: promo, promo_lines: r.promo_lines || [],
    discount_pct: r.discount_pct || 0, discount_amt: disc,
    total: tot, donation: don, total_due: tot + don, paid: !!r.paid,
    updatedAt: new Date().toISOString(),
  })
  await broadcastDisplay(accountId)
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.static(join(__dirname, 'dist')))

// ─── Public display endpoints (no auth; account via ?token=) ─────────────────────
app.get('/display-events', wrap(async (req, res) => {
  const accountId = await accountForDisplayToken(req.query.token)
  if (!accountId) return res.status(404).end()

  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const set = clientsFor(accountId)
  set.add(res)
  res.write(`data: ${JSON.stringify(await getDisplayPayload(accountId))}\n\n`)

  const ping = setInterval(() => {
    try { res.write(': ping\n\n') } catch { clearInterval(ping); set.delete(res) }
  }, 20000)
  req.on('close', () => { clearInterval(ping); set.delete(res) })
}))

app.get('/display-data', wrap(async (req, res) => {
  const accountId = await accountForDisplayToken(req.query.token)
  if (!accountId) return res.status(404).json({ error: 'Onbekende display' })
  res.json(await getDisplayPayload(accountId))
}))

// ─── Auth (public) ──────────────────────────────────────────────────────────────
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'account'
}

app.post('/api/auth/register', authLimiter, wrap(async (req, res) => {
  const { email, password, org, name } = req.body
  if (!email || !password || !org) return res.status(400).json({ error: 'email, password en org verplicht' })
  if (String(password).length < 6)  return res.status(400).json({ error: 'Wachtwoord minimaal 6 tekens' })
  const lower = String(email).toLowerCase()
  const existing = await db('users').whereRaw('lower(email) = ?', [lower]).first()
  if (existing) return res.status(409).json({ error: 'E-mailadres bestaat al' })

  const { account, user } = await db.transaction(async (trx) => {
    const [account] = await trx('accounts')
      .insert({ name: org, slug: `${slugify(org)}-${Date.now().toString(36)}` }).returning('*')
    const [user] = await trx('users')
      .insert({ email: lower, password_hash: bcrypt.hashSync(password, 10), name: name || null }).returning('*')
    await trx('memberships').insert({ user_id: user.id, account_id: account.id, role: 'owner' })
    return { account, user }
  })

  const token = await createSession({ accountId: account.id, role: 'admin', userId: user.id })
  res.json({ token, role: 'admin', account: { id: account.id, name: account.name } })
}))

app.post('/api/auth/login', authLimiter, wrap(async (req, res) => {
  const { pin, email, password } = req.body

  // Email + password (real accounts)
  if (email && password) {
    const user = await db('users').whereRaw('lower(email) = ?', [String(email).toLowerCase()]).first()
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Onjuiste inloggegevens' })
    const m = await db('memberships').where({ user_id: user.id }).orderBy('id').first()
    if (!m) return res.status(403).json({ error: 'Geen account gekoppeld' })
    const role  = normRole(m.role)
    const token = await createSession({ accountId: m.account_id, role, userId: user.id })
    return res.json({ token, role })
  }

  // PIN (quick till login → resolves to the first account for now)
  const acctId = await firstAccountId()
  if (acctId && pin) {
    const role = await verifyPin(acctId, pin)
    if (role) {
      const token = await createSession({ accountId: acctId, role, userId: null })
      return res.json({ token, role })
    }
  }
  res.status(401).json({ error: 'Verkeerde PIN' })
}))

app.post('/api/auth/logout', wrap(async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  await deleteSession(token)
  res.json({ ok: true })
}))

// ─── Invitations: public lookup + accept ────────────────────────────────────────
async function loadOpenInvite(token) {
  if (!token) return null
  const inv = await db('invitations').where({ token }).first()
  if (!inv || inv.accepted_at) return null
  if (new Date(inv.expires_at).getTime() < Date.now()) return null
  return inv
}

app.get('/api/auth/invite/:token', wrap(async (req, res) => {
  const inv = await loadOpenInvite(req.params.token)
  if (!inv) return res.status(404).json({ error: 'Uitnodiging ongeldig of verlopen' })
  const account = await db('accounts').where({ id: inv.account_id }).first()
  const user    = await db('users').whereRaw('lower(email) = ?', [inv.email]).first()
  res.json({
    email: inv.email,
    role: inv.role,
    account: { name: account?.name || '' },
    userExists: !!user,
  })
}))

app.post('/api/auth/accept', authLimiter, wrap(async (req, res) => {
  const { token, password, name } = req.body
  const inv = await loadOpenInvite(token)
  if (!inv) return res.status(404).json({ error: 'Uitnodiging ongeldig of verlopen' })
  if (!password) return res.status(400).json({ error: 'Wachtwoord verplicht' })

  const existing = await db('users').whereRaw('lower(email) = ?', [inv.email]).first()
  let user
  if (existing) {
    // Existing user: verify their password to prove identity before joining.
    if (!bcrypt.compareSync(password, existing.password_hash))
      return res.status(401).json({ error: 'Onjuist wachtwoord voor dit account' })
    user = existing
  } else {
    if (String(password).length < 6) return res.status(400).json({ error: 'Wachtwoord minimaal 6 tekens' })
    ;[user] = await db('users')
      .insert({ email: inv.email, password_hash: bcrypt.hashSync(password, 10), name: name || null })
      .returning('*')
  }

  await db.transaction(async (trx) => {
    const has = await trx('memberships').where({ user_id: user.id, account_id: inv.account_id }).first()
    if (!has) await trx('memberships').insert({ user_id: user.id, account_id: inv.account_id, role: inv.role })
    await trx('invitations').where({ id: inv.id }).update({ accepted_at: trx.fn.now() })
  })

  const role = normRole(inv.role)
  const sessionToken = await createSession({ accountId: inv.account_id, role, userId: user.id })
  res.json({ token: sessionToken, role })
}))

// ─── Auth middleware (everything under /api below this point) ────────────────────
app.use('/api', wrap(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  const sess  = await getSession(token)
  if (!sess) return res.status(401).json({ error: 'Niet ingelogd' })
  req.token     = token
  req.accountId = sess.accountId
  req.role      = sess.role
  req.userId    = sess.userId || null
  next()
}))

function requireAdmin(req, res, next) {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Geen toegang' })
  next()
}

// Resolve the account's current plan, then check whether it unlocks a capability.
async function accountHasCapability(accountId, cap) {
  const acc = await db('accounts').where({ id: accountId }).first()
  return planHasCapability(acc?.plan || DEFAULT_PLAN, cap)
}

// Route guard: 403 unless the account's plan includes `cap` (e.g. 'inkoop', 'sumup').
function requireCapability(cap) {
  return wrap(async (req, res, next) => {
    if (!(await accountHasCapability(req.accountId, cap)))
      return res.status(403).json({ error: 'Niet beschikbaar in je huidige abonnement' })
    next()
  })
}

// ─── Display (authed) ────────────────────────────────────────────────────────────
// The display token lets the account's display device subscribe without logging in.
app.get('/api/display-token', wrap(async (req, res) => {
  res.json({ token: await ensureDisplayToken(req.accountId) })
}))

app.put('/api/display', wrap(async (req, res) => {
  const state = { ...req.body, updatedAt: new Date().toISOString() }
  displayStates.set(req.accountId, state)
  await broadcastDisplay(req.accountId)
  res.json(state)
}))

app.delete('/api/display', wrap(async (req, res) => {
  displayStates.set(req.accountId, { active: false, updatedAt: null })
  await broadcastDisplay(req.accountId)
  res.json({ ok: true })
}))

// ─── PIN wijzigen ─────────────────────────────────────────────────────────────
app.post('/api/auth/change-pin', requireAdmin, wrap(async (req, res) => {
  const { currentPin, newPin, target } = req.body
  // Verify the current admin PIN — unless none is set yet (first PIN setup).
  if (await hasAdminPin(req.accountId)) {
    if ((await verifyPin(req.accountId, currentPin)) !== 'admin')
      return res.status(403).json({ error: 'Huidige PIN is onjuist' })
  }
  if (!newPin || String(newPin).length < 4) return res.status(400).json({ error: 'PIN moet minimaal 4 tekens zijn' })
  const s = await getRawSettings(req.accountId)
  const hash = bcrypt.hashSync(String(newPin), 10)
  if (target === 'cashier') { s.cashierPinHash = hash; delete s.cashierPin }
  else                      { s.adminPinHash   = hash; delete s.adminPin }
  await saveSettings(req.accountId, s)
  res.json({ ok: true })
}))

// ─── Accounts the current user belongs to + switching ────────────────────────────
app.get('/api/auth/accounts', wrap(async (req, res) => {
  if (!req.userId) {
    const acc = await db('accounts').where({ id: req.accountId }).first()
    return res.json([{ id: req.accountId, name: acc?.name || '', role: req.role, current: true }])
  }
  const rows = await db('memberships')
    .join('accounts', 'accounts.id', 'memberships.account_id')
    .where('memberships.user_id', req.userId)
    .orderBy('accounts.name')
    .select('accounts.id', 'accounts.name', 'memberships.role')
  res.json(rows.map(r => ({ id: r.id, name: r.name, role: normRole(r.role), current: r.id === req.accountId })))
}))

app.post('/api/auth/switch', wrap(async (req, res) => {
  if (!req.userId) return res.status(403).json({ error: 'Wisselen kan niet in een PIN-sessie' })
  const accountId = Number(req.body.accountId)
  const m = await db('memberships').where({ user_id: req.userId, account_id: accountId }).first()
  if (!m) return res.status(403).json({ error: 'Geen toegang tot dit account' })
  await deleteSession(req.token)
  const role  = normRole(m.role)
  const token = await createSession({ accountId, role, userId: req.userId })
  res.json({ token, role })
}))

// ─── Current account + plan ──────────────────────────────────────────────────────
app.get('/api/account', wrap(async (req, res) => {
  const acc = await db('accounts').where({ id: req.accountId }).first()
  if (!acc) return res.status(404).json({ error: 'Account niet gevonden' })
  res.json({ id: acc.id, name: acc.name, plan: acc.plan || DEFAULT_PLAN })
}))

// Change the plan (no payment yet — just records the choice).
app.put('/api/account/plan', requireAdmin, wrap(async (req, res) => {
  const plan = String(req.body.plan || '')
  if (!PLAN_IDS.includes(plan)) return res.status(400).json({ error: 'Onbekend abonnement' })
  await db('accounts').where({ id: req.accountId }).update({ plan })
  // Downgrade: zet SumUp uit als het nieuwe plan pinbetalingen niet meer toestaat,
  // zodat er geen verouderde "aan"-staat blijft hangen.
  if (!planHasCapability(plan, 'sumup')) {
    const raw = await getRawSettings(req.accountId)
    if (raw.sumupEnabled) await saveSettings(req.accountId, { ...raw, sumupEnabled: false })
  }
  const acc = await db('accounts').where({ id: req.accountId }).first()
  res.json({ id: acc.id, name: acc.name, plan: acc.plan })
}))

// ─── Team management (admin) ─────────────────────────────────────────────────────
function inviteLink(req, token) {
  const origin = process.env.APP_URL ||
    `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`
  return `${origin}/invite?token=${token}`
}

app.get('/api/team', requireAdmin, wrap(async (req, res) => {
  const members = await db('memberships')
    .join('users', 'users.id', 'memberships.user_id')
    .where('memberships.account_id', req.accountId)
    .orderBy('memberships.id')
    .select('users.id as user_id', 'users.email', 'users.name', 'memberships.role')
  const invRows = await db('invitations')
    .where({ account_id: req.accountId })
    .whereNull('accepted_at')
    .where('expires_at', '>', new Date().toISOString())
    .orderBy('id', 'desc')
    .select('id', 'email', 'role', 'token', 'expires_at', 'created_at')
  const invites = invRows.map(i => ({ ...i, link: inviteLink(req, i.token), token: undefined }))
  res.json({ members, invites, currentUserId: req.userId, mailerConfigured: mailerConfigured() })
}))

app.post('/api/team/invite', requireAdmin, wrap(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim()
  const role  = req.body.role === 'admin' ? 'admin' : 'cashier'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Ongeldig e-mailadres' })

  const alreadyMember = await db('memberships')
    .join('users', 'users.id', 'memberships.user_id')
    .where('memberships.account_id', req.accountId)
    .whereRaw('lower(users.email) = ?', [email]).first()
  if (alreadyMember) return res.status(409).json({ error: 'Deze persoon is al lid van dit account' })

  const token   = randomUUID().replace(/-/g, '')
  const expires = new Date(Date.now() + 14 * 86400000).toISOString()
  await db('invitations')
    .insert({ account_id: req.accountId, email, role, token, invited_by: req.userId, expires_at: expires })
    .onConflict(['account_id', 'email'])
    .merge({ role, token, invited_by: req.userId, expires_at: expires, accepted_at: null })

  const account = await db('accounts').where({ id: req.accountId }).first()
  const inviter = req.userId ? (await db('users').where({ id: req.userId }).first())?.name : null
  const link    = inviteLink(req, token)
  const mail    = await sendInviteEmail({ to: email, link, orgName: account?.name || '', role, inviterName: inviter })
  res.json({ ok: true, link, emailed: mail.sent })
}))

app.put('/api/team/member/:userId', requireAdmin, wrap(async (req, res) => {
  const uid = Number(req.params.userId)
  if (uid === req.userId) return res.status(400).json({ error: 'Je kunt je eigen rol niet wijzigen' })
  const m = await db('memberships').where({ account_id: req.accountId, user_id: uid }).first()
  if (!m) return res.status(404).json({ error: 'Lid niet gevonden' })
  if (m.role === 'owner') return res.status(403).json({ error: 'De eigenaar kan niet gewijzigd worden' })
  const role = req.body.role === 'admin' ? 'admin' : 'cashier'
  await db('memberships').where({ id: m.id }).update({ role })
  res.json({ ok: true })
}))

app.delete('/api/team/member/:userId', requireAdmin, wrap(async (req, res) => {
  const uid = Number(req.params.userId)
  if (uid === req.userId) return res.status(400).json({ error: 'Je kunt jezelf niet verwijderen' })
  const m = await db('memberships').where({ account_id: req.accountId, user_id: uid }).first()
  if (!m) return res.status(404).json({ error: 'Lid niet gevonden' })
  if (m.role === 'owner') return res.status(403).json({ error: 'De eigenaar kan niet verwijderd worden' })
  await db('memberships').where({ id: m.id }).del()
  res.json({ ok: true })
}))

app.delete('/api/team/invite/:id', requireAdmin, wrap(async (req, res) => {
  await db('invitations').where({ id: Number(req.params.id), account_id: req.accountId }).del()
  res.json({ ok: true })
}))

// ─── Backup & Restore ───────────────────────────────────────────────────────────
app.get('/api/backup', requireAdmin, wrap(async (req, res) => {
  const a = req.accountId
  const products = await scoped(a).table('products').orderBy('sort_order')
  const receipts = await getAllReceiptsWithItems(a)
  const inkoop   = await scoped(a).table('inkoop').orderBy('created_at')
  const donaties = await scoped(a).table('donaties').orderBy('created_at')
  const kasRows  = await scoped(a).table('kas').orderBy('datum')
  const kas = []
  for (const k of kasRows) {
    k.correcties = await scoped(a).table('kas_correcties').where({ kas_id: k.id }).orderBy('id')
    kas.push(k)
  }
  // safeSettings strips the SumUp API key, PIN hashes and display token so the
  // downloaded backup file never carries live secrets.
  res.json({ products, receipts, inkoop, donaties, kas, settings: safeSettings(await getSettings(a)) })
}))

app.post('/api/restore', requireAdmin, wrap(async (req, res) => {
  const a = req.accountId
  const data = req.body
  if (!Array.isArray(data.products) || !Array.isArray(data.receipts))
    return res.status(400).json({ error: 'Ongeldig backup bestand' })

  await scoped(a).transaction(async (t) => {
    // Wipe this account's data only.
    for (const tbl of ['receipt_items', 'receipts', 'products', 'inkoop', 'donaties', 'kas_correcties', 'kas']) {
      await t.table(tbl).del()
    }
    for (const p of (data.products || [])) {
      await t.insert('products', {
        name: p.name, price: p.price, cost_price: p.cost_price ?? null, category: p.category || 'overig',
        available: p.available !== false, sort_order: p.sort_order ?? 0,
        created_at: p.created_at || new Date().toISOString(),
      })
    }
    for (const r of (data.receipts || [])) {
      const [rec] = await t.insert('receipts', {
        name: r.name ?? null, note: r.note ?? null, paid: !!r.paid,
        discount_pct: r.discount_pct || 0, donation: r.donation || 0,
        promo_discount: r.promo_discount || 0,
        promo_lines: JSON.stringify(Array.isArray(r.promo_lines) ? r.promo_lines : []),
        payment_method: r.payment_method ?? null,
        payments: JSON.stringify(r.payments || []),
        created_at: r.created_at || new Date().toISOString(),
      })
      for (const i of (r.items || [])) {
        await t.insert('receipt_items', {
          receipt_id: rec.id, product_id: i.product_id ?? null,
          product_name: i.product_name, product_price: i.product_price, quantity: i.quantity,
        })
      }
    }
    for (const b of (data.inkoop || [])) {
      await t.insert('inkoop', {
        description: b.description, amount: b.amount, date: b.date,
        note: b.note ?? null, submitted_by: b.submitted_by ?? null,
        created_at: b.created_at || new Date().toISOString(),
      })
    }
    for (const d of (data.donaties || [])) {
      await t.insert('donaties', {
        name: d.name ?? null, amount: d.amount, date: d.date,
        note: d.note ?? null, created_at: d.created_at || new Date().toISOString(),
      })
    }
    for (const k of (data.kas || [])) {
      const [kas] = await t.insert('kas', {
        datum: k.datum, begin_bedrag: k.begin_bedrag || 0, eind_bedrag: k.eind_bedrag ?? null,
        note: k.note ?? null, created_at: k.created_at || new Date().toISOString(),
      })
      for (const c of (k.correcties || [])) {
        await t.insert('kas_correcties', {
          kas_id: kas.id, type: c.type || 'contant', amount: c.amount,
          description: c.description || '', created_at: c.created_at || new Date().toISOString(),
        })
      }
    }
  })
  // Only restore whitelisted settings; keep the account's own secrets, PIN hashes
  // and display token, and never let a backup enable SumUp above the plan.
  if (data.settings && typeof data.settings === 'object') {
    const incoming = {}
    for (const k of SAFE_SETTING_KEYS) if (data.settings[k] !== undefined) incoming[k] = data.settings[k]
    if (incoming.sumupEnabled === true && !(await accountHasCapability(a, 'sumup'))) incoming.sumupEnabled = false
    const current = await getRawSettings(a)
    await saveSettings(a, { ...current, ...incoming })
  }
  res.json({ ok: true })
}))

// ─── Products ─────────────────────────────────────────────────────────────────
app.get('/api/products', wrap(async (req, res) => {
  res.json(await scoped(req.accountId).table('products').orderBy('sort_order'))
}))

app.get('/api/products/popular', wrap(async (req, res) => {
  const rows = await scoped(req.accountId).table('receipt_items')
    .whereNotNull('product_id')
    .groupBy('product_id')
    .select('product_id')
    .sum({ cnt: 'quantity' })
    .orderBy('cnt', 'desc')
    .limit(6)
  const products = []
  for (const row of rows) {
    const p = await scoped(req.accountId).table('products').where({ id: row.product_id }).first()
    if (p) products.push({ ...p, orderCount: Number(row.cnt) })
  }
  res.json(products)
}))

app.post('/api/products', requireAdmin, wrap(async (req, res) => {
  const { name, price, category } = req.body
  if (!name || price === undefined) return res.status(400).json({ error: 'Name and price required' })
  const row = await scoped(req.accountId).table('products').max({ m: 'sort_order' }).first()
  const [p] = await scoped(req.accountId).insert('products', {
    name, price: parseFloat(price),
    cost_price: req.body.cost_price != null ? parseFloat(req.body.cost_price) : null,
    category: category || 'overig', available: true,
    sort_order: (row?.m ?? -1) + 1, created_at: new Date().toISOString(),
  })
  res.json(p)
}))

app.put('/api/products/reorder', requireAdmin, wrap(async (req, res) => {
  const { order } = req.body
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order required' })
  await scoped(req.accountId).transaction(async (t) => {
    for (let idx = 0; idx < order.length; idx++) {
      await t.table('products').where({ id: order[idx] }).update({ sort_order: idx })
    }
  })
  res.json({ ok: true })
}))

app.put('/api/products/:id', requireAdmin, wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  const p  = await scoped(req.accountId).table('products').where({ id }).first()
  if (!p) return res.status(404).json({ error: 'Not found' })
  const patch = {
    name:       req.body.name      !== undefined ? req.body.name : p.name,
    price:      req.body.price     !== undefined ? parseFloat(req.body.price) : p.price,
    category:   req.body.category  !== undefined ? (req.body.category || 'overig') : p.category,
    available:  req.body.available !== undefined ? (req.body.available !== false) : p.available,
    cost_price: req.body.cost_price !== undefined
      ? (req.body.cost_price != null ? parseFloat(req.body.cost_price) : null)
      : p.cost_price,
  }
  await scoped(req.accountId).table('products').where({ id }).update(patch)
  res.json(await scoped(req.accountId).table('products').where({ id }).first())
}))

app.delete('/api/products/:id', requireAdmin, wrap(async (req, res) => {
  await scoped(req.accountId).table('products').where({ id: parseInt(req.params.id) }).del()
  res.json({ ok: true })
}))

// ─── Receipts ─────────────────────────────────────────────────────────────────
app.get('/api/receipts', wrap(async (req, res) => {
  const a = req.accountId
  const receipts = await scoped(a).table('receipts').orderBy('created_at', 'desc')
  const items    = await scoped(a).table('receipt_items').select('receipt_id', 'product_price', 'quantity')
  const byR = {}
  for (const i of items) (byR[i.receipt_id] ??= []).push(i)
  res.json(receipts.map((r) => {
    const its = byR[r.id] || []
    const { payments, ...rest } = r
    return {
      ...rest, item_count: its.length,
      total: calcTotal(its, r.discount_pct, r.promo_discount),
      donation: r.donation || 0, promo_lines: r.promo_lines || [],
    }
  }))
}))

app.post('/api/receipts', wrap(async (req, res) => {
  const a = req.accountId
  const { name, items, note } = req.body
  const rec = await scoped(a).transaction(async (t) => {
    const [r] = await t.insert('receipts', {
      name: name || null, note: note || null, paid: false, discount_pct: 0, donation: 0,
      promo_discount: 0, promo_lines: JSON.stringify([]), payments: JSON.stringify([]),
      created_at: new Date().toISOString(),
    })
    for (const i of (items || [])) {
      await t.insert('receipt_items', {
        receipt_id: r.id, product_id: i.product_id, product_name: i.product_name,
        product_price: i.product_price, quantity: i.quantity,
      })
    }
    return r
  })
  await recomputePromo(a, rec.id)
  res.json(await getReceiptWithItems(a, rec.id))
}))

app.get('/api/receipts/:id', wrap(async (req, res) => {
  const r = await getReceiptWithItems(req.accountId, parseInt(req.params.id))
  if (!r) return res.status(404).json({ error: 'Not found' })
  res.json(r)
}))

app.put('/api/receipts/:id', wrap(async (req, res) => {
  const a = req.accountId
  const id = parseInt(req.params.id)
  const r  = await scoped(a).table('receipts').where({ id }).first()
  if (!r) return res.status(404).json({ error: 'Not found' })
  const patch = {
    name:           req.body.name           !== undefined ? req.body.name : r.name,
    note:           req.body.note           !== undefined ? (req.body.note || null) : r.note,
    paid:           req.body.paid           !== undefined ? !!req.body.paid : r.paid,
    discount_pct:   req.body.discount_pct   !== undefined ? (parseFloat(req.body.discount_pct) || 0) : r.discount_pct,
    donation:       req.body.donation       !== undefined ? (parseFloat(req.body.donation) || 0) : r.donation,
    payment_method: req.body.payment_method !== undefined ? (req.body.payment_method || null) : r.payment_method,
    payments:       req.body.payments       !== undefined ? JSON.stringify(req.body.payments || []) : JSON.stringify(r.payments || []),
  }
  await scoped(a).table('receipts').where({ id }).update(patch)
  await autoUpdateDisplay(a, id)
  const updated = await scoped(a).table('receipts').where({ id }).first()
  res.json({ ...updated, payments: updated.payments || [], promo_lines: updated.promo_lines || [] })
}))

app.delete('/api/receipts/:id', wrap(async (req, res) => {
  await scoped(req.accountId).table('receipts').where({ id: parseInt(req.params.id) }).del()
  res.json({ ok: true })
}))

app.post('/api/receipts/bulk', wrap(async (req, res) => {
  const { ids, paid } = req.body
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' })
  await scoped(req.accountId).table('receipts').whereIn('id', ids).update({ paid: !!paid })
  res.json({ ok: true, count: ids.length })
}))

// ─── Receipt items ──────────────────────────────────────────────────────────────
app.post('/api/receipts/:id/items', wrap(async (req, res) => {
  const a = req.accountId
  const receiptId = parseInt(req.params.id)
  if (!(await scoped(a).table('receipts').where({ id: receiptId }).first()))
    return res.status(404).json({ error: 'Not found' })
  const { product_id, product_name, product_price, quantity } = req.body
  const [item] = await scoped(a).insert('receipt_items', {
    receipt_id: receiptId, product_id, product_name, product_price, quantity: quantity ?? 1,
  })
  const promo = await recomputePromo(a, receiptId)
  await autoUpdateDisplay(a, receiptId)
  res.json({ ...item, ...promo })
}))

app.put('/api/receipts/:id/items/:itemId', wrap(async (req, res) => {
  const a = req.accountId
  const receiptId = parseInt(req.params.id)
  const itemId    = parseInt(req.params.itemId)
  const n = await scoped(a).table('receipt_items').where({ id: itemId, receipt_id: receiptId }).update({ quantity: req.body.quantity })
  if (!n) return res.status(404).json({ error: 'Item not found' })
  const item = await scoped(a).table('receipt_items').where({ id: itemId }).first()
  const promo = await recomputePromo(a, receiptId)
  await autoUpdateDisplay(a, receiptId)
  res.json({ ...item, ...promo })
}))

app.delete('/api/receipts/:id/items/:itemId', wrap(async (req, res) => {
  const a = req.accountId
  const receiptId = parseInt(req.params.id)
  await scoped(a).table('receipt_items').where({ id: parseInt(req.params.itemId), receipt_id: receiptId }).del()
  const promo = await recomputePromo(a, receiptId)
  await autoUpdateDisplay(a, receiptId)
  res.json({ ok: true, ...promo })
}))

// ─── Inkoop bonnetjes ─────────────────────────────────────────────────────────
app.get('/api/inkoop', requireAdmin, requireCapability('inkoop'), wrap(async (req, res) => {
  res.json(await scoped(req.accountId).table('inkoop').orderBy('created_at', 'desc'))
}))

app.post('/api/inkoop', requireAdmin, requireCapability('inkoop'), wrap(async (req, res) => {
  const { description, amount, date, note, submitted_by } = req.body
  if (!description || amount === undefined) return res.status(400).json({ error: 'description and amount required' })
  const [row] = await scoped(req.accountId).insert('inkoop', {
    description, amount: parseFloat(amount), date: date || new Date().toISOString().slice(0, 10),
    note: note || null, submitted_by: submitted_by || null, created_at: new Date().toISOString(),
  })
  res.json(row)
}))

app.put('/api/inkoop/:id', requireAdmin, requireCapability('inkoop'), wrap(async (req, res) => {
  const a = req.accountId
  const id = parseInt(req.params.id)
  const bon = await scoped(a).table('inkoop').where({ id }).first()
  if (!bon) return res.status(404).json({ error: 'Not found' })
  await scoped(a).table('inkoop').where({ id }).update({
    description:  req.body.description  !== undefined ? req.body.description : bon.description,
    amount:       req.body.amount       !== undefined ? parseFloat(req.body.amount) : bon.amount,
    date:         req.body.date         !== undefined ? req.body.date : bon.date,
    note:         req.body.note         !== undefined ? (req.body.note || null) : bon.note,
    submitted_by: req.body.submitted_by !== undefined ? (req.body.submitted_by || null) : bon.submitted_by,
  })
  res.json(await scoped(a).table('inkoop').where({ id }).first())
}))

app.delete('/api/inkoop/:id', requireAdmin, requireCapability('inkoop'), wrap(async (req, res) => {
  await scoped(req.accountId).table('inkoop').where({ id: parseInt(req.params.id) }).del()
  res.json({ ok: true })
}))

// ─── Losse donaties ───────────────────────────────────────────────────────────
app.get('/api/donaties', wrap(async (req, res) => {
  res.json(await scoped(req.accountId).table('donaties').orderBy('created_at', 'desc'))
}))

app.post('/api/donaties', wrap(async (req, res) => {
  const { name, amount, date, note } = req.body
  if (amount === undefined) return res.status(400).json({ error: 'amount required' })
  const [row] = await scoped(req.accountId).insert('donaties', {
    name: name?.trim() || null, amount: parseFloat(amount),
    date: date || new Date().toISOString().slice(0, 10),
    note: note?.trim() || null, created_at: new Date().toISOString(),
  })
  res.json(row)
}))

app.put('/api/donaties/:id', wrap(async (req, res) => {
  const a = req.accountId
  const id = parseInt(req.params.id)
  const don = await scoped(a).table('donaties').where({ id }).first()
  if (!don) return res.status(404).json({ error: 'Not found' })
  await scoped(a).table('donaties').where({ id }).update({
    name:   req.body.name   !== undefined ? (req.body.name?.trim() || null) : don.name,
    amount: req.body.amount !== undefined ? parseFloat(req.body.amount) : don.amount,
    date:   req.body.date   !== undefined ? req.body.date : don.date,
    note:   req.body.note   !== undefined ? (req.body.note?.trim() || null) : don.note,
  })
  res.json(await scoped(a).table('donaties').where({ id }).first())
}))

app.delete('/api/donaties/:id', wrap(async (req, res) => {
  await scoped(req.accountId).table('donaties').where({ id: parseInt(req.params.id) }).del()
  res.json({ ok: true })
}))

// ─── Kasregistraties ──────────────────────────────────────────────────────────
app.get('/api/kas', requireAdmin, wrap(async (req, res) => {
  const a = req.accountId
  const records = await scoped(a).table('kas').orderBy('datum', 'desc')
  for (const k of records) {
    k.correcties = await scoped(a).table('kas_correcties').where({ kas_id: k.id }).orderBy('id')
  }
  res.json(records)
}))

app.post('/api/kas', requireAdmin, wrap(async (req, res) => {
  const a = req.accountId
  const datum = req.body.datum || new Date().toISOString().slice(0, 10)
  const record = await scoped(a).table('kas').where({ datum }).first()
  if (record) {
    await scoped(a).table('kas').where({ id: record.id }).update({
      begin_bedrag: req.body.begin_bedrag !== undefined ? (parseFloat(req.body.begin_bedrag) || 0) : record.begin_bedrag,
      eind_bedrag:  req.body.eind_bedrag  !== undefined ? (req.body.eind_bedrag !== null ? parseFloat(req.body.eind_bedrag) : null) : record.eind_bedrag,
      note:         req.body.note         !== undefined ? (req.body.note || null) : record.note,
    })
    return res.json(await getKasWithCorrecties(a, record.id))
  }
  const [created] = await scoped(a).insert('kas', {
    datum, begin_bedrag: parseFloat(req.body.begin_bedrag) || 0, eind_bedrag: null,
    note: req.body.note || null, created_at: new Date().toISOString(),
  })
  res.json(await getKasWithCorrecties(a, created.id))
}))

app.put('/api/kas/:id', requireAdmin, wrap(async (req, res) => {
  const a = req.accountId
  const id = parseInt(req.params.id)
  const record = await scoped(a).table('kas').where({ id }).first()
  if (!record) return res.status(404).json({ error: 'Not found' })
  await scoped(a).table('kas').where({ id }).update({
    begin_bedrag: req.body.begin_bedrag !== undefined ? (parseFloat(req.body.begin_bedrag) || 0) : record.begin_bedrag,
    eind_bedrag:  req.body.eind_bedrag  !== undefined ? (req.body.eind_bedrag !== null ? parseFloat(req.body.eind_bedrag) : null) : record.eind_bedrag,
    note:         req.body.note         !== undefined ? (req.body.note || null) : record.note,
  })
  res.json(await getKasWithCorrecties(a, id))
}))

app.delete('/api/kas/:id', requireAdmin, wrap(async (req, res) => {
  await scoped(req.accountId).table('kas').where({ id: parseInt(req.params.id) }).del()
  res.json({ ok: true })
}))

app.post('/api/kas/:id/correcties', requireAdmin, wrap(async (req, res) => {
  const a = req.accountId
  const id = parseInt(req.params.id)
  if (!(await scoped(a).table('kas').where({ id }).first())) return res.status(404).json({ error: 'Not found' })
  const [row] = await scoped(a).insert('kas_correcties', {
    kas_id: id, type: req.body.type || 'contant', amount: parseFloat(req.body.amount) || 0,
    description: req.body.description || '', created_at: new Date().toISOString(),
  })
  res.json(row)
}))

app.delete('/api/kas/:id/correcties/:cid', requireAdmin, wrap(async (req, res) => {
  await scoped(req.accountId).table('kas_correcties')
    .where({ id: parseInt(req.params.cid), kas_id: parseInt(req.params.id) }).del()
  res.json({ ok: true })
}))

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', wrap(async (req, res) => {
  res.json(safeSettings(await getSettings(req.accountId)))
}))

app.put('/api/settings', requireAdmin, wrap(async (req, res) => {
  const body = { ...req.body }
  // Never persist PINs in plaintext — hash any that come through (e.g. the setup
  // wizard) into *PinHash and drop the plaintext keys.
  if (body.adminPin)   { body.adminPinHash   = bcrypt.hashSync(String(body.adminPin), 10) }
  if (body.cashierPin) { body.cashierPinHash = bcrypt.hashSync(String(body.cashierPin), 10) }
  delete body.adminPin; delete body.cashierPin
  // An empty sumupApiKey means "leave the stored key unchanged" (the client never
  // receives the key back, so it can't echo it). Only overwrite when a value is given.
  if (body.sumupApiKey === '' || body.sumupApiKey === undefined) delete body.sumupApiKey
  delete body.sumupApiKeySet
  // SumUp can only be switched on when the plan unlocks it (Business).
  if (body.sumupEnabled === true && !(await accountHasCapability(req.accountId, 'sumup')))
    return res.status(403).json({ error: 'SumUp is onderdeel van het Business-abonnement' })
  const merged = { ...(await getRawSettings(req.accountId)), ...body }
  await saveSettings(req.accountId, merged)
  res.json(safeSettings(await getSettings(req.accountId)))
}))

// Start a card payment on the paired SumUp reader for a given receipt. Pushes the
// outstanding amount to the terminal; the cashier confirms completion afterwards.
app.post('/api/sumup/checkout', requireCapability('sumup'), wrap(async (req, res) => {
  const s = await getSettings(req.accountId)
  if (!s.sumupEnabled) return res.status(400).json({ error: 'SumUp staat uit' })
  if (!s.sumupApiKey || !s.sumupMerchantCode || !s.sumupReaderId) {
    return res.status(400).json({ error: 'SumUp is niet volledig geconfigureerd' })
  }

  const receiptId = parseInt(req.body.receiptId)
  const r = await getReceiptWithItems(req.accountId, receiptId)
  if (!r) return res.status(404).json({ error: 'Bon niet gevonden' })
  if (r.paid) return res.status(400).json({ error: 'Bon is al betaald' })

  // The receipts row has no stored total; compute the outstanding amount the same
  // way the customer display does (items − promo − discount %, plus any donation).
  const totalDue = calcTotal(r.items, r.discount_pct, r.promo_discount) + (r.donation || 0)
  if (!(totalDue > 0)) return res.status(400).json({ error: 'Bon heeft geen openstaand bedrag' })

  try {
    const result = await createReaderCheckout({
      apiKey:       s.sumupApiKey,
      merchantCode: s.sumupMerchantCode,
      readerId:     s.sumupReaderId,
      amount:       totalDue,
      description:  `Bon #${receiptId}${r.name ? ` — ${r.name}` : ''}`,
    })
    res.json({ ok: true, clientTransactionId: result.clientTransactionId, checkoutId: result.checkoutId, amount: totalDue })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}))

// Poll the status of a reader checkout so the kassa can auto-detect when the card
// payment finished. Returns { status: pending|successful|failed|cancelled }.
app.get('/api/sumup/checkout/:checkoutId/status', requireCapability('sumup'), wrap(async (req, res) => {
  const s = await getSettings(req.accountId)
  if (!s.sumupApiKey || !s.sumupMerchantCode || !s.sumupReaderId) {
    return res.status(400).json({ error: 'SumUp is niet volledig geconfigureerd' })
  }
  try {
    const result = await getReaderCheckout({
      apiKey:       s.sumupApiKey,
      merchantCode: s.sumupMerchantCode,
      readerId:     s.sumupReaderId,
      checkoutId:   req.params.checkoutId,
    })
    res.json({ status: result.status, failureReason: result.failureReason })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}))

// ─── Stats ────────────────────────────────────────────────────────────────────
app.get('/api/stats', wrap(async (req, res) => {
  const a = req.accountId
  const todayStr     = new Date().toDateString()
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString()
  const filterToday     = req.query.period === 'today'
  const filterYesterday = req.query.period === 'yesterday'
  const filterDate      = req.query.period === 'date' && req.query.date ? req.query.date : null
  const filterDateStr   = filterDate ? new Date(filterDate + 'T12:00:00').toDateString() : null

  const allReceipts = await getAllReceiptsWithItems(a)
  const receipts    = filterToday
    ? allReceipts.filter((r) => new Date(r.created_at).toDateString() === todayStr)
    : filterYesterday
      ? allReceipts.filter((r) => new Date(r.created_at).toDateString() === yesterdayStr)
      : filterDate
        ? allReceipts.filter((r) => new Date(r.created_at).toDateString() === filterDateStr)
        : allReceipts

  let totalRevenue = 0, paidRevenue = 0, todayRevenue = 0, todayPaidRevenue = 0, totalDonations = 0, todayDonations = 0
  const productMap = {}, hourMap = {}, dayMap = {}
  const paymentBreakdown      = { contant: 0, pin: 0, qr: 0, onbekend: 0 }
  const todayPaymentBreakdown = { contant: 0, pin: 0, qr: 0, onbekend: 0 }

  receipts.forEach((r) => {
    const rTotal    = calcTotal(r.items, r.discount_pct, r.promo_discount)
    const rDonation = r.donation || 0
    totalRevenue   += rTotal + rDonation
    totalDonations += rDonation
    if (r.paid) {
      paidRevenue += rTotal + rDonation
      if (r.payments?.length > 0) {
        r.payments.forEach((p) => { const m = p.method || 'onbekend'; paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (p.amount || 0) })
      } else {
        const m = r.payment_method || 'onbekend'; paymentBreakdown[m] = (paymentBreakdown[m] || 0) + rTotal + rDonation
      }
    }
    const date    = new Date(r.created_at)
    const isToday = date.toDateString() === todayStr
    if (isToday) {
      todayRevenue += rTotal + rDonation
      if (r.paid) {
        todayPaidRevenue += rTotal + rDonation
        if (r.payments?.length > 0) {
          r.payments.forEach((p) => { const m = p.method || 'onbekend'; todayPaymentBreakdown[m] = (todayPaymentBreakdown[m] || 0) + (p.amount || 0) })
        } else {
          const m = r.payment_method || 'onbekend'; todayPaymentBreakdown[m] = (todayPaymentBreakdown[m] || 0) + rTotal + rDonation
        }
      }
      todayDonations += rDonation
      hourMap[date.getHours()] = (hourMap[date.getHours()] || 0) + rTotal + rDonation
    }
    const dayKey = r.created_at.split('T')[0]
    dayMap[dayKey] = (dayMap[dayKey] || 0) + rTotal + rDonation
    ;(r.items || []).forEach((i) => {
      if (!productMap[i.product_name]) productMap[i.product_name] = { name: i.product_name, quantity: 0, revenue: 0 }
      productMap[i.product_name].quantity += i.quantity
      productMap[i.product_name].revenue  += i.product_price * i.quantity
    })
  })

  const paidCount = receipts.filter((r) => r.paid).length

  const revenueByHour = []
  for (let h = 0; h < 24; h++) {
    if (hourMap[h] != null) revenueByHour.push({ hour: `${String(h).padStart(2, '0')}:00`, revenue: Math.round(hourMap[h] * 100) / 100 })
  }
  const revenueByDay = Object.entries(dayMap).sort(([x], [y]) => x.localeCompare(y)).slice(-30)
    .map(([day, revenue]) => ({ day: new Date(day).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }), revenue: Math.round(revenue * 100) / 100 }))
  const topProducts = Object.values(productMap).sort((x, y) => y.revenue - x.revenue).map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))

  // Estimated costs from product cost prices × sold quantities
  const soldQtyMap = {}
  receipts.forEach((r) => (r.items || []).forEach((i) => { soldQtyMap[i.product_id] = (soldQtyMap[i.product_id] || 0) + i.quantity }))
  const allProducts = await scoped(a).table('products').select('id', 'cost_price', 'category')
  const costPriceMap = Object.fromEntries(allProducts.map((p) => [p.id, p.cost_price]))
  const productCatMap = Object.fromEntries(allProducts.map((p) => [p.id, p.category || 'overig']))
  let estimatedCosts = 0
  Object.entries(soldQtyMap).forEach(([pid, qty]) => { const cp = costPriceMap[parseInt(pid)]; if (cp) estimatedCosts += cp * qty })

  const categoryMap = {}
  receipts.forEach((r) => (r.items || []).forEach((i) => {
    const cat = productCatMap[i.product_id] || 'overig'
    if (!categoryMap[cat]) categoryMap[cat] = { cat, quantity: 0, revenue: 0 }
    categoryMap[cat].quantity += i.quantity
    categoryMap[cat].revenue  += i.product_price * i.quantity
  }))
  const categoryStats = Object.values(categoryMap).map((c) => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 })).sort((x, y) => y.revenue - x.revenue)

  let yesterdayRevenue = 0
  allReceipts.forEach((r) => { if (new Date(r.created_at).toDateString() === yesterdayStr) yesterdayRevenue += calcTotal(r.items, r.discount_pct, r.promo_discount) + (r.donation || 0) })

  // Losse donaties
  const allDonaties = await scoped(a).table('donaties')
  const donatiesFiltered = filterToday
    ? allDonaties.filter((d) => new Date(d.created_at).toDateString() === todayStr)
    : filterYesterday
      ? allDonaties.filter((d) => new Date(d.created_at).toDateString() === yesterdayStr)
      : filterDate
        ? allDonaties.filter((d) => new Date(d.created_at).toDateString() === filterDateStr)
        : allDonaties
  donatiesFiltered.forEach((d) => {
    const amt = d.amount || 0
    totalRevenue += amt; paidRevenue += amt; totalDonations += amt
    if (new Date(d.created_at).toDateString() === todayStr) {
      todayRevenue += amt; todayPaidRevenue += amt; todayDonations += amt
      hourMap[new Date(d.created_at).getHours()] = (hourMap[new Date(d.created_at).getHours()] || 0) + amt
    }
    dayMap[d.created_at.split('T')[0]] = (dayMap[d.created_at.split('T')[0]] || 0) + amt
  })
  allDonaties.forEach((d) => { if (new Date(d.created_at).toDateString() === yesterdayStr) yesterdayRevenue += d.amount || 0 })

  // Inkoop / kosten
  const allInkoop = await scoped(a).table('inkoop')
  const inkoopFiltered = filterToday
    ? allInkoop.filter((b) => new Date(b.created_at).toDateString() === todayStr)
    : filterYesterday
      ? allInkoop.filter((b) => new Date(b.created_at).toDateString() === yesterdayStr)
      : filterDate
        ? allInkoop.filter((b) => new Date(b.created_at).toDateString() === filterDateStr)
        : allInkoop
  const totalCosts = inkoopFiltered.reduce((s, b) => s + (b.amount || 0), 0)
  const todayCosts = allInkoop.filter((b) => new Date(b.created_at).toDateString() === todayStr).reduce((s, b) => s + (b.amount || 0), 0)

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
}))

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

// ─── Error handler ──────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[kassa] error:', err)
  if (res.headersSent) return
  res.status(500).json({ error: 'Serverfout' })
})

app.listen(PORT, () => {
  console.log(`🍺  Tappy (multi-tenant/Postgres) draait op http://localhost:${PORT}`)
})
