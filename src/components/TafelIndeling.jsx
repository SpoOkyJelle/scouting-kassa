import { useState, useEffect } from 'react'
import {
  LayoutGrid, Plus, Pencil, Trash2, Check, X,
  RefreshCw, Settings2, Eye, ChevronUp, ChevronDown,
} from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchTafelindeling, saveTafelindeling, fetchReceipts } from '../api'
import { useToast } from './Toast'

const DEFAULT_LAYOUT = { cols: 6, rows: 4, tables: [] }

const STATUS = {
  free: { bg: 'var(--s100)', border: 'var(--s300)', labelColor: 'var(--s600)', subColor: 'var(--s400)' },
  open: { bg: '#FFF7ED',    border: '#F97316',     labelColor: '#9A3412',    subColor: '#C2410C'    },
  paid: { bg: '#F0FDF4',    border: '#4ADE80',     labelColor: '#166534',    subColor: '#16A34A'    },
}

function todayIso() { return new Date().toISOString().slice(0, 10) }

function getStatus(label, receipts) {
  const today = todayIso()
  const matches = receipts.filter(r =>
    r.name?.trim().toLowerCase() === label.trim().toLowerCase() &&
    r.created_at?.startsWith(today)
  )
  if (!matches.length) return { key: 'free', receipt: null, total: 0, count: 0 }
  const open = matches.filter(r => !r.paid)
  if (open.length) {
    const total = open.reduce((s, r) => s + (r.total || 0), 0)
    return { key: 'open', receipt: open[0], total, count: open.length }
  }
  return { key: 'paid', receipt: matches[matches.length - 1], total: 0, count: matches.length }
}

const fmt = n => `€ ${parseFloat(n).toFixed(2)}`

// Geeft alle cel-posities terug die bezet zijn door tafels (incl. breedte/hoogte)
function getOccupied(tables) {
  const set = new Set()
  tables.forEach(t => {
    const w = t.w || 1, h = t.h || 1
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        set.add(`${t.x + dx},${t.y + dy}`)
  })
  return set
}

// ── Tafel-cel ────────────────────────────────────────────────────────────────
function TableCell({ table, editMode, statusInfo, onClickTable, onEdit, onDelete }) {
  const [hover, setHover] = useState(false)
  const st     = statusInfo || { key: 'free', receipt: null, total: 0, count: 0 }
  const colors = STATUS[st.key]
  const w = table.w || 1
  const h = table.h || 1
  const isLarge = w > 1 || h > 1

  return (
    <div
      onClick={() => onClickTable(table, st)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        gridColumn: `${table.x + 1} / span ${w}`,
        gridRow:    `${table.y + 1} / span ${h}`,
        border: `2px solid ${hover && !editMode ? 'var(--primary)' : colors.border}`,
        borderRadius: 10,
        background: colors.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        padding: '6px 4px',
        position: 'relative',
        transition: 'all 0.15s',
        gap: 3,
        boxShadow: st.key === 'open' ? '0 0 0 3px rgba(249,115,22,0.18)' : 'none',
      }}
    >
      {/* Label */}
      <span style={{
        fontWeight: 800,
        fontSize: isLarge ? 'clamp(0.85rem, 2vw, 1.15rem)' : 'clamp(0.65rem, 1.5vw, 0.82rem)',
        color: colors.labelColor, textAlign: 'center', lineHeight: 1.2,
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        padding: '0 6px',
      }}>
        {table.label}
      </span>

      {st.key === 'free' && (
        <span style={{ fontSize: isLarge ? '0.72rem' : '0.62rem', color: colors.subColor, fontWeight: 500 }}>Vrij</span>
      )}
      {st.key === 'open' && (
        <span style={{ fontSize: isLarge ? '0.88rem' : 'clamp(0.6rem, 1.2vw, 0.72rem)', color: colors.subColor, fontWeight: 700, textAlign: 'center' }}>
          {fmt(st.total)}{st.count > 1 && ` · ${st.count}×`}
        </span>
      )}
      {st.key === 'paid' && <Check size={isLarge ? 20 : 14} color={colors.subColor} strokeWidth={2.5} />}

      {/* Grootte-label in edit mode */}
      {editMode && isLarge && (
        <span style={{ position: 'absolute', bottom: 3, right: 5, fontSize: '0.58rem', color: colors.subColor, opacity: 0.65 }}>
          {w}×{h}
        </span>
      )}

      {/* Edit/delete knoppen on hover in edit mode */}
      {editMode && (
        <div style={{ position: 'absolute', top: 3, right: 3, display: 'flex', gap: 2, opacity: hover ? 1 : 0, transition: 'opacity 0.1s' }}>
          <button onClick={e => { e.stopPropagation(); onEdit(table) }}
            style={{ background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: 5, padding: '2px 4px', cursor: 'pointer', display: 'flex' }}>
            <Pencil size={10} color="var(--s600)" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(table.id) }}
            style={{ background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: 5, padding: '2px 4px', cursor: 'pointer', display: 'flex' }}>
            <Trash2 size={10} color="#DC2626" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Lege cel (edit mode) ─────────────────────────────────────────────────────
function EmptyCell({ x, y, isActive, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={() => onClick(x, y)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        gridColumn: x + 1,
        gridRow:    y + 1,
        border: `2px dashed ${isActive ? 'var(--primary)' : hover ? 'var(--s400)' : 'var(--s200)'}`,
        borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        color: isActive ? 'var(--primary)' : hover ? 'var(--s400)' : 'var(--s300)',
        background: isActive ? 'var(--s50)' : 'transparent',
        transition: 'all 0.15s',
      }}
    >
      <Plus size={16} />
    </div>
  )
}

