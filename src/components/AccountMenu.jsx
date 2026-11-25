import { useState, useRef, useEffect } from 'react'
import { ChevronDown, LogOut, Check, Building2, Sparkles } from 'lucide-react'
import { useLang } from '../LangContext'
import { getPlan } from '../plans'

export default function AccountMenu({ accounts, account, role, onSwitch, onLogout, onManagePlan }) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const current = accounts.find(a => a.current)
  const name = account?.name || current?.name || '—'
  const plan = getPlan(account?.plan)
  const roleKey = role === 'admin' ? 'role_admin' : 'role_cashier'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-sm"
        onClick={() => setOpen(o => !o)}
        title={name}
        style={{ background: 'rgba(255,255,255,0.10)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', gap: 6, maxWidth: 190 }}
      >
        <Building2 size={14} />
        <span className="tab-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 18px 40px -14px rgba(12,30,20,0.4)', minWidth: 240, overflow: 'hidden',
        }}>
          {/* Current account summary */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--s900)', marginBottom: 6, wordBreak: 'break-word' }}>{name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className={`role-badge ${role === 'admin' ? 'role-admin' : 'role-cashier'}`}>{t(roleKey)}</span>
              <span className="role-badge" style={{ background: 'var(--accent)', color: '#fff' }}>{plan.name[lang]}</span>
            </div>
          </div>

          {/* Account switcher */}
          {accounts.length > 1 && (
            <div style={{ padding: '6px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 8px' }}>
                {t('account_switch')}
              </div>
              {accounts.map(a => (
                <button key={a.id} onClick={() => { setOpen(false); onSwitch(a.id) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    padding: '8px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 8,
                    color: 'var(--s800)', fontSize: '0.86rem',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--s50)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  {a.current && <Check size={15} color="var(--primary)" />}
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ padding: '6px' }}>
            {onManagePlan && (
              <button onClick={() => { setOpen(false); onManagePlan() }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 8, color: 'var(--s800)', fontSize: '0.86rem' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--s50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <Sparkles size={15} color="var(--accent)" /> {t('account_manage_plan')}
              </button>
            )}
            <button onClick={() => { setOpen(false); onLogout() }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 8, color: 'var(--danger)', fontSize: '0.86rem' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--s50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <LogOut size={15} /> {t('logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
