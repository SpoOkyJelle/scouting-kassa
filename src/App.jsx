import { useState, useEffect } from 'react'
import { Tent, FileText, PlusCircle, Package, BarChart2, LogOut, WifiOff, QrCode, Settings, ShoppingCart, Heart, Monitor, Copy, Check, ExternalLink, X } from 'lucide-react'
import { translations } from './i18n'
import { logout as apiLogout, fetchSettings } from './api'
import { LangContext } from './LangContext'
import { SettingsContext } from './SettingsContext'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmModal'
import PaymentModal from './components/PaymentModal'
import LoginScreen from './components/LoginScreen'
import Bonnen      from './components/Bonnen'
import NieuweBon   from './components/NieuweBon'
import Producten   from './components/Producten'
import BonDetail   from './components/BonDetail'
import Overzicht   from './components/Overzicht'
import Instellingen  from './components/Instellingen'
import InkoopBonnen from './components/InkoopBonnen'
import Donaties      from './components/Donaties'

export { LangContext }
export { useLang } from './LangContext'

const TABS = [
  { id: 'receipts',  Icon: FileText,      labelKey: 'receipts',    roles: ['admin','cashier'] },
  { id: 'new',       Icon: PlusCircle,    labelKey: 'new_receipt', roles: ['admin','cashier'] },
  { id: 'overview',  Icon: BarChart2,     labelKey: 'overview',    roles: ['admin','cashier'] },
  { id: 'inkoop',    Icon: ShoppingCart,  labelKey: 'inkoop_tab',    roles: ['admin'] },
  { id: 'donaties',  Icon: Heart,         labelKey: 'donaties_tab',  roles: ['admin', 'cashier'] },
  { id: 'products',  Icon: Package,       labelKey: 'products',    roles: ['admin'] },
  { id: 'settings',  Icon: Settings,      labelKey: 'settings',    roles: ['admin'] },
]

function OfflineBanner({ t }) {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const goOn  = () => setOffline(false)
    const goOff = () => setOffline(true)
    window.addEventListener('online',  goOn)
    window.addEventListener('offline', goOff)
    return () => {
      window.removeEventListener('online',  goOn)
      window.removeEventListener('offline', goOff)
    }
  }, [])
  if (!offline) return null
  return (
    <div className="offline-banner">
      <WifiOff size={13} />
      {t('offline_banner')}
    </div>
  )
}

