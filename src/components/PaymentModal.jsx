import { useState } from 'react'
import { ExternalLink, Copy, Check, X } from 'lucide-react'
import { useLang } from '../LangContext'
import { useSettings } from '../SettingsContext'
import { PAYMENT_URL, PAYMENT_NAME } from '../paymentConfig'

export default function PaymentModal({ onClose }) {
  const { t } = useLang()
  const settings = useSettings()
  const [copied, setCopied] = useState(false)

  // Use saved settings, fall back to config defaults
  const url  = settings.paymentUrl  || PAYMENT_URL
  const name = settings.paymentName || PAYMENT_NAME

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=12&data=${encodeURIComponent(url)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box payment-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="payment-modal-header">
          <span className="payment-modal-title">{t('payment_title')}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 6px' }}>
            <X size={15} />
          </button>
        </div>

        <p className="payment-modal-hint">{t('payment_hint')}</p>

        {/* QR code */}
        <div className="payment-qr-wrap">
          <img
            src={qrSrc}
            alt="QR betaalverzoek"
            width={200}
            height={200}
            className="payment-qr"
          />
        </div>

        {/* Description */}
        <p className="payment-modal-desc">
          {name.split('\n').map((line, i) => (
            <span key={i}>{line}{i < name.split('\n').length - 1 && <br />}</span>
          ))}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-full btn-lg"
            style={{ textDecoration: 'none', justifyContent: 'center' }}
          >
            <ExternalLink size={15} />
            {t('payment_open')}
          </a>
          <button className="btn btn-outline btn-full" onClick={copyLink}>
            {copied
              ? <><Check size={14} /> {t('payment_copied')}</>
              : <><Copy size={14} /> {t('payment_copy')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
