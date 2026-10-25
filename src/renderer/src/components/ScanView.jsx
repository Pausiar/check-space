import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Square, RotateCw, Map as MapIcon, ListTree, FileText, PieChart, Clock, Copy, Sparkles,
  ShieldAlert, Info, History
} from 'lucide-react'
import MapView from './MapView'
import ListView from './ListView'
import Breadcrumb from './Breadcrumb'
import LargestFiles from './LargestFiles'
import FileTypes from './FileTypes'
import OldFiles from './OldFiles'
import Duplicates from './Duplicates'
import Cleanup from './Cleanup'
import ExportMenu from './ExportMenu'
import SelectionBar from './SelectionBar'
import { useScan } from '../context/ScanContext'
import { useFileActions } from '../context/FileActions'
import { useI18n } from '../i18n'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { crumbs, parentPath } from '../utils/paths'
import './ScanView.css'

const TABS = [
  { id: 'map', icon: MapIcon },
  { id: 'list', icon: ListTree },
  { id: 'largest', icon: FileText },
  { id: 'types', icon: PieChart },
  { id: 'old', icon: Clock },
  { id: 'duplicates', icon: Copy },
  { id: 'cleanup', icon: Sparkles }
]

const METRIC_KEY = 'metric'

function useSummary(enabled, metric, dataVersion) {
  const [summary, setSummary] = useState(null)
  useEffect(() => {
    if (!enabled) {
      setSummary(null)
      return
    }
    let alive = true
    window.api.getSummary({ metric }).then((s) => alive && setSummary(s))
    return () => {
      alive = false
    }
  }, [enabled, metric, dataVersion])
  return summary
}

