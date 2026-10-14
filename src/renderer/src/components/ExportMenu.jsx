import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, ChevronDown, FileSpreadsheet, FileJson } from 'lucide-react'
import { useFileActions } from '../context/FileActions'
import { useI18n } from '../i18n'
import './ExportMenu.css'

export default function ExportMenu() {
  const { t } = useI18n()
  const { notify } = useFileActions()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    const onBlur = () => setOpen(false)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const run = useCallback(async (format) => {
    setOpen(false)
    setBusy(true)
    try {
      const r = await window.api.exportReport(format)
      if (r?.ok) notify({ kind: 'success', message: t('export.done'), lines: [r.path] })
      else if (!r?.cancelled) notify({ kind: 'error', message: t('export.failed', { error: r?.error || '?' }) })
    } catch (err) {
      notify({ kind: 'error', message: t('export.failed', { error: err?.message || String(err) }) })
    } finally {
      setBusy(false)
    }
  }, [notify, t])

  return (
    <div className="export-menu" ref={rootRef}>
      <button
        className="btn-secondary"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('export.hint')}
      >
        <Download size={14} />
        {busy ? t('export.exporting') : t('export.button')}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="export-menu-list" role="menu">
          <button role="menuitem" className="export-menu-item" onClick={() => run('csv')}>
            <FileSpreadsheet size={14} />
            <span>
              {t('export.csv')}
              <small>{t('export.csvHint')}</small>
            </span>
          </button>
          <button role="menuitem" className="export-menu-item" onClick={() => run('json')}>
            <FileJson size={14} />
            <span>
              {t('export.json')}
              <small>{t('export.jsonHint')}</small>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
