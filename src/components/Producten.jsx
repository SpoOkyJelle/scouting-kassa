import { useState, useEffect } from 'react'
import { Pencil, Trash2, Package, PlusCircle, GripVertical, EyeOff, Eye, FlaskConical, Plus, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useLang } from '../LangContext'
import {
  fetchProducts, createProduct, updateProduct, deleteProduct, reorderProducts, setProductAvailable,
  fetchIngredients, createIngredient, updateIngredient, deleteIngredient, updateProductRecipe,
} from '../api'
import { CATEGORIES } from '../categories'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'

const fmt = p => `€ ${parseFloat(p).toFixed(2)}`

const UNITS = ['stuks', 'plakjes', 'gram', 'kg', 'ml', 'liter', 'el', 'tl', 'snee', 'blad']

function margin(price, costPrice) {
  if (!costPrice || costPrice <= 0) return null
  return Math.round((1 - costPrice / price) * 100)
}

function SectionHead({ Icon, label, color = 'var(--muted)', right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: '0.6rem' }}>
      <Icon size={13} color={color} strokeWidth={2.3} />
      <span style={{ fontSize: '0.69rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', flex: 1 }}>
        {label}
      </span>
      {right}
    </div>
  )
}

function CatSelect({ value, onChange, t }) {
  return (
    <select className="form-input" style={{ flex: '0 0 148px' }} value={value} onChange={e => onChange(e.target.value)}>
      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{t(`cat_${c.id}`)}</option>)}
    </select>
  )
}