export default function ScanView() {
  const { t, fmt } = useI18n()
  const { status, target, meta, live, startScan, cancelScan, close, dataVersion } = useScan()
  const { selection, requestDelete } = useFileActions()
  const [activeTab, setActiveTab] = useState('map')
  const [currentPath, setCurrentPath] = useState(null) // null = root
  const [appInfo, setAppInfo] = useState(null)
  const [metric, setMetricState] = useState(() => {
    try {
      return localStorage.getItem(METRIC_KEY) === 'alloc' ? 'alloc' : 'size'
    } catch {
      return 'size'
    }
  })
  const searchInputRef = useRef(null)

  const setMetric = useCallback((m) => {
    setMetricState(m)
    try {
      localStorage.setItem(METRIC_KEY, m)
    } catch {}
  }, [])

  const scanning = status === 'scanning'
  const hasResults = status === 'complete' || status === 'cancelled'
  const rootPath = meta?.rootPath || target?.path
  const rootName = meta?.rootName || target?.name || rootPath
  const summary = useSummary(hasResults, metric, dataVersion)

  useEffect(() => {
    window.api.getAppInfo().then(setAppInfo)
  }, [])

  // A new scan resets the navigation
  useEffect(() => {
    if (scanning) {
      setCurrentPath(null)
      setActiveTab('map')
    }
  }, [scanning])

  // If the current folder was deleted, go back to the closest existing ancestor
  useEffect(() => {
    if (!hasResults || !currentPath) return
    let alive = true
    ;(async () => {
      let p = currentPath
      while (p) {
        const v = await window.api.getView(p, { depth: 1, maxChildren: 1 })
        if (v) break
        p = parentPath(p, rootPath)
      }
      if (alive && p !== currentPath) setCurrentPath(p)
    })()
    return () => {
      alive = false
    }
  }, [dataVersion, hasResults, currentPath, rootPath])

  const navigate = useCallback((p) => {
    setCurrentPath(p && p !== rootPath ? p : null)
  }, [rootPath])

  const goUp = useCallback(() => {
    if (activeTab !== 'map' && activeTab !== 'list') return false
    if (!currentPath) return false
    setCurrentPath(parentPath(currentPath, rootPath))
    return true
  }, [activeTab, currentPath, rootPath])

  const handleBack = useCallback(() => {
    if (!goUp()) close()
  }, [goUp, close])

  const rescan = useCallback(() => {
    if (!scanning) startScan()
  }, [scanning, startScan])

  useKeyboardShortcuts({
    onUp: goUp,
    onDelete: () => {
      if (selection.size > 0) requestDelete([...selection.values()])
    },
    onDeletePermanent: () => {
      if (selection.size > 0) requestDelete([...selection.values()], { permanent: true })
    },
    onSearch: () => {
      setActiveTab('list')
      setTimeout(() => searchInputRef.current?.focus(), 0)
    },
    onRescan: rescan,
    onTab: (index) => {
      if (hasResults && TABS[index]) setActiveTab(TABS[index].id)
    },
    enabled: true
  })

  const breadcrumb = useMemo(
    () => (rootPath ? crumbs(rootPath, rootName, currentPath) : []),
    [rootPath, rootName, currentPath]
  )

  const progressPercent = live?.progress != null ? Math.round(live.progress * 100) : null
  const drive = meta?.drive || target?.drive
  const errorCount = summary?.errorCount || 0
  const showInaccessible = hasResults && errorCount > 0
  const canRelaunchAdmin = appInfo?.platform === 'win32' && !appInfo?.isAdmin

  return (
    <div className="scan-view">
      <div className="scan-header">
        <button className="btn-icon" onClick={handleBack} title={t('scan.back')}>
          <ArrowLeft size={20} />
        </button>
        <div className="scan-header-title">
          <h2>
            {scanning ? t('scan.analyzing', { name: rootName }) : t('scan.resultsFor', { name: rootName })}
            {target?.label && <span className="drive-label-small"> {target.label}</span>}
          </h2>
          {hasResults && meta && (
            <div className="scan-header-sub">
              {meta.fromCache ? (
                <span className="cache-chip" title={fmt.dateTime(meta.savedAt)}>
                  <History size={12} />
                  {t('scan.cachedResults', { ago: fmt.timeAgo(meta.savedAt) })}
                </span>
              ) : (
                <span>{t('scan.scannedAt', { date: fmt.dateTime(meta.savedAt) })}</span>
              )}
            </div>
          )}
        </div>
        <div className="scan-header-actions">
          {hasResults && (
            <div className="segmented" role="radiogroup" aria-label={t('scan.metric')}>
              <button
                role="radio"
                aria-checked={metric === 'size'}
                className={metric === 'size' ? 'active' : ''}
                onClick={() => setMetric('size')}
                title={t('scan.metricSizeHint')}
              >
                {t('common.size')}
              </button>
              <button
                role="radio"
                aria-checked={metric === 'alloc'}
                className={metric === 'alloc' ? 'active' : ''}
                onClick={() => setMetric('alloc')}
                title={t('scan.metricAllocHint')}
              >
                {t('common.sizeOnDisk')}
              </button>
            </div>
          )}
          {hasResults && <ExportMenu />}
          {scanning ? (
            <button className="btn-secondary" onClick={cancelScan}>
              <Square size={14} />
              {t('scan.cancel')}
            </button>
          ) : (
            <button className="btn-secondary" onClick={rescan} title="F5">
              <RotateCw size={14} />
              {meta?.fromCache ? t('scan.refresh') : t('scan.rescan')}
            </button>
          )}
        </div>
      </div>

      {status === 'cancelled' && (
        <div className="banner banner-warning">
          <Info size={16} />
          <span>{t('scan.cancelledBanner')}</span>
          <button className="btn-link" onClick={rescan}>{t('scan.rescan')}</button>
        </div>
      )}

      {status === 'error' && (
        <div className="banner banner-danger">
          <Info size={16} />
          <span>{t('scan.errorBanner')}</span>
          <button className="btn-link" onClick={rescan}>{t('common.retry')}</button>
        </div>
      )}

      {showInaccessible && (
        <div className="banner banner-info">
          <ShieldAlert size={16} />
          <span>{t('scan.inaccessible', { count: errorCount })}</span>
          {canRelaunchAdmin && (
            <button className="btn-link" onClick={() => window.api.relaunchAsAdmin()}>
              {t('scan.relaunchAdmin')}
            </button>
          )}
        </div>
      )}

      {hasResults && (
        <div className="tab-bar" role="tablist">
          {TABS.map((tab, i) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                title={`${t(`scan.tab_${tab.id}`)} (Ctrl+${i + 1})`}
              >
                <Icon size={14} />
                {t(`scan.tab_${tab.id}`)}
              </button>
            )
          })}
        </div>
      )}

      {hasResults && (activeTab === 'map' || activeTab === 'list') && breadcrumb.length > 1 && (
        <Breadcrumb path={breadcrumb} onNavigate={navigate} />
      )}

      <div className="scan-content">
        {(scanning || activeTab === 'map') && (
          <MapView
            rootPath={rootPath}
            currentPath={currentPath || rootPath}
            onNavigate={hasResults ? navigate : undefined}
            metric={metric}
            dataVersion={dataVersion}
            liveView={scanning ? live?.view : null}
            isScanning={scanning}
          />
        )}
        {hasResults && activeTab === 'list' && (
          <ListView
            rootPath={rootPath}
            currentPath={currentPath || rootPath}
            onNavigate={navigate}
            metric={metric}
            dataVersion={dataVersion}
            searchInputRef={searchInputRef}
          />
        )}
        {hasResults && activeTab === 'largest' && <LargestFiles files={summary?.largestFiles} metric={metric} />}
        {hasResults && activeTab === 'types' && <FileTypes types={summary?.fileTypes} metric={metric} />}
        {hasResults && activeTab === 'old' && <OldFiles files={summary?.oldFiles} metric={metric} />}
        {hasResults && activeTab === 'duplicates' && <Duplicates dataVersion={dataVersion} />}
        {hasResults && activeTab === 'cleanup' && <Cleanup dataVersion={dataVersion} />}
      </div>

      <SelectionBar />

      <div className="scan-footer">
        {scanning && (
          <>
            <div className="scan-status">
              <span className="scan-dot" />
              <span className="scan-current-path">
                {live?.phase === 'finalizing' ? t('scan.finalizing') : live?.stats?.currentFolder || t('scan.starting')}
              </span>
              {progressPercent != null && <span className="scan-percent">≈ {progressPercent}%</span>}
            </div>
            {live?.stats && (
              <div className="scan-stats">
                <span>{t('common.folders', { count: live.stats.dirs })}</span>
                <span className="stat-sep">·</span>
                <span>{t('common.files', { count: live.stats.files })}</span>
                <span className="stat-sep">·</span>
                <span>{fmt.bytes(live.stats[metric] ?? live.stats.size)}</span>
              </div>
            )}
            <div className="scan-progress-bar">
              {progressPercent != null ? (
                <div className="scan-progress-fill" style={{ width: `${progressPercent}%` }} />
              ) : (
                <div className="scan-progress-indeterminate" />
              )}
            </div>
          </>
        )}
        {hasResults && meta && (
          <div className="scan-stats-final">
            {drive && meta.isDrive && (
              <>
                <span>{t('scan.used', { size: fmt.bytes(drive.used) })}</span>
                <span className="stat-sep">·</span>
                <span>{t('scan.free', { size: fmt.bytes(drive.free) })}</span>
                <span className="stat-sep">·</span>
                <span>{t('scan.total', { size: fmt.bytes(drive.total) })}</span>
                <span className="stat-sep">·</span>
              </>
            )}
            <span>
              {t('scan.scannedSummary', {
                size: fmt.bytes(meta.stats[metric]),
                files: t('common.files', { count: meta.stats.files }),
                folders: t('common.folders', { count: meta.stats.dirs })
              })}
            </span>
            {meta.unaccounted > 0 && (
              <>
                <span className="stat-sep">·</span>
                <span title={t('common.systemSpaceHint')}>
                  {t('scan.unaccounted', { size: fmt.bytes(meta.unaccounted) })}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
