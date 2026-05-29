import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, Tent, Clock } from 'lucide-react'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

// ── CSS animaties ──────────────────────────────────────────────────────────────
const ANIMS = `
  .no-scroll::-webkit-scrollbar { display: none }
  .no-scroll { scrollbar-width: none; -ms-overflow-style: none }

  @keyframes kFadeSlideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  @keyframes kFadeIn       { from{opacity:0}                           to{opacity:1} }
  @keyframes kScaleIn      { from{opacity:0;transform:scale(.94)}      to{opacity:1;transform:scale(1)} }
  @keyframes kFloat        { 0%,100%{transform:translateY(0)   rotate(-5deg);opacity:.7}  50%{transform:translateY(-22px) rotate(5deg);opacity:1} }
  @keyframes kFloat2       { 0%,100%{transform:translateY(0)   rotate(4deg);opacity:.6}   50%{transform:translateY(-16px) rotate(-6deg);opacity:.95} }
  @keyframes kBounce       { 0%,100%{transform:scale(1)}                                  45%{transform:scale(1.12)} }
  @keyframes kPop          { 0%{opacity:0;transform:scale(.5) translateY(30px)} 60%{transform:scale(1.08)} 100%{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes kPulse        { 0%,100%{opacity:1}                                 50%{opacity:.75} }
`

const SCREEN_ANIM = {
  idle:    'kFadeIn      0.6s ease-out both',
  order:   'kFadeSlideUp 0.38s ease-out both',
  payment: 'kScaleIn     0.32s cubic-bezier(.34,1.56,.64,1) both',
  paid:    'kFadeSlideUp 0.4s  ease-out both',
}

