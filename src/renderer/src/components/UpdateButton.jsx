import { useEffect, useRef, useState } from 'react'
import { Check, Download, Info, RotateCw, X } from 'lucide-react'
import { useI18n } from '../i18n'
import { useUpdate } from '../context/UpdateContext'
import './Update.css'

/**
 * Update indicator of the title bar and its panel.
 *
 * The panel is the whole update flow: check, download with progress, restart to
 * install. Nothing here links to GitHub; the main process fetches the installer.
 */
export default function UpdateButton() {
  const { t, fmt } = useI18n()
  const { update, check, download, install } = useUpdate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const announced = useRef(null)

  const status = update?.status
  const version = update?.version

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Announce a new version once: the panel opens so the update is not missed
  useEffect(() => {
    if (status !== 'available' && status !== 'downloaded') return
    if (announced.current === version) return
    announced.current = version
    setOpen(true)
  }, [status, version])

  if (!update || status === 'unsupported') return null

  const busy = status === 'checking' || status === 'downloading'
  const highlight = status === 'available' || status === 'downloaded'
  const percent = Math.round(update.percent || 0)

  let label = null
  let icon = <RotateCw size={13} className={status === 'checking' ? 'update-spin' : undefined} />
  if (status === 'downloading') {
    label = `${percent}%`
    icon = <Download size={13} />
  } else if (status === 'available') {
    label = t('updates.update')
    icon = <Download size={13} />
  } else if (status === 'downloaded') {
    label = t('updates.restartShort')
    icon = <RotateCw size={13} />
  } else if (status === 'up-to-date') {
    icon = <Check size={13} />
  }

  const title = status === 'available' && version ? t('updates.available', { version }) : t('updates.checkNow')

  return (
    <div className="update-root" ref={rootRef}>
      <button
        type="button"
        className={`update-trigger${highlight ? ' is-highlighted' : ''}${busy ? ' is-busy' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={title}
        aria-label={title}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {icon}
        {label && <span className="update-trigger-label">{label}</span>}
        {highlight && <span className="update-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="update-panel" role="dialog" aria-label={t('updates.title')}>
          <div className="update-panel-head">
            <h3>{t('updates.title')}</h3>
            <button type="button" className="btn-icon update-panel-close" onClick={() => setOpen(false)} title={t('common.close')} aria-label={t('common.close')}>
              <X size={14} />
            </button>
          </div>

          <p className="update-current">{t('updates.currentVersion', { version: update.currentVersion })}</p>

          {(status === 'idle' || status === 'up-to-date') && (
            <>
              <p className="update-message update-ok">
                <Check size={15} />
                {t('updates.upToDate')}
              </p>
              <p className="update-hint">{t('updates.upToDateHint')}</p>
              <div className="update-actions">
                <button type="button" className="btn-secondary" onClick={check}>
                  <RotateCw size={14} />
                  {t('updates.checkNow')}
                </button>
              </div>
            </>
          )}

          {status === 'checking' && (
            <p className="update-message">
              <RotateCw size={15} className="update-spin" />
              {t('updates.checking')}
            </p>
          )}

          {status === 'available' && (
            <>
              <p className="update-message update-available">
                <Download size={15} />
                {t('updates.available', { version })}
              </p>
              <p className="update-hint">{t('updates.availableHint')}</p>
              <div className="update-actions">
                <button type="button" className="btn-primary update-cta" onClick={download}>
                  {t('updates.download')}
                </button>
              </div>
            </>
          )}

          {status === 'downloading' && (
            <>
              <p className="update-message">
                <Download size={15} />
                {t('updates.downloading')}
              </p>
              <div
                className="update-progress"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('updates.downloading')}
              >
                <span className="update-progress-fill" style={{ width: `${percent}%` }} />
              </div>
              <p className="update-hint update-progress-detail">
                {t('updates.downloadingDetail', {
                  done: fmt.bytes(update.transferred || 0),
                  total: fmt.bytes(update.total || 0),
                  speed: `${fmt.bytes(update.bytesPerSecond || 0)}/s`
                })}
              </p>
            </>
          )}

          {status === 'downloaded' && (
            <>
              <p className="update-message update-ok">
                <Check size={15} />
                {t('updates.ready', { version })}
              </p>
              <p className="update-hint">{t('updates.readyHint')}</p>
              <div className="update-actions">
                <button type="button" className="btn-primary update-cta" onClick={install}>
                  <RotateCw size={14} />
                  {t('updates.restart')}
                </button>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <p className="update-message update-error">
                <Info size={15} />
                {t('updates.error')}
              </p>
              {update.error && <code className="update-error-detail">{update.error}</code>}
              <p className="update-hint">{t('updates.errorHint')}</p>
              <div className="update-actions">
                <button type="button" className="btn-secondary" onClick={check}>
                  <RotateCw size={14} />
                  {t('updates.retry')}
                </button>
              </div>
            </>
          )}

          <p className="update-footnote">{t('updates.autoCheckHint')}</p>
        </div>
      )}
    </div>
  )
}
