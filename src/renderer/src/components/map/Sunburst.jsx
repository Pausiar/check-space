import { memo, useMemo } from 'react'
import { partition } from 'd3-hierarchy'
import { arc as d3arc } from 'd3-shape'
import { useI18n } from '../../i18n'
import { colorForNode, entryLabel, fitText, isReal, prefersLightText } from './mapData'
import { useChartEvents } from './useChartEvents'

const RINGS = 4
const MIN_ANGLE = 0.004
const MAX_ARCS = 1500

function layout(root, radius) {
  const copy = root.copy()
  ;(copy.children || []).forEach((c, i) => c.each((n) => {
    n.branch = i
  }))
  copy.branch = -1
  const depth = Math.max(1, Math.min(RINGS, copy.height))
  partition().size([2 * Math.PI, depth + 1])(copy)
  const r0 = Math.max(40, radius * 0.24)
  const ringW = (radius - r0) / depth
  const out = []
  copy.each((n) => {
    if (n.depth === 0 || n.depth > depth) return
    if (n.x1 - n.x0 < MIN_ANGLE) return
    if (out.length >= MAX_ARCS) return
    n.ri = r0 + (n.depth - 1) * ringW
    n.ro = n.ri + ringW
    out.push(n)
  })
  return { root: copy, nodes: out, r0, ringW }
}

const arcGen = d3arc()
  .startAngle((n) => n.x0)
  .endAngle((n) => n.x1)
  .innerRadius((n) => n.ri)
  .outerRadius((n) => n.ro - 1)
  .padAngle((n) => Math.min((n.x1 - n.x0) / 2, 0.004))
  .padRadius(120)

function Sunburst({ root, width, height, isDark, handlers, tooltipRef, isSelected, selection, interactive, canGoUp }) {
  const { t, fmt } = useI18n()
  const radius = Math.max(60, Math.min(width, height) / 2 - 6)
  const { root: laid, nodes, r0, ringW } = useMemo(() => layout(root, radius), [root, radius])
  // index nodes.length is the centre (root)
  const allNodes = useMemo(() => [...nodes, laid], [nodes, laid])
  const events = useChartEvents(allNodes, handlers, tooltipRef, laid.value)

  const shapes = useMemo(() => nodes.map((n, i) => {
    const e = n.data.entry
    const fill = colorForNode(n, isDark)
    const clickable = interactive && (e.type === 'dir' || e.type === 'other')
    const angle = n.x1 - n.x0
    const rMid = (n.ri + n.ro) / 2
    let label = null
    if (angle * rMid > 13 && ringW > 30) {
      const text = fitText(entryLabel(e, t), ringW - 10, 6)
      if (text) {
        const a = ((n.x0 + n.x1) / 2) * 180 / Math.PI
        const rot = a - 90
        const flip = a > 180
        label = (
          <text
            className={`sb-label ${prefersLightText(fill) ? 'tm-label-light' : 'tm-label-dark'}`}
            transform={`rotate(${rot}) translate(${rMid},0) rotate(${flip ? 180 : 0})`}
            textAnchor="middle"
            dy="0.35em"
          >
            {text}
          </text>
        )
      }
    }
    return (
      <g key={e.path} data-i={i} className={clickable ? 'sb-node tm-clickable' : 'sb-node'}>
        <path className="sb-arc" d={arcGen(n)} fill={fill} />
        {label}
      </g>
    )
  }), [nodes, isDark, t, interactive, ringW])

  const outlines = useMemo(() => {
    if (!selection || selection.size === 0) return null
    return nodes
      .filter((n) => isReal(n.data.entry) && isSelected(n.data.entry.path))
      .map((n) => <path key={n.data.entry.path} className="map-selected-outline" d={arcGen(n)} />)
  }, [nodes, selection, isSelected])

  const center = laid.data.entry
  const centerName = fitText(entryLabel(center, t), r0 * 1.7, 7)
  const centerIdx = nodes.length

  return (
    <svg className="map-svg sunburst-svg" width={width} height={height} role="img" {...events}>
      <g transform={`translate(${width / 2},${height / 2})`}>
        {shapes}
        {outlines}
        <g data-i={centerIdx} className={interactive && canGoUp ? 'sb-center tm-clickable' : 'sb-center'}>
          <circle r={r0 - 3} className="sb-center-circle" />
          <text className="sb-center-name" textAnchor="middle" y={-4}>{centerName}</text>
          <text className="sb-center-size" textAnchor="middle" y={14}>{fmt.bytes(laid.value)}</text>
        </g>
      </g>
    </svg>
  )
}

export default memo(Sunburst)
