import { useState, useEffect } from 'react'
import { Pencil, Trash2, Package, PlusCircle, GripVertical } from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchProducts, createProduct, updateProduct, deleteProduct, reorderProducts } from '../api'
import { CATEGORIES } from '../categories'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'

const fmt = p => `€ ${parseFloat(p).toFixed(2)}`

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
    <select
      className="form-input"
      style={{ flex: '0 0 148px' }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {CATEGORIES.map(c => (
        <option key={c.id} value={c.id}>{t(`cat_${c.id}`)}</option>
      ))}
    </select>
  )
}

export default function Producten() {
  const { t }      = useLang()
  const showToast  = useToast()
  const confirm    = useConfirm()

  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [editId, setEditId]       = useState(null)
  const [editName, setEditName]   = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCat, setEditCat]     = useState('overig')
  const [newName, setNewName]     = useState('')
  const [newPrice, setNewPrice]   = useState('')
  const [newCat, setNewCat]       = useState('pannenkoeken')
  const [adding, setAdding]       = useState(false)
  const [dragId, setDragId]       = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  function handleDragStart(e, id) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e, id) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }
  function handleDrop(e, targetId) {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const newProducts = [...products]
    const fromIdx = newProducts.findIndex(p => p.id === dragId)
    const toIdx   = newProducts.findIndex(p => p.id === targetId)
    const [moved] = newProducts.splice(fromIdx, 1)
    newProducts.splice(toIdx, 0, moved)
    setProducts(newProducts)
    setDragId(null)
    setDragOverId(null)
    reorderProducts(newProducts.map(p => p.id))
  }
  function handleDragEnd() { setDragId(null); setDragOverId(null) }

  useEffect(() => {
    fetchProducts().then(data => { setProducts(data); setLoading(false) })
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim() || newPrice === '') return
    setAdding(true)
    const p = await createProduct(newName.trim(), parseFloat(newPrice), newCat)
    setProducts(prev => [...prev, p])
    setNewName(''); setNewPrice('')
    setAdding(false)
    showToast(t('toast_saved'))
  }

  function startEdit(product) {
    setEditId(product.id)
    setEditName(product.name)
    setEditPrice(String(product.price))
    setEditCat(product.category || 'overig')
  }

  async function saveEdit(id) {
    if (!editName.trim() || editPrice === '') return
    const updated = await updateProduct(id, editName.trim(), parseFloat(editPrice), editCat)
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

  if (loading) return <div className="spinner" />

  const groups = CATEGORIES.map(cat => ({
    cat,
    items: products.filter(p => (p.category || 'overig') === cat.id),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Nieuw product ────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <SectionHead Icon={PlusCircle} label={t('add_product')} color="var(--primary)" />
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ flex: '1 1 160px' }}
            placeholder={t('product_name')}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
          />
          <input
            className="form-input"
            style={{ flex: '0 0 105px' }}
            placeholder={t('product_price')}
            type="number" step="0.01" min="0"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            required
          />
          <CatSelect value={newCat} onChange={setNewCat} t={t} />
          <button type="submit" className="btn btn-primary" disabled={adding} style={{ gap: 6 }}>
            <PlusCircle size={14} />
            {adding ? t('loading') : t('add_product')}
          </button>
        </form>
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
              <SectionHead
                Icon={Icon} label={t(`cat_${cat.id}`)} color={cat.color}
                right={
                  <span style={{
                    fontSize: '0.69rem', fontWeight: 600, color: 'var(--muted)',
                    background: 'var(--s100)', padding: '1px 7px', borderRadius: 10,
                  }}>{items.length}</span>
                }
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
                      <input
                        className="form-input"
                        style={{ flex: '1 1 160px' }}
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && saveEdit(product.id)}
                      />
                      <input
                        className="form-input"
                        style={{ flex: '0 0 105px' }}
                        type="number" step="0.01" min="0"
                        value={editPrice}
                        onChange={e => setEditPrice(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit(product.id)}
                      />
                      <CatSelect value={editCat} onChange={setEditCat} t={t} />
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(product.id)}>{t('save')}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>{t('cancel')}</button>
                    </div>
                  ) : (
                    <div key={product.id}
                      draggable={true}
                      onDragStart={e => handleDragStart(e, product.id)}
                      onDragOver={e => handleDragOver(e, product.id)}
                      onDrop={e => handleDrop(e, product.id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '9px 14px',
                        borderTop: idx > 0 ? '1px solid var(--s100)' : 'none',
                        gap: 10, transition: 'background 0.1s',
                        opacity: dragId === product.id ? 0.4 : 1,
                        borderTop: dragOverId === product.id && dragId !== product.id ? '2px solid var(--primary)' : (idx > 0 ? '1px solid var(--s100)' : 'none'),
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--s50)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span
                        style={{ color: 'var(--s300)', cursor: 'grab', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                        onDragStart={e => handleDragStart(e, product.id)}
                      >
                        <GripVertical size={14} />
                      </span>
                      <span style={{ width: 3, alignSelf: 'stretch', background: cat.color, borderRadius: 2, flexShrink: 0, marginRight: 4 }} />
                      <span style={{ flex: 1, fontWeight: 500, fontSize: '0.86rem', color: 'var(--s800)' }}>{product.name}</span>
                      <span style={{ fontWeight: 700, color: 'var(--primary)', minWidth: 68, textAlign: 'right', fontSize: '0.86rem' }}>{fmt(product.price)}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(product)} title={t('edit')} style={{ padding: '4px 7px' }}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-ghost-danger btn-sm" onClick={() => handleDelete(product.id)} title={t('delete')} style={{ padding: '4px 7px' }}>
                        <Trash2 size={13} />
                      </button>
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
