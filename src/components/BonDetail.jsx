import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, Check, X, Trash2, Pencil, Calendar, Plus, Package,
  ChevronDown, ChevronUp, Printer, QrCode, Monitor, Calculator, StickyNote, Search, Heart,
  Banknote, CreditCard, Smartphone, Layers,
} from 'lucide-react'
import { useLang } from '../LangContext'
import {
  fetchReceipt, fetchProducts, updateReceipt, deleteReceipt,
  addReceiptItem, updateReceiptItem, deleteReceiptItem,
  updateDisplay, clearDisplay,
} from '../api'
import { useSettings } from '../SettingsContext'
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
  const { t }      = useLang()
  const settings   = useSettings()
  const showToast  = useToast()
  const confirm    = useConfirm()

  const [receipt, setReceipt]               = useState(null)
  const [products, setProducts]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [showAdd, setShowAdd]               = useState(false)
  const [showSplitPay, setShowSplitPay]     = useState(false)
  const [splitAmounts, setSplitAmounts]     = useState({ contant: '', pin: '', qr: '' })
  const [savingPayment, setSavingPayment]   = useState(false)
  const [editingName, setEditingName]       = useState(false)
  const [nameInput, setNameInput]           = useState('')
  const [showPayment, setShowPayment]       = useState(false)
  const [showKiosk, setShowKiosk]           = useState(false)
  const [received, setReceived]             = useState('')
  const [discountInput, setDiscountInput]   = useState('0')
  const [savingDiscount, setSavingDiscount] = useState(false)
  const [donationInput, setDonationInput]   = useState('0')
  const [savingDonation, setSavingDonation] = useState(false)
  const [editingNote, setEditingNote]       = useState(false)
  const [noteInput, setNoteInput]           = useState('')
  const [addSearch, setAddSearch]           = useState('')

  // Ref zodat de heartbeat altijd de meest recente receipt heeft
  const receiptRef          = useRef(null)
  const paymentRequestedRef = useRef(false)
  const [showPayOnDisplay, setShowPayOnDisplay] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchReceipt(id), fetchProducts()]).then(([rec, prods]) => {
      setReceipt(rec)
      receiptRef.current = rec
      setProducts(prods)
      setDiscountInput(String(rec.discount_pct || 0))
      setDonationInput(String(rec.donation || 0))
      setNoteInput(rec.note || '')
      setLoading(false)
    })
  }, [id])

  // Heartbeat: push elke 1,5s naar klantenscherm, gebruikt altijd de meest recente receipt via ref
  useEffect(() => {
    const iv = setInterval(() => {
      if (receiptRef.current) pushToDisplay(receiptRef.current)
    }, 1500)
    return () => clearInterval(iv)
  }, [])

  // Zet receipt state én ref tegelijk
  function setReceiptAndRef(rec) {
    receiptRef.current = rec
    setReceipt(rec)
  }

  // Helper: stuur huidige bon naar klantenscherm
  function pushToDisplay(rec) {
    if (!rec) return
    const sub  = (rec.items || []).reduce((s, i) => s + i.product_price * i.quantity, 0)
    const disc = sub * (rec.discount_pct || 0) / 100
    const tot  = sub - disc
    const don  = rec.donation || 0
    updateDisplay({
      active: true, id: rec.id, name: rec.name,
      items: (rec.items || []).map(i => ({
        name: i.product_name, qty: i.quantity,
        price: i.product_price, subtotal: i.product_price * i.quantity,
      })),
      subtotal: sub, discount_pct: rec.discount_pct || 0, discount_amt: disc,
      total: tot, donation: don, total_due: tot + don, paid: !!rec.paid,
      payment_requested: paymentRequestedRef.current,
    }).catch(() => {})
  }

  function togglePayOnDisplay() {
    const next = !paymentRequestedRef.current
    paymentRequestedRef.current = next
    setShowPayOnDisplay(next)
    if (receiptRef.current) pushToDisplay(receiptRef.current)
  }

  async function markPaid(method) {
    const updated = await updateReceipt(id, { paid: true, payment_method: method })
    const rec = { ...receipt, ...updated }
    setReceiptAndRef(rec); pushToDisplay(rec)
    showToast(t('toast_marked_paid'))
  }

  async function markUnpaid() {
    const updated = await updateReceipt(id, { paid: false, payment_method: null, payments: [] })
    const rec = { ...receipt, ...updated }
    setReceiptAndRef(rec); pushToDisplay(rec)
    setShowSplitPay(false)
    setSplitAmounts({ contant: '', pin: '', qr: '' })
    showToast(t('toast_marked_unpaid'))
  }

  async function confirmSplitPay() {
    const payments = ['contant', 'pin', 'qr']
      .map(method => ({ method, amount: Math.round((parseFloat(splitAmounts[method]) || 0) * 100) / 100 }))
      .filter(p => p.amount > 0)
    if (!payments.length) return
    setSavingPayment(true)
    const updated = await updateReceipt(id, { paid: true, payment_method: payments[0].method, payments })
    const rec = { ...receipt, ...updated }
    setReceiptAndRef(rec); pushToDisplay(rec)
    setShowSplitPay(false)
    setSplitAmounts({ contant: '', pin: '', qr: '' })
    setSavingPayment(false)
    showToast(t('toast_marked_paid'))
  }

  async function setPaymentMethod(method) {
    const updated = await updateReceipt(id, { payment_method: method })
    const rec = { ...receipt, payment_method: updated.payment_method }
    setReceiptAndRef(rec); pushToDisplay(rec)
    showToast(t('toast_saved'))
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
    const rec = { ...receipt, ...updated }
    setReceiptAndRef(rec); pushToDisplay(rec)
    setEditingName(false)
    showToast(t('toast_saved'))
  }

  async function saveNote() {
    const updated = await updateReceipt(id, { note: noteInput.trim() || null })
    const rec = { ...receipt, ...updated }
    setReceiptAndRef(rec); pushToDisplay(rec)
    setEditingNote(false)
    showToast(t('toast_saved'))
  }

  async function saveDiscount() {
    const pct = Math.max(0, Math.min(100, parseFloat(discountInput) || 0))
    setSavingDiscount(true)
    const updated = await updateReceipt(id, { discount_pct: pct })
    const rec = { ...receipt, ...updated }
    setReceiptAndRef(rec); pushToDisplay(rec)
    setSavingDiscount(false)
    showToast(t('toast_saved'))
  }

  async function applyDiscount(pct) {
    setDiscountInput(String(pct))
    setSavingDiscount(true)
    const updated = await updateReceipt(id, { discount_pct: pct })
    const rec = { ...receipt, ...updated }
    setReceiptAndRef(rec); pushToDisplay(rec)
    setSavingDiscount(false)
    showToast(t('toast_saved'))
  }

  async function saveDonation() {
    const amt = Math.max(0, parseFloat(donationInput) || 0)
    setSavingDonation(true)
    const updated = await updateReceipt(id, { donation: amt })
    const rec = { ...receipt, ...updated }
    setReceiptAndRef(rec); pushToDisplay(rec)
    setSavingDonation(false)
    showToast(t('toast_saved'))
  }

  async function changeQty(item, delta) {
    const newQty = item.quantity + delta
    let newItems
    if (newQty <= 0) {
      await deleteReceiptItem(id, item.id)
      newItems = receipt.items.filter(i => i.id !== item.id)
    } else {
      await updateReceiptItem(id, item.id, newQty)
      newItems = receipt.items.map(i => i.id === item.id ? { ...i, quantity: newQty } : i)
    }
    const rec = { ...receipt, items: newItems }
    setReceiptAndRef(rec); pushToDisplay(rec)
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
      const rec = { ...receipt, items: [...receipt.items, newItem] }
      setReceiptAndRef(rec); pushToDisplay(rec)
    }
  }

  if (loading) return <div className="spinner" />
  if (!receipt) return null

  const subtotal    = receipt.items?.reduce((s, i) => s + i.product_price * i.quantity, 0) ?? 0
  const discountAmt = subtotal * (receipt.discount_pct || 0) / 100
  const total       = subtotal - discountAmt
  const donation    = receipt.donation || 0
  const totalDue    = total + donation

  const receivedNum = parseFloat(received) || 0
  const change      = received.trim() !== '' ? receivedNum - totalDue : null

  const productCatMap = Object.fromEntries(products.map(p => [p.id, p.category || 'overig']))
  const availableProducts = products.filter(p => p.available !== false)
  const groups = CATEGORIES.map(cat => ({
    cat,
    items: availableProducts.filter(p => (p.category || 'overig') === cat.id),
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
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20,
                fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
              }}>
                {isPaid ? <><Check size={11} /> {t('paid')}</> : <><X size={11} /> {t('unpaid')}</>}
              </span>
              {isPaid && receipt.payments?.length > 0
                ? receipt.payments.map(p => (
                    <span key={p.method} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 9px', borderRadius: 20,
                      fontSize: '0.7rem', fontWeight: 600,
                      background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
                    }}>
                      {p.method === 'contant' && <Banknote size={11} />}
                      {p.method === 'pin'     && <CreditCard size={11} />}
                      {p.method === 'qr'      && <Smartphone size={11} />}
                      {t(`payment_method_${p.method}`)} {fmt(p.amount)}
                    </span>
                  ))
                : isPaid && receipt.payment_method && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 9px', borderRadius: 20,
                      fontSize: '0.7rem', fontWeight: 600,
                      background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
                    }}>
                      {receipt.payment_method === 'contant' && <Banknote size={11} />}
                      {receipt.payment_method === 'pin'     && <CreditCard size={11} />}
                      {receipt.payment_method === 'qr'      && <Smartphone size={11} />}
                      {t(`payment_method_${receipt.payment_method}`)}
                    </span>
                  )
              }
            </div>
          </div>

          {/* Right: total + actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 900, letterSpacing: '-0.5px', color: isPaid ? '#86efac' : '#fcd34d' }}>
              {fmt(total)}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!isPaid && (
                <>
                  <button
                    className="btn btn-sm no-print"
                    onClick={() => setShowPayment(true)}
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', gap: 5 }}
                  >
                    <QrCode size={13} /> {t('payment_btn')}
                  </button>
                  <button
                    className="btn btn-sm no-print"
                    onClick={togglePayOnDisplay}
                    style={{
                      background: showPayOnDisplay ? '#16A34A' : 'rgba(255,255,255,0.2)',
                      color: '#fff',
                      border: `1px solid ${showPayOnDisplay ? '#16A34A' : 'rgba(255,255,255,0.35)'}`,
                      gap: 5,
                    }}
                  >
                    <QrCode size={13} /> Betalen
                  </button>
                  <button
                    className="btn btn-sm no-print"
                    onClick={() => setShowSplitPay(v => !v)}
                    style={{
                      background: showSplitPay ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)',
                      color: '#fff', border: '1px solid rgba(255,255,255,0.35)', gap: 5,
                    }}
                  >
                    <Layers size={13} /> {t('split_pay_btn')}
                  </button>
                </>
              )}
              {isPaid && (
                <button
                  className="btn btn-sm no-print"
                  onClick={markUnpaid}
                  style={{ background: 'rgba(217,119,6,0.25)', color: '#fff', border: '1px solid rgba(217,119,6,0.4)', gap: 5 }}
                >
                  <X size={12} /> {t('mark_unpaid')}
                </button>
              )}
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

      {/* ── Split betaling paneel ───────────────────────────────────────── */}
      {!isPaid && showSplitPay && (() => {
        const METHODS = [
          { key: 'contant', Icon: Banknote,   label: t('payment_method_contant') },
          { key: 'pin',     Icon: CreditCard, label: t('payment_method_pin') },
          { key: 'qr',      Icon: Smartphone, label: t('payment_method_qr') },
        ]
        const entered   = METHODS.reduce((s, m) => s + (parseFloat(splitAmounts[m.key]) || 0), 0)
        const remaining = Math.round((totalDue - entered) * 100) / 100
        const cashAmt   = parseFloat(splitAmounts.contant) || 0
        const change    = remaining < -0.005 ? Math.abs(remaining) : null
        const canConfirm = remaining <= 0.005 && entered > 0

        return (
          <div className="no-print" style={{
            background: 'var(--surface)', border: '2px solid var(--primary)',
            borderRadius: 12, padding: '1rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Layers size={14} color="var(--primary)" strokeWidth={2.3} />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {t('split_payment')}
                </span>
              </div>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>
                {t('total_due')}: {fmt(totalDue)}
              </span>
            </div>


            {METHODS.map(({ key, Icon, label }) => {
              const others = METHODS.filter(m => m.key !== key)
              const otherTotal = others.reduce((s, m) => s + (parseFloat(splitAmounts[m.key]) || 0), 0)
              const fillAmount = Math.max(0, totalDue - otherTotal)
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: parseFloat(splitAmounts[key]) > 0 ? 'var(--primary)' : 'var(--s100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'background 0.15s',
                  }}>
                    <Icon size={14} color={parseFloat(splitAmounts[key]) > 0 ? '#fff' : 'var(--s500)'} />
                  </div>
                  <span style={{ flex: 1, fontSize: '0.84rem', fontWeight: 500, color: 'var(--s800)' }}>{label}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>€</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 105 }}
                    value={splitAmounts[key]}
                    onChange={e => setSplitAmounts(prev => ({ ...prev, [key]: e.target.value }))}
                    min="0" step="0.01"
                    placeholder="0,00"
                  />
                  <button
                    className="btn btn-sm btn-outline"
                    style={{ flexShrink: 0 }}
                    title={t('split_fill')}
                    onClick={() => setSplitAmounts(prev => ({ ...prev, [key]: fillAmount.toFixed(2) }))}
                  >
                    Max
                  </button>
                </div>
              )
            })}

            {/* Samenvatting */}
            <div style={{ borderTop: '1px solid var(--s100)', paddingTop: '0.65rem', marginTop: 4, marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                <span style={{ color: 'var(--muted)' }}>{t('split_enter')}</span>
                <span style={{ fontWeight: 700, color: canConfirm ? '#16A34A' : 'var(--s700)' }}>{fmt(entered)}</span>
              </div>
              {remaining > 0.005 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                  <span style={{ color: 'var(--danger)' }}>{t('split_remaining')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(remaining)}</span>
                </div>
              )}
              {change !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: '#16A34A', fontWeight: 600 }}>{t('change')}</span>
                  <span style={{ fontWeight: 800, color: '#16A34A', fontSize: '1rem' }}>{fmt(change)}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, gap: 6 }}
                disabled={!canConfirm || savingPayment}
                onClick={confirmSplitPay}
              >
                <Check size={14} /> {t('split_confirm')}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => { setShowSplitPay(false); setSplitAmounts({ contant: '', pin: '', qr: '' }) }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )
      })()}

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

        {donation > 0 && (
          <>
            <div className="items-row" style={{ fontSize: '0.82rem', color: '#16A34A' }}>
              <span style={{ gridColumn: '1 / 4', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Heart size={12} /> {t('donation')}
              </span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>+{fmt(donation)}</span>
            </div>
            <div className="items-total" style={{ background: 'var(--surface)' }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{t('total_due')}</span>
              <span className="grand-total">{fmt(totalDue)}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Betaalmethode (alleen als betaald) ──────────────────────────── */}
      {isPaid && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '0.85rem 1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }} className="no-print">
          <SectionHead Icon={CreditCard} label={t('payment_method')} />
          {receipt.payments?.length > 0 ? (
            // Read-only split payment breakdown
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {receipt.payments.map(p => {
                const Icon = p.method === 'contant' ? Banknote : p.method === 'pin' ? CreditCard : Smartphone
                return (
                  <div key={p.method} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.4rem 0.6rem', background: 'var(--s50)', borderRadius: 8 }}>
                    <Icon size={14} color="var(--s500)" />
                    <span style={{ flex: 1, fontSize: '0.84rem', color: 'var(--s700)', fontWeight: 500 }}>
                      {t(`payment_method_${p.method}`)}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>{fmt(p.amount)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            // Single method selector
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { key: 'contant', Icon: Banknote,   label: t('payment_method_contant') },
                { key: 'pin',     Icon: CreditCard, label: t('payment_method_pin') },
                { key: 'qr',      Icon: Smartphone, label: t('payment_method_qr') },
              ].map(({ key, Icon, label }) => (
                <button
                  key={key}
                  className="btn btn-sm"
                  style={{
                    flex: '1 1 80px',
                    background: receipt.payment_method === key ? 'var(--primary)' : 'var(--surface)',
                    color:      receipt.payment_method === key ? '#fff' : 'var(--s600)',
                    border:     `1px solid ${receipt.payment_method === key ? 'var(--primary)' : 'var(--border)'}`,
                    gap: 5,
                  }}
                  onClick={() => setPaymentMethod(key)}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Korting + Wisselgeld side-by-side ───────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Korting */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '0.85rem 1rem', flex: '1 1 180px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }} className="no-print">
          <SectionHead Icon={Pencil} label={t('discount_pct')} />
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            {[10, 25, 50, 100].map(pct => (
              <button
                key={pct}
                className="btn btn-sm btn-outline"
                style={{ flex: '1 1 auto', fontWeight: 700 }}
                onClick={() => applyDiscount(pct)}
                disabled={savingDiscount}
              >
                {pct === 100 ? t('discount_free') : `${pct}%`}
              </button>
            ))}
            {receipt.discount_pct > 0 && (
              <button
                className="btn btn-sm"
                style={{ flex: '1 1 auto', color: 'var(--danger)', border: '1px solid var(--danger)', background: 'transparent' }}
                onClick={() => applyDiscount(0)}
                disabled={savingDiscount}
              >
                <X size={12} /> {t('discount')} af
              </button>
            )}
          </div>
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

        {/* Donatie */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '0.85rem 1rem', flex: '1 1 180px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }} className="no-print">
          <SectionHead Icon={Heart} label={t('donation')} color="#16A34A" />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>€</span>
            <input
              type="number"
              className="form-input discount-input"
              value={donationInput}
              onChange={e => setDonationInput(e.target.value)}
              min="0" step="0.50"
              onKeyDown={e => e.key === 'Enter' && saveDonation()}
              style={{ width: 80 }}
            />
            <button className="btn btn-sm btn-outline" onClick={saveDonation} disabled={savingDonation}>
              {t('save')}
            </button>
          </div>
          {donation > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#16A34A', marginTop: 5 }}>
              {t('total_due')}: {fmt(totalDue)}
            </div>
          )}
        </div>

        {/* Wisselgeld */}
        {!receipt.paid && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '0.85rem 1rem', flex: '1 1 200px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }} className="no-print">
            <SectionHead Icon={Calculator} label={t('change_calc')} />
            {donation > 0 && (
              <div style={{ fontSize: '0.73rem', color: '#16A34A', marginBottom: 6 }}>
                {t('total_due')}: {fmt(totalDue)} ({fmt(total)} + {fmt(donation)} {t('donation').toLowerCase()})
              </div>
            )}
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
                  const results = availableProducts.filter(p => p.name.toLowerCase().includes(q))
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
