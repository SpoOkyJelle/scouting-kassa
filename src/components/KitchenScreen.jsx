import { useState, useEffect, useCallback } from 'react'
import { Check, RefreshCw, LogOut, RotateCcw, Clock, ChefHat, Sun, Moon } from 'lucide-react'
import { fetchKitchenOrders, toggleKitchenItem, resetKitchenOrder } from '../api'

// Thema direct toepassen bij module-load om flash te voorkomen
const _t = localStorage.getItem('kassa_theme')
if (_t === 'dark') document.documentElement.dataset.theme = 'dark'
else document.documentElement.dataset.theme = ''

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const sec = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (sec < 60)   return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  return `${Math.floor(sec / 3600)}u ${Math.floor((sec % 3600) / 60)}m`
}

function urgencyAccent(dateStr) {
  const min = (Date.now() - new Date(dateStr)) / 60000
  if (min > 20) return '#ef4444'
  if (min > 10) return '#f97316'
  return 'var(--s400)'
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState(false)
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
      const { token } = await res.json()
      onLogin(token)
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
        width: '100%', maxWidth: 300,
        display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center',
        boxShadow: 'var(--shadow-md)',
      }}>
        <ChefHat size={36} color="var(--primary)" strokeWidth={1.8} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>Keukenscherm</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 3 }}>PIN invoeren</div>
        </div>
        <input
          type="password" inputMode="numeric"
          placeholder="●●●●"
          value={pin}
          onChange={e => setPin(e.target.value)}
          autoFocus
          style={{
            background: 'var(--s50)', border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
            color: 'var(--text)', borderRadius: 10, padding: '0.75rem 1rem', width: '100%',
            fontSize: '1.2rem', letterSpacing: '0.4em', textAlign: 'center',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        {error && <p style={{ color: 'var(--danger)', fontSize: '0.78rem', margin: 0 }}>Verkeerde PIN</p>}
        <button type="submit" disabled={!pin || loading} style={{
          background: !pin || loading ? 'var(--s200)' : 'var(--primary)',
          color: !pin || loading ? 'var(--muted)' : '#fff',
          border: 'none', borderRadius: 10, padding: '0.75rem',
          fontSize: '0.9rem', fontWeight: 700,
          cursor: pin && !loading ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit', width: '100%',
        }}>
          {loading ? 'Laden…' : 'Inloggen'}
        </button>
      </form>
    </div>
  )
}

