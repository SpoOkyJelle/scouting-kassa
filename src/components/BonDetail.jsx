import { useState, useEffect } from 'react'
import {
  ArrowLeft, Check, X, Trash2, Pencil, Calendar, Plus, Package,
  ChevronDown, ChevronUp, Printer, QrCode, Monitor, Calculator, StickyNote,
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

export default function BonDetail({ id, onBack }) {
  const { t } = useLang()
  const showToast  = useToast()
  const confirm    = useConfirm()

  const [receipt, setReceipt]             = useState(null)
  const [products, setProducts]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [showAdd, setShowAdd]             = useState(false)
  const [editingName, setEditingName]     = useState(false)
  const [nameInput, setNameInput]         = useState('')
  const [showPayment, setShowPayment]     = useState(false)
  const [showKiosk, setShowKiosk]         = useState(false)
  const [received, setReceived]           = useState('')
  const [discountInput, setDiscountInput] = useState('0')
  const [savingDiscount, setSavingDiscount] = useState(false)
  const [editingNote, setEditingNote]     = useState(false)
  const [noteInput, setNoteInput]         = useState('')

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

  return (
    <div>
      {/* Overlays */}
      {showPayment && <PaymentModal onClose={() => setShowPayment(false)} />}
      {showKiosk   && <KioskScreen total={total} name={receiptTitle} onClose={() => setShowKiosk(false)} />}

      {/* Back */}
      <button className="btn btn-ghost btn-sm no-print" onClick={onBack} style={{ marginBottom: '0.85rem' }}>
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
              <span className="detail-title">{receiptTitle}</span>
              <button
                className="btn btn-ghost btn-sm no-print"
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
          {/* Payment request button — only shown for unpaid receipts */}
          {!receipt.paid && (
            <button
              className="btn btn-primary no-print"
              onClick={() => setShowPayment(true)}
              style={{ gap: 7 }}
            >
              <QrCode size={14} /> {t('payment_btn')}
            </button>
          )}
          <button
            className={`btn ${receipt.paid ? 'btn-warning' : 'btn-success'} no-print`}
            onClick={togglePaid}
          >
            {receipt.paid
              ? <><X size={13} /> {t('mark_unpaid')}</>
              : <><Check size={13} /> {t('mark_paid')}</>}
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-ghost btn-sm no-print"
              onClick={() => setShowKiosk(true)}
              title={t('kiosk_mode')}
            >
              <Monitor size={13} /> {t('kiosk_mode')}
            </button>
            <button
              className="btn btn-ghost btn-sm no-print"
              onClick={() => window.print()}
              title={t('print')}
            >
              <Printer size={13} /> {t('print')}
            </button>
            <button className="btn btn-ghost-danger btn-sm no-print" onClick={handleDelete}>
              <Trash2 size={13} /> {t('delete_receipt')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Notitie ─────────────────────────────────────────────────────── */}
      <div className="note-row">
        <StickyNote size={14} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }} />
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
              title={t('note')}
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
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
              <div className="qty-wrap no-print" style={{ justifyContent: 'center' }}>
                <button className="qty-btn" onClick={() => changeQty(item, -1)}>−</button>
                <span className="qty-val">{item.quantity}</span>
                <button className="qty-btn plus" onClick={() => changeQty(item, 1)}>+</button>
              </div>
              <span className="qty-val print-only" style={{ textAlign: 'center', display: 'none' }}>
                {item.quantity}
              </span>
              <span className="col-right" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                {fmt(item.product_price)}
              </span>
              <span className="col-right" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                {fmt(item.product_price * item.quantity)}
              </span>
            </div>
          )
        })}

        {/* Discount rows */}
        {receipt.discount_pct > 0 && (
          <>
            <div className="items-row" style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              <span style={{ gridColumn: '1 / 4' }}>{t('original')}</span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(subtotal)}</span>
            </div>
            <div className="items-row" style={{ fontSize: '0.82rem', color: 'var(--danger)' }}>
              <span style={{ gridColumn: '1 / 4' }}>
                {t('discount')} ({receipt.discount_pct}%)
              </span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>−{fmt(discountAmt)}</span>
            </div>
          </>
        )}

        <div className="items-total">
          <span>{t('total')}</span>
          <span className="grand-total">{fmt(total)}</span>
        </div>
      </div>

      {/* ── Korting (discount) ──────────────────────────────────────────── */}
      <div className="discount-row no-print">
        <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--s700)' }}>
          {t('discount_pct')}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number"
            className="form-input discount-input"
            value={discountInput}
            onChange={e => setDiscountInput(e.target.value)}
            min="0" max="100" step="1"
            onKeyDown={e => e.key === 'Enter' && saveDiscount()}
          />
          <button
            className="btn btn-sm btn-outline"
            onClick={saveDiscount}
            disabled={savingDiscount}
          >
            {t('save')}
          </button>
        </div>
      </div>

      {/* ── Wisselgeld ──────────────────────────────────────────────────── */}
      {!receipt.paid && (
        <div className="change-box no-print">
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calculator size={13} />
            {t('change_calc')}
          </p>
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
              <div className={`change-result ${change >= 0 ? 'change-pos' : 'change-neg'}`}>
                {change === 0
                  ? t('change_exact')
                  : `${t('change')}: ${fmt(Math.abs(change))}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add more ─────────────────────────────────────────────────────── */}
      <button
        className="btn btn-outline btn-full no-print"
        onClick={() => setShowAdd(v => !v)}
        style={{ marginBottom: '0.75rem' }}
      >
        {showAdd ? <><ChevronUp size={14} /> {t('cancel')}</> : <><Plus size={14} /> {t('add_more')}</>}
      </button>

      {showAdd && (
        <div className="add-panel no-print">
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
