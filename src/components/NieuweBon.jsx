import { useState, useEffect } from 'react'
import { useLang } from '../App'
import { fetchProducts, createReceipt } from '../api'
import { CATEGORIES, getCat } from '../categories'

const fmt = (price) => `€ ${parseFloat(price).toFixed(2)}`

export default function NieuweBon({ onCreated }) {
  const { t } = useLang()
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [receiptName, setName]    = useState('')
  // order: { [productId]: { product, quantity } }
  const [order, setOrder]         = useState({})
  const [submitting, setSubmit]   = useState(false)

  useEffect(() => {
    fetchProducts().then(data => { setProducts(data); setLoading(false) })
  }, [])

  function addProduct(product) {
    setOrder(prev => ({
      ...prev,
      [product.id]: prev[product.id]
        ? { ...prev[product.id], quantity: prev[product.id].quantity + 1 }
        : { product, quantity: 1 },
    }))
  }

  function setQty(productId, qty) {
    if (qty <= 0) {
      setOrder(prev => { const n = { ...prev }; delete n[productId]; return n })
    } else {
      setOrder(prev => ({ ...prev, [productId]: { ...prev[productId], quantity: qty } }))
    }
  }

  const orderItems = Object.values(order)
  const total      = orderItems.reduce((s, { product, quantity }) => s + product.price * quantity, 0)

  async function handleCreate() {
    if (!orderItems.length) return
    setSubmit(true)
    const items = orderItems.map(({ product, quantity }) => ({
      product_id:    product.id,
      product_name:  product.name,
      product_price: product.price,
      quantity,
    }))
    const receipt = await createReceipt(receiptName || null, items)
    setOrder({})
    setName('')
    setSubmit(false)
    onCreated(receipt.id)
  }

  if (loading) return <div className="spinner" />

  // Group products by category order
  const groups = CATEGORIES.map(cat => ({
    cat,
    items: products.filter(p => (p.category || 'overig') === cat.id),
  })).filter(g => g.items.length > 0)

  return (
    <div>
      {/* Optional receipt name */}
      <div className="form-group">
        <label className="form-label">{t('receipt_name_label')}</label>
        <input
          className="form-input"
          placeholder={t('receipt_name_placeholder')}
          value={receiptName}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="new-receipt-layout">
        {/* ── Left: product grid grouped by category ─────────────────────── */}
        <div>
          {products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <p>{t('no_products_hint')}</p>
            </div>
          ) : (
            groups.map(({ cat, items }) => (
              <div key={cat.id} style={{ marginBottom: '1.1rem' }}>
                {/* Category header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginBottom: '0.5rem',
                  paddingBottom: '0.3rem',
                  borderBottom: `2px solid ${cat.color}33`,
                }}>
                  <span style={{ fontSize: '1.15rem' }}>{cat.emoji}</span>
                  <span style={{ fontWeight: 800, color: cat.color, fontSize: '0.9rem' }}>
                    {t(`cat_${cat.id}`)}
                  </span>
                </div>

                <div className="product-grid">
                  {items.map(p => {
                    const inOrder = !!order[p.id]
                    return (
                      <div
                        key={p.id}
                        className={`product-tile ${inOrder ? 'in-order' : ''}`}
                        style={inOrder ? { borderColor: cat.color, background: cat.color + '15' } : {}}
                        onClick={() => addProduct(p)}
                      >
                        {inOrder && (
                          <span
                            className="tile-qty"
                            style={{ background: cat.color }}
                          >
                            ×{order[p.id].quantity}
                          </span>
                        )}
                        <div className="tile-name">{p.name}</div>
                        <div className="tile-price" style={inOrder ? { color: cat.color } : {}}>
                          {fmt(p.price)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Right: order summary ──────────────────────────────────────── */}
        <div className="order-panel">
          <p className="section-title" style={{ marginBottom: '0.7rem' }}>
            {t('order_summary')}
          </p>

          {orderItems.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', textAlign: 'center', padding: '1.2rem 0' }}>
              {t('no_items_selected')}
            </p>
          ) : (
            orderItems.map(({ product, quantity }) => {
              const cat = getCat(product.category || 'overig')
              return (
                <div key={product.id} className="order-item">
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: cat.color, flexShrink: 0,
                    }}
                  />
                  <span className="order-item-name">{product.name}</span>
                  <div className="qty-wrap">
                    <button className="qty-btn" onClick={() => setQty(product.id, quantity - 1)}>−</button>
                    <span className="qty-val">{quantity}</span>
                    <button className="qty-btn plus" onClick={() => setQty(product.id, quantity + 1)}>+</button>
                  </div>
                  <span className="order-item-price">{fmt(product.price * quantity)}</span>
                </div>
              )
            })
          )}

          <div className="total-bar">
            <span>{t('total')}</span>
            <span className="total-amount">{fmt(total)}</span>
          </div>

          <button
            className="btn btn-primary btn-full btn-lg"
            style={{ marginTop: '0.85rem' }}
            disabled={orderItems.length === 0 || submitting}
            onClick={handleCreate}
          >
            {submitting ? '…' : `🧾 ${t('create_receipt')}`}
          </button>
        </div>
      </div>
    </div>
  )
}
