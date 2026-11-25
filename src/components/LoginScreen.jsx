import { useState, useRef, useEffect } from 'react'
import { Lock, ArrowRight, Mail, KeyRound, Building2, User } from 'lucide-react'
import { useLang } from '../LangContext'
import { login, loginPassword, register } from '../api'

const Spinner = () => (
  <span style={{
    width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
    borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite',
  }} />
)

export default function LoginScreen({ onLogin, lang, setLang }) {
  const { t } = useLang()
  const [mode, setMode]     = useState('account')   // 'account' | 'pin'
  const [auth, setAuth]     = useState('login')      // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // account fields
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [org, setOrg]           = useState('')
  const [name, setName]         = useState('')

  // pin
  const [pin, setPin]   = useState('')
  const [shake, setShake] = useState(false)
  const pinRef = useRef(null)

  useEffect(() => { if (mode === 'pin') pinRef.current?.focus() }, [mode])

  function finish({ token, role }) {
    localStorage.setItem('kassa_token', token)
    localStorage.setItem('kassa_role', role || 'admin')
    onLogin(token, role || 'admin')
  }

  async function handleAccount(e) {
    e.preventDefault()
    if (loading) return
    setLoading(true); setError('')
    try {
      if (auth === 'register') {
        finish(await register({ email: email.trim(), password, org: org.trim(), name: name.trim() || undefined }))
      } else {
        finish(await loginPassword(email.trim(), password))
      }
    } catch (err) {
      setError(err.message || (auth === 'register' ? t('login_register_error') : t('login_account_error')))
    }
    setLoading(false)
  }

  async function handlePin(e) {
    e.preventDefault()
    if (!pin || loading) return
    setLoading(true); setError('')
    try {
      finish(await login(pin))
    } catch {
      setError(t('login_error')); setShake(true); setPin('')
      setTimeout(() => setShake(false), 500)
      pinRef.current?.focus()
    }
    setLoading(false)
  }

  const inputWrap = { position: 'relative', marginBottom: '0.75rem' }
  const iconStyle = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--s400)', pointerEvents: 'none' }
  const fieldStyle = { paddingLeft: 38 }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(130% 80% at 50% -10%, #2E6B4E 0%, #1E4D39 45%, #163A2B 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(40% 30% at 50% 8%, rgba(199,122,26,0.22) 0%, rgba(199,122,26,0) 70%)',
      }} />

      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 2 }}>
        <div className="lang-switcher">
          <button className={`lang-btn ${lang === 'nl' ? 'active' : ''}`} onClick={() => setLang('nl')}>NL</button>
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
        </div>
      </div>

      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: '2.25rem 2rem 2rem',
        width: '100%', maxWidth: '360px', boxShadow: '0 30px 60px -18px rgba(12,30,20,0.55)',
        position: 'relative', zIndex: 2, borderTop: '4px solid var(--accent)',
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <img src="/tappy-pos.png" alt="Tappy" style={{ height: 54, objectFit: 'contain', margin: '0 auto 0.6rem', display: 'block' }} />
          <p style={{ fontFamily: 'var(--display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--s900)' }}>
            {t('login_sub')}
          </p>
        </div>

        {/* Mode switch */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem' }}>
          {[{ k: 'account', label: t('login_mode_account') }, { k: 'pin', label: t('login_mode_pin') }].map(({ k, label }) => (
            <button
              key={k}
              type="button"
              className={`btn btn-sm ${mode === k ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1 }}
              onClick={() => { setMode(k); setError('') }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Account mode ── */}
        {mode === 'account' && (
          <form onSubmit={handleAccount}>
            {auth === 'register' && (
              <>
                <div style={inputWrap}>
                  <Building2 size={16} style={iconStyle} />
                  <input className="form-input" style={fieldStyle} placeholder={t('login_org')}
                    value={org} onChange={e => setOrg(e.target.value)} required />
                </div>
                <div style={inputWrap}>
                  <User size={16} style={iconStyle} />
                  <input className="form-input" style={fieldStyle} placeholder={t('login_name_optional')}
                    value={name} onChange={e => setName(e.target.value)} />
                </div>
              </>
            )}
            <div style={inputWrap}>
              <Mail size={16} style={iconStyle} />
              <input className="form-input" style={fieldStyle} type="email" placeholder={t('login_email')}
                value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
            </div>
            <div style={inputWrap}>
              <KeyRound size={16} style={iconStyle} />
              <input className="form-input" style={fieldStyle} type="password" placeholder={t('login_password')}
                value={password} onChange={e => setPassword(e.target.value)} required
                autoComplete={auth === 'register' ? 'new-password' : 'current-password'} />
            </div>

            {error && <p style={{ fontSize: '0.8rem', color: 'var(--danger)', textAlign: 'center', margin: '0 0 0.75rem', fontWeight: 600 }}>{error}</p>}

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} style={{ gap: 8 }}>
              {loading ? <Spinner /> : <><ArrowRight size={16} /> {auth === 'register' ? t('login_do_register') : t('login_do_login')}</>}
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm btn-full"
              style={{ marginTop: '0.75rem' }}
              onClick={() => { setAuth(auth === 'login' ? 'register' : 'login'); setError('') }}
            >
              {auth === 'login' ? t('login_to_register') : t('login_to_login')}
            </button>
          </form>
        )}

        {/* ── PIN mode ── */}
        {mode === 'pin' && (
          <form onSubmit={handlePin}>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', marginBottom: '0.85rem' }}>
              {t('login_pin_hint')}
            </p>
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Lock size={16} style={{ ...iconStyle, color: error ? 'var(--danger)' : 'var(--s400)' }} />
              <input
                ref={pinRef}
                type="password"
                inputMode="numeric"
                className={`form-input${shake ? ' login-shake' : ''}`}
                style={{ paddingLeft: 38, paddingTop: 12, paddingBottom: 12, fontSize: '1.35rem', fontFamily: 'var(--display)', letterSpacing: '0.3em', textAlign: 'center', borderColor: error ? 'var(--danger)' : undefined }}
                placeholder={t('login_placeholder')}
                value={pin}
                onChange={e => { setError(''); setPin(e.target.value.replace(/\D/g, '').slice(0, 16)) }}
                autoComplete="current-password"
              />
            </div>
            {error && <p style={{ fontSize: '0.8rem', color: 'var(--danger)', textAlign: 'center', marginBottom: '0.85rem', fontWeight: 600 }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={!pin || loading} style={{ gap: 8 }}>
              {loading ? <Spinner /> : <><ArrowRight size={16} /> {t('login_submit')}</>}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