// ── Recept editor ─────────────────────────────────────────────────────────────
function RecipeEditor({ product, ingredients, onSave }) {
  const { t } = useLang()
  const [recipe, setRecipe]     = useState(product.recipe || [])
  const [addIngId, setAddIngId] = useState('')
  const [addQty, setAddQty]     = useState('')
  const [saving, setSaving]     = useState(false)

  async function save(newRecipe) {
    setSaving(true)
    await updateProductRecipe(product.id, newRecipe)
    onSave(product.id, newRecipe)
    setSaving(false)
  }

  async function addItem() {
    if (!addIngId || !addQty) return
    const already = recipe.find(r => r.ingredient_id === parseInt(addIngId))
    let newRecipe
    if (already) {
      newRecipe = recipe.map(r => r.ingredient_id === parseInt(addIngId)
        ? { ...r, quantity: parseFloat(addQty) } : r)
    } else {
      newRecipe = [...recipe, { ingredient_id: parseInt(addIngId), quantity: parseFloat(addQty) }]
    }
    setRecipe(newRecipe)
    await save(newRecipe)
    setAddIngId(''); setAddQty('')
  }

  async function removeItem(ingredientId) {
    const newRecipe = recipe.filter(r => r.ingredient_id !== ingredientId)
    setRecipe(newRecipe)
    await save(newRecipe)
  }

  async function updateQty(ingredientId, qty) {
    const newRecipe = recipe.map(r => r.ingredient_id === ingredientId ? { ...r, quantity: qty } : r)
    setRecipe(newRecipe)
    await save(newRecipe)
  }

  const available = ingredients.filter(ing => !recipe.find(r => r.ingredient_id === ing.id))

  return (
    <div style={{
      padding: '0.65rem 1rem 0.75rem 2.5rem',
      background: 'var(--s50)', borderTop: '1px solid var(--s100)',
    }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
        Recept — per portie {product.name}
      </div>

      {ingredients.length === 0 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', fontStyle: 'italic' }}>
          Voeg eerst ingrediënten toe in het ingrediënten-paneel hieronder.
        </p>
      )}

      {/* Huidige ingrediënten */}
      {recipe.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.5rem' }}>
          {recipe.map(item => {
            const ing = ingredients.find(i => i.id === item.ingredient_id)
            if (!ing) return null
            return (
              <div key={item.ingredient_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--s700)', fontWeight: 500 }}>{ing.name}</span>
                <input
                  type="number" min="0" step="0.01"
                  className="form-input"
                  style={{ width: 70, padding: '3px 6px', fontSize: '0.82rem' }}
                  value={item.quantity}
                  onChange={e => updateQty(item.ingredient_id, parseFloat(e.target.value) || 0)}
                  onBlur={() => save(recipe)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', minWidth: 40 }}>{ing.unit}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 5px', color: 'var(--danger)' }}
                  onClick={() => removeItem(item.ingredient_id)}
                >
                  <X size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Ingrediënt toevoegen */}
      {available.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            style={{ flex: '1 1 140px', padding: '4px 8px', fontSize: '0.82rem' }}
            value={addIngId}
            onChange={e => setAddIngId(e.target.value)}
          >
            <option value="">+ Ingrediënt…</option>
            {available.map(ing => (
              <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
            ))}
          </select>
          <input
            type="number" min="0" step="0.01"
            className="form-input"
            style={{ width: 70, padding: '4px 8px', fontSize: '0.82rem' }}
            placeholder="Aantal"
            value={addQty}
            onChange={e => setAddQty(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
          />
          <button
            className="btn btn-sm btn-outline"
            style={{ gap: 4 }}
            onClick={addItem}
            disabled={!addIngId || !addQty || saving}
          >
            <Plus size={12} /> Toevoegen
          </button>
        </div>
      )}

      {recipe.length === 0 && ingredients.length > 0 && available.length === 0 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--primary)', fontStyle: 'italic' }}>
          Alle ingrediënten zijn al in het recept opgenomen.
        </p>
      )}
    </div>
  )
}

// ── Ingrediënten beheer ───────────────────────────────────────────────────────
function IngredientenBeheer({ ingredients, setIngredients }) {
  const { t }     = useLang()
  const showToast = useToast()
  const confirm   = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ name: '', unit: 'stuks' })
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editId) {
        const updated = await updateIngredient(editId, form)
        setIngredients(prev => prev.map(i => i.id === editId ? updated : i))
      } else {
        const created = await createIngredient(form)
        setIngredients(prev => [...prev, created])
      }
      showToast(t('toast_saved'))
      setForm({ name: '', unit: 'stuks' }); setEditId(null); setShowForm(false)
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    const ok = await confirm(t('confirm_delete'))
    if (!ok) return
    await deleteIngredient(id)
    setIngredients(prev => prev.filter(i => i.id !== id))
    showToast(t('toast_deleted'))
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '0.5rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '0.65rem 1rem', background: 'var(--s50)',
        borderBottom: '1px solid var(--border)',
      }}>
        <FlaskConical size={14} color="#7C3AED" strokeWidth={2.3} />
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--s800)', flex: 1 }}>Ingrediënten</span>
        <button
          className="btn btn-sm btn-outline"
          style={{ gap: 4 }}
          onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', unit: 'stuks' }) }}
        >
          <Plus size={12} /> Toevoegen
        </button>
      </div>

      {/* Formulier */}
      {showForm && (
        <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--s50)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 150px' }}>
            <label className="form-label">Naam</label>
            <input className="form-input" placeholder="Bijv. Spek" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label className="form-label">Eenheid</label>
            <select className="form-input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              {!UNITS.includes(form.unit) && <option value={form.unit}>{form.unit}</option>}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.name.trim() || saving} style={{ gap: 4 }}>
              <Check size={12} /> {t('save')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setEditId(null) }}>{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* Lijst */}
      {ingredients.length === 0 && !showForm && (
        <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>
          Nog geen ingrediënten. Voeg ze toe om recepten te koppelen aan producten.
        </div>
      )}
      {ingredients.map((ing, idx) => (
        editId === ing.id ? (
          <div key={ing.id} style={{ display: 'flex', gap: 8, padding: '0.5rem 1rem', borderTop: idx > 0 ? '1px solid var(--s100)' : 'none', background: 'var(--s50)', flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="form-input" style={{ flex: '2 1 140px' }} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            <select className="form-input" style={{ flex: '1 1 110px' }} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              {!UNITS.includes(form.unit) && <option value={form.unit}>{form.unit}</option>}
            </select>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ gap: 4 }}><Check size={12} /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}><X size={12} /></button>
          </div>
        ) : (
          <div key={ing.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0.5rem 1rem',
            borderTop: idx > 0 ? '1px solid var(--s100)' : 'none',
          }}>
            <FlaskConical size={12} color="#7C3AED" />
            <span style={{ flex: 1, fontSize: '0.84rem', fontWeight: 500, color: 'var(--s800)' }}>{ing.name}</span>
            <span style={{
              fontSize: '0.72rem', fontWeight: 600, color: '#7C3AED',
              background: '#F5F3FF', padding: '2px 8px', borderRadius: 8,
            }}>{ing.unit}</span>
            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px' }}
              onClick={() => { setEditId(ing.id); setForm({ name: ing.name, unit: ing.unit }); setShowForm(false) }}>
              <Pencil size={11} />
            </button>
            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px', color: 'var(--danger)' }}
              onClick={() => handleDelete(ing.id)}>
              <Trash2 size={11} />
            </button>
          </div>
        )
      ))}
    </div>
  )
}

