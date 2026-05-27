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
  return res.json()   // { token, role }
}

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
export const createProduct        = (name, price, cat)   => req('/products', { method: 'POST', body: JSON.stringify({ name, price, category: cat }) })
export const updateProduct        = (id, name, price, cat) => req(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ name, price, category: cat }) })
export const deleteProduct        = (id)                  => req(`/products/${id}`, { method: 'DELETE' })

// ─── Receipts ─────────────────────────────────────────────────────────────

export const fetchReceipts  = ()         => req('/receipts')
export const createReceipt  = (name, items) => req('/receipts', { method: 'POST', body: JSON.stringify({ name, items }) })
export const fetchReceipt   = (id)       => req(`/receipts/${id}`)
export const updateReceipt  = (id, data) => req(`/receipts/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteReceipt  = (id)       => req(`/receipts/${id}`, { method: 'DELETE' })
export const bulkMarkPaid   = (ids, paid) => req('/receipts/bulk', { method: 'POST', body: JSON.stringify({ ids, paid }) })

// ─── Settings ─────────────────────────────────────────────────────────────

export const fetchSettings  = ()     => req('/settings')
export const updateSettings = (data) => req('/settings', { method: 'PUT', body: JSON.stringify(data) })

// ─── Stats ────────────────────────────────────────────────────────────────

export const fetchStats = (period) =>
  req(`/stats${period ? `?period=${period}` : ''}`)

// ─── Receipt items ────────────────────────────────────────────────────────

export const addReceiptItem    = (receiptId, item)          => req(`/receipts/${receiptId}/items`, { method: 'POST', body: JSON.stringify(item) })
export const updateReceiptItem = (receiptId, itemId, qty)   => req(`/receipts/${receiptId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity: qty }) })
export const deleteReceiptItem = (receiptId, itemId)        => req(`/receipts/${receiptId}/items/${itemId}`, { method: 'DELETE' })
