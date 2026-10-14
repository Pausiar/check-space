import { useCallback, useEffect, useMemo, useState } from 'react'
import FilterBar from './list/FilterBar'
import TreeTable from './list/TreeTable'
import ResultsTable from './list/ResultsTable'
import { EMPTY_FILTERS, MIN_SIZES, OLDER, isActive, parseExts } from './list/filters'
import './ListView.css'

const DEBOUNCE_MS = 250

export default function ListView({ rootPath, currentPath, onNavigate, metric, dataVersion, searchInputRef }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [applied, setApplied] = useState(EMPTY_FILTERS) // debounced copy
  const [response, setResponse] = useState(null)
  const [searching, setSearching] = useState(false)

  // Debounce typing; clearing the filters applies immediately
  useEffect(() => {
    if (!isActive(filters)) {
      setApplied(filters)
      return undefined
    }
    const id = setTimeout(() => setApplied(filters), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [filters])

  const active = isActive(applied)
  const atRoot = !currentPath || currentPath === rootPath
  const under = applied.scope === 'folder' && !atRoot ? currentPath : null
  const query = applied.query.trim()
  const extsKey = parseExts(applied.exts).join(',')
  const { kind, minSize, older } = applied

  useEffect(() => {
    if (!active) {
      setResponse(null)
      setSearching(false)
      return undefined
    }
    let alive = true
    setSearching(true)
    window.api
      .search({
        query,
        exts: extsKey ? extsKey.split(',') : [],
        minSize: MIN_SIZES[minSize],
        kind,
        under: under || undefined,
        metric,
        olderThanMs: OLDER[older],
        limit: 1000
      })
      .then((r) => {
        if (!alive) return
        setResponse(r)
        setSearching(false)
      })
      .catch(() => {
        if (alive) setSearching(false)
      })
    return () => {
      alive = false
    }
  }, [active, query, extsKey, kind, minSize, older, under, metric, dataVersion])

  const clearAll = useCallback(() => {
    setFilters((f) => ({ ...EMPTY_FILTERS, scope: f.scope }))
  }, [])

  const openFolderResult = useCallback(
    (path) => {
      onNavigate(path)
      clearAll()
    },
    [onNavigate, clearAll]
  )

  const bar = useMemo(
    () => (
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        active={isActive(filters)}
        canScope={!atRoot}
        onClear={clearAll}
        searchInputRef={searchInputRef}
      />
    ),
    [filters, atRoot, clearAll, searchInputRef]
  )

  return (
    <div className="list-view">
      {bar}
      {active ? (
        <ResultsTable response={response} searching={searching} metric={metric} onOpenFolder={openFolderResult} />
      ) : (
        <TreeTable currentPath={currentPath} onNavigate={onNavigate} metric={metric} dataVersion={dataVersion} />
      )}
    </div>
  )
}
