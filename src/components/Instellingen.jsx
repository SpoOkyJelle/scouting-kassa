import { useState, useEffect } from 'react'
import { Globe, QrCode, ExternalLink, Moon, Shield } from 'lucide-react'
import { useLang } from '../LangContext'
import { updateSettings } from '../api'
import { useToast } from './Toast'

export default function Instellingen({ settings, onSave, lang, setLang, darkMode, setDarkMode, role }) {
  const { t } = useLang()
  const showToast = useToast()

  const [paymentUrl,  setPaymentUrl]  = useState(settings.paymentUrl  ?? '')
  const [paymentName, setPaymentName] = useState(settings.paymentName ?? '')
  const [saving, setSaving] = useState(false)

  // Sync if settings prop changes (e.g. first load)
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
      <div className="page-surface" style={{ marginBottom: '0.85rem' }}>
        <p className="section-title" style={{ marginBottom: '1rem' }}>
          <Globe size={15} />
          {t('settings_language')}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {['nl', 'en'].map(code => (
            <button
              key={code}
              className={`btn ${lang === code ? 'btn-primary' : 'btn-outline'}`}
              style={{ minWidth: 80 }}
              onClick={() => setLang(code)}
            >
              {code === 'nl' ? '🇳🇱  Nederlands' : '🇬🇧  English'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Weergave ────────────────────────────────────────────────────── */}
      <div className="page-surface" style={{ marginBottom: '0.85rem' }}>
        <p className="section-title" style={{ marginBottom: '1rem' }}>
          <Moon size={15} />
          {t('settings_appearance')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.87rem', color: 'var(--s800)', fontWeight: 500 }}>
            {t('dark_mode')}
          </span>
          <button
            className={`toggle-switch${darkMode ? ' on' : ''}`}
            onClick={() => setDarkMode(d => !d)}
            aria-label={t('dark_mode')}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      {/* ── Rollen ──────────────────────────────────────────────────────── */}
      <div className="page-surface" style={{ marginBottom: '0.85rem' }}>
        <p className="section-title" style={{ marginBottom: '0.85rem' }}>
          <Shield size={15} />
          {t('settings_roles')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{t('your_role')}:</span>
          <span className={`role-badge ${role === 'admin' ? 'role-admin' : 'role-cashier'}`}>
            {role === 'admin' ? t('role_admin') : t('role_cashier')}
          </span>
        </div>
        {role === 'admin' && (
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
            {t('cashier_pin_hint')}
          </p>
        )}
      </div>

      {/* ── Betaalverzoek ───────────────────────────────────────────────── */}
      {role === 'admin' && (
        <div className="page-surface">
          <p className="section-title" style={{ marginBottom: '1rem' }}>
            <QrCode size={15} />
            {t('settings_payment_section')}
          </p>

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

            {/* Preview */}
            {paymentUrl && (
              <div className="settings-preview">
                <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  {t('settings_payment_preview')}
                </span>
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="settings-preview-link"
                >
                  <ExternalLink size={12} />
                  {paymentUrl.length > 60 ? paymentUrl.slice(0, 60) + '…' : paymentUrl}
                </a>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ marginTop: '0.5rem' }}
            >
              {saving ? t('loading') : t('save')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
