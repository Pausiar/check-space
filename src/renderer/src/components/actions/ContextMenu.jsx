import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './actions.css'

/**
 * items: [{ id, label, icon?, danger?, onSelect } | { separator: true }]
 * Positioned at (x, y) in viewport coordinates and kept inside the window.
 */
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const margin = 8
    const { width, height } = el.getBoundingClientRect()
    const left = Math.max(margin, Math.min(x, window.innerWidth - width - margin))
    const top = Math.max(margin, Math.min(y, window.innerHeight - height - margin))
    setPos({ left, top })
    el.querySelector('button')?.focus()
  }, [x, y, items])

  useEffect(() => {
    const close = () => onClose()
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('contextmenu', onDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', close, true)
    window.addEventListener('wheel', close, { passive: true })
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('contextmenu', onDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('wheel', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
    }
  }, [onClose])

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const buttons = [...ref.current.querySelectorAll('button')]
    const i = buttons.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  return createPortal(
    <div
      className="fa-menu"
      role="menu"
      ref={ref}
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.separator) return <div key={`sep${i}`} className="fa-menu-sep" role="separator" />
        const Icon = item.icon
        return (
          <button
            key={item.id}
            role="menuitem"
            className={`fa-menu-item ${item.danger ? 'danger' : ''}`}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            {Icon ? <Icon size={14} /> : <span className="fa-menu-noicon" />}
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}
