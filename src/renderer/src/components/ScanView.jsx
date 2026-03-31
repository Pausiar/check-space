import { useState, useCallback, useMemo, useEffect } from 'react'
import { ArrowLeft, Square, RotateCw, Map, FileText, PieChart, Clock, Copy } from 'lucide-react'
import TreemapChart from './TreemapChart'
import BarSummary from './BarSummary'
import Breadcrumb from './Breadcrumb'
import LargestFiles from './LargestFiles'
import FileTypes from './FileTypes'
import OldFiles from './OldFiles'
import Duplicates from './Duplicates'
import { formatBytes, formatNumber, truncatePath } from '../utils/format'

const TABS = [
  { id: 'treemap', label: 'Treemap', icon: Map },
  { id: 'largest', label: 'Largest Files', icon: FileText },
  { id: 'types', label: 'File Types', icon: PieChart },
  { id: 'old', label: 'Old Files', icon: Clock },
  { id: 'duplicates', label: 'Duplicates', icon: Copy }
]

export default function ScanView({ drive, status, tree, stats, extras, progress, onCancel, onRescan, onBack }) {
  const [navPath, setNavPath] = useState([])
  const [activeTab, setActiveTab] = useState('treemap')

  useEffect(() => {
    if (status === 'scanning') {
      setNavPath([])
      setActiveTab('treemap')
    }
  }, [status])

  // Auto-save cache when scan completes
  useEffect(() => {
    if (status === 'complete' && tree && stats && drive) {
      window.api.cacheSave(drive.letter, { tree, stats, extras, savedAt: Date.now() })
    }
  }, [status, tree, stats, extras, drive])

  const currentNode = navPath.length > 0 ? navPath[navPath.length - 1] : tree

  const barItems = useMemo(() => {
    if (!currentNode || !currentNode.children) return []
    const items = [...currentNode.children]
    const childrenSize = currentNode.children.reduce((sum, c) => sum + c.size, 0)
    const filesSize = currentNode.size - childrenSize
    if (filesSize > 0) {
      items.push({ name: 'Files', path: '__files__', size: filesSize })
    }
    return items
  }, [currentNode])

  const handleNavigate = useCallback((node) => {
    setNavPath((prev) => [...prev, node])
  }, [])

  const handleBreadcrumbNav = useCallback((index) => {
    if (index === 0) {
      setNavPath([])
    } else {
      setNavPath((prev) => prev.slice(0, index))
    }
  }, [])

  const breadcrumbPath = tree
    ? [{ name: drive.letter + ':', path: tree.path }, ...navPath]
    : []

  const handleBack = useCallback(() => {
    if (activeTab !== 'treemap') {
      setActiveTab('treemap')
    } else if (navPath.length > 0) {
      setNavPath((prev) => prev.slice(0, -1))
    } else {
      onBack()
    }
  }, [navPath, onBack, activeTab])

  const progressPercent = Math.round((progress || 0) * 100)

  return (
    <div className="scan-view">
      <div className="scan-header">
        <button className="btn-icon" onClick={handleBack} title="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="scan-header-title">
          <h2>
            {status === 'scanning' ? 'Analyzing' : 'Results for'} {drive.letter}:\
            {drive.label && <span className="drive-label-small"> {drive.label}</span>}
          </h2>
        </div>
        <div className="scan-header-actions">
          {status === 'scanning' ? (
            <button className="btn-secondary" onClick={onCancel}>
              <Square size={14} />
              Cancel
            </button>
          ) : (
            <button className="btn-secondary" onClick={onRescan}>
              <RotateCw size={14} />
              Rescan
            </button>
          )}
        </div>
      </div>

      {status === 'complete' && (
        <div className="tab-bar">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isDisabled = tab.id !== 'treemap' && !extras
            return (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                disabled={isDisabled}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>
      )}

      {status === 'complete' && activeTab === 'treemap' && tree && (
        <Breadcrumb path={breadcrumbPath} onNavigate={handleBreadcrumbNav} />
      )}

      <div className="scan-content">
        {activeTab === 'treemap' && (
          <>
            <TreemapChart
              tree={currentNode}
              isScanning={status === 'scanning'}
              onNavigate={status === 'complete' ? handleNavigate : undefined}
            />
            {currentNode && barItems.length > 0 && (
              <BarSummary items={barItems} />
            )}
          </>
        )}

        {activeTab === 'largest' && extras && (
          <LargestFiles files={extras.largestFiles} />
        )}

        {activeTab === 'types' && extras && (
          <FileTypes types={extras.fileTypes} />
        )}

        {activeTab === 'old' && extras && (
          <OldFiles files={extras.oldFiles} />
        )}

        {activeTab === 'duplicates' && extras && (
          <Duplicates duplicates={extras.duplicates} />
        )}
      </div>

      <div className="scan-footer">
        {status === 'scanning' && stats && (
          <>
            <div className="scan-status">
              <span className="scan-dot" />
              <span className="scan-current-path">
                {truncatePath(stats.currentFolder)}
              </span>
              <span className="scan-percent">{progressPercent}%</span>
            </div>
            <div className="scan-stats">
              <span>{formatNumber(stats.foldersScanned)} folders</span>
              <span className="stat-sep">·</span>
              <span>{formatNumber(stats.filesFound)} files</span>
              <span className="stat-sep">·</span>
              <span>{formatBytes(stats.totalSize)}</span>
            </div>
            <div className="scan-progress-bar">
              <div
                className="scan-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        )}
        {status === 'complete' && stats && (
          <div className="scan-stats-final">
            <span>{formatBytes(drive.usedSpace)} used</span>
            <span className="stat-sep">·</span>
            <span>{formatBytes(drive.freeSpace)} free</span>
            <span className="stat-sep">·</span>
            <span>{formatBytes(drive.totalSize)} total</span>
            <span className="stat-sep">·</span>
            <span>{formatNumber(stats.foldersScanned)} folders, {formatNumber(stats.filesFound)} files scanned</span>
          </div>
        )}
      </div>
    </div>
  )
}
