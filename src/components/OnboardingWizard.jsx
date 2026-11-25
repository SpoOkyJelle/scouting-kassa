import { useState } from 'react'
import { Tags, Package, CreditCard, Check, ArrowRight, ArrowLeft, Store, PartyPopper } from 'lucide-react'
import { useLang } from '../LangContext'
import { updateSettings } from '../api'
import { useToast } from './Toast'
import CategoryEditor from './CategoryEditor'
import Producten from './Producten'
import SettingsCard from './SettingsCard'

// Setup wizard shown once, right after an account is created. Walks the owner
// through configuring their POS by reusing the existing editors, then marks the
// account as onboarded so it never shows again.
export default function OnboardingWizard({ settings, onSave, onFinish }) {
  const { t }     = useLang()
  const showToast = useToast()
  const [step, setStep]       = useState(0)
  const [saving, setSaving]   = useState(false)

  // Step 0 — shop name
  const [shopName, setShopName] = useState(settings.shopName || '')
  // Step 3 — payment + PIN
  const [paymentName, setPaymentName] = useState(settings.paymentName || '')
  const [paymentUrl,  setPaymentUrl]  = useState(settings.paymentUrl || '')
  const [cashierPin,  setCashierPin]  = useState('')
  const [adminPin,    setAdminPin]    = useState('')

  const steps = [
    { key: 'welcome',  Icon: Store,      label: t('onb_step_welcome') },
    { key: 'cats',     Icon: Tags,       label: t('onb_step_cats') },
    { key: 'products', Icon: Package,    label: t('onb_step_products') },
    { key: 'finish',   Icon: CreditCard, label: t('onb_step_finish') },
  ]
  const last = steps.length - 1

  async function saveShopName() {
    if (!shopName.trim()) return true
    try {
      const updated = await updateSettings({ shopName: shopName.trim() })
      onSave(updated)
      return true
    } catch { showToast(t('toast_no_access'), 'error'); return false }
  }

  async function next() {
    if (step === 0) { if (!(await saveShopName())) return }
    setStep(s => Math.min(s + 1, last))
  }
  function back() { setStep(s => Math.max(s - 1, 0)) }

  async function finish() {
    setSaving(true)
    const patch = { onboarded: true }
    if (paymentName.trim()) patch.paymentName = paymentName.trim()
    if (paymentUrl.trim())  patch.paymentUrl  = paymentUrl.trim()
    if (/^\d{4,}$/.test(cashierPin)) patch.cashierPin = cashierPin
    if (/^\d{4,}$/.test(adminPin))   patch.adminPin   = adminPin
    try {
      const updated = await updateSettings(patch)
      onSave(updated)
      showToast(t('onb_done_toast'))
      onFinish()
    } catch {
      showToast(t('toast_no_access'), 'error')
    }
    setSaving(false)
  }

  async function skip() {
    try {
      const updated = await updateSettings({ onboarded: true })
      onSave(updated)
    } catch { /* ignore */ }
    onFinish()
  }

  const inputStyle = { marginBottom: '0.75rem' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg, var(--s50))', padding: '1.25rem 0 3rem' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 1rem' }}>

        {/* Header + skip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.5rem 0 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/tappy-pos.png" alt="Tappy" style={{ height: 34, objectFit: 'contain' }} />
            <strong style={{ fontFamily: 'var(--display)', fontSize: '1.1rem', color: 'var(--s900)' }}>{t('onb_title')}</strong>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={skip}>{t('onb_skip')}</button>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem' }}>
          {steps.map((s, i) => {
            const done = i < step, active = i === step
            return (
              <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'var(--accent)' : done ? 'var(--primary, #2E6B4E)' : 'var(--s200)',
                  color: active || done ? '#fff' : 'var(--s500)',
                  transition: 'all .2s',
                }}>
                  {done ? <Check size={16} /> : <s.Icon size={16} />}
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: active ? 'var(--s900)' : 'var(--muted)', textAlign: 'center' }}>{s.label}</span>
              </div>
            )
          })}
        </div>

        {/* Step body */}
        {step === 0 && (
          <SettingsCard Icon={Store} label={t('onb_step_welcome')} color="#2E6B4E">
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '1rem' }}>
              {t('onb_welcome_body')}
            </p>
            <label className="form-label">{t('onb_shopname_label')}</label>
            <input className="form-input" style={inputStyle} placeholder={t('onb_shopname_ph')}
              value={shopName} onChange={e => setShopName(e.target.value)} />
          </SettingsCard>
        )}

        {step === 1 && (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 1rem', textAlign: 'center' }}>
              {t('onb_cats_body')}
            </p>
            <CategoryEditor settings={settings} onSave={onSave} />
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 1rem', textAlign: 'center' }}>
              {t('onb_products_body')}
            </p>
            <Producten />
          </>
        )}

        {step === 3 && (
          <SettingsCard Icon={PartyPopper} label={t('onb_step_finish')} color="#C77A1A">
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '1.1rem' }}>
              {t('onb_finish_body')}
            </p>

            <label className="form-label">{t('onb_payment_name')}</label>
            <textarea className="form-input" style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }}
              placeholder={t('onb_payment_name_ph')} value={paymentName} onChange={e => setPaymentName(e.target.value)} />

            <label className="form-label">{t('onb_payment_url')}</label>
            <input className="form-input" style={inputStyle} placeholder="https://…"
              value={paymentUrl} onChange={e => setPaymentUrl(e.target.value)} />

            <div style={{ height: 1, background: 'var(--border)', margin: '1rem 0' }} />

            <label className="form-label">{t('onb_cashier_pin')}</label>
            <input className="form-input" style={inputStyle} inputMode="numeric" placeholder={t('onb_pin_ph')}
              value={cashierPin} onChange={e => setCashierPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />

            <label className="form-label">{t('onb_admin_pin')}</label>
            <input className="form-input" style={inputStyle} inputMode="numeric" placeholder={t('onb_pin_ph')}
              value={adminPin} onChange={e => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>{t('onb_pin_hint')}</p>
          </SettingsCard>
        )}

        {/* Nav */}
        <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem' }}>
          {step > 0 && (
            <button className="btn btn-outline" onClick={back} style={{ gap: 6 }}>
              <ArrowLeft size={15} /> {t('onb_back')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < last ? (
            <button className="btn btn-primary btn-lg" onClick={next} style={{ gap: 6 }}>
              {t('onb_next')} <ArrowRight size={15} />
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={finish} disabled={saving} style={{ gap: 6 }}>
              <Check size={15} /> {saving ? t('loading') : t('onb_finish_btn')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
