import { useEffect, useLayoutEffect, useRef } from 'react'

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTextTarget(el) {
  if (!el) return false
  return TEXT_TAGS.has(el.tagName) || el.isContentEditable === true
}

function modalIsOpen() {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null
}

/**
 * Global keyboard shortcuts for the scan screen.
 *   Backspace / Alt+Left          -> onUp()
 *   Delete / Shift+Delete         -> onDelete() / onDeletePermanent()
 *   Ctrl+F                        -> onSearch()
 *   F5 / Ctrl+R                   -> onRescan()
 *   Ctrl+1 .. Ctrl+7              -> onTab(0 .. 6)
 * Ignored while typing in a field or while a modal dialog is open.
 */
export function useKeyboardShortcuts({ onUp, onDelete, onDeletePermanent, onSearch, onRescan, onTab, enabled = true } = {}) {
  const handlersRef = useRef({})

  useLayoutEffect(() => {
    handlersRef.current = { onUp, onDelete, onDeletePermanent, onSearch, onRescan, onTab }
  })

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') return
      if (isTextTarget(e.target) || isTextTarget(document.activeElement)) return
      if (modalIsOpen()) return

      const h = handlersRef.current
      const ctrl = e.ctrlKey && !e.altKey
      const plain = !e.ctrlKey && !e.altKey && !e.shiftKey
      let action = null

      if (e.key === 'Backspace' && plain) {
        action = h.onUp
      } else if (e.key === 'ArrowLeft' && e.altKey && !e.ctrlKey && !e.shiftKey) {
        action = h.onUp
      } else if (e.key === 'Delete' && !e.ctrlKey && !e.altKey) {
        action = e.shiftKey ? h.onDeletePermanent : h.onDelete
      } else if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'f') {
        action = h.onSearch
      } else if ((e.key === 'F5' && !e.ctrlKey && !e.altKey && !e.shiftKey) || (ctrl && !e.shiftKey && e.key.toLowerCase() === 'r')) {
        action = h.onRescan
      } else if (ctrl && !e.shiftKey && /^[1-7]$/.test(e.key)) {
        const index = Number(e.key) - 1
        action = h.onTab ? () => h.onTab(index) : null
      }

      if (typeof action !== 'function') return
      e.preventDefault()
      action()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
