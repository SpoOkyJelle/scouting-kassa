import { useState, useEffect } from 'react'
import { Pencil, Trash2, Package } from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchProducts, createProduct, updateProduct, deleteProduct } from '../api'
import { CATEGORIES } from '../categories'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'

const fmt = p => `€ ${parseFloat(p).toFixed(2)}`

function CatSelect({ value, onChange, t }) {
  return (
    <select
      className="form-input"
      style={{ flex: '0 0 148px' }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {CATEGORIES.map(c => (
        <option key={c.id} value={c.id}>{t(`cat_${c.id}`)}</option>
      ))}
    </select>
  )
}

export default function Producten() {
  const { t }    = useLang()
  const showToast = useToast()
  const confirm   = useConfirm()

  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [editId, setEditId]       = useState(null)
  const [editName, setEditName]   = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCat, setEditCat]     = useState('overig')
  const [newName, setNewName]     = useState('')
  const [newPrice, setNewPrice]   = useState('')
  const [newCat, setNewCat]       = useState('pannenkoeken')
  const [adding, setAdding]       = useState(false)

  useEffect(() => {
    fetchProducts().then(data => { setProducts(data); setLoading(false) })
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim() || newPrice === '') return
    setAdding(true)
    const p = await createProduct(newName.trim(), parseFloat(newPrice), newCat)
    setProducts(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))
    setNewName(''); setNewPrice('')
    setAdding(false)
    showToast(t('toast_saved'))
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
    showToast(t('toast_saved'))
  }

  async function handleDelete(id) {
    const ok = await confirm(t('confirm_delete'))
    if (!ok) return
    await deleteProduct(id)
    setProducts(prev => prev.filter(p => p.id !== id))
    showToast(t('toast_deleted'), 'info')
  }

  if (loading) return <div className="spinner" />

  const groups = CATEGORIES.map(cat => ({
    cat,
    items: products.filter(p => (p.category || 'overig') === cat.id),
  })).filter(g => g.items.length > 0)

  return (
    <div>
      {/* ── Add form ─────────────────────────────────────────────────────── */}
      <div className="page-surface">
        <p className="section-title" style={{ marginBottom: '0.75rem' }}>
          {t('add_product')}
        </p>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
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
            style={{ flex: '0 0 105px' }}
            placeholder={t('product_price')}
            type="number" step="0.01" min="0"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            required
          />
          <CatSelect value={newCat} onChange={setNewCat} t={t} />
          <button type="submit" className="btn btn-primary" disabled={adding}>
            {adding ? t('loading') : t('add_product')}
          </button>
        </form>
      </div>

      {/* ── Product groups ────────────────────────────────────────────────── */}
      {products.length === 0 ? (
        <div className="empty-state" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
          <Package size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
          <p>{t('no_products')}</p>
        </div>
      ) : (
        groups.map(({ cat, items }) => {
          const { Icon } = cat
          return (
            <div key={cat.id} style={{ marginBottom: '1rem' }}>
              {/* Category header */}
              <div className="cat-header" style={{ padding: '0 2px' }}>
                <Icon size={14} color={cat.color} strokeWidth={2.5} />
                <span className="cat-label" style={{ color: cat.color }}>
                  {t(`cat_${cat.id}`)}
                </span>
                <span className="cat-count">{items.length}</span>
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
                        style={{ flex: '0 0 105px' }}
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
                      <span
                        style={{
                          width: 3, alignSelf: 'stretch',
                          background: cat.color, borderRadius: 2, flexShrink: 0,
                          marginRight: 4,
                        }}
                      />
                      <span className="product-row-name">{product.name}</span>
                      <span className="product-row-price">{fmt(product.price)}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(product)} title={t('edit')}>
                        <Pencil size={13} />
                      </button>
                      <button
                        className="btn btn-ghost-danger btn-sm"
                        onClick={() => handleDelete(product.id)}
                        title={t('delete')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
