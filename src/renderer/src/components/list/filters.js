const DAY = 86400000

export const EMPTY_FILTERS = {
  query: '',
  kind: 'all', // all | files | dirs
  exts: '',
  minSize: 'any',
  older: 'any',
  scope: 'folder' // folder | scan
}

export const MIN_SIZES = {
  any: 0,
  '1mb': 1024 * 1024,
  '10mb': 10 * 1024 * 1024,
  '100mb': 100 * 1024 * 1024,
  '1gb': 1024 * 1024 * 1024
}

export const OLDER = {
  any: 0,
  '1m': 30 * DAY,
  '6m': 182 * DAY,
  '1y': 365 * DAY,
  '3y': 1095 * DAY
}

export function parseExts(text) {
  return String(text || '')
    .split(/[\s,;]+/)
    .map((e) => e.replace(/^\*/, '').trim())
    .filter((e) => e && e !== '.')
}

/** True when any filter (other than the scope) is set. */
export function isActive(f) {
  return (
    f.query.trim() !== '' ||
    f.kind !== 'all' ||
    parseExts(f.exts).length > 0 ||
    f.minSize !== 'any' ||
    f.older !== 'any'
  )
}
