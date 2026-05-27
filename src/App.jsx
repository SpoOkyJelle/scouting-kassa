import { useState, createContext, useContext } from 'react'
import { Tent, FileText, PlusCircle, Package, BarChart2 } from 'lucide-react'
import { translations } from './i18n'
import Bonnen    from './components/Bonnen'
import NieuweBon from './components/NieuweBon'
import Producten from './components/Producten'
import BonDetail from './components/BonDetail'
import Overzicht from './components/Overzicht'

export const LangContext = createContext({ t: k => k, lang: 'nl' })
export const useLang = () => useContext(LangContext)

const TABS = [
  { id: 'receipts', Icon: FileText,   labelKey: 'receipts'    },
  { id: 'new',      Icon: PlusCircle, labelKey: 'new_receipt' },
  { id: 'products', Icon: Package,    labelKey: 'products'    },
  { id: 'overview', Icon: BarChart2,  labelKey: 'overview'    },
]

export default function App() {
  const [lang, setLang]       = useState('nl')
  const [tab, setTab]         = useState('receipts')
  const [detailId, setDetailId] = useState(null)

  const t = key => translations[lang]?.[key] ?? key

  function openDetail(id) { setDetailId(id); setTab('detail') }
  function closeDetail()  { setDetailId(null); setTab('receipts') }

  return (
    <LangContext.Provider value={{ t, lang }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
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

        <div className="lang-switcher">
          <button className={`lang-btn ${lang === 'nl' ? 'active' : ''}`} onClick={() => setLang('nl')}>NL</button>
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
        </div>
      </header>

      {/* ── Tab nav ─────────────────────────────────────────────────────── */}
      {tab !== 'detail' && (
        <nav className="tab-nav">
          {TABS.map(({ id, Icon, labelKey }) => (
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

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="main-content">
        {tab === 'receipts' && <Bonnen    onOpenDetail={openDetail} />}
        {tab === 'new'      && <NieuweBon onCreated={id => openDetail(id)} />}
        {tab === 'products' && <Producten />}
        {tab === 'overview' && <Overzicht />}
        {tab === 'detail' && detailId && <BonDetail id={detailId} onBack={closeDetail} />}
      </main>
    </LangContext.Provider>
  )
}
