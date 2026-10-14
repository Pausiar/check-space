import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, File, Folder, HardDrive, Lock, MoreHorizontal } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useFileActions } from '../../context/FileActions'
import { HEADER_HEIGHT, ROW_HEIGHT, useVirtualRows } from './useVirtualRows'
import { useRowSelection } from './useRowSelection'

const VIEW_OPTS = { depth: 1, maxChildren: 500 }
const INDENT = 16

function sortEntries(list, sort, metric) {
  const dir = sort.dir === 'asc' ? 1 : -1
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
  const value = {
    name: null,
    size: (e) => e[metric] || 0,
    files: (e) => (e.type === 'dir' ? e.files || 0 : -1),
    modified: (e) => e.mtime || 0
  }[sort.key]
  const real = list.filter((e) => e.type === 'dir' || e.type === 'file')
  real.sort((a, b) => {
    if (!value) return dir * byName(a, b)
    const d = value(a) - value(b)
    return d !== 0 ? dir * d : byName(a, b)
  })
  // Synthetic rows always go last
  const system = list.filter((e) => e.type === 'system')
  const other = list.filter((e) => e.type === 'other')
  return [...real, ...system, ...other]
}

export default function TreeTable({ currentPath, onNavigate, metric, dataVersion }) {
  const { t, fmt } = useI18n()
  const actions = useFileActions()
  const [data, setData] = useState(null) // { root, map: Map<path, Entry[]> }
  const [expanded, setExpanded] = useState(() => new Set())
  const [sort, setSort] = useState({ key: 'size', dir: 'desc' })
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded
  const dataRef = useRef(data)
  dataRef.current = data
  const reqRef = useRef(0)

  // Collapse everything when the table root changes
  const lastRoot = useRef(currentPath)
  useEffect(() => {
    if (lastRoot.current !== currentPath) {
      lastRoot.current = currentPath
      setExpanded(new Set())
      expandedRef.current = new Set()
    }
  }, [currentPath])

  // (Re)load the root and every expanded folder that is reachable
  useEffect(() => {
    const id = ++reqRef.current
    const opts = { ...VIEW_OPTS, metric }
    ;(async () => {
      const root = await window.api.getView(currentPath, opts)
      if (id !== reqRef.current) return
      const map = new Map()
      if (!root) {
        setData({ root: null, map })
        return
      }
      map.set(root.path, root.children || [])
      let level = [root.children || []]
      while (level.length) {
        const dirs = level.flat().filter((c) => c.type === 'dir' && expandedRef.current.has(c.path))
        if (!dirs.length) break
        const views = await Promise.all(dirs.map((d) => window.api.getView(d.path, opts)))
        if (id !== reqRef.current) return
        level = []
        views.forEach((v, i) => {
          if (!v) return
          map.set(dirs[i].path, v.children || [])
          level.push(v.children || [])
        })
      }
      setData({ root, map })
    })().catch(() => {})
    return () => {
      // Responses of an older load are ignored by the id check
    }
  }, [currentPath, metric, dataVersion])

  const toggle = useCallback(
    async (entry, force) => {
      const open = force ?? !expandedRef.current.has(entry.path)
      const next = new Set(expandedRef.current)
      if (open) next.add(entry.path)
      else next.delete(entry.path)
      expandedRef.current = next
      setExpanded(next)
      if (open && dataRef.current && !dataRef.current.map.has(entry.path)) {
        const id = reqRef.current
        const v = await window.api.getView(entry.path, { ...VIEW_OPTS, metric })
        if (id !== reqRef.current || !v) return
        setData((d) => (d ? { ...d, map: new Map(d.map).set(entry.path, v.children || []) } : d))
      }
    },
    [metric]
  )

  const rows = useMemo(() => {
    if (!data?.root) return []
    const out = []
    const walk = (list, depth, parent) => {
      const total = parent[metric] || 0
      for (const entry of sortEntries(list, sort, metric)) {
        out.push({ entry, depth, parentPath: parent.path, parentTotal: total })
        if (entry.type === 'dir' && expanded.has(entry.path)) {
          const kids = data.map.get(entry.path)
          if (kids) walk(kids, depth + 1, entry)
        }
      }
    }
    walk(data.map.get(data.root.path) || [], 0, data.root)
    return out
  }, [data, expanded, sort, metric])

  const virt = useVirtualRows(rows.length)

  const onOpen = useCallback(
    (entry) => {
      if (entry.type === 'dir') onNavigate(entry.path)
      else if (entry.type === 'file') actions.showInFolder(entry.path)
    },
    [onNavigate, actions]
  )

  const sel = useRowSelection(rows, { onOpen, scrollToIndex: virt.scrollToIndex })

  const treeKeys = (e, cur) => {
    const row = rows[cur]
    if (e.key === 'ArrowRight') {
      if (row.entry.type !== 'dir' || !row.entry.childCount) return true
      if (!expanded.has(row.entry.path)) toggle(row.entry, true)
      else if (rows[cur + 1] && rows[cur + 1].parentPath === row.entry.path) sel.moveTo(cur + 1, false)
      return true
    }
    if (e.key === 'ArrowLeft') {
      if (row.entry.type === 'dir' && expanded.has(row.entry.path)) {
        toggle(row.entry, false)
      } else {
        const p = rows.findIndex((r) => r.entry.path === row.parentPath)
        if (p >= 0) sel.moveTo(p, false)
      }
      return true
    }
    return false
  }

  const setSortKey = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }))

  const sizeLabel = metric === 'alloc' ? t('common.sizeOnDisk') : t('common.size')
  const columns = [
    { key: 'name', label: t('common.name') },
    { key: 'size', label: sizeLabel, align: 'right' },
    { key: null, label: t('list.colPercent') },
    { key: 'files', label: t('list.colFiles'), align: 'right' },
    { key: 'modified', label: t('common.modified'), align: 'right' }
  ]

  if (!data) return <div className="panel-empty">{t('common.loading')}</div>
  if (!data.root) return <div className="panel-empty">{t('common.noData')}</div>

  const items = []
  for (let i = virt.start; i < virt.end; i++) {
    const { entry, depth, parentTotal } = rows[i]
    items.push(
      <TreeRow
        key={entry.path}
        index={i}
        entry={entry}
        depth={depth}
        parentTotal={parentTotal}
        metric={metric}
        open={expanded.has(entry.path)}
        selected={actions.isSelected(entry.path)}
        focused={sel.focusPath === entry.path}
        onToggle={toggle}
        sel={sel}
        t={t}
        fmt={fmt}
      />
    )
  }

  return (
    <div
      className="list-scroll"
      ref={virt.ref}
      onScroll={virt.onScroll}
      tabIndex={0}
      role="treegrid"
      aria-label={t('list.treeLabel')}
      onKeyDown={(e) => sel.onKeyDown(e, treeKeys)}
    >
      <div className="list-inner">
        <div className="list-header list-grid-tree" role="row" style={{ height: HEADER_HEIGHT }}>
          {columns.map((c, i) =>
            c.key ? (
              <button
                key={c.key}
                className={`list-th sortable ${c.align === 'right' ? 'right' : ''} ${sort.key === c.key ? 'sorted' : ''}`}
                onClick={() => setSortKey(c.key)}
                role="columnheader"
                aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span>{c.label}</span>
                {sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </button>
            ) : (
              <div key={i} className="list-th" role="columnheader">
                <span>{c.label}</span>
              </div>
            )
          )}
        </div>
        {rows.length === 0 ? (
          <div className="panel-empty">{t('list.emptyFolder')}</div>
        ) : (
          <div className="list-body" style={{ height: virt.totalHeight }} role="rowgroup">
            {items}
          </div>
        )}
      </div>
    </div>
  )
}

