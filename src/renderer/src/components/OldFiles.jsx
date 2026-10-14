import { useMemo } from 'react'
import { Clock } from 'lucide-react'
import { useI18n } from '../i18n'
import { FileListRow } from './LargestFiles'
import './FileLists.css'

export default function OldFiles({ files, metric = 'size' }) {
  const { t, fmt } = useI18n()
  const total = useMemo(
    () => (files ? files.reduce((sum, f) => sum + (f[metric] ?? 0), 0) : 0),
    [files, metric]
  )

  const header = (
    <div className="file-list-header">
      <Clock size={16} />
      <h3>{t('files.oldTitle')}</h3>
      {files?.length > 0 && (
        <span className="header-badge">
          {t('files.oldTotal', { count: files.length, size: fmt.bytes(total) })}
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
        <div className="panel-empty">{t('files.oldEmpty')}</div>
      </div>
    )
  }

  return (
    <div className="file-list-panel">
      {header}
      <div className="file-list">
        {files.map((entry, i) => (
          <FileListRow
            key={entry.path}
            entry={entry}
            rank={i + 1}
            metric={metric}
            extra={
              <span className="file-age" title={fmt.date(entry.mtime)}>
                {fmt.timeAgo(entry.mtime)}
              </span>
            }
          />
        ))}
      </div>
    </div>
  )
}
