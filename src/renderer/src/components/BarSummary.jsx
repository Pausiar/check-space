import { COLORS } from '../utils/colors'
import { formatBytes } from '../utils/format'

export default function BarSummary({ items }) {
  if (!items || items.length === 0) return null

  const sorted = [...items]
    .filter((c) => c.size > 0)
    .sort((a, b) => b.size - a.size)

  const top = sorted.slice(0, 10)
  const rest = sorted.slice(10)
  const maxSize = top[0]?.size || 1

  if (rest.length > 0) {
    const otherSize = rest.reduce((sum, c) => sum + c.size, 0)
    top.push({ name: `Other (${rest.length})`, size: otherSize, path: '__other__' })
  }

  return (
    <div className="bar-summary">
      {top.map((child, i) => (
        <div key={child.path} className="bar-row">
          <span className="bar-name" title={child.name}>
            {child.name}
          </span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${(child.size / maxSize) * 100}%`,
                backgroundColor: COLORS[i % COLORS.length]
              }}
            />
          </div>
          <span className="bar-size">{formatBytes(child.size)}</span>
        </div>
      ))}
    </div>
  )
}
