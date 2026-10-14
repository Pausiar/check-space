import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Search, Square, FolderSearch, Trash2, CheckSquare, AlertTriangle, RotateCw } from 'lucide-react'
import { useFileActions } from '../context/FileActions'
import { useI18n } from '../i18n'
import { isInside } from '../utils/paths'
import './Duplicates.css'

const MIN_SIZES = [
  { value: 100 * 1024, key: 'size_100kb' },
  { value: 1024 * 1024, key: 'size_1mb' },
  { value: 10 * 1024 * 1024, key: 'size_10mb' },
  { value: 100 * 1024 * 1024, key: 'size_100mb' }
]

const oldestOf = (files) => files.reduce((best, f) => ((f.mtime || 0) < (best.mtime || 0) ? f : best), files[0])
const asItem = (f) => ({ type: 'file', path: f.path, name: f.name, size: f.size, mtime: f.mtime })

export default function Duplicates({ dataVersion }) {
  const { t, fmt } = useI18n()
  const { selection, setSelection, toggleSelect, requestDelete, showInFolder, subscribeDeleted } = useFileActions()
  const [minSize, setMinSize] = useState(MIN_SIZES[1].value)
  const [phase, setPhase] = useState('idle') // 'idle' | 'running'
  const [progress, setProgress] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [result, setResult] = useState(null) // { groups, totalGroups, totalWasted, minSize }
  const [notice, setNotice] = useState(null) // 'cancelled' | 'failed'
  const [stale, setStale] = useState(false)
  const runningRef = useRef(false)
  const skipStaleRef = useRef(false)
  const firstVersionRef = useRef(true)

  // Progress events from the main process
  useEffect(() => window.api.onDuplicatesProgress((p) => setProgress(p)), [])

  // Stop the analysis if the tab is left
  useEffect(() => () => {
    if (runningRef.current) window.api.cancelDuplicates()
  }, [])

  // After a deletion the list is updated in place instead of forcing a new search
  useEffect(() => subscribeDeleted((paths) => {
    skipStaleRef.current = true
    const isGone = (p) => paths.some((g) => isInside(p, g))
    setResult((prev) => {
      if (!prev) return prev
      const groups = []
      let totalGroups = prev.totalGroups
      let totalWasted = prev.totalWasted
      for (const g of prev.groups) {
        const files = g.files.filter((f) => !isGone(f.path))
        if (files.length === g.files.length) {
          groups.push(g)
          continue
        }
        const wasted = files.length >= 2 ? g.size * (files.length - 1) : 0
        totalWasted -= g.wasted - wasted
        if (files.length >= 2) groups.push({ ...g, files, count: files.length, wasted })
        else totalGroups -= 1
      }
      return { ...prev, groups, totalGroups: Math.max(0, totalGroups), totalWasted: Math.max(0, totalWasted) }
    })
  }), [subscribeDeleted])

  // The tree changed for some other reason: the results may be outdated
  useEffect(() => {
    if (firstVersionRef.current) {
      firstVersionRef.current = false
      return
    }
    if (skipStaleRef.current) {
      skipStaleRef.current = false
      return
    }
    setStale(true)
  }, [dataVersion])

  const run = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setPhase('running')
    setProgress(null)
    setCancelling(false)
    setNotice(null)
    setStale(false)
    try {
      const res = await window.api.findDuplicates({ minSize })
      if (res?.cancelled) {
        setNotice('cancelled')
      } else if (!res) {
        setNotice('failed')
      } else {
        setResult({ ...res, minSize })
      }
    } catch {
      setNotice('failed')
    } finally {
      runningRef.current = false
      setPhase('idle')
      setProgress(null)
    }
  }, [minSize])

  const cancel = useCallback(() => {
    setCancelling(true)
    window.api.cancelDuplicates()
  }, [])

  const extrasOf = useCallback((group) => {
    const keep = oldestOf(group.files)
    return group.files.filter((f) => f !== keep).map(asItem)
  }, [])

  const selectGroupExtras = (group) => {
    const groupPaths = new Set(group.files.map((f) => f.path))
    const others = [...selection.values()].filter((it) => !groupPaths.has(it.path))
    setSelection([...others, ...extrasOf(group)])
  }

  const selectAllExtras = () => {
    if (!result) return
    setSelection(result.groups.flatMap(extrasOf))
  }

  const running = phase === 'running'
  const pct = useMemo(() => {
    if (!progress || !progress.total) return null
    return Math.min(100, Math.round((progress.done / progress.total) * 100))
  }, [progress])

  const progressLabel = () => {
    if (!progress) return t('duplicates.starting')
    if (progress.phase === 'quick') {
      return `${t('duplicates.phaseQuick')} · ${t('duplicates.phaseQuickCount', { done: progress.done, total: progress.total })}`
    }
    if (progress.phase === 'full') {
      return `${t('duplicates.phaseFull')} · ${t('duplicates.phaseFullCount', { done: fmt.bytes(progress.done), total: fmt.bytes(progress.total) })}`
    }
    return t('duplicates.phaseDone')
  }

  return (
    <div className="dupes">
      <div className="file-list-panel dupes-intro">
        <div className="file-list-header">
          <Copy size={16} />
          <h3>{t('duplicates.title')}</h3>
        </div>
        <div className="dupes-intro-body">
          <div>
            <div className="dupes-intro-title">{t('duplicates.introTitle')}</div>
            <p>{t('duplicates.introText')}</p>
          </div>
          <div className="dupes-controls">
            <label className="dupes-field">
              <span>{t('duplicates.minSize')}</span>
              <select value={minSize} onChange={(e) => setMinSize(Number(e.target.value))} disabled={running}>
                {MIN_SIZES.map((o) => (
                  <option key={o.value} value={o.value}>{t(`duplicates.${o.key}`)}</option>
                ))}
              </select>
            </label>
            {running ? (
              <button className="btn-secondary" onClick={cancel} disabled={cancelling}>
                <Square size={14} />
                {cancelling ? t('duplicates.cancelling') : t('duplicates.cancel')}
              </button>
            ) : (
              <button className="btn-primary" onClick={run}>
                <Search size={14} />
                {result ? t('duplicates.searchAgain') : t('duplicates.search')}
              </button>
            )}
          </div>
          {running && (
            <div className="dupes-progress" role="status">
              <div className="dupes-progress-label">{progressLabel()}</div>
              <div className="dupes-progress-bar">
                {pct != null ? (
                  <div className="dupes-progress-fill" style={{ width: `${pct}%` }} />
                ) : (
                  <div className="dupes-progress-indeterminate" />
                )}
              </div>
            </div>
          )}
          {notice && !running && (
            <div className={`dupes-notice ${notice === 'failed' ? 'danger' : ''}`}>{t(`duplicates.${notice}`)}</div>
          )}
        </div>
      </div>

      {result && (
        <>
          {stale && !running && (
            <div className="dupes-stale">
              <AlertTriangle size={16} />
              <span>{t('duplicates.stale')}</span>
              <button className="btn-link" onClick={run}>
                <RotateCw size={12} /> {t('duplicates.rerun')}
              </button>
            </div>
          )}

          {result.groups.length === 0 ? (
            <div className="file-list-panel">
              <div className="panel-empty">
                <div>{t('duplicates.none')}</div>
                <div className="dupes-empty-hint">{t('duplicates.noneHint')}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="dupes-summary">
                <div className="dupes-summary-text">
                  <strong>{t('duplicates.summary', { count: result.totalGroups })}</strong>
                  <span className="dupes-wasted">{t('duplicates.summaryWasted', { size: fmt.bytes(result.totalWasted) })}</span>
                  <span className="dupes-summary-min">{t('duplicates.summaryMin', { size: fmt.bytes(result.minSize) })}</span>
                </div>
                <button className="btn-secondary" onClick={selectAllExtras} title={t('duplicates.selectAllExtrasHint')}>
                  <CheckSquare size={14} />
                  {t('duplicates.selectAllExtras')}
                </button>
              </div>
              {result.totalGroups > result.groups.length && result.groups.length >= 1 && (
                <div className="dupes-truncated">
                  {t('duplicates.truncated', { shown: result.groups.length, total: result.totalGroups })}
                </div>
              )}

              {result.groups.map((group) => {
                const keep = oldestOf(group.files)
                return (
                  <div className="file-list-panel dupes-group" key={`${group.size}:${group.files[0].path}`}>
                    <div className="dupes-group-head">
                      <div className="dupes-group-title">
                        <strong>{t('duplicates.groupTitle', { count: group.count, size: fmt.bytes(group.size) })}</strong>
                        <span className="dupes-wasted">{t('duplicates.groupWasted', { size: fmt.bytes(group.wasted) })}</span>
                      </div>
                      <button className="btn-link" onClick={() => selectGroupExtras(group)}>
                        {t('duplicates.keepOldest')}
                      </button>
                    </div>
                    <div className="file-list">
                      {group.files.map((f) => {
                        const checked = selection.has(f.path)
                        return (
                          <div className={`file-row dupes-file ${checked ? 'selected' : ''}`} key={f.path}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelect(asItem(f))}
                              aria-label={t('duplicates.selectFile', { name: f.name })}
                            />
                            <div className="file-info">
                              <span className="file-name" title={f.name}>
                                {f.name}
                                {f === keep && <span className="dupes-badge">{t('duplicates.oldest')}</span>}
                              </span>
                              <span className="file-path" title={f.path}>{f.path}</span>
                            </div>
                            <span className="file-age">{t('duplicates.modified', { date: fmt.date(f.mtime) })}</span>
                            <div className="file-actions">
                              <button className="btn-icon-sm" onClick={() => showInFolder(f.path)} title={t('common.showInExplorer')}>
                                <FolderSearch size={15} />
                              </button>
                              <button className="btn-icon-sm btn-danger" onClick={() => requestDelete([asItem(f)])} title={t('common.moveToTrash')}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}
    </div>
  )
}
