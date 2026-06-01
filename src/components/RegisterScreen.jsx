import { useState, useRef, useEffect } from 'react'
import { ArrowRight, Building2, Mail, Lock, Check, Zap, Clock } from 'lucide-react'
import { register as apiRegister, createCheckout } from '../api'

const PLANS = [
  {
    id: 'trial',
    label: 'Proefperiode',
    price: 'Gratis',
    period: '14 dagen',
    features: ['Alle functies inbegrepen', 'Onbeperkte bonnen', 'Geen betaalgegevens nodig'],
    cta: 'Ga verder met trial',
    highlight: false,
    icon: Clock,
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '€19',
    period: 'per maand',
    features: ['Alle functies inbegrepen', 'Onbeperkte medewerkers', 'E-mail ondersteuning', 'Na proefperiode'],
    cta: 'Start met Pro',
    highlight: true,
    icon: Zap,
  },
]

export default function RegisterScreen({ onRegister }) {
  const [step, setStep]         = useState(1)
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [registeredToken, setRegisteredToken] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  async function handleRegister(e) {
    e.preventDefault()
    if (password !== password2) return setError('Wachtwoorden komen niet overeen')
    if (password.length < 8)    return setError('Wachtwoord moet minimaal 8 tekens zijn')
    setLoading(true)
    setError('')
    try {
      const { token, role } = await apiRegister(name.trim(), email.trim(), password)
      localStorage.setItem('kassa_token', token)
      localStorage.setItem('kassa_role', role || 'admin')
      setRegisteredToken(token)
      setStep(2)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleChoosePlan(planId) {
    if (planId === 'trial') {
      onRegister(registeredToken, 'admin', '')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { url } = await createCheckout(planId)
      window.location.href = url
    } catch (err) {
      setError(err.message || 'Kon Stripe Checkout niet starten')
      setLoading(false)
    }
  }

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--s900)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
  }

  if (step === 2) return (
    <div style={pageStyle}>
      <div style={{ width: '100%', maxWidth: 580 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/tickd-logo.png" alt="Tickd" style={{ height: 64, width: 'auto', display: 'inline-block', filter: 'brightness(0) invert(1)' }} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(22,163,74,0.2)', border: '1px solid rgba(22,163,74,0.4)',
            borderRadius: 20, padding: '4px 14px', marginBottom: '0.75rem',
          }}>
            <Check size={12} color="var(--g500)" strokeWidth={3} />
            <span style={{ fontSize: '0.78rem', color: 'var(--g500)', fontWeight: 600 }}>Account aangemaakt</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', marginBottom: 8 }}>
            Kies je plan
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--s400)' }}>
            Je 14-daagse proefperiode is al actief — geen betaling nodig om te beginnen.
          </p>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {PLANS.map(plan => {
            const Icon = plan.icon
            return (
              <div key={plan.id} style={{
                background: plan.highlight ? 'var(--g600)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${plan.highlight ? 'var(--g500)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 14,
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Icon size={18} color={plan.highlight ? '#fff' : 'var(--g500)'} />
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>{plan.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff' }}>{plan.price}</span>
                    <span style={{ fontSize: '0.8rem', color: plan.highlight ? 'rgba(255,255,255,0.7)' : 'var(--s400)' }}>{plan.period}</span>
                  </div>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem', color: plan.highlight ? 'rgba(255,255,255,0.9)' : 'var(--s300)' }}>
                      <Check size={11} strokeWidth={3} color={plan.highlight ? '#fff' : 'var(--g500)'} style={{ flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleChoosePlan(plan.id)}
                  disabled={loading}
                  style={{
                    background: plan.highlight ? 'rgba(255,255,255,0.2)' : 'rgba(22,163,74,0.15)',
                    border: `1px solid ${plan.highlight ? 'rgba(255,255,255,0.3)' : 'rgba(22,163,74,0.3)'}`,
                    color: '#fff',
                    borderRadius: 8,
                    padding: '0.6rem 1rem',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {plan.cta} {!loading && <ArrowRight size={13} />}
                </button>
              </div>
            )
          })}
        </div>

        {error && (
          <p style={{ textAlign: 'center', color: '#FCA5A5', fontSize: '0.82rem', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--s500)' }}>
          Je kunt altijd later upgraden via je accountinstellingen.
        </p>
      </div>
    </div>
  )

  return (
    <div style={pageStyle}>
      {/* Back to login */}
      <a href="/" style={{ position: 'absolute', top: '1rem', left: '1rem', color: 'var(--s400)', fontSize: '0.8rem', textDecoration: 'none' }}>
        ← Terug naar login
      </a>

      {/* Card */}
      <div style={{
        background: '#fff',
        borderRadius: 'var(--r-xl)',
        padding: '2.25rem 2rem',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img src="/tickd-logo.png" alt="Tickd" style={{ height: 70, width: 'auto', margin: '0 auto 0.5rem', display: 'block' }} />
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: 4 }}>
            Maak je gratis account aan
          </p>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Organisatienaam */}
          <div style={{ position: 'relative' }}>
            <Building2 size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--s400)', pointerEvents: 'none' }} />
            <input
              ref={nameRef}
              type="text"
              className="form-input"
              style={{ paddingLeft: 32 }}
              placeholder="Naam van je organisatie"
              value={name}
              onChange={e => { setError(''); setName(e.target.value) }}
              required
            />
          </div>

          {/* E-mail */}
          <div style={{ position: 'relative' }}>
            <Mail size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--s400)', pointerEvents: 'none' }} />
            <input
              type="email"
              className="form-input"
              style={{ paddingLeft: 32 }}
              placeholder="E-mailadres"
              value={email}
              onChange={e => { setError(''); setEmail(e.target.value) }}
              required
            />
          </div>

          {/* Wachtwoord */}
          <div style={{ position: 'relative' }}>
            <Lock size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--s400)', pointerEvents: 'none' }} />
            <input
              type="password"
              className="form-input"
              style={{ paddingLeft: 32 }}
              placeholder="Wachtwoord (min. 8 tekens)"
              value={password}
              onChange={e => { setError(''); setPassword(e.target.value) }}
              required
            />
          </div>

          {/* Bevestig wachtwoord */}
          <div style={{ position: 'relative' }}>
            <Lock size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--s400)', pointerEvents: 'none' }} />
            <input
              type="password"
              className="form-input"
              style={{ paddingLeft: 32, borderColor: password2 && password !== password2 ? 'var(--danger)' : undefined }}
              placeholder="Wachtwoord bevestigen"
              value={password2}
              onChange={e => { setError(''); setPassword2(e.target.value) }}
              required
            />
          </div>

          {error && (
            <p style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600, margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={!name || !email || !password || !password2 || loading}
            style={{ gap: 8, marginTop: 4 }}
          >
            {loading
              ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              : <><ArrowRight size={15} /> Account aanmaken</>
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', marginTop: '1.25rem' }}>
          Al een account?{' '}
          <a href="/" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Log in
          </a>
        </p>
      </div>
    </div>
  )
}
