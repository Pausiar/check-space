import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, ExternalLink, Copy, Trash2, Flame } from 'lucide-react'
import { useScan } from './ScanContext'
import { useI18n } from '../i18n'
import DeleteDialog from '../components/actions/DeleteDialog'
import ContextMenu from '../components/actions/ContextMenu'
import Toasts from '../components/actions/Toasts'
import { baseName, isInside } from '../utils/paths'

/**
 * FileActionsProvider renders the shared confirm dialog, context menu and toasts.
 * useFileActions() => {
 *   selection: Map<path, item>,               // selected items (item = view entry from the main process)
 *   isSelected(path), toggleSelect(item, additive?), selectOnly(item), setSelection(items[]), clearSelection(),
 *   requestDelete(items[], { permanent? }),   // confirm dialog -> api.deletePaths -> applyMeta + toast
 *                                             // returns a Promise<string[]|null>: deleted paths, null when cancelled
 *   openContextMenu(event, item),             // right-click menu for a file/dir entry
 *   showInFolder(path), openFolder(path),
 *   // extras
 *   notify({ kind, message, lines?, duration? }),   // kind: 'success' | 'warning' | 'error' | 'info'
 *   forgetPaths(paths),                       // drop paths (and everything below) from the selection
 *   subscribeDeleted(cb) => unsubscribe       // cb(deletedPaths[]) right before the views are refreshed
 * }
 */
const Ctx = createContext(null)

function isValidItem(item) {
  if (!item || typeof item.path !== 'string' || item.path.length === 0) return false
  if (item.type === 'other' || item.type === 'system') return false
  return !item.path.includes('\u0000')
}

/** Removes duplicates and items that live inside another item of the list. */
function normalizeItems(items) {
  const valid = []
  const seen = new Set()
  for (const it of items || []) {
    if (!isValidItem(it)) continue
    const key = it.path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    valid.push(it)
  }
  const dirs = valid.filter((it) => it.type === 'dir')
  return valid.filter((it) => !dirs.some((d) => d !== it && isInside(it.path, d.path) && it.path.length > d.path.length))
}

let toastSeq = 0

