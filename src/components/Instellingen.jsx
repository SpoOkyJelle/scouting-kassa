import { useState, useEffect, useRef } from 'react'
import { Globe, QrCode, ExternalLink, Moon, Save, KeyRound, HardDrive, Upload, Download, ImageIcon, Trash2, CreditCard, Lock, Sparkles } from 'lucide-react'
import { useLang } from '../LangContext'
import { planHasCapability } from '../plans'
import { updateSettings, changePin, fetchBackup, restoreBackup } from '../api'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'
import SettingsCard from './SettingsCard'
import CategoryEditor from './CategoryEditor'
import PromotionEditor from './PromotionEditor'
import TeamManager from './TeamManager'
import PlanSelector from './PlanSelector'

export default function Instellingen({ settings, onSave, lang, setLang, darkMode, setDarkMode, role, account, onAccountChange }) {
  const { t }     = useLang()
  const showToast = useToast()
  const confirm   = useConfirm()
  const fileRef   = useRef()
  const logoRef   = useRef()

  // ── Tab navigation ──────────────────────────────────────────────────────
  const isAdmin = role === 'admin'
  const tabs = isAdmin
    ? [
        { id: 'account',    labelKey: 'settings_group_account' },
        { id: 'branding',   labelKey: 'settings_group_branding' },
        { id: 'assortment', labelKey: 'settings_group_assortment' },
        { id: 'payments',   labelKey: 'settings_group_payments' },
        { id: 'security',   labelKey: 'settings_group_security' },
        { id: 'display',    labelKey: 'settings_group_display' },
      ]
    : [{ id: 'display', labelKey: 'settings_group_display' }]

  const [activeTab, setActiveTab] = useState(tabs[0].id)

  const canSumup = planHasCapability(account?.plan, 'sumup')

  const [paymentUrl,  setPaymentUrl]  = useState(settings.paymentUrl  ?? '')
  const [paymentName, setPaymentName] = useState(settings.paymentName ?? '')
  const [saving, setSaving] = useState(false)
  const [sumupSaving, setSumupSaving] = useState(false)
  const [fontSize, setFontSizeState] = useState(() => localStorage.getItem('kassa_fontsize') || 'normal')

  const sumupEnabled = settings.sumupEnabled ?? false
  const [sumupMerchant, setSumupMerchant] = useState(settings.sumupMerchantCode ?? '')
  const [sumupReader,   setSumupReader]   = useState(settings.sumupReaderId ?? '')
  const [sumupApiKey,   setSumupApiKey]   = useState('')
  const [sumupCfgSaving, setSumupCfgSaving] = useState(false)

  // PIN state
  const [pinTarget,  setPinTarget]  = useState('admin')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin,     setNewPin]     = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinSaving,  setPinSaving]  = useState(false)

  function applyFontSize(key) {
    const map = { small: '90%', normal: '100%', large: '115%' }
    document.documentElement.style.fontSize = map[key]
    localStorage.setItem('kassa_fontsize', key)
    setFontSizeState(key)
  }

  useEffect(() => {
    setPaymentUrl(settings.paymentUrl  ?? '')
    setPaymentName(settings.paymentName ?? '')
  }, [settings.paymentUrl, settings.paymentName])

  useEffect(() => {
    setSumupMerchant(settings.sumupMerchantCode ?? '')
    setSumupReader(settings.sumupReaderId ?? '')
  }, [settings.sumupMerchantCode, settings.sumupReaderId])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateSettings({ paymentUrl, paymentName })
      onSave(updated)
      showToast(t('toast_saved'))
    } catch {
      showToast(t('toast_no_access'), 'error')
    }
    setSaving(false)
  }

  async function toggleSumup() {
    const next = !sumupEnabled
    setSumupSaving(true)
    try {
      const updated = await updateSettings({ sumupEnabled: next })
      onSave(updated)
      showToast(t('toast_saved'))
    } catch {
      showToast(t('toast_no_access'), 'error')
    }
    setSumupSaving(false)
  }

  async function handleSumupConfig(e) {
    e.preventDefault()
    setSumupCfgSaving(true)
    try {
      const payload = { sumupMerchantCode: sumupMerchant.trim(), sumupReaderId: sumupReader.trim() }
      if (sumupApiKey.trim()) payload.sumupApiKey = sumupApiKey.trim()
      const updated = await updateSettings(payload)
      onSave(updated)
      setSumupApiKey('')
      showToast(t('toast_saved'))
    } catch {
      showToast(t('toast_no_access'), 'error')
    }
    setSumupCfgSaving(false)
  }

  async function handleChangePin(e) {
    e.preventDefault()
    if (newPin.length < 4) return showToast(t('settings_pin_min'), 'error')
    if (newPin !== confirmPin) return showToast(t('settings_pin_mismatch'), 'error')
    setPinSaving(true)
    try {
      await changePin({ currentPin, newPin, target: pinTarget })
      showToast(t('settings_pin_success'))
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
    } catch (err) {
      showToast(err.message.includes('403') ? t('settings_pin_wrong') : err.message, 'error')
    }
    setPinSaving(false)
  }

  async function handleBackupDownload() {
    const data = await fetchBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `kassa-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleLogoFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Geen afbeelding', 'error'); return }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = ev => {
        const img = new Image()
        img.onload = () => {
          // Header logo: max 480px breed, 120px hoog
          const hCanvas = document.createElement('canvas')
          const scale   = Math.min(480 / img.width, 120 / img.height, 1)
          hCanvas.width  = Math.round(img.width  * scale)
          hCanvas.height = Math.round(img.height * scale)
          hCanvas.getContext('2d').drawImage(img, 0, 0, hCanvas.width, hCanvas.height)

          // Favicon: 64×64 gecentreerd met transparante achtergrond
          const fCanvas = document.createElement('canvas')
          fCanvas.width = 64; fCanvas.height = 64
          const ctx = fCanvas.getContext('2d')
          const s = Math.min(60 / img.width, 60 / img.height)
          const w = img.width * s, h = img.height * s
          ctx.drawImage(img, (64 - w) / 2, (64 - h) / 2, w, h)

          resolve({ logoDataUrl: hCanvas.toDataURL('image/png', 0.85), faviconDataUrl: fCanvas.toDataURL('image/png', 0.9) })
        }
        img.onerror = reject
        img.src = ev.target.result
      }
      reader.readAsDataURL(file)
    })

    const updated = await updateSettings(dataUrl)
    onSave(updated)
    showToast(t('toast_saved'))
    e.target.value = ''
  }

  async function handleLogoRemove() {
    const updated = await updateSettings({ logoDataUrl: null, faviconDataUrl: null })
    onSave(updated)
    showToast(t('toast_saved'))
  }

  async function handleRestoreFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const ok = await confirm(t('settings_backup_confirm'))
    if (!ok) { e.target.value = ''; return }
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await restoreBackup(data)
      showToast(t('settings_backup_success'))
    } catch {
      showToast('Ongeldig bestand', 'error')
    }
    e.target.value = ''
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>

      {/* ── Tab bar (echoes the main menu bar, underline-active) ─────────── */}
      <div className="settings-tabs no-print" role="tablist">
        {tabs.map(({ id, labelKey }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`settings-tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <div className="settings-panel" key={activeTab}>

      {/* ── Account & abonnement ───────────────────────────────────────── */}
      {isAdmin && activeTab === 'account' && (
        <>
          <PlanSelector account={account} onChange={onAccountChange} />
          <TeamManager />
        </>
      )}

      {/* ── Huisstijl ───────────────────────────────────────────────────── */}
      {isAdmin && activeTab === 'branding' && (
        <SettingsCard Icon={ImageIcon} label={t('settings_logo_section')} color="#F59E0B">
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
            {t('settings_logo_hint')}
          </p>

          {settings.logoDataUrl ? (
            <div style={{ marginBottom: '0.85rem' }}>
              <div style={{
                background: 'var(--s50)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '0.75rem', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                minHeight: 60, marginBottom: 8,
              }}>
                <img
                  src={settings.logoDataUrl}
                  alt="Logo preview"
                  style={{ maxHeight: 52, maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={() => logoRef.current?.click()} style={{ gap: 6, flex: '1 1 auto' }}>
              <Upload size={14} /> {t('settings_logo_upload')}
            </button>
            {settings.logoDataUrl && (
              <button className="btn btn-ghost" onClick={handleLogoRemove} style={{ gap: 6, color: 'var(--danger)' }}>
                <Trash2 size={14} /> {t('settings_logo_remove')}
              </button>
            )}
            <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoFile} />
          </div>
        </SettingsCard>
      )}

      {/* ── Assortiment ─────────────────────────────────────────────────── */}
      {isAdmin && activeTab === 'assortment' && (
        <>
          <CategoryEditor settings={settings} onSave={onSave} />
          <PromotionEditor settings={settings} onSave={onSave} />
        </>
      )}

      {/* ── Betalingen ──────────────────────────────────────────────────── */}
      {isAdmin && activeTab === 'payments' && (
        <>
          {/* Betaalverzoek */}
          <SettingsCard Icon={QrCode} label={t('settings_payment_section')} color="#2E6B4E">
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">{t('settings_payment_url')}</label>
                <input
                  className="form-input"
                  type="url"
                  placeholder={t('settings_payment_url_ph')}
                  value={paymentUrl}
                  onChange={e => setPaymentUrl(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('settings_payment_name')}</label>
                <textarea
                  className="form-input"
                  placeholder={t('settings_payment_name_ph')}
                  value={paymentName}
                  onChange={e => setPaymentName(e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical', minHeight: 60 }}
                />
              </div>

              {paymentUrl && (
                <div style={{
                  background: 'var(--s50)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 10px', marginBottom: '0.85rem',
                }}>
                  <span className="form-label" style={{ display: 'block', marginBottom: 5 }}>
                    {t('settings_payment_preview')}
                  </span>
                  <a
                    href={paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: '0.76rem', color: 'var(--primary)', textDecoration: 'none',
                      wordBreak: 'break-all',
                    }}
                  >
                    <ExternalLink size={12} />
                    {paymentUrl.length > 60 ? paymentUrl.slice(0, 60) + '…' : paymentUrl}
                  </a>
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={saving} style={{ gap: 6 }}>
                <Save size={14} />
                {saving ? t('loading') : t('save')}
              </button>
            </form>
          </SettingsCard>

          {/* SumUp Cloud */}
          <SettingsCard Icon={CreditCard} label={t('settings_sumup_section')} color="#0070F3">
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
              {t('settings_sumup_hint')}
            </p>

            {!canSumup ? (
              <div style={{
                background: 'var(--s50)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, background: 'var(--accent-lt)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Lock size={14} color="var(--accent)" strokeWidth={2.3} />
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--s700)', lineHeight: 1.5, margin: 0 }}>
                    {t('settings_sumup_locked')}
                  </p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('account')} style={{ gap: 6 }}>
                  <Sparkles size={14} /> {t('settings_feature_upgrade')}
                </button>
              </div>
            ) : (
            <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.87rem', color: 'var(--s800)' }}>
                  {t('settings_sumup_toggle')}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                  {sumupEnabled ? t('settings_sumup_on') : t('settings_sumup_off')}
                </div>
              </div>
              <button
                className={`toggle-switch${sumupEnabled ? ' on' : ''}`}
                onClick={toggleSumup}
                disabled={sumupSaving}
                aria-label={t('settings_sumup_toggle')}
              >
                <span className="toggle-knob" />
              </button>
            </div>

            {sumupEnabled && (
              <form onSubmit={handleSumupConfig} style={{ marginTop: '0.9rem', borderTop: '1px solid var(--border)', paddingTop: '0.9rem' }}>
                <div className="form-group">
                  <label className="form-label">{t('settings_sumup_merchant')}</label>
                  <input
                    className="form-input"
                    placeholder="MXXXXXXX"
                    value={sumupMerchant}
                    onChange={e => setSumupMerchant(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('settings_sumup_reader')}</label>
                  <input
                    className="form-input"
                    placeholder="rdr_XXXXXXXXXXXX"
                    value={sumupReader}
                    onChange={e => setSumupReader(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('settings_sumup_apikey')}</label>
                  <input
                    className="form-input"
                    type="password"
                    autoComplete="new-password"
                    placeholder={settings.sumupApiKeySet ? '•••••••• ' + t('settings_sumup_key_set') : 'sup_sk_...'}
                    value={sumupApiKey}
                    onChange={e => setSumupApiKey(e.target.value)}
                  />
                  <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>
                    {t('settings_sumup_apikey_hint')}
                  </p>
                </div>
                <button type="submit" className="btn btn-primary" disabled={sumupCfgSaving} style={{ gap: 6 }}>
                  <Save size={14} />
                  {sumupCfgSaving ? t('loading') : t('save')}
                </button>
              </form>
            )}
            </>
            )}
          </SettingsCard>
        </>
      )}

      {/* ── Beveiliging & data ──────────────────────────────────────────── */}
      {isAdmin && activeTab === 'security' && (
        <>
          {/* PIN wijzigen */}
          <SettingsCard Icon={KeyRound} label={t('settings_pin_section')} color="#DC2626">
            <div style={{
              background: 'var(--s50)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 10px', marginBottom: '0.85rem',
              fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6,
            }}>
              {t('cashier_pin_hint')}
            </div>
            {/* Kies PIN type */}
            <div style={{ display: 'flex', gap: 6, marginBottom: '0.85rem' }}>
              {[
                { key: 'admin',   label: t('settings_pin_admin') },
                { key: 'cashier', label: t('settings_pin_cashier') },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`btn btn-sm ${pinTarget === key ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setPinTarget(key)}
                  style={{ flex: 1 }}
                >
                  {label}
                </button>
              ))}
            </div>
            <form onSubmit={handleChangePin} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="form-input"
                type="password"
                inputMode="numeric"
                placeholder={t('settings_pin_current')}
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value)}
                required
              />
              <input
                className="form-input"
                type="password"
                inputMode="numeric"
                placeholder={t('settings_pin_new')}
                value={newPin}
                onChange={e => setNewPin(e.target.value)}
                minLength={4}
                required
              />
              <input
                className="form-input"
                type="password"
                inputMode="numeric"
                placeholder={t('settings_pin_confirm')}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={pinSaving} style={{ gap: 6 }}>
                <KeyRound size={14} />
                {pinSaving ? t('loading') : t('save')}
              </button>
            </form>
          </SettingsCard>

          {/* Backup & Herstel */}
          <SettingsCard Icon={HardDrive} label={t('settings_backup_section')} color="#8A6D9B">
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
              {t('settings_backup_hint')}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={handleBackupDownload} style={{ gap: 6, flex: '1 1 auto' }}>
                <Download size={14} /> {t('settings_backup_download')}
              </button>
              <button className="btn btn-outline" onClick={() => fileRef.current?.click()} style={{ gap: 6, flex: '1 1 auto' }}>
                <Upload size={14} /> {t('settings_backup_restore')}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleRestoreFile}
              />
            </div>
          </SettingsCard>
        </>
      )}

      {/* ── Weergave & taal (alle rollen) ──────────────────────────────── */}
      {activeTab === 'display' && (
        <>
          <SettingsCard Icon={Globe} label={t('settings_language')} color="#3C7A86">
            <div style={{ display: 'flex', gap: 8 }}>
              {['nl', 'en'].map(code => (
                <button
                  key={code}
                  className={`btn ${lang === code ? 'btn-primary' : 'btn-outline'}`}
                  style={{ minWidth: 90, gap: 6 }}
                  onClick={() => setLang(code)}
                >
                  {code === 'nl' ? '🇳🇱  Nederlands' : '🇬🇧  English'}
                </button>
              ))}
            </div>
          </SettingsCard>

          <SettingsCard Icon={Moon} label={t('settings_appearance')} color="#8A6D9B">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.87rem', color: 'var(--s800)' }}>
                  {t('dark_mode')}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                  {darkMode ? 'Donkere modus actief' : 'Lichte modus actief'}
                </div>
              </div>
              <button
                className={`toggle-switch${darkMode ? ' on' : ''}`}
                onClick={() => setDarkMode(d => !d)}
                aria-label={t('dark_mode')}
              >
                <span className="toggle-knob" />
              </button>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '0.75rem 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, fontSize: '0.87rem', color: 'var(--s800)' }}>Tekstgrootte</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ key: 'small', label: 'Klein' }, { key: 'normal', label: 'Normaal' }, { key: 'large', label: 'Groot' }].map(({ key, label }) => (
                  <button
                    key={key}
                    className={`btn btn-sm ${fontSize === key ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => applyFontSize(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </SettingsCard>
        </>
      )}
      </div>
    </div>
  )
}
