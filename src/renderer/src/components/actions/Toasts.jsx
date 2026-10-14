import { useEffect, useRef } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import { useI18n } from '../../i18n'
import './actions.css'

const ICONS = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info }

function Toast({ toast, onDismiss }) {
  const { t } = useI18n()
  const timer = useRef(null)
  const duration = toast.duration ?? (toast.kind === 'success' || toast.kind === 'info' ? 5000 : 9000)

  const start = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onDismiss(toast.id), duration)
  }
  useEffect(() => {
    start()
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id])

  const Icon = ICONS[toast.kind] || Info
  return (
    <div
      className={`fa-toast ${toast.kind || 'info'}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={start}
    >
      <Icon size={18} className="fa-toast-icon" />
      <div className="fa-toast-text">
        <div className="fa-toast-title">{toast.message}</div>
        {toast.lines?.length > 0 && (
          <ul>
            {toast.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </div>
      <button className="btn-icon-sm" onClick={() => onDismiss(toast.id)} aria-label={t('actions.dismiss')}>
        <X size={14} />
      </button>
    </div>
  )
}

/** toasts: [{ id, kind: 'success'|'warning'|'error'|'info', message, lines?, duration? }] */
export default function Toasts({ toasts, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div className="fa-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
