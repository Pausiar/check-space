import { useCallback, useRef, useState } from 'react'
import { useFileActions } from '../../context/FileActions'

export const isSelectable = (entry) => entry.type === 'dir' || entry.type === 'file'

/**
 * Selection / focus / keyboard behaviour shared by the tree and the results table.
 * rows: [{ entry }]
 */
export function useRowSelection(rows, { onOpen, scrollToIndex }) {
  const actions = useFileActions()
  const [focusPath, setFocusPath] = useState(null)
  const anchorRef = useRef(null)
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const selectRange = useCallback(
    (idx) => {
      const list = rowsRef.current
      const a = list.findIndex((r) => r.entry.path === anchorRef.current)
      if (a < 0) {
        actions.selectOnly(list[idx].entry)
        anchorRef.current = list[idx].entry.path
        return
      }
      const [lo, hi] = a < idx ? [a, idx] : [idx, a]
      actions.setSelection(list.slice(lo, hi + 1).map((r) => r.entry).filter(isSelectable))
    },
    [actions]
  )

  const onRowClick = useCallback(
    (e, idx) => {
      const entry = rowsRef.current[idx]?.entry
      if (!entry || !isSelectable(entry)) return
      setFocusPath(entry.path)
      if (e.shiftKey && anchorRef.current) {
        selectRange(idx)
      } else if (e.ctrlKey || e.metaKey) {
        actions.toggleSelect(entry, true)
        anchorRef.current = entry.path
      } else {
        actions.selectOnly(entry)
        anchorRef.current = entry.path
      }
    },
    [actions, selectRange]
  )

  const onRowContext = useCallback(
    (e, idx) => {
      const entry = rowsRef.current[idx]?.entry
      if (!entry || !isSelectable(entry)) return
      e.preventDefault()
      setFocusPath(entry.path)
      if (!actions.isSelected(entry.path)) {
        actions.selectOnly(entry)
        anchorRef.current = entry.path
      }
      actions.openContextMenu(e, entry)
    },
    [actions]
  )

  const onRowDouble = useCallback(
    (idx) => {
      const entry = rowsRef.current[idx]?.entry
      if (entry && isSelectable(entry)) onOpen(entry)
    },
    [onOpen]
  )

  const moveTo = useCallback(
    (idx, extend) => {
      const entry = rowsRef.current[idx]?.entry
      if (!entry) return
      setFocusPath(entry.path)
      if (extend && anchorRef.current) {
        selectRange(idx)
      } else {
        actions.selectOnly(entry)
        anchorRef.current = entry.path
      }
      scrollToIndex(idx)
    },
    [actions, selectRange, scrollToIndex]
  )

  /** extra(e, currentIndex) handles table-specific keys (Left/Right) and returns true when handled. */
  const onKeyDown = useCallback(
    (e, extra) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const list = rowsRef.current
      const cur = list.findIndex((r) => r.entry.path === focusPath)
      const step = (from, dir) => {
        for (let i = from + dir; i >= 0 && i < list.length; i += dir) if (isSelectable(list[i].entry)) return i
        return -1
      }
      let target = -1
      switch (e.key) {
        case 'ArrowDown':
          target = step(cur < 0 ? -1 : cur, 1)
          break
        case 'ArrowUp':
          target = cur < 0 ? step(list.length, -1) : step(cur, -1)
          break
        case 'PageDown': {
          const from = Math.min(list.length, Math.max(0, cur) + 10)
          target = isSelectable(list[from]?.entry || {}) ? from : step(from, -1)
          break
        }
        case 'PageUp': {
          const from = Math.max(-1, cur - 10)
          target = from >= 0 && isSelectable(list[from].entry) ? from : step(from, 1)
          break
        }
        case 'Home':
          target = step(-1, 1)
          break
        case 'End':
          target = step(list.length, -1)
          break
        case 'Enter':
          if (cur >= 0) {
            e.preventDefault()
            onOpen(list[cur].entry)
          }
          return
        default:
          if (extra && cur >= 0 && extra(e, cur)) e.preventDefault()
          return
      }
      e.preventDefault()
      if (target >= 0) moveTo(target, e.shiftKey)
    },
    [focusPath, moveTo, onOpen]
  )

  return { focusPath, onRowClick, onRowContext, onRowDouble, onKeyDown, moveTo }
}
