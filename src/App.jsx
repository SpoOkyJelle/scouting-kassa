import { useState, useEffect } from 'react'
import { Tent, FileText, PlusCircle, Package, BarChart2, LogOut, WifiOff, QrCode, Settings } from 'lucide-react'
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
import Instellingen from './components/Instellingen'

export { LangContext }
export { useLang } from './LangContext'

const TABS = [
  { id: 'receipts',  Icon: FileText,   labelKey: 'receipts',    roles: ['admin','cashier'] },
  { id: 'new',       Icon: PlusCircle, labelKey: 'new_receipt', roles: ['admin','cashier'] },
  { id: 'overview',  Icon: BarChart2,  labelKey: 'overview',    roles: ['admin','cashier'] },
  { id: 'products',  Icon: Package,    labelKey: 'products',    roles: ['admin'] },
  { id: 'settings',  Icon: Settings,   labelKey: 'settings',    roles: ['admin'] },
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
  const [showPayment, setShowPayment] = useState(false)
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

  // Restore dark mode on first mount
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : ''
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load settings when logged in
  useEffect(() => {
    if (token) {
      fetchSettings().then(setAppSettings).catch(() => {})
    }
  }, [token])

  const visibleTabs = TABS.filter(tab => tab.roles.includes(role))

  function openDetail(id) { setDetailId(id); setTab('detail') }
  function closeDetail()  { setDetailId(null); setTab('receipts') }

  function handleLogin(tok, r) {
    setToken(tok)
    setRole(r || 'admin')
  }

  async function handleLogout() {
    await apiLogout()
    setToken(null)
    setRole('admin')
    setTab('receipts')
    setDetailId(null)
  }

  return (
    <LangContext.Provider value={{ t, lang }}>
      <SettingsContext.Provider value={appSettings}>
        <ToastProvider>
          <ConfirmProvider>
            <OfflineBanner t={t} />
            {showPayment && <PaymentModal onClose={() => setShowPayment(false)} />}

            {/* ── Login gate ────────────────────────────────────────────── */}
            {!token ? (
              <LoginScreen onLogin={handleLogin} lang={lang} setLang={setLang} />
            ) : (
              <>
                {/* ── Header ──────────────────────────────────────────────── */}
                <header className="header">
                  <div className="header-brand">
                    <div className="header-logomark">
                      <Tent size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="header-name">Kassa</div>
                      <div className="header-tagline">Scouting</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                {tab !== 'detail' && (
                  <nav className="tab-nav">
                    {visibleTabs.map(({ id, Icon, labelKey }) => (
                      <button
                        key={id}
                        className={`tab-btn ${tab === id ? 'active' : ''}`}
                        onClick={() => setTab(id)}
                      >
                        <Icon size={15} strokeWidth={2} />
                        <span className="tab-label">{t(labelKey)}</span>
                      </button>
                    ))}
                  </nav>
                )}

                {/* ── Content ───────────────────────────────────────────── */}
                <main className="main-content">
                  {tab === 'receipts'  && <Bonnen    onOpenDetail={openDetail} />}
                  {tab === 'new'       && <NieuweBon onCreated={id => openDetail(id)} />}
                  {tab === 'overview'  && <Overzicht />}
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
