import { useState, useEffect } from 'react'
import { CreditCard, FileText, Users, ExternalLink, Zap, RefreshCw, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { fetchAccount, createCheckout, openPortal } from '../api'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'

function daysLeft(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - Date.now()) / (1000 * 60 * 60 * 24))
}

function StatusBadge({ status, trialEndsAt }) {
  const days = daysLeft(trialEndsAt)
  const expired = status === 'expired' || status === 'cancelled' || (status === 'trial' && days !== null && days <= 0)

  const configs = {
    active:    { label: 'Actief',         bg: '#DCFCE7', color: '#166534', Icon: CheckCircle },
    trial:     { label: `Trial${days !== null ? ` — ${days}d` : ''}`, bg: days !== null && days <= 7 ? '#FEF3C7' : '#DBEAFE', color: days !== null && days <= 7 ? '#92400E' : '#1E40AF', Icon: Clock },
    expired:   { label: 'Verlopen',       bg: '#FEE2E2', color: '#991B1B', Icon: XCircle },
    cancelled: { label: 'Opgezegd',       bg: '#FEE2E2', color: '#991B1B', Icon: XCircle },
  }

  const key = expired ? 'expired' : (configs[status] ? status : 'expired')
  const { label, bg, color, Icon } = configs[key] || configs.expired

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: bg, color, borderRadius: 20,
      padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700,
    }}>
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </span>
  )
}

export default function AccountDashboard() {
  const showToast = useToast()
  const confirm   = useConfirm()
  const [account, setAccount]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    fetchAccount()
      .then(setAccount)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCheckout() {
    setActionLoading('checkout')
    try {
      const { url } = await createCheckout('pro')
      window.location.href = url
    } catch (err) {
      showToast(err.message || 'Kon Stripe niet bereiken', 'error')
    }
    setActionLoading(null)
  }

  async function handlePortal() {
    setActionLoading('portal')
    try {
      const { url } = await openPortal()
      window.open(url, '_blank')
    } catch (err) {
      showToast(err.message || 'Kon portaal niet openen', 'error')
    }
    setActionLoading(null)
  }

  const status     = account?.subscription_status
  const isPaid     = account?.subscription && status === 'active'
  const isTrialActive = status === 'trial' && (daysLeft(account?.trial_ends_at) ?? 1) > 0
  const days       = daysLeft(account?.trial_ends_at)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '0.85rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
        background: 'var(--s50)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'var(--primary)18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CreditCard size={14} color="var(--primary)" strokeWidth={2.3} />
        </div>
        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--s800)' }}>Account & Abonnement</span>
      </div>

      <div style={{ padding: '1rem' }}>
        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Laden…</p>
        ) : !account ? (
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>Kon accountgegevens niet laden.</p>
        ) : (
          <>
            {/* Org + email */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--s900)' }}>{account.name}</span>
                <StatusBadge status={status} trialEndsAt={account.trial_ends_at} />
              </div>
              {account.email && (
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{account.email}</span>
              )}
              {isTrialActive && days !== null && (
                <p style={{ fontSize: '0.78rem', color: days <= 7 ? '#92400E' : 'var(--muted)', marginTop: 4 }}>
                  Proefperiode verloopt op {new Date(account.trial_ends_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* Gebruik */}
            {account.usage && (
              <div style={{
                display: 'flex', gap: '0.75rem', marginBottom: '1rem',
              }}>
                {[
                  { Icon: FileText, label: 'Bonnen', value: account.usage.receipts },
                  { Icon: Users,    label: 'Medewerkers', value: account.usage.employees },
                ].map(({ Icon, label, value }) => (
                  <div key={label} style={{
                    flex: 1, background: 'var(--s50)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '0.6rem 0.75rem',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Icon size={14} color="var(--muted)" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--s900)', lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 2 }}>{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actieknoppen */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(isTrialActive || status === 'expired' || status === 'cancelled') && (
                <button
                  onClick={handleCheckout}
                  disabled={!!actionLoading}
                  className="btn btn-primary btn-full"
                  style={{ gap: 7, justifyContent: 'center' }}
                >
                  {actionLoading === 'checkout'
                    ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    : <><Zap size={14} /> Upgrade naar Pro — €19/maand</>}
                </button>
              )}

              {isPaid && (
                <button
                  onClick={handlePortal}
                  disabled={!!actionLoading}
                  className="btn btn-outline btn-full"
                  style={{ gap: 7, justifyContent: 'center' }}
                >
                  {actionLoading === 'portal'
                    ? <span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: 'var(--s700)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    : <><ExternalLink size={14} /> Abonnement beheren</>}
                </button>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => fetchAccount().then(setAccount).catch(() => {})}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5, padding: 0 }}
                >
                  <RefreshCw size={11} /> Vernieuwen
                </button>
                <button
                  onClick={async () => {
                    const ok = await confirm('Wil je je account en alle bijbehorende data permanent verwijderen? Dit kan niet ongedaan worden gemaakt.')
                    if (!ok) return
                    try {
                      await fetch('/api/accounts/me', { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('kassa_token')}` } })
                      localStorage.clear()
                      window.location.reload()
                    } catch { showToast('Verwijderen mislukt', 'error') }
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5, padding: 0 }}
                >
                  <Trash2 size={11} /> Account verwijderen
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
