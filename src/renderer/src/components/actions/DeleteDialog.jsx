import { useState } from 'react'
import { Info, ShieldAlert, Folder, File } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { useI18n } from '../../i18n'
import { baseName } from '../../utils/paths'

const MAX_LISTED = 8

/** Body + footer of the delete confirmation. items: view entries (already deduplicated). */
export default function DeleteDialog({ items, initialPermanent = false, busy, onConfirm, onCancel }) {
  const { t, fmt } = useI18n()
  const [permanent, setPermanent] = useState(initialPermanent)

  const total = items.reduce((sum, it) => sum + (it.size || 0), 0)
  const listed = items.slice(0, MAX_LISTED)
  const rest = items.length - listed.length
  const hasDirs = items.some((it) => it.type === 'dir')

  return (
    <ConfirmDialog
      title={t('actions.confirmTitle', { count: items.length })}
      danger={permanent}
      busy={busy}
      confirmLabel={permanent ? t('actions.confirmPermanent') : t('actions.confirmTrash')}
      onConfirm={() => onConfirm(permanent)}
      onCancel={onCancel}
    >
      <ul className="fa-item-list">
        {listed.map((it) => {
          const Icon = it.type === 'dir' ? Folder : File
          return (
            <li key={it.path}>
              <Icon size={15} />
              <div className="fa-item-info">
                <span className="fa-item-name" title={it.path}>{it.name || baseName(it.path)}</span>
                <span className="fa-item-path" title={it.path}>{it.path}</span>
              </div>
              <span className="fa-item-size">{fmt.bytes(it.size || 0)}</span>
            </li>
          )
        })}
        {rest > 0 && <li className="fa-item-more">{t('actions.andMore', { count: rest })}</li>}
      </ul>
      <div className="fa-total">{t('actions.totalSize', { size: fmt.bytes(total) })}</div>

      <fieldset className="fa-options" disabled={busy}>
        <legend className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {t('actions.chooseMethod')}
        </legend>
        <label className={`fa-option ${!permanent ? 'selected' : ''}`}>
          <input type="radio" name="fa-delete-mode" checked={!permanent} onChange={() => setPermanent(false)} />
          <span>
            <div className="fa-option-title">{t('actions.optTrash')}</div>
            <div className="fa-option-hint">{t('actions.optTrashHint')}</div>
          </span>
        </label>
        <label className={`fa-option danger ${permanent ? 'selected' : ''}`}>
          <input type="radio" name="fa-delete-mode" checked={permanent} onChange={() => setPermanent(true)} />
          <span>
            <div className="fa-option-title">{t('actions.optPermanent')}</div>
            <div className="fa-option-hint">{t('actions.optPermanentHint')}</div>
          </span>
        </label>
      </fieldset>

      {permanent ? (
        <div className="fa-warning">
          <ShieldAlert size={16} />
          <span>
            {t('actions.permanentWarning')}
            {hasDirs ? ` ${t('actions.permanentWarningFolders')}` : ''}
          </span>
        </div>
      ) : (
        <div className="fa-note">
          <Info size={16} />
          <span>{t('actions.trashNote')}</span>
        </div>
      )}
    </ConfirmDialog>
  )
}
