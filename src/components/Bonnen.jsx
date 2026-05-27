import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, Trash2, Check, X, FileText, Calendar } from 'lucide-react'
import { useLang } from '../App'
import { fetchReceipts, updateReceipt, deleteReceipt } from '../api'

const fmt = p => `€ ${parseFloat(p).toFixed(2)}`

function fmtDate(str) {
  return new Date(str).toLocaleString(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Bonnen({ onOpenDetail }) {
  const { t } = useLang()
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('unpaid')

  useEffect(() => {
    fetchReceipts().then(data => { setReceipts(data); setLoading(false) })
  }, [])

  async function togglePaid(e, receipt) {
    e.stopPropagation()
    const updated = await updateReceipt(receipt.id, { paid: !receipt.paid })
    setReceipts(prev => prev.map(r => r.id === receipt.id ? { ...r, ...updated } : r))
  }

  async function handleDelete(e, receipt) {
    e.stopPropagation()
    if (!confirm(t('confirm_delete'))) return
    await deleteReceipt(receipt.id)
    setReceipts(prev => prev.filter(r => r.id !== receipt.id))
  }

  const paidCount   = receipts.filter(r =>  r.paid).length
  const unpaidCount = receipts.filter(r => !r.paid).length

  const visible = receipts.filter(r => {
    if (filter === 'paid')   return  r.paid
    if (filter === 'unpaid') return !r.paid
    return true
  })

  if (loading) return <div className="spinner" />

  return (
    <div>
      {/* Filter tabs */}
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

      {/* Receipt list */}
      {visible.length === 0 ? (
        <div className="empty-state">
          <FileText size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
          <p>{t('no_receipts')}</p>
        </div>
      ) : (
        visible.map(receipt => (
          <div
            key={receipt.id}
            className={`receipt-card ${receipt.paid ? 'is-paid' : 'is-unpaid'}`}
            onClick={() => onOpenDetail(receipt.id)}
          >
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
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
            </div>
          </div>
        ))
      )}
    </div>
  )
}
