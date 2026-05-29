import { useState, useEffect } from 'react'
import {
  CheckCircle2, Clock, Trash2, Check, X, FileText,
  Calendar, Search, CheckSquare, StickyNote, Euro,
  Banknote, CreditCard, Smartphone,
} from 'lucide-react'
import { useLang } from '../LangContext'
import { fetchReceipts, updateReceipt, deleteReceipt, bulkMarkPaid } from '../api'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'

const fmt = p => `€ ${parseFloat(p).toFixed(2)}`

function fmtDate(str) {
  return new Date(str).toLocaleString(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Bonnen({ onOpenDetail }) {
  const { t } = useLang()
  const showToast  = useToast()
  const confirm    = useConfirm()

  const [receipts, setReceipts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('unpaid')
  const [search, setSearch]         = useState('')
  const [sort, setSort]             = useState('date')
  const [selectMode, setSelectMode]   = useState(false)
  const [selected, setSelected]       = useState(new Set())
  const [dateFilter, setDateFilter]   = useState('all')
  const [customDate, setCustomDate]   = useState('')
  const [now, setNow]                 = useState(Date.now())

  useEffect(() => {
    fetchReceipts().then(data => { setReceipts(data); setLoading(false) })
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  function elapsedMin(createdAt) {
    return Math.floor((now - new Date(createdAt).getTime()) / 60000)
  }
  function elapsedLabel(createdAt) {
    const m = elapsedMin(createdAt)
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60), r = m % 60
    return r > 0 ? `${h}u ${r}m` : `${h}u`
  }
  function elapsedColor(createdAt) {
    const m = elapsedMin(createdAt)
    if (m >= 30) return '#DC2626'
    if (m >= 15) return '#D97706'
    return 'var(--muted)'
  }

  async function togglePaid(e, receipt) {
    e.stopPropagation()
    const updated = await updateReceipt(receipt.id, { paid: !receipt.paid })
    setReceipts(prev => prev.map(r => r.id === receipt.id ? { ...r, ...updated } : r))
    showToast(updated.paid ? t('toast_marked_paid') : t('toast_marked_unpaid'))
  }

  async function handleDelete(e, receipt) {
    e.stopPropagation()
    const ok = await confirm(t('confirm_delete'))
    if (!ok) return
    await deleteReceipt(receipt.id)
    setReceipts(prev => prev.filter(r => r.id !== receipt.id))
    showToast(t('toast_deleted'), 'info')
  }

  function toggleSelectMode() {
    setSelectMode(v => !v)
    setSelected(new Set())
  }

  function toggleSelect(e, id) {
    e.stopPropagation()
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  async function handleBulkPaid() {
    const ids = [...selected]
    await bulkMarkPaid(ids, true)
    setReceipts(prev => prev.map(r => ids.includes(r.id) ? { ...r, paid: 1 } : r))
    setSelected(new Set())
    setSelectMode(false)
    showToast(t('toast_marked_paid'))
  }

  async function handleBulkUnpaid() {
    const ids = [...selected]
    await bulkMarkPaid(ids, false)
    setReceipts(prev => prev.map(r => ids.includes(r.id) ? { ...r, paid: 0 } : r))
    setSelected(new Set())
    setSelectMode(false)
    showToast(t('toast_marked_unpaid'))
  }

  const paidCount   = receipts.filter(r =>  r.paid).length
  const unpaidCount = receipts.filter(r => !r.paid).length
  const totalPaid   = receipts.filter(r =>  r.paid).reduce((s, r) => s + r.total, 0)
  const totalUnpaid = receipts.filter(r => !r.paid).reduce((s, r) => s + r.total, 0)

  const todayStr     = new Date().toDateString()
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString()

  const q = search.trim().toLowerCase()
  const visible = receipts
    .filter(r => {
      if (filter === 'paid')   return  r.paid
      if (filter === 'unpaid') return !r.paid
      return true
    })
    .filter(r => {
      const d = new Date(r.created_at)
      if (dateFilter === 'today')     return d.toDateString() === todayStr
      if (dateFilter === 'yesterday') return d.toDateString() === yesterdayStr
      if (dateFilter === 'custom' && customDate) return r.created_at.startsWith(customDate)
      return true
    })
    .filter(r => {
      if (!q) return true
      const name = (r.name || `${t('receipt_number')} #${r.id}`).toLowerCase()
      return name.includes(q)
    })
    .sort((a, b) => {
      if (sort === 'name')   return (a.name || '').localeCompare(b.name || '')
      if (sort === 'amount') return b.total - a.total
      return new Date(b.created_at) - new Date(a.created_at)
    })

  function selectAll() {
    setSelected(new Set(visible.map(r => r.id)))
  }

  if (loading) return <div className="spinner" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Hero summary ────────────────────────────────────────────────── */}
      {receipts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #052e16 0%, #14532d 60%, #166534 100%)',
            borderRadius: 12, padding: '0.9rem 1.1rem', color: '#fff',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
              {t('paid')}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              {fmt(totalPaid)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#86efac', marginTop: 2, fontWeight: 600 }}>
              {paidCount} {t('stats_count').toLowerCase()}
            </div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #451a03 0%, #78350f 60%, #92400e 100%)',
            borderRadius: 12, padding: '0.9rem 1.1rem', color: '#fff',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
              {t('unpaid')}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              {fmt(totalUnpaid)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#fcd34d', marginTop: 2, fontWeight: 600 }}>
              {unpaidCount} {t('stats_count').toLowerCase()}
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--s400)', pointerEvents: 'none' }} />
          <input
            className="form-input search-input"
            placeholder={t('search_receipts')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}><X size={13} /></button>
          )}
        </div>
        <select
          className="form-input sort-select"
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          <option value="date">{t('sort_date')}</option>
          <option value="name">{t('sort_name')}</option>
          <option value="amount">{t('sort_amount')}</option>
        </select>
        <button
          className={`btn btn-sm ${selectMode ? 'btn-primary' : 'btn-outline'}`}
          onClick={toggleSelectMode}
          title={selectMode ? t('select_cancel') : t('select_mode')}
          style={{ flexShrink: 0 }}
        >
          <CheckSquare size={14} />
        </button>
      </div>

      {/* ── Filter toggle ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', background: 'var(--s100)', borderRadius: 8, padding: 3, gap: 2 }}>
        {[
          { key: 'all',    label: `${t('all')} (${receipts.length})`,     Icon: Euro },
          { key: 'unpaid', label: `${t('unpaid')} (${unpaidCount})`,  Icon: Clock },
          { key: 'paid',   label: `${t('paid')} (${paidCount})`,      Icon: CheckCircle2 },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              flex: 1, border: 'none', borderRadius: 6, padding: '6px 8px',
              fontSize: '0.76rem', fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: filter === key ? 'var(--surface)' : 'transparent',
              color: filter === key ? 'var(--s800)' : 'var(--muted)',
              boxShadow: filter === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* ── Datumfilter ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { key: 'all',       label: t('all') },
          { key: 'today',     label: t('stats_period_today') },
          { key: 'yesterday', label: t('filter_yesterday') },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setDateFilter(key); setCustomDate('') }}
            style={{
              border: 'none', borderRadius: 7, padding: '5px 11px',
              fontSize: '0.76rem', fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer', transition: 'all 0.15s',
              background: dateFilter === key && !customDate ? 'var(--primary)' : 'var(--s100)',
              color:      dateFilter === key && !customDate ? '#fff' : 'var(--muted)',
            }}
          >
            {label}
          </button>
        ))}
        <input
          type="date"
          className="form-input"
          style={{ flex: '0 0 auto', fontSize: '0.78rem', padding: '5px 8px', height: 'auto',
            outline: customDate ? '2px solid var(--primary)' : 'none' }}
          value={customDate}
          onChange={e => { setCustomDate(e.target.value); setDateFilter('custom') }}
          title={t('filter_date')}
        />
      </div>

      {/* ── Receipt list ─────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '3rem 1rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
          color: 'var(--muted)',
        }}>
          <FileText size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
          <p style={{ fontSize: '0.86rem' }}>{t('no_receipts')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {visible.map(receipt => {
            const isSelected = selected.has(receipt.id)
            return (
              <div
                key={receipt.id}
                onClick={() => selectMode ? toggleSelect({ stopPropagation: () => {} }, receipt.id) : onOpenDetail(receipt.id)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${receipt.paid ? '#16A34A' : '#D97706'}`,
                  borderRadius: 12,
                  padding: '0.85rem 1rem',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'box-shadow 0.15s, transform 0.12s',
                  outline: isSelected ? '2px solid var(--primary)' : 'none',
                  outlineOffset: isSelected ? 1 : 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'none' }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {selectMode && (
                      <div
                        className={`receipt-checkbox${isSelected ? ' checked' : ''}`}
                        onClick={e => toggleSelect(e, receipt.id)}
                        style={{ flexShrink: 0, marginTop: 2 }}
                      >
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--s900)' }}>
                        {receipt.name || `${t('receipt_number')} #${receipt.id}`}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <Calendar size={11} />
                        {fmtDate(receipt.created_at)}
                        <span style={{ color: 'var(--s300)' }}>·</span>
                        {receipt.item_count} {t('items')}
                        {!receipt.paid && (
                          <>
                            <span style={{ color: 'var(--s300)' }}>·</span>
                            <span style={{ color: elapsedColor(receipt.created_at), fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Clock size={10} />
                              {elapsedLabel(receipt.created_at)}
                            </span>
                          </>
                        )}
                      </div>
                      {receipt.note && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, fontStyle: 'italic' }}>
                          <StickyNote size={10} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                            {receipt.note}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px', borderRadius: 20,
                      fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                      background: receipt.paid ? '#DCFCE7' : '#FEF3C7',
                      color: receipt.paid ? '#166534' : '#92400E',
                    }}>
                      {receipt.paid
                        ? <><CheckCircle2 size={10} /> {t('paid')}</>
                        : <><Clock size={10} /> {t('unpaid')}</>}
                    </span>
                    {receipt.paid && (receipt.payments?.length > 0 || receipt.payment_method) && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '3px 7px', borderRadius: 20,
                        fontSize: '0.66rem', fontWeight: 600,
                        background: '#EFF6FF', color: '#1D4ED8',
                      }}>
                        {(receipt.payments?.length > 0
                          ? receipt.payments.map(p => p.method)
                          : [receipt.payment_method]
                        ).map(m => (
                          <span key={m}>
                            {m === 'contant' && <Banknote size={10} />}
                            {m === 'pin'     && <CreditCard size={10} />}
                            {m === 'qr'      && <Smartphone size={10} />}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary)' }}>
                    {fmt(receipt.total)}
                  </span>
                  {!selectMode && (
                    <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                      <button
                        className={`btn btn-sm ${receipt.paid ? 'btn-warning' : 'btn-success'}`}
                        onClick={e => togglePaid(e, receipt)}
                      >
                        {receipt.paid
                          ? <><X size={12} /> {t('mark_unpaid')}</>
                          : <><Check size={12} /> {t('mark_paid')}</>}
                      </button>
                      <button
                        className="btn btn-sm btn-ghost-danger"
                        onClick={e => handleDelete(e, receipt)}
                        title={t('delete_receipt')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Bulk action bar ──────────────────────────────────────────────── */}
      {selectMode && (
        <div className="bulk-bar">
          <span className="bulk-bar-count">
            {selected.size > 0 ? `${selected.size} ${t('bulk_selected')}` : t('select_mode')}
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {selected.size < visible.length && (
              <button className="btn btn-ghost btn-sm" style={{ color: '#94A3B8' }} onClick={selectAll}>
                Alles ({visible.length})
              </button>
            )}
            {selected.size > 0 && (
              <>
                <button className="btn btn-success btn-sm" onClick={handleBulkPaid}>
                  <Check size={13} /> {t('bulk_mark_paid')}
                </button>
                <button className="btn btn-warning btn-sm" onClick={handleBulkUnpaid}>
                  <X size={13} /> {t('mark_unpaid')}
                </button>
              </>
            )}
            <button className="btn btn-ghost btn-sm" style={{ color: '#94A3B8' }} onClick={toggleSelectMode}>
              {t('select_cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
