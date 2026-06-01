import { AlertTriangle, Lock, ArrowRight, X } from 'lucide-react'
import { useState } from 'react'
import { createCheckout, openPortal } from '../api'

function daysLeft(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function SubscriptionBanner({ account, onRefresh }) {
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (!account || dismissed) return null

  const status = account.subscription_status
  const days   = daysLeft(account.trial_ends_at)

  // Geen banner nodig voor actieve betaalde abonnementen
  if (status === 'active' && !account.trial_ends_at) return null
  // Trial nog ruim voldoende
  if (status === 'trial' && days !== null && days > 7) return null

  const expired  = status === 'expired' || status === 'cancelled' || (status === 'trial' && days !== null && days <= 0)
  const expiring = !expired && status === 'trial' && days !== null && days <= 7

  if (!expired && !expiring) return null

  async function handleUpgrade() {
    setLoading(true)
    try {
      const { url } = await createCheckout('pro')
      window.location.href = url
    } catch {
      setLoading(false)
    }
  }

  const bg      = expired ? '#FEF2F2' : '#FFFBEB'
  const border  = expired ? '#FECACA' : '#FDE68A'
  const color   = expired ? '#991B1B' : '#92400E'
  const Icon    = expired ? Lock : AlertTriangle

  return (
    <div style={{
      background: bg, borderBottom: `1px solid ${border}`,
      padding: '0.5rem 1rem',
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: '0.82rem', color,
    }}>
      <Icon size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />

      <span style={{ flex: 1 }}>
        {expired
          ? 'Je proefperiode is verlopen. Vernieuw je abonnement om het POS te blijven gebruiken.'
          : `Je proefperiode verloopt over ${days} ${days === 1 ? 'dag' : 'dagen'}.`}
      </span>

      <button
        onClick={handleUpgrade}
        disabled={loading}
        style={{
          background: expired ? '#DC2626' : '#D97706',
          color: '#fff', border: 'none', borderRadius: 6,
          padding: '0.3rem 0.75rem', fontWeight: 700,
          fontSize: '0.78rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          opacity: loading ? 0.7 : 1, flexShrink: 0,
        }}
      >
        {loading
          ? <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
          : <><ArrowRight size={12} /> Upgrade naar Pro</>}
      </button>

      {expiring && (
        <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: 2 }}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}
