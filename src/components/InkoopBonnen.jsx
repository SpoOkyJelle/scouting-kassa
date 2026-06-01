import { useState, useEffect } from 'react'
import { PlusCircle, Trash2, Pencil, Check, X, ShoppingCart, TrendingDown, TrendingUp, User, Trophy, FlaskConical } from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchInkoop, createInkoop, updateInkoop, deleteInkoop, fetchStats, fetchProducts, fetchIngredients } from '../api'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

const PALETTE = ['#16A34A','#22C55E','#0EA5E9','#F59E0B','#8B5CF6','#EC4899','#10B981','#F97316']

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

const EMPTY_FORM = { description: '', amount: '', date: today(), note: '', submitted_by: '' }

export default function InkoopBonnen() {
  const { t } = useLang()
  const { showToast } = useToast()
  const confirm       = useConfirm()

  const [bonnen, setBonnen]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [editId, setEditId]         = useState(null)
  const [topProducts, setTopProducts]   = useState([])
  const [products, setProducts]         = useState([])
  const [ingredients, setIngredients]   = useState([])
  const [showTrends, setShowTrends]     = useState(false)
  const [trendsTab, setTrendsTab]       = useState('verkoop') // 'verkoop' | 'grondstoffen'

  async function load() {
    setLoading(true)
    try {
      const [list, stats, prods, ings] = await Promise.all([
        fetchInkoop(),
        fetchStats().catch(() => null),
        fetchProducts().catch(() => []),
        fetchIngredients().catch(() => []),
      ])
      setBonnen(list)
      setTopProducts(stats?.topProducts ?? [])
      setProducts(prods)
      setIngredients(ings)
    } finally {
      setLoading(false)
    }
  }

  // Bereken grondstofverbruik op basis van verkopen × recepten
  function calcIngredientUsage() {
    const usage = {} // ingredient_id → { ing, total }
    topProducts.forEach(sold => {
      const prod = products.find(p => p.name === sold.name)
      if (!prod?.recipe?.length) return
      prod.recipe.forEach(({ ingredient_id, quantity }) => {
        const ing = ingredients.find(i => i.id === ingredient_id)
        if (!ing) return
        if (!usage[ingredient_id]) usage[ingredient_id] = { ing, total: 0, sources: [] }
        usage[ingredient_id].total += sold.quantity * quantity
        usage[ingredient_id].sources.push({ name: sold.name, qty: sold.quantity, perUnit: quantity })
      })
    })
    return Object.values(usage).sort((a, b) => b.total - a.total)
  }

  useEffect(() => { load() }, [])

  function openNew() { setEditId(null); setForm(EMPTY_FORM); setShowForm(true) }

  function openEdit(bon) {
    setEditId(bon.id)
    setForm({
      description:  bon.description,
      amount:       String(bon.amount),
      date:         bon.date || bon.created_at?.slice(0, 10) || today(),
      note:         bon.note || '',
      submitted_by: bon.submitted_by || '',
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
        description:  form.description.trim(),
        amount:       parseFloat(form.amount),
        date:         form.date || today(),
        note:         form.note.trim() || null,
        submitted_by: form.submitted_by.trim() || null,
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
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-sm"
              onClick={() => { setShowTrends(v => !v); setTrendsTab('verkoop') }}
              style={{ background: showTrends ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', gap: 5 }}
            >
              <TrendingUp size={13} /> {t('inkoop_trends')}
            </button>
            <button
              className="btn btn-sm"
              onClick={() => { setShowTrends(true); setTrendsTab('grondstoffen') }}
              style={{ background: showTrends && trendsTab === 'grondstoffen' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', gap: 5 }}
            >
              <FlaskConical size={13} /> Grondstoffen
            </button>
            <button
              className="btn btn-sm"
              onClick={openNew}
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', gap: 5 }}
            >
              <PlusCircle size={13} /> {t('inkoop_add')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Trends paneel ───────────────────────────────────────────────── */}
      {showTrends && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

          {/* Tab-balk */}
          <div style={{ background: 'var(--s50)', borderBottom: '1px solid var(--border)', padding: '0.5rem 0.85rem', display: 'flex', gap: 4, alignItems: 'center' }}>
            {[
              { key: 'verkoop',      Icon: Trophy,       label: t('inkoop_trends'),  color: '#F59E0B' },
              { key: 'grondstoffen', Icon: FlaskConical, label: 'Grondstoffen',       color: '#7C3AED' },
            ].map(({ key, Icon, label, color }) => (
              <button key={key} onClick={() => setTrendsTab(key)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: trendsTab === key ? color : 'transparent',
                color: trendsTab === key ? '#fff' : 'var(--muted)',
                fontWeight: 600, fontSize: '0.78rem', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}>
                <Icon size={12} /> {label}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('inkoop_trends_hint')}</span>
          </div>

          {/* ── Verkooptrends ── */}
          {trendsTab === 'verkoop' && (topProducts.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.84rem' }}>{t('stats_empty')}</div>
          ) : topProducts.map((p, i) => {
            const maxQty = topProducts[0].quantity
            const barW   = maxQty > 0 ? (p.quantity / maxQty) * 100 : 0
            const hasRecipe = products.find(pr => pr.name === p.name)?.recipe?.length > 0
            return (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 1rem', borderTop: i > 0 ? '1px solid var(--s100)' : 'none', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barW}%`, background: `${PALETTE[i % PALETTE.length]}12`, transition: 'width 0.5s ease' }} />
                <span style={{ width: 20, height: 20, borderRadius: 6, background: PALETTE[i % PALETTE.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#fff', flexShrink: 0, position: 'relative' }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: '0.84rem', fontWeight: 500, color: 'var(--s800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative' }}>{p.name}</span>
                {hasRecipe && <FlaskConical size={11} color="#7C3AED" style={{ flexShrink: 0, position: 'relative' }} />}
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', position: 'relative', flexShrink: 0 }}>{p.quantity}×</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: PALETTE[i % PALETTE.length], minWidth: 56, textAlign: 'right', position: 'relative', flexShrink: 0 }}>{fmt(p.revenue)}</span>
              </div>
            )
          }))}

          {/* ── Grondstoffen ── */}
          {trendsTab === 'grondstoffen' && (() => {
            const usage = calcIngredientUsage()
            const noRecipes = products.every(p => !p.recipe?.length)

            if (ingredients.length === 0) return (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.84rem' }}>
                <FlaskConical size={28} strokeWidth={1.2} style={{ color: 'var(--s300)', display: 'block', margin: '0 auto 0.5rem' }} />
                Geen ingrediënten ingesteld. Voeg ze toe via het <strong>Producten</strong>-tabblad.
              </div>
            )
            if (noRecipes) return (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.84rem' }}>
                <FlaskConical size={28} strokeWidth={1.2} style={{ color: 'var(--s300)', display: 'block', margin: '0 auto 0.5rem' }} />
                Nog geen recepten gekoppeld aan producten. Klik op 🧪 bij een product om een recept toe te voegen.
              </div>
            )
            if (usage.length === 0) return (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.84rem' }}>{t('stats_empty')}</div>
            )

            const maxTotal = usage[0].total
            return (
              <div>
                {/* Tabel-header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px', gap: 8, padding: '0.45rem 1rem', background: 'var(--s50)', borderBottom: '1px solid var(--s100)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <span>Ingrediënt</span>
                  <span style={{ textAlign: 'right' }}>Verbruikt</span>
                  <span style={{ textAlign: 'right' }}>Eenheid</span>
                </div>
                {usage.map(({ ing, total, sources }) => {
                  const barW = maxTotal > 0 ? (total / maxTotal) * 100 : 0
                  const rounded = Math.round(total * 100) / 100
                  return (
                    <details key={ing.id} style={{ borderTop: '1px solid var(--s100)' }}>
                      <summary style={{
                        display: 'grid', gridTemplateColumns: '1fr 90px 70px',
                        gap: 8, padding: '0.6rem 1rem',
                        cursor: 'pointer', listStyle: 'none',
                        position: 'relative', overflow: 'hidden',
                        alignItems: 'center',
                      }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barW}%`, background: 'rgba(124,58,237,0.07)', transition: 'width 0.5s ease' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--s800)', position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FlaskConical size={12} color="#7C3AED" />
                          {ing.name}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#7C3AED', textAlign: 'right', position: 'relative' }}>
                          {rounded}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'right', position: 'relative' }}>{ing.unit}</span>
                      </summary>
                      {/* Uitsplitsing per product */}
                      <div style={{ padding: '0.35rem 1rem 0.6rem 2.5rem', borderTop: '1px solid var(--s100)', background: 'var(--s50)' }}>
                        {sources.map(s => (
                          <div key={s.name} style={{ display: 'flex', fontSize: '0.78rem', color: 'var(--muted)', gap: 6, padding: '2px 0' }}>
                            <span style={{ flex: 1 }}>{s.name}</span>
                            <span>{s.qty}× × {s.perUnit} = <strong style={{ color: 'var(--s700)' }}>{Math.round(s.qty * s.perUnit * 100) / 100} {ing.unit}</strong></span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

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
              <div className="form-group" style={{ flex: '1 1 140px', marginBottom: 0 }}>
                <label className="form-label">{t('inkoop_submitted_by')}</label>
                <input
                  className="form-input"
                  placeholder={t('inkoop_submitted_by_ph')}
                  value={form.submitted_by}
                  onChange={e => setForm(f => ({ ...f, submitted_by: e.target.value }))}
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
                <div style={{
                  width: 3, alignSelf: 'stretch',
                  background: '#DC2626', borderRadius: 2, flexShrink: 0,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--s800)', marginBottom: 1 }}>
                    {bon.description}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span>{bon.date}</span>
                    {bon.submitted_by && (
                      <>
                        <span>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <User size={10} />
                          {bon.submitted_by}
                        </span>
                      </>
                    )}
                    {bon.note && <><span>·</span><em>{bon.note}</em></>}
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
