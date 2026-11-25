import { useState, useEffect } from 'react'
import { Mail, KeyRound, User, ArrowRight, AlertTriangle } from 'lucide-react'
import { translations } from '../i18n'
import { fetchInvite, acceptInvite } from '../api'

const Spinner = () => (
  <span style={{
    width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
    borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite',
  }} />
)

export default function AcceptInvite() {
  const lang = localStorage.getItem('kassa_lang') || 'nl'
  const t = key => translations[lang]?.[key] ?? key

  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [info, setInfo]       = useState(null)   // invite details
  const [loadErr, setLoadErr] = useState('')
  const [name, setName]         = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!token) { setLoadErr(t('invite_invalid')); return }
    fetchInvite(token).then(setInfo).catch(e => setLoadErr(e.message || t('invite_invalid')))
  }, [token])   // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const { token: sessionToken, role } = await acceptInvite({ token, password, name: name.trim() || undefined })
      localStorage.setItem('kassa_token', sessionToken)
      localStorage.setItem('kassa_role', role || 'cashier')
      window.location.href = '/'
    } catch (err) {
      setError(err.message || t('invite_failed'))
      setBusy(false)
    }
  }

  const roleLabel = info?.role === 'admin' ? t('role_admin') : t('role_cashier')

  const shell = (children) => (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(130% 80% at 50% -10%, #2E6B4E 0%, #1E4D39 45%, #163A2B 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: '2.25rem 2rem 2rem',
        width: '100%', maxWidth: '380px', boxShadow: '0 30px 60px -18px rgba(12,30,20,0.55)',
        borderTop: '4px solid var(--accent)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <img src="/tappy-pos.png" alt="Tappy" style={{ height: 50, objectFit: 'contain', margin: '0 auto 0.6rem', display: 'block' }} />
        </div>
        {children}
      </div>
    </div>
  )

  if (loadErr) return shell(
    <div style={{ textAlign: 'center' }}>
      <AlertTriangle size={28} color="var(--danger)" style={{ marginBottom: 10 }} />
      <p style={{ color: 'var(--s900)', fontWeight: 600, marginBottom: 6 }}>{loadErr}</p>
      <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1rem' }}>{t('invite_invalid_hint')}</p>
      <a href="/" className="btn btn-primary btn-full">{t('invite_to_login')}</a>
    </div>
  )

  if (!info) return shell(<div style={{ textAlign: 'center', color: 'var(--muted)' }}>{t('loading')}…</div>)

  return shell(
    <>
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <p style={{ fontFamily: 'var(--display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--s900)' }}>
          {t('invite_title')}
        </p>
        <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
          {t('invite_body_1')} <strong style={{ color: 'var(--s800)' }}>{info.account.name}</strong> {t('invite_body_2')} <strong style={{ color: 'var(--s800)' }}>{roleLabel}</strong>.
        </p>
      </div>

      <form onSubmit={submit}>
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <Mail size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--s400)' }} />
          <input className="form-input" style={{ paddingLeft: 38, background: 'var(--s100)' }} value={info.email} readOnly />
        </div>

        {!info.userExists && (
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <User size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--s400)' }} />
            <input className="form-input" style={{ paddingLeft: 38 }} placeholder={t('login_name_optional')}
              value={name} onChange={e => setName(e.target.value)} />
          </div>
        )}

        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <KeyRound size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--s400)' }} />
          <input className="form-input" style={{ paddingLeft: 38 }} type="password"
            placeholder={info.userExists ? t('invite_pw_existing') : t('invite_pw_new')}
            value={password} onChange={e => setPassword(e.target.value)} required
            autoComplete={info.userExists ? 'current-password' : 'new-password'} />
        </div>

        {error && <p style={{ fontSize: '0.8rem', color: 'var(--danger)', textAlign: 'center', margin: '0 0 0.75rem', fontWeight: 600 }}>{error}</p>}

        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={busy || !password} style={{ gap: 8 }}>
          {busy ? <Spinner /> : <><ArrowRight size={16} /> {t('invite_accept_btn')}</>}
        </button>
      </form>
    </>
  )
}
