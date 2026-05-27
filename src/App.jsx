import { useState, createContext, useContext } from 'react'
import { translations } from './i18n'
import Bonnen from './components/Bonnen'
import NieuweBon from './components/NieuweBon'
import Producten from './components/Producten'
import BonDetail from './components/BonDetail'
import Overzicht from './components/Overzicht'

export const LangContext = createContext({ t: (k) => k, lang: 'nl' })
export const useLang = () => useContext(LangContext)

export default function App() {
  const [lang, setLang] = useState('nl')
  const [tab, setTab] = useState('receipts')
  const [detailId, setDetailId] = useState(null)

  const t = (key) => translations[lang]?.[key] ?? key

  function openDetail(id) {
    setDetailId(id)
    setTab('detail')
  }

  function closeDetail() {
    setDetailId(null)
    setTab('receipts')
  }

  return (
    <LangContext.Provider value={{ t, lang }}>
      <header className="header">
        <h1>🏕️ Kassa</h1>
        <div className="lang-switcher">
          <button
            className={`lang-btn ${lang === 'nl' ? 'active' : ''}`}
            onClick={() => setLang('nl')}
          >
            NL
          </button>
          <button
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
      </header>

      {tab !== 'detail' && (
        <nav className="tab-nav">
          <button
            className={`tab-btn ${tab === 'receipts' ? 'active' : ''}`}
            onClick={() => setTab('receipts')}
          >
            🧾 {t('receipts')}
          </button>
          <button
            className={`tab-btn ${tab === 'new' ? 'active' : ''}`}
            onClick={() => setTab('new')}
          >
            ➕ {t('new_receipt')}
          </button>
          <button
            className={`tab-btn ${tab === 'products' ? 'active' : ''}`}
            onClick={() => setTab('products')}
          >
            📦 {t('products')}
          </button>
          <button
            className={`tab-btn ${tab === 'overview' ? 'active' : ''}`}
            onClick={() => setTab('overview')}
          >
            📊 {t('overview')}
          </button>
        </nav>
      )}

      <main className="main-content">
        {tab === 'receipts' && <Bonnen onOpenDetail={openDetail} />}
        {tab === 'new' && <NieuweBon onCreated={(id) => openDetail(id)} />}
        {tab === 'products' && <Producten />}
        {tab === 'overview' && <Overzicht />}
        {tab === 'detail' && detailId && (
          <BonDetail id={detailId} onBack={closeDetail} />
        )}
      </main>
    </LangContext.Provider>
  )
}
