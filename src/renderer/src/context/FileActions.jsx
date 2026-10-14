// STUB — to be implemented (see contract below)
import { createContext, useContext } from 'react'
/**
 * FileActionsProvider renders the shared confirm dialog, context menu and toasts.
 * useFileActions() => {
 *   selection: Map<path, item>,               // selected items (item = view entry from the main process)
 *   isSelected(path), toggleSelect(item, additive?), selectOnly(item), setSelection(items[]), clearSelection(),
 *   requestDelete(items[], { permanent? }),   // confirm dialog -> api.deletePaths -> applyMeta + toast
 *   openContextMenu(event, item),             // right-click menu for a file/dir entry
 *   showInFolder(path), openFolder(path)
 * }
 */
const Ctx = createContext(null)
const noop = () => {}
export function FileActionsProvider({ children }) {
  const value = { selection: new Map(), isSelected: () => false, toggleSelect: noop, selectOnly: noop, setSelection: noop, clearSelection: noop, requestDelete: noop, openContextMenu: noop, showInFolder: noop, openFolder: noop }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useFileActions() {
  return useContext(Ctx)
}
