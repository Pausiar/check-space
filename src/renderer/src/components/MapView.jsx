import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, CircleDot } from 'lucide-react'
import { useI18n } from '../i18n'
import { useFileActions } from '../context/FileActions'
import { useTheme } from '../theme/ThemeProvider'
import { CATEGORIES, NEUTRAL } from '../utils/colors'
import { parentPath } from '../utils/paths'
import { buildHierarchy, isReal } from './map/mapData'
import Treemap from './map/Treemap'
import Sunburst from './map/Sunburst'
import BarList from './map/BarList'
import MapTooltip from './map/MapTooltip'
import './MapView.css'

const MODE_KEY = 'mapMode'
// depth 3 x 30 children keeps the payload small; the charts additionally cap rendered shapes (~1500)
const VIEW_OPTS = { depth: 3, maxChildren: 30 }

function loadMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'sunburst' ? 'sunburst' : 'treemap'
  } catch {
    return 'treemap'
  }
}

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        const width = Math.floor(r.width)
        const height = Math.floor(r.height)
        setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
      })
    }
    const r = el.getBoundingClientRect()
    setSize({ width: Math.floor(r.width), height: Math.floor(r.height) })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [ref])
  return size
}

/** Fetches the view of `currentPath` after the scan; ignores out-of-order responses. */
function useMapData({ enabled, currentPath, metric, dataVersion }) {
  const [state, setState] = useState({ view: null, path: null, loading: false })
  const reqId = useRef(0)
  useEffect(() => {
    if (!enabled || !currentPath) return
    const id = ++reqId.current
    setState((s) => ({ ...s, loading: true }))
    window.api
      .getView(currentPath, { ...VIEW_OPTS, metric })
      .then((view) => {
        if (id === reqId.current) setState({ view: view || null, path: currentPath, loading: false })
      })
      .catch(() => {
        if (id === reqId.current) setState({ view: null, path: currentPath, loading: false })
      })
  }, [enabled, currentPath, metric, dataVersion])
  return state
}

function Legend() {
  const { t } = useI18n()
  return (
    <div className="map-legend" aria-label={t('map.legend')}>
      {Object.entries(CATEGORIES).map(([key, c]) => (
        <span key={key} className="map-legend-item">
          <span className="map-legend-swatch" style={{ background: c.color }} />
          {t(`map.cat_${key}`)}
        </span>
      ))}
      <span className="map-legend-item">
        <span className="map-legend-swatch" style={{ background: NEUTRAL }} />
        {t('map.cat_other')}
      </span>
      <span className="map-legend-item map-legend-folders">
        <span className="map-legend-swatch map-legend-swatch-folders" />
        {t('map.folders')}
      </span>
    </div>
  )
}

export default function MapView({ rootPath, currentPath, onNavigate, metric = 'size', dataVersion, liveView, isScanning }) {
  const { t } = useI18n()
  const { isDark } = useTheme() || {}
  const { selection, isSelected, toggleSelect, openContextMenu, showInFolder } = useFileActions()
  const [mode, setModeState] = useState(loadMode)
  const chartRef = useRef(null)
  const tooltipRef = useRef(null)
  const size = useElementSize(chartRef)

  const setMode = useCallback((m) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {}
  }, [])

  const { view: fetched, loading } = useMapData({
    enabled: !isScanning,
    currentPath,
    metric,
    dataVersion
  })

  const view = isScanning ? liveView : fetched
  const root = useMemo(() => buildHierarchy(view, metric), [view, metric])
  const interactive = !isScanning && !!onNavigate
  const canGoUp = interactive && !!rootPath && !!view && !!parentPath(view.path, rootPath)

  // Hide the tooltip when the data changes under the cursor
  useEffect(() => {
    tooltipRef.current?.hide()
  }, [root, mode])

  const handlers = useMemo(() => ({
    onClick(node, e) {
      const entry = node.data.entry
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        if (interactive && isReal(entry) && node.depth > 0) toggleSelect(entry, true)
        return
      }
      if (e.detail > 1 || !interactive) return
      if (node.depth === 0) {
        const up = parentPath(entry.path, rootPath)
        if (up) {
          tooltipRef.current?.hide()
          onNavigate(up)
        }
        return
      }
      let target = null
      if (entry.type === 'dir') target = entry.path
      else if (entry.type === 'other') target = entry.path.split('\u0000')[0]
      if (target && target !== currentPath) {
        tooltipRef.current?.hide()
        onNavigate(target)
      }
    },
    onDoubleClick(node) {
      const entry = node.data.entry
      if (interactive && entry.type === 'file' && isReal(entry)) showInFolder(entry.path)
    },
    onContextMenu(node, e) {
      const entry = node.data.entry
      if (interactive && isReal(entry)) openContextMenu(e, entry)
      else e.preventDefault()
    }
  }), [interactive, toggleSelect, showInFolder, openContextMenu, onNavigate, rootPath, currentPath])

  const onBarOpen = useCallback((p) => {
    if (onNavigate && p !== currentPath) onNavigate(p)
  }, [onNavigate, currentPath])
  const onBarToggle = useCallback((entry) => toggleSelect(entry, true), [toggleSelect])

  let empty = null
  if (!root) {
    if (isScanning) empty = t('map.scanningWait')
    else if (loading || (!fetched && currentPath)) empty = t('common.loading')
    else empty = t('common.noData')
  }

  const ChartComponent = mode === 'sunburst' ? Sunburst : Treemap
  const ready = root && size.width > 20 && size.height > 20

  return (
    <div className={`map-view${isScanning ? ' map-view-live' : ''}`}>
      <div className="map-toolbar">
        <div className="segmented" role="radiogroup" aria-label={t('map.chartType')}>
          <button
            role="radio"
            aria-checked={mode === 'treemap'}
            className={mode === 'treemap' ? 'active' : ''}
            onClick={() => setMode('treemap')}
          >
            <LayoutGrid size={13} />
            {t('map.treemap')}
          </button>
          <button
            role="radio"
            aria-checked={mode === 'sunburst'}
            className={mode === 'sunburst' ? 'active' : ''}
            onClick={() => setMode('sunburst')}
          >
            <CircleDot size={13} />
            {t('map.sunburst')}
          </button>
        </div>
        <Legend />
      </div>

      <div className={`map-chart${loading && root ? ' map-chart-loading' : ''}`} ref={chartRef}>
        {ready ? (
          <ChartComponent
            root={root}
            width={size.width}
            height={size.height}
            metric={metric}
            isDark={!!isDark}
            handlers={handlers}
            tooltipRef={tooltipRef}
            isSelected={isSelected}
            selection={selection}
            interactive={interactive}
            canGoUp={canGoUp}
          />
        ) : (
          empty && (
            <div className="map-empty panel-empty">
              {isScanning && <span className="map-empty-dot" />}
              {empty}
            </div>
          )
        )}
        {isScanning && root && <div className="map-live-badge">{t('map.liveBadge')}</div>}
      </div>

      <MapTooltip ref={tooltipRef} metric={metric} interactive={interactive} canGoUp={canGoUp} />

      {root && !isScanning && (
        <BarList
          root={root}
          isDark={!!isDark}
          interactive={interactive}
          onOpen={onBarOpen}
          onReveal={showInFolder}
          onContextMenu={openContextMenu}
          onToggleSelect={onBarToggle}
          isSelected={isSelected}
          selection={selection}
        />
      )}
    </div>
  )
}
