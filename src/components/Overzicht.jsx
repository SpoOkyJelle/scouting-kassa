import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, CalendarDays, CheckCircle2, Clock,
  FileText, Divide, BarChart2, Trophy, Download, FileBarChart,
  ShoppingCart, RefreshCw, ArrowUpRight, Heart, Wallet,
  Banknote, CreditCard, Smartphone, Layers, Sparkles,
} from 'lucide-react'
import { useLang } from '../LangContext'
import { useCategories } from '../CategoriesContext'
import { fetchStats, fetchReceipts } from '../api'
import DagRapport from './DagRapport'
import KasAfsluiting from './KasAfsluiting'

const fmt   = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target, duration = 550) {
  const [displayed, setDisplayed] = useState(target)
  const stateRef = useRef({ current: target, animId: null })

  useEffect(() => {
    const s = stateRef.current
    if (s.animId) { cancelAnimationFrame(s.animId); s.animId = null }
    const from = s.current
    const to = parseFloat(target ?? 0)
    if (from === to) return
    const start = performance.now()
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const val = from + (to - from) * eased
      s.current = val
      setDisplayed(val)
      if (t < 1) { s.animId = requestAnimationFrame(step) }
      else { s.current = to; s.animId = null; setDisplayed(to) }
    }
    s.animId = requestAnimationFrame(step)
    return () => { if (s.animId) { cancelAnimationFrame(s.animId); s.animId = null } }
  }, [target, duration])

  return displayed
}

const GREEN  = '#2E6B4E'
const PURPLE = '#8A6D9B'
const PALETTE = ['#2E6B4E','#C77A1A','#3C7A86','#5C8A3C','#B0683A','#8A6D9B','#D9A741','#8A8374']

// ── Tooltip ───────────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label, color = GREEN }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 13px', boxShadow: 'var(--shadow)',
      fontSize: '0.82rem',
    }}>
      <p style={{ fontWeight: 700, marginBottom: 2, color: 'var(--s700)', fontSize: '0.78rem' }}>{label}</p>
      <p style={{ color, fontWeight: 800, fontSize: '0.92rem' }}>{fmt(payload[0]?.value)}</p>
    </div>
  )
}

// ── Kleine KPI-kaart ──────────────────────────────────────────────────────────
function KpiCard({ Icon, label, value, sub, accent = '#8A8374', accentBg = 'var(--s100)' }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '0.85rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, background: accentBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={16} color={accent} strokeWidth={2.3} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--s900)', letterSpacing: '-0.4px', lineHeight: 1.1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: '0.72rem', color: accent, fontWeight: 600, marginTop: 1 }}>{sub}</div>}
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'none', letterSpacing: '0.4px', marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  )
}

// ── Sectie-header ─────────────────────────────────────────────────────────────
function SectionHead({ Icon, label, color = 'var(--muted)' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      marginBottom: '0.65rem',
    }}>
      <Icon size={14} color={color} strokeWidth={2.3} />
      <span style={{
        fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)',
        textTransform: 'none', letterSpacing: '0.6px',
      }}>{label}</span>
    </div>
  )
}

const PAYMENT_LABELS = { contant: 'Contant', pin: 'Pin', qr: 'QR / Tikkie', onbekend: '' }

