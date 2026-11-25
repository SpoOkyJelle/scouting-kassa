import { useState, useEffect } from 'react'
import { Tags, Plus, Trash2, ChevronUp, ChevronDown, Save } from 'lucide-react'
import { useLang } from '../LangContext'
import { updateSettings } from '../api'
import { useToast } from './Toast'
import SettingsCard from './SettingsCard'
import {
  DEFAULT_CATEGORIES, ICON_NAMES, CATEGORY_COLORS, getIcon, newCategoryId,
} from '../categories'

const clone = (list) =>
  (Array.isArray(list) && list.length ? list : DEFAULT_CATEGORIES)
    .map(c => ({ id: c.id, label: c.label, icon: c.icon, color: c.color }))

export default function CategoryEditor({ settings, onSave }) {
  const { t }     = useLang()
  const showToast = useToast()

  const [cats, setCats]     = useState(() => clone(settings.categories))
  const [picker, setPicker] = useState(null)   // index whose icon grid is open
  const [saving, setSaving] = useState(false)

  // Re-sync when the stored categories change (first load, after save, restore).
  useEffect(() => { setCats(clone(settings.categories)) }, [settings.categories])

  function patch(i, field, value) {
    setCats(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }
  function move(i, dir) {
    const j = i + dir
    if (j < 0 || j >= cats.length) return
    setCats(prev => {
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function add() {
    setCats(prev => [
      ...prev,
      { id: newCategoryId(), label: '', icon: 'Tag', color: CATEGORY_COLORS[prev.length % CATEGORY_COLORS.length] },
    ])
  }
  function remove(i) {
    setCats(prev => prev.filter((_, idx) => idx !== i))
    setPicker(null)
  }

  async function handleSave() {
    const cleaned = cats.map(c => ({ ...c, label: c.label.trim() }))
    if (cleaned.some(c => !c.label)) {
      return showToast(t('settings_cat_empty'), 'error')
    }
    setSaving(true)
    try {
      const updated = await updateSettings({ categories: cleaned })
      onSave(updated)
      showToast(t('toast_saved'))
    } catch {
      showToast(t('toast_no_access'), 'error')
    }
    setSaving(false)
  }

  return (
    <SettingsCard Icon={Tags} label={t('settings_categories_section')} color="#2563EB">
      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
        {t('settings_categories_hint')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cats.map((c, i) => {
          const Icon = getIcon(c.icon)
          return (
            <div key={c.id} style={{
              border: '1px solid var(--border)', borderRadius: 10,
              background: 'var(--s50)', padding: '8px 10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Icon toggle */}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setPicker(picker === i ? null : i)}
                  title={t('settings_cat_icon')}
                  style={{ padding: '6px 8px', background: c.color + '18', borderColor: c.color + '55' }}
                >
                  <Icon size={16} color={c.color} strokeWidth={2.3} />
                </button>

                {/* Label */}
                <input
                  className="form-input"
                  style={{ flex: '1 1 130px', minWidth: 110 }}
                  placeholder={t('settings_cat_name')}
                  value={c.label}
                  onChange={e => patch(i, 'label', e.target.value)}
                />

                {/* Reorder + delete */}
                <div style={{ display: 'flex', gap: 2 }}>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px 6px' }}
                    onClick={() => move(i, -1)} disabled={i === 0} title={t('settings_cat_up')}>
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px 6px' }}
                    onClick={() => move(i, 1)} disabled={i === cats.length - 1} title={t('settings_cat_down')}>
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" className="btn btn-ghost-danger btn-sm" style={{ padding: '4px 6px' }}
                    onClick={() => remove(i)} disabled={cats.length <= 1} title={t('delete')}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Colour swatches */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {CATEGORY_COLORS.map(col => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => patch(i, 'color', col)}
                    title={col}
                    style={{
                      width: 20, height: 20, borderRadius: '50%', background: col, cursor: 'pointer',
                      border: c.color?.toLowerCase() === col.toLowerCase() ? '2px solid var(--s800)' : '2px solid transparent',
                      boxShadow: '0 0 0 1px var(--border)',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(c.color || '') ? c.color : '#8A8374'}
                  onChange={e => patch(i, 'color', e.target.value)}
                  title={t('settings_cat_color')}
                  style={{ width: 24, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                />
              </div>

              {/* Icon grid */}
              {picker === i && (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))',
                  gap: 4, marginTop: 8, maxHeight: 148, overflowY: 'auto',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 6,
                }}>
                  {ICON_NAMES.map(name => {
                    const OptIcon = getIcon(name)
                    const active = c.icon === name
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => { patch(i, 'icon', name); setPicker(null) }}
                        title={name}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 32, borderRadius: 6, cursor: 'pointer',
                          background: active ? c.color + '22' : 'transparent',
                          border: active ? `1px solid ${c.color}` : '1px solid transparent',
                        }}
                      >
                        <OptIcon size={16} color={active ? c.color : 'var(--s600)'} strokeWidth={2.2} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: '0.85rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-outline" onClick={add} style={{ gap: 6, flex: '1 1 auto' }}>
          <Plus size={14} /> {t('settings_cat_add')}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ gap: 6 }}>
          <Save size={14} /> {saving ? t('loading') : t('save')}
        </button>
      </div>
    </SettingsCard>
  )
}
