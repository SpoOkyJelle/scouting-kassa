import { useState, useEffect } from 'react'
import { PlusCircle, Trash2, Pencil, Check, X, Heart, TrendingUp } from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchDonaties, createDonatie, updateDonatie, deleteDonatie } from '../api'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

function today() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FORM = { name: '', amount: '', date: today(), note: '' }

export default function Donaties() {
  const { t } = useLang()
  const { showToast } = useToast()
  const confirm       = useConfirm()

  const [donaties, setDonaties] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [editId, setEditId]     = useState(null)

  async function load() {
    setLoading(true)
    try { setDonaties(await fetchDonaties()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openNew() { setEditId(null); setForm(EMPTY_FORM); setShowForm(true) }

  function openEdit(d) {
    setEditId(d.id)
    setForm({
      name:   d.name || '',
      amount: String(d.amount),
      date:   d.date || d.created_at?.slice(0, 10) || today(),
      note:   d.note || '',
    })
    setShowForm(true)
  }

  function cancelForm() { setShowForm(false); setEditId(null); setForm(EMPTY_FORM) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.amount) return
    setSaving(true)
    try {
      const payload = {
        name:   form.name.trim() || null,
        amount: parseFloat(form.amount),
        date:   form.date || today(),
        note:   form.note.trim() || null,
      }
      if (editId) {
        const updated = await updateDonatie(editId, payload)
        setDonaties(prev => prev.map(d => d.id === editId ? updated : d))
      } else {
        const created = await createDonatie(payload)
        setDonaties(prev => [created, ...prev])
      }
      showToast(t('toast_saved'))
      cancelForm()
    } catch {
      showToast('Fout bij opslaan', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(d) {
    const ok = await confirm(t('confirm_delete'))
    if (!ok) return
    await deleteDonatie(d.id)
    setDonaties(prev => prev.filter(x => x.id !== d.id))
    showToast(t('toast_deleted'))
  }

  const totaal = donaties.reduce((s, d) => s + (d.amount || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #052e16 0%, #14532d 60%, #166534 100%)',
        borderRadius: 14, padding: '1.1rem 1.25rem', color: '#fff',
        position: 'relative', overflow: 'hidden',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
            {t('donaties_total')}
          </div>
          <div style={{ fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            {fmt(totaal)}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#86efac', marginTop: 2, fontWeight: 600 }}>
            {donaties.length} {donaties.length === 1 ? 'donatie' : 'donaties'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, position: 'relative' }}>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 9, padding: '8px 9px' }}>
            <TrendingUp size={18} color="rgba(255,255,255,0.8)" />
          </div>
          <button
            className="btn btn-sm"
            onClick={openNew}
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', gap: 5 }}
          >
            <PlusCircle size={13} /> {t('donaties_add')}
          </button>
        </div>
      </div>

      {/* ── Formulier ───────────────────────────────────────────────────── */}
      {showForm && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{
            background: 'var(--s50)', borderBottom: '1px solid var(--border)',
            padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--s800)' }}>
              {editId ? t('donaties_edit') : t('donaties_new')}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={cancelForm} style={{ padding: '4px 6px' }}>
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: '2 1 180px', marginBottom: 0 }}>
                <label className="form-label">{t('donaties_name')}</label>
                <input
                  className="form-input"
                  placeholder={t('donaties_name_ph')}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ flex: '1 1 100px', marginBottom: 0 }}>
                <label className="form-label">{t('donaties_amount')}</label>
                <input
                  className="form-input"
                  type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: '1 1 130px', marginBottom: 0 }}>
                <label className="form-label">{t('inkoop_date')}</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ flex: '2 1 180px', marginBottom: 0 }}>
                <label className="form-label">{t('note')} ({t('inkoop_optional')})</label>
                <input
                  className="form-input"
                  placeholder={t('inkoop_note_ph')}
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancelForm}>
                <X size={13} /> {t('cancel')}
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving} style={{ gap: 5 }}>
                <Check size={13} /> {saving ? t('loading') : t('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Lijst ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="spinner" />
      ) : donaties.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.5rem', color: 'var(--muted)',
        }}>
          <Heart size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
          <p style={{ fontSize: '0.86rem' }}>{t('donaties_empty')}</p>
          <button className="btn btn-primary btn-sm" onClick={openNew} style={{ marginTop: 4, gap: 5 }}>
            <PlusCircle size={13} /> {t('donaties_add')}
          </button>
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          {donaties.map((d, idx) => (
            <div
              key={d.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '0.75rem 1rem',
                borderTop: idx > 0 ? '1px solid var(--s100)' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--s50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 3, alignSelf: 'stretch', background: '#16A34A', borderRadius: 2, flexShrink: 0 }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--s800)', marginBottom: 1 }}>
                  {d.name || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>{t('donaties_title')}</span>}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  {d.date}
                  {d.note && <> · <em>{d.note}</em></>}
                </div>
              </div>

              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#16A34A', flexShrink: 0 }}>
                {fmt(d.amount)}
              </div>

              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '4px 6px' }}
                  onClick={() => openEdit(d)}
                  title={t('edit')}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '4px 6px', color: '#DC2626' }}
                  onClick={() => handleDelete(d)}
                  title={t('delete')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
