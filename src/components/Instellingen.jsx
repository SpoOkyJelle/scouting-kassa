import { useState, useEffect, useRef } from 'react'
import { Globe, QrCode, ExternalLink, Moon, Shield, Save, HardDrive, Upload, Download, ImageIcon, Trash2, Users, Plus, Pencil, Check, X, Eye, EyeOff } from 'lucide-react'
import { useLang } from '../LangContext'
import { updateSettings, fetchBackup, restoreBackup, fetchEmployees, createEmployee, updateEmployee, deleteEmployee } from '../api'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'
import AccountDashboard from './AccountDashboard'

function SettingsCard({ Icon, label, color = 'var(--primary)', children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      marginBottom: '0.85rem',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--s50)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={14} color={color} strokeWidth={2.3} />
        </div>
        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--s800)' }}>{label}</span>
      </div>
      <div style={{ padding: '1rem' }}>
        {children}
      </div>
    </div>
  )
}

export default function Instellingen({ settings, onSave, lang, setLang, darkMode, setDarkMode, role }) {
  const { t }     = useLang()
  const showToast = useToast()
  const confirm   = useConfirm()
  const fileRef   = useRef()
  const logoRef   = useRef()

  const [paymentUrl,  setPaymentUrl]  = useState(settings.paymentUrl  ?? '')
  const [paymentName, setPaymentName] = useState(settings.paymentName ?? '')
  const [saving, setSaving] = useState(false)
  const [fontSize, setFontSizeState] = useState(() => localStorage.getItem('kassa_fontsize') || 'normal')

  // Medewerkers state
  const [employees, setEmployees]       = useState([])
  const [empForm, setEmpForm]           = useState(null) // null | { id?, name, pin }
  const [empSaving, setEmpSaving]       = useState(false)
  const [empPinVisible, setEmpPinVisible] = useState(false)
  const [showPins, setShowPins]         = useState(false)

  useEffect(() => {
    if (role === 'admin') fetchEmployees().then(setEmployees).catch(() => {})
  }, [role])

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
    <div style={{ maxWidth: 560 }}>

      {/* ── Account & Abonnement ─────────────────────────────────────────── */}
      {role === 'admin' && <AccountDashboard />}

      {/* ── Logo ────────────────────────────────────────────────────────── */}
      {role === 'admin' && (
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

      {/* ── Taal ────────────────────────────────────────────────────────── */}
      <SettingsCard Icon={Globe} label={t('settings_language')} color="#2563EB">
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

      {/* ── Weergave ────────────────────────────────────────────────────── */}
      <SettingsCard Icon={Moon} label={t('settings_appearance')} color="#7C3AED">
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

      {/* ── Rollen ──────────────────────────────────────────────────────── */}
      <SettingsCard Icon={Shield} label={t('settings_roles')} color="#D97706">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: role === 'admin' ? 10 : 0 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{t('your_role')}:</span>
          <span className={`role-badge ${role === 'admin' ? 'role-admin' : 'role-cashier'}`}>
            {role === 'admin' ? t('role_admin') : t('role_cashier')}
          </span>
        </div>
        {role === 'admin' && (
          <div style={{
            background: 'var(--s50)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 10px',
            fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6,
            fontFamily: 'monospace',
          }}>
            {t('cashier_pin_hint')}
          </div>
        )}
      </SettingsCard>

      {/* ── Backup & Herstel ────────────────────────────────────────────── */}
      {role === 'admin' && (
        <SettingsCard Icon={HardDrive} label={t('settings_backup_section')} color="#7C3AED">
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
      )}

      {/* ── Betaalverzoek ───────────────────────────────────────────────── */}
      {role === 'admin' && (
        <SettingsCard Icon={QrCode} label={t('settings_payment_section')} color="#16A34A">
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
      )}

      {/* ── Medewerkers ───────────────────────────────────────────────────── */}
      {role === 'admin' && (
        <SettingsCard Icon={Users} label={t('employees_title')} color="#7C3AED">
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.85rem' }}>
            {t('employees_hint')}
          </p>

          {/* Lijst */}
          {employees.length > 0 && (
            <div style={{
              border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
              marginBottom: '0.75rem',
            }}>
              {employees.map((emp, idx) => (
                <div key={emp.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '0.6rem 0.85rem',
                  borderTop: idx > 0 ? '1px solid var(--s100)' : 'none',
                  background: 'var(--surface)',
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: emp.active === false ? 'var(--s100)' : '#EDE9FE',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: emp.active === false ? 'var(--muted)' : '#7C3AED' }}>
                      {emp.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: emp.active === false ? 'var(--muted)' : 'var(--s800)' }}>
                      {emp.name}
                      {emp.active === false && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--muted)' }}>(inactief)</span>}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                      PIN: {showPins ? emp.pin : '●'.repeat(emp.pin?.length || 4)}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '3px 6px' }}
                    onClick={() => { setEmpForm({ id: emp.id, name: emp.name, pin: emp.pin, active: emp.active !== false }); setEmpPinVisible(false) }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '3px 6px', color: 'var(--danger)' }}
                    onClick={async () => {
                      const ok = await confirm(t('confirm_delete'))
                      if (!ok) return
                      await deleteEmployee(emp.id)
                      setEmployees(prev => prev.filter(e => e.id !== emp.id))
                      showToast(t('toast_deleted'))
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* PIN tonen toggle */}
          {employees.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ gap: 5, marginBottom: '0.6rem', color: 'var(--muted)' }}
              onClick={() => setShowPins(v => !v)}
            >
              {showPins ? <EyeOff size={12} /> : <Eye size={12} />}
              {showPins ? t('employees_hide_pins') : t('employees_show_pins')}
            </button>
          )}

          {/* Formulier toevoegen / bewerken */}
          {empForm ? (
            <div style={{
              border: '1px solid var(--primary)', borderRadius: 10,
              padding: '0.85rem', background: 'var(--s50)',
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--s700)', marginBottom: '0.6rem' }}>
                {empForm.id ? t('employees_edit') : t('employees_add')}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                <div style={{ flex: '2 1 150px' }}>
                  <label className="form-label">{t('employees_name')}</label>
                  <input
                    className="form-input"
                    placeholder={t('employees_name_ph')}
                    value={empForm.name}
                    onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div style={{ flex: '1 1 110px' }}>
                  <label className="form-label">PIN</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      type={empPinVisible ? 'text' : 'password'}
                      inputMode="numeric"
                      placeholder="1234"
                      value={empForm.pin}
                      onChange={e => setEmpForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                      style={{ paddingRight: 32 }}
                    />
                    <button
                      type="button"
                      onClick={() => setEmpPinVisible(v => !v)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}
                    >
                      {empPinVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              </div>
              {empForm.id && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem', color: 'var(--s700)', marginBottom: '0.6rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={empForm.active !== false}
                    onChange={e => setEmpForm(f => ({ ...f, active: e.target.checked }))}
                  />
                  {t('employees_active')}
                </label>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!empForm.name?.trim() || !empForm.pin || empSaving}
                  style={{ gap: 4 }}
                  onClick={async () => {
                    if (!empForm.name?.trim() || !empForm.pin) return
                    setEmpSaving(true)
                    try {
                      if (empForm.id) {
                        const updated = await updateEmployee(empForm.id, { name: empForm.name.trim(), pin: empForm.pin, active: empForm.active !== false })
                        setEmployees(prev => prev.map(e => e.id === empForm.id ? updated : e))
                      } else {
                        const created = await createEmployee({ name: empForm.name.trim(), pin: empForm.pin })
                        setEmployees(prev => [...prev, created])
                      }
                      showToast(t('toast_saved'))
                      setEmpForm(null)
                    } catch (err) {
                      const msg = err?.message || ''
                      showToast(msg.includes('gebruik') ? t('employees_pin_conflict') : t('employees_error'), 'error')
                    }
                    setEmpSaving(false)
                  }}
                >
                  <Check size={13} /> {empSaving ? t('loading') : t('save')}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEmpForm(null)}>
                  <X size={13} /> {t('cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-outline btn-sm"
              style={{ gap: 5 }}
              onClick={() => { setEmpForm({ name: '', pin: '', active: true }); setEmpPinVisible(true) }}
            >
              <Plus size={13} /> {t('employees_add')}
            </button>
          )}
        </SettingsCard>
      )}
    </div>
  )
}
