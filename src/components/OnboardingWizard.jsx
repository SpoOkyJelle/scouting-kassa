import { useState } from 'react'
import { Tags, Package, Sparkles, Check, ArrowRight, ArrowLeft, Store } from 'lucide-react'
import { useLang } from '../LangContext'
import { updateSettings } from '../api'
import { useToast } from './Toast'
import CategoryEditor from './CategoryEditor'
import Producten from './Producten'
import PlanSelector from './PlanSelector'
import SettingsCard from './SettingsCard'

// Setup wizard shown once, right after an account is created. Walks the owner
// through configuring their POS by reusing the existing editors, then marks the
// account as onboarded so it never shows again. Payment link and PINs are set
// later in Settings; the final step is the subscription choice.
export default function OnboardingWizard({ settings, onSave, account, onAccountChange, onFinish }) {
  const { t }     = useLang()
  const showToast = useToast()
  const [step, setStep]       = useState(0)
  const [saving, setSaving]   = useState(false)

  // Step 0 — shop name
  const [shopName, setShopName] = useState(settings.shopName || '')

  const steps = [
    { key: 'welcome',  Icon: Store,    label: t('onb_step_welcome') },
    { key: 'cats',     Icon: Tags,     label: t('onb_step_cats') },
    { key: 'products', Icon: Package,  label: t('onb_step_products') },
    { key: 'plan',     Icon: Sparkles, label: t('onb_step_finish') },
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
    try {
      const updated = await updateSettings({ onboarded: true })
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
    <div className="onb-wrap">
      <div className="onb-inner">

        {/* Header + skip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.5rem 0 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/tappy-pos.png" alt="Tappy" style={{ height: 34, objectFit: 'contain' }} />
            <strong style={{ fontFamily: 'var(--display)', fontSize: '1.1rem', color: 'var(--s900)' }}>{t('onb_title')}</strong>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={skip}>{t('onb_skip')}</button>
        </div>

        {/* Stepper with continuous progress line */}
        <div className="onb-stepper">
          {/* The track runs from the centre of the first node to the centre of
              the last; its fill grows to the active node as you advance. */}
          <div className="onb-track" style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }}>
            <div className="onb-track-fill" style={{ width: `${last ? (step / last) * 100 : 0}%` }} />
          </div>
          {steps.map((s, i) => {
            const done = i < step, active = i === step
            return (
              <div key={s.key} className="onb-node">
                <div className={`onb-dot${active ? ' active' : ''}${done ? ' done' : ''}`}>
                  {done ? <Check size={16} className="onb-check" /> : <s.Icon size={16} />}
                </div>
                <span className={`onb-label${active ? ' active' : ''}`}>{s.label}</span>
              </div>
            )
          })}
        </div>

        {/* Step body — keyed on step so the transition replays on each change */}
        <div className="onb-step" key={step}>
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
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 1rem', textAlign: 'center' }}>
              {t('onb_finish_body')}
            </p>
            <PlanSelector account={account} onChange={onAccountChange} />
          </>
        )}
        </div>

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
