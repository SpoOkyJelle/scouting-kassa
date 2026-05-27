const BASE = '/api'

async function req(path, options = {}) {
  const token = sessionStorage.getItem('kassa_token')
  const res = await fetch(BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })

  // Session expired or invalid — clear token and reload to login screen
  if (res.status === 401) {
    sessionStorage.removeItem('kassa_token')
    window.location.reload()
    throw new Error('Unauthorized')
  }

  if (!res.ok) throw new Error(`API error: ${res.status}`)
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
  return res.json()   // { token }
}

export async function logout() {
  const token = sessionStorage.getItem('kassa_token')
  await fetch(`${BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  sessionStorage.removeItem('kassa_token')
}

// ─── Products ──────────────────────────────────────────────────────────────

export const fetchProducts = () => req('/products')

export const createProduct = (name, price, category) =>
  req('/products', { method: 'POST', body: JSON.stringify({ name, price, category }) })

export const updateProduct = (id, name, price, category) =>
  req(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ name, price, category }) })

export const deleteProduct = (id) =>
  req(`/products/${id}`, { method: 'DELETE' })

// ─── Receipts ─────────────────────────────────────────────────────────────

export const fetchReceipts = () => req('/receipts')

export const createReceipt = (name, items) =>
  req('/receipts', { method: 'POST', body: JSON.stringify({ name, items }) })

export const fetchReceipt = (id) => req(`/receipts/${id}`)

export const updateReceipt = (id, data) =>
  req(`/receipts/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteReceipt = (id) =>
  req(`/receipts/${id}`, { method: 'DELETE' })

// ─── Stats ────────────────────────────────────────────────────────────────

export const fetchStats = () => req('/stats')

// ─── Receipt items ────────────────────────────────────────────────────────

export const addReceiptItem = (receiptId, item) =>
  req(`/receipts/${receiptId}/items`, { method: 'POST', body: JSON.stringify(item) })

export const updateReceiptItem = (receiptId, itemId, quantity) =>
  req(`/receipts/${receiptId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) })

export const deleteReceiptItem = (receiptId, itemId) =>
  req(`/receipts/${receiptId}/items/${itemId}`, { method: 'DELETE' })
