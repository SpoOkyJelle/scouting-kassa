import { useState, useEffect, useCallback } from 'react'
import { Check, X, Plus, Minus, ArrowLeft, RefreshCw, LogOut, Banknote, Smartphone, ShoppingCart } from 'lucide-react'
import {
  fetchTafelindeling, fetchReceipts, fetchReceipt, fetchProducts,
  createReceipt, updateReceipt, addReceiptItem, updateReceiptItem, deleteReceiptItem,
} from '../api'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

function todayIso() { return new Date().toISOString().slice(0, 10) }

const STATUS = {
  free: { bg: '#F1F5F9', border: '#CBD5E1', label: '#475569', sub: '#94A3B8' },
  open: { bg: '#FFF7ED', border: '#F97316', label: '#9A3412', sub: '#C2410C' },
  paid: { bg: '#F0FDF4', border: '#4ADE80', label: '#166534', sub: '#16A34A' },
}

function getStatus(tableLabel, receipts) {
  const today = todayIso()
  const matches = receipts.filter(r =>
    r.name?.trim().toLowerCase() === tableLabel.trim().toLowerCase() &&
    r.created_at?.startsWith(today)
  )
  if (!matches.length) return { key: 'free', receipt: null, total: 0 }
  const open = matches.filter(r => !r.paid)
  if (open.length) return { key: 'open', receipt: open[0], total: open.reduce((s, r) => s + (r.total || 0), 0) }
  return { key: 'paid', receipt: matches[matches.length - 1], total: 0 }
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError(false)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) throw new Error()
      const { token, role } = await res.json()
      onLogin(token, role)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '1rem',
    }}>
      <form onSubmit={handleLogin} style={{
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: 16, padding: '2rem 1.5rem',
        width: '100%', maxWidth: 320,
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f1f5f9' }}>Bedieningsscherm</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>Voer je PIN in om door te gaan</div>
        </div>
        <input
          type="password" inputMode="numeric" pattern="[0-9]*"
          placeholder="PIN"
          value={pin}
          onChange={e => setPin(e.target.value)}
          autoFocus
          style={{
            background: '#0f172a', border: `1px solid ${error ? '#ef4444' : '#334155'}`,
            color: '#f1f5f9', borderRadius: 10, padding: '0.75rem 1rem',
            fontSize: '1.1rem', letterSpacing: '0.3em', textAlign: 'center',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        {error && <p style={{ color: '#ef4444', fontSize: '0.78rem', textAlign: 'center', margin: 0 }}>Verkeerde PIN</p>}
        <button
          type="submit" disabled={!pin || loading}
          style={{
            background: loading || !pin ? '#334155' : '#16A34A',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700,
            cursor: pin && !loading ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Laden…' : 'Inloggen'}
        </button>
      </form>
    </div>
  )
}

// ── Tafel-cel ─────────────────────────────────────────────────────────────────
function TableTile({ table, statusInfo, selected, onClick }) {
  const st = statusInfo || { key: 'free', receipt: null, total: 0 }
  const c = STATUS[st.key]
  const w = table.w || 1, h = table.h || 1
  return (
    <div
      onClick={onClick}
      style={{
        gridColumn: `${table.x + 1} / span ${w}`,
        gridRow:    `${table.y + 1} / span ${h}`,
        background: selected ? '#1d4ed8' : c.bg,
        border: `2.5px solid ${selected ? '#3b82f6' : c.border}`,
        borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 6, gap: 3,
        transition: 'all 0.12s',
        boxShadow: st.key === 'open' && !selected ? '0 0 0 3px rgba(249,115,22,0.2)' : 'none',
      }}
    >
      <span style={{
        fontWeight: 800, fontSize: w > 1 || h > 1 ? '1rem' : '0.8rem',
        color: selected ? '#fff' : c.label,
        textAlign: 'center', lineHeight: 1.2,
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        padding: '0 4px',
      }}>
        {table.label}
      </span>
      {st.key === 'free'  && <span style={{ fontSize: '0.6rem', color: selected ? 'rgba(255,255,255,0.7)' : c.sub, fontWeight: 500 }}>Vrij</span>}
      {st.key === 'open'  && <span style={{ fontSize: '0.68rem', color: selected ? '#bfdbfe' : c.sub, fontWeight: 700 }}>{fmt(st.total)}</span>}
      {st.key === 'paid'  && <Check size={14} color={selected ? '#86efac' : c.sub} strokeWidth={2.5} />}
    </div>
  )
}

// ── Hoofd scherm ──────────────────────────────────────────────────────────────
export default function WaiterScreen() {
  const [token, setToken]           = useState(() => localStorage.getItem('kassa_token'))
  const [layout, setLayout]         = useState({ cols: 6, rows: 4, tables: [] })
  const [receipts, setReceipts]     = useState([])
  const [products, setProducts]     = useState([])
  const [selected, setSelected]     = useState(null)      // { table, statusInfo }
  const [detail, setDetail]         = useState(null)      // full receipt
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showAdd, setShowAdd]       = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  function logout() {
    localStorage.removeItem('kassa_token')
    localStorage.removeItem('kassa_role')
    setToken(null)
  }

  function handleLogin(tok, role) {
    localStorage.setItem('kassa_token', tok)
    localStorage.setItem('kassa_role', role)
    setToken(tok)
  }

  const loadBase = useCallback(async (animate = false) => {
    if (animate) setRefreshing(true)
    const [lay, recs, prods] = await Promise.all([
      fetchTafelindeling().catch(() => ({ cols: 6, rows: 4, tables: [] })),
      fetchReceipts().catch(() => []),
      fetchProducts().catch(() => []),
    ])
    setLayout(lay || { cols: 6, rows: 4, tables: [] })
    setReceipts(recs)
    setProducts(prods.filter(p => p.available !== false))
    setRefreshing(false)
  }, [])

  useEffect(() => { if (token) loadBase() }, [token, loadBase])

  // Poll elke 30 seconden voor live status updates
  useEffect(() => {
    if (!token) return
    const id = setInterval(() => loadBase(), 30000)
    return () => clearInterval(id)
  }, [token, loadBase])

  async function selectTable(table, statusInfo) {
    setSelected({ table, statusInfo })
    setShowAdd(false)
    setShowNewForm(false)
    setDetail(null)
    if (statusInfo.key !== 'free' && statusInfo.receipt) {
      setLoadingDetail(true)
      const rec = await fetchReceipt(statusInfo.receipt.id).catch(() => null)
      setDetail(rec)
      setLoadingDetail(false)
    }
  }

  function clearSelection() { setSelected(null); setDetail(null); setShowAdd(false); setShowNewForm(false) }

  async function refresh() {
    await loadBase(true)
    if (selected && selected.statusInfo.receipt) {
      const rec = await fetchReceipt(selected.statusInfo.receipt.id).catch(() => null)
      setDetail(rec)
      // herbereken status
      const recs = await fetchReceipts().catch(() => receipts)
      setReceipts(recs)
      const newStatus = getStatus(selected.table.label, recs)
      setSelected(s => ({ ...s, statusInfo: newStatus }))
    }
  }

  async function markPaid(method) {
    if (!detail) return
    setSaving(true)
    const updated = await updateReceipt(detail.id, { paid: true, payment_method: method })
    setDetail(d => ({ ...d, ...updated }))
    await loadBase()
    const newStatus = getStatus(selected.table.label, receipts)
    setSelected(s => ({ ...s, statusInfo: { key: 'paid', receipt: updated, total: 0 } }))
    setSaving(false)
  }

  async function changeQty(item, delta) {
    const newQty = item.quantity + delta
    let newItems
    if (newQty <= 0) {
      await deleteReceiptItem(detail.id, item.id)
      newItems = detail.items.filter(i => i.id !== item.id)
    } else {
      await updateReceiptItem(detail.id, item.id, newQty)
      newItems = detail.items.map(i => i.id === item.id ? { ...i, quantity: newQty } : i)
    }
    setDetail(d => ({ ...d, items: newItems }))
    loadBase()
  }

  async function addProduct(product) {
    if (!detail) return
    const existing = detail.items.find(i => i.product_id === product.id)
    if (existing) {
      await changeQty(existing, 1)
    } else {
      const newItem = await addReceiptItem(detail.id, {
        product_id: product.id, product_name: product.name,
        product_price: product.price, quantity: 1,
      })
      setDetail(d => ({ ...d, items: [...d.items, newItem] }))
      loadBase()
    }
  }

  async function createNewReceipt() {
    if (!selected) return
    setSaving(true)
    const rec = await createReceipt(selected.table.label, [], null)
    await loadBase()
    setLoadingDetail(true)
    const full = await fetchReceipt(rec.id).catch(() => null)
    setDetail(full)
    setSelected(s => ({ ...s, statusInfo: { key: 'open', receipt: rec, total: 0 } }))
    setShowNewForm(false)
    setLoadingDetail(false)
    setSaving(false)
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />

  const statusMap = Object.fromEntries(
    layout.tables.map(t => [t.id, getStatus(t.label, receipts)])
  )

  const subtotal = detail?.items?.reduce((s, i) => s + i.product_price * i.quantity, 0) ?? 0
  const discAmt  = subtotal * (detail?.discount_pct || 0) / 100
  const total    = subtotal - discAmt

  const CELL = 'clamp(58px, 12vw, 80px)'

  return (
    <div style={{
      minHeight: '100dvh', background: '#0f172a', color: '#f1f5f9',
      display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif',
    }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontWeight: 800, fontSize: '0.95rem', flex: 1 }}>Bedieningsscherm</span>
        <button onClick={() => loadBase(true)} disabled={refreshing}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 6 }}>
          <RefreshCw size={15} style={{ transition: 'transform 0.5s', transform: refreshing ? 'rotate(360deg)' : 'none' }} />
        </button>
        <button onClick={logout}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 6 }}>
          <LogOut size={15} />
        </button>
      </div>

      {/* ── Inhoud: grid links / detail rechts (desktop), gestapeld (mobile) ─ */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        gap: 0, overflow: 'hidden',
      }}>

        {/* Tabelgrid */}
        <div style={{ padding: '1rem', overflowX: 'auto', flexShrink: 0 }}>
          {layout.tables.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#475569', padding: '3rem 0', fontSize: '0.9rem' }}>
              Geen tafels ingesteld. Stel de tafelindeling in via de kassa.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${layout.cols}, ${CELL})`,
              gridTemplateRows:    `repeat(${layout.rows}, ${CELL})`,
              gap: 8, width: 'max-content', margin: '0 auto',
            }}>
              {layout.tables.map(table => (
                <TableTile
                  key={table.id}
                  table={table}
                  statusInfo={statusMap[table.id]}
                  selected={selected?.table.id === table.id}
                  onClick={() => selectTable(table, statusMap[table.id])}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Detail paneel ───────────────────────────────────────── */}
        {selected && (
          <div style={{
            flex: 1, background: '#1e293b', borderTop: '1px solid #334155',
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>

            {/* Paneel header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0.75rem 1rem', borderBottom: '1px solid #334155',
              position: 'sticky', top: 0, background: '#1e293b', zIndex: 10,
            }}>
              <button onClick={clearSelection}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
                <ArrowLeft size={16} />
              </button>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1 }}>
                {selected.table.label}
              </span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: selected.statusInfo.key === 'open' ? '#7c2d12' : selected.statusInfo.key === 'paid' ? '#14532d' : '#1e3a5f',
                color: selected.statusInfo.key === 'open' ? '#fed7aa' : selected.statusInfo.key === 'paid' ? '#bbf7d0' : '#bfdbfe',
              }}>
                {selected.statusInfo.key === 'open' ? 'Open' : selected.statusInfo.key === 'paid' ? 'Betaald' : 'Vrij'}
              </span>
            </div>

            {/* Vrije tafel */}
            {selected.statusInfo.key === 'free' && (
              <div style={{ padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>
                  Deze tafel heeft nog geen bon voor vandaag.
                </p>
                <button
                  onClick={createNewReceipt}
                  disabled={saving}
                  style={{
                    background: '#16A34A', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '0.75rem 1.5rem',
                    fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'inherit',
                  }}
                >
                  <Plus size={16} /> Nieuwe bon aanmaken
                </button>
              </div>
            )}

            {/* Bon laden */}
            {selected.statusInfo.key !== 'free' && loadingDetail && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>Laden…</div>
            )}

            {/* Bon detail */}
            {detail && !loadingDetail && (
              <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* Items */}
                <div style={{ marginTop: '0.75rem' }}>
                  {(!detail.items || detail.items.length === 0) && (
                    <p style={{ color: '#64748b', fontSize: '0.82rem', textAlign: 'center', padding: '0.5rem 0' }}>Geen artikelen.</p>
                  )}
                  {detail.items?.map(item => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '0.5rem 0', borderBottom: '1px solid #334155',
                    }}>
                      <span style={{ flex: 1, fontSize: '0.88rem', color: '#e2e8f0' }}>{item.product_name}</span>
                      {!detail.paid && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => changeQty(item, -1)}
                            style={{ background: '#334155', border: 'none', color: '#f1f5f9', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Minus size={12} />
                          </button>
                          <span style={{ fontWeight: 700, minWidth: 18, textAlign: 'center', color: '#f1f5f9' }}>{item.quantity}</span>
                          <button onClick={() => changeQty(item, 1)}
                            style={{ background: '#334155', border: 'none', color: '#f1f5f9', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Plus size={12} />
                          </button>
                        </div>
                      )}
                      {detail.paid && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{item.quantity}×</span>}
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#86efac', minWidth: 60, textAlign: 'right' }}>
                        {fmt(item.product_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totaal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '2px solid #334155' }}>
                  <span style={{ fontWeight: 700, color: '#94a3b8' }}>Totaal</span>
                  <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#86efac' }}>{fmt(total)}</span>
                </div>

                {/* Producten toevoegen */}
                {!detail.paid && (
                  <>
                    <button
                      onClick={() => setShowAdd(v => !v)}
                      style={{
                        background: '#334155', color: '#e2e8f0', border: 'none',
                        borderRadius: 10, padding: '0.6rem 1rem',
                        fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontFamily: 'inherit',
                      }}
                    >
                      <ShoppingCart size={14} /> {showAdd ? 'Sluiten' : 'Product toevoegen'}
                    </button>

                    {showAdd && (
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8,
                      }}>
                        {products.map(p => (
                          <button
                            key={p.id}
                            onClick={() => addProduct(p)}
                            style={{
                              background: '#0f172a', border: '1px solid #334155',
                              borderRadius: 10, padding: '0.6rem 0.5rem',
                              color: '#e2e8f0', cursor: 'pointer', fontFamily: 'inherit',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            }}
                          >
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{p.name}</span>
                            <span style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 700 }}>{fmt(p.price)}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Betaalknoppen */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                      <button
                        onClick={() => markPaid('contant')} disabled={saving || !detail.items?.length}
                        style={{
                          background: saving ? '#334155' : '#065f46', color: '#fff',
                          border: 'none', borderRadius: 12, padding: '0.85rem 0.5rem',
                          fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          fontFamily: 'inherit', opacity: !detail.items?.length ? 0.4 : 1,
                        }}
                      >
                        <Banknote size={16} /> Contant
                      </button>
                      <button
                        onClick={() => markPaid('qr')} disabled={saving || !detail.items?.length}
                        style={{
                          background: saving ? '#334155' : '#4c1d95', color: '#fff',
                          border: 'none', borderRadius: 12, padding: '0.85rem 0.5rem',
                          fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          fontFamily: 'inherit', opacity: !detail.items?.length ? 0.4 : 1,
                        }}
                      >
                        <Smartphone size={16} /> QR / Tikkie
                      </button>
                    </div>
                  </>
                )}

                {detail.paid && (
                  <div style={{
                    background: '#14532d', borderRadius: 10, padding: '0.75rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    color: '#bbf7d0', fontWeight: 700,
                  }}>
                    <Check size={16} /> Bon is betaald
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
