import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, FolderSearch, HardDrive, RefreshCw, ShieldAlert, Usb } from 'lucide-react'
import { useI18n } from '../i18n'
import { useScan } from '../context/ScanContext'
import './DriveSelector.css'

const DANGER_RATIO = 0.9

/** Windows letters are shown as "C:"; Linux mount points keep their path. */
function driveName(letter) {
  return String(letter).startsWith('/') ? String(letter) : `${letter}:`
}

function DriveCard({ drive, onOpen }) {
  const { t, fmt } = useI18n()
  const total = drive.totalSize || 0
  const used = drive.usedSpace || 0
  const ratio = total > 0 ? Math.min(1, used / total) : 0
  const hot = ratio > DANGER_RATIO

  return (
    <button type="button" className="drive-card" onClick={() => onOpen(drive)} title={drive.path}>
      <span className="drive-card-header">
        <span className="drive-letter">{driveName(drive.letter)}</span>
        {drive.label && <span className="drive-label">{drive.label}</span>}
        {drive.type === 'removable' && (
          <span className="drive-badge">
            <Usb size={11} />
            {t('drives.removable')}
          </span>
        )}
      </span>
      <span className="drive-bar-track" aria-hidden="true">
        <span className={`drive-bar-fill${hot ? ' danger' : ''}`} style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className="drive-card-info">
        <span>{t('drives.usedOf', { used: fmt.bytes(used), total: fmt.bytes(total) })}</span>
        <span className="drive-free">{t('drives.free', { size: fmt.bytes(drive.freeSpace || 0) })}</span>
        {drive.cachedAt && (
          <span className="drive-cached">{t('drives.lastAnalysis', { ago: fmt.timeAgo(drive.cachedAt) })}</span>
        )}
      </span>
    </button>
  )
}

export default function DriveSelector() {
  const { t } = useI18n()
  const { openTarget } = useScan()
  const [drives, setDrives] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null) // null | { detail }
  const [openError, setOpenError] = useState(false)
  const [appInfo, setAppInfo] = useState(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestRef.current
    setLoading(true)
    setError(null)
    let result
    try {
      result = await window.api.getDrives()
    } catch (err) {
      result = { drives: [], error: err?.message || String(err) }
    }
    if (id !== requestRef.current) return
    if (!result || result.error) {
      setError({ detail: result?.error || '' })
    } else {
      setDrives(Array.isArray(result.drives) ? result.drives : [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    return () => {
      requestRef.current++
    }
  }, [load])

  useEffect(() => {
    let alive = true
    window.api
      .getAppInfo()
      .then((info) => alive && setAppInfo(info))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const open = useCallback(
    async (target) => {
      setOpenError(false)
      try {
        await openTarget(target)
      } catch {
        setOpenError(true)
      }
    },
    [openTarget]
  )

  const openDrive = (drive) =>
    open({
      path: drive.path,
      name: driveName(drive.letter),
      label: drive.label || '',
      type: 'drive',
      drive: { total: drive.totalSize, free: drive.freeSpace, used: drive.usedSpace }
    })

  const pickFolder = async () => {
    setOpenError(false)
    let picked
    try {
      picked = await window.api.pickFolder()
    } catch {
      setOpenError(true)
      return
    }
    if (!picked) return
    open({ path: picked.path, name: picked.name, label: '', type: 'folder' })
  }

  const needsAdmin = !!appInfo && appInfo.platform === 'win32' && !appInfo.isAdmin

  let body
  if (error) {
    body = (
      <div className="drive-error" role="alert">
        <AlertTriangle size={20} />
        <span>{t('drives.loadError')}</span>
        {error.detail && <code>{error.detail}</code>}
        <button type="button" className="btn-secondary" onClick={load}>
          <RefreshCw size={14} />
          {t('common.retry')}
        </button>
      </div>
    )
  } else if (loading && drives.length === 0) {
    body = (
      <p className="drive-status" role="status">
        <span className="drive-spinner" aria-hidden="true" />
        {t('drives.detecting')}
      </p>
    )
  } else if (drives.length === 0) {
    body = <p className="drive-status">{t('drives.none')}</p>
  } else {
    body = (
      <div className="drive-grid">
        {drives.map((drive) => (
          <DriveCard key={drive.path || drive.letter} drive={drive} onOpen={openDrive} />
        ))}
      </div>
    )
  }

  return (
    <div className="drive-selector drive-screen">
      <div className="drive-screen-inner">
        <header className="drive-selector-header">
          <div className="logo">
            <HardDrive size={32} strokeWidth={1.5} />
          </div>
          <h1>{t('drives.appName')}</h1>
          <p className="subtitle">{t('drives.subtitle')}</p>
        </header>

        <section className="drive-section">
          <div className="drive-section-head">
            <h2 className="drive-section-title">{t('drives.drivesHeading')}</h2>
            <button
              type="button"
              className="btn-icon drive-refresh"
              onClick={load}
              disabled={loading}
              title={t('drives.refresh')}
              aria-label={t('drives.refresh')}
            >
              <RefreshCw size={16} className={loading ? 'drive-refresh-spin' : undefined} />
            </button>
          </div>
          {body}
        </section>

        <div className="drive-footer">
          <button type="button" className="btn-secondary" onClick={pickFolder}>
            <FolderSearch size={14} />
            {t('drives.analyzeFolder')}
          </button>
          {openError && (
            <p className="drive-inline-error" role="alert">
              {t('drives.openError')}
            </p>
          )}
          {needsAdmin && (
            <p className="drive-admin-hint">
              <ShieldAlert size={14} />
              <span>{t('drives.adminHint')}</span>
              <button type="button" className="btn-link" onClick={() => window.api.relaunchAsAdmin().catch(() => {})}>
                {t('drives.relaunchAdmin')}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
