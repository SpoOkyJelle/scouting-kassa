import { useState, useEffect } from 'react'
import { useLang } from '../App'
import {
  fetchReceipt, fetchProducts, updateReceipt, deleteReceipt,
  addReceiptItem, updateReceiptItem, deleteReceiptItem,
} from '../api'
import { CATEGORIES, getCat } from '../categories'

const fmt = (price) => `€ ${parseFloat(price).toFixed(2)}`

function fmtDate(str) {
  return new Date(str).toLocaleString(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function BonDetail({ id, onBack }) {
  const { t } = useLang()
  const [receipt, setReceipt]   = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchReceipt(id), fetchProducts()]).then(([rec, prods]) => {
      setReceipt(rec)
      setProducts(prods)
      setLoading(false)
    })
  }, [id])

  async function togglePaid() {
    const updated = await updateReceipt(id, { paid: !receipt.paid })
    setReceipt(prev => ({ ...prev, ...updated }))
  }

  async function handleDelete() {
    if (!confirm(t('confirm_delete'))) return
    await deleteReceipt(id)
    onBack()
  }

  async function saveName() {
    const updated = await updateReceipt(id, { name: nameInput || null })
    setReceipt(prev => ({ ...prev, ...updated }))
    setEditingName(false)
  }

  async function changeQty(item, delta) {
    const newQty = item.quantity + delta
    if (newQty <= 0) {
      await deleteReceiptItem(id, item.id)
      setReceipt(prev => ({ ...prev, items: prev.items.filter(i => i.id !== item.id) }))
    } else {
      await updateReceiptItem(id, item.id, newQty)
      setReceipt(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === item.id ? { ...i, quantity: newQty } : i),
      }))
    }
  }

  async function addProduct(product) {
    const existing = receipt.items.find(i => i.product_id === product.id)
    if (existing) {
      await changeQty(existing, 1)
    } else {
      const newItem = await addReceiptItem(id, {
        product_id:    product.id,
        product_name:  product.name,
        product_price: product.price,
        quantity:      1,
      })
      setReceipt(prev => ({ ...prev, items: [...prev.items, newItem] }))
    }
  }

  if (loading) return <div className="spinner" />
  if (!receipt) return null

  const total = receipt.items?.reduce((s, i) => s + i.product_price * i.quantity, 0) ?? 0

  // For the add-more panel: group products by category
  const groups = CATEGORIES.map(cat => ({
    cat,
    items: products.filter(p => (p.category || 'overig') === cat.id),
  })).filter(g => g.items.length > 0)

  // Build a quick lookup: product_id → category
  const productCatMap = Object.fromEntries(products.map(p => [p.id, p.category || 'overig']))

  return (
    <div>
      {/* Back */}
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '0.75rem' }}>
        ← {t('back')}
      </button>

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div className="detail-header">
        <div>
          {editingName ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                className="form-input"
                style={{ flex: '1 1 180px' }}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && saveName()}
              />
              <button className="btn btn-primary btn-sm" onClick={saveName}>{t('save')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(false)}>{t('cancel')}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="detail-title">
                {receipt.name || `${t('receipt_number')} #${receipt.id}`}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                title={t('edit_name')}
                onClick={() => { setNameInput(receipt.name ?? ''); setEditingName(true) }}
              >✏️</button>
            </div>
          )}
          <p className="detail-meta">{t('created')}: {fmtDate(receipt.created_at)}</p>
          <div style={{ marginTop: 8 }}>
            <span className={`badge ${receipt.paid ? 'badge-paid' : 'badge-unpaid'}`}>
              {receipt.paid ? t('paid') : t('unpaid')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-end' }}>
          <button
            className={`btn ${receipt.paid ? 'btn-warning' : 'btn-success'}`}
            onClick={togglePaid}
          >
            {receipt.paid ? `✕ ${t('mark_unpaid')}` : `✓ ${t('mark_paid')}`}
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>
            🗑️ {t('delete_receipt')}
          </button>
        </div>
      </div>

      {/* ── Items table ─────────────────────────────────────────────────── */}
      <div className="items-box">
        <div className="items-head">
          <span>{t('product_name')}</span>
          <span style={{ textAlign: 'center' }}>{t('qty')}</span>
          <span style={{ textAlign: 'right'  }}>{t('price')}</span>
          <span style={{ textAlign: 'right'  }}>{t('subtotal')}</span>
        </div>

        {(!receipt.items || receipt.items.length === 0) && (
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            {t('no_items')}
          </div>
        )}

        {receipt.items?.map(item => {
          const cat = getCat(productCatMap[item.product_id] ?? 'overig')
          return (
            <div key={item.id} className="items-row">
              <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: cat.color, flexShrink: 0,
                  }}
                  title={t(`cat_${cat.id}`)}
                />
                {item.product_name}
              </span>
              <div className="qty-wrap" style={{ justifyContent: 'center' }}>
                <button className="qty-btn" onClick={() => changeQty(item, -1)}>−</button>
                <span className="qty-val">{item.quantity}</span>
                <button className="qty-btn plus" onClick={() => changeQty(item, 1)}>+</button>
              </div>
              <span className="col-right" style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                {fmt(item.product_price)}
              </span>
              <span className="col-right" style={{ fontWeight: 700 }}>
                {fmt(item.product_price * item.quantity)}
              </span>
            </div>
          )
        })}

        <div className="items-total">
          <span>{t('total')}</span>
          <span className="grand-total">{fmt(total)}</span>
        </div>
      </div>

      {/* ── Add more products ────────────────────────────────────────────── */}
      <button
        className="btn btn-outline btn-full"
        onClick={() => setShowAdd(prev => !prev)}
        style={{ marginBottom: '0.75rem' }}
      >
        {showAdd ? `▲ ${t('cancel')}` : `+ ${t('add_more')}`}
      </button>

      {showAdd && (
        <div className="add-panel">
          {products.length === 0 ? (
            <div className="empty-state"><p>{t('no_products_hint')}</p></div>
          ) : (
            groups.map(({ cat, items }) => (
              <div key={cat.id} style={{ marginBottom: '1rem' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginBottom: '0.5rem',
                  paddingBottom: '0.3rem',
                  borderBottom: `2px solid ${cat.color}33`,
                }}>
                  <span style={{ fontSize: '1.1rem' }}>{cat.emoji}</span>
                  <span style={{ fontWeight: 800, color: cat.color, fontSize: '0.88rem' }}>
                    {t(`cat_${cat.id}`)}
                  </span>
                </div>
                <div className="product-grid">
                  {items.map(p => (
                    <div key={p.id} className="product-tile" onClick={() => addProduct(p)}
                         style={{ '--cat-color': cat.color }}>
                      <div className="tile-name">{p.name}</div>
                      <div className="tile-price" style={{ color: cat.color }}>{fmt(p.price)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
