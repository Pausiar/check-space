import { useMemo } from 'react'
import { X, Trash2, Flame } from 'lucide-react'
import { useFileActions } from '../context/FileActions'
import { useI18n } from '../i18n'
import { isInside } from '../utils/paths'
import './SelectionBar.css'

export default function SelectionBar() {
  const { t, fmt } = useI18n()
  const { selection, clearSelection, requestDelete } = useFileActions()

  const total = useMemo(() => {
    const items = [...selection.values()]
    const dirs = items.filter((it) => it.type === 'dir')
    let sum = 0
    for (const it of items) {
      if (it.hardlink) continue
      // Do not count twice what lives inside another selected folder
      if (dirs.some((d) => d !== it && it.path.length > d.path.length && isInside(it.path, d.path))) continue
      sum += it.size || 0
    }
    return sum
  }, [selection])

  if (selection.size === 0) return null
  const items = [...selection.values()]

  return (
    <div className="selection-bar" role="toolbar" aria-label={t('actions.selectedCount', { count: selection.size })}>
      <div className="selection-bar-info">
        <strong>{t('actions.selectedCount', { count: selection.size })}</strong>
        <span className="selection-bar-sep">·</span>
        <span>{fmt.bytes(total)}</span>
      </div>
      <div className="selection-bar-actions">
        <button className="btn-secondary" onClick={clearSelection}>
          <X size={14} />
          {t('actions.clearSelection')}
        </button>
        <button className="btn-secondary" onClick={() => requestDelete(items)} title={t('actions.trashHint')}>
          <Trash2 size={14} />
          {t('common.moveToTrash')}
          <kbd>{t('actions.trashHint')}</kbd>
        </button>
        <button className="btn-danger-solid" onClick={() => requestDelete(items, { permanent: true })} title={t('actions.deleteHint')}>
          <Flame size={14} />
          {t('common.deletePermanently')}
          <kbd>{t('actions.deleteHint')}</kbd>
        </button>
      </div>
    </div>
  )
}
