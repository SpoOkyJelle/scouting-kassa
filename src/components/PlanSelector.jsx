import { useState } from 'react'
import { Sparkles, Check } from 'lucide-react'
import { useLang } from '../LangContext'
import { updatePlan } from '../api'
import { useToast } from './Toast'
import SettingsCard from './SettingsCard'
import { PLANS } from '../plans'

export default function PlanSelector({ account, onChange }) {
  const { t, lang } = useLang()
  const showToast   = useToast()
  const [busy, setBusy] = useState(null)   // plan id being applied
  const currentId = account?.plan || 'free'

  async function choose(id) {
    if (id === currentId || busy) return
    setBusy(id)
    try {
      const updated = await updatePlan(id)
      onChange?.(updated)
      showToast(t('plan_changed'))
    } catch (err) {
      showToast(err.message || t('toast_no_access'), 'error')
    }
    setBusy(null)
  }

  return (
    <SettingsCard Icon={Sparkles} label={t('plan_section')} color="#C77A1A">
      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.9rem', lineHeight: 1.5 }}>
        {t('plan_hint')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {PLANS.map(p => {
          const active = p.id === currentId
          return (
            <div key={p.id} style={{
              border: active ? '2px solid var(--primary, #2E6B4E)' : '1px solid var(--border)',
              borderRadius: 12, padding: '14px 13px', background: active ? 'var(--s50)' : 'var(--surface)',
              display: 'flex', flexDirection: 'column', position: 'relative',
            }}>
              {p.highlight && !active && (
                <span style={{
                  position: 'absolute', top: -9, right: 12, background: 'var(--accent)', color: '#fff',
                  fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{t('plan_popular')}</span>
              )}
              <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: '1rem', color: 'var(--s900)' }}>{p.name[lang]}</div>
              <div style={{ margin: '4px 0 2px' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--s900)' }}>{p.price[lang]}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}> {p.period[lang]}</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--muted)', lineHeight: 1.45, marginBottom: 10 }}>{p.tagline[lang]}</div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                {p.features[lang].map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '0.76rem', color: 'var(--s700)' }}>
                    <Check size={13} color="var(--primary, #2E6B4E)" style={{ marginTop: 2, flexShrink: 0 }} /> {f}
                  </li>
                ))}
              </ul>

              {active ? (
                <div className="btn btn-outline btn-sm" style={{ gap: 6, cursor: 'default', justifyContent: 'center' }}>
                  <Check size={14} /> {t('plan_current')}
                </div>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={() => choose(p.id)} disabled={busy === p.id} style={{ justifyContent: 'center' }}>
                  {busy === p.id ? t('loading') : t('plan_choose')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>
        {t('plan_no_billing')}
      </p>
    </SettingsCard>
  )
}
