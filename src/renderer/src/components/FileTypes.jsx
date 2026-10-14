import { useMemo } from 'react'
import { useI18n } from '../i18n'
import { CATEGORIES, COLORS, NEUTRAL, categoryOf, colorForExt } from '../utils/colors'
import './FileLists.css'

const TOP = 10
const LEGEND_LIMIT = 10

/** Derived data for the charts and table; computed once per (types, metric). */
function buildModel(types, metric) {
  const rows = types.map((ty) => ({
    ext: ty.ext || '',
    value: ty[metric] ?? 0,
    count: ty.count ?? 0,
    category: categoryOf(ty.ext || '')
  }))
  rows.sort((a, b) => b.value - a.value)

  const total = rows.reduce((sum, r) => sum + r.value, 0)
  const totalCount = rows.reduce((sum, r) => sum + r.count, 0)

  // Known extensions keep their category colour; unknown ones cycle through COLORS
  let unknown = 0
  for (const r of rows) {
    r.color = r.category === 'other' ? COLORS[unknown++ % COLORS.length] : colorForExt(r.ext)
  }

  const byCategory = new Map()
  for (const r of rows) {
    const c = byCategory.get(r.category) || { key: r.category, value: 0, count: 0 }
    c.value += r.value
    c.count += r.count
    byCategory.set(r.category, c)
  }
  const categories = [...byCategory.values()].sort((a, b) => b.value - a.value)

  const top = rows.slice(0, TOP)
  const restValue = rows.slice(TOP).reduce((sum, r) => sum + r.value, 0)
  return { rows, total, totalCount, categories, top, restValue, restCount: Math.max(0, rows.length - TOP) }
}

export default function FileTypes({ types, metric = 'size' }) {
  const { t, fmt } = useI18n()
  const model = useMemo(() => (types ? buildModel(types, metric) : null), [types, metric])

  const header = (
    <div className="file-list-header">
      <h3>{t('files.typesTitle')}</h3>
      {model && model.rows.length > 0 && (
        <span className="header-badge">
          {t('files.typesTotal', { count: model.totalCount, size: fmt.bytes(model.total) })}
        </span>
      )}
    </div>
  )

  if (!model) {
    return (
      <div className="file-types-panel">
        {header}
        <div className="panel-empty">{t('common.loading')}</div>
      </div>
    )
  }

  if (model.rows.length === 0) {
    return (
      <div className="file-types-panel">
        {header}
        <div className="panel-empty">{t('files.typesEmpty')}</div>
      </div>
    )
  }

  const { total, rows, categories, top, restValue, restCount } = model
  const share = (value) => (total > 0 ? value / total : 0)
  const label = (ext) => ext || t('common.noExtension')
  const maxValue = rows[0].value || 1
  const categoryColor = (key) => CATEGORIES[key]?.color ?? NEUTRAL

  return (
    <div className="file-types-panel">
      {header}

      <div className="file-type-categories">
        {categories.map((c) => {
          const color = categoryColor(c.key)
          return (
            <div key={c.key} className="file-type-category">
              <div className="file-type-category-head">
                <span className="file-type-dot" style={{ backgroundColor: color }} />
                <span>{t(`files.${c.key}`)}</span>
                <span className="file-type-category-pct">{fmt.percent(share(c.value))}</span>
              </div>
              <span className="file-type-category-value">{fmt.bytes(c.value)}</span>
              <div className="file-type-bar-track">
                <div className="file-type-bar-fill" style={{ width: `${share(c.value) * 100}%`, backgroundColor: color }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="file-types-chart">
        <div className="file-types-bar">
          {top.map((r) => (
            <div
              key={r.ext}
              className="file-type-segment"
              style={{ width: `${share(r.value) * 100}%`, backgroundColor: r.color, minWidth: '2px' }}
              title={`${label(r.ext)}: ${fmt.bytes(r.value)} (${fmt.percent(share(r.value))})`}
            />
          ))}
          {restValue > 0 && (
            <div
              className="file-type-segment"
              style={{ width: `${share(restValue) * 100}%`, backgroundColor: NEUTRAL, minWidth: '2px' }}
              title={`${t('files.restLabel')}: ${fmt.bytes(restValue)} (${fmt.percent(share(restValue))})`}
            />
          )}
        </div>
        <div className="file-types-legend">
          {top.slice(0, LEGEND_LIMIT).map((r) => (
            <span key={r.ext} className="file-type-legend-item">
              <span className="file-type-dot" style={{ backgroundColor: r.color }} />
              {label(r.ext)} · {fmt.percent(share(r.value))}
            </span>
          ))}
          {restValue > 0 && (
            <span className="file-type-legend-item">
              <span className="file-type-dot" style={{ backgroundColor: NEUTRAL }} />
              {t('files.restLabel')} ({restCount}) · {fmt.percent(share(restValue))}
            </span>
          )}
        </div>
      </div>

      <div className="file-types-table">
        <div className="file-type-head">
          <span />
          <span className="file-type-ext">{t('files.colType')}</span>
          <span className="file-type-cat">{t('files.colCategory')}</span>
          <span className="file-type-count">{t('files.colCount')}</span>
          <span className="file-type-bar-cell" />
          <span className="file-type-share">{t('files.colShare')}</span>
          <span className="file-size">{t('common.size')}</span>
        </div>
        {rows.map((r) => (
          <div key={r.ext} className="file-type-row">
            <span className="file-type-indicator" style={{ backgroundColor: r.color }} />
            <span className="file-type-ext" title={label(r.ext)}>
              {label(r.ext)}
            </span>
            <span className="file-type-cat">{t(`files.${r.category}`)}</span>
            <span className="file-type-count">{fmt.number(r.count)}</span>
            <div className="file-type-bar-cell">
              <div className="file-type-bar-track">
                <div
                  className="file-type-bar-fill"
                  style={{ width: `${(r.value / maxValue) * 100}%`, backgroundColor: r.color }}
                />
              </div>
            </div>
            <span className="file-type-share">{fmt.percent(share(r.value))}</span>
            <span className="file-size">{fmt.bytes(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
