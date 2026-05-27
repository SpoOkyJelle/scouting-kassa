const BASE = '/api'

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
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

// ─── Receipt items ────────────────────────────────────────────────────────

export const addReceiptItem = (receiptId, item) =>
  req(`/receipts/${receiptId}/items`, { method: 'POST', body: JSON.stringify(item) })

export const updateReceiptItem = (receiptId, itemId, quantity) =>
  req(`/receipts/${receiptId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) })

export const deleteReceiptItem = (receiptId, itemId) =>
  req(`/receipts/${receiptId}/items/${itemId}`, { method: 'DELETE' })
