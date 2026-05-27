import { useState, useEffect } from 'react'
import { ArrowLeft, Check, X, Trash2, Pencil, Calendar, Plus, Package, ChevronDown, ChevronUp } from 'lucide-react'
import { useLang } from '../App'
import {
  fetchReceipt, fetchProducts, updateReceipt, deleteReceipt,
  addReceiptItem, updateReceiptItem, deleteReceiptItem,
} from '../api'
import { CATEGORIES, getCat } from '../categories'

const fmt = p => `€ ${parseFloat(p).toFixed(2)}`

function fmtDate(str) {
  return new Date(str).toLocaleString(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function BonDetail({ id, onBack }) {
  const { t } = useLang()
  const [receipt, setReceipt]         = useState(null)
  const [products, setProducts]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [showAdd, setShowAdd]         = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchReceipt(id), fetchProducts()]).then(([rec, prods]) => {
      setReceipt(rec); setProducts(prods); setLoading(false)
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
        product_id: product.id, product_name: product.name,
        product_price: product.price, quantity: 1,
      })
      setReceipt(prev => ({ ...prev, items: [...prev.items, newItem] }))
    }
  }

  if (loading) return <div className="spinner" />
  if (!receipt) return null

  const total = receipt.items?.reduce((s, i) => s + i.product_price * i.quantity, 0) ?? 0
  const productCatMap = Object.fromEntries(products.map(p => [p.id, p.category || 'overig']))

  const groups = CATEGORIES.map(cat => ({
    cat,
    items: products.filter(p => (p.category || 'overig') === cat.id),
  })).filter(g => g.items.length > 0)

  return (
    <div>
      {/* Back */}
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: '0.85rem' }}>
        <ArrowLeft size={14} /> {t('back')}
      </button>

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div className="detail-header">
        <div style={{ flex: 1, minWidth: 0 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="detail-title">
                {receipt.name || `${t('receipt_number')} #${receipt.id}`}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                title={t('edit_name')}
                onClick={() => { setNameInput(receipt.name ?? ''); setEditingName(true) }}
                style={{ padding: '4px 6px' }}
              >
                <Pencil size={13} />
              </button>
            </div>
          )}
          <div className="detail-meta">
            <Calendar size={11} />
            {t('created')}: {fmtDate(receipt.created_at)}
          </div>
          <div style={{ marginTop: 8 }}>
            <span className={`badge ${receipt.paid ? 'badge-paid' : 'badge-unpaid'}`}>
              {receipt.paid
                ? <><Check size={10} /> {t('paid')}</>
                : <><X size={10} /> {t('unpaid')}</>}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
          <button
            className={`btn ${receipt.paid ? 'btn-warning' : 'btn-success'}`}
            onClick={togglePaid}
          >
            {receipt.paid
              ? <><X size={13} /> {t('mark_unpaid')}</>
              : <><Check size={13} /> {t('mark_paid')}</>}
          </button>
          <button className="btn btn-ghost-danger btn-sm" onClick={handleDelete}>
            <Trash2 size={13} /> {t('delete_receipt')}
          </button>
        </div>
      </div>

      {/* ── Items table ─────────────────────────────────────────────────── */}
      <div className="items-box">
        <div className="items-head">
          <span>{t('product_name')}</span>
          <span style={{ textAlign: 'center' }}>{t('qty')}</span>
          <span style={{ textAlign: 'right' }}>{t('price')}</span>
          <span style={{ textAlign: 'right' }}>{t('subtotal')}</span>
        </div>

        {(!receipt.items?.length) && (
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            <p>{t('no_items')}</p>
          </div>
        )}

        {receipt.items?.map(item => {
          const cat = getCat(productCatMap[item.product_id] ?? 'overig')
          return (
            <div key={item.id} className="items-row">
              <span style={{ fontWeight: 500, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span
                  style={{ width: 3, height: 16, borderRadius: 2, background: cat.color, flexShrink: 0 }}
                />
                {item.product_name}
              </span>
              <div className="qty-wrap" style={{ justifyContent: 'center' }}>
                <button className="qty-btn" onClick={() => changeQty(item, -1)}>−</button>
                <span className="qty-val">{item.quantity}</span>
                <button className="qty-btn plus" onClick={() => changeQty(item, 1)}>+</button>
              </div>
              <span className="col-right" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                {fmt(item.product_price)}
              </span>
              <span className="col-right" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
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

      {/* ── Add more ─────────────────────────────────────────────────────── */}
      <button
        className="btn btn-outline btn-full"
        onClick={() => setShowAdd(v => !v)}
        style={{ marginBottom: '0.75rem' }}
      >
        {showAdd ? <><ChevronUp size={14} /> {t('cancel')}</> : <><Plus size={14} /> {t('add_more')}</>}
      </button>

      {showAdd && (
        <div className="add-panel">
          {products.length === 0 ? (
            <div className="empty-state">
              <Package size={30} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
              <p>{t('no_products_hint')}</p>
            </div>
          ) : (
            groups.map(({ cat, items }) => {
              const { Icon } = cat
              return (
                <div key={cat.id} style={{ marginBottom: '0.9rem' }}>
                  <div className="cat-header">
                    <Icon size={13} color={cat.color} strokeWidth={2.5} />
                    <span className="cat-label" style={{ color: cat.color }}>{t(`cat_${cat.id}`)}</span>
                  </div>
                  <div className="product-grid">
                    {items.map(p => (
                      <div
                        key={p.id}
                        className="product-tile"
                        style={{ borderTopColor: cat.color + '70' }}
                        onClick={() => addProduct(p)}
                      >
                        <div className="tile-name">{p.name}</div>
                        <div className="tile-price" style={{ color: cat.color }}>{fmt(p.price)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