export function FileActionsProvider({ children }) {
  const { t, fmt } = useI18n()
  const { status, meta, applyMeta } = useScan()
  const [selection, setSelectionState] = useState(() => new Map())
  const [dialog, setDialog] = useState(null) // { items, permanent, busy }
  const [menu, setMenu] = useState(null) // { x, y, item }
  const [toasts, setToasts] = useState([])
  const resolveRef = useRef(null)
  const listeners = useRef(new Set())
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const dialogRef = useRef(null)
  dialogRef.current = dialog

  // ---------- toasts ----------
  const dismissToast = useCallback((id) => setToasts((list) => list.filter((x) => x.id !== id)), [])
  const notify = useCallback((toast) => {
    const id = ++toastSeq
    setToasts((list) => [...list.slice(-3), { ...toast, id }])
    return id
  }, [])

  // ---------- selection ----------
  const setSelection = useCallback((items) => {
    const next = new Map()
    for (const it of items || []) if (isValidItem(it)) next.set(it.path, it)
    setSelectionState(next)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectionState((prev) => (prev.size === 0 ? prev : new Map()))
  }, [])

  const selectOnly = useCallback((item) => {
    if (!isValidItem(item)) return
    setSelectionState(new Map([[item.path, item]]))
  }, [])

  const toggleSelect = useCallback((item, additive = true) => {
    if (!isValidItem(item)) return
    if (!additive) {
      setSelectionState(new Map([[item.path, item]]))
      return
    }
    setSelectionState((prev) => {
      const next = new Map(prev)
      if (next.has(item.path)) next.delete(item.path)
      else next.set(item.path, item)
      return next
    })
  }, [])

  const isSelected = useCallback((path) => selection.has(path), [selection])

  const forgetPaths = useCallback((paths) => {
    if (!paths || paths.length === 0) return
    setSelectionState((prev) => {
      if (prev.size === 0) return prev
      const next = new Map(prev)
      for (const p of prev.keys()) {
        if (paths.some((d) => isInside(p, d))) next.delete(p)
      }
      return next.size === prev.size ? prev : next
    })
  }, [])

  // A new scan or another target invalidates the selection
  useEffect(() => {
    setSelectionState((prev) => (prev.size === 0 ? prev : new Map()))
    setMenu(null)
  }, [status === 'scanning', meta?.rootPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const subscribeDeleted = useCallback((cb) => {
    listeners.current.add(cb)
    return () => listeners.current.delete(cb)
  }, [])

  // ---------- reveal / open ----------
  const showInFolder = useCallback(async (path) => {
    try {
      const ok = await window.api.showItemInFolder(path)
      if (ok === false) notify({ kind: 'error', message: t('actions.openFailed') })
    } catch {
      notify({ kind: 'error', message: t('actions.openFailed') })
    }
  }, [notify, t])

  const openFolder = useCallback(async (path) => {
    try {
      const ok = await window.api.openFolder(path)
      if (ok === false) notify({ kind: 'error', message: t('actions.openFailed') })
    } catch {
      notify({ kind: 'error', message: t('actions.openFailed') })
    }
  }, [notify, t])

  const copyPath = useCallback(async (path) => {
    try {
      await navigator.clipboard.writeText(path)
      notify({ kind: 'success', message: t('actions.copied'), duration: 2500 })
    } catch {
      notify({ kind: 'error', message: t('actions.copyFailed') })
    }
  }, [notify, t])

  // ---------- delete ----------
  const reasonFor = useCallback((code) => {
    switch (code) {
      case 'PROTECTED':
        return t('actions.errProtected')
      case 'NOT_IN_SCAN':
        return t('actions.errNotInScan')
      case 'EBUSY':
      case 'ETXTBSY':
        return t('actions.errBusy')
      case 'EPERM':
      case 'EACCES':
        return t('actions.errPerm')
      case 'ENOENT':
        return t('actions.errNotFound')
      default:
        return t('actions.errOther', { error: code || '?' })
    }
  }, [t])

  const finish = useCallback((value) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    if (resolve) resolve(value)
  }, [])

  const requestDelete = useCallback((items, opts = {}) => {
    const list = normalizeItems(items)
    if (list.length === 0 || dialogRef.current) return Promise.resolve(null)
    setMenu(null)
    setDialog({ items: list, permanent: !!opts.permanent, busy: false })
    return new Promise((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const cancelDelete = useCallback(() => {
    setDialog(null)
    finish(null)
  }, [finish])

  const confirmDelete = useCallback(async (permanent) => {
    const current = dialogRef.current
    if (!current || current.busy) return
    setDialog({ ...current, busy: true })
    const { items } = current
    let res
    try {
      res = await window.api.deletePaths(items.map((it) => it.path), { permanent })
    } catch (err) {
      setDialog(null)
      notify({ kind: 'error', message: t('actions.errGeneric', { error: err?.message || String(err) }) })
      finish([])
      return
    }

    const results = res?.results || []
    const okResults = results.filter((r) => r.ok)
    const failed = results.filter((r) => !r.ok)
    const deleted = okResults.map((r) => r.path)

    setDialog(null)
    // Listeners first (they flag the coming data change as "expected"), then refresh every view
    if (deleted.length > 0) {
      forgetPaths(deleted)
      listeners.current.forEach((cb) => {
        try {
          cb(deleted)
        } catch {}
      })
    }
    applyMeta(res?.meta)

    const names = new Map(items.map((it) => [it.path, it.name || baseName(it.path)]))
    const failLines = failed.slice(0, 4).map((f) =>
      t('actions.failedItem', { name: names.get(f.path) || baseName(f.path), reason: reasonFor(f.error) })
    )
    if (failed.length > 4) failLines.push(t('actions.failedMore', { count: failed.length - 4 }))

    const size = permanent ? res?.freed || 0 : okResults.reduce((sum, r) => sum + (r.size || 0), 0)
    const doneMsg = permanent
      ? t('actions.toastDeleted', { count: okResults.length, size: fmt.bytes(size) })
      : t('actions.toastTrashed', { count: okResults.length, size: fmt.bytes(size) })

    if (failed.length === 0) {
      notify({ kind: 'success', message: doneMsg })
    } else if (okResults.length === 0) {
      notify({ kind: 'error', message: t('actions.toastFailed', { count: failed.length }), lines: failLines })
    } else {
      notify({
        kind: 'warning',
        message: `${doneMsg} · ${t('actions.toastPartial', { ok: okResults.length, total: results.length })}`,
        lines: failLines
      })
    }
    finish(deleted)
  }, [applyMeta, fmt, forgetPaths, finish, notify, reasonFor, t])

  // ---------- context menu ----------
  const openContextMenu = useCallback((event, item) => {
    if (!isValidItem(item)) return
    event?.preventDefault?.()
    event?.stopPropagation?.()
    setMenu({ x: event?.clientX ?? 0, y: event?.clientY ?? 0, item })
  }, [])

  const closeMenu = useCallback(() => setMenu(null), [])

  const menuItems = useMemo(() => {
    if (!menu) return []
    const { item } = menu
    const sel = selectionRef.current
    const multi = sel.has(item.path) && sel.size > 1
    const targets = multi ? [...sel.values()] : [item]
    const list = []
    if (item.type === 'dir') {
      list.push({ id: 'open', icon: FolderOpen, label: t('common.openFolder'), onSelect: () => openFolder(item.path) })
    }
    list.push({ id: 'reveal', icon: ExternalLink, label: t('common.showInExplorer'), onSelect: () => showInFolder(item.path) })
    list.push({ id: 'copy', icon: Copy, label: t('actions.copyPath'), onSelect: () => copyPath(item.path) })
    list.push({ separator: true })
    list.push({
      id: 'trash',
      icon: Trash2,
      label: multi ? t('actions.trashSelected', { count: targets.length }) : t('common.moveToTrash'),
      onSelect: () => requestDelete(targets)
    })
    list.push({
      id: 'delete',
      icon: Flame,
      danger: true,
      label: multi ? t('actions.deleteSelected', { count: targets.length }) : t('common.deletePermanently'),
      onSelect: () => requestDelete(targets, { permanent: true })
    })
    return list
  }, [menu, t, openFolder, showInFolder, copyPath, requestDelete])

  const value = useMemo(
    () => ({
      selection,
      isSelected,
      toggleSelect,
      selectOnly,
      setSelection,
      clearSelection,
      requestDelete,
      openContextMenu,
      showInFolder,
      openFolder,
      notify,
      forgetPaths,
      subscribeDeleted
    }),
    [selection, isSelected, toggleSelect, selectOnly, setSelection, clearSelection, requestDelete,
      openContextMenu, showInFolder, openFolder, notify, forgetPaths, subscribeDeleted]
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      {dialog && (
        <DeleteDialog
          items={dialog.items}
          initialPermanent={dialog.permanent}
          busy={dialog.busy}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={closeMenu} />}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </Ctx.Provider>
  )
}

export function useFileActions() {
  return useContext(Ctx)
}