// ── Grootte-knoppen ──────────────────────────────────────────────────────────
function SizeControl({ label, value, onDec, onInc, min = 1, max = 12 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', minWidth: 16 }}>{label}</span>
      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px' }} onClick={onDec} disabled={value <= min}><ChevronDown size={12} /></button>
      <span style={{ fontWeight: 700, minWidth: 14, textAlign: 'center', fontSize: '0.85rem' }}>{value}</span>
      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px' }} onClick={onInc} disabled={value >= max}><ChevronUp size={12} /></button>
    </div>
  )
}

// ── Hoofd component ───────────────────────────────────────────────────────────
export default function TafelIndeling({ role, onOpenDetail, onNewBon }) {
  const { t }   = useLang()
  const showToast = useToast()
  const isAdmin = role === 'admin'

  const [layout, setLayout]         = useState(DEFAULT_LAYOUT)
  const [receipts, setReceipts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [editMode, setEditMode]     = useState(false)
  const [activeCell, setActiveCell] = useState(null)
  const [editTable, setEditTable]   = useState(null)
  const [labelInput, setLabelInput] = useState('')
  const [sizeInput, setSizeInput]   = useState({ w: 1, h: 1 })
  const [saving, setSaving]         = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function load(animate = false) {
    if (animate) setRefreshing(true)
    else setLoading(true)
    const [lay, recs] = await Promise.all([
      fetchTafelindeling().catch(() => DEFAULT_LAYOUT),
      fetchReceipts().catch(() => []),
    ])
    setLayout(lay || DEFAULT_LAYOUT)
    setReceipts(recs)
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  async function persist(newLayout) {
    setSaving(true)
    const saved = await saveTafelindeling(newLayout)
    setLayout(saved)
    setSaving(false)
    showToast(t('toast_saved'))
  }

  function cancel() {
    setActiveCell(null)
    setEditTable(null)
    setLabelInput('')
    setSizeInput({ w: 1, h: 1 })
  }

  function handleClickEmpty(x, y) {
    setActiveCell({ x, y })
    setEditTable(null)
    setLabelInput('')
    setSizeInput({ w: 1, h: 1 })
  }

  function handleClickTable(table, st) {
    if (editMode) {
      setEditTable(table)
      setLabelInput(table.label)
      setSizeInput({ w: table.w || 1, h: table.h || 1 })
      setActiveCell(null)
      return
    }
    if (st.key === 'open' || st.key === 'paid') onOpenDetail(st.receipt.id)
    else onNewBon(table.label)
  }

  function submitAdd() {
    const label = labelInput.trim()
    if (!label || !activeCell) return
    const { x, y } = activeCell
    const { w, h } = sizeInput
    const newId = Math.max(0, ...layout.tables.map(t => t.id)) + 1
    persist({ ...layout, tables: [...layout.tables, { id: newId, label, x, y, w, h }] })
    cancel()
  }

  function submitEdit() {
    const label = labelInput.trim()
    if (!label || !editTable) return
    const { w, h } = sizeInput
    persist({ ...layout, tables: layout.tables.map(t => t.id === editTable.id ? { ...t, label, w, h } : t) })
    cancel()
  }

  function deleteTable(id) {
    persist({ ...layout, tables: layout.tables.filter(t => t.id !== id) })
    if (editTable?.id === id) cancel()
  }

  function resizeCols(delta) {
    const cols = Math.min(12, Math.max(2, layout.cols + delta))
    const tables = layout.tables
      .filter(t => t.x < cols)
      .map(t => ({ ...t, w: Math.min(t.w || 1, cols - t.x) }))
    persist({ ...layout, cols, tables })
  }

  function resizeRows(delta) {
    const rows = Math.min(10, Math.max(1, layout.rows + delta))
    const tables = layout.tables
      .filter(t => t.y < rows)
      .map(t => ({ ...t, h: Math.min(t.h || 1, rows - t.y) }))
    persist({ ...layout, rows, tables })
  }

  // Max breedte/hoogte voor de huidige selectie (niet buiten het rooster)
  const originX = activeCell?.x ?? editTable?.x ?? 0
  const originY = activeCell?.y ?? editTable?.y ?? 0
  const maxW = layout.cols - originX
  const maxH = layout.rows - originY

  if (loading) return <div className="spinner" />

  const occupied  = getOccupied(layout.tables)
  const emptyCells = editMode
    ? Array.from({ length: layout.rows }, (_, y) =>
        Array.from({ length: layout.cols }, (_, x) => ({ x, y }))
      ).flat().filter(({ x, y }) => !occupied.has(`${x},${y}`))
    : []

  const statusMap = Object.fromEntries(
    layout.tables.map(t => [t.id, getStatus(t.label, receipts)])
  )
  const openCount = layout.tables.filter(t => statusMap[t.id]?.key === 'open').length
  const freeCount = layout.tables.filter(t => statusMap[t.id]?.key === 'free').length

  const CELL = 'clamp(60px, 13vw, 84px)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #3730a3 100%)',
        borderRadius: 14, padding: '1rem 1.25rem', color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
            {t('tafels_title')}
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span>
              <span style={{ fontSize: '1.5rem', fontWeight: 900 }}>{openCount}</span>
              <span style={{ fontSize: '0.72rem', color: '#FED7AA', marginLeft: 4, fontWeight: 600 }}>{t('tafels_open')}</span>
            </span>
            <span>
              <span style={{ fontSize: '1.5rem', fontWeight: 900 }}>{freeCount}</span>
              <span style={{ fontSize: '0.72rem', color: '#BBF7D0', marginLeft: 4, fontWeight: 600 }}>{t('tafels_free')}</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
          <button className="btn btn-sm" onClick={() => load(true)} disabled={refreshing}
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 8px' }}>
            <RefreshCw size={13} style={{ transition: 'transform 0.5s', transform: refreshing ? 'rotate(360deg)' : 'none' }} />
          </button>
          {isAdmin && (
            <button className="btn btn-sm" onClick={() => { setEditMode(v => !v); cancel() }}
              style={{ background: editMode ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', gap: 5 }}>
              {editMode ? <><Eye size={13} /> {t('tafels_view')}</> : <><Settings2 size={13} /> {t('tafels_edit')}</>}
            </button>
          )}
        </div>
      </div>

      {/* ── Legenda ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.73rem', color: 'var(--muted)' }}>
        {[
          { key: 'free', label: t('tafels_free') },
          { key: 'open', label: t('tafels_open_legend') },
          { key: 'paid', label: t('tafels_paid_today') },
        ].map(({ key, label }) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS[key].bg, border: `2px solid ${STATUS[key].border}`, flexShrink: 0 }} />
            {label}
          </span>
        ))}
      </div>

      {/* ── Roostergrootte (edit mode) ────────────────────────────────── */}
      {editMode && (
        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
          padding: '0.6rem 0.9rem',
          background: 'var(--s50)', border: '1px solid var(--border)', borderRadius: 10,
          fontSize: '0.8rem', color: 'var(--s700)',
        }}>
          <span style={{ fontWeight: 600 }}>{t('tafels_grid_size')}:</span>
          <SizeControl label={t('tafels_cols')} value={layout.cols} min={2} max={12}
            onDec={() => resizeCols(-1)} onInc={() => resizeCols(1)} />
          <SizeControl label={t('tafels_rows')} value={layout.rows} min={1} max={10}
            onDec={() => resizeRows(-1)} onInc={() => resizeRows(1)} />
          {saving && <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{t('loading')}</span>}
        </div>
      )}

      {/* ── Formulier: tafel toevoegen / bewerken ─────────────────────── */}
      {(activeCell || editTable) && editMode && (
        <div style={{
          padding: '0.75rem 0.9rem',
          background: 'var(--surface)', border: '2px solid var(--primary)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', flexShrink: 0 }}>
              {editTable ? t('tafels_edit_label') : t('tafels_add_label')}
            </span>
            <input
              className="form-input"
              style={{ flex: '1 1 130px', maxWidth: 200 }}
              placeholder={t('tafels_label_ph')}
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') editTable ? submitEdit() : submitAdd() }}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={editTable ? submitEdit : submitAdd}
              disabled={!labelInput.trim() || saving} style={{ gap: 4 }}>
              <Check size={13} /> {t('save')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={cancel}><X size={13} /></button>
          </div>

          {/* Grootte */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>{t('tafels_size')}:</span>
            <SizeControl label="B" value={sizeInput.w} min={1} max={maxW}
              onDec={() => setSizeInput(s => ({ ...s, w: Math.max(1, s.w - 1) }))}
              onInc={() => setSizeInput(s => ({ ...s, w: Math.min(maxW, s.w + 1) }))} />
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>×</span>
            <SizeControl label="H" value={sizeInput.h} min={1} max={maxH}
              onDec={() => setSizeInput(s => ({ ...s, h: Math.max(1, s.h - 1) }))}
              onInc={() => setSizeInput(s => ({ ...s, h: Math.min(maxH, s.h + 1) }))} />
            {(sizeInput.w > 1 || sizeInput.h > 1) && (
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                {sizeInput.w}×{sizeInput.h} vakken
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Grid ──────────────────────────────────────────────────────── */}
      {layout.tables.length === 0 && !editMode ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '3rem 1rem', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '0.5rem', color: 'var(--muted)',
        }}>
          <LayoutGrid size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
          <p style={{ fontSize: '0.86rem' }}>{t('tafels_empty')}</p>
          {isAdmin && (
            <button className="btn btn-outline btn-sm" onClick={() => setEditMode(true)} style={{ gap: 5, marginTop: 4 }}>
              <Settings2 size={13} /> {t('tafels_edit')}
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${layout.cols}, ${CELL})`,
            gridTemplateRows:    `repeat(${layout.rows}, ${CELL})`,
            gap: 8,
            width: 'max-content',
          }}>
            {/* Lege cellen (alleen edit mode) */}
            {emptyCells.map(({ x, y }) => (
              <EmptyCell
                key={`e-${x}-${y}`}
                x={x} y={y}
                isActive={activeCell?.x === x && activeCell?.y === y}
                onClick={handleClickEmpty}
              />
            ))}

            {/* Tafels */}
            {layout.tables.map(table => (
              <TableCell
                key={table.id}
                table={table}
                editMode={editMode}
                statusInfo={statusMap[table.id]}
                onClickTable={handleClickTable}
                onEdit={t => { setEditTable(t); setLabelInput(t.label); setSizeInput({ w: t.w || 1, h: t.h || 1 }); setActiveCell(null) }}
                onDelete={deleteTable}
              />
            ))}
          </div>
        </div>
      )}

      {editMode && (
        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'center' }}>
          {t('tafels_edit_hint')}
        </p>
      )}
    </div>
  )
}