// ── Hoofd component ───────────────────────────────────────────────────────────
export default function Overzicht({ role }) {
  const { t } = useLang()
  const { getCat } = useCategories()
  const [stats, setStats]                   = useState(null)
  const [loading, setLoading]               = useState(true)
  const [period, setPeriod]                 = useState('today')
  const [customDate, setCustomDate]         = useState('')
  const [showDagRapport, setShowDagRapport] = useState(false)
  const [refreshing, setRefreshing]         = useState(false)
  const [contentKey, setContentKey]         = useState(0)

  async function load(p = period, d = customDate, animate = false) {
    if (p === 'date' && !d) return
    if (animate) setRefreshing(true)
    else setLoading(true)
    const data = await fetchStats(p !== 'all' ? p : undefined, p === 'date' ? d : undefined)
    setStats(data)
    setLoading(false)
    setRefreshing(false)
    setContentKey(k => k + 1)
  }

  useEffect(() => { load() }, [period, customDate]) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportCsv() {
    const receipts = await fetchReceipts()
    const sep = ';'
    const header = ['ID', 'Naam', 'Datum', 'Items', 'Totaal (EUR)', 'Betaald', 'Betaalmethode', 'Korting (%)', 'Donatie (EUR)', 'Notitie']
    const rows = receipts.map(r => [
      r.id,
      r.name || `#${r.id}`,
      new Date(r.created_at).toLocaleString('nl-NL'),
      r.item_count,
      r.total.toFixed(2).replace('.', ','),
      r.paid ? 'Ja' : 'Nee',
      PAYMENT_LABELS[r.payment_method] || '',
      r.discount_pct || 0,
      (r.donation || 0).toFixed(2).replace('.', ','),
      r.note || '',
    ])
    const csv = '﻿' + [header, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(sep))
      .join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `kassa-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const {
    totalRevenue = 0, paidRevenue = 0, unpaidRevenue = 0, todayRevenue = 0,
    receiptCount = 0, paidCount = 0, unpaidCount = 0, avgReceiptValue = 0,
    topProducts = [], categoryStats = [], revenueByHour = [], revenueByDay = [], multiDay = false,
    totalCosts = 0, profit = 0, totalDonations = 0,
    paymentBreakdown = {}, todayPaymentBreakdown = {},
    estimatedCosts = 0, estimatedProfit = 0,
    yesterdayRevenue = 0,
  } = stats ?? {}

  const animRevenue = useCountUp(totalRevenue)
  const animProfit  = useCountUp(profit)

  const isAdmin = role === 'admin'

  const paidPct = totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 0
  const hasInkoop = totalCosts > 0

  // ── Inzichten: automatisch de opvallendste bevindingen samenvatten ───────────
  const insights = (() => {
    const out = []
    // Drukste uur
    if (revenueByHour.length) {
      const peak  = revenueByHour.reduce((a, b) => (a.revenue > b.revenue ? a : b))
      const nextH = String(parseInt(peak.hour) + 1).padStart(2, '0')
      out.push({ Icon: Clock, accent: '#C77A1A', accentBg: '#FBF1DE',
        value: `${peak.hour.slice(0, 2)}–${nextH}`, label: t('ins_peak_hour'), sub: fmt(peak.revenue) })
    }
    // Best verkochte product (op aantal)
    if (topProducts.length) {
      const best = [...topProducts].sort((a, b) => b.quantity - a.quantity)[0]
      out.push({ Icon: Trophy, accent: '#F59E0B', accentBg: '#FEF3DA',
        value: `${best.quantity}×`, label: t('ins_best_seller'), sub: best.name })
    }
    // Grootste categorie (aandeel in omzet)
    const catTotal = categoryStats.reduce((s, c) => s + c.revenue, 0)
    if (categoryStats.length && catTotal > 0) {
      const top = categoryStats[0]
      out.push({ Icon: Layers, accent: '#3C7A86', accentBg: '#E6F0F1',
        value: getCat(top.cat).label, label: t('ins_top_category'),
        sub: `${Math.round((top.revenue / catTotal) * 100)}% ${t('ins_of_revenue')}` })
    }
    // Gemiddeld aantal items per bon
    const totalUnits = topProducts.reduce((s, p) => s + p.quantity, 0)
    if (receiptCount > 0 && totalUnits > 0) {
      out.push({ Icon: ShoppingCart, accent: '#8A6D9B', accentBg: '#EFEAF2',
        value: (totalUnits / receiptCount).toFixed(1), label: t('ins_avg_items') })
    }
    // Meest gebruikte betaalmethode
    const methods = Object.entries(paymentBreakdown).filter(([, v]) => v > 0)
    const methodTotal = methods.reduce((s, [, v]) => s + v, 0)
    if (methods.length && methodTotal > 0) {
      const [key, amt] = methods.reduce((a, b) => (a[1] > b[1] ? a : b))
      out.push({ Icon: CreditCard, accent: '#2E6B4E', accentBg: '#EDF4EF',
        value: t(`payment_method_${key}`), label: t('ins_top_method'),
        sub: `${Math.round((amt / methodTotal) * 100)}%` })
    }
    // Beste dag (alleen bij meerdere dagen)
    if (multiDay && revenueByDay.length) {
      const best = revenueByDay.reduce((a, b) => (a.revenue > b.revenue ? a : b))
      out.push({ Icon: CalendarDays, accent: PURPLE, accentBg: '#EFEAF2',
        value: best.day, label: t('ins_best_day'), sub: fmt(best.revenue) })
    }
    return out
  })()

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Period toggle */}
        <div style={{
          display: 'flex', background: 'var(--s100)', borderRadius: 8,
          padding: 3, gap: 2, flex: '1 1 auto',
        }}>
          {[
            { key: 'today',     label: t('stats_period_today') },
            { key: 'yesterday', label: t('filter_yesterday') },
            { key: 'all',       label: t('stats_period_all') },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setCustomDate(''); setPeriod(key) }}
              style={{
                flex: 1, border: 'none', borderRadius: 6, padding: '6px 14px',
                fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                background: period === key ? 'var(--surface)' : 'transparent',
                color: period === key ? 'var(--s800)' : 'var(--muted)',
                boxShadow: period === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Datum picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <CalendarDays size={14} color={period === 'date' ? 'var(--primary)' : 'var(--s400)'} />
          <input
            type="date"
            value={customDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => {
              const d = e.target.value
              setCustomDate(d)
              setPeriod(d ? 'date' : 'today')
            }}
            style={{
              padding: '5px 8px', fontSize: '0.78rem', fontFamily: 'inherit',
              border: `1px solid ${period === 'date' ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 8, background: 'var(--surface)',
              color: period === 'date' ? 'var(--primary)' : 'var(--s600)',
              fontWeight: period === 'date' ? 700 : 400,
              outline: 'none', cursor: 'pointer',
            }}
          />
        </div>

        {/* Action buttons */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => load(period, customDate, true)}
          disabled={refreshing}
          style={{ padding: '6px 8px', color: 'var(--s400)' }}
          title="Vernieuwen"
        >
          <RefreshCw size={14} style={{ transition: 'transform 0.5s', transform: refreshing ? 'rotate(360deg)' : 'none' }} />
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setShowDagRapport(true)}
          disabled={!stats}
          style={{ gap: 5 }}
        >
          <FileBarChart size={13} /> {t('dag_rapport')}
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={exportCsv}
          style={{ gap: 5 }}
        >
          <Download size={13} /> {t('export_csv')}
        </button>
      </div>

      {showDagRapport && stats && (
        <DagRapport stats={stats} onClose={() => setShowDagRapport(false)} />
      )}

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {loading ? <div className="spinner" /> : (
        <div key={contentKey} className="stats-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* ── Hero cards ──────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

            {/* Omzet hero */}
            <div style={{
              background: 'linear-gradient(135deg, #163A2B 0%, #1E4D39 60%, #1E4D39 100%)',
              borderRadius: 16,
              padding: '1.25rem 1.4rem',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* decorative circle */}
              <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 100, height: 100, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
              }} />
              <div style={{
                position: 'absolute', bottom: -30, right: 30,
                width: 70, height: 70, borderRadius: '50%',
                background: 'rgba(255,255,255,0.04)',
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, position: 'relative' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'none', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.6)' }}>
                  {period === 'today' ? t('stats_today')
                    : period === 'yesterday' ? t('filter_yesterday')
                    : period === 'date' && customDate
                      ? new Date(customDate + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
                      : t('stats_total')}
                </span>
                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 7, padding: '4px 6px' }}>
                  <TrendingUp size={14} color="rgba(255,255,255,0.8)" />
                </div>
              </div>

              <div style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.05, position: 'relative' }}>
                {fmt(animRevenue)}
              </div>

              {period === 'all' && todayRevenue > 0 && (
                <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', position: 'relative' }}>
                  Vandaag: <span style={{ color: '#9BE3BC', fontWeight: 700 }}>{fmt(todayRevenue)}</span>
                </div>
              )}
              {period === 'today' && yesterdayRevenue > 0 && (() => {
                const diff = totalRevenue - yesterdayRevenue
                const pct  = Math.round(Math.abs(diff / yesterdayRevenue) * 100)
                return (
                  <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', position: 'relative' }}>
                    {t('stats_yesterday')}: <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>{fmt(yesterdayRevenue)}</span>
                    {diff !== 0 && (
                      <span style={{ marginLeft: 6, fontWeight: 800, color: diff > 0 ? '#9BE3BC' : '#fca5a5' }}>
                        {diff > 0 ? '↑' : '↓'}{pct}%
                      </span>
                    )}
                  </div>
                )
              })()}

              {/* Paid progress bar */}
              {receiptCount > 0 && (
                <div style={{ marginTop: 12, position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>
                    <span>Betaald {paidPct}%</span>
                    <span>{paidCount}/{receiptCount} bonnen</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${paidPct}%`,
                      background: 'rgba(255,255,255,0.7)', borderRadius: 4,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Winst hero */}
            {(
              <div style={{
                background: profit >= 0
                  ? 'linear-gradient(135deg, #022c22 0%, #064e3b 60%, #065f46 100%)'
                  : 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 60%, #991b1b 100%)',
                borderRadius: 16,
                padding: '1.25rem 1.4rem',
                color: '#fff',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: -20, right: -20,
                  width: 100, height: 100, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, position: 'relative' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'none', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.6)' }}>
                    {t('stats_profit')}
                  </span>
                  <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 7, padding: '4px 6px' }}>
                    {profit >= 0
                      ? <TrendingUp size={14} color="rgba(255,255,255,0.8)" />
                      : <TrendingDown size={14} color="rgba(255,255,255,0.8)" />
                    }
                  </div>
                </div>

                <div style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.05, position: 'relative' }}>
                  {fmt(animProfit)}
                </div>

                <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', position: 'relative' }}>
                  {t('stats_costs')}: <span style={{ color: profit >= 0 ? '#6ee7b7' : '#fca5a5', fontWeight: 700 }}>{fmt(totalCosts)}</span>
                </div>
                {unpaidRevenue > 0 && (
                  <div style={{ marginTop: 3, fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', position: 'relative' }}>
                    {t('stats_exp_profit')}: <span style={{ color: '#9BE3BC', fontWeight: 700 }}>{fmt(totalRevenue - totalCosts)}</span>
                  </div>
                )}

                {/* Cost ratio bar */}
                {totalRevenue > 0 && (
                  <div style={{ marginTop: 12, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>
                      <span>Marge {totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0}%</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.max(0, Math.min(100, totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0))}%`,
                        background: 'rgba(255,255,255,0.7)', borderRadius: 4,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Empty state ──────────────────────────────────────────────────── */}
          {receiptCount === 0 && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '3rem 1rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              color: 'var(--muted)',
            }}>
              <BarChart2 size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
              <p style={{ fontSize: '0.86rem' }}>{t('stats_empty')}</p>
            </div>
          )}

          {/* ── KPI strip ────────────────────────────────────────────────────── */}
          {receiptCount > 0 && (
            <div>
              <SectionHead Icon={BarChart2} label="Statistieken" />
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
                gap: '0.6rem',
              }}>
                <KpiCard
                  Icon={CheckCircle2} label={t('stats_paid_amt')} value={fmt(paidRevenue)}
                  sub={`${paidCount} ${t('stats_count').toLowerCase()}`}
                  accent={GREEN} accentBg="#EDF4EF"
                />
                <KpiCard
                  Icon={Clock} label={t('stats_unpaid_amt')} value={fmt(unpaidRevenue)}
                  sub={`${unpaidCount} ${t('stats_count').toLowerCase()}`}
                  accent="#C77A1A" accentBg="#FBF1DE"
                />
                <KpiCard
                  Icon={FileText} label={t('stats_count')} value={receiptCount}
                  accent="var(--s500)" accentBg="var(--s100)"
                />
                <KpiCard
                  Icon={Divide} label={t('stats_avg')} value={fmt(avgReceiptValue)}
                  accent="#3C7A86" accentBg="#E6F0F1"
                />
                {period === 'all' && hasInkoop && (
                  <KpiCard
                    Icon={ShoppingCart} label={t('stats_costs')} value={fmt(totalCosts)}
                    accent="#DC2626" accentBg="#FEF2F2"
                  />
                )}
                {totalDonations > 0 && (
                  <KpiCard
                    Icon={Heart} label={t('stats_donations')} value={fmt(totalDonations)}
                    accent="#2E6B4E" accentBg="#EDF4EF"
                  />
                )}
                {estimatedCosts > 0 && (
                  <KpiCard
                    Icon={ShoppingCart} label={t('stats_est_costs')} value={fmt(estimatedCosts)}
                    sub={`Marge ${totalRevenue > 0 ? Math.round((estimatedProfit / totalRevenue) * 100) : 0}%`}
                    accent="#8A6D9B" accentBg="#EFEAF2"
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Inzichten ─────────────────────────────────────────────────────── */}
          {insights.length > 0 && (
            <div>
              <SectionHead Icon={Sparkles} label={t('ins_section')} color="#F59E0B" />
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
                gap: '0.6rem',
              }}>
                {insights.map((ins, i) => (
                  <KpiCard
                    key={i} Icon={ins.Icon} label={ins.label} value={ins.value}
                    sub={ins.sub} accent={ins.accent} accentBg={ins.accentBg}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Betaalmethode breakdown ──────────────────────────────────────── */}
          {paidRevenue > 0 && (() => {
            const methods = [
              { key: 'contant', label: t('payment_method_contant'), Icon: Banknote,   color: '#2E6B4E', bg: '#EDF4EF' },
              { key: 'pin',     label: t('payment_method_pin'),     Icon: CreditCard, color: '#3C7A86', bg: '#E6F0F1' },
              { key: 'qr',      label: t('payment_method_qr'),      Icon: Smartphone, color: '#8A6D9B', bg: '#EFEAF2' },
              { key: 'onbekend',label: t('payment_method_onbekend'),Icon: FileText,   color: '#8A8374', bg: 'var(--s100)' },
            ].map(m => ({ ...m, amount: paymentBreakdown[m.key] ?? 0 }))
              .filter(m => m.amount > 0)

            if (!methods.length) return null
            const breakdownTotal = methods.reduce((s, m) => s + m.amount, 0)
            const maxAmount = Math.max(...methods.map(m => m.amount))

            return (
              <div>
                <SectionHead Icon={CreditCard} label={t('payment_method')} color="#3C7A86" />
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                  {methods.map((m, i) => {
                    const pct = breakdownTotal > 0 ? Math.round((m.amount / breakdownTotal) * 100) : 0
                    const barW = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0
                    return (
                      <div
                        key={m.key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '0.7rem 1rem',
                          borderBottom: i < methods.length - 1 ? '1px solid var(--s100)' : 'none',
                          position: 'relative', overflow: 'hidden',
                        }}
                      >
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${barW}%`, background: `${m.color}10`,
                          transition: 'width 0.5s ease',
                        }} />
                        <div style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: m.bg, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', flexShrink: 0, position: 'relative',
                        }}>
                          <m.Icon size={14} color={m.color} strokeWidth={2.2} />
                        </div>
                        <span style={{ flex: 1, fontSize: '0.84rem', fontWeight: 500, color: 'var(--s800)', position: 'relative' }}>
                          {m.label}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', position: 'relative', flexShrink: 0 }}>
                          {pct}%
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: m.color, minWidth: 64, textAlign: 'right', position: 'relative', flexShrink: 0 }}>
                          {fmt(m.amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── Omzet per uur ────────────────────────────────────────────────── */}
          {revenueByHour?.length > 0 && (
            <div>
              <SectionHead Icon={BarChart2} label={t('stats_by_hour')} color={GREEN} />
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '1rem 1rem 0.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <ResponsiveContainer width="100%" height={175}>
                  <BarChart data={revenueByHour} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 10, fill: 'var(--s400)' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--s400)' }}
                      tickFormatter={v => `€${v}`}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--s50)', radius: 4 }} />
                    <Bar dataKey="revenue" fill={GREEN} radius={[5, 5, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
                {(() => {
                  const peak = revenueByHour.reduce((a, b) => a.revenue > b.revenue ? a : b)
                  const nextH = String(parseInt(peak.hour) + 1).padStart(2, '0')
                  return (
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', paddingTop: '0.5rem', paddingBottom: '0.25rem', textAlign: 'center' }}>
                      Drukste uur: <strong style={{ color: 'var(--s700)' }}>{peak.hour}–{nextH}:00</strong>
                      {' · '}<span style={{ color: 'var(--primary)', fontWeight: 700 }}>{fmt(peak.revenue)}</span>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ── Populairste producten + Omzet per dag side-by-side ─────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: multiDay && revenueByDay?.length > 0 ? '1fr 1fr' : '1fr',
            gap: '0.75rem',
            alignItems: 'start',
          }}>

            {/* Top producten */}
            {topProducts?.length > 0 && (
              <div>
                <SectionHead Icon={Trophy} label={t('stats_top')} color="#F59E0B" />
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                  {topProducts.slice(0, 7).map((p, i) => {
                    const maxRev = topProducts[0].revenue
                    const barW   = maxRev > 0 ? (p.revenue / maxRev) * 100 : 0
                    return (
                      <div
                        key={p.name}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '0.65rem 1rem',
                          borderBottom: i < topProducts.slice(0, 7).length - 1 ? '1px solid var(--s100)' : 'none',
                          position: 'relative', overflow: 'hidden',
                        }}
                      >
                        {/* background bar */}
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${barW}%`,
                          background: `${PALETTE[i % PALETTE.length]}12`,
                          transition: 'width 0.5s ease',
                        }} />

                        <span style={{
                          width: 20, height: 20, borderRadius: 6,
                          background: PALETTE[i % PALETTE.length],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 800, color: '#fff', flexShrink: 0,
                          position: 'relative',
                        }}>
                          {i + 1}
                        </span>

                        <span style={{
                          flex: 1, fontSize: '0.83rem', fontWeight: 500,
                          color: 'var(--s800)', overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', position: 'relative',
                        }}>
                          {p.name}
                        </span>

                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', position: 'relative', flexShrink: 0 }}>
                          {p.quantity}×
                        </span>
                        <span style={{
                          fontWeight: 700, fontSize: '0.85rem',
                          color: PALETTE[i % PALETTE.length],
                          minWidth: 56, textAlign: 'right', position: 'relative', flexShrink: 0,
                        }}>
                          {fmt(p.revenue)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Omzet per dag */}
            {multiDay && revenueByDay?.length > 0 && (
              <div>
                <SectionHead Icon={CalendarDays} label={t('stats_by_day')} color={PURPLE} />
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '1rem 1rem 0.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                  <ResponsiveContainer width="100%" height={Math.min(220, 90 + revenueByDay.length * 20)}>
                    <BarChart data={revenueByDay} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: 'var(--s400)' }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--s400)' }}
                        tickFormatter={v => `€${v}`}
                        axisLine={false} tickLine={false}
                      />
                      <Tooltip content={<ChartTip color={PURPLE} />} cursor={{ fill: 'var(--s50)', radius: 4 }} />
                      <Bar dataKey="revenue" radius={[5, 5, 0, 0]} maxBarSize={44}>
                        {revenueByDay.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* ── Omzet per categorie ──────────────────────────────────────────── */}
          {categoryStats.length > 0 && (() => {
            const maxCatRev = categoryStats[0].revenue || 0
            return (
              <div>
                <SectionHead Icon={Layers} label={t('stats_by_category')} color="#3C7A86" />
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                  padding: '1rem 1.1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex', flexDirection: 'column', gap: '0.85rem',
                }}>
                  {categoryStats.map(c => {
                    const cat  = getCat(c.cat)
                    const barW = maxCatRev > 0 ? (c.revenue / maxCatRev) * 100 : 0
                    return (
                      <div key={c.cat}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                          <cat.Icon size={13} color={cat.color} strokeWidth={2.3} />
                          <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500, color: 'var(--s800)' }}>{cat.label}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{c.quantity}×</span>
                          <span style={{ fontWeight: 700, fontSize: '0.84rem', color: cat.color, minWidth: 64, textAlign: 'right' }}>{fmt(c.revenue)}</span>
                        </div>
                        <div style={{ height: 7, borderRadius: 4, background: 'var(--s100)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${barW}%`, background: cat.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── Kasafsluiting (admin only) ────────────────────────────────────── */}
          {isAdmin && (
            <div>
              <SectionHead Icon={Wallet} label="Kasafsluiting" color="#3C7A86" />
              <KasAfsluiting todayContant={todayPaymentBreakdown.contant ?? 0} todayQr={todayPaymentBreakdown.qr ?? 0} />
            </div>
          )}

          {/* ── Betaald / onbetaald breakdown ────────────────────────────────── */}
          {totalRevenue > 0 && (
            <div>
              <SectionHead Icon={ArrowUpRight} label="Betaalstatus" />
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '1rem 1.2rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                  {[
                    { label: t('paid'),   value: fmt(paidRevenue),   count: paidCount,   color: GREEN,     bg: '#EDF4EF' },
                    { label: t('unpaid'), value: fmt(unpaidRevenue), count: unpaidCount, color: '#C77A1A', bg: '#FBF1DE' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 120px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                          {item.label}{item.count > 0 ? ` · ${item.count} ${t('stats_count').toLowerCase()}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stacked bar */}
                <div style={{ height: 10, borderRadius: 6, overflow: 'hidden', background: '#FBF1DE', display: 'flex' }}>
                  {paidPct > 0 && (
                    <div style={{
                      width: `${paidPct}%`, background: GREEN, borderRadius: paidPct < 100 ? '6px 0 0 6px' : 6,
                      transition: 'width 0.6s ease',
                    }} />
                  )}
                  {paidPct < 100 && unpaidRevenue > 0 && (
                    <div style={{
                      flex: 1, background: '#C77A1A', borderRadius: paidPct > 0 ? '0 6px 6px 0' : 6,
                    }} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
