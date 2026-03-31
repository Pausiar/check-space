import { useState, useEffect, useCallback } from 'react'

export function useScan() {
  const [status, setStatus] = useState('idle') // idle | scanning | complete | error
  const [tree, setTree] = useState(null)
  const [stats, setStats] = useState(null)
  const [extras, setExtras] = useState(null) // largestFiles, fileTypes, oldFiles, duplicates
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubProgress = window.api.onScanProgress((data) => {
      setTree(data.tree)
      setStats(data.stats)
      setProgress(data.progress || 0)
    })

    const unsubComplete = window.api.onScanComplete((data) => {
      setTree(data.tree)
      setStats(data.stats)
      setExtras(data.extras || null)
      setProgress(1)
      setStatus('complete')
    })

    const unsubError = window.api.onScanError((data) => {
      setError(data.message)
      setStatus('error')
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, [])

  const startScan = useCallback((drivePath) => {
    setStatus('scanning')
    setTree(null)
    setStats(null)
    setExtras(null)
    setProgress(0)
    setError(null)
    window.api.startScan(drivePath)
  }, [])

  const cancelScan = useCallback(() => {
    window.api.cancelScan()
    setStatus('complete')
  }, [])

  // Load cached scan
  const loadCache = useCallback(async (driveLetter) => {
    const cached = await window.api.cacheLoad(driveLetter)
    if (cached) {
      setTree(cached.tree)
      setStats(cached.stats)
      setExtras(cached.extras || null)
      setStatus('complete')
      setProgress(1)
      return true
    }
    return false
  }, [])

  // Save scan to cache
  const saveCache = useCallback(async (driveLetter) => {
    if (tree && stats) {
      await window.api.cacheSave(driveLetter, { tree, stats, extras, savedAt: Date.now() })
    }
  }, [tree, stats, extras])

  return { status, tree, stats, extras, progress, error, startScan, cancelScan, loadCache, saveCache }
}
