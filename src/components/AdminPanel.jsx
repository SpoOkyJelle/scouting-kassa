import { useState, useEffect } from 'react'
import { CheckCircle, Clock, XCircle, FileText, Users, RefreshCw, Shield } from 'lucide-react'

const STATUS_LABELS = {
  active:    { label: 'Actief',       bg: '#DCFCE7', color: '#166534', Icon: CheckCircle },
  trial:     { label: 'Trial',        bg: '#DBEAFE', color: '#1E40AF', Icon: Clock },
  expired:   { label: 'Verlopen',     bg: '#FEE2E2', color: '#991B1B', Icon: XCircle },
  cancelled: { label: 'Opgezegd',     bg: '#FEE2E2', color: '#991B1B', Icon: XCircle },
}

function Badge({ status }) {
  const cfg = STATUS_LABELS[status] || STATUS_LABELS.expired
  const { label, bg, color, Icon } = cfg
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color, borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
      <Icon size={10} strokeWidth={3} />{label}
    </span>
  )
}

export default function AdminPanel() {
  const [key, setKey]           = useState('')
  const [authed, setAuthed]     = useState(false)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [editing, setEditing]   = useState(null)

  async function load(adminKey) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/accounts', { headers: { 'x-admin-key': adminKey } })
      if (!res.ok) throw new Error('Ongeldige key of server-fout')
      setAccounts(await res.json())
      setAuthed(true)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function updateStatus(id, subscription_status) {
    const res = await fetch(`/api/admin/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({ subscription_status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setAccounts(acc => acc.map(a => a.id === id ? { ...a, ...updated } : a))
    }
    setEditing(null)
  }

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '2rem', width: '100%', maxWidth: 340, boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.5rem' }}>
          <Shield size={20} color="#16a34a" />
          <span style={{ fontWeight: 900, fontSize: '1.1rem' }}>Tickd Admin</span>
        </div>
        <input
          type="password"
          className="form-input"
          placeholder="Admin key"
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(key)}
          autoFocus
        />
        {error && <p style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: 8 }}>{error}</p>}
        <button
          className="btn btn-primary btn-full btn-lg"
          style={{ marginTop: 12, gap: 8 }}
          onClick={() => load(key)}
          disabled={!key || loading}
        >
          {loading ? 'Laden…' : 'Inloggen'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.5rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} color="#16a34a" />
            <span style={{ fontWeight: 900, fontSize: '1.3rem', color: '#0f172a' }}>Tickd Admin</span>
            <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
              {accounts.length} accounts
            </span>
          </div>
          <button onClick={() => load(key)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }}>
            <RefreshCw size={13} /> Vernieuwen
          </button>
        </div>

        {/* Tabel */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['ID', 'Organisatie', 'E-mail', 'Status', 'Trial verloopt', 'Gebruik', 'Acties'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', color: '#94a3b8', fontFamily: 'monospace' }}>{acc.id}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                    {acc.name}
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>{acc.slug}</div>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>{acc.email || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {editing === acc.id ? (
                      <select
                        defaultValue={acc.subscription_status}
                        onChange={e => updateStatus(acc.id, e.target.value)}
                        onBlur={() => setEditing(null)}
                        autoFocus
                        style={{ fontSize: '0.8rem', padding: '3px 6px', borderRadius: 6, border: '1px solid #e2e8f0' }}
                      >
                        {['active','trial','expired','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <Badge status={acc.subscription_status} />
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#475569', fontSize: '0.78rem' }}>
                    {acc.trial_ends_at
                      ? new Date(acc.trial_ends_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
                      : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 10, color: '#64748b', fontSize: '0.78rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={12} />{acc.usage?.receipts ?? 0}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} />{acc.usage?.employees ?? 0}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => setEditing(acc.id)}
                      style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#475569' }}
                    >
                      Bewerken
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
