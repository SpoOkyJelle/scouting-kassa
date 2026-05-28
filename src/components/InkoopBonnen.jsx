import { useState, useEffect } from 'react'
import { PlusCircle, Trash2, Pencil, Check, X, ShoppingCart, TrendingDown } from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchInkoop, createInkoop, updateInkoop, deleteInkoop } from '../api'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

function today() {
  return new Date().toISOString().slice(0, 10)
}

function SectionHead({ Icon, label, color = 'var(--muted)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: '0.65rem' }}>
      <Icon size={13} color={color} strokeWidth={2.3} />
      <span style={{ fontSize: '0.69rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        {label}
      </span>
    </div>
  )
}

const EMPTY_FORM = { description: '', amount: '', date: today(), note: '' }

export default function InkoopBonnen() {
  const { t } = useLang()
  const { showToast } = useToast()
  const confirm       = useConfirm()

  const [bonnen, setBonnen]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [editId, setEditId]     = useState(null)

  async function load() {
    setLoading(true)
    try { setBonnen(await fetchInkoop()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openNew() { setEditId(null); setForm(EMPTY_FORM); setShowForm(true) }

  function openEdit(bon) {
    setEditId(bon.id)
    setForm({
      description: bon.description,
      amount:      String(bon.amount),
      date:        bon.date || bon.created_at?.slice(0, 10) || today(),
      note:        bon.note || '',
    })
    setShowForm(true)
  }

  function cancelForm() { setShowForm(false); setEditId(null); setForm(EMPTY_FORM) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    try {
      const payload = {
        description: form.description.trim(),
        amount:      parseFloat(form.amount),
        date:        form.date || today(),
        note:        form.note.trim() || null,
      }
      if (editId) {
        const updated = await updateInkoop(editId, payload)
        setBonnen(prev => prev.map(b => b.id === editId ? updated : b))
      } else {
        const created = await createInkoop(payload)
        setBonnen(prev => [created, ...prev])
      }
      showToast(t('toast_saved'))
      cancelForm()
    } catch {
      showToast('Fout bij opslaan', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(bon) {
    const ok = await confirm(t('confirm_delete'))
    if (!ok) return
    await deleteInkoop(bon.id)
    setBonnen(prev => prev.filter(b => b.id !== bon.id))
    showToast(t('toast_deleted'))
  }

  const totalKosten = bonnen.reduce((s, b) => s + (b.amount || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 60%, #991b1b 100%)',
        borderRadius: 14, padding: '1.1rem 1.25rem', color: '#fff',
        position: 'relative', overflow: 'hidden',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
            {t('inkoop_total_label')}
          </div>
          <div style={{ fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            {fmt(totalKosten)}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#fca5a5', marginTop: 2, fontWeight: 600 }}>
            {bonnen.length} {bonnen.length === 1 ? 'bonnetje' : 'bonnetjes'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, position: 'relative' }}>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 9, padding: '8px 9px' }}>
            <TrendingDown size={18} color="rgba(255,255,255,0.8)" />
          </div>
          <button
            className="btn btn-sm"
            onClick={openNew}
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', gap: 5 }}
          >
            <PlusCircle size={13} /> {t('inkoop_add')}
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
          {/* Form header */}
          <div style={{
            background: 'var(--s50)', borderBottom: '1px solid var(--border)',
            padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--s800)' }}>
              {editId ? t('inkoop_edit') : t('inkoop_new')}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={cancelForm} style={{ padding: '4px 6px' }}>
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: '2 1 180px', marginBottom: 0 }}>
                <label className="form-label">{t('inkoop_description')}</label>
                <input
                  className="form-input"
                  placeholder={t('inkoop_description_ph')}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  required autoFocus
                />
              </div>
              <div className="form-group" style={{ flex: '1 1 100px', marginBottom: 0 }}>
                <label className="form-label">{t('inkoop_amount')}</label>
                <input
                  className="form-input"
                  type="number" min="0" step="0.01" placeholder="0.00"
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
      ) : bonnen.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.5rem', color: 'var(--muted)',
        }}>
          <ShoppingCart size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
          <p style={{ fontSize: '0.86rem' }}>{t('inkoop_empty')}</p>
        </div>
      ) : (
        <div>
          <SectionHead Icon={ShoppingCart} label={t('inkoop_title')} color="#DC2626" />
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            {bonnen.map((bon, idx) => (
              <div
                key={bon.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '0.75rem 1rem',
                  borderTop: idx > 0 ? '1px solid var(--s100)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--s50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Color dot */}
                <div style={{
                  width: 3, alignSelf: 'stretch',
                  background: '#DC2626', borderRadius: 2, flexShrink: 0,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--s800)', marginBottom: 1 }}>
                    {bon.description}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    {bon.date}
                    {bon.note && <> · <em>{bon.note}</em></>}
                  </div>
                </div>

                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#DC2626', flexShrink: 0 }}>
                  {fmt(bon.amount)}
                </div>

                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 6px' }}
                    onClick={() => openEdit(bon)}
                    title={t('edit')}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 6px', color: '#DC2626' }}
                    onClick={() => handleDelete(bon)}
                    title={t('delete')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
