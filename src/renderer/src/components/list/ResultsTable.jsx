import { useCallback, useMemo } from 'react'
import { File, Folder, Lock } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useFileActions } from '../../context/FileActions'
import { pathSep } from '../../utils/paths'
import { HEADER_HEIGHT, ROW_HEIGHT, useVirtualRows } from './useVirtualRows'
import { useRowSelection } from './useRowSelection'

/** Parent folder of a path, split so the last two segments are always visible. */
function splitDir(path) {
  const i = path.lastIndexOf(pathSep)
  if (i <= 0) return { full: path.slice(0, i + 1) || path, head: '', tail: path.slice(0, i + 1) || path }
  const dir = path.slice(0, i)
  const j = dir.lastIndexOf(pathSep, dir.lastIndexOf(pathSep) - 1)
  if (j <= 0) return { full: dir, head: '', tail: dir }
  return { full: dir, head: dir.slice(0, j), tail: dir.slice(j) }
}

export default function ResultsTable({ response, searching, metric, onOpenFolder }) {
  const { t, fmt } = useI18n()
  const actions = useFileActions()
  const results = response?.results
  const rows = useMemo(() => (results || []).map((entry) => ({ entry })), [results])
  const virt = useVirtualRows(rows.length)

  const onOpen = useCallback(
    (entry) => {
      if (entry.type === 'dir') onOpenFolder(entry.path)
      else actions.showInFolder(entry.path)
    },
    [onOpenFolder, actions]
  )
  const sel = useRowSelection(rows, { onOpen, scrollToIndex: virt.scrollToIndex })

  const sizeLabel = metric === 'alloc' ? t('common.sizeOnDisk') : t('common.size')

  if (!response) return <div className="panel-empty">{t('list.searching')}</div>

  const items = []
  for (let i = virt.start; i < virt.end; i++) {
    const entry = rows[i].entry
    const isDir = entry.type === 'dir'
    const selected = actions.isSelected(entry.path)
    const dir = splitDir(entry.path)
    const cls = ['list-row', 'list-grid-results', selected ? 'selected' : '', sel.focusPath === entry.path ? 'focused' : '']
      .filter(Boolean)
      .join(' ')
    items.push(
      <div
        key={entry.path}
        className={cls}
        style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
        role="row"
        aria-selected={selected}
        onClick={(e) => sel.onRowClick(e, i)}
        onDoubleClick={() => sel.onRowDouble(i)}
        onContextMenu={(e) => sel.onRowContext(e, i)}
      >
        <div className="lc lc-name">
          {isDir ? <Folder size={15} className="row-icon folder" /> : <File size={15} className="row-icon" />}
          <span className="row-name" title={entry.name}>{entry.name}</span>
          {!isDir && entry.locked && (
            <span className="row-badge" title={t('common.locked')}>
              <Lock size={11} />
            </span>
          )}
        </div>
        <div className="lc lc-dir muted" title={dir.full}>
          <span className="dir-head">{dir.head}</span>
          <span className="dir-tail">{dir.tail}</span>
        </div>
        <div className={`lc right ${entry.hardlink ? 'muted' : ''}`} title={entry.hardlink ? t('common.hardlink') : undefined}>
          {fmt.bytes(entry[metric] || 0)}
        </div>
        <div className="lc right muted">{fmt.date(entry.mtime)}</div>
      </div>
    )
  }

  return (
    <div className="list-results">
      <div className="list-results-bar">
        <strong>{t('list.matches', { count: response.total })}</strong>
        {response.truncated && (
          <span className="muted">{t('list.truncated', { shown: response.results.length })}</span>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="panel-empty">{t('list.noResults')}</div>
      ) : (
        <div
          className={`list-scroll ${searching ? 'busy' : ''}`}
          ref={virt.ref}
          onScroll={virt.onScroll}
          tabIndex={0}
          role="grid"
          aria-label={t('list.resultsLabel')}
          onKeyDown={(e) => sel.onKeyDown(e)}
        >
          <div className="list-inner">
            <div className="list-header list-grid-results" role="row" style={{ height: HEADER_HEIGHT }}>
              <div className="list-th" role="columnheader"><span>{t('common.name')}</span></div>
              <div className="list-th" role="columnheader"><span>{t('common.path')}</span></div>
              <div className="list-th right" role="columnheader"><span>{sizeLabel}</span></div>
              <div className="list-th right" role="columnheader"><span>{t('common.modified')}</span></div>
            </div>
            <div className="list-body" style={{ height: virt.totalHeight }} role="rowgroup">
              {items}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