// ── SSE verbinding ─────────────────────────────────────────────────────────────
function useDisplayState() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let es

    function connect() {
      es = new EventSource('/display-events')
      es.onmessage = e => {
        try { setData(JSON.parse(e.data)) } catch {}
      }
      es.onerror = () => {
        fetch('/display-data')
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setData(d) })
          .catch(() => {})
      }
    }

    connect()
    return () => { if (es) es.close() }
  }, [])

  return data
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo({ settings, size = 48 }) {
  if (settings?.logoDataUrl) {
    return (
      <img
        src={settings.logoDataUrl}
        alt="Logo"
        style={{ height: size, maxWidth: size * 3, objectFit: 'contain' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'rgba(255,255,255,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Tent size={size * 0.5} color="#fff" />
    </div>
  )
}

// ── Idle scherm ───────────────────────────────────────────────────────────────
function IdleScreen({ settings }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = time.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  const dateStr = time.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
      <Logo settings={settings} size={72} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(3rem, 12vw, 7rem)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1, color: '#fff' }}>
          {timeStr}
        </div>
        <div style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)', color: 'rgba(255,255,255,0.55)', marginTop: '0.5rem', textTransform: 'capitalize' }}>
          {dateStr}
        </div>
      </div>
      <div style={{ fontSize: 'clamp(1rem, 2.5vw, 1.4rem)', color: 'rgba(255,255,255,0.5)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={18} style={{ opacity: 0.5 }} />
        Wij helpen u zo snel mogelijk
      </div>
    </div>
  )
}

// ── Betaalscherm (grote QR) ───────────────────────────────────────────────────
function PaymentScreen({ order, settings }) {
  const amount = order.total_due || order.total || 0
  const qrSrc  = settings?.paymentUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(settings.paymentUrl)}`
    : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 640, width: '100%', margin: '0 auto', padding: '1.5rem' }}>

      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 'clamp(0.85rem, 2vw, 1rem)', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
          Te betalen
        </div>
        <div style={{ fontSize: 'clamp(3.5rem, 12vw, 7rem)', fontWeight: 900, color: '#ffffff', letterSpacing: '-3px', lineHeight: 1 }}>
          {fmt(amount)}
        </div>
        {order.name && (
          <div style={{ fontSize: 'clamp(0.9rem, 2vw, 1.1rem)', color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
            {order.name}
          </div>
        )}
      </div>

      {qrSrc ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <img src={qrSrc} alt="Betaal QR" width={260} height={260} style={{ display: 'block' }} />
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Geen betaallink ingesteld
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 'clamp(0.85rem, 2vw, 1rem)', color: 'rgba(255,255,255,0.4)', marginBottom: '1rem' }}>
        Scan de QR-code om te betalen
      </div>

      {order.items?.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'clamp(0.78rem, 1.5vw, 0.95rem)', color: 'rgba(255,255,255,0.5)' }}>
              <span>{item.qty}× {item.name}</span>
              <span>{fmt(item.subtotal)}</span>
            </div>
          ))}
          {order.discount_pct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'clamp(0.78rem, 1.5vw, 0.95rem)', color: '#fca5a5' }}>
              <span>Korting ({order.discount_pct}%)</span>
              <span>−{fmt(order.discount_amt)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Betaald scherm ────────────────────────────────────────────────────────────
const CONFETTI = [
  { e: '🎉', t: '8%',  l: '6%',  s: '3.2rem', d: '0s',   a: 'kFloat' },
  { e: '🎊', t: '12%', r: '7%',  s: '2.8rem', d: '0.4s',  a: 'kFloat2' },
  { e: '✨', t: '55%', l: '3%',  s: '2.2rem', d: '0.8s',  a: 'kFloat' },
  { e: '🎉', b: '18%', r: '5%',  s: '3rem',   d: '1.1s',  a: 'kFloat2' },
  { e: '⭐', t: '38%', l: '2%',  s: '2rem',   d: '1.4s',  a: 'kFloat' },
  { e: '🎊', b: '28%', l: '7%',  s: '2.4rem', d: '0.5s',  a: 'kFloat2' },
  { e: '✨', t: '22%', r: '4%',  s: '2.6rem', d: '0.9s',  a: 'kFloat' },
  { e: '🌟', b: '10%', l: '35%', s: '2rem',   d: '0.3s',  a: 'kFloat2' },
  { e: '🎈', t: '5%',  l: '45%', s: '2.8rem', d: '0.7s',  a: 'kFloat' },
  { e: '✨', b: '5%',  r: '30%', s: '1.8rem', d: '1.2s',  a: 'kFloat2' },
]

function PaidScreen({ settings }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', position: 'relative', overflow: 'hidden' }}>
      {CONFETTI.map((c, i) => (
        <span key={i} style={{
          position: 'absolute', top: c.t, bottom: c.b, left: c.l, right: c.r,
          fontSize: c.s, animation: `${c.a} ${2.8 + i * 0.15}s ease-in-out ${c.d} infinite`,
          pointerEvents: 'none', userSelect: 'none',
        }}>
          {c.e}
        </span>
      ))}
      <div style={{ fontSize: 'clamp(4rem, 14vw, 8rem)', lineHeight: 1, animation: 'kBounce 1.6s ease-in-out infinite' }}>
        🎉
      </div>
      <Logo settings={settings} size={46} />
      <div style={{ textAlign: 'center', animation: 'kPop 0.6s cubic-bezier(.34,1.56,.64,1) both' }}>
        <div style={{ fontSize: 'clamp(2.8rem, 10vw, 6rem)', fontWeight: 900, color: '#4ade80', letterSpacing: '-1px', lineHeight: 1 }}>
          Betaald! 🎊
        </div>
        <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.8rem)', fontWeight: 700, color: '#fff', marginTop: '0.6rem', animation: 'kPulse 2.5s ease-in-out 0.8s infinite' }}>
          Bedankt voor uw bezoek! ✨
        </div>
      </div>
    </div>
  )
}

// ── Bon-overzicht scherm ──────────────────────────────────────────────────────
function OrderScreen({ order, settings }) {
  const { name, items = [], subtotal = 0, discount_pct = 0, discount_amt = 0, total = 0, donation = 0, total_due = 0 } = order
  const qrSrc = settings?.paymentUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(settings.paymentUrl)}`
    : null

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', maxWidth: 700, width: '100%', margin: '0 auto', padding: '0 1.5rem' }}>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '1.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <Logo settings={settings} size={38} />
        {name && (
          <span style={{ fontSize: 'clamp(1rem, 2.5vw, 1.4rem)', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            {name}
          </span>
        )}
      </div>

      <div className="no-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem 0' }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto',
            gap: '1rem', alignItems: 'center',
            padding: '0.65rem 0',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            <span style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: '#fff', fontWeight: 500 }}>{item.name}</span>
            <span style={{ fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)', color: 'rgba(255,255,255,0.45)', textAlign: 'center', minWidth: 40 }}>{item.qty}×</span>
            <span style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', fontWeight: 700, color: '#fff', textAlign: 'right', minWidth: 90 }}>{fmt(item.subtotal)}</span>
          </div>
        ))}
        {discount_pct > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', padding: '0.65rem 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)', color: '#fca5a5' }}>Korting ({discount_pct}%)</span>
            <span style={{ fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)', fontWeight: 700, color: '#fca5a5', textAlign: 'right' }}>−{fmt(discount_amt)}</span>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, borderTop: '2px solid rgba(255,255,255,0.2)', paddingTop: '1rem', paddingBottom: '1.5rem' }}>
        {donation > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)', color: '#86efac' }}>Donatie</span>
            <span style={{ fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)', color: '#86efac', fontWeight: 700 }}>+{fmt(donation)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            {donation > 0 ? 'Totaal te betalen' : 'Totaal'}
          </span>
          <span style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900, color: '#fcd34d', letterSpacing: '-1px' }}>
            {fmt(donation > 0 ? total_due : total)}
          </span>
        </div>
        {qrSrc && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <div style={{ background: '#fff', borderRadius: 10, padding: 6, display: 'inline-flex' }}>
              <img src={qrSrc} alt="Betaal QR" width={90} height={90} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Hoofd component ───────────────────────────────────────────────────────────
export default function KlantenschermDisplay() {
  const data = useDisplayState()

  const bgStyle = {
    height: '100dvh',
    overflow: 'hidden',
    background: 'linear-gradient(160deg, #0f2027 0%, #14532d 50%, #0f2027 100%)',
    display: 'flex', flexDirection: 'column',
    fontFamily: 'Inter, system-ui, sans-serif',
    WebkitFontSmoothing: 'antialiased',
  }

  if (!data) {
    return (
      <div style={{ ...bgStyle, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  const { active, paid, payment_requested, settings, ...order } = data
  const screenType = !active ? 'idle' : paid ? 'paid' : payment_requested ? 'payment' : 'order'

  return (
    <div style={bgStyle}>
      <style>{ANIMS}</style>
      <div
        key={screenType}
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animation: SCREEN_ANIM[screenType], overflow: 'hidden' }}
      >
        {screenType === 'idle'    && <IdleScreen    settings={settings} />}
        {screenType === 'paid'    && <PaidScreen    settings={settings} />}
        {screenType === 'payment' && <PaymentScreen order={order} settings={settings} />}
        {screenType === 'order'   && <OrderScreen   order={order} settings={settings} />}
      </div>
    </div>
  )
}
