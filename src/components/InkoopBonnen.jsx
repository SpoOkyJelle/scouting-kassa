import { useState, useEffect } from 'react'
import { PlusCircle, Trash2, Pencil, Check, X, ShoppingCart } from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchInkoop, createInkoop, updateInkoop, deleteInkoop } from '../api'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

function today() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FORM = { description: '', amount: '', date: today(), note: '' }

export default function InkoopBonnen() {
  const { t } = useLang()
  const { showToast } = useToast()
  const { confirm } = useConfirm()

  const [bonnen, setBonnen]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [editId, setEditId]       = useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await fetchInkoop()
      setBonnen(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

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

  function cancelForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
  }

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
    <div>
      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--s900)', margin: 0 }}>
            {t('inkoop_title')}
          </h2>
          {bonnen.length > 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>
              {t('inkoop_total_label')}: <strong style={{ color: '#DC2626' }}>{fmt(totalKosten)}</strong>
            </p>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew} style={{ gap: 6 }}>
          <PlusCircle size={14} /> {t('inkoop_add')}
        </button>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      {showForm && (
        <form className="page-surface" onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
          <p className="section-title" style={{ marginBottom: '0.75rem' }}>
            {editId ? t('inkoop_edit') : t('inkoop_new')}
          </p>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '2 1 180px', marginBottom: 0 }}>
              <label className="form-label">{t('inkoop_description')}</label>
              <input
                className="form-input"
                placeholder={t('inkoop_description_ph')}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ flex: '1 1 100px', marginBottom: 0 }}>
              <label className="form-label">{t('inkoop_amount')}</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
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

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={cancelForm}>
              <X size={13} /> {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving} style={{ gap: 6 }}>
              <Check size={13} /> {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      )}

      {/* ── List ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="spinner" />
      ) : bonnen.length === 0 ? (
        <div
          className="empty-state"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}
        >
          <ShoppingCart size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
          <p>{t('inkoop_empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {bonnen.map(bon => (
            <div
              key={bon.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--s800)', marginBottom: 2 }}>
                  {bon.description}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {bon.date}
                  {bon.note && <> · <em>{bon.note}</em></>}
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#DC2626', flexShrink: 0 }}>
                {fmt(bon.amount)}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
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
      )}
    </div>
  )
}
