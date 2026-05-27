import { useState, useRef, useEffect } from 'react'
import { Tent, Lock, ArrowRight } from 'lucide-react'
import { useLang } from '../LangContext'
import { login } from '../api'

export default function LoginScreen({ onLogin, lang, setLang }) {
  const { t } = useLang()
  const [pin, setPin]       = useState('')
  const [error, setError]   = useState(false)
  const [shake, setShake]   = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pin || loading) return
    setLoading(true)
    setError(false)
    try {
      const { token, role } = await login(pin)
      localStorage.setItem('kassa_token', token)
      localStorage.setItem('kassa_role', role || 'admin')
      onLogin(token, role || 'admin')
    } catch {
      setError(true)
      setShake(true)
      setPin('')
      setTimeout(() => setShake(false), 500)
      inputRef.current?.focus()
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
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: 52, height: 52,
            background: 'var(--g600)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 20px rgba(22,163,74,0.3)',
          }}>
            <Tent size={26} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--s900)', letterSpacing: '-0.3px' }}>
            Kassa
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
            {t('login_sub')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Lock
              size={15}
              style={{
                position: 'absolute', left: 11, top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--s400)',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              className={`form-input${shake ? ' login-shake' : ''}`}
              style={{
                paddingLeft: 34,
                fontSize: '1.1rem',
                letterSpacing: '0.25em',
                textAlign: 'center',
                borderColor: error ? 'var(--danger)' : undefined,
              }}
              placeholder={t('login_placeholder')}
              value={pin}
              onChange={e => {
                setError(false)
                setPin(e.target.value.replace(/\D/g, '').slice(0, 16))
              }}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p style={{
              fontSize: '0.78rem',
              color: 'var(--danger)',
              textAlign: 'center',
              marginBottom: '0.85rem',
              fontWeight: 600,
            }}>
              {t('login_error')}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={!pin || loading}
            style={{ gap: 8 }}
          >
            {loading ? (
              <span style={{
                width: 16, height: 16,
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }} />
            ) : (
              <><ArrowRight size={15} /> {t('login_submit')}</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
