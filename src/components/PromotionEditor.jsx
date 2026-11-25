import { useState, useEffect } from 'react'
import { Percent, Plus, Trash2, Save, Gift } from 'lucide-react'
import { useLang } from '../LangContext'
import { useCategories } from '../CategoriesContext'
import { fetchProducts, updateSettings } from '../api'
import { useToast } from './Toast'
import SettingsCard from './SettingsCard'
import { PROMO_TYPES, newPromotionId } from '../promotions'

const clone = (list) =>
  (Array.isArray(list) ? list : []).map(p => ({
    id: p.id, name: p.name, enabled: p.enabled !== false, type: p.type,
    scope: p.scope ? { ...p.scope } : { kind: 'all', id: null },
    buyQty: p.buyQty, freeQty: p.freeQty, percent: p.percent,
    items: Array.isArray(p.items) ? p.items.map(c => ({ ...c })) : [],
    price: p.price,
  }))

function blankPromo() {
  return {
    id: newPromotionId(), name: '', enabled: true, type: 'nth_free',
    scope: { kind: 'all', id: null }, buyQty: 5, freeQty: 1, percent: 10,
    items: [], price: 0,
  }
}

// Scope picker: all / category / product.
function ScopeSelect({ scope, onChange, categories, products, t, allowAll = true }) {
  const kind = scope?.kind || 'all'
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <select className="form-input" style={{ flex: '0 0 120px' }} value={kind}
        onChange={e => onChange({ kind: e.target.value, id: null })}>
        {allowAll && <option value="all">{t('promo_scope_all')}</option>}
        <option value="category">{t('promo_scope_category')}</option>
        <option value="product">{t('promo_scope_product')}</option>
      </select>
      {kind === 'category' && (
        <select className="form-input" style={{ flex: '1 1 130px' }} value={scope.id ?? ''}
          onChange={e => onChange({ kind, id: e.target.value || null })}>
          <option value="">—</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      )}
      {kind === 'product' && (
        <select className="form-input" style={{ flex: '1 1 130px' }} value={scope.id ?? ''}
          onChange={e => onChange({ kind, id: e.target.value || null })}>
          <option value="">—</option>
          {products.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      )}
    </div>
  )
}

