import { COLORS } from '../utils/colors'
import { formatBytes, formatNumber } from '../utils/format'

export default function FileTypes({ types }) {
  if (!types || types.length === 0) {
    return <div className="panel-empty">No file type data available</div>
  }

  const totalSize = types.reduce((sum, t) => sum + t.totalSize, 0)
  const maxSize = types[0]?.totalSize || 1

  return (
    <div className="file-types-panel">
      <div className="file-list-header">
        <h3>File Types</h3>
      </div>
      <div className="file-types-chart">
        <div className="file-types-bar">
          {types.slice(0, 10).map((type, i) => (
            <div
              key={type.ext}
              className="file-type-segment"
              style={{
                width: `${(type.totalSize / totalSize) * 100}%`,
                backgroundColor: COLORS[i % COLORS.length],
                minWidth: '2px'
              }}
              title={`${type.ext}: ${formatBytes(type.totalSize)} (${type.count} files)`}
            />
          ))}
        </div>
        <div className="file-types-legend">
          {types.slice(0, 10).map((type, i) => (
            <span key={type.ext} className="file-type-legend-item">
              <span
                className="file-type-dot"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              {type.ext}
            </span>
          ))}
        </div>
      </div>
      <div className="file-list">
        {types.map((type, i) => (
          <div key={type.ext} className="file-row">
            <span
              className="file-type-indicator"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <div className="file-info">
              <span className="file-name">{type.ext}</span>
              <span className="file-path">{formatNumber(type.count)} files</span>
            </div>
            <div className="file-type-bar-track">
              <div
                className="file-type-bar-fill"
                style={{
                  width: `${(type.totalSize / maxSize) * 100}%`,
                  backgroundColor: COLORS[i % COLORS.length]
                }}
              />
            </div>
            <span className="file-size">{formatBytes(type.totalSize)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
