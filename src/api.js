const BASE = '/api'

async function req(path, options = {}) {
  const token = localStorage.getItem('kassa_token')
  const res = await fetch(BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })

  if (res.status === 401) {
    localStorage.removeItem('kassa_token')
    localStorage.removeItem('kassa_role')
    window.location.reload()
    throw new Error('Unauthorized')
  }
  if (res.status === 403) throw new Error('Geen toegang')
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || `API error: ${res.status}`)
  }
  return res.json()
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export async function login(pin) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  if (!res.ok) throw new Error('Wrong PIN')
  return res.json()   // { token, role }
}

// Account login with email + password.
export async function loginPassword(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || 'Login failed')
  }
  return res.json()   // { token, role }
}

// Register a new account (organisation) with an owner user.
export async function register({ email, password, org, name }) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, org, name }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || 'Registration failed')
  }
  return res.json()   // { token, role, account }
}

// Public invite lookup + accept (no session yet).
export async function fetchInvite(token) {
  const res = await fetch(`${BASE}/auth/invite/${token}`)
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || 'Uitnodiging ongeldig')
  }
  return res.json()   // { email, role, account:{name}, userExists }
}
export async function acceptInvite({ token, password, name }) {
  const res = await fetch(`${BASE}/auth/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password, name }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || 'Accepteren mislukt')
  }
  return res.json()   // { token, role }
}

// ─── Team & accounts ─────────────────────────────────────────────────────────
export const fetchTeam         = ()            => req('/team')
export const inviteMember      = (email, role) => req('/team/invite', { method: 'POST', body: JSON.stringify({ email, role }) })
export const revokeInvite      = (id)          => req(`/team/invite/${id}`, { method: 'DELETE' })
export const removeMember      = (userId)      => req(`/team/member/${userId}`, { method: 'DELETE' })
export const changeMemberRole  = (userId, role) => req(`/team/member/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) })

export const fetchAccount  = ()      => req('/account')               // { id, name, plan }
export const updatePlan    = (plan)  => req('/account/plan', { method: 'PUT', body: JSON.stringify({ plan }) })

export const fetchAccounts = () => req('/auth/accounts')
export async function switchAccount(accountId) {
  const r = await req('/auth/switch', { method: 'POST', body: JSON.stringify({ accountId }) })
  localStorage.setItem('kassa_token', r.token)
  localStorage.setItem('kassa_role', r.role)
  return r   // { token, role }
}

export const changePin     = (data) => req('/auth/change-pin', { method: 'POST', body: JSON.stringify(data) })
export const updateDisplay = (data) => req('/display', { method: 'PUT',  body: JSON.stringify(data) })
export const clearDisplay  = ()     => req('/display', { method: 'DELETE' })
export const fetchDisplayToken = ()  => req('/display-token')   // { token }

export async function logout() {
  const token = localStorage.getItem('kassa_token')
  await fetch(`${BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  localStorage.removeItem('kassa_token')
  localStorage.removeItem('kassa_role')
}

// ─── Products ──────────────────────────────────────────────────────────────

export const fetchProducts        = ()                    => req('/products')
export const fetchPopularProducts = ()                    => req('/products/popular')
export const createProduct        = (name, price, cat, costPrice) => req('/products', { method: 'POST', body: JSON.stringify({ name, price, category: cat, cost_price: costPrice ?? null }) })
export const updateProduct        = (id, name, price, cat, costPrice) => req(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ name, price, category: cat, cost_price: costPrice !== undefined ? costPrice : undefined }) })
export const setProductAvailable  = (id, available)       => req(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ available }) })
export const deleteProduct        = (id)                  => req(`/products/${id}`, { method: 'DELETE' })
export const reorderProducts      = (order)               => req('/products/reorder', { method: 'PUT', body: JSON.stringify({ order }) })

// ─── Receipts ─────────────────────────────────────────────────────────────

export const fetchReceipts  = ()         => req('/receipts')
export const createReceipt  = (name, items, note) => req('/receipts', { method: 'POST', body: JSON.stringify({ name, items, note }) })
export const fetchReceipt   = (id)       => req(`/receipts/${id}`)
export const updateReceipt  = (id, data) => req(`/receipts/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteReceipt  = (id)       => req(`/receipts/${id}`, { method: 'DELETE' })
export const bulkMarkPaid   = (ids, paid) => req('/receipts/bulk', { method: 'POST', body: JSON.stringify({ ids, paid }) })

// ─── Settings ─────────────────────────────────────────────────────────────

export const fetchBackup    = ()     => req('/backup')
export const restoreBackup  = (data) => req('/restore', { method: 'POST', body: JSON.stringify(data) })

export const fetchSettings  = ()     => req('/settings')
export const updateSettings = (data) => req('/settings', { method: 'PUT', body: JSON.stringify(data) })

// ─── SumUp Cloud ────────────────────────────────────────────────────────────
// Push a card payment for a receipt to the paired SumUp reader.
// Returns { ok, clientTransactionId, checkoutId, amount }.
export const sumupCheckout = (receiptId) => req('/sumup/checkout', { method: 'POST', body: JSON.stringify({ receiptId }) })

// Poll a reader checkout's status: { status: pending|successful|failed|cancelled }.
export const sumupStatus = (checkoutId) => req(`/sumup/checkout/${encodeURIComponent(checkoutId)}/status`)

// ─── Stats ────────────────────────────────────────────────────────────────

export const fetchStats = (period, date) => {
  const params = []
  if (period) params.push(`period=${period}`)
  if (date)   params.push(`date=${date}`)
  return req(`/stats${params.length ? `?${params.join('&')}` : ''}`)
}

// ─── Inkoop bonnetjes ─────────────────────────────────────────────────────

export const fetchInkoop  = ()       => req('/inkoop')
export const createInkoop = (data)   => req('/inkoop', { method: 'POST', body: JSON.stringify(data) })
export const updateInkoop = (id, data) => req(`/inkoop/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteInkoop = (id)     => req(`/inkoop/${id}`, { method: 'DELETE' })

// ─── Losse donaties ───────────────────────────────────────────────────────

export const fetchDonaties  = ()           => req('/donaties')
export const createDonatie  = (data)       => req('/donaties', { method: 'POST', body: JSON.stringify(data) })
export const updateDonatie  = (id, data)   => req(`/donaties/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteDonatie  = (id)         => req(`/donaties/${id}`, { method: 'DELETE' })

// ─── Receipt items ────────────────────────────────────────────────────────

export const addReceiptItem    = (receiptId, item)          => req(`/receipts/${receiptId}/items`, { method: 'POST', body: JSON.stringify(item) })
export const updateReceiptItem = (receiptId, itemId, qty)   => req(`/receipts/${receiptId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity: qty }) })
export const deleteReceiptItem = (receiptId, itemId)        => req(`/receipts/${receiptId}/items/${itemId}`, { method: 'DELETE' })

// ─── Kasregistraties ──────────────────────────────────────────────────────────

export const fetchKas           = ()             => req('/kas')
export const createKas          = (data)         => req('/kas', { method: 'POST', body: JSON.stringify(data) })
export const updateKas          = (id, data)     => req(`/kas/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteKas          = (id)           => req(`/kas/${id}`, { method: 'DELETE' })
export const addKasCorrectie    = (id, data)     => req(`/kas/${id}/correcties`, { method: 'POST', body: JSON.stringify(data) })
export const deleteKasCorrectie = (id, cid)      => req(`/kas/${id}/correcties/${cid}`, { method: 'DELETE' })
