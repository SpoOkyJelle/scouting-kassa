import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useLang } from '../LangContext'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

export default function KioskScreen({ total, name, onClose }) {
  const { t } = useLang()

  // Allow Escape to close
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="kiosk-overlay">
      <div className="kiosk-inner">
        {name && <div className="kiosk-name">{name}</div>}
        <div className="kiosk-label">{t('total')}</div>
        <div className="kiosk-total">{fmt(total)}</div>
        <button className="kiosk-close-btn" onClick={onClose}>
          <X size={18} />
          {t('kiosk_back')}
        </button>
      </div>
    </div>
  )
}
