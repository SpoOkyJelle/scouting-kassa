import { createContext, useContext, useState, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useLang } from '../LangContext'

const ConfirmCtx = createContext(null)
export const useConfirm = () => useContext(ConfirmCtx)

export function ConfirmProvider({ children }) {
  const { t } = useLang()
  const [state, setState] = useState(null)

  const confirm = useCallback(
    message => new Promise(resolve => setState({ message, resolve })),
    [],
  )

  function close(result) {
    state?.resolve(result)
    setState(null)
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={() => close(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon-wrap">
              <AlertTriangle size={22} color="#D97706" />
            </div>
            <p className="modal-message">{state.message}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => close(false)}>
                {t('cancel')}
              </button>
              <button className="btn btn-danger" onClick={() => close(true)}>
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}
