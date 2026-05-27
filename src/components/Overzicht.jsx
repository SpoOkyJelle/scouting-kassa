import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts'
import { useLang } from '../App'

const fmt   = (n) => `€ ${parseFloat(n ?? 0).toFixed(2)}`
const GREEN  = '#2D7D46'
const COLORS = ['#2D7D46', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7', '#198754', '#1F5C32', '#43A047']

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow)',
      padding: '1rem 1.1rem',
      borderTop: `3px solid ${accent}`,
    }}>
      <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: accent, lineHeight: 1 }}>
        {value}
      </div>
      {sub != null && (
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 3 }}>{sub}</div>
      )}
      <div style={{
        fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 5,
      }}>
        {label}
      </div>
    </div>
  )
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
function ChartTip({ active, payload, label, isMoney = true }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow)',
    }}>
      <p style={{ fontWeight: 700, marginBottom: 3 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? GREEN, fontSize: '0.88rem' }}>
          {isMoney ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ── Section box ───────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow)', padding: '1.1rem 1.25rem',
      marginBottom: '1rem',
    }}>
      <p className="section-title" style={{ marginBottom: '1.1rem' }}>{title}</p>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Overzicht() {
  const { t, lang } = useLang()
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
  }, [])

  if (loading) return <div className="spinner" />

  const { totalRevenue, paidRevenue, unpaidRevenue, todayRevenue,
          receiptCount, paidCount, unpaidCount, avgReceiptValue,
          topProducts, revenueByHour, revenueByDay, multiDay } = stats

  // Pie data for paid vs unpaid
  const pieData = [
    { name: t('paid'),   value: paidCount   },
    { name: t('unpaid'), value: unpaidCount },
  ].filter(d => d.value > 0)

  return (
    <div>
      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}>
        <StatCard icon="💰" label={t('stats_total')}     value={fmt(totalRevenue)}    accent="var(--green)"   />
        <StatCard icon="📅" label={t('stats_today')}     value={fmt(todayRevenue)}    accent="#6366F1"        />
        <StatCard icon="✅" label={t('stats_paid_amt')}  value={fmt(paidRevenue)}
          sub={`${paidCount} ${t('stats_count').toLowerCase()}`}  accent="var(--success)"  />
        <StatCard icon="⏳" label={t('stats_unpaid_amt')} value={fmt(unpaidRevenue)}
          sub={`${unpaidCount} ${t('stats_count').toLowerCase()}`} accent="var(--warning)" />
        <StatCard icon="📋" label={t('stats_count')}      value={receiptCount}         accent="var(--muted)"  />
        <StatCard icon="🧾" label={t('stats_avg')}        value={fmt(avgReceiptValue)} accent="#0EA5E9"       />
      </div>

      {receiptCount === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <p>{t('stats_empty')}</p>
        </div>
      )}

      {/* ── Revenue timeline ────────────────────────────────────────────── */}
      {revenueByHour.length > 0 && (
        <Section title={`📈 ${t('stats_by_hour')}`}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueByHour} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="revenue" fill={GREEN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {multiDay && revenueByDay.length > 0 && (
        <Section title={`📅 ${t('stats_by_day')}`}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueByDay} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {revenueByDay.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* ── Bottom row: top products + paid/unpaid pie ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}
           className="stats-bottom">
        {/* Top products — horizontal bar chart */}
        {topProducts.length > 0 && (
          <Section title={`🏆 ${t('stats_top')}`}>
            <ResponsiveContainer width="100%" height={Math.max(180, topProducts.length * 38)}>
              <BarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 0, right: 70, bottom: 0, left: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div style={{
                      background: '#fff', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow)',
                    }}>
                      <p style={{ fontWeight: 700, marginBottom: 3 }}>{label}</p>
                      <p style={{ color: GREEN }}>{fmt(payload[0]?.value)}</p>
                      <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                        {payload[0]?.payload?.quantity} {t('stats_qty').toLowerCase()}
                      </p>
                    </div>
                  )
                }} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}
                  label={{ position: 'right', formatter: v => fmt(v), fontSize: 11, fill: 'var(--muted)' }}
                >
                  {topProducts.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* Paid vs unpaid pie */}
        {receiptCount > 0 && (
          <Section title={`🥧 ${t('paid')} vs ${t('unpaid')}`}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={true}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? 'var(--success)' : 'var(--warning)'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name) => [`${v} ${t('stats_count').toLowerCase()}`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </Section>
        )}
      </div>
    </div>
  )
}
