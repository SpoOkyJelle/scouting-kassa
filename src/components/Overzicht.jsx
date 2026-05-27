import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import {
  TrendingUp, CalendarDays, CheckCircle2, Clock,
  FileText, Divide, BarChart2, PieChart as PieIcon, Trophy,
} from 'lucide-react'
import { useLang } from '../App'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

const GREEN   = '#16A34A'
const PALETTE = ['#16A34A', '#22C55E', '#0EA5E9', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981', '#F97316']

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ Icon, label, value, sub, iconBg, iconColor }) {
  return (
    <div className="stat-card">
      <div className="stat-icon-wrap" style={{ background: iconBg }}>
        <Icon size={16} color={iconColor} strokeWidth={2.5} />
      </div>
      <div className="stat-value">{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
      <div className="stat-label">{label}</div>
    </div>
  )
}

// ── Chart tooltip ────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow)',
      fontSize: '0.82rem',
    }}>
      <p style={{ fontWeight: 700, marginBottom: 3, color: 'var(--s800)' }}>{label}</p>
      <p style={{ color: GREEN }}>{fmt(payload[0]?.value)}</p>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Overzicht() {
  const { t } = useLang()
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(d => { setStats(d); setLoading(false) })
  }, [])

  if (loading) return <div className="spinner" />

  const {
    totalRevenue, paidRevenue, unpaidRevenue, todayRevenue,
    receiptCount, paidCount, unpaidCount, avgReceiptValue,
    topProducts, revenueByHour, revenueByDay, multiDay,
  } = stats

  const pieData = [
    { name: t('paid'),   value: paidCount   },
    { name: t('unpaid'), value: unpaidCount },
  ].filter(d => d.value > 0)

  return (
    <div>
      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="stat-grid">
        <StatCard
          Icon={TrendingUp} label={t('stats_total')} value={fmt(totalRevenue)}
          iconBg="#F0FDF4" iconColor={GREEN}
        />
        <StatCard
          Icon={CalendarDays} label={t('stats_today')} value={fmt(todayRevenue)}
          iconBg="#F5F3FF" iconColor="#7C3AED"
        />
        <StatCard
          Icon={CheckCircle2} label={t('stats_paid_amt')} value={fmt(paidRevenue)}
          sub={`${paidCount} ${t('stats_count').toLowerCase()}`}
          iconBg="#F0FDF4" iconColor={GREEN}
        />
        <StatCard
          Icon={Clock} label={t('stats_unpaid_amt')} value={fmt(unpaidRevenue)}
          sub={`${unpaidCount} ${t('stats_count').toLowerCase()}`}
          iconBg="#FFFBEB" iconColor="#D97706"
        />
        <StatCard
          Icon={FileText} label={t('stats_count')} value={receiptCount}
          iconBg="#F8FAFC" iconColor="var(--s500)"
        />
        <StatCard
          Icon={Divide} label={t('stats_avg')} value={fmt(avgReceiptValue)}
          iconBg="#EFF6FF" iconColor="#2563EB"
        />
      </div>

      {receiptCount === 0 && (
        <div className="empty-state" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
          <BarChart2 size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
          <p>{t('stats_empty')}</p>
        </div>
      )}

      {/* ── Revenue by hour ──────────────────────────────────────────────── */}
      {revenueByHour.length > 0 && (
        <div className="chart-box">
          <div className="chart-title">
            <BarChart2 size={15} color={GREEN} />
            {t('stats_by_hour')}
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={revenueByHour} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--s500)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--s500)' }} tickFormatter={v => `€${v}`} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--s50)' }} />
              <Bar dataKey="revenue" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Revenue by day ───────────────────────────────────────────────── */}
      {multiDay && revenueByDay.length > 0 && (
        <div className="chart-box">
          <div className="chart-title">
            <CalendarDays size={15} color="#7C3AED" />
            {t('stats_by_day')}
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={revenueByDay} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--s500)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--s500)' }} tickFormatter={v => `€${v}`} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--s50)' }} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {revenueByDay.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bottom: top products + pie ───────────────────────────────────── */}
      {topProducts.length > 0 && (
        <div className="chart-box">
          <div className="chart-title">
            <Trophy size={15} color="#F59E0B" />
            {t('stats_top')}
          </div>
          <ResponsiveContainer width="100%" height={Math.max(180, topProducts.length * 36)}>
            <BarChart
              data={topProducts}
              layout="vertical"
              margin={{ top: 0, right: 72, bottom: 0, left: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--s500)' }} tickFormatter={v => `€${v}`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--s700)' }} width={108} axisLine={false} tickLine={false} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow)', fontSize: '0.82rem' }}>
                    <p style={{ fontWeight: 700, marginBottom: 3, color: 'var(--s800)' }}>{label}</p>
                    <p style={{ color: GREEN }}>{fmt(payload[0]?.value)}</p>
                    <p style={{ color: 'var(--muted)' }}>{payload[0]?.payload?.quantity} {t('stats_qty').toLowerCase()}</p>
                  </div>
                )
              }} cursor={{ fill: 'var(--s50)' }} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22}
                label={{ position: 'right', formatter: v => fmt(v), fontSize: 11, fill: 'var(--s500)' }}
              >
                {topProducts.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {receiptCount > 0 && pieData.length > 1 && (
        <div className="chart-box">
          <div className="chart-title">
            <PieIcon size={15} color="var(--s500)" />
            {t('paid')} vs {t('unpaid')}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="50%"
                innerRadius={52} outerRadius={78}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? GREEN : '#D97706'} />
                ))}
              </Pie>
              <Tooltip formatter={(v, name) => [`${v} ${t('stats_count').toLowerCase()}`, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
