import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, Trash2, Check, X, FileText, Calendar, Search, CheckSquare } from 'lucide-react'
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
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState(new Set())

  useEffect(() => {
    fetchReceipts().then(data => { setReceipts(data); setLoading(false) })
  }, [])

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

  const paidCount   = receipts.filter(r =>  r.paid).length
  const unpaidCount = receipts.filter(r => !r.paid).length

  const q = search.trim().toLowerCase()

  const visible = receipts
    .filter(r => {
      if (filter === 'paid')   return  r.paid
      if (filter === 'unpaid') return !r.paid
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

  if (loading) return <div className="spinner" />

  return (
    <div>
      {/* ── Toolbar: search + sort + select ─────────────────────────────── */}
      <div className="receipt-toolbar">
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input
            className="form-input search-input"
            placeholder={t('search_receipts')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              <X size={13} />
            </button>
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

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <div className="filter-tabs">
        <button className={`filter-tab ${filter === 'all'    ? 'active' : ''}`} onClick={() => setFilter('all')}>
          {t('all')} ({receipts.length})
        </button>
        <button className={`filter-tab ${filter === 'unpaid' ? 'active' : ''}`} onClick={() => setFilter('unpaid')}>
          <Clock size={12} />
          {t('unpaid')} ({unpaidCount})
        </button>
        <button className={`filter-tab ${filter === 'paid'   ? 'active' : ''}`} onClick={() => setFilter('paid')}>
          <CheckCircle2 size={12} />
          {t('paid')} ({paidCount})
        </button>
      </div>

      {/* ── Receipt list ─────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="empty-state">
          <FileText size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
          <p>{t('no_receipts')}</p>
        </div>
      ) : (
        visible.map(receipt => {
          const isSelected = selected.has(receipt.id)
          return (
            <div
              key={receipt.id}
              className={`receipt-card ${receipt.paid ? 'is-paid' : 'is-unpaid'}${isSelected ? ' is-selected' : ''}`}
              onClick={() => selectMode ? toggleSelect({ stopPropagation: () => {} }, receipt.id) : onOpenDetail(receipt.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {/* Checkbox in select mode */}
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
                    <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={11} />
                      {fmtDate(receipt.created_at)}
                      <span style={{ color: 'var(--s300)' }}>·</span>
                      {receipt.item_count} {t('items')}
                    </div>
                  </div>
                </div>
                <span className={`badge ${receipt.paid ? 'badge-paid' : 'badge-unpaid'}`}>
                  {receipt.paid
                    ? <><CheckCircle2 size={10} /> {t('paid')}</>
                    : <><Clock size={10} /> {t('unpaid')}</>}
                </span>
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
        })
      )}

      {/* ── Bulk action bar ──────────────────────────────────────────────── */}
      {selectMode && selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">
            {selected.size} {t('bulk_selected')}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-success btn-sm" onClick={handleBulkPaid}>
              <Check size={13} /> {t('bulk_mark_paid')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={toggleSelectMode}>
              {t('select_cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
