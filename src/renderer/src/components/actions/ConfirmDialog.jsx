import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useI18n } from '../../i18n'
import './actions.css'

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'

/**
 * Generic modal confirmation.
 * Props: title, children, confirmLabel, cancelLabel?, danger?, busy?, busyLabel?, icon?,
 *        onConfirm(), onCancel()
 * Esc cancels, Enter confirms (unless a button has the focus), Tab is trapped inside.
 */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
  busyLabel,
  onConfirm,
  onCancel
}) {
  const { t } = useI18n()
  const ref = useRef(null)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const handlers = useRef({ onConfirm, onCancel })
  handlers.current = { onConfirm, onCancel }

  // Focus the dialog on open, restore the previous focus on close
  useEffect(() => {
    const previous = document.activeElement
    ref.current?.focus()
    return () => {
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus()
    }
  }, [])

  // Esc is handled at window level (capture) so global shortcuts do not react to it
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (!busyRef.current) handlers.current.onCancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const onKeyDown = (e) => {
    if (e.key === 'Tab') {
      const nodes = [...ref.current.querySelectorAll(FOCUSABLE)]
      if (nodes.length === 0) {
        e.preventDefault()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === ref.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
      return
    }
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && !busyRef.current) {
      e.preventDefault()
      handlers.current.onConfirm()
    }
  }

  return createPortal(
    <div
      className="fa-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className="fa-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onKeyDown={onKeyDown}
      >
        <div className="fa-dialog-head">
          <span className={`fa-dialog-icon ${danger ? 'danger' : ''}`}>
            <AlertTriangle size={18} />
          </span>
          <h3>{title}</h3>
          <button className="btn-icon-sm" onClick={onCancel} disabled={busy} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>
        <div className="fa-dialog-body">{children}</div>
        <div className="fa-dialog-foot">
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel || t('actions.cancel')}
          </button>
          <button className={danger ? 'btn-danger-solid' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel || t('actions.working') : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
