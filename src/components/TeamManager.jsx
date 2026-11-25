import { useState, useEffect } from 'react'
import { Users, UserPlus, Mail, Copy, Check, Trash2, Shield, X, Link2 } from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchTeam, inviteMember, revokeInvite, removeMember, changeMemberRole } from '../api'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'
import SettingsCard from './SettingsCard'

const roleLabel = (t, r) =>
  r === 'owner' ? t('role_owner') : r === 'admin' ? t('role_admin') : t('role_cashier')

export default function TeamManager() {
  const { t }     = useLang()
  const showToast = useToast()
  const confirm   = useConfirm()

  const [data, setData]       = useState(null)   // { members, invites, currentUserId, mailerConfigured }
  const [email, setEmail]     = useState('')
  const [role, setRole]       = useState('cashier')
  const [busy, setBusy]       = useState(false)
  const [copied, setCopied]   = useState(null)   // invite id just copied

  async function load() {
    try { setData(await fetchTeam()) }
    catch { showToast(t('toast_no_access'), 'error') }
  }
  useEffect(() => { load() }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim() || busy) return
    setBusy(true)
    try {
      const r = await inviteMember(email.trim(), role)
      setEmail('')
      showToast(r.emailed ? t('team_invited_emailed') : t('team_invited_link'))
      await load()
      if (!r.emailed && r.link) {
        try { await navigator.clipboard.writeText(r.link) } catch { /* ignore */ }
      }
    } catch (err) {
      showToast(err.message || t('toast_no_access'), 'error')
    }
    setBusy(false)
  }

  async function copyLink(inv) {
    try { await navigator.clipboard.writeText(inv.link) } catch {
      const el = document.createElement('textarea'); el.value = inv.link
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(inv.id); setTimeout(() => setCopied(null), 2000)
  }

  async function handleRevoke(inv) {
    if (!(await confirm(`${t('team_revoke_confirm')} (${inv.email})`))) return
    try { await revokeInvite(inv.id); await load(); showToast(t('team_revoked')) }
    catch { showToast(t('toast_no_access'), 'error') }
  }

  async function handleRemove(m) {
    if (!(await confirm(`${t('team_remove_confirm')} (${m.email})`))) return
    try { await removeMember(m.user_id); await load(); showToast(t('team_removed')) }
    catch (err) { showToast(err.message || t('toast_no_access'), 'error') }
  }

  async function handleRoleChange(m, newRole) {
    try { await changeMemberRole(m.user_id, newRole); await load() }
    catch (err) { showToast(err.message || t('toast_no_access'), 'error') }
  }

  return (
    <SettingsCard Icon={Users} label={t('team_section')} color="#3C7A86">
      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
        {t('team_hint')}
      </p>

      {/* Members */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
        {(data?.members || []).map(m => {
          const isOwner = m.role === 'owner'
          const isSelf  = m.user_id === data.currentUserId
          return (
            <div key={m.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              border: '1px solid var(--border)', borderRadius: 10, background: 'var(--s50)', padding: '8px 10px',
            }}>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--s900)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.name || m.email}{isSelf && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {t('team_you')}</span>}
                </div>
                {m.name && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{m.email}</div>}
              </div>
              {isOwner || isSelf ? (
                <span className={`role-badge ${m.role === 'cashier' ? 'role-cashier' : 'role-admin'}`}>{roleLabel(t, m.role)}</span>
              ) : (
                <select className="form-input" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.82rem' }}
                  value={m.role} onChange={e => handleRoleChange(m, e.target.value)}>
                  <option value="cashier">{t('role_cashier')}</option>
                  <option value="admin">{t('role_admin')}</option>
                </select>
              )}
              {!isOwner && !isSelf && (
                <button className="btn btn-ghost-danger btn-sm" style={{ padding: '4px 6px' }}
                  onClick={() => handleRemove(m)} title={t('delete')}><Trash2 size={14} /></button>
              )}
            </div>
          )
        })}
      </div>

      {/* Pending invites */}
      {(data?.invites || []).length > 0 && (
        <>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>
            {t('team_pending')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
            {data.invites.map(inv => (
              <div key={inv.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                border: '1px dashed var(--border)', borderRadius: 10, padding: '8px 10px',
              }}>
                <Mail size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                <div style={{ flex: '1 1 140px', minWidth: 0, fontSize: '0.88rem', color: 'var(--s800)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.email}</div>
                <span className={`role-badge ${inv.role === 'cashier' ? 'role-cashier' : 'role-admin'}`}>{roleLabel(t, inv.role)}</span>
                <button className="btn btn-outline btn-sm" style={{ gap: 5 }} onClick={() => copyLink(inv)}>
                  {copied === inv.id ? <><Check size={13} /> {t('payment_copied')}</> : <><Link2 size={13} /> {t('team_copy_link')}</>}
                </button>
                <button className="btn btn-ghost-danger btn-sm" style={{ padding: '4px 6px' }}
                  onClick={() => handleRevoke(inv)} title={t('team_revoke')}><X size={14} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Invite form */}
      <form onSubmit={handleInvite} style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
        <label className="form-label">{t('team_invite_label')}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="form-input" style={{ flex: '2 1 180px' }} type="email" placeholder={t('team_email_ph')}
            value={email} onChange={e => setEmail(e.target.value)} />
          <select className="form-input" style={{ flex: '1 1 110px', width: 'auto' }} value={role} onChange={e => setRole(e.target.value)}>
            <option value="cashier">{t('role_cashier')}</option>
            <option value="admin">{t('role_admin')}</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={busy || !email.trim()} style={{ gap: 6 }}>
            <UserPlus size={14} /> {t('team_invite_btn')}
          </button>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Shield size={12} />
          {data?.mailerConfigured ? t('team_mail_on') : t('team_mail_off')}
        </p>
      </form>
    </SettingsCard>
  )
}
