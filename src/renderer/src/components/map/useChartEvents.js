import { useMemo } from 'react'

function nodeFromEvent(e, nodes) {
  const el = e.target.closest?.('[data-i]')
  if (!el) return null
  return nodes[Number(el.getAttribute('data-i'))] || null
}

/**
 * Delegated SVG event handlers: each interactive element carries data-i (index into `nodes`).
 * handlers: { onClick(node, e), onDoubleClick(node, e), onContextMenu(node, e) }
 */
export function useChartEvents(nodes, handlers, tooltipRef, total) {
  return useMemo(() => ({
    onMouseMove: (e) => tooltipRef.current?.move(nodeFromEvent(e, nodes), e.clientX, e.clientY, total),
    onMouseLeave: () => tooltipRef.current?.hide(),
    onClick: (e) => {
      const n = nodeFromEvent(e, nodes)
      if (n) handlers.onClick(n, e)
    },
    onDoubleClick: (e) => {
      const n = nodeFromEvent(e, nodes)
      if (n) handlers.onDoubleClick(n, e)
    },
    onContextMenu: (e) => {
      const n = nodeFromEvent(e, nodes)
      tooltipRef.current?.hide()
      if (n) handlers.onContextMenu(n, e)
      else e.preventDefault()
    }
  }), [nodes, handlers, tooltipRef, total])
}
