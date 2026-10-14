import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { entryLabel, entryValue, isReal } from './mapData'

const DELAY = 400

/**
 * Hover tooltip with its own state so hovering never re-renders the chart.
 * ref API: move(node, clientX, clientY, total), hide()
 */
const MapTooltip = forwardRef(function MapTooltip({ metric, interactive, canGoUp }, ref) {
  const { t, fmt } = useI18n()
  const [state, setState] = useState(null) // { node, total }
  const boxRef = useRef(null)
  const timer = useRef(null)
  const pending = useRef(null)
  const pos = useRef({ x: 0, y: 0 })
  const visibleNode = useRef(null)

  const place = useCallback(() => {
    const el = boxRef.current
    if (!el) return
    const { x, y } = pos.current
    const w = el.offsetWidth
    const h = el.offsetHeight
    let left = x + 14
    let top = y + 16
    if (left + w > window.innerWidth - 8) left = Math.max(8, x - w - 14)
    if (top + h > window.innerHeight - 8) top = Math.max(8, y - h - 12)
    el.style.transform = `translate(${left}px, ${top}px)`
  }, [])

  const hide = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    pending.current = null
    if (visibleNode.current) {
      visibleNode.current = null
      setState(null)
    }
  }, [])

  const move = useCallback((node, x, y, total) => {
    pos.current = { x, y }
    if (!node) {
      hide()
      return
    }
    if (visibleNode.current) {
      if (visibleNode.current !== node) {
        visibleNode.current = node
        setState({ node, total })
      } else {
        place()
      }
      return
    }
    pending.current = { node, total }
    if (!timer.current) {
      timer.current = setTimeout(() => {
        timer.current = null
        const p = pending.current
        if (!p) return
        visibleNode.current = p.node
        setState(p)
      }, DELAY)
    }
  }, [hide, place])

  useImperativeHandle(ref, () => ({ move, hide }), [move, hide])

  useEffect(() => {
    if (state) place()
  }, [state, place])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!state) return null
  const { node, total } = state
  const e = node.data.entry
  const value = e.type === 'filler' ? node.value : entryValue(e, metric)
  const isDir = e.type === 'dir'
  const canOpen = interactive && (isDir || e.type === 'other') && node.depth > 0

  return (
    <div ref={boxRef} className="map-tooltip" role="tooltip">
      <div className="map-tooltip-name">{entryLabel(e, t)}</div>
      {isReal(e) && e.path && <div className="map-tooltip-path">{e.path}</div>}
      <div className="map-tooltip-row">
        <strong>{fmt.bytes(value)}</strong>
        {total > 0 && node.depth > 0 && (
          <span>{t('map.ofFolder', { percent: fmt.percent(value / total) })}</span>
        )}
      </div>
      {isDir && (
        <div className="map-tooltip-row map-tooltip-muted">
          {t('common.files', { count: e.files || 0 })} · {t('common.folders', { count: e.dirs || 0 })}
        </div>
      )}
      {e.type === 'file' && e.hardlink && <div className="map-tooltip-muted">{t('common.hardlink')}</div>}
      {e.type === 'system' && <div className="map-tooltip-hint-text">{t('common.systemSpaceHint')}</div>}
      {canOpen && <div className="map-tooltip-hint">{t('map.clickToOpen')}</div>}
      {interactive && e.type === 'file' && <div className="map-tooltip-hint">{t('map.dblClickToReveal')}</div>}
      {interactive && canGoUp && node.depth === 0 && e.type === 'dir' && <div className="map-tooltip-hint">{t('map.clickToGoUp')}</div>}
    </div>
  )
})

export default MapTooltip
