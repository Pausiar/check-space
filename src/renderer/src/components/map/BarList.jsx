import { memo, useMemo } from 'react'
import { Folder, File } from 'lucide-react'
import { useI18n } from '../../i18n'
import { colorForNode, entryLabel, isReal } from './mapData'

const TOP = 12

/** Ranked list of the current folder's direct children (top 12 + rest). */
function BarList({ root, isDark, interactive, onOpen, onReveal, onContextMenu, onToggleSelect, isSelected, selection }) {
  const { t, fmt } = useI18n()

  const rows = useMemo(() => {
    const children = (root.children || []).filter((c) => c.value > 0)
    const top = children.slice(0, TOP).map((n) => ({
      key: n.data.entry.path,
      node: n,
      entry: n.data.entry,
      value: n.value,
      color: colorForNode(n, isDark)
    }))
    const rest = children.slice(TOP)
    if (rest.length > 0) {
      let count = 0
      let value = 0
      for (const n of rest) {
        value += n.value
        count += n.data.entry.type === 'other' ? n.data.entry.count : 1
      }
      top.push({ key: '\u0000rest', entry: { type: 'other', count, path: '\u0000rest' }, value, color: null })
    }
    return top
  }, [root, isDark])

  const total = root.value || 0
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0)
  if (rows.length === 0) return null

  return (
    <div className="map-bars file-list-panel">
      <div className="map-bars-header file-list-header">
        <span>{t('map.contentsTitle')}</span>
        <span className="map-bars-total">{fmt.bytes(total)}</span>
      </div>
      <div className="map-bars-rows">
        {rows.map((r) => {
          const e = r.entry
          const openable = interactive && e.type === 'dir'
          const selected = selection && selection.size > 0 && isReal(e) && isSelected(e.path)
          const Icon = e.type === 'dir' ? Folder : e.type === 'file' ? File : null
          return (
            <div
              key={r.key}
              className={`map-bar-row${openable ? ' clickable' : ''}${selected ? ' selected' : ''}`}
              role={openable ? 'button' : undefined}
              tabIndex={openable ? 0 : undefined}
              title={e.type === 'system' ? t('common.systemSpaceHint') : isReal(e) ? e.path : undefined}
              onClick={(ev) => {
                if ((ev.ctrlKey || ev.metaKey || ev.shiftKey) && isReal(e)) {
                  if (interactive) onToggleSelect(e)
                  return
                }
                if (openable) onOpen(e.path)
              }}
              onDoubleClick={() => {
                if (interactive && e.type === 'file') onReveal(e.path)
              }}
              onKeyDown={(ev) => {
                if (openable && (ev.key === 'Enter' || ev.key === ' ')) {
                  ev.preventDefault()
                  onOpen(e.path)
                }
              }}
              onContextMenu={(ev) => {
                if (interactive && isReal(e)) onContextMenu(ev, e)
                else ev.preventDefault()
              }}
            >
              <span className="map-bar-name">
                {Icon ? <Icon size={14} className="map-bar-icon" /> : <span className="map-bar-icon-spacer" />}
                <span className="map-bar-label">{entryLabel(e, t)}</span>
              </span>
              <span className="map-bar-track">
                <span
                  className="map-bar-fill"
                  style={{ width: `${max > 0 ? Math.max(0.5, (r.value / max) * 100) : 0}%`, background: r.color || undefined }}
                />
              </span>
              <span className="map-bar-size">{fmt.bytes(r.value)}</span>
              <span className="map-bar-pct">{fmt.percent(total > 0 ? r.value / total : 0)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default memo(BarList)
