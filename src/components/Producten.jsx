import { useState, useEffect } from 'react'
import { useLang } from '../App'
import { fetchProducts, createProduct, updateProduct, deleteProduct } from '../api'
import { CATEGORIES, getCat } from '../categories'

const fmt = (price) => `€ ${parseFloat(price).toFixed(2)}`

function CatBadge({ catId, t }) {
  const cat = getCat(catId)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 12,
      background: cat.color + '22', color: cat.color,
      fontSize: '0.75rem', fontWeight: 700,
    }}>
      {cat.emoji} {t(`cat_${cat.id}`)}
    </span>
  )
}

function CatSelect({ value, onChange, t }) {
  return (
    <select
      className="form-input"
      style={{ flex: '0 0 150px' }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {CATEGORIES.map(c => (
        <option key={c.id} value={c.id}>{c.emoji} {t(`cat_${c.id}`)}</option>
      ))}
    </select>
  )
}

export default function Producten() {
  const { t } = useLang()
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [editId, setEditId]     = useState(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCat, setEditCat]   = useState('overig')
  const [newName, setNewName]   = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCat, setNewCat]     = useState('pannenkoeken')
  const [adding, setAdding]     = useState(false)

  useEffect(() => {
    fetchProducts().then(data => { setProducts(data); setLoading(false) })
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim() || newPrice === '') return
    setAdding(true)
    const p = await createProduct(newName.trim(), parseFloat(newPrice), newCat)
    setProducts(prev =>
      [...prev, p].sort((a, b) => a.name.localeCompare(b.name))
    )
    setNewName('')
    setNewPrice('')
    setAdding(false)
  }

  function startEdit(product) {
    setEditId(product.id)
    setEditName(product.name)
    setEditPrice(String(product.price))
    setEditCat(product.category || 'overig')
  }

  async function saveEdit(id) {
    if (!editName.trim() || editPrice === '') return
    const updated = await updateProduct(id, editName.trim(), parseFloat(editPrice), editCat)
    setProducts(prev =>
      prev.map(p => p.id === id ? updated : p).sort((a, b) => a.name.localeCompare(b.name))
    )
    setEditId(null)
  }

  async function handleDelete(id) {
    if (!confirm(t('confirm_delete'))) return
    await deleteProduct(id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div className="spinner" />

  // Group products by category order
  const groups = CATEGORIES.map(cat => ({
    cat,
    items: products.filter(p => (p.category || 'overig') === cat.id),
  })).filter(g => g.items.length > 0)

  return (
    <div>
      {/* ── Add form ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow)', padding: '1rem', marginBottom: '1rem',
      }}>
        <p className="section-title" style={{ marginBottom: '0.7rem' }}>
          + {t('add_product')}
        </p>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ flex: '1 1 160px' }}
            placeholder={t('product_name')}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
          />
          <input
            className="form-input"
            style={{ flex: '0 0 110px' }}
            placeholder={t('product_price')}
            type="number" step="0.01" min="0"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            required
          />
          <CatSelect value={newCat} onChange={setNewCat} t={t} />
          <button type="submit" className="btn btn-primary" disabled={adding}>
            {adding ? '…' : `+ ${t('add_product')}`}
          </button>
        </form>
      </div>

      {/* ── Product list grouped by category ─────────────────────────────── */}
      {products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p>{t('no_products')}</p>
        </div>
      ) : (
        groups.map(({ cat, items }) => (
          <div key={cat.id} style={{ marginBottom: '1rem' }}>
            {/* Category header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: '0.4rem', padding: '0 4px',
            }}>
              <span style={{ fontSize: '1.2rem' }}>{cat.emoji}</span>
              <span style={{ fontWeight: 800, color: cat.color, fontSize: '0.95rem' }}>
                {t(`cat_${cat.id}`)}
              </span>
              <span style={{
                marginLeft: 4, fontSize: '0.75rem', color: 'var(--muted)',
                background: 'var(--border)', padding: '1px 7px', borderRadius: 10,
              }}>
                {items.length}
              </span>
            </div>

            <div className="product-list-box">
              {items.map(product =>
                editId === product.id ? (
                  <div key={product.id} className="edit-row">
                    <input
                      className="form-input"
                      style={{ flex: '1 1 160px' }}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && saveEdit(product.id)}
                    />
                    <input
                      className="form-input"
                      style={{ flex: '0 0 110px' }}
                      type="number" step="0.01" min="0"
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(product.id)}
                    />
                    <CatSelect value={editCat} onChange={setEditCat} t={t} />
                    <button className="btn btn-primary btn-sm" onClick={() => saveEdit(product.id)}>
                      {t('save')}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>
                      {t('cancel')}
                    </button>
                  </div>
                ) : (
                  <div key={product.id} className="product-row">
                    <span className="product-row-name">{product.name}</span>
                    <span className="product-row-price">{fmt(product.price)}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(product)} title={t('edit')}>✏️</button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => handleDelete(product.id)}
                      title={t('delete')}
                    >🗑️</button>
                  </div>
                )
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
