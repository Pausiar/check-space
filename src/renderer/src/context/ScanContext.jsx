import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Scan state shared by the whole scan screen.
 *
 * status: 'idle' | 'scanning' | 'complete' | 'cancelled' | 'error'
 * meta:   summary sent by the main process once a scan ends or a cache loads:
 *         { rootPath, rootName, isDrive, complete, cancelled, fromCache, savedAt,
 *           drive: { total, free, used }, unaccounted, stats: { files, dirs, size, alloc } }
 * live:   while scanning, { phase, stats, progress (0..1 or null), view }
 * dataVersion: increases every time the tree changes (scan end, deletion, cleanup).
 *         Components that fetch data from the main process re-fetch when it changes.
 */
const ScanContext = createContext(null)

export function ScanProvider({ children }) {
  const [status, setStatus] = useState('idle')
  const [target, setTarget] = useState(null) // { path, name, label, type: 'drive'|'folder', drive? }
  const [meta, setMeta] = useState(null)
  const [live, setLive] = useState(null)
  const [error, setError] = useState(null)
  const [dataVersion, setDataVersion] = useState(0)
  const scanIdRef = useRef(0)

  useEffect(() => {
    const offProgress = window.api.onScanProgress((d) => {
      if (d.scanId !== scanIdRef.current) return
      setLive({ phase: d.phase, stats: d.stats, progress: d.progress, view: d.view })
    })
    const offComplete = window.api.onScanComplete((d) => {
      if (d.scanId !== scanIdRef.current) return
      setMeta(d.meta)
      setStatus(d.meta.complete ? 'complete' : 'cancelled')
      setDataVersion((v) => v + 1)
    })
    const offError = window.api.onScanError((d) => {
      if (d.scanId !== scanIdRef.current) return
      setError(d.message)
      setStatus('error')
    })
    return () => {
      offProgress()
      offComplete()
      offError()
    }
  }, [])

  const startScan = useCallback(async (t) => {
    if (t) setTarget(t)
    const rootPath = t ? t.path : target?.path
    if (!rootPath) return
    setStatus('scanning')
    setMeta(null)
    setLive(null)
    setError(null)
    // Ignore events of any previous scan until the new id is known
    scanIdRef.current = -1
    const { scanId } = await window.api.startScan(rootPath)
    scanIdRef.current = scanId
  }, [target])

  /** Open a target: show cached results if available, otherwise scan it. */
  const openTarget = useCallback(async (t) => {
    setTarget(t)
    setError(null)
    const cached = await window.api.loadCache(t.path)
    if (cached) {
      scanIdRef.current = cached.scanId
      setLive(null)
      setMeta(cached.meta)
      setStatus('complete')
      setDataVersion((v) => v + 1)
      return
    }
    await startScan(t)
  }, [startScan])

  const cancelScan = useCallback(() => {
    // The main process answers with scan:complete (cancelled: true)
    window.api.cancelScan()
  }, [])

  const close = useCallback(() => {
    if (status === 'scanning') window.api.cancelScan()
    scanIdRef.current = -1
    setStatus('idle')
    setTarget(null)
    setMeta(null)
    setLive(null)
  }, [status])

  /** Call after the tree changed in the main process (deletion, cleanup). */
  const applyMeta = useCallback((newMeta) => {
    if (newMeta) setMeta(newMeta)
    setDataVersion((v) => v + 1)
  }, [])

  const value = useMemo(
    () => ({ status, target, meta, live, error, dataVersion, startScan, openTarget, cancelScan, close, applyMeta }),
    [status, target, meta, live, error, dataVersion, startScan, openTarget, cancelScan, close, applyMeta]
  )
  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>
}

export function useScan() {
  return useContext(ScanContext)
}
