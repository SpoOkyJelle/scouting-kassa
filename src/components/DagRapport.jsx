import { X, Printer } from 'lucide-react'
import { useLang } from '../LangContext'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

const PALETTE = ['#16A34A','#22C55E','#0EA5E9','#F59E0B','#8B5CF6','#EC4899','#10B981','#F97316']

export default function DagRapport({ stats, onClose }) {
  const { t } = useLang()
  const today = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  function print() {
    window.print()
  }

  const {
    totalRevenue, paidRevenue, unpaidRevenue,
    receiptCount, paidCount, unpaidCount, avgReceiptValue,
    topProducts,
  } = stats

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box rapport-box"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--s900)', margin: 0 }}>
              {t('dag_rapport_title')}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 3 }}>{today}</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-outline btn-sm no-print" onClick={print}>
              <Printer size={13} /> {t('print')}
            </button>
            <button className="btn btn-ghost btn-sm no-print" onClick={onClose} style={{ padding: '5px 7px' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Revenue summary */}
        <div className="rapport-grid">
          <div className="rapport-card">
            <div className="rapport-card-val">{fmt(totalRevenue)}</div>
            <div className="rapport-card-lbl">{t('stats_total')}</div>
          </div>
          <div className="rapport-card">
            <div className="rapport-card-val" style={{ color: '#16A34A' }}>{fmt(paidRevenue)}</div>
            <div className="rapport-card-lbl">{t('paid')}</div>
          </div>
          <div className="rapport-card">
            <div className="rapport-card-val" style={{ color: '#D97706' }}>{fmt(unpaidRevenue)}</div>
            <div className="rapport-card-lbl">{t('unpaid')}</div>
          </div>
        </div>

        {/* Counts */}
        <div style={{ display: 'flex', gap: 16, marginBottom: '1.1rem', flexWrap: 'wrap' }}>
          {[
            { label: t('stats_count'),   val: receiptCount },
            { label: t('paid'),          val: paidCount },
            { label: t('unpaid'),        val: unpaidCount },
            { label: t('stats_avg'),     val: fmt(avgReceiptValue) },
          ].map(({ label, val }) => (
            <div key={label} style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              <span style={{ fontWeight: 700, color: 'var(--s800)', marginRight: 4 }}>{val}</span>
              {label}
            </div>
          ))}
        </div>

        {/* Top products */}
        {topProducts?.length > 0 && (
          <>
            <p style={{ fontSize: '0.71rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
              {t('stats_top')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.5rem' }}>
              {topProducts.slice(0, 8).map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--s800)', fontWeight: 500 }}>{p.name}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{p.quantity}×</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)', minWidth: 60, textAlign: 'right' }}>{fmt(p.revenue)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
