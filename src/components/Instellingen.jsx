import { useState, useEffect } from 'react'
import { Globe, QrCode, ExternalLink, Moon, Shield, Save } from 'lucide-react'
import { useLang } from '../LangContext'
import { updateSettings } from '../api'
import { useToast } from './Toast'

function SettingsCard({ Icon, label, color = 'var(--primary)', children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      marginBottom: '0.85rem',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--s50)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={14} color={color} strokeWidth={2.3} />
        </div>
        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--s800)' }}>{label}</span>
      </div>
      <div style={{ padding: '1rem' }}>
        {children}
      </div>
    </div>
  )
}

export default function Instellingen({ settings, onSave, lang, setLang, darkMode, setDarkMode, role }) {
  const { t } = useLang()
  const showToast = useToast()

  const [paymentUrl,  setPaymentUrl]  = useState(settings.paymentUrl  ?? '')
  const [paymentName, setPaymentName] = useState(settings.paymentName ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPaymentUrl(settings.paymentUrl  ?? '')
    setPaymentName(settings.paymentName ?? '')
  }, [settings.paymentUrl, settings.paymentName])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateSettings({ paymentUrl, paymentName })
      onSave(updated)
      showToast(t('toast_saved'))
    } catch {
      showToast(t('toast_no_access'), 'error')
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 560 }}>

      {/* ── Taal ────────────────────────────────────────────────────────── */}
      <SettingsCard Icon={Globe} label={t('settings_language')} color="#2563EB">
        <div style={{ display: 'flex', gap: 8 }}>
          {['nl', 'en'].map(code => (
            <button
              key={code}
              className={`btn ${lang === code ? 'btn-primary' : 'btn-outline'}`}
              style={{ minWidth: 90, gap: 6 }}
              onClick={() => setLang(code)}
            >
              {code === 'nl' ? '🇳🇱  Nederlands' : '🇬🇧  English'}
            </button>
          ))}
        </div>
      </SettingsCard>

      {/* ── Weergave ────────────────────────────────────────────────────── */}
      <SettingsCard Icon={Moon} label={t('settings_appearance')} color="#7C3AED">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.87rem', color: 'var(--s800)' }}>
              {t('dark_mode')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
              {darkMode ? 'Donkere modus actief' : 'Lichte modus actief'}
            </div>
          </div>
          <button
            className={`toggle-switch${darkMode ? ' on' : ''}`}
            onClick={() => setDarkMode(d => !d)}
            aria-label={t('dark_mode')}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </SettingsCard>

      {/* ── Rollen ──────────────────────────────────────────────────────── */}
      <SettingsCard Icon={Shield} label={t('settings_roles')} color="#D97706">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: role === 'admin' ? 10 : 0 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{t('your_role')}:</span>
          <span className={`role-badge ${role === 'admin' ? 'role-admin' : 'role-cashier'}`}>
            {role === 'admin' ? t('role_admin') : t('role_cashier')}
          </span>
        </div>
        {role === 'admin' && (
          <div style={{
            background: 'var(--s50)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 10px',
            fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6,
            fontFamily: 'monospace',
          }}>
            {t('cashier_pin_hint')}
          </div>
        )}
      </SettingsCard>

      {/* ── Betaalverzoek ───────────────────────────────────────────────── */}
      {role === 'admin' && (
        <SettingsCard Icon={QrCode} label={t('settings_payment_section')} color="#16A34A">
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">{t('settings_payment_url')}</label>
              <input
                className="form-input"
                type="url"
                placeholder={t('settings_payment_url_ph')}
                value={paymentUrl}
                onChange={e => setPaymentUrl(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('settings_payment_name')}</label>
              <textarea
                className="form-input"
                placeholder={t('settings_payment_name_ph')}
                value={paymentName}
                onChange={e => setPaymentName(e.target.value)}
                rows={2}
                style={{ resize: 'vertical', minHeight: 60 }}
              />
            </div>

            {paymentUrl && (
              <div style={{
                background: 'var(--s50)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 10px', marginBottom: '0.85rem',
              }}>
                <span className="form-label" style={{ display: 'block', marginBottom: 5 }}>
                  {t('settings_payment_preview')}
                </span>
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: '0.76rem', color: 'var(--primary)', textDecoration: 'none',
                    wordBreak: 'break-all',
                  }}
                >
                  <ExternalLink size={12} />
                  {paymentUrl.length > 60 ? paymentUrl.slice(0, 60) + '…' : paymentUrl}
                </a>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ gap: 6 }}>
              <Save size={14} />
              {saving ? t('loading') : t('save')}
            </button>
          </form>
        </SettingsCard>
      )}
    </div>
  )
}
