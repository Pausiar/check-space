import { useMemo, useState, useCallback } from 'react'
import { Treemap, ResponsiveContainer } from 'recharts'
import { COLORS } from '../utils/colors'
import { formatBytes } from '../utils/format'
import { FolderOpen, Trash2 } from 'lucide-react'

function CustomCell(props) {
  const { x, y, width, height, name, size, index, depth, root, onCellClick, onCellHover, onCellContext, folderNames } = props

  if (width < 4 || height < 4 || !name) return null

  // Determine if this is a folder by checking against the known folder names list
  // This avoids depending on Recharts passing custom data properties
  const isFolder = folderNames && folderNames.has(name)
  const isFilesEntry = name === 'Files' && !isFolder
  const colorIndex = depth === 1 ? index : (root?.index ?? index)
  const color = isFilesEntry ? '#7B8794' : COLORS[colorIndex % COLORS.length]
  const isClickable = depth === 1 && isFolder
  const showLabel = width > 60 && height > 36
  const showSize = width > 60 && height > 52
  const maxChars = Math.floor(width / 8)
  const icon = isFilesEntry ? '📄' : '📁'
  const label = `${icon} ${name}`
  const displayLabel = label.length > maxChars ? label.slice(0, maxChars) + '...' : label

  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={height - 2}
        fill={color}
        fillOpacity={0.85}
        rx={4}
        ry={4}
        stroke="#fff"
        strokeWidth={2}
        style={{ cursor: isClickable ? 'pointer' : 'default' }}
        onClick={(e) => {
          if (depth === 1 && onCellClick) {
            e.stopPropagation()
            onCellClick(name)
          }
        }}
        onContextMenu={(e) => {
          if (depth === 1 && isFolder && onCellContext) {
            e.preventDefault()
            e.stopPropagation()
            onCellContext(e, name)
          }
        }}
        onMouseEnter={(e) => {
          e.target.setAttribute('fill-opacity', '1')
          if (depth === 1 && onCellHover) onCellHover({ name, size, isFolder, isFilesEntry }, e)
        }}
        onMouseLeave={(e) => {
          e.target.setAttribute('fill-opacity', '0.85')
          if (onCellHover) onCellHover(null)
        }}
      />
      {showLabel && (
        <text
          x={x + 10}
          y={y + 22}
          fill="#fff"
          fontSize={13}
          fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          {displayLabel}
        </text>
      )}
      {showSize && (
        <text
          x={x + 10}
          y={y + 40}
          fill="rgba(255,255,255,0.75)"
          fontSize={11}
          style={{ pointerEvents: 'none' }}
        >
          {formatBytes(size)}
        </text>
      )}
    </g>
  )
}

export default function TreemapChart({ tree, isScanning, onNavigate }) {
  const [tooltip, setTooltip] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)

  const data = useMemo(() => {
    if (!tree || !tree.children || tree.children.length === 0) return []

    const items = tree.children
      .filter((n) => n.size > 0)
      .sort((a, b) => b.size - a.size)
      .slice(0, 20)
      .map((child) => ({
        name: child.name,
        size: child.size
      }))

    const childrenSize = tree.children.reduce((sum, c) => sum + c.size, 0)
    const filesSize = tree.size - childrenSize
    if (filesSize > 0) {
      items.push({ name: 'Files', size: filesSize })
    }

    return items.sort((a, b) => b.size - a.size)
  }, [tree])

  // Set of folder names that have navigable children
  const folderNames = useMemo(() => {
    if (!tree || !tree.children) return new Set()
    return new Set(
      tree.children
        .filter((c) => c.children && c.children.length > 0)
        .map((c) => c.name)
    )
  }, [tree])

  const handleCellClick = useCallback((name) => {
    if (!onNavigate || !tree || !tree.children) return
    const original = tree.children.find((d) => d.name === name)
    if (original && original.children && original.children.length > 0) {
      onNavigate(original)
    }
  }, [onNavigate, tree])

  const handleHover = useCallback((info, e) => {
    if (!info) {
      setTooltip(null)
      return
    }
    const rect = e.target.closest('.treemap-container').getBoundingClientRect()
    setTooltip({
      ...info,
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top - 40
    })
  }, [])

  const handleContext = useCallback((e, name) => {
    const rect = e.target.closest('.treemap-container').getBoundingClientRect()
    const original = tree?.children?.find((d) => d.name === name)
    if (!original) return
    setContextMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      path: original.path,
      name
    })
  }, [tree])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const handleOpenInExplorer = useCallback(() => {
    if (contextMenu) window.api.openPath(contextMenu.path)
    setContextMenu(null)
  }, [contextMenu])

  const handleDeleteItem = useCallback(async () => {
    if (!contextMenu) return
    if (!confirm(`Move "${contextMenu.name}" to Trash?\n${contextMenu.path}`)) {
      setContextMenu(null)
      return
    }
    await window.api.moveToTrash(contextMenu.path)
    setContextMenu(null)
  }, [contextMenu])

  if (data.length === 0) {
    return (
      <div className="treemap-empty">
        <p>No data to display yet</p>
      </div>
    )
  }

  return (
    <div className="treemap-container" onClick={closeContextMenu}>
      <ResponsiveContainer width="100%" height={400}>
        <Treemap
          data={data}
          dataKey="size"
          nameKey="name"
          isAnimationActive={!isScanning}
          animationDuration={300}
          content={<CustomCell
            folderNames={folderNames}
            onCellHover={handleHover}
            onCellContext={handleContext}
            onCellClick={handleCellClick}
          />}
        />
      </ResponsiveContainer>

      {tooltip && (
        <div className="treemap-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tooltip-name">{tooltip.isFilesEntry ? '📄' : '📁'} {tooltip.name}</div>
          <div className="tooltip-size">{formatBytes(tooltip.size)}</div>
          {tooltip.isFolder && (
            <div className="tooltip-hint">Click to explore</div>
          )}
          {!tooltip.isFilesEntry && (
            <div className="tooltip-hint">Right-click for options</div>
          )}
        </div>
      )}

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button className="context-menu-item" onClick={handleOpenInExplorer}>
            <FolderOpen size={14} />
            Open in Explorer
          </button>
          <button className="context-menu-item context-menu-danger" onClick={handleDeleteItem}>
            <Trash2 size={14} />
            Move to Trash
          </button>
        </div>
      )}
    </div>
  )
}
