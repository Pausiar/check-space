import { Search, X } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MIN_SIZES, OLDER } from './filters'

export default function FilterBar({ filters, setFilters, active, canScope, onClear, searchInputRef }) {
  const { t } = useI18n()
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))

  return (
    <div className="list-filters">
      <div className="list-search">
        <Search size={14} />
        <input
          ref={searchInputRef}
          type="text"
          value={filters.query}
          placeholder={t('list.searchPlaceholder')}
          title={t('list.searchHint')}
          spellCheck={false}
          onChange={(e) => set({ query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && filters.query) {
              e.preventDefault()
              set({ query: '' })
            }
          }}
        />
        {filters.query && (
          <button className="list-search-clear" onClick={() => set({ query: '' })} title={t('list.clear')} aria-label={t('list.clear')}>
            <X size={13} />
          </button>
        )}
      </div>

      <label className="list-field">
        <span>{t('list.kindLabel')}</span>
        <select value={filters.kind} onChange={(e) => set({ kind: e.target.value })}>
          <option value="all">{t('list.kind_all')}</option>
          <option value="files">{t('list.kind_files')}</option>
          <option value="dirs">{t('list.kind_dirs')}</option>
        </select>
      </label>

      <label className="list-field">
        <span>{t('list.extLabel')}</span>
        <input
          type="text"
          className="list-ext"
          value={filters.exts}
          placeholder={t('list.extPlaceholder')}
          spellCheck={false}
          onChange={(e) => set({ exts: e.target.value })}
        />
      </label>

      <label className="list-field">
        <span>{t('list.minSizeLabel')}</span>
        <select value={filters.minSize} onChange={(e) => set({ minSize: e.target.value })}>
          {Object.keys(MIN_SIZES).map((k) => (
            <option key={k} value={k}>{t(`list.minSize_${k}`)}</option>
          ))}
        </select>
      </label>

      <label className="list-field">
        <span>{t('list.olderLabel')}</span>
        <select value={filters.older} onChange={(e) => set({ older: e.target.value })}>
          {Object.keys(OLDER).map((k) => (
            <option key={k} value={k}>{t(`list.older_${k}`)}</option>
          ))}
        </select>
      </label>

      <div className="segmented" role="radiogroup" aria-label={t('list.scopeLabel')}>
        <button
          role="radio"
          aria-checked={filters.scope === 'folder'}
          className={filters.scope === 'folder' ? 'active' : ''}
          disabled={!canScope}
          onClick={() => set({ scope: 'folder' })}
        >
          {t('list.scopeFolder')}
        </button>
        <button
          role="radio"
          aria-checked={filters.scope === 'scan'}
          className={filters.scope === 'scan' || !canScope ? 'active' : ''}
          onClick={() => set({ scope: 'scan' })}
        >
          {t('list.scopeScan')}
        </button>
      </div>

      {active && (
        <button className="btn-link" onClick={onClear}>
          {t('list.clearFilters')}
        </button>
      )}
    </div>
  )
}
