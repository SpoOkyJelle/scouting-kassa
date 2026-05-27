import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

const CFG = {
  success: { Icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  error:   { Icon: AlertCircle,  color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  info:    { Icon: Info,         color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200)
  }, [])

  function dismiss(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(({ id, message, type }) => {
          const { Icon, color, bg, border } = CFG[type] ?? CFG.info
          return (
            <div key={id} className="toast" style={{ background: bg, borderColor: border }}>
              <Icon size={15} color={color} strokeWidth={2.5} />
              <span className="toast-msg">{message}</span>
              <button className="toast-close" onClick={() => dismiss(id)}>
                <X size={13} color="#64748B" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}
