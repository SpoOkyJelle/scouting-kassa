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

export const changePin = (data) => req('/auth/change-pin', { method: 'POST', body: JSON.stringify(data) })

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

// ─── Stats ────────────────────────────────────────────────────────────────

export const fetchStats = (period) =>
  req(`/stats${period ? `?period=${period}` : ''}`)

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

export const fetchKas  = ()         => req('/kas')
export const createKas = (data)     => req('/kas', { method: 'POST', body: JSON.stringify(data) })
export const updateKas = (id, data) => req(`/kas/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteKas = (id)       => req(`/kas/${id}`, { method: 'DELETE' })
