import { useState, useEffect } from 'react'
import { ShoppingCart, Package } from 'lucide-react'
import { useLang } from '../App'
import { fetchProducts, createReceipt } from '../api'
import { CATEGORIES, getCat } from '../categories'

const fmt = p => `€ ${parseFloat(p).toFixed(2)}`

export default function NieuweBon({ onCreated }) {
  const { t } = useLang()
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [name, setName]         = useState('')
  const [order, setOrder]       = useState({})   // { [productId]: { product, quantity } }
  const [saving, setSaving]     = useState(false)

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
    setSaving(true)
    const receipt = await createReceipt(name || null, orderItems.map(({ product, quantity }) => ({
      product_id: product.id, product_name: product.name,
      product_price: product.price, quantity,
    })))
    setOrder({}); setName(''); setSaving(false)
    onCreated(receipt.id)
  }

  if (loading) return <div className="spinner" />

  const groups = CATEGORIES.map(cat => ({
    cat,
    items: products.filter(p => (p.category || 'overig') === cat.id),
  })).filter(g => g.items.length > 0)

  return (
    <div>
      {/* Optional name */}
      <div className="form-group">
        <label className="form-label">{t('receipt_name_label')}</label>
        <input
          className="form-input"
          placeholder={t('receipt_name_placeholder')}
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="new-receipt-layout">
        {/* ── Product grid ────────────────────────────────────────────────── */}
        <div>
          {products.length === 0 ? (
            <div className="empty-state">
              <Package size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
              <p>{t('no_products_hint')}</p>
            </div>
          ) : (
            groups.map(({ cat, items }) => {
              const { Icon } = cat
              return (
                <div key={cat.id} style={{ marginBottom: '1.1rem' }}>
                  <div className="cat-header">
                    <Icon size={14} color={cat.color} strokeWidth={2.5} />
                    <span className="cat-label" style={{ color: cat.color }}>
                      {t(`cat_${cat.id}`)}
                    </span>
                    <span className="cat-count">{items.length}</span>
                  </div>
                  <div className="product-grid">
                    {items.map(p => {
                      const inOrder = !!order[p.id]
                      return (
                        <div
                          key={p.id}
                          className={`product-tile ${inOrder ? 'in-order' : ''}`}
                          style={{
                            borderTopColor: inOrder ? cat.color : cat.color + '60',
                            background: inOrder ? cat.bg : '#fff',
                          }}
                          onClick={() => addProduct(p)}
                        >
                          {inOrder && (
                            <span className="tile-qty" style={{ background: cat.color }}>
                              {order[p.id].quantity}
                            </span>
                          )}
                          <div className="tile-name">{p.name}</div>
                          <div className="tile-price" style={{ color: cat.color }}>
                            {fmt(p.price)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Order summary ────────────────────────────────────────────────── */}
        <div className="order-panel">
          <p className="section-title" style={{ marginBottom: '0.7rem' }}>
            <ShoppingCart size={15} />
            {t('order_summary')}
          </p>

          {orderItems.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem 0' }}>
              {t('no_items_selected')}
            </p>
          ) : (
            orderItems.map(({ product, quantity }) => {
              const cat = getCat(product.category || 'overig')
              return (
                <div key={product.id} className="order-item">
                  <span className="order-item-dot" style={{ background: cat.color }} />
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
            style={{ marginTop: '0.75rem' }}
            disabled={!orderItems.length || saving}
            onClick={handleCreate}
          >
            {saving ? t('loading') : t('create_receipt')}
          </button>
        </div>
      </div>
    </div>
  )
}
