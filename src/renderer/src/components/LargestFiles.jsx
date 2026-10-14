import { useMemo } from 'react'
import { FileText, FolderOpen, Link2, Lock, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n'
import { useFileActions } from '../context/FileActions'
import './FileLists.css'

/**
 * One file row with selection, reveal, delete and context menu.
 * Shared by LargestFiles and OldFiles. `extra` renders an optional cell (e.g. age).
 */
export function FileListRow({ entry, rank, metric, extra }) {
  const { t, fmt } = useI18n()
  const { isSelected, selectOnly, toggleSelect, requestDelete, showInFolder, openContextMenu } = useFileActions()
  const selected = isSelected(entry.path)
  const value = entry[metric] ?? 0

  return (
    <div
      className={`file-row file-row-item${selected ? ' selected' : ''}`}
      onClick={(e) => (e.ctrlKey ? toggleSelect(entry, true) : selectOnly(entry))}
      onContextMenu={(e) => {
        e.preventDefault()
        openContextMenu(e, entry)
      }}
    >
      <span className="file-rank">#{rank}</span>
      <div className="file-info">
        <span className="file-name-line">
          <span className="file-name" title={entry.name}>
            {entry.name}
          </span>
          {entry.hardlink && (
            <span className="file-row-badge" title={t('common.hardlink')}>
              <Link2 size={10} />
              {t('files.hardlinkBadge')}
            </span>
          )}
          {entry.locked && (
            <span className="file-row-badge" title={t('common.locked')}>
              <Lock size={10} />
              {t('files.lockedBadge')}
            </span>
          )}
        </span>
        <span className="file-path" title={entry.path}>
          {entry.path}
        </span>
      </div>
      {extra}
      <span className="file-size" title={entry.hardlink ? t('common.hardlink') : undefined}>
        {fmt.bytes(value)}
      </span>
      <div className="file-actions">
        <button
          type="button"
          className="btn-icon-sm"
          title={t('common.showInExplorer')}
          aria-label={t('common.showInExplorer')}
          onClick={(e) => {
            e.stopPropagation()
            showInFolder(entry.path)
          }}
        >
          <FolderOpen size={14} />
        </button>
        <button
          type="button"
          className="btn-icon-sm btn-danger"
          title={t('common.moveToTrash')}
          aria-label={t('common.moveToTrash')}
          onClick={(e) => {
            e.stopPropagation()
            requestDelete([entry])
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export default function LargestFiles({ files, metric = 'size' }) {
  const { t, fmt } = useI18n()
  const total = useMemo(
    () => (files ? files.reduce((sum, f) => sum + (f[metric] ?? 0), 0) : 0),
    [files, metric]
  )

  const header = (
    <div className="file-list-header">
      <FileText size={16} />
      <h3>{t('files.largestTitle')}</h3>
      {files?.length > 0 && (
        <span className="header-badge">
          {t('files.largestTotal', { count: files.length, size: fmt.bytes(total) })}
        </span>
      )}
    </div>
  )

  if (!files) {
    return (
      <div className="file-list-panel">
        {header}
        <div className="panel-empty">{t('common.loading')}</div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="file-list-panel">
        {header}
        <div className="panel-empty">{t('files.largestEmpty')}</div>
      </div>
    )
  }

  return (
    <div className="file-list-panel">
      {header}
      <div className="file-list">
        {files.map((entry, i) => (
          <FileListRow key={entry.path} entry={entry} rank={i + 1} metric={metric} />
        ))}
      </div>
    </div>
  )
}
