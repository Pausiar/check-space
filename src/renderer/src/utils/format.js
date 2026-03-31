export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatNumber(num) {
  return num.toLocaleString('es-ES')
}

export function truncatePath(p, maxLen = 60) {
  if (p.length <= maxLen) return p
  return '...' + p.slice(p.length - maxLen + 3)
}

export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function timeAgo(timestamp) {
  const diff = Date.now() - timestamp
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days < 30) return `${days} días`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} meses`
  const years = Math.floor(months / 12)
  return `${years} año${years > 1 ? 's' : ''}`
}
