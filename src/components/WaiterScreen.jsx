import { useState, useEffect, useCallback } from 'react'
import { Check, X, Plus, Minus, ArrowLeft, RefreshCw, LogOut, Banknote, Smartphone, ShoppingCart, Sun, Moon } from 'lucide-react'
import {
  fetchTafelindeling, fetchReceipts, fetchReceipt, fetchProducts,
  createReceipt, updateReceipt, addReceiptItem, updateReceiptItem, deleteReceiptItem,
} from '../api'

// Thema direct toepassen bij module-load om flash te voorkomen
const _t = localStorage.getItem('kassa_theme')
if (_t === 'dark') document.documentElement.dataset.theme = 'dark'
else document.documentElement.dataset.theme = ''

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`
function todayIso() { return new Date().toISOString().slice(0, 10) }

const STATUS = {
  free: { bg: 'var(--s100)', border: 'var(--s300)', label: 'var(--s600)', sub: 'var(--s400)' },
  open: { bg: 'rgba(249,115,22,0.1)', border: '#F97316', label: '#EA580C', sub: '#C2410C' },
  paid: { bg: 'rgba(74,222,128,0.1)', border: '#4ADE80', label: '#16A34A', sub: '#15803D' },
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
  const [pin, setPin]       = useState('')
  const [error, setError]   = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError(false)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) throw new Error()
      const { token, role } = await res.json()
      onLogin(token, role)
    } catch { setError(true) }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1rem',
    }}>
      <form onSubmit={handleLogin} style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '2rem 1.5rem',
        width: '100%', maxWidth: 320,
        display: 'flex', flexDirection: 'column', gap: '1rem',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)' }}>Bedieningsscherm</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>Voer je PIN in om door te gaan</div>
        </div>
        <input
          type="password" inputMode="numeric" pattern="[0-9]*"
          placeholder="PIN"
          value={pin}
          onChange={e => setPin(e.target.value)}
          autoFocus
          style={{
            background: 'var(--s50)', border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
            color: 'var(--text)', borderRadius: 10, padding: '0.75rem 1rem',
            fontSize: '1.1rem', letterSpacing: '0.3em', textAlign: 'center',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        {error && <p style={{ color: 'var(--danger)', fontSize: '0.78rem', textAlign: 'center', margin: 0 }}>Verkeerde PIN</p>}
        <button type="submit" disabled={!pin || loading} style={{
          background: !pin || loading ? 'var(--s200)' : 'var(--primary)',
          color: !pin || loading ? 'var(--muted)' : '#fff',
          border: 'none', borderRadius: 10,
          padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700,
          cursor: pin && !loading ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
        }}>
          {loading ? 'Laden…' : 'Inloggen'}
        </button>
      </form>
    </div>
  )
}

// ── Tafel-cel ─────────────────────────────────────────────────────────────────
function TableTile({ table, statusInfo, selected, onClick }) {
  const st = statusInfo || { key: 'free', receipt: null, total: 0 }
  const c  = STATUS[st.key]
  const w  = table.w || 1, h = table.h || 1
  const kitchenReady = st.receipt?.kitchen?.ready === true

  return (
    <div
      onClick={onClick}
      style={{
        gridColumn: `${table.x + 1} / span ${w}`,
        gridRow:    `${table.y + 1} / span ${h}`,
        background: selected ? 'var(--primary)' : c.bg,
        border: `2.5px solid ${selected ? 'var(--primary)' : kitchenReady ? '#4ade80' : c.border}`,
        borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 6, gap: 3,
        transition: 'all 0.12s',
        position: 'relative',
        boxShadow: kitchenReady && !selected
          ? '0 0 0 3px rgba(74,222,128,0.25)'
          : st.key === 'open' && !selected ? '0 0 0 3px rgba(249,115,22,0.15)' : 'none',
      }}
    >
      {kitchenReady && !selected && (
        <div style={{
          position: 'absolute', top: -6, right: -6,
          background: '#16a34a', borderRadius: '50%',
          width: 18, height: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--bg)',
        }}>
          <Check size={10} color="#fff" strokeWidth={3} />
        </div>
      )}
      <span style={{
        fontWeight: 800, fontSize: w > 1 || h > 1 ? '1rem' : '0.8rem',
        color: selected ? '#fff' : c.label,
        textAlign: 'center', lineHeight: 1.2,
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        padding: '0 4px',
      }}>
        {table.label}
      </span>
      {st.key === 'free' && <span style={{ fontSize: '0.6rem', color: selected ? 'rgba(255,255,255,0.75)' : c.sub, fontWeight: 500 }}>Vrij</span>}
      {st.key === 'open' && (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: selected ? '#fff' : kitchenReady ? '#16a34a' : c.sub }}>
          {kitchenReady ? '✓ Klaar' : fmt(st.total)}
        </span>
      )}
      {st.key === 'paid' && <Check size={14} color={selected ? '#fff' : c.sub} strokeWidth={2.5} />}
    </div>
  )
}

// ── Hoofd scherm ──────────────────────────────────────────────────────────────
export default function WaiterScreen() {
  const [dark, setDark]             = useState(() => localStorage.getItem('kassa_theme') === 'dark')
  const [token, setToken]           = useState(() => localStorage.getItem('kassa_token'))
  const [layout, setLayout]         = useState({ cols: 6, rows: 4, tables: [] })
  const [receipts, setReceipts]     = useState([])
  const [products, setProducts]     = useState([])
  const [selected, setSelected]     = useState(null)
  const [detail, setDetail]         = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showAdd, setShowAdd]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  function toggleDark() {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : ''
    localStorage.setItem('kassa_theme', next ? 'dark' : '')
  }

  function logout() {
    localStorage.removeItem('kassa_token'); localStorage.removeItem('kassa_role'); setToken(null)
  }
  function handleLogin(tok, role) {
    localStorage.setItem('kassa_token', tok); localStorage.setItem('kassa_role', role); setToken(tok)
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
  useEffect(() => {
    if (!token) return
    const id = setInterval(() => loadBase(), 30000)
    return () => clearInterval(id)
  }, [token, loadBase])

  async function selectTable(table, statusInfo) {
    setSelected({ table, statusInfo })
    setShowAdd(false); setDetail(null)
    if (statusInfo.key !== 'free' && statusInfo.receipt) {
      setLoadingDetail(true)
      const rec = await fetchReceipt(statusInfo.receipt.id).catch(() => null)
      setDetail(rec); setLoadingDetail(false)
    }
  }

  function clearSelection() { setSelected(null); setDetail(null); setShowAdd(false) }

  async function markPaid(method) {
    if (!detail) return
    setSaving(true)
    const updated = await updateReceipt(detail.id, { paid: true, payment_method: method })
    setDetail(d => ({ ...d, ...updated }))
    await loadBase()
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
    setDetail(d => ({ ...d, items: newItems })); loadBase()
  }

  async function addProduct(product) {
    if (!detail) return
    const existing = detail.items.find(i => i.product_id === product.id)
    if (existing) { await changeQty(existing, 1) }
    else {
      const newItem = await addReceiptItem(detail.id, {
        product_id: product.id, product_name: product.name,
        product_price: product.price, quantity: 1,
      })
      setDetail(d => ({ ...d, items: [...d.items, newItem] })); loadBase()
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
    setLoadingDetail(false); setSaving(false)
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />

  const statusMap = Object.fromEntries(
    layout.tables.map(t => [t.id, getStatus(t.label, receipts)])
  )
  const subtotal = detail?.items?.reduce((s, i) => s + i.product_price * i.quantity, 0) ?? 0
  const discAmt  = subtotal * (detail?.discount_pct || 0) / 100
  const total    = subtotal - discAmt
  const CELL     = 'clamp(58px, 12vw, 80px)'

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontWeight: 800, fontSize: '0.95rem', flex: 1, color: 'var(--text)' }}>Bedieningsscherm</span>
        <button onClick={() => loadBase(true)} disabled={refreshing}
          style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 6 }}>
          <RefreshCw size={15} style={{ transition: 'transform 0.5s', transform: refreshing ? 'rotate(360deg)' : 'none' }} />
        </button>
        <button onClick={toggleDark}
          style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 6 }}>
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button onClick={logout}
          style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 6 }}>
          <LogOut size={15} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Tafels */}
        <div style={{ padding: '1rem', overflowX: 'auto', flexShrink: 0 }}>
          {layout.tables.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem 0', fontSize: '0.9rem' }}>
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
                <TableTile key={table.id} table={table} statusInfo={statusMap[table.id]}
                  selected={selected?.table.id === table.id}
                  onClick={() => selectTable(table, statusMap[table.id])} />
              ))}
            </div>
          )}
        </div>

        {/* ── Detail paneel ───────────────────────────────────────── */}
        {selected && (
          <div style={{
            flex: 1, background: 'var(--surface)', borderTop: '1px solid var(--border)',
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>

            {/* Paneel header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10,
            }}>
              <button onClick={clearSelection}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
                <ArrowLeft size={16} />
              </button>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1, color: 'var(--text)' }}>
                {selected.table.label}
              </span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: selected.statusInfo.key === 'open' ? 'rgba(249,115,22,0.15)'
                  : selected.statusInfo.key === 'paid' ? 'rgba(74,222,128,0.15)' : 'var(--s100)',
                color: selected.statusInfo.key === 'open' ? '#EA580C'
                  : selected.statusInfo.key === 'paid' ? '#16A34A' : 'var(--muted)',
              }}>
                {selected.statusInfo.key === 'open' ? 'Open' : selected.statusInfo.key === 'paid' ? 'Betaald' : 'Vrij'}
              </span>
            </div>

            {/* Vrije tafel */}
            {selected.statusInfo.key === 'free' && (
              <div style={{ padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                  Deze tafel heeft nog geen bon voor vandaag.
                </p>
                <button onClick={createNewReceipt} disabled={saving} style={{
                  background: 'var(--primary)', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}>
                  <Plus size={16} /> Nieuwe bon aanmaken
                </button>
              </div>
            )}

            {selected.statusInfo.key !== 'free' && loadingDetail && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>Laden…</div>
            )}

            {detail && !loadingDetail && (
              <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* Items */}
                <div style={{ marginTop: '0.75rem' }}>
                  {(!detail.items || detail.items.length === 0) && (
                    <p style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center', padding: '0.5rem 0' }}>Geen artikelen.</p>
                  )}
                  {detail.items?.map(item => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '0.5rem 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text)', fontWeight: 500 }}>{item.product_name}</span>
                      {!detail.paid && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => changeQty(item, -1)} style={{
                            background: 'var(--s100)', border: '1px solid var(--border)', color: 'var(--text)',
                            borderRadius: 6, width: 26, height: 26, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}><Minus size={12} /></button>
                          <span style={{ fontWeight: 700, minWidth: 18, textAlign: 'center', color: 'var(--text)' }}>{item.quantity}</span>
                          <button onClick={() => changeQty(item, 1)} style={{
                            background: 'var(--s100)', border: '1px solid var(--border)', color: 'var(--text)',
                            borderRadius: 6, width: 26, height: 26, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}><Plus size={12} /></button>
                        </div>
                      )}
                      {detail.paid && <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{item.quantity}×</span>}
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)', minWidth: 60, textAlign: 'right' }}>
                        {fmt(item.product_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totaal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '2px solid var(--border)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--muted)' }}>Totaal</span>
                  <span style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--primary)' }}>{fmt(total)}</span>
                </div>

                {!detail.paid && (
                  <>
                    {/* Producten toevoegen */}
                    <button onClick={() => setShowAdd(v => !v)} style={{
                      background: 'var(--s100)', color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: 10, padding: '0.6rem 1rem',
                      fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      fontFamily: 'inherit',
                    }}>
                      <ShoppingCart size={14} /> {showAdd ? 'Sluiten' : 'Product toevoegen'}
                    </button>

                    {showAdd && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                        {products.map(p => (
                          <button key={p.id} onClick={() => addProduct(p)} style={{
                            background: 'var(--s50)', border: '1px solid var(--border)',
                            borderRadius: 10, padding: '0.6rem 0.5rem',
                            color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.3, color: 'var(--text)' }}>{p.name}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700 }}>{fmt(p.price)}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Betaalknoppen */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                      <button onClick={() => markPaid('contant')} disabled={saving || !detail.items?.length} style={{
                        background: '#16A34A', color: '#fff', border: 'none',
                        borderRadius: 12, padding: '0.85rem 0.5rem',
                        fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontFamily: 'inherit', opacity: !detail.items?.length ? 0.4 : 1,
                      }}>
                        <Banknote size={16} /> Contant
                      </button>
                      <button onClick={() => markPaid('qr')} disabled={saving || !detail.items?.length} style={{
                        background: '#7C3AED', color: '#fff', border: 'none',
                        borderRadius: 12, padding: '0.85rem 0.5rem',
                        fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontFamily: 'inherit', opacity: !detail.items?.length ? 0.4 : 1,
                      }}>
                        <Smartphone size={16} /> QR / Tikkie
                      </button>
                    </div>
                  </>
                )}

                {detail.paid && (
                  <div style={{
                    background: 'rgba(74,222,128,0.12)', border: '1px solid #4ade80',
                    borderRadius: 10, padding: '0.75rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    color: '#16A34A', fontWeight: 700,
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
