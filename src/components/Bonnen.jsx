import { useState, useEffect } from 'react'
import { useLang } from '../App'
import { fetchReceipts, updateReceipt, deleteReceipt } from '../api'

const fmt = (price) => `€ ${parseFloat(price).toFixed(2)}`

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

  const paidCount   = receipts.filter(r => r.paid).length
  const unpaidCount = receipts.filter(r => !r.paid).length

  const visible = receipts.filter(r => {
    if (filter === 'paid')   return r.paid
    if (filter === 'unpaid') return !r.paid
    return true
  })

  if (loading) return <div className="spinner" />

  return (
    <div>
      <div className="filter-tabs">
        <button className={`filter-tab ${filter === 'all'    ? 'active' : ''}`} onClick={() => setFilter('all')}>
          {t('all')} ({receipts.length})
        </button>
        <button className={`filter-tab ${filter === 'unpaid' ? 'active' : ''}`} onClick={() => setFilter('unpaid')}>
          {t('unpaid')} ({unpaidCount})
        </button>
        <button className={`filter-tab ${filter === 'paid'   ? 'active' : ''}`} onClick={() => setFilter('paid')}>
          {t('paid')} ({paidCount})
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧾</div>
          <p>{t('no_receipts')}</p>
        </div>
      ) : (
        visible.map(receipt => (
          <div key={receipt.id} className="receipt-card" onClick={() => onOpenDetail(receipt.id)}>
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                  {receipt.name || `${t('receipt_number')} #${receipt.id}`}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>
                  {fmtDate(receipt.created_at)} &bull; {receipt.item_count} {t('items')}
                </div>
              </div>
              <span className={`badge ${receipt.paid ? 'badge-paid' : 'badge-unpaid'}`}>
                {receipt.paid ? t('paid') : t('unpaid')}
              </span>
            </div>

            {/* Bottom row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--green)' }}>
                {fmt(receipt.total)}
              </span>
              <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                <button
                  className={`btn btn-sm ${receipt.paid ? 'btn-warning' : 'btn-success'}`}
                  onClick={e => togglePaid(e, receipt)}
                >
                  {receipt.paid ? `✕ ${t('mark_unpaid')}` : `✓ ${t('mark_paid')}`}
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={e => handleDelete(e, receipt)}
                  title={t('delete_receipt')}
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