// ── Order-kaart ───────────────────────────────────────────────────────────────
function OrderCard({ order, onToggleItem, onReset }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const kitchen   = order.kitchen || { items_done: [], ready: false, ready_at: null }
  const itemsDone = kitchen.items_done || []
  const total     = (order.items || []).length
  const done      = (order.items || []).filter(i => itemsDone.includes(i.id)).length
  const isReady   = kitchen.ready
  const elapsed   = timeAgo(order.created_at)
  const accent    = urgencyAccent(order.created_at)
  const minOpen   = (now - new Date(order.created_at)) / 60000

  return (
    <div style={{
      background: isReady ? 'rgba(74,222,128,0.06)' : 'var(--surface)',
      border: `2px solid ${isReady ? '#4ade80' : minOpen > 20 ? '#ef4444' : minOpen > 10 ? '#f97316' : 'var(--border)'}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: isReady
        ? '0 0 0 3px rgba(74,222,128,0.12)'
        : minOpen > 20 ? '0 0 0 2px rgba(239,68,68,0.12)' : 'var(--shadow-sm)',
      transition: 'all 0.3s',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0.7rem 1rem',
        background: isReady ? 'rgba(74,222,128,0.1)' : 'var(--s50)',
        borderBottom: `1px solid ${isReady ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
      }}>
        {/* Voortgangs-cirkel */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: isReady ? '#16a34a' : 'var(--s100)',
          border: `2px solid ${isReady ? '#16a34a' : 'var(--s300)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isReady
            ? <Check size={17} color="#fff" strokeWidth={2.5} />
            : <span style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--muted)' }}>{done}/{total}</span>
          }
        </div>

        {/* Naam */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: isReady ? '#16a34a' : 'var(--text)', lineHeight: 1 }}>
            {order.name || `Bon #${order.id}`}
          </div>
          {isReady && (
            <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
              ✓ Klaar voor ophalen
            </div>
          )}
        </div>

        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Clock size={13} color={accent} />
          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums' }}>
            {elapsed}
          </span>
        </div>

        {/* Reset knop */}
        {isReady && (
          <button onClick={() => onReset(order.id)} style={{
            background: 'var(--s100)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'var(--muted)',
            display: 'flex', alignItems: 'center',
          }} title="Reset">
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* Items */}
      <div>
        {(order.items || []).map((item, idx) => {
          const isDone = itemsDone.includes(item.id)
          return (
            <button
              key={item.id}
              onClick={() => onToggleItem(order.id, item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                width: '100%', padding: '0.65rem 1rem',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: idx < (order.items || []).length - 1 ? '1px solid var(--border)' : 'none',
                fontFamily: 'inherit', textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--s50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Checkbox */}
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: isDone ? '#16a34a' : 'var(--s100)',
                border: `2px solid ${isDone ? '#16a34a' : 'var(--s300)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {isDone && <Check size={15} color="#fff" strokeWidth={3} />}
              </div>

              {/* Naam */}
              <span style={{
                flex: 1, fontSize: '0.95rem', fontWeight: 600,
                color: isDone ? 'var(--muted)' : 'var(--text)',
                textDecoration: isDone ? 'line-through' : 'none',
                transition: 'color 0.15s',
              }}>
                {item.product_name}
              </span>

              {/* Aantal */}
              <span style={{
                fontWeight: 900, fontSize: '1rem',
                color: isDone ? 'var(--s300)' : '#f97316',
                minWidth: 28, textAlign: 'right',
                transition: 'color 0.15s',
              }}>
                ×{item.quantity}
              </span>
            </button>
          )
        })}
      </div>

      {/* Voortgangsbalk */}
      {total > 0 && (
        <div style={{ height: 4, background: 'var(--s100)' }}>
          <div style={{
            height: '100%', width: `${(done / total) * 100}%`,
            background: isReady ? '#16a34a' : '#f97316',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}
    </div>
  )
}

// ── Hoofd component ───────────────────────────────────────────────────────────
export default function KitchenScreen() {
  const [dark, setDark]       = useState(() => localStorage.getItem('kassa_theme') === 'dark')
  const [token, setToken]     = useState(() => localStorage.getItem('kassa_token'))
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
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
  function handleLogin(tok) {
    localStorage.setItem('kassa_token', tok); setToken(tok)
  }

  const load = useCallback(async (animate = false) => {
    if (animate) setRefreshing(true)
    else setLoading(true)
    const data = await fetchKitchenOrders().catch(() => [])
    setOrders(data); setLoading(false); setRefreshing(false)
  }, [])

  useEffect(() => { if (token) load() }, [token, load])
  useEffect(() => {
    if (!token) return
    const id = setInterval(() => load(), 20000)
    return () => clearInterval(id)
  }, [token, load])

  async function handleToggle(receiptId, itemId) {
    const kitchen = await toggleKitchenItem(receiptId, itemId).catch(() => null)
    if (kitchen) setOrders(prev => prev.map(o => o.id === receiptId ? { ...o, kitchen } : o))
  }

  async function handleReset(receiptId) {
    const kitchen = await resetKitchenOrder(receiptId).catch(() => null)
    if (kitchen) setOrders(prev => prev.map(o => o.id === receiptId ? { ...o, kitchen } : o))
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />

  const open  = orders.filter(o => !o.kitchen?.ready)
  const ready = orders.filter(o =>  o.kitchen?.ready)
  const sorted = [...open, ...ready]

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)',
      fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column',
    }}>

      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <ChefHat size={18} color="var(--primary)" />
        <span style={{ fontWeight: 800, fontSize: '1rem', flex: 1, color: 'var(--text)' }}>Keukenscherm</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
          {open.length} open · {ready.length} klaar
        </span>
        <button onClick={() => load(true)} disabled={refreshing}
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

      {/* Inhoud */}
      <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem 0' }}>Laden…</div>
        )}

        {!loading && sorted.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '4rem 1rem', color: 'var(--muted)' }}>
            <ChefHat size={48} color="var(--s200)" strokeWidth={1.2} />
            <p style={{ fontSize: '0.9rem' }}>Geen openstaande bestellingen</p>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {sorted.map(order => (
              <OrderCard key={order.id} order={order} onToggleItem={handleToggle} onReset={handleReset} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
