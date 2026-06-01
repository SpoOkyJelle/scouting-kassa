import { useState } from 'react'
import { Package, ShoppingCart } from 'lucide-react'
import { useLang } from '../LangContext'
import Producten from './Producten'
import InkoopBonnen from './InkoopBonnen'

export default function Beheer({ initialView = 'producten' }) {
  const { t }   = useLang()
  const [view, setView] = useState(initialView)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', background: 'var(--s100)', borderRadius: 8, padding: 3, gap: 2 }}>
        {[
          { key: 'producten', label: t('products'),   Icon: Package },
          { key: 'inkoop',    label: t('inkoop_tab'), Icon: ShoppingCart },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              flex: 1, border: 'none', borderRadius: 6, padding: '6px 14px',
              fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: view === key ? 'var(--surface)' : 'transparent',
              color: view === key ? 'var(--s800)' : 'var(--muted)',
              boxShadow: view === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon size={13} strokeWidth={2} /> {label}
          </button>
        ))}
      </div>

      {view === 'producten' && <Producten />}
      {view === 'inkoop'    && <InkoopBonnen />}
    </div>
  )
}
