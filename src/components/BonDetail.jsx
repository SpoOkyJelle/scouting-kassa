import { useState, useEffect } from 'react'
import {
  ArrowLeft, Check, X, Trash2, Pencil, Calendar, Plus, Package,
  ChevronDown, ChevronUp, Printer, QrCode, Monitor, Calculator, StickyNote, Search,
} from 'lucide-react'
import { useLang } from '../LangContext'
import {
  fetchReceipt, fetchProducts, updateReceipt, deleteReceipt,
  addReceiptItem, updateReceiptItem, deleteReceiptItem,
} from '../api'
import { CATEGORIES, getCat } from '../categories'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'
import PaymentModal from './PaymentModal'
import KioskScreen from './KioskScreen'

const fmt = p => `€ ${parseFloat(p).toFixed(2)}`

function fmtDate(str) {
  return new Date(str).toLocaleString(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

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

export default function BonDetail({ id, onBack }) {
  const { t } = useLang()
  const showToast  = useToast()
  const confirm    = useConfirm()

  const [receipt, setReceipt]               = useState(null)
  const [products, setProducts]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [showAdd, setShowAdd]               = useState(false)
  const [editingName, setEditingName]       = useState(false)
  const [nameInput, setNameInput]           = useState('')
  const [showPayment, setShowPayment]       = useState(false)
  const [showKiosk, setShowKiosk]           = useState(false)
  const [received, setReceived]             = useState('')
  const [discountInput, setDiscountInput]   = useState('0')
  const [savingDiscount, setSavingDiscount] = useState(false)
  const [editingNote, setEditingNote]       = useState(false)
  const [noteInput, setNoteInput]           = useState('')
  const [addSearch, setAddSearch]           = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchReceipt(id), fetchProducts()]).then(([rec, prods]) => {
      setReceipt(rec)
      setProducts(prods)
      setDiscountInput(String(rec.discount_pct || 0))
      setNoteInput(rec.note || '')
      setLoading(false)
    })
  }, [id])

  async function togglePaid() {
    const updated = await updateReceipt(id, { paid: !receipt.paid })
    setReceipt(prev => ({ ...prev, ...updated }))
    showToast(updated.paid ? t('toast_marked_paid') : t('toast_marked_unpaid'))
  }

  async function handleDelete() {
    const ok = await confirm(t('confirm_delete'))
    if (!ok) return
    await deleteReceipt(id)
    showToast(t('toast_deleted'), 'info')
    onBack()
  }

  async function saveName() {
    const updated = await updateReceipt(id, { name: nameInput || null })
    setReceipt(prev => ({ ...prev, ...updated }))
    setEditingName(false)
    showToast(t('toast_saved'))
  }

  async function saveNote() {
    const updated = await updateReceipt(id, { note: noteInput.trim() || null })
    setReceipt(prev => ({ ...prev, ...updated }))
    setEditingNote(false)
    showToast(t('toast_saved'))
  }

  async function saveDiscount() {
    const pct = Math.max(0, Math.min(100, parseFloat(discountInput) || 0))
    setSavingDiscount(true)
    const updated = await updateReceipt(id, { discount_pct: pct })
    setReceipt(prev => ({ ...prev, ...updated }))
    setSavingDiscount(false)
    showToast(t('toast_saved'))
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

  const subtotal    = receipt.items?.reduce((s, i) => s + i.product_price * i.quantity, 0) ?? 0
  const discountAmt = subtotal * (receipt.discount_pct || 0) / 100
  const total       = subtotal - discountAmt

  const receivedNum = parseFloat(received) || 0
  const change      = received.trim() !== '' ? receivedNum - total : null

  const productCatMap = Object.fromEntries(products.map(p => [p.id, p.category || 'overig']))
  const groups = CATEGORIES.map(cat => ({
    cat,
    items: products.filter(p => (p.category || 'overig') === cat.id),
  })).filter(g => g.items.length > 0)

  const receiptTitle = receipt.name || `${t('receipt_number')} #${receipt.id}`
  const isPaid = !!receipt.paid

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {showPayment && <PaymentModal onClose={() => setShowPayment(false)} />}
      {showKiosk   && <KioskScreen total={total} name={receiptTitle} onClose={() => setShowKiosk(false)} />}

      {/* Back */}
      <button className="btn btn-ghost btn-sm no-print" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} /> {t('back')}
      </button>

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div style={{
        background: isPaid
          ? 'linear-gradient(135deg, #052e16 0%, #14532d 60%, #166534 100%)'
          : 'linear-gradient(135deg, #451a03 0%, #78350f 60%, #92400e 100%)',
        borderRadius: 14,
        padding: '1.1rem 1.25rem',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 50, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, position: 'relative' }}>
          {/* Left: title + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingName ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                <input
                  className="form-input"
                  style={{ flex: '1 1 180px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  placeholder={receiptTitle}
                />
                <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }} onClick={saveName}>{t('save')}</button>
                <button className="btn btn-sm" style={{ background: 'rgba(0,0,0,0.2)', color: 'rgba(255,255,255,0.7)', border: 'none' }} onClick={() => setEditingName(false)}>{t('cancel')}</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                  {receiptTitle}
                </span>
                <button
                  className="btn btn-ghost btn-sm no-print"
                  onClick={() => { setNameInput(receipt.name ?? ''); setEditingName(true) }}
                  style={{ padding: '3px 5px', color: 'rgba(255,255,255,0.5)' }}
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} />
              {fmtDate(receipt.created_at)}
            </div>

            {/* Status badge */}
            <div style={{ marginTop: 10 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20,
                fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
              }}>
                {isPaid ? <><Check size={11} /> {t('paid')}</> : <><X size={11} /> {t('unpaid')}</>}
              </span>
            </div>
          </div>

          {/* Right: total + actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 900, letterSpacing: '-0.5px', color: isPaid ? '#86efac' : '#fcd34d' }}>
              {fmt(total)}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!isPaid && (
                <button
                  className="btn btn-sm no-print"
                  onClick={() => setShowPayment(true)}
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', gap: 5 }}
                >
                  <QrCode size={13} /> {t('payment_btn')}
                </button>
              )}
              <button
                className="btn btn-sm no-print"
                onClick={togglePaid}
                style={{
                  background: isPaid ? 'rgba(217,119,6,0.25)' : 'rgba(255,255,255,0.2)',
                  color: '#fff', border: `1px solid ${isPaid ? 'rgba(217,119,6,0.4)' : 'rgba(255,255,255,0.25)'}`,
                  gap: 5,
                }}
              >
                {isPaid ? <><X size={12} /> {t('mark_unpaid')}</> : <><Check size={12} /> {t('mark_paid')}</>}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button className="btn btn-ghost btn-sm no-print" onClick={() => setShowKiosk(true)} style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.08)', fontSize: '0.72rem' }}>
                <Monitor size={12} /> {t('kiosk_mode')}
              </button>
              <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()} style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.08)' }}>
                <Printer size={12} />
              </button>
              <button className="btn btn-ghost btn-sm no-print" onClick={handleDelete} style={{ color: '#fca5a5', background: 'rgba(220,38,38,0.2)' }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notitie ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderLeft: '3px solid #F59E0B', borderRadius: 12,
        padding: '0.75rem 1rem',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <StickyNote size={14} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 2 }} />
        {editingNote ? (
          <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'flex-start' }}>
            <textarea
              className="form-input"
              style={{ flex: 1, resize: 'vertical', minHeight: 56, fontSize: '0.84rem' }}
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder={t('note_placeholder')}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveNote() }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button className="btn btn-primary btn-sm" onClick={saveNote}>{t('save')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditingNote(false); setNoteInput(receipt.note || '') }}>{t('cancel')}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flex: 1 }}>
            <span style={{
              flex: 1, fontSize: '0.84rem', lineHeight: 1.45,
              color: receipt.note ? 'var(--s800)' : 'var(--s400)',
              fontStyle: receipt.note ? 'normal' : 'italic',
              whiteSpace: 'pre-wrap',
            }}>
              {receipt.note || t('note_placeholder')}
            </span>
            <button
              className="btn btn-ghost btn-sm no-print"
              onClick={() => { setNoteInput(receipt.note || ''); setEditingNote(true) }}
              style={{ padding: '3px 6px', flexShrink: 0 }}
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
      </div>

      {/* ── Items table ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div className="items-head">
          <span>{t('product_name')}</span>
          <span style={{ textAlign: 'center' }}>{t('qty')}</span>
          <span style={{ textAlign: 'right' }}>{t('price')}</span>
          <span style={{ textAlign: 'right' }}>{t('subtotal')}</span>
        </div>

        {(!receipt.items?.length) && (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.84rem' }}>
            {t('no_items')}
          </div>
        )}

        {receipt.items?.map(item => {
          const cat = getCat(productCatMap[item.product_id] ?? 'overig')
          return (
            <div key={item.id} className="items-row">
              <span style={{ fontWeight: 500, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 3, height: 16, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                {item.product_name}
              </span>
              <div className="qty-wrap no-print" style={{ justifyContent: 'center' }}>
                <button className="qty-btn" onClick={() => changeQty(item, -1)}>−</button>
                <span className="qty-val">{item.quantity}</span>
                <button className="qty-btn plus" onClick={() => changeQty(item, 1)}>+</button>
              </div>
              <span className="qty-val print-only" style={{ textAlign: 'center', display: 'none' }}>{item.quantity}</span>
              <span className="col-right" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{fmt(item.product_price)}</span>
              <span className="col-right" style={{ fontWeight: 700, fontSize: '0.86rem' }}>{fmt(item.product_price * item.quantity)}</span>
            </div>
          )
        })}

        {receipt.discount_pct > 0 && (
          <>
            <div className="items-row" style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              <span style={{ gridColumn: '1 / 4' }}>{t('original')}</span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(subtotal)}</span>
            </div>
            <div className="items-row" style={{ fontSize: '0.82rem', color: 'var(--danger)' }}>
              <span style={{ gridColumn: '1 / 4' }}>{t('discount')} ({receipt.discount_pct}%)</span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>−{fmt(discountAmt)}</span>
            </div>
          </>
        )}

        <div className="items-total">
          <span>{t('total')}</span>
          <span className="grand-total">{fmt(total)}</span>
        </div>
      </div>

      {/* ── Korting + Wisselgeld side-by-side ───────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Korting */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '0.85rem 1rem', flex: '1 1 180px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }} className="no-print">
          <SectionHead Icon={Pencil} label={t('discount_pct')} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number"
              className="form-input discount-input"
              value={discountInput}
              onChange={e => setDiscountInput(e.target.value)}
              min="0" max="100" step="1"
              onKeyDown={e => e.key === 'Enter' && saveDiscount()}
              style={{ width: 80 }}
            />
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>%</span>
            <button className="btn btn-sm btn-outline" onClick={saveDiscount} disabled={savingDiscount}>
              {t('save')}
            </button>
          </div>
        </div>

        {/* Wisselgeld */}
        {!receipt.paid && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '0.85rem 1rem', flex: '1 1 200px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }} className="no-print">
            <SectionHead Icon={Calculator} label={t('change_calc')} />
            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
              {[5, 10, 20, 50].map(amt => (
                <button
                  key={amt}
                  className="btn btn-sm btn-outline"
                  style={{ flex: '1 1 auto', minWidth: 44 }}
                  onClick={() => setReceived(prev => String((parseFloat(prev) || 0) + amt))}
                >
                  €{amt}
                </button>
              ))}
              <button
                className="btn btn-sm btn-outline"
                style={{ flex: '1 1 auto', minWidth: 44, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => setReceived('')}
              >
                <X size={13} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                className="form-input"
                style={{ width: 130 }}
                placeholder={t('received')}
                value={received}
                onChange={e => setReceived(e.target.value)}
                min="0" step="0.01"
              />
              {change !== null && (
                <div style={{
                  fontWeight: 800, fontSize: '1rem',
                  color: change >= 0 ? '#16A34A' : 'var(--danger)',
                }}>
                  {change === 0 ? t('change_exact') : `${t('change')}: € ${Math.abs(change).toFixed(2)}`}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Meer toevoegen ───────────────────────────────────────────────── */}
      <button
        className="btn btn-outline btn-full no-print"
        onClick={() => { setShowAdd(v => !v); setAddSearch('') }}
        style={{ borderRadius: 12, gap: 7 }}
      >
        {showAdd
          ? <><ChevronUp size={14} /> {t('cancel')}</>
          : <><Plus size={14} /> {t('add_more')}</>}
      </button>

      {showAdd && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }} className="no-print">
          {products.length === 0 ? (
            <div style={{ padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)' }}>
              <Package size={30} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
              <p style={{ fontSize: '0.84rem' }}>{t('no_products_hint')}</p>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '0.85rem' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--s400)', pointerEvents: 'none' }} />
                <input
                  className="form-input search-input"
                  placeholder={t('search_products')}
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  autoFocus
                />
                {addSearch && (
                  <button className="search-clear" onClick={() => setAddSearch('')}>
                    <X size={13} />
                  </button>
                )}
              </div>
              {(() => {
                const q = addSearch.trim().toLowerCase()
                if (q) {
                  const results = products.filter(p => p.name.toLowerCase().includes(q))
                  if (!results.length) return (
                    <p style={{ fontSize: '0.84rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem 0' }}>
                      {t('no_receipts')}
                    </p>
                  )
                  return (
                    <div className="product-grid">
                      {results.map(p => {
                        const cat = getCat(p.category || 'overig')
                        return (
                          <div key={p.id} className="product-tile" style={{ borderTopColor: cat.color + '70' }} onClick={() => addProduct(p)}>
                            <div className="tile-name">{p.name}</div>
                            <div className="tile-price" style={{ color: cat.color }}>{fmt(p.price)}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                }
                return groups.map(({ cat, items }) => {
                  const { Icon } = cat
                  return (
                    <div key={cat.id} style={{ marginBottom: '0.9rem' }}>
                      <SectionHead Icon={Icon} label={t(`cat_${cat.id}`)} color={cat.color} />
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
              })()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