export default function App() {
  const [lang, setLangState]          = useState(() => localStorage.getItem('kassa_lang') || 'nl')
  const [token, setToken]             = useState(() => localStorage.getItem('kassa_token'))
  const [role, setRole]               = useState(() => localStorage.getItem('kassa_role') || 'admin')
  const [darkMode, setDarkModeRaw]    = useState(() => localStorage.getItem('kassa_theme') === 'dark')
  const [tab, setTab]                 = useState('receipts')
  const [detailId, setDetailId]       = useState(null)
  const [showPayment, setShowPayment]   = useState(false)
  const [showDisplay, setShowDisplay]   = useState(false)
  const [displayCopied, setDisplayCopied] = useState(false)
  const [appSettings, setAppSettings] = useState({ paymentUrl: '', paymentName: '' })

  const t = key => translations[lang]?.[key] ?? key

  // Persist lang + bubble up
  function setLang(l) {
    setLangState(l)
    localStorage.setItem('kassa_lang', l)
  }

  // Apply + persist dark mode
  function setDarkMode(val) {
    const next = typeof val === 'function' ? val(darkMode) : val
    setDarkModeRaw(next)
    document.documentElement.dataset.theme = next ? 'dark' : ''
    localStorage.setItem('kassa_theme', next ? 'dark' : '')
  }

  // Restore dark mode and font size on first mount
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : ''
    const fs = localStorage.getItem('kassa_fontsize') || 'normal'
    const fsMap = { small: '90%', normal: '100%', large: '115%' }
    document.documentElement.style.fontSize = fsMap[fs] || '100%'
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load settings when logged in
  useEffect(() => {
    if (token) {
      fetchSettings().then(setAppSettings).catch(() => {})
    }
  }, [token])

  // Update favicon when logo changes
  useEffect(() => {
    const faviconUrl = appSettings.faviconDataUrl
    let link = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = faviconUrl || '/favicon.ico'
  }, [appSettings.faviconDataUrl])

  // Session timeout: auto-logout after 30 min inactivity
  useEffect(() => {
    if (!token) return
    const TIMEOUT = 30 * 60 * 1000
    let timer = setTimeout(handleLogout, TIMEOUT)
    function reset() {
      clearTimeout(timer)
      timer = setTimeout(handleLogout, TIMEOUT)
    }
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach(ev => window.removeEventListener(ev, reset))
    }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seed initial history state so the first popstate has something to land on
  useEffect(() => {
    history.replaceState({ tab: 'receipts', detailId: null }, '')
  }, [])

  // Browser back/forward button
  useEffect(() => {
    function onPopState(e) {
      const state = e.state
      if (!state || !state.tab) {
        // Gebruiker drukt voorbij de app-history — terugduwen zodat de site niet verlaten wordt
        history.pushState({ tab: 'receipts', detailId: null }, '')
        setTab('receipts')
        setDetailId(null)
        return
      }
      setTab(state.tab)
      setDetailId(state.detailId ?? null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const visibleTabs = TABS.filter(tab => tab.roles.includes(role))

  function navigateTo(newTab, newDetailId = null) {
    history.pushState({ tab: newTab, detailId: newDetailId }, '')
    setTab(newTab)
    setDetailId(newDetailId)
  }

  function openDetail(id) { navigateTo('detail', id) }
  function closeDetail()  { navigateTo('receipts') }

  function handleTabChange(id) { navigateTo(id) }

  function handleLogin(tok, r) {
    setToken(tok)
    setRole(r || 'admin')
    history.replaceState({ tab: 'receipts', detailId: null }, '')
  }

  async function handleLogout() {
    await apiLogout()
    setToken(null)
    setRole('admin')
    setTab('receipts')
    setDetailId(null)
    history.replaceState({ tab: 'receipts', detailId: null }, '')
  }

  return (
    <LangContext.Provider value={{ t, lang }}>
      <SettingsContext.Provider value={appSettings}>
        <ToastProvider>
          <ConfirmProvider>
            <OfflineBanner t={t} />
            {showPayment && <PaymentModal onClose={() => setShowPayment(false)} />}

            {/* ── Display URL modal ───────────────────────────────────── */}
            {showDisplay && (() => {
              const url = `${window.location.origin}/display`
              const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=12&data=${encodeURIComponent(url)}`
              async function copyUrl() {
                try { await navigator.clipboard.writeText(url) } catch {
                  const el = document.createElement('textarea'); el.value = url
                  document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
                }
                setDisplayCopied(true); setTimeout(() => setDisplayCopied(false), 2200)
              }
              return (
                <div className="modal-overlay" onClick={() => setShowDisplay(false)}>
                  <div className="modal-box payment-modal" onClick={e => e.stopPropagation()}>
                    <div className="payment-modal-header">
                      <span className="payment-modal-title">{t('display_title')}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowDisplay(false)} style={{ padding: '4px 6px' }}><X size={15} /></button>
                    </div>
                    <p className="payment-modal-hint">{t('display_hint')}</p>
                    <div className="payment-qr-wrap">
                      <img src={qrSrc} alt="Display QR" width={200} height={200} className="payment-qr" />
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', wordBreak: 'break-all', marginBottom: '0.75rem' }}>{url}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="btn btn-primary btn-full btn-lg"
                        style={{ textDecoration: 'none', justifyContent: 'center', gap: 6 }}>
                        <ExternalLink size={15} /> {t('display_open')}
                      </a>
                      <button className="btn btn-outline btn-full" onClick={copyUrl}>
                        {displayCopied ? <><Check size={14} /> {t('payment_copied')}</> : <><Copy size={14} /> {t('display_copy')}</>}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── Login gate ────────────────────────────────────────────── */}
            {!token ? (
              <LoginScreen onLogin={handleLogin} lang={lang} setLang={setLang} />
            ) : (
              <>
                {/* ── Header ──────────────────────────────────────────────── */}
                <header className="header">
                  <div className="header-brand">
                    {appSettings.logoDataUrl ? (
                      <img
                        src={appSettings.logoDataUrl}
                        alt="Logo"
                        style={{ height: 36, maxWidth: 160, objectFit: 'contain', borderRadius: 4 }}
                      />
                    ) : (
                      <>
                        <div className="header-logomark">
                          <Tent size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                          <div className="header-name">Kassa</div>
                          <div className="header-tagline">Scouting</div>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => setShowDisplay(true)}
                      title={t('display_btn')}
                      style={{ background: 'rgba(255,255,255,0.10)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', gap: 6 }}
                    >
                      <Monitor size={14} />
                      <span className="tab-label">{t('display_btn')}</span>
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => setShowPayment(true)}
                      title={t('payment_btn')}
                      style={{
                        background: 'rgba(255,255,255,0.10)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.18)',
                        gap: 6,
                      }}
                    >
                      <QrCode size={14} />
                      <span className="tab-label">{t('payment_btn')}</span>
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={handleLogout}
                      title={t('logout')}
                      style={{ color: 'var(--s400)', padding: '5px 8px' }}
                    >
                      <LogOut size={15} />
                    </button>
                  </div>
                </header>

                {/* ── Tab nav ───────────────────────────────────────────── */}
                <nav className="tab-nav">
                  {visibleTabs.map(({ id, Icon, labelKey }) => (
                    <button
                      key={id}
                      className={`tab-btn ${tab === id || (tab === 'detail' && id === 'receipts') ? 'active' : ''}`}
                      onClick={() => handleTabChange(id)}
                    >
                      <Icon size={15} strokeWidth={2} />
                      <span className="tab-label">{t(labelKey)}</span>
                    </button>
                  ))}
                </nav>

                {/* ── Content ───────────────────────────────────────────── */}
                <main className="main-content">
                  {tab === 'receipts'  && <Bonnen    onOpenDetail={openDetail} />}
                  {tab === 'new'       && <NieuweBon onCreated={id => openDetail(id)} />}
                  {tab === 'overview'  && <Overzicht role={role} />}
                  {tab === 'inkoop'    && <InkoopBonnen />}
                  {tab === 'donaties'  && <Donaties />}
                  {tab === 'products'  && <Producten />}
                  {tab === 'settings'  && (
                    <Instellingen
                      settings={appSettings}
                      onSave={setAppSettings}
                      lang={lang}
                      setLang={setLang}
                      darkMode={darkMode}
                      setDarkMode={setDarkMode}
                      role={role}
                    />
                  )}
                  {tab === 'detail' && detailId && <BonDetail id={detailId} onBack={closeDetail} />}
                </main>
              </>
            )}
          </ConfirmProvider>
        </ToastProvider>
      </SettingsContext.Provider>
    </LangContext.Provider>
  )
}
