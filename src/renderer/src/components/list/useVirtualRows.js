import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export const ROW_HEIGHT = 30
export const HEADER_HEIGHT = 32

/** Simple fixed-height windowing over a scroll container that has a sticky header. */
export function useVirtualRows(count, overscan = 10) {
  const ref = useRef(null)
  const [view, setView] = useState({ top: 0, height: 600 })

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setView((v) => (v.top === el.scrollTop && v.height === el.clientHeight ? v : { top: el.scrollTop, height: el.clientHeight }))
  }, [])

  useLayoutEffect(() => {
    update()
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update])

  const start = Math.max(0, Math.floor(view.top / ROW_HEIGHT) - overscan)
  const end = Math.min(count, Math.ceil((view.top + view.height) / ROW_HEIGHT) + overscan)

  const scrollToIndex = useCallback((i) => {
    const el = ref.current
    if (!el) return
    const rowTop = HEADER_HEIGHT + i * ROW_HEIGHT
    if (rowTop < el.scrollTop + HEADER_HEIGHT) el.scrollTop = i * ROW_HEIGHT
    else if (rowTop + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = rowTop + ROW_HEIGHT - el.clientHeight
  }, [])

  return { ref, onScroll: update, start, end, totalHeight: count * ROW_HEIGHT, scrollToIndex }
}
