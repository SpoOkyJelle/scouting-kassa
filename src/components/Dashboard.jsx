import { useState, useEffect, useRef } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, FileText, Divide,
  Trophy, Heart, Layers, BarChart2, Star,
} from 'lucide-react'
import { useLang } from '../LangContext'
import { useCategories } from '../CategoriesContext'
import { fetchStats } from '../api'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

// ── Count-up voor de grote kerncijfers ──────────────────────────────────────────
function useCountUp(target, duration = 600) {
  const [displayed, setDisplayed] = useState(target)
  const ref = useRef({ current: target, id: null })
  useEffect(() => {
    const s = ref.current
    if (s.id) cancelAnimationFrame(s.id)
    const from = s.current, to = parseFloat(target ?? 0)
    if (from === to) return
    const start = performance.now()
    const tick = now => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const val = from + (to - from) * eased
      s.current = val; setDisplayed(val)
      if (t < 1) s.id = requestAnimationFrame(tick)
      else { s.current = to; s.id = null; setDisplayed(to) }
    }
    s.id = requestAnimationFrame(tick)
    return () => { if (s.id) cancelAnimationFrame(s.id) }
  }, [target, duration])
  return displayed
}

const MEDALS = ['#F59E0B', '#9CA3AF', '#B0683A']   // goud / zilver / brons

// ── Groot kerncijfer ───────────────────────────────────────────────────────────
function BigStat({ Icon, label, value, accent, tone = 'light' }) {
  const dark = tone === 'dark'
  return (
    <div style={{
      background: dark ? accent : 'var(--surface)',
      border: dark ? 'none' : '1px solid var(--border)',
      borderRadius: 16, padding: '1.1rem 1.2rem',
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
    }}>
      {dark && <div style={{ position: 'absolute', top: -24, right: -24, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, position: 'relative' }}>
        <Icon size={15} color={dark ? 'rgba(255,255,255,0.85)' : accent} strokeWidth={2.3} />
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.4px',
          color: dark ? 'rgba(255,255,255,0.7)' : 'var(--muted)',
        }}>{label}</span>
      </div>
      <div style={{
        fontSize: 'clamp(1.35rem, 4.5vw, 1.9rem)', fontWeight: 900, letterSpacing: '-0.8px',
        lineHeight: 1.05, color: dark ? '#fff' : 'var(--s900)', position: 'relative',
      }}>{value}</div>
    </div>
  )
}

function SectionHead({ Icon, label, color = 'var(--muted)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: '0.65rem' }}>
      <Icon size={14} color={color} strokeWidth={2.3} />
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.6px' }}>{label}</span>
    </div>
  )
}

// ── Dashboard: compact "at-a-glance" overzicht ──────────────────────────────────
export default function Dashboard() {
  const { t } = useLang()
  const { getCat } = useCategories()
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod]   = useState('today')

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchStats(period !== 'all' ? period : undefined)
      .then(d => { if (alive) { setStats(d); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [period])

  const {
    totalRevenue = 0, profit = 0, receiptCount = 0, avgReceiptValue = 0,
    totalDonations = 0, topProducts = [], categoryStats = [],
  } = stats ?? {}

  const animRevenue = useCountUp(totalRevenue)
  const animProfit  = useCountUp(profit)

  // "Favorieten" = meest verkocht op aantal stuks.
  const favorites = [...topProducts].sort((a, b) => b.quantity - a.quantity).slice(0, 6)
  const maxQty    = favorites[0]?.quantity || 0
  const maxCatRev = categoryStats[0]?.revenue || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Periode toggle */}
      <div style={{ display: 'flex', background: 'var(--s100)', borderRadius: 8, padding: 3, gap: 2 }}>
        {[
          { key: 'today',     label: t('stats_period_today') },
          { key: 'yesterday', label: t('filter_yesterday') },
          { key: 'all',       label: t('stats_period_all') },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            style={{
              flex: 1, border: 'none', borderRadius: 6, padding: '6px 14px',
              fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
              transition: 'all 0.15s',
              background: period === key ? 'var(--surface)' : 'transparent',
              color: period === key ? 'var(--s800)' : 'var(--muted)',
              boxShadow: period === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >{label}</button>
        ))}
      </div>

      {loading ? <div className="spinner" /> : receiptCount === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.5rem', color: 'var(--muted)',
        }}>
          <BarChart2 size={36} strokeWidth={1.2} style={{ color: 'var(--s300)' }} />
          <p style={{ fontSize: '0.86rem' }}>{t('stats_empty')}</p>
        </div>
      ) : (
        <div className="stats-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Kerncijfers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            <BigStat Icon={TrendingUp} label={t('stats_total')} value={fmt(animRevenue)}
              accent="linear-gradient(135deg, #163A2B 0%, #1E4D39 100%)" tone="dark" />
            <BigStat Icon={profit >= 0 ? TrendingUp : TrendingDown} label={t('stats_profit')} value={fmt(animProfit)}
              accent={profit >= 0 ? '#2E6B4E' : '#DC2626'} />
            <BigStat Icon={FileText} label={t('stats_count')} value={receiptCount} accent="#3C7A86" />
            <BigStat Icon={Divide} label={t('stats_avg')} value={fmt(avgReceiptValue)} accent="#8A6D9B" />
          </div>

          {totalDonations > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '0.7rem 1rem',
              background: '#EDF4EF', border: '1px solid var(--border)', borderRadius: 12,
            }}>
              <Heart size={15} color="#2E6B4E" strokeWidth={2.3} />
              <span style={{ fontSize: '0.84rem', color: 'var(--s700)', fontWeight: 500, flex: 1 }}>{t('stats_donations')}</span>
              <span style={{ fontWeight: 800, color: '#2E6B4E' }}>{fmt(totalDonations)}</span>
            </div>
          )}

          {/* Favoriete producten */}
          {favorites.length > 0 && (
            <div>
              <SectionHead Icon={Star} label={t('dash_favorites')} color="#F59E0B" />
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                {favorites.map((p, i) => {
                  const barW   = maxQty > 0 ? (p.quantity / maxQty) * 100 : 0
                  const color  = MEDALS[i] || 'var(--s400)'
                  return (
                    <div key={p.name} style={{
                      display: 'flex', alignItems: 'center', gap: 11, padding: '0.7rem 1rem',
                      borderBottom: i < favorites.length - 1 ? '1px solid var(--s100)' : 'none',
                      position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barW}%`, background: `${MEDALS[i] || '#8A8374'}12`, transition: 'width 0.5s ease' }} />
                      <span style={{
                        width: 24, height: 24, borderRadius: 7, background: color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 800, color: '#fff', flexShrink: 0, position: 'relative',
                      }}>{i < 3 ? <Trophy size={13} /> : i + 1}</span>
                      <span style={{ flex: 1, fontSize: '0.86rem', fontWeight: 500, color: 'var(--s800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative' }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', position: 'relative', flexShrink: 0 }}>
                        {fmt(p.revenue)}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--s900)', minWidth: 68, textAlign: 'right', position: 'relative', flexShrink: 0 }}>
                        {p.quantity}× <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--muted)' }}>{t('dash_sold')}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Omzet per categorie */}
          {categoryStats.length > 0 && (
            <div>
              <SectionHead Icon={Layers} label={t('dash_by_category')} color="#3C7A86" />
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                padding: '1rem 1.1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column', gap: '0.85rem',
              }}>
                {categoryStats.map(c => {
                  const cat   = getCat(c.cat)
                  const barW  = maxCatRev > 0 ? (c.revenue / maxCatRev) * 100 : 0
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
          )}
        </div>
      )}
    </div>
  )
}
