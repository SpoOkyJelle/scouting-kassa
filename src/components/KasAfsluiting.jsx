import { useState, useEffect } from 'react'
import { Wallet, Pencil, Check, Banknote, Trash2, Smartphone, Plus, X, AlertCircle } from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchKas, createKas, updateKas, deleteKas, addKasCorrectie, deleteKasCorrectie } from '../api'
import { useToast } from './Toast'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

const EMPTY_CORR = { type: 'contant', amount: '', description: '' }

function Row({ label, value, accent, large }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.45rem 0',
      borderBottom: '1px solid var(--s100)',
    }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{label}</span>
      <span style={{
        fontWeight: large ? 800 : 700,
        fontSize: large ? '1rem' : '0.88rem',
        color: accent || 'var(--s800)',
      }}>
        {value}
      </span>
    </div>
  )
}

export default function KasAfsluiting({ todayContant = 0, todayQr = 0 }) {
  const { t } = useLang()
  const showToast = useToast()

  const [record, setRecord]             = useState(null)
  const [loading, setLoading]           = useState(true)
  const [beginInput, setBeginInput]     = useState('')
  const [eindInput, setEindInput]       = useState('')
  const [editingBegin, setEditingBegin] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [showCorrForm, setShowCorrForm] = useState(false)
  const [corrForm, setCorrForm]         = useState(EMPTY_CORR)
  const [savingCorr, setSavingCorr]     = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    fetchKas().then(list => {
      const rec = list.find(k => k.datum === today) || null
      setRecord(rec)
      if (rec) {
        setBeginInput(String(rec.begin_bedrag ?? ''))
        setEindInput(rec.eind_bedrag !== null && rec.eind_bedrag !== undefined ? String(rec.eind_bedrag) : '')
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [today])

  async function saveBegin() {
    const bedrag = parseFloat(beginInput) || 0
    setSaving(true)
    const updated = record
      ? await updateKas(record.id, { begin_bedrag: bedrag })
      : await createKas({ datum: today, begin_bedrag: bedrag })
    setRecord(updated)
    setEditingBegin(false)
    setSaving(false)
    showToast(t('kas_saved'))
  }

  async function saveEind() {
    if (!record) return
    const bedrag = parseFloat(eindInput) || 0
    setSaving(true)
    const updated = await updateKas(record.id, { eind_bedrag: bedrag })
    setRecord(updated)
    setSaving(false)
    showToast(t('kas_saved'))
  }

  async function saveCorrectie() {
    if (!record || !corrForm.amount) return
    setSavingCorr(true)
    const corr = await addKasCorrectie(record.id, {
      type:        corrForm.type,
      amount:      parseFloat(corrForm.amount),
      description: corrForm.description.trim(),
    })
    setRecord(prev => ({ ...prev, correcties: [...(prev.correcties || []), corr] }))
    setCorrForm(EMPTY_CORR)
    setShowCorrForm(false)
    setSavingCorr(false)
    showToast(t('toast_saved'))
  }

  async function removeCorrectie(corrId) {
    if (!record) return
    await deleteKasCorrectie(record.id, corrId)
    setRecord(prev => ({ ...prev, correcties: (prev.correcties || []).filter(c => c.id !== corrId) }))
  }

  if (loading) return null

  const correcties      = record?.correcties || []
  const corrContant     = correcties.filter(c => c.type === 'contant').reduce((s, c) => s + c.amount, 0)
  const corrQr          = correcties.filter(c => c.type === 'qr').reduce((s, c) => s + c.amount, 0)

  const beginBedrag     = record?.begin_bedrag ?? null
  const eindBedrag      = record?.eind_bedrag ?? null
  const verwacht        = beginBedrag !== null ? beginBedrag + todayContant + corrContant : null
  const verwachtQr      = todayQr + corrQr
  const verschil        = eindBedrag !== null && verwacht !== null ? eindBedrag - verwacht : null

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '1rem 1.1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Wallet size={14} color="#2563EB" strokeWidth={2.3} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            {t('kas_title')}
          </span>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
          {new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
        </span>
      </div>

      {/* Beginbedrag */}
      {editingBegin || beginBedrag === null ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 5 }}>{t('kas_begin')}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>€</span>
            <input
              type="number"
              className="form-input"
              style={{ width: 110 }}
              value={beginInput}
              onChange={e => setBeginInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveBegin()}
              min="0" step="0.50"
              placeholder="0,00"
            />
            <button className="btn btn-sm btn-primary" onClick={saveBegin} disabled={saving}>
              <Check size={13} /> {t('save')}
            </button>
            {editingBegin && (
              <button className="btn btn-sm btn-ghost" onClick={() => setEditingBegin(false)}>{t('cancel')}</button>
            )}
          </div>
          {beginBedrag === null && (
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 5, fontStyle: 'italic' }}>
              {t('kas_no_record')}
            </p>
          )}
        </div>
      ) : (
        <>
          <Row
            label={t('kas_begin')}
            value={
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {fmt(beginBedrag)}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setBeginInput(String(beginBedrag)); setEditingBegin(true) }}
                  style={{ padding: '2px 5px', color: 'var(--muted)' }}
                >
                  <Pencil size={11} />
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    await deleteKas(record.id)
                    setRecord(null)
                    setBeginInput('')
                    setEindInput('')
                  }}
                  style={{ padding: '2px 5px', color: 'var(--danger)' }}
                  title={t('delete')}
                >
                  <Trash2 size={11} />
                </button>
              </span>
            }
          />
          <Row
            label={<span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Banknote size={12} /> {t('kas_contant')}</span>}
            value={fmt(todayContant)}
            accent="#16A34A"
          />
          {todayQr > 0 && (
            <Row
              label={<span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Smartphone size={12} /> {t('payment_method_qr')}</span>}
              value={fmt(todayQr)}
              accent="#7C3AED"
            />
          )}

          {/* ── Correcties ────────────────────────────────────────────── */}
          {(correcties.length > 0 || showCorrForm) && (
            <div style={{ borderTop: '1px dashed var(--s200)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>
                {t('kas_correcties')}
              </div>
              {correcties.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '0.3rem 0', borderBottom: '1px solid var(--s100)',
                }}>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                    background: c.type === 'contant' ? '#FEF9C3' : '#F5F3FF',
                    color: c.type === 'contant' ? '#854D0E' : '#6D28D9',
                  }}>
                    {c.type === 'contant' ? <Banknote size={10} /> : <Smartphone size={10} />}
                  </span>
                  <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--s700)' }}>
                    {c.description || t('kas_correctie_no_desc')}
                  </span>
                  <span style={{
                    fontSize: '0.84rem', fontWeight: 700,
                    color: c.amount >= 0 ? '#16A34A' : '#DC2626',
                  }}>
                    {c.amount >= 0 ? '+' : ''}{fmt(c.amount)}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 4px', color: 'var(--s400)' }}
                    onClick={() => removeCorrectie(c.id)}
                    title={t('delete')}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Correctie formulier */}
          {showCorrForm ? (
            <div style={{
              marginTop: '0.5rem', padding: '0.65rem 0.75rem',
              background: 'var(--s50)', borderRadius: 8, border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {/* Type */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {['contant', 'qr'].map(type => (
                    <button
                      key={type}
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: corrForm.type === type ? 'var(--primary)' : 'var(--surface)',
                        color:      corrForm.type === type ? '#fff' : 'var(--s600)',
                        border:     `1px solid ${corrForm.type === type ? 'var(--primary)' : 'var(--border)'}`,
                        gap: 4, padding: '4px 8px',
                      }}
                      onClick={() => setCorrForm(f => ({ ...f, type }))}
                    >
                      {type === 'contant' ? <Banknote size={11} /> : <Smartphone size={11} />}
                      {type === 'contant' ? t('payment_method_contant') : t('payment_method_qr')}
                    </button>
                  ))}
                </div>
                {/* Bedrag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>€</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 90 }}
                    placeholder="-5.00"
                    step="0.01"
                    value={corrForm.amount}
                    onChange={e => setCorrForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                {/* Omschrijving */}
                <input
                  className="form-input"
                  style={{ flex: '1 1 140px' }}
                  placeholder={t('kas_correctie_desc_ph')}
                  value={corrForm.description}
                  onChange={e => setCorrForm(f => ({ ...f, description: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveCorrectie()}
                />
                <button className="btn btn-sm btn-primary" onClick={saveCorrectie} disabled={savingCorr || !corrForm.amount} style={{ gap: 4 }}>
                  <Check size={12} />
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => { setShowCorrForm(false); setCorrForm(EMPTY_CORR) }}>
                  <X size={12} />
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={11} /> {t('kas_correctie_hint')}
              </p>
            </div>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: '0.4rem', gap: 5, color: 'var(--s500)', fontSize: '0.78rem' }}
              onClick={() => setShowCorrForm(true)}
            >
              <Plus size={12} /> {t('kas_add_correctie')}
            </button>
          )}

          {/* Correctie-subtotalen als er iets is */}
          {corrContant !== 0 && (
            <Row
              label={t('kas_correctie_contant')}
              value={`${corrContant >= 0 ? '+' : ''}${fmt(corrContant)}`}
              accent={corrContant >= 0 ? '#16A34A' : '#DC2626'}
            />
          )}
          {corrQr !== 0 && (
            <Row
              label={t('kas_correctie_qr')}
              value={`${corrQr >= 0 ? '+' : ''}${fmt(corrQr)}`}
              accent={corrQr >= 0 ? '#7C3AED' : '#DC2626'}
            />
          )}

          <Row
            label={t('kas_verwacht')}
            value={verwacht !== null ? fmt(verwacht) : '—'}
            large
          />
          {(todayQr > 0 || corrQr !== 0) && (
            <Row
              label={t('kas_verwacht_qr')}
              value={fmt(verwachtQr)}
              accent="#7C3AED"
            />
          )}

          {/* Eindbedrag */}
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '2px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 6 }}>{t('kas_eind')}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>€</span>
              <input
                type="number"
                className="form-input"
                style={{ width: 110 }}
                value={eindInput}
                onChange={e => setEindInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveEind()}
                min="0" step="0.01"
                placeholder="0,00"
              />
              <button className="btn btn-sm btn-outline" onClick={saveEind} disabled={saving}>
                <Check size={13} /> {t('save')}
              </button>
            </div>
          </div>

          {/* Verschil */}
          {verschil !== null && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.65rem 0.9rem',
              borderRadius: 8,
              background: verschil === 0 ? '#F0FDF4' : Math.abs(verschil) < 0.5 ? '#FFFBEB' : '#FEF2F2',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: verschil === 0 ? '#166534' : '#92400E' }}>
                {verschil === 0 ? t('kas_klopt') : t('kas_verschil')}
              </span>
              {verschil !== 0 && (
                <span style={{
                  fontWeight: 800, fontSize: '0.95rem',
                  color: verschil > 0 ? '#16A34A' : '#DC2626',
                }}>
                  {verschil > 0 ? '+' : ''}{fmt(verschil)}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
