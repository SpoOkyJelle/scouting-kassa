import { useState, useRef, useEffect } from 'react'
import { Lock, ArrowRight, Mail } from 'lucide-react'
import { useLang } from '../LangContext'
import { emailLogin } from '../api'

export default function LoginScreen({ onLogin, lang, setLang }) {
  const { t } = useLang()
  const [email, setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]   = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleEmailSubmit(e) {
    e.preventDefault()
    if (!email || !password || loading) return
    setLoading(true)
    setError(false)
    setErrorMsg('')
    try {
      const { token, role } = await emailLogin(email, password)
      localStorage.setItem('kassa_token', token)
      localStorage.setItem('kassa_role', role || 'admin')
      localStorage.removeItem('kassa_employee')
      onLogin(token, role || 'admin', '')
    } catch (err) {
      setError(true)
      setErrorMsg(err.message || 'Inloggen mislukt')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--s900)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      {/* Language toggle */}
      <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
        <div className="lang-switcher">
          <button className={`lang-btn ${lang === 'nl' ? 'active' : ''}`} onClick={() => setLang('nl')}>NL</button>
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: '#fff',
        borderRadius: 'var(--r-xl)',
        padding: '2.25rem 2rem',
        width: '100%',
        maxWidth: '340px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/tickd-logo.png" alt="Tickd" style={{ height: 80, width: 'auto', margin: '0 auto 0.75rem', display: 'block' }} />
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
            {t('login_sub')}
          </p>
        </div>

        {/* E-mail form */}
        <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <Mail size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--s400)', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              type="email"
              className="form-input"
              style={{ paddingLeft: 32 }}
              placeholder="E-mailadres"
              value={email}
              onChange={e => { setError(false); setEmail(e.target.value) }}
              autoComplete="email"
              required
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--s400)', pointerEvents: 'none' }} />
            <input
              type="password"
              className="form-input"
              style={{ paddingLeft: 32, borderColor: error ? 'var(--danger)' : undefined }}
              placeholder="Wachtwoord"
              value={password}
              onChange={e => { setError(false); setPassword(e.target.value) }}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600, margin: 0 }}>{errorMsg || t('login_error')}</p>}
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={!email || !password || loading} style={{ gap: 8 }}>
            {loading
              ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              : <><ArrowRight size={15} /> Inloggen</>}
          </button>
        </form>

        {/* Register link */}
        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', marginTop: '1.25rem' }}>
          Nog geen account?{' '}
          <a href="/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Gratis starten →
          </a>
        </p>
      </div>
    </div>
  )
}
