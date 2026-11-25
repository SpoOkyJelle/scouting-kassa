import { useState, useRef, useEffect } from 'react'
import { Lock, ArrowRight } from 'lucide-react'
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
      background:
        'radial-gradient(130% 80% at 50% -10%, #2E6B4E 0%, #1E4D39 45%, #163A2B 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Faint campfire glow, drawn with CSS so it works offline */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background:
          'radial-gradient(40% 30% at 50% 8%, rgba(199,122,26,0.22) 0%, rgba(199,122,26,0) 70%)',
      }} />

      {/* Language toggle */}
      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 2 }}>
        <div className="lang-switcher">
          <button className={`lang-btn ${lang === 'nl' ? 'active' : ''}`} onClick={() => setLang('nl')}>NL</button>
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-xl)',
        padding: '2.5rem 2rem 2rem',
        width: '100%',
        maxWidth: '360px',
        boxShadow: '0 30px 60px -18px rgba(12,30,20,0.55)',
        position: 'relative',
        zIndex: 2,
        borderTop: '4px solid var(--accent)',
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img
            src="/tappy-pos.png"
            alt="Tappy"
            style={{ height: 60, objectFit: 'contain', margin: '0 auto 0.75rem', display: 'block' }}
          />
          <p style={{
            fontFamily: 'var(--display)',
            fontSize: '1.15rem',
            fontWeight: 700,
            letterSpacing: '-0.4px',
            color: 'var(--s900)',
          }}>
            {t('login_sub')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Lock
              size={16}
              style={{
                position: 'absolute', left: 13, top: '50%',
                transform: 'translateY(-50%)',
                color: error ? 'var(--danger)' : 'var(--s400)',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              className={`form-input${shake ? ' login-shake' : ''}`}
              style={{
                paddingLeft: 38,
                paddingTop: 12,
                paddingBottom: 12,
                fontSize: '1.35rem',
                fontFamily: 'var(--display)',
                letterSpacing: '0.3em',
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
              fontSize: '0.8rem',
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
              <><ArrowRight size={16} /> {t('login_submit')}</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