function TreeRow({ index, entry, depth, parentTotal, metric, open, selected, focused, onToggle, sel, t, fmt }) {
  const style = { top: index * ROW_HEIGHT, height: ROW_HEIGHT }

  if (entry.type === 'other' || entry.type === 'system') {
    const isSystem = entry.type === 'system'
    const Icon = isSystem ? HardDrive : MoreHorizontal
    return (
      <div className="list-row list-grid-tree static" style={style} role="row" title={isSystem ? t('common.systemSpaceHint') : undefined}>
        <div className="lc lc-name" style={{ paddingLeft: 10 + depth * INDENT }}>
          <span className="twisty" />
          <Icon size={15} className="row-icon muted" />
          <span className="row-name muted">
            {isSystem ? t('common.systemSpace') : t('common.otherItems', { count: entry.count })}
          </span>
        </div>
        <div className="lc right muted">{fmt.bytes(entry[metric])}</div>
        <PercentCell value={entry[metric]} total={parentTotal} fmt={fmt} muted />
        <div className="lc right" />
        <div className="lc right" />
      </div>
    )
  }

  const isDir = entry.type === 'dir'
  const value = entry[metric] || 0
  const expandable = isDir && entry.childCount > 0
  const cls = ['list-row', 'list-grid-tree', selected ? 'selected' : '', focused ? 'focused' : ''].filter(Boolean).join(' ')

  return (
    <div
      className={cls}
      style={style}
      role="row"
      aria-selected={selected}
      aria-expanded={expandable ? open : undefined}
      aria-level={depth + 1}
      onClick={(e) => sel.onRowClick(e, index)}
      onDoubleClick={() => sel.onRowDouble(index)}
      onContextMenu={(e) => sel.onRowContext(e, index)}
    >
      <div className="lc lc-name" style={{ paddingLeft: 10 + depth * INDENT }}>
        {expandable ? (
          <button
            className="twisty"
            tabIndex={-1}
            aria-label={open ? t('list.collapse') : t('list.expand')}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(entry)
            }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="twisty" />
        )}
        {isDir ? <Folder size={15} className="row-icon folder" /> : <File size={15} className="row-icon" />}
        <span className="row-name" title={entry.name}>{entry.name}</span>
        {isDir && entry.error && (
          <span className="row-badge warn" title={t('list.unreadable')}>
            <AlertTriangle size={13} />
          </span>
        )}
        {!isDir && entry.locked && (
          <span className="row-badge" title={t('common.locked')}>
            <Lock size={11} />
          </span>
        )}
      </div>
      <div className={`lc right ${entry.hardlink ? 'muted' : ''}`} title={entry.hardlink ? t('common.hardlink') : undefined}>
        {fmt.bytes(value)}
      </div>
      {entry.hardlink ? <div className="lc muted">—</div> : <PercentCell value={value} total={parentTotal} fmt={fmt} />}
      <div className="lc right muted">{isDir ? fmt.number(entry.files) : ''}</div>
      <div className="lc right muted">{fmt.date(entry.mtime)}</div>
    </div>
  )
}

function PercentCell({ value, total, fmt, muted }) {
  const frac = total > 0 ? Math.min(1, value / total) : 0
  return (
    <div className={`lc lc-pct ${muted ? 'muted' : ''}`}>
      <span className="pct-bar">
        <i style={{ width: `${frac * 100}%` }} />
      </span>
      <span className="pct-text">{fmt.percent(frac)}</span>
    </div>
  )
}
