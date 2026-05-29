import { useState, useEffect } from 'react'
import { Wallet, Pencil, Check, Banknote, Trash2 } from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchKas, createKas, updateKas, deleteKas } from '../api'
import { useToast } from './Toast'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

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

export default function KasAfsluiting({ todayContant = 0 }) {
  const { t } = useLang()
  const showToast = useToast()

  const [record, setRecord]             = useState(null)
  const [loading, setLoading]           = useState(true)
  const [beginInput, setBeginInput]     = useState('')
  const [eindInput, setEindInput]       = useState('')
  const [editingBegin, setEditingBegin] = useState(false)
  const [saving, setSaving]             = useState(false)

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

  if (loading) return null

  const beginBedrag  = record?.begin_bedrag ?? null
  const eindBedrag   = record?.eind_bedrag ?? null
  const verwacht     = beginBedrag !== null ? beginBedrag + todayContant : null
  const verschil     = eindBedrag !== null && verwacht !== null ? eindBedrag - verwacht : null

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
              autoFocus
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
          <Row
            label={t('kas_verwacht')}
            value={fmt(verwacht)}
            large
          />

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
