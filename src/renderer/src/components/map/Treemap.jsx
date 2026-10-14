import { memo, useMemo } from 'react'
import { treemap, treemapSquarify } from 'd3-hierarchy'
import { useI18n } from '../../i18n'
import { colorForNode, entryLabel, fitText, isReal, prefersLightText, textWidth } from './mapData'
import { useChartEvents } from './useChartEvents'

const HEADER = 17
const MAX_RECTS = 1500
const MIN_SIDE = 2

function layout(root, width, height) {
  const copy = root.copy()
  // copy() drops our custom fields; restore the branch index
  copy.each((n) => {
    n.branch = n.depth === 0 ? -1 : null
  })
  ;(copy.children || []).forEach((c, i) => c.each((n) => {
    n.branch = i
  }))
  treemap()
    .tile(treemapSquarify.ratio(1.2))
    .size([width, height])
    .round(true)
    .paddingInner((n) => (n.depth === 0 ? 2 : 1))
    .paddingOuter((n) => (n.depth === 0 ? 0 : 2))
    .paddingTop((n) => {
      if (n.depth === 0) return 0
      const w = n.x1 - n.x0
      const h = n.y1 - n.y0
      return w > 36 && h > HEADER + 14 ? HEADER : 2
    })(copy)

  // Breadth-first so parents are drawn before (under) their children; cap the count
  const out = []
  const queue = copy.children ? [...copy.children] : []
  while (queue.length && out.length < MAX_RECTS) {
    const n = queue.shift()
    if (n.x1 - n.x0 < MIN_SIDE || n.y1 - n.y0 < MIN_SIDE) continue
    out.push(n)
    if (n.children) for (const c of n.children) queue.push(c)
  }
  return { root: copy, nodes: out }
}

function Label({ node, fill, t, fmt, metricValue }) {
  const e = node.data.entry
  const w = node.x1 - node.x0
  const h = node.y1 - node.y0
  const light = prefersLightText(fill)
  const cls = `tm-label ${light ? 'tm-label-light' : 'tm-label-dark'}`
  const name = entryLabel(e, t)
  const size = fmt.bytes(metricValue)

  if (node.children) {
    // Folder header strip
    if (h < HEADER + 14 || w < 36) return null
    const avail = w - 8
    const sizeW = textWidth(size) + 8
    const showSize = avail - sizeW > 40
    const label = fitText(name, showSize ? avail - sizeW : avail)
    if (!label) return null
    return (
      <>
        <text className={`${cls} tm-header-text`} x={node.x0 + 4} y={node.y0 + 12}>{label}</text>
        {showSize && (
          <text className={`${cls} tm-size-text`} x={node.x1 - 4} y={node.y0 + 12} textAnchor="end">{size}</text>
        )}
      </>
    )
  }
  if (w < 30 || h < 14) return null
  const label = fitText(name, w - 8)
  if (!label) return null
  const sizeLabel = h >= 30 ? fitText(size, w - 8) : ''
  return (
    <>
      <text className={cls} x={node.x0 + 4} y={node.y0 + 12}>{label}</text>
      {sizeLabel && <text className={`${cls} tm-size-text`} x={node.x0 + 4} y={node.y0 + 25}>{sizeLabel}</text>}
    </>
  )
}

function Treemap({ root, width, height, metric, isDark, handlers, tooltipRef, isSelected, selection, interactive }) {
  const { t, fmt } = useI18n()
  const { root: laid, nodes } = useMemo(() => layout(root, width, height), [root, width, height])
  const events = useChartEvents(nodes, handlers, tooltipRef, laid.value)

  const shapes = useMemo(() => nodes.map((n, i) => {
    const e = n.data.entry
    const fill = colorForNode(n, isDark)
    const w = n.x1 - n.x0
    const h = n.y1 - n.y0
    const clickable = interactive && (e.type === 'dir' || e.type === 'other')
    return (
      <g key={e.path} data-i={i} className={clickable ? 'tm-node tm-clickable' : 'tm-node'}>
        <rect className={n.children ? 'tm-rect tm-dir' : 'tm-rect'} x={n.x0} y={n.y0} width={w} height={h} fill={fill} />
        <Label node={n} fill={fill} t={t} fmt={fmt} metricValue={n.value} />
      </g>
    )
  }), [nodes, isDark, t, fmt, interactive])

  const outlines = useMemo(() => {
    if (!selection || selection.size === 0) return null
    return nodes
      .filter((n) => isReal(n.data.entry) && isSelected(n.data.entry.path))
      .map((n) => (
        <rect
          key={n.data.entry.path}
          className="map-selected-outline"
          x={n.x0 + 1}
          y={n.y0 + 1}
          width={Math.max(0, n.x1 - n.x0 - 2)}
          height={Math.max(0, n.y1 - n.y0 - 2)}
        />
      ))
  }, [nodes, selection, isSelected])

  return (
    <svg className="map-svg treemap-svg" width={width} height={height} role="img" {...events}>
      {shapes}
      {outlines}
    </svg>
  )
}

export default memo(Treemap)
