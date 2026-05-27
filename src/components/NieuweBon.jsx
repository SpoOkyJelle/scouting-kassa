import { useState, useEffect } from 'react'
import { ShoppingCart, Package, Zap, Search, X, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchProducts, fetchPopularProducts, createReceipt } from '../api'
import { CATEGORIES, getCat } from '../categories'

const fmt = p => `€ ${parseFloat(p).toFixed(2)}`

function SectionHead({ Icon, label, color = 'var(--muted)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: '0.6rem' }}>
      <Icon size={13} color={color} strokeWidth={2.3} />
      <span style={{ fontSize: '0.69rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        {label}
      </span>
    </div>
  )
}

export default function NieuweBon({ onCreated }) {
  const { t } = useLang()
  const [products, setProducts]           = useState([])
  const [popular, setPopular]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [productSearch, setProductSearch] = useState('')
  const [name, setName]                   = useState('')
  const [note, setNote]                   = useState('')
  const [order, setOrder]                 = useState({})
  const [saving, setSaving]               = useState(false)
  const [collapsed, setCollapsed]         = useState({})

  useEffect(() => {
    Promise.all([
      fetchProducts(),
      fetchPopularProducts().catch(() => []),
    ]).then(([prods, pop]) => {
      setProducts(prods)
      setPopular(pop)
      setLoading(false)
    })
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
    })), note.trim() || null)
    setOrder({}); setName(''); setNote(''); setSaving(false)
    onCreated(receipt.id)
  }

  if (loading) return <div className="spinner" />

  const groups = CATEGORIES.map(cat => ({
    cat,
    items: products.filter(p => (p.category || 'overig') === cat.id),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingBottom: orderItems.length ? '4.5rem' : 0 }}
      className="new-bon-wrap"
    >

      {/* ── Naam / tafelnummer ───────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '0.9rem 1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <label className="form-label">{t('receipt_name_label')}</label>
        <input
          className="form-input"
          placeholder={t('receipt_name_placeholder')}
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      {/* ── Notitie ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '0.9rem 1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <label className="form-label">{t('note')}</label>
        <textarea
          className="form-input"
          placeholder={t('note_placeholder')}
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          style={{ resize: 'vertical', minHeight: 52 }}
        />
      </div>

      <div className="new-receipt-layout">
        {/* ── Product grid ────────────────────────────────────────────────── */}
        <div>
          {/* Zoekbalk */}
          {products.length > 0 && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '0.85rem' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--s400)', pointerEvents: 'none' }} />
              <input
                className="form-input search-input"
                placeholder={t('search_products')}
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
              {productSearch && (
                <button className="search-clear" onClick={() => setProductSearch('')}>
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {products.length === 0 ? (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.5rem', color: 'var(--muted)',
            }}>
              <Package size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
              <p style={{ fontSize: '0.86rem' }}>{t('no_products_hint')}</p>
            </div>
          ) : productSearch.trim() ? (
            (() => {
              const q = productSearch.trim().toLowerCase()
              const results = products.filter(p => p.name.toLowerCase().includes(q))
              if (!results.length) return (
                <div style={{ padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)' }}>
                  <Search size={30} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
                  <p style={{ fontSize: '0.84rem' }}>{t('no_receipts')}</p>
                </div>
              )
              return (
                <div className="product-grid">
                  {results.map(p => {
                    const cat = getCat(p.category || 'overig')
                    const inOrder = !!order[p.id]
                    return (
                      <div
                        key={p.id}
                        className={`product-tile ${inOrder ? 'in-order' : ''}`}
                        style={{ borderTopColor: inOrder ? cat.color : cat.color + '60', background: inOrder ? cat.bg : 'var(--surface)' }}
                        onClick={() => addProduct(p)}
                      >
                        {inOrder && <span className="tile-qty" style={{ background: cat.color }}>{order[p.id].quantity}</span>}
                        <div className="tile-name">{p.name}</div>
                        <div className="tile-price" style={{ color: cat.color }}>{fmt(p.price)}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })()
          ) : (
            <>
              {popular.length > 0 && (
                <div style={{ marginBottom: '1.1rem' }}>
                  <SectionHead Icon={Zap} label={t('quick_select')} color="#F59E0B" />
                  <div className="quick-grid">
                    {popular.map(p => {
                      const cat = getCat(p.category || 'overig')
                      const inOrder = !!order[p.id]
                      return (
                        <div
                          key={p.id}
                          className={`quick-tile${inOrder ? ' in-order' : ''}`}
                          style={{ borderTopColor: inOrder ? cat.color : cat.color + '60' }}
                          onClick={() => addProduct(p)}
                        >
                          {inOrder && <span className="quick-tile-qty" style={{ background: cat.color }}>{order[p.id].quantity}</span>}
                          <div className="tile-name">{p.name}</div>
                          <div className="tile-price" style={{ color: cat.color }}>{fmt(p.price)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {groups.map(({ cat, items }) => {
                const { Icon } = cat
                return (
                  <div key={cat.id} style={{ marginBottom: '1.1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed[cat.id] ? 0 : '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Icon size={13} color={cat.color} strokeWidth={2.3} />
                        <span style={{ fontSize: '0.69rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          {t(`cat_${cat.id}`)}
                        </span>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 5px' }}
                        onClick={() => setCollapsed(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                      >
                        {collapsed[cat.id] ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                      </button>
                    </div>
                    {!collapsed[cat.id] && (
                      <div className="product-grid">
                        {items.map(p => {
                          const inOrder = !!order[p.id]
                          return (
                            <div
                              key={p.id}
                              className={`product-tile ${inOrder ? 'in-order' : ''}`}
                              style={{ borderTopColor: inOrder ? cat.color : cat.color + '60', background: inOrder ? cat.bg : 'var(--surface)' }}
                              onClick={() => addProduct(p)}
                            >
                              {inOrder && <span className="tile-qty" style={{ background: cat.color }}>{order[p.id].quantity}</span>}
                              <div className="tile-name">{p.name}</div>
                              <div className="tile-price" style={{ color: cat.color }}>{fmt(p.price)}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* ── Order panel ──────────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
          position: 'sticky', top: 'calc(var(--header-h) + var(--nav-h) + 1rem)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          {/* Panel header */}
          <div style={{
            background: 'linear-gradient(135deg, #052e16 0%, #166534 100%)',
            padding: '0.85rem 1rem',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <ShoppingCart size={15} color="rgba(255,255,255,0.8)" />
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff', flex: 1 }}>
              {t('order_summary')}
            </span>
            {orderItems.length > 0 && (
              <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#86efac', letterSpacing: '-0.4px' }}>
                {fmt(total)}
              </span>
            )}
          </div>

          {/* Items */}
          <div style={{ padding: '0.5rem 1rem' }}>
            {orderItems.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1.25rem 0' }}>
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
          </div>

          {/* Footer */}
          <div style={{ padding: '0 1rem 1rem' }}>
            {orderItems.length > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', marginBottom: '0.6rem',
                borderTop: '1.5px solid var(--border)',
                fontWeight: 700, fontSize: '0.86rem', color: 'var(--s700)',
              }}>
                <span>{t('total')}</span>
                <span style={{ color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 800 }}>{fmt(total)}</span>
              </div>
            )}
            <button
              className="btn btn-primary btn-full btn-lg"
              disabled={!orderItems.length || saving}
              onClick={handleCreate}
              style={{ gap: 7 }}
            >
              <PlusCircle size={15} />
              {saving ? t('loading') : t('create_receipt')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobiele floating orderbar ────────────────────────────────────── */}
      {orderItems.length > 0 && (
        <div className="mobile-order-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)' }}>
              {orderItems.reduce((s, { quantity }) => s + quantity, 0)}× items
            </span>
            <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#86efac', letterSpacing: '-0.3px' }}>
              {fmt(total)}
            </span>
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={saving}
            onClick={handleCreate}
            style={{ gap: 6, background: '#16A34A', flexShrink: 0 }}
          >
            <PlusCircle size={14} />
            {saving ? t('loading') : t('create_receipt')}
          </button>
        </div>
      )}
    </div>
  )
}
