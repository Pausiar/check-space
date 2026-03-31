import { useState, useMemo, useCallback, useRef } from 'react'
import { Treemap, ResponsiveContainer } from 'recharts'
import { FolderOpen, ExternalLink, Trash2 } from 'lucide-react'
import { formatBytes } from '../utils/format'
import { COLORS } from '../utils/colors'

function CustomCell(props) {
  const {
    x, y, width, height, depth, index, name,
    folderNames, onCellClick, onCellHover, onCellContext
  } = props

  if (!name || width < 2 || height < 2) return null

  const isFolder = folderNames && folderNames.has(name)
  const isFilesEntry = name === '📄 Files'
  const color = isFilesEntry ? '#94a3b8' : COLORS[index % COLORS.length]

  const showLabel = width > 40 && height > 20
  const showSize = width > 60 && height > 36

  const maxChars = Math.max(3, Math.floor(width / 7))
  const displayName = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill={color}
        fillOpacity={0.85}
        stroke="var(--bg-primary)"
        strokeWidth={2}
        style={{ cursor: isFolder ? 'pointer' : 'default' }}
        onMouseEnter={(e) => {
          e.target.setAttribute('fill-opacity', '1')
          if (onCellHover) onCellHover({ name, size: props.size, isFolder, isFilesEntry }, e)
        }}
        onMouseLeave={(e) => {
          e.target.setAttribute('fill-opacity', '0.85')
          if (onCellHover) onCellHover(null)
        }}
        onClick={() => {
          if (name && onCellClick) onCellClick(name)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          if (name && !isFilesEntry && onCellContext) onCellContext(name, e)
        }}
      />
      {showLabel && (
        <text
          x={x + 8}
          y={y + 16}
          fill="#fff"
          fontSize={12}
          fontWeight={600}
          pointerEvents="none"
        >
          {isFolder ? '📁 ' : isFilesEntry ? '' : '📄 '}{displayName}
        </text>
      )}
      {showSize && (
        <text
          x={x + 8}
          y={y + 32}
          fill="rgba(255,255,255,0.75)"
          fontSize={11}
          pointerEvents="none"
        >
          {formatBytes(props.size)}
        </text>
      )}
    </g>
  )
}

export default function TreemapChart({ tree, isScanning, onNavigate }) {
  const [tooltip, setTooltip] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const tooltipTimerRef = useRef(null)
  const containerRef = useRef(null)

  const data = useMemo(() => {
    if (!tree || !tree.children || tree.children.length === 0) return []
    const folders = tree.children.filter((c) => c.size > 0)
    const childrenSize = folders.reduce((sum, c) => sum + c.size, 0)
    const looseSize = tree.size - childrenSize
    const items = folders.map((c) => ({
      name: c.name,
      size: c.size
    }))
    if (looseSize > 0) {
      items.push({ name: '📄 Files', size: looseSize })
    }
    return items
  }, [tree])

  const folderNames = useMemo(() => {
    if (!tree || !tree.children) return new Set()
    return new Set(
      tree.children
        .filter((c) => c.children && c.children.length > 0)
        .map((c) => c.name)
    )
  }, [tree])

  const handleCellClick = useCallback(
    (name) => {
      if (!onNavigate || !tree || !tree.children) return
      const original = tree.children.find((d) => d.name === name)
      if (original && original.children && original.children.length > 0) {
        onNavigate(original)
      }
    },
    [onNavigate, tree]
  )

  const handleHover = useCallback((info, event) => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }

    if (!info) {
      setTooltip(null)
      return
    }

    const container = containerRef.current
    if (!container || !event) return
    const rect = container.getBoundingClientRect()
    const posX = event.clientX - rect.left + 12
    const posY = event.clientY - rect.top + 12

    tooltipTimerRef.current = setTimeout(() => {
      setTooltip({
        name: info.name,
        size: info.size,
        isFolder: info.isFolder,
        isFilesEntry: info.isFilesEntry,
        x: posX,
        y: posY
      })
      tooltipTimerRef.current = null
    }, 1000)
  }, [])

  const handleContext = useCallback(
    (name, event) => {
      if (!tree) return
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const original = tree.children?.find((d) => d.name === name)
      if (!original) return
      setContextMenu({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        node: original
      })
    },
    [tree]
  )

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const handleOpenInExplorer = useCallback(() => {
    if (contextMenu?.node?.path) {
      window.api.showItemInFolder(contextMenu.node.path)
    }
    setContextMenu(null)
  }, [contextMenu])

  const handleMoveToTrash = useCallback(async () => {
    if (contextMenu?.node?.path) {
      await window.api.moveToTrash(contextMenu.node.path)
    }
    setContextMenu(null)
  }, [contextMenu])

  if (!data.length) {
    return (
      <div className="treemap-container">
        <div className="treemap-empty">
          {isScanning ? 'Scanning…' : 'No data to display'}
        </div>
      </div>
    )
  }

  return (
    <div className="treemap-container" ref={containerRef} onClick={closeContextMenu}>
      <ResponsiveContainer width="100%" height={420}>
        <Treemap
          data={data}
          dataKey="size"
          stroke="none"
          isAnimationActive={false}
          content={
            <CustomCell
              folderNames={folderNames}
              onCellHover={handleHover}
              onCellContext={handleContext}
              onCellClick={handleCellClick}
            />
          }
        />
      </ResponsiveContainer>

      {tooltip && (
        <div
          className="treemap-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="tooltip-name">{tooltip.name}</div>
          <div className="tooltip-size">{formatBytes(tooltip.size)}</div>
          {tooltip.isFolder && (
            <div className="tooltip-hint">Click to explore</div>
          )}
        </div>
      )}

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="context-menu-item" onClick={handleOpenInExplorer}>
            <FolderOpen size={14} />
            Show in Explorer
          </button>
          <button className="context-menu-item context-menu-danger" onClick={handleMoveToTrash}>
            <Trash2 size={14} />
            Move to Trash
          </button>
        </div>
      )}
    </div>
  )
}