// ── Hoofd component ───────────────────────────────────────────────────────────
export default function Producten() {
  const { t }      = useLang()
  const showToast  = useToast()
  const confirm    = useConfirm()

  const [products, setProducts]         = useState([])
  const [ingredients, setIngredients]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [editId, setEditId]             = useState(null)
  const [editName, setEditName]         = useState('')
  const [editPrice, setEditPrice]       = useState('')
  const [editCostPrice, setEditCostPrice] = useState('')
  const [editCat, setEditCat]           = useState('overig')
  const [newName, setNewName]           = useState('')
  const [newPrice, setNewPrice]         = useState('')
  const [newCostPrice, setNewCostPrice] = useState('')
  const [newCat, setNewCat]             = useState('pannenkoeken')
  const [adding, setAdding]             = useState(false)
  const [dragId, setDragId]             = useState(null)
  const [dragOverId, setDragOverId]     = useState(null)
  const [recipeOpenId, setRecipeOpenId] = useState(null)
  const [showIngredients, setShowIngredients] = useState(false)

  function handleDragStart(e, id) { setDragId(id); e.dataTransfer.effectAllowed = 'move' }
  function handleDragOver(e, id)  { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(id) }
  function handleDrop(e, targetId) {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const newProducts = [...products]
    const fromIdx = newProducts.findIndex(p => p.id === dragId)
    const toIdx   = newProducts.findIndex(p => p.id === targetId)
    const [moved] = newProducts.splice(fromIdx, 1)
    newProducts.splice(toIdx, 0, moved)
    setProducts(newProducts)
    setDragId(null); setDragOverId(null)
    reorderProducts(newProducts.map(p => p.id))
  }
  function handleDragEnd() { setDragId(null); setDragOverId(null) }

  useEffect(() => {
    Promise.all([fetchProducts(), fetchIngredients().catch(() => [])]).then(([prods, ings]) => {
      setProducts(prods); setIngredients(ings); setLoading(false)
    })
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim() || newPrice === '') return
    setAdding(true)
    const costPrice = newCostPrice !== '' ? parseFloat(newCostPrice) : null
    const p = await createProduct(newName.trim(), parseFloat(newPrice), newCat, costPrice)
    setProducts(prev => [...prev, p])
    setNewName(''); setNewPrice(''); setNewCostPrice('')
    setAdding(false)
    showToast(t('toast_saved'))
  }

  function startEdit(product) {
    setEditId(product.id)
    setEditName(product.name)
    setEditPrice(String(product.price))
    setEditCostPrice(product.cost_price != null ? String(product.cost_price) : '')
    setEditCat(product.category || 'overig')
  }

  async function saveEdit(id) {
    if (!editName.trim() || editPrice === '') return
    const costPrice = editCostPrice !== '' ? parseFloat(editCostPrice) : null
    const updated = await updateProduct(id, editName.trim(), parseFloat(editPrice), editCat, costPrice)
    setProducts(prev => prev.map(p => p.id === id ? updated : p))
    setEditId(null)
    showToast(t('toast_saved'))
  }

  async function handleDelete(id) {
    const ok = await confirm(t('confirm_delete'))
    if (!ok) return
    await deleteProduct(id)
    setProducts(prev => prev.filter(p => p.id !== id))
    showToast(t('toast_deleted'), 'info')
  }

  async function toggleAvailable(product) {
    const updated = await setProductAvailable(product.id, !product.available)
    setProducts(prev => prev.map(p => p.id === product.id ? updated : p))
    showToast(updated.available ? t('product_available_back') : t('product_unavailable'))
  }

  function onRecipeSaved(productId, recipe) {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, recipe } : p))
  }

  if (loading) return <div className="spinner" />

  const groups = CATEGORIES.map(cat => ({
    cat,
    items: products.filter(p => (p.category || 'overig') === cat.id),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Ingrediënten beheer toggle ───────────────────────────────────── */}
      <div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ gap: 6, color: '#7C3AED', marginBottom: '0.4rem' }}
          onClick={() => setShowIngredients(v => !v)}
        >
          <FlaskConical size={13} />
          Ingrediënten beheren
          {showIngredients ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {showIngredients && (
          <IngredientenBeheer ingredients={ingredients} setIngredients={setIngredients} />
        )}
      </div>

      {/* ── Nieuw product ────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <SectionHead Icon={PlusCircle} label={t('add_product')} color="var(--primary)" />
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" style={{ flex: '1 1 160px' }} placeholder={t('product_name')} value={newName} onChange={e => setNewName(e.target.value)} required />
          <input className="form-input" style={{ flex: '0 0 100px' }} placeholder={t('product_price')} type="number" step="0.01" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value)} required />
          <input className="form-input" style={{ flex: '0 0 100px' }} placeholder={t('product_cost_price')} type="number" step="0.01" min="0" value={newCostPrice} onChange={e => setNewCostPrice(e.target.value)} title={t('product_cost_price')} />
          <CatSelect value={newCat} onChange={setNewCat} t={t} />
          <button type="submit" className="btn btn-primary" disabled={adding} style={{ gap: 6 }}>
            <PlusCircle size={14} />
            {adding ? t('loading') : t('add_product')}
          </button>
        </form>
        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 6 }}>
          {t('product_cost_price')} — {t('product_margin').toLowerCase()} wordt automatisch berekend
        </p>
      </div>

      {/* ── Product groepen ──────────────────────────────────────────────── */}
      {products.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.5rem', color: 'var(--muted)',
        }}>
          <Package size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
          <p style={{ fontSize: '0.86rem' }}>{t('no_products')}</p>
        </div>
      ) : (
        groups.map(({ cat, items }) => {
          const { Icon } = cat
          return (
            <div key={cat.id}>
              <SectionHead Icon={Icon} label={t(`cat_${cat.id}`)} color={cat.color}
                right={<span style={{ fontSize: '0.69rem', fontWeight: 600, color: 'var(--muted)', background: 'var(--s100)', padding: '1px 7px', borderRadius: 10 }}>{items.length}</span>}
              />
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                {items.map((product, idx) =>
                  editId === product.id ? (
                    <div key={product.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                      borderTop: idx > 0 ? '1px solid var(--s100)' : 'none',
                      background: 'var(--s50)', flexWrap: 'wrap',
                    }}>
                      <input className="form-input" style={{ flex: '1 1 160px' }} value={editName} onChange={e => setEditName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && saveEdit(product.id)} />
                      <input className="form-input" style={{ flex: '0 0 100px' }} type="number" step="0.01" min="0" placeholder={t('product_price')} value={editPrice} onChange={e => setEditPrice(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(product.id)} />
                      <input className="form-input" style={{ flex: '0 0 100px' }} type="number" step="0.01" min="0" placeholder={t('product_cost_price')} value={editCostPrice} onChange={e => setEditCostPrice(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(product.id)} />
                      <CatSelect value={editCat} onChange={setEditCat} t={t} />
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(product.id)}>{t('save')}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>{t('cancel')}</button>
                    </div>
                  ) : (
                    <div key={product.id}>
                      {/* Product rij */}
                      <div
                        draggable={product.available !== false}
                        onDragStart={e => handleDragStart(e, product.id)}
                        onDragOver={e => handleDragOver(e, product.id)}
                        onDrop={e => handleDrop(e, product.id)}
                        onDragEnd={handleDragEnd}
                        style={{
                          display: 'flex', alignItems: 'center', padding: '9px 14px',
                          gap: 10, transition: 'background 0.1s',
                          opacity: product.available === false ? 0.5 : (dragId === product.id ? 0.4 : 1),
                          borderTop: dragOverId === product.id && dragId !== product.id
                            ? '2px solid var(--primary)'
                            : (idx > 0 ? '1px solid var(--s100)' : 'none'),
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--s50)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: 'var(--s300)', cursor: 'grab', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          <GripVertical size={14} />
                        </span>
                        <span style={{ width: 3, alignSelf: 'stretch', background: cat.color, borderRadius: 2, flexShrink: 0, marginRight: 4 }} />

                        <span style={{ flex: 1, fontWeight: 500, fontSize: '0.86rem', color: product.available === false ? 'var(--muted)' : 'var(--s800)' }}>
                          {product.name}
                          {product.available === false && (
                            <span style={{ marginLeft: 7, fontSize: '0.65rem', fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              {t('product_unavailable')}
                            </span>
                          )}
                        </span>

                        {/* Marge badge */}
                        {(() => {
                          const m = margin(product.price, product.cost_price)
                          if (m === null) return null
                          const color = m >= 50 ? '#16A34A' : m >= 25 ? '#D97706' : '#DC2626'
                          const bg    = m >= 50 ? '#F0FDF4' : m >= 25 ? '#FFFBEB' : '#FEF2F2'
                          return <span style={{ fontSize: '0.72rem', fontWeight: 700, color, background: bg, padding: '2px 7px', borderRadius: 8, flexShrink: 0 }}>{m}%</span>
                        })()}

                        {/* Recept-badge (als er al ingrediënten zijn) */}
                        {(product.recipe?.length > 0) && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>
                            {product.recipe.length} ing.
                          </span>
                        )}

                        <span style={{ fontWeight: 700, color: 'var(--primary)', minWidth: 60, textAlign: 'right', fontSize: '0.86rem' }}>
                          {fmt(product.price)}
                        </span>
                        {product.cost_price != null && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', minWidth: 52, textAlign: 'right' }}>
                            {fmt(product.cost_price)}
                          </span>
                        )}

                        {/* Recept knop */}
                        {ingredients.length > 0 && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setRecipeOpenId(recipeOpenId === product.id ? null : product.id)}
                            title="Recept bewerken"
                            style={{ padding: '4px 7px', color: recipeOpenId === product.id ? '#7C3AED' : 'var(--s400)' }}
                          >
                            <FlaskConical size={13} />
                          </button>
                        )}

                        <button className="btn btn-ghost btn-sm" onClick={() => toggleAvailable(product)} title={product.available === false ? t('product_available_back') : t('product_unavailable')} style={{ padding: '4px 7px', color: product.available === false ? '#D97706' : 'var(--s400)' }}>
                          {product.available === false ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(product)} title={t('edit')} style={{ padding: '4px 7px' }}>
                          <Pencil size={13} />
                        </button>
                        <button className="btn btn-ghost-danger btn-sm" onClick={() => handleDelete(product.id)} title={t('delete')} style={{ padding: '4px 7px' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Recept editor (expandable) */}
                      {recipeOpenId === product.id && (
                        <RecipeEditor product={product} ingredients={ingredients} onSave={onRecipeSaved} />
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
