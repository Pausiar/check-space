import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Sparkles, Eraser, Trash2, Package, Globe, Download, History, Bug, Image, HardDrive,
  FolderOpen, ShieldCheck, ShieldAlert, Info
} from 'lucide-react'
import ConfirmDialog from './actions/ConfirmDialog'
import { useFileActions } from '../context/FileActions'
import { useScan } from '../context/ScanContext'
import { useI18n } from '../i18n'
import './Cleanup.css'

const KIND_ICONS = {
  temp: Eraser,
  winTemp: Eraser,
  windowsUpdate: Download,
  windowsOld: History,
  crashDumps: Bug,
  deliveryOptimization: Download,
  thumbnails: Image,
  browserCache: Globe,
  recycleBin: Trash2,
  nodeModules: Package,
  userCache: HardDrive
}

const ACTION_KEYS = {
  clearContents: 'actionClearContents',
  emptyRecycleBin: 'actionEmptyRecycleBin',
  trash: 'actionTrash'
}

/** Name of the folder that contains `.../project/node_modules`. */
function projectName(p) {
  const parts = p.split(/[\\/]+/).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || p
}

export default function Cleanup({ dataVersion }) {
  const { t, fmt } = useI18n()
  const { applyMeta } = useScan()
  const { openFolder, notify, forgetPaths } = useFileActions()
  const [items, setItems] = useState(null)
  const [pending, setPending] = useState(null) // suggestion awaiting confirmation
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let alive = true
    window.api
      .getCleanup()
      .then((list) => alive && setItems(Array.isArray(list) ? list : []))
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [dataVersion])

  const totalAll = useMemo(() => (items || []).reduce((sum, s) => sum + s.size, 0), [items])

  const titleOf = useCallback((s) => {
    if (s.kind === 'nodeModules') return t('cleanup.title_nodeModules', { project: projectName(s.path) })
    if (s.kind === 'browserCache' && s.label) return t('cleanup.title_browserCacheOf', { label: s.label })
    const key = `cleanup.title_${s.kind}`
    const text = t(key)
    return text === key ? s.label || s.kind : text
  }, [t])

  const descOf = useCallback((s) => {
    const key = `cleanup.desc_${s.kind}`
    const text = t(key)
    return text === key ? '' : text
  }, [t])

  const reasonFor = (code) => {
    switch (code) {
      case 'NOT_FOUND':
        return t('cleanup.errNotFound')
      case 'NO_SCAN':
        return t('cleanup.errNoScan')
      case 'PROTECTED':
        return t('cleanup.errProtected')
      case 'EBUSY':
        return t('cleanup.errBusy')
      case 'EPERM':
      case 'EACCES':
        return t('cleanup.errPerm')
      default:
        return t('cleanup.errOther', { error: code || '?' })
    }
  }

  const run = async () => {
    const s = pending
    if (!s || busyId) return
    setBusyId(s.id)
    try {
      const res = await window.api.runCleanup(s.id)
      setPending(null)
      if (res?.ok) {
        forgetPaths([s.path])
        applyMeta(res.meta)
        const size = fmt.bytes(res.freed || 0)
        const message =
          s.action === 'trash'
            ? t('cleanup.doneTrash', { size })
            : s.action === 'emptyRecycleBin'
              ? t('cleanup.doneEmptyBin', { size })
              : t('cleanup.doneClear', { size })
        if (res.failed > 0) {
          notify({ kind: 'warning', message, lines: [t('cleanup.skipped', { count: res.failed })] })
        } else {
          notify({ kind: 'success', message })
        }
      } else {
        notify({ kind: 'error', message: t('cleanup.failed', { reason: reasonFor(res?.error) }) })
        // The scan may have changed under us: refresh the list
        applyMeta(res?.meta)
      }
    } catch (err) {
      setPending(null)
      notify({ kind: 'error', message: t('cleanup.failed', { reason: err?.message || String(err) }) })
    } finally {
      setBusyId(null)
    }
  }

  const cancelPending = () => {
    if (!busyId) setPending(null)
  }

  const confirmTitle = (s) =>
    s.action === 'emptyRecycleBin'
      ? t('cleanup.confirmEmptyBin')
      : s.action === 'trash'
        ? t('cleanup.confirmTrash', { name: titleOf(s) })
        : t('cleanup.confirmClear', { name: titleOf(s) })

  return (
    <div className="cleanup">
      <div className="file-list-panel">
        <div className="file-list-header">
          <Sparkles size={16} />
          <h3>{t('cleanup.title')}</h3>
          {items && items.length > 0 && (
            <span className="header-badge">{t('cleanup.totalRecoverable', { size: fmt.bytes(totalAll) })}</span>
          )}
        </div>
        {items === null && <div className="panel-empty">{t('cleanup.loading')}</div>}
        {items && items.length === 0 && (
          <div className="panel-empty">
            <div>{t('cleanup.emptyTitle')}</div>
            <div className="cleanup-empty-hint">{t('cleanup.emptyHint')}</div>
          </div>
        )}
        {items && items.length > 0 && <p className="cleanup-intro">{t('cleanup.intro')}</p>}
      </div>

      {items && items.length > 0 && (
        <div className="cleanup-grid">
          {items.map((s) => {
            const Icon = KIND_ICONS[s.kind] || Sparkles
            const busy = busyId === s.id
            const desc = descOf(s)
            return (
              <div className="cleanup-card" key={s.id}>
                <div className="cleanup-card-head">
                  <span className="cleanup-icon"><Icon size={18} /></span>
                  <div className="cleanup-card-title">
                    <strong>{titleOf(s)}</strong>
                    <span
                      className={`cleanup-risk ${s.risk}`}
                      title={t(s.risk === 'safe' ? 'cleanup.riskSafeHint' : 'cleanup.riskCautionHint')}
                    >
                      {s.risk === 'safe' ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                      {t(s.risk === 'safe' ? 'cleanup.riskSafe' : 'cleanup.riskCaution')}
                    </span>
                  </div>
                  <div className="cleanup-size">{fmt.bytes(s.size)}</div>
                </div>
                {desc && <p className="cleanup-desc">{desc}</p>}
                <div className="cleanup-meta">
                  <span>{t('common.files', { count: s.files })}</span>
                  {s.alloc > 0 && s.alloc !== s.size && (
                    <>
                      <span className="stat-sep">·</span>
                      <span>{t('cleanup.sizeOnDisk', { size: fmt.bytes(s.alloc) })}</span>
                    </>
                  )}
                </div>
                <div className="cleanup-path" title={s.path}>{s.path}</div>
                <div className="cleanup-actions">
                  <button className="btn-secondary" onClick={() => openFolder(s.path)} disabled={!!busyId}>
                    <FolderOpen size={14} />
                    {t('cleanup.open')}
                  </button>
                  <button
                    className={s.action === 'trash' ? 'btn-secondary' : 'btn-danger-solid'}
                    onClick={() => setPending(s)}
                    disabled={!!busyId}
                  >
                    {busy ? t('cleanup.working') : t(`cleanup.${ACTION_KEYS[s.action] || 'actionClearContents'}`)}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pending && (
        <ConfirmDialog
          title={confirmTitle(pending)}
          danger={pending.action !== 'trash'}
          busy={!!busyId}
          busyLabel={t('cleanup.working')}
          confirmLabel={t(
            pending.action === 'emptyRecycleBin'
              ? 'cleanup.confirmEmptyBinButton'
              : pending.action === 'trash'
                ? 'cleanup.confirmTrashButton'
                : 'cleanup.confirmClearButton'
          )}
          onConfirm={run}
          onCancel={cancelPending}
        >
          <ul className="fa-item-list">
            <li>
              <div className="fa-item-info">
                <span className="fa-item-name">{titleOf(pending)}</span>
                <span className="fa-item-path" title={pending.path}>{pending.path}</span>
              </div>
              <span className="fa-item-size">
                {t('cleanup.confirmSize', { size: fmt.bytes(pending.size), files: t('common.files', { count: pending.files }) })}
              </span>
            </li>
          </ul>
          <div className={pending.action === 'trash' ? 'fa-note' : 'fa-warning'}>
            {pending.action === 'trash' ? <Info size={16} /> : <ShieldAlert size={16} />}
            <span>
              {t(
                pending.action === 'emptyRecycleBin'
                  ? 'cleanup.explainEmptyBin'
                  : pending.action === 'trash'
                    ? 'cleanup.explainTrash'
                    : 'cleanup.explainClear'
              )}
            </span>
          </div>
        </ConfirmDialog>
      )}
    </div>
  )
}
