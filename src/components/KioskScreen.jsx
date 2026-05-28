import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useLang } from '../LangContext'
import { useSettings } from '../SettingsContext'
import { PAYMENT_URL, PAYMENT_NAME } from '../paymentConfig'

const fmt = n => `€ ${parseFloat(n ?? 0).toFixed(2)}`

export default function KioskScreen({ total, name, onClose }) {
  const { t } = useLang()
  const settings  = useSettings()
  const payUrl    = settings.paymentUrl  || PAYMENT_URL
  const payName   = settings.paymentName || PAYMENT_NAME
  const qrSrc     = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=14&data=${encodeURIComponent(payUrl)}`

  // Allow Escape to close
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="kiosk-overlay">
      <div className="kiosk-inner">
        <div className="kiosk-label">{t('total')}</div>
        <div className="kiosk-total">{fmt(total)}</div>

        {/* QR code card */}
        {payUrl && (
          <div className="kiosk-qr-card">
            <img
              src={qrSrc}
              alt="QR betaalverzoek"
              width={220}
              height={220}
              className="kiosk-qr-img"
            />
            <p className="kiosk-qr-label">
              {t('payment_hint')}
            </p>
            {payName && (
              <p className="kiosk-qr-name">
                {payName.split('\n').map((line, i) => (
                  <span key={i}>{line}{i < payName.split('\n').length - 1 && <br />}</span>
                ))}
              </p>
            )}
          </div>
        )}

        <button className="kiosk-close-btn" onClick={onClose}>
          <X size={18} />
          {t('kiosk_back')}
        </button>
      </div>
    </div>
  )
}