export default function PromotionEditor({ settings, onSave }) {
  const { t }          = useLang()
  const showToast      = useToast()
  const { categories } = useCategories()

  const [promos, setPromos]     = useState(() => clone(settings.promotions))
  const [products, setProducts] = useState([])
  const [saving, setSaving]     = useState(false)

  useEffect(() => { fetchProducts().then(setProducts).catch(() => {}) }, [])
  useEffect(() => { setPromos(clone(settings.promotions)) }, [settings.promotions])

  function patch(i, fields) {
    setPromos(prev => prev.map((p, idx) => idx === i ? { ...p, ...fields } : p))
  }
  const add    = () => setPromos(prev => [...prev, blankPromo()])
  const remove = (i) => setPromos(prev => prev.filter((_, idx) => idx !== i))

  // Combo component helpers
  function addComp(i) {
    patch(i, { items: [...(promos[i].items || []), { kind: 'product', id: null, qty: 1 }] })
  }
  function patchComp(i, ci, fields) {
    patch(i, { items: promos[i].items.map((c, idx) => idx === ci ? { ...c, ...fields } : c) })
  }
  function removeComp(i, ci) {
    patch(i, { items: promos[i].items.filter((_, idx) => idx !== ci) })
  }

  async function handleSave() {
    const cleaned = promos.map(p => ({ ...p, name: p.name.trim() }))
    if (cleaned.some(p => !p.name)) return showToast(t('promo_empty_name'), 'error')
    setSaving(true)
    try {
      const updated = await updateSettings({ promotions: cleaned })
      onSave(updated)
      showToast(t('toast_saved'))
    } catch {
      showToast(t('toast_no_access'), 'error')
    }
    setSaving(false)
  }

  return (
    <SettingsCard Icon={Percent} label={t('settings_promotions_section')} color="#D946EF">
      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
        {t('settings_promotions_hint')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {promos.length === 0 && (
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center', padding: '0.5rem 0' }}>
            {t('promo_none')}
          </div>
        )}

        {promos.map((p, i) => (
          <div key={p.id} style={{
            border: '1px solid var(--border)', borderRadius: 10,
            background: p.enabled ? 'var(--s50)' : 'var(--s100)',
            padding: '10px', opacity: p.enabled ? 1 : 0.7,
          }}>
            {/* Row 1: name + enable + delete */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                className="form-input"
                style={{ flex: '1 1 auto' }}
                placeholder={t('promo_name_ph')}
                value={p.name}
                onChange={e => patch(i, { name: e.target.value })}
              />
              <button
                type="button"
                className={`toggle-switch${p.enabled ? ' on' : ''}`}
                onClick={() => patch(i, { enabled: !p.enabled })}
                aria-label={t('promo_enabled')}
                title={t('promo_enabled')}
              >
                <span className="toggle-knob" />
              </button>
              <button type="button" className="btn btn-ghost-danger btn-sm" style={{ padding: '5px 7px' }}
                onClick={() => remove(i)} title={t('delete')}>
                <Trash2 size={14} />
              </button>
            </div>

            {/* Row 2: type */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <select className="form-input" style={{ flex: '0 0 170px' }}
                value={p.type} onChange={e => patch(i, { type: e.target.value })}>
                {PROMO_TYPES.map(ty => <option key={ty} value={ty}>{t(`promo_type_${ty}`)}</option>)}
              </select>
            </div>

            {/* Type-specific config */}
            {(p.type === 'nth_free' || p.type === 'percent') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ScopeSelect scope={p.scope} onChange={s => patch(i, { scope: s })}
                  categories={categories} products={products} t={t} />
                {p.type === 'nth_free' ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                    <span>{t('promo_buy_every')}</span>
                    <input className="form-input" style={{ flex: '0 0 70px' }} type="number" min="1"
                      value={p.buyQty} onChange={e => patch(i, { buyQty: e.target.value })} />
                    <span>{t('promo_buy_free')}</span>
                    <input className="form-input" style={{ flex: '0 0 70px' }} type="number" min="1"
                      value={p.freeQty} onChange={e => patch(i, { freeQty: e.target.value })} />
                    <span>{t('promo_buy_free_suffix')}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem' }}>
                    <input className="form-input" style={{ flex: '0 0 90px' }} type="number" min="0" max="100"
                      value={p.percent} onChange={e => patch(i, { percent: e.target.value })} />
                    <span>% {t('promo_percent_off')}</span>
                  </div>
                )}
              </div>
            )}

            {p.type === 'combo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(p.items || []).map((c, ci) => (
                  <div key={ci} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input className="form-input" style={{ flex: '0 0 56px' }} type="number" min="1"
                      value={c.qty ?? 1} onChange={e => patchComp(i, ci, { qty: e.target.value })} title={t('qty')} />
                    <span style={{ fontSize: '0.82rem' }}>×</span>
                    <ScopeSelect scope={{ kind: c.kind, id: c.id }} onChange={s => patchComp(i, ci, { kind: s.kind, id: s.id })}
                      categories={categories} products={products} t={t} allowAll={false} />
                    <button type="button" className="btn btn-ghost-danger btn-sm" style={{ padding: '4px 6px' }}
                      onClick={() => removeComp(i, ci)}><Trash2 size={12} /></button>
                  </div>
                ))}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => addComp(i)} style={{ gap: 5, alignSelf: 'flex-start' }}>
                  <Plus size={12} /> {t('promo_add_component')}
                </button>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem' }}>
                  <Gift size={13} color="#D946EF" />
                  <span>{t('promo_combo_price')}</span>
                  <input className="form-input" style={{ flex: '0 0 100px' }} type="number" step="0.01" min="0"
                    value={p.price} onChange={e => patch(i, { price: e.target.value })} />
                  <span>€</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: '0.85rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-outline" onClick={add} style={{ gap: 6, flex: '1 1 auto' }}>
          <Plus size={14} /> {t('promo_add')}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ gap: 6 }}>
          <Save size={14} /> {saving ? t('loading') : t('save')}
        </button>
      </div>
    </SettingsCard>
  )
}
